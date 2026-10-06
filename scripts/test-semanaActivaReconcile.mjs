// Fix de persistencia y reconciliacion de rutinas.datos.semana_activa (T01.2 follow-up).
//
//   node scripts/test-semanaActivaReconcile.mjs
//
// Modulos reales (lib/reconcileSemanaActiva.js, lib/rutinaOperationalState.js, lib/updateRutinaSemanaActiva.js, lib/finalizeWorkoutSession.js,
// lib/routineStore.js) contra un cliente "Supabase" falso en memoria. Sin red, sin dependencias nuevas, sin tocar datos reales:
// el fixture de Evi es solo un fixture.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  deriveSemanaActivaTarget, fetchAllSesionesDeRutina, reconcileSemanaActiva, SESSIONS_PAGE_SIZE, SESSIONS_MAX_PAGES,
} from "../lib/reconcileSemanaActiva.js";
import {
  OPERATIONAL_DATOS_KEYS, mergeOperationalDatos, readSemanaActiva, updateRutinaPreservingOperational, withInitialSemanaActiva,
} from "../lib/rutinaOperationalState.js";
import { updateRutinaSemanaActiva } from "../lib/updateRutinaSemanaActiva.js";
import { finalizeStudentSession } from "../lib/finalizeWorkoutSession.js";
import { buildRutinaInsertBody, cleanRutinaWriteBody } from "../lib/routineStore.js";
import { buildSessionPayload, removeUndefinedPayloadFields } from "../lib/workoutSession.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const EVI = "76fb8876-270a-4fa6-9b7a-f664e0b42799";
const EVI3 = "1653a3d7-1dd3-438f-93d7-4f31a5b81548";
const OTHER = "96b64d4e-6202-4da3-b6c6-636d0b5e27ed"; // Evi 2
const days4 = () => [0, 1, 2, 3].map((i) => ({ dia: "Día " + (i + 1), exercises: [{ id: "sq" }] }));

// ---- cliente supabase-js falso (solo lo que usan los modulos) ----
function makeClient(initialRows, opts) {
  const o = opts || {};
  const db = JSON.parse(JSON.stringify(initialRows));
  const calls = { selects: 0, updates: [] };
  const client = {
    from(table) {
      assert.equal(table, "rutinas");
      return {
        select() {
          return { eq: async (col, id) => {
            calls.selects++;
            if (o.readError) return { data: null, error: { message: "read boom" } };
            const row = db[id];
            return { data: row ? [JSON.parse(JSON.stringify(row))] : [], error: null };
          } };
        },
        update(patch) {
          return { eq(col, id) {
            return { select: async () => {
              calls.updates.push({ id, patch: JSON.parse(JSON.stringify(patch)) });
              if (o.updateError) return { data: null, error: { message: "update boom" } };
              if (o.update0) return { data: [], error: null };
              if (!db[id]) return { data: [], error: null };
              Object.assign(db[id], JSON.parse(JSON.stringify(patch)));
              return { data: [JSON.parse(JSON.stringify(db[id]))], error: null };
            } };
          } };
        },
      };
    },
  };
  return { client, db, calls };
}
const ses = (dia, semana, extra) => Object.assign({ id: "s" + dia + "-" + semana + "-" + Math.random().toString(36).slice(2, 6), alumno_id: EVI, rutina_id: EVI3, rutina_nombre: "Evi 3", semana, dia_idx: dia, fecha: "1/9/2026", created_at: "2026-09-01T00:00:00Z" }, extra || {});
const pager = (rows, calls) => async ({ rutinaId, alumnoId, from, to }) => {
  if (calls) calls.push({ rutinaId, alumnoId, from, to });
  return rows.filter((s) => String(s.rutina_id) === String(rutinaId) && (!alumnoId || String(s.alumno_id) === String(alumnoId))).slice(from, to + 1);
};
const eviRows = (datos) => ({ [EVI3]: { id: EVI3, alumno_id: EVI, es_plantilla: false, entrenador_id: "entrenador_principal", datos } });
// Fixture Evi (solo fixture): D1..D4 en semana 1 + D1 del 29/9 etiquetada semana 1; semana_activa ausente
const EVI_SESIONES = [ses(0, 1, { fecha: "1/9/2026" }), ses(1, 1, { fecha: "3/9/2026" }), ses(2, 1, { fecha: "7/9/2026" }), ses(3, 1, { fecha: "9/9/2026" }), ses(0, 1, { fecha: "29/9/2026" })];

// =========================================================================================================================
// 3. Inicializacion explicita
// =========================================================================================================================
await test("1. rutina nueva => datos.semana_activa = 1 (assignRut / buildRutinaInsertBody)", () => {
  const body = buildRutinaInsertBody({ alumno: { id: EVI, nombre: "Evi" }, rutina: { nombre: "Evi 3", days: days4(), note: "" }, alumnoId: EVI, entrenadorId: "uuid-entrenador" });
  assert.equal(body.datos.semana_activa, 1);
  assert.equal(readSemanaActiva(body.datos), 1);
});
await test("1b. createRutina (RutinaView / RoutineCard / App): withInitialSemanaActiva da 1 a toda rutina asignada, no a plantillas, y respeta un valor valido", () => {
  const rutinaViewCreate = cleanRutinaWriteBody({ nombre: "Evi 3", alumno_id: EVI, datos: { days: days4(), alumno: "Evi", note: "" }, entrenador_id: "entrenador_principal" });
  assert.equal(withInitialSemanaActiva(rutinaViewCreate).datos.semana_activa, 1);
  const template = cleanRutinaWriteBody({ nombre: "Plantilla", alumno_id: null, es_plantilla: true, datos: { days: days4() }, entrenador_id: "entrenador_principal" });
  assert.equal("semana_activa" in withInitialSemanaActiva(template).datos, false);
  const already = cleanRutinaWriteBody({ nombre: "X", alumno_id: EVI, datos: { days: days4(), semana_activa: 3 }, entrenador_id: "e" });
  assert.equal(withInitialSemanaActiva(already).datos.semana_activa, 3);
  [0, 5, "x", null, -1].forEach((bad) => {
    const b = cleanRutinaWriteBody({ nombre: "X", alumno_id: EVI, datos: { days: [], semana_activa: bad }, entrenador_id: "e" });
    assert.equal(withInitialSemanaActiva(b).datos.semana_activa, 1, "invalido " + bad);
  });
  const inp = { alumno_id: EVI, datos: { days: [] } };
  withInitialSemanaActiva(inp);
  assert.equal("semana_activa" in inp.datos, false, "no muta la entrada");
});
await test("1c. asignar una fila EXISTENTE a un alumno (UPDATE de RoutineCard) tambien arranca en 1 si no tenia semana", async () => {
  const { client, db } = makeClient({ r1: { id: "r1", datos: { days: days4() } } });
  const body = cleanRutinaWriteBody({ nombre: "R", alumno_id: EVI, datos: { days: days4(), alumno: "Evi", note: "" }, entrenador_id: "entrenador_principal" });
  await updateRutinaPreservingOperational(client, "r1", body);
  assert.equal(db.r1.datos.semana_activa, 1);
  const tpl = makeClient({ t1: { id: "t1", datos: { days: days4() } } });
  await updateRutinaPreservingOperational(tpl.client, "t1", cleanRutinaWriteBody({ nombre: "T", alumno_id: null, es_plantilla: true, datos: { days: days4() }, entrenador_id: "e" }));
  assert.equal("semana_activa" in tpl.db.t1.datos, false, "una plantilla no recibe semana_activa");
});
await test("1d. ningun flujo de creacion/asignacion queda sin semana_activa (auditoria de fuentes)", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const app = readFileSync(path.join(root, "App.jsx"), "utf8");
  assert.match(app, /createRutina:\s*async \(data\) => \{\s*[^\n]*\n\s*const body = withInitialSemanaActiva\(cleanRutinaWriteBody\(data\)\)/, "sb.createRutina inicializa");
  const inserts = app.match(/\.from\("rutinas"\)\s*\.?insert\(|from\("rutinas"\)\.insert\(/g) || [];
  assert.ok(inserts.length >= 2, "inserts directos conocidos");
  const legacy = app.slice(app.indexOf("note: c.rutinaLocal.datos?.note"), app.indexOf("note: c.rutinaLocal.datos?.note") + 120);
  assert.match(legacy, /semana_activa:\s*1/, "insert legacy de assignRut con semana_activa: 1");
  const routineStore = readFileSync(path.join(root, "lib/routineStore.js"), "utf8");
  assert.match(routineStore, /semana_activa:\s*1/);
  // los unicos escritores de rutinas pasan por sb.createRutina / sb.updateRutina; ninguno de los componentes toca la tabla directo
  ["components/RutinaView.jsx", "components/routines/RoutineCard.jsx"].forEach((f) => {
    const src = readFileSync(path.join(root, f), "utf8");
    assert.ok(!/from\(["']rutinas["']\)/.test(src), f + " no escribe rutinas directo");
  });
  assert.match(app, /updateRutina:\s*async \(id, data, options\)[\s\S]*?updateRutinaPreservingOperational\(supabase, id, body, options\)/);
  assert.equal((app.match(/writeOperationalState:\s*true/g) || []).length, 2, "solo los 2 reinicios explicitos del entrenador escriben estado operativo");
});

// =========================================================================================================================
// 1. Reconciliacion
// =========================================================================================================================
await test("2. D1+D2+D3+D4 de semana 1 finalizados => semana_activa = 2 (flujo real de finalizacion, avance monotono)", async () => {
  const { client, db } = makeClient(eviRows({ days: days4() })); // rutina nueva SIN semana (como una historica)
  const sesiones = [];
  const sb = {
    getSesiones: async () => sesiones.slice().reverse(),
    addSesion: async (p) => { const row = Object.assign({ id: "n" + sesiones.length, created_at: "x" }, p); sesiones.push(row); return [row]; },
    getSesionesByAlumnoRutinaSemana: async (a, r, n, w) => sesiones.filter((s) => s.rutina_id === r && Number(s.semana) === Number(w)),
  };
  const fechas = ["1/9/2026", "3/9/2026", "7/9/2026", "9/9/2026"];
  const advance = [];
  for (let i = 0; i < 4; i++) {
    const week = readSemanaActiva(db[EVI3].datos); const effectiveWeek = week ? week - 1 : 0;
    const payload = removeUndefinedPayloadFields(buildSessionPayload({ alumnoId: EVI, session: { rId: EVI3, dIdx: i }, activeDay: days4()[i], activeRoutine: { id: EVI3, name: "Evi 3" }, exercises: [{ id: "sq" }], weekToSave: effectiveWeek + 1, date: fechas[i], time: "10:00", includeRoutineId: true }));
    const res = await finalizeStudentSession({ sb, alumnoId: EVI, payload, date: fechas[i], dayIndex: i, weekToSave: effectiveWeek + 1, isOnline: true, effectiveWeek, totalDays: 4, lastAdvanceDate: null, todayStr: "d" + i, rutinaId: EVI3, rutinaNombre: "Evi 3", updateRutinaWeek: () => updateRutinaSemanaActiva(client, EVI3, effectiveWeek + 2) });
    advance.push(res.week.advance);
  }
  assert.deepEqual(advance, ["not_needed", "not_needed", "not_needed", "ok"]);
  assert.equal(db[EVI3].datos.semana_activa, 2);
});
await test("3. rutina historica con semana_activa=null + semana 1 completa => reconcilia a 2 (fixture Evi: D1-D4 sem 1 + D1 29/9 sem 1)", async () => {
  const { client, db, calls } = makeClient(eviRows({ days: days4() }));
  const r = await reconcileSemanaActiva({ client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(EVI_SESIONES) });
  assert.deepEqual(r, { status: "advanced", from: null, to: 2 });
  assert.equal(db[EVI3].datos.semana_activa, 2);
  assert.equal(calls.updates.length, 1);
  assert.deepEqual(calls.updates[0].patch.datos.days, days4(), "conserva days");
  // el derivador puro propone lo mismo sin tocar nada
  const d = deriveSemanaActivaTarget({ datos: { days: days4() }, sesiones: EVI_SESIONES, rutinaId: EVI3, alumnoId: EVI });
  assert.deepEqual([d.target, d.completeWeek, d.persisted], [2, 1, null]);
});
await test("4. semana_activa=1 + semana 1 completa => 2", async () => {
  const { client, db } = makeClient(eviRows({ days: days4(), semana_activa: 1 }));
  const r = await reconcileSemanaActiva({ client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(EVI_SESIONES.slice(0, 4)) });
  assert.equal(r.status, "advanced");
  assert.equal(db[EVI3].datos.semana_activa, 2);
});
await test("5. semana_activa=2 NO retrocede aunque haya sesiones antiguas de semana 1 (y avanza solo si la semana 2 esta completa)", async () => {
  const { client, db, calls } = makeClient(eviRows({ days: days4(), semana_activa: 2 }));
  const r = await reconcileSemanaActiva({ client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(EVI_SESIONES) });
  assert.deepEqual(r, { status: "noop", reason: "ya_avanzada" });
  assert.equal(db[EVI3].datos.semana_activa, 2);
  assert.equal(calls.updates.length, 0);
  const w2 = EVI_SESIONES.concat([0, 1, 2, 3].map((d) => ses(d, 2)));
  const r2 = await reconcileSemanaActiva({ client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(w2) });
  assert.equal(r2.status, "advanced");
  assert.equal(db[EVI3].datos.semana_activa, 3);
});
await test("5b. updateRutinaSemanaActiva es monotona: si la DB ya esta mas adelante (copia vieja del cliente) no escribe ni retrocede", async () => {
  const { client, db, calls } = makeClient(eviRows({ days: days4(), semana_activa: 3 }));
  const res = await updateRutinaSemanaActiva(client, EVI3, 2);
  assert.ok(Array.isArray(res) && res.length === 1, "confirma sin escribir");
  assert.equal(calls.updates.length, 0);
  assert.equal(db[EVI3].datos.semana_activa, 3);
});
await test("6. semana incompleta (3 de 4 dias) NO avanza; dias duplicados no inflan; dia_idx fuera de rango/vacio no cuenta", async () => {
  const { client, db, calls } = makeClient(eviRows({ days: days4() }));
  const threeDays = [ses(0, 1), ses(1, 1), ses(2, 1), ses(2, 1), ses(0, 1), ses(9, 1), ses(-1, 1), ses(null, 1), ses("", 1), ses(1.5, 1)];
  const r = await reconcileSemanaActiva({ client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(threeDays) });
  assert.deepEqual(r, { status: "noop", reason: "semana_incompleta" });
  assert.equal(calls.updates.length, 0);
  assert.equal(readSemanaActiva(db[EVI3].datos), null);
});
await test("7. lectura de sesiones fallida/incompleta => NO escribe (excepcion, no-array, pagina 2 rota, tope de paginas)", async () => {
  const fixtures = {
    throws: async () => { throw new Error("red"); },
    null_: async () => null,
    objeto: async () => ({ message: "x" }),
  };
  for (const [name, fn] of Object.entries(fixtures)) {
    const { client, calls } = makeClient(eviRows({ days: days4() }));
    const r = await reconcileSemanaActiva({ client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: fn });
    assert.equal(r.status, "incomplete", name);
    assert.equal(calls.updates.length, 0, name);
  }
  // pagina 1 llena (1000) y pagina 2 rota: aunque la pagina 1 ya tuviera la semana completa, no se escribe
  const full = Array.from({ length: SESSIONS_PAGE_SIZE }, (_, i) => ses(i % 4, 1));
  let n = 0;
  const flaky = async () => { n++; if (n === 1) return full; throw new Error("boom"); };
  const a = makeClient(eviRows({ days: days4() }));
  assert.equal((await reconcileSemanaActiva({ client: a.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: flaky })).status, "incomplete");
  assert.equal(a.calls.updates.length, 0);
  // tope de paginas sin pagina corta
  const b = makeClient(eviRows({ days: days4() }));
  let pages = 0;
  const endless = async () => { pages++; return full; };
  assert.equal((await reconcileSemanaActiva({ client: b.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: endless })).status, "incomplete");
  assert.equal(pages, SESSIONS_MAX_PAGES);
  assert.equal(b.calls.updates.length, 0);
  // 2300 sesiones: 3 paginas y completo
  const many = Array.from({ length: 2300 }, (_, i) => ses(i % 4, 1));
  const c = await fetchAllSesionesDeRutina(pager(many), EVI3, EVI);
  assert.deepEqual([c.complete, c.rows.length], [true, 2300]);
});
await test("7b. rutina ilegible / sin fila / plantilla / escritura fallida: no escribe o informa failed", async () => {
  const fx = pager(EVI_SESIONES);
  const re = makeClient(eviRows({ days: days4() }), { readError: true });
  assert.equal((await reconcileSemanaActiva({ client: re.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: fx })).status, "failed");
  assert.equal(re.calls.updates.length, 0);
  assert.equal((await reconcileSemanaActiva({ client: makeClient({}).client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: fx })).reason, "rutina_inexistente");
  const tpl = makeClient({ [EVI3]: { id: EVI3, es_plantilla: true, datos: { days: days4() } } });
  assert.equal((await reconcileSemanaActiva({ client: tpl.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: fx })).reason, "plantilla");
  for (const opt of [{ update0: true }, { updateError: true }]) {
    const w = makeClient(eviRows({ days: days4() }), opt);
    assert.equal((await reconcileSemanaActiva({ client: w.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: fx })).status, "failed", JSON.stringify(opt));
    assert.equal(readSemanaActiva(w.db[EVI3].datos), null);
  }
  assert.equal((await reconcileSemanaActiva({ client: null, rutinaId: EVI3 })).status, "invalid");
  assert.equal((await reconcileSemanaActiva({ client: makeClient({}).client, rutinaId: "" })).status, "invalid");
});
await test("11. doble ejecucion de la reconciliacion es idempotente (una sola escritura)", async () => {
  const { client, db, calls } = makeClient(eviRows({ days: days4() }));
  const args = { client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(EVI_SESIONES) };
  const first = await reconcileSemanaActiva(args);
  const second = await reconcileSemanaActiva(args);
  const third = await reconcileSemanaActiva(args);
  assert.equal(first.status, "advanced");
  assert.deepEqual([second.status, third.status], ["noop", "noop"]);
  assert.equal(calls.updates.length, 1);
  assert.equal(db[EVI3].datos.semana_activa, 2);
});
await test("12. semana 4 NO avanza a 5 (solo semanas 1..3 avanzan automaticamente)", async () => {
  const w4 = [0, 1, 2, 3].map((d) => ses(d, 4));
  const a = makeClient(eviRows({ days: days4(), semana_activa: 4 }));
  assert.equal((await reconcileSemanaActiva({ client: a.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(w4) })).status, "noop");
  assert.equal(a.db[EVI3].datos.semana_activa, 4);
  const b = makeClient(eviRows({ days: days4() })); // sin semana y solo semana 4 completa: no se infiere nada
  assert.equal((await reconcileSemanaActiva({ client: b.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(w4) })).status, "noop");
  assert.equal(b.calls.updates.length, 0);
  const c = makeClient(eviRows({ days: days4(), semana_activa: 3 })); // 3 -> 4 si, y de ahi no pasa
  const w3 = [0, 1, 2, 3].map((d) => ses(d, 3));
  assert.equal((await reconcileSemanaActiva({ client: c.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(w3) })).status, "advanced");
  assert.equal(c.db[EVI3].datos.semana_activa, 4);
  assert.equal((await reconcileSemanaActiva({ client: c.client, rutinaId: EVI3, alumnoId: EVI, fetchSesionesPage: pager(w3.concat(w4)) })).status, "noop");
  assert.equal(c.db[EVI3].datos.semana_activa, 4);
  assert.equal(updateRutinaSemanaActiva(c.client, EVI3, 5) instanceof Promise, true);
  assert.equal(await updateRutinaSemanaActiva(c.client, EVI3, 5), null, "5 es invalido");
});
await test("13. solo cuentan sesiones de ESA rutina_id: otra rutina, rutina_id NULL (aunque coincida el nombre), otro alumno y pendientes se ignoran", () => {
  const datos = { days: days4() };
  const other = [0, 1, 2, 3].map((d) => ses(d, 1, { rutina_id: OTHER, rutina_nombre: "Evi 2" }));
  const nullId = [0, 1, 2, 3].map((d) => ses(d, 1, { rutina_id: null, rutina_nombre: "Evi 3" }));
  const otroAlumno = [0, 1, 2, 3].map((d) => ses(d, 1, { alumno_id: "otro" }));
  const pendientes = [0, 1, 2, 3].map((d) => ses(d, 1, { estado: "pendiente" }));
  [other, nullId, otroAlumno, pendientes, other.concat(nullId, otroAlumno, pendientes)].forEach((rows, i) => {
    assert.equal(deriveSemanaActivaTarget({ datos, sesiones: rows, rutinaId: EVI3, alumnoId: EVI }).target, null, "caso " + i);
  });
  // semana como texto y dia_idx como texto
  assert.equal(deriveSemanaActivaTarget({ datos, sesiones: [0, 1, 2, 3].map((d) => ses(String(d), "1")), rutinaId: EVI3, alumnoId: EVI }).target, 2);
  // rutina sin dias => nada
  assert.equal(deriveSemanaActivaTarget({ datos: { days: [] }, sesiones: EVI_SESIONES, rutinaId: EVI3 }).target, null);
});
await test("13b. la cantidad de dias sale de la rutina FRESCA: una rutina de 2 dias se completa con 2 dias; una de 5 no con 4", () => {
  const two = deriveSemanaActivaTarget({ datos: { days: days4().slice(0, 2) }, sesiones: [ses(0, 1), ses(1, 1)], rutinaId: EVI3 });
  assert.equal(two.target, 2);
  const five = deriveSemanaActivaTarget({ datos: { days: days4().concat([{}]) }, sesiones: EVI_SESIONES.slice(0, 4), rutinaId: EVI3 });
  assert.equal(five.target, null);
});
await test("13c. la reconciliacion no usa progreso, created_at ni localStorage: su firma solo recibe sesiones por rutina_id", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const src = readFileSync(path.join(root, "lib/reconcileSemanaActiva.js"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  assert.ok(!/localStorage/.test(code));
  assert.ok(!/progreso/.test(code));
  assert.ok(!/rutina_nombre/.test(code));
});

// =========================================================================================================================
// 2. El entrenador no borra estado operativo
// =========================================================================================================================
const OP = { semana_activa: 2, semana_reiniciada: 2, semana_reiniciada_at: "2026-09-20T12:00:00.000Z" };
const freshRow = (extra) => ({ [EVI3]: { id: EVI3, alumno_id: EVI, es_plantilla: false, datos: Object.assign({ days: days4(), alumno: { id: EVI }, note: "" }, OP, extra || {}) } });
await test("8. guardar/editar rutina desde el entrenador (RutinaView, RoutineCard, reorden, edicion de ejercicio) conserva semana_activa", async () => {
  const editedDays = days4().map((d, i) => (i === 0 ? { ...d, exercises: [{ id: "sq" }, { id: "lp" }] } : d));
  const payloads = {
    rutinaView: { nombre: "Evi 3", alumno_id: EVI, datos: { days: editedDays, alumno: "Evi", note: "n" }, entrenador_id: "entrenador_principal", es_plantilla: false },
    routineCardReorder: { nombre: "Evi 3", alumno_id: EVI, datos: { days: editedDays, alumno: "Evi", note: "" }, entrenador_id: "entrenador_principal" },
    appEditEjercicio: { nombre: "Evi 3", alumno_id: EVI, datos: { days: editedDays, alumno: "", note: "" }, entrenador_id: undefined, es_plantilla: false },
    appAddBatch: { nombre: "Evi 3", alumno_id: EVI, datos: { days: editedDays }, entrenador_id: "e" },
  };
  for (const [name, p] of Object.entries(payloads)) {
    const { client, db, calls } = makeClient(freshRow());
    const res = await updateRutinaPreservingOperational(client, EVI3, cleanRutinaWriteBody(p));
    assert.ok(Array.isArray(res) && res.length === 1, name);
    assert.equal(db[EVI3].datos.semana_activa, 2, name);
    assert.deepEqual(db[EVI3].datos.days, editedDays, name + ": los cambios del entrenador SI se guardan");
    assert.equal(calls.updates.length, 1);
  }
});
await test("9. conserva tambien semana_reiniciada y semana_reiniciada_at", async () => {
  const { client, db } = makeClient(freshRow());
  await updateRutinaPreservingOperational(client, EVI3, cleanRutinaWriteBody({ nombre: "Evi 3", alumno_id: EVI, datos: { days: days4(), alumno: "Evi", note: "" }, entrenador_id: "e" }));
  OPERATIONAL_DATOS_KEYS.forEach((k) => assert.equal(db[EVI3].datos[k], OP[k], k));
});
await test("10. una copia local vieja de datos no puede pisar una semana_activa mas nueva", async () => {
  const stale = { days: days4(), alumno: { id: EVI }, note: "", semana_activa: 1, semana_reiniciada: 1, semana_reiniciada_at: "2026-08-01T00:00:00.000Z" };
  const { client, db } = makeClient(freshRow({ semana_activa: 3 }));
  // App.jsx:4198/4391: datos:{...rSB.datos, days} con rSB viejo
  await updateRutinaPreservingOperational(client, EVI3, cleanRutinaWriteBody({ nombre: "Evi 3", alumno_id: EVI, datos: { ...stale, days: days4().reverse() }, entrenador_id: "e" }));
  assert.equal(db[EVI3].datos.semana_activa, 3, "gana la DB, no la copia vieja");
  assert.equal(db[EVI3].datos.semana_reiniciada, 2);
  assert.equal(db[EVI3].datos.semana_reiniciada_at, OP.semana_reiniciada_at);
  // y una copia "adelantada" que la DB no tiene tampoco se persiste (no se escribe estado no verificado)
  const ahead = makeClient({ [EVI3]: { id: EVI3, alumno_id: EVI, es_plantilla: false, datos: { days: days4() } } });
  await updateRutinaPreservingOperational(ahead.client, EVI3, cleanRutinaWriteBody({ nombre: "Evi 3", alumno_id: EVI, datos: { days: days4(), semana_activa: 4 }, entrenador_id: "e" }));
  assert.equal(ahead.db[EVI3].datos.semana_activa, 1, "se inicializa en 1; el 4 local no se persiste");
});
await test("10b. mergeOperationalDatos: pura, fresh gana, claves ausentes en fresh no se inventan", () => {
  const fresh = Object.freeze({ days: [1], semana_activa: 3 });
  const inc = Object.freeze({ days: [9], note: "x", semana_activa: 1, semana_reiniciada: 1 });
  const out = mergeOperationalDatos(fresh, inc);
  assert.deepEqual(out, { days: [9], note: "x", semana_activa: 3 });
  assert.deepEqual(mergeOperationalDatos(null, { days: [] }), { days: [] });
  assert.deepEqual(mergeOperationalDatos({ semana_activa: 2 }, null), { semana_activa: 2 });
});
await test("10c. si no se puede leer el estado fresco NO se escribe (nunca se pisa con una copia local)", async () => {
  const { client, db, calls } = makeClient(freshRow(), { readError: true });
  const res = await updateRutinaPreservingOperational(client, EVI3, cleanRutinaWriteBody({ nombre: "Evi 3", alumno_id: EVI, datos: { days: [], semana_activa: 1 }, entrenador_id: "e" }));
  assert.equal(res, null);
  assert.equal(calls.updates.length, 0);
  assert.equal(db[EVI3].datos.semana_activa, 2);
  // fila inexistente: mismo contrato que antes (UPDATE devuelve [])
  const none = makeClient({});
  assert.deepEqual(await updateRutinaPreservingOperational(none.client, "nada", cleanRutinaWriteBody({ nombre: "x", alumno_id: EVI, datos: {}, entrenador_id: "e" })), []);
});
await test("10d. los reinicios EXPLICITOS del entrenador si escriben estado operativo (writeOperationalState)", async () => {
  // reiniciar semana 2 (App.jsx:2299)
  const a = makeClient(freshRow({ semana_activa: 4 }));
  await updateRutinaPreservingOperational(a.client, EVI3, cleanRutinaWriteBody({ nombre: "Evi 3", alumno_id: EVI, entrenador_id: "e", datos: { days: days4(), semana_activa: 2, semana_reiniciada: 2, semana_reiniciada_at: "2026-10-06T00:00:00.000Z" } }), { writeOperationalState: true });
  assert.deepEqual([a.db[EVI3].datos.semana_activa, a.db[EVI3].datos.semana_reiniciada, a.db[EVI3].datos.semana_reiniciada_at], [2, 2, "2026-10-06T00:00:00.000Z"]);
  // reinicio total (App.jsx:2519): semana_activa 4 y se eliminan semana_reiniciada*
  const b = makeClient(freshRow());
  await updateRutinaPreservingOperational(b.client, EVI3, cleanRutinaWriteBody({ nombre: "Evi 3", alumno_id: EVI, entrenador_id: "e", datos: { days: days4(), semana_activa: 4 } }), { writeOperationalState: true });
  assert.equal(b.db[EVI3].datos.semana_activa, 4);
  assert.equal("semana_reiniciada" in b.db[EVI3].datos, false);
  assert.equal(b.calls.selects, 0, "no lee ni fusiona: el entrenador decide");
});
await test("14. el fix de updateRutina no cambia el contrato de retorno de sb.updateRutina (array / [] / null)", async () => {
  const ok = makeClient(freshRow());
  assert.equal((await updateRutinaPreservingOperational(ok.client, EVI3, cleanRutinaWriteBody({ nombre: "n", alumno_id: EVI, datos: {}, entrenador_id: "e" }))).length, 1);
  const bad = makeClient(freshRow(), { updateError: true });
  assert.equal(await updateRutinaPreservingOperational(bad.client, EVI3, cleanRutinaWriteBody({ nombre: "n", alumno_id: EVI, datos: {}, entrenador_id: "e" })), null);
});

console.log(count + " tests OK");
