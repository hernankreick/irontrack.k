// D7.4: una sola regla de récord personal (PR) en toda IronTrack.
//
//   node scripts/test-d7-4Records.mjs
//
// Regla (lib/metricas/pr.js): por alumno y ejercicio, sobre TODO el historial (rutinas, semanas y ciclos):
//   primer registro válido = marca inicial (no PR) · superar el máximo previo = PR · igualar = «iguala» (no PR) · menor = nada.
//   Serie válida: kg > 0 y reps > 0, fecha d/m/yyyy, ejercicio que no es por tiempo; kg con coma o punto. Un PR por ejercicio y día
//   (mejor serie del día; no se inventa orden entre series del mismo día). En vivo, el orden real es el de registro.
// Superficies verificadas: estadísticas del entrenador (buildCoachProgresoModel), historial por ejercicio (historialPorDia), progreso del
// alumno (countPRsThisMonth, exerciseRecordKg, progressivePRMasks), indicador durante el entrenamiento (calculateNewWeightPR, LogForm),
// resumen de sesión (buildNewSessionPRList) e historial del ejercicio en la biblioteca (calculateBestPR).
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eventosPR, historialPorDia, mejoresMarcas, clasificarCarga, esPRNuevo, recordDe, kgDeSerie, filasDesdeProgress } from "../lib/metricas/pr.js";
import { parseFechaDMY } from "../lib/metricas/fechas.js";
import { updateExerciseProgressRecord, hydrateProgressFromRows, calculateNewWeightPR, buildNewSessionPRList, normalizeWorkoutSet } from "../lib/workoutSession.js";
import { calculateBestPR, prepareExerciseHistoryModalData } from "../lib/exerciseHistory.js";
import { countPRsThisMonth, exerciseRecordKg, progressivePRMasks, mergeAllSetsForExercise } from "../components/student-progress/progressMetrics.js";
import { buildCoachProgresoModel } from "../components/coachProgresoMetrics.js";
import { countPendingPrOpportunities } from "../components/student-plan/studentPlanHelpers.js";

const src = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

// ---- fecha fija: viernes 30/10/2026 12:00 ----
const NOW_MS = new Date(2026, 9, 30, 12).getTime();
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW_MS); else super(...a); }
  static now() { return NOW_MS; }
}
globalThis.Date = FixedDate;

const dia = (f) => parseFechaDMY(f);
const fila = (ex, fecha, kg, reps, extra) => Object.assign({ ejercicio_id: ex, fecha, kg, reps: reps == null ? 5 : reps }, extra || {});
// 80 -> 90 -> 90 -> 85 -> 100 (tres series por dia, la mejor es la del caso)
const SEQ = [["1/10/2026", 80], ["8/10/2026", 90], ["15/10/2026", 90], ["22/10/2026", 85], ["29/10/2026", 100]];
const filasSeq = (ex, extra) => [].concat(...SEQ.map(([f, kg]) => [fila(ex, f, kg - 10, 5, extra), fila(ex, f, kg - 5, 5, extra), fila(ex, f, kg, 5, extra)]));
const SQ = filasSeq("sq");

// ---- casos 1 a 5: la secuencia en todas las superficies ----
test("1-5. núcleo: 80 marca inicial, 90 PR, 90 iguala, 85 nada, 100 PR (un PR por día, sobre la mejor serie)", () => {
  assert.deepEqual(historialPorDia(SQ, "sq").map((h) => [h.kg, h.clase]), [[80, "primera"], [90, "pr"], [90, "iguala"], [85, null], [100, "pr"]]);
  assert.deepEqual(eventosPR(SQ).map((e) => [e.dia, e.kg, e.kgAnterior]), [[dia("29/10/2026"), 100, 90], [dia("8/10/2026"), 90, 80]]);
  assert.equal(mejoresMarcas(SQ).sq.kg, 100);
  assert.deepEqual([clasificarCarga(0, 80), clasificarCarga(80, 90), clasificarCarga(90, 90), clasificarCarga(90, 85), clasificarCarga(90, 100)], ["primera", "pr", "iguala", null, "pr"]);
});

test("1-5. entrenamiento en vivo (indicador PR y celebración): mismo resultado serie a serie, en el orden real de registro", () => {
  let entry = null;
  const clases = SEQ.map(([fecha, kg]) => {
    const pr = calculateNewWeightPR(entry, kg);
    entry = updateExerciseProgressRecord(entry, { kg, reps: 5, date: fecha });
    return pr ? "pr" : null;
  });
  assert.deepEqual(clases, [null, "pr", null, null, "pr"]); // 80 sin record previo: no es PR (marca inicial)
  assert.equal(entry.max, 100);
  // LogForm usa la misma regla
  assert.match(src("components/LogForm.jsx"), /const isPR = esPRNuevo\(progress\[ex\.id\]\?\.max\|\|0, kg\);/);
  assert.equal(esPRNuevo(0, 80), false);
});

test("1-5. resumen de sesión: cada sesión contra el record previo a la sesión (la primera NO es PR; antes sí)", () => {
  const ex = [{ id: "sq", name: "Sentadilla" }];
  let entry = null;
  const prsPorSesion = SEQ.map(([fecha, kg]) => {
    const pre = { sq: entry ? entry.max : 0 };
    [kg - 10, kg - 5, kg].forEach((k) => { entry = updateExerciseProgressRecord(entry, { kg: k, reps: 5, date: fecha }); });
    return buildNewSessionPRList(ex, { sq: entry }, pre, fecha).map((p) => p.kg);
  });
  assert.deepEqual(prsPorSesion, [[], [90], [], [], [100]]);
});

test("1-5. progreso del alumno: record 100, PRs del mes = 2, gráfico marca solo la mejor serie de los días PR", () => {
  const sb = SQ.map((r) => Object.assign({ alumno_id: "a" }, r));
  const EXL = [{ id: "sq", name: "Sentadilla" }];
  assert.equal(exerciseRecordKg("sq", {}, sb), 100);
  assert.equal(countPRsThisMonth(EXL, EXL, {}, sb), 2);
  const hist = mergeAllSetsForExercise("sq", {}, sb);
  const flags = progressivePRMasks(hist, "peso", { exId: "sq", historial: hist });
  assert.deepEqual(hist.filter((_, i) => flags[i]).map((r) => [r.fecha, r.kg]), [["8/10/2026", 90], ["29/10/2026", 100]]);
  // rango recortado (ultimas 2 fechas): el 85 no es PR aunque sea el primer punto visible (antes si)
  const visibles = hist.filter((r) => ["22/10/2026", "29/10/2026"].includes(r.fecha));
  const f2 = progressivePRMasks(visibles, "peso", { exId: "sq", historial: hist });
  assert.deepEqual(visibles.filter((_, i) => f2[i]).map((r) => r.kg), [100]);
});

test("1-5. estadísticas del entrenador e historial por ejercicio: mismos PR y record", () => {
  const m = buildCoachProgresoModel({
    alumnos: [{ id: "a", nombre: "Alumna" }], sesionesGlobales: [], progresoGlobal: { a: SQ.map((r) => Object.assign({ alumno_id: "a" }, r)) },
    rutinasSBEntrenador: [], allEx: [{ id: "sq", name: "Sentadilla", pattern: "rodilla" }], periodId: "semanas4", alumnoSel: "a", ejercicioSelId: "sq", lang: "es",
  });
  assert.equal(m.alumnoChips.find((c) => c.key === "alumnoPrs").value, 2);
  assert.deepEqual(m.prsRecientes.map((p) => [p.kg, p.kgAnterior]), [[100, 90], [90, 80]]);
  assert.match(src("components/coach/EjercicioHistorialCoach.jsx"), /historialPorDia|eventosPR|mejoresMarcas/);
});

test("1-5. historial del ejercicio (biblioteca) y oportunidades de PR del día: misma regla", () => {
  const progress = { sq: SQ.reduce((e, r) => updateExerciseProgressRecord(e, { kg: r.kg, reps: r.reps, date: r.fecha }), null) };
  assert.equal(prepareExerciseHistoryModalData({ exercise: { id: "sq" }, progress }).bestPR.kg, 100);
  const day = { exercises: [{ id: "sq", weeks: [{ kg: "100" }] }, { id: "bp", weeks: [{ kg: "50" }] }] };
  assert.equal(countPendingPrOpportunities(day, progress, 0), 0); // igualar 100 no es oportunidad de PR; bp sin record tampoco
  assert.equal(countPendingPrOpportunities({ exercises: [{ id: "sq", weeks: [{ kg: "102,5" }] }] }, progress, 0), 1);
});

// ---- 6 y 7: reinicios y ciclos ----
test("6. reinicio de rutina: el record histórico se conserva (100 tras el reinicio iguala, 95 no es PR)", () => {
  const rows = SQ.map((r) => Object.assign({ ciclo: 1, rutina_id: "r1" }, r)).concat([
    fila("sq", "30/10/2026", 95, 5, { ciclo: 2, rutina_id: "r1" }), fila("sq", "30/10/2026", 100, 5, { ciclo: 2, rutina_id: "r1" }),
  ]);
  assert.equal(eventosPR(rows).length, 2);
  assert.equal(historialPorDia(rows, "sq").pop().clase, "iguala");
  const progress = hydrateProgressFromRows(rows.map((r, i) => Object.assign({ created_at: "2026-10-" + String(1 + i).padStart(2, "0") + "T10:00:00Z" }, r)));
  assert.equal(progress.sq.max, 100);
  assert.equal(calculateNewWeightPR(progress.sq, 100), null);
  assert.equal(calculateNewWeightPR(progress.sq, 102.5).prevKg, 100);
});

test("7. nuevo ciclo / otra rutina: el record sigue siendo el histórico", () => {
  const rows = SQ.map((r) => Object.assign({ rutina_id: "r-vieja" }, r)).concat([fila("sq", "30/10/2026", 97.5, 5, { rutina_id: "r-nueva", ciclo: 3 })]);
  assert.equal(recordDe(rows, "sq"), 100);
  assert.equal(historialPorDia(rows, "sq").pop().clase, null);
  assert.equal(countPRsThisMonth([{ id: "sq" }], [], {}, rows), 2);
});

// ---- 8: historial completo ----
test("8. más de 20 series: record y PR sobre TODO el historial (antes: últimas 20 series y la vista de 50)", () => {
  const viejas = Array.from({ length: 25 }, (_, i) => fila("sq", (1 + (i % 28)) + "/8/2026", 120, 3));
  const nuevas = Array.from({ length: 21 }, (_, i) => fila("sq", (1 + i) + "/10/2026", 100 + i * 0.5, 5));
  const sb = viejas.concat(nuevas);
  assert.equal(exerciseRecordKg("sq", {}, sb), 120); // antes 110 (max de las ultimas 20)
  assert.equal(countPRsThisMonth([{ id: "sq" }], [], {}, sb), 0); // antes: varios «PR» de octubre por debajo de 120
  assert.equal(eventosPR(sb).length, 0);
  // estado en memoria del alumno: sets se recorta a 50, el record no
  let entry = null;
  sb.concat(Array.from({ length: 30 }, () => fila("sq", "29/10/2026", 90, 5))).forEach((r) => { entry = updateExerciseProgressRecord(entry, { kg: r.kg, reps: r.reps, date: r.fecha }); });
  assert.equal(entry.sets.length, 50);
  assert.equal(entry.max, 120);
  assert.equal(calculateBestPR(entry.sets, entry.max).kg, 120); // antes: mejor de las 50 visibles (110)
});

// ---- 9 y 10: aislamiento ----
test("9. cambio de alumno: los records y PR de un alumno nunca aparecen en otro", () => {
  const A = SQ.map((r) => Object.assign({ alumno_id: "a" }, r));
  const B = [fila("sq", "1/10/2026", 150), fila("sq", "20/10/2026", 140)].map((r) => Object.assign({ alumno_id: "b" }, r));
  const base = { alumnos: [{ id: "a", nombre: "Ana" }, { id: "b", nombre: "Beto" }], sesionesGlobales: [], progresoGlobal: { a: A, b: B }, rutinasSBEntrenador: [], allEx: [{ id: "sq", name: "Sentadilla", pattern: "rodilla" }], periodId: "semanas4", ejercicioSelId: "sq", lang: "es" };
  const mA = buildCoachProgresoModel(Object.assign({ alumnoSel: "a" }, base));
  const mB = buildCoachProgresoModel(Object.assign({ alumnoSel: "b" }, base));
  assert.ok(mA.prsRecientes.every((p) => p.n === "Ana"));
  assert.deepEqual(mB.prsRecientes, []); // 140 < 150: Beto no tiene PR aunque Ana superara 90
  assert.equal(buildCoachProgresoModel(Object.assign({ alumnoSel: "a" }, base)).prsRecientes.length, 2); // volver a Ana: igual
});

test("10. ejercicios distintos: cada uno con su propio record", () => {
  const rows = SQ.concat([fila("bp", "1/10/2026", 60), fila("bp", "8/10/2026", 62.5), fila("bp", "29/10/2026", 62.5)]);
  assert.deepEqual([recordDe(rows, "sq"), recordDe(rows, "bp")], [100, 62.5]);
  assert.deepEqual(eventosPR(rows).map((e) => e.ejercicio_id + ":" + e.kg).sort(), ["bp:62.5", "sq:100", "sq:90"]);
  assert.equal(exerciseRecordKg("bp", {}, rows), 62.5);
});

// ---- 11: decimales ----
test("11. cargas decimales con coma y punto: 82,5 = 82.5 (iguala), 85 supera, comparaciones sin error de coma flotante", () => {
  assert.equal(kgDeSerie("82,5"), 82.5);
  assert.equal(clasificarCarga("82,5", 82.5), "iguala");
  assert.equal(clasificarCarga(82.5, "85"), "pr");
  assert.equal(clasificarCarga(0.1 + 0.2, 0.3), "iguala");
  const rows = [fila("sq", "1/10/2026", "80"), fila("sq", "8/10/2026", "82,5"), fila("sq", "15/10/2026", 82.5), fila("sq", "22/10/2026", "82.50")];
  assert.deepEqual(historialPorDia(rows, "sq").map((h) => h.clase), ["primera", "pr", "iguala", "iguala"]);
  assert.equal(exerciseRecordKg("sq", {}, rows), 82.5); // antes 82 en el progreso del alumno (parseFloat cortaba la coma)
  assert.deepEqual(calculateNewWeightPR({ max: 80 }, "82,5"), { kg: 82.5, prevKg: 80, diff: 2.5 });
  assert.equal(updateExerciseProgressRecord(null, { kg: "82,5", reps: "5", date: "1/10/2026" }).max, 82.5);
  assert.equal(calculateBestPR([{ kg: "82,5", reps: 5 }]).kg, 82.5);
});

// ---- 12: duplicados y fechas equivalentes ----
test("12. duplicados y fechas equivalentes (5/10 = 05/10) no generan records falsos", () => {
  const rows = [fila("sq", "1/10/2026", 90), fila("sq", "5/10/2026", 95), fila("sq", "05/10/2026", 95), fila("sq", "05/10/2026", 95), fila("sq", "6/10/2026", 95)];
  assert.deepEqual(eventosPR(rows).map((e) => e.kg), [95]); // un PR (el dia 5), no tres
  assert.deepEqual(historialPorDia(rows, "sq").map((h) => h.clase), ["primera", "pr", "iguala"]);
  // misma serie local y en Supabase: el progreso del alumno no la cuenta dos veces ni crea un PR extra
  const local = { sq: { sets: [normalizeWorkoutSet({ kg: 95, reps: 5, date: "5/10/2026" })], max: 95 } };
  assert.equal(countPRsThisMonth([{ id: "sq" }], [], local, rows), 1);
  // series invalidas no son record: 150 kg x 0 reps ni ejercicio por tiempo
  const conInvalida = rows.concat([fila("sq", "7/10/2026", 150, 0)]);
  assert.equal(recordDe(conInvalida, "sq"), 95);
  assert.equal(hydrateProgressFromRows(conInvalida.map((r) => Object.assign({ created_at: "2026-10-07T10:00:00Z" }, r))).sq.max, 95); // antes 150
  assert.equal(recordDe([fila("plank", "1/10/2026", 20, 60)], "plank", { indiceTiempo: { plank: true } }), 0);
});

test("consistencia: el mismo historial da el mismo record en todas las superficies", () => {
  const rows = SQ.concat([fila("sq", "30/10/2026", 97.5), fila("sq", "30/10/2026", 160, 0)]);
  const withCreated = rows.map((r, i) => Object.assign({ created_at: new RealDate(2026, 9, 1, 0, i).toISOString() }, r));
  const progress = hydrateProgressFromRows(withCreated);
  const records = {
    nucleo: recordDe(rows, "sq"),
    entrenamiento: progress.sq.max,
    progresoAlumno: exerciseRecordKg("sq", {}, rows),
    biblioteca: prepareExerciseHistoryModalData({ exercise: { id: "sq" }, progress }).bestPR.kg,
    filasLocales: recordDe(filasDesdeProgress(progress), "sq"),
  };
  assert.deepEqual(new Set(Object.values(records)).size, 1, JSON.stringify(records));
  assert.equal(records.nucleo, 100);
});

console.log("\n" + count + " tests OK");
