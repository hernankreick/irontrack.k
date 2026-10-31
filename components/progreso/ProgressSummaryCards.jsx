import React from "react";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { fmtNum, toneColor } from "./progresoTone.js";

function Card({ title, value, unit, valueColor, children, C, P, qa }) {
  return (
    <article
      data-qa={qa}
      style={{
        background: C.card,
        border: "1px solid " + C.brd,
        borderRadius: 16,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 148,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.muted, lineHeight: 1.3 }}>{title}</h3>
      <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: -0.5, color: valueColor || C.t, overflowWrap: "anywhere" }}>
        {value}
        {unit ? <span style={{ fontSize: 15, fontWeight: 700, color: P.text2 }}>{" " + unit}</span> : null}
      </span>
      {children}
    </article>
  );
}

function Line({ children, color, bold }) {
  return <span style={{ fontSize: 12, fontWeight: bold ? 700 : 500, color: color, lineHeight: 1.35 }}>{children}</span>;
}

/**
 * Las cuatro tarjetas del período del alumno seleccionado. Valores y comparaciones: model.alumnoChips (lib/metricas, E2);
 * última sesión: model.ultimaSesion. Esta vista no calcula nada.
 */
export default function ProgressSummaryCards({ chips, ultimaSesion, lang, C, P, isUnder768 }) {
  var byKey = {};
  (chips || []).forEach(function (c) { byKey[c.key] = c; });
  var ad = byKey.alumnoAdherence || {};
  var pr = byKey.alumnoPrs || {};
  var vol = byKey.alumnoVolume || {};
  var hasAd = ad.value != null;
  var hasVol = vol.val && vol.val !== "—";

  var ult = ultimaSesion;
  var ultValue = !ult
    ? "—"
    : ult.diasAtras === 0
      ? M(lang, "Hoy", "Today", "Hoje")
      : ult.diasAtras === 1
        ? M(lang, "Ayer", "Yesterday", "Ontem")
        : M(lang, ult.diasAtras + " días", ult.diasAtras + " days", ult.diasAtras + " dias");

  return (
    <div style={{ display: "grid", gridTemplateColumns: isUnder768 ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))", gap: 12 }}>
      <Card qa="resumen-adherencia" title={M(lang, "Adherencia", "Adherence", "Aderência")} value={hasAd ? ad.value + "%" : "—"} C={C} P={P}>
        {hasAd ? (
          <span aria-hidden="true" style={{ display: "block", height: 6, borderRadius: 3, background: P.track, overflow: "hidden" }}>
            <span style={{ display: "block", width: Math.max(0, Math.min(100, ad.value)) + "%", height: 6, background: C.blue, borderRadius: 3 }} />
          </span>
        ) : null}
        {hasAd ? (
          <Line color={P.text2}>
            {M(lang, ad.completed + " de " + ad.planned + " sesiones", ad.completed + " of " + ad.planned + " sessions", ad.completed + " de " + ad.planned + " sessões") +
              (ad.validadas > 0 ? M(lang, " · " + ad.validadas + " validadas por vos", " · " + ad.validadas + " validated by you", " · " + ad.validadas + " validadas por você") : "")}
          </Line>
        ) : null}
        <Line color={toneColor(ad.tone, P)} bold={ad.tone !== "neutral"}>{ad.delta}</Line>
      </Card>

      <Card qa="resumen-volumen" title={M(lang, "Volumen semanal", "Weekly volume", "Volume semanal")} value={hasVol ? fmtNum(Math.round(vol.value), lang, 0) : "—"} unit={hasVol ? "kg" : null} C={C} P={P}>
        <Line color={P.text2}>{M(lang, "Promedio por semana · kg × reps", "Weekly average · kg × reps", "Média por semana · kg × reps")}</Line>
        <Line color={toneColor(vol.tone, P)} bold={vol.tone !== "neutral"}>{vol.delta}</Line>
      </Card>

      <Card qa="resumen-prs" title="PRs" value={String(pr.value != null ? pr.value : 0)} C={C} P={P}>
        <Line color={P.text2}>{M(lang, "Récords superados en el período", "Records beaten in the period", "Recordes superados no período")}</Line>
        <Line color={toneColor(pr.tone, P)} bold={pr.tone !== "neutral"}>{pr.delta}</Line>
      </Card>

      <Card qa="resumen-ultima" title={M(lang, "Última sesión", "Last session", "Última sessão")} value={ultValue} C={C} P={P}>
        {ult ? (
          <Line color={P.text2}>
            {ult.fecha +
              (ult.diaIdx != null ? M(lang, " · Día " + (ult.diaIdx + 1), " · Day " + (ult.diaIdx + 1), " · Dia " + (ult.diaIdx + 1)) : "") +
              (ult.validada ? M(lang, " · validada por vos", " · validated by you", " · validada por você") : "")}
          </Line>
        ) : (
          <Line color={P.text2}>{M(lang, "Todavía no registró sesiones", "No sessions logged yet", "Ainda não registrou sessões")}</Line>
        )}
      </Card>
    </div>
  );
}
