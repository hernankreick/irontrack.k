// Colores de la ficha del alumno (tarjeta del alumno + tarjeta de rutina). En oscuro siguen el mockup aprobado (azul marino con
// bordes azules); en claro se usan los tokens del tema (lib/appThemeTokens.js), sin cambios.
export function studentCardPalette({ darkMode, coachAluSurface, coachAluBorderSoft, coachAluSubtle }) {
  if (darkMode) {
    return {
      // Bordes y superficies neutros (tokens de la paleta de Alumnos); el azul queda solo para seleccion / acciones.
      surface: coachAluSurface || "#0D1424",
      inner: coachAluSubtle || "#101A2D",
      border: coachAluBorderSoft || "rgba(148,163,184,0.18)",
      borderStrong: "rgba(59,130,246,0.55)",
      blueSoft: "rgba(37,99,235,0.14)",
      blueBorder: "rgba(59,130,246,0.5)",
      blueText: "#60a5fa",
      track: "rgba(148,163,184,0.16)",
    };
  }
  return {
    surface: coachAluSurface,
    inner: coachAluSubtle,
    border: coachAluBorderSoft,
    borderStrong: "rgba(37,99,235,0.55)",
    blueSoft: "rgba(37,99,235,0.08)",
    blueBorder: "rgba(37,99,235,0.45)",
    blueText: "#2563eb",
    track: "#e2e8f0",
  };
}
