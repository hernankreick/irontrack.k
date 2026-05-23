import React from 'react';

export default function AlumnoPlanHeaderDayLabel({ alumnoPlanHeaderDayNum, textMuted, msg }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 14,
        fontWeight: 600,
        textAlign: "center",
        lineHeight: 1.25,
        maxWidth: "100%",
      }}
    >
      <span style={{ color: textMuted, fontWeight: 500 }}>{msg("Hoy toca:", "Today:", "Hoje é:")}</span>{" "}
      <span style={{ color: "#3B82F6", fontWeight: 800, letterSpacing: 0.3 }}>
        {String(msg("Día", "Day", "Dia")).toUpperCase()}{" "}
        {alumnoPlanHeaderDayNum}
      </span>
    </p>
  );
}
