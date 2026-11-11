// P0-3 de la auditoria de estadisticas: sugerencias de carga para el ENTRENADOR (lib/sugerenciasAlumno.js).
//
//   node scripts/test-p0-3SugerenciasCarga.mjs
//
// Antes: el motor tomaba las 3 filas mas recientes de `progreso` como si fueran 3 SESIONES. Las series de una misma sesion daban
// «Subir» o «Estancado» tras un solo entrenamiento, con las reps base (no las de la semana activa) y un RPE que el servidor no guarda.
// Ahora: sesiones reales (dia + semana + ciclo), prescripcion de la semana de cada sesion, solo sesiones comparables, sin RPE.
// Funciones reales, datos ficticios, sin red.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import fs from "node:fs";
import * as SUG from "../lib/sugerenciasAlumno.js";

let count = 0;
const fallas = [];
function test(name, fn) {
  try { fn(); count++; console.log("ok -", name); }
  catch (e) { fallas.push(name); console.log("not ok -", name, "\n   ", String(e && e.message).split("\n").filter(Boolean).slice(0, 5).join("\n    ")); }
}

const A = "alumno-a", B = "alumno-b";
const EX = [{ id: "sq", name: "Sentadilla", equip: "Barra" }, { id: "db", name: "Press mancuernas", equip: "Mancuernas" }, { id: "plank", name: "Plancha" }, { id: "run", name: "Carrera" }];
let seq = 0;
/** Serie con la forma real de `progreso` (select=*): sin dia ni rutina_id; semana 0-based. */
const serie = (fecha, kg, reps, semana0, extra) => Object.assign({ id: "p" + (++seq), alumno_id: A, ejercicio_id: "sq", kg: String(kg), reps: String(reps), fecha, semana: semana0 == null ? 0 : semana0, ciclo: 1, nota: "", created_at: "2026-10-01T12:00:00Z" }, extra || {});
/** Una sesion = varias series del mismo dia. */
const sesion = (fecha, kg, repsList, semana0, extra) => repsList.map((r) => serie(fecha, kg, r, semana0, extra));
const rutinaCon = (ex, datosExtra, extra) => Object.assign({ id: "r1", alumno_id: A, nombre: "Fuerza", created_at: "2026-09-01T12:00:00Z", datos: Object.assign({ semana_activa: 1, days: [{ label: "D1", exercises: [ex] }] }, datosExtra || {}) }, extra || {});
const SQ = { id: "sq", sets: "3", reps: "8-10", kg: "80" };
const generar = (rows, rutina, opts) => SUG.generarSugerenciasAlumno(rows, rutina.datos, EX, Object.assign({ rutina, alumnoId: A, sesiones: [] }, opts || {}));
const de = (list, exId) => (list || []).filter((s) => s.exId === (exId || "sq"));
const tipos = (list, exId) => de(list, exId).map((s) => s.tipo);

// ───────────────────────────────────────── error original
test("ERROR ORIGINAL: una sola sesión 3×8 @80 (objetivo 8-12) ya no sugiere «cambiar esquema / estancado»", () => {
  const out = generar(sesion("1/10/2026", 80, [8, 8, 8]), rutinaCon({ id: "sq", sets: "3", reps: "8-12" }));
  assert.ok(!tipos(out).some((t) => t === "cambiar" || t === "subir"), JSON.stringify(tipos(out)));
  assert.deepEqual(tipos(out), ["insuficiente"]);
});

test("ERROR ORIGINAL: una sola sesión 3×10 @80 (objetivo 8-10) NO recomienda aumentar", () => {
  const out = generar(sesion("1/10/2026", 80, [10, 10, 10]), rutinaCon(SQ));
  assert.deepEqual(tipos(out), ["insuficiente"]);
  assert.equal(de(out)[0].motivo, "una_sesion");
});

// ───────────────────────────────────────── aumentar / mantener
test("aumentar: dos sesiones comparables con 3×10 @80 (todas las series en el tope) => +2,5 kg (barra)", () => {
  const out = generar([...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [10, 10, 10])], rutinaCon(SQ));
  const s = de(out)[0];
  assert.equal(s.tipo, "subir");
  assert.equal(s.kgSugerido, 82.5);
  assert.match(s.accion, /82[.,]5/);
});

test("aumentar: incremento conservador por equipo (mancuernas +1 kg)", () => {
  const ex = { id: "db", sets: "3", reps: "10-12" };
  const rows = [...sesion("1/10/2026", 20, [12, 12, 12], 0, { ejercicio_id: "db" }), ...sesion("8/10/2026", 20, [12, 12, 12], 0, { ejercicio_id: "db" })];
  assert.equal(de(generar(rows, rutinaCon(ex)), "db")[0].kgSugerido, 21);
});

test("aumentar exige TODAS las series prescritas en el tope: 10,10,9 no alcanza => mantener", () => {
  const out = generar([...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [10, 10, 9])], rutinaCon(SQ));
  assert.deepEqual(tipos(out), ["mantener"]);
});

test("calentamiento y descarga no cuentan: solo las series a la carga de trabajo (la mayor del día)", () => {
  const dia = (f) => [serie(f, 40, 10), serie(f, 60, 8), ...sesion(f, 80, [10, 10, 10]), serie(f, 60, 15)];
  assert.deepEqual(tipos(generar([...dia("1/10/2026"), ...dia("8/10/2026")], rutinaCon(SQ))), ["subir"]);
});

test("progreso parcial dentro del rango (8,8,8 → 9,9,8) => mantener", () => {
  const out = generar([...sesion("1/10/2026", 80, [8, 8, 8]), ...sesion("8/10/2026", 80, [9, 9, 8])], rutinaCon(SQ));
  assert.deepEqual(tipos(out), ["mantener"]);
});

test("rendimiento estable (9,9,9 → 9,9,9) => mantener", () => {
  assert.deepEqual(tipos(generar([...sesion("1/10/2026", 80, [9, 9, 9]), ...sesion("8/10/2026", 80, [9, 9, 9])], rutinaCon(SQ))), ["mantener"]);
});

// ───────────────────────────────────────── reducción
test("caída en UNA sola sesión (10,10,10 → 10,10,10 → 6,6,6) no sugiere reducir", () => {
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [10, 10, 10]), ...sesion("15/10/2026", 80, [6, 6, 6])];
  assert.ok(!tipos(generar(rows, rutinaCon(SQ))).includes("evaluar_reduccion"));
});

test("caída sostenida (10,10,10 → 8,8,8 → 6,6,6 a la misma carga) => «evaluar reducción», como decisión del entrenador", () => {
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [8, 8, 8]), ...sesion("15/10/2026", 80, [6, 6, 6])];
  const s = de(generar(rows, rutinaCon(SQ)))[0];
  assert.equal(s.tipo, "evaluar_reduccion");
  assert.match(s.accion, /[Ee]valuar/);
  assert.equal(s.kgSugerido, undefined); // no propone un peso: decide el entrenador
});

test("semana de descarga planificada (kg prescrito menor + nota): no se lee como caída ni se sugiere subir", () => {
  const ex = { id: "sq", sets: "3", reps: "8-10", weeks: [{ sets: "3", reps: "8-10", kg: "80" }, { sets: "3", reps: "8-10", kg: "80" }, { sets: "3", reps: "8-10", kg: "60", note: "Descarga" }] };
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10], 0), ...sesion("8/10/2026", 80, [10, 10, 10], 1), ...sesion("15/10/2026", 60, [8, 8, 8], 2)];
  const out = de(generar(rows, rutinaCon(ex, { semana_activa: 3 })));
  assert.deepEqual(out.map((s) => s.tipo), ["mantener"]);
  assert.equal(out[0].motivo, "descarga_planificada");
});

test("descarga planificada solo por prescripción (kg menor que la semana anterior, sin nota) tampoco cuenta como caída", () => {
  const ex = { id: "sq", sets: "3", reps: "8-10", weeks: [{ sets: "3", reps: "8-10", kg: "80" }, { sets: "3", reps: "8-10", kg: "80" }, { sets: "3", reps: "8-10", kg: "65" }, { sets: "3", reps: "8-10", kg: "80" }] };
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10], 0), ...sesion("8/10/2026", 80, [8, 8, 8], 1), ...sesion("15/10/2026", 65, [6, 6, 6], 2)];
  assert.ok(!tipos(generar(rows, rutinaCon(ex, { semana_activa: 4 }))).includes("evaluar_reduccion"));
});

// ───────────────────────────────────────── prescripción semanal
test("prescripciones semanales distintas: 3×12 en semana 1 (10-12) no habilita subir en semana 2 (6-8)", () => {
  const ex = { id: "sq", sets: "3", reps: "10-12", weeks: [{ sets: "3", reps: "10-12" }, { sets: "3", reps: "6-8" }] };
  const rows = [...sesion("1/10/2026", 60, [12, 12, 12], 0), ...sesion("8/10/2026", 70, [8, 8, 8], 1)];
  const s = de(generar(rows, rutinaCon(ex, { semana_activa: 2 })))[0];
  assert.equal(s.tipo, "insuficiente");
  assert.equal(s.motivo, "sin_sesiones_comparables");
});

test("no contradice la progresión planificada: si la semana siguiente ya sube el kg, se mantiene la planificación", () => {
  const ex = { id: "sq", sets: "3", reps: "8-10", weeks: [{ sets: "3", reps: "8-10", kg: "80" }, { sets: "3", reps: "8-10", kg: "80" }, { sets: "3", reps: "8-10", kg: "85" }] };
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10], 0), ...sesion("8/10/2026", 80, [10, 10, 10], 1)];
  const s = de(generar(rows, rutinaCon(ex, { semana_activa: 2 })))[0];
  assert.equal(s.tipo, "mantener");
  assert.equal(s.motivo, "progresion_planificada");
  assert.match(s.ajuste, /85/);
});

test("la prescripción de la semana activa manda (no la base del ejercicio)", () => {
  const ex = { id: "sq", sets: "3", reps: "12-15", weeks: [{ sets: "3", reps: "8-10" }, { sets: "3", reps: "8-10" }] };
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10], 0), ...sesion("8/10/2026", 80, [10, 10, 10], 1)];
  assert.deepEqual(tipos(generar(rows, rutinaCon(ex, { semana_activa: 2 }))), ["subir"]);
});

// ───────────────────────────────────────── datos insuficientes
test("ejercicio por tiempo (45s) o por distancia (400 m): datos insuficientes, nunca subir/bajar", () => {
  const plank = { id: "plank", sets: "3", reps: "45s" };
  const run = { id: "run", sets: "4", reps: "400 m" };
  const rut = rutinaCon(plank);
  rut.datos.days[0].exercises.push(run);
  const rows = [...sesion("1/10/2026", 10, [45, 45, 45], 0, { ejercicio_id: "plank" }), ...sesion("8/10/2026", 10, [45, 45, 45], 0, { ejercicio_id: "plank" }),
    ...sesion("1/10/2026", 5, [400, 400], 0, { ejercicio_id: "run" }), ...sesion("8/10/2026", 5, [400, 400], 0, { ejercicio_id: "run" })];
  const out = generar(rows, rut);
  assert.deepEqual([de(out, "plank")[0].tipo, de(out, "plank")[0].motivo], ["insuficiente", "por_tiempo"]);
  assert.deepEqual([de(out, "run")[0].tipo, de(out, "run")[0].motivo], ["insuficiente", "prescripcion_insuficiente"]);
});

test("RPE ausente (como en el servidor) o presente: el resultado es el mismo (el RPE no se usa)", () => {
  const sin = [...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [10, 10, 10])];
  const con = sin.map((r) => Object.assign({}, r, { rpe: 9.5 }));
  assert.deepEqual(tipos(generar(sin, rutinaCon(SQ))), ["subir"]);
  assert.deepEqual(tipos(generar(con, rutinaCon(SQ))), ["subir"]);
});

test("historial incompleto o inválido (kg 0, reps 0, fecha inválida) no cuenta como sesión", () => {
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10]), serie("8/10/2026", 0, 10), serie("9/10/2026", 80, 0), serie("2026-10-10", 80, 10), serie("", 80, 10)];
  const s = de(generar(rows, rutinaCon(SQ)))[0];
  assert.deepEqual([s.tipo, s.motivo], ["insuficiente", "una_sesion"]);
});

test("sin registros: datos insuficientes (sin historial)", () => {
  const s = de(generar([], rutinaCon(SQ)))[0];
  assert.deepEqual([s.tipo, s.motivo], ["insuficiente", "sin_historial"]);
});

test("prescripción sin series o sin reps numéricas (AMRAP): datos insuficientes", () => {
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [10, 10, 10])];
  assert.equal(de(generar(rows, rutinaCon({ id: "sq", reps: "8-10" })))[0].motivo, "prescripcion_insuficiente");
  assert.equal(de(generar(rows, rutinaCon({ id: "sq", sets: "3", reps: "AMRAP" })))[0].motivo, "prescripcion_insuficiente");
});

test("ejercicio en dos días de la rutina: sin sesión que demuestre el día => insuficiente; con sesiones, se asigna", () => {
  const rut = rutinaCon(SQ);
  rut.datos.days.push({ label: "D2", exercises: [{ id: "sq", sets: "3", reps: "8-10" }] });
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [10, 10, 10])];
  const sinSes = generar(rows, rut);
  assert.deepEqual(de(sinSes).map((s) => [s.dIdx, s.tipo, s.motivo]), [[0, "insuficiente", "dia_ambiguo"], [1, "insuficiente", "dia_ambiguo"]]);
  const ses = ["1/10/2026", "8/10/2026"].map((f) => ({ alumno_id: A, rutina_id: "r1", fecha: f, semana: 1, dia_idx: 0, ejercicios: "sq", ciclo: 1 }));
  const conSes = generar(rows, rut, { sesiones: ses });
  assert.deepEqual(de(conSes).map((s) => [s.dIdx, s.tipo]), [[0, "subir"], [1, "insuficiente"]]);
});

test("series de una rutina anterior (antes de la asignación) no cuentan", () => {
  const viejas = [...sesion("1/8/2026", 80, [10, 10, 10]), ...sesion("8/8/2026", 80, [10, 10, 10])];
  const s = de(generar([...viejas, ...sesion("1/10/2026", 80, [10, 10, 10])], rutinaCon(SQ)))[0];
  assert.deepEqual([s.tipo, s.motivo], ["insuficiente", "una_sesion"]);
});

// ───────────────────────────────────────── aislamiento, solo lectura y visibilidad
test("aislamiento: las series de otro alumno nunca se usan", () => {
  const propias = sesion("1/10/2026", 80, [10, 10, 10]);
  const ajenas = sesion("8/10/2026", 80, [10, 10, 10], 0, { alumno_id: B });
  assert.deepEqual(tipos(generar([...propias, ...ajenas], rutinaCon(SQ))), ["insuficiente"]);
});

test("solo lectura: no modifica la rutina ni las series, y no trae valores para autocompletar la rutina", () => {
  const rut = rutinaCon(SQ);
  const rows = [...sesion("1/10/2026", 80, [10, 10, 10]), ...sesion("8/10/2026", 80, [10, 10, 10])];
  const antes = JSON.stringify([rut, rows]);
  const out = generar(rows, rut);
  assert.equal(JSON.stringify([rut, rows]), antes);
  out.forEach((s) => ["sugKg", "sugReps", "sugSets", "sugPause"].forEach((k) => assert.equal(s[k], undefined, k)));
});

test("visibilidad: solo la interfaz del entrenador usa las sugerencias; «APLICAR» ya no precarga valores en la rutina", () => {
  const raiz = new URL("../", import.meta.url);
  const usaSug = (rel) => /sugerenciasAlumno|StudentSuggestionsPanel|generarSugerenciasAlumno/.test(fs.readFileSync(new URL(rel, raiz), "utf8"));
  const lista = (dir) => fs.readdirSync(new URL(dir, raiz)).filter((f) => /\.(jsx?|mjs)$/.test(f)).map((f) => dir + f);
  const alumno = [].concat(lista("components/student/"), lista("components/student-plan/"), lista("components/student-progress/"), lista("components/workout/"), ["components/WorkoutScreen.jsx", "components/WorkoutExercisePanel.jsx"]);
  alumno.forEach((f) => assert.equal(usaSug(f), false, f));
  const seccion = fs.readFileSync(new URL("components/students/StudentsSection.jsx", raiz), "utf8");
  assert.doesNotMatch(seccion, /sug\.sug(Kg|Reps|Sets|Pause)/);
});

if (fallas.length) {
  console.log("\n" + fallas.length + " tests FALLARON, " + count + " OK");
  process.exit(1);
}
console.log("\n" + count + " tests OK");
