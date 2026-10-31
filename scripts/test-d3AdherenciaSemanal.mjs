// D3 — metricas semanales del Dashboard del entrenador unificadas con E1/E2 (hallazgos H4, H5 y H7 de la auditoria D0).
//
//   node scripts/test-d3AdherenciaSemanal.mjs
//
// Definiciones (components/CoachDashboard.jsx):
//   Adherencia semanal = lib/metricas/adherencia.js (sin cambios) sobre la semana de CALENDARIO en curso (lunes .. hoy); equipo con la
//                        regla de Progreso (promedio de los alumnos con plan; delta solo con alumnos con plan en ambos periodos y nunca con
//                        el historial de sesiones incompleto).
//   "vs semana pasada" = misma metrica sobre el MISMO tramo de la semana anterior (lunes .. mismo dia).
//   Baja actividad     = activo (21 dias) + < 30 % la semana pasada COMPLETA (rutina asignada antes de su lunes) + < 30 % en esta.
//   Avance de rutina   = lib/studentWeeklyProgress.js: solo para las alertas de rutina (terminada / falta 1), no como adherencia.
//   H8 (fuente unica de rutinas en App.jsx) queda pendiente de autorizacion: check:scope no permite tocar App.jsx.
//
// Funciones puras con un "hoy" fijo + SSR del CoachDashboard real y del modelo de Progreso con datos FICTICIOS. Sin red ni Supabase.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d3-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard, { semanasDashboard, adherenciaSemanalAlumno, resumenAdherenciaEquipo } from "./components/CoachDashboard.jsx";' +
      'import { buildCoachProgresoModel } from "./components/coachProgresoMetrics.js";' +
      'import { getStudentWeeklyProgress } from "./lib/studentWeeklyProgress.js";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      'import { mergeRutinasAsignadas } from "./lib/routineStore.js";' +
      'import * as Metricas from "./lib/metricas/index.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, semanasDashboard, adherenciaSemanalAlumno, resumenAdherenciaEquipo, buildCoachProgresoModel, getStudentWeeklyProgress, selectCoachStudentListState, mergeRutinasAsignadas, Metricas };",
    resolveDir: ROOT, sourcefile: "d3-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const X = await import(pathToFileURL(outfile).href);
const { React, renderToStaticMarkup, CoachDashboard, semanasDashboard, adherenciaSemanalAlumno, resumenAdherenciaEquipo, Metricas } = X;
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- calendario fijo: miercoles 28/10/2026 (lunes 26/10) ----
const D = (d, m, y = 2026) => Metricas.dayNum(y, m, d);
const fecha = (dia) => { const t = new Date(dia * 86400000); return t.getUTCDate() + "/" + (t.getUTCMonth() + 1) + "/" + t.getUTCFullYear(); };
const isoDia = (dia) => new Date(dia * 86400000 + 15 * 3600000).toISOString();
const MIE = D(28, 10), LUN = D(26, 10);
const dias = (n) => Array.from({ length: n }, () => ({ exercises: [{ id: "sq" }] }));
const rut = (id, aid, nDias, creadaDia, datos) => ({ id, alumno_id: aid, nombre: id, created_at: isoDia(creadaDia), datos: Object.assign({ days: dias(nDias) }, datos || {}) });
const ses = (aid, rid, dia, diaIdx, extra) => Object.assign({ alumno_id: aid, rutina_id: rid, rutina_nombre: "", fecha: fecha(dia), created_at: isoDia(dia), semana: 1, dia_idx: diaIdx }, extra || {});
const fila = (a, cat, rutina, sesiones, hoy) => adherenciaSemanalAlumno({ id: a }, cat, rutina, sesiones, semanasDashboard(hoy), false);

// ======================================================================= periodos
await test("semanas de calendario: actual = lun..hoy; comparacion = mismo tramo de la semana pasada; seguimiento = semana pasada completa", () => {
  const s = semanasDashboard(MIE);
  assert.deepEqual(s.actual, { desde: LUN, hasta: MIE });
  assert.deepEqual(s.previaMismo, { desde: LUN - 7, hasta: MIE - 7 });
  assert.deepEqual(s.previaCompleta, { desde: LUN - 7, hasta: LUN - 1 });
  assert.equal(s.diaSemana, 3);
  assert.equal(semanasDashboard(D(1, 11)).diaSemana, 7, "domingo");
  assert.equal(semanasDashboard(LUN).diaSemana, 1);
});

// ======================================================================= H4: semana actual y anterior, misma metrica
await test("H4: semana actual vs anterior con la MISMA metrica (adherencia) y tramos equivalentes (lun..mie vs lun..mie)", () => {
  const r = rut("r", "ana", 3, D(1, 9));
  const sesiones = [ses("ana", "r", LUN, 0), ses("ana", "r", LUN + 1, 1), ses("ana", "r", LUN - 7, 0), ses("ana", "r", LUN - 3, 2)]; // vie pasado: fuera del tramo
  const f = fila("ana", "activo", r, sesiones, MIE);
  assert.equal(f.pct, 67);
  const esperadoPrev = Metricas.adherencia({ rutina: r, sesiones, alumnoId: "ana", desde: LUN - 7, hasta: MIE - 7 });
  assert.equal(f.previaMismo.pct, esperadoPrev.pct);
  assert.equal(f.previaMismo.pct, 33, "el viernes pasado no entra en el tramo lun..mie");
  assert.equal(f.previaCompleta.pct, 67, "la semana pasada completa si lo incluye");
  const eq = resumenAdherenciaEquipo([Object.assign({ planState: f.planState, pct: f.pct, adh: f })], { sesiones: true, progreso: true });
  assert.equal(eq.delta, 67 - 33);
});

await test("H4: sin periodo comparable (rutina nueva) o con historial incompleto -> sin delta (null + motivo)", () => {
  const nueva = rut("n", "beto", 3, LUN + 1);
  const f = fila("beto", "activo", nueva, [ses("beto", "n", MIE, 0)], MIE);
  const row = { planState: f.planState, pct: f.pct, adh: f };
  const eq = resumenAdherenciaEquipo([row], { sesiones: true, progreso: true });
  assert.equal(eq.delta, null);
  assert.equal(eq.motivoSinDelta, "sin_periodo_comparable");
  const r = rut("r", "ana", 3, D(1, 9));
  const fa = fila("ana", "activo", r, [ses("ana", "r", LUN, 0), ses("ana", "r", LUN - 7, 0)], MIE);
  const inc = resumenAdherenciaEquipo([{ planState: fa.planState, pct: fa.pct, adh: fa }], { sesiones: false, progreso: true });
  assert.equal(inc.delta, null);
  assert.equal(inc.motivoSinDelta, "historial_incompleto");
});

// ======================================================================= H5: entreno hace 10 dias
await test("H5: entreno hace 10 dias -> 0 % esta semana (antes: 100 % por pertenecer a la semana activa de la rutina)", () => {
  const r = rut("r", "caro", 3, D(1, 9));
  const sesiones = [0, 1, 2].map((i) => ses("caro", "r", MIE - 10, i));
  const avance = getAvance("caro", r, sesiones, MIE);
  assert.equal(avance.pct, 100, "el avance de la semana de la rutina sigue siendo 100 %");
  const f = fila("caro", "activo", r, sesiones, MIE);
  assert.equal(f.pct, 0, "la adherencia de la semana de calendario es 0 %");
  assert.equal(f.previaCompleta.pct, 0, "la semana pasada (19-25/10) tampoco entreno");
  assert.equal(f.seguimiento, "baja", "10 dias sin entrenar con plan: requiere seguimiento");
});
function getAvance(aid, r, sesiones, hoy) {
  return X.getStudentWeeklyProgress({ alumno: { id: aid }, rutina: r, sesiones, progreso: {}, now: new Date(hoy * 86400000 + 15 * 3600000) });
}

// ======================================================================= H7: comienzo de semana
await test("H7: lunes sin entrenar todavia pero la semana pasada cumplio -> 0 % y 'al dia' (no 'baja actividad')", () => {
  const r = rut("r", "dani", 3, D(1, 9));
  const sesiones = [0, 1, 2].map((i) => ses("dani", "r", LUN - 7 + i * 2, i));
  const f = fila("dani", "activo", r, sesiones, LUN);
  assert.equal(f.pct, 0);
  assert.equal(f.previaCompleta.pct, 100);
  assert.equal(f.seguimiento, "al_dia");
});

await test("H7: baja actividad exige las DOS semanas < 30 %; si esta semana ya supera el umbral, no se marca", () => {
  const r = rut("r", "eva", 3, D(1, 9));
  const pocas = [ses("eva", "r", MIE, 0)]; // 1/3 = 33 % esta semana, 0 % la pasada
  assert.equal(fila("eva", "activo", r, pocas, MIE).seguimiento, "al_dia");
  assert.equal(fila("eva", "activo", r, [], MIE).seguimiento, "baja");
  assert.equal(fila("eva", "inactivo", r, [], MIE).seguimiento, "al_dia", "inactivo (21 dias) tiene su propio estado, no se cuenta dos veces");
});

// ======================================================================= cambio de semana de rutina / reinicio de ciclo
await test("cambio de semana de rutina: la adherencia cuenta por fecha de calendario, no por la semana activa de la rutina", () => {
  const r = rut("r", "fede", 3, D(1, 9), { semana_activa: 3 });
  const sesiones = [ses("fede", "r", LUN, 2, { semana: 2 }), ses("fede", "r", MIE, 0, { semana: 3 })];
  const f = fila("fede", "activo", r, sesiones, MIE);
  assert.equal(f.actual.completadas, 2, "ambas sesiones son de esta semana de calendario");
  assert.equal(f.pct, 67);
  const avance = getAvance("fede", r, sesiones, MIE);
  assert.equal(avance.weekNumber, 3);
  assert.equal(avance.completedDays, 1, "el avance de rutina solo cuenta la semana 3");
});

await test("reinicio de ciclo: la adherencia no se borra con el reinicio (igual que Progreso); el avance de rutina si es del ciclo nuevo", () => {
  const r = rut("r", "gabi", 3, D(1, 9), { ciclo_actual: 2 });
  const sesiones = [ses("gabi", "r", LUN, 0), ses("gabi", "r", LUN + 1, 1, { ciclo: 2 })];
  const f = fila("gabi", "activo", r, sesiones, MIE);
  assert.equal(f.actual.completadas, 2);
  assert.equal(getAvance("gabi", r, sesiones, MIE).completedDays, 1);
});

// ======================================================================= duplicadas y validadas
await test("sesiones duplicadas cuentan una vez; validadas por el entrenador cuentan y se informan aparte; realizada gana a validada", () => {
  const r = rut("r", "hugo", 3, D(1, 9));
  const sesiones = [
    ses("hugo", "r", LUN, 0), ses("hugo", "r", LUN, 0),                                   // duplicada
    ses("hugo", "r", LUN + 1, 1, { origen: "validada_coach" }),                          // validada
    ses("hugo", "r", MIE, 2), ses("hugo", "r", MIE, 2, { origen: "validada_coach" }),    // realizada + validada el mismo dia
    ses("hugo", "r", MIE, 1, { estado: "pendiente" }),                                   // no completada
  ];
  const f = fila("hugo", "activo", r, sesiones, MIE);
  assert.deepEqual([f.actual.completadas, f.actual.realizadas, f.actual.validadas, f.pct], [3, 2, 1, 100]);
  const eq = resumenAdherenciaEquipo([{ planState: f.planState, pct: f.pct, adh: f }], null);
  assert.equal(eq.validadas, 1);
});

// ======================================================================= sin rutina / rutina recien asignada
await test("sin rutina: sin porcentaje ni seguimiento y fuera del promedio del equipo", () => {
  const f = fila("ines", "sin_rutina", null, [], MIE);
  assert.deepEqual([f.pct, f.planState, f.seguimiento], [null, "sin_rutina", null]);
  const r = rut("r", "ana", 2, D(1, 9));
  const fa = fila("ana", "activo", r, [ses("ana", "r", LUN, 0)], MIE);
  const eq = resumenAdherenciaEquipo([{ planState: f.planState, pct: f.pct, adh: f }, { planState: fa.planState, pct: fa.pct, adh: fa }], null);
  assert.deepEqual([eq.alumnosConPlan, eq.pct, eq.completadas, eq.planificadas], [1, 50, 1, 2]);
});

await test("rutina recien asignada (martes): la semana pasada no es medible -> 'rutina_nueva', sin juzgar ni comparar", () => {
  const r = rut("n", "juan", 3, LUN + 1);
  const f = fila("juan", "activo", r, [], MIE);
  assert.equal(f.planState, "ok");
  assert.equal(f.seguimiento, "rutina_nueva");
  assert.equal(f.actual.desdeEfectivo, LUN + 1, "el periodo empieza el dia de la asignacion (adherencia de E1)");
  assert.equal(f.previaMismo.pct, null);
});

// ======================================================================= SSR del Dashboard real (hoy real)
const HOY = Metricas.diaLocal();
const S = semanasDashboard(HOY);
const alumnos = [{ id: "ana", nombre: "Ana" }, { id: "beto", nombre: "Beto" }, { id: "caro", nombre: "Caro" }, { id: "kim", nombre: "Kim" }];
const limpias = [rut("r-ana", "ana", 2, HOY - 60), rut("r-caro", "caro", 3, HOY - 60)];
// Kim: rutina asignada desde otro dispositivo, todavia solo en rutinasSB (la ficha abierta), no en la lista del entrenador
const rutinasSB = [rut("r-kim", "kim", 2, HOY)];
const unificadas = X.mergeRutinasAsignadas(limpias, rutinasSB, { ana: true, beto: true, caro: true, kim: true });
// Kim entreno hace 5 dias con su rutina anterior (activa); la nueva es de hoy. Inactividad (21 dias) es otra regla y tiene prioridad.
const sesiones = [ses("ana", "r-ana", S.actual.desde, 0), ses("ana", "r-ana", S.previaMismo.desde, 0), ses("caro", "r-caro", HOY - 10, 0), ses("kim", "r-vieja", HOY - 5, 0)];
const strip = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
function renderDash(over) {
  const props = Object.assign({ alumnos, sesionesGlobales: sesiones, progresoGlobal: {}, historiaCompleta: { sesiones: true, progreso: true }, rutinasSBEntrenador: unificadas, lang: "es" }, over || {});
  const cat = X.selectCoachStudentListState({
    alumnosActivosLimpios: props.alumnos, rutinasUnificadas: props.rutinasSBEntrenador, sesionesGlobalesLimpias: props.sesionesGlobales,
    progresoGlobalLimpio: props.progresoGlobal, coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
  }).coachAlumnoCategoria;
  return strip(renderToStaticMarkup(h(CoachDashboard, Object.assign({ getAlumnoCategoria: cat }, props))));
}
function filaTabla(t, nombre) {
  const i = t.indexOf(" " + nombre + " ", t.indexOf("ALUMNO ADHERENCIA (SEMANA)"));
  assert.ok(i >= 0, nombre);
  return t.slice(i, t.indexOf("Mensaje", i));
}

await test("SSR: rutina recien asignada (misma lista para categoria y metricas) -> 'Rutina nueva', no 'Sin datos' ni 'Sin rutina'", () => {
  const t = renderDash();
  const k = filaTabla(t, "Kim");
  assert.match(k, /Rutina nueva/);
  assert.doesNotMatch(k, /Sin datos|Sin rutina/);
  assert.match(filaTabla(t, "Beto"), /Sin rutina/);
});

await test("SSR: periodo de referencia visible, delta 'vs semana pasada (lun–<hoy>)' y estados por alumno", () => {
  const t = renderDash();
  assert.match(t, /Adherencia semanal/);
  assert.match(t, /sesiones completadas · lun \d+\/\d+ – hoy/);
  assert.match(t, /vs semana pasada \(lun–(lun|mar|mié|jue|vie|sáb|dom)\)|Sin comparación/);
  assert.match(filaTabla(t, "Caro"), /\b0%/, "Caro entreno hace 10 dias: 0 % esta semana");
  assert.doesNotMatch(t, /Buen cumplimiento|Cumplimiento semanal|CUMPLIMIENTO/);
});

await test("SSR: historial de sesiones incompleto -> 'Sin comparación' (sin porcentaje de variacion)", () => {
  const t = renderDash({ historiaCompleta: { sesiones: false, progreso: true } });
  assert.match(t, /Sin comparación/);
  assert.doesNotMatch(t, /[+-]\d+% vs semana pasada/);
});

// ======================================================================= coherencia con Progreso
await test("coherencia: el % del Dashboard es el mismo que Progreso calcula para la semana en curso (por alumno y promedio de equipo)", () => {
  const m = X.buildCoachProgresoModel({
    alumnos, sesionesGlobales: sesiones, progresoGlobal: {}, rutinasSBEntrenador: unificadas, allEx: [{ id: "sq", name: "Sentadilla" }],
    periodId: "custom", periodCustom: { desde: S.actual.desde, hasta: S.actual.hasta }, alumnoSel: "ana", lang: "es",
    historiaCompleta: { sesiones: true, progreso: true },
  });
  const t = renderDash();
  const team = m.teamChips.find((c) => c.key === "teamAdherence");
  assert.match(t, new RegExp("Adherencia semanal \\d+ / \\d+ " + team.value + "%"), "promedio de equipo = Progreso (" + team.value + "%)");
  for (const r of m.adherenciaRows) {
    assert.match(filaTabla(t, r.n), new RegExp("\\b" + r.p + "%"), r.n + " = " + r.p + "% en Progreso");
  }
  assert.equal(m.adherenciaRows.length, 3, "Ana, Caro y Kim tienen plan; Beto no");
});

console.log("\n" + count + " pruebas OK");
