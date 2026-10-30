import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { toneColor } from "./progresoTone.js";

var RANKING_PREVIEW = 5;

/**
 * Equipo (todos los alumnos): colapsado por defecto, al final de Progreso. Valores de model.teamChips y model.ranking (E2);
 * la línea de sesiones del ranking la arma rankingSessionsLine de ProgresoView (incluye las validadas por el entrenador).
 */
export default function ProgressTeamSection({ teamChips, ranking, rankingSessionsLine, defaultOpen, lang, C, P }) {
  var [open, setOpen] = useState(!!defaultOpen);
  var [all, setAll] = useState(false);
  var byKey = {};
  (teamChips || []).forEach(function (c) { byKey[c.key] = c; });
  var adh = byKey.teamAdherence || {};
  var st = byKey.teamStalled || {};
  var rows = ranking || [];
  var shown = all ? rows : rows.slice(0, RANKING_PREVIEW);
  var panelId = "progreso-equipo-panel";
  var summary =
    M(lang, "Adherencia ", "Adherence ", "Aderência ") + (adh.val || "—") + " · " +
    M(lang, (st.value || 0) + " estancados", (st.value || 0) + " stalled", (st.value || 0) + " estagnados") + " · " +
    M(lang, "ranking", "leaderboard", "ranking");

  function pctColor(p) {
    return p >= 70 ? P.good : p >= 30 ? P.warn : P.bad;
  }

  return (
    <section data-section="equipo" aria-label={M(lang, "Equipo", "Team", "Equipe")} style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid " + C.brd, paddingTop: 20, minWidth: 0 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-qa="equipo-toggle"
        onClick={function () { setOpen(!open); }}
        style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 64, padding: "10px 16px", boxSizing: "border-box", background: C.card, border: "1px solid " + (open ? P.line : C.brd), borderRadius: 16, color: C.t, textAlign: "left", cursor: "pointer", fontFamily: "inherit", width: "100%" }}
      >
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{M(lang, "Equipo · todos tus alumnos", "Team · all your athletes", "Equipe · todos os seus alunos")}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: P.muted }}>
            {open ? M(lang, "Mismo período · no depende del alumno elegido", "Same period · independent of the selected athlete", "Mesmo período · não depende do aluno escolhido") : summary}
          </span>
        </span>
        <ChevronDown size={20} color={P.muted} aria-hidden="true" style={{ flex: "none", transform: open ? "rotate(180deg)" : "none" }} />
      </button>

      {open ? (
        <div id={panelId} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {[adh, st].map(function (c) {
              return (
                <article key={c.key} style={{ background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.muted }}>
                    {c.key === "teamAdherence" ? M(lang, "Adherencia promedio", "Average adherence", "Aderência média") : M(lang, "Estancados", "Stalled", "Estagnados")}
                  </h3>
                  <span style={{ fontSize: 26, fontWeight: 800, color: c.key === "teamStalled" && c.value > 0 ? P.warn : C.t }}>{c.val}</span>
                  <span style={{ fontSize: 12, fontWeight: c.tone !== "neutral" ? 700 : 500, color: c.key === "teamStalled" ? P.text2 : toneColor(c.tone, P), lineHeight: 1.35 }}>{c.delta}</span>
                </article>
              );
            })}
          </div>
          <div style={{ background: C.card, border: "1px solid " + C.brd, borderRadius: 16, padding: "8px 16px 12px", display: "flex", flexDirection: "column" }}>
            <h3 style={{ margin: 0, padding: "10px 0 6px", fontSize: 15, fontWeight: 700, color: C.t }}>{M(lang, "Ranking de adherencia", "Adherence leaderboard", "Ranking de aderência")}</h3>
            {rows.length === 0 ? (
              <p style={{ margin: "0 0 4px", fontSize: 13, color: P.muted, lineHeight: 1.45 }}>
                {M(lang, "Ningún alumno tiene una rutina con plan en este período.", "No athlete has a routine with a plan in this period.", "Nenhum aluno tem rotina com plano neste período.")}
              </p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {shown.map(function (r, i) {
                  return (
                    <li key={String(r.id)} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 56, borderTop: "1px solid " + C.brd }}>
                      <span style={{ width: 22, fontSize: 14, fontWeight: 800, color: P.muted, flex: "none" }}>{i + 1}</span>
                      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: C.t, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.n}</span>
                        <span style={{ fontSize: 12, color: P.muted }}>{rankingSessionsLine(r.completed, r.planned, lang, r.validadas)}</span>
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 800, color: pctColor(r.p), flex: "none" }}>{r.p + "%"}</span>
                    </li>
                  );
                })}
              </ol>
            )}
            {rows.length > RANKING_PREVIEW ? (
              <button
                type="button"
                aria-expanded={all}
                onClick={function () { setAll(!all); }}
                style={{ marginTop: 6, minHeight: 44, border: "1px solid " + P.line, borderRadius: 12, background: "transparent", color: P.accentText, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}
              >
                {all ? M(lang, "Ver menos", "Show less", "Ver menos") : M(lang, "Ver ranking completo (" + rows.length + ")", "See full leaderboard (" + rows.length + ")", "Ver ranking completo (" + rows.length + ")")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
