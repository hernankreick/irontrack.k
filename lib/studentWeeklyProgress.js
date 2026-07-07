import { getRutinaAlumnoId } from './routineStore.js';

function toId(v) {
  return v == null || v === "" ? "" : String(v);
}

function parseLocalDateMs(value) {
  if (!value) return null;
  if (value instanceof Date) {
    var t0 = value.getTime();
    return Number.isFinite(t0) ? t0 : null;
  }
  var raw = String(value).trim();
  var m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    var d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    var t = d.getTime();
    return Number.isFinite(t) ? t : null;
  }
  var t2 = new Date(raw).getTime();
  return Number.isFinite(t2) ? t2 : null;
}

function getRoutineDays(rutina) {
  return (rutina && rutina.datos && Array.isArray(rutina.datos.days))
    ? rutina.datos.days
    : (rutina && Array.isArray(rutina.days) ? rutina.days : []);
}

function normalizeWeekNumber(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 4) return Math.floor(n);
  if (n >= 0 && n <= 3) return Math.floor(n) + 1;
  return null;
}

function getPersistedActiveWeekNumber(rutina) {
  var datos = rutina && rutina.datos ? rutina.datos : {};
  return normalizeWeekNumber(
    datos.semana_activa != null ? datos.semana_activa :
    datos.semanaActiva != null ? datos.semanaActiva :
    datos.activeWeek != null ? datos.activeWeek :
    datos.currentWeek
  );
}

function getRutinaStartMs(rutina) {
  return parseLocalDateMs(
    rutina && (
      rutina.fecha_inicio ||
      rutina.fechaInicio ||
      rutina.created_at ||
      (rutina.datos && (rutina.datos.fecha_inicio || rutina.datos.fechaInicio))
    )
  );
}

function mondayStartMs(ms) {
  var d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

function weekFromDate(rutina, sessionMs, nowMs, currentWeek) {
  var start = getRutinaStartMs(rutina);
  if (start != null && sessionMs != null) {
    var idx = Math.floor((mondayStartMs(sessionMs) - mondayStartMs(start)) / (7 * 86400000));
    if (idx >= 0) return Math.min(idx, 3) + 1;
  }
  if (sessionMs != null && nowMs != null) {
    var nowWeek = mondayStartMs(nowMs);
    var sesWeek = mondayStartMs(sessionMs);
    if (sesWeek === nowWeek && currentWeek != null) return Number(currentWeek) + 1;
  }
  return currentWeek != null ? Number(currentWeek) + 1 : 1;
}

function isCompletedSession(s) {
  return !(s && (s.estado === "pendiente" || s.completada === false));
}

function sessionMatchesRoutine(s, rutinaId, rutinaNombre) {
  if (!rutinaId) return true;
  if (s && s.rutina_id != null && s.rutina_id !== "") return toId(s.rutina_id) === rutinaId;
  if (rutinaNombre) return String(s && s.rutina_nombre || "") === rutinaNombre;
  return false;
}

function normalizeDiaIdx(s, totalDays) {
  var raw = s && (s.dia_idx != null ? s.dia_idx : (s.diaIndex != null ? s.diaIndex : s.dia));
  var n = Number(raw);
  if (Number.isFinite(n)) {
    if (n >= 0 && n < totalDays) return n;
    if (n >= 1 && n <= totalDays) return n - 1;
  }
  return null;
}

function normalizeProgressList(progreso, alumnoId) {
  if (Array.isArray(progreso)) return progreso;
  if (progreso && alumnoId && Array.isArray(progreso[alumnoId])) return progreso[alumnoId];
  return [];
}

export function getStudentWeeklyProgress({
  alumno,
  rutina,
  sesiones,
  progreso,
  completedDays,
  currentWeek,
  now,
}) {
  var alumnoId = toId(alumno && typeof alumno === "object" ? alumno.id : alumno);
  var rutinaId = toId(rutina && rutina.id);
  var rutinaNombre = rutina && (rutina.nombre || rutina.name) ? String(rutina.nombre || rutina.name) : "";
  var days = getRoutineDays(rutina);
  var totalDays = days.length;
  var nowMs = now ? parseLocalDateMs(now) : Date.now();
  var fallbackWeekIndex = Number.isFinite(Number(currentWeek)) ? Number(currentWeek) : 0;
  var persistedWeekNumber = getPersistedActiveWeekNumber(rutina);

  var relevantSessions = (sesiones || []).filter(function (s) {
    return s && toId(s.alumno_id) === alumnoId && isCompletedSession(s) && sessionMatchesRoutine(s, rutinaId, rutinaNombre);
  }).map(function (s) {
    var sessionMs = parseLocalDateMs(s.created_at || s.fecha);
    var explicitWeek = Number(s.semana);
    var weekNumber = Number.isFinite(explicitWeek) && explicitWeek > 0
      ? explicitWeek
      : weekFromDate(rutina, sessionMs, nowMs, fallbackWeekIndex);
    return {
      raw: s,
      ms: sessionMs,
      weekNumber: weekNumber,
      dayIdx: normalizeDiaIdx(s, totalDays),
    };
  });

  var sessionWeekNumber = relevantSessions.length
    ? Math.max.apply(null, relevantSessions.map(function (s) { return s.weekNumber || 1; }))
    : null;
  var currentWeekNumber = persistedWeekNumber != null
    ? Math.max(sessionWeekNumber || 1, persistedWeekNumber)
    : Math.max(sessionWeekNumber || 1, fallbackWeekIndex + 1);
  var currentWeekIndex = Math.max(0, currentWeekNumber - 1);

  var dayDone = {};
  relevantSessions.forEach(function (s) {
    if (s.weekNumber !== currentWeekNumber) return;
    if (s.dayIdx != null) {
      dayDone[s.dayIdx] = true;
      return;
    }
    var dateKey = s.ms != null ? new Date(s.ms).toISOString().slice(0, 10) : "session-" + Object.keys(dayDone).length;
    dayDone["date:" + dateKey] = true;
  });
  var sessionDayKeys = Object.keys(dayDone);
  var sessionsUsed = relevantSessions
    .filter(function (s) { return s.weekNumber === currentWeekNumber; })
    .map(function (s) { return s.raw; });
  var completedDaysFromSessions = sessionDayKeys.length;
  var realSessionsCount = sessionsUsed.length;

  var source = relevantSessions.length ? "sesiones" : "completedDays";
  if (!relevantSessions.length && rutinaId) {
    (completedDays || []).forEach(function (key) {
      var text = String(key);
      if (!text.startsWith(rutinaId + "-") || !text.endsWith("-w" + currentWeekIndex)) return;
      var m = text.match(/-(\d+)-w\d+$/);
      dayDone[m ? Number(m[1]) : text] = true;
    });
  }

  if (Object.keys(dayDone).length === 0 && relevantSessions.length === 0) {
    var prog = normalizeProgressList(progreso, alumnoId);
    prog.forEach(function (r) {
      var t = parseLocalDateMs(r && (r.fecha || r.date || r.created_at));
      if (t == null || mondayStartMs(t) !== mondayStartMs(nowMs)) return;
      dayDone["prog:" + new Date(t).toISOString().slice(0, 10)] = true;
    });
    if (Object.keys(dayDone).length > 0) source = "progreso";
  }

  var completed = Math.min(totalDays || Object.keys(dayDone).length, Object.keys(dayDone).length);
  var pct = totalDays > 0 ? Math.min(100, Math.round((completed / totalDays) * 100)) : 0;
  var completedDayIndexes = Object.keys(dayDone)
    .map(function (k) { return Number(k); })
    .filter(function (n) { return Number.isFinite(n) && n >= 0; });
  var estado = currentWeekIndex >= 3 ? "completada" : "activa";

  return {
    alumnoId: alumnoId,
    rutinaId: rutinaId,
    weekNumber: currentWeekNumber,
    weekIndex: currentWeekIndex,
    totalDays: totalDays,
    completedDays: completed,
    completedDayIndexes: completedDayIndexes,
    pct: pct,
    sesiones: relevantSessions.map(function (s) { return s.raw; }),
    sessionsUsed: sessionsUsed,
    realSessionsCount: realSessionsCount,
    completedDaysFromSessions: completedDaysFromSessions,
    source: source,
    estado: estado,
  };
}

export function getActiveStudentRoutinePosition(params) {
  var p = params || {};
  var weekly = getStudentWeeklyProgress({
    alumno: p.alumno,
    rutina: p.rutina,
    sesiones: p.sesiones,
    progreso: p.progreso,
    completedDays: p.completedDays,
    currentWeek: p.currentWeek,
    now: p.now,
  });
  var totalDaysInWeek = weekly.totalDays || 0;
  var completedDaysInWeek = weekly.completedDays || 0;
  return {
    currentWeek: weekly.weekIndex,
    currentDayIndex: totalDaysInWeek > 0 && completedDaysInWeek < totalDaysInWeek ? completedDaysInWeek : null,
    completedDaysInWeek: completedDaysInWeek,
    totalDaysInWeek: totalDaysInWeek,
    weekNumber: weekly.weekNumber,
    weekIndex: weekly.weekIndex,
    completedDayIndexes: weekly.completedDayIndexes || [],
    weeklyProgress: weekly,
  };
}

export function getStudentRoutine(rutinas, alumno) {
  var alumnoId = toId(alumno && typeof alumno === "object" ? alumno.id : alumno);
  return (rutinas || []).find(function (r) {
    return toId(getRutinaAlumnoId(r)) === alumnoId;
  }) || null;
}
