// Ejecuta `vite build` REAL en los escenarios de entorno (Production/Preview) y verifica el resultado y el bundle.
//   node scripts/check-build-env.mjs      (≈10 s por escenario; no es parte de test-*.mjs)
// Las variables VITE_* se pasan por entorno (tienen prioridad sobre cualquier .env local). No usa valores de produccion
// salvo la URL sintetica del proyecto de produccion para comprobar que el Preview la RECHAZA.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROD_SUPABASE_REF } from "./buildEnvGuard.mjs";

const root = new URL("..", import.meta.url).pathname;
const vite = join(root, "node_modules/vite/bin/vite.js");
const FAKE_KEY = "k".repeat(40);
const base = { ...process.env }; for (const k of ["VERCEL_ENV", "VITE_REQUIRE_SUPABASE", "VITE_ALLOW_PROD_IN_PREVIEW"]) delete base[k];
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
function build(env) {
  const out = mkdtempSync(join(tmpdir(), "irontrack-build-"));
  const r = spawnSync(process.execPath, [vite, "build", "--outDir", out, "--emptyOutDir"], { cwd: root, env: { ...base, ...env }, encoding: "utf8" });
  return { status: r.status, log: (r.stdout || "") + (r.stderr || ""), out };
}
const bundleText = (dir) => { const d = join(dir, "assets"); return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".js")).map((f) => readFileSync(join(d, f), "utf8")).join("\n") : ""; };
const EMPTY = { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" };

t("Production sin variables: el build FALLA con mensaje claro", () => {
  const r = build({ VERCEL_ENV: "production", ...EMPTY });
  assert.notEqual(r.status, 0); assert.match(r.log, /PRODUCCION sin conexion a Supabase/);
});
t("Production con variables locales ficticias: build OK y el bundle usa SOLO esa URL", () => {
  const r = build({ VERCEL_ENV: "production", VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_ANON_KEY: FAKE_KEY });
  assert.equal(r.status, 0, r.log.slice(-400));
  const js = bundleText(r.out); assert.ok(js.includes("127.0.0.1:54321")); assert.ok(!js.includes(PROD_SUPABASE_REF));
});
t("Preview apuntando a produccion: el build FALLA", () => {
  const r = build({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: `https://${PROD_SUPABASE_REF}.supabase.co`, VITE_SUPABASE_ANON_KEY: FAKE_KEY });
  assert.notEqual(r.status, 0); assert.match(r.log, /PREVIEW apunta a la base de PRODUCCION/);
});
t("Preview SIN variables: build OK, modo inerte y el bundle no contiene ningun host de produccion ni de Supabase", () => {
  const r = build({ VERCEL_ENV: "preview", ...EMPTY });
  assert.equal(r.status, 0, r.log.slice(-400)); assert.match(r.log, /modo inerte/);
  const js = bundleText(r.out);
  assert.ok(!js.includes(PROD_SUPABASE_REF) && !/[a-z0-9]{20}\.supabase\.co/.test(js), "el bundle contiene una URL de Supabase");
  assert.ok(js.includes("Entorno sin base de datos configurada"));
});
console.log(n + " escenarios ok");
