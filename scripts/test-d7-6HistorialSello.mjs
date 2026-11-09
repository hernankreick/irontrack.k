// D76-09 — Sello de historial, cuarentena y «subir igual» (lado cliente).
//   node scripts/test-d7-6HistorialSello.mjs
// Logica REAL (lib/historialSello.js, lib/historialCuarentena.js, pendingSyncQueue, setWriteAhead, pendingSyncController, progressInsert,
// finalizeWorkoutSession, workoutSessionDate) contra un servidor FALSO que aplica la misma regla que el trigger de la migracion
// (sello vigente / sin borrado / reingreso por RPC) y responde como PostgREST (400 + code IT409). Datos ficticios, sin red.
// La validacion contra PostgreSQL 17.6 + PostgREST reales esta en el paquete de GO-1/GO-2 (fuera del repo).
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  obtenerSello, selloParaRegistrar, selloVencido, conSello, esRechazoHistorial, marcaRechazo, esMarcaRechazo, leerSelloCache, SELLO_PREFIX,
} from "../lib/historialSello.js";
import {
  leerCuarentena, moverSerieACuarentena, guardarSesionEnCuarentena, liberarSeriesDeCuarentena, prepararReingreso, ejecutarReingreso,
  prepararConfirmacionReingreso, descartarDeCuarentena, claveSesion, contarCuarentena, LOTE_MAX_REINGRESO,
} from "../lib/historialCuarentena.js";
import { writeAheadPendingSet, sendWriteAheadSet, __resetInFlightForTests } from "../lib/setWriteAhead.js";
import { flushPendingForAlumno, visiblePendingItems, enqueueItem, readQueue } from "../lib/pendingSyncQueue.js";
import { createPendingSyncController } from "../lib/pendingSyncController.js";
import { isPendingQueueKey, PQ_ITEM_PREFIX, PQ_QUARANTINE_PREFIX, PQ_QUARANTINE_SESSION_PREFIX } from "../lib/pendingQueueKeyed.js";
import { buildPendingProgressItem, buildProgressPayload, buildSessionPayload, persistSetConfirmed } from "../lib/workoutSession.js";
import { postProgressIdempotent } from "../lib/progressInsert.js";
import { persistSessionConfirmed, FINALIZE_FAILURE } from "../lib/finalizeWorkoutSession.js";
import { prepararInicioEntrenamiento, leerSesionActiva, ACTIVE_WORKOUT_KEY } from "../lib/workoutSessionDate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0, failed = 0;
const t = async (name, fn) => {
  try { __resetInFlightForTests(); await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.error("FAIL -", name); console.error(e); }
};
const store = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => void m.delete(k),
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, _m: m,
  };
};
const OP = (i) => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");
const A = "b0000000-0000-4000-8000-000000000001", B = "b0000000-0000-4000-8000-000000000002";
const uuid = (i) => "5e110000-0000-4000-8000-" + String(i).padStart(12, "0");

// Servidor falso con la MISMA regla que it_private.historial_guard_insert (modo 'activo') y las RPC de la migracion.
function servidor() {
  const progreso = new Map(), sesiones = [];
  const estado = {};          // alumno -> { epoch, token, reset_at }
  let tok = 0, perderRespuesta = 0;
  const est = (a) => estado[a] || { epoch: 0, token: null, reset_at: null };
  const rechazo = (a, motivo) => ({ ok: false, status: 400, data: { code: "IT409", message: "it_historial_reiniciado", details: motivo, hint: "epoch_vigente=" + est(a).epoch } });
  const guard = (row) => {
    const e = est(row.alumno_id);
    if (!e.reset_at) return null;
    if (row.historial_token && row.historial_token === e.token) return null;
    return row.historial_token ? "sello_anterior" : "sin_sello";
  };
  const api = {
    progreso, sesiones, estado,
    perderProxima() { perderRespuesta++; },
    post: async (p) => {
      const g = guard(p);
      if (g) return rechazo(p.alumno_id, g);
      if (progreso.has(p.id)) return { ok: false, status: 409, data: { code: "23505", details: "Key (id)=(" + p.id + ") already exists." } };
      const row = Object.assign({}, p, { historial_epoch: est(p.alumno_id).epoch }); delete row.historial_token;
      progreso.set(p.id, row);
      if (perderRespuesta > 0) { perderRespuesta--; throw new Error("respuesta perdida"); }
      return { ok: true, status: 201, data: [row] };
    },
    getById: async (id) => ({ ok: true, status: 200, data: progreso.has(id) ? [progreso.get(id)] : [] }),
    addSesion: async (p) => {
      const g = guard(p);
      if (g) return marcaRechazo(rechazo(p.alumno_id, g));
      const row = Object.assign({}, p); delete row.historial_token; sesiones.push(row); return [row];
    },
    limpiar(a) {
      const e = est(a); estado[a] = { epoch: e.epoch + 1, token: uuid(++tok), reset_at: "2026-11-06T12:00:00Z" };
      for (const [k, r] of progreso) if (r.alumno_id === a) progreso.delete(k);
      for (let i = sesiones.length - 1; i >= 0; i--) if (sesiones[i].alumno_id === a) sesiones.splice(i, 1);
    },
    rpc: async (name, args) => {
      const a = args.p_alumno_id;
      if (name === "it_historial_sello") { const e = est(a); return { data: [{ epoch: e.epoch, sello: e.token, reset_at: e.reset_at, modo: api.modo || "activo", vinculado: true }], error: null, missing: false }; }
      if (name === "it_historial_reingresar") {
        const e = est(a);
        if (!e.reset_at) return { data: [{ ok: false, reason: "sin_borrado" }], error: null, missing: false };
        if (args.p_epoch_confirmado !== e.epoch) return { data: [{ ok: false, reason: "conflicto_epoch", epoch: e.epoch }], error: null, missing: false };
        const res = [];
        for (const s of args.p_series) {
          if (!(typeof s.kg === "number" && s.kg >= 0 && Number.isInteger(s.reps) && s.reps >= 1)) { res.push({ tipo: "serie", id: s.id, resultado: "invalida" }); continue; }
          if (progreso.has(s.id)) { res.push({ tipo: "serie", id: s.id, resultado: "ya_existia" }); continue; }
          progreso.set(s.id, { id: s.id, alumno_id: a, ejercicio_id: s.ejercicio_id, kg: s.kg, reps: s.reps, fecha: s.fecha, semana: s.semana, historial_epoch: e.epoch, reingreso_de_epoch: s.epoch_original });
          res.push({ tipo: "serie", id: s.id, resultado: "insertada" });
        }
        for (const s of args.p_sesiones) { sesiones.push({ alumno_id: a, fecha: s.fecha, dia_idx: s.dia_idx, semana: s.semana, reingreso: true }); res.push({ tipo: "sesion", clave: s.clave, resultado: "insertada" }); }
        return { data: [{ ok: true, epoch: e.epoch, resultados: res }], error: null, missing: false };
      }
      return { data: null, error: { code: "PGRST202" }, missing: true };
    },
  };
  return api;
}
const io = (srv) => ({ post: srv.post, getById: srv.getById });
const enviar = (srv, alumno) => (item) => postProgressIdempotent(io(srv), buildProgressPayload(alumno, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId, item.historial_token));
// Registra una serie como logSet: write-ahead con el sello vigente EN EL DISPOSITIVO al registrar.
const registrar = (dev, alumno, i, over) => {
  const o = Object.assign({ exId: "sentadilla", kg: 100, reps: 5, date: "02/11/2026", semana: 1, ciclo: 1 }, over);
  const sello = selloParaRegistrar(dev, alumno);
  const it = buildPendingProgressItem(o.exId, o.kg, o.reps, "", o.date, o.semana, o.ciclo, alumno, OP(i), sello, (leerSelloCache(dev, alumno) || {}).epoch);
  assert.equal(writeAheadPendingSet(dev, it, Date.now()).ok, true);
  return it;
};
const refrescar = (dev, srv, alumno) => obtenerSello({ rpc: srv.rpc, storage: dev, alumnoId: alumno });

// ───────────────────────── Sello ─────────────────────────
await t("sello: sin migracion no hay capacidad y el payload queda IDENTICO al anterior", async () => {
  const dev = store();
  const r = await obtenerSello({ rpc: async () => ({ data: null, error: { code: "PGRST202" }, missing: true }), storage: dev, alumnoId: A });
  assert.deepEqual([r.ok, r.capacidad], [false, false]);
  assert.equal(selloParaRegistrar(dev, A), null);
  const p = buildProgressPayload(A, "press", 60, 8, "", "2/11/2026", 1, 1, OP(1), selloParaRegistrar(dev, A));
  assert.deepEqual(Object.keys(p).sort(), ["alumno_id", "ejercicio_id", "fecha", "id", "kg", "nota", "reps", "semana"]);
  const it = buildPendingProgressItem("press", 60, 8, "", "2/11/2026", 1, 1, A, OP(1), null, null);
  assert.ok(!("historial_token" in it) && !("historial_epoch_visto" in it));
  assert.ok(!("historial_token" in buildSessionPayload({ alumnoId: A, session: { dIdx: 0 }, weekToSave: 1, date: "2/11/2026", time: "10:00" })));
});
await t("sello: 42501 (cuenta sin vincular) se cachea como sin permiso; otros errores no pisan el cache", async () => {
  const dev = store();
  const r = await obtenerSello({ rpc: async () => ({ data: null, error: { code: "42501" }, missing: false }), storage: dev, alumnoId: A });
  assert.equal(r.sinPermiso, true); assert.equal(leerSelloCache(dev, A).sinPermiso, true); assert.equal(selloParaRegistrar(dev, A), null);
  await obtenerSello({ rpc: async () => ({ data: [{ epoch: 2, sello: uuid(9), modo: "activo" }] }), storage: dev, alumnoId: A });
  await obtenerSello({ rpc: async () => ({ data: null, error: { code: "500" } }), storage: dev, alumnoId: A });
  assert.equal(selloParaRegistrar(dev, A), uuid(9));
});
await t("sello: conSello / vencimiento / deteccion IT409 y marca", () => {
  assert.deepEqual(conSello({ a: 1 }, "no-uuid"), { a: 1 });
  assert.equal(conSello({ a: 1 }, uuid(1).toUpperCase()).historial_token, uuid(1));
  const dev = store();
  assert.equal(selloVencido(dev, A, 1000), true);
  dev.setItem(SELLO_PREFIX + A, JSON.stringify({ capacidad: true, sello: uuid(1), at: 1000 }));
  assert.equal(selloVencido(dev, A, 30000), false); assert.equal(selloVencido(dev, A, 70000), true);
  const res = { ok: false, status: 400, data: { code: "IT409", message: "it_historial_reiniciado", details: "sello_anterior", hint: "epoch_vigente=3" } };
  assert.equal(esRechazoHistorial(res), true);
  assert.equal(esRechazoHistorial({ ok: false, status: 409, data: { code: "23505" } }), false);
  assert.deepEqual(marcaRechazo(res), { historialRechazo: true, motivo: "sello_anterior", epochVigente: 3 });
  assert.equal(esMarcaRechazo([{}]), false);
});

// ───────────────────────── E1–E6 de la auditoria, ahora protegidos ─────────────────────────
await t("E1 offline + borrado: al volver, las series anteriores van a cuarentena y NO reaparecen; nada se pierde", async () => {
  const srv = servidor(), dev = store();
  await refrescar(dev, srv, A);
  [1, 2, 3].forEach((i) => registrar(dev, A, i));
  srv.limpiar(A);
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.deepEqual([r.sent, r.failed, r.quarantined], [0, 0, 3]);
  assert.equal(srv.progreso.size, 0, "ninguna serie anterior al borrado reaparecio");
  assert.equal(visiblePendingItems(dev, A).length, 0);
  assert.equal(leerCuarentena(dev, A).series.length, 3, "las 3 siguen en el telefono");
  assert.deepEqual(leerCuarentena(dev, A).series.map((r) => r.item.historial_epoch_visto), [0, 0, 0], "epoca conocida al registrar (0) para la auditoria");
});
await t("E2 respuesta perdida + borrado: el reintento idempotente se rechaza (no reinsercion) y va a cuarentena", async () => {
  const srv = servidor(), dev = store();
  const it = registrar(dev, A, 10);
  srv.perderProxima();
  const r1 = await sendWriteAheadSet({ storage: dev, opId: it.opId, send: () => enviar(srv, A)(it), timeoutMs: 500 });
  assert.equal(r1.confirmed, false); assert.equal(srv.progreso.size, 1);
  srv.limpiar(A);
  const r2 = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.equal(r2.quarantined, 1); assert.equal(srv.progreso.has(it.opId), false);
});
await t("E3 pendiente del arreglo antiguo (sin sello): cuarentena y se quita del arreglo por opId", async () => {
  const srv = servidor(), dev = store();
  enqueueItem(dev, { exId: "press", kg: 60, reps: 8, note: "", date: "28/10/2026", semana: 2, alumno_id: A, opId: OP(50) });
  enqueueItem(dev, { exId: "press", kg: 60, reps: 8, note: "", date: "28/10/2026", semana: 2, alumno_id: B, opId: OP(51) });
  srv.limpiar(A);
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.equal(r.quarantined, 1);
  assert.deepEqual(readQueue(dev).items.map((x) => x.opId), [OP(51)], "el pendiente del otro alumno queda intacto");
});
await t("E4 POST en vuelo durante el borrado: la marca de rechazo llega al write-ahead y la serie va a cuarentena", async () => {
  const srv = servidor(), dev = store();
  await refrescar(dev, srv, A);
  const it = registrar(dev, A, 20);
  let liberar; const puerta = new Promise((r) => { liberar = r; });
  const p = sendWriteAheadSet({ storage: dev, opId: it.opId, send: async () => { await puerta; return enviar(srv, A)(it); }, timeoutMs: 5000 });
  srv.limpiar(A); liberar();
  const r = await p;
  assert.deepEqual([r.confirmed, r.reason, r.quarantined], [false, "historial_reiniciado", true]);
  assert.equal(srv.progreso.size, 0); assert.ok(dev.getItem(PQ_QUARANTINE_PREFIX + it.opId)); assert.equal(dev.getItem(PQ_ITEM_PREFIX + it.opId), null);
});
await t("E5 dias sin conexion: series viejas a cuarentena; series registradas DESPUES de refrescar el sello se aceptan", async () => {
  const srv = servidor(), dev = store();
  await refrescar(dev, srv, A);
  [31, 32].forEach((i) => registrar(dev, A, i, { date: "20/10/2026" }));
  srv.limpiar(A);
  await refrescar(dev, srv, A);                       // vuelve la conexion: el dispositivo conoce el sello nuevo
  registrar(dev, A, 33, { date: "06/11/2026" });      // serie legitima posterior al borrado
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.deepEqual([r.sent, r.quarantined], [1, 2]);
  assert.deepEqual([...srv.progreso.keys()], [OP(33)]);
  assert.equal(srv.progreso.get(OP(33)).historial_epoch, 1);
});
await t("E6 el sello viaja solo si es el registrado; un pendiente nunca se re-sella con el vigente", async () => {
  const srv = servidor(), dev = store();
  srv.limpiar(A); await refrescar(dev, srv, A);
  const it = registrar(dev, A, 40);
  srv.limpiar(A); await refrescar(dev, srv, A);       // otro borrado: el cache ya tiene el sello nuevo
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.equal(r.quarantined, 1, "se envio con el sello de cuando se registro (viejo) -> rechazo");
  assert.equal(leerCuarentena(dev, A).series[0].item.historial_token, it.historial_token);
});
await t("alumno sin borrado: series sin sello se aceptan (clientes viejos y enlace compartido no se rompen)", async () => {
  const srv = servidor(), dev = store();
  registrar(dev, B, 60);
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: B, send: enviar(srv, B), timeoutMs: 500 });
  assert.deepEqual([r.sent, r.quarantined || 0], [1, 0]);
});
await t("reintento idempotente con sello vigente: 23505 verificado = confirmado (sin cuarentena ni duplicado)", async () => {
  const srv = servidor(), dev = store();
  srv.limpiar(A); await refrescar(dev, srv, A);
  const it = registrar(dev, A, 70);
  srv.perderProxima();
  await sendWriteAheadSet({ storage: dev, opId: it.opId, send: () => enviar(srv, A)(it), timeoutMs: 500 });
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.deepEqual([r.sent, r.quarantined || 0, srv.progreso.size], [1, 0, 1]);
});

// ───────────────────────── Cuarentena persistente ─────────────────────────
await t("corte entre escribir la cuarentena y quitar el pendiente: se ve UNA vez (gana la cuarentena) y no se envia", async () => {
  const srv = servidor(), dev = store();
  const it = registrar(dev, A, 80);
  dev.setItem(PQ_QUARANTINE_PREFIX + it.opId, JSON.stringify({ tipo: "serie", id: it.opId, alumno_id: A, item: it, rechazadoAt: 1 }));
  assert.equal(visiblePendingItems(dev, A).length, 0);
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.equal(r.sent, 0); assert.equal(contarCuarentena(dev, A), 1);
});
await t("la cuarentena se conserva al cerrar sesion (claves protegidas) y es por alumno", async () => {
  assert.equal(isPendingQueueKey(PQ_QUARANTINE_PREFIX + "x"), true);
  assert.equal(isPendingQueueKey(PQ_QUARANTINE_SESSION_PREFIX + "x"), true);
  const dev = store();
  moverSerieACuarentena(dev, { opId: OP(81), alumno_id: A, exId: "x", kg: 1, reps: 1 }, {}, 1);
  moverSerieACuarentena(dev, { opId: OP(82), alumno_id: B, exId: "x", kg: 1, reps: 1 }, {}, 1);
  assert.equal(leerCuarentena(dev, A).series.length, 1); assert.equal(leerCuarentena(dev, B).series.length, 1);
});
await t("si no se puede escribir la cuarentena (cuota), el pendiente queda intacto: nada se pierde", async () => {
  const srv = servidor(), dev = store();
  const it = registrar(dev, A, 83);
  srv.limpiar(A);
  const setItem = dev.setItem;
  dev.setItem = (k, v) => { if (k.startsWith(PQ_QUARANTINE_PREFIX)) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } return setItem(k, v); };
  const r = await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  assert.equal(r.quarantined || 0, 0);
  assert.ok(dev.getItem(PQ_ITEM_PREFIX + it.opId), "el pendiente sigue");
});
await t("sesiones: IT409 al finalizar -> HISTORIAL_REINICIADO; cuarentena idempotente por clave", async () => {
  const srv = servidor(), dev = store();
  srv.limpiar(A);
  const payload = buildSessionPayload({ alumnoId: A, session: { dIdx: 0 }, activeDay: { label: "Día 1" }, activeRoutine: { name: "R" }, exercises: [], weekToSave: 1, date: "2/11/2026", time: "10:00", ciclo: 1, historialToken: uuid(999) });
  const sb = { getSesiones: async () => srv.sesiones, addSesion: srv.addSesion };
  const r = await persistSessionConfirmed({ sb, alumnoId: A, payload, date: "2/11/2026", dayIndex: 0, weekToSave: 1, ciclo: 1, isOnline: true, timeoutMs: 500 });
  assert.deepEqual([r.confirmed, r.reason], [false, FINALIZE_FAILURE.HISTORIAL_REINICIADO]);
  assert.equal(guardarSesionEnCuarentena(dev, payload, {}, 1).ok, true);
  guardarSesionEnCuarentena(dev, Object.assign({}, payload, { fecha: "02/11/2026" }), {}, 2);
  assert.equal(leerCuarentena(dev, A).sesiones.length, 1, "misma clave (fecha normalizada)");
  assert.equal(claveSesion(payload), A + "|02/11/2026|0|1|1");
});

// ───────────────────────── «Subir igual» ─────────────────────────
await t("subir igual: confirma la epoca VIGENTE, sube series y sesiones y las saca de la cuarentena (con auditoria)", async () => {
  const srv = servidor(), dev = store();
  await refrescar(dev, srv, A);
  registrar(dev, A, 90); registrar(dev, A, 91);
  srv.limpiar(A);
  await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  guardarSesionEnCuarentena(dev, { alumno_id: A, fecha: "2/11/2026", dia_idx: 0, semana: 1, dia_label: "Día 1" }, {}, 3);
  const conf = await prepararConfirmacionReingreso({ rpc: srv.rpc, storage: dev, alumnoId: A });
  assert.deepEqual([conf.ok, conf.epoch], [true, 1]);
  const r = await ejecutarReingreso({ rpc: srv.rpc, storage: dev, alumnoId: A, epochConfirmado: conf.epoch });
  assert.deepEqual([r.ok, r.resumen.subidos], [true, 3]);
  assert.equal(contarCuarentena(dev, A), 0);
  assert.equal(srv.progreso.get(OP(90)).historial_epoch, 1);
});
await t("subir igual: si el entrenador borra OTRA VEZ despues de confirmar -> conflicto_epoch y no se sube nada", async () => {
  const srv = servidor(), dev = store();
  registrar(dev, A, 92);
  srv.limpiar(A);
  await flushPendingForAlumno({ storage: dev, alumnoId: A, send: enviar(srv, A), timeoutMs: 500 });
  const conf = await prepararConfirmacionReingreso({ rpc: srv.rpc, storage: dev, alumnoId: A });
  srv.limpiar(A);
  const r = await ejecutarReingreso({ rpc: srv.rpc, storage: dev, alumnoId: A, epochConfirmado: conf.epoch });
  assert.deepEqual([r.ok, r.reason], [false, "conflicto_epoch"]);
  assert.equal(srv.progreso.size, 0); assert.equal(contarCuarentena(dev, A), 1);
});
await t("subir igual: invalidas quedan en cuarentena; lotes de 200 como maximo", async () => {
  const srv = servidor(), dev = store();
  srv.limpiar(A);
  moverSerieACuarentena(dev, { opId: OP(93), alumno_id: A, exId: "x", kg: -5, reps: 5, date: "2/11/2026", semana: 1 }, {}, 1);
  const r = await ejecutarReingreso({ rpc: srv.rpc, storage: dev, alumnoId: A, epochConfirmado: 1 });
  assert.deepEqual([r.ok, r.resumen.invalidos, contarCuarentena(dev, A)], [true, 1, 1]);
  const muchas = { series: Array.from({ length: 450 }, (_, i) => ({ item: { opId: OP(1000 + i), exId: "x", kg: 1, reps: 1 } })), sesiones: [] };
  assert.deepEqual(prepararReingreso(muchas).map((l) => l.series.length), [LOTE_MAX_REINGRESO, LOTE_MAX_REINGRESO, 50]);
});
await t("subir igual sin borrado vigente (modo off / rollback): series vuelven a pendientes, sesiones por la via normal", async () => {
  const srv = servidor(), dev = store();
  moverSerieACuarentena(dev, { opId: OP(94), alumno_id: B, exId: "x", kg: 10, reps: 5, date: "2/11/2026", semana: 1 }, {}, 1);
  guardarSesionEnCuarentena(dev, { alumno_id: B, fecha: "2/11/2026", dia_idx: 0, semana: 1 }, {}, 1);
  const r = await ejecutarReingreso({ rpc: srv.rpc, storage: dev, alumnoId: B, epochConfirmado: 0, addSesion: srv.addSesion });
  assert.deepEqual([r.ok, r.reason, r.resumen.liberadas, r.resumen.subidos], [true, "sin_borrado", 1, 1]);
  assert.equal(visiblePendingItems(dev, B).length, 1); assert.equal(contarCuarentena(dev, B), 0);
});
await t("liberar (modo off): movimiento escribir-luego-quitar; descartar solo por accion explicita", () => {
  const dev = store();
  moverSerieACuarentena(dev, { opId: OP(95), alumno_id: A, exId: "x", kg: 1, reps: 1 }, {}, 1);
  moverSerieACuarentena(dev, { opId: OP(96), alumno_id: A, exId: "x", kg: 1, reps: 1 }, {}, 1);
  assert.equal(descartarDeCuarentena(dev, "serie", OP(96)), true);
  assert.equal(liberarSeriesDeCuarentena(dev, A), 1);
  assert.ok(dev.getItem(PQ_ITEM_PREFIX + OP(95))); assert.equal(contarCuarentena(dev, A), 0);
});

// ───────────────────────── Controlador e indicador ─────────────────────────
await t("controlador: la cuarentena se expone aparte, no cuenta como pendiente ni programa reintentos; onTrigger se invoca", async () => {
  const srv = servidor(), dev = store();
  registrar(dev, A, 97);
  srv.limpiar(A);
  const timers = []; const disparos = [];
  const ctl = createPendingSyncController({
    storage: dev, getAlumnoId: () => A, isOnline: () => true, sendItem: (item) => enviar(srv, A)(item),
    setTimer: (fn, ms) => { timers.push(ms); return timers.length; }, clearTimer: () => {}, timeoutMs: 500,
    onTrigger: (aid, reason) => { disparos.push(reason); },
  });
  const r = await ctl.trigger("visible");
  assert.deepEqual([r.sent, r.failed, r.quarantined], [0, 0, 1]);
  const st = ctl.getState();
  assert.deepEqual([st.status, st.pending, st.quarantined, st.quarantinedItems[0].tipo], ["idle", 0, 1, "serie"]);
  assert.deepEqual(timers, [], "sin reintentos programados");
  assert.deepEqual(disparos, ["visible"]);
});
await t("ancla del entrenamiento: conserva el sello con el que EMPEZO (recuperacion tras recarga de Safari)", () => {
  const dev = store();
  const base = { rId: "r1", dIdx: 0, exIdx: 0, startTime: Date.UTC(2026, 10, 6, 12), historialToken: uuid(5) };
  const a = prepararInicioEntrenamiento({ storage: dev, session: base, alumnoId: A, ciclo: 1, semana: 0, now: base.startTime });
  assert.equal(leerSesionActiva(dev).sello, uuid(5));
  const b = prepararInicioEntrenamiento({ storage: dev, session: Object.assign({}, base, { startTime: base.startTime + 60000, historialToken: uuid(6) }), alumnoId: A, ciclo: 1, semana: 0, now: base.startTime + 60000 });
  assert.deepEqual([b.recuperada, b.session.historialToken], [true, uuid(5)]);
  void a;
  const dev2 = store();
  prepararInicioEntrenamiento({ storage: dev2, session: Object.assign({}, base, { historialToken: null }), alumnoId: A, ciclo: 1, semana: 0, now: base.startTime });
  assert.ok(!("sello" in JSON.parse(dev2.getItem(ACTIVE_WORKOUT_KEY))), "sin sello el ancla queda con el formato anterior");
});

// Indicador y modal (JSX) via esbuild + react-dom/server, como los otros scripts/test-*.mjs.
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-hist-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react"; import { renderToStaticMarkup } from "react-dom/server";' +
      'import PendingSyncIndicator, { describeQuarantine } from "./components/workout/PendingSyncIndicator.jsx";' +
      'import HistorialCuarentenaModal, { textoResultadoReingreso, textoRegistro } from "./components/workout/HistorialCuarentenaModal.jsx";' +
      'import { getCoachDialogModalConfig } from "./components/coach/coachDialogConfig.js";' +
      "export { React, renderToStaticMarkup, PendingSyncIndicator, describeQuarantine, HistorialCuarentenaModal, textoResultadoReingreso, textoRegistro, getCoachDialogModalConfig };",
    resolveDir: ROOT, sourcefile: "hist-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const UI = await import(pathToFileURL(outfile).href);
await t("indicador: aviso de revision con boton (44 px) y textos; oculto sin cuarentena", () => {
  assert.equal(UI.describeQuarantine({ alumnoId: A, quarantined: 0 }, true).visible, false);
  const d = UI.describeQuarantine({ alumnoId: A, quarantined: 2 }, true);
  assert.match(d.text, /reinició tu historial\. 2 registros de este teléfono quedaron en revisión/);
  const html = UI.renderToStaticMarkup(UI.React.createElement(UI.PendingSyncIndicator, { state: { alumnoId: A, status: "idle", pending: 0, quarantined: 1, quarantinedItems: [{}] }, es: true, onReviewQuarantine: () => {} }));
  assert.match(html, /data-qa-quarantine="1"/); assert.match(html, />Revisar</); assert.match(html, /min-height:44px/);
});
await t("modal: lista los registros con Conservar/Descartar/Subir igual; textos de resultado (incluido conflicto)", () => {
  const dev = store();
  moverSerieACuarentena(dev, { opId: OP(98), alumno_id: A, exId: "sentadilla", kg: 100, reps: 5, date: "2/11/2026" }, {}, 1);
  const html = UI.renderToStaticMarkup(UI.React.createElement(UI.HistorialCuarentenaModal, { alumnoId: A, storage: dev, rpc: async () => ({}), es: true, onClose: () => {} }));
  assert.match(html, /role="dialog"/); assert.match(html, /sentadilla · 100 kg × 5 · 2\/11\/2026/);
  assert.match(html, />Descartar</); assert.match(html, />Subir igual</); assert.match(html, />Conservar y cerrar</);
  assert.match(UI.textoResultadoReingreso({ ok: false, reason: "conflicto_epoch" }, true), /volvió a reiniciar tu historial.*No se subió nada/);
  assert.match(UI.textoResultadoReingreso({ ok: true, resumen: { subidos: 2, invalidos: 1 } }, true), /2 registros subidos\. 1 no se pudieron subir/);
});
await t("dialogo del entrenador: alumno sin vinculo (con y sin solicitud) exige confirmacion explicita", () => {
  const msg = (es) => es;
  const con = UI.getCoachDialogModalConfig({ t: "clearProgressSinVinculo", a: { nombre: "Ficticio" }, solicitud: { auth_uid: uuid(1), email: "tres@ficticio.test" } }, msg, true);
  assert.equal(con.confirmLabel, "Vincular y limpiar"); assert.equal(con.requireAcknowledge, true); assert.match(con.acknowledgeLabel, /tres@ficticio\.test/);
  const sin = UI.getCoachDialogModalConfig({ t: "clearProgressSinVinculo", a: { nombre: "Ficticio" }, solicitud: null }, msg, true);
  assert.equal(sin.confirmLabel, "Limpiar igual"); assert.match(sin.message, /quedará en revisión en su teléfono/);
  assert.match(UI.getCoachDialogModalConfig({ t: "clearProgress", a: { nombre: "F" } }, msg, true).message, /no volverán a subirse solas/);
});

console.log(`\n${n} pruebas OK` + (failed ? `, ${failed} FALLIDAS` : ""));
process.exit(failed ? 1 : 0);
