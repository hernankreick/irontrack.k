import { normalizeFecha } from '../../lib/normalizeFecha.js';
import { isCompletedSession, sessionMatchesRoutine } from '../../lib/studentWeeklyProgress.js';
import { updateExerciseProgressRecord } from '../../lib/workoutSession.js';
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
 * C2 - Contexto LOCAL del entrenamiento abierto, guardado en cada serie al registrarla.
 *
 * `progreso` no tiene rutina_id ni dia_idx, y un ejercicio puede estar en varios dias:
 * una serie local de un ejercicio compartido no se podia asociar a un dia hasta
 * hidratarse (created_at). logSet solo se ejecuta con un entrenamiento abierto, asi
 * que `session.rId` / `session.dIdx` dicen EN QUE dia se registro. Se guardan en el
 * set como `session_rutina_id` / `session_dia_idx`.
 *
 * Son metadata EXCLUSIVAMENTE local: viven en progress / it_pg. NO viajan a
 * Supabase (buildProgressPayload arma el payload con argumentos explicitos y no
 * hace spread del set) ni a it_pending_sync (buildPendingProgressItem tambien).
 * Series hidratadas y series locales anteriores a este cambio no lo traen.
 *
 * Devuelve null si `session` no es un entrenamiento abierto valido.
 */
export function buildSessionContext(session) {
  if (!session) return null;
  const rutinaId = toId(session.rId);
  const dia = session.dIdx;
  if (!rutinaId || typeof dia !== 'number' || !Number.isInteger(dia) || dia < 0) return null;
  return { session_rutina_id: session.rId, session_dia_idx: dia };
}

/**
 * Igual que updateExerciseProgressRecord, pero marcando el set recien insertado con el
 * contexto de `session`. updateExerciseProgressRecord pasa el set por
 * normalizeWorkoutSet, que reconstruye un objeto de forma fija y descartaria campos
 * extra; por eso el contexto se agrega SOBRE el set ya insertado (indice 0, el mas
 * nuevo) y no se modifica normalizeWorkoutSet ni updateExerciseProgressRecord.
 * Sin `session` valido el resultado es identico a updateExerciseProgressRecord.
 */
export function updateProgressEntryWithSessionContext(currentEntry, newSet, session) {
  const entry = updateExerciseProgressRecord(currentEntry, newSet);
  const ctx = buildSessionContext(session);
  if (!ctx) return entry;
  const sets = entry.sets.slice();
  sets[0] = Object.assign({}, sets[0], ctx);
  return Object.assign({}, entry, { sets: sets });
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
 *  b) ejercicio compartido (su id SI esta en una sesion de hoy): cuenta si
 *       - la serie trae el contexto local C2 (session_rutina_id de ESTA rutina y
 *         session_dia_idx entero) y ese dia NO esta entre los dia_idx de las sesiones
 *         finalizadas de hoy; o
 *       - alguna serie tiene `created_at` posterior al `created_at` de la ultima
 *         sesion de hoy (series hidratadas desde Supabase).
 *     Una serie sin contexto ni created_at (p. ej. serie local anterior a C2 que ya
 *     estaba en it_pg) es indistinguible: NO cuenta (queda COMPLETADO).
 * Si alguna sesion de hoy no trae `ejercicios` usable no se puede atribuir nada:
 * devuelve 0 (se mantiene COMPLETADO).
 */
export function countUnexplainedActivity({ rutina, day, progress, hoy, weekIndex, finishedSessions }) {
  if (!day) return 0;
  const covered = {};
  const finishedDays = {};
  let finishedDaysKnown = true;
  let threshold = -Infinity;
  let thresholdKnown = true;
  for (let i = 0; i < finishedSessions.length; i++) {
    const ids = parseSessionExerciseIds(finishedSessions[i]);
    if (!ids) return 0;
    ids.forEach(function (id) { covered[id] = true; });
    const diaIdx = finishedSessions[i].dia_idx;
    if (diaIdx != null && Number.isInteger(Number(diaIdx))) finishedDays[Number(diaIdx)] = true;
    else finishedDaysKnown = false;
    const t = Date.parse(finishedSessions[i].created_at);
    if (Number.isFinite(t)) threshold = Math.max(threshold, t);
    else thresholdKnown = false;
  }
  const rutinaId = toId(rutina && rutina.id);
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
    // Ejercicio compartido. (A) contexto local C2: la serie dice en que dia se registro; si es
    // de esta rutina y de un dia que NO esta entre los finalizados hoy, es actividad nueva.
    // Un marcador del mismo dia ya finalizado, de otra rutina o invalido no cuenta.
    const byContext = rutinaId && finishedDaysKnown && sets.some(function (s) {
      return toId(s.session_rutina_id) === rutinaId
        && typeof s.session_dia_idx === 'number' && Number.isInteger(s.session_dia_idx) && s.session_dia_idx >= 0
        && !finishedDays[s.session_dia_idx];
    });
    if (byContext) {
      unexplained++;
      return;
    }
    // (B) serie hidratada con created_at posterior a la ultima sesion de hoy.
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
 * - Con sesion finalizada hoy, actividad del dia siguiente en ejercicios compartidos se
 *   distingue por el contexto local C2 (series registradas con esta version) o por
 *   created_at (hidratadas). Series locales ANTERIORES a C2 ya guardadas en it_pg (sin
 *   contexto ni created_at) siguen ambiguas: se mantiene COMPLETADO; no se migran ni se
 *   les infiere contexto.
 * - Una serie de un dia ya finalizado que se sincronice offline DESPUES de la sesion
 *   tendria created_at posterior; solo afecta ejercicios compartidos.
 */
export function getStudentWorkoutState({ rutina, day, sesiones, progress, hoy, weekNumber, weekIndex, alumnoId }) {
  const doneExercises = day ? countExercisesWithLogToday(day, progress, hoy, weekIndex) : 0;
  const finished = findTodayFinishedSessions({ rutina, sesiones, hoy, weekNumber, alumnoId });
  if (finished.length) {
    const unexplained = countUnexplainedActivity({ rutina, day, progress, hoy, weekIndex, finishedSessions: finished });
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

/**
 * Etiquetas del CTA principal segun el estado. UNA sola fuente para el hero del plan y el
 * drawer de bienvenida (WelcomeModal), para que no puedan divergir.
 *   EN CURSO  -> "EN CURSO" / "CONTINUAR ENTRENAMIENTO"
 *   resto     -> "HOY TOCA" / "EMPEZAR"
 * COMPLETADO usa las etiquetas por defecto: el hero del plan no se muestra en ese estado y el
 * drawer conserva su comportamiento anterior (decision funcional pendiente, ver informe).
 */
export function getWorkoutHeroLabels(state, msg) {
  if (state === STUDENT_WORKOUT_STATE.IN_PROGRESS) {
    return {
      badge: msg("EN CURSO", "IN PROGRESS", "EM ANDAMENTO"),
      cta: msg("CONTINUAR ENTRENAMIENTO", "CONTINUE WORKOUT", "CONTINUAR TREINO"),
    };
  }
  return {
    badge: msg("HOY TOCA", "TODAY", "HOJE"),
    cta: msg("EMPEZAR", "START", "COMEÇAR"),
  };
}

/**
 * Estado del dia que se ofrece en el drawer de bienvenida. Mismo criterio que el hero del plan:
 * el dia que toca es days[completedDaysInWeek] (o ninguno si la semana esta completa) y el
 * estado sale de getStudentWorkoutState con la misma semana (weekIndex), sesiones y progress.
 */
export function getStudentWelcomeWorkoutState({ rutina, completedDaysInWeek, weekIndex, sesiones, progress, hoy, alumnoId }) {
  const days = rutina && Array.isArray(rutina.days) ? rutina.days : [];
  const completed = Number(completedDaysInWeek) || 0;
  const day = completed < days.length ? days[completed] : null;
  return getStudentWorkoutState({
    rutina: rutina,
    day: day,
    sesiones: sesiones,
    progress: progress,
    hoy: hoy,
    weekNumber: (Number(weekIndex) || 0) + 1,
    weekIndex: Number(weekIndex) || 0,
    alumnoId: alumnoId,
  });
}
