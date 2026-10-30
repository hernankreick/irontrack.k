// Racha semanal real: UNA definicion.
//
//   racha = cantidad de semanas de calendario (lunes-domingo) CONSECUTIVAS con al menos una sesion completada del alumno
//           (cualquier rutina o ciclo; incluye las validadas por el entrenador), contando hacia atras desde la semana actual.
//           Si la semana actual todavia no tiene sesiones no rompe la racha: se cuenta desde la semana anterior.
//           Una semana sin sesiones (que no sea la actual) la corta. Sin sesiones recientes => 0 (nunca muestra una racha vieja).
// Fuente: filas de `sesiones` del servidor. No usa it_cd ni localStorage.
// Modulo puro.

import { diaDeSesion, lunesDe } from "./fechas.js";
import { isCompletedSession } from "../studentWeeklyProgress.js";

/**
 * @param {Array}  sesiones
 * @param {object} opts { hoy: numero de dia (requerido), alumnoId }
 * @returns {{ semanas: number, incluyeSemanaActual: boolean, ultimaSemana: number|null }}  ultimaSemana = lunes de la ultima semana con sesion
 */
export function rachaSemanal(sesiones, opts) {
  var o = opts || {};
  var aid = o.alumnoId != null && o.alumnoId !== "" ? String(o.alumnoId) : null;
  var semanas = {};
  var ultima = null;
  (Array.isArray(sesiones) ? sesiones : []).forEach(function (s) {
    if (!s || !isCompletedSession(s)) return;
    if (aid && String(s.alumno_id) !== aid) return;
    var dia = diaDeSesion(s);
    if (dia == null || dia > o.hoy) return;
    var l = lunesDe(dia);
    semanas[l] = true;
    if (ultima == null || l > ultima) ultima = l;
  });
  var actual = lunesDe(o.hoy);
  var incluyeActual = !!semanas[actual];
  var cursor = incluyeActual ? actual : actual - 7;
  var n = 0;
  while (semanas[cursor]) { n++; cursor -= 7; }
  return { semanas: n, incluyeSemanaActual: incluyeActual, ultimaSemana: ultima };
}
