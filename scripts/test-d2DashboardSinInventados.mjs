// D2 — el Dashboard del entrenador muestra SOLO metricas calculadas con datos reales (hallazgos H2, H3 y H6 de la auditoria D0).
//
//   node scripts/test-d2DashboardSinInventados.mjs
//
//   H2: sin porcentajes de cumplimiento inventados (antes: 71-100 % a activos y 5-40 % a inactivos sin dias de rutina).
//   H3: sin el puntaje sintetico "Rendimiento /100" ni su delta.
//   H6: sin objetivo semanal inventado (antes: 3 dias por rutina o max(completadas, cantidad de alumnos)).
//   Estados: cargando (alumnos o historial), sin alumnos, sin rutina, rutina sin dias, historial vacio, datos validos.
//
// Renderiza el CoachDashboard real (SSR con esbuild + react-dom/server; variante de escritorio, la que pinta SSR) y las tarjetas
// moviles con sus props, con datos FICTICIOS relativos a hoy. Sin red ni Supabase. La definicion de semana/cumplimiento no cambia (D3).
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d2-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard from "./components/CoachDashboard.jsx";' +
      'import CoachMobileKpiCard from "./components/coach/CoachMobileKpiCard.jsx";' +
      'import CoachDashboardAttentionCard from "./components/coach/CoachDashboardAttentionCard.jsx";' +
      'import { coachThemePalette } from "./components/coachThemePalette.js";' +
      'import { coachType } from "./components/coachUiScale.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, CoachMobileKpiCard, CoachDashboardAttentionCard, coachThemePalette, coachType };",
    resolveDir: ROOT, sourcefile: "d2-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, CoachDashboard, CoachMobileKpiCard, CoachDashboardAttentionCard, coachThemePalette, coachType } =
  await import(pathToFileURL(outfile).href);
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fechas relativas a hoy (formato real: d/m/yyyy y created_at ISO) ----
const hace = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const dmy = (n) => { const d = hace(n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const iso = (n) => hace(n).toISOString();
const dias = (n) => Array.from({ length: n }, () => ({ exercises: [{ id: "sq" }] }));

// ---- fixture ----
//   Ana:  rutina valida de 3 dias, 2 dias hechos esta semana            -> 67 %  (datos validos)
//   Beto: rutina SIN dias validos, entreno hoy (activo)                 -> antes 71-100 % inventado; ahora "—" / "Sin plan"
//   Caro: sin rutina                                                     -> "—" / "Sin rutina"
//   Dani: rutina valida de 2 dias, historial vacio (inactivo)            -> 0 % real / "Sin actividad"
//   Eva:  rutina valida de 4 dias, 1 dia hecho                           -> 25 % / "Baja actividad"
const alumnos = ["Ana", "Beto", "Caro", "Dani", "Eva"].map((n) => ({ id: n.toLowerCase(), nombre: n, email: n.toLowerCase() + "@x.test" }));
const rutinas = [
  { id: "r-ana", alumno_id: "ana", nombre: "Fuerza", created_at: iso(30), datos: { days: dias(3) } },
  { id: "r-beto", alumno_id: "beto", nombre: "Vacia", created_at: iso(30), datos: { days: [] } },
  { id: "r-dani", alumno_id: "dani", nombre: "Base", created_at: iso(30), datos: { days: dias(2) } },
  { id: "r-eva", alumno_id: "eva", nombre: "Full", created_at: iso(30), datos: { days: dias(4) } },
];
const ses = (aid, rid, dia) => ({ alumno_id: aid, rutina_id: rid, rutina_nombre: "", fecha: dmy(0), created_at: iso(0), semana: 1, dia_idx: dia });
const sesiones = [ses("ana", "r-ana", 0), ses("ana", "r-ana", 1), ses("beto", "r-beto", 0), ses("eva", "r-eva", 0)];
const COMPLETA = { sesiones: true, progreso: true };

function render(over) {
  return renderToStaticMarkup(h(CoachDashboard, Object.assign({
    alumnos, alumnosStatus: "ready", sesionesGlobales: sesiones, progresoGlobal: {}, historiaCompleta: COMPLETA,
    rutinasSBEntrenador: rutinas, lang: "es", darkMode: true,
  }, over || {})));
}
const strip = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
/** Texto de la fila de un alumno en la tabla de escritorio (desde su nombre hasta el siguiente "Mensaje"). */
function fila(text, nombre) {
  const tabla = text.indexOf("ALUMNO ADHERENCIA");
  assert.ok(tabla >= 0, "tabla de alumnos");
  const i = text.indexOf(" " + nombre + " ", tabla);
  assert.ok(i >= 0, "fila de " + nombre);
  return text.slice(i, text.indexOf("Mensaje", i));
}
/** Texto del bloque visible (antes del bloque oculto de alertas). */
const visible = (html) => strip(html.split('display:none')[0]);

// ======================================================================= datos validos + sin rutina + rutina sin dias
const html = render();
const txt = visible(html);
const todo = strip(html);

await test("H2: rutina sin dias validos -> '—' y 'Sin plan' (antes 71-100 % inventado aunque entreno hoy)", () => {
  const f = fila(todo, "Beto");
  assert.match(f, /—/);
  assert.match(f, /Sin plan/);
  assert.doesNotMatch(f, /\d+%/, "ningun porcentaje para Beto");
  assert.doesNotMatch(f, /Buen cumplimiento|Baja actividad/, "sin porcentaje no se clasifica como bueno ni malo");
});

await test("H2: alumno sin rutina -> '—' y 'Sin rutina' (antes 0 %)", () => {
  const f = fila(todo, "Caro");
  assert.match(f, /—/);
  assert.match(f, /Sin rutina/);
  assert.doesNotMatch(f, /\d+%/);
});

await test("datos validos: rutina valida -> porcentaje real (adherencia de la semana de calendario desde D3)", () => {
  assert.match(fila(todo, "Ana"), /67%[\s\S]*Al día/);
  assert.match(fila(todo, "Eva"), /25%[\s\S]*Baja actividad/);
});

await test("historial vacio con rutina valida -> 0 % real (no el 5-40 % inventado) y 'Sin actividad'", () => {
  const f = fila(todo, "Dani");
  assert.match(f, /\b0%/);
  assert.match(f, /Sin actividad/);
  assert.doesNotMatch(f, /\b(5|[1-3]\d|4[0-2])%/, "ningun porcentaje de la formula fija de inactivos");
});

await test("H6: objetivo semanal = suma de los dias de rutinas VALIDAS (3+2+4 = 9), completadas solo de esas (2+1 = 3)", () => {
  // D3: el % es la «Adherencia promedio» de Progreso (promedio de 67, 25 y 0 = 31), no el cociente de los totales (3/9 = 33).
  assert.match(txt, /Adherencia semanal 3 \/ 9 31%/);
  assert.match(txt, /Sesiones planificadas 9/);
  assert.match(txt, /Sesiones completadas 3/);
  // D3: el objetivo del 80 % se expresa sobre la adherencia promedio (sin "faltan N sesiones" calculado con los totales)
  assert.match(txt, /Adherencia promedio 31% · objetivo 80%/);
  assert.doesNotMatch(txt, /Te faltan/);
});

await test("H3: sin 'Rendimiento /100', sin puntaje ni delta en puntos; la tarjeta usa solo datos verificables", () => {
  assert.doesNotMatch(todo, /\/100|Tu rendimiento|Rendimiento|pts vs/);
  assert.match(txt, /Resumen de la semana/);
  assert.match(txt, /Alumnos activos esta semana 3 \/ 5/); // Ana, Beto, Eva (lib/metricas/racha.js)
  const src = read("components/CoachDashboard.jsx");
  assert.doesNotMatch(src, /rendimientoScore|rendimientoDeltaPts|buenosCount/);
  assert.doesNotMatch(src, /suffix: "\/100"/);
});

await test("H2/H6: el codigo ya no contiene las formulas fijas ni el supuesto de 3 dias por rutina", () => {
  const src = read("components/CoachDashboard.jsx");
  assert.doesNotMatch(src, /computeCompliancePct|weeklyTargetFromRutinas/);
  assert.doesNotMatch(src, /Math\.max\(71|40 - Math\.min\(35|days \|\| 3|Math\.max\(sesionesCompletadas, alumnos\.length\)/);
});

await test("coherencia: Atencion hoy, recomendacion y lista cuentan lo mismo", () => {
  const filasTabla = ["Ana", "Beto", "Caro", "Dani", "Eva"].map((n) => fila(todo, n));
  const n = (re) => filasTabla.filter((f) => re.test(f)).length;
  assert.match(txt, new RegExp(n(/Sin rutina/) + " alumnos sin rutina"));
  assert.match(txt, new RegExp(n(/Sin actividad/) + " alumnos inactivos"));
  assert.match(txt, new RegExp(n(/Baja actividad/) + " alumnos con baja actividad"));
  assert.deepEqual([n(/Sin rutina/), n(/Sin actividad/), n(/Baja actividad/)], [1, 1, 1]);
  // la recomendacion sale de los mismos contadores: hay un alumno sin rutina
  assert.match(txt, /RECOMENDACIÓN PRINCIPAL Asignar rutinas pendientes/);
});

// ======================================================================= sin plan verificable
await test("sin plan: ningun alumno con rutina con dias -> '—' y 'Sin plan semanal', sin objetivo ni porcentaje", () => {
  const t = visible(render({ alumnos: alumnos.filter((a) => a.id === "beto" || a.id === "caro") }));
  assert.match(t, /Adherencia semanal — — Sin plan semanal/);
  assert.doesNotMatch(t, /\d+ \/ \d+ \d+%|\d+% vs semana pasada|Te faltan|Objetivo semanal alcanzado/);
  assert.match(t, /Sesiones planificadas Sin plan/);
  assert.match(t, /IMPACTO ESTIMADO Sin plan semanal/);
  assert.match(t, /Ningún alumno tiene una rutina con días/);
});

// ======================================================================= cargando
await test("cargando alumnos: sin contadores en 0 ni objetivos; 'Cargando…'", () => {
  const out = render({ alumnos: [], alumnosStatus: "loading", sesionesGlobales: [], historiaCompleta: null });
  const t = visible(out);
  assert.match(t, /— alumnos sin rutina Cargando…/);
  assert.match(t, /— alumnos inactivos Cargando…/);
  assert.doesNotMatch(t, /\b0 alumnos|Al día|\d+ \/ \d+|\d+%/);
  assert.match(strip(out), /Mis alumnos Ver todos → Cargando alumnos…/);
});

await test("cargando historial (alumnos listos, historiaCompleta null, sin datos): nadie aparece inactivo ni con 0 %", () => {
  const out = render({ sesionesGlobales: [], progresoGlobal: {}, historiaCompleta: null });
  const t = strip(out);
  for (const n of ["Ana", "Dani", "Eva"]) {
    const f = fila(t, n);
    assert.match(f, /Cargando…/, n + " en carga");
    assert.doesNotMatch(f, /\d+%|Sin actividad|Baja actividad/, n + " sin estado inventado");
  }
  assert.match(visible(out), /— alumnos inactivos Cargando…/);
  assert.match(visible(out), /Adherencia semanal — — Cargando…/);
  // las alertas tampoco inventan inactividad mientras carga
  assert.doesNotMatch(t, /Sin actividad reciente|Poca actividad/);
});

await test("historial cargado y vacio (historiaCompleta completa, sin sesiones): ya no es 'cargando'; el plan real da 0 / 9", () => {
  const t = visible(render({ sesionesGlobales: [], progresoGlobal: {} }));
  assert.doesNotMatch(t, /Cargando…/);
  assert.match(t, /Adherencia semanal 0 \/ 9 0%/);
  assert.match(t, /Alumnos activos esta semana 0 \/ 5/);
});

await test("sin alumnos (carga terminada): 'Todavía no tenés alumnos', sin objetivo", () => {
  const t = visible(render({ alumnos: [], sesionesGlobales: [] }));
  assert.match(t, /Todavía no tenés alumnos/);
  assert.match(t, /Adherencia semanal — — Sin alumnos/);
});

// ======================================================================= tarjetas moviles (props que arma el Dashboard)
await test("moviles: 'Esta semana' y 'Activos esta semana' usan los mismos valores y no hay '/100'", () => {
  const src = read("components/CoachDashboard.jsx");
  const m = src.slice(src.indexOf("mobileWeekKpiProps={{"), src.indexOf("desktopWeeklyProps={{"));
  assert.match(m, /value: hayPlan \? sesionesCompletadas \+ "\/" \+ sesionesTotales : "—"/);
  assert.match(m, /label: M\(lang, "Activos esta semana"/);
  assert.match(m, /value: activosSemanaText/);
  assert.doesNotMatch(m, /\/100|rendimiento/i);
  const C = coachThemePalette(true);
  const kpi = renderToStaticMarkup(h(CoachMobileKpiCard, { label: "Esta semana", value: "—", subtitle: "Sin plan semanal", progress: null, accent: "#2563EB", colors: C, type: coachType, blockGap: 8 }));
  assert.match(kpi, /—/);
  assert.match(kpi, /Sin plan semanal/);
  assert.match(kpi, /width:0%/, "sin progreso no hay barra rellena");
});

await test("Atencion hoy en carga: '—' + 'Cargando…' sin boton; 0 sigue siendo 'Al día'", () => {
  const C = coachThemePalette(true);
  const base = { title: "ATENCIÓN HOY", isMobile: true, dashCard: "#000", dashBorder: "#111", dashCardSoft: "#222", dashMuted: "#94A3B8", colors: C, type: coachType, okLabel: "Al día", loadingLabel: "Cargando…" };
  const item = (count) => ({ key: "k", Icon: () => null, count, color: "#f00", cta: "Ver", onClick: () => {}, title: "alumnos inactivos", sub: "Hace más de 21 días" });
  const loading = renderToStaticMarkup(h(CoachDashboardAttentionCard, { ...base, items: [item(null)] }));
  assert.match(loading, /data-state="loading"/);
  assert.match(strip(loading), /— alumnos inactivos Cargando…/);
  assert.doesNotMatch(loading, /<button/);
  const clear = renderToStaticMarkup(h(CoachDashboardAttentionCard, { ...base, items: [item(0)] }));
  assert.match(strip(clear), /0 alumnos inactivos Al día/);
  const pending = renderToStaticMarkup(h(CoachDashboardAttentionCard, { ...base, items: [item(2)] }));
  assert.match(pending, /<button[^>]*>Ver<\/button>/);
});

console.log("\n" + count + " pruebas OK");
