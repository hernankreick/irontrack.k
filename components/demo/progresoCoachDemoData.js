// Datos FICTICIOS de la demostración de Progreso del entrenador (demo/progreso-coach.html, solo Preview).
// Nada de esto sale de Supabase ni se guarda: se genera en memoria, relativo a "hoy", con la misma forma que las filas reales
// (sesiones: fecha d/m/yyyy, semana 1-based, dia_idx, ciclo, origen; progreso: fecha d/m/yyyy, semana 0-based, rutina_id, ciclo).
//
// Alumnos (A–Z):
//   Abril Méndez  activa · 2 rutinas (Base -> Fuerza) · 2 ciclos de Fuerza · PRs · ejercicio personalizado y por tiempo · 1 validada
//   Carla Sosa    inactiva (última sesión hace 23 días)
//   Diego Lima    rutina asignada hace 5 días · solo primeras marcas (0 PRs)
//   Julián Paz    estancado: récord hace más de 3 semanas, entrena pero sin superarlo (iguala)
//   Martina Vega  sin rutina asignada · registros de una rutina anterior
//   Tomás Ruiz    activo, alta adherencia, PRs

function dia(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}
function fecha(n) {
  const d = dia(n);
  return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
}
function iso(n, minutos) {
  return new Date(dia(n).getTime() - 2 * 3600000 + (minutos || 0) * 60000).toISOString();
}

export const DEMO_CATALOGO = [
  { id: "demo-sq", name: "Sentadilla", nameEn: "Back squat", pattern: "rodilla" },
  { id: "demo-bp", name: "Press banca", nameEn: "Bench press", pattern: "empuje" },
  { id: "demo-dl", name: "Peso muerto", nameEn: "Deadlift", pattern: "bisagra" },
  { id: "demo-rdl", name: "Peso muerto rumano", nameEn: "Romanian deadlift", pattern: "bisagra" },
  { id: "demo-row", name: "Remo con barra", nameEn: "Barbell row", pattern: "traccion" },
  { id: "demo-ohp", name: "Press militar", nameEn: "Overhead press", pattern: "empuje" },
  { id: "demo-hip", name: "Hip thrust", nameEn: "Hip thrust", pattern: "bisagra" },
  { id: "demo-plank", name: "Plancha", nameEn: "Plank", pattern: "core", duration: "45 seg" },
  { id: "custom_demo_remo", name: "Remo con mancuerna (personalizado)", nameEn: "Dumbbell row (custom)", pattern: "traccion", custom: true },
];

const ALUMNOS = [
  { id: "demo-abril", nombre: "Abril Méndez", email: "abril@demo.invalid" },
  { id: "demo-carla", nombre: "Carla Sosa", email: "carla@demo.invalid" },
  { id: "demo-diego", nombre: "Diego Lima", email: "diego@demo.invalid" },
  { id: "demo-julian", nombre: "Julián Paz", email: "julian@demo.invalid" },
  { id: "demo-martina", nombre: "Martina Vega", email: "martina@demo.invalid" },
  { id: "demo-tomas", nombre: "Tomás Ruiz", email: "tomas@demo.invalid" },
];

const ex = (id, reps) => (reps ? { id, reps } : { id });
const dias = (...listas) => listas.map((l, i) => ({ label: "Día " + (i + 1), warmup: l.warmup || [], exercises: l.exercises || l }));

/** Construye rutinas, sesiones y series en memoria. Llamar en cada carga de la página (fechas relativas a hoy). */
export function buildProgresoDemoData() {
  const rutinas = [
    { id: "demo-r-abril-base", alumno_id: "demo-abril", nombre: "Base", created_at: iso(110), datos: { days: dias([ex("demo-sq"), ex("demo-bp"), ex("demo-row")]) } },
    {
      id: "demo-r-abril-fuerza", alumno_id: "demo-abril", nombre: "Fuerza", created_at: iso(52),
      datos: { ciclo_actual: 2, days: dias([ex("demo-sq"), ex("demo-rdl")], [ex("demo-bp"), ex("custom_demo_remo")], { warmup: [ex("demo-plank", '45"')], exercises: [ex("demo-dl"), ex("demo-ohp")] }) },
    },
    { id: "demo-r-tomas", alumno_id: "demo-tomas", nombre: "Hipertrofia", created_at: iso(30), datos: { days: dias([ex("demo-bp"), ex("demo-ohp")], [ex("demo-sq"), ex("demo-hip")], [ex("demo-row")], [ex("demo-dl")]) } },
    { id: "demo-r-julian", alumno_id: "demo-julian", nombre: "Fuerza básica", created_at: iso(75), datos: { days: dias([ex("demo-sq"), ex("demo-bp")], [ex("demo-dl"), ex("demo-row")]) } },
    { id: "demo-r-carla", alumno_id: "demo-carla", nombre: "Movilidad + fuerza", created_at: iso(60), datos: { days: dias([ex("demo-sq"), ex("demo-row")], { warmup: [ex("demo-plank", '45"')], exercises: [ex("demo-bp")] }) } },
    { id: "demo-r-diego", alumno_id: "demo-diego", nombre: "Inicio", created_at: iso(5), datos: { days: dias([ex("demo-sq"), ex("demo-bp")], [ex("demo-dl"), ex("demo-ohp")]) } },
  ];

  const sesiones = [];
  const progreso = [];

  /**
   * Una sesión completada y sus series. series: { ejercicioId: [[kg, reps], ...] } (orden de ejecución).
   * validada = el entrenador la validó sin series (origen "validada_coach").
   */
  function sesion(alumnoId, rutinaId, nombreRutina, n, semana, diaIdx, ciclo, series, validada) {
    const ids = Object.keys(series || {});
    sesiones.push({
      id: "demo-ses-" + sesiones.length,
      alumno_id: alumnoId,
      rutina_id: rutinaId,
      rutina_nombre: nombreRutina,
      fecha: fecha(n),
      created_at: iso(n, 70),
      semana: semana,
      dia_idx: diaIdx,
      ciclo: ciclo,
      ejercicios: validada ? "" : ids.join(","),
      origen: validada ? "validada_coach" : "app",
    });
    let k = 0;
    ids.forEach((id) => {
      series[id].forEach(([kg, reps]) => {
        progreso.push({
          id: "demo-pr-" + progreso.length,
          alumno_id: alumnoId,
          ejercicio_id: id,
          rutina_id: rutinaId,
          kg: String(kg),
          reps: String(reps),
          fecha: fecha(n),
          semana: semana != null ? semana - 1 : null,
          ciclo: ciclo,
          created_at: iso(n, k++),
        });
      });
    });
  }
  const tres = (kg, reps) => [[kg - 5, reps], [kg - 2.5, reps], [kg, reps]];

  // ---- Abril: rutina Base (6 semanas) -> Fuerza ciclo 1 (4 semanas) -> Fuerza ciclo 2 (semana 3 en curso)
  [[100, 60, 40, 40], [93, 65, 42.5, 42.5], [86, 67.5, 42.5, 45], [79, 70, 45, 45], [72, 72.5, 45, 47.5], [65, 75, 47.5, 50]].forEach(([n, sq, bp, row], i) => {
    sesion("demo-abril", "demo-r-abril-base", "Base", n, (i % 4) + 1, 0, 1, { "demo-sq": tres(sq, 5), "demo-bp": tres(bp, 8), "demo-row": tres(row, 8) });
  });
  const fz = (n, sem, d, ciclo, series, validada) => sesion("demo-abril", "demo-r-abril-fuerza", "Fuerza", n, sem, d, ciclo, series, validada);
  const c1 = { sq: [75, 77.5, 80, 82.5], rdl: [60, 62.5, 65, 65], bp: [47.5, 50, 50, 52.5], cu: [18, 20, 20, 22], dl: [100, 105, 110, 110], ohp: [30, 32.5, 32.5, 35] };
  for (let w = 0; w < 4; w++) {
    const base = 50 - w * 7;
    fz(base, w + 1, 0, 1, { "demo-sq": tres(c1.sq[w], 5), "demo-rdl": tres(c1.rdl[w], 8) });
    fz(base - 2, w + 1, 1, 1, { "demo-bp": tres(c1.bp[w], 8), custom_demo_remo: [[c1.cu[w], 12], [c1.cu[w], 12]] });
    fz(base - 4, w + 1, 2, 1, { "demo-plank": [[0, 40 + w * 5]], "demo-dl": tres(c1.dl[w], 5), "demo-ohp": tres(c1.ohp[w], 8) });
  }
  const c2 = { sq: [80, 85, 87.5], rdl: [65, 67.5, 70], bp: [50, 52.5, 55], cu: [20, 22, 24], dl: [105, 110, 115], ohp: [32.5, 35, 35] };
  for (let w = 0; w < 3; w++) {
    const base = 20 - w * 7;
    fz(base, w + 1, 0, 2, { "demo-sq": tres(c2.sq[w], 5), "demo-rdl": tres(c2.rdl[w], 8) });
    if (w < 2) fz(base - 2, w + 1, 1, 2, { "demo-bp": tres(c2.bp[w], 8), custom_demo_remo: [[c2.cu[w], 12], [c2.cu[w], 12]] });
    if (w === 1) fz(base - 4, w + 1, 2, 2, {}, true); // validada por el entrenador, sin series
    else if (w === 0) fz(base - 4, w + 1, 2, 2, { "demo-plank": [[10, 30]], "demo-dl": tres(c2.dl[w], 5), "demo-ohp": tres(c2.ohp[w], 8) });
  }

  // ---- Tomás: 4 semanas casi completas (4 días por semana), progresión con PRs
  const tm = { bp: [70, 72.5, 75, 77.5], ohp: [45, 45, 47.5, 50], sq: [100, 105, 107.5, 110], hip: [120, 130, 135, 140], row: [65, 67.5, 70, 70], dl: [140, 145, 150, 155] };
  for (let w = 0; w < 4; w++) {
    const base = 27 - w * 7;
    const t = (n, d, s) => sesion("demo-tomas", "demo-r-tomas", "Hipertrofia", n, w + 1, d, 1, s);
    t(base, 0, { "demo-bp": tres(tm.bp[w], 8), "demo-ohp": tres(tm.ohp[w], 8) });
    t(base - 1, 1, { "demo-sq": tres(tm.sq[w], 6), "demo-hip": tres(tm.hip[w], 10) });
    if (w !== 1) t(base - 3, 2, { "demo-row": tres(tm.row[w], 10) });
    if (base - 4 >= 0) t(base - 4, 3, { "demo-dl": tres(tm.dl[w], 5) });
  }

  // ---- Julián: sube hasta hace 5 semanas y después iguala o queda por debajo (estancado)
  [[70, 85, 60, 120, 60], [63, 90, 62.5, 125, 62.5], [56, 95, 65, 130, 65], [49, 97.5, 67.5, 135, 65], [42, 100, 70, 140, 67.5],
   [28, 95, 67.5, 135, 65], [21, 97.5, 67.5, 140, 67.5], [14, 100, 70, 135, 67.5], [7, 100, 67.5, 140, 65], [2, 97.5, 70, 140, 67.5]].forEach(([n, sq, bp, dl, row], i) => {
    const ciclo = i < 5 ? 1 : 2;
    const sem = (i % 5) + 1 > 4 ? 4 : (i % 5) + 1;
    sesion("demo-julian", "demo-r-julian", "Fuerza básica", n, sem, 0, ciclo, { "demo-sq": tres(sq, 5), "demo-bp": tres(bp, 5) });
    sesion("demo-julian", "demo-r-julian", "Fuerza básica", n - 1 < 0 ? 0 : n - 1, sem, 1, ciclo, { "demo-dl": tres(dl, 3), "demo-row": tres(row, 8) });
  });

  // ---- Carla: entrenó un mes y dejó de venir hace 23 días
  [[58, 50, 35, 30], [51, 52.5, 35, 32.5], [44, 55, 37.5, 32.5], [37, 55, 37.5, 35], [30, 57.5, 40, 35], [23, 57.5, 40, 35]].forEach(([n, sq, row, bp], i) => {
    sesion("demo-carla", "demo-r-carla", "Movilidad + fuerza", n, (i % 4) + 1, 0, 1, { "demo-sq": tres(sq, 8), "demo-row": tres(row, 10) });
    if (i < 5) sesion("demo-carla", "demo-r-carla", "Movilidad + fuerza", n - 2, (i % 4) + 1, 1, 1, { "demo-plank": [[0, 30 + i * 5]], "demo-bp": tres(bp, 10) });
  });

  // ---- Martina: sin rutina asignada hoy; registros de una rutina que ya no existe
  [[45, 40, 25], [38, 42.5, 27.5], [31, 45, 27.5]].forEach(([n, sq, bp], i) => {
    sesion("demo-martina", "demo-r-martina-anterior", "Rutina anterior", n, i + 1, 0, 1, { "demo-sq": tres(sq, 10), "demo-bp": tres(bp, 10) });
  });

  // ---- Diego: rutina asignada hace 5 días, dos sesiones = solo primeras marcas
  sesion("demo-diego", "demo-r-diego", "Inicio", 4, 1, 0, 1, { "demo-sq": tres(60, 8), "demo-bp": tres(45, 8) });
  sesion("demo-diego", "demo-r-diego", "Inicio", 2, 1, 1, 1, { "demo-dl": tres(90, 5), "demo-ohp": tres(30, 8) });

  // Mismo orden que entrega el cargador real (lib/coachHistoryLoader.js): created_at descendente, progreso agrupado por alumno.
  const desc = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
  sesiones.sort(desc);
  progreso.sort(desc);
  const progresoGlobal = {};
  progreso.forEach((r) => { (progresoGlobal[r.alumno_id] = progresoGlobal[r.alumno_id] || []).push(r); });

  return {
    alumnos: ALUMNOS.map((a) => Object.assign({}, a)),
    rutinasSBEntrenador: rutinas,
    sesionesGlobales: sesiones,
    progresoGlobal: progresoGlobal,
    allEx: DEMO_CATALOGO,
    historiaCompleta: { sesiones: true, progreso: true },
  };
}
