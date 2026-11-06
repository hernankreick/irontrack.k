// Records personales (PR): UNA definicion para todas las estadisticas del entrenador.
//
//   Record de carga de un ejercicio = mayor kg de sus series validas (kg > 0, reps > 0, fecha d/m/yyyy, ejercicio NO por tiempo) en TODO
//   el historial (todas las rutinas y ciclos; nada lo resetea).
//   Evento PR = un DIA en que la mejor serie del ejercicio supera ESTRICTAMENTE el record previo a ese dia.
//    - el primer registro de un ejercicio es "primera marca", no PR;
//    - igualar el record no es PR;
//    - como maximo un PR por ejercicio y dia (varias series ascendentes el mismo dia = un solo PR, con la mejor);
//    - las repeticiones no intervienen (100 kg x 1 y despues 90 kg x 10 no es PR). No se calcula 1RM estimado.
// Sin ventanas ni recortes: siempre sobre el historial completo recibido (ver lib/coachHistoryLoader.js).
// D7.4: es la UNICA regla de PR de la app (entrenador, alumno, historial, resumen de sesion e indicadores durante el entrenamiento).
//   - kg con coma o punto decimal ("82,5" = 82.5); la comparacion tolera el error de coma flotante (milesimas).
//   - mismo dia: no hay orden confiable entre series de distintas fuentes, asi que el dia cuenta una vez (su mejor serie). Durante el
//     entrenamiento en vivo el orden real es el de registro: clasificarCarga compara contra el record vigente en ese momento.
// Modulo puro.

import { parseFechaDMY, enRango } from "./fechas.js";
import { tipoDeCarga, TIPO_CARGA } from "./tipoCarga.js";

/** kg de una serie: numero, o texto con punto o coma decimal ("82,5"). NaN si no es valido. */
export function kgDeSerie(value) {
  // D7.6: un kg infinito ("Infinity", "1e999") no es una carga: NaN, asi no genera record ni PR.
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (value == null) return NaN;
  var str = String(value).trim();
  if (/^-?\d+,\d+$/.test(str)) str = str.replace(",", ".");
  var n = parseFloat(str);
  return Number.isFinite(n) ? n : NaN;
}

/** Igualdad / orden de cargas en milesimas (82.5 vs 82.50000001). */
function compararKg(a, b) {
  var d = Math.round((a - b) * 1000);
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}

/**
 * Clasifica una carga contra el record PREVIO del ejercicio (misma regla que eventosPR):
 *   "primera" = no habia record (marca inicial, no es PR) · "pr" = lo supera · "iguala" = mismo kg (no es PR) · null = menor o invalida.
 */
export function clasificarCarga(recordKg, kg) {
  var k = kgDeSerie(kg);
  if (!(k > 0)) return null;
  var r = kgDeSerie(recordKg);
  if (!(r > 0)) return "primera";
  var c = compararKg(k, r);
  return c > 0 ? "pr" : c === 0 ? "iguala" : null;
}

/** ¿La carga es un PR nuevo (supera estrictamente un record previo existente)? */
export function esPRNuevo(recordKg, kg) {
  return clasificarCarga(recordKg, kg) === "pr";
}

/**
 * Filas de progreso a partir del estado local del alumno: progress = { ejercicio_id: { sets: [{ kg, reps, date }] } }.
 * Para combinar con filas de Supabase usar la misma forma { ejercicio_id, fecha, kg, reps }.
 */
export function filasDesdeProgress(progress) {
  var out = [];
  Object.keys(progress && typeof progress === "object" ? progress : {}).forEach(function (id) {
    var sets = progress[id] && Array.isArray(progress[id].sets) ? progress[id].sets : [];
    sets.forEach(function (s) {
      if (s) out.push({ ejercicio_id: id, fecha: s.date != null ? s.date : s.fecha, kg: s.kg, reps: s.reps });
    });
  });
  return out;
}

function serieDeCarga(row, indiceTiempo) {
  if (!row || row.ejercicio_id == null) return null;
  var dia = parseFechaDMY(row.fecha);
  if (dia == null) return null;
  var kg = kgDeSerie(row.kg);
  var reps = parseInt(row.reps, 10);
  if (!(kg > 0) || !(reps > 0)) return null;
  if (tipoDeCarga(row.ejercicio_id, indiceTiempo) === TIPO_CARGA.TIEMPO) return null;
  return { id: String(row.ejercicio_id), dia: dia, kg: kg, reps: reps };
}

/** Mejor serie por ejercicio y dia: { id: { dia: { kg, reps } } } (a igual kg, la de mas reps). */
function mejoresPorDia(rows, indiceTiempo) {
  var out = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var s = serieDeCarga(row, indiceTiempo);
    if (!s) return;
    var porDia = (out[s.id] = out[s.id] || {});
    var b = porDia[s.dia];
    var c = b ? compararKg(s.kg, b.kg) : 1;
    if (!b || c > 0 || (c === 0 && s.reps > b.reps)) porDia[s.dia] = { kg: s.kg, reps: s.reps };
  });
  return out;
}

/**
 * Eventos de PR de UN alumno (sus filas de progreso), del mas reciente al mas antiguo.
 * [{ ejercicio_id, dia, kg, reps, kgAnterior, diferencia }]. Las primeras marcas no son eventos.
 */
export function eventosPR(rows, opts) {
  var o = opts || {};
  var porEjercicio = mejoresPorDia(rows, o.indiceTiempo);
  var eventos = [];
  Object.keys(porEjercicio).forEach(function (id) {
    var dias = Object.keys(porEjercicio[id]).map(Number).sort(function (a, b) { return a - b; });
    var record = null;
    dias.forEach(function (dia) {
      var m = porEjercicio[id][dia];
      if (record != null && compararKg(m.kg, record) > 0) {
        eventos.push({ ejercicio_id: id, dia: dia, kg: m.kg, reps: m.reps, kgAnterior: record, diferencia: Math.round((m.kg - record) * 100) / 100 });
      }
      if (record == null || compararKg(m.kg, record) > 0) record = m.kg;
    });
  });
  return eventos.sort(function (a, b) { return b.dia - a.dia || (a.ejercicio_id < b.ejercicio_id ? -1 : a.ejercicio_id > b.ejercicio_id ? 1 : 0); });
}

/**
 * Historial de UN ejercicio dia por dia (mismas series validas y misma definicion que eventosPR), del mas antiguo al mas reciente:
 * [{ dia, kg, reps, recordPrevio, clase }] con la mejor serie de cada dia y su clase respecto del record ANTERIOR a ese dia:
 *   "primera" = primer registro (base, no es PR) · "pr" = supera el record (es un evento de eventosPR) · "iguala" = mismo kg que el
 *   record (no es PR) · null = por debajo. Los ejercicios por tiempo y las series invalidas no aparecen.
 */
export function historialPorDia(rows, ejercicioId, opts) {
  var o = opts || {};
  var id = String(ejercicioId);
  var propias = (Array.isArray(rows) ? rows : []).filter(function (r) { return r && String(r.ejercicio_id) === id; });
  var porDia = mejoresPorDia(propias, o.indiceTiempo)[id] || {};
  var record = null;
  return Object.keys(porDia).map(Number).sort(function (a, b) { return a - b; }).map(function (dia) {
    var m = porDia[dia];
    var clase = clasificarCarga(record, m.kg);
    var out = { dia: dia, kg: m.kg, reps: m.reps, recordPrevio: record, clase: clase };
    if (record == null || compararKg(m.kg, record) > 0) record = m.kg;
    return out;
  });
}

/** Cantidad de eventos de PR en [desde, hasta] (numeros de dia inclusivos). */
export function contarPRs(eventos, desde, hasta) {
  return (Array.isArray(eventos) ? eventos : []).filter(function (e) { return enRango(e.dia, desde, hasta); }).length;
}

/**
 * Mejor marca vigente por ejercicio: { id: { kg, reps, dia } } (primer dia en que se alcanzo ese kg; a igual kg, mas reps).
 * Es el "record" que se muestra; coincide con el kg del ultimo evento PR (o con la primera marca si nunca se supero).
 */
export function mejoresMarcas(rows, opts) {
  var o = opts || {};
  var porEjercicio = mejoresPorDia(rows, o.indiceTiempo);
  var out = {};
  Object.keys(porEjercicio).forEach(function (id) {
    Object.keys(porEjercicio[id]).map(Number).sort(function (a, b) { return a - b; }).forEach(function (dia) {
      var m = porEjercicio[id][dia];
      var b = out[id];
      var c = b ? compararKg(m.kg, b.kg) : 1;
      if (!b || c > 0 || (c === 0 && m.reps > b.reps)) out[id] = { kg: m.kg, reps: m.reps, dia: dia };
    });
  });
  return out;
}

/** Record (kg) de UN ejercicio en el historial recibido, o 0 si no hay series validas. */
export function recordDe(rows, ejercicioId, opts) {
  var id = String(ejercicioId);
  var m = mejoresMarcas((Array.isArray(rows) ? rows : []).filter(function (r) { return r && String(r.ejercicio_id) === id; }), opts)[id];
  return m ? m.kg : 0;
}
