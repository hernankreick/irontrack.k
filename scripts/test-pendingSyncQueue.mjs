// Cola de series pendientes: opId estable, aislamiento por alumno, compatibilidad, flush por identidad, cerrojo y login/logout.
//   node scripts/test-pendingSyncQueue.mjs
import assert from "node:assert/strict";
import {
  PENDING_SYNC_KEY, generateOpId, readQueue, updateQueue, enqueueItem, itemsForAlumno, visiblePendingItems,
  adoptLegacyItems, dropUnattributedItems, flushPendingForAlumno, withFlushLock,
} from "../lib/pendingSyncQueue.js";
import { buildPendingProgressItem } from "../lib/workoutSession.js";

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const store = (init) => {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k),
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, _m: m };
};
const q = (s) => readQueue(s).items;
const item = (alumno, ex, op) => buildPendingProgressItem(ex, "60", "8", "", "12/10/2026", 1, alumno, op);
const deferred = () => { let res; const p = new Promise((r) => (res = r)); return { p, res }; };
const ok = async () => [{ id: 1 }];

await t("opId: UUID v4 unico, tambien sin crypto.randomUUID", () => {
  const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const ids = new Set(); for (let i = 0; i < 200; i++) ids.add(generateOpId());
  assert.equal(ids.size, 200); for (const id of ids) assert.match(id, re);
  assert.match(generateOpId({ crypto: null }), re);
  assert.match(generateOpId({ crypto: { getRandomValues: (a) => a.fill(7) } }), re);
});

await t("el opId se conserva igual en todos los reintentos (mismo elemento, mismo opId en cada intento)", async () => {
  const s = store(); enqueueItem(s, item("A", "sq", "op-1"));
  const seen = [];
  for (const respuesta of [null, null, [{ id: 1 }]]) {
    await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async (it) => { seen.push(it.opId); return respuesta; } });
  }
  assert.deepEqual(seen, ["op-1", "op-1", "op-1"]); assert.equal(q(s).length, 0);
});

await t("compatibilidad: elementos antiguos (sin alumno_id/opId) se adoptan para el alumno de la sesion, sin perder campos; es idempotente", () => {
  const legacy = { exId: "sq", kg: 60, reps: 8, note: "", date: "12/10/2026", semana: 1 };
  const s = store({ [PENDING_SYNC_KEY]: JSON.stringify([legacy]) });
  let c = 0; const gen = () => "gen-" + ++c;
  adoptLegacyItems(s, "A", gen);
  const [a] = q(s);
  assert.deepEqual({ ...a, alumno_id: undefined, opId: undefined }, { ...legacy, alumno_id: undefined, opId: undefined });
  assert.equal(a.alumno_id, "A"); assert.equal(a.opId, "gen-1");
  adoptLegacyItems(s, "B", gen);                       // ya atribuido: no cambia de dueño ni de opId
  assert.deepEqual(q(s), [a]);
});

await t("aislamiento: un alumno solo ve y sincroniza SUS series; las de otros quedan intactas", async () => {
  const s = store(); enqueueItem(s, item("A", "sq", "a1")); enqueueItem(s, item("A", "bp", "a2")); enqueueItem(s, item("B", "dl", "b1"));
  assert.deepEqual(visiblePendingItems(s, "A").map((x) => x.opId), ["a1", "a2"]);
  assert.deepEqual(visiblePendingItems(s, "B").map((x) => x.opId), ["b1"]);
  assert.deepEqual(visiblePendingItems(s, "C"), []); assert.deepEqual(visiblePendingItems(s, null), []);
  const antesA = JSON.stringify(q(s).filter((x) => x.alumno_id === "A"));
  const enviados = [];
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "B", send: async (it) => { enviados.push(it.opId); return [{ id: 1 }]; } });
  assert.deepEqual(enviados, ["b1"]); assert.equal(r.sent, 1);
  assert.equal(JSON.stringify(q(s)), antesA, "las series de A no se tocan ni se envian");
  const nada = await flushPendingForAlumno({ storage: s, alumnoId: null, send: async () => { throw new Error("no debe enviar"); } });
  assert.equal(nada.skipped, "no-alumno");
});

await t("resultados: 500/403 (null), error de red y timeout dejan la serie en la cola; solo el servidor que confirma la quita", async () => {
  const casos = { "HTTP 500": async () => null, "HTTP 403": async () => null, "red": async () => { throw new Error("net"); },
    "respuesta vacia": async () => [], "timeout": () => new Promise(() => {}) };
  for (const [nombre, send] of Object.entries(casos)) {
    const s = store(); enqueueItem(s, item("A", "sq", "x"));
    const t0 = Date.now();
    const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send, timeoutMs: 40 });
    assert.deepEqual([r.sent, r.failed], [0, 1], nombre); assert.equal(q(s).length, 1, nombre); assert.ok(Date.now() - t0 < 1500, nombre);
  }
  const s = store(); enqueueItem(s, item("A", "sq", "x")); enqueueItem(s, item("A", "bp", "y"));
  await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async (it) => (it.opId === "x" ? [{ id: 1 }] : null) });
  assert.deepEqual(q(s).map((x) => x.opId), ["y"]);
});

await t("sesion expirada: el POST falla (sin token) y la serie sobrevive; con sesion valida se sincroniza", async () => {
  const s = store(); enqueueItem(s, item("A", "sq", "e1"));
  await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async () => null });
  assert.equal(q(s).length, 1);
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: ok });
  assert.equal(r.sent, 1); assert.equal(q(s).length, 0);
});

await t("serie agregada DURANTE un flush: no se pierde ni se marca sincronizada", async () => {
  const s = store(); enqueueItem(s, item("A", "sq", "a1"));
  const d = deferred();
  const flush = flushPendingForAlumno({ storage: s, alumnoId: "A", send: () => d.p });
  await new Promise((r) => setTimeout(r, 5));
  enqueueItem(s, item("A", "bp", "a2"));               // se encola mientras a1 esta en vuelo
  d.res([{ id: 1 }]);
  const r = await flush;
  assert.equal(r.sent, 1); assert.deepEqual(q(s).map((x) => x.opId), ["a2"]);
});

await t("limpieza DURANTE un flush: lo eliminado no resucita y lo nuevo no se pierde (el caso que fallaba con indices)", async () => {
  const s = store(); ["a", "b", "c"].forEach((o) => enqueueItem(s, item("A", o, o)));
  const ds = { a: deferred(), b: deferred(), c: deferred() };
  const flush = flushPendingForAlumno({ storage: s, alumnoId: "A", send: (it) => ds[it.opId].p });
  await new Promise((r) => setTimeout(r, 5));
  updateQueue(s, (items) => items.filter((x) => x.opId !== "a" && x.opId !== "b"));   // reset del entrenador: borra a y b
  enqueueItem(s, item("A", "d", "d"));                                                  // y llega una serie nueva
  ds.a.res(null); ds.b.res(null); ds.c.res([{ id: 1 }]);                                // a y b fallaron, c se confirmo
  await flush;
  assert.deepEqual(q(s).map((x) => x.opId), ["d"], "a y b NO deben reaparecer, d NO debe perderse, c se sincronizo");
});

await t("limpieza durante el flush cuando todo se confirma: solo queda lo encolado despues", async () => {
  const s = store(); ["a", "b", "c"].forEach((o) => enqueueItem(s, item("A", o, o)));
  const d = deferred();
  const flush = flushPendingForAlumno({ storage: s, alumnoId: "A", send: () => d.p });
  await new Promise((r) => setTimeout(r, 5));
  updateQueue(s, (items) => items.filter((x) => x.opId !== "a")); enqueueItem(s, item("A", "d", "d"));
  d.res([{ id: 1 }]); await flush;
  assert.deepEqual(q(s).map((x) => x.opId), ["d"]);
});

await t("cerrojo: un solo flush por vez en la pestaña; la segunda llamada concurrente no corre", async () => {
  let corridas = 0; const d = deferred();
  const p1 = withFlushLock(async () => { corridas++; await d.p; return "x"; }, { locks: null });
  const p2 = withFlushLock(async () => { corridas++; return "y"; }, { locks: null });
  d.res(); const [r1, r2] = await Promise.all([p1, p2]);
  assert.deepEqual([corridas, r1.ran, r2.ran], [1, true, false]);
  const r3 = await withFlushLock(async () => { corridas++; return "z"; }, { locks: null });   // se libero
  assert.deepEqual([corridas, r3.ran, r3.value], [2, true, "z"]);
  await assert.rejects(withFlushLock(async () => { throw new Error("boom"); }, { locks: null }));
  assert.equal((await withFlushLock(async () => 1, { locks: null })).ran, true, "el cerrojo se libera aunque fn lance");
});

await t("cerrojo entre pestañas (Web Locks, ifAvailable): si otra pestaña lo tiene no se corre ni se espera", async () => {
  let held = false; const pedidos = [];
  const locks = { request: async (name, opts, cb) => { pedidos.push([name, opts.ifAvailable]); if (held) return cb(null); held = true; try { return await cb({ name }); } finally { held = false; } } };
  held = true;                                                  // otra pestaña tiene el cerrojo
  const r = await withFlushLock(async () => { throw new Error("no debe correr"); }, { locks });
  assert.equal(r.ran, false);
  held = false;
  const r2 = await withFlushLock(async () => "ok", { locks });
  assert.deepEqual([r2.ran, r2.value], [true, "ok"]); assert.deepEqual(pedidos[0], ["it_pending_sync_flush", true]);
});

await t("cola corrupta: el flush la deja intacta; al encolar se respalda en it_pending_sync_corrupto_*", async () => {
  const s = store({ [PENDING_SYNC_KEY]: "{oops" });
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async () => { throw new Error("no debe enviar"); } });
  assert.equal(r.skipped, "corrupt"); assert.equal(s.getItem(PENDING_SYNC_KEY), "{oops");
  enqueueItem(s, item("A", "sq", "z"));
  assert.ok([...s._m.keys()].some((k) => k.startsWith("it_pending_sync_corrupto_")));
  assert.equal(q(s).length, 1);
});

// ── login / logout (lib/irontrackLocalStorage.js sobre un localStorage simulado) ──
const { clearIronTrackStorageForNewLogin, clearAllIronTrackPrefixedKeys, IRONTRACK_LOGIN_RESET_KEYS } = await import("../lib/irontrackLocalStorage.js");
const conLocalStorage = (s, fn) => { globalThis.localStorage = s; try { return fn(); } finally { delete globalThis.localStorage; } };

await t("login: it_pending_sync ya no esta en las claves que se borran; se conservan las series con dueño y se descartan las sin dueño", () => {
  assert.ok(!IRONTRACK_LOGIN_RESET_KEYS.includes("it_pending_sync"));
  const legacy = { exId: "sq", kg: 60, reps: 8, note: "", date: "12/10/2026", semana: 1 };
  const s = store({ it_session: "{}", it_pg: "{}", it_pending_sync: JSON.stringify([item("A", "sq", "a1"), legacy, item("B", "bp", "b1")]), it_pending_sync_corrupto_1: "x", otra: "1" });
  conLocalStorage(s, () => clearIronTrackStorageForNewLogin());
  assert.equal(s.getItem("it_session"), null); assert.equal(s.getItem("it_pg"), null);
  assert.deepEqual(q(s).map((x) => x.opId), ["a1", "b1"]);
  assert.equal(s.getItem("it_pending_sync_corrupto_1"), "x"); assert.equal(s.getItem("otra"), "1");
});
await t("logout: borra las claves it_* salvo la cola pendiente (y sus respaldos); el borrado total explicito la incluye", () => {
  const mk = () => store({ it_session: "{}", it_pg: "{}", it_pending_sync: JSON.stringify([item("A", "sq", "a1")]), it_pending_sync_corrupto_9: "x", otra: "1" });
  const s = mk(); conLocalStorage(s, () => clearAllIronTrackPrefixedKeys());
  assert.deepEqual([...s._m.keys()].sort(), ["it_pending_sync", "it_pending_sync_corrupto_9", "otra"]);
  const w = mk(); conLocalStorage(w, () => clearAllIronTrackPrefixedKeys({ includePending: true }));
  assert.deepEqual([...w._m.keys()], ["otra"]);
});
await t("sobrevive logout + login del mismo alumno y no la ve otro alumno que inicia sesion en el mismo dispositivo", async () => {
  const s = store({ it_session: "{}" }); enqueueItem(s, item("A", "sq", "a1"));
  conLocalStorage(s, () => clearAllIronTrackPrefixedKeys());          // logout de A
  conLocalStorage(s, () => clearIronTrackStorageForNewLogin());       // login de B
  assert.deepEqual(visiblePendingItems(s, "B"), []);
  const enviados = []; await flushPendingForAlumno({ storage: s, alumnoId: "B", send: async (it) => { enviados.push(it.opId); return [{ id: 1 }]; } });
  assert.deepEqual(enviados, []); assert.equal(q(s).length, 1);
  conLocalStorage(s, () => clearAllIronTrackPrefixedKeys()); conLocalStorage(s, () => clearIronTrackStorageForNewLogin());   // vuelve A
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: ok });
  assert.equal(r.sent, 1); assert.equal(q(s).length, 0);
});
console.log(`${n} comprobaciones OK`);
