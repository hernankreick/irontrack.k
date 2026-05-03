export function getTheme(darkMode) {
  const dm = darkMode !== false;
  return {
    bg: dm?"#0F1923":"#F0F4F8",
    bgCard: dm?"#1E2D40":"#FFFFFF",
    bgSub: dm?"#162234":"#EEF2F7",
    border: dm?"#2D4057":"#E2E8F0",
    textMain: dm?"#FFFFFF":"#0F1923",
    textMuted: dm?"#8B9AB2":"#64748B",
  };
}
