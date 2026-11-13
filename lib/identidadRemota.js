// SessionIdentity PR-6 — persistencia REMOTA de la identidad (preparada, DESACTIVADA por defecto).
//
// Contrato (migracion propuesta en docs/identidad-remota-migracion-propuesta.md, NO aplicada):
//   progreso.sesion_uid uuid null | progreso.bloque text null ('warmup'|'main') | progreso.pos smallint null
//   sesiones.sesion_uid uuid null (indice unico parcial)         | sesiones.identidad_v smallint null (1)
//
// ACTIVACION (explicita; nunca por detectar el esquema):
//   Solo si la variable de build VITE_IRONTRACK_IDENTIDAD_REMOTA vale EXACTAMENTE TOKEN_ACTIVACION. Un humano la pone DESPUES de verificar
//   la migracion (ver docs/identidad-remota.md). Sin ella (o con cualquier otro valor) los payloads son byte a byte los de siempre.
// DEGRADACION SEGURA: si estando activa el servidor rechaza las columnas nuevas (migracion no aplicada o restriccion distinta), el envio se
//   repite UNA vez sin ellas y el resto de la sesion de la app ya no las envia: ninguna serie ni sesion queda bloqueada por esto.
// LECTURA: pasiva y validada (sin columnas => sin efecto). No depende de la activacion.
// Modulo puro (el estado de rechazo vive en memoria, solo de esta carga de la app). Nunca lanza.
import { esUuidV4 } from "./sessionIdentity.js";
import { BLOQUES, extraerIdentidadSerie, sesionUidCoherente } from "./serieIdentidad.js";

export var MIGRACION_ID = "identidad-remota-v1";
export var ENV_VAR = "VITE_IRONTRACK_IDENTIDAD_REMOTA";
export var TOKEN_ACTIVACION = "migracion-aplicada:" + MIGRACION_ID;
export var IDENTIDAD_V = 1;
export var POS_MAX = 32767; // smallint
export var CAMPOS_REMOTOS_SERIE = Object.freeze(["sesion_uid", "bloque", "pos"]);
export var CAMPOS_REMOTOS_SESION = Object.freeze(["sesion_uid", "identidad_v"]);

var esquemaRechazado = false;
export function marcarEsquemaRechazado() { esquemaRechazado = true; }
export function hayEsquemaRechazado() { return esquemaRechazado; }
export function __resetEstadoIdentidadRemotaParaPruebas() { esquemaRechazado = false; }

/** true solo con el token exacto en `env` y sin rechazo previo del servidor. `env`: objeto con las variables (p.ej. import.meta.env). */
export function identidadRemotaActiva(env) {
  try { return !esquemaRechazado && !!env && env[ENV_VAR] === TOKEN_ACTIVACION; } catch (e) { return false; }
}

/** Lee la variable de build (Vite la sustituye en el bundle); en Node/pruebas no hay import.meta.env => desactivada. */
export function identidadRemotaDesdeEntorno() {
  try { return identidadRemotaActiva({ [ENV_VAR]: import.meta.env.VITE_IRONTRACK_IDENTIDAD_REMOTA }); } catch (e) { return false; }
}

function posRemotaValida(p) { return typeof p === "number" && Number.isInteger(p) && p >= 0 && p <= POS_MAX; }

/** Campos de serie validos para el servidor: sesion_uid UUID v4; bloque y pos solo juntos. */
export function identidadSerieRemota(identidad) {
  var src = extraerIdentidadSerie(identidad), out = {};
  if (esUuidV4(src.sesion_uid)) out.sesion_uid = src.sesion_uid;
  if ((src.bloque === BLOQUES.WARMUP || src.bloque === BLOQUES.MAIN) && posRemotaValida(src.pos)) { out.bloque = src.bloque; out.pos = src.pos; }
  return out;
}

/** Payload remoto de una serie. Desactivado => `payload` tal cual (misma referencia). Activado => copia + campos validos. No muta. */
export function proyectarPayloadSerie(payload, identidad, activa) {
  if (activa !== true || !payload || typeof payload !== "object") return payload;
  return Object.assign({}, payload, identidadSerieRemota(identidad));
}

/** Campos remotos de la sesion: solo con identidad v2 valida y coherente con alumno/rutina/dia. Sesion v1/legada => {}. */
export function identidadSesionRemota(session, alumnoId) {
  var uid = sesionUidCoherente(session, alumnoId);
  return uid && esUuidV4(uid) ? { sesion_uid: uid, identidad_v: IDENTIDAD_V } : {};
}

/** Payload remoto de una sesion finalizada (ver proyectarPayloadSerie). La deduplicacion existente no cambia. */
export function proyectarPayloadSesion(payload, session, alumnoId, activa) {
  if (activa !== true || !payload || typeof payload !== "object") return payload;
  return Object.assign({}, payload, identidadSesionRemota(session, alumnoId));
}

export function tieneCampos(payload, campos) {
  return !!payload && typeof payload === "object" && campos.some(function (c) { return Object.prototype.hasOwnProperty.call(payload, c); });
}
export function sinCampos(payload, campos) {
  var out = {};
  Object.keys(payload || {}).forEach(function (k) { if (campos.indexOf(k) < 0) out[k] = payload[k]; });
  return out;
}

/**
 * ¿La respuesta { ok, status, data } dice que el servidor no acepta las columnas/restricciones de identidad?
 *  - PGRST204 / 42703 (columna inexistente) mencionando una columna nueva, o
 *  - 23514 (check) de una restriccion de identidad.
 * Un 23505 NO cuenta (progreso_pkey = idempotencia; sesiones_sesion_uid_uidx = esa sesion ya esta guardada): nunca se reenvia por eso.
 */
export function esErrorEsquemaIdentidad(res, campos) {
  try {
    if (!res || res.ok || !res.data || typeof res.data !== "object") return false;
    var code = String(res.data.code || "");
    var txt = String((res.data.message || "") + " " + (res.data.details || "")).toLowerCase();
    if (code === "23505") return false;
    if (code === "PGRST204" || code === "42703") return campos.some(function (c) { return txt.indexOf(c) !== -1; });
    if (code === "23514") return /identidad|sesion_uid|bloque|pos_chk|progreso_pos|progreso_bloque/.test(txt);
    return false;
  } catch (e) { return false; }
}

/**
 * post(payload) => Promise<{ok,status,data}>. Envia; si el servidor rechaza las columnas de identidad, marca el esquema como rechazado y
 * reenvia UNA vez sin ellas (un error de columna implica que no se inserto nada, asi que no puede duplicar). Otros errores se devuelven tal cual.
 */
export async function enviarConFallbackIdentidad(post, payload, campos) {
  var res = await post(payload);
  if (res && res.ok) return res;
  if (!tieneCampos(payload, campos) || !esErrorEsquemaIdentidad(res, campos)) return res;
  marcarEsquemaRechazado();
  return post(sinCampos(payload, campos));
}

// ───────── Lectura (pasiva, validada) ─────────

/** Identidad explicita de una fila de `progreso`: solo campos validos. Fila antigua o invalida => {} (no verificable, nunca se infiere). */
export function leerIdentidadRemotaSerie(row) {
  if (!row || typeof row !== "object") return {};
  var out = {};
  if (typeof row.sesion_uid === "string" && esUuidV4(row.sesion_uid.toLowerCase())) out.sesion_uid = row.sesion_uid.toLowerCase();
  if ((row.bloque === BLOQUES.WARMUP || row.bloque === BLOQUES.MAIN) && posRemotaValida(row.pos)) { out.bloque = row.bloque; out.pos = row.pos; }
  return out;
}

/** Identidad explicita de una fila de `sesiones`: { sesion_uid, identidad_v } o null (sin uid valido o version desconocida). */
export function leerIdentidadRemotaSesion(row) {
  if (!row || typeof row !== "object") return null;
  var u = typeof row.sesion_uid === "string" ? row.sesion_uid.toLowerCase() : "";
  if (!esUuidV4(u) || row.identidad_v !== IDENTIDAD_V) return null;
  return { sesion_uid: u, identidad_v: IDENTIDAD_V };
}
