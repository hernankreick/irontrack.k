// E0 — historial COMPLETO del roster del entrenador para Progreso y Estadisticas (lib/coachHistoryLoader.js).
//
//   node scripts/test-coachHistoryLoader.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sin red ni Supabase, datos ficticios.
// Las "paginas" se sirven desde tablas en memoria con el mismo contrato que sbFetch (array o null ante error).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  fetchPagesDetailed, syncCoachHistory, mergeRowsById, sortByCreatedAtDesc, maxCreatedAtIso, deltaSinceIso, needsFullLoad,
  groupByAlumno, FULL_REFRESH_MS, DELTA_OVERLAP_MS, PROGRESO_COLS, PROGRESO_COLS_CICLO,
} from "../lib/coachHistoryLoader.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const T0 = Date.UTC(2026, 0, 1, 12);
const iso = (minutes) => new Date(T0 + minutes * 60000).toISOString();
const ses = (i, extra) => Object.assign({ id: "s" + i, alumno_id: i % 2 ? "A" : "B", semana: 1, dia_idx: i % 3, fecha: "1/1/2026", created_at: iso(i) }, extra || {});
const pro = (i, extra) => Object.assign({ id: "p" + i, alumno_id: i % 2 ? "A" : "B", ejercicio_id: "sq", kg: 50 + (i % 40), reps: 5, fecha: "1/1/2026", semana: 0, ciclo: 1, created_at: iso(i) }, extra || {});

// Tabla falsa: orden created_at desc, id desc; filtro created_at >= since; puede fallar en una pagina dada o sin la columna ciclo.
function fakeTable(rows, o) {
  const opt = o || {};
  const calls = [];
  const page = (cols, since) => async (offset, size) => {
    calls.push({ cols, since, offset, size });
    if (opt.failAt != null && offset === opt.failAt * size) return null;
    if (opt.throwAt != null && offset === opt.throwAt * size) throw new Error("red");
    if (opt.sinCiclo && cols && cols.includes("ciclo")) return null; // 400 de PostgREST: columna inexistente
    const sinceMs = since ? new Date(since).getTime() : -Infinity;
    return sortByCreatedAtDesc(rows.filter((r) => new Date(r.created_at).getTime() >= sinceMs)).slice(offset, offset + size);
  };
  return { rows, calls, page };
}
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
function sync(tS, tP, prev, extra) {
  return syncCoachHistory(Object.assign({
    pageSesiones: (since) => tS.page("*", since),
    pageProgreso: (cols, since) => tP.page(cols, since),
    prev: prev || {},
    rosterKey: "A,B",
    now: T0 + 10_000 * 60000,
    pageSize: 100,
    maxPages: 50,
  }, extra || {}));
}

// ---------------------------------------------------------------- paginacion
await test("fetchPagesDetailed: varias paginas completas => complete; una incompleta corta", async () => {
  const t = fakeTable(range(250, pro));
  const r = await fetchPagesDetailed(t.page("x"), { pageSize: 100, maxPages: 10, idKey: "id" });
  assert.deepEqual([r.rows.length, r.complete, r.pages, r.reason], [250, true, 3, null]);
});
await test("fetchPagesDetailed: alcanzar el tope => complete:false reason 'tope' (antes se truncaba en silencio)", async () => {
  const r = await fetchPagesDetailed(fakeTable(range(500, pro)).page("x"), { pageSize: 100, maxPages: 3 });
  assert.deepEqual([r.rows.length, r.complete, r.reason], [300, false, "tope"]);
});
await test("fetchPagesDetailed: falla la 1a pagina => failedFirst; falla una posterior o lanza => parcial con reason 'error'", async () => {
  const a = await fetchPagesDetailed(fakeTable(range(250, pro), { failAt: 0 }).page("x"), { pageSize: 100 });
  assert.deepEqual([a.rows, a.failedFirst, a.reason], [null, true, "error"]);
  const b = await fetchPagesDetailed(fakeTable(range(250, pro), { failAt: 1 }).page("x"), { pageSize: 100 });
  assert.deepEqual([b.rows.length, b.complete, b.failedFirst, b.reason], [100, false, false, "error"]);
  const c = await fetchPagesDetailed(fakeTable(range(250, pro), { throwAt: 2 }).page("x"), { pageSize: 100 });
  assert.deepEqual([c.rows.length, c.reason], [200, "error"]);
});
await test("fetchPagesDetailed: una fila repetida entre paginas (insercion concurrente corre el offset) se conserva una sola vez", async () => {
  const pages = [range(100, pro), [pro(99)].concat(range(20, (i) => pro(100 + i)))];
  const r = await fetchPagesDetailed(async () => pages.shift(), { pageSize: 100, idKey: "id" });
  assert.equal(r.rows.length, 120);
  assert.equal(new Set(r.rows.map((x) => x.id)).size, 120);
});

// ---------------------------------------------------------------- carga completa
await test("carga completa: 1200 sesiones y 3500 series del roster llegan TODAS (antes: 500 sesiones y 10 paginas)", async () => {
  const tS = fakeTable(range(1200, ses)), tP = fakeTable(range(3500, pro));
  const r = await sync(tS, tP);
  assert.equal(r.ok, true);
  assert.equal(r.mode, "full");
  assert.equal(r.sesiones.length, 1200);
  assert.equal(r.progreso.length, 3500);
  assert.deepEqual(r.state.complete, { sesiones: true, progreso: true });
  assert.equal(r.state.cols, PROGRESO_COLS_CICLO);
  assert.equal(r.sesiones[0].id, "s1199", "orden created_at desc");
  assert.equal(Object.keys(groupByAlumno(r.progreso)).length, 2);
});
await test("carga completa sin la columna ciclo: reintenta sin ella y lo recuerda para los incrementales", async () => {
  const tP = fakeTable(range(150, (i) => pro(i, { ciclo: undefined })), { sinCiclo: true });
  const r = await sync(fakeTable(range(10, ses)), tP);
  assert.equal(r.ok, true);
  assert.equal(r.progreso.length, 150);
  assert.equal(r.state.cols, PROGRESO_COLS);
});
await test("carga completa que llega al TOPE: datos parciales marcados incompletos; el proximo tick es incremental (sin recarga en bucle)", async () => {
  const r = await sync(fakeTable(range(10, ses)), fakeTable(range(800, pro)), {}, { maxPages: 3 });
  assert.equal(r.ok, true);
  assert.deepEqual(r.state.complete, { sesiones: true, progreso: false });
  assert.equal(r.state.reason.progreso, "tope");
  assert.equal(r.state.retryFull, false);
  assert.equal(needsFullLoad(r.state, T0 + 10_000 * 60000 + 30_000), false);
});

// ---------------------------------------------------------------- incremental
await test("incremental: pide solo created_at >= (maximo - solape), fusiona por id sin duplicar y conserva lo anterior", async () => {
  const sesRows = range(300, ses), proRows = range(300, pro);
  const tS = fakeTable(sesRows), tP = fakeTable(proRows);
  const first = await sync(tS, tP);
  // llegan filas nuevas (y una existente reaparece por el solape)
  sesRows.push(ses(400), ses(401));
  proRows.push(pro(400), pro(401), pro(402));
  tS.calls.length = 0; tP.calls.length = 0;
  const r = await sync(tS, tP, { sesiones: first.sesiones, progreso: first.progreso, state: first.state }, { now: first.state.lastFullAt + 30_000 });
  assert.equal(r.mode, "delta");
  assert.equal(r.sesiones.length, 302);
  assert.equal(r.progreso.length, 303);
  assert.equal(new Set(r.progreso.map((x) => x.id)).size, 303, "sin duplicados");
  assert.equal(tS.calls[0].since, new Date(new Date(iso(299)).getTime() - DELTA_OVERLAP_MS).toISOString());
  assert.ok(tP.calls.every((c) => c.since && c.cols === PROGRESO_COLS_CICLO));
  assert.equal(tP.calls.length, 1, "una sola pagina: no vuelve a bajar el historial");
  assert.deepEqual(r.state.complete, first.state.complete);
});
await test("incremental que falla: no aplica nada (se conservan los datos) y no fuerza recarga completa", async () => {
  const tS = fakeTable(range(50, ses)), tP = fakeTable(range(50, pro));
  const first = await sync(tS, tP);
  const r = await sync(tS, fakeTable(range(50, pro), { failAt: 0 }), { sesiones: first.sesiones, progreso: first.progreso, state: first.state }, { now: first.state.lastFullAt + 30_000 });
  assert.deepEqual([r.ok, r.mode, r.state.retryFull], [false, "delta", first.state.retryFull]);
});
await test("carga completa fallida con historial previo: no lo reemplaza por uno parcial y pide reintento", async () => {
  const tS = fakeTable(range(250, ses)), tP = fakeTable(range(250, pro));
  const first = await sync(tS, tP);
  const r = await sync(fakeTable(range(250, ses), { failAt: 1 }), tP, { sesiones: first.sesiones, progreso: first.progreso, state: first.state }, { forceFull: true });
  assert.deepEqual([r.ok, r.mode, r.state.retryFull], [false, "full", true]);
  assert.equal(needsFullLoad(r.state, Date.now()), true);
});
await test("primera carga con una pagina fallida: aplica lo recuperado marcado incompleto y reintenta en el proximo tick", async () => {
  const r = await sync(fakeTable(range(250, ses), { failAt: 2 }), fakeTable(range(20, pro)));
  assert.deepEqual([r.ok, r.sesiones.length, r.state.complete.sesiones, r.state.retryFull], [true, 200, false, true]);
});
await test("cambio de alumnos (rosterKey) o vencimiento de 5 min => carga completa (refleja altas, bajas y borrados)", async () => {
  const tS = fakeTable(range(30, ses)), tP = fakeTable(range(30, pro));
  const first = await sync(tS, tP);
  const prev = { sesiones: first.sesiones, progreso: first.progreso, state: first.state };
  assert.equal((await sync(tS, tP, prev, { rosterKey: "A,B,C", now: first.state.lastFullAt + 1000 })).mode, "full");
  // un borrado hecho desde otro dispositivo aparece en la carga completa programada
  tP.rows.splice(0, 10);
  const r = await sync(tS, tP, prev, { now: first.state.lastFullAt + FULL_REFRESH_MS });
  assert.equal(r.mode, "full");
  assert.equal(r.progreso.length, 20);
});

// ---------------------------------------------------------------- utilidades puras
await test("mergeRowsById / maxCreatedAtIso / deltaSinceIso", () => {
  const m = mergeRowsById([pro(1), pro(2), { alumno_id: "A", created_at: iso(0) }], [pro(2, { kg: 99 }), pro(3)]);
  assert.equal(m.length, 4);
  assert.equal(m.find((x) => x.id === "p2").kg, 99, "la version nueva reemplaza");
  assert.equal(m[0].id, "p3");
  assert.equal(maxCreatedAtIso([pro(5), pro(9), pro(7)]), iso(9));
  assert.equal(maxCreatedAtIso([]), null);
  assert.equal(deltaSinceIso([]), null);
  assert.equal(maxCreatedAtIso([{ created_at: "2026-01-01 12:00:00.123456" }]), "2026-01-01T12:00:00.123Z", "formato con espacio de Supabase");
});

// ---------------------------------------------------------------- cableado (solo entrenador)
await test("cableado: App usa el loader (completo + incremental cada 30 s); Progreso avisa si el historial esta incompleto", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /cargarSesionesGlobalesRef\.current\(null, \{ incremental: true \}\)/);
  assert.match(app, /historiaCompleta: coachHistoriaCompleta/);
  assert.ok(!/limit=500/.test(app.slice(app.indexOf("const cargarSesionesGlobales"), app.indexOf("const cargarSesionesGlobalesRef"))));
  const pv = readFileSync(new URL("../components/ProgresoView.jsx", import.meta.url), "utf8");
  assert.match(pv, /data-qa="historial-incompleto"/);
  const dash = readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8");
  assert.match(dash, /historiaCompleta=\{historiaCompleta\}/);
});
await test("el alumno no cambia: sus lecturas (getSesiones / getProgreso) quedan exactamente como estaban", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes('getSesiones: (alumnoId) => sbFetch("sesiones?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc&limit=10"),'));
  assert.ok(app.includes('getProgreso: (alumnoId) => sbFetch("progreso?alumno_id=eq."+alumnoId+"&select=*&order=created_at.desc"),'));
});

console.log("\n" + count + " pruebas OK");
