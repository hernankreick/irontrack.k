// Regresion: «Evolucion de carga» reparte por la semana REGISTRADA (progreso.semana, 0-based), separa ciclos y rutinas,
// y no depende de que las sesiones caigan en semanas calendario consecutivas. Datos ficticios.
import assert from "node:assert/strict";
import test from "node:test";
import { buildCoachProgresoModel, buildLoadSeries, progressRowWeekIndex } from "../components/coachProgresoMetrics.js";
import { fetchAllPages } from "../lib/progressPaging.js";

const AID = "alu1";
const EX = "hip";
const RID = "r1";
const rutina = (ciclo) => ({
  id: RID, alumno_id: AID, created_at: "2026-09-01T00:00:00Z",
  datos: { ciclo_actual: ciclo, days: [{ label: "Día 1", warmup: [], exercises: [{ id: EX }] }] },
});
const row = (fecha, kg, semana, extra) => Object.assign({ alumno_id: AID, ejercicio_id: EX, kg, reps: 8, fecha, semana }, extra || {});
const ses = (iso, semana) => ({ alumno_id: AID, rutina_id: RID, created_at: iso, semana });
function serie(rows, sessions, ciclo) {
  return buildCoachProgresoModel({
    alumnos: [{ id: AID, nombre: "Ana" }], sesionesGlobales: sessions || [], progresoGlobal: { [AID]: rows },
    rutinasSBEntrenador: [rutina(ciclo || 1)], allEx: [{ id: EX, name: "Hip thrust" }],
    periodId: "semanas4", alumnoSel: AID, ejercicioSelId: EX, diaIdx: 0, lang: "es",
  }).chartSeries;
}

test("A/G: semanas consecutivas, semana 0-based como en produccion (Semana 1 = 0)", () => {
  assert.deepEqual(serie([row("2026-10-07", 100, 0), row("2026-10-14", 120, 1)], [ses("2026-10-14T12:00:00Z", 2)]), [100, 120, null, null]);
});
test("B: semanas de rutina no consecutivas en el calendario conservan la Semana 1", () => {
  assert.deepEqual(serie([row("2026-10-07", 100, 0), row("2026-10-21", 120, 1)], [ses("2026-10-21T12:00:00Z", 2)]), [100, 120, null, null]);
});
test("C: Semana 1 y 2 de la rutina dentro de la misma semana calendario", () => {
  assert.deepEqual(serie([row("2026-10-14", 100, 0), row("2026-10-16", 120, 1)], [ses("2026-10-16T12:00:00Z", 2)]), [100, 120, null, null]);
});
test("D: filas sin semana se reparten por fecha (comportamiento anterior)", () => {
  assert.deepEqual(serie([row("2026-10-07", 100, null), row("2026-10-14", 120, "")], [ses("2026-10-14T12:00:00Z", 2)]), [100, 120, null, null]);
});
test("E: fecha dd/mm/yyyy con semana registrada y sin ella", () => {
  assert.deepEqual(serie([row("07/10/2026", 100, 0), row("14/10/2026", 120, undefined)], [ses("2026-10-14T12:00:00Z", 2)]), [100, 120, null, null]);
});
test("F: kg se conserva (maximo por semana, decimales); kg 0/invalido no cuenta", () => {
  const r = [row("2026-10-07", "100", 0), row("2026-10-08", "102.5", 0), row("2026-10-09", "0", 0), row("2026-10-14", "abc", 1), row("2026-10-21", "80", 2)];
  assert.deepEqual(serie(r, [ses("2026-10-21T12:00:00Z", 3)]), [102.5, null, 80, null]);
});
test("reinicio de ciclo: solo el ciclo vigente; las filas del ciclo anterior no se mezclan ni se pierde nada del vigente", () => {
  const r = [row("2026-08-05", 90, 0, { ciclo: 1 }), row("2026-08-12", 95, 1, { ciclo: 1 }), row("2026-10-07", 100, 0, { ciclo: 2 }), row("2026-10-14", 110, 1, { ciclo: 2 })];
  assert.deepEqual(serie(r, [ses("2026-10-14T12:00:00Z", 2)], 2), [100, 110, null, null]);
  assert.deepEqual(serie(r, [ses("2026-08-12T12:00:00Z", 2)], 1), [90, 95, null, null]);
});
test("filas sin columna ciclo (select antiguo) o ciclo null cuentan como ciclo 1", () => {
  assert.deepEqual(serie([row("2026-10-07", 100, 0, { ciclo: null }), row("2026-10-14", 120, 1)], [ses("2026-10-14T12:00:00Z", 2)], 1), [100, 120, null, null]);
});
test("rutina anterior: una fila con rutina_id distinto no entra", () => {
  assert.deepEqual(serie([row("2026-10-07", 500, 0, { rutina_id: "vieja" }), row("2026-10-07", 100, 0, { rutina_id: RID })], [ses("2026-10-07T12:00:00Z", 1)]), [100, null, null, null]);
});
test("registros incompletos: sin ejercicio, otro ejercicio, semana fuera de rango, sin fecha ni semana no inventan valores", () => {
  const r = [{ alumno_id: AID, kg: 50, semana: 0 }, row("2026-10-07", 60, 0, { ejercicio_id: "otro" }), row(null, 70, null), row("2026-10-07", 80, 9), row("2026-10-07", 90, -1)];
  assert.deepEqual(serie(r, []), [null, null, null, null]);
});
test("semana 0 no se infiere de una ausencia: progressRowWeekIndex", () => {
  assert.equal(progressRowWeekIndex({ semana: null }, 4), null);
  assert.equal(progressRowWeekIndex({}, 4), null);
  assert.equal(progressRowWeekIndex({ semana: "" }, 4), null);
  assert.equal(progressRowWeekIndex({ semana: 0 }, 4), 0);
  assert.equal(progressRowWeekIndex({ semana: "2" }, 4), 2);
  assert.equal(progressRowWeekIndex({ semana: 4 }, 4), null);
  assert.equal(progressRowWeekIndex({ semana: 1.5 }, 4), null);
});
test("buildLoadSeries: sin filas devuelve todo null (nunca 0)", () => {
  assert.deepEqual(buildLoadSeries([], { ejercicioId: EX, weekStarts: [0, 1, 2, 3].map((i) => i * 604800000) }), [null, null, null, null]);
});

// ---- Semana 0 en TODA la seccion Progreso (progressRowMatchesRoutine), ciclos, rutinas y volumen ----
function modelo(rows, sessions, ciclo, extra) {
  return buildCoachProgresoModel(Object.assign({
    alumnos: [{ id: AID, nombre: "Ana" }], sesionesGlobales: sessions || [], progresoGlobal: { [AID]: rows },
    rutinasSBEntrenador: [rutina(ciclo || 1)], allEx: [{ id: EX, name: "Hip thrust" }],
    periodId: "semanas8", alumnoSel: AID, ejercicioSelId: EX, diaIdx: 0, lang: "es",
  }, extra || {}));
}
const hoy = new Date();
const hace = (n) => { const d = new Date(hoy); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const volTotal = (m) => m.volBars.reduce((a, b) => a + (b.v || 0), 0);

test("semana 0 (Semana 1) entra al volumen aunque no sea de la semana calendario actual; antes se descartaba", () => {
  // 100 kg x 8 reps registrados hace 20 dias con semana 0 y sin rutina_id (forma del select de produccion)
  const m = modelo([row(hace(20), 100, 0)], [ses(hace(20) + "T12:00:00Z", 1)]);
  assert.equal(volTotal(m), 800);
});
test("semana ausente sigue usando el respaldo por fecha (no se confunde con semana 0)", () => {
  const m = modelo([row(hace(20), 100, null)], []);
  assert.equal(volTotal(m), 0); // fuera de la semana calendario actual: igual que antes
  const m2 = modelo([row(hace(1), 100, "")], []);
  assert.equal(volTotal(m2) >= 0, true);
});
test("ciclo reiniciado: el volumen y la semana detectada no mezclan el ciclo anterior (filas y sesiones con ciclo)", () => {
  const rows = [row(hace(40), 100, 0, { ciclo: 1 }), row(hace(33), 100, 3, { ciclo: 1 }), row(hace(2), 50, 0, { ciclo: 2 })];
  const sessions = [{ alumno_id: AID, rutina_id: RID, created_at: hace(33) + "T12:00:00Z", semana: 4, ciclo: 1 }];
  const m = modelo(rows, sessions, 2);
  assert.equal(volTotal(m), 400); // solo 50 kg x 8 del ciclo 2
  assert.equal(m.semanaDetectada < 4, true); // la sesion de la semana 4 del ciclo 1 no ancla el ciclo 2
});
test("sin columna ciclo (select antiguo): no se filtra por ciclo (limitacion documentada)", () => {
  const m = modelo([row(hace(20), 100, 0)], [], 2);
  assert.equal(volTotal(m), 800);
});
test("rutina anterior: filas con otra rutina_id no suman volumen ni aparecen en la serie", () => {
  const rows = [row(hace(2), 500, 0, { rutina_id: "vieja" }), row(hace(2), 60, 0, { rutina_id: RID })];
  const m = modelo(rows, [ses(hace(2) + "T12:00:00Z", 1)]);
  assert.equal(volTotal(m), 480);
  assert.equal(m.chartSeries[0], 60);
});
test("semanas salteadas: Semana 1 y Semana 3 registradas, Semana 2 sin registro (no 0)", () => {
  const m = modelo([row(hace(30), 100, 0), row(hace(2), 120, 2)], [ses(hace(2) + "T12:00:00Z", 3)]);
  assert.deepEqual(m.chartSeries, [100, null, 120, null]);
});
test("sesiones sin registro de carga: serie vacia (null), sin 0 inventado ni error", () => {
  const m = modelo([], [ses(hace(2) + "T12:00:00Z", 2)]);
  assert.deepEqual(m.chartSeries, [null, null, null, null]);
  assert.equal(m.hasChartData, false);
  assert.equal(volTotal(m), 0);
});

// ---- Recuperacion paginada ----
test("fetchAllPages: una pagina incompleta corta; completa pide la siguiente; respeta maxPages", async () => {
  const calls = [];
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ i }));
  const r1 = await fetchAllPages(async (o, s) => { calls.push([o, s]); return mk(5); }, { pageSize: 10 });
  assert.equal(r1.length, 5); assert.equal(calls.length, 1);
  calls.length = 0;
  const pages = [mk(10), mk(10), mk(3)];
  const r2 = await fetchAllPages(async (o, s) => { calls.push([o, s]); return pages.shift(); }, { pageSize: 10 });
  assert.equal(r2.length, 23); assert.deepEqual(calls, [[0, 10], [10, 10], [20, 10]]);
  const r3 = await fetchAllPages(async () => mk(10), { pageSize: 10, maxPages: 3 });
  assert.equal(r3.length, 30);
});
test("fetchAllPages: error en la 1a pagina => null (reintento); error posterior conserva lo recuperado", async () => {
  assert.equal(await fetchAllPages(async () => null, { pageSize: 10 }), null);
  const pages = [Array.from({ length: 10 }, () => ({})), null];
  const r = await fetchAllPages(async () => pages.shift(), { pageSize: 10 });
  assert.equal(r.length, 10);
});
test("App.jsx + lib/coachHistoryLoader.js: progreso paginado (orden estable created_at,id), ciclo sin rutina_id y reintento sin ciclo", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const lib = readFileSync(new URL("../lib/coachHistoryLoader.js", import.meta.url), "utf8");
  // E0: las columnas viven en el loader; `id` y `created_at` permiten el refresco incremental sin duplicar
  assert.match(lib, /PROGRESO_COLS = "id,alumno_id,ejercicio_id,kg,reps,fecha,semana,created_at"/);
  assert.match(lib, /PROGRESO_COLS_CICLO = PROGRESO_COLS \+ ",ciclo"/);
  assert.match(lib, /if \(fP\.failedFirst\) \{[\s\S]*?cols = PROGRESO_COLS;/, "reintento sin la columna ciclo");
  assert.match(app, /'&order=created_at\.desc,id\.desc&limit=' \+ size \+ '&offset=' \+ offset/);
  assert.match(app, /syncCoachHistory\(\{/);
  assert.doesNotMatch(app, /progreso\?alumno_id=in[^\n]*rutina_id/);
  assert.doesNotMatch(app, /sesiones\?alumno_id=in\.\([^\n]*limit=500/, "sin el tope de 500 sesiones del roster");
});

// ---- Mismo ejercicio en varios dias de la rutina (caso Catalina: Hip thrust "hip" en Dia 1 y Dia 3, ciclo 2) ----
const rutinaDosDias = (ciclo) => ({
  id: RID, alumno_id: AID, created_at: "2026-09-01T00:00:00Z",
  datos: { ciclo_actual: ciclo, days: [
    { label: "Día 1", warmup: [], exercises: [{ id: "hip" }, { id: "sq" }] },
    { label: "Día 2", warmup: [], exercises: [{ id: "sq" }] },
    { label: "Día 3", warmup: [], exercises: [{ id: "dl" }, { id: "hip" }] },
  ] },
});
const filaHip = (fecha, kg, reps, semana) => ({ alumno_id: AID, ejercicio_id: "hip", kg, reps, fecha, semana, ciclo: 2 });
const sesDia = (fecha, semana1, diaIdx, ejercicios, extra) =>
  Object.assign({ alumno_id: AID, rutina_id: RID, fecha, semana: semana1, dia_idx: diaIdx, ejercicios, ciclo: 2, created_at: "2026-10-20T12:00:00Z" }, extra || {});
const catalina = [filaHip("13/10/2026", "125", "6", 0), filaHip("20/10/2026", "120", "4", 1)];
function dia(diaIdx, rows, sessions) {
  const m = buildCoachProgresoModel({
    alumnos: [{ id: AID, nombre: "Ana" }], sesionesGlobales: sessions, progresoGlobal: { [AID]: rows },
    rutinasSBEntrenador: [rutinaDosDias(2)], allEx: [{ id: "hip", name: "Hip thrust" }],
    periodId: "semanas4", alumnoSel: AID, ejercicioSelId: "hip", diaIdx, lang: "es",
  });
  return { serie: m.chartSeries, mixed: m.chartMixedDays };
}

test("Catalina sin sesiones que lo demuestren: 125 y 120 en la serie (maximos del ejercicio en el ciclo 2) y se avisa que puede incluir otro dia", () => {
  assert.deepEqual(dia(0, catalina, []), { serie: [125, 120, null, null], mixed: true });
  assert.deepEqual(dia(2, catalina, []), { serie: [125, 120, null, null], mixed: true });
});
test("sesiones que demuestran Dia 1 en ambas fechas: el Dia 1 muestra 125 y 120 sin aviso; el Dia 3 no recibe esos registros", () => {
  const ses1 = [sesDia("13/10/2026", 1, 0, "hip,sq"), sesDia("20/10/2026", 2, 0, "hip,sq")];
  assert.deepEqual(dia(0, catalina, ses1), { serie: [125, 120, null, null], mixed: false });
  assert.deepEqual(dia(2, catalina, ses1), { serie: [null, null, null, null], mixed: false });
});
test("una fila demostrada del Dia 3 no se atribuye al Dia 1; la otra, sin sesion, se conserva con aviso", () => {
  const ses = [sesDia("13/10/2026", 1, 2, "dl,hip")];
  assert.deepEqual(dia(0, catalina, ses), { serie: [null, 120, null, null], mixed: true });
  assert.deepEqual(dia(2, catalina, ses), { serie: [125, 120, null, null], mixed: true });
});
test("dos sesiones del mismo dia calendario con dias distintos que listan el ejercicio: ambiguo, se conserva y se avisa", () => {
  const ses = [sesDia("13/10/2026", 1, 0, "hip,sq"), sesDia("13/10/2026", 1, 2, "dl,hip")];
  assert.deepEqual(dia(0, [catalina[0]], ses), { serie: [125, null, null, null], mixed: true });
});
test("la sesion debe coincidir en fecha, semana (0-based vs 1-based), ciclo y ejercicio; si no, no demuestra nada", () => {
  const malas = [
    sesDia("14/10/2026", 1, 2, "dl,hip"),          // otra fecha
    sesDia("13/10/2026", 2, 2, "dl,hip"),          // semana 1-based distinta (la fila es semana 0 => 1)
    sesDia("13/10/2026", 1, 2, "dl,sq"),           // no lista el ejercicio
    sesDia("13/10/2026", 1, 2, "dl,hip", { ciclo: 1 }), // ciclo anterior
  ];
  assert.deepEqual(dia(0, [catalina[0]], malas), { serie: [125, null, null, null], mixed: true });
});
test("ejercicio que esta en un solo dia: sin cambios ni aviso", () => {
  const m = buildCoachProgresoModel({
    alumnos: [{ id: AID, nombre: "Ana" }], sesionesGlobales: [], progresoGlobal: { [AID]: [row("2026-10-07", 100, 0, { ciclo: 1 })] },
    rutinasSBEntrenador: [rutina(1)], allEx: [{ id: EX, name: "Hip thrust" }], periodId: "semanas4", alumnoSel: AID, ejercicioSelId: EX, diaIdx: 0, lang: "es",
  });
  assert.equal(m.chartMixedDays, false);
  assert.equal(m.chartSeries[0], 100);
});
test("ciclos reiniciados con el mismo ejercicio en dos dias: el ciclo 1 no entra al ciclo 2", () => {
  const viejas = [Object.assign(filaHip("06/10/2026", "300", "3", 0), { ciclo: 1 })];
  assert.deepEqual(dia(0, catalina.concat(viejas), []).serie, [125, 120, null, null]);
});
test("resolveProgressRowDay: devuelve el dia solo cuando es unico; semana invalida o fecha ausente => null", async () => {
  const { resolveProgressRowDay } = await import("../components/coachProgresoMetrics.js");
  const ses = [sesDia("13/10/2026", 1, 2, "dl,hip")];
  assert.equal(resolveProgressRowDay(catalina[0], ses), 2);
  assert.equal(resolveProgressRowDay(Object.assign({}, catalina[0], { semana: null }), ses), null);
  assert.equal(resolveProgressRowDay(Object.assign({}, catalina[0], { fecha: "" }), ses), null);
  assert.equal(resolveProgressRowDay(catalina[0], []), null);
});

test("dia_idx nulo, vacio, booleano o arreglo NO demuestra el Dia 1 (Number(null) === 0)", () => {
  for (const malo of [null, "", true, [], undefined]) {
    const ses = [sesDia("13/10/2026", 1, malo, "hip,bp")];
    assert.deepEqual(dia(2, [catalina[0]], ses), { serie: [125, null, null, null], mixed: true }, "dia_idx=" + JSON.stringify(malo));
    assert.deepEqual(dia(0, [catalina[0]], ses), { serie: [125, null, null, null], mixed: true });
  }
});
test("fechas con formatos mezclados (fila d/m/yyyy y sesion ISO, o al reves) se comparan igual en cualquier zona horaria", () => {
  const sesIso = [sesDia("2026-10-13", 1, 2, "dl,hip")];
  assert.deepEqual(dia(0, [catalina[0]], sesIso), { serie: [null, null, null, null], mixed: false });
  const filaIso = [Object.assign({}, catalina[0], { fecha: "2026-10-13" })];
  assert.deepEqual(dia(0, filaIso, [sesDia("13/10/2026", 1, 2, "dl,hip")]), { serie: [null, null, null, null], mixed: false });
  assert.deepEqual(dia(2, filaIso, [sesDia("13/10/2026", 1, 2, "dl,hip")]), { serie: [125, null, null, null], mixed: false });
});
