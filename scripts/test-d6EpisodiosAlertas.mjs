// D6.1 (H13) — las alertas de seguimiento del entrenador tienen identidad por EPISODIO.
//
//   node scripts/test-d6EpisodiosAlertas.mjs
//
// Renderiza (SSR) el CoachDashboard real y captura las alertas que le pasa a la campana (CoachNotificationCenter reemplazado SOLO para
// el import de CoachDashboard por un capturador, con un alias de esbuild). El estado «leido» se prueba con las funciones REALES de la
// campana (loadReadIds / saveReadIds / mergeReadIds / mapAlertsToNotifications), con un
// localStorage en memoria (sin red ni Supabase). Datos ficticios relativos a hoy.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d6-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react"; import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboard from "./components/CoachDashboard.jsx";' +
      'import * as Campana from "./components/CoachNotificationCenter.jsx";' +
      'import * as Ep from "./components/coach/alertasEpisodio.js";' +
      'import { selectCoachStudentListState } from "./lib/coachStudentListSelectors.js";' +
      "export { React, renderToStaticMarkup, CoachDashboard, Campana, Ep, selectCoachStudentListState };",
    resolveDir: ROOT, sourcefile: "d6-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  plugins: [{
    name: "capturar-campana",
    setup(b) {
      // Solo el import que hace CoachDashboard.jsx se reemplaza; la entrada importa el modulo real.
      b.onResolve({ filter: /CoachNotificationCenter\.jsx$/ }, (args) =>
        /CoachDashboard\.jsx$/.test(args.importer) ? { path: "capturador-campana", namespace: "d6" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "d6" }, () => ({
        loader: "js",
        contents: "export default function CampanaCapturada(props) { globalThis.__alertas = props.alertRows; return null; }",
      }));
    },
  }],
});
const X = await import(pathToFileURL(outfile).href);
const { React, renderToStaticMarkup, CoachDashboard, Campana, Ep } = X;
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fechas relativas a hoy ----
const DIA = 86400000;
const hace = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const dmy = (n) => { const d = hace(n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const iso = (n) => hace(n).toISOString();
const diaDe = (n) => X.Ep.ultimoDiaActividad("x", [{ alumno_id: "x", fecha: dmy(n) }], {});
const dias = (n) => Array.from({ length: n }, () => ({ exercises: [{ id: "sq" }] }));
const ses = (aid, n, extra) => Object.assign({ id: "s-" + aid + "-" + n + "-" + Math.random().toString(36).slice(2, 6), alumno_id: aid, rutina_id: "r-" + aid, rutina_nombre: "", fecha: dmy(n), created_at: iso(n), semana: 1, dia_idx: 0 }, extra || {});
const rut = (aid, datos) => ({ id: "r-" + aid, alumno_id: aid, nombre: "R", created_at: iso(120), datos: Object.assign({ days: dias(4) }, datos || {}) });

/** Alertas que CoachDashboard pasa a la campana, con la categoria evaluada en `nowMs` (simula otro dia) y solo datos hasta esa fecha. */
function alertas({ alumnos, rutinas, sesiones, progreso, nowMs, historiaCompleta, alumnosStatus }) {
  const catFn = X.selectCoachStudentListState({
    alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinas, sesionesGlobalesLimpias: sesiones, progresoGlobalLimpio: progreso || {},
    coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: nowMs != null ? nowMs : Date.now(),
  }).coachAlumnoCategoria;
  globalThis.__alertas = null;
  renderToStaticMarkup(h(CoachDashboard, {
    alumnos, alumnosStatus: alumnosStatus || "ready", sesionesGlobales: sesiones, progresoGlobal: progreso || {},
    historiaCompleta: historiaCompleta === undefined ? { sesiones: true, progreso: true } : historiaCompleta,
    rutinasSBEntrenador: rutinas, getAlumnoCategoria: catFn, lang: "es",
  }));
  return globalThis.__alertas || [];
}
const deTipo = (rows, prefijo, aid) => rows.filter((r) => r.key.startsWith(prefijo + aid + "-") || r.key === prefijo + aid);

// ---- localStorage en memoria (sin red) ----
function memoria() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _m: m };
}
const EID = "11111111-1111-4111-8111-111111111111";
const idNotif = (row) => Campana.mapAlertsToNotifications([row])[0].id;

// ---- fixture base: Ana con rutina, ultima actividad hace 25 dias (inactiva) ----
const ana = { id: "ana", nombre: "Ana" };
const beto = { id: "beto", nombre: "Beto" };
const rutinas = [rut("ana"), rut("beto")];

// ======================================================================= identidad por episodio (Inactivo)
await test("1. primera aparicion: inactivo genera «in-<id>-d<ultimoDia>» y la notificacion queda no leida", () => {
  const rows = alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 25)] });
  const inA = deTipo(rows, "in-", "ana");
  assert.equal(inA.length, 1);
  assert.equal(inA[0].key, "in-ana-d" + diaDe(25));
  assert.equal(idNotif(inA[0]), "real-in-ana-d" + diaDe(25));
  globalThis.localStorage = memoria();
  assert.ok(!Campana.loadReadIds(Campana.buildReadStorageKey(EID)).includes(idNotif(inA[0])), "sin lecturas: no leida");
});

await test("2 y 3. marcar como leida y recargar: se guarda y se conserva (localStorage real de la campana)", () => {
  globalThis.localStorage = memoria();
  const key = Campana.buildReadStorageKey(EID);
  const row = deTipo(alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 25)] }), "in-", "ana")[0];
  Campana.saveReadIds(key, Ep.unirLeidos(Campana.loadReadIds(key), [idNotif(row)]));
  // "recargar": se vuelven a calcular las alertas desde los mismos datos y se leen las lecturas guardadas
  const row2 = deTipo(alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 25)] }), "in-", "ana")[0];
  assert.equal(row2.key, row.key, "misma clave tras recargar");
  assert.ok(Campana.loadReadIds(key).includes(idNotif(row2)), "sigue leida");
});

await test("4. misma condicion durante varios dias: la clave no cambia (sin notificaciones nuevas)", () => {
  const datos = { alumnos: [ana], rutinas, sesiones: [ses("ana", 25)] };
  const hoy = deTipo(alertas(datos), "in-", "ana")[0].key;
  for (const masDias of [1, 3, 7]) {
    assert.equal(deTipo(alertas({ ...datos, nowMs: Date.now() + masDias * DIA }), "in-", "ana")[0].key, hoy, "+" + masDias + " dias");
  }
});

await test("5 y 6. recuperacion y recaida: se recupera (sin alerta) y el episodio nuevo tiene otra clave, NO leida", () => {
  globalThis.localStorage = memoria();
  const key = Campana.buildReadStorageKey(EID);
  // episodio 1 visto hace 35 dias: ultima actividad hace 60
  const ep1 = deTipo(alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 60)], nowMs: hace(35).getTime() }), "in-", "ana");
  assert.equal(ep1.length, 1);
  Campana.saveReadIds(key, [idNotif(ep1[0])]);
  // recuperacion: entreno hace 31 dias, visto hace 30 -> activo, sin alerta de inactivo
  const rec = alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 60), ses("ana", 31)], nowMs: hace(30).getTime() });
  assert.equal(deTipo(rec, "in-", "ana").length, 0, "recuperada");
  // recaida: hoy, ultima actividad hace 31 dias -> inactiva otra vez
  const ep2 = deTipo(alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 60), ses("ana", 31)] }), "in-", "ana");
  assert.equal(ep2.length, 1);
  assert.notEqual(ep2[0].key, ep1[0].key, "episodio nuevo => clave nueva");
  assert.ok(!Campana.loadReadIds(key).includes(idNotif(ep2[0])), "el episodio nuevo aparece NO leido");
});

await test("7. dos alumnos con el mismo problema: claves distintas", () => {
  const rows = alertas({ alumnos: [ana, beto], rutinas, sesiones: [ses("ana", 25), ses("beto", 25)] });
  const a = deTipo(rows, "in-", "ana"), b = deTipo(rows, "in-", "beto");
  assert.equal(a.length, 1); assert.equal(b.length, 1);
  assert.notEqual(a[0].key, b[0].key);
});

// ======================================================================= Baja actividad y Rutina terminada
// D6.2: «Poca actividad» (nada en 7 dias) paso a «Baja actividad» con la regla de D3 y su identidad es el lunes de inicio del episodio
// ("wk-<id>-s<lunes>"); estabilidad, recuperacion y recaida se prueban en scripts/test-d6-2CoherenciaAlertas.mjs.
await test("Baja actividad: clave «wk-<id>-s<lunesDeInicio>» (D6.2), una por alumno", () => {
  const r1 = deTipo(alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 10)] }), "wk-", "ana");
  assert.equal(r1.length, 1);
  assert.match(r1[0].key, /^wk-ana-s\d+$/);
  const r2 = deTipo(alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 10)] }), "wk-", "ana");
  assert.equal(r2[0].key, r1[0].key, "misma condicion => misma clave");
});

await test("Rutina terminada: un episodio por rutina y CICLO (el ciclo 2 avisa aunque el ciclo 1 este leido)", () => {
  const c1 = rut("ana", { days: dias(1), semana_activa: 4 });
  const t1 = deTipo(alertas({ alumnos: [ana], rutinas: [c1], sesiones: [ses("ana", 1, { semana: 4 })] }), "rutina-terminada-", "ana");
  assert.equal(t1.length, 1);
  assert.equal(t1[0].key, "rutina-terminada-ana-r-ana-c1");
  const c2 = rut("ana", { days: dias(1), semana_activa: 4, ciclo_actual: 2 });
  const t2 = deTipo(alertas({ alumnos: [ana], rutinas: [c2], sesiones: [ses("ana", 30, { semana: 4 }), ses("ana", 1, { semana: 4, ciclo: 2 })] }), "rutina-terminada-", "ana");
  assert.equal(t2.length, 1);
  assert.equal(t2[0].key, "rutina-terminada-ana-r-ana-c2");
  assert.notEqual(idNotif(t2[0]), idNotif(t1[0]));
});

await test("Sin rutina: clave SIN CAMBIOS («sr-<id>») — limitacion documentada (no hay historial de bajas de rutina)", () => {
  const rows = alertas({ alumnos: [ana], rutinas: [], sesiones: [ses("ana", 2)] });
  assert.deepEqual(deTipo(rows, "sr-", "ana").map((r) => r.key), ["sr-ana"]);
  assert.match(read("components/coach/alertasEpisodio.js"), /Sin rutina\s+"sr-<alumnoId>" \(SIN CAMBIOS, limitacion documentada\)/);
});

// ======================================================================= persistencia
await test("8. entre dispositivos: la clave es la misma en ambos y lo leido en coach_notification_reads se fusiona", () => {
  const datos = { alumnos: [ana], rutinas, sesiones: [ses("ana", 25)] };
  const enB = deTipo(alertas(datos), "in-", "ana")[0]; // dispositivo B: marca como leida (fila remota)
  const filasRemotas = [{ entrenador_id: EID, notification_id: idNotif(enB) }];
  globalThis.localStorage = memoria(); // dispositivo A, sin nada local
  const enA = deTipo(alertas(datos), "in-", "ana")[0];
  assert.equal(idNotif(enA), idNotif(enB), "misma clave determinista en ambos dispositivos");
  // la campana carga notification_id de la tabla y los fusiona con lo local (mergeReadIds real)
  const unidos = Campana.mergeReadIds(Campana.loadReadIds(Campana.buildReadStorageKey(EID)), filasRemotas.map((f) => f.notification_id));
  assert.ok(unidos.includes(idNotif(enA)), "leida en A por la lectura de B");
  // la persistencia remota no cambia: misma tabla, mismo upsert idempotente
  const src = read("components/CoachNotificationCenter.jsx");
  assert.match(src, /const REMOTE_READS_TABLE = "coach_notification_reads";/);
  assert.match(src, /onConflict: "entrenador_id,notification_id"/);
});

await test("9. compatibilidad: las lecturas con claves anteriores se leen, se conservan y no chocan con las nuevas", () => {
  globalThis.localStorage = memoria();
  const key = Campana.buildReadStorageKey(EID);
  const viejas = ["real-in-ana", "real-wk-ana", "real-sr-ana", "real-rutina-terminada-ana-r-ana-w3"];
  Campana.saveReadIds(key, viejas);
  const rows = alertas({ alumnos: [ana], rutinas: [], sesiones: [ses("ana", 2)] });
  assert.deepEqual(Campana.loadReadIds(key), viejas, "se leen tal cual (no se borran ni reescriben)");
  // «Sin rutina» no cambio: su lectura vieja sigue valiendo
  assert.ok(Campana.loadReadIds(key).includes(idNotif(deTipo(rows, "sr-", "ana")[0])));
  // Inactivo con clave nueva: no coincide con la vieja => aparece UNA vez como no leido (efecto documentado del despliegue)
  const inN = deTipo(alertas({ alumnos: [ana], rutinas, sesiones: [ses("ana", 25)] }), "in-", "ana")[0];
  assert.ok(!viejas.includes(idNotif(inN)));
  assert.ok(Ep.unirLeidos(viejas, [idNotif(inN)]).length === viejas.length + 1, "al leerla se agrega sin perder las viejas");
});

await test("10. «Marcar todas» une con las lecturas anteriores (no las descarta del estado local)", () => {
  const previas = ["real-chat-ana-1", "real-in-beto-d100"];
  const visibles = ["real-in-ana-d200", "real-chat-ana-1"];
  assert.deepEqual(Ep.unirLeidos(previas, visibles), ["real-chat-ana-1", "real-in-beto-d100", "real-in-ana-d200"]);
  const src = read("components/CoachNotificationCenter.jsx");
  assert.match(src, /function markAllRead\(\) \{[\s\S]*?unirLeidos\(readIdsRef\.current, allItems\.map/);
});

await test("11. sin duplicados: una sola alerta por alumno y categoria; claves unicas", () => {
  const rows = alertas({ alumnos: [ana, beto], rutinas, sesiones: [ses("ana", 25), ses("ana", 26), ses("beto", 10)] });
  const keys = rows.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, "claves unicas");
  assert.equal(deTipo(rows, "in-", "ana").length, 1);
  assert.equal(deTipo(rows, "wk-", "beto").length, 1);
});

await test("12. cargando: sin alertas de seguimiento; historial incompleto: claves solo de datos cargados (estables)", () => {
  const cargando = alertas({ alumnos: [ana], rutinas, sesiones: [], historiaCompleta: null });
  assert.equal(cargando.filter((r) => /^(in|wk|sr|rutina-terminada)-/.test(r.key)).length, 0, "mientras carga no se inventan inactivos");
  const inc = { alumnos: [ana], rutinas, sesiones: [ses("ana", 25)], historiaCompleta: { sesiones: false, progreso: true } };
  const k1 = deTipo(alertas(inc), "in-", "ana")[0].key;
  assert.equal(deTipo(alertas(inc), "in-", "ana")[0].key, k1);
});

await test("reglas: sin aleatorios ni fecha de render en las claves; modulo puro", () => {
  const src = read("components/coach/alertasEpisodio.js");
  assert.doesNotMatch(src, /Math\.random|Date\.now|new Date\(\)/);
  assert.doesNotMatch(src, /from ["']react["']|from ["'][^"']*supabase/i, "modulo puro: sin React ni Supabase");
  const dash = read("components/CoachDashboard.jsx");
  for (const k of ["claveSinRutina(a.id)", "claveRutinaTerminada(a.id, rutinaId, rutina)", "claveInactivo(a.id, ultimoDiaActividad(a.id, ses, progresoGlobal))", "claveBajaActividad(a.id, inicioBajaActividad(a, rutina, ses.filter("]) {
    assert.ok(dash.includes(k), k);
  }
  assert.doesNotMatch(dash, /key: "in-" \+ a\.id,|key: "wk-" \+ a\.id,|"-w" \+ weekly\.weekIndex,\n\s*alumnoId: a\.id,\n\s*rutinaId: rutinaId,\n\s*initials: initials,\n\s*name: name,\n\s*badge: M\(lang, "Rutina terminada"/);
});

console.log("\n" + count + " pruebas OK");
