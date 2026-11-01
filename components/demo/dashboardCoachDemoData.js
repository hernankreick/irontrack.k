// Datos FICTICIOS de la demostracion del Dashboard del entrenador (demo/dashboard-coach.html, solo Preview; ver vite.config.js).
// Fechas relativas a hoy para que cada estado se vea siempre igual, cualquiera sea el dia en que se abra la demo. Sin red ni Supabase.
//   Ana Inactiva   rutina, sin sesiones en mas de 21 dias            -> «Sin actividad» (Atencion hoy: inactivos)
//   Beto Baja      rutina, ultima sesion hace 15 dias                -> «Baja actividad» (regla de D3)
//   Cami Nueva     sin rutina                                         -> «Sin rutina»
//   Dora Constante rutina de 1 dia, entreno hoy y la semana pasada    -> «Al día» 100 %
//   Eli Regular    rutina de 3 dias, 2 dias la semana pasada, 1 hoy   -> «Al día»

export const DEMO_DASH_ENTRENADOR_ID = "demo-entrenador-dash";

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
function dmy(d) {
  return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
}
/** Dias desde el lunes de esta semana (0 = lunes). */
function desdeLunes(hoy) {
  var d = new Date(hoy || Date.now());
  return (d.getDay() + 6) % 7;
}

export const DEMO_DASH_ALUMNOS = [
  ["ana", "Ana Inactiva"],
  ["beto", "Beto Baja"],
  ["cami", "Cami Nueva"],
  ["dora", "Dora Constante"],
  ["eli", "Eli Regular"],
].map(function (p) {
  return { id: "demo-" + p[0], nombre: p[1], email: p[0] + "@ejemplo.com", entrenador_id: DEMO_DASH_ENTRENADOR_ID, created_at: "2026-08-01T10:00:00" };
});

export function demoDashRutinas(hoy) {
  var creada = haceDias(60, hoy).toISOString();
  function r(aid, nombre, n) {
    return { id: "demo-rut-" + aid, alumno_id: "demo-" + aid, entrenador_id: DEMO_DASH_ENTRENADOR_ID, nombre: nombre, es_plantilla: false, created_at: creada, datos: { semana_activa: 1, days: dias(n) } };
  }
  return [r("ana", "Fuerza base", 2), r("beto", "Full body", 2), r("dora", "Mantenimiento", 1), r("eli", "Hipertrofia", 3)];
}

export function demoDashSesiones(hoy) {
  var lun = desdeLunes(hoy);
  var n = 0;
  function s(aid, hace, diaIdx) {
    var d = haceDias(hace, hoy);
    n++;
    return { id: "demo-ses-" + n, alumno_id: "demo-" + aid, rutina_id: "demo-rut-" + aid, rutina_nombre: "", dia_idx: diaIdx, semana: 1, fecha: dmy(d), hora: "15:00", ejercicios: "", created_at: d.toISOString() };
  }
  return [
    s("beto", 15, 0),                                  // antes de la semana pasada (cualquier dia de hoy) y dentro de los 21 dias
    s("dora", 0, 0), s("dora", lun + 3, 0),            // hoy y un dia de la semana pasada
    s("eli", 0, 0), s("eli", lun + 2, 0), s("eli", lun + 5, 1),
  ];
}

/** Rutina local del entrenador (la que se asigna con «Asignar rutina»), como las de it_rt en la app. */
export const DEMO_DASH_RUTINA_LOCAL = { id: "demo-rt-local", name: "Rutina inicial (demo)", days: dias(2), saved: true };

/** Capa de datos en memoria con la forma de `sb` que usa la ficha (rutinas, progreso, sesiones). Nada persiste ni sale a la red. */
export function createDemoDashSb(hoy) {
  var rutinas = demoDashRutinas(hoy);
  var sesiones = demoDashSesiones(hoy);
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

/**
 * Escenario `?alertas=muchas` (D6.2): 10 alumnos ficticios mas para que la campana tenga mas de 12 alertas y se vea «Ver N más».
 *   4 inactivos (ultima sesion hace 30 dias), 3 sin rutina y 3 con baja actividad (1 de 4 dias las dos semanas anteriores, nada esta).
 */
export const DEMO_DASH_ALUMNOS_EXTRA = [
  ["fito", "Fito Inactivo"], ["gala", "Gala Inactiva"], ["hugo", "Hugo Inactivo"], ["ines", "Inés Inactiva"],
  ["juan", "Juan Nuevo"], ["kira", "Kira Nueva"], ["leo", "Leo Nuevo"],
  ["mara", "Mara Baja"], ["nico", "Nico Bajo"], ["olga", "Olga Baja"],
].map(function (p) {
  return { id: "demo-" + p[0], nombre: p[1], email: p[0] + "@ejemplo.com", entrenador_id: DEMO_DASH_ENTRENADOR_ID, created_at: "2026-08-01T10:00:00" };
});

export function demoDashRutinasExtra(hoy) {
  var creada = haceDias(60, hoy).toISOString();
  return ["fito", "gala", "hugo", "ines", "mara", "nico", "olga"].map(function (aid) {
    return { id: "demo-rut-" + aid, alumno_id: "demo-" + aid, entrenador_id: DEMO_DASH_ENTRENADOR_ID, nombre: "Plan " + aid, es_plantilla: false, created_at: creada, datos: { semana_activa: 1, days: dias(4) } };
  });
}

export function demoDashSesionesExtra(hoy) {
  var lun = desdeLunes(hoy);
  var out = [];
  function s(aid, hace) {
    var d = haceDias(hace, hoy);
    out.push({ id: "demo-ses-x-" + aid + "-" + hace, alumno_id: "demo-" + aid, rutina_id: "demo-rut-" + aid, rutina_nombre: "", dia_idx: 0, semana: 1, fecha: dmy(d), hora: "15:00", ejercicios: "", created_at: d.toISOString() });
  }
  ["fito", "gala", "hugo", "ines"].forEach(function (aid) { s(aid, 30); });
  ["mara", "nico", "olga"].forEach(function (aid) { s(aid, lun + 3); s(aid, lun + 10); });
  return out;
}
