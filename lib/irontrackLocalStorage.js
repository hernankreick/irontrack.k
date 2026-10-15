/**
 * Limpieza de localStorage para IronTrack.
 * - `clearIronTrackStorageForNewLogin`: solo datos de sesión / snapshot anterior al ingresar con otras credenciales.
 * - `clearAllIronTrackPrefixedKeys`: logout o borrado total de datos de la app (todas las claves `it_*`).
 * La cola de series pendientes (`it_pending_sync*` y el formato por clave `it_pq:*`, `it_pqf:*`, `it_pqd:*`) NO se borra al iniciar ni al cerrar sesion: son datos del alumno que todavia no
 * llegaron al servidor (ver lib/pendingSyncQueue.js). Solo se borra con un borrado total explicito (includePending).
 */

/** Se eliminan al hacer login (nueva sesión); no incluir preferencias ni onboarding. */
import { dropUnattributedItems } from './pendingSyncQueue.js';
import { isPendingQueueKey } from './pendingQueueKeyed.js';

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

export function clearIronTrackStorageForNewLogin() {
  if (typeof localStorage === 'undefined') return;
  for (var i = 0; i < IRONTRACK_LOGIN_RESET_KEYS.length; i++) {
    try {
      localStorage.removeItem(IRONTRACK_LOGIN_RESET_KEYS[i]);
    } catch (e) {}
  }
  // La cola pendiente se conserva; solo se descartan los elementos sin dueño conocido (version anterior), que no se pueden atribuir al usuario nuevo.
  try { dropUnattributedItems(localStorage); } catch (e) {}
}

/**
 * Logout explícito o “borrar datos”: quita todas las claves `it_*` (incluye it_onboard_done, tema, idioma, etc.).
 * No borra claves de otros orígenes en el mismo host que no usen prefijo `it_`.
 */
export function clearAllIronTrackPrefixedKeys(opts) {
  if (typeof localStorage === 'undefined') return;
  var includePending = !!(opts && opts.includePending);
  var toRemove = [];
  var len = localStorage.length;
  var j;
  for (j = 0; j < len; j++) {
    var k = localStorage.key(j);
    if (k && k.indexOf('it_') === 0 && (includePending || !isPendingQueueKey(k))) toRemove.push(k);
  }
  for (j = 0; j < toRemove.length; j++) {
    try {
      localStorage.removeItem(toRemove[j]);
    } catch (e) {}
  }
}
