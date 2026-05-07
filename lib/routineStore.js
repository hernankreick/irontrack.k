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

export function resolveAlumnoId(alumnoOrId) {
  if (alumnoOrId && typeof alumnoOrId === "object") {
    return alumnoOrId.id != null && alumnoOrId.id !== "" ? String(alumnoOrId.id) : "";
  }
  return alumnoOrId != null && alumnoOrId !== "" ? String(alumnoOrId) : "";
}

export function resolveEntrenadorId(sessionOrId) {
  if (sessionOrId && typeof sessionOrId === "object") {
    var userId = sessionOrId.user && sessionOrId.user.id;
    return userId != null && userId !== "" ? String(userId) : "";
  }
  return sessionOrId != null && sessionOrId !== "" ? String(sessionOrId) : "";
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

export function dedupeRutinas(rutinas, options) {
  var opts = options || {};
  var out = [];
  var seen = {};
  (rutinas || []).forEach(function (r, idx) {
    if (!r) return;
    var alumnoRutinaId = getRutinaAlumnoId(r);
    var key = r.id != null ? "id:" + String(r.id) : "row:" + String(alumnoRutinaId || "") + ":" + idx;
    if (opts.requireId && r.id == null) return;
    if (seen[key]) return;
    seen[key] = true;
    out.push(r);
  });
  return out;
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
  var aid = resolveAlumnoId(alumno);
  if (!aid) return null;
  return (rutinas || []).find(function (r) {
    if (r && r.alumno_id != null && r.alumno_id !== "") {
      return isRutinaAsignadaAAlumno(r, alumno);
    }
    var rid = getRutinaAlumnoId(r);
    return rid != null && String(rid) === aid;
  }) || null;
}

export function getRutinaAsignadaAlumno(rutinas, alumnoOrId) {
  return findRutinaForAlumno(rutinas, alumnoOrId);
}

export function hasAlumnoRutina(alumno, rutinas) {
  return !!getRutinaAsignadaAlumno(rutinas, alumno);
}

export function getAlumnoRutinaNombre(alumno, rutinas) {
  var rutina = getRutinaAsignadaAlumno(rutinas, alumno);
  return rutina ? rutina.nombre || rutina.name || "Rutina" : "";
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

export function normalizeRutina(rutinaDb, options) {
  var opts = options || {};
  var alumno = opts.alumno || {};
  return {
    id: rutinaDb.id,
    name: rutinaDb.nombre || opts.fallbackNombre,
    days: rutinaDb.datos?.days || [],
    alumno_id: rutinaDb.alumno_id,
    alumno: alumno.nombre || alumno.email || "",
    note: rutinaDb.datos?.note || "",
    saved: true,
    collapsed: true,
  };
}

export function normalizeRutinaLocalForAssignment({ rutinaDb, alumno, fallbackNombre }) {
  return normalizeRutina(rutinaDb, { alumno: alumno, fallbackNombre: fallbackNombre });
}

export function getRutinaBadgeText({ rutina, rutinasLoaded, msg }) {
  if (!rutinasLoaded) return "...";
  if (rutina) return rutina.nombre || rutina.name || (typeof msg === "function" ? msg("Con rutina", "Has routine") : "Con rutina");
  return typeof msg === "function" ? msg("Sin rutina", "No routine") : "Sin rutina";
}

export function getRutinaBadgeConfig({ rutina, rutinasLoaded, darkMode, msg }) {
  if (!rutinasLoaded) {
    return {
      bg: darkMode ? "#1e293b" : "#f1f5f9",
      color: darkMode ? "#94a3b8" : "#64748b",
      t: getRutinaBadgeText({ rutina: null, rutinasLoaded: false, msg: msg }),
    };
  }
  if (rutina) {
    return {
      bg: darkMode ? "#14532d" : "#dcfce7",
      color: darkMode ? "#4ade80" : "#15803d",
      t: getRutinaBadgeText({ rutina: rutina, rutinasLoaded: true, msg: msg }),
    };
  }
  return {
    bg: darkMode ? "#1e293b" : "#f1f5f9",
    color: darkMode ? "#94a3b8" : "#475569",
    t: getRutinaBadgeText({ rutina: null, rutinasLoaded: true, msg: msg }),
  };
}
