// SessionIdentity PR-4: identidad LOCAL de la serie (sesion_uid, bloque, pos). Integracion: registro -> it_pq/it_pg -> reintento -> flush -> payload remoto.
//   node scripts/test-identidadSerieLocal.mjs   (datos ficticios, sin red, almacenamiento en memoria)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { resolverSemanaEntrenamiento } from "../lib/semanaEntrenamiento.js";
import { ubicarEjercicioEnDia, construirIdentidadSerie, extraerIdentidadSerie, sinIdentidadLocal, CAMPOS_IDENTIDAD_SERIE } from "../lib/serieIdentidad.js";
import { esUuidV4 } from "../lib/sessionIdentity.js";
import { buildExerciseSetRecord, buildPendingProgressItem, buildProgressPayload, buildProgressPayloadFromPending, calculateDayProgress, calculateSetsVolume, calculateNewWeightPR, dedupeMatchedSets, mergeProgressEntries, getExerciseSetsForDay } from "../lib/workoutSession.js";
import { writeAheadPendingSet, sendWriteAheadSet } from "../lib/setWriteAhead.js";
import { flushPendingForAlumno, visiblePendingItems } from "../lib/pendingSyncQueue.js";
import { PQ_ITEM_PREFIX } from "../lib/pendingQueueKeyed.js";
import { updateProgressEntryWithSessionContext } from "../components/student-plan/studentWorkoutState.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const memStorage = (opts) => {
  const m = new Map(); const o = opts || {};
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => { if (o.failGet && o.failGet(k)) throw new Error("SecurityError"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (o.failSet && o.failSet(k)) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } m.set(k, String(v)); },
    removeItem: (k) => m.delete(k), keys: () => [...m.keys()] };
};
const T0 = new Date(2026, 10, 5, 10, 0).getTime(); const MIN = 60000;
const A = "alumno-a", B = "alumno-b", R = "rutina-1";
const DIA = { label: "Dia 1", warmup: [{ id: "mov1" }, { id: "mov2" }], exercises: [{ id: "sq" }, { id: "bp" }, { id: "sq" }, { id: "row" }] };
const ini = (st, o) => prepararInicioEntrenamiento(Object.assign({ storage: st, alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 }, o || {}));
let opSeq = 0; const nuevoOp = () => "00000000-0000-4000-8000-" + String(++opSeq).padStart(12, "0");

// Replica de logSet (App.jsx): misma secuencia de funciones reales y mismos argumentos.
function registrar(ctx, p) {
  const { st, session, alumnoId = A, progress = {}, visible = 0, cicloVivo = 1, activeExIdx, exId, kg = 50, opId = nuevoOp(), now = T0, activeDay = DIA } = p;
  const r = resolverSemanaEntrenamiento({ session, semanaVisibleIdx: visible, cicloVivo, semanaLegadaIdx: visible, cicloLegado: cicloVivo });
  if (!r.ok) return { ok: false };
  const ubic = ubicarEjercicioEnDia(activeDay, activeExIdx);
  const idSerie = construirIdentidadSerie({ session, alumnoId, ubicacion: ubic });
  const newSet = Object.assign(buildExerciseSetRecord(kg, 8, session.fecha, r.semanaProgreso, "", null, r.ciclo), { id: opId });
  const item = buildPendingProgressItem(exId, kg, 8, "", session.fecha, r.semanaProgreso, r.ciclo, alumnoId, opId, idSerie);
  const wa = writeAheadPendingSet(st, item, now);
  if (!wa.ok) return { ok: false, wa };
  const prog = Object.assign({}, progress, { [exId]: updateProgressEntryWithSessionContext(progress[exId], newSet, session, idSerie) });
  return { ok: true, opId, item, prog, set: prog[exId].sets[0], idSerie };
}
const pend = (st, op) => JSON.parse(st.getItem(PQ_ITEM_PREFIX + op));
const META = CAMPOS_IDENTIDAD_SERIE;
const sinMeta = (o) => { for (const k of META) assert.equal(k in o, false, k + " no debe estar"); };

await test("1 serie principal con identidad v2: sesion_uid, bloque main, pos; en it_pq y en it_pg", () => {
  const st = memStorage(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" }); // 2 warmup + main[1]
  assert.ok(esUuidV4(a.session.identity.sessionId));
  assert.deepEqual(extraerIdentidadSerie(pend(st, r.opId)), { sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 1 });
  assert.equal(r.set.sesion_uid, a.session.identity.sessionId); assert.equal(r.set.bloque, "main"); assert.equal(r.set.pos, 1);
  assert.equal(r.set.session_rutina_id, R, "contexto previo conservado");
});
await test("2 serie de calentamiento: bloque warmup, pos dentro del bloque", () => {
  const st = memStorage(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 1, exId: "mov2" });
  assert.equal(r.item.bloque, "warmup"); assert.equal(r.item.pos, 1); assert.equal(r.set.bloque, "warmup");
});
await test("3 posicion correcta: la pos es del bloque (no del indice combinado) y ubicarEjercicioEnDia valida limites", () => {
  assert.deepEqual(ubicarEjercicioEnDia(DIA, 0), { bloque: "warmup", pos: 0 });
  assert.deepEqual(ubicarEjercicioEnDia(DIA, 2), { bloque: "main", pos: 0 });
  assert.deepEqual(ubicarEjercicioEnDia(DIA, 5), { bloque: "main", pos: 3 });
  for (const bad of [6, -1, 1.5, "1", null, undefined, NaN]) assert.equal(ubicarEjercicioEnDia(DIA, bad), null);
  assert.deepEqual(ubicarEjercicioEnDia({ exercises: [{ id: "x" }] }, 0), { bloque: "main", pos: 0 });
  assert.equal(ubicarEjercicioEnDia(null, 0), null);
});
await test("4 ejercicio repetido el mismo dia: el mismo ejercicio_id queda con pos distinta", () => {
  const st = memStorage(); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 4, exId: "sq", progress: r1.prog });
  assert.equal(r1.item.exId, r2.item.exId); assert.equal(r1.item.pos, 0); assert.equal(r2.item.pos, 2);
  assert.deepEqual(r2.prog.sq.sets.map((s) => s.pos), [2, 0]);
});
await test("5 dos sesiones distintas con el mismo ejercicio: sesion_uid distinto", () => {
  const st = memStorage(); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const st2 = memStorage(); const b = ini(st2, { now: T0 + 600 * MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 600 * MIN } });
  const r2 = registrar({}, { st: st2, session: b.session, activeExIdx: 2, exId: "sq" });
  assert.notEqual(r1.item.sesion_uid, r2.item.sesion_uid); assert.equal(r1.item.pos, r2.item.pos);
});
await test("6 dos alumnos en el mismo dispositivo: cada serie con la identidad de su sesion; no se mezcla el flush", async () => {
  const st = memStorage(); const a = ini(st); const b = ini(st, { alumnoId: B });
  const ra = registrar({}, { st, session: a.session, alumnoId: A, activeExIdx: 2, exId: "sq" });
  const rb = registrar({}, { st, session: b.session, alumnoId: B, activeExIdx: 2, exId: "sq" });
  assert.notEqual(ra.item.sesion_uid, rb.item.sesion_uid);
  assert.equal(ra.item.sesion_uid, a.session.identity.sessionId); assert.equal(rb.item.sesion_uid, b.session.identity.sessionId);
  // una identidad ajena nunca se asigna: sesion de A registrada como alumno B => sin sesion_uid
  assert.equal("sesion_uid" in construirIdentidadSerie({ session: a.session, alumnoId: B, ubicacion: { bloque: "main", pos: 0 } }), false);
  const enviados = []; const res = await flushPendingForAlumno({ storage: st, alumnoId: A, send: async (it) => { enviados.push(it); return [{ id: it.opId }]; } });
  assert.equal(res.sent, 1); assert.equal(enviados[0].opId, ra.opId);
  assert.equal(pend(st, rb.opId).sesion_uid, b.session.identity.sessionId, "pendiente de B intacto");
});
await test("7 recarga de Safari: la sesion recuperada conserva el sesion_uid; las series nuevas y previas comparten identidad", () => {
  const st = memStorage(); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const b = ini(st, { now: T0 + 30 * MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 30 * MIN } });
  assert.equal(b.recuperada, true);
  const r2 = registrar({}, { st, session: b.session, activeExIdx: 3, exId: "bp", now: T0 + 31 * MIN });
  assert.equal(r2.item.sesion_uid, r1.item.sesion_uid); assert.equal(r2.item.sesion_uid, a.session.identity.sessionId);
});
await test("8 semana congelada despues de recarga: sesion_uid y semana (progreso base 0) originales aunque la semana visible avanzo", () => {
  const st = memStorage(); const a = ini(st);
  const b = ini(st, { semana: 1, now: T0 + 30 * MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 30 * MIN } });
  const r = registrar({}, { st, session: b.session, visible: 1, activeExIdx: 2, exId: "sq" });
  assert.equal(r.item.sesion_uid, a.session.identity.sessionId); assert.equal(r.item.semana, 0); assert.equal(r.set.week, 0);
});
await test("9 cruza medianoche: sesion_uid y fecha originales; el pendiente conserva la fecha del inicio", () => {
  const t1 = new Date(2026, 10, 5, 23, 55).getTime(), t2 = new Date(2026, 10, 6, 0, 15).getTime();
  const st = memStorage(); const a = ini(st, { now: t1, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t1 } });
  const b = ini(st, { now: t2, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t2 } });
  const r = registrar({}, { st, session: b.session, activeExIdx: 2, exId: "sq", now: t2 });
  assert.equal(r.item.sesion_uid, a.session.identity.sessionId); assert.equal(r.item.date, "5/11/2026");
});
await test("10 cambio de ciclo: sesion nueva con otro sesion_uid y el ciclo vivo distinto no registra nada", () => {
  const st = memStorage(); const a = ini(st);
  const b = ini(st, { ciclo: 2, now: T0 + 30 * MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 30 * MIN } });
  assert.equal(b.recuperada, false); assert.notEqual(b.session.identity.sessionId, a.session.identity.sessionId);
  const r = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", cicloVivo: 2 });
  assert.equal(r.ok, false, "conflicto real de ciclo: no se guarda (como antes)");
  assert.equal(st.keys().filter((k) => k.startsWith(PQ_ITEM_PREFIX)).length, 0);
});
await test("11 registro pendiente sin conexion: queda en it_pq con identidad y el flush posterior lo envia sin ella", async () => {
  const st = memStorage(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 4, exId: "sq" });
  assert.equal(visiblePendingItems(st, A).length, 1);
  const payloads = [];
  const res = await flushPendingForAlumno({ storage: st, alumnoId: A, send: async (it) => { payloads.push(buildProgressPayloadFromPending(it, A)); return [{ id: it.opId }]; } });
  assert.equal(res.sent, 1); assert.equal(visiblePendingItems(st, A).length, 0);
  sinMeta(payloads[0]); assert.equal(payloads[0].id, r.opId);
});
await test("12 reintento sin cambiar metadatos: mismo opId reescribe pero conserva sesion_uid/bloque/pos del primer guardado", () => {
  const st = memStorage(); const a = ini(st); const op = nuevoOp();
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", opId: op });
  const antes = extraerIdentidadSerie(pend(st, op));
  // reintento con otra ubicacion/sesion (no deberia ocurrir): la identidad ya guardada no se modifica
  const otra = ini(memStorage(), { now: T0 + 700 * MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 700 * MIN } });
  registrar({}, { st, session: otra.session, activeExIdx: 4, exId: "sq", opId: op });
  assert.deepEqual(extraerIdentidadSerie(pend(st, op)), antes); assert.equal(pend(st, op).sesion_uid, r1.item.sesion_uid);
  // reintento identico
  registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", opId: op });
  assert.deepEqual(extraerIdentidadSerie(pend(st, op)), antes);
});
await test("13 registro legado sin identidad: no se inventa; un reintento con identidad no se la agrega; sigue sincronizando", async () => {
  const st = memStorage(); const a = ini(st); const op = nuevoOp();
  const legado = buildPendingProgressItem("sq", 50, 8, "", a.session.fecha, 0, 1, A, op);
  assert.equal(writeAheadPendingSet(st, legado, T0).ok, true); sinMeta(pend(st, op));
  registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", opId: op });
  sinMeta(pend(st, op));
  const enviados = [];
  const res = await flushPendingForAlumno({ storage: st, alumnoId: A, send: async (it) => { enviados.push(it); return [{ id: it.opId }]; } });
  assert.equal(res.sent, 1); assert.equal(enviados.length, 1);
  // serie local legada (sin campos) sigue funcionando en estadisticas / merge
  const s = buildExerciseSetRecord(50, 8, "5/11/2026", 0, "", null, 1);
  assert.deepEqual(extraerIdentidadSerie(s), {});
  assert.deepEqual(extraerIdentidadSerie({ bloque: "otro", pos: -1 }), {}, "bloque/pos invalidos no se copian");
});
await test("14 ancla v1 (sesion legada): sin sesion_uid inventado; bloque/pos solo con ubicacion real de la pantalla", () => {
  const st = memStorage();
  st.setItem("it_active_workout", JSON.stringify({ v: 1, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 0, startTime: T0, fecha: "5/11/2026" }));
  const b = ini(st, { now: T0 + 5 * MIN });
  assert.equal(b.legado, true); assert.equal("identity" in b.session, false);
  const r = registrar({}, { st, session: b.session, activeExIdx: 2, exId: "sq" });
  assert.equal("sesion_uid" in r.item, false); assert.equal("sesion_uid" in r.set, false);
  assert.equal(r.item.bloque, "main"); assert.equal(r.item.pos, 0, "la ubicacion si es real (la conoce la pantalla)");
  assert.equal(r.item.semana, 0);
  // identidad incoherente (otro dia / otra rutina) => sin sesion_uid
  const a = ini(memStorage());
  for (const s of [{ ...a.session, dIdx: 1 }, { ...a.session, rId: "otra" }, { ...a.session, identity: { ...a.session.identity, sessionId: "xyz" } }, { ...a.session, identity: undefined }]) {
    assert.equal("sesion_uid" in construirIdentidadSerie({ session: s, alumnoId: A, ubicacion: { bloque: "main", pos: 0 } }), false);
  }
});
await test("15 error de almacenamiento: sin cuota no se registra ni se guarda identidad parcial; el pendiente previo no se toca", () => {
  const st = memStorage({ failSet: (k) => k.startsWith(PQ_ITEM_PREFIX) }); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  assert.equal(r.ok, false); assert.equal(r.wa.reason, "quota");
  assert.equal(st.keys().filter((k) => k.startsWith(PQ_ITEM_PREFIX)).length, 0);
  // lectura fallida del pendiente existente al reintentar: se conserva (no se pierde la identidad)
  const st2 = memStorage(); const a2 = ini(st2); const op = nuevoOp();
  registrar({}, { st: st2, session: a2.session, activeExIdx: 2, exId: "sq", opId: op });
  const antes = st2.getItem(PQ_ITEM_PREFIX + op);
  const st3 = memStorage({ failGet: (k) => k === PQ_ITEM_PREFIX + op }); st3.setItem(PQ_ITEM_PREFIX + op, antes);
  const x = registrar({}, { st: st3, session: a2.session, activeExIdx: 4, exId: "sq", opId: op });
  assert.equal(x.ok, false); assert.equal(st3.keys().length, 1); 
});
await test("16 idempotencia por opId: una sola clave it_pq por opId; confirmada una vez no se vuelve a escribir; un solo POST", async () => {
  const st = memStorage(); const a = ini(st); const op = nuevoOp();
  registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", opId: op });
  registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", opId: op });
  assert.equal(st.keys().filter((k) => k.startsWith(PQ_ITEM_PREFIX)).length, 1);
  const posts = [];
  const send = () => { posts.push(1); return Promise.resolve([{ id: op }]); };
  const c = await sendWriteAheadSet({ storage: st, opId: op, send });
  assert.equal(c.confirmed, true); assert.equal(posts.length, 1);
  const otra = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", opId: op });
  assert.equal(otra.ok, false); assert.equal(otra.wa.reason, "already_confirmed");
});
await test("17 ausencia absoluta de los tres campos en payloads remotos (envio inmediato, flush y proyeccion)", async () => {
  const st = memStorage(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  assert.ok(META.every((k) => k in pend(st, r.opId)));
  const remotos = [];
  // envio inmediato (App.jsx: buildProgressPayload con los argumentos de la serie)
  remotos.push(buildProgressPayload(A, "bp", 50, 8, "", a.session.fecha, 0, 1, r.opId));
  // flush (App.jsx: buildProgressPayloadFromPending(item))
  await flushPendingForAlumno({ storage: st, alumnoId: A, send: async (it) => { remotos.push(buildProgressPayloadFromPending(it, A)); return [{ id: it.opId }]; } });
  // item contaminado a proposito: la proyeccion explicita lo deja fuera
  remotos.push(buildProgressPayloadFromPending(Object.assign({}, r.item, { sesion_uid: "x", bloque: "main", pos: 3, extra: 1 }), A));
  assert.equal(remotos.length, 3);
  for (const p of remotos) { sinMeta(p); assert.equal("extra" in p, false); }
  assert.deepEqual(remotos[0], remotos[1]); assert.deepEqual(remotos[1], remotos[2]);
  assert.deepEqual(Object.keys(remotos[0]).sort(), Object.keys(buildProgressPayload(A, "bp", 50, 8, "", a.session.fecha, 0, 1, r.opId)).sort());
  assert.deepEqual(sinIdentidadLocal({ a: 1, sesion_uid: "x", bloque: "main", pos: 0 }), { a: 1 });
  // payload identico al de antes de este PR para el mismo registro (sin identidad)
  const sinId = buildPendingProgressItem("bp", 50, 8, "", a.session.fecha, 0, 1, A, r.opId);
  assert.deepEqual(buildProgressPayloadFromPending(sinId, A), remotos[0]);
  // codigo: App.jsx no pasa la identidad a ninguna escritura remota ni a sb.*
  const app = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  assert.ok(app.includes("buildProgressPayloadFromPending(item, alumnoIdSync)"));
  assert.equal(/addProgresoIdempotente\([^)]*identidadSerie/.test(app), false);
  assert.equal(/sbFetch\([^)]*(sesion_uid|identidadSerie)/.test(app), false);
  for (const f of ["lib/supabase.js", "lib/progressPersist.js"]) { try { assert.equal(/sesion_uid/.test(readFileSync(path.join(ROOT, f), "utf8")), false); } catch (e) { if (e.code !== "ENOENT") throw e; } }
});
await test("18 compatibilidad con estadisticas actuales: los calculos dan lo mismo con y sin metadatos locales", () => {
  const st = memStorage(); const a = ini(st);
  let con = {}, sin = {};
  [["sq", 2, 100], ["sq", 4, 110], ["bp", 3, 80], ["mov1", 0, 20]].forEach(([ex, idx, kg]) => {
    const r = registrar({}, { st, session: a.session, progress: con, activeExIdx: idx, exId: ex, kg });
    con = r.prog;
    const s0 = buildExerciseSetRecord(kg, 8, a.session.fecha, 0, "", null, 1);
    sin = Object.assign({}, sin, { [ex]: updateProgressEntryWithSessionContext(sin[ex], Object.assign(s0, { id: r.opId }), a.session) });
  });
  const exs = [{ id: "sq" }, { id: "bp" }, { id: "mov1" }, { id: "row" }];
  assert.deepEqual(calculateDayProgress(exs, con, a.session.fecha, 0, { checkWeek: false, ciclo: 1 }), calculateDayProgress(exs, sin, a.session.fecha, 0, { checkWeek: false, ciclo: 1 }));
  assert.equal(calculateSetsVolume(con.sq.sets), calculateSetsVolume(sin.sq.sets));
  assert.equal(con.sq.max, sin.sq.max); assert.deepEqual(calculateNewWeightPR(con.sq, 120), calculateNewWeightPR(sin.sq, 120));
  assert.equal(getExerciseSetsForDay(con, "sq", a.session.fecha, 0, { checkWeek: false, ciclo: 1 }).length, 2);
  // deduplicacion historica intacta: empareja por id como antes; series legadas (sin campos) se fusionan igual
  const hid = [{ kg: 100, reps: 8, date: a.session.fecha, week: 0, note: "", rpe: null, ciclo: 1, id: con.sq.sets[1].id, created_at: "2026-11-05T13:00:00Z" }];
  assert.equal(dedupeMatchedSets(con.sq.sets, hid).length, dedupeMatchedSets(sin.sq.sets, hid).length);
  assert.equal(mergeProgressEntries(con.sq, { sets: hid, max: 100 }).sets.length, mergeProgressEntries(sin.sq, { sets: hid, max: 100 }).sets.length);
});
await test("cableado: App.jsx / WorkoutScreen / panel pasan ubicacion y construyen la identidad al registrar (no al renderizar)", () => {
  const app = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  assert.ok(/logSet = \(exId, kg, reps, note, rpe, weekOverride, opIdIntento, ubicacionEj\)/.test(app));
  assert.ok(app.includes("construirIdentidadSerie({ session: session, alumnoId: alumnoIdSync, ubicacion: ubicacionEj })"));
  assert.ok(app.includes("buildPendingProgressItem(exId, kg, reps, note, d, weekForSet, cicloForSet, alumnoIdSync, opId, identidadSerie)"));
  assert.ok(app.includes("updateProgressEntryWithSessionContext(prev[exId], newSet, session, identidadSerie)"));
  assert.ok(readFileSync(path.join(ROOT, "components/WorkoutScreen.jsx"), "utf8").includes("ubicacionEjercicio={ubicarEjercicioEnDia(activeDay, activeExIdx)}"));
  assert.ok(readFileSync(path.join(ROOT, "components/WorkoutExercisePanel.jsx"), "utf8").includes("currentWeek, opId, ubicacionEjercicio)"));
});
console.log("\n" + n + " pruebas OK");
