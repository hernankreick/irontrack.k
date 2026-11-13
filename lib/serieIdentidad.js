// SessionIdentity PR-4 — identidad LOCAL de una serie: a que entrenamiento (sesion_uid), bloque y posicion pertenece.
//
// Campos (solo locales: viven en la serie de it_pg y en el pendiente it_pq:<opId>; NUNCA se envian a Supabase):
//   sesion_uid  UUID v4 de session.identity.sessionId (solo sesiones v2 validas; una sesion v1/legada no tiene y no se inventa).
//   bloque      "warmup" | "main"  bloque del dia al que pertenece el ejercicio.
//   pos         entero >= 0        posicion del ejercicio DENTRO de su bloque (0 = primero). Distingue dos apariciones del mismo ejercicio.
// Se congelan al registrar la serie (valores primitivos copiados) y no se recalculan en reintentos, sincronizacion ni recuperacion.
// Series anteriores a este PR no traen estos campos: no se deducen ni se convierten.
// Modulo puro: sin React, sin almacenamiento, sin Supabase; nunca lanza.
import { validarIdentidad } from "./sessionIdentity.js";

export var BLOQUES = Object.freeze({ WARMUP: "warmup", MAIN: "main" });
/** Campos de identidad local: la lista usada para propagarlos/preservarlos y para verificar que no salgan al servidor. */
export var CAMPOS_IDENTIDAD_SERIE = Object.freeze(["sesion_uid", "bloque", "pos"]);

function lista(v) { return Array.isArray(v) ? v : []; }
function enteroNoNeg(v) { return typeof v === "number" && Number.isInteger(v) && v >= 0; }

/**
 * Ubica el ejercicio activo en el dia. `activeExIdx` es el indice en la lista combinada [...warmup, ...ejercicios] (la que muestra
 * WorkoutScreen). Devuelve { bloque, pos } o null si el indice no corresponde a ningun ejercicio.
 */
export function ubicarEjercicioEnDia(activeDay, activeExIdx) {
  try {
    if (!enteroNoNeg(activeExIdx) || !activeDay) return null;
    var w = lista(activeDay.warmup).length;
    var m = lista(activeDay.exercises).length;
    if (activeExIdx < w) return { bloque: BLOQUES.WARMUP, pos: activeExIdx };
    if (activeExIdx < w + m) return { bloque: BLOQUES.MAIN, pos: activeExIdx - w };
    return null;
  } catch (e) { return null; }
}

function bloquePosValidos(u) {
  return !!u && (u.bloque === BLOQUES.WARMUP || u.bloque === BLOQUES.MAIN) && enteroNoNeg(u.pos);
}

/**
 * Identidad local de la serie que se registra ahora. Devuelve un objeto con SOLO los campos confiables (puede ser vacio):
 *  - sesion_uid: si session.identity es una identidad v2 valida y COHERENTE con el entrenamiento abierto (mismo alumno, rutina y dia). Si no, no se pone.
 *  - bloque + pos: solo si `ubicacion` trae ambos validos.
 */
export function construirIdentidadSerie(params) {
  var out = {};
  try {
    var p = params || {};
    var s = p.session;
    var v = s && s.identity ? validarIdentidad(s.identity) : null;
    if (v && v.ok && p.alumnoId != null && p.alumnoId !== ""
      && String(v.value.alumnoId) === String(p.alumnoId)
      && String(v.value.rutinaId) === String(s.rId)
      && v.value.diaIdx === Number(s.dIdx)) {
      out.sesion_uid = v.value.sessionId;
    }
    if (bloquePosValidos(p.ubicacion)) { out.bloque = p.ubicacion.bloque; out.pos = p.ubicacion.pos; }
  } catch (e) { /* sin identidad */ }
  return out;
}

/** Copia solo los campos de identidad validos de `src` (nunca inventa). */
export function extraerIdentidadSerie(src) {
  var out = {};
  if (!src || typeof src !== "object") return out;
  if (typeof src.sesion_uid === "string" && src.sesion_uid !== "") out.sesion_uid = src.sesion_uid;
  if (bloquePosValidos(src)) { out.bloque = src.bloque; out.pos = src.pos; }
  return out;
}

/** Copia de `obj` sin los campos de identidad local (proyeccion defensiva para cualquier escritura remota). */
export function sinIdentidadLocal(obj) {
  var out = {};
  if (!obj || typeof obj !== "object") return out;
  Object.keys(obj).forEach(function (k) { if (CAMPOS_IDENTIDAD_SERIE.indexOf(k) < 0) out[k] = obj[k]; });
  return out;
}
