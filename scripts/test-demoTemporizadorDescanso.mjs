// Demo del temporizador de descanso (demo/temporizador-descanso.html, PR #183): solo Preview, datos ficticios, sin login ni red.
//   node scripts/test-demoTemporizadorDescanso.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const imp = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

await test("vite.config: la demo entra solo con includeDemo; Production solo compila index.html", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /input: includeDemo\s*\? \{ index: [^}]*demoTemporizadorDescanso: path\.resolve\(__dirname, 'demo\/temporizador-descanso\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/temporizador-descanso\.html'\)/g) || []).length, 1);
  const html = read("demo/temporizador-descanso.html");
  assert.match(html, /src="\/components\/demo\/restTimerDemoMain\.jsx"/);
  assert.match(html, /noindex/);
  assert.match(html, /viewport-fit=cover/);
});

await test("la demo reutiliza la logica y las pantallas REALES, sin parser propio ni acceso a datos, red o almacenamiento", () => {
  const comp = read("components/demo/RestTimerDemo.jsx");
  assert.match(comp, /\.\.\/WorkoutExercisePanel\.jsx/);
  assert.match(comp, /\.\.\/workout\/RestTimer\.jsx/);
  const data = read("components/demo/restTimerDemoData.js");
  assert.match(data, /lib\/restPause\.js/);
  assert.match(data, /resolveRestSeconds/);
  assert.match(data, /resolveExerciseForWeek/);
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const f of ["components/demo/RestTimerDemo.jsx", "components/demo/restTimerDemoData.js", "components/demo/restTimerDemoMain.jsx"]) {
    const code = strip(read(f));
    assert.doesNotMatch(code, /supabase|App\.jsx|fetch\(|localStorage|sessionStorage|XMLHttpRequest|indexedDB/i, f);
  }
  // Nada de parser paralelo: la demo no interpreta texto de pausa por su cuenta.
  for (const f of ["components/demo/RestTimerDemo.jsx", "components/demo/restTimerDemoData.js"]) {
    assert.doesNotMatch(strip(read(f)), /parseInt|parseFloat|Number\(\s*\w*pau|split\(\s*['"]:/i, f + " no debe parsear pausas");
  }
});

const D = await imp("components/demo/restTimerDemoData.js");
const RP = await imp("lib/restPause.js");
const W = await imp("lib/workoutSession.js");
const byName = (alumno, frag) => alumno.ejercicios.find((e) => e.name.includes(frag));
const hernan = D.DEMO_ALUMNOS.find((a) => a.id === "hernan-demo");
const catalina = D.DEMO_ALUMNOS.find((a) => a.id === "catalina-demo");

await test("Hernan: pausas numericas 60/90/120 inician; pausa 0 explicita NO inicia", () => {
  const exp = [["Press de banca", 60, true], ["Sentadilla", 90, true], ["Remo con barra", 120, true], ["Curl", 0, false]];
  for (const [frag, seg, inicia] of exp) {
    const it = D.interpretarPausa(byName(hernan, frag), D.DEMO_SEMANA);
    assert.equal(it.segundos, seg, frag);
    assert.equal(it.inicia, inicia, frag);
  }
});

await test("Catalina: '90s', '1:30', '2 min', '1,5 min' inician con los segundos correctos", () => {
  const exp = [["goblet", "90s", 90], ["militar", "1:30", 90], ["Remo en polea", "2 min", 120], ["Hip thrust", "1,5 min", 90]];
  for (const [frag, original, seg] of exp) {
    const it = D.interpretarPausa(byName(catalina, frag), D.DEMO_SEMANA);
    assert.equal(it.original, original, frag);
    assert.equal(it.segundos, seg, frag);
    assert.equal(it.inicia, true, frag);
  }
});

await test("Catalina: semana que pisa la base, '0' explicito sin temporizador y '1,5' invalido -> 90 s", () => {
  const rdl = D.interpretarPausa(byName(catalina, "rumano"), D.DEMO_SEMANA);
  assert.equal(rdl.original, 60); assert.equal(rdl.semana, "2 min"); assert.equal(rdl.segundos, 120); assert.equal(rdl.inicia, true);
  const planch = D.interpretarPausa(byName(catalina, "Plancha"), D.DEMO_SEMANA);
  assert.equal(planch.segundos, 0); assert.equal(planch.inicia, false);
  const inv = D.interpretarPausa(byName(catalina, "inválida"), D.DEMO_SEMANA);
  assert.equal(inv.segundos, 90); assert.equal(inv.inicia, true);
});

await test("la demo decide EXACTAMENTE como el panel: resolveRestSeconds(resolveExerciseForWeek(ex).pause), y coincide con la vista Plan", () => {
  for (const a of D.DEMO_ALUMNOS) for (const e of a.ejercicios) {
    const esperado = RP.resolveRestSeconds(W.resolveExerciseForWeek(e, D.DEMO_SEMANA).pause);
    const it = D.interpretarPausa(e, D.DEMO_SEMANA);
    assert.equal(it.segundos, esperado, e.name);
    assert.equal(it.plan, esperado, "Plan == panel: " + e.name);
  }
});

await test("mostrarValor distingue numero de texto", () => {
  assert.equal(D.mostrarValor(90), "90 (número)");
  assert.equal(D.mostrarValor("90s"), '"90s"');
  assert.equal(D.mostrarValor(""), '"" (vacío)');
});

await test("datos ficticios: sin ids ni nombres reales", () => {
  assert.deepEqual(D.DEMO_ALUMNOS.map((a) => a.id), ["hernan-demo", "catalina-demo"]);
  for (const a of D.DEMO_ALUMNOS) assert.match(a.nombre, /\(demo\)/);
});

console.log(count + " pruebas ok");
