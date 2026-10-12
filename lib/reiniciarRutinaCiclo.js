// Reinicio de rutina CONSERVANDO el historial: abre un ciclo nuevo y vuelve el puntero a Semana 1, Dia 1.
// NO borra sesiones ni progreso. Solo escribe rutinas.datos (ciclo_actual, ciclo_cargas, ciclo_reiniciado_at, semana_activa).
// `client` es el cliente supabase-js (inyectado para poder probarlo sin red). Revisa `error` en cada llamada.
//
// Devuelve { ok: true, datos, rutina } o { ok: false, reason, error? } con reason:
//   argumentos_invalidos | migracion_pendiente | lectura_rutina | rutina_inexistente | no_asignada | alumno_distinto | escritura | sin_filas

import { buildReinicioDatos } from "./rutinaCiclo.js";

function fail(reason, error) {
  return { ok: false, reason: reason, error: error || null };
}

export async function reiniciarRutinaCiclo({ client, rutinaId, alumnoId, cargas, nowIso }) {
  var id = rutinaId != null && rutinaId !== "" ? String(rutinaId) : "";
  if (!client || !id) return fail("argumentos_invalidos");

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

  var datos = buildReinicioDatos(row.datos, { cargas: cargas, nowIso: nowIso });
  var write = await client.from("rutinas").update({ datos: datos }).eq("id", id).select();
  if (write.error) {
    console.error("[reiniciarRutinaCiclo] escritura", write.error);
    return fail("escritura", write.error);
  }
  // RLS puede dejar el UPDATE en 0 filas sin error: no se da por hecho.
  if (!Array.isArray(write.data) || write.data.length === 0) return fail("sin_filas");
  return { ok: true, datos: write.data[0].datos || datos, rutina: write.data[0] };
}
