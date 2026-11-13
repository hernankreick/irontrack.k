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
import { normalizeFecha } from "./normalizeFecha.js";

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
    var uid = sesionUidCoherente(p.session, p.alumnoId);
    if (uid) out.sesion_uid = uid;
    if (bloquePosValidos(p.ubicacion)) { out.bloque = p.ubicacion.bloque; out.pos = p.ubicacion.pos; }
  } catch (e) { /* sin identidad */ }
  return out;
}

/**
 * sesion_uid de `session` si su identidad es v2 valida y COHERENTE con el entrenamiento abierto (mismo alumno, rutina y dia); si no, null.
 * Una sesion v1/legada (sin identity) devuelve null: nunca se inventa.
 */
export function sesionUidCoherente(session, alumnoId) {
  try {
    var s = session;
    var v = s && s.identity ? validarIdentidad(s.identity) : null;
    if (v && v.ok && alumnoId != null && alumnoId !== ""
      && String(v.value.alumnoId) === String(alumnoId)
      && String(v.value.rutinaId) === String(s.rId)
      && v.value.diaIdx === Number(s.dIdx)) {
      return v.value.sessionId;
    }
  } catch (e) { /* sin identidad */ }
  return null;
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

// ───────── Conservacion de la identidad al hidratar desde Supabase (PR-5) ─────────
// La fila del servidor (progreso) no trae sesion_uid/bloque/pos (no hay columnas todavia). Cuando una serie local ya sincronizada vuelve
// hidratada, su identidad local solo puede recuperarse con un vinculo ESTABLE: el opId (= progreso.id), verificado ademas con los valores de
// la serie. Sin opId coincidente (o con valores que no coinciden, o ids repetidos) NO se asigna identidad: queda "no verificable".
// Nunca se usan coincidencias aproximadas (ejercicio/kg/reps/fecha) para inventar un vinculo.

function idNorm(v) { return typeof v === "string" && v !== "" ? v.toLowerCase() : null; }
function tieneIdentidad(o) { return Object.keys(extraerIdentidadSerie(o)).length > 0; }
function igualNum(a, b) { return a != null && b != null && a !== "" && b !== "" && Number(a) === Number(b); }

/** Misma serie por valores: kg, reps, semana, nota, fecha normalizada y, si ambos lo traen, ciclo. `a`/`b`: forma de serie local (date/week/note). */
function mismosValores(a, b) {
  if (!igualNum(a.kg, b.kg) || !igualNum(a.reps, b.reps)) return false;
  var wa = a.week == null ? null : a.week, wb = b.week == null ? null : b.week;
  if (!((wa === null && wb === null) || (wa !== null && wb !== null && Number(wa) === Number(wb)))) return false;
  if ((a.note || "") !== (b.note || "")) return false;
  if (normalizeFecha(a.date || "") !== normalizeFecha(b.date || "")) return false;
  var ca = a.ciclo != null && a.ciclo !== "", cb = b.ciclo != null && b.ciclo !== "";
  if (ca && cb && Number(a.ciclo) !== Number(b.ciclo)) return false;
  return true;
}

/**
 * Devuelve la serie hidratada `hidratada` con la identidad local de `local` SOLO si: ambas tienen el mismo id (opId) , los valores
 * coinciden, `local` tiene identidad y la hidratada no tiene ninguna (si la trajera el servidor, gana la del servidor: nunca se pisa).
 * Si no se cumple, devuelve `hidratada` tal cual (misma referencia). No muta.
 */
export function conservarIdentidadHidratada(local, hidratada) {
  try {
    if (!local || !hidratada || typeof local !== "object" || typeof hidratada !== "object") return hidratada;
    var il = idNorm(local.id);
    if (il == null || il !== idNorm(hidratada.id)) return hidratada;
    // PR-6: una serie ya marcada como no verificable no recupera identidad (ni la local ni la del servidor) por una hidratacion posterior.
    if (local.identidad_no_verificable === true) return marcarNoVerificable(hidratada);
    var idn = extraerIdentidadSerie(local);
    if (!Object.keys(idn).length) return hidratada;
    var remota = extraerIdentidadSerie(hidratada);
    if (Object.keys(remota).length) {
      // PR-6: el servidor trae identidad explicita. Gana si es consistente con la local (la completa solo en campos ausentes);
      // si se contradicen en cualquier campo de la MISMA fila (mismo id), ninguna es confiable: no verificable.
      for (var k in remota) {
        if (Object.prototype.hasOwnProperty.call(idn, k) && String(idn[k]).toLowerCase() !== String(remota[k]).toLowerCase()) return marcarNoVerificable(hidratada);
      }
      return Object.assign({}, hidratada, idn, remota);
    }
    if (!mismosValores(local, hidratada)) return hidratada;
    return Object.assign({}, hidratada, idn);
  } catch (e) { return hidratada; }
}

/** Copia sin identidad y con la marca local `identidad_no_verificable` (conflicto entre identidades). No se envia a ninguna parte. */
function marcarNoVerificable(set) {
  return Object.assign(sinIdentidadLocal(set), { identidad_no_verificable: true });
}

/**
 * Rehidratacion sin it_pg: asigna identidad a las series hidratadas cuyo id coincide con el opId de un pendiente local todavia presente
 * (la fila llego al servidor pero la confirmacion se perdio, o el pendiente aun no se retiro). Mismo alumno, mismo ejercicio y mismos
 * valores; un opId repetido (en pendientes o en filas) es ambiguo y no asigna nada. Devuelve un progress nuevo; no muta.
 */
export function adjuntarIdentidadPendientes(hydratedProgress, pendientes, alumnoId) {
  try {
    if (!hydratedProgress || typeof hydratedProgress !== "object" || alumnoId == null || alumnoId === "") return hydratedProgress;
    var porOp = {}, repetidos = {};
    (Array.isArray(pendientes) ? pendientes : []).forEach(function (it) {
      var k = it && typeof it === "object" ? idNorm(it.opId) : null;
      if (k == null) return;
      if (porOp[k]) repetidos[k] = true; else porOp[k] = it;
    });
    if (!Object.keys(porOp).length) return hydratedProgress;
    var cuentaFilas = {};
    Object.keys(hydratedProgress).forEach(function (exId) {
      var e = hydratedProgress[exId];
      (e && Array.isArray(e.sets) ? e.sets : []).forEach(function (s) { var k = s ? idNorm(s.id) : null; if (k) cuentaFilas[k] = (cuentaFilas[k] || 0) + 1; });
    });
    var out = {};
    Object.keys(hydratedProgress).forEach(function (exId) {
      var e = hydratedProgress[exId];
      if (!e || !Array.isArray(e.sets)) { out[exId] = e; return; }
      out[exId] = Object.assign({}, e, { sets: e.sets.map(function (s) {
        var k = s ? idNorm(s.id) : null;
        if (!k || repetidos[k] || cuentaFilas[k] !== 1 || !porOp[k]) return s;
        var it = porOp[k];
        var idn = extraerIdentidadSerie(it);
        if (!Object.keys(idn).length) return s;
        if (String(it.alumno_id) !== String(alumnoId) || String(it.exId) !== String(exId)) return s;
        var pseudo = Object.assign({ id: it.opId, kg: it.kg, reps: it.reps, week: it.semana, note: it.note, date: it.date, ciclo: it.ciclo }, idn);
        return conservarIdentidadHidratada(pseudo, s);
      }) });
    });
    return out;
  } catch (e) { return hydratedProgress; }
}

// ───────── Adaptador del contrato futuro (solo lectura; no envia nada) ─────────
// Contrato previsto (migracion NO aplicada): progreso.sesion_uid / progreso.bloque / progreso.pos y sesiones.sesion_uid.
// lib/prescripcionComparacion.js vincula series por `sesion_id` (id de la fila de sesiones) + bloque + pos. Este adaptador deriva
// `sesion_id` SOLO cuando la serie y la fila de sesion declaran el MISMO sesion_uid; sin eso la serie queda sin sesion_id (sin vinculo =>
// la comparacion se bloquea, nunca se infiere). No se usan fecha, ejercicio ni valores para vincular.
export function vincularSerieASesion(serie, sesion) {
  var s = serie && typeof serie === "object" ? serie : {};
  var out = Object.assign({}, s);
  delete out.sesion_id;
  var uidS = typeof s.sesion_uid === "string" && s.sesion_uid !== "" ? s.sesion_uid.toLowerCase() : null;
  var uidSes = sesion && typeof sesion.sesion_uid === "string" && sesion.sesion_uid !== "" ? sesion.sesion_uid.toLowerCase() : null;
  if (uidS && uidS === uidSes && sesion.id != null && sesion.id !== "") out.sesion_id = sesion.id;
  return out;
}

/**
 * Vincula en lote series con filas de `sesiones` por sesion_uid (contrato futuro). Un sesion_uid que aparece en MAS de una fila de sesiones
 * (duplicado) o que no es un UUID v4 es ambiguo: esas series quedan sin sesion_id. Devuelve { series, ambiguos }.
 */
export function vincularSeriesConSesiones(series, sesiones) {
  var porUid = {}, conteo = {};
  (Array.isArray(sesiones) ? sesiones : []).forEach(function (ses) {
    var u = ses && typeof ses.sesion_uid === "string" ? ses.sesion_uid.toLowerCase() : "";
    if (!u) return;
    conteo[u] = (conteo[u] || 0) + 1;
    porUid[u] = ses;
  });
  var ambiguos = Object.keys(conteo).filter(function (u) { return conteo[u] > 1; });
  var out = (Array.isArray(series) ? series : []).map(function (se) {
    var u = se && typeof se.sesion_uid === "string" ? se.sesion_uid.toLowerCase() : "";
    var base = vincularSerieASesion(se, conteo[u] === 1 ? porUid[u] : null);
    return base;
  });
  return { series: out, ambiguos: ambiguos };
}
