// Fechas del nucleo de metricas: TODO se clasifica por numero de dia de calendario (dias desde 1970-01-01), nunca por milisegundos.
// progreso.fecha / sesiones.fecha: d/m/yyyy estricto (lib/progressDate.js). created_at (ISO, UTC) solo como respaldo de sesiones sin fecha.
// Modulo puro.

import { dayNum, parseFechaDMY } from "../progressDate.js";
import { createdAtSortKey } from "../routineStore.js";

export { dayNum, parseFechaDMY };

/** Numero de dia de la fecha de calendario LOCAL de un Date (o de ahora). */
export function diaLocal(date) {
  var d = date instanceof Date ? date : new Date();
  return dayNum(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Numero de dia LOCAL de un created_at de Supabase ("2026-09-01 13:32:24.5" o ISO con zona). null si es invalido. */
export function diaDeCreatedAt(value) {
  var key = createdAtSortKey(value);
  if (!Number.isFinite(key)) return null;
  return diaLocal(new Date(Math.floor(key / 1000)));
}

/** Dia de una sesion: su `fecha` (d/m/yyyy); si no la tiene o es invalida, el dia local de created_at. */
export function diaDeSesion(s) {
  if (!s) return null;
  var d = parseFechaDMY(s.fecha);
  return d != null ? d : diaDeCreatedAt(s.created_at);
}

/** Lunes (numero de dia) de la semana de calendario lunes-domingo que contiene `dia`. 1970-01-01 fue jueves. */
export function lunesDe(dia) {
  var dow = ((dia + 4) % 7 + 7) % 7; // 0 = domingo
  return dia - ((dow + 6) % 7);
}

/** ¿dia en [desde, hasta]? Extremos null = sin limite. */
export function enRango(dia, desde, hasta) {
  if (dia == null) return false;
  if (desde != null && dia < desde) return false;
  if (hasta != null && dia > hasta) return false;
  return true;
}
