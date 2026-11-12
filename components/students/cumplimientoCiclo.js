// Modelo de la tarjeta «Cumplimiento del ciclo» de la ficha del alumno (solo entrenador). Funciones puras: sin React, sin red, sin
// almacenamiento. El calculo es el de lib/cumplimiento/sesiones.js, sin cambios; aca solo se decide que se puede mostrar.
//
// Historial completo: la UNICA evidencia aceptada es la bandera de la carga completa del roster (coachHistoriaCompleta en App.jsx, de
// lib/coachHistoryLoader.js) con `sesiones === true` Y un `rosterKey` que incluye al alumno: esa consulta (alumno_id=in.(rosterKey)) leyo
// todas las paginas de cada alumno de la clave, tambien de los que tienen cero sesiones. Bandera ausente (cargando), null, false, sin
// rosterKey, o un alumno que no estaba en esa carga (alta reciente, cambio de roster con carga fallida) => historial NO completo.
// La presencia de sesiones nunca se toma como prueba de que el historial esta completo.

import { cumplimientoSesiones, ESTADO_SEMANA, MOMENTO_SEMANA } from "../../lib/cumplimiento/sesiones.js";

export const ESTADO_TARJETA = {
  COMPLETA: "completa",
  PARCIAL: "parcial",
  PENDIENTE: "pendiente",
  SIN_DATOS: "sin_datos",
};

/** true SOLO si la carga completa del roster termino bien (sesiones === true) y su rosterKey incluye al alumno. */
export function historialCompletoDeAlumno(historiaCompleta, alumnoId) {
  if (!historiaCompleta || typeof historiaCompleta !== "object") return false;
  if (historiaCompleta.sesiones !== true) return false;
  var key = historiaCompleta.rosterKey;
  if (typeof key !== "string" || key === "") return false;
  if (alumnoId == null || alumnoId === "") return false;
  return key.split(",").indexOf(String(alumnoId)) !== -1;
}

function estadoDeSemana(s) {
  if (s.estado === ESTADO_SEMANA.COMPLETA) return ESTADO_TARJETA.COMPLETA;
  if (s.estado === ESTADO_SEMANA.PARCIAL) return ESTADO_TARJETA.PARCIAL;
  if (s.estado === ESTADO_SEMANA.PENDIENTE) return ESTADO_TARJETA.PENDIENTE;
  return ESTADO_TARJETA.SIN_DATOS;
}

/**
 * Modelo de la tarjeta. null si no hay rutina con dias (la ficha ya muestra «Sin rutina asignada»).
 * @param {object} p { alumnoId, rutina, sesiones, historiaCompleta }
 * @returns {null | {
 *   alumnoId, rutinaId, ciclo, diasPorSemana, historialConfiable, semanaActiva,
 *   semanas: Array<{ semana, actual, futura, estado, completados, programados, mostrarConteo, pctBarra, validados, motivo }>,
 *   acumulado: null | { completados, programados, pct, semanas },
 *   motivoSinAcumulado: null | "historial_no_confiable" | "sin_semanas_evaluables",
 *   huboReinicioDeSemana: boolean
 * }}
 */
export function modeloCumplimientoCiclo(p) {
  var o = p || {};
  var historialConfiable = historialCompletoDeAlumno(o.historiaCompleta, o.alumnoId);
  var r = cumplimientoSesiones({ alumnoId: o.alumnoId, rutina: o.rutina, sesiones: o.sesiones, historialCompleto: historialConfiable });
  if (!r || !r.ok) return null;
  var semanas = r.semanas.map(function (s) {
    var estado = estadoDeSemana(s);
    var futura = s.momento === MOMENTO_SEMANA.FUTURA;
    // pct del modulo: null en futuras y no verificables (nunca se inventa un porcentaje)
    var pctBarra = estado === ESTADO_TARJETA.SIN_DATOS || futura ? null : s.pct;
    return {
      semana: s.semana,
      actual: s.momento === MOMENTO_SEMANA.ACTUAL,
      futura: futura,
      estado: estado,
      completados: s.completados,
      programados: s.programados,
      mostrarConteo: estado !== ESTADO_TARJETA.SIN_DATOS,
      pctBarra: pctBarra,
      validados: s.validados,
      motivo: s.motivo,
    };
  });
  // Acumulado: SOLO semanas evaluables (con porcentaje real y no futuras) y solo con historial confiable.
  var acumulado = null;
  var motivoSinAcumulado = null;
  if (!historialConfiable) {
    motivoSinAcumulado = "historial_no_confiable";
  } else {
    var evaluables = semanas.filter(function (s) { return !s.futura && s.pctBarra != null; });
    if (!evaluables.length) {
      motivoSinAcumulado = "sin_semanas_evaluables";
    } else {
      var c = 0, t = 0;
      evaluables.forEach(function (s) { c += s.completados; t += s.programados; });
      acumulado = { completados: c, programados: t, pct: t > 0 ? Math.min(100, Math.round((100 * c) / t)) : 0, semanas: evaluables.length };
    }
  }
  return {
    alumnoId: r.alumnoId,
    rutinaId: r.rutinaId,
    ciclo: r.cicloActual,
    diasPorSemana: r.diasProgramados,
    historialConfiable: historialConfiable,
    semanaActiva: r.semanaActiva,
    semanas: semanas,
    acumulado: acumulado,
    motivoSinAcumulado: motivoSinAcumulado,
    huboReinicioDeSemana: r.intentosAnteriores.some(function (it) { return it.bloqueVigente; }),
  };
}
