// D76-08 — Sincronizacion automatica de series pendientes al volver al primer plano (online, visibilitychange, focus, pageshow) +
// indicador para el alumno.
//   node scripts/test-d7-6SyncForeground.mjs
// Logica REAL (lib/pendingSyncController.js + flushPendingForAlumno + write-ahead + postProgressIdempotent) con storage en memoria,
// servidor falso, EventTarget falsos y timers falsos inyectados. Datos ficticios, sin red.
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { spawnSync, execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createPendingSyncController, attachSyncTriggers, DEFAULT_RETRY_DELAYS_MS } from "../lib/pendingSyncController.js";
import { writeAheadPendingSet, sendWriteAheadSet, isSetSendInFlight, __resetInFlightForTests } from "../lib/setWriteAhead.js";
import { removeAllPendingForAlumno, visiblePendingItems } from "../lib/pendingSyncQueue.js";
import { PQ_ITEM_PREFIX, PQ_DONE_PREFIX } from "../lib/pendingQueueKeyed.js";
import { buildPendingProgressItem, buildProgressPayload } from "../lib/workoutSession.js";
import { postProgressIdempotent } from "../lib/progressInsert.js";
import { createSetLogGuard } from "../lib/setLogGuard.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");

// Indicador (JSX) via esbuild + react-dom/server, como los otros scripts/test-*.mjs.
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-psync-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import PendingSyncIndicator, { describePendingSync } from "./components/workout/PendingSyncIndicator.jsx";' +
      "export { React, renderToStaticMarkup, PendingSyncIndicator, describePendingSync };",
    resolveDir: ROOT, sourcefile: "psync-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, PendingSyncIndicator, describePendingSync } = await import(pathToFileURL(outfile).href);
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
const mkItem = (alumno, opId, over) => {
  const o = Object.assign({ exId: "sq", kg: 60, reps: 8, note: "", date: "12/10/2026", semana: 1, ciclo: 1 }, over || {});
  return buildPendingProgressItem(o.exId, o.kg, o.reps, o.note, o.date, o.semana, o.ciclo, alumno, opId);
};
const payloadFromItem = (alumnoId, item) => buildProgressPayload(alumnoId, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId);

// Servidor falso de `progreso` (mismo contrato que sbRequestStatus). modo: { http500, fallarIds (500 solo para esos opId), colgar, perder, puerta }.
const fakeServer = () => {
  const rows = new Map();
  const posts = [];
  const modo = { http500: false, fallarIds: new Set(), colgar: false, perder: 0, puerta: null };
  return {
    rows, posts, modo,
    io: {
      post: async (payload) => {
        posts.push(payload);
        if (modo.puerta) await modo.puerta;
        if (modo.http500 || modo.fallarIds.has(payload.id)) return { ok: false, status: 500, data: { message: "error interno (ficticio)" } };
        if (modo.colgar) return new Promise(() => {});
        if (rows.has(payload.id)) return { ok: false, status: 409, data: { code: "23505", details: "Key (id)=(" + payload.id + ") already exists.", message: 'duplicate key value violates unique constraint "progreso_pkey"' } };
        const row = Object.assign({}, payload);
        rows.set(payload.id, row);
        if (modo.perder > 0) { modo.perder--; throw new Error("respuesta perdida"); }
        return { ok: true, status: 201, data: [row] };
      },
      getById: async (id) => ({ ok: true, status: 200, data: rows.has(id) ? [rows.get(id)] : [] }),
    },
  };
};
const puerta = () => { let abrir; const p = new Promise((r) => { abrir = r; }); return { p, abrir }; };

function setup(opts) {
  const o = opts || {};
  const storage = o.storage || store();
  const srv = o.srv || fakeServer();
  const env = { online: o.online !== undefined ? o.online : true, aid: o.aid !== undefined ? o.aid : "A", clock: 1000 };
  const timers = [];
  const results = [];
  const changes = [];
  const sends = [];
  const ctl = createPendingSyncController({
    storage,
    getAlumnoId: () => env.aid,
    isOnline: () => env.online,
    isInFlight: isSetSendInFlight,
    sendItem: (item, a) => { sends.push({ opId: item.opId, alumno: a }); return postProgressIdempotent(srv.io, payloadFromItem(a, item)); },
    timeoutMs: o.timeoutMs != null ? o.timeoutMs : 300,
    locks: null,
    now: () => env.clock,
    setTimer: (fn, ms) => { const h = { fn, ms }; timers.push(h); return h; },
    clearTimer: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
    retryDelaysMs: o.retryDelaysMs,
    eventMinGapMs: o.eventMinGapMs,
    onChange: (s) => changes.push(s),
    onResult: (r) => results.push(r),
  });
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = "visible";
  const detach = attachSyncTriggers(ctl, { win, doc });
  const fire = (target, type) => target.dispatchEvent(new Event(type));
  const settle = async () => { for (let i = 0; i < 200 && ctl.isFlushing(); i++) await sleep(2); await sleep(0); };
  const addPending = (alumno, opId, over) => assert.deepEqual(writeAheadPendingSet(storage, mkItem(alumno, opId, over), 0), { ok: true });
  const pendingOf = (alumno) => visiblePendingItems(storage, alumno).length;
  return { storage, srv, env, timers, results, changes, sends, ctl, win, doc, detach, fire, settle, addPending, pendingOf };
}

// 1
await t("1. serie registrada sin conexion -> queda pendiente, estado offline, sin POST", async () => {
  const s = setup({ online: false });
  s.addPending("A", OP(1));
  s.ctl.refresh();
  await s.ctl.trigger("focus");
  assert.equal(s.srv.posts.length, 0);
  assert.equal(s.ctl.getState().status, "offline");
  assert.equal(s.ctl.getState().pending, 1);
  assert.equal(s.pendingOf("A"), 1);
  assert.match(describePendingSync(s.ctl.getState(), true).text, /^Sin conexión · 1 serie guardada en este dispositivo, todavía sin sincronizar$/);
});

// 2
await t("2. evento online -> sincronizacion automatica, pendiente retirado, estado idle", async () => {
  const s = setup({ online: false });
  s.addPending("A", OP(2));
  s.ctl.refresh();
  s.env.online = true;
  s.fire(s.win, "online");
  await s.settle();
  assert.equal(s.srv.rows.size, 1);
  assert.ok(s.srv.rows.has(OP(2)));
  assert.equal(s.pendingOf("A"), 0);
  assert.equal(s.ctl.getState().status, "idle");
  assert.equal(s.results.length, 1);
  assert.equal(s.results[0].sent, 1);
});

// 3
await t("3. visibilitychange visible -> sincroniza; hidden NO dispara", async () => {
  const s = setup();
  s.addPending("A", OP(3));
  s.doc.visibilityState = "hidden";
  s.fire(s.doc, "visibilitychange");
  await s.settle();
  assert.equal(s.srv.posts.length, 0, "hidden no dispara");
  s.doc.visibilityState = "visible";
  s.fire(s.doc, "visibilitychange");
  await s.settle();
  assert.equal(s.srv.posts.length, 1);
  assert.equal(s.pendingOf("A"), 0);
  assert.equal(s.ctl.getState().lastReason, "visible");
});

// 4
await t("4. focus -> sincroniza (y pageshow tambien)", async () => {
  const s = setup();
  s.addPending("A", OP(4));
  s.fire(s.win, "focus");
  await s.settle();
  assert.equal(s.srv.rows.size, 1);
  assert.equal(s.ctl.getState().lastReason, "focus");
  s.addPending("A", OP(41));
  s.fire(s.win, "pageshow");
  await s.settle();
  assert.equal(s.srv.rows.size, 2);
  assert.equal(s.ctl.getState().lastReason, "pageshow");
});

// 5
await t("5. online + visibilitychange + focus + pageshow en el mismo tick -> 1 flush y 1 POST por serie", async () => {
  const s = setup();
  s.addPending("A", OP(51)); s.addPending("A", OP(52)); s.addPending("A", OP(53));
  s.fire(s.win, "online"); s.fire(s.doc, "visibilitychange"); s.fire(s.win, "focus"); s.fire(s.win, "pageshow");
  await s.settle();
  assert.equal(s.results.length, 1, "un unico flush efectivo");
  assert.equal(s.srv.posts.length, 3, "1 POST por serie");
  assert.equal(new Set(s.srv.posts.map((p) => p.id)).size, 3);
  assert.equal(s.srv.rows.size, 3);
  assert.equal(s.pendingOf("A"), 0);
});

// 6
await t("6a. POST lento de logSet (sendWriteAheadSet en curso) + evento online -> sin duplicados (isInFlight)", async () => {
  const s = setup();
  const g = puerta();
  s.srv.modo.puerta = g.p;
  const item = mkItem("A", OP(6));
  assert.deepEqual(writeAheadPendingSet(s.storage, item, 0), { ok: true });
  const envio = sendWriteAheadSet({ storage: s.storage, opId: OP(6), timeoutMs: 2000, send: () => postProgressIdempotent(s.srv.io, payloadFromItem("A", item)) });
  await sleep(5);
  assert.ok(isSetSendInFlight(OP(6)));
  s.ctl.refresh();
  assert.equal(s.ctl.getState().status, "syncing", "lo que envia logSet se informa como sincronizando");
  assert.equal(describePendingSync(s.ctl.getState(), true).visible, false, "y no mueve la pantalla en cada serie");
  s.fire(s.win, "online");
  s.fire(s.win, "focus");
  await s.settle();
  assert.equal(s.srv.posts.length, 1, "el flush no reenvia lo que esta en vuelo");
  s.srv.modo.puerta = null;
  g.abrir();
  assert.equal((await envio).confirmed, true);
  s.ctl.refresh();
  assert.equal(s.srv.posts.length, 1);
  assert.equal(s.srv.rows.size, 1);
  assert.equal(s.pendingOf("A"), 0);
  assert.equal(s.ctl.getState().status, "idle");
});

await t("6b. flush lento + segundo evento -> coalescido (misma promesa, un solo POST por serie)", async () => {
  const s = setup();
  const g = puerta();
  s.srv.modo.puerta = g.p;
  s.addPending("A", OP(61)); s.addPending("A", OP(62));
  const p1 = s.ctl.trigger("online");
  await sleep(5);
  const p2 = s.ctl.trigger("visible");
  const p3 = s.ctl.trigger("manual");
  assert.equal(p1, p2, "misma promesa");
  assert.equal(p1, p3);
  assert.equal(s.ctl.getState().status, "syncing");
  assert.equal(describePendingSync(s.ctl.getState(), true).text, "Sincronizando… · 2 series");
  s.srv.modo.puerta = null;
  g.abrir();
  const r = await p1;
  assert.equal(r.sent, 2);
  assert.equal(s.srv.posts.length, 2);
  assert.equal(s.results.length, 1);
});

// 7
await t("7. timeout -> pendiente conservado con el MISMO opId, estado error", async () => {
  const s = setup({ timeoutMs: 30 });
  s.srv.modo.colgar = true;
  s.addPending("A", OP(7));
  const r = await s.ctl.trigger("online");
  assert.equal(r.failed, 1);
  assert.equal(s.ctl.getState().status, "error");
  assert.equal(s.ctl.getState().failures, 1);
  assert.equal(s.pendingOf("A"), 1);
  assert.equal(JSON.parse(s.storage.getItem(PQ_ITEM_PREFIX + OP(7))).opId, OP(7));
  assert.equal(s.srv.posts[0].id, OP(7));
});

// 8
await t("8. HTTP 500 -> pendiente conservado, estado error con reintento programado", async () => {
  const s = setup();
  s.srv.modo.http500 = true;
  s.addPending("A", OP(8));
  await s.ctl.trigger("online");
  assert.equal(s.pendingOf("A"), 1);
  assert.equal(s.ctl.getState().status, "error");
  assert.equal(s.timers.length, 1);
  assert.equal(s.timers[0].ms, DEFAULT_RETRY_DELAYS_MS[0]);
  assert.equal(s.ctl.getState().nextRetryAt, s.env.clock + DEFAULT_RETRY_DELAYS_MS[0]);
});

// 9
await t("9. respuesta perdida tras insertar -> reintento con el MISMO opId, 1 fila, pendiente retirado", async () => {
  const s = setup();
  s.srv.modo.perder = 1;
  s.addPending("A", OP(9));
  const r1 = await s.ctl.trigger("online");
  assert.equal(r1.failed, 1);
  assert.equal(s.srv.rows.size, 1, "el servidor ya inserto");
  assert.equal(s.pendingOf("A"), 1, "sin confirmacion no se borra");
  const r2 = await s.ctl.retryNow();
  assert.equal(r2.sent, 1);
  assert.equal(s.srv.posts.length, 2);
  assert.equal(s.srv.posts[0].id, OP(9));
  assert.equal(s.srv.posts[1].id, OP(9));
  assert.equal(s.srv.rows.size, 1);
  assert.equal(s.pendingOf("A"), 0);
  assert.equal(s.ctl.getState().status, "idle");
  assert.equal(s.ctl.getState().failures, 0);
  assert.equal(s.timers.length, 0, "exito: se cancela el reintento");
});

// 10
await t("10. dos pendientes -> pending=2 y texto en plural", async () => {
  const s = setup();
  s.addPending("A", OP(101)); s.addPending("A", OP(102));
  s.ctl.refresh();
  assert.equal(s.ctl.getState().pending, 2);
  assert.equal(s.ctl.getState().status, "pending");
  const d = describePendingSync(s.ctl.getState(), true);
  assert.equal(d.text, "2 series pendientes de sincronizar");
  assert.equal(d.actionLabel, "Sincronizar ahora");
  assert.equal(describePendingSync(Object.assign({}, s.ctl.getState(), { pending: 1 }), true).text, "1 serie pendiente de sincronizar");
  const html = render(s.ctl.getState());
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, />Sincronizar ahora<\/button>/);
  assert.match(html, /min-height:44px/);
  assert.match(html, /min-width:44px/);
  assert.doesNotMatch(html, /Sincronizado/);
});

// 11
await t("11. sin pendientes -> status idle y el indicador no renderiza nada", async () => {
  const s = setup();
  const r = await s.ctl.trigger("session");
  assert.equal(r.skipped, "empty");
  assert.equal(s.srv.posts.length, 0);
  assert.equal(s.ctl.getState().status, "idle");
  assert.equal(describePendingSync(s.ctl.getState(), true).visible, false);
  assert.equal(render(s.ctl.getState()), "");
  assert.equal(render(s.ctl.getState(), { es: false, darkMode: false, variant: "banner" }), "");
  assert.equal(render(null), "");
  // offline sin pendientes: aviso sin boton
  const off = describePendingSync({ alumnoId: "A", pending: 0, status: "offline" }, true);
  assert.equal(off.text, "Sin conexión · las series se guardan en este dispositivo");
  assert.equal(off.actionLabel, null);
  assert.doesNotMatch(render({ alumnoId: "A", pending: 3, status: "offline" }), /<button/);
  assert.match(describePendingSync({ alumnoId: "A", pending: 3, status: "offline" }, true).text, /3 series guardadas en este dispositivo/);
  // ninguna combinacion dice "Sincronizado"
  for (const status of ["idle", "pending", "syncing", "error", "offline"]) for (const p of [0, 1, 4]) for (const es of [true, false]) {
    const d = describePendingSync({ alumnoId: "A", pending: p, status }, es);
    assert.doesNotMatch(d.text, /Sincronizado|Synced/);
  }
});

// 12
await t("12. error -> texto con N y accion Reintentar; retryNow() sincroniza", async () => {
  const s = setup();
  s.srv.modo.http500 = true;
  s.addPending("A", OP(121)); s.addPending("A", OP(122));
  await s.ctl.trigger("online");
  const d = describePendingSync(s.ctl.getState(), true);
  assert.equal(d.text, "2 series pendientes · No se pudieron sincronizar");
  assert.equal(d.actionLabel, "Reintentar");
  assert.equal(describePendingSync(s.ctl.getState(), false).actionLabel, "Retry");
  let retried = 0;
  const html = render(s.ctl.getState(), { onRetry: () => { retried++; } });
  assert.match(html, />Reintentar<\/button>/);
  s.srv.modo.http500 = false;
  const r = await s.ctl.retryNow();
  assert.equal(r.reason, "manual");
  assert.equal(r.sent, 2);
  assert.equal(s.pendingOf("A"), 0);
  assert.equal(s.ctl.getState().status, "idle");
  assert.equal(retried, 0);
});

await t("12b. backoff: un solo timer, delays crecientes y acotados; agotada la lista no hay mas timers; eventos dentro del gap -> throttled", async () => {
  const s = setup();
  s.srv.modo.http500 = true;
  s.addPending("A", OP(125));
  await s.ctl.trigger("online");
  const vistos = [];
  for (let i = 0; i < DEFAULT_RETRY_DELAYS_MS.length; i++) {
    assert.equal(s.timers.length, 1, "nunca mas de un timer");
    vistos.push(s.timers[0].ms);
    const h = s.timers.shift();
    s.env.clock += h.ms;
    h.fn();
    await s.settle();
  }
  assert.deepEqual(vistos, DEFAULT_RETRY_DELAYS_MS);
  assert.equal(s.timers.length, 0, "agotada la lista no hay mas timers");
  assert.equal(s.ctl.getState().failures, DEFAULT_RETRY_DELAYS_MS.length + 1);
  assert.equal(s.ctl.getState().nextRetryAt, null);
  const posts = s.srv.posts.length;
  // Freno de eventos automaticos tras el fallo
  s.env.clock += 500;
  for (const r of ["focus", "visible", "pageshow", "session"]) assert.equal((await s.ctl.trigger(r)).skipped, "throttled", r);
  s.fire(s.win, "focus"); s.fire(s.win, "pageshow");
  await s.settle();
  assert.equal(s.srv.posts.length, posts, "sin bucle rapido");
  // 'online' no se frena
  await s.ctl.trigger("online");
  assert.equal(s.srv.posts.length, posts + 1);
  // fuera del gap el evento vuelve a sincronizar
  s.env.clock += 2500;
  s.srv.modo.http500 = false;
  s.fire(s.win, "focus");
  await s.settle();
  assert.equal(s.pendingOf("A"), 0);
  assert.equal(s.ctl.getState().status, "idle");
  assert.equal(s.ctl.getState().failures, 0);
});

await t("12c. otra pestaña con el cerrojo (ran:false) -> pending y reintento con el primer delay", async () => {
  const storage = store();
  const srv = fakeServer();
  const timers = [];
  const locks = { request: async (name, opts, cb) => cb(null) };   // Web Locks: ocupado
  const ctl = createPendingSyncController({
    storage, getAlumnoId: () => "A", isOnline: () => true, locks, now: () => 0,
    sendItem: (item, a) => postProgressIdempotent(srv.io, payloadFromItem(a, item)),
    setTimer: (fn, ms) => { const h = { fn, ms }; timers.push(h); return h; }, clearTimer: (h) => { const i = timers.indexOf(h); if (i >= 0) timers.splice(i, 1); },
  });
  writeAheadPendingSet(storage, mkItem("A", OP(126)), 0);
  const r = await ctl.trigger("online");
  assert.equal(r.ran, false);
  assert.equal(srv.posts.length, 0);
  assert.equal(ctl.getState().status, "pending");
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, DEFAULT_RETRY_DELAYS_MS[0]);
});

// 13
await t("13. cambio de alumno A->B: B no envia los de A, el contador es solo de B, los de A siguen en storage", async () => {
  const s = setup({ aid: "A", online: false });
  s.addPending("A", OP(131)); s.addPending("A", OP(132));
  s.ctl.refresh();
  assert.equal(s.ctl.getState().pending, 2);
  s.addPending("B", OP(133));
  s.env.aid = "B";
  s.env.online = true;
  await s.ctl.trigger("session");
  assert.deepEqual(s.sends.map((x) => x.opId), [OP(133)]);
  assert.ok(s.sends.every((x) => x.alumno === "B"));
  assert.equal(s.ctl.getState().alumnoId, "B");
  assert.equal(s.ctl.getState().pending, 0);
  assert.equal(s.pendingOf("A"), 2, "los de A quedan intactos");
  assert.equal(s.srv.rows.size, 1);
});

await t("13b. identidad cambiada a mitad del flush -> el resultado no se aplica al alumno nuevo; se recalcula y sincroniza al actual", async () => {
  const s = setup({ aid: "A" });
  const g = puerta();
  s.srv.modo.puerta = g.p;
  s.srv.modo.fallarIds.add(OP(134));
  s.addPending("A", OP(134));
  s.addPending("B", OP(135));
  const p = s.ctl.trigger("online");
  await sleep(5);
  s.env.aid = "B";
  s.srv.modo.puerta = null;
  g.abrir();
  const r = await p;
  assert.equal(r.stale, true);
  await s.settle();
  const st = s.ctl.getState();
  assert.equal(st.alumnoId, "B");
  assert.equal(st.failures, 0, "el fallo de A no se aplica a B");
  assert.notEqual(st.status, "error");
  assert.equal(s.pendingOf("B"), 0, "el actual (B) se sincroniza");
  assert.equal(s.pendingOf("A"), 1, "el de A (que fallo) sigue pendiente");
  assert.ok(s.results.every((x) => x.alumnoId === "B"), "onResult no informa el resultado viejo");
});

// 14
await t("14. logout (sin identidad) -> ningun POST aunque lleguen eventos; pendientes conservados; estado reseteado", async () => {
  const s = setup({ aid: "A" });
  s.addPending("A", OP(141));
  s.ctl.refresh();
  s.env.aid = null;
  s.fire(s.win, "online"); s.fire(s.win, "focus"); s.fire(s.win, "pageshow"); s.fire(s.doc, "visibilitychange");
  assert.equal((await s.ctl.retryNow()).skipped, "no-alumno");
  await s.ctl.trigger("session");
  await s.settle();
  assert.equal(s.srv.posts.length, 0);
  assert.equal(s.pendingOf("A"), 1);
  assert.deepEqual([s.ctl.getState().alumnoId, s.ctl.getState().pending, s.ctl.getState().status], [null, 0, "idle"]);
  assert.equal(s.timers.length, 0);
  assert.equal(render(s.ctl.getState()), "");
});

await t("14b. logout justo despues de iniciar el flush -> los envios verifican la identidad y no salen", async () => {
  const s = setup({ aid: "A" });
  s.addPending("A", OP(142));
  const p = s.ctl.trigger("online");
  s.env.aid = null;   // antes de que los envios salgan (microtarea)
  const r = await p;
  assert.equal(r.stale, true);
  assert.equal(s.srv.posts.length, 0);
  assert.equal(s.pendingOf("A"), 1);
  assert.equal(s.ctl.getState().alumnoId, null);
});

// 15
await t("15. recarga: controlador nuevo sobre el mismo storage con pendientes -> trigger('session') los sincroniza", async () => {
  const storage = store();
  const srv = fakeServer();
  const a = setup({ storage, srv, online: false });
  a.addPending("A", OP(151)); a.addPending("A", OP(152));
  a.ctl.dispose(); a.detach();
  const b = setup({ storage, srv });
  const r = await b.ctl.trigger("session");
  assert.equal(r.sent, 2);
  assert.equal(srv.rows.size, 2);
  assert.equal(b.pendingOf("A"), 0);
});

// 16
await t("16. limpieza (removeAllPendingForAlumno) -> triggers posteriores no envian; un flush que confirma despues no recrea it_pq:*", async () => {
  const s = setup();
  s.addPending("A", OP(161)); s.addPending("A", OP(162));
  removeAllPendingForAlumno(s.storage, "A");
  s.ctl.refresh();
  assert.equal(s.ctl.getState().status, "idle");
  s.fire(s.win, "online"); s.fire(s.win, "focus");
  await s.settle();
  assert.equal(s.srv.posts.length, 0);
  // flush en curso cuando llega la limpieza
  const g = puerta();
  s.srv.modo.puerta = g.p;
  s.addPending("A", OP(163));
  const p = s.ctl.trigger("online");
  await sleep(5);
  removeAllPendingForAlumno(s.storage, "A");
  s.srv.modo.puerta = null;
  g.abrir();
  await p;
  assert.equal(s.storage.getItem(PQ_ITEM_PREFIX + OP(163)), null, "no se recrea el pendiente");
  assert.ok(s.storage.getItem(PQ_DONE_PREFIX + OP(163)) != null, "solo queda la marca de confirmada");
  assert.equal(s.pendingOf("A"), 0);
  assert.equal([...s.storage._m.keys()].filter((k) => k.startsWith(PQ_ITEM_PREFIX)).length, 0);
});

// 17
await t("17. compatibilidad: write-ahead antes del envio (#154), doble toque = 1 serie (#156), sesionesLectura sin cambios (#155)", async () => {
  const s = setup();
  // #154: el pendiente existe en storage cuando se envia
  const item = mkItem("A", OP(171));
  assert.deepEqual(writeAheadPendingSet(s.storage, item, 0), { ok: true });
  let visto = null;
  const res = await sendWriteAheadSet({ storage: s.storage, opId: OP(171), send: async () => { visto = s.storage.getItem(PQ_ITEM_PREFIX + OP(171)); return [{ id: OP(171) }]; } });
  assert.equal(res.confirmed, true);
  assert.ok(visto != null);
  // #156: doble toque con la guarda real -> 1 serie
  let k = 200;
  const guard = createSetLogGuard({ generateId: () => OP(k++) });
  const reg = (opId) => writeAheadPendingSet(s.storage, mkItem("A", opId), 0).ok;
  const r1 = guard.attempt("A|r|0|1|0|sq", reg);
  const r2 = guard.attempt("A|r|0|1|0|sq", reg);
  assert.equal(r1.status, "logged");
  assert.equal(r2.status, "busy");
  assert.equal(s.pendingOf("A"), 1);
  await s.ctl.trigger("online");
  assert.equal(s.srv.rows.size, 1);
  // #155: App sigue usando sesionesLectura; el panel sigue con la guarda; lib/sesionesLectura.js sin cambios
  const app = read("App.jsx");
  assert.match(app, /import \{ crearControladorSesiones, necesitaReintento, estadoPlanAlumno, puedeIniciarEntrenamientoAlumno, manejarSesionGuardada \} from '\.\/lib\/sesionesLectura\.js';/);
  assert.match(read("components/WorkoutExercisePanel.jsx"), /import \{ createSetLogGuard \} from '\.\.\/lib\/setLogGuard\.js';/);
  try {
    const diff = execFileSync("git", ["diff", "--name-only", "HEAD", "--", "lib/sesionesLectura.js", "lib/setLogGuard.js", "lib/setWriteAhead.js", "lib/pendingSyncQueue.js", "components/WorkoutExercisePanel.jsx"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    assert.equal(diff.trim(), "", "libs de #154/#155/#156 sin cambios en el arbol");
  } catch (e) { if (e instanceof assert.AssertionError) throw e; /* sin git: se omite */ }
  const sl = spawnSync(process.execPath, [path.join(ROOT, "scripts/test-d7-6SesionesLectura.mjs")], { encoding: "utf8" });
  assert.equal(sl.status, 0, "suite de sesionesLectura:\n" + (sl.stdout + sl.stderr).slice(-1500));
});

// 18
await t("18. dos series identicas legitimas (opIds distintos) -> 2 filas en el servidor", async () => {
  const s = setup({ online: false });
  s.addPending("A", OP(181)); s.addPending("A", OP(182));
  s.env.online = true;
  s.fire(s.win, "online");
  await s.settle();
  assert.equal(s.srv.rows.size, 2);
  const filas = [...s.srv.rows.values()];
  assert.equal(filas[0].kg, filas[1].kg);
  assert.equal(filas[0].reps, filas[1].reps);
  assert.notEqual(filas[0].id, filas[1].id);
});

await t("attachSyncTriggers: offline -> refresh (estado offline sin POST); detach quita todos los listeners", async () => {
  const s = setup();
  s.addPending("A", OP(191));
  s.env.online = false;
  s.fire(s.win, "offline");
  assert.equal(s.ctl.getState().status, "offline");
  assert.equal(s.srv.posts.length, 0);
  s.detach();
  s.env.online = true;
  s.fire(s.win, "online"); s.fire(s.win, "focus"); s.fire(s.win, "pageshow"); s.fire(s.doc, "visibilitychange");
  await s.settle();
  assert.equal(s.srv.posts.length, 0);
});

// Cableado estatico (complementario, no sustituye a las pruebas de logica)
await t("cableado: App.jsx usa el controlador con identidad validada y los disparadores; WorkoutScreen muestra el indicador", async () => {
  const app = read("App.jsx");
  assert.match(app, /import \{ createPendingSyncController, attachSyncTriggers \} from '\.\/lib\/pendingSyncController\.js';/);
  assert.match(app, /attachSyncTriggers\(ctl, \{ win: window, doc: document \}\)/);
  assert.match(app, /pendingSyncCtlRef\.current\.trigger\('session'\);\s*\}, \[readOnly, sessionData\?\.role, sessionData\?\.alumnoId\]\);/);
  const ident = app.slice(app.indexOf("const readSyncAlumnoId = () => {"), app.indexOf("const syncToastRef"));
  assert.match(ident, /if \(readOnly \|\| sharedParam\) return null;/);
  assert.match(ident, /sd\.role !== "alumno"/);
  assert.match(ident, /ls\.role !== "alumno"/);
  assert.match(ident, /String\(ls\.alumnoId\) !== String\(sd\.alumnoId\)/);
  assert.ok(app.includes("isInFlight: isSetSendInFlight"));
  assert.ok(app.includes("sb.addProgresoIdempotente(buildProgressPayload(alumnoIdSync, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId))"));
  assert.match(app, /flushPendingRef\.current = function \(\) \{ return pendingSyncCtlRef\.current \? pendingSyncCtlRef\.current\.trigger\('retry'\) : null; \};/);
  assert.ok(!/setInterval\(/.test(app.slice(app.indexOf("const readSyncAlumnoId"), app.indexOf("const logSet = ("))), "sin sondeo");
  assert.match(app, /<PendingSyncIndicator variant="banner"/);
  // Banner global: alumno validado -> indicador, salvo durante el entrenamiento (solo el inline); sin identidad -> OfflineSyncBanner como antes.
  assert.match(app, /\{pendingSyncState&&pendingSyncState\.alumnoId \? \([\s\S]{0,400}?session&&activeDay \? null : \(\s*<PendingSyncIndicator variant="banner"[\s\S]*?\) : !isOnline&&\(\s*<OfflineSyncBanner/);
  assert.equal((app.match(/<PendingSyncIndicator /g) || []).length, 1, "un solo indicador en App (el inline vive en WorkoutScreen)");
  assert.match(app, /\{session&&activeDay&&\(\s*<WorkoutScreen/, "WorkoutScreen se monta con la misma condicion");
  const ws = read("components/WorkoutScreen.jsx");
  const ind = ws.indexOf('<PendingSyncIndicator variant="inline"');
  assert.ok(ind > 0 && ind < ws.indexOf("<WorkoutExercisePanel"), "indicador antes del panel");
  assert.match(ws, /pendingSyncState, onPendingSyncRetry,/);
  const ctlSrc = read("lib/pendingSyncController.js").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(ctlSrc, /setInterval|localStorage|sessionStorage|fetch\(/);
});

console.log(`\n${n} pruebas OK` + (failed ? `, ${failed} FALLARON` : ""));
if (failed) process.exit(1);
