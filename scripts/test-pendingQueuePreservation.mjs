// Pruebas de la conservacion de series pendientes en S0.6 Fase 1 (lib/irontrackLocalStorage.js).
//
//   node scripts/test-pendingQueuePreservation.mjs
//
// El logout y el login nuevo ya NO borran las series pendientes. Compatible con la Etapa 1A: mismo prefijo `it_pending_sync`
// (isPendingSetsKey) y misma clave de copia literal `it_pending_sync_raw:<ts>`.

import assert from "node:assert/strict";
import {
  IRONTRACK_LOGIN_RESET_KEYS, PENDING_SYNC_PREFIX, PENDING_SYNC_RAW_PREFIX, isPendingSyncKey, preservePendingQueue,
  clearAllIronTrackPrefixedKeys, clearIronTrackStorageForNewLogin,
} from "../lib/irontrackLocalStorage.js";

let count = 0;
async function test(name, fn) { const prev = globalThis.localStorage; const st = makeStorage(); globalThis.localStorage = st; try { await fn(st); } finally { if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev; } count++; console.log("ok - " + name); }

function makeStorage() {
  const m = new Map();
  return {
    m,
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const U1 = "0b9e0d4a-0000-4000-8000-000000000001";
const raws = (st) => Array.from(st.m.keys()).filter((k) => k.indexOf(PENDING_SYNC_RAW_PREFIX) === 0);

// Claves del modulo de la Etapa 1A (lib/pendingSets.js) que deben sobrevivir tal cual
const KEYS_1A = [
  "it_pending_sync:item:" + U1, "it_pending_sync:meta:" + U1, "it_pending_sync_legacy:" + U1,
  "it_pending_sync:migration", "it_pending_sync:lease:flush", "it_pending_sync_raw:1700000000000",
];

await test("el login nuevo ya no incluye ninguna clave de series pendientes en su lista de borrado", () => {
  assert.equal(IRONTRACK_LOGIN_RESET_KEYS.some(isPendingSyncKey), false);
  assert.equal(PENDING_SYNC_PREFIX, "it_pending_sync");
  assert.equal(PENDING_SYNC_RAW_PREFIX, "it_pending_sync_raw:");
});

await test("logout: borra el resto de it_* pero conserva TODAS las claves it_pending_sync* (formato de la Etapa 1A incluido)", (st) => {
  st.setItem("it_session", "x"); st.setItem("it_rt", "x"); st.setItem("it_dark", "true"); st.setItem("otra_app", "keep");
  KEYS_1A.forEach((k) => st.setItem(k, "payload:" + k));
  clearAllIronTrackPrefixedKeys();
  ["it_session", "it_rt", "it_dark"].forEach((k) => assert.equal(st.getItem(k), null, k));
  assert.equal(st.getItem("otra_app"), "keep");
  KEYS_1A.forEach((k) => assert.equal(st.getItem(k), "payload:" + k, k));
});

await test("login nuevo: conserva las claves de series pendientes y borra la sesion anterior", (st) => {
  st.setItem("it_session", "x"); st.setItem("it_pg", "x");
  KEYS_1A.forEach((k) => st.setItem(k, "payload:" + k));
  clearIronTrackStorageForNewLogin();
  assert.equal(st.getItem("it_session"), null);
  assert.equal(st.getItem("it_pg"), null);
  KEYS_1A.forEach((k) => assert.equal(st.getItem(k), "payload:" + k, k));
});

await test("el array antiguo (sin dueño por serie) se traslada VERBATIM, rotulado con el alumno de la sesion, y deja de ser enviable", (st) => {
  const arr = JSON.stringify([{ ejercicio_id: "e1", kg: 60, reps: 5, nota: "ñ" }, { ejercicio_id: "e2", kg: 20, reps: 12 }]);
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: ID_A }));
  st.setItem("it_pending_sync", arr);
  assert.deepEqual(preservePendingQueue(), { status: "moved" });
  assert.equal(st.getItem("it_pending_sync"), null);
  const k = raws(st);
  assert.equal(k.length, 1);
  assert.ok(k[0].endsWith(":" + ID_A));
  assert.equal(st.getItem(k[0]), arr, "byte a byte");
  assert.deepEqual(preservePendingQueue(), { status: "none" });
});

await test("sin it_session el dueño queda 'desconocido' (no se atribuye a nadie); no hay cola -> nada que hacer", (st) => {
  assert.deepEqual(preservePendingQueue(), { status: "none" });
  st.setItem("it_pending_sync", "[1]");
  assert.deepEqual(preservePendingQueue(), { status: "moved" });
  assert.ok(raws(st)[0].endsWith(":desconocido"));
});

await test("aislamiento: A cierra sesion con series, B inicia sesion y cierra con las suyas; ninguna mezcla ni vuelve a ser enviable", (st) => {
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: ID_A }));
  st.setItem("it_pending_sync", JSON.stringify([{ ejercicio_id: "a", kg: 1 }]));
  clearAllIronTrackPrefixedKeys(); // logout de A
  clearIronTrackStorageForNewLogin(); // login de B
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: ID_B }));
  assert.equal(st.getItem("it_pending_sync"), null, "B no hereda un array de A");
  st.setItem("it_pending_sync", JSON.stringify([{ ejercicio_id: "b", kg: 2 }]));
  clearAllIronTrackPrefixedKeys(); // logout de B
  const k = raws(st);
  assert.equal(k.length, 2);
  const byOwner = Object.fromEntries(k.map((x) => [x.split(":").pop(), JSON.parse(st.getItem(x))[0].ejercicio_id]));
  assert.deepEqual(byOwner, { [ID_A]: "a", [ID_B]: "b" });
});

await test("si no hay espacio para copiar (cuota) el array queda INTACTO: nunca se borra una serie", (st) => {
  const arr = JSON.stringify([{ ejercicio_id: "e1", kg: 5 }]);
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: ID_A }));
  st.setItem("it_pending_sync", arr);
  const realSet = st.setItem;
  st.setItem = (k, v) => { if (k.indexOf(PENDING_SYNC_RAW_PREFIX) === 0) throw new Error("QuotaExceededError"); return realSet(k, v); };
  clearAllIronTrackPrefixedKeys();
  assert.equal(st.getItem("it_pending_sync"), arr);
  assert.equal(raws(st).length, 0);
  assert.deepEqual(preservePendingQueue(), { status: "kept" });
  // con espacio de nuevo se traslada
  st.setItem = realSet;
  assert.deepEqual(preservePendingQueue(), { status: "moved" });
});

await test("si otra pestaña modifica el array mientras se copia, el array NO se retira (esta respaldado y se reintenta)", (st) => {
  st.setItem("it_pending_sync", JSON.stringify([{ a: 1 }]));
  const realSet = st.setItem;
  st.setItem = (k, v) => { realSet(k, v); if (k.indexOf(PENDING_SYNC_RAW_PREFIX) === 0) realSet("it_pending_sync", JSON.stringify([{ a: 1 }, { a: 2 }])); };
  assert.deepEqual(preservePendingQueue(), { status: "kept" });
  assert.equal(JSON.parse(st.getItem("it_pending_sync")).length, 2, "la serie nueva de la otra pestaña no se pierde");
  assert.equal(raws(st).length, 1);
});

console.log("\n" + count + " tests ok");
