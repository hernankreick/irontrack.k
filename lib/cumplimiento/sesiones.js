// Cumplimiento de SESIONES por semana de rutina (S1..S4) y ciclo: dias completados frente a dias programados.
// Modulo puro, todavia SIN conectar a la app: sin React, sin Supabase, sin reloj, sin almacenamiento. Nunca muta sus entradas.
//
// Que mide: si el alumno completo los DIAS de cada semana de su rutina vigente. No mide series, repeticiones ni cargas (eso requiere la
// copia de la prescripcion por sesion, lib/prescripcionSnapshot.js, que todavia no se persiste) ni rendimiento (PR, volumen).
//
// Reutiliza (sin modificarlas):
//  - completedDayIndexesFromRows (lib/manualSessionValidation.js): dias completados de (rutina, ciclo, semana), sin duplicar el mismo dia,
//    solo filas completadas, solo dia_idx entero dentro de la rutina. LIMITACION: evalua solo el ciclo VIGENTE (readCicloActual). Para las
//    semanas que, tras un reinicio de semana, siguen perteneciendo a un ciclo anterior del bloque, se le pasa una COPIA de la rutina con ese
//    ciclo en datos.ciclo_actual (nunca se toca la rutina real).
//  - cicloEfectivoDeSemana / readCicloActual / readCicloBase / rowCiclo (lib/rutinaCiclo.js): que intento de cada semana es el vigente del
//    bloque (es la misma regla que filaActivaEnBloque).
//  - isCompletedSession / sessionMatchesRoutine (lib/studentWeeklyProgress.js), readSemanaActiva (lib/rutinaOperationalState.js),
//    createdAtSortKey (lib/routineStore.js), ORIGEN_VALIDADA (lib/metricas/adherencia.js).
// NO reutiliza (y por que):
//  - getStudentWeeklyProgress: solo la semana en curso del ciclo vigente, cuenta una sesion SIN dia_idx como dia completo (por fecha) y puede
//    caer a los dias marcados en el dispositivo (it_cd): no es evidencia confiable para esta metrica.
//  - adherencia (lib/metricas/adherencia.js): semanas de CALENDARIO y sin filtro de ciclo; es otra metrica (se mantiene como esta).
//
// Reglas de integridad:
//  - solo filas del alumno pedido y de la rutina pedida (rutina_id igual). Sin rutina_id (legado): solo si el nombre coincide Y la fila se creo
//    despues de asignar la rutina (created_at de ambas validos); si no, se excluye (no se atribuye historial ambiguo a una rutina nueva);
//  - un dia cuenta una sola vez por (ciclo, semana); una validacion manual (origen "validada_coach") cuenta como completada pero se informa
//    aparte (sin detalle de series); si el mismo dia hay una realizada y una validada, cuenta como realizada;
//  - una sesion sin dia_idx valido NO completa ningun dia: se informa (sesionesSinDia) y, si la semana no esta completa, la vuelve
//    "no_verificable";
//  - semana fuera de 1..4, ciclo posterior al vigente o fila no completada => se excluye y se cuenta en `excluidas`;
//  - semana FUTURA (posterior a la semana activa): "pendiente", pct null (nunca se toma como incumplida);
//  - las semanas avanzan solo cuando se completan (finalizeStudentSession / reconcileSemanaActiva): una semana ANTERIOR a la activa sin todos
//    sus dias en el historial es "no_verificable" (historial incompleto, sesiones sin dia, datos legados o reinicio), nunca "incumplida";
//  - historial incompleto (historialCompleto !== true): lo que no esta demostrado completo es "no_verificable";
//  - pct = completados / programados, entero 0..100 (los dias se deduplican dentro de la rutina, asi que nunca supera 100);
//  - "programados" = cantidad de dias de la rutina ACTUAL: no se reconstruyen prescripciones historicas (si el entrenador cambio la cantidad
//    de dias, las semanas anteriores se comparan contra la cantidad actual; limitacion documentada).
//
// Estados de una semana: "completa" | "parcial" | "pendiente" | "no_verificable".
// Registro de una semana: "con_sesiones" (hay filas validas) | "sin_sesiones_registradas" (historial completo y ninguna fila) |
// "sin_informacion" (historial incompleto y ninguna fila): distingue "no entreno" de "no se puede saber".

import { completedDayIndexesFromRows } from "../manualSessionValidation.js";
import { cicloEfectivoDeSemana, readCicloActual, readCicloBase, rowCiclo } from "../rutinaCiclo.js";
import { isCompletedSession, sessionMatchesRoutine } from "../studentWeeklyProgress.js";
import { readSemanaActiva } from "../rutinaOperationalState.js";
import { createdAtSortKey } from "../routineStore.js";
import { ORIGEN_VALIDADA } from "../metricas/adherencia.js";

export const SEMANAS_RUTINA = 4;
export const ESTADO_SEMANA = { COMPLETA: "completa", PARCIAL: "parcial", PENDIENTE: "pendiente", NO_VERIFICABLE: "no_verificable" };
export const MOMENTO_SEMANA = { PASADA: "pasada", ACTUAL: "actual", FUTURA: "futura", DESCONOCIDO: "desconocido", CERRADA: "cerrada" };
export const REGISTRO_SEMANA = { CON_SESIONES: "con_sesiones", SIN_SESIONES: "sin_sesiones_registradas", SIN_INFORMACION: "sin_informacion" };

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function idTexto(value) {
  if (typeof value === "string") return value !== "" ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function semanaDeFila(row) {
  if (row.semana == null || row.semana === "" || typeof row.semana === "boolean") return null;
  var n = Number(row.semana);
  return Number.isInteger(n) && n >= 1 && n <= SEMANAS_RUTINA ? n : null;
}

function diaDeFila(row, totalDias) {
  if (row.dia_idx == null || row.dia_idx === "" || typeof row.dia_idx === "boolean") return null;
  var n = Number(row.dia_idx);
  return Number.isInteger(n) && n >= 0 && n < totalDias ? n : null;
}

function nuevasExcluidas() {
  return { otroAlumno: 0, otraRutina: 0, sinRutinaAmbigua: 0, noCompletada: 0, semanaInvalida: 0, cicloPosterior: 0, filaInvalida: 0 };
}

/**
 * Filtra las filas de `sesiones` que pueden contar para (alumno, rutina). Devuelve { filas, excluidas } sin mutar nada.
 */
export function filasDeRutina(sesiones, rutina, alumnoId) {
  var excluidas = nuevasExcluidas();
  var filas = [];
  var rid = idTexto(rutina && rutina.id);
  var rnombre = String((rutina && (rutina.nombre || rutina.name)) || "");
  var asignada = createdAtSortKey(rutina && rutina.created_at);
  var cicloActual = readCicloActual(rutina && rutina.datos);
  (Array.isArray(sesiones) ? sesiones : []).forEach(function (s) {
    if (!asObject(s)) { excluidas.filaInvalida++; return; }
    if (idTexto(s.alumno_id) !== alumnoId) { excluidas.otroAlumno++; return; }
    var srid = idTexto(s.rutina_id);
    if (srid != null) {
      if (srid !== rid) { excluidas.otraRutina++; return; }
    } else {
      // Legado sin rutina_id: mismo nombre Y creada despues de la asignacion (ambos timestamps validos). Si no, es ambigua.
      var creada = createdAtSortKey(s.created_at);
      if (!sessionMatchesRoutine(s, rid, rnombre)) { excluidas.otraRutina++; return; }
      if (!Number.isFinite(asignada) || !Number.isFinite(creada) || creada < asignada) { excluidas.sinRutinaAmbigua++; return; }
    }
    if (!isCompletedSession(s)) { excluidas.noCompletada++; return; }
    if (semanaDeFila(s) == null) { excluidas.semanaInvalida++; return; }
    if (rowCiclo(s) > cicloActual) { excluidas.cicloPosterior++; return; }
    filas.push(s);
  });
  return { filas: filas, excluidas: excluidas };
}

/** Rutina con otro ciclo vigente, para reutilizar completedDayIndexesFromRows sobre un ciclo anterior. Copia superficial: no muta. */
function rutinaEnCiclo(rutina, ciclo) {
  return Object.assign({}, rutina, { datos: Object.assign({}, rutina.datos, { ciclo_actual: ciclo }) });
}

/** Conteo de un (ciclo, semana) sobre filas ya filtradas por alumno y rutina. */
function contarIntento(filas, rutina, ciclo, semana, totalDias) {
  var delIntento = filas.filter(function (s) { return rowCiclo(s) === ciclo && semanaDeFila(s) === semana; });
  var completos = completedDayIndexesFromRows(delIntento, rutinaEnCiclo(rutina, ciclo), semana);
  var porDia = {};
  var sinDia = 0;
  delIntento.forEach(function (s) {
    var di = diaDeFila(s, totalDias);
    if (di == null) { sinDia++; return; }
    var validada = s.origen === ORIGEN_VALIDADA;
    porDia[di] = porDia[di] === "realizada" || !validada ? "realizada" : "validada";
  });
  var realizados = 0, validados = 0;
  completos.forEach(function (di) { if (porDia[di] === "validada") validados++; else realizados++; });
  return { filas: delIntento.length, dias: completos, realizados: realizados, validados: validados, sinDia: sinDia };
}

function evaluar(conteo, programados, momento, historialCompleto) {
  var completados = conteo.dias.length;
  var completa = programados > 0 && completados >= programados;
  var estado, motivo = null;
  if (completa) estado = ESTADO_SEMANA.COMPLETA;
  else if (momento === MOMENTO_SEMANA.FUTURA) {
    if (conteo.filas > 0) { estado = ESTADO_SEMANA.NO_VERIFICABLE; motivo = "sesiones_en_semana_futura"; }
    else estado = ESTADO_SEMANA.PENDIENTE;
  } else if (momento === MOMENTO_SEMANA.PASADA) {
    estado = ESTADO_SEMANA.NO_VERIFICABLE;
    motivo = !historialCompleto ? "historial_incompleto" : (conteo.sinDia > 0 ? "sesiones_sin_dia" : "semana_avanzada_sin_evidencia");
  } else if (momento === MOMENTO_SEMANA.DESCONOCIDO) {
    estado = ESTADO_SEMANA.NO_VERIFICABLE;
    motivo = "semana_activa_desconocida";
  } else if (!historialCompleto) {
    estado = ESTADO_SEMANA.NO_VERIFICABLE; motivo = "historial_incompleto";
  } else if (conteo.sinDia > 0) {
    estado = ESTADO_SEMANA.NO_VERIFICABLE; motivo = "sesiones_sin_dia";
  } else if (momento === MOMENTO_SEMANA.CERRADA) {
    estado = ESTADO_SEMANA.PARCIAL; // intento anterior (cerrado por un reinicio): lo que se hizo, sin "pendiente"
  } else {
    estado = completados > 0 ? ESTADO_SEMANA.PARCIAL : ESTADO_SEMANA.PENDIENTE;
  }
  var pct = null;
  if (estado === ESTADO_SEMANA.COMPLETA || estado === ESTADO_SEMANA.PARCIAL ||
      (estado === ESTADO_SEMANA.PENDIENTE && momento === MOMENTO_SEMANA.ACTUAL)) {
    pct = Math.min(100, Math.round((100 * completados) / programados));
  }
  var registro = conteo.filas > 0 ? REGISTRO_SEMANA.CON_SESIONES
    : (historialCompleto ? REGISTRO_SEMANA.SIN_SESIONES : REGISTRO_SEMANA.SIN_INFORMACION);
  return {
    programados: programados,
    completados: completados,
    realizados: conteo.realizados,
    validados: conteo.validados,
    pendientes: Math.max(0, programados - completados),
    pct: pct,
    estado: estado,
    motivo: motivo,
    registro: registro,
    diasCompletados: conteo.dias.slice(),
    sesionesSinDia: conteo.sinDia,
  };
}

function falla(motivo, alumnoId, rutina) {
  return { ok: false, motivo: motivo, alumnoId: alumnoId, rutinaId: idTexto(rutina && rutina.id), semanas: [], intentosAnteriores: [], excluidas: nuevasExcluidas() };
}

/**
 * Cumplimiento de sesiones de la rutina VIGENTE de un alumno, por semana S1..S4 del bloque vigente y por intentos anteriores.
 * @param {object}  p
 * @param {*}       p.alumnoId
 * @param {object}  p.rutina             fila de rutinas (id, nombre, alumno_id?, created_at, datos.days, datos.semana_activa, datos.ciclo_*)
 * @param {Array}   p.sesiones           filas de `sesiones` (pueden ser del roster entero: se filtran)
 * @param {boolean} p.historialCompleto  true SOLO si la lectura de sesiones fue completa (sesionesHistorial / coachHistoryLoader)
 * @returns {{ok, motivo, alumnoId, rutinaId, rutinaNombre, cicloActual, cicloBase, semanaActiva, diasProgramados, historialCompleto,
 *            semanas: Array, intentosAnteriores: Array, excluidas: object}}
 *   semanas: S1..S4 del bloque vigente, cada una con el ciclo de su intento vigente (vigente: true).
 *   intentosAnteriores: (ciclo, semana) con sesiones que NO son el intento vigente (reinicios de semana o bloques anteriores), momento "cerrada".
 */
export function cumplimientoSesiones(p) {
  var o = p || {};
  var alumnoId = idTexto(o.alumnoId);
  var rutina = asObject(o.rutina);
  if (alumnoId == null) return falla("alumno_invalido", null, rutina);
  if (!rutina || idTexto(rutina.id) == null) return falla("sin_rutina", alumnoId, rutina);
  var rutinaAlumno = idTexto(rutina.alumno_id);
  if (rutinaAlumno != null && rutinaAlumno !== alumnoId) return falla("alumno_no_coincide", alumnoId, rutina);
  var datos = asObject(rutina.datos);
  var dias = datos && Array.isArray(datos.days) ? datos.days : null;
  if (!dias || dias.length === 0) return falla("rutina_sin_dias", alumnoId, rutina);

  var programados = dias.length;
  var historialCompleto = o.historialCompleto === true;
  var cicloActual = readCicloActual(datos);
  var cicloBase = readCicloBase(datos);
  var semanaActiva = readSemanaActiva(datos);
  var filtro = filasDeRutina(o.sesiones, rutina, alumnoId);

  var vigentes = {};
  var semanas = [];
  for (var w = 1; w <= SEMANAS_RUTINA; w++) {
    var ciclo = cicloEfectivoDeSemana(datos, w);
    vigentes[ciclo + "|" + w] = true;
    var momento = semanaActiva == null ? MOMENTO_SEMANA.DESCONOCIDO
      : (w < semanaActiva ? MOMENTO_SEMANA.PASADA : (w === semanaActiva ? MOMENTO_SEMANA.ACTUAL : MOMENTO_SEMANA.FUTURA));
    var ev = evaluar(contarIntento(filtro.filas, rutina, ciclo, w, programados), programados, momento, historialCompleto);
    semanas.push(Object.assign({ semana: w, ciclo: ciclo, vigente: true, bloqueVigente: true, momento: momento }, ev));
  }

  var otros = {};
  filtro.filas.forEach(function (s) {
    var k = rowCiclo(s) + "|" + semanaDeFila(s);
    if (!vigentes[k]) otros[k] = { ciclo: rowCiclo(s), semana: semanaDeFila(s) };
  });
  var intentosAnteriores = Object.keys(otros).map(function (k) { return otros[k]; })
    .sort(function (a, b) { return a.ciclo - b.ciclo || a.semana - b.semana; })
    .map(function (it) {
      var ev = evaluar(contarIntento(filtro.filas, rutina, it.ciclo, it.semana, programados), programados, MOMENTO_SEMANA.CERRADA, historialCompleto);
      return Object.assign({ semana: it.semana, ciclo: it.ciclo, vigente: false, bloqueVigente: it.ciclo >= cicloBase, momento: MOMENTO_SEMANA.CERRADA }, ev);
    });

  return {
    ok: true,
    motivo: null,
    alumnoId: alumnoId,
    rutinaId: idTexto(rutina.id),
    rutinaNombre: String(rutina.nombre || rutina.name || ""),
    cicloActual: cicloActual,
    cicloBase: cicloBase,
    semanaActiva: semanaActiva,
    diasProgramados: programados,
    historialCompleto: historialCompleto,
    semanas: semanas,
    intentosAnteriores: intentosAnteriores,
    excluidas: filtro.excluidas,
  };
}
