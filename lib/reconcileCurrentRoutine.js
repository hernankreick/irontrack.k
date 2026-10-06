// Helper COMPARTIDO de reconciliacion de semana_activa: reconcilia SOLO la rutina VIGENTE de un alumno.
// Entradas legitimas (las dos usan este mismo helper, via sb.reconcileSemanaActivaAlumno):
//   A. alumno logueado carga su rutina (App.jsx, efecto de carga del alumno);
//   B. entrenador toca VER sobre un alumno (lib/studentFicha.js -> StudentsSection.onVer).
// Excluido a proposito: el enlace compartido / readOnly (solo lectura, sin escritura).
//
// Reglas: rutina vigente = selectCurrentRoutine (canonica); nunca rutinas historicas; las sesiones se leen COMPLETAS por rutina_id
// (reconcileSemanaActiva); sin progreso, sin nombre de rutina, sin created_at como frontera, sin localStorage.

import { selectCurrentRoutine } from "./routineStore.js";
import { reconcileSemanaActiva } from "./reconcileSemanaActiva.js";

/**
 * @param {object} p
 * @param {object} p.client             cliente supabase-js
 * @param {string} p.alumnoId
 * @param {Array}  p.rutinas            filas de `rutinas` YA cargadas del alumno (puede incluir historicas)
 * @param {Function} p.fetchSesionesPage  ({rutinaId, alumnoId, from, to}) => Promise<array> (lanza ante error)
 * @param {object} [p.logger]           por defecto console
 * @param {string} [p.source]           "alumno" | "entrenador_ver" (solo para el log)
 * @returns {Promise<{status, reason?, rutinaId, semanaActiva?, from?, to?}>}
 *   advanced -> semanaActiva = nuevo valor persistido; noop NO es error; incomplete / failed / invalid => console.warn y sin cambios locales.
 */
export async function reconcileCurrentRoutineForAlumno({ client, alumnoId, rutinas, fetchSesionesPage, logger, source }) {
  var log = logger || (typeof console !== "undefined" ? console : null);
  var aid = alumnoId != null && alumnoId !== "" ? String(alumnoId) : "";
  var result;
  var rutinaId = null;
  try {
    if (!aid) {
      result = { status: "invalid", reason: "alumno_invalido" };
    } else if (!Array.isArray(rutinas)) {
      result = { status: "invalid", reason: "rutinas_no_cargadas" };
    } else {
      var current = selectCurrentRoutine(rutinas, aid);
      if (!current || current.id == null) {
        result = { status: "noop", reason: "sin_rutina_vigente" };
      } else {
        rutinaId = String(current.id);
        result = await reconcileSemanaActiva({ client: client, rutinaId: rutinaId, alumnoId: aid, fetchSesionesPage: fetchSesionesPage });
      }
    }
  } catch (e) {
    result = { status: "failed", reason: "excepcion" };
  }
  var out = Object.assign({}, result, { rutinaId: rutinaId });
  if (out.status === "advanced") out.semanaActiva = out.to;
  if ((out.status === "incomplete" || out.status === "failed" || out.status === "invalid") && log && typeof log.warn === "function") {
    log.warn("[reconcileSemanaActiva]", { alumnoId: aid || null, rutinaId: rutinaId, status: out.status, reason: out.reason || null, source: source || null });
  }
  return out;
}
