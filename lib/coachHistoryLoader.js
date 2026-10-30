// Historial COMPLETO de sesiones y progreso del roster del entrenador (E0: datos completos para Progreso y Estadisticas).
//
// Antes: sesiones con `limit=500` para todo el roster y progreso con 10 paginas como maximo; si se llegaba al tope, las estadisticas
// trabajaban en silencio con un historial truncado (lo mas antiguo se perdia primero). Ademas el refresco de 30 s volvia a pedir todo.
// Ahora:
//  - carga COMPLETA paginada (orden estable created_at, id) con bandera `complete`: false si una pagina falla o se alcanza el tope;
//  - refresco INCREMENTAL: solo filas con created_at >= (ultimo created_at visto - margen), fusionadas por `id` (sin duplicar);
//  - la carga completa se repite cada FULL_REFRESH_MS para reflejar bajas hechas desde otro dispositivo, y filas insertadas desde otro
//    dispositivo con un created_at retroactivo (p. ej. sesion huerfana validada con la hora del ultimo set), que el incremental no ve.
// Modulo puro, sin React ni Supabase: las paginas se piden con funciones inyectadas (ver App.jsx, cargarSesionesGlobales).

import { createdAtSortKey } from "./routineStore.js";

export const HISTORY_PAGE_SIZE = 1000;
export const HISTORY_MAX_PAGES = 50;
export const FULL_REFRESH_MS = 5 * 60 * 1000;
// Solape del refresco incremental: cubre relojes y filas confirmadas con el mismo created_at que el maximo visto.
export const DELTA_OVERLAP_MS = 2 * 60 * 1000;

/**
 * Pide paginas hasta recibir una incompleta.
 *  fetchPage(offset, size) -> Promise<Array|null>   (null / no-array / excepcion = pagina fallida)
 * Devuelve { rows, complete, pages, failedFirst }:
 *  - failedFirst: la PRIMERA pagina fallo (rows = null): quien llama puede reintentar con otra consulta;
 *  - complete: false si fallo una pagina posterior o se alcanzo maxPages sin una pagina incompleta (rows = lo recuperado).
 * Con idKey, una fila repetida entre paginas (insercion concurrente que corre el offset) se conserva una sola vez.
 */
export async function fetchPagesDetailed(fetchPage, options) {
  var o = options || {};
  var size = o.pageSize > 0 ? o.pageSize : HISTORY_PAGE_SIZE;
  var maxPages = o.maxPages > 0 ? o.maxPages : HISTORY_MAX_PAGES;
  var rows = [];
  var seen = {};
  for (var p = 0; p < maxPages; p++) {
    var page;
    try {
      page = await fetchPage(p * size, size);
    } catch (e) {
      page = null;
    }
    if (!Array.isArray(page)) {
      return p === 0
        ? { rows: null, complete: false, pages: 0, failedFirst: true, reason: "error" }
        : { rows: rows, complete: false, pages: p, failedFirst: false, reason: "error" };
    }
    for (var i = 0; i < page.length; i++) {
      var r = page[i];
      if (o.idKey && r && r[o.idKey] != null) {
        var k = String(r[o.idKey]);
        if (seen[k]) continue;
        seen[k] = true;
      }
      rows.push(r);
    }
    if (page.length < size) return { rows: rows, complete: true, pages: p + 1, failedFirst: false, reason: null };
  }
  return { rows: rows, complete: false, pages: maxPages, failedFirst: false, reason: "tope" };
}

/** Orden canonico: created_at descendente, desempate por id (desc). Puro: devuelve un arreglo nuevo. */
export function sortByCreatedAtDesc(rows) {
  return (Array.isArray(rows) ? rows : []).slice().sort(function (a, b) {
    var ka = createdAtSortKey(a && a.created_at);
    var kb = createdAtSortKey(b && b.created_at);
    if (ka !== kb) return kb > ka ? 1 : -1;
    var ia = String(a && a.id != null ? a.id : "");
    var ib = String(b && b.id != null ? b.id : "");
    return ib > ia ? 1 : ib < ia ? -1 : 0;
  });
}

/**
 * Fusiona filas nuevas (refresco incremental) en las existentes por `id`: una fila con el mismo id se REEMPLAZA (nunca se duplica);
 * filas sin id se agregan. Resultado ordenado por created_at desc.
 */
export function mergeRowsById(prevRows, newRows) {
  var byId = {};
  var sinId = [];
  (Array.isArray(prevRows) ? prevRows : []).forEach(function (r) {
    if (r && r.id != null) byId[String(r.id)] = r; else if (r) sinId.push(r);
  });
  (Array.isArray(newRows) ? newRows : []).forEach(function (r) {
    if (r && r.id != null) byId[String(r.id)] = r; else if (r) sinId.push(r);
  });
  return sortByCreatedAtDesc(Object.keys(byId).map(function (k) { return byId[k]; }).concat(sinId));
}

/** ISO del created_at maximo de las filas, o null. */
export function maxCreatedAtIso(rows) {
  var best = -Infinity;
  var bestRaw = null;
  (Array.isArray(rows) ? rows : []).forEach(function (r) {
    var k = createdAtSortKey(r && r.created_at);
    if (k > best) { best = k; bestRaw = r.created_at; }
  });
  if (bestRaw == null) return null;
  var ms = Math.floor(best / 1000);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Desde cuando pedir el incremental: maximo visto menos el solape. null => no hay base para incremental (hacer carga completa). */
export function deltaSinceIso(rows, overlapMs) {
  var max = maxCreatedAtIso(rows);
  if (!max) return null;
  return new Date(new Date(max).getTime() - (overlapMs != null ? overlapMs : DELTA_OVERLAP_MS)).toISOString();
}

/** Agrupa filas de progreso por alumno_id (forma de progresoGlobal). */
export function groupByAlumno(rows) {
  var out = {};
  (Array.isArray(rows) ? rows : []).forEach(function (r) {
    if (!r || r.alumno_id == null) return;
    var k = r.alumno_id;
    (out[k] = out[k] || []).push(r);
  });
  return out;
}

/** Aplana progresoGlobal ({ alumnoId: rows }) a un arreglo. */
export function flattenByAlumno(grouped) {
  var out = [];
  Object.keys(grouped || {}).forEach(function (k) { (grouped[k] || []).forEach(function (r) { out.push(r); }); });
  return out;
}

/**
 * ¿Toca carga completa?
 *  - nunca hubo una carga completa exitosa, o la ultima fallo (retryFull): si;
 *  - vencio el intervalo de carga completa (refleja bajas hechas desde otro dispositivo): si;
 *  - en otro caso, refresco incremental. Un historial incompleto por el TOPE de paginas no fuerza recargas completas en cada tick.
 */
export function needsFullLoad(state, nowMs) {
  var s = state || {};
  if (!s.lastFullAt || s.retryFull) return true;
  return nowMs - s.lastFullAt >= FULL_REFRESH_MS;
}

// Columnas de progreso que necesitan las estadisticas del entrenador. `id` y `created_at`: fusion del refresco incremental y orden estable.
export const PROGRESO_COLS = "id,alumno_id,ejercicio_id,kg,reps,fecha,semana,created_at";
export const PROGRESO_COLS_CICLO = PROGRESO_COLS + ",ciclo";

/**
 * Sincroniza el historial del roster. No escribe nada; devuelve el estado nuevo para aplicar.
 *  p.pageSesiones(sinceIso|null)        -> fetchPage(offset, size)
 *  p.pageProgreso(cols, sinceIso|null)  -> fetchPage(offset, size)
 *  p.prev = { sesiones, progreso, state }  (state: { lastFullAt, retryFull, complete: { sesiones, progreso }, cols, rosterKey })
 *  p.rosterKey: identifica el conjunto de alumnos; si cambia, carga completa.
 *  p.now (ms), p.forceFull, p.maxPages, p.pageSize
 * Resultado:
 *  { ok: true, mode: "full" | "delta", sesiones, progreso, state }
 *  { ok: false, mode, state }   => no aplicar filas (se conservan las anteriores); `state` dice si reintentar la carga completa.
 */
export async function syncCoachHistory(p) {
  var prev = p.prev || {};
  var st = prev.state || {};
  var now = p.now != null ? p.now : Date.now();
  var opts = { pageSize: p.pageSize, maxPages: p.maxPages, idKey: "id" };
  var hasPrev = Array.isArray(prev.sesiones) && Array.isArray(prev.progreso);
  var full = !!p.forceFull || !hasPrev || st.rosterKey !== p.rosterKey || needsFullLoad(st, now);

  if (!full) {
    var sinceS = deltaSinceIso(prev.sesiones);
    var sinceP = deltaSinceIso(prev.progreso);
    // sin filas previas no hay ancla para el incremental de esa tabla: se pide completa (es chica: vacia hasta ahora)
    var dS = await fetchPagesDetailed(p.pageSesiones(sinceS), opts);
    var dP = await fetchPagesDetailed(p.pageProgreso(st.cols || PROGRESO_COLS_CICLO, sinceP), opts);
    if (dS.reason === "error" || dP.reason === "error") {
      return { ok: false, mode: "delta", state: st }; // fallo transitorio: el proximo tick reintenta, nada se pisa
    }
    return {
      ok: true,
      mode: "delta",
      sesiones: mergeRowsById(prev.sesiones, dS.rows),
      progreso: mergeRowsById(prev.progreso, dP.rows),
      // un incremental que llega al tope es raro (rafaga enorme): se fuerza una carga completa en el proximo tick
      state: Object.assign({}, st, { retryFull: dS.reason === "tope" || dP.reason === "tope" }),
    };
  }

  var cols = PROGRESO_COLS_CICLO;
  var fS = await fetchPagesDetailed(p.pageSesiones(null), opts);
  var fP = await fetchPagesDetailed(p.pageProgreso(cols, null), opts);
  if (fP.failedFirst) {
    // `ciclo` separa los ciclos de una rutina reiniciada. Si la columna no existiera (400), se reintenta sin ella.
    cols = PROGRESO_COLS;
    fP = await fetchPagesDetailed(p.pageProgreso(cols, null), opts);
  }
  var failed = fS.reason === "error" || fP.reason === "error";
  if (failed && hasPrev && st.rosterKey === p.rosterKey) {
    // una carga completa fallida nunca reemplaza un historial previo del mismo roster por uno parcial
    return { ok: false, mode: "full", state: Object.assign({}, st, { retryFull: true }) };
  }
  if (fS.rows == null && fP.rows == null) {
    return { ok: false, mode: "full", state: Object.assign({}, st, { retryFull: true, rosterKey: st.rosterKey }) };
  }
  return {
    ok: true,
    mode: "full",
    sesiones: sortByCreatedAtDesc(fS.rows || (st.rosterKey === p.rosterKey ? prev.sesiones : []) || []),
    progreso: sortByCreatedAtDesc(fP.rows || (st.rosterKey === p.rosterKey ? prev.progreso : []) || []),
    state: {
      lastFullAt: failed ? null : now,
      retryFull: failed,
      complete: { sesiones: !!fS.complete, progreso: !!fP.complete },
      reason: { sesiones: fS.reason, progreso: fP.reason },
      cols: cols,
      rosterKey: p.rosterKey,
    },
  };
}
