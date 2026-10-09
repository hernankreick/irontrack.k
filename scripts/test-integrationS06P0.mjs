// Pruebas de INTEGRACION S0.6 Fase 1 + Etapa 1A (rama integration/s06-p0-stage-1a).
//
//   node scripts/test-integrationS06P0.mjs
//
// Verifican las resoluciones de conflicto contra el codigo real y los escenarios que cruzan ambas ramas: logout offline con token
// residual, cola antigua, cambio de alumno y enlaces compartidos de solo lectura. Sin red: SDK real con fetch simulado.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createSharedReadOnlyFetch, isSharedReadOnlyMode } from "../lib/sharedMode.js";
import { createResidualTokenGuardFetch } from "../lib/residualTokenGuard.js";
import { LOGOUT_PENDING_KEY, performLogout, completePendingLogout, clearLogoutPending, isLogoutPending, _resetSessionLogoutForTests } from "../lib/sessionLogout.js";
import { createRestAuthResolver } from "../lib/restAuth.js";
import { flushLegacyPendingQueue } from "../lib/legacyPendingFlush.js";
import { clearAllIronTrackPrefixedKeys, clearIronTrackStorageForNewLogin, preserveLegacyPendingQueue } from "../lib/irontrackLocalStorage.js";
import { createPendingSets, isPendingSetsKey } from "../lib/pendingSets.js";
import * as storageMod from "../lib/irontrackLocalStorage.js";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const require = createRequire(import.meta.url);
const { GoTrueClient } = require("@supabase/auth-js");

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UA = "11111111-1111-4111-8111-111111111111";
const KEY = "it_pending_sync";
const AUTH_KEY = "sb-test-auth-token";
const ANON = "anon-key-test";
const NOW = () => Math.floor(Date.now() / 1000);

let count = 0;
async function test(name, fn) {
  _resetSessionLogoutForTests();
  const prevLS = globalThis.localStorage, prevWin = globalThis.window;
  const st = makeStorage();
  globalThis.localStorage = st;
  delete globalThis.window;
  try { await fn(st); } finally {
    if (prevLS === undefined) delete globalThis.localStorage; else globalThis.localStorage = prevLS;
    if (prevWin === undefined) delete globalThis.window; else globalThis.window = prevWin;
  }
  count++; console.log("ok - " + name);
}
const silence = console.error; console.error = () => {}; const warnFn = console.warn; console.warn = () => {};

function makeStorage() {
  const m = new Map();
  return {
    m,
    failWrites: false,
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (this.failWrites) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
const asShared = () => { globalThis.window = { location: { search: "?r=" + Buffer.from(JSON.stringify({ alumnoId: A })).toString("base64") } }; };
const item = (owner, exId, kg) => Object.assign({ exId, kg, reps: 10, note: "", date: "1/10/2026", semana: 0 }, owner ? { alumno_id: owner } : {});
const keysWith = (st, prefix) => Array.from(st.m.keys()).filter((k) => k.indexOf(prefix) === 0);
function authSession(uid, exp) {
  return { access_token: "at-" + uid.slice(0, 4), refresh_token: "rt", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: uid, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "x" } };
}
function makeNet(mode) {
  const net = { mode, calls: [] };
  net.fetch = async (url, init) => { net.calls.push({ url: String(url), method: init && init.method, auth: new Headers((init && init.headers) || undefined).get("authorization") }); if (net.mode === "offline") throw new TypeError("Failed to fetch"); return new Response(null, { status: 204 }); };
  return net;
}

// ── 1. Resoluciones de conflicto contra el codigo real ───────────────────────────────────────────────────

await test("sin marcadores de conflicto en ningun archivo versionado de codigo", () => {
  const bad = [];
  (function walk(dir) {
    for (const f of readdirSync(join(ROOT, dir))) {
      if (["node_modules", ".git", ".chrome-headless", "dist"].includes(f)) continue;
      const rel = dir ? dir + "/" + f : f;
      const full = join(ROOT, rel);
      if (statSync(full).isDirectory()) { walk(rel); continue; }
      if (!/\.(jsx?|mjs|cjs|ts|md|json)$/.test(f)) continue;
      if (/^(<<<<<<<|>>>>>>>) /m.test(readFileSync(full, "utf8"))) bad.push(rel);
    }
  })("");
  assert.deepEqual(bad, []);
});

await test("un solo mecanismo de preservacion: el de 1A. No existen preservePendingQueue / isPendingSyncKey de la Fase 1", () => {
  assert.equal(typeof storageMod.preserveLegacyPendingQueue, "function");
  assert.equal(typeof storageMod.collectExportableLocalData, "function");
  assert.equal(storageMod.preservePendingQueue, undefined);
  assert.equal(storageMod.isPendingSyncKey, undefined);
  const all = ["App.jsx", "components/settings/SettingsPage.jsx", "lib/irontrackLocalStorage.js", "lib/sessionLogout.js", "lib/restAuth.js"].map(read).join("\n");
  assert.ok(!/preservePendingQueue|isPendingSyncKey|PENDING_SYNC_PREFIX/.test(all));
  const login = storageMod.IRONTRACK_LOGIN_RESET_KEYS;
  assert.equal(login.some(isPendingSetsKey), false);
});

await test("legacyPendingFlush es el de 1A (importa PENDING_LEGACY_KEY de pendingSets) y App lo importa una sola vez", () => {
  assert.ok(/import \{ PENDING_LEGACY_KEY \} from "\.\/pendingSets\.js";/.test(read("lib/legacyPendingFlush.js")));
  const app = read("App.jsx");
  assert.equal((app.match(/import \{ flushLegacyPendingQueue \}/g) || []).length, 1);
  assert.equal((app.match(/flushLegacyPendingQueue\(\{/g) || []).length, 1, "un unico vaciado de la cola antigua");
  assert.ok(/buildPendingProgressItem\(exId, kg, reps, note, d, weekForSet, alumnoIdSync\)/.test(app));
});

await test("Ajustes: logout central de S0.6 con la limpieza protegida de 1A; exportacion de 1A", () => {
  const s = read("components/settings/SettingsPage.jsx");
  assert.ok(/import \{ performLogout \} from '\.\.\/\.\.\/lib\/sessionLogout\.js';/.test(s));
  assert.ok(/import \{ clearAllIronTrackPrefixedKeys, collectExportableLocalData \}/.test(s));
  assert.ok(/clearLocal: clearAllIronTrackPrefixedKeys/.test(s) && /collectExportableLocalData\(\)/.test(s));
  assert.ok(!/supabase\.auth\.signOut\(/.test(s) && !/startsWith\('it_'\)/.test(s));
});

await test("App: el guard de solo lectura de 1A va ANTES del resolutor de credenciales en sbFetch; ningun fallback a la anon key", () => {
  const app = read("App.jsx");
  const body = app.slice(app.indexOf("const sbFetch = async"), app.indexOf("const sbFetchStrict"));
  assert.ok(body.indexOf("isSharedReadOnlyMode() && isWriteMethod(method)") > 0);
  assert.ok(body.indexOf("isSharedReadOnlyMode() && isWriteMethod(method)") < body.indexOf("await resolveRestToken(path, method)"));
  assert.equal(app.split("\n").filter((l) => /access_token\s*\?[^:]*:\s*SB_KEY/.test(l)).length, 0);
  const strict = app.slice(app.indexOf("const sbFetchStrict"), app.indexOf("const sb = {"));
  assert.ok(/await resolveRestToken\(path, "GET"\)/.test(strict) && /throw new AuthRequiredError/.test(strict), "la variante estricta de 1A tambien usa el resolutor");
  assert.ok(/guardSharedWrites\(sb\);/.test(app));
});

await test("el marcador de logout pendiente no es una clave de cola ni empieza con it_ (ninguna limpieza ni proteccion lo toca)", () => {
  assert.equal(isPendingSetsKey(LOGOUT_PENDING_KEY), false);
  assert.equal(LOGOUT_PENDING_KEY.indexOf("it_"), -1);
});

// ── 2. Logout offline + token residual: cliente supabase-js ──────────────────────────────────────────────

function guardedFetch(net) { return createResidualTokenGuardFetch(createSharedReadOnlyFetch(net.fetch), { anonKey: ANON }); }

await test("fetch del SDK con logout pendiente: /rest, /functions y /storage responden 401 sin red; /auth/v1 pasa con su token", async (st) => {
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, authUid: UA }));
  const net = makeNet("ok"); const f = guardedFetch(net);
  for (const [method, path] of [["GET", "/rest/v1/progreso"], ["POST", "/rest/v1/progreso"], ["PATCH", "/rest/v1/alumnos"], ["DELETE", "/rest/v1/sesiones"], ["POST", "/functions/v1/update-alumno-password"], ["POST", "/storage/v1/object/fotos/x"], ["GET", "/storage/v1/object/fotos/x"]]) {
    const r = await f("https://x.supabase.co" + path, { method, headers: { Authorization: "Bearer residual", apikey: ANON } });
    assert.equal(r.status, 401, method + " " + path);
    assert.equal(r.headers.get("X-IronTrack-Blocked"), "logout-pending");
  }
  assert.equal(net.calls.length, 0, "ni una solicitud salio a la red");
  const r2 = await f("https://x.supabase.co/auth/v1/logout?scope=local", { method: "POST", headers: { Authorization: "Bearer residual" } });
  assert.equal(r2.status, 204);
  assert.equal(net.calls.length, 1);
  assert.equal(net.calls[0].auth, "Bearer residual", "signOut conserva el token (lo necesita para revocar la sesion)");
});

await test("fetch del SDK sin logout pendiente: transparente (no cambia Authorization ni bloquea lecturas ni escrituras)", async () => {
  const net = makeNet("ok"); const f = guardedFetch(net);
  await f("https://x.supabase.co/rest/v1/progreso", { method: "POST", headers: { Authorization: "Bearer vivo" } });
  await f("https://x.supabase.co/rest/v1/progreso", { method: "GET", headers: { Authorization: "Bearer vivo" } });
  assert.deepEqual(net.calls.map((c) => c.auth), ["Bearer vivo", "Bearer vivo"]);
});

await test("enlace compartido + logout pendiente: la lectura sale como ANONIMA (nunca con el token residual); toda escritura sigue bloqueada (403)", async (st) => {
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, authUid: UA }));
  asShared();
  assert.equal(isSharedReadOnlyMode(), true);
  const net = makeNet("ok"); const f = guardedFetch(net);
  await f("https://x.supabase.co/rest/v1/sesiones?alumno_id=eq.1", { method: "GET", headers: new Headers({ Authorization: "Bearer residual", apikey: ANON }) });
  assert.equal(net.calls.length, 1);
  const sent = net.calls[0];
  assert.equal(sent.auth, "Bearer " + ANON, "la lectura sale con la anon key, no con el token residual");
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const r = await f("https://x.supabase.co/rest/v1/progreso", { method, headers: { Authorization: "Bearer residual" } });
    assert.ok(r.status === 401 || r.status === 403, method);
  }
  assert.equal(net.calls.length, 1, "ninguna escritura salio");
});

await test("cliente supabase-js REAL con sesion residual + logout pendiente: from().select() no sale a la red; en enlace compartido sale anonimo", async (st) => {
  st.setItem(AUTH_KEY, JSON.stringify(authSession(UA, NOW() + 3600)));
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, authUid: UA }));
  const net = makeNet("ok");
  net.fetch = async (url, init) => { net.calls.push({ url: String(url), method: init && init.method, auth: new Headers(init && init.headers).get("authorization") }); return new Response("[]", { status: 200, headers: { "content-type": "application/json" } }); };
  const client = createClient("https://x.supabase.co", ANON, {
    auth: { storage: st, storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createResidualTokenGuardFetch(createSharedReadOnlyFetch(net.fetch), { anonKey: ANON }) },
  });
  assert.ok((await client.auth.getSession()).data.session, "el SDK conserva el token residual");
  const r1 = await client.from("progreso").select("*");
  assert.ok(r1.error, "la lectura privada falla");
  assert.equal(net.calls.filter((c) => c.url.includes("/rest/v1/")).length, 0, "no salio ninguna solicitud REST");
  const w1 = await client.from("progreso").insert({ x: 1 });
  assert.ok(w1.error);
  assert.equal(net.calls.filter((c) => c.url.includes("/rest/v1/")).length, 0);
  // enlace compartido: lectura anonima
  asShared();
  const r2 = await client.from("rutinas").select("*").eq("alumno_id", A);
  assert.equal(r2.error, null);
  const rest = net.calls.filter((c) => c.url.includes("/rest/v1/"));
  assert.equal(rest.length, 1);
  assert.equal(rest[0].auth, "Bearer " + ANON, "Authorization = anon key, no el token residual");
  const w2 = await client.from("progreso").insert({ x: 1 });
  assert.ok(w2.error);
  assert.equal(net.calls.filter((c) => c.url.includes("/rest/v1/")).length, 1, "la escritura del enlace compartido sigue bloqueada");
  // logout completo: el cierre de Auth conserva su token
  delete globalThis.window;
  const out = await completePendingLogout({ client, storage: st, timeoutMs: 500, locks: null });
  assert.equal(out.status, "completed");
  assert.ok(net.calls.some((c) => c.url.includes("/auth/v1/logout")));
});

await test("resolutor REST propio: con marcador y enlace compartido solo lecturas anonimas; sin marcador ni sesion nada privado sale como anon", async (st) => {
  st.setItem(AUTH_KEY, JSON.stringify(authSession(UA, NOW() + 3600)));
  const net = makeNet("ok");
  const auth = new GoTrueClient({ url: "http://auth.test", headers: {}, storageKey: AUTH_KEY, storage: st, persistSession: true, autoRefreshToken: false, fetch: net.fetch });
  const mk = (search) => createRestAuthResolver({ client: { auth }, storage: st, anonKey: ANON, getSearch: () => search });
  assert.equal((await mk("").resolve("progreso", "POST")).token, "at-1111");
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, authUid: UA }));
  assert.equal((await mk("").resolve("progreso", "GET")).ok, false);
  const shared = await mk("?r=abc").resolve("sesiones?alumno_id=eq.1", "GET");
  assert.deepEqual([shared.ok, shared.kind, shared.token], [true, "anon", ANON]);
  assert.equal((await mk("?r=abc").resolve("sesiones", "POST")).ok, false);
});

// ── 3. Cola antigua, cambio de alumno y series existentes ────────────────────────────────────────────────

await test("series existentes: tras logout de A, login de B y logout de B no se pierde NINGUN registro (cola nueva + cuarentena), y nada es enviable bajo B", async (st) => {
  const initial = [item(A, "e1", 1), item(A, "e2", 2), item(null, "e3", 3), item(B, "e4", 4), item(A, "e1", 1)];
  st.setItem(KEY, JSON.stringify(initial));
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: A }));
  clearAllIronTrackPrefixedKeys(); // logout de A
  clearIronTrackStorageForNewLogin(); // login de B
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: B }));
  const ps = createPendingSets({ storage: st, locks: null });
  const sent = [];
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0, "el vaciado antiguo no tiene nada que enviar: el array ya no existe");
  assert.equal(out.reason, "empty");
  clearAllIronTrackPrefixedKeys(); // logout de B
  const total = ps.list(A).length + ps.list(B).length + ps.listQuarantine().length;
  assert.equal(total, initial.length, "ni una serie perdida ni duplicada");
  assert.deepEqual([ps.list(A).length, ps.list(B).length, ps.listQuarantine().length], [3, 1, 1]);
});

await test("preservacion fallida (cuota llena): el array queda intacto y la barrera impide enviarlo bajo otro alumno", async (st) => {
  const initial = [item(A, "e1", 1), item(null, "e3", 3)];
  const raw = JSON.stringify(initial);
  st.setItem(KEY, raw);
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: A }));
  st.failWrites = true;
  assert.doesNotThrow(() => clearAllIronTrackPrefixedKeys());
  assert.doesNotThrow(() => clearIronTrackStorageForNewLogin());
  assert.equal(st.getItem(KEY), raw, "datos originales intactos");
  const sent = [];
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0);
  assert.deepEqual([out.withheldForeign, out.withheldUnknown], [1, 1]);
  assert.equal(st.getItem(KEY), raw);
  st.failWrites = false;
  assert.notEqual(preserveLegacyPendingQueue().status, "kept", "al liberarse el espacio 1A completa la preservacion");
});

await test("logout offline: el cierre de Auth pendiente y la preservacion de 1A conviven; completar el logout no toca la cola; reconexion", async (st) => {
  st.setItem(AUTH_KEY, JSON.stringify(authSession(UA, NOW() + 3600)));
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: A, authUid: UA }));
  st.setItem(KEY, JSON.stringify([item(A, "e1", 1), item(null, "e3", 3)]));
  const netOff = makeNet("offline");
  const auth = new GoTrueClient({ url: "http://auth.test", headers: {}, storageKey: AUTH_KEY, storage: st, persistSession: true, autoRefreshToken: false, fetch: netOff.fetch });
  const res = await performLogout({ client: { auth }, storage: st, clearLocal: clearAllIronTrackPrefixedKeys, timeoutMs: 300, locks: null });
  assert.equal(res.remote.status, "pending");
  assert.ok(isLogoutPending(st));
  const snapshot = () => JSON.stringify(Array.from(st.m.entries()).filter(([k]) => isPendingSetsKey(k)).sort());
  const before = snapshot();
  assert.ok(keysWith(st, "it_pending_sync").length >= 2);
  // reconexion
  _resetSessionLogoutForTests();
  const netOn = makeNet("ok");
  const auth2 = new GoTrueClient({ url: "http://auth.test", headers: {}, storageKey: AUTH_KEY, storage: st, persistSession: true, autoRefreshToken: false, fetch: netOn.fetch });
  assert.equal((await completePendingLogout({ client: { auth: auth2 }, storage: st, timeoutMs: 300, locks: null })).status, "completed");
  assert.equal(isLogoutPending(st), false);
  assert.equal(snapshot(), before, "completar el logout no modifica ni una clave de la cola");
  clearLogoutPending(st);
});

await test("dos pestanas: una con el array antiguo reescrito durante la preservacion no pierde series (1A) y la barrera sigue vigente", async (st) => {
  st.setItem(KEY, JSON.stringify([item(A, "e1", 1)]));
  const realSet = st.setItem;
  let injected = false;
  st.setItem = function (k, v) {
    realSet.call(this, k, v);
    // otra pestana (codigo viejo) agrega una serie al array justo cuando 1A empieza a copiarlo
    if (!injected && k.indexOf("it_pending_sync") === 0 && k !== KEY) { injected = true; realSet.call(this, KEY, JSON.stringify([item(A, "e1", 1), item(A, "e9", 9)])); }
  };
  clearAllIronTrackPrefixedKeys();
  st.setItem = realSet;
  const ps = createPendingSets({ storage: st, locks: null });
  const present = ps.list(A).length + ps.listQuarantine().length + (st.getItem(KEY) ? JSON.parse(st.getItem(KEY)).length : 0);
  assert.ok(present >= 2, "las dos series siguen presentes (en cola nueva, cuarentena o array): " + present);
  const sent = [];
  await flushLegacyPendingQueue({ alumnoId: B, send: async (p) => { sent.push(p); return [{}]; } });
  assert.equal(sent.length, 0, "ninguna sale bajo B");
});

console.error = silence; console.warn = warnFn;
console.log("\n" + count + " tests ok");
process.exit(0);
