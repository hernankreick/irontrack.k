/** Paleta de la pantalla coach Settings según `darkMode` de la app. */
export default function coachSettingsPalette(darkMode) {
  const dm = darkMode !== false;
  if (dm) {
    return {
      bg: '#0B0E11',
      card: '#111827',
      border: '#1A2535',
      blue: '#2563EB',
      blueL: '#3B82F6',
      green: '#22C55E',
      red: '#EF4444',
      text: '#F1F5F9',
      muted: '#64748B',
      sub: '#94A3B8',
      chrome: '#0D1117',
      navActiveBg: '#1D2D50',
      navInactiveDangerText: '#FCA5A5',
      currencySelBg: '#1D2D50',
      proBadgeBg: '#1A2E1A',
      proBadgeBorder: '#166534',
      subscriptionBanner: 'linear-gradient(135deg, #1D2D50 0%, #0F1829 100%)',
      deleteDisabledBg: '#4B1A1A',
      deleteBtnDisabledFg: '#fff',
      deleteWarnText: '#FCA5A5',
      dangerCardBorder: '#4B1A1A',
    };
  }
  return {
    bg: '#F0F4F8',
    card: '#FFFFFF',
    border: '#E2E8F0',
    blue: '#2563EB',
    blueL: '#2563EB',
    green: '#16A34A',
    red: '#DC2626',
    text: '#0F1923',
    muted: '#64748B',
    sub: '#475569',
    chrome: '#FFFFFF',
    navActiveBg: 'rgba(37,99,235,0.12)',
    navInactiveDangerText: '#B91C1C',
    currencySelBg: 'rgba(37,99,235,0.12)',
    proBadgeBg: '#DCFCE7',
    proBadgeBorder: '#166534',
    subscriptionBanner: 'linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 100%)',
    deleteDisabledBg: '#FECACA',
    deleteBtnDisabledFg: '#991b1b',
    deleteWarnText: '#B91C1C',
    dangerCardBorder: '#FECACA',
  };
}
