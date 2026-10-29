// T01.2 — Avance de semana del alumno: actualiza SOLO rutinas.datos.semana_activa (y nunca la hace retroceder).
//
// No reescribe la fila (alumno_id / entrenador_id / nombre / es_plantilla quedan intactos): el
// UPDATE anterior pasaba por cleanRutinaWriteBody, que para la rutina local del alumno (sin
// entrenador_id) enviaba entrenador_id = NULL y la DB lo rechazaba (columna NOT NULL).
// Con la migracion P0 el avance es UN UPDATE condicional (it_rutina_avanzar_semana): solo en el ciclo esperado y solo hacia adelante.
// Sin la migracion (funcion inexistente) se usa la ruta anterior: lee `datos` fresco justo antes del PATCH (y compara el ciclo).
// `client` es el cliente supabase-js (inyectado para poder probarlo sin red).

import { RPC, callRpc } from "./rpcClient.js";

export function isValidSemanaActiva(value) {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}

export const CICLO_CAMBIADO = "ciclo_cambiado";

/** Resultado de updateRutinaSemanaActiva cuando la rutina ya esta en OTRO ciclo (fue reiniciada): no se escribio nada. */
export function isCicloCambiado(result) {
  return !!result && !Array.isArray(result) && typeof result === "object" && result.status === CICLO_CAMBIADO;
}

function cicloDe(datos) {
  var n = Number(datos && datos.ciclo_actual);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/**
 * @param {number} [expectedCiclo] ciclo en el que se calculo el avance (sesion del alumno / reconciliacion). Si se informa, el avance
 *        solo se aplica si la rutina SIGUE en ese ciclo: una sesion abierta antes de un reinicio nunca avanza el ciclo nuevo.
 * @returns {Promise<Array|null|{status:"ciclo_cambiado", datos}>} filas actualizadas (representation); [] si no se actualizo ninguna
 *          fila; null ante argumento invalido o error (se loguea); { status: "ciclo_cambiado" } si la rutina esta en otro ciclo.
 */
export async function updateRutinaSemanaActiva(client, rutinaId, nextWeek, expectedCiclo) {
  var id = rutinaId != null ? String(rutinaId) : "";
  if (!id || !isValidSemanaActiva(nextWeek)) return null;
  var hasExpected = Number.isInteger(expectedCiclo) && expectedCiclo >= 1;

  if (hasExpected) {
    // Migracion P0: UN UPDATE condicional (ciclo esperado + solo hacia adelante). 0 filas => se lee la fila para informar por que.
    var rpc = await callRpc(client, RPC.AVANZAR_SEMANA, { p_rutina_id: id, p_ciclo_esperado: expectedCiclo, p_semana: nextWeek });
    if (!rpc.missing) {
      if (rpc.error) { console.error("[rutinas avanzar_semana ERROR]", rpc.error); return null; }
      if (rpc.data.length > 0) return rpc.data;
      var check = await client.from("rutinas").select("datos").eq("id", id);
      if (check.error || !Array.isArray(check.data)) return null;
      if (check.data.length === 0) return [];
      var d = check.data[0] && check.data[0].datos;
      if (cicloDe(d) !== expectedCiclo) return { status: CICLO_CAMBIADO, datos: d };
      // mismo ciclo y ya en esa semana o mas adelante: idempotente, igual que la ruta anterior. Si no (p. ej. RLS dejo 0 filas): no confirmado.
      var actual = Number(d && d.semana_activa);
      return isValidSemanaActiva(actual) && actual >= nextWeek ? [{ id: id, datos: d }] : [];
    }
  }

  var read = await client.from("rutinas").select("datos").eq("id", id);
  if (read.error) { console.error("[rutinas SELECT datos ERROR]", read.error); return null; }
  var rows = read.data;
  if (!Array.isArray(rows) || rows.length === 0) return [];
  var fresh = rows[0] && rows[0].datos;
  if (!fresh || typeof fresh !== "object" || Array.isArray(fresh)) return null;
  if (hasExpected && cicloDe(fresh) !== expectedCiclo) return { status: CICLO_CAMBIADO, datos: fresh };

  // Monotono: nunca retrocede. Si la DB ya esta en esa semana o mas adelante (p. ej. el cliente tenia una copia vieja) no se escribe y se
  // devuelve la fila leida como confirmacion de que la rutina ya esta ahi: la llamada es idempotente.
  var current = Number(fresh.semana_activa);
  if (isValidSemanaActiva(current) && current >= nextWeek) return [{ id: id, datos: fresh }];

  var datos = Object.assign({}, fresh, { semana_activa: nextWeek });
  var write = await client.from("rutinas").update({ datos: datos }).eq("id", id).select();
  if (write.error) { console.error("[rutinas UPDATE semana_activa ERROR]", write.error); return null; }
  return write.data || [];
}
