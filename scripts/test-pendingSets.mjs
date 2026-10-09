// Pruebas de lib/pendingSets.js (cola persistente de series pendientes, P0-1/P0-2/P0-3).
//
// Sin infraestructura de test en el repo: se corre directo con Node (type:module) y node:assert:
//
//   node scripts/test-pendingSets.mjs
//
// Sale con codigo 0 si todo pasa; con codigo 1 si falla alguna prueba.

import assert from "node:assert/strict";
import {
  createPendingSets,
  classifySendResult,
  buildPendingPayload,
  generateSetId,
  PENDING_QUEUE_KEY,
  PENDING_QUARANTINE_KEY,
  PENDING_LOCK_KEY,
  PENDING_STATUS,
  SEND_OUTCOME,
  FLUSH_STOP,
} from "../lib/pendingSets.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function memoryStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

function clock(start) {
  let t = start || 1_000_000;
  const f = () => t;
  f.advance = (ms) => { t += ms; };
  return f;
}

// uuid determinista para los tests que no verifican unicidad real
function seqUuid() {
  let n = 0;
  return () => "00000000-0000-4000-8000-" + String(++n).padStart(12, "0");
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const ok = (item) => ({ status: 201, body: [{ id: item.id }] });
const queueOf = (storage) => JSON.parse(storage.getItem(PENDING_QUEUE_KEY) || "[]");

let count = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const set = (alumnoId, extra) => Object.assign({ alumnoId, exId: "bp", kg: 60, reps: 10, note: "", date: "9/10/2026", semana: 0 }, extra || {});

// ── ALTA ───────────────────────────────────────────────────────────────────
test("alta: guarda item con UUID, alumno_id, estado y persiste en el almacenamiento", () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  const item = ps.enqueue(set(A, { kg: "62.5", reps: "8", note: "buena" }));
  assert.match(item.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(item.alumno_id, A);
  assert.equal(item.kg, 62.5);
  assert.equal(item.reps, 8);
  assert.equal(item.status, PENDING_STATUS.PENDING);
  assert.equal(item.attempts, 0);
  const stored = queueOf(storage);
  assert.equal(stored.length, 1);
  assert.deepEqual(stored[0], item);
  assert.equal(ps.count(A), 1);
});

test("alta: payload usa el UUID de la serie y los mismos campos que progreso", () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const item = ps.enqueue(set(A, { exId: "sq", kg: 100, reps: 5, note: "n", date: "9/10/2026", semana: 2 }));
  assert.deepEqual(buildPendingPayload(item), {
    id: item.id, alumno_id: A, ejercicio_id: "sq", kg: 100, reps: 5, nota: "n", fecha: "9/10/2026", semana: 2,
  });
});

test("alta: sin alumnoId / ejercicio / fecha lanza y no escribe nada", () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  assert.throws(() => ps.enqueue(set("")), TypeError);
  assert.throws(() => ps.enqueue(set(null)), TypeError);
  assert.throws(() => ps.enqueue(set(A, { exId: "" })), TypeError);
  assert.throws(() => ps.enqueue(set(A, { date: "" })), TypeError);
  assert.equal(storage.getItem(PENDING_QUEUE_KEY), null);
});

test("alta: si el almacenamiento falla, lanza (la serie no se da por guardada)", () => {
  const storage = memoryStorage();
  storage.setItem = () => { throw new Error("QuotaExceededError"); };
  const ps = createPendingSets({ storage });
  assert.throws(() => ps.enqueue(set(A)), /Quota/);
});

test("alta: con un id ya encolado es idempotente (no duplica)", () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  const first = ps.enqueue(set(A, { id: "fixed-id-1" }));
  const again = ps.enqueue(set(A, { id: "fixed-id-1", kg: 999 }));
  assert.equal(queueOf(storage).length, 1);
  assert.equal(again.id, first.id);
  assert.equal(again.kg, 60);
});

test("generateSetId produce UUID v4 distintos", () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(generateSetId());
  assert.equal(ids.size, 500);
});

// ── RECUPERACION ───────────────────────────────────────────────────────────
test("recuperacion: una instancia nueva (recarga) ve los pendientes y conserva los ids", () => {
  const storage = memoryStorage();
  const before = createPendingSets({ storage });
  const i1 = before.enqueue(set(A));
  const i2 = before.enqueue(set(A, { exId: "sq" }));
  const after = createPendingSets({ storage }); // "recarga"
  assert.deepEqual(after.list(A).map((i) => i.id), [i1.id, i2.id]);
  assert.equal(after.listRetryable(A).length, 2);
});

test("recuperacion: borrar otras claves de la app no afecta la cola", () => {
  const storage = memoryStorage({ it_pg: "{}", it_session: "{}" });
  const ps = createPendingSets({ storage });
  ps.enqueue(set(A));
  storage.removeItem("it_pg");
  storage.removeItem("it_session");
  assert.equal(createPendingSets({ storage }).count(A), 1);
});

test("recuperacion: cola corrupta se respalda y nunca se sobrescribe a ciegas", () => {
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: "{no-es-json" });
  const t = clock(5000);
  const ps = createPendingSets({ storage, now: t });
  assert.equal(ps.count(A), 0);
  const item = ps.enqueue(set(A));
  const backups = [...storage._map.keys()].filter((k) => k.startsWith(PENDING_QUEUE_KEY + "_corrupt_"));
  assert.equal(backups.length, 1);
  assert.equal(storage.getItem(backups[0]), "{no-es-json");
  assert.deepEqual(queueOf(storage).map((i) => i.id), [item.id]);
});

test("recuperacion: cola con forma no-array tambien se respalda", () => {
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: JSON.stringify({ a: 1 }) });
  const ps = createPendingSets({ storage, now: clock() });
  ps.enqueue(set(A));
  const backups = [...storage._map.keys()].filter((k) => k.startsWith(PENDING_QUEUE_KEY + "_corrupt_"));
  assert.equal(backups.length, 1);
  assert.equal(storage.getItem(backups[0]), JSON.stringify({ a: 1 }));
});

// ── CUARENTENA ─────────────────────────────────────────────────────────────
const LEGACY_1 = { exId: "bp", kg: 60, reps: 10, note: "", date: "1/10/2026", semana: 0 };
const LEGACY_2 = { exId: "sq", kg: 80, reps: 5, note: "x", date: "2/10/2026", semana: 0 };

test("cuarentena: items sin alumno_id salen de la cola, intactos, y nunca se listan ni envian", async () => {
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: JSON.stringify([LEGACY_1, LEGACY_2]) });
  const ps = createPendingSets({ storage, now: clock(777) });
  const r = ps.migrate();
  assert.deepEqual(r, { kept: 0, quarantined: 2, corrupt: false });
  assert.deepEqual(queueOf(storage), []);
  const q = ps.listQuarantine();
  assert.equal(q.length, 2);
  assert.deepEqual(q.map((e) => e.original), [LEGACY_1, LEGACY_2]); // verbatim
  assert.ok(q.every((e) => e.reason === "sin_alumno_id" && e.quarantinedAt === 777));
  assert.equal(ps.count(A), 0);
  const sent = [];
  const out = await ps.flush({ alumnoId: A, send: async (p) => { sent.push(p); return { status: 201, body: [{ id: p.id }] }; } });
  assert.equal(sent.length, 0);
  assert.deepEqual(out.confirmed, []);
  assert.equal(ps.listQuarantine().length, 2);
});

test("cuarentena: items con alumno_id se conservan y se completan; mezcla con legacy", () => {
  const withId = { alumno_id: B, exId: "dl", kg: 120, reps: 3, note: "", date: "3/10/2026", semana: 1 };
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: JSON.stringify([LEGACY_1, withId]) });
  const ps = createPendingSets({ storage, now: clock(10), uuid: seqUuid() });
  assert.deepEqual(ps.migrate(), { kept: 1, quarantined: 1, corrupt: false });
  const q = queueOf(storage);
  assert.equal(q.length, 1);
  assert.equal(q[0].alumno_id, B);
  assert.equal(q[0].id, "00000000-0000-4000-8000-000000000001");
  assert.equal(q[0].status, PENDING_STATUS.PENDING);
  assert.equal(ps.count(B), 1);
  assert.equal(ps.count(A), 0);
});

test("cuarentena: migrate es idempotente (no duplica ni cambia ids)", () => {
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: JSON.stringify([LEGACY_1]) });
  const ps = createPendingSets({ storage, now: clock(1) });
  ps.migrate();
  const withId = ps.enqueue(set(A));
  const snapshot = storage.getItem(PENDING_QUEUE_KEY);
  ps.migrate();
  ps.migrate();
  assert.equal(storage.getItem(PENDING_QUEUE_KEY), snapshot);
  assert.equal(ps.listQuarantine().length, 1);
  assert.equal(ps.list(A)[0].id, withId.id);
});

test("cuarentena: reintento tras un corte entre ambos pasos no duplica la cuarentena", () => {
  // Simula que la cuarentena ya se escribio pero la cola vieja sigue intacta.
  const storage = memoryStorage({
    [PENDING_QUEUE_KEY]: JSON.stringify([LEGACY_1]),
    [PENDING_QUARANTINE_KEY]: JSON.stringify([{ original: LEGACY_1, quarantinedAt: 1, reason: "sin_alumno_id" }]),
  });
  const ps = createPendingSets({ storage, now: clock(2) });
  ps.migrate();
  assert.equal(ps.listQuarantine().length, 1);
  assert.deepEqual(queueOf(storage), []);
});

test("cuarentena: si falla escribir la cuarentena, la cola original queda intacta", () => {
  const raw = JSON.stringify([LEGACY_1]);
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: raw });
  const realSet = storage.setItem;
  storage.setItem = (k, v) => { if (k === PENDING_QUARANTINE_KEY) throw new Error("quota"); realSet(k, v); };
  const ps = createPendingSets({ storage });
  assert.throws(() => ps.migrate(), /quota/);
  assert.equal(storage.getItem(PENDING_QUEUE_KEY), raw);
});

test("cuarentena: cola ilegible no se interpreta como vacia (se respalda)", () => {
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: "][" });
  const ps = createPendingSets({ storage, now: clock(9) });
  const r = ps.migrate();
  assert.equal(r.corrupt, true);
  const backups = [...storage._map.keys()].filter((k) => k.includes("_corrupt_"));
  assert.equal(backups.length, 1);
  assert.equal(storage.getItem(backups[0]), "][");
});

test("cuarentena: items nulos / no-objeto de la cola vieja tambien van a cuarentena", () => {
  const storage = memoryStorage({ [PENDING_QUEUE_KEY]: JSON.stringify([null, "x", 5, LEGACY_1]) });
  const ps = createPendingSets({ storage, now: clock(3) });
  assert.deepEqual(ps.migrate(), { kept: 0, quarantined: 4, corrupt: false });
  assert.deepEqual(ps.listQuarantine().map((e) => e.original), [null, "x", 5, LEGACY_1]);
});

// ── CAMBIO DE USUARIO ──────────────────────────────────────────────────────
test("cambio de usuario: flush de B envia solo series de B; las de A quedan intactas", async () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  const a1 = ps.enqueue(set(A, { exId: "a-ex" }));
  const b1 = ps.enqueue(set(B, { exId: "b-ex" }));
  const a2 = ps.enqueue(set(A, { exId: "a-ex2" }));
  const sent = [];
  const out = await ps.flush({ alumnoId: B, send: async (p, it) => { sent.push(p); return ok(it); } });
  assert.deepEqual(sent.map((p) => p.alumno_id), [B]);
  assert.deepEqual(out.confirmed, [b1.id]);
  assert.deepEqual(ps.list(A).map((i) => i.id), [a1.id, a2.id]);
  assert.equal(ps.count(B), 0);
});

test("cambio de usuario: vuelve A y envia lo suyo bajo A", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const a1 = ps.enqueue(set(A));
  ps.enqueue(set(B));
  const sent = [];
  await ps.flush({ alumnoId: A, send: async (p, it) => { sent.push(p); return ok(it); } });
  assert.deepEqual(sent.map((p) => [p.id, p.alumno_id]), [[a1.id, A]]);
  assert.equal(ps.count(A), 0);
  assert.equal(ps.count(B), 1);
});

test("cambio de usuario: sin alumnoId no se envia nada ni se listan items", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  ps.enqueue(set(A));
  let called = 0;
  const out = await ps.flush({ alumnoId: "", send: async () => { called++; return {}; } });
  assert.equal(called, 0);
  assert.equal(out.skipped, true);
  assert.deepEqual(ps.list(""), []);
  assert.deepEqual(ps.list(null), []);
  assert.equal(ps.count(A), 1);
});

test("cambio de usuario: ids de alumno se comparan como texto (sin cruzar ni confundir)", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  ps.enqueue(set(12));
  ps.enqueue(set(120));
  assert.equal(ps.count("12"), 1);
  assert.equal(ps.count(120), 1);
});

// ── DOS SERIES IDENTICAS ───────────────────────────────────────────────────
test("dos series identicas: dos items con UUID distinto y se confirman por separado", async () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  const s1 = ps.enqueue(set(A));
  const s2 = ps.enqueue(set(A));
  const s3 = ps.enqueue(set(A));
  assert.equal(new Set([s1.id, s2.id, s3.id]).size, 3);
  const p1 = buildPendingPayload(s1);
  const p2 = buildPendingPayload(s2);
  assert.notEqual(p1.id, p2.id);
  assert.deepEqual({ ...p1, id: 0 }, { ...p2, id: 0 }); // mismo contenido, distinta identidad
  // confirmar solo la segunda: las otras identicas siguen en cola
  assert.equal(ps.confirm([s2.id]), 1);
  assert.deepEqual(ps.list(A).map((i) => i.id), [s1.id, s3.id]);
});

test("dos series identicas: un flush parcial confirma solo las que el servidor confirmo", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const s1 = ps.enqueue(set(A));
  const s2 = ps.enqueue(set(A));
  const out = await ps.flush({
    alumnoId: A,
    send: async (p, it) => (it.id === s1.id ? ok(it) : { status: 500 }),
  });
  assert.deepEqual(out.confirmed, [s1.id]);
  assert.deepEqual(out.retry, [s2.id]);
  assert.deepEqual(ps.list(A).map((i) => i.id), [s2.id]);
});

// ── RESPUESTA AMBIGUA ──────────────────────────────────────────────────────
test("respuesta ambigua: classifySendResult solo confirma 2xx con la fila de ese id", () => {
  const item = { id: "AbC-123" };
  assert.equal(classifySendResult(item, { status: 201, body: [{ id: "abc-123" }] }), SEND_OUTCOME.CONFIRMED);
  assert.equal(classifySendResult(item, { status: 201, body: [] }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 201, body: null }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 201, body: [{ id: "otro" }] }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 200, body: {} }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, null), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, {}), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { error: new Error("net") }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 0 }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 409 }), SEND_OUTCOME.DUPLICATE);
  assert.equal(classifySendResult(item, { status: 401 }), SEND_OUTCOME.AUTH);
  assert.equal(classifySendResult(item, { status: 403 }), SEND_OUTCOME.AUTH);
  assert.equal(classifySendResult(item, { status: 400 }), SEND_OUTCOME.REJECTED);
  assert.equal(classifySendResult(item, { status: 422 }), SEND_OUTCOME.REJECTED);
  assert.equal(classifySendResult(item, { status: 408 }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 429 }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 500 }), SEND_OUTCOME.RETRY);
  assert.equal(classifySendResult(item, { status: 503 }), SEND_OUTCOME.RETRY);
});

test("respuesta ambigua: sin respuesta valida la serie se conserva y el reintento usa el MISMO id", async () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  const item = ps.enqueue(set(A));
  const seen = [];
  // intento 1: el servidor la guardo pero la respuesta se perdio (null / timeout)
  let out = await ps.flush({ alumnoId: A, send: async (p) => { seen.push(p.id); return null; } });
  assert.deepEqual(out.retry, [item.id]);
  assert.equal(ps.count(A), 1);
  assert.equal(ps.list(A)[0].attempts, 1);
  // intento 2: excepcion (timeout)
  out = await ps.flush({ alumnoId: A, send: async (p) => { seen.push(p.id); throw new Error("timeout"); } });
  assert.deepEqual(out.retry, [item.id]);
  assert.equal(ps.list(A)[0].lastError, "timeout");
  // intento 3: el servidor responde 409 (ya existia) y la verificacion por id lo confirma
  let verified = null;
  out = await ps.flush({
    alumnoId: A,
    send: async (p) => { seen.push(p.id); return { status: 409 }; },
    verify: async (id) => { verified = id; return true; },
  });
  assert.deepEqual(out.confirmed, [item.id]);
  assert.equal(verified, item.id);
  assert.equal(ps.count(A), 0);
  assert.deepEqual(seen, [item.id, item.id, item.id]); // siempre el mismo UUID: sin duplicado posible
});

test("respuesta ambigua: 409 sin poder verificar o con verificacion negativa NO confirma", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const item = ps.enqueue(set(A));
  let out = await ps.flush({ alumnoId: A, send: async () => ({ status: 409 }) }); // sin verify
  assert.deepEqual(out.retry, [item.id]);
  out = await ps.flush({ alumnoId: A, send: async () => ({ status: 409 }), verify: async () => false });
  assert.deepEqual(out.retry, [item.id]);
  out = await ps.flush({ alumnoId: A, send: async () => ({ status: 409 }), verify: async () => { throw new Error("net"); } });
  assert.deepEqual(out.retry, [item.id]);
  out = await ps.flush({ alumnoId: A, send: async () => ({ status: 409 }), verify: async () => "true" }); // solo === true
  assert.deepEqual(out.retry, [item.id]);
  assert.equal(ps.count(A), 1);
});

test("respuesta ambigua: 2xx con fila de otro id no confirma", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const item = ps.enqueue(set(A));
  const out = await ps.flush({ alumnoId: A, send: async () => ({ status: 201, body: [{ id: "otro-id" }] }) });
  assert.deepEqual(out.confirmed, []);
  assert.deepEqual(out.retry, [item.id]);
  assert.equal(ps.count(A), 1);
});

test("errores HTTP: 401/403 conserva, marca auth_error y corta; 400 rechaza sin reintento; 500 reintenta", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const s1 = ps.enqueue(set(A, { exId: "e1" }));
  const s2 = ps.enqueue(set(A, { exId: "e2" }));
  let calls = 0;
  let out = await ps.flush({ alumnoId: A, send: async () => { calls++; return { status: 401 }; } });
  assert.equal(calls, 1); // no insiste con el resto
  assert.equal(out.stopped, FLUSH_STOP.AUTH);
  assert.deepEqual(out.authError, [s1.id]);
  assert.equal(ps.count(A), 2);
  assert.equal(ps.list(A).find((i) => i.id === s1.id).status, PENDING_STATUS.AUTH_ERROR);
  // flush normal no reintenta auth_error ...
  calls = 0;
  out = await ps.flush({ alumnoId: A, send: async (p, it) => { calls++; return ok(it); } });
  assert.equal(calls, 1); // solo s2 (pending)
  assert.deepEqual(out.confirmed, [s2.id]);
  // ... salvo que el llamador lo pida (p. ej. tras volver a iniciar sesion)
  out = await ps.flush({ alumnoId: A, includeAuthError: true, send: async (p, it) => ok(it) });
  assert.deepEqual(out.confirmed, [s1.id]);
  assert.equal(ps.count(A), 0);

  const s3 = ps.enqueue(set(A));
  out = await ps.flush({ alumnoId: A, send: async () => ({ status: 422 }) });
  assert.deepEqual(out.rejected, [s3.id]);
  assert.equal(ps.list(A)[0].status, PENDING_STATUS.REJECTED);
  calls = 0;
  await ps.flush({ alumnoId: A, includeAuthError: true, send: async () => { calls++; return {}; } });
  assert.equal(calls, 0); // rejected nunca se reintenta solo
  assert.equal(ps.count(A), 1); // pero se conserva

  const s4 = ps.enqueue(set(A));
  out = await ps.flush({ alumnoId: A, send: async () => ({ status: 500 }) });
  assert.deepEqual(out.retry, [s4.id]);
  assert.equal(ps.list(A).find((i) => i.id === s4.id).status, PENDING_STATUS.PENDING);
});

// ── CONCURRENCIA ───────────────────────────────────────────────────────────
test("concurrencia: dos flush simultaneos (misma instancia) -> uno envia, el otro queda bloqueado", async () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const item = ps.enqueue(set(A));
  const gate = deferred();
  const sent = [];
  const f1 = ps.flush({ alumnoId: A, send: async (p, it) => { sent.push(p.id); await gate.promise; return ok(it); } });
  const f2 = await ps.flush({ alumnoId: A, send: async (p, it) => { sent.push("segundo:" + p.id); return ok(it); } });
  assert.equal(f2.locked, true);
  gate.resolve();
  const r1 = await f1;
  assert.deepEqual(r1.confirmed, [item.id]);
  assert.deepEqual(sent, [item.id]);
  assert.equal(ps.count(A), 0);
});

test("concurrencia: dos 'pestanas' (instancias sobre el mismo almacenamiento) no envian en paralelo", async () => {
  const storage = memoryStorage();
  const t = clock();
  const tab1 = createPendingSets({ storage, now: t });
  const tab2 = createPendingSets({ storage, now: t });
  const item = tab1.enqueue(set(A));
  const gate = deferred();
  let sends = 0;
  const f1 = tab1.flush({ alumnoId: A, send: async (p, it) => { sends++; await gate.promise; return ok(it); } });
  const r2 = await tab2.flush({ alumnoId: A, send: async (p, it) => { sends++; return ok(it); } });
  assert.equal(r2.locked, true);
  gate.resolve();
  await f1;
  assert.equal(sends, 1);
  assert.equal(tab2.count(A), 0);
  // terminado el primero, la otra pestana puede volver a sincronizar (nada pendiente)
  const r3 = await tab2.flush({ alumnoId: A, send: async () => { sends++; return {}; } });
  assert.equal(r3.locked, false);
  assert.equal(sends, 1);
  assert.equal(item.alumno_id, A);
});

test("concurrencia: un lease vencido (pestana caida) se puede tomar; el viejo dueno no puede liberar ni renovar", async () => {
  const storage = memoryStorage();
  const t = clock();
  const ps = createPendingSets({ storage, now: t, leaseMs: 1000 });
  assert.equal(ps.acquireLease("dueno-viejo"), true);
  assert.equal(ps.acquireLease("otro"), false); // vigente
  t.advance(1500); // vencio
  assert.equal(ps.acquireLease("dueno-nuevo"), true);
  assert.equal(ps.renewLease("dueno-viejo"), false);
  ps.releaseLease("dueno-viejo"); // no debe liberar el lease ajeno
  assert.equal(ps.acquireLease("tercero"), false);
  ps.releaseLease("dueno-nuevo");
  assert.equal(ps.acquireLease("tercero"), true);
});

test("concurrencia: el flush libera el lease aunque send lance", async () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  ps.enqueue(set(A));
  await ps.flush({ alumnoId: A, send: async () => { throw new Error("boom"); } });
  assert.equal(storage.getItem(PENDING_LOCK_KEY), null);
});

test("concurrencia: serie encolada DURANTE un flush no se pierde (sin escritura obsoleta)", async () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  const s1 = ps.enqueue(set(A, { exId: "e1" }));
  const gate = deferred();
  const f = ps.flush({ alumnoId: A, send: async (p, it) => { await gate.promise; return ok(it); } });
  const s2 = ps.enqueue(set(A, { exId: "e2" })); // el alumno registra otra serie mientras se sincroniza
  const s3 = ps.enqueue(set(A, { exId: "e3" }));
  gate.resolve();
  const out = await f;
  assert.ok(out.confirmed.includes(s1.id));
  const left = ps.list(A).map((i) => i.id);
  assert.ok(left.includes(s2.id) && left.includes(s3.id), "las series nuevas siguen en cola");
  assert.ok(!left.includes(s1.id));
});

test("concurrencia: confirm / markAttempt sobre un item ya quitado son no-op (no resucitan)", () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage });
  const item = ps.enqueue(set(A));
  assert.equal(ps.confirm([item.id]), 1);
  assert.equal(ps.confirm([item.id]), 0);
  assert.equal(ps.markAttempt(item.id, { status: PENDING_STATUS.REJECTED, error: "x" }), false);
  assert.equal(ps.count(A), 0);
  assert.deepEqual(queueOf(storage), []);
});

test("concurrencia: confirm solo borra por UUID; ids desconocidos / vacios no tocan nada", () => {
  const ps = createPendingSets({ storage: memoryStorage() });
  const a = ps.enqueue(set(A));
  const b = ps.enqueue(set(B));
  assert.equal(ps.confirm([]), 0);
  assert.equal(ps.confirm(null), 0);
  assert.equal(ps.confirm(["", null, undefined, "no-existe"]), 0);
  assert.equal(ps.count(A), 1);
  assert.equal(ps.count(B), 1);
  assert.equal(ps.confirm([a.id]), 1);
  assert.equal(ps.count(B), 1);
  assert.equal(b.alumno_id, B);
});

test("concurrencia: otra pestana confirma el item mientras esta enviaba -> no se reenvia ni se pisa", async () => {
  const storage = memoryStorage();
  const t = clock();
  const tab1 = createPendingSets({ storage, now: t });
  const tab2 = createPendingSets({ storage, now: t });
  const s1 = tab1.enqueue(set(A, { exId: "e1" }));
  const s2 = tab1.enqueue(set(A, { exId: "e2" }));
  const sent = [];
  const out = await tab1.flush({
    alumnoId: A,
    send: async (p, it) => {
      sent.push(p.id);
      if (p.id === s1.id) tab2.confirm([s2.id]); // la otra pestana ya confirmo la segunda
      return ok(it);
    },
  });
  assert.deepEqual(sent, [s1.id]); // s2 ya no existia al llegar su turno
  assert.deepEqual(out.confirmed, [s1.id]);
  assert.equal(tab1.count(A), 0);
});

test("concurrencia: si se pierde el lease durante el envio no se escribe el resultado (item intacto)", async () => {
  const storage = memoryStorage();
  const t = clock();
  const ps = createPendingSets({ storage, now: t, leaseMs: 1000 });
  const item = ps.enqueue(set(A));
  const out = await ps.flush({
    alumnoId: A,
    send: async (p, it) => {
      // otro proceso toma el lease vencido mientras esperamos la red
      t.advance(5000);
      assert.equal(ps.acquireLease("intruso"), true);
      return ok(it);
    },
  });
  assert.equal(out.stopped, FLUSH_STOP.LOST_LEASE);
  assert.deepEqual(out.confirmed, []);
  assert.deepEqual(ps.list(A).map((i) => i.id), [item.id]); // sigue en cola con su UUID: reenviar es seguro
  assert.equal(ps.list(A)[0].attempts, 0);
  // el intruso conserva su lease: el dueno original no lo libera
  assert.equal(ps.acquireLease("otro"), false);
});

// ── runner ─────────────────────────────────────────────────────────────────
for (const t of tests) {
  try {
    await t.fn();
    count++;
    console.log("ok - " + t.name);
  } catch (e) {
    failures.push({ name: t.name, error: e });
    console.log("not ok - " + t.name);
    console.log("  " + (e && e.stack ? e.stack.split("\n").slice(0, 4).join("\n  ") : e));
  }
}

console.log("\n" + count + "/" + tests.length + " pruebas OK");
if (failures.length) {
  console.log(failures.length + " fallaron");
  process.exit(1);
}
