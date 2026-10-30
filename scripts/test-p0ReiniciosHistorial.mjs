// P0 (C-1 / C-2): "Reiniciar semana" y "Reiniciar rutina" CONSERVAN el historial (sesiones, series, validaciones, PR).
//
//   node scripts/test-p0ReiniciosHistorial.mjs
//
// Modulos reales contra una "base" Supabase FALSA en memoria que registra cada operacion por tabla. Las RPC de la migracion P0 se simulan con
// los espejos puros de lib/rutinaRpc.js (misma semantica: UPDATE condicional al ciclo esperado). IMPORTANTE: la concurrencia probada aca es
// la de esos espejos (intercalado de promesas en un solo hilo), NO la de PostgreSQL real: el bloqueo de fila y la re-evaluacion del WHERE
// solo se verifican contra una base real (pendiente, ver descripcion del PR). Sin red, sin dependencias nuevas, datos ficticios.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reiniciarRutinaCiclo } from "../lib/reiniciarRutinaCiclo.js";
import { applyReinicioRow, applyAvanceRow, applyContenidoRow } from "../lib/rutinaRpc.js";
import { readCicloActual, readCicloBase, setsForLoadPrefill, filaActivaEnBloque, buildReinicioDatos } from "../lib/rutinaCiclo.js";
import { getStudentWeeklyProgress } from "../lib/studentWeeklyProgress.js";
import { deriveSemanaActivaTarget, reconcileSemanaActiva } from "../lib/reconcileSemanaActiva.js";
import { finalizeStudentSession, countPersistedDistinctDays } from "../lib/finalizeWorkoutSession.js";
import { updateRutinaSemanaActiva, isCicloCambiado } from "../lib/updateRutinaSemanaActiva.js";
import { updateRutinaPreservingOperational } from "../lib/rutinaOperationalState.js";
import { completedDayIndexesFromRows, validateManualSession } from "../lib/manualSessionValidation.js";
import { resumirSeriesSinFinalizar } from "../lib/orphanSessions.js";
import { buildProgressPayload, buildPendingProgressItem, hydrateProgressFromRows, sessionAlreadyExists, buildSessionPayload, removeUndefinedPayloadFields } from "../lib/workoutSession.js";
import { getWeekCompletionGate } from "../components/student-plan/studentWorkoutState.js";
import { buildLoadSeriesDetailed } from "../components/coachProgresoMetrics.js";
import { eventosPR } from "../lib/metricas/index.js";
import { cleanRutinaWriteBody } from "../lib/routineStore.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
const origErr = console.error;
console.error = () => {};

const A = "alumno-a";
const R = "rutina-r";
const R0 = "rutina-vieja";
const days4 = () => [0, 1, 2, 3].map((i) => ({ label: "Día " + (i + 1), exercises: [{ id: i % 2 ? "bp" : "sq" }] }));
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- base falsa
function makeDb(seed) {
  const db = { rutinas: clone(seed.rutinas || []), sesiones: clone(seed.sesiones || []), progreso: clone(seed.progreso || []) };
  const ops = [];
  let seq = 0;
  function matches(row, filters) { return filters.every(([c, v]) => String(row[c]) === String(v)); }
  const client = {
    ops, db,
    from(table) {
      const q = { table, op: "select", filters: [], body: null };
      const exec = () => {
        ops.push({ table, op: q.op, filters: q.filters.slice() });
        const rows = db[table];
        if (q.op === "select") return { data: clone(rows.filter((r) => matches(r, q.filters))), error: null };
        if (q.op === "insert") { const ins = q.body.map((b) => Object.assign({ id: table + "-" + (++seq) }, b)); rows.push(...clone(ins)); return { data: ins, error: null }; }
        if (q.op === "update") {
          const out = [];
          rows.forEach((r, i) => { if (matches(r, q.filters)) { rows[i] = Object.assign({}, r, clone(q.body)); out.push(clone(rows[i])); } });
          return { data: out, error: null };
        }
        if (q.op === "delete") { db[table] = rows.filter((r) => !matches(r, q.filters)); return { data: null, error: null }; }
        return { data: null, error: { message: "op" } };
      };
      const b = {
        select() { return b; },
        eq(c, v) { q.filters.push([c, v]); return b; },
        limit() { return Promise.resolve(exec()); },
        update(body) { q.op = "update"; q.body = body; return b; },
        insert(body) { q.op = "insert"; q.body = body; return b; },
        delete() { q.op = "delete"; return b; },
        then(res, rej) { return Promise.resolve().then(exec).then(res, rej); },
      };
      return b;
    },
    // RPC de la migracion P0 (espejo puro): UN paso atomico sobre la fila actual.
    async rpc(name, args) {
      await Promise.resolve();
      ops.push({ table: "rutinas", op: "rpc:" + name, args: clone(args) });
      const i = db.rutinas.findIndex((r) => String(r.id) === String(args.p_rutina_id));
      if (i < 0) return { data: [], error: null };
      let next = null;
      if (name === "it_rutina_reiniciar") next = applyReinicioRow(db.rutinas[i], args, "2026-10-29T12:00:00.000Z");
      else if (name === "it_rutina_avanzar_semana") next = applyAvanceRow(db.rutinas[i], args);
      else if (name === "it_rutina_guardar_contenido") next = applyContenidoRow(db.rutinas[i], args.p_fila);
      else return { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
      if (!next) return { data: [], error: null };
      db.rutinas[i] = next;
      return { data: [clone(next)], error: null };
    },
  };
  return client;
}
// sb minimo que usan finalize / validacion manual (mismo contrato que App.jsx)
function makeSb(client) {
  return {
    getSesiones: async (aid) => clone(client.db.sesiones.filter((s) => s.alumno_id === aid)),
    addSesion: async (p) => { const r = await client.from("sesiones").insert([p]); return r.data; },
    getSesionesByAlumnoRutinaSemana: async (aid, rid, _n, w) => clone(client.db.sesiones.filter((s) => s.alumno_id === aid && String(s.rutina_id) === String(rid) && Number(s.semana) === Number(w))),
    getRutinas: async (aid) => clone(client.db.rutinas.filter((r) => r.alumno_id === aid)),
  };
}
const historyWrites = (ops) => ops.filter((o) => (o.table === "sesiones" || o.table === "progreso") && o.op !== "select");
const pager = (client) => async ({ rutinaId, from, to }) => clone(client.db.sesiones.filter((s) => String(s.rutina_id) === String(rutinaId))).slice(from, to + 1);

// ---------------------------------------------------------------- escenario base
const ses = (semana, dia, fecha, extra) => Object.assign({ id: "s-" + semana + "-" + dia + "-" + fecha + "-" + ((extra && extra.ciclo) || 1), alumno_id: A, rutina_id: R, rutina_nombre: "Fuerza", semana, dia_idx: dia, fecha, ciclo: 1, created_at: "2026-10-01T10:00:00Z" }, extra || {});
const prog = (ex, kg, reps, fecha, semana0, extra) => Object.assign({ id: "p-" + ex + "-" + kg + "-" + fecha + "-" + Math.random().toString(36).slice(2, 7), alumno_id: A, ejercicio_id: ex, kg, reps, fecha, semana: semana0, nota: "", ciclo: 1, created_at: "2026-10-01T10:00:00Z" }, extra || {});
function seed(datosExtra) {
  return {
    rutinas: [
      { id: R, alumno_id: A, es_plantilla: false, nombre: "Fuerza", entrenador_id: "e1", datos: Object.assign({ days: days4(), semana_activa: 2 }, datosExtra || {}) },
    ],
    sesiones: [
      ses(1, 0, "5/10/2026"), ses(1, 1, "6/10/2026"), ses(1, 2, "7/10/2026"), ses(1, 3, "8/10/2026"),
      ses(2, 0, "12/10/2026"), ses(2, 1, "13/10/2026", { origen: "validada_coach", ejercicios: "" }),
      // historial de OTRA rutina (rutina_id nulo, legado) y de una rutina anterior: nunca se tocan
      { id: "s-legado", alumno_id: A, rutina_id: null, rutina_nombre: "Rutina 2025", semana: 1, dia_idx: 0, fecha: "3/3/2025", ciclo: 1 },
      { id: "s-old", alumno_id: A, rutina_id: R0, rutina_nombre: "Vieja", semana: 2, dia_idx: 1, fecha: "4/4/2025", ciclo: 3 },
    ],
    progreso: [
      prog("sq", 100, 5, "1/3/2025", 0, { ciclo: 1 }), // PR historico de sentadilla en OTRA rutina (ejercicio compartido)
      prog("sq", 80, 8, "5/10/2026", 0), prog("bp", 60, 8, "6/10/2026", 0),
      prog("sq", 85, 8, "12/10/2026", 1), prog("sq", 87.5, 6, "12/10/2026", 1),
      prog("bp", 62.5, 8, "14/10/2026", 1), // series sin sesion finalizada (huerfanas)
    ],
  };
}
const NOW = new Date(2026, 9, 15, 12).getTime();
const rutinaDe = (client) => clone(client.db.rutinas.find((r) => r.id === R));
const prSnapshot = (rows) => ({ events: eventosPR(rows), max: Object.fromEntries(Object.entries(hydrateProgressFromRows(rows)).map(([k, v]) => [k, v.max])) });

// =========================================================================================================================
await test("C-1/C-2 estatico: no quedan rutas de reinicio que borren historial en App.jsx", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  ["resetAlumnoRoutineWeek", "resetAlumnoRoutineHistory", "deleteSesionesByAlumnoRutina", "deleteSesionesByAlumnoRutinaSemana", "deleteProgresoByAlumnoEjercicios", "deleteProgresoByAlumnoEjerciciosFechas", "writeOperationalState"].forEach((name) => {
    assert.ok(!app.includes(name), "App.jsx no debe contener " + name);
  });
  const fnBody = (start) => { const i = app.indexOf(start); assert.ok(i >= 0, start); return app.slice(i, app.indexOf("\n  }\n", i)); };
  [fnBody("async function reiniciarRutinaAsignada("), fnBody("async function confirmarReinicioRutinaFicha("), (function () { const i = app.indexOf("if (c.t === 'resetWeek' && c.semanaCiclo != null) {"); assert.ok(i >= 0); return app.slice(i, app.indexOf("return;", i)); })()].forEach((body) => {
    // (refrescar estado local con filas recien leidas del servidor esta permitido; borrar o filtrar historial / la cola offline no)
    assert.ok(!/\.delete\(|delete[A-Z]\w*\(|updateQueue\(|setProgress\(|\.filter\(function \(r\) \{\s*return !exSet/.test(body), "un reinicio no borra ni filtra historial ni la cola offline");
  });
  assert.match(app, /onResetRoutine|resetRoutine/);
  // "Limpiar historial" y "Eliminar alumno" quedan como acciones independientes (fuera de este P0)
  assert.ok(app.includes("async function clearAlumnoProgressHistory(alumnoId)"));
  const lib = readFileSync(new URL("../lib/reiniciarRutinaCiclo.js", import.meta.url), "utf8");
  assert.ok(!/\.delete\(|\.update\(|\.insert\(/.test(lib), "el reinicio solo lee y llama la RPC atomica");
});

await test("Reiniciar SEMANA con sesiones ya registradas: cero escrituras de historial, mismas filas e ids, mismos PR", async () => {
  const c = makeDb(seed());
  const before = clone(c.db);
  const pr0 = prSnapshot(before.progreso);
  const r = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  assert.equal(r.ok, true);
  assert.deepEqual(historyWrites(c.ops), [], "ningun INSERT/UPDATE/DELETE sobre sesiones/progreso");
  assert.deepEqual(c.db.sesiones, before.sesiones, "sesiones (incluida la validada y las de otras rutinas) intactas");
  assert.deepEqual(c.db.progreso, before.progreso, "series intactas (ids, fechas, ciclo, semana)");
  assert.deepEqual(prSnapshot(c.db.progreso), pr0, "PR historicos identicos");
  const d = rutinaDe(c).datos;
  assert.deepEqual([d.ciclo_actual, d.semana_activa, d.ciclo_base], [2, 2, 1]);
  assert.equal(d.ciclos_meta.at(-1).tipo, "semana");
  assert.deepEqual(d.days, days4(), "el contenido de la rutina no cambia");
});

await test("tras reiniciar la semana: 0/N, Dia 1, intentos anteriores fuera del periodo, validacion y gate coherentes", async () => {
  const c = makeDb(seed());
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  const rut = rutinaDe(c);
  const w = getStudentWeeklyProgress({ alumno: A, rutina: rut, sesiones: c.db.sesiones, now: NOW });
  assert.deepEqual([w.weekNumber, w.completedDays, w.totalDays], [2, 0, 4]);
  assert.deepEqual(completedDayIndexesFromRows(c.db.sesiones, rut, 2), [], "la validacion manual ofrece todos los dias");
  assert.equal(getWeekCompletionGate({ rutina: rut, sesiones: c.db.sesiones, alumnoId: A, weekNumber: 2, now: NOW }).active, false);
  assert.equal(deriveSemanaActivaTarget({ datos: rut.datos, sesiones: c.db.sesiones, rutinaId: R, alumnoId: A }).target, null, "la reconciliacion no re-avanza");
});

await test("nueva sesion despues del reinicio: se guarda aunque sea el MISMO dia y la MISMA fecha, y la semana avanza al completarla", async () => {
  const c = makeDb(seed());
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  const sb = makeSb(c);
  assert.equal(sessionAlreadyExists(c.db.sesiones, "12/10/2026", 0, 2, 2), false, "la sesion vieja (ciclo 1) no tapa la nueva");
  for (let dia = 0; dia < 4; dia++) {
    const payload = removeUndefinedPayloadFields(buildSessionPayload({ alumnoId: A, session: { dIdx: dia }, activeDay: days4()[dia], activeRoutine: { id: R, name: "Fuerza" }, exercises: [], weekToSave: 2, date: "12/10/2026", time: "10:00", includeRoutineId: true, ciclo: 2 }));
    const out = await finalizeStudentSession({
      sb, alumnoId: A, payload, date: "12/10/2026", dayIndex: dia, weekToSave: 2, ciclo: 2, isOnline: true, effectiveWeek: 1, totalDays: 4,
      lastAdvanceDate: null, todayStr: "t" + dia, rutinaId: R, rutinaNombre: "Fuerza",
      updateRutinaWeek: () => updateRutinaSemanaActiva(c, R, 3, 2),
    });
    assert.equal(out.status, "saved");
    assert.equal(out.source, "insert", "dia " + dia + ": se inserta (no se confunde con el intento anterior)");
    assert.equal(out.week.advance, dia < 3 ? "not_needed" : "ok");
  }
  assert.equal(rutinaDe(c).datos.semana_activa, 3);
  assert.equal(c.db.sesiones.filter((s) => s.semana === 2 && s.ciclo === 1).length, 2, "los intentos anteriores siguen guardados");
});

await test("se puede reiniciar una semana YA completa (G8) y la reconciliacion no la vuelve a dar por terminada", async () => {
  const s = seed({ semana_activa: 2 });
  s.sesiones.push(ses(2, 2, "14/10/2026"), ses(2, 3, "15/10/2026")); // semana 2 completa en ciclo 1 (avance pendiente)
  const c = makeDb(s);
  assert.equal(deriveSemanaActivaTarget({ datos: rutinaDe(c).datos, sesiones: c.db.sesiones, rutinaId: R, alumnoId: A }).target, 3, "antes: completa");
  const r = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  assert.equal(r.ok, true);
  const res = await reconcileSemanaActiva({ client: c, rutinaId: R, alumnoId: A, fetchSesionesPage: pager(c) });
  assert.equal(res.status, "noop");
  assert.equal(rutinaDe(c).datos.semana_activa, 2);
});

await test("Reiniciar RUTINA con varios ciclos historicos: Semana 1, ciclo nuevo, todo el historial intacto, PR identicos", async () => {
  const datos = buildReinicioDatos(buildReinicioDatos({ days: days4(), semana_activa: 4 }, { tipo: "rutina" }), { tipo: "semana", semana: 3 });
  const s = seed(datos);
  s.sesiones.push(ses(3, 0, "20/10/2026", { ciclo: 3, id: "s-c3" }));
  s.progreso.push(prog("sq", 90, 5, "20/10/2026", 2, { ciclo: 3 }));
  const c = makeDb(s);
  const before = clone(c.db);
  const r = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "rutina", cargas: "cero", cicloEsperado: 3 });
  assert.equal(r.ok, true);
  const d = rutinaDe(c).datos;
  assert.deepEqual([d.ciclo_actual, d.semana_activa, d.ciclo_base, d.ciclo_cargas], [4, 1, 4, "cero"]);
  assert.deepEqual(historyWrites(c.ops), []);
  assert.deepEqual(c.db.sesiones, before.sesiones);
  assert.deepEqual(c.db.progreso, before.progreso);
  assert.deepEqual(prSnapshot(c.db.progreso), prSnapshot(before.progreso));
  const w = getStudentWeeklyProgress({ alumno: A, rutina: rutinaDe(c), sesiones: c.db.sesiones, now: NOW });
  assert.deepEqual([w.weekNumber, w.completedDays], [1, 0]);
});

await test("ejercicio compartido con otra rutina: sus series y su PR (100 kg) siguen disponibles despues de ambos reinicios", async () => {
  const c = makeDb(seed());
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "rutina", cicloEsperado: 2 });
  assert.equal(c.db.progreso.filter((p) => p.ejercicio_id === "sq").length, 4);
  assert.equal(hydrateProgressFromRows(c.db.progreso).sq.max, 100, "el PR historico no se resetea");
  assert.ok(c.db.sesiones.some((s) => s.id === "s-legado") && c.db.sesiones.some((s) => s.id === "s-old"));
});

await test("sesion validada manualmente antes del reinicio: se conserva; validar en el ciclo nuevo funciona; con la ficha vieja se rechaza", async () => {
  const c = makeDb(seed());
  const rutVieja = rutinaDe(c);
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  assert.ok(c.db.sesiones.some((s) => s.origen === "validada_coach" && s.ciclo === 1), "la validacion anterior sigue guardada");
  const sb = makeSb(c);
  await assert.rejects(() => validateManualSession({ sb, alumnoId: A, rutina: rutVieja, diaIdx: 1, semana: 2, now: new Date(NOW) }), (e) => e.code === "ciclo_cambiado");
  assert.equal(c.db.sesiones.length, 8, "con la ficha vieja no se inserta nada");
  const ok = await validateManualSession({ sb, alumnoId: A, rutina: rutinaDe(c), diaIdx: 1, semana: 2, now: new Date(NOW) });
  assert.equal(ok.status, "saved");
  assert.equal(ok.row.ciclo, 2, "la validacion nueva queda en el ciclo vigente");
  assert.equal(getStudentWeeklyProgress({ alumno: A, rutina: rutinaDe(c), sesiones: c.db.sesiones, now: NOW }).completedDays, 1);
});

await test("doble clic / reinicio repetido con el mismo ciclo esperado: un solo ciclo nuevo; el segundo es conflicto y no escribe", async () => {
  const c = makeDb(seed());
  const a = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  const b = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
  assert.equal(a.ok, true);
  assert.deepEqual([b.ok, b.reason], [false, "conflicto_ciclo"]);
  assert.equal(readCicloActual(rutinaDe(c).datos), 2);
  assert.equal(c.ops.filter((o) => o.op === "rpc:it_rutina_reiniciar").length, 1);
});

await test("dos reinicios concurrentes sobre la misma rutina (espejo de la RPC, intercalados): exactamente uno gana", async () => {
  const c = makeDb(seed());
  const [x, y] = await Promise.all([
    reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 }),
    reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "rutina", cicloEsperado: 1 }),
  ]);
  assert.equal([x, y].filter((r) => r.ok).length, 1);
  assert.equal([x, y].filter((r) => r.reason === "conflicto_ciclo").length, 1);
  assert.equal(readCicloActual(rutinaDe(c).datos), 2, "un solo ciclo nuevo");
  assert.equal(c.ops.filter((o) => o.op === "rpc:it_rutina_reiniciar").length, 2, "ambos llegaron a la RPC: el segundo perdio en el UPDATE condicional");
  assert.deepEqual(historyWrites(c.ops), []);
});

await test("sesion abierta ANTES del reinicio y finalizada DESPUES: se guarda en su ciclo original y no avanza la planificacion nueva", async () => {
  const s = seed({ semana_activa: 3 });
  s.sesiones.push(ses(2, 2, "14/10/2026"), ses(2, 3, "15/10/2026"), ses(3, 0, "19/10/2026"), ses(3, 1, "20/10/2026"), ses(3, 2, "21/10/2026"));
  const c = makeDb(s);
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "rutina", cicloEsperado: 1 }); // coach: ciclo 2, Semana 1
  const sb = makeSb(c);
  // el alumno tenia abierta la semana 3 / dia 4 del ciclo 1 y la termina
  const payload = removeUndefinedPayloadFields(buildSessionPayload({ alumnoId: A, session: { dIdx: 3 }, activeDay: days4()[3], activeRoutine: { id: R, name: "Fuerza" }, exercises: [], weekToSave: 3, date: "22/10/2026", time: "10:00", includeRoutineId: true, ciclo: 1 }));
  const out = await finalizeStudentSession({
    sb, alumnoId: A, payload, date: "22/10/2026", dayIndex: 3, weekToSave: 3, ciclo: 1, isOnline: true, effectiveWeek: 2, totalDays: 4,
    lastAdvanceDate: null, todayStr: "x", rutinaId: R, rutinaNombre: "Fuerza",
    updateRutinaWeek: () => updateRutinaSemanaActiva(c, R, 4, 1),
  });
  assert.equal(out.status, "saved");
  assert.equal(out.week.advance, "ciclo_cambiado");
  assert.equal(out.week.cicloDatos.ciclo_actual, 2);
  const d = rutinaDe(c).datos;
  assert.deepEqual([d.ciclo_actual, d.semana_activa], [2, 1], "el reinicio NO se pisa (antes: semana_activa 4 sobre el ciclo 2)");
  assert.ok(c.db.sesiones.some((x) => x.semana === 3 && x.dia_idx === 3 && !x.ciclo), "la sesion quedo guardada (payload sin ciclo => ciclo 1 por defecto)");
  assert.equal(getStudentWeeklyProgress({ alumno: A, rutina: rutinaDe(c), sesiones: c.db.sesiones, now: NOW }).completedDays, 0);
});

await test("avance con ciclo esperado: sin la RPC (migracion pendiente) igual compara el ciclo y no escribe sobre otro ciclo", async () => {
  const c = makeDb(seed({ ciclo_actual: 2 }));
  delete c.rpc;
  const res = await updateRutinaSemanaActiva(c, R, 3, 1);
  assert.equal(isCicloCambiado(res), true);
  assert.equal(c.ops.filter((o) => o.op === "update").length, 0);
  assert.equal(rutinaDe(c).datos.semana_activa, 2);
});

await test("guardado del entrenador concurrente con un reinicio: no revierte ciclo ni semana (RPC atomica y ruta anterior)", async () => {
  for (const conRpc of [true, false]) {
    const c = makeDb(seed());
    const copiaVieja = rutinaDe(c); // la pantalla del coach cargo la rutina ANTES del reinicio
    await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 1 });
    if (!conRpc) delete c.rpc;
    const nuevosDias = days4().map((dd, i) => (i === 0 ? Object.assign({}, dd, { exercises: [{ id: "sq" }, { id: "lp" }] }) : dd));
    const res = await updateRutinaPreservingOperational(c, R, cleanRutinaWriteBody({ nombre: "Fuerza", alumno_id: A, entrenador_id: "e1", datos: Object.assign({}, copiaVieja.datos, { days: nuevosDias }) }));
    assert.ok(Array.isArray(res) && res.length === 1);
    const d = rutinaDe(c).datos;
    assert.deepEqual([d.ciclo_actual, d.semana_activa, d.ciclos_meta.length], [2, 2, 1], conRpc ? "RPC" : "ruta anterior");
    assert.deepEqual(d.days, nuevosDias, "el contenido editado SI se guarda");
    assert.deepEqual(historyWrites(c.ops), []);
  }
});

await test("cola offline con registros del ciclo anterior: se sincronizan con su ciclo y semana originales y no completan el periodo nuevo", async () => {
  const c = makeDb(seed({ ciclo_actual: 2, ciclo_base: 1 }));
  const item = buildPendingProgressItem("sq", 82.5, 8, null, "14/10/2026", 1, 2, A, "11111111-2222-4333-8444-555555555555");
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 2, cicloEsperado: 2 });
  const payload = buildProgressPayload(A, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId);
  assert.deepEqual([payload.ciclo, payload.semana, payload.fecha], [2, 1, "14/10/2026"], "no se reasigna al ciclo nuevo");
  await c.from("progreso").insert([payload]);
  const rut = rutinaDe(c);
  assert.equal(getStudentWeeklyProgress({ alumno: A, rutina: rut, sesiones: c.db.sesiones, progreso: c.db.progreso, now: NOW }).completedDays, 0);
  assert.equal(filaActivaEnBloque(rut.datos, payload, payload.semana + 1), false, "intento anterior de la semana 2: fuera del bloque vigente");
});

await test("cargas sugeridas despues de reiniciar una semana: se mantienen (G3), tambien en un bloque 'cero'", () => {
  const sets = [
    { kg: 50, ciclo: 1, date: "1/9/2026" },
    { kg: 70, ciclo: 2, date: "5/10/2026" },
    { kg: 72.5, ciclo: 3, date: "12/10/2026" },
  ];
  const bloqueCero = buildReinicioDatos({ days: days4(), ciclo_actual: 1 }, { tipo: "rutina", cargas: "cero", nowIso: "2026-10-01T00:00:00Z" }); // ciclo 2
  const trasSemana = buildReinicioDatos(bloqueCero, { tipo: "semana", semana: 2, nowIso: "2026-10-12T00:00:00Z" }); // ciclo 3
  assert.equal(readCicloBase(trasSemana), 2);
  assert.equal(trasSemana.ciclo_cargas, "cero");
  assert.equal(trasSemana.ciclo_reiniciado_at, "2026-10-01T00:00:00Z", "el reinicio de semana no mueve el inicio del bloque");
  assert.deepEqual(setsForLoadPrefill(sets, bloqueCero).map((s) => s.kg), [70, 72.5]);
  assert.deepEqual(setsForLoadPrefill(sets, trasSemana).map((s) => s.kg), [70, 72.5], "las cargas del bloque NO desaparecen");
  const mantener = buildReinicioDatos({ days: days4() }, { tipo: "semana", semana: 3 });
  assert.equal(setsForLoadPrefill(sets, mantener).length, 3);
});

await test("estadisticas del bloque tras reiniciar la semana 2: semana 1 del ciclo anterior, semana 2 SOLO del intento nuevo (sin duplicar)", () => {
  const datos = buildReinicioDatos({ days: days4(), semana_activa: 2 }, { tipo: "semana", semana: 2 }); // ciclo 2 desde semana 2
  const weekStarts = [0, 1, 2, 3].map((i) => new Date(2026, 9, 5 + i * 7).getTime());
  const rows = [
    prog("sq", 80, 8, "5/10/2026", 0, { ciclo: 1 }),
    prog("sq", 95, 8, "12/10/2026", 1, { ciclo: 1 }), // intento anterior de la semana 2 (mas pesado)
    prog("sq", 85, 8, "14/10/2026", 1, { ciclo: 2 }), // intento vigente
  ];
  const out = buildLoadSeriesDetailed(rows, { ejercicioId: "sq", routineId: R, ciclo: 2, routineDatos: datos, weekStarts, routineDays: days4(), dayIdx: 0, sessions: [] });
  assert.deepEqual(out.series, [80, 85, null, null]);
  // sin reinicio de semana (bloques viejos): mismo comportamiento que antes, solo el ciclo vigente
  const legado = { days: days4(), ciclo_actual: 2 };
  assert.deepEqual(buildLoadSeriesDetailed(rows, { ejercicioId: "sq", routineId: R, ciclo: 2, routineDatos: legado, weekStarts, routineDays: days4(), dayIdx: 0, sessions: [] }).series, [null, 85, null, null]);
});

await test("aviso de series sin finalizar (G4): se detectan, incluido hoy, sin escribir nada", () => {
  const s = seed();
  const hoy = new Date(); const fHoy = hoy.getDate() + "/" + (hoy.getMonth() + 1) + "/" + hoy.getFullYear();
  s.progreso.push(prog("sq", 70, 5, fHoy, 1));
  const resumen = resumirSeriesSinFinalizar({ progreso: s.progreso, sesiones: s.sesiones, rutina: s.rutinas[0], alumnoId: A, maxAgeDays: 3650 });
  assert.ok(resumen.series >= 2);
  assert.ok(resumen.fechas.includes(fHoy));
});

await test("SIN la migracion (PostgREST responde PGRST202): guardar y avanzar siguen funcionando; reiniciar se rechaza sin escribir", async () => {
  const c = makeDb(seed());
  c.rpc = async (name) => { c.ops.push({ table: "rutinas", op: "rpc:" + name }); return { data: null, error: { code: "PGRST202", message: "Could not find the function public." + name } }; };
  // guardado del entrenador: ruta anterior (lee fresco + fusiona), las claves operativas se conservan
  const nuevos = days4().slice(0, 2);
  const g = await updateRutinaPreservingOperational(c, R, cleanRutinaWriteBody({ nombre: "Fuerza", alumno_id: A, entrenador_id: "e1", datos: { days: nuevos, semana_activa: 4 } }));
  assert.ok(Array.isArray(g) && g.length === 1, "el guardado se aplica");
  assert.deepEqual([rutinaDe(c).datos.days, rutinaDe(c).datos.semana_activa], [nuevos, 2]);
  // avance de semana del alumno: ruta anterior, con chequeo de ciclo
  const a = await updateRutinaSemanaActiva(c, R, 3, 1);
  assert.ok(Array.isArray(a) && a.length === 1);
  assert.equal(rutinaDe(c).datos.semana_activa, 3);
  assert.equal(isCicloCambiado(await updateRutinaSemanaActiva(c, R, 4, 2)), true, "con otro ciclo no avanza");
  // reconciliacion al abrir la app: sigue funcionando (semana 3 aun incompleta => noop sin error)
  assert.notEqual((await reconcileSemanaActiva({ client: c, rutinaId: R, alumnoId: A, fetchSesionesPage: pager(c) })).status, "failed");
  // reinicio: se rechaza (no hay escritura atomica disponible) y no toca nada
  const before = clone(c.db);
  const r = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 3, cicloEsperado: 1 });
  assert.deepEqual([r.ok, r.reason], [false, "migracion_pendiente"]);
  assert.deepEqual(c.db, before);
  assert.deepEqual(historyWrites(c.ops), []);
});

console.error = origErr;
console.log("\n" + count + " pruebas OK");
