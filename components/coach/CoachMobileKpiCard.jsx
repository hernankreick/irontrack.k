import React from "react";
import { ArrowUp } from "lucide-react";

export default function CoachMobileKpiCard({
  label,
  value,
  suffix,
  subtitle,
  deltaText,
  progress,
  accent,
  colors,
  type,
  blockGap,
}) {
  var C = colors;
  var T = type;
  return (
    <div
      style={{
        background: C.mobileStatBg,
        border: "1px solid " + C.mobileStatBorder,
        borderRadius: 14,
        padding: 14,
        minWidth: 0,
        boxSizing: "border-box",
        borderLeft: "3px solid " + accent,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <span style={{ ...T.labelMd, color: C.mobileStatMuted }}>{label}</span>
      {suffix ? (
        <div style={{ display: "flex", alignItems: "baseline", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
          <span style={{ ...T.numberStat, color: C.mobileStatText }}>{value}</span>
          <span style={{ ...T.cardTitleSemibold, color: C.mobileStatMuted, fontSize: 15 }}>{suffix}</span>
        </div>
      ) : (
        <div
          style={{
            ...T.numberStat,
            color: C.mobileStatText,
            marginTop: 6,
            letterSpacing: -0.02,
          }}
        >
          {value}
        </div>
      )}
      {deltaText ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 6,
            ...T.meta,
            color: accent,
            fontWeight: 600,
          }}
        >
          <ArrowUp size={13} strokeWidth={2.5} />
          {deltaText}
        </div>
      ) : (
        <div style={{ ...T.subtitle, color: C.mobileStatMuted, marginTop: 4 }}>{subtitle}</div>
      )}
      <div style={{ flex: 1, minHeight: blockGap }} />
      <div
        style={{
          height: 6,
          background: C.mobileTrack,
          borderRadius: 3,
          overflow: "hidden",
          marginTop: blockGap,
        }}
      >
        <div
          style={{
            width: progress + "%",
            height: "100%",
            background: accent,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
}
