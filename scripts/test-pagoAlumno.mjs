// H6: «Marcar pagado» con confirmacion previa. Contrato de guardado y estructura (la interaccion real se prueba en scripts/qa/pago-alumno.mjs).
//   node scripts/test-pagoAlumno.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { pagoGuardado, registrarPagoAlumno, nombreAlumno } from "../components/students/pagoAlumno.js";

let fails = 0;
const test = async (n, f) => { try { await f(); console.log("ok  - " + n); } catch (e) { fails++; console.error("FAIL - " + n + "\n  " + e.message); } };
const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");
const origError = console.error; console.error = () => {};

await test("pagoGuardado: solo un arreglo NO vacio confirma el guardado", () => {
  assert.equal(pagoGuardado([{ id: "a" }]), true);
  assert.equal(pagoGuardado([{}]), true);
  assert.equal(pagoGuardado([]), false, "[] = ninguna fila actualizada (p. ej. RLS): el pago no quedo");
  assert.equal(pagoGuardado(null), false, "null = error HTTP de sbFetch");
  assert.equal(pagoGuardado(undefined), false);
  assert.equal(pagoGuardado({}), false);
  assert.equal(pagoGuardado("ok"), false);
});

await test("registrarPagoAlumno: exito = exactamente una escritura con el mismo campo de siempre", async () => {
  const calls = [];
  const sb = { updateAlumno: async (id, data) => { calls.push([id, data]); return [{ id }]; } };
  const r = await registrarPagoAlumno(sb, { id: "x1" }, new Date("2026-11-02T15:00:00Z"));
  assert.deepEqual(r, { ok: true, ahora: "2026-11-02T15:00:00.000Z" });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["x1", { ultimo_pago_confirmado: "2026-11-02T15:00:00.000Z" }]);
});

await test("registrarPagoAlumno: error del servidor (null), 0 filas ([]) y falla de red (lanza) NO son exito", async () => {
  assert.deepEqual(await registrarPagoAlumno({ updateAlumno: async () => null }, { id: 1 }), { ok: false, motivo: "rechazado" });
  assert.deepEqual(await registrarPagoAlumno({ updateAlumno: async () => [] }, { id: 1 }), { ok: false, motivo: "rechazado" });
  assert.deepEqual(await registrarPagoAlumno({ updateAlumno: async () => { throw new TypeError("Failed to fetch"); } }, { id: 1 }), { ok: false, motivo: "red" });
});

await test("registrarPagoAlumno: reintento tras un error escribe de nuevo y confirma", async () => {
  let n = 0;
  const sb = { updateAlumno: async (id) => (++n === 1 ? null : [{ id }]) };
  assert.equal((await registrarPagoAlumno(sb, { id: 7 })).ok, false);
  assert.equal((await registrarPagoAlumno(sb, { id: 7 })).ok, true);
  assert.equal(n, 2);
});

await test("nombreAlumno: nombre o email", () => {
  assert.equal(nombreAlumno({ nombre: "Eli", email: "e@x" }), "Eli");
  assert.equal(nombreAlumno({ email: "e@x" }), "e@x");
  assert.equal(nombreAlumno(null), "");
});

await test("StudentsSection: «Marcar pagado» abre confirmacion y NO escribe; candado sincrono; destinatario copiado", () => {
  const src = rd("components/students/StudentsSection.jsx");
  const h = src.slice(src.indexOf("onMarkPaid={"), src.indexOf("onAsignarRutina="));
  assert.doesNotMatch(h, /updateAlumno|registrarPagoAlumno|ultimo_pago_confirmado/, "el toque en el menu ya no escribe");
  assert.match(h, /setPagoDialog\(\{ id: a\.id, nombre: nombreAlumno\(a\)/);
  assert.match(src, /const pagoEnCurso = React\.useRef\(false\)/);
  assert.match(src, /if \(pagoEnCurso\.current \|\| !pagoDialog\) return;\s*pagoEnCurso\.current = true;/);
  assert.match(src, /const dest = pagoDialog;/, "el destinatario se toma del dialogo, no de la ficha activa");
  assert.match(src, /registrarPagoAlumno\(sb, \{ id: dest\.id \}/);
  assert.match(src, /String\(al\.id\) === String\(dest\.id\)/, "la lista se actualiza por id");
  const okIdx = src.indexOf("res.ahora"), errIdx = src.indexOf("if (!res.ok)");
  assert.ok(errIdx > 0 && okIdx > errIdx, "el exito solo se refleja despues de comprobar res.ok");
  assert.match(src, /toast2\(t\("Pago registrado ✓", "Payment registered ✓"\) \+ \(dest\.nombre \? " · " \+ dest\.nombre : ""\)\)/);
  assert.match(src, /if \(pagoEnCurso\.current\) return; setPagoDialog\(null\)/, "no se cierra mientras guarda");
});

await test("Dialogo: reutiliza DeleteConfirmModal (alertdialog, titulo, descripcion, Escape) y no cambia a los demas usuarios", () => {
  const dlg = rd("components/DeleteConfirmModal.jsx");
  assert.match(dlg, /role: 'alertdialog'/);
  assert.match(dlg, /'aria-labelledby': titleId/);
  assert.match(dlg, /'aria-describedby': message \? descId : undefined/);
  assert.match(dlg, /errorText = ''/);
  assert.match(dlg, /confirmStyleOverride = null/);
  assert.match(dlg, /\.\.\.\(confirmStyleOverride \|\| \{\}\)/);
  const src = rd("components/students/StudentsSection.jsx");
  assert.match(src, /cancelLabel=\{t\("Cancelar", "Cancel"\)\}/);
  assert.match(src, /confirmLabel=\{pagoDialog && pagoDialog\.error \? t\("Reintentar pago"/);
  assert.match(src, /background: "#15803d"/);
});

await test("Menu de acciones: las otras acciones siguen igual", () => {
  const m = rd("components/students/StudentActionsMenu.jsx");
  for (const h of ["onEdit", "onChat", "onMarkPaid", "onClearProgress", "onDelete"]) assert.match(m, new RegExp("onClick=\\{" + h + "\\}"), h);
  const src = rd("components/students/StudentsSection.jsx");
  assert.match(src, /setCoachDialog\(\{ t: 'editAlum', a: a \}\)/);
  assert.match(src, /setCoachDialog\(\{ t: 'clearProgress', a: a \}\)/);
  assert.match(src, /setCoachDialog\(\{ t: 'deleteAlumno', a: a \}\)/);
});

console.error = origError;
if (fails) { console.error(fails + " fallo(s)"); process.exit(1); }
console.log("PAGO ALUMNO (H6): todo OK");
