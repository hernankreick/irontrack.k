// sbRequestStatus (App.jsx): sin configuracion de Supabase NO emite ninguna peticion REST; configurado, devuelve { ok, status, data }.
//   node scripts/test-sbRequestStatus.mjs
// Se extrae la funcion REAL del codigo fuente y se ejecuta con fetch/sesion simulados (App.jsx no es importable sin React).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const a = src.indexOf("const sbRequestStatus = async");
assert.ok(a > 0, "no se encontro sbRequestStatus");
const b = src.indexOf("\n};\n", a) + 4;
const fnSrc = src.slice(a, b);
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

function build({ url, key, respuesta, falla }) {
  const calls = [];
  const fetchStub = async (u, opts) => { calls.push({ u, opts }); if (falla) throw new Error("net"); return respuesta; };
  const make = new Function("SB_URL", "SB_KEY", "fetch", "getActiveSupabaseSession", "console", fnSrc + "\nreturn sbRequestStatus;");
  const quiet = { error() {}, log() {}, warn() {} };
  return { run: make(url, key, fetchStub, async () => ({ access_token: "tok-usuario" }), quiet), calls };
}
const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body == null ? "" : JSON.stringify(body)), statusText: "" });

await t("sin URL: no emite ninguna peticion y devuelve { ok:false, status:0, data:null }", async () => {
  for (const url of [undefined, null, ""]) {
    const { run, calls } = build({ url, key: "k".repeat(30) });
    assert.deepEqual(await run("progreso", "POST", { a: 1 }), { ok: false, status: 0, data: null }); assert.equal(calls.length, 0, String(url));
  }
});
await t("sin clave: no emite ninguna peticion", async () => {
  for (const key of [undefined, null, ""]) { const { run, calls } = build({ url: "http://127.0.0.1:54321", key }); await run("progreso?id=eq.x", "GET"); assert.equal(calls.length, 0, String(key)); }
});
await t("sin URL ni clave y metodo GET: tampoco", async () => {
  const { run, calls } = build({ url: "", key: "" }); const r = await run("progreso"); assert.equal(r.ok, false); assert.equal(calls.length, 0);
});
await t("configurado: una peticion con el token de la sesion, y conserva status y cuerpo (201, 409 con code, 500)", async () => {
  for (const [status, body] of [[201, [{ id: "x" }]], [409, { code: "23505", details: null, message: 'duplicate key value violates unique constraint "progreso_pkey"' }], [500, { message: "boom" }]]) {
    const { run, calls } = build({ url: "http://127.0.0.1:54321", key: "k".repeat(30), respuesta: resp(status, body) });
    const r = await run("progreso", "POST", { id: "x" });
    assert.equal(calls.length, 1); assert.equal(calls[0].u, "http://127.0.0.1:54321/rest/v1/progreso"); assert.equal(calls[0].opts.headers.Authorization, "Bearer tok-usuario");
    assert.deepEqual([r.ok, r.status, r.data], [status < 300, status, body]);
  }
});
await t("configurado: cuerpo vacio -> data null; JSON invalido -> data null; falla de red -> lanza (lo trata persistSetConfirmed)", async () => {
  assert.equal((await build({ url: "http://h", key: "k".repeat(30), respuesta: resp(200, null) }).run("p")).data, null);
  assert.equal((await build({ url: "http://h", key: "k".repeat(30), respuesta: { ok: true, status: 200, text: async () => "{no-json", statusText: "" } }).run("p")).data, null);
  await assert.rejects(build({ url: "http://h", key: "k".repeat(30), falla: true }).run("p"), /net/);
});
await t("compatibilidad: la guarda no depende de constantes exclusivas del PR de seguridad (SB_CONFIGURED/SUPABASE_ENV)", () => {
  assert.ok(!/SB_CONFIGURED|SUPABASE_ENV/.test(fnSrc));
});
console.log(`${n} comprobaciones OK`);
