// Recuperacion paginada de filas (sin React ni Supabase). Una sola consulta con `limit` queda truncada por el tope de filas de
// PostgREST (en Supabase, 1000 por defecto) y descarta primero lo mas antiguo (la Semana 1 de la rutina).
//   fetchPage(offset, size) -> Promise<Array|null>   (null = error de la consulta)
// Devuelve null si falla la primera pagina (el llamador puede reintentar con otra forma de consulta); si falla una posterior,
// devuelve lo ya recuperado (nunca descarta datos buenos). Corta cuando una pagina viene incompleta o al llegar a maxPages.
export async function fetchAllPages(fetchPage, options) {
  var o = options || {};
  var size = o.pageSize > 0 ? o.pageSize : 1000;
  var maxPages = o.maxPages > 0 ? o.maxPages : 10;
  var rows = [];
  for (var p = 0; p < maxPages; p++) {
    var page = await fetchPage(p * size, size);
    if (!Array.isArray(page)) return p === 0 ? null : rows;
    rows = rows.concat(page);
    if (page.length < size) break;
  }
  return rows;
}
