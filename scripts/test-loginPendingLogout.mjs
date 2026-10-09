// Login con un logout pendiente y proteccion de identidad al completarlo (integracion S0.6 + 1A; correccion P0-1 / P1-1).
//
//   node scripts/test-loginPendingLogout.mjs
//
// Usa el cliente supabase-js REAL (con el fetch compuesto de supabaseClient.js: barrera del token residual + solo lectura de
// enlaces compartidos) y el GoTrueClient real, contra un servidor simulado en memoria. Sin red ni proyectos reales.

import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createSharedReadOnlyFetch } from "../lib/sharedMode.js";
import { createResidualTokenGuardFetch } from "../lib/residualTokenGuard.js";
import {
  LOGOUT_PENDING_KEY, performLogout, completePendingLogout, signInReplacingResidual, signOutIfCurrentUser, runAuthTransition,
  isLogoutPending, readLogoutPending, beginLogout, _resetSessionLogoutForTests,
} from "../lib/sessionLogout.js";
import { loginStudent, restoreStudentSession } from "../lib/studentIdentity.js";
import { createRestAuthResolver } from "../lib/restAuth.js";
import { flushLegacyPendingQueue } from "../lib/legacyPendingFlush.js";
import { clearAllIronTrackPrefixedKeys } from "../lib/irontrackLocalStorage.js";
import { createPendingSets } from "../lib/pendingSets.js";
import { makeFakeLocks } from "./_testLocks.mjs";

const URL_BASE = "https://p.test";
const ANON = "anon-key-test";
const AUTH_KEY = "sb-t-auth-token";
const UA = "11111111-1111-4111-8111-111111111111";
const UB = "22222222-2222-4222-8222-222222222222";
const UC = "33333333-3333-4333-8333-333333333333"; // entrenador
const UV = "44444444-4444-4444-8444-444444444444";
const AA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USERS = {
  "a@t.com": { uid: UA, alumnoId: AA, nombre: "A" },
  "b@t.com": { uid: UB, alumnoId: AB, nombre: "B" },
  "coach@t.com": { uid: UC, alumnoId: null, nombre: "Coach" },
  "huerfano@t.com": { uid: UV, alumnoId: null, nombre: "Sin ficha" },
};

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
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

// ── Servidor simulado ───────────────────────────────────────────────────────────────────────────────────
function makeServer() {
  const srv = { logout: "ok", log: [], tokens: {}, progreso: [], seq: 0, gates: { token: null, logout: null }, onAlumnosRead: null };
  const sessionFor = (uid) => {
    const at = "at-" + uid.slice(0, 4) + "-" + (++srv.seq);
    srv.tokens[at] = uid;
    return { access_token: at, refresh_token: "rt-" + uid.slice(0, 4) + "-" + srv.seq, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: uid, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "x" } };
  };
  srv.sessionFor = sessionFor;
  srv.uidOf = (auth) => srv.tokens[String(auth || "").replace(/^Bearer /, "")] || (String(auth || "") === "Bearer " + ANON ? "ANON" : null);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  srv.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input.url);
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    const headers = new Headers((init && init.headers) || (input && input.headers) || undefined);
    const auth = headers.get("authorization") || "";
    const entry = { method, path: url.pathname, search: url.search, auth, uid: srv.uidOf(auth), scope: url.searchParams.get("scope") };
    srv.log.push(entry);
    if (url.pathname === "/auth/v1/token") {
      if (srv.gates.token) await srv.gates.token;
      const body = JSON.parse((init && init.body) || "{}");
      const u = USERS[String(body.email).toLowerCase()];
      if (!u || body.password !== "pw") return json(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
      return json(200, sessionFor(u.uid));
    }
    if (url.pathname === "/auth/v1/logout") {
      const sig = init && init.signal;
      const aborted = sig ? new Promise((_, rej) => { const f = () => rej(Object.assign(new Error("The operation was aborted"), { name: "AbortError" })); if (sig.aborted) f(); else sig.addEventListener("abort", f); }) : null;
      if (srv.gates.logout) await (aborted ? Promise.race([srv.gates.logout, aborted]) : srv.gates.logout);
      if (srv.logout === "hang") await (aborted || new Promise(() => {}));
      if (srv.logout === "offline") throw new TypeError("Failed to fetch");
      if (srv.logout === "500") return json(500, { msg: "internal" });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/rest/v1/alumnos" && method === "GET") {
      if (srv.onAlumnosRead) srv.onAlumnosRead();
      const m = /auth_uid=eq\.([0-9a-f-]+)/.exec(url.search);
      const u = Object.values(USERS).find((x) => m && x.uid === m[1] && x.alumnoId);
      return json(200, u ? [{ id: u.alumnoId, nombre: u.nombre, entrenador_id: "e1", auth_uid: u.uid }] : []);
    }
    if (url.pathname === "/rest/v1/progreso" && method === "POST") { srv.progreso.push({ uid: entry.uid, body: JSON.parse((init && init.body) || "{}") }); return json(201, [{ id: 1 }]); }
    if (url.pathname.startsWith("/rest/v1/")) return json(200, method === "GET" ? [] : [{}]);
    return json(200, {});
  };
  srv.rest = () => srv.log.filter((r) => r.path.startsWith("/rest/v1/"));
  srv.logoutCalls = () => srv.log.filter((r) => r.path === "/auth/v1/logout");
  return srv;
}

// "Pestana": un cliente supabase-js real, con el fetch compuesto de lib/supabaseClient.js, sobre el almacenamiento compartido
function makeTab(st, srv, o) {
  return createClient(URL_BASE, ANON, {
    auth: { storage: st, storageKey: AUTH_KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createResidualTokenGuardFetch(createSharedReadOnlyFetch(srv.fetch), { anonKey: ANON, logoutTimeoutMs: o && o.logoutTimeoutMs }) },
  });
}
const storedUid = (st) => { const raw = st.getItem(AUTH_KEY); return raw ? JSON.parse(raw).user.id : null; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const item = (owner, exId, kg) => Object.assign({ exId, kg, reps: 10, note: "", date: "1/10/2026", semana: 0 }, owner ? { alumno_id: owner } : {});

// Deja a A con sesion y arma el estado "A cerro sesion SIN red": marcador de A + token residual de A
async function aLoggedOutOffline(st, srv, tab, o) {
  const opts = o || {};
  st.setItem(AUTH_KEY, JSON.stringify(srv.sessionFor(UA)));
  st.setItem("it_session", JSON.stringify({ role: "alumno", name: "A", alumnoId: AA, entrenadorId: "e1", authUid: UA }));
  st.setItem("it_rt", "[1]");
  if (opts.queue) st.setItem("it_pending_sync", JSON.stringify(opts.queue));
  srv.logout = "offline";
  const res = await performLogout({ client: tab, storage: st, clearLocal: clearAllIronTrackPrefixedKeys, timeoutMs: 300, locks: opts.locks || null });
  assert.equal(res.remote.status, "pending");
  assert.ok(isLogoutPending(st));
  assert.equal(storedUid(st), UA, "token residual de A en el dispositivo");
  return res;
}

// ── 1. Login valido de B mientras /auth/v1/logout devuelve 5xx ───────────────────────────────────────────

await test("1. logout offline de A y login valido de B con /logout en 5xx: B entra, el marcador se borra y B no es revocado", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab);
  srv.logout = "500";
  const markA = readLogoutPending(st);
  assert.equal(markA.authUid, UA, "el marcador conoce al dueño");
  // paso previo del login de la app: intento acotado de cerrar el pendiente (falla: 5xx)
  assert.equal((await completePendingLogout({ client: tab, storage: st, timeoutMs: 300, locks: null })).status, "pending");
  const logoutsAntes = srv.logoutCalls().length;
  const mark = srv.log.length;
  const r = await loginStudent(tab, "b@t.com", "pw");
  assert.equal(r.ok, true, "login de B: " + JSON.stringify(r));
  assert.equal(r.alumno.id, AB);
  assert.equal(isLogoutPending(st), false, "el marcador de A se borro al autenticar B");
  assert.equal(storedUid(st), UB, "la sesion almacenada es la de B");
  const after = srv.log.slice(mark);
  assert.ok(after.some((x) => x.path === "/rest/v1/alumnos" && x.uid === UB), "la identidad se resolvio con el token de B");
  assert.ok(srv.rest().every((x) => x.uid !== UA), "el token residual de A no se uso en REST");
  assert.ok(srv.rest().every((x) => x.uid !== "ANON"), "ninguna solicitud anonima");
  assert.equal(srv.logoutCalls().length, logoutsAntes, "no hubo ningun otro /logout despues del login de B");
  await sleep(50);
  assert.equal(storedUid(st), UB, "B sigue con sesion");
  // y un reintento tardio del cierre de A no la toca
  assert.equal((await completePendingLogout({ client: tab, storage: st, timeoutMs: 300, locks: null })).status, "none");
});

// ── 2. Login fallido: el marcador sigue protegiendo ──────────────────────────────────────────────────────

await test("2. login FALLIDO de B: el marcador de A y la proteccion del token residual siguen vigentes; despues un login valido sustituye", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab);
  srv.logout = "500";
  const bad = await loginStudent(tab, "b@t.com", "mala");
  assert.deepEqual([bad.ok, bad.reason], [false, "invalid_credentials"]);
  assert.ok(isLogoutPending(st), "el marcador NO se borro");
  assert.equal(storedUid(st), UA, "la sesion residual sigue intacta");
  const restBefore = srv.rest().length;
  const probe = await tab.from("progreso").select("*");
  assert.ok(probe.error, "la lectura privada sigue bloqueada");
  assert.equal(probe.error.code || probe.error.message ? true : false, true);
  assert.equal(srv.rest().length, restBefore, "no salio ninguna solicitud REST con el token residual");
  assert.equal(srv.rest().filter((x) => x.uid === UA).length, 0);
  // identidad rechazada tras autenticar (cuenta sin ficha de alumno): el login no queda "a medias" ni revoca globalmente
  srv.logout = "ok";
  const mark = srv.log.length;
  const orphan = await loginStudent(tab, "huerfano@t.com", "pw");
  assert.deepEqual([orphan.ok, orphan.reason], [false, "no_alumno_for_auth_uid"]);
  const lg = srv.log.slice(mark).filter((x) => x.path === "/auth/v1/logout");
  assert.ok(lg.every((x) => x.scope === "local"), "el rechazo usa signOut LOCAL, nunca global: " + JSON.stringify(lg.map((x) => x.scope)));
  assert.equal(storedUid(st), null, "la sesion sin ficha se cerro localmente");
  // un login valido posterior funciona (no queda bloqueado)
  const ok = await loginStudent(tab, "b@t.com", "pw");
  assert.equal(ok.ok, true);
  assert.equal(isLogoutPending(st), false);
});

// ── 3. Marcador de A con sesion de B: B nunca se revoca ──────────────────────────────────────────────────

await test("3. marcador de A + sesion Auth actual de B: completePendingLogout NO revoca a B y solo limpia el marcador", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, id: "m1", ts: Date.now(), role: "alumno", authUid: UA }));
  st.setItem(AUTH_KEY, JSON.stringify(srv.sessionFor(UB)));
  const r = await completePendingLogout({ client: tab, storage: st, timeoutMs: 500, locks: null });
  assert.deepEqual([r.status, r.reason], ["completed", "session_replaced"]);
  assert.equal(srv.logoutCalls().length, 0, "ni una solicitud de logout");
  assert.equal(storedUid(st), UB);
  assert.equal(isLogoutPending(st), false);
  // el primitivo tambien
  const r2 = await signOutIfCurrentUser(tab, UA);
  assert.equal(r2.status, "other_user");
  assert.equal(srv.logoutCalls().length, 0);
  assert.equal(storedUid(st), UB);
  // el dueño correcto SI se cierra, con su propio token
  const r3 = await signOutIfCurrentUser(tab, UB);
  assert.equal(r3.status, "signed_out");
  assert.equal(srv.logoutCalls().length, 1);
  assert.equal(srv.logoutCalls()[0].uid, UB);
});

await test("3b. un marcador nuevo escrito durante un cierre anterior NO se borra (solo se limpia el marcador que se estaba cerrando)", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, id: "viejo", authUid: UA }));
  st.setItem(AUTH_KEY, JSON.stringify(srv.sessionFor(UA)));
  let release; srv.gates.logout = new Promise((r) => { release = r; });
  const p = completePendingLogout({ client: tab, storage: st, timeoutMs: 2000, locks: null });
  await sleep(150); // el cierre ya leyo su marcador y tiene el signOut en curso
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, id: "nuevo", authUid: UB })); // beginLogout de otra cuenta
  release();
  await p;
  assert.equal(readLogoutPending(st).id, "nuevo", "el marcador nuevo sobrevive");
});

await test("3c. entrenador: el dueño del marcador sale de entrenadorId y una sesion de otra cuenta no se revoca", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  st.setItem("it_session", JSON.stringify({ role: "entrenador", name: "C", entrenadorId: UC }));
  beginLogout({ storage: st });
  assert.equal(readLogoutPending(st).authUid, UC, "el entrenador tambien deja constancia de su dueño");
  st.setItem(AUTH_KEY, JSON.stringify(srv.sessionFor(UB)));
  assert.equal((await completePendingLogout({ client: tab, storage: st, timeoutMs: 500, locks: null })).reason, "session_replaced");
  assert.equal(storedUid(st), UB);
  assert.equal(srv.logoutCalls().length, 0);
});

await test("3d. marcador SIN authUid y sesion de OTRO usuario: nunca se revoca, el acceso sigue invalidado y un login nuevo lo recupera", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  st.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, id: "huerfano", ts: Date.now(), role: null, authUid: null }));
  st.setItem(AUTH_KEY, JSON.stringify(srv.sessionFor(UB)));
  const r = await completePendingLogout({ client: tab, storage: st, timeoutMs: 500, locks: null });
  assert.deepEqual([r.status, r.reason], ["pending", "owner_unknown"]);
  assert.equal(srv.logoutCalls().length, 0, "sin dueño conocido no hay ni una solicitud de logout");
  assert.equal(storedUid(st), UB, "la sesion de B no se toca");
  assert.ok(isLogoutPending(st), "el marcador sigue: acceso local invalidado");
  // el acceso sigue invalidado: ni restauracion ni REST con esa sesion
  assert.equal((await restoreStudentSession(tab, { role: "alumno", alumnoId: AB }, st)).reason, "logout_pending");
  const probe = await tab.from("progreso").select("*");
  assert.ok(probe.error);
  assert.equal(srv.rest().length, 0);
  // recuperacion segura: un login valido sustituye la sesion y borra el marcador
  const ok = await loginStudent(tab, "b@t.com", "pw");
  assert.equal(ok.ok, true);
  assert.equal(isLogoutPending(st), false);
  assert.equal(srv.logoutCalls().length, 0, "la recuperacion no revoco a nadie");
  // sin sesion: el marcador sin dueño simplemente se cumple
  const st2 = makeStorage(); globalThis.localStorage = st2;
  st2.setItem(LOGOUT_PENDING_KEY, JSON.stringify({ v: 1, id: "h2", authUid: null }));
  assert.equal((await completePendingLogout({ client: makeTab(st2, srv), storage: st2, timeoutMs: 500, locks: null })).reason, "session_absent");
  assert.equal(isLogoutPending(st2), false);
});

// ── 4. Dos pestanas ─────────────────────────────────────────────────────────────────────────────────────

await test("4. dos pestanas: una completa el logout antiguo (servidor lento) mientras la otra inicia sesion: A se revoca con SU token y B queda con sesion", async (st) => {
  const srv = makeServer(); const locks = makeFakeLocks();
  const tab1 = makeTab(st, srv), tab2 = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab1, { locks });
  srv.logout = "ok";
  let release; srv.gates.logout = new Promise((r) => { release = r; });
  const tokenCallsBefore = srv.log.filter((x) => x.path === "/auth/v1/token").length;
  const p1 = completePendingLogout({ client: tab1, storage: st, timeoutMs: 5000, locks });
  await sleep(30);
  _resetSessionLogoutForTests(); // la pestana 2 es otro modulo
  const p2 = loginStudent(tab2, "b@t.com", "pw", { locks, waitMs: 5000 });
  await sleep(60);
  assert.equal(srv.log.filter((x) => x.path === "/auth/v1/token").length, tokenCallsBefore, "el login de la pestana 2 espera el lock: aun no autentico");
  release();
  assert.equal((await p1).status, "completed");
  const r = await p2;
  assert.equal(r.ok, true, JSON.stringify(r));
  await sleep(50);
  assert.equal(storedUid(st), UB, "B conserva su sesion: el signOut de A no la borro");
  assert.equal(isLogoutPending(st), false);
  const lg = srv.logoutCalls();
  assert.ok(lg.length >= 1 && lg.every((x) => x.uid === UA), "todo /logout llevo el token de A: " + JSON.stringify(lg.map((x) => x.uid)));
  assert.ok(srv.rest().every((x) => x.uid !== UA && x.uid !== "ANON"));
});

await test("4b. dos pestanas, orden inverso: el login (lento) toma el lock primero; el cierre antiguo espera, ve que ya no hay marcador y NO revoca nada", async (st) => {
  const srv = makeServer(); const locks = makeFakeLocks();
  const tab1 = makeTab(st, srv), tab2 = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab1, { locks });
  srv.logout = "ok";
  let release; srv.gates.token = new Promise((r) => { release = r; });
  const logoutsBefore = srv.logoutCalls().length;
  const p2 = loginStudent(tab2, "b@t.com", "pw", { locks, waitMs: 5000 });
  await sleep(30);
  _resetSessionLogoutForTests();
  const p1 = completePendingLogout({ client: tab1, storage: st, timeoutMs: 5000, locks });
  await sleep(30);
  release();
  const r = await p2;
  assert.equal(r.ok, true);
  assert.equal((await p1).status, "none", "al obtener el lock el marcador ya fue reemplazado por el login");
  assert.equal(srv.logoutCalls().length, logoutsBefore, "ningun /logout despues del login de B");
  assert.equal(storedUid(st), UB);
  await sleep(40);
  assert.equal(storedUid(st), UB);
});

await test("4c. Web Lock ocupado mas alla del plazo: el login NO se inicia (auth_busy, estado recuperable), nada se toca y al liberarse el reintento entra", async (st) => {
  const srv = makeServer(); const locks = makeFakeLocks();
  const tab = makeTab(st, srv);
  const queue = [item(AA, "a1", 10), item(null, "u1", 5)];
  await aLoggedOutOffline(st, srv, tab, { locks, queue });
  const ps = createPendingSets({ storage: st, locks: null });
  const keysBefore = Array.from(st.m.keys()).filter((k) => k.indexOf("it_pending_sync") === 0).sort();
  const marker = st.getItem(LOGOUT_PENDING_KEY);
  let free; const hold = new Promise((r) => { free = r; });
  const holder = runAuthTransition(() => hold, { locks, waitMs: 5000, storage: st }); // otra operacion Auth retiene el lock
  await sleep(10);
  const tokensBefore = srv.log.filter((x) => x.path === "/auth/v1/token").length;
  const t0 = Date.now();
  const r = await loginStudent(tab, "b@t.com", "pw", { locks, waitMs: 120, storage: st });
  assert.deepEqual([r.ok, r.reason], [false, "auth_busy"]);
  assert.ok(Date.now() - t0 < 1500, "falla rapido, no se cuelga");
  assert.equal(srv.log.filter((x) => x.path === "/auth/v1/token").length, tokensBefore, "NO se inicio el login (ninguna autenticacion)");
  assert.equal(storedUid(st), UA, "la sesion residual no se toco");
  assert.equal(st.getItem(LOGOUT_PENDING_KEY), marker, "el marcador sigue igual");
  assert.deepEqual(Array.from(st.m.keys()).filter((k) => k.indexOf("it_pending_sync") === 0).sort(), keysBefore, "las series pendientes siguen intactas");
  assert.equal(ps.list(AA).length, 1);
  free(); await holder;
  const again = await loginStudent(tab, "b@t.com", "pw", { locks, waitMs: 2000, storage: st });
  assert.equal(again.ok, true, "el reintento tras liberar el lock entra: " + JSON.stringify(again));
  assert.equal(storedUid(st), UB);
  assert.equal(isLogoutPending(st), false);
  assert.equal(ps.list(AA).length, 1, "series conservadas tras el reintento");
});

await test("4d. un logout que tarda MAS que el plazo del login (>10 s equivalente): el login espera/falla recuperable y el signOut tardio NO borra a B", async (st) => {
  const srv = makeServer(); const locks = makeFakeLocks();
  const tab1 = makeTab(st, srv), tab2 = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab1, { locks, queue: [item(AA, "a1", 10)] });
  srv.logout = "ok";
  const logoutsBase = srv.logoutCalls().length; // incluye el intento fallido del logout offline
  let release; srv.gates.logout = new Promise((r) => { release = r; });
  const p1 = completePendingLogout({ client: tab1, storage: st, timeoutMs: 60, locks, waitMs: 5000 }); // el llamador se rinde (timeout) pero el SDK sigue
  assert.equal((await p1).reason, "timeout");
  _resetSessionLogoutForTests();
  const r = await loginStudent(tab2, "b@t.com", "pw", { locks, waitMs: 150, storage: st });
  assert.deepEqual([r.ok, r.reason], [false, "auth_busy"], "el login no continua sin exclusion mientras el signOut anterior sigue vivo");
  assert.equal(storedUid(st), UA);
  release(); // el cierre antiguo termina
  await sleep(120);
  assert.equal(srv.logoutCalls().slice(logoutsBase).filter((x) => x.uid === UA).length, 1, "el cierre antiguo termino con el token de A");
  const again = await loginStudent(tab2, "b@t.com", "pw", { locks, waitMs: 2000, storage: st });
  assert.equal(again.ok, true);
  await sleep(150);
  assert.equal(storedUid(st), UB, "B conserva la sesion: ningun signOut tardio la borro");
  assert.ok(srv.logoutCalls().every((x) => x.uid === UA));
  assert.equal(createPendingSets({ storage: st, locks: null }).list(AA).length, 1);
});

await test("4e. logout COLGADO en la red: el tope de red lo corta, libera la exclusion (sin bloqueo permanente) y el login entra sin que un signOut tardio borre a B", async (st) => {
  const srv = makeServer(); const locks = makeFakeLocks();
  const tab1 = makeTab(st, srv, { logoutTimeoutMs: 250 }), tab2 = makeTab(st, srv, { logoutTimeoutMs: 250 });
  await aLoggedOutOffline(st, srv, tab1, { locks });
  srv.logout = "hang"; // el servidor no responde jamas
  const p1 = completePendingLogout({ client: tab1, storage: st, timeoutMs: 5000, locks, waitMs: 5000 });
  await sleep(30);
  _resetSessionLogoutForTests();
  const t0 = Date.now();
  const r = await loginStudent(tab2, "b@t.com", "pw", { locks, waitMs: 5000, storage: st });
  assert.equal(r.ok, true, JSON.stringify(r));
  const waited = Date.now() - t0;
  assert.ok(waited >= 150 && waited < 3000, "espero el tope de red del logout (" + waited + " ms), no indefinidamente");
  assert.equal((await p1).status, "pending");
  await sleep(300);
  assert.equal(storedUid(st), UB, "el signOut abortado no borro a B");
});

await test("4f. SIN Web Locks: lease en localStorage; si otra pestana opera, el login no empieza (auth_busy) y reintenta bien al terminar", async (st) => {
  const srv = makeServer();
  const tab1 = makeTab(st, srv), tab2 = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab1, { locks: null, queue: [item(AA, "a1", 10)] });
  srv.logout = "ok";
  let release; srv.gates.logout = new Promise((r) => { release = r; });
  const p1 = completePendingLogout({ client: tab1, storage: st, timeoutMs: 5000, locks: null, waitMs: 5000, leasePollMs: 30 });
  await sleep(150); // la pestana 1 tiene el lease y el signOut en curso
  assert.ok(st.getItem("irontrack_auth_lease"), "lease publicado");
  _resetSessionLogoutForTests(); // pestana 2
  const tokensBefore = srv.log.filter((x) => x.path === "/auth/v1/token").length;
  const r = await loginStudent(tab2, "b@t.com", "pw", { locks: null, waitMs: 200, storage: st, leasePollMs: 30 });
  assert.deepEqual([r.ok, r.reason], [false, "auth_busy"]);
  assert.equal(srv.log.filter((x) => x.path === "/auth/v1/token").length, tokensBefore, "no se inicio el login");
  assert.equal(storedUid(st), UA);
  release();
  assert.equal((await p1).status, "completed");
  assert.equal(st.getItem("irontrack_auth_lease"), null, "lease liberado");
  const again = await loginStudent(tab2, "b@t.com", "pw", { locks: null, waitMs: 2000, storage: st, leasePollMs: 30 });
  assert.equal(again.ok, true);
  await sleep(100);
  assert.equal(storedUid(st), UB);
  assert.ok(srv.logoutCalls().every((x) => x.uid === UA));
  assert.equal(createPendingSets({ storage: st, locks: null }).list(AA).length, 1);
});

await test("4g. SIN Web Locks: un lease abandonado (pestana muerta) vence solo; no hay bloqueo permanente", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  // lease vigente de una pestana que ya no existe: bloquea mientras no venza
  st.setItem("irontrack_auth_lease", JSON.stringify({ id: "pestana-muerta", exp: Date.now() + 400 }));
  const r1 = await loginStudent(tab, "b@t.com", "pw", { locks: null, waitMs: 100, storage: st, leasePollMs: 30 });
  assert.deepEqual([r1.ok, r1.reason], [false, "auth_busy"]);
  assert.equal(storedUid(st), null);
  await sleep(450); // vence
  const r2 = await loginStudent(tab, "b@t.com", "pw", { locks: null, waitMs: 1000, storage: st, leasePollMs: 30 });
  assert.equal(r2.ok, true, "tras vencer el lease el login entra");
  // lease ya vencido: entra de inmediato
  const st2 = makeStorage(); globalThis.localStorage = st2;
  st2.setItem("irontrack_auth_lease", JSON.stringify({ id: "x", exp: Date.now() - 1 }));
  const r3 = await loginStudent(makeTab(st2, srv), "b@t.com", "pw", { locks: null, waitMs: 500, storage: st2, leasePollMs: 30 });
  assert.equal(r3.ok, true);
});

await test("4h. tres operaciones Auth concurrentes en dos pestanas (cierre antiguo x2 + login): un solo /logout con el token de A y B queda con sesion", async (st) => {
  const srv = makeServer(); const locks = makeFakeLocks();
  const tab1 = makeTab(st, srv), tab2 = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab1, { locks, queue: [item(AA, "a1", 10), item(null, "u1", 5)] });
  srv.logout = "ok";
  const logoutsBase = srv.logoutCalls().length;
  let release; srv.gates.logout = new Promise((r) => { release = r; });
  const c1 = completePendingLogout({ client: tab1, storage: st, timeoutMs: 5000, locks, waitMs: 5000 });
  await sleep(20);
  _resetSessionLogoutForTests(); // pestana 2: dos operaciones en paralelo
  const login2 = loginStudent(tab2, "b@t.com", "pw", { locks, waitMs: 5000, storage: st });
  const c2 = completePendingLogout({ client: tab2, storage: st, timeoutMs: 5000, locks, waitMs: 5000 });
  await sleep(40);
  release();
  const [rc1, rl, rc2] = await Promise.all([c1, login2, c2]);
  assert.equal(rc1.status, "completed");
  assert.equal(rl.ok, true, JSON.stringify(rl));
  assert.ok(["none", "completed"].includes(rc2.status));
  await sleep(80);
  assert.equal(storedUid(st), UB);
  const lg = srv.logoutCalls().slice(logoutsBase);
  assert.equal(lg.length, 1, "un solo /logout: " + JSON.stringify(lg.map((x) => x.uid)));
  assert.equal(lg[0].uid, UA);
  assert.equal(isLogoutPending(st), false);
  const ps = createPendingSets({ storage: st, locks: null });
  assert.deepEqual([ps.list(AA).length, ps.listQuarantine().length], [1, 1], "series de A conservadas");
});

// ── 5. Entrenador con marcador pendiente ────────────────────────────────────────────────────────────────

await test("5. login de ENTRENADOR con marcador pendiente: sustituye la sesion residual y sus consultas a entrenadores no quedan bloqueadas", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab);
  srv.logout = "500";
  assert.equal((await completePendingLogout({ client: tab, storage: st, timeoutMs: 200, locks: null })).status, "pending");
  // mismo uso que App.jsx para el entrenador
  const res = await signInReplacingResidual({}, () => tab.auth.signInWithPassword({ email: "coach@t.com", password: "pw" }));
  assert.ok(res.data.session && !res.error);
  assert.equal(isLogoutPending(st), false);
  assert.equal(storedUid(st), UC);
  const sel = await tab.from("entrenadores").select("nombre").eq("id", UC).maybeSingle();
  assert.equal(sel.error, null, "lectura de entrenadores permitida con el token del entrenador");
  const up = await tab.from("entrenadores").upsert({ id: UC, email: "coach@t.com" }, { onConflict: "id" });
  assert.equal(up.error, null);
  const coachRest = srv.rest().filter((x) => x.path === "/rest/v1/entrenadores");
  assert.ok(coachRest.length >= 2 && coachRest.every((x) => x.uid === UC), "con el token del entrenador, nunca anonimas ni con el residual");
  // y un login fallido del entrenador conserva el marcador
  const st2 = makeStorage(); globalThis.localStorage = st2;
  const srv2 = makeServer(); const tab2 = makeTab(st2, srv2);
  await aLoggedOutOffline(st2, srv2, tab2);
  const bad = await signInReplacingResidual({}, () => tab2.auth.signInWithPassword({ email: "coach@t.com", password: "mala" }));
  assert.ok(bad.error);
  assert.ok(isLogoutPending(st2), "login de entrenador fallido: el marcador se conserva");
});

// ── 6. Recarga tras el nuevo login ──────────────────────────────────────────────────────────────────────

await test("6. recarga tras el nuevo login de B: el arranque restaura a B (no al marcador de A) y B conserva la sesion", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  await aLoggedOutOffline(st, srv, tab);
  srv.logout = "500";
  const r = await loginStudent(tab, "b@t.com", "pw");
  assert.equal(r.ok, true);
  st.setItem("it_session", JSON.stringify(r.session));
  // "recarga": modulo nuevo y cliente nuevo sobre el mismo almacenamiento
  _resetSessionLogoutForTests();
  const tab2 = makeTab(st, srv);
  const restored = await restoreStudentSession(tab2, JSON.parse(st.getItem("it_session")), st);
  assert.equal(restored.ok, true, JSON.stringify(restored));
  assert.equal(restored.alumno.id, AB);
  assert.equal(isLogoutPending(st), false);
  assert.equal((await completePendingLogout({ client: tab2, storage: st, timeoutMs: 200, locks: null })).status, "none");
  assert.equal(storedUid(st), UB);
});

// ── 7. y 8. Series de A y B, sin escrituras anonimas ni atribucion incorrecta ───────────────────────────

await test("7-8. series de A y B: conservacion integra (cola nueva + cuarentena), nada anonimo y cada serie sale solo con SU dueño", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  const initialA = [item(AA, "a1", 10), item(AA, "a2", 20), item(null, "u1", 5)];
  await aLoggedOutOffline(st, srv, tab, { queue: initialA });
  const ps = createPendingSets({ storage: st, locks: null });
  assert.equal(st.getItem("it_pending_sync"), null);
  assert.deepEqual([ps.list(AA).length, ps.listQuarantine().length], [2, 1], "series de A conservadas por 1A");
  srv.logout = "500";
  const r = await loginStudent(tab, "b@t.com", "pw");
  assert.equal(r.ok, true);
  st.setItem("it_session", JSON.stringify(r.session));
  // B registra series offline (logSet: array antiguo estampado con su alumno_id) y reconecta
  st.setItem("it_pending_sync", JSON.stringify([item(AB, "b1", 30), item(AB, "b2", 40)]));
  const resolver = createRestAuthResolver({ client: tab, storage: st, anonKey: ANON, getSearch: () => "" });
  const send = async (payload) => { const a = await resolver.resolve("progreso", "POST"); if (!a.ok) return null; const resp = await srv.fetch(URL_BASE + "/rest/v1/progreso", { method: "POST", headers: { Authorization: "Bearer " + a.token }, body: JSON.stringify(payload) }); return resp.ok ? [{}] : null; };
  const out = await flushLegacyPendingQueue({ alumnoId: AB, send });
  assert.equal(out.sent, 2);
  assert.deepEqual(srv.progreso.map((p) => [p.uid, p.body.alumno_id, p.body.ejercicio_id]).sort(), [[UB, AB, "b1"], [UB, AB, "b2"]], "solo series de B, con el token de B y alumno_id de B");
  assert.ok(srv.rest().every((x) => !(x.method !== "GET" && x.uid === "ANON")), "ninguna escritura REST anonima");
  assert.ok(srv.log.every((x) => !(x.path.startsWith("/rest/v1/") && x.uid === UA)), "el token residual de A nunca llego a REST");
  assert.equal(st.getItem("it_pending_sync"), null, "enviadas y retiradas del array");
  // cierre de B: lo de A sigue intacto y no se mezcla
  await performLogout({ client: tab, storage: st, clearLocal: clearAllIronTrackPrefixedKeys, timeoutMs: 200, locks: null });
  assert.deepEqual([ps.list(AA).length, ps.list(AB).length, ps.listQuarantine().length], [2, 0, 1], "A: 2 + 1 en cuarentena, intactas");
  assert.equal(srv.progreso.length, 2, "nada de A se envio");
});

await test("rechazo de identidad con otra sesion entrante: el cierre del login rechazado NO revoca la sesion de otra cuenta", async (st) => {
  const srv = makeServer(); const tab = makeTab(st, srv);
  // mientras se resuelve la identidad de la cuenta sin ficha, otra pestana inicia sesion como B
  srv.onAlumnosRead = () => { st.setItem(AUTH_KEY, JSON.stringify(srv.sessionFor(UB))); srv.onAlumnosRead = null; };
  const r = await loginStudent(tab, "huerfano@t.com", "pw");
  assert.deepEqual([r.ok, r.reason], [false, "no_alumno_for_auth_uid"]);
  assert.equal(storedUid(st), UB, "la sesion de B no se cerro");
  assert.equal(srv.logoutCalls().length, 0, "ningun /logout");
});

console.error = silence; console.warn = warnFn;
console.log("\n" + count + " tests ok");
process.exit(0);
