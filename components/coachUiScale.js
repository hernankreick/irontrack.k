/**
 * Escala tipográfica y spacing compartida — vistas entrenador (CoachDashboard, ProgresoView).
 * Los colores se definen en cada vista (C.t, C.t2, etc.).
 */

export const coachType = {
  /** Títulos de pantalla — 24–28px, 700–800 */
  screenTitle: { fontSize: 26, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.02 },
  /** Subtítulo bajo el título de pantalla — 13–14px, 400–500 */
  screenSubtitle: { fontSize: 14, fontWeight: 400, lineHeight: 1.45 },

  /** Títulos de card — 16–18px, 600–700 */
  cardTitle: { fontSize: 17, fontWeight: 700, lineHeight: 1.25, letterSpacing: -0.02 },
  cardTitleSemibold: { fontSize: 17, fontWeight: 600, lineHeight: 1.25 },

  /** Subtítulos / texto explicativo — 13–14px, 400–500 */
  subtitle: { fontSize: 13, fontWeight: 500, lineHeight: 1.45 },

  /** Labels / metadata / ejes — 12–13px, 500–600 */
  label: { fontSize: 12, fontWeight: 600, lineHeight: 1.35 },
  labelMd: { fontSize: 13, fontWeight: 600, lineHeight: 1.35 },
  meta: { fontSize: 12, fontWeight: 500, lineHeight: 1.35 },
  axis: { fontSize: 12, fontWeight: 600, lineHeight: 1.35 },

  /** Texto principal de contenido — 14–16px, 500–600 */
  body: { fontSize: 14, fontWeight: 500, lineHeight: 1.45 },
  bodySemibold: { fontSize: 14, fontWeight: 600, lineHeight: 1.4 },
  bodyLg: { fontSize: 15, fontWeight: 600, lineHeight: 1.35 },

  /** Controles: selects, pills de período */
  control: { fontSize: 14, fontWeight: 600, lineHeight: 1.4 },
  periodTab: { fontSize: 13, fontWeight: 600, lineHeight: 1.35 },

  /** Números destacados — jerarquía */
  numberStat: { fontSize: 22, fontWeight: 800, lineHeight: 1.1 },
  numberStatSm: { fontSize: 16, fontWeight: 700, lineHeight: 1.15 },
  numberGauge: { fontSize: 24, fontWeight: 800, lineHeight: 1.2 },
  numberHero: { fontSize: 52, fontWeight: 800, lineHeight: 1.15, letterSpacing: -1 },
  numberScore: { fontSize: 40, fontWeight: 800, lineHeight: 1.15 },

  /** Enlaces / acciones secundarias en cabecera de card */
  link: { fontSize: 14, fontWeight: 600, lineHeight: 1.35 },

  /** Cabeceras de tabla tipo dashboard */
  tableHeader: {
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: 0.06,
    textTransform: "uppercase",
  },

  /** Sección “ACCIONES RÁPIDAS” */
  sectionEyebrow: { fontSize: 13, fontWeight: 600, lineHeight: 1.35, letterSpacing: 0.06, textTransform: "uppercase" },
};

export const coachSpace = {
  /** Padding página / columna principal */
  pagePadding: 20,
  /** Gap vertical entre bloques grandes */
  pageGap: 24,
  headerPadding: "16px 20px",

  /** Cards */
  cardPadding: 20,
  cardPaddingTight: 18,

  /** Gap entre bloques internos de una card */
  blockGap: 12,
  blockGapLoose: 14,

  /** Grillas */
  gridGap: 16,
  gridGapTight: 12,
  chipGridGap: 10,
};
