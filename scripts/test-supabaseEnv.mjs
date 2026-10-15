// Conexion a Supabase sin respaldo + controles de build Production/Preview.   node scripts/test-supabaseEnv.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { readSupabaseEnv } from "../lib/supabaseEnv.js";
import { checkBuildEnv, PROD_SUPABASE_REF } from "./buildEnvGuard.mjs";

let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const read = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
const GOOD = { VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_ANON_KEY: "a".repeat(40) };
const PROD = { VITE_SUPABASE_URL: `https://${PROD_SUPABASE_REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: "b".repeat(40) };

t("sin variables / vacias / de ejemplo: no configurado y sin valores de respaldo", () => {
  for (const env of [undefined, {}, { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" }, { VITE_SUPABASE_URL: GOOD.VITE_SUPABASE_URL },
    { VITE_SUPABASE_ANON_KEY: GOOD.VITE_SUPABASE_ANON_KEY }, { VITE_SUPABASE_URL: "no-es-url", VITE_SUPABASE_ANON_KEY: GOOD.VITE_SUPABASE_ANON_KEY },
    { VITE_SUPABASE_URL: "https://TU-PROYECTO.supabase.co", VITE_SUPABASE_ANON_KEY: "TU_CLAVE_ANON_O_PUBLISHABLE" },
    { VITE_SUPABASE_URL: GOOD.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: "corta" }, { VITE_SUPABASE_URL: "ftp://x.y", VITE_SUPABASE_ANON_KEY: GOOD.VITE_SUPABASE_ANON_KEY }]) {
    const r = readSupabaseEnv(env);
    assert.equal(r.configured, false, JSON.stringify(env)); assert.equal(r.url, ""); assert.equal(r.key, ""); assert.ok(r.reason);
  }
});
t("valores validos se aceptan (se normaliza la barra final)", () => {
  const r = readSupabaseEnv({ ...GOOD, VITE_SUPABASE_URL: "http://127.0.0.1:54321/" });
  assert.deepEqual([r.configured, r.url], [true, "http://127.0.0.1:54321"]);
});
t("build Production sin variables FALLA con mensaje claro; con variables pasa", () => {
  const r = checkBuildEnv({ env: {}, vercelEnv: "production" });
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /PRODUCCION sin conexion a Supabase/);
  assert.equal(checkBuildEnv({ env: PROD, vercelEnv: "production" }).errors.length, 0);
  assert.equal(checkBuildEnv({ env: {}, vercelEnv: "", }).errors.length, 0); // local sin flag: solo aviso
  assert.equal(checkBuildEnv({ env: { VITE_REQUIRE_SUPABASE: "1" }, vercelEnv: "" }).errors.length, 1);
});
t("build Preview apuntando a produccion FALLA (salvo excepcion explicita)", () => {
  const r = checkBuildEnv({ env: PROD, vercelEnv: "preview" });
  assert.equal(r.errors.length, 1); assert.match(r.errors[0], /PREVIEW apunta a la base de PRODUCCION/);
  assert.equal(checkBuildEnv({ env: { ...PROD, VITE_ALLOW_PROD_IN_PREVIEW: "1" }, vercelEnv: "preview" }).errors.length, 0);
});
t("build Preview sin variables o con QA local: sale (inerte / QA) con aviso", () => {
  const r = checkBuildEnv({ env: {}, vercelEnv: "preview" });
  assert.equal(r.errors.length, 0); assert.equal(r.warnings.length, 1);
  assert.equal(checkBuildEnv({ env: GOOD, vercelEnv: "preview" }).errors.length, 0);
});
t("codigo: ningun valor de respaldo de Supabase ni peticion sin configuracion", () => {
  const app = read("App.jsx"), client = read("lib/supabaseClient.js");
  assert.ok(!/VITE_SUPABASE_URL\s*\|\|/.test(app + client) && !/VITE_SUPABASE_ANON_KEY\s*\|\|/.test(app + client));
  assert.ok(!/supabase\.co/.test(app + client + read("lib/supabaseEnv.js")));
  assert.ok(/const SB_CONFIGURED = SUPABASE_ENV\.configured/.test(app));
  for (const fn of ["const sbFetch = async", "const sbFetchStrict = async"]) {
    const i = app.indexOf(fn); assert.ok(/SB_CONFIGURED/.test(app.slice(i, i + 260)), fn);
  }
  assert.ok(/deleteAlumno: async function \(id\) \{\s*if \(!SB_CONFIGURED\)/.test(app));
  assert.ok(/if \(!SB_CONFIGURED\) return;/.test(app));
  assert.ok(/SUPABASE_ENV\.configured\s*\?\s*createClient/.test(client) && /: null;/.test(client));
  assert.ok(/Entorno sin base de datos configurada/.test(app));
});
t(".env ya no esta versionado, esta ignorado, y .env.example no tiene credenciales reales", () => {
  const tracked = execFileSync("git", ["ls-files"], { cwd: new URL("..", import.meta.url).pathname, encoding: "utf8" }).split("\n");
  assert.ok(!tracked.includes(".env"), ".env sigue en el indice");
  assert.ok(tracked.includes(".env.example"));
  const gi = read(".gitignore").split("\n").map((l) => l.trim());
  assert.ok(gi.includes(".env") && gi.includes(".env.*") && gi.includes("!.env.example"));
  const ex = read(".env.example");
  assert.ok(!/supabase\.co/.test(ex.replace(/TU-PROYECTO\.supabase\.co/, "")), ".env.example con host real");
  assert.ok(!ex.includes(PROD_SUPABASE_REF) && !/sb_publishable_|eyJ[A-Za-z0-9_-]{20,}/.test(ex));
  assert.equal(readSupabaseEnv({ VITE_SUPABASE_URL: "https://TU-PROYECTO.supabase.co", VITE_SUPABASE_ANON_KEY: "TU_CLAVE_ANON_O_PUBLISHABLE" }).configured, false, "el ejemplo no debe pasar por valido");
});
console.log(n + " tests ok");
