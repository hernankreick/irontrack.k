// Enlaces compartidos (?r=): SOLO LECTURA.
//
// Un visitante que abre un enlace `?r=<base64>` no esta autenticado. Puede CONSULTAR la rutina y el historial que el
// enlace ya permite ver, pero NO puede escribir nada: ni iniciar o finalizar entrenamientos, ni registrar series, ni
// crear/modificar/borrar rutinas, sesiones, fotos o mensajes, ni marcar mensajes como leidos. Tampoco importa que haya
// una sesion de Supabase Auth de otra persona persistida en el navegador: en modo compartido ninguna escritura sale.
//
// Capas de defensa (todas del CLIENTE):
//   1. Interfaz: startStudentWorkout / logSet / finalizarSesion, chat de solo lectura, sin subida de fotos.
//   2. Funciones de escritura de la capa de datos `sb` (guardSharedWrites): lista explicita de TODAS las escrituras.
//   3. Transporte: sbFetch rechaza cualquier metodo que no sea GET/HEAD, y el cliente supabase-js usa un `fetch` que
//      rechaza escrituras a /rest/v1, /functions/v1 y /storage/v1 (createSharedReadOnlyFetch). /auth/v1 no se toca: el
//      refresco de token y el login siguen funcionando.
//
// IMPORTANTE: esto es una barrera del CLIENTE. No es seguridad del servidor ni reemplaza a la RLS: quien llame a la API
// directamente con la clave publica no pasa por este codigo. Eso se resuelve del lado del servidor (RLS), fuera de este
// alcance.

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

function warnBlocked(what) {
  try { console.warn("[shared-readonly] escritura bloqueada:", what); } catch (e) {}
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
      warnBlocked(name);
      return o.resolveNull ? Promise.resolve(null) : Promise.reject(new SharedReadOnlyError(name));
    }
    return fn.apply(this, arguments);
  };
}

/**
 * Escrituras de la capa de datos `sb` que quedan bloqueadas en modo compartido.
 *  - RESOLVE_NULL: las que hoy basan su error en sbFetch (devuelven null ante un fallo).
 *  - REJECT: las que hoy lanzan ante un fallo (cliente supabase-js o fetch directo).
 * Un test estructural verifica que TODA funcion de escritura de `sb` (add*, create*, update*, delete*, set*, save*,
 * marcar*, reconcile*) este en una de las dos listas, para que una escritura nueva no quede sin proteger.
 */
export var SHARED_BLOCKED_WRITES_RESOLVE_NULL = [
  "addProgreso", "addSesion", "addFoto", "deleteFoto",
  "addMensaje", "marcarMensajesLeidos",
  "updateAlumno", "saveConfig", "setNota", "setVideoOverride", "updateEntrenador",
];
export var SHARED_BLOCKED_WRITES_REJECT = [
  "updateRutinaSemanaActiva", "reconcileSemanaActivaAlumno",
  "deleteProgresoByAlumno", "deleteProgresoByAlumnoEjercicios", "deleteProgresoByAlumnoEjerciciosFechas",
  "deleteSesionesByAlumno", "deleteSesionesByAlumnoRutina", "deleteSesionesByAlumnoRutinaSemana",
  "createAlumno", "deleteAlumno",
  "createRutina", "updateRutina", "deleteRutina",
  "addCustomEx", "updateCustomEx", "deleteCustomEx", "setNameOverride",
];

/** Reemplaza en `api` (p. ej. el objeto `sb`) las escrituras por versiones protegidas. */
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

/** Transporte crudo (sbFetch): en modo compartido solo se permiten metodos de lectura. */
export function isWriteMethod(method) {
  var m = String(method || "GET").toUpperCase();
  return m !== "GET" && m !== "HEAD" && m !== "OPTIONS";
}

// Rutas de datos/funciones/almacenamiento de Supabase. /auth/v1 queda FUERA a proposito (login y refresco de token).
var BLOCKED_PATH_PREFIXES = ["/rest/v1/", "/functions/v1/", "/storage/v1/"];

/** true si la solicitud es una escritura a datos, funciones o almacenamiento (no a Auth). */
export function isBlockedSharedRequest(method, url) {
  if (!isWriteMethod(method)) return false;
  var path = "";
  try {
    path = new URL(String(url), "http://local.invalid").pathname;
  } catch (e) {
    return true; // URL ilegible con metodo de escritura: se bloquea (falla cerrado)
  }
  return BLOCKED_PATH_PREFIXES.some(function (p) { return path.indexOf(p) === 0 || path === p.slice(0, -1); });
}

/**
 * `fetch` para createClient (supabase-js: global.fetch). En modo compartido NO envia las escrituras a /rest/v1,
 * /functions/v1 ni /storage/v1: responde 403 sin tocar la red. Todo lo demas (lecturas y Auth) pasa sin cambios.
 *  - baseFetch: fetch real (por defecto globalThis.fetch, resuelto en cada llamada).
 *  - options.isReadOnly: () => boolean (por defecto isSharedReadOnlyMode()).
 */
export function createSharedReadOnlyFetch(baseFetch, options) {
  var o = options || {};
  var isRO = typeof o.isReadOnly === "function" ? o.isReadOnly : function () { return isSharedReadOnlyMode(); };
  return function sharedReadOnlyFetch(input, init) {
    var base = typeof baseFetch === "function" ? baseFetch : function () { return globalThis.fetch.apply(globalThis, arguments); };
    if (isRO()) {
      var method = (init && init.method) || (input && typeof input === "object" && input.method) || "GET";
      var url = typeof input === "string" ? input : (input && (input.url || (typeof input.toString === "function" ? input.toString() : ""))) || "";
      if (isBlockedSharedRequest(method, url)) {
        warnBlocked(String(method).toUpperCase() + " " + url);
        var body = JSON.stringify({ code: "shared_read_only", message: "Escritura bloqueada en un enlace compartido (solo lectura)" });
        return Promise.resolve(new Response(body, { status: 403, headers: { "Content-Type": "application/json", "X-IronTrack-Blocked": "shared-read-only" } }));
      }
    }
    return base.apply(this, arguments);
  };
}
