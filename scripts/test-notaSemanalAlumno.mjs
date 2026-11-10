// Nota del entrenador por SEMANA (ex.weeks[i].note) visible para el alumno en Inicio y durante el entrenamiento.
//   node scripts/test-notaSemanalAlumno.mjs
// Causa raiz: la nota SI se guarda y se carga (weeks[i].note), pero ninguna pantalla del alumno la leia: la vista Plan usaba
// weeks[semana].sets/reps/kg y el entrenamiento en curso la prescripcion base; solo el editor del entrenador mostraba la nota.
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

const H = await imp("components/student-plan/studentPlanHelpers.js");
const ED = await imp("components/routines/progressionEditorLogic.js");
const EX = await imp("lib/exerciseResolve.js");
const RS = await imp("lib/routineStore.js");

const HIP = "5×60 kg\n3×100 kg\n1×125";
const hip = () => ({
  id: "hip", name: "Hip thrust", sets: "3", reps: "8", kg: "60", pause: 90,
  weeks: [
    { sets: "3", reps: "8", kg: "60", pausa: "90", note: HIP },
    { sets: "3", reps: "8", kg: "70", pausa: "90", note: "Semana 2: subir 10 kg" },
    { sets: "3", reps: "8", kg: "80", pausa: "90", note: "" },
    { sets: "3", reps: "8", kg: "90", pausa: "90", note: "Descarga\n\n  (dejar 2 reps en reserva)" },
  ],
});

await test("nota de la semana activa: devuelve exactamente la de esa semana (semanas 1 a 4 distintas)", () => {
  const e = hip();
  assert.equal(H.getExerciseWeekNote(e, 0), HIP);
  assert.equal(H.getExerciseWeekNote(e, 1), "Semana 2: subir 10 kg");
  assert.equal(H.getExerciseWeekNote(e, 2), "", "semana 3 sin nota: no hereda la de otra semana");
  assert.equal(H.getExerciseWeekNote(e, 3), "Descarga\n\n  (dejar 2 reps en reserva)");
});

await test("sin nota nunca se inventa: vacia, solo espacios, sin weeks, semana inexistente, indice invalido, tipos raros", () => {
  const e = hip();
  assert.equal(H.getExerciseWeekNote(e, 4), "");
  assert.equal(H.getExerciseWeekNote(e, 99), "");
  for (const bad of [-1, 1.5, NaN, null, undefined, "1", {}]) assert.equal(H.getExerciseWeekNote(e, bad), "", String(bad));
  assert.equal(H.getExerciseWeekNote({ weeks: [{ note: "   \n\t " }] }, 0), "");
  assert.equal(H.getExerciseWeekNote({ weeks: [{ note: 5 }] }, 0), "");
  assert.equal(H.getExerciseWeekNote({ weeks: [null, "x", 3, {}] }, 0), "");
  assert.equal(H.getExerciseWeekNote({ weeks: [null, "x", 3, {}] }, 3), "");
  for (const none of [{}, { weeks: null }, { weeks: "x" }, { weeks: [] }, null, undefined]) assert.equal(H.getExerciseWeekNote(none, 0), "");
  assert.equal(H.getExerciseWeekNote({ note: "nota base del ejercicio", weeks: [] }, 0), "", "la nota base (ex.note) no se confunde con la semanal");
});

await test("saltos de linea y contenido original se conservan (sin recortar ni reformatear)", () => {
  const larga = "L1\nL2\r\nL3  con  espacios\n\n" + "x".repeat(500) + "\n  sangria final  ";
  assert.equal(H.getExerciseWeekNote({ weeks: [{ note: larga }] }, 0), larga);
});

await test("persistencia: guardar desde el editor, asignar a un alumno y recargar conserva las notas de todas las semanas", () => {
  const e = hip();
  // guardado del editor (EditExModal / EditExerciseModal): weeksForSave + sanitizeExerciseSnapshotForWrite
  const saved = EX.sanitizeExerciseSnapshotForWrite({ ...e, weeks: ED.weeksForSave(ED.initWeeksFull(e.weeks), 4, 90) });
  assert.deepEqual(saved.weeks.map((w) => w.note), e.weeks.map((w) => w.note));
  // asignacion a un alumno (cuerpo que se inserta) -> JSON en la base -> lectura -> normalizeRutina
  const plantilla = { nombre: "Rutina", days: [{ label: "Dia 1", warmup: [], exercises: [saved] }] };
  const body = RS.buildRutinaInsertBody({ alumno: { id: "al1", nombre: "Alumno Demo" }, rutina: plantilla, alumnoId: "al1", entrenadorId: "en1" });
  const row = JSON.parse(JSON.stringify({ id: "r1", nombre: body.nombre, alumno_id: "al1", datos: body.datos }));
  const cargada = RS.normalizeRutina(row);
  const ex = cargada.days[0].exercises[0];
  for (let i = 0; i < 4; i++) assert.equal(H.getExerciseWeekNote(ex, i), e.weeks[i].note.trim() === "" ? "" : e.weeks[i].note, "semana " + (i + 1));
  assert.equal(JSON.stringify(ex.weeks), JSON.stringify(saved.weeks), "las semanas no cambian al guardar y recargar");
});

await test("guardar de nuevo no pisa ni borra las notas existentes (editor + sanitize son idempotentes)", () => {
  const e = hip();
  const una = EX.sanitizeExerciseSnapshotForWrite({ ...e, weeks: ED.weeksForSave(ED.initWeeksFull(e.weeks), 4, 90) });
  const dos = EX.sanitizeExerciseSnapshotForWrite({ ...una, weeks: ED.weeksForSave(ED.initWeeksFull(una.weeks), 4, 90) });
  assert.equal(JSON.stringify(dos.weeks), JSON.stringify(una.weeks));
});

// ── Render real (SSR con esbuild) ──
async function loadRender() {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-nota-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents:
        'import React from "react";' +
        'import { renderToStaticMarkup } from "react-dom/server";' +
        'import StudentPlanExerciseRows from "./components/student-plan/StudentPlanExerciseRows.jsx";' +
        'import ExerciseWeekNote from "./components/student-plan/ExerciseWeekNote.jsx";' +
        'import { WorkoutExercisePanel } from "./components/WorkoutExercisePanel.jsx";' +
        "export { React, renderToStaticMarkup, StudentPlanExerciseRows, ExerciseWeekNote, WorkoutExercisePanel };",
      resolveDir: ROOT, sourcefile: "nota-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", jsx: "automatic",
    alias: { "@": ROOT },
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  return import(pathToFileURL(outfile).href);
}
const R = await loadRender();
const msg = (a) => a;
const rows = (day, week, extra) => R.renderToStaticMarkup(R.React.createElement(R.StudentPlanExerciseRows, {
  day, routineId: "r1", dayIndex: 0, allEx: [], currentWeekForRoutine: week, border: "#2D4057", textMain: "#fff", msg, es: true,
  fmtP: (s) => s + "s", renderExerciseVideoButton: () => null, ...(extra || {}),
}));
const notesIn = (html) => [...html.matchAll(/data-week-note=""/g)].length;

await test("Inicio: en la semana activa se muestra «Nota del entrenador» debajo de la prescripcion, con el texto original", () => {
  const html = rows({ warmup: [], exercises: [hip()] }, 0);
  assert.equal(notesIn(html), 1);
  assert.match(html, /Nota del entrenador/);
  assert.ok(html.includes("5×60 kg\n3×100 kg\n1×125"), "saltos de linea originales en el HTML");
  assert.match(html, /white-space:pre-wrap/, "se muestran como lineas (pre-wrap)");
  const iPresc = html.indexOf("3×8"), iNota = html.indexOf("Nota del entrenador");
  assert.ok(iPresc > 0 && iNota > iPresc, "la nota va despues de la prescripcion");
});

await test("Inicio: cambio de semana 1 a 4: aparece solo la nota de esa semana y nunca las de otras", () => {
  const e = hip();
  const esperado = ["5×60 kg", "Semana 2: subir 10 kg", null, "Descarga"];
  for (let w = 0; w < 4; w++) {
    const html = rows({ warmup: [], exercises: [e] }, w);
    if (esperado[w] === null) { assert.equal(notesIn(html), 0, "semana 3 sin nota: no hay apartado"); assert.doesNotMatch(html, /Nota del entrenador/); }
    else assert.equal(notesIn(html), 1);
    esperado.forEach((t, k) => { if (t && k !== w) assert.ok(!html.includes(t), `semana ${w + 1} no muestra la nota de la semana ${k + 1}`); });
    if (esperado[w]) assert.ok(html.includes(esperado[w]));
  }
  assert.equal(notesIn(rows({ warmup: [], exercises: [e] }, 4)), 0, "semana fuera de rango: sin nota");
});

await test("Inicio: ejercicio sin nota no cambia nada (sin apartado, mismo markup que sin la funcion)", () => {
  const sin = { id: "s", name: "Sentadilla", sets: "3", reps: "8", kg: "40", pause: 60, weeks: [{ sets: "3", reps: "8", kg: "40", note: "" }] };
  const html = rows({ warmup: [], exercises: [sin] }, 0);
  assert.equal(notesIn(html), 0);
  assert.doesNotMatch(html, /Nota del entrenador|flex-wrap:wrap;border-bottom/);
  const sinWeeks = { id: "s2", name: "Plancha", sets: "3", reps: "30s", weeks: [] };
  assert.equal(notesIn(rows({ warmup: [], exercises: [sinWeeks] }, 0)), 0);
});

await test("Inicio: la entrada en calor tambien muestra la nota de su semana", () => {
  const w = { id: "wu", name: "Movilidad", sets: "2", reps: "10", weeks: [{ note: "Sin dolor" }, { note: "" }] };
  assert.equal(notesIn(rows({ warmup: [w], exercises: [] }, 0)), 1);
  assert.equal(notesIn(rows({ warmup: [w], exercises: [] }, 1)), 0);
});

await test("Inicio: notas extensas/multilinea no desbordan (overflow-wrap) y el texto se escapa (sin HTML inyectado)", () => {
  const larga = "A".repeat(600) + "\n" + "<img src=x onerror=alert(1)> & \"comillas\"";
  const html = rows({ warmup: [], exercises: [{ ...hip(), weeks: [{ note: larga }] }] }, 0);
  assert.ok(html.includes("A".repeat(600)));
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;comillas&quot;"));
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /overflow-wrap:anywhere/);
});

await test("cambio de alumno / rutina: cada render muestra solo las notas de SU dia (sin estado compartido entre alumnos)", () => {
  const a = { warmup: [], exercises: [{ id: "x", name: "Press", sets: "3", reps: "8", weeks: [{ note: "NOTA-ALUMNO-A" }] }] };
  const b = { warmup: [], exercises: [{ id: "x", name: "Press", sets: "3", reps: "8", weeks: [{ note: "" }] }] };
  const c = { warmup: [], exercises: [{ id: "x", name: "Press", sets: "3", reps: "8", weeks: [{ note: "NOTA-ALUMNO-C" }] }] };
  const hA = rows(a, 0), hB = rows(b, 0), hC = rows(c, 0);
  assert.ok(hA.includes("NOTA-ALUMNO-A") && !hA.includes("NOTA-ALUMNO-C"));
  assert.equal(notesIn(hB), 0);
  assert.ok(hC.includes("NOTA-ALUMNO-C") && !hC.includes("NOTA-ALUMNO-A"));
  assert.ok(!rows(a, 0).includes("NOTA-ALUMNO-C"), "volver a A no arrastra la nota de C");
});

await test("componente ExerciseWeekNote: no renderiza nada sin contenido y respeta el tema claro/oscuro", () => {
  const r = (n, dark) => R.renderToStaticMarkup(R.React.createElement(R.ExerciseWeekNote, { note: n, msg, dark }));
  for (const n of ["", "   \n ", null, undefined, 5]) assert.equal(r(n, true), "");
  assert.match(r("hola", true), /Nota del entrenador/);
  assert.notEqual(r("hola", true), r("hola", false));
});

await test("entrenamiento en curso: el panel del ejercicio muestra la nota de la semana activa y solo esa", () => {
  const panel = (ex, week) => R.renderToStaticMarkup(R.React.createElement(R.WorkoutExercisePanel, {
    activeExIdx: 0, setActiveExIdx() {}, exercises: [ex], ex, info: null, pat: { color: "#2563EB", icon: "E" },
    setsHoy: [], totalSets: 3, setsRestantes: 3, setActualNum: 1, ultimoSet: null, pr: 0, es: true, darkMode: true,
    bgCard: "#162234", bgSub: "#0F1923", border: "#2D4057", textMain: "#fff", textMuted: "#8B9AB2", sessionPRList: [],
    videoOverrides: {}, setVideoModal() {}, currentWeek: week, logSet() {}, startTimer() {}, setPrCelebration() {},
    rutinaDatos: {}, progress: {}, logScope: "a|r|0|1",
  }));
  const e = hip();
  const h0 = panel(e, 0), h1 = panel(e, 1), h2 = panel(e, 2);
  assert.ok(h0.includes("5×60 kg\n3×100 kg\n1×125") && /Nota del entrenador/.test(h0));
  assert.ok(h1.includes("Semana 2: subir 10 kg") && !h1.includes("5×60 kg"));
  assert.equal(notesIn(h2), 0);
  assert.equal(notesIn(panel({ ...e, weeks: [] }, 0)), 0);
});

await test("alcance: el cambio es de solo lectura (sin red/almacenamiento), no toca «Nota del dia», App.jsx, lib/, progresion ni Supabase", () => {
  for (const f of ["components/student-plan/ExerciseWeekNote.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /supabase|fetch\(|localStorage|sessionStorage|XMLHttpRequest|setItem/i, f);
  }
  assert.match(read("components/student-plan/StudentPlanExerciseRows.jsx"), /getExerciseWeekNote\(ex, currentWeekForRoutine\)/);
  assert.match(read("components/WorkoutExercisePanel.jsx"), /getExerciseWeekNote\(ex, currentWeek\)/);
  const nota = read("App.jsx").match(/notaDia&&\(/g) || [];
  assert.ok(nota.length >= 1, "la «Nota del dia» sigue en App.jsx sin cambios");
});

console.log(count + " pruebas ok");
