// Escrituras ATOMICAS de rutinas.datos (P0: los reinicios conservan el historial).
//
// Antes, los tres escritores de `datos` (reinicio, avance de semana, guardado del entrenador) hacian leer -> modificar -> UPDATE con `datos`
// completo: cualquiera podia pisar un cambio concurrente (p. ej. un alumno que terminaba una sesion vieja devolvia la semana sobre un ciclo
// recien reiniciado). Ahora cada escritura es UNA sentencia UPDATE condicional dentro de una funcion SQL (migracion P0, SECURITY INVOKER:
// mismas RLS y permisos que el UPDATE directo):
//   it_rutina_reiniciar(p_rutina_id, p_ciclo_esperado, p_tipo, p_semana, p_cargas)   -> abre ciclo n+1 solo si el ciclo vigente es n
//   it_rutina_avanzar_semana(p_rutina_id, p_ciclo_esperado, p_semana)                -> avanza solo en el ciclo esperado y hacia adelante
//   it_rutina_guardar_contenido(p_rutina_id, p_fila)                                 -> guarda columnas + claves NO operativas; las operativas
//                                                                                       se toman de la fila en el mismo UPDATE
// En PostgreSQL (READ COMMITTED) un UPDATE que encuentra la fila modificada por otra transaccion espera, re-evalua el WHERE sobre la version
// confirmada y, si la condicion ya no se cumple, actualiza 0 filas. Por eso un "0 filas" es un conflicto real, nunca una escritura parcial.
//
// Sin la migracion aplicada (funcion inexistente): el reinicio NO se ejecuta (migracion_pendiente); el avance y el guardado usan la ruta
// anterior (con chequeo de ciclo en el avance) para no romper la app. Ver isMissingFunctionError.
// Este modulo tambien expone espejos PUROS de la semantica SQL para las pruebas.

import { OPERATIONAL_DATOS_KEYS, readSemanaActiva } from "./rutinaOperationalState.js";
import { buildReinicioDatos, readCicloActual } from "./rutinaCiclo.js";

export { RPC, isMissingFunctionError, hasRpc, callRpc } from "./rpcClient.js";

// ---------------------------------------------------------------- espejos puros de la migracion (para pruebas)

/** it_rutina_reiniciar sobre una fila. null = 0 filas (no aplica). */
export function applyReinicioRow(row, args, nowIso) {
  var a = args || {};
  if (!row || row.es_plantilla === true || row.alumno_id == null || row.alumno_id === "") return null;
  if (readCicloActual(row.datos) !== a.p_ciclo_esperado) return null;
  return Object.assign({}, row, {
    datos: buildReinicioDatos(row.datos, { tipo: a.p_tipo, semana: a.p_semana, cargas: a.p_cargas, nowIso: nowIso }),
  });
}

/** it_rutina_avanzar_semana sobre una fila. null = 0 filas. */
export function applyAvanceRow(row, args) {
  var a = args || {};
  if (!row || readCicloActual(row.datos) !== a.p_ciclo_esperado) return null;
  var current = readSemanaActiva(row.datos);
  if (current != null && current >= a.p_semana) return null;
  return Object.assign({}, row, { datos: Object.assign({}, row.datos || {}, { semana_activa: a.p_semana }) });
}

/** Contenido entrante + claves operativas de la fila (gana la fila). Mismo contrato que mergeOperationalDatos. */
export function mergeContenidoDatos(rowDatos, incomingDatos) {
  var inc = incomingDatos && typeof incomingDatos === "object" && !Array.isArray(incomingDatos) ? incomingDatos : {};
  var fr = rowDatos && typeof rowDatos === "object" && !Array.isArray(rowDatos) ? rowDatos : {};
  var out = {};
  Object.keys(inc).forEach(function (k) { if (OPERATIONAL_DATOS_KEYS.indexOf(k) === -1) out[k] = inc[k]; });
  OPERATIONAL_DATOS_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(fr, k) && fr[k] !== undefined) out[k] = fr[k]; });
  return out;
}

/** it_rutina_guardar_contenido sobre una fila. */
export function applyContenidoRow(row, fila) {
  if (!row) return null;
  var f = fila || {};
  var next = Object.assign({}, row);
  ["nombre", "alumno_id", "entrenador_id", "es_plantilla"].forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(f, k)) next[k] = k === "es_plantilla" ? f[k] === true : f[k];
  });
  var datos = mergeContenidoDatos(row.datos, f.datos);
  var asignada = next.es_plantilla !== true && next.alumno_id != null && next.alumno_id !== "";
  if (asignada && readSemanaActiva(datos) == null) datos.semana_activa = 1;
  next.datos = datos;
  return next;
}
