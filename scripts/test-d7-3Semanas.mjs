// D7.3 (cierre): «Volumen por semana» y «Volumen por patrón» usan la MISMA semana de la rutina.
//
//   node scripts/test-d7-3Semanas.mjs
//
// Antes: las barras agrupaban por progreso.semana (semana de la rutina, bloque del ciclo vigente) y el patrón sumaba una ventana de
// calendario lunes-domingo deducida de la ultima sesion (y recortada por el periodo elegido). Las dos tarjetas decian «Semana N» y podian
// mostrar cifras distintas para la misma semana (5.000 kg contra 1.300 kg). Ahora: misma funcion de semana, mismo bloque, y la semana actual
// es la semana_activa de la rutina (respeta reinicios y semanas completas). Las barras (calculo aprobado) no cambian.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { buildCoachProgresoModel } from "../components/coachProgresoMetrics.js";
import { buildReinicioDatos, TIPO_REINICIO } from "../lib/rutinaCiclo.js";
import { diaLocal } from "../lib/metricas/fechas.js";

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

const NOW_MS = new Date(2026, 10, 4, 12).getTime(); // miercoles 4/11/2026
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW_MS); else super(...a); }
  static now() { return NOW_MS; }
}
globalThis.Date = FixedDate;
const HOY = diaLocal(new Date());

const AL = "al-1";
const allEx = [{ id: "sq", name: "Sentadilla", pattern: "rodilla" }, { id: "bp", name: "Press banca", pattern: "empuje" }];
const dias = [{ exercises: [{ id: "sq" }, { id: "bp" }] }, { exercises: [{ id: "sq" }] }];
const rutina = (datos) => ({ id: "r1", alumno_id: AL, created_at: "2026-09-01T00:00:00", datos: Object.assign({ days: dias }, datos) });
const f = (d, m) => d + "/" + m + "/2026";
const iso = (d, m) => "2026-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0") + "T10:00:00";
// sesion (semana 1-based) y series (progreso.semana 0-based) del mismo dia
const ses = (d, m, semana, ciclo) => Object.assign({ alumno_id: AL, rutina_id: "r1", fecha: f(d, m), created_at: iso(d, m), semana }, ciclo != null ? { ciclo } : {});
const serie = (d, m, semana, ex, kg, reps, ciclo) => Object.assign({ alumno_id: AL, ejercicio_id: ex, fecha: f(d, m), kg: String(kg), reps: String(reps), semana: semana - 1 }, ciclo != null ? { ciclo } : {});

const build = (rut, sesiones, progreso, over) => buildCoachProgresoModel(Object.assign({
  alumnos: [{ id: AL, nombre: "Alumno" }], sesionesGlobales: sesiones, progresoGlobal: { [AL]: progreso }, rutinasSBEntrenador: [rut],
  allEx, periodId: "semanas4", alumnoSel: AL, ejercicioSelId: "sq", lang: "es",
}, over || {}));
const barras = (m) => m.volBars.map((b) => b.v);
const barraActual = (m) => m.volBars[m.currentRoutineWeekIndex].v;

test("1. semana de la rutina repartida en dos semanas de calendario: el patrón suma la misma semana que la barra resaltada", () => {
  // Semana 4 de la rutina: jueves 22/10 y martes 27/10 (dos semanas de calendario distintas)
  const sesiones = [ses(1, 10, 1), ses(6, 10, 1), ses(8, 10, 2), ses(13, 10, 2), ses(15, 10, 3), ses(20, 10, 3), ses(22, 10, 4), ses(27, 10, 4)];
  const progreso = [serie(22, 10, 4, "sq", 100, 5), serie(22, 10, 4, "bp", 60, 5), serie(27, 10, 4, "sq", 100, 5), serie(27, 10, 4, "sq", 100, 5)];
  const m = build(rutina({ semana_activa: 4 }), sesiones, progreso);
  assert.equal(m.currentRoutineWeekIndex, 3);
  assert.deepEqual(barras(m), [0, 0, 0, 1800]);
  assert.equal(m.patronTotalVol, 1800); // antes 1000 (solo la semana de calendario del 27/10)
  assert.equal(m.patronPatterns.find((p) => p.key === "rodilla").vol, 1500);
  assert.equal(m.patronPatterns.find((p) => p.key === "empuje").vol, 300);
});

test("2. reinicio de semana: semana actual = semana_activa del ciclo nuevo; ni barras ni patrón mezclan el ciclo anterior", () => {
  // ciclo 1: semanas 1-3. El lunes 26/10 se reinicia a la semana 2 (ciclo 2) y el alumno la entrena el mismo calendario.
  const datos1 = { semana_activa: 3 };
  const datos2 = buildReinicioDatos(datos1, { tipo: TIPO_REINICIO.SEMANA, semana: 2, nowIso: "2026-10-26T09:00:00Z" });
  assert.deepEqual([datos2.ciclo_actual, datos2.semana_activa], [2, 2]);
  const sesiones = [ses(5, 10, 1, 1), ses(12, 10, 2, 1), ses(26, 10, 3, 1), ses(28, 10, 2, 2), ses(29, 10, 2, 2)];
  const progreso = [
    serie(5, 10, 1, "sq", 80, 5, 1),   // ciclo 1 semana 1: vigente (la semana 1 no se reinicio)
    serie(12, 10, 2, "sq", 85, 5, 1),  // ciclo 1 semana 2: reemplazada por el ciclo 2
    serie(26, 10, 3, "sq", 90, 5, 1),  // ciclo 1 semana 3: fuera del bloque vigente (misma semana de calendario que el reinicio)
    serie(28, 10, 2, "sq", 70, 5, 2),
    serie(29, 10, 2, "bp", 50, 5, 2),
  ];
  const m = build(rutina(datos2), sesiones, progreso);
  assert.equal(m.currentRoutineWeekIndex, 1);
  assert.deepEqual(barras(m), [400, 600, 0, 0]);
  assert.equal(m.patronTotalVol, barraActual(m)); // (ya era correcto antes: protege contra regresiones)
  assert.equal(m.patronTotalVol, 600);
});

test("3. reinicio de rutina: ciclo nuevo desde la semana 1; el historial anterior no entra en barras ni patrón", () => {
  const datos2 = buildReinicioDatos({ semana_activa: 4 }, { tipo: TIPO_REINICIO.RUTINA, nowIso: "2026-10-26T09:00:00Z" });
  const sesiones = [ses(19, 10, 4, 1), ses(21, 10, 4, 1), ses(27, 10, 1, 2), ses(29, 10, 1, 2)];
  const progreso = [serie(19, 10, 4, "sq", 100, 5, 1), serie(21, 10, 4, "sq", 100, 5, 1), serie(27, 10, 1, "sq", 60, 5, 2), serie(29, 10, 1, "sq", 60, 5, 2)];
  const m = build(rutina(datos2), sesiones, progreso);
  assert.equal(m.currentRoutineWeekIndex, 0);
  assert.deepEqual(barras(m), [600, 0, 0, 0]);
  assert.equal(m.patronTotalVol, 600);
});

test("4. semana activa adelantada a los registros (semana completa que ya avanzo): la semana actual no tiene volumen en ninguna de las dos", () => {
  const sesiones = [ses(19, 10, 1), ses(21, 10, 1), ses(26, 10, 2), ses(28, 10, 2)];
  const progreso = [serie(19, 10, 1, "sq", 90, 5), serie(21, 10, 1, "sq", 90, 5), serie(26, 10, 2, "sq", 95, 5), serie(28, 10, 2, "sq", 95, 5)];
  const m = build(rutina({ semana_activa: 3 }), sesiones, progreso);
  assert.equal(m.currentRoutineWeekIndex, 2); // antes 1 (se deducia de la ultima sesion)
  assert.equal(m.semanaDetectada, 3);
  assert.deepEqual(barras(m), [900, 950, 0, 0]);
  assert.equal(m.patronTotalVol, 0);
});

test("5. el periodo elegido no cambia la semana de la rutina: barras y patrón iguales en 4 semanas, 7 dias y todo el historial", () => {
  const sesiones = [ses(13, 10, 3), ses(15, 10, 3), ses(27, 10, 4), ses(3, 11, 4)];
  const progreso = [serie(13, 10, 3, "sq", 90, 5), serie(15, 10, 3, "sq", 90, 5), serie(27, 10, 4, "sq", 100, 5), serie(3, 11, 4, "sq", 100, 5)];
  const r = rutina({ semana_activa: 4 });
  const ms = [build(r, sesiones, progreso), build(r, sesiones, progreso, { periodId: "custom", periodCustom: { desde: HOY - 6, hasta: HOY } }), build(r, sesiones, progreso, { periodId: "todo" })];
  ms.forEach((m) => {
    assert.deepEqual(barras(m), [0, 0, 900, 1000]);
    assert.equal(m.patronTotalVol, 1000); // antes con 7 dias el patron quedaba en 0 (recorte por semana del periodo)
  });
});

test("6. series sin semana: la misma ventana de respaldo en las dos tarjetas", () => {
  const sesiones = [ses(2, 11, 4), ses(3, 11, 4)];
  const sinSemana = (d, m, kg) => ({ alumno_id: AL, ejercicio_id: "sq", fecha: f(d, m), kg: String(kg), reps: "5" });
  const m = build(rutina({ semana_activa: 4 }), sesiones, [sinSemana(2, 11, 100), sinSemana(3, 11, 100)]);
  assert.equal(barraActual(m), 1000);
  assert.equal(m.patronTotalVol, 1000);
});

test("7. sin semana_activa (rutinas anteriores): la semana actual se sigue deduciendo de la ultima sesion", () => {
  const sesiones = [ses(20, 10, 1), ses(27, 10, 2)];
  const m = build(rutina({}), sesiones, [serie(20, 10, 1, "sq", 80, 5), serie(27, 10, 2, "sq", 80, 5)]);
  assert.equal(m.currentRoutineWeekIndex, 1);
  assert.deepEqual(barras(m), [400, 400, 0, 0]);
  assert.equal(m.patronTotalVol, 400);
});

console.log("\n" + count + " tests OK");
