// SessionIdentity PR-3: recuperacion segura de la semana congelada tras un avance automatico de la semana visible + recarga.
//   node scripts/test-recuperacionSemanaCongelada.mjs   (datos ficticios, sin red, almacenamiento en memoria)
import assert from "node:assert/strict";
import { ACTIVE_WORKOUT_KEY, ACTIVE_WORKOUT_MAX_MS, leerSesionActiva, prepararInicioEntrenamiento, cerrarSesionActiva } from "../lib/workoutSessionDate.js";
import { resolverSemanaEntrenamiento } from "../lib/semanaEntrenamiento.js";
import { esUuidV4 } from "../lib/sessionIdentity.js";
import { buildExerciseSetRecord, buildSessionPayload, buildPendingProgressItem, removeUndefinedPayloadFields, sessionAlreadyExists, resolveExerciseForWeek } from "../lib/workoutSession.js";
import { writeAheadPendingSet } from "../lib/setWriteAhead.js";

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const memStorage = (init, opts) => {
  const m = new Map(init || []); const o = opts || {};
  return {
    getItem: (k) => { if (o.failGet && o.failGet(k)) throw new Error("SecurityError"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (o.failSet) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => m.delete(k),
    raw: (al) => m.get(ACTIVE_WORKOUT_KEY + ":" + (al || A)), rawG: () => m.get(ACTIVE_WORKOUT_KEY), keys: () => [...m.keys()],
  };
};

const T0 = new Date(2026, 10, 5, 10, 0).getTime();
const MIN = 60000;
const A = "alumno-demo-a", B = "alumno-demo-b", R = "rutina-demo-1";
const UUID = "123e4567-e89b-42d3-a456-426614174000";
// `semana` = semana VISIBLE (base 0) al momento de iniciar / recargar.
const ini = (st, o) => prepararInicioEntrenamiento(Object.assign({ storage: st, alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 }, o || {}));
const recarga = (st, o) => { const now = (o && o.now) || T0 + 30 * MIN; return ini(st, Object.assign({ now, session: { rId: R, dIdx: 0, exIdx: 0, startTime: now } }, o || {})); };
// Registra una serie como lo hace logSet del alumno: semana/ciclo salen de resolverSemanaEntrenamiento (semana visible ya avanzada).
const logSet = (session, visible, cicloVivo, kg) => {
  const r = resolverSemanaEntrenamiento({ session, semanaVisibleIdx: visible, cicloVivo, semanaLegadaIdx: visible, cicloLegado: cicloVivo });
  assert.equal(r.ok, true);
  return buildExerciseSetRecord(kg || 50, 8, session.fecha, r.semanaProgreso, "", null, r.ciclo);
};
const ancla2 = (o) => Object.assign({ v: 2, sessionId: UUID, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 0, startTime: T0, fecha: "5/11/2026" }, o || {});
const anclaV1 = (o) => Object.assign({ v: 1, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 0, startTime: T0, fecha: "5/11/2026" }, o || {});

test("1 semana 1, 3 series, la semana visible avanza a 2, recarga: mismas identidad/semana/ciclo/fecha/inicio", () => {
  const st = memStorage(); const a = ini(st);
  const sets = [1, 2, 3].map((k) => logSet(a.session, 0, 1, 40 + k));
  const b = recarga(st, { semana: 1 }); // semana visible = 2 (base 0 => 1)
  assert.equal(b.recuperada, true); assert.equal(b.motivo, "ancla"); assert.equal(b.legado, false);
  assert.deepEqual(b.session.identity, a.session.identity);
  assert.equal(b.session.semanaIdx, 0, "semana congelada, no la visible");
  assert.equal(b.session.identity.semanaIdx, 0); assert.equal(b.session.ciclo, 1);
  assert.equal(b.session.fecha, a.session.fecha); assert.equal(b.session.startTime, T0); assert.equal(b.session.identity.startedAt, T0);
  assert.ok(sets.every((s) => s.week === 0), "series previas en semana 0 (sin duplicar ni reasignar)");
});
test("2 cuarta serie tras recargar: las cuatro en semana 1 (base 0), mismo ciclo y fecha", () => {
  const st = memStorage(); const a = ini(st);
  const previas = [1, 2, 3].map((k) => logSet(a.session, 0, 1, 40 + k));
  const b = recarga(st, { semana: 1 });
  const cuarta = logSet(b.session, 1, 1, 60);
  const todas = previas.concat([cuarta]);
  assert.equal(todas.length, 4); assert.ok(todas.every((s) => s.week === 0 && s.ciclo === 1 && s.date === "5/11/2026"));
});
test("3 finaliza: sesion en semana 1 (base 1) y un unico POST aunque la finalizacion se repita", () => {
  const st = memStorage(); ini(st);
  const b = recarga(st, { semana: 1 });
  const r = resolverSemanaEntrenamiento({ session: b.session, semanaVisibleIdx: 1, cicloVivo: 1, semanaLegadaIdx: 1 });
  assert.equal(r.semanaSesion, 1); assert.equal(r.semanaProgreso, 0);
  const payload = removeUndefinedPayloadFields(buildSessionPayload({ alumnoId: A, session: b.session, activeDay: { label: "Dia 1", exercises: [{ id: "e1" }] }, activeRoutine: { id: R, name: "Rut" }, weekToSave: r.semanaSesion, date: b.session.fecha, time: "10:30", ciclo: r.ciclo }));
  assert.equal(payload.semana, 1); assert.equal(payload.dia_idx, 0); assert.equal(payload.fecha, "5/11/2026");
  assert.equal("sessionId" in payload || "sesion_uid" in payload, false, "no se envia sessionId a Supabase");
  const filas = []; const enviar = () => { if (!sessionAlreadyExists(filas, payload.fecha, payload.dia_idx, payload.semana, payload.ciclo, R)) filas.push(Object.assign({ rutina_id: R }, payload)); };
  enviar(); enviar();
  assert.equal(filas.length, 1);
});
test("4 recarga SIN cambio de semana: misma identidad (sin regresion)", () => {
  const st = memStorage(); const a = ini(st); const b = recarga(st, { semana: 0 });
  assert.equal(b.recuperada, true); assert.equal(b.session.identity.sessionId, a.session.identity.sessionId);
});
test("5 cambio de ciclo (con o sin cambio de semana): no recupera identidad incompatible", () => {
  for (const semana of [0, 1]) {
    const st = memStorage(); const a = ini(st); const b = recarga(st, { ciclo: 2, semana });
    assert.equal(b.recuperada, false); assert.equal(b.motivo, "otro_ciclo");
    assert.notEqual(b.session.identity.sessionId, a.session.identity.sessionId); assert.equal(b.session.identity.ciclo, 2);
  }
  // conflicto real durante la sesion: el ciclo vivo cambio => no se guarda nada contradictorio
  const a = ini(memStorage());
  assert.equal(resolverSemanaEntrenamiento({ session: a.session, semanaVisibleIdx: 1, cicloVivo: 2 }).ok, false);
});
test("6 cambio de rutina o de dia (con semana distinta): no reutiliza identidad ajena", () => {
  for (const sess of [{ rId: "otra-rutina", dIdx: 0 }, { rId: R, dIdx: 1 }]) {
    const st = memStorage(); const a = ini(st); const antes = st.raw();
    const b = recarga(st, { semana: 1, session: Object.assign({ exIdx: 0, startTime: T0 + 30 * MIN }, sess) });
    assert.equal(b.recuperada, false); assert.equal(b.motivo, "otro_dia"); assert.notEqual(b.session.identity.sessionId, a.session.identity.sessionId);
    assert.equal(b.session.semanaIdx, 1, "sesion nueva con la semana visible");
    assert.notEqual(st.raw(), antes);
  }
});
test("7 ancla v1: sin UUID inventado, no se promueve a v2; con semana distinta se mantiene el comportamiento legado (sesion nueva)", () => {
  const raw = JSON.stringify(anclaV1());
  const st = memStorage([[ACTIVE_WORKOUT_KEY, raw]]);
  const igual = recarga(st, { semana: 0 });
  assert.equal(igual.recuperada, true); assert.equal(igual.legado, true); assert.equal("identity" in igual.session, false);
  assert.equal(st.raw(), raw, "sigue v1, byte a byte");
  const st2 = memStorage([[ACTIVE_WORKOUT_KEY, raw]]);
  const dif = recarga(st2, { semana: 1 });
  assert.equal(dif.recuperada, false); assert.equal(dif.motivo, "otra_semana"); assert.equal(dif.session.semanaIdx, 1);
  assert.ok(esUuidV4(dif.session.identity.sessionId)); assert.notEqual(dif.session.identity.sessionId, UUID);
});
test("8 ancla v2 corrupta o vencida: no se reutiliza (aunque la semana visible cambie)", () => {
  const malos = ["{", JSON.stringify(ancla2({ sessionId: "xyz" })), JSON.stringify(ancla2({ semana: 4 })), JSON.stringify(ancla2({ fecha: "31/2/2026" })), JSON.stringify(ancla2({ startTime: "x" }))];
  for (const raw of malos) {
    const st = memStorage([[ACTIVE_WORKOUT_KEY + ":" + A, raw]]);
    const r = recarga(st, { semana: 1 });
    assert.equal(r.recuperada, false); assert.notEqual(r.session.identity.sessionId, UUID);
  }
  const st = memStorage([[ACTIVE_WORKOUT_KEY + ":" + A, JSON.stringify(ancla2())]]);
  const v = recarga(st, { semana: 1, now: T0 + ACTIVE_WORKOUT_MAX_MS + 1 });
  assert.equal(v.recuperada, false); assert.equal(v.motivo, "vencida");
  const st2 = memStorage([[ACTIVE_WORKOUT_KEY + ":" + A, JSON.stringify(ancla2({ startTime: T0 + 5 * 3600000 }))]]);
  const f = recarga(st2, { semana: 1, now: T0 });
  assert.equal(f.recuperada, false); assert.equal(f.motivo, "invalida");
});
test("9 cruza medianoche + semana avanzada: conserva fecha, inicio y semana originales", () => {
  const t1 = new Date(2026, 10, 5, 23, 55).getTime(), t2 = new Date(2026, 10, 6, 0, 20).getTime();
  const st = memStorage(); const a = ini(st, { now: t1, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t1 } });
  const b = ini(st, { now: t2, semana: 1, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t2 } });
  assert.equal(b.recuperada, true); assert.equal(b.session.fecha, "5/11/2026"); assert.equal(b.session.startTime, t1);
  assert.equal(b.session.semanaIdx, 0); assert.equal(b.session.identity.sessionId, a.session.identity.sessionId);
});
test("10 alumnos A y B en el mismo dispositivo: recuperacion independiente (cada uno su semana)", () => {
  const st = memStorage();
  const a = ini(st); const b = ini(st, { alumnoId: B, semana: 2, now: T0 + MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + MIN } });
  const ra = recarga(st, { semana: 1 }); const rb = recarga(st, { alumnoId: B, semana: 3 });
  assert.equal(ra.session.identity.sessionId, a.session.identity.sessionId); assert.equal(ra.session.semanaIdx, 0);
  assert.equal(rb.session.identity.sessionId, b.session.identity.sessionId); assert.equal(rb.session.semanaIdx, 2);
  assert.notEqual(ra.session.identity.sessionId, rb.session.identity.sessionId);
  // ancla vigente de otro alumno nunca se sobrescribe
  const antesB = st.raw(B); ini(st, { semana: 1, ciclo: 2, now: T0 + 2 * MIN });
  assert.equal(st.raw(B), antesB);
});
test("11 error de localStorage: no sobrescribe ni borra anclas validas; recuperar no escribe", () => {
  const st0 = memStorage(); ini(st0); const raw = st0.raw();
  const fallaLectura = memStorage([[ACTIVE_WORKOUT_KEY + ":" + A, raw]], { failGet: (k) => k === ACTIVE_WORKOUT_KEY + ":" + A });
  const r = recarga(fallaLectura, { semana: 1 });
  assert.equal(r.recuperada, false); assert.equal(r.anclaSinEscribir, true); assert.equal(fallaLectura.raw(), raw, "no se sobrescribio");
  const fallaEscritura = memStorage([[ACTIVE_WORKOUT_KEY + ":" + A, raw]], { failSet: true });
  const r2 = recarga(fallaEscritura, { semana: 1 });
  assert.equal(r2.recuperada, true, "recuperar solo lee"); assert.equal(fallaEscritura.raw(), raw);
  assert.equal(cerrarSesionActiva(fallaLectura, { alumnoId: A, session: r2.session }), false); assert.equal(fallaLectura.raw(), raw);
});
test("12 series pendientes y reintentos tras recargar: conservan fecha, semana, ciclo y opId", () => {
  const st = memStorage(); const a = ini(st); const store = memStorage();
  const OP = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const s = logSet(a.session, 0, 1);
  const item = buildPendingProgressItem("e1", 50, 8, "", a.session.fecha, s.week, s.ciclo, A, OP);
  assert.equal(writeAheadPendingSet(store, item, T0).ok, true);
  const b = recarga(st, { semana: 1 });
  const reint = buildPendingProgressItem("e1", 50, 8, "", b.session.fecha, logSet(b.session, 1, 1).week, 1, A, OP);
  assert.deepEqual(reint, item, "el reintento tras recargar es identico: fecha, semana 0, ciclo 1, opId");
  assert.equal(item.semana, 0); assert.equal(item.opId, OP); assert.equal(item.date, "5/11/2026");
});
test("13 finalizacion duplicada tras recargar: un unico registro; el ancla se cierra solo con su identidad", () => {
  const st = memStorage(); ini(st); const b = recarga(st, { semana: 1 });
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: b.session }), true); assert.equal(st.raw(), undefined);
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: b.session }), false, "segundo cierre: no hace nada");
  const c = recarga(st, { semana: 1, now: T0 + 40 * MIN });
  assert.equal(c.recuperada, false, "tras finalizar no se resucita la sesion");
});
test("14 semana 4 (idx 3): limite del ciclo; ancla recuperada con semana visible distinta o invalida", () => {
  const st = memStorage(); const a = ini(st, { semana: 3 });
  assert.equal(a.session.semanaIdx, 3);
  for (const vis of [0, 3, undefined, 4]) {
    const b = recarga(st, { semana: vis });
    assert.equal(b.recuperada, true); assert.equal(b.session.semanaIdx, 3); assert.equal(b.session.identity.semanaIdx, 3);
  }
  const r = resolverSemanaEntrenamiento({ session: a.session, semanaVisibleIdx: 0 });
  assert.equal(r.semanaProgreso, 3); assert.equal(r.semanaSesion, 4);
  assert.equal(resolverSemanaEntrenamiento({ session: { semanaIdx: 4 }, semanaLegadaIdx: 1 }).fuente, "legado", "idx fuera de 0..3 no se acepta");
});
test("15 reconciliacion automatica: la prescripcion de la sesion recuperada sigue siendo la de la semana congelada", () => {
  const ex = { id: "e1", sets: 3, reps: "10", weeks: [{ sets: 3, reps: "10" }, { sets: 4, reps: "8" }] };
  const st = memStorage(); ini(st); const b = recarga(st, { semana: 1 });
  const visible = 1; // la reconciliacion avanzo la semana del plan
  const mostrada = b.session.semanaIdx; // WorkoutScreen: session.semanaIdx si es valida
  const presc = resolveExerciseForWeek(ex, mostrada);
  assert.equal(presc.sets, 3); assert.notEqual(presc.sets, resolveExerciseForWeek(ex, visible).sets);
});
test("sin avance de semana negativo: la recuperacion no modifica el ancla ni semana_activa (solo lee)", () => {
  const st = memStorage(); ini(st); const antes = st.raw();
  recarga(st, { semana: 1 }); recarga(st, { semana: 2, now: T0 + 45 * MIN });
  assert.equal(st.raw(), antes);
  assert.equal(leerSesionActiva(st, A).semana, 0);
});
console.log("\n" + n + " pruebas OK");
