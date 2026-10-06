// T01.2 — Avance de semana del alumno: actualiza SOLO rutinas.datos.semana_activa (y nunca la hace retroceder).
//
// No reescribe la fila (alumno_id / entrenador_id / nombre / es_plantilla quedan intactos): el
// UPDATE anterior pasaba por cleanRutinaWriteBody, que para la rutina local del alumno (sin
// entrenador_id) enviaba entrenador_id = NULL y la DB lo rechazaba (columna NOT NULL).
// Para no pisar `datos` con una copia local vieja, se lee `datos` fresco justo antes del PATCH.
// `client` es el cliente supabase-js (inyectado para poder probarlo sin red).

export function isValidSemanaActiva(value) {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}

/**
 * @returns {Promise<Array|null>} filas actualizadas (representation); [] si no se actualizo ninguna fila;
 *          null ante argumento invalido o error (se loguea).
 */
export async function updateRutinaSemanaActiva(client, rutinaId, nextWeek) {
  var id = rutinaId != null ? String(rutinaId) : "";
  if (!id || !isValidSemanaActiva(nextWeek)) return null;

  var read = await client.from("rutinas").select("datos").eq("id", id);
  if (read.error) { console.error("[rutinas SELECT datos ERROR]", read.error); return null; }
  var rows = read.data;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  var fresh = rows[0] && rows[0].datos;
  if (!fresh || typeof fresh !== "object" || Array.isArray(fresh)) return null;

  // Monotono: nunca retrocede. Si la DB ya esta en esa semana o mas adelante (p. ej. el cliente tenia una copia vieja) no se escribe y se
  // devuelve la fila leida como confirmacion de que la rutina ya esta ahi: la llamada es idempotente.
  var current = Number(fresh.semana_activa);
  if (isValidSemanaActiva(current) && current >= nextWeek) return [{ id: id, datos: fresh }];

  var datos = Object.assign({}, fresh, { semana_activa: nextWeek });
  var write = await client.from("rutinas").update({ datos: datos }).eq("id", id).select();
  if (write.error) { console.error("[rutinas UPDATE semana_activa ERROR]", write.error); return null; }
  return write.data || [];
}
