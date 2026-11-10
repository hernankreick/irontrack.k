// Demo de la nota semanal (demo/nota-semanal.html): solo Preview, datos ficticios, sin login ni red.
//   node scripts/test-demoNotaSemanal.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

await test("vite.config: la demo entra solo con includeDemo; Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoNotaSemanal: path\.resolve\(__dirname, 'demo\/nota-semanal\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/nota-semanal\.html'\)/g) || []).length, 1);
  const html = read("demo/nota-semanal.html");
  assert.match(html, /src="\/components\/demo\/notaSemanalDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
});

await test("la demo usa las pantallas REALES (Inicio y entrenamiento) y no alcanza App, datos, red ni almacenamiento", () => {
  const src = read("components/demo/NotaSemanalDemo.jsx");
  assert.match(src, /student-plan\/StudentPlanExerciseRows\.jsx/);
  assert.match(src, /\.\.\/WorkoutExercisePanel\.jsx/);
  for (const f of ["components/demo/NotaSemanalDemo.jsx", "components/demo/notaSemanalDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /supabase|App\.jsx|fetch\(|localStorage|sessionStorage|XMLHttpRequest/i, f);
  }
});

console.log(count + " pruebas ok");
