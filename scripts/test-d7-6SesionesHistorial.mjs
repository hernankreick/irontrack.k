// D7.6 — Historial de sesiones del alumno: lectura COMPLETA paginada (antes `limit=10`).
//   node scripts/test-d7-6SesionesHistorial.mjs
// Servidor PostgREST falso que interpreta SOLO lo que arma sesionesAlumnoPagePath (alumno_id=eq.X, order=created_at.desc,id.desc,
// limit, offset). `legacy` reproduce la consulta anterior (created_at desc, limit=10). Las metricas visibles se calculan con las
// funciones REALES de la app (computeDayStreak, getActiveStudentRoutinePosition) y el controlador REAL de D76-02.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sesionesAlumnoPagePath, leerSesionesAlumnoCompletas, getSesionesCompletas } from "../lib/sesionesHistorial.js";
import { crearControladorSesiones } from "../lib/sesionesLectura.js";
import { computeDayStreak } from "../components/student-progress/progressMetrics.js";
import { getActiveStudentRoutinePosition } from "../lib/studentWeeklyProgress.js";
import { sessionAlreadyExists } from "../lib/workoutSession.js";
import { persistSessionConfirmed } from "../lib/finalizeWorkoutSession.js";

let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");

// ── datos ficticios ─────────────────────────────────────────────────────────────
const A = "0a1b2c3d-0000-4000-8000-00000000000a";
const B = "0a1b2c3d-0000-4000-8000-00000000000b";
const dmy = (d) => d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
let seq = 0;
/** Sesion `diasAtras` dias antes de hoy (fecha d/m/yyyy y created_at ISO coherentes). */
const ses = (alumno, diasAtras, extra) => {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - diasAtras);
  seq++;
  return Object.assign({ id: "s-" + String(seq).padStart(4, "0"), alumno_id: alumno, fecha: dmy(d), created_at: d.toISOString(),
    semana: 1, dia_idx: 0, rutina_id: "R1", ciclo: 1, completada: true }, extra || {});
};
const ordenar = (rows) => rows.slice().sort((a, b) => (b.created_at > a.created_at ? 1 : b.created_at < a.created_at ? -1 : b.id > a.id ? 1 : b.id < a.id ? -1 : 0));

/** Servidor falso. opts.fallar(pageIndex) => respuesta de error | "red"; opts.antes(pageIndex) corre antes de responder. */
function servidor(rows, opts) {
  const o = opts || {};
  const llamadas = [];
  const requestStatus = async (path) => {
    llamadas.push(path);
    const m = /^sesiones\?alumno_id=eq\.([^&]+)&select=\*&order=created_at\.desc,id\.desc&limit=(\d+)&offset=(\d+)$/.exec(path);
    if (!m) return { ok: false, status: 400, data: { message: "consulta inesperada: " + path } };
    const aid = decodeURIComponent(m[1]); const lim = Number(m[2]); const off = Number(m[3]);
    const page = off / lim;
    if (o.antes) o.antes(page);
    const f = o.fallar ? o.fallar(page) : null;
    if (f === "red") throw new TypeError("Failed to fetch");
    if (f) return f;
    const filas = ordenar(rows.filter((r) => r.alumno_id === aid || o.mezclar)).slice(off, off + lim);
    return { ok: true, status: 200, data: filas.map((r) => Object.assign({}, r)) };
  };
  requestStatus.llamadas = llamadas;
  return requestStatus;
}
/** Consulta anterior (D76-02 / E0): las 10 mas recientes por created_at. */
const legacy = (rows, aid) => ordenar(rows.filter((r) => r.alumno_id === aid)).slice(0, 10);

// ── 1. ruta ─────────────────────────────────────────────────────────────────────
await t("1. ruta: orden estable created_at.desc,id.desc, limit/offset de pagina, id codificado, sin limit=10", () => {
  const p = sesionesAlumnoPagePath("a b&c", 2000, 1000);
  assert.equal(p, "sesiones?alumno_id=eq.a%20b%26c&select=*&order=created_at.desc,id.desc&limit=1000&offset=2000");
  assert.doesNotMatch(sesionesAlumnoPagePath(A, 0, 1000), /limit=10&|limit=10$/);
});

// ── 2. el problema: vistas cortadas en 10 ──────────────────────────────────────
await t("2. 25 sesiones: la lectura trae las 25 (antes 10). Contador y logro «20 sesiones» alcanzable", async () => {
  const rows = []; for (let i = 0; i < 25; i++) rows.push(ses(A, i));
  const res = await leerSesionesAlumnoCompletas(servidor(rows), A);
  assert.equal(res.ok, true);
  assert.equal(res.data.length, 25);
  assert.equal(legacy(rows, A).length, 10, "la consulta anterior cortaba en 10");
  // StudentProgressSection: totalSessions = sesiones.length; logro sessions20 = totalSessions >= 20
  assert.equal(res.data.length >= 20, true);
  assert.equal(legacy(rows, A).length >= 20, false, "antes el logro era inalcanzable");
});

await t("3. racha de 15 dias consecutivos: 15 con el historial completo (antes se cortaba en 10)", async () => {
  const rows = []; for (let i = 0; i < 15; i++) rows.push(ses(A, i));
  const res = await leerSesionesAlumnoCompletas(servidor(rows), A);
  assert.equal(computeDayStreak(res.data, {}), 15);
  assert.equal(computeDayStreak(legacy(rows, A), {}), 10);
});

await t("4. historial por semanas (Progreso > Sesiones): ninguna semana vieja se pierde ni queda partida", async () => {
  const rows = [];
  for (let w = 1; w <= 4; w++) for (let dIdx = 0; dIdx < 3; dIdx++) rows.push(ses(A, (4 - w) * 7 + (2 - dIdx), { semana: w, dia_idx: dIdx }));
  const porSemana = (list) => list.reduce((m, s) => { m[s.semana] = (m[s.semana] || 0) + 1; return m; }, {});
  const res = await leerSesionesAlumnoCompletas(servidor(rows), A);
  assert.deepEqual(porSemana(res.data), { 1: 3, 2: 3, 3: 3, 4: 3 });
  assert.deepEqual(porSemana(legacy(rows, A)), { 1: 1, 2: 3, 3: 3, 4: 3 }, "antes la semana 1 quedaba partida (1/3: parecia incompleta)");
});

// ── 5. paginacion ───────────────────────────────────────────────────────────────
await t("5. varias paginas: todas las filas, en orden, sin duplicados ni faltantes", async () => {
  const rows = []; for (let i = 0; i < 11; i++) rows.push(ses(A, i));
  const srv = servidor(rows);
  const res = await leerSesionesAlumnoCompletas(srv, A, { pageSize: 4 });
  assert.equal(res.ok, true);
  assert.equal(res.pages, 3);
  assert.deepEqual(res.data.map((r) => r.id), ordenar(rows).map((r) => r.id));
  assert.equal(srv.llamadas.length, 3);
});

await t("6. una sesion nueva entre pagina y pagina (desplaza el offset): sin duplicados y sin perder filas", async () => {
  const rows = []; for (let i = 1; i <= 8; i++) rows.push(ses(A, i));
  const originales = rows.map((r) => r.id);
  let insertada = null;
  const srv = servidor(rows, { antes: (page) => { if (page === 1 && !insertada) { insertada = ses(A, 0); rows.push(insertada); } } });
  const res = await leerSesionesAlumnoCompletas(srv, A, { pageSize: 3 });
  assert.equal(res.ok, true);
  const ids = res.data.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, "sin duplicados");
  originales.forEach((id) => assert.ok(ids.includes(id), "no falta " + id));
});

// ── 6. errores: nunca un historial parcial como completo (D76-02 / PR #155) ─────
await t("7. falla la pagina 2 (HTTP 500): la lectura FALLA entera (no entrega 1 pagina como si fuera todo)", async () => {
  const rows = []; for (let i = 0; i < 9; i++) rows.push(ses(A, i));
  const res = await leerSesionesAlumnoCompletas(servidor(rows, { fallar: (p) => (p === 1 ? { ok: false, status: 500, data: null } : null) }), A, { pageSize: 4 });
  assert.deepEqual({ ok: res.ok, data: res.data, reason: res.reason, status: res.status }, { ok: false, data: null, reason: "http", status: 500 });
});

await t("8. error de red: { ok:false, reason:'red' }; getSesiones lanza (como sbFetch) y ante HTTP devuelve null", async () => {
  const rows = [ses(A, 0)];
  const red = await leerSesionesAlumnoCompletas(servidor(rows, { fallar: () => "red" }), A);
  assert.equal(red.ok, false); assert.equal(red.reason, "red");
  await assert.rejects(() => getSesionesCompletas(servidor(rows, { fallar: () => "red" }), A));
  assert.equal(await getSesionesCompletas(servidor(rows, { fallar: () => ({ ok: false, status: 401, data: null }) }), A), null);
  assert.deepEqual((await getSesionesCompletas(servidor(rows), A)).map((r) => r.id), [rows[0].id]);
  // respuesta sin arreglo
  const inval = await leerSesionesAlumnoCompletas(async () => ({ ok: true, status: 200, data: { x: 1 } }), A);
  assert.equal(inval.ok, false); assert.equal(inval.reason, "invalid");
  // sin alumno: no consulta
  const srv = servidor(rows);
  assert.equal((await leerSesionesAlumnoCompletas(srv, "")).reason, "sin_alumno");
  assert.equal(srv.llamadas.length, 0);
});

await t("9. tope de paginas alcanzado: no se presenta como completo", async () => {
  const rows = []; for (let i = 0; i < 6; i++) rows.push(ses(A, i));
  const res = await leerSesionesAlumnoCompletas(servidor(rows), A, { pageSize: 2, maxPages: 2 });
  assert.equal(res.ok, false); assert.equal(res.reason, "tope"); assert.equal(res.data, null);
});

await t("10. controlador D76-02: con filas confiables, una lectura paginada fallida NO vacia ni recorta (desactualizado)", async () => {
  const rows = []; for (let i = 0; i < 12; i++) rows.push(ses(A, i));
  let fallar = false;
  const srv = servidor(rows, { fallar: (p) => (fallar && p === 1 ? { ok: false, status: 503, data: null } : null) });
  const ctl = crearControladorSesiones({ leer: (aid) => leerSesionesAlumnoCompletas(srv, aid, { pageSize: 5 }) });
  let e = await ctl.cargar(A);
  assert.equal(e.status, "ok"); assert.equal(e.rows.length, 12);
  fallar = true;
  e = await ctl.cargar(A);
  assert.equal(e.status, "desactualizado"); assert.equal(e.rows.length, 12, "se conservan las 12, no las 5 de la primera pagina");
  // primera lectura fallida de otro alumno: error, sin filas (nunca "cero sesiones" confiable)
  const ctl2 = crearControladorSesiones({ leer: (aid) => leerSesionesAlumnoCompletas(srv, aid, { pageSize: 5 }) });
  const e2 = await ctl2.cargar(A);
  assert.equal(e2.status, "error"); assert.equal(e2.confiable, false);
});

await t("11. sin mezclas entre alumnos: filas de otro alumno que devuelva el servidor se descartan", async () => {
  const rows = [ses(A, 0), ses(B, 0), ses(A, 1), ses(B, 2)];
  const res = await leerSesionesAlumnoCompletas(servidor(rows, { mezclar: true }), A);
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.map((r) => r.alumno_id), [A, A]);
});

await t("12. respuestas desactualizadas: A -> B rapido; la lectura tardia de A no pisa la de B", async () => {
  const rows = [ses(A, 0), ses(A, 1), ses(B, 0)];
  const srv = servidor(rows);
  const pendientes = [];
  const leer = (aid) => new Promise((resolve) => pendientes.push(() => resolve(leerSesionesAlumnoCompletas(srv, aid))));
  const ctl = crearControladorSesiones({ leer });
  const pa = ctl.cargar(A); const pb = ctl.cargar(B);
  await new Promise((r) => setTimeout(r, 0));
  pendientes[1](); await pb;
  pendientes[0](); await pa;
  const e = ctl.estado();
  assert.equal(e.alumnoId, B);
  assert.deepEqual(e.rows.map((r) => r.alumno_id), [B]);
});

// ── 7. sin regresiones en la posicion del plan ni en la finalizacion ────────────
await t("13. posicion del plan: identica a la anterior cuando la semana actual estaba entre las 10 recientes", async () => {
  const rut = { id: "R1", nombre: "Rutina", alumno_id: A, datos: { semana_activa: 3, days: [{}, {}, {}, {}, {}] } };
  const rows = [];
  for (const [w, k] of [[1, 5], [2, 5], [3, 2]]) for (let i = 0; i < k; i++) rows.push(ses(A, (3 - w) * 7 + (4 - i), { semana: w, dia_idx: i }));
  const res = await leerSesionesAlumnoCompletas(servidor(rows), A);
  const pos = (s) => { const p = getActiveStudentRoutinePosition({ alumno: A, rutina: rut, sesiones: s, completedDays: [], currentWeek: 2 }); return [p.weekNumber, p.completedDaysInWeek, p.currentDayIndex]; };
  assert.deepEqual(pos(res.data), [3, 2, 2]);
  assert.deepEqual(pos(res.data), pos(legacy(rows, A)));
});

await t("14. finalizar: el chequeo de duplicado ve una sesion del dia aunque haya mas de 10 mas nuevas (no hace un 2.º POST)", async () => {
  const rows = [];
  const hoy = ses(A, 0, { dia_idx: 2, semana: 3, created_at: "2000-01-01T00:00:00.000Z" }); // created_at viejo (p. ej. validada con fecha del dia)
  rows.push(hoy);
  for (let i = 0; i < 12; i++) rows.push(ses(A, 1 + i));
  assert.equal(sessionAlreadyExists(legacy(rows, A), hoy.fecha, 2, 3, 1), false, "antes quedaba fuera de las 10");
  const srv = servidor(rows);
  let posts = 0;
  const sb = { getSesiones: (aid) => getSesionesCompletas(srv, aid), addSesion: async () => { posts++; return [{ id: "nueva" }]; } };
  const r = await persistSessionConfirmed({ sb, alumnoId: A, date: hoy.fecha, dayIndex: 2, weekToSave: 3, ciclo: 1, payload: {}, timeoutMs: 1000 });
  assert.equal(r.confirmed, true); assert.equal(r.source, "existing"); assert.equal(posts, 0);
});

// ── 8. cableado ────────────────────────────────────────────────────────────────
await t("15. cableado: getSesiones/getSesionesDetallado usan la lectura completa; ninguna consulta de sesiones con limit=10", () => {
  const app = read("App.jsx");
  assert.match(app, /getSesiones: \(alumnoId\) => getSesionesCompletas\(sbRequestStatus, alumnoId\),/);
  assert.match(app, /getSesionesDetallado: \(alumnoId\) => leerSesionesAlumnoCompletas\(sbRequestStatus, alumnoId\),/);
  assert.match(app, /leer: function \(aid\) \{ return sb\.getSesionesDetallado\(aid\); \}/, "el controlador D76-02 sigue leyendo por getSesionesDetallado");
  assert.doesNotMatch(app, /sesiones\?[^"]*limit=10/);
  // la ultima sesion (limit=1) sigue siendo intencional
  assert.match(app, /getUltimaSesion: \(alumnoId\) => sbFetch\("sesiones\?alumno_id=eq\."\+alumnoId\+"&select=\*&order=created_at\.desc&limit=1"\)/);
});

console.log("\n" + n + " pruebas OK");
