// SessionIdentity (PR-1) — contrato puro de la identidad inmutable de un entrenamiento. SIN CONECTAR a la app todavia.
//
// Una identidad nombra UN entrenamiento concreto de UN alumno. Una vez creada no cambia (objeto congelado).
//
// CAMPOS (contrato definitivo, v: 1)
//   v          1                  version del contrato de identidad (entero).
//   sessionId  string             UUID v4 en minusculas (8-4-4-4-12; version 4; variante 8|9|a|b). Aleatorio: NUNCA se deriva
//                                 de fecha, alumno, rutina, hash ni nada determinista.
//   alumnoId   string | number    id del alumno (string no vacio o numero finito). El tipo se conserva tal cual.
//   rutinaId   string | number    id de la rutina (mismas reglas). En el ancla v1/v2 se llama `rId`.
//   diaIdx     entero >= 0        indice del dia dentro de la rutina, BASE 0 (0 = primer dia). En el ancla se llama `dIdx`.
//   semanaIdx  entero 0..3        indice de la semana del ciclo, BASE 0 (0 = semana 1 ... 3 = semana 4). En el ancla `semana`.
//   ciclo      entero >= 1        numero de ciclo, BASE 1 (1 = primer ciclo).
//   fecha      string "d/m/aaaa"  fecha LOCAL del dispositivo (formato es-AR, como session.fecha), debe existir en el calendario.
//   startedAt  entero > 0         instante de inicio en MILISEGUNDOS desde epoch UTC (Date.now()). En el ancla `startTime`.
//
// ANCLA (almacenamiento local, PR futuros). Forma plana compatible con la ancla v1 de lib/workoutSessionDate.js:
//   v1: { v:1, alumnoId, rId, dIdx, ciclo, semana, startTime, fecha }                 -> SIN sessionId (no se inventa).
//   v2: { v:2, sessionId, alumnoId, rId, dIdx, ciclo, semana, startTime, fecha }       -> identidad completa.
//
// REGLAS
//   - Una identidad invalida NUNCA se repara: se devuelve { ok:false, error:<codigo>, campo? }.
//   - Funciones puras: no mutan sus argumentos, no leen localStorage/navegador/red. La unica fuente de azar es el generador
//     de UUID, inyectable (opts.genId); por defecto crypto.randomUUID/getRandomValues; si no hay, error (sin Math.random).
//   - No hay IDs retroactivos: una ancla v1 se reconoce como v1 con sessionId null; no se promueve a v2.
//   - Una identidad pertenece a un solo alumno: `identidadPerteneceA` permite exigirlo al consumir una identidad.
//   - Nunca lanza.
import { esFechaSesionValida } from "./workoutSessionDate.js";

export var IDENTITY_VERSION = 1;
export var ANCLA_V1 = 1;
export var ANCLA_V2 = 2;
export var SEMANA_IDX_MIN = 0;
export var SEMANA_IDX_MAX = 3;

export var ERR = Object.freeze({
  NO_OBJETO: "no_objeto",
  VERSION: "version_incompatible",
  CAMPO_AUSENTE: "campo_ausente",
  CAMPO_INVALIDO: "campo_invalido",
  JSON_INVALIDO: "json_invalido",
  SIN_GENERADOR: "sin_generador_uuid",
  UUID_GENERADO_INVALIDO: "uuid_generado_invalido"
});

var UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var CAMPOS = ["v", "sessionId", "alumnoId", "rutinaId", "diaIdx", "semanaIdx", "ciclo", "fecha", "startedAt"];

function error(code, campo) {
  var r = { ok: false, error: code };
  if (campo) r.campo = campo;
  return Object.freeze(r);
}
function ok(value) { return Object.freeze({ ok: true, value: value }); }
function esObjeto(o) { return o !== null && typeof o === "object" && !Array.isArray(o); }
function tiene(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

/** true si es un UUID v4 (minusculas, variante RFC 4122). */
export function esUuidV4(s) { return typeof s === "string" && UUID_V4_RE.test(s); }

function idValido(v) { return (typeof v === "string" && v !== "") || (typeof v === "number" && Number.isFinite(v)); }
function enteroMin(v, min) { return typeof v === "number" && Number.isInteger(v) && v >= min; }

// Validadores por campo (devuelven true si el valor es valido).
var VALIDOS = {
  sessionId: esUuidV4,
  alumnoId: idValido,
  rutinaId: idValido,
  diaIdx: function (v) { return enteroMin(v, 0); },
  semanaIdx: function (v) { return enteroMin(v, SEMANA_IDX_MIN) && v <= SEMANA_IDX_MAX; },
  ciclo: function (v) { return enteroMin(v, 1); },
  fecha: function (v) { try { return esFechaSesionValida(v); } catch (e) { return false; } },
  startedAt: function (v) { return typeof v === "number" && Number.isInteger(v) && v > 0 && Number.isSafeInteger(v); }
};
var CAMPOS_DATOS = ["sessionId", "alumnoId", "rutinaId", "diaIdx", "semanaIdx", "ciclo", "fecha", "startedAt"];

// Valida los campos de datos de `o` (sin version). Devuelve null si todo es valido o el primer error.
function primerError(o) {
  for (var i = 0; i < CAMPOS_DATOS.length; i++) {
    var k = CAMPOS_DATOS[i];
    if (!tiene(o, k) || o[k] === undefined) return error(ERR.CAMPO_AUSENTE, k);
    if (!VALIDOS[k](o[k])) return error(ERR.CAMPO_INVALIDO, k);
  }
  return null;
}

function construir(o) {
  var out = {};
  for (var i = 0; i < CAMPOS.length; i++) out[CAMPOS[i]] = o[CAMPOS[i]];
  return Object.freeze(out);
}

/** Valida estrictamente una identidad. Devuelve { ok:true, value:<copia congelada> } o { ok:false, error, campo? }. */
export function validarIdentidad(x) {
  try {
    if (!esObjeto(x)) return error(ERR.NO_OBJETO);
    if (!tiene(x, "v") || x.v === undefined) return error(ERR.CAMPO_AUSENTE, "v");
    if (x.v !== IDENTITY_VERSION) return error(ERR.VERSION, "v");
    var e = primerError(x);
    if (e) return e;
    for (var k in x) { if (tiene(x, k) && CAMPOS.indexOf(k) < 0) return error(ERR.CAMPO_INVALIDO, k); }
    return ok(construir(x));
  } catch (err) {
    return error(ERR.NO_OBJETO);
  }
}

/** true/false: atajo de validarIdentidad. */
export function esIdentidadValida(x) { return validarIdentidad(x).ok; }

function generadorPorDefecto() {
  try {
    var c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (c && typeof c.randomUUID === "function") return function () { return c.randomUUID(); };
    if (c && typeof c.getRandomValues === "function") {
      return function () {
        var b = new Uint8Array(16);
        c.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        var h = Array.prototype.map.call(b, function (n) { return (n + 256).toString(16).slice(1); }).join("");
        return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
      };
    }
  } catch (e) { /* sin generador */ }
  return null;
}

/** Genera un UUID v4 aleatorio. Devuelve { ok:true, value } o error. opts.genId (inyectable) debe devolver un UUID v4. */
export function generarSessionId(opts) {
  try {
    var gen = opts && typeof opts.genId === "function" ? opts.genId : generadorPorDefecto();
    if (!gen) return error(ERR.SIN_GENERADOR);
    var id = gen();
    if (!esUuidV4(id)) return error(ERR.UUID_GENERADO_INVALIDO, "sessionId");
    return ok(id);
  } catch (e) {
    return error(ERR.SIN_GENERADOR);
  }
}

/**
 * Crea una identidad NUEVA. datos: { alumnoId, rutinaId, diaIdx, semanaIdx, ciclo, fecha, startedAt } (sessionId y v los
 * asigna este modulo; si datos trae sessionId/v se ignoran). No se corrige nada: un dato invalido devuelve error.
 */
export function crearIdentidad(datos, opts) {
  try {
    if (!esObjeto(datos)) return error(ERR.NO_OBJETO);
    var g = generarSessionId(opts);
    if (!g.ok) return g;
    var cand = { v: IDENTITY_VERSION, sessionId: g.value };
    for (var i = 2; i < CAMPOS.length; i++) cand[CAMPOS[i]] = datos[CAMPOS[i]];
    return validarIdentidad(cand);
  } catch (e) {
    return error(ERR.NO_OBJETO);
  }
}

/** Serializa sin perdida (JSON con orden de claves fijo). Devuelve { ok:true, value:<string> } o error si es invalida. */
export function serializarIdentidad(identidad) {
  var v = validarIdentidad(identidad);
  if (!v.ok) return v;
  return ok(JSON.stringify(v.value));
}

/** Deserializa de forma segura (string JSON o objeto ya parseado). Nunca lanza ni repara. */
export function deserializarIdentidad(entrada) {
  var obj = entrada;
  if (typeof entrada === "string") {
    try { obj = JSON.parse(entrada); } catch (e) { return error(ERR.JSON_INVALIDO); }
  }
  return validarIdentidad(obj);
}

/** true si la identidad es valida y es del alumno dado (comparacion estricta, sin coercion de tipos). */
export function identidadPerteneceA(identidad, alumnoId) {
  var v = validarIdentidad(identidad);
  return v.ok && idValido(alumnoId) && v.value.alumnoId === alumnoId;
}

/** Valida estrictamente un ancla v2 y devuelve { ok:true, value:<identidad> } o error (campo con nombre de ancla). */
export function validarAnclaV2(ancla) {
  try {
    if (!esObjeto(ancla)) return error(ERR.NO_OBJETO);
    if (ancla.v !== ANCLA_V2) return error(ERR.VERSION, "v");
    var cand = {
      v: IDENTITY_VERSION, sessionId: ancla.sessionId, alumnoId: ancla.alumnoId, rutinaId: ancla.rId,
      diaIdx: ancla.dIdx, semanaIdx: ancla.semana, ciclo: ancla.ciclo, fecha: ancla.fecha, startedAt: ancla.startTime
    };
    // Campos ausentes: `undefined` se detecta como ausente en validarIdentidad.
    var r = validarIdentidad(cand);
    if (r.ok) return r;
    return r.campo && CAMPO_ANCLA[r.campo] ? error(r.error, CAMPO_ANCLA[r.campo]) : r;
  } catch (e) {
    return error(ERR.NO_OBJETO);
  }
}

var CAMPO_ANCLA = { rutinaId: "rId", diaIdx: "dIdx", semanaIdx: "semana", startedAt: "startTime" };

/** Identidad -> ancla v2 (objeto nuevo, plano). Devuelve { ok:true, value } o error si la identidad es invalida. */
export function anclaV2DesdeIdentidad(identidad) {
  var v = validarIdentidad(identidad);
  if (!v.ok) return v;
  var i = v.value;
  return ok(Object.freeze({
    v: ANCLA_V2, sessionId: i.sessionId, alumnoId: i.alumnoId, rId: i.rutinaId, dIdx: i.diaIdx,
    ciclo: i.ciclo, semana: i.semanaIdx, startTime: i.startedAt, fecha: i.fecha
  }));
}

/**
 * Clasifica un ancla almacenada: { tipo:"v2", identidad } | { tipo:"v1", sessionId:null, ancla } | { tipo:"invalida", error, campo? }.
 * Una ancla v1 valida se reconoce como v1 SIN sessionId: no se le inventa identidad. Una ancla v1 que trae un campo
 * sessionId no es v1 valida (es incoherente) y se rechaza.
 */
export function clasificarAncla(ancla) {
  try {
    if (!esObjeto(ancla)) return Object.freeze({ tipo: "invalida", error: ERR.NO_OBJETO });
    if (ancla.v === ANCLA_V2) {
      var r2 = validarAnclaV2(ancla);
      return r2.ok ? Object.freeze({ tipo: "v2", identidad: r2.value }) : Object.freeze({ tipo: "invalida", error: r2.error, campo: r2.campo });
    }
    if (ancla.v === ANCLA_V1) {
      if (tiene(ancla, "sessionId")) return Object.freeze({ tipo: "invalida", error: ERR.CAMPO_INVALIDO, campo: "sessionId" });
      var tmp = { v: ANCLA_V2, sessionId: "00000000-0000-4000-8000-000000000000", alumnoId: ancla.alumnoId, rId: ancla.rId, dIdx: ancla.dIdx, ciclo: ancla.ciclo, semana: ancla.semana, startTime: ancla.startTime, fecha: ancla.fecha };
      var r1 = validarAnclaV2(tmp);
      if (!r1.ok) return Object.freeze({ tipo: "invalida", error: r1.error, campo: r1.campo });
      return Object.freeze({
        tipo: "v1", sessionId: null,
        ancla: Object.freeze({ v: ANCLA_V1, alumnoId: ancla.alumnoId, rId: ancla.rId, dIdx: ancla.dIdx, ciclo: ancla.ciclo, semana: ancla.semana, startTime: ancla.startTime, fecha: ancla.fecha })
      });
    }
    return Object.freeze({ tipo: "invalida", error: tiene(ancla, "v") ? ERR.VERSION : ERR.CAMPO_AUSENTE, campo: "v" });
  } catch (e) {
    return Object.freeze({ tipo: "invalida", error: ERR.NO_OBJETO });
  }
}
