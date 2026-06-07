import React from "react";
import { PieChart } from "lucide-react";
import { coachType as T, coachSpace as S } from "../coachUiScale.js";
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";
import ProgressMovementPatternRow from "./ProgressMovementPatternRow.jsx";

export default function ProgressMovementPatternVolumeCard({
  patterns,
  totalVol,
  patronExpanded,
  togglePatronRow,
  C,
  lang,
  formatWeeklyVolKgAbbrev,
}) {
  var safeTotalVol = totalVol == null ? 0 : totalVol;

  return (
    <div
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
          {M(lang, "Bloque actual · 4 semanas", "Current block · 4 weeks")}
        </p>
      </div>
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
          {M(
            lang,
            "Sin volumen registrado en el bloque para estos patrones (últimas 4 semanas).",
            "No volume logged in this block for these patterns (last 4 weeks).",
            "Sem volume registrado no bloco para estes padrões (últimas 4 semanas)."
          )}
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
