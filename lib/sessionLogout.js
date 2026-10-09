// Cierre de sesion centralizado (S0.6 Fase 1).
//
// Problema: el logout solo borraba claves `it_*`; la sesion de Supabase Auth (refresh token incluido) seguia en el
// dispositivo y, si `signOut()` fallaba por red, no quedaba constancia de que el usuario HABIA pedido salir.
//
// Comportamiento verificado contra @supabase/auth-js 2.103.0 (scripts/test-sessionLogout.mjs usa el GoTrueClient real):
//  - signOut() SIEMPRE llama a /logout (cualquier scope). Sin red devuelve AuthRetryableFetchError y NO borra la sesion local.
//    Con 5xx tambien devuelve error y la sesion queda. Con 401/403/404 la considera cerrada y la borra.
//  - Si la sesion estaba vencida y el refresh falla de forma NO reintentable (400 / token revocado), el SDK ya borro la sesion
//    local y emitio SIGNED_OUT, aunque signOut() devuelva error.
//  - No existe API publica para borrar la sesion local sin red; este modulo NO toca las claves internas del SDK.
//
// Diseno:
//  1. beginLogout(): sincronico y sin red. Escribe el marcador `irontrack_logout_pending` ANTES de nada, invalida el acceso
//     local (it_session, it_biometric_user, resto de it_*) y deja la UI en el login. Asi el logout es inmediato con o sin red.
//  2. completePendingLogout(): intenta signOut({scope:'local'}) (solo ESTE dispositivo). Solo borra el marcador cuando la
//     sesion Auth ya no existe localmente. Si falla (red/5xx/timeout) el marcador queda y se reintenta al abrir la app, al
//     recuperar conexion y al volver a primer plano.
//  3. Mientras el marcador exista NADA restaura la sesion (restoreStudentSession, biometria, arranque) ni usa el token residual
//     (sbFetch). El marcador NO bloquea un login nuevo: un signInWithPassword exitoso lo reemplaza (clearLogoutPending).
//
// El marcador no empieza con `it_`: ninguna limpieza `it_*` (logout, login, reset, "borrar datos") lo borra por accidente, y
// no choca con la proteccion de `it_pending_sync*` de la Etapa 1A.

export var LOGOUT_PENDING_KEY = "irontrack_logout_pending";
export var LOGOUT_REMOTE_TIMEOUT_MS = 8000;
var AUTH_TRANSITION_LOCK = "irontrack:auth-transition";
export var AUTH_TRANSITION_WAIT_MS = 10000;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Claves de acceso local que se invalidan SIEMPRE al cerrar sesion, aunque la limpieza general falle.
var ACCESS_KEYS = ["it_session", "it_biometric_user"];

function now(deps) {
  return deps && typeof deps.now === "function" ? deps.now() : Date.now();
}

function randomId() {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch (e) {}
  return String(Date.now()) + "-" + Math.random().toString(36).slice(2);
}

function defaultStorage() {
  try {
    if (typeof localStorage !== "undefined" && localStorage) return localStorage;
  } catch (e) {}
  return null;
}

function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

// Auth uid dueño de una it_session: alumno -> authUid; entrenador -> entrenadorId (se guarda como String(user.id) al iniciar sesion).
function ownerUid(sess) {
  if (!sess || typeof sess !== "object") return null;
  if (isUuid(sess.authUid)) return String(sess.authUid);
  if (sess.role === "entrenador" && isUuid(sess.entrenadorId)) return String(sess.entrenadorId);
  return null;
}

function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/** true si hay un logout sin completar. Fail-closed: un valor ilegible cuenta como pendiente. */
export function isLogoutPending(storage) {
  var s = storage || defaultStorage();
  if (!s || typeof s.getItem !== "function") return false;
  try {
    var raw = s.getItem(LOGOUT_PENDING_KEY);
    return raw != null && raw !== "";
  } catch (e) {
    return false;
  }
}

export function readLogoutPending(storage) {
  var s = storage || defaultStorage();
  if (!s) return null;
  try {
    var raw = s.getItem(LOGOUT_PENDING_KEY);
    if (raw == null || raw === "") return null;
    var parsed = parse(raw);
    return parsed && typeof parsed === "object" ? parsed : { v: 1, corrupt: true };
  } catch (e) {
    return null;
  }
}

export function clearLogoutPending(storage) {
  var s = storage || defaultStorage();
  if (!s) return;
  try {
    s.removeItem(LOGOUT_PENDING_KEY);
  } catch (e) {}
}

// Borra el marcador solo si sigue siendo el MISMO (id): un logout nuevo (beginLogout es sincronico y no usa la seccion critica) puede
// haberlo reemplazado mientras un cierre anterior estaba en curso, y ese marcador nuevo no se debe borrar.
function clearLogoutPendingIf(storage, id) {
  var cur = readLogoutPending(storage);
  if (!cur) return;
  if (id && cur.id !== id) return;
  clearLogoutPending(storage);
}

/** Quita el acceso local si hay un logout pendiente (arranque tras cerrar offline / cierre interrumpido). */
export function enforceLogoutPending(storage) {
  var s = storage || defaultStorage();
  if (!s || !isLogoutPending(s)) return false;
  ACCESS_KEYS.forEach(function (k) {
    try {
      s.removeItem(k);
    } catch (e) {}
  });
  return true;
}

/**
 * Paso sincronico del logout (no usa red). Orden deliberado:
 *   1. marcador (si el proceso muere ahora, el proximo arranque lo ve y termina el logout)
 *   2. limpieza general (`deps.clearLocal`, que conserva las series pendientes)
 *   3. invalidar el acceso local (it_session, it_biometric_user) pase lo que pase en el paso 2
 *   4. si el marcador no pudo escribirse (cuota), reintentar tras liberar espacio
 * @returns {{marked:boolean, info:object}}
 */
export function beginLogout(deps) {
  var d = deps || {};
  var s = d.storage || defaultStorage();
  var prev = null;
  if (s) {
    try {
      prev = parse(s.getItem("it_session"));
    } catch (e) {}
  }
  var info = {
    v: 1,
    id: randomId(),
    ts: now(d),
    role: prev && prev.role ? String(prev.role) : null,
    authUid: ownerUid(prev),
  };
  var marked = false;
  if (s) {
    try {
      s.setItem(LOGOUT_PENDING_KEY, JSON.stringify(info));
      marked = true;
    } catch (e) {}
  }
  // La limpieza general corre con it_session todavia presente (la cola de series se traslada rotulada con su alumno).
  try {
    if (typeof d.clearLocal === "function") d.clearLocal();
  } catch (e) {
    console.error("[LOGOUT] limpieza local fallo", e && e.message ? e.message : e);
  }
  if (s) {
    ACCESS_KEYS.forEach(function (k) {
      try {
        s.removeItem(k);
      } catch (e) {}
    });
  }
  if (s && !marked) {
    try {
      s.setItem(LOGOUT_PENDING_KEY, JSON.stringify(info));
      marked = true;
    } catch (e) {}
  }
  return { marked: marked, info: info };
}

function withTimeout(promise, ms) {
  return new Promise(function (resolve, reject) {
    var t = setTimeout(function () {
      reject(new Error("timeout"));
    }, ms);
    Promise.resolve(promise).then(
      function (v) {
        clearTimeout(t);
        resolve(v);
      },
      function (e) {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function errName(e) {
  return e && (e.name || e.code || e.message) ? String(e.name || e.code || e.message) : "error";
}

var inFlight = null;
var transitionChain = Promise.resolve();

/**
 * Seccion critica de transiciones de sesion Auth (login / cierre pendiente / rechazo de identidad). Serializa dentro de la pestana
 * (cadena de promesas) y ENTRE pestanas con un Web Lock exclusivo, para que la lectura de la sesion, la decision y el signOut de un
 * cierre pendiente no se intercalen con el signInWithPassword de otro login: el signOut del SDK actua sobre la sesion que haya
 * ALMACENADA en ese instante y, al terminar, borra la local aunque sea de otro usuario.
 *
 * El lock se mantiene hasta que `fn` termina de verdad (aunque quien llamo ya haya dejado de esperar por un timeout).
 * Si no se obtiene en `waitMs`: onTimeout "run" ejecuta igual (disponibilidad: un login no puede quedar colgado) y "skip" no ejecuta.
 * Sin Web Locks solo hay serializacion en la pestana (limitacion documentada).
 * @returns {Promise<{ran:boolean, locked:boolean, value?:any}>}
 */
export function runAuthTransition(fn, o) {
  var opts = o || {};
  var locks = opts.locks !== undefined ? opts.locks : typeof navigator !== "undefined" && navigator ? navigator.locks : null;
  var waitMs = opts.waitMs != null ? opts.waitMs : AUTH_TRANSITION_WAIT_MS;
  var onTimeout = opts.onTimeout === "skip" ? "skip" : "run";

  // Ejecuta fn bajo el Web Lock exclusivo (si existe). La espera por el lock tambien esta acotada por waitMs.
  function runLocked() {
    if (locks && typeof locks.request === "function") {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, waitMs) : null;
      var reqOpts = { mode: "exclusive" };
      if (ctrl) reqOpts.signal = ctrl.signal;
      return Promise.resolve(
        locks.request(AUTH_TRANSITION_LOCK, reqOpts, function () {
          if (timer) clearTimeout(timer);
          return Promise.resolve(fn()).then(function (v) { return { ran: true, locked: true, value: v }; });
        })
      ).catch(function (e) {
        if (timer) clearTimeout(timer);
        if (e && e.name === "AbortError") {
          if (onTimeout === "skip") return { ran: false, locked: false };
          return Promise.resolve(fn()).then(function (v) { return { ran: true, locked: false, value: v }; });
        }
        throw e;
      });
    }
    return Promise.resolve(fn()).then(function (v) { return { ran: true, locked: false, value: v }; });
  }

  return new Promise(function (resolve, reject) {
    var state = "waiting"; // waiting -> running | cancelled (vencio waitMs esperando el turno en la pestana)
    var timer = setTimeout(function () {
      if (state !== "waiting") return;
      state = "cancelled";
      if (onTimeout === "skip") resolve({ ran: false, locked: false });
      else Promise.resolve().then(fn).then(function (v) { resolve({ ran: true, locked: false, value: v }); }, reject);
    }, waitMs);
    var turn = function () {
      if (state === "cancelled") return undefined;
      state = "running";
      clearTimeout(timer);
      return runLocked();
    };
    var p = transitionChain.then(turn, turn);
    transitionChain = p.then(function () {}, function () {});
    p.then(
      function (v) { if (state !== "cancelled") resolve(v); },
      function (e) { if (state !== "cancelled") reject(e); }
    );
  });
}

function isRetryableAuthError(e) {
  return !!e && e.name === "AuthRetryableFetchError";
}

/**
 * Cierra la sesion local SOLO si pertenece a `expectedUid` (si es null no se puede comprobar: se cierra la que haya).
 * Nunca revoca la sesion de otro usuario. Debe ejecutarse dentro de runAuthTransition.
 * @returns {Promise<{status:'signed_out'|'absent'|'other_user'|'error', error?:any}>}
 */
export async function signOutIfCurrentUser(client, expectedUid) {
  if (!client || !client.auth || typeof client.auth.signOut !== "function" || typeof client.auth.getSession !== "function") {
    return { status: "error", error: { name: "NoClient" } };
  }
  var g;
  try {
    g = await client.auth.getSession();
  } catch (e) {
    return { status: "error", error: e };
  }
  if (g && g.error) {
    // Error de red: no prueba nada. Rechazo del servidor (el SDK ya borro la sesion local): se confirma que no queda sesion.
    if (isRetryableAuthError(g.error)) return { status: "error", error: g.error };
    try {
      var again = await client.auth.getSession();
      if (again && !again.error && again.data && !again.data.session) return { status: "absent" };
    } catch (e2) {}
    return { status: "error", error: g.error };
  }
  var session = g && g.data ? g.data.session : null;
  if (!session) return { status: "absent" };
  var currentUid = session.user && session.user.id ? String(session.user.id) : null;
  if (expectedUid && currentUid !== expectedUid) return { status: "other_user" };
  var r;
  try {
    r = await client.auth.signOut({ scope: "local" });
  } catch (e3) {
    return { status: "error", error: e3 };
  }
  if (r && r.error) {
    // El SDK pudo haber borrado la sesion igualmente (refresh rechazado): si ya no hay, esta cumplido.
    try {
      var chk = await client.auth.getSession();
      if (chk && !chk.error && chk.data && !chk.data.session) return { status: "absent" };
    } catch (e4) {}
    return { status: "error", error: r.error };
  }
  return { status: "signed_out" };
}

/**
 * Inicio de sesion que SUSTITUYE una sesion residual. `signInFn()` (signInWithPassword / signUp) corre dentro de la seccion critica
 * y, si autentica, borra el marcador de logout pendiente ANTES de soltarla y de cualquier consulta REST: la sesion residual ya fue
 * reemplazada en el almacenamiento, asi que el marcador dejo de proteger algo y, si siguiera, la barrera bloquearia las consultas
 * del propio login. Si el login falla el marcador se conserva (la sesion residual sigue ahi).
 * deps: { storage, locks, waitMs }
 */
export async function signInReplacingResidual(deps, signInFn) {
  var d = deps || {};
  var s = d.storage || defaultStorage();
  var out = await runAuthTransition(
    async function () {
      var res = await signInFn();
      if (res && !res.error && res.data && res.data.session) clearLogoutPending(s);
      return res;
    },
    { locks: d.locks, waitMs: d.waitMs, onTimeout: "run" }
  );
  return out.value;
}

/**
 * Termina el logout contra Supabase Auth. Idempotente; seguro entre pestanas (seccion critica con Web Lock) y NUNCA revoca la sesion
 * de otro usuario: solo cierra la sesion almacenada si su user.id es el `authUid` registrado en el marcador (comprobado DENTRO de la
 * seccion critica, justo antes del signOut). Si la sesion almacenada es de otra cuenta (login posterior) solo limpia el marcador.
 * La espera del llamador esta acotada por `timeoutMs`; la seccion critica sigue hasta que el SDK termine. Nunca lanza.
 * deps: { client, storage, timeoutMs, locks, waitMs }
 * @returns {Promise<{status:'none'|'completed'|'pending', reason?:string}>}
 */
export function completePendingLogout(deps) {
  var d = deps || {};
  var s = d.storage || defaultStorage();
  if (!isLogoutPending(s)) return Promise.resolve({ status: "none" });
  if (inFlight) return inFlight;
  var timeoutMs = d.timeoutMs != null ? d.timeoutMs : LOGOUT_REMOTE_TIMEOUT_MS;

  async function work() {
    var client = d.client;
    if (!client || !client.auth || typeof client.auth.signOut !== "function") return { status: "pending", reason: "no_client" };
    if (!isLogoutPending(s)) return { status: "none" }; // otra pestana ya lo completo / un login nuevo lo reemplazo
    var marker = readLogoutPending(s);
    var markerId = marker && marker.id ? marker.id : null;
    var uid = marker && isUuid(marker.authUid) ? String(marker.authUid) : null;
    var r = await signOutIfCurrentUser(client, uid);
    if (r.status === "signed_out") { clearLogoutPendingIf(s, markerId); return { status: "completed" }; }
    if (r.status === "absent") { clearLogoutPendingIf(s, markerId); return { status: "completed", reason: "session_absent" }; }
    if (r.status === "other_user") { clearLogoutPendingIf(s, markerId); return { status: "completed", reason: "session_replaced" }; }
    return { status: "pending", reason: errName(r.error) };
  }

  inFlight = new Promise(function (resolve) {
    var done = false;
    var timer = null;
    function finish(v) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve(v);
    }
    timer = setTimeout(function () { finish({ status: "pending", reason: "timeout" }); }, timeoutMs);
    runAuthTransition(
      function () {
        return work().then(finish, function (e) { finish({ status: "pending", reason: errName(e) }); });
      },
      { locks: d.locks, waitMs: d.waitMs, onTimeout: "skip" }
    ).then(
      function (res) { if (!res.ran) finish({ status: "pending", reason: "lock_timeout" }); },
      function (e) { finish({ status: "pending", reason: errName(e) }); }
    );
  }).then(function (res) {
    inFlight = null;
    return res;
  });
  return inFlight;
}

/**
 * Punto unico de logout. `onLocalInvalidated` se ejecuta SINCRONICAMENTE (antes de cualquier espera de red): ahi la app pasa a la
 * pantalla de login. Despues se intenta cerrar Supabase Auth; si falla queda el marcador y se reintenta.
 * deps: { client, storage, clearLocal, onLocalInvalidated, timeoutMs, locks }
 */
export async function performLogout(deps) {
  var d = deps || {};
  var begun = beginLogout(d);
  try {
    if (typeof d.onLocalInvalidated === "function") d.onLocalInvalidated(begun);
  } catch (e) {
    console.error("[LOGOUT] onLocalInvalidated fallo", e && e.message ? e.message : e);
  }
  var remote = await completePendingLogout(d);
  return { marked: begun.marked, remote: remote };
}

/** Solo para pruebas: reinicia el estado de modulo. */
export function _resetSessionLogoutForTests() {
  inFlight = null;
  transitionChain = Promise.resolve();
}
