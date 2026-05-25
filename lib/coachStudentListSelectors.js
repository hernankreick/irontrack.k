import { hasAlumnoRutina } from './routineStore.js';

function getCoachAlumnoCategoria(alumno, rutinasUnificadas, sesionesGlobalesLimpias, progresoGlobalLimpio, nowMs) {
  if (!hasAlumnoRutina(alumno, rutinasUnificadas)) return "sin_rutina";
  var cutoff = nowMs - 21 * 24 * 60 * 60 * 1000;
  var ses = sesionesGlobalesLimpias || [];
  for (var i = 0; i < ses.length; i++) {
    if (String(ses[i].alumno_id) !== String(alumno.id)) continue;
    var raw = ses[i].created_at || "";
    if (!raw) continue;
    var d = new Date(raw.slice(0, 10));
    if (!isNaN(d.getTime()) && d.getTime() >= cutoff) return "activo";
  }
  var plist = progresoGlobalLimpio[String(alumno.id)] || progresoGlobalLimpio[alumno.id];
  if (plist && plist.length) {
    for (var j = 0; j < plist.length; j++) {
      var fecha = plist[j].fecha || "";
      if (!fecha) continue;
      var d2;
      if (fecha.indexOf("/") >= 0) {
        var p = fecha.split("/");
        d2 = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
      } else {
        d2 = new Date(fecha.slice(0, 10));
      }
      if (!isNaN(d2.getTime()) && d2.getTime() >= cutoff) return "activo";
    }
  }
  return "inactivo";
}

export function selectCoachStudentListState({
  alumnosActivosLimpios,
  rutinasUnificadas,
  sesionesGlobalesLimpias,
  progresoGlobalLimpio,
  coachAlumnosSearch,
  coachAlumnosFilter,
  nowMs,
}) {
  var alumnos = alumnosActivosLimpios || [];
  var progreso = progresoGlobalLimpio || {};
  var coachAlumnoCategoria = function (a) {
    return getCoachAlumnoCategoria(a, rutinasUnificadas, sesionesGlobalesLimpias, progreso, nowMs);
  };
  var coachAlumnosCounts = { todos: alumnos.length, activos: 0, inactivos: 0, sin_rutina: 0 };
  alumnos.forEach(function (a) {
    var cat = coachAlumnoCategoria(a);
    if (cat === "sin_rutina") coachAlumnosCounts.sin_rutina++;
    else if (cat === "activo") coachAlumnosCounts.activos++;
    else coachAlumnosCounts.inactivos++;
  });

  var q = coachAlumnosSearch.trim().toLowerCase();
  var coachAlumnosListaFiltrada = alumnos.filter(function (a) {
    if (q) {
      var hay = ((a.nombre || "") + " " + (a.email || "")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    var cat = coachAlumnoCategoria(a);
    if (coachAlumnosFilter === "todos") return true;
    if (coachAlumnosFilter === "sin_rutina") return cat === "sin_rutina";
    if (coachAlumnosFilter === "activos") return cat === "activo";
    if (coachAlumnosFilter === "inactivos") return cat === "inactivo";
    return true;
  });

  return {
    coachAlumnoCategoria,
    coachAlumnosCounts,
    coachAlumnosListaFiltrada,
  };
}
