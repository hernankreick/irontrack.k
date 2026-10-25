// RLS P0 — compatibilidad entre el frontend y las migraciones (comprobaciones estaticas, sin red ni base de datos).
//
//   node scripts/test-rlsFrontendCompat.mjs
//
// 1. Toda tabla que el frontend consulta esta en el barrido de la migracion B (si alguien agrega una tabla nueva, falla hasta revisar su RLS).
// 2. El modelo de identidad no se apoya en datos que el cliente puede escribir (entrenadores, alumnos.auth_uid, user_metadata, email).
// 3. El vinculo del alumno que lee el RLS (app_metadata.alumno_id) es el que escribe la Edge Function al crear la cuenta.
// 4. La carga de config/overrides depende del usuario autenticado: con RLS la primera carga (previa al login, con la clave anonima) no trae nada.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

function walk(dir, out = []) {
  for (const e of readdirSync(path.join(ROOT, dir))) {
    const rel = dir + "/" + e;
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(jsx?|mjs)$/.test(e)) out.push(rel);
  }
  return out;
}

const identity = read("supabase/migrations/20261025100000_rls_p0_identity.sql");
const lockdown = read("supabase/migrations/20261025110000_rls_p0_lockdown.sql");
const managed = new Set([...(/FOREACH t IN ARRAY ARRAY\[([\s\S]*?)\]/.exec(lockdown)[1].matchAll(/'([a-z0-9_]+)'/g))].map((m) => m[1]));

test("la migracion B gestiona las 15 tablas esperadas", () => {
  assert.equal(managed.size, 15);
  for (const t of ["alumnos", "rutinas", "progreso", "sesiones", "mensajes", "fotos", "notas", "config", "entrenadores", "video_overrides",
    "ejercicio_overrides", "ejercicios_custom", "coach_calendar_assignments", "coach_notification_reads", "ejercicios_custom_backup_pre_fase1"]) {
    assert.ok(managed.has(t), "falta " + t);
  }
});

test("toda tabla que usa el frontend esta cubierta por la migracion B", () => {
  const files = ["App.jsx", ...walk("components"), ...walk("lib"), ...walk("hooks"), ...walk("contexts")];
  const used = new Map();
  const add = (t, f) => { if (!used.has(t)) used.set(t, new Set()); used.get(t).add(f); };
  for (const f of files) {
    const src = read(f);
    for (const m of src.matchAll(/\.from\(\s*["']([a-z0-9_]+)["']\s*\)/g)) add(m[1], f);
    for (const m of src.matchAll(/(?:sbFetch|sbFetchStrict|sbRequestStatus)\(\s*["'`]([a-z0-9_]+)[?"'`]/g)) add(m[1], f);
    for (const m of src.matchAll(/\/rest\/v1\/([a-z0-9_]+)/g)) add(m[1], f);
  }
  assert.ok(used.size >= 10, "el inventario deberia detectar al menos 10 tablas (detectadas: " + used.size + ")");
  const missing = [...used.keys()].filter((t) => !managed.has(t));
  assert.deepEqual(missing, [], "tablas usadas por el frontend sin RLS gestionado: " + missing.join(", "));
});

test("las funciones de autorizacion no usan entrenadores, auth_uid, user_metadata ni email", () => {
  const code = identity.replace(/--.*$/gm, "");
  assert.ok(code.includes("coach_accounts") && code.includes("app_metadata"));
  for (const bad of ["user_metadata", "auth_uid", "public.entrenadores", "email"]) assert.ok(!code.includes(bad), "no debe usar " + bad);
  assert.ok(!/security\s+definer/i.test(code), "sin SECURITY DEFINER");
  // coach_accounts: sin escritura desde la API
  assert.ok(/REVOKE ALL ON TABLE public\.coach_accounts FROM PUBLIC, anon, authenticated/.test(identity));
  assert.ok(!/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*coach_accounts[^;]*authenticated/i.test(identity));
});

test("el vinculo que lee el RLS es el que escribe la Edge Function al crear la cuenta", () => {
  const handler = read("supabase/functions/update-alumno-password/handler.js");
  assert.ok(/app_metadata:\s*\{\s*alumno_id:\s*String\(alumno\.id\)\s*\}/.test(handler), "la funcion debe crear la cuenta con app_metadata.alumno_id");
  assert.ok(identity.includes("app_metadata' ->> 'alumno_id'"), "el RLS debe leer app_metadata.alumno_id");
  assert.ok(!/user_metadata.*alumno_id/.test(identity.replace(/--.*$/gm, "")), "el RLS no debe leer user_metadata");
});

test("la migracion B no depende de coach_notification_reads (puede no existir) ni la crea", () => {
  assert.ok(/to_regclass\('public\.coach_notification_reads'\) IS NOT NULL/.test(lockdown));
  assert.ok(!/CREATE TABLE[^;]*coach_notification_reads/i.test(lockdown));
});

test("App.jsx recarga config y overrides al cambiar el usuario autenticado (no solo al montar)", () => {
  const app = read("App.jsx");
  const i = app.indexOf("sb.getConfig().then");
  assert.ok(i > 0, "no se encontro la carga de config");
  const end = app.indexOf("}, [", i);
  assert.ok(end > i);
  const deps = app.slice(end, app.indexOf("]", end) + 1);
  assert.equal(deps, "}, [supabaseSessionUserId]", "el efecto debe depender de supabaseSessionUserId, no de []");
  assert.ok(app.slice(i, end).includes("sb.getVideoOverrides") && app.slice(i, end).includes("sb.getNameOverrides"));
});

console.log("\n" + count + " tests ok");
