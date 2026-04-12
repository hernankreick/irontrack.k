import React from "react";

export default function IronTrackLogo({ size = 28, color = "#2563EB", showBar = true, mode = null, modeColor = "#22C55E" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: showBar ? 8 : 0 }}>
        {showBar && <div style={{ width: 4, height: size * 1.1, background: color, borderRadius: 2, flexShrink: 0 }} />}
        <span
          style={{
            fontSize: size,
            fontWeight: 900,
            letterSpacing: size > 22 ? 3 : 2,
            color,
            fontFamily: "'Barlow Condensed','Arial Black',sans-serif",
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          IRON
          <br />
          TRACK
        </span>
      </div>
      {mode && (
        <div
          style={{
            fontSize: 11,
            color: modeColor,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            marginLeft: showBar ? 12 : 0,
          }}
        >
          {mode}
        </div>
      )}
    </div>
  );
}
