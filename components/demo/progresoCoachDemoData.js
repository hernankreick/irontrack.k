// Datos FICTICIOS de la demostración de Progreso del entrenador (demo/progreso-coach.html, solo Preview).
// Nada de esto sale de Supabase ni se guarda: se genera en memoria, relativo a "hoy", con la misma forma que las filas reales
// (sesiones: fecha d/m/yyyy, semana 1-based, dia_idx, ciclo, origen; progreso: fecha d/m/yyyy, semana 0-based, rutina_id, ciclo).
//
// Alumnos (A–Z):
//   Abril Méndez  activa · 3 rutinas (Inicial hace ~7 meses -> Base -> Fuerza) · 2 ciclos de Fuerza · PRs · ejercicio personalizado y por tiempo · 1 validada
//   Alumno A Demo sentadilla 100 kg, 5.000 kg/semana, adherencia 80 % (16 de 20) · Alumno B Demo sentadilla 60 kg, 2.000 kg/semana, 50 % (8 de 16)
//   Alumno C Demo rutina asignada y SIN ningún registro (estados vacíos)
//   Carla Sosa    inactiva (última sesión hace 23 días)
//   Diego Lima    rutina asignada hace 5 días · solo primeras marcas (0 PRs)
//   Julián Paz    estancado: récord hace más de 3 semanas, entrena pero sin superarlo (iguala) · 3 ciclos (rutina vigente: ciclo 3, semana 2)
//   Martina Vega  sin rutina asignada · registros de una rutina anterior
//   Tomás Ruiz    activo, alta adherencia, PRs

import { volumenEnRango } from "../../lib/metricas/volumen.js";
import { indiceEjerciciosPorTiempo } from "../../lib/metricas/tipoCarga.js";
import { diaLocal } from "../../lib/metricas/fechas.js";

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

// ---- Escenario ?volumen=comparar (D7.3, solo demo): un alumno con el caso de referencia de un día.
export const VOL_ALUMNO_ID = "demo-vol";
export const VOL_CATALOGO = [
  { id: "vol-sq", name: "Sentadilla", nameEn: "Back squat", pattern: "rodilla", equipment: "Barra" },
  { id: "custom_vol_x", name: "Ejercicio personalizado", nameEn: "Custom exercise", pattern: "traccion", custom: true },
  { id: "vol-pu", name: "Dominadas con lastre", nameEn: "Weighted pull-up", pattern: "traccion", equipment: "Barra fija" },
  { id: "vol-plank", name: "Plancha con peso", nameEn: "Weighted plank", pattern: "core", equipment: "Libre" },
  { id: "vol-kuohp", name: "Press militar unilateral", nameEn: "Single-arm overhead press", pattern: "empuje", equipment: "Libre" },
  { id: "vol-lunge", name: "Zancada", nameEn: "Lunge", pattern: "rodilla", equipment: "Libre" },
];
// [ejercicio, [[kg, reps], ...]] de hoy y de hace 7 días.
const VOL_HOY = [["vol-sq", [[100, 5], [100, 5]]], ["custom_vol_x", [[40, 10]]], ["vol-pu", [[10, 8]]], ["vol-plank", [[10, 45]]], ["vol-kuohp", [[20, 10]]], ["vol-lunge", [[16, 10]]]];
const VOL_SEM_PASADA = [["vol-sq", [[95, 5], [95, 5]]], ["custom_vol_x", [[37.5, 10]]], ["vol-pu", [[10, 6]]], ["vol-plank", [[10, 40]]], ["vol-kuohp", [[17.5, 10]]], ["vol-lunge", [[14, 10]]]];

const num = (v) => parseFloat(v) || 0;
const VOL_FUERZA = ["rodilla", "empuje", "traccion", "bisagra"];
// Réplica de la definición anterior, solo demo: A, entrenador (Progreso) = Σ kg×reps con kg>0 y reps>0, sin ejercicios por tiempo.
export function volumenAntesA(rows, catalogo, rutinas) {
  const t = indiceEjerciciosPorTiempo(catalogo, rutinas);
  return rows.reduce((a, r) => (num(r.kg) > 0 && num(r.reps) > 0 && !t[String(r.ejercicio_id)] ? a + num(r.kg) * num(r.reps) : a), 0);
}
// Réplica de la definición anterior, solo demo: B, tarjeta «Volumen de entrenamiento» del alumno = solo catálogo con patrón de fuerza,
// sin equipo Libre/Banco/Paralelas y sin coincidencia con peso corporal; excluía los personalizados.
export function volumenAntesB(rows, catalogo) {
  const porId = {};
  catalogo.forEach((e) => { porId[String(e.id)] = e; });
  return rows.reduce((a, r) => {
    const e = porId[String(r.ejercicio_id)];
    if (!e || e.custom || String(r.ejercicio_id).indexOf("custom_") === 0) return a;
    if (VOL_FUERZA.indexOf(e.pattern) < 0) return a;
    if (/^(libre|banco|paralelas)/i.test(e.equipment || "")) return a;
    if (/dominada|pull.?up|flexion|push.?up|fondos|dips|plancha|plank|peso corporal|bodyweight/i.test((e.name || "") + " " + (e.nameEn || ""))) return a;
    return num(r.kg) > 0 ? a + num(r.kg) * num(r.reps) : a;
  }, 0);
}
// Réplica de la definición anterior, solo demo: C, «t esta semana» del alumno = kg×reps de toda fila con kg>0 (incluye tiempo: kg×segundos).
export function volumenAntesC(rows) {
  return rows.reduce((a, r) => (num(r.kg) > 0 ? a + num(r.kg) * num(r.reps) : a), 0);
}
// Réplica de la definición anterior, solo demo: D, resumen de la sesión = kg×reps sin ningún filtro (kg negativo resta).
export function volumenAntesD(rows) {
  return rows.reduce((a, r) => a + num(r.kg) * num(r.reps), 0);
}

/** Comparación antes/ahora de un día (n = días atrás) para el alumno del escenario. data = buildProgresoDemoData({ volumen: true }). */
export function compararVolumenDemo(data, n) {
  const dd = n || 0;
  const f = fecha(dd);
  const rows = (data.progresoGlobal[VOL_ALUMNO_ID] || []).filter((r) => r.fecha === f);
  const rutinas = data.rutinasSBEntrenador.filter((r) => r.alumno_id === VOL_ALUMNO_ID);
  const indiceTiempo = indiceEjerciciosPorTiempo(data.allEx, rutinas);
  const d = diaLocal(dia(dd));
  const real = volumenEnRango(rows, { desde: d, hasta: d, indiceTiempo });
  const nombres = {};
  data.allEx.forEach((e) => { nombres[String(e.id)] = e.name; });
  const ids = [];
  rows.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1)).forEach((r) => { if (ids.indexOf(r.ejercicio_id) < 0) ids.push(r.ejercicio_id); });
  const ejercicios = ids.map((id) => {
    const kg = real.porEjercicio[id] || 0;
    const motivo = indiceTiempo[id] ? "por tiempo: las reps son segundos" : kg > 0 ? "" : "sin kg registrados";
    return { id, nombre: nombres[id] || id, incluido: kg > 0, kg, motivo };
  });
  return {
    fecha: f,
    antes: { A: volumenAntesA(rows, data.allEx, rutinas), B: volumenAntesB(rows, data.allEx), C: volumenAntesC(rows), D: volumenAntesD(rows) },
    ahora: real.total,
    ejercicios,
  };
}

const ALUMNOS = [
  { id: "demo-abril", nombre: "Abril Méndez", email: "abril@demo.invalid" },
  { id: "demo-carla", nombre: "Carla Sosa", email: "carla@demo.invalid" },
  { id: "demo-diego", nombre: "Diego Lima", email: "diego@demo.invalid" },
  { id: "demo-julian", nombre: "Julián Paz", email: "julian@demo.invalid" },
  { id: "demo-martina", nombre: "Martina Vega", email: "martina@demo.invalid" },
  { id: "demo-tomas", nombre: "Tomás Ruiz", email: "tomas@demo.invalid" },
  { id: "demo-alumno-a", nombre: "Alumno A Demo", email: "alumno-a@demo.invalid" },
  { id: "demo-alumno-b", nombre: "Alumno B Demo", email: "alumno-b@demo.invalid" },
  { id: "demo-alumno-c", nombre: "Alumno C Demo", email: "alumno-c@demo.invalid" },
];

const ex = (id, reps) => (reps ? { id, reps } : { id });
const dias = (...listas) => listas.map((l, i) => ({ label: "Día " + (i + 1), warmup: l.warmup || [], exercises: l.exercises || l }));

/** Construye rutinas, sesiones y series en memoria. Llamar en cada carga de la página (fechas relativas a hoy). */
export function buildProgresoDemoData(opts) {
  const o = opts || {};
  const rutinas = [
    { id: "demo-r-abril-base", alumno_id: "demo-abril", nombre: "Base", created_at: iso(110), datos: { days: dias([ex("demo-sq"), ex("demo-bp"), ex("demo-row")]) } },
    {
      id: "demo-r-abril-fuerza", alumno_id: "demo-abril", nombre: "Fuerza", created_at: iso(52),
      datos: { ciclo_actual: 2, days: dias([ex("demo-sq"), ex("demo-rdl")], [ex("demo-bp"), ex("custom_demo_remo")], { warmup: [ex("demo-plank", '45"')], exercises: [ex("demo-dl"), ex("demo-ohp")] }) },
    },
    { id: "demo-r-tomas", alumno_id: "demo-tomas", nombre: "Hipertrofia", created_at: iso(30), datos: { days: dias([ex("demo-bp"), ex("demo-ohp")], [ex("demo-sq"), ex("demo-hip")], [ex("demo-row")], [ex("demo-dl")]) } },
    {
      // 3 ciclos: reinicios de rutina hace ~44 y ~9 días (formato real de lib/rutinaCiclo.js). Vigente: ciclo 3, semana 2.
      id: "demo-r-julian", alumno_id: "demo-julian", nombre: "Fuerza básica", created_at: iso(75),
      datos: {
        ciclo_actual: 3, ciclo_base: 3, semana_activa: 2, ciclo_reiniciado_at: iso(9),
        ciclos_meta: [
          { ciclo: 2, tipo: "rutina", semana_inicio: 1, desde_ciclo: 1, at: iso(44) },
          { ciclo: 3, tipo: "rutina", semana_inicio: 1, desde_ciclo: 2, at: iso(9) },
        ],
        days: dias([ex("demo-sq"), ex("demo-bp")], [ex("demo-dl"), ex("demo-row")]),
      },
    },
    { id: "demo-r-alumno-a", alumno_id: "demo-alumno-a", nombre: "Fuerza 5 días", created_at: iso(40), datos: { semana_activa: 4, days: dias([ex("demo-sq")], [ex("demo-sq")], [ex("demo-sq")], [ex("demo-sq")], [ex("demo-sq")]) } },
    { id: "demo-r-alumno-b", alumno_id: "demo-alumno-b", nombre: "Fuerza 4 días", created_at: iso(40), datos: { semana_activa: 4, days: dias([ex("demo-sq")], [ex("demo-sq")], [ex("demo-sq")], [ex("demo-sq")]) } },
    { id: "demo-r-alumno-c", alumno_id: "demo-alumno-c", nombre: "Rutina sin registros", created_at: iso(10), datos: { semana_activa: 1, days: dias([ex("demo-sq")], [ex("demo-bp")]) } },
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

  // ---- Abril: rutina Inicial (hace ~7 meses, ya no existe) -> Base (6 semanas) -> Fuerza ciclo 1 (4 semanas) -> Fuerza ciclo 2 (semana 3)
  [[215, 50, 30], [208, 52.5, 32.5], [201, 55, 32.5], [194, 55, 35]].forEach(([n, sq, bp], i) => {
    sesion("demo-abril", "demo-r-abril-inicial", "Inicial", n, i + 1, 0, 1, { "demo-sq": tres(sq, 8), "demo-bp": tres(bp, 8) });
  });
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
  // [n, semana, ciclo]: ciclo 1 = 4 semanas (una sesión por semana), ciclo 2 = 4 semanas, ciclo 3 = 2 semanas (vigente, semana 2).
  const julianPlan = { 70: [1, 1], 63: [2, 1], 56: [3, 1], 49: [4, 1], 42: [1, 2], 28: [2, 2], 21: [3, 2], 14: [4, 2], 7: [1, 3], 2: [2, 3] };
  [[70, 85, 60, 120, 60], [63, 90, 62.5, 125, 62.5], [56, 95, 65, 130, 65], [49, 97.5, 67.5, 135, 65], [42, 100, 70, 140, 67.5],
   [28, 95, 67.5, 135, 65], [21, 97.5, 67.5, 140, 67.5], [14, 100, 70, 135, 67.5], [7, 100, 67.5, 140, 65], [2, 97.5, 70, 140, 67.5]].forEach(([n, sq, bp, dl, row]) => {
    const sem = julianPlan[n][0];
    const ciclo = julianPlan[n][1];
    sesion("demo-julian", "demo-r-julian", "Fuerza básica", n, sem, 0, ciclo, { "demo-sq": tres(sq, 5), "demo-bp": tres(bp, 5) });
    sesion("demo-julian", "demo-r-julian", "Fuerza básica", n - 1 < 0 ? 0 : n - 1, sem, 1, ciclo, { "demo-dl": tres(dl, 3), "demo-row": tres(row, 8) });
  });

  // ---- Alumno A / B: sentadilla, 4 semanas móviles (k = 0 es la actual: días 0-3; k = 1, días 7-10; ...). Cada sesión suma
  // exactamente el volumen objetivo: series principales kg×reps + una serie de relleno más liviana (nunca supera la marca).
  // Alumno C: rutina asignada y nada más (sin sesiones ni progreso).
  function sesionVol(alumnoId, rutinaId, nombreRutina, n, sem, diaIdx, kg, reps, principales, objetivo) {
    const series = [];
    for (let i = 0; i < principales; i++) series.push([kg, reps]);
    series.push([(objetivo - principales * kg * reps) / reps, reps]);
    sesion(alumnoId, rutinaId, nombreRutina, n, sem, diaIdx, 1, { "demo-sq": series });
  }
  [100, 97.5, 95, 92.5].forEach((kg, k) => { // A: 4 sesiones por semana x 1.250 kg = 5.000 kg/semana; 16 de 20 planificadas = 80 %
    for (let j = 0; j < 4; j++) sesionVol("demo-alumno-a", "demo-r-alumno-a", "Fuerza 5 días", 7 * k + 3 - j, 4 - k, j, kg, 5, 2, 1250);
  });
  [60, 57.5, 55, 50].forEach((kg, k) => { // B: 2 sesiones por semana x 1.000 kg = 2.000 kg/semana; 8 de 16 planificadas = 50 %
    for (let j = 0; j < 2; j++) sesionVol("demo-alumno-b", "demo-r-alumno-b", "Fuerza 4 días", 7 * k + 3 - 2 * j, 4 - k, j, kg, 10, 1, 1000);
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

  if (o.volumen) {
    rutinas.push({ id: "demo-r-vol", alumno_id: VOL_ALUMNO_ID, nombre: "Fuerza + tiempo", created_at: iso(30), datos: { days: dias([ex("vol-sq"), ex("custom_vol_x"), ex("vol-pu"), ex("vol-plank", "45s"), ex("vol-kuohp"), ex("vol-lunge")]) } });
    [[0, VOL_HOY], [7, VOL_SEM_PASADA]].forEach(([n, lista]) => {
      const series = {};
      lista.forEach(([id, s]) => { series[id] = s; });
      sesion(VOL_ALUMNO_ID, "demo-r-vol", "Fuerza + tiempo", n, n === 0 ? 2 : 1, 0, 1, series);
    });
  }

  // Mismo orden que entrega el cargador real (lib/coachHistoryLoader.js): created_at descendente, progreso agrupado por alumno.
  const desc = (a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
  sesiones.sort(desc);
  progreso.sort(desc);
  const progresoGlobal = {};
  progreso.forEach((r) => { (progresoGlobal[r.alumno_id] = progresoGlobal[r.alumno_id] || []).push(r); });

  return {
    alumnos: ALUMNOS.map((a) => Object.assign({}, a)).concat(o.volumen ? [{ id: VOL_ALUMNO_ID, nombre: "Valentina Carga", email: "valentina@demo.invalid" }] : []),
    rutinasSBEntrenador: rutinas,
    sesionesGlobales: sesiones,
    progresoGlobal: progresoGlobal,
    allEx: o.volumen ? DEMO_CATALOGO.concat(VOL_CATALOGO) : DEMO_CATALOGO,
    // `incompleto`: simula que el historial no se pudo cargar completo (para probar los avisos), sin tocar los datos.
    historiaCompleta: o.incompleto ? { sesiones: true, progreso: false } : { sesiones: true, progreso: true },
  };
}
