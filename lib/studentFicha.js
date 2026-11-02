// Carga de la ficha de un alumno cuando el ENTRENADOR toca VER (extraido de StudentsSection.onVer para poder probar el flujo real).
// Mantiene el orden y los efectos originales (rutinas -> progreso -> sesiones) y agrega, justo despues de cargar las rutinas del alumno
// abierto, la reconciliacion de semana_activa SOLO de ese alumno (no de la lista) a traves del helper compartido.

import { getRutinaAlumnoId, mergeRutinasAsignadas as mergeRutinasAsignadasDefault } from "./routineStore.js";
import { applySemanaActivaToRutinas } from "./rutinaOperationalState.js";

function mergeSesionesPorId(prev, incoming) {
  var seen = {};
  return (incoming || []).concat(prev || []).filter(function (s) {
    var k = s && s.id != null ? String(s.id) : null;
    if (k == null) return true;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

// D7.3: una sola carga de ficha VIGENTE a la vez. Si el entrenador abre A y enseguida B, la respuesta tardia de A no debe escribir sus
// rutinas / series / sesiones en la ficha de B. Cada carga toma un turno; solo el ultimo puede escribir estado (lo usan VER, la navegacion
// del Dashboard y la busqueda global de App.jsx).
var turnoFicha = 0;

// D7.3: VISTA de la ficha = que alumno muestra la ficha abierta y en que "apertura" (epoca). Cambia al abrir otro alumno y al cerrar.
// Las operaciones asincronas de la ficha (reiniciar rutina/semana, limpiar historial, validar sesiones, asignar rutina) capturan la vista
// al empezar y solo actualizan el estado VISUAL de la ficha si sigue siendo la misma; la escritura en Supabase nunca se cancela ni repite.
var vistaFicha = { id: null, epoca: 0 };

/** Registra que alumno muestra la ficha (null = cerrada). Idempotente: solo abre una epoca nueva si cambia el alumno. */
export function sincronizarVistaFicha(alumnoId) {
  var id = alumnoId == null || alumnoId === "" ? null : String(alumnoId);
  if (vistaFicha.id !== id) vistaFicha = { id: id, epoca: vistaFicha.epoca + 1 };
}

/** true mientras la ficha siga mostrando a `alumnoId` en la misma apertura que al capturar. */
export function capturarVistaFicha(alumnoId) {
  var id = alumnoId == null ? null : String(alumnoId);
  var epoca = vistaFicha.epoca;
  return function enVista() { return id != null && vistaFicha.id === id && vistaFicha.epoca === epoca; };
}

/**
 * Inicia una carga de ficha y devuelve esVigente(): true mientras no se haya iniciado otra carga despues.
 * Con argumento (id del alumno, o null al cerrar la ficha) tambien actualiza la vista de la ficha.
 */
export function nuevaCargaFicha(alumnoId) {
  if (arguments.length > 0) {
    // reabrir el mismo alumno tambien es una apertura nueva: las respuestas de operaciones de la apertura anterior no se aplican
    if (alumnoId != null && vistaFicha.id === String(alumnoId)) vistaFicha = { id: vistaFicha.id, epoca: vistaFicha.epoca + 1 };
    else sincronizarVistaFicha(alumnoId);
  }
  var turno = ++turnoFicha;
  return function esVigente() { return turno === turnoFicha; };
}

/** Observa (sin tomar turno) si se inicio otra carga de ficha despues de este momento: true mientras no. */
export function observarCargaFicha() {
  var turno = turnoFicha;
  return function sinCargaNueva() { return turno === turnoFicha; };
}

/**
 * D7.3: resultado de validar sesiones (huerfanas o manuales) de `alumnoId`, ya GUARDADAS en Supabase.
 *  - la lista global de sesiones del entrenador siempre lo incorpora (la confirmacion no se pierde aunque se cambie de alumno);
 *  - la ficha (alumnoSesiones) solo si sigue mostrando a ese alumno en la misma apertura (enVista()).
 */
export function aplicarSesionesValidadas(p) {
  var rows = (Array.isArray(p.rows) ? p.rows : []).filter(Boolean);
  if (!rows.length) return;
  if (typeof p.setSesionesGlobales === "function") p.setSesionesGlobales(function (prev) { return mergeSesionesPorId(prev, rows); });
  if (typeof p.enVista !== "function" || p.enVista()) p.setAlumnoSesiones(function (prev) { return mergeSesionesPorId(prev, rows); });
}

/** D7.3: avance de semana_activa ya persistido: la lista global siempre; la ficha (rutinasSB) solo si sigue en vista. */
export function aplicarAvanceSemana(p) {
  var w = p.week;
  if (!w || w.status !== "advanced") return false;
  var apply = function (prev) { return applySemanaActivaToRutinas(prev, w.rutinaId, w.semanaActiva); };
  if (typeof p.setRutinasSBEntrenador === "function") p.setRutinasSBEntrenador(apply);
  if (typeof p.setRutinasSB === "function" && (typeof p.enVista !== "function" || p.enVista())) p.setRutinasSB(apply);
  return true;
}

/** Filas (progreso / sesiones) que pertenecen a `alumnoId`; las que no traen alumno_id se conservan (forma de datos anterior). */
export function filasDelAlumno(rows, alumnoId) {
  var id = alumnoId == null ? null : String(alumnoId);
  return (Array.isArray(rows) ? rows : []).filter(function (r) {
    return r && (r.alumno_id == null || id == null || String(r.alumno_id) === id);
  });
}

/**
 * @param {object} p
 * @param {object} p.alumno                       el alumno al que se le toco VER
 * @param {object} p.sb                           capa de datos (getRutinas, getProgreso, getSesiones, reconcileSemanaActivaAlumno)
 * @param {Function} [p.mergeRutinasAsignadas]
 * @param {Function} p.setRutinasSB, p.setRutinasSBEntrenador, p.setAlumnoProgreso, p.setAlumnoSesiones   setters de estado (React)
 * @param {Function} [p.esVigente]                turno de nuevaCargaFicha() ya tomado por quien llama
 * @returns {Promise<object>} { rutinas, reconcile } | { stale: true } (otra carga la reemplazo) | { error } (fallo la red; nada del
 *          alumno anterior queda en pantalla: los tres estados se vacian al empezar)
 */
export async function loadAlumnoFicha({ alumno, sb, mergeRutinasAsignadas, setRutinasSB, setRutinasSBEntrenador, setAlumnoProgreso, setAlumnoSesiones, esVigente }) {
  var merge = typeof mergeRutinasAsignadas === "function" ? mergeRutinasAsignadas : mergeRutinasAsignadasDefault;
  // esVigente (opcional): turno ya tomado por quien llama (VER lo usa tambien para apagar «cargando»); si no, se toma uno nuevo
  var vigente = typeof esVigente === "function" ? esVigente : nuevaCargaFicha();
  // D7.3: nada del alumno anterior queda visible mientras carga (ni si la carga falla)
  setRutinasSB([]);
  setAlumnoProgreso([]);
  setAlumnoSesiones([]);
  try {
    return await cargarFichaInterna();
  } catch (e) {
    if (!vigente()) return { stale: true };
    return { error: e };
  }

  async function cargarFichaInterna() {
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
}
