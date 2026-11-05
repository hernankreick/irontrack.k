// Demostración D76-03 (demo/registro-series.html): solo Preview, datos ficticios, almacenamiento y servidor falsos en memoria, sin
// Supabase ni red.
//
//   node scripts/test-demoRegistroSeries.mjs
//
// Corre los MISMOS escenarios automáticos que el botón "Ejecutar pruebas automáticas" de la pantalla (ejecutarEscenarios).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// Grafo de imports estaticos relativos (y paquetes) desde un archivo (igual que scripts/test-demoSesionesLectura.mjs).
function graph(entry) {
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
  const seen = new Set([path.join(ROOT, entry)]), pkgs = new Set(), q = [...seen];
  while (q.length) {
    const f = q.shift();
    for (const m of fs.readFileSync(f, "utf8").matchAll(re)) {
      const spec = m[1] || m[2] || m[3];
      if (!spec.startsWith(".")) { pkgs.add(spec); continue; }
      const base = path.resolve(path.dirname(f), spec);
      const hit = [base, base + ".js", base + ".jsx"].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      if (hit && !seen.has(hit)) { seen.add(hit); q.push(hit); }
    }
  }
  return { files: [...seen].map((f) => path.relative(ROOT, f).split(path.sep).join("/")), pkgs: [...pkgs] };
}

await test("vite.config: demoRegistro solo entra al build con includeDemo (Preview o local con IRONTRACK_DEMO=1); Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoRegistro: path\.resolve\(__dirname, 'demo\/registro-series\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/registro-series\.html'/g) || []).length, 1, "una sola entrada, dentro de includeDemo");
  const html = read("demo/registro-series.html");
  assert.match(html, /src="\/components\/demo\/registroSeriesDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<title>IRON TRACK · Demo D76-03 series duplicadas<\/title>/);
});

await test("la demo usa la guarda y el panel REALES y no alcanza App.jsx, el cliente de Supabase ni supabase-js", () => {
  const g = graph("components/demo/registroSeriesDemoMain.jsx");
  for (const real of [
    "lib/setLogGuard.js", "components/WorkoutExercisePanel.jsx", "lib/setWriteAhead.js", "lib/progressInsert.js", "lib/pendingSyncQueue.js",
    "lib/workoutSession.js", "components/demo/RegistroSeriesDemo.jsx", "components/demo/registroSeriesDemoData.js",
  ]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningun paquete de supabase: " + g.pkgs.join(", "));
  const index = graph("main.jsx");
  assert.ok(!index.files.some((f) => f.startsWith("components/demo/")), "la app (index.html -> main.jsx) no importa la demo");
  const ui = read("components/demo/RegistroSeriesDemo.jsx");
  assert.match(ui, /<WorkoutExercisePanel[\s\S]*logScope=\{logScope\}/, "monta el panel real con logScope");
  assert.match(ui, /Datos ficticios · sin Supabase · sin login/);
  const data = read("components/demo/registroSeriesDemoData.js");
  assert.match(data, /import \{ createSetLogGuard \} from '\.\.\/\.\.\/lib\/setLogGuard\.js';/);
});

await test("la demo no usa el almacenamiento real ni la red", () => {
  for (const f of ["components/demo/RegistroSeriesDemo.jsx", "components/demo/registroSeriesDemoData.js", "components/demo/registroSeriesDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest/, f);
  }
});

await test("los escenarios automaticos pasan sin red ni almacenamiento real", async () => {
  const realFetch = globalThis.fetch;
  const usos = [];
  globalThis.fetch = () => { usos.push("fetch"); throw new Error("la demo no debe usar la red"); };
  const espia = { getItem: (k) => { usos.push("getItem " + k); return null; }, setItem: (k) => { usos.push("setItem " + k); }, removeItem: (k) => { usos.push("removeItem " + k); }, clear: () => { usos.push("clear"); } };
  const hadLS = "localStorage" in globalThis;
  const realLS = hadLS ? Object.getOwnPropertyDescriptor(globalThis, "localStorage") : null;
  Object.defineProperty(globalThis, "localStorage", { value: espia, configurable: true, writable: true });
  let resultados;
  try {
    const d = await import(path.join(ROOT, "components/demo/registroSeriesDemoData.js"));
    resultados = await d.ejecutarEscenarios({ latenciaMs: 150 });
    assert.match(d.DEMO_ALUMNO_ID, /^demo-/);
    for (const ex of d.DEMO_EJERCICIOS) assert.match(ex.id, /-demo$/);
  } finally {
    globalThis.fetch = realFetch;
    if (realLS) Object.defineProperty(globalThis, "localStorage", realLS); else delete globalThis.localStorage;
  }
  assert.equal(resultados.length, 10);
  for (const r of resultados) {
    console.log("   " + (r.pass ? "PASS" : "FAIL") + " " + r.id + ". " + r.nombre + " · " + r.detalle);
    assert.equal(r.pass, true, r.id + ". " + r.nombre + ": " + r.detalle);
  }
  assert.deepEqual(usos, [], "sin red ni almacenamiento real");
});

console.log("\n" + count + " pruebas OK");
