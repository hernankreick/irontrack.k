// Pruebas de lib/updateRutinaSemanaActiva.js (T01.2, fix del avance semanal) y de su cableado.
// El UPDATE anterior reescribia la fila con entrenador_id = NULL (la rutina local del alumno no lo trae)
// y la DB (entrenador_id NOT NULL) lo rechazaba: semana_activa nunca se persistia.
//
//   node scripts/test-updateRutinaSemanaActiva.mjs
//
// Sin red: el cliente supabase-js es un doble que registra cada llamada.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { updateRutinaSemanaActiva, isValidSemanaActiva } from "../lib/updateRutinaSemanaActiva.js";
import { finalizeStudentSession } from "../lib/finalizeWorkoutSession.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const RID = "4d91bcc5-fc6f-4366-ac2e-ab2ef5e528e0";

// Doble del cliente: una "tabla" rutinas con una fila; registra selects y updates.
function makeClient(opts) {
  const o = opts || {};
  const row = Object.assign({ id: RID, entrenador_id: "coach-1", alumno_id: "alu-1", nombre: "Cata full body", es_plantilla: false,
    datos: { days: [1, 2, 3, 4], note: "n", alumno: "Cata" } }, o.row || {});
  const log = { selects: [], updates: [] };
  const client = {
    row, log,
    from(table) {
      assert.equal(table, "rutinas");
      return {
        select(cols) {
          log.selects.push(cols);
          return { eq: async (col, val) => {
            assert.equal(col, "id");
            if (o.selectError) return { data: null, error: { message: "select boom" } };
            return { data: val === row.id ? [{ datos: row.datos }] : [], error: null };
          } };
        },
        update(body) {
          log.updates.push(body);
          return { eq(col, val) {
            assert.equal(col, "id");
            return { select: async () => {
              if (o.updateError) return { data: null, error: { code: "23502", message: "null value in column" } };
              if (o.zeroRows) return { data: [], error: null };
              Object.assign(row, body); // solo las claves enviadas se modifican
              return { data: [Object.assign({}, row)], error: null };
            } };
          } };
        },
      };
    },
  };
  return client;
}

await test("B1 envia SOLO la columna datos (sin entrenador_id/alumno_id/nombre/es_plantilla)", async () => {
  const c = makeClient();
  const res = await updateRutinaSemanaActiva(c, RID, 2);
  assert.equal(c.log.updates.length, 1);
  assert.deepEqual(Object.keys(c.log.updates[0]), ["datos"]);
  for (const k of ["entrenador_id", "alumno_id", "nombre", "es_plantilla"]) assert.ok(!(k in c.log.updates[0]), k + " no se envia");
  assert.ok(Array.isArray(res) && res.length === 1);
  assert.equal(c.row.entrenador_id, "coach-1", "la fila conserva el entrenador");
});

await test("B2 preserva las otras claves de datos y cambia solo semana_activa", async () => {
  const c = makeClient({ row: { datos: { days: [1, 2, 3, 4], note: "n", alumno: "Cata", semana_reiniciada: 1, extra: { a: 1 } } } });
  await updateRutinaSemanaActiva(c, RID, 2);
  assert.deepEqual(c.log.updates[0].datos, { days: [1, 2, 3, 4], note: "n", alumno: "Cata", semana_reiniciada: 1, extra: { a: 1 }, semana_activa: 2 });
});

await test("B3 lee datos FRESCOS de la DB (no una copia local vieja)", async () => {
  const c = makeClient();
  c.row.datos = { days: ["editado por el entrenador"], note: "nuevo" }; // cambio posterior a la carga local
  await updateRutinaSemanaActiva(c, RID, 3);
  assert.equal(c.log.selects.length, 1);
  assert.deepEqual(c.log.updates[0].datos, { days: ["editado por el entrenador"], note: "nuevo", semana_activa: 3 });
});

await test("validacion: rutinaId y semana invalidos no tocan la DB", async () => {
  for (const [id, w] of [["", 2], [null, 2], [RID, 0], [RID, 5], [RID, 1.5], [RID, "2"], [RID, NaN], [RID, undefined]]) {
    const c = makeClient();
    assert.equal(await updateRutinaSemanaActiva(c, id, w), null);
    assert.equal(c.log.selects.length + c.log.updates.length, 0);
  }
  assert.equal(isValidSemanaActiva(4), true);
});

await test("C1 error del PATCH -> null; D 0 filas -> []; error de lectura -> null; fila inexistente -> []; datos no objeto -> null sin escribir", async () => {
  assert.equal(await updateRutinaSemanaActiva(makeClient({ updateError: true }), RID, 2), null);
  assert.deepEqual(await updateRutinaSemanaActiva(makeClient({ zeroRows: true }), RID, 2), []);
  const cs = makeClient({ selectError: true });
  assert.equal(await updateRutinaSemanaActiva(cs, RID, 2), null);
  assert.equal(cs.log.updates.length, 0);
  assert.deepEqual(await updateRutinaSemanaActiva(makeClient(), "otro-id", 2), []);
  const cn = makeClient({ row: { datos: null } });
  assert.equal(await updateRutinaSemanaActiva(cn, RID, 2), null);
  assert.equal(cn.log.updates.length, 0);
});

// --- Integracion con finalizeStudentSession (sb falso + cliente falso) ---
function makeSb(client, rows) {
  return {
    getSesiones: async () => rows.slice(),
    addSesion: async (p) => { const r = Object.assign({ id: "n" }, p); rows.push(r); return [r]; },
    getSesionesByAlumnoRutinaSemana: async () => rows.filter((x) => x.rutina_id === RID && x.semana === 1),
    updateRutinaSemanaActiva: (id, w) => updateRutinaSemanaActiva(client, id, w),
  };
}
function fin(sb, over) {
  return Object.assign({
    sb, alumnoId: "alu-1", payload: { alumno_id: "alu-1", rutina_id: RID, dia_idx: 3, semana: 1, fecha: "3/10/2026" },
    date: "3/10/2026", dayIndex: 3, weekToSave: 1, isOnline: true, effectiveWeek: 0, totalDays: 4, lastAdvanceDate: null,
    todayStr: "Sat Oct 03 2026", rutinaId: RID, rutinaNombre: "Cata full body", timeoutMs: 50,
    updateRutinaWeek: () => sb.updateRutinaSemanaActiva(RID, 2),
  }, over || {});
}
const three = () => [0, 1, 2].map((d) => ({ alumno_id: "alu-1", rutina_id: RID, dia_idx: d, semana: 1, fecha: "29/9/2026" }));

await test("A semana 1 completa (4 dias persistidos): advance 'ok' y datos.semana_activa = 2 sin tocar el entrenador", async () => {
  const c = makeClient();
  const out = await finalizeStudentSession(fin(makeSb(c, three())));
  assert.equal(out.status, "saved");
  assert.equal(out.week.advance, "ok");
  assert.equal(c.row.datos.semana_activa, 2);
  assert.equal(c.row.entrenador_id, "coach-1");
  assert.deepEqual(Object.keys(c.log.updates[0]), ["datos"]);
});

await test("C error del PATCH: la sesion sigue guardada, advance 'failed' (el componente no avanza ni marca local)", async () => {
  const c = makeClient({ updateError: true });
  const rows = three();
  const out = await finalizeStudentSession(fin(makeSb(c, rows)));
  assert.equal(out.status, "saved");
  assert.equal(out.week.advance, "failed");
  assert.equal(rows.length, 4, "la sesion nueva queda guardada");
  assert.ok(!("semana_activa" in c.row.datos));
});

await test("D 0 filas actualizadas: advance 'failed'", async () => {
  const out = await finalizeStudentSession(fin(makeSb(makeClient({ zeroRows: true }), three())));
  assert.equal(out.status, "saved");
  assert.equal(out.week.advance, "failed");
});

// --- Cableado estatico ---
await test("cableado: WorkoutScreen usa la operacion acotada, sincroniza la rutina local y marca el fallo en el resumen", () => {
  const ws = readFileSync(new URL("../components/WorkoutScreen.jsx", import.meta.url), "utf8");
  const start = ws.indexOf("const finalizarSesion = async");
  const fn = ws.slice(start, ws.indexOf("return (\n    <div style={{ position:\"fixed\"", start));
  const student = fn.slice(fn.indexOf("finalizeStudentSession({"), fn.indexOf("// ── Flujo previo"));
  assert.ok(student.includes("sb.updateRutinaSemanaActiva(r.id, effectiveWeek + 2)"));
  assert.ok(!student.includes("sb.updateRutina("), "el flujo del alumno ya no usa updateRutina completo");
  assert.ok(!/entrenador_id\s*:/.test(student), "no se arma entrenador_id");
  const okIdx = student.indexOf('outcome.week.advance === "ok"');
  assert.ok(student.indexOf("onWeekAdvanced(", okIdx) > okIdx, "la rutina local se sincroniza solo tras 'ok'");
  assert.ok(student.includes("weekAdvanceFailed: true"));
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(/updateRutinaSemanaActiva: \(rutinaId, nextWeek\) => updateRutinaSemanaActivaLib\(supabase/.test(app));
  assert.ok(app.includes("onWeekAdvanced={function (rutinaId, nextWeek)"));
  const sum = readFileSync(new URL("../components/workout/WorkoutSessionSummary.jsx", import.meta.url), "utf8");
  assert.ok(sum.includes("resumenSesion.weekAdvanceFailed"));
});

console.log("\n" + count + " tests OK");
