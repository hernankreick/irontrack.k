// Pruebas de seguridad de la cola ANTIGUA `it_pending_sync` (P0 Etapa 1A, correccion 2):
// ninguna serie de identidad desconocida o ajena se envia con el alumno_id de la sesion actual.
//
//   node scripts/test-legacyQueueSafety.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { flushLegacyPendingQueue, partitionLegacyPending, removeOnceEach } from "../lib/legacyPendingFlush.js";
import { buildPendingProgressItem } from "../lib/workoutSession.js";
import {
  clearAllIronTrackPrefixedKeys,
  clearIronTrackStorageForNewLogin,
  preserveLegacyPendingQueue,
} from "../lib/irontrackLocalStorage.js";
import { createPendingSets, PENDING_LEGACY_KEY } from "../lib/pendingSets.js";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const QUAR = "it_pending_sync_legacy:";
const ITEM = "it_pending_sync:item:";

function makeStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  const s = {
    get length() { return m.size; },
    key(i) { const ks = [...m.keys()]; return i < ks.length ? ks[i] : null; },
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) {
      if (s.failWriteMatching && s.failWriteMatching(k)) throw new Error("QuotaExceededError " + k);
      m.set(k, String(v));
    },
    removeItem(k) { m.delete(k); },
    _map: m,
    failWriteMatching: null,
  };
  return s;
}
function useStorage(initial) { const st = makeStorage(initial); globalThis.localStorage = st; return st; }
const keysOf = (st, prefix) => [...st._map.keys()].filter((k) => k.indexOf(prefix) === 0);
const unknown = (exId, kg) => ({ exId, kg, reps: 10, note: "", date: "1/10/2026", semana: 0 });
const stamped = (owner, exId, kg) => Object.assign(unknown(exId, kg), { alumno_id: owner });

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
let count = 0;
const failures = [];

// ── flusher ────────────────────────────────────────────────────────────────
test("flusher: serie sin alumno_id NO se envia con la sesion actual y se conserva", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60)]) });
  const sent = [];
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0);
  assert.equal(out.withheldUnknown, 1);
  assert.equal(JSON.parse(st.getItem(PENDING_LEGACY_KEY)).length, 1);
});
test("flusher: serie estampada con A no se envia en sesion de B", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([stamped(A, "dl", 100)]) });
  const sent = [];
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0);
  assert.equal(out.withheldForeign, 1);
  assert.equal(JSON.parse(st.getItem(PENDING_LEGACY_KEY)).length, 1);
});
test("flusher: serie propia se envia con el alumno_id de la SERIE y se quita; el resto se conserva", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60), stamped(A, "dl", 100), stamped(B, "row", 40)]) });
  const sent = [];
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].alumno_id, B);
  assert.equal(sent[0].ejercicio_id, "row");
  assert.equal(out.sent, 1);
  assert.equal(JSON.parse(st.getItem(PENDING_LEGACY_KEY)).length, 2);
});
test("flusher: sin sesion no envia nada", async () => {
  useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([stamped(A, "dl", 100)]) });
  let n = 0;
  const out = await flushLegacyPendingQueue({ alumnoId: "", send: async () => { n++; return [{}]; } });
  assert.equal(n, 0);
  assert.equal(out.reason, "no_identity");
});
test("flusher: fallo de envio conserva la serie", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([stamped(B, "row", 40)]) });
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: async () => null });
  assert.equal(out.sent, 0);
  assert.equal(JSON.parse(st.getItem(PENDING_LEGACY_KEY)).length, 1);
});
test("flusher: series identicas propias se quitan una vez cada una; lo agregado por otra pestana se conserva", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([stamped(B, "row", 40), stamped(B, "row", 40)]) });
  const extra = stamped(B, "sq", 80);
  let added = false;
  const out = await flushLegacyPendingQueue({
    alumnoId: B,
    send: async () => {
      if (added) return [{}];
      added = true;
      const cur = JSON.parse(st.getItem(PENDING_LEGACY_KEY));
      cur.push(extra);
      st.setItem(PENDING_LEGACY_KEY, JSON.stringify(cur));
      return [{}];
    },
  });
  assert.equal(out.sent, 2);
  assert.deepEqual(JSON.parse(st.getItem(PENDING_LEGACY_KEY)), [extra]);
});
test("flusher: array ilegible o no-array no se toca", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: "{no json" });
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: async () => [{}] });
  assert.equal(out.status, "skipped");
  assert.equal(st.getItem(PENDING_LEGACY_KEY), "{no json");
  st.setItem(PENDING_LEGACY_KEY, JSON.stringify({ a: 1 }));
  await flushLegacyPendingQueue({ alumnoId: B, send: async () => [{}] });
  assert.equal(st.getItem(PENDING_LEGACY_KEY), JSON.stringify({ a: 1 }));
});
test("partition y removeOnceEach", () => {
  const p = partitionLegacyPending([unknown("a", 1), stamped(A, "b", 2), stamped(B, "c", 3), null, 5], B);
  assert.equal(p.unknown.length, 3);
  assert.equal(p.foreign.length, 1);
  assert.equal(p.eligible.length, 1);
  assert.deepEqual(removeOnceEach([1, 1, 2], [1]), [1, 2]);
});
test("buildPendingProgressItem estampa alumno_id solo si se indica", () => {
  assert.equal(buildPendingProgressItem("bp", 60, 10, "", "1/10/2026", 0, B).alumno_id, B);
  assert.equal("alumno_id" in buildPendingProgressItem("bp", 60, 10, "", "1/10/2026", 0), false);
});

// ── escenarios de migracion ────────────────────────────────────────────────
test("1. migracion OK: sin id -> cuarentena, con id -> cola nueva, array retirado", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60), stamped(A, "dl", 100)]) });
  assert.equal(preserveLegacyPendingQueue().status, "migrated");
  assert.equal(st.getItem(PENDING_LEGACY_KEY), null);
  assert.equal(keysOf(st, QUAR).length, 1);
  assert.equal(keysOf(st, ITEM).length, 1);
  assert.equal(JSON.parse(st.getItem(keysOf(st, ITEM)[0])).alumno_id, A);
});
test("2. migracion interrumpida: se reanuda sin perder ni duplicar y sin atribuir cuarentena", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60), stamped(A, "dl", 100)]) });
  let writes = 0;
  st.failWriteMatching = () => ++writes > 2; // corta tras el diario y la primera escritura
  const r = preserveLegacyPendingQueue();
  assert.notEqual(r.status, "migrated");
  st.failWriteMatching = null;
  assert.equal(r.status === "backed_up" || r.status === "kept", true);
  // el array original sigue o hay respaldo literal: nunca se pierde
  const raws = keysOf(st, "it_pending_sync_raw:");
  assert.equal(st.getItem(PENDING_LEGACY_KEY) !== null || raws.length > 0 || keysOf(st, "it_pending_sync:migration").length > 0, true);
  preserveLegacyPendingQueue();
  createPendingSets({ storage: st }).migrateSync();
  assert.equal(keysOf(st, ITEM).filter((k) => JSON.parse(st.getItem(k)).exId === "dl").length <= 1, true);
  assert.equal(keysOf(st, QUAR).length <= 1, true);
});
test("3. cuota llena: conserva los datos originales, nada se envia", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60), stamped(A, "dl", 100)]) });
  st.failWriteMatching = () => true;
  const r = preserveLegacyPendingQueue();
  assert.equal(r.status, "kept");
  const arr = JSON.parse(st.getItem(PENDING_LEGACY_KEY));
  assert.equal(arr.length, 2);
  const sent = [];
  await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0); // ni la desconocida ni la de A salen bajo B
});
test("3b. login con cuota llena: el array se conserva y se reintenta al liberar espacio", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60)]), it_session: "{}" });
  st.failWriteMatching = (k) => k !== "it_session";
  clearIronTrackStorageForNewLogin();
  assert.notEqual(st.getItem(PENDING_LEGACY_KEY), null);
  st.failWriteMatching = null;
  clearIronTrackStorageForNewLogin();
  assert.equal(st.getItem(PENDING_LEGACY_KEY), null);
  assert.equal(keysOf(st, QUAR).length, 1);
});
test("3c. login: la cuota se libera al limpiar it_session y el reintento traslada la cola en la misma llamada", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60)]), it_session: "{}" });
  st.failWriteMatching = () => true;
  const origRemove = st.removeItem.bind(st);
  st.removeItem = (k) => { origRemove(k); if (k === "it_session") st.failWriteMatching = null; };
  clearIronTrackStorageForNewLogin();
  assert.equal(st.getItem(PENDING_LEGACY_KEY), null);
  assert.equal(keysOf(st, QUAR).length, 1);
});
test("3d. logout: igual, el reintento tras liberar espacio conserva la serie", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([stamped(A, "dl", 100)]), it_session: "{}", it_pg: "x" });
  st.failWriteMatching = () => true;
  const origRemove = st.removeItem.bind(st);
  st.removeItem = (k) => { origRemove(k); if (k === "it_pg") st.failWriteMatching = null; };
  clearAllIronTrackPrefixedKeys();
  assert.equal(st.getItem(PENDING_LEGACY_KEY), null);
  assert.equal(keysOf(st, ITEM).length, 1);
});
test("4. pestana vieja agrega al array durante la migracion: no se pierde", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([stamped(A, "dl", 100)]) });
  const late = unknown("sq", 80);
  const ps = createPendingSets({ storage: st });
  let first = true;
  const r = preserveLegacyPendingQueue({
    storage: st,
    migrate: () => {
      const out = ps.migrateSync();
      if (first) { first = false; st.setItem(PENDING_LEGACY_KEY, JSON.stringify([late])); }
      return out;
    },
  });
  assert.equal(r.status, "migrated");
  assert.equal(keysOf(st, QUAR).some((k) => JSON.parse(st.getItem(k)).original.exId === "sq"), true);
});
test("5. dos pestanas migran a la vez: sin duplicados", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([stamped(A, "dl", 100), unknown("bp", 60)]) });
  preserveLegacyPendingQueue();
  preserveLegacyPendingQueue();
  assert.equal(keysOf(st, ITEM).length, 1);
  assert.equal(keysOf(st, QUAR).length, 1);
});
test("6. A cierra sesion y entra B: la serie de A no sale bajo B", async () => {
  const st = useStorage({ it_session: JSON.stringify({ alumnoId: A }), [PENDING_LEGACY_KEY]: JSON.stringify([stamped(A, "dl", 100), unknown("bp", 60)]) });
  clearAllIronTrackPrefixedKeys();
  st.setItem("it_session", JSON.stringify({ alumnoId: B }));
  const sent = [];
  await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0);
  assert.equal(keysOf(st, ITEM).filter((k) => JSON.parse(st.getItem(k)).alumno_id === A).length, 1);
  assert.equal(keysOf(st, QUAR).length, 1);
});
test("7. series antiguas identicas conservan multiplicidad", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60), unknown("bp", 60), unknown("bp", 60)]) });
  preserveLegacyPendingQueue();
  assert.equal(keysOf(st, QUAR).length, 3);
});
test("cuarentena nunca se atribuye ni se envia sola", async () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60)]) });
  preserveLegacyPendingQueue();
  const q = keysOf(st, QUAR)[0];
  const before = st.getItem(q);
  const sent = [];
  await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0);
  assert.equal(st.getItem(q), before);
  assert.equal("alumno_id" in JSON.parse(before).original, false);
});
test("respaldo literal: array modificado durante la copia no se retira", () => {
  const st = useStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([unknown("bp", 60)]) });
  const origSet = st.setItem.bind(st);
  st.setItem = (k, v) => {
    if (k.indexOf("it_pending_sync_raw:") === 0) origSet(PENDING_LEGACY_KEY, JSON.stringify([unknown("bp", 60), unknown("sq", 80)]));
    return origSet(k, v);
  };
  const r = preserveLegacyPendingQueue({ storage: st, migrate: () => { throw new Error("falla"); } });
  assert.equal(r.status, "kept");
  assert.equal(JSON.parse(st.getItem(PENDING_LEGACY_KEY)).length, 2);
});

// ── estructural: App.jsx usa el flusher seguro ─────────────────────────────
test("App.jsx: el vaciado antiguo usa flushLegacyPendingQueue y estampa alumno_id al encolar", () => {
  const app = readFileSync(join(ROOT, "App.jsx"), "utf8");
  assert.match(app, /flushLegacyPendingQueue[^;]*from '\.\/lib\/legacyPendingFlush\.js'/);
  const i = app.indexOf("const flushPendingSync");
  const body = app.slice(i, i + 1500);
  assert.match(body, /flushLegacyPendingQueue\(/);
  assert.equal(/buildProgressPayload\(alumnoIdSync/.test(body), false);
  assert.match(app, /buildPendingProgressItem\([^)]*alumnoIdSync\)/);
});

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
if (failures.length) { console.log(failures.length + " fallaron"); process.exit(1); }
