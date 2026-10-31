/**
 * Tonos de texto de Progreso del entrenador sobre la paleta de «Mis alumnos» (alumnosPaleta, aplicada en ProgresoView).
 * La paleta trae colores de relleno; en texto chico algunos no alcanzan 4,5:1 (gris #71717a sobre tarjeta oscura, verde y amarillo
 * sobre blanco), así que acá van las variantes legibles de esos mismos colores. Solo presentación: no toca datos ni métricas.
 */
export function progresoTone(C, darkMode) {
  var dm = darkMode !== false;
  return {
    dark: dm,
    muted: dm ? "#9ca3af" : "#566377",
    text2: dm ? "#d1d5db" : "#334155",
    line: dm ? "rgba(148,163,184,0.30)" : "#cbd5e1",
    track: dm ? "rgba(148,163,184,0.16)" : "#e2e8f0",
    good: dm ? "#4ade80" : "#15803d",
    bad: dm ? "#f87171" : "#b91c1c",
    warn: dm ? "#facc15" : "#854d0e",
    neutral: dm ? "#9ca3af" : "#566377",
    accent: C.blue,
    accentText: dm ? "#60a5fa" : "#2563eb",
    accentSoft: dm ? "#1e3a8a" : "#dbeafe",
    accentSoftText: dm ? "#bfdbfe" : "#1e40af",
    prBg: dm ? "#facc15" : "#fef9c3",
    prText: dm ? "#0A0F1A" : "#854d0e",
    prBorder: dm ? "#facc15" : "#fde047",
    prDot: dm ? "#eab308" : "#ca8a04",
    banner: dm ? { bg: "#1c1606", brd: "#713f12", title: "#fde68a", text: "#fef3c7" } : { bg: "#fefce8", brd: "#fde047", title: "#854d0e", text: "#713f12" },
    overlay: dm ? "rgba(0,0,0,0.6)" : "rgba(15,23,42,0.35)",
    sheetBg: C.card,
  };
}

/** Color de texto para el tono semántico de un chip del modelo (good / bad / warn / neutral). */
export function toneColor(tone, P) {
  return P[tone] || P.neutral;
}

function localeOf(lang) {
  return lang === "es" ? "es-AR" : lang === "pt" ? "pt-BR" : "en-US";
}

/** Número con separadores del idioma (4.180 · 87,5). */
export function fmtNum(n, lang, maxDecimals) {
  var v = Number(n);
  if (!isFinite(v)) return "—";
  return v.toLocaleString(localeOf(lang), { maximumFractionDigits: maxDecimals == null ? 1 : maxDecimals });
}

export function fmtKg(n, lang) {
  return fmtNum(n, lang, 1) + " kg";
}
