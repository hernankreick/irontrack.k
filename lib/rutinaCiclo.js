// Ciclo de rutina: cada reinicio "conservando historial" abre un ciclo nuevo. Ningun reinicio borra sesiones ni progreso.
//  - Ciclo VIGENTE: rutinas.datos.ciclo_actual (entero >= 1; ausente => 1). Es el PERIODO de planificacion: solo las sesiones de
//    este ciclo completan dias / avanzan la semana.
//  - sesiones.ciclo / progreso.ciclo: ciclo en que se registro la fila (ausente/invalido => 1, asi las filas viejas son ciclo 1).
//  - datos.ciclo_cargas: "mantener" | "cero" (como se precargan los pesos en el bloque vigente).
//  - datos.ciclo_reiniciado_at: ISO del ultimo reinicio de RUTINA (inicio del bloque). Un reinicio de semana no lo cambia.
//  - datos.ciclo_base: primer ciclo del BLOQUE vigente (el ciclo que abrio el ultimo reinicio de rutina). Ausente => ciclo vigente
//    (hasta este cambio todo ciclo nacia de un reinicio de rutina, asi que cada ciclo viejo es su propio bloque).
//  - datos.ciclos_meta: [{ ciclo, tipo: "rutina"|"semana", semana_inicio, desde_ciclo, at }] (lo agrega cada reinicio).
//
// Bloque = ciclo_base..ciclo_actual. Un reinicio de SEMANA W abre el ciclo n+1 con semana_inicio = W dentro del MISMO bloque:
// las semanas < W del bloque siguen siendo las del ciclo anterior (estadisticas del bloque), y la semana W en adelante es la del
// ciclo nuevo. El intento anterior de la semana W queda en el historial, pero no cuenta en el bloque ni en la planificacion.
// Modulo puro, sin React ni Supabase. La misma semantica la aplican las RPC de la migracion (ver lib/rutinaRpc.js).

export const CICLO_CARGAS = { MANTENER: "mantener", CERO: "cero" };
export const TIPO_REINICIO = { RUTINA: "rutina", SEMANA: "semana" };

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function toCiclo(value) {
  var n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function toSemana(value) {
  var n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
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

/** Primer ciclo del bloque vigente (nunca mayor que el ciclo vigente). */
export function readCicloBase(datos) {
  var d = asObject(datos);
  var actual = readCicloActual(d);
  if (!d || d.ciclo_base == null || d.ciclo_base === "") return actual;
  var base = toCiclo(d.ciclo_base);
  return base <= actual ? base : actual;
}

/** Metadatos de los reinicios (solo entradas validas). */
export function readCiclosMeta(datos) {
  var d = asObject(datos);
  var list = d && Array.isArray(d.ciclos_meta) ? d.ciclos_meta : [];
  return list.filter(function (m) {
    return asObject(m) && Number.isInteger(Number(m.ciclo)) && Number(m.ciclo) >= 1;
  });
}

/** Semana en la que arranca un ciclo (1 si no hay metadato: los ciclos viejos nacieron de un reinicio de rutina). */
export function semanaInicioDeCiclo(datos, ciclo) {
  var c = toCiclo(ciclo);
  var meta = readCiclosMeta(datos).filter(function (m) { return Number(m.ciclo) === c; }).pop();
  return (meta && toSemana(meta.semana_inicio)) || 1;
}

/** Tipo del ultimo reinicio que abrio el ciclo vigente ("rutina" si no hay metadato). */
export function tipoReinicioVigente(datos) {
  var c = readCicloActual(datos);
  var meta = readCiclosMeta(datos).filter(function (m) { return Number(m.ciclo) === c; }).pop();
  return meta && meta.tipo === TIPO_REINICIO.SEMANA ? TIPO_REINICIO.SEMANA : TIPO_REINICIO.RUTINA;
}

/**
 * Ciclo que representa la semana `semana` (1..4) dentro del bloque vigente: el ultimo ciclo del bloque cuya semana de inicio es <= semana.
 * Sin semana valida => el ciclo vigente.
 */
export function cicloEfectivoDeSemana(datos, semana) {
  var actual = readCicloActual(datos);
  var w = toSemana(semana);
  if (w == null) return actual;
  var base = readCicloBase(datos);
  for (var c = actual; c > base; c--) {
    if (semanaInicioDeCiclo(datos, c) <= w) return c;
  }
  return base;
}

/**
 * ¿La fila (sesion o serie) pertenece al bloque VIGENTE como registro activo de su semana?
 *  semana: base 1 (sesiones.semana); para progreso.semana (base 0) sumar 1 antes de llamar.
 * Intentos anteriores (semana reiniciada) y bloques anteriores => false. Sin semana valida: solo cuenta si es del ciclo vigente.
 */
export function filaActivaEnBloque(datos, row, semana) {
  var c = rowCiclo(row);
  var w = toSemana(semana);
  if (w == null) return c === readCicloActual(datos);
  return c === cicloEfectivoDeSemana(datos, w);
}

/**
 * `datos` resultante de un reinicio (misma semantica que la RPC it_rutina_reiniciar). Pura: no muta `datos`.
 *  options.tipo: "rutina" (default; vuelve a Semana 1 y aplica `cargas`) | "semana" (queda en `semana`, conserva cargas y bloque).
 */
export function buildReinicioDatos(datos, options) {
  var o = options || {};
  var tipo = o.tipo === TIPO_REINICIO.SEMANA ? TIPO_REINICIO.SEMANA : TIPO_REINICIO.RUTINA;
  var prev = readCicloActual(datos);
  var next = prev + 1;
  var semana = tipo === TIPO_REINICIO.SEMANA ? (toSemana(o.semana) || 1) : 1;
  var nowIso = o.nowIso || new Date().toISOString();
  var base = Object.assign({}, asObject(datos) || {});
  delete base.semana_reiniciada;
  delete base.semana_reiniciada_at;
  var meta = readCiclosMeta(datos).concat([{ ciclo: next, tipo: tipo, semana_inicio: semana, desde_ciclo: prev, at: nowIso }]);
  var out = Object.assign(base, {
    ciclo_actual: next,
    semana_activa: semana,
    ciclo_base: tipo === TIPO_REINICIO.RUTINA ? next : readCicloBase(datos),
    ciclos_meta: meta,
  });
  if (tipo === TIPO_REINICIO.RUTINA) {
    out.ciclo_cargas = o.cargas === CICLO_CARGAS.CERO ? CICLO_CARGAS.CERO : CICLO_CARGAS.MANTENER;
    out.ciclo_reiniciado_at = nowIso;
  }
  return out;
}

function parseEsArDateMs(value) {
  var m = String(value || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  var t = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Series candidatas a precargar el peso. "mantener" (o sin reinicio de rutina): todas. "cero": solo las del BLOQUE vigente, es decir
 * registradas desde el ultimo reinicio de rutina (ciclo >= ciclo_base, created_at >= reinicio, o fecha local >= dia del reinicio).
 * Un reinicio de SEMANA no cambia el bloque: las cargas sugeridas se mantienen.
 */
export function setsForLoadPrefill(sets, datos) {
  var list = Array.isArray(sets) ? sets : [];
  var d = asObject(datos);
  if (!d || readCicloBase(d) <= 1 || readCicloCargas(d) !== CICLO_CARGAS.CERO) return list;
  var resetMs = new Date(d.ciclo_reiniciado_at).getTime();
  if (!Number.isFinite(resetMs)) return list;
  var resetDay = new Date(resetMs);
  resetDay.setHours(0, 0, 0, 0);
  return list.filter(function (s) {
    if (!s) return false;
    if (s.ciclo != null) return rowCiclo(s) >= readCicloBase(d);
    var created = s.created_at != null ? new Date(s.created_at).getTime() : NaN;
    if (Number.isFinite(created)) return created >= resetMs;
    var dayMs = parseEsArDateMs(s.date || s.fecha);
    return dayMs != null && dayMs >= resetDay.getTime();
  });
}
