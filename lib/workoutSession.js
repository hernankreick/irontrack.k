import { normalizeFecha } from "./normalizeFecha.js";

export function normalizeWorkoutSet(input) {
  var set = input || {};
  return {
    kg: parseFloat(set.kg) || 0,
    reps: parseInt(set.reps, 10) || 0,
    date: set.date || set.fecha || "",
    week: set.week,
    note: set.note || set.nota || "",
    rpe: set.rpe || null,
  };
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
  var newKg = parseFloat(kg) || 0;
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
  return (Array.isArray(exercises) ? exercises : []).filter(function (exercise) {
    var entry = progress && progress[exercise.id];
    if (!entry) return false;
    var setsToday = filterSetsByDay(entry.sets || [], date, undefined, false);
    if (!setsToday.length) return false;
    var maxToday = Math.max.apply(null, setsToday.map(function (set) {
      return (set && set.kg) || 0;
    }));
    if (maxToday <= 0) return false;
    return maxToday > ((preSessionPRs && preSessionPRs[exercise.id]) || 0);
  }).length;
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
  return {
    durMin: durMin,
    ejercicios: exercises.length,
    totalSets: exercises.reduce(function (acc, exercise) {
      return acc + (parseInt(exercise.sets, 10) || 3);
    }, 0),
    volTotal: Math.round(calculateWorkoutVolume(exercises, p.progress, date)),
    prsNuevos: countNewSessionPRs(exercises, p.progress, p.preSessionPRs, date),
    diaLabel: activeDay.label || ("Dia " + ((session.dIdx || 0) + 1)),
    rutinaName: activeRoutine.name || "Entrenamiento",
    fecha: date,
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

export function buildPendingProgressItem(exId, kg, reps, note, date) {
  return {
    exId: exId,
    kg: parseFloat(kg) || 0,
    reps: parseInt(reps, 10) || 0,
    note: note || "",
    date: date,
  };
}

export function buildProgressPayload(alumnoId, exId, kg, reps, note, date) {
  return {
    alumno_id: alumnoId,
    ejercicio_id: exId,
    kg: parseFloat(kg) || 0,
    reps: parseInt(reps, 10) || 0,
    nota: note || "",
    fecha: date,
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
