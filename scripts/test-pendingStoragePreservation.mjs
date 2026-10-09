// Pruebas de preservacion de las series pendientes frente a TODOS los flujos que limpian localStorage
// (P0 Etapa 1A): login, logout, cambio de alumno / reinicio de rutina, export y limpieza de sesion.
//
//   node scripts/test-pendingStoragePreservation.mjs
//
// Sale con codigo 0 si todo pasa; con codigo 1 si falla alguna prueba.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  IRONTRACK_LOGIN_RESET_KEYS,
  clearAllIronTrackPrefixedKeys,
  clearIronTrackStorageForNewLogin,
  clearRoutineLocalKeysForAlumno,
  collectExportableLocalData,
  preserveLegacyPendingQueue,
} from "../lib/irontrackLocalStorage.js";
import {
  createPendingSets,
  isPendingSetsKey,
  PENDING_LEGACY_KEY,
  FLUSH_STOP,
} from "../lib/pendingSets.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const RUTINA = "33333333-3333-4333-8333-333333333333";

function makeStorage(initial) {
  const m = new Map(Object.entries(initial || {}));
  const s = {
    get length() { return m.size; },
    key(i) { const ks = [...m.keys()]; return i < ks.length ? ks[i] : null; },
    getItem(k) { return m.has(k) ? m.get(k) : null; },
    setItem(k, v) {
      if (s.failWriteMatching && s.failWriteMatching(k)) throw new Error("boom " + k);
      m.set(k, String(v));
    },
    removeItem(k) { m.delete(k); },
    _map: m,
    failWriteMatching: null,
  };
  return s;
}

function installGlobalStorage(initial) {
  const st = makeStorage(initial);
  globalThis.localStorage = st;
  return st;
}

function fakeLocks() {
  const held = new Set();
  return {
    async request(name, options, cb) {
      if (held.has(name)) return options && options.ifAvailable ? cb(null) : Promise.reject(new Error("no queue"));
      held.add(name);
      try { return await cb({ name }); } finally { held.delete(name); }
    },
  };
}

const ITEM = "it_pending_sync:item:";
const META = "it_pending_sync:meta:";
const QUAR = "it_pending_sync_legacy:";

// Claves de series pendientes de TODOS los tipos que reconoce isPendingSetsKey
function pendingKeySet(extra) {
  const itemId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return Object.assign({
    [ITEM + itemId]: JSON.stringify({ v: 2, id: itemId, alumno_id: A, exId: "bp", kg: 60, reps: 10, note: "", date: "9/10/2026", semana: 0, createdLocal: 1 }),
    [META + itemId]: JSON.stringify({ status: "pending", attempts: 1, lastError: "http_500" }),
    [QUAR + "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"]: JSON.stringify({ v: 1, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", original: { exId: "sq" }, quarantinedAt: 1, reason: "sin_alumno_id", migrationId: "m", index: 0 }),
    "it_pending_sync:migration": JSON.stringify({ v: 1, id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", raw: "[]", ids: [], startedAt: 1 }),
    "it_pending_sync:lease:flush:x": JSON.stringify({ owner: "o", until: 9e15 }),
    "it_pending_sync_raw:123": "[{\"exId\":\"bp\"}]",
  }, extra || {});
}

const OTHER_IT = {
  it_session: JSON.stringify({ role: "alumno", alumnoId: A }),
  it_pg: "{}", it_rt: "[]", it_week: "2", it_cd: "[]", it_cex: "[]", it_customEx: "[]", it_u: "null",
  it_show_welcome: "1", it_pagos_estado: "{}", it_coach_negocio: "{}", it_last_week_advance_date: "x", it_biometric_user: "{}",
  it_onboard_done: "1", it_theme: "dark", it_lang: "es",
};
const NON_IT = { "sb-proyecto-auth-token": "{\"access_token\":\"xxx\"}", irontrack_sp_ach_seen: "[]" };

const pendingOnly = (st) => Object.fromEntries([...st._map.entries()].filter(([k]) => isPendingSetsKey(k)).sort(([a], [b]) => (a < b ? -1 : 1)));

let count = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ══ login ═══════════════════════════════════════════════════════════════════
test("login: TODAS las claves de series pendientes sobreviven intactas", () => {
  const st = installGlobalStorage({ ...pendingKeySet(), ...OTHER_IT, ...NON_IT });
  const before = pendingOnly(st);
  assert.ok(Object.keys(before).length >= 6);
  clearIronTrackStorageForNewLogin();
  assert.deepEqual(pendingOnly(st), before);
});

test("login: se limpian las claves de sesion pero no las de preferencias ni las ajenas a it_", () => {
  const st = installGlobalStorage({ ...pendingKeySet(), ...OTHER_IT, ...NON_IT });
  clearIronTrackStorageForNewLogin();
  for (const k of IRONTRACK_LOGIN_RESET_KEYS) assert.equal(st.getItem(k), null, k);
  assert.equal(st.getItem("it_onboard_done"), "1");
  assert.equal(st.getItem("it_theme"), "dark");
  assert.equal(st.getItem("sb-proyecto-auth-token"), NON_IT["sb-proyecto-auth-token"]);
});

test("login: la lista de claves a limpiar no contiene ninguna clave de series pendientes", () => {
  for (const k of IRONTRACK_LOGIN_RESET_KEYS) assert.equal(isPendingSetsKey(k), false, k);
  assert.equal(IRONTRACK_LOGIN_RESET_KEYS.includes(PENDING_LEGACY_KEY), false);
});

// ══ logout ══════════════════════════════════════════════════════════════════
test("logout: todas las claves de series pendientes sobreviven; el resto de it_* se borra", () => {
  const st = installGlobalStorage({ ...pendingKeySet(), ...OTHER_IT, ...NON_IT });
  const before = pendingOnly(st);
  clearAllIronTrackPrefixedKeys();
  assert.deepEqual(pendingOnly(st), before);
  for (const k of Object.keys(OTHER_IT)) assert.equal(st.getItem(k), null, k);
  assert.equal(st.getItem("sb-proyecto-auth-token"), NON_IT["sb-proyecto-auth-token"]); // fuera del alcance (D2 se hace despues)
});

test("logout repetido y login posterior no alteran las series pendientes (idempotente)", () => {
  const st = installGlobalStorage({ ...pendingKeySet(), ...OTHER_IT });
  const before = pendingOnly(st);
  clearAllIronTrackPrefixedKeys();
  clearIronTrackStorageForNewLogin();
  clearAllIronTrackPrefixedKeys();
  clearIronTrackStorageForNewLogin();
  assert.deepEqual(pendingOnly(st), before);
});

// ══ cambio de alumno / reinicio de rutina ═══════════════════════════════════
test("cambio de alumno: clearRoutineLocalKeysForAlumno no toca claves de series aunque contengan el id del alumno o de la rutina", () => {
  const adversarial = {
    ["it_pending_sync:item:" + RUTINA]: JSON.stringify({ id: RUTINA, alumno_id: A }), // la clave contiene el id de la rutina
    ["it_pending_sync:item:" + A.replace(/-/g, "").slice(0, 8) + "-" + A]: "x",         // y el id del alumno
    ["it_pending_sync_legacy:" + A]: "{}",
    ["it_pending_sync:meta:" + RUTINA]: "{}",
  };
  const st = installGlobalStorage({ ...pendingKeySet(), ...adversarial, ...OTHER_IT, ["it_algo_" + A]: "x", ["it_otra_" + RUTINA]: "y", it_ajena: "z" });
  const before = pendingOnly(st);
  clearRoutineLocalKeysForAlumno(A, RUTINA);
  assert.deepEqual(pendingOnly(st), before);
  assert.equal(st.getItem("it_algo_" + A), null); // lo no protegido que menciona al alumno/rutina si se limpia
  assert.equal(st.getItem("it_otra_" + RUTINA), null);
  assert.equal(st.getItem("it_ajena"), "z");
  assert.equal(st.getItem("it_last_week_advance_date"), null);
});

test("cambio de alumno: A cierra sesion, B inicia sesion -> B no ve ni envia las series de A; A las conserva", async () => {
  const st = installGlobalStorage({ ...OTHER_IT });
  const locks = fakeLocks();
  const ps = createPendingSets({ storage: st, locks });
  const a1 = ps.enqueue({ alumnoId: A, exId: "bp", kg: 60, reps: 10, date: "9/10/2026", semana: 0 });
  const a2 = ps.enqueue({ alumnoId: A, exId: "bp", kg: 60, reps: 10, date: "9/10/2026", semana: 0 }); // identica
  clearAllIronTrackPrefixedKeys();            // logout de A
  clearIronTrackStorageForNewLogin();         // login de B
  const psB = createPendingSets({ storage: st, locks });
  assert.equal(psB.count(B), 0);
  const sent = [];
  const out = await psB.flush({ alumnoId: B, send: async (p) => { sent.push(p); return { status: 201, body: [{ id: p.id }] }; } });
  assert.deepEqual(sent, []);
  assert.equal(out.stopped, FLUSH_STOP.NONE);
  assert.deepEqual(psB.list(A).map((i) => i.id).sort(), [a1.id, a2.id].sort()); // A sigue intacto
  // A vuelve y sincroniza lo suyo
  const outA = await createPendingSets({ storage: st, locks }).flush({ alumnoId: A, send: async (p) => ({ status: 201, body: [{ id: p.id }] }) });
  assert.equal(outA.confirmed.length, 2);
});

// ══ cola antigua (array) ════════════════════════════════════════════════════
const LEG1 = { exId: "bp", kg: 60, reps: 10, note: "", date: "1/10/2026", semana: 0 };
const LEG2 = { exId: "sq", kg: 80, reps: 5, note: "x", date: "2/10/2026", semana: 0 };

test("cola antigua: en login se traslada a cuarentena SIN modificarla y deja de ser un array flusheable", () => {
  const st = installGlobalStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([LEG1, LEG2]), ...OTHER_IT });
  clearIronTrackStorageForNewLogin();
  assert.equal(st.getItem(PENDING_LEGACY_KEY), null);
  const q = createPendingSets({ storage: st }).listQuarantine();
  assert.deepEqual(q.map((e) => e.original), [LEG1, LEG2]);
});

test("cola antigua: en logout tambien se conserva (cuarentena), con registros identicos por separado", () => {
  const st = installGlobalStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([LEG1, LEG1, LEG2]), ...OTHER_IT });
  clearAllIronTrackPrefixedKeys();
  assert.equal(st.getItem(PENDING_LEGACY_KEY), null);
  const q = createPendingSets({ storage: st }).listQuarantine();
  assert.equal(q.length, 3);
  assert.equal(new Set(q.map((e) => e.id)).size, 3);
});

test("cola antigua + cola nueva conviven: ambas se preservan y la antigua nunca se asigna a otro alumno", async () => {
  const st = installGlobalStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([LEG1]), ...OTHER_IT });
  const locks = fakeLocks();
  const ps = createPendingSets({ storage: st, locks });
  const mine = ps.enqueue({ alumnoId: A, exId: "dl", kg: 100, reps: 3, date: "9/10/2026", semana: 0 });
  clearAllIronTrackPrefixedKeys();
  clearIronTrackStorageForNewLogin();
  const sent = [];
  await createPendingSets({ storage: st, locks }).flush({ alumnoId: B, send: async (p) => { sent.push(p); return {}; } });
  assert.deepEqual(sent, []);
  assert.deepEqual(ps.list(A).map((i) => i.id), [mine.id]);
  assert.equal(ps.listQuarantine().length, 1);
});

test("cola antigua: si la migracion falla se copia tal cual a una clave no flusheable y se retira el array", () => {
  const raw = JSON.stringify([LEG1, LEG2]);
  const st = installGlobalStorage({ [PENDING_LEGACY_KEY]: raw });
  const r = preserveLegacyPendingQueue({ storage: st, migrate: () => { throw new Error("sin crypto"); } });
  assert.equal(r.status, "backed_up");
  assert.equal(st.getItem(PENDING_LEGACY_KEY), null);
  const backups = [...st._map.keys()].filter((k) => k.startsWith("it_pending_sync_raw:"));
  assert.equal(backups.length, 1);
  assert.equal(st.getItem(backups[0]), raw);
  assert.equal(isPendingSetsKey(backups[0]), true);
});

test("cola antigua: si ni siquiera se puede respaldar, el array queda INTACTO (nunca se pierde)", () => {
  const raw = JSON.stringify([LEG1]);
  const st = installGlobalStorage({ [PENDING_LEGACY_KEY]: raw });
  st.failWriteMatching = () => true;
  const r = preserveLegacyPendingQueue({ storage: st, migrate: () => { throw new Error("cuota"); } });
  assert.equal(r.status, "kept");
  assert.equal(st.getItem(PENDING_LEGACY_KEY), raw);
});

test("cola antigua: migracion reanudable tras un corte (la cola vieja sigue ahi y se completa en el siguiente login)", () => {
  const st = installGlobalStorage({ [PENDING_LEGACY_KEY]: JSON.stringify([LEG1, LEG2]) });
  let writes = 0;
  const realSet = st.setItem.bind(st);
  st.setItem = (k, v) => { if (++writes === 2) throw new Error("corte"); realSet(k, v); };
  clearIronTrackStorageForNewLogin(); // la migracion se corta; cae al respaldo literal o deja el array
  const hasLegacyOrBackup = st.getItem(PENDING_LEGACY_KEY) !== null || [...st._map.keys()].some((k) => k.startsWith("it_pending_sync_raw:") || k.startsWith("it_pending_sync_legacy:") || k === "it_pending_sync:migration");
  assert.ok(hasLegacyOrBackup, "no puede perderse ningun registro");
  st.setItem = realSet;
  clearIronTrackStorageForNewLogin();
  const q = createPendingSets({ storage: st }).listQuarantine();
  const raws = [...st._map.keys()].filter((k) => k.startsWith("it_pending_sync_raw:"));
  assert.ok(q.length === 2 || raws.length >= 1, "los dos registros siguen disponibles (cuarentena o copia literal)");
});

test("sin cola antigua no se escribe nada", () => {
  const st = installGlobalStorage({ ...OTHER_IT });
  const before = JSON.stringify([...st._map.entries()]);
  assert.equal(preserveLegacyPendingQueue({ storage: st }).status, "none");
  assert.equal(JSON.stringify([...st._map.entries()]), before);
});

// ══ export ══════════════════════════════════════════════════════════════════
test("export: incluye las preferencias it_* pero EXCLUYE todas las series pendientes (pueden ser de otros alumnos)", () => {
  const st = installGlobalStorage({ ...pendingKeySet(), ...OTHER_IT, ...NON_IT });
  const data = collectExportableLocalData(st);
  assert.ok("it_theme" in data && "it_onboard_done" in data);
  assert.equal(Object.keys(data).some(isPendingSetsKey), false);
  assert.equal("sb-proyecto-auth-token" in data, false);
});

// ══ guardia de codigo ═══════════════════════════════════════════════════════
const ROOT = fileURLToPath(new URL("..", import.meta.url));
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

test("guardia: ningun codigo de la app borra claves it_* por su cuenta (solo lib/irontrackLocalStorage.js)", () => {
  const allowed = new Set(["lib/irontrackLocalStorage.js", "lib/pendingSets.js"]);
  const sources = ["App.jsx", "main.jsx"].map((f) => join(ROOT, f))
    .concat(walk(join(ROOT, "components"), []), walk(join(ROOT, "hooks"), []), walk(join(ROOT, "contexts"), []), walk(join(ROOT, "lib"), []));
  const offenders = [];
  for (const file of sources) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (allowed.has(rel)) continue;
    const text = readFileSync(file, "utf8");
    if (/localStorage\.clear\s*\(/.test(text)) offenders.push(rel + ": localStorage.clear()");
    if (/Object\.keys\(\s*localStorage\s*\)/.test(text)) offenders.push(rel + ": Object.keys(localStorage)");
    if (/localStorage\.key\(\s*\w+\s*\)/.test(text) && /removeItem/.test(text)) offenders.push(rel + ": recorre localStorage.key(i) y borra");
    if (/it_pending_sync/.test(text) && /removeItem\(\s*['"]it_pending_sync['"]/.test(text) && rel !== "App.jsx") offenders.push(rel + ": borra it_pending_sync");
  }
  assert.deepEqual(offenders, []);
});

test("guardia: App.jsx y SettingsPage.jsx usan los ayudantes protegidos", () => {
  const app = readFileSync(join(ROOT, "App.jsx"), "utf8");
  const settings = readFileSync(join(ROOT, "components/settings/SettingsPage.jsx"), "utf8");
  assert.match(app, /clearRoutineLocalKeysForAlumno[^;]*from '\.\/lib\/irontrackLocalStorage\.js'/);
  assert.equal(/function clearRoutineLocalKeysForAlumno/.test(app), false);
  assert.match(settings, /clearAllIronTrackPrefixedKeys\(\)/);
  assert.match(settings, /collectExportableLocalData\(\)/);
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
if (failures.length) {
  console.log(failures.length + " fallaron");
  process.exit(1);
}
