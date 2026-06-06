import React from "react";
import { ArrowUp, Info, Star } from "lucide-react";

export default function CoachDesktopPerformanceCard({
  title,
  score,
  deltaText,
  metrics = [],
  colors,
  type,
  dashCard,
  dashBorder,
  blockGap,
}) {
  var C = colors;
  var T = type;
  return (
    <div
      className="cd-card"
      style={{
        background: dashCard,
        border: `1px solid ${dashBorder}`,
        borderRadius: 16,
        padding: 20,
        minWidth: 0,
        boxSizing: "border-box",
        alignSelf: "stretch",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: blockGap }}>
        <Info size={16} color={C.t2} strokeWidth={2} />
        <span style={{ ...T.cardTitleSemibold, color: C.t }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <Star size={18} color="#eab308" fill="#eab308" strokeWidth={1.5} />
            <span style={{ ...T.numberScore, color: C.t }}>{score}</span>
            <span style={{ ...T.cardTitleSemibold, color: C.t2 }}>/100</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: blockGap,
              ...T.body,
              color: C.green,
            }}
          >
            <ArrowUp size={14} strokeWidth={2.5} />
            {deltaText}
          </div>
        </div>
        <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
          <svg width={68} height={68} viewBox="0 0 60 60" style={{ display: "block" }}>
            <circle r={23} cx={30} cy={30} stroke={C.brd} strokeWidth={7} fill="none" />
            <circle
              r={23}
              cx={30}
              cy={30}
              stroke={C.blue}
              strokeWidth={7}
              fill="none"
              strokeDasharray="144.51"
              strokeDashoffset={144.51 * (1 - score / 100)}
              strokeLinecap="round"
              transform="rotate(-90 30 30)"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...T.numberStat,
              color: C.t,
              pointerEvents: "none",
            }}
          >
            {score}%
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, marginTop: 18, borderTop: "1px solid " + C.rowDivider, paddingTop: 12 }}>
        {metrics.map(function (m) {
          return (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, ...T.body, color: C.t }}>
              <span style={{ color: C.t2 }}>{m.label}</span>
              <strong style={{ fontWeight: 800 }}>{m.value}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}
