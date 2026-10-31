// D1 — `historiaCompleta` llega desde App.jsx hasta ProgresoView atravesando TODA la cadena real:
//   App.jsx (dashboardProps) -> CoachSectionRenderer -> CoachDashboardMain -> CoachDashboard -> ProgresoView
//
//   node scripts/test-d1HistoriaCompletaCadena.mjs
//
// Antes de D1, CoachDashboardMain no declaraba ni reenviaba `historiaCompleta`: Progreso recibia siempre null (sin aviso de historial
// incompleto, comparaciones no anuladas y "Cargando…" para un entrenador sin sesiones). Este test renderiza (SSR con esbuild +
// react-dom/server) desde CoachSectionRenderer —el mismo componente que monta App.jsx— con datos FICTICIOS. Sin red ni Supabase.
process.env.TZ = "America/New_York";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d1-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachSectionRenderer from "./components/coach/CoachSectionRenderer.jsx";' +
      'import CoachDashboardMain from "./components/coach/CoachDashboardMain.jsx";' +
      "export { React, renderToStaticMarkup, CoachSectionRenderer, CoachDashboardMain };",
    resolveDir: ROOT, sourcefile: "d1-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, CoachSectionRenderer, CoachDashboardMain } = await import(pathToFileURL(outfile).href);
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fechas relativas a hoy (formato real: d/m/yyyy y created_at ISO) ----
const hace = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const dmy = (n) => { const d = hace(n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const iso = (n) => hace(n).toISOString();

// ---- fixture: Ana con rutina, series y sesiones en el periodo actual y en el anterior (hay contra que comparar) ----
const A = "ana";
const alumnos = [{ id: A, nombre: "Ana", email: "ana@x.test" }];
const allEx = [{ id: "sq", name: "Sentadilla", pattern: "rodilla" }];
const rutinas = [{ id: "r1", alumno_id: A, nombre: "Fuerza", created_at: iso(90), datos: { days: [{ exercises: [{ id: "sq" }] }, { exercises: [{ id: "sq" }] }] } }];
const p = (n, kg) => ({ alumno_id: A, rutina_id: "r1", ejercicio_id: "sq", fecha: dmy(n), kg, reps: 5, semana: 1 });
const progresoConDatos = { [A]: [p(50, 90), p(45, 92.5), p(40, 95), p(35, 95), p(10, 97.5), p(5, 100), p(3, 100)] };
const s = (n, dia) => ({ alumno_id: A, rutina_id: "r1", rutina_nombre: "Fuerza", fecha: dmy(n), created_at: iso(n), semana: 1, dia_idx: dia });
const sesionesConDatos = [s(50, 0), s(45, 1), s(40, 0), s(35, 1), s(10, 0), s(5, 1), s(3, 0)];

const INCOMPLETO_TXT = "Historial incompleto: sin comparación";

/** Props como las arma App.jsx (buildCoachSectionRendererProps -> dashboardProps), con la pestaña Progreso del entrenador. */
function renderProgreso({ historiaCompleta, sesionesGlobales, progresoGlobal }) {
  return renderToStaticMarkup(h(CoachSectionRenderer, {
    tab: "progress",
    esAlumno: false,
    sessionData: { role: "entrenador", name: "Coach Test" },
    showCoachDesktopShell: false,
    coachDesktop1024: true,
    dashboardProps: {
      alumnos, alumnosStatus: "ready", sesionesGlobales, mensajesEntrenadorPendientes: [], progresoGlobal,
      historiaCompleta, rutinasSBEntrenador: rutinas, allEx, lang: "es", darkMode: true, currentWeek: 0, coachName: "Coach Test",
    },
    calendarProps: { dark: true },
    mobileDrawerProps: {},
  }));
}
const tieneAvisoIncompleto = (html) => /data-qa="historial-incompleto"/.test(html);
const tieneCargando = (html) => /data-qa="progreso-cargando"/.test(html);

// ======================================================================= cableado estatico de la cadena
await test("cadena: App pone historiaCompleta en dashboardProps; CoachSectionRenderer los esparce; Main lo declara y reenvia; Dashboard lo pasa a ProgresoView", () => {
  assert.match(read("App.jsx"), /dashboardProps:\s*\{[\s\S]*?historiaCompleta: coachHistoriaCompleta,[\s\S]*?\n\s{6}\},/);
  assert.match(read("components/coach/CoachSectionRenderer.jsx"), /<CoachDashboardMain[\s\S]*?\{\.\.\.dashboardProps\}/);
  const main = read("components/coach/CoachDashboardMain.jsx");
  const firma = main.slice(main.indexOf("export default function CoachDashboardMain({"), main.indexOf("}) {"));
  assert.match(firma, /\n\s+historiaCompleta,\n/, "CoachDashboardMain debe declarar historiaCompleta");
  assert.match(main, /historiaCompleta=\{historiaCompleta\}/, "CoachDashboardMain debe reenviarlo a CoachDashboard");
  assert.match(read("components/CoachDashboard.jsx"), /<ProgresoView[\s\S]*?historiaCompleta=\{historiaCompleta\}/);
});

await test("ningun prop de dashboardProps que CoachDashboard declara se pierde en CoachDashboardMain", () => {
  const app = read("App.jsx");
  const bloque = app.match(/dashboardProps:\s*\{([\s\S]*?)\n\s{6}\},/)[1];
  const enviados = [...bloque.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
  const dash = read("components/CoachDashboard.jsx");
  const firmaDash = dash.slice(dash.indexOf("export default function CoachDashboard({"), dash.indexOf("}) {", dash.indexOf("export default function CoachDashboard({")));
  const declaradosDash = new Set([...firmaDash.matchAll(/^\s+(\w+)\s*(?:=|,)/gm)].map((m) => m[1]));
  const main = read("components/coach/CoachDashboardMain.jsx");
  const perdidos = enviados.filter((k) => declaradosDash.has(k) && !new RegExp("\\b" + k + "=\\{" + k + "\\}").test(main));
  assert.deepEqual(perdidos, [], "props que App envia y CoachDashboard espera, pero CoachDashboardMain no reenvia");
  assert.ok(enviados.includes("historiaCompleta"));
});

// ======================================================================= render real desde CoachSectionRenderer
await test("CoachDashboardMain reenvia el valor: historial incompleto se ve en Progreso renderizado desde Main", () => {
  const html = renderToStaticMarkup(h(CoachDashboardMain, {
    activeNav: "progreso", alumnos, sesionesGlobales: sesionesConDatos, progresoGlobal: progresoConDatos,
    historiaCompleta: { sesiones: true, progreso: false }, rutinasSBEntrenador: rutinas, allEx, lang: "es", darkMode: true,
  }));
  assert.ok(tieneAvisoIncompleto(html));
});

await test("historial COMPLETO: sin aviso, sin 'Cargando' y las comparaciones con el periodo anterior se muestran", () => {
  const html = renderProgreso({ historiaCompleta: { sesiones: true, progreso: true }, sesionesGlobales: sesionesConDatos, progresoGlobal: progresoConDatos });
  assert.ok(!tieneAvisoIncompleto(html), "no debe avisar historial incompleto");
  assert.ok(!tieneCargando(html), "no debe mostrar Cargando");
  assert.ok(!html.includes(INCOMPLETO_TXT), "las comparaciones no deben anularse");
  assert.ok(!/puede faltar historial antiguo/.test(html));
  assert.match(html, /data-qa="resumen-prs"/);
});

await test("historial INCOMPLETO (progreso truncado): aviso visible y comparaciones anuladas con su motivo", () => {
  const html = renderProgreso({ historiaCompleta: { sesiones: true, progreso: false }, sesionesGlobales: sesionesConDatos, progresoGlobal: progresoConDatos });
  assert.ok(tieneAvisoIncompleto(html), "debe avisar historial incompleto");
  assert.ok(!tieneCargando(html));
  assert.match(html, /data-qa="resumen-prs"[\s\S]*?Historial incompleto: sin comparación/);
  assert.match(html, /data-qa="resumen-volumen"[\s\S]*?Historial incompleto: sin comparación/);
});

await test("historial INCOMPLETO (sesiones truncadas): tambien avisa", () => {
  const html = renderProgreso({ historiaCompleta: { sesiones: false, progreso: true }, sesionesGlobales: sesionesConDatos, progresoGlobal: progresoConDatos });
  assert.ok(tieneAvisoIncompleto(html));
});

await test("entrenador SIN sesiones, carga terminada: no queda en 'Cargando' ni avisa historial incompleto", () => {
  const html = renderProgreso({ historiaCompleta: { sesiones: true, progreso: true }, sesionesGlobales: [], progresoGlobal: {} });
  assert.ok(!tieneCargando(html), "con la carga completa no debe decir Cargando");
  assert.ok(!tieneAvisoIncompleto(html));
});

await test("primera carga todavia en curso (historiaCompleta null, sin datos): 'Cargando' sigue apareciendo", () => {
  const html = renderProgreso({ historiaCompleta: null, sesionesGlobales: [], progresoGlobal: {} });
  assert.ok(tieneCargando(html));
  assert.ok(!tieneAvisoIncompleto(html));
});

console.log("\n" + count + " pruebas OK");
