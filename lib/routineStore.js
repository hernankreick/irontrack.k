import { realCoachIdOrNull } from "./coachIdentity.js";
import { sanitizeRoutineDaysForWrite } from './exerciseResolve.js';

export function cleanRutinaWriteBody(data) {
  var src = data || {};
  var esPlantilla = src.es_plantilla === true;
  if ((src.alumno_id == null || src.alumno_id === "") && !esPlantilla) {
    throw new Error("No se puede guardar la rutina sin un alumno asignado");
  }
  var body = {
    alumno_id: esPlantilla ? null : src.alumno_id,
    nombre: src.nombre || "Rutina",
    datos: src.datos || {},
    es_plantilla: esPlantilla,
  };
  // entrenador_id solo viaja si es un UUID real: el legacy "entrenador_principal" (o null, que la DB rechaza) se omite.
  // En altas lo completa sb.createRutina con el usuario autenticado; en ediciones la fila conserva el suyo.
  var coachId = realCoachIdOrNull(src.entrenador_id);
  if (coachId) body.entrenador_id = coachId;
  return body;
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

// created_at llega de Supabase como "2026-09-01 13:32:24.502021" (timestamp sin zona, microsegundos) o, con timestamptz,
// "2026-09-01T13:32:24.502021+00:00". Date.parse sobre el formato con espacio depende del runtime (hora local en V8,
// NaN en algunos Safari), asi que se parsea a mano y de forma determinista: sin zona se toma como UTC; con zona se aplica
// el offset. Devuelve microsegundos desde epoch (entero < 2^53) o -Infinity si es null/invalido (pierde contra cualquier fecha valida).
var CREATED_AT_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?)?$/i;

export function createdAtSortKey(value) {
  if (value == null || value === "") return -Infinity;
  if (value instanceof Date) {
    var dt = value.getTime();
    return Number.isFinite(dt) ? dt * 1000 : -Infinity;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value * 1000 : -Infinity;
  var m = CREATED_AT_RE.exec(String(value).trim());
  if (!m) return -Infinity;
  var year = +m[1], month = +m[2], day = +m[3];
  var hh = m[4] ? +m[4] : 0, mm = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hh > 23 || mm > 59 || ss > 59) return -Infinity;
  var frac = ((m[7] || "") + "000000").slice(0, 6);
  var ms = Date.UTC(year, month - 1, day, hh, mm, ss);
  if (!Number.isFinite(ms)) return -Infinity;
  if (m[8] && m[8].toUpperCase() !== "Z") {
    var tz = /^([+-])(\d{2}):?(\d{2})?$/.exec(m[8]);
    var offMin = (+tz[2]) * 60 + (tz[3] ? +tz[3] : 0);
    ms -= (tz[1] === "-" ? -1 : 1) * offMin * 60000;
  }
  return ms * 1000 + Number(frac);
}

// Rutina vigente de un alumno = la no-plantilla con mayor created_at; empate => mayor String(id) (< / >, sin locale).
// Pura: independiente del orden del array, no muta nada, devuelve null si no hay candidata.
export function selectCurrentRoutine(rutinas, alumnoOrId) {
  var alumno = alumnoOrId && typeof alumnoOrId === "object" ? alumnoOrId : { id: alumnoOrId };
  var aid = resolveAlumnoId(alumno);
  if (!aid) return null;
  var best = null, bestKey = -Infinity;
  (rutinas || []).forEach(function (r) {
    if (!r || r.es_plantilla === true) return;
    var mine;
    if (r.alumno_id != null && r.alumno_id !== "") {
      mine = isRutinaAsignadaAAlumno(r, alumno);
    } else {
      var rid = getRutinaAlumnoId(r);
      mine = rid != null && String(rid) === aid;
    }
    if (!mine) return;
    var key = createdAtSortKey(r.created_at);
    if (best === null || key > bestKey || (key === bestKey && String(r.id) > String(best.id))) {
      best = r;
      bestKey = key;
    }
  });
  return best;
}

export function findRutinaForAlumno(rutinas, alumnoOrId) {
  return selectCurrentRoutine(rutinas, alumnoOrId);
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
      // Arranque explicito de la rutina asignada: no depender de null -> localStorage -> semana 1.
      semana_activa: 1,
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
