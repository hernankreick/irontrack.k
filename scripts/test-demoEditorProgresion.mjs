// Demo del editor de progresion real (demo/editor-progresion.html): solo Preview, datos ficticios, sin Supabase ni red.
//   node scripts/test-demoEditorProgresion.mjs
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
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoEditorProgresion: path\.resolve\(__dirname, 'demo\/editor-progresion\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/editor-progresion\.html'\)/g) || []).length, 1);
  const html = read("demo/editor-progresion.html");
  assert.match(html, /src="\/components\/demo\/editorProgresionRealDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
});

await test("la demo usa los DOS editores reales y no alcanza App, Supabase, red ni almacenamiento", () => {
  const src = read("components/demo/EditorProgresionRealDemo.jsx");
  assert.match(src, /routines\/EditExModal\.jsx/);
  assert.match(src, /\.\.\/EditExerciseModal\.jsx/);
  for (const f of ["components/demo/EditorProgresionRealDemo.jsx", "components/demo/editorProgresionRealDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /supabase|App\.jsx|fetch\(|localStorage|sessionStorage|XMLHttpRequest/i, f);
  }
});

await test("ejercicios ficticios: 4,5,6,7,8 y 10 semanas, y uno sin semanas guardadas", () => {
  const src = read("components/demo/EditorProgresionRealDemo.jsx");
  for (const n of [4, 5, 6, 7, 8, 10]) assert.match(src, new RegExp("\\(" + n + " sem"));
  assert.match(src, /weeks: \[\]/);
});

console.log(count + " pruebas ok");
