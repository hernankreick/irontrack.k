import { irontrackMsg } from './irontrackMsg.js';

// Biblioteca entrenador: músculos multi-select (JSON en campo `muscle`) + texto legacy
export const BIB_MUSCLE_OPTIONS = [
  { k: "pecho", chipEs: "PECHO", chipEn: "CHEST", selEs: "Pecho", selEn: "Chest" },
  { k: "espalda", chipEs: "ESPALDA", chipEn: "BACK", selEs: "Espalda", selEn: "Back" },
  { k: "hombros", chipEs: "HOMBROS", chipEn: "SHOULDERS", selEs: "Hombros", selEn: "Shoulders" },
  { k: "biceps", chipEs: "BICEPS", chipEn: "BICEPS", selEs: "Bíceps", selEn: "Biceps" },
  { k: "triceps", chipEs: "TRICEPS", chipEn: "TRICEPS", selEs: "Tríceps", selEn: "Triceps" },
  { k: "cuadriceps", chipEs: "CUADRICEPS", chipEn: "QUADS", selEs: "Cuádriceps", selEn: "Quads" },
  { k: "isquios", chipEs: "ISQUIOS", chipEn: "HAMSTRINGS", selEs: "Isquios", selEn: "Hamstrings" },
  { k: "gluteos", chipEs: "GLUTEOS", chipEn: "GLUTES", selEs: "Glúteos", selEn: "Glutes" },
  { k: "core", chipEs: "CORE", chipEn: "CORE", selEs: "Core", selEn: "Core" },
  { k: "pantorrillas", chipEs: "PANTORRILLAS", chipEn: "CALVES", selEs: "Pantorrillas", selEn: "Calves" },
  { k: "antebrazos", chipEs: "ANTEBRAZOS", chipEn: "FOREARMS", selEs: "Antebrazos", selEn: "Forearms" },
];

export const BIB_MUSCLE_ORDER = BIB_MUSCLE_OPTIONS.map(function (o) { return o.k; });

export function parseBibMuscleJson(raw) {
  if (raw == null || raw === "") return null;
  var s = String(raw).trim();
  if (s.charAt(0) !== "[") return null;
  try {
    var a = JSON.parse(s);
    if (Array.isArray(a) && a.every(function (x) { return typeof x === "string"; })) return a;
  } catch (e) {}
  return null;
}

export function formatBibMuscleDisplay(raw, lang) {
  var arr = parseBibMuscleJson(raw);
  if (arr) {
    if (arr.length === 0) return "";
    var ordered = BIB_MUSCLE_ORDER.filter(function (k) { return arr.indexOf(k) >= 0; });
    return ordered.map(function (k) {
      var o = BIB_MUSCLE_OPTIONS.find(function (x) { return x.k === k; });
      return o ? irontrackMsg(lang, o.selEs, o.selEn, o.selPt) : k;
    }).join(", ");
  }
  return raw ? String(raw) : "";
}

export function bibMuscleFilterHaystack(raw) {
  var base = formatBibMuscleDisplay(raw, "es") + " " + formatBibMuscleDisplay(raw, "en") + " " + String(raw || "");
  var arr = parseBibMuscleJson(raw);
  if (arr && arr.length) base += " " + arr.join(" ");
  return base.toLowerCase();
}

export function isValidUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

export function isTruthyActiveFlag(v) {
  if (v == null) return true;
  if (typeof v === "boolean") return v;
  var s = String(v).trim().toLowerCase();
  return !(s === "false" || s === "0" || s === "no" || s === "inactivo" || s === "inactive" || s === "eliminado" || s === "deleted" || s === "borrado");
}

export function isDeletedAlumnoRow(a) {
  if (!a || typeof a !== "object") return true;
  if (a.deleted_at || a.deletedAt || a.fecha_eliminacion || a.removed_at) return true;
  var stateFields = [a.estado, a.status, a.state, a.situacion];
  for (var i = 0; i < stateFields.length; i++) {
    if (stateFields[i] == null) continue;
    var s = String(stateFields[i]).trim().toLowerCase();
    if (s === "eliminado" || s === "eliminada" || s === "deleted" || s === "borrado" || s === "borrada" || s === "inactive" || s === "inactivo" || s === "inactiva") return true;
  }
  if (!isTruthyActiveFlag(a.activo) || !isTruthyActiveFlag(a.active) || !isTruthyActiveFlag(a.is_active)) return true;
  return false;
}

export function cleanActiveCoachAlumnos(list, entrenadorId) {
  var seen = {};
  return (Array.isArray(list) ? list : []).filter(function (a) {
    if (!a || a.id == null || String(a.id).trim() === "") return false;
    var id = String(a.id);
    if (seen[id]) return false;
    if (isDeletedAlumnoRow(a)) return false;
    if (entrenadorId && a.entrenador_id != null && String(a.entrenador_id) !== String(entrenadorId)) return false;
    seen[id] = true;
    return true;
  });
}
