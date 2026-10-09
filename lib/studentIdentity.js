// Identidad canonica del alumno (S0.6).
//
//   Supabase Auth user.id  ->  public.alumnos.auth_uid  ->  public.alumnos.id
//
// La identidad NUNCA se resuelve por email (ni el tipeado, ni el de Auth, ni el de public.alumnos) ni se toma de localStorage.
// `client` es el cliente supabase-js (inyectado para poder probarlo sin red). Todo es fail-closed: ante cualquier duda
// (0 filas, >1 filas, error, respuesta invalida) no hay sesion de alumno.

import { isLogoutPending, runAuthTransition, signOutIfCurrentUser, signInReplacingResidual } from "./sessionLogout.js";

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidAuthUid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

// Cierra la sesion recien creada cuando la identidad se rechaza. Solo la sesion LOCAL y solo si sigue siendo la de `userId`: un
// signOut global cerraria las sesiones del mismo usuario en otros dispositivos, y un signOut sobre "la sesion almacenada" podria
// alcanzar a la de otra cuenta iniciada entretanto en otra pestana.
async function safeSignOut(client, userId, deps) {
  try {
    if (!client || !client.auth || typeof client.auth.signOut !== "function") return;
    if (!isValidAuthUid(userId)) {
      await client.auth.signOut({ scope: "local" });
      return;
    }
    var d = deps || {};
    var out = await runAuthTransition(function () { return signOutIfCurrentUser(client, String(userId)); }, { locks: d.locks, waitMs: d.waitMs, storage: d.storage, leaseTtlMs: d.leaseTtlMs, leasePollMs: d.leasePollMs });
    if (!out.ran) console.error("[AUTH] cierre de la sesion rechazada omitido: hay otra operacion de sesion en curso (" + (out.reason || "busy") + ")");
  } catch (e) {
    console.error("[AUTH] signOut fallo tras rechazar la identidad de alumno", e && e.message ? e.message : e);
  }
}

/**
 * Resuelve EXACTAMENTE un alumno por public.alumnos.auth_uid = authUid.
 * @returns {Promise<{ok:true, alumno:{id,nombre,entrenador_id,auth_uid}} | {ok:false, reason:string}>}
 */
export async function resolveAlumnoByAuthUid(client, authUid) {
  if (!isValidAuthUid(authUid)) return { ok: false, reason: "invalid_auth_uid" };
  var res;
  try {
    res = await client.from("alumnos").select("id,nombre,entrenador_id,auth_uid").eq("auth_uid", authUid);
  } catch (e) {
    return { ok: false, reason: "query_exception" };
  }
  if (!res || res.error) return { ok: false, reason: "query_error", detail: res && res.error ? (res.error.message || res.error.code || "") : "" };
  if (!Array.isArray(res.data)) return { ok: false, reason: "invalid_response" };
  if (res.data.length === 0) return { ok: false, reason: "no_alumno_for_auth_uid" };
  if (res.data.length > 1) return { ok: false, reason: "multiple_alumnos_for_auth_uid" };
  var row = res.data[0];
  if (!row || row.id == null || row.id === "") return { ok: false, reason: "invalid_row" };
  if (String(row.auth_uid) !== authUid) return { ok: false, reason: "auth_uid_mismatch" };
  return { ok: true, alumno: row };
}

/**
 * it_session del alumno a partir de datos canonicos. `prev` (sesion almacenada) solo aporta campos cosmeticos
 * (nombre editado localmente, avatar, telefono, email de perfil) y UNICAMENTE si pertenece al mismo alumno canonico;
 * role / alumnoId / entrenadorId / authUid salen siempre de la fila resuelta.
 */
export function buildStudentSession(alumno, authUid, prev) {
  var same = !!(prev && typeof prev === "object" && prev.alumnoId != null && String(prev.alumnoId) === String(alumno.id));
  var base = same ? Object.assign({}, prev) : {};
  return Object.assign(base, {
    role: "alumno",
    name: same && prev.name ? prev.name : alumno.nombre,
    alumnoId: alumno.id,
    entrenadorId: alumno.entrenador_id,
    authUid: authUid,
  });
}

/**
 * Login del alumno: signInWithPassword valida la contrasena; la identidad sale de user.id -> alumnos.auth_uid.
 * Si la identidad no se resuelve se hace signOut (solo local, solo de esa sesion) y NO se devuelve sesion.
 * El inicio de sesion reemplaza una sesion residual de un logout pendiente: ver signInReplacingResidual (borra el marcador al
 * autenticar, para que la barrera del token residual no bloquee las consultas del propio login).
 * `deps` (opcional): { storage, locks, waitMs }.
 * @returns {Promise<{ok:true, session:object, alumno:object, authUid:string} | {ok:false, reason:string}>}
 */
export async function loginStudent(client, email, password, deps) {
  var auth = await signInReplacingResidual(deps, function () { return client.auth.signInWithPassword({ email: email, password: password }); });
  // Cierre anterior aun en curso y sin exclusion disponible: no se inicio el login (estado recuperable: reintentar).
  if (auth && auth.error && auth.error.code === "auth_busy") return { ok: false, reason: "auth_busy" };
  if (!auth || auth.error || !auth.data || !auth.data.session) return { ok: false, reason: "invalid_credentials" };
  var userId = auth.data.user ? auth.data.user.id : null;
  if (!isValidAuthUid(userId)) {
    console.error("[AUTH] login alumno rechazado: signInWithPassword sin user.id valido");
    await safeSignOut(client, null, deps);
    return { ok: false, reason: "invalid_auth_user" };
  }
  var authUid = String(userId);
  var resolved = await resolveAlumnoByAuthUid(client, authUid);
  if (!resolved.ok) {
    console.error("[AUTH] login alumno rechazado: identidad no resuelta por auth_uid", { reason: resolved.reason, authUid: authUid, detail: resolved.detail || undefined });
    await safeSignOut(client, authUid, deps);
    return { ok: false, reason: resolved.reason };
  }
  return { ok: true, alumno: resolved.alumno, authUid: authUid, session: buildStudentSession(resolved.alumno, authUid, null) };
}

/**
 * Restauracion de una it_session de alumno. localStorage NO es autoridad: se consulta la sesion real de Supabase Auth y
 * se reconstruye la sesion desde public.alumnos (por auth_uid). El alumnoId/authUid almacenados se ignoran.
 * @param {object} stored it_session parseada (solo se usa para campos cosmeticos del MISMO alumno)
 */
export async function restoreStudentSession(client, stored, storage) {
  if (!stored || stored.role !== "alumno") return { ok: false, reason: "not_student_session" };
  // Logout pedido y aun no completado (p. ej. cerrado offline): la sesion Auth residual NO autoriza nada hasta un login nuevo.
  if (isLogoutPending(storage)) return { ok: false, reason: "logout_pending" };
  var res;
  try {
    res = await client.auth.getSession();
  } catch (e) {
    return { ok: false, reason: "get_session_exception" };
  }
  if (!res || res.error || !res.data || !res.data.session) return { ok: false, reason: "no_auth_session" };
  var userId = res.data.session.user ? res.data.session.user.id : null;
  if (!isValidAuthUid(userId)) return { ok: false, reason: "invalid_auth_user" };
  var authUid = String(userId);
  var resolved = await resolveAlumnoByAuthUid(client, authUid);
  if (!resolved.ok) return { ok: false, reason: resolved.reason, detail: resolved.detail };
  return { ok: true, alumno: resolved.alumno, authUid: authUid, session: buildStudentSession(resolved.alumno, authUid, stored) };
}

/**
 * upsertEntrenador (fila en public.entrenadores con id = auth uid) SOLO corresponde a una sesion de ENTRENADOR.
 * Criterio positivo (antes solo se omitia si it_session era de alumno): sin it_session, con it_session ilegible, de alumno, con
 * un login de alumno en curso o con un logout pendiente NO se escribe. Asi un evento Auth de un alumno (SIGNED_IN tras recuperar
 * red o renovar el token) no crea una fila en entrenadores aunque it_session falte. El login del entrenador hace su propio upsert.
 */
export function shouldSkipEntrenadorUpsert(storage, studentFlowInFlight) {
  if (studentFlowInFlight) return true;
  try {
    if (isLogoutPending(storage)) return true;
    var raw = storage && typeof storage.getItem === "function" ? storage.getItem("it_session") : null;
    var parsed = raw ? JSON.parse(raw) : null;
    return !(parsed && parsed.role === "entrenador");
  } catch (e) {
    return true;
  }
}
