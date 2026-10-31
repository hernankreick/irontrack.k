// D4 — navegacion, botones y filtros del Dashboard del entrenador (hallazgos H10, H11 y H12 de la auditoria D0).
//
//   node scripts/test-d4NavegacionDashboard.mjs
//
// 1) SSR del CoachDashboard real con las tarjetas reemplazadas por "capturadores" (alias de esbuild): se obtienen los props reales que el
//    Dashboard pasa a «Mis alumnos», «Atencion hoy» y las tarjetas de resumen, y se ejecutan sus onClick con handlers espia.
// 2) Cableado estatico: App.jsx (handlers que fijan el filtro y limpian lo heredado), CoachDashboardMain / CoachStudentsMain (no pierden
//    props) y StudentsSection (chip «Baja actividad» y pedido del Dashboard con el flujo existente de asignacion).
// La navegacion real (Dashboard <-> Alumnos, 375/390/430/1280 px) la verifica scripts/qa/dashboard-nav.mjs sobre la app compilada.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d4-")), "bundle.mjs");
const { build } = await import("esbuild");
const CAPTURAR = /\/coach\/(CoachActiveStudentsCard|CoachDashboardAttentionCard|CoachDashboardSummaryGrid)\.jsx$/;
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard, { bajaActividadIds } from "./components/CoachDashboard.jsx";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, bajaActividadIds, selectCoachStudentListState };",
    resolveDir: ROOT, sourcefile: "d4-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  plugins: [{
    name: "capturar-tarjetas",
    setup(b) {
      b.onLoad({ filter: CAPTURAR }, (args) => {
        const nombre = args.path.match(CAPTURAR)[1];
        return { loader: "js", contents: "export default function " + nombre + "(props) { (globalThis.__capt = globalThis.__capt || {})['" + nombre + "'] = props; return null; }" };
      });
    },
  }],
});
const X = await import(pathToFileURL(outfile).href);
const { React, renderToStaticMarkup, CoachDashboard } = X;
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fixture (fechas relativas a hoy) ----
const hace = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const dmy = (n) => { const d = hace(n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const iso = (n) => hace(n).toISOString();
const dias = (n) => Array.from({ length: n }, () => ({ exercises: [{ id: "sq" }] }));
// Ana: inactiva (sin sesiones) · Beto: baja actividad (entreno hace 15 dias) · Cami: sin rutina · Dora: al dia (entreno hoy, 1/1)
const alumnos = [{ id: "ana", nombre: "Ana" }, { id: "beto", nombre: "Beto" }, { id: "cami", nombre: "Cami" }, { id: "dora", nombre: "Dora" }];
const rutinas = [
  { id: "r-ana", alumno_id: "ana", nombre: "A", created_at: iso(60), datos: { days: dias(2) } },
  { id: "r-beto", alumno_id: "beto", nombre: "B", created_at: iso(60), datos: { days: dias(2) } },
  { id: "r-dora", alumno_id: "dora", nombre: "D", created_at: iso(60), datos: { days: dias(1) } },
];
const ses = (aid, rid, n, dia) => ({ alumno_id: aid, rutina_id: rid, rutina_nombre: "", fecha: dmy(n), created_at: iso(n), semana: 1, dia_idx: dia });
const sesiones = [ses("beto", "r-beto", 15, 0), ses("dora", "r-dora", 0, 0)];
const catFn = X.selectCoachStudentListState({
  alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinas, sesionesGlobalesLimpias: sesiones, progresoGlobalLimpio: {},
  coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
}).coachAlumnoCategoria;

function espias() {
  const calls = [];
  const spy = (name) => function () { calls.push([name].concat([].slice.call(arguments))); };
  const names = ["onEnviarMensaje", "onCrearRutina", "onRevisarAlumnos", "onVerInactivos", "onVerSinRutina", "onVerBajaActividad", "onAsignarRutina", "onRevisar", "onVerPerfil", "onAbrirChatAlumno", "onIrProgreso", "onNuevoAlumno", "onNuevaRutina", "onNuevoEjercicio"];
  const props = {};
  names.forEach((n) => { props[n] = spy(n); });
  return { calls, props };
}
function render(extra) {
  globalThis.__capt = {};
  const s = espias();
  renderToStaticMarkup(h(CoachDashboard, Object.assign({
    alumnos, sesionesGlobales: sesiones, progresoGlobal: {}, historiaCompleta: { sesiones: true, progreso: true },
    rutinasSBEntrenador: rutinas, getAlumnoCategoria: catFn, lang: "es",
  }, s.props, extra || {})));
  return { capt: globalThis.__capt, calls: s.calls };
}
const ev = { stopPropagation() {} };
const fila = (rows, id) => rows.find((r) => String(r.id) === id);

// ======================================================================= H10
await test("H10: la lista se titula «Mis alumnos» y contiene a TODOS (inactivos, sin rutina, baja actividad y al dia) con su estado", () => {
  const { capt } = render();
  const card = capt.CoachActiveStudentsCard;
  assert.equal(card.title, "Mis alumnos");
  assert.deepEqual(card.desktopRows.map((r) => r.id).sort(), ["ana", "beto", "cami", "dora"]);
  assert.deepEqual(card.mobileRows.map((r) => r.id).sort(), ["ana", "beto", "cami", "dora"]);
  const estado = (id) => fila(card.desktopRows, id).statusLabel;
  assert.deepEqual([estado("ana"), estado("beto"), estado("cami"), estado("dora")], ["Sin actividad", "Baja actividad", "Sin rutina", "Al día"]);
  assert.equal(fila(card.desktopRows, "dora").pctText, "100%", "adherencia de D3 intacta");
  assert.doesNotMatch(read("components/CoachDashboard.jsx"), /title=\{M\(lang, "Alumnos activos"/);
});

// ======================================================================= H11
await test("H11: «Perfil» y la fila abren la ficha del alumno seleccionado (escritorio y movil)", () => {
  const { capt, calls } = render();
  const card = capt.CoachActiveStudentsCard;
  fila(card.desktopRows, "beto").actions.find((a) => a.key === "profile").onClick(ev);
  fila(card.desktopRows, "dora").onClick();
  fila(card.mobileRows, "ana").onClick();
  assert.deepEqual(calls, [["onVerPerfil", "beto"], ["onVerPerfil", "dora"], ["onVerPerfil", "ana"]]);
});

await test("H11: «Asignar rutina» solo para alumnos SIN rutina y llama al flujo de asignacion con ese alumno; con rutina no se muestra", () => {
  const { capt, calls } = render();
  const rows = capt.CoachActiveStudentsCard.desktopRows;
  const tieneAsignar = (id) => fila(rows, id).actions.some((a) => a.key === "assign");
  assert.deepEqual(["ana", "beto", "cami", "dora"].map(tieneAsignar), [false, false, true, false]);
  const asignar = fila(rows, "cami").actions.find((a) => a.key === "assign");
  assert.equal(asignar.label, "Asignar rutina");
  asignar.onClick(ev);
  assert.deepEqual(calls, [["onAsignarRutina", "cami"]]);
  assert.ok(!rows.some((r) => r.actions.some((a) => a.label === "Asignar")), "sin la etiqueta ambigua «Asignar»");
});

await test("H11: sin handler de asignacion no se muestra un boton que no hace nada", () => {
  const { capt } = render({ onAsignarRutina: undefined });
  assert.ok(!capt.CoachActiveStudentsCard.desktopRows.some((r) => r.actions.some((a) => a.key === "assign")));
});

await test("«Mensaje» abre el chat del alumno correcto", () => {
  const { capt, calls } = render();
  fila(capt.CoachActiveStudentsCard.desktopRows, "ana").actions.find((a) => a.key === "message").onClick(ev);
  assert.deepEqual(calls, [["onAbrirChatAlumno", "ana"]]);
});

// ======================================================================= H12
await test("H12: Atencion hoy lleva a Alumnos con SU filtro (inactivos, sin rutina, baja actividad)", () => {
  const { capt, calls } = render();
  const items = capt.CoachDashboardAttentionCard.items;
  const item = (k) => items.find((i) => i.key === k);
  assert.deepEqual(items.map((i) => [i.key, i.count]), [["sin-rutina", 1], ["inactivos", 1], ["baja", 1]]);
  assert.equal(item("sin-rutina").cta, "Ver alumnos sin rutina");
  assert.equal(item("inactivos").cta, "Ver alumnos inactivos");
  assert.equal(item("baja").cta, "Ver alumnos con baja actividad");
  item("sin-rutina").onClick();
  item("inactivos").onClick();
  item("baja").onClick();
  assert.deepEqual(calls, [["onVerSinRutina"], ["onVerInactivos"], ["onVerBajaActividad"]]);
  assert.ok(!calls.some((c) => c[0] === "onCrearRutina" || c[0] === "onEnviarMensaje"), "ya no va a Rutinas ni usa el CTA de mensajes");
});

await test("H12: la recomendacion principal usa el mismo destino que su contador (sin rutina > inactivos > baja > todos)", () => {
  let r = render();
  r.capt.CoachDashboardSummaryGrid.recommendationProps.onAction();
  assert.equal(r.capt.CoachDashboardSummaryGrid.recommendationProps.ctaLabel, "Ver alumnos sin rutina");
  assert.deepEqual(r.calls, [["onVerSinRutina"]]);
  r = render({ alumnos: alumnos.filter((a) => a.id !== "cami") });
  r.capt.CoachDashboardSummaryGrid.recommendationProps.onAction();
  assert.deepEqual(r.calls, [["onVerInactivos"]]);
  r = render({ alumnos: alumnos.filter((a) => a.id === "beto" || a.id === "dora") });
  assert.equal(r.capt.CoachDashboardSummaryGrid.recommendationProps.ctaLabel, "Ver alumnos con baja actividad");
  r.capt.CoachDashboardSummaryGrid.recommendationProps.onAction();
  assert.deepEqual(r.calls, [["onVerBajaActividad"]]);
  r = render({ alumnos: alumnos.filter((a) => a.id === "dora") });
  r.capt.CoachDashboardSummaryGrid.recommendationProps.onAction();
  assert.deepEqual(r.calls, [["onRevisarAlumnos"]]);
});

await test("H12: «Ver equipo» y «Ver todos →» van a la lista completa (onRevisarAlumnos)", () => {
  const { capt, calls } = render();
  capt.CoachDashboardSummaryGrid.desktopWeeklyProps.onSecondary();
  capt.CoachActiveStudentsCard.onSeeAll();
  assert.deepEqual(calls, [["onRevisarAlumnos"], ["onRevisarAlumnos"]]);
});

await test("H12: el filtro «Baja actividad» usa la regla de D3: mismos alumnos que el contador y los estados del Dashboard", () => {
  const { capt } = render();
  const ids = X.bajaActividadIds({ alumnos, catFn, rutinas, sesiones });
  assert.deepEqual(Object.keys(ids), ["beto"]);
  const conEstado = capt.CoachActiveStudentsCard.desktopRows.filter((r) => r.statusLabel === "Baja actividad").map((r) => String(r.id));
  assert.deepEqual(conEstado, Object.keys(ids));
  assert.equal(capt.CoachDashboardAttentionCard.items.find((i) => i.key === "baja").count, Object.keys(ids).length);
  assert.ok(!ids.ana, "inactivo (21 dias) no es baja actividad");
});

// ======================================================================= cableado: App.jsx y pasos intermedios
const app = read("App.jsx");
const nav = await import(pathToFileURL(path.join(ROOT, "components/coach/coachDashboardNav.js")).href);
function navEspia(alumnosLista) {
  const log = [];
  const set = (k) => (v) => log.push([k, v]);
  const n = nav.crearNavegacionDashboard({
    setTab: set("tab"), setCoachAlumnosSearch: set("search"), setCoachAlumnosFilter: set("filter"),
    setAlumnoActivo: (a) => log.push(["alumnoActivo", a && a.id]), setCoachDashIntent: set("intent"),
    getAlumnos: () => alumnosLista, cargarFicha: async (a, label) => log.push(["cargarFicha", a.id, label]),
  });
  return { n, log, ultimo: (k) => [...log].reverse().find((x) => x[0] === k) };
}

await test("navegacion (coachDashboardNav, usada por App y la demo): cada destino fija SU filtro y limpia busqueda, ficha abierta y pedidos", () => {
  for (const [fn, filtro] of [["verTodos", "todos"], ["verInactivos", "inactivos"], ["verSinRutina", "sin_rutina"], ["verBajaActividad", "baja"]]) {
    const { n, log } = navEspia(alumnos);
    n[fn]();
    assert.deepEqual(log, [["search", ""], ["filter", filtro], ["alumnoActivo", null], ["intent", null], ["tab", "alumnos"]], fn);
  }
});

await test("navegacion: Perfil / Asignar abren ESE alumno con filtro Todos, sin busqueda, con el pedido y cargando su ficha", async () => {
  let e = navEspia(alumnos);
  await e.n.verPerfil("beto");
  assert.deepEqual(e.log.slice(0, 5), [["search", ""], ["filter", "todos"], ["intent", { alumnoId: "beto", accion: "perfil" }], ["alumnoActivo", "beto"], ["tab", "alumnos"]]);
  assert.deepEqual(e.ultimo("cargarFicha"), ["cargarFicha", "beto", "[CoachDashboard onVerPerfil]"]);
  e = navEspia(alumnos);
  await e.n.asignarRutina("cami");
  assert.deepEqual(e.ultimo("intent"), ["intent", { alumnoId: "cami", accion: "asignar" }]);
  e = navEspia(alumnos);
  await e.n.verPerfil("nadie");
  assert.deepEqual(e.log, [], "id inexistente: no navega");
});

await test("vistaAlumnosConBaja: agrega el contador «baja» y acota la lista solo con ese filtro", () => {
  const lista = alumnos;
  const ids = { beto: true };
  assert.deepEqual(nav.vistaAlumnosConBaja({ counts: { todos: 4 }, lista, filtro: "todos", bajaIds: ids }), { counts: { todos: 4, baja: 1 }, lista });
  assert.deepEqual(nav.vistaAlumnosConBaja({ counts: { todos: 4 }, lista, filtro: "baja", bajaIds: ids }).lista.map((a) => a.id), ["beto"]);
});

await test("App usa la navegacion compartida (no una propia) e inyecta la carga de la ficha de siempre", () => {
  assert.match(app, /const coachDashboardNav = crearNavegacionDashboard\(\{[\s\S]*?getAlumnos: function \(\) \{ return alumnosActivosLimpios; \},[\s\S]*?sb\.getRutinas\(alum\.id\), sb\.getProgreso\(alum\.id\), sb\.getSesiones\(alum\.id\)/);
  for (const [h, f] of [["RevisarAlumnos", "verTodos"], ["VerInactivos", "verInactivos"], ["VerSinRutina", "verSinRutina"], ["VerBajaActividad", "verBajaActividad"], ["VerPerfil", "verPerfil"], ["AsignarRutina", "asignarRutina"], ["Revisar", "revisar"]]) {
    assert.match(app, new RegExp("const handleCoachDashboard" + h + " = coachDashboardNav\\." + f + ";"), h);
  }
  assert.match(app, /vistaAlumnosConBaja\(\{ counts: coachAlumnosCounts, lista: coachAlumnosListaFiltrada, filtro: coachAlumnosFilter, bajaIds: coachBajaActividadIds \}\)/);
});

await test("App: dashboardProps conecta los handlers nuevos; Alumnos recibe la lista y los contadores con «Baja actividad»", () => {
  const dash = app.match(/dashboardProps:\s*\{([\s\S]*?)\n\s{6}\},/)[1];
  for (const k of ["onVerInactivos: handleCoachDashboardVerInactivos", "onVerSinRutina: handleCoachDashboardVerSinRutina", "onVerBajaActividad: handleCoachDashboardVerBajaActividad", "onAsignarRutina: handleCoachDashboardAsignarRutina", "onRevisarAlumnos: handleCoachDashboardRevisarAlumnos", "onAbrirChatAlumno: handleCoachDashboardAbrirChatAlumno"]) assert.ok(dash.includes(k), k);
  const stu = app.match(/studentsProps:\s*\{([\s\S]*?)\n\s{6}\},/)[1];
  for (const k of ["coachAlumnosCounts: coachAlumnosCountsVista", "coachAlumnosListaFiltrada: coachAlumnosListaVista", "coachDashIntent: coachDashIntent", "setCoachDashIntent: setCoachDashIntent"]) assert.ok(stu.includes(k), k);
  assert.match(app, /bajaActividadIds\(\{ alumnos: alumnosActivosLimpios, catFn: coachAlumnoCategoria, rutinas: rutinasUnificadas, sesiones: sesionesGlobalesLimpias \}\)/);
});

await test("pasos intermedios: CoachDashboardMain y CoachStudentsMain reenvian todos los props nuevos (sin repetir D1)", () => {
  const main = read("components/coach/CoachDashboardMain.jsx");
  for (const k of ["onVerInactivos", "onVerSinRutina", "onVerBajaActividad", "onAsignarRutina"]) assert.match(main, new RegExp(k + "=\\{" + k + "\\}"), k);
  const stuMain = read("components/coach/CoachStudentsMain.jsx");
  for (const k of ["coachDashIntent", "setCoachDashIntent"]) assert.match(stuMain, new RegExp(k + "=\\{" + k + "\\}"), k);
  // generico: lo que App manda en studentsProps y StudentsSection usa, CoachStudentsMain lo reenvia
  const enviados = [...app.match(/studentsProps:\s*\{([\s\S]*?)\n\s{6}\},/)[1].matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
  const ss = read("components/students/StudentsSection.jsx");
  const usados = enviados.filter((k) => new RegExp("\\b" + k + "\\b").test(ss.slice(0, ss.indexOf("} = props;"))));
  const perdidos = usados.filter((k) => !new RegExp("\\b" + k + "=\\{" + k + "\\}").test(stuMain));
  assert.deepEqual(perdidos, []);
});

await test("Alumnos: chip «Baja actividad» compatible con los existentes y pedido del Dashboard con el flujo EXISTENTE de asignacion", () => {
  const ss = read("components/students/StudentsSection.jsx");
  assert.match(ss, /\{ k: "sin_rutina", es: "Sin rutina"[\s\S]*?\{ k: "baja", es: "Baja actividad", en: "Low activity", n: coachAlumnosCounts\.baja \|\| 0 \}/);
  assert.match(ss, /onAssignRoutine=\{function \(\) \{ abrirAsignacionRutina\(a\); \}\}/, "el boton de la ficha y el pedido usan la misma funcion");
  assert.match(ss, /setCoachDialog\(\{ t: 'assignRut', a: a, ex: ex0 \|\| null, rutinaLocal: rutinaParaAsignar, assignMsg: assignMsg0 \}\)/, "mismo dialogo de siempre");
  assert.match(ss, /if \(accion === "asignar" && !assignedRoutineFor\(alumnoActivo\.id\)\) abrirAsignacionRutina\(alumnoActivo\);/);
  assert.match(ss, /if \(String\(alumnoActivo\.id\) !== String\(coachDashIntent\.alumnoId\)\) return;/, "solo para el alumno pedido");
  assert.match(read("components/students/StudentCard.jsx"), /data-alumno-id=\{alumno && alumno\.id != null \? String\(alumno\.id\) : undefined\}/);
});

console.log("\n" + count + " pruebas OK");
