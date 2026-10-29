// Reinicio de rutina o de semana CONSERVANDO el historial: abre un ciclo nuevo. NUNCA borra ni modifica sesiones ni progreso.
//  - tipo "rutina": ciclo + 1, Semana 1 / Dia 1, cargas "mantener" | "cero".
//  - tipo "semana": ciclo + 1, queda en la semana `semana` (Dia 1), mismas cargas y mismo bloque (ver lib/rutinaCiclo.js).
// Las sesiones del ciclo anterior quedan en el historial y no completan dias del ciclo nuevo (todos los consumidores filtran por ciclo).
// La escritura es UNA sentencia atomica (RPC it_rutina_reiniciar, migracion P0) condicionada al ciclo esperado: dos reinicios simultaneos o
// un doble clic abren un solo ciclo; el segundo recibe `conflicto_ciclo`. Sin la migracion NO se reinicia (migracion_pendiente).
// `client` es el cliente supabase-js (inyectado para poder probarlo sin red). Revisa `error` en cada llamada.
//
// Devuelve { ok: true, datos, rutina } o { ok: false, reason, error?, datos? } con reason:
//   argumentos_invalidos | migracion_pendiente | lectura_rutina | rutina_inexistente | no_asignada | alumno_distinto | conflicto_ciclo |
//   escritura | sin_filas

import { readCicloActual, CICLO_CARGAS, TIPO_REINICIO } from "./rutinaCiclo.js";
import { RPC, callRpc } from "./rpcClient.js";

function fail(reason, error, extra) {
  return Object.assign({ ok: false, reason: reason, error: error || null }, extra || {});
}

export async function reiniciarRutinaCiclo({ client, rutinaId, alumnoId, cargas, tipo, semana, cicloEsperado }) {
  var id = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
  if (!client || !id) return fail("argumentos_invalidos");
  var t = tipo === TIPO_REINICIO.SEMANA ? TIPO_REINICIO.SEMANA : TIPO_REINICIO.RUTINA;
  var w = t === TIPO_REINICIO.SEMANA ? Number(semana) : 1;
  if (!Number.isInteger(w) || w < 1 || w > 4) return fail("argumentos_invalidos");

  // La columna `ciclo` debe existir antes de abrir un ciclo 2: si no, los inserts del alumno con ciclo > 1 fallarian.
  var tablas = ["sesiones", "progreso"];
  for (var i = 0; i < tablas.length; i++) {
    var probe = await client.from(tablas[i]).select("ciclo").limit(1);
    if (probe.error) {
      console.error("[reiniciarRutinaCiclo] falta la columna ciclo en " + tablas[i] + " (correr sql/ciclo_rutina.sql)", probe.error);
      return fail("migracion_pendiente", probe.error);
    }
  }

  var read = await client.from("rutinas").select("id,alumno_id,es_plantilla,datos").eq("id", id);
  if (read.error || !Array.isArray(read.data)) {
    console.error("[reiniciarRutinaCiclo] lectura de la rutina", read.error);
    return fail("lectura_rutina", read.error);
  }
  if (read.data.length === 0) return fail("rutina_inexistente");
  var row = read.data[0] || {};
  if (row.es_plantilla === true || row.alumno_id == null || row.alumno_id === "") return fail("no_asignada");
  if (alumnoId != null && alumnoId !== "" && String(row.alumno_id) !== String(alumnoId)) return fail("alumno_distinto");

  // Ciclo esperado = el que vio quien pidio el reinicio (si lo informa). Si la rutina ya cambio de ciclo (otro dispositivo), no se reinicia.
  var esperado = Number.isInteger(cicloEsperado) && cicloEsperado >= 1 ? cicloEsperado : readCicloActual(row.datos);
  if (readCicloActual(row.datos) !== esperado) return fail("conflicto_ciclo", null, { datos: row.datos });

  var rpc = await callRpc(client, RPC.REINICIAR, {
    p_rutina_id: id,
    p_ciclo_esperado: esperado,
    p_tipo: t,
    p_semana: w,
    p_cargas: cargas === CICLO_CARGAS.CERO ? CICLO_CARGAS.CERO : CICLO_CARGAS.MANTENER,
  });
  if (rpc.missing) {
    console.error("[reiniciarRutinaCiclo] falta la migracion P0 (funcion " + RPC.REINICIAR + "): no se reinicia");
    return fail("migracion_pendiente");
  }
  if (rpc.error) {
    console.error("[reiniciarRutinaCiclo] escritura", rpc.error);
    return fail("escritura", rpc.error);
  }
  if (rpc.data.length === 0) {
    // 0 filas: otro proceso cambio el ciclo entre la lectura y el UPDATE (conflicto real) o RLS no permitio la fila.
    var again = await client.from("rutinas").select("id,alumno_id,es_plantilla,datos").eq("id", id);
    var d = !again.error && Array.isArray(again.data) && again.data[0] ? again.data[0].datos : null;
    if (d && readCicloActual(d) !== esperado) return fail("conflicto_ciclo", null, { datos: d });
    return fail("sin_filas");
  }
  return { ok: true, datos: rpc.data[0].datos, rutina: rpc.data[0] };
}
