// SessionIdentity PR-6: persistencia REMOTA de la identidad (desactivada por defecto): proyeccion, activacion, esquema antiguo/migrado, fallback, lectura.
//   node scripts/test-identidadRemota.mjs   (datos ficticios, servidor simulado en memoria, sin red)
import assert from "node:assert/strict";
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



const { proyectarPayloadSerie, proyectarPayloadSesion, enviarConFallbackIdentidad, identidadRemotaActiva, identidadRemotaDesdeEntorno, TOKEN_ACTIVACION, ENV_VAR, CAMPOS_REMOTOS_SERIE, CAMPOS_REMOTOS_SESION, leerIdentidadRemotaSerie, leerIdentidadRemotaSesion } = IR;
const NUEVOS = ["sesion_uid", "bloque", "pos", "identidad_v"];
const sinNuevos = (o) => { for (const k of NUEVOS) assert.equal(k in o, false, "campo nuevo inesperado: " + k); };
const ON = { [ENV_VAR]: TOKEN_ACTIVACION };
const colErr = (col, tabla) => ({ ok: false, status: 400, data: { code: "PGRST204", message: "Could not find the '" + col + "' column of '" + tabla + "' in the schema cache" } });

// Servidor simulado. modo "antiguo": rechaza columnas nuevas (PGRST204) como un esquema sin migrar. "migrado": las guarda.
function servidor(modo, opts) {
  const o = opts || {}; const prog = new Map(); const ses = []; const posts = []; const postsSes = []; let t = Date.UTC(2026, 10, 5, 13, 0); let caida = !!o.caida;
  const io = {
    post: async (p) => {
      posts.push(p);
      if (caida) throw new Error("network");
      if (modo === "antiguo") { const c = CAMPOS_REMOTOS_SERIE.find((k) => k in p); if (c) return colErr(c, "progreso"); }
      if (prog.has(p.id)) return { ok: false, status: 409, data: { code: "23505", details: "Key (id)=(" + p.id + ") already exists." } };
      const row = Object.assign({ created_at: new Date(t += 1000).toISOString() }, p); prog.set(p.id, row); return { ok: true, status: 201, data: [row] };
    },
    getById: async (id) => ({ ok: true, status: 200, data: prog.has(id) ? [prog.get(id)] : [] }),
  };
  const postSesion = async (p) => {
    postsSes.push(p);
    if (modo === "antiguo") { const c = CAMPOS_REMOTOS_SESION.find((k) => k in p); if (c) return colErr(c, "sesiones"); }
    if (p.sesion_uid && ses.some((s) => s.sesion_uid === p.sesion_uid)) return { ok: false, status: 409, data: { code: "23505", message: 'duplicate key value violates unique constraint "sesiones_sesion_uid_uidx"' } };
    const row = Object.assign({ id: "ses-" + (ses.length + 1), created_at: new Date(t += 1000).toISOString() }, p); ses.push(row); return { ok: true, status: 201, data: [row] };
  };
  // Mismo cableado que App.jsx: sin campos de identidad => POST de siempre; con ellos => fallback.
  const sb = {
    addProgresoIdempotente: (data) => postProgressIdempotent({ post: (p) => enviarConFallbackIdentidad(io.post, p, CAMPOS_REMOTOS_SERIE), getById: io.getById }, data),
    addSesion: async (data) => {
      if (!IR.tieneCampos(data, CAMPOS_REMOTOS_SESION)) { const r = await postSesion(data); return r.ok ? r.data : null; }
      const r = await enviarConFallbackIdentidad(postSesion, data, CAMPOS_REMOTOS_SESION); return r && r.ok ? r.data : null;
    },
    getSesiones: async () => (o.lecturaVieja ? [] : ses.slice()),
  };
  return { prog, ses, posts, postsSes, sb, io, caida: (v) => { caida = v; },
    send: (activa) => (it) => sb.addProgresoIdempotente(buildProgressPayloadFromPending(it, it.alumno_id, typeof activa === "function" ? activa() : activa)),
    rows: (al) => [...prog.values()].filter((r) => r.alumno_id === al) };
}
const flush = (st, srv, activa, al = A) => flushPendingForAlumno({ storage: st, alumnoId: al, send: srv.send(activa) });
const idDe = (s) => extraerIdentidadSerie(s);
const reset = () => IR.__resetEstadoIdentidadRemotaParaPruebas();

await test("1 esquema antiguo + bandera activa: la primera serie se guarda sin campos nuevos (fallback), el resto ya no los envia", async () => {
  reset(); const st = memStorage(); const srv = servidor("antiguo"); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp", progress: r1.prog });
  assert.equal(identidadRemotaActiva(ON), true);
  const res = await flush(st, srv, () => identidadRemotaActiva(ON)); // como App.jsx: se evalua en cada envio
  assert.equal(res.sent, 2, "las dos series quedaron confirmadas"); assert.equal(srv.prog.size, 2); assert.equal(visiblePendingItems(st, A).length, 0);
  srv.prog.forEach((row) => sinNuevos(row));
  assert.equal(IR.hayEsquemaRechazado(), true);
  assert.equal(identidadRemotaActiva(ON), false, "tras el rechazo ya no se intenta");
  const conNuevos = srv.posts.filter((p) => CAMPOS_REMOTOS_SERIE.some((k) => k in p)).length; assert.ok(conNuevos >= 1 && conNuevos <= 2, "intentos con campos nuevos acotados: " + conNuevos + " de " + srv.posts.length);
  reset();
});
await test("2 esquema migrado + bandera activa: el servidor guarda sesion_uid/bloque/pos de la serie", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  await flush(st, srv, identidadRemotaActiva(ON));
  const fila = srv.prog.get(r.opId);
  assert.deepEqual(idDe(fila), { sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 1 });
  assert.equal(IR.hayEsquemaRechazado(), false);
});
await test("3-5 bandera desactivada (o con valor distinto): payloads antiguos identicos byte a byte, aunque el item tenga identidad", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  const it = pend(st, r.opId); assert.ok(it.sesion_uid);
  const legacy = buildProgressPayload(A, it.exId, it.kg, it.reps, it.note, it.date, it.semana, it.ciclo, it.opId);
  for (const env of [{}, null, undefined, { [ENV_VAR]: "1" }, { [ENV_VAR]: "true" }, { [ENV_VAR]: "migracion-aplicada:otra" }, { [ENV_VAR]: TOKEN_ACTIVACION + " " }, { [ENV_VAR]: TOKEN_ACTIVACION.toUpperCase() }]) {
    assert.equal(identidadRemotaActiva(env), false);
    assert.equal(JSON.stringify(buildProgressPayloadFromPending(it, A, identidadRemotaActiva(env))), JSON.stringify(legacy));
  }
  assert.equal(JSON.stringify(buildProgressPayloadFromPending(it, A)), JSON.stringify(legacy), "sin tercer argumento = desactivado");
  assert.equal(proyectarPayloadSerie(legacy, idDe(it), false), legacy, "misma referencia: ni siquiera se copia");
  assert.equal(identidadRemotaDesdeEntorno(), false, "en Node/pruebas no hay import.meta.env: desactivada");
  await flush(st, srv, false); srv.posts.forEach(sinNuevos); srv.prog.forEach(sinNuevos);
});
await test("6 serie historica (sin identidad) con bandera activa: payload sin campos nuevos", () => {
  reset(); const hist = { exId: "sq", kg: 50, reps: 8, note: "", date: "5/11/2026", semana: 0, alumno_id: A, opId: nuevoOp() };
  sinNuevos(buildProgressPayloadFromPending(hist, A, true));
  assert.deepEqual(identidadSerieRemotaDe({ bloque: "main" }), {}, "bloque sin pos no se envia");
  assert.deepEqual(identidadSerieRemotaDe({ pos: 3 }), {}); assert.deepEqual(identidadSerieRemotaDe({ sesion_uid: "no-uuid", bloque: "main", pos: 1 }), { bloque: "main", pos: 1 });
  assert.deepEqual(identidadSerieRemotaDe({ sesion_uid: "33333333-3333-4333-8333-333333333333", bloque: "main", pos: 40000 }), { sesion_uid: "33333333-3333-4333-8333-333333333333" }, "smallint");
});
function identidadSerieRemotaDe(x) { return IR.identidadSerieRemota(x); }
function payloadSesion(session, activa, alumnoId = A) {
  return removeUndefinedPayloadFields(proyectarPayloadSesion(buildSessionPayload({ alumnoId, session, activeDay: DIA, activeRoutine: { id: R, name: "R" }, exercises: DIA.exercises, weekToSave: 1, date: session.fecha, time: "10:30", includeRoutineId: true, ciclo: 1 }), session, alumnoId, activa));
}
await test("7-8 sesion v1 sin UUID y sesion v2: solo la v2 lleva sesion_uid + identidad_v (con bandera); sin bandera, ninguna", () => {
  const st = memStorage(); const a = ini(st); const v1 = Object.assign({}, a.session); delete v1.identity;
  sinNuevos(payloadSesion(v1, true));
  const p2 = payloadSesion(a.session, true); assert.equal(p2.sesion_uid, a.session.identity.sessionId); assert.equal(p2.identidad_v, 1);
  sinNuevos(payloadSesion(a.session, false));
  const base = removeUndefinedPayloadFields(buildSessionPayload({ alumnoId: A, session: a.session, activeDay: DIA, activeRoutine: { id: R, name: "R" }, exercises: DIA.exercises, weekToSave: 1, date: a.session.fecha, time: "10:30", includeRoutineId: true, ciclo: 1 }));
  assert.equal(JSON.stringify(payloadSesion(a.session, false)), JSON.stringify(base), "payload de sesion antiguo identico");
  // identidad ajena (otro alumno / otro dia) no se envia
  sinNuevos(payloadSesion(a.session, true, B)); sinNuevos(payloadSesion(Object.assign({}, a.session, { dIdx: 1 }), true));
  assert.deepEqual(Object.keys(p2).filter((k) => !Object.keys(base).includes(k)).sort(), ["identidad_v", "sesion_uid"]);
});
await test("9 reintentos offline: el pendiente creado SIN bandera conserva la identidad y la envia al activarse; con esquema antiguo no se bloquea", async () => {
  reset(); const st = memStorage(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const off = servidor("migrado", { caida: true });
  const f1 = await flush(st, off, false); assert.equal(f1.sent, 0); assert.equal(visiblePendingItems(st, A).length, 1);
  assert.equal(pend(st, r.opId).sesion_uid, a.session.identity.sessionId, "identidad intacta tras el fallo");
  const viejo = servidor("antiguo"); const f2 = await flush(st, viejo, () => identidadRemotaActiva(ON));
  assert.equal(f2.sent, 1, "esquema antiguo: se confirma por el fallback"); assert.equal(visiblePendingItems(st, A).length, 0); viejo.prog.forEach(sinNuevos); reset();
});
await test("10 idempotencia: reenviar el mismo opId (409 progreso_pkey) no duplica ni cambia la identidad guardada", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  const it = pend(st, r.opId);
  const x1 = await srv.send(true)(it), x2 = await srv.send(true)(it);
  assert.ok(x1 && x2); assert.equal(srv.prog.size, 1); assert.equal(srv.prog.get(r.opId).pos, 1);
  assert.equal(srv.posts.length, 2);
});
await test("11 fallo de escritura: error de red o 500 => no confirmado, pendiente intacto con identidad, sin marcar el esquema como rechazado", async () => {
  reset(); const st = memStorage(); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq" });
  const caido = servidor("migrado", { caida: true }); const f = await flush(st, caido, true); assert.equal(f.sent, 0);
  assert.equal(IR.hayEsquemaRechazado(), false);
  const r500 = await enviarConFallbackIdentidad(async () => ({ ok: false, status: 500, data: { message: "boom" } }), { sesion_uid: "x", id: "y" }, CAMPOS_REMOTOS_SERIE);
  assert.equal(r500.status, 500); assert.equal(IR.hayEsquemaRechazado(), false);
  // 23505 jamas dispara reenvio
  let llamadas = 0; await enviarConFallbackIdentidad(async () => { llamadas++; return { ok: false, status: 409, data: { code: "23505", message: "sesion_uid bloque" } }; }, { sesion_uid: "x" }, CAMPOS_REMOTOS_SERIE);
  assert.equal(llamadas, 1); assert.equal(pend(st, r.opId).sesion_uid, a.session.identity.sessionId);
  // errores no relacionados con identidad (columna de otra cosa) tampoco
  llamadas = 0; await enviarConFallbackIdentidad(async () => { llamadas++; return colErr("otra_columna", "progreso"); }, { sesion_uid: "x" }, CAMPOS_REMOTOS_SERIE); assert.equal(llamadas, 1);
  // check constraint de identidad: si se reenvia sin campos
  llamadas = 0; await enviarConFallbackIdentidad(async () => { llamadas++; return llamadas === 1 ? { ok: false, status: 400, data: { code: "23514", message: 'new row violates check constraint "progreso_bloque_chk"' } } : { ok: true, status: 201, data: [{}] }; }, { sesion_uid: "x" }, CAMPOS_REMOTOS_SERIE);
  assert.equal(llamadas, 2); reset();
});
await test("12 conflicto de identidades: la local contradice a la del servidor en la misma fila => no verificable (ninguna se usa)", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  const r = registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  await flush(st, srv, true);
  srv.prog.get(r.opId).sesion_uid = "99999999-9999-4999-8999-999999999999";               // el servidor dice otra sesion
  const hid = hydrateProgressFromRows(srv.rows(A));
  assert.equal(idDe(hid.bp.sets[0]).sesion_uid, "99999999-9999-4999-8999-999999999999", "se lee tal cual");
  const m = mergeProgressEntries(r.prog.bp, hid.bp);
  assert.equal(m.sets.length, 1); assert.deepEqual(idDe(m.sets[0]), {}); assert.equal(m.sets[0].identidad_no_verificable, true);
  const otra = mergeProgressEntries(m, hid.bp);                                            // una rehidratacion posterior no la "repara"
  assert.deepEqual(idDe(otra.sets[0]), {}); assert.equal(otra.sets[0].identidad_no_verificable, true);
  // consistente: se conserva la del servidor y completa campos ausentes
  const ok = conservarIdentidadHidratada({ id: r.opId, kg: 50, reps: 8, date: "5/11/2026", week: 0, note: "", sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 1 }, { id: r.opId, kg: 50, reps: 8, date: "5/11/2026", week: 0, note: "", sesion_uid: a.session.identity.sessionId });
  assert.deepEqual(idDe(ok), { sesion_uid: a.session.identity.sessionId, bloque: "main", pos: 1 });
});
await test("13 duplicados de sesion: sesion_uid repetido (23505) no crea otra fila y la finalizacion se confirma por la comprobacion; sin uid, dedupe de siempre", async () => {
  reset(); const st = memStorage(); const a = ini(st);
  const srv = servidor("migrado", { lecturaVieja: true });
  const payload = payloadSesion(a.session, true);
  const base = { sb: srv.sb, alumnoId: A, payload, date: a.session.fecha, dayIndex: 0, weekToSave: 1, ciclo: 1, rutinaId: R, isOnline: true };
  const o1 = await persistSessionConfirmed(base); assert.equal(o1.confirmed, true); assert.equal(srv.ses.length, 1); assert.equal(srv.ses[0].sesion_uid, a.session.identity.sessionId);
  const viejaLectura = Object.assign({}, srv.sb, { getSesiones: (() => { let n = 0; return async () => (n++ === 0 ? [] : srv.ses.slice()); })() });
  const o2 = await persistSessionConfirmed(Object.assign({}, base, { sb: viejaLectura }));
  assert.equal(o2.confirmed, true); assert.equal(srv.ses.length, 1, "no hay segunda fila"); assert.equal(o2.source, "verified");
  // esquema antiguo: finalizar sigue funcionando y deja de enviar campos nuevos
  reset(); const viejo = servidor("antiguo"); const o3 = await persistSessionConfirmed(Object.assign({}, base, { sb: viejo.sb }));
  assert.equal(o3.confirmed, true); sinNuevos(viejo.ses[0]); assert.equal(viejo.postsSes.length, 2); reset();
  // v1: payload sin identidad y dedupe de siempre
  const v1 = Object.assign({}, a.session); delete v1.identity; const s2 = servidor("migrado");
  const b1 = await persistSessionConfirmed(Object.assign({}, base, { sb: s2.sb, payload: payloadSesion(v1, true) }));
  const b2 = await persistSessionConfirmed(Object.assign({}, base, { sb: s2.sb, payload: payloadSesion(v1, true) }));
  assert.equal(b1.confirmed && b2.confirmed, true); assert.equal(s2.ses.length, 1); assert.equal(b2.source, "existing");
});
await test("14-20 ejercicio repetido, dos sesiones del dia, dos alumnos, cambio de rutina/ciclo, semana congelada y medianoche: el servidor migrado conserva cada identidad", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado");
  const t1 = new Date(2026, 10, 5, 23, 55).getTime(), t2 = new Date(2026, 10, 6, 0, 15).getTime();
  const a = ini(st, { now: t1, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t1 } });
  const ra = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", now: t1 });
  const rb = registrar({}, { st, session: a.session, activeExIdx: 4, exId: "sq", progress: ra.prog, now: t1 });        // ejercicio repetido
  const rec = ini(st, { semana: 1, now: t2, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t2 } });                   // medianoche + semana congelada
  const rc = registrar({}, { st, session: rec.session, activeExIdx: 3, exId: "bp", visible: 1, progress: rb.prog, now: t2 });
  const s2 = ini(st, { session: { rId: R, dIdx: 1, exIdx: 0, startTime: t2 + MIN }, now: t2 + MIN });                  // otra sesion el mismo dia (otro dia de rutina)
  const rd = registrar({}, { st, session: s2.session, activeExIdx: 2, exId: "row", progress: rc.prog, now: t2 + MIN });
  const r2 = ini(st, { session: { rId: "rutina-2", dIdx: 0, exIdx: 0, startTime: t2 + 2 * MIN }, now: t2 + 2 * MIN });   // cambio de rutina
  const re = registrar({}, { st, session: r2.session, activeExIdx: 2, exId: "sq", progress: rd.prog, now: t2 + 2 * MIN });
  const c2 = ini(st, { ciclo: 2, session: { rId: R, dIdx: 0, exIdx: 0, startTime: t2 + 3 * MIN }, now: t2 + 3 * MIN });  // cambio de ciclo
  const rf = registrar({}, { st, session: c2.session, activeExIdx: 2, exId: "sq", progress: re.prog, cicloVivo: 2, now: t2 + 3 * MIN });
  const b = ini(st, { alumnoId: B }); const rg = registrar({}, { st, session: b.session, alumnoId: B, activeExIdx: 2, exId: "sq" });  // otro alumno
  await flush(st, srv, true, A); await flush(st, srv, true, B);
  const uidA = a.session.identity.sessionId;
  const f = (r) => srv.prog.get(r.opId);
  assert.deepEqual([idDe(f(ra)), idDe(f(rb))], [{ sesion_uid: uidA, bloque: "main", pos: 0 }, { sesion_uid: uidA, bloque: "main", pos: 2 }]);
  assert.equal(f(ra).ejercicio_id, f(rb).ejercicio_id);
  assert.equal(f(rc).sesion_uid, uidA, "medianoche: misma sesion"); assert.equal(f(rc).semana, 0, "semana congelada"); assert.equal(f(rc).fecha, "5/11/2026");
  const uids = [ra, rd, re, rf, rg].map((r) => f(r).sesion_uid); assert.equal(new Set(uids).size, 5, "cada sesion/rutina/ciclo/alumno distinto, uid distinto");
  assert.equal(f(rf).ciclo, 2); assert.equal(f(rg).alumno_id, B);
  // hidratacion de cada alumno: identidades en su sitio, sin mezclar
  const hA = hydrateProgressFromRows(srv.rows(A)); assert.equal(hA.sq.sets.length, 4); assert.ok(hA.sq.sets.every((s) => s.sesion_uid && !srv.rows(B).some((x) => x.id === s.id)));
  const hB = hydrateProgressFromRows(srv.rows(B)); assert.equal(hB.sq.sets[0].sesion_uid, b.session.identity.sessionId);
});
await test("21 hidratacion: la identidad explicita se lee validada; filas historicas o invalidas quedan sin identidad (nada se infiere)", () => {
  const U = "33333333-3333-4333-8333-333333333333";
  const fila = (id, extra) => Object.assign({ id, ejercicio_id: "sq", kg: 50, reps: 8, fecha: "5/11/2026", semana: 0, nota: "", created_at: "2026-11-05T10:00:0" + (id.slice(-1)) + "Z" }, extra || {});
  const h = hydrateProgressFromRows([
    fila("00000000-0000-4000-8000-000000000001", { sesion_uid: U, bloque: "main", pos: 2 }),
    fila("00000000-0000-4000-8000-000000000002"),
    fila("00000000-0000-4000-8000-000000000003", { sesion_uid: "no-es-uuid", bloque: "otro", pos: -1 }),
    fila("00000000-0000-4000-8000-000000000004", { sesion_uid: null, bloque: "warmup", pos: null }),
    fila("00000000-0000-4000-8000-000000000005", { sesion_uid: U.toUpperCase(), bloque: "warmup", pos: 0 }),
  ]);
  const por = Object.fromEntries(h.sq.sets.map((s) => [s.id.slice(-1), idDe(s)]));
  assert.deepEqual(por["1"], { sesion_uid: U, bloque: "main", pos: 2 }); assert.deepEqual(por["2"], {}); assert.deepEqual(por["3"], {}); assert.deepEqual(por["4"], {});
  assert.deepEqual(por["5"], { sesion_uid: U, bloque: "warmup", pos: 0 }, "uuid normalizado a minusculas");
  assert.deepEqual(leerIdentidadRemotaSesion({ sesion_uid: U, identidad_v: 1 }), { sesion_uid: U, identidad_v: 1 });
  for (const mal of [null, {}, { sesion_uid: U }, { sesion_uid: U, identidad_v: 2 }, { sesion_uid: "x", identidad_v: 1 }]) assert.equal(leerIdentidadRemotaSesion(mal), null);
  assert.deepEqual(leerIdentidadRemotaSerie(null), {});
});
await test("22 prescrito/ejecutado: series vinculadas a sesiones solo por sesion_uid igual y unico; uid duplicado o ausente => sin vinculo", () => {
  const U1 = "55555555-5555-4555-8555-555555555555", U2 = "66666666-6666-4666-8666-666666666666";
  const sesiones = [{ id: "s1", sesion_uid: U1, identidad_v: 1 }, { id: "s2", sesion_uid: U2, identidad_v: 1 }, { id: "s3", sesion_uid: U2, identidad_v: 1 }, { id: "s4" }];
  const { series, ambiguos } = vincularSeriesConSesiones([{ sesion_uid: U1, bloque: "main", pos: 0 }, { sesion_uid: U2, bloque: "main", pos: 0 }, { bloque: "main", pos: 0 }, { sesion_uid: "otra" }], sesiones);
  assert.equal(series[0].sesion_id, "s1"); assert.equal(series[1].sesion_id, undefined); assert.equal(series[2].sesion_id, undefined); assert.equal(series[3].sesion_id, undefined);
  assert.deepEqual(ambiguos, [U2]);
  const rutina = { id: "r1", nombre: "R", alumno_id: A, datos: { semana_activa: 1, days: [{ label: "D", warmup: [], exercises: [{ id: "sq", name: "Sq", sets: "1", reps: "8", kg: "50" }] }] } };
  const snap = buildPrescripcionSnapshot({ rutina, alumnoId: A, diaIdx: 0, semana: 1, fecha: "05/11/2026", semanaMostrada: 1, capturadaEn: "2026-11-05T21:00:00.000Z" });
  const copia = { alumno_id: snap.clave.alumno_id, rutina_id: snap.clave.rutina_id, ciclo: snap.clave.ciclo, semana: snap.clave.semana, dia_idx: snap.clave.dia_idx, fecha_dia: snap.clave.fecha_dia, prescripcion_hash: snap.hash, snapshot: snap.snapshot, origen_lectura: "servidor" };
  const ses = { id: "s1", sesion_uid: U1, identidad_v: 1, alumno_id: A, rutina_id: "r1", ciclo: 1, semana: 1, dia_idx: 0, fecha: "05/11/2026", completada: true };
  const fila = { id: "p1", sesion_uid: U1, alumno_id: A, rutina_id: "r1", ciclo: 1, semana: 0, fecha: "05/11/2026", dia_idx: 0, ejercicio_id: "sq", kg: 50, reps: 8, bloque: "main", pos: 0 };
  const sin = compararPrescripcionEjecucion({ sesion: ses, copias: [copia], series: [fila], contexto: { registroSeriesCompleto: true } });
  assert.equal(sin.verificable, false, "sin sesion_id explicito no se compara");
  const con = compararPrescripcionEjecucion({ sesion: ses, copias: [copia], series: vincularSeriesConSesiones([fila], [ses]).series, contexto: { registroSeriesCompleto: true } });
  assert.equal(con.series.vinculadas, 1);
  const dup = compararPrescripcionEjecucion({ sesion: ses, copias: [copia], series: vincularSeriesConSesiones([fila], [ses, Object.assign({}, ses, { id: "s9" })]).series, contexto: { registroSeriesCompleto: true } });
  assert.equal(dup.verificable, false, "uid duplicado: sin vinculo");
});
await test("23 estadisticas sin cambios: con identidad remota hidratada o sin ella, mismo volumen, PR, maximo y conteos", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  const r1 = registrar({}, { st, session: a.session, activeExIdx: 2, exId: "sq", kg: 60 });
  const r2 = registrar({}, { st, session: a.session, activeExIdx: 4, exId: "sq", kg: 70, progress: r1.prog });
  await flush(st, srv, true);
  const filas = srv.rows(A); const sinId = filas.map((f) => { const c = Object.assign({}, f); NUEVOS.forEach((k) => delete c[k]); return c; });
  const con = hydrateProgressFromRows(filas).sq, sin = hydrateProgressFromRows(sinId).sq;
  const proy = (e) => e.sets.map((s) => [s.kg, s.reps, s.date, s.week, s.id, s.created_at]);
  assert.deepEqual(proy(con), proy(sin)); assert.equal(con.max, sin.max);
  assert.equal(calculateSetsVolume(con.sets), calculateSetsVolume(sin.sets));
  assert.deepEqual(calculateNewWeightPR({ max: con.max }, 71), calculateNewWeightPR({ max: sin.max }, 71));
  assert.equal(mergeProgressEntries(r2.prog.sq, con).sets.length, mergeProgressEntries(r2.prog.sq, sin).sets.length);
});
await test("24-25 ningun envio accidental: sin bandera NINGUN payload (serie, pendiente, sesion) lleva campos nuevos y el cableado pasa por la proyeccion", async () => {
  reset(); const st = memStorage(); const srv = servidor("migrado"); const a = ini(st);
  registrar({}, { st, session: a.session, activeExIdx: 3, exId: "bp" });
  await flush(st, srv, identidadRemotaDesdeEntorno());
  await persistSessionConfirmed({ sb: srv.sb, alumnoId: A, payload: payloadSesion(a.session, identidadRemotaDesdeEntorno()), date: a.session.fecha, dayIndex: 0, weekToSave: 1, ciclo: 1, rutinaId: R, isOnline: true });
  srv.posts.forEach(sinNuevos); srv.postsSes.forEach(sinNuevos); srv.prog.forEach(sinNuevos); srv.ses.forEach(sinNuevos);
  const app = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  assert.ok(app.includes("buildProgressPayloadFromPending(item, alumnoIdSync, identidadRemotaDesdeEntorno())"));
  assert.ok(app.includes("proyectarPayloadSerie(buildProgressPayload(alumnoIdSync, exId, kg, reps, note, d, weekForSet, cicloForSet, opId), identidadSerie, identidadRemotaDesdeEntorno())"));
  assert.ok(app.includes("enviarConFallbackIdentidad((x) => sbRequestStatus(\"progreso\", \"POST\", x), p, CAMPOS_REMOTOS_SERIE)"));
  assert.ok(!/import\.meta\.env\.VITE_IRONTRACK_IDENTIDAD_REMOTA/.test(app), "la bandera solo se lee en lib/identidadRemota.js");
  assert.ok(readFileSync(path.join(ROOT, "components/WorkoutScreen.jsx"), "utf8").includes("proyectarPayloadSesion(buildSessionPayload({"));
  // la lectura de la bandera es un literal estatico (Vite lo reemplaza) y ningun otro modulo envia los campos
  const ir = readFileSync(path.join(ROOT, "lib/identidadRemota.js"), "utf8");
  assert.ok(ir.includes("import.meta.env.VITE_IRONTRACK_IDENTIDAD_REMOTA"));
  assert.ok(readFileSync(path.join(ROOT, "lib/serieIdentidad.js"), "utf8").includes("sinIdentidadLocal"));
});
console.log("\n" + n + " pruebas OK");
