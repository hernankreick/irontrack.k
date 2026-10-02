// Pruebas de components/student-plan/studentWorkoutState.js (T01.1A): estado del
// entrenamiento de hoy del alumno. SERIES REGISTRADAS != ENTRENAMIENTO COMPLETADO.
//
//   node scripts/test-studentWorkoutState.mjs
//
// Igual que test-mergeProgressEntries.mjs: sin dependencias nuevas, node:assert,
// sale con codigo != 0 en el primer fallo.

import assert from "node:assert/strict";
import {
  STUDENT_WORKOUT_STATE as S,
  getStudentWorkoutState,
  findTodayFinishedSession,
} from "../components/student-plan/studentWorkoutState.js";
import { hydrateProgressFromRows } from "../lib/workoutSession.js";

let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("ok - " + name);
}

const HOY = "1/10/2026";
const AYER = "30/9/2026";
const WEEK_IDX = 1; // semana 2 (base 0) -> weekNumber 2 (base 1)
const WEEK_NUM = 2;

const day = { warmup: [{ id: "mov" }], exercises: [{ id: "bp", sets: "3" }, { id: "row", sets: "3" }] };
const otherDay = { exercises: [{ id: "sq" }, { id: "dl" }] };
const sharedDay = { exercises: [{ id: "bp" }, { id: "curl" }] }; // comparte "bp" con `day`
const rutina = { id: "r1", name: "Rutina A", days: [day, otherDay] };

const setOf = (date, week) => ({ kg: 60, reps: 10, date, week });
const progressWith = (map) => {
  const out = {};
  Object.keys(map).forEach((id) => { out[id] = { sets: map[id], max: 60 }; });
  return out;
};
const ses = (over) => Object.assign(
  { alumno_id: "a1", rutina_id: "r1", rutina_nombre: "Rutina A", dia_idx: 0, semana: WEEK_NUM, fecha: HOY },
  over || {}
);
const state = (over) => getStudentWorkoutState(Object.assign({
  rutina, day, sesiones: [], progress: {}, hoy: HOY, weekNumber: WEEK_NUM, weekIndex: WEEK_IDX, alumnoId: "a1",
}, over || {})).state;

test("A: 0 series + 0 sesion -> SIN INICIAR", () => {
  assert.equal(state(), S.NOT_STARTED);
});

test("B: 1 serie del dia actual + 0 sesion -> EN CURSO (nunca COMPLETADO)", () => {
  const progress = progressWith({ bp: [setOf(HOY, WEEK_IDX)] });
  assert.equal(state({ progress }), S.IN_PROGRESS);
});

test("C: varias series parciales + 0 sesion -> EN CURSO", () => {
  const progress = progressWith({ bp: [setOf(HOY, WEEK_IDX), setOf(HOY, WEEK_IDX)] });
  assert.equal(state({ progress }), S.IN_PROGRESS);
});

test("D: >=1 serie en cada ejercicio + 0 sesion -> EN CURSO (aunque FINALIZAR este habilitado)", () => {
  const progress = progressWith({
    mov: [setOf(HOY, WEEK_IDX)], bp: [setOf(HOY, WEEK_IDX)], row: [setOf(HOY, WEEK_IDX)],
  });
  const r = getStudentWorkoutState({ rutina, day, sesiones: [], progress, hoy: HOY, weekNumber: WEEK_NUM, weekIndex: WEEK_IDX, alumnoId: "a1" });
  assert.equal(r.state, S.IN_PROGRESS);
  assert.equal(r.doneExercises, 3);
});

test("E: sesion correspondiente existente -> COMPLETADO", () => {
  assert.equal(state({ sesiones: [ses()] }), S.COMPLETED);
});

test("F: sesion de otro dia (fecha de ayer) -> NO COMPLETADO", () => {
  assert.equal(state({ sesiones: [ses({ fecha: AYER })] }), S.NOT_STARTED);
});

test("F2: sesion de hoy de OTRO dia_idx de la misma rutina -> COMPLETADO (un entrenamiento por fecha; el dia que toca ya avanzo)", () => {
  assert.equal(state({ sesiones: [ses({ dia_idx: 1 })] }), S.COMPLETED);
});

test("G: sesion de otra rutina -> NO COMPLETADO", () => {
  assert.equal(state({ sesiones: [ses({ rutina_id: "r2", rutina_nombre: "Rutina B" })] }), S.NOT_STARTED);
});

test("G2: sesion sin rutina_id que coincide por rutina_nombre -> COMPLETADO; con otro nombre -> NO", () => {
  assert.equal(state({ sesiones: [ses({ rutina_id: null })] }), S.COMPLETED);
  assert.equal(state({ sesiones: [ses({ rutina_id: null, rutina_nombre: "Otra" })] }), S.NOT_STARTED);
});

test("H: sesion de otra semana -> NO COMPLETADO", () => {
  assert.equal(state({ sesiones: [ses({ semana: WEEK_NUM + 1 })] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [ses({ semana: WEEK_NUM - 2 })] }), S.NOT_STARTED);
});

test("H2: sesion de hoy guardada con la semana anterior (el ultimo dia avanza semana_activa) -> COMPLETADO", () => {
  assert.equal(state({ sesiones: [ses({ semana: WEEK_NUM - 1 })] }), S.COMPLETED);
});

test("I: actividad en un ejercicio que NO pertenece al dia actual -> NO es EN CURSO", () => {
  const progress = progressWith({ sq: [setOf(HOY, WEEK_IDX)], dl: [setOf(HOY, WEEK_IDX)] });
  assert.equal(state({ progress }), S.NOT_STARTED);
});

test("J: ejercicio compartido entre dias -> puede dar EN CURSO (limite conocido), nunca COMPLETADO sin sesion", () => {
  // bp esta en `day` y en `sharedDay`; la serie no dice a que dia pertenece.
  const progress = progressWith({ bp: [setOf(HOY, WEEK_IDX)] });
  assert.equal(state({ progress, day }), S.IN_PROGRESS);
  assert.equal(state({ progress, day: sharedDay }), S.IN_PROGRESS);
  assert.notEqual(state({ progress, day: sharedDay }), S.COMPLETED);
});

test("K: COMPLETADO + series presentes -> COMPLETADO tiene prioridad", () => {
  const progress = progressWith({ bp: [setOf(HOY, WEEK_IDX)], row: [setOf(HOY, WEEK_IDX)] });
  assert.equal(state({ progress, sesiones: [ses()] }), S.COMPLETED);
});

test("series de otra fecha o de otra semana no cuentan como actividad de hoy", () => {
  assert.equal(state({ progress: progressWith({ bp: [setOf(AYER, WEEK_IDX)] }) }), S.NOT_STARTED);
  assert.equal(state({ progress: progressWith({ bp: [setOf(HOY, WEEK_IDX + 1)] }) }), S.NOT_STARTED);
});

test("serie sin week (dato legacy) de hoy cuenta como actividad", () => {
  assert.equal(state({ progress: progressWith({ bp: [{ kg: 50, reps: 8, date: HOY }] }) }), S.IN_PROGRESS);
});

test("ejercicio de entrada en calor (warmup) con serie cuenta como actividad", () => {
  assert.equal(state({ progress: progressWith({ mov: [setOf(HOY, WEEK_IDX)] }) }), S.IN_PROGRESS);
});

test("sesion pendiente (estado/completada=false) no cuenta como finalizada", () => {
  assert.equal(state({ sesiones: [ses({ estado: "pendiente" })] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [ses({ completada: false })] }), S.NOT_STARTED);
});

test("sesion de otro alumno no cuenta; fecha con/sin cero a la izquierda coincide", () => {
  assert.equal(state({ sesiones: [ses({ alumno_id: "a2" })] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [ses({ fecha: "01/10/2026" })] }), S.COMPLETED);
});

test("sesiones vacio/null/undefined (fallo de carga) nunca da COMPLETADO", () => {
  assert.equal(state({ sesiones: null }), S.NOT_STARTED);
  assert.equal(state({ sesiones: undefined }), S.NOT_STARTED);
  const progress = progressWith({ bp: [setOf(HOY, WEEK_IDX)] });
  assert.equal(state({ sesiones: null, progress }), S.IN_PROGRESS);
});

test("sin dia que toca (semana completa) y sin sesion de hoy -> SIN INICIAR; con sesion de hoy -> COMPLETADO", () => {
  assert.equal(state({ day: null }), S.NOT_STARTED);
  assert.equal(state({ day: null, sesiones: [ses()] }), S.COMPLETED);
});

test("sin rutina identificable no hay COMPLETADO", () => {
  assert.equal(findTodayFinishedSession({ rutina: {}, sesiones: [ses()], hoy: HOY, weekNumber: WEEK_NUM }), null);
});

test("RELOAD / LOGIN: progress hidratado desde filas de `progreso` + sesiones recargadas dan el mismo estado", () => {
  const rows = [{ ejercicio_id: "bp", kg: 60, reps: 10, fecha: HOY, semana: WEEK_IDX, nota: "", created_at: "2026-10-01T15:00:00Z" }];
  const hydrated = hydrateProgressFromRows(rows);
  // solo series (sin it_cd, sin sesion): EN CURSO
  assert.equal(state({ progress: hydrated, sesiones: [] }), S.IN_PROGRESS);
  // con la sesion finalizada persistida: COMPLETADO, sin depender de it_cd
  assert.equal(state({ progress: hydrated, sesiones: [ses()] }), S.COMPLETED);
});

console.log(count + " tests OK");
