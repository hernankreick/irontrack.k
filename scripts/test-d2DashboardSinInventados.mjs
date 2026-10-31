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
/** Texto de la fila de «Actividad reciente» de un alumno (desde su nombre hasta el siguiente alumno / fin de la tarjeta). */
const reciente = (html, nombre) => {
  const m = html.match(new RegExp('<button[^>]*data-qa="d5-reciente"[^>]*>(?:(?!</button>)[\\s\\S])*?>' + nombre + '<(?:(?!</button>)[\\s\\S])*</button>'));
  assert.ok(m, "fila reciente de " + nombre);
  return strip(m[0]);
};
/** Texto de una estadistica del resumen «Esta semana» (etiqueta + valor + subtitulo). */
const stat = (html, qa) => {
  const m = html.match(new RegExp('data-qa="d5-stat-' + qa + '"[^>]*>([\\s\\S]*?)</(?:div|button)>'));
  assert.ok(m, "estadistica " + qa);
  return strip(m[1]).trim();
};
const grupo = (html, k) => { const m = html.match(new RegExp('data-qa="d5-grupo-' + k + '"[^>]*>([\\s\\S]*?)</button>')); return m ? strip(m[1]).trim() : null; };

// ======================================================================= datos validos + sin rutina + rutina sin dias
const html = render();
const todo = strip(html);

await test("H2: rutina sin dias validos -> sin porcentaje inventado ni clasificacion («Sin plan», aunque entreno hoy)", () => {
  const f = reciente(html, "Beto");
  assert.match(f, /Hoy/);
  assert.match(f, /Sin plan/);
  assert.doesNotMatch(f, /\d+%/, "ningun porcentaje para Beto");
  assert.doesNotMatch(f, /Al día|Baja actividad/, "sin porcentaje no se clasifica como bueno ni malo");
  assert.doesNotMatch(strip(html.slice(html.indexOf('data-qa="d5-seguimiento"'), html.indexOf('data-qa="d5-recientes"'))), /Beto/, "Beto no aparece en seguimiento");
});

await test("H2: alumno sin rutina -> en «Sin rutina» (seguimiento), sin 0 % inventado", () => {
  assert.match(grupo(html, "sin_rutina"), /Sin rutina\s+Caro\s+1/);
  assert.doesNotMatch(todo, /Caro[^.]{0,40}\d+%/, "ningun porcentaje para Caro");
});

await test("datos validos: rutina valida -> porcentaje real (adherencia de la semana de calendario desde D3)", () => {
  assert.match(reciente(html, "Ana"), /67% esta semana[\s\S]*Al día/);
  assert.match(reciente(html, "Eva"), /25% esta semana[\s\S]*Baja actividad/);
});

await test("historial vacio con rutina valida -> 'Inactivos' real (no el 5-40 % inventado); el alumno inactivo no aparece con porcentaje", () => {
  assert.match(grupo(html, "inactivos"), /Inactivos\s+Más de 21 días · Dani\s+1/);
  assert.doesNotMatch(todo, /Dani[^.]{0,40}\b(5|[1-3]\d|4[0-2])%/, "ningun porcentaje de la formula fija de inactivos");
});

await test("H6: la adherencia es el promedio real de los alumnos con plan (67, 25 y 0 = 31 %); sin objetivo semanal inventado", () => {
  // D3: el % es la «Adherencia promedio» de Progreso (promedio de 67, 25 y 0 = 31), no el cociente de los totales (3/9 = 33).
  assert.match(stat(html, "adherencia"), /^Adherencia 31% /);
  assert.match(stat(html, "entrenaron"), /^Entrenaron 3 \/ 5 /); // Ana, Beto, Eva (lib/metricas/racha.js)
  assert.doesNotMatch(todo, /Te faltan|objetivo|Objetivo|80%/);
  assert.doesNotMatch(todo, /Sesiones planificadas|Sesiones completadas/, "sin totales de sesiones que contradigan el promedio");
});

await test("H3: sin 'Rendimiento /100', sin puntaje ni delta en puntos inventado; solo datos verificables", () => {
  assert.doesNotMatch(todo, /\/100|Tu rendimiento|Rendimiento/);
  // el unico delta es el de D3 (resumenAdherenciaEquipo): «±N pts vs sem. pasada», o «Sin comparación» cuando no hay periodo comparable
  assert.match(stat(html, "adherencia"), /^Adherencia 31% [+-]?\d+ pts vs sem\. pasada$/);
  assert.match(stat(render({ historiaCompleta: { sesiones: false, progreso: true } }), "adherencia"), /Sin comparación \(historial incompleto\)/);
  for (const f of ["components/CoachDashboard.jsx", "components/coach/CoachDashboardD5.jsx", "components/coach/coachDashboardModelo.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /rendimientoScore|rendimientoDeltaPts|buenosCount/, f);
    assert.doesNotMatch(src, /suffix: "\/100"/, f);
  }
});

await test("H2/H6: el codigo ya no contiene las formulas fijas ni el supuesto de 3 dias por rutina", () => {
  for (const f of ["components/CoachDashboard.jsx", "components/coach/CoachDashboardD5.jsx", "components/coach/coachDashboardModelo.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /computeCompliancePct|weeklyTargetFromRutinas/, f);
    assert.doesNotMatch(src, /Math\.max\(71|40 - Math\.min\(35|days \|\| 3|Math\.max\(sesionesCompletadas, alumnos\.length\)/, f);
  }
});

await test("coherencia: el contador «Seguimiento», los grupos y los nombres cuentan lo mismo", () => {
  assert.match(stat(html, "seguimiento"), /^Seguimiento 3 requieren atención$/);
  assert.match(grupo(html, "sin_rutina"), /^Sin rutina\s+Caro\s+1$/);
  assert.match(grupo(html, "inactivos"), /^Inactivos\s+Más de 21 días · Dani\s+1$/);
  assert.match(grupo(html, "baja"), /^Baja actividad\s+Eva\s+1$/);
});

// ======================================================================= sin plan verificable
await test("sin plan: ningun alumno con rutina con dias -> '—' y 'Sin plan semanal', sin objetivo ni porcentaje", () => {
  const out = render({ alumnos: alumnos.filter((a) => a.id === "beto" || a.id === "caro") });
  assert.equal(stat(out, "adherencia"), "Adherencia — Sin plan semanal");
  assert.doesNotMatch(strip(out), /\d+% vs|pts vs|Te faltan|Objetivo semanal alcanzado/);
});

// ======================================================================= cargando
await test("cargando alumnos: sin contadores en 0 ni objetivos; '—' y 'Cargando…'", () => {
  const out = render({ alumnos: [], alumnosStatus: "loading", sesionesGlobales: [], historiaCompleta: null });
  for (const k of ["total", "entrenaron", "adherencia", "seguimiento"]) assert.match(stat(out, k), /—/, k);
  assert.match(stat(out, "seguimiento"), /Cargando…/);
  const t = strip(out);
  assert.doesNotMatch(t, /\b0 alumnos|Al día|\d+ \/ \d+|\d+%|Todavía no tenés alumnos|Nadie requiere/);
  assert.match(t, /Cargando datos del equipo…/);
});

await test("cargando historial (alumnos listos, historiaCompleta null, sin datos): nadie aparece inactivo ni con 0 %", () => {
  const out = render({ sesionesGlobales: [], progresoGlobal: {}, historiaCompleta: null });
  const t = strip(out);
  for (const k of ["total", "entrenaron", "adherencia", "seguimiento"]) assert.match(stat(out, k), /^[A-Za-z]+ —/, k);
  assert.doesNotMatch(t, /\d+%|Sin actividad|Baja actividad|Inactivos|Nadie requiere/);
  assert.match(t, /Cargando datos del equipo…/);
  assert.equal(grupo(out, "inactivos"), null);
});

await test("historial cargado y vacio (historiaCompleta completa, sin sesiones): ya no es 'cargando'; el plan real da 0 %", () => {
  const out = render({ sesionesGlobales: [], progresoGlobal: {} });
  assert.doesNotMatch(strip(out), /Cargando/);
  assert.match(stat(out, "adherencia"), /^Adherencia 0% /);
  assert.match(stat(out, "entrenaron"), /^Entrenaron 0 \/ 5 /);
});

await test("sin alumnos (carga terminada): 'Todavía no tenés alumnos' con «Agregar alumno»; sin resumen ni objetivo", () => {
  const out = render({ alumnos: [], sesionesGlobales: [] });
  assert.match(strip(out), /Todavía no tenés alumnos/);
  assert.match(out, /data-qa="d5-agregar-alumno"/);
  assert.doesNotMatch(out, /data-qa="d5-resumen"/);
});

// ======================================================================= tarjetas moviles (props que arma el Dashboard)
await test("moviles: la tarjeta KPI sin progreso no pinta barra ni '/100' (componente intacto; el Dashboard D5 ya no la usa)", () => {
  assert.doesNotMatch(read("components/coach/CoachDashboardD5.jsx"), /\/100|rendimiento/i);
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
