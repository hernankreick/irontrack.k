import React from "react";

export default function CoachRecommendationCard({
  eyebrow,
  title,
  description,
  impactLabel,
  impactText,
  ctaLabel,
  onAction,
  colors,
  type,
  dashCard,
  dashBorder,
  dashMuted,
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
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 14 }}>{eyebrow}</div>
      <div style={{ fontSize: 24, lineHeight: 1.12, fontWeight: 850, color: C.t, letterSpacing: -0.2 }}>{title}</div>
      <div style={{ ...T.body, color: dashMuted, marginTop: 10, lineHeight: 1.5 }}>{description}</div>
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid " + dashBorder }}>
        <div style={{ ...T.sectionEyebrow, color: dashMuted, marginBottom: 8 }}>{impactLabel}</div>
        <div style={{ ...T.bodySemibold, color: C.t, lineHeight: 1.45 }}>{impactText}</div>
      </div>
      <button
        type="button"
        className="cd-btn"
        style={{
          width: "100%",
          minHeight: 42,
          marginTop: "auto",
          border: "none",
          borderRadius: 10,
          background: C.blue,
          color: "#fff",
          fontSize: 14,
          fontWeight: 850,
          cursor: "pointer",
        }}
        onClick={function () {
          if (typeof onAction === "function") onAction();
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
