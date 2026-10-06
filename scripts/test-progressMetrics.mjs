// Parsing de progreso.fecha (d/m/yyyy) en components/student-progress/progressMetrics.js + lib/progressDate.js.
//
//   node scripts/test-progressMetrics.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sale con codigo != 0 en el primer fallo.
// Corre con zona horaria de EEUU (con DST): todo debe depender del calendario local, no de milisegundos.

process.env.TZ = "America/New_York";

import assert from "node:assert/strict";

const PD = await import("../lib/progressDate.js");
const PM = await import("../components/student-progress/progressMetrics.js");
const TV = await import("../lib/trainingVolume.js");
const {
  parseProgressDate, dayKeyFromAny, mergeSetsForExercise, buildWeeklyVolumeModel, trainingDaysThisWeek,
  computeDayStreak, countPRsThisMonth, filterRowsByRange, averageImprovementPercent, collectAllProgressRows,
  hasAnyTrainingData,
} = PM;

let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("ok -", name);
}

const ymd = (d) => (d ? [d.getFullYear(), d.getMonth() + 1, d.getDate()].join("-") : null);
const RealDate = Date;
/** Fija "ahora" (new Date() sin args y Date.now) durante fn. */
function withNow(y, m, d, fn) {
  const fixed = new RealDate(y, m - 1, d, 12, 0, 0).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  };
  try { return fn(new RealDate(fixed)); } finally { globalThis.Date = RealDate; }
}
const row = (fecha, kg, reps, ex) => ({ ejercicio_id: ex || "e1", fecha, kg, reps: reps == null ? 10 : reps });

// ---------------------------------------------------------------- A. parsing
test("A. parseProgressDate: casos reales d/m/yyyy", () => {
  const cases = {
    "1/9/2026": "2026-9-1", "3/9/2026": "2026-9-3", "5/10/2026": "2026-10-5", "7/9/2026": "2026-9-7",
    "9/9/2026": "2026-9-9", "14/9/2026": "2026-9-14", "29/9/2026": "2026-9-29", "30/9/2026": "2026-9-30",
    "6/10/2026": "2026-10-6", "05/10/2026": "2026-10-5", " 5/10/2026 ": "2026-10-5",
  };
  Object.keys(cases).forEach((k) => assert.equal(ymd(parseProgressDate(k)), cases[k], k));
});

test("A. parseProgressDate devuelve Date local a medianoche", () => {
  const d = parseProgressDate("5/10/2026");
  assert.ok(d instanceof Date);
  assert.equal(d.getHours(), 0);
  assert.equal(d.getMinutes(), 0);
});

test("A. REGRESION: 5/10/2026 es 5 de octubre y NO 10 de mayo", () => {
  const d = parseProgressDate("5/10/2026");
  assert.equal(d.getMonth(), 9);
  assert.equal(d.getDate(), 5);
  assert.notEqual(ymd(d), "2026-5-10");
  assert.equal(ymd(parseProgressDate("6/10/2026")), "2026-10-6"); // no 10 de junio
  assert.equal(ymd(parseProgressDate("1/9/2026")), "2026-9-1"); // no 9 de enero
});

// ---------------------------------------------------------------- B. invalidos
test("B. invalidos => null", () => {
  [undefined, null, "", "   ", "31/2/2026", "0/10/2026", "5/13/2026", "5/0/2026", "32/1/2026", "5/10/1999", "5/10/2101",
    "5-10-2026", "5/10/26", "abc", 20260510, {}].forEach((v) => assert.equal(parseProgressDate(v), null, String(v)));
});

test("B. parseFechaDMY compartido: misma semantica (dayNum UTC) y trainingVolume lo re-exporta", () => {
  assert.equal(PD.parseFechaDMY("5/10/2026"), PD.dayNum(2026, 10, 5));
  assert.equal(PD.parseFechaDMY("31/2/2026"), null);
  assert.equal(TV.parseFechaDMY, PD.parseFechaDMY);
  assert.equal(TV.dayNum, PD.dayNum);
});

test("B. ISO explicito controlado (created_at) y nada mas", () => {
  assert.equal(ymd(parseProgressDate("2026-10-03")), "2026-10-3");
  assert.ok(parseProgressDate("2026-10-03T14:45:29.945531+00:00") instanceof Date);
  assert.equal(parseProgressDate("2026-13-40"), null);
  assert.equal(parseProgressDate("2026-02-30"), null);
  assert.equal(parseProgressDate("Oct 5, 2026"), null); // sin parsing libre del motor
  assert.equal(parseProgressDate("2026-10-05basura"), null);
});

// ---------------------------------------------------------------- C. fronteras
test("C. septiembre -> octubre", () => {
  assert.equal(ymd(parseProgressDate("30/9/2026")), "2026-9-30");
  assert.equal(ymd(parseProgressDate("1/10/2026")), "2026-10-1");
  assert.ok(parseProgressDate("30/9/2026") < parseProgressDate("1/10/2026"));
  assert.equal(parseProgressDate("31/9/2026"), null);
});

test("C. diciembre -> enero", () => {
  assert.equal(ymd(parseProgressDate("31/12/2026")), "2026-12-31");
  assert.equal(ymd(parseProgressDate("1/1/2027")), "2027-1-1");
  assert.ok(parseProgressDate("31/12/2026") < parseProgressDate("1/1/2027"));
  assert.equal(dayKeyFromAny("1/1/2027"), "2027-01-01");
});

test("C. anio bisiesto", () => {
  assert.equal(ymd(parseProgressDate("29/2/2028")), "2028-2-29");
  assert.equal(parseProgressDate("29/2/2027"), null);
  assert.equal(parseProgressDate("29/2/2100"), null); // 2100 no es bisiesto
});

test("C. dayKeyFromAny usa d/m/yyyy", () => {
  assert.equal(dayKeyFromAny("5/10/2026"), "2026-10-05");
  assert.equal(dayKeyFromAny("14/9/2026"), "2026-09-14");
  assert.equal(dayKeyFromAny("31/2/2026"), null);
});

// ---------------------------------------------------------------- D. mergeSetsForExercise
test("D. orden cronologico (septiembre antes que octubre, 1 y 2 digitos)", () => {
  const sb = [row("5/10/2026", 110), row("14/9/2026", 80), row("1/10/2026", 100), row("29/9/2026", 90)];
  const out = mergeSetsForExercise("e1", {}, sb).map((r) => r.fecha);
  assert.deepEqual(out, ["14/9/2026", "29/9/2026", "1/10/2026", "5/10/2026"]);
});

test("D. local + remoto se ordenan juntos y cruzan anio", () => {
  const progress = { e1: { sets: [{ kg: "70", reps: "5", date: "2/1/2027" }, { kg: "60", reps: "5", date: "31/12/2026" }] } };
  const sb = [row("1/1/2027", 65), row("30/12/2026", 55)];
  const out = mergeSetsForExercise("e1", progress, sb).map((r) => r.fecha);
  assert.deepEqual(out, ["30/12/2026", "31/12/2026", "1/1/2027", "2/1/2027"]);
});

test("D. slice(-20): ultimas 20 filas cronologicas (25 dias de septiembre)", () => {
  const sb = [];
  for (let d = 25; d >= 1; d--) sb.push(row(d + "/9/2026", 40 + d));
  const out = mergeSetsForExercise("e1", {}, sb);
  assert.equal(out.length, 20);
  assert.equal(out[0].fecha, "6/9/2026");
  assert.equal(out[19].fecha, "25/9/2026");
});

test("D. slice(-20) cruzando de mes: octubre queda al final", () => {
  const sb = [];
  for (let d = 1; d <= 15; d++) sb.push(row(d + "/10/2026", 100 + d));
  for (let d = 20; d <= 30; d++) sb.push(row(d + "/9/2026", 50 + d));
  const out = mergeSetsForExercise("e1", {}, sb);
  assert.equal(out.length, 20);
  assert.equal(out[19].fecha, "15/10/2026");
  assert.equal(out[0].fecha, "26/9/2026");
});

test("D. dedupe existente (fecha + kg) preservado; ejercicio y kg<=0 filtrados", () => {
  const progress = { e1: { sets: [{ kg: "100", reps: "5", date: "5/10/2026" }] } };
  const sb = [row("5/10/2026", 100, 5), row("5/10/2026", 105), row("4/10/2026", 0), { ...row("3/10/2026", 90), ejercicio_id: "otro" }];
  const out = mergeSetsForExercise("e1", progress, sb);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((r) => r.kg).sort(), [100, 105]);
});

// ---------------------------------------------------------------- E. metricas (hoy = martes 6/10/2026)
const NOW = new RealDate(2026, 9, 6, 12, 0, 0);
const SB_WEEK = [row("5/10/2026", 100, 10), row("6/10/2026", 50, 10), row("29/9/2026", 100, 20), row("1/9/2026", 100, 10)];

test("E. volumen semana actual / previa / delta / sparkline", () => {
  const m = buildWeeklyVolumeModel({}, SB_WEEK, [], NOW);
  assert.equal(m.volWeekTon, 1.5); // 5/10 (1000) + 6/10 (500)
  assert.equal(m.volPrevTon, 2); // 29/9 (2000); 1/9 queda afuera
  assert.equal(m.deltaPct, -25);
  assert.deepEqual(m.sparkDaily, [0, 0, 0, 0, 0, 1, 0.5]); // 30/9 ... 6/10
});

test("E. barras L-D: lunes 5/10 y martes 6/10", () => {
  const m = buildWeeklyVolumeModel({}, SB_WEEK, [], NOW);
  assert.deepEqual(m.weekBars.map((b) => b.dayKey), [
    "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
  ]);
  assert.deepEqual(m.weekBars.map((b) => b.hit), [true, true, false, false, false, false, false]);
  assert.equal(m.weekBars[1].isToday, true);
});

test("E. barras: una sesion con fecha d/m/yyyy marca el dia correcto", () => {
  const m = buildWeeklyVolumeModel({}, [], [{ fecha: "7/10/2026", created_at: "2026-10-07T15:00:00+00:00" }], NOW);
  assert.deepEqual(m.weekBars.map((b) => b.hit), [false, false, true, false, false, false, false]);
});

test("E. progreso local (s.date) tambien suma al volumen", () => {
  const progress = { e1: { sets: [{ kg: "200", reps: "5", date: "5/10/2026" }] } };
  assert.equal(buildWeeklyVolumeModel(progress, [], [], NOW).volWeekTon, 1);
});

test("E. trainingDaysThisWeek", () => {
  assert.equal(trainingDaysThisWeek([], {}, SB_WEEK, NOW), 2);
  const ses = [{ fecha: "7/10/2026", created_at: "2026-10-07T15:00:00+00:00" }];
  assert.equal(trainingDaysThisWeek(ses, {}, SB_WEEK, NOW), 3);
  assert.equal(trainingDaysThisWeek([], {}, [row("29/9/2026", 100), row("1/9/2026", 100)], NOW), 0);
});

test("E. computeDayStreak: 6/10, 5/10, 4/10 => 3; hueco corta", () => {
  withNow(2026, 10, 6, () => {
    const ses = (f) => ({ fecha: f });
    assert.equal(computeDayStreak([ses("6/10/2026"), ses("5/10/2026"), ses("4/10/2026")], {}), 3);
    assert.equal(computeDayStreak([ses("6/10/2026"), ses("5/10/2026"), ses("3/10/2026")], {}), 2);
    assert.equal(computeDayStreak([ses("5/10/2026"), ses("4/10/2026")], {}), 2); // ancla = ayer
    const progress = { e1: { sets: [{ kg: "1", reps: "1", date: "6/10/2026" }, { kg: "1", reps: "1", date: "5/10/2026" }] } };
    assert.equal(computeDayStreak([], progress), 2);
    assert.equal(computeDayStreak([], {}), 0);
  });
});

test("E. computeDayStreak: cruce de mes y de anio", () => {
  withNow(2026, 10, 1, () => {
    assert.equal(computeDayStreak([{ fecha: "1/10/2026" }, { fecha: "30/9/2026" }, { fecha: "29/9/2026" }], {}), 3);
  });
  withNow(2027, 1, 2, () => {
    assert.equal(computeDayStreak([{ fecha: "2/1/2027" }, { fecha: "1/1/2027" }, { fecha: "31/12/2026" }], {}), 3);
  });
});

test("E. countPRsThisMonth: PRs de octubre (1/10 y 5/10), no los de septiembre", () => {
  withNow(2026, 10, 6, () => {
    const sb = [row("14/9/2026", 80), row("29/9/2026", 90), row("1/10/2026", 100), row("5/10/2026", 110)];
    assert.equal(countPRsThisMonth([{ id: "e1" }], [], {}, sb), 2);
    // 5/10 sin superar el maximo previo => no es PR
    const sb2 = [row("14/9/2026", 120), row("1/10/2026", 100), row("5/10/2026", 110)];
    assert.equal(countPRsThisMonth([{ id: "e1" }], [], {}, sb2), 0);
  });
});

test("E. countPRsThisMonth: 5/10/2026 NO cuenta como mayo", () => {
  withNow(2026, 5, 20, () => {
    const sb = [row("14/9/2026", 80), row("5/10/2026", 110)];
    assert.equal(countPRsThisMonth([{ id: "e1" }], [], {}, sb), 0);
  });
});

test("E. filterRowsByRange 1M/3M/6M/1A", () => {
  const datos = [row("1/9/2026", 1), row("7/9/2026", 2), row("5/10/2026", 3), row("10/7/2026", 4), row("1/1/2026", 5), row("31/12/2025", 6)];
  const f = (k) => filterRowsByRange(datos, k, NOW).map((r) => r.fecha);
  assert.deepEqual(f("1M"), ["7/9/2026", "5/10/2026"]); // desde 6/9
  assert.deepEqual(f("3M"), ["1/9/2026", "7/9/2026", "5/10/2026", "10/7/2026"]);
  assert.ok(f("6M").includes("10/7/2026") && !f("6M").includes("1/1/2026"));
  assert.ok(f("1A").includes("1/1/2026"));
  assert.deepEqual(filterRowsByRange([row("31/2/2026", 1)], "1A", NOW), []); // invalida: fuera
  assert.deepEqual(filterRowsByRange([], "1M", NOW), []);
});

test("E. averageImprovementPercent usa primero/ultimo cronologicos", () => {
  // string-sort viejo habria dejado 1/10 antes de 14/9 y dado 100% de mejora al reves
  const sb = [row("1/10/2026", 120), row("14/9/2026", 100)];
  assert.equal(averageImprovementPercent([{ id: "e1" }], [], {}, sb), 20);
});

// ---------------------------------------------------------------- F. series reales repetidas (multiplicidad maxima local<->remoto)
const rep = (n, fecha, kg, reps, ex) => Array.from({ length: n }, () => row(fecha, kg, reps, ex));
const loc = (n, date, kg, reps) => ({ e1: { sets: Array.from({ length: n }, () => ({ kg: String(kg), reps: String(reps), date })) } });
const merged = (progress, sb) => mergeSetsForExercise("e1", progress, sb);
const collected = (progress, sb) => collectAllProgressRows(progress, sb);

test("F1. remote: 3 filas identicas el mismo dia => 3", () => {
  const sb = rep(3, "29/9/2026", 50, 15);
  assert.equal(merged({}, sb).length, 3);
  assert.equal(collected({}, sb).length, 3);
});

test("F2. local 1 + remote 1 identicas => 1", () => {
  const p = loc(1, "29/9/2026", 50, 15);
  const sb = rep(1, "29/9/2026", 50, 15);
  assert.equal(merged(p, sb).length, 1);
  assert.equal(collected(p, sb).length, 1);
});

test("F3. local 2 + remote 3 => 3 (max, no suma)", () => {
  const p = loc(2, "29/9/2026", 50, 15);
  const sb = rep(3, "29/9/2026", 50, 15);
  assert.equal(merged(p, sb).length, 3);
  assert.equal(collected(p, sb).length, 3);
});

test("F4. local 3 + remote 2 => 3 (max, no suma)", () => {
  const p = loc(3, "29/9/2026", 50, 15);
  const sb = rep(2, "29/9/2026", 50, 15);
  assert.equal(merged(p, sb).length, 3);
  assert.equal(collected(p, sb).length, 3);
});

test("F4b. solo local con 3 identicas => 3", () => {
  assert.equal(merged(loc(3, "29/9/2026", 50, 15), []).length, 3);
  assert.equal(collected(loc(3, "29/9/2026", 50, 15), []).length, 3);
});

test("F5. misma fecha y kg, reps distintas => ambas sobreviven", () => {
  const sb = [row("29/9/2026", 50, 15), row("29/9/2026", 50, 12)];
  assert.deepEqual(merged({}, sb).map((r) => r.reps).sort(), [12, 15]);
  assert.equal(collected({}, sb).length, 2);
  const p = loc(1, "29/9/2026", 50, 15);
  assert.equal(merged(p, [row("29/9/2026", 50, 12)]).length, 2);
  assert.equal(collected(p, [row("29/9/2026", 50, 12)]).length, 2);
});

test("F6. mismo ejercicio/fecha, pesos distintos => sobreviven", () => {
  const sb = [row("29/9/2026", 50, 15), row("29/9/2026", 55, 15), row("29/9/2026", 60, 15)];
  assert.equal(merged({}, sb).length, 3);
  assert.equal(collected({}, sb).length, 3);
});

test("F7. fechas distintas, mismo kg/reps => sobreviven", () => {
  const sb = [row("29/9/2026", 50, 15), row("30/9/2026", 50, 15), row("1/10/2026", 50, 15)];
  assert.deepEqual(merged({}, sb).map((r) => r.fecha), ["29/9/2026", "30/9/2026", "1/10/2026"]);
  assert.equal(collected({}, sb).length, 3);
});

test("F8. ejercicios distintos con misma fecha/kg/reps no se mezclan (collectAllProgressRows)", () => {
  const sb = [row("29/9/2026", 50, 15, "e1"), row("29/9/2026", 50, 15, "e2"), row("29/9/2026", 50, 15, "e2")];
  const out = collected({}, sb);
  assert.equal(out.filter((r) => r.ejercicio_id === "e1").length, 1);
  assert.equal(out.filter((r) => r.ejercicio_id === "e2").length, 2);
  const p = { e1: { sets: [{ kg: "50", reps: "15", date: "29/9/2026" }] }, e2: { sets: [{ kg: "50", reps: "15", date: "29/9/2026" }] } };
  assert.equal(collected(p, sb).length, 3); // max por ejercicio: e1 -> 1, e2 -> max(1,2) = 2
});

test("F8b. 05/10/2026 local y 5/10/2026 remoto son la misma firma; kg<=0 se ignora", () => {
  assert.equal(merged(loc(1, "05/10/2026", 50, 15), rep(1, "5/10/2026", 50, 15)).length, 1);
  assert.equal(collected(loc(1, "05/10/2026", 50, 15), rep(1, "5/10/2026", 50, 15)).length, 1);
  assert.equal(collected({}, [row("5/10/2026", 0, 15)]).length, 0);
});

test("F8c. kg/reps como texto y numero comparten firma", () => {
  const p = { e1: { sets: [{ kg: "50", reps: "15", date: "29/9/2026" }] } };
  const sb = [{ ejercicio_id: "e1", fecha: "29/9/2026", kg: "50.0", reps: "15" }];
  assert.equal(merged(p, sb).length, 1);
  assert.equal(collected(p, sb).length, 1);
});

test("F9. volumen usa TODAS las series: 3 x (50 x 15) = 2250 kg, no 750", () => {
  const sb = rep(3, "5/10/2026", 50, 15);
  const m = buildWeeklyVolumeModel({}, sb, [], NOW);
  assert.equal(m.volWeekTon * 1000, 2250);
  // local 2 + remote 3 => 3 series; local 3 + remote 2 => 3 series
  assert.equal(buildWeeklyVolumeModel(loc(2, "5/10/2026", 50, 15), sb, [], NOW).volWeekTon * 1000, 2250);
  assert.equal(buildWeeklyVolumeModel(loc(3, "5/10/2026", 50, 15), rep(2, "5/10/2026", 50, 15), [], NOW).volWeekTon * 1000, 2250);
  // local 1 + remote 1 = una sola serie
  assert.equal(buildWeeklyVolumeModel(loc(1, "5/10/2026", 50, 15), rep(1, "5/10/2026", 50, 15), [], NOW).volWeekTon * 1000, 750);
});

test("F9b. otros consumidores de collectAllProgressRows reciben la multiplicidad", () => {
  assert.equal(hasAnyTrainingData([], {}, rep(3, "5/10/2026", 50, 15)), true);
  // spark de hoy (6/10) y semana previa con series repetidas
  const m = buildWeeklyVolumeModel({}, [...rep(3, "6/10/2026", 50, 15), ...rep(2, "29/9/2026", 50, 15)], [], NOW);
  assert.equal(m.sparkDaily[6] * 1000, 2250);
  assert.equal(m.volPrevTon * 1000, 1500);
  assert.equal(trainingDaysThisWeek([], {}, rep(3, "6/10/2026", 50, 15), NOW), 1);
});

test("F10. orden cronologico y slice(-20) con series repetidas", () => {
  const sb = [];
  for (let d = 1; d <= 24; d++) sb.push(row(d + "/9/2026", 40 + d, 10));
  sb.push(...rep(3, "1/10/2026", 50, 15));
  const out = merged({}, sb);
  assert.equal(out.length, 20);
  assert.deepEqual(out.slice(-3).map((r) => r.fecha), ["1/10/2026", "1/10/2026", "1/10/2026"]);
  assert.equal(out[0].fecha, "8/9/2026"); // 27 filas -> ultimas 20
  const t = out.map((r) => parseProgressDate(r.fecha).getTime());
  assert.deepEqual(t, [...t].sort((a, b) => a - b));
});

test("F10b. determinista: mismo input => mismo output, sin mutar entradas", () => {
  const p = loc(2, "29/9/2026", 50, 15);
  const sb = [...rep(3, "29/9/2026", 50, 15), row("28/9/2026", 40, 10)];
  const snap = JSON.stringify([p, sb]);
  const a = JSON.stringify(merged(p, sb));
  assert.equal(JSON.stringify(merged(p, sb)), a);
  assert.equal(JSON.stringify([p, sb]), snap);
});

test("F11. metricas derivadas: PRs y mejora no se rompen con series repetidas", () => {
  withNow(2026, 10, 6, () => {
    const sb = [row("14/9/2026", 80), ...rep(3, "1/10/2026", 100, 5), ...rep(2, "5/10/2026", 110, 5)];
    // PR = superar el maximo previo: series iguales al maximo no cuentan
    assert.equal(countPRsThisMonth([{ id: "e1" }], [], {}, sb), 2);
  });
  assert.equal(averageImprovementPercent([{ id: "e1" }], [], {}, [row("14/9/2026", 100), ...rep(3, "5/10/2026", 120, 5)]), 20);
});

console.log(count + " tests OK");
