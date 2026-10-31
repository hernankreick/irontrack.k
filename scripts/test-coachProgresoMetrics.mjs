// Modelo Alumno / Equipo de Progreso del entrenador (components/coachProgresoMetrics.js).
//   - teamChips / adherenciaRows / ranking: globales, NO dependen de alumnoSel.
//   - alumnoChips / prsRecientes / volumen: solo del alumno seleccionado.
//   - volumen = kg x reps (reps <= 0 aporta 0), series reales sin colapsar.
//   - volumen, PR y adherencia salen de lib/metricas (E2): el primer registro no es PR, la adherencia es a la rutina asignada.
// Sin React/esbuild. Fecha fija (Date mockeada): miercoles 7/10/2026 12:00 local.
//
//   node scripts/test-coachProgresoMetrics.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCoachProgresoModel,
  getPeriodDays,
  RECENT_PRS_LIMIT,
} from "../components/coachProgresoMetrics.js";
import { volumenDeSerie, dayNum } from "../lib/metricas/index.js";
const rowVolumeKg = (r) => volumenDeSerie(r && Object.assign({ fecha: "1/1/2026", ejercicio_id: "x" }, r));
import { patternWindowLabel, patternEmptyLabel, recentPrsSubtitle } from "../components/progreso/progressCopy.js";

const src = (rel) => readFileSync(new URL("../components/" + rel, import.meta.url), "utf8");

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok - " + name); }

// ---- fecha determinista (Date.now() y new Date() sin args) ----
const NOW_MS = new Date(2026, 9, 7, 12).getTime();
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...args) { if (args.length === 0) super(NOW_MS); else super(...args); }
  static now() { return NOW_MS; }
}
globalThis.Date = FixedDate;

// ---- fixtures: valores deliberadamente distintos entre alumnas ----
const EVI = "evi", JUL = "jul", MAR = "mar";
const alumnos = [
  { id: EVI, nombre: "Evi", email: "evi@x.com" },
  { id: JUL, nombre: "Julieta", email: "jul@x.com" },
  { id: MAR, nombre: "Marta", email: "mar@x.com" },
];
const rutina = (id, alumno, nDays) => ({
  id, alumno_id: alumno, created_at: "2026-08-01T00:00:00",
  datos: { days: Array.from({ length: nDays }, () => ({ exercises: [{ id: "sq" }, { id: "bp" }, { id: "dl" }] })) },
});
const rutinas = [rutina("r-evi", EVI, 3), rutina("r-jul", JUL, 4), rutina("r-mar", MAR, 2)];
const allEx = [
  { id: "sq", name: "Sentadilla", pattern: "rodilla" },
  { id: "bp", name: "Press banca", pattern: "empuje" },
  { id: "dl", name: "Peso muerto", pattern: "bisagra" },
];
const ses = (alumno, rutinaId, iso, semana) => ({ alumno_id: alumno, rutina_id: rutinaId, created_at: iso + "T10:00:00", semana });
const row = (rutinaId, ejercicio, fecha, kg, reps) => ({ rutina_id: rutinaId, ejercicio_id: ejercicio, fecha, kg, reps, semana: 0 });

// Evi: 6 sesiones en el periodo (6/12 = 50%), 3 en el anterior (25%)
const sesEvi = [
  ses(EVI, "r-evi", "2026-09-14", 1), ses(EVI, "r-evi", "2026-09-21", 2), ses(EVI, "r-evi", "2026-09-28", 3),
  ses(EVI, "r-evi", "2026-10-01", 3), ses(EVI, "r-evi", "2026-10-05", 4), ses(EVI, "r-evi", "2026-10-06", 4),
  ses(EVI, "r-evi", "2026-08-14", 1), ses(EVI, "r-evi", "2026-08-21", 2), ses(EVI, "r-evi", "2026-08-28", 3),
];
// Julieta: 12 sesiones en el periodo (12/16 = 75%), 4 en el anterior (25%)
const sesJul = [];
for (let d = 10; d <= 21; d++) sesJul.push(ses(JUL, "r-jul", "2026-09-" + String(d).padStart(2, "0"), 2));
for (let d = 14; d <= 17; d++) sesJul.push(ses(JUL, "r-jul", "2026-08-" + d, 1));
// Marta: 2 sesiones recientes (2/8 = 25%), 0 en el anterior; sin PR en 3 semanas -> estancada
const sesMar = [ses(MAR, "r-mar", "2026-09-17", 1), ses(MAR, "r-mar", "2026-09-25", 1)];
const sesionesGlobales = [].concat(sesEvi, sesJul, sesMar);

const progresoGlobal = {
  [EVI]: [
    row("r-evi", "sq", "20/8/2026", "40", "10"),   // periodo anterior: primer registro (NO es PR)
    row("r-evi", "sq", "1/10/2026", "50", "15"),   // PR (supera 40)
    row("r-evi", "sq", "1/10/2026", "50", "15"),   // serie real repetida (no PR)
    row("r-evi", "sq", "1/10/2026", "50", "15"),   // serie real repetida (no PR)
    row("r-evi", "sq", "2/10/2026", "60", "0"),    // reps 0: serie invalida, ni PR ni volumen
    row("r-evi", "bp", "2/10/2026", "20", "10"),   // primer registro (NO es PR), vol 200
  ],
  [JUL]: [
    row("r-jul", "sq", "3/10/2026", "100", "5"),   // primer registro
    row("r-jul", "sq", "4/10/2026", "100", "5"),   // iguala: no PR
    row("r-jul", "dl", "5/10/2026", "120", "3"),   // primer registro
  ],
  [MAR]: [
    row("r-mar", "bp", "15/8/2026", "30", "8"),
    row("r-mar", "bp", "25/9/2026", "30", "8"),
  ],
};

const build = (alumnoSel, over) => buildCoachProgresoModel(Object.assign({
  alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador: rutinas, allEx,
  periodId: "semanas4", alumnoSel, ejercicioSelId: "sq", diaIdx: 0, lang: "es",
}, over || {}));
const chip = (chips, key) => chips.find((c) => c.key === key);

const mEvi = build(EVI), mJul = build(JUL), mNone = build(null);

// ---- valores globales protegidos (mismos que antes de E2: la adherencia de este fixture no cambia) ----
const GLOBAL_ADHER_AVG = 50;   // (50 + 75 + 25) / 3
const GLOBAL_STALLED = 1;      // solo Marta
const GLOBAL_ADHERENCIA_ROWS = [
  { id: JUL, n: "Julieta", p: 75, color: "#22c55e", tienePlan: true, completed: 12, planned: 16, validadas: 0 },
  { id: EVI, n: "Evi", p: 50, color: "#eab308", tienePlan: true, completed: 6, planned: 12, validadas: 0 },
  { id: MAR, n: "Marta", p: 25, color: "#ef4444", tienePlan: true, completed: 2, planned: 8, validadas: 0 },
];
const GLOBAL_RANKING = [
  { id: JUL, initials: "JU", n: "Julieta", p: 75, color: "#22c55e", completed: 12, planned: 16, validadas: 0 },
  { id: EVI, initials: "EV", n: "Evi", p: 50, color: "#eab308", completed: 6, planned: 12, validadas: 0 },
  { id: MAR, initials: "MA", n: "Marta", p: 25, color: "#ef4444", completed: 2, planned: 8, validadas: 0 },
];

test("A: Evi seleccionada -> alumnoChips solo usa Evi", () => {
  const ad = chip(mEvi.alumnoChips, "alumnoAdherence");
  assert.equal(ad.value, 50);
  assert.equal(ad.val, "50%");
  assert.match(ad.label, /Evi/);
  assert.doesNotMatch(ad.label, /Julieta/);
  assert.equal(chip(mEvi.alumnoChips, "alumnoPrs").value, 1); // solo sq 50 > 40 (primeros registros y reps 0 no son PR)
  assert.equal(chip(mEvi.alumnoChips, "alumnoVolume").value, 612.5); // 2450 kg / 4 semanas
  assert.equal(chip(mEvi.alumnoChips, "alumnoVolume").val, "613 kg");
  assert.equal(mEvi.alumnoChips.length, 3);
  assert.deepEqual(mEvi.alumnoChips.map((c) => c.key), ["alumnoAdherence", "alumnoPrs", "alumnoVolume"]);
});

test("B: Julieta seleccionada -> alumnoChips cambia a Julieta", () => {
  const ad = chip(mJul.alumnoChips, "alumnoAdherence");
  assert.equal(ad.value, 75);
  assert.match(ad.label, /Julieta/);
  assert.equal(chip(mJul.alumnoChips, "alumnoPrs").value, 0); // solo primeros registros e igualaciones
  assert.equal(chip(mJul.alumnoChips, "alumnoVolume").value, 340); // 1360 kg / 4
  assert.notDeepEqual(mJul.alumnoChips, mEvi.alumnoChips);
});

test("C: teamChips identico con Evi, Julieta o sin seleccion", () => {
  assert.deepEqual(mEvi.teamChips, mJul.teamChips);
  assert.deepEqual(mEvi.teamChips, mNone.teamChips);
  assert.equal(mEvi.teamChips.length, 2);
  assert.deepEqual(mEvi.teamChips.map((c) => c.key), ["teamAdherence", "teamStalled"]);
  assert.equal(chip(mEvi.teamChips, "teamAdherence").value, GLOBAL_ADHER_AVG);
  assert.equal(chip(mEvi.teamChips, "teamStalled").value, GLOBAL_STALLED);
  assert.match(chip(mEvi.teamChips, "teamAdherence").label, /equipo/i);
  // adherencia previa del equipo: (25 + 25 + 0) / 3 = 17 -> delta +33
  assert.match(chip(mEvi.teamChips, "teamAdherence").delta, /^↑ 33%/);
});

test("D: un PR de Julieta no suma para Evi (PRs del periodo)", () => {
  assert.equal(mEvi.prsPeriod, 1);
  assert.equal(mJul.prsPeriod, 0);
  const sinJul = build(EVI, { progresoGlobal: { [EVI]: progresoGlobal[EVI], [MAR]: progresoGlobal[MAR] } });
  assert.equal(sinJul.prsPeriod, mEvi.prsPeriod);
  const conMasJul = build(EVI, { progresoGlobal: Object.assign({}, progresoGlobal, { [JUL]: progresoGlobal[JUL].concat([row("r-jul", "sq", "6/10/2026", "110", "5")]) }) });
  assert.equal(conMasJul.prsPeriod, mEvi.prsPeriod);
  const pgMas = Object.assign({}, progresoGlobal, { [JUL]: progresoGlobal[JUL].concat([row("r-jul", "sq", "6/10/2026", "110", "5")]) });
  assert.equal(build(JUL, { progresoGlobal: pgMas }).prsPeriod, 1, "el PR real de Julieta si cuenta para Julieta");
});

test("E: prsRecientes con Evi no contiene eventos de Julieta", () => {
  assert.equal(mEvi.prsRecientes.length, 1);
  assert.deepEqual([mEvi.prsRecientes[0].ex, mEvi.prsRecientes[0].val, mEvi.prsRecientes[0].delta], ["Sentadilla", "50 kg", "+10 kg"]);
  assert.ok(mEvi.prsRecientes.every((p) => p.n === "Evi" && p.initials === "EV"));
  assert.ok(!mEvi.prsRecientes.some((p) => p.ex === "Peso muerto"), "peso muerto es solo de Julieta");
  assert.equal(mJul.prsRecientes.length, 0, "primeros registros no son PR");
  assert.deepEqual(mNone.prsRecientes, [], "sin alumno no hay PRs recientes");
});

test("F: sesiones de Julieta no modifican la adherencia de Evi", () => {
  const sinJul = build(EVI, { sesionesGlobales: sesEvi.concat(sesMar) });
  assert.deepEqual(chip(sinJul.alumnoChips, "alumnoAdherence"), chip(mEvi.alumnoChips, "alumnoAdherence"));
  const masJul = build(EVI, { sesionesGlobales: sesionesGlobales.concat([ses(JUL, "r-jul", "2026-10-02", 3), ses(JUL, "r-jul", "2026-10-03", 3)]) });
  assert.equal(chip(masJul.alumnoChips, "alumnoAdherence").value, 50);
  assert.equal(chip(masJul.alumnoChips, "alumnoAdherence").delta, chip(mEvi.alumnoChips, "alumnoAdherence").delta);
});

// Evi aislada con 3 series reales de 50 kg x 15 reps en la semana actual de la rutina (lunes 5/10)
const soloTres = (extraRows) => build(EVI, {
  sesionesGlobales: sesEvi,
  progresoGlobal: { [EVI]: [
    row("r-evi", "sq", "6/10/2026", "50", "15"),
    row("r-evi", "sq", "6/10/2026", "50", "15"),
    row("r-evi", "sq", "6/10/2026", "50", "15"),
  ].concat(extraRows || []) },
});

test("G: 3 x (50 x 15) = 2250 kg (no 750)", () => {
  const rows = [{ kg: "50", reps: "15" }, { kg: 50, reps: 15 }, { kg: "50", reps: "15" }];
  assert.equal(rows.reduce((a, r) => a + rowVolumeKg(r), 0), 2250);
  const m = soloTres();
  assert.equal(m.volBars[3].v, 2250);
  assert.equal(m.volSemPromKg, 562.5);
  assert.deepEqual([m.volPct, m.volMotivo], [null, "sin_ejercicios_comunes"], "sin periodo anterior no hay porcentaje");
  assert.equal(m.patronPatterns.find((p) => p.key === "rodilla").vol, 2250);
  assert.equal(m.patronTotalVol, 2250);
});

test("H: reps 0 / invalidas aportan 0 (no kg x 1)", () => {
  assert.equal(rowVolumeKg({ kg: "60", reps: "0" }), 0);
  assert.equal(rowVolumeKg({ kg: 60, reps: null }), 0);
  assert.equal(rowVolumeKg({ kg: 60 }), 0);
  assert.equal(rowVolumeKg({ kg: 60, reps: -3 }), 0);
  assert.equal(rowVolumeKg({ kg: "abc", reps: 10 }), 0);
  assert.equal(rowVolumeKg({ kg: 0, reps: 10 }), 0);
  assert.equal(rowVolumeKg(null), 0);
  const m = build(EVI, { sesionesGlobales: sesEvi, progresoGlobal: { [EVI]: [row("r-evi", "sq", "6/10/2026", "60", "0")] } });
  assert.equal(m.volBars[3].v, 0);
  assert.equal(m.volSemPromKg, 0);
  assert.equal(chip(m.alumnoChips, "alumnoVolume").val, "—");
  assert.equal(m.patronPatterns.find((p) => p.key === "rodilla").vol, 0);
  // en el fixture principal la fila 60 x 0 no suma: 3 x 750 + 200
  assert.equal(mEvi.volSemPromKg * 4, 2450);
});

test("I: series repetidas no se colapsan (volumen y conteo de series por patron)", () => {
  const m = soloTres();
  const rod = m.patronPatterns.find((p) => p.key === "rodilla");
  assert.equal(rod.vol, 2250);
  assert.equal(rod.exercises.length, 1);
  assert.equal(rod.exercises[0].series, 3);
  const cuatro = soloTres([row("r-evi", "sq", "6/10/2026", "50", "15")]);
  assert.equal(cuatro.volBars[3].v, 3000);
});

test("J: ranking y adherenciaRows son globales e iguales al cambiar alumnoSel", () => {
  assert.deepEqual(mEvi.adherenciaRows, GLOBAL_ADHERENCIA_ROWS);
  assert.deepEqual(mEvi.ranking, GLOBAL_RANKING);
  assert.deepEqual(mJul.adherenciaRows, mEvi.adherenciaRows);
  assert.deepEqual(mJul.ranking, mEvi.ranking);
  assert.deepEqual(mNone.adherenciaRows, mEvi.adherenciaRows);
  assert.deepEqual(mNone.ranking, mEvi.ranking);
});

test("K: periodo de 4 semanas y periodo anterior (dias de calendario)", () => {
  const p = getPeriodDays("semanas4");
  const hoy = dayNum(2026, 10, 7);
  assert.deepEqual([p.durDays, p.hoy], [28, hoy]);
  assert.deepEqual(p.actual, { desde: hoy - 27, hasta: hoy });
  assert.deepEqual(p.previo, { desde: hoy - 55, hasta: hoy - 28 });
  // Evi: 1 PR vs 0 en el anterior
  assert.equal(mEvi.prsPrev, 0);
  assert.match(chip(mEvi.alumnoChips, "alumnoPrs").delta, /^↑ 1 /);
  // volumen: sq en ambos periodos pero un solo dia en cada uno => sin porcentaje (no 2450 vs 400 = +512%)
  assert.equal(mEvi.volPct, null);
  assert.equal(mEvi.volMotivo, "previo_con_pocos_dias");
  assert.equal(chip(mEvi.alumnoChips, "alumnoVolume").delta, "Pocos datos en el período anterior");
  // adherencia individual del periodo anterior: Evi 3/12 = 25% -> delta +25
  assert.match(chip(mEvi.alumnoChips, "alumnoAdherence").delta, /^↑ 25%/);
  assert.equal(mJul.prsPrev, 0);
  assert.match(chip(mJul.alumnoChips, "alumnoAdherence").delta, /^↑ 50%/);
  assert.equal(build(EVI, { periodId: "semanas8" }).prsPeriod, 1);
});

test("PRs del modelo: primer registro no es PR, varias series el mismo dia = un PR, historial completo", () => {
  const rows = [
    row("r-evi", "x", "1/10/2026", "10", "5"),
    row("r-evi", "x", "2/10/2026", "20", "5"),
    row("r-evi", "x", "2/10/2026", "30", "5"),
    row("r-evi", "x", "3/10/2026", "30", "5"),
  ];
  const m = build(EVI, { progresoGlobal: { [EVI]: rows } });
  assert.equal(m.prsPeriod, 1);
  assert.equal(m.prsRecientes[0].delta, "+20 kg");
  assert.ok(!m.prsRecientes.some((p) => /Nuevo PR/.test(p.delta)));
});

test("C2: summaryChips y la semantica en toneladas ya no existen en el modelo", () => {
  for (const m of [mEvi, mJul, mNone]) {
    assert.equal("summaryChips" in m, false);
    assert.equal("volSemPromTon" in m, false);
    assert.equal("volTonDelta" in m, false);
  }
});

test("F2: volumen en kg; la comparacion es un % like-for-like o un motivo, nunca toneladas", () => {
  const v = chip(mEvi.alumnoChips, "alumnoVolume");
  assert.match(v.val, /^\d+ kg$/);
  assert.doesNotMatch(v.val + v.delta, /\dt\b/);
  const dosDias = (d1, d2, kg) => [row("r-evi", "sq", d1, kg, "10"), row("r-evi", "sq", d2, kg, "10")];
  const m = build(EVI, { progresoGlobal: { [EVI]: dosDias("1/9/2026", "3/9/2026", "50").concat(dosDias("1/10/2026", "3/10/2026", "55")) } });
  assert.equal(Math.round(m.volPct), 10);
  assert.match(chip(m.alumnoChips, "alumnoVolume").delta, /^↑ 10% vs ant\. \(mismos ejercicios\)$/);
});

test("D2/E: PRs recientes del alumno y limite unico modelo/vista", () => {
  const muchos = [];
  for (let i = 1; i <= 12; i++) muchos.push(row("r-evi", "sq", i + "/9/2026", String(40 + i), "5"));
  const m = build(EVI, { progresoGlobal: Object.assign({}, progresoGlobal, { [EVI]: muchos }) });
  assert.equal(m.prsRecientes.length, RECENT_PRS_LIMIT);
  assert.equal(m.recentPrsLimit, RECENT_PRS_LIMIT);
  assert.ok(m.prsRecientes.every((p) => p.n === "Evi"));
  const card = src("progreso/ProgressRecentPrsCard.jsx");
  assert.doesNotMatch(card, /slice\(0, *\d+\)/, "la card no aplica un limite propio");
  assert.match(src("ProgresoView.jsx"), /prs=\{model\.prsRecientes\}/, "la vista muestra exactamente la lista ya limitada por el modelo");
  assert.doesNotMatch(src("ProgresoView.jsx"), /PRs registrados|PRs logged/, "el limite no se muestra como metrica");
  assert.match(recentPrsSubtitle("es", "Evi"), /Evi/);
});

test("G2: reps 0 = 0 tambien en el drill-down (EjercicioHistorialCoach usa volumenDeSerie de lib/metricas)", () => {
  const h = src("coach/EjercicioHistorialCoach.jsx");
  assert.match(h, /volumenDeSerie\(r, indiceTiempo\)/);
  assert.doesNotMatch(h, /rowVolumeKg/);
  assert.doesNotMatch(h, /Math\.max\(1, *reps\)/);
  assert.doesNotMatch(src("coachProgresoMetrics.js"), /Math\.max\(1, *reps\)/);
  assert.equal(rowVolumeKg({ kg: "50", reps: "0" }), 0);
});

test("H2: copy del patron describe la ventana calculada (semana actual de la rutina, no 4 semanas)", () => {
  const w = patternWindowLabel("es", 4);
  assert.match(w, /Semana actual de la rutina/);
  assert.match(w, /4/);
  assert.doesNotMatch(w + patternEmptyLabel("es") + patternWindowLabel("en", 2) + patternEmptyLabel("en"), /4 semanas|4 weeks|últimas 4/i);
  const card = src("progreso/ProgressMovementPatternVolumeCard.jsx");
  assert.doesNotMatch(card, /4 semanas|4 weeks/);
  // la ventana del modelo es la semana actual de la rutina: soloTres suma solo filas de esa semana (lunes 5/10)
  const m = build(EVI, { sesionesGlobales: sesEvi, progresoGlobal: { [EVI]: [
    row("r-evi", "sq", "6/10/2026", "50", "15"),
    row("r-evi", "sq", "1/10/2026", "50", "15"), // semana anterior de la rutina: no entra al patron
  ] } });
  assert.equal(m.patronPatterns.find((p) => p.key === "rodilla").vol, 750);
  assert.equal(m.currentRoutineWeekIndex, 3);
});

test("I: ProgressLoadControls ya no tiene selector de alumno (solo Dia y Ejercicio)", () => {
  const c = src("progreso/ProgressLoadControls.jsx");
  assert.doesNotMatch(c, /alumnoSel|setAlumnoSel|alumnosSorted/);
  assert.doesNotMatch(c, /"Alumno", "Athlete"/);
  const v = src("ProgresoView.jsx");
  assert.equal((v.match(/<ProgressAlumnoPicker/g) || []).length, 1, "un unico selector de alumno (hoja «Elegir alumno»)");
  assert.doesNotMatch(v, /<ProgressLoadControls[^>]*alumnoSel/);
});

test("J/K: ProgresoView consume alumnoChips y teamChips, no summaryChips", () => {
  const v = src("ProgresoView.jsx");
  assert.match(v, /model\.alumnoChips/);
  assert.match(v, /model\.teamChips/);
  assert.doesNotMatch(v, /summaryChips/);
  assert.doesNotMatch(src("coachProgresoMetrics.js"), /summaryChips/);
});

test("L: tarjetas Equipo separadas de las del alumno (Equipo al final, en su propio componente)", () => {
  const v = src("ProgresoView.jsx");
  const iAlu = v.indexOf('data-section="alumno"');
  const iEq = v.indexOf("<ProgressTeamSection");
  assert.ok(iAlu > 0 && iEq > iAlu);
  const alu = v.slice(iAlu, iEq);
  for (const tag of ["<ProgressSummaryCards", "<ProgressRecentPrsCard", "<ProgressWeeklyVolumeCard", "<ProgressMovementPatternVolumeCard", "{loadBody}", "model.alumnoChips"]) {
    assert.ok(alu.includes(tag), "alumno incluye " + tag);
  }
  assert.ok(!alu.includes("model.teamChips") && !alu.includes("model.ranking"), "nada del equipo en la seccion del alumno");
  assert.match(v.slice(iEq), /teamChips=\{model\.teamChips\} ranking=\{model\.ranking\}/);
  assert.match(src("progreso/ProgressTeamSection.jsx"), /data-section="equipo"/);
});

test("M: no hay formato en toneladas en la cadena de Progreso del entrenador", () => {
  const files = ["coachProgresoMetrics.js", "ProgresoView.jsx", "coach/EjercicioHistorialCoach.jsx", "progreso/ProgressWeeklyVolumeCard.jsx", "progreso/ProgressMovementPatternVolumeCard.jsx", "progreso/ProgressMovementPatternRow.jsx", "progreso/ProgressSummaryCards.jsx"];
  for (const f of files) {
    const t = src(f);
    assert.doesNotMatch(t, /tonelad|volSemPromTon|volTonDelta|\+ *"t"|\+ *"t "|\/ *1000\)\.toFixed/i, f);
  }
});

test("estados vacios: alumno sin rutina / sin PRs / sin volumen, sin datos del alumno anterior", () => {
  const sinRut = build(EVI, { rutinasSBEntrenador: rutinas.filter((r) => r.alumno_id !== EVI) });
  const ad = chip(sinRut.alumnoChips, "alumnoAdherence");
  assert.equal(ad.val, "—");
  assert.equal(ad.value, null);
  assert.equal(ad.delta, "Sin rutina asignada");
  const vacio = build(EVI, { progresoGlobal: { [JUL]: progresoGlobal[JUL] } });
  assert.equal(chip(vacio.alumnoChips, "alumnoPrs").value, 0);
  assert.deepEqual(vacio.prsRecientes, []);
  assert.equal(chip(vacio.alumnoChips, "alumnoVolume").val, "—");
  assert.equal(vacio.volBars.every((b) => b.v === 0), true);
  assert.equal(vacio.patronTotalVol, 0);
  // equipo intacto aunque Evi no tenga datos
  assert.deepEqual(vacio.ranking, mEvi.ranking);
});

globalThis.Date = RealDate;
console.log(count + " tests OK");
