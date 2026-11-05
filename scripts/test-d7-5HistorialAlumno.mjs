// D7.5: el progreso del alumno usa el historial COMPLETO (sin cortes silenciosos del tope de filas de PostgREST).
//
//   node scripts/test-d7-5HistorialAlumno.mjs
//
// Servidor PostgREST simulado: respeta order/limit/offset y, como Supabase, nunca devuelve mas de MAX_ROWS (1.000) filas por consulta.
// La consulta anterior (una sola, sin limit) devolvia las 1.000 mas recientes y perdia lo mas antiguo.
// Casos 16 (oscuro/claro) y 17 (iPhone) se verifican con el QA visual (scripts/qa/*), no aca.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cargarHistorialProgreso, obtenerHistorialProgreso, invalidarHistorialProgreso, progresoAlumnoPagePath } from "../lib/alumnoHistoryLoader.js";
import { eventosPR, recordDe } from "../lib/metricas/pr.js";
import { hydrateProgressFromRows, calculateNewWeightPR, normalizeWorkoutSet } from "../lib/workoutSession.js";
import { countPRsThisMonth, exerciseRecordKg } from "../components/student-progress/progressMetrics.js";

const src = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const NOW_MS = new Date(2026, 10, 20, 12).getTime(); // 20/11/2026
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW_MS); else super(...a); }
  static now() { return NOW_MS; }
}
globalThis.Date = FixedDate;

const MAX_ROWS = 1000;
// filas de progreso: i = 0 es la mas antigua. created_at creciente; fecha d/m/yyyy del mismo dia.
function dataset(n, gen) {
  const base = new RealDate(2024, 0, 1, 10).getTime();
  return Array.from({ length: n }, (_, i) => {
    const t = new RealDate(base + Math.floor(i / 3) * 86400000 + (i % 3) * 60000);
    const extra = gen ? gen(i, n) : {};
    return Object.assign({ id: "p" + String(i).padStart(6, "0"), alumno_id: "a", ejercicio_id: "sq", kg: 80, reps: 5,
      fecha: t.getDate() + "/" + (t.getMonth() + 1) + "/" + t.getFullYear(), semana: 0, created_at: t.toISOString() }, extra);
  });
}
function servidor(filasPorAlumno, opts) {
  const o = opts || {};
  const llamadas = [];
  const fetchPath = async (path) => {
    llamadas.push(path);
    if (o.antesDePagina) await o.antesDePagina(path, llamadas.length);
    const m = /alumno_id=eq\.([^&]+)/.exec(path);
    const filas = (filasPorAlumno[decodeURIComponent(m[1])] || []).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id < b.id ? 1 : -1));
    const lim = /limit=(\d+)/.exec(path), off = /offset=(\d+)/.exec(path);
    const offset = off ? Number(off[1]) : 0;
    const limit = Math.min(lim ? Number(lim[1]) : Infinity, MAX_ROWS);
    if (o.falla && o.falla(path, offset)) throw new Error("red");
    return filas.slice(offset, offset + limit);
  };
  return { fetchPath, llamadas };
}
const consultaAnterior = (srv, id) => srv.fetchPath("progreso?alumno_id=eq." + id + "&select=*&order=created_at.desc"); // E0: una sola consulta
const ids = (rows) => rows.map((r) => r.id).sort();

await test("1. menos de 1.000 filas: una pagina, completo", async () => {
  const filas = dataset(640);
  const srv = servidor({ a: filas });
  const r = await cargarHistorialProgreso(srv.fetchPath, "a");
  assert.deepEqual([r.complete, r.pages, r.rows.length], [true, 1, 640]);
  assert.equal(srv.llamadas[0], progresoAlumnoPagePath("a", 0, 1000));
  assert.match(srv.llamadas[0], /order=created_at\.desc,id\.desc&limit=1000&offset=0/);
});

await test("2. mas de 1.000 filas: todas, en paginas (antes: las 1.000 mas recientes)", async () => {
  const filas = dataset(2500);
  const srv = servidor({ a: filas });
  const r = await cargarHistorialProgreso(srv.fetchPath, "a");
  assert.deepEqual([r.complete, r.pages, r.rows.length], [true, 3, 2500]);
  assert.deepEqual(ids(r.rows), ids(filas));
  assert.equal((await consultaAnterior(srv, "a")).length, 1000);
});

await test("3. mas de 10.000 filas: completo sin tope (12.345 filas, 13 paginas); por encima del tope se marca incompleto", async () => {
  const filas = dataset(12345);
  const r = await cargarHistorialProgreso(servidor({ a: filas }).fetchPath, "a");
  assert.deepEqual([r.complete, r.pages, r.rows.length], [true, 13, 12345]);
  const tope = await cargarHistorialProgreso(servidor({ a: filas }).fetchPath, "a", { maxPages: 5 });
  assert.deepEqual([tope.complete, tope.reason, tope.rows.length], [false, "tope", 5000]);
});

await test("4. sin duplicados ni omisiones aunque se inserte una serie mientras se pagina (el offset se corre)", async () => {
  const filas = dataset(2100);
  let nuevas = 0;
  const srv = servidor({ a: filas }, {
    antesDePagina: (path, n) => { if (n === 2) { filas.push(Object.assign({}, filas[filas.length - 1], { id: "nueva" + nuevas++, created_at: "2099-01-01T00:00:00.000Z" })); } },
  });
  const r = await cargarHistorialProgreso(srv.fetchPath, "a");
  assert.equal(r.complete, true);
  assert.equal(new Set(r.rows.map((x) => x.id)).size, r.rows.length); // sin duplicados
  dataset(2100).forEach((f) => assert.ok(r.rows.some((x) => x.id === f.id), "falta " + f.id)); // sin omisiones de lo que habia
});

// historial con el record (120 kg) en lo mas antiguo y 1.500 series posteriores mas livianas
const conRecordViejo = () => dataset(1530, (i) => (i < 30 ? { kg: 120, reps: 3 } : { kg: 100 + (i % 11), reps: 5 }));

await test("5. record anterior a las ultimas 20 series (y fuera de las 1.000 mas recientes): progreso del alumno = 120", async () => {
  const srv = servidor({ a: conRecordViejo() });
  const r = await cargarHistorialProgreso(srv.fetchPath, "a");
  assert.equal(exerciseRecordKg("sq", {}, r.rows), 120);
  assert.equal(exerciseRecordKg("sq", {}, await consultaAnterior(srv, "a")), 110); // antes: el 120 quedaba fuera del corte
});

await test("6. record anterior a las ultimas 50 series: el estado del entrenamiento (max) y el indicador de PR lo respetan", async () => {
  const r = await cargarHistorialProgreso(servidor({ a: conRecordViejo() }).fetchPath, "a");
  const progress = hydrateProgressFromRows(r.rows);
  assert.equal(progress.sq.sets.length, 50);
  assert.equal(progress.sq.max, 120);
  assert.equal(calculateNewWeightPR(progress.sq, 115), null); // 115 no es PR: el record es 120
  const viejo = hydrateProgressFromRows(await consultaAnterior(servidor({ a: conRecordViejo() }), "a"));
  assert.equal(viejo.sq.max, 110);
  assert.ok(calculateNewWeightPR(viejo.sq, 115)); // antes: «PR» falso
});

await test("7-8. PRs correctos tras reiniciar la rutina y entre ciclos (historial completo de todos los ciclos)", async () => {
  // 1.200 series del ciclo 1 (record 100 en las primeras), reinicio, ciclo 2 este mes: 100 iguala, 102,5 supera
  const filas = dataset(1200, (i) => ({ ciclo: 1, kg: i < 3 ? 100 : 90 }));
  const nov = (d, kg, k) => ({ id: "c2-" + k, alumno_id: "a", ejercicio_id: "sq", kg, reps: 5, fecha: d + "/11/2026", semana: 0, ciclo: 2, created_at: new RealDate(2026, 10, d, 10, k).toISOString() });
  filas.push(nov(10, 95, 1), nov(12, 100, 2), nov(17, 102.5, 3));
  const r = await cargarHistorialProgreso(servidor({ a: filas }).fetchPath, "a");
  assert.deepEqual(eventosPR(r.rows).map((e) => e.kg), [102.5]);
  assert.equal(countPRsThisMonth([{ id: "sq" }], [], {}, r.rows), 1);
  const viejo = await consultaAnterior(servidor({ a: filas }), "a");
  assert.equal(countPRsThisMonth([{ id: "sq" }], [], {}, viejo), 3); // antes: 95, 100 y 102,5 «PR» (el 100 del ciclo 1 quedaba fuera del corte)
});

await test("9-11. coma decimal, series invalidas y ejercicios por tiempo en el historial paginado", async () => {
  const filas = dataset(1100, (i) => (i === 0 ? { kg: "82,5" } : i === 1 ? { kg: 150, reps: 0 } : i === 2 ? { kg: 0 } : i === 3 ? { fecha: "sin fecha", kg: 200 } : { kg: 80 }));
  filas.push({ id: "plank1", alumno_id: "a", ejercicio_id: "plank", kg: 20, reps: 60, fecha: "1/11/2026", created_at: "2026-11-01T10:00:00Z" });
  filas.push({ id: "plank2", alumno_id: "a", ejercicio_id: "plank", kg: 25, reps: 60, fecha: "8/11/2026", created_at: "2026-11-08T10:00:00Z" });
  const r = await cargarHistorialProgreso(servidor({ a: filas }).fetchPath, "a");
  assert.equal(r.rows.length, 1102);
  assert.equal(exerciseRecordKg("sq", {}, r.rows), 82.5); // 150 x 0, 0 kg y fecha invalida no son record
  // estado del entrenamiento: 150 x 0 y 0 kg tampoco son record. (Una fila con fecha invalida si cuenta en progress.max: diferencia de
  // D7.4 fuera del alcance de D7.5, documentada; la app siempre guarda fecha d/m/yyyy.)
  assert.equal(hydrateProgressFromRows(r.rows.filter((x) => x.fecha !== "sin fecha")).sq.max, 82.5);
  const indiceTiempo = { plank: true };
  assert.equal(countPRsThisMonth([{ id: "plank" }], [], {}, r.rows, { indiceTiempo }), 0);
  assert.equal(recordDe(r.rows, "plank", { indiceTiempo }), 0);
});

await test("12. datos locales y remotos superpuestos: la misma serie no se cuenta dos veces ni crea un PR extra", async () => {
  const filas = dataset(1050, (i) => ({ kg: 90 }));
  const nuevo = { id: "x1", alumno_id: "a", ejercicio_id: "sq", kg: 95, reps: 5, fecha: "15/11/2026", semana: 0, created_at: "2026-11-15T10:00:00Z" };
  filas.push(nuevo);
  const r = await cargarHistorialProgreso(servidor({ a: filas }).fetchPath, "a");
  const local = { sq: { sets: [normalizeWorkoutSet({ kg: 95, reps: 5, date: "15/11/2026" }), normalizeWorkoutSet({ kg: 97.5, reps: 5, date: "18/11/2026" })], max: 97.5 } };
  assert.equal(countPRsThisMonth([{ id: "sq" }], [], local, r.rows), 2); // 95 (15/11) y 97,5 local (18/11), sin duplicar
  assert.equal(exerciseRecordKg("sq", local, r.rows), 97.5);
});

await test("13. error de red durante la paginacion: historial parcial marcado; primera pagina fallida = sin datos del servidor", async () => {
  const filas = dataset(2500);
  const parcial = await cargarHistorialProgreso(servidor({ a: filas }, { falla: (p, off) => off === 1000 }).fetchPath, "a");
  assert.deepEqual([parcial.complete, parcial.reason, parcial.rows.length], [false, "error", 1000]);
  const nada = await cargarHistorialProgreso(servidor({ a: filas }, { falla: (p, off) => off === 0 }).fetchPath, "a");
  assert.deepEqual([nada.rows, nada.complete, nada.reason], [null, false, "error"]);
  // getProgreso conserva su contrato: si falla la primera pagina lanza (los llamadores ya lo manejaban)
  const app = src("App.jsx");
  assert.match(app, /getProgreso: async \(alumnoId\) => \{\s*const r = await cargarHistorialProgreso\(sbFetch, alumnoId\);\s*if \(!r\.rows\) throw/);
  // la carga del login lanza si no hay datos y avisa (consola) si quedo incompleto; Progreso del alumno lo muestra
  assert.match(app, /sb\.getHistorialProgreso\(sessionData\.alumnoId, \{ forzar: true \}\)/);
});

await test("14. cambio rapido de alumno: cada alumno su historial; una respuesta tardia no se aplica; una sola consulta en vuelo", async () => {
  invalidarHistorialProgreso();
  let soltarA;
  const esperaA = new Promise((res) => { soltarA = res; });
  const srv = servidor({ a: dataset(1200, () => ({ alumno_id: "a", kg: 100 })), b: dataset(300, () => ({ alumno_id: "b", kg: 60 })) }, {
    antesDePagina: async (path) => { if (/eq\.a&/.test(path)) await esperaA; },
  });
  const pA1 = obtenerHistorialProgreso(srv.fetchPath, "a");
  const pA2 = obtenerHistorialProgreso(srv.fetchPath, "a"); // misma consulta en vuelo
  assert.equal(pA1, pA2);
  const rB = await obtenerHistorialProgreso(srv.fetchPath, "b"); // B responde antes que A
  assert.ok(rB.rows.every((x) => x.alumno_id === "b"));
  soltarA();
  const rA = await pA1;
  assert.ok(rA.rows.every((x) => x.alumno_id === "a"));
  assert.equal(srv.llamadas.filter((p) => /eq\.a&/.test(p)).length, 2); // 2 paginas de A, no 4
  // cache: abrir Progreso otra vez no repite la consulta; forzar si; otro alumno nunca recibe la cache ajena
  const antes = srv.llamadas.length;
  assert.equal((await obtenerHistorialProgreso(srv.fetchPath, "a")).rows.length, 1200);
  assert.equal(srv.llamadas.length, antes);
  await obtenerHistorialProgreso(srv.fetchPath, "a", { forzar: true });
  assert.equal(srv.llamadas.length, antes + 2);
  let t = NOW_MS;
  await obtenerHistorialProgreso(srv.fetchPath, "b", { forzar: true, now: () => t });
  const n0 = srv.llamadas.length;
  t += 3 * 60 * 1000; // vencio la cache (2 min)
  await obtenerHistorialProgreso(srv.fetchPath, "b", { now: () => t });
  assert.equal(srv.llamadas.length, n0 + 1);
  invalidarHistorialProgreso("a");
  await obtenerHistorialProgreso(srv.fetchPath, "a");
  assert.equal(srv.llamadas.length, n0 + 3);
  // la pantalla de Progreso ignora respuestas de una carga anterior (desmontar / cambiar de alumno)
  const sec = src("components/student-progress/StudentProgressSection.jsx");
  assert.match(sec, /let vigente = true\s*setSbData\(\[\]\)/);
  assert.match(sec, /if \(!vigente\) return\s*if \(h && Array\.isArray\(h\.rows\)\) setSbData\(h\.rows\)/);
  assert.match(src("components/student-progress/GraficoProgreso.jsx"), /if\(!vigente\) return;/);
  assert.match(src("App.jsx"), /invalidarHistorialProgreso\(\); \/\/ D7\.5/);
});

await test("15. historial incompleto: no se cachea, y Progreso no presenta los PR como definitivos", async () => {
  invalidarHistorialProgreso();
  let falla = true;
  const srv = servidor({ a: dataset(2500) }, { falla: (p, off) => falla && off === 2000 });
  const r1 = await obtenerHistorialProgreso(srv.fetchPath, "a");
  assert.equal(r1.complete, false);
  falla = false;
  const r2 = await obtenerHistorialProgreso(srv.fetchPath, "a"); // se vuelve a pedir: el parcial no quedo en cache
  assert.deepEqual([r2.complete, r2.rows.length], [true, 2500]);
  const sec = src("components/student-progress/StudentProgressSection.jsx");
  assert.match(sec, /const historialParcial = historialEstado === 'incompleto' \|\| historialEstado === 'error'/);
  assert.match(sec, /prsThisMonth: historialParcial \? null : countPRsThisMonth\(/);
  assert.match(sec, /data-qa="historial-alumno-incompleto"/);
  assert.match(sec, /'Historial incompleto'/);
});

console.log("\n" + count + " tests OK");
