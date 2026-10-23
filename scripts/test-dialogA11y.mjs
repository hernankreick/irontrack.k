// Accesibilidad de dialogos del panel del entrenador (LOTE 1): hook compartido, BaseModal, perdida de datos, CSS global y nombres accesibles.
//
//   node scripts/test-dialogA11y.mjs
//
// node:assert, sin dependencias nuevas.  SSR con esbuild + react-dom/server para lo renderizable; regex sobre el fuente para el cableado;
// la parte DOM real (foco, Escape, Tab, retorno de foco) esta en scripts/qa/dialogs.mjs.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-dlg-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import NewRoutineModal from "./components/routines/NewRoutineModal.jsx";' +
      'import AppGlobalStyles from "./components/layout/AppGlobalStyles.jsx";' +
      'import ToastBanner from "./components/ui/ToastBanner.jsx";' +
      'import CoachEditStudentModal from "./components/coach/CoachEditStudentModal.jsx";' +
      'import { trapTab, getFocusable } from "./components/modals/useDialogA11y.js";' +
      "export { React, renderToStaticMarkup, NewRoutineModal, AppGlobalStyles, ToastBanner, CoachEditStudentModal, trapTab, getFocusable };",
    resolveDir: ROOT, sourcefile: "dlg-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, NewRoutineModal, AppGlobalStyles, ToastBanner, CoachEditStudentModal, trapTab, getFocusable } = await import(pathToFileURL(outfile).href);
const h = React.createElement;
const msg = (es) => es;
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

await test("BaseModal: role=dialog + aria-modal + nombre, usa el hook compartido y soporta closeOnEscape", () => {
  const src = read("components/modals/BaseModal.jsx");
  assert.match(src, /import useDialogA11y from '\.\/useDialogA11y\.js'/);
  assert.match(src, /role="dialog"/); assert.match(src, /aria-modal="true"/); assert.match(src, /aria-label=\{ariaLabel\}/);
  assert.match(src, /closeOnEscape = true/);
  assert.ok(src.indexOf('role="dialog"') < src.indexOf("{...(contentProps || {})}"), "contentProps (alertdialog) sigue pudiendo sobrescribir el rol");
  assert.ok(!/window\.addEventListener\('keydown'/.test(src), "ya no hay un listener Escape global por modal (se cerraban todos los apilados)");
});

await test("hook: Escape solo en el dialogo superior, Tab atrapado, foco inicial y retorno de foco", () => {
  const src = read("components/modals/useDialogA11y.js");
  assert.match(src, /stack\[stack\.length - 1\] !== token/); assert.match(src, /e\.key === 'Escape'/); assert.match(src, /typeof escRef\.current === 'function'/);
  assert.match(src, /root\.focus\(\)/); assert.match(src, /opener\.focus\(\)/); assert.match(src, /opener = document\.activeElement/);
});

await test("trapTab: Tab en el ultimo vuelve al primero, Shift+Tab en el primero va al ultimo, foco fuera entra", () => {
  const mk = (n) => ({ n, offsetParent: {}, focused: 0, focus() { this.focused++; global.document.activeElement = this; } });
  const a = mk("a"), b = mk("b"), c = mk("c");
  const root = { querySelectorAll: () => [a, b, c], contains: (x) => [a, b, c, root].includes(x), focus() {} };
  global.document = { activeElement: c };
  const ev = (shiftKey) => ({ shiftKey, prevented: 0, preventDefault() { this.prevented++; } });
  let e = ev(false); assert.equal(trapTab(e, root), true); assert.equal(a.focused, 1); assert.equal(e.prevented, 1);
  global.document.activeElement = a; e = ev(true); assert.equal(trapTab(e, root), true); assert.equal(c.focused, 1);
  global.document.activeElement = b; e = ev(false); assert.equal(trapTab(e, root), false); assert.equal(e.prevented, 0);
  global.document.activeElement = { outside: true }; e = ev(false); trapTab(e, root); assert.equal(a.focused, 2);
  assert.equal(getFocusable(null).length, 0);
  delete global.document;
});

await test("NewRoutineModal: dialogo con nombre; el fondo ya no cierra ni descarta lo tipeado", () => {
  const newR = { templateId: "blank", name: "", numDays: 3, days: [], note: "", alumno: "", showAdvanced: false };
  const html = renderToStaticMarkup(h(NewRoutineModal, { newR, setNewR() {}, es: true, msg, lbl: {}, inp: {}, btn: () => ({}), textMuted: "#999", bgCard: "#111", bgSub: "#222", border: "#333", setRoutines() {}, setAssignRoutineId() {}, uid: () => "x", toast2() {} }));
  assert.match(html, /role="dialog"/); assert.match(html, /aria-modal="true"/); assert.match(html, /aria-label="Nueva rutina"/);
  const src = read("components/routines/NewRoutineModal.jsx");
  assert.ok(!/onClick=\{\(\)=>setNewR\(null\)\}\s*\n\s*>/.test(src), "el overlay no cierra al tocar fuera");
  assert.match(src, /Rutina creada \(falta guardar\)/); assert.ok(!/Rutina creada ✓/.test(src));
});

await test("CoachEditStudentModal: dialogo con nombre accesible", () => {
  const html = renderToStaticMarkup(h(CoachEditStudentModal, { editAlumnoModal: { nombre: "Ana", email: "a@b.c" }, editAlumnoEmail: "a@b.c", setEditAlumnoEmail() {}, editAlumnoPass: "", setEditAlumnoPass() {}, darkMode: true, bgCard: "#111", border: "#333", textMuted: "#999", inp: {}, onClose() {}, onSave() {} }));
  assert.match(html, /role="dialog"/); assert.match(html, /aria-modal="true"/); assert.match(html, /aria-labelledby="edit-alumno-title"/); assert.match(html, /id="edit-alumno-title"/);
});

await test("alta de alumno: fondo no cierra, GUARDAR disabled + aria-busy mientras envia, dialogo con nombre", () => {
  const src = read("components/students/StudentsSection.jsx");
  assert.match(src, /role="dialog" aria-modal="true" aria-labelledby="new-alumno-title"/);
  assert.match(src, /disabled=\{creatingAlumno\} aria-busy=\{creatingAlumno\}/);
  assert.match(src, /if\(creatingAlumno\) return;/); assert.match(src, /setCreatingAlumno\(false\)/);
  assert.ok(!/justifyContent:"center"\}\} onClick=\{\(\)=>\{setNewAlumnoForm\(false\)/.test(src), "el overlay no cierra al tocar fuera");
  assert.match(src, /sb\.createAlumno\(\{nombre:newAlumnoData\.nombre\.trim\(\),email:newAlumnoData\.email\.trim\(\),entrenador_id:ENTRENADOR_ID\}\)/, "lo que se guarda no cambia");
});

await test("EditExModal y EditExerciseModal: el fondo no cierra y Escape no descarta cambios", () => {
  const a = read("components/routines/EditExModal.jsx");
  assert.match(a, /closeOnOutside=\{false\}/); assert.match(a, /closeOnEscape=\{false\}/); assert.match(a, /ariaLabel=/);
  const b = read("components/EditExerciseModal.jsx");
  assert.match(b, /role="dialog"/); assert.match(b, /aria-modal="true"/); assert.ok(!/<div\s+onClick=\{onClose\}/.test(b));
});

await test("overlays del coach con semantica: pago, chat, configuracion (solo a pantalla completa), duplicar dia, sesion huerfana", () => {
  assert.match(read("components/modals/PaymentInfoModal.jsx"), /role="dialog" aria-modal="true"/);
  assert.match(read("components/modals/CoachChatModal.jsx"), /role="dialog" aria-modal="true"/);
  const s = read("components/settings/SettingsShell.jsx");
  assert.match(s, /embed \? \{\} : \{ role: 'dialog', 'aria-modal': 'true'/);
  assert.match(read("components/routines/DuplicateDayModal.jsx"), /ariaLabel=/);
  assert.match(read("components/students/StudentOrphanSession.jsx"), /ariaLabel=/);
});

await test("sesion huerfana: 'Descartar' pasa a 'Ocultar por ahora' (solo texto)", () => {
  const src = read("components/students/StudentOrphanSession.jsx");
  assert.match(src, /msg\("Ocultar por ahora", "Hide for now"\)/); assert.ok(!/msg\("Descartar"/.test(src));
  assert.match(src, /onClick=\{discard\}/);
});

await test("CSS global: .sk fuera del media query, foco visible con !important en botones/enlaces/selects", () => {
  const css = renderToStaticMarkup(h(AppGlobalStyles, { darkMode: true, bgSub: "#1", textMain: "#2", border: "#3" })).replace(/&quot;/g, '"');
  const mediaIdx = css.indexOf("@media(min-width:768px){");
  assert.ok(mediaIdx > 0);
  const skIdx = css.indexOf(".sk{");
  assert.ok(skIdx > 0 && skIdx < mediaIdx, ".sk esta antes del media >= 768");
  assert.ok(css.indexOf("@keyframes shimmer") < mediaIdx);
  assert.ok(!css.slice(mediaIdx).includes(".sk{"));
  assert.match(css, /button:focus-visible,a:focus-visible,select:focus-visible[^{]*\{outline:2px solid #60A5FA!important/);
});

await test("toast por encima de todos los modales (z-index real del fuente)", () => {
  const html = renderToStaticMarkup(h(ToastBanner, { toast: "Aviso", darkMode: true, border: "#333", textMain: "#fff" }));
  const toastZ = Number(html.match(/z-index:(\d+)/)[1]);
  assert.match(html, /role="status"/);
  const files = [];
  (function walk(d) { for (const f of readdirSync(d)) { const p = path.join(d, f); statSync(p).isDirectory() ? walk(p) : /\.jsx?$/.test(f) && files.push(p); } })(path.join(ROOT, "components"));
  const zs = [];
  for (const f of files.filter((x) => !/ToastBanner/.test(x))) for (const m of readFileSync(f, "utf8").matchAll(/zIndex\s*[:=]\s*\{?\s*(\d+)/g)) zs.push(Number(m[1]));
  const modalMax = Math.max(...zs.filter((z) => z < 1e6));
  assert.ok(toastZ > modalMax, "toast " + toastZ + " > modales " + modalMax);
});

await test("botones solo-icono del coach con aria-label", () => {
  assert.match(read("components/layout/AppHeaderActions.jsx"), /aria-label=\{msg\("Configuración", "Settings"\)\}/);
  assert.match(read("components/layout/AppHeaderActions.jsx"), /aria-label=\{msg\("Menú de usuario", "User menu"\)\}/);
  assert.match(read("components/CoachCalendar.jsx"), /aria-label=\{M\(lang, "Cerrar", "Close", "Fechar"\)\} onClick=\{closeModal\}/);
  assert.match(read("components/modals/CoachChatModal.jsx"), /aria-label=\{msg\("Cerrar chat", "Close chat"\)\}/);
  assert.match(read("components/students/StudentRoutineActions.jsx"), /aria-label=\{msg\("Quitar rutina", "Remove routine"\)\}/);
  assert.match(read("components/students/StudentRoutinePreview.jsx"), /aria-label=\{msg\("Editar ejercicio", "Edit exercise"\) \+ ": " \+ item\.nombre\}/);
  assert.match(read("components/routines/ExerciseHistoryModal.jsx"), /aria-label=\{msg\("Cerrar", "Close"\)\}/);
  assert.match(read("components/EditExerciseModal.jsx"), /aria-label="Cerrar"/);
});

console.log("\n" + count + " pruebas OK");
