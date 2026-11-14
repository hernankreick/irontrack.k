// Carga + comparacion de "Prescrito vs. ejecutado" (lib/prescritoEjecutadoCarga.js) con lecturas simuladas. node scripts/test-prescritoEjecutadoCarga.mjs
import assert from "node:assert/strict";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { construirFilaCopia } from "../lib/prescripcionCopiaSync.js";
import { HISTORY_PAGE_SIZE } from "../lib/coachHistoryLoader.js";
import { cargarPrescritoEjecutado, leerCopiasAlumno, huellaMostradaDeSesion, copiasAlumnoPagePath } from "../lib/prescritoEjecutadoCarga.js";

let n = 0; const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const A = "alumno-a", R = "rutina-1", T0 = new Date(2026, 10, 5, 10, 0).getTime();
const rutina = () => ({ id: R, nombre: "R", alumno_id: A, datos: { semana_activa: 1, days: [{ label: "A", warmup: [{ id: "mov", name: "Mov", sets: "2", reps: "12", kg: "20" }], exercises: [{ id: "sq", name: "Sentadilla", sets: "3", reps: "8-10", kg: "50" }] }] } });
const s = prepararInicioEntrenamiento({ storage: memStorage(), alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 }).session;
const uid = s.identity.sessionId;
const copia = Object.assign({ id: "c1", created_at: "2026-11-05T13:00:00Z" }, construirFilaCopia({ rutina: rutina(), alumnoId: A, session: s, capturadaEn: "2026-11-05T13:00:00.000Z" }).row);
const sesion = { id: "s1", alumno_id: A, rutina_id: R, ciclo: 1, semana: 1, dia_idx: 0, fecha: s.fecha, sesion_uid: uid, identidad_v: 1, created_at: "2026-11-05T14:00:00Z" };
let k = 0; const ser = (bloque, pos, ej, kg, reps) => ({ id: "p" + (++k), alumno_id: A, sesion_uid: uid, bloque, pos, ejercicio_id: ej, kg, reps, semana: 0, fecha: s.fecha, created_at: "2026-11-05T13:" + String(10 + k) + ":00Z" });
const completas = () => [ser("warmup", 0, "mov", 20, 12), ser("warmup", 0, "mov", 20, 12), ser("main", 0, "sq", 50, 8), ser("main", 0, "sq", 50, 9), ser("main", 0, "sq", 50, 10)];

// Servidor simulado: pagina por offset/limit como PostgREST.
function srv(o) {
  const d = Object.assign({ sesiones: [sesion], copias: [copia], series: completas() }, o || {}); const calls = [];
  const pagina = (rows, path) => { const off = Number(/offset=(\d+)/.exec(path)[1]), lim = Number(/limit=(\d+)/.exec(path)[1]); return rows.slice(off, off + lim); };
  return { calls,
    requestStatus: async (path) => {
      calls.push(path);
      if (path.startsWith("sesiones?")) return d.fallaSesiones ? { ok: false, status: 500, data: null } : { ok: true, status: 200, data: pagina(d.sesiones, path) };
      if (path.startsWith("prescripcion_copias?")) {
        if (d.sinTabla) return { ok: false, status: 404, data: { code: "PGRST205", message: "Could not find the table 'public.prescripcion_copias'" } };
        if (d.redCopias) throw new Error("network");
        return d.fallaCopias ? { ok: false, status: 500, data: null } : { ok: true, status: 200, data: pagina(d.copias, path) };
      }
      throw new Error("ruta inesperada " + path);
    },
    fetchPath: async (path) => { calls.push(path); return d.fallaSeries ? null : pagina(d.series, path); } };
}
const cargar = (o, extra) => { const x = srv(o); return cargarPrescritoEjecutado(Object.assign({ alumnoId: A, requestStatus: x.requestStatus, fetchPath: x.fetchPath, registroCompletoPosible: true, pendientesLocales: () => 0 }, extra || {})); };

await test("flujo ok: sesion comparada con SU copia; registro completo solo si historial completo + propio + sin pendientes", async () => {
  const r = await cargar(); assert.equal(r.estado, "ok"); const c = r.resultado.sesiones[0].comparacion;
  assert.equal(c.estado, "verificable", JSON.stringify(c.motivos)); assert.equal(c.series.vinculadas, 5); assert.equal(r.resultado.global.estado, "completo");
  assert.deepEqual(r.cobertura, { historial_completo: true, pendientes_locales: 0, registro_completo: true });
  assert.deepEqual([r.resultado.global.porcentajes.series.valor, r.resultado.global.porcentajes.reps.valor, r.resultado.global.porcentajes.kg.valor], [100, 100, 100]);
});
await test("omision solo con registro completo: sin una serie => omitida para el propio alumno; para el entrenador (no puede probarlo) o con pendientes locales NO se afirma", async () => {
  const sinWarmup = completas().filter((x) => x.bloque !== "warmup");
  const propio = await cargar({ series: sinWarmup }); assert.equal(propio.resultado.global.ejercicios.omitidos, 1);
  const coach = await cargar({ series: sinWarmup }, { registroCompletoPosible: false, pendientesLocales: null }); assert.equal(coach.resultado.global.ejercicios.omitidos, 0); assert.equal(coach.resultado.global.ejercicios.sin_evidencia_de_omision, 1); assert.equal(coach.cobertura.registro_completo, false);
  const pend = await cargar({ series: sinWarmup }, { pendientesLocales: () => 2 }); assert.equal(pend.resultado.global.ejercicios.omitidos, 0); assert.equal(pend.cobertura.pendientes_locales, 2);
});
await test("historial de series PARCIAL (una pagina falla): no se afirma omision y la cobertura lo informa", async () => {
  const x = srv({ series: completas().filter((q) => q.bloque !== "warmup") });          // faltan las series de calentamiento
  const relleno = Array.from({ length: HISTORY_PAGE_SIZE - 3 }, (_, i) => ({ id: "old" + i, alumno_id: A, ejercicio_id: "x", kg: 1, reps: 1, semana: 0, fecha: "1/1/2020", created_at: "2020-01-01T00:00:00Z" }));
  const primera = [...relleno, ...completas().filter((q) => q.bloque !== "warmup")];
  const r = await cargarPrescritoEjecutado({ alumnoId: A, requestStatus: x.requestStatus, fetchPath: async (p) => (/offset=0&?/.test(p) || /offset=0$/.test(p) ? primera : null), registroCompletoPosible: true, pendientesLocales: () => 0 });
  assert.equal(r.estado, "ok"); assert.equal(r.cobertura.historial_completo, false); assert.equal(r.cobertura.registro_completo, false);
  assert.equal(r.resultado.global.ejercicios.omitidos, 0, "con historial incompleto no se afirma que se omitio"); assert.equal(r.resultado.global.ejercicios.sin_evidencia_de_omision, 1);
});
await test("estados de error explicitos: sesiones, series o copias que no se leen => 'error' con motivo (nunca un resultado parcial); tabla ausente => 'sin_tabla'; sin alumno", async () => {
  assert.deepEqual((await cargar({ fallaSesiones: true })).motivo, "sesiones"); assert.equal((await cargar({ fallaSeries: true })).motivo, "series");
  assert.equal((await cargar({ fallaCopias: true })).motivo, "copias"); assert.equal((await cargar({ redCopias: true })).estado, "error");
  const st = await cargar({ sinTabla: true }); assert.equal(st.estado, "sin_tabla"); assert.equal(st.resultado, null);
  assert.equal((await cargarPrescritoEjecutado({ alumnoId: "" })).estado, "sin_alumno"); assert.equal((await cargarPrescritoEjecutado({})).estado, "sin_alumno");
  assert.equal((await cargarPrescritoEjecutado({ alumnoId: A })).estado, "error", "sin funciones de lectura no lanza");
});
await test("sin copias (historicas): cada sesion queda sin_copia; con copia ambigua queda ambigua; con copia de otra semana no se usa", async () => {
  assert.equal((await cargar({ copias: [] })).resultado.sesiones[0].comparacion.estado, "sin_copia");
  const otraHuella = Object.assign({}, copia, { id: "c2", prescripcion_hash: "sha256:" + "0".repeat(64) });
  assert.equal((await cargar({ copias: [copia, otraHuella] })).resultado.sesiones[0].comparacion.estado, "ambigua");
  const otraSemana = Object.assign({}, copia, { semana: 2 }); assert.equal((await cargar({ copias: [otraSemana] })).resultado.sesiones[0].comparacion.estado, "sin_copia");
  assert.equal((await cargar({ sesiones: [Object.assign({}, sesion, { sesion_uid: null, identidad_v: null })], series: completas().map((x) => Object.assign(x, { sesion_uid: null })) })).resultado.sesiones[0].comparacion.estado, "sin_finalizar");
});
await test("paginacion: mas de una pagina de copias, sesiones y series se leen completas; copias marcadas origen servidor; la huella mostrada solo cuenta capturas de INICIO y unicas", async () => {
  const muchas = Array.from({ length: 1200 }, (_, i) => Object.assign({}, copia, { id: "c" + i, semana: 1 + (i % 2), dia_idx: 5 + i }));
  const x = srv({ copias: muchas }); const r = await leerCopiasAlumno(x.requestStatus, A); assert.equal(r.ok, true); assert.equal(r.rows.length, 1200); assert.ok(r.rows.every((c) => c.origen_lectura === "servidor"));
  assert.ok(x.calls.filter((c) => c.startsWith("prescripcion_copias")).length >= 2); assert.match(copiasAlumnoPagePath(A, 0, 500), /prescripcion_copias\?alumno_id=eq\.alumno-a&select=\*&order=created_at\.asc,id\.asc&limit=500&offset=0/);
  const f = huellaMostradaDeSesion([copia]); assert.equal(f(sesion), copia.prescripcion_hash); assert.equal(huellaMostradaDeSesion([copia, Object.assign({}, copia, { prescripcion_hash: "sha256:" + "1".repeat(64) })])(sesion), "");
  const reanudacion = JSON.parse(JSON.stringify(copia)); reanudacion.snapshot.captura.momento = "reanudacion"; assert.equal(huellaMostradaDeSesion([reanudacion])(sesion), "");
});
console.log("\n" + n + " pruebas OK");
