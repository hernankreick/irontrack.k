// Entrega 0a — cola de series por clave: lectura, adopcion del arreglo antiguo, confirmadas, intentos, cerrojo y compatibilidad.
//   node scripts/test-pendingQueueKeyed.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import {
  LEGACY_QUEUE_KEY, PQ_ITEM_PREFIX, PQ_STATE_PREFIX, PQ_DONE_PREFIX, SEND_STALE_MS,
  isPendingQueueKey, readKeyedItems, readDoneMap, unifyPending, adoptLegacyArray, removeConfirmedKeyed, gcDoneMarks,
  beginAttempt, finishAttempt, isAttemptStale, readAttemptState, withSendLock, runSendAttempt,
} from "../lib/pendingQueueKeyed.js";
import { readAllPending, visiblePendingItems, flushPendingForAlumno, readQueue, enqueueItem } from "../lib/pendingSyncQueue.js";
import { clearAllIronTrackPrefixedKeys } from "../lib/irontrackLocalStorage.js";

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const store = (init) => {
  const m = new Map(Object.entries(init || {}));
  const failOn = { set: null };
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (failOn.set && failOn.set(k)) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => void m.delete(k),
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, _m: m, failOn,
  };
};
const mk = (opId, over) => Object.assign({ exId: "sq", kg: 60, reps: 8, note: "", date: "12/10/2026", semana: 1, alumno_id: "A", opId }, over || {});
const kItem = (s, it) => s.setItem(PQ_ITEM_PREFIX + it.opId, JSON.stringify(it));
const arr = (s, items) => s.setItem(LEGACY_QUEUE_KEY, JSON.stringify(items));
const keyedIds = (s) => readKeyedItems(s).items.map((i) => i.opId).sort();
const ok = async () => [{ id: 1 }];

await t("isPendingQueueKey: reconoce el arreglo, sus respaldos y los tres tipos de clave nuevos; nada mas", () => {
  for (const k of ["it_pending_sync", "it_pending_sync_corrupto_123", "it_pq:abc", "it_pqf:abc", "it_pqd:abc"]) assert.equal(isPendingQueueKey(k), true, k);
  for (const k of ["it_pg", "it_session", "it_pqx", "pq:abc", "", null, undefined, 5]) assert.equal(isPendingQueueKey(k), false, String(k));
});

await t("readKeyedItems: lee validos; JSON roto u opId distinto de la clave se informa como invalido y NO se toca; ignora claves ajenas", () => {
  const s = store({ other: "x", "it_pg": "{}" });
  kItem(s, mk("op-1")); kItem(s, mk("op-2", { createdAt: 5 }));
  s.setItem(PQ_ITEM_PREFIX + "roto", "{no es json"); s.setItem(PQ_ITEM_PREFIX + "op-9", JSON.stringify(mk("otro")));
  s.setItem(PQ_ITEM_PREFIX + "arr", "[1]");
  const r = readKeyedItems(s);
  assert.deepEqual(r.items.map((i) => i.opId).sort(), ["op-1", "op-2"]);
  assert.deepEqual(r.invalid.sort(), [PQ_ITEM_PREFIX + "arr", PQ_ITEM_PREFIX + "op-9", PQ_ITEM_PREFIX + "roto"]);
  assert.equal(s.getItem(PQ_ITEM_PREFIX + "roto"), "{no es json");
});

await t("unifyPending: sin duplicados (gana el elemento por clave), pasa lo que no tiene opId, oculta lo confirmado en ambos lados", () => {
  const s = store(); kItem(s, mk("op-1", { kg: 99 })); kItem(s, mk("op-3"));
  const legacy = [mk("op-1", { kg: 1 }), mk("op-2"), { exId: "bp", kg: 5, reps: 5, date: "d", semana: 1 }, mk("op-3")];
  let u = unifyPending(legacy, readKeyedItems(s), {});
  assert.deepEqual(u.items.map((i) => i.opId || "(sin opId)").sort(), ["(sin opId)", "op-1", "op-2", "op-3"]);
  assert.equal(u.items.find((i) => i.opId === "op-1").kg, 99, "gana el elemento por clave");
  u = unifyPending(legacy, readKeyedItems(s), { "op-1": 1, "op-2": 1 });
  assert.deepEqual(u.items.map((i) => i.opId || "(sin opId)").sort(), ["(sin opId)", "op-3"]);
});

await t("adopcion: conserva la identidad sin depender del orden (24 permutaciones), series identicas con opId distinto siguen distintas", () => {
  const base = [mk("op-a"), mk("op-b"), mk("op-c"), mk("op-d")];            // contenido identico, identidades distintas
  const perms = (xs) => xs.length < 2 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
  const snaps = new Set();
  for (const p of perms(base)) {
    const s = store(); arr(s, p); adoptLegacyArray(s, readQueue(s).items);
    snaps.add(JSON.stringify(readKeyedItems(s).items.map((i) => [i.opId, i.kg, i.reps])));
  }
  assert.equal(snaps.size, 1, "el resultado no depende del orden del arreglo");
  assert.deepEqual([...snaps][0], JSON.stringify([["op-a", 60, 8], ["op-b", 60, 8], ["op-c", 60, 8], ["op-d", 60, 8]]));
});

await t("adopcion: NO modifica ni vacia el arreglo antiguo (byte a byte) y es idempotente; lo sin opId/alumno_id queda intacto", () => {
  const sinId = { exId: "sq", kg: 60, reps: 8, note: "", date: "12/10/2026", semana: 1 };
  const items = [mk("op-1"), sinId, { ...sinId }, mk("op-2", { alumno_id: undefined })];
  const s = store(); arr(s, items); const antes = s.getItem(LEGACY_QUEUE_KEY);
  const r1 = adoptLegacyArray(s, readQueue(s).items);
  assert.equal(s.getItem(LEGACY_QUEUE_KEY), antes, "el arreglo no cambia");
  assert.deepEqual([r1.adopted, r1.skippedUnidentified], [1, 3]); assert.deepEqual(keyedIds(s), ["op-1"]);
  const r2 = adoptLegacyArray(s, readQueue(s).items);
  assert.deepEqual([r2.adopted, r2.existing], [0, 1]); assert.equal(s.getItem(LEGACY_QUEUE_KEY), antes);
});

await t("una confirmacion no reaparece por una adopcion posterior (aunque el arreglo siga conteniendo el elemento)", () => {
  const s = store(); const items = [mk("op-1"), mk("op-2")]; arr(s, items);
  adoptLegacyArray(s, items);
  removeConfirmedKeyed(s, "op-1", 1000);
  assert.deepEqual(keyedIds(s), ["op-2"]);
  const r = adoptLegacyArray(s, readQueue(s).items);
  assert.deepEqual([r.adopted, r.skippedDone], [0, 1]); assert.deepEqual(keyedIds(s), ["op-2"]);
  assert.deepEqual(readAllPending(s).items.map((i) => i.opId), ["op-2"], "la vista unificada tampoco la muestra");
  assert.equal(visiblePendingItems(s, "A").length, 1);
});

await t("carrera: se confirma mientras se adopta (instantanea vieja) -> el elemento recien escrito se retira y no queda pendiente", () => {
  const s = store(); const it = mk("op-1"); arr(s, [it]);
  const realSet = s.setItem.bind(s);
  s.setItem = (k, v) => { realSet(k, v); if (k === PQ_ITEM_PREFIX + "op-1") removeConfirmedKeyed(s, "op-1", 5); };   // otra pestaña confirma justo despues de escribir
  const r = adoptLegacyArray(s, [it]);
  assert.equal(r.adopted, 0); assert.deepEqual(keyedIds(s), []); assert.deepEqual(readAllPending(s).items, []);
});

await t("pestaña con codigo antiguo: sus escrituras al arreglo durante la transicion no se pierden y se adoptan despues", () => {
  const s = store(); arr(s, [mk("op-1")]);
  adoptLegacyArray(s, readQueue(s).items);
  const old = readQueue(s).items; old.push(mk("op-2")); arr(s, old);              // pestaña vieja agrega (lectura-modificacion-escritura del arreglo)
  assert.deepEqual(readAllPending(s).items.map((i) => i.opId).sort(), ["op-1", "op-2"], "se ve lo del arreglo y lo adoptado, una vez cada uno");
  adoptLegacyArray(s, readQueue(s).items);
  assert.deepEqual(keyedIds(s), ["op-1", "op-2"]);
  assert.equal(readQueue(s).items.length, 2, "el arreglo sigue intacto");
});

await t("removeConfirmedKeyed: la marca se escribe antes que el borrado (simulando corte tras la marca el elemento ya esta oculto)", () => {
  const s = store(); kItem(s, mk("op-1"));
  const order = []; const ss = s.setItem.bind(s), rr = s.removeItem.bind(s);
  s.setItem = (k, v) => { order.push("set " + k); ss(k, v); }; s.removeItem = (k) => { order.push("rm " + k); rr(k); };
  removeConfirmedKeyed(s, "op-1", 7);
  assert.equal(order[0], "set " + PQ_DONE_PREFIX + "op-1"); assert.ok(order.includes("rm " + PQ_ITEM_PREFIX + "op-1"));
  // corte simulado: marca presente + elemento presente
  const s2 = store(); kItem(s2, mk("op-1")); s2.setItem(PQ_DONE_PREFIX + "op-1", JSON.stringify({ at: 1 }));
  assert.deepEqual(readAllPending(s2).items, []);
  // falla la marca (almacenamiento lleno): igual se retira el elemento
  const s3 = store(); kItem(s3, mk("op-1")); s3.failOn.set = (k) => k.startsWith(PQ_DONE_PREFIX);
  const r = removeConfirmedKeyed(s3, "op-1", 1);
  assert.deepEqual([r.tombstoned, r.removed], [false, true]); assert.deepEqual(keyedIds(s3), []);
});

await t("gcDoneMarks: borra solo las viejas; conserva las recientes y las ilegibles", () => {
  const s = store(); const DAY = 24 * 3600 * 1000;
  s.setItem(PQ_DONE_PREFIX + "viejo", JSON.stringify({ at: 0 })); s.setItem(PQ_DONE_PREFIX + "nuevo", JSON.stringify({ at: 20 * DAY }));
  s.setItem(PQ_DONE_PREFIX + "raro", "no-json");
  assert.equal(gcDoneMarks(s, 20 * DAY + 1, 14 * DAY), 1);
  assert.deepEqual(Object.keys(readDoneMap(s)).sort(), ["nuevo", "raro"]);
});

await t("intentos: una respuesta antigua NO sobrescribe el estado de un intento nuevo; tampoco recrea el estado de un elemento ya quitado", () => {
  const s = store(); kItem(s, mk("op-1"));
  const a1 = beginAttempt(s, "op-1", 1000, () => "A1").attemptId;
  const a2 = beginAttempt(s, "op-1", 2000, () => "A2").attemptId;               // un relevo abre un intento nuevo
  assert.equal(readAttemptState(s, "op-1").attemptId, "A2");
  const late = finishAttempt(s, "op-1", a1, { confirmed: false, reason: "timeout" }, 3000);    // llega tarde la respuesta del intento viejo
  assert.deepEqual([late.applied, late.reason], [false, "stale"]);
  assert.equal(readAttemptState(s, "op-1").attemptId, "A2"); assert.equal(readAttemptState(s, "op-1").failCount, undefined);
  const fin = finishAttempt(s, "op-1", a2, { confirmed: false, reason: "error" }, 3500);
  assert.equal(fin.applied, true); assert.deepEqual([readAttemptState(s, "op-1").attemptId, readAttemptState(s, "op-1").failCount], [null, 1]);
  removeConfirmedKeyed(s, "op-1", 4000);
  assert.equal(finishAttempt(s, "op-1", a2, { confirmed: false }, 5000).applied, false);
  assert.equal(s.getItem(PQ_STATE_PREFIX + "op-1"), null, "no se recrea el estado");
});

await t("isAttemptStale: justo en el limite no; pasado el limite si; sin intento no; sin fecha valida si", () => {
  assert.equal(isAttemptStale({ attemptId: "x", since: 1000 }, 1000 + SEND_STALE_MS), false);
  assert.equal(isAttemptStale({ attemptId: "x", since: 1000 }, 1000 + SEND_STALE_MS + 1), true);
  assert.equal(isAttemptStale({ attemptId: null, since: 0 }, 9e9), false);
  assert.equal(isAttemptStale({ attemptId: "x" }, 5), true);
  assert.equal(isAttemptStale(null, 5), false);
});

await t("withSendLock: libre -> corre; ocupado -> no corre; sin Web Locks -> corre sin cerrojo", async () => {
  const held = new Set();
  const locks = { request: async (name, opts, cb) => { if (opts.ifAvailable && held.has(name)) return cb(null); held.add(name); try { return await cb({}); } finally { held.delete(name); } } };
  let ran = 0;
  const inner = await withSendLock("op-1", async () => { ran++; return withSendLock("op-1", async () => { ran++; }, { locks }); }, { locks });
  assert.equal(ran, 1); assert.deepEqual(inner.value, { ran: false, reason: "busy" });
  const sin = await withSendLock("op-1", async () => 7, { locks: null }); assert.deepEqual([sin.ran, sin.value, sin.locked], [true, 7, false]);
});

await t("runSendAttempt: cerrojo ocupado y envio vigente -> no envia; ocupado y abandonado (>60 s) -> toma el relevo; la respuesta del titular zombi no pisa el estado", async () => {
  const s = store(); kItem(s, mk("op-1"));
  let now = 10_000; const clock = () => now;
  const held = new Set(["it_send:op-1"]);                                   // el titular (pestaña congelada) retiene el cerrojo
  const locks = { request: async (name, opts, cb) => { if (opts.ifAvailable && held.has(name)) return cb(null); held.add(name); try { return await cb({}); } finally { held.delete(name); } } };
  beginAttempt(s, "op-1", now, () => "ZOMBI");
  let sends = 0;
  const send = async () => { sends++; return { confirmed: false, reason: "timeout" }; };
  const r1 = await runSendAttempt({ storage: s, opId: "op-1", send, env: { locks }, now: clock, idGen: () => "N1" });
  assert.deepEqual([r1.ran, r1.reason, sends], [false, "busy", 0]);
  now += SEND_STALE_MS + 1;
  const r2 = await runSendAttempt({ storage: s, opId: "op-1", send, env: { locks }, now: clock, idGen: () => "N2" });
  assert.deepEqual([r2.ran, r2.takeover, sends], [true, true, 1]);
  assert.equal(finishAttempt(s, "op-1", "ZOMBI", { confirmed: true }, now).applied, false, "la respuesta tardia del zombi no pisa nada");
  assert.equal(readAttemptState(s, "op-1").failCount, 1);
});

await t("runSendAttempt: una confirmacion quita el elemento aunque el intento ya no sea el vigente (confirmar es un hecho)", async () => {
  const s = store(); kItem(s, mk("op-1"));
  const r = await runSendAttempt({ storage: s, opId: "op-1", env: { locks: null }, now: () => 1, idGen: () => "A", send: async () => { beginAttempt(s, "op-1", 2, () => "B"); return { confirmed: true }; } });
  assert.equal(r.outcome.confirmed, true); assert.deepEqual(keyedIds(s), []); assert.equal(s.getItem(PQ_STATE_PREFIX + "op-1"), null);
  assert.ok(PQ_DONE_PREFIX + "op-1" in Object.fromEntries([...s._m.entries()].map(([k, v]) => [k, v])));
});

// ───────── integracion con la cola existente ─────────
await t("flush: elementos SOLO por clave se envian con su opId, se quitan con marca de confirmada y no tocan el arreglo", async () => {
  const s = store(); kItem(s, mk("op-1")); kItem(s, mk("op-2"));            // sin arreglo
  const seen = [];
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async (it) => { seen.push(it.opId); return it.opId === "op-1" ? [{ id: 1 }] : null; } });
  assert.deepEqual(seen.sort(), ["op-1", "op-2"]); assert.deepEqual([r.sent, r.failed], [1, 1]);
  assert.deepEqual(keyedIds(s), ["op-2"]); assert.ok(PQ_DONE_PREFIX + "op-1" in Object.fromEntries(s._m));
  assert.equal(s.getItem(LEGACY_QUEUE_KEY), null, "el flush no escribe nada en el arreglo");
});

await t("flush: mixto (arreglo + clave), mismo opId en ambos -> se envia UNA vez y se quita de los dos lados", async () => {
  const s = store(); arr(s, [mk("op-1"), mk("op-2")]); kItem(s, mk("op-1")); kItem(s, mk("op-3"));
  const seen = [];
  await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async (it) => { seen.push(it.opId); return [{ id: 1 }]; } });
  assert.deepEqual(seen.sort(), ["op-1", "op-2", "op-3"]);
  assert.equal(readQueue(s).items.length, 0); assert.deepEqual(keyedIds(s), []);
  assert.deepEqual(readAllPending(s).items, []);
});

await t("flush: elementos de otro alumno por clave quedan intactos; el conteo visible es de este alumno", async () => {
  const s = store(); kItem(s, mk("op-1")); kItem(s, mk("op-9", { alumno_id: "B" }));
  assert.equal(visiblePendingItems(s, "A").length, 1);
  await flushPendingForAlumno({ storage: s, alumnoId: "A", send: ok });
  assert.deepEqual(keyedIds(s), ["op-9"]);
});

await t("flush: arreglo corrupto -> se omite todo (comportamiento anterior) y no se pierde nada", async () => {
  const s = store({ [LEGACY_QUEUE_KEY]: "{roto" }); kItem(s, mk("op-1"));
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: ok });
  assert.equal(r.skipped, "corrupt"); assert.deepEqual(keyedIds(s), ["op-1"]); assert.equal(s.getItem(LEGACY_QUEUE_KEY), "{roto");
});

await t("flush: solo el arreglo -> mismo resultado que antes (no escribe marcas ni claves nuevas)", async () => {
  const s = store(); enqueueItem(s, mk("op-1")); enqueueItem(s, mk("op-2"));
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async (it) => (it.opId === "op-1" ? [{ id: 1 }] : null) });
  assert.deepEqual([r.sent, r.failed], [1, 1]); assert.deepEqual(readQueue(s).items.map((i) => i.opId), ["op-2"]);
  assert.deepEqual([...s._m.keys()].filter((k) => k !== LEGACY_QUEUE_KEY), [], "no aparece ninguna clave nueva");
});

await t("cerrar sesion: clearAllIronTrackPrefixedKeys conserva arreglo, respaldos y claves por clave; includePending las borra", () => {
  const s = store({ it_session: "x", it_pg: "y", it_u: "z" }); arr(s, [mk("op-1")]); kItem(s, mk("op-2")); s.setItem(PQ_STATE_PREFIX + "op-2", "{}"); s.setItem(PQ_DONE_PREFIX + "op-3", "{}"); s.setItem("it_pending_sync_corrupto_1", "x");
  globalThis.localStorage = s;
  clearAllIronTrackPrefixedKeys();
  assert.deepEqual([...s._m.keys()].sort(), [LEGACY_QUEUE_KEY, "it_pending_sync_corrupto_1", PQ_DONE_PREFIX + "op-3", PQ_ITEM_PREFIX + "op-2", PQ_STATE_PREFIX + "op-2"].sort());
  clearAllIronTrackPrefixedKeys({ includePending: true });
  assert.equal(s._m.size, 0); delete globalThis.localStorage;
});

await t("cableado estatico: SettingsPage usa isPendingQueueKey; la escritura de logSet sigue yendo al arreglo (enqueueItem) y no al formato por clave", () => {
  const sp = readFileSync(new URL("../components/settings/SettingsPage.jsx", import.meta.url), "utf8");
  assert.ok(sp.includes("isPendingQueueKey(k)") && sp.includes("lib/pendingQueueKeyed.js"));
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("enqueueItem(localStorage, buildPendingProgressItem("), "logSet sigue encolando en el arreglo");
  for (const fn of ["adoptLegacyArray", "removeConfirmedKeyed", "runSendAttempt", "beginAttempt", "withSendLock"]) assert.ok(!app.includes(fn), fn + " no esta conectado a App.jsx en 0a");
  const q = readFileSync(new URL("../lib/pendingSyncQueue.js", import.meta.url), "utf8");
  assert.ok(!q.includes("adoptLegacyArray"), "la adopcion por clave no se ejecuta en produccion en 0a");
  assert.equal((q.match(/removeConfirmedKeyed\(/g) || []).length, 1, "solo el flush quita elementos por clave");
});

// ───────── Revision del PR #96: serie confirmada presente a la vez en el arreglo y en it_pq:, y limpieza de marcas a los 14 dias ─────────
const DAY = 24 * 3600 * 1000;

await t("REGRESION 1: una serie confirmada que sigue (o vuelve) en el arreglo NO reaparece despues de gcDoneMarks a los 14 dias", async () => {
  const s = store(); const it = mk("op-1"); arr(s, [it]); adoptLegacyArray(s, readQueue(s).items);       // vive en el arreglo Y por clave
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: ok });                          // se confirma: se quita de los dos lados + marca
  assert.equal(r.sent, 1); assert.deepEqual(readAllPending(s).items, []);
  arr(s, [it]);                                                                                           // pestaña con codigo antiguo reescribe el arreglo desde una lectura vieja: "resucita" en el arreglo
  assert.deepEqual(readAllPending(s).items, [], "hoy esta oculta por la marca");
  const doneAt = Number(readDoneMap(s)["op-1"]);
  gcDoneMarks(s, doneAt + 15 * DAY);                                                                      // pasan 15 dias: la marca vence
  assert.deepEqual(readAllPending(s).items, [], "REAPARECE si la marca se borra mientras el arreglo aun contiene la serie");
});

await t("REGRESION 2: la marca de confirmada NO se borra mientras el arreglo aun contiene ese opId; se borra cuando ya no esta", () => {
  const s = store(); arr(s, [mk("op-1")]); s.setItem(PQ_DONE_PREFIX + "op-1", JSON.stringify({ at: 0 }));
  assert.equal(gcDoneMarks(s, 20 * DAY), 0); assert.ok("op-1" in readDoneMap(s), "se conserva");
  arr(s, []); assert.equal(gcDoneMarks(s, 20 * DAY), 1); assert.deepEqual(readDoneMap(s), {});
});

await t("REGRESION 3: con el arreglo corrupto o ilegible no se borra ninguna marca (no se sabe que contiene)", () => {
  const s = store({ [LEGACY_QUEUE_KEY]: "{roto" }); s.setItem(PQ_DONE_PREFIX + "op-1", JSON.stringify({ at: 0 }));
  assert.equal(gcDoneMarks(s, 20 * DAY), 0); assert.ok("op-1" in readDoneMap(s));
});

await t("REGRESION 4: al vencer la marca se retira tambien la copia por clave ya confirmada (no queda basura ni se vuelve a mostrar)", () => {
  const s = store(); kItem(s, mk("op-1")); s.setItem(PQ_STATE_PREFIX + "op-1", "{}"); s.setItem(PQ_DONE_PREFIX + "op-1", JSON.stringify({ at: 0 }));
  assert.equal(gcDoneMarks(s, 20 * DAY), 1);
  assert.deepEqual([...s._m.keys()], [], "ni elemento, ni estado, ni marca");
  assert.deepEqual(readAllPending(s).items, []);
});

await t("REGRESION 5: la adopcion posterior a un GC no re-crea una serie confirmada que sigue en el arreglo (la marca la protege hasta que el arreglo la suelte)", () => {
  const s = store(); const it = mk("op-1"); arr(s, [it]); adoptLegacyArray(s, [it]); removeConfirmedKeyed(s, "op-1", 0);
  assert.equal(gcDoneMarks(s, 30 * DAY), 0, "el arreglo aun la contiene: la marca queda");
  const r = adoptLegacyArray(s, readQueue(s).items); assert.deepEqual([r.adopted, r.skippedDone], [0, 1]);
  assert.deepEqual(readAllPending(s).items, []);
});

await t("REGRESION 6: el flush retira del arreglo las copias ocultas por una marca (ya confirmadas), con o sin elementos pendientes, y sin tocar lo demas", async () => {
  const s = store(); s.setItem(PQ_DONE_PREFIX + "op-1", JSON.stringify({ at: 5 }));
  arr(s, [mk("op-1"), mk("op-2"), { exId: "sq", kg: 1, reps: 1, date: "d", semana: 1 }, mk("op-9", { alumno_id: "B" })]);
  const seen = [];
  const r = await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async (it) => { seen.push(it.opId); return null; } });     // el envio de op-2 falla
  assert.ok(!seen.includes("op-1"), "la copia oculta (ya confirmada) no se envia"); assert.ok(seen.includes("op-2")); assert.equal(r.sent, 0);
  const left = readQueue(s).items.map((i) => i.opId);
  assert.equal(left.length, 3, "quedan: op-2, op-9 (otro alumno) y el elemento antiguo que la adopcion existente ya identifico");
  assert.ok(left.includes("op-2") && left.includes("op-9") && !left.includes("op-1"), "solo se retiro la copia ya confirmada");
  assert.ok(left.filter((x) => x !== "op-2" && x !== "op-9").every((x) => /^[0-9a-f-]{36}$/.test(x)), "el elemento antiguo conserva su contenido con un opId asignado como antes");
  // y tambien cuando no hay nada pendiente para este alumno
  const s2 = store(); s2.setItem(PQ_DONE_PREFIX + "op-1", JSON.stringify({ at: 5 })); arr(s2, [mk("op-1")]);
  await flushPendingForAlumno({ storage: s2, alumnoId: "A", send: ok });
  assert.equal(s2.getItem(LEGACY_QUEUE_KEY), null, "queda vacio");
});

await t("REGRESION 7: con solo el arreglo (produccion hoy) el flush no hace ninguna escritura extra por la limpieza de copias ocultas", async () => {
  const s = store(); enqueueItem(s, mk("op-1")); enqueueItem(s, mk("op-2"));
  const writes = []; const ss = s.setItem.bind(s), rr = s.removeItem.bind(s);
  s.setItem = (k, v) => { writes.push("set " + k); ss(k, v); }; s.removeItem = (k) => { writes.push("rm " + k); rr(k); };
  await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async () => null });                    // nada se confirma
  assert.ok(writes.every((w) => w.endsWith(LEGACY_QUEUE_KEY)), "solo toca el arreglo: " + writes.join(", "));
});

await t("REGRESION 8 (punto 2): adoptLegacyArray NO se ejecuta desde el flujo normal de la aplicacion — ni App.jsx, ni components, ni hooks, ni lib (salvo su definicion)", () => {
    const roots = ["App.jsx", "components", "hooks", "lib", "contexts", "utils"];
  const hits = [];
  const walk = (p) => {
    let st; try { st = statSync(new URL("../" + p, import.meta.url)); } catch (e) { return; }
    if (st.isDirectory()) { readdirSync(new URL("../" + p + "/", import.meta.url)).forEach((f) => walk(p + "/" + f)); return; }
    if (!/\.(jsx?|mjs)$/.test(p)) return;
    if (readFileSync(new URL("../" + p, import.meta.url), "utf8").includes("adoptLegacyArray") && p !== "lib/pendingQueueKeyed.js") hits.push(p);
  };
  roots.forEach(walk);
  assert.deepEqual(hits, [], "adoptLegacyArray solo se usa en pruebas en 0a: " + hits.join(", "));
});

await t("REGRESION 9 (punto 2): las rutas de lectura y de flush con solo el arreglo no crean ninguna clave it_pq:/it_pqf:/it_pqd:", async () => {
  const s = store(); enqueueItem(s, mk("op-1")); enqueueItem(s, mk("op-2")); enqueueItem(s, { exId: "sq", kg: 5, reps: 5, date: "d", semana: 1 });
  visiblePendingItems(s, "A"); readAllPending(s);
  await flushPendingForAlumno({ storage: s, alumnoId: "A", send: async (it) => (it.opId === "op-1" ? [{ id: 1 }] : null) });
  await flushPendingForAlumno({ storage: s, alumnoId: "A", send: ok });
  assert.deepEqual([...s._m.keys()].filter((k) => k !== LEGACY_QUEUE_KEY), [], "ninguna clave nueva");
});

console.log(`${n} comprobaciones OK`);
