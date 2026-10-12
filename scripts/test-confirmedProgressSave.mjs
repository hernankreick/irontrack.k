// Guardado CONFIRMADO de series: criterio de exito, errores, timeout y cola.   node scripts/test-confirmedProgressSave.mjs
import assert from "node:assert/strict";
import {
  isConfirmedProgressInsert, persistSetConfirmed, parsePendingQueue,
  buildPendingProgressItem, buildProgressPayload, isSameProgressRow,
} from "../lib/workoutSession.js";
import { isValidInsertedRow } from "../lib/finalizeWorkoutSession.js";

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

await t("el criterio de confirmacion coincide con isValidInsertedRow (finalizacion) para todas las entradas", () => {
  const inputs = [null, undefined, [], [null], [undefined], [1], ["x"], [{}], [{ id: 1 }], [{ id: 1 }, { id: 2 }], {}, { id: 1 }, "", "ok", 0, 1, true, false, NaN];
  for (const v of inputs) assert.equal(isConfirmedProgressInsert(v), isValidInsertedRow(v), "difiere para " + JSON.stringify(v));
});

await t("exito: devuelve una fila -> confirmado, un solo intento", async () => {
  let calls = 0;
  const r = await persistSetConfirmed({ addProgreso: async () => { calls++; return [{ id: 7 }]; } });
  assert.deepEqual(r, { confirmed: true }); assert.equal(calls, 1);
});
await t("HTTP no-ok (sbFetch devuelve null) -> NO confirmado (unconfirmed), sin reintento", async () => {
  let calls = 0;
  const r = await persistSetConfirmed({ addProgreso: async () => { calls++; return null; } });
  assert.deepEqual(r, { confirmed: false, reason: "unconfirmed" }); assert.equal(calls, 1);
});
await t("respuesta vacia o con forma inesperada -> NO confirmado", async () => {
  for (const v of [[], {}, "", [null], undefined]) {
    const r = await persistSetConfirmed({ addProgreso: async () => v });
    assert.deepEqual(r, { confirmed: false, reason: "unconfirmed" }, JSON.stringify(v));
  }
});
await t("excepcion de red (promesa rechazada) -> NO confirmado (error), no lanza", async () => {
  const r = await persistSetConfirmed({ addProgreso: () => Promise.reject(new Error("net")) });
  assert.deepEqual(r, { confirmed: false, reason: "error" });
});
await t("excepcion sincrona al armar la peticion -> NO confirmado (error), no lanza", async () => {
  const r = await persistSetConfirmed({ addProgreso: () => { throw new Error("sync"); } });
  assert.deepEqual(r, { confirmed: false, reason: "error" });
});
await t("timeout: no responde -> NO confirmado (timeout) y no deja temporizadores colgados", async () => {
  const t0 = Date.now();
  const r = await persistSetConfirmed({ addProgreso: () => new Promise(() => {}), timeoutMs: 40 });
  assert.deepEqual(r, { confirmed: false, reason: "timeout" }); assert.ok(Date.now() - t0 < 1000);
});
await t("respuesta antes del timeout cancela el temporizador (el proceso termina solo)", async () => {
  const r = await persistSetConfirmed({ addProgreso: async () => [{ id: 1 }], timeoutMs: 60000 });
  assert.equal(r.confirmed, true);
});

await t("cola: parse tolerante (vacia, valida, corrupta, no-lista)", () => {
  assert.deepEqual(parsePendingQueue(null), { items: [], corrupt: false });
  assert.deepEqual(parsePendingQueue(""), { items: [], corrupt: false });
  assert.deepEqual(parsePendingQueue("[1,2]"), { items: [1, 2], corrupt: false });
  assert.deepEqual(parsePendingQueue("{oops"), { items: [], corrupt: true });
  assert.deepEqual(parsePendingQueue('{"a":1}'), { items: [], corrupt: true });
});
await t("elemento de la cola: sin alumnoId/opId conserva el formato anterior; con ellos agrega alumno_id y opId", () => {
  const legacy = buildPendingProgressItem("sq", "60", "8", "nota", "12/10/2026", 1);
  assert.deepEqual(Object.keys(legacy).sort(), ["date", "exId", "kg", "note", "reps", "semana"]);
  const nuevo = buildPendingProgressItem("sq", "60", "8", "nota", "12/10/2026", 1, undefined, "AL-1", "op-1");
  assert.deepEqual(Object.keys(nuevo).sort(), ["alumno_id", "date", "exId", "kg", "note", "opId", "reps", "semana"]);
  assert.equal(nuevo.alumno_id, "AL-1"); assert.equal(nuevo.opId, "op-1");
});
await t("el elemento encolado produce EXACTAMENTE el payload que se habria enviado (sin perder campos)", () => {
  const item = buildPendingProgressItem("sq", "60,5", "8", "n", "12/10/2026", 2);
  const direct = buildProgressPayload("AL", "sq", "60,5", "8", "n", "12/10/2026", 2);
  const fromQueue = buildProgressPayload("AL", item.exId, item.kg, item.reps, item.note, item.date, item.semana);
  assert.deepEqual(fromQueue, direct);
});
await t("ciclo + alumnoId + opId + id conviven: ciclo>1 viaja en la cola y en el payload; ciclo 1 no agrega campo", () => {
  const OP = "3f2b8c1e-9a4d-4e6b-8c7f-1a2b3c4d5e6f";
  const item = buildPendingProgressItem("sq", "60", "8", "n", "12/10/2026", 2, 3, "AL-1", OP);
  assert.equal(item.ciclo, 3); assert.equal(item.alumno_id, "AL-1"); assert.equal(item.opId, OP);
  const p = buildProgressPayload("AL-1", item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId);
  assert.equal(p.ciclo, 3); assert.equal(p.id, OP); assert.equal(p.alumno_id, "AL-1"); assert.equal(p.semana, 2);
  const p1 = buildProgressPayload("AL-1", "sq", "60", "8", "n", "12/10/2026", 2, 1, OP);
  assert.ok(!("ciclo" in p1)); assert.equal(p1.id, OP);
  assert.ok(!("ciclo" in buildPendingProgressItem("sq", "60", "8", "n", "12/10/2026", 2, 1, "AL-1", OP)));
  assert.equal(isSameProgressRow({ ...p, ciclo: 3 }, p), true);
  assert.equal(isSameProgressRow({ ...p, ciclo: 2 }, p), false);   // misma id, otro ciclo => no se confirma
  const sinCiclo = { ...p }; delete sinCiclo.ciclo;
  assert.equal(isSameProgressRow(sinCiclo, p), true);   // la lectura por id no trae ciclo: no invalida la coincidencia
});
console.log(`${n} comprobaciones OK`);
