// Demostracion de la ficha del alumno (demo/ficha-alumno.html): solo Preview, sin Supabase, sin red y sin la sesion de IronTrack.
//
//   node scripts/test-demoFicha.mjs
//
// La verificacion en navegador (red bloqueada, almacenamiento, flujos y build de Production sin la demo) esta en scripts/qa/demo-ficha.mjs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// Grafo de imports estaticos relativos (y paquetes) desde un archivo.
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

await test("vite.config: la pagina demo solo entra al build en Preview (o local con IRONTRACK_DEMO=1); Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /const includeDemo = vercelEnv === 'preview' \|\| \(!process\.env\.VERCEL && process\.env\.IRONTRACK_DEMO === '1'\)/);
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoFicha: path\.resolve\(__dirname, 'demo\/ficha-alumno\.html'\) \}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.match(cfg, /plugins: \[envTargetGuardPlugin\(\), react\(\), tailwindcss\(\)\]/, "el guard de entorno (PR #104) sigue activo");
  assert.match(read("demo/ficha-alumno.html"), /src="\/components\/demo\/fichaAlumnoDemoMain\.jsx"/);
  assert.match(read("demo/ficha-alumno.html"), /noindex/);
});

await test("la demo usa los componentes reales y no alcanza App.jsx, el cliente de Supabase ni supabase-js", () => {
  const g = graph("components/demo/fichaAlumnoDemoMain.jsx");
  for (const real of ["components/students/StudentsSection.jsx", "components/students/StudentCard.jsx", "components/students/StudentRoutinePreview.jsx",
    "components/students/StudentProgressSummary.jsx", "components/students/ManualSessionValidationModal.jsx", "components/coach/CoachConfirmDialog.jsx",
    "components/routines/EditExerciseModalHost.jsx", "components/modals/AddExerciseModal.jsx", "components/layout/AppGlobalStyles.jsx"]) {
    assert.ok(g.files.includes(real), "usa " + real);
  }
  assert.ok(!g.files.includes("App.jsx"), "no importa App.jsx");
  assert.ok(!g.files.includes("lib/supabaseClient.js"), "no importa lib/supabaseClient.js");
  assert.ok(!g.pkgs.some((p) => /supabase/i.test(p)), "ningun paquete de supabase: " + g.pkgs.join(", "));
  const index = graph("main.jsx");
  assert.ok(!index.files.some((f) => f.startsWith("components/demo/")), "la app (index.html -> main.jsx) no importa la demo");
});

await test("datos ficticios del enunciado y capa de datos solo en memoria (sin red)", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("la demo no debe usar la red"); };
  try {
    const d = await import(path.join(ROOT, "components/demo/fichaAlumnoDemoData.js"));
    assert.equal(d.DEMO_ALUMNO.nombre, "Alumno Demo");
    assert.equal(d.DEMO_ALUMNO.email, "demo@ejemplo.com");
    const r = d.demoRutina();
    assert.equal(r.nombre, "Full Body");
    assert.equal(r.datos.days.length, 3);
    assert.equal(r.datos.semana_activa, 2);
    for (const day of r.datos.days) assert.ok(day.warmup.length > 0 && day.exercises.length > 0);
    const sb = d.createDemoSb();
    const semana2 = await sb.getSesionesByAlumnoRutinaSemana(d.DEMO_ALUMNO.id, r.id, r.nombre, 2);
    assert.deepEqual(semana2.map((s) => s.dia_idx).sort(), [0, 1], "2 de 3 dias: proxima sesion Dia 3");
    assert.equal((await sb.reconcileSemanaActivaAlumno(d.DEMO_ALUMNO.id)).status, "noop");
    const ins = await sb.addSesion({ alumno_id: d.DEMO_ALUMNO.id, rutina_id: r.id, dia_idx: 2, semana: 2, fecha: "1/11/2026" });
    assert.equal(ins.length, 1);
    const adv = await sb.reconcileSemanaActivaAlumno(d.DEMO_ALUMNO.id);
    assert.equal(adv.status, "advanced"); assert.equal(adv.semanaActiva, 3);
    // Una instancia nueva arranca otra vez del estado inicial: nada persiste.
    const sb2 = d.createDemoSb();
    assert.equal((await sb2.getSesionesByAlumnoRutinaSemana(d.DEMO_ALUMNO.id, r.id, r.nombre, 2)).length, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
});

await test("la demo no escribe localStorage/sessionStorage ni usa fetch en su propio codigo", () => {
  for (const f of ["components/demo/FichaAlumnoDemo.jsx", "components/demo/fichaAlumnoDemoData.js", "components/demo/fichaAlumnoDemoMain.jsx"]) {
    const code = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"); // sin comentarios
    assert.doesNotMatch(code, /localStorage|sessionStorage|\bfetch\(|XMLHttpRequest/, f);
  }
});

console.log("\n" + count + " pruebas OK");
