// Pruebas de lib/finalizeWorkoutSession.js (T01.2): finalizacion segura de la sesion del alumno.
// UNA SESION NO ESTA TERMINADA HASTA QUE `sesiones` LA CONFIRMA.
//
//   node scripts/test-finalizeWorkoutSession.mjs
//
// Sin red ni Supabase real: `sb` es un doble. Sin dependencias nuevas (node:assert).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FINALIZE_FAILURE,
  SESSION_CONFIRMED_BY,
  countPersistedDistinctDays,
  createFinalizeGuard,
  finalizeStudentSession,
  isValidInsertedRow,
  persistSessionConfirmed,
} from "../lib/finalizeWorkoutSession.js";
import { buildSessionPayload, removeUndefinedPayloadFields } from "../lib/workoutSession.js";

let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log("ok - " + name);
}

const HOY = "3/10/2026";
const ALUMNO = "alu-1";
const RUTINA = { id: "rut-1", name: "Full body" };
const TOTAL_DAYS = 4;

// Doble de `sb`: guarda filas en memoria; cada comportamiento es sobrescribible.
function makeSb(opts) {
  const o = opts || {};
  const rows = (o.rows || []).slice();
  const calls = { getSesiones: 0, addSesion: 0, week: 0, updateRutina: 0 };
  const sb = {
    rows,
    calls,
    getSesiones: async function () {
      calls.getSesiones++;
      if (o.getSesiones) return o.getSesiones(calls.getSesiones, rows);
      return rows.slice().reverse();
    },
    addSesion: async function (payload) {
      calls.addSesion++;
      if (o.addSesion) return o.addSesion(payload, rows, calls.addSesion);
      const row = Object.assign({ id: "s" + calls.addSesion, created_at: "2026-10-03T10:00:00" }, payload);
      rows.push(row);
      return [row];
    },
    getSesionesByAlumnoRutinaSemana: async function (a, r, n, w) {
      calls.week++;
      if (o.week) return o.week(rows, w);
      return rows.filter(function (x) { return x.rutina_id === r && Number(x.semana) === Number(w); });
    },
  };
  return sb;
}

function params(sb, extra) {
  const payload = removeUndefinedPayloadFields(buildSessionPayload({
    alumnoId: ALUMNO,
    session: { dIdx: 3 },
    activeDay: { label: "Dia 4", exercises: [{ id: "a" }, { id: "b" }] },
    activeRoutine: RUTINA,
    weekToSave: 1,
    date: HOY,
    time: "10:15",
    includeRoutineId: true,
  }));
  return Object.assign({
    sb,
    alumnoId: ALUMNO,
    payload,
    date: HOY,
    dayIndex: 3,
    weekToSave: 1,
    isOnline: true,
    effectiveWeek: 0,
    totalDays: TOTAL_DAYS,
    lastAdvanceDate: null,
    todayStr: "Sat Oct 03 2026",
    rutinaId: RUTINA.id,
    rutinaNombre: RUTINA.name,
    timeoutMs: 30,
    updateRutinaWeek: async function () { sb.calls.updateRutina++; return [{ id: RUTINA.id }]; },
  }, extra || {});
}

function weekRows(days, extra) {
  return days.map(function (d, i) {
    return Object.assign({ id: "w" + i, alumno_id: ALUMNO, rutina_id: RUTINA.id, dia_idx: d, semana: 1, fecha: "29/9/2026" }, extra || {});
  });
}

const never = function () { return new Promise(function () {}); };

// 1. sesion ya existente -> sin POST, exito.
await test("1 sesion ya existente: no POST y cuenta como confirmada", async () => {
  const sb = makeSb({ rows: [{ alumno_id: ALUMNO, rutina_id: "rut-1", dia_idx: 3, semana: 1, fecha: "03/10/2026" }] });
  const r = await persistSessionConfirmed(params(sb));
  assert.equal(r.confirmed, true);
  assert.equal(r.source, SESSION_CONFIRMED_BY.EXISTING);
  assert.equal(sb.calls.addSesion, 0);
});

// 2. POST exitoso.
await test("2 POST exitoso devuelve fila: confirmada por insert (1 solo POST)", async () => {
  const sb = makeSb();
  const r = await persistSessionConfirmed(params(sb));
  assert.deepEqual(r, { confirmed: true, source: SESSION_CONFIRMED_BY.INSERT });
  assert.equal(sb.calls.addSesion, 1);
  assert.equal(sb.rows.length, 1);
});

// 3. POST devuelve null y el GET de comprobacion no la encuentra -> fallo.
await test("3 POST null + GET de comprobacion sin fila: fallo reintentable", async () => {
  const sb = makeSb({ addSesion: async () => null });
  const out = await finalizeStudentSession(params(sb));
  assert.deepEqual(out, { status: "failed", reason: FINALIZE_FAILURE.UNCONFIRMED });
  assert.equal(sb.calls.addSesion, 1);
  assert.equal(sb.calls.getSesiones, 2, "GET previo + GET de comprobacion");
  assert.equal(sb.rows.length, 0);
  // null y arrays vacios NO son exito
  assert.equal(isValidInsertedRow(null), false);
  assert.equal(isValidInsertedRow([]), false);
  assert.equal(isValidInsertedRow([{ id: 1 }]), true);
});

// 4. POST lanza -> fallo reintentable.
await test("4 POST rechaza + GET sin fila: fallo reintentable, no lanza", async () => {
  const sb = makeSb({ addSesion: async () => { throw new TypeError("Failed to fetch"); } });
  const out = await finalizeStudentSession(params(sb));
  assert.deepEqual(out, { status: "failed", reason: FINALIZE_FAILURE.UNCONFIRMED });
  assert.equal(sb.calls.addSesion, 1);
});

// 5. Respuesta perdida: el POST guarda pero lanza; el GET posterior la encuentra.
await test("5 respuesta perdida: POST guarda y lanza, GET posterior la encuentra -> exito sin 2.o POST", async () => {
  const sb = makeSb({
    addSesion: async (payload, rows) => {
      rows.push(Object.assign({ id: "lost" }, payload));
      throw new TypeError("network lost");
    },
  });
  const out = await finalizeStudentSession(params(sb));
  assert.equal(out.status, "saved");
  assert.equal(out.source, SESSION_CONFIRMED_BY.VERIFIED);
  assert.equal(sb.calls.addSesion, 1);
  assert.equal(sb.rows.length, 1);
});

await test("5b respuesta perdida por timeout (POST nunca responde) y fila guardada -> exito", async () => {
  const sb = makeSb({
    addSesion: (payload, rows) => { rows.push(Object.assign({ id: "slow" }, payload)); return never(); },
  });
  const out = await finalizeStudentSession(params(sb, { timeoutMs: 20 }));
  assert.equal(out.status, "saved");
  assert.equal(out.source, SESSION_CONFIRMED_BY.VERIFIED);
  assert.equal(sb.calls.addSesion, 1);
});

await test("5c POST con timeout y fila ausente -> fallo (el boton se puede rehabilitar, no queda colgado)", async () => {
  const sb = makeSb({ addSesion: () => never() });
  const out = await finalizeStudentSession(params(sb, { timeoutMs: 20 }));
  assert.equal(out.status, "failed");
  assert.equal(out.reason, FINALIZE_FAILURE.UNCONFIRMED);
});

// 6. Doble FINALIZAR: el guard deja pasar una sola finalizacion en vuelo.
await test("6 doble FINALIZAR: una sola finalizacion remota en vuelo", async () => {
  const sb = makeSb({
    addSesion: async (payload, rows) => {
      await new Promise((res) => setTimeout(res, 10));
      const row = Object.assign({ id: "one" }, payload);
      rows.push(row);
      return [row];
    },
  });
  const guard = createFinalizeGuard();
  async function tap() {
    if (!guard.acquire()) return "ignored";
    try { return (await finalizeStudentSession(params(sb))).status; } finally { guard.release(); }
  }
  const results = await Promise.all([tap(), tap(), tap()]);
  assert.deepEqual(results.slice().sort(), ["ignored", "ignored", "saved"]);
  assert.equal(sb.calls.addSesion, 1);
  assert.equal(guard.isBusy(), false, "el guard se libera tras exito");
  // y tras fallo
  const sbFail = makeSb({ addSesion: async () => null });
  assert.equal(guard.acquire(), true);
  try { await finalizeStudentSession(params(sbFail)); } finally { guard.release(); }
  assert.equal(guard.isBusy(), false, "el guard se libera tras fallo");
});

// 5/retry. Retry despues de un fallo.
await test("retry tras fallo: segundo intento exitoso, una sola fila", async () => {
  let attempt = 0;
  const sb = makeSb({
    addSesion: async (payload, rows) => {
      attempt++;
      if (attempt === 1) return null;
      const row = Object.assign({ id: "r" }, payload);
      rows.push(row);
      return [row];
    },
  });
  const first = await finalizeStudentSession(params(sb));
  assert.equal(first.status, "failed");
  const second = await finalizeStudentSession(params(sb));
  assert.equal(second.status, "saved");
  assert.equal(sb.rows.length, 1);
});

await test("retry tras respuesta perdida: el GET previo encuentra la fila y NO duplica", async () => {
  const sb = makeSb({
    addSesion: async (payload, rows) => { rows.push(Object.assign({ id: "x" }, payload)); return null; },
    getSesiones: (n, rows) => (n === 2 ? [] : rows.slice()), // la comprobacion 'no ve' la fila (replica lenta)
  });
  const first = await finalizeStudentSession(params(sb));
  assert.equal(first.status, "failed");
  const second = await finalizeStudentSession(params(sb));
  assert.equal(second.status, "saved");
  assert.equal(second.source, SESSION_CONFIRMED_BY.EXISTING);
  assert.equal(sb.rows.length, 1);
  assert.equal(sb.calls.addSesion, 1);
});

// GET previo no resoluble -> no se hace POST (no se sabe si existe).
await test("GET previo null/throw: fallo sin POST (evita duplicar a ciegas)", async () => {
  const sbNull = makeSb({ getSesiones: async () => null });
  const a = await finalizeStudentSession(params(sbNull));
  assert.deepEqual(a, { status: "failed", reason: FINALIZE_FAILURE.LOOKUP_FAILED });
  assert.equal(sbNull.calls.addSesion, 0);
  const sbThrow = makeSb({ getSesiones: async () => { throw new TypeError("offline"); } });
  const b = await finalizeStudentSession(params(sbThrow));
  assert.equal(b.reason, FINALIZE_FAILURE.LOOKUP_FAILED);
  assert.equal(sbThrow.calls.addSesion, 0);
});

// 7/9/10. Efectos locales: wiring estatico de WorkoutScreen.
await test("7/9/10 WorkoutScreen: completar/resumen/cerrar solo despues de 'saved' (wiring)", () => {
  const src = readFileSync(new URL("../components/WorkoutScreen.jsx", import.meta.url), "utf8");
  const start = src.indexOf("const finalizarSesion = async");
  const fnSrc = src.slice(start, src.indexOf("return (\n    <div style={{ position:\"fixed\"", start));
  const studentStart = fnSrc.indexOf("finalizeStudentSession({");
  const studentEnd = fnSrc.indexOf("// ── Flujo previo");
  assert.ok(studentStart > 0 && studentEnd > studentStart);
  const student = fnSrc.slice(studentStart, studentEnd);
  const gate = student.indexOf('outcome.status !== "saved"');
  assert.ok(gate > 0, "hay compuerta de resultado");
  const returnAfterGate = student.indexOf("return;", gate);
  for (const eff of ["setCompletedDays(", "setResumenSesion(", "setSession(null)", "setCurrentWeek(", "it_last_week_advance_date"]) {
    const idx = student.indexOf(eff);
    assert.ok(idx > returnAfterGate, eff + " debe ir DESPUES de la compuerta (failed -> return)");
  }
  // Antes de la llamada remota no hay efectos en el flujo del alumno.
  const beforeCall = fnSrc.slice(0, studentStart);
  for (const eff of ["setCompletedDays(", "setResumenSesion(", "setSession(null)", "setCurrentWeek("]) {
    assert.ok(!beforeCall.includes(eff), eff + " no debe ejecutarse antes de confirmar");
  }
  // avance de semana: solo con advance === "ok", y it_cd no decide
  assert.ok(student.includes('outcome.week.advance === "ok"'));
  assert.ok(!student.includes("countCompletedDaysForWeek"), "el flujo del alumno no usa it_cd para avanzar");
  // guard liberado en finally
  assert.ok(/finally\s*\{[^}]*release\(\)/.test(student));
});

// 8. ultimo dia + sesion NO confirmada -> sin updateRutina ni avance.
await test("8 ultimo dia + sesion no confirmada: no consulta la semana ni updateRutina", async () => {
  const sb = makeSb({ rows: weekRows([0, 1, 2]), addSesion: async () => null, getSesiones: async () => [] });
  const out = await finalizeStudentSession(params(sb));
  assert.equal(out.status, "failed");
  assert.equal(sb.calls.updateRutina, 0);
  assert.equal(sb.calls.week, 0);
});

// 9. ultimo dia + sesion confirmada + semana completa -> updateRutina 1 vez.
await test("9 ultimo dia + confirmada + semana completa: updateRutina una vez y advance=ok", async () => {
  const sb = makeSb({ rows: weekRows([0, 1, 2]) });
  const out = await finalizeStudentSession(params(sb));
  assert.equal(out.status, "saved");
  assert.equal(out.week.complete, true);
  assert.equal(out.week.advance, "ok");
  assert.equal(sb.calls.updateRutina, 1);
});

await test("9b semana incompleta: no avanza y no llama updateRutina", async () => {
  const sb = makeSb({ rows: weekRows([0, 1]) });
  const out = await finalizeStudentSession(params(sb));
  assert.equal(out.week.complete, false);
  assert.equal(out.week.advance, "not_needed");
  assert.equal(sb.calls.updateRutina, 0);
});

await test("9c semana 4 (effectiveWeek 3) o ya avanzo hoy: no avanza", async () => {
  const sb1 = makeSb({ rows: weekRows([0, 1, 2]) });
  const a = await finalizeStudentSession(params(sb1, { effectiveWeek: 3 }));
  assert.equal(a.week.advance, "not_needed");
  const sb2 = makeSb({ rows: weekRows([0, 1, 2]) });
  const b = await finalizeStudentSession(params(sb2, { lastAdvanceDate: "Sat Oct 03 2026" }));
  assert.equal(b.week.advance, "not_needed");
  assert.equal(sb1.calls.updateRutina + sb2.calls.updateRutina, 0);
});

// 10. logout/login: it_cd vacio, sesiones persistidas suficientes (otro dispositivo).
await test("10 it_cd vacio (post-login): la semana se reconoce completa desde sesiones persistidas", async () => {
  // El helper ni recibe it_cd: solo sesiones persistidas.
  const sb = makeSb({ rows: weekRows([0, 1, 2], { fecha: "28/9/2026" }) });
  const out = await finalizeStudentSession(params(sb));
  assert.equal(out.week.complete, true);
  assert.equal(out.week.advance, "ok");
});

// 11. duplicados no inflan dias.
await test("11 sesiones duplicadas: se cuentan dia_idx distintos", () => {
  const rows = weekRows([0, 0, 1, 1, 1]);
  assert.equal(countPersistedDistinctDays(rows, { weekToSave: 1, totalDays: 4 }), 2);
  assert.equal(countPersistedDistinctDays(rows, { weekToSave: 1, totalDays: 4, confirmedDayIdx: 1 }), 2);
  assert.equal(countPersistedDistinctDays(rows, { weekToSave: 1, totalDays: 4, confirmedDayIdx: 3 }), 3);
  // otra semana / fuera de rango / nulos no cuentan
  assert.equal(countPersistedDistinctDays([{ dia_idx: 0, semana: 2 }, { dia_idx: 9, semana: 1 }, { dia_idx: null, semana: 1 }], { weekToSave: 1, totalDays: 4 }), 0);
});

await test("11b duplicados no completan la semana: 3 filas del mismo dia != 3 dias", async () => {
  const sb = makeSb({ rows: weekRows([0, 0, 0]), week: (rows) => rows });
  const out = await finalizeStudentSession(params(sb, { dayIndex: 0 }));
  assert.equal(out.status, "saved");
  assert.equal(out.week.complete, false);
  assert.equal(sb.calls.updateRutina, 0);
});

// 12. updateRutina falla despues de guardar.
await test("12 updateRutina null/vacio/throw: la sesion queda saved, advance=failed (sin avance local)", async () => {
  for (const bad of [async () => null, async () => [], async () => { throw new Error("boom"); }]) {
    const sb = makeSb({ rows: weekRows([0, 1, 2]) });
    const out = await finalizeStudentSession(params(sb, { updateRutinaWeek: bad }));
    assert.equal(out.status, "saved");
    assert.equal(out.week.advance, "failed");
    assert.equal(sb.rows.length, 4, "una sola fila nueva, sin duplicar ni borrar");
  }
  // y en el componente solo se avanza con "ok" (ver test 7/9/10)
});

await test("12b no se pudo leer la semana: saved + advance=unverified (no avanza)", async () => {
  const sb = makeSb({ rows: weekRows([0, 1, 2]), week: async () => { throw new Error("db"); } });
  const out = await finalizeStudentSession(params(sb));
  assert.equal(out.status, "saved");
  assert.equal(out.week.advance, "unverified");
  assert.equal(sb.calls.updateRutina, 0);
});

// 13. offline fast-fail.
await test("13 offline: sin POST ni GET, fallo 'offline'", async () => {
  const sb = makeSb();
  const out = await finalizeStudentSession(params(sb, { isOnline: false }));
  assert.deepEqual(out, { status: "failed", reason: FINALIZE_FAILURE.OFFLINE });
  assert.equal(sb.calls.addSesion, 0);
  assert.equal(sb.calls.getSesiones, 0);
});

// 14. payload.
await test("14 payload: semana base 1, dia_idx base 0, fecha d/m/aaaa, rutina_id presente", () => {
  const p = params(makeSb()).payload;
  assert.equal(p.semana, 1);
  assert.equal(p.dia_idx, 3);
  assert.match(p.fecha, /^\d{1,2}\/\d{1,2}\/\d{4}$/);
  assert.equal(p.rutina_id, "rut-1");
  assert.equal(p.alumno_id, ALUMNO);
  assert.equal(p.ejercicios, "a,b");
  assert.equal(p.hora, "10:15");
  // fecha de hoy real en es-AR con el formato esperado por normalizeFecha
  assert.match(new Date().toLocaleDateString("es-AR"), /^\d{1,2}\/\d{1,2}\/\d{4}$/);
});

// Extra: la sesion se guarda con la semana base 1 (effectiveWeek+1) y el POST lleva ese payload.
await test("extra: el POST recibe el payload exacto", async () => {
  const sb = makeSb();
  const pr = params(sb);
  await finalizeStudentSession(pr);
  const sent = sb.rows[0];
  assert.equal(sent.semana, 1);
  assert.equal(sent.dia_idx, 3);
  assert.equal(sent.fecha, HOY);
});

console.log("\n" + count + " tests OK");
