// Nucleo de la herramienta de vinculacion (IT-002a): escribe SOLO app_metadata.alumno_id en UNA cuenta de Auth.
// Logica pura con el cliente admin inyectado, para probarla con mocks. La ejecuta el propietario con link-alumno.mjs.
//
// Invariantes:
//  - dry-run por defecto; escribir exige apply=true y confirm exacto (alumnoId:primeros 8 del authId)
//  - una cuenta por llamada; nunca masivo
//  - no modifica email, confirmacion, contrasena ni user_metadata; conserva el resto de app_metadata
//  - rechaza: ficha inexistente/duplicada, cuenta inexistente, cuenta de entrenador, email distinto, email duplicado,
//    cuenta ya vinculada a otro alumno, otra cuenta ya vinculada a este alumno, listado incompleto
//  - antes de escribir vuelve a leer y compara con la instantanea (cambios concurrentes => aborta)
//  - despues de escribir relee y verifica; si hay error de red/escritura informa el estado real (no asume)
//  - la salida no incluye emails, nombres ni secretos; los ids se muestran abreviados

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 200;
const MAX_PAGES = 50;
const lower = (v) => String(v == null ? '' : v).trim().toLowerCase();
const short = (id) => String(id).slice(0, 8) + '…';
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);
const clone = (o) => JSON.parse(JSON.stringify(o == null ? null : o));
const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

// Codigo de salida del CLI: 0 ok; 1 aborto por validacion (no se escribio); 2 estado incierto (revisar la cuenta a mano).
const UNKNOWN_STATE = new Set(['VERIFICACION_FALLIDA', 'VERIFICACION_IMPOSIBLE', 'ESCRITURA_FALLIDA', 'ERROR_INESPERADO']);
export const exitCodeFor = (res) => (res && res.ok ? 0 : (res && UNKNOWN_STATE.has(res.code) ? 2 : 1));

export const expectedConfirm =(alumnoId, authId) => String(alumnoId) + ':' + String(authId).slice(0, 8);

// Lo que NO debe cambiar en la cuenta al vincular/deshacer.
const protectedView = (u) => ({
  email: u.email == null ? null : u.email,
  email_confirmed_at: u.email_confirmed_at == null ? null : u.email_confirmed_at,
  confirmed_at: u.confirmed_at == null ? null : u.confirmed_at,
  phone: u.phone == null ? null : u.phone,
  phone_confirmed_at: u.phone_confirmed_at == null ? null : u.phone_confirmed_at,
  new_email: u.new_email == null ? null : u.new_email,
  banned_until: u.banned_until == null ? null : u.banned_until,
  role: u.role == null ? null : u.role,
  aud: u.aud == null ? null : u.aud,
  identities: (u.identities || []).map((i) => [i.id == null ? null : i.id, i.provider == null ? null : i.provider]),
  user_metadata: clone(u.user_metadata || {}),
});
const metaOf = (u) => clone(u.app_metadata || {});

// Mensajes del SDK: se enmascaran emails y UUID y se acotan, por si una respuesta de error los incluye.
const safeMsg = (m) => String(m == null || m === '' ? 'error' : m)
  .replace(/[^\s@'"<>]+@[^\s@'"<>]+/g, '<email>')
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
  .slice(0, 160);
const fail = (code, message, log, extra = {}) => ({ ok: false, code, message, log, ...extra });

async function listAll(admin) {
  const users = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error('listado de cuentas: ' + safeMsg(error.message));
    const batch = (data && data.users) || [];
    users.push(...batch);
    if (batch.length < PAGE_SIZE) return users;
  }
  throw new Error('listado de cuentas incompleto (demasiadas paginas)');
}

// Lee y valida el estado. Devuelve { ok:false,... } o { ok:true, ficha, cuenta, users }.
async function inspect({ admin, alumnoId, authId, coaches, mode, allowProviders, log }) {
  const { data: fichas, error: e1 } = await admin.from('alumnos').select('id,email').eq('id', alumnoId).limit(2);
  if (e1) return fail('FICHA_ERROR', 'lectura de la ficha: ' + safeMsg(e1.message), log);
  if (!fichas || fichas.length === 0) return fail('FICHA_INEXISTENTE', 'no existe una ficha con ese id', log);
  if (fichas.length > 1) return fail('FICHA_DUPLICADA', 'hay mas de una ficha con ese id', log);
  const ficha = fichas[0];
  const fichaEmail = lower(ficha.email);
  if (!fichaEmail) return fail('FICHA_SIN_EMAIL', 'la ficha no tiene email', log);

  const { data: mismas, error: e2 } = await admin.from('alumnos').select('id,email').ilike('email', '%' + escapeLike(fichaEmail) + '%').limit(50);
  if (e2) return fail('FICHA_ERROR', 'lectura de fichas por email: ' + safeMsg(e2.message), log);
  if ((mismas || []).length >= 50) return fail('FICHA_EMAIL_AMBIGUO', 'demasiadas fichas contienen ese texto de email: no se puede descartar un duplicado', log);
  if ((mismas || []).filter((r) => lower(r.email) === fichaEmail).length > 1) return fail('FICHA_EMAIL_DUPLICADO', 'otra ficha comparte el email de este alumno', log);

  let users;
  try { users = await listAll(admin); } catch (e) { return fail('LISTADO_ERROR', safeMsg(e && e.message), log); }

  const ausentes = coaches.filter((c) => !users.some((u) => lower(u.id) === c));
  if (ausentes.length) return fail('ENTRENADOR_NO_ENCONTRADO', ausentes.length + ' UID(s) de COACH_UIDS no existen en Auth: revisar el valor (typo)', log);
  const cuenta = users.find((u) => lower(u.id) === lower(authId));
  if (!cuenta) return fail('CUENTA_INEXISTENTE', 'no existe la cuenta indicada', log);
  if (coaches.includes(lower(cuenta.id))) return fail('CUENTA_ENTRENADOR', 'la cuenta es de un entrenador autorizado', log);
  if (mode === 'link' && cuenta.banned_until && new Date(cuenta.banned_until).getTime() > Date.now()) return fail('CUENTA_BANEADA', 'la cuenta esta suspendida', log);
  const provs = (cuenta.identities || []).map((i) => i.provider).concat((cuenta.app_metadata || {}).providers || []).filter(Boolean);
  if (mode === 'link' && provs.some((p) => p !== 'email') && !allowProviders) return fail('PROVEEDOR_INESPERADO', 'la cuenta tiene un proveedor distinto de email', log);
  if (mode === 'link' && lower(cuenta.email) !== fichaEmail) return fail('EMAIL_DISTINTO', 'el email de la cuenta no coincide con el de la ficha', log);
  if (mode === 'link' && users.filter((u) => lower(u.email) === fichaEmail).length !== 1) return fail('EMAIL_DUPLICADO_AUTH', 'hay mas de una cuenta con ese email', log);

  const previo = (cuenta.app_metadata || {}).alumno_id;
  const otras = users.filter((u) => lower(u.id) !== lower(cuenta.id) && u.app_metadata && String(u.app_metadata.alumno_id) === String(ficha.id));
  if (mode === 'link' && otras.length) return fail('OTRA_CUENTA_VINCULADA', 'otra cuenta ya esta vinculada a este alumno', log);
  if (mode === 'link' && previo != null && String(previo) !== String(ficha.id)) return fail('CUENTA_DE_OTRO_ALUMNO', 'la cuenta ya esta vinculada a otro alumno', log);
  if (mode === 'rollback' && (previo == null || String(previo) !== String(ficha.id))) return fail('NO_VINCULADA', 'la cuenta no esta vinculada a este alumno: nada que deshacer', log);
  return { ok: true, ficha, cuenta, users };
}

/**
 * mode: 'link' | 'rollback'. apply=false => dry-run. confirm: ver expectedConfirm().
 * Devuelve { ok, code, message, log[], changed }.
 */
export async function runLink(opts = {}) {
  try { return await runLinkUnsafe(opts); }
  catch (e) {
    return { ok: false, code: 'ERROR_INESPERADO', message: 'error inesperado (' + String((e && e.name) || 'Error') + '): no se garantiza el estado; verificar la cuenta a mano en Authentication > Users', log: [], changed: null };
  }
}

async function runLinkUnsafe({ admin, alumnoId, authId, coachUids, mode = 'link', apply = false, confirm, allowProviders = false } = {}) {
  const log = [];
  const say = (s) => log.push(s);
  if (!admin) return fail('SIN_CLIENTE', 'falta el cliente admin', log);
  if (mode !== 'link' && mode !== 'rollback') return fail('MODO_INVALIDO', 'modo invalido', log);
  if (typeof alumnoId !== 'string' || !alumnoId.trim()) return fail('ALUMNO_ID_INVALIDO', 'falta el id de la ficha', log);
  alumnoId = alumnoId.trim();
  if (typeof authId !== 'string' || !UUID_RE.test(authId.trim())) return fail('AUTH_ID_INVALIDO', 'el id de la cuenta debe ser un UUID', log);
  authId = authId.trim();
  const coaches = (Array.isArray(coachUids) ? coachUids : []).map(lower).filter(Boolean);
  if (coaches.some((c) => !UUID_RE.test(c))) return fail('COACH_UID_INVALIDO', 'algun UID de COACH_UIDS no es un UUID valido: corregirlo (no se descarta en silencio)', log);
  if (!coaches.length) return fail('SIN_ENTRENADORES', 'se necesita al menos un UID de entrenador valido (COACH_UIDS) para no vincular su cuenta', log);

  const first = await inspect({ admin, alumnoId, authId, coaches, mode, allowProviders, log });
  if (!first.ok) return first;
  const { cuenta } = first;
  const snapshot = { prot: protectedView(cuenta), meta: metaOf(cuenta), updated_at: cuenta.updated_at == null ? null : cuenta.updated_at };
  say('precondiciones OK para la cuenta ' + short(authId) + ' y la ficha ' + short(alumnoId));
  say('entrenadores protegidos: ' + coaches.length + ' (todos existen en Auth)');
  say('app_metadata actual: claves=[' + Object.keys(snapshot.meta).sort().join(',') + ']');
  const provs = [...new Set((cuenta.identities || []).map((i) => i.provider).concat((cuenta.app_metadata || {}).providers || []).filter(Boolean))];
  say('senales de titularidad (verificar con el alumno por otro canal antes de aplicar): email confirmado=' + (cuenta.email_confirmed_at ? 'si' : 'NO') +
    ', creada=' + (cuenta.created_at || 'desconocido') + ', ultimo login=' + (cuenta.last_sign_in_at || 'nunca') +
    ', proveedores=[' + provs.join(',') + '], suspendida=no');

  if (mode === 'link' && snapshot.meta.alumno_id != null) {
    say('la cuenta ya esta vinculada a este alumno: no hay nada que escribir');
    return { ok: true, code: 'YA_VINCULADA', message: 'ya vinculada', log, changed: false };
  }
  if (!apply) {
    say('DRY-RUN: no se escribio nada. Para aplicar: --apply --confirm ' + expectedConfirm(alumnoId, authId));
    return { ok: true, code: 'DRY_RUN', message: 'dry-run', log, changed: false };
  }
  if (confirm !== expectedConfirm(alumnoId, authId)) {
    return fail('SIN_CONFIRMACION', 'la confirmacion no coincide: no se escribio nada', log);
  }

  // Revalidar justo antes de escribir (cambios concurrentes).
  const second = await inspect({ admin, alumnoId, authId, coaches, mode, allowProviders, log });
  if (!second.ok) return fail(second.code, 'el estado cambio antes de escribir: ' + second.message, log);
  const c2 = second.cuenta;
  if (!same(protectedView(c2), snapshot.prot) || !same(metaOf(c2), snapshot.meta) || (c2.updated_at == null ? null : c2.updated_at) !== snapshot.updated_at) {
    return fail('CAMBIO_CONCURRENTE', 'la cuenta cambio entre la lectura y la escritura: no se escribio nada', log);
  }

  const nextMeta = { ...snapshot.meta };
  if (mode === 'link') nextMeta.alumno_id = String(first.ficha.id);
  else delete nextMeta.alumno_id;
  // Para quitar la clave se envia null (el servicio fusiona app_metadata; null elimina la clave).
  const payload = mode === 'link' ? { ...nextMeta } : { ...nextMeta, alumno_id: null };

  let writeError = null;
  try {
    const { error } = await admin.auth.admin.updateUserById(cuenta.id, { app_metadata: payload });
    if (error) writeError = safeMsg(error.message);
  } catch (e) { writeError = safeMsg(e && e.message); }

  // Verificacion posterior: siempre se relee el estado real.
  let after;
  try {
    const { data, error } = await admin.auth.admin.getUserById(cuenta.id);
    if (error || !data || !data.user) throw new Error('sin datos');
    after = data.user;
  } catch (e) {
    return fail('VERIFICACION_IMPOSIBLE', (writeError ? 'la escritura fallo (' + writeError + ') y ' : '') + 'no se pudo releer la cuenta: estado desconocido; verificar a mano en Authentication > Users', log, { changed: null });
  }
  const afterMeta = metaOf(after);
  const linkedNow = afterMeta.alumno_id != null && String(afterMeta.alumno_id) === String(first.ficha.id);
  const expectedMeta = { ...snapshot.meta };
  if (mode === 'link') expectedMeta.alumno_id = String(first.ficha.id); else delete expectedMeta.alumno_id;
  const protOk = same(protectedView(after), snapshot.prot);
  const metaOk = same(afterMeta, expectedMeta);

  if (writeError) {
    const state = mode === 'link' ? (linkedNow ? 'quedo vinculada' : 'no quedo vinculada') : (linkedNow ? 'sigue vinculada' : 'ya no esta vinculada');
    return fail('ESCRITURA_FALLIDA', 'error al escribir (' + writeError + '); estado real: la cuenta ' + state, log, { changed: mode === 'link' ? linkedNow : !linkedNow });
  }
  if (!protOk) return fail('VERIFICACION_FALLIDA', 'cambiaron campos protegidos (email/confirmacion/telefono/user_metadata): revisar y, si hace falta, deshacer', log, { changed: true });
  if (!metaOk) return fail('VERIFICACION_FALLIDA', 'app_metadata posterior no es el esperado: revisar y, si hace falta, deshacer', log, { changed: true });
  say(mode === 'link' ? 'OK: cuenta vinculada; email, confirmacion y user_metadata sin cambios; resto de app_metadata conservado' : 'OK: vinculo eliminado; resto de app_metadata conservado');
  return { ok: true, code: mode === 'link' ? 'VINCULADA' : 'DESHECHA', message: 'ok', log, changed: true };
}
