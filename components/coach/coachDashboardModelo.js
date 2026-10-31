// Modelo del Dashboard del entrenador (D5). No define metricas nuevas: todo sale de las funciones reales de D3/D4
// (components/CoachDashboard.jsx), de la categoria de Alumnos (getAlumnoCategoria / lib/coachStudentListSelectors.js) y de lib/metricas (E1).
import { adherenciaSemanalAlumno, bajaActividadIds, resumenAdherenciaEquipo, semanasDashboard } from "../CoachDashboard.jsx";
import { ALUMNOS_STATUS, alumnosEmptyKind } from "../../lib/coachAlumnosLoad.js";
import { selectCoachStudentListState } from "../../lib/coachStudentListSelectors.js";
import { getStudentRoutine, isCompletedSession } from "../../lib/studentWeeklyProgress.js";
import { diaDeSesion, diaLocal, rachaSemanal } from "../../lib/metricas/index.js";

/** Dias hasta donde la «Actividad reciente» muestra sesiones (dos semanas). Solo filtra que filas se listan; no clasifica a nadie. */
export const ACTIVIDAD_RECIENTE_DIAS = 14;
export const ACTIVIDAD_RECIENTE_MAX = 5;

/**
 * @param {object} p { alumnos, rutinas, sesiones, progresoGlobal?, historiaCompleta, alumnosStatus, catFn?, hoy? (numero de dia) }
 * @returns {{ estado, equipo, seguimiento, recientes, semanas }}
 *   estado: "cargando" | "error" | "sin_alumnos" | "ok"
 *   equipo: { total, entrenaronSemana, adherenciaPct (null = sin plan), adherenciaDelta (null = sin comparacion), motivoSinDelta,
 *             alumnosConPlan, requierenSeguimiento, historialIncompleto }
 *   seguimiento: { sinRutina:[], inactivos:[], baja:[] }  (alumnos; categorias excluyentes)
 *   recientes: [{ alumno, dia, haceDias, fila }]  ultimas sesiones completadas (<= 14 dias), la mas reciente primero
 */
export function coachDashboardModelo(p) {
  var alumnos = p.alumnos || [];
  var sesiones = p.sesiones || [];
  var rutinas = p.rutinas || [];
  var hoy = p.hoy != null ? p.hoy : diaLocal();
  var semanas = semanasDashboard(hoy);
  var kind = alumnosEmptyKind(p.alumnosStatus || ALUMNOS_STATUS.READY, alumnos.length);
  // Mismo criterio de carga que usaba el Dashboard: alumnos en carga, o historial todavia sin llegar (no se muestran ceros inventados).
  var historialCargando = alumnos.length > 0 && p.historiaCompleta == null && !sesiones.length && !Object.keys(p.progresoGlobal || {}).length;
  var cargando = kind === "loading" || historialCargando;
  var estado = cargando ? "cargando" : kind === "error" ? "error" : alumnos.length === 0 ? "sin_alumnos" : "ok";
  var historialIncompleto = !!(p.historiaCompleta && (p.historiaCompleta.sesiones === false || p.historiaCompleta.progreso === false));
  var vacio = { total: alumnos.length, entrenaronSemana: null, adherenciaPct: null, adherenciaDelta: null, motivoSinDelta: null, alumnosConPlan: 0, requierenSeguimiento: null, historialIncompleto: historialIncompleto };
  if (estado !== "ok") return { estado: estado, equipo: vacio, seguimiento: { sinRutina: [], inactivos: [], baja: [] }, recientes: [], semanas: semanas };

  var catFn = typeof p.catFn === "function" ? p.catFn : selectCoachStudentListState({
    alumnosActivosLimpios: alumnos, rutinasUnificadas: rutinas, sesionesGlobalesLimpias: sesiones, progresoGlobalLimpio: p.progresoGlobal || {},
    coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
  }).coachAlumnoCategoria;
  var filas = alumnos.map(function (a) {
    var cat = catFn(a);
    var comp = adherenciaSemanalAlumno(a, cat, getStudentRoutine(rutinas, a), sesiones, semanas, false);
    return { alumno: a, cat: cat, pct: comp.pct, planState: comp.planState, seguimiento: comp.seguimiento, adh: comp };
  });
  var equipo = resumenAdherenciaEquipo(filas, p.historiaCompleta);
  var bajaIds = bajaActividadIds({ alumnos: alumnos, catFn: catFn, rutinas: rutinas, sesiones: sesiones, hoy: hoy });
  var seguimiento = {
    sinRutina: filas.filter(function (f) { return f.cat === "sin_rutina"; }).map(function (f) { return f.alumno; }),
    inactivos: filas.filter(function (f) { return f.cat === "inactivo"; }).map(function (f) { return f.alumno; }),
    baja: alumnos.filter(function (a) { return !!bajaIds[String(a.id)]; }),
  };
  var entrenaron = alumnos.filter(function (a) { return rachaSemanal(sesiones, { hoy: hoy, alumnoId: a.id }).incluyeSemanaActual; }).length;

  var ultima = {};
  sesiones.forEach(function (s) {
    if (!s || !isCompletedSession(s)) return;
    var d = diaDeSesion(s);
    if (d == null || d > hoy) return;
    var k = String(s.alumno_id);
    if (ultima[k] == null || d > ultima[k]) ultima[k] = d;
  });
  var filaDe = {};
  filas.forEach(function (f) { filaDe[String(f.alumno.id)] = f; });
  var recientes = alumnos
    .filter(function (a) { var d = ultima[String(a.id)]; return d != null && hoy - d <= ACTIVIDAD_RECIENTE_DIAS; })
    .map(function (a) { var d = ultima[String(a.id)]; return { alumno: a, dia: d, haceDias: hoy - d, fila: filaDe[String(a.id)] }; })
    .sort(function (x, y) { return y.dia - x.dia || String(x.alumno.nombre).localeCompare(String(y.alumno.nombre)); });

  return {
    estado: estado,
    equipo: {
      total: alumnos.length,
      entrenaronSemana: entrenaron,
      adherenciaPct: equipo.alumnosConPlan > 0 ? equipo.pct : null,
      adherenciaDelta: equipo.delta,
      motivoSinDelta: equipo.motivoSinDelta,
      alumnosConPlan: equipo.alumnosConPlan,
      requierenSeguimiento: seguimiento.sinRutina.length + seguimiento.inactivos.length + seguimiento.baja.length,
      historialIncompleto: historialIncompleto,
    },
    seguimiento: seguimiento,
    recientes: recientes,
    semanas: semanas,
  };
}
