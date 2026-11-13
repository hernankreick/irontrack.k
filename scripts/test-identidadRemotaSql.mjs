// Contrato SQL de identidad remota v1 (estatico, sin red ni base): los scripts de docs/identidad-remota-v1 deben ser coherentes con lib/identidadRemota.js
// y respetar los limites de seguridad (sin FK, sin DEFAULT/NOT NULL, sin DML sobre datos, indices CONCURRENTLY, CHECK NOT VALID).
//   node scripts/test-identidadRemotaSql.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CAMPOS_REMOTOS_SERIE, CAMPOS_REMOTOS_SESION, POS_MAX, TOKEN_ACTIVACION } from "../lib/identidadRemota.js";

const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "identidad-remota-v1");
const rd = (f) => readFileSync(path.join(D, f), "utf8");
const sinComentarios = (s) => s.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");
let n = 0; const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const mig = sinComentarios(rd("1_migracion.sql")), rb = sinComentarios(rd("3_rollback.sql")), pre = sinComentarios(rd("0_preflight.sql")), ver = sinComentarios(rd("2_verificacion.sql"));

test("la migracion agrega exactamente las columnas que el codigo envia, nullable y sin DEFAULT", () => {
  const cols = [...mig.matchAll(/ALTER TABLE public\.(\w+) ADD COLUMN IF NOT EXISTS (\w+)\s+(\w+);/g)].map((m) => m[1] + "." + m[2] + ":" + m[3]).sort();
  const esperado = [...CAMPOS_REMOTOS_SERIE.map((c) => "progreso." + c), ...CAMPOS_REMOTOS_SESION.map((c) => "sesiones." + c)];
  assert.deepEqual(cols.map((c) => c.split(":")[0]).sort(), esperado.sort());
  const tipos = Object.fromEntries(cols.map((c) => c.split(":")));
  assert.deepEqual([tipos["progreso.sesion_uid"], tipos["progreso.bloque"], tipos["progreso.pos"], tipos["sesiones.sesion_uid"], tipos["sesiones.identidad_v"]], ["uuid", "text", "smallint", "uuid", "smallint"]);
  assert.equal(/ADD COLUMN[^;]*(DEFAULT|NOT NULL)/i.test(mig), false);
});
test("sin FK, sin backfill ni DML, sin tocar RLS/politicas/funciones/triggers", () => {
  for (const [nombre, sql] of [["migracion", mig], ["rollback", rb]]) {
    assert.equal(/FOREIGN KEY|REFERENCES/i.test(sql), false, nombre + ": FK");
    assert.equal(/\b(INSERT\s+INTO|UPDATE\s+public|DELETE\s+FROM|TRUNCATE)\b/i.test(sql), false, nombre + ": DML");
    assert.equal(/POLICY|ROW LEVEL SECURITY|GRANT|REVOKE|CREATE\s+(OR REPLACE\s+)?(FUNCTION|TRIGGER)|DROP\s+(FUNCTION|TRIGGER|POLICY)/i.test(sql), false, nombre + ": RLS/RPC/trigger");
  }
});
test("preflight y verificacion son de solo lectura", () => {
  for (const sql of [pre, ver]) assert.equal(/\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|TRUNCATE|GRANT|REVOKE|NOTIFY)\b/i.test(sql.replace(/'[^']*'/g, "''")), false);
});
test("CHECK en NOT VALID + VALIDATE; indices CONCURRENTLY fuera de la transaccion; unico parcial en sesiones, no unico en progreso", () => {
  const checks = [...mig.matchAll(/ADD CONSTRAINT (\w+) CHECK[^;]*?NOT VALID;/g)].map((m) => m[1]).sort();
  assert.deepEqual(checks, ["progreso_bloque_chk", "progreso_bloque_pos_juntos_chk", "progreso_pos_chk", "sesiones_identidad_v_chk"]);
  for (const c of checks) assert.ok(mig.includes("VALIDATE CONSTRAINT " + c), "falta VALIDATE " + c);
  assert.ok(/CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS sesiones_sesion_uid_uidx ON public\.sesiones \(sesion_uid\) WHERE sesion_uid IS NOT NULL;/.test(mig));
  assert.ok(/CREATE INDEX CONCURRENTLY IF NOT EXISTS progreso_sesion_uid_idx ON public\.progreso \(sesion_uid\) WHERE sesion_uid IS NOT NULL;/.test(mig));
  const dentro = mig.slice(mig.indexOf("BEGIN;"), mig.indexOf("COMMIT;"));
  assert.equal(/CREATE\s+(UNIQUE\s+)?INDEX/i.test(dentro), false, "indice dentro de la transaccion");
  assert.ok(/lock_timeout/.test(mig)); assert.ok(/NOTIFY pgrst, 'reload schema'/.test(mig));
});
test("restricciones coherentes con el cliente (bloque warmup|main, pos 0..smallint, juntos)", () => {
  assert.ok(/bloque IN \('warmup', 'main'\)/.test(mig)); assert.ok(/pos >= 0/.test(mig)); assert.ok(/\(bloque IS NULL\) = \(pos IS NULL\)/.test(mig));
  assert.equal(POS_MAX, 32767);
});
test("el rollback revierte todo lo creado y la verificacion cubre cada objeto", () => {
  for (const o of ["pos", "bloque", "sesion_uid", "identidad_v"]) assert.ok(new RegExp("DROP COLUMN IF EXISTS " + o + "\\b").test(rb), "rollback " + o);
  for (const o of ["progreso_bloque_chk", "progreso_pos_chk", "progreso_bloque_pos_juntos_chk", "sesiones_identidad_v_chk"]) { assert.ok(rb.includes(o)); assert.ok(ver.includes(o)); }
  for (const o of ["sesiones_sesion_uid_uidx", "progreso_sesion_uid_idx"]) assert.ok(ver.includes(o));
});
test("la propuesta y el runbook referencian el mismo token de activacion que el codigo", () => {
  const rbk = readFileSync(path.join(D, "RUNBOOK.md"), "utf8");
  assert.ok(rbk.includes(TOKEN_ACTIVACION));
});
console.log("\n" + n + " pruebas OK");
