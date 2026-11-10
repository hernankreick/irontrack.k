// Demo del PDF de rutina (demo/pdf-rutina.html): solo Preview, datos ficticios, sin login ni red propia.
//   node scripts/test-demoPdfRutina.mjs
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
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoPdfRutina: path\.resolve\(__dirname, 'demo\/pdf-rutina\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/pdf-rutina\.html'\)/g) || []).length, 1);
  const html = read("demo/pdf-rutina.html");
  assert.match(html, /src="\/components\/demo\/pdfRutinaDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
});

await test("la demo usa el exportador REAL y no alcanza App, el cliente de datos, la red ni el almacenamiento", () => {
  const src = read("components/demo/PdfRutinaDemo.jsx");
  assert.match(src, /lib\/routinePdfExport\.js/);
  assert.match(src, /buildRoutinePdfRows/);
  for (const f of ["components/demo/PdfRutinaDemo.jsx", "components/demo/pdfRutinaDemoMain.jsx", "components/demo/pdfRutinaDemoData.js"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /supabase|App\.jsx|fetch\(|localStorage|sessionStorage|XMLHttpRequest/i, f);
  }
});

await test("rutinas ficticias de 4, 5, 6, 7 y 8 semanas disponibles en el selector, con datos sin personas reales", async () => {
  const D = await import(pathToFileURL(path.join(ROOT, "components/demo/pdfRutinaDemoData.js")).href);
  const ids = D.RUTINAS_DEMO.map((x) => x.id);
  for (const id of ["4", "5", "6", "7", "8", "mixta", "borde", "larga"]) assert.ok(ids.includes(id), id);
  for (const n of [4, 5, 6, 7, 8]) {
    const r = D.RUTINAS_DEMO.find((x) => x.id === String(n)).build();
    r.days.forEach((d) => [].concat(d.warmup, d.exercises).forEach((e) => assert.equal(e.weeks.length, n)));
    assert.equal(r.alumno, "Alumno Demo");
  }
});

console.log(count + " pruebas ok");
