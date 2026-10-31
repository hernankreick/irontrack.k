// D6.1 (H13) — Identidad por EPISODIO de las alertas de seguimiento del entrenador.
//
// Antes, las alertas de seguimiento usaban una clave fija por alumno ("in-<id>", "wk-<id>", "rutina-terminada-<a>-<r>-w3"). Una vez
// leida (CoachNotificationCenter guarda "real-<key>" en localStorage y en coach_notification_reads), un episodio NUEVO del mismo problema
// generaba la misma clave y quedaba leido: el entrenador no recibia el aviso.
//
// Reglas (deterministas, sin aleatorios ni la fecha de cada render; iguales en todos los dispositivos porque salen de datos guardados):
//   Inactivo         "in-<alumnoId>-d<ultimoDiaActividad|nunca>"
//   Poca actividad   "wk-<alumnoId>-d<ultimoDiaActividad|nunca>"
//                    El ultimo dia de actividad no cambia mientras dura el episodio (no hay actividad nueva). Cuando el alumno vuelve a
//                    entrenar sale de la condicion; si mas adelante vuelve a caer, su ultimo dia de actividad es otro => clave nueva.
//   Rutina terminada "rutina-terminada-<alumnoId>-<rutinaId>-c<ciclo>"
//                    Un episodio por rutina y ciclo (datos.ciclo_actual). La deteccion (semana 4) no cambia aqui (D6.3).
//   Sin rutina       "sr-<alumnoId>" (SIN CAMBIOS, limitacion documentada): quitar o reasignar una rutina la borra sin dejar rastro y
//                    no existe un registro de bajas, asi que no hay historial que permita distinguir episodios sin inventar recurrencias.
// Modulo puro: sin React ni Supabase.

import { dayNum, diaDeCreatedAt, diaDeSesion, parseFechaDMY } from "../../lib/metricas/index.js";
import { readCicloActual } from "../../lib/rutinaCiclo.js";

function diaDeRegistro(r) {
  if (!r) return null;
  var d = parseFechaDMY(r.fecha);
  if (d != null) return d;
  var iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(r.fecha || ""));
  if (iso) return dayNum(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  return diaDeCreatedAt(r.created_at);
}

/**
 * Ultimo dia de actividad del alumno (numero de dia de calendario, lib/metricas/fechas.js): la fecha mas reciente entre sus filas de
 * `sesiones` y sus registros de `progreso` (los mismos datos que usa la categoria activo/inactivo). null si nunca tuvo actividad.
 * Usa la fecha d/m/yyyy guardada (no depende de la zona horaria del dispositivo); created_at solo como respaldo.
 */
export function ultimoDiaActividad(alumnoId, sesiones, progresoGlobal) {
  var aid = String(alumnoId);
  var best = null;
  (Array.isArray(sesiones) ? sesiones : []).forEach(function (s) {
    if (!s || String(s.alumno_id) !== aid) return;
    var d = diaDeSesion(s);
    if (d != null && (best == null || d > best)) best = d;
  });
  var regs = (progresoGlobal && (progresoGlobal[aid] || progresoGlobal[alumnoId])) || [];
  regs.forEach(function (r) {
    var d = diaDeRegistro(r);
    if (d != null && (best == null || d > best)) best = d;
  });
  return best;
}

function marca(ultimoDia) {
  return "-d" + (ultimoDia == null ? "nunca" : String(ultimoDia));
}

export function claveInactivo(alumnoId, ultimoDia) {
  return "in-" + alumnoId + marca(ultimoDia);
}

export function clavePocaActividad(alumnoId, ultimoDia) {
  return "wk-" + alumnoId + marca(ultimoDia);
}

export function claveSinRutina(alumnoId) {
  return "sr-" + alumnoId;
}

export function claveRutinaTerminada(alumnoId, rutinaId, rutina) {
  return "rutina-terminada-" + alumnoId + "-" + rutinaId + "-c" + readCicloActual(rutina && rutina.datos);
}

/** Lecturas tras «Marcar todas»: las anteriores MAS las visibles, sin duplicados ni vacios (no descarta lecturas previas). */
export function unirLeidos(previos, nuevos) {
  var out = [];
  var seen = {};
  [].concat(previos || [], nuevos || []).forEach(function (id) {
    var k = id != null ? String(id) : "";
    if (!k || seen[k]) return;
    seen[k] = true;
    out.push(k);
  });
  return out;
}
