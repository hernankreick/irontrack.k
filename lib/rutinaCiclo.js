// Ciclo de rutina: cada reinicio "conservando historial" abre un ciclo nuevo.
//  - Ciclo VIGENTE: rutinas.datos.ciclo_actual (entero >= 1; ausente => 1).
//  - sesiones.ciclo / progreso.ciclo: ciclo en que se registro la fila (ausente/invalido => 1, asi las filas viejas son ciclo 1).
//  - datos.ciclo_cargas: "mantener" | "cero" (como se precargan los pesos en el ciclo vigente).
//  - datos.ciclo_reiniciado_at: ISO del ultimo reinicio.
// Modulo puro, sin React ni Supabase.

export const CICLO_CARGAS = { MANTENER: "mantener", CERO: "cero" };

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function toCiclo(value) {
  var n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Ciclo vigente de una rutina a partir de su `datos`. */
export function readCicloActual(datos) {
  var d = asObject(datos);
  return d ? toCiclo(d.ciclo_actual) : 1;
}

/** Ciclo de una fila de sesiones/progreso (sin columna o invalido => 1). */
export function rowCiclo(row) {
  return toCiclo(row && row.ciclo);
}

export function rowInCiclo(row, ciclo) {
  return rowCiclo(row) === toCiclo(ciclo);
}

/** Valor a enviar en el payload: solo cuando es > 1, asi el insert sigue valido si la columna aun no existe. */
export function cicloPayloadFields(ciclo) {
  var c = toCiclo(ciclo);
  return c > 1 ? { ciclo: c } : {};
}

export function readCicloCargas(datos) {
  var d = asObject(datos);
  return d && d.ciclo_cargas === CICLO_CARGAS.CERO ? CICLO_CARGAS.CERO : CICLO_CARGAS.MANTENER;
}

/**
 * `datos` resultante de reiniciar la rutina: puntero a Semana 1, ciclo + 1. NO toca days ni nada mas.
 * Pura: no muta `datos`.
 */
export function buildReinicioDatos(datos, options) {
  var o = options || {};
  var base = Object.assign({}, asObject(datos) || {});
  var next = Object.assign(base, {
    semana_activa: 1,
    ciclo_actual: readCicloActual(datos) + 1,
    ciclo_cargas: o.cargas === CICLO_CARGAS.CERO ? CICLO_CARGAS.CERO : CICLO_CARGAS.MANTENER,
    ciclo_reiniciado_at: o.nowIso || new Date().toISOString(),
  });
  delete next.semana_reiniciada;
  delete next.semana_reiniciada_at;
  return next;
}

function parseEsArDateMs(value) {
  var m = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  var t = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Series candidatas a precargar el peso. "mantener" (o ciclo 1): todas. "cero": solo las del ciclo vigente,
 * es decir registradas desde el reinicio (created_at >= reinicio, o fecha local >= dia del reinicio).
 */
export function setsForLoadPrefill(sets, datos) {
  var list = Array.isArray(sets) ? sets : [];
  var d = asObject(datos);
  if (!d || readCicloActual(d) <= 1 || readCicloCargas(d) !== CICLO_CARGAS.CERO) return list;
  var resetMs = new Date(d.ciclo_reiniciado_at).getTime();
  if (!Number.isFinite(resetMs)) return list;
  var resetDay = new Date(resetMs);
  resetDay.setHours(0, 0, 0, 0);
  return list.filter(function (s) {
    if (!s) return false;
    if (s.ciclo != null) return rowCiclo(s) >= readCicloActual(d);
    var created = s.created_at != null ? new Date(s.created_at).getTime() : NaN;
    if (Number.isFinite(created)) return created >= resetMs;
    var dayMs = parseEsArDateMs(s.date || s.fecha);
    return dayMs != null && dayMs >= resetDay.getTime();
  });
}
