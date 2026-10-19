// Pruebas de los records personales (PRs) en lib/workoutSession.js:
// updateExerciseProgressRecord, buildNewSessionPRList, calculateNewWeightPR,
// mergeProgressEntries y hydrateProgressFromRows.
//
// Regla de CLAUDE.md: "PRs no deben resetearse". Si una prueba falla, la
// expectativa NO se ajusta para que pase: indica un posible bug real.
//
//   node scripts/test-prRecords.mjs
//
// Datos ficticios; sin red ni Supabase. Sale con codigo 1 si algo falla.

import assert from "node:assert/strict";
import {
  buildNewSessionPRList,
  calculateNewWeightPR,
  hydrateProgressFromRows,
  mergeProgressEntries,
  updateExerciseProgressRecord,
} from "../lib/workoutSession.js";

let count = 0;
let failed = 0;
function ok(name, fn) {
  try {
    fn();
    count++;
    console.log("ok - " + name);
  } catch (err) {
    failed++;
    console.log("FAIL - " + name);
    console.log("  " + String(err && err.message).split("\n").join("\n  "));
  }
}

const D = "01/10/2026";
const set = (kg, extra) => Object.assign({ kg, reps: 5, date: D, week: 1 }, extra || {});

// 1. nunca reduce max
ok("1. updateExerciseProgressRecord nunca reduce max", () => {
  const base = { sets: [], max: 100 };
  const lower = updateExerciseProgressRecord(base, set(80));
  assert.equal(lower.max, 100);
  assert.equal(lower.sets.length, 1);
  assert.equal(lower.sets[0].kg, 80);
  const same = updateExerciseProgressRecord(base, set(100));
  assert.equal(same.max, 100);
  const higher = updateExerciseProgressRecord(base, set(105.5));
  assert.equal(higher.max, 105.5);
  // la entrada original no se muta
  assert.equal(base.max, 100);
  assert.equal(base.sets.length, 0);
  // sin entrada previa
  assert.equal(updateExerciseProgressRecord(null, set(40)).max, 40);
  assert.equal(updateExerciseProgressRecord(undefined, set(40)).max, 40);
});

// 2. sets vacio / null / undefined / no-array
ok("2. sets invalido o vacio mantiene el max previo y no lanza", () => {
  [[], null, undefined, "abc", 42, { length: 3 }].forEach((bad) => {
    const res = updateExerciseProgressRecord({ sets: bad, max: 90 }, set(50));
    assert.equal(res.max, 90, "max con sets=" + JSON.stringify(bad));
    assert.equal(res.sets.length, 1);
  });
  // entrada sin la propiedad sets
  assert.equal(updateExerciseProgressRecord({ max: 90 }, set(50)).max, 90);
  // merge con sets invalidos tampoco pierde el max
  const m = mergeProgressEntries({ sets: null, max: 90 }, { sets: "x", max: 70 });
  assert.equal(m.max, 90);
  assert.deepEqual(m.sets, []);
  // newSet invalido: no lanza ni reduce max
  assert.equal(updateExerciseProgressRecord({ sets: [], max: 90 }, null).max, 90);
  assert.equal(updateExerciseProgressRecord({ sets: [], max: 90 }, undefined).max, 90);
});

// 3. tope de 50 sets: el maximo sobrevive aunque su set se descarte
ok("3. con 51+ sets el max historico sobrevive al descarte del set", () => {
  let entry = { sets: [], max: 0 };
  entry = updateExerciseProgressRecord(entry, set(120)); // el mas viejo, el mejor
  for (let i = 0; i < 55; i++) entry = updateExerciseProgressRecord(entry, set(50 + (i % 5)));
  assert.equal(entry.sets.length, 50);
  assert.ok(!entry.sets.some((s) => s.kg === 120), "el set de 120 ya fue descartado del array");
  assert.equal(entry.max, 120);
  // via hidratacion: 51 filas, la de 120 kg es la mas antigua
  const rows = [];
  for (let i = 0; i < 51; i++) {
    rows.push({
      ejercicio_id: "sq", kg: i === 0 ? 120 : 60, reps: 5, fecha: D, semana: 1, nota: "",
      created_at: "2026-10-01T10:" + String(i).padStart(2, "0") + ":00Z",
    });
  }
  const h = hydrateProgressFromRows(rows);
  assert.equal(h.sq.sets.length, 50);
  assert.ok(!h.sq.sets.some((s) => s.kg === 120));
  assert.equal(h.sq.max, 120);
  // via merge: cap de 50 y max conservado
  const m = mergeProgressEntries({ sets: h.sq.sets, max: 120 }, { sets: [set(60, { created_at: "2026-11-01T00:00:00Z" })], max: 60 });
  assert.equal(m.sets.length, 50);
  assert.equal(m.max, 120);
});

// 4. buildNewSessionPRList vs calculateNewWeightPR
ok("4. buildNewSessionPRList: falso PR y primer registro", () => {
  const ex = [{ id: "bp", name: "Press banca" }];
  const mk = (kgs) => ({ bp: { sets: kgs.map((k) => set(k)), max: Math.max(...kgs) } });
  // maxToday < previo, == previo: sin PR
  assert.deepEqual(buildNewSessionPRList(ex, mk([70, 80]), { bp: 100 }, D), []);
  assert.deepEqual(buildNewSessionPRList(ex, mk([100]), { bp: 100 }, D), []);
  // supera: PR con prevKg y diff
  const pr = buildNewSessionPRList(ex, mk([80, 102.5]), { bp: 100 }, D);
  assert.equal(pr.length, 1);
  assert.equal(pr[0].exId, "bp");
  assert.equal(pr[0].ejercicio, "Press banca");
  assert.equal(pr[0].kg, 102.5);
  assert.equal(pr[0].prevKg, 100);
  assert.equal(pr[0].diff, 2.5);
  // sets de otro dia no cuentan
  assert.deepEqual(buildNewSessionPRList(ex, { bp: { sets: [set(200, { date: "02/10/2026" })], max: 200 } }, { bp: 100 }, D), []);
  // ejercicio sin progreso / sin sets hoy
  assert.deepEqual(buildNewSessionPRList(ex, {}, { bp: 100 }, D), []);
  assert.deepEqual(buildNewSessionPRList(ex, null, null, D), []);
  assert.deepEqual(buildNewSessionPRList(null, mk([50]), {}, D), []);

  // Primer registro (sin record previo). COMPORTAMIENTO REAL, asimetrico:
  //  - buildNewSessionPRList (workoutSession.js:428) trata prevKg=0 como
  //    "sin record" y SI emite PR (prevKg 0, diff = kg).
  //  - calculateNewWeightPR (workoutSession.js:376) exige previousMax > 0 y
  //    devuelve null en el primer registro.
  // Esta prueba solo documenta lo que cada una hace; no declara cual es correcta.
  const first = buildNewSessionPRList(ex, mk([60]), {}, D);
  assert.equal(first.length, 1);
  assert.equal(first[0].prevKg, 0);
  assert.equal(first[0].diff, 60);
  assert.equal(buildNewSessionPRList(ex, mk([60]), null, D).length, 1);
  assert.equal(calculateNewWeightPR({ sets: [], max: 0 }, 60), null);
  assert.equal(calculateNewWeightPR(null, 60), null);
  // calculateNewWeightPR con record previo
  assert.equal(calculateNewWeightPR({ max: 100 }, 100), null);
  assert.equal(calculateNewWeightPR({ max: 100 }, 90), null);
  assert.deepEqual(calculateNewWeightPR({ max: 100 }, "105"), { kg: 105, prevKg: 100, diff: 5 });
});

// 5. 0 kg, no numericos y negativos no generan record
ok("5. 0 kg / no numericos / negativos no generan record", () => {
  const ex = [{ id: "bp", name: "Press" }];
  // Cada valor se ejecuta y reporta; los fallos se acumulan y se lanzan al final.
  const failures = [];
  const check = (label, fn) => {
    try {
      fn();
    } catch (err) {
      failures.push(label + ": " + String(err && err.message).split("\n").join(" | "));
    }
  };
  [0, -5, "abc", null, undefined, NaN].forEach((bad) => {
    const v = "kg=" + String(bad);
    // sin record previo
    const entry = { sets: [{ kg: bad, reps: 5, date: D, week: 1 }], max: 0 };
    let built;
    check("build " + v, () => {
      built = buildNewSessionPRList(ex, { bp: entry }, {}, D);
      assert.deepEqual(built, []);
    });
    check("calc(max 50) " + v, () => assert.equal(calculateNewWeightPR({ max: 50 }, bad), null));
    check("calc(max 0) " + v, () => assert.equal(calculateNewWeightPR({ max: 0 }, bad), null));
    // consistencia: ambas funciones coinciden en no producir record
    check("consistencia " + v, () => {
      const calc = calculateNewWeightPR({ max: 0 }, bad);
      assert.ok(
        Array.isArray(built) && built.length === 0 && calc === null,
        "build=" + JSON.stringify(built) + " calc=" + JSON.stringify(calc)
      );
    });
    // updateExerciseProgressRecord: max no baja ni se vuelve negativo/NaN
    check("update(max 50) " + v, () =>
      assert.equal(updateExerciseProgressRecord({ sets: [], max: 50 }, set(bad)).max, 50));
    check("update(vacio) " + v, () => {
      const fromEmpty = updateExerciseProgressRecord(null, set(bad)).max;
      assert.ok(fromEmpty === 0, "max desde vacio fue " + fromEmpty);
    });
  });
  if (failures.length) throw new Error(failures.length + " fallo(s):\n" + failures.join("\n"));
});

// 6. redondeo de diff a 1 decimal (Math.round(x*10)/10)
ok("6. diff redondeado a 1 decimal", () => {
  const ex = [{ id: "bp", name: "Press" }];
  const diffOf = (prev, now) =>
    buildNewSessionPRList(ex, { bp: { sets: [set(now)], max: now } }, { bp: prev }, D)[0].diff;
  assert.equal(diffOf(60, 62.5), 2.5);
  assert.equal(diffOf(60, 60.25), 0.3); // 0.25*10=2.5 -> round=3 -> 0.3
  assert.equal(diffOf(60, 60.24), 0.2);
  assert.equal(diffOf(60, 61), 1);
  assert.equal(calculateNewWeightPR({ max: 60 }, 62.5).diff, 2.5);
  assert.equal(calculateNewWeightPR({ max: 60 }, 60.25).diff, 0.3);
  assert.equal(calculateNewWeightPR({ max: 60 }, 60.24).diff, 0.2);
});

// 7. mergeProgressEntries conserva el maximo historico
ok("7. mergeProgressEntries conserva el max historico", () => {
  const local = {
    sets: [
      set(70, { week: 3, date: "15/10/2026" }),
      set(60, { week: 1, date: "01/10/2026" }),
      set(65, { week: 2, date: "08/10/2026" }),
    ],
    max: 70,
  };
  const remote = {
    sets: [
      set(100, { week: 1, date: "02/10/2026", created_at: "2026-10-02T10:00:00Z" }),
      set(55, { week: 2, date: "09/10/2026", created_at: "2026-10-09T10:00:00Z" }),
    ],
    max: 100,
  };
  assert.equal(mergeProgressEntries(local, remote).max, 100);
  assert.equal(mergeProgressEntries(remote, local).max, 100);
  // remoto con max menor: gana el local
  assert.equal(mergeProgressEntries({ sets: [], max: 150 }, remote).max, 150);
  assert.equal(mergeProgressEntries(remote, { sets: local.sets, max: 70 }).max, 100);
  // null/undefined de un lado
  assert.equal(mergeProgressEntries(null, remote).max, 100);
  assert.equal(mergeProgressEntries(local, undefined).max, 70);
  assert.equal(mergeProgressEntries(null, null).max, 0);
  // semanas conservadas en los sets fusionados
  const weeks = mergeProgressEntries(local, remote).sets.map((s) => s.week).sort();
  assert.deepEqual(weeks, [1, 1, 2, 2, 3]);
  // max declarado mayor que cualquier set presente tambien se conserva
  assert.equal(mergeProgressEntries({ sets: [set(10)], max: 200 }, { sets: [set(20)], max: 30 }).max, 200);
});

// 8. hydrateProgressFromRows no admite estado previo (firma: rows) -> se prueba
// a traves de mergeProgressEntries (NO APLICA directamente).
ok("8. hidratacion no reduce records existentes (via mergeProgressEntries)", () => {
  // Filas fuera de orden y de varias semanas: el max es el mayor de todas.
  const rows = [
    { ejercicio_id: "dl", kg: 80, reps: 5, fecha: "15/10/2026", semana: 3, nota: "", created_at: "2026-10-15T10:00:00Z" },
    { ejercicio_id: "dl", kg: 140, reps: 3, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:00:00Z" },
    { ejercicio_id: "dl", kg: 100, reps: 5, fecha: "08/10/2026", semana: 2, nota: "", created_at: "2026-10-08T10:00:00Z" },
  ];
  const h = hydrateProgressFromRows(rows);
  assert.equal(h.dl.max, 140);
  assert.deepEqual(h.dl.sets.map((s) => s.kg), [80, 100, 140]); // mas reciente primero
  assert.deepEqual(h.dl.sets.map((s) => s.week), [3, 2, 1]);
  // estado local con record mayor al hidratado: no se reduce
  const merged = mergeProgressEntries({ sets: [], max: 180 }, h.dl);
  assert.equal(merged.max, 180);
  assert.equal(merged.sets.length, 3);
  // hidratacion vacia / invalida: no lanza y no pisa el local
  assert.deepEqual(hydrateProgressFromRows([]), {});
  assert.deepEqual(hydrateProgressFromRows(null), {});
  assert.deepEqual(hydrateProgressFromRows(undefined), {});
  const afterEmpty = mergeProgressEntries({ sets: [set(90)], max: 90 }, hydrateProgressFromRows([]).dl);
  assert.equal(afterEmpty.max, 90);
  // filas con kg 0 / invalido no bajan ni crean record
  const hz = hydrateProgressFromRows([
    { ejercicio_id: "x", kg: 0, reps: 5, fecha: D, semana: 1, nota: "", created_at: "2026-10-01T10:00:00Z" },
    { ejercicio_id: "x", kg: "abc", reps: 5, fecha: D, semana: 1, nota: "", created_at: "2026-10-01T10:01:00Z" },
  ]);
  assert.equal(hz.x.max, 0);
});

console.log(count + " tests OK" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
