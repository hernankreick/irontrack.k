// T01.2 — Finalizacion segura de una sesion de entrenamiento del alumno.
//
// Regla: una sesion solo produce efectos de "entrenamiento terminado" (completado local,
// resumen, cierre, avance de semana) cuando hay evidencia confirmada de que quedo
// persistida en `sesiones`. Este modulo solo hace llamadas remotas (inyectadas) y devuelve
// un resultado; los efectos locales los aplica el componente segun ese resultado.
//
// Sin dependencias de React ni de Supabase: `sb` se inyecta (ver scripts/test-finalizeWorkoutSession.mjs).
import { sessionAlreadyExists } from "./workoutSession.js";

export const FINALIZE_FAILURE = {
  OFFLINE: "offline",
  LOOKUP_FAILED: "lookup_failed",
  UNCONFIRMED: "unconfirmed",
};

export const SESSION_CONFIRMED_BY = {
  EXISTING: "existing",
  INSERT: "insert",
  VERIFIED: "verified",
};

export const DEFAULT_FINALIZE_TIMEOUT_MS = 15000;

// Guard de reentrada (doble tap): acquire() devuelve false si ya hay una finalizacion en vuelo.
export function createFinalizeGuard() {
  var busy = false;
  return {
    acquire: function () {
      if (busy) return false;
      busy = true;
      return true;
    },
    release: function () { busy = false; },
    isBusy: function () { return busy; },
  };
}

function withTimeout(promiseFactory, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      reject(new Error("timeout"));
    }, timeoutMs);
    var p;
    try {
      p = Promise.resolve(promiseFactory());
    } catch (e) {
      clearTimeout(timer);
      done = true;
      reject(e);
      return;
    }
    p.then(function (value) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(value);
    }, function (err) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

// sbFetch devuelve null en HTTP no-ok (no lanza); un INSERT valido con
// Prefer: return=representation devuelve un array con la fila.
export function isValidInsertedRow(result) {
  return Array.isArray(result) && result.length > 0 && !!result[0] && typeof result[0] === "object";
}

// Devuelve { found: true|false } o { error: true } si no se pudo consultar (null o excepcion).
async function lookupExisting(sb, alumnoId, ref, timeoutMs) {
  var rows;
  try {
    rows = await withTimeout(function () { return sb.getSesiones(alumnoId); }, timeoutMs);
  } catch (e) {
    return { error: true };
  }
  if (!Array.isArray(rows)) return { error: true };
  return { found: sessionAlreadyExists(rows, ref.date, ref.dayIndex, ref.weekToSave) };
}

/**
 * Persiste la sesion y confirma que existe.
 * 1) GET previo: si ya existe -> confirmada (sin POST).
 *    Si el GET no se puede resolver, NO se hace POST (no se sabe si ya existe; evita duplicar).
 * 2) POST: solo una fila devuelta cuenta como exito (null / array vacio NO).
 * 3) Si el POST falla o es ambiguo (null, error, timeout): GET de comprobacion. Si la fila aparece -> confirmada
 *    (respuesta perdida). Si no, falla reintentable. Nunca se hace un segundo POST en la misma ejecucion.
 */
export async function persistSessionConfirmed(params) {
  var p = params || {};
  var sb = p.sb;
  var timeoutMs = p.timeoutMs != null ? p.timeoutMs : DEFAULT_FINALIZE_TIMEOUT_MS;
  var ref = { date: p.date, dayIndex: p.dayIndex, weekToSave: p.weekToSave };

  if (p.isOnline === false) return { confirmed: false, reason: FINALIZE_FAILURE.OFFLINE };

  var before = await lookupExisting(sb, p.alumnoId, ref, timeoutMs);
  if (before.error) return { confirmed: false, reason: FINALIZE_FAILURE.LOOKUP_FAILED };
  if (before.found) return { confirmed: true, source: SESSION_CONFIRMED_BY.EXISTING };

  var inserted = null;
  try {
    inserted = await withTimeout(function () { return sb.addSesion(p.payload); }, timeoutMs);
  } catch (e) {
    inserted = null;
  }
  if (isValidInsertedRow(inserted)) return { confirmed: true, source: SESSION_CONFIRMED_BY.INSERT };

  var after = await lookupExisting(sb, p.alumnoId, ref, timeoutMs);
  if (after.found) return { confirmed: true, source: SESSION_CONFIRMED_BY.VERIFIED };
  return { confirmed: false, reason: FINALIZE_FAILURE.UNCONFIRMED };
}

/**
 * Dias completados de la semana segun filas persistidas: dia_idx DISTINTOS (los duplicados no inflan)
 * dentro de [0, totalDays). `confirmedDayIdx` (la sesion recien confirmada) siempre cuenta.
 * No usa it_cd.
 */
export function countPersistedDistinctDays(rows, params) {
  var p = params || {};
  var week = Number(p.weekToSave);
  var totalDays = Number(p.totalDays) || 0;
  var seen = {};
  function add(idx) {
    var n = Number(idx);
    if (!Number.isInteger(n) || n < 0 || (totalDays > 0 && n >= totalDays)) return;
    seen[n] = true;
  }
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    if (!row || Number(row.semana) !== week) return;
    if (row.dia_idx == null || row.dia_idx === "") return;
    add(row.dia_idx);
  });
  if (p.confirmedDayIdx != null) add(p.confirmedDayIdx);
  return Object.keys(seen).length;
}

/**
 * Orquestacion remota completa. Resultado:
 *  { status: "failed", reason }
 *  { status: "saved", source, week: { complete, advance } }
 *    advance: "not_needed" | "ok" | "failed" | "unverified"
 *      - not_needed: la semana no esta completa (o ya se avanzo hoy / ultima semana)
 *      - ok: updateRutina confirmo (array no vacio) -> el componente puede avanzar el estado local
 *      - failed: updateRutina devolvio null/vacio/lanzo -> la sesion queda guardada, NO avanzar localmente
 *      - unverified: no se pudieron leer las sesiones de la semana -> no avanzar (reintentar con una recarga)
 * `sb.getSesionesByAlumnoRutinaSemana` lanza ante error (usa el cliente supabase-js).
 */
export async function finalizeStudentSession(params) {
  var p = params || {};
  var sb = p.sb;
  var timeoutMs = p.timeoutMs != null ? p.timeoutMs : DEFAULT_FINALIZE_TIMEOUT_MS;

  var persisted = await persistSessionConfirmed(p);
  if (!persisted.confirmed) return { status: "failed", reason: persisted.reason };

  var result = {
    status: "saved",
    source: persisted.source,
    week: { complete: false, advance: "not_needed" },
  };

  var canAdvance = p.effectiveWeek < 3 && p.lastAdvanceDate !== p.todayStr;
  if (!canAdvance) return result;

  var weekRows;
  try {
    weekRows = await withTimeout(function () {
      return sb.getSesionesByAlumnoRutinaSemana(p.alumnoId, p.rutinaId, p.rutinaNombre, p.weekToSave);
    }, timeoutMs);
  } catch (e) {
    weekRows = null;
  }
  if (!Array.isArray(weekRows)) {
    result.week.advance = "unverified";
    return result;
  }

  var distinct = countPersistedDistinctDays(weekRows, {
    weekToSave: p.weekToSave,
    totalDays: p.totalDays,
    confirmedDayIdx: p.dayIndex,
  });
  result.week.complete = p.totalDays > 0 && distinct >= p.totalDays;
  if (!result.week.complete) return result;

  var updated = null;
  try {
    updated = await withTimeout(function () { return p.updateRutinaWeek(); }, timeoutMs);
  } catch (e) {
    updated = null;
  }
  result.week.advance = Array.isArray(updated) && updated.length > 0 ? "ok" : "failed";
  return result;
}
