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
var LOGOUT_LOCK_NAME = "irontrack:complete-logout";

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
    authUid: prev && prev.authUid ? String(prev.authUid) : null,
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

/**
 * Termina el logout contra Supabase Auth. Idempotente y seguro entre pestanas (Web Locks `ifAvailable`; sin Web Locks, signOut es
 * idempotente). Nunca lanza.
 * deps: { client, storage, timeoutMs, locks }
 * @returns {Promise<{status:'none'|'completed'|'pending'|'busy', reason?:string}>}
 */
export function completePendingLogout(deps) {
  var d = deps || {};
  var s = d.storage || defaultStorage();
  if (!isLogoutPending(s)) return Promise.resolve({ status: "none" });
  if (inFlight) return inFlight;
  var timeoutMs = d.timeoutMs != null ? d.timeoutMs : LOGOUT_REMOTE_TIMEOUT_MS;

  async function attempt() {
    var client = d.client;
    if (!client || !client.auth || typeof client.auth.signOut !== "function") return { status: "pending", reason: "no_client" };
    if (!isLogoutPending(s)) return { status: "none" }; // otra pestana ya lo completo
    var err = null;
    try {
      var r = await withTimeout(client.auth.signOut({ scope: "local" }), timeoutMs);
      err = r && r.error ? r.error : null;
    } catch (e) {
      err = e;
    }
    if (!err) {
      clearLogoutPending(s);
      return { status: "completed" };
    }
    // signOut devolvio error. Si el SDK ya no tiene sesion local (el servidor rechazo el refresh token y la borro) el logout
    // esta cumplido. getSession() con error de red NO prueba nada: sigue pendiente.
    try {
      var g = await withTimeout(client.auth.getSession(), timeoutMs);
      if (g && !g.error && g.data && !g.data.session) {
        clearLogoutPending(s);
        return { status: "completed", reason: "session_absent" };
      }
    } catch (e2) {}
    return { status: "pending", reason: errName(err) };
  }

  var locks = d.locks !== undefined ? d.locks : typeof navigator !== "undefined" && navigator ? navigator.locks : null;
  var run;
  if (locks && typeof locks.request === "function") {
    run = locks
      .request(LOGOUT_LOCK_NAME, { ifAvailable: true }, function (lock) {
        if (!lock) return { status: "busy" };
        return attempt();
      })
      .catch(function () {
        return attempt();
      });
  } else {
    run = attempt();
  }
  inFlight = Promise.resolve(run)
    .catch(function (e) {
      return { status: "pending", reason: errName(e) };
    })
    .then(function (res) {
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
}
