import { normalizeFecha } from '../../lib/normalizeFecha.js';
import { isCompletedSession, sessionMatchesRoutine } from '../../lib/studentWeeklyProgress.js';
import { countExercisesWithLogToday } from './studentPlanHelpers.js';

/**
 * Estado del entrenamiento de HOY para el alumno. Una sola derivacion, para que
 * hero, banner y mini-header no puedan contradecirse.
 *
 *   SERIES REGISTRADAS != ENTRENAMIENTO COMPLETADO
 *   - `progress` (series) demuestra ACTIVIDAD  -> EN CURSO.
 *   - `sesiones` (fila persistida al FINALIZAR) demuestra FINALIZACION -> COMPLETADO.
 *
 * PRIORIDAD (no es "COMPLETADO siempre gana"):
 *   1. Sin sesion finalizada hoy: EN CURSO si hay actividad de hoy en el dia que
 *      toca; si no, SIN INICIAR.
 *   2. Con sesion finalizada hoy: COMPLETADO, SALVO que haya actividad de hoy en el
 *      dia que toca que la(s) sesion(es) de hoy NO explican (ver
 *      countUnexplainedActivity). En ese caso EN CURSO: es un segundo
 *      entrenamiento del mismo dia (el dia siguiente) empezado y sin finalizar.
 */
export const STUDENT_WORKOUT_STATE = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

function toId(v) {
  return v == null || v === '' ? '' : String(v);
}

/** Semana valida = entero >= 1 (base 1). null/undefined/''/no numerico -> null. */
function parseWeek(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function getRutinaDayCount(rutina) {
  const days = rutina && rutina.datos && Array.isArray(rutina.datos.days)
    ? rutina.datos.days
    : (rutina && Array.isArray(rutina.days) ? rutina.days : []);
  return days.length;
}

/**
 * Sesiones finalizadas de ESTA rutina y de ESTE alumno con semana valida.
 * - Rutina sin `id`: nunca matchea (sessionMatchesRoutine devuelve true si no hay
 *   id; no se puede dejar que "cualquier sesion" cuente).
 * - `alumnoId` informado: la fila DEBE traer el mismo alumno_id. `alumnoId`
 *   omitido (modo compartido de solo lectura): no se filtra por alumno; el
 *   listado ya viene acotado por alumno desde la consulta.
 * - Sesion con `semana` null/undefined/invalida: se descarta (no hay forma de
 *   saber a que semana pertenece).
 */
function relevantSessions(rutina, sesiones, alumnoId) {
  const rutinaId = toId(rutina && rutina.id);
  if (!rutinaId) return [];
  const rutinaNombre = rutina && (rutina.nombre || rutina.name) ? String(rutina.nombre || rutina.name) : '';
  const wantAlumno = toId(alumnoId);
  const list = Array.isArray(sesiones) ? sesiones : [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s || !isCompletedSession(s)) continue;
    if (wantAlumno && toId(s.alumno_id) !== wantAlumno) continue;
    if (!sessionMatchesRoutine(s, rutinaId, rutinaNombre)) continue;
    const sem = parseWeek(s.semana);
    if (sem == null) continue;
    out.push({ raw: s, sem: sem });
  }
  return out;
}

/**
 * Transicion real de semana: la semana `wk - 1` tiene TODOS los dias de la rutina
 * finalizados (dia_idx distintos y validos) y todavia no existe ninguna sesion de
 * la semana `wk`. Es lo que ocurre justo despues de finalizar el ultimo dia: la
 * sesion se guarda con la semana N y semana_activa avanza a N+1.
 * Solo usa `sesiones`; no depende de it_cd.
 */
function isWeekTransition(relevant, rutina, wk) {
  const totalDays = getRutinaDayCount(rutina);
  if (!(totalDays > 0) || wk < 2) return false;
  const doneDays = {};
  for (let i = 0; i < relevant.length; i++) {
    const r = relevant[i];
    if (r.sem === wk) return false;
    if (r.sem === wk - 1) {
      const idx = Number(r.raw.dia_idx);
      if (r.raw.dia_idx != null && Number.isInteger(idx) && idx >= 0 && idx < totalDays) doneDays[idx] = true;
    }
  }
  return Object.keys(doneDays).length >= totalDays;
}

/**
 * Sesiones finalizadas HOY, de la rutina y alumno, con semana vigente (`weekNumber`,
 * base 1) o, solo en la transicion real de semana, la semana anterior.
 * `weekNumber` invalido (no entero >= 1): no se puede confirmar la semana, no hay
 * COMPLETADO. El dia (dia_idx) NO se exige aqui: tras finalizar, el "dia que toca"
 * ya avanzo al siguiente; la distincion entre dias se hace por actividad
 * (countUnexplainedActivity).
 */
export function findTodayFinishedSessions({ rutina, sesiones, hoy, weekNumber, alumnoId }) {
  const wk = parseWeek(weekNumber);
  if (wk == null) return [];
  const relevant = relevantSessions(rutina, sesiones, alumnoId);
  if (!relevant.length) return [];
  const today = normalizeFecha(hoy);
  const transition = isWeekTransition(relevant, rutina, wk);
  return relevant
    .filter(function (r) {
      if (normalizeFecha(r.raw.fecha) !== today) return false;
      return r.sem === wk || (transition && r.sem === wk - 1);
    })
    .map(function (r) { return r.raw; });
}

export function findTodayFinishedSession(params) {
  return findTodayFinishedSessions(params)[0] || null;
}

/** Series de hoy (misma fecha y semana) de un ejercicio; mismo criterio que countExercisesWithLogToday. */
function todaySetsOf(progress, exId, hoy, weekIndex) {
  const sets = (progress && progress[exId] && progress[exId].sets) || [];
  return sets.filter(function (s) {
    return s && s.date === hoy && (s.week === undefined || s.week === weekIndex);
  });
}

/**
 * ids de ejercicio de `sesiones.ejercicios`. buildSessionPayload lo arma como
 * exercises.map(e => e.id).join(",") con exactamente los ids que usa
 * progress[exId]; se parte por "," y se compara por igualdad exacta (nunca por
 * substring). Devuelve null si la fila no trae lista usable.
 */
function parseSessionExerciseIds(session) {
  const raw = session && session.ejercicios;
  if (typeof raw !== 'string') return null;
  const ids = raw.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
  return ids.length ? ids : null;
}

/**
 * Cuantos ejercicios del dia que toca tienen actividad de hoy que las sesiones
 * finalizadas de hoy NO explican. Solo cuenta evidencia demostrable:
 *  a) ejercicio cuyo id NO esta en `ejercicios` de ninguna sesion de hoy: la serie
 *     no pudo pertenecer a esas sesiones -> actividad nueva;
 *  b) ejercicio compartido (su id SI esta en una sesion de hoy): solo cuenta si
 *     alguna serie tiene `created_at` posterior al `created_at` de la ultima sesion
 *     de hoy. `created_at` solo existe en series hidratadas desde Supabase; las
 *     series locales no lo traen y no se inventa. Una serie local de un ejercicio
 *     compartido es indistinguible: NO cuenta (queda COMPLETADO).
 * Si alguna sesion de hoy no trae `ejercicios` usable no se puede atribuir nada:
 * devuelve 0 (se mantiene COMPLETADO).
 */
export function countUnexplainedActivity({ day, progress, hoy, weekIndex, finishedSessions }) {
  if (!day) return 0;
  const covered = {};
  let threshold = -Infinity;
  let thresholdKnown = true;
  for (let i = 0; i < finishedSessions.length; i++) {
    const ids = parseSessionExerciseIds(finishedSessions[i]);
    if (!ids) return 0;
    ids.forEach(function (id) { covered[id] = true; });
    const t = Date.parse(finishedSessions[i].created_at);
    if (Number.isFinite(t)) threshold = Math.max(threshold, t);
    else thresholdKnown = false;
  }
  const dayExercises = [].concat(day.warmup || [], day.exercises || []);
  let unexplained = 0;
  dayExercises.forEach(function (ex) {
    if (!ex || ex.id == null) return;
    const sets = todaySetsOf(progress, ex.id, hoy, weekIndex);
    if (!sets.length) return;
    if (!covered[String(ex.id)]) {
      unexplained++;
      return;
    }
    if (!thresholdKnown) return;
    const afterSession = sets.some(function (s) {
      const t = Date.parse(s.created_at);
      return Number.isFinite(t) && t > threshold;
    });
    if (afterSession) unexplained++;
  });
  return unexplained;
}

/**
 * @param {object} p
 * @param {object} p.rutina       rutina activa (id, nombre/name, days)
 * @param {object|null} p.day     dia que toca (warmup + exercises) o null
 * @param {Array} p.sesiones      filas de `sesiones` del alumno
 * @param {object} p.progress     progress[exId].sets (it_pg + hidratado)
 * @param {string} p.hoy          fecha de hoy es-AR
 * @param {number} p.weekNumber   semana activa, base 1
 * @param {number} p.weekIndex    semana activa, base 0 (la que usan las series)
 * @param {string} [p.alumnoId]
 * @returns {{ state: string, doneExercises: number }}
 *
 * Limites conocidos:
 * - `progreso` no guarda rutina_id ni dia_idx: la actividad se asocia solo por id de
 *   ejercicio contra el dia que toca. Un ejercicio presente en varios dias puede
 *   dar un falso EN CURSO cuando NO hay sesion finalizada hoy.
 * - Con sesion finalizada hoy, actividad del dia siguiente solo en ejercicios
 *   compartidos con el dia ya finalizado y sin created_at (series locales, antes de
 *   recargar) NO se distingue: se mantiene COMPLETADO. Tras recargar, las series
 *   hidratadas traen created_at y si son posteriores a la sesion se detectan.
 * - Una serie de un dia ya finalizado que se sincronice offline DESPUES de la sesion
 *   tendria created_at posterior; solo afecta ejercicios compartidos.
 */
export function getStudentWorkoutState({ rutina, day, sesiones, progress, hoy, weekNumber, weekIndex, alumnoId }) {
  const doneExercises = day ? countExercisesWithLogToday(day, progress, hoy, weekIndex) : 0;
  const finished = findTodayFinishedSessions({ rutina, sesiones, hoy, weekNumber, alumnoId });
  if (finished.length) {
    const unexplained = countUnexplainedActivity({ day, progress, hoy, weekIndex, finishedSessions: finished });
    return {
      state: unexplained > 0 ? STUDENT_WORKOUT_STATE.IN_PROGRESS : STUDENT_WORKOUT_STATE.COMPLETED,
      doneExercises,
    };
  }
  return {
    state: doneExercises > 0 ? STUDENT_WORKOUT_STATE.IN_PROGRESS : STUDENT_WORKOUT_STATE.NOT_STARTED,
    doneExercises,
  };
}
