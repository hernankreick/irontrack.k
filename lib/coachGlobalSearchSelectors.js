import { getStudentWeeklyProgress } from './studentWeeklyProgress.js';

export function buildCoachGlobalSearchData({
  sessionData,
  alumnosActivosLimpios,
  sesionesGlobalesLimpias,
  rutinasSBEntrenadorLimpias,
  allEx,
  coachAlumnoCategoria,
  getRutinaAsignadaAlumno,
  progresoGlobalLimpio,
  completedDays,
  currentWeek,
}) {
  if (sessionData?.role !== "entrenador") {
    return { alumnos: [], rutinas: [], ejercicios: [], sesiones: [] };
  }
  var sg = sesionesGlobalesLimpias || [];
  var alumnos = alumnosActivosLimpios || [];
  var alumnosSearch = alumnos.map(function (a) {
    var cat = coachAlumnoCategoria(a);
    var estado = cat === "activo" ? "ok" : cat === "inactivo" ? "inactivo" : "riesgo";
    var sesCount = sg.filter(function (s) {
      return String(s.alumno_id) === String(a.id);
    }).length;
    var weekly = getStudentWeeklyProgress({
      alumno: a,
      rutina: getRutinaAsignadaAlumno(a),
      sesiones: sg,
      progreso: progresoGlobalLimpio,
      completedDays: completedDays,
      currentWeek: currentWeek,
    });
    var pct = weekly.pct;
    return {
      id: a.id,
      nombre: a.nombre || a.email || "Sin nombre",
      pctSemanal: pct,
      sesionesCompletadas: sesCount,
      estado: estado,
    };
  });
  var rutinasSearch = (rutinasSBEntrenadorLimpias || []).map(function (rSB) {
    var dias = rSB.datos?.days || [];
    var ejCount = dias.reduce(function (acc, d) {
      return acc + (d.warmup || []).length + (d.exercises || []).length;
    }, 0);
    var alum = alumnos.find(function (al) {
      return al.id === rSB.alumno_id;
    });
    return {
      id: rSB.id,
      nombre: rSB.nombre || "Rutina",
      ejerciciosCount: ejCount,
      semanaActual: dias.length ? String(dias.length) : "—",
      alumnosAsignados: alum ? alum.nombre || alum.email : "—",
    };
  });
  var ejerciciosSearch = allEx.slice(0, 280).map(function (e) {
    var pat = String(e.pattern || "").toLowerCase();
    var tipo = /compound|multi|push|pull|squat|hinge/i.test(pat) ? "compuesto" : "aislado";
    return {
      id: e.id,
      nombre: e.name || e.nameEn || e.id,
      grupoMuscular: e.muscle || "—",
      tipo: tipo,
    };
  });
  var sesionesSearch = sg.slice(0, 150).map(function (s, idx) {
    var alum = alumnos.find(function (al) {
      return al.id === s.alumno_id;
    });
    var raw = s.created_at || s.fecha || "";
    var fechaLabel = raw
      ? new Date(raw).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
      : "—";
    var pend = s.estado === "pendiente" || s.completada === false;
    return {
      id: s.id != null ? s.id : "ses-" + String(s.alumno_id) + "-" + idx,
      alumnoId: s.alumno_id,
      alumnoNombre: alum ? alum.nombre || alum.email : "Alumno",
      tipoSesion: s.tipo || s.nota || "Entrenamiento",
      fechaLabel: fechaLabel,
      estado: pend ? "pendiente" : "completada",
    };
  });
  return {
    alumnos: alumnosSearch,
    rutinas: rutinasSearch,
    ejercicios: ejerciciosSearch,
    sesiones: sesionesSearch,
  };
}
