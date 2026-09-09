"use client";

import { useEffect, useRef, useState } from "react";

export default function MaskEditorAccess({ authenticate, onUnlock, onCancel }: {
  authenticate: (password: string, signal: AbortSignal) => Promise<void>;
  onUnlock: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    inputRef.current?.focus();
    return () => {
      requestRef.current?.abort();
      dialog?.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="editor-access" aria-labelledby="editor-access-title"
      aria-describedby="editor-access-description"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const controller = new AbortController();
        requestRef.current = controller;
        setBusy(true);
        setError("");
        try {
          await authenticate(password,controller.signal);
          if (!controller.signal.aborted) onUnlock();
        } catch (failure) {
          if (!controller.signal.aborted) {
            setError(failure instanceof Error ? failure.message : "No se pudo conectar. Intentá nuevamente.");
            inputRef.current?.focus();
            inputRef.current?.select();
          }
        } finally {
          if (!controller.signal.aborted) setBusy(false);
        }
      }}>
        <h2 id="editor-access-title">Editar máscaras</h2>
        <p id="editor-access-description">Ingresá la contraseña para modificar la experiencia.</p>
        <label htmlFor="editor-password">Contraseña</label>
        <input ref={inputRef} id="editor-password" type="password" inputMode="numeric"
          autoComplete="off" required value={password}
          aria-invalid={!!error} aria-describedby={error ? "editor-access-error" : undefined}
          readOnly={busy} onChange={(event) => { setPassword(event.target.value); setError(""); }} />
        {error ? <p id="editor-access-error" role="alert">{error}</p> : null}
        <div className="editor-access__actions">
          <button type="button" onClick={onCancel}>Cancelar</button>
          <button type="submit" disabled={busy}>{busy ? "Verificando…" : "Entrar al editor"}</button>
        </div>
      </form>
    </dialog>
  );
}
