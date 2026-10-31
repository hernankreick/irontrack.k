import React from "react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { fmtNum } from "./progresoTone.js";

var BAR_MAX = 120;

/**
 * Estado de cada semana del bloque (SOLO presentación; los kg vienen de model.volBars):
 *  "completa" (antes de la semana actual), "en_curso" (la semana actual, parcial) y "futura" (todavía no empezó: sin barra).
 *  Una semana futura con volumen registrado (fechas raras) se muestra como dato, nunca se oculta.
 */
export function volumeWeekStates(volBars, currentRoutineWeekIndex) {
  var cur = typeof currentRoutineWeekIndex === "number" && isFinite(currentRoutineWeekIndex) ? currentRoutineWeekIndex : null;
  return (volBars || []).map(function (b, i) {
    var v = Number(b && b.v) || 0;
    var estado = cur == null ? "completa" : i < cur ? "completa" : i === cur ? "en_curso" : v > 0 ? "completa" : "futura";
    return { i: i, v: v, label: b && b.s, estado: estado };
  });
}

export default function ProgressWeeklyVolumeCard({ volBars, currentRoutineWeekIndex, lang, C, P }) {
  var weeks = volumeWeekStates(volBars, currentRoutineWeekIndex);
  var max = Math.max.apply(null, weeks.map(function (w) { return w.v; }).concat([0]));
  var tNext = M(lang, "todavía no empezó", "not started yet", "ainda não começou");
  var tNow = M(lang, "en curso", "in progress", "em andamento");
  var summary = weeks
    .map(function (w) {
      return w.label + ": " + (w.estado === "futura" ? tNext : fmtNum(Math.round(w.v), lang, 0) + " kg" + (w.estado === "en_curso" ? " (" + tNow + ")" : ""));
    })
    .join("; ");

  return (
    <article
      data-qa="bloque-volumen"
      style={{ background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: 16, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: -0.2, color: C.t }}>{M(lang, "Volumen por semana", "Volume per week", "Volume por semana")}</h3>
        <span style={{ fontSize: 13, fontWeight: 500, color: P.muted }}>{M(lang, "kg × reps · sin ejercicios por tiempo", "kg × reps · time-based exercises excluded", "kg × reps · sem exercícios por tempo")}</span>
      </div>
      {max <= 0 ? (
        <p style={{ margin: 0, padding: "12px", fontSize: 13, color: P.muted, border: "1px dashed " + P.line, borderRadius: 12, textAlign: "center", lineHeight: 1.45 }}>
          {M(lang, "Sin volumen registrado en este bloque.", "No volume logged in this block.", "Sem volume registrado neste bloco.")}
        </p>
      ) : null}
      <div
        role="img"
        aria-label={M(lang, "Volumen por semana del bloque: ", "Volume per week of the block: ", "Volume por semana do bloco: ") + summary}
        style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.max(1, weeks.length) + ", minmax(0, 1fr))", gap: 12, alignItems: "end", height: BAR_MAX + 56 }}
      >
        {weeks.map(function (w) {
          var h = max > 0 ? Math.max(w.v > 0 ? 6 : 0, Math.round((w.v / max) * BAR_MAX)) : 0;
          var isNow = w.estado === "en_curso";
          return (
            <div key={"vw-" + w.i} data-estado={w.estado} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: w.estado === "futura" ? P.muted : C.t }}>
                {w.estado === "futura" ? "—" : fmtNum(Math.round(w.v), lang, 0)}
              </span>
              {w.estado === "futura" ? (
                <span style={{ width: "100%", height: 4, borderTop: "2px dashed " + P.muted, boxSizing: "border-box" }} />
              ) : isNow ? (
                <span
                  style={{
                    width: "100%",
                    height: Math.max(h, 8),
                    boxSizing: "border-box",
                    border: "2px solid " + C.blue,
                    borderRadius: 8,
                    background: "repeating-linear-gradient(135deg, " + P.accentSoft + " 0 6px, " + (P.dark ? "#172554" : "#eff6ff") + " 6px 12px)",
                  }}
                />
              ) : (
                <span style={{ width: "100%", height: h, background: C.blue, borderRadius: 8 }} />
              )}
              <span style={{ fontSize: 12, fontWeight: isNow ? 800 : 600, color: isNow ? C.t : P.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{w.label}</span>
            </div>
          );
        })}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: 12, fontWeight: 600, color: P.text2 }}>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, background: C.blue }} />
          {M(lang, "Completa", "Complete", "Completa")}
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 3, boxSizing: "border-box", border: "2px solid " + C.blue, background: P.accentSoft }} />
          {M(lang, "En curso (parcial)", "In progress (partial)", "Em andamento (parcial)")}
        </li>
        <li style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span aria-hidden="true" style={{ width: 14, borderTop: "2px dashed " + P.muted }} />
          {M(lang, "Todavía no empezó", "Not started yet", "Ainda não começou")}
        </li>
      </ul>
    </article>
  );
}
