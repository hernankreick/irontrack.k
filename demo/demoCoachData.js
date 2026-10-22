// Datos 100% ficticios del ENTRENADOR para la demo movil (nada real: nombres inventados, correos .invalid, cargas redondas).
// Fechas relativas a "hoy" para que el panel se vea vigente.
import { demoDays } from "./demoData.js";

export const COACH_AUTH_ID = "demo-entrenador-0001";
export const COACH_STORE_ID = "entrenador_principal";
export const COACH_NAME = "Entrenador Demo";

const fecha = (d) => d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
const daysAgo = (n, h) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h == null ? 10 : h, 30, 0, 0); return d; };

export const COACH_ALUMNOS = [
  { id: "demo-alu-ana", nombre: "Ana Demo", email: "ana@ejemplo.invalid", entrenador_id: COACH_STORE_ID, ultimo_pago_confirmado: fecha(daysAgo(3)) },
  { id: "demo-alu-beto", nombre: "Beto Demo", email: "beto@ejemplo.invalid", entrenador_id: COACH_STORE_ID, ultimo_pago_confirmado: fecha(daysAgo(10)) },
  { id: "demo-alu-cami", nombre: "Cami Demo", email: "cami@ejemplo.invalid", entrenador_id: COACH_STORE_ID, ultimo_pago_confirmado: fecha(daysAgo(40)) },
  { id: "demo-alu-dani", nombre: "Dani Demo", email: "dani@ejemplo.invalid", entrenador_id: COACH_STORE_ID, ultimo_pago_confirmado: null },
];

const rutina = (id, nombre, alumnoId, semana, plantilla) => ({
  id, nombre, entrenador_id: COACH_AUTH_ID, alumno_id: alumnoId, es_plantilla: !!plantilla,
  datos: { alumno: alumnoId ? COACH_ALUMNOS.find((a) => a.id === alumnoId).nombre : "", note: "Rutina de demostración (datos ficticios).", days: demoDays(), semana_activa: semana || 1 },
});

export const COACH_RUTINAS = [
  rutina("demo-rut-plantilla-1", "Plantilla Fuerza base", null, 1, true),
  rutina("demo-rut-plantilla-2", "Plantilla Hipertrofia", null, 1, true),
  rutina("demo-rut-ana", "Fuerza base · Ana", "demo-alu-ana", 2),
  rutina("demo-rut-beto", "Hipertrofia · Beto", "demo-alu-beto", 3),
  rutina("demo-rut-cami", "Fuerza base · Cami", "demo-alu-cami", 1),
];

export function coachSesiones() {
  const days = demoDays();
  const mk = (alumnoId, rutId, rutNombre, dIdx, semana, ago) => {
    const d = daysAgo(ago);
    return { id: "demo-ses-" + alumnoId + "-" + semana + "-" + dIdx, alumno_id: alumnoId, rutina_id: rutId, rutina_nombre: rutNombre, dia_label: days[dIdx].label, dia_idx: dIdx, semana, fecha: fecha(d), hora: "10:30", ejercicios: days[dIdx].exercises.map((e) => e.id).join(","), created_at: d.toISOString() };
  };
  return [
    mk("demo-alu-ana", "demo-rut-ana", "Fuerza base · Ana", 0, 2, 1),
    mk("demo-alu-ana", "demo-rut-ana", "Fuerza base · Ana", 2, 1, 5),
    mk("demo-alu-ana", "demo-rut-ana", "Fuerza base · Ana", 1, 1, 8),
    mk("demo-alu-ana", "demo-rut-ana", "Fuerza base · Ana", 0, 1, 11),
    mk("demo-alu-beto", "demo-rut-beto", "Hipertrofia · Beto", 1, 3, 2),
    mk("demo-alu-beto", "demo-rut-beto", "Hipertrofia · Beto", 0, 3, 4),
    mk("demo-alu-cami", "demo-rut-cami", "Fuerza base · Cami", 0, 1, 35),
  ];
}

const BASE = { sq: 60, rdl: 50, bsq: 20, calf: 40, bp: 40, row: 40, ohp: 25, curl: 12, dl: 80, dbp: 16, lunge: 14, plank: 0 };
export function coachProgreso() {
  const rows = [];
  const days = demoDays();
  const plan = [["demo-alu-ana", 11, 0], ["demo-alu-ana", 8, 1], ["demo-alu-ana", 5, 2], ["demo-alu-ana", 1, 0], ["demo-alu-beto", 4, 0], ["demo-alu-beto", 2, 1], ["demo-alu-cami", 35, 0]];
  plan.forEach(([alumnoId, ago, dIdx], i) => {
    days[dIdx].exercises.forEach((e) => {
      for (let s = 0; s < 3; s++) {
        const d = daysAgo(ago); d.setMinutes(d.getMinutes() + s * 4);
        rows.push({ id: "demo-pg-" + i + "-" + e.id + "-" + s, alumno_id: alumnoId, ejercicio_id: e.id, kg: BASE[e.id] + (i % 3) * 2.5, reps: e.id === "plank" ? 45 : 8, nota: "", fecha: fecha(d), semana: 0, created_at: d.toISOString() });
      }
    });
  });
  return rows;
}

// Mensajes: Beto escribio y no fueron leidos; hay una conversacion con Ana ya leida.
export function coachMensajes() {
  const m = (id, alumnoId, nombre, deEntrenador, texto, ago, leido) => ({ id, alumno_id: alumnoId, nombre, de_entrenador: deEntrenador, texto, leido, created_at: new Date(daysAgo(0).getTime() - ago * 3600 * 1000).toISOString().slice(0, 19) });
  return [
    m("demo-msg-1", "demo-alu-beto", "Beto Demo", false, "¿Puedo cambiar el día de piernas a mañana?", 2, false),
    m("demo-msg-2", "demo-alu-beto", "Beto Demo", false, "Me quedó molestia en el hombro, ¿bajo la carga?", 1, false),
    m("demo-msg-3", "demo-alu-ana", "Ana Demo", false, "Listo, terminé la semana 1.", 30, true),
    m("demo-msg-4", "demo-alu-ana", "Entrenador", true, "¡Muy bien! Seguimos con la semana 2.", 29, true),
  ];
}
