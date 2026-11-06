// Demostración D7.6 (demo/cargas-historial.html): solo Preview, datos ficticios, servidor en memoria, sin Supabase ni red.
//   node scripts/test-demoCargasHistorial.mjs
// (a) vite.config: la demo entra solo con includeDemo; (b) grafo de imports: usa la logica real y no alcanza App.jsx ni Supabase; (c) corre
// los MISMOS escenarios automaticos que el boton de la pantalla; (d) SSR del componente con el panel real.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
const FUENTES = ["components/demo/CargasHistorialDemo.jsx", "components/demo/cargasHistorialDemoData.js", "components/demo/cargasHistorialDemoMain.jsx"];
const sinComentarios = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

await test("vite.config: demoCargas solo entra al build con includeDemo; Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoCargas: path\.resolve\(__dirname, 'demo\/cargas-historial\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/cargas-historial\.html'/g) || []).length, 1, "una sola entrada, dentro de includeDemo");
  const html = read("demo/cargas-historial.html");
  assert.match(html, /src="\/components\/demo\/cargasHistorialDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /solo existe en builds de Preview/);
});

await test("la demo usa la logica REAL (panel, validacion, lectura paginada, controlador) y no alcanza App.jsx ni Supabase", () => {
  const g = graph("components/demo/cargasHistorialDemoMain.jsx");
  for (const real of ["lib/cargaSerie.js", "lib/workoutSession.js", "lib/sesionesHistorial.js", "lib/sesionesLectura.js",
    "components/WorkoutExercisePanel.jsx", "components/student-progress/ProgressSessionsPanel.jsx", "components/student-progress/progressMetrics.js"]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningun paquete de supabase: " + g.pkgs.join(", "));
  assert.ok(!graph("main.jsx").files.some((f) => f.startsWith("components/demo/")), "la app no importa la demo");
  const data = sinComentarios(read("components/demo/cargasHistorialDemoData.js"));
  for (const fn of ["serieRegistrable", "canLogWorkoutSet", "calculateNewWeightPR", "buildProgressPayload", "leerSesionesAlumnoCompletas", "crearControladorSesiones", "computeDayStreak"]) {
    assert.match(data, new RegExp("\\b" + fn + "\\("), "llama a " + fn);
  }
});

await test("la demo no usa el almacenamiento real ni la red", () => {
  for (const f of FUENTES) {
    const code = sinComentarios(read(f));
    assert.doesNotMatch(code, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest|navigator\./, f);
  }
});

await test("los escenarios automaticos pasan sin red ni almacenamiento real", async () => {
  const realFetch = globalThis.fetch;
  let usos = 0;
  globalThis.fetch = () => { usos++; throw new Error("la demo no debe usar la red"); };
  let resultados;
  try {
    const d = await import(pathToFileURL(path.join(ROOT, "components/demo/cargasHistorialDemoData.js")).href);
    resultados = await d.ejecutarEscenarios();
    assert.ok(d.DEMO_EJERCICIOS.every((e) => /-demo$/.test(e.id)));
    assert.ok(d.crearSesionesDemo(26).filter((r) => r.alumno_id === d.DEMO_ALUMNO_ID).length === 26);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(resultados.length, 10);
  for (const r of resultados) {
    console.log("   " + (r.pass ? "PASS" : "FAIL") + " " + r.nombre + (r.detalle ? " · " + r.detalle : ""));
    assert.equal(r.pass, true, r.nombre + ": " + r.detalle);
  }
  assert.equal(usos, 0);
});

await test("SSR del componente: panel real, comparacion antes/ahora y botones de 44 px", async () => {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-ch-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents:
        'import React from "react";' +
        'import { renderToStaticMarkup } from "react-dom/server";' +
        'import CargasHistorialDemo from "./components/demo/CargasHistorialDemo.jsx";' +
        "export { React, renderToStaticMarkup, CargasHistorialDemo };",
      resolveDir: ROOT, sourcefile: "demo-ch-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    jsx: "automatic",
    alias: { "@": ROOT },
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  const { React, renderToStaticMarkup, CargasHistorialDemo } = await import(pathToFileURL(outfile).href);
  const html = renderToStaticMarkup(React.createElement(CargasHistorialDemo));
  for (const txt of ["Datos ficticios · sin Supabase · sin login", "1 · Validación de cargas", "REGISTRAR", "Lo que llega al servidor",
    "2 · Historial de sesiones", "Antes (limit=10)", "Sesiones completadas", "Racha (días)", "Logro «20 sesiones»", "Falla página 2", "Correr escenarios"]) {
    assert.ok(html.includes(txt), "falta: " + txt);
  }
  const ui = read("components/demo/CargasHistorialDemo.jsx");
  assert.match(ui, /\.chd-btn \{[^}]*min-width:44px; min-height:44px;/);
  assert.match(ui, /overflow-x:hidden/);
});

console.log("\n" + count + " pruebas OK");
