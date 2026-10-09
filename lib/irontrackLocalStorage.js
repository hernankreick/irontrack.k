/**
 * Limpieza de localStorage para IronTrack.
 * - `clearIronTrackStorageForNewLogin`: solo datos de sesión / snapshot anterior al ingresar con otras credenciales.
 * - `clearAllIronTrackPrefixedKeys`: logout o borrado total de datos de la app (todas las claves `it_*`).
 */

/** Se eliminan al hacer login (nueva sesión); no incluir preferencias ni onboarding. */
export const IRONTRACK_LOGIN_RESET_KEYS = [
  'it_session',
  'it_rt',
  'it_pg',
  'it_u',
  'it_show_welcome',
  'it_week',
  'it_cd',
  'it_cex',
  'it_customEx',
  'it_pagos_estado',
  'it_coach_negocio',
  'it_last_week_advance_date',
  'it_biometric_user',
];

/**
 * Series pendientes de sincronizar (S0.6 Fase 1; la Etapa 1A generaliza esto con lib/pendingSets.js::isPendingSetsKey).
 * Toda clave con este prefijo sobrevive a login, logout y reinicios: una serie registrada offline NO se pierde al cerrar sesion.
 */
export var PENDING_SYNC_PREFIX = 'it_pending_sync';
export var PENDING_SYNC_LEGACY_KEY = 'it_pending_sync';
export var PENDING_SYNC_RAW_PREFIX = 'it_pending_sync_raw:';

export function isPendingSyncKey(key) {
  return typeof key === 'string' && key.indexOf(PENDING_SYNC_PREFIX) === 0;
}

/**
 * La cola actual (`it_pending_sync`, array) NO guarda a que alumno pertenece cada serie y el vaciado de App.jsx la envia bajo la
 * sesion ACTUAL. Si sobreviviera como array a un logout/login, las series de un alumno se grabarian bajo otro. Por eso se traslada
 * VERBATIM a `it_pending_sync_raw:<ts>:<alumnoId|desconocido>` (mismo formato que usa la Etapa 1A para su copia literal): se
 * conserva, queda fuera del vaciado y de las limpiezas, y nada la envia sola.
 * Si no se puede copiar (cuota) el array queda intacto: nunca se borra una serie.
 * @returns {{status:'none'|'moved'|'kept'}}
 */
export function preservePendingQueue(storage) {
  var s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!s) return { status: 'none' };
  var raw;
  try {
    raw = s.getItem(PENDING_SYNC_LEGACY_KEY);
  } catch (e) {
    return { status: 'kept' };
  }
  if (raw == null || raw === '') return { status: 'none' };
  var owner = 'desconocido';
  try {
    var sess = JSON.parse(s.getItem('it_session') || 'null');
    if (sess && sess.alumnoId != null && String(sess.alumnoId) !== '') owner = String(sess.alumnoId);
  } catch (e) {}
  var rawKey = PENDING_SYNC_RAW_PREFIX + Date.now() + ':' + owner;
  try {
    s.setItem(rawKey, raw);
    if (s.getItem(rawKey) !== raw) {
      try { s.removeItem(rawKey); } catch (e1) {}
      return { status: 'kept' };
    }
    // Si otra pestana modifico el array mientras se copiaba, NO se retira (ya esta respaldado; se reintenta luego).
    if (s.getItem(PENDING_SYNC_LEGACY_KEY) !== raw) return { status: 'kept' };
    s.removeItem(PENDING_SYNC_LEGACY_KEY);
    return { status: 'moved' };
  } catch (e2) {
    return { status: 'kept' };
  }
}

export function clearIronTrackStorageForNewLogin() {
  if (typeof localStorage === 'undefined') return;
  var preserved = preservePendingQueue();
  for (var i = 0; i < IRONTRACK_LOGIN_RESET_KEYS.length; i++) {
    try {
      localStorage.removeItem(IRONTRACK_LOGIN_RESET_KEYS[i]);
    } catch (e) {}
  }
  if (preserved.status === 'kept') preservePendingQueue(); // la limpieza pudo liberar cuota
}

/**
 * Logout explícito o “borrar datos”: quita todas las claves `it_*` (incluye it_onboard_done, tema, idioma, etc.) EXCEPTO las de
 * series pendientes (`it_pending_sync*`, ver `preservePendingQueue`).
 * No borra claves de otros orígenes en el mismo host que no usen prefijo `it_`.
 */
export function clearAllIronTrackPrefixedKeys() {
  if (typeof localStorage === 'undefined') return;
  var preserved = preservePendingQueue();
  var toRemove = [];
  var len = localStorage.length;
  var j;
  for (j = 0; j < len; j++) {
    var k = localStorage.key(j);
    if (k && k.indexOf('it_') === 0 && !isPendingSyncKey(k)) toRemove.push(k);
  }
  for (j = 0; j < toRemove.length; j++) {
    try {
      localStorage.removeItem(toRemove[j]);
    } catch (e) {}
  }
  if (preserved.status === 'kept') preservePendingQueue(); // la limpieza pudo liberar cuota
}
