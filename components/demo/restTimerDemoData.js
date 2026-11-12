// Demostración del temporizador de descanso (demo/temporizador-descanso.html, PR #183): datos y lógica pura, testeable en node.
// Datos FICTICIOS (dos alumnos inventados). Sin base de datos remota, sin login, sin red, sin almacenamiento del navegador.
// NO hay un parser paralelo: la pausa se interpreta con lib/restPause.js (resolveRestSeconds), la prescripción semanal con
// lib/workoutSession.js (resolveExerciseForWeek) y la vista Plan con parsePauseSeconds, exactamente como en producción.
//
//   node scripts/test-demoTemporizadorDescanso.mjs
import { resolveRestSeconds } from '../../lib/restPause.js';
import { resolveExerciseForWeek } from '../../lib/workoutSession.js';
import { parsePauseSeconds } from '../student-plan/studentPlanHelpers.js';

export const DEMO_CICLO = 1;
export const DEMO_SEMANA = 0;

const ej = (id, name, pause, extra) => Object.assign({ id, name, sets: 4, reps: '10', kg: '20', pause, weeks: [], pattern: 'empuje', note: '' }, extra || {});

export const DEMO_ALUMNOS = [
  {
    id: 'hernan-demo',
    nombre: 'Hernán (demo)',
    detalle: 'Rutina con pausas numéricas',
    ejercicios: [
      ej('h-banca', 'Press de banca', 60),
      ej('h-sentadilla', 'Sentadilla', 90, { pattern: 'rodilla' }),
      ej('h-remo', 'Remo con barra', 120, { pattern: 'traccion' }),
      ej('h-curl', 'Curl de bíceps (pausa 0)', 0, { pattern: 'traccion' }),
    ],
  },
  {
    id: 'catalina-demo',
    nombre: 'Catalina (demo)',
    detalle: 'Rutina nueva con pausas en texto',
    ejercicios: [
      ej('c-goblet', 'Sentadilla goblet', '90s', { pattern: 'rodilla' }),
      ej('c-militar', 'Press militar', '1:30'),
      ej('c-remo', 'Remo en polea', '2 min', { pattern: 'traccion' }),
      ej('c-hip', 'Hip thrust', '1,5 min', { pattern: 'bisagra' }),
      ej('c-rdl', 'Peso muerto rumano (semana 1 pisa la base)', 60, { pattern: 'bisagra', weeks: [{ pausa: '2 min' }] }),
      ej('c-plancha', 'Plancha (pausa "0")', '0', { pattern: 'core' }),
      ej('c-vacia', 'Elevaciones laterales (pausa "1,5" inválida)', '1,5'),
    ],
  },
];

/**
 * Lo que ve el panel real para un ejercicio de la rutina: la misma resolución que WorkoutScreen.jsx (resolveExerciseForWeek) y la misma
 * interpretación que WorkoutExercisePanel.jsx (resolveRestSeconds). `inicia` = el panel arrancará el temporizador al registrar una serie.
 */
export function interpretarPausa(ejercicio, semanaIdx) {
  const resuelto = resolveExerciseForWeek(ejercicio, semanaIdx == null ? DEMO_SEMANA : semanaIdx);
  const semanaDefine = !!(resuelto && ejercicio && Array.isArray(ejercicio.weeks) && ejercicio.weeks[semanaIdx == null ? DEMO_SEMANA : semanaIdx]
    && ejercicio.weeks[semanaIdx == null ? DEMO_SEMANA : semanaIdx].pausa);
  const segundos = resolveRestSeconds(resuelto.pause);
  return {
    original: ejercicio.pause,
    semana: semanaDefine ? ejercicio.weeks[semanaIdx == null ? DEMO_SEMANA : semanaIdx].pausa : null,
    resuelta: resuelto.pause,
    segundos,
    plan: parsePauseSeconds(resuelto.pause),
    inicia: segundos > 0,
  };
}

/** Texto legible del valor original ("90" número, "90s" texto, vacío). */
export function mostrarValor(v) {
  if (v === undefined) return 'sin dato';
  if (v === null) return 'null';
  if (typeof v === 'string') return v === '' ? '"" (vacío)' : '"' + v + '"';
  return String(v) + ' (número)';
}
