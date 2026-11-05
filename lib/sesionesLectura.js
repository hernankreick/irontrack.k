// D76-02 — Lectura de sesiones del ALUMNO sin confundir "lectura fallida" con "cero sesiones".
//
// Problema: en el flujo del alumno, sb.getSesiones (sbFetch) devuelve null ante HTTP no-ok y lanza ante error de red; App aplicaba
// `setSesiones(ses || [])` (y vaciaba al empezar, FIX B). Con sesiones = [] getActiveStudentRoutinePosition recalcula 0 dias completados
// y el plan muestra "Dia 1": el alumno podia entrenar el dia equivocado.
//
// Este modulo (puro: sin React, sin Supabase, sin localStorage) separa:
//   - el resultado de UNA lectura (ok con filas | error con motivo: http, invalid, timeout, red, sin_alumno);
//   - el ESTADO de las sesiones visibles: filas + si son confiables + orden de respuestas (seq) + sesiones confirmadas localmente
//     tras finalizar (que el servidor puede no traer todavia).
// Reglas: una lectura fallida nunca vacia las filas; una respuesta vieja nunca pisa una mas nueva; la respuesta de otro alumno se ignora.
import { sessionAlreadyExists } from "./workoutSession.js";
import { rowCiclo } from "./rutinaCiclo.js";

export var SESIONES_LECTURA_TIMEOUT_MS = 15000;

function toId(v) {
  return v == null || v === "" ? null : String(v);
}

/** Clasifica lo que devuelve sbRequestStatus ({ ok, status, data }). */
export function clasificarRespuestaSesiones(res) {
  if (!res || typeof res !== "object") return { ok: false, reason: "invalid" };
  if (!res.ok) return { ok: false, reason: "http", status: res.status };
  if (!Array.isArray(res.data)) return { ok: false, reason: "invalid" };
  return { ok: true, rows: res.data };
}

/** Ejecuta request(alumnoId) con timeout. Nunca lanza; cada resultado lleva alumnoId. */
export async function leerSesionesAlumno(request, alumnoId, opts) {
  var aid = toId(alumnoId);
  if (!aid) return { ok: false, reason: "sin_alumno", alumnoId: null };
  var timeoutMs = opts && Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : SESIONES_LECTURA_TIMEOUT_MS;
  var timer = null;
  var TIMEOUT = {};
  try {
    var res = await Promise.race([
      Promise.resolve().then(function () { return request(aid); }),
      new Promise(function (resolve) { timer = setTimeout(function () { resolve(TIMEOUT); }, timeoutMs); }),
    ]);
    if (res === TIMEOUT) return { ok: false, reason: "timeout", alumnoId: aid };
    return Object.assign({}, clasificarRespuestaSesiones(res), { alumnoId: aid });
  } catch (e) {
    return { ok: false, reason: "red", alumnoId: aid };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function estadoInicialSesiones() {
  return { alumnoId: null, rows: [], confiable: false, status: "sin_datos", reason: null, seqEmitido: 0, seqAplicado: 0, confirmadas: [] };
}

export function resetSesiones() {
  return estadoInicialSesiones();
}

export function sesionesConfiables(estado) {
  return !!(estado && estado.confiable);
}

export function necesitaReintento(estado) {
  return !!estado && (estado.status === "error" || estado.status === "desactualizado");
}

/** Misma sesion: por id si ambas lo tienen; si no, fecha normalizada + dia_idx + semana + ciclo. */
function mismaSesion(a, b) {
  if (!a || !b) return false;
  if (a.id != null && a.id !== "" && b.id != null && b.id !== "") return String(a.id) === String(b.id);
  return sessionAlreadyExists([a], b.fecha, b.dia_idx, b.semana, rowCiclo(b));
}

function contiene(lista, fila) {
  return lista.some(function (r) { return mismaSesion(r, fila); });
}

/** Emite una lectura: devuelve el estado nuevo y su numero de orden. Cambiar de alumno vacia el estado (nunca se ven filas ajenas). */
export function iniciarLecturaSesiones(estado, alumnoId) {
  var prev = estado || estadoInicialSesiones();
  var aid = toId(alumnoId);
  var seq = prev.seqEmitido + 1;
  if (aid !== prev.alumnoId) {
    var nuevo = estadoInicialSesiones();
    nuevo.alumnoId = aid;
    nuevo.status = "cargando";
    nuevo.seqEmitido = seq;
    nuevo.seqAplicado = seq - 1; // toda lectura emitida antes del cambio de alumno queda obsoleta (A -> B -> A rapido)
    return { estado: nuevo, seq: seq };
  }
  return {
    estado: Object.assign({}, prev, { status: prev.confiable ? prev.status : "cargando", seqEmitido: seq }),
    seq: seq,
  };
}

/** Aplica el resultado de la lectura `seq`. Devuelve el MISMO objeto si la respuesta se ignora (otro alumno o fuera de orden). */
export function aplicarLecturaSesiones(estado, alumnoId, seq, resultado) {
  if (!estado) return estado;
  var aid = toId(alumnoId);
  if (aid == null || aid !== estado.alumnoId) return estado;
  if (!(seq > estado.seqAplicado)) return estado;
  if (!resultado || !resultado.ok || !Array.isArray(resultado.rows)) {
    return Object.assign({}, estado, {
      status: estado.confiable ? "desactualizado" : "error",
      reason: (resultado && resultado.reason) || "invalid",
      seqAplicado: seq,
    });
  }
  var servidor = resultado.rows.filter(function (r) { return r && toId(r.alumno_id) === aid; });
  var pendientes = estado.confirmadas.filter(function (c) { return !contiene(servidor, c); });
  return Object.assign({}, estado, {
    rows: pendientes.concat(servidor),
    confirmadas: pendientes,
    confiable: true,
    status: "ok",
    reason: null,
    seqAplicado: seq,
  });
}

/** Tras una finalizacion CONFIRMADA por el servidor: la fila queda visible aunque la proxima lectura falle o aun no la traiga. */
export function registrarSesionConfirmada(estado, alumnoId, fila) {
  if (!estado || !fila) return estado;
  var aid = toId(alumnoId);
  if (aid == null || aid !== estado.alumnoId) return estado;
  var f = Object.assign({}, fila, { alumno_id: fila.alumno_id != null ? fila.alumno_id : aid });
  if (toId(f.alumno_id) !== aid) return estado;
  return Object.assign({}, estado, {
    rows: contiene(estado.rows, f) ? estado.rows : [f].concat(estado.rows),
    confirmadas: contiene(estado.confirmadas, f) ? estado.confirmadas : estado.confirmadas.concat([f]),
  });
}

/**
 * Que muestra el plan del alumno segun la lectura de sesiones.
 * "no_aplica": no es alumno o es solo lectura (no se bloquea nada). "plan": sesiones confiables (ok o desactualizado).
 * "cargando": primera lectura en curso. "error": cualquier otro estado no confiable (incluye "sin_datos": nunca se cargo) => Reintentar.
 */
export function estadoPlanAlumno(params) {
  var p = params || {};
  if (!p.esAlumno || p.readOnly) return "no_aplica";
  var l = p.lectura || {};
  if (l.confiable) return "plan";
  if (l.status === "cargando") return "cargando";
  return "error";
}

/** Inicio de entrenamiento del alumno: nunca con el gate de semana activo ni con sesiones no confiables (no se asume "Dia 1"). */
export function puedeIniciarEntrenamientoAlumno(params) {
  var p = params || {};
  if (p.weekGateActivo) return false;
  var plan = estadoPlanAlumno(p);
  return plan !== "cargando" && plan !== "error";
}

/** Tras finalizar (onSesionGuardada): registra la fila confirmada y despues relee. Sin alumnoId no hace nada. */
export async function manejarSesionGuardada(ctl, alumnoId, filaConfirmada) {
  if (!ctl || alumnoId == null || alumnoId === "") return ctl ? ctl.estado() : null;
  if (filaConfirmada) ctl.registrarConfirmada(alumnoId, filaConfirmada);
  await ctl.cargar(alumnoId);
  return ctl.estado();
}

/** Orquestador con estado interno. leer(alumnoId) => Promise<{ ok, status, data }>; alCambiar(estado) en cada cambio. */
export function crearControladorSesiones(opciones) {
  var o = opciones || {};
  var actual = estadoInicialSesiones();
  function poner(nuevo) {
    if (nuevo === actual) return;
    actual = nuevo;
    if (typeof o.alCambiar === "function") {
      try { o.alCambiar(actual); } catch (e) { /* el consumidor no debe romper el controlador */ }
    }
  }
  return {
    cargar: async function (alumnoId) {
      var aid = toId(alumnoId);
      if (!aid) return actual;
      var ini = iniciarLecturaSesiones(actual, aid);
      poner(ini.estado);
      var resultado = await leerSesionesAlumno(o.leer, aid, { timeoutMs: o.timeoutMs });
      poner(aplicarLecturaSesiones(actual, aid, ini.seq, resultado));
      return actual;
    },
    registrarConfirmada: function (alumnoId, fila) {
      poner(registrarSesionConfirmada(actual, alumnoId, fila));
      return actual;
    },
    reiniciar: function () {
      var nuevo = resetSesiones();
      // conserva el contador para que una respuesta en vuelo anterior al reinicio no se aplique al volver a cargar
      nuevo.seqEmitido = actual.seqEmitido;
      nuevo.seqAplicado = actual.seqEmitido;
      poner(nuevo);
      return actual;
    },
    estado: function () { return actual; },
  };
}
