/**
 * Paleta compartida coach (dashboard, Progreso, sidebar, búsqueda).
 * Modo día: fondo blanco, acento azul (#2563eb), bordes slate claros.
 */

export function coachThemePalette(darkMode) {
  var dm = darkMode !== false;
  if (dm) {
    return {
      bg: "#0a0a0f",
      card: "#12121a",
      cardDark: "#0d0d15",
      brd: "#1e1e2e",
      t: "#ffffff",
      t2: "#71717a",
      blue: "#3b82f6",
      blueDim: "#1e3a8a",
      green: "#22c55e",
      greenDim: "#052e16",
      yel: "#eab308",
      yelDim: "#422006",
      red: "#ef4444",
      redDim: "#450a0a",
      rowDivider: "rgba(30, 41, 46, 0.35)",
      mobileStatBg: "#111827",
      mobileStatBorder: "#1A2535",
      mobileStatText: "#F9FAFB",
      mobileStatMuted: "#9CA3AF",
      mobileTrack: "#1A2535",
    };
  }
  return {
    bg: "#ffffff",
    card: "#ffffff",
    cardDark: "#f8fafc",
    brd: "#e2e8f0",
    t: "#0f172a",
    t2: "#64748b",
    blue: "#2563eb",
    blueDim: "#dbeafe",
    green: "#16a34a",
    greenDim: "#dcfce7",
    yel: "#ca8a04",
    yelDim: "#fef9c3",
    red: "#dc2626",
    redDim: "#fee2e2",
    rowDivider: "rgba(226, 232, 240, 0.95)",
    mobileStatBg: "#f8fafc",
    mobileStatBorder: "#e2e8f0",
    mobileStatText: "#0f172a",
    mobileStatMuted: "#64748b",
    mobileTrack: "#e2e8f0",
  };
}

/** Tokens barra lateral escritorio coach */
export function desktopSidebarTheme(darkMode) {
  var dm = darkMode !== false;
  if (dm) {
    return {
      bg: "#0a0a0f",
      card: "#12121a",
      border: "#1e1e2e",
      primary: "#3b82f6",
      primaryLight: "#3b82f6",
      text: "#ffffff",
      muted: "#71717a",
      hover: "rgba(59, 130, 246, 0.1)",
      activeBg: "rgba(59, 130, 246, 0.16)",
      danger: "#ef4444",
      iconInactive: "#6B7280",
      logoBarMid: "#1D4ED8",
      activeLabel: "#ffffff",
    };
  }
  return {
    bg: "#ffffff",
    card: "#f8fafc",
    border: "#e2e8f0",
    primary: "#2563eb",
    primaryLight: "#2563eb",
    text: "#0f172a",
    muted: "#64748b",
    hover: "rgba(37, 99, 235, 0.08)",
    activeBg: "rgba(37, 99, 235, 0.1)",
    danger: "#dc2626",
    iconInactive: "#64748b",
    logoBarMid: "#1d4ed8",
    activeLabel: "#0f172a",
  };
}

/** Chrome del dropdown GlobalSearch (coach header) */
export function globalSearchTheme(darkMode) {
  var dm = darkMode !== false;
  if (dm) {
    return {
      inputBg: "#111827",
      inputBorder: "#1a2535",
      inputText: "#f1f5f9",
      panelBg: "#111827",
      panelBorder: "#1a2535",
      panelShadow: "0 16px 48px rgba(0,0,0,0.45)",
      chipBorder: "#1a2535",
      chipSelBg: "#1e3a8a22",
      chipSelColor: "#60a5fa",
      chipColor: "#94a3b8",
      rowHover: "#1a2535",
      rowText: "#f1f5f9",
      rowMuted: "#64748b",
      avatarBg: "#1e293b",
      avatarColor: "#94a3b8",
      sectionLabel: "#475569",
      footerBorder: "#1a2535",
      kbdBg: "#0f172a",
      kbdBorder: "#334155",
      highlight: "#60a5fa",
    };
  }
  return {
    inputBg: "#ffffff",
    inputBorder: "#e2e8f0",
    inputText: "#0f172a",
    panelBg: "#ffffff",
    panelBorder: "#e2e8f0",
    panelShadow: "0 16px 48px rgba(15,23,42,0.12)",
    chipBorder: "#e2e8f0",
    chipSelBg: "rgba(37,99,235,0.1)",
    chipSelColor: "#2563eb",
    chipColor: "#64748b",
    rowHover: "#f1f5f9",
    rowText: "#0f172a",
    rowMuted: "#64748b",
    avatarBg: "#f1f5f9",
    avatarColor: "#475569",
    sectionLabel: "#64748b",
    footerBorder: "#e2e8f0",
    kbdBg: "#f8fafc",
    kbdBorder: "#e2e8f0",
    highlight: "#2563eb",
  };
}
