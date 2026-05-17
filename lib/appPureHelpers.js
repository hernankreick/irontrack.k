export const uid = () => Math.random().toString(36).slice(2, 9);

export function firstNonEmptyString() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

export function cloneRoutineDay(base, label) {
  try {
    var copy = JSON.parse(JSON.stringify(base || {}));
    copy.id = uid();
    copy.label = label;
    copy.warmup = Array.isArray(copy.warmup) ? copy.warmup : [];
    copy.exercises = Array.isArray(copy.exercises) ? copy.exercises : [];
    return copy;
  } catch (e) {
    return {
      id: uid(),
      label: label,
      warmup: (base?.warmup || []).map(function (x) { return { ...x }; }),
      exercises: (base?.exercises || []).map(function (x) { return { ...x }; }),
      note: base?.note || "",
    };
  }
}

export function exerciseMatchesLibraryFilter(exercise, search, filterPattern, muscleHaystackFn) {
  var q = String(search || "").toLowerCase();
  if (filterPattern && exercise.pattern !== filterPattern) return false;
  if (!q) return true;
  return exercise.name.toLowerCase().includes(q)
    || exercise.nameEn.toLowerCase().includes(q)
    || muscleHaystackFn(exercise.muscle).includes(q);
}

export function getRutinaExerciseIdsForCleanup(rutina) {
  var ids = {};
  var days = rutina && rutina.datos && Array.isArray(rutina.datos.days)
    ? rutina.datos.days
    : (rutina && Array.isArray(rutina.days) ? rutina.days : []);
  (days || []).forEach(function (d) {
    (d.warmup || []).concat(d.exercises || []).forEach(function (ex) {
      if (ex && ex.id != null && ex.id !== "") ids[String(ex.id)] = true;
    });
  });
  return Object.keys(ids);
}

export function sessionBelongsToRoutineForCleanup(s, alumnoId, rutinaId, rutinaNombre) {
  if (!s || String(s.alumno_id) !== String(alumnoId)) return false;
  var rid = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
  var rname = rutinaNombre != null && rutinaNombre !== "" ? String(rutinaNombre) : "";
  if (rid && s.rutina_id != null && s.rutina_id !== "") return String(s.rutina_id) === rid;
  if (rname && (s.rutina_id == null || s.rutina_id === "")) return String(s.rutina_nombre || "") === rname;
  if (!rid && rname) return String(s.rutina_nombre || "") === rname;
  return !rid && !rname;
}

export function sessionBelongsToRoutineWeekForCleanup(s, alumnoId, rutinaId, rutinaNombre, weekNumber) {
  if (!sessionBelongsToRoutineForCleanup(s, alumnoId, rutinaId, rutinaNombre)) return false;
  return Number(s && s.semana) === Number(weekNumber);
}
