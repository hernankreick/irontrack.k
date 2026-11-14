// Carga de datos y comparacion de "Prescrito vs. ejecutado" para UN alumno (orquesta lecturas + lib/prescritoEjecutadoResumen.js). Sin React ni Supabase:
// las lecturas se inyectan. Nunca lanza.
//   cargarPrescritoEjecutado({ alumnoId, requestStatus, fetchPath, pendientesLocales?, registroCompletoPosible? })
//   requestStatus(path) => Promise<{ok,status,data}> | fetchPath(path) => Promise<array|null> (como sbFetch)
// ESTADOS (campo `estado`): "ok" | "error" (una lectura fallo: se puede reintentar) | "sin_tabla" (la tabla de copias no existe o no es accesible: funcionalidad
// aun no habilitada en la base) | "sin_alumno".
// "registro completo" (para poder afirmar que un ejercicio se OMITIO) se demuestra solo si: el historial de series se leyo COMPLETO, el que mira es el propio
// alumno en su dispositivo (registroCompletoPosible) y no tiene series pendientes de sincronizar. Para el entrenador nunca se afirma.
import { leerSesionesAlumnoCompletas } from "./sesionesHistorial.js";
import { cargarHistorialProgreso } from "./alumnoHistoryLoader.js";
import { fetchPagesDetailed, HISTORY_PAGE_SIZE, HISTORY_MAX_PAGES } from "./coachHistoryLoader.js";
import { claveDeSesion, claveDeCopia } from "./prescripcionSnapshot.js";
import { compararSesionesDelAlumno } from "./prescritoEjecutadoResumen.js";

export function copiasAlumnoPagePath(alumnoId, offset, size) {
  return "prescripcion_copias?alumno_id=eq." + encodeURIComponent(String(alumnoId)) + "&select=*&order=created_at.asc,id.asc&limit=" + size + "&offset=" + offset;
}

function tablaAusente(res) {
  var code = res && res.data && typeof res.data === "object" ? String(res.data.code || "") : "";
  return !!res && !res.ok && (res.status === 404 || code === "PGRST205" || code === "42P01");
}

/** Copias del alumno leidas del SERVIDOR (cada fila marcada origen_lectura "servidor"). { ok, rows } | { ok:false, sin_tabla } */
export async function leerCopiasAlumno(requestStatus, alumnoId) {
  var ausente = false;
  var r = await fetchPagesDetailed(async function (offset, size) {
    var res;
    try { res = await requestStatus(copiasAlumnoPagePath(alumnoId, offset, size)); } catch (e) { return null; }
    if (tablaAusente(res)) { ausente = true; return null; }
    return res && res.ok && Array.isArray(res.data) ? res.data : null;
  }, { pageSize: HISTORY_PAGE_SIZE, maxPages: HISTORY_MAX_PAGES, idKey: "id" });
  if (ausente) return { ok: false, sin_tabla: true, rows: [] };
  if (!r.complete || !Array.isArray(r.rows)) return { ok: false, sin_tabla: false, rows: [] };
  return { ok: true, rows: r.rows.map(function (c) { return Object.assign({}, c, { origen_lectura: "servidor" }); }) };
}

/** Huella de lo mostrado al alumno al iniciar: la de la copia capturada en el inicio de ESA sesion (unica y sin ambiguedad), o "" si no se puede afirmar. */
export function huellaMostradaDeSesion(copias) {
  var porClave = {};
  (Array.isArray(copias) ? copias : []).forEach(function (c) {
    var k = claveDeCopia(c); var snap = c && c.snapshot;
    if (!k || !snap || !snap.captura || snap.captura.momento !== "inicio") return;
    (porClave[k.texto] = porClave[k.texto] || {})[c.prescripcion_hash] = true;
  });
  return function (sesion) {
    var k = claveDeSesion(sesion); if (!k) return "";
    var h = Object.keys(porClave[k.texto] || {});
    return h.length === 1 ? h[0] : "";
  };
}

export async function cargarPrescritoEjecutado(params) {
  var p = params || {};
  if (p.alumnoId == null || p.alumnoId === "") return { estado: "sin_alumno", resultado: null, cobertura: null };
  try {
    var lecturas = await Promise.all([
      leerSesionesAlumnoCompletas(p.requestStatus, p.alumnoId),
      cargarHistorialProgreso(p.fetchPath, p.alumnoId),
      leerCopiasAlumno(p.requestStatus, p.alumnoId),
    ]);
    var ses = lecturas[0], prog = lecturas[1], cop = lecturas[2];
    if (cop.sin_tabla) return { estado: "sin_tabla", resultado: null, cobertura: null };
    if (!ses.ok) return { estado: "error", motivo: "sesiones", resultado: null, cobertura: null };
    if (!prog.rows) return { estado: "error", motivo: "series", resultado: null, cobertura: null };
    if (!cop.ok) return { estado: "error", motivo: "copias", resultado: null, cobertura: null };
    var pendientes = typeof p.pendientesLocales === "function" ? Number(p.pendientesLocales()) : null;
    var completo = prog.complete === true && p.registroCompletoPosible === true && pendientes === 0;
    var resultado = compararSesionesDelAlumno({
      sesiones: ses.data, copias: cop.rows, series: prog.rows,
      contexto: { registroSeriesCompleto: completo, planificacionMostradaHash: huellaMostradaDeSesion(cop.rows) },
    });
    return { estado: "ok", resultado: resultado, cobertura: { historial_completo: prog.complete === true, pendientes_locales: pendientes, registro_completo: completo } };
  } catch (e) {
    return { estado: "error", motivo: "excepcion", resultado: null, cobertura: null };
  }
}
