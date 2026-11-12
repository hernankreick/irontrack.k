// P0-2: la deduplicacion de sesiones distingue RUTINAS.
//   node scripts/test-sesionDedupRutina.mjs
// Regla: con rutina_id valido en AMBAS filas, distinto rutina_id => NO es duplicado. Si alguna no lo tiene (fila antigua / modo compartido)
// se conserva el comportamiento legado (fecha + dia_idx + semana + ciclo), que es AMBIGUO entre rutinas pero evita duplicar. Sin red.

import assert from "node:assert/strict";
import { sessionAlreadyExists, mergeLocalOfflineSessions, buildSessionPayload, removeUndefinedPayloadFields } from "../lib/workoutSession.js";
import { persistSessionConfirmed, finalizeStudentSession } from "../lib/finalizeWorkoutSession.js";
import {
  estadoInicialSesiones, iniciarLecturaSesiones, aplicarLecturaSesiones, registrarSesionConfirmada,
} from "../lib/sesionesLectura.js";
import { cumplimientoSesiones } from "../lib/cumplimiento/sesiones.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const ALU = "alu-1";
const F = "12/11/2026";
const fila = (extra) => Object.assign({ alumno_id: ALU, rutina_id: "R1", fecha: F, dia_idx: 0, semana: 1 }, extra || {});

function makeSb(rows) {
  const calls = { get: 0, add: 0 };
  return {
    rows, calls,
    getSesiones: async () => { calls.get++; return rows.slice(); },
    addSesion: async (p) => { calls.add++; const r = Object.assign({ id: "s" + calls.add }, p); rows.push(r); return [r]; },
    getSesionesByAlumnoRutinaSemana: async () => rows.slice(),
  };
}
function params(sb, rutinaId, extra) {
  const payload = removeUndefinedPayloadFields(buildSessionPayload({
    alumnoId: ALU, session: { dIdx: 0 }, activeDay: { label: "Dia 1" }, activeRoutine: { id: rutinaId, name: "N-" + rutinaId },
    exercises: [{ id: "a" }], weekToSave: 1, date: F, time: "10:00", includeRoutineId: true, ciclo: 1,
  }));
  return Object.assign({ sb, alumnoId: ALU, payload, date: F, dayIndex: 0, weekToSave: 1, ciclo: 1, isOnline: true, effectiveWeek: 0,
    totalDays: 2, lastAdvanceDate: null, todayStr: "x", rutinaId, rutinaNombre: "N-" + rutinaId, timeoutMs: 50,
    updateRutinaWeek: async () => [{}] }, extra || {});
}

await test("1 misma rutina + misma fecha/dia/semana/ciclo: duplicado", () => {
  assert.equal(sessionAlreadyExists([fila()], F, 0, 1, 1, "R1"), true);
});
await test("2 rutinas distintas con la misma clave: NO duplicado (el defecto P0-2)", () => {
  assert.equal(sessionAlreadyExists([fila({ rutina_id: "R1" })], F, 0, 1, 1, "R2"), false);
});
await test("3 ids equivalentes (numero/texto, mayusculas): misma rutina", () => {
  assert.equal(sessionAlreadyExists([fila({ rutina_id: 7 })], F, 0, 1, 1, "7"), true);
  assert.equal(sessionAlreadyExists([fila({ rutina_id: "AbC" })], F, 0, 1, 1, "abc"), true);
});
await test("4 fila antigua sin rutina_id: comportamiento legado (duplicado), con o sin rutina nueva", () => {
  for (const vacio of [undefined, null, ""]) {
    assert.equal(sessionAlreadyExists([fila({ rutina_id: vacio })], F, 0, 1, 1, "R2"), true);
  }
  assert.equal(sessionAlreadyExists([fila({ rutina_id: undefined })], F, 0, 1, 1), true);
});
await test("5 la llamada sin rutinaId (5 argumentos, formato anterior) no cambia", () => {
  assert.equal(sessionAlreadyExists([fila({ rutina_id: "R1" })], F, 0, 1, 1), true);
  assert.equal(sessionAlreadyExists([fila()], F, 1, 1, 1), false);
  assert.equal(sessionAlreadyExists([fila()], F, 0, 2, 1), false);
  assert.equal(sessionAlreadyExists([fila()], F, 0, 1, 2), false);
});
await test("6 nueva fila sin rutina_id contra fila con rutina_id: legado (duplicado)", () => {
  assert.equal(sessionAlreadyExists([fila({ rutina_id: "R1" })], F, 0, 1, 1, undefined), true);
  assert.equal(sessionAlreadyExists([fila({ rutina_id: "R1" })], F, 0, 1, 1, ""), true);
});

await test("7 finalizacion: dos rutinas el mismo dia -> las DOS sesiones se guardan", async () => {
  const sb = makeSb([]);
  const a = await persistSessionConfirmed(params(sb, "R1"));
  const b = await persistSessionConfirmed(params(sb, "R2"));
  assert.equal(a.confirmed, true); assert.equal(a.source, "insert");
  assert.equal(b.confirmed, true); assert.equal(b.source, "insert");
  assert.equal(sb.calls.add, 2);
  assert.deepEqual(sb.rows.map((r) => r.rutina_id), ["R1", "R2"]);
});
await test("8 reintento de finalizacion de la MISMA rutina: no duplica", async () => {
  const sb = makeSb([]);
  await persistSessionConfirmed(params(sb, "R1"));
  const again = await persistSessionConfirmed(params(sb, "R1"));
  const third = await finalizeStudentSession(params(sb, "R1"));
  assert.equal(again.source, "existing");
  assert.equal(third.source, "existing");
  assert.equal(sb.calls.add, 1);
  assert.equal(sb.rows.length, 1);
});
await test("9 respuesta perdida del POST de la rutina 2: la verificacion posterior la encuentra (1 solo POST)", async () => {
  const sb = makeSb([fila({ rutina_id: "R1" })]);
  const add = sb.addSesion;
  sb.addSesion = async (p) => { await add(p); return null; };
  const r = await persistSessionConfirmed(params(sb, "R2"));
  assert.equal(r.confirmed, true); assert.equal(r.source, "verified");
  assert.equal(sb.calls.add, 1);
  assert.equal(sb.rows.length, 2);
});
await test("10 fila antigua sin rutina_id: finalizar no inserta (legado) y no rompe", async () => {
  const sb = makeSb([fila({ rutina_id: undefined })]);
  const r = await persistSessionConfirmed(params(sb, "R1"));
  assert.equal(r.source, "existing");
  assert.equal(sb.calls.add, 0);
});
await test("11 el payload de finalizacion transmite rutina_id y la busqueda recibe el mismo", () => {
  const p = params(makeSb([]), "R9");
  assert.equal(p.payload.rutina_id, "R9");
});

await test("12 mergeLocalOfflineSessions: rutinas distintas se conservan; misma rutina y legado no se duplican", () => {
  const a = fila({ rutina_id: "R1" });
  assert.equal(mergeLocalOfflineSessions([a], [fila({ rutina_id: "R2" })]).length, 2);
  assert.equal(mergeLocalOfflineSessions([a], [fila({ rutina_id: "R1" })]).length, 1);
  assert.equal(mergeLocalOfflineSessions([a], [fila({ rutina_id: undefined })]).length, 1);
  assert.equal(mergeLocalOfflineSessions([fila({ rutina_id: undefined })], [a]).length, 1);
  assert.equal(mergeLocalOfflineSessions([a], [fila({ alumno_id: "otro", rutina_id: "R1" })]).length, 2);
  assert.equal(mergeLocalOfflineSessions([a], [a, a]).length, 1);
});

await test("13 recuperacion: sesion confirmada local de R2 no se pierde ante una lectura del servidor que solo trae R1", () => {
  let est = estadoInicialSesiones();
  const ini = iniciarLecturaSesiones(est, ALU);
  est = ini.estado;
  est = aplicarLecturaSesiones(est, ALU, ini.seq, { ok: true, rows: [fila({ id: "s1", rutina_id: "R1" })] });
  est = registrarSesionConfirmada(est, ALU, fila({ rutina_id: "R2" })); // sin id (fila confirmada local)
  assert.equal(est.rows.length, 2);
  const ini2 = iniciarLecturaSesiones(est, ALU);
  const est2 = aplicarLecturaSesiones(ini2.estado, ALU, ini2.seq, { ok: true, rows: [fila({ id: "s1", rutina_id: "R1" })] });
  assert.equal(est2.rows.length, 2, "la confirmada de R2 sigue visible hasta que el servidor la traiga");
  const ini3 = iniciarLecturaSesiones(est2, ALU);
  const est3 = aplicarLecturaSesiones(ini3.estado, ALU, ini3.seq, { ok: true, rows: [fila({ id: "s1", rutina_id: "R1" }), fila({ id: "s2", rutina_id: "R2" })] });
  assert.equal(est3.rows.length, 2);
  assert.equal(est3.confirmadas.length, 0);
});
await test("14 recuperacion: una confirmada local de R1 si se reconcilia con la fila del servidor (sin duplicar)", () => {
  let est = estadoInicialSesiones();
  const ini = iniciarLecturaSesiones(est, ALU);
  est = registrarSesionConfirmada(ini.estado, ALU, fila({ rutina_id: "R1" }));
  est = aplicarLecturaSesiones(est, ALU, ini.seq, { ok: true, rows: [fila({ id: "s1", rutina_id: "R1" })] });
  assert.equal(est.rows.length, 1);
});

await test("15 compatibilidad: cumplimiento del ciclo cuenta cada rutina por separado", () => {
  const dias = [{ label: "D1", exercises: [] }, { label: "D2", exercises: [] }];
  const rutina = { id: "R2", nombre: "N-R2", alumno_id: ALU, created_at: "2026-01-01T00:00:00Z", datos: { days: dias, semana_activa: 1 } };
  const sesiones = [fila({ id: "s1", rutina_id: "R1" }), fila({ id: "s2", rutina_id: "R2" })];
  const c = cumplimientoSesiones({ alumnoId: ALU, rutina, sesiones, historialCompleto: true });
  assert.equal(c.ok, true);
  assert.equal(c.excluidas.otraRutina, 1);
  assert.deepEqual(c.semanas[0].diasCompletados, [0]);
});

console.log("\n" + count + " pruebas OK");
