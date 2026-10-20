// Aislamiento del swipe de reps (lib/repsSwipe.js + WorkoutExercisePanel.jsx).
//
//   node scripts/test-repsSwipe.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sale con codigo != 0 en el primer fallo.
// Solo funciones puras y lectura del codigo fuente: no toca red, Supabase, localStorage ni archivos.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { createRepsSwipeHandlers } = await import("../lib/repsSwipe.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log("ok -", name);
}

/** Evento tactil minimo con stopPropagation espiable y propagacion simulada hacia un "padre" (la tarjeta que registra el set). */
function makeEvent(x) {
  const ev = {
    stopped: 0,
    touches: [{ clientX: x }],
    changedTouches: [{ clientX: x }],
    stopPropagation() { ev.stopped++; },
  };
  return ev;
}

function setup({ cur = 8, lo = 6, hi = 10, step = 1 } = {}) {
  const calls = { reps: [], buzz: [] };
  const startRef = { current: null };
  const h = createRepsSwipeHandlers({
    startRef,
    getCur: () => cur,
    lo, hi, step,
    setReps: (v) => calls.reps.push(v),
    vibrate: (ms) => calls.buzz.push(ms),
  });
  return { h, calls, startRef };
}

/** Swipe completo: start en x0, end en x1. Devuelve los eventos para inspeccionarlos. */
function swipe(h, x0, x1) {
  const s = makeEvent(x0), m = makeEvent((x0 + x1) / 2), e = makeEvent(x1);
  h.onTouchStart(s); h.onTouchMove(m); h.onTouchEnd(e);
  return [s, m, e];
}

await test("handlers sueltos (sin this) no lanzan TypeError", () => {
  const { h } = setup();
  const { onTouchStart, onTouchMove, onTouchEnd } = h; // desacoplados de cualquier objeto: this === undefined
  assert.doesNotThrow(() => {
    onTouchStart(makeEvent(200)); onTouchMove(makeEvent(180)); onTouchEnd(makeEvent(150));
  });
});

await test("swipe a la izquierda >30px sube 1 rep; a la derecha la baja", () => {
  let t = setup({ cur: 8 });
  swipe(t.h, 200, 150);
  assert.deepEqual(t.calls.reps, ["9"]);
  assert.deepEqual(t.calls.buzz, [15]);
  t = setup({ cur: 8 });
  swipe(t.h, 150, 200);
  assert.deepEqual(t.calls.reps, ["7"]);
});

await test("respeta el paso (ejercicios por tiempo: step 5) y los limites lo/hi", () => {
  let t = setup({ cur: 20, lo: 10, hi: 30, step: 5 });
  swipe(t.h, 200, 100);
  assert.deepEqual(t.calls.reps, ["25"]);
  t = setup({ cur: 10, lo: 6, hi: 10 });
  swipe(t.h, 200, 100); // ya en hi: no cambia
  assert.deepEqual(t.calls.reps, []);
  t = setup({ cur: 6, lo: 6, hi: 10 });
  swipe(t.h, 100, 200); // ya en lo: no cambia
  assert.deepEqual(t.calls.reps, []);
  t = setup({ cur: 9, lo: 6, hi: 10, step: 5 });
  swipe(t.h, 200, 100); // no se pasa de hi
  assert.deepEqual(t.calls.reps, ["10"]);
});

await test("movimiento corto (<=30px) no cambia reps", () => {
  const t = setup();
  swipe(t.h, 200, 175);
  swipe(t.h, 200, 225);
  assert.deepEqual(t.calls.reps, []);
  assert.deepEqual(t.calls.buzz, []);
});

await test("el punto inicial se guarda en la ref y se limpia al terminar", () => {
  const t = setup();
  t.h.onTouchStart(makeEvent(321));
  assert.equal(t.startRef.current, 321);
  t.h.onTouchEnd(makeEvent(321));
  assert.equal(t.startRef.current, null);
});

await test("aislamiento: los 3 eventos cortan la propagacion y el swipe de la tarjeta (registrar set) nunca se entera", () => {
  const t = setup({ cur: 8 });
  // "Tarjeta" padre: su onTouchEnd llamaria a handleLogSet si swipeDelta < -80. Simulamos la burbuja del DOM.
  const card = { start: 0, move: 0, end: 0 };
  const bubble = (ev, key) => { if (!ev.stopped) card[key]++; };
  const s = makeEvent(300), m = makeEvent(200), e = makeEvent(100); // swipe largo (>80px) a la izquierda
  t.h.onTouchStart(s); bubble(s, "start");
  t.h.onTouchMove(m); bubble(m, "move");
  t.h.onTouchEnd(e); bubble(e, "end");
  assert.deepEqual(card, { start: 0, move: 0, end: 0 });
  assert.deepEqual([s.stopped, m.stopped, e.stopped], [1, 1, 1]);
  assert.deepEqual(t.calls.reps, ["9"], "solo cambia reps");
});

await test("aislamiento tambien en gestos sin efecto (limite/umbral)", () => {
  const t = setup({ cur: 10, hi: 10 });
  const evs = swipe(t.h, 300, 100);
  assert.deepEqual(evs.map((e) => e.stopped), [1, 1, 1]);
  assert.deepEqual(t.calls.reps, []);
});

await test("panel: sin this._swX, usa el helper y mantiene el swipe de tarjeta que registra el set", () => {
  const src = readFileSync(path.join(root, "components/WorkoutExercisePanel.jsx"), "utf8");
  assert.ok(!/this\._swX/.test(src), "no debe quedar this._swX");
  assert.ok(src.includes("createRepsSwipeHandlers("), "debe usar el helper");
  assert.ok(src.includes("onTouchStart={repsSwipe.onTouchStart}"));
  assert.ok(src.includes("onTouchMove={repsSwipe.onTouchMove}"));
  assert.ok(src.includes("onTouchEnd={repsSwipe.onTouchEnd}"));
  // El swipe de la tarjeta sigue registrando el set exactamente como antes.
  assert.ok(/swipeDelta < -80 && canLogSet\)\s*\{[\s\S]*?handleLogSet\(\);/.test(src), "swipe de tarjeta intacto");
  // El helper nunca debe invocar logica de registro.
  const helper = readFileSync(path.join(root, "lib/repsSwipe.js"), "utf8");
  assert.ok(!/logSet|handleLogSet|semana|supabase|localStorage/i.test(helper.replace(/\/\/.*$/gm, "")));
});

console.log("\n" + count + " pruebas OK");
