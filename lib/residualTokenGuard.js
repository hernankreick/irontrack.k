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
 * @param {{anonKey:string, isPending?:Function, isShared?:Function}} options
 */
export function createResidualTokenGuardFetch(baseFetch, options) {
  var o = options || {};
  var isPending = typeof o.isPending === "function" ? o.isPending : function () { return isLogoutPending(); };
  var isShared = typeof o.isShared === "function" ? o.isShared : function () { return isSharedReadOnlyMode(); };
  return function residualTokenGuardFetch(input, init) {
    var base = typeof baseFetch === "function" ? baseFetch : function () { return globalThis.fetch.apply(globalThis, arguments); };
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
