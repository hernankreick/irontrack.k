// Insercion idempotente de series (progreso.id = opId): exito, conflicto 23505 verificado, no-confirmaciones.   node scripts/test-progressInsert.mjs
import assert from "node:assert/strict";
import { postProgressIdempotent, isIdConflict } from "../lib/progressInsert.js";
import { buildProgressPayload, isSameProgressRow, isUuid } from "../lib/workoutSession.js";
import { generateOpId } from "../lib/pendingSyncQueue.js";

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const AL = "11111111-1111-4111-8111-111111111111", OTRO = "22222222-2222-4222-8222-222222222222";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const payload = (over) => ({ ...buildProgressPayload(AL, "sq", "60", "8", "", "12/10/2026", 1, ID), ...(over || {}) });
const row = (over) => ({ id: ID, alumno_id: AL, ejercicio_id: "sq", kg: 60, reps: 8, semana: 1, nota: "", ...(over || {}) });
const conflict = (id = ID, over) => ({ ok: false, status: 409, data: { code: "23505", details: `Key (id)=(${id}) already exists.`, message: 'duplicate key value violates unique constraint "progreso_pkey"', ...(over || {}) } });
const io = (post, getById) => { const calls = { post: 0, get: 0, bodies: [] }; return { calls, post: async (p) => { calls.post++; calls.bodies.push(p); return post(p); }, getById: async (id) => { calls.get++; return getById ? getById(id) : { ok: true, data: [] }; } }; };

await t("payload: con UUID valido incluye id (minusculas); sin id o con id invalido es el de siempre", () => {
  assert.equal(buildProgressPayload(AL, "sq", "60", "8", "", "d", 1, ID.toUpperCase()).id, ID);
  for (const bad of [undefined, null, "", "op-1", "123", 5]) assert.ok(!("id" in buildProgressPayload(AL, "sq", "60", "8", "", "d", 1, bad)), String(bad));
  assert.deepEqual(Object.keys(buildProgressPayload(AL, "sq", "60", "8", "", "d", 1)).sort(), ["alumno_id", "ejercicio_id", "fecha", "kg", "nota", "reps", "semana"]);
  assert.ok(isUuid(generateOpId()));
});

await t("POST inicial exitoso: devuelve la fila, un solo POST y ninguna lectura", async () => {
  const i = io(async () => ({ ok: true, status: 201, data: [row()] }));
  const r = await postProgressIdempotent(i, payload());
  assert.equal(r.length, 1); assert.deepEqual([i.calls.post, i.calls.get], [1, 0]); assert.equal(i.calls.bodies[0].id, ID);
});
await t("exito sin fila (array vacio, null, objeto) NO confirma", async () => {
  for (const data of [[], null, {}, "x"]) assert.equal(await postProgressIdempotent(io(async () => ({ ok: true, status: 201, data })), payload()), null, JSON.stringify(data));
});
await t("500, 403, 401 y otros HTTP no-ok: no confirmado y SIN lectura", async () => {
  for (const status of [500, 403, 401, 400, 404, 503]) {
    const i = io(async () => ({ ok: false, status, data: { code: "X", message: "m" } }));
    assert.equal(await postProgressIdempotent(i, payload()), null, String(status)); assert.equal(i.calls.get, 0);
  }
});
await t("caida de red: la excepcion se propaga (persistSetConfirmed la trata como no confirmada)", async () => {
  await assert.rejects(postProgressIdempotent(io(async () => { throw new Error("net"); }), payload()), /net/);
});

await t("23505 sobre el MISMO id y fila propia verificada -> confirmado", async () => {
  const i = io(async () => conflict(), async (id) => { assert.equal(id, ID); return { ok: true, data: [row()] }; });
  const r = await postProgressIdempotent(i, payload());
  assert.equal(r[0].id, ID); assert.deepEqual([i.calls.post, i.calls.get], [1, 1]);
});
await t("el reintento usa el MISMO id aunque se pierda la respuesta (mismo payload en cada intento)", async () => {
  const ids = []; let servidor = null;
  const post = async (p) => { ids.push(p.id); if (servidor) return conflict(p.id); servidor = row(); throw new Error("respuesta perdida"); };
  const i = io(post, async () => ({ ok: true, data: [servidor] }));
  await assert.rejects(postProgressIdempotent(i, payload()));
  const r = await postProgressIdempotent(i, payload());
  assert.deepEqual(ids, [ID, ID]); assert.equal(r.length, 1);
});
await t("409 que NO es 23505 / sin codigo / sobre otro id / de otra restriccion -> no confirmado y sin lectura", async () => {
  const casos = [
    { ok: false, status: 409, data: { code: "23503", details: `Key (id)=(${ID})` } },
    { ok: false, status: 409, data: null },
    { ok: false, status: 409, data: { message: "conflict" } },
    conflict(OTRO),
    conflict(ID, { details: `Key (alumno_id, ejercicio_id)=(${AL}, sq) already exists.` }),
    conflict(ID, { details: null, message: 'duplicate key value violates unique constraint "otra_restriccion"' }),
    conflict(ID, { details: "", message: "duplicate key" }),
  ];
  for (const c of casos) { const i = io(async () => c); assert.equal(await postProgressIdempotent(i, payload()), null, JSON.stringify(c)); assert.equal(i.calls.get, 0); }
  assert.equal(isIdConflict({ ok: true, status: 409, data: conflict().data }, ID), false);
  assert.equal(isIdConflict(conflict(), ID), true); assert.equal(isIdConflict(conflict(ID.toUpperCase()), ID), true);
  assert.equal(isIdConflict(conflict(ID, { details: null }), ID), true, "con RLS Postgres omite el detalle: se acepta por el nombre de la restriccion");
  assert.equal(isIdConflict(conflict(ID, { details: "" }), ID), true);
});
await t("conflicto SIN posibilidad de verificar la fila (lectura falla, vacia, ilegible o lanza) -> permanece pendiente", async () => {
  const lecturas = [async () => null, async () => ({ ok: false, status: 500, data: null }), async () => ({ ok: false, status: 403, data: [] }),
    async () => ({ ok: true, data: [] }), async () => ({ ok: true, data: null }), async () => ({ ok: true, data: {} }), async () => { throw new Error("net"); },
    async () => ({ ok: true, data: [row(), row()] })];
  for (const g of lecturas) assert.equal(await postProgressIdempotent(io(async () => conflict(), g), payload()), null);
});
await t("conflicto con fila de OTRO alumno o de OTRA operacion -> no se confirma", async () => {
  for (const distinta of [{ alumno_id: OTRO }, { ejercicio_id: "bp" }, { kg: 61 }, { reps: 9 }, { semana: 2 }, { nota: "x" }]) {
    assert.equal(await postProgressIdempotent(io(async () => conflict(), async () => ({ ok: true, data: [row(distinta)] })), payload()), null, JSON.stringify(distinta));
  }
});
await t("comparacion de la fila: tolera mayusculas del uuid, nota null=\"\" y kg numerico; semana null solo si ambas lo son", () => {
  assert.equal(isSameProgressRow(row({ alumno_id: AL.toUpperCase(), nota: null, kg: "60.0" }), payload()), true);
  assert.equal(isSameProgressRow(row({ semana: null }), payload({ semana: null })), true);
  assert.equal(isSameProgressRow(row({ semana: null }), payload()), false);
  assert.equal(isSameProgressRow(null, payload()), false); assert.equal(isSameProgressRow(row(), null), false);
});
await t("dos series legitimas IDENTICAS con UUID distintos: ambas se envian con su propio id y no se confunden", async () => {
  const filas = new Map(); const ids = [generateOpId(), generateOpId()];
  const post = async (p) => { if (filas.has(p.id)) return conflict(p.id); filas.set(p.id, { ...p }); return { ok: true, status: 201, data: [row({ id: p.id })] }; };
  const i = io(post, async (id) => ({ ok: true, data: filas.has(id) ? [row({ id })] : [] }));
  for (const id of ids) assert.equal((await postProgressIdempotent(i, payload({ id }))).length, 1);
  assert.equal(filas.size, 2); assert.notEqual(ids[0], ids[1]);
  assert.equal((await postProgressIdempotent(i, payload({ id: ids[0] }))).length, 1, "reintento de la primera: verificado, sin crear una tercera");
  assert.equal(filas.size, 2);
});
await t("payload sin id valido que recibe 409: no se intenta verificar (nunca se confirma por un id ajeno)", async () => {
  const i = io(async () => conflict(), async () => ({ ok: true, data: [row()] }));
  assert.equal(await postProgressIdempotent(i, buildProgressPayload(AL, "sq", "60", "8", "", "d", 1, "no-uuid")), null); assert.equal(i.calls.get, 0);
});
console.log(`${n} comprobaciones OK`);
