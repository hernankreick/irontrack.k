// Carga de la ficha de un alumno cuando el ENTRENADOR toca VER (extraido de StudentsSection.onVer para poder probar el flujo real).
// Mantiene el orden y los efectos originales (rutinas -> progreso -> sesiones) y agrega, justo despues de cargar las rutinas del alumno
// abierto, la reconciliacion de semana_activa SOLO de ese alumno (no de la lista) a traves del helper compartido.

import { getRutinaAlumnoId, mergeRutinasAsignadas as mergeRutinasAsignadasDefault } from "./routineStore.js";
import { applySemanaActivaToRutinas } from "./rutinaOperationalState.js";

// D7.3: una sola carga de ficha VIGENTE a la vez. Si el entrenador abre A y enseguida B, la respuesta tardia de A no debe escribir sus
// rutinas / series / sesiones en la ficha de B. Cada carga toma un turno; solo el ultimo puede escribir estado (lo usan VER, la navegacion
// del Dashboard y la busqueda global de App.jsx).
var turnoFicha = 0;

/** Inicia una carga de ficha y devuelve esVigente(): true mientras no se haya iniciado otra carga despues. */
export function nuevaCargaFicha() {
  var turno = ++turnoFicha;
  return function esVigente() { return turno === turnoFicha; };
}

/**
 * @param {object} p
 * @param {object} p.alumno                       el alumno al que se le toco VER
 * @param {object} p.sb                           capa de datos (getRutinas, getProgreso, getSesiones, reconcileSemanaActivaAlumno)
 * @param {Function} [p.mergeRutinasAsignadas]
 * @param {Function} p.setRutinasSB, p.setRutinasSBEntrenador, p.setAlumnoProgreso, p.setAlumnoSesiones   setters de estado (React)
 * @param {Function} [p.esVigente]                turno de nuevaCargaFicha() ya tomado por quien llama
 */
export async function loadAlumnoFicha({ alumno, sb, mergeRutinasAsignadas, setRutinasSB, setRutinasSBEntrenador, setAlumnoProgreso, setAlumnoSesiones, esVigente }) {
  var merge = typeof mergeRutinasAsignadas === "function" ? mergeRutinasAsignadas : mergeRutinasAsignadasDefault;
  // esVigente (opcional): turno ya tomado por quien llama (VER lo usa tambien para apagar «cargando»); si no, se toma uno nuevo
  var vigente = typeof esVigente === "function" ? esVigente : nuevaCargaFicha();
  var ruts = await sb.getRutinas(alumno.id);
  if (!vigente()) return { stale: true };
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
      // La lista global del entrenador refleja el avance ya persistido aunque la carga haya sido reemplazada (aplica solo a esa rutina por id).
      setRutinasSBEntrenador(apply);
      if (!vigente()) return { stale: true };
      setRutinasSB(apply);
    } else if (!vigente()) return { stale: true };
  }

  var prog = await sb.getProgreso(alumno.id);
  if (!vigente()) return { stale: true };
  setAlumnoProgreso(prog || []);
  var ses = await sb.getSesiones(alumno.id);
  if (!vigente()) return { stale: true };
  setAlumnoSesiones(ses || []);
  return { rutinas: ruts, reconcile: reconcile };
}
