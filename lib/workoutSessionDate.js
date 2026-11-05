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
// Modulo puro: el almacenamiento se inyecta (getItem/setItem/removeItem); sin React ni Supabase; nunca lanza.

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

/** Ancla validada del almacenamiento o null (JSON roto o campos invalidos -> null, sin borrar). */
export function leerSesionActiva(storage) {
  try {
    if (!storage || typeof storage.getItem !== "function") return null;
    var raw = storage.getItem(ACTIVE_WORKOUT_KEY);
    if (typeof raw !== "string" || raw === "") return null;
    var a = JSON.parse(raw);
    if (!a || typeof a !== "object" || a.v !== 1) return null;
    if (!idValido(a.alumnoId) || !idValido(a.rId)) return null;
    if (!enteroNoNeg(a.dIdx)) return null;
    if (!(typeof a.ciclo === "number" && Number.isInteger(a.ciclo) && a.ciclo >= 1)) return null;
    if (!enteroNoNeg(a.semana)) return null;
    if (!msValido(a.startTime)) return null;
    if (!esFechaSesionValida(a.fecha)) return null;
    return { v: 1, alumnoId: a.alumnoId, rId: a.rId, dIdx: a.dIdx, ciclo: a.ciclo, semana: a.semana, startTime: a.startTime, fecha: a.fecha };
  } catch (e) {
    return null;
  }
}

function hayAnclaCruda(storage) {
  try {
    var raw = storage && typeof storage.getItem === "function" ? storage.getItem(ACTIVE_WORKOUT_KEY) : null;
    return typeof raw === "string" && raw !== "";
  } catch (e) {
    return false;
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
  var nueva = Object.assign({}, base, { startTime: startTime, fecha: fechaLocalDe(startTime) });

  if (!idValido(p.alumnoId)) return { session: nueva, recuperada: false, motivo: "sin_alumno" };

  var storage = p.storage;
  var ancla = leerSesionActiva(storage);
  var motivo;
  if (!ancla) {
    motivo = hayAnclaCruda(storage) ? "invalida" : "sin_ancla";
  } else if (String(ancla.alumnoId) !== String(p.alumnoId)) {
    motivo = "otro_alumno";
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
      return {
        session: Object.assign({}, base, { startTime: ancla.startTime, fecha: ancla.fecha }),
        recuperada: true,
        motivo: "ancla",
      };
    }
  }

  var semanaNum = Number(p.semana);
  var cicloNum = Number(p.ciclo);
  var dIdxNum = Number(base.dIdx);
  if (nueva.fecha && idValido(base.rId) && enteroNoNeg(dIdxNum) && Number.isInteger(cicloNum) && cicloNum >= 1 && enteroNoNeg(semanaNum)) {
    try {
      storage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({
        v: 1, alumnoId: p.alumnoId, rId: base.rId, dIdx: dIdxNum, ciclo: cicloNum, semana: semanaNum, startTime: startTime, fecha: nueva.fecha,
      }));
    } catch (e) { /* sin almacenamiento: la sesion sigue solo en memoria */ }
  }
  return { session: nueva, recuperada: false, motivo: motivo };
}

/** Borra el ancla SOLO si es de este entrenamiento (alumno, rutina, dia e inicio). Devuelve true si la borro. */
export function cerrarSesionActiva(storage, params) {
  try {
    var p = params || {};
    var s = p.session;
    var ancla = leerSesionActiva(storage);
    if (!ancla || !s || !idValido(p.alumnoId)) return false;
    if (String(ancla.alumnoId) !== String(p.alumnoId)) return false;
    if (String(ancla.rId) !== String(s.rId) || ancla.dIdx !== Number(s.dIdx) || ancla.startTime !== s.startTime) return false;
    storage.removeItem(ACTIVE_WORKOUT_KEY);
    return true;
  } catch (e) {
    return false;
  }
}
