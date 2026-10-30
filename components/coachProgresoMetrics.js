/**
 * Métricas agregadas para la vista Progreso del entrenador (datos reales).
 * Fuentes: alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, catálogo allEx.
 * Volumen, PR y adherencia salen del núcleo único lib/metricas/ (E1); este módulo solo arma el modelo de la vista.
 */

import { FALLBACK_EXERCISE_NAME } from "../lib/exerciseResolve.js";
import { selectCurrentRoutine } from "../lib/routineStore.js";
import { filaActivaEnBloque, readCicloActual, rowInCiclo } from "../lib/rutinaCiclo.js";
import { irontrackMsg as M, pickExerciseName } from "../lib/irontrackMsg.js";
import {
  adherencia,
  compararVolumen,
  contarPRs,
  diaDeSesion,
  diaLocal,
  enRango,
  eventosPR,
  historialPorDia,
  indiceEjerciciosPorTiempo,
  ORIGEN_VALIDADA,
  parseFechaDMY,
  tipoDeCarga,
  TIPO_CARGA,
  volumenDeSerie,
  volumenEnRango,
} from "../lib/metricas/index.js";
import { isCompletedSession } from "../lib/studentWeeklyProgress.js";

const DAY_MS = 86400000;
/** Máximo de PRs en «PRs recientes». Único punto de verdad: lo usan el modelo y la vista. */
export const RECENT_PRS_LIMIT = 5;
const PALETTE = ["#22c55e", "#f59e0b", "#3b82f6", "#a78bfa", "#ec4899", "#14b8a6", "#eab308", "#64748b"];

/**
 * Patrones de movimiento reales (campo `pattern` en ejercicios / allEx).
 * Orden fijo para la card del entrenador.
 */
var MOVEMENT_PATTERN_DEF = [
  { key: "empuje", labelEs: "EMPUJE", labelEn: "PUSH", color: "#a78bfa" },
  { key: "traccion", labelEs: "TRACCION", labelEn: "PULL", color: "#22c55e" },
  { key: "rodilla", labelEs: "RODILLA DOMINANTE", labelEn: "KNEE-DOMINANT", color: "#3b82f6" },
  { key: "bisagra", labelEs: "BISAGRA", labelEn: "HINGE", color: "#f59e0b" },
  { key: "core", labelEs: "CORE", labelEn: "CORE", color: "#eab308" },
];

function periodDurationDays(periodId) {
  if (periodId === "semanas4") return 28;
  if (periodId === "semanas8") return 56;
  if (periodId === "meses3") return 90;
  return 28;
}

/**
 * Período actual y anterior en números de día de calendario local (lib/metricas/fechas.js), extremos inclusivos.
 * actual = los últimos durDays días hasta hoy; previo = los durDays días inmediatamente anteriores.
 * @returns {{ actual:{desde:number,hasta:number}, previo:{desde:number,hasta:number}, durDays:number, hoy:number }}
 */
export function getPeriodDays(periodId, hoy) {
  var durDays = periodDurationDays(periodId);
  var h = hoy != null ? hoy : diaLocal();
  return {
    actual: { desde: h - durDays + 1, hasta: h },
    previo: { desde: h - 2 * durDays + 1, hasta: h - durDays },
    durDays: durDays,
    hoy: h,
  };
}

export function parseProgresoDate(str) {
  if (str == null || str === "") return null;
  var s = String(str).trim();
  if (s.indexOf("/") >= 0) {
    var p = s.split("/");
    if (p.length >= 3) {
      var d = parseInt(p[0], 10);
      var m = parseInt(p[1], 10) - 1;
      var y = parseInt(p[2].slice(0, 4), 10);
      var dt = new Date(y, m, d);
      return isNaN(dt.getTime()) ? null : dt;
    }
  }
  var d2 = new Date(s.slice(0, 10));
  return isNaN(d2.getTime()) ? null : d2;
}

function parseSessionDate(s) {
  if (!s) return null;
  var raw = s.created_at || s.fecha || "";
  if (!raw) return null;
  var d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function startOfWeekMon(d) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var day = x.getDay();
  var diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

function weekKeyMon(d) {
  var st = startOfWeekMon(d);
  return st.getTime();
}

export function initialsFromName(name, email) {
  var n = String(name || email || "").trim();
  if (!n) return "?";
  var parts = n.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase().slice(0, 2);
  }
  return n.slice(0, 2).toUpperCase();
}

function pctColor(p) {
  if (p >= 70) return "#22c55e";
  if (p >= 30) return "#eab308";
  return "#ef4444";
}

function exName(exMap, ejId, lang) {
  var e = exMap[ejId];
  if (e && (e.name || e.nameEn)) return pickExerciseName(e, lang) || (e.nameEn || e.name);
  return FALLBACK_EXERCISE_NAME[lang === "es" ? "es" : "en"];
}

/**
 * Normaliza el valor real de `ex.pattern` al key canónico de MOVEMENT_PATTERN_DEF.
 * Solo estos 5 patrones; el resto (cardio, movilidad, vacío…) no entra en la card.
 */
export function patternToMovementKey(pat) {
  var raw = String(pat || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (raw === "empuje") return "empuje";
  if (raw === "traccion" || raw === "tiron") return "traccion";
  if (raw === "rodilla") return "rodilla";
  if (raw === "bisagra") return "bisagra";
  if (raw === "core" || raw === "abs") return "core";
  return null;
}

/**
 * `progreso.semana` es 0-based (0..3, ver lib/orphanSessions.js). Devuelve ese índice si la fila lo trae válido, o null
 * (sin columna, vacío o fuera de rango) para repartir por fecha. Nunca interpreta una ausencia como semana 0.
 */
export function progressRowWeekIndex(row, weeks) {
  if (!row || row.semana == null || row.semana === "") return null;
  var n = Number(row.semana);
  if (!Number.isInteger(n) || n < 0 || n >= weeks) return null;
  return n;
}

function localDateKey(raw) {
  // Clave y-m-d sin pasar por Date: "2026-10-13" (ISO) y "13/10/2026" deben dar la misma clave en cualquier zona horaria.
  var str = String(raw == null ? "" : raw).trim();
  var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(str) || null;
  if (m) return Number(m[1]) + "-" + Number(m[2]) + "-" + Number(m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(str);
  return m ? Number(m[3]) + "-" + Number(m[2]) + "-" + Number(m[1]) : null;
}

/** Cantidad de días de la rutina que incluyen el ejercicio (calentamiento o principal). */
function daysContainingExercise(days, exerciseId) {
  var n = 0;
  (days || []).forEach(function (day) {
    var found = false;
    [].concat((day && day.warmup) || [], (day && day.exercises) || []).forEach(function (ex) {
      if (ex && ex.id != null && String(ex.id) === String(exerciseId)) found = true;
    });
    if (found) n++;
  });
  return n;
}

/**
 * Día de entrenamiento al que pertenece una fila de progreso, o null si los datos no lo demuestran.
 * `progreso` no guarda el día: solo se infiere de una sesión del mismo alumno, ciclo, fecha y semana (sesiones.semana es 1-based,
 * progreso.semana 0-based) cuya lista `ejercicios` incluya el ejercicio. Sin sesión, o con varias que apuntan a días distintos => null.
 */
export function resolveProgressRowDay(row, sessions) {
  var w = progressRowWeekIndex(row, 4);
  var key = localDateKey(row && row.fecha);
  if (w == null || key == null) return null;
  var days = {};
  var count = 0;
  (sessions || []).forEach(function (ses) {
    if (!ses || Number(ses.semana) !== w + 1) return;
    if (localDateKey(ses.fecha) !== key) return;
    if (!rowSameCiclo(row, ses.ciclo !== undefined ? ses.ciclo : 1)) return;
    var ids = String(ses.ejercicios || "").split(",").map(function (x) { return x.trim(); });
    if (ids.indexOf(String(row.ejercicio_id)) < 0) return;
    if (ses.dia_idx == null || ses.dia_idx === "" || typeof ses.dia_idx === "boolean" || Array.isArray(ses.dia_idx)) return;
    var di = Number(ses.dia_idx);
    if (!Number.isInteger(di) || di < 0) return;
    if (!days[di]) { days[di] = true; count++; }
  });
  if (count !== 1) return null;
  return Number(Object.keys(days)[0]);
}

/**
 * Serie «Evolución de carga»: kg máximo por semana de la rutina para un ejercicio (null = sin registro).
 * Usa la semana registrada de la fila (no depende de que las sesiones caigan en semanas calendario consecutivas);
 * solo las filas sin semana válida se reparten por fecha en `weekStarts`. Si la fila trae `ciclo`, solo cuenta el
 * ciclo vigente (así un reinicio de rutina no mezcla registros de ciclos anteriores); si trae rutina_id, la rutina vigente.
 * Si el mismo ejercicio está en varios días de la rutina, una fila solo se descarta cuando una sesión demuestra que es de OTRO día;
 * las filas cuyo día no se puede demostrar se incluyen y se marca `mixedDays` (el máximo puede incluir otro día).
 * @returns {{ series: Array<number|null>, mixedDays: boolean }}
 */
export function buildLoadSeriesDetailed(rows, opts) {
  var weeks = opts.weekStarts.length;
  var series = [];
  for (var w = 0; w < weeks; w++) series.push(null);
  var multiDay = daysContainingExercise(opts.routineDays, opts.ejercicioId) > 1 && opts.dayIdx != null;
  var mixedDays = false;
  (rows || []).forEach(function (rr) {
    if (!rr || String(rr.ejercicio_id) !== String(opts.ejercicioId)) return;
    if (rr.rutina_id != null && rr.rutina_id !== "" && opts.routineId && String(rr.rutina_id) !== String(opts.routineId)) return;
    if (Object.prototype.hasOwnProperty.call(rr, "ciclo") && !(opts.routineDatos ? progressRowActivaEnBloque(rr, opts.routineDatos) : rowInCiclo(rr, opts.ciclo))) return;
    var kgv = parseFloat(rr.kg) || 0;
    if (!(kgv > 0)) return;
    var rowUnknownDay = false;
    if (multiDay) {
      var rd = resolveProgressRowDay(rr, opts.sessions);
      if (rd != null && rd !== opts.dayIdx) return;
      rowUnknownDay = rd == null;
    }
    var wi = progressRowWeekIndex(rr, weeks);
    if (wi == null) {
      var dd = parseProgresoDate(rr.fecha);
      if (!dd) return;
      var tt = dd.getTime();
      for (var k = 0; k < weeks; k++) {
        if (tt >= opts.weekStarts[k] && tt < opts.weekStarts[k] + 7 * DAY_MS) { wi = k; break; }
      }
      if (wi == null) return;
    }
    if (rowUnknownDay) mixedDays = true;
    if (series[wi] == null || kgv > series[wi]) series[wi] = kgv;
  });
  return { series: series.map(function (v) { return v == null ? null : Math.round(v * 10) / 10; }), mixedDays: mixedDays };
}

export function buildLoadSeries(rows, opts) {
  return buildLoadSeriesDetailed(rows, opts).series;
}

export function getRoutineForAlumno(rutinasSBEntrenador, alumnoId) {
  return selectCurrentRoutine(rutinasSBEntrenador, alumnoId);
}

function routineExerciseIdSet(rut) {
  var ids = {};
  var days = rut && rut.datos ? rut.datos.days || [] : [];
  days.forEach(function (day) {
    function collect(list) {
      (list || []).forEach(function (ex) {
        if (ex && ex.id != null) ids[String(ex.id)] = true;
      });
    }
    collect(day.warmup);
    collect(day.exercises);
  });
  return ids;
}

/** Una fila que trae `ciclo` solo cuenta en el ciclo vigente de la rutina; sin la clave (select antiguo) no se puede distinguir y no se filtra. */
function rowSameCiclo(row, ciclo) {
  return !Object.prototype.hasOwnProperty.call(row, "ciclo") || rowInCiclo(row, ciclo);
}

/**
 * Fila de `progreso` (semana 0-based) que pertenece al BLOQUE vigente de la rutina (lib/rutinaCiclo.js): tras reiniciar la semana W, las
 * semanas < W siguen saliendo del ciclo anterior y la semana W del ciclo nuevo; el intento anterior de W queda fuera (historial).
 * Sin la clave `ciclo` (select antiguo) no se filtra.
 */
function progressRowActivaEnBloque(row, datos) {
  if (!Object.prototype.hasOwnProperty.call(row, "ciclo")) return true;
  var w = progressRowWeekIndex(row, 4);
  return filaActivaEnBloque(datos, row, w == null ? null : w + 1);
}

/** Igual para `sesiones` (semana 1-based). */
function sessionActivaEnBloque(ses, datos) {
  if (!Object.prototype.hasOwnProperty.call(ses, "ciclo")) return true;
  return filaActivaEnBloque(datos, ses, ses.semana);
}

function progressRowMatchesRoutine(row, routineId, routineExerciseIds, fallbackStartMs, fallbackEndMs, maxSemana, routineDatos) {
  if (!row) return false;
  if (!progressRowActivaEnBloque(row, routineDatos)) return false;
  if (routineId && row.rutina_id != null && row.rutina_id !== "") {
    return String(row.rutina_id) === String(routineId);
  }
  if (row.ejercicio_id == null) return false;
  if (!routineExerciseIds[String(row.ejercicio_id)]) return false;
  // progreso.semana es 0-based: 0 es la Semana 1 y es una semana valida. Solo una ausencia (null/vacio) cae al respaldo por fecha.
  var semana = row.semana == null || row.semana === "" ? NaN : Number(row.semana);
  if (Number.isInteger(semana) && semana >= 0) {
    return semana <= maxSemana;
  }
  var d = parseProgresoDate(row.fecha);
  var t = d ? d.getTime() : 0;
  return t >= fallbackStartMs && t < fallbackEndMs;
}

function sessionMatchesRoutine(ses, routineId, fallbackStartMs, fallbackEndMs, routineDatos) {
  if (!ses) return false;
  if (!sessionActivaEnBloque(ses, routineDatos)) return false;
  if (routineId && ses.rutina_id != null && ses.rutina_id !== "") {
    return String(ses.rutina_id) === String(routineId);
  }
  var d = parseSessionDate(ses);
  var t = d ? d.getTime() : 0;
  return t >= fallbackStartMs && t < fallbackEndMs;
}

function buildRoutineWeekContext(progressRows, sessions, now) {
  var anchors = [];
  var latestSessionWeek = null;
  (progressRows || []).forEach(function (row) {
    var d = parseProgresoDate(row.fecha);
    if (d) anchors.push(d.getTime());
  });
  (sessions || []).forEach(function (ses) {
    var d = parseSessionDate(ses);
    if (d) {
      var t = d.getTime();
      anchors.push(t);
      var semana = parseInt(ses.semana, 10);
      if (semana > 0 && (!latestSessionWeek || t >= latestSessionWeek.timeMs)) {
        latestSessionWeek = { semana: semana, timeMs: t };
      }
    }
  });

  var currentMondayMs = weekKeyMon(now);
  var routineStartMs;
  var semanaDetectada;
  if (latestSessionWeek) {
    semanaDetectada = Math.max(1, latestSessionWeek.semana);
    routineStartMs = weekKeyMon(new Date(latestSessionWeek.timeMs)) - (semanaDetectada - 1) * 7 * DAY_MS;
  } else {
    var firstActivityMs = anchors.length > 0 ? Math.min.apply(null, anchors) : currentMondayMs;
    routineStartMs = weekKeyMon(new Date(firstActivityMs));
    var rawWeek = Math.floor((currentMondayMs - routineStartMs) / (7 * DAY_MS)) + 1;
    semanaDetectada = Math.max(1, rawWeek || 1);
  }
  var currentRoutineWeekIndex = Math.min(3, semanaDetectada - 1);
  var weekStarts = [];
  for (var i = 0; i < 4; i++) {
    weekStarts.push(routineStartMs + i * 7 * DAY_MS);
  }

  return {
    routineStartMs: routineStartMs,
    semanaDetectada: semanaDetectada,
    currentRoutineWeekIndex: currentRoutineWeekIndex,
    currentWeekStartMs: weekStarts[currentRoutineWeekIndex],
    currentWeekEndMs: weekStarts[currentRoutineWeekIndex] + 7 * DAY_MS,
    weekStarts: weekStarts,
  };
}

/**
 * Ejercicios de un día concreto de la rutina (orden: calentamiento → principal; sin duplicar id).
 */
export function exercisesForRoutineDay(rutinasSBEntrenador, alumnoId, dayIdx, exMap, lang) {
  var rut = getRoutineForAlumno(rutinasSBEntrenador, alumnoId);
  var days = rut && rut.datos ? rut.datos.days || [] : [];
  var day = days[dayIdx];
  if (!day) return [];
  var seen = {};
  var out = [];
  function pushList(arr, section) {
    (arr || []).forEach(function (ex) {
      if (!ex || ex.id == null) return;
      var sid = String(ex.id);
      if (seen[sid]) return;
      seen[sid] = true;
      out.push({
        id: ex.id,
        name: exName(exMap, ex.id, lang),
        section: section,
      });
    });
  }
  pushList(day.warmup, "warmup");
  pushList(day.exercises, "main");
  return out;
}

/**
 * @param {object} params
 * @returns {object} modelo listo para la UI
 */
export function buildCoachProgresoModel(params) {
  var alumnos = params.alumnos || [];
  var sesionesGlobales = params.sesionesGlobales || [];
  var progresoGlobal = params.progresoGlobal || {};
  var rutinasSBEntrenador = params.rutinasSBEntrenador || [];
  var allEx = params.allEx || [];
  var periodId = params.periodId || "semanas4";
  var alumnoSel = params.alumnoSel;
  var ejercicioSelId = params.ejercicioSelId;
  var diaIdx = params.diaIdx != null && params.diaIdx >= 0 ? params.diaIdx : 0;
  var lang =
    params.lang != null
      ? params.lang
      : params.es === false
        ? "en"
        : "es";
  var exMap = {};
  for (var xi = 0; xi < allEx.length; xi++) {
    var ex = allEx[xi];
    if (ex && ex.id != null) exMap[ex.id] = ex;
  }

  var period = getPeriodDays(periodId, params.hoy);
  var actual = period.actual;
  var previo = period.previo;
  var hoy = period.hoy;
  var now = new Date();
  var fallbackWeekStartMs = weekKeyMon(now);
  var fallbackWeekEndMs = fallbackWeekStartMs + 7 * DAY_MS;
  var maxSemanaPeriodo = Math.max(1, Math.ceil(period.durDays / 7));
  /** Historial incompleto (lib/coachHistoryLoader.js): los deltas contra el período anterior no son confiables. */
  var hc = params.historiaCompleta || null;
  var sesionesIncompletas = !!(hc && hc.sesiones === false);
  var progresoIncompleto = !!(hc && hc.progreso === false);
  /** Ejercicios por tiempo: catálogo (EX + custom) y snapshots de TODAS las rutinas del entrenador (lib/metricas/tipoCarga.js). */
  var indiceTiempo = indiceEjerciciosPorTiempo(allEx, rutinasSBEntrenador);
  var routineForSelected = getRoutineForAlumno(rutinasSBEntrenador, alumnoSel);
  var routineForSelectedId = routineForSelected && routineForSelected.id != null ? String(routineForSelected.id) : null;
  var routineExerciseIds = routineExerciseIdSet(routineForSelected);
  var routineCiclo = readCicloActual(routineForSelected && routineForSelected.datos);
  var routineDatos = routineForSelected && routineForSelected.datos;
  /** Historial completo del alumno seleccionado (todas las rutinas y ciclos): base de PR y volumen del período. */
  var alumnoAllRows = alumnoSel ? progresoGlobal[alumnoSel] || [] : [];
  /** Filas del bloque vigente de la rutina activa: solo para las tarjetas «de la rutina» (volumen por semana y patrón). */
  var selectedProgressRows = alumnoAllRows.filter(function (row) {
    return progressRowMatchesRoutine(row, routineForSelectedId, routineExerciseIds, fallbackWeekStartMs, fallbackWeekEndMs, maxSemanaPeriodo, routineDatos);
  });
  var selectedSessions = (sesionesGlobales || []).filter(function (ses) {
    return String(ses.alumno_id) === String(alumnoSel) && sessionMatchesRoutine(ses, routineForSelectedId, fallbackWeekStartMs, fallbackWeekEndMs, routineDatos);
  });
  var routineWeekContext = buildRoutineWeekContext(selectedProgressRows, selectedSessions, now);

  var alumnoRows = alumnos.map(function (a, idx) {
    return {
      id: a.id,
      label: a.nombre || a.email || "—",
      initials: initialsFromName(a.nombre, a.email),
      color: PALETTE[Math.abs(idx) % PALETTE.length],
    };
  });

  /** Adherencia (lib/metricas/adherencia.js) a la rutina vigente del alumno en un rango de días. pct null = sin plan en ese rango. */
  function adherenceForAlumno(aid, rango) {
    return adherencia({
      rutina: getRoutineForAlumno(rutinasSBEntrenador, aid),
      sesiones: sesionesGlobales,
      alumnoId: aid,
      desde: rango.desde,
      hasta: rango.hasta,
    });
  }
  var adherenciaActual = {};
  var adherenciaPrevia = {};
  alumnos.forEach(function (a) {
    adherenciaActual[a.id] = adherenceForAlumno(a.id, actual);
    adherenciaPrevia[a.id] = adherenceForAlumno(a.id, previo);
  });

  var adherenciaRows = alumnos
    .filter(function (a) {
      return adherenciaActual[a.id].pct != null;
    })
    .map(function (a) {
      var ad = adherenciaActual[a.id];
      return {
        id: a.id,
        n: a.nombre || a.email || "—",
        p: ad.pct,
        color: pctColor(ad.pct),
        tienePlan: true,
        completed: ad.completadas,
        planned: ad.planificadas,
        validadas: ad.validadas,
      };
    })
    .sort(function (a, b) {
      return b.p - a.p;
    });

  /** PRs del alumno seleccionado (historial completo de ese alumno, nunca el de otros). */
  var alumnoPrEvents = alumnoSel ? eventosPR(alumnoAllRows, { indiceTiempo: indiceTiempo }) : [];
  var prsPeriod = contarPRs(alumnoPrEvents, actual.desde, actual.hasta);
  var prsPrev = contarPRs(alumnoPrEvents, previo.desde, previo.hasta);
  var prDelta = prsPeriod - prsPrev;

  /** Volumen del período (historial completo, sin filtrar rutina ni ciclo) y comparación like-for-like con el anterior. */
  var volCmp = compararVolumen(alumnoAllRows, actual, previo, { indiceTiempo: indiceTiempo });
  var semanasPeriodo = Math.max(1, period.durDays / 7);
  var volPeriod = volCmp.actualTotal;
  var volSemPromKg = volPeriod / semanasPeriodo;
  var volPct = progresoIncompleto ? null : volCmp.pct;
  var volMotivo = progresoIncompleto ? "historial_incompleto" : volCmp.motivo;

  /** Adherencia promedio (solo alumnos con plan); el delta compara solo alumnos con plan en ambos períodos. */
  var adherSum = 0;
  var adherN = 0;
  var adherPairCur = 0;
  var adherPairPrev = 0;
  var adherPairN = 0;
  alumnos.forEach(function (a) {
    var cur = adherenciaActual[a.id];
    if (cur.pct == null) return;
    adherSum += cur.pct;
    adherN++;
    var prev = adherenciaPrevia[a.id];
    if (prev.pct == null) return;
    adherPairCur += cur.pct;
    adherPairPrev += prev.pct;
    adherPairN++;
  });
  var adherAvg = adherN > 0 ? Math.round(adherSum / adherN) : 0;
  var adherDeltaPct = adherPairN > 0 ? Math.round(adherPairCur / adherPairN) - Math.round(adherPairPrev / adherPairN) : null;

  /**
   * Estancados: con rutina, con actividad en los últimos 21 días, con un récord ANTERIOR a esa ventana que superar
   * y sin ningún PR (lib/metricas/pr.js) dentro de la ventana. Sin récord previo no hay estancamiento posible (alumno nuevo).
   */
  var stallDesde = hoy - 20;

  function hadActivityRecent(aid) {
    for (var s = 0; s < sesionesGlobales.length; s++) {
      var ses = sesionesGlobales[s];
      if (String(ses.alumno_id) !== String(aid)) continue;
      if (enRango(diaDeSesion(ses), stallDesde, hoy)) return true;
    }
    var regs = progresoGlobal[aid] || [];
    for (var r = 0; r < regs.length; r++) {
      if (enRango(parseFechaDMY(regs[r].fecha), stallDesde, hoy)) return true;
    }
    return false;
  }

  var stalled = 0;
  var stalledIds = [];
  alumnos.forEach(function (a) {
    var rut = getRoutineForAlumno(rutinasSBEntrenador, a.id);
    if (!rut) return;
    if (!hadActivityRecent(a.id)) return;
    var regs = progresoGlobal[a.id] || [];
    var previoAVentana = regs.filter(function (r) {
      return enRango(parseFechaDMY(r && r.fecha), null, stallDesde - 1);
    });
    if (volumenEnRango(previoAVentana, { indiceTiempo: indiceTiempo }).series === 0) return;
    if (contarPRs(eventosPR(regs, { indiceTiempo: indiceTiempo }), stallDesde, hoy) === 0) {
      stalled++;
      stalledIds.push(a.id);
    }
  });

  /** Evolución de carga: semanas de la rutina activa del alumno seleccionado. */
  var LOAD_BLOCK_WEEKS = 4;
  var weekLabels = [];
  for (var wi = 0; wi < LOAD_BLOCK_WEEKS; wi++) {
    weekLabels.push(M(lang, "Semana " + (wi + 1), "Week " + (wi + 1), "Semana " + (wi + 1)));
  }
  var loadDetail =
    alumnoSel && ejercicioSelId
      ? buildLoadSeriesDetailed(progresoGlobal[alumnoSel] || [], {
          ejercicioId: ejercicioSelId,
          routineId: routineForSelectedId,
          ciclo: routineCiclo,
          routineDatos: routineDatos,
          weekStarts: routineWeekContext.weekStarts.slice(0, LOAD_BLOCK_WEEKS),
          routineDays: routineForSelected && routineForSelected.datos ? routineForSelected.datos.days || [] : [],
          dayIdx: diaIdx,
          sessions: selectedSessions,
        })
      : { series: weekLabels.map(function () { return null; }), mixedDays: false };
  var series = loadDetail.series;

  /** PRs recientes: solo eventos del alumno seleccionado (alumnoPrEvents, ya ordenados del más reciente). */
  var prEvents = alumnoPrEvents.map(function (ev) {
    return Object.assign({ alumno_id: alumnoSel }, ev);
  });

  /** Fecha relativa de un número de día de calendario (lib/metricas/fechas.js). */
  function fmtRel(dia, loc) {
    if (dia == null) return "—";
    var diff = hoy - dia;
    if (diff === 0) return M(loc, "Hoy", "Today", "Hoje");
    if (diff === 1) return M(loc, "Ayer", "Yesterday", "Ontem");
    if (diff > 1 && diff < 7) return M(loc, "Hace " + diff + "d", diff + "d ago", "Há " + diff + "d");
    var u = new Date(dia * DAY_MS);
    var d = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
    var l = loc === "es" ? "es-AR" : loc === "pt" ? "pt-BR" : "en-US";
    return d.toLocaleDateString(l, { day: "2-digit", month: "short" });
  }

  /** Fecha corta ("27 oct") de un número de día de calendario. */
  function fmtDia(dia, loc) {
    var u = new Date(dia * DAY_MS);
    var d = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
    var l = loc === "es" ? "es-AR" : loc === "pt" ? "pt-BR" : "en-US";
    return d.toLocaleDateString(l, { day: "numeric", month: "short" });
  }

  var prsRecientes = prEvents.slice(0, RECENT_PRS_LIMIT).map(function (ev) {
    var alum = alumnos.find(function (x) {
      return String(x.id) === String(ev.alumno_id);
    });
    var label = alum ? alum.nombre || alum.email : "—";
    var ini = alum ? initialsFromName(alum.nombre, alum.email) : "?";
    var idx = alumnos.findIndex(function (x) {
      return String(x.id) === String(ev.alumno_id);
    });
    var col = idx >= 0 ? PALETTE[Math.abs(idx) % PALETTE.length] : PALETTE[0];
    // Un evento PR siempre supera un récord previo (el primer registro no es PR): el delta es contra ese récord.
    return {
      initials: ini,
      n: label,
      ex: exName(exMap, ev.ejercicio_id, lang),
      val: Math.round(ev.kg * 10) / 10 + " kg",
      delta: "+" + Math.round(ev.diferencia * 10) / 10 + " kg",
      date: fmtRel(ev.dia, lang),
      color: col,
      ejercicio_id: ev.ejercicio_id,
      kg: ev.kg,
      kgAnterior: ev.kgAnterior,
      diferencia: ev.diferencia,
      dia: ev.dia,
    };
  });

  /** Volumen semanal: alumno seleccionado + bloque vigente de la rutina activa (volumenEnRango por semana de la rutina). */
  var volBars = [];
  var maxVol = 0;
  for (var wv = 0; wv < LOAD_BLOCK_WEEKS; wv++) {
    var wkDesde = diaLocal(new Date(routineWeekContext.weekStarts[wv]));
    var vsum = volumenEnRango(selectedProgressRows, { desde: wkDesde, hasta: wkDesde + 6, indiceTiempo: indiceTiempo }).total;
    volBars.push({
      v: vsum,
      s: M(lang, "Semana " + (wv + 1), "Week " + (wv + 1), "Semana " + (wv + 1)),
    });
    if (vsum > maxVol) maxVol = vsum;
  }

  /** Ranking = misma métrica que adherencia */
  var ranking = adherenciaRows.map(function (row, i) {
    var alum = alumnos.find(function (x) {
      return String(x.id) === String(row.id);
    });
    return {
      id: row.id,
      initials: alum ? initialsFromName(alum.nombre, alum.email) : "?",
      n: row.n,
      p: row.p,
      color: row.color,
      completed: row.completed,
      planned: row.planned,
      validadas: row.validadas,
    };
  });

  /** Volumen por patrón: semana actual de la rutina activa; 1 fila progreso = 1 serie (las series por tiempo cuentan como serie, no como volumen). */
  var gDesde = diaLocal(new Date(routineWeekContext.currentWeekStartMs));
  var gHasta = gDesde + 6;
  var volByKey = { empuje: 0, traccion: 0, rodilla: 0, bisagra: 0, core: 0 };
  /** @type {Record<string, Record<string, number>>} patternKey -> ejercicio_id -> series */
  var seriesByPatternAndEx = {
    empuje: {},
    traccion: {},
    rodilla: {},
    bisagra: {},
    core: {},
  };
  selectedProgressRows.forEach(function (r) {
    if (!enRango(parseFechaDMY(r.fecha), gDesde, gHasta)) return;
    var ex = exMap[r.ejercicio_id];
    var mk = patternToMovementKey(ex ? ex.pattern : "");
    if (!mk) return;
    volByKey[mk] += volumenDeSerie(r, indiceTiempo);
    var ejId = r.ejercicio_id;
    if (ejId == null) return;
    var sid = String(ejId);
    var bag = seriesByPatternAndEx[mk];
    bag[sid] = (bag[sid] || 0) + 1;
  });
  var patronTotalVol = MOVEMENT_PATTERN_DEF.reduce(function (acc, def) {
    return acc + (volByKey[def.key] || 0);
  }, 0);
  var patronPatterns = MOVEMENT_PATTERN_DEF.map(function (def) {
    var v = volByKey[def.key] || 0;
    var pct = patronTotalVol > 0 ? Math.round((100 * v) / patronTotalVol) : 0;
    var bag = seriesByPatternAndEx[def.key] || {};
    var exercises = Object.keys(bag)
      .map(function (ejId) {
        return {
          ejercicio_id: ejId,
          name: exName(exMap, ejId, lang),
          series: bag[ejId],
        };
      })
      .sort(function (a, b) {
        return b.series - a.series;
      });
    return {
      key: def.key,
      label: M(lang, def.labelEs, def.labelEn, def.labelEn),
      p: pct,
      vol: v,
      color: def.color,
      exercises: exercises,
    };
  });

  var noData = M(lang, "Sin datos suficientes", "Not enough data", "Dados insuficientes");
  var vsPrev = M(lang, "vs período anterior", "vs prev. period", "vs período anterior");
  var incompleto = M(lang, "Historial incompleto: sin comparación", "Incomplete history: no comparison", "Histórico incompleto: sem comparação");
  var sinPrevioPlan = M(lang, "Sin plan en el período anterior", "No plan in the previous period", "Sem plano no período anterior");
  var VOL_MOTIVO = {
    historial_incompleto: incompleto,
    sin_ejercicios_comunes: M(lang, "Sin ejercicios comparables con el período anterior", "No exercises comparable with the previous period", "Sem exercícios comparáveis com o período anterior"),
    previo_con_pocos_dias: M(lang, "Pocos datos en el período anterior", "Too little data in the previous period", "Poucos dados no período anterior"),
    actual_con_pocos_dias: M(lang, "Pocos datos en este período", "Too little data in this period", "Poucos dados neste período"),
  };
  /** Tono de presentación de una comparación ya calculada: sube = good, baja = `down`, sin cambio = neutral. */
  function deltaTone(n, down) {
    return n > 0 ? "good" : n < 0 ? down : "neutral";
  }
  function deltaArrow(n) {
    return (n >= 0 ? "↑ " : "↓ ") + Math.abs(n);
  }

  /** EQUIPO: global, no depende de alumnoSel (solo del período). */
  var teamChips = [
    {
      key: "teamAdherence",
      value: adherN > 0 ? adherAvg : null,
      val: adherN > 0 ? adherAvg + "%" : "—",
      color: "#3b82f6",
      label: M(lang, "Adherencia promedio del equipo", "Team avg. adherence", "Aderência média da equipe"),
      delta:
        adherN === 0
          ? noData
          : sesionesIncompletas
            ? incompleto
            : adherDeltaPct == null
              ? sinPrevioPlan
              : deltaArrow(adherDeltaPct) + "% " + vsPrev,
      deltaColor: adherDeltaPct == null || sesionesIncompletas ? "#71717a" : adherDeltaPct >= 0 ? "#22c55e" : "#ef4444",
      tone: adherN === 0 || adherDeltaPct == null || sesionesIncompletas ? "neutral" : deltaTone(adherDeltaPct, "bad"),
    },
    {
      key: "teamStalled",
      value: stalled,
      val: String(stalled),
      color: stalled > 0 ? "#ef4444" : "#71717a",
      label: M(lang, "Alumnos estancados", "Athletes stalled", "Alunos estagnados"),
      delta: M(
        lang,
        "Sin mejora (PR) en 3 sem. · con rutina",
        "No PR in 3 wks · with plan",
        "Sem melhora (PR) em 3 sem. · com rotina"
      ),
      deltaColor: stalled > 0 ? "#ef4444" : "#71717a",
      tone: stalled > 0 ? "warn" : "neutral",
    },
  ];

  /** ALUMNO seleccionado: solo sesiones/progreso de alumnoSel. Volumen en kg (kg × reps). */
  var selAlumno = alumnoSel
    ? alumnos.find(function (x) {
        return String(x.id) === String(alumnoSel);
      })
    : null;
  var selName = selAlumno ? selAlumno.nombre || selAlumno.email || "—" : "";
  var selAd = alumnoSel ? adherenceForAlumno(alumnoSel, actual) : null;
  var selAdPrev = alumnoSel ? adherenceForAlumno(alumnoSel, previo) : null;
  var selHasAd = !!(selAd && selAd.pct != null);
  var selAdDelta = selHasAd && selAdPrev && selAdPrev.pct != null ? selAd.pct - selAdPrev.pct : null;
  var alumnoChips = [
    {
      key: "alumnoAdherence",
      value: selHasAd ? selAd.pct : null,
      val: selHasAd ? selAd.pct + "%" : "—",
      color: "#3b82f6",
      label: M(lang, "Adherencia de " + selName, selName + " adherence", "Aderência de " + selName),
      delta: selHasAd
        ? sesionesIncompletas
          ? incompleto
          : selAdDelta == null
            ? sinPrevioPlan
            : deltaArrow(selAdDelta) + "% " + vsPrev
        : alumnoSel
          ? M(lang, "Sin rutina asignada", "No routine assigned", "Sem rotina atribuída")
          : noData,
      deltaColor: selAdDelta == null || sesionesIncompletas ? "#71717a" : selAdDelta >= 0 ? "#22c55e" : "#ef4444",
      tone: !selHasAd || selAdDelta == null || sesionesIncompletas ? "neutral" : deltaTone(selAdDelta, "bad"),
      completed: selAd ? selAd.completadas : 0,
      planned: selAd ? selAd.planificadas : 0,
      validadas: selAd ? selAd.validadas : 0,
    },
    {
      key: "alumnoPrs",
      value: prsPeriod,
      val: String(prsPeriod),
      color: "#22c55e",
      label: M(lang, "PRs en el período", "PRs in the period", "PRs no período"),
      delta: progresoIncompleto
        ? incompleto
        : prsPrev > 0 || prsPeriod > 0
          ? deltaArrow(prDelta) + " " + vsPrev
          : noData,
      deltaColor: progresoIncompleto ? "#71717a" : prDelta >= 0 ? "#22c55e" : "#eab308",
      tone: progresoIncompleto || !(prsPrev > 0 || prsPeriod > 0) ? "neutral" : deltaTone(prDelta, "warn"),
    },
    {
      key: "alumnoVolume",
      value: volSemPromKg,
      val: volPeriod > 0 ? Math.round(volSemPromKg) + " kg" : "—",
      color: "#eab308",
      label: M(lang, "Volumen semanal prom.", "Avg. weekly volume", "Volume semanal médio"),
      delta:
        volPeriod <= 0
          ? noData
          : volPct != null
            ? deltaArrow(Math.round(volPct)) + "% " + M(lang, "vs ant. (mismos ejercicios)", "vs prev. (same exercises)", "vs ant. (mesmos exercícios)")
            : VOL_MOTIVO[volMotivo] || noData,
      deltaColor: volPct == null ? "#71717a" : volPct >= 0 ? "#22c55e" : "#ef4444",
      tone: volPeriod <= 0 || volPct == null ? "neutral" : deltaTone(Math.round(volPct), "bad"),
    },
  ];

  /** Última sesión completada del alumno (realizada o validada por el entrenador): solo una consulta de fecha, no una métrica. */
  var ultimaSesion = null;
  (sesionesGlobales || []).forEach(function (ses) {
    if (!ses || !alumnoSel || String(ses.alumno_id) !== String(alumnoSel) || !isCompletedSession(ses)) return;
    var d = diaDeSesion(ses);
    if (d == null || d > hoy) return;
    var validada = ses.origen === ORIGEN_VALIDADA;
    // el mismo día, una realizada gana a una validada
    if (ultimaSesion && (d < ultimaSesion.dia || (d === ultimaSesion.dia && (validada || !ultimaSesion.validada)))) return;
    var di = ses.dia_idx == null || ses.dia_idx === "" ? NaN : Number(ses.dia_idx);
    ultimaSesion = { dia: d, diasAtras: hoy - d, diaIdx: Number.isInteger(di) && di >= 0 ? di : null, validada: validada };
  });
  if (ultimaSesion) ultimaSesion.fecha = fmtDia(ultimaSesion.dia, lang);

  /**
   * Ejercicios que el alumno registró alguna vez (historial completo), con su última sesión. La clase (PR / iguala / primera marca)
   * sale de historialPorDia (lib/metricas/pr.js); los ejercicios por tiempo muestran su último tiempo y no tienen récord de carga.
   */
  var porEjercicio = {};
  alumnoAllRows.forEach(function (r) {
    if (!r || r.ejercicio_id == null) return;
    var d = parseFechaDMY(r.fecha);
    if (d == null) return;
    var id = String(r.ejercicio_id);
    var cur = porEjercicio[id];
    if (!cur || d > cur.dia) porEjercicio[id] = { dia: d, rows: [r] };
    else if (d === cur.dia) cur.rows.push(r);
  });
  var enRutina = {};
  ((routineForSelected && routineForSelected.datos && routineForSelected.datos.days) || []).forEach(function (day) {
    [].concat((day && day.warmup) || [], (day && day.exercises) || []).forEach(function (ex) {
      if (ex && ex.id != null) enRutina[String(ex.id)] = true;
    });
  });
  var ejerciciosRegistrados = Object.keys(porEjercicio).map(function (id) {
    var ult = porEjercicio[id];
    var esTiempo = tipoDeCarga(id, indiceTiempo) === TIPO_CARGA.TIEMPO;
    var hist = esTiempo ? [] : historialPorDia(alumnoAllRows, id, { indiceTiempo: indiceTiempo });
    var last = hist.length ? hist[hist.length - 1] : null;
    var ultimaSegundos = null;
    if (esTiempo) {
      ult.rows.forEach(function (r) {
        var sec = parseInt(r.reps, 10);
        if (sec > 0 && (ultimaSegundos == null || sec > ultimaSegundos)) ultimaSegundos = sec;
      });
    }
    return {
      id: id,
      name: exName(exMap, id, lang),
      enRutina: !!enRutina[id],
      esTiempo: esTiempo,
      ultimoDia: ult.dia,
      ultimaFecha: fmtDia(ult.dia, lang),
      ultimaKg: last && last.dia === ult.dia ? last.kg : null,
      ultimaReps: last && last.dia === ult.dia ? last.reps : null,
      ultimaSegundos: ultimaSegundos,
      ultimaClase: last && last.dia === ult.dia ? last.clase : null,
    };
  }).sort(function (a, b) {
    return b.ultimoDia - a.ultimoDia || a.name.localeCompare(b.name);
  });

  var exerciseOptions = exercisesForRoutineDay(rutinasSBEntrenador, alumnoSel, diaIdx, exMap, lang);

  if (import.meta.env && import.meta.env.DEV) {
    console.log("[PROGRESS DEBUG]", {
      alumnoId: alumnoSel || null,
      rutinaId: routineForSelectedId,
      semanaDetectada: routineWeekContext.semanaDetectada,
      sesionesFiltradas: selectedSessions.length,
      ejerciciosIncluidos: Object.keys(routineExerciseIds),
      volumenPorCategoria: volByKey,
    });
  }

  return {
    alumnoRows: alumnoRows,
    exerciseOptions: exerciseOptions,
    adherenciaRows: adherenciaRows,
    ranking: ranking,
    prsRecientes: prsRecientes,
    volBars: volBars,
    maxVol: maxVol,
    patronPatterns: patronPatterns,
    patronTotalVol: patronTotalVol,
    teamChips: teamChips,
    alumnoChips: alumnoChips,
    recentPrsLimit: RECENT_PRS_LIMIT,
    prsPeriod: prsPeriod,
    prsPrev: prsPrev,
    volSemPromKg: volSemPromKg,
    volPct: volPct,
    stalledIds: stalledIds,
    ultimaSesion: ultimaSesion,
    ejerciciosRegistrados: ejerciciosRegistrados,
    rutinaNombre: routineForSelected ? String(routineForSelected.nombre || routineForSelected.name || "") : "",
    tieneRutina: !!routineForSelected,
    volMotivo: volMotivo,
    indiceTiempo: indiceTiempo,
    chartSeries: series,
    chartWeekLabels: weekLabels,
    chartMixedDays: loadDetail.mixedDays,
    currentRoutineWeekIndex: routineWeekContext.currentRoutineWeekIndex,
    semanaDetectada: routineWeekContext.semanaDetectada,
    hasChartData: series.some(function (v) {
      return v != null;
    }),
  };
}

export { PALETTE };

export function colorForAlumnoIndex(i) {
  return PALETTE[Math.abs(i) % PALETTE.length];
}
