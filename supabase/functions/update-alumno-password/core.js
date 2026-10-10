// Logica pura (sin Deno ni red) de update-alumno-password, con el cliente admin inyectado para poder probarla.
//
// Reglas (RLS P0):
//  - El alumno se identifica por alumnoId (no por email) y debe pertenecer al entrenador autenticado: alumnos.entrenador_id = caller.id.
//    El identificador legacy de entrenador unico YA NO otorga propiedad (el backfill lo reemplaza por el UUID real).
//  - alumnos.auth_uid se asigna SOLO aqui y SOLO cuando esta misma llamada crea la cuenta de Auth. Nunca por coincidencia de email:
//    si ya existe una cuenta de Auth con ese email que no esta vinculada al alumno, se rechaza (409) sin tocarla.
//  - Si el alumno ya esta vinculado, se actualiza la cuenta por auth_uid (no se busca por email).

const json = (status, body) => ({ status, body });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function handleUpdateAlumnoPassword({ callerToken, body, admin }) {
  if (!callerToken) return json(401, { error: 'missing authorization' });
  const alumnoId = body && body.alumnoId != null ? String(body.alumnoId) : '';
  const newPassword = body && body.newPassword ? String(body.newPassword) : '';
  if (!alumnoId || !newPassword) return json(400, { error: 'alumnoId and newPassword required' });
  if (!UUID_RE.test(alumnoId)) return json(400, { error: 'alumnoId invalido' });

  const { data: callerData, error: callerError } = await admin.auth.getUser(callerToken);
  const caller = callerData && callerData.user;
  if (callerError || !caller) return json(401, { error: 'invalid session' });

  const { data: alumno, error: alumnoError } = await admin
    .from('alumnos').select('id, email, entrenador_id, auth_uid').eq('id', alumnoId).maybeSingle();
  if (alumnoError) return json(500, { error: alumnoError.message });
  if (!alumno || String(alumno.entrenador_id) !== String(caller.id)) {
    return json(403, { error: 'not authorized for this student' }); // misma respuesta si no existe o no es suyo
  }
  const email = String(alumno.email || '').trim().toLowerCase();
  if (!email) return json(400, { error: 'alumno sin email' });

  // Ya vinculado: actualizar por auth_uid (y alinear el email de la cuenta con el del alumno).
  if (alumno.auth_uid) {
    // Nunca se modifica la cuenta del propio solicitante ni la del entrenador principal (un vinculo erroneo no debe permitirlo).
    if (String(alumno.auth_uid) === String(caller.id)) return json(403, { error: 'cuenta protegida' });
    const { data: principal, error: principalError } = await admin
      .from('coach_principal').select('uid').eq('uid', String(alumno.auth_uid)).maybeSingle();
    if (principalError) return json(500, { error: 'no se pudo verificar la cuenta' }); // falla cerrado
    if (principal) return json(403, { error: 'cuenta protegida' });
    const { error } = await admin.auth.admin.updateUserById(String(alumno.auth_uid), { password: newPassword, email, email_confirm: true });
    if (error) return json(400, { error: error.message });
    return json(200, { ok: true });
  }

  // Sin vinculo: si el email ya existe en Auth NO se adopta esa cuenta (seria vincular por coincidencia de email).
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    return json(409, { error: 'ya existe una cuenta de Auth con ese email que no esta vinculada a este alumno; vincularla manualmente tras verificar su titularidad' });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password: newPassword, email_confirm: true, user_metadata: { role: 'alumno' },
  });
  const newUser = created && created.user;
  if (createError || !newUser) return json(400, { error: (createError && createError.message) || 'no se pudo crear la cuenta' });

  // Vinculo atomico: solo si sigue sin vincular. Si falla, se revierte la cuenta recien creada.
  const { data: linked, error: linkError } = await admin
    .from('alumnos').update({ auth_uid: newUser.id }).eq('id', alumno.id).is('auth_uid', null).select('id');
  if (linkError || !linked || linked.length !== 1) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(newUser.id);
    if (deleteError) {
      // Reversion fallida: no se afirma que se revirtio; se informa el id para limpiarlo manualmente.
      return json(500, { error: 'no se pudo vincular la cuenta y tampoco revertir su creacion; eliminar manualmente la cuenta de Auth ' + newUser.id });
    }
    return json(500, { error: 'no se pudo vincular la cuenta al alumno; se revirtio la creacion' });
  }
  return json(200, { ok: true, linked: true });
}

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = (data && data.users) || [];
    const match = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (match) return match;
    if (users.length < 200) break;
  }
  return null;
}
