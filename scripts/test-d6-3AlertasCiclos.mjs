// D6.3 — la alerta «Le queda 1 sesión» distingue el CICLO de la rutina (como «Rutina terminada» desde D6.1).
//
//   node scripts/test-d6-3AlertasCiclos.mjs
//
// Renderiza (SSR) el CoachDashboard real y captura las alertas que pasa a la campana (mismo arnes que test-d6-2CoherenciaAlertas.mjs).
// Ciclo 1 conserva la clave anterior (lecturas historicas validas); ciclo n > 1 agrega "-c<n>". Datos ficticios; sin red.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d63-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react"; import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard from "./components/CoachDashboard.jsx";' +
      'import * as Campana from "./components/CoachNotificationCenter.jsx";' +
      'import * as Ep from "./components/coach/alertasEpisodio.js";' +
      'import * as Prio from "./components/coach/alertasPrioridad.js";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      'import { getActiveStudentRoutinePosition } from "./lib/studentWeeklyProgress.js";' +
      'import { diaLocal } from "./lib/metricas/index.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, Campana, Ep, Prio, selectCoachStudentListState, getActiveStudentRoutinePosition, diaLocal };",
    resolveDir: ROOT, sourcefile: "d63-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  plugins: [{
    name: "capturar-campana",
    setup(b) {
      b.onResolve({ filter: /CoachNotificationCenter\.jsx$/ }, (args) =>
        /CoachDashboard\.jsx$/.test(args.importer) ? { path: "capturador-campana", namespace: "d63" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "d63" }, () => ({
        loader: "js",
        contents: "export default function CampanaCapturada(props) { globalThis.__alertas = props.alertRows; return null; }",
      }));
    },
  }],
});
const X = await import(pathToFileURL(outfile).href);
const { React, renderToStaticMarkup, CoachDashboard, Campana, Ep, Prio } = X;
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- datos ficticios: alumno "a", rutina "r" de 2 dias, sesiones hoy ----
const HOY = X.diaLocal();
const fechaDe = (dia) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (HOY - dia)); return d; };
const dmy = (dia) => { const d = fechaDe(dia); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
let nses = 0;
const ses = (diaIdx, semana, extra) => Object.assign({ id: "s-" + ++nses, alumno_id: "a", rutina_id: "r", rutina_nombre: "",
  fecha: dmy(HOY), created_at: fechaDe(HOY).toISOString(), semana, dia_idx: diaIdx }, extra || {});
const rut = (datos, nDias = 2) => ({ id: "r", alumno_id: "a", nombre: "R", created_at: fechaDe(HOY - 140).toISOString(),
  datos: Object.assign({ days: Array.from({ length: nDias }, () => ({ exercises: [{ id: "sq" }] })) }, datos || {}) });
const ALUMNO = { id: "a", nombre: "Alumno" };

function catDe(rutinas, sesiones) {
  return X.selectCoachStudentListState({
    alumnosActivosLimpios: [ALUMNO], rutinasUnificadas: rutinas, sesionesGlobalesLimpias: sesiones, progresoGlobalLimpio: {},
    coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
  }).coachAlumnoCategoria;
}
function alertas(rutina, sesiones) {
  globalThis.__alertas = null;
  renderToStaticMarkup(h(CoachDashboard, {
    alumnos: [ALUMNO], alumnosStatus: "ready", sesionesGlobales: sesiones, progresoGlobal: {},
    historiaCompleta: { sesiones: true, progreso: true }, rutinasSBEntrenador: [rutina],
    getAlumnoCategoria: catDe([rutina], sesiones), lang: "es", mensajesEntrenadorPendientes: [],
  }));
  return globalThis.__alertas || [];
}
const falta = (rows) => rows.filter((r) => r.key.startsWith("rutina-falta-1-"));
const termina = (rows) => rows.filter((r) => r.key.startsWith("rutina-terminada-"));
function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const EID = "33333333-3333-4333-8333-333333333333";
const KEY1 = "rutina-falta-1-a-r-w0";

// ---- escenarios ----
const C1 = { rutina: rut({ semana_activa: 1 }), sesiones: [ses(0, 1)] };
const C2 = { rutina: rut({ semana_activa: 1, ciclo_actual: 2, ciclo_base: 2 }), sesiones: [ses(0, 1), ses(0, 1, { ciclo: 2 })] };
// ciclo 1 y ciclo 2 con la misma semana: la sesion del ciclo 1 sigue en el historial
const SEM_C1 = { rutina: rut({ semana_activa: 3 }), sesiones: [ses(0, 3)] };
const SEM_C2 = {
  rutina: rut({ semana_activa: 3, ciclo_actual: 2, ciclo_base: 1, ciclos_meta: [{ ciclo: 2, tipo: "semana", semana_inicio: 3, desde_ciclo: 1 }] }),
  sesiones: [ses(0, 3), ses(0, 3, { ciclo: 2 })],
};

await test("a. ciclo 1: la clave es la anterior y una lectura historica sigue leida", () => {
  assert.equal(Ep.claveFaltaUna("a", "r", rut({ semana_activa: 1 }), 0), KEY1);
  assert.equal(Ep.claveFaltaUna("a", "r", rut({ ciclo_actual: 1 }), 0), KEY1);
  assert.equal(Ep.claveFaltaUna("a", "r", null, 2), "rutina-falta-1-a-r-w2");
  assert.equal(Ep.claveFaltaUna("a", "r", { datos: { ciclo_actual: "x" } }, 0), KEY1, "ciclo invalido => 1");
  const rows = alertas(C1.rutina, C1.sesiones);
  assert.deepEqual(falta(rows).map((r) => r.key), [KEY1]);
  globalThis.localStorage = memoria();
  const key = Campana.buildReadStorageKey(EID);
  Campana.saveReadIds(key, ["real-" + KEY1]);
  const leidas = Campana.loadReadIds(key);
  assert.deepEqual(leidas, ["real-" + KEY1]);
  const notifs = Campana.mapAlertsToNotifications(rows);
  assert.equal(Prio.contarNoLeidas(notifs, leidas), notifs.length - 1, "la historica sigue valiendo");
});

await test("b. reinicio de rutina (ciclo 2): clave -c2-w0, distinta, y aparece NO leida aunque la del ciclo 1 este leida", () => {
  const rows = alertas(C2.rutina, C2.sesiones);
  const f = falta(rows);
  assert.deepEqual(f.map((r) => r.key), ["rutina-falta-1-a-r-c2-w0"]);
  assert.notEqual(f[0].key, KEY1);
  assert.equal(Ep.claveFaltaUna("a", "r", C2.rutina, 0), "rutina-falta-1-a-r-c2-w0");
  globalThis.localStorage = memoria();
  const key = Campana.buildReadStorageKey(EID);
  Campana.saveReadIds(key, ["real-" + KEY1]);
  const leidas = Campana.loadReadIds(key);
  const notifs = Campana.mapAlertsToNotifications(rows);
  assert.equal(Prio.contarNoLeidas(notifs, leidas), notifs.length, "el aviso del ciclo 2 no esta leido");
});

await test("c. reinicio de semana (ciclo 2, semana 3): clave -c2-w2, distinta de la del ciclo 1 semana 3", () => {
  const k1 = falta(alertas(SEM_C1.rutina, SEM_C1.sesiones)).map((r) => r.key);
  const k2 = falta(alertas(SEM_C2.rutina, SEM_C2.sesiones)).map((r) => r.key);
  assert.deepEqual(k1, ["rutina-falta-1-a-r-w2"]);
  assert.deepEqual(k2, ["rutina-falta-1-a-r-c2-w2"]);
  assert.notEqual(k1[0], k2[0]);
});

await test("d. las sesiones del ciclo anterior no cuentan: ciclo 2 recien reiniciado no avisa ni da terminada", () => {
  const rutina = rut({ semana_activa: 1, ciclo_actual: 2, ciclo_base: 2 });
  const viejas = [ses(0, 4), ses(1, 4)]; // ciclo 1 con la semana 4 completa
  const rows = alertas(rutina, viejas);
  assert.equal(falta(rows).length, 0);
  assert.equal(termina(rows).length, 0);
  // y con el ciclo 1 vigente esas mismas sesiones si dan terminada (la prueba no es vacia)
  assert.equal(termina(alertas(rut({ semana_activa: 4 }), viejas)).length, 1);
});

await test("e. ultima semana: semana 4 completa => terminada (-c1); con 1 dia faltante => falta 1; semana 3 completa => no terminada", () => {
  const t = alertas(rut({ semana_activa: 4 }), [ses(0, 4), ses(1, 4)]);
  assert.deepEqual(termina(t).map((r) => r.key), ["rutina-terminada-a-r-c1"]);
  assert.equal(falta(t).length, 0);
  const f = alertas(rut({ semana_activa: 4 }), [ses(0, 4)]);
  assert.equal(termina(f).length, 0);
  assert.deepEqual(falta(f).map((r) => r.key), ["rutina-falta-1-a-r-w3"]);
  const s3 = alertas(rut({ semana_activa: 3 }), [ses(0, 3), ses(1, 3)]);
  assert.equal(termina(s3).length, 0);
  assert.equal(falta(s3).length, 0);
});

await test("f. rutina terminada por ciclo: ciclo 2 => -c2, distinta de -c1", () => {
  const c1 = termina(alertas(rut({ semana_activa: 4 }), [ses(0, 4), ses(1, 4)])).map((r) => r.key);
  const c2 = termina(alertas(rut({ semana_activa: 4, ciclo_actual: 2, ciclo_base: 2 }), [ses(0, 4, { ciclo: 2 }), ses(1, 4, { ciclo: 2 })])).map((r) => r.key);
  assert.deepEqual(c1, ["rutina-terminada-a-r-c1"]);
  assert.deepEqual(c2, ["rutina-terminada-a-r-c2"]);
});

await test("g. estabilidad: misma entrada, misma clave; no depende de la fecha de render", () => {
  const k = (rows) => rows.map((r) => r.key);
  assert.deepEqual(k(alertas(C2.rutina, C2.sesiones)), k(alertas(C2.rutina, C2.sesiones)));
  assert.equal(Ep.claveFaltaUna("a", "r", C2.rutina, 0), Ep.claveFaltaUna("a", "r", C2.rutina, 0));
  assert.doesNotMatch(read("components/coach/alertasEpisodio.js"), /Math\.random|Date\.now|new Date\(\)/);
});

await test("h. coherencia con «Mis alumnos»: la posicion (getActiveStudentRoutinePosition) coincide con la condicion de cada alerta", () => {
  const pos = (e) => X.getActiveStudentRoutinePosition({ alumno: ALUMNO, rutina: e.rutina, sesiones: e.sesiones, progreso: {} });
  const casos = [
    { n: "ciclo 1", e: C1, falta: true },
    { n: "ciclo 2", e: C2, falta: true },
    { n: "semana c1", e: SEM_C1, falta: true },
    { n: "semana c2", e: SEM_C2, falta: true },
    { n: "ciclo 2 recien reiniciado", e: { rutina: rut({ semana_activa: 1, ciclo_actual: 2, ciclo_base: 2 }), sesiones: [ses(0, 4), ses(1, 4)] }, falta: false },
    { n: "semana 4 falta 1", e: { rutina: rut({ semana_activa: 4 }), sesiones: [ses(0, 4)] }, falta: true },
  ];
  for (const c of casos) {
    const p = pos(c.e);
    const rows = alertas(c.e.rutina, c.e.sesiones);
    const hayFalta = falta(rows).length > 0;
    assert.equal(hayFalta, p.completedDaysInWeek === p.totalDaysInWeek - 1 && p.completedDaysInWeek > 0, c.n + " falta-1");
    assert.equal(hayFalta, c.falta, c.n);
    if (hayFalta) assert.equal(falta(rows)[0].key.endsWith("-w" + p.weekIndex), true, c.n + " semana de la clave");
    assert.equal(termina(rows).length > 0, p.weekIndex === 3 && p.completedDaysInWeek === p.totalDaysInWeek && p.completedDaysInWeek > 0, c.n + " terminada");
  }
  const t = pos({ rutina: rut({ semana_activa: 4 }), sesiones: [ses(0, 4), ses(1, 4)] });
  assert.equal(t.weekIndex, 3);
  assert.equal(t.completedDaysInWeek, t.totalDaysInWeek);
  assert.equal(termina(alertas(rut({ semana_activa: 4 }), [ses(0, 4), ses(1, 4)])).length, 1);
});

await test("i. D6.1/D6.2 intactas y CoachDashboard ya no arma la clave a mano", () => {
  assert.equal(Ep.claveInactivo("a", 20700), "in-a-d20700");
  assert.equal(Ep.claveInactivo("a", null), "in-a-dnunca");
  assert.equal(Ep.claveBajaActividad("a", 20679), "wk-a-s20679");
  assert.equal(Ep.claveBajaActividad("a", null), "wk-a-snd");
  assert.equal(Ep.claveSinRutina("a"), "sr-a");
  assert.equal(Ep.claveRutinaTerminada("a", "r", { datos: { ciclo_actual: 3 } }), "rutina-terminada-a-r-c3");
  assert.equal(Ep.claveRutinaTerminada("a", "r", null), "rutina-terminada-a-r-c1");
  const dash = read("components/CoachDashboard.jsx");
  assert.doesNotMatch(dash, /"rutina-falta-1-"/);
  assert.match(dash, /key: claveFaltaUna\(a\.id, rutinaId, rutina, weekly\.weekIndex\),/);
  assert.match(read("components/coach/alertasEpisodio.js"), /Le queda 1 sesion "rutina-falta-1-<alumnoId>-<rutinaId>-w<semana0>"/);
});

// ======================================================================= regresion: «Rutina terminada» de Pia (iPhone, PR #147)
// La alerta existia pero no tenia fecha (atMs): quedaba ultima en la campana, debajo de todos los entrenamientos, y en iOS Safari el
// panel (70vh) terminaba debajo de la barra del navegador, asi que no se podia llegar a verla.
await test("j. regresion Pia: «Rutina terminada» lleva la fecha de la ultima sesion y queda junto a sus entrenamientos, no al final", async () => {
  const ayer = ses(0, 4, { fecha: dmy(HOY - 1), created_at: fechaDe(HOY - 1).toISOString() });
  const hoy = ses(1, 4);
  const rows = alertas(rut({ semana_activa: 4 }), [ayer, hoy]);
  const t = termina(rows);
  assert.equal(t.length, 1);
  assert.equal(t[0].atMs, new Date(hoy.created_at).getTime(), "fecha de la ultima sesion de la semana (dato guardado)");
  assert.equal(t[0].key, "rutina-terminada-a-r-c1", "la clave no cambia");
  const orden = Prio.ordenarNotificaciones(Campana.mapAlertsToNotifications(rows), []);
  const iT = orden.findIndex((x) => x.id === "real-" + t[0].key);
  const iAyer = orden.findIndex((x) => x.tipo === "workout_completed" && x.atMs === new Date(ayer.created_at).getTime());
  assert.ok(iT >= 0 && iT < iAyer, "antes del entrenamiento de ayer (" + iT + " / " + iAyer + ")");
  // el escenario EXACTO de la demo (?alertas=muchas): la alerta de Pia aparece y ya no es la ultima, debajo de entrenamientos de hace dias
  const d = await import(pathToFileURL(path.join(ROOT, "components/demo/dashboardCoachDemoData.js")).href);
  const alumnos = d.DEMO_DASH_ALUMNOS.concat(d.DEMO_DASH_ALUMNOS_EXTRA);
  const rutinas = d.demoDashRutinas().concat(d.demoDashRutinasExtra());
  const sesiones = d.demoDashSesiones().concat(d.demoDashSesionesExtra());
  const catFn = X.selectCoachStudentListState({ alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinas, sesionesGlobalesLimpias: sesiones,
    progresoGlobalLimpio: {}, coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now() }).coachAlumnoCategoria;
  globalThis.__alertas = null;
  renderToStaticMarkup(h(CoachDashboard, { alumnos, alumnosStatus: "ready", sesionesGlobales: sesiones, progresoGlobal: {},
    historiaCompleta: { sesiones: true, progreso: true }, rutinasSBEntrenador: rutinas, getAlumnoCategoria: catFn, lang: "es", mensajesEntrenadorPendientes: [] }));
  const demo = Prio.ordenarNotificaciones(Campana.mapAlertsToNotifications(globalThis.__alertas || []), []);
  const iPia = demo.findIndex((x) => x.id.startsWith("real-rutina-terminada-demo-pia-"));
  assert.ok(iPia >= 0, "la demo genera «Rutina terminada» para Pia");
  assert.ok(iPia < demo.length - 1, "ya no es la ultima de la lista");
  const masViejo = demo.findIndex((x, i) => i > iPia && x.tipo === "workout_completed");
  assert.ok(masViejo > iPia, "queda antes de entrenamientos mas viejos");
});

await test("k. regresion iPhone: el panel movil se limita al alto VISIBLE (dvh y areas seguras), no a 70vh", () => {
  const camp = read("components/CoachNotificationCenter.jsx");
  assert.match(camp, /maxHeight: "min\(70dvh, calc\(100dvh - 140px - env\(safe-area-inset-top, 0px\) - env\(safe-area-inset-bottom, 0px\)\)\)"/);
  assert.match(camp, /top: "calc\(8px \+ env\(safe-area-inset-top, 0px\) \+ 120px\)"/, "140px = top (128) + margen inferior (12)");
  assert.doesNotMatch(camp, /maxHeight: "70vh"/);
});

console.log("\n" + count + " pruebas OK");
