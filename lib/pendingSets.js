// P0 (persistencia de series) - Cola persistente de series pendientes de sincronizar con `progreso`.
//
// Modulo AISLADO: todavia no lo usa App.jsx. No habla con Supabase: el envio y la verificacion se inyectan
// (`send` / `fetchRow`), igual que el almacenamiento, los locks, el reloj y el generador de UUID.
// Se prueba con scripts/test-pendingSets.mjs.
//
// ── MODELO DE ALMACENAMIENTO (clave por serie, sin lectura-modificacion-escritura compartida) ───────────────
// localStorage NO ofrece transacciones ni compare-and-swap, y no hay forma de hacer "leer, cambiar, escribir" de
// forma atomica entre pestanas. Por eso la cola NO es un unico array: cada serie es su propia clave.
//
//   it_pending_sync:item:<uuid>   registro INMUTABLE de la serie (se escribe una vez, se borra una vez)
//   it_pending_sync:meta:<uuid>   estado mutable (status, attempts, lastError); ultimo-escritor-gana
//   it_pending_sync_legacy:<uuid> cuarentena: un registro antiguo por clave (aunque el contenido sea identico)
//   it_pending_sync:migration     diario de la migracion del array viejo (permite reanudar)
//   it_pending_sync:lease:<nombre> lease CONSULTIVO (solo si no hay Web Locks)
//   it_pending_sync               formato VIEJO (array). Solo se LEE para migrarlo; este modulo no vuelve a escribirlo.
//
// Consecuencias (lo que SI se garantiza):
//  - enqueue = UN setItem sobre una clave unica (UUID): no hay lectura previa que pueda quedar obsoleta, asi que
//    ninguna otra pestana puede pisarlo ni ser pisada. Un fallo del almacenamiento no deja una serie a medias.
//  - confirm = removeItem por UUID: tampoco hay RMW.
//  - markAttempt escribe SOLO en la clave `meta` (el registro de la serie nunca se reescribe). Una carrera con
//    confirm no puede resucitar la serie: a lo sumo deja un `meta` huerfano, que se ignora y se barre.
//  - Un item solo sale de la cola por UUID confirmado.
//
// ── COORDINACION ENTRE PESTANAS ─────────────────────────────────────────────────────────────────────────────
//  - Con Web Locks (navigator.locks; solo contextos seguros: HTTPS/localhost): flush y migrate se ejecutan bajo un
//    lock exclusivo `ifAvailable`. Es exclusion mutua real entre contextos del mismo origen y perfil, y el
//    navegador lo libera si la pestana se cierra o falla. Si el lock esta tomado, flush devuelve `locked`.
//  - Si Web Locks EXISTE pero falla de forma inesperada (la peticion se rechaza o lanza antes de empezar): NO se
//    degrada a otro mecanismo. flush no envia nada y devuelve stopped = "lock_error" (+ lockError); las series
//    quedan intactas y pendientes. Lo mismo vale para migrate().
//  - Si Web Locks NO existe: flush NO envia nada (stopped = "no_web_locks", coordination = "unavailable") salvo
//    que el llamador pase `advisoryFallback: true`. Ese modo (D6) solo debe habilitarse despues de validar la
//    idempotencia real contra una base aislada. Entonces se usa un lease en localStorage que es CONSULTIVO: NO es
//    exclusion mutua (no hay CAS), dos pestanas pueden, en una ventana corta, creer ambas que lo tienen.
//    La correccion ante envios concurrentes descansa en la IDEMPOTENCIA: cada POST lleva progreso.id = UUID de la
//    serie, y un 409 solo se confirma tras verificar la fila en el servidor. Esa red de seguridad exige que
//    progreso.id sea clave primaria y acepte ids del cliente (pendiente de verificar en la base).
//  - migrate() solo toca almacenamiento local (no escribe en el servidor): sin Web Locks usa el lease consultivo
//    y el diario hace que una ejecucion repetida sea idempotente. migrateSync() es la variante sincrona sin lock.
//  - El resultado de flush/migrate siempre informa `coordination` (el modo realmente usado).
//  - Web Locks no protege frente a codigo viejo (App.jsx actual) que siga escribiendo el array legacy.
//
// ── LIMITACIONES CONOCIDAS ─────────────────────────────────────────────────────────────────────────────────
//  - migrate() debe leer y luego vaciar el array legacy (la unica clave compartida con codigo viejo). Entre esas
//    dos operaciones una pestana con codigo viejo podria escribir: se mitiga releyendo y conservando todo lo que
//    no se consumio, pero la ventana no puede eliminarse. Si el array fue reescrito de forma incompatible, no se
//    toca y se informa `legacyChanged` (puede haber registros duplicados en cuarentena, nunca perdidos).
//  - localStorage es sincrono, tiene cuota (~5 MB) y puede fallar o no existir (modo privado): enqueue LANZA y
//    el llamador no debe dar la serie por guardada.
//  - Los datos de la cola no estan cifrados.
//  - Alternativa estructural: IndexedDB. Sus transacciones readwrite son atomicas y se serializan entre pestanas,
//    lo que permitiria cola transaccional completa, pero obliga a una API asincrona y es un cambio mayor.
//    No se hace ahora.
//  - La clave de enumeracion usa Storage.length/key(): el almacenamiento debe implementarlas.
import { normalizeWorkoutKg, normalizeWorkoutReps } from "./workoutSession.js";

export var PENDING_KEY_PREFIX = "it_pending_sync"; // TODAS las claves de este modulo empiezan asi
export var PENDING_LEGACY_KEY = "it_pending_sync"; // formato viejo (array)

var ITEM_PREFIX = "it_pending_sync:item:";
var META_PREFIX = "it_pending_sync:meta:";
var QUARANTINE_PREFIX = "it_pending_sync_legacy:";
var JOURNAL_KEY = "it_pending_sync:migration";
var LEASE_PREFIX = "it_pending_sync:lease:";
var FLUSH_LOCK_PREFIX = "it_pending_sync:flush:";
var MIGRATE_LOCK = "it_pending_sync:migrate";

export var DEFAULT_LEASE_MS = 30000;

export var PENDING_STATUS = {
  PENDING: "pending", // reintentable
  AUTH_ERROR: "auth_error", // 401/403: se conserva; solo se reintenta si el llamador lo pide
  REJECTED: "rejected", // 4xx de validacion: se conserva; nunca se reintenta automaticamente
  CONFLICT: "conflict", // 409 con una fila distinta bajo el mismo id: se conserva; requiere revision humana
};

export var SEND_OUTCOME = {
  CONFIRMED: "confirmed",
  DUPLICATE: "duplicate", // 409: puede que la fila ya exista -> verificar por id Y por contenido
  AUTH: "auth_error",
  REJECTED: "rejected",
  RETRY: "retry", // 5xx, 408, 429, red, timeout, respuesta ambigua
};

export var FLUSH_STOP = {
  NONE: "none",
  AUTH: "auth_error",
  LOST_LEASE: "lost_lease",
  STORAGE: "storage_error",
  LOCK_ERROR: "lock_error", // Web Locks existe pero fallo: no se envia nada, las series quedan pendientes
  NO_WEB_LOCKS: "no_web_locks", // sin Web Locks y sin `advisoryFallback`: no se envia nada (D6)
};

export var COORDINATION = {
  WEB_LOCKS: "web-locks",
  ADVISORY_LEASE: "advisory-lease",
  UNAVAILABLE: "unavailable", // sin Web Locks y sin permiso explicito para el modo consultivo
};

export class PendingSetsError extends Error {
  constructor(code, message, extra) {
    super(message || code);
    this.name = "PendingSetsError";
    this.code = code;
    if (extra) Object.assign(this, extra);
  }
}

function toId(v) {
  return v == null ? "" : String(v).trim();
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseJson(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e) {
    return { ok: false };
  }
}

// ── UUID ───────────────────────────────────────────────────────────────────
var UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSetId(id) {
  return typeof id === "string" && UUID_V4_RE.test(id);
}

/**
 * UUID v4 generado SOLO con una fuente criptografica (crypto.randomUUID o crypto.getRandomValues).
 * Si no hay ninguna disponible LANZA PendingSetsError("NO_SECURE_RANDOM"): no existe alternativa debil.
 * `cryptoImpl` permite inyectar una implementacion (pruebas); por defecto globalThis.crypto.
 */
export function generateSetId(cryptoImpl) {
  var c = arguments.length > 0 ? cryptoImpl : (typeof globalThis !== "undefined" ? globalThis.crypto : null);
  if (c && typeof c.randomUUID === "function") {
    var u = c.randomUUID();
    if (isValidSetId(u)) return u;
  }
  if (c && typeof c.getRandomValues === "function") {
    var bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    var hex = Array.prototype.map.call(bytes, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
    var id = hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
    if (isValidSetId(id)) return id;
  }
  throw new PendingSetsError("NO_SECURE_RANDOM", "pendingSets: no hay una fuente aleatoria segura (crypto) para generar el UUID");
}

// ── Envio / verificacion ───────────────────────────────────────────────────
/**
 * Clasifica el resultado de UN intento de POST a `progreso`.
 * `result` = { status?: number, body?: any, error?: any }. `status` ausente/0 = sin respuesta (red/timeout).
 * Solo es CONFIRMED con 2xx y una fila devuelta cuyo id coincide con el del item (Prefer: return=representation).
 * 2xx sin esa fila (body vacio, null, otra fila) es ambiguo -> RETRY: no se asume exito.
 */
export function classifySendResult(item, result) {
  var r = result || {};
  var status = Number(r.status);
  if (!Number.isFinite(status) || status <= 0 || r.error) return SEND_OUTCOME.RETRY;
  if (status >= 200 && status < 300) {
    var rows = Array.isArray(r.body) ? r.body : [];
    var wanted = toId(item && item.id).toLowerCase();
    var hit = wanted && rows.some(function (row) {
      return isPlainObject(row) && toId(row.id).toLowerCase() === wanted;
    });
    return hit ? SEND_OUTCOME.CONFIRMED : SEND_OUTCOME.RETRY;
  }
  if (status === 409) return SEND_OUTCOME.DUPLICATE;
  if (status === 401 || status === 403) return SEND_OUTCOME.AUTH;
  if (status === 408 || status === 429 || status >= 500) return SEND_OUTCOME.RETRY;
  if (status >= 400) return SEND_OUTCOME.REJECTED;
  return SEND_OUTCOME.RETRY;
}

/** Payload para POST progreso. Mismos campos que buildProgressPayload mas `id` (UUID estable de la serie). */
export function buildPendingPayload(item) {
  return {
    id: item.id,
    alumno_id: item.alumno_id,
    ejercicio_id: item.exId,
    kg: normalizeWorkoutKg(item.kg),
    reps: normalizeWorkoutReps(item.reps),
    nota: item.note || "",
    fecha: item.date,
    semana: item.semana,
  };
}

function sameNumber(a, b) {
  var x = Number(a);
  var y = Number(b);
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) < 1e-9;
}

function isBlank(v) {
  return v == null || v === "";
}

/**
 * Compara la fila del servidor con lo que se intento enviar: id, alumno_id, ejercicio_id, kg, reps, fecha y semana.
 * (nota no se compara.) Numericos por valor (60 == "60.00"); alumno_id sin distinguir mayusculas; fecha exacta.
 */
export function rowMatchesPayload(row, payload) {
  if (!isPlainObject(row) || !isPlainObject(payload)) return false;
  if (toId(row.id).toLowerCase() !== toId(payload.id).toLowerCase() || toId(row.id) === "") return false;
  if (toId(row.alumno_id).toLowerCase() !== toId(payload.alumno_id).toLowerCase() || toId(row.alumno_id) === "") return false;
  if (toId(row.ejercicio_id) !== toId(payload.ejercicio_id) || toId(row.ejercicio_id) === "") return false;
  if (!sameNumber(row.kg, payload.kg)) return false;
  if (!sameNumber(row.reps, payload.reps)) return false;
  if (toId(row.fecha) !== toId(payload.fecha) || toId(row.fecha) === "") return false;
  if (isBlank(row.semana) || isBlank(payload.semana)) return isBlank(row.semana) && isBlank(payload.semana);
  return sameNumber(row.semana, payload.semana);
}

var VERIFY = { MATCH: "match", MISSING: "missing", MISMATCH: "mismatch", ERROR: "error" };

// ante 409: consulta la fila por id y la compara con el payload. Solo MATCH permite confirmar.
async function verifyDuplicate(item, payload, fetchRow) {
  if (typeof fetchRow !== "function") return VERIFY.ERROR;
  var res;
  try {
    res = await fetchRow(item.id, item);
  } catch (e) {
    return VERIFY.ERROR;
  }
  if (res == null) return VERIFY.MISSING;
  if (isPlainObject(res) && res.error) return VERIFY.ERROR;
  var rows = (Array.isArray(res) ? res : [res]).filter(isPlainObject);
  var wanted = toId(item.id).toLowerCase();
  var sameId = rows.filter(function (r) { return toId(r.id).toLowerCase() === wanted; });
  if (!sameId.length) return VERIFY.MISSING; // filas de otros ids: respuesta anomala, no es un conflicto de ESTE item
  if (sameId.length > 1) return VERIFY.MISMATCH;
  return rowMatchesPayload(sameId[0], payload) ? VERIFY.MATCH : VERIFY.MISMATCH;
}

/** Para excluir estas claves de las limpiezas de localStorage de la app (login/logout). */
export function isPendingSetsKey(key) {
  return typeof key === "string" && key.indexOf(PENDING_KEY_PREFIX) === 0;
}

function defaultStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch (e) {}
  return null;
}

/**
 * @param {object} [options]
 * @param {Storage-like} [options.storage]  getItem/setItem/removeItem/length/key(i); por defecto localStorage
 * @param {{request:Function}|null} [options.locks]  Web Locks; undefined = navigator.locks si existe; null = desactivar
 * @param {boolean} [options.advisoryFallback]  permitir flush con lease consultivo si NO hay Web Locks (por defecto false)
 * @param {Function} [options.now]    () => ms
 * @param {Function} [options.uuid]   () => UUID v4 (por defecto generateSetId); su resultado se valida siempre
 * @param {number}   [options.leaseMs]
 */
export function createPendingSets(options) {
  var opts = options || {};
  var storageOpt = opts.storage || null;
  var now = typeof opts.now === "function" ? opts.now : function () { return Date.now(); };
  var uuidFn = typeof opts.uuid === "function" ? opts.uuid : function () { return generateSetId(); };
  var leaseMs = opts.leaseMs > 0 ? opts.leaseMs : DEFAULT_LEASE_MS;
  var advisoryFallback = opts.advisoryFallback === true;

  function store() {
    var s = storageOpt || defaultStorage();
    if (!s) throw new PendingSetsError("NO_STORAGE", "pendingSets: almacenamiento no disponible");
    return s;
  }

  function newId() {
    var id = uuidFn();
    if (!isValidSetId(id)) throw new PendingSetsError("INVALID_UUID", "pendingSets: el generador devolvio un UUID invalido");
    return id;
  }

  function keysWithPrefix(prefix) {
    var s = store();
    if (typeof s.key !== "function" || typeof s.length !== "number") {
      throw new PendingSetsError("STORAGE_NOT_ENUMERABLE", "pendingSets: el almacenamiento no implementa length/key()");
    }
    var out = [];
    var n = s.length;
    for (var i = 0; i < n; i++) {
      var k = s.key(i);
      if (typeof k === "string" && k.indexOf(prefix) === 0) out.push(k);
    }
    return out;
  }

  // ── registros ──────────────────────────────────────────────────────────
  function isValidRecord(rec, id) {
    return isPlainObject(rec) && toId(rec.id) === id && toId(rec.alumno_id) !== "" && toId(rec.exId) !== "" && toId(rec.date) !== "";
  }

  // { record } | { corrupt: true } | null (no existe)
  function readRecord(id) {
    var raw = store().getItem(ITEM_PREFIX + id);
    if (raw == null) return null;
    var p = parseJson(raw);
    if (!p.ok || !isValidRecord(p.value, id)) return { corrupt: true };
    return { record: p.value };
  }

  function readMeta(id) {
    var raw = store().getItem(META_PREFIX + id);
    var meta = { status: PENDING_STATUS.PENDING, attempts: 0, lastError: null };
    if (raw == null) return meta;
    var p = parseJson(raw);
    if (!p.ok || !isPlainObject(p.value)) return meta;
    var known = Object.keys(PENDING_STATUS).some(function (k) { return PENDING_STATUS[k] === p.value.status; });
    if (known) meta.status = p.value.status;
    if (Number.isFinite(Number(p.value.attempts))) meta.attempts = Number(p.value.attempts);
    if (p.value.lastError !== undefined) meta.lastError = p.value.lastError;
    return meta;
  }

  function composeItem(record) {
    return Object.assign({}, record, readMeta(record.id));
  }

  function byCreation(a, b) {
    return (a.createdLocal || 0) - (b.createdLocal || 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  // ── Alta ───────────────────────────────────────────────────────────────
  /**
   * Encola una serie con UN solo setItem sobre una clave unica. Sin alumnoId / ejercicio / fecha, con un UUID
   * invalido o sin fuente aleatoria segura LANZA y no escribe nada. Lanza tambien si el almacenamiento falla.
   * Si `id` ya esta encolado devuelve el existente (idempotente).
   */
  function enqueue(input) {
    var p = input || {};
    var alumnoId = toId(p.alumnoId);
    var exId = toId(p.exId);
    var date = toId(p.date);
    if (!alumnoId) throw new TypeError("pendingSets.enqueue: alumnoId requerido");
    if (!exId) throw new TypeError("pendingSets.enqueue: exId requerido");
    if (!date) throw new TypeError("pendingSets.enqueue: date requerida");
    var id;
    if (p.id !== undefined && p.id !== null) {
      id = toId(p.id);
      if (!isValidSetId(id)) throw new PendingSetsError("INVALID_UUID", "pendingSets.enqueue: id no es un UUID v4 valido");
    } else {
      id = newId();
    }
    var existing = readRecord(id);
    if (existing && existing.record) return composeItem(existing.record);
    if (existing && existing.corrupt) throw new PendingSetsError("ID_COLLISION", "pendingSets.enqueue: ya hay un registro ilegible con ese id");
    var record = {
      v: 2,
      id: id,
      alumno_id: alumnoId,
      exId: exId,
      kg: normalizeWorkoutKg(p.kg),
      reps: normalizeWorkoutReps(p.reps),
      note: p.note || "",
      date: date,
      semana: p.semana,
      createdLocal: now(),
    };
    store().setItem(ITEM_PREFIX + id, JSON.stringify(record));
    return composeItem(record);
  }

  // ── Lectura ────────────────────────────────────────────────────────────
  function listAll() {
    var items = [];
    var corrupt = [];
    keysWithPrefix(ITEM_PREFIX).forEach(function (k) {
      var id = k.slice(ITEM_PREFIX.length);
      var r = readRecord(id);
      if (!r) return; // desaparecio entre la enumeracion y la lectura
      if (r.corrupt) corrupt.push(k);
      else items.push(composeItem(r.record));
    });
    return { items: items.sort(byCreation), corrupt: corrupt };
  }

  /** Items de UN alumno. Sin alumnoId devuelve [] a proposito: nunca se listan items de identidad ambigua. */
  function list(alumnoId) {
    var aid = toId(alumnoId);
    if (!aid) return [];
    return listAll().items.filter(function (it) { return toId(it.alumno_id) === aid; });
  }

  function count(alumnoId) {
    return list(alumnoId).length;
  }

  /** Items que flush puede enviar solo: PENDING (y AUTH_ERROR si includeAuthError). Nunca REJECTED ni CONFLICT. */
  function listRetryable(alumnoId, o) {
    var includeAuth = !!(o && o.includeAuthError);
    return list(alumnoId).filter(function (it) {
      return it.status === PENDING_STATUS.PENDING || (includeAuth && it.status === PENDING_STATUS.AUTH_ERROR);
    });
  }

  /** Claves de registros ilegibles: se conservan intactas y se excluyen de list(). */
  function listCorrupt() {
    return listAll().corrupt;
  }

  // ── Mutaciones por id ──────────────────────────────────────────────────
  /**
   * Quita UNICAMENTE las series cuyo UUID esta en `ids` (ya confirmadas). removeItem por clave: sin RMW.
   * Intenta todos los ids aunque alguno falle; si hubo fallos lanza PendingSetsError("STORAGE_REMOVE_FAILED")
   * con `.removed` (cuantos se quitaron). Un item no quitado sigue en cola y se reconfirma de forma segura.
   */
  function confirm(ids) {
    var wanted = {};
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      var k = toId(id);
      if (isValidSetId(k)) wanted[k] = true;
    });
    var removed = 0;
    var failures = [];
    Object.keys(wanted).forEach(function (id) {
      try {
        if (store().getItem(ITEM_PREFIX + id) === null) return;
        store().removeItem(ITEM_PREFIX + id);
        removed++;
        try { store().removeItem(META_PREFIX + id); } catch (e) {} // si falla queda huerfano y se barre
      } catch (e) {
        failures.push(id);
      }
    });
    if (failures.length) {
      throw new PendingSetsError("STORAGE_REMOVE_FAILED", "pendingSets.confirm: no se pudieron quitar " + failures.length + " item(s)", { removed: removed, failed: failures });
    }
    return removed;
  }

  /**
   * Actualiza estado/intentos de UNA serie existente escribiendo SOLO su clave `meta` (el registro no se toca).
   * Si la serie ya no existe: no-op (false). Si desaparece durante la escritura, se limpia el `meta` huerfano.
   */
  function markAttempt(id, patch) {
    var wanted = toId(id);
    if (!isValidSetId(wanted)) return false;
    var p = patch || {};
    var rec = readRecord(wanted);
    if (!rec || rec.corrupt) return false;
    var meta = readMeta(wanted);
    var next = {
      status: p.status || meta.status || PENDING_STATUS.PENDING,
      attempts: meta.attempts + 1,
      lastError: p.error === undefined ? meta.lastError : p.error,
      updatedAt: now(),
    };
    store().setItem(META_PREFIX + wanted, JSON.stringify(next));
    if (store().getItem(ITEM_PREFIX + wanted) === null) {
      try { store().removeItem(META_PREFIX + wanted); } catch (e) {}
      return false;
    }
    return true;
  }

  /** Borra `meta` sin serie (sobras de carreras con confirm). Nunca toca registros ni cuarentena. */
  function sweepOrphans() {
    var removed = 0;
    keysWithPrefix(META_PREFIX).forEach(function (k) {
      var id = k.slice(META_PREFIX.length);
      try {
        if (store().getItem(ITEM_PREFIX + id) === null) {
          store().removeItem(k);
          removed++;
        }
      } catch (e) {}
    });
    return removed;
  }

  // ── Coordinacion ───────────────────────────────────────────────────────
  function resolveLocks() {
    if (opts.locks === null) return null;
    if (opts.locks) return typeof opts.locks.request === "function" ? opts.locks : null;
    try {
      if (typeof navigator !== "undefined" && navigator && navigator.locks && typeof navigator.locks.request === "function") return navigator.locks;
    } catch (e) {}
    return null;
  }

  /** Modo con el que flush coordinara: "web-locks", "advisory-lease" (solo con advisoryFallback) o "unavailable". */
  function coordinationMode() {
    if (resolveLocks()) return COORDINATION.WEB_LOCKS;
    return advisoryFallback ? COORDINATION.ADVISORY_LEASE : COORDINATION.UNAVAILABLE;
  }

  function readLease(key) {
    var raw = store().getItem(key);
    if (!raw) return null;
    var p = parseJson(raw);
    return p.ok && isPlainObject(p.value) ? p.value : null;
  }

  // Lease CONSULTIVO: reduce solapamientos, NO garantiza exclusion mutua (ver cabecera).
  function acquireLease(name, owner) {
    var key = LEASE_PREFIX + name;
    var lock = readLease(key);
    if (lock && lock.owner !== owner && Number(lock.until) > now()) return false;
    store().setItem(key, JSON.stringify({ owner: owner, until: now() + leaseMs }));
    var check = readLease(key);
    return !!check && check.owner === owner;
  }

  function renewLease(name, owner) {
    var key = LEASE_PREFIX + name;
    var lock = readLease(key);
    if (!lock || lock.owner !== owner) return false;
    store().setItem(key, JSON.stringify({ owner: owner, until: now() + leaseMs }));
    var check = readLease(key);
    return !!check && check.owner === owner;
  }

  function releaseLease(name, owner) {
    var key = LEASE_PREFIX + name;
    var lock = readLease(key);
    if (lock && lock.owner === owner) {
      try { store().removeItem(key); } catch (e) {}
    }
  }

  // Ejecuta fn({renew}) en exclusion. Devuelve { granted, mode, value, lockError?, unavailable? }.
  //  - Web Locks disponibles: exclusion mutua real. Si la peticion falla ANTES de empezar (rechazo o excepcion), NO se
  //    cae a otro mecanismo: se devuelve lockError y fn no se ejecuta.
  //  - Sin Web Locks: purpose "sync" (envios al servidor) exige advisoryFallback; purpose "local" (solo almacenamiento
  //    local) usa el lease consultivo.
  async function runExclusive(name, fn, o) {
    var purpose = (o && o.purpose) || "sync";
    var locks = resolveLocks();
    if (locks) {
      var started = false;
      try {
        var out = await locks.request(name, { mode: "exclusive", ifAvailable: true }, async function (lock) {
          if (!lock) return { granted: false };
          started = true;
          var value = await fn({ renew: function () { return true; } });
          return { granted: true, value: value };
        });
        return { granted: !!(out && out.granted), mode: COORDINATION.WEB_LOCKS, value: out && out.value };
      } catch (e) {
        if (started) throw e; // fallo dentro de fn: no es un problema de disponibilidad de locks
        return { granted: false, mode: COORDINATION.WEB_LOCKS, lockError: e && e.message ? String(e.message) : String(e) };
      }
    }
    if (purpose === "sync" && !advisoryFallback) {
      return { granted: false, mode: COORDINATION.UNAVAILABLE, unavailable: true };
    }
    var owner = newId();
    if (!acquireLease(name, owner)) return { granted: false, mode: COORDINATION.ADVISORY_LEASE };
    try {
      var v = await fn({ renew: function () { return renewLease(name, owner); } });
      return { granted: true, mode: COORDINATION.ADVISORY_LEASE, value: v };
    } finally {
      releaseLease(name, owner);
    }
  }

  // ── Migracion / cuarentena ─────────────────────────────────────────────
  function isMigratableLegacy(entry) {
    return isPlainObject(entry) && toId(entry.alumno_id) !== "" && toId(entry.exId || entry.ejercicio_id) !== "" && toId(entry.date || entry.fecha) !== "";
  }

  function entriesEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function backupRaw(key, raw) {
    store().setItem(key + "_corrupt_" + now(), raw);
  }

  function migrateUnlocked() {
    var s = store();
    var summary = { kept: 0, quarantined: 0, corrupt: false, resumed: false, busy: false, legacyChanged: false };

    // 1. Diario: reanudar el existente o crear uno nuevo a partir del array viejo.
    var journal = null;
    var jraw = s.getItem(JOURNAL_KEY);
    if (jraw != null) {
      var jp = parseJson(jraw);
      var jOk = jp.ok && isPlainObject(jp.value) && isValidSetId(jp.value.id) && typeof jp.value.raw === "string" && Array.isArray(jp.value.ids);
      var jEntries = jOk ? parseJson(jp.value.raw) : { ok: false };
      if (jOk && jEntries.ok && Array.isArray(jEntries.value) && jEntries.value.length === jp.value.ids.length && jp.value.ids.every(isValidSetId)) {
        journal = jp.value;
        summary.resumed = true;
      } else {
        backupRaw(JOURNAL_KEY, jraw); // diario ilegible: se conserva y se parte de cero (el array viejo sigue ahi)
        s.removeItem(JOURNAL_KEY);
      }
    }
    if (!journal) {
      var legacyRaw = s.getItem(PENDING_LEGACY_KEY);
      if (legacyRaw == null || legacyRaw === "") return summary;
      var lp = parseJson(legacyRaw);
      if (!lp.ok || !Array.isArray(lp.value)) {
        backupRaw(PENDING_LEGACY_KEY, legacyRaw);
        s.removeItem(PENDING_LEGACY_KEY);
        summary.corrupt = true;
        return summary;
      }
      if (lp.value.length === 0) {
        if (s.getItem(PENDING_LEGACY_KEY) === legacyRaw) s.removeItem(PENDING_LEGACY_KEY);
        return summary;
      }
      journal = {
        v: 1,
        id: newId(),
        raw: legacyRaw,
        ids: lp.value.map(function () { return newId(); }), // ids de TODO el lote, fijados antes de escribir nada
        startedAt: now(),
      };
      s.setItem(JOURNAL_KEY, JSON.stringify(journal));
      var claim = parseJson(s.getItem(JOURNAL_KEY));
      if (!claim.ok || !claim.value || claim.value.id !== journal.id) {
        summary.busy = true; // otra pestana creo su diario justo despues: que lo procese ella
        return summary;
      }
    }

    // 2. Escribir cada registro bajo una clave DETERMINISTA del diario: reanudar reescribe lo mismo (idempotente) y
    //    dos registros de contenido identico siguen siendo dos registros.
    var entries = JSON.parse(journal.raw);
    entries.forEach(function (entry, i) {
      var id = journal.ids[i];
      if (isMigratableLegacy(entry)) {
        var key = ITEM_PREFIX + id;
        if (s.getItem(key) === null) {
          s.setItem(key, JSON.stringify({
            v: 2,
            id: id,
            alumno_id: toId(entry.alumno_id),
            exId: toId(entry.exId || entry.ejercicio_id),
            kg: normalizeWorkoutKg(entry.kg),
            reps: normalizeWorkoutReps(entry.reps),
            note: entry.note || entry.nota || "",
            date: toId(entry.date || entry.fecha),
            semana: entry.semana,
            createdLocal: Number.isFinite(Number(entry.createdLocal)) ? Number(entry.createdLocal) : journal.startedAt + i,
            legacyId: entry.id === undefined ? undefined : entry.id,
          }));
        }
        summary.kept++;
      } else {
        s.setItem(QUARANTINE_PREFIX + id, JSON.stringify({
          v: 1,
          id: id,
          original: entry,
          quarantinedAt: journal.startedAt,
          reason: "sin_alumno_id",
          migrationId: journal.id,
          index: i,
        }));
        summary.quarantined++;
      }
    });

    // 3. Retirar del array viejo SOLO lo consumido; si otra pestana (codigo viejo) agrego entradas, se conservan.
    var cur = s.getItem(PENDING_LEGACY_KEY);
    if (cur != null) {
      if (cur === journal.raw) {
        s.removeItem(PENDING_LEGACY_KEY);
      } else {
        var cp = parseJson(cur);
        var n = entries.length;
        var isPrefix = cp.ok && Array.isArray(cp.value) && cp.value.length >= n && entries.every(function (e, i) { return entriesEqual(e, cp.value[i]); });
        if (isPrefix) {
          var rest = cp.value.slice(n);
          if (rest.length) s.setItem(PENDING_LEGACY_KEY, JSON.stringify(rest));
          else s.removeItem(PENDING_LEGACY_KEY);
        } else {
          summary.legacyChanged = true; // reescrito de forma incompatible: no se toca (posible duplicado en cuarentena, nunca perdida)
        }
      }
    }

    // 4. Fin del diario.
    s.removeItem(JOURNAL_KEY);
    return summary;
  }

  /**
   * Convierte el array viejo `it_pending_sync` al modelo por claves. Registros con alumno_id (y datos minimos) pasan
   * a la cola; el resto va a CUARENTENA, uno por clave y verbatim (`original`), sin sincronizar jamas solo.
   * Recuperable (diario) e idempotente: cualquier corte se reanuda sin perder ni duplicar. Bajo lock si hay Web Locks.
   */
  async function migrate() {
    var res = await runExclusive(MIGRATE_LOCK, function () { return migrateUnlocked(); }, { purpose: "local" });
    if (res.lockError) {
      return { kept: 0, quarantined: 0, corrupt: false, resumed: false, busy: false, legacyChanged: false, skipped: true, lockError: res.lockError, coordination: res.mode };
    }
    if (!res.granted) return { kept: 0, quarantined: 0, corrupt: false, resumed: false, busy: true, legacyChanged: false, coordination: res.mode };
    return Object.assign({}, res.value, { coordination: res.mode });
  }

  /**
   * Variante SINCRONA y SIN lock de migrate(), para limpiezas sincronas de almacenamiento (login/logout) que no pueden
   * esperar un lock asincrono. Es segura porque el diario hace la migracion reanudable e idempotente y porque solo
   * mueve datos locales (nunca sincroniza). Con dos pestanas simultaneas una de ellas puede quedar en `busy`.
   */
  function migrateSync() {
    return Object.assign({}, migrateUnlocked(), { coordination: "none" });
  }

  /** Cuarentena (para avisar/exportar). No hay API que la sincronice sola. */
  function listQuarantine() {
    var out = [];
    keysWithPrefix(QUARANTINE_PREFIX).forEach(function (k) {
      var raw = store().getItem(k);
      var p = raw == null ? { ok: false } : parseJson(raw);
      if (p.ok && isPlainObject(p.value) && "original" in p.value) out.push(p.value);
    });
    return out.sort(function (a, b) {
      return (a.quarantinedAt || 0) - (b.quarantinedAt || 0) || (a.migrationId < b.migrationId ? -1 : a.migrationId > b.migrationId ? 1 : 0) || (a.index || 0) - (b.index || 0);
    });
  }

  // ── Sincronizacion ─────────────────────────────────────────────────────
  async function flushLocked(a, alumnoId, ctx, result) {
    try { sweepOrphans(); } catch (e) {}
    var pending = listRetryable(alumnoId, { includeAuthError: !!a.includeAuthError });
    for (var i = 0; i < pending.length; i++) {
      if (!ctx.renew()) {
        result.stopped = FLUSH_STOP.LOST_LEASE;
        break;
      }
      // Estado fresco: otra pestana pudo confirmar/quitar este item mientras esperabamos.
      var rec = readRecord(pending[i].id);
      if (!rec || rec.corrupt || toId(rec.record.alumno_id) !== alumnoId) continue;
      var fresh = composeItem(rec.record);
      if (fresh.status === PENDING_STATUS.REJECTED || fresh.status === PENDING_STATUS.CONFLICT) continue;
      if (fresh.status === PENDING_STATUS.AUTH_ERROR && !a.includeAuthError) continue;

      var payload = buildPendingPayload(fresh);
      var res;
      try {
        res = await a.send(payload, fresh);
      } catch (e) {
        res = { error: e };
      }
      if (!ctx.renew()) {
        // Perdimos el lease durante el envio: no tocamos el almacenamiento con un resultado posiblemente obsoleto
        // (la serie sigue en cola con el mismo id; reenviarla es seguro).
        result.stopped = FLUSH_STOP.LOST_LEASE;
        break;
      }
      var outcome = classifySendResult(fresh, res);
      var conflict = false;
      if (outcome === SEND_OUTCOME.DUPLICATE) {
        var v = await verifyDuplicate(fresh, payload, a.fetchRow);
        if (v === VERIFY.MATCH) outcome = SEND_OUTCOME.CONFIRMED;
        else if (v === VERIFY.MISMATCH) conflict = true;
        else outcome = SEND_OUTCOME.RETRY;
      }
      try {
        if (conflict) {
          markAttempt(fresh.id, { status: PENDING_STATUS.CONFLICT, error: "id_conflict" });
          result.conflicts.push(fresh.id);
        } else if (outcome === SEND_OUTCOME.CONFIRMED) {
          confirm([fresh.id]);
          result.confirmed.push(fresh.id);
        } else if (outcome === SEND_OUTCOME.AUTH) {
          markAttempt(fresh.id, { status: PENDING_STATUS.AUTH_ERROR, error: "http_" + (res && res.status) });
          result.authError.push(fresh.id);
          result.stopped = FLUSH_STOP.AUTH; // el resto fallaria igual: no se insiste
        } else if (outcome === SEND_OUTCOME.REJECTED) {
          markAttempt(fresh.id, { status: PENDING_STATUS.REJECTED, error: "http_" + (res && res.status) });
          result.rejected.push(fresh.id);
        } else {
          markAttempt(fresh.id, {
            status: PENDING_STATUS.PENDING,
            error: res && res.error ? String(res.error && res.error.message ? res.error.message : res.error) : "http_" + ((res && res.status) || "sin_respuesta"),
          });
          result.retry.push(fresh.id);
        }
      } catch (e) {
        // El almacenamiento fallo al registrar el resultado: la serie sigue en cola con su UUID (reenviarla es seguro).
        result.stopped = FLUSH_STOP.STORAGE;
        result.storageError = e && e.message ? e.message : String(e);
        break;
      }
      if (result.stopped === FLUSH_STOP.AUTH) break;
    }
  }

  /**
   * Sincroniza SOLO las series de `alumnoId`, de a una y en orden de creacion.
   *  send(payload, item)   -> Promise<{status, body, error}>  (un POST a progreso con payload.id = item.id)
   *  fetchRow(id, item)    -> Promise<fila | fila[] | null>   (GET progreso por id; solo se usa ante un 409)
   * Ante 409 la serie solo se confirma si la fila existente coincide en id, alumno_id, ejercicio_id, kg, reps,
   * fecha y semana; si el id existe con otros datos queda como CONFLICT (se conserva y no se reintenta).
   * Devuelve { locked, stopped, coordination, lockError, confirmed, retry, rejected, authError, conflicts, skipped }.
   * Sin enviar nada: stopped = "lock_error" (Web Locks fallo), "no_web_locks" (sin Web Locks y sin advisoryFallback).
   */
  async function flush(args) {
    var a = args || {};
    var alumnoId = toId(a.alumnoId);
    var result = { locked: false, stopped: FLUSH_STOP.NONE, coordination: coordinationMode(), lockError: null, confirmed: [], retry: [], rejected: [], authError: [], conflicts: [], skipped: false };
    if (!alumnoId || typeof a.send !== "function") {
      result.skipped = true;
      return result;
    }
    var res = await runExclusive(FLUSH_LOCK_PREFIX + alumnoId, function (ctx) {
      return flushLocked(a, alumnoId, ctx, result);
    }, { purpose: "sync" });
    result.coordination = res.mode;
    if (res.lockError) {
      result.stopped = FLUSH_STOP.LOCK_ERROR;
      result.lockError = res.lockError;
    } else if (res.unavailable) {
      result.stopped = FLUSH_STOP.NO_WEB_LOCKS;
    } else if (!res.granted) {
      result.locked = true;
    }
    return result;
  }

  return {
    enqueue: enqueue,
    list: list,
    count: count,
    listRetryable: listRetryable,
    listCorrupt: listCorrupt,
    confirm: confirm,
    markAttempt: markAttempt,
    sweepOrphans: sweepOrphans,
    migrate: migrate,
    migrateSync: migrateSync,
    listQuarantine: listQuarantine,
    flush: flush,
    coordinationMode: coordinationMode,
    // lease consultivo (expuesto para pruebas y diagnostico)
    acquireLease: acquireLease,
    renewLease: renewLease,
    releaseLease: releaseLease,
  };
}
