// Cola de series pendientes — almacen POR CLAVE (Entrega 0a: lectura y compatibilidad).
//
// Una clave de localStorage por serie evita la lectura-modificacion-escritura sobre un recurso compartido: con dos pestañas el arreglo
// unico (`it_pending_sync`) pierde elementos (medido: ~1/3 bajo contencion fuerte); agregar/quitar claves distintas no pierde nada.
//
//   it_pq:<opId>   elemento (JSON). Se escribe una vez; no se reescribe.
//   it_pqf:<opId>  estado de envio / libro de intentos (solo lo escribe quien esta enviando ese elemento).
//   it_pqd:<opId>  marca "ya confirmada" (tombstone): impide que una adopcion posterior vuelva a crear un elemento confirmado.
//
// En la Entrega 0a NADA escribe elementos nuevos en este formato en produccion (la escritura sigue en el arreglo antiguo). Esta libreria
// permite leerlo (para que cualquier build desplegado entienda el formato antes de que 0b empiece a escribirlo) y adoptar elementos del
// arreglo antiguo SIN modificarlo ni vaciarlo.
//
// Identidad: solo se adoptan elementos que YA tienen opId y alumno_id (la identidad viaja con el elemento, no depende de su posicion en el
// arreglo). Los que aun no los tienen se dejan intactos: los resuelve la adopcion existente (adoptLegacyItems), que les asigna un opId persistente.

export const LEGACY_QUEUE_KEY = "it_pending_sync";
export const PQ_ITEM_PREFIX = "it_pq:";
export const PQ_STATE_PREFIX = "it_pqf:";
export const PQ_DONE_PREFIX = "it_pqd:";
export const SEND_LOCK_PREFIX = "it_send:";
export const SEND_STALE_MS = 60000;                 // un envio sin terminar pasado este tiempo se considera abandonado (pestaña congelada/muerta)
export const DONE_MAX_AGE_MS = 14 * 24 * 3600 * 1000;

// ¿La clave pertenece a la cola pendiente (formato antiguo, respaldos de corrupcion o formato por clave)? Se usa para NO borrarlas al cerrar sesion.
export function isPendingQueueKey(key) {
  if (typeof key !== "string") return false;
  return key.indexOf(LEGACY_QUEUE_KEY) === 0 || key.indexOf(PQ_ITEM_PREFIX) === 0 || key.indexOf(PQ_STATE_PREFIX) === 0 || key.indexOf(PQ_DONE_PREFIX) === 0;
}

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

function safeGet(storage, key) {
  try { return storage.getItem(key); } catch (e) { return null; }
}

function safeSet(storage, key, value) {
  try { storage.setItem(key, value); return true; } catch (e) { return false; }
}

function safeRemove(storage, key) {
  try { storage.removeItem(key); return true; } catch (e) { return false; }
}

function parseJson(raw) {
  try { return { ok: true, value: JSON.parse(raw) }; } catch (e) { return { ok: false }; }
}

/** Lee los elementos por clave. { items, invalid }: lo invalido (JSON roto o opId distinto de la clave) se informa y NO se toca. */
export function readKeyedItems(storage) {
  var items = [];
  var invalid = [];
  keysWithPrefix(storage, PQ_ITEM_PREFIX).forEach(function (key) {
    var raw = safeGet(storage, key);
    if (raw == null) return;                                    // quitado mientras se enumeraba
    var p = parseJson(raw);
    var opId = key.slice(PQ_ITEM_PREFIX.length);
    if (!p.ok || !p.value || typeof p.value !== "object" || Array.isArray(p.value) || typeof p.value.opId !== "string" || p.value.opId !== opId || !opId) {
      invalid.push(key);
      return;
    }
    items.push(p.value);
  });
  items.sort(function (a, b) {
    var ca = Number(a.createdAt) || 0, cb = Number(b.createdAt) || 0;
    if (ca !== cb) return ca - cb;
    return a.opId < b.opId ? -1 : a.opId > b.opId ? 1 : 0;
  });
  return { items: items, invalid: invalid };
}

/** Mapa opId -> instante (ms) de las series ya confirmadas. La sola presencia de la marca cuenta como confirmada. */
export function readDoneMap(storage) {
  var map = {};
  keysWithPrefix(storage, PQ_DONE_PREFIX).forEach(function (key) {
    var raw = safeGet(storage, key);
    if (raw == null) return;
    var p = parseJson(raw);
    var at = p.ok && p.value && typeof p.value === "object" ? Number(p.value.at) : NaN;
    map[key.slice(PQ_DONE_PREFIX.length)] = Number.isFinite(at) ? at : null;
  });
  return map;
}

/**
 * Vista unificada de lo pendiente: arreglo antiguo + elementos por clave, sin duplicados y sin lo ya confirmado.
 *  - Mismo opId en ambos lados: gana el elemento por clave.
 *  - Elementos del arreglo SIN opId: pasan tal cual (solo existen en el arreglo).
 *  - Cualquier opId con marca de confirmada se oculta (no reaparece aunque siga copiado en el arreglo).
 * Devuelve { items, keyedIds, legacyIds, hiddenLegacyIds, invalidKeyed }. hiddenLegacyIds = opIds que siguen en el arreglo pero ya figuran confirmados.
 */
export function unifyPending(legacyItems, keyedRead, doneMap) {
  var done = doneMap || {};
  var keyed = (keyedRead && keyedRead.items) || [];
  var keyedIds = {};
  var legacyIds = {};
  var hiddenLegacyIds = [];
  var items = [];
  (Array.isArray(legacyItems) ? legacyItems : []).forEach(function (it) {
    if (!it || typeof it !== "object") { items.push(it); return; }
    var id = typeof it.opId === "string" && it.opId ? it.opId : null;
    if (id) {
      if (Object.prototype.hasOwnProperty.call(done, id)) { hiddenLegacyIds.push(id); return; }
      legacyIds[id] = true;
    }
    items.push(it);
  });
  var overridden = {};
  keyed.forEach(function (it) {
    if (Object.prototype.hasOwnProperty.call(done, it.opId)) return;
    keyedIds[it.opId] = true;
    if (legacyIds[it.opId]) overridden[it.opId] = true;
  });
  if (Object.keys(overridden).length) {
    items = items.filter(function (it) { return !(it && typeof it === "object" && it.opId && overridden[it.opId]); });
  }
  keyed.forEach(function (it) { if (keyedIds[it.opId]) items.push(it); });
  return { items: items, keyedIds: keyedIds, legacyIds: legacyIds, hiddenLegacyIds: hiddenLegacyIds, invalidKeyed: (keyedRead && keyedRead.invalid) || [] };
}

/**
 * Copia al formato por clave los elementos del arreglo antiguo que ya tienen opId y alumno_id. NO modifica ni vacia el arreglo.
 *  - Idempotente (misma clave, mismo contenido): dos pestañas adoptando a la vez producen lo mismo.
 *  - No re-crea lo confirmado: si hay marca de confirmada se omite; y si se confirma mientras se adoptaba, el elemento recien escrito se retira.
 *  - Los elementos sin opId/alumno_id no se tocan (su identidad no se puede derivar de forma estable).
 */
export function adoptLegacyArray(storage, legacyItems) {
  var res = { adopted: 0, existing: 0, skippedDone: 0, skippedUnidentified: 0, failed: 0 };
  (Array.isArray(legacyItems) ? legacyItems : []).forEach(function (it) {
    if (!it || typeof it !== "object" || typeof it.opId !== "string" || !it.opId || it.alumno_id == null || it.alumno_id === "") {
      res.skippedUnidentified++;
      return;
    }
    var key = PQ_ITEM_PREFIX + it.opId;
    if (safeGet(storage, PQ_DONE_PREFIX + it.opId) != null) { res.skippedDone++; return; }
    if (safeGet(storage, key) != null) { res.existing++; return; }
    var text = JSON.stringify(it);
    if (!safeSet(storage, key, text) || safeGet(storage, key) !== text) { res.failed++; return; }
    if (safeGet(storage, PQ_DONE_PREFIX + it.opId) != null) {      // se confirmo mientras adoptabamos: no dejar un elemento ya confirmado
      safeRemove(storage, key);
      res.skippedDone++;
      return;
    }
    res.adopted++;
  });
  return res;
}

/**
 * Quita un elemento por clave DESPUES de una confirmacion inequivoca. Orden a prueba de cortes: primero la marca de confirmada, luego se
 * borran el elemento y su estado de envio. Si la app se corta entre medio, la marca ya oculta el elemento.
 */
export function removeConfirmedKeyed(storage, opId, now) {
  if (typeof opId !== "string" || !opId) return { tombstoned: false, removed: false };
  var at = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var tombstoned = safeSet(storage, PQ_DONE_PREFIX + opId, JSON.stringify({ at: at }));
  var removed = safeRemove(storage, PQ_ITEM_PREFIX + opId);
  safeRemove(storage, PQ_STATE_PREFIX + opId);
  return { tombstoned: tombstoned, removed: removed };
}

/**
 * Borra marcas de confirmada con mas de maxAgeMs, SIN permitir que una serie confirmada reaparezca:
 *  - una marca se conserva mientras el arreglo antiguo siga conteniendo ese opId (una pestaña con codigo antiguo puede reescribirlo desde una
 *    lectura vieja; sin la marca esa serie volveria a mostrarse y a enviarse);
 *  - si el arreglo esta corrupto o ilegible no se borra ninguna marca (no se sabe que contiene);
 *  - al vencer la marca se retira tambien la copia por clave ya confirmada (elemento y estado de envio), y la marca se borra al final;
 *  - una marca ilegible se conserva (no se sabe su edad).
 * Devuelve la cantidad de marcas borradas.
 */
export function gcDoneMarks(storage, now, maxAgeMs) {
  var ref = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  var limit = maxAgeMs != null ? maxAgeMs : DONE_MAX_AGE_MS;
  var map = readDoneMap(storage);
  var expired = Object.keys(map).filter(function (opId) { return map[opId] != null && ref - map[opId] > limit; });
  if (!expired.length) return 0;
  var inArray = {};
  var raw = safeGet(storage, LEGACY_QUEUE_KEY);
  if (raw != null && raw !== "") {
    var parsed = parseJson(raw);
    if (!parsed.ok || !Array.isArray(parsed.value)) return 0;
    parsed.value.forEach(function (it) { if (it && typeof it === "object" && typeof it.opId === "string") inArray[it.opId] = true; });
  }
  var removed = 0;
  expired.forEach(function (opId) {
    if (inArray[opId]) return;
    safeRemove(storage, PQ_ITEM_PREFIX + opId);
    safeRemove(storage, PQ_STATE_PREFIX + opId);
    if (safeRemove(storage, PQ_DONE_PREFIX + opId)) removed++;
  });
  return removed;
}

// ───────── Intentos de envio (identificador por intento + proteccion frente a respuestas antiguas) ─────────

function readState(storage, opId) {
  var raw = safeGet(storage, PQ_STATE_PREFIX + opId);
  if (raw == null) return null;
  var p = parseJson(raw);
  return p.ok && p.value && typeof p.value === "object" ? p.value : null;
}

function newAttemptId(idGen) {
  if (typeof idGen === "function") return idGen();
  return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Abre un intento: guarda un attemptId nuevo y conserva el resto del estado. Devuelve { attemptId } o { attemptId: null } si no pudo escribir. */
export function beginAttempt(storage, opId, now, idGen) {
  var prev = readState(storage, opId) || {};
  var attemptId = newAttemptId(idGen);
  var next = Object.assign({}, prev, { attemptId: attemptId, since: Number.isFinite(Number(now)) ? Number(now) : Date.now() });
  return safeSet(storage, PQ_STATE_PREFIX + opId, JSON.stringify(next)) ? { attemptId: attemptId } : { attemptId: null };
}

/**
 * Cierra un intento SOLO si sigue siendo el vigente. Una respuesta antigua (otro attemptId) o de un elemento ya quitado se ignora:
 * nunca sobrescribe el estado de un intento nuevo ni recrea el estado de un elemento confirmado.
 */
export function finishAttempt(storage, opId, attemptId, outcome, now) {
  var cur = readState(storage, opId);
  if (!cur) return { applied: false, reason: "no-state" };
  if (!attemptId || cur.attemptId !== attemptId) return { applied: false, reason: "stale" };
  var o = outcome || {};
  var next = Object.assign({}, cur, {
    attemptId: null,
    lastAt: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
    lastOutcome: o.confirmed ? "confirmed" : (o.reason || "unconfirmed"),
    failCount: o.confirmed ? 0 : (Number(cur.failCount) || 0) + 1,
  });
  return safeSet(storage, PQ_STATE_PREFIX + opId, JSON.stringify(next)) ? { applied: true } : { applied: false, reason: "write-failed" };
}

/** ¿Hay un envio en curso hace mas de SEND_STALE_MS (abandonado)? */
export function isAttemptStale(state, now, staleMs) {
  if (!state || state.attemptId == null) return false;
  var limit = staleMs != null ? staleMs : SEND_STALE_MS;
  var since = Number(state.since);
  if (!Number.isFinite(since)) return true;
  return (Number.isFinite(Number(now)) ? Number(now) : Date.now()) - since > limit;
}

export function readAttemptState(storage, opId) {
  return readState(storage, opId);
}

/**
 * Cerrojo de envio por elemento (Web Locks, ifAvailable). Sin Web Locks corre sin cerrojo (el envio es idempotente: solo habria trafico redundante).
 * Devuelve { ran:false, reason:"busy" } si otro lo tiene, o { ran:true, value, locked }. env.locks permite inyectar navigator.locks en pruebas.
 */
export async function withSendLock(opId, fn, env) {
  var locks = env && env.locks !== undefined ? env.locks : (typeof navigator !== "undefined" ? navigator.locks : null);
  if (locks && typeof locks.request === "function") {
    var out = { ran: false, reason: "busy" };
    await locks.request(SEND_LOCK_PREFIX + opId, { ifAvailable: true }, async function (lock) {
      if (!lock) return;
      out = { ran: true, value: await fn(), locked: true };
    });
    return out;
  }
  return { ran: true, value: await fn(), locked: false };
}

/**
 * Un intento de envio coordinado (no esta conectado a la aplicacion en 0a; lo usara 0b):
 *  - cerrojo por elemento; si esta ocupado y el envio vigente NO esta abandonado -> no envia ({ran:false});
 *  - si esta ocupado pero el envio esta abandonado (> 60 s: pestaña congelada) -> toma el relevo sin cerrojo (el envio es idempotente);
 *  - cada intento lleva su attemptId; una confirmacion siempre quita el elemento (es un hecho), pero el estado solo lo cierra el intento vigente.
 * send(attemptId) -> Promise<{confirmed:boolean, reason?:string}> (p. ej. el resultado de persistSetConfirmed).
 */
export async function runSendAttempt(params) {
  var p = params || {};
  var storage = p.storage;
  var opId = p.opId;
  var now = typeof p.now === "function" ? p.now : Date.now;
  var core = async function (takeover) {
    var begun = beginAttempt(storage, opId, now(), p.idGen);
    var outcome = await p.send(begun.attemptId);
    var out = { ran: true, takeover: !!takeover, attemptId: begun.attemptId, outcome: outcome };
    if (outcome && outcome.confirmed) {
      out.removal = removeConfirmedKeyed(storage, opId, now());
    } else {
      out.finish = finishAttempt(storage, opId, begun.attemptId, outcome, now());
    }
    return out;
  };
  var locked = await withSendLock(opId, function () { return core(false); }, p.env);
  if (locked.ran) return locked.value;
  if (isAttemptStale(readState(storage, opId), now(), p.staleMs)) return core(true);
  return { ran: false, reason: "busy" };
}
