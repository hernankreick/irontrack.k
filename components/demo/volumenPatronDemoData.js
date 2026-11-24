// Datos FICTICIOS para «Volumen por patrón» por rutina, ciclo y semana (demo/progreso-coach.html?patron=historial, solo Preview).
// Nada sale de un servidor real ni se guarda. Forma de las filas = la de los datos REALES: `progreso` SIN rutina_id (solo alumno_id,
// ejercicio_id, kg, reps, fecha d/m/yyyy, semana 0-based y ciclo); `sesiones` con rutina_id, ciclo, semana 1-based, dia_idx y `ejercicios`.
//
// Ana Historial
//   Fuerza base (anterior, 4 semanas): ciclo 1 = S1 y S2 completas (2 sesiones), S3 incompleta (1 sesión), S4 sin sesiones;
//                                      ciclo 2 (rutina reiniciada) = solo S1.
//   Hipertrofia (vigente, 4 semanas):  semana activa 3; S1 y S2 completas, S3 en curso (1 sesión), S4 sin sesiones.
//   Casos de borde: 1 serie sin sesión que la respalde (ciclo 2 de Fuerza base: no se asigna) y 1 serie respaldada por sesiones de DOS rutinas (ambigua, no se asigna).
// Beto Otro: mismas fechas y ejercicios, otras rutinas y otros kg: no debe mezclarse con Ana.

function dia(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
const fecha = (n) => {
  const d = dia(n);
  return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
};
const iso = (n, min) => new Date(dia(n).getTime() - 2 * 3600000 + (min || 0) * 60000).toISOString();

export const HP_CATALOGO = [
  { id: "hp-sq", name: "Sentadilla", nameEn: "Back squat", pattern: "rodilla" },
  { id: "hp-bp", name: "Press banca", nameEn: "Bench press", pattern: "empuje" },
  { id: "hp-ohp", name: "Press militar", nameEn: "Overhead press", pattern: "empuje" },
  { id: "hp-dl", name: "Peso muerto", nameEn: "Deadlift", pattern: "bisagra" },
  { id: "hp-row", name: "Remo con barra", nameEn: "Barbell row", pattern: "traccion" },
  { id: "hp-abs", name: "Crunch con carga", nameEn: "Weighted crunch", pattern: "core" },
];

export const HP_ANA = "demo-ana-historial";
export const HP_BETO = "demo-beto-otro";

/**
 * Especificación de sesiones (única fuente de verdad de la demo y de las pruebas).
 * Cada sesión: { alumno, rutina, nombre, n (días atrás), ciclo, semana (1-based), dia, series: [[ejercicio, kg, reps, cantidad], ...] }
 */
export const HP_SESIONES = [
  // ---- Ana · Fuerza base · ciclo 1
  { alumno: HP_ANA, rutina: "hp-r-fuerza", nombre: "Fuerza base", n: 150, ciclo: 1, semana: 1, dia: 0, series: [["hp-sq", 80, 5, 3], ["hp-bp", 50, 8, 3]] },
  { alumno: HP_ANA, rutina: "hp-r-fuerza", nombre: "Fuerza base", n: 148, ciclo: 1, semana: 1, dia: 1, series: [["hp-dl", 100, 5, 3], ["hp-row", 50, 8, 3]] },
  { alumno: HP_ANA, rutina: "hp-r-fuerza", nombre: "Fuerza base", n: 143, ciclo: 1, semana: 2, dia: 0, series: [["hp-sq", 85, 5, 3], ["hp-bp", 52.5, 8, 3]] },
  { alumno: HP_ANA, rutina: "hp-r-fuerza", nombre: "Fuerza base", n: 141, ciclo: 1, semana: 2, dia: 1, series: [["hp-dl", 105, 5, 3], ["hp-row", 52.5, 8, 3]] },
  { alumno: HP_ANA, rutina: "hp-r-fuerza", nombre: "Fuerza base", n: 136, ciclo: 1, semana: 3, dia: 0, series: [["hp-sq", 90, 5, 3], ["hp-bp", 55, 8, 3]] },
  // ---- Ana · Fuerza base · ciclo 2 (rutina reiniciada)
  { alumno: HP_ANA, rutina: "hp-r-fuerza", nombre: "Fuerza base", n: 120, ciclo: 2, semana: 1, dia: 0, series: [["hp-sq", 85, 5, 3], ["hp-bp", 52.5, 8, 3], ["hp-abs", 10, 12, 3]] },
  // ---- Ana · Hipertrofia (vigente)
  { alumno: HP_ANA, rutina: "hp-r-hiper", nombre: "Hipertrofia", n: 42, ciclo: 1, semana: 1, dia: 0, series: [["hp-sq", 60, 10, 4], ["hp-bp", 40, 10, 4], ["hp-abs", 10, 15, 3]] },
  { alumno: HP_ANA, rutina: "hp-r-hiper", nombre: "Hipertrofia", n: 40, ciclo: 1, semana: 1, dia: 1, series: [["hp-dl", 80, 10, 3], ["hp-row", 45, 10, 4]] },
  { alumno: HP_ANA, rutina: "hp-r-hiper", nombre: "Hipertrofia", n: 35, ciclo: 1, semana: 2, dia: 0, series: [["hp-sq", 65, 10, 4], ["hp-bp", 42.5, 10, 4], ["hp-abs", 12.5, 15, 3]] },
  { alumno: HP_ANA, rutina: "hp-r-hiper", nombre: "Hipertrofia", n: 33, ciclo: 1, semana: 2, dia: 1, series: [["hp-dl", 85, 10, 3], ["hp-row", 47.5, 10, 4]] },
  { alumno: HP_ANA, rutina: "hp-r-hiper", nombre: "Hipertrofia", n: 3, ciclo: 1, semana: 3, dia: 0, series: [["hp-sq", 67.5, 10, 4], ["hp-bp", 45, 10, 4]] },
  // ---- Ana · caso ambiguo: el mismo día, semana y ciclo, DOS rutinas listan el press militar
  { alumno: HP_ANA, rutina: "hp-r-fuerza", nombre: "Fuerza base", n: 28, ciclo: 1, semana: 2, dia: 2, series: [], solo: ["hp-ohp"] },
  { alumno: HP_ANA, rutina: "hp-r-hiper", nombre: "Hipertrofia", n: 28, ciclo: 1, semana: 2, dia: 2, series: [["hp-ohp", 40, 5, 1]] },
  // ---- Beto: mismas fechas, ciclo y semana que Ana, otras rutinas y otros kg
  { alumno: HP_BETO, rutina: "hp-r-fuerza-beto", nombre: "Fuerza base", n: 150, ciclo: 1, semana: 1, dia: 0, series: [["hp-sq", 120, 5, 3], ["hp-bp", 90, 5, 3]] },
  { alumno: HP_BETO, rutina: "hp-r-fuerza-beto", nombre: "Fuerza base", n: 143, ciclo: 1, semana: 2, dia: 0, series: [["hp-sq", 125, 5, 3], ["hp-bp", 92.5, 5, 3]] },
  { alumno: HP_BETO, rutina: "hp-r-hiper-beto", nombre: "Hipertrofia", n: 42, ciclo: 1, semana: 1, dia: 0, series: [["hp-sq", 100, 8, 4], ["hp-bp", 80, 8, 4]] },
];

/** Series de Ana sin ninguna sesión que las respalde (no se asignan a rutina alguna). */
export const HP_HUERFANAS = [{ alumno: HP_ANA, n: 118, ciclo: 2, semana: 1, ejercicio: "hp-sq", kg: 100, reps: 5 }];

export function buildVolumenPatronDemoData(opts) {
  const ex = (...ids) => ids.map((id) => ({ id }));
  const dias = (...listas) => listas.map((l, i) => ({ label: "Día " + (i + 1), warmup: [], exercises: ex(...l) }));
  const rutinas = [
    { id: "hp-r-fuerza", alumno_id: HP_ANA, nombre: "Fuerza base", created_at: iso(160), datos: { ciclo_actual: 2, ciclo_base: 2, semana_activa: 1, days: dias(["hp-sq", "hp-bp", "hp-abs"], ["hp-dl", "hp-row"], ["hp-ohp"]) } },
    { id: "hp-r-hiper", alumno_id: HP_ANA, nombre: "Hipertrofia", created_at: iso(45), datos: { semana_activa: 3, days: dias(["hp-sq", "hp-bp", "hp-abs"], ["hp-dl", "hp-row"], ["hp-ohp"]) } },
    { id: "hp-r-fuerza-beto", alumno_id: HP_BETO, nombre: "Fuerza base", created_at: iso(160), datos: { days: dias(["hp-sq", "hp-bp"], ["hp-dl"]) } },
    { id: "hp-r-hiper-beto", alumno_id: HP_BETO, nombre: "Hipertrofia", created_at: iso(45), datos: { semana_activa: 1, days: dias(["hp-sq", "hp-bp"], ["hp-dl"]) } },
  ];
  const sesiones = [];
  const progreso = [];
  HP_SESIONES.forEach((s, i) => {
    const ids = s.solo ? s.solo : Array.from(new Set(s.series.map((x) => x[0])));
    sesiones.push({
      id: "hp-ses-" + i, alumno_id: s.alumno, rutina_id: s.rutina, rutina_nombre: s.nombre, fecha: fecha(s.n), created_at: iso(s.n, 70),
      semana: s.semana, dia_idx: s.dia, ciclo: s.ciclo, ejercicios: ids.join(","), origen: "app",
    });
    let k = 0;
    s.series.forEach(([ej, kg, reps, cant]) => {
      for (let j = 0; j < cant; j++) {
        progreso.push({ id: "hp-pr-" + progreso.length, alumno_id: s.alumno, ejercicio_id: ej, kg: String(kg), reps: String(reps), fecha: fecha(s.n), semana: s.semana - 1, ciclo: s.ciclo, created_at: iso(s.n, k++) });
      }
    });
  });
  HP_HUERFANAS.forEach((h) => {
    progreso.push({ id: "hp-pr-" + progreso.length, alumno_id: h.alumno, ejercicio_id: h.ejercicio, kg: String(h.kg), reps: String(h.reps), fecha: fecha(h.n), semana: h.semana - 1, ciclo: h.ciclo, created_at: iso(h.n, 5) });
  });
  const desc = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
  sesiones.sort(desc);
  progreso.sort(desc);
  const progresoGlobal = {};
  progreso.forEach((r) => { (progresoGlobal[r.alumno_id] = progresoGlobal[r.alumno_id] || []).push(r); });
  return {
    alumnos: [
      { id: HP_ANA, nombre: "Ana Historial", email: "ana@demo.invalid" },
      { id: HP_BETO, nombre: "Beto Otro", email: "beto@demo.invalid" },
    ],
    rutinasSBEntrenador: rutinas,
    sesionesGlobales: sesiones,
    progresoGlobal,
    allEx: HP_CATALOGO,
    // `incompleto`: simula que el historial no se pudo cargar completo (solo demo; no cambia los datos).
    historiaCompleta: opts && opts.incompleto ? { sesiones: true, progreso: false } : { sesiones: true, progreso: true },
  };
}
