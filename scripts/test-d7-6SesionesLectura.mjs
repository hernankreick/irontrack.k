// D76-02 — Lectura de sesiones del alumno: una lectura fallida NO se aplica como "cero sesiones" (que mostraba "Dia 1").
//   node scripts/test-d7-6SesionesLectura.mjs
// Pruebas de comportamiento con lecturas falsas controlables. La posicion visible se calcula con getActiveStudentRoutinePosition REAL
// (lib/studentWeeklyProgress.js), igual que App. `legacy*` reproduce el comportamiento anterior (FIX B + `setSesiones(ses || [])`).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SESIONES_LECTURA_TIMEOUT_MS, clasificarRespuestaSesiones, leerSesionesAlumno, estadoInicialSesiones, iniciarLecturaSesiones,
  aplicarLecturaSesiones, registrarSesionConfirmada, resetSesiones, sesionesConfiables, necesitaReintento, crearControladorSesiones,
  estadoPlanAlumno, puedeIniciarEntrenamientoAlumno, manejarSesionGuardada,
} from "../lib/sesionesLectura.js";
import { getActiveStudentRoutinePosition } from "../lib/studentWeeklyProgress.js";

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

// ── utilidades ────────────────────────────────────────────────────────────────
const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const OK = (data) => ({ ok: true, status: 200, data });
const HTTP = (status) => ({ ok: false, status, data: { message: "error" } });
const RED = { red: true };
const NUNCA = { nunca: true };
/** leer(alumnoId) que devuelve las respuestas en orden: objeto {ok,status,data} | RED (rechaza) | NUNCA (no resuelve). */
const lectorSecuencia = (...respuestas) => {
  const llamadas = [];
  const leer = (aid) => {
    llamadas.push(aid);
    const r = respuestas.length ? respuestas.shift() : HTTP(500);
    if (r === RED) return Promise.reject(new TypeError("Failed to fetch"));
    if (r === NUNCA) return new Promise(() => {});
    return Promise.resolve(r);
  };
  leer.llamadas = llamadas;
  return leer;
};
/** leer(alumnoId) manual: cada llamada queda pendiente hasta que el test la resuelve. */
const lectorManual = () => {
  const pendientes = [];
  const leer = (aid) => { const d = deferred(); pendientes.push({ aid, d }); return d.p; };
  leer.pendientes = pendientes;
  return leer;
};

const dia = (i) => ({ dia: "Dia " + (i + 1), exercises: [] });
const rutina = (over) => {
  const o = over || {};
  return { id: "R1", name: "Fuerza", datos: { days: Array.from({ length: o.dias || 4 }, (_, i) => dia(i)), semana_activa: o.semana || 1, ciclo_actual: o.ciclo || 1 } };
};
let idSeq = 0;
const ses = (alumno, semana, diaIdx, over) => {
  idSeq++;
  const d = new Date(Date.UTC(2026, 9, 1 + idSeq));
  return Object.assign({
    id: "s" + idSeq, alumno_id: alumno, rutina_id: "R1", rutina_nombre: "Fuerza", dia_idx: diaIdx, semana,
    fecha: d.getUTCDate() + "/" + (d.getUTCMonth() + 1) + "/" + d.getUTCFullYear(), created_at: d.toISOString(),
  }, over || {});
};
/** Lo que veria el alumno con esas filas (misma llamada que App: alumno, rutina, sesiones, completedDays, currentWeek). */
const posicion = (rows, rut, alumno) => {
  const r = rut || rutina();
  const p = getActiveStudentRoutinePosition({ alumno: alumno || "A", rutina: r, sesiones: rows, completedDays: [], currentWeek: r.datos.semana_activa - 1 });
  return { semana: p.weekNumber, completados: p.completedDaysInWeek, proximoDia: p.currentDayIndex == null ? null : p.currentDayIndex + 1 };
};
// Fila confirmada tal como la arma WorkoutScreen (payload + created_at + _confirmadaLocal; sin id).
const confirmada = (alumno, semana, diaIdx, fecha, over) => Object.assign({
  alumno_id: alumno, rutina_id: "R1", rutina_nombre: "Fuerza", dia_label: "Dia " + (diaIdx + 1), dia_idx: diaIdx, semana, ejercicios: "",
  fecha, hora: "10:00", created_at: new Date().toISOString(), _confirmadaLocal: true,
}, over || {});

// ── comportamiento ANTERIOR (main @ cca404a) ──────────────────────────────────
// sbFetch: HTTP no-ok => null; red => lanza; ok => data (o null si vacio).
const sbFetchLegacy = async (r) => {
  if (r === RED) throw new TypeError("Failed to fetch");
  if (!r.ok) return null;
  return r.data;
};
/** Efecto de carga del alumno: FIX B vacia; si lanza, el catch deja []; si no, setSesiones(ses || []). */
const legacyCarga = async (_prev, r) => {
  let rows = []; // FIX B: setSesiones([])
  try { const s = await sbFetchLegacy(r); rows = s || []; } catch (e) { /* catch: sesiones queda [] */ }
  return rows;
};
/** onSesionGuardada: setSesiones(fresh || []) (si lanza, la promesa se rechaza y no se toca). */
const legacyTrasFinalizar = async (prev, r) => {
  try { const fresh = await sbFetchLegacy(r); return fresh || []; } catch (e) { return prev; }
};

// ── unidades ─────────────────────────────────────────────────────────────────
await t("clasificarRespuestaSesiones: ok+array (incluso vacio) es valido; !ok es http; ok sin array es invalid", () => {
  assert.deepEqual(clasificarRespuestaSesiones(OK([])), { ok: true, rows: [] });
  const rows = [ses("A", 1, 0)];
  assert.deepEqual(clasificarRespuestaSesiones(OK(rows)), { ok: true, rows });
  assert.deepEqual(clasificarRespuestaSesiones(HTTP(500)), { ok: false, reason: "http", status: 500 });
  assert.deepEqual(clasificarRespuestaSesiones(HTTP(401)), { ok: false, reason: "http", status: 401 });
  for (const data of [null, { a: 1 }, "texto", 5]) assert.deepEqual(clasificarRespuestaSesiones(OK(data)), { ok: false, reason: "invalid" });
  assert.deepEqual(clasificarRespuestaSesiones(null), { ok: false, reason: "invalid" });
  assert.equal(SESIONES_LECTURA_TIMEOUT_MS, 15000);
});

await t("leerSesionesAlumno: nunca lanza (sin alumno, red, excepcion sincronica, timeout) y cada resultado lleva alumnoId", async () => {
  assert.deepEqual(await leerSesionesAlumno(lectorSecuencia(OK([])), null), { ok: false, reason: "sin_alumno", alumnoId: null });
  assert.deepEqual(await leerSesionesAlumno(lectorSecuencia(RED), "A"), { ok: false, reason: "red", alumnoId: "A" });
  assert.deepEqual(await leerSesionesAlumno(() => { throw new Error("x"); }, 7), { ok: false, reason: "red", alumnoId: "7" });
  assert.deepEqual(await leerSesionesAlumno(lectorSecuencia(NUNCA), "A", { timeoutMs: 10 }), { ok: false, reason: "timeout", alumnoId: "A" });
  assert.deepEqual(await leerSesionesAlumno(lectorSecuencia(HTTP(503)), "A"), { ok: false, reason: "http", status: 503, alumnoId: "A" });
  assert.deepEqual(await leerSesionesAlumno(lectorSecuencia(OK([])), "A"), { ok: true, rows: [], alumnoId: "A" });
});

await t("estado puro: inicial, iniciar (cambio de alumno vacia), aplicar ignora otro alumno / seq viejo y devuelve el MISMO objeto", () => {
  const e0 = estadoInicialSesiones();
  assert.deepEqual(e0, { alumnoId: null, rows: [], confiable: false, status: "sin_datos", reason: null, seqEmitido: 0, seqAplicado: 0, confirmadas: [] });
  assert.deepEqual(resetSesiones(), e0);
  const { estado: e1, seq: s1 } = iniciarLecturaSesiones(e0, 5);
  assert.equal(e1.alumnoId, "5"); assert.equal(e1.status, "cargando"); assert.equal(s1, 1);
  const e2 = aplicarLecturaSesiones(e1, 5, s1, { ok: true, rows: [ses("5", 1, 0)] });
  assert.equal(e2.status, "ok"); assert.equal(e2.confiable, true); assert.equal(e2.rows.length, 1);
  assert.equal(aplicarLecturaSesiones(e2, "9", 2, { ok: true, rows: [] }), e2, "otro alumno: mismo objeto");
  assert.equal(aplicarLecturaSesiones(e2, "5", 1, { ok: true, rows: [] }), e2, "seq ya aplicado: mismo objeto");
  const { estado: e3 } = iniciarLecturaSesiones(e2, "5");
  assert.equal(e3.status, "ok", "mismo alumno confiable: conserva status visible");
  assert.equal(e3.rows, e2.rows);
  const { estado: e4 } = iniciarLecturaSesiones(e3, "B");
  assert.deepEqual([e4.alumnoId, e4.rows, e4.confiable, e4.status, e4.confirmadas], ["B", [], false, "cargando", []]);
  assert.equal(sesionesConfiables(e2), true); assert.equal(sesionesConfiables(e4), false);
  assert.equal(necesitaReintento({ status: "error" }), true); assert.equal(necesitaReintento({ status: "desactualizado" }), true);
  assert.equal(necesitaReintento({ status: "ok" }), false); assert.equal(necesitaReintento({ status: "cargando" }), false);
});

// ── escenarios ────────────────────────────────────────────────────────────────
await t("a. respuesta valida con sesiones: status ok, confiable, posicion correcta", async () => {
  const filas = [ses("A", 1, 1), ses("A", 1, 0)];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK(filas)) });
  const e = await ctl.cargar("A");
  assert.deepEqual([e.status, e.confiable, e.reason], ["ok", true, null]);
  assert.deepEqual(e.rows, filas);
  assert.deepEqual(posicion(e.rows), { semana: 1, completados: 2, proximoDia: 3 });
  assert.deepEqual(posicion(await legacyCarga([], OK(filas))), posicion(e.rows), "con lectura ok legacy y nuevo coinciden");
});

await t("b. respuesta valida VACIA: confiable con 0 dias (Dia 1 es correcto)", async () => {
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK([])) });
  const e = await ctl.cargar("A");
  assert.deepEqual([e.status, e.confiable], ["ok", true]);
  assert.equal(sesionesConfiables(e), true);
  assert.deepEqual(posicion(e.rows), { semana: 1, completados: 0, proximoDia: 1 });
});

await t("c. error HTTP 500 sin estado previo: status error, NO confiable (no se asume Dia 1); legacy asumia Dia 1", async () => {
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(HTTP(500)) });
  const e = await ctl.cargar("A");
  assert.deepEqual([e.status, e.confiable, e.reason], ["error", false, "http"]);
  assert.equal(sesionesConfiables(e), false);
  assert.equal(necesitaReintento(e), true);
  const leg = await legacyCarga([], HTTP(500));
  assert.deepEqual(leg, []);
  assert.deepEqual(posicion(leg), { semana: 1, completados: 0, proximoDia: 1 }, "legacy: el alumno ve Dia 1 como si fuera un dato");
});

await t("d. timeout (la lectura nunca resuelve): error sin previo; desactualizado conservando filas con previo", async () => {
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(NUNCA), timeoutMs: 15 });
  const e = await ctl.cargar("A");
  assert.deepEqual([e.status, e.confiable, e.reason], ["error", false, "timeout"]);
  const filas = [ses("A", 1, 0), ses("A", 1, 1)];
  const ctl2 = crearControladorSesiones({ leer: lectorSecuencia(OK(filas), NUNCA), timeoutMs: 15 });
  await ctl2.cargar("A");
  const e2 = await ctl2.cargar("A");
  assert.deepEqual([e2.status, e2.confiable, e2.reason], ["desactualizado", true, "timeout"]);
  assert.deepEqual(e2.rows, filas);
  assert.deepEqual(posicion(e2.rows), { semana: 1, completados: 2, proximoDia: 3 });
});

await t("e. respuesta ok con data null / objeto / texto: reason invalid, no confiable; legacy: null => Dia 1, objeto/texto no son array", async () => {
  for (const data of [null, { message: "x" }, "<html>"]) {
    const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK(data)) });
    const e = await ctl.cargar("A");
    assert.deepEqual([e.status, e.confiable, e.reason], ["error", false, "invalid"], JSON.stringify(data));
    assert.deepEqual(e.rows, []);
    const leg = await legacyCarga([], OK(data));
    if (data === null) assert.deepEqual(posicion(leg), { semana: 1, completados: 0, proximoDia: 1 });
    else assert.equal(Array.isArray(leg), false, "legacy aplicaba un no-array como sesiones");
  }
});

await t("f. fallo durante el login (primera lectura falla por red): error, sesionesConfiables false => la UI bloquea", async () => {
  const cambios = [];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(RED), alCambiar: (e) => cambios.push(e.status) });
  const e = await ctl.cargar("A");
  assert.deepEqual([e.status, e.reason, sesionesConfiables(e)], ["error", "red", false]);
  assert.deepEqual(cambios, ["cargando", "error"]);
  assert.deepEqual(posicion(await legacyCarga([], RED)), { semana: 1, completados: 0, proximoDia: 1 }, "legacy: Dia 1");
});

await t("g. fallo inmediatamente despues de finalizar: 2 dias + confirmada dia 3 + lectura 500 => 3 dias, proximo Dia 4; legacy: Dia 1", async () => {
  const filas = [ses("A", 1, 1), ses("A", 1, 0)];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK(filas), HTTP(500)) });
  await ctl.cargar("A");
  assert.deepEqual(posicion(ctl.estado().rows), { semana: 1, completados: 2, proximoDia: 3 });
  // onSesionGuardada: registrarConfirmada primero, despues cargar
  ctl.registrarConfirmada("A", confirmada("A", 1, 2, "5/11/2026"));
  const e = await ctl.cargar("A");
  assert.deepEqual([e.status, e.confiable], ["desactualizado", true]);
  assert.deepEqual(posicion(e.rows), { semana: 1, completados: 3, proximoDia: 4 });
  const leg = await legacyTrasFinalizar(filas, HTTP(500));
  assert.deepEqual(posicion(leg), { semana: 1, completados: 0, proximoDia: 1 }, "legacy: 0 dias / Dia 1");
});

await t("registrarConfirmada no vuelve confiable un estado desconocido; otro alumno se ignora", async () => {
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(HTTP(500)) });
  await ctl.cargar("A");
  const e = ctl.registrarConfirmada("A", confirmada("A", 1, 0, "5/11/2026"));
  assert.equal(e.confiable, false); assert.equal(e.rows.length, 1);
  assert.equal(ctl.registrarConfirmada("B", confirmada("B", 1, 0, "5/11/2026")), e);
  assert.equal(e.rows[0].alumno_id, "A");
});

await t("confirmada: se quita de `confirmadas` cuando el servidor la trae; una lectura ok que NO la trae la conserva (sin duplicar)", async () => {
  const base = [ses("A", 1, 0)];
  const servidorSin = OK(base.slice());
  const conServidor = ses("A", 1, 1, { fecha: "5/11/2026" });
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK(base), servidorSin, OK([conServidor].concat(base))) });
  await ctl.cargar("A");
  ctl.registrarConfirmada("A", confirmada("A", 1, 1, "05/11/2026"));
  let e = await ctl.cargar("A");
  assert.equal(e.confirmadas.length, 1, "el servidor aun no la trae: se conserva");
  assert.equal(e.rows.length, 2);
  assert.deepEqual(posicion(e.rows), { semana: 1, completados: 2, proximoDia: 3 });
  e = await ctl.cargar("A");
  assert.equal(e.confirmadas.length, 0, "el servidor ya la trae (fecha normalizada + dia + semana + ciclo): sale de confirmadas");
  assert.equal(e.rows.length, 2, "sin duplicados");
  assert.equal(e.rows.some((r) => r._confirmadaLocal), false);
});

await t("h. recuperacion de conexion + reintento: error => cargar de nuevo ok => status ok con datos", async () => {
  const filas = [ses("A", 1, 0)];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(RED, OK(filas)) });
  let e = await ctl.cargar("A");
  assert.equal(necesitaReintento(e), true);
  e = await ctl.cargar("A"); // lo que dispara App en online / visibilitychange / focus / boton Reintentar
  assert.deepEqual([e.status, e.confiable, e.reason], ["ok", true, null]);
  assert.deepEqual(posicion(e.rows), { semana: 1, completados: 1, proximoDia: 2 });
  assert.equal(necesitaReintento(e), false);
});

await t("i. respuestas fuera de orden: la lectura vieja (1 sesion) que llega despues de la nueva (2) no pisa; una vieja fallida tampoco", async () => {
  const leer = lectorManual();
  const ctl = crearControladorSesiones({ leer });
  const p1 = ctl.cargar("A"); const p2 = ctl.cargar("A");
  await tick();
  const dos = [ses("A", 1, 1), ses("A", 1, 0)];
  leer.pendientes[1].d.res(OK(dos)); await p2;
  leer.pendientes[0].d.res(OK([dos[1]])); await p1;
  assert.deepEqual(ctl.estado().rows, dos);
  assert.deepEqual(posicion(ctl.estado().rows), { semana: 1, completados: 2, proximoDia: 3 });
  // vieja fallida tardia
  const p3 = ctl.cargar("A"); const p4 = ctl.cargar("A");
  await tick();
  leer.pendientes[3].d.res(OK(dos)); await p4;
  leer.pendientes[2].d.res(HTTP(500)); await p3;
  assert.deepEqual([ctl.estado().status, ctl.estado().reason], ["ok", null]);
  // legacy (sin orden): gana la ultima en llegar
  let legRows = await legacyCarga([], OK(dos)); legRows = await legacyCarga(legRows, OK([dos[1]]));
  assert.deepEqual(posicion(legRows), { semana: 1, completados: 1, proximoDia: 2 }, "legacy: la vieja pisaba a la nueva");
});

await t("j. cambio rapido de alumno A->B: la respuesta tardia de A no aparece en B; filas de otro alumno en una respuesta se descartan", async () => {
  const leer = lectorManual();
  const vistos = [];
  const ctl = crearControladorSesiones({ leer, alCambiar: (e) => vistos.push(e.rows.map((r) => r.alumno_id)) });
  const pA = ctl.cargar("A"); const pB = ctl.cargar("B");
  await tick();
  const filaB = ses("B", 1, 0);
  leer.pendientes[1].d.res(OK([filaB, ses("A", 1, 0), ses(null, 1, 1), ses("A", 1, 2, { alumno_id: undefined })])); await pB;
  leer.pendientes[0].d.res(OK([ses("A", 1, 0), ses("A", 1, 1)])); await pA;
  const e = ctl.estado();
  assert.equal(e.alumnoId, "B");
  assert.deepEqual(e.rows, [filaB]);
  assert.equal(vistos.flat().every((aid) => aid === "B"), true, "nunca se notificaron filas de A estando en B");
  assert.deepEqual(posicion(e.rows, rutina(), "B"), { semana: 1, completados: 1, proximoDia: 2 });
  // A -> B -> A rapido: la primera lectura de A (anterior al cambio) tampoco se aplica
  const leer2 = lectorManual();
  const ctl2 = crearControladorSesiones({ leer: leer2 });
  const q1 = ctl2.cargar("A"); ctl2.cargar("B"); const q3 = ctl2.cargar("A");
  await tick();
  leer2.pendientes[0].d.res(OK([ses("A", 1, 0)])); await q1;
  assert.equal(ctl2.estado().status, "cargando", "lectura de A anterior al cambio: obsoleta");
  leer2.pendientes[2].d.res(OK([])); await q3;
  assert.deepEqual([ctl2.estado().status, ctl2.estado().rows], ["ok", []]);
});

await t("k. cierre y recarga de Safari: controlador nuevo con lectura fallida => error (no Dia 1); con lectura ok => datos correctos", async () => {
  const filas = [ses("A", 1, 0), ses("A", 1, 1), ses("A", 1, 2)];
  const antes = crearControladorSesiones({ leer: lectorSecuencia(OK(filas)) });
  await antes.cargar("A");
  const recarga = crearControladorSesiones({ leer: lectorSecuencia(HTTP(502)) });
  assert.deepEqual(recarga.estado(), estadoInicialSesiones());
  const e = await recarga.cargar("A");
  assert.deepEqual([e.status, sesionesConfiables(e)], ["error", false]);
  assert.deepEqual(posicion(await legacyCarga([], HTTP(502))), { semana: 1, completados: 0, proximoDia: 1 }, "legacy: Dia 1 tras recargar");
  const recargaOk = crearControladorSesiones({ leer: lectorSecuencia(OK(filas)) });
  const e2 = await recargaOk.cargar("A");
  assert.deepEqual(posicion(e2.rows), { semana: 1, completados: 3, proximoDia: 4 });
  // logout
  assert.deepEqual(recargaOk.reiniciar().rows, []);
  assert.equal(recargaOk.estado().confiable, false);
});

await t("l. sesiones de distintas semanas y ciclos: misma posicion que main sobre las filas crudas", async () => {
  const rut = rutina({ semana: 2, ciclo: 2 });
  const crudas = [
    ses("A", 2, 0, { ciclo: 2 }), ses("A", 1, 3, { ciclo: 2 }), ses("A", 1, 2, { ciclo: 2 }), ses("A", 1, 1, { ciclo: 2 }), ses("A", 1, 0, { ciclo: 2 }),
    ses("A", 2, 1), ses("A", 2, 0), ses("A", 1, 3), ses("A", 1, 2), ses("A", 1, 1),
  ];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK(crudas)) });
  const e = await ctl.cargar("A");
  const main = getActiveStudentRoutinePosition({ alumno: "A", rutina: rut, sesiones: crudas, completedDays: [], currentWeek: 1 });
  const nuevo = getActiveStudentRoutinePosition({ alumno: "A", rutina: rut, sesiones: e.rows, completedDays: [], currentWeek: 1 });
  assert.deepEqual(nuevo, main);
  assert.deepEqual(posicion(e.rows, rut), { semana: 2, completados: 1, proximoDia: 2 });
});

await t("m. mas de 10 sesiones (limit=10): posicion correcta de la semana actual; confirmada + lectura que la incluye no duplica", async () => {
  const rut = rutina({ dias: 5, semana: 3 });
  const servidor = [];
  for (const [sem, n] of [[1, 5], [2, 5], [3, 2]]) for (let i = 0; i < n; i++) servidor.push(ses("A", sem, i));
  const top10 = () => servidor.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  const leer = (aid) => Promise.resolve(OK(top10().filter((r) => r.alumno_id === aid)));
  const ctl = crearControladorSesiones({ leer });
  let e = await ctl.cargar("A");
  assert.equal(e.rows.length, 10);
  assert.deepEqual(posicion(e.rows, rut), { semana: 3, completados: 2, proximoDia: 3 });
  const nueva = ses("A", 3, 2); // lo que el servidor guardo al finalizar
  ctl.registrarConfirmada("A", confirmada("A", 3, 2, nueva.fecha));
  servidor.push(nueva);
  e = await ctl.cargar("A");
  assert.equal(e.rows.length, 10, "sin duplicados");
  assert.equal(e.confirmadas.length, 0);
  assert.equal(new Set(e.rows.map((r) => r.id)).size, 10);
  assert.deepEqual(posicion(e.rows, rut), { semana: 3, completados: 3, proximoDia: 4 });
});

await t("n. avance de semana: semana completa via confirmada (lectura fallida) => misma posicion que main con las mismas filas", async () => {
  const rut = rutina({ semana: 1 });
  const filas = [ses("A", 1, 2), ses("A", 1, 1), ses("A", 1, 0)];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK(filas), RED) });
  await ctl.cargar("A");
  const ultima = confirmada("A", 1, 3, "6/11/2026");
  ctl.registrarConfirmada("A", ultima);
  const e = await ctl.cargar("A");
  const main = getActiveStudentRoutinePosition({ alumno: "A", rutina: rut, sesiones: [ultima].concat(filas), completedDays: [], currentWeek: 0 });
  assert.deepEqual(getActiveStudentRoutinePosition({ alumno: "A", rutina: rut, sesiones: e.rows, completedDays: [], currentWeek: 0 }), main);
  assert.deepEqual(posicion(e.rows, rut), { semana: 1, completados: 4, proximoDia: null });
  // con semana_activa ya avanzada (2) tambien coincide
  const rut2 = rutina({ semana: 2 });
  assert.deepEqual(
    getActiveStudentRoutinePosition({ alumno: "A", rutina: rut2, sesiones: e.rows, completedDays: [], currentWeek: 1 }),
    getActiveStudentRoutinePosition({ alumno: "A", rutina: rut2, sesiones: [ultima].concat(filas), completedDays: [], currentWeek: 1 }));
  // el modulo no depende de la finalizacion (sus reglas no cambian; ver test-finalizeWorkoutSession)
  const src = readFileSync(new URL("../lib/sesionesLectura.js", import.meta.url), "utf8");
  assert.equal(/finalizeWorkoutSession/.test(src), false);
});

await t("o. compatibilidad con PR #154: el controlador no toca localStorage / sessionStorage ni la cola", async () => {
  const accesos = [];
  const espia = new Proxy({}, { get: (_t, k) => { accesos.push(String(k)); return () => null; } });
  const prevL = globalThis.localStorage; const prevS = globalThis.sessionStorage;
  globalThis.localStorage = espia; globalThis.sessionStorage = espia;
  try {
    const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK([ses("A", 1, 0)]), HTTP(500), RED, NUNCA), timeoutMs: 10 });
    await ctl.cargar("A"); ctl.registrarConfirmada("A", confirmada("A", 1, 1, "5/11/2026"));
    await ctl.cargar("A"); await ctl.cargar("A"); await ctl.cargar("A"); await ctl.cargar("B"); ctl.reiniciar();
  } finally {
    globalThis.localStorage = prevL; globalThis.sessionStorage = prevS;
  }
  assert.deepEqual(accesos, []);
  const codigo = readFileSync(new URL("../lib/sesionesLectura.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.equal(/localStorage|sessionStorage|pendingQueue|pendingSync|setWriteAhead/.test(codigo), false);
});

await t("alCambiar: no se notifica una respuesta ignorada; una lectura fallida conserva la MISMA referencia de filas", async () => {
  const notifs = [];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(OK([ses("A", 1, 0)]), HTTP(500)), alCambiar: (e) => notifs.push(e) });
  await ctl.cargar("A");
  const rows = ctl.estado().rows;
  await ctl.cargar("A");
  assert.equal(ctl.estado().rows, rows);
  assert.deepEqual(notifs.map((e) => e.status), ["cargando", "ok", "ok", "desactualizado"]);
  const ctlSinAlumno = crearControladorSesiones({ leer: () => { throw new Error("no debe llamarse"); } });
  assert.deepEqual(await ctlSinAlumno.cargar(null), estadoInicialSesiones());
});

// ── decisiones de la UI del alumno (lo que App usa para mostrar el plan, iniciar y procesar la finalizacion) ──
// legacy: App no distinguia lecturas; el plan se mostraba siempre y solo el weekGate impedia iniciar.
const legacyPlan = () => "plan";
const legacyPuedeIniciar = ({ weekGateActivo }) => !weekGateActivo;
const lecturaDe = (status) => ({ status, confiable: status === "ok" || status === "desactualizado" });

await t("estadoPlanAlumno: sin_datos y error => error (con Reintentar); cargando; ok/desactualizado => plan; readOnly/no alumno => no_aplica", () => {
  const alumno = (status) => estadoPlanAlumno({ esAlumno: true, readOnly: false, lectura: lecturaDe(status) });
  assert.equal(alumno("sin_datos"), "error", "nunca cargado: no queda en Cargando sin salida");
  assert.equal(alumno("cargando"), "cargando");
  assert.equal(alumno("error"), "error");
  assert.equal(alumno("desactualizado"), "plan");
  assert.equal(alumno("ok"), "plan");
  assert.equal(alumno("otro_desconocido"), "error");
  assert.equal(estadoPlanAlumno({ esAlumno: true, readOnly: false, lectura: undefined }), "error");
  for (const status of ["sin_datos", "cargando", "error", "ok"]) {
    assert.equal(estadoPlanAlumno({ esAlumno: true, readOnly: true, lectura: lecturaDe(status) }), "no_aplica");
    assert.equal(estadoPlanAlumno({ esAlumno: false, readOnly: false, lectura: lecturaDe(status) }), "no_aplica");
  }
  for (const status of ["sin_datos", "cargando", "error"]) assert.equal(legacyPlan(status), "plan", "legacy mostraba el plan (Dia 1) con " + status);
});

await t("puedeIniciarEntrenamientoAlumno: bloquea error/cargando/sin_datos y weekGate; permite ok/desactualizado; no bloquea readOnly ni no-alumno", () => {
  const p = (status, extra) => puedeIniciarEntrenamientoAlumno(Object.assign({ esAlumno: true, readOnly: false, lectura: lecturaDe(status), weekGateActivo: false }, extra || {}));
  for (const s of ["error", "cargando", "sin_datos"]) {
    assert.equal(p(s), false, s);
    assert.equal(legacyPuedeIniciar({ weekGateActivo: false }), true, "legacy dejaba iniciar con " + s);
  }
  assert.equal(p("ok"), true); assert.equal(p("desactualizado"), true);
  assert.equal(p("ok", { weekGateActivo: true }), false);
  assert.equal(p("error", { readOnly: true }), true);
  assert.equal(p("error", { esAlumno: false }), true);
  assert.equal(p("error", { readOnly: true, weekGateActivo: true }), false, "el weekGate sigue bloqueando como antes");
});

await t("manejarSesionGuardada: con lectura que falla la confirmada queda y la posicion avanza (legacy: Dia 1); con lectura ok que la trae no duplica; sin alumnoId no lee", async () => {
  const filas = [ses("A", 1, 1), ses("A", 1, 0)];
  const leer = lectorSecuencia(OK(filas), HTTP(500));
  const ctl = crearControladorSesiones({ leer });
  await ctl.cargar("A");
  const fila = confirmada("A", 1, 2, "7/11/2026");
  const e = await manejarSesionGuardada(ctl, "A", fila);
  assert.equal(leer.llamadas.length, 2);
  assert.deepEqual([e.status, e.confiable], ["desactualizado", true]);
  assert.deepEqual(posicion(e.rows), { semana: 1, completados: 3, proximoDia: 4 });
  assert.deepEqual(posicion(await legacyTrasFinalizar(filas, HTTP(500))), { semana: 1, completados: 0, proximoDia: 1 }, "legacy: Dia 1");
  // lectura ok que ya la trae
  const servidorFila = ses("A", 1, 2, { fecha: "7/11/2026" });
  const ctl2 = crearControladorSesiones({ leer: lectorSecuencia(OK(filas), OK([servidorFila].concat(filas))) });
  await ctl2.cargar("A");
  const e2 = await manejarSesionGuardada(ctl2, "A", confirmada("A", 1, 2, "07/11/2026"));
  assert.equal(e2.rows.length, 3); assert.equal(e2.confirmadas.length, 0); assert.equal(e2.status, "ok");
  assert.deepEqual(posicion(e2.rows), { semana: 1, completados: 3, proximoDia: 4 });
  // sin alumnoId
  const leer3 = lectorSecuencia(OK([]));
  const ctl3 = crearControladorSesiones({ leer: leer3 });
  for (const aid of [undefined, null, ""]) await manejarSesionGuardada(ctl3, aid, fila);
  assert.equal(leer3.llamadas.length, 0);
  assert.deepEqual(ctl3.estado(), estadoInicialSesiones());
  // sin fila: solo relee
  const ctl4 = crearControladorSesiones({ leer: lectorSecuencia(OK(filas)) });
  const e4 = await manejarSesionGuardada(ctl4, "A", null);
  assert.deepEqual([e4.status, e4.rows], ["ok", filas]);
});

await t("flujo integrado recarga de Safari + fallo + reintento: error => no se puede iniciar; reintento ok => plan y se puede iniciar", async () => {
  const filas = [ses("A", 1, 0), ses("A", 1, 1)];
  const ctl = crearControladorSesiones({ leer: lectorSecuencia(RED, OK(filas)) });
  const ui = () => {
    const lectura = ctl.estado();
    return {
      plan: estadoPlanAlumno({ esAlumno: true, readOnly: false, lectura }),
      iniciar: puedeIniciarEntrenamientoAlumno({ esAlumno: true, readOnly: false, lectura, weekGateActivo: false }),
    };
  };
  assert.deepEqual(ui(), { plan: "error", iniciar: false }, "antes de la primera lectura (sin_datos)");
  const p = ctl.cargar("A");
  assert.deepEqual(ui(), { plan: "cargando", iniciar: false });
  await p;
  assert.deepEqual(ui(), { plan: "error", iniciar: false });
  assert.equal(necesitaReintento(ctl.estado()), true);
  await ctl.cargar("A"); // online / focus / boton Reintentar
  assert.deepEqual(ui(), { plan: "plan", iniciar: true });
  assert.deepEqual(posicion(ctl.estado().rows), { semana: 1, completados: 2, proximoDia: 3 });
});

await t("complementario: App ya no aplica `ses || []` / `fresh || []` y usa las decisiones de lib/sesionesLectura.js", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.equal(app.includes("setSesiones(ses || [])"), false);
  assert.equal(app.includes("setSesiones(fresh || [])"), false);
  assert.equal(app.includes("FIX B: flush stale sesiones"), false);
  assert.match(app, /import \{[^}]*\bestadoPlanAlumno\b[^}]*\bpuedeIniciarEntrenamientoAlumno\b[^}]*\bmanejarSesionGuardada\b[^}]*\} from '\.\/lib\/sesionesLectura\.js'/);
  assert.match(app, /estadoPlanAlumno\(\{/);
  assert.match(app, /puedeIniciarEntrenamientoAlumno\(\{/);
  assert.match(app, /manejarSesionGuardada\(sesionesCtl,/);
});

console.log(n + " pruebas OK");
