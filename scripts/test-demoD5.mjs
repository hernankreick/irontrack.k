// D5 (fase de diseno) — demostracion de la PROPUESTA de Dashboard (demo/dashboard-d5.html): solo Preview, sin Supabase, sin red y sin
// tocar el Dashboard real.
//
//   node scripts/test-demoD5.mjs
//
// Verifica: (1) vite.config solo la compila en Preview; (2) no alcanza App.jsx ni Supabase y la app no la importa; (3) el modelo usa las
// metricas reales (D3/D4/E1) en los 6 estados y coincide con el Dashboard real; (4) builds REALES: Production sin la demo, Preview con ella.
// La verificacion en navegador (375/390/430/1280, oscuro y claro, navegacion) esta en scripts/qa/demo-d5.mjs.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const DEMO = "demo/dashboard-d5.html";
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

await test("vite.config: la demo D5 solo entra al build en Preview (o local con IRONTRACK_DEMO=1)", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoD5: path\.resolve\(__dirname, 'demo\/dashboard-d5\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.match(read(DEMO), /src="\/components\/demo\/dashboardD5DemoMain\.jsx"/);
  assert.match(read(DEMO), /noindex/);
});

await test("aislamiento: la demo no alcanza App.jsx ni Supabase; la app (main.jsx) no importa la propuesta; el Dashboard real no la usa", () => {
  const g = graph("components/demo/dashboardD5DemoMain.jsx");
  for (const f of ["components/demo/d5/DashboardD5Propuesta.jsx", "components/demo/d5/modeloDashboardD5.js", "components/CoachDashboard.jsx",
    "components/coach/coachDashboardNav.js", "components/students/StudentsSection.jsx", "components/ProgresoView.jsx", "lib/coachStudentListSelectors.js"]) {
    assert.ok(g.files.includes(f), "usa " + f);
  }
  assert.ok(!g.files.includes("App.jsx"));
  assert.ok(!g.files.includes("lib/supabaseClient.js"));
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), g.pkgs.join(", "));
  assert.ok(!graph("main.jsx").files.some((f) => f.startsWith("components/demo/")), "la app no importa ninguna demo");
  for (const f of ["components/CoachDashboard.jsx", "components/coach/CoachDashboardMain.jsx", "App.jsx"]) assert.doesNotMatch(read(f), /d5|D5Propuesta/, f + " no referencia la propuesta");
});

// ---- modelo con las funciones reales (bundle con esbuild) ----
const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-d5-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react"; import { renderToStaticMarkup } from "react-dom/server";' +
      'import { modeloDashboardD5 } from "./components/demo/d5/modeloDashboardD5.js";' +
      'import { escenarioD5 } from "./components/demo/d5/dashboardD5DemoData.js";' +
      'import DashboardD5Propuesta from "./components/demo/d5/DashboardD5Propuesta.jsx";' +
      'import CoachDashboard from "./components/CoachDashboard.jsx";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      "export { React, renderToStaticMarkup, modeloDashboardD5, escenarioD5, DashboardD5Propuesta, CoachDashboard, selectCoachStudentListState };",
    resolveDir: ROOT, sourcefile: "d5-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const X = await import(pathToFileURL(outfile).href);
const mod = (id) => X.modeloDashboardD5(X.escenarioD5(id));
const nombres = (l) => l.map((a) => a.nombre.split(" ")[0]);

await test("estado «Requieren atención»: resumen y grupos con las reglas reales (sin rutina, inactivo 21 dias, baja actividad de D3)", () => {
  const m = mod("atencion");
  assert.equal(m.estado, "ok");
  assert.equal(m.equipo.total, 7);
  assert.deepEqual([nombres(m.seguimiento.sinRutina), nombres(m.seguimiento.inactivos), nombres(m.seguimiento.baja)], [["Cami"], ["Ana"], ["Beto"]]);
  assert.equal(m.equipo.requierenSeguimiento, 3);
  assert.equal(m.equipo.entrenaronSemana, 4, "Dora, Eli, Fede y Gabi (rachaSemanal de E1)");
  assert.ok(m.equipo.adherenciaPct != null);
  assert.ok(!m.recientes.some((r) => /Ana|Beto|Cami/.test(r.alumno.nombre)), "actividad reciente: solo quienes entrenaron en 14 dias");
  for (let i = 1; i < m.recientes.length; i++) assert.ok(m.recientes[i - 1].dia >= m.recientes[i].dia, "mas reciente primero");
});

await test("coherencia: la adherencia de la propuesta es la MISMA que muestra el Dashboard real con los mismos datos", () => {
  const esc = X.escenarioD5("atencion");
  const m = X.modeloDashboardD5(esc);
  const cat = X.selectCoachStudentListState({ alumnosActivosLimpios: esc.alumnos, rutinasUnificadas: esc.rutinas, sesionesGlobalesLimpias: esc.sesiones, progresoGlobalLimpio: {}, coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now() }).coachAlumnoCategoria;
  const html = X.renderToStaticMarkup(X.React.createElement(X.CoachDashboard, { alumnos: esc.alumnos, sesionesGlobales: esc.sesiones, progresoGlobal: {}, historiaCompleta: esc.historiaCompleta, rutinasSBEntrenador: esc.rutinas, getAlumnoCategoria: cat, lang: "es" }))
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(html, new RegExp("Adherencia semanal \\d+ / \\d+ " + m.equipo.adherenciaPct + "%"));
  assert.match(html, new RegExp(m.seguimiento.baja.length + " alumnos con baja actividad"));
  assert.match(html, new RegExp(m.seguimiento.inactivos.length + " alumnos inactivos"));
  assert.match(html, new RegExp(m.seguimiento.sinRutina.length + " alumnos sin rutina"));
});

await test("estados: al dia, sin alumnos, sin rutinas, cargando e historial incompleto (sin porcentajes ni ceros inventados)", () => {
  const n = mod("normal");
  assert.equal(n.equipo.requierenSeguimiento, 0);
  assert.equal(n.recientes.length, 4);
  assert.equal(mod("sinAlumnos").estado, "sin_alumnos");
  const c = mod("cargando");
  assert.equal(c.estado, "cargando");
  assert.deepEqual([c.equipo.entrenaronSemana, c.equipo.adherenciaPct, c.equipo.requierenSeguimiento], [null, null, null], "nada de 0 mientras carga");
  const s = mod("sinRutinas");
  assert.equal(s.equipo.adherenciaPct, null, "sin plan: sin porcentaje");
  assert.equal(s.seguimiento.sinRutina.length, 3);
  const i = mod("incompleto");
  assert.equal(i.equipo.historialIncompleto, true);
  assert.equal(i.equipo.adherenciaDelta, null);
  assert.equal(i.equipo.motivoSinDelta, "historial_incompleto");
});

await test("propuesta (SSR): textos de cada estado, sin «/100», sin «faltan N sesiones» ni graficos decorativos", () => {
  const html = (id, extra) => X.renderToStaticMarkup(X.React.createElement(X.DashboardD5Propuesta, Object.assign({ modelo: mod(id), darkMode: true, onVerPerfil() {} }, extra || {})))
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const a = html("atencion");
  assert.match(a, /Esta semana lun \d+\/\d+ – hoy/);
  assert.match(a, /Requieren seguimiento Sin rutina Cami Díaz 1 .*Inactivos Más de 21 días · Ana Gómez 1 .*Baja actividad Beto Ruiz 1/);
  assert.match(a, /Actividad reciente Ver alumnos/);
  assert.match(a, /Acciones rápidas Nuevo alumno Crear rutina Ver alumnos Progreso/);
  assert.doesNotMatch(a, /\/100|Te faltan|Rendimiento/);
  assert.match(html("normal"), /Nadie requiere seguimiento esta semana/);
  assert.match(html("sinAlumnos"), /Todavía no tenés alumnos.*Agregar alumno/);
  assert.match(html("cargando"), /Alumnos — Entrenaron — Cargando… Adherencia — Cargando… Seguimiento — Cargando…/);
  assert.match(html("sinRutinas"), /Adherencia — Sin plan semanal/);
  assert.match(html("incompleto"), /Historial incompleto: .*Sin comparación \(historial incompleto\)/);
  const src = read("components/demo/d5/DashboardD5Propuesta.jsx");
  assert.doesNotMatch(src, /<svg|gauge|strokeDashoffset/, "sin graficos decorativos");
});

await test("builds reales: Production NO contiene la demo D5 (HTML ni codigo); Preview si", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-d5-build-"));
  const base = { ...process.env, VITE_SUPABASE_URL: "https://ci-simulado.example.com", VITE_SUPABASE_ANON_KEY: "ci-simulada-anon-key-0123456789", VERCEL: "1" };
  delete base.IRONTRACK_DEMO;
  const b = (env) => {
    const out = path.join(tmp, env);
    const r = spawnSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: { ...base, VERCEL_ENV: env }, encoding: "utf8" });
    assert.equal(r.status, 0, env + ": " + (r.stderr || r.stdout || "").slice(-300));
    return out;
  };
  const marcas = /DEMO D5|d5-propuesta|demo-entrenador-d5/;
  const tiene = (out) => fs.existsSync(path.join(out, DEMO)) || fs.readdirSync(path.join(out, "assets")).some((f) => f.endsWith(".js") && marcas.test(fs.readFileSync(path.join(out, "assets", f), "utf8")));
  const prod = b("production");
  assert.ok(!fs.existsSync(path.join(prod, "demo")), "Production sin carpeta demo/");
  assert.ok(!tiene(prod), "Production sin la demo D5");
  assert.ok(tiene(b("preview")), "Preview con la demo D5");
  fs.rmSync(tmp, { recursive: true, force: true });
});

console.log("\n" + count + " pruebas OK");
