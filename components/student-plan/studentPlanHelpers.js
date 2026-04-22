/**
 * Helpers puros para la vista Plan (modo alumno): duración estimada, músculos, PRs pendientes.
 * No side effects; mismos datos que el resto de App (día de rutina, progress, currentWeek).
 */

/** @param {string|number|undefined} pause */
export function parsePauseSeconds(pause) {
  const n = parseInt(String(pause), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Estimación heurística de minutos totales (entrada en calor + principal + descansos entre series).
 * @param {object} day - día de rutina con warmup / exercises
 * @param {number} currentWeek
 */
export function estimateDayMinutes(day, currentWeek) {
  if (!day) return 0;
  const wu = day.warmup || [];
  const main = day.exercises || [];
  let sec = 0;
  wu.forEach(function () {
    sec += 2.5 * 60;
  });
  main.forEach(function (ex) {
    const w = ((ex.weeks || [])[currentWeek]) || {};
    const sets = parseInt(String(w.sets || ex.sets), 10) || 3;
    const pause = parsePauseSeconds(ex.pause);
    sec += sets * 2.5 * 60 + Math.max(0, sets - 1) * pause;
  });
  return Math.max(1, Math.round(sec / 60));
}

/**
 * Etiquetas únicas de grupo muscular (desde catálogo allEx), máximo `cap`.
 */
export function uniqueMuscleChipsFromDay(day, allEx, cap) {
  const max = typeof cap === "number" ? cap : 8;
  const seen = new Set();
  const add = function (m) {
    if (!m || typeof m !== "string") return;
    m.split(/[/,]/).forEach(function (part) {
      const t = part.trim();
      if (t) seen.add(t);
    });
  };
  [...(day.warmup || []), ...(day.exercises || [])].forEach(function (ex) {
    const inf = allEx.find(function (e) {
      return e.id === ex.id;
    });
    if (inf && inf.muscle) add(inf.muscle);
  });
  return Array.from(seen).slice(0, max);
}

/**
 * Cuenta ejercicios del bloque principal donde el kg programado supera el máximo guardado
 * (solo si ya había un PR previo: evita inflar con todas las cargas "nuevas").
 */
export function countPendingPrOpportunities(day, progress, currentWeek) {
  if (!day || !day.exercises) return 0;
  let n = 0;
  day.exercises.forEach(function (ex) {
    const w = ((ex.weeks || [])[currentWeek]) || {};
    const kgProg = parseFloat(String(w.kg != null ? w.kg : ex.kg || "")) || 0;
    const prevMax = (progress && progress[ex.id] && progress[ex.id].max) || 0;
    if (prevMax > 0 && kgProg > 0 && kgProg > prevMax) n++;
  });
  return n;
}

/**
 * Badge tipo "HOY · vie 27" (locale es-AR / en según `lang`).
 */
export function formatHoyDateBadge(msg, lang) {
  const now = new Date();
  const isEs = !lang || lang === "es";
  const wd = now.toLocaleDateString(isEs ? "es-AR" : "en-US", { weekday: "short" });
  const dayNum = now.getDate();
  const w = wd.charAt(0).toUpperCase() + wd.slice(1);
  return msg("HOY", "TODAY") + " · " + w + " " + dayNum;
}
