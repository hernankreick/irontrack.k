// Autenticacion de las llamadas REST propias (`sbFetch` y fetch directos a /rest/v1) - S0.6 Fase 1.
//
// Problema: si no habia sesion de Supabase Auth (cerrada, vencida sin red, logout pendiente), las llamadas caian en silencio a la
// anon key y se enviaban como `anon`, tambien las escrituras y lecturas privadas de un alumno.
//
// Regla: una llamada usa el token de la sesion Auth; sin sesion NO se envia, salvo estos accesos anonimos identificados:
//  1. Enlace compartido (?r=): visitante no autenticado por diseno; solo lectura (GET/HEAD).
//  2. Lecturas de arranque de datos globales de la app: config (alias de pago), video_overrides y ejercicio_overrides; solo GET.
//     Se piden al montar, antes de resolver la sesion, y en la pantalla de login.
// Con un logout pendiente nunca se usa el token residual del SDK (el usuario pidio salir) ni, por lo tanto, nada privado.

import { isLogoutPending } from "./sessionLogout.js";

export var ANON_BOOT_READ_TABLES = ["config", "video_overrides", "ejercicio_overrides"];

var READ_METHODS = { GET: true, HEAD: true };

export class AuthRequiredError extends Error {
  constructor(reason, detail) {
    super("auth_required:" + reason);
    this.name = "AuthRequiredError";
    this.code = "auth_required";
    this.reason = reason;
    if (detail) this.detail = detail;
  }
}

function tableOf(path) {
  var p = String(path || "");
  var q = p.indexOf("?");
  if (q >= 0) p = p.slice(0, q);
  return p.replace(/^\/+/, "").split("/")[0];
}

/** true si la URL actual es un enlace compartido (?r=...). */
export function isSharedLinkLocation(search) {
  try {
    var s = search != null ? search : typeof window !== "undefined" && window.location ? window.location.search : "";
    return !!new URLSearchParams(s).get("r");
  } catch (e) {
    return false;
  }
}

/**
 * @param {{session:object|null, method:string, path:string, sharedLink:boolean, logoutPending:boolean}} a
 * @returns {{ok:true, kind:'user'|'anon'} | {ok:false, reason:string}}
 */
export function decideRestAuth(a) {
  var x = a || {};
  if (x.logoutPending) return { ok: false, reason: "logout_pending" };
  if (x.session && x.session.access_token) return { ok: true, kind: "user" };
  var method = String(x.method || "GET").toUpperCase();
  if (!READ_METHODS[method]) return { ok: false, reason: "no_auth_session" };
  if (x.sharedLink) return { ok: true, kind: "anon" };
  if (ANON_BOOT_READ_TABLES.indexOf(tableOf(x.path)) >= 0) return { ok: true, kind: "anon" };
  return { ok: false, reason: "no_auth_session" };
}

/**
 * Resolutor de credenciales REST ligado a un cliente supabase-js. `getActiveSession` es la unica via por la que la app lee la sesion
 * Auth para sus llamadas propias: con un logout pendiente devuelve null aunque el SDK conserve el token residual.
 * deps: { client, storage, anonKey, getSearch }
 */
export function createRestAuthResolver(deps) {
  var d = deps || {};

  async function getActiveSession() {
    var client = d.client;
    if (!client || !client.auth || typeof client.auth.getSession !== "function") return null;
    if (isLogoutPending(d.storage)) return null;
    try {
      var result = await client.auth.getSession();
      if (result && result.error) {
        console.error("[AUTH] getSession error", result.error);
        return null;
      }
      return result && result.data ? result.data.session : null;
    } catch (e) {
      console.error("[AUTH] getSession exception", e);
      return null;
    }
  }

  /** @returns {Promise<{ok:true, token:string, kind:'user'|'anon'} | {ok:false, reason:string}>} */
  async function resolve(path, method) {
    var session = await getActiveSession();
    var decision = decideRestAuth({
      session: session,
      method: method,
      path: path,
      sharedLink: isSharedLinkLocation(typeof d.getSearch === "function" ? d.getSearch() : undefined),
      logoutPending: isLogoutPending(d.storage),
    });
    if (!decision.ok) return { ok: false, reason: decision.reason };
    return { ok: true, kind: decision.kind, token: decision.kind === "user" ? session.access_token : d.anonKey };
  }

  return { getActiveSession: getActiveSession, resolve: resolve };
}
