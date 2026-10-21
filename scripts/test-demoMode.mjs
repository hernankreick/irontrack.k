// Modo demo de la interfaz del alumno: nunca en Production, sin backend y con datos ficticios.
//
//   node scripts/test-demoMode.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert. Las comprobaciones sobre el bundle compilado (Production no
// contiene el demo; el demo no contiene URL ni clave de Supabase) las hacen los pasos de CI con scripts/check-demo-bundle.mjs.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decideDemoBuild } from "../lib/demoBuildGuard.js";
import { demoRutinaRow, demoSesiones, demoProgresoRows, demoDays, DEMO_ALUMNO_ID } from "../demo/demoData.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

await test("sin pedirlo, ningun entorno activa el demo (local, CI, Preview, Production)", () => {
  for (const env of [{}, { CI: "true" }, { VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/x" }, { VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }]) {
    assert.deepEqual(decideDemoBuild(env), { demo: false });
  }
});

await test("IRONTRACK_DEMO=1 activa el demo en local/CI y en Preview/Development", () => {
  assert.equal(decideDemoBuild({ IRONTRACK_DEMO: "1" }).demo, true);
  assert.equal(decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "preview", IRONTRACK_DEMO: "1" }).demo, true);
  assert.equal(decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "development", IRONTRACK_DEMO: "1" }).demo, true);
});

await test("una Preview de rama 'demo/...' activa el demo; cualquier otra rama no", () => {
  assert.equal(decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "demo/alumno-ui-iphone" }).demo, true);
  for (const ref of ["feat/alumno-ui-simplificado", "main", "my-demo/x", "demo", "Demo/x"]) {
    assert.equal(decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: ref }).demo, false, ref);
  }
});

await test("Production JAMAS: IRONTRACK_DEMO=1 hace fallar el build y una rama 'demo/' no lo activa", () => {
  const a = decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "production", IRONTRACK_DEMO: "1" });
  assert.equal(a.demo, false); assert.match(a.error, /Production/);
  const b = decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "demo/alumno-ui-iphone" });
  assert.deepEqual(b, { demo: false });
});

await test("fail-closed: en Vercel con VERCEL_ENV desconocido o vacio, pedir el demo falla", () => {
  assert.ok(decideDemoBuild({ VERCEL: "1", IRONTRACK_DEMO: "1" }).error);
  assert.ok(decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "staging", IRONTRACK_DEMO: "1" }).error);
  assert.equal(decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "PRODUCTION", IRONTRACK_DEMO: "1" }).demo, false);
  assert.ok(decideDemoBuild({ VERCEL: "1", VERCEL_ENV: "PRODUCTION", IRONTRACK_DEMO: "1" }).error);
});

await test("vite.config.js: el demo es una constante de compilacion y neutraliza URL y clave de Supabase", () => {
  const s = read("vite.config.js");
  assert.match(s, /decideDemoBuild\(process\.env\)/);
  assert.match(s, /__IRONTRACK_DEMO__: JSON\.stringify\(DEMO\)/);
  assert.match(s, /'import\.meta\.env\.VITE_SUPABASE_URL': '""'/);
  assert.match(s, /'import\.meta\.env\.VITE_SUPABASE_ANON_KEY': '""'/);
  assert.match(s, /if \(demoDecision\.error && isBuild\) throw/);
});

await test("el codigo de demo solo se alcanza detras de DEMO_MODE (sin imports estaticos de demo/ ni en App.jsx ni en main.jsx)", () => {
  for (const f of ["App.jsx", "main.jsx", "lib/supabaseClient.js"]) {
    assert.ok(!/from ['"][^'"]*\/demo\/[^'"]*['"]/.test(read(f)), f + " importa demo/ estaticamente");
  }
  assert.match(read("main.jsx"), /if \(DEMO_MODE\) \{\s*import\('\.\/demo\/bootDemo\.js'\)/);
  assert.match(read("lib/supabaseClient.js"), /!DEMO_MODE && url && key/);
  const app = read("App.jsx");
  assert.match(app, /if \(DEMO_MODE\) return demoApi\(\)\.fetch\(/);
  assert.match(app, /if \(DEMO_MODE\) return \[\]; \/\/ demo: sin red/);
  assert.match(app, /if \(DEMO_MODE\) \{\s*Object\.keys\(sb\)\.forEach/);
});

await test("el demo no usa credenciales ni toca autenticacion: sin claves, URLs de Supabase, JWT ni llamadas a auth", () => {
  for (const f of ["demo/bootDemo.js", "demo/demoData.js", "lib/demoMode.js", "lib/demoBuildGuard.js"]) {
    const s = read(f);
    assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(s) && !/supabase\.(co|in)/i.test(s) && !/sb_(publishable|secret)_/.test(s), f);
    assert.ok(!/signIn|signUp|\.auth\./.test(s), f + " toca auth");
  }
});

await test("bootDemo bloquea la red: solo GET de archivos estaticos del mismo origen, nunca /rest, /auth ni escrituras", () => {
  const s = read("demo/bootDemo.js");
  assert.match(s, /method !== "GET"/);
  assert.match(s, /sameOrigin/);
  assert.ok(s.includes("(rest|auth|functions|storage|realtime)\\/v1"));
});

await test("datos ficticios: alumno, rutina de 3 dias, historial con semana y series con semana (relacion rutina -> semana -> dia intacta)", () => {
  const r = demoRutinaRow();
  assert.equal(r.alumno_id, DEMO_ALUMNO_ID);
  assert.equal(demoDays().length, 3);
  for (const d of demoDays()) assert.ok(d.exercises.length >= 4 && d.label);
  const ses = demoSesiones();
  assert.ok(ses.length === 3 && ses.every((s) => Number.isFinite(s.semana) && s.rutina_id === r.id && s.dia_label && s.fecha));
  const rows = demoProgresoRows();
  assert.ok(rows.length >= 36 && rows.every((p) => p.semana === 0 && p.alumno_id === DEMO_ALUMNO_ID && p.fecha && Number.isFinite(p.kg)));
  assert.ok(!/@|\bhttps?:\/\//.test(JSON.stringify([r, ses, rows])), "sin correos ni URLs");
});

await test("CI: construye la demo, verifica los bundles y Production con demo debe fallar", () => {
  const ci = read(".github/workflows/ci.yml");
  assert.match(ci, /IRONTRACK_DEMO: "1"/);
  assert.match(ci, /check-demo-bundle\.mjs/);
  assert.ok(existsSync(path.join(ROOT, "scripts/check-demo-bundle.mjs")));
});

console.log("\n" + count + " pruebas OK");
