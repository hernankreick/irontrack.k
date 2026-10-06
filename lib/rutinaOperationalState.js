// Estado OPERATIVO de una rutina dentro de rutinas.datos: lo escribe el flujo del alumno (avance de semana) o una accion
// explicita del entrenador (reinicio de semana). Los guardados normales del entrenador (days / alumno / note, orden de
// ejercicios, edicion de ejercicios...) NO deben borrarlo ni pisarlo con una copia local vieja.
//
// Antes, RutinaView / RoutineCard / App.jsx llamaban sb.updateRutina con datos = { days, alumno, note } (o con un spread de una
// copia local vieja) y el UPDATE reemplazaba la columna `datos` completa => semana_activa desaparecia (o retrocedia).
// `client` es el cliente supabase-js (inyectado para poder probarlo sin red).

import { isValidSemanaActiva } from "./updateRutinaSemanaActiva.js";

export { isValidSemanaActiva };
export const OPERATIONAL_DATOS_KEYS = ["semana_activa", "semana_reiniciada", "semana_reiniciada_at"];
export const INITIAL_SEMANA_ACTIVA = 1;

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/** semana_activa persistida como entero 1..4 (acepta "2" y 2); cualquier otra cosa (null, 0, 7, "x") => null. */
export function readSemanaActiva(datos) {
  var d = asObject(datos);
  if (!d || d.semana_activa == null || d.semana_activa === "") return null;
  var n = Number(d.semana_activa);
  return isValidSemanaActiva(n) ? n : null;
}

/**
 * Devuelve `incoming` con las claves operativas tomadas EXACTAMENTE de `fresh` (la fila real de la DB):
 * - si fresh las tiene, ganan sobre cualquier valor de la copia local (que puede estar vieja);
 * - si fresh no las tiene, tampoco se escriben desde la copia local (no se persiste estado no verificado).
 * No muta ninguno de los dos objetos.
 */
export function mergeOperationalDatos(fresh, incoming) {
  var inc = asObject(incoming) || {};
  var fr = asObject(fresh) || {};
  var out = {};
  Object.keys(inc).forEach(function (k) {
    if (OPERATIONAL_DATOS_KEYS.indexOf(k) === -1) out[k] = inc[k];
  });
  OPERATIONAL_DATOS_KEYS.forEach(function (k) {
    if (Object.prototype.hasOwnProperty.call(fr, k) && fr[k] !== undefined) out[k] = fr[k];
  });
  return out;
}

/**
 * Rutina asignada (alumno_id y no plantilla) sin semana_activa valida => se inicializa en 1. No toca plantillas ni valores validos.
 * Pura: devuelve un body nuevo.
 */
export function withInitialSemanaActiva(body) {
  var b = body || {};
  var assigned = b.es_plantilla !== true && b.alumno_id != null && b.alumno_id !== "";
  if (!assigned) return b;
  var datos = asObject(b.datos) || {};
  if (readSemanaActiva(datos) != null) return b;
  return Object.assign({}, b, { datos: Object.assign({}, datos, { semana_activa: INITIAL_SEMANA_ACTIVA }) });
}

/**
 * UPDATE de rutinas que preserva el estado operativo.
 *  body: ya pasado por cleanRutinaWriteBody.
 *  options.writeOperationalState === true: SOLO para acciones explicitas del entrenador (reinicio de semana / reinicio total), que
 *    escriben semana_activa / semana_reiniciada* a proposito; el body se escribe tal cual.
 * Sin esa opcion: lee `datos` FRESCO justo antes de escribir y fusiona (mergeOperationalDatos); si no puede leerlo, NO escribe
 * (devuelve null) para no pisar estado con una copia local vieja. Mismo contrato de retorno que sb.updateRutina:
 * array de filas actualizadas, [] si no hubo fila, null ante error.
 */
export async function updateRutinaPreservingOperational(client, id, body, options) {
  var opts = options || {};
  var toWrite = body || {};
  if (opts.writeOperationalState !== true) {
    var read = await client.from("rutinas").select("datos").eq("id", id);
    if (read.error || !Array.isArray(read.data)) {
      console.error("[rutinas SELECT datos ERROR] no se escribe sin verificar el estado fresco", read.error);
      return null;
    }
    var freshDatos = read.data.length > 0 && read.data[0] ? read.data[0].datos : null;
    if (read.data.length > 0) {
      toWrite = Object.assign({}, toWrite, { datos: mergeOperationalDatos(freshDatos, toWrite.datos) });
      toWrite = withInitialSemanaActiva(toWrite);
    }
  }
  var write = await client.from("rutinas").update(toWrite).eq("id", id).select();
  if (write.error) { console.error("[rutinas UPDATE ERROR]", write.error); return null; }
  return write.data || [];
}
