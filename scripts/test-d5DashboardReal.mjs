// D5 — Dashboard REAL del entrenador (rediseno aprobado): jerarquia, metricas, handlers, estados y que ya no se renderizan las tarjetas viejas.
//
//   node scripts/test-d5DashboardReal.mjs
//
// 1) Modelo (components/coach/coachDashboardModelo.js): las metricas son EXACTAMENTE las de las funciones reales de D3/D4/E1 con un fixture.
// 2) UI (components/coach/CoachDashboardD5.jsx): SSR con esbuild + react-dom/server y, para ejecutar los onClick sin DOM, el arbol de
//    elementos se expande con scripts/qa/arbolReact.mjs (los controles reales, con espias como handlers).
// 3) CoachDashboard.jsx (SSR): renderiza D5, conserva la rama «progreso» y ya no usa las tarjetas del Dashboard anterior.
// La navegacion sobre la app compilada (375/390/430/1280 px) la verifica scripts/qa/dashboard-nav.mjs. Sin red ni Supabase; datos ficticios.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { expandir, porQa } from "./qa/arbolReact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d5-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard, { semanasDashboard, adherenciaSemanalAlumno, resumenAdherenciaEquipo, bajaActividadIds } from "./components/CoachDashboard.jsx";' +
      'import CoachDashboardD5 from "./components/coach/CoachDashboardD5.jsx";' +
      'import { coachDashboardModelo } from "./components/coach/coachDashboardModelo.js";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      'import { getStudentRoutine } from "./lib/studentWeeklyProgress.js";' +
      'import * as Metricas from "./lib/metricas/index.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, CoachDashboardD5, coachDashboardModelo, semanasDashboard, adherenciaSemanalAlumno, resumenAdherenciaEquipo, bajaActividadIds, selectCoachStudentListState, getStudentRoutine, Metricas };",
    resolveDir: ROOT, sourcefile: "d5-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const X = await import(pathToFileURL(outfile).href);
const { React, renderToStaticMarkup, CoachDashboard, CoachDashboardD5, coachDashboardModelo, Metricas } = X;
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fixture (fechas relativas a hoy) ----
const hace = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const dmy = (n) => { const d = hace(n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const iso = (n) => hace(n).toISOString();
const dias = (n) => Array.from({ length: n }, () => ({ exercises: [{ id: "sq" }] }));
// Ana: inactiva (sin sesiones) · Beto: baja actividad (entreno hace 15 dias) · Cami: sin rutina · Dora: al dia (entreno hoy, 1/1) · Eli: entreno hace 3 dias
const alumnos = [{ id: "ana", nombre: "Ana" }, { id: "beto", nombre: "Beto" }, { id: "cami", nombre: "Cami" }, { id: "dora", nombre: "Dora" }, { id: "eli", nombre: "Eli" }];
const rutinas = [
  { id: "r-ana", alumno_id: "ana", nombre: "A", created_at: iso(60), datos: { days: dias(2) } },
  { id: "r-beto", alumno_id: "beto", nombre: "B", created_at: iso(60), datos: { days: dias(2) } },
  { id: "r-dora", alumno_id: "dora", nombre: "D", created_at: iso(60), datos: { days: dias(1) } },
  { id: "r-eli", alumno_id: "eli", nombre: "E", created_at: iso(60), datos: { days: dias(3) } },
];
const ses = (aid, rid, n, dia) => ({ alumno_id: aid, rutina_id: rid, rutina_nombre: "", fecha: dmy(n), created_at: iso(n), semana: 1, dia_idx: dia });
const sesiones = [ses("beto", "r-beto", 15, 0), ses("dora", "r-dora", 0, 0), ses("eli", "r-eli", 3, 0)];
const COMPLETA = { sesiones: true, progreso: true };
const catFn = X.selectCoachStudentListState({
  alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinas, sesionesGlobalesLimpias: sesiones, progresoGlobalLimpio: {},
  coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
}).coachAlumnoCategoria;
const base = { alumnos, rutinas, sesiones, progresoGlobal: {}, historiaCompleta: COMPLETA, alumnosStatus: "ready", catFn };
const ids = (l) => l.map((a) => a.id);

// ======================================================================= modelo = funciones reales
await test("modelo: las metricas son las de las funciones reales de D3/D4/E1 (adherencia, seguimiento, entrenaron)", () => {
  const m = coachDashboardModelo(base);
  assert.equal(m.estado, "ok");
  const hoy = Metricas.diaLocal();
  const semanas = X.semanasDashboard(hoy);
  const filas = alumnos.map((a) => {
    const cat = catFn(a);
    const comp = X.adherenciaSemanalAlumno(a, cat, X.getStudentRoutine(rutinas, a), sesiones, semanas, false);
    return { alumno: a, cat, pct: comp.pct, planState: comp.planState, adh: comp };
  });
  const eq = X.resumenAdherenciaEquipo(filas, COMPLETA);
  assert.equal(m.equipo.total, 5);
  assert.equal(m.equipo.adherenciaPct, eq.pct);
  assert.equal(m.equipo.adherenciaDelta, eq.delta);
  assert.equal(m.equipo.motivoSinDelta, eq.motivoSinDelta);
  assert.equal(m.equipo.alumnosConPlan, eq.alumnosConPlan);
  assert.equal(m.equipo.entrenaronSemana, alumnos.filter((a) => Metricas.rachaSemanal(sesiones, { hoy, alumnoId: a.id }).incluyeSemanaActual).length);
  assert.deepEqual(ids(m.seguimiento.sinRutina), ["cami"]);
  assert.deepEqual(ids(m.seguimiento.inactivos), ["ana"]);
  assert.deepEqual(ids(m.seguimiento.baja), Object.keys(X.bajaActividadIds({ alumnos, catFn, rutinas, sesiones })));
  assert.deepEqual(ids(m.seguimiento.baja), ["beto"]);
  assert.equal(m.equipo.requierenSeguimiento, 3);
  assert.deepEqual(m.semanas, semanas);
  assert.equal(m.equipo.historialIncompleto, false);
});

await test("modelo: «Actividad reciente» = ultima sesion completada de cada alumno en 14 dias, la mas reciente primero (Beto, hace 15 dias, no entra)", () => {
  const m = coachDashboardModelo(base);
  assert.deepEqual(m.recientes.map((r) => [r.alumno.id, r.haceDias]), [["dora", 0], ["eli", 3]]);
  assert.equal(m.recientes[0].fila.pct, 100);
});

await test("modelo: sin catFn usa la categoria de Alumnos (selectCoachStudentListState) y da lo mismo", () => {
  const a = coachDashboardModelo(base);
  const b = coachDashboardModelo({ ...base, catFn: undefined });
  assert.deepEqual(ids(b.seguimiento.sinRutina), ids(a.seguimiento.sinRutina));
  assert.deepEqual(ids(b.seguimiento.inactivos), ids(a.seguimiento.inactivos));
  assert.deepEqual(ids(b.seguimiento.baja), ids(a.seguimiento.baja));
  assert.equal(b.equipo.adherenciaPct, a.equipo.adherenciaPct);
});

await test("modelo: estados cargando / error / sin_alumnos / ok (nunca ceros mientras carga)", () => {
  const vacio = { ...base, alumnos: [], sesiones: [], historiaCompleta: null };
  for (const st of ["loading", "idle"]) {
    const m = coachDashboardModelo({ ...vacio, alumnosStatus: st });
    assert.equal(m.estado, "cargando", st);
    assert.equal(m.equipo.entrenaronSemana, null); assert.equal(m.equipo.requierenSeguimiento, null);
  }
  assert.equal(coachDashboardModelo({ ...vacio, alumnosStatus: "error" }).estado, "error");
  assert.equal(coachDashboardModelo({ ...vacio, alumnosStatus: "ready" }).estado, "sin_alumnos");
  // historial en carga: alumnos > 0, historiaCompleta null, sin sesiones ni progreso
  assert.equal(coachDashboardModelo({ ...base, sesiones: [], historiaCompleta: null }).estado, "cargando");
  assert.equal(coachDashboardModelo({ ...base, sesiones: [], historiaCompleta: null, progresoGlobal: { ana: [{ fecha: dmy(1) }] } }).estado, "ok", "con progreso ya no es carga");
  assert.equal(coachDashboardModelo({ ...base, sesiones: [], historiaCompleta: COMPLETA }).estado, "ok", "historial cargado y vacio no es carga");
  // error de actualizacion con lista: se muestran los ultimos datos
  assert.equal(coachDashboardModelo({ ...base, alumnosStatus: "error" }).estado, "ok");
});

await test("modelo: historial incompleto y sin plan semanal", () => {
  const inc = coachDashboardModelo({ ...base, historiaCompleta: { sesiones: false, progreso: true } });
  assert.equal(inc.equipo.historialIncompleto, true);
  assert.equal(inc.equipo.adherenciaDelta, null);
  assert.equal(inc.equipo.motivoSinDelta, "historial_incompleto");
  const sinPlan = coachDashboardModelo({ ...base, alumnos: [alumnos[2]] });
  assert.equal(sinPlan.equipo.adherenciaPct, null, "sin plan: null, nunca 0 %");
});

// ======================================================================= UI (D5)
const ESCRITORIO = 1280;
function espias() {
  const calls = [];
  const spy = (name) => function () { calls.push([name].concat([].slice.call(arguments))); };
  const props = {};
  ["onVerSinRutina", "onVerInactivos", "onVerBajaActividad", "onVerPerfil", "onRevisarAlumnos", "onNuevoAlumno", "onNuevaRutina", "onIrProgreso", "onGlobalSearchNavigate"].forEach((n) => { props[n] = spy(n); });
  return { calls, props };
}
function Probe(p) { globalThis.__arbol = CoachDashboardD5(p); return globalThis.__arbol; }
/** Renderiza D5 (SSR). ancho: simula window.innerWidth (sin window = movil, como el primer render real). */
function d5(over, ancho) {
  const s = espias();
  const props = Object.assign({ modelo: coachDashboardModelo(base), darkMode: true, coachName: "Hernán Kreick", ahora: new Date(2026, 9, 31, 12), campana: h("span", { "data-qa": "campana-real" }, "campana"), globalSearchData: { alumnos: [], rutinas: [], ejercicios: [], sesiones: [] } }, s.props, over || {});
  if (ancho) globalThis.window = { innerWidth: ancho };
  let html;
  try { html = renderToStaticMarkup(h(Probe, props)); } finally { delete globalThis.window; }
  const qa = porQa(expandir(globalThis.__arbol));
  return { html, qa, calls: s.calls, get: (k) => qa.find((n) => n.qa === k), todos: (k) => qa.filter((n) => n.qa === k) };
}
const strip = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

await test("jerarquia: encabezado -> resumen -> requieren seguimiento -> actividad reciente -> acciones rapidas (movil y escritorio)", () => {
  for (const ancho of [undefined, ESCRITORIO]) {
    const r = d5({}, ancho);
    const orden = ["d5-encabezado", "d5-resumen", "d5-seguimiento", "d5-recientes", "d5-acciones"].map((k) => r.html.indexOf('data-qa="' + k + '"'));
    assert.ok(orden.every((i) => i >= 0), "todas las secciones (" + ancho + ")");
    assert.deepEqual([...orden].sort((a, b) => a - b), orden, "orden de las secciones (" + (ancho || "movil") + ")");
    const stats = ["total", "entrenaron", "adherencia", "seguimiento"].map((k) => r.html.indexOf('data-qa="d5-stat-' + k + '"'));
    assert.deepEqual([...stats].sort((a, b) => a - b), stats);
  }
  assert.match(d5({}, ESCRITORIO).html, /grid-template-columns:minmax\(0, ?1fr\) minmax\(0, ?1\.35fr\)/, "escritorio: seguimiento y actividad lado a lado");
});

await test("encabezado: «Hola, {primer nombre}» (o «Entrenador»), fecha local con solo la primera letra en mayuscula, campana real", () => {
  const r = d5();
  assert.match(strip(r.html), /Hola, Hernán/);
  assert.equal(r.get("d5-fecha").texto, "Sábado 31 de octubre");
  assert.match(d5({ coachName: "" }).html, /Hola, Entrenador/);
  assert.match(d5({ coachName: "   " }).html, /Hola, Entrenador/);
  assert.match(d5({ ahora: new Date(2026, 0, 5, 12) }).get("d5-fecha").texto, /^Lunes 5 de enero$/);
  const enc = r.html.slice(r.html.indexOf('data-qa="d5-encabezado"'), r.html.indexOf('data-qa="d5-resumen"'));
  assert.match(enc, /data-qa="campana-real"/, "la campana real vive en el encabezado");
  assert.doesNotMatch(strip(r.html), /CREAR|Crear\b(?! rutina)|Nuevo ejercicio|Contactar alumnos|Asignar rutina/);
});

await test("busqueda real: movil = boton de 44x44 «Buscar» (despliega GlobalSearch debajo); escritorio = GlobalSearch inline (max 360 px)", () => {
  const mov = d5();
  const btn = mov.html.match(/<button[^>]*aria-label="Buscar"[^>]*>/)[0];
  assert.match(btn, /width:44px;height:44px/);
  assert.match(btn, /aria-expanded="false"/);
  assert.doesNotMatch(mov.html, /coach-search-wrap/, "cerrado: no hay buscador en el flujo");
  const desk = d5({}, ESCRITORIO);
  assert.doesNotMatch(desk.html, /aria-label="Buscar"/);
  assert.match(desk.html, /data-qa="d5-buscar-inline"[^>]*style="[^"]*flex:0 1 360px/);
  assert.match(desk.html, /coach-search-wrap/);
  const src = read("components/coach/CoachDashboardD5.jsx");
  assert.match(src, /setBuscarAbierto\(!buscarAbierto\)/);
  assert.match(src, /!desk && buscarAbierto \?/);
  assert.match(src, /import GlobalSearch from "\.\.\/GlobalSearch\.jsx"/);
});

await test("resumen «Esta semana»: Alumnos, Entrenaron (X / N), Adherencia (promedio D3), Seguimiento; periodo «lun dd/mm – hoy»", () => {
  const r = d5();
  const m = coachDashboardModelo(base);
  const s = (k) => r.get("d5-stat-" + k).props;
  assert.match(strip(r.html), /Esta semana lun \d+\/\d+ – hoy/);
  assert.equal(r.get("d5-stat-total").texto, "Alumnos 5");
  assert.equal(r.get("d5-stat-entrenaron").texto, "Entrenaron " + m.equipo.entrenaronSemana + " / 5 con al menos 1 sesión");
  assert.match(r.get("d5-stat-adherencia").texto, new RegExp("^Adherencia " + m.equipo.adherenciaPct + "% "));
  assert.equal(r.get("d5-stat-seguimiento").texto, "Seguimiento 3 requieren atención");
  assert.equal(typeof s("seguimiento").onClick, "function", "con casos, «Seguimiento» hace scroll a la seccion");
  assert.equal(s("total").onClick, undefined);
  assert.match(r.html, /id="d5-seguimiento"/);
});

await test("adherencia: «±N pts vs sem. pasada» / «Sin comparación» / «Sin comparación (historial incompleto)» / «Sin plan semanal»", () => {
  const conDelta = coachDashboardModelo(base);
  assert.equal(conDelta.equipo.adherenciaDelta != null, true);
  const t = (modelo) => d5({ modelo }).get("d5-stat-adherencia").texto;
  const d = conDelta.equipo.adherenciaDelta;
  assert.ok(t(conDelta).endsWith((d >= 0 ? "+" : "") + d + " pts vs sem. pasada"), t(conDelta));
  const m0 = coachDashboardModelo(base);
  assert.match(t({ ...m0, equipo: { ...m0.equipo, adherenciaDelta: null, motivoSinDelta: "sin_periodo_comparable" } }), /Sin comparación$/);
  assert.match(t({ ...m0, equipo: { ...m0.equipo, adherenciaDelta: null, motivoSinDelta: "historial_incompleto" } }), /Sin comparación \(historial incompleto\)$/);
  assert.equal(t({ ...m0, equipo: { ...m0.equipo, adherenciaPct: null, adherenciaDelta: null } }), "Adherencia — Sin plan semanal");
  assert.match(t({ ...m0, equipo: { ...m0.equipo, adherenciaDelta: -7 } }), /-7 pts vs sem\. pasada$/);
});

await test("seguimiento: filas Sin rutina / Inactivos («Más de 21 días · nombres») / Baja actividad con nombres y cantidad", () => {
  const r = d5();
  assert.equal(r.get("d5-grupo-sin_rutina").texto, "Sin rutina Cami 1");
  assert.equal(r.get("d5-grupo-inactivos").texto, "Inactivos Más de 21 días · Ana 1");
  assert.equal(r.get("d5-grupo-baja").texto, "Baja actividad Beto 1");
  const dos = coachDashboardModelo({ ...base, alumnos: [...alumnos, { id: "zoe", nombre: "Zoe" }] }); // Zoe: sin rutina
  assert.equal(d5({ modelo: dos }).get("d5-grupo-sin_rutina").texto, "Sin rutina Cami, Zoe 2");
});

await test("handlers de seguimiento (D4): cada fila llama a SU handler; sin el especifico, onRevisarAlumnos", () => {
  const r = d5();
  r.get("d5-grupo-sin_rutina").props.onClick();
  r.get("d5-grupo-inactivos").props.onClick();
  r.get("d5-grupo-baja").props.onClick();
  assert.deepEqual(r.calls, [["onVerSinRutina"], ["onVerInactivos"], ["onVerBajaActividad"]]);
  const f = d5({ onVerSinRutina: undefined, onVerInactivos: undefined, onVerBajaActividad: undefined });
  f.get("d5-grupo-sin_rutina").props.onClick(); f.get("d5-grupo-inactivos").props.onClick(); f.get("d5-grupo-baja").props.onClick();
  assert.deepEqual(f.calls, [["onRevisarAlumnos"], ["onRevisarAlumnos"], ["onRevisarAlumnos"]]);
});

await test("sin casos: «Nadie requiere seguimiento esta semana.» y «Seguimiento» no es un boton", () => {
  const ok = [alumnos[3], alumnos[4]]; // Dora (hoy) y Eli (hace 3 dias): con rutina, activos
  const m = coachDashboardModelo({ ...base, alumnos: ok });
  assert.equal(m.equipo.requierenSeguimiento, 0);
  const r = d5({ modelo: m });
  assert.match(strip(r.html), /Nadie requiere seguimiento esta semana\./);
  assert.equal(r.todos("d5-grupo-sin_rutina").length + r.todos("d5-grupo-inactivos").length + r.todos("d5-grupo-baja").length, 0);
  assert.equal(r.get("d5-stat-seguimiento").props.onClick, undefined);
  assert.equal(r.get("d5-stat-seguimiento").texto, "Seguimiento 0 nadie por ahora");
});

await test("actividad reciente (14 dias, max 5): fila -> onVerPerfil(id); «Ver alumnos» -> onRevisarAlumnos", () => {
  const r = d5();
  const filas = r.todos("d5-reciente");
  assert.deepEqual(filas.map((f) => f.props["data-alumno-id"]), ["dora", "eli"]);
  assert.match(filas[0].texto, /^D Dora Hoy · 100% esta semana Al día$/);
  assert.match(filas[1].texto, /^E Eli Hace 3 días/);
  filas[1].props.onClick(); filas[0].props.onClick();
  r.get("d5-ver-alumnos").props.onClick();
  assert.deepEqual(r.calls, [["onVerPerfil", "eli"], ["onVerPerfil", "dora"], ["onRevisarAlumnos"]]);
  // maximo 5 filas aunque haya mas alumnos con sesiones recientes
  const muchos = Array.from({ length: 8 }, (_, i) => ({ id: "x" + i, nombre: "Alumno" + i }));
  const m = coachDashboardModelo({ ...base, alumnos: muchos, rutinas: muchos.map((a) => ({ id: "r" + a.id, alumno_id: a.id, created_at: iso(60), datos: { days: dias(2) } })), sesiones: muchos.map((a, i) => ses(a.id, "r" + a.id, i, 0)), catFn: undefined });
  assert.equal(m.recientes.length, 8);
  assert.equal(d5({ modelo: m }).todos("d5-reciente").length, 5);
  const vacio = coachDashboardModelo({ ...base, sesiones: [ses("beto", "r-beto", 20, 0)] });
  assert.match(strip(d5({ modelo: vacio }).html), /Nadie entrenó en los últimos 14 días\./);
});

await test("acciones rapidas: Nuevo alumno, Crear rutina, Ver alumnos, Progreso -> sus handlers", () => {
  const r = d5();
  assert.deepEqual(["nuevo", "rutina", "alumnos", "progreso"].map((k) => r.get("d5-accion-" + k).texto), ["Nuevo alumno", "Crear rutina", "Ver alumnos", "Progreso"]);
  for (const k of ["nuevo", "rutina", "alumnos", "progreso"]) r.get("d5-accion-" + k).props.onClick();
  assert.deepEqual(r.calls, [["onNuevoAlumno"], ["onNuevaRutina"], ["onRevisarAlumnos"], ["onIrProgreso"]]);
});

await test("estado cargando: «—» + «Cargando…», nunca 0", () => {
  const m = coachDashboardModelo({ ...base, alumnos: [], sesiones: [], historiaCompleta: null, alumnosStatus: "loading" });
  const r = d5({ modelo: m });
  for (const k of ["total", "entrenaron", "adherencia", "seguimiento"]) assert.match(r.get("d5-stat-" + k).texto, / —/, k);
  assert.match(r.get("d5-stat-seguimiento").texto, /Cargando…/);
  const t = strip(r.html);
  assert.doesNotMatch(t, /\b0\b|%|Todavía no tenés alumnos|No pudimos/);
  assert.equal(r.get("d5-stat-seguimiento").props.onClick, undefined);
});

await test("estado sin alumnos: tarjeta con «Agregar alumno» (onNuevoAlumno), sin resumen ni listas", () => {
  const r = d5({ modelo: coachDashboardModelo({ ...base, alumnos: [], sesiones: [] }) });
  assert.match(strip(r.html), /Todavía no tenés alumnos/);
  assert.equal(r.get("d5-agregar-alumno").texto, "Agregar alumno");
  r.get("d5-agregar-alumno").props.onClick();
  assert.deepEqual(r.calls, [["onNuevoAlumno"]]);
  assert.equal(r.todos("d5-resumen").length + r.todos("d5-seguimiento").length + r.todos("d5-recientes").length, 0);
  assert.equal(r.todos("d5-acciones").length, 1);
});

await test("estado error: «No pudimos cargar tus alumnos. Reintentá desde Alumnos.» con boton a Alumnos; sin ceros", () => {
  const r = d5({ modelo: coachDashboardModelo({ ...base, alumnos: [], sesiones: [], alumnosStatus: "error" }) });
  assert.match(strip(r.html), /No pudimos cargar tus alumnos\. Reintentá desde Alumnos\./);
  r.get("d5-error-alumnos").props.onClick();
  assert.deepEqual(r.calls, [["onRevisarAlumnos"]]);
  assert.doesNotMatch(strip(r.html), /Todavía no tenés alumnos|\b0\b|%/);
  assert.equal(r.todos("d5-resumen").length + r.todos("d5-seguimiento").length, 0);
});

await test("avisos: actualizacion fallida con lista (alumnosRefreshFailed) e historial incompleto", () => {
  assert.doesNotMatch(d5().html, /d5-actualizacion-fallida|d5-historial-incompleto/);
  const f = d5({ alumnosRefreshFailed: true });
  assert.match(strip(f.html), /No pudimos actualizar tus alumnos\. Reintentamos automáticamente; mostramos los últimos datos\./);
  assert.match(f.html, /role="status"/);
  const inc = d5({ modelo: coachDashboardModelo({ ...base, historiaCompleta: { sesiones: true, progreso: false } }) });
  assert.match(strip(inc.html), /Historial incompleto: puede faltar actividad antigua/);
  // el aviso de actualizacion no se muestra sin lista
  assert.doesNotMatch(d5({ alumnosRefreshFailed: true, modelo: coachDashboardModelo({ ...base, alumnos: [], sesiones: [], alumnosStatus: "error" }) }).html, /d5-actualizacion-fallida/);
});

await test("modo claro / oscuro con la paleta D5 y controles >= 44 px", () => {
  assert.match(d5({ darkMode: true }).html, /background:#0A0F1A/);
  assert.match(d5({ darkMode: false }).html, /background:#F1F5F9/);
  assert.doesNotMatch(d5({ darkMode: false }).html, /#0A0F1A/);
  const alto = (style) => { const m = style.match(/(?:^|;)(?:min-)?height:(\d+)px/g) || []; return Math.max(0, ...m.map((x) => Number(x.match(/(\d+)px/)[1]))); };
  for (const ancho of [undefined, ESCRITORIO]) {
    const html = d5({ alumnosRefreshFailed: true }, ancho).html;
    const botones = html.match(/<button[^>]*>/g);
    assert.ok(botones.length >= 10);
    for (const b of botones) assert.ok(alto((b.match(/style="([^"]*)"/) || [, ""])[1]) >= 44, "boton < 44 px: " + b.slice(0, 160));
  }
  // «Ver alumnos» (texto) tambien cumple el ancho minimo
  assert.match(d5().html, /data-qa="d5-ver-alumnos"[^>]*style="[^"]*min-height:44px;min-width:44px/);
});

await test("sin graficos decorativos ni datos inventados en la UI", () => {
  const src = read("components/coach/CoachDashboardD5.jsx") + read("components/coach/coachDashboardModelo.js");
  assert.doesNotMatch(src, /<svg|recharts|Math\.random|<canvas|<Chart/);
  assert.doesNotMatch(src, /supabase|fetch\(|localStorage/i, "presentacion pura: sin llamadas a datos");
});

// ======================================================================= CoachDashboard (SSR)
function dash(over) {
  const s = espias();
  const props = Object.assign({
    alumnos, alumnosStatus: "ready", sesionesGlobales: sesiones, progresoGlobal: {}, historiaCompleta: COMPLETA, rutinasSBEntrenador: rutinas,
    getAlumnoCategoria: catFn, lang: "es", darkMode: true, coachName: "Hernán Kreick",
  }, s.props, { onAsignarRutina: () => {}, onNuevoEjercicio: () => {}, onEnviarMensaje: () => {} }, over || {});
  return renderToStaticMarkup(h(CoachDashboard, props));
}

await test("CoachDashboard renderiza D5 con los mismos numeros que el modelo y NO las tarjetas del Dashboard anterior", () => {
  const html = dash();
  const t = strip(html);
  assert.match(html, /data-qa="d5-dashboard"/);
  assert.match(t, /Hola, Hernán/);
  assert.match(t, /Requieren seguimiento Sin rutina Cami 1 Inactivos Más de 21 días · Ana 1 Baja actividad Beto 1/);
  // marcas del Dashboard anterior
  assert.doesNotMatch(t, /ATENCIÓN HOY|RECOMENDACIÓN PRINCIPAL|IMPACTO ESTIMADO|ACCIONES RÁPIDAS|Alertas inteligentes|Mis alumnos|ADHERENCIA \(SEMANA\)|Adherencia semanal|Resumen de la semana|Activos esta semana|CREAR|Acá tenés el resumen/);
  assert.doesNotMatch(html, /cd-card|cd-quick-card|cd-attention-block/);
  const src = read("components/CoachDashboard.jsx");
  for (const f of ["CoachActiveStudentsCard", "CoachDashboardAttentionCard", "CoachDashboardSummaryGrid", "CoachQuickActions", "GlobalCreateMenu", "CoachDashboardStyles"]) {
    assert.doesNotMatch(src, new RegExp(f), f + " ya no se usa en CoachDashboard.jsx");
  }
  assert.doesNotMatch(src, /display: "none"/, "sin el bloque oculto «Alertas inteligentes»");
});

await test("CoachDashboard conserva la firma de props (App no cambia), la campana real y la rama «progreso»", () => {
  const src = read("components/CoachDashboard.jsx");
  for (const p of ["onAsignarRutina", "onNuevoEjercicio", "onEnviarMensaje", "onCrearRutina", "onRevisar", "onAbrirChatAlumno", "mensajesEntrenadorPendientes", "currentWeek", "supabase", "entrenadorId"]) assert.match(src, new RegExp("\\b" + p + "\\b"), p);
  assert.match(src, /<CoachNotificationCenter[\s\S]*?alertRows=\{coachAlertsReal\}[\s\S]*?entrenadorId=\{entrenadorId\}/);
  assert.match(src, /buildCoachAlerts\(alumnos, catFn,/);
  const html = dash();
  assert.match(html, /data-qa="d5-campana"/);
  assert.match(html, /aria-label="Notificaciones|coach-bell/);
  const prog = dash({ activeNav: "progreso" });
  assert.doesNotMatch(prog, /data-qa="d5-dashboard"/);
  for (const f of ["export function semanasDashboard", "export function adherenciaSemanalAlumno", "export function bajaActividadIds", "export function resumenAdherenciaEquipo"]) assert.ok(src.includes(f), f);
});

await test("CoachDashboard (SSR): estados cargando, sin alumnos, error y actualizacion fallida", () => {
  const cargando = strip(dash({ alumnos: [], alumnosStatus: "loading", sesionesGlobales: [], historiaCompleta: null }));
  assert.match(cargando, /Alumnos — Entrenaron — .*Seguimiento — Cargando…/);
  assert.doesNotMatch(cargando, /\b0\b|%/);
  assert.match(strip(dash({ alumnos: [], sesionesGlobales: [] })), /Todavía no tenés alumnos/);
  assert.match(strip(dash({ alumnos: [], alumnosStatus: "error", sesionesGlobales: [], historiaCompleta: null })), /No pudimos cargar tus alumnos\. Reintentá desde Alumnos\./);
  assert.match(strip(dash({ alumnosStatus: "error" })), /No pudimos actualizar tus alumnos/);
  assert.doesNotMatch(strip(dash()), /No pudimos actualizar/);
});

await test("CoachDashboard pasa a D5 los handlers de App tal cual (D4) y la busqueda real", () => {
  const src = read("components/CoachDashboard.jsx");
  const jsx = src.slice(src.indexOf("<CoachDashboardD5"));
  for (const p of ["onVerSinRutina", "onVerInactivos", "onVerBajaActividad", "onVerPerfil", "onRevisarAlumnos", "onNuevoAlumno", "onNuevaRutina", "onIrProgreso", "onGlobalSearchNavigate"]) {
    assert.match(jsx, new RegExp(p + "=\\{" + p + "\\}"), p);
  }
  assert.match(jsx, /globalSearchData=\{globalSearchData\}/);
  assert.match(jsx, /alumnosRefreshFailed=\{alumnosRefreshFailed\(alumnosStatus, alumnos\.length\)\}/);
  assert.match(jsx, /coachName=\{coachName\}/);
});

console.log("\n" + count + " pruebas OK");
