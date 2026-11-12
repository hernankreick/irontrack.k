// Comparacion PRESCRITO vs EJECUTADO por sesion (PR-B: modulo puro, todavia SIN conectar a la app ni a la interfaz).
//
// Pregunta que responde: "para ESTA sesion, hay evidencia suficiente para comparar lo que se pidio con lo que se hizo?" y, solo si la hay,
// "que se cumplio, variable por variable?". Si no hay evidencia, lo dice con un estado y un motivo; nunca rellena, infiere ni "arregla".
//
// ENTRADA (todo explicito; el modulo no lee rutinas, ni la red, ni el almacenamiento, ni el reloj):
//   compararPrescripcionEjecucion({ sesion, copias, series, contexto })
//   - sesion   fila de `sesiones`: { id, alumno_id, rutina_id, ciclo, semana (1..4), dia_idx, fecha "d/m/aaaa",
//              completada === true | estado "completada"|"finalizada", origen? }.
//              Sin evidencia EXPLICITA de finalizacion no se compara (la ausencia de las columnas NO se toma como "completa").
//   - copias   filas de la copia historica (lib/prescripcionSnapshot.js): { alumno_id, rutina_id, ciclo, semana, dia_idx, fecha_dia,
//              prescripcion_hash, snapshot, sesion_id?, origen_lectura: "servidor"|"cache" }. Se filtran por la clave de la sesion.
//              NUNCA se recibe ni se usa la rutina actual: la prescripcion historica sale solo de la copia.
//   - series   filas de `progreso` con vinculo EXPLICITO: { id?, sesion_id, bloque ("warmup"|"main"), pos, ejercicio_id, alumno_id,
//              rutina_id?, ciclo?, semana (base segun contexto.semanaBaseSeries, por defecto 0), fecha, dia_idx?, kg, reps }.
//              Una serie solo se asocia a un ejercicio por (sesion_id, bloque, pos); ejercicio_id solo se usa para CONTROLAR que el
//              vinculo sea coherente con la copia, nunca para asociar.
//   - contexto { semanaBaseSeries?: 0|1 (defecto 0: progreso.semana es base 0 y sesiones.semana base 1),
//                registroSeriesCompleto?: true  (evidencia de que TODAS las series de la sesion estan registradas y sincronizadas),
//                planificacionMostradaHash?: "sha256:..." (huella de la planificacion que vio el alumno al iniciar) }
//
// ESTADOS de la comparacion (campo `estado`; `motivos` lista TODOS los problemas detectados, `estado` es el de mayor prioridad):
//   verificable           hay evidencia suficiente: copia unica e integra, del servidor, que coincide con lo mostrado, sesion finalizada,
//                         identidad/semana/dia/fecha coherentes y series vinculadas sin ambiguedad.
//   sin_copia             no hay copia utilizable (inexistente, sin clave, corrupta o que no corresponde a la sesion).
//   ambigua               varias copias con huellas distintas, o la planificacion mostrada difiere de la copia del servidor.
//   copia_cache           la copia no esta confirmada como leida del servidor / capturada de datos del servidor / coincidente con lo mostrado.
//   sin_finalizar         la sesion no tiene evidencia de finalizacion real (pendiente, sin marca, o validada manualmente sin ejecucion).
//   semana_inconsistente  la semana de la sesion, de la copia, de lo mostrado o de las series (tras ajustar la base) no coincide.
//   series_sin_vinculo    hay series que podrian ser de la sesion pero no tienen vinculo (sesion_id/bloque/pos) o su vinculo es incoherente.
//   no_comparable         (SOLO por variable, nunca global) la variable concreta no se puede comparar; ver `motivo`.
//
// SALIDA: ver `resultadoBase()` y `compararEjercicio()` (estructura documentada abajo). Si `estado !== "verificable"`, `ejercicios` y
// `resumen` son null: no se devuelve ninguna comparacion parcial. Los porcentajes del resumen son null (con motivo) si algun denominador
// no es valido; nunca se calculan sobre datos insuficientes.
//
// Modulo puro: sin React, sin Supabase, sin red, sin almacenamiento, sin reloj. Nunca muta sus entradas.

import {
  FUENTE_CAPTURA,
  PRESCRIPCION_SNAPSHOT_VERSION,
  ESTADO_COPIA,
  claveDeSesion,
  claveDeCopia,
  estadoCopiaDeSesion,
  fechaSesionADia,
  huellaPrescripcion,
} from "./prescripcionSnapshot.js";
import { rowCiclo } from "./rutinaCiclo.js";
import { validarKgEntrada } from "./cargaSerie.js";

export const COMPARACION_VERSION = 1;

export const ESTADO_COMPARACION = {
  VERIFICABLE: "verificable",
  SIN_COPIA: "sin_copia",
  AMBIGUA: "ambigua",
  COPIA_CACHE: "copia_cache",
  SIN_FINALIZAR: "sin_finalizar",
  SERIES_SIN_VINCULO: "series_sin_vinculo",
  SEMANA_INCONSISTENTE: "semana_inconsistente",
  NO_COMPARABLE: "no_comparable",
};

// Prioridad al elegir el estado global entre los problemas detectados (primero el mas fundamental).
var PRIORIDAD = [
  ESTADO_COMPARACION.SIN_COPIA,
  ESTADO_COMPARACION.AMBIGUA,
  ESTADO_COMPARACION.COPIA_CACHE,
  ESTADO_COMPARACION.SIN_FINALIZAR,
  ESTADO_COMPARACION.SEMANA_INCONSISTENTE,
  ESTADO_COMPARACION.SERIES_SIN_VINCULO,
];

export const TIPO_VALOR = {
  NUMERO: "numero",
  RANGO: "rango",
  TIEMPO: "tiempo",
  DISTANCIA: "distancia",
  PESO_CORPORAL: "peso_corporal",
  TEXTO: "texto",
  VACIO: "vacio",
};

export const RESULTADO = {
  CUMPLE: "cumple",
  POR_ENCIMA: "por_encima",
  POR_DEBAJO: "por_debajo",
  MIXTO: "mixto",
  NO_COMPARABLE: "no_comparable",
};

var BLOQUES = ["warmup", "main"];
var ORIGEN_VALIDADA = "validada_coach"; // mismo valor que lib/metricas/adherencia.js (no se importa para no acoplar)
var ORIGENES_CACHE_OK = "servidor";

// ---------------------------------------------------------------- utilidades

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function idTexto(value) {
  if (typeof value === "string") return value !== "" ? value : null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function entero(value) {
  var n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) ? n : null;
}

function semanaRango(n) {
  return n != null && n >= 1 && n <= 4 ? n : null;
}

function problema(estado, motivo, detalle) {
  var p = { estado: estado, motivo: motivo };
  if (detalle !== undefined) p.detalle = detalle;
  return p;
}

// ---------------------------------------------------------------- interpretacion de valores

var NUM = "(\\d+(?:[.,]\\d+)?)";
var RE_NUMERO = new RegExp("^" + NUM + "$");
var RE_RANGO = new RegExp("^" + NUM + "\\s*(?:-|–|—)\\s*" + NUM + "$");
var RE_TIEMPO = new RegExp("^" + NUM + "\\s*(?:s|seg|segs|sec|segundos?|\"|'')$", "i");
var RE_TIEMPO_RANGO = new RegExp("^" + NUM + "\\s*(?:-|–|—)\\s*" + NUM + "\\s*(?:s|seg|segs|sec|segundos?)$", "i");
var RE_MINUTOS = new RegExp("^" + NUM + "\\s*(?:min|mins|minutos?)$", "i");
var RE_RELOJ = /^(\d{1,2}):([0-5]\d)$/;
var RE_DISTANCIA = new RegExp("^" + NUM + "\\s*(m|mt|mts|metros?|km)$", "i");
var RE_PESO_CORPORAL = /^(?:pc|bw|peso\s+corporal|bodyweight|body\s*weight|sin\s+(?:carga|peso))$/i;

function num(s) {
  return Number(String(s).replace(",", "."));
}

/**
 * Interpreta el TEXTO de una prescripcion ("8-10", "45s", "400 m", "PC", "", "AMRAP", "70%").
 * Devuelve { tipo, texto, ...valores }:
 *   numero {valor} | rango {min,max} | tiempo {min,max,unidad:"s"} | distancia {valor, unidad:"m"} | peso_corporal | texto | vacio.
 * Lo que no se reconoce con certeza es "texto" (no comparable); no se adivina ("70%" o "+10kg" no son un kg comparable).
 */
export function interpretarPrescripcion(valor) {
  var raw = valor === undefined || valor === null ? "" : String(valor);
  var t = raw.trim();
  if (t === "") return { tipo: TIPO_VALOR.VACIO, texto: raw };
  var m;
  if (RE_NUMERO.test(t)) return { tipo: TIPO_VALOR.NUMERO, texto: raw, valor: num(t) };
  if ((m = RE_RANGO.exec(t))) {
    var a = num(m[1]), b = num(m[2]);
    return a <= b ? { tipo: TIPO_VALOR.RANGO, texto: raw, min: a, max: b } : { tipo: TIPO_VALOR.TEXTO, texto: raw };
  }
  if ((m = RE_TIEMPO_RANGO.exec(t))) {
    var ta = num(m[1]), tb = num(m[2]);
    return ta <= tb ? { tipo: TIPO_VALOR.TIEMPO, texto: raw, min: ta, max: tb, unidad: "s" } : { tipo: TIPO_VALOR.TEXTO, texto: raw };
  }
  if ((m = RE_TIEMPO.exec(t))) { var s = num(m[1]); return { tipo: TIPO_VALOR.TIEMPO, texto: raw, min: s, max: s, unidad: "s" }; }
  if ((m = RE_MINUTOS.exec(t))) { var sm = num(m[1]) * 60; return { tipo: TIPO_VALOR.TIEMPO, texto: raw, min: sm, max: sm, unidad: "s" }; }
  if ((m = RE_RELOJ.exec(t))) { var sr = Number(m[1]) * 60 + Number(m[2]); return { tipo: TIPO_VALOR.TIEMPO, texto: raw, min: sr, max: sr, unidad: "s" }; }
  if ((m = RE_DISTANCIA.exec(t))) {
    var d = num(m[1]) * (m[2].toLowerCase() === "km" ? 1000 : 1);
    return { tipo: TIPO_VALOR.DISTANCIA, texto: raw, valor: d, unidad: "m" };
  }
  if (RE_PESO_CORPORAL.test(t)) return { tipo: TIPO_VALOR.PESO_CORPORAL, texto: raw };
  return { tipo: TIPO_VALOR.TEXTO, texto: raw };
}

// ---------------------------------------------------------------- copia: seleccion, integridad, coherencia

function evaluarCopia(sesion, claveSesion, copias, contexto, problemas) {
  var out = { estado: null, copia: null, snapshot: null, hash: null };
  if (!claveSesion) {
    problemas.push(problema(ESTADO_COMPARACION.SIN_COPIA, "sesion_sin_clave", "faltan alumno, rutina, semana 1..4, dia o fecha validos en la sesion"));
    out.estado = ESTADO_COPIA.SIN_COPIA;
    return out;
  }
  var sesionId = idTexto(sesion.id);
  var todas = Array.isArray(copias) ? copias : [];
  // Una copia con sesion_id de OTRA sesion no es de esta (misma clave, otro entrenamiento): se descarta. Sin sesion_id => por clave.
  var candidatas = todas.filter(function (row) {
    var r = asObject(row);
    if (!r) return false;
    var sid = idTexto(r.sesion_id);
    return sid == null || sesionId == null || sid === sesionId;
  });
  var est = estadoCopiaDeSesion(candidatas, claveSesion);
  out.estado = est.estado;
  if (est.estado === ESTADO_COPIA.SIN_COPIA) {
    problemas.push(problema(ESTADO_COMPARACION.SIN_COPIA, "sin_copia_para_la_sesion"));
    return out;
  }
  if (est.estado === ESTADO_COPIA.AMBIGUA) {
    problemas.push(problema(ESTADO_COMPARACION.AMBIGUA, "copias_con_huellas_distintas", "no se elige ninguna"));
    return out;
  }
  var mismas = candidatas.filter(function (row) {
    var k = claveDeCopia(row);
    return k && k.texto === claveSesion.texto;
  });
  var copia = est.copia;
  out.copia = copia;

  // Integridad de TODAS las filas de la huella unica (duplicadas identicas): el snapshot guardado debe producir la huella guardada.
  var integra = mismas.every(function (row) {
    var snap = asObject(row.snapshot);
    return !!snap && snap.v === PRESCRIPCION_SNAPSHOT_VERSION && Array.isArray(snap.ejercicios) && huellaPrescripcion(snap) === row.prescripcion_hash;
  });
  if (!integra) {
    problemas.push(problema(ESTADO_COMPARACION.SIN_COPIA, "copia_no_integra", "la huella no coincide con el contenido, o version de copia desconocida"));
    return out;
  }
  var snapshot = asObject(copia.snapshot);
  out.snapshot = snapshot;
  out.hash = copia.prescripcion_hash;

  // La prescripcion debe corresponder a la sesion: el contenido de la copia (no solo sus columnas) coincide con la clave.
  var rutinaSnap = asObject(snapshot.rutina) || {};
  var diaSnap = asObject(snapshot.dia) || {};
  var desajustes = [];
  if (idTexto(rutinaSnap.id) !== claveSesion.rutina_id) desajustes.push("rutina");
  if (rowCiclo({ ciclo: rutinaSnap.ciclo }) !== claveSesion.ciclo || rutinaSnap.ciclo == null) desajustes.push("ciclo");
  if (entero(diaSnap.idx) !== claveSesion.dia_idx) desajustes.push("dia");
  if (desajustes.length) {
    problemas.push(problema(ESTADO_COMPARACION.SIN_COPIA, "copia_no_corresponde_a_la_sesion", desajustes));
    return out;
  }
  if (entero(snapshot.semana) !== claveSesion.semana) {
    problemas.push(problema(ESTADO_COMPARACION.SEMANA_INCONSISTENTE, "semana_de_la_copia_distinta", { sesion: claveSesion.semana, copia: snapshot.semana }));
  }

  // Fuente confirmada: captura desde datos del servidor Y lectura desde el servidor (no cache/localStorage).
  var captura = asObject(snapshot.captura) || {};
  if (captura.fuente !== FUENTE_CAPTURA.DATOS_SERVIDOR) {
    problemas.push(problema(ESTADO_COMPARACION.COPIA_CACHE, "fuente_de_captura_no_confirmada", captura.fuente === undefined ? null : captura.fuente));
  }
  if (copia.origen_lectura === "cache") {
    problemas.push(problema(ESTADO_COMPARACION.COPIA_CACHE, "copia_leida_de_cache"));
  } else if (copia.origen_lectura !== ORIGENES_CACHE_OK) {
    problemas.push(problema(ESTADO_COMPARACION.COPIA_CACHE, "origen_de_lectura_no_confirmado", copia.origen_lectura === undefined ? null : copia.origen_lectura));
  }

  // Coincidencia con lo que se le mostro al alumno: semana mostrada Y huella de la planificacion mostrada.
  var mostrada = entero(snapshot.semana_mostrada);
  if (mostrada == null) {
    problemas.push(problema(ESTADO_COMPARACION.COPIA_CACHE, "semana_mostrada_no_confirmada"));
  } else if (mostrada !== claveSesion.semana) {
    problemas.push(problema(ESTADO_COMPARACION.SEMANA_INCONSISTENTE, "semana_mostrada_distinta", { mostrada: mostrada, sesion: claveSesion.semana }));
  }
  var hashMostrada = contexto.planificacionMostradaHash;
  if (typeof hashMostrada !== "string" || hashMostrada === "") {
    problemas.push(problema(ESTADO_COMPARACION.COPIA_CACHE, "planificacion_mostrada_no_confirmada"));
  } else if (hashMostrada !== copia.prescripcion_hash) {
    problemas.push(problema(ESTADO_COMPARACION.AMBIGUA, "planificacion_mostrada_distinta_de_la_del_servidor"));
  }
  return out;
}

// ---------------------------------------------------------------- series: clasificacion y vinculo

function claveFechaSerie(fecha) {
  // Las series pueden traer "d/m/aaaa" o "aaaa-mm-dd" (ya normalizada). Cualquier otro formato => null (no se adivina).
  if (typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    var ok = fechaSesionADia(Number(fecha.slice(8)) + "/" + Number(fecha.slice(5, 7)) + "/" + fecha.slice(0, 4));
    return ok === fecha ? ok : null;
  }
  return fechaSesionADia(fecha);
}

/**
 * Clasifica las series recibidas respecto de la sesion:
 *   vinculadas   sesion_id propio y coherentes en alumno/rutina/ciclo/semana/fecha/dia/bloque/pos/ejercicio (si hay copia).
 *   excluidas    con evidencia clara de ser de otra cosa (otra sesion/alumno/rutina/ciclo/semana/fecha/dia): no cuentan y se informan.
 *   sinVinculo   podrian ser de la sesion (todo lo que se puede comprobar coincide) pero no tienen vinculo => bloquea la comparacion.
 *   incoherentes dicen ser de la sesion pero se contradicen con ella o con la copia => bloquea la comparacion.
 */
function clasificarSeries(sesion, claveSesion, snapshot, series, base, problemas) {
  var res = {
    recibidas: 0,
    vinculadas: [],
    excluidas: { otra_sesion: 0, otro_alumno: 0, otra_rutina: 0, otro_ciclo: 0, otra_semana: 0, otra_fecha: 0, otro_dia: 0, fila_invalida: 0, duplicada: 0 },
    sin_vinculo: 0,
    incoherentes: 0,
  };
  var lista = Array.isArray(series) ? series : [];
  res.recibidas = lista.length;
  if (!claveSesion) return res;
  var sesionId = idTexto(sesion.id);
  var entradas = {};
  if (snapshot && Array.isArray(snapshot.ejercicios)) {
    snapshot.ejercicios.forEach(function (e) { entradas[e.bloque + "#" + e.pos] = e; });
  }
  var vistos = {};
  var semanaInconsistente = 0;
  var ejemplosSinVinculo = [];

  lista.forEach(function (row) {
    var s = asObject(row);
    if (!s) { res.excluidas.fila_invalida++; return; }
    var id = idTexto(s.id);
    if (id != null) {
      if (vistos[id]) { res.excluidas.duplicada++; return; }
      vistos[id] = true;
    }
    var sid = idTexto(s.sesion_id);
    var vinculada = sid != null && sesionId != null && sid === sesionId;
    if (sid != null && !vinculada) { res.excluidas.otra_sesion++; return; }

    // Comprobaciones de identidad (comunes a vinculadas y sin vinculo). null = no se puede comprobar.
    var alumno = idTexto(s.alumno_id);
    var rutina = idTexto(s.rutina_id);
    var semana = entero(s.semana);
    var fecha = claveFechaSerie(s.fecha);
    var dia = s.dia_idx === undefined || s.dia_idx === null || s.dia_idx === "" ? null : entero(s.dia_idx);
    var distinto = null; // motivo de exclusion cuando hay evidencia de que es de otra cosa
    if (alumno != null && alumno !== claveSesion.alumno_id) distinto = "otro_alumno";
    else if (rutina != null && rutina !== claveSesion.rutina_id) distinto = "otra_rutina";
    else if (rowCiclo(s) !== claveSesion.ciclo) distinto = "otro_ciclo";
    else if (semana != null && semana + (base === 0 ? 1 : 0) !== claveSesion.semana) distinto = "otra_semana";
    else if (fecha != null && fecha !== claveSesion.fecha_dia) distinto = "otra_fecha";
    else if (dia != null && dia !== claveSesion.dia_idx) distinto = "otro_dia";

    if (vinculada) {
      // Dice ser de ESTA sesion: cualquier contradiccion invalida el vinculo (no se descarta en silencio).
      if (alumno == null) { res.incoherentes++; return; }
      if (distinto === "otra_semana") { semanaInconsistente++; res.incoherentes++; return; }
      if (distinto || semana == null || fecha == null) { res.incoherentes++; return; }
      var bloque = s.bloque;
      var pos = s.pos === "" || s.pos == null ? null : entero(s.pos);
      var entrada = BLOQUES.indexOf(bloque) !== -1 && pos != null && pos >= 0 ? entradas[bloque + "#" + pos] : null;
      if (!entrada || idTexto(s.ejercicio_id) == null || idTexto(s.ejercicio_id) !== idTexto(entrada.id)) { res.incoherentes++; return; }
      res.vinculadas.push({ serie: s, bloque: bloque, pos: pos });
      return;
    }
    // Sin sesion_id.
    if (distinto) { res.excluidas[distinto]++; return; }
    res.sin_vinculo++;
    if (ejemplosSinVinculo.length < 5) ejemplosSinVinculo.push(id);
  });

  if (semanaInconsistente > 0) {
    problemas.push(problema(ESTADO_COMPARACION.SEMANA_INCONSISTENTE, "semana_de_las_series_distinta", { series: semanaInconsistente, base_semana_series: base }));
  }
  if (res.sin_vinculo > 0) {
    problemas.push(problema(ESTADO_COMPARACION.SERIES_SIN_VINCULO, "series_sin_sesion_bloque_posicion", { series: res.sin_vinculo }));
  }
  var otras = res.incoherentes - semanaInconsistente;
  if (otras > 0) {
    problemas.push(problema(ESTADO_COMPARACION.SERIES_SIN_VINCULO, "vinculo_de_series_incoherente", { series: otras }));
  }
  return res;
}

// ---------------------------------------------------------------- comparacion por variable

function variableNoComparable(prescrito, motivo, ejecutado) {
  return { estado: ESTADO_COMPARACION.NO_COMPARABLE, motivo: motivo, prescrito: prescrito, ejecutado: ejecutado, resultado: RESULTADO.NO_COMPARABLE };
}

function variableComparable(prescrito, ejecutado, resultado, extra) {
  return Object.assign({ estado: "comparable", motivo: null, prescrito: prescrito, ejecutado: ejecutado, resultado: resultado }, extra || {});
}

function posicionEnObjetivo(valor, obj) {
  // obj: numero {valor} | rango/tiempo {min,max}
  var min = obj.tipo === TIPO_VALOR.NUMERO ? obj.valor : obj.min;
  var max = obj.tipo === TIPO_VALOR.NUMERO ? obj.valor : obj.max;
  if (valor < min) return RESULTADO.POR_DEBAJO;
  if (valor > max) return RESULTADO.POR_ENCIMA;
  return RESULTADO.CUMPLE;
}

function agregar(resultados) {
  var unicos = {};
  resultados.forEach(function (r) { unicos[r] = true; });
  var claves = Object.keys(unicos);
  return claves.length === 1 ? claves[0] : RESULTADO.MIXTO;
}

/** Series: cuantas series se registraron frente a las prescritas. Una faltante solo es "omitida" con registro completo demostrado. */
function compararSeries(prescrito, cantidad, registroCompleto) {
  var ejecutado = { cantidad: cantidad, registro_completo: registroCompleto };
  var tipo = prescrito.tipo;
  if (tipo !== TIPO_VALOR.NUMERO && tipo !== TIPO_VALOR.RANGO) {
    return variableNoComparable(prescrito, tipo === TIPO_VALOR.VACIO ? "prescripcion_vacia" : "prescripcion_no_numerica", ejecutado);
  }
  var min = tipo === TIPO_VALOR.NUMERO ? prescrito.valor : prescrito.min;
  var max = tipo === TIPO_VALOR.NUMERO ? prescrito.valor : prescrito.max;
  if (cantidad > max) return variableComparable(prescrito, ejecutado, RESULTADO.POR_ENCIMA);
  if (cantidad >= min) return variableComparable(prescrito, ejecutado, RESULTADO.CUMPLE);
  if (!registroCompleto) {
    // Menos series registradas que las pedidas, pero sin evidencia de que el registro este completo: NO es "omitida".
    return variableNoComparable(prescrito, "faltantes_sin_evidencia_de_registro_completo", Object.assign({ minimo_registrado: cantidad }, ejecutado));
  }
  return variableComparable(prescrito, ejecutado, RESULTADO.POR_DEBAJO, { omitidas: min - cantidad });
}

/** Repeticiones (o segundos en ejercicios por tiempo): valor por serie frente al objetivo (numero, rango o tiempo). */
function compararReps(prescrito, seriesEj) {
  var tipo = prescrito.tipo;
  if (tipo === TIPO_VALOR.VACIO) return variableNoComparable(prescrito, "prescripcion_vacia", null);
  if (tipo === TIPO_VALOR.TEXTO) return variableNoComparable(prescrito, "prescripcion_texto", null);
  if (tipo === TIPO_VALOR.DISTANCIA) return variableNoComparable(prescrito, "distancia_sin_unidad_registrada", null);
  if (tipo === TIPO_VALOR.PESO_CORPORAL) return variableNoComparable(prescrito, "prescripcion_no_numerica", null);
  if (!seriesEj.length) return variableNoComparable(prescrito, "sin_series_ejecutadas", null);
  // Las series por tiempo guardan los segundos en `reps` (convencion de lib/cargaSerie.js: "repeticiones (o segundos en ejercicios por tiempo)").
  var valores = [];
  for (var i = 0; i < seriesEj.length; i++) {
    var raw = seriesEj[i].reps;
    var n = typeof raw === "number" ? raw : typeof raw === "string" && /^\s*\d+\s*$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isInteger(n) || n < 1) return variableNoComparable(prescrito, "valor_ejecutado_invalido", { series: seriesEj.length });
    valores.push(n);
  }
  var porSerie = valores.map(function (v) { return posicionEnObjetivo(v, prescrito); });
  return variableComparable(prescrito, { valores: valores, unidad: tipo === TIPO_VALOR.TIEMPO ? "s" : "reps" }, agregar(porSerie), { por_serie: porSerie });
}

/** Carga (kg): valor por serie frente al objetivo numerico o rango. Texto, % y vacio no son comparables; peso corporal solo con kg 0. */
function compararKg(prescrito, seriesEj) {
  var tipo = prescrito.tipo;
  if (tipo === TIPO_VALOR.VACIO) return variableNoComparable(prescrito, "prescripcion_vacia", null);
  if (tipo === TIPO_VALOR.TEXTO) return variableNoComparable(prescrito, "prescripcion_texto", null);
  if (tipo === TIPO_VALOR.TIEMPO || tipo === TIPO_VALOR.DISTANCIA) return variableNoComparable(prescrito, "prescripcion_no_numerica", null);
  if (!seriesEj.length) return variableNoComparable(prescrito, "sin_series_ejecutadas", null);
  var valores = [];
  for (var i = 0; i < seriesEj.length; i++) {
    var v = validarKgEntrada(seriesEj[i].kg);
    if (!v.ok || seriesEj[i].kg === null || seriesEj[i].kg === undefined) return variableNoComparable(prescrito, "valor_ejecutado_invalido", { series: seriesEj.length });
    valores.push(v.kg);
  }
  if (tipo === TIPO_VALOR.PESO_CORPORAL) {
    if (valores.some(function (v) { return v > 0; })) return variableNoComparable(prescrito, "peso_corporal_con_carga_ejecutada", { valores: valores, unidad: "kg" });
    return variableComparable(prescrito, { valores: valores, unidad: "kg" }, RESULTADO.CUMPLE, { por_serie: valores.map(function () { return RESULTADO.CUMPLE; }) });
  }
  // kg vacio se guarda como 0 (lib/cargaSerie.js): contra una carga prescrita no se puede saber si fue 0 kg o "no cargado".
  if (valores.some(function (v) { return v === 0; })) return variableNoComparable(prescrito, "kg_ejecutado_vacio_o_cero", { valores: valores, unidad: "kg" });
  var porSerie = valores.map(function (v) { return posicionEnObjetivo(v, prescrito); });
  return variableComparable(prescrito, { valores: valores, unidad: "kg" }, agregar(porSerie), { por_serie: porSerie });
}

function compararEjercicio(entrada, seriesEj, registroCompleto) {
  var reps = compararReps(interpretarPrescripcion(entrada.reps), seriesEj);
  var kg = compararKg(interpretarPrescripcion(entrada.kg), seriesEj);
  var sets = compararSeries(interpretarPrescripcion(entrada.sets), seriesEj.length, registroCompleto);
  var hayComparable = [sets, reps, kg].some(function (v) { return v.estado === "comparable"; });
  return {
    orden: entrada.orden,
    bloque: entrada.bloque,
    pos: entrada.pos,
    ejercicio_id: entrada.id,
    nombre: entrada.nombre,
    estado: hayComparable ? ESTADO_COMPARACION.VERIFICABLE : ESTADO_COMPARACION.NO_COMPARABLE,
    series_registradas: seriesEj.length,
    variables: { series: sets, reps: reps, kg: kg },
  };
}

// ---------------------------------------------------------------- resumen (sin porcentajes sobre denominadores invalidos)

function resumir(ejercicios) {
  var out = { ejercicios_total: ejercicios.length, ejercicios_verificables: 0, ejercicios_no_comparables: 0, variables: {}, porcentajes: {} };
  ejercicios.forEach(function (e) { if (e.estado === ESTADO_COMPARACION.VERIFICABLE) out.ejercicios_verificables++; else out.ejercicios_no_comparables++; });
  ["series", "reps", "kg"].forEach(function (nombre) {
    var c = { total: ejercicios.length, comparables: 0, no_comparables: 0, cumplen: 0, por_debajo: 0, por_encima: 0, mixtos: 0 };
    ejercicios.forEach(function (e) {
      var v = e.variables[nombre];
      if (v.estado !== "comparable") { c.no_comparables++; return; }
      c.comparables++;
      if (v.resultado === RESULTADO.CUMPLE) c.cumplen++;
      else if (v.resultado === RESULTADO.POR_ENCIMA) c.por_encima++;
      else if (v.resultado === RESULTADO.POR_DEBAJO) c.por_debajo++;
      else c.mixtos++;
    });
    out.variables[nombre] = c;
    // Porcentaje de ejercicios que alcanzaron lo prescrito (cumple o por encima). Solo si TODOS los ejercicios tienen la variable
    // comparable: un solo no_comparable invalida el denominador y el porcentaje no se calcula (null + motivo), nunca se redondea "a favor".
    if (c.total === 0) out.porcentajes[nombre] = { valor: null, motivo: "sin_ejercicios" };
    else if (c.no_comparables > 0) out.porcentajes[nombre] = { valor: null, motivo: "denominador_invalido", no_comparables: c.no_comparables };
    else out.porcentajes[nombre] = { valor: Math.round(((c.cumplen + c.por_encima) / c.total) * 100), motivo: null };
  });
  return out;
}

// ---------------------------------------------------------------- evidencia de finalizacion

function evaluarFinalizacion(sesion, problemas) {
  if (sesion.origen === ORIGEN_VALIDADA) {
    problemas.push(problema(ESTADO_COMPARACION.SIN_FINALIZAR, "validada_manual_sin_ejecucion", "una validacion del entrenador no trae series ejecutadas"));
    return false;
  }
  if (sesion.estado === "pendiente" || sesion.completada === false) {
    problemas.push(problema(ESTADO_COMPARACION.SIN_FINALIZAR, "sesion_pendiente"));
    return false;
  }
  var ok = sesion.completada === true || sesion.estado === "completada" || sesion.estado === "finalizada";
  if (!ok) {
    problemas.push(problema(ESTADO_COMPARACION.SIN_FINALIZAR, "sin_evidencia_de_finalizacion", "la sesion no trae completada=true ni estado completada/finalizada"));
    return false;
  }
  return true;
}

// ---------------------------------------------------------------- API

function resultadoBase() {
  return {
    v: COMPARACION_VERSION,
    estado: ESTADO_COMPARACION.SIN_COPIA,
    verificable: false,
    motivos: [],
    sesion: null,
    copia: null,
    series: null,
    ejercicios: null,
    resumen: null,
  };
}

/**
 * Compara la prescripcion historica de UNA sesion con las series ejecutadas.
 * @returns {{
 *   v: number,
 *   estado: string,            // ESTADO_COMPARACION (global, nunca "no_comparable")
 *   verificable: boolean,
 *   motivos: Array<{estado, motivo, detalle?}>,   // todos los problemas, en orden de deteccion
 *   sesion: {id, clave}|null,
 *   copia: {estado, hash, capturada_en, momento}|null,
 *   series: {recibidas, vinculadas, excluidas:{...}, sin_vinculo, incoherentes}|null,
 *   ejercicios: Array<{orden, bloque, pos, ejercicio_id, nombre, estado:"verificable"|"no_comparable", series_registradas,
 *               variables:{series, reps, kg}}>|null,   // cada variable: {estado:"comparable"|"no_comparable", motivo, prescrito, ejecutado, resultado, ...}
 *   resumen: {ejercicios_total, ejercicios_verificables, ejercicios_no_comparables, variables, porcentajes}|null
 * }}
 */
export function compararPrescripcionEjecucion(params) {
  var p = asObject(params) || {};
  var out = resultadoBase();
  var sesion = asObject(p.sesion);
  var contexto = asObject(p.contexto) || {};
  if (!sesion) {
    out.motivos.push(problema(ESTADO_COMPARACION.SIN_COPIA, "sesion_invalida"));
    return out;
  }
  var base = contexto.semanaBaseSeries === 1 ? 1 : 0;
  var registroCompleto = contexto.registroSeriesCompleto === true;
  var clave = claveDeSesion(sesion);
  var problemas = [];
  out.sesion = { id: idTexto(sesion.id), clave: clave ? clave.texto : null };

  var copia = evaluarCopia(sesion, clave, p.copias, contexto, problemas);
  evaluarFinalizacion(sesion, problemas);
  if (idTexto(sesion.id) == null) {
    problemas.push(problema(ESTADO_COMPARACION.SERIES_SIN_VINCULO, "sesion_sin_id", "sin id de sesion no hay vinculo posible"));
  }
  out.series = clasificarSeries(sesion, clave, copia.snapshot, p.series, base, problemas);
  out.copia = copia.snapshot
    ? { estado: copia.estado, hash: copia.hash, capturada_en: copia.snapshot.capturada_en == null ? null : copia.snapshot.capturada_en, momento: asObject(copia.snapshot.captura) ? copia.snapshot.captura.momento : null }
    : { estado: copia.estado, hash: null, capturada_en: null, momento: null };
  // Serializable y sin referencias a las entradas (series.vinculadas se expone solo como cantidad).
  var vinculadas = out.series.vinculadas;
  out.series = Object.assign({}, out.series, { vinculadas: vinculadas.length });

  out.motivos = problemas;
  if (problemas.length) {
    var primero = PRIORIDAD.find(function (e) { return problemas.some(function (x) { return x.estado === e; }); });
    out.estado = primero;
    return out;
  }

  var porPosicion = {};
  vinculadas.forEach(function (v) {
    var k = v.bloque + "#" + v.pos;
    (porPosicion[k] = porPosicion[k] || []).push(v.serie);
  });
  out.ejercicios = copia.snapshot.ejercicios.map(function (entrada) {
    return compararEjercicio(entrada, porPosicion[entrada.bloque + "#" + entrada.pos] || [], registroCompleto);
  });
  out.resumen = resumir(out.ejercicios);
  out.estado = ESTADO_COMPARACION.VERIFICABLE;
  out.verificable = true;
  return out;
}
