"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { RIDE_STOPS } from "./ride-stops";
import { initialJourney } from "./ride-journey.mjs";
import type { RideController, RideSnapshot } from "./ride-world";
import "./ride.css";

export const dynamic = "force-static";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const initial: RideSnapshot = { ...initialJourney(), speed: 0 };

export default function RidePrototype() {
  const mount = useRef<HTMLDivElement>(null);
  const controller = useRef<RideController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const timeline = useRef<HTMLDivElement>(null);
  const [snapshot, setSnapshot] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let world: RideController | undefined;
    import("./ride-world").then(async ({ createRide }) => {
      if (!mount.current || cancelled) return;
      world = await createRide(mount.current, setSnapshot);
      if (cancelled) { world.dispose(); return; }
      controller.current = world;
      setReady(true);
    }).catch(() => {
      if (!cancelled) setError("No pudimos preparar el mundo 3D. Probá recargar o abrirlo en un navegador con WebGL habilitado.");
    });
    return () => { cancelled = true; world?.dispose(); controller.current = null; };
  }, []);

  const riding = snapshot.phase === "riding";
  const paused = snapshot.phase === "paused";
  const moving = riding || paused;
  const finished = snapshot.stop === RIDE_STOPS.length - 1;
  const current = RIDE_STOPS[snapshot.stop];
  const destination = RIDE_STOPS[snapshot.to];
  const timelinePosition = moving ? snapshot.from + snapshot.progress : snapshot.stop;
  const timelinePercent = timelinePosition / (RIDE_STOPS.length - 1) * 100;
  const timelineFocus = moving ? snapshot.to : snapshot.stop;
  useEffect(() => {
    const scroller = timeline.current;
    if (!scroller) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const center = (behavior: ScrollBehavior) => scroller.scrollTo({ left: timelineFocus * 104 + 52 - scroller.clientWidth / 2, behavior });
    center(reduceMotion ? "instant" : "smooth");
    let width = scroller.clientWidth;
    const observer = new ResizeObserver(() => {
      if (scroller.clientWidth !== width) { width = scroller.clientWidth; center("instant"); }
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [timelineFocus]);

  return <main className="ride-experience">
    <div className="ride-world" ref={mount} role="img" aria-label="Vista en primera persona desde un carro sobre un gasoducto, entre sierras y las paradas de la historia de TGS" />
    <div className="ride-vignette" />
    <header className="ride-header">
      <div className="ride-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/brand/tgs-logo-color.svg`} alt="TGS" width="94" height="46" />
      </div>
      <div className="ride-header-actions">
        {snapshot.phase !== "idle" && <button onClick={() => controller.current?.reset()} aria-label="Volver a la salida"><span aria-hidden="true">↺</span> Reiniciar</button>}
        <a href={`${base}/`} aria-label="Volver a la portada">Salir <span aria-hidden="true">↗</span></a>
      </div>
    </header>

    <nav className="ride-timeline" aria-label={`Línea de tiempo. ${moving ? `Viajando hacia ${destination.year}` : `Estamos en ${current.year}`}`}>
      {/* A horizontally scrollable region needs focus for keyboard scrolling. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="ride-timeline-scroll" ref={timeline} tabIndex={0} role="region" aria-label="Desplazar la línea de tiempo">
        <div className="ride-timeline-content" style={{ "--ride-stop-count": RIDE_STOPS.length } as CSSProperties}>
          <div className="ride-timeline-line"><i style={{ width: `${timelinePercent}%` }} /><b style={{ left: `${timelinePercent}%` }} /></div>
          <ol>{RIDE_STOPS.map((stop, index) => <li key={stop.id} className={index === snapshot.stop ? "is-current" : index < timelinePosition ? "is-visited" : ""} aria-current={!moving && index === snapshot.stop ? "step" : undefined}><span className="ride-timeline-dot" /><strong>{stop.year}</strong><small title={stop.title}>{index === 0 ? "Salida" : stop.title}</small></li>)}</ol>
        </div>
      </div>
    </nav>

    <div className="ride-bottom">
      <section className="ride-stop-card" aria-label="Controles del recorrido">
        <div className="ride-stop-index">{String(moving ? snapshot.to : snapshot.stop).padStart(2, "0")}</div>
        <div className="ride-stop-copy"><span>{moving ? `Hacia ${destination.year}` : current.year}</span><h2>{moving ? destination.title : current.title}</h2></div>
        <div className="ride-card-actions">
          {!moving && <button className="ride-image-button" disabled={!ready || !!error} onClick={() => dialog.current?.showModal()}><span aria-hidden="true">⤢</span> Ver imagen</button>}
          <button className="ride-primary" disabled={!ready || !!error} onClick={() => {
            if (finished) controller.current?.reset();
            else if (riding) controller.current?.pause();
            else controller.current?.start();
          }}>{!ready ? "Preparando…" : riding ? "Pausar" : paused ? "Continuar" : finished ? "Volver al inicio" : "Siguiente parada"}<span aria-hidden="true">{riding ? "Ⅱ" : finished ? "↺" : "→"}</span></button>
        </div>
      </section>
    </div>

    <p className="ride-sr-only" role="status">{error || (!ready ? "Preparando recorrido" : riding ? `Viajando hacia ${destination.title}, ${destination.year}` : paused ? "Recorrido en pausa" : `Parada ${snapshot.stop}: ${current.title}. ${current.year}`)}</p>
    {error && <div className="ride-error" role="alert"><p>{error}</p><button onClick={() => window.location.reload()}>Reintentar</button></div>}
    <dialog className="ride-artwork-dialog" ref={dialog} aria-labelledby="ride-artwork-title">
      <div className="ride-artwork-heading"><div><span className="ride-eyebrow">PARADA {String(snapshot.stop).padStart(2, "0")} · {current.year}</span><h2 id="ride-artwork-title">{current.title}</h2></div><button onClick={() => dialog.current?.close()} aria-label="Cerrar imagen">✕</button></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.src} alt={current.alt} />
      <p>{current.caption}</p>
    </dialog>
  </main>;
}
