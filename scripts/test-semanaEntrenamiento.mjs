// P0-1: serie y sesion de UN entrenamiento usan la misma semana (y ciclo).   node scripts/test-semanaEntrenamiento.mjs
// Sin red ni Supabase. Las pruebas 1-2 reproducen el defecto con las funciones reales y la formula anterior de App.jsx/WorkoutScreen.jsx.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getActiveStudentRoutinePosition } from "../lib/studentWeeklyProgress.js";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { buildReinicioDatos, readCicloActual } from "../lib/rutinaCiclo.js";
import {
  MOTIVO_CONFLICTO, semanaIdxToSesion, semanaSesionToIdx, semanaIdxValida, cicloVivoDeSesion,
  resolverSemanaEntrenamiento, textoConflictoSemana,
} from "../lib/semanaEntrenamiento.js";
import { progresoSemanaToSesionSemana } from "../lib/orphanSessions.js";
import {
  buildPendingProgressItem, buildProgressPayload, buildSessionPayload, removeUndefinedPayloadFields,
  calculateWorkoutVolume, buildNewSessionPRList, buildExerciseSetRecord, updateExerciseProgressRecord,
} from "../lib/workoutSession.js";
import { persistSessionConfirmed } from "../lib/finalizeWorkoutSession.js";
import { cumplimientoSesiones } from "../lib/cumplimiento/sesiones.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const ALU = "alu-1";
const dias = [{ label: "D1", exercises: [{ id: "ex1", sets: "3", reps: "8" }] }, { label: "D2", exercises: [{ id: "ex2", sets: "3", reps: "8" }] }];
const rutina = (extra) => Object.assign({ id: "R1", name: "Rutina 1", nombre: "Rutina 1", alumno_id: ALU, created_at: "2026-01-01T00:00:00Z",
  days: dias, datos: { days: dias, semana_activa: 1, ciclo_actual: 1 } }, extra || {});
const sesFila = (extra) => Object.assign({ id: "s0", alumno_id: ALU, rutina_id: "R1", dia_idx: 0, semana: 2, ciclo: 1, fecha: "5/11/2026", created_at: "2026-11-05T10:00:00Z" }, extra || {});
const memStorage = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; };

// Formulas ANTERIORES (referencia del defecto): App.jsx logSet y WorkoutScreen.jsx finalizarSesion.
const legadoSerie = (visibleIdx, persistida, local) => {
  const eff = Number.isFinite(persistida) && persistida >= 1 && persistida <= 4 ? persistida - 1 : local;
  return Number.isFinite(Number(visibleIdx)) ? Number(visibleIdx) : eff;   // weekOverride (el panel siempre lo manda) pisa a semana_activa
};
const legadoSesion = (persistida, local) => (Number.isFinite(persistida) && persistida >= 1 && persistida <= 4 ? persistida - 1 : local) + 1;
const posicion = (r, sesiones) => getActiveStudentRoutinePosition({ alumno: ALU, rutina: r, sesiones, completedDays: [], currentWeek: 0 });

await test("1 DEFECTO (formula anterior): studentCurrentWeek != semana_activa => serie en una semana y sesion en otra", () => {
  const r = rutina();                                   // semana_activa = 1
  const pos = posicion(r, [sesFila({ semana: 2 })]);     // hay una sesion de la semana 2 (otro dispositivo / validacion del entrenador)
  assert.equal(pos.currentWeek, 1, "el alumno VE la semana 2 (indice 1)");
  const semanaSerie = legadoSerie(pos.currentWeek, 1, 0);          // progreso.semana
  const semanaSesion = legadoSesion(1, 0);                          // sesiones.semana
  assert.equal(semanaSerie + 1, 2);
  assert.equal(semanaSesion, 1);
  assert.notEqual(semanaSerie + 1, semanaSesion, "defecto: misma sesion en semanas distintas");
});
await test("2 CORRECCION: con la semana congelada serie y sesion coinciden (la que ve el alumno)", () => {
  const r = rutina();
  const pos = posicion(r, [sesFila({ semana: 2 })]);
  const session = prepararInicioEntrenamiento({ storage: memStorage(), session: { rId: "R1", dIdx: 0, exIdx: 0, startTime: Date.now() }, alumnoId: ALU, ciclo: 1, semana: pos.currentWeek, now: Date.now() }).session;
  const res = resolverSemanaEntrenamiento({ session, semanaVisibleIdx: pos.currentWeek, cicloVivo: 1, semanaLegadaIdx: 0 });
  assert.equal(res.ok, true); assert.equal(res.fuente, "sesion");
  assert.equal(res.semanaProgreso, 1);
  assert.equal(res.semanaSesion, 2);
  assert.equal(res.semanaSesion, res.semanaProgreso + 1);
});

await test("3 semana 1 y semana 4, y conversion base 0/base 1 centralizada", () => {
  for (const idx of [0, 1, 2, 3]) {
    assert.equal(semanaIdxToSesion(idx), idx + 1);
    assert.equal(semanaIdxToSesion(idx), progresoSemanaToSesionSemana(idx), "reutiliza la conversion existente");
    assert.equal(semanaSesionToIdx(semanaIdxToSesion(idx)), idx);
    const s = prepararInicioEntrenamiento({ storage: memStorage(), session: { rId: "R1", dIdx: 0 }, alumnoId: ALU, ciclo: 1, semana: idx, now: Date.now() }).session;
    assert.equal(s.semanaIdx, idx);
    const res = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: idx, cicloVivo: 1 });
    assert.deepEqual([res.ok, res.semanaProgreso, res.semanaSesion], [true, idx, idx + 1]);
  }
  for (const malo of [4, -1, 1.5, "1", null, undefined, true, NaN]) {
    assert.equal(semanaIdxValida(malo), null); assert.equal(semanaIdxToSesion(malo), null);
  }
  for (const malo of [0, 5, "2", null, 2.5]) assert.equal(semanaSesionToIdx(malo), null);
});

await test("4 la semana visible cambia durante el entrenamiento: conflicto, nada contradictorio", () => {
  const s = { rId: "R1", dIdx: 0, semanaIdx: 0, ciclo: 1 };
  const r = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 1, cicloVivo: 1 });
  assert.equal(r.ok, false); assert.equal(r.motivo, MOTIVO_CONFLICTO.SEMANA);
  assert.equal(r.semanaIdx, 0); assert.equal(r.visibleIdx, 1);
  assert.match(textoConflictoSemana(r.motivo, true), /semana/i);
  assert.match(textoConflictoSemana(r.motivo, false), /week/i);
});
await test("5 reconciliacion asincrona durante el entrenamiento: semana_activa avanza => conflicto", () => {
  const r1 = rutina();                                              // al iniciar: semana_activa 1
  const inicio = posicion(r1, []).currentWeek; assert.equal(inicio, 0);
  const s = prepararInicioEntrenamiento({ storage: memStorage(), session: { rId: "R1", dIdx: 0 }, alumnoId: ALU, ciclo: 1, semana: inicio, now: Date.now() }).session;
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: posicion(r1, []).currentWeek, cicloVivo: 1 }).ok, true);
  const r2 = rutina({ datos: { days: dias, semana_activa: 2, ciclo_actual: 1 } });   // applySemanaActivaToRutinas (App.jsx:1772)
  const ahora = posicion(r2, []).currentWeek; assert.equal(ahora, 1);
  const res = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: ahora, cicloVivo: 1 });
  assert.equal(res.ok, false); assert.equal(res.motivo, "semana_cambio");
});
await test("6 reinicio de semana y cambio de ciclo durante el entrenamiento: conflicto de ciclo", () => {
  const datos = { days: dias, semana_activa: 2, ciclo_actual: 1 };
  const s = { rId: "R1", dIdx: 0, semanaIdx: 1, ciclo: readCicloActual(datos) };
  for (const tipo of ["semana", "rutina"]) {
    const nuevo = buildReinicioDatos(datos, { tipo, semana: 2 });
    const vivo = cicloVivoDeSesion([rutina({ datos: nuevo })], s);
    assert.equal(vivo, 2);
    const res = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 1, cicloVivo: vivo });
    assert.equal(res.ok, false); assert.equal(res.motivo, MOTIVO_CONFLICTO.CICLO);
    assert.equal(res.ciclo, 1); assert.equal(res.cicloVivo, 2);
  }
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 1, cicloVivo: 1 }).ok, true);
});
await test("7 cambio de rutina: el ciclo vivo sale de la rutina del ENTRENAMIENTO, no de routines[0]", () => {
  const r1 = rutina({ id: "R1", datos: { days: dias, semana_activa: 1, ciclo_actual: 3 } });
  const r2 = rutina({ id: "R2", datos: { days: dias, semana_activa: 1, ciclo_actual: 1 } });
  const s = { rId: "R2", dIdx: 0, semanaIdx: 0, ciclo: 1 };
  assert.equal(cicloVivoDeSesion([r1, r2], s), 1);
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 0, cicloVivo: cicloVivoDeSesion([r1, r2], s) }).ok, true);
  assert.equal(cicloVivoDeSesion([r1], s), null, "rutina del entrenamiento ya no esta: no se puede comparar");
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 0, cicloVivo: null }).ok, true, "sin dato vivo no se inventa un conflicto");
  assert.equal(cicloVivoDeSesion([r1, r2], null), null);
});

await test("8 entrenamiento nocturno: la semana congelada sobrevive a la medianoche y a la recarga (ancla)", () => {
  const st = memStorage();
  const t1 = new Date(2026, 10, 12, 23, 55).getTime(), t2 = new Date(2026, 10, 13, 0, 10).getTime();
  const a = prepararInicioEntrenamiento({ storage: st, session: { rId: "R1", dIdx: 0 }, alumnoId: ALU, ciclo: 1, semana: 2, now: t1 });
  const b = prepararInicioEntrenamiento({ storage: st, session: { rId: "R1", dIdx: 0 }, alumnoId: ALU, ciclo: 1, semana: 2, now: t2 });
  assert.equal(b.recuperada, true);
  assert.equal(a.session.semanaIdx, 2); assert.equal(b.session.semanaIdx, 2);
  assert.equal(b.session.fecha, a.session.fecha);
  // si la semana cambio entre medio: sesion NUEVA (otra fecha y otra semana), nunca mezcla semanas en una sola sesion
  const c = prepararInicioEntrenamiento({ storage: st, session: { rId: "R1", dIdx: 0 }, alumnoId: ALU, ciclo: 1, semana: 3, now: t2 + 1000 });
  assert.equal(c.recuperada, false); assert.equal(c.motivo, "otra_semana"); assert.equal(c.session.semanaIdx, 3);
});
await test("9 compatibilidad: sesion sin semana congelada (o semana invalida) => comportamiento anterior", () => {
  for (const sem of [undefined, null, 4, -1, "1", NaN]) {
    const s = prepararInicioEntrenamiento({ storage: memStorage(), session: { rId: "R1", dIdx: 0 }, alumnoId: ALU, ciclo: 1, semana: sem, now: Date.now() }).session;
    assert.equal("semanaIdx" in s, false);
  }
  const res = resolverSemanaEntrenamiento({ session: { rId: "R1", dIdx: 0 }, semanaVisibleIdx: 3, cicloVivo: 5, semanaLegadaIdx: 1, cicloLegado: 5 });
  assert.deepEqual([res.ok, res.fuente, res.semanaProgreso, res.semanaSesion, res.ciclo], [true, "legado", 1, 2, 5]);
  assert.equal(resolverSemanaEntrenamiento({ session: null }).ok, true);
});

await test("10 reintento de series pendientes: la semana queda fijada en el item y el payload coincide (mismo opId)", () => {
  const opId = "6f1f3f4e-1c43-4d3a-9a52-0d9d1e1b7c11";
  const res = resolverSemanaEntrenamiento({ session: { rId: "R1", dIdx: 0, semanaIdx: 3, ciclo: 2 }, semanaVisibleIdx: 3, cicloVivo: 2 });
  const item = buildPendingProgressItem("ex1", 60, 8, "", "12/11/2026", res.semanaProgreso, res.ciclo, ALU, opId);
  const p1 = buildProgressPayload(ALU, "ex1", 60, 8, "", "12/11/2026", item.semana, item.ciclo, opId);
  const p2 = buildProgressPayload(ALU, "ex1", 60, 8, "", "12/11/2026", item.semana, item.ciclo, opId);
  assert.deepEqual(p1, p2);
  assert.equal(p1.semana, 3); assert.equal(p1.ciclo, 2); assert.equal(p1.id, opId);
  // aunque despues haya conflicto, la serie ya encolada no cambia de semana
  assert.equal(resolverSemanaEntrenamiento({ session: { semanaIdx: 3, ciclo: 2 }, semanaVisibleIdx: 0, cicloVivo: 2 }).ok, false);
  assert.equal(item.semana, 3);
});
await test("11 finalizacion duplicada: misma semana y rutina => 1 solo POST; el payload lleva semana = indice + 1", async () => {
  const rows = []; let posts = 0;
  const sb = { getSesiones: async () => rows.slice(), addSesion: async (p) => { posts++; const r = Object.assign({ id: "s" + posts }, p); rows.push(r); return [r]; } };
  const res = resolverSemanaEntrenamiento({ session: { rId: "R1", dIdx: 1, semanaIdx: 1, ciclo: 1 }, semanaVisibleIdx: 1, cicloVivo: 1 });
  const payload = removeUndefinedPayloadFields(buildSessionPayload({ alumnoId: ALU, session: { dIdx: 1 }, activeDay: dias[1], activeRoutine: { id: "R1", name: "Rutina 1" },
    exercises: dias[1].exercises, weekToSave: res.semanaSesion, date: "12/11/2026", time: "10:00", includeRoutineId: true, ciclo: res.ciclo }));
  assert.equal(payload.semana, 2);
  const prm = { sb, alumnoId: ALU, payload, date: "12/11/2026", dayIndex: 1, weekToSave: res.semanaSesion, ciclo: res.ciclo, isOnline: true, rutinaId: "R1", timeoutMs: 50 };
  const a = await persistSessionConfirmed(prm); const b = await persistSessionConfirmed(prm);
  assert.deepEqual([a.source, b.source, posts, rows.length], ["insert", "existing", 1, 1]);
});

await test("12 regresion: cumplimiento, volumen y PR no cambian con series/sesion en la misma semana", () => {
  const r = rutina({ datos: { days: dias, semana_activa: 2, ciclo_actual: 1 } });
  const c = cumplimientoSesiones({ alumnoId: ALU, rutina: r, sesiones: [sesFila({ semana: 2, dia_idx: 0 }), sesFila({ id: "s1", semana: 2, dia_idx: 1 })], historialCompleto: true });
  assert.equal(c.ok, true);
  assert.deepEqual(c.semanas[1].diasCompletados, [0, 1]);
  let progress = {};
  const sem = semanaSesionToIdx(2);
  progress.ex1 = updateExerciseProgressRecord(undefined, buildExerciseSetRecord(50, 8, "12/11/2026", sem, "", null, 1));
  progress.ex1 = updateExerciseProgressRecord(progress.ex1, buildExerciseSetRecord(60, 5, "12/11/2026", sem, "", null, 1));
  assert.equal(calculateWorkoutVolume(dias[0].exercises, progress, "12/11/2026", 1), 50 * 8 + 60 * 5);
  const prs = buildNewSessionPRList(dias[0].exercises, progress, { ex1: 40 }, "12/11/2026");
  assert.equal(prs.length, 1); assert.equal(prs[0].kg, 60);
});

await test("13 cableado: logSet y finalizarSesion usan resolverSemanaEntrenamiento y la semana congelada", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const ws = readFileSync(new URL("../components/WorkoutScreen.jsx", import.meta.url), "utf8");
  const logSet = app.slice(app.indexOf("const logSet = ("), app.indexOf("const logSet = (") + 3500);
  assert.ok(logSet.includes("resolverSemanaEntrenamiento("), "logSet");
  assert.ok(ws.includes("resolverSemanaEntrenamiento("), "WorkoutScreen");
  assert.ok(ws.includes("semanaRes.semanaSesion"), "la sesion se guarda con la semana resuelta");
  assert.ok(app.includes("cicloVivoDeSesion(") && ws.includes("cicloVivoDeSesion("), "ciclo de la rutina del entrenamiento");
});

console.log("\n" + count + " pruebas OK");
