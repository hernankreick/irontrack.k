// Cola offline de series pendientes de sincronizar (localStorage "it_pending_sync").
//
// Reglas (Etapa 1, protección de series pendientes):
//  - Cada elemento lleva un opId estable (UUID generado al registrar la serie, conservado en todos los reintentos) y el alumno_id dueño.
//    Elementos antiguos (sin esos campos) siguen siendo validos: se "adoptan" para el alumno de la sesion que los sincroniza.
//  - Toda modificacion lee y escribe localStorage de forma sincrona (read-modify-write) y NUNCA usa indices: tras un flush solo se
//    quitan los elementos confirmados por opId. Lo encolado o eliminado mientras el flush corria no se pierde ni resucita.
//  - Cada alumno solo ve y sincroniza SUS elementos; los de otros quedan intactos en el dispositivo.
//  - El flush corre bajo un cerrojo: por pestaña (variable) y entre pestañas (Web Locks API, cuando el navegador la ofrece).
//  - Entrega 0a: ademas del arreglo se LEEN los elementos del formato por clave (it_pq:<opId>, ver lib/pendingQueueKeyed.js). En 0a nada los escribe en
//    produccion; la escritura sigue en el arreglo. Con solo el arreglo, el comportamiento es identico al anterior.
//  - El opId es solo identidad LOCAL: no se envia a Supabase (la tabla no tiene columna) y NO garantiza idempotencia en el servidor.
import { parsePendingQueue, persistSetConfirmed } from "./workoutSession.js";
import { readKeyedItems, readDoneMap, unifyPending, removeConfirmedKeyed, gcDoneMarks } from "./pendingQueueKeyed.js";

export const PENDING_SYNC_KEY = "it_pending_sync";
export const PENDING_SYNC_FLUSH_LOCK = "it_pending_sync_flush";

export function generateOpId(env) {
  var c = env && env.crypto !== undefined ? env.crypto : (typeof globalThis !== "undefined" ? globalThis.crypto : null);
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  var bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") c.getRandomValues(bytes);
  else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  var h = Array.prototype.map.call(bytes, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
  return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
}

export function readQueue(storage) {
  var raw = null;
  try { raw = storage.getItem(PENDING_SYNC_KEY); } catch (e) {}
  var q = parsePendingQueue(raw);
  return { raw: raw, items: q.items, corrupt: q.corrupt };
}

function writeQueue(storage, items) {
  try {
    if (!items.length) storage.removeItem(PENDING_SYNC_KEY);
    else storage.setItem(PENDING_SYNC_KEY, JSON.stringify(items));
  } catch (e) {}
}

// Lectura-modificacion-escritura SINCRONA sobre lo guardado (fuente de verdad; no el estado de React). Si lo guardado estaba corrupto
// se respalda antes de reemplazarlo.
export function updateQueue(storage, fn) {
  var q = readQueue(storage);
  if (q.corrupt && q.raw) { try { storage.setItem(PENDING_SYNC_KEY + "_corrupto_" + Date.now(), q.raw); } catch (e) {} }
  var next = fn(q.items.slice());
  writeQueue(storage, next);
  return next;
}

export function enqueueItem(storage, item) {
  return updateQueue(storage, function (items) { return items.concat([item]); });
}

export function itemsForAlumno(items, alumnoId) {
  if (alumnoId == null || alumnoId === "") return [];
  var id = String(alumnoId);
  return (Array.isArray(items) ? items : []).filter(function (it) { return it && typeof it === "object" && it.alumno_id != null && String(it.alumno_id) === id; });
}

// Vista unificada de lo pendiente: arreglo antiguo + elementos por clave (sin duplicados ni lo ya confirmado). corrupt = el ARREGLO esta corrupto.
export function readAllPending(storage) {
  var q = readQueue(storage);
  var u = unifyPending(q.items, readKeyedItems(storage), readDoneMap(storage));
  return { items: u.items, corrupt: q.corrupt, keyedIds: u.keyedIds, legacyIds: u.legacyIds, invalidKeyed: u.invalidKeyed };
}

export function visiblePendingItems(storage, alumnoId) {
  return itemsForAlumno(readAllPending(storage).items, alumnoId);
}

// Elementos de versiones anteriores (sin alumno_id / opId): se asignan al alumno de la sesion que sincroniza (la version anterior
// borraba la cola en cada login, asi que pertenecian a la sesion vigente). No se toca la cola si esta corrupta.
export function adoptLegacyItems(storage, alumnoId, idGen) {
  return updateQueue(storage, function (items) {
    return items.map(function (it) {
      if (!it || typeof it !== "object") return it;
      if (it.alumno_id != null && it.opId) return it;
      var out = Object.assign({}, it);
      if (out.alumno_id == null) out.alumno_id = String(alumnoId);
      if (!out.opId) out.opId = idGen();
      return out;
    });
  });
}

// Al iniciar sesion: lo que no tiene dueño conocido (version anterior) no se puede atribuir al usuario nuevo -> se descarta, igual que antes.
// Los elementos con alumno_id se conservan siempre.
export function dropUnattributedItems(storage) {
  var q = readQueue(storage);
  if (q.corrupt || !q.items.length) return q.items;
  var kept = q.items.filter(function (it) { return it && typeof it === "object" && it.alumno_id != null; });
  if (kept.length !== q.items.length) writeQueue(storage, kept);
  return kept;
}

/**
 * Sincroniza los elementos del alumno. send(item) => Promise<fila[] | null>.
 * Un elemento se quita de la cola SOLO si el servidor devolvio la fila (confirmado); se identifica por opId, nunca por posicion.
 */
export async function flushPendingForAlumno(params) {
  var p = params || {};
  var storage = p.storage;
  if (p.alumnoId == null || p.alumnoId === "") return { skipped: "no-alumno", sent: 0, failed: 0 };
  if (readQueue(storage).corrupt) return { skipped: "corrupt", sent: 0, failed: 0 };
  var idGen = p.idGen || generateOpId;
  adoptLegacyItems(storage, p.alumnoId, idGen);
  var all = readAllPending(storage);
  var snapshot = itemsForAlumno(all.items, p.alumnoId);
  if (!snapshot.length) return { sent: 0, failed: 0 };
  var outcomes = await Promise.all(snapshot.map(function (item) {
    return persistSetConfirmed({ addProgreso: function () { return p.send(item); }, timeoutMs: p.timeoutMs });
  }));
  var confirmed = {};
  var sent = 0;
  outcomes.forEach(function (o, i) { if (o.confirmed) { confirmed[snapshot[i].opId] = true; sent++; } });
  if (sent > 0) {
    // Arreglo antiguo: solo si hubo confirmados que viven en el (con solo el arreglo es exactamente el comportamiento anterior).
    var confirmedIds = Object.keys(confirmed);
    var touchesArray = confirmedIds.some(function (id) { return all.legacyIds[id] || !all.keyedIds[id]; });
    if (touchesArray) {
      updateQueue(storage, function (items) {
        return items.filter(function (it) { return !(it && it.opId && confirmed[it.opId]); });
      });
    }
    // Formato por clave: marca de confirmada + borrado del elemento (solo ante confirmacion inequivoca, por opId).
    var removedKeyed = false;
    confirmedIds.forEach(function (id) {
      if (all.keyedIds[id]) { removeConfirmedKeyed(storage, id); removedKeyed = true; }
    });
    if (removedKeyed) gcDoneMarks(storage);
  }
  return { sent: sent, failed: snapshot.length - sent };
}

var flushInFlight = false;

/**
 * Ejecuta fn() como unico flush: cerrojo por pestaña + (si existe) Web Locks entre pestañas con ifAvailable (si otra pestaña lo tiene, no espera).
 * Devuelve { ran: false } si no corrio. env.locks permite inyectar navigator.locks en pruebas.
 */
export async function withFlushLock(fn, env) {
  if (flushInFlight) return { ran: false };
  flushInFlight = true;
  try {
    var locks = env && env.locks !== undefined ? env.locks : (typeof navigator !== "undefined" ? navigator.locks : null);
    if (locks && typeof locks.request === "function") {
      var out = { ran: false };
      await locks.request(PENDING_SYNC_FLUSH_LOCK, { ifAvailable: true }, async function (lock) {
        if (!lock) return;
        out = { ran: true, value: await fn() };
      });
      return out;
    }
    return { ran: true, value: await fn() };
  } finally {
    flushInFlight = false;
  }
}
