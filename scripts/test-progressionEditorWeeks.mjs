// Editor de progresion semanal responsive: logica pura (cantidad de semanas, deteccion, reduccion con confirmacion, guardado) + cableado
// en los DOS editores reales (EditExModal y EditExerciseModal). Sin red ni Supabase.
//   node scripts/test-progressionEditorWeeks.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
const L = await import(pathToFileURL(path.join(ROOT, "components/routines/progressionEditorLogic.js")).href);

const mk = (n, f = (i) => ({ sets: "3", reps: String(8 + i), kg: String(16 + i), pausa: "60", note: "" })) => Array.from({ length: n }, (_, i) => f(i));

await test("deteccion: 4,5,6,7,8 semanas guardadas se detectan tal cual; 0-3 se completan a 4 (como antes)", () => {
  for (const n of [4, 5, 6, 7, 8]) assert.equal(L.detectWeekCount(mk(n)), n);
  for (const n of [0, 1, 3]) assert.equal(L.detectWeekCount(mk(n)), 4);
  assert.equal(L.detectWeekCount(undefined), 4);
  assert.equal(L.detectWeekCount(null), 4);
});

await test("deteccion: mas de 8 semanas NO se recortan y el selector ofrece esa cantidad", () => {
  assert.equal(L.detectWeekCount(mk(10)), 10);
  assert.deepEqual(L.weekOptionsFor(10), [4, 5, 6, 7, 8, 10]);
  assert.deepEqual(L.weekOptionsFor(6), [4, 5, 6, 7, 8]);
  assert.equal(L.initWeeksFull(mk(10)).length, 10);
});

await test("abrir y guardar sin tocar no cambia la cantidad ni los valores (4..8 y 10)", () => {
  for (const n of [4, 5, 6, 7, 8, 10]) {
    const saved = mk(n);
    const full = L.initWeeksFull(saved);
    const out = L.weeksForSave(full, L.detectWeekCount(saved), "90");
    assert.equal(out.length, n);
    assert.deepEqual(out.map((w) => [w.sets, w.reps, w.kg, w.pausa]), saved.map((w) => [w.sets, w.reps, w.kg, w.pausa]));
  }
});

await test("pausa vacia cae en la pausa base al guardar (comportamiento anterior)", () => {
  const out = L.weeksForSave(L.initWeeksFull(mk(4, () => ({ sets: "3", reps: "8", kg: "", pausa: "", note: "" }))), 4, "75");
  assert.deepEqual(out.map((w) => w.pausa), ["75", "75", "75", "75"]);
});

await test("aumentar semanas agrega vacias; reducir sin datos no pide confirmacion", () => {
  const w6 = L.initWeeksFull(mk(6));
  const w8 = L.ensureWeeks(w6, 8);
  assert.equal(w8.length, 8);
  assert.equal(L.weekHasData(w8[7]), false);
  assert.deepEqual(L.weeksLostByReducing(w8, 8, 6), []);
});

await test("reducir con datos: informa las semanas afectadas; los datos siguen en memoria hasta guardar y vuelven al re-aumentar", () => {
  const w8 = L.initWeeksFull(mk(8));
  assert.deepEqual(L.weeksLostByReducing(w8, 8, 6), [6, 7]);
  assert.deepEqual(L.weeksLostByReducing(w8, 8, 4), [4, 5, 6, 7]);
  const saved6 = L.weeksForSave(w8, 6, "60");
  assert.equal(saved6.length, 6);
  assert.equal(L.ensureWeeks(w8, 8)[7].kg, "23");
  const soloNota = L.setWeekField(L.initWeeksFull(mk(6)), 5, "note", "descarga");
  assert.deepEqual(L.weeksLostByReducing(L.ensureWeeks(soloNota, 6), 6, 5), [5]);
});

await test("guardar con la cantidad elegida: exactamente `count` semanas, tambien con >8 reducido explicitamente", () => {
  assert.equal(L.weeksForSave(L.initWeeksFull(mk(10)), 8, "60").length, 8);
  assert.equal(L.weeksForSave(L.initWeeksFull(mk(4)), 7, "60").length, 7);
});

await test("edicion, copiar semana y repetir fila no alteran otras semanas ni la nota", () => {
  const w = L.initWeeksFull(mk(6, (i) => ({ sets: "3", reps: "8", kg: String(16 + i), pausa: "60", note: i === 3 ? "n" : "" })));
  const e = L.setWeekField(w, 2, "kg", "99");
  assert.equal(e[2].kg, "99"); assert.equal(w[2].kg, "18");
  const c = L.copyWeekValues(w, 0, 3);
  assert.equal(c[3].kg, "16"); assert.equal(c[3].note, "n");
  assert.deepEqual(L.fillRowRight(w, "kg", 0, 5).map((x) => x.kg), ["16", "16", "16", "16", "16", "21"]);
});

await test("autocompletado: +2.5 kg, +1 rep, +1 serie, -15 s (min 15), manual intacto, solo semanas visibles", () => {
  const base = { sets: "3", reps: "8", kg: "16", pause: "60" };
  const filled = (f) => L.initWeeksFull(mk(5, (i) => f(i)));
  const seed = filled((i) => ({ sets: "3", reps: "8", kg: i ? "" : "16", pausa: "60", note: "x" }));
  const carga = L.autocompleteWeeks(seed, base, "carga", 4);
  assert.equal(carga[1].kg, "18.5"); assert.equal(carga[1].note, "x");
  assert.equal(carga[4].kg, "", "fuera del rango visible no se toca");
  const seed2 = filled((i) => ({ sets: "3", reps: i ? "" : "8", kg: "16", pausa: i ? "" : "60", note: "" }));
  assert.equal(L.autocompleteWeeks(seed2, base, "reps", 4)[1].reps, "9");
  assert.equal(L.autocompleteWeeks(seed2, base, "series", 4)[1].sets, "4");
  assert.equal(L.autocompleteWeeks(seed2, base, "pausa", 4)[1].pausa, "45");
  assert.equal(L.autocompleteWeeks(L.initWeeksFull(mk(4, () => ({ sets: "3", reps: "8", kg: "16", pausa: "20", note: "" }))), base, "pausa", 4)[1].pausa, "15");
  const w = L.initWeeksFull(mk(4));
  assert.equal(L.autocompleteWeeks(w, base, "manual", 4), w);
});

await test("deltas por metodo con el mismo formato que mostraban los editores", () => {
  const a = { sets: "3", reps: "8", kg: "16", pausa: "60" }, b = { sets: "4", reps: "10", kg: "18.5", pausa: "45" };
  assert.equal(L.deltaHint("carga", a, b), "+2.5 kg");
  assert.equal(L.deltaHint("reps", a, b), "+2 reps");
  assert.equal(L.deltaHint("series", a, b), "+1 series");
  assert.equal(L.deltaHint("pausa", a, b), "-15s pausa");
  assert.equal(L.deltaHint("manual", a, b), "");
  assert.equal(L.deltaHint("carga", a, { ...a }), "", "sin cambio no muestra delta");
});

await test("cableado: ambos editores usan el componente y la logica compartidos y guardan con weeksForSave", () => {
  for (const f of ["components/routines/EditExModal.jsx", "components/EditExerciseModal.jsx"]) {
    const src = read(f);
    assert.match(src, /ProgressionWeeksEditor/, f);
    assert.match(src, /weeksForSave\(/, f);
    assert.match(src, /detectWeekCount\(/, f);
    assert.doesNotMatch(src, /slice\(\s*0\s*,\s*4\s*\)/, f + ": ya no recorta a 4 semanas");
  }
});

await test("EditExerciseModal inicializa semanas y cantidad desde el ejercicio al primer render (sin parpadeo a 4)", () => {
  const src = read("components/EditExerciseModal.jsx");
  assert.match(src, /useState\(\(\) => initWeeksFull\(exercise\?\.weeks\)\)/);
  assert.match(src, /useState\(\(\) => detectWeekCount\(exercise\?\.weeks\)\)/);
});

await test("alcance: el editor no usa red, Supabase ni almacenamiento", () => {
  for (const f of ["components/routines/ProgressionWeeksEditor.jsx", "components/routines/progressionEditorLogic.js"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /supabase|fetch\(|localStorage|sessionStorage|XMLHttpRequest/i, f);
  }
});

console.log(count + " pruebas ok");
