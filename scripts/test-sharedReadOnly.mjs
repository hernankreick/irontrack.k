// Pruebas del modo de enlace compartido (?r=) SOLO LECTURA (P0 Etapa 1A).
//
//   node scripts/test-sharedReadOnly.mjs
//
// Parte 1: comportamiento de lib/sharedMode.js (ninguna escritura sale en modo compartido; las lecturas y el modo normal
//          no cambian).
// Parte 2: cableado en el codigo de la app (App.jsx y WorkoutScreen.jsx): guardias en la interfaz y en la capa de datos.
//          Es una comprobacion estructural del texto fuente (los componentes no se pueden montar sin navegador).
//
// Sale con codigo 0 si todo pasa; con codigo 1 si falla alguna prueba.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SHARED_BLOCKED_WRITES_REJECT,
  SHARED_BLOCKED_WRITES_RESOLVE_NULL,
  SharedReadOnlyError,
  guardSharedWrites,
  guardedWrite,
  isSharedReadOnlyMode,
} from "../lib/sharedMode.js";

let count = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const ALL_WRITES = SHARED_BLOCKED_WRITES_RESOLVE_NULL.concat(SHARED_BLOCKED_WRITES_REJECT);
const READS = ["getProgreso", "getSesiones", "getRutinas", "getFotos", "getUltimaSesion", "getSesionesByAlumnoRutinaSemana"];

function fakeApi() {
  const calls = [];
  const api = {};
  ALL_WRITES.concat(READS).forEach((name) => {
    api[name] = function (...args) { calls.push({ name, args, self: this === api }); return Promise.resolve("ok:" + name); };
  });
  return { api, calls };
}

// ── deteccion ────────────────────────────────────────────────────────────────
test("isSharedReadOnlyMode: solo cuando r existe y no esta vacio (mismo criterio que App.jsx)", () => {
  assert.equal(isSharedReadOnlyMode("?r=eyJhIjoxfQ"), true);
  assert.equal(isSharedReadOnlyMode("?x=1&r=abc"), true);
  assert.equal(isSharedReadOnlyMode("?r="), false);
  assert.equal(isSharedReadOnlyMode("?x=1"), false);
  assert.equal(isSharedReadOnlyMode(""), false);
  assert.equal(isSharedReadOnlyMode("r=abc"), true);
  assert.equal(isSharedReadOnlyMode(null), false);
});

test("isSharedReadOnlyMode: sin argumento lee window.location.search", () => {
  const prev = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    globalThis.window = { location: { search: "?r=zzz" } };
    assert.equal(isSharedReadOnlyMode(), true);
    globalThis.window = { location: { search: "" } };
    assert.equal(isSharedReadOnlyMode(), false);
    delete globalThis.window;
    assert.equal(isSharedReadOnlyMode(), false);
  } finally {
    if (prev) Object.defineProperty(globalThis, "window", prev);
    else delete globalThis.window;
  }
});

// ── guardedWrite ─────────────────────────────────────────────────────────────
test("guardedWrite: en modo compartido NO ejecuta la escritura (rechaza o resuelve null) y avisa", async () => {
  let called = 0;
  const w = guardedWrite("x", () => { called++; return Promise.resolve("hecho"); }, { isReadOnly: () => true });
  await assert.rejects(() => w(), (e) => e instanceof SharedReadOnlyError && e.code === "shared_read_only" && e.operation === "x");
  const wn = guardedWrite("y", () => { called++; return Promise.resolve("hecho"); }, { isReadOnly: () => true, resolveNull: true });
  assert.equal(await wn(), null);
  assert.equal(called, 0);
});

test("guardedWrite: en modo normal pasa argumentos, this y resultado sin cambios", async () => {
  const obj = { v: 7 };
  obj.w = guardedWrite("z", function (a, b) { return Promise.resolve([this.v, a, b]); }, { isReadOnly: () => false });
  assert.deepEqual(await obj.w(1, 2), [7, 1, 2]);
});

// ── guardSharedWrites sobre una capa de datos ────────────────────────────────
test("capa de datos: en modo compartido NINGUNA escritura de entrenamiento se ejecuta", async () => {
  const { api, calls } = fakeApi();
  guardSharedWrites(api, { isReadOnly: () => true });
  for (const name of SHARED_BLOCKED_WRITES_RESOLVE_NULL) assert.equal(await api[name]({ alumno_id: "A" }), null, name);
  for (const name of SHARED_BLOCKED_WRITES_REJECT) await assert.rejects(() => api[name]("A", "r", "n", 1), SharedReadOnlyError, name);
  assert.deepEqual(calls, []);
});

test("capa de datos: las escrituras que deben bloquearse cubren registrar, finalizar y modificar el progreso", () => {
  for (const n of ["addProgreso", "addSesion", "updateRutinaSemanaActiva", "deleteProgresoByAlumno", "deleteSesionesByAlumno", "addFoto"]) {
    assert.ok(ALL_WRITES.includes(n), n);
  }
});

test("capa de datos: las LECTURAS siguen funcionando en modo compartido (no se rompe la visualizacion)", async () => {
  const { api, calls } = fakeApi();
  guardSharedWrites(api, { isReadOnly: () => true });
  for (const name of READS) assert.equal(await api[name]("A"), "ok:" + name);
  assert.equal(calls.length, READS.length);
});

test("capa de datos: sin modo compartido todas las funciones pasan intactas", async () => {
  const { api, calls } = fakeApi();
  guardSharedWrites(api, { isReadOnly: () => false });
  for (const name of ALL_WRITES.concat(READS)) assert.equal(await api[name]("A"), "ok:" + name);
  assert.equal(calls.length, ALL_WRITES.length + READS.length);
  assert.ok(calls.every((c) => c.self)); // this conservado
});

test("capa de datos: ignora funciones que no existen en la API", () => {
  const api = { addProgreso: () => 1 };
  guardSharedWrites(api, { isReadOnly: () => true });
  assert.equal(Object.keys(api).length, 1);
});

test("capa de datos: el modo se evalua en cada llamada (no queda 'fijado' al crear la API)", async () => {
  const { api, calls } = fakeApi();
  let ro = false;
  guardSharedWrites(api, { isReadOnly: () => ro });
  assert.equal(await api.addProgreso({}), "ok:addProgreso");
  ro = true;
  assert.equal(await api.addProgreso({}), null);
  assert.equal(calls.length, 1);
});

// ── cableado en el codigo ────────────────────────────────────────────────────
const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const workout = readFileSync(new URL("../components/WorkoutScreen.jsx", import.meta.url), "utf8");

function bodyAfter(text, signature, length) {
  const i = text.indexOf(signature);
  assert.ok(i >= 0, "no se encontro: " + signature);
  return text.slice(i, i + length);
}

test("cableado: la capa de datos `sb` se protege con guardSharedWrites(sb) justo despues de definirse", () => {
  assert.match(app, /import \{ guardSharedWrites \} from '\.\/lib\/sharedMode\.js'/);
  const sbEnd = app.indexOf("\nconst sb = {");
  assert.ok(sbEnd > 0);
  const callAt = app.indexOf("guardSharedWrites(sb);");
  assert.ok(callAt > sbEnd, "guardSharedWrites(sb) debe ir despues de const sb");
  // y antes de que cualquier componente pueda usarla
  assert.ok(callAt < app.indexOf("function GymApp()"));
});

test("cableado: startStudentWorkout rechaza en modo compartido antes de abrir ningun entrenamiento", () => {
  const body = bodyAfter(app, "const startStudentWorkout = function (nextSession) {", 700);
  const guardAt = body.indexOf("if (readOnly)");
  const setAt = body.indexOf("setSession(nextSession)");
  assert.ok(guardAt >= 0 && setAt > guardAt, "la guardia readOnly debe preceder a setSession");
  assert.match(body.slice(guardAt, setAt), /return false/);
});

test("cableado: logSet rechaza en modo compartido ANTES de tocar el progreso y ya no toma el alumno del enlace", () => {
  const body = bodyAfter(app, "const logSet = (exId, kg, reps, note, rpe, weekOverride) => {", 4000);
  const guardAt = body.indexOf("if (readOnly)");
  const progressAt = body.indexOf("setProgress(");
  assert.ok(guardAt >= 0 && progressAt > guardAt, "la guardia readOnly debe preceder a setProgress");
  const idAt = body.indexOf("const alumnoIdSync");
  assert.ok(idAt > 0);
  const idLine = body.slice(idAt, body.indexOf("\n", idAt));
  assert.equal(/sharedParam|atob\(/.test(idLine), false, "el alumnoId del enlace no debe usarse para escribir");
});

test("cableado: finalizarSesion no escribe en modo compartido y se elimino la escritura de sesiones del enlace", () => {
  const body = bodyAfter(workout, "const finalizarSesion = async () => {", 700);
  assert.match(body, /if \(readOnly\) \{/);
  assert.ok(body.indexOf("if (readOnly)") < body.indexOf("finalizeGuardRef"));
  assert.equal(/readOnly && sharedParam/.test(workout), false);
  assert.equal(/atob\(sharedParam\)/.test(workout), false);
  // la unica llamada a addSesion que queda es la de finalizeStudentSession (alumno autenticado)
  assert.equal(/sb\.addSesion\(/.test(workout), false);
});

test("cableado: las lecturas del enlace compartido (rutinas, sesiones) siguen en App.jsx", () => {
  assert.match(app, /sb\.getRutinas\(decoded\.alumnoId\)/);
  assert.match(app, /sb\.getSesiones\(decoded\.alumnoId\)/);
});

const originalWarn = console.warn;
console.warn = () => {}; // las guardias avisan por consola; se silencia durante las pruebas
for (const t of tests) {
  try {
    await t.fn();
    count++;
    console.log("ok - " + t.name);
  } catch (e) {
    failures.push({ name: t.name, error: e });
    console.log("not ok - " + t.name);
    console.log("  " + (e && e.stack ? e.stack.split("\n").slice(0, 5).join("\n  ") : e));
  }
}

console.warn = originalWarn;
console.log("\n" + count + "/" + tests.length + " pruebas OK");
if (failures.length) {
  console.log(failures.length + " fallaron");
  process.exit(1);
}
