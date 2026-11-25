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

/** Título del aviso de volumen no confirmado (semana con series sin asignar, series sin semana o historial incompleto). */
export function patternPartialTitle(lang) {
  return M(lang, "Volumen no confirmado", "Unconfirmed volume", "Volume não confirmado");
}

/** Líneas del aviso; cada una explica una causa distinta y dice qué pasa con esas series (no se suman, el real puede ser mayor). */
export function patternPartialLines(lang, p) {
  var out = [];
  var n = (p && p.semana) || 0;
  if (n > 0) {
    out.push(
      M(
        lang,
        n + (n === 1 ? " serie de esta semana no tiene" : " series de esta semana no tienen") + " una sesión guardada que permita saber con certeza de qué rutina " + (n === 1 ? "es" : "son") + ". No se " + (n === 1 ? "suma" : "suman") + ": el volumen real puede ser mayor.",
        n + (n === 1 ? " set from this week has" : " sets from this week have") + " no saved session that shows for sure which routine " + (n === 1 ? "it belongs" : "they belong") + " to. " + (n === 1 ? "It is" : "They are") + " not added: the real volume may be higher.",
        n + (n === 1 ? " série desta semana não tem" : " séries desta semana não têm") + " uma sessão salva que mostre com certeza de qual rotina " + (n === 1 ? "é" : "são") + ". Não " + (n === 1 ? "é somada" : "são somadas") + ": o volume real pode ser maior."
      )
    );
  }
  var m = (p && p.sinSemana) || 0;
  if (m > 0) {
    out.push(
      M(
        lang,
        "Además, " + m + (m === 1 ? " serie del alumno no tiene" : " series del alumno no tienen") + " una semana válida y no se asigna a ninguna rutina.",
        "Also, " + m + (m === 1 ? " set of this athlete has" : " sets of this athlete have") + " no valid week and " + (m === 1 ? "is" : "are") + " not assigned to any routine.",
        "Além disso, " + m + (m === 1 ? " série do aluno não tem" : " séries do aluno não têm") + " semana válida e não é atribuída a nenhuma rotina."
      )
    );
  }
  if (p && p.historialIncompleto) {
    out.push(M(lang, "El historial del alumno no se cargó completo: pueden faltar datos y el volumen real puede ser mayor.", "The athlete's history did not load completely: data may be missing and the real volume may be higher.", "O histórico do aluno não carregou por completo: podem faltar dados e o volume real pode ser maior."));
  }
  return out;
}
