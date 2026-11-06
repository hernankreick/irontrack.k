// D7.6 — Validacion de kg y repeticiones al registrar una serie (sin tocar el historial ya guardado).
//   node scripts/test-d7-6CargasValidacion.mjs
// `legacyCanLog` reproduce canLogWorkoutSet anterior para mostrar el hueco (kg negativo en peso corporal / sin carga sugerida).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validarKgEntrada, repsRegistrables, serieRegistrable, KG_MAX_TECNICO, REPS_MAX_TECNICO } from "../lib/cargaSerie.js";
import {
  canLogWorkoutSet, calculateNewWeightPR, normalizeWorkoutKg, resolveWorkoutRepsInput, exerciseHasSuggestedLoad,
  hydrateProgressFromRows, updateExerciseProgressRecord, buildExerciseSetRecord,
} from "../lib/workoutSession.js";
import { kgDeSerie, eventosPR, mejoresMarcas, recordDe, clasificarCarga } from "../lib/metricas/pr.js";
import { volumenDeSerie, volumenEnRango } from "../lib/metricas/volumen.js";
import { computeTrainingVolume } from "../lib/trainingVolume.js";
import { parseFechaDMY } from "../lib/progressDate.js";

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

const legacyCanLog = (exercise, kg, reps) => {
  if (resolveWorkoutRepsInput(reps, exercise) <= 0) return false;
  if (!exerciseHasSuggestedLoad(exercise)) return true;
  return normalizeWorkoutKg(kg) > 0;
};
const SENTADILLA = { id: "sentadilla", name: "Sentadilla", kg: "100", reps: "5" };
const SENTADILLA_SIN_KG = { id: "sentadilla", name: "Sentadilla", reps: "5" }; // rutina rehidratada sin kg prescripto
const DOMINADAS = { id: "dominadas", name: "Dominadas", reps: "8" };              // peso corporal (lastre opcional)
const PLANCHA = { id: "plancha", name: "Plancha", reps: "45s" };                 // por tiempo

// ── 1. validarKgEntrada ─────────────────────────────────────────────────────────
await t("1. kg validos: punto o coma decimal, entero, numero, vacio = 0 (peso corporal), techo tecnico incluido", () => {
  const ok = [["82,5", 82.5], ["82.5", 82.5], [" 100 ", 100], ["0", 0], ["", 0], [null, 0], [undefined, 0], [100, 100], [0, 0],
    ["1,25", 1.25], [",5", 0.5], ["+20", 20], [-0, 0], ["1500", 1500], [KG_MAX_TECNICO, KG_MAX_TECNICO]];
  for (const [v, kg] of ok) {
    const r = validarKgEntrada(v);
    assert.equal(r.ok, true, "deberia aceptar " + JSON.stringify(v)); assert.equal(r.kg, kg); assert.ok(Object.is(r.kg, kg === 0 ? 0 : kg));
  }
});

await t("2. kg invalidos: negativos, NaN, infinitos, notacion cientifica, texto, dos separadores, fuera del techo tecnico", () => {
  const malos = [["-5", "negativo"], [-5, "negativo"], ["-0,5", "negativo"], [NaN, "formato"], ["abc", "formato"], ["80abc", "formato"],
    ["1e5", "formato"], ["1e999", "formato"], ["Infinity", "no_finito"], [Infinity, "no_finito"], [-Infinity, "no_finito"],
    ["1,2,3", "formato"], ["82.5.1", "formato"], ["0x10", "formato"], [{}, "formato"], [true, "formato"],
    [KG_MAX_TECNICO + 0.5, "fuera_de_rango"], ["800000", "fuera_de_rango"]];
  for (const [v, motivo] of malos) {
    const r = validarKgEntrada(v);
    assert.equal(r.ok, false, "deberia rechazar " + String(v)); assert.equal(r.motivo, motivo, String(v)); assert.ok(Number.isNaN(r.kg));
  }
});

await t("3. cargas muy altas pero legitimas NO se rechazan (sin tope fisiologico arbitrario)", () => {
  // prensa de piernas / levantamientos parciales record, deadlift record, mancuernas con decimales
  for (const kg of ["501", "1000", "2840", "9999,75"]) assert.equal(validarKgEntrada(kg).ok, true, kg);
  // "1.000" se lee como decimal (1 kg), igual que antes (parseFloat); no se interpreta como separador de miles
  assert.equal(validarKgEntrada("1.000").kg, 1);
});

await t("4. repeticiones: enteras en [1, techo]; 0, negativas, decimales, NaN o 1e20 no se registran", () => {
  for (const r of [1, 5, 120, 3600, REPS_MAX_TECNICO, "8"]) assert.equal(repsRegistrables(r), true, String(r));
  for (const r of [0, -3, 2.5, NaN, Infinity, 1e20, REPS_MAX_TECNICO + 1, "8.5", "abc", null, undefined]) assert.equal(repsRegistrables(r), false, String(r));
  assert.equal(serieRegistrable(80, 8), true);
  assert.equal(serieRegistrable(-80, 8), false);
  assert.equal(serieRegistrable(80, 0), false);
});

// ── 2. canLogWorkoutSet (lo que habilita REGISTRAR y el swipe) ──────────────────
await t("5. hueco anterior: kg negativo en peso corporal / sin carga sugerida se registraba; ahora no", () => {
  assert.equal(legacyCanLog(DOMINADAS, "-10", "8"), true, "antes se registraba -10 kg");
  assert.equal(legacyCanLog(SENTADILLA_SIN_KG, "-20", "5"), true);
  assert.equal(canLogWorkoutSet(DOMINADAS, "-10", "8"), false);
  assert.equal(canLogWorkoutSet(SENTADILLA_SIN_KG, "-20", "5"), false);
  assert.equal(canLogWorkoutSet(DOMINADAS, "80abc", "8"), false);
  assert.equal(canLogWorkoutSet(SENTADILLA, "1e5", "5"), false, "antes 1e5 = 100000 kg");
  assert.equal(legacyCanLog(SENTADILLA, "1e5", "5"), true);
  assert.equal(canLogWorkoutSet(SENTADILLA, "Infinity", "5"), false);
});

await t("6. compatibilidad: coma decimal, peso corporal sin kg, lastre, tiempo; carga sugerida sigue exigiendo kg > 0", () => {
  assert.equal(canLogWorkoutSet(SENTADILLA, "82,5", "5"), true);
  assert.equal(canLogWorkoutSet(SENTADILLA, "", "5"), false, "con carga sugerida, sin kg no se registra (como antes)");
  assert.equal(canLogWorkoutSet(DOMINADAS, "", "8"), true, "peso corporal sin lastre");
  assert.equal(canLogWorkoutSet(DOMINADAS, "0", "8"), true);
  assert.equal(canLogWorkoutSet(DOMINADAS, "12,5", "8"), true, "lastre con coma");
  assert.equal(canLogWorkoutSet(PLANCHA, "", "45s"), true, "por tiempo: reps = segundos prescriptos");
  assert.equal(canLogWorkoutSet(PLANCHA, "10", ""), true, "por tiempo con lastre, usa la duracion prescripta");
  assert.equal(canLogWorkoutSet(SENTADILLA_SIN_KG, "8-10", "8-10"), false, "texto en kg");
  assert.equal(canLogWorkoutSet(SENTADILLA_SIN_KG, "60", "8-10"), true, "reps prescriptas como rango: se toma 8 (como antes)");
  assert.equal(canLogWorkoutSet(DOMINADAS, "", "0"), false);
  assert.equal(canLogWorkoutSet(DOMINADAS, "", String(1e20)), false, "reps absurdas");
});

// ── 3. PR y volumen ─────────────────────────────────────────────────────────────
await t("7. una entrada invalida nunca es PR (ni durante el entrenamiento ni en la regla unica)", () => {
  for (const kg of ["1e5", "Infinity", Infinity, "-5", -5, "80abc", NaN, "800000"]) assert.equal(calculateNewWeightPR({ max: 100 }, kg), null, String(kg));
  assert.deepEqual(calculateNewWeightPR({ max: 100 }, "102,5"), { kg: 102.5, prevKg: 100, diff: 2.5 });
  assert.deepEqual(calculateNewWeightPR({ max: 100 }, 1500), { kg: 1500, prevKg: 100, diff: 1400 }, "carga alta legitima si es PR");
  assert.equal(calculateNewWeightPR({ max: 0 }, "80"), null, "primera marca no es PR (D7.4)");
  assert.ok(Number.isNaN(kgDeSerie(Infinity))); assert.ok(Number.isNaN(kgDeSerie("Infinity"))); assert.ok(Number.isNaN(kgDeSerie("1e999")));
  assert.equal(kgDeSerie("82,5"), 82.5); assert.equal(kgDeSerie(90), 90);
  assert.equal(clasificarCarga(100, Infinity), null);
});

await t("8. filas con kg infinito/negativo/NaN: sin record, sin evento PR y sin volumen (sin borrarlas)", () => {
  const rows = [
    { ejercicio_id: "sentadilla", fecha: "1/3/2026", kg: 100, reps: 5 },
    { ejercicio_id: "sentadilla", fecha: "8/3/2026", kg: "Infinity", reps: 5 },
    { ejercicio_id: "sentadilla", fecha: "9/3/2026", kg: -50, reps: 5 },
    { ejercicio_id: "sentadilla", fecha: "10/3/2026", kg: "abc", reps: 5 },
    { ejercicio_id: "sentadilla", fecha: "15/3/2026", kg: 105, reps: 5 },
  ];
  const copia = JSON.parse(JSON.stringify(rows));
  assert.equal(recordDe(rows, "sentadilla"), 105);
  assert.deepEqual(eventosPR(rows).map((e) => [e.kg, e.kgAnterior]), [[105, 100]]);
  assert.equal(mejoresMarcas(rows).sentadilla.kg, 105);
  assert.equal(volumenDeSerie(rows[1]), 0);
  assert.equal(volumenDeSerie({ ejercicio_id: "x", fecha: "1/3/2026", kg: 50, reps: Infinity }), 0);
  assert.equal(volumenEnRango(rows).total, 100 * 5 + 105 * 5);
  assert.deepEqual(rows, copia, "las filas del historial no se modifican");
});

await t("9. computeTrainingVolume (tarjeta de volumen): un kg infinito no aporta volumen", () => {
  const hoy = new Date(); hoy.setHours(12, 0, 0, 0);
  const f = hoy.getDate() + "/" + (hoy.getMonth() + 1) + "/" + hoy.getFullYear();
  const base = [{ ejercicio_id: "sentadilla", fecha: f, kg: 100, reps: 5 }];
  const conInf = base.concat([{ ejercicio_id: "sentadilla", fecha: f, kg: "Infinity", reps: 5 }]);
  const today = parseFechaDMY(f);
  const a = computeTrainingVolume(base, { complete: true, today });
  const b = computeTrainingVolume(conInf, { complete: true, today });
  assert.equal(a.currentTotal, 500);
  assert.equal(b.currentTotal, 500, "antes: Infinity");
  assert.equal(b.diagnostics.byReason["kg<=0"].sets, 1, "la serie queda excluida y diagnosticada, no borrada");
});

await t("10. historial real intacto: la hidratacion conserva filas viejas (incluso invalidas) y el record solo cuenta las validas", () => {
  const rows = [
    { id: "p1", ejercicio_id: "dominadas", kg: -10, reps: 8, fecha: "1/3/2026", semana: 1, created_at: "2026-03-01T10:00:00Z" },
    { id: "p2", ejercicio_id: "dominadas", kg: 0, reps: 8, fecha: "2/3/2026", semana: 1, created_at: "2026-03-02T10:00:00Z" },
    { id: "p3", ejercicio_id: "dominadas", kg: 12.5, reps: 6, fecha: "3/3/2026", semana: 1, created_at: "2026-03-03T10:00:00Z" },
  ];
  const copia = JSON.parse(JSON.stringify(rows));
  const p = hydrateProgressFromRows(rows);
  assert.equal(p.dominadas.sets.length, 3, "no se descarta ninguna fila historica");
  assert.equal(p.dominadas.max, 12.5);
  assert.deepEqual(rows, copia);
  const e = updateExerciseProgressRecord(p.dominadas, buildExerciseSetRecord(20, 5, "4/3/2026", 0));
  assert.equal(e.max, 20);
});

// ── 4. cableado ────────────────────────────────────────────────────────────────
await t("11. cableado: logSet valida ANTES del write-ahead/envio; el panel usa canLogWorkoutSet y avisa el kg invalido", () => {
  const app = read("App.jsx");
  const i = app.indexOf("const logSet = (");
  const body = app.slice(i, app.indexOf("const shareSessionSummaryImage", i));
  const guard = body.indexOf("if (!serieRegistrable(kg, reps))");
  assert.ok(guard > 0, "logSet llama a serieRegistrable");
  assert.ok(guard < body.indexOf("writeAheadPendingSet("), "antes del write-ahead");
  assert.ok(guard < body.indexOf("setProgress("), "antes de mostrarla");
  assert.ok(guard < body.indexOf("sendWriteAheadSet("), "antes de enviarla");
  assert.ok(guard < body.indexOf("calculateNewWeightPR("), "antes de detectar PR");
  assert.match(body.slice(guard, guard + 400), /return false;/, "devuelve false: la guarda D76-03 deja los datos en pantalla");
  const panel = read("components/WorkoutExercisePanel.jsx");
  assert.match(panel, /const canLogSet = canLogWorkoutSet\(validationExercise, kg, reps\);/);
  assert.match(panel, /if\(!canLogWorkoutSet\(validationExercise, kg, reps\)\) return;/);
  assert.match(panel, /data-qa="kg-invalido"/);
});

console.log("\n" + n + " pruebas OK");
