// Regresion RLS P0: ninguna consulta ni escritura debe usar 'entrenador_principal' tras el backfill.
//   node scripts/test-noLegacyCoachId.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
// Solo codigo que se empaqueta o se despliega (los .cjs sueltos de la raiz son parches historicos y no forman parte de la app).
const SCAN = ["App.jsx", "main.jsx", "components", "contexts", "hooks", "lib", "supabase/functions"];
const EXT = /\.(jsx?|mjs|ts)$/;
// Archivos donde el literal puede aparecer: solo para reconocerlo y descartarlo.
const ALLOWED = new Set(["lib/coachIdentity.js", "lib/coachAlumnosLoad.js", "lib/routineStore.js", "components/settings/SettingsPage.jsx"]);
const files = [];
SCAN.forEach((r) => (function walk(p) {
  let st; try { st = statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { for (const name of readdirSync(p)) walk(join(p, name)); }
  else if (EXT.test(p)) files.push(p);
})(join(root, r)));
const read = (rel) => readFileSync(join(root, rel), "utf8");
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("el literal solo aparece en archivos que lo descartan (y nunca como valor de consulta o escritura)", () => {
  const offenders = [];
  for (const f of files) {
    const rel = relative(root, f);
    const src = readFileSync(f, "utf8");
    if (!/entrenador_principal/.test(src)) continue;
    if (!ALLOWED.has(rel)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], "uso de entrenador_principal en: " + offenders.join(", "));
});
t("ningun archivo asigna el literal como entrenador_id ni como fallback (|| / ?? / default)", () => {
  const bad = /(entrenador_id|entrenadorId|ENTRENADOR_ID|entId|coachId)\s*[:=]\s*["']entrenador_principal["']|\|\|\s*["']entrenador_principal["']|\?\?\s*["']entrenador_principal["']/;
  for (const f of files) assert.ok(!bad.test(readFileSync(f, "utf8")), "fallback legacy en " + relative(root, f));
});
t("sb.* de App.jsx exige UUID real para overrides, entrenadores y custom", () => {
  const app = read("App.jsx");
  for (const fn of ["getVideoOverrides", "getNameOverrides", "getEntrenador"]) {
    const m = app.match(new RegExp(fn + ":[^\\n]*"));
    assert.ok(m && /realCoachIdOrNull/.test(m[0]), fn + " debe validar el id");
  }
  assert.ok(/getCustomEx: async \(entId\) => \{\s*const coachId = realCoachIdOrNull\(entId\)/.test(app));
  assert.ok(/setVideoOverride: async \(ejercicioId, url, entId\)/.test(app) && /entrenador_id:coachId\}/.test(app));
  assert.ok(/getRutinasByEntrenador: async \(entId\) => \{\s*const coachId = realCoachIdOrNull\(entId\)/.test(app));
});
t("createRutina completa entrenador_id con el usuario de Auth o aborta", () => {
  const app = read("App.jsx");
  assert.ok(/if \(!body\.entrenador_id\) \{[\s\S]{0,400}getActiveSupabaseSession\(\)[\s\S]{0,300}body\.entrenador_id = coachId/.test(app));
  assert.ok(/sin sesion de entrenador: no se crea la rutina/.test(app));
});
t("alta de alumno exige ENTRENADOR_ID resuelto y lo escribe", () => {
  const st = read("components/students/StudentsSection.jsx");
  assert.ok(/if\(!ENTRENADOR_ID\)\{toast2\([\s\S]{0,200}return;\}[\s\S]{0,80}sb\.createAlumno\(\{[^}]*entrenador_id:ENTRENADOR_ID/.test(st));
});
t("los overrides/config se piden por el scope resuelto (alumno => su entrenador), no por el uid propio", () => {
  const app = read("App.jsx");
  assert.ok(/sb\.getVideoOverrides\(coachScopeId\)/.test(app) && /sb\.getNameOverrides\(coachScopeId\)/.test(app));
  assert.ok(!/getVideoOverrides\(supabaseSessionUserId/.test(app) && !/getNameOverrides\(supabaseSessionUserId/.test(app));
});
t("las rutinas ya no escriben entrenador_id literal desde la UI", () => {
  for (const rel of ["components/RutinaView.jsx", "components/routines/RoutineCard.jsx"]) {
    assert.ok(!/entrenador_id:\s*['"]/.test(read(rel)), rel);
  }
});
t("el edge function ya no concede propiedad por el valor legacy y no vincula por email", () => {
  const core = read("supabase/functions/update-alumno-password/core.js");
  assert.ok(!/entrenador_principal/.test(core));
  assert.ok(!/ilike\('email'/.test(core));
});
console.log(n + " tests ok");
