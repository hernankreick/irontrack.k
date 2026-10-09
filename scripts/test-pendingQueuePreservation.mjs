// Conservacion de series pendientes en S0.6 Fase 1 (lib/irontrackLocalStorage.js).
//
//   node scripts/test-pendingQueuePreservation.mjs
//
// Logout y login nuevo NO tocan ninguna clave `it_pending_sync*` (ni la borran ni la reescriben ni la mueven): lo que impide que
// salgan bajo otro alumno es la barrera por serie (scripts/test-legacyFlushBarrier.mjs). Compatible con el prefijo de la Etapa 1A.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IRONTRACK_LOGIN_RESET_KEYS, PENDING_SYNC_PREFIX, isPendingSyncKey, clearAllIronTrackPrefixedKeys, clearIronTrackStorageForNewLogin,
} from "../lib/irontrackLocalStorage.js";

let count = 0;
async function test(name, fn) { const prev = globalThis.localStorage; const st = makeStorage(); globalThis.localStorage = st; try { await fn(st); } finally { if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev; } count++; console.log("ok - " + name); }

function makeStorage() {
  const m = new Map();
  return {
    m,
    writes: [],
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { this.writes.push(k); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const U1 = "0b9e0d4a-0000-4000-8000-000000000001";
// Claves del modulo de la Etapa 1A (lib/pendingSets.js) y la cola actual: deben sobrevivir tal cual
const PENDING_KEYS = [
  "it_pending_sync", "it_pending_sync:item:" + U1, "it_pending_sync:meta:" + U1, "it_pending_sync_legacy:" + U1,
  "it_pending_sync:migration", "it_pending_sync:lease:flush", "it_pending_sync_raw:1700000000000",
];

await test("el login nuevo no incluye ninguna clave de series pendientes en su lista de borrado; mismo prefijo que 1A", () => {
  assert.equal(IRONTRACK_LOGIN_RESET_KEYS.some(isPendingSyncKey), false);
  assert.equal(PENDING_SYNC_PREFIX, "it_pending_sync");
  assert.equal(isPendingSyncKey("it_pending_sync:item:x"), true);
  assert.equal(isPendingSyncKey("it_pg"), false);
});

await test("logout: borra el resto de it_* pero conserva TODAS las claves it_pending_sync* sin modificarlas", (st) => {
  st.setItem("it_session", "x"); st.setItem("it_rt", "x"); st.setItem("it_dark", "true"); st.setItem("otra_app", "keep");
  PENDING_KEYS.forEach((k) => st.setItem(k, "payload:" + k));
  st.writes.length = 0;
  clearAllIronTrackPrefixedKeys();
  ["it_session", "it_rt", "it_dark"].forEach((k) => assert.equal(st.getItem(k), null, k));
  assert.equal(st.getItem("otra_app"), "keep");
  PENDING_KEYS.forEach((k) => assert.equal(st.getItem(k), "payload:" + k, k));
  assert.deepEqual(st.writes, [], "ninguna escritura: logout no reescribe ni mueve la cola");
});

await test("login nuevo: conserva las series pendientes sin modificarlas y borra la sesion anterior", (st) => {
  st.setItem("it_session", "x"); st.setItem("it_pg", "x");
  PENDING_KEYS.forEach((k) => st.setItem(k, "payload:" + k));
  st.writes.length = 0;
  clearIronTrackStorageForNewLogin();
  assert.equal(st.getItem("it_session"), null);
  assert.equal(st.getItem("it_pg"), null);
  PENDING_KEYS.forEach((k) => assert.equal(st.getItem(k), "payload:" + k, k));
  assert.deepEqual(st.writes, []);
});

await test("cuota llena: logout y login no escriben, no lanzan y la cola queda byte a byte igual", (st) => {
  const arr = JSON.stringify([{ exId: "e1", kg: 5, alumno_id: "A" }, { exId: "e2", kg: 7 }]);
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: "A" }));
  st.setItem("it_pending_sync", arr);
  st.setItem = () => { throw new Error("QuotaExceededError"); }; // todo setItem falla desde ahora
  assert.doesNotThrow(() => clearAllIronTrackPrefixedKeys());
  assert.doesNotThrow(() => clearIronTrackStorageForNewLogin());
  assert.equal(st.getItem("it_pending_sync"), arr);
});

await test("cableado: la exportacion de datos excluye las series pendientes (pueden ser de otros alumnos)", () => {
  const settings = readFileSync(new URL("../components/settings/SettingsPage.jsx", import.meta.url), "utf8");
  assert.ok(/startsWith\('it_'\) && !isPendingSyncKey\(k\)/.test(settings));
});

console.log("\n" + count + " tests ok");
