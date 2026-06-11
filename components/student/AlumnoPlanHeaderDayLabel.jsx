import React from 'react';

export default function AlumnoPlanHeaderDayLabel({ alumnoPlanHeaderDayNum, textMuted, msg }) {
  return (
    <p
      style={{
        margin: 0,
        textAlign: "center",
        lineHeight: 1.3,
      }}
    >
      <span style={{
        display: "block",
        color: textMuted,
        fontWeight: 500,
        fontSize: 10,
        letterSpacing: 0.8,
        textTransform: "uppercase",
      }}>
        {msg("Hoy toca", "Today", "Hoje")}
      </span>
      <span style={{
        display: "block",
        color: "#3B82F6",
        fontWeight: 800,
        fontSize: 15,
        letterSpacing: 0.3,
        whiteSpace: "nowrap",
      }}>
        {String(msg("Día", "Day", "Dia")).toUpperCase()}{" "}{alumnoPlanHeaderDayNum}
      </span>
    </p>
  );
}
