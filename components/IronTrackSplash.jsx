import React, { useEffect, useState } from "react";
import IronTrackAppIcon from "./IronTrackAppIcon.jsx";

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

/**
 * Splash breve al arranque (una vez por pestaña, vía sessionStorage en el padre).
 * Respeta prefers-reduced-motion: duración más corta y ícono sin animación.
 */
export default function IronTrackSplash({ onComplete }) {
  const [fadeOut, setFadeOut] = useState(false);
  const reducedMotion = typeof window !== "undefined" ? prefersReducedMotion() : false;

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const totalMs = reduced ? 560 : 1480;
    const fadeStart = Math.max(0, totalMs - 240);
    const tFade = setTimeout(() => setFadeOut(true), fadeStart);
    const tDone = setTimeout(() => {
      if (typeof onComplete === "function") onComplete();
    }, totalMs);
    return () => {
      clearTimeout(tFade);
      clearTimeout(tDone);
    };
  }, [onComplete]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="it-splash-title"
      aria-describedby="it-splash-sub"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
        boxSizing: "border-box",
        background: "linear-gradient(165deg, #0f172a 0%, #070d18 48%, #020308 100%)",
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.22s ease-out",
        pointerEvents: "auto",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }} aria-hidden="true" />
      <IronTrackAppIcon size={112} animated={!reducedMotion} />
      <h1
        id="it-splash-title"
        style={{
          margin: "28px 0 0",
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        IronTrack
      </h1>
      <p
        id="it-splash-sub"
        style={{
          margin: "10px 0 0",
          maxWidth: 320,
          textAlign: "center",
          fontSize: 14,
          lineHeight: 1.45,
          color: "rgba(226, 232, 240, 0.72)",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        Tu entrenamiento. Tu progreso. Tu mejor versión.
      </p>
      <div style={{ flex: 1.2, minHeight: 0 }} aria-hidden="true" />
    </div>
  );
}
