// Carga de la ficha de un alumno cuando el ENTRENADOR toca VER (extraido de StudentsSection.onVer para poder probar el flujo real).
// Mantiene el orden y los efectos originales (rutinas -> progreso -> sesiones) y agrega, justo despues de cargar las rutinas del alumno
// abierto, la reconciliacion de semana_activa SOLO de ese alumno (no de la lista) a traves del helper compartido.

import { getRutinaAlumnoId, mergeRutinasAsignadas as mergeRutinasAsignadasDefault } from "./routineStore.js";
import { applySemanaActivaToRutinas } from "./rutinaOperationalState.js";

/**
 * @param {object} p
 * @param {object} p.alumno                       el alumno al que se le toco VER
 * @param {object} p.sb                           capa de datos (getRutinas, getProgreso, getSesiones, reconcileSemanaActivaAlumno)
 * @param {Function} [p.mergeRutinasAsignadas]
 * @param {Function} p.setRutinasSB, p.setRutinasSBEntrenador, p.setAlumnoProgreso, p.setAlumnoSesiones   setters de estado (React)
 */
export async function loadAlumnoFicha({ alumno, sb, mergeRutinasAsignadas, setRutinasSB, setRutinasSBEntrenador, setAlumnoProgreso, setAlumnoSesiones }) {
  var merge = typeof mergeRutinasAsignadas === "function" ? mergeRutinasAsignadas : mergeRutinasAsignadasDefault;
  var ruts = await sb.getRutinas(alumno.id);
  setRutinasSB(ruts || []);
  setRutinasSBEntrenador(function (prev) {
    var fresh = Array.isArray(ruts) ? ruts : [];
    return merge(
      fresh,
      (prev || []).filter(function (r) {
        var alumnoRutinaId = getRutinaAlumnoId(r);
        return alumnoRutinaId == null || String(alumnoRutinaId) !== String(alumno.id);
      })
    );
  });

  // Reconciliar semana_activa de la rutina VIGENTE de ESTE alumno (nunca de la lista). Si avanzo, reflejarlo en memoria sin mutar ni bajar nada.
  var reconcile = null;
  if (typeof sb.reconcileSemanaActivaAlumno === "function") {
    reconcile = await sb.reconcileSemanaActivaAlumno(alumno.id, ruts, "entrenador_ver");
    if (reconcile && reconcile.status === "advanced") {
      var apply = function (prev) { return applySemanaActivaToRutinas(prev, reconcile.rutinaId, reconcile.semanaActiva); };
      setRutinasSB(apply);
      setRutinasSBEntrenador(apply);
    }
  }

  var prog = await sb.getProgreso(alumno.id);
  setAlumnoProgreso(prog || []);
  var ses = await sb.getSesiones(alumno.id);
  setAlumnoSesiones(ses || []);
  return { rutinas: ruts, reconcile: reconcile };
}
