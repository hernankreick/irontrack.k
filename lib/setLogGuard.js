// D76-03 — Guarda de registro de series: un toque de REGISTRAR = una serie.
//
// Problema: handleLogSet (components/WorkoutExercisePanel.jsx) no tenia proteccion y logSet (App.jsx) generaba un opId nuevo en cada
// llamada; dos toques (o un toque + el swipe) guardaban dos series identicas con dos ids distintos, y el reintento idempotente de D76-01
// (progreso.id = opId) no podia deduplicarlas.
//
// Ciclo de vida de UNA accion de registro (por contexto = alumno + sesion + ejercicio):
//   idle ──attempt()──> registering ──register() ok──> confirming ──finishConfirmation(token)──> idle
//                                  └─register() false / lanza──> idle (conserva el opId para el reintento)
//   - registering: dura lo que tarda register() (sincrono: write-ahead + estado local; el POST va aparte y NO se espera).
//   - confirming: la confirmacion visual YA existente del boton ("LISTO", 800 ms). Mientras dura, otro toque no registra: con React 18
//     entre dos toques separados hay un render, asi que liberar al terminar el handler no evitaria un doble toque real.
//
// Cuando se libera:
//   - exito -> al terminar la confirmacion visual (finishConfirmation con el token de ESA operacion);
//   - error -> inmediatamente, conservando el opId: el reintento del MISMO registro usa el MISMO opId (el servidor deduplica por id);
//   - cambio de contexto (ejercicio, sesion o alumno) -> reset(scope): un cambio de contexto descarta el opId de reintento; la
//     confirmacion visual de un registro ya hecho (<=800 ms) se completa tambien si cambia el contexto, para que el toque extra de un
//     doble toque no caiga en el ejercicio siguiente (p. ej. el auto-avance de 300 ms tras la ultima serie). En idle libera y cambia de
//     generacion: un token de una generacion vieja no libera ni afecta una operacion nueva.
//   - desmontaje -> dispose(): ningun registro mas.
// Modulo puro (sin React ni almacenamiento): se prueba en node (scripts/test-d7-6SeriesDuplicadas.mjs).

export function createSetLogGuard(opts) {
  var generateId = opts && opts.generateId;
  if (typeof generateId !== "function") throw new Error("createSetLogGuard: falta generateId");
  var scope = null;
  var phase = "idle";
  var retryOpId = null;
  var gen = 0;
  var lastOpId = null;
  var disposed = false;

  function reset(nextScope) {
    retryOpId = null;
    scope = nextScope == null ? null : String(nextScope);
    // Confirmacion en curso: se conserva phase y gen; la libera el token de ESA operacion (finishConfirmation).
    if (phase === "confirming") return;
    gen++;
    phase = "idle";
  }

  // SINCRONO. register(opId) => false si no se pudo registrar; cualquier otro valor = registrado. Nunca relanza.
  function attempt(attemptScope, register) {
    if (disposed) return { status: "disposed" };
    if (phase !== "idle") return { status: "busy" };
    var s = attemptScope == null ? null : String(attemptScope);
    if (s !== scope) reset(s);
    var opId = retryOpId || generateId();
    phase = "registering";
    var result;
    try {
      result = register(opId);
    } catch (error) {
      phase = "idle";
      retryOpId = opId;
      return { status: "failed", opId: opId, error: error };
    }
    if (result === false) {
      phase = "idle";
      retryOpId = opId;
      return { status: "failed", opId: opId };
    }
    retryOpId = null;
    lastOpId = opId;
    phase = "confirming";
    return { status: "logged", opId: opId, token: { gen: gen, opId: opId } };
  }

  function finishConfirmation(token) {
    if (!token || token.gen !== gen || token.opId !== lastOpId || phase !== "confirming") return false;
    // Nueva generacion: el token ya usado (o cualquiera anterior) no libera una confirmacion posterior.
    gen++;
    phase = "idle";
    return true;
  }

  function dispose() {
    gen++;
    phase = "idle";
    retryOpId = null;
    disposed = true;
  }

  function snapshot() {
    return { scope: scope, phase: phase, busy: phase !== "idle", retryOpId: retryOpId, lastOpId: lastOpId, gen: gen, disposed: disposed };
  }

  return { attempt: attempt, finishConfirmation: finishConfirmation, reset: reset, dispose: dispose, snapshot: snapshot };
}
