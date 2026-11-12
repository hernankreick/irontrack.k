// D76-04 × D76-05 — integración: series por ciclo (reconciliación por id/ciclo) + fecha estable del entrenamiento (medianoche, recarga de
// Safari), junto con el write-ahead (#154), la lectura fallida de sesiones (#155), la guarda de registro (#156) y la sincronización al
// volver online (#157).
//   node scripts/test-d7-6CiclosMedianoche.mjs
// Datos ficticios, sin red: almacenamiento en memoria, "servidor" falso (progreso por id con 23505, sesiones y rutinas) y reloj por
// parámetro (instantes LOCALES: new Date(2026, 10, 5, 23, 55), así el test no depende de la zona horaria del runner). Lógica REAL de lib/.
import assert from "node:assert/strict";
import {
  buildExerciseSetRecord, buildPendingProgressItem, buildProgressPayload, buildSessionPayload, calculateDayProgress, filterSetsByDay,
  getExerciseSetsForDay, getWorkoutExerciseStatus, hydrateProgressFromRows, mergeProgressEntries, removeUndefinedPayloadFields,
  updateExerciseProgressRecord,
} from "../lib/workoutSession.js";
import {
  ACTIVE_WORKOUT_KEY, cerrarSesionActiva, claveDiaDeSesion, fechaDeSesion, leerSesionActiva, prepararInicioEntrenamiento,
} from "../lib/workoutSessionDate.js";
import { buildReinicioDatos, readCicloActual, rowCiclo, setsForLoadPrefill } from "../lib/rutinaCiclo.js";
import { writeAheadPendingSet, sendWriteAheadSet, isSetSendInFlight } from "../lib/setWriteAhead.js";
import { flushPendingForAlumno, generateOpId, visiblePendingItems } from "../lib/pendingSyncQueue.js";
import { PQ_ITEM_PREFIX } from "../lib/pendingQueueKeyed.js";
import { postProgressIdempotent } from "../lib/progressInsert.js";
import { finalizeStudentSession, FINALIZE_FAILURE, SESSION_CONFIRMED_BY } from "../lib/finalizeWorkoutSession.js";
import { createSetLogGuard } from "../lib/setLogGuard.js";
import { createPendingSyncController, attachSyncTriggers } from "../lib/pendingSyncController.js";

let n = 0;
let failed = 0;
const t = async (name, fn) => {
  try { await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.error("FAIL -", name); console.error(e); }
};

const at = (d, h, m) => new Date(2026, 10, d, h, m).getTime();
const T_1000 = at(5, 10, 0);
const T_2350 = at(5, 23, 50);
const T_2355 = at(5, 23, 55);
const T_2357 = at(5, 23, 57);
const T_2358 = at(5, 23, 58);
const T_0003 = at(6, 0, 3);
const T_0005 = at(6, 0, 5);
const T_0010 = at(6, 0, 10);
const T_0012 = at(6, 0, 12);
const F5 = "5/11/2026";
const F6 = "6/11/2026";
const A = "alumno-demo-a";
const B = "alumno-demo-b";
const TIMEOUT = 500;
const EX0 = { id: "sentadilla-demo", sets: "2", kg: 60, reps: 8 };
const EX1 = { id: "remo-demo", sets: "2", kg: 40, reps: 10 };
const EXS = [EX0, EX1];

const memStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    _m: m,
  };
};

// Servidor falso. progreso: inserción por id (409/23505 sobre progreso_pkey si existe; ciclo DEFAULT 1 como sql/ciclo_rutina.sql).
// fallarPosts(n): los próximos n POST de progreso responden 500 sin insertar. sesiones/rutinas para finalizeStudentSession.
function crearServidor(reloj) {
  const filas = new Map();
  const posts = [];
  const sesiones = [];
  const sesionPosts = [];
  const avances = [];
  const rutinas = new Map();
  let fallos = 0;
  let lecturasFallidas = 0;
  let seq = 0;
  const marca = () => new Date(reloj.now() + (seq++)).toISOString();
  return {
    filas, posts, sesiones, sesionPosts, avances, rutinas,
    filasDe: (aid) => [...filas.values()].filter((f) => f.alumno_id === aid),
    fallarPosts: (k) => { fallos = k; },
    fallarLecturasSesiones: (k) => { lecturasFallidas = k; },
    io: {
      post: async (payload) => {
        posts.push(payload);
        if (fallos > 0) { fallos--; return { ok: false, status: 500, data: { message: "error ficticio" } }; }
        if (filas.has(payload.id)) {
          return { ok: false, status: 409, data: { code: "23505", details: "Key (id)=(" + payload.id + ") already exists.", message: 'duplicate key value violates unique constraint "progreso_pkey"' } };
        }
        const fila = Object.assign({ ciclo: 1 }, payload, { created_at: marca() });
        filas.set(payload.id, fila);
        return { ok: true, status: 201, data: [Object.assign({}, fila)] };
      },
      getById: async (id) => ({ ok: true, status: 200, data: filas.has(id) ? [Object.assign({}, filas.get(id))] : [] }),
    },
    sb: {
      getSesiones: async (aid) => {
        if (lecturasFallidas > 0) { lecturasFallidas--; return null; }
        return sesiones.filter((s) => s.alumno_id === aid).map((s) => Object.assign({}, s));
      },
      addSesion: async (payload) => {
        sesionPosts.push(payload);
        const fila = Object.assign({ ciclo: 1 }, payload, { id: "ses-" + (sesiones.length + 1), created_at: marca() });
        sesiones.push(fila);
        return [Object.assign({}, fila)];
      },
      getSesionesByAlumnoRutinaSemana: async (aid, rid, _n, semana) =>
        sesiones.filter((s) => s.alumno_id === aid && s.rutina_id === rid && Number(s.semana) === Number(semana)).map((s) => Object.assign({}, s)),
      updateRutinaSemanaActiva: async (rid, next, expectedCiclo) => {
        const r = rutinas.get(rid);
        if (!r) return [];
        if (readCicloActual(r.datos) !== expectedCiclo) return { status: "ciclo_cambiado", datos: r.datos };
        if (Number(r.datos.semana_activa) >= next) return [{ id: rid, datos: r.datos }];
        r.datos = Object.assign({}, r.datos, { semana_activa: next });
        avances.push(next);
        return [{ id: rid, datos: r.datos }];
      },
    },
  };
}

// Mundo: reloj + storage + servidor + rutina + progreso local (it_pg) por alumno + sesión en memoria + conexión.
function mundo(inicio) {
  let now = inicio;
  const reloj = { now: () => now, set: (ms) => { now = ms; } };
  const storage = memStorage();
  const srv = crearServidor(reloj);
  const rutina = { id: "rutina-demo-1", name: "Rutina demo", days: [{ label: "Dia 1", exercises: EXS }], datos: { semana_activa: 1, ciclo_actual: 1 } };
  srv.rutinas.set(rutina.id, rutina);
  const w = { reloj, storage, srv, rutina, progress: { [A]: {}, [B]: {} }, alumnoId: A, session: null, online: true, envios: [] };
  w.ciclo = () => readCicloActual(rutina.datos);
  w.week = () => Number(rutina.datos.semana_activa) - 1;
  w.iniciar = (alumnoId) => {
    const r = prepararInicioEntrenamiento({
      storage, session: { rId: rutina.id, dIdx: 0, exIdx: 0, startTime: reloj.now() }, alumnoId: alumnoId || w.alumnoId,
      ciclo: w.ciclo(), semana: w.week(), now: reloj.now(),
    });
    w.session = r.session;
    return r;
  };
  // Réplica de logSet (App.jsx): fecha de la sesión, ciclo vigente, opId, write-ahead ANTES de mostrar/enviar, serie local con id, envío.
  w.logSet = (ex, opIdIntento) => {
    const alumnoId = w.alumnoId;
    const d = fechaDeSesion(w.session, reloj.now());
    const week = w.week();
    const c = w.ciclo();
    const opId = opIdIntento || generateOpId();
    const newSet = Object.assign(buildExerciseSetRecord(ex.kg, ex.reps, d, week, "", null, c), { id: opId });
    const wa = writeAheadPendingSet(storage, buildPendingProgressItem(ex.id, ex.kg, ex.reps, "", d, week, c, alumnoId, opId), reloj.now());
    if (!wa.ok) return false;
    w.progress[alumnoId] = Object.assign({}, w.progress[alumnoId], { [ex.id]: updateExerciseProgressRecord(w.progress[alumnoId][ex.id], newSet) });
    if (w.online) {
      w.envios.push(sendWriteAheadSet({
        storage, opId, timeoutMs: TIMEOUT,
        send: () => {
          w.writeAheadAntesDelEnvio = storage.getItem(PQ_ITEM_PREFIX + opId) != null;
          return postProgressIdempotent(srv.io, buildProgressPayload(alumnoId, ex.id, ex.kg, ex.reps, "", d, week, c, opId));
        },
      }));
    }
    return opId;
  };
  w.esperar = () => Promise.all(w.envios.slice());
  w.sendItem = (aid) => (item) => postProgressIdempotent(srv.io, buildProgressPayload(aid, item.exId, item.kg, item.reps, item.note, item.date, item.semana, item.ciclo, item.opId));
  w.flush = (aid) => flushPendingForAlumno({ storage, alumnoId: aid || w.alumnoId, isInFlight: isSetSendInFlight, timeoutMs: TIMEOUT, send: w.sendItem(aid || w.alumnoId) });
  // Rehidratación del login de App.jsx.
  w.rehidratar = (aid) => {
    const id = aid || w.alumnoId;
    const hydrated = hydrateProgressFromRows(srv.filasDe(id));
    const prev = w.progress[id];
    if (!prev || Object.keys(prev).length === 0) { w.progress[id] = hydrated; return; }
    const merged = Object.assign({}, prev);
    Object.keys(hydrated).forEach((exId) => { merged[exId] = mergeProgressEntries(prev[exId], hydrated[exId]); });
    w.progress[id] = merged;
  };
  w.reiniciar = () => { rutina.datos = buildReinicioDatos(rutina.datos, { tipo: "rutina", cargas: "cero", nowIso: new Date(reloj.now()).toISOString() }); w.session = null; };
  // Réplica de la finalización del alumno (WorkoutScreen.jsx).
  w.finalizar = async (o) => {
    const s = w.session;
    const opts = o || {};
    const effectiveWeek = w.week();
    const cicloActual = w.ciclo();
    const hoyFin = fechaDeSesion(s, reloj.now());
    const todayStr = claveDiaDeSesion(s, reloj.now());
    const lastAdvanceDate = opts.lastAdvanceDate !== undefined ? opts.lastAdvanceDate : storage.getItem("it_last_week_advance_date");
    const payload = removeUndefinedPayloadFields(buildSessionPayload({
      alumnoId: w.alumnoId, session: s, activeDay: rutina.days[0], activeRoutine: rutina, exercises: EXS, weekToSave: effectiveWeek + 1,
      date: hoyFin, time: "00:10", includeRoutineId: true, ciclo: cicloActual,
    }));
    const out = await finalizeStudentSession({
      sb: srv.sb, alumnoId: w.alumnoId, payload, date: hoyFin, dayIndex: s.dIdx, weekToSave: effectiveWeek + 1, ciclo: cicloActual,
      isOnline: w.online, effectiveWeek, totalDays: rutina.days.length, lastAdvanceDate, todayStr, rutinaId: rutina.id, rutinaNombre: rutina.name,
      timeoutMs: TIMEOUT, updateRutinaWeek: () => srv.sb.updateRutinaSemanaActiva(rutina.id, effectiveWeek + 2, cicloActual),
    });
    if (out.status === "saved") {
      cerrarSesionActiva(storage, { alumnoId: w.alumnoId, session: s });
      if (out.week.advance === "ok") storage.setItem("it_last_week_advance_date", todayStr);
      if (!opts.mantenerSesion) w.session = null;
    }
    out.todayStr = todayStr;
    out.payload = payload;
    return out;
  };
  w.sets = (exId, aid) => ((w.progress[aid || w.alumnoId][exId] || {}).sets || []);
  w.hoy = (exId, ciclo) => getExerciseSetsForDay(w.progress[w.alumnoId], exId, fechaDeSesion(w.session, reloj.now()), w.week(), { checkWeek: false, ciclo });
  return w;
}

// ───────── D76-04 × reinicio ─────────
await t("reinicio de rutina el mismo dia: el ciclo 2 empieza vacio, sin precarga, y ambos ciclos conviven sin mezclarse", async () => {
  const w = mundo(T_1000);
  w.iniciar();
  w.logSet(EX0); w.logSet(EX0); w.logSet(EX1);
  await w.esperar();
  assert.equal(calculateDayProgress(EXS, w.progress[A], F5, 0, { checkWeek: false, ciclo: 1 }).pct, 100);
  w.reloj.set(T_1000 + 3600e3);
  w.reiniciar();
  const r = w.iniciar();
  assert.equal(r.recuperada, false);
  assert.equal(r.motivo, "otro_ciclo", "el ancla del ciclo 1 no se usa para el ciclo 2");
  assert.equal(r.session.fecha, F5);
  assert.equal(r.session.ciclo, 2);
  const st = getWorkoutExerciseStatus({ exercise: EX0, progress: w.progress[A], date: F5, currentWeek: 0, ciclo: 2 });
  assert.equal(st.setsToday.length, 0);
  assert.equal(st.lastSet, undefined, "sin ultima serie del ciclo anterior");
  assert.deepEqual(setsForLoadPrefill(w.sets(EX0.id), w.rutina.datos), [], "cargas en cero: sin precarga del ciclo 1");
  assert.equal(calculateDayProgress(EXS, w.progress[A], F5, 0, { checkWeek: false, ciclo: 2 }).pct, 0, "FINALIZAR oculto en el ciclo nuevo");
  w.logSet(EX0); w.logSet(EX0);   // mismos valores que en el ciclo 1
  await w.esperar();
  w.rehidratar();
  assert.equal(w.sets(EX0.id).length, 4, "2 + 2, sin perder ni duplicar");
  assert.equal(new Set(w.sets(EX0.id).map((s) => s.id)).size, 4);
  assert.equal(w.hoy(EX0.id, 1).length, 2);
  assert.equal(w.hoy(EX0.id, 2).length, 2);
  assert.equal(w.srv.filasDe(A).filter((f) => f.ciclo === 2).length, 2);
});

await t("cambio de ciclo con pendientes: cada pendiente conserva su ciclo; el flush envia c1 sin campo ciclo y c2 con ciclo 2; sin duplicados", async () => {
  const w = mundo(T_1000);
  w.iniciar();
  w.online = false;
  const c1a = w.logSet(EX0), c1b = w.logSet(EX0);
  w.reiniciar();
  w.iniciar();
  const c2 = w.logSet(EX0);
  const pend = visiblePendingItems(w.storage, A);
  assert.equal(pend.length, 3);
  assert.deepEqual(pend.map((p) => rowCiclo(p)).sort(), [1, 1, 2]);
  assert.equal(w.hoy(EX0.id, 2).length, 1, "el ciclo 2 solo ve su serie");
  w.online = true;
  const r = await w.flush();
  assert.deepEqual({ sent: r.sent, failed: r.failed }, { sent: 3, failed: 0 });
  const byId = Object.fromEntries(w.srv.posts.map((p) => [p.id, p]));
  assert.ok(!("ciclo" in byId[c1a]) && !("ciclo" in byId[c1b]), "c1 sin campo ciclo (DEFAULT 1)");
  assert.equal(byId[c2].ciclo, 2);
  assert.equal(rowCiclo(w.srv.filas.get(c1a)), 1);
  assert.equal(rowCiclo(w.srv.filas.get(c2)), 2);
  w.rehidratar();
  assert.equal(w.sets(EX0.id).length, 3);
  assert.equal(w.hoy(EX0.id, 1).length, 2);
  assert.equal(w.hoy(EX0.id, 2).length, 1);
  assert.equal((await w.flush()).sent, 0, "un segundo flush no reenvia nada");
  assert.equal(w.srv.posts.length, 3);
});

// ───────── D76-05 × D76-04 ─────────
await t("inicio 23:55, fin 00:10: series, progreso del dia, sesion y clave de avance son del 5/11", async () => {
  const w = mundo(T_2355);
  assert.equal(w.iniciar().session.fecha, F5);
  w.reloj.set(T_2357); w.logSet(EX0);
  w.reloj.set(T_0005); w.logSet(EX1);
  await w.esperar();
  assert.ok(w.srv.filasDe(A).every((f) => f.fecha === F5));
  w.reloj.set(T_0010);
  assert.equal(calculateDayProgress(EXS, w.progress[A], fechaDeSesion(w.session, T_0010), 0, { checkWeek: false, ciclo: 1 }).pct, 100, "FINALIZAR visible a las 00:10");
  const out = await w.finalizar();
  assert.equal(out.status, "saved");
  assert.equal(out.payload.fecha, F5);
  assert.equal(out.todayStr, new Date(2026, 10, 5).toDateString());
  assert.equal(out.week.advance, "ok");
  assert.equal(w.srv.sesiones.length, 1);
  assert.equal(leerSesionActiva(w.storage), null, "ancla cerrada al confirmar");
});

await t("cruce de medianoche sin conexion: 23:58 y 00:03 -> misma fecha, pendientes; al reconectar 1 fila por serie (5/11, ciclo 1); luego finaliza", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  w.online = false;
  w.reloj.set(T_2358); const a = w.logSet(EX0);
  w.reloj.set(T_0003); const b = w.logSet(EX1);
  assert.deepEqual(visiblePendingItems(w.storage, A).map((p) => p.date), [F5, F5]);
  assert.equal(w.srv.posts.length, 0);
  w.online = true;
  w.reloj.set(T_0005);
  assert.equal((await w.flush()).sent, 2);
  assert.equal((await w.flush()).sent, 0);
  // Reenvio manual del MISMO opId (respuesta perdida): 23505 verificado, no duplica.
  assert.ok(await postProgressIdempotent(w.srv.io, buildProgressPayload(A, EX0.id, EX0.kg, EX0.reps, "", F5, 0, 1, a)));
  const filas = w.srv.filasDe(A);
  assert.equal(filas.length, 2);
  assert.deepEqual(filas.map((f) => [f.id, f.fecha, rowCiclo(f)]).sort(), [[a, F5, 1], [b, F5, 1]].sort());
  w.rehidratar();
  assert.equal(w.sets(EX0.id).length + w.sets(EX1.id).length, 2);
  w.reloj.set(T_0010);
  const out = await w.finalizar();
  assert.equal(out.status, "saved");
  assert.equal(w.srv.sesiones[0].fecha, F5);
});

await t("recarga de Safari durante la sesion: recupera fecha e inicio; rehidratar con progreso local con ids no pierde ni duplica", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  w.reloj.set(T_2357); const a = w.logSet(EX0);
  await w.esperar();
  w.online = false;
  w.reloj.set(T_2358); const b = w.logSet(EX0);   // pendiente al recargar
  // Recarga: la sesion en memoria se pierde; storage (ancla + pendientes) y progreso local (it_pg) quedan.
  w.session = null;
  w.reloj.set(T_0005);
  w.online = true;
  w.rehidratar();
  assert.deepEqual(w.sets(EX0.id).map((s) => s.id).sort(), [a, b].sort(), "la serie sincronizada no se duplica y la pendiente no se pierde");
  const r = w.iniciar();
  assert.equal(r.recuperada, true);
  assert.equal(r.session.fecha, F5);
  assert.equal(r.session.startTime, T_2355);
  assert.equal(w.hoy(EX0.id, 1).length, 2, "las series de antes de la recarga siguen contando hoy");
  w.logSet(EX1);
  await w.esperar();
  assert.equal(w.sets(EX1.id)[0].date, F5);
  await w.flush();
  w.rehidratar();
  assert.equal(w.sets(EX0.id).length, 2);
  assert.equal(w.sets(EX1.id).length, 1);
  assert.equal(w.srv.filasDe(A).length, 3);
  assert.ok(w.srv.filasDe(A).every((f) => f.fecha === F5));
});

await t("reanudacion con sincronizacion pendiente: pendientes c1 + reinicio + medianoche -> sesion c2 nueva (6/11); el flush envia c1 en c1", async () => {
  const w = mundo(T_2350);
  w.iniciar();
  w.online = false;
  const c1 = w.logSet(EX0);
  w.reloj.set(T_2358);
  w.reiniciar();   // el entrenador reinicia desde su dispositivo: el ancla del alumno queda
  assert.ok(leerSesionActiva(w.storage));
  w.reloj.set(T_0005);
  const r = w.iniciar();
  assert.equal(r.recuperada, false);
  assert.equal(r.motivo, "otro_ciclo", "no se continua una sesion de otro ciclo aunque sea la misma rutina y dia");
  assert.equal(r.session.fecha, F6);
  const c2 = w.logSet(EX0);
  w.online = true;
  await w.flush();
  const p1 = w.srv.posts.find((p) => p.id === c1);
  const p2 = w.srv.posts.find((p) => p.id === c2);
  assert.ok(!("ciclo" in p1));
  assert.equal(p1.fecha, F5);
  assert.equal(p2.ciclo, 2);
  assert.equal(p2.fecha, F6);
  w.rehidratar();
  assert.equal(w.hoy(EX0.id, 2).length, 1, "el ciclo 2 del 6/11 ve solo su serie");
  assert.equal(filterSetsByDay(w.sets(EX0.id), F5, 0, false, 1).length, 1, "la serie c1 sigue en el 5/11");
});

await t("cambio de alumno: B no ve ni envia los pendientes de A y no recupera su ancla; B no borra el ancla de A", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  w.online = false;
  w.logSet(EX0);
  w.alumnoId = B;
  w.session = null;
  w.reloj.set(T_0005);
  const r = w.iniciar(B);
  assert.equal(r.recuperada, false);
  assert.equal(r.motivo, "otro_alumno");
  assert.equal(r.session.fecha, F6);
  assert.deepEqual(visiblePendingItems(w.storage, B), []);
  w.online = true;
  assert.equal((await w.flush(B)).sent, 0);
  assert.equal(w.srv.posts.length, 0);
  assert.equal(visiblePendingItems(w.storage, A).length, 1, "los pendientes de A quedan en el dispositivo");
  // PR-2 (transitorio): B NO sobrescribe el ancla vigente de A; un cierre de B nunca borra la de A (y viceversa).
  assert.equal(leerSesionActiva(w.storage).alumnoId, A);
  assert.equal(cerrarSesionActiva(w.storage, { alumnoId: B, session: { rId: w.rutina.id, dIdx: 0, startTime: T_2355 } }), false);
  assert.equal(leerSesionActiva(w.storage).alumnoId, A, "el cierre de B no borro el ancla de A");
});

await t("series con y sin ciclo explicito: payload, hidratacion, filtro del dia y precarga", () => {
  assert.ok(!("ciclo" in buildPendingProgressItem("x", 60, 8, "", F5, 0, 1, A, generateOpId())));
  assert.equal(buildPendingProgressItem("x", 60, 8, "", F5, 0, 2, A, generateOpId()).ciclo, 2);
  assert.ok(!("ciclo" in buildProgressPayload(A, "x", 60, 8, "", F5, 0, 1, generateOpId())));
  // Serie local anterior a D7.1 (sin ciclo ni id) + filas hidratadas de los ciclos 1 y 2 con los mismos valores.
  const legacy = buildExerciseSetRecord(60, 8, F5, 0, "", null, undefined);
  assert.equal(legacy.ciclo, undefined);
  const id1 = generateOpId(), id2 = generateOpId();
  const rows = [
    { id: id1, alumno_id: A, ejercicio_id: "x", kg: 60, reps: 8, fecha: F5, semana: 0, nota: "", created_at: "2026-11-05T10:00:00.000Z", ciclo: 1 },
    { id: id2, alumno_id: A, ejercicio_id: "x", kg: 60, reps: 8, fecha: F5, semana: 0, nota: "", created_at: "2026-11-05T11:00:00.000Z", ciclo: 2 },
  ];
  const hydrated = hydrateProgressFromRows(rows);
  const merged = mergeProgressEntries({ sets: [legacy], max: 60 }, hydrated.x);
  assert.equal(merged.sets.length, 2, "la serie sin ciclo se empareja con una hidratada (comportamiento anterior), nunca suma");
  assert.deepEqual(merged.sets.map((s) => rowCiclo(s)).sort(), [1, 2], "ningun ciclo re-atribuido");
  // Sin ciclo explicito no se filtra por ciclo (comportamiento anterior): cuenta para cualquier ciclo.
  assert.equal(filterSetsByDay([legacy], F5, 0, false, 2).length, 1);
  assert.equal(filterSetsByDay([hydrated.x.sets[0], hydrated.x.sets[1]], F5, 0, false, 2).length, 1);
  // Precarga con cargas en cero tras un reinicio: con ciclo decide el ciclo; sin ciclo, created_at/fecha frente al reinicio.
  const datos = buildReinicioDatos({ ciclo_actual: 1, semana_activa: 3 }, { tipo: "rutina", cargas: "cero", nowIso: new Date(T_1000).toISOString() });
  const c2Set = buildExerciseSetRecord(50, 8, F5, 0, "", null, 2);
  const viejaSinCiclo = Object.assign(buildExerciseSetRecord(70, 8, "4/11/2026", 0, "", null, undefined));
  assert.deepEqual(setsForLoadPrefill([c2Set, hydrated.x.sets[1], viejaSinCiclo], datos).map((s) => s.kg), [50], "solo el ciclo vigente (2) precarga");
});

await t("finalizacion y avance de semana: semana completa avanza una vez; el reintento no avanza dos veces ni duplica la sesion", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  w.logSet(EX0); w.logSet(EX1);
  await w.esperar();
  w.reloj.set(T_0010);
  // La rutina del servidor y la copia local del alumno son objetos distintos: la sesion abierta conserva su semana (1).
  const enServidor = Object.assign({}, w.rutina, { datos: Object.assign({}, w.rutina.datos) });
  w.srv.rutinas.set(w.rutina.id, enServidor);
  const o1 = await w.finalizar({ mantenerSesion: true });
  assert.equal(o1.status, "saved");
  assert.equal(o1.source, SESSION_CONFIRMED_BY.INSERT);
  assert.equal(o1.week.complete, true);
  assert.equal(o1.week.advance, "ok");
  assert.equal(enServidor.datos.semana_activa, 2);
  assert.equal(w.rutina.datos.semana_activa, 1);
  // Reintento a las 00:12 con la misma sesion (p. ej. el resumen no llego a mostrarse): la busqueda usa la fecha 5/11 y la encuentra.
  w.reloj.set(T_0012);
  const o2 = await w.finalizar({ mantenerSesion: true });
  assert.equal(o2.status, "saved");
  assert.equal(o2.source, SESSION_CONFIRMED_BY.EXISTING);
  assert.equal(o2.week.advance, "not_needed", "ya avanzo hoy (clave del 5/11)");
  // Otro dispositivo (sin la marca local): el servidor es monotono, no avanza dos veces.
  const o3 = await w.finalizar({ lastAdvanceDate: null, mantenerSesion: true });
  assert.equal(o3.source, SESSION_CONFIRMED_BY.EXISTING);
  assert.equal(o3.week.advance, "ok", "el servidor ya esta en semana 2: confirma sin escribir");
  assert.equal(w.srv.sesionPosts.length, 1, "una sola sesion");
  assert.equal(w.srv.sesiones.length, 1);
  assert.equal(w.srv.sesiones[0].fecha, F5);
  assert.deepEqual(w.srv.avances, [2], "la semana avanzo una sola vez");
});

// ───────── Regresiones #154 a #157 ─────────
await t("#154 write-ahead: el pendiente existe ANTES del envio; tras un 500 el reintento usa el MISMO opId y deja 1 fila", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  w.srv.fallarPosts(1);
  const op = w.logSet(EX0);
  const [res] = await w.esperar();
  assert.equal(w.writeAheadAntesDelEnvio, true);
  assert.equal(res.confirmed, false);
  assert.deepEqual(visiblePendingItems(w.storage, A).map((p) => p.opId), [op]);
  w.reloj.set(T_0005);
  assert.equal((await w.flush()).sent, 1);
  assert.ok(w.srv.posts.length === 2 && w.srv.posts.every((p) => p.id === op));
  assert.equal(w.srv.filas.size, 1);
  assert.equal(w.srv.filas.get(op).fecha, F5, "el reintento despues de medianoche conserva la fecha de la sesion");
});

await t("#155 una lectura fallida de sesiones no se toma como 'cero sesiones': finalizar no hace POST", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  w.logSet(EX0); w.logSet(EX1);
  await w.esperar();
  w.reloj.set(T_0010);
  w.srv.fallarLecturasSesiones(1);
  const out = await w.finalizar();
  assert.equal(out.status, "failed");
  assert.equal(out.reason, FINALIZE_FAILURE.LOOKUP_FAILED);
  assert.equal(w.srv.sesionPosts.length, 0);
  assert.ok(w.session, "el entrenamiento sigue abierto");
  assert.ok(leerSesionActiva(w.storage), "y su ancla tambien");
});

await t("#156 un toque = una serie (createSetLogGuard): el doble toque no registra; el reintento tras un fallo reutiliza el opId", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  const guard = createSetLogGuard({ generateId: generateOpId });
  const scope = A + "|" + w.rutina.id + "|0|" + w.session.startTime + "|" + EX0.id;
  const r1 = guard.attempt(scope, (opId) => w.logSet(EX0, opId));
  const r2 = guard.attempt(scope, (opId) => w.logSet(EX0, opId));
  assert.equal(r1.status, "logged");
  assert.equal(r2.status, "busy");
  assert.equal(w.sets(EX0.id).length, 1);
  assert.equal(guard.finishConfirmation(r1.token), true);
  let primero = null;
  const f = guard.attempt(scope, (opId) => { primero = opId; return false; });
  assert.equal(f.status, "failed");
  const ok = guard.attempt(scope, (opId) => w.logSet(EX0, opId));
  assert.equal(ok.opId, primero, "mismo opId en el reintento");
  await w.esperar();
  assert.equal(w.srv.filas.size, 2);
  assert.equal(w.sets(EX0.id)[0].id, primero);
});

await t("#157 el controlador real envia los pendientes al volver online (evento 'online'), con la fecha de la sesion y su ciclo", async () => {
  const w = mundo(T_2355);
  w.iniciar();
  w.online = false;
  w.reloj.set(T_2358); w.logSet(EX0);
  w.reloj.set(T_0003); w.logSet(EX1);
  const win = new EventTarget();
  const doc = new EventTarget();
  doc.visibilityState = "visible";
  const ctl = createPendingSyncController({
    storage: w.storage, getAlumnoId: () => w.alumnoId, isOnline: () => w.online, isInFlight: isSetSendInFlight,
    sendItem: (item, aid) => w.sendItem(aid)(item), timeoutMs: TIMEOUT, locks: null, retryDelaysMs: [],
  });
  const detach = attachSyncTriggers(ctl, { win, doc });
  try {
    await ctl.trigger("session");
    assert.equal(ctl.getState().status, "offline");
    assert.equal(w.srv.posts.length, 0);
    w.online = true;
    win.dispatchEvent(new Event("online"));
    for (let i = 0; i < 50 && ctl.isFlushing(); i++) await new Promise((r) => setTimeout(r, 5));
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(ctl.getState().pending, 0);
    assert.equal(w.srv.filas.size, 2);
    assert.ok(w.srv.filasDe(A).every((f) => f.fecha === F5 && rowCiclo(f) === 1));
  } finally {
    detach();
    ctl.dispose();
  }
});

await t("el ancla solo guarda ids, numeros y la fecha (sin datos personales)", () => {
  const w = mundo(T_2355);
  w.iniciar();
  const raw = JSON.parse(w.storage.getItem(ACTIVE_WORKOUT_KEY));
  assert.deepEqual(Object.keys(raw).sort(), ["alumnoId", "ciclo", "dIdx", "fecha", "rId", "semana", "sessionId", "startTime", "v"]);
});

console.log("\n" + n + " pruebas OK" + (failed ? ", " + failed + " FALLIDAS" : ""));
if (failed) process.exit(1);
