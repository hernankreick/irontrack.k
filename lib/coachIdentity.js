// Identidad del entrenador para consultas y escrituras.
//
// Tras RLS P0 el unico identificador valido es el UUID de Supabase Auth (alumnos.entrenador_id = auth.uid()).
// El valor legacy "entrenador_principal" ya NO se usa para consultar ni escribir: se reconoce solo para descartarlo.

export const LEGACY_COACH_ID = "entrenador_principal";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Devuelve el id como string si es un UUID real (no legacy); si no, null. */
export function realCoachIdOrNull(value) {
  if (value == null) return null;
  var s = String(value);
  return s !== LEGACY_COACH_ID && isUuid(s) ? s : null;
}

/**
 * UUID del entrenador autenticado (rol entrenador). Prefiere el usuario de la sesion de Supabase Auth; la sesion guardada
 * (it_session.entrenadorId) solo sirve si es un UUID real. Sin identidad resuelta devuelve null: nada debe consultarse ni escribirse.
 */
export function resolveCoachId(opts) {
  var o = opts || {};
  if (o.role !== "entrenador") return null;
  return realCoachIdOrNull(o.authUid) || realCoachIdOrNull(o.sessionEntrenadorId);
}

/**
 * Entrenador "dueño" de los datos compartidos que se leen (overrides de nombres/videos, ejercicios custom):
 * el propio UUID si es entrenador; el entrenador del alumno (alumnos.entrenador_id guardado en la sesion) si es alumno.
 * Un alumno NUNCA usa su propio auth uid como entrenador.
 */
export function resolveCoachScopeId(opts) {
  var o = opts || {};
  if (o.role === "entrenador") return resolveCoachId(o);
  if (o.role === "alumno") return realCoachIdOrNull(o.sessionEntrenadorId);
  return null;
}
