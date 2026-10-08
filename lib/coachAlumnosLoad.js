// Carga de alumnos del entrenador: una sola fuente, sin carreras y sin convertir errores en "0 alumnos".
// Identidad: hasta S0.6 / RLS definitiva, los alumnos se leen por entrenador_id = "entrenador_principal"
// (mismo valor con el que se crean). No se combina con el UUID de Auth.

export const COACH_ALUMNOS_QUERY_ID = "entrenador_principal";

export const ALUMNOS_STATUS = {
  IDLE: "idle",
  LOADING: "loading",
  READY: "ready",
  ERROR: "error",
};

/** Marca la carga mas reciente; las respuestas de cargas anteriores quedan obsoletas. */
export function createLoadGate() {
  var seq = 0;
  return {
    begin: function () { seq += 1; return seq; },
    isCurrent: function (ticket) { return ticket === seq; },
  };
}

/**
 * fetchRows debe lanzar ante error HTTP/red (no devolver null).
 * Resultado: { status: "ready", alumnos } | { status: "error", error } | { status: "stale" }.
 * Nunca devuelve una lista vacia por un error.
 */
export async function loadCoachAlumnos(opts) {
  var ticket = opts.gate ? opts.gate.begin() : 0;
  var rows;
  try {
    rows = await opts.fetchRows(COACH_ALUMNOS_QUERY_ID);
  } catch (e) {
    if (opts.gate && !opts.gate.isCurrent(ticket)) return { status: "stale" };
    return { status: "error", error: e };
  }
  if (opts.gate && !opts.gate.isCurrent(ticket)) return { status: "stale" };
  if (!Array.isArray(rows)) return { status: "error", error: new Error("Respuesta de alumnos invalida") };
  return { status: "ready", alumnos: opts.clean(rows, COACH_ALUMNOS_QUERY_ID) };
}

/** Texto de estado para la lista vacia: carga pendiente, error o vacio real. */
export function alumnosEmptyKind(status, count) {
  if (count > 0) return "list";
  if (status === ALUMNOS_STATUS.ERROR) return "error";
  if (status === ALUMNOS_STATUS.IDLE || status === ALUMNOS_STATUS.LOADING) return "loading";
  return "empty";
}
