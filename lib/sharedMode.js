// Enlaces compartidos (?r=): SOLO LECTURA.
//
// Un visitante que abre un enlace `?r=<base64>` no esta autenticado. Puede CONSULTAR la rutina y el historial que el
// enlace ya permite ver, pero NO puede iniciar un entrenamiento, registrar series, modificar el progreso ni finalizar
// sesiones. La defensa se aplica en la interfaz (startStudentWorkout, logSet, finalizarSesion) y tambien en la capa de
// datos (guardSharedWrites sobre `sb`), de modo que una escritura no salga aunque otro camino de la UI la intente.
//
// Es una barrera del CLIENTE: no sustituye a la RLS. Mientras la RLS permita escrituras con la clave publica, quien
// llame a la API directamente no pasa por aqui (eso se resuelve del lado del servidor, fuera de este alcance).

export class SharedReadOnlyError extends Error {
  constructor(operation) {
    super("shared_read_only: escritura bloqueada en un enlace compartido (" + operation + ")");
    this.name = "SharedReadOnlyError";
    this.code = "shared_read_only";
    this.operation = operation;
  }
}

/** Mismo criterio que App.jsx: hay modo compartido si el parametro `r` existe y no esta vacio. */
export function isSharedReadOnlyMode(search) {
  var s = search;
  if (s === undefined) {
    try {
      s = typeof window !== "undefined" && window.location ? window.location.search : "";
    } catch (e) {
      s = "";
    }
  }
  try {
    return !!new URLSearchParams(s || "").get("r");
  } catch (e) {
    return false;
  }
}

/**
 * Envuelve una funcion de escritura: en modo compartido NO la ejecuta.
 *  - options.resolveNull: devuelve Promise<null> (igual que sbFetch ante un error) en vez de rechazar.
 *  - options.isReadOnly: () => boolean (por defecto isSharedReadOnlyMode()).
 */
export function guardedWrite(name, fn, options) {
  var o = options || {};
  var isRO = typeof o.isReadOnly === "function" ? o.isReadOnly : function () { return isSharedReadOnlyMode(); };
  return function guardedSharedWrite() {
    if (isRO()) {
      try { console.warn("[shared-readonly] escritura bloqueada:", name); } catch (e) {}
      return o.resolveNull ? Promise.resolve(null) : Promise.reject(new SharedReadOnlyError(name));
    }
    return fn.apply(this, arguments);
  };
}

/** Escrituras de entrenamiento de la capa de datos `sb` que quedan bloqueadas en modo compartido. */
// addFoto/deleteFoto: las fotos de progreso son parte del progreso del alumno. El chat NO se bloquea en esta etapa (no es
// entrenamiento); queda documentado como riesgo pendiente.
export var SHARED_BLOCKED_WRITES_RESOLVE_NULL = ["addProgreso", "addSesion", "addFoto", "deleteFoto"];
export var SHARED_BLOCKED_WRITES_REJECT = [
  "updateRutinaSemanaActiva",
  "deleteProgresoByAlumno",
  "deleteProgresoByAlumnoEjercicios",
  "deleteProgresoByAlumnoEjerciciosFechas",
  "deleteSesionesByAlumno",
  "deleteSesionesByAlumnoRutina",
  "deleteSesionesByAlumnoRutinaSemana",
];

/** Reemplaza en `api` (p. ej. el objeto `sb`) las escrituras de entrenamiento por versiones protegidas. */
export function guardSharedWrites(api, options) {
  var o = options || {};
  SHARED_BLOCKED_WRITES_RESOLVE_NULL.forEach(function (name) {
    if (typeof api[name] === "function") api[name] = guardedWrite(name, api[name], { resolveNull: true, isReadOnly: o.isReadOnly });
  });
  SHARED_BLOCKED_WRITES_REJECT.forEach(function (name) {
    if (typeof api[name] === "function") api[name] = guardedWrite(name, api[name], { isReadOnly: o.isReadOnly });
  });
  return api;
}
