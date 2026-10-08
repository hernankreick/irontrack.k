// Carga de alumnos del entrenador: sin carreras, sin convertir errores en "0 alumnos".
//   node scripts/test-coachAlumnosLoad.mjs
// Usa lib/coachAlumnosLoad.js y lib/appHelpers.js reales con un fetchRows falso. Sin red.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanActiveCoachAlumnos } from "../lib/appHelpers.js";
import { selectCoachStudentListState } from "../lib/coachStudentListSelectors.js";
import {
  ALUMNOS_STATUS, COACH_ALUMNOS_QUERY_ID, alumnosEmptyKind, createLoadGate, loadCoachAlumnos,
} from "../lib/coachAlumnosLoad.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const LEGACY = COACH_ALUMNOS_QUERY_ID;
const UUID = "11111111-2222-3333-4444-555555555555";
const nine = Array.from({ length: 9 }, (_, i) => ({ id: "a" + i, nombre: "Alumno " + i, entrenador_id: LEGACY, auth_uid: "u" + i }));
// DB falsa: solo devuelve filas cuyo entrenador_id coincide con la consulta.
const db = (rows) => async (entId) => rows.filter((r) => r.entrenador_id === entId);
const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
const run = (fetchRows, gate) => loadCoachAlumnos({ fetchRows, clean: cleanActiveCoachAlumnos, gate });

await test("1. nueve alumnos legacy se cargan", async () => {
  const r = await run(db(nine), createLoadGate());
  assert.equal(r.status, "ready");
  assert.equal(r.alumnos.length, 9);
});

await test("1b. la consulta usa siempre entrenador_principal, nunca el UUID de Auth", async () => {
  const seen = [];
  await run(async (id) => { seen.push(id); return nine; }, createLoadGate());
  assert.deepEqual(seen, [LEGACY]);
});

await test("2. una consulta UUID vacia no borra alumnos validos (el UUID ya no se consulta)", async () => {
  let state = [];
  const r1 = await run(db(nine), createLoadGate());
  state = r1.alumnos;
  // Antes: cargarAlumnos(UUID) devolvia [] y setAlumnos([]) pisaba la lista. Ahora solo existe la carga legacy.
  assert.equal((await db(nine)(UUID)).length, 0);
  assert.equal(state.length, 9);
});

await test("2b. no se amplia el acceso: filas de otro entrenador se descartan", async () => {
  const mixed = nine.concat([{ id: "x1", nombre: "Ajeno", entrenador_id: UUID }]);
  const r = await run(async () => mixed, createLoadGate());
  assert.equal(r.alumnos.length, 9);
  assert.ok(!r.alumnos.some((a) => a.id === "x1"));
});

await test("3. error HTTP no se convierte en lista vacia", async () => {
  const r = await run(async () => { throw new Error("[Supabase 401]"); }, createLoadGate());
  assert.equal(r.status, "error");
  assert.equal(r.alumnos, undefined);
});

await test("3b. respuesta no-array tampoco es 'sin alumnos'", async () => {
  const r = await run(async () => null, createLoadGate());
  assert.equal(r.status, "error");
});

await test("3c. ante error se conservan los datos previos (el consumidor no escribe en error)", async () => {
  let alumnos = (await run(db(nine), createLoadGate())).alumnos;
  const r = await run(async () => { throw new Error("500"); }, createLoadGate());
  if (r.status === "ready") alumnos = r.alumnos; // misma regla que hooks/useAlumnos.js
  assert.equal(alumnos.length, 9);
});

await test("4. respuestas en distinto orden: una respuesta vieja no pisa la reciente", async () => {
  const gate = createLoadGate();
  const slow = deferred(), fast = deferred();
  const p1 = run(() => slow.p, gate);   // carga 1 (vieja)
  const p2 = run(() => fast.p, gate);   // carga 2 (reciente)
  fast.res(nine);
  slow.res([]);                          // llega despues, con datos viejos/vacios
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.status, "stale");
  assert.equal(r2.status, "ready");
  assert.equal(r2.alumnos.length, 9);
});

await test("4b. un error viejo tardio tampoco pisa la carga reciente", async () => {
  const gate = createLoadGate();
  const slow = deferred(), fast = deferred();
  const p1 = run(() => slow.p, gate);
  const p2 = run(() => fast.p, gate);
  fast.res(nine);
  slow.rej(new Error("timeout"));
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.status, "stale");
  assert.equal(r2.status, "ready");
});

await test("5-7. estados: carga inicial, error sin datos previos, vacio real", () => {
  assert.equal(alumnosEmptyKind(ALUMNOS_STATUS.IDLE, 0), "loading");
  assert.equal(alumnosEmptyKind(ALUMNOS_STATUS.LOADING, 0), "loading");
  assert.equal(alumnosEmptyKind(ALUMNOS_STATUS.ERROR, 0), "error");
  assert.equal(alumnosEmptyKind(ALUMNOS_STATUS.READY, 0), "empty");
  assert.equal(alumnosEmptyKind(ALUMNOS_STATUS.ERROR, 9), "list"); // con datos previos se muestran
  assert.equal(alumnosEmptyKind(ALUMNOS_STATUS.READY, 9), "list");
});

await test("7b. lista realmente vacia (200 con []) es 'ready', no error", async () => {
  const r = await run(async () => [], createLoadGate());
  assert.equal(r.status, "ready");
  assert.equal(alumnosEmptyKind(r.status, r.alumnos.length), "empty");
});

await test("8. dashboard y listado derivan de la misma lista limpia", async () => {
  const r = await run(db(nine), createLoadGate());
  const st = selectCoachStudentListState({
    alumnosActivosLimpios: r.alumnos, rutinasUnificadas: [], sesionesGlobalesLimpias: [],
    progresoGlobalLimpio: {}, coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
  });
  assert.equal(st.coachAlumnosCounts.todos, r.alumnos.length);
  assert.equal(st.coachAlumnosListaFiltrada.length, r.alumnos.length);
});

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useAlumnos.js", import.meta.url), "utf8");

await test("9. login actual: it_session.entrenadorId (UUID) no participa de la consulta de alumnos", () => {
  assert.ok(!/it_session/.test(hook), "useAlumnos no debe leer it_session");
  assert.ok(/fetchRows: sb\.getAlumnosStrict/.test(hook));
});

await test("10. flujo de alumnos intacto: creacion sigue con ENTRENADOR_ID y el estado tiene un unico escritor de carga", () => {
  assert.ok(/const ENTRENADOR_ID = "entrenador_principal"/.test(app));
  const students = readFileSync(new URL("../components/students/StudentsSection.jsx", import.meta.url), "utf8");
  assert.ok(/entrenador_id:ENTRENADOR_ID/.test(students));
  assert.ok(!/setAlumnos\(clean\)|setAlumnos\(sbAlumnos\)/.test(app), "App.jsx no debe volver a escribir alumnos desde una carga propia");
  assert.ok(!/sb\.getAlumnos\(/.test(app), "no debe quedar consumidor que convierta null en []");
});

console.log("\n" + count + " tests ok");
