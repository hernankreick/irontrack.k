// D7.3 demo (demo/progreso-coach.html): alumnos ficticios A/B/C, ciclos de Julián y tarjeta de volumen solo de Valentina.
//   node scripts/test-d7-3DemoAlumnos.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProgresoDemoData, VOL_ALUMNO_ID } from "../components/demo/progresoCoachDemoData.js";
import { buildCoachProgresoModel } from "../components/coachProgresoMetrics.js";
import { cicloEfectivoDeSemana, readCicloActual, readCicloBase } from "../lib/rutinaCiclo.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

const data = buildProgresoDemoData({ volumen: true });
const modelo = (id) => buildCoachProgresoModel({ ...data, periodId: "semanas4", alumnoSel: id, diaIdx: 0, lang: "es" });
const A = "demo-alumno-a", B = "demo-alumno-b", C = "demo-alumno-c", J = "demo-julian";
const chip = (m, k) => m.alumnoChips.find((c) => c.key === k);
const maxKg = (id, ej) => Math.max(...(data.progresoGlobal[id] || []).filter((r) => r.ejercicio_id === ej).map((r) => parseFloat(r.kg)));
const rutinaDe = (id) => data.rutinasSBEntrenador.find((r) => r.alumno_id === id);

test("A, B y C existen con rutina asignada, ids/emails ficticios", () => {
  for (const [id, nombre] of [[A, "Alumno A Demo"], [B, "Alumno B Demo"], [C, "Alumno C Demo"]]) {
    const al = data.alumnos.find((a) => a.id === id);
    assert.equal(al.nombre, nombre);
    assert.match(al.email, /@demo\.invalid$/);
    assert.ok(rutinaDe(id) && /^demo-r-/.test(rutinaDe(id).id), "rutina de " + nombre);
  }
});

test("A: sentadilla 100 kg, 5.000 kg por semana y 80 % (16 de 20); B: 60 kg, 2.000 kg y 50 % (8 de 16)", () => {
  const a = modelo(A), b = modelo(B);
  assert.equal(maxKg(A, "demo-sq"), 100);
  assert.equal(maxKg(B, "demo-sq"), 60);
  assert.deepEqual(a.volBars.map((x) => x.v), [5000, 5000, 5000, 5000]);
  assert.deepEqual(b.volBars.map((x) => x.v), [2000, 2000, 2000, 2000]);
  assert.equal(a.volSemPromKg, 5000);
  assert.equal(b.volSemPromKg, 2000);
  assert.equal(chip(a, "alumnoAdherence").value, 80);
  assert.equal(chip(a, "alumnoAdherence").completed, 16);
  assert.equal(chip(a, "alumnoAdherence").planned, 20);
  assert.equal(chip(b, "alumnoAdherence").value, 50);
  assert.equal(chip(b, "alumnoAdherence").completed, 8);
  assert.equal(chip(b, "alumnoAdherence").planned, 16);
  assert.ok(a.prsPeriod > 0 && b.prsPeriod > 0);
  assert.ok(!a.stalledIds.includes(A) && !a.stalledIds.includes(B), "A y B no quedan estancados");
});

test("C: sin registros ni sesiones, estados vacíos sin NaN ni cifras de otro alumno", () => {
  assert.equal((data.progresoGlobal[C] || []).length, 0);
  assert.equal(data.sesionesGlobales.filter((s) => s.alumno_id === C).length, 0);
  const c = modelo(C);
  assert.equal(c.tieneRutina, true);
  assert.deepEqual(c.volBars.map((x) => x.v), [0, 0, 0, 0]);
  assert.equal(c.volSemPromKg, 0);
  assert.equal(c.prsPeriod, 0);
  assert.equal(c.prsRecientes.length, 0);
  assert.equal(c.ejerciciosRegistrados.length, 0);
  assert.equal(c.hasChartData, false);
  assert.equal(chip(c, "alumnoAdherence").completed, 0);
  assert.equal(c.ultimaSesion == null || c.ultimaSesion.diasAtras == null, true);
  assert.doesNotMatch(JSON.stringify(c), /NaN|undefined|Infinity/);
});

test("A y B dan cifras distintas y propias; cambiar A→B→C→A devuelve exactamente los mismos modelos", () => {
  const a1 = modelo(A), b1 = modelo(B), c1 = modelo(C);
  const a2 = modelo(A), b2 = modelo(B), c2 = modelo(C);
  assert.notDeepEqual(a1.volBars, b1.volBars);
  assert.notEqual(chip(a1, "alumnoAdherence").value, chip(b1, "alumnoAdherence").value);
  assert.notDeepEqual(a1.volBars, c1.volBars);
  assert.deepEqual(JSON.parse(JSON.stringify(a2)), JSON.parse(JSON.stringify(a1)));
  assert.deepEqual(JSON.parse(JSON.stringify(b2)), JSON.parse(JSON.stringify(b1)));
  assert.deepEqual(JSON.parse(JSON.stringify(c2)), JSON.parse(JSON.stringify(c1)));
  // los datos de entrada no se mutan al calcular
  assert.deepEqual(JSON.parse(JSON.stringify(buildProgresoDemoData({ volumen: true }).progresoGlobal[A].map((r) => r.kg))), data.progresoGlobal[A].map((r) => r.kg));
});

test("Julián: ciclo 1 con 4 semanas (una sesión de cada día por semana, sin doble conteo)", () => {
  const filas = data.progresoGlobal[J];
  assert.ok(filas.every((r) => r.ciclo != null && r.semana != null), "cada fila con semana y ciclo");
  const ses1 = data.sesionesGlobales.filter((s) => s.alumno_id === J && s.ciclo === 1);
  assert.deepEqual([...new Set(ses1.map((s) => s.semana))].sort(), [1, 2, 3, 4]);
  for (let w = 1; w <= 4; w++) {
    assert.equal(ses1.filter((s) => s.semana === w).length, 2, "semana " + w + ": día 1 y día 2, una vez cada uno");
    assert.deepEqual(ses1.filter((s) => s.semana === w).map((s) => s.dia_idx).sort(), [0, 1]);
  }
  const porSemana = {};
  filas.filter((r) => r.ciclo === 1).forEach((r) => { porSemana[r.semana] = (porSemana[r.semana] || 0) + parseFloat(r.kg) * parseFloat(r.reps); });
  assert.deepEqual(Object.keys(porSemana).sort(), ["0", "1", "2", "3"]);
  assert.deepEqual(porSemana, { 0: 4537.5, 1: 4755, 2: 4972.5, 3: 5092.5 }, "la semana 4 ya no suma 10.365 (dos sesiones)");
  const ses2 = data.sesionesGlobales.filter((s) => s.alumno_id === J && s.ciclo === 2);
  assert.deepEqual([...new Set(ses2.map((s) => s.semana))].sort(), [1, 2, 3, 4]);
  const ses3 = data.sesionesGlobales.filter((s) => s.alumno_id === J && s.ciclo === 3);
  assert.deepEqual([...new Set(ses3.map((s) => s.semana))].sort(), [1, 2]);
});

test("Julián: la rutina vigente es ciclo 3 semana 2 y el modelo solo cuenta ese ciclo", () => {
  const r = rutinaDe(J);
  assert.equal(readCicloActual(r.datos), 3);
  assert.equal(readCicloBase(r.datos), 3);
  assert.equal(r.datos.semana_activa, 2);
  assert.equal(r.datos.ciclos_meta.length, 2);
  assert.equal(cicloEfectivoDeSemana(r.datos, 2), 3);
  const m = modelo(J);
  assert.equal(m.currentRoutineWeekIndex, 1, "semana activa 2");
  assert.equal(m.volBars[0].v > 0 && m.volBars[1].v > 0 && m.volBars[2].v === 0 && m.volBars[3].v === 0, true);
  const ciclo3 = data.progresoGlobal[J].filter((r2) => r2.ciclo === 3);
  const total3 = ciclo3.reduce((a, r2) => a + parseFloat(r2.kg) * parseFloat(r2.reps), 0);
  assert.equal(m.volBars[0].v + m.volBars[1].v, total3);
  assert.equal(m.prsPeriod, 0, "sigue estancado: la historia de PR no cambia");
  assert.ok(m.stalledIds.includes(J));
});

test("Julián: la historia de PR no cambia (100 kg en el día 42, iguala en 14 y 7, 97,5 en el 2)", () => {
  const sq = data.progresoGlobal[J].filter((r) => r.ejercicio_id === "demo-sq" && parseFloat(r.kg) === 100).map((r) => r.fecha);
  assert.equal(new Set(sq).size, 3, "100 kg en tres días (42, 14 y 7)");
  assert.equal(maxKg(J, "demo-sq"), 100);
});

test("fuente: la tarjeta de volumen solo con Valentina seleccionada y ProgresoView con aviso opcional", () => {
  const jsx = read("components/demo/ProgresoCoachDemo.jsx");
  assert.match(jsx, /String\(alumnoSelId\) === VOL_ALUMNO_ID/);
  const pv = read("components/ProgresoView.jsx");
  assert.match(pv, /onAlumnoSelChange = null/);
  assert.match(pv, /typeof onAlumnoSelChange === "function"/);
  assert.equal(VOL_ALUMNO_ID, "demo-vol");
});

console.log(count + " pruebas OK");
