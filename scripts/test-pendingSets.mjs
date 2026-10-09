// Pruebas de lib/pendingSets.js (cola persistente de series pendientes, P0-1/P0-2/P0-3).
//
// Sin infraestructura de test en el repo: se corre directo con Node (type:module) y node:assert:
//
//   node scripts/test-pendingSets.mjs
//
// Sale con codigo 0 si todo pasa; con codigo 1 si falla alguna prueba.
//
// Las "pestanas" son instancias de createPendingSets sobre el MISMO almacenamiento. El almacenamiento de prueba
// permite (a) intercalar codigo de otra pestana justo antes/despues de una operacion y (b) hacer fallar la N-esima
// escritura, para probar cortes parciales.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPendingSets,
  classifySendResult,
  buildPendingPayload,
  rowMatchesPayload,
  generateSetId,
  isValidSetId,
  isPendingSetsKey,
  PendingSetsError,
  PENDING_LEGACY_KEY,
  PENDING_STATUS,
  SEND_OUTCOME,
  FLUSH_STOP,
  COORDINATION,
} from "../lib/pendingSets.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const ITEM = "it_pending_sync:item:";
const META = "it_pending_sync:meta:";
const QUAR = "it_pending_sync_legacy:";
const JOURNAL = "it_pending_sync:migration";
const flushLease = (alumno) => "it_pending_sync:flush:" + alumno; // nombre logico del lock/lease de flush
const leaseKey = (name) => "it_pending_sync:lease:" + name;

function memoryStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  const hooks = { before: null, after: null };
  const run = (kind, op, key, value) => {
    const h = hooks[kind];
    if (!h) return;
    hooks[kind] = null; // sin reentrada: lo que haga el hook no dispara hooks
    try { h(op, key, value); } finally { hooks[kind] = h; }
  };
  const s = {
    get length() { return m.size; },
    key(i) { const ks = [...m.keys()]; return i < ks.length ? ks[i] : null; },
    getItem(k) { run("before", "get", k); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) {
      s.writes++;
      if (s.failAt && s.writes === s.failAt) throw new Error("boom@" + s.writes);
      run("before", "set", k, v);
      m.set(k, String(v));
      run("after", "set", k, v);
    },
    removeItem(k) {
      s.writes++;
      if (s.failAt && s.writes === s.failAt) throw new Error("boom@" + s.writes);
      run("before", "remove", k);
      m.delete(k);
      run("after", "remove", k);
    },
    writes: 0,
    failAt: 0,
    hooks,
    _map: m,
  };
  return s;
}

const keysOf = (storage, prefix) => [...storage._map.keys()].filter((k) => k.startsWith(prefix));

function clock(start) {
  let t = start || 1_000_000;
  const f = () => t;
  f.advance = (ms) => { t += ms; };
  return f;
}

// uuid determinista (v4 valido) para pruebas con UNA sola instancia
function seqUuid() {
  let n = 0;
  return () => "00000000-0000-4000-8000-" + String(++n).padStart(12, "0");
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

// Web Locks de prueba: exclusivo, con ifAvailable (suficiente para lo que usa el modulo)
function fakeLocks() {
  const held = new Set();
  return {
    held,
    async request(name, options, cb) {
      if (typeof options === "function") { cb = options; options = {}; }
      if (held.has(name)) {
        if (options && options.ifAvailable) return cb(null);
        throw new Error("fakeLocks: la cola de espera no se usa en estas pruebas");
      }
      held.add(name);
      try { return await cb({ name, mode: "exclusive" }); } finally { held.delete(name); }
    },
  };
}

// "Servidor" con clave primaria en id: un POST repetido responde 409
function fakeServer() {
  const rows = new Map();
  const server = {
    rows,
    mode: null, // "500" | "lost" (guarda y pierde la respuesta) | null
    posts: [],
    async send(payload) {
      server.posts.push(payload.id);
      if (server.mode === "500") return { status: 500 };
      if (rows.has(payload.id)) return { status: 409 };
      rows.set(payload.id, { ...payload });
      if (server.mode === "lost") return { error: new Error("network") };
      return { status: 201, body: [{ ...payload }] };
    },
    async fetchRow(id) { return rows.has(id) ? [{ ...rows.get(id) }] : []; },
  };
  return server;
}


// Instancia con Web Locks simulado COMPARTIDO por almacenamiento (dos "pestanas" sobre el mismo storage se excluyen).
// Un test que pase `locks` (incluido null) conserva exactamente lo que pidio.
const locksByStorage = new WeakMap();
function makePS(options) {
  const o = options || {};
  if (!("locks" in o) && o.storage) {
    if (!locksByStorage.has(o.storage)) locksByStorage.set(o.storage, fakeLocks());
    return createPendingSets({ ...o, locks: locksByStorage.get(o.storage) });
  }
  return createPendingSets(o);
}

const okRes = (p) => ({ status: 201, body: [{ id: p.id }] });

let count = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const set = (alumnoId, extra) => Object.assign({ alumnoId, exId: "bp", kg: 60, reps: 10, note: "", date: "9/10/2026", semana: 0 }, extra || {});

// ══ ALTA ═══════════════════════════════════════════════════════════════════
test("alta: item con UUID, alumno_id y estado; vive en UNA clave propia (no hay array compartido)", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const item = ps.enqueue(set(A, { kg: "62.5", reps: "8", note: "buena" }));
  assert.ok(isValidSetId(item.id));
  assert.equal(item.alumno_id, A);
  assert.equal(item.kg, 62.5);
  assert.equal(item.reps, 8);
  assert.equal(item.status, PENDING_STATUS.PENDING);
  assert.equal(item.attempts, 0);
  assert.deepEqual(keysOf(storage, "it_pending_sync"), [ITEM + item.id]);
  assert.equal(storage.getItem(PENDING_LEGACY_KEY), null);
  assert.equal(ps.count(A), 1);
});

test("alta: enqueue hace exactamente UNA escritura y ninguna lectura-modificacion-escritura compartida", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  ps.enqueue(set(A));
  const before = storage.writes;
  ps.enqueue(set(A));
  assert.equal(storage.writes - before, 1);
});

test("alta: payload usa el UUID de la serie y los mismos campos que progreso", () => {
  const ps = makePS({ storage: memoryStorage() });
  const item = ps.enqueue(set(A, { exId: "sq", kg: 100, reps: 5, note: "n", date: "9/10/2026", semana: 2 }));
  assert.deepEqual(buildPendingPayload(item), {
    id: item.id, alumno_id: A, ejercicio_id: "sq", kg: 100, reps: 5, nota: "n", fecha: "9/10/2026", semana: 2,
  });
});

test("alta: sin alumnoId / ejercicio / fecha lanza y no escribe nada", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  assert.throws(() => ps.enqueue(set("")), TypeError);
  assert.throws(() => ps.enqueue(set(null)), TypeError);
  assert.throws(() => ps.enqueue(set(A, { exId: "" })), TypeError);
  assert.throws(() => ps.enqueue(set(A, { date: "" })), TypeError);
  assert.equal(storage.writes, 0);
  assert.equal(storage._map.size, 0);
});

test("alta: si el almacenamiento falla, lanza y no queda nada a medias", () => {
  const storage = memoryStorage();
  storage.failAt = 1;
  const ps = makePS({ storage });
  assert.throws(() => ps.enqueue(set(A)), /boom/);
  assert.equal(storage._map.size, 0);
  storage.failAt = 0;
  assert.equal(ps.count(A), 0);
});

test("alta: con un id ya encolado es idempotente (no duplica ni pisa)", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const id = generateSetId();
  const first = ps.enqueue(set(A, { id }));
  const again = ps.enqueue(set(A, { id, kg: 999 }));
  assert.equal(keysOf(storage, ITEM).length, 1);
  assert.equal(again.id, first.id);
  assert.equal(again.kg, 60);
});

test("alta intercalada entre pestanas: cada enqueue es una clave unica, no se pisan", () => {
  const storage = memoryStorage();
  const tab1 = makePS({ storage });
  const tab2 = makePS({ storage });
  const fromTab2 = [];
  let n = 0;
  storage.hooks.before = (op, key) => {
    if (op === "set" && key.startsWith(ITEM) && n < 2) { n++; fromTab2.push(tab2.enqueue(set(A, { exId: "t2-" + n })).id); }
  };
  const fromTab1 = [tab1.enqueue(set(A, { exId: "t1-a" })).id, tab1.enqueue(set(A, { exId: "t1-b" })).id];
  storage.hooks.before = null;
  const all = tab1.list(A).map((i) => i.id).sort();
  assert.deepEqual(all, [...fromTab1, ...fromTab2].sort());
  assert.equal(all.length, 4);
});

// ══ UUID ═══════════════════════════════════════════════════════════════════
test("uuid: usa crypto.randomUUID si existe", () => {
  const fixed = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
  assert.equal(generateSetId({ randomUUID: () => fixed }), fixed);
});

test("uuid: si randomUUID devuelve algo invalido o no existe, usa getRandomValues (v4 valido)", () => {
  const ff = { getRandomValues: (b) => { b.fill(0xff); return b; } };
  assert.equal(generateSetId(ff), "ffffffff-ffff-4fff-bfff-ffffffffffff");
  const bad = { randomUUID: () => "no-es-uuid", getRandomValues: (b) => { b.fill(0x00); return b; } };
  assert.equal(generateSetId(bad), "00000000-0000-4000-8000-000000000000");
});

test("uuid: generateSetId real produce v4 validos y distintos", () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) { const id = generateSetId(); assert.ok(isValidSetId(id)); ids.add(id); }
  assert.equal(ids.size, 500);
});

test("uuid: sin fuente segura lanza NO_SECURE_RANDOM y NUNCA recurre a Math.random", () => {
  const realRandom = Math.random;
  Math.random = () => { throw new Error("Math.random no debe usarse"); };
  try {
    for (const bad of [{}, null, { randomUUID: () => "x" }, { getRandomValues: "no-es-funcion" }]) {
      assert.throws(() => generateSetId(bad), (e) => e instanceof PendingSetsError && e.code === "NO_SECURE_RANDOM");
    }
  } finally { Math.random = realRandom; }
});

test("uuid: enqueue sin fuente aleatoria segura lanza y no escribe nada", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage, uuid: () => generateSetId({}) });
  assert.throws(() => ps.enqueue(set(A)), (e) => e.code === "NO_SECURE_RANDOM");
  assert.equal(storage.writes, 0);
});

test("uuid: un generador que devuelve un UUID invalido, o un id explicito invalido, no se acepta", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage, uuid: () => "id-1" });
  assert.throws(() => ps.enqueue(set(A)), (e) => e.code === "INVALID_UUID");
  const ps2 = makePS({ storage });
  for (const bad of ["", "abc", "11111111-1111-1111-8111-111111111111" /* version 1 */, "11111111-1111-4111-1111-111111111111" /* variante */, 42]) {
    assert.throws(() => ps2.enqueue(set(A, { id: bad })), (e) => e.code === "INVALID_UUID", String(bad));
  }
  assert.equal(storage.writes, 0);
});

test("uuid: el codigo del modulo no contiene Math.random", () => {
  const src = readFileSync(new URL("../lib/pendingSets.js", import.meta.url), "utf8");
  assert.equal(src.includes("Math.random"), false);
});

// ══ RECUPERACION ═══════════════════════════════════════════════════════════
test("recuperacion: una instancia nueva (recarga) ve los pendientes y conserva los ids", () => {
  const storage = memoryStorage();
  const before = makePS({ storage, now: clock(10) });
  const i1 = before.enqueue(set(A));
  const i2 = before.enqueue(set(A, { exId: "sq" }));
  const after = makePS({ storage });
  assert.deepEqual(after.list(A).map((i) => i.id).sort(), [i1.id, i2.id].sort());
  assert.equal(after.listRetryable(A).length, 2);
});

test("recuperacion: el estado (intentos, error) tambien sobrevive a la recarga", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const it = ps.enqueue(set(A));
  ps.markAttempt(it.id, { status: PENDING_STATUS.PENDING, error: "http_500" });
  ps.markAttempt(it.id, { status: PENDING_STATUS.PENDING, error: "timeout" });
  const again = makePS({ storage }).list(A)[0];
  assert.equal(again.attempts, 2);
  assert.equal(again.lastError, "timeout");
});

test("recuperacion: borrar otras claves de la app no afecta la cola", () => {
  const storage = memoryStorage({ it_pg: "{}", it_session: "{}" });
  const ps = makePS({ storage });
  ps.enqueue(set(A));
  storage.removeItem("it_pg");
  storage.removeItem("it_session");
  assert.equal(makePS({ storage }).count(A), 1);
});

test("recuperacion: un registro ilegible se conserva intacto y no afecta al resto", () => {
  const storage = memoryStorage({ [ITEM + A]: "{no-es-json" });
  const ps = makePS({ storage });
  const good = ps.enqueue(set(A));
  assert.deepEqual(ps.list(A).map((i) => i.id), [good.id]);
  assert.deepEqual(ps.listCorrupt(), [ITEM + A]);
  assert.equal(storage.getItem(ITEM + A), "{no-es-json");
});

test("recuperacion: un 'meta' ilegible se trata como estado por defecto sin perder la serie", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const it = ps.enqueue(set(A));
  storage.setItem(META + it.id, "}{");
  const got = ps.list(A)[0];
  assert.equal(got.status, PENDING_STATUS.PENDING);
  assert.equal(got.attempts, 0);
});

test("isPendingSetsKey cubre todas las claves del modulo (para excluirlas de las limpiezas de la app)", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  ps.enqueue(set(A));
  assert.ok([...storage._map.keys()].every(isPendingSetsKey));
  assert.ok(isPendingSetsKey(PENDING_LEGACY_KEY) && isPendingSetsKey(JOURNAL) && isPendingSetsKey(QUAR + "x"));
  assert.equal(isPendingSetsKey("it_pg"), false);
  assert.equal(isPendingSetsKey(null), false);
});

// ══ CUARENTENA / MIGRACION ═════════════════════════════════════════════════
const LEGACY_1 = { exId: "bp", kg: 60, reps: 10, note: "", date: "1/10/2026", semana: 0 };
const LEGACY_2 = { exId: "sq", kg: 80, reps: 5, note: "x", date: "2/10/2026", semana: 0 };
const legacyArray = (arr) => JSON.stringify(arr);

test("cuarentena: registros ANTIGUOS IDENTICOS se conservan uno por uno (no se fusionan)", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1, LEGACY_1, LEGACY_2, LEGACY_1]) });
  const ps = makePS({ storage, now: clock(777) });
  const r = await ps.migrate();
  assert.equal(r.quarantined, 4);
  assert.equal(r.kept, 0);
  const q = ps.listQuarantine();
  assert.equal(q.length, 4);
  assert.equal(new Set(q.map((e) => e.id)).size, 4);
  assert.deepEqual(q.map((e) => e.original), [LEGACY_1, LEGACY_1, LEGACY_2, LEGACY_1]); // verbatim y en orden
  assert.ok(q.every((e) => e.reason === "sin_alumno_id" && e.quarantinedAt === 777));
  assert.deepEqual(q.map((e) => e.index), [0, 1, 2, 3]);
  assert.equal(storage.getItem(PENDING_LEGACY_KEY), null);
  assert.equal(storage.getItem(JOURNAL), null);
});

test("cuarentena: nunca se listan ni se envian solos", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1, LEGACY_2]) });
  const ps = makePS({ storage, locks: null, advisoryFallback: true });
  await ps.migrate();
  assert.equal(ps.count(A), 0);
  const sent = [];
  const out = await ps.flush({ alumnoId: A, send: async (p) => { sent.push(p); return okRes(p); } });
  assert.equal(sent.length, 0);
  assert.deepEqual(out.confirmed, []);
  assert.equal(ps.listQuarantine().length, 2);
});

test("cuarentena: con alumno_id se conservan como series (ids nuevos); sin datos minimos van a cuarentena", async () => {
  const withId = { alumno_id: B, exId: "dl", kg: 120, reps: 3, note: "", date: "3/10/2026", semana: 1, id: "viejo" };
  const noEx = { alumno_id: A, kg: 1, reps: 1, date: "3/10/2026" };
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1, withId, noEx, null, "x", 5]) });
  const ps = makePS({ storage, now: clock(10) });
  const r = await ps.migrate();
  assert.deepEqual([r.kept, r.quarantined], [1, 5]);
  const items = ps.list(B);
  assert.equal(items.length, 1);
  assert.ok(isValidSetId(items[0].id));
  assert.equal(items[0].legacyId, "viejo");
  assert.equal(items[0].status, PENDING_STATUS.PENDING);
  assert.deepEqual(ps.listQuarantine().map((e) => e.original), [LEGACY_1, noEx, null, "x", 5]);
});

test("cuarentena: migrate es idempotente (segunda ejecucion no cambia nada)", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1, LEGACY_1, { ...LEGACY_2, alumno_id: A }]) });
  const ps = makePS({ storage, now: clock(1) });
  await ps.migrate();
  const snapshot = JSON.stringify([...storage._map.entries()]);
  const again = await ps.migrate();
  await ps.migrate();
  assert.deepEqual([again.kept, again.quarantined, again.busy], [0, 0, false]);
  assert.equal(JSON.stringify([...storage._map.entries()]), snapshot);
});

test("cuarentena: array viejo ilegible o con otra forma se respalda, no se interpreta como vacio", async () => {
  for (const raw of ["][", JSON.stringify({ a: 1 })]) {
    const storage = memoryStorage({ [PENDING_LEGACY_KEY]: raw });
    const ps = makePS({ storage, now: clock(9) });
    const r = await ps.migrate();
    assert.equal(r.corrupt, true);
    const backups = keysOf(storage, PENDING_LEGACY_KEY + "_corrupt_");
    assert.equal(backups.length, 1);
    assert.equal(storage.getItem(backups[0]), raw);
    assert.equal(ps.listQuarantine().length, 0);
  }
});

test("cuarentena: diario ilegible se respalda y la migracion parte de cero desde el array viejo", async () => {
  const storage = memoryStorage({ [JOURNAL]: "{{", [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1]) });
  const ps = makePS({ storage, now: clock(4) });
  const r = await ps.migrate();
  assert.equal(r.quarantined, 1);
  assert.equal(keysOf(storage, JOURNAL + "_corrupt_").length, 1);
  assert.equal(storage.getItem(JOURNAL), null);
});

test("cuarentena: CORTE en cada escritura de la migracion -> reanudar no pierde ni duplica, y conserva cada registro", async () => {
  const validA = { alumno_id: A, exId: "bp", kg: 60, reps: 10, note: "", date: "1/10/2026", semana: 0 };
  const entries = [validA, LEGACY_1, LEGACY_1, 5, { ...validA }]; // 2 validos identicos + 3 antiguos (2 identicos)
  const raw = legacyArray(entries);
  let completedAt = 0;
  for (let k = 1; k <= 60; k++) {
    const storage = memoryStorage({ [PENDING_LEGACY_KEY]: raw });
    const ps = makePS({ storage, uuid: seqUuid(), now: clock(5) });
    storage.failAt = k;
    let crashed = false;
    try { await ps.migrate(); } catch (e) { crashed = true; }
    if (!crashed) { completedAt = k; break; }
    // tras un corte siempre queda el array viejo o el diario: se puede reanudar
    assert.ok(storage.getItem(PENDING_LEGACY_KEY) !== null || storage.getItem(JOURNAL) !== null, "sin salida de recuperacion en k=" + k);
    const idsBefore = ps.list(A).map((i) => i.id);
    storage.failAt = 0;
    const r = await ps.migrate();
    assert.equal(r.busy, false, "k=" + k);
    const items = ps.list(A);
    assert.equal(items.length, 2, "items k=" + k);
    assert.equal(new Set(items.map((i) => i.id)).size, 2);
    idsBefore.forEach((id) => assert.ok(items.some((i) => i.id === id), "id estable tras reanudar k=" + k));
    const q = ps.listQuarantine();
    assert.equal(q.length, 3, "cuarentena k=" + k);
    assert.equal(new Set(q.map((e) => e.id)).size, 3);
    assert.deepEqual(q.map((e) => e.original), [LEGACY_1, LEGACY_1, 5]);
    assert.equal(storage.getItem(PENDING_LEGACY_KEY), null, "legacy k=" + k);
    assert.equal(storage.getItem(JOURNAL), null, "diario k=" + k);
    const snap = JSON.stringify([...storage._map.entries()]);
    await ps.migrate();
    assert.equal(JSON.stringify([...storage._map.entries()]), snap, "idempotente k=" + k);
  }
  assert.ok(completedAt > 8, "se probaron cortes en todas las escrituras (" + completedAt + ")");
});

test("cuarentena: una pestana con codigo viejo AGREGA al array durante la migracion -> no se pierde", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1, LEGACY_2]) });
  let tick = 0;
  const ps = makePS({ storage, now: () => ++tick });
  const late = { exId: "dl", kg: 100, reps: 3, note: "", date: "5/10/2026", semana: 0 };
  let gets = 0;
  storage.hooks.before = (op, key) => {
    if (op === "get" && key === PENDING_LEGACY_KEY && ++gets === 2) {
      storage._map.set(PENDING_LEGACY_KEY, legacyArray([LEGACY_1, LEGACY_2, late])); // el codigo viejo escribe sin enterarse
    }
  };
  const r = await ps.migrate();
  storage.hooks.before = null;
  assert.equal(r.legacyChanged, false);
  assert.deepEqual(JSON.parse(storage.getItem(PENDING_LEGACY_KEY)), [late]); // lo no consumido sigue ahi
  await ps.migrate();
  assert.deepEqual(ps.listQuarantine().map((e) => e.original), [LEGACY_1, LEGACY_2, late]);
  assert.equal(storage.getItem(PENDING_LEGACY_KEY), null);
});

test("cuarentena: si el codigo viejo REESCRIBE el array de forma incompatible, no se toca y se avisa", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1]) });
  const ps = makePS({ storage, now: clock(1) });
  const rewritten = legacyArray([LEGACY_2]);
  let gets = 0;
  storage.hooks.before = (op, key) => {
    if (op === "get" && key === PENDING_LEGACY_KEY && ++gets === 2) storage._map.set(PENDING_LEGACY_KEY, rewritten);
  };
  const r = await ps.migrate();
  storage.hooks.before = null;
  assert.equal(r.legacyChanged, true);
  assert.equal(storage.getItem(PENDING_LEGACY_KEY), rewritten); // intacto
  assert.equal(ps.listQuarantine().length, 1);
  await ps.migrate(); // el contenido nuevo se procesa en la siguiente ejecucion
  assert.deepEqual(ps.listQuarantine().map((e) => e.original).sort((a, b) => a.exId.localeCompare(b.exId)), [LEGACY_1, LEGACY_2]);
});

test("cuarentena: si otra pestana creo su diario justo despues, esta no escribe nada (busy) y la otra completa sin duplicar", async () => {
  const raw = legacyArray([LEGACY_1, LEGACY_1]);
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: raw });
  const tab1 = makePS({ storage, locks: null, now: clock(1) });
  const tab2 = makePS({ storage, locks: null, now: clock(1) });
  const otherJournal = {
    v: 1, id: generateSetId(), raw, ids: [generateSetId(), generateSetId()], startedAt: 1,
  };
  storage.hooks.after = (op, key) => { if (op === "set" && key === JOURNAL) storage._map.set(JOURNAL, JSON.stringify(otherJournal)); };
  const r1 = await tab1.migrate();
  storage.hooks.after = null;
  assert.equal(r1.busy, true);
  assert.equal(tab1.listQuarantine().length, 0);
  const r2 = await tab2.migrate(); // retoma el diario ganador
  assert.equal(r2.resumed, true);
  const q = tab2.listQuarantine();
  assert.equal(q.length, 2);
  assert.ok(q.every((e) => e.migrationId === otherJournal.id));
  assert.equal(storage.getItem(PENDING_LEGACY_KEY), null);
});

test("cuarentena: con Web Locks, dos migrate simultaneos -> uno trabaja y el otro queda busy", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1]) });
  const locks = fakeLocks();
  const tab1 = makePS({ storage, locks, now: clock(1) });
  const tab2 = makePS({ storage, locks, now: clock(1) });
  let second = null;
  storage.hooks.before = (op, key) => { if (op === "set" && key === JOURNAL && !second) second = tab2.migrate(); };
  const r1 = await tab1.migrate();
  storage.hooks.before = null;
  const r2 = await second;
  assert.equal(r1.quarantined, 1);
  assert.equal(r2.busy, true);
  assert.equal(tab1.listQuarantine().length, 1);
});

test("cuarentena: sin Web Locks el lease consultivo tambien evita el solapamiento normal", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: legacyArray([LEGACY_1]) });
  const tab1 = makePS({ storage, locks: null, now: clock(1) });
  const tab2 = makePS({ storage, locks: null, now: clock(1) });
  let second = null;
  storage.hooks.before = (op, key) => { if (op === "set" && key === JOURNAL && !second) second = tab2.migrate(); };
  await tab1.migrate();
  storage.hooks.before = null;
  assert.equal((await second).busy, true);
  assert.equal(tab1.listQuarantine().length, 1);
});

// ══ CAMBIO DE USUARIO ══════════════════════════════════════════════════════
test("cambio de usuario: flush de B envia solo series de B; las de A quedan intactas", async () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const a1 = ps.enqueue(set(A, { exId: "a-ex" }));
  const b1 = ps.enqueue(set(B, { exId: "b-ex" }));
  const a2 = ps.enqueue(set(A, { exId: "a-ex2" }));
  const sent = [];
  const out = await ps.flush({ alumnoId: B, send: async (p) => { sent.push(p); return okRes(p); } });
  assert.deepEqual(sent.map((p) => p.alumno_id), [B]);
  assert.deepEqual(out.confirmed, [b1.id]);
  assert.deepEqual(ps.list(A).map((i) => i.id).sort(), [a1.id, a2.id].sort());
  assert.equal(ps.count(B), 0);
});

test("cambio de usuario: vuelve A y envia lo suyo bajo A", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const a1 = ps.enqueue(set(A));
  ps.enqueue(set(B));
  const sent = [];
  await ps.flush({ alumnoId: A, send: async (p) => { sent.push(p); return okRes(p); } });
  assert.deepEqual(sent.map((p) => [p.id, p.alumno_id]), [[a1.id, A]]);
  assert.equal(ps.count(A), 0);
  assert.equal(ps.count(B), 1);
});

test("cambio de usuario: sin alumnoId no se envia nada ni se listan items", async () => {
  const ps = makePS({ storage: memoryStorage() });
  ps.enqueue(set(A));
  let called = 0;
  const out = await ps.flush({ alumnoId: "", send: async () => { called++; return {}; } });
  assert.equal(called, 0);
  assert.equal(out.skipped, true);
  assert.deepEqual(ps.list(""), []);
  assert.deepEqual(ps.list(null), []);
  assert.equal(ps.count(A), 1);
});

test("cambio de usuario: los ids de alumno se comparan como texto exacto (12 no es 120)", () => {
  const ps = makePS({ storage: memoryStorage() });
  ps.enqueue(set(12));
  ps.enqueue(set(120));
  assert.equal(ps.count("12"), 1);
  assert.equal(ps.count(120), 1);
});

test("cambio de usuario: un registro con alumno_id distinto al del flush no se envia aunque aparezca en la lista", async () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const a1 = ps.enqueue(set(A));
  const sent = [];
  // otra pestana "cambia de usuario": mientras se envia, se encola una serie de B
  const out = await ps.flush({
    alumnoId: A,
    send: async (p) => { sent.push(p.alumno_id); ps.enqueue(set(B)); return okRes(p); },
  });
  assert.deepEqual(sent, [A]);
  assert.deepEqual(out.confirmed, [a1.id]);
  assert.equal(ps.count(B), 1);
});

// ══ SERIES IDENTICAS ═══════════════════════════════════════════════════════
test("series identicas: tres items con UUID distinto y se confirman por separado", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const s1 = ps.enqueue(set(A));
  const s2 = ps.enqueue(set(A));
  const s3 = ps.enqueue(set(A));
  assert.equal(new Set([s1.id, s2.id, s3.id]).size, 3);
  const p1 = buildPendingPayload(s1);
  const p2 = buildPendingPayload(s2);
  assert.deepEqual({ ...p1, id: 0 }, { ...p2, id: 0 }); // mismo contenido, distinta identidad
  assert.equal(ps.confirm([s2.id]), 1);
  assert.deepEqual(ps.list(A).map((i) => i.id).sort(), [s1.id, s3.id].sort());
});

test("series identicas: un flush parcial confirma solo las que el servidor confirmo", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const s1 = ps.enqueue(set(A));
  const s2 = ps.enqueue(set(A));
  const order = ps.list(A).map((i) => i.id);
  const out = await ps.flush({
    alumnoId: A,
    send: async (p) => (p.id === order[0] ? okRes(p) : { status: 500 }),
  });
  assert.deepEqual(out.confirmed, [order[0]]);
  assert.deepEqual(out.retry, [order[1]]);
  assert.equal(ps.count(A), 1);
  assert.ok([s1.id, s2.id].includes(order[1]));
});

// ══ RESPUESTA AMBIGUA Y VERIFICACION DE 409 ═════════════════════════════════
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

test("respuesta ambigua: el servidor guarda y se pierde la respuesta -> el reintento (mismo id) da 409, se verifica y queda UNA fila", async () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const server = fakeServer();
  const item = ps.enqueue(set(A));
  server.mode = "lost";
  let out = await ps.flush({ alumnoId: A, send: server.send, fetchRow: server.fetchRow });
  assert.deepEqual(out.retry, [item.id]);
  assert.equal(ps.count(A), 1);
  assert.equal(server.rows.size, 1); // el servidor SI la tenia
  server.mode = null;
  out = await ps.flush({ alumnoId: A, send: server.send, fetchRow: server.fetchRow });
  assert.deepEqual(out.confirmed, [item.id]);
  assert.equal(ps.count(A), 0);
  assert.equal(server.rows.size, 1);
  assert.deepEqual(server.posts, [item.id, item.id]); // siempre el mismo UUID
});

test("respuesta ambigua: timeout / excepcion / null se conservan para reintento", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const item = ps.enqueue(set(A));
  let out = await ps.flush({ alumnoId: A, send: async () => null });
  assert.deepEqual(out.retry, [item.id]);
  out = await ps.flush({ alumnoId: A, send: async () => { throw new Error("timeout"); } });
  assert.deepEqual(out.retry, [item.id]);
  const got = ps.list(A)[0];
  assert.equal(got.attempts, 2);
  assert.equal(got.lastError, "timeout");
});

test("respuesta ambigua: 2xx con fila de otro id no confirma", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const item = ps.enqueue(set(A));
  const out = await ps.flush({ alumnoId: A, send: async () => ({ status: 201, body: [{ id: generateSetId() }] }) });
  assert.deepEqual(out.confirmed, []);
  assert.deepEqual(out.retry, [item.id]);
  assert.equal(ps.count(A), 1);
});

test("409: sin fetchRow, con error, con fila ausente o con respuesta rara NO confirma (reintenta)", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const item = ps.enqueue(set(A));
  const dup = async () => ({ status: 409 });
  for (const fetchRow of [undefined, async () => { throw new Error("net"); }, async () => null, async () => [], async () => ({ error: "x" }), async () => [{ id: generateSetId() }]]) {
    const out = await ps.flush({ alumnoId: A, send: dup, fetchRow });
    assert.deepEqual(out.confirmed, [], String(fetchRow));
    assert.equal(out.conflicts.length === 1 || out.retry.length === 1, true);
    if (out.conflicts.length) { // la fila ajena bajo OTRO id no es un conflicto de este item: se trata como ausente
      assert.fail("no deberia ser conflicto: " + String(fetchRow));
    }
  }
  assert.equal(ps.count(A), 1);
  assert.equal(ps.list(A)[0].status, PENDING_STATUS.PENDING);
  assert.equal(item.alumno_id, A);
});

test("409: confirma SOLO si coinciden id, alumno_id, ejercicio_id, kg, reps, fecha y semana", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const item = ps.enqueue(set(A, { exId: "bp", kg: 60, reps: 10, date: "9/10/2026", semana: 0 }));
  const payload = buildPendingPayload(item);
  const dup = async () => ({ status: 409 });
  // variantes que SI coinciden (tipos distintos pero mismo valor)
  const matching = [
    { ...payload },
    { ...payload, kg: "60.00", reps: "10", semana: "0" },
    { ...payload, alumno_id: A.toUpperCase() },
    { ...payload, nota: "otra nota" }, // la nota no se compara
    { ...payload, extra: "ignorado" },
  ];
  for (const row of matching) {
    const ps2 = makePS({ storage: memoryStorage() });
    const it = ps2.enqueue(set(A, { exId: "bp", kg: 60, reps: 10, date: "9/10/2026", semana: 0 }));
    const out = await ps2.flush({ alumnoId: A, send: dup, fetchRow: async () => [{ ...row, id: it.id }] });
    assert.deepEqual(out.confirmed, [it.id], JSON.stringify(row));
    assert.equal(ps2.count(A), 0);
  }
  assert.ok(payload);
});

test("409: si UNO de los campos difiere, la serie NO se confirma, queda en CONFLICT y no se reintenta", async () => {
  const base = { exId: "bp", kg: 60, reps: 10, date: "9/10/2026", semana: 0 };
  const mutations = {
    alumno_id: { alumno_id: B },
    ejercicio_id: { ejercicio_id: "sq" },
    kg: { kg: 62.5 },
    reps: { reps: 9 },
    fecha: { fecha: "10/10/2026" },
    "fecha con otro formato": { fecha: "09/10/2026" },
    semana: { semana: 1 },
    "semana vacia": { semana: null },
  };
  for (const [name, change] of Object.entries(mutations)) {
    const ps = makePS({ storage: memoryStorage() });
    const it = ps.enqueue(set(A, base));
    const row = { ...buildPendingPayload(it), ...change };
    let sends = 0;
    const out = await ps.flush({ alumnoId: A, send: async () => { sends++; return { status: 409 }; }, fetchRow: async () => [row] });
    assert.deepEqual(out.confirmed, [], name);
    assert.deepEqual(out.conflicts, [it.id], name);
    assert.equal(ps.count(A), 1, name); // conservada
    assert.equal(ps.list(A)[0].status, PENDING_STATUS.CONFLICT, name);
    assert.equal(ps.listRetryable(A, { includeAuthError: true }).length, 0, name);
    const again = await ps.flush({ alumnoId: A, includeAuthError: true, send: async () => { sends++; return {}; }, fetchRow: async () => [row] });
    assert.deepEqual(again.conflicts, [], name);
    assert.equal(sends, 1, name); // no se reenvia
  }
});

test("409: dos filas con el mismo id, o una fila sin id, no confirman", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const it = ps.enqueue(set(A));
  const p = buildPendingPayload(it);
  let out = await ps.flush({ alumnoId: A, send: async () => ({ status: 409 }), fetchRow: async () => [{ ...p }, { ...p }] });
  assert.deepEqual(out.conflicts, [it.id]);
  const ps2 = makePS({ storage: memoryStorage() });
  const it2 = ps2.enqueue(set(A));
  const { id, ...noId } = buildPendingPayload(it2);
  out = await ps2.flush({ alumnoId: A, send: async () => ({ status: 409 }), fetchRow: async () => [noId] });
  assert.deepEqual(out.confirmed, []);
  assert.equal(ps2.count(A), 1);
  assert.ok(id);
});

test("rowMatchesPayload: comparacion campo a campo", () => {
  const id = generateSetId();
  const p = { id, alumno_id: A, ejercicio_id: "bp", kg: 60, reps: 10, fecha: "9/10/2026", semana: 0, nota: "" };
  assert.equal(rowMatchesPayload({ ...p }, p), true);
  assert.equal(rowMatchesPayload({ ...p, kg: "60.0" }, p), true);
  assert.equal(rowMatchesPayload({ ...p, semana: undefined }, { ...p, semana: null }), true);
  assert.equal(rowMatchesPayload({ ...p, semana: 0 }, { ...p, semana: undefined }), false);
  assert.equal(rowMatchesPayload({ ...p, kg: "abc" }, p), false);
  assert.equal(rowMatchesPayload({ ...p, ejercicio_id: "BP" }, p), false);
  assert.equal(rowMatchesPayload({ ...p, id: generateSetId() }, p), false);
  assert.equal(rowMatchesPayload(null, p), false);
  assert.equal(rowMatchesPayload({ ...p }, null), false);
  assert.equal(rowMatchesPayload({ ...p, alumno_id: "" }, { ...p, alumno_id: "" }), false);
});

test("errores HTTP: 401/403 conserva y corta; 400/422 rechaza sin reintento; 5xx reintenta", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const s1 = ps.enqueue(set(A, { exId: "e1" }));
  const s2 = ps.enqueue(set(A, { exId: "e2" }));
  const [first, second] = ps.list(A).map((i) => i.id);
  let calls = 0;
  let out = await ps.flush({ alumnoId: A, send: async () => { calls++; return { status: 401 }; } });
  assert.equal(calls, 1);
  assert.equal(out.stopped, FLUSH_STOP.AUTH);
  assert.deepEqual(out.authError, [first]);
  assert.equal(ps.count(A), 2);
  assert.equal(ps.list(A).find((i) => i.id === first).status, PENDING_STATUS.AUTH_ERROR);
  calls = 0;
  out = await ps.flush({ alumnoId: A, send: async (p) => { calls++; return okRes(p); } });
  assert.equal(calls, 1); // solo el pending
  assert.deepEqual(out.confirmed, [second]);
  out = await ps.flush({ alumnoId: A, includeAuthError: true, send: async (p) => okRes(p) });
  assert.deepEqual(out.confirmed, [first]);
  assert.equal(ps.count(A), 0);

  const s3 = ps.enqueue(set(A));
  out = await ps.flush({ alumnoId: A, send: async () => ({ status: 422 }) });
  assert.deepEqual(out.rejected, [s3.id]);
  assert.equal(ps.list(A)[0].status, PENDING_STATUS.REJECTED);
  calls = 0;
  await ps.flush({ alumnoId: A, includeAuthError: true, send: async () => { calls++; return {}; } });
  assert.equal(calls, 0);
  assert.equal(ps.count(A), 1);

  const s4 = ps.enqueue(set(A));
  out = await ps.flush({ alumnoId: A, send: async () => ({ status: 500 }) });
  assert.deepEqual(out.retry, [s4.id]);
  assert.equal(ps.list(A).find((i) => i.id === s4.id).status, PENDING_STATUS.PENDING);
  assert.ok(s1 && s2);
});

// ══ CONCURRENCIA ═══════════════════════════════════════════════════════════
test("web locks: dos flush simultaneos (dos pestanas) -> uno envia, el otro queda 'locked'", async () => {
  const storage = memoryStorage();
  const locks = fakeLocks();
  const tab1 = makePS({ storage, locks });
  const tab2 = makePS({ storage, locks });
  const item = tab1.enqueue(set(A));
  const gate = deferred();
  const sent = [];
  const f1 = tab1.flush({ alumnoId: A, send: async (p) => { sent.push(p.id); await gate.promise; return okRes(p); } });
  const r2 = await tab2.flush({ alumnoId: A, send: async (p) => { sent.push("segundo:" + p.id); return okRes(p); } });
  assert.equal(r2.locked, true);
  assert.equal(r2.coordination, COORDINATION.WEB_LOCKS);
  gate.resolve();
  const r1 = await f1;
  assert.equal(r1.coordination, COORDINATION.WEB_LOCKS);
  assert.deepEqual(r1.confirmed, [item.id]);
  assert.deepEqual(sent, [item.id]);
  assert.equal(locks.held.size, 0); // liberado
});

test("web locks: se libera aunque send lance, y la serie queda para reintento", async () => {
  const locks = fakeLocks();
  const ps = makePS({ storage: memoryStorage(), locks });
  ps.enqueue(set(A));
  await ps.flush({ alumnoId: A, send: async () => { throw new Error("boom"); } });
  assert.equal(locks.held.size, 0);
  assert.equal(ps.count(A), 1);
});

test("web locks: el lock es por alumno (A y B pueden sincronizar a la vez)", async () => {
  const locks = fakeLocks();
  const ps = makePS({ storage: memoryStorage(), locks });
  ps.enqueue(set(A));
  ps.enqueue(set(B));
  const gate = deferred();
  const fa = ps.flush({ alumnoId: A, send: async (p) => { await gate.promise; return okRes(p); } });
  const fb = await ps.flush({ alumnoId: B, send: async (p) => okRes(p) });
  assert.equal(fb.locked, false);
  assert.equal(fb.confirmed.length, 1);
  gate.resolve();
  assert.equal((await fa).confirmed.length, 1);
});

test("web locks: si request RECHAZA antes de empezar, NO se degrada: no se envia nada y la serie queda intacta", async () => {
  const storage = memoryStorage();
  const locks = { request: async () => { throw new Error("SecurityError: lock denegado"); } };
  const ps = createPendingSets({ storage, locks, advisoryFallback: true }); // aun permitiendo el modo consultivo
  const item = ps.enqueue(set(A));
  const snapshot = JSON.stringify([...storage._map.entries()]);
  let sends = 0;
  const out = await ps.flush({ alumnoId: A, send: async (p) => { sends++; return okRes(p); } });
  assert.equal(sends, 0);
  assert.equal(out.stopped, FLUSH_STOP.LOCK_ERROR);
  assert.match(out.lockError, /SecurityError/);
  assert.equal(out.coordination, COORDINATION.WEB_LOCKS);
  assert.equal(out.locked, false);
  assert.deepEqual(out.confirmed.concat(out.retry, out.rejected, out.authError), []);
  assert.equal(JSON.stringify([...storage._map.entries()]), snapshot); // ni lease ni meta ni nada escrito
  assert.equal(keysOf(storage, "it_pending_sync:lease:").length, 0);
  assert.deepEqual(ps.list(A).map((i) => [i.id, i.status, i.attempts]), [[item.id, PENDING_STATUS.PENDING, 0]]);
});

test("web locks: request que LANZA de forma sincrona o rechaza sin mensaje tambien detiene y conserva", async () => {
  for (const request of [
    () => { throw new Error("sync boom"); },
    () => Promise.reject({ name: "InvalidStateError" }),
    () => Promise.reject("texto"),
  ]) {
    const ps = createPendingSets({ storage: memoryStorage(), locks: { request } });
    ps.enqueue(set(A));
    let sends = 0;
    const out = await ps.flush({ alumnoId: A, send: async (p) => { sends++; return okRes(p); } });
    assert.equal(sends, 0);
    assert.equal(out.stopped, FLUSH_STOP.LOCK_ERROR);
    assert.equal(typeof out.lockError, "string");
    assert.equal(ps.count(A), 1);
  }
});

test("web locks: tras un fallo de lock, cuando Web Locks vuelve a funcionar las series se envian normalmente", async () => {
  const storage = memoryStorage();
  let broken = true;
  const good = fakeLocks();
  const locks = { request: (n, o, cb) => (broken ? Promise.reject(new Error("transitorio")) : good.request(n, o, cb)) };
  const ps = createPendingSets({ storage, locks });
  const item = ps.enqueue(set(A));
  assert.equal((await ps.flush({ alumnoId: A, send: async (p) => okRes(p) })).stopped, FLUSH_STOP.LOCK_ERROR);
  broken = false;
  const out = await ps.flush({ alumnoId: A, send: async (p) => okRes(p) });
  assert.deepEqual(out.confirmed, [item.id]);
  assert.equal(out.stopped, FLUSH_STOP.NONE);
});

test("web locks: un error DENTRO del flush no se confunde con un fallo del lock", async () => {
  const locks = fakeLocks();
  const ps = createPendingSets({ storage: memoryStorage(), locks });
  ps.enqueue(set(A));
  const out = await ps.flush({ alumnoId: A, send: async () => { throw new Error("x"); } });
  assert.equal(out.coordination, COORDINATION.WEB_LOCKS);
  assert.equal(out.stopped, FLUSH_STOP.NONE);
  assert.equal(out.lockError, null);
  assert.equal(out.retry.length, 1);
});

test("web locks: migrate con un lock que falla no migra nada y deja el array viejo intacto", async () => {
  const raw = JSON.stringify([LEGACY_1, LEGACY_2]);
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: raw });
  const ps = createPendingSets({ storage, locks: { request: async () => { throw new Error("denegado"); } } });
  const r = await ps.migrate();
  assert.equal(r.skipped, true);
  assert.match(r.lockError, /denegado/);
  assert.equal(r.coordination, COORDINATION.WEB_LOCKS);
  assert.equal(storage.getItem(PENDING_LEGACY_KEY), raw);
  assert.equal(ps.listQuarantine().length, 0);
});

test("sin web locks: por defecto flush NO envia nada y lo informa (coordination = unavailable)", async () => {
  const storage = memoryStorage();
  const ps = createPendingSets({ storage, locks: null });
  const item = ps.enqueue(set(A));
  const snapshot = JSON.stringify([...storage._map.entries()]);
  let sends = 0;
  const out = await ps.flush({ alumnoId: A, send: async (p) => { sends++; return okRes(p); } });
  assert.equal(sends, 0);
  assert.equal(out.stopped, FLUSH_STOP.NO_WEB_LOCKS);
  assert.equal(out.coordination, COORDINATION.UNAVAILABLE);
  assert.equal(out.locked, false);
  assert.equal(JSON.stringify([...storage._map.entries()]), snapshot);
  assert.equal(ps.coordinationMode(), COORDINATION.UNAVAILABLE);
  assert.deepEqual(ps.list(A).map((i) => i.id), [item.id]);
});

test("sin web locks: con advisoryFallback explicito si envia y declara el modo 'advisory-lease'", async () => {
  const ps = createPendingSets({ storage: memoryStorage(), locks: null, advisoryFallback: true });
  const item = ps.enqueue(set(A));
  assert.equal(ps.coordinationMode(), COORDINATION.ADVISORY_LEASE);
  const out = await ps.flush({ alumnoId: A, send: async (p) => okRes(p) });
  assert.equal(out.coordination, COORDINATION.ADVISORY_LEASE);
  assert.deepEqual(out.confirmed, [item.id]);
});

test("sin web locks: migrate (solo almacenamiento local) funciona y declara el modo usado", async () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([LEGACY_1]) });
  const ps = createPendingSets({ storage, locks: null });
  const r = await ps.migrate();
  assert.equal(r.quarantined, 1);
  assert.equal(r.coordination, COORDINATION.ADVISORY_LEASE);
});

test("web locks: se detecta navigator.locks automaticamente; sin el, el modo es 'unavailable' salvo advisoryFallback", async () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const locks = fakeLocks();
  Object.defineProperty(globalThis, "navigator", { value: { locks }, configurable: true, writable: true });
  try {
    assert.equal(createPendingSets({ storage: memoryStorage() }).coordinationMode(), COORDINATION.WEB_LOCKS);
    assert.equal(createPendingSets({ storage: memoryStorage(), locks: null }).coordinationMode(), COORDINATION.UNAVAILABLE);
    assert.equal(createPendingSets({ storage: memoryStorage(), locks: null, advisoryFallback: true }).coordinationMode(), COORDINATION.ADVISORY_LEASE);
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true, writable: true });
    assert.equal(createPendingSets({ storage: memoryStorage() }).coordinationMode(), COORDINATION.UNAVAILABLE);
    assert.equal(createPendingSets({ storage: memoryStorage(), advisoryFallback: true }).coordinationMode(), COORDINATION.ADVISORY_LEASE);
  } finally {
    if (desc) Object.defineProperty(globalThis, "navigator", desc);
    else delete globalThis.navigator;
  }
});

test("migrateSync: variante sincrona sin lock, equivalente e idempotente", () => {
  const storage = memoryStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([LEGACY_1, LEGACY_1]) });
  const ps = createPendingSets({ storage });
  const r = ps.migrateSync();
  assert.equal(r.quarantined, 2);
  assert.equal(r.coordination, "none");
  assert.equal(storage.getItem(PENDING_LEGACY_KEY), null);
  assert.equal(ps.listQuarantine().length, 2);
  const snap = JSON.stringify([...storage._map.entries()]);
  assert.equal(ps.migrateSync().quarantined, 0);
  assert.equal(JSON.stringify([...storage._map.entries()]), snap);
});

test("sin web locks: lease consultivo evita el solapamiento normal (no promete exclusion mutua)", async () => {
  const storage = memoryStorage();
  const tab1 = makePS({ storage, locks: null, advisoryFallback: true });
  const tab2 = makePS({ storage, locks: null, advisoryFallback: true });
  const item = tab1.enqueue(set(A));
  const gate = deferred();
  const sent = [];
  const f1 = tab1.flush({ alumnoId: A, send: async (p) => { sent.push(p.id); await gate.promise; return okRes(p); } });
  const r2 = await tab2.flush({ alumnoId: A, send: async (p) => { sent.push("segundo"); return okRes(p); } });
  assert.equal(r2.locked, true);
  assert.equal(r2.coordination, COORDINATION.ADVISORY_LEASE);
  gate.resolve();
  assert.deepEqual((await f1).confirmed, [item.id]);
  assert.deepEqual(sent, [item.id]);
  assert.equal(keysOf(storage, "it_pending_sync:lease:").length, 0);
});

test("sin web locks: aun si DOS pestanas enviaran a la vez (lease burlado), el servidor no duplica y ambas convergen", async () => {
  // Se simula la ventana que el lease consultivo no puede cerrar: la pestana 2 ve su propio lease concedido.
  const storage = memoryStorage();
  const tab1 = makePS({ storage, locks: null, advisoryFallback: true });
  const tab2 = makePS({ storage, locks: null, advisoryFallback: true });
  const server = fakeServer();
  const item = tab1.enqueue(set(A));
  const gate = deferred();
  const slowSend = async (p) => { await gate.promise; return server.send(p); };
  const f1 = tab1.flush({ alumnoId: A, send: slowSend, fetchRow: server.fetchRow });
  storage._map.delete(leaseKey(flushLease(A))); // el navegador no nos dio exclusion: el lease "desaparece"
  const f2 = tab2.flush({ alumnoId: A, send: slowSend, fetchRow: server.fetchRow });
  gate.resolve();
  await Promise.all([f1, f2]);
  assert.deepEqual(server.posts, [item.id, item.id]); // la carrera SI ocurrio: dos POST del mismo id
  assert.equal(server.rows.size, 1); // la clave primaria hizo su trabajo
  assert.equal(tab1.count(A), 0);
  assert.equal(tab2.count(A), 0);
  assert.equal(item.alumno_id, A);
});

test("sin web locks: un lease vencido se puede tomar; el viejo dueno no puede renovar ni liberar", () => {
  const storage = memoryStorage();
  const t = clock();
  const ps = makePS({ storage, locks: null, advisoryFallback: true, now: t, leaseMs: 1000 });
  const name = flushLease(A);
  assert.equal(ps.acquireLease(name, "dueno-viejo"), true);
  assert.equal(ps.acquireLease(name, "otro"), false);
  t.advance(1500);
  assert.equal(ps.acquireLease(name, "dueno-nuevo"), true);
  assert.equal(ps.renewLease(name, "dueno-viejo"), false);
  ps.releaseLease(name, "dueno-viejo");
  assert.equal(ps.acquireLease(name, "tercero"), false);
  ps.releaseLease(name, "dueno-nuevo");
  assert.equal(ps.acquireLease(name, "tercero"), true);
});

test("sin web locks: si se pierde el lease durante el envio no se escribe el resultado (la serie sigue intacta)", async () => {
  const storage = memoryStorage();
  const t = clock();
  const ps = makePS({ storage, locks: null, advisoryFallback: true, now: t, leaseMs: 1000 });
  const item = ps.enqueue(set(A));
  const out = await ps.flush({
    alumnoId: A,
    send: async (p) => {
      t.advance(5000);
      assert.equal(ps.acquireLease(flushLease(A), "intruso"), true);
      return okRes(p);
    },
  });
  assert.equal(out.stopped, FLUSH_STOP.LOST_LEASE);
  assert.deepEqual(out.confirmed, []);
  assert.deepEqual(ps.list(A).map((i) => i.id), [item.id]);
  assert.equal(ps.list(A)[0].attempts, 0);
  assert.equal(ps.acquireLease(flushLease(A), "otro"), false); // el intruso conserva su lease
});

test("escrituras: una serie encolada DURANTE un flush no se pierde", async () => {
  const ps = makePS({ storage: memoryStorage() });
  const s1 = ps.enqueue(set(A, { exId: "e1" }));
  const gate = deferred();
  const f = ps.flush({ alumnoId: A, send: async (p) => { await gate.promise; return okRes(p); } });
  const s2 = ps.enqueue(set(A, { exId: "e2" }));
  const s3 = ps.enqueue(set(A, { exId: "e3" }));
  gate.resolve();
  const out = await f;
  assert.ok(out.confirmed.includes(s1.id));
  const left = ps.list(A).map((i) => i.id);
  assert.ok(left.includes(s2.id) && left.includes(s3.id));
  assert.ok(!left.includes(s1.id));
});

test("escrituras: confirm / markAttempt sobre una serie ya quitada son no-op y no la resucitan", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const item = ps.enqueue(set(A));
  assert.equal(ps.confirm([item.id]), 1);
  assert.equal(ps.confirm([item.id]), 0);
  assert.equal(ps.markAttempt(item.id, { status: PENDING_STATUS.REJECTED, error: "x" }), false);
  assert.equal(ps.count(A), 0);
  assert.equal(keysOf(storage, "it_pending_sync").length, 0);
});

test("escrituras intercaladas: otra pestana confirma la serie ENTRE la lectura y la escritura de markAttempt", () => {
  const storage = memoryStorage();
  const tab1 = makePS({ storage });
  const tab2 = makePS({ storage });
  const item = tab1.enqueue(set(A));
  let fired = false;
  storage.hooks.before = (op, key) => {
    if (!fired && op === "set" && key === META + item.id) { fired = true; tab2.confirm([item.id]); }
  };
  const result = tab1.markAttempt(item.id, { status: PENDING_STATUS.PENDING, error: "http_500" });
  storage.hooks.before = null;
  assert.equal(result, false);
  assert.equal(tab1.count(A), 0); // NO resucito
  assert.equal(keysOf(storage, "it_pending_sync").length, 0); // y no dejo basura
});

test("escrituras intercaladas: enqueue de otra pestana en medio de un confirm no se pierde", () => {
  const storage = memoryStorage();
  const tab1 = makePS({ storage });
  const tab2 = makePS({ storage });
  const a = tab1.enqueue(set(A, { exId: "a" }));
  const b = tab1.enqueue(set(A, { exId: "b" }));
  let created = null;
  storage.hooks.after = (op, key) => {
    if (!created && op === "remove" && key === ITEM + a.id) created = tab2.enqueue(set(A, { exId: "nuevo" }));
  };
  assert.equal(tab1.confirm([a.id, b.id]), 2);
  storage.hooks.after = null;
  assert.deepEqual(tab1.list(A).map((i) => i.id), [created.id]);
});

test("escrituras intercaladas: dos markAttempt desde pestanas distintas no tocan el registro de la serie", () => {
  const storage = memoryStorage();
  const tab1 = makePS({ storage });
  const tab2 = makePS({ storage });
  const item = tab1.enqueue(set(A, { kg: 77 }));
  const recordBefore = storage.getItem(ITEM + item.id);
  let fired = false;
  storage.hooks.before = (op, key) => {
    if (!fired && op === "set" && key === META + item.id) { fired = true; tab2.markAttempt(item.id, { status: PENDING_STATUS.PENDING, error: "desde-tab2" }); }
  };
  tab1.markAttempt(item.id, { status: PENDING_STATUS.PENDING, error: "desde-tab1" });
  storage.hooks.before = null;
  assert.equal(storage.getItem(ITEM + item.id), recordBefore); // inmutable
  const got = tab1.list(A)[0];
  assert.equal(got.kg, 77);
  assert.equal(got.status, PENDING_STATUS.PENDING);
  assert.ok(got.attempts >= 1); // ultimo-escritor-gana en el estado, sin afectar la serie
});

test("escrituras: confirm solo borra por UUID; ids vacios / invalidos / desconocidos no tocan nada", () => {
  const ps = makePS({ storage: memoryStorage() });
  const a = ps.enqueue(set(A));
  const b = ps.enqueue(set(B));
  assert.equal(ps.confirm([]), 0);
  assert.equal(ps.confirm(null), 0);
  assert.equal(ps.confirm(["", null, undefined, "no-existe", 42, generateSetId()]), 0);
  assert.equal(ps.count(A), 1);
  assert.equal(ps.count(B), 1);
  assert.equal(ps.confirm([a.id]), 1);
  assert.equal(ps.count(B), 1);
  assert.equal(b.alumno_id, B);
});

test("escrituras: sweepOrphans borra 'meta' sin serie y respeta el de series vivas", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const live = ps.enqueue(set(A));
  ps.markAttempt(live.id, { status: PENDING_STATUS.PENDING, error: "x" });
  const orphan = generateSetId();
  storage._map.set(META + orphan, JSON.stringify({ status: "pending", attempts: 3 }));
  assert.equal(ps.sweepOrphans(), 1);
  assert.equal(storage.getItem(META + orphan), null);
  assert.ok(storage.getItem(META + live.id));
});

test("fallo parcial: confirm con un removeItem que falla -> lanza, procesa el resto y la serie fallida sigue en cola", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const a = ps.enqueue(set(A, { exId: "a" }));
  const b = ps.enqueue(set(A, { exId: "b" }));
  storage.hooks.before = (op, key) => { if (op === "remove" && key === ITEM + a.id) throw new Error("boom"); };
  assert.throws(() => ps.confirm([a.id, b.id]), (e) => e.code === "STORAGE_REMOVE_FAILED" && e.removed === 1 && e.failed[0] === a.id);
  storage.hooks.before = null;
  assert.deepEqual(ps.list(A).map((i) => i.id), [a.id]);
});

test("fallo parcial: markAttempt cuyo setItem falla lanza y deja la serie intacta", () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const item = ps.enqueue(set(A));
  storage.hooks.before = (op, key) => { if (op === "set" && key === META + item.id) throw new Error("quota"); };
  assert.throws(() => ps.markAttempt(item.id, { error: "x" }), /quota/);
  storage.hooks.before = null;
  assert.equal(ps.count(A), 1);
  assert.equal(ps.list(A)[0].attempts, 0);
});

test("fallo parcial: si no se puede registrar el resultado, flush se detiene (storage_error) sin perder la serie", async () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const item = ps.enqueue(set(A));
  storage.hooks.before = (op, key) => { if (op === "set" && key === META + item.id) throw new Error("quota"); };
  const out = await ps.flush({ alumnoId: A, send: async () => ({ status: 500 }) });
  storage.hooks.before = null;
  assert.equal(out.stopped, FLUSH_STOP.STORAGE);
  assert.match(out.storageError, /quota/);
  assert.equal(ps.count(A), 1);
  assert.equal(item.alumno_id, A);
});

test("fallo parcial: el servidor guardo, el POST se confirmo pero no se pudo quitar de la cola -> el siguiente flush converge sin duplicar", async () => {
  const storage = memoryStorage();
  const ps = makePS({ storage });
  const server = fakeServer();
  const item = ps.enqueue(set(A));
  storage.hooks.before = (op, key) => { if (op === "remove" && key === ITEM + item.id) throw new Error("boom"); };
  let out = await ps.flush({ alumnoId: A, send: server.send, fetchRow: server.fetchRow });
  storage.hooks.before = null;
  assert.equal(out.stopped, FLUSH_STOP.STORAGE);
  assert.equal(ps.count(A), 1); // sigue en cola
  assert.equal(server.rows.size, 1);
  out = await ps.flush({ alumnoId: A, send: server.send, fetchRow: server.fetchRow });
  assert.deepEqual(out.confirmed, [item.id]); // 409 + fila coincidente
  assert.equal(ps.count(A), 0);
  assert.equal(server.rows.size, 1);
});

test("otra pestana confirma la serie mientras esta enviaba otra -> no se reenvia ni se pisa", async () => {
  const storage = memoryStorage();
  const tab1 = makePS({ storage });
  const tab2 = makePS({ storage });
  tab1.enqueue(set(A, { exId: "e1" }));
  tab1.enqueue(set(A, { exId: "e2" }));
  const [first, second] = tab1.list(A).map((i) => i.id);
  const sent = [];
  const out = await tab1.flush({
    alumnoId: A,
    send: async (p) => {
      sent.push(p.id);
      if (p.id === first) tab2.confirm([second]);
      return okRes(p);
    },
  });
  assert.deepEqual(sent, [first]);
  assert.deepEqual(out.confirmed, [first]);
  assert.equal(tab1.count(A), 0);
});

// ══ runner ═════════════════════════════════════════════════════════════════
for (const t of tests) {
  try {
    await t.fn();
    count++;
    console.log("ok - " + t.name);
  } catch (e) {
    failures.push({ name: t.name, error: e });
    console.log("not ok - " + t.name);
    console.log("  " + (e && e.stack ? e.stack.split("\n").slice(0, 5).join("\n  ") : e));
  }
}

console.log("\n" + count + "/" + tests.length + " pruebas OK");
if (failures.length) {
  console.log(failures.length + " fallaron");
  process.exit(1);
}
