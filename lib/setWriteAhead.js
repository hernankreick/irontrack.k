// D76-01 — Guardado "write-ahead" de una serie recien registrada.
//
// Problema: logSet (App.jsx) enviaba la serie a Supabase y SOLO la encolaba (it_pending_sync) cuando el envio terminaba sin confirmacion
// (hasta 15 s). Si Safari descartaba la pestaña antes, la serie quedaba solo en it_pg (estado local) y nunca se reenviaba.
//
// Orden nuevo, a prueba de cortes:
//   1. write-ahead: la serie se persiste PRIMERO como pendiente en el formato por clave (it_pq:<opId>, ver lib/pendingQueueKeyed.js; ya lo
//      leen readKeyedItems / unifyPending / flushPendingForAlumno). Si no se puede persistir, el que llama NO registra la serie.
//   2. POST idempotente (progreso.id = opId) con persistSetConfirmed.
//   3. El pendiente se retira (removeConfirmedKeyed: marca it_pqd + borrado) SOLO ante confirmacion inequivoca del servidor. Ante error,
//      timeout o respuesta desconocida queda en cola con el MISMO opId y el proximo flush lo reenvia (el servidor deduplica por id).
//
// El registro "en vuelo" es solo coordinacion en memoria de ESTA pestaña (el flush no vuelve a enviar lo que ya se esta enviando aqui);
// no se persiste: si la pestaña muere, el pendiente sigue en storage y lo envia la siguiente carga.
import { CAMPOS_IDENTIDAD_SERIE, extraerIdentidadSerie } from "./serieIdentidad.js";
import { PQ_ITEM_PREFIX, PQ_DONE_PREFIX, removeConfirmedKeyed } from "./pendingQueueKeyed.js";
import { readQueue, updateQueue, pendienteEnviable } from "./pendingSyncQueue.js";
import { persistSetConfirmed } from "./workoutSession.js";

function isQuotaError(e) {
  return !!(e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014));
}

/**
 * Persiste la serie como pendiente ANTES de enviarla. Nunca lanza.
 * Devuelve { ok: true } o { ok: false, reason: "invalid" | "storage_unavailable" | "quota" | "verify_failed" | "already_confirmed" }.
 */
export function writeAheadPendingSet(storage, item, now) {
  if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.opId !== "string" || !item.opId || item.alumno_id == null || item.alumno_id === "") {
    return { ok: false, reason: "invalid" };
  }
  if (storage == null) return { ok: false, reason: "storage_unavailable" };
  var key = PQ_ITEM_PREFIX + item.opId;
  var existed = false;
  try {
    if (storage.getItem(PQ_DONE_PREFIX + item.opId) != null) return { ok: false, reason: "already_confirmed" };
    existed = storage.getItem(key) != null;
  } catch (e) {
    return { ok: false, reason: "storage_unavailable" };
  }
  // Arreglo antiguo corrupto: se respalda (it_pending_sync_corrupto_*) como hacia enqueueItem; si no, el flush omitiria todo y la serie quedaria trabada.
  try { if (readQueue(storage).corrupt) updateQueue(storage, function (x) { return x; }); } catch (e) {}
  var text;
  try {
    // PR-4: si el pendiente ya existe (reintento con el mismo opId) su identidad local NO se modifica: se conservan exactamente sus
    // campos sesion_uid/bloque/pos (o su ausencia, si era un registro sin identidad).
    var aGuardar = Object.assign({}, item);
    if (existed) {
      var previo = null;
      try { previo = JSON.parse(storage.getItem(key)); } catch (e) { previo = null; }
      if (previo && typeof previo === "object" && !Array.isArray(previo)) {
        CAMPOS_IDENTIDAD_SERIE.forEach(function (c) { delete aGuardar[c]; });
        Object.assign(aGuardar, extraerIdentidadSerie(previo));
      }
    }
    text = JSON.stringify(Object.assign({}, aGuardar, { createdAt: now }));
  } catch (e) {
    return { ok: false, reason: "invalid" };
  }
  try {
    storage.setItem(key, text);
  } catch (e) {
    if (!existed) { try { storage.removeItem(key); } catch (e2) {} }
    return { ok: false, reason: isQuotaError(e) ? "quota" : "storage_unavailable" };
  }
  var back;
  try { back = storage.getItem(key); } catch (e) { back = undefined; }
  if (back !== text) {
    if (!existed) { try { storage.removeItem(key); } catch (e) {} }
    return { ok: false, reason: "verify_failed" };
  }
  return { ok: true };
}

// ───────── Envios en curso en ESTA pestaña (solo coordinacion; no persistencia) ─────────
var inFlight = {};

export function isSetSendInFlight(opId) {
  return typeof opId === "string" && Object.prototype.hasOwnProperty.call(inFlight, opId);
}

export function __resetInFlightForTests() {
  inFlight = {};
}

/**
 * Envia una serie ya persistida con writeAheadPendingSet. send() => Promise<fila[] | null>.
 * Solo con confirmacion inequivoca retira el pendiente; en cualquier otro caso no toca el storage. Devuelve { confirmed, reason }. Nunca lanza.
 */
export async function sendWriteAheadSet(params) {
  var p = params || {};
  var opId = p.opId;
  // D7.6: si el pendiente guardado tiene datos invalidos, no se envia (queda en el dispositivo; el flush tampoco lo enviara).
  var guardado = null;
  try { var raw = p.storage ? p.storage.getItem(PQ_ITEM_PREFIX + opId) : null; guardado = raw ? JSON.parse(raw) : null; } catch (e) { guardado = null; }
  if (guardado && !pendienteEnviable(guardado)) return { confirmed: false, reason: "invalid_set" };
  inFlight[opId] = true;
  try {
    var outcome;
    try {
      outcome = await persistSetConfirmed({ addProgreso: p.send, timeoutMs: p.timeoutMs });
    } catch (e) {
      outcome = { confirmed: false, reason: "error" };
    }
    if (outcome && outcome.confirmed) {
      try { removeConfirmedKeyed(p.storage, opId, typeof p.now === "function" ? p.now() : Date.now()); } catch (e) {}
    }
    return outcome || { confirmed: false, reason: "error" };
  } finally {
    delete inFlight[opId];
  }
}
