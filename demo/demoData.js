// Datos 100% ficticios para la demo de la interfaz del alumno. Ninguna persona, cuenta, rutina ni medicion real: nombres inventados y
// cargas redondas. Las fechas son relativas a "hoy" para que el historial se vea reciente.
export const DEMO_ALUMNO_ID = "demo-alumno-0001";
export const DEMO_RUTINA_ID = "demo-rutina-0001";
export const DEMO_NAME = "Alumno Demo";

const ex = (id, sets, reps, pause) => ({ id, sets: String(sets), reps: String(reps), kg: "", pause, note: "", weeks: [] });

export function demoDays() {
  return [
    { label: "Tren inferior", warmup: [], exercises: [ex("sq", 4, "6-8", 120), ex("rdl", 3, "8-10", 90), ex("bsq", 3, "10", 90), ex("calf", 3, "12-15", 60)] },
    { label: "Tren superior", warmup: [], exercises: [ex("bp", 4, "6-8", 120), ex("row", 4, "8-10", 90), ex("ohp", 3, "8-10", 90), ex("curl", 3, "10-12", 60)] },
    { label: "Cuerpo completo", warmup: [], exercises: [ex("dl", 3, "5", 150), ex("dbp", 3, "10", 90), ex("lunge", 3, "10", 60), ex("plank", 3, "45s", 45)] },
  ];
}

export function demoRutinaRow() {
  return {
    id: DEMO_RUTINA_ID,
    nombre: "Plan Demo - Fuerza base",
    alumno_id: DEMO_ALUMNO_ID,
    datos: { alumno: DEMO_NAME, note: "Rutina de demostracion con datos ficticios.", days: demoDays(), semana_activa: 2 },
  };
}

const fecha = (d) => d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 30, 0, 0); return d; };

// Semana 1 completa (3 dias) hace ~7-12 dias; la Semana 2 queda abierta para entrenar hoy.
export function demoSesiones() {
  const days = demoDays();
  const mk = (n, dIdx, semana) => {
    const d = daysAgo(n);
    return {
      id: "demo-ses-" + semana + "-" + dIdx, alumno_id: DEMO_ALUMNO_ID, rutina_id: DEMO_RUTINA_ID, rutina_nombre: "Plan Demo - Fuerza base",
      dia_label: days[dIdx].label, dia_idx: dIdx, semana, fecha: fecha(d), hora: "10:30",
      ejercicios: days[dIdx].exercises.map((e) => e.id).join(","), created_at: d.toISOString(),
    };
  };
  return [mk(12, 0, 1), mk(10, 1, 1), mk(8, 2, 1)].reverse();
}

const BASE = { sq: 60, rdl: 50, bsq: 20, calf: 40, bp: 40, row: 40, ohp: 25, curl: 12, dl: 80, dbp: 16, lunge: 14, plank: 0 };
// Filas de `progreso` de la Semana 1 (semana base 0): 3 series por ejercicio.
export function demoProgresoRows() {
  const rows = [];
  const days = demoDays();
  const when = [12, 10, 8];
  days.forEach((day, dIdx) => {
    day.exercises.forEach((e) => {
      for (let s = 0; s < 3; s++) {
        const d = daysAgo(when[dIdx]); d.setMinutes(d.getMinutes() + s * 4);
        rows.push({ id: "demo-pg-" + e.id + "-" + s, alumno_id: DEMO_ALUMNO_ID, ejercicio_id: e.id, kg: BASE[e.id], reps: e.id === "plank" ? 45 : 8, nota: "", fecha: fecha(d), semana: 0, created_at: d.toISOString() });
      }
    });
  });
  return rows;
}

export function demoPagoConfirmado() { return fecha(new Date()); }
