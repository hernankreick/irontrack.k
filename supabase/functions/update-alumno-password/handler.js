// Logica pura (sin Deno ni red) de update-alumno-password, con el cliente admin inyectado para poder probarla.
//
// IT-002a. Reglas:
//  1. QUIEN llama: el solicitante debe estar en la lista de entrenadores autorizados (allowedCoachUids), que viene de un SECRETO de la
//     funcion (COACH_UIDS). No se confia en datos que el cliente pueda escribir: ni alumnos.entrenador_id, ni una fila en `entrenadores`
//     (el cliente inserta esa fila para cualquier usuario con sesion). Sin lista valida, todo se deniega.
//  2. SOBRE QUE alumno: ademas, alumnos.entrenador_id debe ser el UID del solicitante o el valor legacy "entrenador_principal".
//  3. SOBRE QUE cuenta de Auth: una cuenta existente se modifica SOLO si esta vinculada al alumno por app_metadata.alumno_id.
//     Ese dato solo lo escribe el servidor (la funcion al crear la cuenta, o el propietario tras verificar la titularidad); un usuario no
//     puede escribir su propio app_metadata. NO son vinculos confiables: una coincidencia de email, las columnas de la ficha del alumno
//     (incluida cualquier columna con el id de una cuenta) ni user_metadata, porque el cliente puede escribirlos.
//     Si existe una cuenta con ese email sin vinculo, responde 409 y no toca nada.
//  4. Nunca se modifica la cuenta del solicitante ni la de ningun entrenador autorizado.
//  5. Sobre una cuenta existente solo se cambia la contrasena: el email de login y su confirmacion no se tocan. Si el email de la cuenta
//     vinculada difiere del de la ficha, responde 409 sin modificar nada.

const json = (status, body) => ({ status, body });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const LEGACY_COACH_ID = 'entrenador_principal';
const PAGE_SIZE = 200;
const MAX_PAGES = 20;

/** Lista de UIDs de entrenadores desde el secreto (separados por coma). Descarta lo que no sea UUID. */
export function parseCoachUids(raw) {
  return String(raw == null ? '' : raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => UUID_RE.test(s));
}

// Escapa los comodines de LIKE para que el email se compare literalmente.
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const lower = (v) => String(v == null ? '' : v).trim().toLowerCase();

export async function handleUpdateAlumnoPassword({ callerToken, body, admin, allowedCoachUids }) {
  if (!callerToken) return json(401, { error: 'missing authorization' });
  const alumnoEmail = body && body.alumnoEmail != null ? String(body.alumnoEmail) : '';
  const newPassword = body && body.newPassword ? String(body.newPassword) : '';
  if (!alumnoEmail.trim() || !newPassword) return json(400, { error: 'alumnoEmail and newPassword required' });

  const { data: callerData, error: callerError } = await admin.auth.getUser(callerToken);
  const caller = callerData && callerData.user;
  if (callerError || !caller || !caller.id) return json(401, { error: 'invalid session' });

  // (1) El solicitante debe ser un entrenador autorizado por una fuente que el cliente no controla. Se decide ANTES de leer datos.
  const coaches = Array.isArray(allowedCoachUids) ? allowedCoachUids.map(lower) : [];
  const callerId = lower(caller.id);
  if (!coaches.length || !coaches.includes(callerId)) {
    return json(403, { error: 'not authorized' });
  }

  // Alumno: igualdad exacta (sin comodines) e insensible a mayusculas. Si hay mas de uno, falla cerrada.
  const email = lower(alumnoEmail);
  const { data: rows, error: alumnoError } = await admin
    .from('alumnos').select('*').ilike('email', escapeLike(email)).limit(2);
  if (alumnoError) return json(500, { error: alumnoError.message });
  const matches = (rows || []).filter((r) => lower(r.email) === email);
  if (matches.length > 1) return json(409, { error: 'hay mas de un alumno con ese email; no se modifica nada' });
  const alumno = matches[0];
  if (!alumno) return json(403, { error: 'not authorized for this student' });

  // (2) Propiedad del alumno (ademas de (1)).
  const owner = String(alumno.entrenador_id == null ? '' : alumno.entrenador_id);
  if (lower(owner) !== callerId && owner !== LEGACY_COACH_ID) {
    return json(403, { error: 'not authorized for this student' });
  }

  // (3) Cuentas de Auth. Se listan todas para buscar el vinculo y detectar conflictos de email.
  let listed;
  try { listed = await listAuthUsers(admin); } catch (e) { return json(500, { error: String((e && e.message) || e) }); }
  const users = listed.users;
  const byEmail = users.find((u) => lower(u.email) === email) || null;

  // Unico vinculo confiable: app_metadata.alumno_id (escrito solo por el servidor).
  const byLink = users.filter((u) => u.app_metadata && String(u.app_metadata.alumno_id) === String(alumno.id));
  if (byLink.length > 1) return json(409, { error: 'hay mas de una cuenta vinculada a este alumno; no se modifica nada' });
  const linked = byLink[0] || null;

  if (linked) {
    // (4) Cuentas protegidas: el solicitante y cualquier entrenador autorizado.
    const linkedId = lower(linked.id);
    if (linkedId === callerId || coaches.includes(linkedId)) return json(403, { error: 'cuenta protegida' });
    // (5) El email de la cuenta debe ser el de la ficha: no se cambia el email de login a partir de datos de la ficha.
    if (lower(linked.email) !== email || (byEmail && lower(byEmail.id) !== linkedId)) {
      return json(409, {
        error: 'el email de la cuenta vinculada no coincide con el de la ficha del alumno; ' +
          'corregirlo en Authentication > Users y reintentar. No se modifica nada',
      });
    }
    const { error } = await admin.auth.admin.updateUserById(String(linked.id), { password: newPassword });
    if (error) return json(400, { error: error.message });
    return json(200, { ok: true });
  }

  // Sin vinculo. Una cuenta con ese email NO se adopta ni se modifica: la coincidencia de email no es una vinculacion confiable.
  if (byEmail) {
    return json(409, {
      error: 'existe una cuenta de Auth con ese email que no esta vinculada a este alumno; ' +
        'verificar su titularidad y vincularla desde el servidor (app_metadata.alumno_id) antes de cambiar la contrasena',
    });
  }
  // Si el listado quedo truncado no se puede asegurar que no exista: falla cerrada.
  if (!listed.complete) return json(500, { error: 'no se pudo verificar que no exista una cuenta con ese email; no se modifica nada' });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: newPassword,
    email_confirm: true,
    user_metadata: { role: 'alumno' },
    app_metadata: { alumno_id: String(alumno.id) }, // vinculo confiable: solo el servidor escribe app_metadata
  });
  if (createError || !(created && created.user)) {
    // Sin reintento por email: un error al crear nunca deriva en modificar una cuenta existente.
    return json(400, { error: (createError && createError.message) || 'no se pudo crear la cuenta' });
  }
  return json(200, { ok: true, created: true });
}

async function listAuthUsers(admin) {
  const users = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    const batch = (data && data.users) || [];
    users.push(...batch);
    if (batch.length < PAGE_SIZE) return { users, complete: true };
  }
  return { users, complete: false };
}
