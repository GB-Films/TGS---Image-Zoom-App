"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { validateMasks, validateSnapshot, type MaskSettings } from "../shared/mask-settings.mjs";

type Snapshot = ReturnType<typeof validateSnapshot>;
const DRAFT_KEY = "tgs-mask-draft-shared-v1";
const LEGACY_KEY = "tgs-zoom-mask-settings-production-8-v3";
const publicBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function useSharedMasks(transitions: MaskSettings[], setTransitions: (value: MaskSettings[]) => void,
  editing: boolean, dragging: boolean) {
  const [ready, setReady] = useState(false);
  const [published, setPublished] = useState<Snapshot>({version:0,updatedAt:null,transitions});
  const [pending, setPending] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const endpoint = useRef("");
  const token = useRef("");
  const current = useRef({transitions,published});
  useLayoutEffect(() => { current.current = {transitions,published}; },[transitions,published]);
  const publication = useRef<{requestId:string; payload:string; baseVersion:number} | null>(null);
  const dirty = useMemo(() => JSON.stringify(transitions) !== JSON.stringify(published.transitions),[transitions,published]);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const signal = init.signal
      ? AbortSignal.any([init.signal,AbortSignal.timeout(12000)]) : AbortSignal.timeout(12000);
    if (!endpoint.current) {
      const config = await fetch(`${publicBase}/mask-service.json`,{cache:"no-store",signal});
      if (!config.ok) throw new Error("No se pudo conectar con el servicio de máscaras.");
      const data = await config.json();
      const url = new URL(data.url);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost","127.0.0.1"].includes(url.hostname))) throw new Error("Dirección del servicio inválida.");
      endpoint.current = url.origin;
    }
    const response = await fetch(`${endpoint.current}${path}`,{
      ...init,signal,cache:"no-store",credentials:"omit",
      headers:{"Content-Type":"application/json",...init.headers},
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo completar la operación.");
    return result;
  },[]);

  const accept = useCallback((snapshot: Snapshot) => {
    setPublished(snapshot);
    setTransitions(snapshot.transitions);
    setPending(null);
    setLoadError("");
  },[setTransitions]);

  useEffect(() => {
    const controller = new AbortController();
    let first = true;
    let busy = false;
    const refresh = async () => {
      if (busy || controller.signal.aborted) return;
      busy = true;
      try {
        const data = validateSnapshot(await request("/masks",{signal:controller.signal}));
        if (controller.signal.aborted) return;
        if (first) accept(data);
        else if (data.version > current.current.published.version) setPending(data);
        setLoadError("");
      } catch {
        if (!controller.signal.aborted) setLoadError("Sin conexión al guardado compartido. Se muestra la última versión cargada.");
      } finally {
        busy = false;
        first = false;
        if (!controller.signal.aborted) setReady(true);
      }
    };
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); },30000);
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus",onFocus);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus",onFocus); };
  },[accept,request]);

  const saveDraft = useCallback(() => {
    const value = current.current;
    if (JSON.stringify(value.transitions) === JSON.stringify(value.published.transitions)) return;
    try {
      window.localStorage.setItem(DRAFT_KEY,JSON.stringify({baseVersion:value.published.version,transitions:value.transitions}));
    } catch { setMessage("El navegador no permite guardar el borrador. Publicá antes de cerrar para conservar tus cambios."); }
  },[]);

  useEffect(() => {
    if (!editing || dragging || !dirty) return;
    const timer = window.setTimeout(saveDraft,450);
    return () => window.clearTimeout(timer);
  },[transitions,editing,dragging,dirty,saveDraft]);

  useEffect(() => {
    if (!editing || !dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { saveDraft(); event.preventDefault(); event.returnValue = ""; };
    const onHide = () => { if (document.hidden) saveDraft(); };
    window.addEventListener("beforeunload",beforeUnload);
    document.addEventListener("visibilitychange",onHide);
    return () => { window.removeEventListener("beforeunload",beforeUnload); document.removeEventListener("visibilitychange",onHide); };
  },[editing,dirty,saveDraft]);

  const login = async (password: string, signal: AbortSignal) => {
    const result = await request("/session",{method:"POST",body:JSON.stringify({password}),signal});
    if (typeof result.token !== "string" || !/^[a-f0-9]{64}$/.test(result.token)) throw new Error("Respuesta de acceso inválida.");
    // Get the authoritative version before opening the editor; old local settings never win silently.
    const latest = validateSnapshot(await request("/masks",{signal}));
    signal.throwIfAborted();
    token.current = result.token;
    accept(latest);
    setMessage("");
  };

  const exit = () => {
    saveDraft();
    const oldToken = token.current;
    token.current = "";
    if (oldToken) void request("/session",{method:"DELETE",headers:{Authorization:`Bearer ${oldToken}`}}).catch(()=>{});
    setTransitions(current.current.published.transitions);
    setMessage("");
  };

  const restoreDraft = () => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      const legacy = raw ? null : window.localStorage.getItem(LEGACY_KEY);
      if (!raw && !legacy) { setMessage("No hay un borrador guardado en este navegador."); return; }
      const draft = raw ? JSON.parse(raw) : {transitions:JSON.parse(legacy!)};
      setTransitions(validateMasks(draft.transitions));
      setMessage("Borrador recuperado. Revisá las siete uniones antes de publicar sobre la versión actual.");
    } catch { setMessage("No se pudo recuperar el borrador. La versión publicada sigue intacta."); }
  };

  const publish = async () => {
    if (publishing || !dirty || !token.current) return;
    saveDraft();
    setPublishing(true);
    setMessage("");
    try {
      const masks = validateMasks(current.current.transitions);
      const payload = JSON.stringify(masks);
      const baseVersion = current.current.published.version;
      if (!publication.current || publication.current.payload !== payload || publication.current.baseVersion !== baseVersion) {
        publication.current = {requestId:crypto.randomUUID(),payload,baseVersion};
      }
      const data = validateSnapshot(await request("/masks",{method:"PUT",
        headers:{Authorization:`Bearer ${token.current}`},
        body:JSON.stringify({...publication.current,transitions:masks,payload:undefined}),
      }));
      setPublished(data);
      setPending(value => value && value.version > data.version ? value : null);
      publication.current = null;
      setMessage(`Versión ${data.version} publicada para todos.`);
      setLoadError("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo publicar. Tu borrador se conserva.");
    } finally { setPublishing(false); }
  };

  const loadLatest = async () => {
    saveDraft();
    const latest = validateSnapshot(await request("/masks"));
    accept(latest);
    setMessage("Versión publicada cargada. Podés recuperar tu borrador si necesitás compararlo.");
  };

  return {ready,published,pending,message,loadError,publishing,dirty,login,exit,publish,restoreDraft,loadLatest};
}
