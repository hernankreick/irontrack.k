// Datos FICTICIOS de la demostracion de «Mis alumnos» (demo/mis-alumnos.html, solo Preview; ver vite.config.js).
// Sesiones relativas a hoy para que cada estado se vea igual cualquiera sea el dia en que se abra. Sin red ni Supabase.
// Capa `sb` en memoria con la forma que usa la ficha (mismo patron que dashboardCoachDemoData.js y fichaAlumnoDemoData.js).

export const DEMO_MA_ENTRENADOR_ID = "demo-entrenador-ma";

function dias(n) {
  return Array.from({ length: n }, function (_, i) {
    return {
      label: "Día " + (i + 1),
      warmup: [{ id: "demo-wu-" + i, name: "Movilidad general", sets: 2, reps: "10" }],
      exercises: [{ id: "demo-sq-" + i, name: "Sentadilla", sets: 3, reps: "8" }, { id: "demo-rm-" + i, name: "Remo con mancuerna", sets: 3, reps: "10" }],
    };
  });
}
function haceDias(n, hoy) {
  var d = new Date(hoy || Date.now());
  d.setHours(15, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function dmy(d) { return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); }

// [clave, nombre, rutina (null = sin rutina), dias de la rutina, sesiones (hace N dias)]
const FILAS = [
  ["lucia", "Lucía Fernández", "Hipertrofia", 4, [0, 2, 5, 8]],
  ["mateo", "Mateo Rodríguez", "Fuerza base", 3, [1, 3, 8]],
  ["valentina", "Valentina Gómez", "Full body", 3, [0, 4]],
  ["joaquin", "Joaquín Pérez", "Torso / pierna", 4, [30, 35]],
  ["camila", "Camila Sosa", "Glúteos y pierna", 3, [2, 6]],
  ["tomas", "Tomás Álvarez", "Full body", 2, [15]],
  ["martina", "Martina Giménez", "Recomposición", 3, [0, 1, 3]],
  ["facundo", "Facundo Ibáñez", "Fuerza base", 3, []],
  ["sofia", "Sofía Castro-Benítez", "Mantenimiento", 2, [0, 4]],
  ["bautista", "Bautista Núñez", "Hipertrofia", 4, [25]],
  ["renata", "Renata Domínguez", null, 0, []],
  ["ignacio", "Ignacio Villalobos Echeverría-Paz", null, 0, []],
];

export const DEMO_MA_ALUMNOS = FILAS.map(function (f) {
  return { id: "demo-" + f[0], nombre: f[1], email: f[0] + "@ejemplo.com", entrenador_id: DEMO_MA_ENTRENADOR_ID, created_at: "2026-08-01T10:00:00" };
});

export function demoMaRutinas(hoy) {
  var creada = haceDias(60, hoy).toISOString();
  return FILAS.filter(function (f) { return f[2]; }).map(function (f) {
    return { id: "demo-rut-" + f[0], alumno_id: "demo-" + f[0], entrenador_id: DEMO_MA_ENTRENADOR_ID, nombre: f[2], es_plantilla: false, created_at: creada, datos: { semana_activa: 1, days: dias(f[3]) } };
  });
}

export function demoMaSesiones(hoy) {
  var n = 0;
  var out = [];
  FILAS.forEach(function (f) {
    f[4].forEach(function (hace, i) {
      var d = haceDias(hace, hoy);
      n++;
      out.push({ id: "demo-ses-" + n, alumno_id: "demo-" + f[0], rutina_id: "demo-rut-" + f[0], rutina_nombre: "", dia_idx: i % Math.max(1, f[3]), semana: 1, fecha: dmy(d), hora: "15:00", ejercicios: "", created_at: d.toISOString() });
    });
  });
  return out;
}

/** Rutinas locales del entrenador (las que se eligen en «Rutina a asignar»), con la forma de las de it_rt en la app. */
export const DEMO_MA_RUTINAS_LOCALES = [
  { id: "demo-rt-local-1", name: "Rutina inicial (demo)", days: dias(2), saved: true },
  { id: "demo-rt-local-2", name: "Fuerza 3 días (demo)", days: dias(3), saved: true },
];

export function createDemoMaSb(hoy) {
  var rutinas = demoMaRutinas(hoy);
  var sesiones = demoMaSesiones(hoy);
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  return {
    getRutinas: async function (alumnoId) { return clone(rutinas.filter(function (r) { return r.alumno_id === String(alumnoId); })); },
    getProgreso: async function () { return []; },
    getSesiones: async function (alumnoId) { return clone(sesiones.filter(function (x) { return x.alumno_id === String(alumnoId); })); },
    reconcileSemanaActivaAlumno: async function () { return { status: "noop" }; },
    getSesionesByAlumnoRutinaSemana: async function (alumnoId, rutinaId, _nombre, semana) {
      return clone(sesiones.filter(function (x) { return x.alumno_id === String(alumnoId) && x.rutina_id === String(rutinaId) && Number(x.semana) === Number(semana); }));
    },
  };
}
