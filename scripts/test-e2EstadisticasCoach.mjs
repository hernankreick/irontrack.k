// E2 — las pantallas del entrenador (Progreso y Dashboard) consumen el nucleo unico lib/metricas (E1).
//
//   node scripts/test-e2EstadisticasCoach.mjs
//
// Integracion: renderiza ProgresoView y CoachDashboard reales (SSR con esbuild + react-dom/server, como test-coachDashStudents.mjs)
// y el modelo que usa la vista (components/coachProgresoMetrics.js), con datos FICTICIOS relativos a hoy. Sin red ni Supabase.
// Casos: historial de varios ciclos y rutinas, ejercicios personalizados y por tiempo, primer registro vs PR real, sesiones validadas
// por el entrenador, periodos sin datos suficientes, historial incompleto. La compatibilidad movil la mide `npm run qa:ui`.
process.env.TZ = "America/New_York";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-e2-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import ProgresoView from "./components/ProgresoView.jsx";' +
      'import CoachDashboard from "./components/CoachDashboard.jsx";' +
      'import { buildCoachProgresoModel } from "./components/coachProgresoMetrics.js";' +
      'import * as Metricas from "./lib/metricas/index.js";' +
      "export { React, renderToStaticMarkup, ProgresoView, CoachDashboard, buildCoachProgresoModel, Metricas };",
    resolveDir: ROOT, sourcefile: "e2-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, ProgresoView, CoachDashboard, buildCoachProgresoModel, Metricas } = await import(pathToFileURL(outfile).href);
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fechas relativas a hoy (formato real de produccion: d/m/yyyy y created_at ISO) ----
const hace = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const dmy = (n) => { const d = hace(n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const iso = (n) => hace(n).toISOString();

// ---- fixture: Ana (2 rutinas, 2 ciclos, custom, por tiempo, validada), Beto (rutina recien asignada), Caro (sin rutina) ----
const A = "ana", B = "beto", CA = "caro";
const alumnos = [{ id: A, nombre: "Ana", email: "ana@x.test" }, { id: B, nombre: "Beto", email: "beto@x.test" }, { id: CA, nombre: "Caro", email: "caro@x.test" }];
const allEx = [
  { id: "sq", name: "Sentadilla", pattern: "rodilla" },
  { id: "custom_1", name: "Remo personalizado", pattern: "traccion" },
  { id: "plank", name: "Plancha", pattern: "core", duration: "45 seg" },
];
const rutinas = [
  { id: "r0", alumno_id: A, nombre: "Vieja", created_at: iso(120), datos: { days: [{ exercises: [{ id: "sq" }] }] } },
  { id: "r1", alumno_id: A, nombre: "Fuerza", created_at: iso(60), datos: { ciclo_actual: 2, days: [0, 1, 2].map(() => ({ exercises: [{ id: "sq" }, { id: "custom_1" }, { id: "plank", reps: '45"' }] })) } },
  { id: "r2", alumno_id: B, nombre: "Inicio", created_at: iso(3), datos: { days: [{ exercises: [{ id: "sq" }] }, { exercises: [{ id: "sq" }] }] } },
];
const p = (aid, rid, ex, n, kg, reps, extra) => Object.assign({ alumno_id: aid, rutina_id: rid, ejercicio_id: ex, fecha: dmy(n), kg, reps, semana: 0 }, extra || {});
const progresoGlobal = {
  [A]: [
    p(A, "r0", "sq", 40, 100, 5, { ciclo: 1 }),          // primer registro (rutina anterior): NO es PR, pero es el record a superar
    p(A, "r1", "sq", 10, 102.5, 5, { ciclo: 2 }),        // ciclo nuevo, mismo dia: dos series ascendentes => UN PR (105)
    p(A, "r1", "sq", 10, 105, 5, { ciclo: 2 }),
    p(A, "r1", "custom_1", 12, 20, 10, { ciclo: 2 }),    // personalizado: primer registro (no PR) y suma volumen
    p(A, "r1", "custom_1", 5, 20, 10, { ciclo: 2 }),     // igualarlo no es PR
    p(A, "r1", "plank", 5, 10, 45, { ciclo: 2 }),        // por tiempo: reps = segundos => ni volumen ni PR
    p(A, "r1", "plank", 3, 20, 45, { ciclo: 2 }),
  ],
};
const s = (aid, rid, n, dia, extra) => Object.assign({ alumno_id: aid, rutina_id: rid, rutina_nombre: "", fecha: dmy(n), created_at: iso(n), semana: 1, dia_idx: dia }, extra || {});
const sesionesGlobales = [
  s(A, "r1", 10, 0), s(A, "r1", 10, 0),                                     // misma sesion guardada dos veces: cuenta una
  s(A, "r1", 12, 1),
  s(A, "r1", 5, 2, { origen: "validada_coach", ejercicios: "" }),           // validada por el entrenador: cuenta aparte
  s(A, "r0", 8, 0),                                                         // otra rutina: no cuenta para r1
  s(B, "r2", 1, 0),
];
const params = (over) => Object.assign({ alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador: rutinas, allEx, periodId: "semanas4", alumnoSel: A, ejercicioSelId: "sq", diaIdx: 0, lang: "es" }, over || {});
const chip = (chips, key) => chips.find((c) => c.key === key);
const m = buildCoachProgresoModel(params());

// ======================================================================= modelo de la vista = nucleo
await test("integracion: el modelo de Progreso devuelve exactamente lo que calcula lib/metricas", () => {
  const hoy = Metricas.diaLocal();
  const actual = { desde: hoy - 27, hasta: hoy }, previo = { desde: hoy - 55, hasta: hoy - 28 };
  const indice = Metricas.indiceEjerciciosPorTiempo(allEx, rutinas);
  const ev = Metricas.eventosPR(progresoGlobal[A], { indiceTiempo: indice });
  assert.equal(m.prsPeriod, Metricas.contarPRs(ev, actual.desde, actual.hasta));
  const cmp = Metricas.compararVolumen(progresoGlobal[A], actual, previo, { indiceTiempo: indice });
  assert.equal(m.volSemPromKg, cmp.actualTotal / 4);
  assert.deepEqual([m.volPct, m.volMotivo], [cmp.pct, cmp.motivo]);
  const ad = Metricas.adherencia({ rutina: rutinas[1], sesiones: sesionesGlobales, alumnoId: A, desde: actual.desde, hasta: actual.hasta });
  assert.equal(chip(m.alumnoChips, "alumnoAdherence").value, ad.pct);
  assert.deepEqual(m.indiceTiempo, indice);
});

await test("PR: primer registro (otra rutina, ciclo anterior) no es PR; el PR real supera el historial completo; uno por dia", () => {
  assert.equal(m.prsPeriod, 1);
  assert.equal(m.prsRecientes.length, 1);
  assert.deepEqual([m.prsRecientes[0].ex, m.prsRecientes[0].val, m.prsRecientes[0].delta], ["Sentadilla", "105 kg", "+5 kg"]);
  assert.ok(!m.prsRecientes.some((x) => /Remo|Plancha|Nuevo PR/.test(x.ex + x.delta)), "ni personalizado igualado, ni por tiempo, ni 'Nuevo PR'");
});

await test("volumen: incluye personalizados, excluye por tiempo, usa todo el historial (todas las rutinas y ciclos)", () => {
  const esperado = 102.5 * 5 + 105 * 5 + 20 * 10 * 2; // plancha excluida
  assert.equal(m.volSemPromKg * 4, esperado);
  assert.equal(chip(m.alumnoChips, "alumnoVolume").val, Math.round(esperado / 4) + " kg");
  assert.equal(m.patronPatterns.find((x) => x.key === "core").vol, 0, "plancha: serie contada, volumen 0");});

await test("comparacion de volumen: periodo previo con un solo dia (rutina anterior) => sin porcentaje y con motivo", () => {
  assert.equal(m.volPct, null);
  assert.equal(m.volMotivo, "previo_con_pocos_dias");
  assert.equal(chip(m.alumnoChips, "alumnoVolume").delta, "Pocos datos en el período anterior");
  const vacio = buildCoachProgresoModel(params({ progresoGlobal: {} }));
  assert.equal(chip(vacio.alumnoChips, "alumnoVolume").val, "—");
  assert.equal(chip(vacio.alumnoChips, "alumnoVolume").delta, "Sin datos suficientes");
});

await test("adherencia: rutina asignada, sin duplicados, otra rutina fuera, validadas aparte; rutina recien asignada no se penaliza", () => {
  const ana = m.adherenciaRows.find((r) => r.id === A);
  assert.deepEqual([ana.completed, ana.planned, ana.validadas, ana.p], [3, 12, 1, 25]);
  const beto = m.adherenciaRows.find((r) => r.id === B);
  assert.deepEqual([beto.completed, beto.planned, beto.p], [1, 2, 50], "asignada hace 3 dias: 1 semana de plan, no 4");
  assert.ok(!m.adherenciaRows.some((r) => r.id === CA), "sin rutina: fuera del ranking");
  // equipo: (25 + 50) / 2; delta solo con quien tenia plan en el periodo anterior (Ana 0% -> 25%; Beto no tenia plan)
  assert.equal(chip(m.teamChips, "teamAdherence").val, "38%");
  assert.equal(chip(m.teamChips, "teamAdherence").delta, "↑ 25% vs período anterior");
  const mBeto = buildCoachProgresoModel(params({ alumnoSel: B }));
  assert.equal(chip(mBeto.alumnoChips, "alumnoAdherence").delta, "Sin plan en el período anterior");
});

await test("historial incompleto (E0): los deltas no se informan como si fueran reales", () => {
  const inc = buildCoachProgresoModel(params({ historiaCompleta: { sesiones: false, progreso: false } }));
  const txt = "Historial incompleto: sin comparación";
  assert.equal(chip(inc.alumnoChips, "alumnoPrs").delta, txt);
  assert.equal(chip(inc.alumnoChips, "alumnoVolume").delta, txt);
  assert.equal(chip(inc.alumnoChips, "alumnoAdherence").delta, txt);
  assert.equal(chip(inc.teamChips, "teamAdherence").delta, txt);
  assert.equal(inc.volPct, null);
  // los valores del periodo se siguen mostrando
  assert.equal(chip(inc.alumnoChips, "alumnoPrs").value, 1);
});

// ======================================================================= pantallas reales
await test("ProgresoView (SSR): ranking con validadas por el entrenador y equipo calculados por el nucleo; aviso de historial incompleto", () => {
  const html = renderToStaticMarkup(h(ProgresoView, { alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador: rutinas, allEx, historiaCompleta: { sesiones: true, progreso: false } }));
  assert.match(html, /3\/12 sesiones completadas · 1 validadas por vos/);
  assert.match(html, /1\/2 sesiones completadas/);
  assert.match(html, /38%/);
  assert.match(html, /↑ 25% vs período anterior/);
  assert.match(html, /data-qa="historial-incompleto"/);
  const ok = renderToStaticMarkup(h(ProgresoView, { alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador: rutinas, allEx }));
  assert.doesNotMatch(ok, /historial-incompleto/);
});

await test("CoachDashboard (SSR): «Racha actual» sintetica reemplazada por «Alumnos activos esta semana» (sesiones completadas reales)", () => {
  const hoyS = [s(A, "r1", 0, 0, { origen: "validada_coach" }), s(B, "r2", 0, 1), s(B, "r2", 0, 0), s(CA, null, 0, 0, { estado: "pendiente" })];
  const html = renderToStaticMarkup(h(CoachDashboard, { alumnos, sesionesGlobales: hoyS, progresoGlobal: {}, rutinasSBEntrenador: rutinas, allEx, lang: "es" }));
  assert.doesNotMatch(html, /Racha actual/);
  assert.match(html, /Alumnos activos esta semana/);
  assert.match(html, /2 \/ 3/, "Ana (validada) y Beto; Caro solo tiene una pendiente");
  const nadie = renderToStaticMarkup(h(CoachDashboard, { alumnos, sesionesGlobales: [s(A, "r1", 400, 0)], progresoGlobal: {}, rutinasSBEntrenador: rutinas, allEx, lang: "es" }));
  assert.match(nadie, /0 \/ 3/, "sesiones viejas no cuentan");
});

// ======================================================================= alcance
await test("alcance: pantallas del entrenador importan lib/metricas; calculos antiguos eliminados; alumno sin cambios", () => {
  const metrics = read("components/coachProgresoMetrics.js");
  assert.match(metrics, /from "\.\.\/lib\/metricas\/index\.js"/);
  assert.doesNotMatch(metrics, /export function (buildPrEvents|rowVolumeKg|getPeriodBounds)/);
  assert.doesNotMatch(metrics, /Nuevo PR/);
  assert.match(read("components/CoachDashboard.jsx"), /rachaSemanal\(/);
  assert.doesNotMatch(read("components/CoachDashboard.jsx"), /var rachaActual/);
  assert.match(read("components/coach/EjercicioHistorialCoach.jsx"), /lib\/metricas/);
  assert.match(read("components/ProgresoView.jsx"), /historiaCompleta: historiaCompleta/);
  assert.match(read("components/ProgresoView.jsx"), /indiceTiempo=\{model\.indiceTiempo\}/);
  for (const f of ["App.jsx", "components/student-progress/progressMetrics.js", "lib/trainingVolume.js"]) {
    assert.doesNotMatch(read(f), /lib\/metricas/, f + " (alumno) no se toca en E2");
  }
});

console.log("\n" + count + " pruebas OK");
