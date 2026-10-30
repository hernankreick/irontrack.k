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
// Modulo puro.

import { parseFechaDMY, enRango } from "./fechas.js";
import { tipoDeCarga, TIPO_CARGA } from "./tipoCarga.js";

function serieDeCarga(row, indiceTiempo) {
  if (!row || row.ejercicio_id == null) return null;
  var dia = parseFechaDMY(row.fecha);
  if (dia == null) return null;
  var kg = parseFloat(row.kg);
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
    if (!b || s.kg > b.kg || (s.kg === b.kg && s.reps > b.reps)) porDia[s.dia] = { kg: s.kg, reps: s.reps };
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
      if (record != null && m.kg > record) {
        eventos.push({ ejercicio_id: id, dia: dia, kg: m.kg, reps: m.reps, kgAnterior: record, diferencia: Math.round((m.kg - record) * 100) / 100 });
      }
      if (record == null || m.kg > record) record = m.kg;
    });
  });
  return eventos.sort(function (a, b) { return b.dia - a.dia || (a.ejercicio_id < b.ejercicio_id ? -1 : a.ejercicio_id > b.ejercicio_id ? 1 : 0); });
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
      if (!b || m.kg > b.kg || (m.kg === b.kg && m.reps > b.reps)) out[id] = { kg: m.kg, reps: m.reps, dia: dia };
    });
  });
  return out;
}
