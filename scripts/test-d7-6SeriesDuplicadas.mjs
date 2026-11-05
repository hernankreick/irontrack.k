// D76-03 — un toque de REGISTRAR = una serie (lib/setLogGuard.js + opId del intento en logSet).
//   node scripts/test-d7-6SeriesDuplicadas.mjs
// Datos ficticios, sin red: el "servidor" y el almacenamiento son objetos en memoria. Ejecuta la lógica REAL: guarda, write-ahead
// (lib/setWriteAhead.js), POST idempotente (lib/progressInsert.js), flush (lib/pendingSyncQueue.js) y la réplica del logSet de App.jsx
// (components/demo/registroSeriesDemoData.js, crearLogSetDemo).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createSetLogGuard } from "../lib/setLogGuard.js";
import { generateOpId, readAllPending } from "../lib/pendingSyncQueue.js";
import { __resetInFlightForTests } from "../lib/setWriteAhead.js";
import { PQ_ITEM_PREFIX, PQ_DONE_PREFIX } from "../lib/pendingQueueKeyed.js";
import { isUuid } from "../lib/workoutSession.js";
import {
  DEMO_ALUMNO_ID, DEMO_EJERCICIOS, crearStorageDemo, crearServidorDemo, crearLogSetDemo, flushDemo, pendientesDemo,
} from "../components/demo/registroSeriesDemoData.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let n = 0;
let failed = 0;
const t = async (name, fn) => {
  try { __resetInFlightForTests(); await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.error("FAIL -", name); console.error(e); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EX = DEMO_EJERCICIOS[0];
const EX2 = DEMO_EJERCICIOS[1];
const SCOPE = "demo-alumno|demo-rutina|0|1000|0|" + EX.id;

// Entorno nuevo: almacenamiento y servidor falsos, logSet de demo (réplica de App.jsx) y guarda real.
const env = (o) => {
  const opts = o || {};
  const storage = crearStorageDemo({ falla: opts.falla });
  const servidor = crearServidorDemo({ latenciaMs: opts.latenciaMs });
  let online = opts.online !== false;
  const logSet = crearLogSetDemo({ storage, servidor, alumnoId: opts.alumnoId || DEMO_ALUMNO_ID, online: () => online, timeoutMs: opts.timeoutMs || 2000, fecha: "5/11/2026" });
  const guard = createSetLogGuard({ generateId: generateOpId });
  return { storage, servidor, logSet, guard, setOnline: (v) => { online = v; } };
};
// Lo mismo que handleLogSet del panel: un toque pasa por la guarda con el opId del intento.
const tap = (e, scope, ex) => { const x = ex || EX; return e.guard.attempt(scope || SCOPE, (opId) => e.logSet(x.id, x.kg, x.reps, "", null, 0, opId)); };

// ───────── Reproducción del fallo anterior ─────────
await t("REPRO (antes): sin guarda, dos toques = logSet x2 sin opId -> 2 series, 2 opIds, 2 filas en servidor", async () => {
  const e = env();
  assert.equal(e.logSet(EX.id, 60, 8, "", null, 0), true);
  assert.equal(e.logSet(EX.id, 60, 8, "", null, 0), true);
  await e.logSet.esperarEnvios();
  const s = e.logSet.series();
  assert.equal(s.length, 2, "el bug: dos series idénticas");
  assert.notEqual(s[0].opId, s[1].opId, "con opIds distintos el servidor no puede deduplicar");
  assert.equal(e.servidor.filas.size, 2);
});

// ───────── Guarda ─────────
await t("doble toque inmediato -> 1 serie, 1 POST, 1 fila; el segundo devuelve busy sin llamar a logSet", async () => {
  const e = env();
  const r1 = tap(e); const r2 = tap(e);
  assert.equal(r1.status, "logged"); assert.ok(isUuid(r1.opId));
  assert.deepEqual(r2, { status: "busy" });
  await e.logSet.esperarEnvios();
  assert.equal(e.logSet.series().length, 1); assert.equal(e.servidor.posts.length, 1); assert.equal(e.servidor.filas.size, 1);
  assert.ok(e.servidor.filas.has(r1.opId));
});

await t("3, 5 y 10 toques consecutivos -> 1 serie", async () => {
  for (const k of [3, 5, 10]) {
    const e = env();
    const st = Array.from({ length: k }, () => tap(e).status);
    assert.equal(st.filter((s) => s === "logged").length, 1, k + " toques");
    assert.equal(e.logSet.series().length, 1, k + " toques");
    await e.logSet.esperarEnvios();
    assert.equal(e.servidor.filas.size, 1);
  }
});

await t("dos eventos antes del siguiente render: attempt reentrante dentro de register -> busy, 1 serie", async () => {
  const e = env();
  let inner = null;
  let calls = 0;
  const r = e.guard.attempt(SCOPE, (opId) => {
    inner = tap(e);
    assert.equal(e.guard.snapshot().phase, "registering");
    calls++;
    return e.logSet(EX.id, 60, 8, "", null, 0, opId);
  });
  assert.equal(r.status, "logged"); assert.deepEqual(inner, { status: "busy" }); assert.equal(calls, 1);
  assert.equal(e.logSet.series().length, 1);
});

await t("servidor lento: con el POST pendiente los toques extra no registran ni postean -> 1 serie, 1 POST, 1 fila", async () => {
  const e = env({ latenciaMs: 120 });
  const r1 = tap(e);
  await sleep(20);
  assert.equal(e.servidor.posts.length, 1); assert.equal(e.servidor.filas.size, 0, "POST aun pendiente");
  assert.equal(tap(e).status, "busy"); assert.equal(tap(e).status, "busy");
  const fl = await flushDemo({ storage: e.storage, servidor: e.servidor, timeoutMs: 2000 });
  assert.equal(fl.sent, 0, "el flush no reenvia lo que esta en vuelo");
  await e.logSet.esperarEnvios();
  assert.equal(r1.status, "logged");
  assert.equal(e.logSet.series().length, 1); assert.equal(e.servidor.posts.length, 1); assert.equal(e.servidor.filas.size, 1);
  assert.equal(pendientesDemo(e.storage), 0);
});

await t("write-ahead ok con POST pendiente: la guarda pasa a confirming sin esperar el POST; tras finishConfirmation se registra otra serie", async () => {
  const e = env({ latenciaMs: 150 });
  const r1 = tap(e);
  assert.equal(r1.status, "logged");
  assert.equal(e.guard.snapshot().phase, "confirming");
  assert.ok(e.storage.getItem(PQ_ITEM_PREFIX + r1.opId) != null, "pendiente persistido antes del POST");
  assert.equal(e.servidor.filas.size, 0);
  assert.equal(e.guard.finishConfirmation(r1.token), true);
  const r2 = tap(e);
  assert.equal(r2.status, "logged"); assert.notEqual(r2.opId, r1.opId);
  assert.equal(e.servidor.filas.size, 0, "ambos POST siguen pendientes");
  await e.logSet.esperarEnvios();
  assert.equal(e.logSet.series().length, 2); assert.equal(e.servidor.filas.size, 2);
});

await t("fallo de localStorage (setItem lanza) y cuota agotada (QuotaExceededError) -> failed, 0 series, 0 POST, guarda libre", async () => {
  // Cuota agotada (storage de la demo)
  const e = env({ falla: true });
  const r = tap(e);
  assert.equal(r.status, "failed"); assert.ok(isUuid(r.opId));
  assert.equal(e.logSet.ultimoError(), "quota");
  assert.equal(e.logSet.series().length, 0); assert.equal(e.servidor.posts.length, 0);
  assert.equal(e.guard.snapshot().busy, false); assert.equal(e.guard.snapshot().retryOpId, r.opId);
  assert.equal(readAllPending(e.storage).items.length, 0, "no queda un pendiente a medias");
  // localStorage no disponible (setItem lanza un error generico, p. ej. Safari privado)
  const s2 = crearStorageDemo();
  s2.setItem = () => { throw new Error("SecurityError"); };
  const sv2 = crearServidorDemo();
  const ls2 = crearLogSetDemo({ storage: s2, servidor: sv2, fecha: "5/11/2026" });
  const g2 = createSetLogGuard({ generateId: generateOpId });
  const r2 = g2.attempt(SCOPE, (opId) => ls2(EX.id, 60, 8, "", null, 0, opId));
  assert.equal(r2.status, "failed"); assert.equal(ls2.ultimoError(), "storage_unavailable");
  assert.equal(ls2.series().length, 0); assert.equal(sv2.posts.length, 0); assert.equal(g2.snapshot().busy, false);
});

await t("reintento tras error usa el MISMO opId -> 1 serie, 1 fila con ese id", async () => {
  const e = env({ falla: true });
  const r1 = tap(e);
  assert.equal(tap(e).opId, r1.opId, "segundo intento fallido: mismo opId");
  e.storage.setFalla(false);
  const r2 = tap(e);
  assert.equal(r2.status, "logged"); assert.equal(r2.opId, r1.opId);
  assert.equal(e.guard.snapshot().retryOpId, null);
  await e.logSet.esperarEnvios();
  assert.equal(e.logSet.series().length, 1); assert.equal(e.servidor.filas.size, 1); assert.ok(e.servidor.filas.has(r1.opId));
  assert.equal(e.servidor.posts[0].id, r1.opId);
});

await t("dos registros legitimos consecutivos identicos (mismos kg/reps) -> 2 series, opIds distintos", async () => {
  const e = env();
  const r1 = tap(e);
  assert.equal(e.guard.finishConfirmation(r1.token), true);
  assert.equal(e.guard.finishConfirmation(r1.token), false, "un token se usa una sola vez");
  const r2 = tap(e);
  await e.logSet.esperarEnvios();
  const s = e.logSet.series();
  assert.equal(s.length, 2); assert.notEqual(s[0].opId, s[1].opId);
  assert.equal(s[0].kg, s[1].kg); assert.equal(s[0].reps, s[1].reps);
  assert.deepEqual([r1.opId, r2.opId].sort(), [...e.servidor.filas.keys()].sort());
});

await t("cambio de ejercicio durante la confirmacion: la confirmacion sigue, el token es el que la libera (una sola vez) y no libera una posterior", async () => {
  const e = env();
  const scopeB = "demo-alumno|demo-rutina|0|1000|1|" + EX2.id;
  const rA = tap(e, SCOPE, EX);
  const genA = e.guard.snapshot().gen;
  e.guard.reset(scopeB);                                   // efecto del panel al cambiar de ejercicio (auto-avance o manual)
  assert.equal(e.guard.snapshot().phase, "confirming", "reset no corta una confirmacion en curso");
  assert.equal(e.guard.snapshot().gen, genA, "conserva la generacion");
  assert.equal(e.guard.snapshot().scope, scopeB);
  assert.equal(tap(e, scopeB, EX2).status, "busy", "el toque extra no cae en el ejercicio siguiente");
  assert.equal(e.guard.finishConfirmation(rA.token), true, "el token de ESA operacion la libera");
  assert.equal(e.guard.finishConfirmation(rA.token), false, "token repetido");
  const rB = tap(e, scopeB, EX2);
  assert.equal(rB.status, "logged");
  assert.equal(e.guard.finishConfirmation(rA.token), false, "un token ya usado no libera una confirmacion posterior");
  assert.equal(e.guard.snapshot().phase, "confirming");
  assert.equal(e.guard.finishConfirmation(rB.token), true);
  assert.deepEqual(e.logSet.series().map((x) => x.exId), [EX.id, EX2.id]);
  // token de antes de un reset en idle (nueva generacion) tampoco libera
  e.guard.reset(SCOPE);
  const rC = tap(e, SCOPE, EX);
  assert.equal(e.guard.finishConfirmation(rB.token), false);
  assert.equal(e.guard.finishConfirmation(rC.token), true);
});

await t("toque a los 350 ms tras la ULTIMA serie (auto-avance de 300 ms cambia el scope durante confirming) -> busy, 0 series nuevas; tras finishConfirmation el ejercicio siguiente registra normal", async () => {
  const e = env();
  const scopeB = "demo-alumno|demo-rutina|0|1000|1|" + EX2.id;
  // 3 series previas del ejercicio A y la 4ª (ultima)
  for (let i = 0; i < 3; i++) { const r = tap(e, SCOPE, EX); e.guard.finishConfirmation(r.token); }
  const ultima = tap(e, SCOPE, EX);
  assert.equal(ultima.status, "logged");
  await sleep(300); e.guard.reset(scopeB);                 // setTimeout(()=>setActiveExIdx(next), 300) -> efecto [attemptScope]
  await sleep(50);                                         // toque a los ~350 ms, ya en el ejercicio B
  const extra = tap(e, scopeB, EX2);
  assert.deepEqual(extra, { status: "busy" });
  assert.equal(e.logSet.series().filter((x) => x.exId === EX2.id).length, 0, "0 series nuevas en el ejercicio siguiente");
  assert.equal(e.guard.finishConfirmation(ultima.token), true);   // timeout de 800 ms del toque
  const rB = tap(e, scopeB, EX2);
  assert.equal(rB.status, "logged"); assert.notEqual(rB.opId, ultima.opId);
  assert.deepEqual(e.logSet.series().map((x) => x.exId), [EX.id, EX.id, EX.id, EX.id, EX2.id]);
});

await t("cambio manual de ejercicio en idle -> libera y descarta el retryOpId (opId nuevo); un retryOpId de otro scope tampoco se reutiliza via attempt", async () => {
  const scopeB = "demo-alumno|demo-rutina|0|1000|1|" + EX2.id;
  const e = env({ falla: true });
  const rf = tap(e, SCOPE, EX);
  assert.equal(rf.status, "failed"); assert.equal(e.guard.snapshot().retryOpId, rf.opId);
  const genAntes = e.guard.snapshot().gen;
  e.guard.reset(scopeB);
  assert.equal(e.guard.snapshot().retryOpId, null); assert.equal(e.guard.snapshot().busy, false);
  assert.equal(e.guard.snapshot().gen, genAntes + 1);
  e.storage.setFalla(false);
  const rB = tap(e, scopeB, EX2);
  assert.equal(rB.status, "logged"); assert.notEqual(rB.opId, rf.opId, "opId nuevo");
  // sin reset previo: attempt con scope distinto aplica reset(scope)
  const f = env({ falla: true });
  const rf2 = tap(f, SCOPE, EX);
  f.storage.setFalla(false);
  const rg = tap(f, scopeB, EX2);
  assert.equal(rg.status, "logged"); assert.notEqual(rg.opId, rf2.opId, "no reutiliza el opId del otro ejercicio");
  assert.equal(f.guard.snapshot().scope, scopeB);
});

await t("cambio de alumno o de sesion: scope distinto -> no reutiliza el opId de reintento del otro contexto", async () => {
  const g = createSetLogGuard({ generateId: generateOpId });
  const ids = [];
  const rA = g.attempt("alumno-a|r1|0|1000|0|x", (opId) => { ids.push(opId); return false; });
  const rB = g.attempt("alumno-b|r1|0|1000|0|x", (opId) => { ids.push(opId); return false; });
  const rC = g.attempt("alumno-b|r1|0|2000|0|x", (opId) => { ids.push(opId); return false; });   // otra sesion (startTime)
  const rC2 = g.attempt("alumno-b|r1|0|2000|0|x", (opId) => { ids.push(opId); return true; });
  assert.equal(new Set([rA.opId, rB.opId, rC.opId]).size, 3);
  assert.equal(rC2.opId, rC.opId, "mismo contexto: mismo opId");
  assert.equal(rC2.status, "logged");
});

await t("dispose (desmontaje): attempt no registra; finishConfirmation de un token previo no hace nada", async () => {
  const e = env();
  const r = tap(e);
  e.guard.dispose();
  assert.equal(e.guard.finishConfirmation(r.token), false);
  let llamado = false;
  assert.deepEqual(e.guard.attempt(SCOPE, () => { llamado = true; return true; }), { status: "disposed" });
  assert.equal(llamado, false); assert.equal(e.logSet.series().length, 1);
});

await t("sincronizacion de un pendiente (offline / respuesta perdida) con el mismo opId -> 1 fila, sin segunda serie", async () => {
  // offline
  const e = env({ online: false });
  const r = tap(e);
  assert.equal(e.servidor.posts.length, 0); assert.equal(pendientesDemo(e.storage), 1);
  e.setOnline(true);
  assert.equal((await flushDemo({ storage: e.storage, servidor: e.servidor, timeoutMs: 2000 })).sent, 1);
  assert.equal((await flushDemo({ storage: e.storage, servidor: e.servidor, timeoutMs: 2000 })).sent, 0);
  assert.deepEqual([...e.servidor.filas.keys()], [r.opId]); assert.equal(e.logSet.series().length, 1);
  assert.equal(pendientesDemo(e.storage), 0);
  // respuesta perdida
  const p = env();
  p.servidor.perderProximasRespuestas(1);
  const rp = tap(p);
  const [res] = await p.logSet.esperarEnvios();
  assert.equal(res.confirmed, false); assert.equal(pendientesDemo(p.storage), 1);
  assert.equal((await flushDemo({ storage: p.storage, servidor: p.servidor, timeoutMs: 2000 })).sent, 1, "409 verificado = confirmado");
  assert.equal(p.servidor.posts.length, 2); assert.equal(p.servidor.posts[1].id, rp.opId);
  assert.equal(p.servidor.filas.size, 1); assert.equal(p.logSet.series().length, 1);
});

await t("excepcion dentro de register: failed con error, no relanza, la guarda no queda trabada y conserva el opId", async () => {
  const g = createSetLogGuard({ generateId: generateOpId });
  const boom = new Error("boom");
  const r = g.attempt(SCOPE, () => { throw boom; });
  assert.equal(r.status, "failed"); assert.equal(r.error, boom); assert.ok(isUuid(r.opId));
  assert.equal(g.snapshot().busy, false);
  const r2 = g.attempt(SCOPE, () => true);
  assert.equal(r2.status, "logged"); assert.equal(r2.opId, r.opId);
});

await t("contrato de la guarda: generateId obligatorio; snapshot", async () => {
  assert.throws(() => createSetLogGuard({}), /generateId/);
  let k = 0;
  const g = createSetLogGuard({ generateId: () => "id-" + (++k) });
  assert.deepEqual(g.snapshot(), { scope: null, phase: "idle", busy: false, retryOpId: null, lastOpId: null, gen: 0, disposed: false });
  const r = g.attempt("s", () => undefined);              // cualquier valor distinto de false = registrado
  assert.equal(r.status, "logged"); assert.equal(g.snapshot().lastOpId, "id-1"); assert.equal(g.snapshot().busy, true);
});

await t("compatibilidad #154: el pendiente it_pq:<opId> existe antes del POST, el payload lleva id=opId y se retira con confirmacion", async () => {
  const e = env({ latenciaMs: 60 });
  const r = tap(e);
  const pend = JSON.parse(e.storage.getItem(PQ_ITEM_PREFIX + r.opId));
  assert.equal(pend.opId, r.opId); assert.equal(pend.alumno_id, DEMO_ALUMNO_ID); assert.equal(pend.semana, 0); assert.equal(pend.exId, EX.id);
  await e.logSet.esperarEnvios();
  assert.equal(e.servidor.posts[0].id, r.opId);
  assert.equal(e.storage.getItem(PQ_ITEM_PREFIX + r.opId), null);
  assert.ok(e.storage.getItem(PQ_DONE_PREFIX + r.opId) != null);
});

// ───────── Cableado (por texto, complemento de las pruebas de lógica) ─────────
await t("App.jsx: logSet acepta opIdIntento y usa isUuid(opIdIntento) ? opIdIntento : generateOpId()", () => {
  const app = read("App.jsx");
  assert.match(app, /const logSet = \(exId, kg, reps, note, rpe, weekOverride, opIdIntento\) => \{/);
  assert.match(app, /const opId = isUuid\(opIdIntento\) \? opIdIntento : generateOpId\(\);/);
  assert.match(app, /\n  isUuid,\n[\s\S]*?\} from '\.\/lib\/workoutSession\.js';/);
  assert.equal((app.match(/generateOpId\(\)/g) || []).length >= 1, true);
});

await t("WorkoutExercisePanel: registra via attempt( y libera con finishConfirmation( al terminar la confirmacion visual", () => {
  const p = read("components/WorkoutExercisePanel.jsx");
  assert.match(p, /import \{ createSetLogGuard \} from '\.\.\/lib\/setLogGuard\.js';/);
  assert.match(p, /logGuardRef\.current\.attempt\(attemptScope, \(opId\) => logSet\(ex\.id, [^\n]*?, currentWeek, opId\)\);/);
  assert.match(p, /if\(res\.status !== "logged"\) return;/);
  assert.match(p, /if\(res\.status === "failed" && res\.error\) console\.error\("\[PROGRESO\] error al registrar la serie", res\.error\);/);
  assert.match(p, /if \(logGuardRef\.current\.snapshot\(\)\.phase !== "confirming"\) \{\s*setShowCheckAnim\(false\);/);
  assert.match(p, /finishConfirmation\(token\)\) setShowCheckAnim\(false\); \}, 800\)/);
  assert.match(p, /logGuardRef\.current\.reset\(attemptScope\)/);
  assert.match(p, /logGuardRef\.current\.dispose\(\)/);
  assert.match(p, /disabled=\{!canLogSet \|\| showCheckAnim\}/);
  assert.doesNotMatch(p, /const saved = logSet\(/, "ya no hay llamada directa sin guarda");
  const ws = read("components/WorkoutScreen.jsx");
  assert.match(ws, /logScope=\{\[sessionData && sessionData\.alumnoId, session && session\.rId, session && session\.dIdx, session && session\.startTime\]\.join\("\|"\)\}/);
});

// ───────── SSR del panel real ─────────
await t("SSR: WorkoutExercisePanel renderiza con props ficticias y muestra REGISTRAR SET", async () => {
  const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d763-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents:
        'import React from "react";' +
        'import { renderToStaticMarkup } from "react-dom/server";' +
        'import { WorkoutExercisePanel } from "./components/WorkoutExercisePanel.jsx";' +
        "export { React, renderToStaticMarkup, WorkoutExercisePanel };",
      resolveDir: ROOT, sourcefile: "d763-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  const { React, renderToStaticMarkup, WorkoutExercisePanel } = await import(pathToFileURL(outfile).href);
  const noop = () => {};
  const html = renderToStaticMarkup(React.createElement(WorkoutExercisePanel, {
    activeExIdx: 0, setActiveExIdx: noop, exercises: DEMO_EJERCICIOS, ex: EX, info: { id: EX.id, name: EX.name, pattern: EX.pattern },
    pat: { icon: "R", color: "#22C55E" }, setsHoy: [], totalSets: 4, setsRestantes: 4, setActualNum: 1, ultimoSet: undefined, pr: 0,
    es: true, darkMode: true, bgCard: "#111", bgSub: "#0d1520", border: "#243040", textMain: "#fff", textMuted: "#94a3b8",
    sessionPRList: [], videoOverrides: {}, setVideoModal: noop, currentWeek: 0, logSet: () => true, startTimer: noop,
    setPrCelebration: noop, progress: {}, rutinaDatos: { semana_activa: 1, ciclo_actual: 1 }, logScope: "demo-alumno|demo-rutina|0|1000",
  }));
  assert.match(html, /REGISTRAR SET 1/);
  assert.match(html, /Sentadilla \(demo\)/);
});

console.log("\n" + n + " pruebas OK" + (failed ? ", " + failed + " FALLIDAS" : ""));
if (failed) process.exit(1);
