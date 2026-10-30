// Volumen de entrenamiento: UNA definicion para todas las estadisticas del entrenador.
//
//   volumen de una serie = kg x reps, solo si kg > 0, reps > 0, fecha valida (d/m/yyyy) y el ejercicio NO es por tiempo.
//
// - Una fila de `progreso` = una serie real: no se deduplica ni se promedia.
// - Incluye ejercicios personalizados (custom_*) y el lastre en ejercicios de peso corporal; unilaterales tal como se registran (sin x2).
// - Excluye ejercicios por tiempo (reps = segundos) y series sin carga (kg = 0).
// - No filtra rutina ni ciclo: el volumen de un periodo de calendario es lo que el alumno realmente entreno (historial completo).
// Modulo puro.

import { parseFechaDMY, enRango, lunesDe } from "./fechas.js";
import { tipoDeCarga, TIPO_CARGA } from "./tipoCarga.js";

/** Volumen (kg) de una fila de progreso, o 0 si no aporta. */
export function volumenDeSerie(row, indiceTiempo) {
  if (!row) return 0;
  if (parseFechaDMY(row.fecha) == null) return 0;
  var kg = parseFloat(row.kg);
  var reps = parseInt(row.reps, 10);
  if (!(kg > 0) || !(reps > 0)) return 0;
  if (tipoDeCarga(row.ejercicio_id, indiceTiempo) === TIPO_CARGA.TIEMPO) return 0;
  return kg * reps;
}

/**
 * Volumen agregado en [desde, hasta] (numeros de dia, inclusivos; null = sin limite).
 * Devuelve { total, porEjercicio: {id: kg}, porDia: {dia: kg}, dias: [dias con volumen, asc], series: n }.
 */
export function volumenEnRango(rows, opts) {
  var o = opts || {};
  var out = { total: 0, porEjercicio: {}, porDia: {}, dias: [], series: 0 };
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var dia = row ? parseFechaDMY(row.fecha) : null;
    if (!enRango(dia, o.desde, o.hasta)) return;
    var v = volumenDeSerie(row, o.indiceTiempo);
    if (!(v > 0)) return;
    var id = String(row.ejercicio_id);
    out.total += v;
    out.series += 1;
    out.porEjercicio[id] = (out.porEjercicio[id] || 0) + v;
    out.porDia[dia] = (out.porDia[dia] || 0) + v;
  });
  out.dias = Object.keys(out.porDia).map(Number).sort(function (a, b) { return a - b; });
  return out;
}

/** Volumen por semana de calendario (lunes-domingo): [{ lunes, kg }] desde la semana de `desde` hasta la de `hasta`, sin huecos. */
export function volumenPorSemana(rows, opts) {
  var o = opts || {};
  var r = volumenEnRango(rows, o);
  var lunes = lunesDe;
  var porLunes = {};
  Object.keys(r.porDia).forEach(function (d) { var l = lunes(Number(d)); porLunes[l] = (porLunes[l] || 0) + r.porDia[d]; });
  if (o.desde == null || o.hasta == null) {
    return Object.keys(porLunes).map(Number).sort(function (a, b) { return a - b; }).map(function (l) { return { lunes: l, kg: porLunes[l] }; });
  }
  var out = [];
  for (var l = lunes(o.desde); l <= lunes(o.hasta); l += 7) out.push({ lunes: l, kg: porLunes[l] || 0 });
  return out;
}

export const MIN_DIAS_POR_PERIODO = 2;

/**
 * Comparacion de volumen entre dos periodos de calendario ("like-for-like").
 *  actual / previo: { desde, hasta } (numeros de dia). Usa TODO el historial de las filas recibidas (sin filtrar ciclo ni rutina).
 * Solo cuentan los ejercicios con volumen > 0 en AMBOS periodos. El porcentaje se informa solo si cada periodo tiene al menos
 * MIN_DIAS_POR_PERIODO dias con volumen comparable; si no, pct = null y `motivo` explica por que.
 * Devuelve { actualTotal, previoTotal, actualComparable, previoComparable, ejerciciosComunes, pct, motivo }.
 */
export function compararVolumen(rows, actual, previo, opts) {
  var o = opts || {};
  var a = volumenEnRango(rows, { desde: actual.desde, hasta: actual.hasta, indiceTiempo: o.indiceTiempo });
  var p = volumenEnRango(rows, { desde: previo.desde, hasta: previo.hasta, indiceTiempo: o.indiceTiempo });
  var comunes = Object.keys(a.porEjercicio).filter(function (id) { return (p.porEjercicio[id] || 0) > 0; }).sort();
  var setComunes = {};
  comunes.forEach(function (id) { setComunes[id] = true; });
  var filasComunes = (Array.isArray(rows) ? rows : []).filter(function (row) { return row && setComunes[String(row.ejercicio_id)]; });
  var ac = volumenEnRango(filasComunes, { desde: actual.desde, hasta: actual.hasta, indiceTiempo: o.indiceTiempo });
  var pc = volumenEnRango(filasComunes, { desde: previo.desde, hasta: previo.hasta, indiceTiempo: o.indiceTiempo });
  var motivo = null;
  if (!comunes.length) motivo = "sin_ejercicios_comunes";
  else if (pc.dias.length < MIN_DIAS_POR_PERIODO) motivo = "previo_con_pocos_dias";
  else if (ac.dias.length < MIN_DIAS_POR_PERIODO) motivo = "actual_con_pocos_dias";
  return {
    actualTotal: a.total,
    previoTotal: p.total,
    actualComparable: ac.total,
    previoComparable: pc.total,
    ejerciciosComunes: comunes,
    pct: motivo ? null : ((ac.total - pc.total) / pc.total) * 100,
    motivo: motivo,
  };
}
