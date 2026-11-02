// D7.2 UI: fecha del entrenamiento en "Validar sesion manualmente" y rotulos de semana de rutina.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isoToFechaAR, isoDateAR, fechaLimites } from "../components/students/fechaValidacion.js";

const rd = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let fails = 0;
async function test(name, fn) {
  try { await fn(); console.log("ok - " + name); } catch (e) { fails++; console.error("FAIL - " + name + "\n" + e.message); }
}

await test("isoToFechaAR: sin ceros iniciales e invalidas -> ''", () => {
  assert.equal(isoToFechaAR("2026-10-05"), "5/10/2026");
  assert.equal(isoToFechaAR("2026-10-28"), "28/10/2026");
  assert.equal(isoToFechaAR("2026-01-01"), "1/1/2026");
  assert.equal(isoToFechaAR(""), "");
  assert.equal(isoToFechaAR("2026-02-30"), "");
  assert.equal(isoToFechaAR("5/10/2026"), "");
});

await test("fechaLimites: max hoy AR, min = asignacion pero nunca mas de 60 dias atras", () => {
  const now = new Date("2026-11-02T15:00:00Z");
  assert.equal(isoDateAR(now), "2026-11-02");
  assert.equal(isoDateAR(new Date("2026-11-02T01:00:00Z")), "2026-11-01", "hora Argentina (UTC-3)");
  assert.deepEqual(fechaLimites("2026-10-20T12:00:00Z", now), { min: "2026-10-20", max: "2026-11-02" });
  assert.deepEqual(fechaLimites("2025-01-01T12:00:00Z", now), { min: "2026-09-03", max: "2026-11-02" });
  assert.deepEqual(fechaLimites(null, now), { min: "2026-09-03", max: "2026-11-02" });
  assert.deepEqual(fechaLimites("2027-01-01T12:00:00Z", now), { min: "2026-11-02", max: "2026-11-02" });
});

await test("modal: input date con etiqueta, min/max y pasa fecha a validateManualSession", () => {
  const src = rd("components/students/ManualSessionValidationModal.jsx");
  assert.match(src, /type="date"/);
  assert.match(src, /min=\{limites\.min\}/);
  assert.match(src, /max=\{limites\.max\}/);
  assert.match(src, /htmlFor="msv-fecha"/);
  assert.match(src, /Fecha del entrenamiento/);
  assert.match(src, /minHeight: 44/);
  assert.match(src, /validateManualSession\(\{[^}]*fecha: isoToFechaAR\(fechaIso\)/);
});

await test("rotulos: semana de rutina en ficha y busqueda", () => {
  const sum = rd("components/students/StudentProgressSummary.jsx");
  assert.match(sum, /de la semana de rutina/);
  assert.match(sum, /of the routine week/);
  assert.doesNotMatch(sum, /"completado", "completed"/);
  const row = rd("components/search/GlobalSearchResultRow.jsx");
  assert.match(row, /Semana de rutina: \{row\.pctSemanal\}% · \{row\.sesionesCompletadas\} sesiones/);
  assert.doesNotMatch(row, /% semanal/);
});

if (fails) { console.error(fails + " fallo(s)"); process.exit(1); }
console.log("D7.2 UI: todo OK");
