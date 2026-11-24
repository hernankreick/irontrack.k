import React from "react";
import { PieChart } from "lucide-react";
import { coachType as T, coachSpace as S } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import { patternWindowLabel, patternEmptyLabel, patternSelectionLabel, patternEmptyForSelection, patternPartialTitle, patternPartialLines } from "./progressCopy.js";
import ProgressMovementPatternRow from "./ProgressMovementPatternRow.jsx";

export default function ProgressMovementPatternVolumeCard({
  patterns,
  totalVol,
  weekNumber,
  patronExpanded,
  togglePatronRow,
  C,
  lang,
  formatWeeklyVolKgAbbrev,
  historial,
  onSelectRutina,
  onSelectCiclo,
  onSelectSemana,
  selectStyle,
}) {
  var safeTotalVol = totalVol == null ? 0 : totalVol;
  var uid = React.useId();
  var h = historial && historial.rutinaId != null ? historial : null;
  var rutinaSel = h ? h.rutinas.filter(function (r) { return r.id === h.rutinaId; })[0] : null;
  var cicloLabel = function (c) {
    return c.actual ? M(lang, "Bloque actual", "Current block", "Bloco atual") : M(lang, "Ciclo " + c.value, "Cycle " + c.value, "Ciclo " + c.value);
  };
  var rutinaLabel = function (r) {
    var nombre = r.nombre || M(lang, "Rutina sin nombre", "Unnamed routine", "Rotina sem nome");
    return r.esActual ? nombre + " · " + M(lang, "actual", "current", "atual") : nombre;
  };
  var semanaLabel = function (w) {
    var base = M(lang, "Semana " + (w.value + 1), "Week " + (w.value + 1), "Semana " + (w.value + 1));
    var parcial = w.parcial > 0 ? " · " + M(lang, "no confirmada", "unconfirmed", "não confirmada") : "";
    if (w.sesiones > 0) return base + " · " + w.sesiones + (w.sesiones === 1 ? M(lang, " sesión", " session", " sessão") : M(lang, " sesiones", " sessions", " sessões")) + parcial;
    return base + " · " + (w.series > 0 ? M(lang, "sin sesión guardada", "no saved session", "sem sessão salva") : M(lang, "sin sesiones", "no sessions", "sem sessões")) + parcial;
  };
  var ctrl = Object.assign({}, selectStyle || {}, { minHeight: 44, fontSize: 16, minWidth: 0, textOverflow: "ellipsis" });
  var lbl = Object.assign({ display: "block", marginBottom: 4 }, T.labelMd, { color: C.t2 });
  var subtitle;
  if (!h || (h.esActual && h.bloqueActual && h.semana + 1 === weekNumber)) subtitle = patternWindowLabel(lang, h ? h.semana + 1 : weekNumber);
  else subtitle = patternSelectionLabel(lang, rutinaSel ? rutinaSel.nombre : "", h.ciclos.length > 1 ? cicloLabel(h.ciclos.filter(function (c) { return c.value === h.ciclo; })[0] || { value: h.ciclo }) : "", h.semana + 1);
  var partialLines = h && h.parcial && h.parcial.total ? patternPartialLines(lang, h.parcial) : [];

  return (
    <div
      data-qa="patron-card"
      style={{
        background: C.card,
        border: "1px solid " + C.brd,
        borderRadius: 12,
        padding: S.cardPadding,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: S.blockGapLoose }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <PieChart size={16} color={C.blue} strokeWidth={2} />
          <span style={{ ...T.cardTitle, color: C.t }}>
            {M(lang, "Volumen por patrón muscular", "Volume by movement pattern")}
          </span>
        </div>
        <p style={{ ...T.subtitle, color: C.t2, margin: 0, paddingLeft: 26 }}>
          {subtitle}
        </p>
      </div>
      {h ? (
        <div data-qa="patron-selectores" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 10, marginBottom: S.blockGapLoose }}>
          <div style={{ minWidth: 0 }}>
            <label htmlFor={uid + "-rutina"} style={lbl}>{M(lang, "Rutina", "Routine", "Rotina")}</label>
            <select id={uid + "-rutina"} data-qa="patron-rutina" value={h.rutinaId} onChange={function (e) { onSelectRutina(e.target.value); }} style={ctrl}>
              {h.rutinas.map(function (r) {
                return <option key={r.id} value={r.id}>{rutinaLabel(r)}</option>;
              })}
            </select>
          </div>
          {h.ciclos.length > 1 ? (
            <div style={{ minWidth: 0 }}>
              <label htmlFor={uid + "-ciclo"} style={lbl}>{M(lang, "Ciclo (rutina reiniciada)", "Cycle (restarted routine)", "Ciclo (rotina reiniciada)")}</label>
              <select id={uid + "-ciclo"} data-qa="patron-ciclo" value={h.ciclo} onChange={function (e) { onSelectCiclo(Number(e.target.value)); }} style={ctrl}>
                {h.ciclos.map(function (c) {
                  return <option key={c.value} value={c.value}>{cicloLabel(c)}</option>;
                })}
              </select>
            </div>
          ) : null}
          <div style={{ minWidth: 0 }}>
            <label htmlFor={uid + "-semana"} style={lbl}>{M(lang, "Semana", "Week", "Semana")}</label>
            <select id={uid + "-semana"} data-qa="patron-semana" value={h.semana} onChange={function (e) { onSelectSemana(Number(e.target.value)); }} style={ctrl}>
              {h.semanas.map(function (w) {
                return <option key={w.value} value={w.value}>{semanaLabel(w)}</option>;
              })}
            </select>
          </div>
        </div>
      ) : null}
      {partialLines.length ? (
        <div role="status" data-qa="patron-parcial" style={{ marginBottom: S.blockGapLoose, padding: "10px 12px", background: C.cardDark, border: "1px solid " + C.brd, borderLeft: "4px solid #f59e0b", borderRadius: 8 }}>
          <p style={{ ...T.bodySemibold, color: C.t, margin: "0 0 4px 0" }}>{patternPartialTitle(lang)}</p>
          {partialLines.map(function (t, i) {
            return <p key={i} style={{ ...T.subtitle, color: C.t2, margin: i ? "6px 0 0 0" : 0 }}>{t}</p>;
          })}
        </div>
      ) : null}
      {safeTotalVol <= 0 ? (
        <p
          style={{
            ...T.subtitle,
            color: C.t2,
            margin: "0 0 14px 0",
            padding: "10px 12px",
            background: C.cardDark,
            borderRadius: 8,
            border: "1px solid " + C.brd,
          }}
        >
          {h && !(h.esActual && h.bloqueActual && h.semana + 1 === weekNumber) ? patternEmptyForSelection(lang, h.sesionesSemana, h.seriesSemana) : patternEmptyLabel(lang)}
        </p>
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: S.blockGapLoose }}>
        {(patterns || []).map(function (g) {
          return (
            <ProgressMovementPatternRow
              key={g.key}
              pattern={g}
              totalVol={safeTotalVol}
              isOpen={!!patronExpanded[g.key]}
              onToggle={function () {
                togglePatronRow(g.key);
              }}
              C={C}
              lang={lang}
              formatWeeklyVolKgAbbrev={formatWeeklyVolKgAbbrev}
            />
          );
        })}
      </div>
    </div>
  );
}
