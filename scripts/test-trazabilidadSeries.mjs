// SessionIdentity PR-5: la identidad local de la serie (sesion_uid, bloque, pos) sobrevive a sincronizar e hidratar desde el servidor.
//   node scripts/test-trazabilidadSeries.mjs   (datos ficticios, servidor simulado en memoria, sin red)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { resolverSemanaEntrenamiento } from "../lib/semanaEntrenamiento.js";
import { ubicarEjercicioEnDia, construirIdentidadSerie, extraerIdentidadSerie, sinIdentidadLocal, CAMPOS_IDENTIDAD_SERIE, conservarIdentidadHidratada, adjuntarIdentidadPendientes, vincularSerieASesion } from "../lib/serieIdentidad.js";
import { esUuidV4 } from "../lib/sessionIdentity.js";
import { hydrateProgressFromRows, buildExerciseSetRecord, buildPendingProgressItem, buildProgressPayload, buildProgressPayloadFromPending, calculateDayProgress, calculateSetsVolume, calculateNewWeightPR, dedupeMatchedSets, mergeProgressEntries, getExerciseSetsForDay } from "../lib/workoutSession.js";
import { writeAheadPendingSet, sendWriteAheadSet } from "../lib/setWriteAhead.js";
import { flushPendingForAlumno, visiblePendingItems } from "../lib/pendingSyncQueue.js";
import { PQ_ITEM_PREFIX } from "../lib/pendingQueueKeyed.js";
import { buildPrescripcionSnapshot } from "../lib/prescripcionSnapshot.js";
import { compararPrescripcionEjecucion } from "../lib/prescripcionComparacion.js";
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


// Servidor simulado: guarda las filas que reciben los payloads REALES (buildProgressPayloadFromPending); upsert idempotente por id.
function servidor() {
  const filas = new Map(); const payloads = []; let t = Date.UTC(2026, 10, 5, 13, 0);
  return { filas, payloads,
    send: async (it) => { const p = buildProgressPayloadFromPending(it, it.alumno_id); payloads.push(p);
      if (!filas.has(p.id)) filas.set(p.id, Object.assign({ created_at: new Date(t += 1000).toISOString() }, p)); return [filas.get(p.id)]; },
    rows: (al) => [...filas.values()].filter((r) => r.alumno_id === al) };
}
const sync = (st, srv, al = A) => flushPendingForAlumno({ storage: st, alumnoId: al, send: srv.send });
const idDe = (s) => extraerIdentidadSerie(s);
const metaPorId = (prog, ex) => Object.fromEntries(prog[ex].sets.map((s) => [s.id, idDe(s)]));

await test("1-3 local -> Supabase -> hidratacion: se conservan sesion_uid, bloque y pos de la serie (por opId verificado)", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  await sync(st, srv);
  const hid = hydrateProgressFromRows(srv.rows(A));
  assert.deepEqual(idDe(hid.bp.sets[0]), {}, "la fila del servidor no trae identidad");
  const m = mergeProgressEntries(r.prog.bp, hid.bp);
  assert.equal(m.sets.length, 1, "sin duplicado");
  assert.deepEqual(idDe(m.sets[0]), { sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 1 });
  assert.ok(m.sets[0].created_at, "es la fila hidratada (con created_at)");
});
await test("4 pendiente -> reintento -> hidratacion: sin it_pg, el pendiente aun presente aporta la identidad (confirmacion perdida)", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  await srv.send(pend(st, r.opId)); // llego al servidor, pero la respuesta se perdio: el pendiente sigue
  const hid = hydrateProgressFromRows(srv.rows(A));
  const con = adjuntarIdentidadPendientes(hid, visiblePendingItems(st, A), A);
  assert.deepEqual(idDe(con.sq.sets[0]), { sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 0 });
  assert.deepEqual(idDe(hid.sq.sets[0]), {}, "no muta la entrada");
  await sync(st, srv); assert.equal(srv.filas.size, 1, "el reintento no duplica la fila");
  // tras confirmarse, ya no hay pendiente: sin it_pg no hay de donde recuperar => sin identidad (no se inventa)
  assert.deepEqual(idDe(adjuntarIdentidadPendientes(hid, visiblePendingItems(st, A), A).sq.sets[0]), {});
});
await test("5 dos series identicas pero distintas: cada una conserva su propia identidad; no se fusionan", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", progress: r1.prog });
  await sync(st, srv);
  const m = mergeProgressEntries(r2.prog.sq, hydrateProgressFromRows(srv.rows(A)).sq);
  assert.equal(m.sets.length, 2);
  assert.deepEqual(new Set(m.sets.map((s) => s.id)), new Set([r1.opId, r2.opId]));
  m.sets.forEach((s) => assert.deepEqual(idDe(s), { sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 0 }));
});
await test("6 ejercicio repetido el mismo dia: misma ejercicio_id, pos distinta tras hidratar", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 4, exId: "sq", progress: r1.prog });
  await sync(st, srv);
  const m = mergeProgressEntries(r2.prog.sq, hydrateProgressFromRows(srv.rows(A)).sq);
  assert.equal(m.sets.length, 2);
  assert.equal(metaPorId({ sq: m }, "sq")[r1.opId].pos, 0); assert.equal(metaPorId({ sq: m }, "sq")[r2.opId].pos, 2);
});
await test("7 dos sesiones del mismo alumno (mismo dia): sesion_uid distinto se conserva por serie", async () => {
  const st = memStorage(); const srv = servidor();
  const a = ini(st); const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const b = ini(st, { session: { rId: R, dIdx: 1, exIdx: 0, startTime: T0 + 5 * MIN }, now: T0 + 5 * MIN });
  const r2 = registrar({}, { st, session: b.session, activeExIdx: 2, exId: "sq", progress: r1.prog });
  await sync(st, srv);
  const m = mergeProgressEntries(r2.prog.sq, hydrateProgressFromRows(srv.rows(A)).sq);
  const uids = m.sets.map((s) => s.sesion_uid);
  assert.equal(new Set(uids).size, 2); assert.equal(m.sets.length, 2);
});
await test("8 dos alumnos en el mismo dispositivo: la identidad de A nunca se adjunta a filas de B ni al reves", async () => {
  const st = memStorage(); const srv = servidor();
  const a = ini(st); const b = ini(st, { alumnoId: B });
  const ra = registrar({}, { st, session: a.session, alumnoId: A, activeExIdx: 2, exId: "sq" });
  const rb = registrar({}, { st, session: b.session, alumnoId: B, activeExIdx: 2, exId: "sq" });
  await srv.send(pend(st, ra.opId)); await srv.send(pend(st, rb.opId));
  const hidB = hydrateProgressFromRows(srv.rows(B));
  const con = adjuntarIdentidadPendientes(hidB, visiblePendingItems(st, B), B);
  assert.equal(con.sq.sets.length, 1); assert.equal(con.sq.sets[0].sesion_uid, b.session.identity.sessionId);
  // pendientes de A ofrecidos al hidratar B: no coinciden por alumno/ids => nada
  assert.deepEqual(idDe(adjuntarIdentidadPendientes(hidB, [pend(st, ra.opId)], B).sq.sets[0]), {});
  // mismo opId pero alumno distinto en el pendiente
  const falso = Object.assign({}, pend(st, rb.opId), { alumno_id: A });
  assert.deepEqual(idDe(adjuntarIdentidadPendientes(hidB, [falso], B).sq.sets[0]), {});
});
await test("9-10 cambio de rutina / ciclo: series con valores identicos en otra rutina o ciclo no se confunden", async () => {
  const st = memStorage(); const srv = servidor();
  const a = ini(st); const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const b = ini(st, { session: { rId: "rutina-2", dIdx: 0, exIdx: 0, startTime: T0 + MIN }, now: T0 + MIN });
  const r2 = registrar({}, { st, session: b.session, activeExIdx: 2, exId: "sq", progress: r1.prog });
  const c = ini(st, { ciclo: 2, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 2 * MIN }, now: T0 + 2 * MIN });
  const r3 = registrar({}, { st, session: c.session, activeExIdx: 2, exId: "sq", progress: r2.prog, cicloVivo: 2 });
  await sync(st, srv);
  const m = mergeProgressEntries(r3.prog.sq, hydrateProgressFromRows(srv.rows(A)).sq);
  assert.equal(m.sets.length, 3);
  const meta = metaPorId({ sq: m }, "sq");
  assert.equal(new Set(Object.values(meta).map((x) => x.sesion_uid)).size, 3);
  assert.equal(meta[r1.opId].sesion_uid, a.session.identity.sessionId); assert.equal(meta[r3.opId].sesion_uid, c.session.identity.sessionId);
});
await test("11-12 semana congelada tras recarga y cruce de medianoche: la identidad hidratada es la de la sesion original", async () => {
  const t1 = new Date(2026, 10, 5, 23, 55).getTime(), t2 = new Date(2026, 10, 6, 0, 15).getTime();
  const st = memStorage(); const srv = servidor();
  const a = ini(st, { now: t1, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t1 } });
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "bp", now: t1 });
  const b = ini(st, { semana: 1, now: t2, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t2 } });
  assert.equal(b.recuperada, true); assert.equal(b.session.identity.sessionId, a.session.identity.sessionId);
  const r2 = registrar({}, { st, session: b.session, activeExIdx: 2, exId: "bp", progress: r1.prog, visible: 1, now: t2 });
  await sync(st, srv);
  const m = mergeProgressEntries(r2.prog.bp, hydrateProgressFromRows(srv.rows(A)).bp);
  assert.equal(m.sets.length, 2);
  m.sets.forEach((s) => { assert.equal(s.sesion_uid, a.session.identity.sessionId); assert.equal(s.week, 0); assert.equal(srv.filas.get(s.id).fecha, "5/11/2026"); });
});
await test("13-14 historicos sin identidad y ancla v1: nada se inventa al hidratar ni al combinar", async () => {
  const hid = [{ id: "11111111-1111-4111-8111-111111111111", ejercicio_id: "sq", kg: 50, reps: 8, fecha: "5/11/2026", semana: 0, nota: "", created_at: "2026-11-05T10:00:00Z" }];
  const h = hydrateProgressFromRows(hid);
  const localLegado = { sets: [{ kg: 50, reps: 8, date: "5/11/2026", week: 0, note: "", rpe: null }], max: 50 }; // sin id ni identidad
  const m = mergeProgressEntries(localLegado, h.sq);
  assert.equal(m.sets.length, 1); assert.deepEqual(idDe(m.sets[0]), {});
  const st = memStorage(); const v1 = ini(st, { session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 } });
  const legada = Object.assign({}, v1.session); delete legada.identity;
  const r = registrar({}, { st, session: legada, activeExIdx: 2, exId: "sq" });
  assert.equal("sesion_uid" in r.item, false);
  const srv = servidor(); await sync(st, srv);
  const m2 = mergeProgressEntries(r.prog.sq, hydrateProgressFromRows(srv.rows(A)).sq);
  assert.equal(m2.sets.length, 1); assert.equal(m2.sets[0].sesion_uid, undefined); assert.equal(m2.sets[0].bloque, "main", "bloque/pos reales del local si se conservan");
});
await test("15 coincidencias ambiguas: sin id coincidente, con valores distintos o con ids repetidos NO se asigna identidad", () => {
  const OP = "22222222-2222-4222-8222-222222222222";
  const loc = { id: OP, kg: 50, reps: 8, date: "5/11/2026", week: 0, note: "", sesion_uid: "33333333-3333-4333-8333-333333333333", bloque: "main", pos: 0 };
  const hidBase = { id: OP, kg: 50, reps: 8, date: "05/11/2026", week: 0, note: "", created_at: "2026-11-05T10:00:00Z" };
  assert.equal(conservarIdentidadHidratada(loc, hidBase).sesion_uid, loc.sesion_uid, "fecha normalizada: misma serie");
  assert.equal(conservarIdentidadHidratada(loc, Object.assign({}, hidBase, { id: undefined })).sesion_uid, undefined, "sin id: aproximado => no");
  assert.equal(conservarIdentidadHidratada(Object.assign({}, loc, { id: undefined }), hidBase).sesion_uid, undefined);
  for (const cambio of [{ kg: 55 }, { reps: 9 }, { week: 1 }, { note: "x" }, { date: "6/11/2026" }, { ciclo: 2 }]) {
    assert.equal(conservarIdentidadHidratada(Object.assign({}, loc, { ciclo: 1 }), Object.assign({}, hidBase, { ciclo: 1 }, cambio)).sesion_uid, undefined, JSON.stringify(cambio));
  }
  const conf = conservarIdentidadHidratada(loc, Object.assign({}, hidBase, { sesion_uid: "99999999-9999-4999-8999-999999999999", bloque: "warmup", pos: 1 }));
  assert.deepEqual(idDe(conf), {}, "PR-6: identidades contradictorias => ninguna es confiable"); assert.equal(conf.identidad_no_verificable, true);
  const iguales = conservarIdentidadHidratada(loc, Object.assign({}, hidBase, { sesion_uid: loc.sesion_uid }));
  assert.equal(iguales.sesion_uid, loc.sesion_uid, "la del servidor consistente se conserva");
  // mismas firmas sin id: dos locales identicos con identidad distinta y UN solo hidratado => no se atribuye a ninguno
  const l1 = { kg: 50, reps: 8, date: "5/11/2026", week: 0, note: "", sesion_uid: "a", bloque: "main", pos: 0 };
  const l2 = Object.assign({}, l1, { pos: 2 });
  const hid = { kg: 50, reps: 8, date: "5/11/2026", week: 0, note: "", created_at: "2026-11-05T10:00:00Z" };
  const m = dedupeMatchedSets([l1, l2], [hid]);
  assert.equal(m.length, 2); assert.equal(m.filter((s) => s.created_at).length, 1);
  assert.deepEqual(idDe(m.find((s) => s.created_at)), {});
  // ids repetidos entre locales (dato corrupto): ambiguo
  const m2 = dedupeMatchedSets([loc, Object.assign({}, loc, { pos: 1 })], [hidBase]);
  assert.deepEqual(idDe(m2.find((s) => s.created_at)), {});
  // pendientes con opId repetido / filas con id repetido
  const dupPend = [{ opId: OP, alumno_id: A, exId: "sq", kg: 50, reps: 8, date: "5/11/2026", semana: 0, note: "", sesion_uid: loc.sesion_uid, bloque: "main", pos: 0 }];
  const progDup = { sq: { sets: [hidBase, Object.assign({}, hidBase)], max: 50 } };
  assert.deepEqual(idDe(adjuntarIdentidadPendientes(progDup, dupPend, A).sq.sets[0]), {});
  assert.deepEqual(idDe(adjuntarIdentidadPendientes({ sq: { sets: [hidBase], max: 50 } }, dupPend.concat(dupPend), A).sq.sets[0]), {});
  assert.deepEqual(idDe(adjuntarIdentidadPendientes({ bp: { sets: [hidBase], max: 50 } }, dupPend, A).bp.sets[0]), {}, "otro ejercicio");
});
await test("16 errores de localStorage: it_pq/it_pg intactos si falla la escritura; lectura fallida no rompe la hidratacion", async () => {
  const st = memStorage({ failSet: (k) => k.startsWith("it_pq:") }); const a = ini(memStorage());
  const r = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  assert.equal(r.ok, false);
  const st2 = memStorage({ failGet: () => true });
  const loc = { sets: [{ id: "44444444-4444-4444-8444-444444444444", kg: 50, reps: 8, date: "5/11/2026", week: 0, note: "", sesion_uid: "u", bloque: "main", pos: 0 }], max: 50 };
  const hid = hydrateProgressFromRows([{ id: "44444444-4444-4444-8444-444444444444", ejercicio_id: "sq", kg: 50, reps: 8, fecha: "5/11/2026", semana: 0, nota: "", created_at: "2026-11-05T10:00:00Z" }]);
  let pend2 = []; try { pend2 = visiblePendingItems(st2, A); } catch (e) { pend2 = []; }
  assert.equal(adjuntarIdentidadPendientes(hid, pend2, A).sq.sets.length, 1);
  assert.equal(mergeProgressEntries(loc, hid.sq).sets[0].sesion_uid, "u");
  assert.equal(adjuntarIdentidadPendientes(null, null, A), null); assert.equal(conservarIdentidadHidratada(null, null), null);
});
await test("17-18 respuestas del servidor duplicadas o fuera de orden: una fila por serie y la identidad por id, no por orden", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 4, exId: "sq", progress: r1.prog });
  await sync(st, srv);
  const filas = srv.rows(A);
  for (const orden of [filas, filas.slice().reverse(), filas.concat(filas.slice().reverse())]) {
    const m = mergeProgressEntries(r2.prog.sq, hydrateProgressFromRows(orden).sq);
    const meta = metaPorId({ sq: m }, "sq");
    assert.equal(meta[r1.opId] && meta[r1.opId].pos, 0, "r1 conserva pos 0");
    if (orden.length === filas.length) { assert.equal(m.sets.length, 2); assert.equal(meta[r2.opId].pos, 2); }
  }
});
await test("19 idempotencia por opId: reenviar y rehidratar varias veces es estable (mismo resultado, una fila)", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  await sync(st, srv); await srv.send(pend(st, r.opId) || Object.assign({}, r.item, { alumno_id: A })); await sync(st, srv);
  assert.equal(srv.filas.size, 1);
  let prog = r.prog;
  for (let i = 0; i < 3; i++) prog = Object.assign({}, prog, { bp: mergeProgressEntries(prog.bp, hydrateProgressFromRows(srv.rows(A)).bp) });
  assert.equal(prog.bp.sets.length, 1); assert.deepEqual(idDe(prog.bp.sets[0]), { sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 1 });
});
await test("20 payloads remotos sin metadatos nuevos y sin cambios de forma (claves exactas)", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  await sync(st, srv);
  srv.payloads.forEach((p) => { sinMeta(p); const permitidas = ["alumno_id", "ciclo", "ejercicio_id", "fecha", "id", "kg", "nota", "reps", "semana"]; Object.keys(p).forEach((k) => assert.ok(permitidas.includes(k), "campo inesperado " + k)); ["alumno_id", "ejercicio_id", "fecha", "id", "kg", "nota", "reps", "semana"].forEach((k) => assert.ok(k in p, k)); });
  const app = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  assert.ok(!/addProgreso\([^)]*(sesion_uid|bloque)/.test(app));
});
await test("21 estadisticas sin cambios: volumen, PR y conteos iguales con o sin identidad conservada", async () => {
  const st = memStorage(); const srv = servidor(); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", kg: 60 });
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 4, exId: "sq", kg: 70, progress: r1.prog });
  await sync(st, srv);
  const hid = hydrateProgressFromRows(srv.rows(A)).sq;
  const con = mergeProgressEntries(r2.prog.sq, hid);
  const sin = mergeProgressEntries({ sets: r2.prog.sq.sets.map((s) => { const c = Object.assign({}, s); META.forEach((k) => delete c[k]); return c; }), max: r2.prog.sq.max }, hid);
  const proy = (e) => e.sets.map((s) => [s.kg, s.reps, normalizeFechaT(s.date), s.week, s.id]);
  const normalizeFechaT = (f) => String(f).split("/").map((x) => x.padStart(2, "0")).join("/");
  assert.deepEqual(proy(con), proy(sin)); assert.equal(con.max, sin.max); assert.equal(con.sets.length, sin.sets.length);
  assert.equal(calculateSetsVolume(con.sets), calculateSetsVolume(sin.sets));
  assert.deepEqual(calculateNewWeightPR({ max: con.max }, 71), calculateNewWeightPR({ max: sin.max }, 71));
});
await test("22 prescripcion: adaptador de contrato futuro vincula por sesion_uid iguales y solo asi; sin el, la comparacion se bloquea", () => {
  const uid = "55555555-5555-4555-8555-555555555555";
  const ses = { id: "ses-9", sesion_uid: uid };
  const s = { sesion_uid: uid, bloque: "main", pos: 0, kg: 50 };
  assert.equal(vincularSerieASesion(s, ses).sesion_id, "ses-9");
  assert.equal(vincularSerieASesion(Object.assign({}, s, { sesion_uid: "otro" }), ses).sesion_id, undefined);
  assert.equal(vincularSerieASesion({ bloque: "main", pos: 0 }, ses).sesion_id, undefined);
  assert.equal(vincularSerieASesion(s, { id: "x" }).sesion_id, undefined);
  assert.equal(vincularSerieASesion(Object.assign({}, s, { sesion_id: "forzado" }), { id: "x" }).sesion_id, undefined, "no hereda un sesion_id ajeno");
  assert.equal(vincularSerieASesion(null, null).sesion_id, undefined);
  // contra el modulo real de comparacion: una serie sin sesion_id impide una comparacion "verificable"
  const rutina = { id: "r1", nombre: "R", alumno_id: A, datos: { semana_activa: 1, days: [{ label: "D", warmup: [], exercises: [{ id: "sq", name: "Sq", sets: "1", reps: "8", kg: "50" }] }] } };
  const snap = buildPrescripcionSnapshot({ rutina, alumnoId: A, diaIdx: 0, semana: 1, fecha: "05/11/2026", semanaMostrada: 1, capturadaEn: "2026-11-05T21:00:00.000Z" });
  assert.equal(snap.ok, true);
  const copia = { alumno_id: snap.clave.alumno_id, rutina_id: snap.clave.rutina_id, ciclo: snap.clave.ciclo, semana: snap.clave.semana, dia_idx: snap.clave.dia_idx, fecha_dia: snap.clave.fecha_dia, prescripcion_hash: snap.hash, snapshot: snap.snapshot, origen_lectura: "servidor" };
  const sesion = { id: "ses-9", alumno_id: A, rutina_id: "r1", ciclo: 1, semana: 1, dia_idx: 0, fecha: "05/11/2026", completada: true };
  const fila = { id: "p1", alumno_id: A, rutina_id: "r1", ciclo: 1, semana: 0, fecha: "05/11/2026", dia_idx: 0, ejercicio_id: "sq", kg: 50, reps: 8, bloque: "main", pos: 0 };
  const sinV = compararPrescripcionEjecucion({ sesion, copias: [copia], series: [Object.assign({ sesion_uid: uid }, fila)], contexto: { registroSeriesCompleto: true } });
  assert.equal(sinV.verificable, false, "sin sesion_id no hay comparacion");
  const conV = compararPrescripcionEjecucion({ sesion, copias: [copia], series: [vincularSerieASesion(Object.assign({ sesion_uid: uid }, fila), { id: "ses-9", sesion_uid: uid })], contexto: { registroSeriesCompleto: true } });
  assert.equal(conV.series.vinculadas, 1);
});
await test("cableado: App.jsx adjunta la identidad de pendientes al hidratar y el contrato no cambio payloads", () => {
  const app = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  assert.ok(app.includes("adjuntarIdentidadPendientes(hydrateProgressFromRows(progresoRows || []), pendIdent, sessionData.alumnoId)"));
  assert.ok(readFileSync(path.join(ROOT, "lib/workoutSession.js"), "utf8").includes("conservarIdentidadHidratada(locals[li], set)"));
});
console.log("\n" + n + " pruebas OK");
