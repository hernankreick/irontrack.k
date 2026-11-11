// Datos FICTICIOS de la demostracion «Cumplimiento del ciclo» (demo/ficha-alumno.html?vista=cumplimiento; solo builds de Preview).
// Nada sale de la memoria del navegador: sin Supabase, sin red, sin localStorage. Todas las sesiones de todos los alumnos van en UNA
// lista (como el historial del roster en la app) para comprobar que cada ficha solo usa las de su alumno.
import { buildReinicioDatos } from "../../lib/rutinaCiclo.js";

const DIAS = [{ label: "Día 1" }, { label: "Día 2" }, { label: "Día 3" }];

function rutina(id, alumnoId, nombre, datos) {
  return { id: id, nombre: nombre, alumno_id: alumnoId, es_plantilla: false, created_at: "2026-09-28T10:00:00Z", datos: Object.assign({ days: DIAS }, datos) };
}

let n = 0;
function ses(alumnoId, rutinaId, semana, dia, extra) {
  n++;
  return Object.assign({
    id: "demo-cc-" + n, alumno_id: alumnoId, rutina_id: rutinaId, rutina_nombre: "Fuerza demo", semana: semana, dia_idx: dia,
    fecha: (1 + (n % 27)) + "/10/2026", hora: "18:30", created_at: "2026-10-" + String(1 + (n % 27)).padStart(2, "0") + "T18:30:00Z",
  }, extra || {});
}

const diego = rutina("r-diego", "a-diego", "Fuerza demo", { semana_activa: 2 });
diego.datos = buildReinicioDatos(diego.datos, { tipo: "semana", semana: 2, nowIso: "2026-10-18T10:00:00Z" });

export const ALUMNOS_DEMO = [
  { id: "a-ana", nombre: "Ana (ciclo en curso)", escenario: "S1 y S2 completas (una sesión validada por el entrenador), S3 parcial y S4 futura." },
  { id: "a-carla", nombre: "Carla (sin datos)", escenario: "S2 avanzó sin todas sus sesiones registradas y la semana actual tiene una sesión sin día: no verificables." },
  { id: "a-diego", nombre: "Diego (reinicio de semana)", escenario: "Reinicio de la semana 2 (ciclo 2): el intento anterior no cuenta." },
  { id: "a-eva", nombre: "Eva (sin sesiones)", escenario: "Rutina nueva, historial completo y ninguna sesión: semana 1 pendiente." },
  { id: "a-bruno", nombre: "Bruno (alta reciente)", escenario: "No estaba en la última carga completa del historial: «Sin datos suficientes» aunque tenga sesiones." },
];

export const RUTINAS_DEMO = {
  "a-ana": rutina("r-ana", "a-ana", "Fuerza demo", { semana_activa: 3 }),
  "a-carla": rutina("r-carla", "a-carla", "Fuerza demo", { semana_activa: 3 }),
  "a-diego": diego,
  "a-eva": rutina("r-eva", "a-eva", "Fuerza demo", { semana_activa: 1 }),
  "a-bruno": rutina("r-bruno", "a-bruno", "Fuerza demo", { semana_activa: 2 }),
};

/** Historial del roster (todas las sesiones de todos los alumnos en una lista), con duplicados reales para comprobar que no se cuentan. */
export const SESIONES_ROSTER = [
  // Ana: S1 3/3, S2 3/3 (dia 1 validado por el entrenador + duplicado), S3 1/3
  ses("a-ana", "r-ana", 1, 0), ses("a-ana", "r-ana", 1, 1), ses("a-ana", "r-ana", 1, 2),
  ses("a-ana", "r-ana", 2, 0), ses("a-ana", "r-ana", 2, 1, { origen: "validada_coach", ejercicios: "" }), ses("a-ana", "r-ana", 2, 2), ses("a-ana", "r-ana", 2, 2),
  ses("a-ana", "r-ana", 3, 0),
  // Carla: S1 3/3, S2 1/3 (avanzo sin evidencia), S3 con una sesion sin dia
  ses("a-carla", "r-carla", 1, 0), ses("a-carla", "r-carla", 1, 1), ses("a-carla", "r-carla", 1, 2),
  ses("a-carla", "r-carla", 2, 0),
  ses("a-carla", "r-carla", 3, null),
  // Diego: S1 3/3 (ciclo 1), S2 ciclo 1 2/3 (intento anterior), S2 ciclo 2 1/3
  ses("a-diego", "r-diego", 1, 0), ses("a-diego", "r-diego", 1, 1), ses("a-diego", "r-diego", 1, 2),
  ses("a-diego", "r-diego", 2, 0), ses("a-diego", "r-diego", 2, 1),
  ses("a-diego", "r-diego", 2, 0, { ciclo: 2 }),
  // Bruno: tiene sesiones, pero no estaba en la carga completa
  ses("a-bruno", "r-bruno", 1, 0), ses("a-bruno", "r-bruno", 1, 1), ses("a-bruno", "r-bruno", 1, 2),
  // Filas de otra rutina para Ana (no deben contar)
  ses("a-ana", "r-vieja", 3, 1), ses("a-ana", "r-vieja", 3, 2),
];

/** Estados de la carga completa del historial del roster, como coachHistoriaCompleta en la app. Bruno no esta en el rosterKey. */
export const CARGAS_DEMO = {
  completa: { etiqueta: "Completa", valor: { sesiones: true, progreso: true, rosterKey: "a-ana,a-carla,a-diego,a-eva" } },
  cargando: { etiqueta: "Cargando", valor: null },
  fallida: { etiqueta: "Fallida", valor: { sesiones: false, progreso: true, rosterKey: "a-ana,a-carla,a-diego,a-eva" } },
};
