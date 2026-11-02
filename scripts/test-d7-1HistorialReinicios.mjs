// D7.1: proteccion del historial de entrenamiento en reinicios de rutina / semana (sobre P0 C-1/C-2, PR #131).
//
//   node scripts/test-d7-1HistorialReinicios.mjs
//
// Modulos REALES contra una base Supabase FALSA en memoria (la misma de test-p0ReiniciosHistorial.mjs; las RPC se simulan con los espejos
// puros de lib/rutinaRpc.js). Sin red, sin SQL, datos ficticios. Cubre:
//   1. reiniciar rutina conserva el historial      2. reiniciar semana conserva los registros anteriores
//   3. los PR historicos siguen disponibles        4. fechas con y sin cero inicial
//   5. los ciclos no mezclan series ni sesiones     6. el entrenamiento nuevo sigue funcionando
// y las regresiones D1 (series del ciclo anterior el mismo dia), D2 (precarga «desde cero»), D3 (series de la rutina anterior como
// huerfanas de la nueva) y D4 (sesion que cruza la medianoche ofrecida como huerfana).

// Zona horaria fija: orphanSessions fija el dia en America/Argentina y los datos usan fechas locales.
process.env.TZ = "America/Argentina/Buenos_Aires";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reiniciarRutinaCiclo } from "../lib/reiniciarRutinaCiclo.js";
import { applyReinicioRow, applyAvanceRow, applyContenidoRow } from "../lib/rutinaRpc.js";
import { readCicloActual, setsForLoadPrefill } from "../lib/rutinaCiclo.js";
import { eventosPR } from "../lib/metricas/index.js";
import {
  buildExerciseSetRecord, filterSetsByDay, getWorkoutExerciseStatus, calculateDayProgress, hydrateProgressFromRows,
  updateExerciseProgressRecord, buildProgressPayload, buildSessionPayload, calculateWorkoutVolume,
} from "../lib/workoutSession.js";
import { detectOrphanSessions } from "../lib/orphanSessions.js";
import { getStudentWorkoutState, updateProgressEntryWithSessionContext } from "../components/student-plan/studentWorkoutState.js";
import { countExercisesWithLogToday } from "../components/student-plan/studentPlanHelpers.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
console.error = () => {};
const A = "alumno-a";
const R = "rutina-r";
const clone = (x) => JSON.parse(JSON.stringify(x));
const days1 = () => [{ label: "Día 1", exercises: [{ id: "sq", sets: 1 }] }];
const days2 = () => [{ label: "Día 1", exercises: [{ id: "sq", sets: 3 }] }, { label: "Día 2", exercises: [{ id: "bp", sets: 3 }] }];

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

const historyWrites = (ops) => ops.filter((o) => (o.table === "sesiones" || o.table === "progreso") && o.op !== "select");
const ses = (semana, dia, fecha, extra) => Object.assign({ id: "s-" + semana + "-" + dia + "-" + fecha, alumno_id: A, rutina_id: R, rutina_nombre: "Fuerza", semana, dia_idx: dia, fecha, ciclo: 1, created_at: "2026-10-01T10:00:00Z" }, extra || {});
let np = 0;
const prog = (ex, kg, fecha, semana0, extra) => Object.assign({ id: "p-" + ++np, alumno_id: A, ejercicio_id: ex, kg, reps: 5, fecha, semana: semana0, nota: "", ciclo: 1, created_at: "2026-10-01T10:00:00Z" }, extra || {});
function base() {
  return {
    rutinas: [{ id: R, alumno_id: A, nombre: "Fuerza", es_plantilla: false, created_at: "2026-09-01T10:00:00Z", datos: { days: days2(), semana_activa: 3 } }],
    sesiones: [ses(1, 0, "5/10/2026"), ses(1, 1, "6/10/2026"), ses(2, 0, "12/10/2026"), ses(3, 0, "19/10/2026")],
    progreso: [prog("sq", 100, "5/10/2026", 0), prog("bp", 70, "6/10/2026", 0), prog("sq", 110, "12/10/2026", 1), prog("sq", 120, "19/10/2026", 2)],
  };
}

// =================================================================================== 1-3 conservacion
await test("1. reiniciar RUTINA: no borra ni modifica sesiones ni progreso; abre el ciclo 2", async () => {
  const c = makeDb(base());
  const antes = clone(c.db);
  const r = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "rutina", cicloEsperado: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(historyWrites(c.ops), [], "ninguna escritura en sesiones/progreso");
  assert.deepEqual(c.db.sesiones, antes.sesiones);
  assert.deepEqual(c.db.progreso, antes.progreso);
  assert.equal(readCicloActual(c.db.rutinas[0].datos), 2);
});

await test("2. reiniciar SEMANA: conserva los registros anteriores (incluida la semana reiniciada) y abre otro ciclo", async () => {
  const c = makeDb(base());
  const antes = clone(c.db);
  const r = await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "semana", semana: 3, cicloEsperado: 1 });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(historyWrites(c.ops), []);
  assert.deepEqual(c.db.sesiones, antes.sesiones);
  assert.deepEqual(c.db.progreso, antes.progreso);
  assert.equal(c.db.rutinas[0].datos.semana_activa, 3);
  assert.equal(readCicloActual(c.db.rutinas[0].datos), 2);
});

await test("3. los PR historicos siguen disponibles tras reiniciar (eventos y maximos sobre todo el historial)", async () => {
  const c = makeDb(base());
  const prAntes = eventosPR(c.db.progreso);
  const maxAntes = hydrateProgressFromRows(c.db.progreso).sq.max;
  await reiniciarRutinaCiclo({ client: c, rutinaId: R, alumnoId: A, tipo: "rutina", cicloEsperado: 1 });
  // el alumno entrena en el ciclo 2 con menos peso: el PR de 120 no se pierde ni se "resetea"
  c.db.progreso.push(prog("sq", 90, "2/11/2026", 0, { ciclo: 2 }));
  assert.equal(hydrateProgressFromRows(c.db.progreso).sq.max, maxAntes);
  assert.equal(maxAntes, 120);
  const prDespues = eventosPR(c.db.progreso);
  assert.ok(prAntes.every((e) => prDespues.some((d) => JSON.stringify(d) === JSON.stringify(e))), "los eventos de PR previos siguen");
  // la hidratacion conserva el ciclo de cada serie
  assert.equal(hydrateProgressFromRows(c.db.progreso).sq.sets[0].ciclo, 2);
});

// =================================================================================== 4 fechas
await test("4. fechas con y sin cero inicial se interpretan igual (series de hoy, conteos y estado)", () => {
  const sets = [buildExerciseSetRecord(100, 5, "05/03/2026", 0, "", null, 1), buildExerciseSetRecord(90, 5, "4/3/2026", 0, "", null, 1)];
  assert.equal(filterSetsByDay(sets, "5/3/2026", 0, true).length, 1, "05/03 = 5/3");
  assert.equal(filterSetsByDay(sets, "04/03/2026", 0, true).length, 1, "4/3 = 04/03");
  assert.equal(filterSetsByDay(sets, "3/3/2026", 0, true).length, 0);
  const progress = { sq: { sets, max: 100 } };
  assert.equal(countExercisesWithLogToday(days2()[0], progress, "5/3/2026", 0), 1);
  assert.equal(getWorkoutExerciseStatus({ exercise: { id: "sq", sets: 1 }, progress, date: "5/3/2026", currentWeek: 0 }).isDone, true);
});

// =================================================================================== 5 ciclos
await test("5a. D1: tras reiniciar el mismo dia, las series del ciclo anterior no cuentan en el ciclo nuevo", () => {
  const hoy = "1/11/2026";
  // tres series de sentadilla HOY en el ciclo 1 (semana indice 1); el entrenador reinicia la semana 2 -> ciclo 2
  let entry = undefined;
  for (let i = 0; i < 3; i++) entry = updateExerciseProgressRecord(entry, buildExerciseSetRecord(100, 5, hoy, 1, "", null, 1));
  const progress = { sq: entry };
  const ex = { id: "sq", sets: 3 };
  const c1 = getWorkoutExerciseStatus({ exercise: ex, progress, date: hoy, currentWeek: 1, ciclo: 1 });
  assert.equal(c1.isDone, true, "en el ciclo 1 el ejercicio estaba hecho");
  const c2 = getWorkoutExerciseStatus({ exercise: ex, progress, date: hoy, currentWeek: 1, ciclo: 2 });
  assert.equal(c2.setsToday.length, 0);
  assert.equal(c2.isDone, false);
  assert.deepEqual(calculateDayProgress([ex], progress, hoy, 1, { checkWeek: false, ciclo: 2 }).done, 0, "no habilita «Finalizar»");
  // reinicio de RUTINA (semana indice 0): calculateDayProgress con checkWeek:false tampoco cuenta las del ciclo 1
  assert.equal(calculateDayProgress([ex], progress, hoy, 0, { checkWeek: false, ciclo: 2 }).done, 0);
  // una serie nueva del ciclo 2 si cuenta
  const p2 = { sq: updateExerciseProgressRecord(entry, buildExerciseSetRecord(80, 5, hoy, 1, "", null, 2)) };
  assert.equal(getWorkoutExerciseStatus({ exercise: ex, progress: p2, date: hoy, currentWeek: 1, ciclo: 2 }).setsToday.length, 1);
  // el estado del alumno (plan) tampoco cuenta ejercicios del ciclo anterior
  const rutina2 = { id: R, nombre: "Fuerza", datos: { days: days2(), semana_activa: 2, ciclo_actual: 2 } };
  assert.equal(countExercisesWithLogToday(days2()[0], progress, hoy, 1, 2), 0);
  const st = getStudentWorkoutState({ rutina: rutina2, day: days2()[0], sesiones: [], progress, hoy, weekNumber: 2, weekIndex: 1, alumnoId: A });
  assert.notEqual(st.status, "en_progreso", JSON.stringify(st));
  // las series locales anteriores a D7.1 (sin ciclo) se comportan como antes (no se filtran)
  const legado = { sq: { sets: [{ kg: 100, reps: 5, date: hoy, week: 1 }], max: 100 } };
  assert.equal(getWorkoutExerciseStatus({ exercise: { id: "sq", sets: 1 }, progress: legado, date: hoy, currentWeek: 1, ciclo: 2 }).isDone, true);
});

await test("5b. D2: «Reiniciar desde cero» el mismo dia no precarga el peso de una serie del ciclo anterior", () => {
  const datos = { ciclo_actual: 2, ciclo_base: 2, ciclo_cargas: "cero", ciclo_reiniciado_at: new Date().toISOString() };
  const hoy = new Date().toLocaleDateString("es-AR");
  const anterior = buildExerciseSetRecord(120, 5, hoy, 0, "", null, 1);
  assert.deepEqual(setsForLoadPrefill([anterior], datos), [], "la serie del ciclo 1 no se precarga");
  const nueva = buildExerciseSetRecord(60, 5, hoy, 0, "", null, 2);
  assert.deepEqual(setsForLoadPrefill([nueva, anterior], datos).map((s) => s.kg), [60]);
});

await test("5c. D3: al reasignar rutina, las series de la rutina anterior no aparecen como huerfanas de la nueva", () => {
  const rutinaNueva = { id: "R-NEW", nombre: "Nueva", created_at: "2026-10-30T12:00:00Z", datos: { days: days2(), semana_activa: 1 } };
  const viejas = [prog("sq", 100, "28/10/2026", 3, { created_at: "2026-10-28T18:00:00Z" }), prog("bp", 70, "28/10/2026", 3, { created_at: "2026-10-28T18:10:00Z" })];
  const now = new Date(2026, 10, 1, 12);
  assert.deepEqual(detectOrphanSessions({ progreso: viejas, sesiones: [], rutina: rutinaNueva, alumnoId: A, now }), []);
  // una serie de la rutina nueva sin sesion SI se detecta
  const nueva = prog("sq", 80, "31/10/2026", 0, { created_at: "2026-10-31T18:00:00Z" });
  assert.equal(detectOrphanSessions({ progreso: viejas.concat([nueva]), sesiones: [], rutina: rutinaNueva, alumnoId: A, now }).length, 1);
  // sin created_at en la rutina, no se descarta nada (comportamiento anterior)
  const sinFecha = Object.assign({}, rutinaNueva, { created_at: undefined });
  assert.equal(detectOrphanSessions({ progreso: viejas, sesiones: [], rutina: sinFecha, alumnoId: A, now }).length, 1);
});

await test("5d. D4: un entrenamiento que cruza la medianoche no se ofrece como huerfano (evita la sesion duplicada)", () => {
  const rutina = { id: R, nombre: "Fuerza", created_at: "2026-09-01T10:00:00Z", datos: { days: days1(), semana_activa: 1 } };
  const serie = prog("sq", 100, "31/10/2026", 0, { created_at: new Date(2026, 9, 31, 23, 50).toISOString() });
  const sesion = ses(1, 0, "1/11/2026", { ejercicios: "sq", created_at: new Date(2026, 10, 1, 0, 15).toISOString() });
  const now = new Date(2026, 10, 2, 12);
  assert.deepEqual(detectOrphanSessions({ progreso: [serie], sesiones: [sesion], rutina, alumnoId: A, now }), []);
  // una sesion del dia siguiente pero MUCHO despues (otro entrenamiento) no la cubre
  const tarde = ses(1, 0, "1/11/2026", { ejercicios: "sq", created_at: new Date(2026, 10, 1, 19, 0).toISOString() });
  assert.equal(detectOrphanSessions({ progreso: [serie], sesiones: [tarde], rutina, alumnoId: A, now }).length, 1);
  // una sesion de OTRO dia (otros ejercicios), terminada poco despues, tampoco la cubre (no oculta una huerfana legitima)
  const rutina2 = { id: R, nombre: "Fuerza", created_at: "2026-09-01T10:00:00Z", datos: { days: days2(), semana_activa: 1 } };
  const otroDia = ses(1, 1, "1/11/2026", { dia_idx: null, ejercicios: "bp", created_at: new Date(2026, 10, 1, 0, 30).toISOString() });
  assert.equal(detectOrphanSessions({ progreso: [serie], sesiones: [otroDia], rutina: rutina2, alumnoId: A, now }).length, 1);
});

await test("5e. ciclos: las sesiones del ciclo anterior no completan dias ni la huerfana del ciclo nuevo", () => {
  const rutina = { id: R, nombre: "Fuerza", created_at: "2026-09-01T10:00:00Z", datos: { days: days1(), semana_activa: 1, ciclo_actual: 2, ciclo_base: 2 } };
  const serieC2 = prog("sq", 90, "31/10/2026", 0, { ciclo: 2, created_at: "2026-10-31T18:00:00Z" });
  const sesionC1 = ses(1, 0, "31/10/2026", { ciclo: 1, created_at: "2026-10-31T19:00:00Z" });
  assert.equal(detectOrphanSessions({ progreso: [serieC2], sesiones: [sesionC1], rutina, alumnoId: A, now: new Date(2026, 10, 1, 12) }).length, 1,
    "una sesion del ciclo 1 no cubre series del ciclo 2");
});

// =================================================================================== 6 entrenamiento nuevo
await test("6. el entrenamiento nuevo sigue funcionando: la serie local y el payload llevan el mismo ciclo y la fecha del dia", () => {
  const hoy = new Date().toLocaleDateString("es-AR");
  const set = buildExerciseSetRecord("82.5", "6", hoy, 0, "ok", 8, 2);
  assert.deepEqual([set.kg, set.reps, set.date, set.week, set.ciclo], [82.5, 6, hoy, 0, 2]);
  const entry = updateProgressEntryWithSessionContext(undefined, set, { rId: R, dIdx: 0 });
  assert.equal(entry.sets[0].ciclo, 2, "el contexto de sesion no pierde el ciclo");
  assert.equal(entry.max, 82.5);
  const status = getWorkoutExerciseStatus({ exercise: { id: "sq", sets: 1 }, progress: { sq: entry }, date: hoy, currentWeek: 0, ciclo: 2 });
  assert.equal(status.isDone, true);
  // ciclo 1: sin campo en el payload (la base aplica DEFAULT 1); ciclo 2: ciclo explicito
  const s1 = buildExerciseSetRecord(80, 5, hoy, 0, "", null, 1);
  assert.equal(s1.ciclo, 1);
  // sin ciclo (llamadas anteriores) el set queda como antes
  assert.equal(buildExerciseSetRecord(80, 5, hoy, 0, "", null).ciclo, undefined);
  // el volumen del resumen cuenta solo el ciclo vigente (mismo dia, ciclo 1 y ciclo 2)
  const p12 = { sq: { sets: [buildExerciseSetRecord(100, 5, hoy, 0, "", null, 2), buildExerciseSetRecord(100, 5, hoy, 0, "", null, 1)], max: 100 } };
  assert.equal(calculateWorkoutVolume([{ id: "sq" }], p12, hoy, 2), 500);
  assert.equal(calculateWorkoutVolume([{ id: "sq" }], p12, hoy), 1000, "sin ciclo: comportamiento anterior");
  assert.equal(typeof buildProgressPayload, "function");
  assert.equal(typeof buildSessionPayload, "function");
});

await test("7. cableado: la pantalla de entrenamiento, el plan y logSet usan el ciclo vigente", () => {
  const ws = readFileSync(new URL("../components/WorkoutScreen.jsx", import.meta.url), "utf8");
  assert.match(ws, /const cicloVigente = readCicloActual\(activeR && activeR\.datos\);/);
  assert.equal((ws.match(/ciclo: cicloVigente/g) || []).length, 3, "estado del ejercicio, progreso del dia y tira de progreso");
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.match(app, /buildExerciseSetRecord\(kg, reps, d, weekForSet, note, rpe, cicloForSet\)/);
  assert.match(app, /countExercisesWithLogToday\(todayDay, progress, hoy, currentWeekForStudent, readCicloActual\(routines\[0\] && routines\[0\]\.datos\)\)/);
  assert.match(app, /countExercisesWithLogToday\(d, progress, hoyStr, currentWeekForRoutine, readCicloActual\(r && r\.datos\)\)/);
  const st = readFileSync(new URL("../components/student-plan/studentWorkoutState.js", import.meta.url), "utf8");
  assert.match(st, /countExercisesWithLogToday\(day, progress, hoy, weekIndex, readCicloActual\(rutina && rutina\.datos\)\)/);
  assert.match(st, /todaySetsOf\(progress, ex\.id, hoy, weekIndex, readCicloActual\(rutina && rutina\.datos\)\)/);
});

console.log("\n" + count + " pruebas OK");
