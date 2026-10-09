// Barrera del cliente supabase-js contra el token residual de un logout pendiente (integracion S0.6 Fase 1 + Etapa 1A).
//
// Problema: tras un logout sin red, `irontrack_logout_pending` existe pero el SDK conserva la sesion (el token) hasta que signOut
// tenga exito. sbFetch ya no lo usa (lib/restAuth.js), pero las llamadas del propio SDK (`supabase.from(...)`, `.functions`,
// `.storage`) lo enviarian en `Authorization`. Este `fetch` (supabase-js: global.fetch) lo impide:
//
//   - Con logout pendiente, toda solicitud a /rest/v1, /functions/v1 y /storage/v1 se responde 401 SIN tocar la red, salvo
//   - las LECTURAS de un enlace compartido (?r=): el visitante es anonimo por diseno, asi que se envian con la anon key como
//     Authorization (nunca con el token residual).
//   - /auth/v1 no se toca: signOut necesita el token para revocar la sesion, y el refresco/login siguen funcionando.
//
// Sin logout pendiente es transparente. Se compone por fuera de createSharedReadOnlyFetch (lib/sharedMode.js): el bloqueo de
// escrituras del enlace compartido sigue aplicandose despues.
import { isLogoutPending } from "./sessionLogout.js";
import { isSharedReadOnlyMode, isWriteMethod } from "./sharedMode.js";

var DATA_PREFIXES = ["/rest/v1/", "/functions/v1/", "/storage/v1/"];

// Tope de la solicitud de cierre de sesion (POST /auth/v1/logout). El signOut del SDK, al terminar, BORRA la sesion local almacenada
// aunque ya sea de otra cuenta; si la red lo deja colgado ese borrado puede llegar mucho despues de un login nuevo. Con este tope el
// signOut termina (con error de red) en un plazo conocido, y la exclusion de lib/sessionLogout.js (runAuthTransition) tiene un limite
// real en vez de depender de que el navegador se rinda.
export var LOGOUT_REQUEST_TIMEOUT_MS = 7000;

function isLogoutRequest(url, method) {
  if (method !== "POST") return false;
  try {
    return /\/auth\/v1\/logout$/.test(new URL(String(url), "http://local.invalid").pathname);
  } catch (e) {
    return false;
  }
}

function callWithTimeout(self, base, input, init, ms) {
  if (typeof AbortController === "undefined") return base.call(self, input, init);
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, ms);
  var outer = init && init.signal;
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", function () { ctrl.abort(); });
  }
  var nextInit = Object.assign({}, init || {}, { signal: ctrl.signal });
  return Promise.resolve(base.call(self, input, nextInit)).then(
    function (r) { clearTimeout(timer); return r; },
    function (e) { clearTimeout(timer); throw e; }
  );
}

function urlOf(input) {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") return input.url || (typeof input.toString === "function" ? input.toString() : "");
  return "";
}

function methodOf(input, init) {
  return String((init && init.method) || (input && typeof input === "object" && input.method) || "GET").toUpperCase();
}

function isDataRequest(url) {
  var path;
  try {
    path = new URL(String(url), "http://local.invalid").pathname;
  } catch (e) {
    return true; // ilegible: se trata como solicitud de datos (falla cerrado)
  }
  return DATA_PREFIXES.some(function (p) { return path.indexOf(p) === 0 || path === p.slice(0, -1); });
}

/**
 * @param {Function} baseFetch  fetch siguiente (por ejemplo createSharedReadOnlyFetch())
 * @param {{anonKey:string, isPending?:Function, isShared?:Function, logoutTimeoutMs?:number}} options
 */
export function createResidualTokenGuardFetch(baseFetch, options) {
  var o = options || {};
  var isPending = typeof o.isPending === "function" ? o.isPending : function () { return isLogoutPending(); };
  var isShared = typeof o.isShared === "function" ? o.isShared : function () { return isSharedReadOnlyMode(); };
  return function residualTokenGuardFetch(input, init) {
    var base = typeof baseFetch === "function" ? baseFetch : function () { return globalThis.fetch.apply(globalThis, arguments); };
    if (isLogoutRequest(urlOf(input), methodOf(input, init))) {
      return callWithTimeout(this, base, input, init, o.logoutTimeoutMs != null ? o.logoutTimeoutMs : LOGOUT_REQUEST_TIMEOUT_MS);
    }
    if (!isPending() || !isDataRequest(urlOf(input))) return base.apply(this, arguments);
    var method = methodOf(input, init);
    if (isShared() && !isWriteMethod(method) && o.anonKey) {
      // Lectura anonima del visitante del enlace compartido: se REEMPLAZA la credencial, no se reutiliza la residual.
      var headers = new Headers((init && init.headers) || (input && typeof input === "object" ? input.headers : undefined) || undefined);
      headers.set("Authorization", "Bearer " + o.anonKey);
      var nextInit = Object.assign({}, init || {}, { headers: headers });
      return base.call(this, input, nextInit);
    }
    var body = JSON.stringify({ code: "logout_pending", message: "Cierre de sesion pendiente: no se usa la sesion anterior" });
    return Promise.resolve(new Response(body, { status: 401, headers: { "Content-Type": "application/json", "X-IronTrack-Blocked": "logout-pending" } }));
  };
}
