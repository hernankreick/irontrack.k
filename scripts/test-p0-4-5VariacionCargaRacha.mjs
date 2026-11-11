// P0-4 y P0-5 de la auditoria de estadisticas (Progreso del alumno).
//
//   node scripts/test-p0-4-5VariacionCargaRacha.mjs
//
// P0-4: «Mejora Δ» comparaba la primera y la ultima SERIE suelta de las ultimas 20: una serie de descarga al final daba -30 % con
//       cargas crecientes. Ahora: por ejercicio, mejor serie valida de la PRIMERA sesion (dia) contra mejor serie valida de la ULTIMA
//       (misma serie valida y misma mejor serie por dia que los PR, lib/metricas/pr.js historialPorDia), sobre todo el historial.
// P0-5: la racha del alumno se anclaba al ultimo dia con registro aunque fuera de hace semanas. Ahora la racha VIGENTE solo existe si
//       el ultimo dia entrenado es hoy o ayer (la misma regla que la racha semanal del entrenador, lib/metricas/racha.js: la unidad en
//       curso sin registro no corta, la anterior si). La ultima racha y la mejor racha se informan aparte, como historicas.
// Funciones reales, datos ficticios, sin red. Fechas locales (d/m/aaaa) y "ahora" fijado.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as PM from "../components/student-progress/progressMetrics.js";
import { indiceEjerciciosPorTiempo } from "../lib/metricas/tipoCarga.js";
import { eventosPR } from "../lib/metricas/pr.js";
import { volumenEnRango } from "../lib/metricas/volumen.js";

let count = 0;
const fallas = [];
function test(name, fn) {
  try { fn(); count++; console.log("ok -", name); }
  catch (e) { fallas.push(name); console.log("not ok -", name, "\n   ", String(e && e.message).split("\n").filter(Boolean).slice(0, 5).join("\n    ")); }
}

const RealDate = Date;
/** Fija "ahora" (new Date() sin argumentos y Date.now) durante fn; hh:mm local. */
function withNow(y, m, d, hh, mm, fn) {
  const fixed = new RealDate(y, m - 1, d, hh, mm, 0).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...a) { if (a.length === 0) super(fixed); else super(...a); }
    static now() { return fixed; }
  };
  try { return fn(new RealDate(fixed)); } finally { globalThis.Date = RealDate; }
}
const serie = (fecha, kg, reps, ex) => ({ ejercicio_id: ex || "sq", fecha, kg, reps: reps == null ? 5 : reps });
const mejora = (sb, opts) => PM.averageImprovementPercent([{ id: "sq" }, { id: "bp" }, { id: "plank" }], [], {}, sb, opts);
const detalle = (sb, opts) => (typeof PM.variacionDeCargaPromedio === "function" ? PM.variacionDeCargaPromedio([{ id: "sq" }, { id: "bp" }, { id: "plank" }], [], {}, sb, opts) : undefined);

// ───────────────────────────────────────── P0-4
test("P0-4. caso de la auditoría: 100 → 105 → 110 y una serie de descarga de 70 kg al final = +10 % (antes −30 %)", () => {
  const sb = [serie("1/10/2026", 100), serie("8/10/2026", 105), serie("15/10/2026", 110), serie("15/10/2026", 70, 12)];
  assert.equal(mejora(sb), 10);
});

test("P0-4. varias series en una sesión: cuenta la MEJOR serie de cada día, no la primera ni la última registrada", () => {
  // dia 1: calentamiento 60, top 100, descarga 80 | dia 2: calentamiento 60, top 110, descarga 75
  const sb = [serie("1/10/2026", 60, 10), serie("1/10/2026", 100), serie("1/10/2026", 80, 8), serie("8/10/2026", 60, 10), serie("8/10/2026", 110), serie("8/10/2026", 75, 10)];
  assert.equal(mejora(sb), 10);
});

test("P0-4. cargas crecientes, decrecientes y estables (sesiones en fechas distintas)", () => {
  assert.equal(mejora([serie("1/10/2026", 100), serie("8/10/2026", 120)]), 20);
  assert.equal(mejora([serie("1/10/2026", 100), serie("8/10/2026", 90)]), -10);
  assert.equal(mejora([serie("1/10/2026", 100), serie("8/10/2026", 100), serie("15/10/2026", 100)]), 0);
  const d = detalle([serie("1/10/2026", 100), serie("8/10/2026", 100)]);
  assert.ok(d, "variacionDeCargaPromedio no existe");
  assert.deepEqual([d.pct, d.ejercicios], [0, 1]); // estable = 0 %, distinto de «sin datos»
});

test("P0-4. la comparación es entre la primera y la última SESIÓN (orden cronológico aunque lleguen desordenadas)", () => {
  const sb = [serie("15/10/2026", 110), serie("1/10/2026", 100), serie("15/10/2026", 70, 12), serie("8/10/2026", 130)];
  assert.equal(mejora(sb), 10); // 130 en la sesion del medio no es la ultima
});

test("P0-4. promedio entre ejercicios: cada ejercicio con su primera y última sesión", () => {
  const sb = [serie("1/10/2026", 100), serie("15/10/2026", 110), serie("1/10/2026", 50, 8, "bp"), serie("15/10/2026", 55, 8, "bp"), serie("15/10/2026", 30, 10, "bp")];
  assert.equal(mejora(sb), 10);
});

test("P0-4. datos incompletos: una sola sesión, kg 0, reps 0, fechas inválidas o vacío => sin variación (no 0 % inventado)", () => {
  const d1 = detalle([serie("1/10/2026", 100), serie("1/10/2026", 70, 12)]);
  assert.ok(d1, "variacionDeCargaPromedio no existe");
  assert.equal(d1.pct, null);
  assert.equal(detalle([serie("1/10/2026", 100), serie("8/10/2026", 0), serie("9/10/2026", 120, 0), serie("2026/10/10", 130)]).pct, null);
  assert.equal(detalle([]).pct, null);
  assert.equal(mejora([]), 0); // contrato anterior del export: sin datos => 0
});

test("P0-4. todo el historial (no las últimas 20 series): la primera sesión es la primera real", () => {
  const sb = [serie("1/9/2026", 80)];
  for (let i = 0; i < 25; i++) sb.push(serie("1/10/2026", 60 + i, 5)); // 25 series en un dia (mejor = 84)
  sb.push(serie("8/10/2026", 88));
  assert.equal(mejora(sb), 10); // 80 -> 88
});

test("P0-4. ejercicios por tiempo no entran (reps = segundos), igual que PR y volumen", () => {
  const idx = indiceEjerciciosPorTiempo([], [{ days: [{ exercises: [{ id: "plank", reps: "45s" }] }] }]);
  const sb = [serie("1/10/2026", 100), serie("8/10/2026", 110), serie("1/10/2026", 10, 30, "plank"), serie("8/10/2026", 20, 60, "plank")];
  assert.equal(mejora(sb, { indiceTiempo: idx }), 10); // sin el indice, la plancha daria +100 %
});

test("P0-4. PR y volumen sin cambios: mismos eventos y mismo volumen para el mismo historial", () => {
  const sb = [serie("1/10/2026", 100), serie("8/10/2026", 105), serie("15/10/2026", 110), serie("15/10/2026", 70, 12)];
  assert.equal(eventosPR(sb).length, 2);
  assert.equal(volumenEnRango(sb).total, 100 * 5 + 105 * 5 + 110 * 5 + 70 * 12);
  withNow(2026, 10, 20, 12, 0, () => assert.equal(PM.countPRsThisMonth([{ id: "sq" }], [], {}, sb), 2));
});

// ───────────────────────────────────────── P0-5
const ses = (fecha, extra) => Object.assign({ fecha }, extra || {});
const dias = (dd, m) => dd.map((d) => ses(d + "/" + m + "/2026"));
const racha = (sesiones, progress) => PM.computeDayStreak(sesiones, progress || {});
const rachaDet = (sesiones, progress) => (typeof PM.computeDayStreakDetail === "function" ? PM.computeDayStreakDetail(sesiones, progress || {}) : undefined);

test("P0-5. racha vigente: entrenó hoy y los días anteriores", () => {
  withNow(2026, 10, 15, 12, 0, () => assert.equal(racha(dias([15, 14, 13], 10)), 3));
});

test("P0-5. racha terminada ayer: sigue vigente hoy (todavía puede entrenar)", () => {
  withNow(2026, 10, 15, 12, 0, () => assert.equal(racha(dias([14, 13], 10)), 2));
});

test("P0-5. racha terminada hace varias semanas: NO es vigente (antes mostraba 3)", () => {
  withNow(2026, 11, 11, 12, 0, () => {
    assert.equal(racha(dias([2, 3, 4], 10)), 0);
    const d = rachaDet(dias([2, 3, 4], 10));
    assert.ok(d, "computeDayStreakDetail no existe");
    assert.equal(d.vigente, 0);
    assert.deepEqual(d.ultima, { dias: 3, hasta: "4/10/2026" }); // historica, no activa
  });
});

test("P0-5. racha que terminó anteayer ya no es vigente", () => {
  withNow(2026, 10, 15, 12, 0, () => assert.equal(racha(dias([13, 12, 11], 10)), 0));
});

test("P0-5. vigente e histórica diferenciadas: mejor racha, última racha y racha actual", () => {
  withNow(2026, 10, 15, 12, 0, () => {
    const d = rachaDet(dias([1, 2, 3, 4, 5, 6, 7, 14, 15], 10));
    assert.ok(d, "computeDayStreakDetail no existe");
    assert.deepEqual([d.vigente, d.mejor], [2, 7]);
    assert.deepEqual(d.ultima, { dias: 2, hasta: "15/10/2026" });
  });
});

test("P0-5. cambio de día: a las 00:10 la sesión de ayer 23:30 sostiene la racha; un día después ya no", () => {
  // sesion sin fecha: solo created_at (UTC). 2026-10-06T02:30Z = 5/10 23:30 en Argentina
  const s = [ses(null, { created_at: "2026-10-06T02:30:00Z" }), ses("4/10/2026")];
  withNow(2026, 10, 6, 0, 10, () => assert.equal(racha(s), 2));
  withNow(2026, 10, 7, 0, 1, () => assert.equal(racha(s), 0));
});

test("P0-5. zona horaria: el mismo historial d/m/aaaa da la misma racha en otra zona (fecha local, no UTC)", () => {
  const code = `
    const PM = await import(${JSON.stringify(new URL("../components/student-progress/progressMetrics.js", import.meta.url).href)});
    const R = Date, f = new R(2026, 9, 15, 23, 50).getTime();
    globalThis.Date = class extends R { constructor(...a) { a.length ? super(...a) : super(f); } static now() { return f; } };
    console.log(PM.computeDayStreak([{ fecha: "15/10/2026" }, { fecha: "14/10/2026" }], {}));`;
  for (const tz of ["America/Argentina/Buenos_Aires", "Pacific/Auckland", "UTC"]) {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e", code], { env: Object.assign({}, process.env, { TZ: tz }), encoding: "utf8" });
    assert.equal(r.stdout.trim(), "2", tz + ": " + r.stderr);
  }
});

test("P0-5. historial sin entrenamientos y sesiones pendientes: racha 0", () => {
  withNow(2026, 10, 15, 12, 0, () => {
    assert.equal(racha([], {}), 0);
    assert.equal(racha([ses("15/10/2026", { estado: "pendiente" }), ses("14/10/2026", { completada: false })]), 0);
    const d = rachaDet([], {});
    assert.ok(d, "computeDayStreakDetail no existe");
    assert.deepEqual(d, { vigente: 0, ultima: null, mejor: 0 });
  });
});

test("P0-5. series registradas (progreso local) cuentan como día entrenado; días futuros no", () => {
  withNow(2026, 10, 15, 12, 0, () => {
    const progress = { sq: { sets: [{ kg: 100, reps: 5, date: "15/10/2026" }, { kg: 100, reps: 5, date: "14/10/2026" }] } };
    assert.equal(racha([ses("16/10/2026"), ses("17/10/2026")], progress), 2);
  });
});

test("P0-5. no modifica las sesiones ni las series recibidas", () => {
  withNow(2026, 10, 15, 12, 0, () => {
    const s = dias([15, 14], 10);
    const p = { sq: { sets: [{ kg: 100, reps: 5, date: "13/10/2026" }] } };
    const antes = JSON.stringify([s, p]);
    racha(s, p);
    if (typeof PM.computeDayStreakDetail === "function") PM.computeDayStreakDetail(s, p);
    assert.equal(JSON.stringify([s, p]), antes);
  });
});

if (fallas.length) {
  console.log("\n" + fallas.length + " tests FALLARON, " + count + " OK");
  process.exit(1);
}
console.log("\n" + count + " tests OK");
