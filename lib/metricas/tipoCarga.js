// Tipo de carga de un ejercicio: UNA sola definicion para volumen y PR.
//  - "tiempo": la definicion del catalogo / ejercicio custom, o el ejercicio tal como esta en una rutina, tiene objetivo de tiempo
//    (exerciseHasTimeTarget). En esas series `reps` guarda SEGUNDOS: no son repeticiones y no entran en volumen ni en PR.
//  - "carga": cualquier otro (incluye ejercicios personalizados, peso corporal con lastre y unilaterales tal como se registran).
// No se infiere nada del texto del musculo ni del nombre (el falso positivo "Hombro/Core" de la clasificacion anterior).
// Modulo puro.

import { exerciseHasTimeTarget } from "../workoutSession.js";

export const TIPO_CARGA = { CARGA: "carga", TIEMPO: "tiempo" };

/**
 * Indice id -> true de los ejercicios por tiempo.
 *  catalogo: lista de definiciones (EX + custom); rutinas: filas de rutinas (datos.days) o rutinas locales (days).
 */
export function indiceEjerciciosPorTiempo(catalogo, rutinas) {
  var out = {};
  (Array.isArray(catalogo) ? catalogo : []).forEach(function (e) {
    if (e && e.id != null && exerciseHasTimeTarget(e)) out[String(e.id)] = true;
  });
  (Array.isArray(rutinas) ? rutinas : []).forEach(function (r) {
    var days = (r && (r.days || (r.datos && r.datos.days))) || [];
    (Array.isArray(days) ? days : []).forEach(function (day) {
      [].concat((day && day.warmup) || [], (day && day.exercises) || []).forEach(function (ex) {
        if (ex && ex.id != null && exerciseHasTimeTarget(ex)) out[String(ex.id)] = true;
      });
    });
  });
  return out;
}

export function tipoDeCarga(ejercicioId, indiceTiempo) {
  return indiceTiempo && ejercicioId != null && indiceTiempo[String(ejercicioId)] ? TIPO_CARGA.TIEMPO : TIPO_CARGA.CARGA;
}
