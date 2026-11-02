// D7.2 (C-3): adherencia del entrenador — una sola regla (lib/metricas/adherencia.js) y sus casos limite.
//
//   node scripts/test-d7-2Adherencia.mjs
//
// Funciones REALES: adherencia (nucleo), adherenciaSemanalAlumno (Dashboard, CoachDashboard.jsx), buildCoachProgresoModel (Progreso),
// buildManualSessionPayload / fechaValidacionManual (validacion manual) y buildCoachGlobalSearchData (busqueda). Datos ficticios, sin red.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d72-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'export { adherencia } from "./lib/metricas/adherencia.js";' +
      'export { diaLocal, lunesDe } from "./lib/metricas/index.js";' +
      'export { adherenciaSemanalAlumno, semanasDashboard } from "./components/CoachDashboard.jsx";' +
      'export { buildCoachProgresoModel } from "./components/coachProgresoMetrics.js";' +
      'export { buildManualSessionPayload, fechaValidacionManual } from "./lib/manualSessionValidation.js";' +
      'export { buildCoachGlobalSearchData } from "./lib/coachGlobalSearchSelectors.js";',
    resolveDir: ROOT, sourcefile: "d72-entry.js", loader: "js",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const X = await import(pathToFileURL(outfile).href);

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const HOY = X.diaLocal();
const L = X.lunesDe(HOY);
const fechaDe = (dia) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (HOY - dia)); return d; };
const dmy = (dia) => { const d = fechaDe(dia); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
let n = 0;
const ses = (dia, diaIdx, extra) => Object.assign({ id: "s" + ++n, alumno_id: "a", rutina_id: "r", rutina_nombre: "Fuerza", fecha: dmy(dia),
  created_at: fechaDe(dia).toISOString(), semana: 1, dia_idx: diaIdx }, extra || {});
const rut = (extra) => Object.assign({ id: "r", alumno_id: "a", nombre: "Fuerza", created_at: fechaDe(L - 70).toISOString(),
  datos: { days: [{}, {}, {}], semana_activa: 1 } }, extra || {});
// semana completa pasada: [L-7, L-1]
const SEM = { desde: L - 7, hasta: L - 1 };
const ad = (sesiones, rango, rutina) => X.adherencia({ rutina: rutina || rut(), sesiones, alumnoId: "a", desde: (rango || SEM).desde, hasta: (rango || SEM).hasta });

await test("1. adherencia completa: 3 de 3 dias de la rutina en la semana = 100 %", () => {
  const r = ad([ses(L - 7, 0), ses(L - 5, 1), ses(L - 3, 2)]);
  assert.deepEqual([r.completadas, r.planificadas, r.pct, r.realizadas, r.validadas], [3, 3, 100, 3, 0]);
});

await test("2. sesiones pendientes: no cuentan (1 completada + 1 pendiente = 33 %)", () => {
  const r = ad([ses(L - 7, 0), ses(L - 5, 1, { estado: "pendiente" }), ses(L - 4, 2, { completada: false })]);
  assert.deepEqual([r.completadas, r.pct], [1, 33]);
});

await test("3. reinicio de SEMANA: repetir dias en la misma semana no supera la meta semanal (tope por semana)", () => {
  // intento del ciclo 1 (dias 0 y 1) + reinicio de semana y nuevo intento del ciclo 2 (dias 0, 1 y 2)
  const s = [ses(L - 7, 0), ses(L - 6, 1), ses(L - 5, 0, { ciclo: 2 }), ses(L - 4, 1, { ciclo: 2 }), ses(L - 3, 2, { ciclo: 2 })];
  const r = ad(s);
  assert.equal(r.completadas, 3, "antes contaba 5 («5 de 3»)");
  assert.equal(r.pct, 100);
  // con 4 semanas: 6 sesiones en una sola semana y 0 en las demas = 3/12 (antes 6/12 tapaba una semana vacia)
  const r4 = ad(s.concat([ses(L - 2, 0, { ciclo: 2 })]), { desde: L - 28, hasta: L - 1 });
  assert.deepEqual([r4.completadas, r4.planificadas, r4.pct], [3, 12, 25]);
});

await test("4. reinicio de RUTINA: las sesiones del ciclo anterior del periodo cuentan una vez (entrenamientos reales), sin inflar", () => {
  const rutina = rut({ datos: { days: [{}, {}, {}], semana_activa: 1, ciclo_actual: 2, ciclo_base: 2 } });
  const r = ad([ses(L - 7, 0), ses(L - 6, 1), ses(L - 3, 0, { ciclo: 2 })], SEM, rutina);
  assert.deepEqual([r.completadas, r.pct], [3, 100]);
  const solo = ad([ses(L - 7, 0), ses(L - 7, 0, { ciclo: 2 })], SEM, rutina);
  assert.equal(solo.completadas, 1, "mismo dia y mismo dia de rutina: una vez");
});

await test("5. cambio de RUTINA: no cuentan sesiones de la rutina anterior (rutina_id distinto ni legado anterior a la asignacion)", () => {
  const nueva = rut({ id: "r2", created_at: fechaDe(L - 5).toISOString() });
  nueva.created_at = new Date(fechaDe(L - 5).getTime() + 3 * 3600000).toISOString(); // asignada a las 15 h
  const s = [
    ses(L - 6, 0, { rutina_id: "r" }), // otra rutina, antes de asignar
    ses(L - 5, 1, { rutina_id: null, created_at: fechaDe(L - 5).toISOString() }), // legado (mismo nombre) del dia de la reasignacion, ANTES
    ses(L - 4, 0, { rutina_id: "r2" }),
  ];
  const r = ad(s, SEM, nueva);
  assert.equal(r.completadas, 1, "solo la de la rutina nueva");
  // legado creado DESPUES de asignar si cuenta (compatibilidad con filas sin rutina_id)
  const r2 = ad([ses(L - 3, 2, { rutina_id: null })], SEM, nueva);
  assert.equal(r2.completadas, 1);
});

await test("6. ciclos anteriores fuera del periodo no cuentan; el periodo se ancla a la asignacion", () => {
  const r = ad([ses(L - 14, 0), ses(L - 13, 1), ses(L - 3, 0, { ciclo: 2 })]);
  assert.equal(r.completadas, 1);
  const recien = rut({ created_at: fechaDe(L - 3).toISOString() });
  const r2 = ad([ses(L - 6, 0), ses(L - 2, 1)], SEM, recien);
  assert.equal(r2.desdeEfectivo, L - 3);
  assert.equal(r2.completadas, 1, "lo anterior a la asignacion no cuenta");
});

await test("7. validadas manualmente: cuentan, se informan aparte, la realizada gana; la fecha guardada es la del entrenamiento", () => {
  const r = ad([ses(L - 7, 0), ses(L - 5, 1, { origen: "validada_coach", ejercicios: "" }), ses(L - 7, 0, { origen: "validada_coach" })]);
  assert.deepEqual([r.completadas, r.realizadas, r.validadas], [2, 1, 1]);
  // P1: validar el lunes lo entrenado la semana pasada guarda la fecha del entrenamiento (antes: hoy)
  const rutina = rut();
  const p = X.buildManualSessionPayload({ alumnoId: "a", rutina, diaIdx: 1, semana: 1, fecha: dmy(L - 5) });
  assert.equal(p.fecha, dmy(L - 5));
  assert.equal(p.origen, "validada_coach");
  const lunesPasado = ad([Object.assign(ses(L - 5, 1), { fecha: p.fecha, origen: p.origen })]);
  assert.equal(lunesPasado.completadas, 1, "cuenta en su semana real");
  // created_at = ese dia a las 12:00 (Argentina): la «ultima actividad» no lo toma como entrenado hoy
  assert.match(p.created_at, /T12:00:00-03:00$/);
  // fecha pedida invalida (futura, anterior a la asignacion o al inicio del ciclo, demasiado vieja, mal formada): ERROR, nunca hoy en silencio
  assert.throws(() => X.buildManualSessionPayload({ alumnoId: "a", rutina, diaIdx: 1, semana: 1, fecha: dmy(HOY + 2) }), /Fecha del entrenamiento invalida/);
  const hoyStr = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const sinFecha = X.buildManualSessionPayload({ alumnoId: "a", rutina, diaIdx: 1, semana: 1 });
  assert.equal(sinFecha.fecha, hoyStr, "sin fecha: hoy (como antes)");
  assert.equal(sinFecha.created_at, undefined, "hoy: created_at del servidor");
  // tras un reinicio, la fecha no puede ser anterior al inicio del ciclo vigente (no mezclar bloques)
  const reiniciada = rut({ datos: { days: [{}, {}, {}], semana_activa: 1, ciclo_actual: 2, ciclos_meta: [{ ciclo: 2, tipo: "semana", semana_inicio: 1, at: fechaDe(L - 4).toISOString() }] } });
  assert.equal(X.fechaValidacionManual(dmy(L - 6), reiniciada), null);
  assert.equal(X.fechaValidacionManual(dmy(L - 3), reiniciada), dmy(L - 3));
  assert.equal(X.fechaValidacionManual(dmy(L - 80), rutina), null, "antes de la asignacion");
  assert.equal(X.fechaValidacionManual(dmy(HOY - 61), rut({ created_at: fechaDe(HOY - 200).toISOString() })), null, "mas de 60 dias");
  assert.equal(X.fechaValidacionManual("x", rutina), null);
  const d = fechaDe(L - 5);
  const conCeros = String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  assert.equal(X.fechaValidacionManual(conCeros, rutina), dmy(L - 5), "se normaliza sin ceros (como toLocaleDateString es-AR)");
});

await test("8b. semana de calendario: el resultado no depende del dia en que empieza el periodo; la realizada sin dia_idx conserva prioridad", () => {
  // 3 sesiones en cada semana lunes-domingo, alternando final e inicio de semana: con bloques moviles daba 50-100 % segun el dia
  const s = [];
  for (let w = 0; w < 6; w++) { const lun = L - 7 * (w + 1); const dias = w % 2 ? [0, 1, 2] : [3, 4, 5]; dias.forEach((d, i) => s.push(ses(lun + d, i))); }
  for (let off = 0; off < 7; off++) {
    const hasta = L - 1 - off, desde = hasta - 27;
    assert.equal(ad(s, { desde, hasta }).pct, 100, "inicio desplazado " + off);
  }
  // periodo de 28 dias que toca 5 semanas de calendario: «completadas» nunca supera a «planificadas» (15 sesiones -> 12 de 12)
  const muchas = [];
  for (let w = 0; w < 5; w++) { const lun = X.lunesDe(L - 1) - 7 * w; (w === 4 ? [3, 4, 5] : [0, 1, 2]).forEach((d, i) => muchas.push(ses(lun + d, i))); }
  const tope = ad(muchas, { desde: X.lunesDe(L - 1) - 7 * 4 + 3, hasta: X.lunesDe(L - 1) + 2 });
  assert.equal(tope.planificadas, 12);
  assert.equal(tope.completadas, 12, tope.completadas + " de " + tope.planificadas + " (sin el recorte daria 15 de 12)");
  const prio = ad([ses(L - 7, null), ses(L - 7, 1, { origen: "validada_coach" })]);
  assert.deepEqual([prio.completadas, prio.realizadas, prio.validadas], [1, 1, 0]);
});

await test("8. duplicadas: doble envio y dia_idx nulo del mismo entrenamiento cuentan una vez", () => {
  assert.equal(ad([ses(L - 7, 0), ses(L - 7, 0)]).completadas, 1, "doble envio");
  assert.equal(ad([ses(L - 7, 0), ses(L - 7, null)]).completadas, 1, "dia_idx nulo + dia_idx 0 el mismo dia");
  assert.equal(ad([ses(L - 7, null), ses(L - 6, null)]).completadas, 2, "dia_idx nulo en dias distintos sigue contando");
  assert.equal(ad([ses(L - 7, 0), ses(L - 7, 1)]).completadas, 2, "dos dias de rutina el mismo dia: dos");
});

await test("9. historial sin datos de ciclo (ciclo nulo o ausente) cuenta normalmente", () => {
  const r = ad([ses(L - 7, 0, { ciclo: null }), Object.assign(ses(L - 6, 1), { ciclo: undefined })]);
  assert.equal(r.completadas, 2);
});

await test("10. coherencia: Dashboard y Progreso salen de la MISMA funcion con la misma rutina y dan el mismo numero", () => {
  const rutina = rut();
  const sesiones = [ses(L - 7, 0), ses(L - 6, 1), ses(L - 6, 1), ses(L - 2, 2), ses(L, 0)];
  const base = X.adherencia({ rutina, sesiones, alumnoId: "a", desde: L - 7, hasta: L - 1 });
  // Dashboard: semana pasada completa
  const dash = X.adherenciaSemanalAlumno({ id: "a" }, "activo", rutina, sesiones, X.semanasDashboard(HOY), false);
  assert.equal(dash.previaCompleta.pct, base.pct);
  assert.equal(dash.previaCompleta.completadas, base.completadas);
  // Progreso: mismo rango personalizado
  const prog = X.buildCoachProgresoModel({ alumnos: [{ id: "a", nombre: "A" }], sesionesGlobales: sesiones, progresoGlobal: {}, rutinasSBEntrenador: [rutina],
    allEx: [], periodId: "custom", periodCustom: { desde: L - 7, hasta: L - 1 }, hoy: HOY, lang: "es" });
  const fila = prog.adherenciaRows.find((x) => x.id === "a");
  assert.deepEqual([fila.p, fila.completed, fila.planned], [base.pct, base.completadas, base.planificadas]);
  // la ficha y la busqueda muestran OTRA metrica (semana de la rutina): se rotulan distinto y la busqueda cuenta solo sesiones completadas de la rutina
  const search = X.buildCoachGlobalSearchData({ sessionData: { role: "entrenador" }, alumnosActivosLimpios: [{ id: "a", nombre: "A" }],
    sesionesGlobalesLimpias: sesiones.concat([ses(L - 1, 0, { rutina_id: "otra", rutina_nombre: "Otra" }), ses(L - 1, 1, { estado: "pendiente" })]),
    rutinasSBEntrenadorLimpias: [rutina], allEx: [], coachAlumnoCategoria: () => "activo", getRutinaAsignadaAlumno: () => rutina,
    progresoGlobalLimpio: {}, completedDays: [], currentWeek: 0 });
  assert.equal(search.alumnos[0].sesionesCompletadas, sesiones.length, "sin pendientes ni otra rutina");
  // rutina asignada sin id: 0 sesiones (no se cuentan todas las del alumno)
  const sinId = X.buildCoachGlobalSearchData({ sessionData: { role: "entrenador" }, alumnosActivosLimpios: [{ id: "a", nombre: "A" }],
    sesionesGlobalesLimpias: sesiones, rutinasSBEntrenadorLimpias: [], allEx: [], coachAlumnoCategoria: () => "activo",
    getRutinaAsignadaAlumno: () => Object.assign({}, rutina, { id: null }), progresoGlobalLimpio: {}, completedDays: [], currentWeek: 0 });
  assert.equal(sinId.alumnos[0].sesionesCompletadas, 0);
  assert.match(read("components/coach/coachDashboardModelo.js"), /adherenciaSemanalAlumno/);
  assert.match(read("components/coachProgresoMetrics.js"), /return adherencia\(\{/);
});

await test("11. la regla esta documentada una sola vez en el nucleo (tope por semana, dia_idx nulo, legado y semana en curso)", () => {
  const src = read("lib/metricas/adherencia.js");
  for (const re of [/tope POR SEMANA: cada semana de calendario/, /dia_idx nulo/, /Legado sin\s+\/\/\s+rutina_id|rutina_id: solo cuenta si se creo despues/, /La semana en curso cuenta contra la meta semanal completa/]) {
    assert.match(src, re);
  }
});

console.log("\n" + count + " pruebas OK");
