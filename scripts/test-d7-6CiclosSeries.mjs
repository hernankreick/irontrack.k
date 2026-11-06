// D76-04 — series de distintos ciclos con mismo ejercicio, fecha y valores: la reconciliacion local + hidratado (mergeProgressEntries /
// dedupeMatchedSets) empareja por id > (firma + ciclo) > (firma con ciclo desconocido). Nunca re-atribuye ni fusiona ciclos distintos.
//   node scripts/test-d7-6CiclosSeries.mjs
// Datos ficticios, sin red ni dependencias.
import assert from "node:assert/strict";
import {
  buildExerciseSetRecord,
  buildPendingProgressItem,
  buildProgressPayload,
  dedupeMatchedSets,
  getExerciseSetsForDay,
  getWorkoutExerciseStatus,
  hydrateProgressFromRows,
  mergeProgressEntries,
  normalizeWorkoutSet,
  updateExerciseProgressRecord,
} from "../lib/workoutSession.js";
import { setsForLoadPrefill } from "../lib/rutinaCiclo.js";
import { mergeRemoteAndLocalRows } from "../lib/trainingVolume.js";
import { flushPendingForAlumno } from "../lib/pendingSyncQueue.js";
import { writeAheadPendingSet } from "../lib/setWriteAhead.js";

let n = 0;
let failed = 0;
const t = async (name, fn) => {
  try { await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.error("FAIL -", name); console.error(e); }
};
const store = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => void m.delete(k),
    get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
  };
};
const OP = (i) => "00000000-0000-4000-8000-" + String(i).padStart(12, "0");
const HOY = "5/11/2026";
const EX = "sq";
// Serie local como la arma logSet (buildExerciseSetRecord + opId).
const local = (ciclo, id, over) => {
  const o = Object.assign({ kg: 60, reps: 8, date: HOY, week: 0, note: "" }, over || {});
  const s = buildExerciseSetRecord(o.kg, o.reps, o.date, o.week, o.note, null, ciclo);
  return id ? Object.assign(s, { id }) : s;
};
// Fila de progreso como la devuelve Supabase.
const row = (id, ciclo, over) => Object.assign({
  id, alumno_id: "a1", ejercicio_id: EX, kg: 60, reps: 8, fecha: HOY, semana: 0, nota: "", created_at: "2026-11-05T12:00:00.000Z", ciclo,
}, over || {});
const ciclos = (sets) => sets.map((s) => s.ciclo).sort();
const mergeEx = (localSets, rows) => mergeProgressEntries({ sets: localSets, max: 60 }, hydrateProgressFromRows(rows)[EX]);

await t("1. repro: local [c2 pendiente, c1] + hidratado [c1] => una serie de cada ciclo, cada ciclo ve la suya", () => {
  const merged = mergeEx([local(2, OP(2)), local(1)], [row("a", 1)]);
  assert.equal(merged.sets.length, 2);
  assert.deepEqual(ciclos(merged.sets), [1, 2]);
  const progress = { [EX]: merged };
  const c2 = getExerciseSetsForDay(progress, EX, HOY, 0, { ciclo: 2 });
  const c1 = getExerciseSetsForDay(progress, EX, HOY, 0, { ciclo: 1 });
  assert.equal(c2.length, 1); assert.equal(c2[0].ciclo, 2); assert.equal(c2[0].id, OP(2));
  assert.equal(c1.length, 1); assert.equal(c1[0].ciclo, 1); assert.equal(c1[0].id, "a");
});

await t("2. pendiente de ciclo anterior: local c1 (id X, no en servidor) + servidor c2 (id Y) mismos valores => ambos, sin re-atribuir", () => {
  const out = dedupeMatchedSets([local(1, OP(10))], hydrateProgressFromRows([row(OP(11), 2)])[EX].sets);
  assert.equal(out.length, 2);
  const x = out.find((s) => s.id === OP(10));
  const y = out.find((s) => s.id === OP(11));
  assert.equal(x.ciclo, 1); assert.equal(y.ciclo, 2);
});

await t("3. reinicio de rutina: en ciclo 2 no hay lastSet ni precarga con las series c1 de hoy", () => {
  const merged = mergeEx([local(1, OP(20)), local(1)], [row(OP(20), 1), row("b", 1, { created_at: "2026-11-05T11:00:00.000Z" })]);
  assert.equal(merged.sets.length, 2);
  const progress = { [EX]: merged };
  const datos = { ciclo_actual: 2, ciclo_base: 2, ciclo_cargas: "cero", ciclo_reiniciado_at: "2026-11-05T13:00:00.000Z" };
  const st = getWorkoutExerciseStatus({ exercise: { id: EX, sets: 3 }, progress, date: HOY, currentWeek: 0, ciclo: 2 });
  assert.equal(st.lastSet, undefined);
  assert.equal(st.setsToday.length, 0);
  assert.deepEqual(setsForLoadPrefill(merged.sets, datos), []);
});

await t("4. reconciliacion tras sincronizar: id local (MAYUSCULAS) = progreso.id => 1 serie, la hidratada con created_at", () => {
  const opId = "ABCDEF00-0000-4000-8000-000000000001";
  const merged = mergeEx([local(2, opId)], [row(opId.toLowerCase(), 2)]);
  assert.equal(merged.sets.length, 1);
  assert.equal(merged.sets[0].id, opId.toLowerCase());
  assert.equal(merged.sets[0].created_at, "2026-11-05T12:00:00.000Z");
});

await t("5. idempotencia: mergear de nuevo con el mismo hidratado no cambia la cantidad", () => {
  const rows = [row("a", 1)];
  const first = mergeEx([local(2, OP(2)), local(1)], rows);
  const second = mergeProgressEntries(first, hydrateProgressFromRows(rows)[EX]);
  const third = mergeProgressEntries(second, hydrateProgressFromRows(rows)[EX]);
  assert.equal(first.sets.length, 2);
  assert.equal(second.sets.length, 2);
  assert.equal(third.sets.length, 2);
  assert.deepEqual(ciclos(third.sets), [1, 2]);
});

await t("6. datos antiguos sin ciclo: mismo comportamiento que antes", () => {
  // local sin ciclo ni id + hidratado ciclo 1 => 1 (el hidratado)
  const a = dedupeMatchedSets([local(undefined)], hydrateProgressFromRows([row("h1", 1)])[EX].sets);
  assert.equal(a.length, 1); assert.equal(a[0].id, "h1");
  // hidratado sin ciclo (servidor sin columna) + local ciclo 2 => 1 (el hidratado tal cual, sin inventar ciclo)
  const b = dedupeMatchedSets([local(2)], hydrateProgressFromRows([row("h2", undefined)])[EX].sets);
  assert.equal(b.length, 1); assert.equal(b[0].id, "h2"); assert.equal(b[0].ciclo, undefined);
  // series repetidas legitimas sin id: 3 locales, 2 hidratadas => 3
  const plain = (d) => normalizeWorkoutSet({ kg: 60, reps: 8, date: d, week: 0 });
  assert.equal(dedupeMatchedSets([plain("5/3/2026"), plain("5/3/2026"), plain("5/3/2026")], [plain("05/03/2026"), plain("05/03/2026")]).length, 3);
});

await t("7. ids distintos con mismos valores (mismo ciclo) => 2 series", () => {
  assert.equal(dedupeMatchedSets([local(1, OP(30))], [normalizeWorkoutSet(Object.assign({}, local(1), { id: OP(31) }))]).length, 2);
  assert.equal(mergeEx([local(1, OP(30))], [row(OP(31), 1)]).sets.length, 2);
});

await t("8. trainingVolume: remotos sin id/ciclo => max por firma, igual que antes", () => {
  const rows = [
    { ejercicio_id: EX, kg: 60, reps: 8, fecha: HOY, semana: 0, nota: "" },
    { ejercicio_id: EX, kg: 60, reps: 8, fecha: HOY, semana: 0, nota: "" },
    { ejercicio_id: EX, kg: 70, reps: 5, fecha: HOY, semana: 0, nota: "" },
  ];
  // local: 3 de 60x8 (una sin sincronizar, con id y ciclo 2) y 1 de 80x3 solo local
  const progress = { [EX]: { sets: [local(2, OP(40)), local(2, OP(41)), local(2, OP(42)), local(2, OP(43), { kg: 80, reps: 3 })] } };
  const out = mergeRemoteAndLocalRows(rows, progress);
  const count = (kg, reps) => out.filter((r) => r.kg === kg && r.reps === reps).length;
  assert.equal(out.length, 5);
  assert.equal(count(60, 8), 3); assert.equal(count(70, 5), 1); assert.equal(count(80, 3), 1);
});

await t("9. normalizeWorkoutSet / updateExerciseProgressRecord: id solo si viene", () => {
  const sin = normalizeWorkoutSet({ kg: 60, reps: 8, date: HOY });
  assert.equal(Object.prototype.hasOwnProperty.call(sin, "id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(normalizeWorkoutSet({ kg: 1, reps: 1, id: "" }), "id"), false);
  assert.equal(normalizeWorkoutSet({ kg: 60, reps: 8, id: "x1" }).id, "x1");
  const entry = updateExerciseProgressRecord({ sets: [], max: 0 }, { kg: 60, reps: 8, date: HOY, id: OP(50), ciclo: 2 });
  assert.equal(entry.sets[0].id, OP(50));
  assert.equal(entry.sets[0].ciclo, 2);
});

await t("10. hydrateProgressFromRows conserva id y ciclo", () => {
  const p = hydrateProgressFromRows([row(OP(60), 2), row(OP(61), 1, { created_at: "2026-11-05T13:00:00.000Z" })]);
  assert.deepEqual(p[EX].sets.map((s) => [s.id, s.ciclo]), [[OP(61), 1], [OP(60), 2]]);
});

await t("11. un pendiente de ciclo anterior se sincroniza en SU ciclo (flush): c1 sin campo ciclo, c2 con ciclo 2; ambos con id = opId", async () => {
  const s = store();
  const i1 = buildPendingProgressItem(EX, 60, 8, "", HOY, 0, 1, "a1", OP(70));
  const i2 = buildPendingProgressItem(EX, 60, 8, "", HOY, 0, 2, "a1", OP(71));
  assert.equal("ciclo" in i1, false);
  assert.ok(writeAheadPendingSet(s, i1, 1).ok);
  assert.ok(writeAheadPendingSet(s, i2, 2).ok);
  const sent = [];
  const r = await flushPendingForAlumno({
    storage: s, alumnoId: "a1",
    send: async (it) => { const p = buildProgressPayload("a1", it.exId, it.kg, it.reps, it.note, it.date, it.semana, it.ciclo, it.opId); sent.push(p); return [p]; },
  });
  assert.deepEqual(r, { sent: 2, failed: 0 });
  const p1 = sent.find((p) => p.id === OP(70));
  const p2 = sent.find((p) => p.id === OP(71));
  assert.ok(p1 && p2);
  assert.equal("ciclo" in p1, false);
  assert.equal(p2.ciclo, 2);
  // Y al rehidratar esas filas (c1 con default del servidor) contra las series locales, cada una queda en su ciclo.
  const merged = mergeEx([local(2, OP(71)), local(1, OP(70))], [row(OP(70), 1), row(OP(71), 2)]);
  assert.equal(merged.sets.length, 2);
  assert.deepEqual(ciclos(merged.sets), [1, 2]);
});

console.log(`\n${n} ok, ${failed} fallaron`);
if (failed) process.exit(1);
