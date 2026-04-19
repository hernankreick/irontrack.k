import { coachType as T, coachSpace as S } from '../../../coachUiScale.js';

const C_TEXT = '#ffffff';
const C_SECONDARY = '#e2e8f0';

export default function HeaderResumen({ nombre, sesiones, sinEntrenar, pagos }) {
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 20 ? "Buenas tardes" : "Buenas noches";

  const metricas = [
    sesiones   != null && `${sesiones} sesiones`,
    sinEntrenar != null && `${sinEntrenar} sin entrenar`,
    pagos      != null && `${pagos} pagos pendientes`,
  ].filter(Boolean).join("  |  ");

  const saludoRompeEmail = typeof nombre === "string" && nombre.includes("@");

  return (
    <div style={{ marginBottom: S.pageGap }}>
      <p style={{ ...s.saludo, ...(saludoRompeEmail ? { wordBreak: "break-all" } : {}) }}>{saludo}, {nombre}</p>
      {metricas && <p style={s.metricas}>{metricas}</p>}
    </div>
  );
}

const s = {
  saludo: {
    ...T.screenTitle,
    color: C_TEXT,
    margin: "0 0 6px",
  },
  metricas: {
    ...T.meta,
    color: C_SECONDARY,
    fontWeight: 600,
    margin: 0,
    letterSpacing: "0.02em",
  },
};
