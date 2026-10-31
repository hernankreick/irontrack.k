// Demostracion de «Mis alumnos» (demo/mis-alumnos.html, etapa B): solo Preview, sin Supabase, sin red y sin la sesion de IronTrack.
//
//   node scripts/test-demoMisAlumnos.mjs
//
// Verifica: (1) vite.config solo la compila en Preview (o local con IRONTRACK_DEMO=1); (2) monta la pantalla REAL (CoachStudentsMain ->
// StudentsSection) y no alcanza App.jsx ni Supabase; (3) builds REALES: Production NO contiene la demo (ni el HTML ni su codigo), Preview si.
// La verificacion visual en navegador esta en scripts/qa/mis-alumnos-visual.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const DEMO = "demo/mis-alumnos.html";
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

function graph(entry) {
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
  const seen = new Set([path.join(ROOT, entry)]), pkgs = new Set(), q = [...seen];
  while (q.length) {
    const f = q.shift();
    for (const m of fs.readFileSync(f, "utf8").matchAll(re)) {
      const spec = m[1] || m[2] || m[3];
      if (!spec.startsWith(".")) { pkgs.add(spec); continue; }
      const base = path.resolve(path.dirname(f), spec);
      const hit = [base, base + ".js", base + ".jsx"].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      if (hit && !seen.has(hit)) { seen.add(hit); q.push(hit); }
    }
  }
  return { files: [...seen].map((f) => path.relative(ROOT, f).split(path.sep).join("/")), pkgs: [...pkgs] };
}

await test("vite.config: la demo de «Mis alumnos» solo entra al build en Preview (o local con IRONTRACK_DEMO=1)", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoMisAlumnos: path\.resolve\(__dirname, 'demo\/mis-alumnos\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.match(read(DEMO), /src="\/components\/demo\/misAlumnosDemoMain\.jsx"/);
  assert.match(read(DEMO), /noindex/);
});

await test("la demo monta la pantalla REAL (CoachStudentsMain -> StudentsSection) y no alcanza App.jsx ni Supabase", () => {
  const g = graph("components/demo/misAlumnosDemoMain.jsx");
  for (const real of ["components/coach/CoachStudentsMain.jsx", "components/students/StudentsSection.jsx", "components/students/StudentCard.jsx", "components/students/alumnosPaleta.js"]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"));
  assert.ok(!g.files.includes("lib/supabaseClient.js"));
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), g.pkgs.join(", "));
  assert.ok(!graph("main.jsx").files.some((f) => f.startsWith("components/demo/")), "la app no importa ninguna demo");
});

await test("builds reales: Production NO contiene la demo de «Mis alumnos» (HTML ni codigo); Preview si", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-ma-"));
  const base = { ...process.env, VITE_SUPABASE_URL: "https://ci-simulado.example.com", VITE_SUPABASE_ANON_KEY: "ci-simulada-anon-key-0123456789", VERCEL: "1" };
  delete base.IRONTRACK_DEMO;
  const build = (envName) => {
    const out = path.join(tmp, envName);
    const r = spawnSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: { ...base, VERCEL_ENV: envName }, encoding: "utf8" });
    assert.equal(r.status, 0, "build " + envName + ": " + (r.stderr || r.stdout || "").slice(-400));
    return out;
  };
  const marcas = /misAlumnosDemo|MisAlumnosDemo|Mis alumnos · datos ficticios/;
  const tieneDemo = (out) => fs.existsSync(path.join(out, DEMO)) ||
    fs.readdirSync(path.join(out, "assets")).some((f) => f.endsWith(".js") && marcas.test(fs.readFileSync(path.join(out, "assets", f), "utf8")));
  const prod = build("production");
  assert.ok(!fs.existsSync(path.join(prod, "demo")), "Production sin carpeta demo/");
  assert.ok(!tieneDemo(prod), "Production sin el HTML ni el codigo de la demo");
  const prev = build("preview");
  assert.ok(fs.existsSync(path.join(prev, DEMO)), "Preview con demo/mis-alumnos.html");
  assert.ok(tieneDemo(prev));
  fs.rmSync(tmp, { recursive: true, force: true });
});

console.log("\n" + count + " pruebas OK");
