// Pruebas de lib/workoutSession.js (mergeProgressEntries / hydrateProgressFromRows /
// dedupeMatchedSets), enfocadas en el fix de deduplicacion del PR #80.
//
// No hay infraestructura de test en el repo (sin vitest/jest ni script "test"),
// asi que este archivo se corre directo con Node (type:module ya configurado
// en package.json) y usa node:assert -- sin agregar ninguna dependencia nueva:
//
//   node scripts/test-mergeProgressEntries.mjs
//
// Sale con codigo 0 si todas las aserciones pasan, o lanza y sale con codigo
// distinto de 0 en el primer fallo.

import assert from "node:assert/strict";
import {
  hydrateProgressFromRows,
  mergeProgressEntries,
} from "../lib/workoutSession.js";

let count = 0;
function test(name, fn) {
  fn();
  count++;
  console.log("ok - " + name);
}

// 1. local vacio + historial Supabase => conserva todo el historial.
test("local vacio + historial Supabase conserva todo", () => {
  const rows = [
    { ejercicio_id: "bp", kg: 24, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:00:00Z" },
    { ejercicio_id: "bp", kg: 25, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:05:00Z" },
    { ejercicio_id: "bp", kg: 26, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:10:00Z" },
  ];
  const hydrated = hydrateProgressFromRows(rows);
  const merged = mergeProgressEntries(null, hydrated.bp);
  assert.equal(merged.sets.length, 3);
  assert.equal(merged.max, 26);
  assert.deepEqual(merged.sets.map((s) => s.kg), [26, 25, 24]); // mas reciente primero
});

// 2. historial local no sincronizado + historial Supabase diferente => conserva ambos.
test("local no sincronizado + hidratado distinto conserva ambos", () => {
  const localEntry = {
    sets: [{ kg: 30, reps: 8, date: "02/10/2026", week: 1, note: "", rpe: null }],
    max: 30,
  };
  const rows = [
    { ejercicio_id: "bp", kg: 26, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:10:00Z" },
  ];
  const hydrated = hydrateProgressFromRows(rows);
  const merged = mergeProgressEntries(localEntry, hydrated.bp);
  assert.equal(merged.sets.length, 2);
  assert.equal(merged.max, 30);
  const kgs = merged.sets.map((s) => s.kg).sort();
  assert.deepEqual(kgs, [26, 30]);
});

// 3. tres series legitimas identicas (24kg x10 x3), ninguna sincronizada aun => deben seguir siendo 3.
test("3 series identicas sin sincronizar no se colapsan", () => {
  const localEntry = {
    sets: [
      { kg: 24, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null },
      { kg: 24, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null },
      { kg: 24, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null },
    ],
    max: 24,
  };
  const merged = mergeProgressEntries(localEntry, { sets: [], max: 0 });
  assert.equal(merged.sets.length, 3);
});

// 3b. las mismas 3 series identicas, pero YA sincronizadas (hidratado tambien
// trae 3) => deben seguir siendo 3, no colapsar a 1 ni duplicarse a 6.
test("3 series identicas ya sincronizadas: siguen siendo 3 (no 1, no 6)", () => {
  const localEntry = {
    sets: [
      { kg: 24, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null },
      { kg: 24, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null },
      { kg: 24, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null },
    ],
    max: 24,
  };
  const rows = [
    { ejercicio_id: "bp", kg: 24, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:00:00Z" },
    { ejercicio_id: "bp", kg: 24, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:01:00Z" },
    { ejercicio_id: "bp", kg: 24, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:02:00Z" },
  ];
  const hydrated = hydrateProgressFromRows(rows);
  const merged = mergeProgressEntries(localEntry, hydrated.bp);
  assert.equal(merged.sets.length, 3);
  merged.sets.forEach((s) => assert.equal(s.kg, 24));
});

// 4. misma serie representada local + Supabase (1 y 1) => no debe terminar duplicada.
test("misma serie local + hidratada no queda duplicada", () => {
  const localEntry = {
    sets: [{ kg: 26, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null }],
    max: 26,
  };
  const rows = [
    { ejercicio_id: "bp", kg: 26, reps: 10, fecha: "01/10/2026", semana: 1, nota: "", created_at: "2026-10-01T10:10:00Z" },
  ];
  const hydrated = hydrateProgressFromRows(rows);
  const merged = mergeProgressEntries(localEntry, hydrated.bp);
  assert.equal(merged.sets.length, 1);
  assert.equal(merged.sets[0].created_at, "2026-10-01T10:10:00Z"); // se prefiere la copia hidratada
});

// 5. orden por created_at cuando ambos registros lo tienen.
test("orden por created_at cuando esta en ambos", () => {
  const localEntry = {
    sets: [{ kg: 30, reps: 5, date: "01/10/2026", week: 1, note: "", rpe: null, created_at: "2026-10-01T09:00:00Z" }],
    max: 30,
  };
  const hydratedEntry = {
    sets: [{ kg: 32, reps: 5, date: "01/10/2026", week: 1, note: "", rpe: null, created_at: "2026-10-01T09:30:00Z" }],
    max: 32,
  };
  const merged = mergeProgressEntries(localEntry, hydratedEntry);
  assert.deepEqual(merged.sets.map((s) => s.kg), [32, 30]); // 09:30 antes que 09:00
});

// 6. fallback de fecha cuando created_at no esta disponible en alguno de los dos.
test("fallback por fecha cuando falta created_at en alguno", () => {
  const localEntry = {
    sets: [{ kg: 20, reps: 10, date: "02/10/2026", week: 1, note: "", rpe: null }], // sin created_at
    max: 20,
  };
  const hydratedEntry = {
    sets: [{ kg: 21, reps: 10, date: "01/10/2026", week: 1, note: "", rpe: null, created_at: "2026-10-01T09:00:00Z" }],
    max: 21,
  };
  const merged = mergeProgressEntries(localEntry, hydratedEntry);
  // 02/10 es mas reciente que 01/10 aunque el segundo tenga created_at
  assert.deepEqual(merged.sets.map((s) => s.kg), [20, 21]);
});

// 7. limite de 50 registros se mantiene despues del merge.
test("tope de 50 sets se respeta despues del merge", () => {
  const localSets = [];
  for (let i = 0; i < 40; i++) {
    localSets.push({ kg: 20 + i, reps: 10, date: "01/10/2026", week: 1, note: "local-" + i, rpe: null });
  }
  const hydratedSets = [];
  for (let i = 0; i < 40; i++) {
    hydratedSets.push({ kg: 60 + i, reps: 10, date: "01/10/2026", week: 1, note: "hyd-" + i, created_at: "2026-10-01T10:00:0" + (i % 10) + "Z", rpe: null });
  }
  const merged = mergeProgressEntries({ sets: localSets, max: 59 }, { sets: hydratedSets, max: 99 });
  assert.equal(merged.sets.length, 50);
});

// 8. max correcto despues del merge (el mayor de los dos lados).
test("max correcto despues del merge", () => {
  const merged1 = mergeProgressEntries({ sets: [], max: 24 }, { sets: [], max: 26 });
  assert.equal(merged1.max, 26);
  const merged2 = mergeProgressEntries({ sets: [], max: 30 }, { sets: [], max: 26 });
  assert.equal(merged2.max, 30);
});

console.log(count + " tests OK");
