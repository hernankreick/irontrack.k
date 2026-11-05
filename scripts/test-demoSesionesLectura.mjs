// Demostración D76-02 (demo/sesiones-lectura.html): solo Preview, datos ficticios, servidor falso en memoria, sin Supabase ni red.
//
//   node scripts/test-demoSesionesLectura.mjs
//
// Corre los MISMOS escenarios automáticos que el botón "Ejecutar todos" de la pantalla (ejecutarEscenarios).
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// Grafo de imports estaticos relativos (y paquetes) desde un archivo (igual que scripts/test-demoFicha.mjs).
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

await test("vite.config: demoSesiones solo entra al build en Preview (o local con IRONTRACK_DEMO=1); Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoSesiones: path\.resolve\(__dirname, 'demo\/sesiones-lectura\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  const html = read("demo/sesiones-lectura.html");
  assert.match(html, /src="\/components\/demo\/sesionesLecturaDemoMain\.jsx"/);
  assert.match(html, /noindex/);
});

await test("la demo usa el controlador y la posicion reales y no alcanza App.jsx, el cliente de Supabase ni supabase-js", () => {
  const g = graph("components/demo/sesionesLecturaDemoMain.jsx");
  for (const real of ["lib/sesionesLectura.js", "lib/studentWeeklyProgress.js", "components/demo/SesionesLecturaDemo.jsx", "components/demo/sesionesLecturaDemoData.js"]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningun paquete de supabase: " + g.pkgs.join(", "));
  const index = graph("main.jsx");
  assert.ok(!index.files.some((f) => f.startsWith("components/demo/")), "la app (index.html -> main.jsx) no importa la demo");
});

let resultados = null;
let d = null;
await test("los 10 escenarios automaticos pasan sin red ni almacenamiento", async () => {
  const realFetch = globalThis.fetch;
  const usos = [];
  globalThis.fetch = () => { usos.push("fetch"); throw new Error("la demo no debe usar la red"); };
  const espia = { getItem: (k) => { usos.push("getItem " + k); return null; }, setItem: (k) => { usos.push("setItem " + k); }, removeItem: (k) => { usos.push("removeItem " + k); }, clear: () => { usos.push("clear"); } };
  const hadLS = "localStorage" in globalThis;
  const realLS = hadLS ? Object.getOwnPropertyDescriptor(globalThis, "localStorage") : null;
  Object.defineProperty(globalThis, "localStorage", { value: espia, configurable: true, writable: true });
  try {
    d = await import(path.join(ROOT, "components/demo/sesionesLecturaDemoData.js"));
    resultados = await d.ejecutarEscenarios({ timeoutMs: 50 });
  } finally {
    globalThis.fetch = realFetch;
    if (realLS) Object.defineProperty(globalThis, "localStorage", realLS); else delete globalThis.localStorage;
  }
  assert.equal(resultados.length, 10);
  assert.deepEqual(resultados.map((r) => r.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  for (const r of resultados) assert.equal(r.pass, true, r.id + ". " + r.nombre + ": " + r.detalle);
  assert.deepEqual(usos, [], "sin red ni almacenamiento");
});

await test("escenario 7: tras finalizar el Dia 3 con relectura fallida, 3 completados y siguiente Dia 4; escenario 5 bloquea", async () => {
  const { servidor, ctl } = d.crearEntorno({ timeoutMs: 50 });
  await ctl.cargar(d.DEMO_ALUMNO.id);
  const fin = await d.finalizarDiaConFalloRelectura(servidor, ctl);
  assert.equal(fin.fila.dia_idx, 2, "finaliza el dia que toca segun la posicion real (Dia 3)");
  const r = d.resumen(ctl.estado());
  assert.equal(r.completados, 3); assert.equal(r.diaActual, 4); assert.equal(r.status, "desactualizado");
  assert.deepEqual([...r.completedDayIndexes].sort(), [0, 1, 2]);

  const e5 = d.crearEntorno({ timeoutMs: 50, modo: "http500" });
  await e5.ctl.cargar(d.DEMO_ALUMNO.id);
  const r5 = d.resumen(e5.ctl.estado());
  assert.equal(r5.plan, "error"); assert.equal(r5.puedeIniciar, false, "sin estado previo no se asume Dia 1");
  assert.match(resultados[4].detalle, /bloqueado/);
  assert.match(resultados[6].detalle, /Día actual 4 · 3 completados/);
});

await test("datos ficticios: ids con prefijo demo- y sin red/almacenamiento en el codigo de la demo", () => {
  assert.equal(d.DEMO_ALUMNO.nombre, "Alumno Demo");
  assert.match(d.DEMO_ALUMNO.id, /^demo-/);
  const rutina = d.demoRutina();
  assert.match(rutina.id, /^demo-/);
  assert.equal(rutina.datos.days.length, 4);
  assert.equal(rutina.datos.semana_activa, 1); assert.equal(rutina.datos.ciclo_actual, 1);
  for (const day of rutina.datos.days) {
    assert.ok(day.exercises.length >= 2 && day.exercises.length <= 3);
    for (const ex of day.exercises) assert.match(ex.id, /^demo-/);
  }
  const ses = d.sesionesIniciales();
  assert.deepEqual(ses.map((s) => s.dia_idx), [0, 1]);
  for (const s of ses) {
    assert.match(s.id, /^demo-/); assert.equal(s.alumno_id, d.DEMO_ALUMNO.id); assert.equal(s.rutina_id, rutina.id);
    assert.equal(s.semana, 1); assert.equal(s.ciclo, 1); assert.ok(s.created_at);
  }
  for (const f of ["components/demo/SesionesLecturaDemo.jsx", "components/demo/sesionesLecturaDemoData.js", "components/demo/sesionesLecturaDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest/, f);
  }
});

console.log("\n" + count + " pruebas OK");
