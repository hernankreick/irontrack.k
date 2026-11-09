// D76-09 — Cuarentena persistente de series y sesiones rechazadas por un borrado de historial (IT409), y «subir igual».
//
// Reglas:
//  - Lo rechazado NUNCA se borra solo. Pasa de pendiente a cuarentena con un movimiento a prueba de cortes:
//      1) se escribe it_pqq:<opId> (serie) / it_pqs:<clave> (sesion) y se verifica;  2) recien entonces se quita el pendiente.
//    Si la app se corta entre 1 y 2, existen las dos copias y gana la cuarentena (unifyPending la excluye de lo pendiente).
//  - No cuenta como pendiente ni como error; no se reintenta. El cierre de sesion la conserva (isPendingQueueKey).
//  - Solo sale de la cuarentena por:
//      · «Subir igual» (accion explicita del alumno, con confirmacion): RPC it_historial_reingresar con la epoca que se le mostro;
//        si el entrenador volvio a borrar entretanto, el servidor responde conflicto_epoch y todo queda en cuarentena.
//      · «Descartar» (accion explicita, con confirmacion).
//      · Modo 'off' del servidor (rollback): las series vuelven a pendientes (movimiento, no borrado).
// Sin dependencias de React ni de Supabase.
import { PQ_ITEM_PREFIX, PQ_STATE_PREFIX, PQ_QUARANTINE_PREFIX, PQ_QUARANTINE_SESSION_PREFIX } from "./pendingQueueKeyed.js";
import { RPC_HISTORIAL, obtenerSello } from "./historialSello.js";
import { normalizeFecha } from "./normalizeFecha.js";

export var LOTE_MAX_REINGRESO = 200;

function keysWithPrefix(storage, prefix) {
  var out = [];
  var n = 0;
  try { n = storage.length; } catch (e) { return out; }
  for (var i = 0; i < n; i++) {
    var k = null;
    try { k = storage.key(i); } catch (e) { k = null; }
    if (typeof k === "string" && k.indexOf(prefix) === 0) out.push(k);
  }
  return out;
}

function leerJson(storage, key) {
  try {
    var raw = storage.getItem(key);
    if (raw == null) return null;
    var v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch (e) {
    return null;
  }
}

function escribirVerificado(storage, key, value) {
  var text;
  try { text = JSON.stringify(value); } catch (e) { return false; }
  try { storage.setItem(key, text); } catch (e) { return false; }
  try { return storage.getItem(key) === text; } catch (e) { return false; }
}

function quitar(storage, key) {
  try { storage.removeItem(key); return true; } catch (e) { return false; }
}

/** Clave estable de una sesion: alumno|fecha normalizada|dia|semana|ciclo (misma identidad que sessionAlreadyExists). */
export function claveSesion(payload) {
  var p = payload || {};
  var ciclo = Number(p.ciclo) > 1 ? Number(p.ciclo) : 1;
  return [String(p.alumno_id || ""), normalizeFecha(String(p.fecha || "")), String(p.dia_idx), String(p.semana), String(ciclo)].join("|");
}

/**
 * Mueve una serie pendiente (formato de lib/workoutSession.js buildPendingProgressItem) a la cuarentena y quita su copia por clave
 * (it_pq / it_pqf). La copia del arreglo antiguo la quita el que llama (lib/pendingSyncQueue.js), por opId. Nunca lanza.
 * Devuelve { ok } — si no se pudo escribir la cuarentena, el pendiente queda intacto (se volvera a enviar y a rechazar: no se pierde).
 */
export function moverSerieACuarentena(storage, item, meta, now) {
  if (!storage || !item || typeof item.opId !== "string" || !item.opId) return { ok: false };
  var m = meta || {};
  var key = PQ_QUARANTINE_PREFIX + item.opId;
  var previo = leerJson(storage, key);
  var registro = previo || {
    tipo: "serie",
    id: item.opId,
    alumno_id: item.alumno_id != null ? String(item.alumno_id) : null,
    item: item,
    motivo: m.motivo || null,
    epochVigente: m.epochVigente != null ? m.epochVigente : null,
    rechazadoAt: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
  };
  if (!previo && !escribirVerificado(storage, key, registro)) return { ok: false };
  quitar(storage, PQ_ITEM_PREFIX + item.opId);
  quitar(storage, PQ_STATE_PREFIX + item.opId);
  return { ok: true };
}

/** Guarda en cuarentena una sesion rechazada (payload de buildSessionPayload). Idempotente por clave. Nunca lanza. */
export function guardarSesionEnCuarentena(storage, payload, meta, now) {
  if (!storage || !payload || payload.alumno_id == null) return { ok: false };
  var m = meta || {};
  var clave = claveSesion(payload);
  var key = PQ_QUARANTINE_SESSION_PREFIX + clave;
  if (leerJson(storage, key)) return { ok: true, clave: clave };
  var ok = escribirVerificado(storage, key, {
    tipo: "sesion",
    id: clave,
    alumno_id: String(payload.alumno_id),
    payload: payload,
    motivo: m.motivo || null,
    epochVigente: m.epochVigente != null ? m.epochVigente : null,
    rechazadoAt: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
  });
  return { ok: ok, clave: clave };
}

/** Registros en cuarentena del alumno: { series: [...], sesiones: [...] } (orden por fecha de rechazo). */
export function leerCuarentena(storage, alumnoId) {
  var out = { series: [], sesiones: [] };
  if (!storage || alumnoId == null || alumnoId === "") return out;
  var aid = String(alumnoId);
  keysWithPrefix(storage, PQ_QUARANTINE_PREFIX).forEach(function (k) {
    var r = leerJson(storage, k);
    if (r && r.alumno_id === aid && r.item) out.series.push(r);
  });
  keysWithPrefix(storage, PQ_QUARANTINE_SESSION_PREFIX).forEach(function (k) {
    var r = leerJson(storage, k);
    if (r && r.alumno_id === aid && r.payload) out.sesiones.push(r);
  });
  var orden = function (a, b) { return (Number(a.rechazadoAt) || 0) - (Number(b.rechazadoAt) || 0); };
  out.series.sort(orden);
  out.sesiones.sort(orden);
  return out;
}

export function contarCuarentena(storage, alumnoId) {
  var q = leerCuarentena(storage, alumnoId);
  return q.series.length + q.sesiones.length;
}

/** Descarta UN registro (solo por accion explicita del alumno, con confirmacion en la interfaz). */
export function descartarDeCuarentena(storage, tipo, id) {
  if (!storage || !id) return false;
  return quitar(storage, (tipo === "sesion" ? PQ_QUARANTINE_SESSION_PREFIX : PQ_QUARANTINE_PREFIX) + id);
}

/**
 * Devuelve las SERIES en cuarentena del alumno a pendientes (modo 'off' del servidor / historial sin borrado). Movimiento a prueba de
 * cortes: primero se escribe it_pq:<opId>, despues se quita la cuarentena. Las sesiones se quedan (se suben con «Subir igual»).
 */
export function liberarSeriesDeCuarentena(storage, alumnoId) {
  var n = 0;
  leerCuarentena(storage, alumnoId).series.forEach(function (r) {
    var it = r.item;
    if (!it || typeof it.opId !== "string") return;
    var key = PQ_ITEM_PREFIX + it.opId;
    var existente = null;
    try { existente = storage.getItem(key); } catch (e) { existente = null; }
    if (existente == null && !escribirVerificado(storage, key, it)) return;
    if (quitar(storage, PQ_QUARANTINE_PREFIX + it.opId)) n++;
  });
  return n;
}

function numOrNull(v) {
  var n = Number(v);
  return v == null || v === "" || !Number.isFinite(n) ? null : n;
}

/** Arma los lotes para it_historial_reingresar (nombres del servidor). Maximo LOTE_MAX_REINGRESO por llamada. */
export function prepararReingreso(cuarentena) {
  var q = cuarentena || { series: [], sesiones: [] };
  var series = q.series.map(function (r) {
    var it = r.item || {};
    return {
      id: it.opId, ejercicio_id: it.exId != null ? String(it.exId) : "", kg: numOrNull(it.kg), reps: numOrNull(it.reps),
      nota: it.note || "", fecha: it.date, semana: numOrNull(it.semana), ciclo: numOrNull(it.ciclo), epoch_original: numOrNull(it.historial_epoch_visto),
    };
  });
  var sesiones = q.sesiones.map(function (r) {
    var s = r.payload || {};
    return {
      clave: r.id, fecha: s.fecha, dia_idx: numOrNull(s.dia_idx), semana: numOrNull(s.semana), ciclo: numOrNull(s.ciclo),
      rutina_id: s.rutina_id != null ? String(s.rutina_id) : null, rutina_nombre: s.rutina_nombre || "", dia_label: s.dia_label || "",
      ejercicios: s.ejercicios || "", hora: s.hora || "", epoch_original: numOrNull(s.historial_epoch_visto),
    };
  });
  var lotes = [];
  var todo = series.map(function (x) { return { t: "serie", x: x }; }).concat(sesiones.map(function (x) { return { t: "sesion", x: x }; }));
  for (var i = 0; i < todo.length; i += LOTE_MAX_REINGRESO) {
    var parte = todo.slice(i, i + LOTE_MAX_REINGRESO);
    lotes.push({
      series: parte.filter(function (e) { return e.t === "serie"; }).map(function (e) { return e.x; }),
      sesiones: parte.filter(function (e) { return e.t === "sesion"; }).map(function (e) { return e.x; }),
    });
  }
  return lotes;
}

/** Aplica la respuesta del servidor: 'insertada' / 'ya_existia' salen de la cuarentena; el resto queda. Devuelve el resumen. */
export function aplicarResultadoReingreso(storage, resultados) {
  var res = { subidos: 0, yaExistian: 0, invalidos: 0, conflictos: 0 };
  (Array.isArray(resultados) ? resultados : []).forEach(function (r) {
    if (!r) return;
    var id = r.tipo === "sesion" ? r.clave : r.id;
    if (r.resultado === "insertada" || r.resultado === "ya_existia") {
      descartarDeCuarentena(storage, r.tipo, id);
      if (r.resultado === "insertada") res.subidos++; else res.yaExistian++;
    } else if (r.resultado === "invalida") {
      res.invalidos++;
    } else {
      res.conflictos++;
    }
  });
  return res;
}

/**
 * Paso 1 de «Subir igual»: lee el estado VIGENTE del servidor para mostrarlo en la confirmacion (fecha del borrado y epoca).
 * Devuelve { ok, epoch, reset_at } | { ok:false, reason }.
 */
export async function prepararConfirmacionReingreso(params) {
  var p = params || {};
  var r = await obtenerSello({ rpc: p.rpc, storage: p.storage, alumnoId: p.alumnoId, now: p.now });
  if (!r.ok) return { ok: false, reason: r.capacidad === false ? "sin_capacidad" : r.sinPermiso ? "sin_permiso" : "error" };
  return { ok: true, epoch: r.estado.epoch, reset_at: r.estado.reset_at, modo: r.estado.modo };
}

/**
 * Paso 2 de «Subir igual» (tras la confirmacion EXPLICITA): envia la cuarentena con la epoca confirmada.
 *  - conflicto_epoch: hubo otro borrado despues de la confirmacion -> nada sale de la cuarentena.
 *  - sin_borrado (el alumno no tiene borrados vigentes): las series vuelven a pendientes y las sesiones se envian por la via normal
 *    (addSesion(payload) -> filas | null | marca de rechazo), sin sello.
 * Devuelve { ok, reason?, epoch?, resumen }.
 */
export async function ejecutarReingreso(params) {
  var p = params || {};
  var resumen = { subidos: 0, yaExistian: 0, invalidos: 0, conflictos: 0, liberadas: 0 };
  var q = leerCuarentena(p.storage, p.alumnoId);
  if (!q.series.length && !q.sesiones.length) return { ok: true, resumen: resumen };
  var lotes = prepararReingreso(q);
  for (var i = 0; i < lotes.length; i++) {
    var r;
    try {
      r = await p.rpc(RPC_HISTORIAL.REINGRESAR, {
        p_alumno_id: String(p.alumnoId), p_epoch_confirmado: p.epochConfirmado, p_series: lotes[i].series, p_sesiones: lotes[i].sesiones,
      });
    } catch (e) {
      return { ok: false, reason: "error", resumen: resumen };
    }
    if (!r || r.missing) return { ok: false, reason: "sin_capacidad", resumen: resumen };
    if (r.error) return { ok: false, reason: String(r.error.code || "") === "42501" ? "sin_permiso" : "error", resumen: resumen };
    var d = Array.isArray(r.data) ? r.data[0] : r.data;
    if (!d) return { ok: false, reason: "error", resumen: resumen };
    if (d.ok === false && d.reason === "sin_borrado") {
      resumen.liberadas += liberarSeriesDeCuarentena(p.storage, p.alumnoId);
      for (var j = 0; j < q.sesiones.length; j++) {
        var rs = null;
        try { rs = typeof p.addSesion === "function" ? await p.addSesion(q.sesiones[j].payload) : null; } catch (e) { rs = null; }
        if (Array.isArray(rs) && rs.length) { descartarDeCuarentena(p.storage, "sesion", q.sesiones[j].id); resumen.subidos++; }
      }
      return { ok: true, reason: "sin_borrado", resumen: resumen };
    }
    if (d.ok === false) return { ok: false, reason: d.reason || "error", epoch: d.epoch, resumen: resumen };
    var parcial = aplicarResultadoReingreso(p.storage, d.resultados);
    Object.keys(parcial).forEach(function (k) { resumen[k] += parcial[k]; });
  }
  return { ok: true, resumen: resumen };
}
