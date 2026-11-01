// D6.4 — cierre de la campana: etiquetas de categoria coherentes con el Dashboard, areas tactiles de 44 px y contraste.
//
//   node scripts/test-d6-4CierreNotificaciones.mjs
//
// Mismo arnes SSR que test-d6-2CoherenciaAlertas.mjs. El contraste medido en el navegador y las lecturas viven en scripts/qa/campana-d64.mjs.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d64-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react"; import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard from "./components/CoachDashboard.jsx";' +
      'import * as Campana from "./components/CoachNotificationCenter.jsx";' +
      'import * as Prio from "./components/coach/alertasPrioridad.js";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      'import { diaLocal, lunesDe } from "./lib/metricas/index.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, Campana, Prio, selectCoachStudentListState, diaLocal, lunesDe };",
    resolveDir: ROOT, sourcefile: "d64-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  plugins: [{
    name: "capturar-campana",
    setup(b) {
      b.onResolve({ filter: /CoachNotificationCenter\.jsx$/ }, (args) =>
        /CoachDashboard\.jsx$/.test(args.importer) ? { path: "capturador-campana", namespace: "d64" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "d64" }, () => ({
        loader: "js",
        contents: "export default function CampanaCapturada(props) { globalThis.__alertas = props.alertRows; return null; }",
      }));
    },
  }],
});
const X = await import(pathToFileURL(outfile).href);
const { React, renderToStaticMarkup, CoachDashboard, Campana, Prio } = X;
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fechas: numeros de dia de lib/metricas relativos a hoy ----
const HOY = X.diaLocal();
const L = X.lunesDe(HOY); // lunes de esta semana
const fechaDe = (dia) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (HOY - dia)); return d; };
const dmy = (dia) => { const d = fechaDe(dia); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const dias = (n) => Array.from({ length: n }, () => ({ exercises: [{ id: "sq" }] }));
let nses = 0;
const ses = (aid, dia, diaIdx = 0, extra) => Object.assign({ id: "s-" + aid + "-" + ++nses, alumno_id: aid, rutina_id: "r-" + aid, rutina_nombre: "",
  fecha: dmy(dia), created_at: fechaDe(dia).toISOString(), semana: 1, dia_idx: diaIdx }, extra || {});
const rut = (aid, nDias, datos) => ({ id: "r-" + aid, alumno_id: aid, nombre: "R", created_at: fechaDe(L - 140).toISOString(),
  datos: Object.assign({ days: dias(nDias) }, datos || {}) });
const al = (id) => ({ id, nombre: id[0].toUpperCase() + id.slice(1) });

function catDe({ alumnos, rutinas, sesiones, progreso }) {
  return X.selectCoachStudentListState({
    alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinas, sesionesGlobalesLimpias: sesiones, progresoGlobalLimpio: progreso || {},
    coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
  });
}
function alertas({ alumnos, rutinas, sesiones, progreso, historiaCompleta, alumnosStatus, lang, mensajes }) {
  globalThis.__alertas = null;
  renderToStaticMarkup(h(CoachDashboard, {
    alumnos, alumnosStatus: alumnosStatus || "ready", sesionesGlobales: sesiones, progresoGlobal: progreso || {},
    historiaCompleta: historiaCompleta === undefined ? { sesiones: true, progreso: true } : historiaCompleta,
    rutinasSBEntrenador: rutinas, getAlumnoCategoria: catDe({ alumnos, rutinas, sesiones, progreso }).coachAlumnoCategoria, lang: lang || "es",
    mensajesEntrenadorPendientes: mensajes || [],
  }));
  return globalThis.__alertas || [];
}
const idsDe = (rows, prefijo) => rows.filter((r) => r.key.startsWith(prefijo)).map((r) => String(r.alumnoId)).sort();
function muchas() {
  // 8 con entrenamiento completado hoy (al dia), 6 inactivos, 3 sin rutina, 3 con baja actividad y un mensaje = 21 alertas
  const alumnos = [], rutinas = [], sesiones = [];
  for (let i = 0; i < 8; i++) { const id = "ok" + i; alumnos.push(al(id)); rutinas.push(rut(id, 1)); sesiones.push(ses(id, HOY), ses(id, L - 7)); }
  for (let i = 0; i < 6; i++) { const id = "in" + i; alumnos.push(al(id)); rutinas.push(rut(id, 3)); sesiones.push(ses(id, HOY - 30)); }
  for (let i = 0; i < 3; i++) alumnos.push(al("sr" + i));
  for (let i = 0; i < 3; i++) { const id = "wk" + i; alumnos.push(al(id)); rutinas.push(rut(id, 4)); sesiones.push(ses(id, L - 7), ses(id, L - 14)); }
  const mensajes = [{ id: "m1", alumno_id: "ok0", de_entrenador: false, leido: false, created_at: new Date().toISOString() }];
  return { alumnos, rutinas, sesiones, mensajes };
}

const etiqueta = (n) => ({ seguimiento: "Seguimiento", adherencia: "Adherencia", logro: "Logro", mensaje: "Mensaje" })[n.category];

await test("1. sin rutina / inactivo / baja actividad llevan categoria explicita; claves y severidad sin cambios", () => {
  const rows = alertas(muchas());
  const sr = rows.filter((r) => r.key.startsWith("sr-")), inn = rows.filter((r) => r.key.startsWith("in-")), wk = rows.filter((r) => r.key.startsWith("wk-"));
  assert.equal(sr.length, 3); assert.equal(inn.length, 6); assert.equal(wk.length, 3);
  assert.ok(sr.every((r) => r.category === "seguimiento" && r.severity === 0));
  assert.ok(inn.every((r) => r.category === "adherencia" && r.severity === 1));
  assert.ok(wk.every((r) => r.category === "adherencia" && r.severity === 2));
  assert.ok(sr.every((r) => r.key === "sr-" + r.alumnoId));
  assert.ok(inn.every((r) => /^in-in\d-/.test(r.key)) && wk.every((r) => /^wk-wk\d-/.test(r.key)));
  const n = Campana.mapAlertsToNotifications(rows);
  for (const x of n.filter((y) => y.id.startsWith("real-sr-"))) assert.equal(etiqueta(x), "Seguimiento");
  for (const x of n.filter((y) => /^real-(in|wk)-/.test(y.id))) assert.equal(etiqueta(x), "Adherencia");
  // la de «Le queda 1 sesión» y las de logro no cambian
  assert.ok(rows.filter((r) => r.tipo === "workout_completed").every((r) => r.category === "logro"));
});

await test("2. el orden y «Importantes» son identicos al anterior (solo cambia la categoria entre no-logros)", () => {
  const rows = alertas(muchas());
  const antes = rows.map((r) => (/^(sr|in|wk)-/.test(r.key) ? { ...r, category: undefined } : r)); // fallback anterior
  const nuevo = Prio.ordenarNotificaciones(Campana.mapAlertsToNotifications(rows), []);
  const viejo = Prio.ordenarNotificaciones(Campana.mapAlertsToNotifications(antes), []);
  assert.deepEqual(nuevo.map((x) => x.id), viejo.map((x) => x.id));
  assert.deepEqual(nuevo.map((x) => x.important), viejo.map((x) => x.important));
  assert.equal(nuevo.filter((x) => x.important).length, 13);
  assert.ok(nuevo.filter((x) => x.important).every((x) => x.category !== "logro"));
  assert.equal(Prio.requiereSeguimiento({ category: "adherencia" }), true);
});

await test("3. campana: minHeight 44 en «Marcar leídas» y en los filtros; colores locales de contraste", () => {
  const c = read("components/CoachNotificationCenter.jsx");
  assert.match(c, /gap: 4,\n\s*minHeight: 44,/, "Marcar leídas");
  assert.match(c, /minHeight: 44,\n\s*padding: "6px 8px"/, "filtros");
  assert.match(c, /\{ t2: "#94A3B8" \}/);
  assert.match(c, /color: active \? \(darkMode \? "#60A5FA" : "#1D4ED8"\) : C\.t2,/, "filtro activo");
  assert.match(c, /t2: "#475569", yel: "#B45309", green: "#15803d"/);
  const pal = read("components/coachThemePalette.js");
  assert.doesNotMatch(pal.slice(0, pal.indexOf("export function desktopSidebarTheme")), /94A3B8|B45309|15803d|475569/i, "coachThemePalette intacta");
});

await test("4. regresion: «Marcar como leída» y «Marcar leídas» guardan en el momento, no dentro del updater de setReadIds", () => {
  // Tocar una notificacion que navega desmonta la campana; un updater pendiente se descarta y la lectura se perdia (volvia como nueva).
  // La prueba en navegador esta en scripts/qa/campana-d64.mjs (bloque «navegar»).
  const c = read("components/CoachNotificationCenter.jsx");
  const markRead = c.slice(c.indexOf("function markRead(id) {"), c.indexOf("function markAllRead() {"));
  assert.match(markRead, /readIdsRef\.current = next;\s*persistReadIds\(next\);\s*setReadIds\(next\);/);
  assert.doesNotMatch(markRead, /setReadIds\(function/);
  const markAll = c.slice(c.indexOf("function markAllRead() {"), c.indexOf("function runAction(item) {"));
  assert.match(markAll, /unirLeidos\(readIdsRef\.current, allItems\.map[\s\S]*?persistReadIds\(next\);\s*setReadIds\(next\);/);
  assert.doesNotMatch(markAll, /setReadIds\(function/);
  assert.match(c, /var readIdsRef = React\.useRef\(readIds\);\s*readIdsRef\.current = readIds;/);
  // el merge con las lecturas remotas al montar incluye lo marcado mientras llegaba la respuesta
  assert.match(c, /var merged = mergeReadIds\(mergeReadIds\(localIds, readIdsRef\.current\), remoteIds\);/);
});

console.log(count + " pruebas D6.4 OK");
