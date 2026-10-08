"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  kind: "intro" | "outro";
  onContinue: () => void;
  onRestart: () => void;
};

/** The native modal keeps touch, keyboard and focus inside the interlude. */
export default function ExperienceInterlude({ kind, onContinue, onRestart }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [leaving, setLeaving] = useState(false);
  const isIntro = kind === "intro";
  const finish = useCallback(() => setLeaving(true), []);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    titleRef.current?.focus();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(onContinue, reducedMotion ? 180 : 1100);
    return () => window.clearTimeout(timer);
  }, [leaving, onContinue]);

  // Leave time to read, and start a fresh reading window after returning to the tab.
  useEffect(() => {
    if (!isIntro || leaving) return;
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(finish, 9000);
    };
    schedule();
    document.addEventListener("visibilitychange", schedule);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [finish, isIntro, leaving]);

  return (
    <dialog ref={dialogRef}
      className={`experience-interlude experience-interlude--${kind}${leaving ? " experience-interlude--leaving" : ""}`}
      aria-labelledby="interlude-title" aria-describedby="interlude-message"
      onCancel={(event) => { event.preventDefault(); finish(); }}>
      <div className="interlude-space" aria-hidden="true">
        <div className="interlude-stars" />
        <div className="interlude-orbit interlude-orbit--one" />
        <div className="interlude-orbit interlude-orbit--two" />
        <div className="interlude-orbit interlude-orbit--three" />
        <div className="interlude-beam" />
      </div>
      <div className="interlude-content">
        <span className="interlude-kicker"><span /> {isIntro ? "Nuestra historia · TGS" : "El futuro sigue"}</span>
        <h2 ref={titleRef} id="interlude-title" tabIndex={-1}>
          {isIntro ? <>Cada paso nos trajo<br />hasta acá.</> : <>Gracias por ser parte<br />de nuestra historia.</>}
        </h2>
        <p id="interlude-message">{isIntro
          ? "Acompañanos a recorrer la historia de nuestra empresa: un camino de desafíos, crecimiento y energía compartida."
          : "Esperamos que hayas disfrutado este recorrido. Seguimos construyendo lo que viene, juntos."}</p>
        <div className="interlude-actions">
          {isIntro ? (
            <button type="button" className="interlude-primary" onClick={finish} disabled={leaving}>
              Entrar al recorrido <span aria-hidden="true">↗</span>
            </button>
          ) : (
            <>
              <button type="button" className="interlude-primary" onClick={onRestart} disabled={leaving}>
                Volver a vivirlo <span aria-hidden="true">↗</span>
              </button>
              <button type="button" className="interlude-secondary" onClick={finish} disabled={leaving}>Seguir explorando</button>
            </>
          )}
        </div>
        {isIntro ? <div className="interlude-countdown" aria-hidden="true"><span /></div> : null}
      </div>
      <div className="interlude-footer" aria-hidden="true"><span>TGS</span><span>Energía que nos conecta</span></div>
    </dialog>
  );
}
