// Sincronizador ANTIGUO de la cola `it_pending_sync` (array), con identidad por serie (P0 Etapa 1A).
//
// Problema que corrige: el vaciado antiguo de App.jsx enviaba TODAS las series del array usando el alumno_id de la sesion ACTUAL
// (it_session). Las series antiguas no guardan a que alumno pertenecen, asi que si entre registrar y sincronizar cambiaba la sesion
// (logout/login, otra pestana, biometria), las series de un alumno se grababan bajo otro (P0-3).
//
// Reglas de este modulo:
//  - Solo se envia una serie si trae `alumno_id` Y coincide con el alumno de la sesion actual. El payload usa el `alumno_id` de la
//    SERIE, nunca el de la sesion.
//  - Las series sin `alumno_id` (identidad desconocida) y las de otro alumno NO se envian y NO se borran: quedan en el array hasta
//    que login/logout las traslade a la cuarentena / a la cola nueva (lib/irontrackLocalStorage.js -> preserveLegacyPendingQueue).
//  - Tras enviar se vuelve a leer el array y solo se quitan las series enviadas con exito (una vez cada una, por contenido):
//    lo que otra pestana haya agregado mientras tanto, o lo que no se envio, se conserva.
//  - Un array ilegible o con otra forma no se toca.
//
// Este modulo NO es el sincronizador nuevo (cola por clave + idempotencia por UUID); es solo el vaciado antiguo, endurecido. No
// resuelve los duplicados por respuestas ambiguas ni por dos vaciados simultaneos (Etapa 1B).
import { buildProgressPayload } from "./workoutSession.js";
import { PENDING_LEGACY_KEY } from "./pendingSets.js";

function ownerOf(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return "";
  var a = item.alumno_id;
  return a == null ? "" : String(a).trim();
}

/** Separa el array en series enviables ahora (identidad coincide), de identidad desconocida y de otro alumno. */
export function partitionLegacyPending(items, currentAlumnoId) {
  var me = currentAlumnoId == null ? "" : String(currentAlumnoId).trim();
  var out = { eligible: [], unknown: [], foreign: [] };
  (Array.isArray(items) ? items : []).forEach(function (item) {
    var owner = ownerOf(item);
    if (!owner) out.unknown.push(item);
    else if (me && owner === me) out.eligible.push(item);
    else out.foreign.push(item);
  });
  return out;
}

/** Quita de `list` UNA ocurrencia (por contenido) de cada elemento de `toRemove`. Conserva el resto, en orden. */
export function removeOnceEach(list, toRemove) {
  var pending = {};
  (Array.isArray(toRemove) ? toRemove : []).forEach(function (item) {
    var k = JSON.stringify(item);
    pending[k] = (pending[k] || 0) + 1;
  });
  return (Array.isArray(list) ? list : []).filter(function (item) {
    var k = JSON.stringify(item);
    if (pending[k] > 0) {
      pending[k]--;
      return false;
    }
    return true;
  });
}

function readArray(storage) {
  var raw = storage.getItem(PENDING_LEGACY_KEY);
  if (raw == null || raw === "") return { status: "empty", items: [] };
  var parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { status: "corrupt", items: [] };
  }
  if (!Array.isArray(parsed)) return { status: "not_array", items: [] };
  return { status: "ok", items: parsed };
}

/**
 * Vacia la cola antigua para el alumno `alumnoId`.
 *  - storage: por defecto localStorage.
 *  - send(payload) -> Promise<fila|array|null>: un POST a `progreso`; null/rechazo = fallo (la serie se conserva).
 * Devuelve { status: "skipped"|"done", reason?, sent, remaining, withheldUnknown, withheldForeign, storageError? }.
 */
export async function flushLegacyPendingQueue(args) {
  var a = args || {};
  var storage = a.storage || (typeof localStorage !== "undefined" ? localStorage : null);
  var result = { status: "skipped", reason: "", sent: 0, remaining: [], withheldUnknown: 0, withheldForeign: 0, storageError: null };
  if (!storage || typeof a.send !== "function") {
    result.reason = "no_storage_or_sender";
    return result;
  }
  var first = readArray(storage);
  if (first.status !== "ok") {
    result.reason = first.status; // vacio, ilegible o con otra forma: no se toca
    return result;
  }
  result.remaining = first.items;
  if (first.items.length === 0) {
    result.reason = "empty";
    return result;
  }
  var alumnoId = a.alumnoId == null ? "" : String(a.alumnoId).trim();
  if (!alumnoId) {
    result.reason = "no_identity"; // sin sesion: no se envia nada
    return result;
  }
  var parts = partitionLegacyPending(first.items, alumnoId);
  result.withheldUnknown = parts.unknown.length;
  result.withheldForeign = parts.foreign.length;
  if (parts.eligible.length === 0) {
    result.reason = "nothing_eligible";
    return result;
  }

  var results = await Promise.allSettled(parts.eligible.map(function (item) {
    return Promise.resolve().then(function () {
      // la identidad sale de la SERIE, no de la sesion actual
      return a.send(buildProgressPayload(ownerOf(item), item.exId, item.kg, item.reps, item.note, item.date, item.semana));
    });
  }));
  var sentOk = parts.eligible.filter(function (item, idx) {
    var r = results[idx];
    return r && r.status === "fulfilled" && r.value != null;
  });
  result.status = "done";
  result.sent = sentOk.length;
  if (sentOk.length === 0) return result;

  // Releer: otra pestana pudo agregar series mientras se enviaba. Solo se quitan las enviadas.
  var fresh = readArray(storage);
  if (fresh.status !== "ok") {
    result.reason = "changed_" + fresh.status; // no se pisa lo que no se entiende
    return result;
  }
  var next = removeOnceEach(fresh.items, sentOk);
  try {
    if (next.length === 0) storage.removeItem(PENDING_LEGACY_KEY);
    else storage.setItem(PENDING_LEGACY_KEY, JSON.stringify(next));
    result.remaining = next;
  } catch (e) {
    // No se pudo guardar: nada se pierde (las series enviadas seguiran en el array y podrian reenviarse; ver Etapa 1B)
    result.storageError = e && e.message ? e.message : String(e);
    result.remaining = fresh.items;
  }
  return result;
}
