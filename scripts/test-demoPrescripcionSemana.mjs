// Demo de la prescripcion semanal (demo/prescripcion-semana.html): solo Preview, datos ficticios, sin login ni red.
//   node scripts/test-demoPrescripcionSemana.mjs
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
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoPrescripcionSemana: path\.resolve\(__dirname, 'demo\/prescripcion-semana\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/prescripcion-semana\.html'\)/g) || []).length, 1);
  const html = read("demo/prescripcion-semana.html");
  assert.match(html, /src="\/components\/demo\/prescripcionSemanaDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
});

await test("la demo usa el panel REAL y la regla real; no alcanza App, datos, red ni almacenamiento", () => {
  const src = read("components/demo/PrescripcionSemanaDemo.jsx");
  assert.match(src, /\.\.\/WorkoutExercisePanel\.jsx/);
  assert.match(src, /resolveExerciseForWeek/);
  for (const f of ["components/demo/PrescripcionSemanaDemo.jsx", "components/demo/prescripcionSemanaDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /supabase|App\.jsx|fetch\(|localStorage|sessionStorage|XMLHttpRequest/i, f);
  }
});

console.log(count + " pruebas ok");
