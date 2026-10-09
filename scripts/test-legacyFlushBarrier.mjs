// Barrera fail-closed de la cola ANTIGUA `it_pending_sync` (S0.6 Fase 1).
//
//   node scripts/test-legacyFlushBarrier.mjs
//
// Regla: una serie solo se envia si trae su PROPIO `alumno_id` y coincide con el alumno de la sesion verificada; el payload usa el
// alumno_id de la SERIE. Las series sin alumno_id o de otro alumno no se envian y no se modifican, falle o no el almacenamiento.
// lib/legacyPendingFlush.js es la misma pieza de la Etapa 1A (solo cambia el origen de la constante de la clave).

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { flushLegacyPendingQueue, partitionLegacyPending, removeOnceEach } from "../lib/legacyPendingFlush.js";
import { buildPendingProgressItem } from "../lib/workoutSession.js";
import { clearAllIronTrackPrefixedKeys, clearIronTrackStorageForNewLogin } from "../lib/irontrackLocalStorage.js";
import { performLogout, completePendingLogout, clearLogoutPending, _resetSessionLogoutForTests } from "../lib/sessionLogout.js";
import { createRestAuthResolver } from "../lib/restAuth.js";
import { createPendingSets } from "../lib/pendingSets.js";

const require = createRequire(import.meta.url);
const { GoTrueClient } = require("@supabase/auth-js");

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const UA = "11111111-1111-4111-8111-111111111111";
const KEY = "it_pending_sync";
const AUTH_KEY = "sb-test-auth-token";

let count = 0;
async function test(name, fn) { _resetSessionLogoutForTests(); const prev = globalThis.localStorage; const st = makeStorage(); globalThis.localStorage = st; try { await fn(st); } finally { if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev; } count++; console.log("ok - " + name); }
const silence = console.error; console.error = () => {}; const warn = console.warn; console.warn = () => {};

function makeStorage() {
  const m = new Map();
  const s = {
    m,
    failWrites: false,
    get length() { return m.size; },
    key: (i) => Array.from(m.keys())[i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) { if (s.failWrites) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
  return s;
}
const unknown = (exId, kg) => ({ exId, kg, reps: 10, note: "", date: "1/10/2026", semana: 0 });
const stamped = (owner, exId, kg) => Object.assign(unknown(exId, kg), { alumno_id: owner });
const queue = (st) => JSON.parse(st.getItem(KEY));
const okSender = (log) => async (p) => { log.push(p); return [{}]; };

// ── Flusher ─────────────────────────────────────────────────────────────────────────────────────────────

await test("serie SIN alumno_id: no se envia con la sesion actual (ni a A ni a B) y se conserva byte a byte", async (st) => {
  const raw = JSON.stringify([unknown("bp", 60), unknown("sq", 100)]);
  st.setItem(KEY, raw);
  for (const who of [A, B]) {
    const sent = [];
    const out = await flushLegacyPendingQueue({ alumnoId: who, send: okSender(sent) });
    assert.equal(sent.length, 0);
    assert.equal(out.withheldUnknown, 2);
    assert.equal(st.getItem(KEY), raw);
  }
});

await test("serie de A en sesion de B: no se envia y se conserva; la propia se envia con el alumno_id de la SERIE", async (st) => {
  st.setItem(KEY, JSON.stringify([stamped(A, "bp", 60), stamped(B, "sq", 100), unknown("dl", 120)]));
  const sent = [];
  const out = await flushLegacyPendingQueue({ alumnoId: B, send: okSender(sent) });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].alumno_id, B);
  assert.equal(sent[0].ejercicio_id, "sq");
  assert.deepEqual([out.withheldForeign, out.withheldUnknown, out.sent], [1, 1, 1]);
  assert.deepEqual(queue(st).map((i) => i.exId), ["bp", "dl"], "solo se quito lo enviado");
});

await test("sin sesion verificada no se envia nada; fallo de envio conserva la serie; array ilegible o no-array no se toca", async (st) => {
  st.setItem(KEY, JSON.stringify([stamped(A, "bp", 60)]));
  const sent = [];
  assert.equal((await flushLegacyPendingQueue({ alumnoId: null, send: okSender(sent) })).reason, "no_identity");
  assert.equal((await flushLegacyPendingQueue({ alumnoId: "  ", send: okSender(sent) })).reason, "no_identity");
  assert.equal(sent.length, 0);
  const out = await flushLegacyPendingQueue({ alumnoId: A, send: async () => null }); // sbFetch sin sesion Auth devuelve null
  assert.equal(out.sent, 0);
  assert.equal(queue(st).length, 1);
  await flushLegacyPendingQueue({ alumnoId: A, send: async () => { throw new Error("red"); } });
  assert.equal(queue(st).length, 1);
  for (const bad of ["{no json", "{\"a\":1}", "\"x\""]) {
    st.setItem(KEY, bad);
    await flushLegacyPendingQueue({ alumnoId: A, send: okSender(sent) });
    assert.equal(st.getItem(KEY), bad);
  }
  assert.equal(sent.length, 0);
});

await test("partition / removeOnceEach / buildPendingProgressItem", () => {
  const p = partitionLegacyPending([stamped(A, "a", 1), stamped(B, "b", 1), unknown("c", 1), null, "x"], A);
  assert.deepEqual([p.eligible.length, p.foreign.length, p.unknown.length], [1, 1, 3]);
  assert.deepEqual(removeOnceEach([1, 1, 2], [1]), [1, 2]);
  assert.equal(buildPendingProgressItem("e", 5, 5, "", "d", 0).alumno_id, undefined);
  assert.equal(buildPendingProgressItem("e", 5, 5, "", "d", 0, "  ").alumno_id, undefined);
  assert.equal(buildPendingProgressItem("e", 5, 5, "", "d", 0, A).alumno_id, A);
});

// ── Cuota llena / error de almacenamiento ───────────────────────────────────────────────────────────────

await test("cuota llena: no se puede reescribir la cola -> NINGUNA serie se pierde y las ajenas/desconocidas siguen sin enviarse", async (st) => {
  const items = [stamped(A, "bp", 60), unknown("sq", 100), stamped(B, "dl", 120)];
  const raw = JSON.stringify(items);
  st.setItem(KEY, raw);
  st.failWrites = true; // de aqui en adelante todo setItem lanza QuotaExceededError
  const sent = [];
  const out = await flushLegacyPendingQueue({ alumnoId: A, send: okSender(sent) });
  assert.deepEqual(sent.map((p) => p.ejercicio_id), ["bp"], "solo la propia se intenta");
  assert.ok(out.storageError, "informa que no pudo guardar");
  assert.equal(out.remaining.length, 3, "nada se da por quitado");
  assert.equal(st.getItem(KEY), raw, "la cola original queda intacta");
});

await test("cuota llena en logout y login: la cola queda intacta y sigue sin poder enviarse bajo otro alumno", async (st) => {
  const raw = JSON.stringify([stamped(A, "bp", 60), unknown("sq", 100)]);
  st.setItem(KEY, raw);
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: A }));
  st.failWrites = true;
  assert.doesNotThrow(() => clearAllIronTrackPrefixedKeys());
  assert.doesNotThrow(() => clearIronTrackStorageForNewLogin());
  assert.equal(st.getItem(KEY), raw);
  const sent = [];
  await flushLegacyPendingQueue({ alumnoId: B, send: okSender(sent) });
  assert.equal(sent.length, 0);
  assert.equal(st.getItem(KEY), raw);
});

// ── A cierra sesion y entra B ───────────────────────────────────────────────────────────────────────────

await test("A cierra sesion y entra B (con 1A integrada): la cola antigua se traslada con su dueño; B no envia nada de A; B envia lo suyo", async (st) => {
  const a1 = stamped(A, "bp", 60), a2 = stamped(A, "sq", 100), u1 = unknown("dl", 120);
  st.setItem(KEY, JSON.stringify([a1, u1, a2]));
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: A }));
  clearAllIronTrackPrefixedKeys(); // logout de A  (1A: preserveLegacyPendingQueue)
  clearIronTrackStorageForNewLogin(); // login de B
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: B }));
  const ps = createPendingSets({ storage: st, locks: null });
  assert.equal(st.getItem(KEY), null, "el array antiguo ya no existe: nada que el vaciado antiguo pueda enviar");
  assert.deepEqual([ps.list(A).length, ps.list(B).length, ps.listQuarantine().length], [2, 0, 1]);
  const sent = [];
  const outB = await flushLegacyPendingQueue({ alumnoId: B, send: okSender(sent) });
  assert.equal(sent.length, 0);
  assert.equal(outB.reason, "empty");
  // B registra una serie propia offline (logSet sigue usando el array antiguo hasta la Etapa 1B)
  st.setItem(KEY, JSON.stringify([stamped(B, "ohp", 40)]));
  await flushLegacyPendingQueue({ alumnoId: B, send: okSender(sent) });
  assert.deepEqual(sent.map((p) => [p.alumno_id, p.ejercicio_id]), [[B, "ohp"]]);
  // vuelve A: el vaciado antiguo NO toca la cola nueva (la sincronizacion de esas series es la Etapa 1B)
  const sentA = [];
  await flushLegacyPendingQueue({ alumnoId: A, send: okSender(sentA) });
  assert.equal(sentA.length, 0);
  assert.equal(ps.list(A).length, 2, "las series de A siguen intactas en la cola nueva");
});

// ── Logout offline con token residual / reconexion ──────────────────────────────────────────────────────

function authSession(uid, exp) {
  return { access_token: "at-" + uid.slice(0, 4), refresh_token: "rt", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: uid, aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "x" } };
}
function makeNet(mode) {
  const net = { mode, calls: [] };
  net.fetch = async (url, init) => {
    net.calls.push(String(url));
    if (net.mode === "offline") throw new TypeError("Failed to fetch");
    return new Response(null, { status: 204 });
  };
  return net;
}
const NOW = () => Math.floor(Date.now() / 1000);

await test("logout offline con token residual + reconexion: el envio de la cola usa el resolutor REST y NO sale hasta que haya sesion valida", async (st) => {
  st.setItem(AUTH_KEY, JSON.stringify(authSession(UA, NOW() + 3600)));
  st.setItem("it_session", JSON.stringify({ role: "alumno", alumnoId: A, authUid: UA }));
  const raw = JSON.stringify([stamped(A, "bp", 60), stamped(A, "sq", 100)]);
  st.setItem(KEY, raw);
  const netOff = makeNet("offline");
  const auth = new GoTrueClient({ url: "http://auth.test", headers: {}, storageKey: AUTH_KEY, storage: st, persistSession: true, autoRefreshToken: false, fetch: netOff.fetch });
  const client = { auth };
  const resolver = createRestAuthResolver({ client, storage: st, anonKey: "ANON", getSearch: () => "" });
  const restCalls = [];
  // mismo contrato que sbFetch: sin credencial valida devuelve null (la serie queda pendiente)
  const send = async (payload) => { const r = await resolver.resolve("progreso", "POST"); if (!r.ok) return null; restCalls.push({ token: r.token, payload }); return [{}]; };

  await performLogout({ client, storage: st, clearLocal: clearAllIronTrackPrefixedKeys, timeoutMs: 300, locks: null });
  assert.ok(st.getItem(AUTH_KEY), "token residual presente");
  assert.equal(createPendingSets({ storage: st, locks: null }).list(A).length, 2, "1A traslado las series de A a su cola nueva");
  // Una pestana con codigo viejo (o un estado 'kept') vuelve a dejar el array antiguo: la barrera sigue protegiendolo
  st.setItem(KEY, raw);
  // 1. Sin it_session no hay identidad, y aunque un vaciado forzado indicara A, el resolutor deniega por el marcador
  assert.equal((await flushLegacyPendingQueue({ alumnoId: null, send })).reason, "no_identity");
  const forced = await flushLegacyPendingQueue({ alumnoId: A, send });
  assert.equal(forced.sent, 0);
  assert.equal(restCalls.length, 0);
  assert.equal(st.getItem(KEY), raw, "series intactas");

  // 2. Reconexion: se completa el logout; sin sesion Auth sigue sin salir nada (ni como anon)
  _resetSessionLogoutForTests();
  const netOn = makeNet("ok");
  const auth2 = new GoTrueClient({ url: "http://auth.test", headers: {}, storageKey: AUTH_KEY, storage: st, persistSession: true, autoRefreshToken: false, fetch: netOn.fetch });
  assert.equal((await completePendingLogout({ client: { auth: auth2 }, storage: st, timeoutMs: 300, locks: null })).status, "completed");
  const resolver2 = createRestAuthResolver({ client: { auth: auth2 }, storage: st, anonKey: "ANON", getSearch: () => "" });
  const send2 = async (payload) => { const r = await resolver2.resolve("progreso", "POST"); if (!r.ok) return null; restCalls.push({ token: r.token, payload }); return [{}]; };
  assert.equal((await flushLegacyPendingQueue({ alumnoId: A, send: send2 })).sent, 0);
  assert.equal(restCalls.length, 0);
  assert.equal(st.getItem(KEY), raw);

  // 3. A inicia sesion de nuevo (sesion Auth valida): ahora SI salen, con su token y su id
  st.setItem(AUTH_KEY, JSON.stringify(authSession(UA, NOW() + 3600)));
  clearLogoutPending(st);
  const out = await flushLegacyPendingQueue({ alumnoId: A, send: send2 });
  assert.equal(out.sent, 2);
  assert.ok(restCalls.every((c) => c.token === "at-1111" && c.payload.alumno_id === A));
  assert.equal(st.getItem(KEY), null);
});

// ── Dos pestanas ────────────────────────────────────────────────────────────────────────────────────────

await test("dos pestanas: B no envia lo de A mientras A vacia; lo que una pestana agrega mientras otra envia NO se pierde", async (st) => {
  st.setItem(KEY, JSON.stringify([stamped(A, "bp", 60), unknown("dl", 120)]));
  let release; const gate = new Promise((r) => { release = r; });
  const sentA = [], sentB = [];
  const tabA = flushLegacyPendingQueue({ alumnoId: A, send: async (p) => { await gate; sentA.push(p); return [{}]; } });
  await new Promise((r) => setTimeout(r, 10));
  // pestana B (otro alumno) vacia ahora mismo y otra pestana de A agrega una serie nueva
  const outB = await flushLegacyPendingQueue({ alumnoId: B, send: okSender(sentB) });
  assert.equal(sentB.length, 0);
  assert.equal(outB.withheldForeign, 1);
  const mid = queue(st); mid.push(stamped(A, "ohp", 40)); st.setItem(KEY, JSON.stringify(mid));
  release();
  await tabA;
  assert.deepEqual(sentA.map((p) => p.ejercicio_id), ["bp"]);
  assert.deepEqual(queue(st).map((i) => i.exId).sort(), ["dl", "ohp"], "la agregada por la otra pestana y la desconocida se conservan");
});

// ── Conservacion de todos los registros ─────────────────────────────────────────────────────────────────

await test("conservacion: enviadas + restantes == total en cada paso (sin perdidas ni duplicados por la barrera)", async (st) => {
  const all = [stamped(A, "e1", 1), stamped(A, "e2", 2), stamped(B, "e3", 3), unknown("e4", 4), stamped(A, "e1", 1)];
  st.setItem(KEY, JSON.stringify(all));
  const key = (i) => i.exId + ":" + i.kg + ":" + (i.alumno_id || "-");
  const sent = [];
  await flushLegacyPendingQueue({ alumnoId: B, send: okSender(sent) });
  await flushLegacyPendingQueue({ alumnoId: A, send: async (p) => { sent.push(p); return p.ejercicio_id === "e2" ? null : [{}]; } });
  const remaining = queue(st).map(key);
  const sentKeys = sent.filter((p) => !(p.ejercicio_id === "e2")).map((p) => p.ejercicio_id + ":" + p.kg + ":" + p.alumno_id);
  assert.equal(sentKeys.length + remaining.length, all.length);
  assert.deepEqual([...sentKeys, ...remaining].sort(), all.map(key).sort());
});

console.error = silence; console.warn = warn;
console.log("\n" + count + " tests ok");
process.exit(0);
