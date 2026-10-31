// Navegacion del Dashboard del entrenador hacia Alumnos (D4). UNA implementacion para App.jsx y para la demostracion
// (demo/dashboard-coach.html): ambos crean los handlers con esta funcion y solo inyectan sus setters y la carga de la ficha.
// Modulo puro, sin React ni Supabase.

/**
 * @param {object} d
 * @param {Function} d.setTab, d.setCoachAlumnosSearch, d.setCoachAlumnosFilter, d.setAlumnoActivo, d.setCoachDashIntent  setters de estado
 * @param {Function} d.getAlumnos        () => alumnos activos vigentes (para resolver el id tocado)
 * @param {Function} [d.cargarFicha]     async (alumno, logLabel) => carga los datos de la ficha (App: Supabase; demo: memoria)
 */
export function crearNavegacionDashboard(d) {
  // Alumnos con un filtro explicito; nunca conserva un filtro, una busqueda ni una ficha abierta de antes.
  function irAlumnosConFiltro(filtro) {
    d.setCoachAlumnosSearch("");
    d.setCoachAlumnosFilter(filtro);
    d.setAlumnoActivo(null);
    d.setCoachDashIntent(null);
    d.setTab("alumnos");
  }
  // Abre la ficha de ESE alumno sin filtro ni busqueda heredados (si no, la ficha abierta puede quedar fuera de la lista filtrada)
  // y deja el pedido para Alumnos ({ alumnoId, accion }), que lo consume StudentsSection.
  async function abrirAlumno(alumnoId, logLabel, accion) {
    var alum = (d.getAlumnos() || []).find(function (x) {
      return String(x.id) === String(alumnoId);
    });
    if (!alum) return;
    d.setCoachAlumnosSearch("");
    d.setCoachAlumnosFilter("todos");
    d.setCoachDashIntent({ alumnoId: alum.id, accion: accion || "perfil" });
    d.setAlumnoActivo(alum);
    d.setTab("alumnos");
    if (typeof d.cargarFicha === "function") await d.cargarFicha(alum, logLabel);
  }
  return {
    irAlumnosConFiltro: irAlumnosConFiltro,
    abrirAlumno: abrirAlumno,
    verTodos: function () { irAlumnosConFiltro("todos"); },
    verInactivos: function () { irAlumnosConFiltro("inactivos"); },
    verSinRutina: function () { irAlumnosConFiltro("sin_rutina"); },
    verBajaActividad: function () { irAlumnosConFiltro("baja"); },
    verPerfil: function (alumnoId) { return abrirAlumno(alumnoId, "[CoachDashboard onVerPerfil]", "perfil"); },
    revisar: function (alumnoId) { return abrirAlumno(alumnoId, "[CoachDashboard onRevisar]", "perfil"); },
    // Abre la ficha y el flujo EXISTENTE de asignacion de esa ficha (StudentsSection, mismo dialogo que «Asignar rutina»).
    asignarRutina: function (alumnoId) { return abrirAlumno(alumnoId, "[CoachDashboard onAsignarRutina]", "asignar"); },
  };
}

/**
 * Lista y contadores de Alumnos con el filtro «Baja actividad» (regla de D3: ids de bajaActividadIds). No es una categoria nueva: para
 * "baja" el selector de Alumnos devuelve la lista con la busqueda aplicada y aca se acota a esos ids.
 */
export function vistaAlumnosConBaja(p) {
  var ids = p.bajaIds || {};
  var counts = Object.assign({}, p.counts, { baja: Object.keys(ids).length });
  var lista = p.filtro !== "baja"
    ? p.lista
    : (p.lista || []).filter(function (a) { return !!ids[String(a.id)]; });
  return { counts: counts, lista: lista };
}
