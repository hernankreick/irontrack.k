// Prescripcion de la SEMANA ACTIVA durante el entrenamiento: lo mostrado (Inicio y panel), lo ejecutado (total de series, precarga,
// validacion, pausa) y lo planificado en el resumen salen de la misma regla: ex.weeks[semana] con el valor base solo si la semana no define el dato.
//   node scripts/test-prescripcionSemanaEntrenamiento.mjs
// Causa raiz: WorkoutScreen pasaba el ejercicio BASE (ex.sets/reps/kg/pause) al panel y a getWorkoutExerciseStatus; solo Inicio leia la semana.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const W = await imp("lib/workoutSession.js");
const SP = await imp("components/student-plan/studentPlanHelpers.js");
const { resolveExerciseForWeek: R } = W;
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

// Progresion: S1 base, S2 +reps, S3 +series, S4 +carga (y pausa distinta).
const hip = () => ({
  id: "hip", name: "Hip thrust", sets: "3", reps: "8", kg: "60", pause: 90,
  weeks: [
    { sets: "3", reps: "8", kg: "60", pausa: "90", note: "" },
    { sets: "3", reps: "10", kg: "60", pausa: "90", note: "" },
    { sets: "4", reps: "10", kg: "60", pausa: "75", note: "" },
    { sets: "4", reps: "10", kg: "70", pausa: "60", note: "" },
  ],
});
const view = (ex) => [ex.sets, ex.reps, ex.kg, ex.pause];

await test("semanas 1 a 4: S1 valores base, S2 +reps, S3 +series, S4 +carga y pausas por semana", () => {
  const e = hip();
  assert.deepEqual(view(R(e, 0)), ["3", "8", "60", "90"]);
  assert.deepEqual(view(R(e, 1)), ["3", "10", "60", "90"]);
  assert.deepEqual(view(R(e, 2)), ["4", "10", "60", "75"]);
  assert.deepEqual(view(R(e, 3)), ["4", "10", "70", "60"]);
});

await test("valores parciales: la semana define solo algunos datos; el resto cae en el valor base del ejercicio", () => {
  const e = { id: "x", sets: "3", reps: "8-10", kg: "40", pause: 60, weeks: [{ reps: "12" }, { kg: "45", pausa: "" }, { sets: "", reps: "", kg: "", pausa: "" }] };
  assert.deepEqual(view(R(e, 0)), ["3", "12", "40", 60]);
  assert.deepEqual(view(R(e, 1)), ["3", "8-10", "45", 60]);
  assert.deepEqual(view(R(e, 2)), ["3", "8-10", "40", 60], "semana con todo vacio = base");
});

await test("sin progresion semanal (sin weeks, vacio, indice invalido o semana inexistente): devuelve el MISMO ejercicio", () => {
  const base = { id: "p", name: "Plancha", sets: "3", reps: "30s", kg: "", pause: 45 };
  for (const e of [base, { ...base, weeks: [] }, { ...base, weeks: null }, { ...base, weeks: "x" }]) assert.equal(R(e, 0), e);
  const conSemanas = hip();
  for (const bad of [-1, 4, 99, 1.5, NaN, null, undefined, "1"]) assert.equal(R(conSemanas, bad), conSemanas, String(bad));
  const raras = { ...base, weeks: [null, "x", 3] };
  for (const i of [0, 1, 2]) assert.equal(R(raras, i), raras, "semana no valida: ejercicio sin cambios");
  for (const nothing of [null, undefined, 5, "x"]) assert.equal(R(nothing, 0), nothing);
});

await test("solo lectura: no muta el ejercicio ni la rutina (entrada congelada) y devuelve una copia", () => {
  const e = deepFreeze(hip());
  const antes = JSON.stringify(e);
  const r = R(e, 2);
  assert.notEqual(r, e);
  assert.equal(JSON.stringify(e), antes);
  assert.equal(r.id, "hip"); assert.equal(r.name, "Hip thrust");
  assert.equal(r.weeks, e.weeks, "las semanas (y sus notas) se conservan para el resto de la app");
});

await test("total de series del entrenamiento sigue la semana: S3 = 4 series (antes siempre 3); las series ya hechas no se pierden", () => {
  const e = hip();
  const hoy = "10/11/2026";
  const set = (n) => ({ kg: 60, reps: 10, date: hoy, week: 2, id: "s" + n });
  const progress = { hip: { sets: [set(3), set(2), set(1)], max: 60 } };
  const base = W.getWorkoutExerciseStatus({ exercise: e, progress, date: hoy, currentWeek: 2 });
  const sem = W.getWorkoutExerciseStatus({ exercise: R(e, 2), progress, date: hoy, currentWeek: 2 });
  assert.equal(base.totalSets, 3); assert.equal(base.isDone, true, "con el ejercicio base se daba por terminado con 3 series");
  assert.equal(sem.totalSets, 4); assert.equal(sem.remainingSets, 1); assert.equal(sem.isDone, false); assert.equal(sem.currentSetNumber, 4);
  assert.equal(sem.setsToday.length, 3, "las 3 series ya registradas siguen ahi");
  assert.deepEqual(progress.hip.sets.map((s) => s.id), ["s3", "s2", "s1"], "el historial no cambia");
});

await test("si la semana tiene MENOS series que las ya hechas: queda completo, sin series negativas ni borrado", () => {
  const e = { id: "z", sets: "5", reps: "5", weeks: [{ sets: "2" }] };
  const hoy = "10/11/2026";
  const progress = { z: { sets: [1, 2, 3].map((i) => ({ kg: 10, reps: 5, date: hoy, week: 0, id: "q" + i })), max: 10 } };
  const st = W.getWorkoutExerciseStatus({ exercise: R(e, 0), progress, date: hoy, currentWeek: 0 });
  assert.equal(st.totalSets, 2); assert.equal(st.remainingSets, 0); assert.equal(st.isDone, true); assert.equal(st.setsToday.length, 3);
});

await test("reinicio de rutina: semana 1 vuelve a sus valores; las series de otro ciclo no cuentan (misma regla de ciclo de siempre)", () => {
  const e = hip();
  assert.deepEqual(view(R(e, 0)), ["3", "8", "60", "90"], "tras reiniciar, semana 1 = valores de la semana 1");
  const hoy = "10/11/2026";
  const viejo = { kg: 60, reps: 10, date: hoy, week: 0, ciclo: 1, id: "v1" };
  const nuevo = { kg: 60, reps: 8, date: hoy, week: 0, ciclo: 2, id: "n1" };
  const st = W.getWorkoutExerciseStatus({ exercise: R(e, 0), progress: { hip: { sets: [nuevo, viejo], max: 60 } }, date: hoy, currentWeek: 0, ciclo: 2 });
  assert.equal(st.setsToday.length, 1); assert.equal(st.setsToday[0].id, "n1"); assert.equal(st.totalSets, 3);
});

await test("cambio de alumno: la prescripcion sale solo del ejercicio de cada alumno (sin estado compartido)", () => {
  const a = hip();
  const b = { ...hip(), id: "hip", weeks: [{ sets: "5", reps: "5", kg: "100", pausa: "120" }] };
  assert.deepEqual(view(R(a, 0)), ["3", "8", "60", "90"]);
  assert.deepEqual(view(R(b, 0)), ["5", "5", "100", "120"]);
  assert.deepEqual(view(R(a, 0)), ["3", "8", "60", "90"], "volver a A no arrastra B");
});

await test("resumen de la sesion: series planificadas de la semana que se guarda; sin semana, valor base como antes", () => {
  const day = { label: "Dia 1", warmup: [], exercises: [hip(), { id: "q", sets: "3", reps: "8", weeks: [] }] };
  const mk = (weekToSave) => W.buildWorkoutSummary({ session: { dIdx: 0, startTime: 0 }, activeDay: day, activeRoutine: { name: "R", days: [day] }, progress: {}, preSessionPRs: {}, date: "10/11/2026", now: 60000, weekToSave });
  assert.equal(mk(1).totalSets, 3 + 3);
  assert.equal(mk(3).totalSets, 4 + 3);
  assert.equal(mk(undefined).totalSets, 3 + 3);
  assert.equal(mk(3).semana, 3);
});

await test("lo registrado no depende del cambio: buildExerciseSetRecord/payload guardan lo que ingresa el alumno y la semana, sin tocar la prescripcion", () => {
  const rec = W.buildExerciseSetRecord(72.5, 9, "10/11/2026", 3, "nota", 8, 2);
  assert.equal(rec.kg, 72.5); assert.equal(rec.reps, 9); assert.equal(rec.week, 3); assert.equal(rec.ciclo, 2);
  const payload = W.buildProgressPayload("al1", "hip", 72.5, 9, "nota", "10/11/2026", 4, 2, "11111111-1111-4111-8111-111111111111");
  assert.equal(payload.kg, 72.5); assert.equal(payload.reps, 9); assert.equal(payload.semana, 4);
  const antes = JSON.stringify(hip());
  R(hip(), 3);
  assert.equal(JSON.stringify(hip()), antes);
});

// ── Render real (SSR con esbuild): Inicio y panel ──
async function loadRender() {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-presc-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents:
        'import React from "react";' +
        'import { renderToStaticMarkup } from "react-dom/server";' +
        'import StudentPlanExerciseRows from "./components/student-plan/StudentPlanExerciseRows.jsx";' +
        'import { WorkoutExercisePanel } from "./components/WorkoutExercisePanel.jsx";' +
        "export { React, renderToStaticMarkup, StudentPlanExerciseRows, WorkoutExercisePanel };",
      resolveDir: ROOT, sourcefile: "presc-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", jsx: "automatic", alias: { "@": ROOT },
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  return import(pathToFileURL(outfile).href);
}
const X = await loadRender();
const fmtP = (s) => { const n = parseInt(s) || 0; if (!n) return "No"; if (n < 60) return n + "s"; const m = Math.floor(n / 60), r = n % 60; return r === 0 ? m + "min" : m + "m" + r + "s"; };
const inicio = (day, week) => X.renderToStaticMarkup(X.React.createElement(X.StudentPlanExerciseRows, {
  day, routineId: "r", dayIndex: 0, allEx: [], currentWeekForRoutine: week, border: "#2D4057", textMain: "#fff", msg: (a) => a, es: true, fmtP, renderExerciseVideoButton: () => null,
}));
const panel = (ex, week) => X.renderToStaticMarkup(X.React.createElement(X.WorkoutExercisePanel, {
  activeExIdx: 0, setActiveExIdx() {}, exercises: [ex], ex, info: null, pat: { color: "#2563EB", icon: "E" },
  setsHoy: [], totalSets: W.getWorkoutExerciseStatus({ exercise: ex, progress: {}, date: "x", currentWeek: week }).totalSets, setsRestantes: 9, setActualNum: 1,
  ultimoSet: null, pr: 0, es: true, darkMode: true, bgCard: "#162234", bgSub: "#0F1923", border: "#2D4057", textMain: "#fff", textMuted: "#8B9AB2",
  sessionPRList: [], videoOverrides: {}, setVideoModal() {}, currentWeek: week, logSet() {}, startTimer() {}, setPrCelebration() {},
  rutinaDatos: {}, progress: {}, logScope: "a|r|0|1",
}));
const text = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

await test("Inicio y entrenamiento muestran LO MISMO en cada semana (series×reps, kg y pausa)", () => {
  const e = hip();
  for (let w = 0; w < 4; w++) {
    const r = R(e, w);
    const ini = text(inicio({ warmup: [], exercises: [e] }, w));
    const ent = text(panel(r, w));
    const esperado = [`${r.sets}×${r.reps}`, `${r.kg}kg`];
    esperado.forEach((t) => { assert.ok(ini.includes(t), `Inicio S${w + 1} ${t}`); assert.ok(ent.includes(t), `Entrenamiento S${w + 1} ${t}`); });
    assert.ok(ini.includes("⏱ " + fmtP(r.pause)), `Inicio S${w + 1} pausa ${fmtP(r.pause)}`);
    const fmtTime = (s) => (s >= 60 ? Math.floor(s / 60) + "m" + (s % 60 > 0 ? (s % 60) + "s" : "") : s + "s");
    assert.ok(ent.includes("⏱ " + fmtTime(parseInt(r.pause, 10))), `Entrenamiento S${w + 1} pausa`);
  }
});

await test("ANTES: el panel con el ejercicio base muestra siempre 3×8 · 60kg · 1m30s; DESPUES (semana 4): 4×10 · 70kg · 1m", () => {
  const e = hip();
  const antes = text(panel(e, 3)), despues = text(panel(R(e, 3), 3));
  assert.ok(antes.includes("3×8") && antes.includes("60kg") && antes.includes("1m30s"));
  assert.ok(despues.includes("4×10") && despues.includes("70kg") && despues.includes("⏱ 1m"));
  assert.ok(despues.includes("SET 1 de 4") && antes.includes("SET 1 de 3"));
});

await test("Inicio: la entrada en calor usa los valores de la semana y la pausa de la semana en el bloque principal", () => {
  const wu = { id: "wu", name: "Movilidad", sets: "2", reps: "10", weeks: [{ sets: "2", reps: "10" }, { sets: "3", reps: "12" }] };
  assert.ok(text(inicio({ warmup: [wu], exercises: [] }, 1)).includes("3×12"));
  assert.ok(text(inicio({ warmup: [wu], exercises: [] }, 0)).includes("2×10"));
  assert.ok(text(inicio({ warmup: [{ id: "u", name: "U", sets: "2", reps: "10" }], exercises: [] }, 0)).includes("2×10"), "sin semanas: base");
  assert.ok(text(inicio({ warmup: [], exercises: [hip()] }, 2)).includes("⏱ 1m15s"));
});

await test("ejercicios sin semanas: el entrenamiento y Inicio muestran los valores base (compatibilidad)", () => {
  const p = { id: "p", name: "Plancha", sets: "3", reps: "30s", kg: "", pause: 45 };
  const ent = text(panel(R(p, 0), 0)), ini = text(inicio({ warmup: [], exercises: [p] }, 0));
  assert.ok(ent.includes("3×30s") && ini.includes("3×30s") && ent.includes("⏱ 45s") && ini.includes("⏱ 45s"));
});

await test("duracion estimada del dia (Inicio): usa la pausa de la semana", () => {
  const e = { id: "e", sets: "3", reps: "8", pause: 60, weeks: [{ sets: "3", pausa: "60" }, { sets: "3", pausa: "120" }] };
  const m0 = SP.estimateDayMinutes({ warmup: [], exercises: [e] }, 0), m1 = SP.estimateDayMinutes({ warmup: [], exercises: [e] }, 1);
  assert.equal(m0, Math.round((3 * 2.5 * 60 + 2 * 60) / 60));
  assert.equal(m1, Math.round((3 * 2.5 * 60 + 2 * 120) / 60));
  assert.ok(m1 > m0);
});

await test("alcance: WorkoutScreen alimenta estado y panel con la prescripcion de la semana; el efecto de precarga no depende de la semana (no pisa cambios del alumno)", () => {
  const ws = read("components/WorkoutScreen.jsx");
  assert.match(ws, /const ex\s+= resolveExerciseForWeek\(exercises\[activeExIdx\], currentWeek\);/);
  assert.match(ws, /getWorkoutExerciseStatus\(\{\s*exercise: ex,/);
  const panelSrc = read("components/WorkoutExercisePanel.jsx");
  assert.match(panelSrc, /\}, \[activeExIdx\]\);/, "la precarga sigue ligada solo al cambio de ejercicio");
  assert.match(panelSrc, /const lastKg = setsHoy\[0\]\?\.kg \|\| setsForLoadPrefill\(progress\[ex\.id\]\?\.sets, rutinaDatos\)\[0\]\?\.kg \|\| ex\.kg/, "precedencia del kg: hoy > historial > prescripcion");
});

await test("alcance: sin red, almacenamiento ni escritura nueva; no se tocan Supabase, App.jsx ni los metodos de progresion", () => {
  const w = read("lib/workoutSession.js");
  const bloque = w.slice(w.indexOf("export function resolveExerciseForWeek"), w.indexOf("export function getWorkoutExerciseStatus"));
  assert.doesNotMatch(bloque.replace(/\/\*[\s\S]*?\*\//g, ""), /supabase|fetch\(|localStorage|sessionStorage|setItem|\.rpc\(|\.from\(/i);
});

console.log(count + " pruebas ok");
