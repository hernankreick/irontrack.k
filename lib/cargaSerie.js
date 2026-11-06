// D7.6 — Validacion de la carga (kg) y las repeticiones de una serie ANTES de registrarla.
//
// Problema: normalizeWorkoutKg (lib/workoutSession.js) usa parseFloat y acepta lo que sea que empiece con un numero: "-20" queda en -20,
// "1e5" en 100000 y "80abc" en 80. canLogWorkoutSet solo exigia kg > 0 cuando el ejercicio tiene carga sugerida, asi que en ejercicios
// de peso corporal / lastre (o cuando la rutina se rehidrato sin kg) se podia registrar y enviar a Supabase una serie con kg negativo.
// Las repeticiones vienen de pastillas y del valor prescripto ("8-10", "45s"), pero un valor fuera de rango (p. ej. 1e20) llegaba igual.
//
// Reglas (solo para series NUEVAS; el historial ya guardado no se toca ni se reinterpreta):
//  - kg vacio = 0 (peso corporal o ejercicio por tiempo sin lastre). Punto o coma decimal ("82,5" = 82.5).
//  - kg invalido: negativo, NaN, infinito, notacion cientifica, texto ("80abc") o mas de un separador decimal.
//  - kg alto: no hay tope "fisiologico". Solo un TECHO TECNICO (KG_MAX_TECNICO) muy por encima de cualquier levantamiento humano
//    documentado, para frenar errores de tipeo absurdos (p. ej. 800000 por tocar de mas) y valores que no se pueden guardar.
//  - repeticiones (o segundos en ejercicios por tiempo): entero >= 1 y <= REPS_MAX_TECNICO.
// Modulo puro (sin React, sin Supabase, sin localStorage).

/** Techo tecnico de kg: mas del triple del mayor levantamiento humano documentado. No es un limite de rendimiento. */
export var KG_MAX_TECNICO = 10000;
/** Techo tecnico de repeticiones/segundos por serie (99.999 s ~ 27 h): cubre planchas o isometricos record. */
export var REPS_MAX_TECNICO = 99999;

var KG_RE = /^\d+(?:[.,]\d+)?$|^[.,]\d+$|^\d+[.,]$/;

/**
 * Interpreta el kg ingresado. Devuelve { ok, kg, motivo }:
 *   ok true  -> kg es un numero finito en [0, KG_MAX_TECNICO] (vacio = 0);
 *   ok false -> motivo: "negativo" | "formato" | "no_finito" | "fuera_de_rango" (kg = NaN).
 */
export function validarKgEntrada(value) {
  if (value == null) return { ok: true, kg: 0, motivo: null };
  var n;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    var str = value.trim();
    if (str === "") return { ok: true, kg: 0, motivo: null };
    if (/^-/.test(str)) return { ok: false, kg: NaN, motivo: "negativo" };
    if (/^\+/.test(str)) str = str.slice(1);
    if (/^(?:infinity|inf)$/i.test(str)) return { ok: false, kg: NaN, motivo: "no_finito" };
    if (!KG_RE.test(str)) return { ok: false, kg: NaN, motivo: "formato" };
    n = Number(str.replace(",", "."));
  } else {
    return { ok: false, kg: NaN, motivo: "formato" };
  }
  if (Number.isNaN(n)) return { ok: false, kg: NaN, motivo: "formato" };
  if (!Number.isFinite(n)) return { ok: false, kg: NaN, motivo: "no_finito" };
  if (n < 0) return { ok: false, kg: NaN, motivo: "negativo" };
  if (n > KG_MAX_TECNICO) return { ok: false, kg: NaN, motivo: "fuera_de_rango" };
  // -0 se guarda como 0
  return { ok: true, kg: n === 0 ? 0 : n, motivo: null };
}

/** ¿Las repeticiones YA resueltas (numero) son registrables? Entero en [1, REPS_MAX_TECNICO]. */
export function repsRegistrables(reps) {
  var n = typeof reps === "number" ? reps : (typeof reps === "string" && /^\s*\d+\s*$/.test(reps) ? Number(reps) : NaN);
  return Number.isInteger(n) && n >= 1 && n <= REPS_MAX_TECNICO;
}

/** ¿Se puede registrar una serie con este kg y estas repeticiones resueltas? (Defensa final antes de persistir.) */
export function serieRegistrable(kg, reps) {
  return validarKgEntrada(kg).ok && repsRegistrables(reps);
}
