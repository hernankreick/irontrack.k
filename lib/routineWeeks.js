/**
 * getRoutineWeekCount(routine)
 *
 * Recorre routine.days[].warmup[] y routine.days[].exercises[] y devuelve
 * el maximo de ex.weeks.length entre TODOS los ejercicios de TODOS los dias.
 * Si ningun ejercicio tiene weeks (o la rutina no tiene dias/ejercicios),
 * devuelve 0. Nunca inventa un numero.
 */
export function getRoutineWeekCount(routine) {
  var days = (routine && routine.days) || [];
  var max = 0;
  days.forEach(function (day) {
    var exercises = [].concat(day.warmup || [], day.exercises || []);
    exercises.forEach(function (exercise) {
      var weeksLen = (exercise && exercise.weeks && exercise.weeks.length) || 0;
      if (weeksLen > max) max = weeksLen;
    });
  });
  return max;
}
