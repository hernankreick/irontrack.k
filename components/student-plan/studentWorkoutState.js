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
 */
export const STUDENT_WORKOUT_STATE = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

function toId(v) {
  return v == null || v === '' ? '' : String(v);
}

/**
 * Busca la sesion finalizada de hoy: misma rutina (rutina_id, o rutina_nombre si
 * la fila no trae id), misma fecha (normalizada igual que sessionAlreadyExists) y
 * semana vigente.
 *
 * Semana: se acepta `weekNumber` (base 1, la semana activa) o `weekNumber - 1`.
 * finalizarSesion guarda la sesion con la semana ANTERIOR al avance cuando el dia
 * finalizado era el ultimo de la semana y semana_activa avanza en ese mismo
 * momento; sin esa tolerancia el banner no aparecia justo tras cerrar la semana.
 * Una sesion con semana mayor, o dos semanas atras, no cuenta.
 *
 * El dia (dia_idx) NO se exige: tras finalizar, el "dia que toca" ya avanzo al
 * siguiente, y se conserva el criterio actual de un entrenamiento por fecha.
 */
export function findTodayFinishedSession({ rutina, sesiones, hoy, weekNumber, alumnoId }) {
  const rutinaId = toId(rutina && rutina.id);
  const rutinaNombre = rutina && (rutina.nombre || rutina.name) ? String(rutina.nombre || rutina.name) : '';
  const today = normalizeFecha(hoy);
  const wk = Number(weekNumber);
  const wantAlumno = toId(alumnoId);
  const list = Array.isArray(sesiones) ? sesiones : [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s || !isCompletedSession(s)) continue;
    if (wantAlumno && toId(s.alumno_id) && toId(s.alumno_id) !== wantAlumno) continue;
    if (!rutinaId && !rutinaNombre) continue;
    if (!sessionMatchesRoutine(s, rutinaId, rutinaNombre)) continue;
    if (normalizeFecha(s.fecha) !== today) continue;
    const sem = Number(s.semana);
    if (Number.isFinite(wk) && Number.isFinite(sem) && (sem > wk || sem < wk - 1)) continue;
    return s;
  }
  return null;
}

/**
 * @param {object} p
 * @param {object} p.rutina       rutina activa (id, nombre/name)
 * @param {object|null} p.day     dia que toca (warmup + exercises) o null
 * @param {Array} p.sesiones      filas de `sesiones` del alumno
 * @param {object} p.progress     progress[exId].sets (it_pg + hidratado)
 * @param {string} p.hoy          fecha de hoy es-AR
 * @param {number} p.weekNumber   semana activa, base 1
 * @param {number} p.weekIndex    semana activa, base 0 (la que usan las series)
 * @param {string} [p.alumnoId]
 * @returns {{ state: string, doneExercises: number }}
 *
 * Limite conocido: `progreso` no guarda rutina_id ni dia_idx, asi que la
 * actividad se asocia solo por id de ejercicio contra el dia que toca. Si un
 * ejercicio esta en varios dias puede dar un falso EN CURSO; nunca un falso
 * COMPLETADO, porque COMPLETADO solo sale de `sesiones`.
 */
export function getStudentWorkoutState({ rutina, day, sesiones, progress, hoy, weekNumber, weekIndex, alumnoId }) {
  if (findTodayFinishedSession({ rutina, sesiones, hoy, weekNumber, alumnoId })) {
    return { state: STUDENT_WORKOUT_STATE.COMPLETED, doneExercises: 0 };
  }
  const doneExercises = day ? countExercisesWithLogToday(day, progress, hoy, weekIndex) : 0;
  return {
    state: doneExercises > 0 ? STUDENT_WORKOUT_STATE.IN_PROGRESS : STUDENT_WORKOUT_STATE.NOT_STARTED,
    doneExercises,
  };
}
