/**
 * Limpieza de localStorage para IronTrack.
 * - `clearIronTrackStorageForNewLogin`: solo datos de sesión / snapshot anterior al ingresar con otras credenciales.
 * - `clearAllIronTrackPrefixedKeys`: logout o borrado total de datos de la app (todas las claves `it_*`).
 * - `clearRoutineLocalKeysForAlumno`: claves locales de un alumno/rutina al reiniciar su historial.
 * - `collectExportableLocalData`: lo que "Exportar datos" puede volcar.
 *
 * P0 (Etapa 1A): las series pendientes de sincronizar NUNCA se borran desde aqui. Toda clave reconocida por
 * `isPendingSetsKey` (prefijo `it_pending_sync`: cola nueva por clave, metadatos, cuarentena, diario de migracion,
 * leases y el array viejo) sobrevive a login, logout, cambio de alumno y reinicios de rutina, y queda fuera del export
 * (contiene series de otros alumnos del mismo dispositivo).
 *
 * El array VIEJO `it_pending_sync` no se borra: se traslada (sin modificarlo) a la cuarentena del modulo
 * `pendingSets`. Motivo: si siguiera como array, el vaciado antiguo de App.jsx (que envia bajo el alumno de la sesion
 * ACTUAL) podria sincronizar series de un alumno como si fueran de otro (P0-3). En cuarentena se conservan, pero
 * nunca se envian solas.
 *
 * Puntos de logout que usan `clearAllIronTrackPrefixedKeys` (donde habra que integrar el cierre seguro de Auth junto a
 * S0.6; en esta etapa NO se agregan llamadas a signOut): App.jsx (confirmacion 'logout'/'logoutSettings',
 * handleCoachLogout, onLogout del alumno, onCoachLogout) y SettingsPage.jsx (doLogout, que ya llama a signOut).
 */
import { createPendingSets, isPendingSetsKey, PENDING_LEGACY_KEY } from './pendingSets.js';

/** Se eliminan al hacer login (nueva sesión); no incluir preferencias ni onboarding ni claves de series pendientes. */
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

var LEGACY_MIGRATE_PASSES = 3;

/**
 * Traslada el array viejo `it_pending_sync` a la cuarentena (verbatim, un registro por clave). Nunca lo sincroniza.
 * Si la migracion no puede completarse (cuota, sin fuente aleatoria), copia el contenido tal cual a una clave no
 * flusheable (`it_pending_sync_raw:<ts>`) y solo entonces retira el array. Si ni eso es posible, lo deja intacto.
 * `deps` (pruebas): { storage, migrate }.
 * @returns {{status:'none'|'migrated'|'busy'|'backed_up'|'kept'}}
 */
export function preserveLegacyPendingQueue(deps) {
  var d = deps || {};
  var storage = d.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!storage) return { status: 'none' };
  var raw;
  try {
    raw = storage.getItem(PENDING_LEGACY_KEY);
  } catch (e) {
    return { status: 'kept' };
  }
  if (raw == null || raw === '') return { status: 'none' };
  var migrate = typeof d.migrate === 'function' ? d.migrate : function () { return createPendingSets({ storage: storage }).migrateSync(); };
  try {
    for (var pass = 0; pass < LEGACY_MIGRATE_PASSES; pass++) {
      var r = migrate();
      if (r && r.busy) return { status: 'busy' }; // otra pestaña esta migrando: terminara ella
      if (storage.getItem(PENDING_LEGACY_KEY) == null) return { status: 'migrated' };
    }
  } catch (e) {
    // cae al respaldo literal
  }
  try {
    var again = storage.getItem(PENDING_LEGACY_KEY);
    if (again == null) return { status: 'migrated' };
    storage.setItem(PENDING_LEGACY_KEY + '_raw:' + Date.now(), again);
    storage.removeItem(PENDING_LEGACY_KEY);
    return { status: 'backed_up' };
  } catch (e2) {
    return { status: 'kept' };
  }
}

export function clearIronTrackStorageForNewLogin() {
  if (typeof localStorage === 'undefined') return;
  preserveLegacyPendingQueue();
  for (var i = 0; i < IRONTRACK_LOGIN_RESET_KEYS.length; i++) {
    var key = IRONTRACK_LOGIN_RESET_KEYS[i];
    if (isPendingSetsKey(key)) continue; // defensa: la lista nunca debe contener claves de series pendientes
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
}

/**
 * Logout explícito o “borrar datos”: quita todas las claves `it_*` (incluye it_onboard_done, tema, idioma, etc.)
 * EXCEPTO las de series pendientes (`isPendingSetsKey`).
 * No borra claves de otros orígenes en el mismo host que no usen prefijo `it_`.
 */
export function clearAllIronTrackPrefixedKeys() {
  if (typeof localStorage === 'undefined') return;
  preserveLegacyPendingQueue();
  var toRemove = [];
  var len = localStorage.length;
  var j;
  for (j = 0; j < len; j++) {
    var k = localStorage.key(j);
    if (k && k.indexOf('it_') === 0 && !isPendingSetsKey(k)) toRemove.push(k);
  }
  for (j = 0; j < toRemove.length; j++) {
    try {
      localStorage.removeItem(toRemove[j]);
    } catch (e) {}
  }
}

/**
 * Reinicio del historial de un alumno/rutina: quita las claves locales `it_*` que mencionan al alumno o a la rutina
 * (y las filtra de `it_cd`), salvo las de series pendientes.
 */
export function clearRoutineLocalKeysForAlumno(alumnoId, rutinaId) {
  try {
    localStorage.removeItem('it_last_week_advance_date');
    var rid = rutinaId != null && rutinaId !== '' ? String(rutinaId) : '';
    var cd = JSON.parse(localStorage.getItem('it_cd') || '[]');
    if (Array.isArray(cd)) {
      localStorage.setItem('it_cd', JSON.stringify(cd.filter(function (k) {
        var text = String(k);
        return !((rid && text.indexOf(rid) >= 0) || text.indexOf(String(alumnoId)) >= 0);
      })));
    }
    for (var i = localStorage.length - 1; i >= 0; i--) {
      var key = localStorage.key(i);
      if (!key || key.indexOf('it_') !== 0) continue;
      if (isPendingSetsKey(key)) continue;
      if (key.indexOf(String(alumnoId)) >= 0 || (rid && key.indexOf(rid) >= 0)) {
        localStorage.removeItem(key);
      }
    }
  } catch (e) {}
}

/** Datos locales `it_*` para "Exportar datos": excluye las series pendientes (pueden ser de otros alumnos). */
export function collectExportableLocalData(storage) {
  var s = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  var data = {};
  if (!s) return data;
  var keys = [];
  for (var i = 0; i < s.length; i++) {
    var k = s.key(i);
    if (k && k.indexOf('it_') === 0 && !isPendingSetsKey(k)) keys.push(k);
  }
  keys.forEach(function (k) { data[k] = s.getItem(k); });
  return data;
}
