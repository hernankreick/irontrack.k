// D4 — navegacion, botones y filtros del Dashboard del entrenador (hallazgos H10, H11 y H12 de la auditoria D0).
//
//   node scripts/test-d4NavegacionDashboard.mjs
//
// 1) SSR del CoachDashboard real con el Dashboard D5 "capturado" (plugin de esbuild que registra los props que CoachDashboard le pasa y
//    delega en el componente real): se obtienen los props reales, se expande el arbol de D5 (scripts/qa/arbolReact.mjs) y se ejecutan los
//    onClick de sus controles (Requieren seguimiento, Actividad reciente, Acciones rapidas) con handlers espia.
// 2) Cableado estatico: App.jsx (handlers que fijan el filtro y limpian lo heredado), CoachDashboardMain / CoachStudentsMain (no pierden
//    props) y StudentsSection (chip «Baja actividad» y pedido del Dashboard con el flujo existente de asignacion).
// La navegacion real (Dashboard <-> Alumnos, 375/390/430/1280 px) la verifica scripts/qa/dashboard-nav.mjs sobre la app compilada.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { expandir, porQa } from "./qa/arbolReact.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d4-")), "bundle.mjs");
const { build } = await import("esbuild");
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
    name: "capturar-d5",
    setup(b) {
      // Solo el import que hace CoachDashboard.jsx; el resto (la prueba y D5 mismo) usan el componente real.
      b.onResolve({ filter: /CoachDashboardD5\.jsx$/ }, (args) => (args.importer.endsWith("CoachDashboard.jsx") ? { path: "d5-captura", namespace: "captura" } : null));
      b.onLoad({ filter: /.*/, namespace: "captura" }, () => ({
        loader: "js", resolveDir: ROOT,
        contents: "import Real from " + JSON.stringify(path.join(ROOT, "components/coach/CoachDashboardD5.jsx")) + "; export default function Captura(p) { var t = Real(p); globalThis.__capt = { props: p, arbol: t }; return t; }",
      }));
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
  const capt = globalThis.__capt;
  const qa = porQa(expandir(capt.arbol));
  return { capt, calls: s.calls, qa, get: (k) => qa.find((n) => n.qa === k), todos: (k) => qa.filter((n) => n.qa === k) };
}

// ======================================================================= H10 (D5: la lista «Mis alumnos» se reemplazo por Seguimiento + Actividad reciente)
await test("H10: cada estado queda visible con su alumno (inactivo, sin rutina, baja actividad en Seguimiento; al dia en Actividad reciente)", () => {
  const r = render();
  assert.equal(r.get("d5-grupo-inactivos").texto, "Inactivos Más de 21 días · Ana 1");
  assert.equal(r.get("d5-grupo-baja").texto, "Baja actividad Beto 1");
  assert.equal(r.get("d5-grupo-sin_rutina").texto, "Sin rutina Cami 1");
  assert.deepEqual(r.todos("d5-reciente").map((f) => f.props["data-alumno-id"]), ["dora"]);
  assert.match(r.get("d5-reciente").texto, /Dora Hoy · 100% esta semana Al día/, "adherencia de D3 intacta");
  const src = read("components/CoachDashboard.jsx");
  assert.doesNotMatch(src, /title=\{M\(lang, "Alumnos activos"/);
  assert.doesNotMatch(src, /CoachActiveStudentsCard/, "la tabla «Mis alumnos» ya no esta en el Dashboard");
});

// ======================================================================= H11
await test("H11: la fila de «Actividad reciente» abre la ficha del alumno seleccionado", () => {
  const r = render();
  r.get("d5-reciente").props.onClick();
  assert.deepEqual(r.calls, [["onVerPerfil", "dora"]]);
  assert.equal(typeof r.capt.props.onVerPerfil, "function", "D5 recibe onVerPerfil de App");
});

await test("H11 (decision D5): el Dashboard ya no tiene «Asignar rutina» por fila; se asigna desde Seguimiento «Sin rutina» -> Alumnos filtrado -> ficha", () => {
  const r = render();
  assert.ok(!r.qa.some((n) => /Asignar/.test(n.texto)), "ningun control «Asignar» en el Dashboard");
  r.get("d5-grupo-sin_rutina").props.onClick();
  assert.deepEqual(r.calls, [["onVerSinRutina"]]);
  assert.equal(r.capt.props.onAsignarRutina, undefined, "D5 no usa onAsignarRutina");
  // CoachDashboard conserva el prop en su firma (App.jsx lo sigue pasando); el flujo existente de asignacion esta cubierto al final de este archivo
  assert.match(read("components/CoachDashboard.jsx"), /\n\s+onAsignarRutina,\n/);
});

await test("«Mensaje»: el chat de un alumno se abre desde la campana real (onAbrirChatAlumno) y desde Mensajes; no desde el Dashboard", () => {
  const r = render();
  const campana = r.capt.props.campana;
  assert.equal(typeof campana.props.onAbrirChatAlumno, "function");
  campana.props.onAbrirChatAlumno("ana");
  assert.deepEqual(r.calls, [["onAbrirChatAlumno", "ana"]]);
  assert.ok(!r.qa.some((n) => /Contactar|Mensaje/.test(n.texto)));
});

// ======================================================================= H12
await test("H12: Requieren seguimiento lleva a Alumnos con SU filtro (sin sesion/rutina -> inactivos, sin rutina, baja actividad)", () => {
  const r = render();
  assert.deepEqual(["d5-grupo-sin_rutina", "d5-grupo-inactivos", "d5-grupo-baja"].map((k) => r.get(k).texto.match(/(\d+)$/)[1]), ["1", "1", "1"]);
  r.get("d5-grupo-sin_rutina").props.onClick();
  r.get("d5-grupo-inactivos").props.onClick();
  r.get("d5-grupo-baja").props.onClick();
  assert.deepEqual(r.calls, [["onVerSinRutina"], ["onVerInactivos"], ["onVerBajaActividad"]]);
  assert.ok(!r.calls.some((c) => c[0] === "onNuevaRutina" || c[0] === "onEnviarMensaje" || c[0] === "onCrearRutina"), "ya no va a Rutinas ni usa el CTA de mensajes");
});

await test("H12: cada fila usa el mismo destino que su contador; sin handler especifico, la lista completa; sin casos no hay filas", () => {
  let r = render({ alumnos: alumnos.filter((a) => a.id !== "cami") });
  assert.equal(r.todos("d5-grupo-sin_rutina").length, 0);
  r.get("d5-grupo-inactivos").props.onClick();
  assert.deepEqual(r.calls, [["onVerInactivos"]]);
  r = render({ alumnos: alumnos.filter((a) => a.id === "beto" || a.id === "dora") });
  assert.equal(r.todos("d5-grupo-inactivos").length, 0);
  r.get("d5-grupo-baja").props.onClick();
  assert.deepEqual(r.calls, [["onVerBajaActividad"]]);
  r = render({ alumnos: alumnos.filter((a) => a.id === "dora") });
  assert.equal(r.qa.filter((n) => /^d5-grupo-/.test(n.qa)).length, 0);
  assert.match(r.get("d5-todo-al-dia").texto, /Nadie requiere seguimiento esta semana\./);
  r = render({ onVerSinRutina: undefined, onVerInactivos: undefined, onVerBajaActividad: undefined });
  ["d5-grupo-sin_rutina", "d5-grupo-inactivos", "d5-grupo-baja"].forEach((k) => r.get(k).props.onClick());
  assert.deepEqual(r.calls, [["onRevisarAlumnos"], ["onRevisarAlumnos"], ["onRevisarAlumnos"]]);
});

await test("H12: «Ver alumnos» (Actividad reciente y Acciones rapidas) va a la lista completa (onRevisarAlumnos)", () => {
  const { qa, calls, get } = render();
  get("d5-ver-alumnos").props.onClick();
  get("d5-accion-alumnos").props.onClick();
  assert.deepEqual(calls, [["onRevisarAlumnos"], ["onRevisarAlumnos"]]);
  assert.equal(qa.find((n) => n.qa === "d5-accion-alumnos").texto, "Ver alumnos");
});

await test("H12: el filtro «Baja actividad» usa la regla de D3: mismos alumnos que el contador y los estados del Dashboard", () => {
  const r = render();
  const ids = X.bajaActividadIds({ alumnos, catFn, rutinas, sesiones });
  assert.deepEqual(Object.keys(ids), ["beto"]);
  assert.deepEqual(r.capt.props.modelo.seguimiento.baja.map((a) => String(a.id)), Object.keys(ids));
  assert.equal(r.get("d5-grupo-baja").texto, "Baja actividad Beto " + Object.keys(ids).length);
  assert.equal(r.get("d5-stat-seguimiento").texto, "Seguimiento 3 requieren atención");
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
