// Prescrito vs. ejecutado: ORQUESTACION y RESUMEN por sesion, semana y ciclo (modulo puro, todavia SIN conectar a la interfaz ni al guardado).
//
// Une lo que ya existe sin reinterpretarlo:
//   - vinculo serie -> sesion SOLO por sesion_uid explicito y unico (lib/serieIdentidad.js: vincularSeriesConSesiones),
//   - comparacion de UNA sesion con su copia historica (lib/prescripcionComparacion.js: compararPrescripcionEjecucion),
// y agrega los resultados por semana/ciclo con ESTADOS EXPLICITOS: una sesion sin copia, sin finalizar, con series sin vinculo, etc. se cuenta
// como "sin datos para comparar" con su motivo; nunca se rellena, se infiere ni se compara con la rutina ACTUAL (la unica prescripcion que
// se usa es la copia capturada al iniciar ESA sesion; si no existe, la sesion queda sin_copia).
//
// ENTRADA  compararSesionesDelAlumno({ sesiones, copias, series, contexto })
//   sesiones  filas de `sesiones` del alumno (con sesion_uid/identidad_v si la migracion esta aplicada).
//   copias    filas de la copia historica (lib/prescripcionSnapshot.js) leidas del SERVIDOR: { ..., origen_lectura: "servidor" }.
//   series    filas de `progreso` del alumno (con sesion_uid/bloque/pos si la migracion esta aplicada; si no, no hay vinculo posible).
//   contexto  { semanaBaseSeries?, registroSeriesCompleto? (evidencia explicita de que TODAS las series estan sincronizadas),
//               planificacionMostradaHash?: string | (sesion) => string (huella de lo mostrado al iniciar) }
//
// EVIDENCIA DE FINALIZACION: la unica fila que escribe identidad en `sesiones` es el cierre de sesion (finalizeStudentSession -> addSesion con
// proyectarPayloadSesion). Por eso una fila con sesion_uid UUID v4 + identidad_v 1 y origen distinto de "validada_coach" es evidencia POSITIVA de
// finalizacion y se marca completada=true (marca registrada en `evidencia_finalizacion`). Una fila sin esa identidad (historica) NO se marca:
// queda sin_finalizar. Si la fila ya trae completada/estado explicitos, se respetan tal cual.
//
// Modulo puro: sin React, sin Supabase, sin red, sin almacenamiento, sin reloj. No muta sus entradas.
import { compararPrescripcionEjecucion, claveFechaSerie, ESTADO_COMPARACION, RESULTADO } from "./prescripcionComparacion.js";
import { claveDeSesion } from "./prescripcionSnapshot.js";
import { vincularSeriesConSesiones } from "./serieIdentidad.js";
import { esUuidV4 } from "./sessionIdentity.js";
import { rowCiclo } from "./rutinaCiclo.js";

export const RESUMEN_VERSION = 1;
export const EVIDENCIA_FINALIZACION = { IDENTIDAD_V1: "identidad_v1", EXPLICITA: "explicita", NINGUNA: "ninguna" };

var ORIGEN_VALIDADA = "validada_coach";
var VARIABLES = ["series", "reps", "kg"];

function asObject(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : null; }

/** Devuelve { sesion, evidencia }: copia de la fila con completada=true SOLO si hay evidencia positiva de finalizacion (ver cabecera). */
export function sesionConEvidenciaDeFinalizacion(row) {
  var s = asObject(row);
  if (!s) return { sesion: row, evidencia: EVIDENCIA_FINALIZACION.NINGUNA };
  if (s.completada === true || s.completada === false || typeof s.estado === "string") return { sesion: s, evidencia: EVIDENCIA_FINALIZACION.EXPLICITA };
  var uid = typeof s.sesion_uid === "string" ? s.sesion_uid.toLowerCase() : "";
  if (esUuidV4(uid) && s.identidad_v === 1 && s.origen !== ORIGEN_VALIDADA) {
    return { sesion: Object.assign({}, s, { completada: true }), evidencia: EVIDENCIA_FINALIZACION.IDENTIDAD_V1 };
  }
  return { sesion: s, evidencia: EVIDENCIA_FINALIZACION.NINGUNA };
}

function contarEstado(mapa, clave) { mapa[clave] = (mapa[clave] || 0) + 1; }

function acumuladorVacio() {
  var a = {
    sesiones_total: 0,
    sesiones_verificables: 0,
    sesiones_sin_datos: 0,
    por_estado: {},
    motivos_sin_datos: {},
    ejercicios: { prescritos: 0, verificables: 0, no_comparables: 0, completos: 0, parciales: 0, omitidos: 0, sin_evidencia_de_omision: 0 },
    series: { prescritas_minimo: 0, ejecutadas: 0, ejercicios_contados: 0, ejercicios_sin_dato: 0 },
    variables: {},
  };
  VARIABLES.forEach(function (n) { a.variables[n] = { comparables: 0, no_comparables: 0, cumplen: 0, por_encima: 0, por_debajo: 0, mixtos: 0 }; });
  return a;
}

function sumarSesion(acc, cmp) {
  acc.sesiones_total++;
  contarEstado(acc.por_estado, cmp.estado);
  if (!cmp.verificable) {
    acc.sesiones_sin_datos++;
    (cmp.motivos || []).forEach(function (m) { contarEstado(acc.motivos_sin_datos, m.estado + ":" + m.motivo); });
    return;
  }
  acc.sesiones_verificables++;
  cmp.ejercicios.forEach(function (e) {
    acc.ejercicios.prescritos++;
    if (e.estado === ESTADO_COMPARACION.VERIFICABLE) acc.ejercicios.verificables++; else acc.ejercicios.no_comparables++;
    VARIABLES.forEach(function (n) {
      var v = e.variables[n], c = acc.variables[n];
      if (v.estado !== "comparable") { c.no_comparables++; return; }
      c.comparables++;
      if (v.resultado === RESULTADO.CUMPLE) c.cumplen++;
      else if (v.resultado === RESULTADO.POR_ENCIMA) c.por_encima++;
      else if (v.resultado === RESULTADO.POR_DEBAJO) c.por_debajo++;
      else c.mixtos++;
    });
    var vs = e.variables.series;
    if (vs.estado === "comparable") {
      acc.series.ejercicios_contados++;
      acc.series.ejecutadas += vs.ejecutado.cantidad;
      acc.series.prescritas_minimo += vs.prescrito.tipo === "numero" ? vs.prescrito.valor : vs.prescrito.min;
      if (vs.resultado === RESULTADO.POR_DEBAJO) { if (vs.ejecutado.cantidad === 0) acc.ejercicios.omitidos++; else acc.ejercicios.parciales++; }
      else acc.ejercicios.completos++;
    } else {
      acc.series.ejercicios_sin_dato++;
      // Faltaban series pero sin evidencia de registro completo: NO se afirma que se omitio (puede ser un registro sin sincronizar).
      if (vs.motivo === "faltantes_sin_evidencia_de_registro_completo") acc.ejercicios.sin_evidencia_de_omision++;
    }
  });
}

/** Porcentaje solo si es calculable: >= 1 sesion verificable y NINGUN no comparable en la variable; si no, { valor: null, motivo }. */
function porcentajes(acc) {
  var out = {};
  VARIABLES.forEach(function (n) {
    var c = acc.variables[n], total = c.comparables + c.no_comparables;
    if (acc.sesiones_verificables === 0) out[n] = { valor: null, motivo: "sin_sesiones_verificables" };
    else if (c.no_comparables > 0) out[n] = { valor: null, motivo: "variable_no_comparable_en_algun_ejercicio", no_comparables: c.no_comparables };
    else out[n] = { valor: Math.round(((c.cumplen + c.por_encima) / total) * 100), motivo: null };
  });
  // Cobertura: que parte de las sesiones tiene evidencia suficiente. NO es adherencia al plan (sesiones planificadas vs hechas: lib/metricas/adherencia.js).
  out.cobertura_sesiones = acc.sesiones_total === 0 ? { valor: null, motivo: "sin_sesiones" } : { valor: Math.round((acc.sesiones_verificables / acc.sesiones_total) * 100), motivo: null };
  return out;
}

function cerrar(acc) { return Object.assign({}, acc, { porcentajes: porcentajes(acc), estado: acc.sesiones_total === 0 ? "sin_sesiones" : acc.sesiones_sin_datos === 0 ? "completo" : acc.sesiones_verificables === 0 ? "sin_datos_para_comparar" : "parcial" }); }

/**
 * Compara todas las sesiones dadas y las agrega por (ciclo, semana).
 * @returns {{ v, sesiones: Array<{sesion_id, sesion_uid, ciclo, semana, dia_idx, fecha, evidencia_finalizacion, comparacion}>,
 *             semanas: Array<{ciclo, semana, ...resumen}>, global: resumen,
 *             vinculo: {uid_ambiguos: string[], series_recibidas, series_vinculadas, series_sin_sesion} }}
 *  resumen.estado: "completo" (todas verificables) | "parcial" | "sin_datos_para_comparar" | "sin_sesiones".
 */
export function compararSesionesDelAlumno(params) {
  var p = asObject(params) || {};
  var sesionesIn = Array.isArray(p.sesiones) ? p.sesiones : [];
  var copias = Array.isArray(p.copias) ? p.copias : [];
  var seriesIn = Array.isArray(p.series) ? p.series : [];
  var contexto = asObject(p.contexto) || {};

  var enlazado = vincularSeriesConSesiones(seriesIn, sesionesIn);
  var porSesion = {};
  enlazado.series.forEach(function (se) {
    if (se && se.sesion_id != null) (porSesion[String(se.sesion_id)] = porSesion[String(se.sesion_id)] || []).push(se);
  });
  var vinculadas = enlazado.series.filter(function (se) { return se && se.sesion_id != null; }).length;
  // Series SIN vinculo (historicas, uid ambiguo o sin sesion registrada) se entregan a CADA comparacion: el modulo decide por fecha/semana/dia si
  // podrian ser de esa sesion y, de ser asi, marca series_sin_vinculo. Omitirlas haria que una sesion cuyas series no se pudieron vincular pareciera
  // "sin series ejecutadas" (todo omitido). Las vinculadas a OTRA sesion no se pasan.
  var sinVinculo = enlazado.series.filter(function (se) { return !se || se.sesion_id == null; });
  // RENDIMIENTO: cada comparacion descartaria por fecha las series de otros dias (otra_fecha), asi que se agrupan por fecha normalizada y cada sesion recibe
  // solo las de SU fecha mas las de fecha ilegible (que el modulo trata como candidatas). Mismo resultado, sin el producto sesiones x series
  // (400 sesiones x 8000 series pasaron de ~2,3 s a milisegundos; en un iPhone el producto bloqueaba la pantalla).
  var porFecha = {}, sinFechaLegible = [];
  sinVinculo.forEach(function (se) {
    var f = se && typeof se === "object" ? claveFechaSerie(se.fecha) : null;
    if (f == null) sinFechaLegible.push(se); else (porFecha[f] = porFecha[f] || []).push(se);
  });

  var global = acumuladorVacio(), porSemana = {}, detalle = [];
  function candidatasSinVinculo(sesion) {
    var k = claveDeSesion(sesion);
    return k ? (porFecha[k.fecha_dia] || []).concat(sinFechaLegible) : [];
  }
  sesionesIn.forEach(function (row) {
    var ev = sesionConEvidenciaDeFinalizacion(row);
    var s = ev.sesion;
    var id = s && s.id != null ? String(s.id) : null;
    var ctx = Object.assign({}, contexto);
    if (typeof contexto.planificacionMostradaHash === "function") ctx.planificacionMostradaHash = contexto.planificacionMostradaHash(s);
    var cmp = compararPrescripcionEjecucion({ sesion: s, copias: copias, series: (id != null ? porSesion[id] || [] : []).concat(candidatasSinVinculo(s)), contexto: ctx });
    var ciclo = rowCiclo(s || {}), semana = s && Number.isInteger(Number(s.semana)) ? Number(s.semana) : null;
    detalle.push({ sesion_id: id, sesion_uid: s && typeof s.sesion_uid === "string" ? s.sesion_uid : null, ciclo: ciclo, semana: semana, dia_idx: s && s.dia_idx != null ? s.dia_idx : null,
      fecha: s && s.fecha != null ? s.fecha : null, evidencia_finalizacion: ev.evidencia, comparacion: cmp });
    var k = ciclo + ":" + semana;
    var acc = porSemana[k] || (porSemana[k] = Object.assign(acumuladorVacio(), { _ciclo: ciclo, _semana: semana }));
    sumarSesion(acc, cmp); sumarSesion(global, cmp);
  });

  var semanas = Object.keys(porSemana).map(function (k) {
    var a = porSemana[k]; var ciclo = a._ciclo, semana = a._semana; delete a._ciclo; delete a._semana;
    return Object.assign({ ciclo: ciclo, semana: semana }, cerrar(a));
  }).sort(function (a, b) { return a.ciclo - b.ciclo || (a.semana == null ? 99 : a.semana) - (b.semana == null ? 99 : b.semana); });

  return {
    v: RESUMEN_VERSION,
    sesiones: detalle,
    semanas: semanas,
    global: cerrar(global),
    vinculo: { uid_ambiguos: enlazado.ambiguos, series_recibidas: seriesIn.length, series_vinculadas: vinculadas, series_sin_sesion: seriesIn.length - vinculadas },
  };
}
