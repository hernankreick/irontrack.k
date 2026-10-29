// Ciclo de rutina: node scripts/test-rutinaCiclo.mjs
import assert from "node:assert/strict";
import { readCicloActual, rowCiclo, cicloPayloadFields, buildReinicioDatos, setsForLoadPrefill, CICLO_CARGAS } from "../lib/rutinaCiclo.js";
import { getStudentWeeklyProgress } from "../lib/studentWeeklyProgress.js";
import { deriveSemanaActivaTarget } from "../lib/reconcileSemanaActiva.js";
import { getStudentWorkoutState, getWeekCompletionGate } from "../components/student-plan/studentWorkoutState.js";
import { buildProgressPayload, buildSessionPayload, sessionAlreadyExists } from "../lib/workoutSession.js";
import { countPersistedDistinctDays } from "../lib/finalizeWorkoutSession.js";
import { reiniciarRutinaCiclo } from "../lib/reiniciarRutinaCiclo.js";
import { mergeOperationalDatos } from "../lib/rutinaOperationalState.js";
import { applyReinicioRow } from "../lib/rutinaRpc.js";

let n = 0;
async function test(name, fn) { await fn(); n++; console.log("ok -", name); }

const days = [{ id: "a" }, { id: "b" }, { id: "c" }];
const ses = [];
for (let w = 1; w <= 4; w++) for (let d = 0; d < 3; d++) ses.push({ alumno_id: "A1", rutina_id: "R1", semana: w, dia_idx: d, fecha: "1/" + w + "/2026", created_at: "2026-01-0" + w + "T10:00:00Z" });
const rutC1 = { id: "R1", nombre: "X", datos: { days, semana_activa: 4 } };

await test("lectura de ciclo: ausente/invalido => 1", () => {
  assert.equal(readCicloActual(undefined), 1);
  assert.equal(readCicloActual({ ciclo_actual: "x" }), 1);
  assert.equal(readCicloActual({ ciclo_actual: 3 }), 3);
  assert.equal(rowCiclo({}), 1);
  assert.deepEqual(cicloPayloadFields(1), {});
  assert.deepEqual(cicloPayloadFields(2), { ciclo: 2 });
});

await test("buildReinicioDatos: semana 1, ciclo+1, conserva days, no muta", () => {
  const src = { days, semana_activa: 4, semana_reiniciada: 2, semana_reiniciada_at: "x" };
  const out = buildReinicioDatos(src, { cargas: CICLO_CARGAS.CERO, nowIso: "2026-05-01T00:00:00Z" });
  assert.equal(out.semana_activa, 1);
  assert.equal(out.ciclo_actual, 2);
  assert.equal(out.ciclo_cargas, "cero");
  assert.equal(out.days, days);
  assert.ok(!("semana_reiniciada" in out));
  assert.equal(src.semana_activa, 4);
  assert.equal(buildReinicioDatos(out, {}).ciclo_actual, 3);
  assert.equal(buildReinicioDatos(src, {}).ciclo_cargas, "mantener");
});

await test("posicion del alumno: ciclo 1 sin cambios (4/4 en semana 4 con sesiones viejas)", () => {
  const w = getStudentWeeklyProgress({ alumno: "A1", rutina: rutC1, sesiones: ses, completedDays: [], currentWeek: 3 });
  assert.equal(w.weekNumber, 4);
  assert.equal(w.completedDays, 3);
});

await test("posicion del alumno tras reiniciar: 0/N, Semana 1 (historial ciclo 1 NO cuenta)", () => {
  const rut2 = { id: "R1", nombre: "X", datos: buildReinicioDatos(rutC1.datos, {}) };
  const w = getStudentWeeklyProgress({ alumno: "A1", rutina: rut2, sesiones: ses, completedDays: ["R1-0-w0", "R1-1-w0"], currentWeek: 3 });
  assert.equal(w.weekNumber, 1);
  assert.equal(w.completedDays, 0);
  assert.equal(w.totalDays, 3);
});

await test("ciclo 2: una sesion nueva cuenta 1/N; las del ciclo 1 siguen intactas", () => {
  const rut2 = { id: "R1", nombre: "X", datos: buildReinicioDatos(rutC1.datos, {}) };
  const nueva = { alumno_id: "A1", rutina_id: "R1", semana: 1, dia_idx: 0, ciclo: 2, fecha: "2/5/2026", created_at: "2026-05-02T10:00:00Z" };
  const w = getStudentWeeklyProgress({ alumno: "A1", rutina: rut2, sesiones: ses.concat([nueva]), completedDays: [], currentWeek: 0 });
  assert.equal(w.completedDays, 1);
  assert.deepEqual(w.completedDayIndexes, [0]);
  assert.equal(ses.length, 12);
});

await test("reconciliar NO re-adelanta la semana con historial del ciclo anterior", () => {
  const datos2 = buildReinicioDatos(rutC1.datos, {});
  const r = deriveSemanaActivaTarget({ datos: datos2, sesiones: ses, rutinaId: "R1", alumnoId: "A1" });
  assert.equal(r.target, null);
  // control: sin ciclo (ciclo 1) y semana atrasada si adelantaria
  const ctl = deriveSemanaActivaTarget({ datos: { days, semana_activa: 1 }, sesiones: ses, rutinaId: "R1", alumnoId: "A1" });
  assert.equal(ctl.target, 4 > 3 ? 4 : null);
});

await test("estado del dia / gate: sesiones del ciclo anterior no cuentan", () => {
  const rut2 = { id: "R1", nombre: "X", datos: buildReinicioDatos(rutC1.datos, {}), days };
  const hoy = "1/1/2026";
  const st = getStudentWorkoutState({ rutina: rut2, day: days[0], sesiones: ses, progress: {}, hoy, weekNumber: 1, weekIndex: 0, alumnoId: "A1" });
  assert.equal(st.state, "not_started");
  const gate = getWeekCompletionGate({ rutina: Object.assign({}, rut2, { datos: Object.assign({}, rut2.datos, { semana_activa: 2 }) }), sesiones: ses, alumnoId: "A1", weekNumber: 2, now: new Date(2026, 0, 3) });
  assert.equal(gate.active, false);
});

await test("payloads: ciclo solo si > 1 (retrocompatible con la DB sin migrar)", () => {
  assert.ok(!("ciclo" in buildProgressPayload("A1", "e", 10, 5, "", "1/1/2026", 1, 1)));
  assert.equal(buildProgressPayload("A1", "e", 10, 5, "", "1/1/2026", 1, 2).ciclo, 2);
  const sp = buildSessionPayload({ alumnoId: "A1", session: { dIdx: 0 }, activeDay: { exercises: [] }, exercises: [], activeRoutine: { id: "R1" }, weekToSave: 1, date: "d", time: "t", includeRoutineId: true, ciclo: 2 });
  assert.equal(sp.ciclo, 2);
  assert.ok(!("ciclo" in buildSessionPayload({ alumnoId: "A1", session: { dIdx: 0 }, activeDay: {}, exercises: [], activeRoutine: {}, weekToSave: 1 })));
});

await test("sessionAlreadyExists y dias distintos distinguen ciclos", () => {
  const rows = [{ fecha: "1/1/2026", dia_idx: 0, semana: 1 }];
  assert.equal(sessionAlreadyExists(rows, "1/1/2026", 0, 1), true);
  assert.equal(sessionAlreadyExists(rows, "1/1/2026", 0, 1, 2), false);
  const w1 = [0, 1, 2].map((d) => ({ semana: 1, dia_idx: d }));
  assert.equal(countPersistedDistinctDays(w1, { weekToSave: 1, totalDays: 3, confirmedDayIdx: 0, ciclo: 2 }), 1);
  assert.equal(countPersistedDistinctDays(w1, { weekToSave: 1, totalDays: 3, confirmedDayIdx: 0 }), 3);
});

await test("cargas: 'cero' ignora series previas al reinicio; 'mantener' las usa", () => {
  const sets = [{ kg: 50, date: "20/4/2026", created_at: "2026-04-20T10:00:00Z" }, { kg: 60, date: "3/5/2026" }];
  const base = buildReinicioDatos({ days }, { cargas: "cero", nowIso: "2026-05-01T12:00:00Z" });
  assert.deepEqual(setsForLoadPrefill(sets, base).map((s) => s.kg), [60]);
  const keep = buildReinicioDatos({ days }, { cargas: "mantener", nowIso: "2026-05-01T12:00:00Z" });
  assert.equal(setsForLoadPrefill(sets, keep).length, 2);
});

await test("un guardado normal del entrenador no pisa las claves de ciclo", () => {
  const fresh = buildReinicioDatos({ days }, {});
  const merged = mergeOperationalDatos(fresh, { days, ciclo_actual: 1, semana_activa: 4 });
  assert.equal(merged.ciclo_actual, 2);
  assert.equal(merged.semana_activa, 1);
});

// reiniciarRutinaCiclo con cliente falso: lecturas por from(); la escritura SOLO por la RPC atomica (espejo de la migracion P0).
function fakeClient({ probeError = null, rows = [{ id: "R1", alumno_id: "A1", es_plantilla: false, datos: { days, semana_activa: 4 } }], rpcError = null, rpcRows, noRpc = false } = {}) {
  const calls = [];
  const db = rows.map((r) => JSON.parse(JSON.stringify(r)));
  const builder = (table) => {
    const st = { table, op: "select" };
    const b = {
      select(cols) { st.cols = cols; return b; },
      limit() { return Promise.resolve({ data: [], error: table === "sesiones" ? probeError : null }); },
      eq() { return b; },
      update(body) { st.op = "update"; calls.push(st); return b; },
      delete() { st.op = "delete"; calls.push(st); return b; },
      then(res, rej) { return Promise.resolve({ data: JSON.parse(JSON.stringify(db)), error: null }).then(res, rej); },
    };
    return b;
  };
  const client = { from: builder, calls, db };
  if (!noRpc) client.rpc = async (name, args) => {
    calls.push({ op: "rpc", name, args });
    if (rpcError) return { data: null, error: rpcError };
    if (rpcRows !== undefined) return { data: rpcRows, error: null };
    const next = applyReinicioRow(db[0], args, "2026-05-01T12:00:00Z");
    if (!next) return { data: [], error: null };
    db[0] = next;
    return { data: [next], error: null };
  };
  return client;
}
const origErr = console.error; console.error = () => {};
await test("reiniciarRutinaCiclo: ok usa SOLO la RPC atomica (sin update/delete directos)", async () => {
  const c = fakeClient();
  const r = await reiniciarRutinaCiclo({ client: c, rutinaId: "R1", alumnoId: "A1", cargas: "cero" });
  assert.equal(r.ok, true);
  assert.equal(r.datos.ciclo_actual, 2);
  assert.equal(r.datos.semana_activa, 1);
  assert.equal(r.datos.ciclo_cargas, "cero");
  assert.deepEqual(c.calls.map((x) => x.op), ["rpc"]);
  assert.deepEqual(c.calls[0].args, { p_rutina_id: "R1", p_ciclo_esperado: 1, p_tipo: "rutina", p_semana: 1, p_cargas: "cero" });
});
await test("reiniciarRutinaCiclo: errores explicitos", async () => {
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient({ probeError: { message: "no col" } }), rutinaId: "R1" })).reason, "migracion_pendiente");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient({ noRpc: true }), rutinaId: "R1" })).reason, "migracion_pendiente");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient({ rpcError: { code: "PGRST202", message: "Could not find the function" } }), rutinaId: "R1" })).reason, "migracion_pendiente");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient({ rpcError: { message: "x" } }), rutinaId: "R1" })).reason, "escritura");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient({ rpcRows: [] }), rutinaId: "R1" })).reason, "sin_filas");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient({ rows: [{ id: "R1", alumno_id: null, datos: {} }] }), rutinaId: "R1" })).reason, "no_asignada");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient({ rows: [] }), rutinaId: "R1" })).reason, "rutina_inexistente");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient(), rutinaId: "R1", alumnoId: "OTRO" })).reason, "alumno_distinto");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient(), rutinaId: "" })).reason, "argumentos_invalidos");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient(), rutinaId: "R1", tipo: "semana", semana: 5 })).reason, "argumentos_invalidos");
  assert.equal((await reiniciarRutinaCiclo({ client: fakeClient(), rutinaId: "R1", cicloEsperado: 2 })).reason, "conflicto_ciclo");
});
console.error = origErr;
console.log(n + " tests ok");
