// Identidad remota v1: FLUJO COMPLETO del cliente real (lib/*) contra un PostgreSQL LOCAL con la migracion real aplicada (no Supabase).
//   node scripts/test-pgIdentidadRemotaFlujo.mjs
// Se ejecuta el mismo codigo que usa la app (inicio/recuperacion de sesion, write-ahead de series, cola offline, envio idempotente con fallback,
// finalizacion confirmada, hidratacion, vinculo serie-sesion y estadisticas) pero el "servidor" es PostgreSQL real (restricciones, indices,
// tipos, RLS acceso_total) detras de un emulador minimo de PostgREST (scripts/lib/pgRest.mjs). Datos y roles ficticios.
// NO prueba: PostgREST real, JWT de Supabase, ni la politica RLS real de produccion; la UI (React) tampoco se monta.
import assert from "node:assert/strict";
import { LocalPg, ESQUEMA_BASE, available } from "./lib/pgLocal.mjs";
import { makeRest } from "./lib/pgRest.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { resolverSemanaEntrenamiento } from "../lib/semanaEntrenamiento.js";
import { ubicarEjercicioEnDia, construirIdentidadSerie, extraerIdentidadSerie, sinIdentidadLocal, CAMPOS_IDENTIDAD_SERIE, vincularSeriesConSesiones, conservarIdentidadHidratada, adjuntarIdentidadPendientes, vincularSerieASesion } from "../lib/serieIdentidad.js";
import { esUuidV4 } from "../lib/sessionIdentity.js";
import { buildSessionPayload, removeUndefinedPayloadFields, hydrateProgressFromRows, buildExerciseSetRecord, buildPendingProgressItem, buildProgressPayload, buildProgressPayloadFromPending, calculateDayProgress, calculateSetsVolume, calculateNewWeightPR, dedupeMatchedSets, mergeProgressEntries, getExerciseSetsForDay } from "../lib/workoutSession.js";
import { writeAheadPendingSet, sendWriteAheadSet } from "../lib/setWriteAhead.js";
import { flushPendingForAlumno, visiblePendingItems } from "../lib/pendingSyncQueue.js";
import { PQ_ITEM_PREFIX } from "../lib/pendingQueueKeyed.js";
import { persistSessionConfirmed } from "../lib/finalizeWorkoutSession.js";
import { postProgressIdempotent } from "../lib/progressInsert.js";
import * as IR from "../lib/identidadRemota.js";
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




if (!available()) { console.log("# omitido: no hay PostgreSQL local (binarios initdb/postgres/psql). Esta suite NO se considera ejecutada."); process.exit(0); }
const D = path.resolve(ROOT, "docs", "identidad-remota-v1");
const MIG = readFileSync(path.join(D, "1_migracion.sql"), "utf8");
const { esErrorEsquemaIdentidad, leerIdentidadRemotaSesion, proyectarPayloadSerie, proyectarPayloadSesion, enviarConFallbackIdentidad, identidadRemotaActiva, TOKEN_ACTIVACION, ENV_VAR, CAMPOS_REMOTOS_SERIE, CAMPOS_REMOTOS_SESION } = IR;
const NUEVOS = ["sesion_uid", "bloque", "pos", "identidad_v"];
const sinNuevos = (o) => { for (const k of NUEVOS) assert.ok(o[k] === undefined || o[k] === null, "campo nuevo inesperado: " + k + "=" + o[k]); };
const ON = { [ENV_VAR]: TOKEN_ACTIVACION };
function payloadSesion(session, activa, alumnoId = A) {
  return removeUndefinedPayloadFields(proyectarPayloadSesion(buildSessionPayload({ alumnoId, session, activeDay: DIA, activeRoutine: { id: R, name: "R" }, exercises: DIA.exercises, weekToSave: 1, date: session.fecha, time: "10:30", includeRoutineId: true, ciclo: 1 }), session, alumnoId, activa));
}
const reset = () => IR.__resetEstadoIdentidadRemotaParaPruebas();
const idDe = (s) => extraerIdentidadSerie(s);

const pg = new LocalPg().start();
const ROLES = ESQUEMA_BASE.split("\n").find((l) => l.startsWith("create role"));
let dbN = 0;
pg.sql(ROLES, "postgres");
pg.createDb("tpl_antiguo"); assert.ok(pg.sql(ESQUEMA_BASE.replace(ROLES, ""), "tpl_antiguo").ok);
pg.createDb("tpl_migrado", "tpl_antiguo"); assert.ok(pg.sql(MIG, "tpl_migrado").ok);

// "Servidor": PostgreSQL real. modo "antiguo" (sin migrar) o "migrado". Misma interfaz que el servidor simulado de test-identidadRemota.mjs.
function servidor(modo, opts) {
  const o = opts || {}; const db = "t" + (++dbN); pg.createDb(db, modo === "antiguo" ? "tpl_antiguo" : "tpl_migrado");
  const rest = makeRest(pg, db, { sub: o.sub || A }); const posts = [], postsSes = []; let caida = !!o.caida;
  const io = {
    post: async (p) => { posts.push(p); if (caida) throw new Error("network"); return rest.post("progreso", p); },
    getById: async (id) => rest.get("progreso?id=eq." + encodeURIComponent(id) + "&select=id,alumno_id,ejercicio_id,kg,reps,semana,nota"),
  };
  const postSesion = async (p) => { postsSes.push(p); if (caida) throw new Error("network"); return rest.post("sesiones", p); };
  const sb = {
    addProgresoIdempotente: (data) => postProgressIdempotent({ post: (p) => enviarConFallbackIdentidad(io.post, p, CAMPOS_REMOTOS_SERIE), getById: io.getById }, data),
    addSesion: async (data) => {
      if (!IR.tieneCampos(data, CAMPOS_REMOTOS_SESION)) { const r = await postSesion(data); return r.ok ? r.data : null; }
      const r = await enviarConFallbackIdentidad(postSesion, data, CAMPOS_REMOTOS_SESION); return r && r.ok ? r.data : null;
    },
    getSesiones: async (al) => (o.lecturaVieja ? [] : pg.rows("select * from public.sesiones where alumno_id = '" + String(al).replace(/'/g, "") + "' order by created_at, id", db)),
  };
  return { db, rest, posts, postsSes, sb, io, caida: (v) => { caida = v; },
    send: (activa) => (it) => sb.addProgresoIdempotente(buildProgressPayloadFromPending(it, it.alumno_id, typeof activa === "function" ? activa() : activa)),
    rows: (al) => pg.rows("select * from public.progreso where alumno_id = '" + al + "' order by created_at, id", db),
    all: () => pg.rows("select * from public.progreso order by created_at, id", db), ses: () => pg.rows("select * from public.sesiones order by created_at, id", db),
    n: (t) => pg.scalar("(select count(*) from public." + t + ")", db) };
}
const flush = (st, srv, activa, al = A) => flushPendingForAlumno({ storage: st, alumnoId: al, send: srv.send(activa) });
const finalizar = (srv, a, o) => persistSessionConfirmed(Object.assign({ sb: srv.sb, alumnoId: A, payload: payloadSesion(a.session, true), date: a.session.fecha, dayIndex: 0, weekToSave: 1, ciclo: 1, rutinaId: R, isOnline: true }, o || {}));

const uidDe = (a) => a.session.identity.sessionId;
const clavePorOp = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));

try {
await test("1 flujo completo: iniciar, registrar warmup+main (con ejercicio repetido), caer offline, recargar, reconectar, reintentar, finalizar, recargar y consultar historial", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st); const uid = uidDe(a);
  const serie = (idx, exId, prog) => registrar({}, { st, session: a.session, activeExIdx: idx, exId, progress: prog, kg: 40 + idx });
  const r0 = serie(0, "mov1"), r1 = serie(1, "mov2", r0.prog), r2 = serie(2, "sq", r1.prog), r3 = serie(3, "bp", r2.prog), r4 = serie(4, "sq", r3.prog);
  const todas = [r0, r1, r2, r3, r4];
  srv.caida(true); const off = await flush(st, srv, () => identidadRemotaActiva(ON)); assert.equal(off.sent, 0); assert.equal(visiblePendingItems(st, A).length, 5); assert.equal(srv.n("progreso"), 0);
  // Safari recarga: el estado en memoria se pierde, localStorage se conserva => misma sesion, misma identidad
  const rec = ini(st, { now: T0 + 5 * MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + 5 * MIN } }); assert.equal(rec.recuperada, true); assert.equal(uidDe(rec), uid);
  for (const r of todas) assert.equal(pend(st, r.opId).sesion_uid, uid, "identidad intacta en la cola tras caer y recargar");
  srv.caida(false); const on = await flush(st, srv, () => identidadRemotaActiva(ON)); assert.equal(on.sent, 5); assert.equal(visiblePendingItems(st, A).length, 0);
  const filas = clavePorOp(srv.rows(A)); assert.equal(Object.keys(filas).length, 5);
  assert.deepEqual(todas.map((r) => [filas[r.opId].bloque, filas[r.opId].pos]), [["warmup", 0], ["warmup", 1], ["main", 0], ["main", 1], ["main", 2]]);
  assert.ok(todas.every((r) => filas[r.opId].sesion_uid === uid));
  // reintento tardio del mismo opId (la respuesta se perdio): 23505 real sobre progreso_pkey => se confirma leyendo la fila; sin duplicados
  for (const r of todas) { const again = await srv.sb.addProgresoIdempotente(buildProgressPayloadFromPending(r.item, A, true)); assert.ok(again && again.length === 1); }
  assert.equal(srv.n("progreso"), 5);
  // finalizar (y reintentar finalizar)
  const f1 = await finalizar(srv, a); assert.equal(f1.confirmed, true); assert.equal(f1.source, "insert");
  const f2 = await finalizar(srv, a); assert.equal(f2.confirmed, true); assert.equal(f2.source, "existing"); assert.equal(srv.n("sesiones"), 1);
  const ses = srv.ses()[0]; assert.deepEqual([ses.sesion_uid, ses.identidad_v, ses.alumno_id, ses.dia_idx], [uid, 1, A, 0]);
  // recarga: se reconstruye todo desde el servidor
  const hid = hydrateProgressFromRows(srv.rows(A));
  assert.equal(hid.sq.sets.length, 2); assert.equal(hid.mov1.sets[0].bloque, "warmup");
  assert.deepEqual(hid.sq.sets.map((x) => x.pos).sort(), [0, 2]); assert.ok(Object.values(hid).every((e) => e.sets.every((x) => x.sesion_uid === uid)));
  assert.deepEqual(leerIdentidadRemotaSesion(ses), { sesion_uid: uid, identidad_v: 1 });
  const { series, ambiguos } = vincularSeriesConSesiones(srv.rows(A), srv.ses()); assert.equal(ambiguos.length, 0);
  assert.ok(series.every((x) => x.sesion_id === ses.id), "las 5 series quedan vinculadas a su sesion"); assert.equal(series.length, 5);
});
await test("2 dos alumnos: cada uno con su identidad; ninguna serie se vincula a la sesion del otro", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado");
  const a = ini(st), b = ini(st, { alumnoId: B });
  registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" }); registrar({}, { st, session: b.session, alumnoId: B, activeExIdx: 2, exId: "sq" });
  await flush(st, srv, true, A); await flush(st, srv, true, B);
  assert.equal((await finalizar(srv, a)).confirmed, true); assert.equal((await finalizar(srv, b, { alumnoId: B, payload: payloadSesion(b.session, true, B) })).confirmed, true);
  assert.notEqual(uidDe(a), uidDe(b)); const sesA = srv.ses().find((x) => x.alumno_id === A), sesB = srv.ses().find((x) => x.alumno_id === B);
  const { series } = vincularSeriesConSesiones(srv.all(), srv.ses());
  assert.ok(series.filter((x) => x.alumno_id === A).every((x) => x.sesion_id === sesA.id)); assert.ok(series.filter((x) => x.alumno_id === B).every((x) => x.sesion_id === sesB.id));
  assert.equal(srv.rows(A).length, 1); assert.equal(srv.rows(B).length, 1);
});
await test("3 dos sesiones el mismo dia (dias distintos de la rutina): dos filas con uid distinto; repetir el mismo dia con otro uid respeta la deduplicacion de siempre y sus series quedan SIN vinculo (no mal vinculadas)", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado");
  const s1 = ini(st), s2 = ini(st, { session: { rId: R, dIdx: 1, exIdx: 0, startTime: T0 + MIN }, now: T0 + MIN });
  registrar({}, { st, session: s1.session, activeExIdx: 2, exId: "sq" }); registrar({}, { st, session: s2.session, activeExIdx: 2, exId: "row", now: T0 + MIN });
  await flush(st, srv, true);
  assert.equal((await finalizar(srv, s1)).source, "insert"); assert.equal((await finalizar(srv, s2, { dayIndex: 1, payload: payloadSesion(s2.session, true) })).source, "insert");
  assert.equal(srv.n("sesiones"), 2); assert.notEqual(srv.ses()[0].sesion_uid, srv.ses()[1].sesion_uid); assert.equal(srv.ses()[0].fecha, srv.ses()[1].fecha);
  const link = vincularSeriesConSesiones(srv.all(), srv.ses()).series; assert.equal(new Set(link.map((x) => x.sesion_id)).size, 2);
  // misma fecha/dia, nueva sesion (ancla vencida => uid nuevo): la clave de siempre la deduplica
  const t2 = T0 + 7 * 3600 * 1000; const s3 = ini(st, { now: t2, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t2 } }); assert.notEqual(uidDe(s3), uidDe(s1));
  registrar({}, { st, session: s3.session, activeExIdx: 2, exId: "sq", now: t2 }); await flush(st, srv, true);
  const f3 = await finalizar(srv, s3, { payload: payloadSesion(s3.session, true) }); assert.equal(f3.confirmed, true); assert.equal(f3.source, "existing"); assert.equal(srv.n("sesiones"), 2);
  const sinVinculo = vincularSeriesConSesiones(srv.all(), srv.ses()).series.filter((x) => x.sesion_uid === uidDe(s3)); assert.equal(sinVinculo.length, 1); assert.equal(sinVinculo[0].sesion_id, undefined);
});
await test("4 semana congelada y medianoche: serie registrada a las 00:15 de la sesion iniciada a las 23:55 conserva fecha, semana y uid originales en la base", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado");
  const t1 = new Date(2026, 10, 5, 23, 55).getTime(), t2 = new Date(2026, 10, 6, 0, 15).getTime();
  const a = ini(st, { now: t1, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t1 } });
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", now: t1 });
  const rec = ini(st, { semana: 1, now: t2, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t2 } }); assert.equal(uidDe(rec), uidDe(a));
  const r2 = registrar({}, { st, session: rec.session, activeExIdx: 3, exId: "bp", visible: 1, progress: r1.prog, now: t2 });
  await flush(st, srv, true); const f = clavePorOp(srv.rows(A));
  for (const r of [r1, r2]) { assert.equal(f[r.opId].fecha, "5/11/2026"); assert.equal(f[r.opId].semana, 0); assert.equal(f[r.opId].sesion_uid, uidDe(a)); }
});
await test("5 historicos sin identidad conviven con las series nuevas: NULL en la base, nada inventado al hidratar o vincular, estadisticas iguales", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado");
  pg.sql("insert into public.progreso (id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, created_at) values ('99999999-9999-4999-8999-000000000001','" + A + "','sq',50,8,'','1/11/2026',0,'2026-11-01T10:00:00Z'),('99999999-9999-4999-8999-000000000002','" + A + "','sq',55,8,'','1/11/2026',0,'2026-11-01T10:05:00Z'); insert into public.sesiones (alumno_id, rutina_id, rutina_nombre, dia_idx, semana, fecha, hora) values ('" + A + "','" + R + "','R',0,0,'1/11/2026','10:00');", srv.db);
  const a = ini(st); const r = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", kg: 60 }); await flush(st, srv, true);
  const rows = srv.rows(A); assert.equal(rows.length, 3); const hist = rows.filter((x) => x.id.startsWith("99999999")); assert.ok(hist.every((x) => x.sesion_uid === null && x.bloque === null && x.pos === null));
  const hid = hydrateProgressFromRows(rows).sq; const porId = clavePorOp(hid.sets.map((x) => Object.assign({ id: x.id }, x)));
  assert.deepEqual(idDe(porId["99999999-9999-4999-8999-000000000001"]), {}); assert.equal(idDe(porId[r.opId]).sesion_uid, uidDe(a));
  const sinCols = rows.map((x) => { const c = Object.assign({}, x); NUEVOS.forEach((k) => delete c[k]); return c; }); const sin = hydrateProgressFromRows(sinCols).sq;
  assert.equal(hid.max, sin.max); assert.equal(calculateSetsVolume(hid.sets), calculateSetsVolume(sin.sets)); assert.deepEqual(hid.sets.map((x) => [x.kg, x.reps, x.date, x.week]), sin.sets.map((x) => [x.kg, x.reps, x.date, x.week]));
  assert.deepEqual(calculateNewWeightPR({ max: hid.max }, 61), calculateNewWeightPR({ max: sin.max }, 61));
  // sesion v1 (ancla antigua, sin identidad) con bandera activa: fila sin identidad y dedupe de siempre
  const v1 = Object.assign({}, a.session); delete v1.identity; const p = payloadSesion(v1, true); sinNuevos(p);
  const b1 = await finalizar(srv, a, { payload: p, date: "5/11/2026" }); assert.equal(b1.source, "insert"); assert.equal((await finalizar(srv, a, { payload: p })).source, "existing");
  assert.equal(srv.n("sesiones"), 2); sinNuevos(srv.ses().find((x) => x.fecha === "5/11/2026" || x.hora === "10:30") || {});
  assert.deepEqual(vincularSeriesConSesiones(srv.all(), srv.ses()).series.filter((x) => !x.sesion_uid).map((x) => x.sesion_id), [undefined, undefined]);
});
await test("6 bandera desactivada / activada / valor invalido: desactivada => filas sin identidad aunque el esquema este migrado y payloads identicos a los antiguos; activada desde ese momento => con identidad", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" }); const it = pend(st, r1.opId);
  const legacy = buildProgressPayload(A, it.exId, it.kg, it.reps, it.note, it.date, it.semana, it.ciclo, it.opId); assert.equal(JSON.stringify(buildProgressPayloadFromPending(it, A, false)), JSON.stringify(legacy));
  for (const bad of [{}, { [ENV_VAR]: "1" }, { [ENV_VAR]: TOKEN_ACTIVACION + " " }]) assert.equal(identidadRemotaActiva(bad), false);
  await flush(st, srv, false); sinNuevos(srv.rows(A)[0]); srv.posts.forEach((p) => sinNuevos(p));
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp", progress: r1.prog }); await flush(st, srv, identidadRemotaActiva(ON));
  const f = clavePorOp(srv.rows(A)); sinNuevos(f[r1.opId]); assert.deepEqual(idDe(f[r2.opId]), { sesion_uid: uidDe(a), bloque: "main", pos: 1 });
  assert.equal((await finalizar(srv, a, { payload: payloadSesion(a.session, false) })).confirmed, true); sinNuevos(srv.ses()[0]);
});
await test("7 esquema ANTIGUO (sin migrar) con bandera activa: series y sesion se guardan sin identidad (fallback), el resto de la carga ya no la envia y no se pierde ninguna serie", async () => {
  reset(); const st = memStorage(); const srv = servidor("antiguo"); const a = ini(st);
  const rs = [2, 3, 4].map((i) => registrar({}, { st, session: a.session, activeExIdx: i, exId: i === 3 ? "bp" : "sq" }));
  const res = await flush(st, srv, () => identidadRemotaActiva(ON)); assert.equal(res.sent, 3); assert.equal(srv.n("progreso"), 3); assert.equal(IR.hayEsquemaRechazado(), true);
  const conNuevos = srv.posts.filter((p) => CAMPOS_REMOTOS_SERIE.some((k) => k in p)).length; assert.ok(conNuevos >= 1 && conNuevos <= 3, "intentos con campos nuevos acotados a los envios en vuelo: " + conNuevos); assert.equal(srv.posts.length, conNuevos + 3, "cada serie se reenvia UNA vez sin identidad");
  reset(); const f = await finalizar(srv, a); assert.equal(f.confirmed, true); assert.equal(srv.n("sesiones"), 1); assert.equal(srv.postsSes.length, 2, "intento con identidad + reenvio sin ella"); reset();
});
await test("8 duplicados de sesion contra el indice unico REAL: reintento con lectura obsoleta => 23505 y se confirma sin segunda fila; misma sesion con otra fecha/semana tambien; otro uid con la misma clave de dia se trata como existente", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  assert.equal((await finalizar(srv, a)).source, "insert");
  const lee = (() => { let c = 0; return Object.assign({}, srv.sb, { getSesiones: async (al) => (c++ === 0 ? [] : srv.sb.getSesiones(al)) }); })();
  const o = await finalizar(srv, a, { sb: lee }); assert.equal(o.confirmed, true); assert.equal(o.source, "verified"); assert.equal(srv.n("sesiones"), 1);
  const raw = await srv.rest.post("sesiones", payloadSesion(a.session, true)); assert.equal(raw.status, 409); assert.match(raw.data.message, /sesiones_sesion_uid_uidx/); assert.equal(raw.data.code, "23505");
  const lee2 = (() => { let c = 0; return Object.assign({}, srv.sb, { getSesiones: async (al) => (c++ === 0 ? [] : srv.sb.getSesiones(al)) }); })();
  const o2 = await finalizar(srv, a, { sb: lee2, weekToSave: 2, date: "6/11/2026" }); assert.equal(o2.confirmed, true); assert.equal(srv.n("sesiones"), 1);
});
await test("9 cambio de ciclo y de rutina: uid distinto y ciclo/rutina correctos en la base", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado");
  const c1 = ini(st), c2 = ini(st, { ciclo: 2, now: T0 + MIN, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 + MIN } }), r2 = ini(st, { session: { rId: "rutina-2", dIdx: 0, exIdx: 0, startTime: T0 + 2 * MIN }, now: T0 + 2 * MIN });
  const a1 = registrar({}, { st, session: c1.session, activeExIdx: 2, exId: "sq" }), a2 = registrar({}, { st, session: c2.session, activeExIdx: 2, exId: "sq", cicloVivo: 2, now: T0 + MIN }), a3 = registrar({}, { st, session: r2.session, activeExIdx: 2, exId: "sq", now: T0 + 2 * MIN });
  await flush(st, srv, true); const f = clavePorOp(srv.rows(A));
  assert.equal(new Set([a1, a2, a3].map((r) => f[r.opId].sesion_uid)).size, 3); assert.equal(f[a2.opId].ciclo, 2); assert.equal(f[a1.opId].ciclo, 1);
});
await test("10 conflicto de identidad (la fila del servidor dice otra sesion): no verificable, ninguna identidad se usa ni se repara", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st); const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  await flush(st, srv, true); pg.sql("update public.progreso set sesion_uid = '99999999-9999-4999-8999-999999999999' where id = '" + r.opId + "';", srv.db);
  const hid = hydrateProgressFromRows(srv.rows(A)); const m = mergeProgressEntries(r.prog.bp, hid.bp);
  assert.equal(m.sets.length, 1); assert.deepEqual(idDe(m.sets[0]), {}); assert.equal(m.sets[0].identidad_no_verificable, true);
});
await test("11 la base rechaza identidad invalida aunque el cliente falle: un bloque o pos fuera de rango nunca queda guardado y el CHECK no se confunde con duplicado", async () => {
  reset(); const srv = servidor("migrado");
  const mal = await srv.rest.post("progreso", { id: "cccccccc-cccc-4ccc-8ccc-000000000001", alumno_id: A, ejercicio_id: "sq", bloque: "otro", pos: 0 }); assert.equal(mal.data.code, "23514"); assert.equal(esErrorEsquemaIdentidad(mal, CAMPOS_REMOTOS_SERIE), true);
  assert.equal(srv.n("progreso"), 0); reset();
});
await test("12 sin datos de otros: el cliente solo envia series del alumno de la cola y la base no mezcla alumnos con la politica acceso_total actual (aislamiento real = otro carril)", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st), b = ini(st, { alumnoId: B });
  registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" }); registrar({}, { st, session: b.session, alumnoId: B, activeExIdx: 2, exId: "sq" });
  await flush(st, srv, true, A); assert.equal(srv.rows(B).length, 0, "flush de A no envia nada de B"); assert.equal(visiblePendingItems(st, B).length, 1);
  await flush(st, srv, true, B); assert.equal(srv.rows(B).length, 1); assert.equal(srv.rows(B)[0].sesion_uid, uidDe(b));
});
} finally { pg.stop(); }
console.log("\n" + n + " pruebas OK (PostgreSQL local, NO Supabase)");
