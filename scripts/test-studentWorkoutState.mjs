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
  buildSessionContext,
  updateProgressEntryWithSessionContext,
  getWorkoutHeroLabels,
  getStudentWelcomeWorkoutState,
} from "../components/student-plan/studentWorkoutState.js";
import {
  hydrateProgressFromRows, buildExerciseSetRecord, updateExerciseProgressRecord,
  mergeProgressEntries, buildProgressPayload, buildPendingProgressItem,
} from "../lib/workoutSession.js";
import { readFileSync } from "node:fs";
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


// ---------------------------------------------------------------------------
// T01.1A ajuste C2: contexto local (session_rutina_id / session_dia_idx) en cada serie
// ---------------------------------------------------------------------------

const SESSION_DIA1 = { rId: "r1", dIdx: 0, exIdx: 0, startTime: 1 };   // forma real de `session`
const SESSION_DIA2 = { rId: "r1", dIdx: 1, exIdx: 0, startTime: 2 };
// Igual que logSet: set construido con buildExerciseSetRecord y registrado dentro de la `session` abierta.
const logLocal = (progress, exId, session, n) => {
  const out = Object.assign({}, progress);
  for (let i = 0; i < (n || 1); i++) {
    out[exId] = updateProgressEntryWithSessionContext(
      out[exId], buildExerciseSetRecord(60, 10, HOY, WEEK_IDX, "", null), session);
  }
  return out;
};

test("C2 forma del set: sets locales marcados traen session_rutina_id y session_dia_idx; el resto del set no cambia", () => {
  const entry = logLocal({}, "press", SESSION_DIA2).press;
  const set = entry.sets[0];
  assert.deepEqual(Object.keys(set).sort(),
    ["created_at", "date", "kg", "note", "reps", "rpe", "session_dia_idx", "session_rutina_id", "week"].sort());
  assert.equal(set.session_rutina_id, "r1");
  assert.equal(set.session_dia_idx, 1);
  assert.equal(set.created_at, undefined);
  const plain = updateExerciseProgressRecord(undefined, buildExerciseSetRecord(60, 10, HOY, WEEK_IDX, "", null)).sets[0];
  const { session_rutina_id, session_dia_idx, ...rest } = set;
  assert.deepEqual(rest, plain);
  assert.equal(entry.max, 60);
});

test("C2 el set nuevo queda al frente y los anteriores no se tocan", () => {
  const p1 = logLocal({}, "press", SESSION_DIA1);
  const p2 = logLocal(p1, "press", SESSION_DIA2);
  assert.equal(p2.press.sets.length, 2);
  assert.equal(p2.press.sets[0].session_dia_idx, 1);
  assert.equal(p2.press.sets[1].session_dia_idx, 0);
  assert.equal(p2.press.sets[1], p1.press.sets[0]);
});

test("C2 caso 7: set registrado sin session valida mantiene forma y resultado anteriores", () => {
  const plain = updateExerciseProgressRecord(undefined, buildExerciseSetRecord(60, 10, HOY, WEEK_IDX, "", null));
  [null, undefined, {}, { rId: "r1" }, { dIdx: 0 }, { rId: "", dIdx: 0 }, { rId: "r1", dIdx: -1 },
   { rId: "r1", dIdx: 1.5 }, { rId: "r1", dIdx: "1" }, { rId: "r1", dIdx: NaN }].forEach((sess) => {
    const entry = updateProgressEntryWithSessionContext(undefined, buildExerciseSetRecord(60, 10, HOY, WEEK_IDX, "", null), sess);
    assert.deepEqual(entry, plain, "session=" + JSON.stringify(sess));
    assert.ok(!("session_dia_idx" in entry.sets[0]) && !("session_rutina_id" in entry.sets[0]));
  });
  assert.equal(buildSessionContext(null), null);
  assert.deepEqual(buildSessionContext(SESSION_DIA2), { session_rutina_id: "r1", session_dia_idx: 1 });
  // sin session el estado se comporta como antes (ambiguo -> COMPLETADO)
  const progress = { press: plain };
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress }), S.COMPLETED);
});

test("C2 caso 1: Dia 1 finalizado + set LOCAL compartido (Press) marcado Dia 2 -> EN CURSO inmediato", () => {
  const progress = logLocal({}, "press", SESSION_DIA2);
  assert.equal(progress.press.sets[0].created_at, undefined);   // sin hidratar
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress }), S.IN_PROGRESS);
});

test("C2 caso 2: Dia 1 finalizado + set LOCAL compartido marcado Dia 1 -> COMPLETADO", () => {
  const progress = logLocal({}, "press", SESSION_DIA1, 3);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress }), S.COMPLETED);
});

test("C2 mezcla: sets del Dia 1 (compartido) + un set nuevo del Dia 2 -> EN CURSO; solo los del Dia 1 -> COMPLETADO", () => {
  const p1 = logLocal({}, "press", SESSION_DIA1, 2);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: p1 }), S.COMPLETED);
  const p2 = logLocal(p1, "press", SESSION_DIA2);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: p2 }), S.IN_PROGRESS);
});

test("C2 caso 3: marcador de OTRA rutina no se usa para inferir actividad nueva", () => {
  const otra = { rId: "r2", dIdx: 1, exIdx: 0, startTime: 3 };
  const progress = logLocal({}, "press", otra);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress }), S.COMPLETED);
  // y sin rutina en la llamada directa tampoco hay inferencia
  assert.equal(countUnexplainedActivity({ day: dia2, progress: logLocal({}, "press", SESSION_DIA2), hoy: HOY, weekIndex: WEEK_IDX, finishedSessions: [sesDia1()] }), 0);
});

test("C2 marcadores invalidos escritos a mano (string, negativo, decimal) no cuentan", () => {
  const base = logLocal({}, "press", SESSION_DIA2);
  [ "1", -1, 1.5, null, undefined ].forEach((v) => {
    const sets = base.press.sets.map((s) => Object.assign({}, s, { session_dia_idx: v }));
    assert.equal(stateDia2({ sesiones: [sesDia1()], progress: { press: { sets, max: 60 } } }), S.COMPLETED, String(v));
  });
});

test("C2: si una sesion finalizada de hoy no trae dia_idx valido no se usa el marcador (queda conservador)", () => {
  const progress = logLocal({}, "press", SESSION_DIA2);
  assert.equal(stateDia2({ sesiones: [sesDia1({ dia_idx: null })], progress }), S.COMPLETED);
});

test("C2: con varias sesiones de hoy, el marcador de un dia ya finalizado hoy esta explicado; uno distinto no", () => {
  const dia3 = { exercises: [{ id: "press" }, { id: "tric" }] };
  const sesiones = [sesDia1(), sesDia1({ dia_idx: 1, ejercicios: "press,curl", created_at: "2026-10-01T15:30:00Z" })];
  assert.equal(stateDia2({ day: dia3, sesiones, progress: logLocal({}, "press", SESSION_DIA2) }), S.COMPLETED);
  assert.equal(stateDia2({ day: dia3, sesiones, progress: logLocal({}, "press", { rId: "r1", dIdx: 2, exIdx: 0, startTime: 3 }) }), S.IN_PROGRESS);
});

test("C2 caso 4: set local SIN marcador (legacy en it_pg) conserva el comportamiento anterior", () => {
  const legacy = { press: { sets: [{ kg: 60, reps: 10, date: HOY, week: WEEK_IDX, note: "", rpe: null }], max: 60 } };
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: legacy }), S.COMPLETED);
});

test("C2 caso 5/6: hidratado con created_at posterior -> EN CURSO; anterior -> no es actividad nueva", () => {
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: hydrated([{ id: "press", at: AFTER }]) }), S.IN_PROGRESS);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: hydrated([{ id: "press", at: BEFORE }]) }), S.COMPLETED);
});

test("C2 caso 8: los campos sobreviven al almacenamiento local (JSON de it_pg) y siguen dando EN CURSO", () => {
  const progress = logLocal({}, "press", SESSION_DIA2);
  const restored = JSON.parse(JSON.stringify(progress));
  assert.equal(restored.press.sets[0].session_rutina_id, "r1");
  assert.equal(restored.press.sets[0].session_dia_idx, 1);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: restored }), S.IN_PROGRESS);
});

test("C2 caso 9: los campos NO llegan a Supabase (payload remoto y cola offline)", () => {
  const payload = buildProgressPayload("a1", "press", 60, 10, "", HOY, WEEK_IDX);
  assert.deepEqual(Object.keys(payload).sort(), ["alumno_id", "ejercicio_id", "fecha", "kg", "nota", "reps", "semana"]);
  const pending = buildPendingProgressItem("press", 60, 10, "", HOY, WEEK_IDX);
  assert.deepEqual(Object.keys(pending).sort(), ["date", "exId", "kg", "note", "reps", "semana"]);
  assert.ok(!JSON.stringify(payload).includes("session_") && !JSON.stringify(pending).includes("session_"));
  // el POST de logSet usa buildProgressPayload con argumentos explicitos, no el set
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("sb.addProgreso(buildProgressPayload(alumnoIdSync, exId, kg, reps, note, d, weekForSet))"));
  assert.ok(!/addProgreso\([^)]*newSet/.test(app));
  const lib = readFileSync(new URL("../lib/workoutSession.js", import.meta.url), "utf8");
  assert.ok(!lib.includes("session_dia_idx") && !lib.includes("session_rutina_id"));
});

test("C2 caso 10: merge/dedupe no cambia la identidad logica de kg/reps/date/week/note", () => {
  const key = (s) => JSON.stringify([s.kg, s.reps, s.date, s.week, s.note]);
  const localCtx = logLocal({}, "press", SESSION_DIA2, 2).press;
  const localPlain = { sets: localCtx.sets.map((s) => { const { session_dia_idx, session_rutina_id, ...r } = s; return r; }), max: localCtx.max };
  const hyd = hydrated([{ id: "press", at: AFTER }]).press;       // 1 fila servidor con la misma clave
  const withCtx = mergeProgressEntries(localCtx, hyd);
  const without = mergeProgressEntries(localPlain, hyd);
  assert.deepEqual(withCtx.sets.map(key), without.sets.map(key));
  assert.equal(withCtx.sets.length, 2);                            // 2 locales + 1 hidratada empareja 1 -> 2
  assert.equal(withCtx.max, without.max);
  // la copia hidratada reemplaza a la local solapada (pierde marcador, gana created_at); la sobrante local lo conserva
  assert.equal(withCtx.sets.filter((s) => s.created_at).length, 1);
  assert.equal(withCtx.sets.filter((s) => s.session_dia_idx === 1).length, 1);
  // despues de la hidratacion el caso sigue resolviendose (por created_at o por marcador)
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: { press: withCtx } }), S.IN_PROGRESS);
});

test("C2 caso 10b: copia hidratada que reemplaza a la local pierde el marcador pero conserva created_at -> sigue EN CURSO", () => {
  const local = logLocal({}, "press", SESSION_DIA2).press;
  const merged = mergeProgressEntries(local, hydrated([{ id: "press", at: AFTER }]).press);
  assert.equal(merged.sets.length, 1);
  assert.equal(merged.sets[0].session_dia_idx, undefined);
  assert.ok(merged.sets[0].created_at);
  assert.equal(stateDia2({ sesiones: [sesDia1()], progress: { press: merged } }), S.IN_PROGRESS);
});

test("C2 caso 11: secuencia completa NOT_STARTED -> Dia 1 EN CURSO -> Dia 1 COMPLETADO -> Dia 2 set local compartido -> Dia 2 EN CURSO", () => {
  let progress = {};
  assert.equal(stateDia2({ day: dia1, sesiones: [], progress }), S.NOT_STARTED);
  progress = logLocal(progress, "press", SESSION_DIA1);
  assert.equal(stateDia2({ day: dia1, sesiones: [], progress }), S.IN_PROGRESS);
  progress = logLocal(progress, "row", SESSION_DIA1);
  assert.equal(stateDia2({ day: dia1, sesiones: [], progress }), S.IN_PROGRESS);
  const sesiones = [sesDia1()];                                              // FINALIZAR guarda la sesion del Dia 1
  assert.equal(stateDia2({ day: dia2, sesiones, progress }), S.COMPLETED);   // Press del Dia 1 marcado Dia 1: no es actividad nueva
  progress = logLocal(progress, "press", SESSION_DIA2);                      // Dia 2, Press compartido, set local
  assert.equal(stateDia2({ day: dia2, sesiones, progress }), S.IN_PROGRESS);
  // reload (it_pg) y misma conclusion
  assert.equal(stateDia2({ day: dia2, sesiones, progress: JSON.parse(JSON.stringify(progress)) }), S.IN_PROGRESS);
});


// ---------------------------------------------------------------------------
// T01.1A-bis: el drawer de bienvenida usa la misma fuente de verdad que el hero del plan
// ---------------------------------------------------------------------------

const msgEs = (es) => es;
const msgEn = (es, en) => en;
const msgPt = (es, en, pt) => pt;

test("T01.1A-bis 1: SIN INICIAR -> HOY TOCA / EMPEZAR", () => {
  assert.deepEqual(getWorkoutHeroLabels(S.NOT_STARTED, msgEs), { badge: "HOY TOCA", cta: "EMPEZAR" });
  assert.deepEqual(getWorkoutHeroLabels(S.NOT_STARTED, msgEn), { badge: "TODAY", cta: "START" });
  assert.deepEqual(getWorkoutHeroLabels(S.NOT_STARTED, msgPt), { badge: "HOJE", cta: "COMEÇAR" });
});

test("T01.1A-bis 2: EN CURSO -> EN CURSO / CONTINUAR ENTRENAMIENTO (es/en/pt)", () => {
  assert.deepEqual(getWorkoutHeroLabels(S.IN_PROGRESS, msgEs), { badge: "EN CURSO", cta: "CONTINUAR ENTRENAMIENTO" });
  assert.deepEqual(getWorkoutHeroLabels(S.IN_PROGRESS, msgEn), { badge: "IN PROGRESS", cta: "CONTINUE WORKOUT" });
  assert.deepEqual(getWorkoutHeroLabels(S.IN_PROGRESS, msgPt), { badge: "EM ANDAMENTO", cta: "CONTINUAR TREINO" });
});

test("T01.1A-bis: COMPLETADO / estado desconocido conservan las etiquetas por defecto (comportamiento anterior del drawer)", () => {
  const def = getWorkoutHeroLabels(S.NOT_STARTED, msgEs);
  assert.deepEqual(getWorkoutHeroLabels(S.COMPLETED, msgEs), def);
  assert.deepEqual(getWorkoutHeroLabels(undefined, msgEs), def);
});

// Escenario del E2E: rutina "full body" de 4 dias que COMPARTEN los 9 ejercicios, Dia 4 pendiente
const FB_IDS = ["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9"];
const fbDay = () => ({ exercises: FB_IDS.map((id) => ({ id })) });
const fbRutina = { id: "r1", name: "Cata full body", days: [fbDay(), fbDay(), fbDay(), fbDay()] };
const fbSes = (i, fecha, at) => ({ alumno_id: "a1", rutina_id: "r1", rutina_nombre: "Cata full body", dia_idx: i,
  semana: 1, fecha: fecha, ejercicios: FB_IDS.join(","), created_at: at });
const fbHydrated = (n) => hydrateProgressFromRows(FB_IDS.slice(0, n).map((id, i) => ({
  ejercicio_id: id, kg: 20, reps: 10, fecha: HOY, semana: 0, nota: "", created_at: "2026-10-02T17:0" + i + ":00Z" })));
const fbPrev = [fbSes(0, "27/9/2026", "2026-09-27T15:00:00Z"), fbSes(1, "28/9/2026", "2026-09-28T15:00:00Z"), fbSes(2, AYER, "2026-09-30T15:00:00Z")];
const welcomeState = (over) => getStudentWelcomeWorkoutState(Object.assign({
  rutina: fbRutina, completedDaysInWeek: 3, weekIndex: 0, sesiones: fbPrev, progress: {}, hoy: HOY, alumnoId: "a1",
}, over || {}));
// lo que calcula el hero del plan (App.jsx): dia que toca = days[completedDaysInWeek]
const heroState = (over) => {
  const o = Object.assign({ rutina: fbRutina, completedDaysInWeek: 3, weekIndex: 0, sesiones: fbPrev, progress: {}, hoy: HOY, alumnoId: "a1" }, over || {});
  const day = o.completedDaysInWeek < o.rutina.days.length ? o.rutina.days[o.completedDaysInWeek] : null;
  return getStudentWorkoutState({ rutina: o.rutina, day, sesiones: o.sesiones, progress: o.progress, hoy: o.hoy,
    weekNumber: o.weekIndex + 1, weekIndex: o.weekIndex, alumnoId: o.alumnoId });
};

test("T01.1A-bis E2E relogin: Dia 4 con 5/9 series hidratadas y sin sesion -> el drawer muestra EN CURSO / CONTINUAR ENTRENAMIENTO", () => {
  const st = welcomeState({ progress: fbHydrated(5) });
  assert.equal(st.state, S.IN_PROGRESS);
  assert.equal(st.doneExercises, 5);
  assert.deepEqual(getWorkoutHeroLabels(st.state, msgEs), { badge: "EN CURSO", cta: "CONTINUAR ENTRENAMIENTO" });
});

test("T01.1A-bis E2E relogin: sin series de hoy -> el drawer mantiene HOY TOCA / EMPEZAR", () => {
  const st = welcomeState({ progress: {} });
  assert.equal(st.state, S.NOT_STARTED);
  assert.deepEqual(getWorkoutHeroLabels(st.state, msgEs), { badge: "HOY TOCA", cta: "EMPEZAR" });
});

test("T01.1A-bis: Dia 3 finalizado HOY (rutina totalmente compartida) + series hidratadas del Dia 4 posteriores -> EN CURSO", () => {
  const sesiones = [fbPrev[0], fbPrev[1], fbSes(2, HOY, "2026-10-02T15:20:00Z")];
  assert.equal(welcomeState({ sesiones, progress: fbHydrated(5) }).state, S.IN_PROGRESS);
});

test("T01.1A-bis: drawer y hero obtienen el MISMO estado y las MISMAS etiquetas en todos los escenarios", () => {
  const scenarios = [
    {},                                                                  // sin series
    { progress: fbHydrated(1) }, { progress: fbHydrated(5) }, { progress: fbHydrated(9) },
    { sesiones: [fbPrev[0], fbPrev[1], fbSes(2, HOY, "2026-10-02T15:20:00Z")] },
    { sesiones: [fbPrev[0], fbPrev[1], fbSes(2, HOY, "2026-10-02T15:20:00Z")], progress: fbHydrated(5) },
    { completedDaysInWeek: 4, sesiones: [fbPrev[0], fbPrev[1], fbPrev[2], fbSes(3, HOY, "2026-10-02T15:30:00Z")] },  // semana completa, ultimo dia hoy
    { completedDaysInWeek: 4, sesiones: [fbPrev[0], fbPrev[1], fbPrev[2], fbSes(3, AYER, "2026-09-30T16:30:00Z")], progress: fbHydrated(5) },
    { completedDaysInWeek: 0, sesiones: [], progress: fbHydrated(3) },
    { completedDaysInWeek: 1, sesiones: [fbPrev[0]], progress: fbHydrated(2), alumnoId: "a2" },
  ];
  scenarios.forEach((sc, i) => {
    const w = welcomeState(sc), h = heroState(sc);
    assert.equal(w.state, h.state, "escenario " + i + " estado");
    assert.equal(w.doneExercises, h.doneExercises, "escenario " + i + " doneExercises");
    assert.deepEqual(getWorkoutHeroLabels(w.state, msgEs), getWorkoutHeroLabels(h.state, msgEs), "escenario " + i + " etiquetas");
  });
});

test("T01.1A-bis: semana completa sin sesion de hoy -> el drawer no toma actividad del Dia 1 como EN CURSO (dia = ninguno, igual que el hero)", () => {
  const sc = { completedDaysInWeek: 4, sesiones: [fbPrev[0], fbPrev[1], fbPrev[2], fbSes(3, AYER, "2026-09-30T16:30:00Z")], progress: fbHydrated(5) };
  assert.equal(welcomeState(sc).state, S.NOT_STARTED);
});

test("T01.1A-bis: COMPLETADO hoy -> el drawer sigue con las etiquetas por defecto (sin comportamiento nuevo)", () => {
  const sesiones = [fbPrev[0], fbPrev[1], fbPrev[2], fbSes(2, HOY, "2026-10-02T15:20:00Z")];
  const st = welcomeState({ completedDaysInWeek: 3, sesiones });
  assert.equal(st.state, S.COMPLETED);
  assert.deepEqual(getWorkoutHeroLabels(st.state, msgEs), { badge: "HOY TOCA", cta: "EMPEZAR" });
});

test("T01.1A-bis cableado: hero y drawer usan getWorkoutHeroLabels/getStudentWorkoutState; ya no hay etiquetas literales duplicadas", () => {
  const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
  const app = read("../App.jsx");
  const modal = read("../components/WelcomeModal.jsx");
  const host = read("../components/student/StudentWelcomeModalHost.jsx");
  const coachHost = read("../components/CoachWelcomeModalHost.jsx");
  assert.ok(app.includes("getWorkoutHeroLabels(workoutState, msg)"));
  assert.ok(app.includes("hoyBadgeText={workoutHeroLabels.badge}") && app.includes("ctaLabel={workoutHeroLabels.cta}"));
  assert.ok(app.includes("progress, sesiones,"));                       // welcomeProps
  assert.ok(host.includes("getStudentWelcomeWorkoutState(") && host.includes("workoutState={welcomeWorkoutState}"));
  assert.ok(coachHost.includes("progress={progress}") && coachHost.includes("sesiones={sesiones}"));
  assert.ok(modal.includes("getWorkoutHeroLabels(workoutState || STUDENT_WORKOUT_STATE.NOT_STARTED, msg)"));
  [app, modal, host].forEach((src) => {
    assert.ok(!src.includes('msg("HOY TOCA"') && !src.includes('msg("EMPEZAR"') && !src.includes('msg("EN CURSO"') && !src.includes('msg("CONTINUAR ENTRENAMIENTO"'));
  });
});

console.log(count + " tests OK");
