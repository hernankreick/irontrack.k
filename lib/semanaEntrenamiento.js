// P0-1 — Semana (y ciclo) COHERENTES entre las series y la sesion de UN mismo entrenamiento.
//
// Problema (auditoria): logSet etiquetaba cada serie con la semana que ve el alumno (studentCurrentWeek = max(sesiones, semana_activa)) y
// finalizarSesion guardaba la sesion con rutina.datos.semana_activa. Si ambas diferian, serie y sesion quedaban en semanas distintas.
//
// Fuente elegida: la semana que el alumno VE al iniciar (la misma con la que WorkoutScreen muestra la prescripcion: resolveExerciseForWeek(ex,
// currentWeek) con currentWeek = studentCurrentWeek). Se congela en `session.semanaIdx` (base 0, ver prepararInicioEntrenamiento) y TODO el
// entrenamiento la usa: series (progreso.semana = indice base 0) y sesion (sesiones.semana = indice + 1). No se cambia lo que se muestra.
// El ciclo se congela igual en `session.ciclo` (ya existia).
//
// Cambio de semana durante el entrenamiento (p. ej. una reconciliacion automatica avanza semana_activa): NO bloquea. Series y sesion siguen en la
// semana congelada (misma semana logica) y WorkoutScreen sigue mostrando su prescripcion; `semanaVisibleCambio` lo informa sin bloquear.
// Conflicto REAL: si el ciclo vigente de la rutina del entrenamiento (cambio local, p. ej. recarga tras un reinicio) deja de ser el del inicio,
// NO se guarda nada nuevo con datos contradictorios. Las series ya guardadas no se reasignan ni se inventa su sesion (el entrenador puede
// validarlas como huerfanas). Un reinicio hecho solo en el servidor no se ve aqui: la sesion se guarda en su ciclo original (ciclo_cambiado).
// Sesiones sin semana congelada (flujos anteriores): se usa la semana "legada" que calcula quien llama, como antes.
// Modulo puro: sin React, sin Supabase, sin almacenamiento, sin reloj.

import { readCicloActual } from "./rutinaCiclo.js";
import { progresoSemanaToSesionSemana } from "./orphanSessions.js";

// SEMANA ya no se usa para bloquear (se conserva solo para el texto); el unico bloqueo es CICLO.
export const MOTIVO_CONFLICTO = { SEMANA: "semana_cambio", CICLO: "ciclo_cambio" };

/** Indice de semana base 0 (0..3) valido, o null. Acepta solo enteros (nada de "1", null ni booleanos). */
export function semanaIdxValida(n) {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 3 ? n : null;
}

/** Indice base 0 (progreso.semana) -> semana de sesion base 1 (sesiones.semana). Reutiliza la conversion existente; null si no es valida. */
export function semanaIdxToSesion(idx) {
  var v = semanaIdxValida(idx);
  return v == null ? null : progresoSemanaToSesionSemana(v);
}

/** Semana de sesion base 1 (1..4) -> indice base 0. null si no es valida. Inversa de progresoSemanaToSesionSemana. */
export function semanaSesionToIdx(semana) {
  return typeof semana === "number" && Number.isInteger(semana) && semana >= 1 && semana <= 4 ? semana - 1 : null;
}

/** Ciclo vigente de la rutina del entrenamiento (la de session.rId, NO routines[0]); sin esa rutina => null (no se puede comparar). */
export function cicloVivoDeSesion(routines, session) {
  var list = Array.isArray(routines) ? routines : [];
  var rId = session && session.rId;
  if (rId == null) return null;
  var r = list.find(function (x) { return x && String(x.id) === String(rId); });
  return r ? readCicloActual(r.datos) : null;
}

/**
 * Semana y ciclo con los que se guardan las series y la sesion de este entrenamiento.
 * @param {object} p
 * @param {object} p.session            sesion abierta (semanaIdx / ciclo congelados al iniciar)
 * @param {number} [p.semanaVisibleIdx] semana (base 0) que el alumno ve AHORA (studentCurrentWeek)
 * @param {number|null} [p.cicloVivo]   ciclo vigente ahora de la rutina del entrenamiento (cicloVivoDeSesion)
 * @param {number} [p.semanaLegadaIdx]  semana (base 0) que se usaba antes; solo para sesiones sin semana congelada
 * @param {number} [p.cicloLegado]      ciclo que se usaba antes; solo para sesiones sin ciclo congelado
 * @returns {{ok:true, fuente:"sesion"|"legado", semanaIdx:number|null, semanaProgreso:number|null, semanaSesion:number|null, ciclo:number|null}
 *          |{ok:false, motivo:"ciclo_cambio", semanaIdx:number, visibleIdx:number|null, ciclo:number|null, cicloVivo:number|null}}
 *          ok:true trae `semanaVisibleCambio` (la semana visible ya no es la congelada; informativo, no bloquea).
 */
export function resolverSemanaEntrenamiento(p) {
  var o = p || {};
  var s = o.session || {};
  var congelada = semanaIdxValida(s.semanaIdx);
  var cicloCongelado = typeof s.ciclo === "number" && Number.isInteger(s.ciclo) && s.ciclo >= 1 ? s.ciclo : null;

  if (congelada == null) {
    var legada = semanaIdxValida(o.semanaLegadaIdx);
    return {
      ok: true, fuente: "legado", semanaVisibleCambio: false, semanaIdx: legada, semanaProgreso: legada, semanaSesion: semanaIdxToSesion(legada),
      ciclo: cicloCongelado != null ? cicloCongelado : (o.cicloLegado != null ? o.cicloLegado : null),
    };
  }

  var visible = semanaIdxValida(o.semanaVisibleIdx);
  var semanaVisibleCambio = visible != null && visible !== congelada;   // informativo: no bloquea
  var vivo = o.cicloVivo != null ? o.cicloVivo : null;
  if (cicloCongelado != null && vivo != null && vivo !== cicloCongelado) {
    return { ok: false, motivo: MOTIVO_CONFLICTO.CICLO, semanaIdx: congelada, visibleIdx: visible, semanaVisibleCambio: semanaVisibleCambio, ciclo: cicloCongelado, cicloVivo: vivo };
  }
  return {
    ok: true, fuente: "sesion", semanaIdx: congelada, semanaProgreso: congelada, semanaSesion: semanaIdxToSesion(congelada),
    semanaVisibleCambio: semanaVisibleCambio,
    ciclo: cicloCongelado != null ? cicloCongelado : (o.cicloLegado != null ? o.cicloLegado : null),
  };
}

/** Texto para el alumno cuando hay conflicto (es / en). El entrenamiento sigue abierto; no se guarda nada contradictorio. */
export function textoConflictoSemana(motivo, es) {
  var ciclo = motivo === MOTIVO_CONFLICTO.CICLO;
  if (es) {
    return ciclo
      ? "Tu entrenador reinició el plan mientras entrenabas. Lo que ya registraste quedó guardado, pero esta sesión no se puede cerrar sobre el plan nuevo: salí del entrenamiento y empezá de nuevo."
      : "La semana de tu plan cambió mientras entrenabas. No guardamos esto para no mezclar datos: salí del entrenamiento y empezá de nuevo.";
  }
  return ciclo
    ? "Your coach restarted the plan while you were training. What you already logged is saved, but this session cannot be closed on the new plan: leave the workout and start again."
    : "Your plan week changed while you were training. We did not save this to avoid mixing data: leave the workout and start again.";
}
