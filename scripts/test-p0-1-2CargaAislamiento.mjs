// P0-1 y P0-2 de la auditoria de estadisticas (correcciones incompletas de #126/#151 y #134/#151).
//
//   node scripts/test-p0-1-2CargaAislamiento.mjs
//
// P0-1: «Evolución de carga» no incluye series de una rutina ANTERIOR. `progreso` no trae rutina_id (forma real del select del
//       entrenador: id, alumno_id, ejercicio_id, kg, reps, fecha, semana, created_at, ciclo): se usa el mismo filtro por fecha de
//       asignacion que «Volumen por semana» (#151) y los mismos criterios de ciclo/bloque.
// P0-2: el indice de ejercicios por tiempo se arma POR ALUMNO (catalogo + rutinas de ese alumno). La configuracion de la rutina de
//       otro alumno no cambia los PR ni el volumen de este. La deteccion de tiempo (#151: "10 reps" no es tiempo) no cambia.
// Funciones reales, datos ficticios, sin red.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { buildCoachProgresoModel, buildLoadSeriesDetailed } from "../components/coachProgresoMetrics.js";
import { diaLocal } from "../lib/metricas/fechas.js";
import { eventosPR, contarPRs } from "../lib/metricas/pr.js";
import { volumenEnRango } from "../lib/metricas/volumen.js";
import { indiceEjerciciosPorTiempo } from "../lib/metricas/tipoCarga.js";

let count = 0;
const fallas = [];
function test(name, fn) {
  try { fn(); count++; console.log("ok -", name); }
  catch (e) { fallas.push(name); console.log("not ok -", name, "\n   ", String(e.message).split("\n").filter(Boolean).slice(0, 6).join("\n    ")); }
}

const NOW = new Date();
const HOY = diaLocal(NOW);
const fechaDe = (dia) => { const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - (HOY - dia)); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const isoDe = (dia) => { const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - (HOY - dia), 12); return d.toISOString(); };
let seq = 0;
// Serie con la forma REAL del select del entrenador (lib/coachHistoryLoader.js PROGRESO_COLS_CICLO): SIN rutina_id.
const serie = (alumno, ex, kg, reps, dia, semana0, ciclo) => {
  const row = { id: "p" + (++seq), alumno_id: alumno, ejercicio_id: ex, kg: String(kg), reps: String(reps), fecha: fechaDe(dia), created_at: isoDe(dia), ciclo: ciclo == null ? 1 : ciclo };
  if (semana0 != null) row.semana = semana0;
  return row;
};
const SIN_RUTINA_ID = (rows) => rows.every((r) => !Object.prototype.hasOwnProperty.call(r, "rutina_id"));

const allEx = [
  { id: "sq", name: "Sentadilla", pattern: "rodilla" },
  { id: "farmer", name: "Farmer walk", pattern: "core" },
];
const build = (p) => buildCoachProgresoModel(Object.assign({ sesionesGlobales: [], allEx, hoy: HOY, lang: "es", periodId: "semanas4" }, p));

// ───────────────────────────────────────── P0-1
const A = "alumno-a";
const ASIGNADA = HOY - 10;
const rutinaNueva = (datos) => ({ id: "r-nueva", alumno_id: A, nombre: "Nueva", created_at: isoDe(ASIGNADA), datos: Object.assign({ semana_activa: 2, days: [{ label: "D1", exercises: [{ id: "sq", reps: "10" }] }] }, datos || {}) });
const rutinaVieja = { id: "r-vieja", alumno_id: A, nombre: "Vieja", created_at: isoDe(HOY - 80), datos: { days: [{ label: "D1", exercises: [{ id: "sq", reps: "5" }] }] } };
// rutina anterior (mismo ejercicio, mismo ciclo 1): semanas 3 y 4 (0-based 2 y 3) con 120 y 125 kg
const VIEJAS = [serie(A, "sq", 120, 5, HOY - 60, 2), serie(A, "sq", 125, 5, HOY - 53, 3)];
// rutina nueva: semanas 1 y 2
const NUEVAS = [serie(A, "sq", 80, 10, HOY - 8, 0), serie(A, "sq", 85, 10, HOY - 1, 1)];
const modeloP01 = (rows, datos, extra) => build(Object.assign({ alumnos: [{ id: A, nombre: "Ana" }], progresoGlobal: { [A]: rows }, rutinasSBEntrenador: [rutinaVieja, rutinaNueva(datos)], alumnoSel: A, ejercicioSelId: "sq", diaIdx: 0 }, extra || {}));

test("P0-1. fixtures con la forma real de produccion: las series no traen rutina_id", () => {
  assert.ok(SIN_RUTINA_ID(VIEJAS.concat(NUEVAS)));
});

test("P0-1. «Evolución de carga» no muestra en semanas futuras las cargas de la rutina anterior (antes [80, 85, 120, 125])", () => {
  const m = modeloP01(VIEJAS.concat(NUEVAS));
  assert.deepEqual(m.chartSeries, [80, 85, null, null]);
  assert.equal(m.hasChartData, true);
});

test("P0-1. el gráfico y «Volumen por semana» usan el mismo bloque: semanas con carga = semanas con volumen", () => {
  const m = modeloP01(VIEJAS.concat(NUEVAS));
  assert.deepEqual(m.volBars.map((b) => b.v), [800, 850, 0, 0]); // sin cambios respecto de #151
  assert.deepEqual(m.chartSeries.map((v) => v != null), m.volBars.map((b) => b.v > 0));
});

test("P0-1. una serie del mismo día de la asignación sí entra (solo se excluye lo ANTERIOR a la asignación)", () => {
  const m = modeloP01(VIEJAS.concat([serie(A, "sq", 70, 10, ASIGNADA, 0)]));
  assert.deepEqual(m.chartSeries, [70, null, null, null]);
  assert.deepEqual(m.volBars.map((b) => b.v), [700, 0, 0, 0]);
});

test("P0-1. series sin semana (respaldo por fecha) anteriores a la asignación tampoco entran", () => {
  const sinSemana = [serie(A, "sq", 150, 5, ASIGNADA - 3, null)];
  const m = modeloP01(sinSemana.concat(NUEVAS));
  assert.deepEqual(m.chartSeries, [80, 85, null, null]);
});

test("P0-1. reinicio de rutina (ciclo 2): el gráfico sigue sin mezclar el ciclo anterior de la MISMA rutina", () => {
  const ciclo1 = [serie(A, "sq", 90, 10, HOY - 7, 0, 1), serie(A, "sq", 95, 10, HOY - 6, 1, 1)];
  const ciclo2 = [serie(A, "sq", 82.5, 10, HOY - 2, 0, 2)];
  const m = modeloP01(VIEJAS.concat(ciclo1, ciclo2), { semana_activa: 1, ciclo_actual: 2, ciclo_base: 2, ciclos_meta: [{ ciclo: 2, tipo: "rutina", semana_inicio: 1, desde_ciclo: 1, at: isoDe(HOY - 3) }] });
  assert.deepEqual(m.chartSeries, [82.5, null, null, null]);
  assert.deepEqual(m.volBars.map((b) => b.v), [825, 0, 0, 0]);
});

test("P0-1. el historial no se toca: PRs, récords e historial por ejercicio siguen incluyendo la rutina anterior", () => {
  const rows = VIEJAS.concat(NUEVAS);
  const m = modeloP01(rows);
  // 125 supera a 120 (hace 53 dias): sigue siendo un evento PR del historial completo
  assert.ok(m.prsRecientes.some((p) => p.kg === 125 && p.kgAnterior === 120));
  const sq = m.ejerciciosRegistrados.find((e) => e.id === "sq");
  assert.equal(sq.ultimaKg, 85);
  // filas sin mutar
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.kg), ["120", "125", "80", "85"]);
});

test("P0-1. buildLoadSeriesDetailed sin `asignadaDia` conserva el comportamiento anterior (contrato del export)", () => {
  const ws = [0, 1, 2, 3].map((i) => (HOY - 20 + i * 7) * 86400000);
  const opts = { ejercicioId: "sq", weekStarts: ws, routineDays: [], dayIdx: 0, sessions: [] };
  assert.deepEqual(buildLoadSeriesDetailed(VIEJAS.concat(NUEVAS), opts).series, [80, 85, 120, 125]);
  assert.deepEqual(buildLoadSeriesDetailed(VIEJAS.concat(NUEVAS), Object.assign({ asignadaDia: ASIGNADA }, opts)).series, [80, 85, null, null]);
});

// ───────────────────────────────────────── P0-2
const B = "alumno-b";
const rA = { id: "r-a", alumno_id: A, nombre: "Rutina A", created_at: isoDe(HOY - 90), datos: { days: [{ exercises: [{ id: "farmer", reps: "20" }, { id: "sq", reps: "10 reps" }] }] } };
const rB = { id: "r-b", alumno_id: B, nombre: "Rutina B", created_at: isoDe(HOY - 90), datos: { days: [{ exercises: [{ id: "farmer", reps: "40 seg" }] }] } };
const plantillaTiempo = { id: "tpl", nombre: "Plantilla", es_plantilla: true, created_at: isoDe(HOY - 90), datos: { days: [{ exercises: [{ id: "sq", reps: "30s" }] }] } };
// A: farmer por repeticiones con carga (PR hace 2 dias); B: farmer por tiempo (reps = segundos)
const progA = [serie(A, "farmer", 30, 20, HOY - 10, 0), serie(A, "farmer", 32, 20, HOY - 2, 1), serie(A, "sq", 100, 10, HOY - 2, 1)];
const progB = [serie(B, "farmer", 40, 40, HOY - 10, 0), serie(B, "farmer", 50, 45, HOY - 2, 1)];
const alumnosAB = [{ id: A, nombre: "Ana" }, { id: B, nombre: "Beto" }];
const modeloAB = (sel, rutinas) => build({ alumnos: alumnosAB, progresoGlobal: { [A]: progA, [B]: progB }, rutinasSBEntrenador: rutinas, alumnoSel: sel });
const firma = (m) => JSON.stringify({ chips: m.alumnoChips, prs: m.prsRecientes, vol: m.volBars, pat: m.patronPatterns, ej: m.ejerciciosRegistrados, prsPeriod: m.prsPeriod, volSem: m.volSemPromKg, volPct: m.volPct });

test("P0-2. mismo ejercicio: A por repeticiones conserva su PR y su volumen aunque B lo tenga por tiempo (antes 0 y 0)", () => {
  const m = modeloAB(A, [rA, rB]);
  assert.equal(m.prsPeriod, 1);
  assert.ok(m.prsRecientes.some((p) => p.ejercicio_id === "farmer" && p.kg === 32));
  // volumen del periodo de A: 30x20 + 32x20 + 100x10 = 2240 kg en 4 semanas
  assert.equal(Math.round(m.volSemPromKg * 4), 2240);
  assert.equal(m.ejerciciosRegistrados.find((e) => e.id === "farmer").esTiempo, false);
  assert.equal(m.indiceTiempo.farmer, undefined);
});

test("P0-2. los cálculos de A no dependen de las rutinas de otro alumno ni de plantillas", () => {
  const solo = firma(modeloAB(A, [rA]));
  assert.equal(firma(modeloAB(A, [rA, rB])), solo);
  assert.equal(firma(modeloAB(A, [rB, rA, plantillaTiempo])), solo);
});

test("P0-2. B (por tiempo) sigue excluido de volumen y PR: sus reps son segundos", () => {
  const m = modeloAB(B, [rA, rB]);
  assert.equal(m.indiceTiempo.farmer, true);
  assert.equal(m.prsPeriod, 0);
  assert.equal(m.volSemPromKg, 0);
  const f = m.ejerciciosRegistrados.find((e) => e.id === "farmer");
  assert.equal(f.esTiempo, true);
  assert.equal(f.ultimaSegundos, 45);
  assert.equal(firma(m), firma(modeloAB(B, [rB])));
});

test("P0-2. «Estancados» usa el índice de cada alumno (la rutina de B no saca a A del cálculo)", () => {
  // A: record de 32 kg hace 30 dias; en las ultimas 3 semanas entrena con 30 kg (sin PR) => estancado
  const progA2 = [serie(A, "farmer", 32, 20, HOY - 30, 0), serie(A, "farmer", 30, 20, HOY - 5, 1)];
  const m1 = build({ alumnos: alumnosAB, progresoGlobal: { [A]: progA2, [B]: progB }, rutinasSBEntrenador: [rA, rB], alumnoSel: B });
  const m0 = build({ alumnos: alumnosAB, progresoGlobal: { [A]: progA2, [B]: progB }, rutinasSBEntrenador: [rA], alumnoSel: B });
  assert.deepEqual(m0.stalledIds, [A]);
  assert.deepEqual(m1.stalledIds, [A]);
});

test("P0-2. coherencia con la app del alumno: mismo índice (catálogo + sus rutinas) => mismos PR y volumen", () => {
  const idxAlumno = indiceEjerciciosPorTiempo(allEx, [rA]);
  const m = modeloAB(A, [rA, rB]);
  assert.equal(m.prsPeriod, contarPRs(eventosPR(progA, { indiceTiempo: idxAlumno }), HOY - 27, HOY));
  assert.equal(Math.round(m.volSemPromKg * 4), volumenEnRango(progA, { desde: HOY - 27, hasta: HOY, indiceTiempo: idxAlumno }).total);
});

test("P0-2. la detección de #151 se mantiene: '10 reps' no es tiempo; un ejercicio por tiempo en el CATÁLOGO aplica a todos", () => {
  const m = modeloAB(A, [rA, rB]);
  assert.notEqual(m.indiceTiempo.sq, true); // "10 reps" en la rutina de A
  const exTiempo = allEx.concat([{ id: "plank", name: "Plancha", reps: "45s" }]);
  const conPlancha = (al) => buildCoachProgresoModel({ sesionesGlobales: [], allEx: exTiempo, hoy: HOY, lang: "es", alumnos: alumnosAB, progresoGlobal: { [A]: progA, [B]: progB }, rutinasSBEntrenador: [rA, rB], alumnoSel: al });
  assert.equal(conPlancha(A).indiceTiempo.plank, true);
  assert.equal(conPlancha(B).indiceTiempo.plank, true);
});

if (fallas.length) {
  console.log("\n" + fallas.length + " tests FALLARON, " + count + " OK");
  process.exit(1);
}
console.log("\n" + count + " tests OK");
