import React from "react";
import { Info, Star } from "lucide-react";

export default function CoachDesktopWeeklySummaryCard({
  title,
  completedText,
  pctText,
  subtitle,
  deltaText,
  deltaBg,
  deltaColor,
  progressPct,
  trackBg,
  insightTitle,
  insightText,
  insightColor,
  goalText,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  gaugeOffset,
  colors,
  type,
  dashCard,
  dashBorder,
  dashCardSoft,
  dashMuted,
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
        padding: 22,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: blockGap }}>
        <Info size={16} color={C.t2} strokeWidth={2} />
        <span style={{ ...T.cardTitleSemibold, color: C.t }}>{title}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
        <div style={{ ...T.numberHero, color: C.t }}>{completedText}</div>
        <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 850, color: C.t }}>{pctText}</div>
      </div>
      <div style={{ ...T.subtitle, color: C.t2, marginTop: 6 }}>{subtitle}</div>
      <div
        style={{
          marginTop: blockGap,
          display: "inline-block",
          background: deltaBg,
          color: deltaColor,
          borderRadius: 99,
          padding: "5px 12px",
          ...T.bodySemibold,
        }}
      >
        {deltaText}
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          marginTop: 10,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ height: 10, background: trackBg, borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
            <div className="cd-progress-fill" style={{ width: progressPct + "%", height: "100%", background: C.blue, borderRadius: 999 }} />
          </div>
          <div style={{ background: dashCardSoft, border: "1px solid " + dashBorder, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 8, letterSpacing: 1.4 }}>{insightTitle}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, ...T.bodySemibold, color: insightColor }}>
              <Star size={16} color={C.blue} strokeWidth={2} />
              {insightText}
            </div>
            <div style={{ ...T.body, color: C.t2, marginTop: 6 }}>{goalText}</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              className="cd-btn"
              type="button"
              onClick={onPrimary}
              style={{ background: C.blue, color: "#fff", border: "none", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
            >
              {primaryLabel}
            </button>
            <button
              className="cd-btn"
              type="button"
              onClick={onSecondary}
              style={{ background: "transparent", color: C.t, border: "1px solid " + dashBorder, borderRadius: 8, padding: "10px 12px", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
            >
              {secondaryLabel}
            </button>
          </div>
        </div>
        <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
          <svg width={88} height={88} viewBox="0 0 80 80" style={{ display: "block" }}>
            <circle r={30} cx={40} cy={40} stroke={C.brd} strokeWidth={8} fill="none" />
            <circle
              r={30}
              cx={40}
              cy={40}
              stroke={C.blue}
              strokeWidth={8}
              fill="none"
              strokeDasharray="188.5"
              strokeDashoffset={gaugeOffset}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              ...T.numberGauge,
              color: C.t,
              pointerEvents: "none",
            }}
          >
            {pctText}
          </div>
        </div>
      </div>
    </div>
  );
}
