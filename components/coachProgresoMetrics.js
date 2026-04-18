/**
 * Métricas agregadas para la vista Progreso del entrenador (datos reales).
 * Fuentes: alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador, catálogo allEx.
 */

import { FALLBACK_EXERCISE_NAME } from "../lib/exerciseResolve.js";

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

function exName(exMap, ejId, es) {
  var e = exMap[ejId];
  if (e && (e.name || e.nameEn)) return es ? e.name || e.nameEn : e.nameEn || e.name;
  return FALLBACK_EXERCISE_NAME[es ? "es" : "en"];
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
  var list = rutinasSBEntrenador || [];
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].alumno_id) === String(alumnoId)) return list[i];
  }
  return null;
}

/**
 * Ejercicios de un día concreto de la rutina (orden: calentamiento → principal; sin duplicar id).
 */
export function exercisesForRoutineDay(rutinasSBEntrenador, alumnoId, dayIdx, exMap, es) {
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
        name: exName(exMap, ex.id, es),
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
  var es = params.es !== false;

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

  var alumnoRows = alumnos.map(function (a, idx) {
    return {
      id: a.id,
      label: a.nombre || a.email || "—",
      initials: initialsFromName(a.nombre, a.email),
      color: PALETTE[Math.abs(idx) % PALETTE.length],
    };
  });

  /** Adherencia: sesiones completadas vs planificadas en el período */
  function adherenceForAlumno(aid) {
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
      if (t >= start && t <= end) completed++;
    }
    var pct = planned > 0 ? Math.min(100, Math.round((100 * completed) / planned)) : completed > 0 ? 100 : 0;
    return { planned: planned, completed: completed, pct: pct, tienePlan: planned > 0 };
  }

  var adherenciaRows = alumnos
    .map(function (a) {
      var ad = adherenceForAlumno(a.id);
      return {
        id: a.id,
        n: a.nombre || a.email || "—",
        p: ad.pct,
        color: pctColor(ad.pct),
        tienePlan: ad.tienePlan,
      };
    })
    .filter(function (row) {
      return row.tienePlan;
    })
    .sort(function (a, b) {
      return b.p - a.p;
    });

  /** PRs en rango: contar eventos donde kg supera el máximo previo por (alumno, ejercicio) */
  function countPRsBetween(t0, t1) {
    var flat = [];
    Object.keys(progresoGlobal).forEach(function (aid) {
      var rows = progresoGlobal[aid] || [];
      rows.forEach(function (r) {
        flat.push({
          alumno_id: aid,
          ejercicio_id: r.ejercicio_id,
          kg: parseFloat(r.kg) || 0,
          reps: parseInt(r.reps, 10) || 0,
          fecha: r.fecha,
        });
      });
    });
    flat.sort(function (a, b) {
      var da = parseProgresoDate(a.fecha);
      var db = parseProgresoDate(b.fecha);
      var ta = da ? da.getTime() : 0;
      var tb = db ? db.getTime() : 0;
      return ta - tb;
    });
    var best = {};
    var count = 0;
    for (var i = 0; i < flat.length; i++) {
      var row = flat[i];
      if (row.kg <= 0) continue;
      var key = row.alumno_id + "::" + row.ejercicio_id;
      var prev = best[key] != null ? best[key] : -1;
      var d = parseProgresoDate(row.fecha);
      var t = d ? d.getTime() : 0;
      if (t >= t0 && t <= t1 && row.kg > prev) {
        count++;
      }
      if (row.kg > prev) best[key] = row.kg;
    }
    return count;
  }

  var prsPeriod = countPRsBetween(start, end);
  var prsPrev = countPRsBetween(pStart, pEnd);
  var prDelta = prsPeriod - prsPrev;

  /** Volumen total kg*reps en período */
  function volumeBetween(t0, t1) {
    var vol = 0;
    Object.keys(progresoGlobal).forEach(function (aid) {
      var rows = progresoGlobal[aid] || [];
      for (var j = 0; j < rows.length; j++) {
        var r = rows[j];
        var d = parseProgresoDate(r.fecha);
        if (!d) continue;
        var tt = d.getTime();
        if (tt < t0 || tt > t1) continue;
        var kg = parseFloat(r.kg) || 0;
        var reps = parseInt(r.reps, 10) || 0;
        vol += kg * Math.max(1, reps);
      }
    });
    return vol;
  }

  var volPeriod = volumeBetween(start, end);
  var volPrev = volumeBetween(pStart, pEnd);
  var semanasPeriodo = Math.max(1, bounds.durDays / 7);
  var volSemPromTon = volPeriod / semanasPeriodo / 1000;
  var volPrevSemProm = volPrev / semanasPeriodo / 1000;
  var volTonDelta = volSemPromTon - volPrevSemProm;

  /** Adherencia promedio (solo alumnos con plan) */
  var adherSum = 0;
  var adherN = 0;
  alumnos.forEach(function (a) {
    var ad = adherenceForAlumno(a.id);
    if (ad.tienePlan) {
      adherSum += ad.pct;
      adherN++;
    }
  });
  var adherAvg = adherN > 0 ? Math.round(adherSum / adherN) : 0;

  var adherPrevSum = 0;
  var adherPrevN = 0;
  alumnos.forEach(function (a) {
    var rut = getRoutineForAlumno(rutinasSBEntrenador, a.id);
    var diasPorSemana = rut && rut.datos && rut.datos.days ? rut.datos.days.length : 0;
    var semanas = Math.max(1, Math.ceil(bounds.durDays / 7));
    var planned = diasPorSemana > 0 ? diasPorSemana * semanas : 0;
    if (planned <= 0) return;
    var completed = 0;
    for (var s = 0; s < sesionesGlobales.length; s++) {
      var ses = sesionesGlobales[s];
      if (String(ses.alumno_id) !== String(a.id)) continue;
      var dt = parseSessionDate(ses);
      if (!dt) continue;
      var t = dt.getTime();
      if (t >= pStart && t <= pEnd) completed++;
    }
    var pct = Math.min(100, Math.round((100 * completed) / planned));
    adherPrevSum += pct;
    adherPrevN++;
  });
  var adherAvgPrev = adherPrevN > 0 ? Math.round(adherPrevSum / adherPrevN) : 0;
  var adherDeltaPct = adherAvg - adherAvgPrev;

  /** Estancados: rutina + actividad en últimos 21d pero sin PR en esa ventana */
  var cutoffStall = Date.now() - 21 * DAY_MS;

  function countPRsForAlumnoBetween(aid, t0, t1) {
    var rows = progresoGlobal[aid] || [];
    var sorted = rows
      .slice()
      .sort(function (x, y) {
        var dx = parseProgresoDate(x.fecha);
        var dy = parseProgresoDate(y.fecha);
        return (dx ? dx.getTime() : 0) - (dy ? dy.getTime() : 0);
      });
    var best = {};
    var c = 0;
    for (var i = 0; i < sorted.length; i++) {
      var row = sorted[i];
      var kg = parseFloat(row.kg) || 0;
      if (kg <= 0) continue;
      var ej = row.ejercicio_id;
      var prev = best[ej] != null ? best[ej] : -1;
      var d = parseProgresoDate(row.fecha);
      var t = d ? d.getTime() : 0;
      if (t >= t0 && t <= t1 && kg > prev) c++;
      if (kg > prev) best[ej] = kg;
    }
    return c;
  }

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
    if (countPRsForAlumnoBetween(a.id, cutoffStall, end) === 0) stalled++;
  });

  /**
   * Evolución de carga: bloque actual de 4 semanas (lunes a domingo), alineado a la semana calendario.
   * Semana 1 = más antigua del bloque; Semana 4 = semana calendario actual (incluye hoy).
   */
  var LOAD_BLOCK_WEEKS = 4;
  var now = new Date();
  var currentMondayMs = weekKeyMon(now);
  var series = [];
  var weekLabels = [];
  for (var wi = 0; wi < LOAD_BLOCK_WEEKS; wi++) {
    var offsetWeeks = wi - (LOAD_BLOCK_WEEKS - 1);
    var wkStartMs = currentMondayMs + offsetWeeks * 7 * DAY_MS;
    var wkEndMs = wkStartMs + 7 * DAY_MS;
    weekLabels.push(es ? "Semana " + (wi + 1) : "Week " + (wi + 1));
    var maxKg = null;
    if (alumnoSel && ejercicioSelId) {
      var rows = progresoGlobal[alumnoSel] || [];
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

  /** PRs recientes (global): últimos eventos PR con fecha */
  var prEvents = [];
  var flatAll = [];
  Object.keys(progresoGlobal).forEach(function (aid) {
    (progresoGlobal[aid] || []).forEach(function (r) {
      flatAll.push({
        alumno_id: aid,
        ejercicio_id: r.ejercicio_id,
        kg: parseFloat(r.kg) || 0,
        fecha: r.fecha,
      });
    });
  });
  flatAll.sort(function (a, b) {
    var da = parseProgresoDate(a.fecha);
    var db = parseProgresoDate(b.fecha);
    return (da ? da.getTime() : 0) - (db ? db.getTime() : 0);
  });
  var bestG = {};
  for (var fi = 0; fi < flatAll.length; fi++) {
    var fr = flatAll[fi];
    if (fr.kg <= 0) continue;
    var k = fr.alumno_id + "::" + fr.ejercicio_id;
    var prevB = bestG[k] != null ? bestG[k] : -1;
    var df = parseProgresoDate(fr.fecha);
    var tf = df ? df.getTime() : 0;
    if (fr.kg > prevB) {
      var deltaKg = prevB < 0 ? fr.kg : fr.kg - prevB;
      prEvents.push({
        alumno_id: fr.alumno_id,
        ejercicio_id: fr.ejercicio_id,
        kg: fr.kg,
        deltaKg: deltaKg,
        prevKg: prevB >= 0 ? prevB : null,
        fechaMs: tf,
      });
      bestG[k] = fr.kg;
    }
  }
  prEvents.sort(function (a, b) {
    return b.fechaMs - a.fechaMs;
  });

  function fmtRel(ms, esLoc) {
    if (!ms) return "—";
    var d = new Date(ms);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var dd = new Date(d);
    dd.setHours(0, 0, 0, 0);
    var diff = Math.round((today - dd) / DAY_MS);
    if (diff === 0) return esLoc ? "Hoy" : "Today";
    if (diff === 1) return esLoc ? "Ayer" : "Yesterday";
    if (diff < 7) return esLoc ? "Hace " + diff + "d" : diff + "d ago";
    return d.toLocaleDateString(esLoc ? "es-AR" : "en-US", { day: "2-digit", month: "short" });
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
      ex: exName(exMap, ev.ejercicio_id, es),
      val: Math.round(ev.kg * 10) / 10 + " kg",
      delta: ev.prevKg != null ? "+" + Math.round(ev.deltaKg * 10) / 10 + " kg" : es ? "Nuevo PR" : "New PR",
      date: fmtRel(ev.fechaMs, es),
      color: col,
    };
  });

  /**
   * Volumen semanal (equipo): mismo bloque actual de 4 semanas que Evolución de carga
   * (lunes–dom, Semana 1 = más antigua, Semana 4 = actual). Suma kg×reps de todos los alumnos.
   */
  var volBars = [];
  var maxVol = 0;
  for (var wv = 0; wv < LOAD_BLOCK_WEEKS; wv++) {
    var offV = wv - (LOAD_BLOCK_WEEKS - 1);
    var wkStartMsV = currentMondayMs + offV * 7 * DAY_MS;
    var wkEndMsV = wkStartMsV + 7 * DAY_MS;
    var vsum = 0;
    Object.keys(progresoGlobal).forEach(function (aid) {
      (progresoGlobal[aid] || []).forEach(function (r) {
        var d = parseProgresoDate(r.fecha);
        if (!d) return;
        var t = d.getTime();
        if (t >= wkStartMsV && t < wkEndMsV) {
          var kg = parseFloat(r.kg) || 0;
          var reps = parseInt(r.reps, 10) || 0;
          vsum += kg * Math.max(1, reps);
        }
      });
    });
    volBars.push({
      v: vsum,
      s: es ? "Semana " + (wv + 1) : "Week " + (wv + 1),
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
    };
  });

  /** Volumen por patrón (5 claves) + series por ejercicio: bloque 4 semanas; 1 fila progreso = 1 serie */
  var gStart = Date.now() - 28 * DAY_MS;
  var volByKey = { empuje: 0, traccion: 0, rodilla: 0, bisagra: 0, core: 0 };
  /** @type {Record<string, Record<string, number>>} patternKey -> ejercicio_id -> series */
  var seriesByPatternAndEx = {
    empuje: {},
    traccion: {},
    rodilla: {},
    bisagra: {},
    core: {},
  };
  Object.keys(progresoGlobal).forEach(function (aid) {
    (progresoGlobal[aid] || []).forEach(function (r) {
      var d = parseProgresoDate(r.fecha);
      if (!d || d.getTime() < gStart) return;
      var ex = exMap[r.ejercicio_id];
      var mk = patternToMovementKey(ex ? ex.pattern : "");
      if (!mk) return;
      var kg = parseFloat(r.kg) || 0;
      var reps = parseInt(r.reps, 10) || 0;
      volByKey[mk] += kg * Math.max(1, reps);
      var ejId = r.ejercicio_id;
      if (ejId == null) return;
      var sid = String(ejId);
      var bag = seriesByPatternAndEx[mk];
      bag[sid] = (bag[sid] || 0) + 1;
    });
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
          name: exName(exMap, ejId, es),
          series: bag[ejId],
        };
      })
      .sort(function (a, b) {
        return b.series - a.series;
      });
    return {
      key: def.key,
      label: es ? def.labelEs : def.labelEn,
      p: pct,
      vol: v,
      color: def.color,
      exercises: exercises,
    };
  });

  /** Chips resumen */
  var summaryChips = [
    {
      val: adherN > 0 ? adherAvg + "%" : "—",
      color: "#3b82f6",
      label: es ? "Adherencia promedio" : "Avg. adherence",
      delta:
        adherN > 0
          ? (adherDeltaPct >= 0 ? "↑ " : "↓ ") +
            Math.abs(adherDeltaPct) +
            "% " +
            (es ? "vs período anterior" : "vs prev. period")
          : es
            ? "Sin datos suficientes"
            : "Not enough data",
      deltaColor: adherDeltaPct >= 0 ? "#22c55e" : "#ef4444",
    },
    {
      val: String(prsPeriod),
      color: "#22c55e",
      label: es ? "PRs este período" : "PRs this period",
      delta:
        prsPrev > 0 || prsPeriod > 0
          ? (prDelta >= 0 ? "↑ " : "↓ ") + Math.abs(prDelta) + " " + (es ? "vs período anterior" : "vs prev.")
          : es
            ? "Sin datos suficientes"
            : "Not enough data",
      deltaColor: prDelta >= 0 ? "#22c55e" : "#eab308",
    },
    {
      val: volPeriod > 0 ? volSemPromTon.toFixed(1) + "t" : "—",
      color: "#eab308",
      label: es ? "Volumen semanal prom." : "Avg. weekly volume",
      delta:
        volPeriod > 0
          ? (volTonDelta >= 0 ? "↑ " : "↓ ") + Math.abs(volTonDelta).toFixed(2) + "t " + (es ? "vs ant." : "vs prev.")
          : es
            ? "Sin datos suficientes"
            : "Not enough data",
      deltaColor: volTonDelta >= 0 ? "#22c55e" : "#ef4444",
    },
    {
      val: String(stalled),
      color: stalled > 0 ? "#ef4444" : "#71717a",
      label: es ? "Alumnos estancados" : "Athletes stalled",
      delta:
        es
          ? "Sin mejora (PR) en 3 sem. · con rutina"
          : "No PR in 3 wks · with plan",
      deltaColor: stalled > 0 ? "#ef4444" : "#71717a",
    },
  ];

  var exerciseOptions = exercisesForRoutineDay(rutinasSBEntrenador, alumnoSel, diaIdx, exMap, es);

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
    summaryChips: summaryChips,
    chartSeries: series,
    chartWeekLabels: weekLabels,
    hasChartData: series.some(function (v) {
      return v != null;
    }),
  };
}

export { PALETTE };

export function colorForAlumnoIndex(i) {
  return PALETTE[Math.abs(i) % PALETTE.length];
}
