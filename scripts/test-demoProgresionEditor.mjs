// Maqueta comparativa del editor de progresion (demo/progresion-editor.html): solo Preview, datos ficticios, sin Supabase ni red.
//   node scripts/test-demoProgresionEditor.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

await test("vite.config: la demo entra solo con includeDemo; Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoProgresionEditor: path\.resolve\(__dirname, 'demo\/progresion-editor\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/progresion-editor\.html'\)/g) || []).length, 1);
  const html = read("demo/progresion-editor.html");
  assert.match(html, /src="\/components\/demo\/progresionEditorDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
});

await test("la demo no importa App, Supabase, red ni almacenamiento", () => {
  for (const f of ["components/demo/ProgresionEditorDemo.jsx", "components/demo/progresionEditorDemoData.js", "components/demo/progresionEditorDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /supabase|App\.jsx|fetch\(|localStorage|sessionStorage|XMLHttpRequest/i, f);
  }
});

const D = await import(pathToFileURL(path.join(ROOT, "components/demo/progresionEditorDemoData.js")).href);

await test("los 5 metodos coinciden con los del editor real", () => {
  assert.deepEqual(D.METODOS.map((m) => m.label), ["+ Carga", "+ Reps", "+ Series", "− Pausa", "Manual"]);
  const real = read("components/routines/EditExModal.jsx");
  for (const m of D.METODOS) assert.ok(real.includes(`id:"${m.id}"`), m.id);
});

await test("autocompletar: +2.5 kg, +1 rep, +1 serie, −15 s (min 15); manual no cambia; no toca semanas fuera de rango", () => {
  const base = { sets: "3", reps: "8", kg: "16", pause: "60" };
  const blank = () => Array.from({ length: 4 }, () => ({ sets: "", reps: "", kg: "", pausa: "", note: "n" }));
  assert.deepEqual(D.autocompletar(blank(), base, "carga", 4).map((w) => w.kg), ["16", "18.5", "21", "23.5"]);
  assert.deepEqual(D.autocompletar(blank(), base, "reps", 4).map((w) => w.reps), ["8", "9", "10", "11"]);
  assert.deepEqual(D.autocompletar(blank(), base, "series", 4).map((w) => w.sets), ["3", "4", "5", "6"]);
  assert.deepEqual(D.autocompletar(blank(), base, "pausa", 4).map((w) => w.pausa), ["60", "45", "30", "15"]);
  const w = blank(); assert.equal(D.autocompletar(w, base, "manual", 4), w);
  assert.equal(D.autocompletar(blank(), base, "carga", 2)[3].kg, "");
  assert.equal(D.autocompletar(blank(), base, "carga", 4)[2].note, "n");
});

await test("copiar semana y repetir fila: no copian la nota ni salen del rango", () => {
  const w = D.semanasIniciales();
  const c = D.copyWeek(w, 3, 4);
  assert.equal(c[4].kg, "18"); assert.equal(c[4].note, w[4].note); assert.equal(w[4].kg, "18");
  assert.equal(D.copyWeek(w, 0, 99), w);
  const f = D.fillRight(D.setCell(w, 0, "kg", "30"), "kg", 0, 6);
  assert.deepEqual(f.map((x) => x.kg), ["30", "30", "30", "30", "30", "30", "20", "20"]);
});

await test("datos ficticios: 8 semanas, primeras 6 = tabla del encargo", () => {
  const w = D.semanasIniciales();
  assert.equal(w.length, 8);
  assert.deepEqual(w.slice(0, 6).map((x) => [x.sets, x.reps, x.kg, x.pausa].join("/")), ["3/8/16/60", "3/9/16/60", "3/10/16/60", "3/8/18/60", "3/9/18/60", "3/10/18/60"]);
  assert.equal(D.deltaHint("carga", w[2], w[3]), "+2");
  assert.equal(D.deltaHint("manual", w[2], w[3]), "");
});

console.log(count + " pruebas ok");
