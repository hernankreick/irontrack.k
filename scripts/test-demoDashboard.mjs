// Demostracion del Dashboard del entrenador (demo/dashboard-coach.html, D4): solo Preview, sin Supabase, sin red y sin la sesion de IronTrack.
//
//   node scripts/test-demoDashboard.mjs
//
// Verifica: (1) vite.config solo la compila en Preview (o local con IRONTRACK_DEMO=1); (2) usa los componentes y la navegacion REALES y
// no alcanza App.jsx ni Supabase; (3) datos ficticios con los 5 estados; (4) builds REALES: Production simulado NO contiene la demo (ni el
// HTML ni su codigo) y Preview simulado si. En Production, vercel.json reescribe cualquier ruta a index.html (la app con su login).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const DEMO = "demo/dashboard-coach.html";
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

await test("vite.config: la demo del Dashboard solo entra al build en Preview (o local con IRONTRACK_DEMO=1)", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoDashboard: path\.resolve\(__dirname, 'demo\/dashboard-coach\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.match(cfg, /plugins: \[envTargetGuardPlugin\(\), react\(\), tailwindcss\(\)\]/, "el guard de entorno sigue activo");
  const html = read(DEMO);
  assert.match(html, /src="\/components\/demo\/dashboardCoachDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(read("vercel.json"), /"destination": "\/index\.html"/, "en Production una ruta inexistente cae en la app (login), no en la demo");
});

await test("la demo usa los componentes y la navegacion REALES y no alcanza App.jsx, el cliente de Supabase ni supabase-js", () => {
  const g = graph("components/demo/dashboardCoachDemoMain.jsx");
  for (const real of ["components/coach/CoachDashboardMain.jsx", "components/CoachDashboard.jsx", "components/coach/CoachDashboardD5.jsx",
    "components/coach/coachDashboardModelo.js", "components/students/StudentsSection.jsx", "components/students/StudentCard.jsx",
    "components/coach/coachDashboardNav.js", "components/coach/CoachConfirmDialog.jsx", "lib/coachStudentListSelectors.js"]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningun paquete de supabase: " + g.pkgs.join(", "));
  assert.ok(!graph("main.jsx").files.some((f) => f.startsWith("components/demo/")), "la app no importa la demo");
  // App y la demo comparten la MISMA navegacion
  assert.match(read("App.jsx"), /crearNavegacionDashboard\(\{/);
  assert.match(read("components/demo/DashboardCoachDemo.jsx"), /const nav = crearNavegacionDashboard\(\{/);
  assert.match(read("components/demo/DashboardCoachDemo.jsx"), /supabase=\{null\}/);
});

await test("datos ficticios: inactivo, baja actividad, sin rutina y al dia, con la clasificacion real (cualquier dia de la semana)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("la demo no debe usar la red"); };
  try {
    const d = await import(pathToFileURL(path.join(ROOT, "components/demo/dashboardCoachDemoData.js")).href);
    const { selectCoachStudentListState } = await import(pathToFileURL(path.join(ROOT, "lib/coachStudentListSelectors.js")).href);
    // CoachDashboard.jsx es JSX: la regla de D3 se verifica en el navegador (scripts/qa/demo-dashboard.mjs); aca, categorias reales
    for (let offset = 0; offset < 7; offset++) {
      const hoy = new Date(2026, 9, 26 + offset, 12); // lunes 26/10/2026 .. domingo 1/11
      const cat = selectCoachStudentListState({
        alumnosActivosLimpios: d.DEMO_DASH_ALUMNOS, rutinasUnificadas: d.demoDashRutinas(hoy), sesionesGlobalesLimpias: d.demoDashSesiones(hoy),
        progresoGlobalLimpio: {}, coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: hoy.getTime(),
      }).coachAlumnoCategoria;
      const c = Object.fromEntries(d.DEMO_DASH_ALUMNOS.map((a) => [a.nombre.split(" ")[0], cat(a)]));
      assert.deepEqual(c, { Ana: "inactivo", Beto: "activo", Cami: "sin_rutina", Dora: "activo", Eli: "activo" }, "dia +" + offset);
    }
    const sb = d.createDemoDashSb();
    assert.equal((await sb.getRutinas("demo-cami")).length, 0);
    assert.equal((await sb.getSesiones("demo-ana")).length, 0);
    assert.ok(d.DEMO_DASH_ALUMNOS.every((a) => /@ejemplo\.com$/.test(a.email)), "correos ficticios");
  } finally {
    globalThis.fetch = realFetch;
  }
});

await test("builds reales: Production NO contiene la demo (HTML ni codigo); Preview si", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-dash-"));
  const base = { ...process.env, VITE_SUPABASE_URL: "https://ci-simulado.example.com", VITE_SUPABASE_ANON_KEY: "ci-simulada-anon-key-0123456789", VERCEL: "1" };
  delete base.IRONTRACK_DEMO;
  const build = (envName) => {
    const out = path.join(tmp, envName);
    const r = spawnSync("npx", ["vite", "build", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: { ...base, VERCEL_ENV: envName }, encoding: "utf8" });
    assert.equal(r.status, 0, "build " + envName + ": " + (r.stderr || r.stdout || "").slice(-400));
    return out;
  };
  const marcas = /Entrenador Demo|demo-entrenador-dash|dashboardCoachDemo|Ana Inactiva|Beto Baja/;
  const tieneDemo = (out) => fs.existsSync(path.join(out, DEMO)) ||
    fs.readdirSync(path.join(out, "assets")).some((f) => f.endsWith(".js") && marcas.test(fs.readFileSync(path.join(out, "assets", f), "utf8")));
  const prod = build("production");
  assert.ok(!fs.existsSync(path.join(prod, "demo")), "Production sin carpeta demo/");
  assert.ok(!tieneDemo(prod), "Production sin el HTML ni el codigo de la demo");
  const prev = build("preview");
  assert.ok(fs.existsSync(path.join(prev, DEMO)), "Preview con demo/dashboard-coach.html");
  assert.ok(tieneDemo(prev));
  fs.rmSync(tmp, { recursive: true, force: true });
});

console.log("\n" + count + " pruebas OK");
