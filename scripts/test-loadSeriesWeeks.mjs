// Regresion: «Evolucion de carga» reparte por la semana REGISTRADA (progreso.semana, 0-based), separa ciclos y rutinas,
// y no depende de que las sesiones caigan en semanas calendario consecutivas. Datos ficticios.
import assert from "node:assert/strict";
import test from "node:test";
import { buildCoachProgresoModel, buildLoadSeries, progressRowWeekIndex } from "../components/coachProgresoMetrics.js";

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
test("App.jsx: la consulta global de progreso pide ciclo SIN rutina_id (otras metricas intactas) y reintenta sin ciclo si la columna falla", async () => {
  const { readFileSync } = await import("node:fs");
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /progreso\?alumno_id=in\.\(' \+ idsStr \+ '\)&select=alumno_id,ejercicio_id,kg,reps,fecha,semana,ciclo&order=created_at\.desc&limit=3000/);
  assert.match(app, /if\(!Array\.isArray\(results\[1\]\)\) results\[1\] = await sbFetch\('progreso\?alumno_id=in\.\(' \+ idsStr \+ '\)&select=alumno_id,ejercicio_id,kg,reps,fecha,semana&order/);
  assert.doesNotMatch(app, /progreso\?alumno_id=in[^\n]*rutina_id/);
});
