// Datos FICTICIOS de la demostracion de diseno D5 (demo/dashboard-d5.html, solo Preview). Fechas relativas a hoy: cada escenario se ve
// igual cualquier dia de la semana. Sin red ni Supabase. Escenarios para probar los estados de la propuesta:
//   normal      equipo al dia (nadie requiere seguimiento)
//   atencion    sin rutina + inactivo + baja actividad + alumnos al dia
//   sinAlumnos  entrenador nuevo, sin alumnos
//   sinRutinas  alumnos sin ninguna rutina asignada
//   cargando    historial todavia sin cargar
//   incompleto  historial truncado (las comparaciones se desactivan)

export const D5_ENTRENADOR_ID = "demo-entrenador-d5";

function dias(n) {
  return Array.from({ length: n }, function (_, i) {
    return {
      label: "Día " + (i + 1),
      warmup: [{ id: "d5-wu-" + i, name: "Movilidad general", sets: 2, reps: "10" }],
      exercises: [{ id: "d5-sq-" + i, name: "Sentadilla", sets: 3, reps: "8" }, { id: "d5-pb-" + i, name: "Press banca", sets: 3, reps: "8" }],
    };
  });
}
function hace(n, hoy) {
  var d = new Date(hoy || Date.now());
  d.setHours(15, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function dmy(d) { return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); }
/** Dias desde el lunes de esta semana (0 = lunes). */
function desdeLunes(hoy) { return (new Date(hoy || Date.now()).getDay() + 6) % 7; }

const NOMBRES = {
  ana: "Ana Gómez", beto: "Beto Ruiz", cami: "Cami Díaz", dora: "Dora Paz", eli: "Eli Sosa", fede: "Fede Luna", gabi: "Gabi Ortiz",
};
function alumno(k) {
  return { id: "d5-" + k, nombre: NOMBRES[k], email: k + "@ejemplo.com", entrenador_id: D5_ENTRENADOR_ID, created_at: "2026-08-01T10:00:00" };
}
function rutina(k, nombre, n, hoy, creadaHace) {
  return { id: "d5-rut-" + k, alumno_id: "d5-" + k, entrenador_id: D5_ENTRENADOR_ID, nombre: nombre, es_plantilla: false, created_at: hace(creadaHace || 60, hoy).toISOString(), datos: { semana_activa: 1, days: dias(n) } };
}
function sesionesDe(spec, hoy) {
  var n = 0;
  return spec.map(function (x) {
    var d = hace(x[1], hoy);
    n++;
    return { id: "d5-ses-" + n, alumno_id: "d5-" + x[0], rutina_id: "d5-rut-" + x[0], rutina_nombre: "", dia_idx: x[2], semana: 1, fecha: dmy(d), hora: "15:00", ejercicios: "", created_at: d.toISOString() };
  });
}

/** Un escenario: { alumnos, rutinas, sesiones, historiaCompleta, alumnosStatus }. */
export function escenarioD5(id, hoy) {
  var lun = desdeLunes(hoy);
  var completa = { sesiones: true, progreso: true };
  if (id === "sinAlumnos") return { alumnos: [], rutinas: [], sesiones: [], historiaCompleta: completa, alumnosStatus: "ready" };
  if (id === "cargando") {
    return { alumnos: ["ana", "beto", "dora"].map(alumno), rutinas: [], sesiones: [], historiaCompleta: null, alumnosStatus: "ready" };
  }
  if (id === "sinRutinas") {
    return { alumnos: ["ana", "beto", "cami"].map(alumno), rutinas: [], sesiones: [], historiaCompleta: completa, alumnosStatus: "ready" };
  }
  // equipo al dia: todos entrenaron esta semana y la pasada
  var alDia = [
    ["dora", 0, 0], ["dora", lun + 3, 0],
    ["eli", 0, 0], ["eli", lun + 2, 0], ["eli", lun + 4, 1],
    ["fede", Math.min(1, lun), 0], ["fede", lun + 1, 0], ["fede", lun + 3, 1],
    ["gabi", Math.min(2, lun), 0], ["gabi", lun + 2, 0],
  ];
  var rutAlDia = [rutina("dora", "Mantenimiento", 1, hoy), rutina("eli", "Hipertrofia", 3, hoy), rutina("fede", "Fuerza", 2, hoy), rutina("gabi", "Full body", 2, hoy)];
  if (id === "normal") {
    return { alumnos: ["dora", "eli", "fede", "gabi"].map(alumno), rutinas: rutAlDia, sesiones: sesionesDe(alDia, hoy), historiaCompleta: completa, alumnosStatus: "ready" };
  }
  // atencion / incompleto: + Ana inactiva (sin sesiones), Beto baja actividad (hace 15 dias), Cami sin rutina
  var esc = {
    alumnos: ["ana", "beto", "cami", "dora", "eli", "fede", "gabi"].map(alumno),
    rutinas: [rutina("ana", "Fuerza base", 2, hoy), rutina("beto", "Full body", 2, hoy)].concat(rutAlDia),
    sesiones: sesionesDe([["beto", 15, 0]].concat(alDia), hoy),
    historiaCompleta: completa,
    alumnosStatus: "ready",
  };
  if (id === "incompleto") esc.historiaCompleta = { sesiones: false, progreso: true };
  return esc;
}

export const ESCENARIOS_D5 = [
  ["atencion", "Requieren atención"],
  ["normal", "Equipo al día"],
  ["sinAlumnos", "Sin alumnos"],
  ["sinRutinas", "Sin rutinas"],
  ["cargando", "Cargando"],
  ["incompleto", "Historial incompleto"],
];

export const D5_RUTINA_LOCAL = { id: "d5-rt-local", name: "Rutina inicial (demo)", days: dias(2), saved: true };

/** Capa de datos en memoria con la forma de `sb` que usa la ficha. Nada persiste ni sale a la red. */
export function createD5Sb(esc) {
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  return {
    getRutinas: async function (aid) { return clone(esc.rutinas.filter(function (r) { return r.alumno_id === String(aid); })); },
    getProgreso: async function () { return []; },
    getSesiones: async function (aid) { return clone(esc.sesiones.filter(function (s) { return s.alumno_id === String(aid); })); },
    reconcileSemanaActivaAlumno: async function () { return { status: "noop" }; },
    getSesionesByAlumnoRutinaSemana: async function (aid, rid, _n, sem) {
      return clone(esc.sesiones.filter(function (s) { return s.alumno_id === String(aid) && s.rutina_id === String(rid) && Number(s.semana) === Number(sem); }));
    },
  };
}
