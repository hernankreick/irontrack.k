/** Textos del Progreso del entrenador que describen una ventana/límite calculado por el modelo. */
import { irontrackMsg as M } from "../../lib/irontrackMsg.js";

/** Ventana de «Volumen por patrón»: el modelo suma la semana actual de la rutina del alumno (no 4 semanas). */
export function patternWindowLabel(lang, weekNumber) {
  var n = weekNumber > 0 ? weekNumber : 1;
  return M(
    lang,
    "Semana actual de la rutina · Semana " + n,
    "Current routine week · Week " + n,
    "Semana atual da rotina · Semana " + n
  );
}

export function patternEmptyLabel(lang) {
  return M(
    lang,
    "Sin volumen registrado en la semana actual de la rutina para estos patrones.",
    "No volume logged in the current routine week for these patterns.",
    "Sem volume registrado na semana atual da rotina para estes padrões."
  );
}

export function recentPrsSubtitle(lang, name) {
  return M(lang, "Últimos PRs de " + name, "Latest PRs by " + name, "Últimos PRs de " + name);
}

export function recentPrsLimitLabel(lang, limit) {
  return M(lang, "Máx. " + limit, "Max. " + limit, "Máx. " + limit);
}
