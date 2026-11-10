import React from "react";

/**
 * «Nota del entrenador» de la semana activa de un ejercicio (vista del alumno: Inicio y entrenamiento en curso).
 * Solo se renderiza si `note` tiene contenido; respeta los saltos de línea y el texto original (white-space: pre-wrap).
 * No confundir con la «Nota del día» (otra función, independiente). Solo lectura.
 */
export default function ExerciseWeekNote({ note, msg, dark = true, style }) {
  if (typeof note !== "string" || note.trim() === "") return null;
  return (
    <div
      data-week-note=""
      style={Object.assign({
        flexBasis: "100%",
        width: "100%",
        boxSizing: "border-box",
        marginTop: 8,
        padding: "8px 12px",
        borderRadius: 10,
        background: dark ? "rgba(37,99,235,0.10)" : "rgba(37,99,235,0.08)",
        border: "1px solid " + (dark ? "rgba(96,165,250,0.30)" : "rgba(37,99,235,0.25)"),
      }, style || null)}
    >
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase", color: dark ? "#60A5FA" : "#1D4ED8", marginBottom: 4 }}>
        {msg("Nota del entrenador", "Coach's note", "Nota do treinador")}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: dark ? "#E2E8F0" : "#0F172A" }}>
        {note}
      </div>
    </div>
  );
}
