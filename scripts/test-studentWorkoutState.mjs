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
  findTodayFinishedSessions,
  countUnexplainedActivity,
} from "../components/student-plan/studentWorkoutState.js";
import { hydrateProgressFromRows, buildExerciseSetRecord, updateExerciseProgressRecord } from "../lib/workoutSession.js";
import { countExercisesWithLogToday } from "../components/student-plan/studentPlanHelpers.js";

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
// Forma real de una fila de `sesiones` (buildSessionPayload + created_at de Supabase):
// `ejercicios` son los ids del dia finalizado (warmup + principal) unidos por coma.
const SES_CREATED = "2026-10-01T15:00:00Z";
const ses = (over) => Object.assign(
  { alumno_id: "a1", rutina_id: "r1", rutina_nombre: "Rutina A", dia_idx: 0, semana: WEEK_NUM, fecha: HOY,
    ejercicios: "mov,bp,row", created_at: SES_CREATED },
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

test("H2: transicion real (ultimo dia de la semana N-1 finalizado hoy, ninguna sesion de la semana N) -> COMPLETADO", () => {
  const sesiones = [ses({ dia_idx: 0, semana: WEEK_NUM - 1, fecha: AYER }), ses({ dia_idx: 1, semana: WEEK_NUM - 1 })];
  assert.equal(state({ sesiones }), S.COMPLETED);
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


// ---------------------------------------------------------------------------
// T01.1A ajuste H1 / H2 / H3
// ---------------------------------------------------------------------------

const press = { id: "press" }, row = { id: "row" }, curl = { id: "curl" };
const dia1 = { exercises: [press, row] };            // Dia 1: Press + Remo
const dia2 = { exercises: [press, curl] };           // Dia 2: Press + Curl (Press compartido)
const rutinaPC = { id: "r1", name: "Rutina A", days: [dia1, dia2] };
const sesDia1 = (over) => ses(Object.assign({ dia_idx: 0, ejercicios: "press,row", semana: WEEK_NUM }, over || {}));
const stateDia2 = (over) => getStudentWorkoutState(Object.assign({
  rutina: rutinaPC, day: dia2, sesiones: [], progress: {}, hoy: HOY, weekNumber: WEEK_NUM, weekIndex: WEEK_IDX, alumnoId: "a1",
}, over || {})).state;

// serie LOCAL real: la arma logSet con buildExerciseSetRecord -> created_at undefined
const localProgress = (id, n) => {
  let entry;
  for (let i = 0; i < (n || 1); i++) entry = updateExerciseProgressRecord(entry, buildExerciseSetRecord(60, 10, HOY, WEEK_IDX, "", null));
  return { [id]: entry };
};
// serie HIDRATADA real: hydrateProgressFromRows trae created_at de Supabase
const hydrated = (rows) => hydrateProgressFromRows(rows.map((r) => ({
  ejercicio_id: r.id, kg: 60, reps: 10, fecha: HOY, semana: WEEK_IDX, nota: "", created_at: r.at,
})));
const BEFORE = "2026-10-01T14:00:00Z";   // anterior a SES_CREATED
const AFTER = "2026-10-01T16:00:00Z";    // posterior a SES_CREATED

test("H1: Dia 1 finalizado hoy + actividad del Dia 2 (ejercicio NO compartido) sin finalizar -> EN CURSO", () => {
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: localProgress("curl") }), S.IN_PROGRESS);
});

test("H1 (rutina de los tests originales): Dia 1 finalizado hoy + series de ejercicios solo del Dia 2 -> EN CURSO", () => {
  const sesiones = [ses({ dia_idx: 0, ejercicios: "mov,bp,row" })];
  assert.equal(state({ day: otherDay, sesiones, progress: progressWith({ sq: [setOf(HOY, WEEK_IDX)] }) }), S.IN_PROGRESS);
});

test("H1 sin actividad posterior: Dia 1 finalizado hoy + Dia 2 sin series -> COMPLETADO", () => {
  assert.equal(stateDia2({ sesiones: [sesDia1()] }), S.COMPLETED);
});

test("H1 + compartido: serie LOCAL (sin created_at) solo de Press compartido -> no se puede distinguir -> COMPLETADO (limite documentado)", () => {
  const progress = localProgress("press", 2);
  assert.equal(progress.press.sets[0].created_at, undefined);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress }), S.COMPLETED);
});

test("H1 + compartido: serie HIDRATADA de Press POSTERIOR a la sesion -> EN CURSO", () => {
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: hydrated([{ id: "press", at: AFTER }]) }), S.IN_PROGRESS);
});

test("H1 + compartido: serie HIDRATADA de Press ANTERIOR a la sesion (la del Dia 1) -> COMPLETADO", () => {
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: hydrated([{ id: "press", at: BEFORE }]) }), S.COMPLETED);
});

test("H1 + compartido: Press hidratado de antes + Curl local (no compartido) -> EN CURSO", () => {
  const progress = Object.assign({}, hydrated([{ id: "press", at: BEFORE }]), localProgress("curl"));
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress }), S.IN_PROGRESS);
});

test("H1 + compartido sin sesion de hoy: Press local da EN CURSO (limite conocido) y nunca COMPLETADO", () => {
  assert.equal(stateDia2({ sesiones: [], progress: localProgress("press") }), S.IN_PROGRESS);
});

test("H1: ids se comparan por igualdad exacta, no por substring ('bpx' no cubre 'bp')", () => {
  const sesiones = [ses({ ejercicios: "bpx,row", dia_idx: 0 })];
  assert.equal(state({ sesiones, progress: progressWith({ bp: [setOf(HOY, WEEK_IDX)] }) }), S.IN_PROGRESS);
  const sesiones2 = [ses({ ejercicios: " mov , bp ,row", dia_idx: 0 })];
  assert.equal(state({ sesiones: sesiones2, progress: progressWith({ bp: [setOf(HOY, WEEK_IDX)] }) }), S.COMPLETED);
});

test("H1: sesion de hoy sin `ejercicios` usable -> no se puede atribuir nada -> COMPLETADO", () => {
  const progress = localProgress("curl");
  assert.equal(stateDia2({ sesiones: [sesDia1({ ejercicios: null })], progress }), S.COMPLETED);
  assert.equal(stateDia2({ sesiones: [sesDia1({ ejercicios: "" })], progress }), S.COMPLETED);
  assert.equal(stateDia2({ sesiones: [sesDia1({ ejercicios: undefined })], progress }), S.COMPLETED);
});

test("H1: varias sesiones de hoy: los ejercicios de todas explican la actividad; uno nuevo no", () => {
  const dia3 = { exercises: [{ id: "curl" }, { id: "tric" }] };
  const sesiones = [sesDia1(), sesDia1({ dia_idx: 1, ejercicios: "press,curl", created_at: "2026-10-01T15:30:00Z" })];
  assert.equal(stateDia2({ day: dia3, sesiones, progress: localProgress("curl") }), S.COMPLETED);
  assert.equal(stateDia2({ day: dia3, sesiones, progress: localProgress("tric") }), S.IN_PROGRESS);
});

test("H1: sesion de hoy sin created_at valido -> serie hidratada de ejercicio compartido no se puede ordenar -> COMPLETADO", () => {
  const sesiones = [sesDia1({ created_at: null })];
  assert.equal(stateDia2({ sesiones, progress: hydrated([{ id: "press", at: AFTER }]) }), S.COMPLETED);
  assert.equal(stateDia2({ sesiones, progress: localProgress("curl") }), S.IN_PROGRESS);
});

test("doneExercises coincide con countExercisesWithLogToday (mismo criterio de actividad)", () => {
  const progress = Object.assign({}, localProgress("press"), localProgress("curl"));
  const r = getStudentWorkoutState({ rutina: rutinaPC, day: dia2, sesiones: [], progress, hoy: HOY, weekNumber: WEEK_NUM, weekIndex: WEEK_IDX, alumnoId: "a1" });
  assert.equal(r.doneExercises, countExercisesWithLogToday(dia2, progress, HOY, WEEK_IDX));
  assert.equal(r.doneExercises, 2);
});

test("H2: sesion de hoy de la semana N-1 SIN transicion real (faltan dias de esa semana) -> NO COMPLETADO", () => {
  // solo el Dia 1 de 2 hecho en la semana anterior y el entrenador subio semana_activa
  const sesiones = [ses({ dia_idx: 0, semana: WEEK_NUM - 1 })];
  assert.equal(state({ sesiones }), S.NOT_STARTED);
  const progress = progressWith({ bp: [setOf(HOY, WEEK_IDX)] });
  assert.equal(state({ sesiones, progress }), S.IN_PROGRESS);
});

test("H2: dia_idx repetido en la semana N-1 no completa la semana", () => {
  const sesiones = [ses({ dia_idx: 0, semana: WEEK_NUM - 1, fecha: AYER }), ses({ dia_idx: 0, semana: WEEK_NUM - 1 })];
  assert.equal(state({ sesiones }), S.NOT_STARTED);
});

test("H2: ya existe una sesion de la semana N -> no hay transicion; la sesion N-1 de hoy no cuenta", () => {
  const sesiones = [
    ses({ dia_idx: 0, semana: WEEK_NUM - 1, fecha: AYER }),
    ses({ dia_idx: 1, semana: WEEK_NUM - 1 }),
    ses({ dia_idx: 0, semana: WEEK_NUM, fecha: AYER }),
  ];
  assert.equal(state({ sesiones }), S.NOT_STARTED);
});

test("H2: semana N-1 completa pero la sesion del ultimo dia es de AYER -> no es 'hoy' -> NO COMPLETADO", () => {
  const sesiones = [ses({ dia_idx: 0, semana: WEEK_NUM - 1, fecha: AYER }), ses({ dia_idx: 1, semana: WEEK_NUM - 1, fecha: AYER })];
  assert.equal(state({ sesiones }), S.NOT_STARTED);
});

test("H2: la transicion no se apoya en it_cd ni en otras rutinas (sesiones de otra rutina no completan la semana)", () => {
  const sesiones = [
    ses({ dia_idx: 0, semana: WEEK_NUM - 1, fecha: AYER, rutina_id: "r2", rutina_nombre: "Otra" }),
    ses({ dia_idx: 1, semana: WEEK_NUM - 1 }),
  ];
  assert.equal(state({ sesiones }), S.NOT_STARTED);
});

test("H2: semana 1 no admite semana 0 como transicion", () => {
  const sesiones = [ses({ dia_idx: 0, semana: 0 }), ses({ dia_idx: 1, semana: 0 })];
  assert.equal(state({ sesiones, weekNumber: 1, weekIndex: 0 }), S.NOT_STARTED);
});

test("H3: rutina sin id -> nunca COMPLETADO (ni por nombre ni con sesiones de otras rutinas)", () => {
  const sinId = { name: "Rutina A", days: [day, otherDay] };
  assert.equal(state({ rutina: sinId, sesiones: [ses()] }), S.NOT_STARTED);
  assert.equal(state({ rutina: sinId, sesiones: [ses({ rutina_id: "zzz", rutina_nombre: "Otra" })] }), S.NOT_STARTED);
  assert.equal(state({ rutina: sinId, sesiones: [ses({ rutina_id: null })] }), S.NOT_STARTED);
  assert.equal(findTodayFinishedSession({ rutina: { name: "R" }, sesiones: [ses()], hoy: HOY, weekNumber: WEEK_NUM }), null);
});

test("H3: sesion con semana null -> no cuenta (ni con weekNumber 1 ni con 2)", () => {
  assert.equal(state({ sesiones: [ses({ semana: null })] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [ses({ semana: null })], weekNumber: 1, weekIndex: 0 }), S.NOT_STARTED);
});

test("H3: sesion con semana undefined / '' / no numerica -> no cuenta", () => {
  assert.equal(state({ sesiones: [ses({ semana: undefined })] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [ses({ semana: "" })] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [ses({ semana: "abc" })] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [ses({ semana: 1.5 })] }), S.NOT_STARTED);
});

test("sesiones con entradas null/undefined dentro del array: sin crash y sin COMPLETADO", () => {
  assert.equal(state({ sesiones: [null, undefined, 0] }), S.NOT_STARTED);
  assert.equal(state({ sesiones: [null, ses()] }), S.COMPLETED);
});

test("alumnoId omitido (modo compartido solo lectura): no se filtra por alumno; informado: la fila DEBE coincidir", () => {
  const other = ses({ alumno_id: "a2" });
  assert.equal(state({ alumnoId: undefined, sesiones: [other] }), S.COMPLETED);
  assert.equal(state({ alumnoId: "a1", sesiones: [other] }), S.NOT_STARTED);
  const sinAlumno = ses({ alumno_id: undefined });
  assert.equal(state({ alumnoId: undefined, sesiones: [sinAlumno] }), S.COMPLETED);
  assert.equal(state({ alumnoId: "a1", sesiones: [sinAlumno] }), S.NOT_STARTED);
});

test("weekNumber invalido (NaN, 0, negativo, decimal, texto, null, undefined) -> no se confirma la semana -> nunca COMPLETADO", () => {
  [NaN, 0, -1, 1.5, "x", null, undefined].forEach((w) => {
    assert.equal(state({ weekNumber: w, sesiones: [ses()] }), S.NOT_STARTED, "weekNumber=" + String(w));
  });
  assert.equal(state({ weekNumber: "2", sesiones: [ses()] }), S.COMPLETED); // numerico en string si es entero valido
});

test("secuencia: SIN INICIAR -> EN CURSO -> COMPLETADO -> nuevo dia EN CURSO", () => {
  let progress = {};
  let sesiones = [];
  assert.equal(stateDia2({ rutina: rutinaPC, day: dia1, sesiones, progress }), S.NOT_STARTED);
  progress = localProgress("press");
  assert.equal(stateDia2({ rutina: rutinaPC, day: dia1, sesiones, progress }), S.IN_PROGRESS);
  progress = Object.assign({}, progress, localProgress("row"));
  assert.equal(stateDia2({ rutina: rutinaPC, day: dia1, sesiones, progress }), S.IN_PROGRESS);
  sesiones = [sesDia1()];                                  // FINALIZAR guardo la sesion; el dia que toca pasa a ser el Dia 2
  assert.equal(stateDia2({ day: dia2, sesiones, progress }), S.COMPLETED);   // press local compartido: sin created_at, no se distingue
  progress = Object.assign({}, progress, localProgress("curl"));
  assert.equal(stateDia2({ day: dia2, sesiones, progress }), S.IN_PROGRESS); // actividad nueva del Dia 2
});

test("countUnexplainedActivity: sin dia -> 0; sin sesiones -> 0", () => {
  assert.equal(countUnexplainedActivity({ day: null, progress: {}, hoy: HOY, weekIndex: WEEK_IDX, finishedSessions: [ses()] }), 0);
  assert.equal(countUnexplainedActivity({ day: dia2, progress: localProgress("curl"), hoy: HOY, weekIndex: WEEK_IDX, finishedSessions: [] }), 1);
});

test("findTodayFinishedSessions devuelve todas las sesiones de hoy validas", () => {
  const sesiones = [sesDia1(), sesDia1({ dia_idx: 1 }), sesDia1({ fecha: AYER })];
  assert.equal(findTodayFinishedSessions({ rutina: rutinaPC, sesiones, hoy: HOY, weekNumber: WEEK_NUM, alumnoId: "a1" }).length, 2);
});

console.log(count + " tests OK");
