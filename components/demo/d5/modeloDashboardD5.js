// Modelo de la PROPUESTA de Dashboard D5 (solo demostracion). No define metricas nuevas: todo sale de las funciones reales de
// D3/D4 (components/CoachDashboard.jsx), de la categoria de Alumnos (lib/coachStudentListSelectors.js) y de lib/metricas (E1).
import { adherenciaSemanalAlumno, bajaActividadIds, resumenAdherenciaEquipo, semanasDashboard } from "../../CoachDashboard.jsx";
import { selectCoachStudentListState } from "../../../lib/coachStudentListSelectors.js";
import { getStudentRoutine } from "../../../lib/studentWeeklyProgress.js";
import { diaDeSesion, diaLocal, rachaSemanal } from "../../../lib/metricas/index.js";
import { isCompletedSession } from "../../../lib/studentWeeklyProgress.js";

/** Dias hasta donde la «Actividad reciente» muestra sesiones (dos semanas). Solo filtra que filas se listan; no clasifica a nadie. */
export const ACTIVIDAD_RECIENTE_DIAS = 14;
export const ACTIVIDAD_RECIENTE_MAX = 5;

/**
 * @param {object} p { alumnos, rutinas, sesiones, historiaCompleta, alumnosStatus, hoy? (numero de dia) }
 * @returns {{ estado, equipo, seguimiento, recientes, semanas }}
 *   estado: "cargando" | "sin_alumnos" | "ok"
 *   equipo: { total, entrenaronSemana, adherenciaPct (null = sin plan), adherenciaDelta (null = sin comparacion), motivoSinDelta,
 *             alumnosConPlan, requierenSeguimiento, historialIncompleto }
 *   seguimiento: { sinRutina:[], inactivos:[], baja:[] }  (alumnos; categorias excluyentes)
 *   recientes: [{ alumno, dia, haceDias, estado }]  ultimas sesiones completadas (<= 14 dias), la mas reciente primero
 */
export function modeloDashboardD5(p) {
  var alumnos = p.alumnos || [];
  var sesiones = p.sesiones || [];
  var hoy = p.hoy != null ? p.hoy : diaLocal();
  var semanas = semanasDashboard(hoy);
  var historialCargando = alumnos.length > 0 && p.historiaCompleta == null && !sesiones.length;
  var alumnosCargando = !alumnos.length && (p.alumnosStatus === "loading" || p.alumnosStatus === "idle");
  var cargando = historialCargando || alumnosCargando;
  var estado = cargando ? "cargando" : alumnos.length === 0 ? "sin_alumnos" : "ok";
  var historialIncompleto = !!(p.historiaCompleta && (p.historiaCompleta.sesiones === false || p.historiaCompleta.progreso === false));
  var vacio = { total: alumnos.length, entrenaronSemana: null, adherenciaPct: null, adherenciaDelta: null, motivoSinDelta: null, alumnosConPlan: 0, requierenSeguimiento: null, historialIncompleto: historialIncompleto };
  if (estado !== "ok") return { estado: estado, equipo: vacio, seguimiento: { sinRutina: [], inactivos: [], baja: [] }, recientes: [], semanas: semanas };

  var catFn = selectCoachStudentListState({
    alumnosActivosLimpios: alumnos, rutinasUnificadas: p.rutinas || [], sesionesGlobalesLimpias: sesiones, progresoGlobalLimpio: {},
    coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
  }).coachAlumnoCategoria;
  var filas = alumnos.map(function (a) {
    var cat = catFn(a);
    var comp = adherenciaSemanalAlumno(a, cat, getStudentRoutine(p.rutinas || [], a), sesiones, semanas, false);
    return { alumno: a, cat: cat, pct: comp.pct, planState: comp.planState, seguimiento: comp.seguimiento, adh: comp };
  });
  var equipo = resumenAdherenciaEquipo(filas, p.historiaCompleta);
  var bajaIds = bajaActividadIds({ alumnos: alumnos, catFn: catFn, rutinas: p.rutinas || [], sesiones: sesiones, hoy: hoy });
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
  var estadoDe = {};
  filas.forEach(function (f) { estadoDe[String(f.alumno.id)] = f; });
  var recientes = alumnos
    .filter(function (a) { var d = ultima[String(a.id)]; return d != null && hoy - d <= ACTIVIDAD_RECIENTE_DIAS; })
    .map(function (a) { var d = ultima[String(a.id)]; return { alumno: a, dia: d, haceDias: hoy - d, fila: estadoDe[String(a.id)] }; })
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
