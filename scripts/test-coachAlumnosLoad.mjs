// Carga de alumnos del entrenador: sin carreras, sin convertir errores en "0 alumnos", con recuperacion.
//   node scripts/test-coachAlumnosLoad.mjs
// Usa lib/coachAlumnosLoad.js y lib/appHelpers.js reales con un fetchRows falso. Sin red.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanActiveCoachAlumnos } from "../lib/appHelpers.js";
import { selectCoachStudentListState } from "../lib/coachStudentListSelectors.js";
import {
  ALUMNOS_STATUS as S, COACH_ALUMNOS_QUERY_ID, alumnosEmptyKind, alumnosIdsKey, alumnosRefreshFailed,
  createAlumnosController,
} from "../lib/coachAlumnosLoad.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const LEGACY = COACH_ALUMNOS_QUERY_ID;
const UUID = "11111111-2222-3333-4444-555555555555";
const nine = Array.from({ length: 9 }, (_, i) => ({ id: "a" + i, nombre: "Alumno " + i, entrenador_id: LEGACY, auth_uid: "u" + i }));
const deferred = () => { let res, rej; const p = new Promise((a, b) => { res = a; rej = b; }); return { p, res, rej }; };
// Controlador con cola de respuestas manuales: cada fetchRows toma el siguiente deferred.
function make(queueOrFn) {
  const calls = [];
  const queue = Array.isArray(queueOrFn) ? queueOrFn.slice() : null;
  const snaps = [];
  const ctrl = createAlumnosController({
    fetchRows: async (id) => {
      calls.push(id);
      if (queue) { const d = queue.shift(); if (!d) throw new Error("sin respuesta preparada"); return d.p; }
      return queueOrFn(id, calls.length);
    },
    clean: cleanActiveCoachAlumnos,
    onChange: (st) => snaps.push(st),
  });
  return { ctrl, calls, snaps };
}
const rowsOf = (n, pre = "a") => Array.from({ length: n }, (_, i) => ({ id: pre + i, nombre: pre + i, entrenador_id: LEGACY }));

await test("1. nueve alumnos legacy se cargan; la consulta usa entrenador_principal y nunca el UUID", async () => {
  const { ctrl, calls } = make(async () => nine);
  const r = await ctrl.load();
  assert.equal(r.length, 9);
  assert.deepEqual(calls, [LEGACY]);
  assert.equal(ctrl.getState().status, S.READY);
});

await test("1b. no se amplia el acceso: filas de otro entrenador se descartan", async () => {
  const { ctrl } = make(async () => nine.concat([{ id: "x1", nombre: "Ajeno", entrenador_id: UUID }]));
  const r = await ctrl.load();
  assert.equal(r.length, 9);
  assert.ok(!r.some((a) => a.id === "x1"));
});

await test("2. error HTTP no se convierte en lista vacia (sin datos previos: status error, alumnos [])", async () => {
  const { ctrl } = make(async () => { throw new Error("[Supabase 401]"); });
  assert.equal(await ctrl.load(), null);
  assert.equal(ctrl.getState().status, S.ERROR);
  assert.deepEqual(ctrl.getState().alumnos, []);
  assert.equal(alumnosEmptyKind(S.ERROR, 0), "error");
});

await test("2b. respuesta no-array tampoco es 'sin alumnos'", async () => {
  const { ctrl } = make(async () => null);
  await ctrl.load();
  assert.equal(ctrl.getState().status, S.ERROR);
});

await test("3. P1-1: error inicial seguido de reintento exitoso (sin recargar)", async () => {
  let n = 0;
  const { ctrl } = make(async () => { if (++n === 1) throw new Error("red"); return nine; });
  await ctrl.load();
  assert.equal(ctrl.getState().status, S.ERROR);
  const r = await ctrl.refresh(); // tick de 30 s
  assert.equal(r.length, 9);
  assert.equal(ctrl.getState().status, S.READY);
});

await test("4. P2-1: refresco periodico exitoso trae alumnos nuevos de otro dispositivo", async () => {
  let n = 0;
  const { ctrl } = make(async () => (++n === 1 ? rowsOf(9) : rowsOf(10)));
  await ctrl.load();
  const before = alumnosIdsKey(ctrl.getState().alumnos);
  await ctrl.refresh();
  assert.equal(ctrl.getState().alumnos.length, 10);
  assert.notEqual(alumnosIdsKey(ctrl.getState().alumnos), before); // dispara la carga de sesiones/rutinas
});

await test("5. P2-5: error de refresco con datos previos conserva la lista y marca aviso", async () => {
  let n = 0;
  const { ctrl } = make(async () => { if (++n === 1) return nine; throw new Error("500"); });
  await ctrl.load();
  await ctrl.refresh();
  const st = ctrl.getState();
  assert.equal(st.alumnos.length, 9);
  assert.equal(st.status, S.ERROR);
  assert.equal(alumnosRefreshFailed(st.status, st.alumnos.length), true);
  assert.equal(alumnosEmptyKind(st.status, st.alumnos.length), "list"); // nunca oculta datos
  assert.equal(alumnosRefreshFailed(S.ERROR, 0), false); // error inicial es otro caso
});

await test("6. refresh no abre consultas simultaneas", async () => {
  const d = deferred();
  const { ctrl, calls } = make([d]);
  const p = ctrl.load();
  assert.equal(await ctrl.refresh(), null);
  assert.equal(await ctrl.refresh(), null);
  assert.equal(calls.length, 1);
  d.res(nine); await p;
  assert.equal(calls.length, 1);
});

await test("7. respuestas en orden inverso: la vieja no pisa la reciente (exito y error)", async () => {
  const slow = deferred(), fast = deferred();
  const { ctrl } = make([slow, fast]);
  const p1 = ctrl.load(), p2 = ctrl.load();
  fast.res(nine); slow.res([]);
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, null); assert.equal(r2.length, 9);
  assert.equal(ctrl.getState().alumnos.length, 9);
  const slow2 = deferred(), fast2 = deferred();
  const m = make([slow2, fast2]);
  const q1 = m.ctrl.load(), q2 = m.ctrl.load();
  fast2.res(nine); slow2.rej(new Error("timeout"));
  await Promise.all([q1, q2]);
  assert.equal(m.ctrl.getState().status, S.READY);
  assert.equal(m.ctrl.getState().alumnos.length, 9);
});

await test("8. P2-2: alta local durante una consulta pendiente no se pierde", async () => {
  const d1 = deferred(), d2 = deferred();
  const { ctrl, calls } = make([d1, d2]);
  const p = ctrl.load();
  const nuevo = { id: "nuevo", nombre: "Nuevo", entrenador_id: LEGACY };
  ctrl.mutate((prev) => cleanActiveCoachAlumnos(prev.concat([nuevo]), LEGACY)); // StudentsSection.jsx:166
  d1.res(nine); // respuesta anterior al alta: no debe aplicarse
  await Promise.resolve();
  assert.ok(ctrl.getState().alumnos.some((a) => a.id === "nuevo"), "el alta sigue visible");
  assert.equal(ctrl.getState().alumnos.length, 1);
  d2.res(nine.concat([nuevo])); // reconsulta con el servidor ya actualizado
  const r = await p;
  assert.equal(calls.length, 2);
  assert.equal(r.length, 10);
  assert.ok(r.some((a) => a.id === "nuevo"));
});

await test("9. P2-2: baja local durante una consulta pendiente no hace reaparecer al alumno", async () => {
  const d0 = deferred(), d1 = deferred(), d2 = deferred();
  const { ctrl } = make([d0, d1, d2]);
  const p0 = ctrl.load(); d0.res(nine); await p0;
  const p = ctrl.refresh();
  ctrl.mutate((prev) => prev.filter((x) => x.id !== "a3")); // App.jsx:2696
  d1.res(nine); // respuesta vieja con a3
  await Promise.resolve();
  assert.ok(!ctrl.getState().alumnos.some((a) => a.id === "a3"));
  d2.res(nine.filter((x) => x.id !== "a3"));
  const r = await p;
  assert.equal(r.length, 8);
});

await test("10. P2-3: logout durante una consulta pendiente: la respuesta tardia no repuebla", async () => {
  const d = deferred();
  const { ctrl } = make([d]);
  const p = ctrl.load();
  ctrl.reset(); // logout / cleanup del efecto
  d.res(nine);
  assert.equal(await p, null);
  assert.deepEqual(ctrl.getState(), { alumnos: [], status: S.IDLE });
});

await test("11. P2-3: cambio de usuario o rol durante una consulta: respuesta del usuario anterior descartada", async () => {
  const dA = deferred(), dB = deferred();
  const { ctrl } = make([dA, dB]);
  const pA = ctrl.load();            // entrenador A
  ctrl.reset();                      // cambia identidad
  const pB = ctrl.load();            // entrenador B
  dB.res([{ id: "b1", nombre: "B", entrenador_id: LEGACY }]);
  dA.res(nine);                      // llega tarde, de A
  await Promise.all([pA, pB]);
  assert.deepEqual(ctrl.getState().alumnos.map((a) => a.id), ["b1"]);
  // rol alumno: reset deja idle y nada se carga
  ctrl.reset();
  assert.equal(ctrl.getState().status, S.IDLE);
  assert.equal(alumnosEmptyKind(S.IDLE, 0), "loading");
});

await test("12. P2-4: init superada por otra carga: gana la vigente y la clave de ids cambia una sola vez", async () => {
  const d1 = deferred(), d2 = deferred();
  const { ctrl, snaps } = make([d1, d2]);
  const init = ctrl.load();        // init #1
  const init2 = ctrl.load();       // se resolvio la sesion de Supabase: init #2 la supera
  d2.res(nine); d1.res(nine);
  const [r1, r2] = await Promise.all([init, init2]);
  assert.equal(r1, null); assert.equal(r2.length, 9);
  const keys = new Set(snaps.map((s) => alumnosIdsKey(s.alumnos)).filter(Boolean));
  assert.equal(keys.size, 1, "sesiones/rutinas se piden una vez, con la lista vigente");
});

await test("13. clave de ids: ediciones no la cambian; altas y bajas si (sin ciclos de recarga)", () => {
  const a = rowsOf(3);
  assert.equal(alumnosIdsKey(a), alumnosIdsKey(a.map((x) => ({ ...x, ultimo_pago_confirmado: "hoy" }))));
  assert.equal(alumnosIdsKey(a), alumnosIdsKey([...a].reverse()));
  assert.notEqual(alumnosIdsKey(a), alumnosIdsKey(a.slice(1)));
  assert.equal(alumnosIdsKey([]), "");
});

await test("14. sin ciclos: un refresh sin cambios no cambia la clave; no dispara reconsultas por si solo", async () => {
  const { ctrl, calls } = make(async () => nine);
  await ctrl.load();
  const k = alumnosIdsKey(ctrl.getState().alumnos);
  await ctrl.refresh(); await ctrl.refresh();
  assert.equal(alumnosIdsKey(ctrl.getState().alumnos), k);
  assert.equal(calls.length, 3); // una por llamada explicita; ninguna automatica
});

await test("15. estados: carga inicial, error sin datos, vacio real", async () => {
  assert.equal(alumnosEmptyKind(S.IDLE, 0), "loading");
  assert.equal(alumnosEmptyKind(S.LOADING, 0), "loading");
  assert.equal(alumnosEmptyKind(S.ERROR, 0), "error");
  assert.equal(alumnosEmptyKind(S.READY, 0), "empty");
  const { ctrl } = make(async () => []);
  await ctrl.load();
  assert.equal(alumnosEmptyKind(ctrl.getState().status, ctrl.getState().alumnos.length), "empty");
});

await test("16. dashboard y listado derivan de la misma lista limpia", async () => {
  const { ctrl } = make(async () => nine);
  await ctrl.load();
  const l = ctrl.getState().alumnos;
  const st = selectCoachStudentListState({
    alumnosActivosLimpios: l, rutinasUnificadas: [], sesionesGlobalesLimpias: [],
    progresoGlobalLimpio: {}, coachAlumnosSearch: "", coachAlumnosFilter: "todos", nowMs: Date.now(),
  });
  assert.equal(st.coachAlumnosCounts.todos, l.length);
  assert.equal(st.coachAlumnosListaFiltrada.length, l.length);
});

const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const hook = readFileSync(new URL("../hooks/useAlumnos.js", import.meta.url), "utf8");
const students = readFileSync(new URL("../components/students/StudentsSection.jsx", import.meta.url), "utf8");

await test("17. cableado: el hook no lee it_session; login actual intacto; un solo escritor de carga", () => {
  assert.ok(!/it_session/.test(hook));
  assert.ok(/getAlumnosStrict\(entrenadorId\)/.test(hook));
  assert.ok(/const ENTRENADOR_ID = "entrenador_principal"/.test(app));
  assert.ok(/entrenador_id:ENTRENADOR_ID/.test(students));
  assert.ok(!/sb\.getAlumnos\(/.test(app) && !/sb\.getAlumnosStrict\(/.test(app), "App.jsx no consulta alumnos por su cuenta");
  assert.ok(!/setAlumnos\(clean\)|setAlumnos\(sbAlumnos\)/.test(app));
});

await test("18. cableado de efectos: intervalo de 30 s sin cierres obsoletos, reset por identidad, sin ciclos", () => {
  assert.ok(/cargarSesionesGlobalesRef\.current\(\)/.test(app), "el intervalo usa la version vigente via ref");
  assert.ok(/refrescarAlumnos\(\);/.test(app) && /30000\)/.test(app));
  assert.ok(/return function\(\) \{ resetAlumnos\(\); \}/.test(app), "reset al cambiar identidad / cerrar sesion");
  assert.ok(/\[sessionData\?\.role, alumnosIdsClave\]/.test(app), "sesiones/rutinas dependen de la clave de ids, no del array");
  assert.ok(!/setInterval\(function\(\) \{ cargarSesionesGlobales\(\); \}/.test(app), "se elimino el intervalo con cierre obsoleto");
});

await test("19. aviso discreto presente en dashboard y listado", () => {
  assert.ok(/alumnosRefreshFailed/.test(readFileSync(new URL("../components/CoachDashboard.jsx", import.meta.url), "utf8")));
  assert.ok(/alumnosRefreshFailed/.test(readFileSync(new URL("../components/students/StudentsSectionStates.jsx", import.meta.url), "utf8")));
});

console.log("\n" + count + " tests ok");
