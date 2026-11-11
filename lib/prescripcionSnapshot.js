// Copia HISTORICA de la prescripcion vigente al iniciar un entrenamiento (PR-A: modulo puro, todavia SIN conectar a la app).
//
// Por que existe: la prescripcion vive en rutinas.datos.days[].exercises[].weeks[] y cada guardado del entrenador la sobrescribe (no hay
// versiones), y al reasignar una rutina la anterior se borra. Sin una copia por sesion no se puede saber que se le pidio al alumno en un
// entrenamiento pasado, y comparar con la rutina ACTUAL daria resultados falsos si fue editada despues.
//
// Reglas (todas deliberadas):
//  - FUENTE: rutina.datos.days (la copia del servidor). NUNCA rutina.days: durante el entrenamiento logSet reemplaza en memoria el kg base
//    del ejercicio por el ultimo kg registrado (updateExerciseKgInRoutines) y ese estado se guarda en localStorage (it_rt). Copiar
//    rutina.days registraria lo EJECUTADO como si fuera lo PRESCRITO. Sin datos.days no hay copia (motivo "sin_datos_servidor").
//  - VALORES: los mismos que muestra la app, via resolveExerciseForWeek (valor de la semana; el base solo si la semana no lo define).
//    Se guardan como TEXTO tal cual los escribio el entrenador ("8-10", "45s", "400 m", ""): se interpretan al leer, con su version.
//  - origen por campo: "semana" | "base" | "vacio" (misma regla de verdad que `w.sets || ex.sets`).
//  - POSICION: bloque (warmup | main) + pos (indice en ese bloque) + orden (secuencia del dia, calentamiento primero, como el entrenamiento).
//    Un mismo ejercicio repetido en el dia queda como entradas distintas.
//  - SEMANA: solo 1..4 (semana_activa nunca sale de ese rango; las semanas 5..8 del editor no se usan ni se amplia nada).
//  - CLAVE: (alumno_id, rutina_id, ciclo, semana, dia_idx, fecha_dia) — la misma granularidad que la deduplicacion de sesiones
//    (sessionAlreadyExists: fecha normalizada + dia_idx + semana + ciclo) mas el alumno y la rutina. fecha_dia = "aaaa-mm-dd" a partir de la
//    fecha "d/m/aaaa" de la sesion (con o sin ceros), sin pasar por Date ni zonas horarias.
//  - HUELLA: "sha256:<hex>" del JSON canonico del CONTENIDO prescrito (dia + ejercicios + version), sin datos de captura: dos copias con la
//    misma prescripcion tienen la misma huella aunque se hayan capturado en momentos distintos.
//  - Varias copias para una misma clave con huellas distintas (p. ej. dos inicios el mismo dia con una edicion del entrenador en el medio)
//    => "ambigua": no se elige ninguna (estadoCopiaDeSesion).
//
// Modulo puro: sin React, sin Supabase, sin red, sin almacenamiento, sin reloj (capturadaEn se inyecta). Nunca muta sus entradas.

import { resolveExerciseForWeek } from "./workoutSession.js";
import { getRoutineWeekCount } from "./routineWeeks.js";
import { readCicloActual, readCicloBase, rowCiclo } from "./rutinaCiclo.js";

export const PRESCRIPCION_SNAPSHOT_VERSION = 1;
export const MOMENTO_CAPTURA = { INICIO: "inicio", REANUDACION: "reanudacion" };
export const FUENTE_CAPTURA = { DATOS_SERVIDOR: "datos_servidor" };
export const ORIGEN_VALOR = { SEMANA: "semana", BASE: "base", VACIO: "vacio" };
export const ESTADO_COPIA = { UNICA: "unica", SIN_COPIA: "sin_copia", AMBIGUA: "ambigua" };

// Campos de objetivo por tiempo que puede traer un ejercicio (los mismos que mira exerciseHasTimeTarget). Se copian sin interpretar.
var CAMPOS_TIEMPO = ["duration", "duracion", "time", "tiempo", "seconds", "segundos"];

// Campo de la semana (ex.weeks[i]) -> campo del ejercicio resuelto por resolveExerciseForWeek.
var CAMPOS_PRESCRIPCION = [
  { out: "sets", semana: "sets", resuelto: "sets" },
  { out: "reps", semana: "reps", resuelto: "reps" },
  { out: "kg", semana: "kg", resuelto: "kg" },
  { out: "pausa", semana: "pausa", resuelto: "pause" },
];

// ---------------------------------------------------------------- utilidades

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function texto(value) {
  return value === undefined || value === null ? "" : String(value);
}

function enBlanco(value) {
  return texto(value).trim() === "";
}

function idTexto(value) {
  if (typeof value === "string") return value !== "" ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function semanaValida(value) {
  var n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
}

function enteroNoNegativo(value) {
  var n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
}

function pad2(n) {
  return (n < 10 ? "0" : "") + n;
}

/**
 * Fecha de una sesion ("d/m/aaaa", con o sin ceros, formato es-AR que usan sesiones.fecha y session.fecha) => "aaaa-mm-dd".
 * Cualquier otro formato o una fecha que no existe en el calendario => null (no se adivina).
 */
export function fechaSesionADia(fecha) {
  if (typeof fecha !== "string") return null;
  var m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(fecha);
  if (!m) return null;
  var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return null;
  var diasMes = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > diasMes) return null;
  return y + "-" + pad2(mo) + "-" + pad2(d);
}

// ---------------------------------------------------------------- clave

function armarClave(alumnoId, rutinaId, ciclo, semana, diaIdx, fechaDia) {
  var a = idTexto(alumnoId), r = idTexto(rutinaId);
  var s = semanaValida(semana), di = enteroNoNegativo(diaIdx);
  if (a == null || r == null || s == null || di == null || !fechaDia) return null;
  var c = rowCiclo({ ciclo: ciclo });
  return {
    alumno_id: a,
    rutina_id: r,
    ciclo: c,
    semana: s,
    dia_idx: di,
    fecha_dia: fechaDia,
    texto: JSON.stringify([a, r, c, s, di, fechaDia]),
  };
}

/**
 * Clave normalizada de una copia. ciclo ausente o invalido => 1 (misma regla que rowCiclo / rowInCiclo); semana 1..4; dia_idx >= 0;
 * fecha "d/m/aaaa". Cualquier dato faltante o invalido => null (sin clave no hay copia: nunca se completa con supuestos).
 */
export function clavePrescripcion(params) {
  var p = params || {};
  return armarClave(p.alumnoId, p.rutinaId, p.ciclo, p.semana, p.diaIdx, fechaSesionADia(p.fecha));
}

/** Clave de una fila de `sesiones` (alumno_id, rutina_id, ciclo, semana, dia_idx, fecha). Sin rutina_id (legado, modo compartido) => null. */
export function claveDeSesion(row) {
  var s = asObject(row);
  if (!s) return null;
  return armarClave(s.alumno_id, s.rutina_id, s.ciclo, s.semana, s.dia_idx, fechaSesionADia(s.fecha));
}

/** Clave de una copia ya guardada (columnas de la tabla propuesta: fecha_dia "aaaa-mm-dd"). */
export function claveDeCopia(row) {
  var s = asObject(row);
  if (!s) return null;
  var f = typeof s.fecha_dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha_dia) ? s.fecha_dia : null;
  return armarClave(s.alumno_id, s.rutina_id, s.ciclo, s.semana, s.dia_idx, f);
}

export function mismaClave(a, b) {
  return !!(a && b && a.texto === b.texto);
}

// ---------------------------------------------------------------- prescripcion efectiva

/**
 * Prescripcion efectiva de UN ejercicio en la semana (indice 0-based) con el origen de cada valor.
 * Los valores salen de resolveExerciseForWeek (no se re-implementa la regla).
 */
export function prescripcionEfectivaEjercicio(exercise, weekIndex) {
  var ex = asObject(exercise) || {};
  var resuelto = resolveExerciseForWeek(ex, weekIndex) || {};
  var semanaObj = Array.isArray(ex.weeks) && Number.isInteger(weekIndex) && weekIndex >= 0 ? asObject(ex.weeks[weekIndex]) : null;
  var out = { origen: {} };
  CAMPOS_PRESCRIPCION.forEach(function (c) {
    var valor = resuelto[c.resuelto];
    out[c.out] = texto(valor);
    // Misma verdad que `w.campo || ex.campo`: si la semana tiene un valor "truthy", es el que se uso.
    if (semanaObj && semanaObj[c.semana]) out.origen[c.out] = ORIGEN_VALOR.SEMANA;
    else out.origen[c.out] = enBlanco(valor) ? ORIGEN_VALOR.VACIO : ORIGEN_VALOR.BASE;
  });
  out.nota_semana = semanaObj ? texto(semanaObj.note) : "";
  out.nota_base = texto(ex.note);
  return out;
}

function nombreEjercicio(ex) {
  return texto(ex.name != null && ex.name !== "" ? ex.name : ex.nombre);
}

function entradaEjercicio(ex, bloque, pos, orden, weekIndex) {
  var ef = prescripcionEfectivaEjercicio(ex, weekIndex);
  var entrada = {
    orden: orden,
    bloque: bloque,
    pos: pos,
    id: idTexto(ex.id),
    nombre: nombreEjercicio(ex),
    sets: ef.sets,
    reps: ef.reps,
    kg: ef.kg,
    pausa: ef.pausa,
    origen: ef.origen,
    nota_semana: ef.nota_semana,
    nota_base: ef.nota_base,
    progresion: texto(ex.progresion),
  };
  var tiempo = {};
  var hayTiempo = false;
  CAMPOS_TIEMPO.forEach(function (k) {
    if (ex[k] !== undefined && ex[k] !== null && texto(ex[k]) !== "") { tiempo[k] = texto(ex[k]); hayTiempo = true; }
  });
  if (hayTiempo) entrada.tiempo_objetivo = tiempo;
  return entrada;
}

/** Ejercicios del dia en el orden del entrenamiento (calentamiento y luego principal), con bloque, posicion y orden. */
export function ejerciciosDelDia(day, weekIndex) {
  var d = asObject(day) || {};
  var out = [];
  [["warmup", d.warmup], ["main", d.exercises]].forEach(function (par) {
    var lista = Array.isArray(par[1]) ? par[1] : [];
    lista.forEach(function (ex, pos) {
      if (!asObject(ex)) return; // una entrada rota no se inventa; pos conserva el indice real del bloque
      out.push(entradaEjercicio(ex, par[0], pos, out.length, weekIndex));
    });
  });
  return out;
}

// ---------------------------------------------------------------- huella

/** JSON canonico: claves de objetos ordenadas, arrays en su orden, undefined omitido. Determinista. */
export function jsonCanonico(value) {
  if (value === null || typeof value !== "object") {
    if (value === undefined || typeof value === "function") return "null";
    if (typeof value === "number" && !Number.isFinite(value)) return "null";
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(function (v) { return jsonCanonico(v); }).join(",") + "]";
  }
  var keys = Object.keys(value).filter(function (k) { return value[k] !== undefined && typeof value[k] !== "function"; }).sort();
  return "{" + keys.map(function (k) { return JSON.stringify(k) + ":" + jsonCanonico(value[k]); }).join(",") + "}";
}

var K256 = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function utf8Bytes(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      var c2 = str.charCodeAt(i + 1);
      if (c2 >= 0xdc00 && c2 <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00); i++; }
    }
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // sustituto suelto
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

/** SHA-256 (hex) de un texto UTF-8. Sincrono y sin dependencias (mismo resultado en Safari, Chrome y Node). */
export function sha256Hex(str) {
  var bytes = utf8Bytes(String(str));
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  var h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  var w = new Array(64);
  for (var off = 0; off < bytes.length; off += 64) {
    for (var t = 0; t < 16; t++) {
      w[t] = ((bytes[off + 4 * t] << 24) | (bytes[off + 4 * t + 1] << 16) | (bytes[off + 4 * t + 2] << 8) | bytes[off + 4 * t + 3]) >>> 0;
    }
    for (t = 16; t < 64; t++) {
      var x = w[t - 15], y = w[t - 2];
      var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
    for (t = 0; t < 64; t++) {
      var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      var ch = (e & f) ^ (~e & g);
      var t1 = (k + S1 + ch + K256[t] + w[t]) >>> 0;
      var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var t2 = (S0 + maj) >>> 0;
      k = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0; h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0; h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + k) >>> 0;
  }
  return h.map(function (v) { return ("00000000" + v.toString(16)).slice(-8); }).join("");
}

/** Huella del CONTENIDO prescrito de una copia (version + dia + ejercicios). No incluye datos de captura ni la semana/ciclo. */
export function huellaPrescripcion(snapshot) {
  var s = asObject(snapshot);
  if (!s) return null;
  var contenido = { v: s.v, dia: s.dia ? { idx: s.dia.idx, label: s.dia.label } : null, ejercicios: Array.isArray(s.ejercicios) ? s.ejercicios : [] };
  return "sha256:" + sha256Hex(jsonCanonico(contenido));
}

// ---------------------------------------------------------------- copia

function falla(motivo) {
  return { ok: false, motivo: motivo };
}

/**
 * Construye la copia de la prescripcion de UN entrenamiento.
 * @param {object} params
 * @param {object} params.rutina        fila de rutinas (id, nombre, alumno_id?, datos.days, datos.ciclo_actual...). Se lee SOLO datos.days.
 * @param {*}      params.alumnoId      alumno que entrena (debe coincidir con rutina.alumno_id si la rutina lo trae)
 * @param {number} params.diaIdx        dia de la rutina (0-based)
 * @param {number} params.semana        semana de la rutina 1..4 (la MISMA que se guardara en sesiones.semana)
 * @param {string} params.fecha         fecha del entrenamiento "d/m/aaaa" (session.fecha, fijada al iniciar)
 * @param {number} [params.semanaMostrada]  semana que veia el alumno en pantalla (si difiere, la lectura la tratara como no verificable)
 * @param {string} [params.momento]     "inicio" (default) | "reanudacion"
 * @param {string} [params.capturadaEn] ISO del momento de la captura (inyectado; el modulo no lee el reloj)
 * @returns {{ok:true, clave, snapshot, hash} | {ok:false, motivo}}
 *   motivos: rutina_invalida | sin_datos_servidor | alumno_invalido | alumno_no_coincide | dia_invalido | semana_invalida | fecha_invalida
 */
export function buildPrescripcionSnapshot(params) {
  var p = params || {};
  var rutina = asObject(p.rutina);
  if (!rutina || idTexto(rutina.id) == null) return falla("rutina_invalida");
  var datos = asObject(rutina.datos);
  if (!datos || !Array.isArray(datos.days)) return falla("sin_datos_servidor");
  var alumnoId = idTexto(p.alumnoId);
  if (alumnoId == null) return falla("alumno_invalido");
  var rutinaAlumno = idTexto(rutina.alumno_id);
  if (rutinaAlumno != null && rutinaAlumno !== alumnoId) return falla("alumno_no_coincide");
  var days = datos.days;
  var diaIdx = typeof p.diaIdx === "number" && Number.isInteger(p.diaIdx) ? p.diaIdx : null;
  if (diaIdx == null || diaIdx < 0 || diaIdx >= days.length || !asObject(days[diaIdx])) return falla("dia_invalido");
  var semana = typeof p.semana === "number" ? semanaValida(p.semana) : null;
  if (semana == null) return falla("semana_invalida");
  var fechaDia = fechaSesionADia(p.fecha);
  if (!fechaDia) return falla("fecha_invalida");

  var ciclo = readCicloActual(datos);
  var clave = armarClave(alumnoId, rutina.id, ciclo, semana, diaIdx, fechaDia);
  var day = days[diaIdx];
  var semanaMostrada = typeof p.semanaMostrada === "number" ? semanaValida(p.semanaMostrada) : null;
  var momento = p.momento === MOMENTO_CAPTURA.REANUDACION ? MOMENTO_CAPTURA.REANUDACION : MOMENTO_CAPTURA.INICIO;

  var snapshot = {
    v: PRESCRIPCION_SNAPSHOT_VERSION,
    capturada_en: typeof p.capturadaEn === "string" && p.capturadaEn !== "" ? p.capturadaEn : null,
    captura: { momento: momento, fuente: FUENTE_CAPTURA.DATOS_SERVIDOR },
    rutina: {
      id: clave.rutina_id,
      nombre: texto(rutina.nombre != null ? rutina.nombre : rutina.name),
      ciclo: ciclo,
      ciclo_base: readCicloBase(datos),
      semanas_definidas: getRoutineWeekCount({ days: days }),
    },
    semana: semana,
    semana_mostrada: semanaMostrada,
    dia: { idx: diaIdx, label: texto(day.label), total_dias: days.length },
    ejercicios: ejerciciosDelDia(day, semana - 1),
  };
  // Todo se construyo con valores primitivos nuevos: la copia no comparte referencias con la rutina. La ida y vuelta por JSON lo garantiza
  // tambien ante cambios futuros de este modulo (y deja exactamente lo que se guardaria como jsonb).
  snapshot = JSON.parse(JSON.stringify(snapshot));
  return { ok: true, clave: clave, snapshot: snapshot, hash: huellaPrescripcion(snapshot) };
}

/**
 * Estado de la copia de una sesion entre las copias guardadas (filas con la clave y prescripcion_hash):
 *  sin_copia: ninguna con esa clave; unica: una o varias con la MISMA huella (reintentos); ambigua: huellas distintas para la misma clave
 *  (p. ej. el alumno inicio dos veces el mismo dia y el entrenador edito la rutina en el medio) => no se elige ninguna.
 * @returns {{estado, copia}} copia = la primera fila de la huella unica, o null
 */
export function estadoCopiaDeSesion(copias, claveSesion) {
  if (!claveSesion) return { estado: ESTADO_COPIA.SIN_COPIA, copia: null };
  var candidatas = (Array.isArray(copias) ? copias : []).filter(function (row) { return mismaClave(claveDeCopia(row), claveSesion); });
  if (!candidatas.length) return { estado: ESTADO_COPIA.SIN_COPIA, copia: null };
  var huellas = {};
  candidatas.forEach(function (row) { huellas[texto(row.prescripcion_hash)] = true; });
  if (Object.keys(huellas).length !== 1 || enBlanco(candidatas[0].prescripcion_hash)) return { estado: ESTADO_COPIA.AMBIGUA, copia: null };
  return { estado: ESTADO_COPIA.UNICA, copia: candidatas[0] };
}
