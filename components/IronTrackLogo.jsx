import React from "react";

/**
 * @param {string} [ironColor] — si se omite, usa `color` para IRON (compat login / light).
 * @param {string} [trackColor] — si se omite, usa `color` para TRACK.
 */
export default function IronTrackLogo({
  size = 28,
  color = "#2563EB",
  ironColor,
  trackColor,
  barColor,
  showBar = true,
  mode = null,
  modeColor = "#22C55E",
  modeFontSize = 11,
}) {
  const bar = barColor ?? (trackColor ?? color);
  const iron = ironColor ?? color;
  const track = trackColor ?? color;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: showBar ? 8 : 0 }}>
        {showBar && <div style={{ width: 4, height: size * 1.1, background: bar, borderRadius: 2, flexShrink: 0 }} />}
        <span
          style={{
            fontSize: size,
            fontWeight: 900,
            letterSpacing: size > 22 ? 3 : 2,
            fontFamily: "'Barlow Condensed','Arial Black',sans-serif",
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          <span style={{ color: iron }}>IRON</span>
          <br />
          <span style={{ color: track }}>TRACK</span>
        </span>
      </div>
      {mode && (
        <div
          style={{
            fontSize: modeFontSize,
            color: modeColor,
            fontWeight: 600,
            letterSpacing: 0.2,
            marginLeft: showBar ? 12 : 0,
            lineHeight: 1.35,
            wordBreak: "break-word",
          }}
        >
          {mode}
        </div>
      )}
    </div>
  );
}
