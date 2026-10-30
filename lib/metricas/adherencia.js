// Adherencia al plan en un periodo: UNA definicion para las estadisticas del entrenador.
//
//   planificadas = dias de la rutina asignada x semanas del periodo efectivo (redondeo hacia arriba de dias / 7).
//                  El periodo efectivo empieza en max(desde, dia en que se asigno la rutina): no se penaliza lo anterior a la asignacion.
//   completadas  = sesiones completadas de ESA rutina (rutina_id; legado sin rutina_id: mismo nombre) del alumno dentro del periodo
//                  efectivo, contando una sola vez cada (dia de calendario, dia de la rutina). No se filtra por ciclo: un reinicio no
//                  borra que el alumno entreno. Las validadas por el entrenador (origen "validada_coach") cuentan, pero se informan aparte;
//                  si el mismo dia hay una realizada y una validada, cuenta como realizada.
//   pct          = completadas / planificadas (tope 100). Sin rutina, sin dias o periodo efectivo vacio: pct = null (sin plan).
// Modulo puro.

import { diaDeSesion, diaDeCreatedAt, enRango } from "./fechas.js";
import { isCompletedSession, sessionMatchesRoutine } from "../studentWeeklyProgress.js";

export const ORIGEN_VALIDADA = "validada_coach";

function diasDeRutina(rutina) {
  var days = (rutina && rutina.datos && Array.isArray(rutina.datos.days)) ? rutina.datos.days
    : (rutina && Array.isArray(rutina.days) ? rutina.days : []);
  return days.length;
}

/**
 * @param {object} p
 * @param {object} p.rutina   rutina asignada vigente (id, nombre, created_at, datos.days)
 * @param {Array}  p.sesiones filas de `sesiones` (pueden ser de todo el roster)
 * @param {*}      p.alumnoId
 * @param {number} p.desde    numero de dia (inclusivo)
 * @param {number} p.hasta    numero de dia (inclusivo)
 * @returns {{ planificadas, completadas, realizadas, validadas, pct, desdeEfectivo, semanas, diasPorSemana, motivo }}
 */
export function adherencia(p) {
  var o = p || {};
  var rutina = o.rutina;
  var diasPorSemana = diasDeRutina(rutina);
  var base = { planificadas: 0, completadas: 0, realizadas: 0, validadas: 0, pct: null, desdeEfectivo: null, semanas: 0, diasPorSemana: diasPorSemana, motivo: null };
  if (!rutina || rutina.id == null) return Object.assign(base, { motivo: "sin_rutina" });
  if (!(diasPorSemana > 0)) return Object.assign(base, { motivo: "rutina_sin_dias" });
  var asignada = diaDeCreatedAt(rutina.created_at);
  var desde = o.desde;
  if (asignada != null && (desde == null || asignada > desde)) desde = asignada;
  if (desde == null || o.hasta == null || desde > o.hasta) return Object.assign(base, { desdeEfectivo: desde, motivo: "periodo_vacio" });
  var semanas = Math.ceil((o.hasta - desde + 1) / 7);
  var planificadas = diasPorSemana * semanas;

  var rid = String(rutina.id);
  var rnombre = String(rutina.nombre || rutina.name || "");
  var aid = o.alumnoId != null && o.alumnoId !== "" ? String(o.alumnoId) : null;
  var porClave = {};
  (Array.isArray(o.sesiones) ? o.sesiones : []).forEach(function (s) {
    if (!s || !isCompletedSession(s)) return;
    if (aid && String(s.alumno_id) !== aid) return;
    if (!sessionMatchesRoutine(s, rid, rnombre)) return;
    var dia = diaDeSesion(s);
    if (!enRango(dia, desde, o.hasta)) return;
    var di = s.dia_idx == null || s.dia_idx === "" ? "?" : String(s.dia_idx);
    var clave = dia + "|" + di;
    var validada = s.origen === ORIGEN_VALIDADA;
    // realizada gana a validada en la misma clave
    porClave[clave] = porClave[clave] === "realizada" || !validada ? "realizada" : "validada";
  });
  var claves = Object.keys(porClave);
  var realizadas = claves.filter(function (k) { return porClave[k] === "realizada"; }).length;
  var validadas = claves.length - realizadas;
  return Object.assign(base, {
    planificadas: planificadas,
    completadas: claves.length,
    realizadas: realizadas,
    validadas: validadas,
    pct: Math.min(100, Math.round((100 * claves.length) / planificadas)),
    desdeEfectivo: desde,
    semanas: semanas,
  });
}
