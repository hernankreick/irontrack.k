// D7.3: escenario de demo ?volumen=comparar (Progreso del entrenador). Las cifras «Antes» salen de réplicas locales de las 4
// definiciones anteriores (solo demo) y «Ahora» de volumenEnRango real: caso de referencia de un día.
//   node scripts/test-d7-3VolumenDemo.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProgresoDemoData, compararVolumenDemo, VOL_ALUMNO_ID } from "../components/demo/progresoCoachDemoData.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

const data = buildProgresoDemoData({ volumen: true });

test("caso de referencia de hoy: Antes 1840/1000/2290/2290 y Ahora 1840", () => {
  const c = compararVolumenDemo(data, 0);
  assert.deepEqual(c.antes, { A: 1840, B: 1000, C: 2290, D: 2290 });
  assert.equal(c.ahora, 1840);
});

test("por ejercicio: la plancha queda excluida por tiempo y el resto incluido", () => {
  const c = compararVolumenDemo(data, 0);
  assert.equal(c.ejercicios.length, 6);
  const plank = c.ejercicios.find((e) => e.id === "vol-plank");
  assert.equal(plank.incluido, false);
  assert.match(plank.motivo, /tiempo/);
  assert.equal(c.ejercicios.filter((e) => e.incluido).reduce((a, e) => a + e.kg, 0), 1840);
  assert.equal(c.ejercicios.find((e) => e.id === "custom_vol_x").kg, 400);
  assert.equal(c.ejercicios.find((e) => e.id === "vol-pu").kg, 80);
});

test("hace 7 días hay registros y Ahora = A", () => {
  const c = compararVolumenDemo(data, 7);
  assert.ok(c.ahora > 0);
  assert.equal(c.ahora, c.antes.A);
  assert.ok(c.antes.C > c.antes.A);
});

test("sin el parametro la demo queda igual (sin alumno ni ejercicios del escenario)", () => {
  const base = buildProgresoDemoData({});
  assert.ok(!base.alumnos.some((a) => a.id === VOL_ALUMNO_ID));
  assert.ok(!base.allEx.some((e) => String(e.id).startsWith("vol-")));
  assert.equal(base.alumnos.length, data.alumnos.length - 1);
  assert.ok(data.alumnos.some((a) => a.id === VOL_ALUMNO_ID && a.nombre === "Valentina Carga"));
  const jsx = read("components/demo/ProgresoCoachDemo.jsx");
  assert.match(jsx, /get\('volumen'\) === 'comparar'/);
  assert.match(jsx, /comparacion && String\(alumnoSelId\) === VOL_ALUMNO_ID \? <VolumenComparacionCard/);
  assert.match(jsx, /onAlumnoSelChange=\{setAlumnoSelId\}/);
});

test("fuente: réplicas comentadas como solo demo y tarjeta con los textos pedidos", () => {
  const d = read("components/demo/progresoCoachDemoData.js");
  assert.equal((d.match(/Réplica de la definición anterior, solo demo/g) || []).length, 4);
  assert.match(d, /volumenEnRango/);
  assert.match(d, /indiceEjerciciosPorTiempo/);
  const jsx = read("components/demo/ProgresoCoachDemo.jsx");
  for (const t of ["DEMO · Comparación de volumen", "Antes", "en todas las pantallas", "Excluido · "]) assert.ok(jsx.includes(t), t);
});

console.log(count + " pruebas OK");
