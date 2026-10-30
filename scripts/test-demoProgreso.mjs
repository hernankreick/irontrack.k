// Demostración de Progreso del entrenador (demo/progreso-coach.html): solo Preview, componentes reales, datos ficticios, sin
// Supabase, sin red y sin escrituras.
//
//   node scripts/test-demoProgreso.mjs
//
// Compila Production y Preview simulados (variables ficticias, como el CI) para comprobar que la página y su código SOLO llegan a
// Preview. La verificación en navegador (red bloqueada, almacenamiento, interacciones a 375/390/430 px) está en
// scripts/qa/demo-progreso.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
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

await test("vite.config: demo/progreso-coach.html entra al build solo con includeDemo (Preview o local con IRONTRACK_DEMO=1)", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{[^}]*demoProgreso: path\.resolve\(__dirname, 'demo\/progreso-coach\.html'\) \}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.match(cfg, /plugins: \[envTargetGuardPlugin\(\), react\(\), tailwindcss\(\)\]/, "el guard de entorno sigue activo");
  const html = read("demo/progreso-coach.html");
  assert.match(html, /src="\/components\/demo\/progresoCoachDemoMain\.jsx"/);
  assert.match(html, /noindex, nofollow/);
});

await test("usa el ProgresoView REAL y sus componentes; no alcanza App.jsx, el cliente de Supabase ni supabase-js", () => {
  const g = graph("components/demo/progresoCoachDemoMain.jsx");
  for (const real of ["components/ProgresoView.jsx", "components/coachProgresoMetrics.js", "components/progreso/ProgressHeader.jsx", "components/progreso/ProgressSummaryCards.jsx",
    "components/progreso/ProgressLoadChart.jsx", "components/progreso/ProgressWeeklyVolumeCard.jsx", "components/progreso/ProgressExercisesCard.jsx", "components/progreso/ProgressTeamSection.jsx",
    "components/progreso/ProgressAlumnoPicker.jsx", "components/progreso/ProgressSheet.jsx", "components/coach/EjercicioHistorialCoach.jsx", "lib/metricas/index.js"]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningún paquete de supabase: " + g.pkgs.join(", "));
  assert.ok(!graph("main.jsx").files.some((f) => f.startsWith("components/demo/")), "la app (main.jsx) no importa ninguna demo");
});

await test("su propio código no escribe almacenamiento ni usa la red; aviso DEMO y cambio de tema", () => {
  for (const f of ["components/demo/ProgresoCoachDemo.jsx", "components/demo/progresoCoachDemoData.js", "components/demo/progresoCoachDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    assert.doesNotMatch(code, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon/, f);
  }
  const demo = read("components/demo/ProgresoCoachDemo.jsx");
  assert.match(demo, />DEMO</);
  assert.match(demo, /aria-pressed=\{!darkMode\}/);
  assert.match(demo, /<ProgresoView/);
  assert.doesNotMatch(demo, /entrenadorId|it_session|signIn/i, "sin sesión ni login");
});

await test("datos ficticios: emails .invalid, ids demo-* y todas las situaciones pedidas (por el modelo real)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("la demo no debe usar la red"); };
  try {
    const { buildProgresoDemoData } = await import(path.join(ROOT, "components/demo/progresoCoachDemoData.js"));
    const { buildCoachProgresoModel } = await import(path.join(ROOT, "components/coachProgresoMetrics.js"));
    const d = buildProgresoDemoData();
    assert.ok(d.alumnos.every((a) => /@demo\.invalid$/.test(a.email) && /^demo-/.test(a.id)));
    assert.ok(d.rutinasSBEntrenador.every((r) => /^demo-r-/.test(r.id)));
    const mm = Object.fromEntries(d.alumnos.map((a) => [a.nombre.split(" ")[0], buildCoachProgresoModel({ ...d, periodId: "semanas4", alumnoSel: a.id, diaIdx: 0, lang: "es" })]));
    const { Abril, Carla, Diego, Julián, Martina, Tomás } = mm;
    // activos con PRs, varios ciclos, personalizado, por tiempo, validada, ejercicio fuera de la rutina
    assert.ok(Abril.prsPeriod > 0 && Tomás.prsPeriod > 0);
    const ciclos = new Set(d.progresoGlobal["demo-abril"].filter((r) => r.rutina_id === "demo-r-abril-fuerza").map((r) => r.ciclo));
    assert.deepEqual([...ciclos].sort(), [1, 2]);
    const ej = Object.fromEntries(Abril.ejerciciosRegistrados.map((e) => [e.id, e]));
    assert.ok(ej.custom_demo_remo && ej.custom_demo_remo.enRutina, "personalizado");
    assert.ok(ej["demo-plank"].esTiempo, "por tiempo");
    assert.equal(ej["demo-row"].enRutina, false, "ya no está en la rutina");
    assert.equal(Abril.alumnoChips.find((c) => c.key === "alumnoAdherence").validadas, 1, "una validada por el entrenador");
    // estancado, inactivo, sin rutina, sin PRs
    assert.deepEqual(Abril.stalledIds, ["demo-julian"]);
    assert.equal(Julián.prsPeriod, 0);
    assert.ok(Carla.ultimaSesion.diasAtras >= 21, "inactiva");
    assert.equal(Martina.tieneRutina, false);
    assert.equal(Diego.prsPeriod, 0);
    assert.ok(Diego.ejerciciosRegistrados.every((e) => e.ultimaClase === "primera"), "solo primeras marcas");
    // semanas del bloque: completas, en curso y futura
    assert.equal(Abril.currentRoutineWeekIndex, 2);
    assert.ok(Abril.volBars[2].v > 0 && Abril.volBars[3].v === 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await test("build: la demo existe en Preview y NO en Production (HTML ni código)", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-progreso-"));
  const vite = path.join(ROOT, "node_modules/vite/bin/vite.js");
  const build = (target, out) => {
    const env = { ...process.env, VERCEL: "1", VERCEL_ENV: target, VITE_SUPABASE_URL: target === "preview" ? "https://sin-backend.invalid" : "https://ci-simulado.example.com", VITE_SUPABASE_ANON_KEY: "ci-simulada-anon-key-0123456789" };
    const r = spawnSync(process.execPath, [vite, "build", "--outDir", path.join(tmp, out), "--emptyOutDir", "--logLevel", "error"], { cwd: ROOT, env, encoding: "utf8" });
    assert.equal(r.status, 0, "build " + target + ": " + (r.stdout + r.stderr).slice(-800));
    return path.join(tmp, out);
  };
  const hasDemoCode = (dist) => fs.readdirSync(path.join(dist, "assets")).some((f) => f.endsWith(".js") && /Progreso del entrenador · datos ficticios|demo-r-abril-fuerza|abril@demo\.invalid/.test(fs.readFileSync(path.join(dist, "assets", f), "utf8")));
  const prod = build("production", "prod");
  assert.equal(fs.existsSync(path.join(prod, "demo/progreso-coach.html")), false, "Production sin demo/progreso-coach.html");
  assert.equal(hasDemoCode(prod), false, "Production sin el código ni los datos de la demo");
  const prev = build("preview", "prev");
  assert.equal(fs.existsSync(path.join(prev, "demo/progreso-coach.html")), true, "Preview con demo/progreso-coach.html");
  assert.equal(hasDemoCode(prev), true);
  fs.rmSync(tmp, { recursive: true, force: true });
});

console.log("\n" + count + " pruebas OK");
