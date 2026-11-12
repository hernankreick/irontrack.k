// SessionIdentity PR-2: identidad en el inicio/recuperacion del entrenamiento y ancla local v2.
//   node scripts/test-sessionIdentityIntegracion.mjs   (datos ficticios, sin red, almacenamiento en memoria)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_WORKOUT_KEY, ACTIVE_WORKOUT_MAX_MS, leerSesionActiva, prepararInicioEntrenamiento, cerrarSesionActiva } from "../lib/workoutSessionDate.js";
import { esUuidV4, validarIdentidad } from "../lib/sessionIdentity.js";
import { buildSessionPayload, buildWorkoutSummary, buildExerciseSetRecord, removeUndefinedPayloadFields } from "../lib/workoutSession.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const memStorage = (init) => { const m = new Map(init || []); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: () => m.get(ACTIVE_WORKOUT_KEY) }; };

const T0 = new Date(2026, 10, 5, 23, 55).getTime();
const HORA = 3600 * 1000;
const A = "alumno-demo-a", B = "alumno-demo-b", R = "rutina-demo-1";
const ini = (st, o) => prepararInicioEntrenamiento(Object.assign({ storage: st, alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 2, now: T0 }, o || {}));
const anclaV1 = (o) => Object.assign({ v: 1, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T0, fecha: "5/11/2026" }, o || {});
const UUID = "123e4567-e89b-42d3-a456-426614174000";

test("sesion nueva: identity con UUID v4 valido, campos congelados del entrenamiento", () => {
  const st = memStorage(); const r = ini(st);
  const id = r.session.identity;
  assert.ok(esUuidV4(id.sessionId)); assert.ok(validarIdentidad(id).ok);
  assert.deepEqual({ a: id.alumnoId, r: id.rutinaId, d: id.diaIdx, s: id.semanaIdx, c: id.ciclo, f: id.fecha, t: id.startedAt },
    { a: A, r: R, d: 0, s: 2, c: 1, f: "5/11/2026", t: T0 });
  assert.equal(r.session.semanaIdx, 2); assert.equal(r.session.startTime, T0); assert.equal(r.recuperada, false);
});
test("ancla nueva es v2: campos existentes + sessionId igual a la identidad", () => {
  const st = memStorage(); const r = ini(st);
  assert.deepEqual(JSON.parse(st.raw()), { v: 2, sessionId: r.session.identity.sessionId, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T0, fecha: "5/11/2026" });
  assert.equal(leerSesionActiva(st).v, 2);
});
test("reanudacion dentro de 6 h: mismo sessionId; recarga: mismo sessionId; fecha original en medianoche", () => {
  const st = memStorage(); const a = ini(st);
  for (const dt of [10 * 60 * 1000, 20 * 60 * 1000, ACTIVE_WORKOUT_MAX_MS]) {
    const b = ini(st, { now: T0 + dt, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + dt } });
    assert.equal(b.recuperada, true); assert.equal(b.motivo, "ancla");
    assert.equal(b.session.identity.sessionId, a.session.identity.sessionId);
    assert.deepEqual(b.session.identity, a.session.identity);
    assert.equal(b.session.fecha, "5/11/2026"); assert.equal(b.session.startTime, T0);
  }
});
test("no genera ID nuevo en renders: la identidad es la misma referencia congelada y la ancla no cambia al recuperar", () => {
  const st = memStorage(); const a = ini(st); const antes = st.raw();
  ini(st, { now: T0 + 1000 });
  assert.equal(st.raw(), antes); assert.ok(Object.isFrozen(a.session.identity));
});
test("alumno distinto: no reutiliza identidad ni sobrescribe el ancla vigente del otro", () => {
  const st = memStorage(); const a = ini(st); const antes = st.raw();
  const b = ini(st, { alumnoId: B, now: T0 + 1000, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 1000 } });
  assert.equal(b.recuperada, false); assert.equal(b.motivo, "otro_alumno");
  assert.notEqual(b.session.identity.sessionId, a.session.identity.sessionId);
  assert.equal(b.session.identity.alumnoId, B);
  assert.equal(st.raw(), antes, "ancla de A intacta");
  assert.equal(leerSesionActiva(st).alumnoId, A);
});
test("ancla vencida de otro alumno si se reemplaza", () => {
  const st = memStorage(); ini(st);
  const t = T0 + ACTIVE_WORKOUT_MAX_MS + 1000;
  const b = ini(st, { alumnoId: B, now: t, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t } });
  assert.equal(leerSesionActiva(st).alumnoId, B); assert.equal(leerSesionActiva(st).sessionId, b.session.identity.sessionId);
});
test("rutina, dia o ciclo distintos: identidad nueva", () => {
  const casos = [{ session: { rId: "rutina-2", dIdx: 0, exIdx: 0, startTime: T0 + 5 } }, { session: { rId: R, dIdx: 1, exIdx: 0, startTime: T0 + 5 } }, { ciclo: 2 }];
  for (const c of casos) {
    const st = memStorage(); const a = ini(st); const b = ini(st, Object.assign({ now: T0 + 5 }, c));
    assert.equal(b.recuperada, false); assert.notEqual(b.session.identity.sessionId, a.session.identity.sessionId);
  }
});
test("semana distinta (regla actual, PR-3 la cambia): identidad nueva", () => {
  const st = memStorage(); const a = ini(st); const b = ini(st, { semana: 3, now: T0 + 5 });
  assert.equal(b.motivo, "otra_semana"); assert.notEqual(b.session.identity.sessionId, a.session.identity.sessionId);
});
test("ancla vencida o con inicio futuro: no reutiliza identidad", () => {
  const st = memStorage(); const a = ini(st);
  const v = ini(st, { now: T0 + ACTIVE_WORKOUT_MAX_MS + 1, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + ACTIVE_WORKOUT_MAX_MS + 1 } });
  assert.equal(v.motivo, "vencida"); assert.notEqual(v.session.identity.sessionId, a.session.identity.sessionId);
  const st2 = memStorage(); ini(st2, { now: T0 + 100 * HORA, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 100 * HORA } });
  const f = ini(st2, { now: T0, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 } });
  assert.equal(f.motivo, "invalida"); assert.equal(f.recuperada, false);
});
test("ancla corrupta o incompatible: no se reutiliza (v2 con UUID malo, version 3, campos faltantes, JSON roto, v1 con sessionId)", () => {
  const malos = ["{", "null", JSON.stringify({ v: 2, sessionId: "xyz", alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T0, fecha: "5/11/2026" }),
    JSON.stringify({ v: 2, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T0, fecha: "5/11/2026" }),
    JSON.stringify({ v: 2, sessionId: UUID, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 4, startTime: T0, fecha: "5/11/2026" }),
    JSON.stringify({ v: 3, sessionId: UUID, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T0, fecha: "5/11/2026" }),
    JSON.stringify(anclaV1({ sessionId: UUID })), JSON.stringify(anclaV1({ fecha: "31/02/2026" }))];
  for (const raw of malos) {
    const st = memStorage([[ACTIVE_WORKOUT_KEY, raw]]);
    assert.equal(leerSesionActiva(st), null, raw);
    const r = ini(st);
    assert.equal(r.recuperada, false); assert.equal(r.motivo, "invalida");
    assert.ok(esUuidV4(r.session.identity.sessionId)); assert.notEqual(r.session.identity.sessionId, UUID);
  }
});
test("ancla v1 valida: se lee sin sessionId; recuperacion legada sin identity inventada y sin reescribir a v2", () => {
  const raw = JSON.stringify(anclaV1()); const st = memStorage([[ACTIVE_WORKOUT_KEY, raw]]);
  const l = leerSesionActiva(st); assert.equal(l.v, 1); assert.equal("sessionId" in l, false);
  const r = ini(st, { now: T0 + 60000 });
  assert.equal(r.recuperada, true); assert.equal(r.legado, true);
  assert.equal("identity" in r.session, false); assert.equal(r.session.startTime, T0); assert.equal(r.session.fecha, "5/11/2026");
  assert.equal(st.raw(), raw, "el ancla v1 se conserva tal cual");
});
test("ancla v2 valida: recuperacion exacta de la identidad original", () => {
  const ancla = { v: 2, sessionId: UUID, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T0, fecha: "5/11/2026" };
  const st = memStorage([[ACTIVE_WORKOUT_KEY, JSON.stringify(ancla)]]);
  const r = ini(st, { now: T0 + 1000 });
  assert.equal(r.recuperada, true); assert.equal(r.legado, false);
  assert.deepEqual(r.session.identity, { v: 1, sessionId: UUID, alumnoId: A, rutinaId: R, diaIdx: 0, semanaIdx: 2, ciclo: 1, fecha: "5/11/2026", startedAt: T0 });
});
test("sin alumno (entrenador/enlace compartido): sin identidad, sin ancla, sin lectura", () => {
  for (const alumnoId of [null, undefined, ""]) {
    const st = memStorage(); const r = ini(st, { alumnoId });
    assert.equal(r.motivo, "sin_alumno"); assert.equal("identity" in r.session, false); assert.equal(st.raw(), undefined);
  }
});
test("identity enviada en la entrada no se hereda en una sesion nueva", () => {
  const st = memStorage(); const falsa = { sessionId: UUID };
  const r = ini(st, { session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0, identity: falsa } });
  assert.notEqual(r.session.identity.sessionId, UUID);
});
test("semana invalida (fuera de 0..3): sin identidad, ancla v1 como antes", () => {
  const st = memStorage(); const r = ini(st, { semana: 5 });
  assert.equal("identity" in r.session, false); assert.equal(JSON.parse(st.raw()).v, 1);
});
test("no muta la sesion de entrada", () => {
  const entrada = Object.freeze({ rId: R, dIdx: 0, exIdx: 0, startTime: T0 });
  assert.ok(ini(memStorage(), { session: entrada }).session.identity);
});
test("cierre: borra solo el ancla de su propia sesion (v2), no la ajena", () => {
  const st = memStorage(); const a = ini(st);
  assert.equal(cerrarSesionActiva(st, { alumnoId: B, session: a.session }), false); assert.ok(st.raw());
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: Object.assign({}, a.session, { dIdx: 3 }) }), false); assert.ok(st.raw());
  const otraId = Object.assign({}, a.session, { identity: Object.assign({}, a.session.identity, { sessionId: UUID }) });
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: otraId }), false); assert.ok(st.raw());
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: a.session }), true); assert.equal(st.raw(), undefined);
});
test("cierre de ancla v1 legada sigue funcionando", () => {
  const st = memStorage([[ACTIVE_WORKOUT_KEY, JSON.stringify(anclaV1())]]);
  const r = ini(st, { now: T0 + 1 });
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: r.session }), true);
});
test("A -> B -> A: A recupera su identidad y fecha originales; el ancla de A nunca fue tocada por B", () => {
  const st = memStorage(); const a1 = ini(st); const raw = st.raw();
  const tb = T0 + 5 * 60 * 1000;
  const b = ini(st, { alumnoId: B, now: tb, session: { rId: R, dIdx: 0, exIdx: 0, startTime: tb } });
  assert.equal(b.motivo, "otro_alumno"); assert.equal(b.anclaConservada, true); assert.equal(st.raw(), raw);
  const ta = T0 + 15 * 60 * 1000;
  const a2 = ini(st, { now: ta, session: { rId: R, dIdx: 0, exIdx: 0, startTime: ta } });
  assert.equal(a2.recuperada, true); assert.deepEqual(a2.session.identity, a1.session.identity);
  assert.equal(a2.session.startTime, T0); assert.equal(a2.session.fecha, "5/11/2026");
  assert.notEqual(b.session.identity.sessionId, a1.session.identity.sessionId);
});
test("A -> B -> recarga de B (limitacion transitoria): B no recupera; nueva identidad y nueva fecha/inicio; el ancla de A sigue intacta", () => {
  const st = memStorage(); ini(st); const raw = st.raw();
  const tb = new Date(2026, 10, 5, 23, 58).getTime();
  const b1 = ini(st, { alumnoId: B, now: tb, session: { rId: R, dIdx: 0, exIdx: 0, startTime: tb } });
  const tr = new Date(2026, 10, 6, 0, 5).getTime(); // B recarga despues de medianoche
  const b2 = ini(st, { alumnoId: B, now: tr, session: { rId: R, dIdx: 0, exIdx: 0, startTime: tr } });
  assert.equal(b2.recuperada, false); assert.equal(b2.motivo, "otro_alumno");
  assert.notEqual(b2.session.identity.sessionId, b1.session.identity.sessionId, "sin ancla propia, B no conserva su identidad");
  assert.equal(b1.session.fecha, "5/11/2026"); assert.equal(b2.session.fecha, "6/11/2026");
  assert.equal(st.raw(), raw);
});
test("B puede persistir ancla propia cuando el ancla de A venció o se cerro", () => {
  const st = memStorage(); const a = ini(st);
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: a.session }), true);
  const b = ini(st, { alumnoId: B, now: T0 + 1000, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 1000 } });
  assert.equal(leerSesionActiva(st).sessionId, b.session.identity.sessionId);
});
test("ancla v1 vigente de A tampoco se sobrescribe y no se le inventa identidad", () => {
  const raw = JSON.stringify(anclaV1()); const st = memStorage([[ACTIVE_WORKOUT_KEY, raw]]);
  const b = ini(st, { alumnoId: B, now: T0 + 1000, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 1000 } });
  assert.equal(b.anclaConservada, true); assert.equal(st.raw(), raw);
});
test("payloads remotos identicos con y sin identity (sesion, resumen, serie)", () => {
  const con = ini(memStorage()).session; const sin = Object.assign({}, con); delete sin.identity;
  assert.ok(con.identity && !sin.identity);
  const day = { label: "Dia 1", exercises: [{ id: "e1", sets: 3 }] };
  const args = (session) => ({ session, alumnoId: A, activeDay: day, activeRoutine: { id: R, name: "Rutina" }, includeRoutineId: true, weekToSave: 3, ciclo: 1, date: con.fecha, time: "23:55", progress: {}, now: T0 + 60000 });
  const p1 = removeUndefinedPayloadFields(buildSessionPayload(args(con))), p2 = removeUndefinedPayloadFields(buildSessionPayload(args(sin)));
  assert.deepEqual(p1, p2);
  assert.deepEqual(buildWorkoutSummary(args(con)), buildWorkoutSummary(args(sin)));
  for (const p of [p1, buildWorkoutSummary(args(con)), buildExerciseSetRecord(50, 8, con.fecha, 2, "", null, 1)]) assert.ok(!/sessionId|identity|sesion_uid/.test(JSON.stringify(p)));
});
test("App.jsx y WorkoutScreen no envian ni referencian sessionId/identity; no se toca Supabase/SQL", () => {
  for (const f of ["App.jsx", "components/WorkoutScreen.jsx", "lib/rpcClient.js", "lib/supabaseClient.js", "lib/finalizeWorkoutSession.js", "lib/progressInsert.js"]) {
    const src = readFileSync(path.join(ROOT, f), "utf8");
    assert.ok(!/session\.identity|sessionId|sesion_uid/.test(src), f);
  }
});
console.log("\n" + n + " pruebas OK");
