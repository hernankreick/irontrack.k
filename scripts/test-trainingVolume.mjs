// Card "Volumen de entrenamiento" (lib/trainingVolume.js + components/student-plan/StudentTrainingVolumeCard.jsx).
//
//   node scripts/test-trainingVolume.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sale con codigo != 0 en el primer fallo.
// Corre con zona horaria de EEUU (con DST) para probar que today/off dependen del calendario y no de milisegundos.

process.env.TZ = "America/New_York";

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const V = await import("../lib/trainingVolume.js");
const {
  dayNum, todayDayNum, parseFechaDMY, formatVolume, formatPct, formatDayShort, classifyExercise,
  computeTrainingVolume, mergeRemoteAndLocalRows, fetchTrainingVolumeRows, getCreatedAtCutoffISO,
  buildProgressPagePath, collectRoutineExerciseDefs, PAGE_SIZE, DEFAULT_MAX_PAGES, PCT_HIDDEN_REASONS, EXCLUSION_REASONS,
} = V;

let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log("ok -", name);
}

const T = dayNum(2026, 10, 5); // today de referencia
const fechaOff = (off) => { const d = new Date((T - off) * 86400000); return d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(); };
const row = (id, kg, reps, fecha) => ({ ejercicio_id: id, kg, reps, fecha });
const rowOff = (id, kg, reps, off) => row(id, kg, reps, fechaOff(off));
const compute = (rows, extra) => computeTrainingVolume(rows, Object.assign({ today: T }, extra || {}));

// ------------------------------------------------------------------ 1. parser
await test("parser: d/m/yyyy validos (trim, ceros a la izquierda, bisiesto)", () => {
  assert.equal(parseFechaDMY("29/9/2026"), dayNum(2026, 9, 29));
  assert.equal(parseFechaDMY("9/9/2026"), dayNum(2026, 9, 9));
  assert.equal(parseFechaDMY("05/10/2026"), dayNum(2026, 10, 5));
  assert.equal(parseFechaDMY(" 5/10/2026 "), dayNum(2026, 10, 5));
  assert.equal(parseFechaDMY("29/2/2028"), dayNum(2028, 2, 29));
  assert.equal(parseFechaDMY("29/2/2024"), dayNum(2024, 2, 29));
  assert.equal(parseFechaDMY("1/1/2000"), dayNum(2000, 1, 1));
  assert.equal(parseFechaDMY("31/12/2100"), dayNum(2100, 12, 31));
});
await test("parser: invalidas => null (nunca 'ahora')", () => {
  ["31/2/2026", "32/1/2026", "0/1/2026", "1/0/2026", "1/13/2026", "29/2/2026", "29/2/2100", "5/10/26", "5/10/1999", "5/10/2101",
    "2026-10-05", "5-10-2026", "5/10/2026 10:00", "", "   ", "hoy", "a/b/cccc", null, undefined, 20261005, {}, []].forEach((v) => {
    assert.equal(parseFechaDMY(v), null, JSON.stringify(v));
  });
});
await test("parser: no usa Date.parse ni new Date(string) (5/10/2026 es 5 de octubre, no 10 de mayo)", () => {
  assert.equal(parseFechaDMY("5/10/2026") - parseFechaDMY("4/10/2026"), 1);
  assert.notEqual(parseFechaDMY("5/10/2026"), dayNum(2026, 5, 10));
  assert.equal(parseFechaDMY("13/9/2026"), dayNum(2026, 9, 13));
});

// ------------------------------------------------------------------ 2. ventanas
await test("boundaries: off -1,0,27,28,55,56", () => {
  const m = compute([
    rowOff("sq", 10, 1, -1), rowOff("sq", 10, 1, 0), rowOff("sq", 10, 1, 27),
    rowOff("sq", 10, 1, 28), rowOff("sq", 10, 1, 55), rowOff("sq", 10, 1, 56),
  ]);
  assert.equal(m.currentTotal, 20, "CURRENT = off 0 y 27");
  assert.equal(m.previousTotal, 20, "PREVIOUS = off 28 y 55");
  assert.equal(m.diagnostics.byReason.fuera_de_ventana.sets, 2, "off -1 y 56 fuera");
});
await test("calendario/DST: today por fecha local, estable en cambios de hora (America/New_York)", () => {
  // Cambio de hora de EEUU: 2026-03-08 (spring forward) y 2026-11-01 (fall back).
  const seq = (y, m, d0, n) => Array.from({ length: n }, (_, i) => todayDayNum(new Date(y, m - 1, d0 + i, 12)));
  [seq(2026, 3, 6, 5), seq(2026, 10, 30, 5)].forEach((days) => days.forEach((d, i) => { if (i) assert.equal(d - days[i - 1], 1); }));
  assert.equal(todayDayNum(new Date(2026, 9, 5, 0, 0, 1)), T);
  assert.equal(todayDayNum(new Date(2026, 9, 5, 23, 59, 59)), T);
  // una ventana que cruza el DST sigue contando dias calendario (no ms/86400000)
  const t2 = dayNum(2026, 11, 20);
  const m = computeTrainingVolume([row("sq", 10, 1, "20/11/2026"), row("sq", 10, 1, "24/10/2026"), row("sq", 10, 1, "23/10/2026")], { today: t2 });
  assert.equal(m.currentTotal, 20, "20/11 (off 0) y 24/10 (off 27) -> CURRENT");
  assert.equal(m.previousTotal, 10, "23/10 (off 28) -> PREVIOUS");
});
await test("cutoff created_at = medianoche local de today-55 menos 3 dias (ISO UTC), solo prefiltro", () => {
  const iso = getCreatedAtCutoffISO(new Date(2026, 9, 5, 15, 30));
  const back = new Date(iso);
  assert.equal(back.getTime(), new Date(2026, 9, 5 - 55 - 3).getTime());
  assert.equal(back.getHours(), 0);
  assert.equal(iso.slice(-1), "Z");
});

// ------------------------------------------------------------------ 3. volumen
await test("volumen: 3 filas 60x8 = 1440 (sin deduplicar)", () => {
  const m = compute([rowOff("sq", 60, 8, 0), rowOff("sq", 60, 8, 0), rowOff("sq", 60, 8, 0)]);
  assert.equal(m.currentTotal, 1440);
  assert.equal(m.currentByExercise.sq, 1440);
});
await test("volumen: legext 3 x (50x15) = 2250 (no 750)", () => {
  const m = compute([rowOff("legext", 50, 15, 3), rowOff("legext", 50, 15, 3), rowOff("legext", 50, 15, 3)]);
  assert.equal(m.currentTotal, 2250);
});
await test("volumen: kg/reps como texto (parseFloat/parseInt)", () => {
  assert.equal(compute([rowOff("sq", "62.5", "8", 1)]).currentTotal, 500);
});
await test("created_at nunca decide la ventana: solo cuenta fecha/off", () => {
  const a = Object.assign(rowOff("sq", 10, 10, 1), { created_at: "2020-01-01T00:00:00Z" });
  const b = Object.assign(rowOff("sq", 10, 10, 40), { created_at: "2026-10-05T00:00:00Z" });
  const m = compute([a, b]);
  assert.equal(m.currentTotal, 100);
  assert.equal(m.previousTotal, 100);
});

// ------------------------------------------------------------------ 4. exclusiones
await test("exclusion: fecha_invalida (nunca se convierte en 'hoy')", () => {
  const m = compute([row("sq", 50, 5, "31/2/2026"), row("sq", 50, 5, ""), row("sq", 50, 5, null), row("sq", 50, 5, "2026-10-05")]);
  assert.equal(m.currentTotal, 0);
  assert.equal(m.diagnostics.byReason.fecha_invalida.sets, 4);
});
await test("exclusion: fuera_de_ventana", () => {
  const m = compute([rowOff("sq", 50, 5, 56), rowOff("sq", 50, 5, -1), row("sq", 50, 5, "17/7/2026")]);
  assert.equal(m.diagnostics.byReason.fuera_de_ventana.sets, 3);
  assert.equal(m.currentTotal + m.previousTotal, 0);
});
await test("exclusion: kg<=0 y reps<=0 (incluye NaN/vacio)", () => {
  const m = compute([rowOff("sq", 0, 8, 1), rowOff("sq", -5, 8, 1), rowOff("sq", "", 8, 1), rowOff("sq", 60, 0, 1), rowOff("sq", 60, -2, 1), rowOff("sq", 60, "x", 1)]);
  assert.equal(m.diagnostics.byReason["kg<=0"].sets, 3);
  assert.equal(m.diagnostics.byReason["reps<=0"].sets, 3);
  assert.equal(m.currentTotal, 0);
});
await test("orden de exclusion: fecha > ventana > kg > reps > resolucion", () => {
  const m = compute([
    row("custom_1", 0, 0, "31/2/2026"),   // fecha_invalida gana a todo
    rowOff("custom_1", 0, 0, 99),          // fuera_de_ventana gana a kg
    rowOff("custom_1", 0, 5, 1),           // kg<=0 gana a reps y a resolucion
    rowOff("custom_1", 5, 0, 1),           // reps<=0 gana a resolucion
    rowOff("custom_1", 5, 5, 1),           // recien aqui: no_resoluble
  ]);
  const by = m.diagnostics.byReason;
  assert.deepEqual(EXCLUSION_REASONS, ["fecha_invalida", "fuera_de_ventana", "kg<=0", "reps<=0", "no_resoluble", "patron_no_fuerza", "equipo_sin_carga_externa", "peso_corporal_o_asistido", "objetivo_de_tiempo_en_rutina"]);
  assert.equal(by.fecha_invalida.sets, 1);
  assert.equal(by.fuera_de_ventana.sets, 1);
  assert.equal(by["kg<=0"].sets, 1);
  assert.equal(by["reps<=0"].sets, 1);
  assert.equal(by.no_resoluble.sets, 1);
});
await test("exclusion: no_resoluble (custom_* y cualquier id fuera del catalogo; sin heuristica reps<=50)", () => {
  const m = compute([rowOff("custom_1778697447353", 20, 10, 1), rowOff("zzz", 20, 10, 1), rowOff(null, 20, 10, 1), rowOff("custom_x", 20, 30, 1), rowOff("custom_y", 20, 60, 1)]);
  assert.equal(m.diagnostics.byReason.no_resoluble.sets, 5);
  assert.equal(m.currentTotal, 0);
  assert.deepEqual(Object.keys(m.currentByExercise), []);
});
await test("custom sin metadata accesible => no_resoluble aunque haya snapshot de rutina con pattern/equip", () => {
  const defs = collectRoutineExerciseDefs([{ days: [{ exercises: [{ id: "custom_9", pattern: "rodilla", equip: "Barra", name: "Mi custom" }] }] }]);
  assert.equal(classifyExercise("custom_9", undefined, defs).reason, "no_resoluble");
  const m = compute([rowOff("custom_9", 40, 10, 1)], { routineExerciseDefs: defs });
  assert.equal(m.currentTotal, 0);
  assert.equal(m.diagnostics.byReason.no_resoluble.sets, 1);
});
await test("exclusion: patron_no_fuerza (core, cardio, movilidad) y normalizacion trim/lowercase", () => {
  const catalog = {
    c1: { id: "c1", pattern: "core", equip: "Mancuernas" }, c2: { id: "c2", pattern: "cardio", equip: "Bicicleta" },
    c3: { id: "c3", pattern: " MOVILIDAD ", equip: "Barra" }, c4: { id: "c4", pattern: "", equip: "Barra" },
    n1: { id: "n1", pattern: "  RoDiLLa ", equip: "Barra", name: "normalizado" }, n2: { id: "n2", pattern: " Oly", equip: "Barra" },
  };
  const m = compute([rowOff("c1", 10, 10, 1), rowOff("c2", 10, 10, 1), rowOff("c3", 10, 10, 1), rowOff("c4", 10, 10, 1), rowOff("n1", 10, 10, 1), rowOff("n2", 10, 10, 1)], { catalog });
  assert.equal(m.diagnostics.byReason.patron_no_fuerza.sets, 4);
  assert.equal(m.currentTotal, 200, "n1 y n2 (rodilla/oly normalizados) cuentan");
  const real = compute([rowOff("bike", 5, 20, 1), rowOff("core_remo_renegado", 12, 12, 1)]);
  assert.equal(real.diagnostics.byReason.patron_no_fuerza.sets, 2);
});
await test("patrones de fuerza validos: rodilla, empuje, traccion, bisagra, oly", () => {
  const catalog = {};
  ["rodilla", "empuje", "traccion", "bisagra", "oly"].forEach((p) => { catalog["p_" + p] = { id: "p_" + p, pattern: p, equip: "Barra" }; });
  assert.equal(compute(Object.keys(catalog).map((id) => rowOff(id, 10, 10, 1)), { catalog }).currentTotal, 500);
});
await test("exclusion: equipo_sin_carga_externa (case-insensitive, trim; 'Banco 45' y 'Banco' ambos)", () => {
  const equips = ["Libre", "Colchoneta", "Paralelas", "Anillas", "Banco", "Banco 45", "Rueda", "Soga", "Fitball", "LIBRE", " banco 45 ", "fitBALL"];
  const catalog = {};
  equips.forEach((e, i) => { catalog["e" + i] = { id: "e" + i, pattern: "empuje", equip: e, name: "x" }; });
  catalog.okEquip = { id: "okEquip", pattern: "empuje", equip: "Mancuerna", name: "x" };
  const m = compute(equips.map((e, i) => rowOff("e" + i, 10, 10, 1)).concat([rowOff("okEquip", 10, 10, 1)]), { catalog });
  assert.equal(m.diagnostics.byReason.equipo_sin_carga_externa.sets, equips.length);
  assert.equal(m.currentTotal, 100);
});
await test("exclusion: peso_corporal_o_asistido (dominadas; exerciseIsBodyweightLike)", () => {
  const m = compute([rowOff("pu", 10, 5, 1), rowOff("pusu", 10, 5, 1), rowOff("punu", 10, 5, 1)]);
  assert.equal(m.diagnostics.byReason.peso_corporal_o_asistido.sets, 3);
  assert.equal(m.currentTotal, 0);
});
await test("exclusion: objetivo_de_tiempo_en_rutina (solo por snapshot; un snapshot sin tiempo no excluye)", () => {
  const timed = collectRoutineExerciseDefs([{ days: [{ exercises: [{ id: "sq", reps: "30 seg" }] }] }]);
  assert.equal(compute([rowOff("sq", 20, 30, 1)], { routineExerciseDefs: timed }).diagnostics.byReason.objetivo_de_tiempo_en_rutina.sets, 1);
  const normal = collectRoutineExerciseDefs([{ days: [{ warmup: [{ id: "lp", reps: "12" }], exercises: [{ id: "sq", reps: "8-10" }] }] }]);
  const m = compute([rowOff("sq", 60, 8, 1), rowOff("lp", 100, 10, 1)], { routineExerciseDefs: normal });
  assert.equal(m.currentTotal, 480 + 1000);
  assert.equal(m.diagnostics.byReason.objetivo_de_tiempo_en_rutina.sets, 0);
});
await test("clasificacion real del catalogo: legext valido; core/cardio/dominadas excluidos", () => {
  assert.deepEqual(classifyExercise("legext"), { ok: true });
  assert.equal(classifyExercise("sq").ok, true);
  assert.equal(classifyExercise("core_remo_renegado").reason, "patron_no_fuerza");
  assert.equal(classifyExercise("bike").reason, "patron_no_fuerza");
  assert.equal(classifyExercise("pusu").reason, "peso_corporal_o_asistido");
  assert.equal(classifyExercise("custom_1778697447353").reason, "no_resoluble");
});

// ------------------------------------------------------------------ 5. multiplicidad / merge remoto + local
const localSet = (kg, reps, date, week = 1, note = "") => ({ kg, reps, date, week, note });
const remoteRow = (id, kg, reps, fecha, semana = 1, nota = "") => ({ ejercicio_id: id, kg, reps, fecha, semana, nota, created_at: "2026-10-04T12:00:00Z" });
const mergedFor = (nLocal, nRemote, fechaLocal = "4/10/2026", fechaRemote = "4/10/2026") => {
  const local = { sq: { sets: Array.from({ length: nLocal }, () => localSet(60, 8, fechaLocal)), max: 60 } };
  const remote = Array.from({ length: nRemote }, () => remoteRow("sq", 60, 8, fechaRemote));
  return mergeRemoteAndLocalRows(remote, local);
};
await test("merge: 3/0 => 3, 0/3 => 3, 3/3 => 3, 3/2 => 3, 2/3 => 3, 4 local/3 remoto => 4", () => {
  [[3, 0, 3], [0, 3, 3], [3, 3, 3], [3, 2, 3], [2, 3, 3], [4, 3, 4], [0, 0, 0]].forEach(([l, r, exp]) => {
    assert.equal(mergedFor(l, r).length, exp, l + "/" + r);
  });
  assert.equal(compute(mergedFor(4, 3)).currentTotal, 4 * 480, "el volumen refleja 4 series");
});
await test("merge: misma firma pero otra fecha => no colapsa", () => {
  assert.equal(mergedFor(1, 1, "3/10/2026", "4/10/2026").length, 2);
});
await test("merge: otra firma (kg/reps/semana/nota) => no colapsa; ejercicios distintos independientes", () => {
  const local = { sq: { sets: [localSet(60, 8, "4/10/2026"), localSet(60, 8, "4/10/2026", 2), localSet(60, 8, "4/10/2026", 1, "nota")], max: 60 } };
  const rows = mergeRemoteAndLocalRows([remoteRow("sq", 60, 8, "4/10/2026"), remoteRow("lp", 60, 8, "4/10/2026")], local);
  assert.equal(rows.filter((r) => r.ejercicio_id === "sq").length, 3);
  assert.equal(rows.filter((r) => r.ejercicio_id === "lp").length, 1);
});
await test("merge: tolera progress/remoto vacios o malformados", () => {
  assert.deepEqual(mergeRemoteAndLocalRows(null, null), []);
  assert.deepEqual(mergeRemoteAndLocalRows([null, { kg: 1 }], { sq: null, lp: {} }), []);
  assert.equal(mergeRemoteAndLocalRows([remoteRow("sq", "60", "8", "4/10/2026")], undefined)[0].kg, 60);
});
await test("el 'progress' local (tope de 50) no es la fuente: 80 filas remotas siguen contando 80", () => {
  const remote = Array.from({ length: 80 }, () => remoteRow("sq", 10, 10, "4/10/2026"));
  assert.equal(compute(mergeRemoteAndLocalRows(remote, { sq: { sets: [], max: 0 } })).currentTotal, 80 * 100);
});

// ------------------------------------------------------------------ 6. like-for-like y porcentaje
const exSets = (id, off, n = 1) => Array.from({ length: n }, () => rowOff(id, 10, 10, off));
await test("like-for-like: ejercicio solo en CURRENT afecta currentTotal pero no el comparable ni el pct", () => {
  const base = [].concat(exSets("sq", 2), exSets("lp", 2), exSets("sq", 30), exSets("lp", 30), exSets("sq", 8), exSets("lp", 8));
  const a = compute(base);
  const b = compute(base.concat(exSets("legext", 3, 5)));
  assert.equal(b.currentTotal, a.currentTotal + 500);
  assert.equal(b.currentComparable, a.currentComparable);
  assert.equal(b.previousComparable, a.previousComparable);
  assert.equal(b.pct, a.pct);
  assert.deepEqual(b.commonExercises.sort(), ["lp", "sq"]);
});
await test("like-for-like: ejercicio solo en PREVIOUS no entra al comparable", () => {
  const base = [].concat(exSets("sq", 2), exSets("lp", 2), exSets("sq", 30), exSets("lp", 30));
  const m = compute(base.concat(exSets("legext", 31, 4)));
  assert.equal(m.previousTotal, 200 + 400);
  assert.equal(m.previousComparable, 200);
  assert.deepEqual(m.commonExercises.sort(), ["lp", "sq"]);
});
await test("pct = (currentComparable - previousComparable) / previousComparable * 100; currentTotal no interviene", () => {
  // comunes: sq y lp. CURRENT comparable 600, PREVIOUS comparable 400 -> +50%. currentTotal incluye 900 extra no comparables.
  const rows = [].concat(
    exSets("sq", 1), exSets("sq", 10, 2), exSets("lp", 20, 3),        // 600 (3 dias)
    exSets("sq", 30), exSets("lp", 38), exSets("sq", 50, 1), exSets("lp", 45), // 400 en PREVIOUS (4 dias, span 20)
    exSets("legext", 2, 9),                                              // 900 solo CURRENT
  );
  const m = compute(rows);
  assert.equal(m.currentComparable, 600);
  assert.equal(m.previousComparable, 400);
  assert.equal(m.currentTotal, 1500);
  assert.equal(m.pct, 50);
  assert.equal(m.pctLabel, "+50%");
  assert.notEqual(Math.round(((m.currentTotal - m.previousComparable) / m.previousComparable) * 100), m.pct);
});
const goodPctRows = () => [].concat(
  exSets("sq", 1), exSets("lp", 9),                      // CURRENT: 2 dias comparables
  exSets("sq", 30), exSets("lp", 44),                    // PREVIOUS: 2 dias (off 30 y 44, span 14)
);
await test("showPct: caso base positivo (todas las condiciones)", () => {
  const m = compute(goodPctRows());
  assert.deepEqual(m.pctHiddenReasons, []);
  assert.equal(m.showPct, true);
  assert.equal(m.previousHistorySpan, 14);
  assert.equal(m.pctLabel, "0%");
});
await test("showPct: commonExercises < 2 => oculto", () => {
  const m = compute([].concat(exSets("sq", 1), exSets("sq", 9), exSets("sq", 30), exSets("sq", 44)));
  assert.equal(m.showPct, false);
  assert.ok(m.pctHiddenReasons.includes(PCT_HIDDEN_REASONS.COMMON_LT_2));
});
await test("showPct: previousComparable = 0 => oculto (y pct null)", () => {
  const m = compute([].concat(exSets("sq", 1), exSets("lp", 9)));
  assert.equal(m.showPct, false);
  assert.equal(m.pct, null);
  assert.ok(m.pctHiddenReasons.includes(PCT_HIDDEN_REASONS.PREVIOUS_ZERO));
});
await test("showPct: CURRENT comparable en < 2 dias => oculto", () => {
  const m = compute([].concat(exSets("sq", 1), exSets("lp", 1), exSets("sq", 30), exSets("lp", 44), exSets("legext", 9)));
  assert.equal(m.showPct, false);
  assert.deepEqual(m.pctHiddenReasons, [PCT_HIDDEN_REASONS.CURRENT_DAYS]);
});
await test("showPct: PREVIOUS comparable en < 2 dias => oculto", () => {
  const m = compute([].concat(exSets("sq", 1), exSets("lp", 9), exSets("sq", 30), exSets("lp", 30)));
  assert.equal(m.showPct, false);
  assert.ok(m.pctHiddenReasons.includes(PCT_HIDDEN_REASONS.PREVIOUS_DAYS));
});
await test("showPct: PREVIOUS comparable con span < 7 dias (3 dias dentro de 6) => oculto, pct matematico existe", () => {
  const m = compute([].concat(exSets("sq", 1), exSets("lp", 9), exSets("sq", 28), exSets("lp", 32), exSets("sq", 34)));
  assert.equal(m.comparablePreviousDays.length, 3);
  assert.equal(m.previousHistorySpan, 6);
  assert.equal(m.showPct, false);
  assert.deepEqual(m.pctHiddenReasons, [PCT_HIDDEN_REASONS.PREVIOUS_SPAN]);
  assert.equal(PCT_HIDDEN_REASONS.PREVIOUS_SPAN, "PREVIOUS_span_<7_dias");
  assert.ok(Number.isFinite(m.pct), "el pct matematico existe aunque no se muestre");
});const prevSpan = (offA, offB) => compute([].concat(exSets("sq", 1), exSets("lp", 9), exSets("sq", offA), exSets("lp", offB)));
await test("span PREVIOUS: dias 1 y 7 (span 6) => oculto; dias 1 y 8 (span 7) => permitido", () => {
  // 11/8/2026 es off 55 y 17/8 off 49 (span 6); 18/8 es off 48 (span 7). Todo PREVIOUS con today = 2026-10-05.
  const hidden = compute([].concat(exSets("sq", 1), exSets("lp", 9), [row("sq", 10, 10, "11/8/2026"), row("lp", 10, 10, "17/8/2026")]));
  assert.equal(hidden.previousHistorySpan, 6);
  assert.equal(hidden.showPct, false);
  assert.deepEqual(hidden.pctHiddenReasons, [PCT_HIDDEN_REASONS.PREVIOUS_SPAN]);
  const ok = compute([].concat(exSets("sq", 1), exSets("lp", 9), [row("sq", 10, 10, "11/8/2026"), row("lp", 10, 10, "18/8/2026")]));
  assert.equal(ok.previousHistorySpan, 7);
  assert.equal(ok.showPct, true);
  assert.deepEqual(ok.pctHiddenReasons, []);
});
await test("span PREVIOUS: varios entrenamientos concentrados en <= 6 dias => oculto; distribuidos >= 7 => permitido", () => {
  const concentrated = [].concat(exSets("sq", 1), exSets("lp", 9), [55, 54, 53, 52, 51, 50, 49].flatMap((o, i) => exSets(i % 2 ? "lp" : "sq", o)));
  const c = compute(concentrated);
  assert.equal(c.comparablePreviousDays.length, 7);
  assert.equal(c.previousHistorySpan, 6);
  assert.equal(c.showPct, false);
  const spread = compute([].concat(exSets("sq", 1), exSets("lp", 9), [55, 54, 53, 52, 51, 50, 48].flatMap((o, i) => exSets(i % 2 ? "lp" : "sq", o))));
  assert.equal(spread.previousHistorySpan, 7);
  assert.equal(spread.showPct, true);
  assert.equal(prevSpan(30, 50).previousHistorySpan, 20);
  assert.equal(prevSpan(30, 50).showPct, true);
});
await test("span PREVIOUS: depende de la separacion entre dias, no de la posicion respecto de today (sin efectos de borde)", () => {
  // misma separacion (6 y 7 dias) desplazada dia a dia a lo largo de todo PREVIOUS: el resultado no cambia.
  for (let hi = 34; hi <= 55; hi++) {
    const sixAgo = compute([].concat(exSets("sq", 1), exSets("lp", 9), exSets("sq", hi - 6 >= 28 ? hi - 6 : hi), exSets("lp", hi)));
    if (hi - 6 >= 28) { assert.equal(sixAgo.previousHistorySpan, 6, "hi=" + hi); assert.equal(sixAgo.showPct, false, "hi=" + hi); }
    if (hi - 7 >= 28) {
      const seven = compute([].concat(exSets("sq", 1), exSets("lp", 9), exSets("sq", hi - 7), exSets("lp", hi)));
      assert.equal(seven.previousHistorySpan, 7, "hi=" + hi);
      assert.equal(seven.showPct, true, "hi=" + hi);
    }
  }
});await test("showPct: retrieval incompleto => modelo vacio, card y pct ocultos", () => {
  const m = compute(goodPctRows(), { complete: false });
  assert.equal(m.showCard, false);
  assert.equal(m.showPct, false);
  assert.deepEqual(m.pctHiddenReasons, [PCT_HIDDEN_REASONS.INCOMPLETE]);
  assert.equal(m.currentTotal, 0);
});
await test("pct: formato +12%, negativos, 0% si |delta| < 0.5", () => {
  assert.equal(formatPct(12.4), "+12%");
  assert.equal(formatPct(-27.727), "-28%");
  assert.equal(formatPct(0.49), "0%");
  assert.equal(formatPct(-0.49), "0%");
  assert.equal(formatPct(0), "0%");
  assert.equal(formatPct(100), "+100%");
});

// ------------------------------------------------------------------ 7. card / barras
await test("card: visible solo con currentTotal > 0 y >= 2 dias CURRENT", () => {
  assert.equal(compute([]).showCard, false);
  assert.equal(compute([rowOff("sq", 50, 5, 1), rowOff("sq", 50, 5, 1)]).showCard, false, "1 solo dia");
  assert.equal(compute([rowOff("sq", 50, 5, 1), rowOff("sq", 50, 5, 2)]).showCard, true);
  assert.equal(compute([rowOff("sq", 50, 5, 30), rowOff("sq", 50, 5, 31)]).showCard, false, "solo PREVIOUS");
  assert.equal(compute([rowOff("sq", 50, 5, 1), rowOff("custom_1", 50, 5, 2)]).showCard, false, "el 2.o dia no es valido");
});
await test("barras: siempre cuatro (B1..B4), semanas vacias = 0, B4 = off 6..0", () => {
  const m = compute([rowOff("sq", 10, 10, 27), rowOff("sq", 10, 10, 21), rowOff("sq", 10, 10, 6), rowOff("sq", 10, 10, 0)]);
  assert.deepEqual(m.blocks.map((b) => b.key), ["B1", "B2", "B3", "B4"]);
  assert.deepEqual(m.blocks.map((b) => b.kg), [200, 0, 0, 200]);
  assert.deepEqual(m.blocks.map((b) => [b.from, b.to]), [[27, 21], [20, 14], [13, 7], [6, 0]]);
  assert.equal(m.blocks[3].startDay, T - 6);
  assert.equal(m.blocks[3].endDay, T);
  assert.equal(formatDayShort(m.blocks[3].startDay), "29/09");
  assert.equal(formatDayShort(m.blocks[3].endDay), "05/10");
  assert.equal(formatDayShort(m.blocks[0].startDay), "08/09");
  assert.equal(m.blocks.reduce((a, b) => a + b.kg, 0), m.currentTotal);
});
await test("barras: bordes de cada bloque (27|26.. 21|20, 14|13, 7|6)", () => {
  const at = (off) => compute([rowOff("sq", 10, 1, off)]).blocks.map((b) => b.kg);
  assert.deepEqual(at(27), [10, 0, 0, 0]);
  assert.deepEqual(at(21), [10, 0, 0, 0]);
  assert.deepEqual(at(20), [0, 10, 0, 0]);
  assert.deepEqual(at(14), [0, 10, 0, 0]);
  assert.deepEqual(at(13), [0, 0, 10, 0]);
  assert.deepEqual(at(7), [0, 0, 10, 0]);
  assert.deepEqual(at(6), [0, 0, 0, 10]);
  assert.deepEqual(at(0), [0, 0, 0, 10]);
  assert.deepEqual(at(28), [0, 0, 0, 0], "off 28 es PREVIOUS");
});

// ------------------------------------------------------------------ 8. formato
await test("formato: siempre kg, entero, separador de miles espanol (840 / 999 / 999.6 / 1000 / 3200 / 12075)", () => {
  assert.equal(formatVolume(840), "840 kg");
  assert.equal(formatVolume(999), "999 kg");
  assert.equal(formatVolume(999.4), "999 kg");
  assert.equal(formatVolume(999.6), "1.000 kg");
  assert.equal(formatVolume(1000), "1.000 kg");
  assert.equal(formatVolume(3200), "3.200 kg");
  assert.equal(formatVolume(12075), "12.075 kg");
  assert.equal(formatVolume(0), "0 kg");
  assert.equal(formatVolume(null), "0 kg");
});

// ------------------------------------------------------------------ 9. recuperacion paginada
const makeRows = (n, start = 0) => Array.from({ length: n }, (_, i) => ({ id: start + i, ejercicio_id: "sq", kg: 10, reps: 10, fecha: "4/10/2026", semana: 1, nota: "", created_at: "2026-10-04T10:00:00Z" }));
const pagedFetcher = (total, opts = {}) => {
  const calls = [];
  const fn = async (p) => {
    calls.push(p);
    const offset = Number(/offset=(\d+)/.exec(p)[1]);
    if (opts.failAtOffset === offset) return opts.failWith === undefined ? null : opts.failWith;
    if (opts.throwAtOffset === offset) throw new Error("red");
    return makeRows(Math.max(0, Math.min(PAGE_SIZE, total - offset)), offset);
  };
  fn.calls = calls;
  return fn;
};
await test("retrieval: 2300 filas => 3 paginas (offsets 0,1000,2000), completo", async () => {
  const f = pagedFetcher(2300);
  const res = await fetchTrainingVolumeRows(f, "alumno-1", { now: new Date(2026, 9, 5, 12) });
  assert.equal(res.complete, true);
  assert.equal(res.rows.length, 2300);
  assert.equal(res.pages, 3);
  assert.deepEqual(f.calls.map((p) => /offset=(\d+)/.exec(p)[1]), ["0", "1000", "2000"]);
});
await test("retrieval: exactamente 1000 filas => pide una 2.a pagina vacia y completa", async () => {
  const f = pagedFetcher(1000);
  const res = await fetchTrainingVolumeRows(f, "a");
  assert.equal(res.complete, true);
  assert.equal(res.rows.length, 1000);
  assert.equal(f.calls.length, 2);
});
await test("retrieval: 0 filas => completo con 0 filas (distinto de error)", async () => {
  const res = await fetchTrainingVolumeRows(pagedFetcher(0), "a");
  assert.equal(res.complete, true);
  assert.equal(res.rows.length, 0);
});
await test("retrieval: pagina 2 con error (null) => INCOMPLETE", async () => {
  const res = await fetchTrainingVolumeRows(pagedFetcher(2300, { failAtOffset: 1000 }), "a");
  assert.equal(res.complete, false);
});
await test("retrieval: pagina 2 lanza excepcion o devuelve no-array => INCOMPLETE", async () => {
  assert.equal((await fetchTrainingVolumeRows(pagedFetcher(2300, { throwAtOffset: 1000 }), "a")).complete, false);
  assert.equal((await fetchTrainingVolumeRows(pagedFetcher(2300, { failAtOffset: 1000, failWith: { message: "x" } }), "a")).complete, false);
});
await test("retrieval: primera pagina null => INCOMPLETE; nunca se convierte en 0", async () => {
  const res = await fetchTrainingVolumeRows(async () => null, "a");
  assert.equal(res.complete, false);
  const m = compute(res.rows, { complete: res.complete });
  assert.equal(m.showCard, false);
});
await test("retrieval: safety cap sin pagina corta => INCOMPLETE", async () => {
  const f = pagedFetcher(1e9);
  const res = await fetchTrainingVolumeRows(f, "a", { maxPages: 3 });
  assert.equal(res.complete, false);
  assert.equal(f.calls.length, 3);
  assert.equal(res.rows.length, 3000);
  assert.ok(DEFAULT_MAX_PAGES >= 5);
});
await test("retrieval: alumnoId o fetchPage ausentes => INCOMPLETE (sin pedir nada)", async () => {
  assert.equal((await fetchTrainingVolumeRows(null, "a")).complete, false);
  const f = pagedFetcher(10);
  assert.equal((await fetchTrainingVolumeRows(f, "")).complete, false);
  assert.equal((await fetchTrainingVolumeRows(f, null)).complete, false);
  assert.equal(f.calls.length, 0);
});
await test("retrieval: ruta = columnas minimas, alumno, created_at gte cutoff (prefiltro), orden estable, limit/offset", () => {
  const p = buildProgressPagePath("76fb8876-270a-4fa6-9b7a-f664e0b42799", "2026-08-08T00:00:00.000Z", 2000);
  assert.ok(p.startsWith("progreso?alumno_id=eq.76fb8876-270a-4fa6-9b7a-f664e0b42799"));
  assert.ok(p.includes("select=id,ejercicio_id,kg,reps,fecha,semana,nota,created_at"));
  assert.ok(p.includes("created_at=gte.2026-08-08T00%3A00%3A00.000Z"));
  assert.ok(p.includes("order=created_at.desc,id.desc"));
  assert.ok(p.endsWith("limit=1000&offset=2000"));
  assert.ok(!/fecha=(gte|lte|gt|lt)\./.test(p), "no filtra por fecha (texto) en el servidor");
});

// ------------------------------------------------------------------ 10. Evi (referencia)
// Q1 agregado por ejercicio+fecha (3 series cada una). Se reproduce con UNA fila sintetica por agregado
// (kg = volumen, reps = 1): preserva exactamente totales por ejercicio/dia; la multiplicidad se prueba arriba.
const EVI = [
  ["dbrow", "1/9/2026", 300], ["land", "1/9/2026", 435], ["legext", "1/9/2026", 1755], ["lp", "1/9/2026", 2400], ["sldl", "1/9/2026", 480], ["sq", "1/9/2026", 640], ["tric3", "1/9/2026", 300],
  ["bsq", "3/9/2026", 300], ["ccurl", "3/9/2026", 150], ["core_remo_renegado", "3/9/2026", 144], ["custom_1778697447353", "3/9/2026", 200], ["hip", "3/9/2026", 1860], ["lboxup", "3/9/2026", 270], ["lc", "3/9/2026", 1080], ["pullover", "3/9/2026", 180], ["pusu", "3/9/2026", 230],
  ["dbrow", "7/9/2026", 300], ["land", "7/9/2026", 437.5], ["legext", "7/9/2026", 2025], ["lp", "7/9/2026", 2600], ["sldl", "7/9/2026", 440], ["sq", "7/9/2026", 680], ["tric3", "7/9/2026", 75],
  ["bsq", "9/9/2026", 300], ["ccurl", "9/9/2026", 150], ["core_remo_renegado", "9/9/2026", 144], ["custom_1778697447353", "9/9/2026", 270], ["hip", "9/9/2026", 2160], ["lboxup", "9/9/2026", 360], ["lc", "9/9/2026", 1080], ["pullover", "9/9/2026", 150], ["pusu", "9/9/2026", 150],
  ["dbrow", "14/9/2026", 300], ["land", "14/9/2026", 495], ["sq", "14/9/2026", 900],
  ["dbrow", "29/9/2026", 300], ["land", "29/9/2026", 180], ["legext", "29/9/2026", 2250], ["lp", "29/9/2026", 2400], ["sldl", "29/9/2026", 360], ["sq", "29/9/2026", 600], ["tric3", "29/9/2026", 90],
];
await test("Evi (today=2026-10-05): resultado de referencia del preflight", () => {
  const rows = EVI.map(([id, fecha, vol]) => row(id, vol, 1, fecha));
  const m = compute(rows);
  assert.equal(m.currentTotal, 12075);
  assert.equal(formatVolume(m.currentTotal), "12.075 kg");
  assert.deepEqual(m.blocks.map((b) => b.kg), [5895, 0, 0, 6180]);
  assert.equal(m.previousTotal, 16707.5);
  assert.equal(m.commonExercises.length, 13);
  assert.equal(m.currentComparable, 12075);
  assert.equal(m.previousComparable, 16707.5);
  assert.ok(Math.abs(m.pct - -27.727068681729764) < 1e-9);
  assert.equal(Math.round(m.pct), -28);
  assert.equal(m.showPct, false);
  assert.deepEqual(m.pctHiddenReasons, ["PREVIOUS_span_<7_dias"]);
  assert.deepEqual(m.currentDays.map(formatDayShort), ["09/09", "14/09", "29/09"]);
  assert.deepEqual(m.previousDays.map(formatDayShort), ["01/09", "03/09", "07/09"]);
  assert.equal(m.comparableCurrentDays.length, 3);
  assert.equal(m.comparablePreviousDays.length, 3);
  assert.equal(m.previousHistorySpan, 6, "7/9 - 1/9");
  assert.equal(m.showCard, true);
  const by = m.diagnostics.byReason;
  assert.deepEqual(Object.keys(by.patron_no_fuerza.ids), ["core_remo_renegado"]);
  assert.deepEqual(Object.keys(by.no_resoluble.ids), ["custom_1778697447353"]);
  assert.deepEqual(Object.keys(by.peso_corporal_o_asistido.ids), ["pusu"]);
  assert.equal(by.patron_no_fuerza.volume, 288);
  assert.equal(by.no_resoluble.volume, 470);
  assert.equal(by.peso_corporal_o_asistido.volume, 380);
  assert.deepEqual(Object.keys(m.currentByExercise).concat(Object.keys(m.previousByExercise)).filter((id) => id.startsWith("custom")), [], "ningun custom se cuenta");
});

// ------------------------------------------------------------------ 11. vista (copy, accesibilidad, color neutro)
const reactVersionDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(reactVersionDir, "node_modules", ".cache", "irontrack-tests");
mkdirSync(outDir, { recursive: true });
const { build } = await import("esbuild");
const outfile = path.join(outDir, "StudentTrainingVolumeCard.mjs");
await build({
  entryPoints: [path.join(reactVersionDir, "components/student-plan/StudentTrainingVolumeCard.jsx")],
  bundle: true, format: "esm", platform: "node", outfile, external: ["react", "react-dom"], logLevel: "silent",
});
const { TrainingVolumeCardView, TrainingVolumeDetailView } = await import(pathToFileURL(outfile).href + "?t=" + Date.now());
const React = (await import("react")).default;
const { renderToStaticMarkup } = (await import("react-dom/server")).default || (await import("react-dom/server"));
const msg = (es) => es;
const render = (model, dm = false) => renderToStaticMarkup(React.createElement(TrainingVolumeCardView, { model, _dm: dm, textMuted: "#64748B", msg }));
const eviModel = () => compute(EVI.map(([id, fecha, vol]) => row(id, vol, 1, fecha)));

await test("vista Evi: titulo, subtitulo, 12.075 kg, SIN porcentaje, 4 barras 5895/0/0/6180", () => {
  const html = render(eviModel());
  assert.ok(html.includes("Volumen de entrenamiento"));
  assert.ok(html.includes("Últimas 4 semanas · kg × reps"));
  assert.ok(html.includes("12.075 kg"));
  assert.ok(!html.includes("training-volume-pct"), "sin porcentaje");
  assert.ok(!html.includes("vs 4 sem. anteriores"));
  ["B1", "B2", "B3", "B4"].forEach((k) => assert.ok(html.includes('data-block="' + k + '"'), k));
  assert.deepEqual([...html.matchAll(/data-block="B\d" data-kg="(\d+)"/g)].map((m) => Number(m[1])), [5895, 0, 0, 6180]);
});
await test("vista: aria-label describe los 4 volumenes y rangos (B4 = 29/09 al 05/10)", () => {
  const html = render(eviModel());
  const label = /role="img" aria-label="([^"]+)"/.exec(html)[1];
  assert.ok(label.includes("08/09 al 14/09: 5.895 kg"));
  assert.ok(label.includes("15/09 al 21/09: 0 kg"));
  assert.ok(label.includes("22/09 al 28/09: 0 kg"));
  assert.ok(label.includes("29/09 al 05/10: 6.180 kg"));
});
await test("vista: tooltip con los tres textos aprobados", () => {
  const html = render(eviModel());
  assert.ok(html.includes("El porcentaje compara únicamente ejercicios que registraste en ambos períodos."));
  assert.ok(html.includes("Más volumen no siempre significa mejor rendimiento."));
  assert.ok(html.includes("No incluye ejercicios con peso corporal ni de tiempo."));
});
await test("vista: con porcentaje visible muestra '+50% vs 4 sem. anteriores' en color neutro", () => {
  const rows = [].concat(exSets("sq", 1), exSets("sq", 10, 2), exSets("lp", 20, 3), exSets("sq", 30), exSets("lp", 44), exSets("sq", 38), exSets("lp", 50));
  const m = compute(rows);
  assert.equal(m.showPct, true);
  const html = render(m);
  assert.ok(html.includes("training-volume-pct"));
  assert.match(html, />\+?-?\d+% vs 4 sem\. anteriores</);
  assert.ok(html.includes(m.pctLabel + " vs 4 sem. anteriores"));
});
await test("vista: color neutro (ni verde, ni rojo, ni ambar) con pct positivo y negativo, claro y oscuro", () => {
  const forbidden = /#22C55E|#16A34A|#4ADE80|#10B981|#EF4444|#DC2626|#F87171|#B91C1C|#F59E0B|#D97706|#FBBF24|#EAB308/i;
  const mk = (cur, prev) => compute([].concat(exSets("sq", 1, cur), exSets("lp", 9, cur), exSets("sq", 30, prev), exSets("lp", 44, prev)));
  [mk(5, 1), mk(1, 5), mk(2, 2)].forEach((m) => {
    assert.equal(m.showPct, true);
    [false, true].forEach((dm) => assert.ok(!forbidden.test(render(m, dm)), "pct " + m.pctLabel));
  });
  // el pct se pinta con el color neutro textMuted, no con uno dependiente del signo
  const colors = [mk(5, 1), mk(1, 5)].map((m) => /training-volume-pct" style="[^"]*color:([^;"]+)/.exec(render(m))[1]);
  assert.equal(colors[0], colors[1]);
  assert.equal(colors[0], "#64748B");
});
await test("vista: B4 destacada (unica barra azul de marca) y semanas vacias presentes", () => {
  const html = render(eviModel());
  const bars = [...html.matchAll(/data-block="(B\d)"[^>]*>.*?background:([^;]+);/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(bars.map((b) => b[0]), ["B1", "B2", "B3", "B4"]);
  assert.deepEqual(bars.filter((b) => b[1] === "#2563EB").map((b) => b[0]), ["B4"]);
});
await test("vista: oculta (null) si no hay modelo o showCard=false (incluye retrieval incompleto)", () => {
  assert.equal(render(null), "");
  assert.equal(render(compute([rowOff("sq", 50, 5, 1)])), "");
  assert.equal(render(compute(goodPctRows(), { complete: false })), "");
});
await test("vista: ingles", () => {
  const html = renderToStaticMarkup(React.createElement(TrainingVolumeCardView, { model: eviModel(), _dm: false, textMuted: "#64748B", msg: (es, en) => en }));
  assert.ok(html.includes("Training volume"));
  assert.ok(html.includes("Last 4 weeks · kg × reps"));
});

// ------------------------------------------------------------------ 12. regresion QA preview: pct matematico existente + showPct=false => NO se renderiza
const { buildTrainingVolumeModel } = V;
const eviRemote = () => EVI.map(([id, fecha, vol], i) => ({ id: i + 1, ejercicio_id: id, kg: vol, reps: 1, fecha, semana: 1, nota: "", created_at: "2026-09-01T00:00:00Z" }));
// Misma tuberia que el contenedor: fetch paginado -> merge remoto+local -> modelo -> vista.
const eviPipeline = async (now) => {
  const remote = await fetchTrainingVolumeRows(async (p) => (/offset=0\b/.test(p) ? eviRemote() : []), "76fb8876-270a-4fa6-9b7a-f664e0b42799", { now });
  return buildTrainingVolumeModel(remote, {}, [], now);
};
const noPctMarkup = (html) => !html.includes("training-volume-pct") && !html.includes("vs 4 sem. anteriores") && !/-?\d+% vs/.test(html) && !html.includes("-28%");

await test("vista (gate): pct matematico finito + showPct=false => NO renderiza porcentaje, aunque exista pctLabel", () => {
  const m = eviModel();
  assert.ok(Number.isFinite(m.pct), "el pct matematico existe");
  assert.equal(m.showPct, false);
  assert.ok(noPctMarkup(render(m)));
  // aun si pctLabel llegara poblado, la vista respeta showPct
  const forced = Object.assign({}, m, { pctLabel: "-28%", showPct: false });
  assert.ok(noPctMarkup(render(forced)));
  assert.ok(noPctMarkup(render(forced, true)));
  // y con showPct=true si se renderiza (el gate es la unica diferencia)
  assert.ok(render(Object.assign({}, forced, { showPct: true })).includes("-28% vs 4 sem. anteriores"));
});
await test("integracion Evi, hoy = 2026-10-05: showPct=false (span PREVIOUS 6) y la UI NO muestra '-28% vs 4 sem. anteriores'", async () => {
  const now = new Date(2026, 9, 5, 10);
  const m = await eviPipeline(now);
  assert.equal(todayDayNum(now), T);
  assert.equal(m.currentTotal, 12075);
  assert.deepEqual(m.blocks.map((b) => b.kg), [5895, 0, 0, 6180]);
  assert.ok(Math.abs(m.pct - -27.727068681729764) < 1e-9);
  assert.equal(m.showPct, false);
  assert.deepEqual(m.pctHiddenReasons, ["PREVIOUS_span_<7_dias"]);
  assert.equal(m.previousHistorySpan, 6);
  const html = render(m);
  assert.ok(html.includes("12.075 kg"));
  assert.ok(noPctMarkup(html));
});
await test("integracion: lectura incompleta o con error => sin modelo => sin card (nunca pct ni 0 kg)", async () => {
  const bad = await fetchTrainingVolumeRows(async () => null, "a", { now: new Date(2026, 9, 5) });
  assert.equal(buildTrainingVolumeModel(bad, {}, [], new Date(2026, 9, 5)), null);
  assert.equal(render(buildTrainingVolumeModel(bad, {}, [], new Date(2026, 9, 5))), "");
  assert.equal(buildTrainingVolumeModel(null, {}, [], new Date()), null);
});
// Evi con today = 2026-10-06: el 1/9 cruza de P4 a P3 (off 34 -> 35), pero la regla de confianza ya NO usa bloques de
// 7 dias sino la separacion entre dias comparables (7/9 - 1/9 = 6 < 7), asi que el porcentaje sigue oculto.
await test("Evi, hoy = 2026-10-06: sin porcentaje (span 6); el pct matematico sigue siendo ~-28%; 12.075 kg; barras 5895/0/6180/0", async () => {
  const m = await eviPipeline(new Date(2026, 9, 6, 10));
  assert.equal(m.currentTotal, 12075);
  assert.equal(formatVolume(m.currentTotal), "12.075 kg");
  assert.deepEqual(m.blocks.map((b) => b.kg), [5895, 0, 6180, 0], "29/9 es off 7 => B3; B4 (off 6..0) queda en 0");
  assert.equal(m.previousHistorySpan, 6);
  assert.ok(Math.abs(m.pct - -27.727068681729764) < 1e-9);
  assert.equal(Math.round(m.pct), -28);
  assert.equal(m.showPct, false);
  assert.deepEqual(m.pctHiddenReasons, ["PREVIOUS_span_<7_dias"]);
  assert.equal(m.pctLabel, null);
  const html = render(m);
  assert.ok(html.includes("12.075 kg"));
  assert.ok(noPctMarkup(html));
});
await test("mover today un dia (5/10 -> 6/10) no habilita el porcentaje de Evi solo por cruzar el borde de un bloque", async () => {
  const a = await eviPipeline(new Date(2026, 9, 5, 10));
  const b = await eviPipeline(new Date(2026, 9, 6, 10));
  assert.equal(a.showPct, false);
  assert.equal(b.showPct, false);
  assert.equal(a.previousHistorySpan, b.previousHistorySpan);
  assert.deepEqual(a.comparablePreviousDays, b.comparablePreviousDays);
  assert.deepEqual(a.pctHiddenReasons, b.pctHiddenReasons);
  assert.equal(a.pct, b.pct, "el calculo matematico no cambia");
  assert.equal(a.currentTotal, b.currentTotal);
  assert.ok(noPctMarkup(render(a)) && noPctMarkup(render(b)));
});

// ------------------------------------------------------------------ 13. unidad kg + detalle por periodo
const { groupThousandsEs, formatDayRange, formatDayRow, blockAxisLabel, blockRelativeReference, stepPeriod } = V;
const WD = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const sumDays = (b) => b.days.reduce((a, d) => a + d.kg, 0);
const renderDetail = (model, selected, dm = false) => renderToStaticMarkup(React.createElement(TrainingVolumeDetailView, { model, selected, _dm: dm, textMuted: "#64748B", msg }));
const eviOct5 = () => eviPipeline(new Date(2026, 9, 5, 10));
const eviOct6 = () => eviPipeline(new Date(2026, 9, 6, 10));

await test("kg: 12075 -> '12.075 kg' (separador de miles espanol, tambien en 4 digitos: 6.180)", () => {
  assert.equal(formatVolume(12075), "12.075 kg");
  assert.equal(formatVolume(6180), "6.180 kg");
  assert.equal(formatVolume(1234567), "1.234.567 kg");
  assert.equal(formatVolume(999.6), "1.000 kg");
  assert.equal(formatVolume(0), "0 kg");
  assert.equal(groupThousandsEs(1000), "1.000");
  assert.equal(groupThousandsEs(999), "999");
});
await test("kg: nunca se convierte a toneladas (barrido de valores y de markup)", async () => {
  const values = [0, 0.4, 1, 840, 999, 999.5, 1000, 1500.5, 3200, 9999, 12075, 99999.9, 100000, 1e6, 12345678];
  for (let i = 0; i < 500; i++) values.push(Math.random() * 3e5);
  values.forEach((v) => {
    const f = formatVolume(v);
    assert.match(f, /^\d{1,3}(\.\d{3})* kg$/, String(v));
    assert.ok(!/ t$/.test(f) && !f.includes(","), String(v));
  });
  const m = await eviOct6();
  const markups = [render(m), render(m, true)].concat([0, 1, 2, 3].map((i) => renderDetail(m, i)));
  markups.forEach((html) => {
    assert.ok(!/\d,\d t\b/.test(html) && !/\d t</.test(html), "sin toneladas");
    assert.ok(!html.includes("12,1"));
  });
});

await test("totales de cada uno de los cuatro periodos (Evi 5/10 y 6/10)", async () => {
  assert.deepEqual((await eviOct5()).blocks.map((b) => b.kg), [5895, 0, 0, 6180]);
  assert.deepEqual((await eviOct6()).blocks.map((b) => b.kg), [5895, 0, 6180, 0]);
});
await test("agregacion por dia (Evi): solo dias con volumen valido > 0, mismas series validas que el total", async () => {
  const a = await eviOct5();
  const dayList = (b) => b.days.map((d) => formatDayShort(d.day) + "=" + d.kg);
  assert.deepEqual(dayList(a.blocks[0]), ["09/09=4200", "14/09=1695"]);
  assert.deepEqual(dayList(a.blocks[1]), []);
  assert.deepEqual(dayList(a.blocks[2]), []);
  assert.deepEqual(dayList(a.blocks[3]), ["29/09=6180"]);
  const b = await eviOct6();
  assert.deepEqual(dayList(b.blocks[2]), ["29/09=6180"]);
  assert.deepEqual(dayList(b.blocks[3]), []);
  // 9/9 tuvo 564 kg de series excluidas (remo renegado, custom, dominadas): NO suman al dia
  assert.equal(a.blocks[0].days[0].kg, 4200);
});
await test("multiples entrenamientos en el mismo periodo y varias series el mismo dia", () => {
  const m = compute([
    rowOff("sq", 60, 8, 6), rowOff("sq", 60, 8, 6), rowOff("lp", 100, 10, 6),   // dia off 6: 480+480+1000 = 1960
    rowOff("sq", 50, 5, 4),                                                    // 250
    rowOff("lp", 80, 10, 0),                                                   // 800
  ]);
  const b4 = m.blocks[3];
  assert.equal(b4.kg, 1960 + 250 + 800);
  assert.deepEqual(b4.days.map((d) => d.kg), [1960, 250, 800]);
  assert.deepEqual(b4.days.map((d) => d.day), [T - 6, T - 4, T], "orden cronologico (mas antiguo primero)");
  assert.equal(b4.days.length, 3, "tres dias entrenados => tres filas");
});
await test("periodo vacio: 0 kg, sin dias (no se inventan dias ni sesiones)", () => {
  const m = compute([rowOff("sq", 10, 10, 27), rowOff("sq", 10, 10, 1)]);
  [1, 2].forEach((i) => { assert.equal(m.blocks[i].kg, 0); assert.deepEqual(m.blocks[i].days, []); });
  assert.deepEqual(compute([]).blocks.map((b) => b.days.length), [0, 0, 0, 0]);
});
await test("suma de los dias = total del periodo; suma de periodos = currentTotal", async () => {
  [await eviOct5(), await eviOct6(), compute([rowOff("sq", 62.5, 8, 3), rowOff("lp", 87.5, 12, 3), rowOff("sq", 32.5, 6, 17), rowOff("legext", 41.25, 9, 25), rowOff("legext", 41.25, 9, 24)])].forEach((m) => {
    m.blocks.forEach((b) => assert.equal(sumDays(b), b.kg, b.key));
    assert.equal(m.blocks.reduce((a, b) => a + b.kg, 0), m.currentTotal);
  });
});
await test("limites exactos de los periodos: off 0/6 (B4), 7/13 (B3), 14/20 (B2), 21/27 (B1); 28 no entra", () => {
  const expectBlock = { 0: 3, 6: 3, 7: 2, 13: 2, 14: 1, 20: 1, 21: 0, 27: 0 };
  Object.keys(expectBlock).forEach((off) => {
    const only = compute([rowOff("sq", 10, 1, Number(off))]);
    only.blocks.forEach((b, i) => {
      assert.equal(b.kg, i === expectBlock[off] ? 10 : 0, "off " + off + " bloque " + b.key);
      assert.equal(b.days.length, i === expectBlock[off] ? 1 : 0);
    });
    assert.equal(only.blocks[expectBlock[off]].days[0].day, T - Number(off));
  });
  assert.equal(compute([rowOff("sq", 10, 1, 28)]).blocks.every((b) => b.kg === 0 && b.days.length === 0), true);
});
await test("etiquetas del grafico (pasado -> presente): 22-28 dias, 15-21 dias, 8-14 dias, Ult. 7 dias", async () => {
  const m = await eviOct5();
  assert.deepEqual(m.blocks.map((b) => blockAxisLabel(b, "es")), ["22–28 días", "15–21 días", "8–14 días", "Últ. 7 días"]);
  assert.deepEqual(m.blocks.map((b) => blockAxisLabel(b, "en")), ["22–28 days", "15–21 days", "8–14 days", "Last 7 days"]);
  assert.deepEqual(m.blocks.map((b) => [b.from, b.to]), [[27, 21], [20, 14], [13, 7], [6, 0]], "limites matematicos intactos");
  const html = render(m);
  const pos = ["22–28 días", "15–21 días", "8–14 días", "Últ. 7 días"].map((l) => html.indexOf(l));
  assert.ok(pos.every((p) => p >= 0) && pos.every((p, i) => !i || p > pos[i - 1]), "orden cronologico izquierda -> derecha");
});
await test("fechas del detalle: rango calendario real, referencia relativa y dia de la semana", async () => {
  const m = await eviOct6();
  assert.deepEqual(m.blocks.map((b) => formatDayRange(b.startDay, b.endDay, "es")), ["9 – 15 sep", "16 – 22 sep", "23 – 29 sep", "30 sep – 6 oct"]);
  assert.equal(blockRelativeReference(m.blocks[2], "es"), "8–14 días atrás");
  assert.equal(blockRelativeReference(m.blocks[3], "es"), "Últimos 7 días");
  assert.equal(formatDayRange(dayNum(2026, 9, 28), dayNum(2026, 10, 4), "es"), "28 sep – 4 oct");
  const wd = new Date(Date.UTC(2026, 8, 29)).getUTCDay();
  assert.equal(formatDayRow(dayNum(2026, 9, 29), "es"), WD[wd] + " 29 sep");
  assert.equal(formatDayRow(dayNum(2026, 9, 28), "es"), WD[(wd + 6) % 7] + " 28 sep");
});
await test("navegacion anterior/siguiente: se detiene en los limites de los 4 periodos", () => {
  assert.equal(stepPeriod(0, -1), 0);
  assert.equal(stepPeriod(3, 1), 3);
  assert.equal(stepPeriod(1, -1), 0);
  assert.equal(stepPeriod(2, 1), 3);
  assert.equal(stepPeriod(3, -1), 2);
  assert.equal(stepPeriod(-5, 0), 0);
  assert.equal(stepPeriod(9, 0), 3);
  let i = 3; for (let k = 0; k < 10; k++) i = stepPeriod(i, -1); assert.equal(i, 0);
  for (let k = 0; k < 10; k++) i = stepPeriod(i, 1); assert.equal(i, 3);
});
await test("card: kg, 'Ver detalle ›' discreto, 4 barras, sin toneladas", async () => {
  const html = render(await eviOct5());
  assert.ok(html.includes("12.075 kg"));
  assert.ok(html.includes("Volumen de entrenamiento") && html.includes("Últimas 4 semanas · kg × reps"));
  assert.match(html, /data-testid="training-volume-open-detail"[^>]*>Ver detalle ›</);
  assert.ok(html.includes("min-height:44px"), "target tactil >= 44px");
  assert.deepEqual([...html.matchAll(/data-block="B\d" data-kg="(\d+)"/g)].map((x) => Number(x[1])), [5895, 0, 0, 6180]);
  assert.ok(!/<(div|span)[^>]*data-block="B\d"[^>]*onclick/i.test(html), "las barras no son el mecanismo de navegacion");
  assert.ok(!/<button[^>]*data-block/.test(html));
});
await test("detalle: encabezado, rango, referencia, total, 'Volumen de la semana', Entrenamientos y filas por dia", async () => {
  const m = await eviOct6();
  const html = renderDetail(m, 2); // B3: 23 – 29 sep
  assert.ok(html.includes("Detalle de volumen") && html.includes("Historial de las últimas 4 semanas"));
  assert.ok(html.includes(">23 – 29 sep<") && html.includes(">8–14 días atrás<"));
  assert.match(html, /data-testid="training-volume-period-total"[^>]*>6\.180 kg</);
  assert.ok(html.includes("Volumen de la semana") && html.includes("Entrenamientos"));
  const rows = [...html.matchAll(/data-testid="training-volume-day"[^>]*>(.*?)<\/div>/g)];
  assert.equal(rows.length, 1);
  assert.ok(rows[0][1].includes(formatDayRow(dayNum(2026, 9, 29), "es")) && rows[0][1].includes("6.180 kg"));
  // varios dias: B1 de Evi tiene dos filas con 4.200 y 1.695
  const b1 = renderDetail(m, 0);
  assert.equal([...b1.matchAll(/data-testid="training-volume-day"/g)].length, 2);
  assert.ok(b1.includes("4.200 kg") && b1.includes("1.695 kg") && b1.includes(">5.895 kg<"));
});
await test("detalle: tres dias entrenados => tres filas; periodo vacio => '0 kg' + mensaje y ninguna fila", async () => {
  const three = compute([rowOff("sq", 60, 8, 6), rowOff("sq", 60, 8, 3), rowOff("lp", 100, 10, 0), rowOff("sq", 50, 5, 20)]);
  assert.equal([...renderDetail(three, 3).matchAll(/data-testid="training-volume-day"/g)].length, 3);
  const empty = renderDetail(await eviOct6(), 1); // B2 vacio
  assert.match(empty, /data-testid="training-volume-period-total"[^>]*>0 kg</);
  assert.ok(empty.includes("Sin entrenamientos registrados en este período."));
  assert.ok(!empty.includes("training-volume-day"));
  assert.ok(empty.includes(">16 – 22 sep<"));
});
await test("detalle: flechas anterior/siguiente deshabilitadas en los extremos; volver accesible; targets tactiles >= 44px", async () => {
  const m = await eviOct5();
  const disabled = (html, id) => new RegExp('data-testid="' + id + '"[^>]*disabled').test(html);
  [[0, true, false], [1, false, false], [2, false, false], [3, false, true]].forEach(([i, prevD, nextD]) => {
    const html = renderDetail(m, i);
    assert.equal(disabled(html, "training-volume-prev"), prevD, "prev en " + i);
    assert.equal(disabled(html, "training-volume-next"), nextD, "next en " + i);
    assert.ok(html.includes('aria-label="Período anterior"') && html.includes('aria-label="Período siguiente"'));
    assert.match(html, /data-testid="training-volume-back"[^>]*aria-label="Volver"/);
    assert.ok((html.match(/width:44px;height:44px/g) || []).length >= 3, "volver, anterior y siguiente >= 44px");
  });
  assert.equal(renderDetail(m, 99).includes(">Últimos 7 días<"), true, "indice fuera de rango se acota al ultimo periodo");
  assert.equal(renderDetail(m, -3).includes(">22–28 días atrás<"), true, "indice negativo se acota al primero");
});
await test("detalle: oculto si no hay modelo / card oculta; ingles", async () => {
  assert.equal(renderDetail(null, 0), "");
  assert.equal(renderDetail(compute([rowOff("sq", 50, 5, 1)]), 0), "");
  const en = renderToStaticMarkup(React.createElement(TrainingVolumeDetailView, { model: await eviOct5(), selected: 3, _dm: false, textMuted: "#64748B", msg: (es, en2) => en2 }));
  assert.ok(en.includes("Volume detail") && en.includes("Workouts") && en.includes("Last 7 days"));
});

console.log(count + " tests OK");
