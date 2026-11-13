// D76-05 — Fecha estable de un entrenamiento activo (cruce de medianoche y recarga de Safari).
//
// Problema: la fecha del entrenamiento se recalculaba con la hora actual en cada render y en cada serie
// (`new Date().toLocaleDateString("es-AR")`). Un entrenamiento iniciado a las 23:55 y continuado a las 00:10:
//   - dejaba de ver como "de hoy" las series de antes de medianoche (el progreso del dia bajaba y desaparecia FINALIZAR),
//   - registraba series del mismo entrenamiento con dos fechas,
//   - finalizaba con la fecha nueva, y un reintento despues de medianoche no encontraba la sesion ya insertada antes
//     (busqueda de duplicados por fecha) y la volvia a insertar.
// Solucion: la fecha se fija UNA vez al iniciar (`session.fecha`, fecha LOCAL del dispositivo del inicio) y todo el
// entrenamiento la usa (series, progreso del dia, finalizacion, clave de avance de semana).
//
// Recarga de Safari: `session` vive solo en memoria. Al iniciar un entrenamiento del alumno se escribe un ancla minima
// en el almacenamiento (ACTIVE_WORKOUT_KEY). Si se vuelve a iniciar EXACTAMENTE el mismo entrenamiento (mismo alumno,
// rutina, dia, ciclo y semana) dentro de ACTIVE_WORKOUT_MAX_MS, se continua con la fecha y el inicio del ancla.
//
// Politica conservadora: "si falta informacion confiable para recuperar una sesion, no asignarla automaticamente a otra
// fecha". Ante cualquier duda (sin ancla, otro alumno, otro dia/rutina, otro ciclo, otra semana, ancla vencida, corrupta
// o con inicio en el futuro) se inicia una sesion NUEVA con la fecha del momento del inicio. Las series ya registradas
// nunca se re-fechan: este modulo solo decide la fecha de las series y la sesion que se registren desde ahora.
//
// El ancla no guarda datos personales: solo ids (alumno, rutina), numeros (dia, ciclo, semana, inicio) y la fecha.
// SessionIdentity PR-2: ademas, cada entrenamiento NUEVO del alumno recibe una identidad (lib/sessionIdentity.js, `session.identity`)
// que se crea UNA vez al iniciar y se guarda en un ancla v2 (v1 + sessionId). Se lee v1 y v2. Una ancla v1 valida se recupera como
// entrenamiento LEGADO (sin identity, sin sessionId inventado) y NO se reescribe como v2. Una ancla v2 recupera la identidad original
// exacta. No se envia sessionId a Supabase. Un ancla VIGENTE de otro alumno nunca se sobrescribe.
// ANCLAS POR ALUMNO: cada alumno guarda su ancla en `it_active_workout:<alumnoId>` (ACTIVE_WORKOUT_KEY + ":" + id), asi varios
// alumnos del mismo dispositivo no se sobrescriben ni se borran entre si. La clave global `it_active_workout` es LEGADA: las versiones
// anteriores de la app solo leen/escriben/borran esa clave y nunca tocan las individuales. `migrarAnclaGlobal` copia (byte a byte) un ancla
// global v1/v2 VALIDA y VIGENTE a la clave de su alumno y solo borra la global tras releer y verificar la copia. Nunca sobrescribe una
// individual valida, nunca inventa sessionId y ante cualquier error de almacenamiento deja todo como estaba. Fases: copiar -> verificar ->
// borrar global; si se interrumpe entre fases queda una copia identica (la proxima ejecucion termina el borrado). Mientras la global no se
// pudo migrar, el alumno dueño de esa ancla todavia puede recuperarla leyendola de la clave global.
// Modulo puro: el almacenamiento se inyecta (getItem/setItem/removeItem); sin React ni Supabase; nunca lanza.

import { crearIdentidad, clasificarAncla, anclaV2DesdeIdentidad } from "./sessionIdentity.js";

export var ACTIVE_WORKOUT_KEY = "it_active_workout";
export var ACTIVE_WORKOUT_MAX_MS = 6 * 3600 * 1000;

var FECHA_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function partesFecha(str) {
  if (typeof str !== "string") return null;
  var m = FECHA_RE.exec(str);
  if (!m) return null;
  var d = Number(m[1]);
  var mo = Number(m[2]);
  var y = Number(m[3]);
  var dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return { d: d, m: mo, y: y };
}

/** Fecha "d/m/aaaa" (formato es-AR) que existe en el calendario. */
export function esFechaSesionValida(str) {
  return partesFecha(str) !== null;
}

function msValido(ms) {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0;
}

/** Fecha local del dispositivo (es-AR) de un instante en ms; null si ms no es valido. */
export function fechaLocalDe(ms) {
  if (!msValido(ms)) return null;
  try {
    var s = new Date(ms).toLocaleDateString("es-AR");
    return esFechaSesionValida(s) ? s : null;
  } catch (e) {
    return null;
  }
}

/**
 * Fecha del entrenamiento: session.fecha si es valida; si no, la fecha local de session.startTime; si no (sin sesion),
 * la fecha local de nowMs (comportamiento anterior: hoy).
 */
export function fechaDeSesion(session, nowMs) {
  try {
    if (session && esFechaSesionValida(session.fecha)) return session.fecha;
    var desdeInicio = session ? fechaLocalDe(session.startTime) : null;
    if (desdeInicio) return desdeInicio;
  } catch (e) { /* sigue con hoy */ }
  var hoy = fechaLocalDe(msValido(nowMs) ? nowMs : Date.now());
  return hoy || new Date().toLocaleDateString("es-AR");
}

/** Clave de dia (Date#toDateString) de la fecha del entrenamiento; reemplaza `new Date().toDateString()`. */
export function claveDiaDeSesion(session, nowMs) {
  var p = partesFecha(fechaDeSesion(session, nowMs));
  if (!p) return new Date().toDateString();
  return new Date(p.y, p.m - 1, p.d).toDateString();
}

function enteroNoNeg(v) {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function idValido(v) {
  return (typeof v === "string" && v !== "") || (typeof v === "number" && Number.isFinite(v));
}

/** Clave individual del ancla de un alumno, o null si el id no es valido. */
export function claveAnclaAlumno(alumnoId) {
  return idValido(alumnoId) ? ACTIVE_WORKOUT_KEY + ":" + String(alumnoId) : null;
}

/**
 * Normaliza un ancla ya parseada: devuelve el objeto validado o null.
 * v1 -> { v:1, alumnoId, rId, dIdx, ciclo, semana, startTime, fecha } (sin sessionId, nunca se inventa).
 * v2 -> lo mismo con v:2 y sessionId (UUID v4 valido; validacion estricta de lib/sessionIdentity.js).
 */
function normalizarAncla(a) {
  if (!a || typeof a !== "object") return null;
  if (a.v === 2) {
    var c = clasificarAncla(a);
    if (c.tipo !== "v2") return null;
    var i = c.identidad;
    return { v: 2, sessionId: i.sessionId, alumnoId: i.alumnoId, rId: i.rutinaId, dIdx: i.diaIdx, ciclo: i.ciclo, semana: i.semanaIdx, startTime: i.startedAt, fecha: i.fecha };
  }
  if (a.v !== 1) return null;
  if ("sessionId" in a) return null;
  if (!idValido(a.alumnoId) || !idValido(a.rId)) return null;
  if (!enteroNoNeg(a.dIdx)) return null;
  if (!(typeof a.ciclo === "number" && Number.isInteger(a.ciclo) && a.ciclo >= 1)) return null;
  if (!enteroNoNeg(a.semana)) return null;
  if (!msValido(a.startTime)) return null;
  if (!esFechaSesionValida(a.fecha)) return null;
  return { v: 1, alumnoId: a.alumnoId, rId: a.rId, dIdx: a.dIdx, ciclo: a.ciclo, semana: a.semana, startTime: a.startTime, fecha: a.fecha };
}

// Lee una clave. `error: true` = getItem LANZO (el contenido es desconocido: puede haber un ancla valida que no se pudo leer);
// es distinto de una clave ausente (raw null, sin error). Quien decide escribir/borrar debe abortar ante `error`.
function leerClave(storage, key) {
  try {
    if (!storage || typeof storage.getItem !== "function" || !key) return { raw: null, ancla: null, error: false };
    var raw = storage.getItem(key);
    if (typeof raw !== "string" || raw === "") return { raw: null, ancla: null, error: false };
    var ancla = null;
    try { ancla = normalizarAncla(JSON.parse(raw)); } catch (e) { ancla = null; }
    return { raw: raw, ancla: ancla, error: false };
  } catch (e) {
    return { raw: null, ancla: null, error: true };
  }
}

function igualesAncla(x, y) {
  return !!x && !!y && JSON.stringify(x) === JSON.stringify(y);
}

/**
 * Ancla validada o null (JSON roto o campos invalidos -> null, sin borrar).
 *  - Con alumnoId: la ancla INDIVIDUAL de ese alumno (su clave propia; su alumnoId debe coincidir con la clave). Si no tiene
 *    individual valida, la global LEGADA solo si pertenece a ese alumno (aun no migrada).
 *  - Sin alumnoId: solo la clave global legada.
 */
export function leerSesionActiva(storage, alumnoId) {
  if (alumnoId === undefined) return leerClave(storage, ACTIVE_WORKOUT_KEY).ancla;
  var key = claveAnclaAlumno(alumnoId);
  if (!key) return null;
  var indLec = leerClave(storage, key);
  if (indLec.error) return null; // no se adivina: la individual existe pero no se pudo leer
  var ind = indLec.ancla;
  if (ind && String(ind.alumnoId) === String(alumnoId)) return ind;
  var glob = leerClave(storage, ACTIVE_WORKOUT_KEY).ancla;
  return glob && String(glob.alumnoId) === String(alumnoId) ? glob : null;
}

function hayAnclaCruda(storage, alumnoId) {
  try {
    if (!storage || typeof storage.getItem !== "function") return false;
    var keys = [claveAnclaAlumno(alumnoId), ACTIVE_WORKOUT_KEY];
    for (var k = 0; k < keys.length; k++) {
      if (!keys[k]) continue;
      var raw = storage.getItem(keys[k]);
      if (typeof raw === "string" && raw !== "") return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Migra el ancla GLOBAL legada (v1 o v2) a la clave individual de su alumno. Idempotente y sin perdida; nunca lanza.
 * Devuelve { estado }:
 *  - "sin_global"      no hay ancla global.
 *  - "invalida"        global corrupta/incompatible o con inicio futuro: no se migra ni se borra.
 *  - "vencida"         global valida pero vencida (> ACTIVE_WORKOUT_MAX_MS): no se migra ni se borra (no se reutiliza).
 *  - "migrada"         copiada, releida y verificada; la global se borro.
 *  - "ya_migrada"      la individual ya era identica a la global; la global se borro.
 *  - "conflicto"       existe una individual VALIDA distinta: no se sobrescribe y la global se conserva.
 *  - "error_almacenamiento"  fallo/cuota al escribir o leer: todo queda como estaba (la global se conserva).
 *  - "no_verificada"   la copia releida no coincide: la global se conserva.
 *  - "migrada_sin_borrar"  copia verificada pero no se pudo borrar la global (se reintenta luego, es identica).
 */
export function migrarAnclaGlobal(storage, now) {
  try {
    var t = msValido(now) ? now : Date.now();
    var g = leerClave(storage, ACTIVE_WORKOUT_KEY);
    if (g.error) return { estado: "error_almacenamiento" };
    if (g.raw === null) return { estado: "sin_global" };
    if (!g.ancla) return { estado: "invalida" };
    var edad = t - g.ancla.startTime;
    if (edad < 0) return { estado: "invalida" };
    if (edad > ACTIVE_WORKOUT_MAX_MS) return { estado: "vencida" };
    var key = claveAnclaAlumno(g.ancla.alumnoId);
    if (!key) return { estado: "invalida" };
    var ind = leerClave(storage, key);
    // Error de lectura de la individual: puede existir una ancla valida que no se vio. No se escribe, sobrescribe ni borra nada.
    if (ind.error) return { estado: "error_almacenamiento" };
    var yaCopiada = false;
    if (ind.ancla) {
      if (!igualesAncla(ind.ancla, g.ancla)) return { estado: "conflicto" };
      yaCopiada = true;
    } else {
      // Ausente o corrupta (no utilizable): se escribe la copia exacta de la global.
      try { storage.setItem(key, g.raw); } catch (e) { return { estado: "error_almacenamiento" }; }
      var rel = leerClave(storage, key);
      if (rel.raw !== g.raw || !igualesAncla(rel.ancla, g.ancla)) return { estado: "no_verificada" };
    }
    try { storage.removeItem(ACTIVE_WORKOUT_KEY); } catch (e) { return { estado: "migrada_sin_borrar" }; }
    return { estado: yaCopiada ? "ya_migrada" : "migrada" };
  } catch (e) {
    return { estado: "error_almacenamiento" };
  }
}

/**
 * Decide la sesion a iniciar. Devuelve { session, recuperada, motivo }.
 *  - Sin alumnoId (entrenador, enlace compartido, solo lectura): no lee ni escribe ancla.
 *  - Ancla del MISMO entrenamiento (alumno, rutina, dia, ciclo, semana) y 0 <= now - inicio <= ACTIVE_WORKOUT_MAX_MS:
 *    se continua con el inicio y la fecha del ancla (motivo "ancla").
 *  - En cualquier otro caso: sesion nueva con la fecha local de su inicio; se escribe un ancla nueva.
 */
export function prepararInicioEntrenamiento(params) {
  var p = params || {};
  var now = msValido(p.now) ? p.now : Date.now();
  var base = Object.assign({}, p.session || {}, { ciclo: p.ciclo });
  var startTime = msValido(base.startTime) ? base.startTime : now;
  // P0-1: la semana que ve el alumno al iniciar (base 0) queda congelada en la sesion; series y sesion finalizada usan esa misma semana
  // (lib/semanaEntrenamiento.js). Solo si es un indice valido 0..3; si no, la sesion sigue sin semana congelada (comportamiento anterior).
  var semanaIdx = Number.isInteger(p.semana) && p.semana >= 0 && p.semana <= 3 ? p.semana : undefined;
  var nueva = Object.assign({}, base, { startTime: startTime, fecha: fechaLocalDe(startTime) });
  if (semanaIdx !== undefined) nueva.semanaIdx = semanaIdx;
  delete nueva.identity; // una sesion nueva nunca hereda una identidad que venga en la entrada (se crea solo aqui, abajo)

  if (!idValido(p.alumnoId)) return { session: nueva, recuperada: false, motivo: "sin_alumno" };

  var storage = p.storage;
  // Antes de leer: pasa las anclas globales legadas (de CUALQUIER alumno) a su clave individual. Un fallo no impide iniciar.
  migrarAnclaGlobal(storage, now);
  var ancla = leerSesionActiva(storage, p.alumnoId);
  var motivo;
  if (!ancla) {
    motivo = hayAnclaCruda(storage, p.alumnoId) ? "invalida" : "sin_ancla";
  } else if (String(ancla.rId) !== String(base.rId) || ancla.dIdx !== Number(base.dIdx)) {
    motivo = "otro_dia";
  } else if (ancla.ciclo !== Number(p.ciclo)) {
    motivo = "otro_ciclo";
  } else if (ancla.semana !== Number(p.semana)) {
    motivo = "otra_semana";
  } else {
    var edad = now - ancla.startTime;
    if (edad < 0) motivo = "invalida";
    else if (edad > ACTIVE_WORKOUT_MAX_MS) motivo = "vencida";
    else {
      var recup = Object.assign({}, base, { startTime: ancla.startTime, fecha: ancla.fecha }, semanaIdx !== undefined ? { semanaIdx: semanaIdx } : {});
      // v2: se recupera la identidad ORIGINAL (reconstruida de los mismos campos validados del ancla). v1: entrenamiento legado, sin identity.
      delete recup.identity;
      if (ancla.v === 2) {
        var idr = crearIdentidad({ alumnoId: ancla.alumnoId, rutinaId: ancla.rId, diaIdx: ancla.dIdx, semanaIdx: ancla.semana, ciclo: ancla.ciclo, fecha: ancla.fecha, startedAt: ancla.startTime }, { genId: function () { return ancla.sessionId; } });
        if (idr.ok) recup.identity = idr.value;
      }
      return { session: recup, recuperada: true, motivo: "ancla", legado: ancla.v === 1 };
    }
  }

  var semanaNum = Number(p.semana);
  var cicloNum = Number(p.ciclo);
  var dIdxNum = Number(base.dIdx);
  if (nueva.fecha && idValido(base.rId) && enteroNoNeg(dIdxNum) && Number.isInteger(cicloNum) && cicloNum >= 1 && enteroNoNeg(semanaNum)) {
    var idn = crearIdentidad({ alumnoId: p.alumnoId, rutinaId: base.rId, diaIdx: dIdxNum, semanaIdx: semanaNum, ciclo: cicloNum, fecha: nueva.fecha, startedAt: startTime });
    if (idn.ok) nueva.identity = idn.value;
    var payload = idn.ok
      ? anclaV2DesdeIdentidad(idn.value).value
      // Sin identidad valida (p. ej. semana fuera de 0..3): comportamiento anterior, ancla v1 sin sessionId.
      : { v: 1, alumnoId: p.alumnoId, rId: base.rId, dIdx: dIdxNum, ciclo: cicloNum, semana: semanaNum, startTime: startTime, fecha: nueva.fecha };
    // Solo la clave de ESTE alumno: las anclas de otros alumnos no se leen ni se tocan. Si falla (cuota, sin acceso), la sesion sigue en memoria.
    // Si la individual no se pudo LEER, puede haber un ancla valida: no se sobrescribe (la sesion sigue en memoria).
    if (leerClave(storage, claveAnclaAlumno(p.alumnoId)).error) return { session: nueva, recuperada: false, motivo: motivo, anclaSinEscribir: true };
    try {
      storage.setItem(claveAnclaAlumno(p.alumnoId), JSON.stringify(payload));
    } catch (e) { /* sin almacenamiento */ }
  }
  return { session: nueva, recuperada: false, motivo: motivo };
}

function mismoEntrenamiento(ancla, alumnoId, s) {
  if (!ancla || !s) return false;
  if (String(ancla.alumnoId) !== String(alumnoId)) return false;
  if (String(ancla.rId) !== String(s.rId) || ancla.dIdx !== Number(s.dIdx) || ancla.startTime !== s.startTime) return false;
  if (ancla.v === 2 && s.identity && s.identity.sessionId !== ancla.sessionId) return false;
  return true;
}

/**
 * Borra el ancla SOLO si es de este entrenamiento (alumno, rutina, dia, inicio y, en v2, sessionId). Devuelve true si borro algo.
 * Toca unicamente la clave individual del alumno y, si la global legada es de ESTE mismo entrenamiento (no migrada), tambien esa;
 * nunca borra el ancla de otro alumno.
 */
export function cerrarSesionActiva(storage, params) {
  try {
    var p = params || {};
    var s = p.session;
    if (!s || !idValido(p.alumnoId)) return false;
    migrarAnclaGlobal(storage, p.now);
    var borro = false;
    var key = claveAnclaAlumno(p.alumnoId);
    var ind = leerClave(storage, key).ancla;
    if (mismoEntrenamiento(ind, p.alumnoId, s)) { storage.removeItem(key); borro = true; }
    var glob = leerClave(storage, ACTIVE_WORKOUT_KEY).ancla;
    if (mismoEntrenamiento(glob, p.alumnoId, s)) { storage.removeItem(ACTIVE_WORKOUT_KEY); borro = true; }
    return borro;
  } catch (e) {
    return false;
  }
}
