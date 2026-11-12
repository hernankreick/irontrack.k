// P0-1: serie y sesion de UN entrenamiento usan la misma semana (y ciclo).   node scripts/test-semanaEntrenamiento.mjs
// Sin red ni Supabase. Las pruebas 1-2 reproducen el defecto con las funciones reales y la formula anterior de App.jsx/WorkoutScreen.jsx.

import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { updateRutinaSemanaActiva } from "../lib/updateRutinaSemanaActiva.js";
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
import { persistSessionConfirmed, finalizeStudentSession } from "../lib/finalizeWorkoutSession.js";
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

await test("4 la semana visible cambia durante el entrenamiento: NO bloquea (semana congelada) y se informa", () => {
  const s = { rId: "R1", dIdx: 0, semanaIdx: 0, ciclo: 1 };
  const r = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 1, cicloVivo: 1 });
  assert.equal(r.ok, true); assert.equal(r.fuente, "sesion");
  assert.equal(r.semanaVisibleCambio, true);
  assert.deepEqual([r.semanaProgreso, r.semanaSesion, r.ciclo], [0, 1, 1]);
  const igual = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 0, cicloVivo: 1 });
  assert.deepEqual([igual.ok, igual.semanaVisibleCambio], [true, false]);
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: null, cicloVivo: 1 }).semanaVisibleCambio, false);
  assert.match(textoConflictoSemana(MOTIVO_CONFLICTO.CICLO, true), /reinici/i);
  assert.match(textoConflictoSemana(MOTIVO_CONFLICTO.CICLO, false), /restarted/i);
});
await test("5 reconciliacion asincrona durante el entrenamiento: semana_activa avanza => sigue valido, en la semana congelada", () => {
  const r1 = rutina();                                              // al iniciar: semana_activa 1
  const inicio = posicion(r1, []).currentWeek; assert.equal(inicio, 0);
  const s = prepararInicioEntrenamiento({ storage: memStorage(), session: { rId: "R1", dIdx: 0 }, alumnoId: ALU, ciclo: 1, semana: inicio, now: Date.now() }).session;
  const r2 = rutina({ datos: { days: dias, semana_activa: 2, ciclo_actual: 1 } });   // applySemanaActivaToRutinas (App.jsx:1772)
  const ahora = posicion(r2, []).currentWeek; assert.equal(ahora, 1);
  const res = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: ahora, cicloVivo: 1 });
  assert.deepEqual([res.ok, res.semanaProgreso, res.semanaSesion, res.semanaVisibleCambio], [true, 0, 1, true]);
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
  // aunque despues haya un conflicto de ciclo (o la semana visible cambie), la serie ya encolada no cambia de semana ni de ciclo
  assert.equal(resolverSemanaEntrenamiento({ session: { semanaIdx: 3, ciclo: 2 }, semanaVisibleIdx: 0, cicloVivo: 3 }).ok, false);
  assert.equal(resolverSemanaEntrenamiento({ session: { semanaIdx: 3, ciclo: 2 }, semanaVisibleIdx: 0, cicloVivo: 2 }).ok, true);
  assert.deepEqual([item.semana, item.ciclo], [3, 2]);
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

await test("14 ESCENARIO: semana 1, 3 series, avance automatico a semana 2, 4a serie y finalizacion correcta en semana 1", async () => {
  const hoy = "12/11/2026";
  let datos = { days: dias, semana_activa: 1, ciclo_actual: 1 };
  const session = prepararInicioEntrenamiento({ storage: memStorage(), session: { rId: "R1", dIdx: 0, exIdx: 0, startTime: Date.now() }, alumnoId: ALU, ciclo: 1, semana: posicion(rutina({ datos }), []).currentWeek, now: Date.now() }).session;
  assert.equal(session.semanaIdx, 0);
  const items = [];
  const logSerie = (n, kg) => {
    const visible = posicion(rutina({ datos }), []).currentWeek;                       // lo que ve el panel segun el plan vivo
    const res = resolverSemanaEntrenamiento({ session, semanaVisibleIdx: visible, cicloVivo: cicloVivoDeSesion([rutina({ datos })], session) });
    assert.equal(res.ok, true, "serie " + n);
    items.push(buildPendingProgressItem("ex1", kg, 8, "", hoy, res.semanaProgreso, res.ciclo, ALU, "00000000-0000-4000-8000-00000000000" + n));
    return res;
  };
  logSerie(1, 50); logSerie(2, 52); logSerie(3, 54);
  datos = Object.assign({}, datos, { semana_activa: 2 });                              // reconciliacion automatica
  const cuarta = logSerie(4, 56);
  assert.equal(cuarta.semanaVisibleCambio, true);
  assert.deepEqual(items.map((i) => i.semana), [0, 0, 0, 0], "las 4 series en la semana 1 (indice 0)");
  // finalizacion
  const fin = resolverSemanaEntrenamiento({ session, semanaVisibleIdx: 1, cicloVivo: 1 });
  assert.equal(fin.ok, true); assert.equal(fin.semanaSesion, 1);
  const rows = []; let posts = 0; let avances = 0;
  const sb = {
    getSesiones: async () => rows.slice(),
    addSesion: async (p) => { posts++; const r = Object.assign({ id: "s" + posts }, p); rows.push(r); return [r]; },
    getSesionesByAlumnoRutinaSemana: async () => rows.slice(),
  };
  const payload = removeUndefinedPayloadFields(buildSessionPayload({ alumnoId: ALU, session, activeDay: dias[0], activeRoutine: { id: "R1", name: "Rutina 1" },
    exercises: dias[0].exercises, weekToSave: fin.semanaSesion, date: hoy, time: "10:00", includeRoutineId: true, ciclo: fin.ciclo }));
  const prm = { sb, alumnoId: ALU, payload, date: hoy, dayIndex: 0, weekToSave: fin.semanaSesion, ciclo: fin.ciclo, isOnline: true, rutinaId: "R1",
    rutinaNombre: "Rutina 1", effectiveWeek: fin.semanaIdx, totalDays: 2, lastAdvanceDate: null, todayStr: "x", timeoutMs: 50,
    updateRutinaWeek: async () => { avances++; return [{}]; } };
  const out = await finalizeStudentSession(prm);
  assert.equal(out.status, "saved");
  assert.equal(payload.semana, 1, "la sesion queda en la semana 1");
  assert.equal(items[3].semana + 1, payload.semana, "misma semana logica que la 4a serie");
  assert.deepEqual([out.week.complete, out.week.advance, avances], [false, "not_needed", 0], "1 de 2 dias: no avanza nada");
  // finalizacion duplicada / reintento: un unico POST
  const otra = await finalizeStudentSession(prm);
  assert.equal(otra.status, "saved"); assert.equal(posts, 1); assert.equal(rows.length, 1);
  // los items pendientes conservan sus metadatos originales aunque el plan haya avanzado
  const p1 = buildProgressPayload(ALU, "ex1", items[0].kg, items[0].reps, items[0].note, items[0].date, items[0].semana, items[0].ciclo, items[0].opId);
  assert.deepEqual([p1.semana, p1.fecha, p1.id], [0, hoy, items[0].opId]);
});

await test("15 semana 4: respeta el limite del ciclo (no avanza) y el avance nunca retrocede ni se adelanta indebidamente", async () => {
  // semana 4 (indice 3): canAdvance es falso, updateRutinaWeek no se llama
  let llamadas = 0;
  const rows = [];
  const sb = { getSesiones: async () => rows.slice(), addSesion: async (p) => { const r = Object.assign({ id: "s" }, p); rows.push(r); return [r]; }, getSesionesByAlumnoRutinaSemana: async () => rows.slice() };
  const payload = { alumno_id: ALU, rutina_id: "R1", dia_idx: 1, semana: 4, fecha: "12/11/2026" };
  const base = { sb, alumnoId: ALU, payload, date: "12/11/2026", dayIndex: 1, weekToSave: 4, ciclo: 1, isOnline: true, rutinaId: "R1", totalDays: 2,
    lastAdvanceDate: null, todayStr: "x", timeoutMs: 50, effectiveWeek: 3, updateRutinaWeek: async () => { llamadas++; return [{}]; } };
  const o4 = await finalizeStudentSession(base);
  assert.deepEqual([o4.status, o4.week.advance, llamadas], ["saved", "not_needed", 0]);
  // servidor (ruta sin ciclo esperado): monotono
  const mkClient = (semana) => { const w = { updates: 0 }; return { w, from: () => ({
    select: () => ({ eq: async () => ({ data: [{ datos: { semana_activa: semana, ciclo_actual: 1 } }], error: null }) }),
    update: (d) => ({ eq: () => ({ select: async () => { w.updates++; return { data: [{ id: "R1", datos: d.datos }], error: null }; } }) }),
  }) }; };
  const c1 = mkClient(3);                                        // servidor ya en semana 3
  const r1 = await updateRutinaSemanaActiva(c1, "R1", 2);        // avance calculado desde una semana congelada vieja
  assert.equal(c1.w.updates, 0, "no retrocede"); assert.equal(Array.isArray(r1) && r1.length, 1);
  const c2 = mkClient(1);
  await updateRutinaSemanaActiva(c2, "R1", 2); assert.equal(c2.w.updates, 1, "avanza una sola semana");
  const c3 = mkClient(1);
  assert.equal(await updateRutinaSemanaActiva(c3, "R1", 5), null); assert.equal(c3.w.updates, 0, "semana 5 invalida: no escribe");
  // semana 1 congelada con el servidor ya en la 2 (avance automatico): finalizar con semana completa pide la semana 2 => idempotente
  const c4 = mkClient(2);
  const base2 = Object.assign({}, base, { weekToSave: 1, effectiveWeek: 0, payload: Object.assign({}, payload, { dia_idx: 1, semana: 1 }), dayIndex: 1,
    sb: Object.assign({}, sb, { getSesionesByAlumnoRutinaSemana: async () => [{ alumno_id: ALU, rutina_id: "R1", dia_idx: 0, semana: 1, ciclo: 1 }, { alumno_id: ALU, rutina_id: "R1", dia_idx: 1, semana: 1, ciclo: 1 }] }),
    updateRutinaWeek: () => updateRutinaSemanaActiva(c4, "R1", 0 + 2) });
  const o1 = await finalizeStudentSession(base2);
  assert.deepEqual([o1.status, o1.week.complete, o1.week.advance, c4.w.updates], ["saved", true, "ok", 0], "el servidor ya estaba en la 2: no se escribe nada");
});

await test("16 prescripcion visible estable: WorkoutScreen muestra la semana congelada aunque el plan avance (SSR real)", async () => {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-p01-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: { contents: 'import React from "react";import { renderToStaticMarkup } from "react-dom/server";import { WorkoutScreen } from "./components/WorkoutScreen.jsx";export { React, renderToStaticMarkup, WorkoutScreen };',
      resolveDir: ROOT, sourcefile: "p01-entry.jsx", loader: "jsx" },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  const { React, renderToStaticMarkup, WorkoutScreen } = await import(pathToFileURL(outfile).href);
  const noop = () => {};
  const EX = { id: "ex-p01", sets: "3", reps: "8", weeks: [{ sets: "3", reps: "10" }, { sets: "4", reps: "12" }, {}, {}] };
  const render = (session, currentWeek, extra) => renderToStaticMarkup(React.createElement(WorkoutScreen, Object.assign({
    session, activeDay: { name: "D", exercises: [EX] }, activeR: { id: "R1", name: "R", days: [{}], datos: { semana_activa: 2, ciclo_actual: 1 } },
    allEx: [{ id: EX.id, name: "Ejercicio p01", pattern: "rodilla" }], progress: {}, logSet: () => true, startTimer: noop, timer: null,
    setSession: noop, setCompletedDays: noop, completedDays: [], currentWeek, setCurrentWeek: noop, preSessionPRs: {}, setResumenSesion: noop,
    readOnly: false, sharedParam: null, sb: {}, es: true, darkMode: true, prCelebration: null, setPrCelebration: noop, activeExIdx: 0, setActiveExIdx: noop,
    sessionData: { role: "alumno", alumnoId: ALU }, sessionPRList: [], videoOverrides: {}, setVideoModal: noop, toast2: noop, pendingSyncState: null, onPendingSyncRetry: noop,
  }, extra || {})));
  const ses = (semanaIdx) => Object.assign({ rId: "R1", dIdx: 0, exIdx: 0, startTime: Date.now(), ciclo: 1 }, semanaIdx === undefined ? {} : { semanaIdx });
  const reps = (html) => ({ s1: />3×10</.test(html), s2: />4×12</.test(html) });
  // inicio en semana 1 y el plan avanza a la 2 a mitad de sesion: se sigue viendo la prescripcion de la semana 1
  assert.deepEqual(reps(render(ses(0), 0)), { s1: true, s2: false });
  assert.deepEqual(reps(render(ses(0), 1)), { s1: true, s2: false }, "currentWeek vivo = 2: no cambia lo mostrado");
  // controles: sin semana congelada o sin flujo del alumno se ve la semana vigente, como antes
  assert.deepEqual(reps(render(ses(undefined), 1)), { s1: false, s2: true });
  assert.deepEqual(reps(render(ses(0), 1, { sessionData: { role: "entrenador" } })), { s1: false, s2: true });
  assert.deepEqual(reps(render(ses(0), 1, { readOnly: true, sharedParam: "x" })), { s1: false, s2: true });
});

await test("17 cambio local de ciclo: el bloqueo se conserva aunque la semana no cambie", () => {
  const s = { rId: "R1", dIdx: 0, semanaIdx: 0, ciclo: 1 };
  const r = resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 0, cicloVivo: 2 });
  assert.deepEqual([r.ok, r.motivo], [false, MOTIVO_CONFLICTO.CICLO]);
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 1, cicloVivo: 2 }).ok, false, "ciclo + semana a la vez: sigue bloqueado");
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 0, cicloVivo: null }).ok, true, "rutina ausente: sin conflicto inventado");
  assert.equal(resolverSemanaEntrenamiento({ session: s, semanaVisibleIdx: 0, cicloVivo: cicloVivoDeSesion([], s) }).ok, true);
});

await test("13 cableado: logSet y finalizarSesion usan resolverSemanaEntrenamiento y la semana congelada", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const ws = readFileSync(new URL("../components/WorkoutScreen.jsx", import.meta.url), "utf8");
  const logSet = app.slice(app.indexOf("const logSet = ("), app.indexOf("const logSet = (") + 3500);
  assert.ok(logSet.includes("resolverSemanaEntrenamiento("), "logSet");
  assert.ok(ws.includes("resolverSemanaEntrenamiento("), "WorkoutScreen");
  assert.ok(ws.includes("semanaRes.semanaSesion"), "la sesion se guarda con la semana resuelta");
  assert.ok(app.includes("cicloVivoDeSesion(") && ws.includes("cicloVivoDeSesion("), "ciclo de la rutina del entrenamiento");
  assert.ok(ws.includes("const semanaMostrada") && ws.includes("currentWeek={semanaMostrada}"), "prescripcion y registro con la semana congelada");
  assert.ok(ws.includes('semanaRes.fuente === "sesion"'), "no re-sincroniza hacia atras la semana local");
  assert.ok(ws.includes("Math.max(Number(prev) || 0, effectiveWeek + 1)"), "el avance local nunca retrocede");
});

console.log("\n" + count + " pruebas OK");
