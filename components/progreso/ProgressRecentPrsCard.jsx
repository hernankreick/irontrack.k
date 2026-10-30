import React from "react";
import { ChevronRight } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { fmtKg } from "./progresoTone.js";

/** Filas tocables (≥ 60 px) que abren el historial del ejercicio. Los eventos y su límite vienen del modelo (eventosPR, E1). */
export function rowButtonStyle(C) {
  return {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    minHeight: 60,
    padding: "8px 0",
    border: "none",
    borderTop: "1px solid " + C.brd,
    background: "transparent",
    color: C.t,
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

export default function ProgressRecentPrsCard({ prs, onOpenExercise, lang, C, P }) {
  var list = prs || [];
  return (
    <section
      aria-labelledby="progreso-prs-titulo"
      data-qa="prs-recientes"
      style={{ background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: "8px 16px", display: "flex", flexDirection: "column", minWidth: 0 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "10px 0 8px" }}>
        <h2 id="progreso-prs-titulo" style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: -0.2, color: C.t }}>
          {M(lang, "PRs recientes", "Recent PRs", "PRs recentes")}
        </h2>
        <span style={{ fontSize: 13, fontWeight: 500, color: P.muted }}>{M(lang, "Récords sobre todo el historial", "Records over the whole history", "Recordes sobre todo o histórico")}</span>
      </div>
      {list.length === 0 ? (
        <p style={{ margin: "0 0 12px", padding: 12, fontSize: 13, lineHeight: 1.45, color: P.muted, border: "1px dashed " + P.line, borderRadius: 12 }}>
          {M(
            lang,
            "Sin PRs todavía. La primera marca de cada ejercicio es la base: un PR es superarla.",
            "No PRs yet. Each exercise's first mark is the baseline: a PR means beating it.",
            "Sem PRs ainda. A primeira marca de cada exercício é a base: um PR é superá-la."
          )}
        </p>
      ) : (
        list.map(function (p, i) {
          return (
            <button
              key={"pr-" + i}
              type="button"
              onClick={function () { onOpenExercise(p.ejercicio_id, p.ex); }}
              aria-label={p.ex + ": " + fmtKg(p.kg, lang) + ", " + p.date + ". " + M(lang, "Ver historial", "See history", "Ver histórico")}
              style={rowButtonStyle(C)}
            >
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.ex}</span>
                <span style={{ fontSize: 12, fontWeight: 500, color: P.muted }}>
                  {p.date + " · " + M(lang, "récord anterior ", "previous record ", "recorde anterior ") + fmtKg(p.kgAnterior, lang)}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flex: "none" }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{fmtKg(p.kg, lang)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: P.good }}>{"+" + fmtKg(p.diferencia, lang)}</span>
              </span>
              <ChevronRight size={16} color={P.muted} aria-hidden="true" style={{ flex: "none" }} />
            </button>
          );
        })
      )}
    </section>
  );
}
