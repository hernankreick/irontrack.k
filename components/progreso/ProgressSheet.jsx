import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Hoja de Progreso del entrenador: inferior en móvil (< 768 px), diálogo centrado en escritorio.
 * Modal con nombre, cierre de 44×44, Escape, foco al abrir y devolución del foco al cerrar, scroll solo en el cuerpo
 * (overscroll contenido) y área segura de iPhone. La altura máxima la pone `.coach-sheet` (85dvh, AppGlobalStyles).
 */
export default function ProgressSheet({ title, subtitle, onClose, closeLabel, C, P, isUnder768, qa, children }) {
  var closeRef = useRef(null);
  useEffect(function () {
    var prev = typeof document !== "undefined" ? document.activeElement : null;
    if (closeRef.current) closeRef.current.focus();
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return function () {
      document.removeEventListener("keydown", onKey);
      if (prev && typeof prev.focus === "function") prev.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir/cerrar
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: P.overlay,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        justifyContent: isUnder768 ? "flex-end" : "center",
        alignItems: "center",
        padding: isUnder768 ? 0 : 16,
      }}
    >
      <div
        onClick={function (e) { e.stopPropagation(); }}
        role="dialog"
        aria-modal="true"
        aria-label={subtitle ? title + " · " + subtitle : title}
        className="coach-sheet"
        data-qa-sheet={qa || "1"}
        style={{
          background: P.sheetBg,
          color: C.t,
          border: "1px solid " + P.line,
          borderRadius: isUnder768 ? "20px 20px 0 0" : 16,
          display: "flex",
          flexDirection: "column",
          width: isUnder768 ? "100%" : "min(560px, 100%)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <div style={{ flexShrink: 0, padding: "8px 8px 8px 16px", borderBottom: "1px solid " + C.brd }}>
          {isUnder768 ? (
            <div aria-hidden="true" style={{ width: 40, height: 5, background: P.line, borderRadius: 99, margin: "0 auto 6px" }} />
          ) : null}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ minWidth: 0, flex: "1 1 auto", paddingTop: 6 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, lineHeight: 1.25, color: C.t, overflowWrap: "anywhere" }}>{title}</h2>
              {subtitle ? (
                <div style={{ fontSize: 13, fontWeight: 500, color: P.muted, marginTop: 2, overflowWrap: "anywhere" }}>{subtitle}</div>
              ) : null}
            </div>
            <button
              ref={closeRef}
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                borderRadius: 12,
                color: P.muted,
                cursor: "pointer",
                padding: 0,
              }}
            >
              <X size={22} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div
          data-sheet-body="1"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            padding: "12px 16px calc(24px + env(safe-area-inset-bottom, 0px))",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
