// Demostración D76-04/05 (demo/ciclos-medianoche.html): solo Preview, datos ficticios, almacenamiento, servidor y reloj simulados en memoria,
// sin Supabase ni red.
//
//   node scripts/test-demoCiclosMedianoche.mjs
//
// (a) vite.config: la demo entra solo con includeDemo; (b) grafo de imports: usa la lógica real y no alcanza App.jsx ni Supabase; (c) corre
// los MISMOS escenarios automáticos que el botón 9 de la pantalla (ejecutarEscenarios); (d) SSR del componente.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// Grafo de imports estaticos relativos (y paquetes) desde un archivo (igual que scripts/test-demoSyncPendientes.mjs).
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

const FUENTES = ["components/demo/CiclosMedianocheDemo.jsx", "components/demo/ciclosMedianocheDemoData.js", "components/demo/ciclosMedianocheDemoMain.jsx"];
const sinComentarios = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

await test("vite.config: demoCiclos solo entra al build con includeDemo (Preview o local con IRONTRACK_DEMO=1); Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoCiclos: path\.resolve\(__dirname, 'demo\/ciclos-medianoche\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/ciclos-medianoche\.html'/g) || []).length, 1, "una sola entrada, dentro de includeDemo");
  const html = read("demo/ciclos-medianoche.html");
  assert.match(html, /src="\/components\/demo\/ciclosMedianocheDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /<title>IRON TRACK · Demo D76-04\/05 ciclos y medianoche<\/title>/);
  assert.match(html, /solo existe en builds de Preview/);
});

await test("la demo usa la logica REAL y no alcanza App.jsx, el cliente de Supabase ni supabase-js; la app no importa la demo", () => {
  const g = graph("components/demo/ciclosMedianocheDemoMain.jsx");
  for (const real of [
    "lib/workoutSession.js", "lib/workoutSessionDate.js", "lib/rutinaCiclo.js", "lib/setWriteAhead.js", "lib/pendingSyncQueue.js",
    "lib/progressInsert.js", "lib/finalizeWorkoutSession.js",
    "components/demo/CiclosMedianocheDemo.jsx", "components/demo/ciclosMedianocheDemoData.js", "components/demo/registroSeriesDemoData.js",
  ]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("components/WorkoutScreen.jsx"), "no importa WorkoutScreen.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningun paquete de supabase: " + g.pkgs.join(", "));
  assert.ok(!graph("main.jsx").files.some((f) => f.startsWith("components/demo/")), "la app (index.html -> main.jsx) no importa la demo");
  const data = read("components/demo/ciclosMedianocheDemoData.js");
  for (const fn of ["buildExerciseSetRecord", "updateExerciseProgressRecord", "hydrateProgressFromRows", "mergeProgressEntries", "getWorkoutExerciseStatus",
    "calculateDayProgress", "buildPendingProgressItem", "buildProgressPayload", "buildSessionPayload", "fechaDeSesion", "claveDiaDeSesion",
    "prepararInicioEntrenamiento", "cerrarSesionActiva", "readCicloActual", "setsForLoadPrefill", "rowCiclo", "writeAheadPendingSet",
    "flushPendingForAlumno", "visiblePendingItems", "generateOpId", "postProgressIdempotent", "finalizeStudentSession"]) {
    assert.match(sinComentarios(data), new RegExp("\\b" + fn + "\\("), "llama a " + fn);
  }
  // logSet: fecha de la sesion (no la del reloj del dispositivo) y el opId como id de la serie local.
  assert.match(data, /const d = fechaSesion\(\);/);
  assert.match(data, /const fechaSesion = \(\) => fechaDeSesion\(st\.sesion, reloj\.now\(\)\);/);
  assert.match(data, /Object\.assign\(buildExerciseSetRecord\(base\.kg, base\.reps, d, week, '', null, c\), \{ id: opId \}\)/);
});

await test("la demo no usa el almacenamiento real, la red ni la hora del dispositivo", () => {
  for (const f of FUENTES) {
    const code = sinComentarios(read(f));
    assert.doesNotMatch(code, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest|navigator\.|\bwindow\.addEventListener|\bdocument\.addEventListener/, f);
    assert.doesNotMatch(code, /Date\.now\(\)|new Date\(\)/, f + ": la hora sale del reloj simulado");
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
  let resultados, d;
  try {
    d = await import(pathToFileURL(path.join(ROOT, "components/demo/ciclosMedianocheDemoData.js")).href);
    resultados = await d.ejecutarEscenarios({ timeoutMs: 500 });
  } finally {
    globalThis.fetch = realFetch;
    if (realLS) Object.defineProperty(globalThis, "localStorage", realLS); else delete globalThis.localStorage;
  }
  assert.equal(d.DEMO_ALUMNO_A, "demo-alumno-a");
  assert.equal(d.DEMO_ALUMNO_B, "demo-alumno-b");
  assert.ok(d.DEMO_EJERCICIOS.every((e) => /-demo$/.test(e.id)));
  assert.equal(d.formatoHora(d.DEMO_RELOJ_INICIO), "5/11/2026 23:50", "el reloj arranca el 5/11/2026 23:50 (hora local)");
  assert.equal(resultados.length, 10);
  for (const r of resultados) {
    console.log("   " + (r.pass ? "PASS" : "FAIL") + " " + r.id + ". " + r.nombre + " · " + r.detalle);
    assert.equal(r.pass, true, r.id + ". " + r.nombre + ": " + r.detalle);
  }
  assert.deepEqual(usos, [], "sin red ni almacenamiento real");
});

await test("reloj simulado: fijar(h, m) es la noche del 5 al 6 de noviembre; avanzar(min) solo hacia donde se pide", async () => {
  const d = await import(pathToFileURL(path.join(ROOT, "components/demo/ciclosMedianocheDemoData.js")).href);
  const r = d.crearReloj();
  assert.equal(d.formatoHora(r.now()), "5/11/2026 23:50");
  r.avanzar(15);
  assert.equal(d.formatoHora(r.now()), "6/11/2026 00:05");
  r.fijar(23, 55);
  assert.equal(d.formatoHora(r.now()), "5/11/2026 23:55");
  r.fijar(0, 10);
  assert.equal(d.formatoHora(r.now()), "6/11/2026 00:10");
  // Acciones de la pantalla: devuelven texto; recarga tras medianoche con el ancla del mismo entrenamiento.
  const m = d.crearMundoCiclos({ timeoutMs: 500 });
  assert.equal(typeof (await m.fijarReloj(23, 55)), "string");
  assert.match(await m.iniciarEntrenamiento(), /Entrenamiento nuevo \(sin_ancla\): fecha 5\/11\/2026/);
  assert.match(await m.registrarSerie(0), /ciclo 1 · fecha 5\/11\/2026 · sincronizada/);
  await m.fijarReloj(0, 5);
  assert.match(await m.recargarSafari(), /Entrenamiento recuperado .*fecha 5\/11\/2026, inicio 5\/11\/2026 23:55/);
  assert.match(await m.registrarSerie(1), /fecha 5\/11\/2026/);
  const e = m.estado();
  assert.equal(e.finalizarVisible, true);
  assert.equal(e.horaSimulada, "6/11/2026 00:05");
  assert.match(await m.finalizar(), /Sesión confirmada \(insert\) con fecha 5\/11\/2026 · avance de semana: ok/);
  assert.equal(m.estado().sesionesConfirmadas.length, 1);
  assert.equal(m.estado().semana, 2);
});

await test("SSR del componente: textos clave, aviso de datos ficticios y los 9 pasos en orden", async () => {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-cm-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents:
        'import React from "react";' +
        'import { renderToStaticMarkup } from "react-dom/server";' +
        'import CiclosMedianocheDemo from "./components/demo/CiclosMedianocheDemo.jsx";' +
        "export { React, renderToStaticMarkup, CiclosMedianocheDemo };",
      resolveDir: ROOT, sourcefile: "demo-cm-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  const { React, renderToStaticMarkup, CiclosMedianocheDemo } = await import(pathToFileURL(outfile).href);
  const html = renderToStaticMarkup(React.createElement(CiclosMedianocheDemo));
  for (const txt of ["Datos ficticios · sin Supabase · reloj simulado", "Ciclo", "Fecha de inicio", "Hora simulada", "5/11/2026 23:50", "Día activo",
    "Semana", "FINALIZAR visible", "Series registradas", "Sesiones confirmadas en el servidor", "Pruebas automáticas", "Reiniciar demo"]) {
    assert.ok(html.includes(txt), "falta: " + txt);
  }
  const pasos = ["1 · Registrar series ciclo 1", "2 · Reiniciar rutina e iniciar ciclo 2", "3 · Ver pendientes ciclo anterior / desconectar",
    "4 · Sincronizar pendientes", "5 · Iniciar a las 23:55", "6 · Avanzar reloj a 00:10", "7 · Registrar y finalizar", "8 · Simular recarga de Safari",
    "9 · Ejecutar todas las pruebas automáticas"];
  let pos = -1;
  for (const p of pasos) {
    const i = html.indexOf(p);
    assert.ok(i > pos, "paso en orden: " + p);
    pos = i;
  }
  const ui = read("components/demo/CiclosMedianocheDemo.jsx");
  assert.match(ui, /\.cmd-btn \{[^}]*min-width:44px; min-height:44px;/, "botones de al menos 44 px");
  assert.match(ui, /overflow-x:hidden/);
});

console.log("\n" + count + " pruebas OK");
