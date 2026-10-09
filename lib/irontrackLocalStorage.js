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
 *
 * La cola actual (`it_pending_sync`, array) NO se mueve ni se reescribe aqui: lo que impide que las series de un alumno salgan bajo
 * otro es la barrera por serie de lib/legacyPendingFlush.js (solo se envia una serie con `alumno_id` propio comprobado y igual al de
 * la sesion; las demas se conservan sin enviarse). Asi no hay escrituras en logout/login que puedan fallar por cuota. Al integrar la
 * Etapa 1A, `preserveLegacyPendingQueue` de 1A pasa a trasladar el array a su cola/cuarentena (ver docs/S0.6-fase1-integracion-1A.md).
 */
export var PENDING_SYNC_PREFIX = 'it_pending_sync';

export function isPendingSyncKey(key) {
  return typeof key === 'string' && key.indexOf(PENDING_SYNC_PREFIX) === 0;
}

export function clearIronTrackStorageForNewLogin() {
  if (typeof localStorage === 'undefined') return;
  for (var i = 0; i < IRONTRACK_LOGIN_RESET_KEYS.length; i++) {
    try {
      localStorage.removeItem(IRONTRACK_LOGIN_RESET_KEYS[i]);
    } catch (e) {}
  }
}

/**
 * Logout explícito o “borrar datos”: quita todas las claves `it_*` (incluye it_onboard_done, tema, idioma, etc.) EXCEPTO las de
 * series pendientes (`it_pending_sync*`).
 * No borra claves de otros orígenes en el mismo host que no usen prefijo `it_`.
 */
export function clearAllIronTrackPrefixedKeys() {
  if (typeof localStorage === 'undefined') return;
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
}
