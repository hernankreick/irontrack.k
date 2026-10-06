// Reconciliacion de semana_activa desde la ficha del ENTRENADOR (VER) + flujo del alumno, con el MISMO helper.
//   node scripts/test-reconcileEntrenadorVer.mjs
// Modulos reales (lib/studentFicha.js, lib/reconcileCurrentRoutine.js, lib/reconcileSemanaActiva.js, lib/rutinaOperationalState.js)
// contra un cliente supabase falso en memoria. Sin red; Evi es solo un fixture.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reconcileCurrentRoutineForAlumno } from "../lib/reconcileCurrentRoutine.js";
import { loadAlumnoFicha } from "../lib/studentFicha.js";
import { applySemanaActivaToRutinas } from "../lib/rutinaOperationalState.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const EVI = "76fb8876-270a-4fa6-9b7a-f664e0b42799";
const OTRO = "11111111-1111-1111-1111-111111111111";
const EVI3 = "1653a3d7-1dd3-438f-93d7-4f31a5b81548";
const EVI2 = "96b64d4e-6202-4da3-b6c6-636d0b5e27ed";
const days = (n) => Array.from({ length: n }, (_, i) => ({ dia: "Día " + (i + 1), exercises: [{ id: "sq" }] }));

function makeClient(rows) {
  const db = JSON.parse(JSON.stringify(rows));
  const calls = { selects: [], updates: [] };
  const client = { from(table) {
    assert.equal(table, "rutinas");
    return {
      select() { return { eq: async (c, id) => { calls.selects.push(id); return { data: db[id] ? [JSON.parse(JSON.stringify(db[id]))] : [], error: null }; } }; },
      update(patch) { return { eq(c, id) { return { select: async () => {
        calls.updates.push({ id, patch: JSON.parse(JSON.stringify(patch)) });
        Object.assign(db[id], JSON.parse(JSON.stringify(patch)));
        return { data: [JSON.parse(JSON.stringify(db[id]))], error: null };
      } }; } }; },
    };
  } };
  return { client, db, calls };
}
const row = (id, alumno, nombre, createdAt, datos) => ({ id, alumno_id: alumno, nombre, created_at: createdAt, es_plantilla: false, entrenador_id: "ent", datos });
const ses = (rutina, alumno, dia, semana) => ({ id: "s" + Math.random(), alumno_id: alumno, rutina_id: rutina, semana, dia_idx: dia, fecha: "1/9/2026", created_at: "2026-09-01T00:00:00Z" });
const pager = (rows, log) => async ({ rutinaId, alumnoId, from, to }) => {
  if (log) log.push(String(rutinaId));
  return rows.filter((s) => String(s.rutina_id) === String(rutinaId) && (!alumnoId || String(s.alumno_id) === String(alumnoId))).slice(from, to + 1);
};
const mkLogger = () => { const w = []; return { warn: (...a) => w.push(a), w }; };

// Fixture Evi: Evi 3 (vigente, semana_activa null, 4 dias) + Evi 2 historica
const eviRutinas = () => [
  row(EVI3, EVI, "Evi 3", "2026-09-01T00:00:00Z", { days: days(4), semana_activa: null, note: "n" }),
  row(EVI2, EVI, "Evi 2", "2026-07-01T00:00:00Z", { days: days(4), semana_activa: 2 }),
];
const EVI_SES = [ses(EVI3, EVI, 0, 1), ses(EVI3, EVI, 1, 1), ses(EVI3, EVI, 2, 1), ses(EVI3, EVI, 3, 1), ses(EVI3, EVI, 0, 1),
  ses(EVI2, EVI, 0, 1), ses(EVI2, EVI, 1, 1), ses(EVI2, EVI, 2, 1), ses(EVI2, EVI, 3, 1)];

// Simula la capa sb + setters de React (el estado real de StudentsSection)
function makeEnv(rutinas, sesiones, opts) {
  const o = opts || {};
  const { client, db, calls } = makeClient(Object.fromEntries(rutinas.map((r) => [r.id, r])));
  const fetchLog = [];
  const logger = mkLogger();
  const fetcher = o.fetcher || pager(sesiones, fetchLog);
  const reconcileCalls = [];
  const state = { rutinasSB: [], rutinasSBEntrenador: o.prevEntrenador || [], prog: null, ses: null };
  const sb = {
    getRutinas: async (id) => rutinas.filter((r) => String(r.alumno_id) === String(id)).map((r) => JSON.parse(JSON.stringify(db[r.id] || r))),
    getProgreso: async () => [], getSesiones: async () => [],
    reconcileSemanaActivaAlumno: async (alumnoId, ruts, source) => {
      reconcileCalls.push({ alumnoId, source });
      return reconcileCurrentRoutineForAlumno({ client, alumnoId, rutinas: ruts, fetchSesionesPage: fetcher, logger, source });
    },
  };
  const upd = (key) => (v) => { state[key] = typeof v === "function" ? v(state[key]) : v; };
  const ver = (alumno) => loadAlumnoFicha({ alumno, sb, setRutinasSB: upd("rutinasSB"), setRutinasSBEntrenador: upd("rutinasSBEntrenador"),
    setAlumnoProgreso: upd("prog"), setAlumnoSesiones: upd("ses"), mergeRutinasAsignadas: o.merge || ((fresh, rest) => fresh.concat(rest)) });
  return { client, db, calls, sb, state, ver, logger, fetchLog, reconcileCalls, fetcher };
}
const semOf = (list, id) => list.find((r) => r.id === id).datos.semana_activa;

await test("1. entrenador VER dispara la reconciliacion (solo del alumno abierto)", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  await e.ver({ id: EVI });
  assert.deepEqual(e.reconcileCalls, [{ alumnoId: EVI, source: "entrenador_ver" }]);
});
await test("2. Evi null + D1-D4 (y D1 repetida) => una sola escritura a semana 2, local = 2 en rutinasSB y rutinasSBEntrenador", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  const r = await e.ver({ id: EVI });
  assert.equal(r.reconcile.status, "advanced");
  assert.equal(r.reconcile.semanaActiva, 2);
  assert.equal(e.calls.updates.length, 1);
  assert.equal(e.calls.updates[0].id, EVI3);
  assert.equal(e.db[EVI3].datos.semana_activa, 2);
  assert.equal(semOf(e.state.rutinasSB, EVI3), 2);
  assert.equal(semOf(e.state.rutinasSBEntrenador, EVI3), 2);
  assert.equal(e.db[EVI3].datos.note, "n");
});
await test("3. D1 repetida no altera el conteo: solo D1-D3 + D1 repetida => no avanza (4 dias)", async () => {
  const ss = [ses(EVI3, EVI, 0, 1), ses(EVI3, EVI, 1, 1), ses(EVI3, EVI, 2, 1), ses(EVI3, EVI, 0, 1), ses(EVI3, EVI, 0, 1)];
  const e = makeEnv(eviRutinas(), ss);
  const r = await e.ver({ id: EVI });
  assert.equal(r.reconcile.status, "noop");
  assert.equal(e.calls.updates.length, 0);
  assert.equal(semOf(e.state.rutinasSB, EVI3), null);
});
await test("4. segunda apertura => 0 escrituras nuevas y sigue en 2", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  await e.ver({ id: EVI });
  const r2 = await e.ver({ id: EVI });
  assert.equal(e.calls.updates.length, 1);
  assert.equal(r2.reconcile.status, "noop");
  assert.equal(semOf(e.state.rutinasSB, EVI3), 2);
  assert.equal(semOf(e.state.rutinasSBEntrenador, EVI3), 2);
});
await test("5. solo se reconcilia la rutina vigente (sesiones leidas solo de EVI3)", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  await e.ver({ id: EVI });
  assert.ok(e.fetchLog.length > 0);
  assert.ok(e.fetchLog.every((id) => id === EVI3));
});
await test("6. rutinas historicas no se modifican (ni DB ni memoria)", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  await e.ver({ id: EVI });
  assert.equal(e.db[EVI2].datos.semana_activa, 2);
  assert.ok(e.calls.updates.every((u) => u.id !== EVI2));
  assert.equal(semOf(e.state.rutinasSB, EVI2), 2);
});
await test("7. solo el alumno abierto: otro alumno en estado del entrenador no se toca", async () => {
  const otra = row("r-otro", OTRO, "Otro", "2026-09-02T00:00:00Z", { days: days(3), semana_activa: null });
  const e = makeEnv(eviRutinas().concat([otra]), EVI_SES.concat([ses("r-otro", OTRO, 0, 1), ses("r-otro", OTRO, 1, 1), ses("r-otro", OTRO, 2, 1)]),
    { prevEntrenador: [otra] });
  await e.ver({ id: EVI });
  assert.equal(semOf(e.state.rutinasSBEntrenador, "r-otro"), null);
  assert.ok(e.calls.updates.every((u) => u.id === EVI3));
  assert.ok(e.reconcileCalls.every((c) => c.alumnoId === EVI));
});
await test("8. abrir la lista (sin tocar VER) no dispara reconciliaciones; wiring estatico lo confirma", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  assert.equal(e.reconcileCalls.length, 0);
  const here = path.dirname(fileURLToPath(import.meta.url));
  const sec = readFileSync(path.join(here, "../components/students/StudentsSection.jsx"), "utf8");
  const calls = sec.match(/reconcileSemanaActivaAlumno|loadAlumnoFicha\(/g) || [];
  assert.equal(calls.length, 1, "la reconciliacion solo cuelga de onVer (loadAlumnoFicha)");
  assert.ok(/onVer=\{async function[\s\S]*?loadAlumnoFicha\(/.test(sec));
});

const base = () => [row("a", EVI, "A", "2026-01-01", { days: days(4), semana_activa: 3, k: { x: 1 } }), row("b", EVI, "B", "2026-02-01", { days: days(4), semana_activa: 1 })];
await test("9. applySemanaActivaToRutinas actualiza solo la rutina objetivo y preserva el resto", () => {
  const out = applySemanaActivaToRutinas(base(), "b", 2);
  assert.equal(out[1].datos.semana_activa, 2);
  assert.equal(out[0].datos.semana_activa, 3);
  assert.deepEqual(out[0], base()[0]);
  assert.equal(out[1].nombre, "B");
  assert.equal(out[1].datos.days.length, 4);
});
await test("10. applySemanaActivaToRutinas no muta la entrada", () => {
  const input = base(); const snap = JSON.stringify(input);
  const out = applySemanaActivaToRutinas(input, "b", 3);
  assert.equal(JSON.stringify(input), snap);
  assert.notEqual(out, input); assert.notEqual(out[1], input[1]); assert.notEqual(out[1].datos, input[1].datos);
  assert.equal(out[0], input[0]);
});
await test("11. applySemanaActivaToRutinas nunca baja semana_activa ni acepta valores invalidos", () => {
  const input = base();
  assert.equal(applySemanaActivaToRutinas(input, "a", 2), input);
  assert.equal(applySemanaActivaToRutinas(input, "a", 3), input);
  [0, 5, null, "x", 2.5].forEach((v) => assert.equal(applySemanaActivaToRutinas(input, "b", v), input));
  assert.equal(applySemanaActivaToRutinas(input, "zzz", 2), input);
});

for (const [label, fetcher, expected] of [
  ["incomplete", async ({ from }) => { if (from === 0) throw new Error("boom"); return []; }, "incomplete"],
]) {
  await test("12a. " + label + " => sin cambio local, sin escritura, console.warn con alumnoId/rutinaId/status/reason", async () => {
    const e = makeEnv(eviRutinas(), EVI_SES, { fetcher });
    const r = await e.ver({ id: EVI });
    assert.equal(r.reconcile.status, expected);
    assert.equal(e.calls.updates.length, 0);
    assert.equal(semOf(e.state.rutinasSB, EVI3), null);
    assert.equal(semOf(e.state.rutinasSBEntrenador, EVI3), null);
    assert.equal(e.logger.w.length, 1);
    const payload = e.logger.w[0][1];
    assert.equal(payload.alumnoId, EVI); assert.equal(payload.rutinaId, EVI3); assert.equal(payload.status, expected); assert.ok(payload.reason);
    assert.ok(!JSON.stringify(payload).includes("ejercicios"));
  });
}
await test("12b. failed (lectura de rutina falla) => sin cambio local + warn", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  e.client.from = () => ({ select: () => ({ eq: async () => ({ data: null, error: { message: "x" } }) }) });
  const logger = mkLogger();
  const r = await reconcileCurrentRoutineForAlumno({ client: e.client, alumnoId: EVI, rutinas: eviRutinas(), fetchSesionesPage: e.fetcher, logger });
  assert.equal(r.status, "failed");
  assert.equal(logger.w.length, 1); assert.equal(logger.w[0][1].status, "failed"); assert.equal(logger.w[0][1].rutinaId, EVI3);
});
await test("12c. invalid (alumno vacio / rutinas no cargadas) => warn y sin escritura", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  for (const args of [{ alumnoId: "", rutinas: eviRutinas() }, { alumnoId: EVI, rutinas: null }]) {
    const logger = mkLogger();
    const r = await reconcileCurrentRoutineForAlumno({ client: e.client, fetchSesionesPage: e.fetcher, logger, ...args });
    assert.equal(r.status, "invalid");
    assert.equal(logger.w.length, 1); assert.equal(logger.w[0][1].status, "invalid"); assert.ok(logger.w[0][1].reason);
  }
  assert.equal(e.calls.updates.length, 0);
});
await test("13. noop no es error: sin console.warn y sin escritura innecesaria", async () => {
  const rut = [row(EVI3, EVI, "Evi 3", "2026-09-01", { days: days(4), semana_activa: 2 })];
  const e = makeEnv(rut, [ses(EVI3, EVI, 0, 1)]);
  const r = await e.ver({ id: EVI });
  assert.equal(r.reconcile.status, "noop");
  assert.equal(e.logger.w.length, 0);
  assert.equal(e.calls.updates.length, 0);
  const sinRutina = await reconcileCurrentRoutineForAlumno({ client: e.client, alumnoId: EVI, rutinas: [], fetchSesionesPage: e.fetcher, logger: e.logger });
  assert.equal(sinRutina.status, "noop"); assert.equal(e.logger.w.length, 0);
});
await test("14. el flujo del alumno sigue reconciliando y usa el MISMO helper (source alumno)", async () => {
  const e = makeEnv(eviRutinas(), EVI_SES);
  const r = await e.sb.reconcileSemanaActivaAlumno(EVI, await e.sb.getRutinas(EVI), "alumno");
  assert.equal(r.status, "advanced"); assert.equal(r.semanaActiva, 2);
  assert.deepEqual(e.reconcileCalls, [{ alumnoId: EVI, source: "alumno" }]);
  assert.equal(e.db[EVI3].datos.semana_activa, 2);
});
await test("15. semana 4 nunca avanza a 5 (ni en memoria ni en DB)", async () => {
  const rut = [row(EVI3, EVI, "Evi 3", "2026-09-01", { days: days(2), semana_activa: 4 })];
  const ss = [0, 1].flatMap((d) => [1, 2, 3, 4].map((w) => ses(EVI3, EVI, d, w)));
  const e = makeEnv(rut, ss);
  const r = await e.ver({ id: EVI });
  assert.equal(r.reconcile.status, "noop");
  assert.equal(e.calls.updates.length, 0);
  assert.equal(semOf(e.state.rutinasSB, EVI3), 4);
  assert.equal(applySemanaActivaToRutinas(rut, EVI3, 5), rut);
});
await test("16. wiring estatico: A (alumno) y B (entrenador VER) llegan al MISMO helper; readOnly queda excluido", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const rd = (p) => readFileSync(path.join(here, "..", p), "utf8");
  const app = rd("App.jsx"), ficha = rd("lib/studentFicha.js"), sec = rd("components/students/StudentsSection.jsx"), helper = rd("lib/reconcileCurrentRoutine.js");
  assert.ok(/reconcileSemanaActivaAlumno:[\s\S]*?reconcileCurrentRoutineForAlumno\(/.test(app));
  assert.ok(app.includes('sb.reconcileSemanaActivaAlumno(sessionData.alumnoId, rutsRaw, "alumno")'));
  assert.ok(ficha.includes('sb.reconcileSemanaActivaAlumno(alumno.id, ruts, "entrenador_ver")'));
  assert.ok(/loadAlumnoFicha\(/.test(sec));
  assert.equal((app.match(/reconcileSemanaActiva\(\{/g) || []).length, 0, "App ya no llama al reconciliador directo");
  assert.ok(helper.includes("selectCurrentRoutine(") && helper.includes("reconcileSemanaActiva("));
  const code = helper.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/localStorage|progreso|rutina_nombre|created_at/.test(code));
  // el enlace compartido (readOnly) no reconcilia: el unico llamador en App esta dentro del guard de alumno logueado
  const idx = app.indexOf('sb.reconcileSemanaActivaAlumno(sessionData.alumnoId');
  assert.equal((app.match(/sb\.reconcileSemanaActivaAlumno\(/g) || []).length, 1); // un unico llamador en App (efecto del alumno logueado)
  assert.ok(app.lastIndexOf("if(!readOnly && sessionData?.role===\"alumno\" && sessionData?.alumnoId)", idx) > 0);
});

console.log("\n" + count + " tests OK");
