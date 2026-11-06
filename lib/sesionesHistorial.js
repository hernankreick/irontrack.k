// D7.6 — Lectura COMPLETA (paginada) de las sesiones de UN alumno.
//
// Problema: sb.getSesiones y sb.getSesionesDetallado pedian `sesiones?alumno_id=eq.X&order=created_at.desc&limit=10`. Con mas de 10
// sesiones, la vista del alumno quedaba incompleta: «Sesiones completadas» nunca pasaba de 10, el logro «Constancia» (20 sesiones) era
// inalcanzable, la racha se cortaba en 10 dias y el historial por semanas (Progreso > Sesiones) perdia las semanas viejas o mostraba
// una semana partida como incompleta. Tambien la comprobacion de duplicados al finalizar miraba solo esas 10 filas.
//
// Ahora: paginas de HISTORY_PAGE_SIZE con orden estable (created_at desc, id desc) reutilizando fetchPagesDetailed (sin duplicados
// entre paginas, por id). Reglas:
//  - solo un historial COMPLETO es una lectura exitosa: si falla cualquier pagina (o se llega al tope de paginas) la lectura FALLA
//    entera; nunca se entrega un historial parcial como si fuera todo (D76-02: un fallo no se aplica como "menos sesiones");
//  - solo filas del alumno pedido (defensa ante mezclas entre alumnos, ademas del filtro de la consulta y del controlador);
//  - el contrato de cada funcion es el mismo de antes: { ok, status, data } (getSesionesDetallado) o array | null (getSesiones).
// Modulo puro: la consulta se inyecta (requestStatus(path) -> Promise<{ ok, status, data }>), sin React ni Supabase.

import { fetchPagesDetailed, HISTORY_PAGE_SIZE, HISTORY_MAX_PAGES } from "./coachHistoryLoader.js";

/** Ruta PostgREST de una pagina de las sesiones de un alumno (orden estable para que offset no saltee ni repita filas). */
export function sesionesAlumnoPagePath(alumnoId, offset, size) {
  return "sesiones?alumno_id=eq." + encodeURIComponent(String(alumnoId)) +
    "&select=*&order=created_at.desc,id.desc&limit=" + size + "&offset=" + offset;
}

/**
 * Lee TODAS las sesiones del alumno. Nunca lanza. Devuelve { ok, status, data, pages, reason }:
 *  - ok true: data = todas las filas del alumno (created_at desc), sin duplicados;
 *  - ok false: data null; reason "http" | "invalid" | "red" | "tope" | "sin_alumno"; status = el de la pagina que fallo (0 si no hubo).
 */
export async function leerSesionesAlumnoCompletas(requestStatus, alumnoId, opts) {
  var o = opts || {};
  if (typeof requestStatus !== "function" || alumnoId == null || alumnoId === "") {
    return { ok: false, status: 0, data: null, pages: 0, reason: "sin_alumno" };
  }
  var aid = String(alumnoId);
  var fallo = null;
  var ultimoStatus = 0;
  var r = await fetchPagesDetailed(async function (offset, size) {
    var res;
    try {
      res = await requestStatus(sesionesAlumnoPagePath(aid, offset, size));
    } catch (e) {
      fallo = { reason: "red", status: 0 };
      return null;
    }
    if (!res || typeof res !== "object") { fallo = { reason: "invalid", status: 0 }; return null; }
    ultimoStatus = res.status;
    if (!res.ok) { fallo = { reason: "http", status: res.status }; return null; }
    if (!Array.isArray(res.data)) { fallo = { reason: "invalid", status: res.status }; return null; }
    return res.data;
  }, { pageSize: o.pageSize || HISTORY_PAGE_SIZE, maxPages: o.maxPages || HISTORY_MAX_PAGES, idKey: "id" });
  if (!r.complete || !Array.isArray(r.rows)) {
    var f = fallo || { reason: r.reason || "invalid", status: ultimoStatus };
    return { ok: false, status: f.status, data: null, pages: r.pages, reason: f.reason };
  }
  var rows = r.rows.filter(function (row) { return row && String(row.alumno_id) === aid; });
  return { ok: true, status: ultimoStatus, data: rows, pages: r.pages, reason: null };
}

/**
 * Contrato de sb.getSesiones: array con TODAS las sesiones, o null si no se pudo leer completo (como sbFetch ante HTTP no-ok).
 * Ante un error de red lanza (como sbFetch), para que los llamadores que ya distinguen ese caso (ficha: «reintentar») no cambien.
 */
export async function getSesionesCompletas(requestStatus, alumnoId, opts) {
  var res = await leerSesionesAlumnoCompletas(requestStatus, alumnoId, opts);
  if (res.ok) return res.data;
  if (res.reason === "red") throw new Error("sesiones: error de red");
  return null;
}
