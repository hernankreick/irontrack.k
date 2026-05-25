export function getAppThemeTokens(darkMode) {
  const bg = darkMode ? "#0F1923" : "#F0F4F8";
  const bgCard = darkMode ? "#1E2D40" : "#FFFFFF";
  const bgSub = darkMode ? "#162234" : "#E2E8F0";
  const border = darkMode ? "#2D4057" : "#2D4057";
  const textMain = darkMode ? "#FFFFFF" : "#0F1923";
  const textMuted = darkMode ? "#8B9AB2" : "#64748B";
  const green = darkMode ? "#22C55E" : "#16A34A";
  const greenSoft = darkMode ? "rgba(34,197,94,0.12)" : "rgba(22,163,74,0.1)";
  const greenBorder = darkMode ? "rgba(34,197,94,0.25)" : "rgba(22,163,74,0.25)";
  const coachAluShell = darkMode ? "#0a0f1a" : "#f1f5f9";
  const coachAluSurface = darkMode ? "#111827" : "#ffffff";
  const coachAluSubtle = darkMode ? "#0f172a" : "#f8fafc";
  const coachAluBorderSoft = darkMode ? "rgba(59,130,246,0.22)" : "#e2e8f0";
  const coachAluTrack = darkMode ? "#1e293b" : "#e2e8f0";
  const coachAluDropdown = darkMode ? "#111827" : "#ffffff";
  const coachAluDropdownShadow = darkMode ? "0 12px 32px rgba(0,0,0,0.55)" : "0 12px 28px rgba(15,23,42,0.12)";
  const coachAluGhostBtn = darkMode ? "#162234" : "#f1f5f9";
  const card = { background: bgCard, borderRadius: 16, padding: "22px 24px", marginBottom: 12, border: "1px solid " + border, boxShadow: darkMode ? "0 4px 16px rgba(0,0,0,0.5)" : "0 2px 8px rgba(0,0,0,0.08)" };
  const inp = { background: bgSub, color: textMain, border: "1px solid " + border, borderRadius: 12, padding: "8px 12px", fontSize: 15, fontFamily: "Inter,sans-serif", width: "100%", boxSizing: "border-box" };
  const lbl = { fontSize: 13, fontWeight: 600, letterSpacing: 0.3, color: textMuted, marginBottom: 4, display: "block" };
  const btn = (col, txt) => ({ background: col || (darkMode ? "#2D4057" : "#E2E8F0"), color: txt || (darkMode ? "#FFFFFF" : "#0F1923"), border: "none", borderRadius: 8, padding: "8px 16px", fontFamily: "Barlow Condensed,sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer", letterSpacing: 1 });
  const tag = (col) => ({ background: "#162234", color: "#8B9AB2", border: "1px solid #2D4057", borderRadius: 6, padding: "4px 8px", fontSize: 13, fontWeight: 700 });

  return {
    bg,
    bgCard,
    bgSub,
    border,
    textMain,
    textMuted,
    green,
    greenSoft,
    greenBorder,
    coachAluShell,
    coachAluSurface,
    coachAluSubtle,
    coachAluBorderSoft,
    coachAluTrack,
    coachAluDropdown,
    coachAluDropdownShadow,
    coachAluGhostBtn,
    card,
    inp,
    lbl,
    btn,
    tag,
  };
}
