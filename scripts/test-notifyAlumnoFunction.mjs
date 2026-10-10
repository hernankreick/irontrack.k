// Autorizacion de la Edge Function notify-alumno + ausencia de clave privada en el cliente.
// Todo en memoria: dependencias falsas, sin red, sin Supabase ni OneSignal reales.
//
//   node scripts/test-notifyAlumnoFunction.mjs

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleNotify, makeIsCoachAccount } from "../supabase/functions/notify-alumno/core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0, failed = 0;
async function test(name, fn) {
  try { await fn(); passed++; console.log("ok   - " + name); }
  catch (e) { failed++; console.log("FAIL - " + name + "\n       " + (e && e.message)); }
}

const COACH_UUID = "11111111-1111-1111-1111-111111111111";
const OTHER_COACH_UUID = "22222222-2222-2222-2222-222222222222";
const STUDENT_UUID = "33333333-3333-3333-3333-333333333333";
const tokens = {
  "tok-coach":   { id: COACH_UUID, email: "entrenador@irontrack.app" },
  "tok-student": { id: STUDENT_UUID, email: "alumno@x.com" },
  "tok-other":   { id: OTHER_COACH_UUID, email: "otro@coach.com" },
};
const alumnos = {
  "a-legacy": { id: "a-legacy", entrenador_id: "entrenador_principal", email: "alumno@x.com", onesignal_id: "player-1" },
  "a-uuid":   { id: "a-uuid", entrenador_id: COACH_UUID, email: "b@x.com", onesignal_id: "player-2" },
  "a-foreign":{ id: "a-foreign", entrenador_id: OTHER_COACH_UUID, email: "c@x.com", onesignal_id: "player-3" },
  "a-nosub":  { id: "a-nosub", entrenador_id: COACH_UUID, email: "d@x.com", onesignal_id: null },
};

function makeDeps(over = {}) {
  const calls = { push: [] };
  const deps = {
    corsHeaders: {},
    getUser: async (t) => tokens[t] || null,
    getAlumno: async (id) => alumnos[id] || null,
    isCoachAccount: async (u) => u.id === COACH_UUID || u.id === OTHER_COACH_UUID,
    sendPush: async (a) => { calls.push.push(a); return { ok: true, status: 200 }; }, // simulado: nunca sale a la red
    ...over,
  };
  return { deps, calls };
}
const call = (deps, { token, body, method = "POST", raw } = {}) =>
  handleNotify(new Request("https://f.local/notify-alumno", {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: method === "POST" ? (raw ?? JSON.stringify(body ?? {})) : undefined,
  }), deps);

await test("1. entrenador legitimo (alumno legacy entrenador_principal) -> 200 y push simulado", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "tok-coach", body: { alumnoId: "a-legacy", mensaje: "Hola" } });
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, sent: true });
  assert.deepEqual(calls.push, [{ playerId: "player-1", mensaje: "Hola" }]);
});
await test("1b. entrenador legitimo (alumno con su UUID) -> 200", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "tok-coach", body: { alumnoId: "a-uuid", mensaje: "Hola" } });
  assert.equal(r.status, 200); assert.equal(calls.push.length, 1);
});
await test("1c. alumno sin onesignal_id -> 200 sent:false, sin push (igual que antes)", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "tok-coach", body: { alumnoId: "a-nosub", mensaje: "Hola" } });
  assert.equal(r.status, 200); assert.equal((await r.json()).sent, false); assert.equal(calls.push.length, 0);
});
await test("2. alumno autenticado intentando enviar -> 403, sin push", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "tok-student", body: { alumnoId: "a-legacy", mensaje: "x" } });
  assert.equal(r.status, 403); assert.equal(calls.push.length, 0);
});
await test("3. usuario anonimo (sin Authorization) -> 401, sin push", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { body: { alumnoId: "a-legacy", mensaje: "x" } });
  assert.equal(r.status, 401); assert.equal(calls.push.length, 0);
});
await test("3b. clave anon como Bearer (no es sesion de usuario) -> 401, sin push", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "anon-key-no-es-usuario", body: { alumnoId: "a-legacy", mensaje: "x" } });
  assert.equal(r.status, 401); assert.equal(calls.push.length, 0);
});
await test("4. entrenador sobre alumno ajeno (otro entrenador) -> 403, sin push", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "tok-coach", body: { alumnoId: "a-foreign", mensaje: "x" } });
  assert.equal(r.status, 403); assert.equal(calls.push.length, 0);
});
await test("4b. alumnoId inexistente -> 403 (misma respuesta que ajeno)", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "tok-coach", body: { alumnoId: "nope", mensaje: "x" } });
  assert.equal(r.status, 403); assert.equal(calls.push.length, 0);
});
await test("4c. entrenador B sobre alumno de A (UUID) -> 403; pero B si puede sobre legacy (limite conocido)", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "tok-other", body: { alumnoId: "a-uuid", mensaje: "x" } });
  assert.equal(r.status, 403); assert.equal(calls.push.length, 0);
  const r2 = await call(deps, { token: "tok-other", body: { alumnoId: "a-legacy", mensaje: "x" } });
  assert.equal(r2.status, 200); // riesgo documentado: el id legacy es compartido
});
await test("5. token invalido -> 401, sin push", async () => {
  const { deps, calls } = makeDeps();
  const r = await call(deps, { token: "basura.jwt.invalido", body: { alumnoId: "a-legacy", mensaje: "x" } });
  assert.equal(r.status, 401); assert.equal(calls.push.length, 0);
});
await test("5b. getUser que lanza excepcion -> 401, sin push", async () => {
  const { deps, calls } = makeDeps({ getUser: async () => { throw new Error("boom"); } });
  const r = await call(deps, { token: "tok-coach", body: { alumnoId: "a-legacy", mensaje: "x" } });
  assert.equal(r.status, 401); assert.equal(calls.push.length, 0);
});
await test("6. el destinatario sale del servidor: un onesignal_id enviado por el cliente se ignora", async () => {
  const { deps, calls } = makeDeps();
  await call(deps, { token: "tok-coach", body: { alumnoId: "a-legacy", mensaje: "x", onesignal_id: "atacante", include_player_ids: ["atacante"] } });
  assert.equal(calls.push[0].playerId, "player-1");
});
await test("7. validacion: faltan campos / mensaje vacio / demasiado largo / JSON roto -> 400", async () => {
  const { deps, calls } = makeDeps();
  for (const body of [{}, { alumnoId: "a-legacy" }, { mensaje: "x" }, { alumnoId: "a-legacy", mensaje: "  " }, { alumnoId: "a-legacy", mensaje: "x".repeat(501) }]) {
    assert.equal((await call(deps, { token: "tok-coach", body })).status, 400);
  }
  assert.equal((await call(deps, { token: "tok-coach", raw: "{no json" })).status, 400);
  assert.equal(calls.push.length, 0);
});
await test("8. fallos de infraestructura: getAlumno lanza -> 500; OneSignal falla -> 502; sin filtrar detalles", async () => {
  let { deps } = makeDeps({ getAlumno: async () => { throw new Error("db secret detail"); } });
  let r = await call(deps, { token: "tok-coach", body: { alumnoId: "a-legacy", mensaje: "x" } });
  assert.equal(r.status, 500); assert.ok(!(await r.text()).includes("secret detail"));
  ({ deps } = makeDeps({ sendPush: async () => ({ ok: false, status: 400 }) }));
  assert.equal((await call(deps, { token: "tok-coach", body: { alumnoId: "a-legacy", mensaje: "x" } })).status, 502);
  ({ deps } = makeDeps({ sendPush: async () => { throw new Error("net"); } }));
  assert.equal((await call(deps, { token: "tok-coach", body: { alumnoId: "a-legacy", mensaje: "x" } })).status, 502);
});
await test("9. OPTIONS (CORS) -> 200; GET -> 405", async () => {
  const { deps } = makeDeps();
  assert.equal((await call(deps, { method: "OPTIONS" })).status, 200);
  assert.equal((await call(deps, { method: "GET", token: "tok-coach" })).status, 405);
});

await test("2b. regla real isCoachAccount: alumno con sesion valida (en alumnos, no en entrenadores) -> false", async () => {
  const rows = { coaches: new Set([COACH_UUID, OTHER_COACH_UUID]), alumnoEmails: new Set(["alumno@x.com"]) };
  const mk = (allowList = []) => makeIsCoachAccount({
    allowList,
    coachExists: async (id) => rows.coaches.has(id),
    emailIsAlumno: async (e) => rows.alumnoEmails.has(e.toLowerCase()),
  });
  assert.equal(await mk()(tokens["tok-coach"]), true);
  assert.equal(await mk()(tokens["tok-student"]), false);                       // no esta en entrenadores
  assert.equal(await mk()({ id: "x", email: "random@x.com" }), false);          // usuario cualquiera
  rows.coaches.add(STUDENT_UUID);                                               // alumno que se auto-inserto en entrenadores
  assert.equal(await mk()(tokens["tok-student"]), false);                       // lo frena el email de alumnos
  rows.coaches.add("44444444-4444-4444-4444-444444444444");
  assert.equal(await mk()({ id: "44444444-4444-4444-4444-444444444444", email: "z@z.com" }), true);
  assert.equal(await mk([COACH_UUID])({ id: "44444444-4444-4444-4444-444444444444", email: "z@z.com" }), false); // allowlist
  assert.equal(await mk([COACH_UUID])(tokens["tok-coach"]), true);
});

// ── Cliente: sin clave privada y sin llamada directa a OneSignal REST ──
function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".git", "dist"].includes(n)) continue;
    const p = path.join(dir, n); const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs|cjs|ts|tsx|html|json|md|sql|example)$/.test(n) || n === "env.example") out.push(p);
  }
  return out;
}
await test("10. ningun archivo del repo contiene una clave privada de OneSignal (os_v2_app_...)", () => {
  const bad = walk(ROOT).filter((f) => /os_v2_app_[a-z0-9]{20,}/i.test(readFileSync(f, "utf8")));
  assert.deepEqual(bad.map((f) => path.relative(ROOT, f)), []);
});
await test("11. el cliente invoca la funcion y no habla con la API REST de OneSignal", () => {
  const hook = readFileSync(path.join(ROOT, "hooks/useAlumnos.js"), "utf8");
  assert.ok(/functions\.invoke\('notify-alumno'/.test(hook));
  assert.ok(!/onesignal\.com\/api/.test(hook) && !/ONESIGNAL_KEY/.test(hook));
  assert.ok(!/Basic /.test(hook));
  const app = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  assert.ok(!/onesignal\.com\/api/.test(app));
});
await test("12. la funcion lee la clave solo del entorno (Deno.env), sin literal", () => {
  const idx = readFileSync(path.join(ROOT, "supabase/functions/notify-alumno/index.ts"), "utf8");
  assert.ok(/Deno\.env\.get\('ONESIGNAL_REST_API_KEY'\)/.test(idx));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
