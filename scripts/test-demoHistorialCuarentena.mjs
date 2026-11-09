// Demostración D76-09 (demo/historial-cuarentena.html): solo Preview, datos ficticios, almacenamiento y servidor falsos en memoria,
// sin Supabase ni red.
//
//   node scripts/test-demoHistorialCuarentena.mjs
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

await test("vite.config: demoHistorial solo entra al build con includeDemo (Preview o local con IRONTRACK_DEMO=1)", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoHistorial: path\.resolve\(__dirname, 'demo\/historial-cuarentena\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/historial-cuarentena\.html'/g) || []).length, 1, "una sola entrada, dentro de includeDemo");
  const html = read("demo/historial-cuarentena.html");
  assert.match(html, /src="\/components\/demo\/historialCuarentenaDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
});

await test("la demo usa la lógica y los componentes REALES y no alcanza App.jsx, el cliente de Supabase ni supabase-js", () => {
  const g = graph("components/demo/historialCuarentenaDemoMain.jsx");
  for (const real of [
    "lib/historialSello.js", "lib/historialCuarentena.js", "lib/pendingSyncController.js", "lib/pendingSyncQueue.js", "lib/setWriteAhead.js",
    "lib/progressInsert.js", "lib/workoutSession.js", "components/workout/PendingSyncIndicator.jsx", "components/workout/HistorialCuarentenaModal.jsx",
  ]) assert.ok(g.files.includes(real), "usa " + real);
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningun paquete de supabase: " + g.pkgs.join(", "));
  const index = graph("main.jsx");
  assert.ok(!index.files.some((f) => f.startsWith("components/demo/")), "la app no importa la demo");
  assert.match(read("components/demo/historialCuarentenaDemoData.js"), /locks: null/, "no usa navigator.locks real");
});

await test("la demo no usa el almacenamiento real ni la red", () => {
  for (const f of ["components/demo/HistorialCuarentenaDemo.jsx", "components/demo/historialCuarentenaDemoData.js", "components/demo/historialCuarentenaDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest|navigator\.(onLine|locks)/, f);
  }
});

await test("los escenarios automáticos pasan sin red ni almacenamiento real", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("la demo no debe usar la red"); };
  try {
    const d = await import(path.join(ROOT, "components/demo/historialCuarentenaDemoData.js"));
    const r = await d.ejecutarEscenarios();
    assert.equal(r.length, 7);
    r.forEach((e) => assert.ok(e.ok, e.nombre + " " + e.detalle));
    assert.match(d.DEMO_ALUMNO, /demo/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

console.log(count + " pruebas OK");
