// Pruebas de lib/manualSessionValidation.js: validacion manual de un dia por el entrenador (caso Catalina: semana 2, dia 3 olvidado).
//
//   node scripts/test-manualSessionValidation.mjs

import assert from "node:assert/strict";
import {
  buildManualSessionPayload,
  completedDayIndexesFromRows,
  loadWeekCompletion,
  validateManualSession,
  mergeSesionesById,
  MANUAL_ORIGEN,
} from "../lib/manualSessionValidation.js";
import { isCoachValidatedSession, advanceWeekAfterValidation } from "../lib/orphanSessions.js";
import { deriveSemanaActivaTarget } from "../lib/reconcileSemanaActiva.js";
import { getActiveStudentRoutinePosition } from "../lib/studentWeeklyProgress.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const NOW = new Date("2026-10-08T18:00:00Z"); // 8/10/2026 15:00 en Buenos Aires
const rutina = (extra) => ({
  id: "r1", nombre: "Cata full body",
  datos: Object.assign({ semana_activa: 2, days: [{ label: "Dia 1", exercises: [{ id: "a" }] }, { label: "Dia 2", exercises: [{ id: "b" }] }, { label: "Dia 3", exercises: [{ id: "c" }] }] }, extra || {}),
});
const ses = (dia, semana, over) => Object.assign({ id: "s" + dia + "-" + semana, alumno_id: "cata", rutina_id: "r1", dia_idx: dia, semana, fecha: "1/10/2026" }, over || {});

// Fake de `sb` con tabla en memoria (misma semantica que getSesionesByAlumnoRutinaSemana / addSesion).
function fakeSb(initial) {
  const table = (initial || []).slice();
  const calls = { add: [], read: 0 };
  return {
    table, calls,
    async getSesionesByAlumnoRutinaSemana(aid, rid, name, semana) {
      calls.read++;
      return table.filter((s) => s.alumno_id === aid && String(s.rutina_id) === String(rid) && Number(s.semana) === Number(semana));
    },
    async addSesion(payload) {
      calls.add.push(payload);
      const row = Object.assign({ id: "new" + calls.add.length }, payload);
      table.push(row);
      return [row];
    },
  };
}
const params = (sb, over) => Object.assign({ sb, alumnoId: "cata", rutina: rutina(), diaIdx: 2, semana: 2, now: NOW }, over || {});

await test("payload: sin ejercicios/hora, origen validada_coach, fecha de hoy (AR), semana y dia pedidos, rutina_id, sin created_at", () => {
  const p = buildManualSessionPayload(params(null));
  assert.equal(p.alumno_id, "cata");
  assert.equal(p.rutina_id, "r1");
  assert.equal(p.dia_idx, 2);
  assert.equal(p.semana, 2);
  assert.equal(p.dia_label, "Dia 3");
  assert.equal(p.ejercicios, "");
  assert.equal(p.fecha, "8/10/2026");
  assert.equal(p.origen, MANUAL_ORIGEN);
  assert.ok(!("hora" in p) && !("created_at" in p) && !("ciclo" in p));
  assert.equal(isCoachValidatedSession(p), true);
});

await test("payload: en un ciclo > 1 lleva el ciclo vigente", () => {
  assert.equal(buildManualSessionPayload(params(null, { rutina: rutina({ ciclo_actual: 3 }) })).ciclo, 3);
});

await test("1) dia sin ningun ejercicio registrado: inserta UNA fila de sesiones y nada mas", async () => {
  const sb = fakeSb([ses(0, 2), ses(1, 2)]);
  const r = await validateManualSession(params(sb));
  assert.equal(r.status, "saved");
  assert.equal(sb.calls.add.length, 1);
  assert.equal(sb.table.length, 3);
  assert.deepEqual(completedDayIndexesFromRows(sb.table, rutina(), 2), [0, 1, 2]);
});

await test("2) dia con registros parciales: no toca progreso (la unica escritura es una insercion en sesiones)", async () => {
  const sb = fakeSb([ses(0, 2), ses(1, 2)]);
  sb.addProgreso = () => { throw new Error("no debe escribir progreso"); };
  sb.deleteProgresoByAlumno = sb.addProgreso;
  const r = await validateManualSession(params(sb));
  assert.equal(r.status, "saved");
  assert.equal(sb.calls.add.length, 1);
});

await test("3/4) ultimo dia de la semana: la semana queda completa y el mecanismo existente avanza a la 3 (Dia 1)", async () => {
  const sb = fakeSb([ses(0, 2), ses(1, 2), ses(0, 1), ses(1, 1), ses(2, 1)]);
  const before = deriveSemanaActivaTarget({ datos: rutina().datos, sesiones: sb.table, rutinaId: "r1", alumnoId: "cata" });
  assert.equal(before.target, null); // semana 2 incompleta: sigue en Dia 3
  const posBefore = getActiveStudentRoutinePosition({ alumno: "cata", rutina: rutina(), sesiones: sb.table, now: NOW });
  assert.equal(posBefore.weekNumber, 2);
  assert.equal(posBefore.currentDayIndex, 2);

  await validateManualSession(params(sb));
  const after = deriveSemanaActivaTarget({ datos: rutina().datos, sesiones: sb.table, rutinaId: "r1", alumnoId: "cata" });
  assert.equal(after.completeWeek, 2);
  assert.equal(after.target, 3);

  const adv = await advanceWeekAfterValidation({ sb: { reconcileSemanaActivaAlumno: async () => ({ status: "advanced", rutinaId: "r1", semanaActiva: 3 }) }, alumnoId: "cata", rutina: rutina() });
  assert.equal(adv.status, "advanced");
  const posAfter = getActiveStudentRoutinePosition({ alumno: "cata", rutina: rutina({ semana_activa: 3 }), sesiones: sb.table, now: NOW });
  assert.equal(posAfter.weekNumber, 3);
  assert.equal(posAfter.currentDayIndex, 0);
  assert.equal(posAfter.completedDaysInWeek, 0);
});

await test("validar un dia que no cierra la semana no la avanza", async () => {
  const sb = fakeSb([ses(0, 2)]);
  await validateManualSession(params(sb, { diaIdx: 1 }));
  const d = deriveSemanaActivaTarget({ datos: rutina().datos, sesiones: sb.table, rutinaId: "r1", alumnoId: "cata" });
  assert.equal(d.target, null);
});

await test("5) dia ya completado: no inserta (exists)", async () => {
  const sb = fakeSb([ses(0, 2), ses(1, 2), ses(2, 2)]);
  const r = await validateManualSession(params(sb));
  assert.equal(r.status, "exists");
  assert.equal(sb.calls.add.length, 0);
  assert.equal(sb.table.length, 3);
});

await test("sesion real del alumno en otra fecha para ese dia no se pisa ni se duplica", async () => {
  const real = ses(2, 2, { fecha: "3/10/2026", ejercicios: "c", hora: "18:00" });
  const sb = fakeSb([real]);
  const r = await validateManualSession(params(sb));
  assert.equal(r.status, "exists");
  assert.equal(sb.calls.add.length, 0);
  assert.deepEqual(sb.table, [real]);
});

await test("clics repetidos (en serie): una sola fila", async () => {
  const sb = fakeSb([]);
  const a = await validateManualSession(params(sb));
  const b = await validateManualSession(params(sb));
  assert.equal(a.status, "saved");
  assert.equal(b.status, "exists");
  assert.equal(sb.table.length, 1);
});

await test("6/7) persistencia: otro dispositivo (lectura nueva) ve el dia completado", async () => {
  const sb = fakeSb([ses(0, 2), ses(1, 2)]);
  await validateManualSession(params(sb));
  const fresh = await loadWeekCompletion(params(sb));
  assert.deepEqual(fresh.completed, [0, 1, 2]);
});

await test("8/9) historial y otros alumnos/rutinas/semanas/ciclos intactos; solo se agrega una fila", async () => {
  const other = [ses(2, 1), ses(2, 2, { alumno_id: "otra" }), ses(2, 2, { rutina_id: "r2" }), ses(2, 2, { ciclo: 2 })];
  const sb = fakeSb(other);
  const r = await validateManualSession(params(sb));
  assert.equal(r.status, "saved");
  assert.deepEqual(sb.table.slice(0, 4), other);
  assert.equal(sb.table.length, 5);
  assert.equal(sb.table[4].alumno_id, "cata");
  assert.equal(sb.table[4].semana, 2);
});

await test("sesiones pendientes/incompletas no cuentan como completadas", () => {
  assert.deepEqual(completedDayIndexesFromRows([ses(2, 2, { estado: "pendiente" }), ses(1, 2, { completada: false })], rutina(), 2), []);
});

await test("argumentos invalidos lanzan sin escribir", async () => {
  const sb = fakeSb([]);
  for (const over of [{ diaIdx: 3 }, { diaIdx: -1 }, { diaIdx: "1" }, { semana: 0 }, { semana: 5 }, { rutina: { nombre: "x", datos: { days: [{}] } } }]) {
    await assert.rejects(() => validateManualSession(params(sb, over)));
  }
  assert.equal(sb.calls.add.length, 0);
});

await test("lectura fallida o insert no confirmado lanzan (no se muestra exito)", async () => {
  const sb1 = fakeSb([]);
  sb1.getSesionesByAlumnoRutinaSemana = async () => null;
  await assert.rejects(() => validateManualSession(params(sb1)));
  assert.equal(sb1.calls.add.length, 0);
  const sb2 = fakeSb([]);
  sb2.addSesion = async () => null;
  await assert.rejects(() => validateManualSession(params(sb2)), /no confirmo/);
});

await test("mergeSesionesById: sin duplicados por id, nuevas primero", () => {
  const out = mergeSesionesById([{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 1 }]);
  assert.deepEqual(out.map((s) => s.id), [3, 1, 2]);
});

console.log("\n" + count + " pruebas OK");
