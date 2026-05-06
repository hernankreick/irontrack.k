import { sanitizeRoutineDaysForWrite } from './exerciseResolve.js';

export function cleanRutinaWriteBody(data) {
  var src = data || {};
  return {
    alumno_id: src.alumno_id || null,
    entrenador_id: src.entrenador_id != null ? String(src.entrenador_id) : null,
    nombre: src.nombre || "Rutina",
    datos: src.datos || {},
  };
}

export function getRutinaAlumnoId(r) {
  if (!r) return null;
  if (r.alumno_id != null && r.alumno_id !== "") return r.alumno_id;
  if (r.assigned_to != null && r.assigned_to !== "") return r.assigned_to;
  if (r.atleta_id != null && r.atleta_id !== "") return r.atleta_id;
  if (r.alumnoId != null && r.alumnoId !== "") return r.alumnoId;
  if (r.datos && r.datos.alumno && r.datos.alumno.id != null && r.datos.alumno.id !== "") return r.datos.alumno.id;
  if (r.datos && r.datos.alumnoId != null && r.datos.alumnoId !== "") return r.datos.alumnoId;
  return null;
}

export function isRutinaAsignadaAAlumno(r, alumno) {
  if (!r || !alumno || alumno.id == null || r.alumno_id == null) return false;
  return String(r.alumno_id) === String(alumno.id);
}

export function mergeRutinasAsignadas(primary, secondary, alumnosIds) {
  var out = [];
  var seen = {};
  var shouldFilterByAlumno = !!(alumnosIds && Object.keys(alumnosIds).length > 0);
  [primary || [], secondary || []].forEach(function (list) {
    list.forEach(function (r, idx) {
      if (!r) return;
      var alumnoRutinaId = getRutinaAlumnoId(r);
      if (alumnoRutinaId != null && shouldFilterByAlumno && !alumnosIds[String(alumnoRutinaId)]) return;
      var key = r.id != null ? "id:" + String(r.id) : "row:" + String(alumnoRutinaId || "") + ":" + idx;
      if (seen[key]) return;
      seen[key] = true;
      out.push(r);
    });
  });
  return out;
}

export function findRutinaForAlumno(rutinas, alumnoOrId) {
  var alumno = alumnoOrId && typeof alumnoOrId === "object" ? alumnoOrId : { id: alumnoOrId };
  var aid = String(alumno.id);
  return (rutinas || []).find(function (r) {
    if (r && r.alumno_id != null && r.alumno_id !== "") {
      return isRutinaAsignadaAAlumno(r, alumno);
    }
    var rid = getRutinaAlumnoId(r);
    return rid != null && String(rid) === aid;
  }) || null;
}

export function getAssignmentRoutineParts(rutina) {
  return {
    nombre: rutina?.nombre || rutina?.name || "Rutina",
    days: rutina?.datos?.days || rutina?.days || [],
    note: rutina?.datos?.note || rutina?.note || "",
  };
}

export function buildRutinaInsertBody({ alumno, rutina, alumnoId, entrenadorId }) {
  var parts = getAssignmentRoutineParts(rutina);
  return {
    alumno_id: alumnoId,
    entrenador_id: entrenadorId,
    nombre: parts.nombre,
    datos: {
      days: sanitizeRoutineDaysForWrite(parts.days),
      alumno: {
        id: alumno.id,
        nombre: alumno.nombre || "",
        email: alumno.email || "",
      },
      note: parts.note,
    },
  };
}

export function normalizeRutinaLocalForAssignment({ rutinaDb, alumno, fallbackNombre }) {
  return {
    id: rutinaDb.id,
    name: rutinaDb.nombre || fallbackNombre,
    days: rutinaDb.datos?.days || [],
    alumno_id: rutinaDb.alumno_id,
    alumno: alumno.nombre || alumno.email || "",
    note: rutinaDb.datos?.note || "",
    saved: true,
    collapsed: true,
  };
}
