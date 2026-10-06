// Reconciliacion de rutinas.datos.semana_activa a partir de `sesiones` (fuente de verdad del avance).
//
// Problema: una rutina puede quedar con semana_activa null o atrasada aunque TODOS los dias de la semana W ya esten finalizados
// (avance viejo rechazado por la DB, guardado del entrenador que borro el campo, PATCH fallido...). Con 4/4 dias en semana W y
// semana_activa vieja la UI no ofrece ningun dia y el avance solo se evalua al finalizar un dia => callejon.
//
// Reglas (todas deliberadas):
//  - solo sesiones con rutina_id IGUAL al de la rutina (nunca por nombre, nunca por fechas, nunca por created_at, nunca por `progreso`);
//  - dia_idx DISTINTOS y validos (0..cantidad real de dias - 1) por semana; la cantidad de dias sale de datos.days FRESCO;
//  - solo semanas 1..3 avanzan automaticamente (la semana 4 nunca pasa a 5);
//  - nunca retrocede: si la semana persistida ya es >= destino, no hace nada; la escritura es monotona (updateRutinaSemanaActiva);
//  - idempotente: despues de escribir, una segunda corrida no hace nada;
//  - si las sesiones no se pudieron leer COMPLETAS (error, pagina rota, tope de paginas) NO escribe;
//  - no depende de localStorage.

import { updateRutinaSemanaActiva } from "./updateRutinaSemanaActiva.js";
import { readSemanaActiva } from "./rutinaOperationalState.js";

export const SESSIONS_PAGE_SIZE = 1000;
export const SESSIONS_MAX_PAGES = 20;
export const MAX_AUTO_ADVANCE_WEEK = 3; // semanas 1..3 avanzan; la 4 es la ultima

function isCompletedSession(s) {
  return !(s && (s.estado === "pendiente" || s.completada === false));
}

function routineDayCount(datos) {
  return datos && Array.isArray(datos.days) ? datos.days.length : 0;
}

/**
 * Semana destino derivada de las sesiones. Pura.
 *  datos: rutinas.datos FRESCO (days, semana_activa); sesiones: filas de `sesiones`; rutinaId: id de la rutina.
 * Devuelve { target: number|null, completeWeek: number|null, persisted: number|null, reason }.
 *  target = completeWeek + 1 solo si supera a la semana persistida; si no, null.
 */
export function deriveSemanaActivaTarget({ datos, sesiones, rutinaId, alumnoId }) {
  var persisted = readSemanaActiva(datos);
  var totalDays = routineDayCount(datos);
  if (!rutinaId || !(totalDays > 0)) return { target: null, completeWeek: null, persisted: persisted, reason: "sin_dias_o_rutina" };
  var rid = String(rutinaId);
  var aid = alumnoId != null && alumnoId !== "" ? String(alumnoId) : "";
  var daysByWeek = {};
  (Array.isArray(sesiones) ? sesiones : []).forEach(function (s) {
    if (!s || !isCompletedSession(s)) return;
    if (s.rutina_id == null || s.rutina_id === "" || String(s.rutina_id) !== rid) return;
    if (aid && s.alumno_id != null && s.alumno_id !== "" && String(s.alumno_id) !== aid) return;
    var week = Number(s.semana);
    if (!Number.isInteger(week) || week < 1 || week > MAX_AUTO_ADVANCE_WEEK) return;
    var raw = s.dia_idx;
    if (raw == null || raw === "") return;
    var idx = Number(raw);
    if (!Number.isInteger(idx) || idx < 0 || idx >= totalDays) return;
    (daysByWeek[week] = daysByWeek[week] || {})[idx] = true;
  });
  var completeWeek = null;
  Object.keys(daysByWeek).forEach(function (k) {
    var w = Number(k);
    if (Object.keys(daysByWeek[k]).length >= totalDays && (completeWeek == null || w > completeWeek)) completeWeek = w;
  });
  if (completeWeek == null) return { target: null, completeWeek: null, persisted: persisted, reason: "semana_incompleta" };
  var target = completeWeek + 1;
  if (persisted != null && persisted >= target) return { target: null, completeWeek: completeWeek, persisted: persisted, reason: "ya_avanzada" };
  return { target: target, completeWeek: completeWeek, persisted: persisted, reason: "avanzar" };
}

/**
 * Lee TODAS las sesiones de la rutina de a SESSIONS_PAGE_SIZE.
 *  fetchSesionesPage({ rutinaId, alumnoId, from, to }) -> Promise<array> (debe lanzar o devolver no-array ante error).
 * Devuelve { complete, rows }. complete=false si alguna pagina falla o se alcanza el tope sin una pagina corta.
 */
export async function fetchAllSesionesDeRutina(fetchSesionesPage, rutinaId, alumnoId, opts) {
  var o = opts || {};
  var pageSize = o.pageSize || SESSIONS_PAGE_SIZE;
  var maxPages = o.maxPages || SESSIONS_MAX_PAGES;
  var rows = [];
  if (typeof fetchSesionesPage !== "function") return { complete: false, rows: rows };
  for (var page = 0; page < maxPages; page++) {
    var data;
    try {
      data = await fetchSesionesPage({ rutinaId: rutinaId, alumnoId: alumnoId, from: page * pageSize, to: page * pageSize + pageSize - 1 });
    } catch (e) {
      return { complete: false, rows: rows };
    }
    if (!Array.isArray(data)) return { complete: false, rows: rows };
    for (var i = 0; i < data.length; i++) rows.push(data[i]);
    if (data.length < pageSize) return { complete: true, rows: rows };
  }
  return { complete: false, rows: rows };
}

/**
 * Reconciliacion completa. Resultado:
 *  { status: "advanced", from, to }   se persistio semana_activa = to
 *  { status: "noop", reason }         nada que hacer (incluye ya avanzada / semana incompleta / plantilla)
 *  { status: "incomplete" }           no se pudieron verificar las sesiones: NO se escribio
 *  { status: "failed" }               no se pudo leer la rutina o la escritura no se confirmo
 *  { status: "invalid" }              argumentos invalidos
 * `client` es el cliente supabase-js (inyectado).
 */
export async function reconcileSemanaActiva({ client, rutinaId, alumnoId, fetchSesionesPage }) {
  var id = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
  if (!client || !id) return { status: "invalid" };

  var read;
  try {
    read = await client.from("rutinas").select("datos, es_plantilla").eq("id", id);
  } catch (e) {
    return { status: "failed" };
  }
  if (!read || read.error || !Array.isArray(read.data)) return { status: "failed" };
  if (read.data.length === 0) return { status: "noop", reason: "rutina_inexistente" };
  var row = read.data[0] || {};
  if (row.es_plantilla === true) return { status: "noop", reason: "plantilla" };
  var datos = row.datos;
  if (!datos || typeof datos !== "object" || Array.isArray(datos)) return { status: "failed" };

  var all = await fetchAllSesionesDeRutina(fetchSesionesPage, id, alumnoId);
  if (!all.complete) return { status: "incomplete" };

  var derived = deriveSemanaActivaTarget({ datos: datos, sesiones: all.rows, rutinaId: id, alumnoId: alumnoId });
  if (derived.target == null) return { status: "noop", reason: derived.reason };

  var written;
  try {
    written = await updateRutinaSemanaActiva(client, id, derived.target);
  } catch (e) {
    written = null;
  }
  if (!Array.isArray(written) || written.length === 0) return { status: "failed" };
  // `to` = semana realmente persistida (si otro proceso ya la habia llevado mas lejos, updateRutinaSemanaActiva no retrocede).
  var persistedNow = readSemanaActiva(written[0] && written[0].datos);
  return { status: "advanced", from: derived.persisted, to: persistedNow != null ? persistedNow : derived.target };
}
