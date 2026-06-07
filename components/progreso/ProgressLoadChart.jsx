import React from "react";

export default function ProgressLoadChart({ chartComputed, weekLabels, alumnoColor, C, T, lang, M }) {
  return (
    <>
      <p style={{ ...T.subtitle, color: C.t2, margin: "0 0 10px 0" }}>
        {M(
          lang,
          "Bloque actual (4 semanas, lun–dom). Máx. kg registrado por semana.",
          "Current block (4 weeks, Mon–Sun). Max kg logged per week.",
          "Bloco atual (4 semanas, seg–dom). Máx. kg registrado por semana."
        )}
      </p>
      <svg viewBox="0 0 300 100" width="100%" height={124} style={{ display: "block" }}>
        {(chartComputed.polySegments || []).map(function (seg, si) {
          return (
            <polyline
              key={"seg-" + si}
              fill="none"
              stroke={alumnoColor}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={seg}
            />
          );
        })}
        {(chartComputed.chartPoints || []).map(function (pt, i) {
          return (
            <g key={"pt-" + i}>
              {pt.hasData ? (
                <>
                  <circle r={4} cx={pt.x} cy={pt.y} fill={alumnoColor} />
                  <text x={pt.x} y={pt.y - 9} fill={C.t} fontSize={14} fontWeight={700} textAnchor="middle">
                    {pt.v}
                  </text>
                </>
              ) : (
                <text x={pt.x} y={93} fill={C.t2} fontSize={12} fontWeight={600} textAnchor="middle">
                  —
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          ...T.labelMd,
          color: C.t2,
        }}
      >
        {(weekLabels || []).map(function (s, idx) {
          return (
            <span key={"wl-" + idx}>
              {s}
            </span>
          );
        })}
      </div>
    </>
  );
}
