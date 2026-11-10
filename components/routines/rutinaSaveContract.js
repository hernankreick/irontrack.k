// Contrato de guardado de rutinas (R1 fase 1). Funciones puras, sin React ni backend.
//
// sb.updateRutina / sb.createRutina NO lanzan: devuelven un array de filas, [] si no hubo fila y null ante error
// (permisos/RLS, red). Un guardado solo cuenta como confirmado si el servidor devolvió al menos una fila.

/** Resultado de un UPDATE esperado sobre una fila existente. */
export function confirmUpdate(res) {
  if (res === null || res === undefined) return { ok: false, reason: 'error' };
  if (!Array.isArray(res)) return { ok: false, reason: 'invalid' };
  if (res.length === 0 || !res[0] || typeof res[0] !== 'object') return { ok: false, reason: 'zero_rows' };
  return { ok: true, row: res[0] };
}

/** Resultado de un INSERT: exige la fila creada con id. */
export function confirmCreate(res) {
  if (res === null || res === undefined) return { ok: false, reason: 'error' };
  if (!Array.isArray(res)) return { ok: false, reason: 'invalid' };
  var row = res[0];
  if (!row || typeof row !== 'object' || row.id == null || row.id === '') return { ok: false, reason: 'no_row' };
  return { ok: true, row: row };
}

/** Ejecuta updateRutina y lo clasifica. Nunca lanza. */
export async function updateConfirmed(sb, id, payload) {
  try {
    return confirmUpdate(await sb.updateRutina(id, payload));
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

/** Ejecuta createRutina y lo clasifica. Nunca lanza. */
export async function createConfirmed(sb, payload) {
  try {
    return confirmCreate(await sb.createRutina(payload));
  } catch (e) {
    return { ok: false, reason: 'exception', error: e };
  }
}

// Candado SÍNCRONO por rutina (clave = id local de la tarjeta). Se toma antes de cualquier await o setState,
// así que un doble/triple toque, o «Guardar» de la tarjeta + «Guardar cambios» de la barra, no pueden iniciar
// dos escrituras de la misma rutina (en una rutina nueva serían dos INSERT).
var held = new Set();
export var SAVE_ALL_KEY = '__save_all__';

/** Devuelve una función release, o null si alguna clave ya está tomada (no toma ninguna en ese caso). */
export function acquireSaveLocks(keys) {
  var list = (keys || []).map(String);
  for (var i = 0; i < list.length; i++) {
    if (held.has(list[i])) return null;
  }
  list.forEach(function (k) {
    held.add(k);
  });
  var released = false;
  return function release() {
    if (released) return;
    released = true;
    list.forEach(function (k) {
      held.delete(k);
    });
  };
}

/** Solo para pruebas. */
export function _resetSaveLocksForTests() {
  held.clear();
}

/** Mismo conjunto de ids (sin importar orden). */
export function sameIdSet(a, b) {
  var x = (a || []).map(String);
  var y = (b || []).map(String);
  return (
    x.length === y.length &&
    x.every(function (v) {
      return y.indexOf(v) !== -1;
    })
  );
}

/** Se puede apagar el aviso de «sin guardar» solo si no hubo ediciones desde que empezó el guardado. */
export function canClearUnsaved(startRevision, currentRevision) {
  return startRevision === currentRevision;
}

// Estado de una tarjeta que debe sobrevivir al remount que provoca el cambio de id al crear la rutina (RutinaView usa key={r.id}).
// Se escribe ANTES de cambiar el id y la tarjeta nueva lo lee al montarse (peek) y lo borra después (consume).
var carried = new Map();
export function carryCardState(newId, state) {
  carried.set(String(newId), state);
}
export function peekCardState(id) {
  return carried.get(String(id)) || null;
}
export function consumeCardState(id) {
  carried.delete(String(id));
}
