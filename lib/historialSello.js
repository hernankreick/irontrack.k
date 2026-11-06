// D76-09 — Sello de historial (lado cliente).
//
// El servidor guarda por alumno un "sello" (uuid aleatorio) que cambia cada vez que el entrenador borra el historial
// (RPC it_limpiar_historial_alumno). Toda serie o sesion se SELLA al registrarla con el sello que el dispositivo conocia en ese momento;
// el trigger del servidor rechaza (IT409) lo que trae un sello anterior despues de un borrado. Nunca se re-sella un pendiente con el
// sello actual: eso anularia la proteccion.
//
//  - Sin la migracion (RPC inexistente) no hay "capacidad": no se sella nada y los payloads quedan identicos a los de antes.
//  - El sello se guarda por alumno en it_hsello:<alumnoId> (no es secreto respecto del propio alumno; nunca viaja a otro alumno).
//  - Solo se refresca leyendo el servidor (obtenerSello); el cache nunca se "inventa".
// Sin dependencias de React ni de Supabase: rpc(name, args) se inyecta y devuelve { data, error, missing } (lib/rpcClient.js callRpc).

export var SELLO_PREFIX = "it_hsello:";
export var SELLO_MAX_EDAD_MS = 60000;
export var CODIGO_RECHAZO_HISTORIAL = "IT409";
export var RPC_HISTORIAL = {
  SELLO: "it_historial_sello",
  LIMPIAR: "it_limpiar_historial_alumno",
  REINGRESAR: "it_historial_reingresar",
  VINCULO_SOLICITAR: "it_vinculo_solicitar",
  VINCULO_APROBAR: "it_vinculo_aprobar",
};

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function esSelloValido(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

function idOk(alumnoId) {
  return alumnoId != null && alumnoId !== "";
}

/** Estado guardado del alumno o null. { capacidad, sello, epoch, reset_at, modo, vinculado, sinPermiso, at } */
export function leerSelloCache(storage, alumnoId) {
  if (!storage || !idOk(alumnoId)) return null;
  try {
    var raw = storage.getItem(SELLO_PREFIX + String(alumnoId));
    if (!raw) return null;
    var v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch (e) {
    return null;
  }
}

function guardar(storage, alumnoId, estado) {
  try { storage.setItem(SELLO_PREFIX + String(alumnoId), JSON.stringify(estado)); } catch (e) {}
}

/** Sello con el que se registra AHORA una serie/sesion del alumno: uuid o null (sin capacidad, sin borrado previo o desconocido). */
export function selloParaRegistrar(storage, alumnoId) {
  var c = leerSelloCache(storage, alumnoId);
  return c && c.capacidad === true && esSelloValido(c.sello) ? c.sello.toLowerCase() : null;
}

/** true si el cache falta o tiene mas de maxMs. */
export function selloVencido(storage, alumnoId, now, maxMs) {
  var c = leerSelloCache(storage, alumnoId);
  var limite = maxMs != null ? maxMs : SELLO_MAX_EDAD_MS;
  var t = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  return !c || !Number.isFinite(Number(c.at)) || t - Number(c.at) > limite;
}

function primero(data) {
  if (Array.isArray(data)) return data.length ? data[0] : null;
  return data && typeof data === "object" ? data : null;
}

/** ¿El error de una RPC es "sin permiso" (42501)? */
export function esSinPermiso(error) {
  return !!error && String(error.code || "") === "42501";
}

/**
 * Lee el sello vigente del servidor y actualiza el cache. Nunca lanza.
 * Devuelve { ok:true, estado } | { ok:false, capacidad:false } (sin migracion) | { ok:false, sinPermiso:true } | { ok:false, error }.
 * Para el entrenador, estado.solicitud_vinculo trae la solicitud pendiente (no se guarda en el cache).
 */
export async function obtenerSello(params) {
  var p = params || {};
  if (!idOk(p.alumnoId) || typeof p.rpc !== "function") return { ok: false, error: { message: "sin_alumno" } };
  var now = typeof p.now === "function" ? p.now() : Date.now();
  var r;
  try {
    r = await p.rpc(RPC_HISTORIAL.SELLO, { p_alumno_id: String(p.alumnoId) });
  } catch (e) {
    return { ok: false, error: e || { message: "rpc_error" } };
  }
  r = r || {};
  var cachear = p.storage && p.cachear !== false;
  if (r.missing) {
    if (cachear) guardar(p.storage, p.alumnoId, { capacidad: false, at: now });
    return { ok: false, capacidad: false };
  }
  if (r.error) {
    if (esSinPermiso(r.error)) {
      if (cachear) guardar(p.storage, p.alumnoId, { capacidad: true, sinPermiso: true, sello: null, at: now });
      return { ok: false, sinPermiso: true };
    }
    return { ok: false, error: r.error };
  }
  var d = primero(r.data);
  if (!d) return { ok: false, error: { message: "sin_datos" } };
  var estado = {
    capacidad: true,
    sello: esSelloValido(d.sello) ? String(d.sello).toLowerCase() : null,
    epoch: Number.isFinite(Number(d.epoch)) ? Number(d.epoch) : 0,
    reset_at: d.reset_at || null,
    modo: d.modo || "off",
    vinculado: d.vinculado !== false,
    at: now,
  };
  if (cachear) guardar(p.storage, p.alumnoId, estado);
  return { ok: true, estado: Object.assign({}, estado, { solicitud_vinculo: d.solicitud_vinculo || null }) };
}

/** Agrega historial_token al payload SOLO si el sello es un uuid (sin sello el payload queda identico al anterior). */
export function conSello(payload, sello) {
  if (!payload || !esSelloValido(sello)) return payload;
  return Object.assign({}, payload, { historial_token: sello.toLowerCase() });
}

/** ¿La respuesta { ok, status, data } de PostgREST es el rechazo del trigger (IT409 it_historial_reiniciado)? */
export function esRechazoHistorial(res) {
  if (!res || res.ok) return false;
  var d = res.data;
  if (!d || typeof d !== "object") return false;
  return String(d.code || "") === CODIGO_RECHAZO_HISTORIAL || d.message === "it_historial_reiniciado";
}

/** Marca de rechazo que devuelven los envios (en lugar de filas o null). */
export function marcaRechazo(res) {
  var d = (res && res.data) || {};
  var m = /epoch_vigente=(\d+)/.exec(String(d.hint || ""));
  return { historialRechazo: true, motivo: d.details || null, epochVigente: m ? Number(m[1]) : null };
}

export function esMarcaRechazo(v) {
  return !!v && typeof v === "object" && !Array.isArray(v) && v.historialRechazo === true;
}
