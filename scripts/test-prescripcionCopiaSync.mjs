// Captura y cola de la copia inmutable de prescripcion (lib/prescripcionCopiaSync.js). node scripts/test-prescripcionCopiaSync.mjs  (datos ficticios, sin red)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import * as C from "../lib/prescripcionCopiaSync.js";

let n = 0; const test = async (name, fn) => { C.__resetCopiasParaPruebas(); await fn(); n++; console.log("ok -", name); };
const memStorage = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const A = "alumno-a", B = "alumno-b", R = "rutina-1", T0 = new Date(2026, 10, 5, 10, 0).getTime();
const rutina = () => ({ id: R, nombre: "R", alumno_id: A, datos: { semana_activa: 1, days: [{ label: "A", warmup: [{ id: "mov", name: "Mov", sets: "2", reps: "12", kg: "20" }], exercises: [{ id: "sq", name: "Sentadilla", sets: "3", reps: "8-10", kg: "50" }] }] },
  // estado LOCAL durante el entrenamiento: logSet reemplaza el kg base por el ultimo registrado. NO debe copiarse.
  days: [{ label: "A", warmup: [{ id: "mov", sets: "2", reps: "12", kg: "20" }], exercises: [{ id: "sq", sets: "3", reps: "8-10", kg: "77" }] }] });
const iniciar = (st, o) => prepararInicioEntrenamiento(Object.assign({ storage: st, alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 }, o || {}));
const ok = (res, status = 201, data = []) => ({ ok: true, status, data });
const err = (status, data) => ({ ok: false, status, data: data || null });

await test("bandera: solo el token exacto activa; en Node/pruebas la de build esta apagada; un rechazo la apaga", () => {
  assert.equal(C.copiasPrescripcionActivas({ [C.COPIAS_ENV_VAR]: C.TOKEN_COPIAS }), true);
  for (const e of [{}, null, undefined, { [C.COPIAS_ENV_VAR]: "1" }, { [C.COPIAS_ENV_VAR]: C.TOKEN_COPIAS + " " }, { [C.COPIAS_ENV_VAR]: C.TOKEN_COPIAS.toUpperCase() }]) assert.equal(C.copiasPrescripcionActivas(e), false);
  assert.equal(C.copiasPrescripcionDesdeEntorno(), false); assert.equal(C.copiasBanderaDeBuild(), false);
});
await test("la copia sale de rutina.datos.days (servidor), NO de rutina.days (kg local ya reemplazado); semana 1..4 desde la identidad; inmutable", () => {
  const st = memStorage(); const s = iniciar(st).session; const r = C.construirFilaCopia({ rutina: rutina(), alumnoId: A, session: s, capturadaEn: "2026-11-05T13:00:00.000Z" });
  assert.equal(r.ok, true, JSON.stringify(r));
  const row = r.row; const sq = row.snapshot.ejercicios.find((e) => e.id === "sq");
  assert.equal(sq.kg, "50"); assert.ok(!JSON.stringify(row.snapshot).includes("77"), "el kg local no entra");
  assert.deepEqual([row.alumno_id, row.rutina_id, row.ciclo, row.semana, row.dia_idx, row.fecha_dia], [A, R, 1, 1, 0, "2026-11-05"]);
  assert.match(row.prescripcion_hash, /^sha256:[0-9a-f]{64}$/); assert.equal(row.snapshot.captura.momento, "inicio"); assert.equal(row.snapshot.semana_mostrada, 1);
  assert.throws(() => { "use strict"; row.snapshot.ejercicios.push({}); }); assert.ok(Object.isFrozen(row));
});
await test("sin identidad / alumno o rutina distintos / semana fuera de 1..4 / sin datos del servidor: no hay copia (motivo explicito)", () => {
  const st = memStorage(); const s = iniciar(st).session;
  const sinId = Object.assign({}, s); delete sinId.identity;
  assert.equal(C.construirFilaCopia({ rutina: rutina(), alumnoId: A, session: sinId }).motivo, "sin_identidad");
  assert.equal(C.construirFilaCopia({ rutina: rutina(), alumnoId: B, session: s }).motivo, "alumno_no_coincide");
  assert.equal(C.construirFilaCopia({ rutina: Object.assign(rutina(), { id: "otra" }), alumnoId: A, session: s }).motivo, "rutina_no_coincide");
  const sinDatos = rutina(); delete sinDatos.datos; assert.equal(C.construirFilaCopia({ rutina: sinDatos, alumnoId: A, session: s }).motivo, "sin_datos_servidor");
  const s5 = Object.assign({}, s, { identity: Object.assign({}, s.identity, { semanaIdx: 4 }) }); assert.equal(C.construirFilaCopia({ rutina: rutina(), alumnoId: A, session: s5 }).motivo, "semana_invalida");
  assert.equal(C.construirFilaCopia({}).ok, false); assert.equal(C.construirFilaCopia(null).ok, false);
});
await test("captura al iniciar: solo activa y en un inicio REAL; la reanudacion tras recargar no captura otra copia; la cola es idempotente", () => {
  const st = memStorage(), cola = memStorage(); const a = iniciar(st);
  assert.equal(C.capturarCopiaAlIniciar({ activa: false, storage: cola, rutina: rutina(), alumnoId: A, session: a.session }).motivo, "desactivada"); assert.equal(cola.length, 0);
  const c1 = C.capturarCopiaAlIniciar({ activa: true, recuperada: a.recuperada, storage: cola, rutina: rutina(), alumnoId: A, session: a.session, ahora: T0 }); assert.equal(c1.ok, true); assert.equal(c1.ya_estaba, false); assert.equal(cola.length, 1);
  const rec = iniciar(st, { now: T0 + 60000 }); assert.equal(rec.recuperada, true);
  assert.equal(C.capturarCopiaAlIniciar({ activa: true, recuperada: rec.recuperada, storage: cola, rutina: Object.assign(rutina(), { datos: Object.assign(rutina().datos, { days: [] }) }), alumnoId: A, session: rec.session }).motivo, "reanudacion");
  const again = C.capturarCopiaAlIniciar({ activa: true, recuperada: false, storage: cola, rutina: rutina(), alumnoId: A, session: a.session }); assert.equal(again.ya_estaba, true); assert.equal(cola.length, 1);
  const pend = C.copiasPendientes(cola, A); assert.equal(pend.length, 1); assert.deepEqual(pend[0].item.row.snapshot, C.construirFilaCopia({ rutina: rutina(), alumnoId: A, session: a.session }).row.snapshot);
  assert.equal(C.capturarCopiaAlIniciar({ activa: true, storage: { getItem() { throw new Error("x"); }, setItem() { throw new Error("quota"); } }, rutina: rutina(), alumnoId: A, session: a.session }).ok, false, "almacenamiento roto no lanza");
});
await test("envio: offline conserva la copia; reconexion la envia; reintento 23505 sobre la unica = ya guardada (sin duplicar); no mezcla alumnos", async () => {
  const st = memStorage(), cola = memStorage(); const a = iniciar(st).session;
  C.capturarCopiaAlIniciar({ activa: true, storage: cola, rutina: rutina(), alumnoId: A, session: a });
  const b = iniciar(memStorage(), { alumnoId: B }).session; C.capturarCopiaAlIniciar({ activa: true, storage: cola, rutina: Object.assign(rutina(), { alumno_id: B }), alumnoId: B, session: b });
  const off = await C.enviarCopiasPendientes({ storage: cola, alumnoId: A, post: async () => { throw new Error("network"); } }); assert.deepEqual([off.enviadas, off.pendientes], [0, 1]); assert.equal(cola.length, 2);
  const filas = []; const post = async (row) => { filas.push(row); return ok(); };
  const on = await C.enviarCopiasPendientes({ storage: cola, alumnoId: A, post }); assert.deepEqual([on.enviadas, on.pendientes], [1, 0]); assert.equal(filas.length, 1); assert.equal(filas[0].alumno_id, A); assert.equal(cola.length, 1, "la de B sigue en su cola");
  C.capturarCopiaAlIniciar({ activa: true, storage: cola, rutina: rutina(), alumnoId: A, session: a });                                             // respuesta perdida: se vuelve a encolar y reenviar
  const dup = await C.enviarCopiasPendientes({ storage: cola, alumnoId: A, post: async () => err(409, { code: "23505", message: 'duplicate key value violates unique constraint "' + C.CONSTRAINT_UNICA + '"' }) });
  assert.deepEqual([dup.ya_guardadas, dup.pendientes, dup.descartadas], [1, 0, 0]);
});
await test("errores: 5xx/429 reintentan; 400 (la base la rechaza) se descarta y se informa; tabla ausente/sin permiso corta los intentos y CONSERVA la cola; 409 de otra restriccion no es 'ya guardada'", async () => {
  const mk = () => { const st = memStorage(), cola = memStorage(); const a = iniciar(st).session; C.capturarCopiaAlIniciar({ activa: true, storage: cola, rutina: rutina(), alumnoId: A, session: a }); return cola; };
  for (const status of [500, 502, 408, 429]) { const c = mk(); const r = await C.enviarCopiasPendientes({ storage: c, alumnoId: A, post: async () => err(status, { message: "x" }) }); assert.deepEqual([r.pendientes, r.descartadas], [1, 0], "status " + status); assert.equal(c.length, 1); }
  let c = mk(); let r = await C.enviarCopiasPendientes({ storage: c, alumnoId: A, post: async () => err(400, { code: "23514", message: "check" }) }); assert.deepEqual([r.descartadas, r.pendientes], [1, 0]); assert.equal(c.length, 0);
  c = mk(); r = await C.enviarCopiasPendientes({ storage: c, alumnoId: A, post: async () => err(409, { code: "23505", message: 'duplicate key value violates unique constraint "otra"' }) }); assert.equal(r.ya_guardadas, 0);
  for (const res of [err(404, { code: "PGRST205" }), err(403, { code: "42501" }), err(401, null)]) {
    C.__resetCopiasParaPruebas(); c = mk(); r = await C.enviarCopiasPendientes({ storage: c, alumnoId: A, post: async () => res });
    assert.equal(r.rechazada, true); assert.equal(c.length, 1, "la copia no se pierde"); assert.equal(C.copiasRechazadas(), true); assert.equal(C.copiasPrescripcionActivas({ [C.COPIAS_ENV_VAR]: C.TOKEN_COPIAS }), false, "deja de intentar en esta carga");
    let llamadas = 0; const otra = await C.enviarCopiasPendientes({ storage: c, alumnoId: A, post: async () => { llamadas++; return ok(); } }); assert.equal(llamadas, 0); assert.equal(otra.rechazada, true);
  }
});
await test("entradas corruptas o ajenas se ignoran sin borrarlas; sin almacenamiento no lanza", async () => {
  const cola = memStorage(); cola.setItem(C.COLA_COPIAS_PREFIJO + A + ":zzz", "{no es json"); cola.setItem(C.COLA_COPIAS_PREFIJO + A + ":yyy", JSON.stringify({ v: 9 })); cola.setItem("otra_clave", "1");
  assert.equal(C.copiasPendientes(cola, A).length, 0); assert.equal(cola.length, 3); assert.deepEqual(await C.enviarCopiasPendientes({ storage: cola, alumnoId: A, post: async () => ok() }), { enviadas: 0, ya_guardadas: 0, pendientes: 0, descartadas: 0, rechazada: false });
  assert.deepEqual(C.copiasPendientes(null, A), []); assert.equal((await C.enviarCopiasPendientes({})).enviadas, 0);
});
await test("cableado en App.jsx: captura solo en el inicio del alumno (no readOnly/compartido) y envio con la misma funcion de peticion; sin la bandera nada se activa", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(app.includes("capturarCopiaAlIniciar({"), "captura al iniciar"); assert.ok(app.includes("enviarCopiasPendientes({"), "envio");
  const i = app.indexOf("capturarCopiaAlIniciar({"); assert.ok(app.slice(i - 400, i + 500).includes("copiasPrescripcionDesdeEntorno()"), "solo con la bandera");
  assert.ok(!/import\.meta\.env\.VITE_IRONTRACK_COPIAS_PRESCRIPCION/.test(app), "la bandera solo se lee en lib/prescripcionCopiaSync.js");
  assert.ok(readFileSync(new URL("../lib/prescripcionCopiaSync.js", import.meta.url), "utf8").includes("import.meta.env.VITE_IRONTRACK_COPIAS_PRESCRIPCION"));
});
console.log("\n" + n + " pruebas OK");
