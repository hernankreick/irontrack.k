// R1 fase 1: integridad del guardado de rutinas (R1-A éxito falso, R1-E edición durante el guardado, X1 duplicados).
//
//   node scripts/test-r1GuardadoRutinas.mjs
//
// Contrato puro (components/routines/rutinaSaveContract.js) con un servidor simulado + pruebas de estructura de RutinaView / RoutineCard /
// UnsavedChangesBar y aislamiento de la demo. El comportamiento en pantalla (doble toque, edición durante guardado...) lo cubre
// scripts/qa/r1-guardado-rutinas.mjs sobre la demo.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  confirmUpdate, confirmCreate, updateConfirmed, createConfirmed, acquireSaveLocks, sameIdSet, canClearUnsaved, SAVE_ALL_KEY, _resetSaveLocksForTests,
} from "../components/routines/rutinaSaveContract.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { _resetSaveLocksForTests(); await fn(); count++; console.log("ok -", name); }

// Servidor simulado con el mismo contrato que sb.updateRutina / sb.createRutina: array de filas, [] si 0 filas, null ante error; nunca lanza salvo "red".
function servidor(modo) {
  const s = { modo, filas: {}, inserts: 0, updates: 0, seq: 0 };
  s.sb = {
    updateRutina: async (id, p) => {
      s.updates++;
      if (s.modo === "red") throw new TypeError("Failed to fetch");
      if (s.modo === "permisos") return null;
      if (s.modo === "cero" || !s.filas[id]) return [];
      s.filas[id] = { ...s.filas[id], ...p };
      return [s.filas[id]];
    },
    createRutina: async (p) => {
      s.inserts++;
      if (s.modo === "red") throw new TypeError("Failed to fetch");
      if (s.modo === "permisos") return null;
      if (s.modo === "cero") return [];
      const id = "srv-" + ++s.seq; s.filas[id] = { id, ...p }; return [s.filas[id]];
    },
  };
  return s;
}

await test("R1-A: solo un array con al menos una fila es éxito confirmado (update)", () => {
  assert.equal(confirmUpdate([{ id: "a" }]).ok, true);
  for (const bad of [null, undefined, [], [null], ["x"], {}, "ok", 0, true]) assert.equal(confirmUpdate(bad).ok, false, "no es éxito: " + JSON.stringify(bad));
  assert.equal(confirmUpdate([]).reason, "zero_rows", "cero filas se distingue del error");
  assert.equal(confirmUpdate(null).reason, "error");
});

await test("R1-A: crear exige la fila creada CON id (distingue creación de actualización)", () => {
  assert.equal(confirmCreate([{ id: "n1" }]).ok, true);
  for (const bad of [null, undefined, [], [{}], [{ id: "" }], [{ id: null }], {}]) assert.equal(confirmCreate(bad).ok, false, JSON.stringify(bad));
  // una fila sin id sirve como confirmación de UPDATE pero no de INSERT
  assert.equal(confirmUpdate([{ nombre: "x" }]).ok, true);
});

await test("R1-A: errores de permisos, red y cero filas NO se confirman y no lanzan", async () => {
  for (const [modo, razon] of [["permisos", "error"], ["red", "exception"], ["cero", "zero_rows"]]) {
    const s = servidor(modo); s.filas.r1 = { id: "r1" };
    const u = await updateConfirmed(s.sb, "r1", { nombre: "x" });
    assert.equal(u.ok, false); assert.equal(u.reason, razon, modo);
    const c = await createConfirmed(s.sb, { nombre: "x" });
    assert.equal(c.ok, false, modo + " create");
  }
});

await test("R1-A: update y create correctos se confirman con la fila del servidor", async () => {
  const s = servidor("ok"); s.filas.r1 = { id: "r1", nombre: "a" };
  const u = await updateConfirmed(s.sb, "r1", { nombre: "b" });
  assert.ok(u.ok); assert.equal(u.row.nombre, "b");
  const c = await createConfirmed(s.sb, { nombre: "n" });
  assert.ok(c.ok); assert.match(c.row.id, /^srv-/);
  const miss = await updateConfirmed(s.sb, "no-existe", { nombre: "x" });
  assert.equal(miss.ok, false, "update de fila inexistente = 0 filas");
});

await test("X1: el candado es síncrono: el segundo y tercer toque (mismo tick) no entran", () => {
  const r1 = acquireSaveLocks(["rr-1"]);
  assert.equal(typeof r1, "function");
  assert.equal(acquireSaveLocks(["rr-1"]), null, "doble toque");
  assert.equal(acquireSaveLocks(["rr-1"]), null, "triple toque");
  r1();
  r1(); // release idempotente
  const r2 = acquireSaveLocks(["rr-1"]);
  assert.equal(typeof r2, "function", "se puede reintentar al terminar");
  r2();
});

await test("X1: «Guardar cambios» y «Guardar» de una tarjeta no pueden solaparse; es todo o nada", () => {
  const card = acquireSaveLocks(["tmp-1"]);
  assert.equal(acquireSaveLocks(["rr-a", "tmp-1", SAVE_ALL_KEY]), null, "la barra no arranca si una tarjeta guarda");
  const libre = acquireSaveLocks(["rr-a"]);
  assert.equal(typeof libre, "function", "una tarjeta distinta no quedó bloqueada por el intento fallido (todo o nada)");
  libre(); card();
  const barra = acquireSaveLocks(["rr-a", "tmp-1", SAVE_ALL_KEY]);
  assert.equal(acquireSaveLocks(["tmp-1"]), null, "la tarjeta no arranca mientras guarda la barra");
  assert.equal(acquireSaveLocks(["rr-a", "tmp-1", SAVE_ALL_KEY]), null, "segunda barra");
  barra();
});

await test("X1: 3 toques simultáneos sobre una rutina nueva = 1 sola creación en el servidor", async () => {
  const s = servidor("ok");
  const guardar = async () => {
    const rel = acquireSaveLocks(["tmp-1"]); if (!rel) return "bloqueado";
    try { return (await createConfirmed(s.sb, { nombre: "Nueva" })).ok ? "ok" : "fallo"; } finally { rel(); }
  };
  const res = await Promise.all([guardar(), guardar(), guardar()]);
  assert.deepEqual(res.sort(), ["bloqueado", "bloqueado", "ok"]);
  assert.equal(s.inserts, 1);
  assert.equal(Object.keys(s.filas).length, 1);
});

await test("X1: reintento tras error libera el candado y no duplica (la 1ª creación falló, la 2ª crea una fila)", async () => {
  const s = servidor("red");
  const guardar = async () => { const rel = acquireSaveLocks(["tmp-1"]); if (!rel) return "bloqueado"; try { return (await createConfirmed(s.sb, { nombre: "N" })).ok; } finally { rel(); } };
  assert.equal(await guardar(), false);
  assert.equal(Object.keys(s.filas).length, 0, "el error no dejó nada");
  s.modo = "ok";
  assert.equal(await guardar(), true);
  assert.equal(Object.keys(s.filas).length, 1);
});

await test("R1-E: el aviso solo se apaga si no hubo ediciones desde que empezó el guardado", () => {
  assert.equal(canClearUnsaved(3, 3), true);
  assert.equal(canClearUnsaved(3, 4), false, "hubo una edición durante el guardado");
  assert.equal(canClearUnsaved(0, 7), false);
});

await test("R1-E: respuesta tardía de una versión anterior no apaga el aviso de la versión nueva (simulación de la revisión)", async () => {
  let revision = 0, hasUnsaved = false;
  const marcar = () => { revision++; hasUnsaved = true; };
  marcar(); // edición 1
  const s = servidor("ok"); s.filas.r1 = { id: "r1" };
  const inicio = revision;
  const guardando = updateConfirmed(s.sb, "r1", { v: 1 });
  marcar(); // edición 2 mientras se guarda
  const r = await guardando; // llega la respuesta de la versión 1
  if (r.ok && canClearUnsaved(inicio, revision)) hasUnsaved = false;
  assert.equal(hasUnsaved, true);
  const inicio2 = revision;
  const r2 = await updateConfirmed(s.sb, "r1", { v: 2 });
  if (r2.ok && canClearUnsaved(inicio2, revision)) hasUnsaved = false;
  assert.equal(hasUnsaved, false, "al guardar la versión más reciente sí se apaga");
  assert.equal(s.filas.r1.v, 2);
});

await test("sameIdSet compara selecciones sin importar el orden", () => {
  assert.equal(sameIdSet(["1", "2"], ["2", "1"]), true);
  assert.equal(sameIdSet(["1"], ["1", "2"]), false);
  assert.equal(sameIdSet([1], ["1"]), true);
});

await test("estructura: RutinaView solo apaga el aviso tras confirmar y con la revisión intacta; usa el candado y la revisión", () => {
  const src = read("components/RutinaView.jsx");
  assert.match(src, /acquireSaveLocks\(/); assert.match(src, /updateConfirmed\(sb,/); assert.match(src, /createConfirmed\(sb,/);
  assert.match(src, /canClearUnsaved\(startRevision, revisionRef\.current\)/);
  assert.doesNotMatch(src, /await sb\.updateRutina/, "ya no se ignora el resultado de updateRutina");
  assert.doesNotMatch(src, /await sb\.createRutina/);
  const idx = [...src.matchAll(/setHasUnsaved\(false\)/g)].map((m) => m.index);
  assert.equal(idx.length, 2, "solo el guardado confirmado y Descartar");
  const fn = src.slice(src.indexOf("const handleSaveAll"), src.indexOf("const requestDiscardUnsaved"));
  assert.equal((fn.match(/setHasUnsaved\(false\)/g) || []).length, 1);
  const before = fn.slice(0, fn.indexOf("setHasUnsaved(false)"));
  assert.match(before, /if \(failed\.length === 0\)/, "dentro de la rama sin fallos");
  assert.match(before, /canClearUnsaved/);
  assert.match(src, /setHasUnsaved=\{markUnsaved\}/, "las ediciones de las tarjetas incrementan la revisión");
  assert.match(src, /revisionRef\.current \+= 1/);
  assert.match(src, /saving=\{savingAll\}/); assert.match(src, /errorMessage=\{saveAllError\}/);
});

await test("estructura: RoutineCard toma el candado antes de cualquier await y lo libera en finally; no ignora resultados", () => {
  const src = read("components/routines/RoutineCard.jsx");
  const fn = src.slice(src.indexOf("const handleSave = async"), src.indexOf("const openEditRoutine"));
  assert.ok(fn.indexOf("acquireSaveLocks([r.id])") > -1 && fn.indexOf("acquireSaveLocks([r.id])") < fn.indexOf("await "), "candado antes del primer await");
  assert.ok(fn.indexOf("acquireSaveLocks([r.id])") < fn.indexOf("setSaving(true)"), "candado antes de cualquier setState");
  assert.match(fn, /finally \{[\s\S]*?release\(\);\s*setSaving\(false\);/);
  assert.doesNotMatch(fn, /await sb\./);
  assert.match(fn, /updateConfirmed\(sb,/); assert.match(fn, /createConfirmed\(sb,/);
  // el éxito se anuncia después de comprobar fallos parciales
  assert.ok(fn.indexOf("failedExtraIds.length") < fn.indexOf("Rutina guardada ✓"));
  assert.ok(fn.indexOf("savedContentSigRef.current = savedSig") > fn.indexOf("await createConfirmed") || fn.indexOf("savedContentSigRef.current = savedSig") > fn.indexOf("await updateConfirmed"));
});

await test("estructura: UnsavedChangesBar muestra «Guardando…», deshabilita y muestra el error persistente con «Reintentar»", () => {
  const src = read("components/routines/UnsavedChangesBar.jsx");
  assert.match(src, /disabled=\{saving\}/); assert.match(src, /Reintentar/); assert.match(src, /role="alert"/); assert.match(src, /Guardando…/);
});

await test("remount por key={r.id}: el estado de reintento viaja por carryCardState y el montaje inicial no lo pisa", () => {
  const src = read("components/routines/RoutineCard.jsx");
  assert.match(src, /carryCardState\(createdRow\.id/); assert.match(src, /peekCardState\(r\.id\)/); assert.match(src, /firstIdEffectRef/);
  assert.doesNotMatch(src, /pendingSelectionRef/);
  assert.match(read("components/RutinaView.jsx"), /onRoutinePersisted=\{syncBaseline\}/);
});

await test("alcance: la fase 1 no toca App.jsx, lib/, SQL, Supabase, dependencias ni persistencia de borradores", () => {
  for (const f of ["components/RutinaView.jsx", "components/routines/RoutineCard.jsx", "components/routines/rutinaSaveContract.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /beforeunload|pagehide|\bdirty:\s*true/, f + ": sin fase 2/3");
  }
  const contrato = read("components/routines/rutinaSaveContract.js");
  assert.doesNotMatch(contrato, /^import /m, "contrato puro, sin imports");
});

await test("demo: solo Preview, sin Supabase, sin App.jsx y la app no la importa", () => {
  const cfg = read("vite.config.js");
  assert.match(cfg, /input: includeDemo\s*\? \{[^}]*demoGuardado: path\.resolve\(__dirname, 'demo\/guardado-rutinas\.html'\)[^}]*\}\s*: \{ index: path\.resolve\(__dirname, 'index\.html'\) \}/);
  assert.equal((cfg.match(/guardado-rutinas\.html'/g) || []).length, 1);
  const re = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
  const seen = new Set([path.join(ROOT, "components/demo/guardadoRutinasDemoMain.jsx")]); const q = [...seen]; const pkgs = new Set();
  while (q.length) {
    const f = q.shift();
    for (const m of fs.readFileSync(f, "utf8").matchAll(re)) {
      const spec = m[1] || m[2];
      if (!spec.startsWith(".")) { pkgs.add(spec); continue; }
      const base = path.resolve(path.dirname(f), spec);
      const hit = [base, base + ".js", base + ".jsx"].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
      if (hit && !seen.has(hit)) { seen.add(hit); q.push(hit); }
    }
  }
  const files = [...seen].map((f) => path.relative(ROOT, f).split(path.sep).join("/"));
  assert.ok(files.includes("components/RutinaView.jsx") && files.includes("lib/rutinaOperationalState.js"), "usa la pantalla y el contrato reales");
  assert.ok(!files.includes("App.jsx") && !files.includes("lib/supabaseClient.js"));
  assert.ok(![...pkgs].some((p) => /supabase/i.test(p)), [...pkgs].join(","));
  const main = read("main.jsx");
  assert.doesNotMatch(main, /demo/i);
  assert.match(read("demo/guardado-rutinas.html"), /noindex/);
});

console.log("\n" + count + " pruebas OK");
