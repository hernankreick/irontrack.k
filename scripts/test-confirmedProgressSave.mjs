// Guardado CONFIRMADO de series: criterio de exito, errores, timeout y cola.   node scripts/test-confirmedProgressSave.mjs
import assert from "node:assert/strict";
import {
  isConfirmedProgressInsert, persistSetConfirmed, parsePendingQueue, appendPendingItem, mergeQueueAfterFlush,
  buildPendingProgressItem, buildProgressPayload,
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
await t("encolado: agrega al final, conserva el formato existente y lee de lo guardado (no del estado)", () => {
  const a = buildPendingProgressItem("sq", "60", "8", "nota", "12/10/2026", 1);
  const b = buildPendingProgressItem("bp", "40", "8", "", "12/10/2026", 1);
  assert.deepEqual(Object.keys(a).sort(), ["date", "exId", "kg", "note", "reps", "semana"]);
  const q1 = appendPendingItem(null, a);
  const q2 = appendPendingItem(JSON.stringify(q1.items), b);
  assert.deepEqual(q2.items, [a, b]); assert.equal(q2.corrupt, false);
  assert.equal(appendPendingItem("{oops", a).corrupt, true);
  assert.deepEqual(appendPendingItem("{oops", a).items, [a]);
});
await t("el elemento encolado produce EXACTAMENTE el payload que se habria enviado (sin perder campos)", () => {
  const item = buildPendingProgressItem("sq", "60,5", "8", "n", "12/10/2026", 2);
  const direct = buildProgressPayload("AL", "sq", "60,5", "8", "n", "12/10/2026", 2);
  const fromQueue = buildProgressPayload("AL", item.exId, item.kg, item.reps, item.note, item.date, item.semana);
  assert.deepEqual(fromQueue, direct);
});
await t("flush: conserva lo que fallo y lo encolado DURANTE el flush; no duplica ni pierde", () => {
  const a = { exId: "a" }, b = { exId: "b" }, c = { exId: "c" }, nuevo = { exId: "nuevo" };
  const snapshot = [a, b, c];
  const durante = JSON.stringify([...snapshot, nuevo]);          // se encolo 'nuevo' mientras el flush corria
  assert.deepEqual(mergeQueueAfterFlush(durante, 3, [b]), [b, nuevo]);        // a y c sincronizados
  assert.deepEqual(mergeQueueAfterFlush(durante, 3, []), [nuevo]);            // todo sincronizado salvo lo nuevo
  assert.deepEqual(mergeQueueAfterFlush(JSON.stringify(snapshot), 3, snapshot), snapshot); // todo fallo
  assert.deepEqual(mergeQueueAfterFlush(null, 3, [a]), [a]);                  // cola desaparecida: se conserva lo fallido
});
console.log(`${n} comprobaciones OK`);
