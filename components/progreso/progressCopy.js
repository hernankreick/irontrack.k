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

/** Subtítulo de «Volumen por patrón» cuando se mira otra rutina, ciclo o semana que la actual. */
export function patternSelectionLabel(lang, rutinaNombre, cicloTxt, weekNumber) {
  var partes = [rutinaNombre || M(lang, "Rutina", "Routine", "Rotina")];
  if (cicloTxt) partes.push(cicloTxt);
  partes.push(M(lang, "Semana " + weekNumber, "Week " + weekNumber, "Semana " + weekNumber));
  return partes.join(" · ");
}

/** Estado vacío según lo elegido: semana sin sesiones, con sesiones sin series con volumen, o la ventana actual sin volumen. */
export function patternEmptyForSelection(lang, sesiones, series) {
  if (sesiones <= 0 && series <= 0) return M(lang, "Sin sesiones registradas en esta semana de la rutina.", "No sessions logged in this week of the routine.", "Sem sessões registradas nesta semana da rotina.");
  return M(lang, "Esta semana no tiene volumen registrado para estos patrones.", "This week has no volume logged for these patterns.", "Esta semana não tem volume registrado para estes padrões.");
}

/** Aviso cuando hay series del alumno que no se pueden atribuir a una rutina con evidencia (no se incluyen ni se reconstruyen). */
export function patternUnassignedNote(lang, n) {
  return M(
    lang,
    n + (n === 1 ? " serie del alumno no se pudo asignar a una rutina (sin sesión que la respalde) y no está incluida." : " series del alumno no se pudieron asignar a una rutina (sin sesión que las respalde) y no están incluidas."),
    n + (n === 1 ? " logged set could not be matched to a routine (no supporting session) and is not included." : " logged sets could not be matched to a routine (no supporting session) and are not included."),
    n + (n === 1 ? " série não pôde ser associada a uma rotina (sem sessão que a respalde) e não está incluída." : " séries não puderam ser associadas a uma rotina (sem sessão que as respalde) e não estão incluídas.")
  );
}
