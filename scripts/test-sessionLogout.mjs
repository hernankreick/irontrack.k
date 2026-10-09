// Pruebas de lib/sessionLogout.js (S0.6 Fase 1): logout central de alumnos y manejo del logout pendiente.
//
//   node scripts/test-sessionLogout.mjs
//
// Usa el GoTrueClient REAL de @supabase/auth-js (el instalado) con un almacenamiento en memoria compartido y un fetch simulado:
// no hay red ni se toca ningun proyecto Supabase.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  LOGOUT_PENDING_KEY, beginLogout, completePendingLogout, performLogout, isLogoutPending, readLogoutPending,
  clearLogoutPending, enforceLogoutPending, _resetSessionLogoutForTests,
} from "../lib/sessionLogout.js";
import { restoreStudentSession, shouldSkipEntrenadorUpsert } from "../lib/studentIdentity.js";
import { decideRestAuth } from "../lib/restAuth.js";

const require = createRequire(import.meta.url);
const { GoTrueClient } = require("@supabase/auth-js");

let count = 0;
async function test(name, fn) { _resetSessionLogoutForTests(); await fn(); count++; console.log("ok - " + name); }
const silence = console.error; const warn = console.warn;
console.error = () => {}; console.warn = () => {};

const UID_A = "11111111-1111-4111-8111-111111111111";
const UID_B = "22222222-2222-4222-8222-222222222222";
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AUTH_KEY = "sb-test-auth-token";
const NOW = () => Math.floor(Date.now() / 1000);

// localStorage en memoria (con length/key para clearAllIronTrackPrefixedKeys)
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

function authSession(uid, expiresAt) {
  return {
    access_token: "at-" + uid.slice(0, 4), refresh_token: "rt-" + uid.slice(0, 4), token_type: "bearer", expires_in: 3600,
    expires_at: expiresAt, user: { id: uid, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
}

// Red simulada. mode: "ok" | "offline" | "http500" | "http401" | "hang" | "refresh400"
function makeNet(mode) {
  const net = { mode: mode || "ok", calls: [], events: [] };
  net.fetch = async (url, init) => {
    net.calls.push({ url: String(url), method: init && init.method, auth: init && init.headers && (init.headers.Authorization || init.headers.authorization) });
    if (net.mode === "offline") throw new TypeError("Failed to fetch");
    if (net.mode === "hang") return new Promise(() => {});
    if (net.mode === "http500") return new Response("boom", { status: 500 });
    if (net.mode === "http401") return new Response(JSON.stringify({ msg: "bad jwt" }), { status: 401, headers: { "content-type": "application/json" } });
    if (net.mode === "refresh400") return new Response(JSON.stringify({ error: "invalid_grant", error_description: "Invalid Refresh Token" }), { status: 400, headers: { "content-type": "application/json" } });
    return new Response(null, { status: 204 });
  };
  return net;
}

// "Pestana": un GoTrueClient real sobre el almacenamiento compartido. Devuelve el cliente con la forma que usa la app.
function makeTab(storage, net) {
  const auth = new GoTrueClient({ url: "http://auth.test", headers: {}, storageKey: AUTH_KEY, storage, persistSession: true, autoRefreshToken: false, fetch: net.fetch });
  auth.onAuthStateChange((e) => { net.events.push(e); });
  return { auth };
}

function seedStudent(storage, uid, alumnoId, expiresAt) {
  storage.setItem(AUTH_KEY, JSON.stringify(authSession(uid, expiresAt != null ? expiresAt : NOW() + 3600)));
  storage.setItem("it_session", JSON.stringify({ role: "alumno", name: "Alumno", alumnoId, entrenadorId: "e1", authUid: uid }));
  storage.setItem("it_rt", JSON.stringify([{ id: "r1" }]));
  storage.setItem("it_pg", JSON.stringify({ ex1: { sets: [] } }));
  storage.setItem("it_biometric_user", JSON.stringify({ role: "alumno", alumnoId }));
  storage.setItem("it_onboard_done", "1");
}

async function withGlobalStorage(storage, fn) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = storage;
  try { return await fn(); } finally { if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev; }
}

const { clearAllIronTrackPrefixedKeys, clearIronTrackStorageForNewLogin } = await import("../lib/irontrackLocalStorage.js");
const rawKeys = (st) => Array.from(st.m.keys()).filter((k) => k.indexOf("it_pending_sync_raw:") === 0);
const authSessionPresent = (st) => st.getItem(AUTH_KEY) !== null;

function logoutDeps(storage, net, extra) {
  const tab = makeTab(storage, net);
  return Object.assign({ client: tab, storage, clearLocal: clearAllIronTrackPrefixedKeys, timeoutMs: 400, locks: null }, extra || {});
}

// ── 1. Logout online ────────────────────────────────────────────────────────────────────────────────────

await test("logout ONLINE: acceso local invalidado antes de la red, signOut(local) correcto, marcador limpio, series conservadas", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  const net = makeNet("ok");
  seedStudent(st, UID_A, ID_A);
  st.setItem("it_pending_sync", JSON.stringify([{ ejercicio_id: "ex1", kg: 50, reps: 5 }]));
  const order = [];
  const deps = logoutDeps(st, net, { onLocalInvalidated: () => order.push("ui:" + (st.getItem("it_session") === null ? "sin-sesion" : "CON-SESION") + "/net=" + net.calls.length) });
  const res = await performLogout(deps);

  assert.deepEqual(order, ["ui:sin-sesion/net=0"], "la UI se invalida de forma sincronica, antes de cualquier llamada de red");
  assert.equal(res.remote.status, "completed");
  assert.equal(isLogoutPending(st), false);
  assert.equal(authSessionPresent(st), false, "la sesion Auth fue cerrada por el SDK (sin tocar sus claves a mano)");
  assert.ok(net.events.includes("SIGNED_OUT"));
  const logoutCall = net.calls.find((c) => c.url.indexOf("/logout") >= 0);
  assert.ok(logoutCall && logoutCall.url.indexOf("scope=local") >= 0, "cierra SOLO este dispositivo");
  assert.ok(/Bearer at-1111/.test(logoutCall.auth || ""), "con el token del propio alumno");
  // Todo it_* de acceso fuera; la cola de series conservada (rotulada con su alumno) y no como array enviable
  ["it_session", "it_rt", "it_pg", "it_biometric_user", "it_onboard_done"].forEach((k) => assert.equal(st.getItem(k), null, k));
  assert.equal(st.getItem("it_pending_sync"), null, "el array enviable ya no existe");
  const kept = rawKeys(st);
  assert.equal(kept.length, 1);
  assert.ok(kept[0].endsWith(":" + ID_A), "rotulada con el alumno dueño");
  assert.equal(JSON.parse(st.getItem(kept[0]))[0].kg, 50);
}));

// ── 2. Logout offline / 3. Recarga / 4. Reconexion ──────────────────────────────────────────────────────

await test("logout OFFLINE: acceso invalidado, marcador pendiente, ninguna restauracion posible, token residual sin uso", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  const net = makeNet("offline");
  seedStudent(st, UID_A, ID_A);
  const deps = logoutDeps(st, net);
  const res = await performLogout(deps);

  assert.equal(res.remote.status, "pending");
  assert.equal(isLogoutPending(st), true);
  assert.equal(readLogoutPending(st).authUid, UID_A);
  assert.equal(st.getItem("it_session"), null);
  assert.equal(st.getItem("it_biometric_user"), null);
  // El SDK no puede cerrar sin red: la sesion Auth sigue (se demuestra, no se borra a mano) ...
  assert.equal(authSessionPresent(st), true);
  // ... pero nada la usa: la restauracion se niega y /rest no usa el token
  const stored = { role: "alumno", alumnoId: ID_A };
  const r = await restoreStudentSession(deps.client, stored, st);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "logout_pending");
  assert.deepEqual(decideRestAuth({ session: { access_token: "x" }, method: "GET", path: "progreso?x", sharedLink: false, logoutPending: isLogoutPending(st) }), { ok: false, reason: "logout_pending" });
}));

await test("recarga tras logout offline: el marcador sobrevive, aunque reaparezca it_session no hay acceso, y el arranque lo reintenta", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A);
  await performLogout(logoutDeps(st, makeNet("offline")));
  assert.equal(isLogoutPending(st), true);

  // "Recarga": estado de modulo nuevo, cliente nuevo; cierre interrumpido simulado con un it_session que reaparece
  _resetSessionLogoutForTests();
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: ID_A, authUid: UID_A }));
  assert.equal(enforceLogoutPending(st), true, "el arranque quita el acceso local ANTES de leer el estado inicial");
  assert.equal(st.getItem("it_session"), null);
  const net2 = makeNet("offline");
  const deps2 = logoutDeps(st, net2);
  assert.equal((await restoreStudentSession(deps2.client, { role: "alumno", alumnoId: ID_A }, st)).reason, "logout_pending");
  assert.equal((await completePendingLogout(deps2)).status, "pending", "sigue sin red: no se pierde el marcador");
  assert.equal(isLogoutPending(st), true);
}));

await test("reconexion: el logout pendiente se completa una vez, cierra Auth, limpia el marcador y es idempotente", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A);
  await performLogout(logoutDeps(st, makeNet("offline")));
  _resetSessionLogoutForTests();

  const net = makeNet("ok");
  const deps = logoutDeps(st, net);
  const r1 = await completePendingLogout(deps);
  assert.equal(r1.status, "completed");
  assert.equal(isLogoutPending(st), false);
  assert.equal(authSessionPresent(st), false);
  assert.equal(net.calls.filter((c) => c.url.indexOf("/logout") >= 0).length, 1);
  assert.equal((await completePendingLogout(deps)).status, "none");
  assert.equal(net.calls.filter((c) => c.url.indexOf("/logout") >= 0).length, 1, "no repite el signOut");
}));

await test("reconexion con servidor degradado: 5xx deja el marcador y reintenta; 401 (sesion ya invalida) lo completa", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A);
  await performLogout(logoutDeps(st, makeNet("offline")));
  _resetSessionLogoutForTests();
  const r500 = await completePendingLogout(logoutDeps(st, makeNet("http500")));
  assert.equal(r500.status, "pending");
  assert.equal(isLogoutPending(st), true);
  assert.equal(authSessionPresent(st), true);
  _resetSessionLogoutForTests();
  const r401 = await completePendingLogout(logoutDeps(st, makeNet("http401")));
  assert.equal(r401.status, "completed");
  assert.equal(isLogoutPending(st), false);
  assert.equal(authSessionPresent(st), false);
}));

await test("sin bloqueo permanente: signOut colgado termina por timeout; un login nuevo reemplaza el marcador", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A);
  await performLogout(logoutDeps(st, makeNet("offline")));
  _resetSessionLogoutForTests();
  const t0 = Date.now();
  const rh = await completePendingLogout(logoutDeps(st, makeNet("hang"), { timeoutMs: 60 }));
  assert.equal(rh.status, "pending");
  assert.ok(Date.now() - t0 < 1500, "el timeout acota la espera");

  // Login nuevo exitoso: la app borra el marcador y la restauracion vuelve a estar permitida
  clearLogoutPending(st);
  assert.equal(isLogoutPending(st), false);
  const client = { auth: { async getSession() { return { data: { session: { user: { id: UID_B } } }, error: null }; },
    from: null } };
  client.from = () => ({ select: () => ({ eq: async () => ({ data: [{ id: ID_B, nombre: "B", entrenador_id: "e1", auth_uid: UID_B }], error: null }) }) });
  const ok = await restoreStudentSession(client, { role: "alumno", alumnoId: ID_B }, st);
  assert.equal(ok.ok, true);
}));

await test("marcador fail-closed: valor ilegible cuenta como pendiente; sin cliente queda pendiente; las limpiezas it_* no lo borran", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  st.setItem(LOGOUT_PENDING_KEY, "{no json");
  assert.equal(isLogoutPending(st), true);
  assert.equal(readLogoutPending(st).corrupt, true);
  assert.equal((await completePendingLogout({ client: null, storage: st, locks: null })).reason, "no_client");
  clearAllIronTrackPrefixedKeys();
  clearIronTrackStorageForNewLogin();
  assert.equal(isLogoutPending(st), true, "ni el logout ni el login nuevo borran el marcador (no empieza con it_)");
  assert.equal(LOGOUT_PENDING_KEY.indexOf("it_"), -1);
}));

await test("beginLogout: si el marcador no cabe (cuota) igual invalida el acceso y reintenta tras liberar espacio", async () => {
  const st = makeStorage();
  seedStudent(st, UID_A, ID_A);
  let full = true;
  const realSet = st.setItem;
  st.setItem = (k, v) => { if (k === LOGOUT_PENDING_KEY && full) throw new Error("QuotaExceededError"); return realSet(k, v); };
  const r = beginLogout({ storage: st, clearLocal: () => { full = false; st.removeItem("it_rt"); } });
  assert.equal(st.getItem("it_session"), null);
  assert.equal(st.getItem("it_biometric_user"), null);
  assert.equal(r.marked, true, "reintento tras clearLocal");
  assert.equal(isLogoutPending(st), true);
});

// ── 5. Cambio de alumno ─────────────────────────────────────────────────────────────────────────────────

await test("cambio de alumno: las series de A quedan rotuladas con A, B no las hereda ni las puede enviar", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A);
  st.setItem("it_pending_sync", JSON.stringify([{ ejercicio_id: "ex1", kg: 80, reps: 3 }]));
  await performLogout(logoutDeps(st, makeNet("offline")));
  // B inicia sesion (online): completion best-effort (falla), login OK, marcador reemplazado, limpieza de login
  _resetSessionLogoutForTests();
  await completePendingLogout(logoutDeps(st, makeNet("offline")));
  clearIronTrackStorageForNewLogin();
  clearLogoutPending(st);
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: ID_B, authUid: UID_B }));
  assert.equal(st.getItem("it_pending_sync"), null, "B no encuentra un array que el vaciado antiguo enviaria bajo su id");
  const kept = rawKeys(st);
  assert.equal(kept.length, 1);
  assert.ok(kept[0].endsWith(":" + ID_A));
  assert.equal(JSON.parse(st.getItem(kept[0]))[0].kg, 80);
  // Un logout posterior de B no mezcla ni borra lo de A
  st.setItem("it_pending_sync", JSON.stringify([{ ejercicio_id: "ex9", kg: 20, reps: 10 }]));
  await performLogout(logoutDeps(st, makeNet("ok")));
  const after = rawKeys(st);
  assert.equal(after.length, 2);
  assert.ok(after.some((k) => k.endsWith(":" + ID_A)) && after.some((k) => k.endsWith(":" + ID_B)));
}));

// ── 6. Dos pestanas ─────────────────────────────────────────────────────────────────────────────────────

await test("dos pestanas: el logout de una invalida a la otra; solo una completa signOut (Web Locks); la otra queda 'busy'", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A);
  // Pestana A cierra sin red
  await performLogout(logoutDeps(st, makeNet("offline")));
  // Pestana B (mismo almacenamiento): ve el marcador -> sin acceso, sin restauracion
  _resetSessionLogoutForTests();
  const netB = makeNet("ok");
  const tabB = logoutDeps(st, netB);
  assert.equal(isLogoutPending(st), true);
  assert.equal((await restoreStudentSession(tabB.client, { role: "alumno", alumnoId: ID_A }, st)).reason, "logout_pending");

  // Web Locks simulado: el primero obtiene el lock, el segundo (ifAvailable) recibe null
  let held = false;
  const locks = { request: async (name, opts, cb) => { if (held) return cb(null); held = true; try { return await cb({ name }); } finally { held = false; } } };
  const slowFetchNet = makeNet("ok");
  const origFetch = slowFetchNet.fetch;
  let release;
  const gate = new Promise((r) => { release = r; });
  slowFetchNet.fetch = async (u, i) => { await gate; return origFetch(u, i); };
  const depsA = Object.assign(logoutDeps(st, slowFetchNet), { locks });
  const pA = completePendingLogout(depsA);
  await new Promise((r) => setTimeout(r, 20));
  _resetSessionLogoutForTests(); // otra pestana = otro modulo
  const rB = await completePendingLogout(Object.assign(logoutDeps(st, netB), { locks }));
  assert.equal(rB.status, "busy");
  assert.equal(netB.calls.filter((c) => c.url.indexOf("/logout") >= 0).length, 0, "la segunda pestana no repite el signOut");
  release();
  assert.equal((await pA).status, "completed");
  assert.equal(isLogoutPending(st), false);
  // La otra pestana ve que el SDK ya no tiene sesion (mismo almacenamiento)
  assert.equal((await tabB.client.auth.getSession()).data.session, null);
}));

await test("dos pestanas: logout online en A -> SIGNED_OUT llega a un cliente de B sobre el mismo almacenamiento (misma clave del SDK)", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A);
  const netA = makeNet("ok"); const netB = makeNet("ok");
  const depsA = logoutDeps(st, netA); const tabB = makeTab(st, netB);
  assert.ok((await tabB.auth.getSession()).data.session, "B ve la sesion");
  await performLogout(depsA);
  assert.equal((await tabB.auth.getSession()).data.session, null, "B ya no ve sesion Auth");
}));

// ── 7. Error de renovacion de token ─────────────────────────────────────────────────────────────────────

await test("renovacion de token: refresh RECHAZADO (revocado) -> el SDK cierra la sesion y emite SIGNED_OUT; logout pendiente se completa", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A, NOW() - 10); // access token vencido
  const net = makeNet("refresh400");
  const tab = makeTab(st, net);
  const g = await tab.auth.getSession();
  assert.equal(g.data.session, null);
  assert.ok(net.events.includes("SIGNED_OUT"), "evento que la app usa para invalidar el acceso del alumno");
  assert.equal(authSessionPresent(st), false);
  // Con un logout pendiente y la sesion ya revocada: completo (session_absent) sin quedar bloqueado
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1 }));
  const r = await completePendingLogout({ client: tab, storage: st, timeoutMs: 300, locks: null });
  assert.equal(r.status, "completed");
  assert.equal(isLogoutPending(st), false);
}));

await test("renovacion de token: fallo de RED (reintentable) no prueba que la sesion se haya ido -> el logout pendiente sigue pendiente", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  // Doble que reproduce lo MEDIDO con el GoTrueClient real (token vencido + sin red): signOut() y getSession() devuelven
  // AuthRetryableFetchError, la sesion queda en el almacenamiento y NO se emite SIGNED_OUT. (El SDK real tarda ~25 s en
  // rendirse por sus reintentos con backoff, por eso aqui se usa un doble; la espera de la app esta acotada por timeoutMs.)
  const netErr = { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 };
  const events = [];
  const client = { auth: {
    async signOut() { return { error: netErr }; },
    async getSession() { return { data: { session: null }, error: netErr }; },
  } };
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1 }));
  const r = await completePendingLogout({ client, storage: st, timeoutMs: 300, locks: null });
  assert.equal(r.status, "pending");
  assert.equal(r.reason, "AuthRetryableFetchError");
  assert.equal(isLogoutPending(st), true);
  assert.deepEqual(events, []);
  // Contraste: si getSession responde SIN error y sin sesion, el logout esta cumplido
  const gone = { auth: { async signOut() { return { error: { name: "AuthApiError" } }; }, async getSession() { return { data: { session: null }, error: null }; } } };
  assert.equal((await completePendingLogout({ client: gone, storage: st, timeoutMs: 300, locks: null })).status, "completed");
  assert.equal(isLogoutPending(st), false);
}));

await test("logout con token VENCIDO y sin red: la espera de la app esta acotada aunque el SDK siga reintentando", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  seedStudent(st, UID_A, ID_A, NOW() - 10);
  const t0 = Date.now();
  const res = await performLogout(logoutDeps(st, makeNet("offline"), { timeoutMs: 150 }));
  assert.equal(res.remote.status, "pending");
  assert.ok(Date.now() - t0 < 3000, "performLogout vuelve por timeout (el SDK real tarda ~25 s en rendirse)");
  assert.equal(st.getItem("it_session"), null, "el acceso local ya estaba invalidado desde el inicio");
  assert.equal(isLogoutPending(st), true);
}));

// ── 9. Eventos Auth de alumnos y escrituras en entrenadores ────────────────────────────────────────────────

function fakeJwt(uid, exp) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: uid, aud: "authenticated", exp, role: "authenticated" }) + ".sig";
}

await test("eventos Auth (SIGNED_IN / TOKEN_REFRESHED) de un alumno NO escriben en entrenadores aunque falte it_session; el entrenador si", () => withGlobalStorage(makeStorage(), async function () {
  const st = globalThis.localStorage;
  const userBody = (uid) => ({ id: uid, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z", email: "x@y.z" });
  async function authEventsFor(uid, setup) {
    st.m.clear(); setup(st);
    const upserts = [];
    const fetchImpl = async (url) => {
      if (String(url).indexOf("/token") >= 0) {
        return new Response(JSON.stringify({ ...authSession(uid, NOW() + 3600), access_token: fakeJwt(uid, NOW() + 3600) }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify(userBody(uid)), { status: 200, headers: { "content-type": "application/json" } });
    };
    const auth = new GoTrueClient({ url: "http://auth.test", headers: {}, storageKey: AUTH_KEY, storage: st, persistSession: true, autoRefreshToken: false, fetch: fetchImpl });
    // Mismo criterio que el efecto de Auth de App.jsx: upsertEntrenador(user) salvo INITIAL_SESSION, filtrado por shouldSkipEntrenadorUpsert
    const seen = [];
    auth.onAuthStateChange((event, session) => {
      seen.push(event);
      if (session && session.user && event !== "INITIAL_SESSION" && !shouldSkipEntrenadorUpsert(st, false)) upserts.push({ event, id: session.user.id });
    });
    await auth.setSession({ access_token: fakeJwt(uid, NOW() + 3600), refresh_token: "rt" }); // SIGNED_IN
    await auth.refreshSession({ refresh_token: "rt" }); // TOKEN_REFRESHED
    return { upserts, seen };
  }
  // alumno sin it_session (p. ej. tras una restauracion fallida)
  let r = await authEventsFor(UID_A, () => {});
  assert.ok(r.seen.includes("SIGNED_IN") && r.seen.includes("TOKEN_REFRESHED"), "los eventos si ocurrieron: " + r.seen.join());
  assert.deepEqual(r.upserts, [], "sin it_session no se escribe en entrenadores");
  // alumno con it_session
  r = await authEventsFor(UID_A, (s) => s.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: ID_A })));
  assert.deepEqual(r.upserts, []);
  // alumno con logout pendiente y una it_session de entrenador residual: tampoco
  r = await authEventsFor(UID_A, (s) => { s.setItem("it_session", JSON.stringify({ role: "entrenador" })); s.setItem(LOGOUT_PENDING_KEY, "{\"v\":1}"); });
  assert.deepEqual(r.upserts, []);
  // entrenador legitimo: el upsert sigue funcionando
  r = await authEventsFor(UID_B, (s) => s.setItem("it_session", JSON.stringify({ role: "entrenador", entrenadorId: UID_B })));
  assert.ok(r.upserts.length >= 1 && r.upserts.every((u) => u.id === UID_B));
}));

// (console.error queda silenciado: el SDK sigue logueando fallos de red simulados en segundo plano)
console.log("\n" + count + " tests ok");
// El SDK real puede dejar temporizadores internos tras los casos de red colgada ("hang"): se cierra el proceso explicitamente.
process.exit(0);
