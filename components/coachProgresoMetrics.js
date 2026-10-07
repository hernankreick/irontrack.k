/**
 * Métricas agregadas para la vista Progreso del entrenador (datos reales).
 * Fuentes: alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, catálogo allEx.
 */

import { FALLBACK_EXERCISE_NAME } from "../lib/exerciseResolve.js";
import { selectCurrentRoutine } from "../lib/routineStore.js";
import { irontrackMsg as M, pickExerciseName } from "../lib/irontrackMsg.js";

const DAY_MS = 86400000;
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

/** @returns {{ start:number, end:number, prevStart:number, prevEnd:number, durDays:number }} */
export function getPeriodBounds(periodId) {
  var durDays = periodDurationDays(periodId);
  var end = Date.now();
  var start = end - durDays * DAY_MS;
  var prevEnd = start;
  var prevStart = prevEnd - durDays * DAY_MS;
  return { start, end, prevStart, prevEnd, durDays };
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

/**
 * Volumen de una fila de progreso en kg: kg × reps. kg y reps deben ser > 0; en otro caso aporta 0.
 * Cada fila es una serie real: no se deduplica ni se colapsa nada.
 */
export function rowVolumeKg(row) {
  if (!row) return 0;
  var kg = parseFloat(row.kg);
  var reps = parseInt(row.reps, 10);
  if (!(kg > 0) || !(reps > 0)) return 0;
  return kg * reps;
}

/**
 * Eventos PR de UN alumno a partir de TODO su historial (no del subconjunto filtrado por rutina).
 * Semántica histórica (se mantiene a propósito): el primer registro de un ejercicio cuenta como PR
 * y un mismo ejercicio puede generar varios PRs el mismo día.
 * @returns {Array<{ejercicio_id:any,kg:number,deltaKg:number,prevKg:(number|null),fechaMs:number}>} más recientes primero
 */
export function buildPrEvents(rows) {
  var sorted = (rows || []).slice().sort(function (x, y) {
    var dx = parseProgresoDate(x.fecha);
    var dy = parseProgresoDate(y.fecha);
    return (dx ? dx.getTime() : 0) - (dy ? dy.getTime() : 0);
  });
  var best = {};
  var events = [];
  for (var i = 0; i < sorted.length; i++) {
    var row = sorted[i];
    var kg = parseFloat(row.kg) || 0;
    if (kg <= 0) continue;
    var prev = best[row.ejercicio_id] != null ? best[row.ejercicio_id] : -1;
    if (kg > prev) {
      var d = parseProgresoDate(row.fecha);
      events.push({
        ejercicio_id: row.ejercicio_id,
        kg: kg,
        deltaKg: prev < 0 ? kg : kg - prev,
        prevKg: prev >= 0 ? prev : null,
        fechaMs: d ? d.getTime() : 0,
      });
      best[row.ejercicio_id] = kg;
    }
  }
  return events.sort(function (a, b) {
    return b.fechaMs - a.fechaMs;
  });
}

function countPrEventsBetween(events, t0, t1) {
  var c = 0;
  for (var i = 0; i < events.length; i++) {
    if (events[i].fechaMs >= t0 && events[i].fechaMs <= t1) c++;
  }
  return c;
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

function progressRowMatchesRoutine(row, routineId, routineExerciseIds, fallbackStartMs, fallbackEndMs, maxSemana) {
  if (!row) return false;
  if (routineId && row.rutina_id != null && row.rutina_id !== "") {
    return String(row.rutina_id) === String(routineId);
  }
  if (row.ejercicio_id == null) return false;
  if (!routineExerciseIds[String(row.ejercicio_id)]) return false;
  var semana = Number(row.semana);
  if (Number.isFinite(semana) && semana > 0) {
    return semana <= maxSemana;
  }
  var d = parseProgresoDate(row.fecha);
  var t = d ? d.getTime() : 0;
  return t >= fallbackStartMs && t < fallbackEndMs;
}

function sessionMatchesRoutine(ses, routineId, fallbackStartMs, fallbackEndMs) {
  if (!ses) return false;
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

  var bounds = getPeriodBounds(periodId);
  var start = bounds.start;
  var end = bounds.end;
  var pStart = bounds.prevStart;
  var pEnd = bounds.prevEnd;
  var now = new Date();
  var fallbackWeekStartMs = weekKeyMon(now);
  var fallbackWeekEndMs = fallbackWeekStartMs + 7 * DAY_MS;
  var maxSemanaPeriodo = Math.max(1, Math.ceil(bounds.durDays / 7));
  var routineForSelected = getRoutineForAlumno(rutinasSBEntrenador, alumnoSel);
  var routineForSelectedId = routineForSelected && routineForSelected.id != null ? String(routineForSelected.id) : null;
  var routineExerciseIds = routineExerciseIdSet(routineForSelected);
  var selectedProgressRows = alumnoSel
    ? (progresoGlobal[alumnoSel] || []).filter(function (row) {
        return progressRowMatchesRoutine(row, routineForSelectedId, routineExerciseIds, fallbackWeekStartMs, fallbackWeekEndMs, maxSemanaPeriodo);
      })
    : [];
  var selectedSessions = (sesionesGlobales || []).filter(function (ses) {
    return String(ses.alumno_id) === String(alumnoSel) && sessionMatchesRoutine(ses, routineForSelectedId, fallbackWeekStartMs, fallbackWeekEndMs);
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

  /** Adherencia: sesiones completadas vs planificadas en la ventana [t0, t1] (período actual o anterior). */
  function adherenceForAlumno(aid, t0, t1) {
    var rut = getRoutineForAlumno(rutinasSBEntrenador, aid);
    var diasPorSemana = rut && rut.datos && rut.datos.days ? rut.datos.days.length : 0;
    var semanas = Math.max(1, Math.ceil(bounds.durDays / 7));
    var planned = diasPorSemana > 0 ? diasPorSemana * semanas : 0;
    var completed = 0;
    for (var s = 0; s < sesionesGlobales.length; s++) {
      var ses = sesionesGlobales[s];
      if (String(ses.alumno_id) !== String(aid)) continue;
      var dt = parseSessionDate(ses);
      if (!dt) continue;
      var t = dt.getTime();
      if (t >= t0 && t <= t1) completed++;
    }
    var pct = planned > 0 ? Math.min(100, Math.round((100 * completed) / planned)) : completed > 0 ? 100 : 0;
    return { planned: planned, completed: completed, pct: pct, tienePlan: planned > 0 };
  }

  var adherenciaRows = alumnos
    .map(function (a) {
      var ad = adherenceForAlumno(a.id, start, end);
      return {
        id: a.id,
        n: a.nombre || a.email || "—",
        p: ad.pct,
        color: pctColor(ad.pct),
        tienePlan: ad.tienePlan,
        completed: ad.completed,
        planned: ad.planned,
      };
    })
    .filter(function (row) {
      return row.tienePlan;
    })
    .sort(function (a, b) {
      return b.p - a.p;
    });

  /** PRs del alumno seleccionado (historial completo de ese alumno, nunca el de otros). */
  var alumnoPrEvents = alumnoSel ? buildPrEvents(progresoGlobal[alumnoSel] || []) : [];
  var prsPeriod = countPrEventsBetween(alumnoPrEvents, start, end);
  var prsPrev = countPrEventsBetween(alumnoPrEvents, pStart, pEnd);
  var prDelta = prsPeriod - prsPrev;

  /** Volumen total (kg × reps) del alumno seleccionado en la ventana */
  function volumeBetween(t0, t1) {
    var vol = 0;
    for (var j = 0; j < selectedProgressRows.length; j++) {
      var r = selectedProgressRows[j];
      var d = parseProgresoDate(r.fecha);
      if (!d) continue;
      var tt = d.getTime();
      if (tt < t0 || tt > t1) continue;
      vol += rowVolumeKg(r);
    }
    return vol;
  }

  var volPeriod = volumeBetween(start, end);
  var volPrev = volumeBetween(pStart, pEnd);
  var semanasPeriodo = Math.max(1, bounds.durDays / 7);
  var volSemPromKg = volPeriod / semanasPeriodo;
  var volPrevSemPromKg = volPrev / semanasPeriodo;
  var volKgDelta = volSemPromKg - volPrevSemPromKg;

  /** Adherencia promedio (solo alumnos con plan) */
  var adherSum = 0;
  var adherN = 0;
  var adherPrevSum = 0;
  var adherPrevN = 0;
  alumnos.forEach(function (a) {
    var ad = adherenceForAlumno(a.id, start, end);
    if (!ad.tienePlan) return;
    adherSum += ad.pct;
    adherN++;
    adherPrevSum += adherenceForAlumno(a.id, pStart, pEnd).pct;
    adherPrevN++;
  });
  var adherAvg = adherN > 0 ? Math.round(adherSum / adherN) : 0;
  var adherAvgPrev = adherPrevN > 0 ? Math.round(adherPrevSum / adherPrevN) : 0;
  var adherDeltaPct = adherAvg - adherAvgPrev;

  /** Estancados: rutina + actividad en últimos 21d pero sin PR en esa ventana */
  var cutoffStall = Date.now() - 21 * DAY_MS;

  function hadActivityRecent(aid) {
    for (var s = 0; s < sesionesGlobales.length; s++) {
      var ses = sesionesGlobales[s];
      if (String(ses.alumno_id) !== String(aid)) continue;
      var dt = parseSessionDate(ses);
      if (dt && dt.getTime() >= cutoffStall) return true;
    }
    var regs = progresoGlobal[aid] || [];
    for (var r = 0; r < regs.length; r++) {
      var dd = parseProgresoDate(regs[r].fecha);
      if (dd && dd.getTime() >= cutoffStall) return true;
    }
    return false;
  }

  var stalled = 0;
  alumnos.forEach(function (a) {
    var rut = getRoutineForAlumno(rutinasSBEntrenador, a.id);
    if (!rut) return;
    if (!hadActivityRecent(a.id)) return;
    if (countPrEventsBetween(buildPrEvents(progresoGlobal[a.id] || []), cutoffStall, end) === 0) stalled++;
  });

  /** Evolución de carga: semanas de la rutina activa del alumno seleccionado. */
  var LOAD_BLOCK_WEEKS = 4;
  var series = [];
  var weekLabels = [];
  for (var wi = 0; wi < LOAD_BLOCK_WEEKS; wi++) {
    var wkStartMs = routineWeekContext.weekStarts[wi];
    var wkEndMs = wkStartMs + 7 * DAY_MS;
    weekLabels.push(M(lang, "Semana " + (wi + 1), "Week " + (wi + 1), "Semana " + (wi + 1)));
    var maxKg = null;
    if (alumnoSel && ejercicioSelId) {
      var rows = selectedProgressRows;
      for (var ri = 0; ri < rows.length; ri++) {
        var rr = rows[ri];
        if (String(rr.ejercicio_id) !== String(ejercicioSelId)) continue;
        var dd = parseProgresoDate(rr.fecha);
        if (!dd) continue;
        var tt = dd.getTime();
        if (tt >= wkStartMs && tt < wkEndMs) {
          var kgv = parseFloat(rr.kg) || 0;
          if (kgv > 0 && (maxKg == null || kgv > maxKg)) maxKg = kgv;
        }
      }
    }
    series.push(maxKg == null ? null : Math.round(maxKg * 10) / 10);
  }

  /** PRs recientes: solo eventos del alumno seleccionado (alumnoPrEvents, ya ordenados del más reciente). */
  var prEvents = alumnoPrEvents.map(function (ev) {
    return Object.assign({ alumno_id: alumnoSel }, ev);
  });

  function fmtRel(ms, loc) {
    if (!ms) return "—";
    var d = new Date(ms);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    var diff = Math.round((today - dd) / DAY_MS);
    if (diff === 0) return M(loc, "Hoy", "Today", "Hoje");
    if (diff === 1) return M(loc, "Ayer", "Yesterday", "Ontem");
    if (diff < 7) return M(loc, "Hace " + diff + "d", diff + "d ago", "Há " + diff + "d");
    var l = loc === "es" ? "es-AR" : loc === "pt" ? "pt-BR" : "en-US";
    return d.toLocaleDateString(l, { day: "2-digit", month: "short" });
  }

  var prsRecientes = prEvents.slice(0, 8).map(function (ev) {
    var alum = alumnos.find(function (x) {
      return String(x.id) === String(ev.alumno_id);
    });
    var label = alum ? alum.nombre || alum.email : "—";
    var ini = alum ? initialsFromName(alum.nombre, alum.email) : "?";
    var idx = alumnos.findIndex(function (x) {
      return String(x.id) === String(ev.alumno_id);
    });
    var col = idx >= 0 ? PALETTE[Math.abs(idx) % PALETTE.length] : PALETTE[0];
    return {
      initials: ini,
      n: label,
      ex: exName(exMap, ev.ejercicio_id, lang),
      val: Math.round(ev.kg * 10) / 10 + " kg",
      delta: ev.prevKg != null ? "+" + Math.round(ev.deltaKg * 10) / 10 + " kg" : M(lang, "Nuevo PR", "New PR", "Novo PR"),
      date: fmtRel(ev.fechaMs, lang),
      color: col,
    };
  });

  /** Volumen semanal: alumno seleccionado + rutina activa. */
  var volBars = [];
  var maxVol = 0;
  for (var wv = 0; wv < LOAD_BLOCK_WEEKS; wv++) {
    var wkStartMsV = routineWeekContext.weekStarts[wv];
    var wkEndMsV = wkStartMsV + 7 * DAY_MS;
    var vsum = 0;
    selectedProgressRows.forEach(function (r) {
      var d = parseProgresoDate(r.fecha);
      if (!d) return;
      var t = d.getTime();
      if (t >= wkStartMsV && t < wkEndMsV) {
        vsum += rowVolumeKg(r);
      }
    });
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
    };
  });

  /** Volumen por patrón: semana actual de la rutina activa; 1 fila progreso = 1 serie. */
  var gStart = routineWeekContext.currentWeekStartMs;
  var gEnd = routineWeekContext.currentWeekEndMs;
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
    var d = parseProgresoDate(r.fecha);
    if (!d) return;
    var t = d.getTime();
    if (t < gStart || t >= gEnd) return;
    var ex = exMap[r.ejercicio_id];
    var mk = patternToMovementKey(ex ? ex.pattern : "");
    if (!mk) return;
    volByKey[mk] += rowVolumeKg(r);
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

  /** EQUIPO: global, no depende de alumnoSel (solo del período). */
  var teamChips = [
    {
      key: "teamAdherence",
      value: adherN > 0 ? adherAvg : null,
      val: adherN > 0 ? adherAvg + "%" : "—",
      color: "#3b82f6",
      label: M(lang, "Adherencia promedio del equipo", "Team avg. adherence", "Aderência média da equipe"),
      delta:
        adherN > 0
          ? (adherDeltaPct >= 0 ? "↑ " : "↓ ") + Math.abs(adherDeltaPct) + "% " + vsPrev
          : noData,
      deltaColor: adherDeltaPct >= 0 ? "#22c55e" : "#ef4444",
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
    },
  ];

  /** ALUMNO seleccionado: solo sesiones/progreso de alumnoSel. Volumen en kg (kg × reps). */
  var selAlumno = alumnoSel
    ? alumnos.find(function (x) {
        return String(x.id) === String(alumnoSel);
      })
    : null;
  var selName = selAlumno ? selAlumno.nombre || selAlumno.email || "—" : "";
  var selAd = alumnoSel ? adherenceForAlumno(alumnoSel, start, end) : null;
  var selAdPrev = alumnoSel ? adherenceForAlumno(alumnoSel, pStart, pEnd) : null;
  var selAdDelta = selAd && selAdPrev ? selAd.pct - selAdPrev.pct : 0;
  var selHasAd = !!(selAd && selAd.tienePlan);
  var alumnoChips = [
    {
      key: "alumnoAdherence",
      value: selHasAd ? selAd.pct : null,
      val: selHasAd ? selAd.pct + "%" : "—",
      color: "#3b82f6",
      label: M(lang, "Adherencia de " + selName, selName + " adherence", "Aderência de " + selName),
      delta: selHasAd ? (selAdDelta >= 0 ? "↑ " : "↓ ") + Math.abs(selAdDelta) + "% " + vsPrev : noData,
      deltaColor: selAdDelta >= 0 ? "#22c55e" : "#ef4444",
    },
    {
      key: "alumnoPrs",
      value: prsPeriod,
      val: String(prsPeriod),
      color: "#22c55e",
      label: M(lang, "PRs en el período", "PRs in the period", "PRs no período"),
      delta:
        prsPrev > 0 || prsPeriod > 0
          ? (prDelta >= 0 ? "↑ " : "↓ ") + Math.abs(prDelta) + " " + vsPrev
          : noData,
      deltaColor: prDelta >= 0 ? "#22c55e" : "#eab308",
    },
    {
      key: "alumnoVolume",
      value: volSemPromKg,
      val: volPeriod > 0 ? Math.round(volSemPromKg) + " kg" : "—",
      color: "#eab308",
      label: M(lang, "Volumen semanal prom.", "Avg. weekly volume", "Volume semanal médio"),
      delta:
        volPeriod > 0
          ? (volKgDelta >= 0 ? "↑ " : "↓ ") + Math.abs(Math.round(volKgDelta)) + " kg " + M(lang, "vs ant.", "vs prev.", "vs ant.")
          : noData,
      deltaColor: volKgDelta >= 0 ? "#22c55e" : "#ef4444",
    },
  ];

  /**
   * COMPATIBILIDAD TEMPORAL: ProgresoView todavía consume `summaryChips` (4 chips, orden histórico).
   * Se compone con los chips nuevos (ya no mezcla globales con alumno: adherencia/estancados = equipo,
   * PRs/volumen = alumno seleccionado). Se elimina cuando la vista pase a teamChips/alumnoChips.
   */
  var summaryChips = [teamChips[0], alumnoChips[1], alumnoChips[2], teamChips[1]];

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
    summaryChips: summaryChips, // compat temporal, ver comentario arriba
    prsPeriod: prsPeriod,
    prsPrev: prsPrev,
    volSemPromKg: volSemPromKg,
    volKgDelta: volKgDelta,
    chartSeries: series,
    chartWeekLabels: weekLabels,
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
