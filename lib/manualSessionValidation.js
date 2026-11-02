// Validacion MANUAL de un dia por el entrenador: el alumno entreno pero olvido registrar ejercicios / finalizar.
// Reutiliza la persistencia existente: UNA fila en `sesiones` (alumno_id, rutina_id, ciclo, semana, dia_idx) con origen = "validada_coach"
// (el mismo marcador que ya usa la validacion de sesiones huerfanas). NO escribe progreso (series, reps, kg, RPE) ni localStorage, y
// `ejercicios` queda vacio: no se inventa ningun registro.
//
// Reglas (todas deliberadas):
//  - un dia esta completado si hay una fila completada en `sesiones` para (rutina, ciclo vigente, semana, dia_idx), sin importar la fecha:
//    asi un doble clic, otro dispositivo o un cruce de medianoche no duplican el dia, y una sesion real del alumno nunca se pisa;
//  - solo se INSERTA (nunca update/delete): el historial y los datos parciales en `progreso` quedan intactos;
//  - el avance de semana lo decide el mecanismo existente (advanceWeekAfterValidation -> reconcileSemanaActiva).
// Modulo sin React ni Supabase: `sb` se inyecta (ver scripts/test-manualSessionValidation.mjs).

import { readCicloActual, rowInCiclo } from "./rutinaCiclo.js";
import { buildSessionPayload, removeUndefinedPayloadFields } from "./workoutSession.js";
import { isCompletedSession, sessionMatchesRoutine } from "./studentWeeklyProgress.js";
import { isValidInsertedRow } from "./finalizeWorkoutSession.js";
import { ORPHAN_ORIGEN } from "./orphanSessions.js";

export const MANUAL_ORIGEN = ORPHAN_ORIGEN;
const AR_TZ = "America/Argentina/Buenos_Aires";

function routineDays(rutina) {
  return (rutina && rutina.datos && Array.isArray(rutina.datos.days))
    ? rutina.datos.days
    : (rutina && Array.isArray(rutina.days) ? rutina.days : []);
}

function isValidWeek(n) {
  return Number.isInteger(n) && n >= 1 && n <= 4;
}

/** Indices (0-based) de los dias completados de `semana` segun filas de `sesiones` de la rutina vigente y su ciclo. */
export function completedDayIndexesFromRows(rows, rutina, semana) {
  var days = routineDays(rutina);
  var ciclo = readCicloActual(rutina && rutina.datos);
  var rutinaId = rutina && rutina.id != null ? String(rutina.id) : "";
  var rutinaNombre = String((rutina && (rutina.nombre || rutina.name)) || "");
  var seen = {};
  (Array.isArray(rows) ? rows : []).forEach(function (s) {
    if (!s || !isCompletedSession(s) || !rowInCiclo(s, ciclo)) return;
    if (!sessionMatchesRoutine(s, rutinaId, rutinaNombre)) return;
    if (Number(s.semana) !== Number(semana)) return;
    if (s.dia_idx == null || s.dia_idx === "" || typeof s.dia_idx === "boolean") return;
    var idx = Number(s.dia_idx);
    if (Number.isInteger(idx) && idx >= 0 && idx < days.length) seen[idx] = true;
  });
  return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
}

/** Maximo de dias hacia atras que acepta la fecha de una validacion manual. */
export var MANUAL_FECHA_MAX_DIAS = 60;
var DAY_MS = 86400000;

/** "aaaa-mm-dd" de un instante en hora de Argentina ("" si es invalido). */
export function isoDiaAR(value) {
  var d = value instanceof Date ? value : new Date(value);
  if (value == null || value === "" || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Inicio del ciclo vigente (reinicio de rutina o de semana): ISO del ultimo reinicio que abrio el ciclo actual, o null. */
function inicioCicloVigente(datos) {
  var d = datos && typeof datos === "object" ? datos : {};
  var ciclo = readCicloActual(d);
  var at = null;
  if (ciclo > 1) {
    var meta = (Array.isArray(d.ciclos_meta) ? d.ciclos_meta : []).filter(function (m) { return m && Number(m.ciclo) === ciclo; }).pop();
    at = (meta && meta.at) || d.ciclo_reiniciado_at || null;
  }
  // mecanismo anterior de reinicio de semana (sin ciclo nuevo)
  if (d.semana_reiniciada_at && (!at || String(d.semana_reiniciada_at) > String(at))) at = d.semana_reiniciada_at;
  return at;
}

/**
 * D7.2: limites de la fecha del entrenamiento de una validacion manual, en hora de ARGENTINA ("aaaa-mm-dd"), UNICA fuente para el modal
 * y para el guardado. max = hoy; min = el mas reciente entre: hace MANUAL_FECHA_MAX_DIAS dias, la asignacion de la rutina y el inicio del
 * ciclo vigente (un reinicio de rutina o de semana): asi no se guarda en la semana de rutina actual un entrenamiento de un bloque anterior.
 */
export function limitesFechaValidacion(rutina, now) {
  var base = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
  var max = isoDiaAR(base);
  var min = isoDiaAR(new Date(base.getTime() - MANUAL_FECHA_MAX_DIAS * DAY_MS));
  [rutina && rutina.created_at, inicioCicloVigente(rutina && rutina.datos)].forEach(function (v) {
    var iso = v ? isoDiaAR(v) : "";
    if (iso && iso > min) min = iso;
  });
  if (min > max) min = max;
  return { min: min, max: max };
}

/**
 * D7.2: fecha del entrenamiento para una validacion manual. Antes siempre era HOY: validar el lunes lo entrenado la semana pasada
 * inflaba la adherencia de esta semana y dejaba la real vacia. Acepta "d/m/aaaa" (con o sin ceros) dentro de limitesFechaValidacion;
 * devuelve la fecha normalizada sin ceros ("5/10/2026") o null si no es valida.
 */
export function fechaValidacionManual(fecha, rutina, now) {
  var m = String(fecha || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  var dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
  var t = new Date(Date.UTC(yy, mm - 1, dd));
  if (t.getUTCFullYear() !== yy || t.getUTCMonth() !== mm - 1 || t.getUTCDate() !== dd) return null;
  var iso = yy + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
  var lim = limitesFechaValidacion(rutina, now);
  if (iso < lim.min || iso > lim.max) return null;
  return dd + "/" + mm + "/" + yy;
}

/** Payload de `sesiones` para un dia validado a mano. Fecha = la del entrenamiento si es valida (D7.2), si no hoy (Argentina); sin ejercicios, sin hora. */
export function buildManualSessionPayload(params) {
  var p = params || {};
  var rutina = p.rutina;
  var day = routineDays(rutina)[p.diaIdx] || {};
  var now = p.now instanceof Date ? p.now : new Date();
  var hoy = now.toLocaleDateString("es-AR", { timeZone: AR_TZ });
  // D7.2: si se pide una fecha y no es valida se corta (antes se caia a HOY en silencio, justo el defecto a cerrar); sin fecha: hoy.
  var pedida = p.fecha != null && p.fecha !== "";
  var fecha = pedida ? fechaValidacionManual(p.fecha, rutina, now) : hoy;
  if (!fecha) throw new Error("Fecha del entrenamiento invalida");
  var payload = buildSessionPayload({
    alumnoId: p.alumnoId,
    session: { dIdx: p.diaIdx },
    activeDay: day,
    activeRoutine: { id: rutina && rutina.id, name: rutina && (rutina.nombre || rutina.name) },
    exercises: [],
    weekToSave: p.semana,
    date: fecha,
    time: undefined,
    includeRoutineId: true,
    ciclo: readCicloActual(rutina && rutina.datos),
  });
  payload.origen = MANUAL_ORIGEN;
  // D7.2: con fecha pasada, created_at = ese dia a las 12:00 (Argentina), como las huerfanas validadas: la «ultima actividad» y los
  // lectores que usan created_at no lo ven como entrenado hoy. Hoy: created_at del servidor (como antes).
  if (fecha !== hoy) {
    var f = fecha.split("/");
    payload.created_at = f[2] + "-" + String(f[1]).padStart(2, "0") + "-" + String(f[0]).padStart(2, "0") + "T12:00:00-03:00";
  }
  return removeUndefinedPayloadFields(payload);
}

/**
 * Lee las sesiones de la semana (todas, sin limite) y devuelve { rows, completed } (completed = indices de dias completados).
 * Lanza si la lectura falla: el que llama no debe ofrecer validar sin saber que esta completado.
 */
export async function loadWeekCompletion(params) {
  var p = params || {};
  var rutina = p.rutina;
  var rows = await p.sb.getSesionesByAlumnoRutinaSemana(p.alumnoId, rutina.id, rutina.nombre || rutina.name, p.semana);
  if (!Array.isArray(rows)) throw new Error("No se pudieron leer las sesiones del alumno");
  return { rows: rows, completed: completedDayIndexesFromRows(rows, rutina, p.semana) };
}

/**
 * Rutina FRESCA desde la DB (sb.getRutinas). Si el ciclo cambio desde que el entrenador abrio la ficha (reinicio desde otro dispositivo),
 * lanza un error con code "ciclo_cambiado": la validacion se pidio sobre una planificacion que ya no es la vigente.
 */
export async function loadFreshRutinaForValidation(p) {
  var rows = await p.sb.getRutinas(p.alumnoId);
  if (!Array.isArray(rows)) throw new Error("No se pudo leer la rutina del alumno");
  var fresh = rows.find(function (r) { return r && String(r.id) === String(p.rutina.id); });
  if (!fresh) {
    var gone = new Error("La rutina ya no esta asignada a este alumno. Actualiza la ficha.");
    gone.code = "rutina_inexistente";
    throw gone;
  }
  if (readCicloActual(fresh.datos) !== readCicloActual(p.rutina && p.rutina.datos)) {
    var changed = new Error("La rutina fue reiniciada desde otro dispositivo. Actualizamos la ficha: revisa la semana antes de validar.");
    changed.code = "ciclo_cambiado";
    throw changed;
  }
  return fresh;
}

/**
 * Valida (inserta en `sesiones`) un dia pendiente. Devuelve { status: "saved", row } | { status: "exists", rows } (ya estaba completado:
 * no se inserta nada). Lanza ante dia/semana invalidos, error de lectura o insert no confirmado.
 */
export async function validateManualSession(params) {
  var p = params || {};
  var days = routineDays(p.rutina);
  if (!p.rutina || p.rutina.id == null || p.rutina.id === "") throw new Error("Rutina invalida");
  if (!Number.isInteger(p.diaIdx) || p.diaIdx < 0 || p.diaIdx >= days.length) throw new Error("Dia invalido");
  if (!isValidWeek(p.semana)) throw new Error("Semana invalida");
  // Rutina fresca: el ciclo del payload y los dias completados salen de la planificacion VIGENTE en la DB, no de la copia de la pantalla.
  var fresh = await loadFreshRutinaForValidation(p);
  var q = Object.assign({}, p, { rutina: Object.assign({}, p.rutina, { datos: fresh.datos }) });
  var week = await loadWeekCompletion(q);
  if (week.completed.indexOf(q.diaIdx) >= 0) return { status: "exists", rows: week.rows };
  var inserted = await q.sb.addSesion(buildManualSessionPayload(q));
  if (!isValidInsertedRow(inserted)) throw new Error("Supabase no confirmo el guardado de la sesion");
  return { status: "saved", row: inserted[0] };
}

/** Une filas de `sesiones` por id (las nuevas primero), sin duplicar. */
export function mergeSesionesById(prev, incoming) {
  var seen = {};
  return (incoming || []).concat(prev || []).filter(function (s) {
    var k = s && s.id != null ? String(s.id) : null;
    if (k == null) return true;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}
