export const uid = () => Math.random().toString(36).slice(2, 9);

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
