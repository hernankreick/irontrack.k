import { kgDeSerie, clasificarCarga } from "./metricas/pr.js";

export function normalizeExerciseId(exerciseOrId) {
  if (exerciseOrId == null) return "";
  if (typeof exerciseOrId === "object") {
    return String(exerciseOrId.id != null ? exerciseOrId.id : "");
  }
  return String(exerciseOrId);
}

export function normalizeExerciseName(exercise, useSpanish) {
  if (!exercise) return "";
  var primary = useSpanish ? exercise.name : exercise.nameEn;
  var fallback = useSpanish ? exercise.nameEn : exercise.name;
  return String(primary || fallback || exercise.nombre || exercise.id || "");
}

function parseHistoryDate(value) {
  if (!value) return 0;
  if (value instanceof Date) {
    var time = value.getTime();
    return isNaN(time) ? 0 : time;
  }
  var str = String(value);
  var slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    var year = parseInt(slash[3], 10);
    if (year < 100) year += 2000;
    var date = new Date(year, parseInt(slash[2], 10) - 1, parseInt(slash[1], 10));
    var slashTime = date.getTime();
    return isNaN(slashTime) ? 0 : slashTime;
  }
  var parsed = new Date(str).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

export function sortHistoryByDateDesc(history) {
  return (Array.isArray(history) ? history : [])
    .map(function (item, index) {
      return { item: item, index: index, time: parseHistoryDate(item && (item.date || item.fecha || item.created_at)) };
    })
    .sort(function (a, b) {
      if (b.time !== a.time) return b.time - a.time;
      return a.index - b.index;
    })
    .map(function (entry) {
      return entry.item;
    });
}

export function filterHistoryByExercise(progress, exerciseOrId) {
  var id = normalizeExerciseId(exerciseOrId);
  if (!id || !progress) return [];
  var exact = progress[id];
  if (exact && Array.isArray(exact.sets)) return exact.sets;
  var matchingKey = Object.keys(progress).find(function (key) {
    return normalizeExerciseId(key) === id;
  });
  var entry = matchingKey ? progress[matchingKey] : null;
  return entry && Array.isArray(entry.sets) ? entry.sets : [];
}

export function calculateLastRecord(history) {
  var sorted = sortHistoryByDateDesc(history);
  return sorted.length ? sorted[0] : null;
}

/**
 * Mejor marca de un historial de series (regla unica de lib/metricas/pr.js: solo series validas, kg > 0 y reps > 0, coma o punto
 * decimal). `recordKg` (opcional): record de TODO el historial (progress[ex].max); el historial en memoria se recorta a 50 series, asi
 * que si el record es mayor que lo visible se devuelve ese kg (sin reps conocidas) en vez de una marca menor.
 */
export function calculateBestPR(history, recordKg) {
  var best = null;
  (Array.isArray(history) ? history : []).forEach(function (set) {
    if (!set) return;
    var kg = kgDeSerie(set.kg) || 0;
    var reps = parseInt(set.reps, 10) || 0;
    if (!(kg > 0) || !(reps > 0)) return;
    if (!best || kg > best.kg || (kg === best.kg && reps > best.reps)) {
      best = Object.assign({}, set, { kg: kg, reps: reps });
    }
  });
  var r = kgDeSerie(recordKg);
  if (r > 0 && clasificarCarga(best ? best.kg : 0, r) === "pr") return { kg: r, reps: null };
  if (r > 0 && !best) return { kg: r, reps: null };
  return best;
}

function recordDeProgress(progress, id) {
  if (!progress || typeof progress !== "object" || !id) return 0;
  var key = Object.keys(progress).find(function (k) { return normalizeExerciseId(k) === id; });
  return key && progress[key] ? progress[key].max || 0 : 0;
}

export function prepareExerciseHistoryModalData(options) {
  var opts = options || {};
  var exercise = opts.exercise || null;
  var id = normalizeExerciseId(exercise);
  return {
    exercise: exercise,
    history: sortHistoryByDateDesc(filterHistoryByExercise(opts.progress, id)),
    pattern: opts.patterns && exercise ? opts.patterns[exercise.pattern] : undefined,
    imageSrc: opts.images && id ? opts.images[id] : undefined,
    videoSrc: opts.videos && id ? opts.videos[id] : undefined,
    lastRecord: calculateLastRecord(filterHistoryByExercise(opts.progress, id)),
    bestPR: calculateBestPR(filterHistoryByExercise(opts.progress, id), recordDeProgress(opts.progress, id)),
  };
}
