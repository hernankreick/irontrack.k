// Datos FICTICIOS de la demostracion «Semana activa» (subtitulo de «Semana N de 4» en la ficha del alumno; PR #196).
// Sin red ni Supabase: todo vive en memoria. Los alumnos tienen la forma que usa la lista del entrenador y la rutina trae
// `datos.semana_activa` y sesiones con `semana` explicita, exactamente lo que lee getActiveStudentRoutinePosition en la app.
// Las fechas son FIJAS (no relativas a hoy) para que cada estado se vea igual cualquiera sea el dia en que se abra y para poder
// probar el texto «Iniciada el D/M». Las sesiones se guardan a las 15:00 UTC (12:00 en Buenos Aires) para no cambiar de dia por zona horaria.

export const DEMO_SA_ENTRENADOR_ID = "demo-entrenador-sa";

function dias(n) {
  return Array.from({ length: n }, function (_, i) {
    return {
      label: "Día " + (i + 1),
      warmup: [{ id: "demo-sa-wu-" + i, name: "Movilidad general", sets: 2, reps: "10" }],
      exercises: [
        { id: "demo-sa-sq-" + i, name: "Sentadilla", sets: 3, reps: "8" },
        { id: "demo-sa-rm-" + i, name: "Remo con mancuerna", sets: 3, reps: "10" },
      ],
    };
  });
}

// [clave, nombre, semana_activa, sesiones: [[semana, dia_idx (0..2), "AAAA-MM-DD"], ...], estado esperado del subtitulo]
export const DEMO_SA_FILAS = [
  // Semana 3 de 4, 0/3: las semanas 1 y 2 estan completas y la 3 todavia no empezo -> «Sin iniciar».
  ["catalina", "Catalina", 3, [
    [1, 0, "2026-11-02"], [1, 1, "2026-11-04"], [1, 2, "2026-11-06"],
    [2, 0, "2026-11-09"], [2, 1, "2026-11-11"], [2, 2, "2026-11-13"],
  ], "Sin iniciar"],
  // Semana 2 de 4, 1/3: la S2 empezo con una sesion el martes 17/11 -> «Iniciada el 17/11».
  ["alumno-b", "Alumno B", 2, [
    [1, 0, "2026-11-09"], [1, 1, "2026-11-11"], [1, 2, "2026-11-13"],
    [2, 0, "2026-11-17"],
  ], "Iniciada el 17/11"],
  // Semana 4 de 4, 3/3: la S4 empezo el lunes 26/10 (primera de sus tres sesiones) -> «Iniciada el 26/10».
  ["alumno-c", "Alumno C", 4, [
    [1, 0, "2026-10-05"], [1, 1, "2026-10-07"], [1, 2, "2026-10-09"],
    [2, 0, "2026-10-12"], [2, 1, "2026-10-14"], [2, 2, "2026-10-16"],
    [3, 0, "2026-10-19"], [3, 1, "2026-10-21"], [3, 2, "2026-10-23"],
    [4, 0, "2026-10-26"], [4, 1, "2026-10-28"], [4, 2, "2026-10-30"],
  ], "Iniciada el 26/10"],
];

/** Claves de URL (?alumno=) -> id del alumno. */
export const DEMO_SA_CLAVES = DEMO_SA_FILAS.map(function (f) { return f[0]; });

export function demoSaAlumnoId(clave) { return "demo-sa-" + clave; }

export const DEMO_SA_ALUMNOS = DEMO_SA_FILAS.map(function (f) {
  return { id: demoSaAlumnoId(f[0]), nombre: f[1], email: f[0] + "@ejemplo.com", entrenador_id: DEMO_SA_ENTRENADOR_ID, created_at: "2026-09-01T10:00:00" };
});

/** Subtitulo esperado por clave (lo usan las pruebas y la barra de la demo para decir que se espera ver). */
export const DEMO_SA_ESPERADO = DEMO_SA_FILAS.reduce(function (acc, f) { acc[f[0]] = f[4]; return acc; }, {});

export function demoSaRutinas() {
  return DEMO_SA_FILAS.map(function (f) {
    return {
      id: "demo-sa-rut-" + f[0], alumno_id: demoSaAlumnoId(f[0]), entrenador_id: DEMO_SA_ENTRENADOR_ID, nombre: "Cata2 (demo)",
      es_plantilla: false, created_at: "2026-10-01T15:00:00.000Z", datos: { semana_activa: f[2], days: dias(3) },
    };
  });
}

function dmy(iso) {
  var p = iso.split("-");
  return Number(p[2]) + "/" + Number(p[1]) + "/" + p[0];
}

export function demoSaSesiones() {
  var n = 0;
  var out = [];
  DEMO_SA_FILAS.forEach(function (f) {
    f[3].forEach(function (s) {
      n++;
      out.push({
        id: "demo-sa-ses-" + n, alumno_id: demoSaAlumnoId(f[0]), rutina_id: "demo-sa-rut-" + f[0], rutina_nombre: "",
        dia_idx: s[1], semana: s[0], fecha: dmy(s[2]), hora: "12:00", ejercicios: "", created_at: s[2] + "T15:00:00.000Z",
      });
    });
  });
  return out;
}

/** Rutinas locales del entrenador (las que se eligen en «Rutina a asignar»). */
export const DEMO_SA_RUTINAS_LOCALES = [
  { id: "demo-sa-rt-local-1", name: "Rutina de 3 días (demo)", days: dias(3), saved: true },
];

/**
 * Capa `sb` en memoria con la forma que usa la ficha al abrirse (loadAlumnoFicha). Solo LEE: no hay ninguna escritura y
 * reconcileSemanaActivaAlumno devuelve "noop", asi que la demo nunca avanza ni cambia la semana activa de nadie.
 */
export function createDemoSaSb() {
  var rutinas = demoSaRutinas();
  var sesiones = demoSaSesiones();
  var clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  return {
    getRutinas: async function (alumnoId) { return clone(rutinas.filter(function (r) { return r.alumno_id === String(alumnoId); })); },
    getProgreso: async function () { return []; },
    getSesiones: async function (alumnoId) { return clone(sesiones.filter(function (x) { return x.alumno_id === String(alumnoId); })); },
    reconcileSemanaActivaAlumno: async function () { return { status: "noop" }; },
    getSesionesByAlumnoRutinaSemana: async function (alumnoId, rutinaId, _nombre, semana) {
      return clone(sesiones.filter(function (x) { return x.alumno_id === String(alumnoId) && x.rutina_id === String(rutinaId) && Number(x.semana) === Number(semana); }));
    },
    // Las acciones que en la app escriben (validar sesion, nota del dia) no existen aca: la demo no guarda nada.
    addSesion: async function () { throw new Error("demo: no se guarda nada"); },
    setNota: async function () { throw new Error("demo: no se guarda nada"); },
  };
}
