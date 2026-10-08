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

/**
 * Dueño único del estado `alumnos` (lista + estado de carga).
 *
 * Invalidación de respuestas (una respuesta solo se aplica si nada cambió desde que se pidió):
 *  - reset():  cierre de sesion / cambio de usuario o rol -> la respuesta tardia se descarta.
 *  - seq:      otra carga empezo despues -> la respuesta vieja se descarta (gana la mas reciente).
 *  - version:  una escritura local (alta/baja/edicion via mutate) ocurrio durante la consulta -> la
 *              respuesta se descarta y se vuelve a consultar, para no pisar el estado local ni perder datos.
 *
 * fetchRows debe lanzar ante error HTTP/red. Un error NUNCA vacia la lista ya cargada.
 */
export function createAlumnosController(opts) {
  var fetchRows = opts.fetchRows;
  var clean = opts.clean;
  var onChange = typeof opts.onChange === "function" ? opts.onChange : function () {};
  var seq = 0;
  var epoch = 0;
  var version = 0;
  var activeSeq = null; // seq de la carga vigente en vuelo (null si no hay)
  var state = { alumnos: [], status: ALUMNOS_STATUS.IDLE };

  function publish(patch) {
    state = { alumnos: "alumnos" in patch ? patch.alumnos : state.alumnos, status: "status" in patch ? patch.status : state.status };
    onChange(state);
  }

  async function load() {
    var ticket = { seq: ++seq, epoch: epoch, version: version };
    activeSeq = ticket.seq;
    publish({ status: ALUMNOS_STATUS.LOADING });
    var rows;
    var failure = null;
    try {
      rows = await fetchRows(COACH_ALUMNOS_QUERY_ID);
      if (!Array.isArray(rows)) failure = new Error("Respuesta de alumnos invalida");
    } catch (e) {
      failure = e;
    }
    if (ticket.epoch !== epoch) return null; // sesion/usuario cambio: no tocar nada
    if (ticket.seq !== seq) return null; // otra carga mas reciente es la vigente
    activeSeq = null;
    if (ticket.version !== version) return load(); // escritura local en vuelo: reconsultar, no pisar
    if (failure) {
      publish({ status: ALUMNOS_STATUS.ERROR }); // conserva state.alumnos
      return null;
    }
    publish({ alumnos: clean(rows, COACH_ALUMNOS_QUERY_ID), status: ALUMNOS_STATUS.READY });
    return state.alumnos;
  }

  return {
    /** Carga (o recarga) y supera cualquier carga en vuelo. Devuelve la lista limpia o null. */
    load: load,
    /** Refresco periodico / reintento: no abre una consulta si ya hay una en vuelo. */
    refresh: function () {
      if (activeSeq !== null) return Promise.resolve(null);
      return load();
    },
    /** Escritura local (misma firma que setState: valor o funcion). Invalida consultas en vuelo. */
    mutate: function (next) {
      version++;
      publish({ alumnos: typeof next === "function" ? next(state.alumnos) : next });
    },
    /** Cierre de sesion / cambio de usuario o rol: invalida todo y vuelve a vacio+idle. */
    reset: function () {
      epoch++;
      version++;
      activeSeq = null;
      publish({ alumnos: [], status: ALUMNOS_STATUS.IDLE });
    },
    getState: function () { return state; },
  };
}

/** Clave estable del conjunto de alumnos (ids ordenados): cambia solo si altas/bajas, no por ediciones. */
export function alumnosIdsKey(list) {
  return (Array.isArray(list) ? list : [])
    .map(function (a) { return String(a && a.id); })
    .sort()
    .join(",");
}

/** Que mostrar cuando no hay filas: carga pendiente, error inicial o vacio real. */
export function alumnosEmptyKind(status, count) {
  if (count > 0) return "list";
  if (status === ALUMNOS_STATUS.ERROR) return "error";
  if (status === ALUMNOS_STATUS.IDLE || status === ALUMNOS_STATUS.LOADING) return "loading";
  return "empty";
}

/** Fallo de actualizacion con datos ya visibles: se muestra un aviso discreto, sin ocultar la lista. */
export function alumnosRefreshFailed(status, count) {
  return status === ALUMNOS_STATUS.ERROR && count > 0;
}
