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
  createSharedReadOnlyFetch,
  guardSharedWrites,
  guardedWrite,
  isBlockedSharedRequest,
  isSharedReadOnlyMode,
  isWriteMethod,
} from "../lib/sharedMode.js";

let count = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const ALL_WRITES = SHARED_BLOCKED_WRITES_RESOLVE_NULL.concat(SHARED_BLOCKED_WRITES_REJECT);
const READS = ["getProgreso", "getSesiones", "getRutinas", "getFotos", "getUltimaSesion", "getSesionesByAlumnoRutinaSemana", "getMensajes", "getNota", "getConfig"];

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
  assert.match(app, /import \{ guardSharedWrites, isSharedReadOnlyMode, isWriteMethod \} from '\.\/lib\/sharedMode\.js'/);
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


// ── lista COMPLETA de escrituras de sb ───────────────────────────────────────
function sbTopLevelKeys() {
  const start = app.indexOf("\nconst sb = {");
  const end = app.indexOf("\n};\n", start);
  const block = app.slice(start, end);
  const keys = [];
  for (const m of block.matchAll(/^  ([A-Za-z0-9_]+): /gm)) keys.push(m[1]);
  return keys;
}

test("sb: TODA funcion de escritura (add/create/update/delete/set/save/marcar/reconcile) esta en las listas protegidas", () => {
  const keys = sbTopLevelKeys();
  assert.ok(keys.length > 30, "se esperaban las funciones de sb (" + keys.length + ")");
  const writers = keys.filter((k) => /^(add|create|update|delete|set|save|marcar|reconcile)/.test(k));
  const guarded = new Set(ALL_WRITES);
  const missing = writers.filter((k) => !guarded.has(k));
  assert.deepEqual(missing, [], "escrituras de sb sin proteger: " + missing.join(", "));
});

test("sb: las listas protegidas no nombran funciones que no existen (sin entradas obsoletas)", () => {
  const keys = new Set(sbTopLevelKeys());
  const stale = ALL_WRITES.filter((k) => !keys.has(k));
  assert.deepEqual(stale, []);
});

test("sb: ninguna LECTURA queda en las listas de escritura", () => {
  for (const r of ["getProgreso", "getSesiones", "getRutinas", "getFotos", "getMensajes", "getNota", "getConfig", "getAlumnos"]) {
    assert.equal(ALL_WRITES.includes(r), false, r);
  }
});

// ── transporte ───────────────────────────────────────────────────────────────
test("transporte: isWriteMethod distingue lecturas de escrituras", () => {
  for (const m of ["POST", "PATCH", "PUT", "DELETE", "post", "patch"]) assert.equal(isWriteMethod(m), true, m);
  for (const m of ["GET", "HEAD", "OPTIONS", "get", undefined, null]) assert.equal(isWriteMethod(m), false, String(m));
});

test("transporte: isBlockedSharedRequest bloquea escrituras a datos/funciones/almacenamiento y deja pasar Auth y lecturas", () => {
  const H = "https://abc.supabase.co";
  for (const [m, u] of [
    ["POST", H + "/rest/v1/progreso"], ["PATCH", H + "/rest/v1/alumnos?id=eq.1"], ["DELETE", H + "/rest/v1/fotos?id=eq.2"],
    ["PUT", H + "/rest/v1/x"], ["POST", H + "/rest/v1/rpc/algo"], ["POST", H + "/functions/v1/update-alumno-password"],
    ["POST", H + "/storage/v1/object/b/f"], ["DELETE", H + "/storage/v1/object/b/f"],
  ]) assert.equal(isBlockedSharedRequest(m, u), true, m + " " + u);
  for (const [m, u] of [
    ["GET", H + "/rest/v1/progreso?select=*"], ["HEAD", H + "/rest/v1/progreso"], ["GET", H + "/storage/v1/object/public/b/f"],
    ["POST", H + "/auth/v1/token?grant_type=refresh_token"], ["POST", H + "/auth/v1/logout"], ["GET", H + "/auth/v1/user"],
    ["POST", "https://otro.example.com/api"],
  ]) assert.equal(isBlockedSharedRequest(m, u), false, m + " " + u);
});

test("transporte: createSharedReadOnlyFetch en modo compartido NO toca la red para escrituras y responde 403", async () => {
  const sent = [];
  const base = async (input, init) => { sent.push([String((init && init.method) || "GET"), String(input)]); return new Response("[]", { status: 200 }); };
  const f = createSharedReadOnlyFetch(base, { isReadOnly: () => true });
  const H = "https://abc.supabase.co";
  for (const [m, u] of [["POST", "/rest/v1/progreso"], ["PATCH", "/rest/v1/alumnos"], ["DELETE", "/rest/v1/fotos"], ["POST", "/functions/v1/f"], ["POST", "/storage/v1/o"]]) {
    const r = await f(H + u, { method: m, body: "{}" });
    assert.equal(r.status, 403, m + u);
    assert.equal(r.headers.get("X-IronTrack-Blocked"), "shared-read-only");
    assert.equal((await r.json()).code, "shared_read_only");
  }
  assert.deepEqual(sent, []);
});

test("transporte: en modo compartido las lecturas y Auth siguen pasando (se puede ver la info y refrescar el token)", async () => {
  const sent = [];
  const base = async (input, init) => { sent.push([String((init && init.method) || "GET"), String(input)]); return new Response("[]", { status: 200 }); };
  const f = createSharedReadOnlyFetch(base, { isReadOnly: () => true });
  const H = "https://abc.supabase.co";
  await f(H + "/rest/v1/rutinas?select=*");
  await f(H + "/rest/v1/progreso", { method: "HEAD" });
  await f(H + "/auth/v1/token?grant_type=refresh_token", { method: "POST", body: "{}" });
  assert.equal(sent.length, 3);
});

test("transporte: tambien bloquea cuando la solicitud llega como objeto Request", async () => {
  const sent = [];
  const base = async (input) => { sent.push(String(input.url || input)); return new Response("[]"); };
  const f = createSharedReadOnlyFetch(base, { isReadOnly: () => true });
  const r = await f(new Request("https://abc.supabase.co/rest/v1/mensajes", { method: "POST", body: "{}" }));
  assert.equal(r.status, 403);
  assert.deepEqual(sent, []);
});

test("transporte: fuera del modo compartido todo pasa igual (entrenador y alumnos autenticados no cambian)", async () => {
  const sent = [];
  const base = async (input, init) => { sent.push([String((init && init.method) || "GET"), String(input)]); return new Response("[]", { status: 201 }); };
  const f = createSharedReadOnlyFetch(base, { isReadOnly: () => false });
  const H = "https://abc.supabase.co";
  for (const [m, u] of [["POST", "/rest/v1/progreso"], ["PATCH", "/rest/v1/alumnos"], ["DELETE", "/rest/v1/fotos"], ["POST", "/functions/v1/f"], ["GET", "/rest/v1/x"]]) {
    const r = await f(H + u, { method: m });
    assert.equal(r.status, 201);
  }
  assert.equal(sent.length, 5);
});

test("transporte: el modo compartido no depende de que exista una sesion de Auth (se evalua solo por la URL)", async () => {
  // Con o sin token en la solicitud, la escritura se bloquea: la decision no mira los encabezados.
  const f = createSharedReadOnlyFetch(async () => new Response("[]"), { isReadOnly: () => true });
  for (const headers of [{}, { Authorization: "Bearer token-de-otro-alumno", apikey: "k" }]) {
    const r = await f("https://abc.supabase.co/rest/v1/progreso", { method: "POST", headers, body: "{}" });
    assert.equal(r.status, 403);
  }
});

// ── cableado de la capa de transporte y del cliente ──────────────────────────
const supaClient = readFileSync(new URL("../lib/supabaseClient.js", import.meta.url), "utf8");
const chat = readFileSync(new URL("../components/Chat.jsx", import.meta.url), "utf8");
const chatFlot = readFileSync(new URL("../components/ChatFlotante.jsx", import.meta.url), "utf8");
const photos = readFileSync(new URL("../components/student-progress/ProgressPhotosPanel.jsx", import.meta.url), "utf8");

test("cableado: sbFetch rechaza escrituras en modo compartido ANTES de hacer fetch", () => {
  const body = bodyAfter(app, "const sbFetch = async (path, method=\"GET\", body=null) => {", 1400);
  const guardAt = body.indexOf("isSharedReadOnlyMode() && isWriteMethod(method)");
  const fetchAt = body.indexOf("fetch(");
  assert.ok(guardAt >= 0 && fetchAt > guardAt, "la guardia debe preceder al fetch");
  assert.match(body.slice(guardAt, fetchAt), /return null/);
});

test("cableado: el cliente supabase-js usa el fetch de solo lectura y NO cambia su configuracion de Auth", () => {
  assert.match(supaClient, /import \{ createSharedReadOnlyFetch \} from '\.\/sharedMode\.js'/);
  // Integracion con S0.6: se compone dentro de la barrera contra el token residual de un logout pendiente (lib/residualTokenGuard.js).
  assert.match(supaClient, /global: \{ fetch: createResidualTokenGuardFetch\(createSharedReadOnlyFetch\(\), \{ anonKey: key \}\) \}/);
  assert.match(supaClient, /persistSession: true,\s*autoRefreshToken: true,\s*detectSessionInUrl: true/);
});

test("cableado: el efecto de Auth NO hace upsert en `entrenadores` desde un enlace compartido", () => {
  const i = app.indexOf("function upsertEntrenador(user)");
  assert.ok(i > 0);
  const effectStart = app.lastIndexOf("useEffect(function () {", i);
  const head = app.slice(effectStart, i);
  assert.match(head, /if \(!supabase \|\| readOnly\) return;/);
});

test("cableado: chat de solo lectura (no envia, no marca leidos, sin caja de texto) y App.jsx le pasa readOnly", () => {
  assert.match(app, /<ChatFlotante readOnly=\{readOnly\}/);
  assert.match(chatFlot, /readOnly\}\) \{/);
  assert.match(chatFlot, /if\(!readOnly && sb\.marcarMensajesLeidos\)/);
  assert.match(chatFlot, /<Chat [^>]*readOnly=\{readOnly\}\/>/);
  assert.match(chat, /onMensajesLeidos, readOnly\}\) \{/);
  assert.match(chat, /if \(!readOnly && sb\.marcarMensajesLeidos\)/);
  const enviar = bodyAfter(chat, "const enviar = async () => {", 600);
  assert.ok(enviar.indexOf("if(readOnly) return;") > 0 && enviar.indexOf("if(readOnly) return;") < enviar.indexOf("sb.addMensaje"));
  assert.match(chat, /\{readOnly\?\(/); // reemplaza la caja de texto
});

test("cableado: fotos de progreso de solo lectura (sin input ni botones de subida) desde un enlace compartido", () => {
  assert.match(photos, /const readOnly = !!sharedParam/);
  const subir = bodyAfter(photos, "const subirFoto = async (e) => {", 120);
  assert.match(subir, /if \(readOnly\) return/);
  assert.equal((photos.match(/!esEntrenador && !readOnly/g) || []).length, 3, "input, boton principal y boton Agregar");
  assert.equal(/!esEntrenador && \(/.test(photos), false, "no debe quedar ningun control de subida sin la guardia readOnly");
});

test("cableado: las lecturas del chat y de las fotos siguen presentes (se sigue mostrando la informacion autorizada)", () => {
  assert.match(chat, /sb\.getMensajes\(alumnoId\)/);
  assert.match(photos, /sb\.getFotos\(alumnoId\)/);
});

test("cableado: las escrituras de coach y alumno autenticado no se ven afectadas (Chat del entrenador sin readOnly)", () => {
  const coachModal = readFileSync(new URL("../components/modals/CoachChatModal.jsx", import.meta.url), "utf8");
  assert.equal(/readOnly/.test(coachModal), false);
  assert.match(coachModal, /<Chat [^>]*esEntrenador=\{true\}/);
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
