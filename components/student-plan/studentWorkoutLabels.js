import { firstNonEmptyString } from '../../lib/appPureHelpers.js';

export function inferStudentWorkoutLabels({ day, exerciseInfos, dayIndex, labels }) {
  var infos = Array.isArray(exerciseInfos) ? exerciseInfos : [];
  var patterns = new Set(infos.map(function (ex) { return ex && ex.pattern; }).filter(Boolean));
  var muscles = infos.map(function (ex) { return String((ex && ex.muscle) || ""); }).join(" ").toLowerCase();
  var explicit = firstNonEmptyString(
    day && (day.name || day.title || day.nombre || day.titulo || day.label),
    day && day.dayName
  );
  var title = explicit || labels.dayPrefix + " " + ((dayIndex || 0) + 1);
  if (!explicit) {
    if (patterns.has("empuje") && patterns.has("traccion")) title = labels.upperBody;
    else if ((patterns.has("rodilla") || patterns.has("bisagra")) && !patterns.has("empuje") && !patterns.has("traccion")) title = labels.lowerBody;
    else if (patterns.size === 1 && patterns.has("core")) title = "Core";
    else if (patterns.size === 1 && patterns.has("cardio")) title = "Cardio";
    else if (muscles.match(/pecho|espalda|hombro|dorsal|biceps|triceps/)) title = labels.upperBody;
  }

  var typeBadge = labels.strength;
  if (patterns.size === 1 && patterns.has("cardio")) typeBadge = "Cardio";
  else if (patterns.size === 1 && patterns.has("movilidad")) typeBadge = labels.mobility;

  return { title: title, typeBadge: typeBadge };
}
