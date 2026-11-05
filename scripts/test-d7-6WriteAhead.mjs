// D76-01 — write-ahead de series: la serie se persiste como pendiente (it_pq:<opId>) ANTES del POST y se retira solo con confirmacion.
//   node scripts/test-d7-6WriteAhead.mjs
// Datos ficticios, sin red: el "servidor" es una tabla en memoria.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { writeAheadPendingSet, sendWriteAheadSet, isSetSendInFlight, __resetInFlightForTests } from "../lib/setWriteAhead.js";
import { flushPendingForAlumno, removeAllPendingForAlumno, withFlushLock, readQueue, readAllPending, PENDING_SYNC_KEY } from "../lib/pendingSyncQueue.js";
import { PQ_ITEM_PREFIX, PQ_STATE_PREFIX, PQ_DONE_PREFIX } from "../lib/pendingQueueKeyed.js";
import { buildPendingProgressItem, buildProgressPayload } from "../lib/workoutSession.js";
import { postProgressIdempotent } from "../lib/progressInsert.js";

let n = 0;
let failed = 0;
const t = async (name, fn) => {
  try { __resetInFlightForTests(); await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.error("FAIL -", name); console.error(e); }
};
const store = (init) => {
  const m = new Map(Object.entries(init || {}));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => void m.delete(k),
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, _m: m,
  };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OP = (i) => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");
const mkItem = (alumno, opId, over) => {
  const o = Object.assign({ exId: "sq", kg: 60, reps: 8, note: "", date: "12/10/2026", semana: 1, ciclo: 1 }, over || {});
  return buildPendingProgressItem(o.exId, o.kg, o.reps, o.note, o.date, o.semana, o.ciclo, alumno, opId);
};
// Mismo payload que arma App.jsx en el flush (flushPendingSync) a partir del elemento en cola.
const payloadFromItem = (alumnoId, item) => buildProgressPayload(alumnoId, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId);
const keyed = (s, opId) => s.getItem(PQ_ITEM_PREFIX + opId);

// Servidor falso: insercion por id (409/23505 sobre progreso_pkey si ya existe) y lectura por id. Mismo contrato que sbRequestStatus.
const fakeServer = (opts) => {
  const rows = new Map();
  const posts = [];
  const o = opts || {};
  return {
    rows, posts,
    io: {
      post: async (payload) => {
        posts.push(payload);
        if (o.beforePost) await o.beforePost(payload, posts.length);
        if (rows.has(payload.id)) return { ok: false, status: 409, data: { code: "23505", details: "Key (id)=(" + payload.id + ") already exists.", message: 'duplicate key value violates unique constraint "progreso_pkey"' } };
        const row = Object.assign({}, payload);
        rows.set(payload.id, row);
        if (o.loseResponse && o.loseResponse(posts.length)) throw new Error("respuesta perdida");
        return { ok: true, status: 201, data: [row] };
      },
      getById: async (id) => ({ ok: true, status: 200, data: rows.has(id) ? [rows.get(id)] : [] }),
    },
  };
};

// a. guardado exitoso
await t("a. el pendiente existe en storage al invocar send(); tras confirmar se retira con marca it_pqd", async () => {
  const s = store();
  const op = OP(1);
  const item = mkItem("a1", op, { ciclo: 2, semana: 3, date: "5/11/2026", kg: 82.5, reps: 5 });
  assert.deepEqual(writeAheadPendingSet(s, item, 1000), { ok: true });
  let seen = null;
  const res = await sendWriteAheadSet({
    storage: s, opId: op, now: () => 2000,
    send: async () => { seen = JSON.parse(keyed(s, op)); assert.ok(isSetSendInFlight(op)); return [{ id: op }]; },
  });
  assert.deepEqual(res, { confirmed: true });
  for (const f of ["alumno_id", "exId", "kg", "reps", "date", "semana", "ciclo", "opId"]) assert.ok(seen && seen[f] !== undefined, "falta " + f);
  assert.equal(seen.alumno_id, "a1"); assert.equal(seen.opId, op); assert.equal(seen.semana, 3); assert.equal(seen.ciclo, 2); assert.equal(seen.date, "5/11/2026");
  assert.equal(seen.createdAt, 1000);
  assert.equal(keyed(s, op), null);
  assert.ok(s.getItem(PQ_DONE_PREFIX + op) != null);
  assert.equal(isSetSendInFlight(op), false);
});

// b. error HTTP
await t("b. error HTTP (send -> null): queda pendiente con el MISMO opId", async () => {
  const s = store(); const op = OP(2);
  writeAheadPendingSet(s, mkItem("a1", op), 1);
  const before = keyed(s, op);
  const res = await sendWriteAheadSet({ storage: s, opId: op, send: async () => null });
  assert.equal(res.confirmed, false); assert.equal(res.reason, "unconfirmed");
  assert.equal(keyed(s, op), before);
  assert.equal(s.getItem(PQ_DONE_PREFIX + op), null);
  assert.deepEqual(readAllPending(s).items.map((i) => i.opId), [op]);
});

// c. timeout
await t("c. timeout (send no resuelve): queda pendiente", async () => {
  const s = store(); const op = OP(3);
  writeAheadPendingSet(s, mkItem("a1", op), 1);
  const res = await sendWriteAheadSet({ storage: s, opId: op, timeoutMs: 20, send: () => new Promise(() => {}) });
  assert.deepEqual(res, { confirmed: false, reason: "timeout" });
  assert.ok(keyed(s, op) != null); assert.equal(s.getItem(PQ_DONE_PREFIX + op), null);
  assert.equal(isSetSendInFlight(op), false);
});

// d. respuesta desconocida
await t("d. respuesta desconocida (lanza, [], objeto, undefined): queda pendiente", async () => {
  const sends = [async () => { throw new Error("net"); }, () => { throw new Error("sync"); }, async () => [], async () => ({ id: 1 }), async () => undefined, async () => [null]];
  for (let i = 0; i < sends.length; i++) {
    const s = store(); const op = OP(40 + i);
    writeAheadPendingSet(s, mkItem("a1", op), 1);
    const res = await sendWriteAheadSet({ storage: s, opId: op, send: sends[i] });
    assert.equal(res.confirmed, false, "caso " + i);
    assert.ok(keyed(s, op) != null, "caso " + i);
    assert.equal(s.getItem(PQ_DONE_PREFIX + op), null, "caso " + i);
  }
});

// e. cierre inmediato
await t("e. cierre justo despues de persistir (send nunca se llama): la recarga lo envia con el payload de App y lo retira", async () => {
  const s = store(); const op = OP(5);
  const item = mkItem("a1", op, { ciclo: 2, semana: 3, date: "5/11/2026" });
  writeAheadPendingSet(s, item, 1);
  __resetInFlightForTests();                       // la pestaña murio
  const sent = [];
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "a1", isInFlight: isSetSendInFlight, send: async (it) => { const p = payloadFromItem("a1", it); sent.push(p); return [p]; } });
  assert.deepEqual(r, { sent: 1, failed: 0 });
  assert.deepEqual(sent, [buildProgressPayload("a1", "sq", 60, 8, "", "5/11/2026", 3, 2, op)]);
  assert.equal(keyed(s, op), null); assert.ok(s.getItem(PQ_DONE_PREFIX + op) != null);
  assert.equal(readAllPending(s).items.length, 0);
});

// f. recarga antes de la respuesta
await t("f. recarga antes de la respuesta: el flush reenvia el mismo id, el servidor responde 23505 y queda 1 sola fila", async () => {
  const s = store(); const op = OP(6);
  const item = mkItem("a1", op);
  writeAheadPendingSet(s, item, 1);
  let release;
  const gate = new Promise((r) => { release = r; });
  const srv = fakeServer({ beforePost: async (_p, nth) => { if (nth === 1) await gate; } });
  // Primer intento (pestaña A): el servidor inserta... pero la respuesta no llega antes de la recarga.
  const first = sendWriteAheadSet({ storage: s, opId: op, timeoutMs: 30, send: () => postProgressIdempotent(srv.io, payloadFromItem("a1", item)) });
  const firstRes = await first;                    // la pestaña A agota su espera sin confirmar
  assert.equal(firstRes.confirmed, false);
  assert.ok(keyed(s, op) != null);
  release();                                       // el primer POST llega al servidor tarde (fila insertada)
  await sleep(5);
  assert.equal(srv.rows.size, 1);
  __resetInFlightForTests();                       // pestaña nueva tras la recarga
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "a1", isInFlight: isSetSendInFlight, send: (it) => postProgressIdempotent(srv.io, payloadFromItem("a1", it)) });
  assert.deepEqual(r, { sent: 1, failed: 0 });
  assert.equal(srv.rows.size, 1);
  assert.equal(srv.posts.length, 2);
  assert.ok(srv.posts.every((p) => p.id === op));
  assert.equal(keyed(s, op), null);
});

// g. reintentos con el mismo id
await t("g. varios flush fallidos y luego exitoso: todos los POST llevan payload.id = opId y el mismo payload", async () => {
  const s = store(); const op = OP(7);
  writeAheadPendingSet(s, mkItem("a1", op, { kg: 100, reps: 3 }), 1);
  const posts = [];
  let calls = 0;
  const send = async (it) => { const p = payloadFromItem("a1", it); posts.push(p); calls++; return calls < 4 ? null : [p]; };
  for (let i = 0; i < 3; i++) assert.deepEqual(await flushPendingForAlumno({ storage: s, alumnoId: "a1", send }), { sent: 0, failed: 1 });
  assert.ok(keyed(s, op) != null);
  assert.deepEqual(await flushPendingForAlumno({ storage: s, alumnoId: "a1", send }), { sent: 1, failed: 0 });
  assert.equal(posts.length, 4);
  posts.forEach((p) => { assert.equal(p.id, op); assert.deepEqual(p, posts[0]); });
  assert.equal(keyed(s, op), null);
});

// h. reintentos repetidos sin duplicacion
await t("h. 5 reintentos tras una respuesta perdida: 1 sola fila en el servidor", async () => {
  const s = store(); const op = OP(8);
  const item = mkItem("a1", op);
  writeAheadPendingSet(s, item, 1);
  const srv = fakeServer({ loseResponse: (nth) => nth === 1 });
  const res = await sendWriteAheadSet({ storage: s, opId: op, send: () => postProgressIdempotent(srv.io, payloadFromItem("a1", item)) });
  assert.equal(res.confirmed, false);               // fila insertada, respuesta perdida
  assert.equal(srv.rows.size, 1);
  for (let i = 0; i < 5; i++) {
    // se restaura el pendiente para forzar 5 reintentos reales (cada uno recibe 23505 y verifica la fila)
    if (keyed(s, op) == null) { s.removeItem(PQ_DONE_PREFIX + op); writeAheadPendingSet(s, item, 1); }
    await flushPendingForAlumno({ storage: s, alumnoId: "a1", send: (it) => postProgressIdempotent(srv.io, payloadFromItem("a1", it)) });
  }
  assert.equal(srv.posts.length, 6);
  assert.ok(srv.posts.every((p) => p.id === op));
  assert.equal(srv.rows.size, 1);
  assert.equal(keyed(s, op), null);
});

// i. storage inaccesible
await t("i. localStorage inaccesible (SecurityError) o null: storage_unavailable, sin lanzar", async () => {
  const sec = () => { const e = new Error("denied"); e.name = "SecurityError"; throw e; };
  const bad = { getItem: sec, setItem: sec, removeItem: sec, get length() { return 0; }, key: () => null };
  assert.deepEqual(writeAheadPendingSet(bad, mkItem("a1", OP(9)), 1), { ok: false, reason: "storage_unavailable" });
  assert.deepEqual(writeAheadPendingSet(null, mkItem("a1", OP(9)), 1), { ok: false, reason: "storage_unavailable" });
  assert.deepEqual(writeAheadPendingSet(undefined, mkItem("a1", OP(9)), 1), { ok: false, reason: "storage_unavailable" });
  const s = store(); const onlySet = Object.assign({}, s, { getItem: s.getItem, setItem: sec, removeItem: s.removeItem });
  assert.deepEqual(writeAheadPendingSet(onlySet, mkItem("a1", OP(9)), 1), { ok: false, reason: "storage_unavailable" });
  assert.equal(s._m.size, 0);
  // validacion
  assert.deepEqual(writeAheadPendingSet(store(), mkItem("", OP(9)), 1), { ok: false, reason: "invalid" });
  assert.deepEqual(writeAheadPendingSet(store(), Object.assign(mkItem("a1", OP(9)), { opId: "" }), 1), { ok: false, reason: "invalid" });
  assert.deepEqual(writeAheadPendingSet(store(), null, 1), { ok: false, reason: "invalid" });
});

// j. cuota
await t("j. cuota agotada (QuotaExceededError / code 22 / 1014): reason quota y nada a medias", async () => {
  for (const mkErr of [() => Object.assign(new Error("q"), { name: "QuotaExceededError" }), () => ({ code: 22 }), () => ({ name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 })]) {
    const s = store({ other: "x" });
    const full = Object.assign({}, s, { getItem: s.getItem, removeItem: s.removeItem, setItem: () => { throw mkErr(); } });
    assert.deepEqual(writeAheadPendingSet(full, mkItem("a1", OP(10)), 1), { ok: false, reason: "quota" });
    assert.deepEqual([...s._m.keys()], ["other"]);
  }
  // escritura que "pasa" pero no se relee igual -> verify_failed y se borra lo escrito a medias
  const s2 = store();
  const lying = Object.assign({}, s2, { getItem: s2.getItem, removeItem: s2.removeItem, setItem: (k, v) => s2.setItem(k, String(v).slice(0, 10)) });
  assert.deepEqual(writeAheadPendingSet(lying, mkItem("a1", OP(11)), 1), { ok: false, reason: "verify_failed" });
  assert.equal(s2._m.size, 0);
  // tombstone previo
  const s3 = store({ [PQ_DONE_PREFIX + OP(12)]: JSON.stringify({ at: 1 }) });
  assert.deepEqual(writeAheadPendingSet(s3, mkItem("a1", OP(12)), 1), { ok: false, reason: "already_confirmed" });
  assert.equal(keyed(s3, OP(12)), null);
});

// k. aislamiento entre alumnos
await t("k. aislamiento: el flush de a1 solo envia lo de a1; removeAllPendingForAlumno(a1) deja intacto b1 (arreglo y por clave)", async () => {
  const s = store();
  s.setItem(PENDING_SYNC_KEY, JSON.stringify([mkItem("a1", OP(20)), mkItem("b1", OP(21)), { exId: "x", kg: 1, reps: 1, date: "d", semana: 0 }]));
  writeAheadPendingSet(s, mkItem("a1", OP(22)), 1);
  writeAheadPendingSet(s, mkItem("b1", OP(23)), 2);
  s.setItem(PQ_STATE_PREFIX + OP(22), "{}"); s.setItem(PQ_STATE_PREFIX + OP(23), "{}");
  const seen = [];
  await flushPendingForAlumno({ storage: s, alumnoId: "a1", send: async (it) => { seen.push(it.alumno_id); return null; } });
  assert.ok(seen.length >= 2 && seen.every((a) => a === "a1"), JSON.stringify(seen));
  removeAllPendingForAlumno(s, "a1");
  const all = readAllPending(s).items;
  assert.deepEqual(all.filter((i) => i.alumno_id === "a1"), []);
  assert.deepEqual(all.filter((i) => i.alumno_id === "b1").map((i) => i.opId).sort(), [OP(21), OP(23)]);
  assert.equal(keyed(s, OP(22)), null); assert.equal(s.getItem(PQ_STATE_PREFIX + OP(22)), null);
  assert.ok(keyed(s, OP(23)) != null); assert.equal(s.getItem(PQ_STATE_PREFIX + OP(23)), "{}");
  assert.equal(s.getItem(PQ_DONE_PREFIX + OP(22)), null, "borrar no es confirmar");
  assert.equal(removeAllPendingForAlumno(s, ""), 0);
});

// l. compatibilidad
await t("l. compatibilidad: arreglo legado (sin opId/alumno_id) + arreglo con opId + por clave -> un flush envia todo sin duplicar", async () => {
  const s = store();
  const legacy = { exId: "bp", kg: 40, reps: 10, note: "", date: "1/11/2026", semana: 0 };
  s.setItem(PENDING_SYNC_KEY, JSON.stringify([legacy, mkItem("a1", OP(30))]));
  writeAheadPendingSet(s, mkItem("a1", OP(31)), 1);
  let k = 0;
  const sent = [];
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "a1", idGen: () => OP(39 + k++), send: async (it) => { sent.push(it.opId); return [{ id: it.opId }]; } });
  assert.deepEqual(r, { sent: 3, failed: 0 });
  assert.equal(new Set(sent).size, 3);
  assert.equal(readAllPending(s).items.length, 0);
  assert.equal(readQueue(s).items.length, 0);
  const again = await flushPendingForAlumno({ storage: s, alumnoId: "a1", send: async () => { throw new Error("no deberia enviar"); } });
  assert.deepEqual(again, { sent: 0, failed: 0 });
});

await t("l. arreglo corrupto + writeAhead: se respalda en it_pending_sync_corrupto_* y el pendiente nuevo es sincronizable", async () => {
  const s = store({ [PENDING_SYNC_KEY]: "{no es json" });
  assert.deepEqual(writeAheadPendingSet(s, mkItem("a1", OP(32)), 1), { ok: true });
  const backups = [...s._m.keys()].filter((key) => key.indexOf(PENDING_SYNC_KEY + "_corrupto_") === 0);
  assert.equal(backups.length, 1);
  assert.equal(s.getItem(backups[0]), "{no es json");
  assert.equal(readQueue(s).corrupt, false);
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "a1", send: async (it) => [{ id: it.opId }] });
  assert.deepEqual(r, { sent: 1, failed: 0 });
  assert.equal(keyed(s, OP(32)), null);
});

// m. semana, ciclo y fecha
await t("m. el payload tras recarga conserva fecha, semana (0-based) y ciclo; es identico al del envio directo", async () => {
  const s = store(); const op = OP(33);
  const args = ["a1", "dl", 140, 3, "pesado", "5/11/2026", 3, 2, op];
  const directPayload = buildProgressPayload(...args);
  const item = buildPendingProgressItem("dl", 140, 3, "pesado", "5/11/2026", 3, 2, "a1", op);
  writeAheadPendingSet(s, item, 1);
  const r1 = await sendWriteAheadSet({ storage: s, opId: op, send: async () => null });
  assert.equal(r1.confirmed, false);
  let flushed = null;
  await flushPendingForAlumno({ storage: s, alumnoId: "a1", send: async (it) => { flushed = payloadFromItem("a1", it); return [flushed]; } });
  assert.equal(flushed.fecha, "5/11/2026"); assert.equal(flushed.semana, 3); assert.equal(flushed.ciclo, 2); assert.equal(flushed.id, op);
  assert.deepEqual(flushed, directPayload);
  assert.equal(JSON.stringify(flushed), JSON.stringify(directPayload));
});

// n. concurrencia
await t("n. envio directo en vuelo + flush en la misma pestaña: el flush excluye ese opId; al terminar sin confirmar queda para el proximo", async () => {
  const s = store(); const op = OP(34); const other = OP(35);
  writeAheadPendingSet(s, mkItem("a1", op), 1);
  writeAheadPendingSet(s, mkItem("a1", other), 2);
  let release;
  const direct = sendWriteAheadSet({ storage: s, opId: op, send: () => new Promise((r) => { release = r; }) });
  assert.ok(isSetSendInFlight(op));
  const flushSent = [];
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "a1", isInFlight: isSetSendInFlight, send: async (it) => { flushSent.push(it.opId); return [{ id: it.opId }]; } });
  assert.deepEqual(flushSent, [other]);
  assert.deepEqual(r, { sent: 1, failed: 0 });
  release(null);
  assert.equal((await direct).confirmed, false);
  assert.ok(keyed(s, op) != null);
  const r2 = await flushPendingForAlumno({ storage: s, alumnoId: "a1", isInFlight: isSetSendInFlight, send: async (it) => [{ id: it.opId }] });
  assert.deepEqual(r2, { sent: 1, failed: 0 });
  // sin isInFlight: comportamiento anterior (no filtra)
  const s2 = store(); writeAheadPendingSet(s2, mkItem("a1", OP(36)), 1);
  let rel2;
  const d2 = sendWriteAheadSet({ storage: s2, opId: OP(36), send: () => new Promise((r) => { rel2 = r; }) });
  const sent2 = [];
  await flushPendingForAlumno({ storage: s2, alumnoId: "a1", send: async (it) => { sent2.push(it.opId); return null; } });
  assert.deepEqual(sent2, [OP(36)]);
  rel2(null); await d2;
});

await t("n. dos flush concurrentes con withFlushLock: solo uno corre", async () => {
  const s = store(); writeAheadPendingSet(s, mkItem("a1", OP(37)), 1);
  let sends = 0;
  const run = () => withFlushLock(() => flushPendingForAlumno({ storage: s, alumnoId: "a1", send: async (it) => { sends++; await sleep(10); return [{ id: it.opId }]; } }), { locks: null });
  const [x, y] = await Promise.all([run(), run()]);
  assert.equal([x, y].filter((o) => o.ran).length, 1);
  assert.equal(sends, 1);
  assert.equal(keyed(s, OP(37)), null);
});

// o. confirmacion antes de retirar
await t("o. mientras el envio no resuelve el pendiente sigue; un resultado no confirmado nunca lo retira", async () => {
  const s = store(); const op = OP(38);
  writeAheadPendingSet(s, mkItem("a1", op), 1);
  let release;
  const p = sendWriteAheadSet({ storage: s, opId: op, send: () => new Promise((r) => { release = r; }) });
  await sleep(10);
  assert.ok(keyed(s, op) != null);
  assert.equal(s.getItem(PQ_DONE_PREFIX + op), null);
  release({ error: "algo" });
  assert.equal((await p).confirmed, false);
  assert.ok(keyed(s, op) != null);
  assert.equal(s.getItem(PQ_DONE_PREFIX + op), null);
  // con confirmacion tardia si se retira
  let rel2;
  const p2 = sendWriteAheadSet({ storage: s, opId: op, send: () => new Promise((r) => { rel2 = r; }) });
  await sleep(10);
  assert.ok(keyed(s, op) != null);
  rel2([{ id: op }]);
  assert.equal((await p2).confirmed, true);
  assert.equal(keyed(s, op), null);
});

// p. regresion estatica de App.jsx y WorkoutExercisePanel.jsx
await t("p. App.logSet: write-ahead antes del POST, sin enqueueItem tras el intento, return false ante fallo local; panel con retorno temprano", async () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const i = app.indexOf("const logSet = (");
  assert.ok(i >= 0);
  const body = app.slice(i, app.indexOf("\n  };\n", i));
  const wa = body.indexOf("writeAheadPendingSet(localStorage");
  const send = body.indexOf("sendWriteAheadSet(");
  const post = body.indexOf("addProgresoIdempotente(");
  const prog = body.indexOf("setProgress(");
  assert.ok(wa > 0 && send > wa && post > wa && prog > wa, "write-ahead precede a setProgress y al envio");
  assert.ok(!/enqueueItem|enqueuePendingSet|persistSetConfirmed\(/.test(body), "logSet no encola despues del intento");
  const fail = body.slice(wa, prog);
  assert.ok(/if\(!wa\.ok\)\s*\{[\s\S]*?return false;/.test(fail), "return false ante fallo local, antes de setProgress");
  assert.ok(/return true;\s*$/.test(body), "return true al final");
  assert.ok(app.includes("isInFlight: isSetSendInFlight"), "el flush excluye lo que esta en vuelo en esta pestaña");
  assert.ok(app.includes("removeAllPendingForAlumno(localStorage, aid)"), "limpiar historial quita tambien it_pq:*");
  const panel = readFileSync(new URL("../components/WorkoutExercisePanel.jsx", import.meta.url), "utf8");
  const h = panel.indexOf("const handleLogSet = ");
  const hb = panel.slice(h, panel.indexOf("\n  };\n", h));
  const ls = hb.indexOf("logSet(");
  assert.ok(ls > 0 && ls < hb.indexOf("setSetFlash(") && ls < hb.indexOf("navigator.vibrate") && ls < hb.indexOf("startTimer(") && ls < hb.indexOf('setNote("")'));
  assert.ok(/const saved = logSet\([\s\S]*?\);\s*if\(saved === false\) return;/.test(hb), "retorno temprano si logSet devuelve false");
});

console.log(`\n${n} pruebas OK` + (failed ? `, ${failed} FALLARON` : ""));
if (failed) process.exit(1);
