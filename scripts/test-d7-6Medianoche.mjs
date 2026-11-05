// D76-05 — fecha estable del entrenamiento activo: cruce de medianoche, recarga de Safari y reintento de finalizacion.
//   node scripts/test-d7-6Medianoche.mjs
// Datos ficticios, sin red: el almacenamiento y el "servidor" son objetos en memoria. Ejecuta la logica REAL
// (lib/workoutSessionDate.js, lib/workoutSession.js, lib/finalizeWorkoutSession.js) y un SSR de components/WorkoutScreen.jsx.
// Las horas se construyen en hora LOCAL (new Date(2026, 10, 5, 23, 55)), asi el test no depende de la TZ del runner.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import {
  ACTIVE_WORKOUT_KEY, ACTIVE_WORKOUT_MAX_MS, esFechaSesionValida, fechaLocalDe, fechaDeSesion, claveDiaDeSesion,
  leerSesionActiva, prepararInicioEntrenamiento, cerrarSesionActiva,
} from "../lib/workoutSessionDate.js";
import { buildExerciseSetRecord, calculateDayProgress, updateExerciseProgressRecord } from "../lib/workoutSession.js";
import { finalizeStudentSession, FINALIZE_FAILURE, SESSION_CONFIRMED_BY } from "../lib/finalizeWorkoutSession.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let n = 0;
let failed = 0;
const t = async (name, fn) => {
  try { await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.error("FAIL -", name); console.error(e); }
};

// Instantes locales ficticios (5 y 6 de noviembre de 2026).
const T_2355 = new Date(2026, 10, 5, 23, 55).getTime();
const T_2359 = new Date(2026, 10, 5, 23, 59).getTime();
const T_0005 = new Date(2026, 10, 6, 0, 5).getTime();
const T_0010 = new Date(2026, 10, 6, 0, 10).getTime();
const T_0300 = new Date(2026, 10, 6, 3, 0).getTime();
const F5 = "5/11/2026";
const F6 = "6/11/2026";
const CLAVE5 = new Date(2026, 10, 5).toDateString();
const CLAVE6 = new Date(2026, 10, 6).toDateString();
const ALUMNO_A = "alumno-demo-a";
const ALUMNO_B = "alumno-demo-b";
const RUTINA = "rutina-demo-1";

const memStorage = (o) => {
  const m = new Map();
  const opts = o || {};
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (opts.fallaSet) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
};
const iniciar = (storage, o) => prepararInicioEntrenamiento(Object.assign({
  storage, session: { rId: RUTINA, dIdx: 0, exIdx: 0, startTime: o.now }, alumnoId: ALUMNO_A, ciclo: 1, semana: 0,
}, o));

// Progreso con series de un ejercicio (cada una con la fecha que corresponda).
const progresoCon = (exId, sets) => sets.reduce((acc, s) => {
  acc[exId] = updateExerciseProgressRecord(acc[exId], s);
  return acc;
}, {});

// ───────── 0. utilidades ─────────
await t("esFechaSesionValida / fechaLocalDe", () => {
  assert.equal(esFechaSesionValida(F5), true);
  assert.equal(esFechaSesionValida("31/2/2026"), false);
  assert.equal(esFechaSesionValida("2026-11-05"), false);
  assert.equal(esFechaSesionValida(null), false);
  assert.equal(fechaLocalDe(T_2355), F5);
  assert.equal(fechaLocalDe(T_0010), F6);
  assert.equal(fechaLocalDe(NaN), null);
  assert.equal(fechaLocalDe(0), null);
  assert.equal(fechaDeSesion(null, T_0010), F6, "sin sesion = hoy (comportamiento anterior)");
  assert.equal(fechaDeSesion({ startTime: T_2355 }, T_0010), F5, "sin fecha usa el inicio");
  assert.equal(fechaDeSesion({ fecha: "basura", startTime: "x" }, T_0010), F6);
});

// ───────── 1. inicio 23:55, finalizacion 00:10 ─────────
await t("1. inicio 23:55 y finalizacion 00:10: la fecha y la clave de dia son las del 5/11", () => {
  const { session } = iniciar(memStorage(), { now: T_2355 });
  assert.equal(session.fecha, F5);
  assert.equal(fechaDeSesion(session, T_0010), F5);
  assert.equal(claveDiaDeSesion(session, T_0010), CLAVE5);
  assert.notEqual(new Date(T_0010).toLocaleDateString("es-AR"), F5, "la logica anterior daba otra fecha");
});

// ───────── 2. series antes y despues de medianoche ─────────
const EX_A = { id: "ex-demo-a", sets: "2", reps: "8" };
const EX_B = { id: "ex-demo-b", sets: "1", reps: "8" };
await t("2. series 23:58 y 00:03 quedan con la misma fecha; progreso 100% (FINALIZAR) y la logica vieja caia", () => {
  const session = iniciar(memStorage(), { now: T_2355 }).session;
  const t1 = new Date(2026, 10, 5, 23, 58).getTime();
  const t2 = new Date(2026, 10, 6, 0, 3).getTime();
  const s1 = buildExerciseSetRecord(60, 8, fechaDeSesion(session, t1), 0, "", null, 1);
  const s2 = buildExerciseSetRecord(40, 8, fechaDeSesion(session, t2), 0, "", null, 1);
  assert.equal(s1.date, F5);
  assert.equal(s2.date, F5);
  const progress = Object.assign(progresoCon(EX_A.id, [s1]), progresoCon(EX_B.id, [s2]));
  const nuevo = calculateDayProgress([EX_A, EX_B], progress, fechaDeSesion(session, T_0010), 0, { checkWeek: false, ciclo: 1 });
  assert.equal(nuevo.pct, 100);
  assert.equal(nuevo.done >= 2, true, "workoutReadyToFinish = true");
  // Logica anterior: cada serie con la fecha del reloj y el progreso calculado con la fecha de las 00:10.
  const v1 = buildExerciseSetRecord(60, 8, new Date(t1).toLocaleDateString("es-AR"), 0, "", null, 1);
  const v2 = buildExerciseSetRecord(40, 8, new Date(t2).toLocaleDateString("es-AR"), 0, "", null, 1);
  assert.notEqual(v1.date, v2.date, "antes: dos fechas en el mismo entrenamiento");
  const progV = Object.assign(progresoCon(EX_A.id, [v1]), progresoCon(EX_B.id, [v2]));
  const viejo = calculateDayProgress([EX_A, EX_B], progV, new Date(T_0010).toLocaleDateString("es-AR"), 0, { checkWeek: false, ciclo: 1 });
  assert.equal(viejo.pct, 50, "antes: el progreso caia y FINALIZAR desaparecia");
});

// ───────── 3. SSR real de WorkoutScreen con el reloj a las 00:10 ─────────
await t("3. SSR de WorkoutScreen a las 00:10: con la serie del 5/11 aparece FINALIZAR; con otra fecha no", async () => {
  const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-d765-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents:
        'import React from "react";' +
        'import { renderToStaticMarkup } from "react-dom/server";' +
        'import { WorkoutScreen } from "./components/WorkoutScreen.jsx";' +
        "export { React, renderToStaticMarkup, WorkoutScreen };",
      resolveDir: ROOT, sourcefile: "d765-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
    jsx: "automatic",   // como Vite (@vitejs/plugin-react): hay componentes que no importan React
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  const { React, renderToStaticMarkup, WorkoutScreen } = await import(pathToFileURL(outfile).href);
  const RealDate = globalThis.Date;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(T_0010); else super(...a); }
    static now() { return T_0010; }
  }
  const noop = () => {};
  const EX1 = { id: "ex-demo-ssr", sets: "1", reps: "8" };
  const render = (session, fechaSerie) => renderToStaticMarkup(React.createElement(WorkoutScreen, {
    session, activeDay: { name: "Dia demo", exercises: [EX1] }, activeR: { id: RUTINA, name: "Rutina demo", days: [{}], datos: { semana_activa: 1, ciclo_actual: 1 } },
    allEx: [{ id: EX1.id, name: "Ejercicio demo", pattern: "rodilla" }],
    progress: progresoCon(EX1.id, [buildExerciseSetRecord(50, 8, fechaSerie, 0, "", null, 1)]),
    logSet: () => true, startTimer: noop, timer: null, setSession: noop, setCompletedDays: noop, completedDays: [], currentWeek: 0,
    setCurrentWeek: noop, preSessionPRs: {}, setResumenSesion: noop, readOnly: false, sharedParam: null, sb: {}, es: true, darkMode: true,
    prCelebration: null, setPrCelebration: noop, activeExIdx: 0, setActiveExIdx: noop, sessionData: { role: "alumno", alumnoId: ALUMNO_A },
    sessionPRList: [], videoOverrides: {}, setVideoModal: noop, toast2: noop, pendingSyncState: null, onPendingSyncRetry: noop,
  }));
  globalThis.Date = FakeDate;
  let conFecha, otraFecha, sinFechaHoy;
  try {
    assert.equal(new Date().toLocaleDateString("es-AR"), F6, "reloj simulado a las 00:10 del 6/11");
    conFecha = render({ rId: RUTINA, dIdx: 0, exIdx: 0, startTime: T_2355, fecha: F5 }, F5);
    otraFecha = render({ rId: RUTINA, dIdx: 0, exIdx: 0, startTime: T_2355, fecha: F5 }, "4/11/2026");
    sinFechaHoy = render({ rId: RUTINA, dIdx: 0, exIdx: 0 }, F6);
  } finally {
    globalThis.Date = RealDate;
  }
  assert.equal(globalThis.Date, RealDate, "Date restaurado");
  assert.match(conFecha, /FINALIZAR ENTRENAMIENTO/, "la serie de antes de medianoche sigue contando");
  assert.doesNotMatch(otraFecha, /FINALIZAR ENTRENAMIENTO/, "control negativo: una serie de otra fecha no habilita FINALIZAR");
  assert.match(sinFechaHoy, /FINALIZAR ENTRENAMIENTO/, "sin fecha ni inicio: hoy (comportamiento anterior)");
});

// ───────── 4. recarga de Safari a las 00:05 ─────────
await t("4. recarga a las 00:05: se recupera el mismo entrenamiento con fecha 5/11 y su inicio original", () => {
  const storage = memStorage();
  const r1 = iniciar(storage, { now: T_2355 });
  assert.equal(r1.recuperada, false);
  assert.equal(r1.motivo, "sin_ancla");
  assert.ok(storage.getItem(ACTIVE_WORKOUT_KEY), "ancla escrita");
  const ancla = leerSesionActiva(storage);
  assert.deepEqual(Object.keys(ancla).sort(), ["alumnoId", "ciclo", "dIdx", "fecha", "rId", "semana", "startTime", "v"]);
  // "Recarga": la session en memoria se perdio; el alumno toca Iniciar de nuevo (startTime nuevo).
  const r2 = iniciar(storage, { now: T_0005 });
  assert.equal(r2.recuperada, true);
  assert.equal(r2.motivo, "ancla");
  assert.equal(r2.session.fecha, F5);
  assert.equal(r2.session.startTime, T_2355);
  assert.equal(r2.session.ciclo, 1);
});

// ───────── 5. segundo plano ─────────
await t("5. cambio de fecha con la app en segundo plano: la session en memoria mantiene el 5/11", () => {
  const { session } = iniciar(memStorage(), { now: T_2355 });
  const copia = JSON.stringify(session);
  assert.equal(fechaDeSesion(session, T_0300), F5);
  assert.equal(claveDiaDeSesion(session, T_0300), CLAVE5);
  assert.equal(JSON.stringify(session), copia, "no se muta");
});

// ───────── 6. reintento de finalizacion ─────────
const sbFalso = (opts) => {
  const filas = [];
  let getN = 0;
  let posts = 0;
  return {
    filas,
    posts: () => posts,
    getSesiones: async () => {
      getN++;
      if (opts.fallaGet && opts.fallaGet(getN)) return null;
      return filas.slice();
    },
    addSesion: async (payload) => {
      posts++;
      filas.push(Object.assign({ id: "fila-" + filas.length }, payload));
      if (opts.pierdeRespuesta && opts.pierdeRespuesta(posts)) throw new Error("respuesta perdida");
      return [filas[filas.length - 1]];
    },
    getSesionesByAlumnoRutinaSemana: async () => (opts.semana ? opts.semana(filas) : filas.slice()),
  };
};
const finalizar = (sb, session, now, extra) => {
  const date = extra && extra.date ? extra.date : fechaDeSesion(session, now);
  return finalizeStudentSession(Object.assign({
    sb, alumnoId: ALUMNO_A, timeoutMs: 1000, isOnline: true,
    payload: { alumno_id: ALUMNO_A, fecha: date, dia_idx: session.dIdx, semana: 1, ciclo: 1 },
    date, dayIndex: session.dIdx, weekToSave: 1, ciclo: 1,
    effectiveWeek: 3, totalDays: 1, lastAdvanceDate: null, todayStr: claveDiaDeSesion(session, now),
    rutinaId: RUTINA, rutinaNombre: "Rutina demo", updateRutinaWeek: async () => [{ id: RUTINA }],
  }, extra || {}));
};
await t("6. reintento 00:10 tras respuesta perdida a las 23:59: encuentra la fila (EXISTING), sin 2º POST; la logica vieja duplicaba", async () => {
  const session = iniciar(memStorage(), { now: T_2355 }).session;
  // GET previo OK (1), POST inserta pero se pierde la respuesta, GET de comprobacion falla (2).
  const sb = sbFalso({ pierdeRespuesta: (k) => k === 1, fallaGet: (k) => k === 2 });
  const o1 = await finalizar(sb, session, T_2359);
  assert.equal(o1.status, "failed");
  assert.equal(o1.reason, FINALIZE_FAILURE.UNCONFIRMED);
  assert.equal(sb.filas.length, 1, "la fila SI quedo insertada");
  const o2 = await finalizar(sb, session, T_0010);
  assert.equal(o2.status, "saved");
  assert.equal(o2.source, SESSION_CONFIRMED_BY.EXISTING);
  assert.equal(sb.posts(), 1, "sin segundo POST");
  assert.equal(sb.filas.length, 1, "sesion confirmada una sola vez");
  // Control: la logica anterior (fecha del reloj a las 00:10) no encontraba la fila e insertaba otra.
  const sbV = sbFalso({ pierdeRespuesta: (k) => k === 1, fallaGet: (k) => k === 2 });
  await finalizar(sbV, session, T_2359, { date: new Date(T_2359).toLocaleDateString("es-AR") });
  const o2v = await finalizar(sbV, session, T_0010, { date: new Date(T_0010).toLocaleDateString("es-AR") });
  assert.equal(o2v.status, "saved");
  assert.equal(o2v.source, SESSION_CONFIRMED_BY.INSERT);
  assert.equal(sbV.filas.length, 2, "antes: doble registro del mismo entrenamiento");
});

// ───────── 7. cambio de alumno ─────────
await t("7. ancla del alumno A no se usa para el alumno B", () => {
  const storage = memStorage();
  iniciar(storage, { now: T_2355, alumnoId: ALUMNO_A });
  const rB = iniciar(storage, { now: T_0010, alumnoId: ALUMNO_B });
  assert.equal(rB.recuperada, false);
  assert.equal(rB.motivo, "otro_alumno");
  assert.equal(rB.session.fecha, F6);
  assert.equal(rB.session.startTime, T_0010);
  assert.equal(String(leerSesionActiva(storage).alumnoId), ALUMNO_B, "el ancla pasa a ser de B");
});

// ───────── 8. ciclo nuevo + medianoche ─────────
await t("8. reinicio (ciclo 2) y medianoche a la vez: sesion nueva del 6/11; las series del ciclo 1 no cuentan", () => {
  const storage = memStorage();
  const s1 = iniciar(storage, { now: T_2355, ciclo: 1 }).session;
  const serieC1 = buildExerciseSetRecord(60, 8, fechaDeSesion(s1, T_2359), 0, "", null, 1);
  const r2 = iniciar(storage, { now: T_0010, ciclo: 2 });
  assert.equal(r2.recuperada, false);
  assert.equal(r2.motivo, "otro_ciclo");
  assert.equal(r2.session.fecha, F6);
  assert.equal(r2.session.ciclo, 2);
  const progress = progresoCon(EX_B.id, [serieC1]);
  assert.equal(calculateDayProgress([EX_B], progress, fechaDeSesion(r2.session, T_0010), 0, { checkWeek: false, ciclo: 2 }).done, 0);
  // Aun con la misma fecha, el filtro por ciclo excluye la serie del ciclo 1.
  assert.equal(calculateDayProgress([EX_B], progress, F5, 0, { checkWeek: false, ciclo: 2 }).done, 0);
});

// ───────── 9. politica conservadora ─────────
await t("9. politica conservadora: vencida, corrupta, futura, otra semana, otro dia -> no se recupera; sin alumno no escribe", () => {
  const vencida = memStorage();
  iniciar(vencida, { now: T_2355 });
  const rv = iniciar(vencida, { now: T_2355 + ACTIVE_WORKOUT_MAX_MS + 1 });
  assert.equal(rv.recuperada, false); assert.equal(rv.motivo, "vencida");
  assert.equal(rv.session.fecha, fechaLocalDe(T_2355 + ACTIVE_WORKOUT_MAX_MS + 1));

  const corrupta = memStorage();
  corrupta.setItem(ACTIVE_WORKOUT_KEY, "{no es json");
  assert.equal(leerSesionActiva(corrupta), null);
  assert.equal(corrupta.getItem(ACTIVE_WORKOUT_KEY), "{no es json", "leer no borra");
  const rc = iniciar(corrupta, { now: T_0010 });
  assert.equal(rc.recuperada, false); assert.equal(rc.motivo, "invalida"); assert.equal(rc.session.fecha, F6);
  const campos = memStorage();
  campos.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({ v: 1, alumnoId: ALUMNO_A, rId: RUTINA, dIdx: 0, ciclo: 1, semana: 0, startTime: T_2355, fecha: "31/2/2026" }));
  assert.equal(leerSesionActiva(campos), null, "fecha inexistente -> ancla invalida");

  const futura = memStorage();
  iniciar(futura, { now: T_0300 });
  const rf = iniciar(futura, { now: T_0010 });
  assert.equal(rf.recuperada, false); assert.equal(rf.motivo, "invalida");

  const semana = memStorage();
  iniciar(semana, { now: T_2355, semana: 0 });
  const rs = iniciar(semana, { now: T_0005, semana: 1 });
  assert.equal(rs.recuperada, false); assert.equal(rs.motivo, "otra_semana"); assert.equal(rs.session.fecha, F6);

  const dia = memStorage();
  iniciar(dia, { now: T_2355 });
  const rd = iniciar(dia, { now: T_0005, session: { rId: RUTINA, dIdx: 1, exIdx: 0, startTime: T_0005 } });
  assert.equal(rd.recuperada, false); assert.equal(rd.motivo, "otro_dia");
  const rr = iniciar(dia, { now: T_0005, session: { rId: "otra-rutina", dIdx: 1, exIdx: 0, startTime: T_0005 } });
  assert.equal(rr.motivo, "otro_dia");

  const sinAlumno = memStorage();
  sinAlumno.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({ v: 1, alumnoId: ALUMNO_A, rId: RUTINA, dIdx: 0, ciclo: 1, semana: 0, startTime: T_2355, fecha: F5 }));
  const ra = iniciar(sinAlumno, { now: T_0005, alumnoId: null });
  assert.equal(ra.recuperada, false, "entrenador / compartido: no recupera");
  assert.equal(ra.session.fecha, F6);
  const vacio = memStorage();
  iniciar(vacio, { now: T_0005, alumnoId: null });
  assert.equal(vacio.getItem(ACTIVE_WORKOUT_KEY), null, "sin alumno no escribe ancla");

  const sinEspacio = memStorage({ fallaSet: true });
  const re = iniciar(sinEspacio, { now: T_2355 });
  assert.equal(re.session.fecha, F5, "si setItem falla la sesion sigue en memoria");
  assert.doesNotThrow(() => prepararInicioEntrenamiento(null));
  assert.doesNotThrow(() => prepararInicioEntrenamiento({ storage: null, alumnoId: ALUMNO_A, now: T_0005 }));
});

// ───────── 10. cerrarSesionActiva ─────────
await t("10. cerrarSesionActiva solo borra el ancla propia; tras finalizar un nuevo inicio no recupera", () => {
  const storage = memStorage();
  const { session } = iniciar(storage, { now: T_2355 });
  assert.equal(cerrarSesionActiva(storage, { alumnoId: ALUMNO_B, session }), false);
  assert.equal(cerrarSesionActiva(storage, { alumnoId: ALUMNO_A, session: Object.assign({}, session, { startTime: T_0005 }) }), false);
  assert.equal(cerrarSesionActiva(storage, { alumnoId: ALUMNO_A, session: Object.assign({}, session, { dIdx: 2 }) }), false);
  assert.ok(storage.getItem(ACTIVE_WORKOUT_KEY));
  assert.equal(cerrarSesionActiva(storage, { alumnoId: ALUMNO_A, session }), true);
  assert.equal(storage.getItem(ACTIVE_WORKOUT_KEY), null);
  const r = iniciar(storage, { now: T_0010 });
  assert.equal(r.recuperada, false);
  assert.equal(r.session.fecha, F6);
  assert.equal(cerrarSesionActiva(memStorage(), { alumnoId: ALUMNO_A, session }), false, "sin ancla");
});

// ───────── 11. avance de semana ─────────
await t("11. avance de semana: la clave de dia es la del inicio; no avanza dos veces el mismo dia, si en un dia distinto", async () => {
  const session = iniciar(memStorage(), { now: T_2355 }).session;
  const otraSesionMismoDia = { rId: RUTINA, dIdx: 1, startTime: new Date(2026, 10, 5, 9, 0).getTime(), fecha: F5 };
  const lastAdvanceDate = claveDiaDeSesion(otraSesionMismoDia, T_0010);
  assert.equal(lastAdvanceDate, CLAVE5);
  let updates = 0;
  const extra = (o) => Object.assign({ effectiveWeek: 0, totalDays: 1, updateRutinaWeek: async () => { updates++; return [{ id: RUTINA }]; } }, o);
  const o1 = await finalizar(sbFalso({}), session, T_0010, extra({ lastAdvanceDate }));
  assert.equal(o1.status, "saved");
  assert.equal(o1.week.advance, "not_needed", "ya se avanzo el 5/11");
  assert.equal(updates, 0);
  // Logica anterior: todayStr = 6/11 -> habria avanzado una segunda vez.
  const o1v = await finalizar(sbFalso({}), session, T_0010, extra({ lastAdvanceDate, todayStr: new Date(T_0010).toDateString() }));
  assert.equal(o1v.week.advance, "ok");
  assert.equal(updates, 1);
  // Dia distinto (el ultimo avance fue el 4/11): la semana completa si avanza.
  const o2 = await finalizar(sbFalso({}), session, T_0010, extra({ lastAdvanceDate: new Date(2026, 10, 4).toDateString() }));
  assert.equal(o2.week.advance, "ok");
  assert.equal(updates, 2);
  assert.notEqual(CLAVE5, CLAVE6);
});

// ───────── 12. zona horaria ─────────
await t("12. el mismo instante UTC da la fecha local de cada zona (Buenos Aires / Tokio)", () => {
  const url = pathToFileURL(path.join(ROOT, "lib/workoutSessionDate.js")).href;
  const instante = Date.UTC(2026, 10, 6, 2, 0); // 23:00 del 5/11 en Buenos Aires, 11:00 del 6/11 en Tokio
  const correr = (tz) => {
    const r = spawnSync(process.execPath, ["--input-type=module", "-e",
      "import { fechaLocalDe, fechaDeSesion } from " + JSON.stringify(url) + ";" +
      "console.log(fechaLocalDe(" + instante + ") + '|' + fechaDeSesion({ startTime: " + instante + " }, " + (instante + 3 * 3600 * 1000) + "));"],
    { env: Object.assign({}, process.env, { TZ: tz }), encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  };
  assert.equal(correr("America/Argentina/Buenos_Aires"), F5 + "|" + F5, "en BA la sesion sigue en el 5/11 aunque a las 02:00 ya sea 6/11");
  assert.equal(correr("Asia/Tokyo"), F6 + "|" + F6);
});

// ───────── 13. verificacion textual ─────────
await t("13. WorkoutScreen y logSet ya no usan la fecha del reloj para hoy/hoyFin/d/todayStr", () => {
  const ws = read("components/WorkoutScreen.jsx");
  assert.doesNotMatch(ws, /new Date\(\)\.toLocaleDateString\("es-AR"\)/);
  assert.doesNotMatch(ws, /new Date\(\)\.toDateString\(\)/);
  assert.match(ws, /const hoy\s+= fechaDeSesion\(session, Date\.now\(\)\);/);
  assert.match(ws, /const hoyFin = fechaDeSesion\(session, Date\.now\(\)\);/);
  assert.equal((ws.match(/const todayStr = claveDiaDeSesion\(session, Date\.now\(\)\);/g) || []).length, 2);
  assert.match(ws, /cerrarSesionActiva\(localStorage, \{ alumnoId: sessionData\.alumnoId, session: session \}\)/);
  assert.match(ws, /const cicloVigente = readCicloActual\(activeR && activeR\.datos\);/);
  const app = read("App.jsx");
  const logSet = app.slice(app.indexOf("const logSet = ("), app.indexOf("const logSet = (") + 600);
  assert.doesNotMatch(logSet, /new Date\(\)\.toLocaleDateString/);
  assert.match(logSet, /const d = fechaDeSesion\(session, Date\.now\(\)\);/);
  const start = app.slice(app.indexOf("const startStudentWorkout = function"), app.indexOf("const alumnoPlanHeaderDayNum"));
  assert.match(start, /prepararInicioEntrenamiento\(/);
  assert.equal((start.match(/setSession\(/g) || []).length, 1, "un solo setSession, dentro de iniciar()");
  assert.match(start, /nextSession = prepararInicioEntrenamiento\(\{[\s\S]*?\}\)\.session;\s*setSession\(nextSession\);/);
  assert.equal((start.match(/iniciar\(\);/g) || []).length, 3);
});

console.log("\n" + n + " pruebas OK" + (failed ? ", " + failed + " FALLIDAS" : ""));
if (failed) process.exit(1);
