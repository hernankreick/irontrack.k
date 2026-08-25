import { normalizeFecha } from "./normalizeFecha.js";

export function normalizeWorkoutKg(kg) {
  var parsed = parseFloat(kg);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeWorkoutReps(reps) {
  var parsed = parseInt(reps, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeWorkoutSet(input) {
  var set = input || {};
  return {
    kg: normalizeWorkoutKg(set.kg),
    reps: normalizeWorkoutReps(set.reps),
    date: set.date || set.fecha || "",
    week: set.week,
    note: set.note || set.nota || "",
    rpe: set.rpe || null,
  };
}

export function exerciseHasTimeTarget(exercise) {
  if (!exercise) return false;
  var fields = [
    exercise.duration,
    exercise.duracion,
    exercise.time,
    exercise.tiempo,
    exercise.seconds,
    exercise.segundos,
    exercise.reps,
  ];
  return fields.some(function (value) {
    return /("|''|seg|sec|seconds|s\b|min|time|tiempo|duraci)/i.test(String(value || ""));
  });
}

export function exerciseHasSuggestedLoad(exercise) {
  if (exerciseIsBodyweightLike(exercise)) return false;
  if (!exercise || exercise.kg == null) return false;
  var raw = String(exercise.kg).trim();
  if (!raw) return false;
  return normalizeWorkoutKg(raw) > 0;
}

export function exerciseIsBodyweightLike(exercise) {
  if (!exercise) return false;
  var text = [
    exercise.name,
    exercise.nameEn,
    exercise.nombre,
    exercise.id,
    exercise.pattern,
    exercise.muscle,
    exercise.equip,
  ].join(" ").toLowerCase();
  return /(plancha|plank|puente|bridge|movilidad|mobility|stretch|stretching|estiramiento|core|peso corporal|bodyweight|sin peso|libre|paralelas|colchoneta|dominada|dominadas|pull[\s-]?up|chin[\s-]?up|fondos|dips?\b|push[\s-]?up|flexion|flexiones|abdominal|abdominales|crunch|hollow|burpee|saltos?|jump|trote|jog|skipping|high knees)/i.test(text);
}

export function resolveWorkoutRepsInput(reps, exercise) {
  var parsed = normalizeWorkoutReps(reps);
  if (parsed > 0) return parsed;
  if (!exerciseHasTimeTarget(exercise)) return 0;
  return (
    normalizeWorkoutReps(exercise.duration) ||
    normalizeWorkoutReps(exercise.duracion) ||
    normalizeWorkoutReps(exercise.time) ||
    normalizeWorkoutReps(exercise.tiempo) ||
    normalizeWorkoutReps(exercise.seconds) ||
    normalizeWorkoutReps(exercise.segundos) ||
    normalizeWorkoutReps(exercise.reps)
  );
}

export function canLogWorkoutSet(exercise, kg, reps) {
  if (resolveWorkoutRepsInput(reps, exercise) <= 0) return false;
  if (!exerciseHasSuggestedLoad(exercise)) return true;
  return normalizeWorkoutKg(kg) > 0;
}

export function formatWorkoutDuration(value) {
  var raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  var n = normalizeWorkoutReps(raw);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return n >= 60 && n % 60 === 0 ? (n / 60) + "'" : n + '"';
}

export function formatWorkoutSetLabel(exercise, set) {
  var ex = exercise || {};
  var s = set || {};
  var reps = normalizeWorkoutReps(s.reps);
  var kg = normalizeWorkoutKg(s.kg);
  if (exerciseHasSuggestedLoad(ex)) {
    return kg + "kg × " + reps;
  }
  if (exerciseHasTimeTarget(ex)) {
    return formatWorkoutDuration(reps);
  }
  return reps + " reps";
}

export function buildExerciseSetRecord(kg, reps, date, week, note, rpe) {
  return normalizeWorkoutSet({
    kg: kg,
    reps: reps,
    date: date,
    week: week,
    note: note,
    rpe: rpe,
  });
}

export function calculateSetVolume(set) {
  var normalized = normalizeWorkoutSet(set);
  return normalized.kg * normalized.reps;
}

export function calculateSetsVolume(sets) {
  return (Array.isArray(sets) ? sets : []).reduce(function (acc, set) {
    return acc + calculateSetVolume(set);
  }, 0);
}

export function getExerciseSets(progress, exerciseId) {
  var entry = progress && exerciseId != null ? progress[exerciseId] : null;
  return entry && Array.isArray(entry.sets) ? entry.sets : [];
}

export function filterSetsByDay(sets, date, currentWeek, checkWeek) {
  return (Array.isArray(sets) ? sets : []).filter(function (set) {
    if (!set || set.date !== date) return false;
    if (!checkWeek) return true;
    return set.week === undefined || set.week === currentWeek;
  });
}

export function getExerciseSetsForDay(progress, exerciseId, date, currentWeek, options) {
  var opts = options || {};
  return filterSetsByDay(getExerciseSets(progress, exerciseId), date, currentWeek, opts.checkWeek !== false);
}

export function getWorkoutExerciseStatus(params) {
  var p = params || {};
  var exercise = p.exercise || null;
  var setsToday = exercise
    ? getExerciseSetsForDay(p.progress, exercise.id, p.date, p.currentWeek, { checkWeek: p.checkWeek !== false })
    : [];
  var totalSets = parseInt(exercise && exercise.sets, 10) || 3;
  return {
    setsToday: setsToday,
    totalSets: totalSets,
    remainingSets: Math.max(0, totalSets - setsToday.length),
    currentSetNumber: setsToday.length + 1,
    lastSet: setsToday[0],
    pr: exercise && p.progress && p.progress[exercise.id] ? p.progress[exercise.id].max || 0 : 0,
    isDone: setsToday.length >= totalSets,
    volume: calculateSetsVolume(setsToday),
  };
}

export function calculateDayProgress(exercises, progress, date, currentWeek, options) {
  var list = Array.isArray(exercises) ? exercises : [];
  var opts = options || {};
  var done = list.filter(function (exercise) {
    return getExerciseSetsForDay(progress, exercise.id, date, currentWeek, { checkWeek: opts.checkWeek === true }).length > 0;
  }).length;
  return {
    done: done,
    total: list.length,
    pct: list.length > 0 ? (done / list.length) * 100 : 0,
  };
}

export function updateExerciseProgressRecord(currentProgressEntry, newSet) {
  var current = currentProgressEntry || { sets: [], max: 0 };
  var sets = Array.isArray(current.sets) ? current.sets : [];
  var normalized = normalizeWorkoutSet(newSet);
  return Object.assign({}, current, {
    sets: [normalized].concat(sets).slice(0, 50),
    max: Math.max(current.max || 0, normalized.kg),
  });
}

export function updateExerciseKgInRoutineDays(days, exerciseId, kg) {
  return (Array.isArray(days) ? days : []).map(function (day) {
    return Object.assign({}, day, {
      exercises: (day.exercises || []).map(function (exercise) {
        return exercise.id === exerciseId ? Object.assign({}, exercise, { kg: String(kg) }) : exercise;
      }),
      warmup: (day.warmup || []).map(function (exercise) {
        return exercise.id === exerciseId ? Object.assign({}, exercise, { kg: String(kg) }) : exercise;
      }),
    });
  });
}

export function updateExerciseKgInRoutines(routines, exerciseId, kg) {
  return (Array.isArray(routines) ? routines : []).map(function (routine) {
    return Object.assign({}, routine, {
      days: updateExerciseKgInRoutineDays(routine.days, exerciseId, kg),
    });
  });
}

export function calculateNewWeightPR(currentProgressEntry, kg) {
  var previousMax = currentProgressEntry && currentProgressEntry.max ? currentProgressEntry.max : 0;
  var newKg = normalizeWorkoutKg(kg);
  if (!(newKg > previousMax && previousMax > 0)) return null;
  return {
    kg: newKg,
    prevKg: previousMax,
    diff: Math.round((newKg - previousMax) * 10) / 10,
  };
}

export function buildCompletedDayKey(session, currentWeek) {
  if (!session) return "";
  return session.rId + "-" + session.dIdx + "-w" + currentWeek;
}

export function mergeCompletedDay(completedDays, dayKey) {
  var list = Array.isArray(completedDays) ? completedDays : [];
  if (!dayKey || list.includes(dayKey)) return list;
  return list.concat([dayKey]);
}

export function countCompletedDaysForWeek(completedDays, routineId, currentWeek) {
  var list = Array.isArray(completedDays) ? completedDays : [];
  return list.filter(function (key) {
    return String(key).startsWith(routineId + "-") && String(key).endsWith("-w" + currentWeek);
  }).length;
}

export function getWorkoutDayExercises(day) {
  if (!day) return [];
  return [].concat(day.warmup || [], day.exercises || []);
}

export function calculateWorkoutVolume(exercises, progress, date) {
  return (Array.isArray(exercises) ? exercises : []).reduce(function (acc, exercise) {
    var sets = getExerciseSetsForDay(progress, exercise.id, date, undefined, { checkWeek: false });
    return acc + calculateSetsVolume(sets);
  }, 0);
}

export function countNewSessionPRs(exercises, progress, preSessionPRs, date) {
  return buildNewSessionPRList(exercises, progress, preSessionPRs, date).length;
}

export function buildNewSessionPRList(exercises, progress, preSessionPRs, date) {
  return (Array.isArray(exercises) ? exercises : []).map(function (exercise) {
    var entry = progress && progress[exercise.id];
    if (!entry) return null;
    var setsToday = filterSetsByDay(entry.sets || [], date, undefined, false);
    if (!setsToday.length) return null;
    var maxToday = Math.max.apply(null, setsToday.map(function (set) {
      return (set && set.kg) || 0;
    }));
    var prevKg = (preSessionPRs && preSessionPRs[exercise.id]) || 0;
    if (maxToday <= 0 || maxToday <= prevKg) return null;
    return {
      exId: exercise.id,
      ejercicio: exercise.name || exercise.nameEn || exercise.nombre || exercise.id,
      kg: maxToday,
      prevKg: prevKg,
      diff: Math.round((maxToday - prevKg) * 10) / 10,
    };
  }).filter(Boolean);
}

export function buildWorkoutSummary(params) {
  var p = params || {};
  var session = p.session || {};
  var activeDay = p.activeDay || {};
  var activeRoutine = p.activeRoutine || {};
  var exercises = getWorkoutDayExercises(activeDay);
  var date = p.date || "";
  var durationMs = (p.now || Date.now()) - (session.startTime || (p.now || Date.now()));
  var durMin = Math.round(durationMs / 60000) || 1;
  var prs = buildNewSessionPRList(exercises, p.progress, p.preSessionPRs, date);
  return {
    durMin: durMin,
    ejercicios: exercises.length,
    totalSets: exercises.reduce(function (acc, exercise) {
      return acc + (parseInt(exercise.sets, 10) || 3);
    }, 0),
    volTotal: Math.round(calculateWorkoutVolume(exercises, p.progress, date)),
    prsNuevos: prs.length,
    prs: prs,
    diaLabel: activeDay.label || ("Dia " + ((session.dIdx || 0) + 1)),
    rutinaName: activeRoutine.name || "Entrenamiento",
    fecha: date,
    semana: p.semana,
  };
}

export function buildSessionPayload(params) {
  var p = params || {};
  var session = p.session || {};
  var activeDay = p.activeDay || {};
  var exercises = Array.isArray(p.exercises) ? p.exercises : activeDay.exercises || [];
  var activeRoutine = p.activeRoutine || {};
  return {
    alumno_id: p.alumnoId,
    rutina_id: p.includeRoutineId ? activeRoutine.id || null : undefined,
    rutina_nombre: activeRoutine.name || "",
    dia_label: activeDay.label || ("Dia " + ((session.dIdx || 0) + 1)),
    dia_idx: session.dIdx,
    semana: p.weekToSave,
    ejercicios: exercises.map(function (exercise) { return exercise.id; }).join(","),
    fecha: p.date,
    hora: p.time,
  };
}

export function removeUndefinedPayloadFields(payload) {
  var out = {};
  Object.keys(payload || {}).forEach(function (key) {
    if (payload[key] !== undefined) out[key] = payload[key];
  });
  return out;
}

export function sessionAlreadyExists(existingSessions, date, dayIndex, weekToSave) {
  return (Array.isArray(existingSessions) ? existingSessions : []).some(function (session) {
    return normalizeFecha(session.fecha) === normalizeFecha(date) && session.dia_idx === dayIndex && session.semana === weekToSave;
  });
}

export function buildPendingProgressItem(exId, kg, reps, note, date, semana) {
  return {
    exId: exId,
    kg: normalizeWorkoutKg(kg),
    reps: normalizeWorkoutReps(reps),
    note: note || "",
    date: date,
    semana: semana,
  };
}

export function buildProgressPayload(alumnoId, exId, kg, reps, note, date, semana) {
  return {
    alumno_id: alumnoId,
    ejercicio_id: exId,
    kg: normalizeWorkoutKg(kg),
    reps: normalizeWorkoutReps(reps),
    nota: note || "",
    fecha: date,
    semana: semana,
  };
}

export function mergeLocalOfflineSessions(existing, incoming) {
  var out = Array.isArray(existing) ? existing.slice() : [];
  (Array.isArray(incoming) ? incoming : []).forEach(function (item) {
    if (!item) return;
    var found = out.some(function (session) {
      return (
        String(session.alumno_id || "") === String(item.alumno_id || "") &&
        normalizeFecha(session.fecha) === normalizeFecha(item.fecha) &&
        session.dia_idx === item.dia_idx &&
        session.semana === item.semana
      );
    });
    if (!found) out.push(item);
  });
  return out;
}
