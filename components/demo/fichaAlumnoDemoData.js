// Datos FICTICIOS de la demostracion de la ficha del alumno (solo builds de Preview; ver vite.config.js y demo/ficha-alumno.html).
// Nada de esto sale de la memoria del navegador: no hay Supabase, ni red, ni localStorage.
import { deriveSemanaActivaTarget } from "../../lib/reconcileSemanaActiva.js";

export const DEMO_ENTRENADOR_ID = "demo-entrenador";
export const DEMO_ALUMNO = { id: "demo-alumno-1", nombre: "Alumno Demo", email: "demo@ejemplo.com", entrenador_id: DEMO_ENTRENADOR_ID, created_at: "2026-10-01T10:00:00" };
export const DEMO_RUTINA_ID = "demo-rutina-1";

// Ejercicios del catalogo real (lib/exerciseStaticData.js) para que los nombres se resuelvan igual que en la app.
const ej = (id, sets, reps, kg) => ({ id, sets: String(sets), reps: String(reps), kg: kg ? String(kg) : "", pause: 90, note: "",
  weeks: [0, 1, 2, 3].map(() => ({ sets: String(sets), reps: String(reps), kg: kg ? String(kg) : "", note: "", pausa: "" })) });

export const DEMO_DAYS = [
  { label: "Día 1", warmup: [ej("ankmob", 2, "10"), ej("thspin", 2, "8-10")], exercises: [ej("sq", 4, "8", 60), ej("bp", 4, "8", 50), ej("row", 3, "10", 45)] },
  { label: "Día 2", warmup: [ej("bridge", 2, "12"), ej("plank", 2, "30\"")], exercises: [ej("dl", 4, "6", 80), ej("pu", 3, "6-8"), ej("hip", 3, "10", 70)] },
  { label: "Día 3", warmup: [ej("thspin", 2, "8-10"), ej("core_bicho_muerto_disco", 3, "12"), ej("bridge", 2, "8")], exercises: [ej("sq", 3, "10", 55), ej("bp", 3, "10", 45), ej("row", 3, "12", 40)] },
];

export function demoRutina() {
  return {
    id: DEMO_RUTINA_ID,
    nombre: "Full Body",
    alumno_id: DEMO_ALUMNO.id,
    entrenador_id: DEMO_ENTRENADOR_ID,
    es_plantilla: false,
    created_at: "2026-10-01T10:00:00",
    datos: { alumno: DEMO_ALUMNO.nombre, semana_activa: 2, days: DEMO_DAYS },
  };
}

// Semana 1 completa y Semana 2 con los Dias 1 y 2 realizados: 2 de 3, proxima sesion Dia 3.
export function demoSesiones() {
  const ses = (semana, dia, fecha) => ({
    id: "demo-ses-" + semana + "-" + dia, alumno_id: DEMO_ALUMNO.id, rutina_id: DEMO_RUTINA_ID, rutina_nombre: "Full Body",
    dia_idx: dia, dia_label: "Día " + (dia + 1), semana, fecha, hora: "18:30", ejercicios: "", created_at: "2026-10-" + fecha.split("/")[0].padStart(2, "0") + "T18:30:00",
  });
  return [ses(2, 1, "22/10/2026"), ses(2, 0, "20/10/2026"), ses(1, 2, "17/10/2026"), ses(1, 1, "15/10/2026"), ses(1, 0, "13/10/2026")];
}

/**
 * Capa de datos simulada con la misma forma que `sb` de App.jsx, en memoria. Las lecturas devuelven los datos ficticios; las
 * "escrituras" no salen del navegador (se guardan en la memoria de esta pagina y se pierden al recargar).
 */
export function createDemoSb() {
  let sesiones = demoSesiones();
  const rutina = demoRutina();
  const clone = (x) => JSON.parse(JSON.stringify(x));
  return {
    getRutinas: async (alumnoId) => (String(alumnoId) === DEMO_ALUMNO.id ? [clone(rutina)] : []),
    getProgreso: async () => [],
    getSesiones: async (alumnoId) => clone(sesiones.filter((s) => s.alumno_id === String(alumnoId))),
    // Misma regla pura que la app (deriveSemanaActivaTarget) sobre las sesiones en memoria: si la semana queda completa, avanza.
    reconcileSemanaActivaAlumno: async (alumnoId) => {
      const d = deriveSemanaActivaTarget({ datos: rutina.datos, sesiones, rutinaId: rutina.id, alumnoId: String(alumnoId) });
      if (d.target == null) return { status: "noop", reason: d.reason, rutinaId: rutina.id };
      rutina.datos = Object.assign({}, rutina.datos, { semana_activa: d.target });
      return { status: "advanced", from: d.persisted, to: d.target, rutinaId: rutina.id, semanaActiva: d.target };
    },
    getSesionesByAlumnoRutinaSemana: async (alumnoId, rutinaId, _nombre, semana) =>
      clone(sesiones.filter((s) => s.alumno_id === String(alumnoId) && s.rutina_id === String(rutinaId) && Number(s.semana) === Number(semana))),
    addSesion: async (payload) => {
      const row = Object.assign({ id: "demo-ses-sim-" + Date.now(), created_at: new Date().toISOString() }, payload);
      sesiones = [row].concat(sesiones);
      return [clone(row)];
    },
    updateAlumno: async () => [{}],
    setNota: async () => [{}],
    createAlumno: async () => ({ data: null, error: { message: "en la demostración no se crean alumnos" } }),
  };
}
