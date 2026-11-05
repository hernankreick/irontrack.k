// D7.5: historial COMPLETO de progreso de UN alumno (records, PRs del mes, graficos, historial por ejercicio).
//
// Antes: sb.getProgreso pedia `progreso?alumno_id=eq.X&order=created_at.desc` en UNA consulta. PostgREST corta en su tope de filas
// (1.000 por defecto en Supabase) sin avisar: a un alumno con mas series se le perdian las MAS ANTIGUAS, que es justo donde suelen
// estar los records viejos (un 85 kg reciente pasaba a ser «PR» contra un 100 kg de hace meses que ya no se veia).
// Ahora: paginas de HISTORY_PAGE_SIZE con orden estable (created_at desc, id desc), reutilizando fetchPagesDetailed del historial del
// entrenador (E0, lib/coachHistoryLoader.js): sin duplicados entre paginas (por id), con bandera `complete` (false si falla una pagina
// posterior o se alcanza el tope) para no presentar un historial parcial como definitivo.
// Ademas: cache corta por alumno (solo historiales completos) y una sola consulta en vuelo por alumno, para no repetir la carga cada
// vez que se abre Progreso. Modulo puro: la consulta se inyecta (fetchPath(path) -> Promise<array>), sin React ni Supabase.

import { fetchPagesDetailed, HISTORY_PAGE_SIZE, HISTORY_MAX_PAGES } from "./coachHistoryLoader.js";

export var ALUMNO_HISTORY_TTL_MS = 2 * 60 * 1000;

/** Ruta PostgREST de una pagina del progreso de un alumno (orden estable para que offset no saltee ni repita filas). */
export function progresoAlumnoPagePath(alumnoId, offset, size) {
  return "progreso?alumno_id=eq." + encodeURIComponent(String(alumnoId)) +
    "&select=*&order=created_at.desc,id.desc&limit=" + size + "&offset=" + offset;
}

/**
 * Carga todas las paginas del progreso del alumno.
 * Devuelve { rows, complete, pages, reason }:
 *  - rows null + reason "error": fallo la PRIMERA pagina (no hay nada que mostrar del servidor);
 *  - complete false + reason "error" | "tope": historial PARCIAL (lo mas antiguo puede faltar); rows = lo recuperado;
 *  - reason "sin_alumno": no hay alumno.
 */
export async function cargarHistorialProgreso(fetchPath, alumnoId, opts) {
  var o = opts || {};
  if (typeof fetchPath !== "function" || alumnoId == null || alumnoId === "") {
    return { rows: [], complete: false, pages: 0, reason: "sin_alumno" };
  }
  var r = await fetchPagesDetailed(function (offset, size) {
    return fetchPath(progresoAlumnoPagePath(alumnoId, offset, size));
  }, { pageSize: o.pageSize || HISTORY_PAGE_SIZE, maxPages: o.maxPages || HISTORY_MAX_PAGES, idKey: "id" });
  if (r.failedFirst) return { rows: null, complete: false, pages: 0, reason: "error" };
  return { rows: r.rows, complete: r.complete, pages: r.pages, reason: r.reason };
}

var cache = {};

function ahora(o) {
  return o && typeof o.now === "function" ? o.now() : Date.now();
}

/**
 * Historial del alumno con cache corta y una sola consulta en vuelo por alumno.
 *  opts.forzar: ignora la cache (no la consulta en vuelo). opts.ttlMs, opts.now (pruebas), opts.pageSize / maxPages.
 * Solo se cachean historiales COMPLETOS; un parcial o un error se vuelven a pedir la proxima vez.
 */
export function obtenerHistorialProgreso(fetchPath, alumnoId, opts) {
  var o = opts || {};
  var key = alumnoId == null ? "" : String(alumnoId);
  if (!key) return Promise.resolve({ rows: [], complete: false, pages: 0, reason: "sin_alumno" });
  var ttl = o.ttlMs != null ? o.ttlMs : ALUMNO_HISTORY_TTL_MS;
  var entry = cache[key];
  if (entry && entry.promise) return entry.promise;
  if (!o.forzar && entry && entry.result && ahora(o) - entry.at < ttl) return Promise.resolve(entry.result);
  var nuevo = { promise: null, result: null, at: 0 };
  cache[key] = nuevo;
  nuevo.promise = cargarHistorialProgreso(fetchPath, key, o).then(function (res) {
    if (cache[key] === nuevo) {
      nuevo.promise = null;
      if (res && res.complete) { nuevo.result = res; nuevo.at = ahora(o); } else delete cache[key];
    }
    return res;
  }, function (err) {
    if (cache[key] === nuevo) delete cache[key];
    throw err;
  });
  return nuevo.promise;
}

/** Descarta la cache de un alumno (o de todos, sin argumento): p. ej. al cerrar sesion. */
export function invalidarHistorialProgreso(alumnoId) {
  if (alumnoId == null) { cache = {}; return; }
  delete cache[String(alumnoId)];
}
