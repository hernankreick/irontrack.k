import { normalizeFecha } from "./normalizeFecha.js";
import { getRoutineWeekCount } from "./routineWeeks.js";
import { cicloPayloadFields, readCicloActual, rowCiclo, rowInCiclo } from "./rutinaCiclo.js";
import { clasificarCarga } from "./metricas/pr.js";
import { validarKgEntrada, repsRegistrables } from "./cargaSerie.js";

export function normalizeWorkoutKg(kg) {
  // D7.3: coma decimal ("82,5" en teclados en espanol) = 82.5; antes parseFloat la cortaba en 82.
  if (typeof kg === "string" && /^\s*-?\d+,\d+\s*$/.test(kg)) kg = kg.replace(",", ".");
  var parsed = parseFloat(kg);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeWorkoutReps(reps) {
  var parsed = parseInt(reps, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeWorkoutSet(input) {
  var set = input || {};
  var out = {
    kg: normalizeWorkoutKg(set.kg),
    reps: normalizeWorkoutReps(set.reps),
    date: set.date || set.fecha || "",
    week: set.week,
    note: set.note || set.nota || "",
    rpe: set.rpe || null,
    // Campo opcional adicional: solo presente cuando el set viene
    // hidratado desde Supabase (hydrateProgressFromRows pasa
    // row.created_at). Los sets que arma logSet en vivo no lo tienen
    // (no se inventa un timestamp de cliente) y quedan undefined.
    created_at: set.created_at,
    // D7.1: ciclo de la rutina en que se registro la serie (logSet lo toma de datos.ciclo_actual; la hidratacion, de progreso.ciclo).
    // Sin valor (series locales anteriores a D7.1) queda undefined y no filtra por ciclo (comportamiento anterior).
    ciclo: set.ciclo != null && set.ciclo !== "" ? set.ciclo : undefined,
  };
  // D76-04: identidad persistida opcional (progreso.id hidratado, o el opId de la serie local). Solo si viene: sin id no se agrega la clave.
  if (typeof set.id === "string" && set.id !== "") out.id = set.id;
  return out;
}

export function exerciseHasTimeTarget(exercise) {
  if (!exercise) return false;
  var fields = [
    exercise.duration,
    exercise.duracion,
    exercise.time,
    exercise.tiempo,
    exercise.seconds,
    exercise.segundos,
    exercise.reps,
  ];
  // D7.3: "s" solo cuenta como segundos pegada a un numero ("45s", "30 s"). Antes /s\b/ marcaba como «por tiempo» cualquier texto que
  // terminara en s ("10 reps", "3 series", "10 alternos"), y como el indice de tiempo se arma con todas las rutinas del entrenador,
  // un "10 reps" en la rutina de un alumno dejaba sin volumen ni PR ese ejercicio para TODOS.
  return fields.some(function (value) {
    return /("|''|seg|sec|seconds|\d\s*s\b|min|time|tiempo|duraci)/i.test(String(value || ""));
  });
}

export function exerciseHasSuggestedLoad(exercise) {
  if (exerciseIsBodyweightLike(exercise)) return false;
  if (!exercise || exercise.kg == null) return false;
  var raw = String(exercise.kg).trim();
  if (!raw) return false;
  return normalizeWorkoutKg(raw) > 0;
}

export function exerciseIsBodyweightLike(exercise) {
  if (!exercise) return false;
  var text = [
    exercise.name,
    exercise.nameEn,
    exercise.nombre,
    exercise.id,
    exercise.pattern,
    exercise.muscle,
    exercise.equip,
  ].join(" ").toLowerCase();
  return /(plancha|plank|puente|bridge|movilidad|mobility|stretch|stretching|estiramiento|core|peso corporal|bodyweight|sin peso|libre|paralelas|colchoneta|dominada|dominadas|pull[\s-]?up|chin[\s-]?up|fondos|dips?\b|push[\s-]?up|flexion|flexiones|abdominal|abdominales|crunch|hollow|burpee|saltos?|jump|trote|jog|skipping|high knees)/i.test(text);
}

export function resolveWorkoutRepsInput(reps, exercise) {
  var parsed = normalizeWorkoutReps(reps);
  if (parsed > 0) return parsed;
  if (!exerciseHasTimeTarget(exercise)) return 0;
  return (
    normalizeWorkoutReps(exercise.duration) ||
    normalizeWorkoutReps(exercise.duracion) ||
    normalizeWorkoutReps(exercise.time) ||
    normalizeWorkoutReps(exercise.tiempo) ||
    normalizeWorkoutReps(exercise.seconds) ||
    normalizeWorkoutReps(exercise.segundos) ||
    normalizeWorkoutReps(exercise.reps)
  );
}

export function canLogWorkoutSet(exercise, kg, reps) {
  // D7.6: repeticiones enteras en [1, techo tecnico] y kg valido (sin negativos, NaN, infinitos ni texto) en TODOS los ejercicios,
  // incluidos peso corporal / lastre / tiempo (antes, sin carga sugerida, un kg negativo se registraba). Ver lib/cargaSerie.js.
  if (!repsRegistrables(resolveWorkoutRepsInput(reps, exercise))) return false;
  var carga = validarKgEntrada(kg);
  if (!carga.ok) return false;
  if (!exerciseHasSuggestedLoad(exercise)) return true;
  return carga.kg > 0;
}

export function formatWorkoutDuration(value) {
  var raw = String(value == null ? "" : value).trim();
  if (!raw) return "";
  var n = normalizeWorkoutReps(raw);
  if (!Number.isFinite(n) || n <= 0) return raw;
  return n >= 60 && n % 60 === 0 ? (n / 60) + "'" : n + '"';
}

export function formatWorkoutSetLabel(exercise, set) {
  var ex = exercise || {};
  var s = set || {};
  var reps = normalizeWorkoutReps(s.reps);
  var kg = normalizeWorkoutKg(s.kg);
  // exerciseHasSuggestedLoad mira el kg prescrito de la definicion del
  // ejercicio (routine.exercises[].kg), que es solo un dato en memoria
  // (updateExerciseKgInRoutines) y no se persiste en la rutina guardada.
  // Tras un logout/login la rutina se rehidrata desde Supabase con ese
  // campo vacio, pero el historial real (progress[ex.id].sets) sigue
  // teniendo kg > 0. Si ESTE set en particular ya tiene un kg real
  // registrado, se respeta ese dato en vez de asumir que el ejercicio
  // nunca tuvo carga.
  if (exerciseHasSuggestedLoad(ex) || kg > 0) {
    return kg + "kg × " + reps;
  }
  if (exerciseHasTimeTarget(ex)) {
    return formatWorkoutDuration(reps);
  }
  return reps + " reps";
}

export function buildExerciseSetRecord(kg, reps, date, week, note, rpe, ciclo) {
  return normalizeWorkoutSet({
    kg: kg,
    reps: reps,
    date: date,
    week: week,
    note: note,
    rpe: rpe,
    ciclo: ciclo,
  });
}

/** D7.3: volumen de una serie = kg x reps solo con kg > 0 y reps > 0 (antes un kg negativo restaba). Misma base que lib/metricas/volumen.js. */
export function calculateSetVolume(set) {
  var normalized = normalizeWorkoutSet(set);
  return normalized.kg > 0 && normalized.reps > 0 ? normalized.kg * normalized.reps : 0;
}

export function calculateSetsVolume(sets) {
  return (Array.isArray(sets) ? sets : []).reduce(function (acc, set) {
    return acc + calculateSetVolume(set);
  }, 0);
}

export function getExerciseSets(progress, exerciseId) {
  var entry = progress && exerciseId != null ? progress[exerciseId] : null;
  return entry && Array.isArray(entry.sets) ? entry.sets : [];
}

/**
 * Series de un dia. D7.1: la fecha se compara normalizada ("5/3/2026" === "05/03/2026") y, si se pasa `ciclo`, solo cuentan las series de
 * ese ciclo: tras un reinicio el mismo dia, las series del ciclo anterior no completan ejercicios del ciclo nuevo. Una serie sin ciclo
 * (local, anterior a D7.1) no se filtra por ciclo.
 */
export function filterSetsByDay(sets, date, currentWeek, checkWeek, ciclo) {
  var fecha = normalizeFecha(String(date || ""));
  return (Array.isArray(sets) ? sets : []).filter(function (set) {
    if (!set || !set.date || normalizeFecha(String(set.date)) !== fecha) return false;
    if (ciclo != null && set.ciclo != null && set.ciclo !== "" && !rowInCiclo(set, ciclo)) return false;
    if (!checkWeek) return true;
    return set.week === undefined || set.week === currentWeek;
  });
}

export function getExerciseSetsForDay(progress, exerciseId, date, currentWeek, options) {
  var opts = options || {};
  return filterSetsByDay(getExerciseSets(progress, exerciseId), date, currentWeek, opts.checkWeek !== false, opts.ciclo);
}

/**
 * Prescripción EFECTIVA de un ejercicio en la semana activa: series, reps, kg y pausa de `exercise.weeks[weekIndex]`, y el valor base del
 * ejercicio (`sets`, `reps`, `kg`, `pause`) SOLO cuando esa semana no define el dato. Es la misma regla que ya usa la vista Inicio
 * (`w.sets || ex.sets`, `w.pausa || ex.pause`), para que lo mostrado, lo ejecutado y lo validado coincidan.
 * Función pura: devuelve una copia (nunca muta la rutina ni el historial) y, sin semanas configuradas o con un índice inválido,
 * devuelve el MISMO ejercicio (compatibilidad total con ejercicios sin progresión semanal).
 * @param {object} exercise ejercicio de la rutina
 * @param {number} weekIndex índice 0-based de la semana activa
 */
export function resolveExerciseForWeek(exercise, weekIndex) {
  if (!exercise || typeof exercise !== "object") return exercise;
  if (!Array.isArray(exercise.weeks) || !Number.isInteger(weekIndex) || weekIndex < 0) return exercise;
  var w = exercise.weeks[weekIndex];
  if (!w || typeof w !== "object") return exercise;
  return Object.assign({}, exercise, {
    sets: w.sets || exercise.sets,
    reps: w.reps || exercise.reps,
    kg: w.kg || exercise.kg,
    pause: w.pausa || exercise.pause,
  });
}

export function getWorkoutExerciseStatus(params) {
  var p = params || {};
  var exercise = p.exercise || null;
  var setsToday = exercise
    ? getExerciseSetsForDay(p.progress, exercise.id, p.date, p.currentWeek, { checkWeek: p.checkWeek !== false, ciclo: p.ciclo })
    : [];
  var totalSets = parseInt(exercise && exercise.sets, 10) || 3;
  return {
    setsToday: setsToday,
    totalSets: totalSets,
    remainingSets: Math.max(0, totalSets - setsToday.length),
    currentSetNumber: setsToday.length + 1,
    lastSet: setsToday[0],
    pr: exercise && p.progress && p.progress[exercise.id] ? p.progress[exercise.id].max || 0 : 0,
    isDone: setsToday.length >= totalSets,
    volume: calculateSetsVolume(setsToday),
  };
}

export function calculateDayProgress(exercises, progress, date, currentWeek, options) {
  var list = Array.isArray(exercises) ? exercises : [];
  var opts = options || {};
  var done = list.filter(function (exercise) {
    return getExerciseSetsForDay(progress, exercise.id, date, currentWeek, { checkWeek: opts.checkWeek === true, ciclo: opts.ciclo }).length > 0;
  }).length;
  return {
    done: done,
    total: list.length,
    pct: list.length > 0 ? (done / list.length) * 100 : 0,
  };
}

export function updateExerciseProgressRecord(currentProgressEntry, newSet) {
  var current = currentProgressEntry || { sets: [], max: 0 };
  var sets = Array.isArray(current.sets) ? current.sets : [];
  var normalized = normalizeWorkoutSet(newSet);
  // D7.4: el record (max) solo cuenta series validas (kg > 0 y reps > 0), como lib/metricas/pr.js; sobre TODO el historial
  // (sets se recorta a 50 para la vista, max no).
  var valida = normalized.kg > 0 && normalized.reps > 0;
  return Object.assign({}, current, {
    sets: [normalized].concat(sets).slice(0, 50),
    max: valida ? Math.max(current.max || 0, normalized.kg) : (current.max || 0),
  });
}

/**
 * Agrupa filas crudas de la tabla `progreso` (alumno_id, ejercicio_id, kg,
 * reps, fecha, semana, nota, created_at, ...) por ejercicio_id y devuelve
 * el mismo shape que ya usa progress[ex.id] en memoria: { sets: [...], max }.
 * Reutiliza updateExerciseProgressRecord (sin tocarla) para que el orden y
 * el tope de 50 sets sean idénticos a los que arma logSet en vivo.
 */
export function hydrateProgressFromRows(rows) {
  var byExercise = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var exId = row && row.ejercicio_id;
    if (exId == null) return;
    if (!byExercise[exId]) byExercise[exId] = [];
    byExercise[exId].push(row);
  });
  var progress = {};
  Object.keys(byExercise).forEach(function (exId) {
    var rowsForEx = byExercise[exId].slice().sort(function (a, b) {
      // Mas antiguo -> mas reciente, para que al aplicar
      // updateExerciseProgressRecord (que inserta al frente) el resultado
      // quede con el set mas nuevo primero, igual que logSet.
      return new Date((a && a.created_at) || 0) - new Date((b && b.created_at) || 0);
    });
    var entry = { sets: [], max: 0 };
    rowsForEx.forEach(function (row) {
      entry = updateExerciseProgressRecord(entry, {
        kg: row.kg,
        reps: row.reps,
        date: row.fecha,
        week: row.semana,
        note: row.nota,
        rpe: null,
        created_at: row.created_at,
        ciclo: row.ciclo,
        id: row.id, // D76-04
      });
    });
    progress[exId] = entry;
  });
  return progress;
}

function parseEsArDateToTime(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return 0;
  var parts = dateStr.split("/");
  if (parts.length !== 3) return 0;
  var day = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var year = parseInt(parts[2], 10);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
}

function getSetCreatedAtTime(set) {
  if (!set || set.created_at == null) return null;
  var t = new Date(set.created_at).getTime();
  return Number.isFinite(t) ? t : null;
}

// Mismos campos que buildProgressPayload persiste realmente en la tabla
// progreso (kg, reps, fecha, semana, nota) -- deliberadamente sin rpe (no
// se persiste en Supabase, hydrateProgressFromRows siempre lo deja en
// null) y sin created_at/id (nunca inventados). Dos sets con esta misma
// combinacion de valores son, con los datos que tenemos, indistinguibles
// entre "la misma fila vista dos veces" y "dos series reales idénticas".
function buildSetMatchKey(set) {
  var s = set || {};
  // D7.3: fecha normalizada ("5/3/2026" local y "05/03/2026" hidratada son la misma serie, no dos).
  return JSON.stringify([s.kg, s.reps, normalizeFecha(s.date || ""), s.week == null ? null : s.week, s.note || ""]);
}

/**
 * Reconcilia los sets locales con los hidratados para un mismo ejercicio
 * sin colapsar series legitimamente repetidas. Agrupa ambos lados por
 * buildSetMatchKey y, DENTRO de cada grupo, conserva
 * max(cantidad local, cantidad hidratada) copias -- nunca la suma de
 * ambas, nunca menos que el lado que tiene mas.
 *
 * Por que esto es seguro: buildProgressPayload/addProgreso (online) y el
 * flush de pendingSync (offline) persisten en Supabase exactamente los
 * mismos valores de kg/reps/fecha/semana/nota que ya tiene el set local
 * que los origino. Entonces, si un set local todavia sin created_at
 * coincide en esos 5 campos con un set hidratado, lo mas razonable es
 * que sean la misma fila (el hidratado trae created_at real, mas
 * confiable para ordenar) y no dos series distintas. Si hay MAS copias
 * locales que hidratadas para la misma combinacion (sets aun no
 * sincronizados, o 3 series reales idénticas que todavia no tienen
 * contraparte en Supabase), las copias sobrantes se conservan tal cual
 * -- nunca se descarta una serie que no tiene con que emparejarse.
 */
export function dedupeMatchedSets(localSets, hydratedSets) {
  // D76-04: emparejamiento explicito (antes: grupos por firma de campos sin ciclo ni id, que con dos ciclos de mismos valores
  // borraba la serie de un ciclo y duplicaba la del otro). Politica, en orden de prioridad:
  //   1) id: local e hidratado con el mismo id (opId = progreso.id, sin distinguir mayusculas) son la misma fila.
  //   2) firma (buildSetMatchKey) + ciclo: solo si AMBOS tienen ciclo explicito y es el mismo.
  //   3) firma con ciclo desconocido: si al menos uno no tiene ciclo (datos anteriores a D7.1 o servidor sin la columna) =
  //      comportamiento anterior. Se emite el hidratado tal cual: una serie sin ciclo nunca se re-atribuye a un ciclo.
  // Dos series con ids distintos nunca se fusionan (son operaciones distintas aunque coincidan los valores).
  // Salida: hidratado de cada par + locales sin par + hidratados sin par => max(local, hidratado) por grupo, nunca suma,
  // nunca descarta. Determinista: se recorre en orden de entrada.
  var locals = Array.isArray(localSets) ? localSets : [];
  var hydrated = Array.isArray(hydratedSets) ? hydratedSets : [];
  var localPaired = new Array(locals.length);
  var hydratedPaired = new Array(hydrated.length);
  function setId(set) {
    var id = set && set.id;
    return typeof id === "string" && id !== "" ? id.toLowerCase() : null;
  }
  function hasCiclo(set) {
    return !!set && set.ciclo != null && set.ciclo !== "";
  }
  function idsConflict(a, b) {
    var ia = setId(a);
    var ib = setId(b);
    return ia != null && ib != null && ia !== ib;
  }
  function pass(canPair) {
    for (var i = 0; i < locals.length; i++) {
      if (localPaired[i]) continue;
      for (var j = 0; j < hydrated.length; j++) {
        if (hydratedPaired[j]) continue;
        if (canPair(locals[i], hydrated[j])) {
          localPaired[i] = true;
          hydratedPaired[j] = true;
          break;
        }
      }
    }
  }
  // Paso 1: identidad persistida.
  pass(function (l, h) {
    var il = setId(l);
    return il != null && il === setId(h);
  });
  // Paso 2: firma de campos + mismo ciclo explicito.
  pass(function (l, h) {
    if (idsConflict(l, h) || !hasCiclo(l) || !hasCiclo(h)) return false;
    return rowCiclo(l) === rowCiclo(h) && buildSetMatchKey(l) === buildSetMatchKey(h);
  });
  // Paso 3: firma de campos con ciclo desconocido en al menos uno (comodin conservador = comportamiento anterior).
  pass(function (l, h) {
    if (idsConflict(l, h) || (hasCiclo(l) && hasCiclo(h))) return false;
    return buildSetMatchKey(l) === buildSetMatchKey(h);
  });
  var out = [];
  hydrated.forEach(function (set, j) { if (hydratedPaired[j]) out.push(set); });
  locals.forEach(function (set, i) { if (!localPaired[i]) out.push(set); });
  hydrated.forEach(function (set, j) { if (!hydratedPaired[j]) out.push(set); });
  return out;
}

/**
 * Combina una entrada local de progress[ex.id] (posible sesion en curso sin
 * sincronizar) con una entrada hidratada desde Supabase para el mismo
 * ejercicio. Reconcilia sets duplicados (misma fila vista local + ya
 * sincronizada) vía dedupeMatchedSets, sin colapsar series legitimamente
 * repetidas, y ordena por recencia (mas reciente primero), aplicando el
 * mismo tope de 50 que usa updateExerciseProgressRecord. El max resultante
 * es el mayor de los dos max.
 *
 * Orden: si AMBOS sets que se estan comparando tienen created_at, se
 * comparan por ese timestamp (mas preciso, con hora). Si a alguno de los
 * dos le falta, se cae a parseEsArDateToTime(date) solo para esa
 * comparacion puntual, sin romper el orden del lado que si lo tiene.
 */
export function mergeProgressEntries(localEntry, hydratedEntry) {
  var a = localEntry || { sets: [], max: 0 };
  var b = hydratedEntry || { sets: [], max: 0 };
  var setsA = Array.isArray(a.sets) ? a.sets : [];
  var setsB = Array.isArray(b.sets) ? b.sets : [];
  var merged = dedupeMatchedSets(setsA, setsB).sort(function (x, y) {
    var xCreatedAt = getSetCreatedAtTime(x);
    var yCreatedAt = getSetCreatedAtTime(y);
    if (xCreatedAt != null && yCreatedAt != null) {
      return yCreatedAt - xCreatedAt;
    }
    return parseEsArDateToTime(y && y.date) - parseEsArDateToTime(x && x.date);
  }).slice(0, 50);
  return {
    sets: merged,
    max: Math.max(a.max || 0, b.max || 0),
  };
}

export function updateExerciseKgInRoutineDays(days, exerciseId, kg) {
  return (Array.isArray(days) ? days : []).map(function (day) {
    return Object.assign({}, day, {
      exercises: (day.exercises || []).map(function (exercise) {
        return exercise.id === exerciseId ? Object.assign({}, exercise, { kg: String(kg) }) : exercise;
      }),
      warmup: (day.warmup || []).map(function (exercise) {
        return exercise.id === exerciseId ? Object.assign({}, exercise, { kg: String(kg) }) : exercise;
      }),
    });
  });
}

export function updateExerciseKgInRoutines(routines, exerciseId, kg) {
  return (Array.isArray(routines) ? routines : []).map(function (routine) {
    return Object.assign({}, routine, {
      days: updateExerciseKgInRoutineDays(routine.days, exerciseId, kg),
    });
  });
}

export function calculateNewWeightPR(currentProgressEntry, kg) {
  var previousMax = currentProgressEntry && currentProgressEntry.max ? currentProgressEntry.max : 0;
  // D7.6: una carga invalida (negativa, infinita, texto, fuera del techo tecnico) nunca es PR.
  var carga = validarKgEntrada(kg);
  if (!carga.ok) return null;
  var newKg = carga.kg;
  // D7.4: regla unica (lib/metricas/pr.js): sin record previo es la marca inicial; igualar no es PR
  if (clasificarCarga(previousMax, newKg) !== "pr") return null;
  return {
    kg: newKg,
    prevKg: previousMax,
    diff: Math.round((newKg - previousMax) * 10) / 10,
  };
}

export function buildCompletedDayKey(session, currentWeek) {
  if (!session) return "";
  return session.rId + "-" + session.dIdx + "-w" + currentWeek;
}

export function mergeCompletedDay(completedDays, dayKey) {
  var list = Array.isArray(completedDays) ? completedDays : [];
  if (!dayKey || list.includes(dayKey)) return list;
  return list.concat([dayKey]);
}

export function countCompletedDaysForWeek(completedDays, routineId, currentWeek) {
  var list = Array.isArray(completedDays) ? completedDays : [];
  return list.filter(function (key) {
    return String(key).startsWith(routineId + "-") && String(key).endsWith("-w" + currentWeek);
  }).length;
}

export function getWorkoutDayExercises(day) {
  if (!day) return [];
  return [].concat(day.warmup || [], day.exercises || []);
}

export function calculateWorkoutVolume(exercises, progress, date, ciclo) {
  return (Array.isArray(exercises) ? exercises : []).reduce(function (acc, exercise) {
    // D7.3: un ejercicio por tiempo guarda SEGUNDOS en reps: no entra en el volumen de carga (antes sumaba kg x segundos)
    if (exerciseHasTimeTarget(exercise)) return acc;
    // D7.1: con ciclo, solo el volumen del ciclo vigente (tras un reinicio el mismo dia no suma las series del ciclo anterior)
    var sets = getExerciseSetsForDay(progress, exercise.id, date, undefined, { checkWeek: false, ciclo: ciclo });
    return acc + calculateSetsVolume(sets);
  }, 0);
}

export function countNewSessionPRs(exercises, progress, preSessionPRs, date) {
  return buildNewSessionPRList(exercises, progress, preSessionPRs, date).length;
}

export function buildNewSessionPRList(exercises, progress, preSessionPRs, date) {
  return (Array.isArray(exercises) ? exercises : []).map(function (exercise) {
    var entry = progress && progress[exercise.id];
    if (!entry) return null;
    // D7.4: series validas (kg > 0 y reps > 0) y sin ejercicios por tiempo; el primer registro del ejercicio es la marca inicial
    // (antes contaba como PR nuevo porque el record previo era 0), igualar no es PR.
    if (exerciseHasTimeTarget(exercise)) return null;
    var setsToday = filterSetsByDay(entry.sets || [], date, undefined, false).filter(function (set) {
      return normalizeWorkoutKg(set && set.kg) > 0 && normalizeWorkoutReps(set && set.reps) > 0;
    });
    if (!setsToday.length) return null;
    var maxToday = Math.max.apply(null, setsToday.map(function (set) {
      return normalizeWorkoutKg(set && set.kg);
    }));
    var prevKg = (preSessionPRs && preSessionPRs[exercise.id]) || 0;
    if (clasificarCarga(prevKg, maxToday) !== "pr") return null;
    return {
      exId: exercise.id,
      ejercicio: exercise.name || exercise.nameEn || exercise.nombre || exercise.id,
      kg: maxToday,
      prevKg: prevKg,
      diff: Math.round((maxToday - prevKg) * 10) / 10,
    };
  }).filter(Boolean);
}

export function buildWorkoutSummary(params) {
  var p = params || {};
  var session = p.session || {};
  var activeDay = p.activeDay || {};
  var activeRoutine = p.activeRoutine || {};
  var exercises = getWorkoutDayExercises(activeDay);
  var date = p.date || "";
  var durationMs = (p.now || Date.now()) - (session.startTime || (p.now || Date.now()));
  var durMin = Math.round(durationMs / 60000) || 1;
  var prs = buildNewSessionPRList(exercises, p.progress, p.preSessionPRs, date);
  return {
    durMin: durMin,
    ejercicios: exercises.length,
    // Series planificadas del día en la semana que se guarda (weekToSave es 1-based); sin semana, el valor base como antes.
    totalSets: exercises.reduce(function (acc, exercise) {
      var weekEx = Number.isInteger(p.weekToSave) && p.weekToSave >= 1 ? resolveExerciseForWeek(exercise, p.weekToSave - 1) : exercise;
      return acc + (parseInt(weekEx.sets, 10) || 3);
    }, 0),
    volTotal: Math.round(calculateWorkoutVolume(exercises, p.progress, date, activeRoutine.datos ? readCicloActual(activeRoutine.datos) : undefined)),
    prsNuevos: prs.length,
    prs: prs,
    diaLabel: activeDay.label || ("Dia " + ((session.dIdx || 0) + 1)),
    rutinaName: activeRoutine.name || "Entrenamiento",
    fecha: date,
    semana: p.weekToSave,
    totalSemanas: getRoutineWeekCount(activeRoutine),
  };
}

export function buildSessionPayload(params) {
  var p = params || {};
  var session = p.session || {};
  var activeDay = p.activeDay || {};
  var exercises = Array.isArray(p.exercises) ? p.exercises : activeDay.exercises || [];
  var activeRoutine = p.activeRoutine || {};
  return Object.assign({
    alumno_id: p.alumnoId,
    rutina_id: p.includeRoutineId ? activeRoutine.id || null : undefined,
    rutina_nombre: activeRoutine.name || "",
    dia_label: activeDay.label || ("Dia " + ((session.dIdx || 0) + 1)),
    dia_idx: session.dIdx,
    semana: p.weekToSave,
    ejercicios: exercises.map(function (exercise) { return exercise.id; }).join(","),
    fecha: p.date,
    hora: p.time,
  }, cicloPayloadFields(p.ciclo));
}

export function removeUndefinedPayloadFields(payload) {
  var out = {};
  Object.keys(payload || {}).forEach(function (key) {
    if (payload[key] !== undefined) out[key] = payload[key];
  });
  return out;
}

// rutina_id utilizable: texto no vacio o numero finito (mismo criterio que idTexto de lib/cumplimiento). Compara sin distinguir mayusculas.
function rutinaIdClave(value) {
  if (typeof value === "string") { var t = value.trim().toLowerCase(); return t === "" ? null : t; }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

// P0-2: dos filas son de RUTINAS DISTINTAS solo si AMBAS tienen rutina_id valido y difieren.
// AMBIGUEDAD LEGADA (deliberada): si alguna no lo tiene (filas anteriores a la columna, modo compartido, `rutinaId` no informado) no hay forma
// de saber si son de la misma rutina; se conserva el comportamiento anterior (misma fecha + dia + semana + ciclo => duplicado). Se prefiere
// no duplicar una sesion a inventar una nueva con evidencia insuficiente.
function rutinasDistintas(a, b) {
  var ka = rutinaIdClave(a), kb = rutinaIdClave(b);
  return ka !== null && kb !== null && ka !== kb;
}

// rutinaId (opcional, ultimo argumento): sin el, o si la fila no tiene rutina_id, se compara como antes (ver rutinasDistintas).
export function sessionAlreadyExists(existingSessions, date, dayIndex, weekToSave, ciclo, rutinaId) {
  return (Array.isArray(existingSessions) ? existingSessions : []).some(function (session) {
    return normalizeFecha(session.fecha) === normalizeFecha(date) && session.dia_idx === dayIndex && session.semana === weekToSave && rowInCiclo(session, ciclo)
      && !rutinasDistintas(session.rutina_id, rutinaId);
  });
}

// alumnoId y opId son opcionales: sin ellos devuelve el formato anterior (elementos antiguos de la cola). Con ellos, el elemento queda
// asociado a su alumno y a un identificador de operacion estable (ver lib/pendingSyncQueue.js). ciclo: ver cicloPayloadFields.
export function buildPendingProgressItem(exId, kg, reps, note, date, semana, ciclo, alumnoId, opId) {
  var item = Object.assign({
    exId: exId,
    kg: normalizeWorkoutKg(kg),
    reps: normalizeWorkoutReps(reps),
    note: note || "",
    date: date,
    semana: semana,
  }, cicloPayloadFields(ciclo));
  if (alumnoId != null && alumnoId !== "") item.alumno_id = String(alumnoId);
  if (opId) item.opId = opId;
  return item;
}

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v) {
  return typeof v === "string" && UUID_RE.test(v);
}

// id (opcional): UUID de la operacion, se envia como progreso.id para que los reintentos sean idempotentes. Sin id (o si no es un UUID
// valido) el payload es el de siempre y el servidor asigna el suyo.
export function buildProgressPayload(alumnoId, exId, kg, reps, note, date, semana, ciclo, id) {
  var payload = Object.assign({
    alumno_id: alumnoId,
    ejercicio_id: exId,
    kg: normalizeWorkoutKg(kg),
    reps: normalizeWorkoutReps(reps),
    nota: note || "",
    fecha: date,
    semana: semana,
  }, cicloPayloadFields(ciclo));
  if (isUuid(id)) payload.id = id.toLowerCase();
  return payload;
}

// ¿La fila leida del servidor es la misma operacion que el payload (mismo alumno y mismos valores)? No compara fecha (el servidor puede
// normalizar su formato); el id ya coincide porque se leyo por id.
export function isSameProgressRow(row, payload) {
  if (!row || typeof row !== "object" || !payload) return false;
  var eq = function (a, b) { return String(a == null ? "" : a).toLowerCase() === String(b == null ? "" : b).toLowerCase(); };
  if (!eq(row.alumno_id, payload.alumno_id)) return false;
  if (!eq(row.ejercicio_id, payload.ejercicio_id)) return false;
  // La lectura por id no pide la columna ciclo (puede no existir aun): solo se compara si la fila la trae.
  if (row.ciclo !== undefined && rowCiclo(row) !== rowCiclo(payload)) return false;
  if (!(Number(row.kg) === Number(payload.kg)) || !(Number(row.reps) === Number(payload.reps))) return false;
  var rs = row.semana, ps = payload.semana;
  if (!((rs == null && ps == null) || Number(rs) === Number(ps))) return false;
  return (row.nota || "") === (payload.nota || "");
}

export function mergeLocalOfflineSessions(existing, incoming) {
  var out = Array.isArray(existing) ? existing.slice() : [];
  (Array.isArray(incoming) ? incoming : []).forEach(function (item) {
    if (!item) return;
    var found = out.some(function (session) {
      return (
        String(session.alumno_id || "") === String(item.alumno_id || "") &&
        normalizeFecha(session.fecha) === normalizeFecha(item.fecha) &&
        session.dia_idx === item.dia_idx &&
        session.semana === item.semana &&
        !rutinasDistintas(session.rutina_id, item.rutina_id)
      );
    });
    if (!found) out.push(item);
  });
  return out;
}

// ───────── Guardado CONFIRMADO de series (progreso) ─────────
// Una serie solo se considera guardada cuando Supabase devuelve la fila insertada. sbFetch devuelve null en HTTP no-ok
// (no lanza), asi que "no hubo excepcion" NO significa "se guardo". Mismo criterio que isValidInsertedRow de
// finalizeWorkoutSession.js (no se importa de ahi para no crear un ciclo de modulos; scripts/test-confirmedProgressSave.mjs
// comprueba que ambas coinciden).
export var PROGRESS_SAVE_TIMEOUT_MS = 15000;

export function isConfirmedProgressInsert(result) {
  return Array.isArray(result) && result.length > 0 && !!result[0] && typeof result[0] === "object";
}

/**
 * Hace UN solo intento de guardado y devuelve { confirmed: true } o { confirmed: false, reason: "unconfirmed" | "error" | "timeout" }.
 * Nunca reintenta ni lanza: el que llama decide encolar la serie. addProgreso: () => Promise<fila[] | null>.
 */
export async function persistSetConfirmed(params) {
  var p = params || {};
  var timeoutMs = p.timeoutMs != null ? p.timeoutMs : PROGRESS_SAVE_TIMEOUT_MS;
  var timer = null;
  var timedOut = new Promise(function (resolve) {
    timer = setTimeout(function () { resolve({ __timeout: true }); }, timeoutMs);
  });
  var attempt = Promise.resolve()
    .then(function () { return p.addProgreso(); })
    .then(function (value) { return { value: value }; }, function () { return { __error: true }; });
  var outcome = await Promise.race([attempt, timedOut]);
  clearTimeout(timer);
  if (outcome.__timeout) return { confirmed: false, reason: "timeout" };
  if (outcome.__error) return { confirmed: false, reason: "error" };
  return isConfirmedProgressInsert(outcome.value) ? { confirmed: true } : { confirmed: false, reason: "unconfirmed" };
}

// Cola it_pending_sync: lectura tolerante. corrupt = el texto guardado no era una lista valida (el que llama no debe pisarlo sin respaldarlo).
export function parsePendingQueue(raw) {
  if (raw == null || raw === "") return { items: [], corrupt: false };
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? { items: parsed, corrupt: false } : { items: [], corrupt: true };
  } catch (e) {
    return { items: [], corrupt: true };
  }
}
