// D7.3 (C-4 / C-5): una sola regla de volumen de carga externa en entrenador, alumno y resumen de la sesion.
//
//   node scripts/test-d7-3Volumen.mjs
//
// Regla: volumen = Σ kg × reps de cada serie con kg > 0 y reps > 0 (peso REGISTRADO), sin ejercicios por tiempo (reps = segundos),
// incluidos personalizados y lastre en peso corporal (lib/metricas/volumen.js + tipoCarga.js). Funciones reales, datos ficticios.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { volumenDeSerie, volumenEnRango, compararVolumen } from "../lib/metricas/volumen.js";
import { eventosPR } from "../lib/metricas/pr.js";
import { indiceEjerciciosPorTiempo } from "../lib/metricas/tipoCarga.js";
import { diaLocal, lunesDe } from "../lib/metricas/fechas.js";
import { exerciseHasTimeTarget, calculateSetVolume, calculateSetsVolume, calculateWorkoutVolume } from "../lib/workoutSession.js";
import { computeTrainingVolume } from "../lib/trainingVolume.js";
import { rowVolumeKg, buildWeeklyVolumeModel } from "../components/student-progress/progressMetrics.js";
import { buildCoachProgresoModel } from "../components/coachProgresoMetrics.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const NOW = new Date(2026, 10, 2, 12); // lunes 2/11/2026
const HOY = diaLocal(NOW);
const fechaDe = (dia) => { const d = new Date(NOW); d.setDate(d.getDate() - (HOY - dia)); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const serie = (ex, kg, reps, dia, extra) => Object.assign({ ejercicio_id: ex, kg, reps, fecha: fechaDe(dia == null ? HOY : dia) }, extra || {});

// caso de referencia (un dia): antes 4 cifras distintas (1840 / 1000 / 2290 / 2290), ahora 1840 en todas
const RUTINA = { id: "r", days: [{ exercises: [
  { id: "sq", reps: "5" }, { id: "custom_x", reps: "10" }, { id: "pu", reps: "8" }, { id: "plank", reps: "45s" }, { id: "kuohp", reps: "10" }, { id: "lunge", reps: "10 reps" },
] }] };
const REF = [serie("sq", 100, 5), serie("sq", 100, 5), serie("custom_x", 40, 10), serie("pu", 10, 8), serie("plank", 10, 45), serie("kuohp", 20, 10), serie("lunge", 16, 10)];
const IDX = indiceEjerciciosPorTiempo([], [RUTINA]);

await test("1-2. peso x reps con cargas distintas: Σ kg x reps de cada serie (peso registrado)", () => {
  assert.equal(volumenDeSerie(serie("sq", 100, 5)), 500);
  assert.equal(volumenEnRango([serie("sq", 100, 5), serie("sq", 110, 3), serie("sq", 90, 8)], {}).total, 500 + 330 + 720);
  assert.equal(calculateSetsVolume([{ kg: 100, reps: 5 }, { kg: "110", reps: "3" }]), 830);
});

await test("3. ejercicios personalizados con registros validos cuentan tambien en la tarjeta del alumno (antes excluidos)", () => {
  const m = computeTrainingVolume([serie("custom_x", 40, 10, HOY - 1), serie("custom_x", 40, 10, HOY - 2)], { today: HOY });
  assert.equal(m.currentTotal, 800);
});

await test("4. peso corporal: el lastre registrado cuenta; sin kg no se inventa nada", () => {
  const m = computeTrainingVolume([serie("pu", 10, 8, HOY - 1), serie("pu", 0, 12, HOY - 2)], { today: HOY });
  assert.equal(m.currentTotal, 80, "antes 0: dominadas excluidas como peso corporal");
  assert.equal(volumenDeSerie(serie("pu", 0, 12)), 0);
});

await test("5. ejercicios por tiempo: nunca kg x segundos (resumen de la sesion y progreso del alumno); «10 reps» no es tiempo", () => {
  assert.equal(exerciseHasTimeTarget({ reps: "45s" }), true);
  assert.equal(exerciseHasTimeTarget({ reps: "30 seg" }), true);
  for (const r of ["10 reps", "máx reps", "3 series", "10 alternos", "8-10"]) assert.equal(exerciseHasTimeTarget({ reps: r }), false, r);
  // resumen de la sesion: la plancha (45 s) no suma
  const progress = { plank: { sets: [{ kg: 10, reps: 45, date: fechaDe(HOY) }] }, sq: { sets: [{ kg: 100, reps: 5, date: fechaDe(HOY) }] } };
  assert.equal(calculateWorkoutVolume([{ id: "plank", reps: "45s" }, { id: "sq", reps: "5" }], progress, fechaDe(HOY)), 500);
  // progreso del alumno
  assert.equal(rowVolumeKg(serie("plank", 10, 45), IDX), 0);
  // un "10 reps" en la rutina de OTRO alumno ya no borra el volumen ni los PR de ese ejercicio para todos (indice global del entrenador)
  const idxOtro = indiceEjerciciosPorTiempo([], [{ days: [{ exercises: [{ id: "sq", reps: "10 reps" }] }] }]);
  assert.equal(volumenEnRango([serie("sq", 100, 5)], { indiceTiempo: idxOtro }).total, 500);
  // y tampoco oculta sus PR (antes 0 eventos): los PR se calculan en el momento, no se borra ni se sobrescribe nada
  assert.equal(eventosPR([serie("sq", 100, 5, HOY - 7), serie("sq", 110, 5)], { indiceTiempo: idxOtro }).length, 1);
});

await test("6. registros incompletos: kg 0, reps 0, vacios o kg negativo no suman (antes el resumen restaba)", () => {
  assert.equal(calculateSetVolume({ kg: "-5", reps: 10 }), 0);
  assert.equal(calculateSetVolume({ kg: 50, reps: 0 }), 0);
  assert.equal(calculateSetsVolume([{ kg: "", reps: 10 }, { kg: 50, reps: 10 }]), 500);
  assert.equal(rowVolumeKg({ ejercicio_id: "sq", kg: "-5", reps: 10 }), 0);
});

// ---- entrenador: «Volumen por semana» del bloque vigente ----
const alumnos = [{ id: "a", nombre: "A" }];
function modelo(rows, datos, periodId, periodCustom) {
  const rutina = { id: "r", alumno_id: "a", nombre: "R", created_at: "2026-09-01T12:00:00Z", datos: Object.assign({ days: [{ exercises: [{ id: "sq", reps: "10" }] }] }, datos || {}) };
  const sesiones = [{ alumno_id: "a", rutina_id: "r", fecha: fechaDe(HOY - 2), created_at: new Date(2026, 9, 31, 10).toISOString(), semana: 2, dia_idx: 0, ciclo: rutina.datos.ciclo_actual || 1 }];
  return buildCoachProgresoModel({ alumnos, sesionesGlobales: sesiones, progresoGlobal: { a: rows }, rutinasSBEntrenador: [rutina], allEx: [], alumnoSel: "a", hoy: HOY, periodId: periodId || "semanas4", periodCustom, lang: "es" });
}

await test("7. reinicio de SEMANA: «Volumen por semana» agrupa por semana de la rutina y no suma el intento descartado (antes Semana 1 = 0)", () => {
  const datos = { semana_activa: 2, ciclo_actual: 2, ciclo_base: 1, ciclos_meta: [{ ciclo: 2, tipo: "semana", semana_inicio: 2, desde_ciclo: 1, at: "2026-10-27T10:00:00Z" }] };
  const rows = [
    serie("sq", 100, 10, HOY - 16, { semana: 0, ciclo: 1 }),  // Semana 1 (dos semanas antes: la Semana 2 llevo mas de una semana)
    serie("sq", 100, 10, HOY - 7, { semana: 1, ciclo: 1 }),   // Semana 2, intento anterior (reiniciado)
    serie("sq", 120, 10, HOY - 2, { semana: 1, ciclo: 2 }),   // Semana 2, intento vigente
  ];
  const m = modelo(rows, datos);
  assert.deepEqual(m.volBars.map((b) => b.v), [1000, 1200, 0, 0]);
});

await test("7b. el periodo elegido no recorta la tarjeta del bloque (antes con 7 dias desaparecia la Semana 3)", () => {
  const rows = [serie("sq", 100, 10, HOY - 20, { semana: 0 }), serie("sq", 110, 10, HOY - 13, { semana: 1 }), serie("sq", 120, 10, HOY - 6, { semana: 2 })];
  const largo = modelo(rows, { semana_activa: 3 }, "semanas4").volBars.map((b) => b.v);
  const corto = modelo(rows, { semana_activa: 3 }, "custom", { desde: HOY - 6, hasta: HOY }).volBars.map((b) => b.v);
  assert.deepEqual(largo, [1000, 1100, 1200, 0]);
  assert.deepEqual(corto, largo);
});

await test("7c. `progreso` sin rutina_id: series de una rutina ANTERIOR con los mismos ejercicios no entran en el bloque vigente", () => {
  const anteriores = [0, 1, 2, 3].map((w) => serie("sq", 100, 8, HOY - 90 + w * 7, { semana: w }));
  const actuales = [serie("sq", 100, 10, HOY - 9, { semana: 0 }), serie("sq", 100, 10, HOY - 2, { semana: 1 })];
  const m = modelo(anteriores.concat(actuales), { semana_activa: 2 });
  assert.deepEqual(m.volBars.map((b) => b.v), [1000, 1000, 0, 0]);
});

await test("8-9. reinicio de RUTINA y ciclos anteriores: el volumen de un periodo de calendario conserva el historial (no se pierde ni duplica)", () => {
  const rows = [serie("sq", 100, 10, HOY - 10, { ciclo: 1 }), serie("sq", 80, 10, HOY - 3, { ciclo: 2 })];
  assert.equal(volumenEnRango(rows, { desde: HOY - 13, hasta: HOY }).total, 1800, "ciclo 1 + ciclo 2, una vez cada serie");
  const m = computeTrainingVolume(rows, { today: HOY });
  assert.equal(m.currentTotal, 1800);
});

await test("10-11. comparacion del alumno: mismo tramo, solo ejercicios comunes y sin % sin base (antes -67 % un lunes, +100 % inventado, mezcla de rutinas)", () => {
  const lun = lunesDe(HOY); // HOY es lunes
  const sb = (ex, kg, reps, dia) => ({ ejercicio_id: ex, kg, reps, fecha: fechaDe(dia) });
  // mismo ritmo: lunes de hoy contra lunes pasado (antes se comparaba contra la semana pasada COMPLETA)
  const ritmo = [sb("sq", 100, 10, lun), sb("sq", 100, 10, lun - 7), sb("sq", 100, 10, lun - 6), sb("sq", 100, 10, lun - 5)];
  const m1 = buildWeeklyVolumeModel({}, ritmo, [], NOW);
  assert.notEqual(m1.deltaPct, -67);
  // base 0 la semana pasada: sin % (antes +100 %)
  const m2 = buildWeeklyVolumeModel({}, [sb("sq", 100, 10, lun)], [], NOW);
  assert.equal(m2.deltaPct, null);
  // cambio de rutina (bp -> sq): no se compara un ejercicio contra otro
  const m3 = buildWeeklyVolumeModel({}, [sb("sq", 150, 10, lun), sb("bp", 100, 10, lun - 7)], [], NOW);
  assert.equal(m3.deltaPct, null);
  // comparacion valida: mismos ejercicios, 2+ dias en cada tramo, mismo largo
  const cmp = compararVolumen([sb("sq", 100, 10, HOY - 1), sb("sq", 100, 10, HOY), sb("sq", 50, 10, HOY - 8), sb("sq", 50, 10, HOY - 7)], { desde: HOY - 1, hasta: HOY }, { desde: HOY - 8, hasta: HOY - 7 });
  assert.equal(cmp.pct, 100);
  // el % del alumno es un entero (sin decimales en pantalla)
  const lun2 = lunesDe(HOY + 3);
  const NOW2 = new Date(NOW); NOW2.setDate(NOW2.getDate() + 3); // jueves
  const sb2 = (kg, reps, dia) => ({ ejercicio_id: "sq", kg, reps, fecha: fechaDe(dia) });
  const m4 = buildWeeklyVolumeModel({}, [sb2(100, 5, lun2), sb2(100, 7, lun2 + 2), sb2(100, 6, lun2 - 7), sb2(100, 5, lun2 - 5)], [], NOW2);
  assert.equal(m4.deltaPct, 9);
});

await test("12. coherencia: entrenador, tarjeta y progreso del alumno y resumen de la sesion dan 1840 para el caso de referencia", () => {
  const entrenador = volumenEnRango(REF, { indiceTiempo: IDX }).total;
  assert.equal(entrenador, 1840);
  // tarjeta del alumno (antes 1000)
  const card = computeTrainingVolume(REF.map((r) => Object.assign({}, r, { fecha: fechaDe(HOY - 1) })).concat([serie("sq", 1, 1, HOY - 2)]), {
    today: HOY, routineExerciseDefs: { plank: [{ id: "plank", reps: "45s" }] },
  });
  assert.equal(card.currentTotal - 1, 1840);
  // progreso del alumno (antes 2290)
  assert.equal(REF.reduce((a, r) => a + rowVolumeKg(r, IDX), 0), 1840);
  // resumen de la sesion (antes 2290)
  const progress = {};
  REF.forEach((r) => { (progress[r.ejercicio_id] = progress[r.ejercicio_id] || { sets: [] }).sets.push({ kg: r.kg, reps: r.reps, date: r.fecha }); });
  assert.equal(calculateWorkoutVolume(RUTINA.days[0].exercises, progress, fechaDe(HOY)), 1840);
});

console.log("\n" + count + " pruebas OK");
