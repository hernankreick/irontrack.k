// D6.2 — coherencia y priorizacion de las alertas del entrenador.
//
//   node scripts/test-d6-2CoherenciaAlertas.mjs
//
// Renderiza (SSR) el CoachDashboard real y captura las alertas que pasa a la campana (mismo arnes que test-d6EpisodiosAlertas.mjs: el
// import de CoachNotificationCenter que hace CoachDashboard se reemplaza por un capturador). Compara con el modelo REAL del Dashboard
// (coachDashboardModelo), con el filtro REAL de «Mis alumnos» (bajaActividadIds + vistaAlumnosConBaja + selectCoachStudentListState) y
// prueba el orden, el limite visible y el contador con las funciones reales de la campana. Datos ficticios relativos a hoy; sin red.
// La visualizacion movil (375/390/430) y los modos oscuro/claro se verifican en el navegador: scripts/qa/campana-alertas.mjs.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d62-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react"; import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard, { bajaActividadIds, inicioBajaActividad, adherenciaSemanalAlumno, semanasDashboard } from "./components/CoachDashboard.jsx";' +
      'import CampanaReal, * as Campana from "./components/CoachNotificationCenter.jsx";' +
      'import * as Ep from "./components/coach/alertasEpisodio.js";' +
      'import * as Prio from "./components/coach/alertasPrioridad.js";' +
      'import { coachDashboardModelo } from "./components/coach/coachDashboardModelo.js";' +
      'import { vistaAlumnosConBaja } from "./components/coach/coachDashboardNav.js";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      'import { diaLocal, lunesDe } from "./lib/metricas/index.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, CampanaReal, Campana, Ep, Prio, bajaActividadIds, inicioBajaActividad," +
      " adherenciaSemanalAlumno, semanasDashboard, coachDashboardModelo, vistaAlumnosConBaja, selectCoachStudentListState, diaLocal, lunesDe };",
    resolveDir: ROOT, sourcefile: "d62-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  plugins: [{
    name: "capturar-campana",
    setup(b) {
      b.onResolve({ filter: /CoachNotificationCenter\.jsx$/ }, (args) =>
        /CoachDashboard\.jsx$/.test(args.importer) ? { path: "capturador-campana", namespace: "d62" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "d62" }, () => ({
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
const ids = (lista) => lista.map((a) => String(a.id)).sort();
function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const EID = "22222222-2222-4222-8222-222222222222";

// ---- fixture: los cinco estados ----
//   dora  activa y al dia: rutina de 1 dia, entreno hoy y cada una de las 3 semanas anteriores (100 %)
//   beto  baja actividad (regla de D3): rutina de 4 dias, 1 sesion por semana (25 %) desde hace 4 semanas, 2 por semana antes (50 %)
//   ana   inactiva: rutina, ultima sesion hace 25 dias
//   cami  sin rutina
//   eli   recuperado: la semana pasada 0 %, esta semana 2 de 2 dias (100 %) -> al dia
const ALUMNOS = ["dora", "beto", "ana", "cami", "eli"].map(al);
const RUTINAS = [rut("dora", 1), rut("beto", 4), rut("ana", 2), rut("eli", 2)];
const SES_BETO = [ses("beto", L - 35, 0), ses("beto", L - 34, 1), ses("beto", L - 28, 0), ses("beto", L - 21, 0), ses("beto", L - 14, 0), ses("beto", L - 7, 0)];
const SESIONES = [
  ses("dora", HOY), ses("dora", L - 7), ses("dora", L - 14), ses("dora", L - 21),
  ...SES_BETO,
  ses("ana", HOY - 25),
  ses("eli", L - 20, 0), ses("eli", HOY, 0), ses("eli", HOY, 1),
];
const BASE = { alumnos: ALUMNOS, rutinas: RUTINAS, sesiones: SESIONES };

function tresPantallas(datos) {
  const st = catDe(datos);
  const catFn = st.coachAlumnoCategoria;
  const modelo = X.coachDashboardModelo({ alumnos: datos.alumnos, rutinas: datos.rutinas, sesiones: datos.sesiones, progresoGlobal: datos.progreso || {},
    historiaCompleta: datos.historiaCompleta === undefined ? { sesiones: true, progreso: true } : datos.historiaCompleta, alumnosStatus: "ready", catFn });
  const bajaIds = X.bajaActividadIds({ alumnos: datos.alumnos, catFn, rutinas: datos.rutinas, sesiones: datos.sesiones }); // App.jsx (Mis alumnos)
  const mis = X.vistaAlumnosConBaja({ counts: st.coachAlumnosCounts, lista: datos.alumnos, filtro: "baja", bajaIds });
  const rows = alertas(datos);
  return { st, catFn, modelo, mis, rows };
}

// ======================================================================= 1-5 coherencia entre pantallas
await test("1. consistencia: Dashboard, «Mis alumnos» y campana coinciden en baja actividad, inactivos y sin rutina", () => {
  const { modelo, mis, rows, catFn } = tresPantallas(BASE);
  assert.deepEqual(ids(modelo.seguimiento.baja), ["beto"]);
  assert.deepEqual(ids(mis.lista), ids(modelo.seguimiento.baja), "Mis alumnos (filtro Baja actividad) = Dashboard");
  assert.equal(mis.counts.baja, 1);
  assert.deepEqual(idsDe(rows, "wk-"), ids(modelo.seguimiento.baja), "campana = Dashboard");
  assert.deepEqual(idsDe(rows, "in-"), ids(modelo.seguimiento.inactivos));
  assert.deepEqual(idsDe(rows, "sr-"), ids(modelo.seguimiento.sinRutina));
  // categorias excluyentes: nadie tiene dos alertas de seguimiento
  const porAlumno = {};
  rows.filter((r) => /^(in|wk|sr)-/.test(r.key)).forEach((r) => { porAlumno[r.alumnoId] = (porAlumno[r.alumnoId] || 0) + 1; });
  assert.ok(Object.values(porAlumno).every((n) => n === 1), JSON.stringify(porAlumno));
  // un alumno con baja actividad o inactivo no recibe ademas «Le queda 1 sesión» (contradiria al Dashboard)
  const b2 = alertas({ alumnos: [al("beto"), al("ana")], rutinas: [rut("beto", 2), rut("ana", 2)], sesiones: [ses("beto", HOY - 15, 0), ses("ana", HOY - 25, 0)] });
  assert.deepEqual(b2.filter((r) => /^(in|wk|sr|rutina-)/.test(r.key)).map((r) => r.key.split("-")[0]).sort(), ["in", "wk"]);
  // baja actividad solo entre los «activos» de Mis alumnos (no es una categoria nueva)
  assert.equal(catFn(al("beto")), "activo");
  // la campana usa la MISMA funcion (sin una segunda condicion de actividad)
  const dash = read("components/CoachDashboard.jsx");
  assert.match(dash, /var bajaIds = bajaActividadIds\(\{ alumnos: alumnos, catFn: catFn, rutinas: rutinasSBEntrenador, sesiones: ses, hoy: hoy \}\);/);
  assert.doesNotMatch(dash, /countSesionesSince|countProgresoSince|since7|Poca actividad/);
});

await test("2. alumno activo y al dia: sin alertas de seguimiento", () => {
  const { modelo, rows, catFn } = tresPantallas(BASE);
  assert.equal(catFn(al("dora")), "activo");
  assert.equal(rows.filter((r) => String(r.alumnoId) === "dora" && /^(in|wk|sr)-/.test(r.key)).length, 0);
  assert.ok(!ids(modelo.seguimiento.baja).includes("dora"));
});

await test("3. baja actividad: alerta «Baja actividad» con el criterio de D3 (< 30 % semana pasada completa y actual)", () => {
  const { rows } = tresPantallas(BASE);
  const wk = rows.filter((r) => r.key.startsWith("wk-"));
  assert.equal(wk.length, 1);
  assert.equal(wk[0].badge, "Baja actividad");
  assert.equal(wk[0].key, "wk-beto-s" + (L - 28), "identidad = lunes de inicio del episodio");
  // el caso que antes era una alerta FALSA: nada en los ultimos 7 dias pero la semana pasada completa al dia => NO es baja actividad
  // fede: rutina de 1 dia, entreno el lunes de la semana pasada (100 %) y nada esta semana -> al dia (D3). La condicion anterior
  // («nada en 7 dias corridos») le mandaba «Poca actividad» de martes a domingo.
  const solo = { alumnos: [al("fede")], rutinas: [rut("fede", 1)], sesiones: [ses("fede", L - 7)] };
  const r = alertas(solo);
  assert.equal(r.filter((x) => x.key.startsWith("wk-")).length, 0, "sin alerta falsa");
  assert.deepEqual(ids(X.coachDashboardModelo({ alumnos: solo.alumnos, rutinas: solo.rutinas, sesiones: solo.sesiones, historiaCompleta: { sesiones: true, progreso: true }, alumnosStatus: "ready", catFn: catDe(solo).coachAlumnoCategoria }).seguimiento.baja), []);
});

await test("4. inactivo: solo «Sin actividad reciente» (in-), nunca tambien baja actividad", () => {
  const { rows } = tresPantallas(BASE);
  assert.deepEqual(rows.filter((r) => String(r.alumnoId) === "ana" && /^(in|wk|sr)-/.test(r.key)).map((r) => r.key.split("-")[0]), ["in"]);
});

await test("5. sin rutina: solo «Sin rutina» (sr-<id>, sin cambios)", () => {
  const { rows } = tresPantallas(BASE);
  assert.deepEqual(rows.filter((r) => String(r.alumnoId) === "cami").map((r) => r.key), ["sr-cami"]);
});

// ======================================================================= 6-8 recuperacion, persistencia y episodios
await test("6. recuperacion: con >= 30 % esta semana la alerta desaparece en las tres pantallas", () => {
  const { modelo, rows } = tresPantallas(BASE);
  assert.ok(!ids(modelo.seguimiento.baja).includes("eli"), "eli (0 % la semana pasada, 100 % esta) esta al dia");
  assert.equal(rows.filter((r) => r.key.startsWith("wk-eli")).length, 0);
  const recupera = { ...BASE, sesiones: SESIONES.concat([ses("beto", HOY, 1), ses("beto", HOY, 2)]) }; // beto: 2 de 4 = 50 % esta semana
  const t = tresPantallas(recupera);
  assert.equal(t.rows.filter((r) => r.key.startsWith("wk-beto")).length, 0, "campana");
  assert.ok(!ids(t.modelo.seguimiento.baja).includes("beto"), "Dashboard");
  assert.equal(t.mis.lista.length, 0, "Mis alumnos");
});

await test("7. persistencia D6.1 intacta: claves de inactivo / terminada / sin rutina, localStorage, tabla y «Marcar todas»", () => {
  const { rows } = tresPantallas(BASE);
  const inAna = rows.find((r) => r.key.startsWith("in-ana"));
  assert.equal(inAna.key, Ep.claveInactivo("ana", Ep.ultimoDiaActividad("ana", SESIONES, {})));
  assert.match(inAna.key, /^in-ana-d\d+$/);
  assert.equal(Ep.claveRutinaTerminada("a", "r", { datos: { ciclo_actual: 3 } }), "rutina-terminada-a-r-c3");
  const camp = read("components/CoachNotificationCenter.jsx");
  assert.match(camp, /const LS_READ_PREFIX = "irontrack_coach_notif_read_v2";/);
  assert.match(camp, /const REMOTE_READS_TABLE = "coach_notification_reads";/);
  assert.match(camp, /onConflict: "entrenador_id,notification_id"/);
  assert.match(camp, /function markAllRead\(\) \{[\s\S]*?unirLeidos\(readIdsRef\.current, allItems\.map/);
  // lecturas guardadas (incluidas las de la clave anterior de baja actividad) se conservan tal cual
  globalThis.localStorage = memoria();
  const key = Campana.buildReadStorageKey(EID);
  Campana.saveReadIds(key, ["real-wk-beto-d20700", "real-" + inAna.key]);
  assert.deepEqual(Campana.loadReadIds(key), ["real-wk-beto-d20700", "real-" + inAna.key]);
});

await test("8. sin episodios artificiales: la identidad de baja actividad no cambia mientras dura, aunque el alumno entrene algo", () => {
  const rutina = rut("beto", 4);
  const beto = al("beto");
  const inicio = X.inicioBajaActividad(beto, rutina, SES_BETO, HOY);
  assert.equal(inicio, L - 28);
  // todos los dias de esta semana y de la proxima: misma identidad (sigue entrenando 1 de 4 dias por semana: < 30 %)
  const conMas = SES_BETO.concat([ses("beto", L, 0), ses("beto", L + 8, 0)]);
  for (let k = 0; k < 14; k++) {
    const dia = L + k;
    assert.equal(X.inicioBajaActividad(beto, rutina, conMas, dia), L - 28, "dia L+" + k);
  }
  // la condicion de D3 se sigue cumpliendo esos dias (la alerta existe y su clave es estable)
  const bajaProx = X.bajaActividadIds({ alumnos: [beto], catFn: () => "activo", rutinas: [rutina], sesiones: conMas, hoy: L + 9 });
  assert.ok(bajaProx.beto);
  // recuperacion (2 de 4 la semana actual) y recaida dos semanas despues: episodio NUEVO (otra clave)
  const recup = conMas.concat([ses("beto", L + 1, 1)]); // semana L: 2 de 4 = 50 %
  assert.ok(!X.bajaActividadIds({ alumnos: [beto], catFn: () => "activo", rutinas: [rutina], sesiones: recup, hoy: L + 7 }).beto, "recuperado");
  const recaida = X.inicioBajaActividad(beto, rutina, recup, L + 14);
  assert.equal(recaida, L + 7, "la recaida empieza despues de la semana recuperada");
  assert.notEqual(Ep.claveBajaActividad("beto", recaida), Ep.claveBajaActividad("beto", inicio));
  // el inicio nunca es anterior a la asignacion de la rutina (rutina asignada el lunes L-21: el tramo empieza ahi, no en L-28)
  const reasignada = { ...rutina, created_at: fechaDe(L - 21).toISOString() };
  assert.equal(X.inicioBajaActividad(beto, reasignada, SES_BETO, HOY), L - 21);
  // rutina asignada a mitad de la semana pasada: esa semana no es medible completa => sin inicio (y D3 la trata como «rutina nueva», sin alerta)
  const nueva = { ...rutina, created_at: fechaDe(L - 4).toISOString() };
  assert.equal(X.inicioBajaActividad(beto, nueva, SES_BETO, HOY), null);
  assert.ok(!X.bajaActividadIds({ alumnos: [beto], catFn: () => "activo", rutinas: [nueva], sesiones: SES_BETO }).beto);
  // el modulo de claves sigue sin aleatorios ni fecha de render
  assert.doesNotMatch(read("components/coach/alertasEpisodio.js"), /Math\.random|Date\.now|new Date\(\)/);
});

// ======================================================================= 9 textos
await test("9. textos correctos en es / en / pt (a 1 sesion de completar la SEMANA; baja actividad con el criterio real)", () => {
  const datos = { alumnos: [al("gus"), al("beto")], rutinas: [rut("gus", 2), rut("beto", 4)], sesiones: [ses("gus", HOY, 0), ...SES_BETO] };
  const esperado = {
    es: ["Le queda 1 sesión", "A Gus le queda 1 sesión para completar la semana.", "Baja actividad", "Completó menos del 30 % de su plan la semana pasada y en lo que va de esta."],
    en: ["1 session left", "Gus has 1 session left to complete the week.", "Low activity", "Completed under 30% of their plan last week and so far this week."],
    pt: ["Falta 1 sessão", "Falta 1 sessão para Gus concluir a semana.", "Baixa atividade", "Concluiu menos de 30% do plano na semana passada e até agora nesta."],
  };
  for (const lang of ["es", "en", "pt"]) {
    const rows = alertas({ ...datos, lang });
    const f1 = rows.find((r) => r.key.startsWith("rutina-falta-1-gus"));
    const wk = rows.find((r) => r.key.startsWith("wk-beto"));
    assert.ok(f1 && wk, lang);
    assert.deepEqual([f1.badge, f1.desc, wk.badge, wk.desc], esperado[lang], lang);
  }
  const dash = read("components/CoachDashboard.jsx");
  assert.doesNotMatch(dash, /para completar su rutina|to complete their routine|concluir a rotina\./, "sin la redaccion anterior");
});

// ======================================================================= 10-13 limite, prioridad, contador
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

await test("10. mas de 12 alertas: buildCoachAlerts ya no recorta; la campana muestra 12 y el resto con «Ver N más»", () => {
  const rows = alertas(muchas());
  assert.equal(rows.length, 21, "todas las alertas llegan a la campana");
  assert.equal(idsDe(rows, "in-").length, 6);
  assert.equal(idsDe(rows, "sr-").length, 3);
  assert.equal(idsDe(rows, "wk-").length, 3);
  assert.equal(rows.filter((r) => r.tipo === "workout_completed").length, 8);
  assert.equal(new Set(rows.map((r) => r.key)).size, rows.length, "sin duplicados");
  assert.equal(Prio.LIMITE_VISIBLE, 12);
  const camp = read("components/CoachNotificationCenter.jsx");
  assert.match(camp, /var visibles = verTodas \? filtered : filtered\.slice\(0, LIMITE_VISIBLE\);/);
  assert.match(camp, /filtered\.length > LIMITE_VISIBLE \?/);
  assert.match(camp, /M\(lang, "Ver " \+ ocultas \+ " más", "Show " \+ ocultas \+ " more", "Ver mais " \+ ocultas\)/);
  assert.match(camp, /minHeight: 44,\n\s*padding: "10px 14px"/, "boton de 44 px");
  assert.doesNotMatch(read("components/CoachDashboard.jsx"), /return out\.slice\(0, 12\);/);
});

await test("11. priorizacion: no leidas y de seguimiento primero (mensajes, sin rutina, inactivos, baja) y despues los logros", () => {
  const notifs = Campana.mapAlertsToNotifications(alertas(muchas()));
  const orden = Prio.ordenarNotificaciones(notifs, []);
  const primeraLogro = orden.findIndex((x) => x.category === "logro");
  assert.equal(primeraLogro, 13, "las 13 de seguimiento (1 mensaje + 3 sin rutina + 6 inactivos + 3 baja) van antes");
  assert.ok(orden.slice(primeraLogro).every((x) => x.category === "logro"));
  assert.equal(orden[0].category, "mensaje");
  assert.deepEqual(orden.slice(0, 13).map((x) => x.severity), [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2], "severidad existente dentro del grupo");
  // las 12 visibles son todas de seguimiento; los logros quedan detras de «Ver más», nada se pierde
  assert.ok(orden.slice(0, 12).every((x) => Prio.requiereSeguimiento(x)));
  assert.equal(orden.length, notifs.length);
  // una leida baja al final de las no leidas; «Importantes» = las de seguimiento
  const leida = orden[0].id;
  const orden2 = Prio.ordenarNotificaciones(notifs, [leida]);
  assert.equal(orden2[orden2.length - 1].id, leida);
  assert.ok(notifs.filter((x) => x.important).every((x) => x.category !== "logro"));
  assert.equal(notifs.filter((x) => x.important).length, 13);
  // duplicados (mismo id) se muestran una sola vez
  assert.equal(Prio.ordenarNotificaciones(notifs.concat([notifs[0]]), []).length, notifs.length);
});

await test("12. contador de no leidas: cuenta el conjunto COMPLETO (no solo las 12 visibles) y descuenta las leidas", () => {
  const rows = alertas(muchas());
  const notifs = Campana.mapAlertsToNotifications(rows);
  assert.equal(Prio.contarNoLeidas(notifs, []), 21);
  assert.equal(Prio.contarNoLeidas(notifs, [notifs[0].id, notifs[20].id, "real-otra-que-ya-no-existe"]), 19);
  // la campana real (SSR, panel cerrado) muestra el numero con el conjunto completo
  globalThis.localStorage = memoria();
  const html = renderToStaticMarkup(h(X.CampanaReal, { alertRows: rows.slice(0, 5), lang: "es", entrenadorId: EID }));
  assert.match(html, />5<\/span>/);
  const html2 = renderToStaticMarkup(h(X.CampanaReal, { alertRows: rows, lang: "es", entrenadorId: EID }));
  assert.match(html2, />9\+<\/span>/, "21 no leidas => 9+");
  globalThis.localStorage = memoria();
  Campana.saveReadIds(Campana.buildReadStorageKey(EID), notifs.slice(0, 18).map((x) => x.id));
  const html3 = renderToStaticMarkup(h(X.CampanaReal, { alertRows: rows, lang: "es", entrenadorId: EID }));
  assert.match(html3, />3<\/span>/, "18 leidas de 21 => 3");
  assert.match(read("components/CoachNotificationCenter.jsx"), /return contarNoLeidas\(allItems, readIds\);/);
});

await test("13. «Marcar todas»: marca el conjunto completo (tambien las de «Ver más») sin descartar lecturas anteriores", () => {
  const notifs = Campana.mapAlertsToNotifications(alertas(muchas()));
  const previas = ["real-chat-viejo-1", "real-in-ok0-d1"];
  const todas = Ep.unirLeidos(previas, Prio.ordenarNotificaciones(notifs, previas).map((x) => x.id));
  assert.equal(Prio.contarNoLeidas(notifs, todas), 0);
  assert.ok(previas.every((p) => todas.includes(p)));
  assert.equal(todas.length, previas.length + notifs.length);
  // markAllRead recorre allItems (el conjunto completo ordenado), no la lista visible recortada
  assert.match(read("components/CoachNotificationCenter.jsx"), /unirLeidos\(readIdsRef\.current, allItems\.map/);
});

// ======================================================================= 14 carga e historial incompleto
await test("14. carga e historial incompleto: sin alertas inventadas mientras carga; incompleto => mismas reglas en las tres pantallas", () => {
  const cargando = alertas({ ...BASE, sesiones: [], historiaCompleta: null });
  assert.equal(cargando.filter((r) => /^(in|wk|sr|rutina-)/.test(r.key)).length, 0, "historial cargando");
  assert.deepEqual(alertas({ ...BASE, alumnos: [], alumnosStatus: "loading" }), [], "alumnos todavia sin cargar");
  // recarga de alumnos con la lista ya visible (comportamiento existente): mismas alertas y mismas claves, sin parpadeos ni avisos nuevos
  assert.deepEqual(alertas({ ...BASE, alumnosStatus: "loading" }).map((r) => r.key), alertas(BASE).map((r) => r.key), "recarga");
  const inc = { ...BASE, historiaCompleta: { sesiones: false, progreso: true } };
  const t = tresPantallas(inc);
  assert.deepEqual(idsDe(t.rows, "wk-"), ids(t.modelo.seguimiento.baja));
  assert.deepEqual(ids(t.mis.lista), ids(t.modelo.seguimiento.baja));
  assert.equal(alertas(inc).find((r) => r.key.startsWith("wk-")).key, t.rows.find((r) => r.key.startsWith("wk-")).key, "clave estable");
});

console.log("\n" + count + " pruebas OK");
