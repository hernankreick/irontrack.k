// Paleta de «Mis alumnos»: base azul petroleo / grafito del Dashboard (D5), con bordes NEUTROS (sin azul).
// Devuelve los mismos nombres de token que lib/appThemeTokens.js; CoachStudentsMain los usa en lugar de los recibidos de App.
// El azul intenso queda para acciones y seleccion (ver ALUMNOS_AZUL); verde / amarillo / rojo solo para estados.
export const ALUMNOS_AZUL = { oscuro: "#3B82F6", claro: "#2563EB" };

export function alumnosPaleta(darkMode) {
  if (darkMode) {
    return {
      coachAluShell: "#0A0F1A",
      coachAluSurface: "#0D1424",
      coachAluSubtle: "#101A2D",
      coachAluBorderSoft: "rgba(148,163,184,0.18)",
      coachAluTrack: "rgba(148,163,184,0.16)",
      coachAluDropdown: "#0D1424",
      coachAluDropdownShadow: "0 12px 32px rgba(0,0,0,0.55)",
      coachAluGhostBtn: "#101A2D",
    };
  }
  return {
    coachAluShell: "#F1F5F9",
    coachAluSurface: "#FFFFFF",
    coachAluSubtle: "#F8FAFC",
    coachAluBorderSoft: "#E2E8F0",
    coachAluTrack: "#E2E8F0",
    coachAluDropdown: "#FFFFFF",
    coachAluDropdownShadow: "0 12px 28px rgba(15,23,42,0.12)",
    coachAluGhostBtn: "#F8FAFC",
  };
}
