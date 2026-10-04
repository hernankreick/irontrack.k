// T01.1B: semantica de "completado" del lado ENTRENADOR en lib/studentWeeklyProgress.js.
//   NOT_STARTED = sin actividad | ACTIVIDAD = hay series (progreso) sin sesion finalizada | COMPLETADO = sesion finalizada en `sesiones`.
// `progreso` es actividad: NO aumenta completedDays / completedDayIndexes / pct. Se expone aparte como progressActivityDays.
//
//   node scripts/test-coachWeeklyProgress.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getStudentWeeklyProgress, getActiveStudentRoutinePosition } from "../lib/studentWeeklyProgress.js";

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok - " + name); }

const ALU = "alu-1";
const RUT = { id: "r1", name: "Full body", days: [{}, {}, {}, {}] };
// Miercoles 7/10/2026 -> semana calendario lunes 5/10 .. domingo 11/10
const NOW = new Date(2026, 9, 7, 12);
const ses = (dia, over) => Object.assign({ alumno_id: ALU, rutina_id: "r1", dia_idx: dia, semana: 1, fecha: "6/10/2026", created_at: "2026-10-06T15:00:00" }, over || {});
const prog = (fecha, n) => Array.from({ length: n || 1 }, (_, i) => ({ alumno_id: ALU, ejercicio_id: "e" + i, kg: 10, reps: 8, fecha, semana: 0 }));
const run = (sesiones, progresoRows, extra) => getStudentWeeklyProgress(Object.assign({
  alumno: ALU, rutina: RUT, sesiones, progreso: { [ALU]: progresoRows || [] }, now: NOW,
}, extra || {}));

test("A: series en 2 fechas, 0 sesiones -> 0 completados, 0%, sin checks, actividad = 2", () => {
  const w = run([], prog("6/10/2026", 3).concat(prog("8/10/2026", 2)));
  assert.equal(w.completedDays, 0);
  assert.equal(w.pct, 0);
  assert.deepEqual(w.completedDayIndexes, []);
  assert.equal(w.progressActivityDays, 2);
  assert.notEqual(w.source, "progreso");
});
test("B: series en 2 fechas + 1 sesion finalizada del dia 0 -> 1 de 4 (25%), check solo en el dia 0", () => {
  const w = run([ses(0)], prog("6/10/2026").concat(prog("8/10/2026")));
  assert.equal(w.completedDays, 1);
  assert.equal(w.pct, 25);
  assert.deepEqual(w.completedDayIndexes, [0]);
  assert.equal(w.progressActivityDays, 2);
  assert.equal(w.source, "sesiones");
});
test("C: muchas filas de progreso en la misma fecha -> actividad 1, completados 0", () => {
  const w = run([], prog("6/10/2026", 40));
  assert.equal(w.progressActivityDays, 1);
  assert.equal(w.completedDays, 0);
  assert.equal(run([], prog("06/10/2026", 5).concat(prog("6/10/2026", 5))).progressActivityDays, 1, "con y sin cero es la misma fecha");
});
test("D: sesiones duplicadas del mismo dia_idx no inflan completedDays", () => {
  const w = run([ses(1), ses(1), ses(1, { fecha: "7/10/2026" })], []);
  assert.equal(w.completedDays, 1);
  assert.deepEqual(w.completedDayIndexes, [1]);
  assert.equal(w.pct, 25);
});
test("E: sesion de otra rutina no cuenta", () => {
  const w = run([ses(0, { rutina_id: "r2" })], []);
  assert.equal(w.completedDays, 0);
  assert.equal(w.pct, 0);
});
test("F: sesion de otro alumno no cuenta", () => {
  const w = run([ses(0, { alumno_id: "otro" })], []);
  assert.equal(w.completedDays, 0);
});
test("G: sesion de otra semana no cuenta en la semana activa", () => {
  // semana activa = 2 (persistida); la sesion es de la semana 1
  const rutina2 = Object.assign({}, RUT, { datos: { semana_activa: 2, days: RUT.days } });
  const w = run([ses(0, { semana: 1 })], [], { rutina: rutina2 });
  assert.equal(w.weekNumber, 2);
  assert.equal(w.completedDays, 0);
  const w2 = run([ses(0, { semana: 2 })], [], { rutina: rutina2 });
  assert.equal(w2.completedDays, 1);
});
test("H: fechas invalidas / fuera de la semana calendario no aumentan la actividad", () => {
  const bad = [{ alumno_id: ALU, fecha: "no-fecha" }, { alumno_id: ALU, fecha: null }, { alumno_id: ALU }, { alumno_id: ALU, fecha: "30/9/2026" }, { alumno_id: ALU, fecha: "12/10/2026" }];
  const w = run([], bad);
  assert.equal(w.progressActivityDays, 0);
  assert.equal(w.completedDays, 0);
  assert.equal(run([], bad.concat(prog("7/10/2026"))).progressActivityDays, 1);
});
test("progreso ausente o de otro alumno: actividad 0 y sin errores", () => {
  assert.equal(getStudentWeeklyProgress({ alumno: ALU, rutina: RUT, sesiones: [], now: NOW }).progressActivityDays, 0);
  assert.equal(getStudentWeeklyProgress({ alumno: ALU, rutina: RUT, sesiones: [], progreso: { otro: prog("6/10/2026") }, now: NOW }).progressActivityDays, 0);
  assert.equal(getStudentWeeklyProgress({ alumno: ALU, rutina: RUT, sesiones: [], progreso: null, now: NOW }).progressActivityDays, 0);
});
test("pct nunca supera 100 y las sesiones de los 4 dias dan 100% aunque haya series", () => {
  const w = run([0, 1, 2, 3].map((d) => ses(d)), prog("6/10/2026").concat(prog("7/10/2026")));
  assert.equal(w.completedDays, 4);
  assert.equal(w.pct, 100);
});

test("I: llamadores del ENTRENADOR no pasan completedDays (it_cd) como evidencia", () => {
  const strip = (src) => src.replace(/\/\/.*$/gm, "");
  const callBlocks = (src, fn) => {
    const out = [];
    let i = 0;
    while ((i = src.indexOf(fn + "(", i)) !== -1) {
      const end = src.indexOf("})", i);
      out.push(src.slice(i, end + 2));
      i = end;
    }
    return out;
  };
  const sections = strip(readFileSync(new URL("../components/students/StudentsSection.jsx", import.meta.url), "utf8"));
  const search = strip(readFileSync(new URL("../lib/coachGlobalSearchSelectors.js", import.meta.url), "utf8"));
  const dash = strip(readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8"));
  const blocks = [].concat(
    callBlocks(sections, "getActiveStudentRoutinePosition"),
    callBlocks(search, "getStudentWeeklyProgress"),
    callBlocks(dash, "getStudentWeeklyProgress")
  );
  assert.ok(blocks.length >= 7, "se inspeccionaron los call-sites del entrenador: " + blocks.length);
  for (const b of blocks) assert.ok(!/completedDays/.test(b), "no debe pasar completedDays:\n" + b);
});
test("I (compat alumno): el residual de it_cd del ALUMNO no cambio (sin sesiones, sin progreso)", () => {
  const w = getActiveStudentRoutinePosition({ alumno: ALU, rutina: RUT, sesiones: [], completedDays: ["r1-0-w0", "r1-1-w0", "otra-2-w0"], currentWeek: 0, now: NOW });
  assert.equal(w.completedDaysInWeek, 2);
  assert.deepEqual(w.completedDayIndexes.slice().sort(), [0, 1]);
  assert.equal(w.weeklyProgress.source, "completedDays");
  // con sesiones, it_cd se ignora (como antes)
  const w2 = getActiveStudentRoutinePosition({ alumno: ALU, rutina: RUT, sesiones: [ses(3)], completedDays: ["r1-0-w0", "r1-1-w0"], currentWeek: 0, now: NOW });
  assert.equal(w2.completedDaysInWeek, 1);
  assert.deepEqual(w2.completedDayIndexes, [3]);
});
test("I (compat alumno): el alumno no pasa `progreso`; aun asi progreso nunca suma completados", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const i = app.indexOf("return getActiveStudentRoutinePosition({");
  const block = app.slice(i, app.indexOf("});", i));
  assert.ok(!/progreso\s*:/.test(block));
  const w = getActiveStudentRoutinePosition({ alumno: ALU, rutina: RUT, sesiones: [], progreso: { [ALU]: prog("6/10/2026") }, currentWeek: 0, now: NOW });
  assert.equal(w.completedDaysInWeek, 0);
});
test("J: los checks de StudentRoutinePreview (entrenador) no dependen de it_cd", () => {
  const src = readFileSync(new URL("../components/students/StudentRoutinePreview.jsx", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.ok(!/completedDays\.includes/.test(src));
  const line = src.split("\n").find((l) => l.includes("var dayDone"));
  assert.ok(line && /completedDayIndexes\.indexOf\(di\) !== -1;/.test(line) && !/completedDays|it_cd/.test(line));
});
test("actividad del dashboard intacta: getLastActivityMs/countProgresoSince/defaultCoachAlumnoCategoria siguen leyendo progreso", () => {
  const dash = readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
  for (const fn of ["function getLastActivityMs", "function countProgresoSince", "function defaultCoachAlumnoCategoria"]) assert.ok(dash.includes(fn));
  assert.ok(/function getLastActivityMs[\s\S]*progresoGlobal/.test(dash));
});

console.log("\n" + count + " tests OK");
