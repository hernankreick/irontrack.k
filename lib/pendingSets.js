// P0 (persistencia de series) - Cola persistente de series pendientes de sincronizar con `progreso`.
//
// Modulo AISLADO: todavia no lo usa App.jsx. No habla con Supabase: el envio y la verificacion se inyectan
// (`send` / `verify`), el almacenamiento tambien (`storage`), igual que el reloj y el generador de UUID.
// Se prueba con scripts/test-pendingSets.mjs.
//
// Garantias:
//  - Cada serie tiene un UUID estable (`id`), generado al encolarla y reutilizado en TODO reintento. Es el
//    identificador que se enviara como progreso.id, de modo que un reintento tras una respuesta perdida
//    no pueda duplicar la fila (el servidor responde conflicto y se verifica por id).
//  - Cada item lleva `alumno_id` (alumnos.id) del alumno que lo creo. Solo se sincroniza bajo ESE alumno.
//  - Items sin alumno_id (cola vieja) van a CUARENTENA, sin modificarse y sin sincronizarse jamas
//    automaticamente.
//  - Un item solo sale de la cola por `confirm(ids)` / porque `flush` obtuvo confirmacion por UUID.
//  - Ninguna mutacion acepta una cola completa del llamador: todas hacen leer -> transformar -> escribir sobre
//    el estado FRESCO del almacenamiento (sin escrituras obsoletas), y las operaciones sobre un item que ya no
//    existe son no-op (no lo "resucitan").
//  - `flush` toma un lease (con dueno, vencimiento y renovacion) para evitar sincronizaciones simultaneas, y
//    aborta si lo pierde.
//
// Formato de la cola: array JSON bajo `it_pending_sync` (el mismo formato que usa hoy App.jsx), con los campos
// historicos { exId, kg, reps, note, date, semana } mas { id, alumno_id, status, attempts, lastError, createdLocal }.
import { normalizeWorkoutKg, normalizeWorkoutReps } from "./workoutSession.js";

export var PENDING_QUEUE_KEY = "it_pending_sync";
export var PENDING_QUARANTINE_KEY = "it_pending_sync_legacy";
export var PENDING_LOCK_KEY = "it_pending_sync_lock";
export var DEFAULT_LEASE_MS = 30000;

export var PENDING_STATUS = {
  PENDING: "pending", // reintentable
  AUTH_ERROR: "auth_error", // 401/403: se conserva; solo se reintenta si el llamador lo pide
  REJECTED: "rejected", // 4xx de validacion: se conserva; nunca se reintenta automaticamente
};

export var SEND_OUTCOME = {
  CONFIRMED: "confirmed",
  DUPLICATE: "duplicate", // 409: puede que la fila ya exista -> verificar por id
  AUTH: "auth_error",
  REJECTED: "rejected",
  RETRY: "retry", // 5xx, 408, 429, red, timeout, respuesta ambigua
};

export var FLUSH_STOP = {
  NONE: "none",
  AUTH: "auth_error",
  LOST_LEASE: "lost_lease",
};

function toId(v) {
  return v == null ? "" : String(v).trim();
}

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// UUID v4. crypto.randomUUID cuando existe; si no, getRandomValues; ultimo recurso Math.random.
export function generateSetId() {
  var c = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  var bytes = new Array(16);
  var i;
  if (c && typeof c.getRandomValues === "function") {
    var buf = new Uint8Array(16);
    c.getRandomValues(buf);
    for (i = 0; i < 16; i++) bytes[i] = buf[i];
  } else {
    for (i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  var hex = bytes.map(function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}

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

function defaultStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch (e) {}
  return null;
}

/**
 * @param {object} [options]
 * @param {{getItem:Function,setItem:Function,removeItem:Function}} [options.storage]  por defecto localStorage
 * @param {Function} [options.now]        () => ms
 * @param {Function} [options.uuid]       () => string
 * @param {number}   [options.leaseMs]
 * @param {string}   [options.queueKey], [options.quarantineKey], [options.lockKey]
 */
export function createPendingSets(options) {
  var opts = options || {};
  var storageOpt = opts.storage || null;
  var now = typeof opts.now === "function" ? opts.now : function () { return Date.now(); };
  var uuid = typeof opts.uuid === "function" ? opts.uuid : generateSetId;
  var leaseMs = opts.leaseMs > 0 ? opts.leaseMs : DEFAULT_LEASE_MS;
  var queueKey = opts.queueKey || PENDING_QUEUE_KEY;
  var quarantineKey = opts.quarantineKey || PENDING_QUARANTINE_KEY;
  var lockKey = opts.lockKey || PENDING_LOCK_KEY;

  function store() {
    var s = storageOpt || defaultStorage();
    if (!s) throw new Error("pendingSets: almacenamiento no disponible");
    return s;
  }

  // Lee un array JSON. Si el contenido existe pero no es un array valido, NO se interpreta como vacio:
  // se devuelve { corrupt: true, raw } para que nadie lo sobrescriba sin respaldarlo.
  function readArray(key) {
    var raw = store().getItem(key);
    if (raw == null || raw === "") return { items: [], raw: raw, corrupt: false };
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return { items: [], raw: raw, corrupt: true };
    }
    if (!Array.isArray(parsed)) return { items: [], raw: raw, corrupt: true };
    return { items: parsed, raw: raw, corrupt: false };
  }

  function writeArray(key, items) {
    // Lanza si el almacenamiento falla (cuota, modo privado): el llamador NO debe dar la serie por guardada.
    store().setItem(key, JSON.stringify(items));
  }

  // Cola de trabajo. Si estaba corrupta, se respalda el contenido original antes de seguir (nunca se pierde).
  function readQueue() {
    var q = readArray(queueKey);
    if (q.corrupt) {
      // Si el respaldo falla (cuota) se lanza: jamas se descarta un contenido que no se pudo preservar.
      store().setItem(queueKey + "_corrupt_" + now(), q.raw);
      store().removeItem(queueKey);
      return [];
    }
    return q.items;
  }

  // Leer-transformar-escribir sobre el estado fresco. `fn(items)` devuelve la nueva lista o null (sin cambios).
  function mutateQueue(fn) {
    var current = readQueue();
    var next = fn(current);
    if (next == null) return false;
    writeArray(queueKey, next);
    return true;
  }

  function isValidItem(item) {
    return isPlainObject(item) && toId(item.alumno_id) !== "";
  }

  function normalizeStoredItem(item) {
    var out = Object.assign({}, item);
    out.alumno_id = toId(item.alumno_id);
    out.id = toId(item.id) || uuid();
    if (!out.status) out.status = PENDING_STATUS.PENDING;
    if (!Number.isFinite(Number(out.attempts))) out.attempts = 0;
    if (out.lastError === undefined) out.lastError = null;
    if (!Number.isFinite(Number(out.createdLocal))) out.createdLocal = now();
    return out;
  }

  // ── Alta ─────────────────────────────────────────────────────────────────
  /**
   * Encola una serie. Requiere identidad (alumnoId) y datos minimos; si falta algo lanza y NO escribe nada.
   * Lanza tambien si el almacenamiento falla. Si se pasa un `id` ya encolado, devuelve el existente (idempotente).
   */
  function enqueue(input) {
    var p = input || {};
    var alumnoId = toId(p.alumnoId);
    var exId = toId(p.exId);
    var date = toId(p.date);
    if (!alumnoId) throw new TypeError("pendingSets.enqueue: alumnoId requerido");
    if (!exId) throw new TypeError("pendingSets.enqueue: exId requerido");
    if (!date) throw new TypeError("pendingSets.enqueue: date requerida");
    var wantedId = toId(p.id);
    var created = null;
    mutateQueue(function (items) {
      if (wantedId) {
        var existing = items.filter(function (it) { return isPlainObject(it) && toId(it.id) === wantedId; })[0];
        if (existing) {
          created = existing;
          return null;
        }
      }
      created = {
        id: wantedId || uuid(),
        alumno_id: alumnoId,
        exId: exId,
        kg: normalizeWorkoutKg(p.kg),
        reps: normalizeWorkoutReps(p.reps),
        note: p.note || "",
        date: date,
        semana: p.semana,
        status: PENDING_STATUS.PENDING,
        attempts: 0,
        lastError: null,
        createdLocal: now(),
      };
      return items.concat([created]);
    });
    return created;
  }

  // ── Lectura ──────────────────────────────────────────────────────────────
  /** Items de UN alumno (sin alumnoId devuelve [] a proposito: nunca se listan items de identidad ambigua). */
  function list(alumnoId) {
    var aid = toId(alumnoId);
    if (!aid) return [];
    return readQueue().filter(function (it) { return isValidItem(it) && toId(it.alumno_id) === aid; });
  }

  function count(alumnoId) {
    return list(alumnoId).length;
  }

  /** Items que flush puede enviar automaticamente: PENDING (y AUTH_ERROR si includeAuthError). Nunca REJECTED. */
  function listRetryable(alumnoId, o) {
    var includeAuth = !!(o && o.includeAuthError);
    return list(alumnoId).filter(function (it) {
      var st = it.status || PENDING_STATUS.PENDING;
      return st === PENDING_STATUS.PENDING || (includeAuth && st === PENDING_STATUS.AUTH_ERROR);
    }).sort(function (a, b) { return (a.createdLocal || 0) - (b.createdLocal || 0); });
  }

  // ── Mutaciones por id ────────────────────────────────────────────────────
  /** Quita UNICAMENTE los items cuyo id esta en `ids` (UUIDs confirmados). Devuelve cuantos quito. */
  function confirm(ids) {
    var wanted = {};
    (Array.isArray(ids) ? ids : []).forEach(function (id) {
      var k = toId(id);
      if (k) wanted[k] = true;
    });
    if (!Object.keys(wanted).length) return 0;
    var removed = 0;
    mutateQueue(function (items) {
      var next = items.filter(function (it) {
        var hit = isPlainObject(it) && wanted[toId(it.id)] === true;
        if (hit) removed++;
        return !hit;
      });
      return removed > 0 ? next : null;
    });
    return removed;
  }

  /** Actualiza estado/intentos de UN item existente. Si ya no existe: no-op (no se resucita). */
  function markAttempt(id, patch) {
    var wanted = toId(id);
    if (!wanted) return false;
    var p = patch || {};
    var found = false;
    mutateQueue(function (items) {
      var next = items.map(function (it) {
        if (!isPlainObject(it) || toId(it.id) !== wanted) return it;
        found = true;
        return Object.assign({}, it, {
          attempts: (Number(it.attempts) || 0) + 1,
          status: p.status || it.status || PENDING_STATUS.PENDING,
          lastError: p.error === undefined ? it.lastError : p.error,
        });
      });
      return found ? next : null;
    });
    return found;
  }

  // ── Migracion / cuarentena ───────────────────────────────────────────────
  /**
   * Idempotente. Items con alumno_id -> se conservan (se les completa id/estado). Items sin alumno_id ->
   * CUARENTENA verbatim (`original`), fuera de la cola, sin sincronizar. Primero se escribe la cuarentena y
   * despues la cola: si algo falla entre ambos pasos queda duplicado, nunca perdido (se deduplica al reintentar).
   * Cola ilegible/no-array: no se toca (readQueue la respalda).
   */
  function migrate() {
    var q = readArray(queueKey);
    if (q.corrupt) {
      readQueue(); // respalda el contenido original
      return { kept: 0, quarantined: 0, corrupt: true };
    }
    var keep = [];
    var legacy = [];
    q.items.forEach(function (it) {
      if (isValidItem(it)) keep.push(normalizeStoredItem(it));
      else legacy.push(it);
    });
    var changed = legacy.length > 0 || JSON.stringify(keep) !== JSON.stringify(q.items);
    if (legacy.length > 0) {
      var qr = readArray(quarantineKey);
      if (qr.corrupt) {
        try { store().setItem(quarantineKey + "_corrupt_" + now(), qr.raw); } catch (e) {}
      }
      var existing = qr.corrupt ? [] : qr.items;
      var seen = {};
      existing.forEach(function (e) { seen[JSON.stringify(e && e.original)] = true; });
      var stamp = now();
      var added = legacy.filter(function (it) {
        var k = JSON.stringify(it);
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      }).map(function (it) {
        return { original: it, quarantinedAt: stamp, reason: "sin_alumno_id" };
      });
      if (added.length) writeArray(quarantineKey, existing.concat(added));
    }
    if (changed) writeArray(queueKey, keep);
    return { kept: keep.length, quarantined: legacy.length, corrupt: false };
  }

  /** Lectura de la cuarentena (para avisar/exportar). No hay API que la sincronice sola. */
  function listQuarantine() {
    var qr = readArray(quarantineKey);
    return qr.corrupt ? [] : qr.items;
  }

  // ── Lease (anti sincronizacion simultanea) ───────────────────────────────
  function readLock() {
    var raw = store().getItem(lockKey);
    if (!raw) return null;
    try {
      var v = JSON.parse(raw);
      return isPlainObject(v) ? v : null;
    } catch (e) {
      return null;
    }
  }

  function acquireLease(owner) {
    var lock = readLock();
    if (lock && lock.owner !== owner && Number(lock.until) > now()) return false;
    store().setItem(lockKey, JSON.stringify({ owner: owner, until: now() + leaseMs }));
    var check = readLock();
    return !!check && check.owner === owner;
  }

  function renewLease(owner) {
    var lock = readLock();
    if (!lock || lock.owner !== owner) return false;
    store().setItem(lockKey, JSON.stringify({ owner: owner, until: now() + leaseMs }));
    var check = readLock();
    return !!check && check.owner === owner;
  }

  function releaseLease(owner) {
    var lock = readLock();
    if (lock && lock.owner === owner) {
      try { store().removeItem(lockKey); } catch (e) {}
    }
  }

  // ── Sincronizacion ───────────────────────────────────────────────────────
  /**
   * Sincroniza SOLO los items de `alumnoId`, de a uno y en orden de creacion.
   *  send(payload, item) -> Promise<{status, body, error}>   (un POST a progreso con payload.id = item.id)
   *  verify(id, item)    -> Promise<boolean>                  (la fila existe? se usa ante 409)
   * Devuelve { locked, stopped, confirmed:[ids], retry:[ids], rejected:[ids], authError:[ids] }.
   * Con alumnoId vacio no hace nada. Un item se quita unicamente cuando su UUID fue confirmado.
   */
  async function flush(args) {
    var a = args || {};
    var alumnoId = toId(a.alumnoId);
    var result = { locked: false, stopped: FLUSH_STOP.NONE, confirmed: [], retry: [], rejected: [], authError: [], skipped: false };
    if (!alumnoId || typeof a.send !== "function") {
      result.skipped = true;
      return result;
    }
    var owner = uuid();
    if (!acquireLease(owner)) {
      result.locked = true;
      return result;
    }
    try {
      var pending = listRetryable(alumnoId, { includeAuthError: !!a.includeAuthError });
      for (var i = 0; i < pending.length; i++) {
        if (!renewLease(owner)) {
          result.stopped = FLUSH_STOP.LOST_LEASE;
          break;
        }
        // Estado fresco: otro flush/pestana pudo confirmar o quitar este item mientras esperabamos.
        var fresh = list(alumnoId).filter(function (it) { return it.id === pending[i].id; })[0];
        if (!fresh) continue;
        var status = fresh.status || PENDING_STATUS.PENDING;
        if (status === PENDING_STATUS.REJECTED) continue;

        var res;
        try {
          res = await a.send(buildPendingPayload(fresh), fresh);
        } catch (e) {
          res = { error: e };
        }
        if (!renewLease(owner)) {
          // Perdimos el lease durante el envio: no tocamos el almacenamiento con un resultado posiblemente obsoleto
          // (el item sigue en cola con el mismo id; reenviarlo es seguro).
          result.stopped = FLUSH_STOP.LOST_LEASE;
          break;
        }
        var outcome = classifySendResult(fresh, res);
        if (outcome === SEND_OUTCOME.DUPLICATE) {
          var exists = false;
          if (typeof a.verify === "function") {
            try { exists = (await a.verify(fresh.id, fresh)) === true; } catch (e2) { exists = false; }
          }
          outcome = exists ? SEND_OUTCOME.CONFIRMED : SEND_OUTCOME.RETRY;
        }
        if (outcome === SEND_OUTCOME.CONFIRMED) {
          confirm([fresh.id]);
          result.confirmed.push(fresh.id);
        } else if (outcome === SEND_OUTCOME.AUTH) {
          markAttempt(fresh.id, { status: PENDING_STATUS.AUTH_ERROR, error: "http_" + (res && res.status) });
          result.authError.push(fresh.id);
          result.stopped = FLUSH_STOP.AUTH; // el resto fallaria igual: no se insiste
          break;
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
      }
    } finally {
      releaseLease(owner);
    }
    return result;
  }

  return {
    enqueue: enqueue,
    list: list,
    count: count,
    listRetryable: listRetryable,
    confirm: confirm,
    markAttempt: markAttempt,
    migrate: migrate,
    listQuarantine: listQuarantine,
    flush: flush,
    acquireLease: acquireLease,
    renewLease: renewLease,
    releaseLease: releaseLease,
  };
}
