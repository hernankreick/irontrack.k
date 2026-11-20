// Subtitulo de «Semana N de 4» en la ficha del alumno (vista del entrenador). Solo presentacion: lee el resultado de
// getActiveStudentRoutinePosition().weeklyProgress y no escribe ni recalcula nada de semanas, sesiones ni progreso.
//
// La semana de la rutina avanza por PROGRESO (rutina.datos.semana_activa), no por calendario, asi que el subtitulo no lleva un rango de
// fechas fijo. Muestra cuando se inicio la semana activa (fecha de su primera sesion) o «Sin iniciar» si todavia no tiene sesiones.
// StudentsSection.jsx y las pruebas usan esta misma funcion (una sola fuente).

import { parseLocalDateMs } from "../../lib/studentWeeklyProgress.js";

/** Fecha (ms) de la primera sesion de la semana activa, o null si no hay sesiones con fecha legible. */
export function semanaInicioMs(weeklyProgress) {
  var used = weeklyProgress && Array.isArray(weeklyProgress.sessionsUsed) ? weeklyProgress.sessionsUsed : [];
  var times = used
    .map(function (s) { return parseLocalDateMs(s && (s.created_at || s.fecha)); })
    .filter(function (t) { return t != null; });
  return times.length ? Math.min.apply(null, times) : null;
}

/**
 * Texto bajo «Semana N de 4».
 *  - sin datos de semana           -> ""
 *  - con sesiones fechadas         -> «Iniciada el D/M» (primera sesion de la semana activa)
 *  - sin sesiones y 0 dias hechos  -> «Sin iniciar»
 *  - dias hechos pero sin fecha    -> "" (no se inventa una fecha)
 * @param {object|null} weeklyProgress resultado de getStudentWeeklyProgress / getActiveStudentRoutinePosition().weeklyProgress
 * @param {(es:string,en:string,pt?:string)=>string} msg traductor de la app
 */
export function semanaSubtitulo(weeklyProgress, msg) {
  if (!weeklyProgress) return "";
  var t = semanaInicioMs(weeklyProgress);
  if (t != null) {
    var d = new Date(t);
    return msg("Iniciada el ", "Started ") + d.getDate() + "/" + (d.getMonth() + 1);
  }
  return weeklyProgress.completedDays === 0 ? msg("Sin iniciar", "Not started") : "";
}
