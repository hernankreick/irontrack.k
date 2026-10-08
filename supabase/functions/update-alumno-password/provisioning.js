// Logica pura de update-alumno-password (S0.6.1): autorizacion del caller + provisioning seguro de auth_uid.
//
// Sin dependencias de Deno: index.ts inyecta el cliente admin (service role) y la configuracion; los tests
// (scripts/test-provisionStudentAuth.mjs) inyectan dobles. NUNCA se loguea password, JWT ni claves.
//
// Contrato de entrada preferido: { alumnoId, newPassword }. El email de Auth NO viene del cliente: sale de la fila public.alumnos.
// Contrato LEGACY transitorio (PWA/frontend viejo cacheado): { alumnoEmail, newPassword }. alumnoEmail solo sirve para localizar
// EXACTAMENTE una fila de public.alumnos (despues de autorizar al caller); desde ahi todo sigue por alumno.id. Nunca se usa para
// buscar un Auth user. Si llegan ambos, manda alumnoId y alumnoEmail se ignora.
//
// Modelo de autorizacion (fail-closed):
//   1. JWT valido resuelto por Auth (admin.auth.getUser) -> caller.
//   2. El caller debe SER el entrenador: uid en COACH_AUTH_UIDS (si esta configurado) o, si no, email confirmado
//      incluido en COACH_EMAILS (default entrenador@irontrack.app, el unico coach que reconoce la app).
//      No se confia en user_metadata.role, localStorage, ni datos enviados por el cliente.
//   3. El caller no puede ser un alumno (ningun alumnos.auth_uid = caller.id).
//   4. El alumno objetivo se lee de la DB por alumnoId y debe pertenecer al coach: entrenador_id == caller.id
//      o el valor legacy "entrenador_principal" (solo alcanzable DESPUES de los pasos 1-3).

export const LEGACY_COACH_ID = "entrenador_principal";
export const DEFAULT_COACH_EMAIL = "entrenador@irontrack.app";

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var LIST_PER_PAGE = 200;
var LIST_MAX_PAGES = 20;

export function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

export function normalizeEmail(v) {
  return typeof v === "string" ? v.trim().toLowerCase() : "";
}

export function isValidEmail(v) {
  return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v);
}

export function extractBearer(header) {
  if (typeof header !== "string") return "";
  var m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : "";
}

/** Escapa % _ \ para usar el email como patron de ilike (comparacion exacta, sin comodines). */
export function escapeLike(v) {
  return String(v).replace(/[\\%_]/g, function (c) { return "\\" + c; });
}

/** env: { COACH_AUTH_UIDS?: "uuid,uuid", COACH_EMAILS?: "a@x.com,b@y.com" } */
export function parseCoachConfig(env) {
  var e = env || {};
  var uids = new Set();
  String(e.COACH_AUTH_UIDS || "").split(",").forEach(function (s) {
    var t = s.trim().toLowerCase();
    if (isUuid(t)) uids.add(t);
  });
  var emails = new Set();
  String(e.COACH_EMAILS || "").split(",").forEach(function (s) {
    var t = normalizeEmail(s);
    if (isValidEmail(t)) emails.add(t);
  });
  if (emails.size === 0) emails.add(DEFAULT_COACH_EMAIL);
  return { uids: uids, emails: emails };
}

/** Evidencia para AUTORIZAR al caller como entrenador. */
export function isCoachUser(user, cfg) {
  if (!user || !isUuid(user.id)) return false;
  if (cfg.uids.size > 0) return cfg.uids.has(String(user.id).toLowerCase());
  var confirmed = !!(user.email_confirmed_at || user.confirmed_at);
  return confirmed && cfg.emails.has(normalizeEmail(user.email));
}

/** Para NO enlazar/operar la cuenta del coach como si fuera un alumno (uid o email, sin exigir confirmacion). */
export function isCoachIdentity(user, cfg) {
  if (!user) return false;
  if (isUuid(user.id) && cfg.uids.has(String(user.id).toLowerCase())) return true;
  return cfg.emails.has(normalizeEmail(user.email));
}

/** Pertenencia del alumno al coach. Solo se evalua con un caller ya autorizado como coach. */
export function canManageAlumno(caller, alumno) {
  if (!caller || !alumno || alumno.entrenador_id == null) return false;
  var owner = String(alumno.entrenador_id);
  return owner === String(caller.id) || owner === LEGACY_COACH_ID;
}

function fail(status, error) {
  return { status: status, body: { error: error } };
}

async function findAuthUsersByEmail(admin, email) {
  var out = [];
  for (var page = 1; page <= LIST_MAX_PAGES; page++) {
    var res = await admin.auth.admin.listUsers({ page: page, perPage: LIST_PER_PAGE });
    if (res.error) throw new Error("listUsers failed");
    var users = res.data && res.data.users ? res.data.users : [];
    users.forEach(function (u) {
      if (normalizeEmail(u.email) === email) out.push(u);
    });
    if (users.length < LIST_PER_PAGE) return out;
  }
  // Mas usuarios de los que se pueden recorrer: no se puede afirmar unicidad -> fail-closed.
  throw new Error("auth users exceed scan limit");
}

/** Vincula alumnos.auth_uid solo si sigue NULL y verifica que el vinculo quedo persistido. */
async function linkAlumnoAuthUid(admin, alumnoId, authUid) {
  var upd = await admin.from("alumnos").update({ auth_uid: authUid }).eq("id", alumnoId).is("auth_uid", null).select("id,auth_uid");
  if (upd.error) return { ok: false, reason: upd.error.code === "23505" ? "unique_conflict" : "update_error" };
  if (!Array.isArray(upd.data) || upd.data.length !== 1 || upd.data[0].auth_uid !== authUid) return { ok: false, reason: "not_linked" };
  var chk = await admin.from("alumnos").select("id,auth_uid").eq("id", alumnoId).maybeSingle();
  if (chk.error || !chk.data || String(chk.data.id) !== String(alumnoId) || chk.data.auth_uid !== authUid) return { ok: false, reason: "verify_failed" };
  return { ok: true };
}

async function setPassword(admin, authUid, newPassword) {
  var res = await admin.auth.admin.updateUserById(authUid, { password: newPassword });
  if (res.error) return fail(400, res.error.message || "could not update password");
  return null;
}

/**
 * Resuelve el alumno objetivo -> alumno.id. UNICO lugar donde se lee `alumnoEmail` (contrato legacy).
 * Se invoca solo con un caller ya autorizado como coach (y que no es alumno). El email solo selecciona UNA fila de public.alumnos
 * (coincidencia exacta normalizada, comodines de LIKE escapados); nunca busca ni toca un Auth user.
 */
export async function resolveTargetAlumnoId(admin, inp) {
  var input = inp || {};
  if (input.alumnoId !== undefined && input.alumnoId !== null) {
    var id = input.alumnoId;
    if (typeof id !== "string" || id.trim() === "" || id.length > 128) return { ok: false, response: fail(400, "alumnoId required") };
    return { ok: true, alumnoId: id.trim(), via: "id" };
  }
  var raw = input.alumnoEmail;
  if (raw === undefined || raw === null) return { ok: false, response: fail(400, "alumnoId required") };
  var email = normalizeEmail(raw);
  if (typeof raw !== "string" || !isValidEmail(email)) return { ok: false, response: fail(400, "alumnoEmail invalid") };
  var res = await admin.from("alumnos").select("id,email").ilike("email", escapeLike(email));
  if (res.error || !Array.isArray(res.data)) return { ok: false, response: fail(500, "lookup failed") };
  var rows = res.data.filter(function (r) { return normalizeEmail(r.email) === email; });
  if (rows.length === 0) return { ok: false, response: fail(404, "alumno not found") };
  if (rows.length > 1) return { ok: false, response: fail(409, "ambiguous student email") };
  if (rows[0].id == null || String(rows[0].id).trim() === "") return { ok: false, response: fail(500, "lookup failed") };
  return { ok: true, alumnoId: String(rows[0].id), via: "email" };
}

/**
 * @param {{admin:object, coach:{uids:Set,emails:Set}, log?:object}} deps
 * @param {{authorization?:string, alumnoId?:string, alumnoEmail?:string, newPassword?:string}} input
 * @returns {Promise<{status:number, body:object}>}
 */
export async function provisionStudentAuth(deps, input) {
  var admin = deps.admin;
  var coach = deps.coach;
  var log = deps.log || { warn: function () {}, error: function () {} };
  var inp = input || {};

  var token = extractBearer(inp.authorization);
  if (!token) return fail(401, "missing authorization");

  // 1) caller
  var caller = null;
  try {
    var who = await admin.auth.getUser(token);
    caller = who && !who.error && who.data ? who.data.user : null;
  } catch (e) {
    caller = null;
  }
  if (!caller || !isUuid(caller.id)) return fail(401, "invalid session");

  // 2) el caller debe ser el entrenador
  if (!isCoachUser(caller, coach)) {
    log.warn("[update-alumno-password] caller rechazado: no es entrenador autorizado", { callerId: caller.id });
    return fail(403, "not authorized");
  }

  // forma del body (sin tocar la DB; despues de autenticar/autorizar para no revelar nada a callers no autorizados)
  if (typeof inp.newPassword !== "string" || inp.newPassword.length === 0) return fail(400, "newPassword required");
  var newPassword = inp.newPassword;

  // 3) el caller no puede ser un alumno
  var asAlumno = await admin.from("alumnos").select("id").eq("auth_uid", caller.id);
  if (asAlumno.error || !Array.isArray(asAlumno.data)) return fail(500, "lookup failed");
  if (asAlumno.data.length > 0) {
    log.warn("[update-alumno-password] caller rechazado: la cuenta pertenece a un alumno", { callerId: caller.id });
    return fail(403, "not authorized");
  }

  // 4) alumno objetivo: alumnoId (preferido) o alumnoEmail legacy -> UNA fila -> alumno.id; luego la fila real desde la DB por id
  var resolved = await resolveTargetAlumnoId(admin, inp);
  if (!resolved.ok) return resolved.response;
  if (resolved.via === "email") log.warn("[update-alumno-password] contrato legacy alumnoEmail utilizado", { alumnoId: resolved.alumnoId });
  var alumnoId = resolved.alumnoId;
  var target = await admin.from("alumnos").select("id,email,entrenador_id,auth_uid").eq("id", alumnoId).maybeSingle();
  if (target.error) return target.error.code === "22P02" ? fail(404, "alumno not found") : fail(500, "lookup failed");
  if (!target.data) return fail(404, "alumno not found");
  var alumno = target.data;
  if (!canManageAlumno(caller, alumno)) {
    log.warn("[update-alumno-password] caller rechazado: el alumno no pertenece al entrenador", { callerId: caller.id, alumnoId: alumno.id });
    return fail(403, "not authorized for this student");
  }

  // ── A) vinculo canonico existente: se opera SOLO sobre ese Auth user (sin buscar por email) ──
  if (alumno.auth_uid != null) {
    if (!isUuid(alumno.auth_uid)) return fail(409, "invalid auth link");
    var linked = await admin.auth.admin.getUserById(alumno.auth_uid);
    var linkedUser = linked && !linked.error && linked.data ? linked.data.user : null;
    if (!linkedUser || linkedUser.id !== alumno.auth_uid) return fail(409, "linked auth user not found");
    if (isCoachIdentity(linkedUser, coach)) return fail(409, "linked auth user is not a student account");
    var pwErr = await setPassword(admin, alumno.auth_uid, newPassword);
    if (pwErr) return pwErr;
    return { status: 200, body: { ok: true, authUid: alumno.auth_uid, linked: false, created: false } };
  }

  // ── B) auth_uid NULL: localizar/crear el Auth user de forma controlada y vincular ──
  var email = normalizeEmail(alumno.email);
  if (!isValidEmail(email)) return fail(400, "student email is missing or invalid");

  // ningun otro alumno puede compartir el email (identidad ambigua)
  var sameEmail = await admin.from("alumnos").select("id").ilike("email", escapeLike(email));
  if (sameEmail.error || !Array.isArray(sameEmail.data)) return fail(500, "lookup failed");
  if (sameEmail.data.length !== 1 || String(sameEmail.data[0].id) !== String(alumno.id)) return fail(409, "ambiguous student email");

  var matches;
  try {
    matches = await findAuthUsersByEmail(admin, email);
  } catch (e) {
    log.error("[update-alumno-password] busqueda de Auth user fallo", { alumnoId: alumno.id });
    return fail(500, "auth lookup failed");
  }
  if (matches.length > 1) return fail(409, "ambiguous auth user for email");

  var created = false;
  var authUser = matches.length === 1 ? matches[0] : null;

  if (!authUser) {
    var cr = await admin.auth.admin.createUser({ email: email, password: newPassword, email_confirm: true, user_metadata: { role: "alumno" } });
    if (cr.error || !cr.data || !cr.data.user) {
      // posible carrera / email ya registrado que la busqueda no vio: una sola re-busqueda, exigiendo unicidad
      var retry = [];
      try { retry = await findAuthUsersByEmail(admin, email); } catch (e) { retry = []; }
      if (retry.length !== 1) return fail(409, "could not create auth user");
      authUser = retry[0];
    } else {
      authUser = cr.data.user;
      created = true;
    }
  }

  if (!isUuid(authUser.id)) return fail(500, "invalid auth user");
  if (isCoachIdentity(authUser, coach)) {
    if (created) await tryDelete(admin, authUser.id, log);
    return fail(409, "email belongs to a non-student account");
  }

  // el Auth user no puede estar ya vinculado a otro alumno (UNIQUE(auth_uid) tambien lo impediria)
  var otherLink = await admin.from("alumnos").select("id").eq("auth_uid", authUser.id);
  if (otherLink.error || !Array.isArray(otherLink.data)) {
    if (created) await tryDelete(admin, authUser.id, log);
    return fail(500, "lookup failed");
  }
  if (otherLink.data.length > 0) {
    if (created) await tryDelete(admin, authUser.id, log);
    return fail(409, "auth user already linked to another student");
  }

  // Se vincula ANTES de tocar la contrasena de un usuario preexistente: si hay conflicto no se cambia nada.
  var link = await linkAlumnoAuthUid(admin, alumno.id, authUser.id);
  if (!link.ok) {
    log.error("[update-alumno-password] vinculo auth_uid fallo", { alumnoId: alumno.id, reason: link.reason });
    if (created) await tryDelete(admin, authUser.id, log);
    return fail(409, "could not link auth identity");
  }

  if (!created) {
    var pwErr2 = await setPassword(admin, authUser.id, newPassword);
    if (pwErr2) return pwErr2; // el vinculo (correcto) queda; reintentar es idempotente
  }
  return { status: 200, body: { ok: true, authUid: authUser.id, linked: true, created: created } };
}

async function tryDelete(admin, userId, log) {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch (e) {
    log.error("[update-alumno-password] no se pudo revertir el Auth user creado", { userId: userId });
  }
}
