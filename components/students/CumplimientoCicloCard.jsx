import React from 'react';
import { studentCardPalette } from './studentCardPalette.js';
import { ESTADO_TARJETA } from './cumplimientoCiclo.js';

// Colores por estado: el estado SIEMPRE se comunica tambien con un icono y un texto (nunca solo con color).
function coloresEstado(darkMode) {
  return darkMode
    ? { completa: "#4ade80", parcial: "#fbbf24", pendiente: "#93c5fd", sin_datos: "#cbd5e1", barCompleta: "#22c55e", barParcial: "#f59e0b", barPendiente: "#3b82f6" }
    : { completa: "#15803d", parcial: "#b45309", pendiente: "#1d4ed8", sin_datos: "#475569", barCompleta: "#16a34a", barParcial: "#d97706", barPendiente: "#2563eb" };
}

// Iconos SVG (no glifos de fuente: «◐» se ve distinto o incompleto segun el sistema). Siempre acompanan a un texto.
function IconoEstado({ estado, color }) {
  var comun = { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": true, focusable: "false", style: { flexShrink: 0, display: "inline-block", verticalAlign: "-1px", marginRight: 4 } };
  if (estado === "completa") return <svg {...comun}><path d="M2 6.3 4.8 9 10 3.2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (estado === "parcial") return <svg {...comun}><circle cx="6" cy="6" r="4.6" fill="none" stroke={color} strokeWidth="1.6" /><path d="M6 1.4a4.6 4.6 0 0 1 0 9.2z" fill={color} /></svg>;
  if (estado === "pendiente") return <svg {...comun}><circle cx="6" cy="6" r="4.6" fill="none" stroke={color} strokeWidth="1.6" /></svg>;
  return <svg {...comun}><circle cx="6" cy="6" r="4.6" fill="none" stroke={color} strokeWidth="1.6" strokeDasharray="2 1.6" /><path d="M6 8.4v.01" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

/**
 * Tarjeta «Cumplimiento del ciclo» (ficha del alumno, solo entrenador): S1..S4 del ciclo vigente con sesiones completadas / programadas.
 * Presentacional: recibe el modelo de components/students/cumplimientoCiclo.js. Sin controles interactivos (no agrega objetivos tactiles).
 */
export default function CumplimientoCicloCard({ modelo, darkMode, msg, textMain, textMuted, coachAluSurface, coachAluBorderSoft, coachAluSubtle }) {
  if (!modelo) return null;
  var t = typeof msg === "function" ? msg : function (esText) { return esText; };
  var P = studentCardPalette({ darkMode: darkMode, coachAluSurface: coachAluSurface, coachAluBorderSoft: coachAluBorderSoft, coachAluSubtle: coachAluSubtle });
  var C = coloresEstado(darkMode);
  var tituloId = "cumplimiento-ciclo-" + String(modelo.alumnoId);
  var textoEstado = function (s) {
    if (s.estado === ESTADO_TARJETA.COMPLETA) return t("Completa", "Complete");
    if (s.estado === ESTADO_TARJETA.PARCIAL) return t("Parcial", "Partial");
    if (s.estado === ESTADO_TARJETA.PENDIENTE) return s.futura ? t("Pendiente · próxima", "Pending · upcoming") : t("Pendiente", "Pending");
    return t("Sin datos suficientes", "Not enough data");
  };
  var colorBarra = function (s) {
    if (s.estado === ESTADO_TARJETA.COMPLETA) return C.barCompleta;
    if (s.estado === ESTADO_TARJETA.PARCIAL) return C.barParcial;
    return C.barPendiente;
  };
  var acum = modelo.acumulado;
  var textoAcumulado = acum
    ? acum.completados + " " + t("de", "of") + " " + acum.programados + " " + t("sesiones", "sessions") + " · " + acum.pct + " %"
    : t("Sin datos suficientes", "Not enough data");
  var detalleAcumulado = acum
    ? (acum.semanas === 1 ? t("1 semana evaluada", "1 week assessed") : acum.semanas + " " + t("semanas evaluadas", "weeks assessed"))
    : (modelo.motivoSinAcumulado === "historial_no_confiable"
      ? t("El historial de sesiones no está completo o todavía se está cargando.", "The session history is incomplete or still loading.")
      : t("Todavía no hay semanas para evaluar.", "No weeks to assess yet."));

  return (
    <section aria-labelledby={tituloId} data-qa="cumplimiento-ciclo" style={{ background: P.surface, border: "1px solid " + P.border, borderRadius: 14, padding: "12px 12px 10px", marginBottom: 8, boxSizing: "border-box", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <h3 id={tituloId} data-qa-text style={{ margin: 0, fontSize: 15, fontWeight: 800, color: textMain, lineHeight: 1.25 }}>{t("Cumplimiento del ciclo", "Cycle compliance")}</h3>
        <span data-qa-text style={{ fontSize: 12.5, fontWeight: 700, color: P.blueText, background: P.blueSoft, border: "1px solid " + P.blueBorder, borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap" }}>{t("Ciclo", "Cycle")} {modelo.ciclo}</span>
      </div>
      <div style={{ background: P.inner, border: "1px solid " + P.border, borderRadius: 10, padding: "7px 10px", marginBottom: 8 }}>
        <div data-qa-text data-qa="cumplimiento-acumulado-titulo" style={{ fontSize: 12, fontWeight: 600, color: textMuted, lineHeight: 1.3 }}>{t("Cumplimiento de semanas evaluadas", "Compliance of assessed weeks")}</div>
        <div data-qa-text data-qa="cumplimiento-acumulado" style={{ fontSize: 13.5, fontWeight: 700, color: acum ? textMain : C.sin_datos, lineHeight: 1.3, marginTop: 1 }}>
          {acum ? null : <IconoEstado estado="sin_datos" color={C.sin_datos} />}{textoAcumulado}
        </div>
        <div data-qa-text style={{ fontSize: 12, color: textMuted, lineHeight: 1.3, marginTop: 1 }}>{detalleAcumulado}</div>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 7 }}>
        {modelo.semanas.map(function (s) {
          var color = C[s.estado] || C.sin_datos;
          var conteo = s.mostrarConteo ? s.completados + "/" + s.programados : "—";
          var etiquetaA11y = "S" + s.semana + (s.actual ? ", " + t("semana actual", "current week") : "") + ": " +
            (s.mostrarConteo ? s.completados + " " + t("de", "of") + " " + s.programados + " " + t("sesiones", "sessions") + ", " : "") + textoEstado(s);
          return (
            <li key={s.semana} data-qa={"cumplimiento-semana-" + s.semana} data-estado={s.estado} aria-label={etiquetaA11y}
              style={{ display: "grid", gridTemplateColumns: "30px minmax(0,1fr) auto", alignItems: "center", columnGap: 8, minWidth: 0 }}>
              <span aria-hidden="true" style={{ fontSize: 13.5, fontWeight: 800, color: s.actual ? P.blueText : textMain }}>S{s.semana}</span>
              <div aria-hidden="true" style={{ minWidth: 0 }}>
                <div style={{ height: 8, borderRadius: 8, background: P.track, overflow: "hidden", border: s.estado === ESTADO_TARJETA.SIN_DATOS ? "1px dashed " + C.sin_datos : "none", boxSizing: "border-box" }}>
                  {s.pctBarra != null && s.pctBarra > 0 ? <div style={{ width: s.pctBarra + "%", height: "100%", background: colorBarra(s), borderRadius: 8 }} /> : null}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginTop: 3, minWidth: 0, flexWrap: "wrap" }}>
                  <span data-qa-text style={{ fontSize: 12.5, fontWeight: 700, color: color, lineHeight: 1.25 }}><IconoEstado estado={s.estado} color={color} />{textoEstado(s)}</span>
                  {s.actual ? <span data-qa-text style={{ fontSize: 12, color: textMuted, lineHeight: 1.25 }}>{t("· semana actual", "· current week")}</span> : null}
                  {s.validados > 0 ? <span data-qa-text style={{ fontSize: 12, color: textMuted, lineHeight: 1.25 }}>{"· " + s.validados + " " + (s.validados === 1 ? t("validada", "validated") : t("validadas", "validated"))}</span> : null}
                </div>
              </div>
              <span aria-hidden="true" data-qa-text style={{ fontSize: 13.5, fontWeight: 700, color: s.mostrarConteo ? textMain : C.sin_datos, minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{conteo}</span>
            </li>
          );
        })}
      </ol>
      <p data-qa-text style={{ margin: "8px 0 0", fontSize: 12, color: textMuted, lineHeight: 1.35 }}>
        {t("Se utiliza la planificación actual. Los cambios de rutina pueden afectar la comparación con semanas anteriores.", "The current plan is used. Routine changes may affect the comparison with earlier weeks.")}
        {modelo.huboReinicioDeSemana ? " " + t("Hubo un reinicio de semana: el intento anterior no cuenta.", "A week was restarted: the previous attempt does not count.") : ""}
      </p>
    </section>
  );
}
