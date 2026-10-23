/**
 * Paleta UNICA de Configuracion del entrenador (segun `darkMode`). Unica fuente de colores de components/settings/**:
 * los componentes no llevan hex propios (lo verifica scripts/test-coachSettingsPalette.mjs, que tambien exige contrastes WCAG AA).
 *
 * Escala (alineada con la app: fondo #0F1923, superficie #162234, borde #2D4057, texto #F1F5F9, secundario #8B9AB2):
 *   bg            fondo de toda la pantalla (cabecera, pestañas y contenido comparten tono: sin cajas anidadas)
 *   card          superficie de tarjetas / filas
 *   control       fondo de inputs, selects y pista de segmentados (hundido respecto de `card`)
 *   border        separadores y borde de tarjetas (sutil, decorativo)
 *   borderStrong  borde de controles interactivos (>= 3:1 contra card y control)
 *   text / sub / muted   texto principal / secundario / terciario (todos >= 4,5:1 sobre bg y card)
 *   blue          azul de marca: fondo de seleccion y accion (texto blanco encima >= 4,5:1)
 *   blueText      azul legible como TEXTO o borde de seleccion sobre bg/card/navActiveBg
 *   red / redBtn  peligro como texto / peligro como fondo con texto blanco
 *   green         exito (texto)
 * Radios: rCtrl 8 (controles, botones), rCard 12 (tarjetas), pill 999. Borde: siempre 1px.
 */
export const SETTINGS_RADIUS = { rCtrl: 8, rCard: 12, pill: 999 };

const DARK = {
  bg: '#0F1923',
  card: '#162234',
  control: '#0F1923',
  border: '#2D4057',
  borderStrong: '#64748B',
  text: '#F1F5F9',
  sub: '#C2CCDA',
  muted: '#9AA9BF',
  blue: '#2563EB',
  blueL: '#60A5FA',
  blueText: '#7DB2FF',
  onBlue: '#FFFFFF',
  navActiveBg: '#1B2F55',
  red: '#F87171',
  redBtn: '#DC2626',
  onRed: '#FFFFFF',
  dangerBg: '#3A1F26',
  dangerBorder: '#7F3340',
  green: '#4ADE80',
  proBadgeBg: '#12301F',
  proBadgeBorder: '#2F8F57',
  avatarGradient: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
  subscriptionBanner: 'linear-gradient(135deg, #1B2F55 0%, #162234 100%)',
  selectChevron: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='%23C2CCDA' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 6l4.5 4.5L12.5 6'/%3E%3C/svg%3E\")",
  deleteDisabledBg: '#3A1F26',
  deleteBtnDisabledFg: '#C2CCDA',
  deleteWarnText: '#FCA5A5',
};

const LIGHT = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  control: '#F1F5F9',
  border: '#CBD5E1',
  borderStrong: '#64748B',
  text: '#0F1923',
  sub: '#334155',
  muted: '#52627A',
  blue: '#2563EB',
  blueL: '#1D4ED8',
  blueText: '#1D4ED8',
  onBlue: '#FFFFFF',
  navActiveBg: '#DBEAFE',
  red: '#B91C1C',
  redBtn: '#DC2626',
  onRed: '#FFFFFF',
  dangerBg: '#FEE2E2',
  dangerBorder: '#FCA5A5',
  green: '#15803D',
  proBadgeBg: '#DCFCE7',
  proBadgeBorder: '#16A34A',
  avatarGradient: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
  subscriptionBanner: 'linear-gradient(135deg, #DBEAFE 0%, #FFFFFF 100%)',
  selectChevron: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none' stroke='%23334155' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3.5 6l4.5 4.5L12.5 6'/%3E%3C/svg%3E\")",
  deleteDisabledBg: '#FEE2E2',
  deleteBtnDisabledFg: '#7F1D1D',
  deleteWarnText: '#B91C1C',
};

export default function coachSettingsPalette(darkMode) {
  const dm = darkMode !== false;
  const base = dm ? DARK : LIGHT;
  return {
    ...SETTINGS_RADIUS,
    ...base,
    // Alias historicos (los componentes ya los usan): misma escala, sin tonos nuevos.
    chrome: base.bg,
    navInactiveDangerText: base.red,
    currencySelBg: base.navActiveBg,
    dangerCardBorder: base.dangerBorder,
    tabDanger: base.red,
  };
}
