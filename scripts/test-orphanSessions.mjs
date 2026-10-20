// Pruebas de lib/orphanSessions.js: deteccion y validacion de sesiones no finalizadas (series en `progreso` sin fila en `sesiones`).
//
//   node scripts/test-orphanSessions.mjs

import assert from "node:assert/strict";
import {
  progresoSemanaToSesionSemana,
  detectOrphanSessions,
  buildOrphanSessionPayload,
  orphanCreatedAt,
  orphanHora,
  validateOrphanSession,
  confirmOrphanSessions,
  isCoachValidatedSession,
  advanceWeekAfterValidation,
  ORPHAN_ORIGEN,
} from "../lib/orphanSessions.js";
import { removeUndefinedPayloadFields } from "../lib/workoutSession.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const ALU = "alu-1";
// "Hoy" = 8/10/2026 15:00 en Buenos Aires (18:00Z).
const NOW = new Date("2026-10-08T18:00:00Z");
const rutina = {
  id: "r1",
  nombre: "Full body",
  datos: {
    days: [
      { label: "Dia A", warmup: [{ id: "movilidad" }], exercises: [{ id: "sentadilla" }, { id: "press" }] },
      { label: "Dia B", warmup: [{ id: "movilidad" }], exercises: [{ id: "peso_muerto" }, { id: "remo" }] },
    ],
  },
};
const set = (ex, fecha, semana, over) => Object.assign({ alumno_id: ALU, ejercicio_id: ex, kg: 50, reps: 8, nota: "", fecha, semana }, over || {});
const detect = (progreso, sesiones, extra) => detectOrphanSessions(Object.assign({ progreso, sesiones: sesiones || [], rutina, alumnoId: ALU, now: NOW }, extra || {}));

await test("progresoSemanaToSesionSemana: 0-based -> 1-based; invalidos -> null", () => {
  assert.equal(progresoSemanaToSesionSemana(0), 1);
  assert.equal(progresoSemanaToSesionSemana(3), 4);
  assert.equal(progresoSemanaToSesionSemana("2"), 3);
  for (const bad of [null, undefined, "", -1, 4, 1.5, "x", true, NaN]) assert.equal(progresoSemanaToSesionSemana(bad), null, String(bad));
});

await test("agrupa por fecha y semana; semanaSesion = semana + 1; dia unico inferido", () => {
  const r = detect([set("sentadilla", "5/10/2026", 1), set("press", "5/10/2026", 1), set("sentadilla", "5/10/2026", 1)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].fecha, "5/10/2026");
  assert.equal(r[0].semanaSesion, 2);
  assert.equal(r[0].diaIdxSugerido, 0);
  assert.deepEqual(r[0].ejercicios, ["sentadilla", "press"]);
  assert.equal(r[0].sets.length, 3);
  assert.equal(r[0].ultimoSetISO, null);
});

await test("misma fecha con padding distinto se agrupa (normalizeFecha) y conserva el formato del progreso", () => {
  const r = detect([set("sentadilla", "5/10/2026", 1), set("press", "05/10/2026", 1)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].fecha, "5/10/2026");
});

await test("misma fecha en semanas distintas => huerfanos distintos", () => {
  assert.equal(detect([set("sentadilla", "5/10/2026", 1), set("sentadilla", "5/10/2026", 2)]).length, 2);
});

await test("semana null / vacia / invalida: se ignora (no validable)", () => {
  assert.equal(detect([set("sentadilla", "5/10/2026", null), set("press", "5/10/2026", ""), set("press", "5/10/2026", undefined), set("press", "5/10/2026", 9)]).length, 0);
});

await test("excluye hoy y fechas futuras", () => {
  assert.equal(detect([set("sentadilla", "8/10/2026", 1), set("sentadilla", "9/10/2026", 1)]).length, 0);
  assert.equal(detect([set("sentadilla", "7/10/2026", 1)]).length, 1);
});

await test("hoy se mide en hora Argentina (00:30 AR del 9/10 = 03:30Z; el 8/10 ya es ayer)", () => {
  const now = new Date("2026-10-09T03:30:00Z");
  assert.equal(detectOrphanSessions({ progreso: [set("sentadilla", "8/10/2026", 1)], sesiones: [], rutina, alumnoId: ALU, now }).length, 1);
});

await test("excluye fechas con sesion equivalente (sessionAlreadyExists), con padding distinto", () => {
  const ses = [{ alumno_id: ALU, rutina_id: "r1", fecha: "05/10/2026", dia_idx: 0, semana: 2 }];
  assert.equal(detect([set("sentadilla", "5/10/2026", 1)], ses).length, 0);
});

await test("sesion de OTRO dia/semana/ciclo no cubre el huerfano", () => {
  const base = { alumno_id: ALU, rutina_id: "r1", fecha: "5/10/2026", dia_idx: 0, semana: 2 };
  const prog = [set("sentadilla", "5/10/2026", 1)];
  assert.equal(detect(prog, [Object.assign({}, base, { semana: 1 })]).length, 1);
  assert.equal(detect(prog, [Object.assign({}, base, { fecha: "4/10/2026" })]).length, 1);
  assert.equal(detect(prog, [Object.assign({}, base, { ciclo: 2 })]).length, 1);
  assert.equal(detect(prog, [Object.assign({}, base, { rutina_id: "otra" })]).length, 1);
});

await test("dia ambiguo (ejercicio compartido entre dias) => diaIdxSugerido null", () => {
  const r = detect([set("movilidad", "5/10/2026", 0)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].diaIdxSugerido, null);
});

await test("ejercicios de dias distintos => null; ejercicio ajeno a la rutina se ignora", () => {
  assert.equal(detect([set("sentadilla", "5/10/2026", 0), set("remo", "5/10/2026", 0)])[0].diaIdxSugerido, null);
  assert.equal(detect([set("fuera_de_rutina", "5/10/2026", 0)]).length, 0);
});

await test("sin dia unico: cualquier sesion de esa fecha y semana la cubre", () => {
  const ses = [{ alumno_id: ALU, rutina_id: "r1", fecha: "5/10/2026", dia_idx: 1, semana: 1 }];
  assert.equal(detect([set("movilidad", "5/10/2026", 0)], ses).length, 0);
});

await test("solo ciclo vigente de la rutina; antiguedad maxima (default 14 dias)", () => {
  const r2 = Object.assign({}, rutina, { datos: Object.assign({}, rutina.datos, { ciclo_actual: 2 }) });
  const d = (prog) => detectOrphanSessions({ progreso: prog, sesiones: [], rutina: r2, alumnoId: ALU, now: NOW });
  assert.equal(d([set("sentadilla", "5/10/2026", 0)]).length, 0, "fila ciclo 1 en rutina ciclo 2");
  assert.equal(d([set("sentadilla", "5/10/2026", 0, { ciclo: 2 })]).length, 1);
  assert.equal(detect([set("sentadilla", "1/9/2026", 0)]).length, 0, "mas de 14 dias");
  assert.equal(detect([set("sentadilla", "1/9/2026", 0)], [], { maxAgeDays: 60 }).length, 1);
});

await test("ordena la fecha mas reciente primero; ignora series de otro alumno", () => {
  const r = detect([set("sentadilla", "3/10/2026", 0), set("sentadilla", "6/10/2026", 1), set("press", "7/10/2026", 1, { alumno_id: "otro" })]);
  assert.deepEqual(r.map((o) => o.fecha), ["6/10/2026", "3/10/2026"]);
});

await test("ultimoSetISO: el created_at mas reciente DE ESE DIA; el de otro dia (sync offline) no vale", () => {
  const r = detect([
    set("sentadilla", "5/10/2026", 1, { created_at: "2026-10-05T18:10:00+00:00" }),
    set("press", "5/10/2026", 1, { created_at: "2026-10-05T19:40:00+00:00" }),
  ]);
  assert.equal(r[0].ultimoSetISO, "2026-10-05T19:40:00.000Z");
  const offline = detect([set("sentadilla", "5/10/2026", 1, { created_at: "2026-10-07T12:00:00+00:00" })]);
  assert.equal(offline[0].ultimoSetISO, null);
});

await test("orphanCreatedAt / orphanHora: timestamp real, o 12:00 -03:00 de la fecha del huerfano y hora null", () => {
  const withTs = { fecha: "5/10/2026", ultimoSetISO: "2026-10-05T19:40:00.000Z" };
  assert.equal(orphanCreatedAt(withTs), "2026-10-05T19:40:00.000Z");
  assert.match(orphanHora(withTs), /(16:40|0?4:40)/, "19:40Z = 16:40 en Buenos Aires");
  const noTs = { fecha: "5/10/2026", ultimoSetISO: null };
  assert.equal(orphanCreatedAt(noTs), "2026-10-05T12:00:00-03:00");
  assert.equal(orphanHora(noTs), null);
  assert.throws(() => orphanCreatedAt({ fecha: "basura", ultimoSetISO: null }));
});

await test("payload: fecha/semana del huerfano, rutina_id, origen, created_at, hora null; removeUndefined deja pasar origen y created_at", () => {
  const orphan = detect([set("sentadilla", "5/10/2026", 1), set("press", "5/10/2026", 1)])[0];
  const payload = buildOrphanSessionPayload({ alumnoId: ALU, rutina, orphan, diaIdx: 0 });
  assert.equal(payload.alumno_id, ALU);
  assert.equal(payload.rutina_id, "r1");
  assert.equal(payload.rutina_nombre, "Full body");
  assert.equal(payload.dia_label, "Dia A");
  assert.equal(payload.dia_idx, 0);
  assert.equal(payload.semana, 2);
  assert.equal(payload.fecha, "5/10/2026");
  assert.equal(payload.ejercicios, "sentadilla,press");
  assert.equal(payload.hora, null);
  assert.equal(payload.origen, ORPHAN_ORIGEN);
  assert.equal(payload.created_at, "2026-10-05T12:00:00-03:00");
  assert.equal("ciclo" in payload, false, "ciclo 1: no se envia (default de la DB)");
  const out = removeUndefinedPayloadFields({ origen: "validada_coach", created_at: "x", gone: undefined, hora: null });
  assert.deepEqual(out, { origen: "validada_coach", created_at: "x", hora: null });
});

await test("payload: ciclo > 1 se envia", () => {
  const r2 = Object.assign({}, rutina, { datos: Object.assign({}, rutina.datos, { ciclo_actual: 3 }) });
  const orphan = detectOrphanSessions({ progreso: [set("sentadilla", "5/10/2026", 1, { ciclo: 3 })], sesiones: [], rutina: r2, alumnoId: ALU, now: NOW })[0];
  assert.equal(buildOrphanSessionPayload({ alumnoId: ALU, rutina: r2, orphan, diaIdx: 0 }).ciclo, 3);
});

const orphan0 = () => detect([set("sentadilla", "5/10/2026", 1), set("press", "5/10/2026", 1)])[0];
const fakeSb = (over) => {
  const calls = { get: [], add: [] };
  const sb = Object.assign({
    getSesionesByAlumnoRutinaSemana: async (...a) => { calls.get.push(a); return []; },
    addSesion: async (p) => { calls.add.push(p); return [Object.assign({ id: "s1" }, p)]; },
  }, over || {});
  return { sb, calls };
};

await test("validar: lee antes (rutina + semana del huerfano), inserta una vez y devuelve la fila", async () => {
  const { sb, calls } = fakeSb();
  const res = await validateOrphanSession({ sb, alumnoId: ALU, rutina, orphan: orphan0(), diaIdx: 0 });
  assert.equal(res.status, "saved");
  assert.equal(res.row.id, "s1");
  assert.deepEqual(calls.get[0], [ALU, "r1", "Full body", 2]);
  assert.equal(calls.add.length, 1);
  assert.equal(calls.add[0].origen, "validada_coach");
  assert.equal(calls.add[0].semana, 2);
});

await test("validar: si ya existe una sesion equivalente NO inserta", async () => {
  const { sb, calls } = fakeSb({ getSesionesByAlumnoRutinaSemana: async () => [{ alumno_id: ALU, rutina_id: "r1", fecha: "05/10/2026", dia_idx: 0, semana: 2 }] });
  const res = await validateOrphanSession({ sb, alumnoId: ALU, rutina, orphan: orphan0(), diaIdx: 0 });
  assert.equal(res.status, "exists");
  assert.equal(calls.add.length, 0);
});

await test("validar: insert que devuelve null (sbFetch en HTTP no-ok) o [] => lanza, nunca falla en silencio", async () => {
  for (const bad of [null, [], undefined]) {
    const { sb } = fakeSb({ addSesion: async () => bad });
    await assert.rejects(() => validateOrphanSession({ sb, alumnoId: ALU, rutina, orphan: orphan0(), diaIdx: 0 }), /no confirmo/);
  }
});

await test("validar: error al leer sesiones (lanza o no devuelve lista) => lanza y no inserta", async () => {
  const a = fakeSb({ getSesionesByAlumnoRutinaSemana: async () => { throw new Error("boom"); } });
  await assert.rejects(() => validateOrphanSession({ sb: a.sb, alumnoId: ALU, rutina, orphan: orphan0(), diaIdx: 0 }), /boom/);
  const b = fakeSb({ getSesionesByAlumnoRutinaSemana: async () => null });
  await assert.rejects(() => validateOrphanSession({ sb: b.sb, alumnoId: ALU, rutina, orphan: orphan0(), diaIdx: 0 }));
  assert.equal(a.calls.add.length + b.calls.add.length, 0);
});

await test("validar: dia invalido => lanza antes de tocar la DB", async () => {
  const { sb, calls } = fakeSb();
  for (const d of [null, -1, 2, 1.5, "0"]) {
    await assert.rejects(() => validateOrphanSession({ sb, alumnoId: ALU, rutina, orphan: orphan0(), diaIdx: d }), /Dia invalido/);
  }
  assert.equal(calls.get.length + calls.add.length, 0);
});

await test("tras validar, el huerfano deja de detectarse", async () => {
  const prog = [set("sentadilla", "5/10/2026", 1), set("press", "5/10/2026", 1)];
  const { sb, calls } = fakeSb();
  const res = await validateOrphanSession({ sb, alumnoId: ALU, rutina, orphan: detect(prog)[0], diaIdx: 0 });
  assert.equal(detect(prog, [res.row]).length, 0);
  assert.equal(calls.add.length, 1);
});

const confirm = (sb, progreso, sesiones) => confirmOrphanSessions({ sb, progreso, sesiones: sesiones || [], rutina, alumnoId: ALU, now: NOW });

await test("confirmar: una sesion ya finalizada que falta en la lista local (acotada) NO queda como huerfano", async () => {
  const prog = [set("sentadilla", "5/10/2026", 1)];
  assert.equal(detect(prog).length, 1, "localmente parece huerfano");
  const gets = [];
  const { sb } = fakeSb({ getSesionesByAlumnoRutinaSemana: async (...a) => { gets.push(a); return [{ alumno_id: ALU, rutina_id: "r1", fecha: "5/10/2026", dia_idx: 0, semana: 2 }]; } });
  assert.deepEqual(await confirm(sb, prog), []);
  assert.deepEqual(gets, [[ALU, "r1", "Full body", 2]]);
});

await test("confirmar: un huerfano real sigue siendo huerfano; se lee una vez por semana candidata", async () => {
  const prog = [set("sentadilla", "5/10/2026", 1), set("press", "6/10/2026", 1), set("remo", "3/10/2026", 0)];
  const { sb, calls } = fakeSb();
  const r = await confirm(sb, prog);
  assert.equal(r.length, 3);
  assert.deepEqual(calls.get.map((c) => c[3]).sort(), [1, 2]);
});

await test("confirmar: sin candidatos no consulta la DB", async () => {
  const { sb, calls } = fakeSb();
  assert.deepEqual(await confirm(sb, []), []);
  assert.equal(calls.get.length, 0);
});

await test("confirmar: si falla la lectura lanza (no se muestran avisos sin confirmar)", async () => {
  const prog = [set("sentadilla", "5/10/2026", 1)];
  await assert.rejects(() => confirm(fakeSb({ getSesionesByAlumnoRutinaSemana: async () => { throw new Error("boom"); } }).sb, prog), /boom/);
  await assert.rejects(() => confirm(fakeSb({ getSesionesByAlumnoRutinaSemana: async () => null }).sb, prog));
});

await test("isCoachValidatedSession: solo origen validada_coach", () => {
  assert.equal(isCoachValidatedSession({ origen: "validada_coach" }), true);
  for (const s of [{}, { origen: null }, { origen: "alumno" }, null, undefined]) assert.equal(isCoachValidatedSession(s), false);
});

await test("avanzar semana tras validar: usa el chequeo compartido con la rutina vigente y devuelve su resultado", async () => {
  const calls = [];
  const sb = { reconcileSemanaActivaAlumno: async (...a) => { calls.push(a); return { status: "advanced", rutinaId: "r1", semanaActiva: 2 }; } };
  const res = await advanceWeekAfterValidation({ sb, alumnoId: ALU, rutina });
  assert.deepEqual(res, { status: "advanced", rutinaId: "r1", semanaActiva: 2 });
  assert.deepEqual(calls, [[ALU, [rutina], "coach_validar"]]);
});

await test("avanzar semana tras validar: noop se devuelve tal cual; si falla o no existe NO lanza", async () => {
  assert.equal((await advanceWeekAfterValidation({ sb: { reconcileSemanaActivaAlumno: async () => ({ status: "noop", reason: "semana_incompleta" }) }, alumnoId: ALU, rutina })).status, "noop");
  assert.equal((await advanceWeekAfterValidation({ sb: { reconcileSemanaActivaAlumno: async () => { throw new Error("boom"); } }, alumnoId: ALU, rutina })).status, "failed");
  assert.equal((await advanceWeekAfterValidation({ sb: { reconcileSemanaActivaAlumno: async () => null }, alumnoId: ALU, rutina })).status, "failed");
  assert.equal((await advanceWeekAfterValidation({ sb: {}, alumnoId: ALU, rutina })).status, "unavailable");
  assert.equal((await advanceWeekAfterValidation({ alumnoId: ALU, rutina })).status, "unavailable");
});

console.log("\n" + count + " tests ok");
