// Pausa entre series: texto ("90s", "1:30", "2 min") y numeros se normalizan igual en panel y Plan.
//   node scripts/test-restPause.mjs
// Defecto previo: WorkoutExercisePanel hacia `pause>0` sobre el valor crudo; "90s">0 es false y el timer no arrancaba.
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
let count = 0;
async function test(name, fn) {
  try { await fn(); count++; console.log("ok -", name); }
  catch (e) { console.error("FAIL -", name, "\n", e.message); process.exit(1); }
}

const RP = await imp("lib/restPause.js");
const W = await imp("lib/workoutSession.js");
const SP = await imp("components/student-plan/studentPlanHelpers.js");
const { resolveRestSeconds: r, restTimerSeconds: t, DEFAULT_REST_SECONDS } = RP;

// Logica anterior (referencia para la regresion): el timer arrancaba solo si `pause>0` sobre el valor crudo.
const oldStarts = (pause) => pause > 0;

await test("default 90", () => assert.equal(DEFAULT_REST_SECONDS, 90));

await test("formatos de texto", () => {
  const cases = [
    ["90", 90], ["0", 0], ["90s", 90], ["90 seg", 90], ["90 segundos", 90], ["90 sec", 90],
    ["1:30", 90], ["0:45", 45], ["2 min", 120], ["2m", 120], ["2 minutos", 120], ["2min", 120],
    ["1m30s", 90], ["1 min 30 s", 90], ["1,5 min", 90], ["1.5 min", 90], ["0s", 0], ["0 min", 0], ["  60  ", 60],
  ];
  for (const [input, exp] of cases) assert.equal(r(input), exp, JSON.stringify(input));
});

await test("numeros: sin cambio para Hernan (90) y plantillas (60,120)", () => {
  assert.equal(r(90), 90); assert.equal(r(60), 60); assert.equal(r(120), 120); assert.equal(r(180), 180);
  assert.equal(r(45.6), 46);
});

await test("0 explicito = sin timer", () => {
  assert.equal(r(0), 0); assert.equal(r("0"), 0); assert.equal(t(0), 0); assert.equal(t("0"), 0);
});

await test("vacio/invalido -> fallback 90", () => {
  for (const v of ["", "   ", undefined, null, "abc", "1,5", "1.5", "1:75", "1:5", -1, "-30", NaN, Infinity, -Infinity, {}, [], true, false])
    assert.equal(r(v), 90, String(JSON.stringify(v)));
  assert.equal(r("abc", { fallback: 30 }), 30);
  assert.equal(r(undefined, { fallback: 0 }), 0);
});

await test("restTimerSeconds = resolveRestSeconds", () => {
  for (const v of ["90s", "1:30", 0, "0", "", null, "2 min", 60]) assert.equal(t(v), r(v));
});

await test("regresion: '90s' no arrancaba el timer con la logica anterior; ahora si", () => {
  assert.equal(oldStarts("90s"), false);   // defecto documentado
  assert.equal(oldStarts("1:30"), false);
  assert.equal(oldStarts("2 min"), false);
  assert.ok(t("90s") > 0 && t("1:30") > 0 && t("2 min") > 0);
});

await test("semana sobrescribe la base (resolveExerciseForWeek)", () => {
  const ex = (base, wk) => ({ id: "x", pause: base, weeks: [{ pausa: wk }] });
  const sec = (e) => t(W.resolveExerciseForWeek(e, 0).pause);
  assert.equal(sec(ex(60, "90s")), 90);
  assert.equal(sec(ex(90, "0")), 0);
  assert.equal(sec(ex(60, "")), 60);
  assert.equal(sec(ex(60, undefined)), 60);
  assert.equal(sec(ex("abc", "2 min")), 120);
  assert.equal(sec(ex("abc", "")), 90);
});

await test("consistencia panel vs parsePauseSeconds/estimateDayMinutes", () => {
  for (const v of [90, 60, "90s", "1:30", "2 min", "0", 0, "", undefined, "abc", "1,5"]) {
    assert.equal(SP.parsePauseSeconds(v), t(v), String(v));
    const e = { id: "e", sets: "3", reps: "8", pause: v };
    const exp = Math.max(1, Math.round((3 * 2.5 * 60 + 2 * t(v)) / 60));
    assert.equal(SP.estimateDayMinutes({ warmup: [], exercises: [e] }, 0), exp, "minutos " + String(v));
  }
});

console.log("\n" + count + " tests ok");
