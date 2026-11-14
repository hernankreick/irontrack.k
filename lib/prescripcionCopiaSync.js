// Captura y persistencia de la COPIA INMUTABLE de la prescripcion al iniciar un entrenamiento (docs/prescripcion-copias-v1). DESACTIVADA por defecto.
//
// ACTIVACION (explicita, igual que la identidad remota): solo si la variable de build VITE_IRONTRACK_COPIAS_PRESCRIPCION vale EXACTAMENTE TOKEN_COPIAS.
// Un humano la define DESPUES de aplicar y verificar la migracion RLS, la de identidad y la tabla de copias (docs/rls-v1/README.md, orden de despliegue).
// Sin la variable no se captura, no se encola y no se envia nada: el entrenamiento funciona exactamente igual que antes.
//
// Garantias:
//  - FUENTE: rutina.datos.days (copia del servidor), nunca rutina.days (el estado local reemplaza el kg base por el ultimo registrado).
//  - La copia se captura UNA vez, al INICIO real del entrenamiento (no al reanudar tras recargar): una reanudacion con una rutina editada produciria
//    otra huella para la misma clave y la sesion quedaria "ambigua". La fila nunca se modifica despues de encolada (se congela).
//  - OFFLINE: se guarda primero en la cola local (write-ahead, clave determinista por clave+huella) y se envia cuando hay red.
//  - IDEMPOTENTE: reenviar la misma copia da 23505 sobre prescripcion_copias_clave_hash_uq = "ya guardada" (no es error, no duplica).
//  - NUNCA bloquea el entrenamiento: todo falla en silencio hacia "esa sesion quedara sin_copia" (estado explicito al comparar).
//  - Tabla ausente o sin permiso (404/PGRST205/42P01/42501/401/403): se deja de intentar en esta carga de la app; la cola local se conserva.
import { buildPrescripcionSnapshot } from "./prescripcionSnapshot.js";

export var COPIAS_MIGRACION_ID = "prescripcion-copias-v1";
export var COPIAS_ENV_VAR = "VITE_IRONTRACK_COPIAS_PRESCRIPCION";
export var TOKEN_COPIAS = "migracion-aplicada:" + COPIAS_MIGRACION_ID;
export var COLA_COPIAS_PREFIJO = "it_pcopia:";
export var CONSTRAINT_UNICA = "prescripcion_copias_clave_hash_uq";

var rechazada = false;
export function copiasRechazadas() { return rechazada; }
export function __resetCopiasParaPruebas() { rechazada = false; }

export function copiasPrescripcionActivas(env) {
  try { return !rechazada && !!env && env[COPIAS_ENV_VAR] === TOKEN_COPIAS; } catch (e) { return false; }
}
/** Lee la variable de build (Vite la sustituye en el bundle); en Node/pruebas no hay import.meta.env => desactivada. */
export function copiasPrescripcionDesdeEntorno() {
  try { return copiasPrescripcionActivas({ [COPIAS_ENV_VAR]: import.meta.env.VITE_IRONTRACK_COPIAS_PRESCRIPCION }); } catch (e) { return false; }
}
/** La bandera de BUILD (sin el estado de rechazo): para decidir si mostrar la interfaz. */
export function copiasBanderaDeBuild() {
  try { return import.meta.env.VITE_IRONTRACK_COPIAS_PRESCRIPCION === TOKEN_COPIAS; } catch (e) { return false; }
}

function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); } return o; }

/**
 * Fila de `prescripcion_copias` para el entrenamiento que acaba de iniciar. Solo con identidad de sesion v2 coherente con alumno y rutina.
 * @returns {{ok:true,row}|{ok:false,motivo}}  motivos: sin_identidad | alumno_no_coincide | rutina_no_coincide | (los de buildPrescripcionSnapshot)
 */
export function construirFilaCopia(params) {
  var p = params || {};
  var ses = p.session && typeof p.session === "object" ? p.session : null;
  var id = ses && ses.identity && typeof ses.identity === "object" ? ses.identity : null;
  if (!id || typeof id.sessionId !== "string") return { ok: false, motivo: "sin_identidad" };
  if (String(id.alumnoId) !== String(p.alumnoId)) return { ok: false, motivo: "alumno_no_coincide" };
  var rutina = p.rutina && typeof p.rutina === "object" ? p.rutina : null;
  if (!rutina || String(rutina.id) !== String(id.rutinaId)) return { ok: false, motivo: "rutina_no_coincide" };
  var semana = typeof id.semanaIdx === "number" ? id.semanaIdx + 1 : null; // identidad: semana 0-based; sesiones.semana y la copia: 1..4
  var r = buildPrescripcionSnapshot({
    rutina: { id: rutina.id, nombre: rutina.nombre != null ? rutina.nombre : rutina.name, alumno_id: rutina.alumno_id, datos: rutina.datos },
    alumnoId: p.alumnoId, diaIdx: id.diaIdx, semana: semana, fecha: id.fecha, semanaMostrada: semana, momento: "inicio", capturadaEn: p.capturadaEn,
  });
  if (!r.ok) return { ok: false, motivo: r.motivo };
  return { ok: true, row: deepFreeze({
    alumno_id: r.clave.alumno_id, rutina_id: r.clave.rutina_id, ciclo: r.clave.ciclo, semana: r.clave.semana, dia_idx: r.clave.dia_idx,
    fecha_dia: r.clave.fecha_dia, prescripcion_hash: r.hash, snapshot: r.snapshot,
  }) };
}

function claveCola(row) {
  return COLA_COPIAS_PREFIJO + [row.alumno_id, row.rutina_id, row.ciclo, row.semana, row.dia_idx, row.fecha_dia, String(row.prescripcion_hash).slice(7, 23)].join(":");
}

/** Write-ahead: guarda la copia en la cola local. Idempotente (misma clave+huella => misma entrada, sin reescribir). Nunca lanza. */
export function encolarCopia(storage, row, ahora) {
  try {
    var k = claveCola(row);
    if (storage.getItem(k) != null) return { ok: true, ya_estaba: true, key: k };
    storage.setItem(k, JSON.stringify({ v: 1, row: row, creada_en: ahora == null ? null : ahora, intentos: 0 }));
    return { ok: true, ya_estaba: false, key: k };
  } catch (e) { return { ok: false, motivo: "almacenamiento" }; }
}

/** Entradas pendientes de un alumno: [{ key, item }] (ilegibles o de otro alumno se ignoran; no se borran). */
export function copiasPendientes(storage, alumnoId) {
  var out = [];
  try {
    var keys = [];
    for (var i = 0; i < storage.length; i++) { var k = storage.key(i); if (k && k.indexOf(COLA_COPIAS_PREFIJO + String(alumnoId) + ":") === 0) keys.push(k); }
    keys.sort().forEach(function (key) {
      try { var item = JSON.parse(storage.getItem(key)); if (item && item.v === 1 && item.row && String(item.row.alumno_id) === String(alumnoId)) out.push({ key: key, item: item }); } catch (e) { /* corrupta: se ignora */ }
    });
  } catch (e) { /* sin almacenamiento */ }
  return out;
}

function esTablaAusenteOSinPermiso(res) {
  var code = res && res.data && typeof res.data === "object" ? String(res.data.code || "") : "";
  return !!res && (res.status === 404 || res.status === 401 || res.status === 403 || code === "PGRST205" || code === "42P01" || code === "42501");
}
function esDuplicadoDeLaCopia(res) {
  var d = res && res.data && typeof res.data === "object" ? res.data : null;
  return !!res && res.status === 409 && !!d && String(d.code) === "23505" && String(d.message || "").indexOf(CONSTRAINT_UNICA) !== -1;
}

/**
 * Envia las copias pendientes del alumno. post(row) => Promise<{ok,status,data}> (puede lanzar ante falla de red).
 * @returns {{enviadas, ya_guardadas, pendientes, descartadas, rechazada}}  Nunca lanza.
 */
export async function enviarCopiasPendientes(params) {
  var p = params || {};
  var res = { enviadas: 0, ya_guardadas: 0, pendientes: 0, descartadas: 0, rechazada: rechazada };
  if (rechazada || typeof p.post !== "function" || !p.storage) return res;
  var lista = copiasPendientes(p.storage, p.alumnoId);
  for (var i = 0; i < lista.length; i++) {
    var e = lista[i], r = null;
    try { r = await p.post(e.item.row); } catch (err) { res.pendientes++; continue; }           // sin red: queda en cola
    if (r && r.ok) { p.storage.removeItem(e.key); res.enviadas++; continue; }
    if (esDuplicadoDeLaCopia(r)) { p.storage.removeItem(e.key); res.ya_guardadas++; continue; } // reintento: ya estaba
    if (esTablaAusenteOSinPermiso(r)) { rechazada = true; res.rechazada = true; res.pendientes += lista.length - i; break; } // contrato no cumplido: no insistir
    if (r && r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) { p.storage.removeItem(e.key); res.descartadas++; continue; } // la base la rechaza (CHECK): reintentar no sirve
    res.pendientes++;                                                                          // 5xx / 408 / 429 / sin respuesta
  }
  return res;
}

/**
 * Atajo para el inicio del entrenamiento: construye la copia y la encola. Solo si `activa`, solo en un inicio REAL (no recuperado).
 * @returns {{ok:boolean, motivo?:string, key?:string}}  Nunca lanza.
 */
export function capturarCopiaAlIniciar(params) {
  try {
    var p = params || {};
    if (p.activa !== true) return { ok: false, motivo: "desactivada" };
    if (p.recuperada === true) return { ok: false, motivo: "reanudacion" };
    var b = construirFilaCopia(p);
    if (!b.ok) return b;
    return encolarCopia(p.storage, b.row, p.ahora);
  } catch (e) { return { ok: false, motivo: "error" }; }
}
