// Historial de «Volumen por patrón» por RUTINA, CICLO y SEMANA (Progreso del entrenador). Modulo puro: sin React, sin acceso a servicios externos, sin escrituras.
//
// Limite de datos (verificado en lib/coachHistoryLoader.js): `progreso` NO guarda rutina_id (solo alumno_id, ejercicio_id, kg, reps, fecha,
// semana 0-based y ciclo). Solo `sesiones` trae rutina_id, ciclo, semana (1-based), fecha y la lista `ejercicios`. Por eso una serie solo se
// atribuye a una rutina cuando EXISTE EVIDENCIA: una sesion del mismo alumno, misma fecha, misma semana, mismo ciclo, cuya lista de
// ejercicios incluye el ejercicio de la serie y que apunta a UNA sola rutina_id. Si una serie trae rutina_id propio (filas nuevas), ese
// valor manda. Nunca se atribuye por fecha de asignacion, por nombre ni por los ejercicios de la rutina:
//   - sin sesion que la respalde  -> `sinSesion` (no se asigna, se informa);
//   - sesiones de varias rutinas  -> `ambiguas` (no se asigna);
//   - sin semana o fecha validas  -> `sinSemana` (no se reconstruye).
// La formula de volumen y la clasificacion por patron NO se redefinen aca: se usan volumenDeSerie (lib/metricas/volumen.js) y
// buildPatternBreakdown (components/coachProgresoMetrics.js), las mismas de la tarjeta actual.

import { parseFechaDMY } from "./fechas.js";
import { rowCiclo } from "../rutinaCiclo.js";

export const SEMANAS_BLOQUE = 4;

function idTexto(v) {
  return v == null || v === "" ? null : String(v);
}

/** Semana 0-based (0..3) de una fila de `progreso`, o null si no es valida (nunca se interpreta una ausencia como semana 0). */
export function semanaIndiceDeSerie(row) {
  if (!row || row.semana == null || row.semana === "" || typeof row.semana === "boolean") return null;
  var n = Number(row.semana);
  return Number.isInteger(n) && n >= 0 && n < SEMANAS_BLOQUE ? n : null;
}

function clave(dia, semana1, ciclo) {
  return dia + "|" + semana1 + "|" + ciclo;
}

function idsDeSesion(s) {
  var out = {};
  String((s && s.ejercicios) || "")
    .split(",")
    .forEach(function (x) {
      var t = x.trim();
      if (t) out[t] = true;
    });
  return out;
}

/** Sesiones del alumno con rutina_id, semana 1..4 y fecha valida, indexadas por dia|semana|ciclo. */
function indexarSesiones(sesiones, alumnoId) {
  var idx = {};
  (Array.isArray(sesiones) ? sesiones : []).forEach(function (s) {
    if (!s || idTexto(s.alumno_id) !== idTexto(alumnoId)) return;
    var rid = idTexto(s.rutina_id);
    if (!rid) return;
    var w = Number(s.semana);
    if (!Number.isInteger(w) || w < 1 || w > SEMANAS_BLOQUE) return;
    var dia = parseFechaDMY(s.fecha);
    if (dia == null) return;
    var k = clave(dia, w, rowCiclo(s));
    (idx[k] = idx[k] || []).push({ rutinaId: rid, ids: idsDeSesion(s) });
  });
  return idx;
}

/**
 * Atribuye las series de UN alumno a (rutina, ciclo, semana) solo con evidencia.
 * @returns {{ series: Array<{row:object, rutinaId:string, ciclo:number, semana:number}>, sinSesion:number, ambiguas:number, sinSemana:number, ambiguasFilas:object[], noAsignadas:Array<{ciclo:number, semana:number}> }}
 *   semana: 0-based (igual que progreso.semana).
 */
export function atribuirSeriesARutinas(rows, sesiones, alumnoId) {
  var out = { series: [], sinSesion: 0, ambiguas: 0, sinSemana: 0, ambiguasFilas: [], noAsignadas: [] };
  var idx = indexarSesiones(sesiones, alumnoId);
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    if (!row || row.ejercicio_id == null) return;
    if (row.alumno_id != null && row.alumno_id !== "" && idTexto(row.alumno_id) !== idTexto(alumnoId)) return;
    var w = semanaIndiceDeSerie(row);
    var dia = parseFechaDMY(row.fecha);
    if (w == null || dia == null) {
      out.sinSemana++;
      return;
    }
    var ciclo = rowCiclo(row);
    var propio = idTexto(row.rutina_id);
    if (propio) {
      out.series.push({ row: row, rutinaId: propio, ciclo: ciclo, semana: w });
      return;
    }
    var cand = idx[clave(dia, w + 1, ciclo)] || [];
    var ej = String(row.ejercicio_id);
    var rutinas = {};
    var n = 0;
    cand.forEach(function (c) {
      if (c.ids[ej] && !rutinas[c.rutinaId]) {
        rutinas[c.rutinaId] = true;
        n++;
      }
    });
    if (n === 0) {
      out.sinSesion++;
      out.noAsignadas.push({ ciclo: ciclo, semana: w });
    }
    else if (n > 1) {
      out.ambiguas++;
      out.ambiguasFilas.push(row);
      out.noAsignadas.push({ ciclo: ciclo, semana: w });
    }
    else out.series.push({ row: row, rutinaId: Object.keys(rutinas)[0], ciclo: ciclo, semana: w });
  });
  return out;
}

/**
 * Rutinas del alumno que se pueden consultar: la actual (siempre) y las que tienen sesiones o series atribuidas.
 * `rutinas` = SOLO las del alumno (rutinasDeAlumno). Una rutina borrada se lista con el nombre guardado en sus sesiones.
 * Orden: actual primero; luego la actividad mas reciente primero.
 * @returns {Array<{id:string, nombre:string, esActual:boolean, existe:boolean, ciclos:number[], ultimoDia:number|null}>}
 */
export function listarRutinasConHistorial(params) {
  var alumnoId = params.alumnoId;
  var actualId = idTexto(params.rutinaActualId);
  var porId = {};
  function entrada(id) {
    if (!porId[id]) porId[id] = { id: id, nombre: "", esActual: id === actualId, existe: false, ciclos: {}, ultimoDia: null, creada: null };
    return porId[id];
  }
  (params.rutinas || []).forEach(function (r) {
    var id = r && idTexto(r.id);
    if (!id) return;
    var e = entrada(id);
    e.existe = true;
    e.nombre = String(r.nombre || r.name || "");
    e.creada = r.created_at || null;
  });
  (Array.isArray(params.sesiones) ? params.sesiones : []).forEach(function (s) {
    if (!s || idTexto(s.alumno_id) !== idTexto(alumnoId)) return;
    var id = idTexto(s.rutina_id);
    if (!id) return;
    var dia = parseFechaDMY(s.fecha);
    var e = entrada(id);
    if (!e.nombre && s.rutina_nombre) e.nombre = String(s.rutina_nombre);
    e.ciclos[rowCiclo(s)] = true;
    if (dia != null && (e.ultimoDia == null || dia > e.ultimoDia)) e.ultimoDia = dia;
  });
  (params.series || []).forEach(function (a) {
    entrada(a.rutinaId).ciclos[a.ciclo] = true;
  });
  var lista = Object.keys(porId).map(function (id) {
    var e = porId[id];
    return { id: e.id, nombre: e.nombre, esActual: e.esActual, existe: e.existe, ciclos: Object.keys(e.ciclos).map(Number).sort(function (a, b) { return a - b; }), ultimoDia: e.ultimoDia, creada: e.creada };
  });
  // Solo la actual, o rutinas con alguna evidencia de actividad (sesion o serie). Una rutina asignada sin actividad no aporta historial.
  lista = lista.filter(function (e) { return e.esActual || e.ciclos.length > 0; });
  lista.sort(function (a, b) {
    if (a.esActual !== b.esActual) return a.esActual ? -1 : 1;
    var ua = a.ultimoDia == null ? -Infinity : a.ultimoDia;
    var ub = b.ultimoDia == null ? -Infinity : b.ultimoDia;
    if (ua !== ub) return ub - ua;
    return String(a.id) < String(b.id) ? -1 : 1;
  });
  return lista;
}

/** Series atribuidas a exactamente (rutina, ciclo, semana 0-based). */
export function seriesDeRutinaCicloSemana(series, rutinaId, ciclo, semana) {
  var rid = idTexto(rutinaId);
  return (series || []).filter(function (a) {
    return a.rutinaId === rid && a.ciclo === ciclo && a.semana === semana;
  });
}

/** Sesiones del alumno de (rutina, ciclo, semana 1-based) por rutina_id exacto. */
export function contarSesiones(sesiones, alumnoId, rutinaId, ciclo, semana1) {
  var rid = idTexto(rutinaId);
  var n = 0;
  (Array.isArray(sesiones) ? sesiones : []).forEach(function (s) {
    if (!s || idTexto(s.alumno_id) !== idTexto(alumnoId)) return;
    if (idTexto(s.rutina_id) !== rid) return;
    if (rowCiclo(s) !== ciclo) return;
    if (Number(s.semana) === semana1) n++;
  });
  return n;
}

/**
 * Series con semana y ciclo validos que NO se pudieron asignar a ninguna rutina (sin sesion que las respalde o respaldadas por
 * sesiones de varias rutinas), de un (ciclo, semana 0-based). Ciclo y semana no identifican la rutina: pueden ser de la elegida o de otra,
 * por eso el total de esa semana NO esta confirmado. Se informa, nunca se suma.
 */
export function contarNoAsignadas(noAsignadas, ciclo, semana) {
  var n = 0;
  (noAsignadas || []).forEach(function (a) {
    if (a && a.ciclo === ciclo && a.semana === semana) n++;
  });
  return n;
}
