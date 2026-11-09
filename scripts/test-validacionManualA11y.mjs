// H4 + H5 (auditoria P1 del entrenador): contraste y mensaje de fecha en la validacion manual de sesiones. Sin red ni Supabase.
//   node scripts/test-validacionManualA11y.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { fechaFueraDeRango, fechaLimites } from "../components/students/fechaValidacion.js";

let fails = 0;
const test = async (n, f) => { try { await f(); console.log("ok  - " + n); } catch (e) { fails++; console.error("FAIL - " + n + "\n  " + e.message); } };
const rd = (p) => fs.readFileSync(new URL("../" + p, import.meta.url), "utf8");

const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Fondos reales: modal (BaseModal) claro/oscuro y superficie de la fila en modo claro (coachAluSurface: blanco o #f8fafc).
const MODAL = { claro: "#ffffff", oscuro: "#0d1424" };

const modal = rd("components/students/ManualSessionValidationModal.jsx");
const orphan = rd("components/students/StudentOrphanSession.jsx");

await test("H4: «Confirmar» (modal y sesion huerfana): blanco sobre verde >= 4.5:1 y ya no #22c55e", () => {
  for (const src of [modal, orphan]) {
    assert.doesNotMatch(src, /background: "#22c55e", color: "#fff"/);
    const m = src.match(/background: "(#[0-9a-f]{6})", color: "#fff"/);
    assert.ok(m, "boton verde con texto blanco");
    assert.ok(cr("#ffffff", m[1]) >= 4.5, "contraste " + cr("#ffffff", m[1]).toFixed(2));
  }
  assert.ok(cr("#ffffff", "#22c55e") < 3, "linea base: 2,28:1");
});

await test("H4: «Pendiente» y «Completado» >= 4.5:1 en tema claro y oscuro", () => {
  const sup = { claro: ["#ffffff", "#f8fafc"], oscuro: ["#0d1424", "#12121a"] };
  const col = { pend: { claro: "#b45309", oscuro: "#f59e0b" }, done: { claro: "#15803d", oscuro: "#22c55e" } };
  for (const t of ["claro", "oscuro"]) for (const k of ["pend", "done"]) for (const bg of sup[t]) {
    assert.ok(cr(col[k][t], bg) >= 4.5, k + " " + t + " sobre " + bg + ": " + cr(col[k][t], bg).toFixed(2));
  }
  assert.ok(cr("#f59e0b", "#ffffff") < 3, "linea base: 2,15:1");
  assert.match(modal, /const pendingColor = dm \? "#f59e0b" : "#b45309"/);
  assert.match(modal, /const doneColor = dm \? "#22c55e" : "#15803d"/);
  assert.match(modal, /color: done \? doneColor : pendingColor/);
  assert.match(rd("components/students/StudentsSection.jsx"), /darkMode=\{darkMode\}\s*\/>/, "el modal recibe el tema");
});

await test("H4: el texto de estado sigue siendo texto («Pendiente»/«✓ Completado»), no solo color", () => {
  assert.match(modal, /msg\("Pendiente", "Pending"\)/);
  assert.match(modal, /msg\("✓ Completado", "✓ Completed"\)/);
});

await test("H4: areas tactiles >= 44 px y estados disabled/loading conservados", () => {
  assert.match(modal, /const btn = \{[^}]*minHeight: 44/);
  assert.match(orphan, /const btn = \{[^}]*minHeight: 44/);
  assert.match(modal, /disabled=\{busy \|\| !fechaIso \|\| fechaIso < limites\.min \|\| fechaIso > limites\.max\}/, "regla de «Confirmar» intacta");
  assert.match(modal, /opacity: busy \|\| !fechaIso \|\| fechaError \? 0\.6 : 1/, "deshabilitado se ve deshabilitado");
  assert.match(orphan, /disabled=\{busy \|\| diaSel === ""\}/);
  assert.match(orphan, /opacity: busy \|\| diaSel === "" \? 0\.6 : 1/);
  assert.match(modal, /msg\("Validando…", "Validating…"\)/);
});

await test("H4: texto del error de fecha >= 4.5:1 en ambos temas", () => {
  assert.ok(cr("#b91c1c", MODAL.claro) >= 4.5);
  assert.ok(cr("#f87171", MODAL.oscuro) >= 4.5);
  assert.match(modal, /dm \? "#f87171" : "#b91c1c"/);
});

const lim = { min: "2026-09-03", max: "2026-11-02" };
await test("H5: fecha anterior al minimo / posterior al maximo / valida / sin seleccion", () => {
  assert.equal(fechaFueraDeRango("2026-09-02", lim), "antes");
  assert.equal(fechaFueraDeRango("2000-01-01", lim), "antes");
  assert.equal(fechaFueraDeRango("2026-11-03", lim), "despues");
  assert.equal(fechaFueraDeRango("2026-09-03", lim), null, "el minimo es valido");
  assert.equal(fechaFueraDeRango("2026-11-02", lim), null, "el maximo es valido");
  assert.equal(fechaFueraDeRango("2026-10-10", lim), null);
  assert.equal(fechaFueraDeRango("", lim), null, "sin seleccion no hay error prematuro");
});

await test("H5: misma regla que deshabilita «Confirmar» (invalida <=> deshabilitado, salvo vacia)", () => {
  const disabled = (iso) => !iso || iso < lim.min || iso > lim.max;
  for (const iso of ["2026-09-02", "2026-09-03", "2026-10-10", "2026-11-02", "2026-11-03"]) assert.equal(!!fechaFueraDeRango(iso, lim), disabled(iso), iso);
});

await test("H5: mensaje accesible asociado al campo, con limites; se oculta si la fecha es valida", () => {
  assert.match(modal, /const fechaError = fechaFueraDeRango\(fechaIso, limites\)/);
  assert.match(modal, /aria-describedby=\{fechaError \? "msv-fecha-error" : undefined\}/);
  assert.match(modal, /aria-invalid=\{fechaError \? "true" : undefined\}/);
  assert.match(modal, /\{fechaError && \(\s*<div id="msv-fecha-error" role="alert"/);
  assert.match(modal, /anterior al mínimo permitido/);
  assert.match(modal, /posterior al máximo permitido/);
  assert.match(modal, /isoToFechaAR\(limites\.min\)/);
  assert.match(modal, /isoToFechaAR\(limites\.max\)/);
  assert.match(modal, /<span aria-hidden="true">⚠ <\/span>/, "no depende solo del color");
});

await test("H5: limites y logica de validacion/guardado sin cambios", () => {
  assert.deepEqual(fechaLimites("2026-10-20T12:00:00Z", new Date("2026-11-02T15:00:00Z")), { min: "2026-10-20", max: "2026-11-02" });
  assert.deepEqual(fechaLimites(null, new Date("2026-11-02T15:00:00Z")), { min: "2026-09-03", max: "2026-11-02" });
  assert.match(modal, /min=\{limites\.min\}/);
  assert.match(modal, /max=\{limites\.max\}/);
  assert.match(modal, /validateManualSession\(\{[^}]*fecha: isoToFechaAR\(fechaIso\)/);
  assert.match(modal, /advanceWeekAfterValidation\(/);
});

await test("Tema: el modal usa el tema de la app (causa raiz: BaseModal leia solo localStorage/sistema)", () => {
  const base = rd("components/modals/BaseModal.jsx");
  assert.match(base, /darkMode,\n\}\) \{/, "BaseModal acepta darkMode");
  assert.match(base, /if \(typeof darkMode === 'boolean'\) prefersDark = darkMode;/);
  assert.match(base, /localStorage\.getItem\('it_dark'\)/, "sin la prop, se conserva la deteccion de siempre para los demas modales");
  assert.match(modal, /<BaseModal [^>]*darkMode=\{dm\}>/);
  assert.match(orphan, /<BaseModal [^>]*darkMode=\{darkMode !== false\}>/);
  assert.match(rd("components/students/StudentsSection.jsx"), /<StudentOrphanSession[\s\S]*?darkMode=\{darkMode\}\s*\/>/);
  assert.match(modal, /colorScheme: dm \? "dark" : "light"/, "icono nativo del calendario acorde al tema");
});

if (fails) { console.error(fails + " fallo(s)"); process.exit(1); }
console.log("VALIDACION MANUAL A11Y (H4+H5): todo OK");
