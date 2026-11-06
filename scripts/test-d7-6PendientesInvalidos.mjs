// D7.6 — Series INVALIDAS que ya estaban en la cola de sincronizacion (encoladas antes de la validacion de cargas).
//   node scripts/test-d7-6PendientesInvalidos.mjs
// Logica REAL (flushPendingForAlumno, controlador D76-08, write-ahead, POST idempotente, indicador) con storage en memoria, servidor
// falso y timers falsos. Reglas: una serie invalida NO se envia, NO se borra (queda byte a byte igual), NO se reintenta, NO frena a las
// validas y se informa con un aviso que la identifica. Datos ficticios, sin red.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPendingSyncController, attachSyncTriggers } from "../lib/pendingSyncController.js";
import { writeAheadPendingSet, sendWriteAheadSet, isSetSendInFlight, __resetInFlightForTests } from "../lib/setWriteAhead.js";
import { flushPendingForAlumno, visiblePendingItems, invalidPendingItems, pendienteEnviable, PENDING_SYNC_KEY } from "../lib/pendingSyncQueue.js";
import { PQ_ITEM_PREFIX } from "../lib/pendingQueueKeyed.js";
import { buildPendingProgressItem, buildProgressPayload } from "../lib/workoutSession.js";
import { postProgressIdempotent } from "../lib/progressInsert.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");

const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-pinv-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import PendingSyncIndicator, { describePendingSync, describeInvalidPending } from "./components/workout/PendingSyncIndicator.jsx";' +
      "export { React, renderToStaticMarkup, PendingSyncIndicator, describePendingSync, describeInvalidPending };",
    resolveDir: ROOT, sourcefile: "pinv-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, PendingSyncIndicator, describePendingSync, describeInvalidPending } = await import(pathToFileURL(outfile).href);
const render = (state, over) => renderToStaticMarkup(React.createElement(PendingSyncIndicator, Object.assign({ state, es: true, darkMode: true, onRetry: () => {} }, over || {})));

let n = 0;
let failed = 0;
const t = async (name, fn) => {
  try { __resetInFlightForTests(); await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.error("FAIL -", name); console.error(e); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => void m.delete(k),
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, _m: m,
  };
};
const OP = (i) => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");
const A = "alumno-a", B = "alumno-b";
/** Pendiente valido, como lo arma la app hoy. */
const valido = (alumno, opId, over) => {
  const o = Object.assign({ exId: "sentadilla", kg: 60, reps: 8, note: "", date: "5/11/2026", semana: 1, ciclo: 1 }, over || {});
  return buildPendingProgressItem(o.exId, o.kg, o.reps, o.note, o.date, o.semana, o.ciclo, alumno, opId);
};
/** Pendiente INVALIDO tal como pudo quedar guardado por una version anterior (objeto crudo, sin pasar por la validacion). */
const invalido = (alumno, opId, kg, reps, over) => Object.assign({ exId: "dominadas", kg, reps: reps == null ? 8 : reps, note: "", date: "4/11/2026", semana: 1, ciclo: 1, alumno_id: alumno, opId }, over || {});

const fakeServer = () => {
  const rows = new Map();
  const posts = [];
  const modo = { http500: false };
  return {
    rows, posts, modo,
    io: {
      post: async (payload) => {
        posts.push(payload);
        if (modo.http500) return { ok: false, status: 500, data: { message: "error (ficticio)" } };
        if (rows.has(payload.id)) return { ok: false, status: 409, data: { code: "23505", details: "Key (id)=(" + payload.id + ") already exists." } };
        const row = Object.assign({}, payload);
        rows.set(payload.id, row);
        return { ok: true, status: 201, data: [row] };
      },
      getById: async (id) => ({ ok: true, status: 200, data: rows.has(id) ? [rows.get(id)] : [] }),
    },
  };
};
const enviarCon = (srv) => (item, aid) => postProgressIdempotent(srv.io, buildProgressPayload(aid, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId));

function setup(opts) {
  const o = opts || {};
  const storage = o.storage || store();
  const srv = o.srv || fakeServer();
  const env = { online: o.online !== undefined ? o.online : true, aid: o.aid !== undefined ? o.aid : A, clock: 1000 };
  const timers = [];
  const sends = [];
  const send = enviarCon(srv);
  const ctl = createPendingSyncController({
    storage,
    getAlumnoId: () => env.aid,
    isOnline: () => env.online,
    isInFlight: isSetSendInFlight,
    sendItem: (item, a) => { sends.push({ opId: item.opId, alumno: a }); return send(item, a); },
    timeoutMs: 300, locks: null, now: () => env.clock, retryDelaysMs: o.retryDelaysMs,
    setTimer: (fn, ms) => { const h = { fn, ms }; timers.push(h); return h; },
    clearTimer: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
  });
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = "visible";
  const detach = attachSyncTriggers(ctl, { win, doc });
  const fire = (target, type) => target.dispatchEvent(new Event(type));
  const settle = async () => { for (let i = 0; i < 200 && ctl.isFlushing(); i++) await sleep(2); await sleep(0); };
  const put = (item) => assert.deepEqual(writeAheadPendingSet(storage, item, 0), { ok: true });
  return { storage, srv, env, timers, sends, ctl, win, doc, detach, fire, settle, put };
}
/** Copia exacta de lo guardado para un opId (para comprobar que no se modifica ni se borra). */
const crudo = (storage, opId) => storage.getItem(PQ_ITEM_PREFIX + opId);

// ── 1. criterio ────────────────────────────────────────────────────────────────
await t("1. pendienteEnviable usa la misma validacion que el registro (cargaSerie)", () => {
  assert.equal(pendienteEnviable(valido(A, OP(1))), true);
  assert.equal(pendienteEnviable(valido(A, OP(2), { kg: 0, reps: 45 })), true, "peso corporal / tiempo");
  assert.equal(pendienteEnviable(valido(A, OP(3), { kg: "82,5" })), true, "coma decimal");
  assert.equal(pendienteEnviable(invalido(A, OP(4), "82,5")), true, "un kg string con coma (version anterior) es valido");
  for (const [kg, reps] of [[-10, 8], ["-5", 8], ["Infinity", 8], [100000, 5], ["80abc", 5], [NaN, 5], [60, 0], [60, -3], [60, 1e20], [60, 2.5]]) {
    assert.equal(pendienteEnviable(invalido(A, OP(5), kg, reps)), false, kg + " x " + reps);
  }
  assert.equal(pendienteEnviable(null), false);
});

// ── 2. cola mixta ───────────────────────────────────────────────────────────────
await t("2. cola mixta (formato por clave + arreglo antiguo): se envian y quitan SOLO las validas; las invalidas quedan intactas", async () => {
  const s = store();
  const srv = fakeServer();
  assert.deepEqual(writeAheadPendingSet(s, valido(A, OP(10)), 0), { ok: true });
  assert.deepEqual(writeAheadPendingSet(s, invalido(A, OP(11), -10), 0), { ok: true });
  assert.deepEqual(writeAheadPendingSet(s, valido(A, OP(12), { kg: 0, reps: 45, exId: "plancha" }), 0), { ok: true });
  assert.deepEqual(writeAheadPendingSet(s, invalido(A, OP(13), 100000, 5, { exId: "sentadilla" }), 0), { ok: true });
  // arreglo antiguo (versiones anteriores): una valida y una invalida
  const legacy = [valido(A, OP(14), { kg: 70 }), invalido(A, OP(15), "Infinity", 5)];
  s.setItem(PENDING_SYNC_KEY, JSON.stringify(legacy));
  const antes11 = crudo(s, OP(11)), antes13 = crudo(s, OP(13));
  const r = await flushPendingForAlumno({ storage: s, alumnoId: A, send: (it) => enviarCon(srv)(it, A), timeoutMs: 300 });
  assert.equal(r.sent, 3); assert.equal(r.failed, 0); assert.equal(r.invalid, 3);
  assert.deepEqual(r.invalidIds.slice().sort(), [OP(11), OP(13), OP(15)].sort());
  assert.deepEqual(srv.posts.map((p) => p.id).sort(), [OP(10), OP(12), OP(14)].sort(), "solo las validas llegaron al servidor");
  assert.equal(crudo(s, OP(11)), antes11, "la invalida por clave queda byte a byte igual");
  assert.equal(crudo(s, OP(13)), antes13);
  assert.deepEqual(JSON.parse(s.getItem(PENDING_SYNC_KEY)).map((x) => x.opId), [OP(15)], "en el arreglo queda solo la invalida");
  assert.deepEqual(visiblePendingItems(s, A).map((x) => x.opId).sort(), [OP(11), OP(13), OP(15)].sort());
  assert.deepEqual(invalidPendingItems(s, A).map((x) => x.opId).sort(), [OP(11), OP(13), OP(15)].sort());
});

await t("3. sin invalidas el resultado del flush no cambia de forma ({ sent, failed })", async () => {
  const s = store(); const srv = fakeServer();
  writeAheadPendingSet(s, valido(A, OP(20)), 0);
  assert.deepEqual(await flushPendingForAlumno({ storage: s, alumnoId: A, send: (it) => enviarCon(srv)(it, A), timeoutMs: 300 }), { sent: 1, failed: 0 });
});

// ── 3. reintentos automaticos y manuales: sin bucles ────────────────────────────
await t("4. reintentos: la invalida nunca se envia (automatico, manual, eventos), no programa timers ni deja estado 'error'/'pending'", async () => {
  const s = setup();
  s.put(invalido(A, OP(30), -10));
  const antes = crudo(s.storage, OP(30));
  for (const ev of ["focus", "pageshow"]) { s.fire(s.win, ev); await s.settle(); }
  s.fire(s.doc, "visibilitychange"); await s.settle();
  s.fire(s.win, "online"); await s.settle();
  await s.ctl.retryNow(); await s.settle();
  await s.ctl.trigger("retry"); await s.settle();
  assert.equal(s.sends.length, 0, "ningun envio");
  assert.equal(s.srv.posts.length, 0);
  assert.equal(s.timers.length, 0, "ningun reintento programado");
  const st = s.ctl.getState();
  assert.equal(st.pending, 0); assert.equal(st.status, "idle"); assert.equal(st.invalid, 1);
  assert.deepEqual(st.invalidItems, [{ opId: OP(30), exId: "dominadas", kg: -10, reps: 8, date: "4/11/2026" }]);
  assert.equal(crudo(s.storage, OP(30)), antes, "no se modifica ni se borra");
});

await t("5. una invalida no bloquea a las validas; con el servidor caido el backoff es por las VALIDAS y se agota igual que antes", async () => {
  const s = setup({ retryDelaysMs: [10, 20] });
  s.put(invalido(A, OP(40), -5));
  s.put(valido(A, OP(41)));
  s.srv.modo.http500 = true;
  await s.ctl.trigger("manual"); await s.settle();
  assert.equal(s.ctl.getState().status, "error"); assert.equal(s.ctl.getState().pending, 1, "pendiente = solo la valida");
  assert.equal(s.timers.length, 1);
  s.srv.modo.http500 = false;
  s.timers.shift().fn(); await s.settle();
  assert.deepEqual(s.sends.map((x) => x.opId), [OP(41), OP(41)], "la valida se reintento y se envio; la invalida nunca");
  const st = s.ctl.getState();
  assert.equal(st.status, "idle"); assert.equal(st.pending, 0); assert.equal(st.invalid, 1);
  assert.equal(s.timers.length, 0, "sin timers pendientes por la invalida");
  assert.ok(crudo(s.storage, OP(40)));
});

await t("6. sendWriteAheadSet (envio inmediato) tampoco envia un pendiente guardado invalido; uno valido se envia como antes", async () => {
  const s = store(); let posts = 0;
  writeAheadPendingSet(s, invalido(A, OP(50), -1), 0);
  const r = await sendWriteAheadSet({ storage: s, opId: OP(50), send: async () => { posts++; return [{ id: OP(50) }]; } });
  assert.deepEqual(r, { confirmed: false, reason: "invalid_set" });
  assert.equal(posts, 0); assert.ok(crudo(s, OP(50)));
  assert.equal(isSetSendInFlight(OP(50)), false);
  writeAheadPendingSet(s, valido(A, OP(51)), 0);
  const r2 = await sendWriteAheadSet({ storage: s, opId: OP(51), send: async () => { posts++; return [{ id: OP(51) }]; } });
  assert.equal(r2.confirmed, true); assert.equal(posts, 1);
});

// ── 4. reconexion ───────────────────────────────────────────────────────────────
await t("7. reconexion: offline con cola mixta -> 'online' envia las validas; las invalidas quedan y se avisan", async () => {
  const s = setup({ online: false });
  s.put(valido(A, OP(60))); s.put(invalido(A, OP(61), "Infinity")); s.put(valido(A, OP(62), { kg: 80 }));
  s.ctl.refresh();
  let st = s.ctl.getState();
  assert.equal(st.status, "offline"); assert.equal(st.pending, 2); assert.equal(st.invalid, 1);
  assert.match(describePendingSync(st, true).text, /2 series guardadas/);
  s.env.online = true;
  s.fire(s.win, "online"); await s.settle();
  assert.deepEqual(s.sends.map((x) => x.opId).sort(), [OP(60), OP(62)].sort());
  st = s.ctl.getState();
  assert.equal(st.pending, 0); assert.equal(st.status, "idle"); assert.equal(st.invalid, 1);
  assert.equal(describePendingSync(st, true).visible, false, "el indicador de pendientes no queda trabado");
  assert.equal(describeInvalidPending(st, true).visible, true, "pero se avisa la invalida");
});

// ── 5. recarga de Safari ───────────────────────────────────────────────────────
await t("8. recarga de Safari: controlador nuevo sobre el mismo storage -> la invalida sigue ahi, se avisa y no se envia", async () => {
  const storage = store();
  const srv = fakeServer();
  const s1 = setup({ storage, srv, online: false });
  s1.put(invalido(A, OP(70), -20, 8, { exId: "dominadas" })); s1.put(valido(A, OP(71)));
  const antes = crudo(storage, OP(70));
  s1.detach(); s1.ctl.dispose();                 // Safari descarta la pestaña
  const s2 = setup({ storage, srv, online: true }); // recarga: controlador y eventos nuevos, mismo localStorage
  await s2.ctl.trigger("session"); await s2.settle();
  s2.fire(s2.win, "pageshow"); await s2.settle();
  assert.deepEqual(s2.sends.map((x) => x.opId), [OP(71)]);
  assert.equal(crudo(storage, OP(70)), antes);
  const st = s2.ctl.getState();
  assert.equal(st.invalid, 1); assert.equal(st.pending, 0); assert.equal(s2.timers.length, 0);
  // otra recarga mas: sigue sin enviarse
  s2.detach(); s2.ctl.dispose();
  const s3 = setup({ storage, srv });
  await s3.ctl.trigger("session"); await s3.settle();
  assert.equal(s3.sends.length, 0); assert.equal(s3.ctl.getState().invalid, 1);
});

// ── 6. aislamiento entre alumnos ────────────────────────────────────────────────
await t("9. aislamiento: A sincroniza solo lo suyo; las series (validas o invalidas) de B quedan intactas y no aparecen en el aviso de A", async () => {
  const s = setup({ aid: A });
  s.put(valido(A, OP(80))); s.put(invalido(A, OP(81), -10));
  s.put(valido(B, OP(82))); s.put(invalido(B, OP(83), 100000));
  const b82 = crudo(s.storage, OP(82)), b83 = crudo(s.storage, OP(83));
  await s.ctl.trigger("session"); await s.settle();
  assert.deepEqual(s.sends, [{ opId: OP(80), alumno: A }]);
  let st = s.ctl.getState();
  assert.deepEqual(st.invalidItems.map((x) => x.opId), [OP(81)], "A solo ve su invalida");
  assert.equal(crudo(s.storage, OP(82)), b82); assert.equal(crudo(s.storage, OP(83)), b83);
  // cambia la identidad a B (logout + login en el mismo dispositivo)
  s.env.aid = B;
  await s.ctl.trigger("session"); await s.settle();
  assert.deepEqual(s.sends.slice(1), [{ opId: OP(82), alumno: B }]);
  st = s.ctl.getState();
  assert.equal(st.alumnoId, B);
  assert.deepEqual(st.invalidItems.map((x) => x.opId), [OP(83)], "B solo ve su invalida");
  // sin identidad (coach / enlace compartido): ni envio ni aviso
  s.env.aid = null;
  s.ctl.refresh();
  st = s.ctl.getState();
  assert.equal(st.invalid, 0); assert.deepEqual(st.invalidItems, []);
  assert.equal(describeInvalidPending(st, true).visible, false);
  assert.ok(crudo(s.storage, OP(81)) && crudo(s.storage, OP(83)), "nada se borra");
});

// ── 7. aviso ────────────────────────────────────────────────────────────────────
await t("10. aviso: identifica cada serie (ejercicio, kg, reps, fecha), sin boton de reintento; junto al indicador de pendientes", () => {
  const st = { alumnoId: A, pending: 0, inFlight: 0, status: "idle", invalid: 4, invalidItems: [
    { opId: OP(1), exId: "dominadas", kg: -10, reps: 8, date: "4/11/2026" },
    { opId: OP(2), exId: "sentadilla", kg: 100000, reps: 5, date: "3/11/2026" },
    { opId: OP(3), exId: "x", kg: "Infinity", reps: 5, date: "" },
    { opId: OP(4), exId: "y", kg: 60, reps: 0, date: "1/11/2026" },
  ] };
  const nombres = { dominadas: "Dominadas", sentadilla: "Sentadilla" };
  const d = describeInvalidPending(st, true, (id) => nombres[id]);
  assert.equal(d.text, "4 series con peso o repeticiones no válidos no se enviaron. Quedan guardadas en este dispositivo; avisale a tu entrenador.");
  assert.deepEqual(d.items, ["Dominadas · -10 kg × 8 · 4/11/2026", "Sentadilla · 100000 kg × 5 · 3/11/2026", "x · Infinity kg × 5"]);
  assert.equal(d.extra, 1);
  assert.equal(describeInvalidPending(Object.assign({}, st, { invalid: 1, invalidItems: st.invalidItems.slice(0, 1) }), true).text,
    "1 serie con peso o repeticiones no válidos no se envió. Queda guardada en este dispositivo; avisale a tu entrenador.");
  assert.match(describeInvalidPending(st, false).text, /^4 sets with an invalid weight or reps were not sent/);
  const html = render(st, { nombreEjercicio: (id) => nombres[id] });
  assert.match(html, /data-qa-pending-invalid="4"/);
  assert.match(html, /Dominadas · -10 kg × 8 · 4\/11\/2026/);
  assert.match(html, /y 1 más/);
  assert.doesNotMatch(html, /<button/, "sin reintento: reintentar no corrige la serie");
  // con pendientes validos ademas: ambos avisos (y el boton es solo del de pendientes)
  const ambos = render(Object.assign({}, st, { pending: 2, status: "pending" }));
  assert.match(ambos, /2 series pendientes de sincronizar/);
  assert.match(ambos, /data-qa-pending-invalid/);
  assert.equal((ambos.match(/<button/g) || []).length, 1);
  assert.equal(render({ alumnoId: A, pending: 0, status: "idle", invalid: 0, invalidItems: [] }), "", "sin nada: no se muestra");
});

await t("11. cableado: App y WorkoutScreen pasan nombreEjercicio; el flush del controlador es el unico camino de reintento", () => {
  const app = read("App.jsx");
  assert.match(app, /<PendingSyncIndicator variant="banner"[\s\S]{0,200}nombreEjercicio=/);
  assert.match(read("components/WorkoutScreen.jsx"), /<PendingSyncIndicator variant="inline"[\s\S]{0,200}nombreEjercicio=/);
  assert.match(read("lib/pendingSyncController.js"), /return flushPendingForAlumno\(\{/);
  assert.match(read("lib/pendingSyncQueue.js"), /snapshot = snapshot\.filter\(pendienteEnviable\);/);
});

console.log("\n" + n + " pruebas OK" + (failed ? ", " + failed + " FALLIDAS" : ""));
if (failed) process.exit(1);
