// Sesiones "huerfanas": el alumno registro series (`progreso`) pero nunca finalizo el entrenamiento, asi que no hay fila en `sesiones`.
// El entrenador puede validarlas desde la ficha del alumno (components/students/StudentOrphanSession.jsx).
//
// Reglas (todas deliberadas):
//  - progreso.semana es 0-based; sesiones.semana es 1-based. La unica conversion es progresoSemanaToSesionSemana.
//  - Series con semana null/invalida NO son validables: se ignoran (CLAUDE.md: cada registro debe tener semana).
//  - Se agrupa por (fecha, semana). Nunca se detecta HOY (el alumno todavia puede finalizar) ni fechas futuras.
//  - Solo series del ciclo vigente y de ejercicios que pertenecen a la rutina.
//  - Este modulo no escribe `progreso` ni usa localStorage; la unica escritura es `sb.addSesion` en validateOrphanSession.
// Modulo sin React ni Supabase: `sb` se inyecta (ver scripts/test-orphanSessions.mjs).

import { normalizeFecha } from "./normalizeFecha.js";
import { parseFechaDMY } from "./progressDate.js";
import { readCicloActual, rowInCiclo } from "./rutinaCiclo.js";
import {
  buildSessionPayload,
  getWorkoutDayExercises,
  removeUndefinedPayloadFields,
  sessionAlreadyExists,
} from "./workoutSession.js";
import { isCompletedSession, sessionMatchesRoutine } from "./studentWeeklyProgress.js";
import { isValidInsertedRow } from "./finalizeWorkoutSession.js";

export const ORPHAN_ORIGEN = "validada_coach";
export const ORPHAN_MAX_AGE_DAYS = 14;
const AR_TZ = "America/Argentina/Buenos_Aires";

/** progreso.semana (0-based, 0..3) -> sesiones.semana (1-based, 1..4). null si no es validable. */
export function progresoSemanaToSesionSemana(n) {
  if (n === null || n === undefined || n === "" || typeof n === "boolean") return null;
  var v = Number(n);
  if (!Number.isInteger(v) || v < 0 || v > 3) return null;
  return v + 1;
}

function arFecha(date) {
  return date.toLocaleDateString("es-AR", { timeZone: AR_TZ });
}

function arHora(date) {
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: AR_TZ });
}

function todayDayNum(now) {
  var d = now instanceof Date ? now : new Date();
  return parseFechaDMY(arFecha(d));
}

function routineDays(rutina) {
  return (rutina && rutina.datos && Array.isArray(rutina.datos.days))
    ? rutina.datos.days
    : (rutina && Array.isArray(rutina.days) ? rutina.days : []);
}

function dayExerciseIds(day) {
  var out = {};
  getWorkoutDayExercises(day).forEach(function (ex) { if (ex && ex.id != null) out[String(ex.id)] = true; });
  return out;
}

function csvIds(value) {
  return String(value || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

/**
 * Dia de la rutina que contiene TODOS los ejercicios dados, solo si es unico. Ambiguo (varios dias) o sin coincidencia => null.
 */
function inferDiaIdx(days, exerciseIds) {
  var candidates = [];
  days.forEach(function (day, idx) {
    var ids = dayExerciseIds(day);
    if (exerciseIds.every(function (id) { return ids[id]; })) candidates.push(idx);
  });
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * @param {object} p
 * @param {Array}  p.progreso  filas de `progreso` del alumno (select=*: usa ejercicio_id, kg, reps, nota, fecha, semana, ciclo, created_at)
 * @param {Array}  p.sesiones  filas de `sesiones` del alumno
 * @param {object} p.rutina    rutina vigente del alumno (id, nombre, datos.days, datos.ciclo_actual)
 * @param {*}     [p.alumnoId] si se pasa, ignora series de otros alumnos
 * @param {Date}  [p.now]
 * @param {number}[p.maxAgeDays]  antiguedad maxima (default 14): evita que historial viejo, previo a `sesiones`, quede como huerfano para siempre
 * @returns {Array<{key, fecha, semanaSesion, diaIdxSugerido, ejercicios, sets, ultimoSetISO}>} la fecha mas reciente primero
 */
export function detectOrphanSessions(p) {
  var params = p || {};
  var rutina = params.rutina;
  if (!rutina) return [];
  var days = routineDays(rutina);
  if (!days.length) return [];
  var ciclo = readCicloActual(rutina.datos);
  var rutinaId = rutina.id != null ? String(rutina.id) : "";
  var rutinaNombre = String(rutina.nombre || rutina.name || "");
  var today = todayDayNum(params.now);
  var maxAge = params.maxAgeDays != null ? params.maxAgeDays : ORPHAN_MAX_AGE_DAYS;
  var alumnoId = params.alumnoId != null && params.alumnoId !== "" ? String(params.alumnoId) : "";

  var routineIds = {};
  days.forEach(function (day) { Object.assign(routineIds, dayExerciseIds(day)); });

  var sesiones = (Array.isArray(params.sesiones) ? params.sesiones : []).filter(function (s) {
    return s && isCompletedSession(s) && sessionMatchesRoutine(s, rutinaId, rutinaNombre) && rowInCiclo(s, ciclo);
  });

  var groups = {};
  var order = [];
  (Array.isArray(params.progreso) ? params.progreso : []).forEach(function (row) {
    if (!row || row.ejercicio_id == null) return;
    if (alumnoId && row.alumno_id != null && String(row.alumno_id) !== alumnoId) return;
    var semanaSesion = progresoSemanaToSesionSemana(row.semana);
    if (semanaSesion == null) return;
    if (!rowInCiclo(row, ciclo)) return;
    var rawFecha = String(row.fecha || "").trim();
    var day = parseFechaDMY(rawFecha);
    if (day == null || day >= today || today - day > maxAge) return;
    if (!routineIds[String(row.ejercicio_id)]) return;
    var key = normalizeFecha(rawFecha) + "|" + semanaSesion;
    if (!groups[key]) {
      groups[key] = { key: key, fecha: rawFecha, day: day, semanaSesion: semanaSesion, ejercicios: [], sets: [], lastMs: null };
      order.push(key);
    }
    var g = groups[key];
    var exId = String(row.ejercicio_id);
    if (g.ejercicios.indexOf(exId) < 0) g.ejercicios.push(exId);
    g.sets.push({ ejercicio_id: exId, kg: row.kg, reps: row.reps, nota: row.nota || "", created_at: row.created_at || null });
    // Solo vale el timestamp real: created_at de ESE dia (una serie offline sincronizada dias despues trae el de la sincronizacion).
    var ms = row.created_at ? new Date(row.created_at).getTime() : NaN;
    if (Number.isFinite(ms) && parseFechaDMY(arFecha(new Date(ms))) === day && (g.lastMs == null || ms > g.lastMs)) g.lastMs = ms;
  });

  var out = [];
  order.forEach(function (key) {
    var g = groups[key];
    var diaIdx = inferDiaIdx(days, g.ejercicios);
    var covered;
    if (diaIdx != null && sessionAlreadyExists(sesiones, g.fecha, diaIdx, g.semanaSesion, ciclo)) {
      covered = true;
    } else {
      // Sin dia unico: cualquier sesion de esa fecha y semana la cubre. Con dia: tambien la cubre una sesion que ya lista todos sus ejercicios.
      covered = sesiones.some(function (s) {
        if (normalizeFecha(s.fecha) !== normalizeFecha(g.fecha) || Number(s.semana) !== g.semanaSesion) return false;
        if (diaIdx == null) return true;
        var listed = csvIds(s.ejercicios);
        return listed.length > 0 && g.ejercicios.every(function (id) { return listed.indexOf(id) >= 0; });
      });
    }
    if (covered) return;
    out.push({
      key: key,
      fecha: g.fecha,
      semanaSesion: g.semanaSesion,
      diaIdxSugerido: diaIdx,
      ejercicios: g.ejercicios,
      sets: g.sets,
      ultimoSetISO: g.lastMs != null ? new Date(g.lastMs).toISOString() : null,
      _day: g.day,
    });
  });
  out.sort(function (a, b) { return b._day - a._day; });
  return out.map(function (o) { delete o._day; return o; });
}

/** true si la sesion la registro el entrenador con "Validar" (no la finalizo el alumno). */
export function isCoachValidatedSession(s) {
  return !!s && s.origen === ORPHAN_ORIGEN;
}

/**
 * detectOrphanSessions + confirmacion contra la DB. Las sesiones que tiene la pantalla estan acotadas (getSesiones: limit 10; lista global:
 * ultimas 500 del roster), asi que con rosters grandes una sesion ya finalizada puede faltar y parecer huerfana. Por cada semana candidata se
 * leen TODAS las sesiones de esa semana (getSesionesByAlumnoRutinaSemana, sin limite) y se vuelve a detectar con ellas.
 * Lanza si alguna lectura falla: el que llama no debe mostrar avisos sin confirmar.
 */
export async function confirmOrphanSessions(params) {
  var p = params || {};
  var candidates = detectOrphanSessions(p);
  if (!candidates.length) return [];
  var weeks = [];
  candidates.forEach(function (o) { if (weeks.indexOf(o.semanaSesion) < 0) weeks.push(o.semanaSesion); });
  var rutina = p.rutina;
  var fetched = [];
  for (var i = 0; i < weeks.length; i++) {
    var rows = await p.sb.getSesionesByAlumnoRutinaSemana(p.alumnoId, rutina.id, rutina.nombre || rutina.name, weeks[i]);
    if (!Array.isArray(rows)) throw new Error("No se pudieron leer las sesiones del alumno");
    fetched = fetched.concat(rows);
  }
  return detectOrphanSessions(Object.assign({}, p, { sesiones: (Array.isArray(p.sesiones) ? p.sesiones : []).concat(fetched) }));
}

/** hora de la sesion validada: la del ultimo set si hay timestamp real; si no, null. */
export function orphanHora(orphan) {
  if (!orphan || !orphan.ultimoSetISO) return null;
  var d = new Date(orphan.ultimoSetISO);
  return Number.isFinite(d.getTime()) ? arHora(d) : null;
}

/** created_at de la sesion validada: timestamp del ultimo set; si no, la fecha del huerfano a las 12:00 (-03:00). Nunca "ahora". */
export function orphanCreatedAt(orphan) {
  if (orphan && orphan.ultimoSetISO) return orphan.ultimoSetISO;
  var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(orphan && orphan.fecha || "").trim());
  if (!m) throw new Error("fecha del huerfano invalida");
  var pad = function (n) { return String(n).padStart(2, "0"); };
  return m[3] + "-" + pad(m[2]) + "-" + pad(m[1]) + "T12:00:00-03:00";
}

/**
 * Payload de `sesiones` para validar un huerfano. Fecha y semana son las del huerfano (nunca las de hoy).
 */
export function buildOrphanSessionPayload(params) {
  var p = params || {};
  var orphan = p.orphan;
  var rutina = p.rutina;
  var days = routineDays(rutina);
  var day = days[p.diaIdx] || {};
  var payload = buildSessionPayload({
    alumnoId: p.alumnoId,
    session: { dIdx: p.diaIdx },
    activeDay: day,
    activeRoutine: { id: rutina && rutina.id, name: rutina && (rutina.nombre || rutina.name) },
    exercises: orphan.ejercicios.map(function (id) { return { id: id }; }),
    weekToSave: orphan.semanaSesion,
    date: orphan.fecha,
    time: orphanHora(orphan),
    includeRoutineId: true,
    ciclo: readCicloActual(rutina && rutina.datos),
  });
  payload.origen = ORPHAN_ORIGEN;
  payload.created_at = orphanCreatedAt(orphan);
  return removeUndefinedPayloadFields(payload);
}

/**
 * Valida (inserta en `sesiones`) un huerfano. NO escribe progreso ni localStorage.
 * Devuelve { status: "saved", row } | { status: "exists", rows } (ya habia una sesion equivalente: no se duplica; rows = sesiones leidas).
 * Lanza ante dia invalido, error de lectura o insert no confirmado: el que llama debe mostrar el error.
 * `sb`: getSesionesByAlumnoRutinaSemana (lanza ante error) y addSesion (sbFetch: devuelve null en HTTP no-ok).
 */
export async function validateOrphanSession(params) {
  var p = params || {};
  var days = routineDays(p.rutina);
  if (!Number.isInteger(p.diaIdx) || p.diaIdx < 0 || p.diaIdx >= days.length) throw new Error("Dia invalido");
  var orphan = p.orphan;
  var ciclo = readCicloActual(p.rutina && p.rutina.datos);
  var existing = await p.sb.getSesionesByAlumnoRutinaSemana(
    p.alumnoId, p.rutina.id, p.rutina.nombre || p.rutina.name, orphan.semanaSesion
  );
  if (!Array.isArray(existing)) throw new Error("No se pudieron leer las sesiones del alumno");
  if (sessionAlreadyExists(existing, orphan.fecha, p.diaIdx, orphan.semanaSesion, ciclo)) return { status: "exists", rows: existing };
  var payload = buildOrphanSessionPayload(p);
  var inserted = await p.sb.addSesion(payload);
  if (!isValidInsertedRow(inserted)) throw new Error("Supabase no confirmo el guardado de la sesion");
  return { status: "saved", row: inserted[0] };
}

/**
 * Tras validar (o detectar que ya existia), corre el MISMO chequeo de semana que el alumno al abrir la app y el coach al tocar VER
 * (sb.reconcileSemanaActivaAlumno): si con la sesion validada la semana de la rutina queda completa, semana_activa avanza (monotono,
 * idempotente). Nunca lanza: la sesion ya esta guardada y un fallo aca solo deja el avance para la proxima apertura de la ficha.
 * Devuelve { status: "advanced", rutinaId, semanaActiva } | { status: "noop" | "incomplete" | "failed" | "invalid" | "unavailable", ... }.
 */
export async function advanceWeekAfterValidation(params) {
  var p = params || {};
  if (!p.sb || typeof p.sb.reconcileSemanaActivaAlumno !== "function") return { status: "unavailable" };
  try {
    var res = await p.sb.reconcileSemanaActivaAlumno(p.alumnoId, [p.rutina], "coach_validar");
    return res && typeof res === "object" ? res : { status: "failed" };
  } catch (e) {
    return { status: "failed" };
  }
}
