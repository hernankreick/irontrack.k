// Rediseño de la ficha del alumno (Alumnos): tarjeta del alumno + tarjeta de rutina. Solo presentación: los datos vienen de props
// (mismos calculos de StudentsSection) y los handlers existentes se conservan.
//
//   node scripts/test-alumnoFichaRedesign.mjs
//
// SSR con esbuild + react-dom/server y datos sinteticos (como los otros scripts/test-*.mjs).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-ficha-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import StudentCard from "./components/students/StudentCard.jsx";' +
      'import StudentRoutinePreview from "./components/students/StudentRoutinePreview.jsx";' +
      "export { React, renderToStaticMarkup, StudentCard, StudentRoutinePreview };",
    resolveDir: ROOT, sourcefile: "ficha-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, StudentCard, StudentRoutinePreview } = await import(pathToFileURL(outfile).href);
const h = React.createElement;
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const msg = (es) => es;
const theme = { darkMode: true, msg, textMain: "#fff", textMuted: "#94a3b8", coachAluSurface: "#111827", coachAluBorderSoft: "#223", coachAluTrack: "#1e293b", coachAluSubtle: "#0f172a", coachAluDropdown: "#111827", coachAluDropdownShadow: "none" };
const alumno = { id: "a1", nombre: "Alumna Ficticia", email: "alumna@example.invalid" };
const rutina = { id: "r1", nombre: "Rutina Ficticia", alumno_id: "a1", datos: { days: [{}, {}, {}, {}] } };
const noop = () => {};

const card = (over) => renderToStaticMarkup(h(StudentCard, Object.assign({
  alumno, rutinaAsignada: rutina, rutinasLoaded: true, isActive: true, isMenuOpen: false,
  progresoSemanal: { totalDays: 4, completedDays: 1, pct: 25 },
  summary: { semanaTxt: "Semana 3 de 4", diasTxt: "1 de 4 días", proxTxt: "Día 2" },
  onVer: noop, onToggleMenu: noop, onChat: noop,
}, theme, over || {}), h("div", { id: "hijo" })));

const preview = (over) => renderToStaticMarkup(h(StudentRoutinePreview, Object.assign({
  alumno, rutinaAsignada: rutina, dias: [{ label: "Día 1" }, { label: "Día 2" }, { label: "Día 3" }, { label: "Día 4" }],
  progresoSemanal: { completedDayIndexes: [0, 2] }, semanaCiclo: 3, diasCompletados: 2, semCalLabel: "2/11 — 8/11", pctBar: 50,
  diSel: 1, dSel: { label: "Día 2", warmup: [{}], exercises: [{}, {}] }, proxTxt: "Día 2 · Semana 3", proxDiaIdx: 1,
  warmupItems: [{ key: "w0", ex: { sets: 2, reps: "10" }, nombre: "Movilidad", isLast: true }],
  exerciseItems: [{ key: "e0", ex: { sets: 4, reps: "8", kg: "60" }, nombre: "Sentadilla", isLast: false }, { key: "e1", ex: { sets: 3, reps: "12" }, nombre: "Remo", isLast: true }],
  coachRutinaMenuOpen: true, coachDiaSecsOpen: { warmup: true, main: true },
  onToggleRoutineMenu: noop, onResetWeek: noop, onResetRoutine: noop, onValidateSession: noop, onSelectDay: noop,
  onToggleWarmup: noop, onToggleMain: noop, onEditWarmupExercise: noop, onAddWarmupExercise: noop, onEditMainExercise: noop, onAddMainExercise: noop,
  onEditRoutine: noop, onRemoveRoutine: noop,
}, theme, over || {})));

await test("Encabezado expandido: identidad, rutina, mensaje y menu; resumen con los 3 indicadores reales y sin barra duplicada", () => {
  const html = card();
  assert.match(html, /data-qa-alumno-card="open"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /Alumna Ficticia/); assert.match(html, /alumna@example\.invalid/); assert.match(html, /Rutina Ficticia/);
  assert.match(html, /aria-label="Mensaje a Alumna Ficticia"/); assert.match(html, /aria-label="Más opciones"/);
  for (const t of ["Semana 3 de 4", "Rutina actual", "1 de 4 días", "Esta semana", "Día 2", "Próxima sesión"]) assert.ok(html.includes(t), t);
  assert.doesNotMatch(html, /días esta semana/, "sin la barra compacta cuando esta expandida");
  assert.doesNotMatch(html, /CERRAR|>VER</);
  assert.match(html, /id="hijo"/, "la ficha (children) se sigue renderizando");
});

await test("Encabezado contraido: control de expandir con aria-expanded=false y la barra compacta de la semana", () => {
  const html = card({ isActive: false });
  assert.match(html, /data-qa-alumno-card="closed"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /1\/4 días esta semana/);
  assert.doesNotMatch(html, /Rutina actual/);
});

await test("Tarjeta de rutina: encabezado, semana con fechas, anillo + barra con el % real, sin valores del mockup", () => {
  const html = preview();
  assert.match(html, /Rutina Ficticia/);
  assert.match(html, /4 días por semana · 4 semanas/);
  assert.ok(html.includes("Semana 3 de 4"));
  assert.match(html, /2\/11 — 8\/11/);
  assert.ok(html.includes("2 de 4 días"));
  assert.match(html, /50% completado/);
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="50"/);
  assert.equal((html.match(/role="progressbar"/g) || []).length, 1, "una sola barra");
  assert.doesNotMatch(html, /67%|Semana 2 de 4|Cata/);
});

await test("Selector de dias: estado por completedDayIndexes, seleccionado con aria-pressed; proxima sesion real y navegable", () => {
  const html = preview();
  assert.match(html, /aria-pressed="false" aria-label="Día 1 — Realizado"/);
  assert.match(html, /aria-pressed="true" aria-label="Día 2 — Pendiente"/);
  assert.match(html, /aria-label="Día 3 — Realizado"/);
  assert.match(html, /aria-label="Día 4 — Pendiente"/);
  assert.match(html, /aria-label="Próxima sesión: Día 2 · Semana 3"/);
  const btn = (html) => html.match(/<button[^>]*aria-label="Próxima sesión: [^"]*"[^>]*>/)[0];
  assert.doesNotMatch(btn(html), /disabled/);
  assert.match(btn(preview({ proxDiaIdx: null })), /disabled/, "sin dia valido no navega");
});

await test("Ejercicios: bloques, series/reps, editar por ejercicio, añadir sin '+' duplicado; menu de rutina con Validar sesion", () => {
  const html = preview();
  assert.match(html, /Día 2[\s\S]*?· 3 ej\./);
  assert.match(html, /ENTRADA EN CALOR/); assert.match(html, /BLOQUE PRINCIPAL/);
  assert.match(html, /4×8 · 60kg/); assert.match(html, /3×12/);
  for (const n of ["Movilidad", "Sentadilla", "Remo"]) assert.match(html, new RegExp('aria-label="Editar ejercicio: ' + n + '"'));
  assert.equal((html.match(/Añadir ejercicio/g) || []).length, 2);
  assert.doesNotMatch(html, /\+ Añadir/);
  for (const t of ["Validar sesión manualmente", "Reiniciar semana", "Reiniciar rutina", "Editar rutina", 'aria-label="Quitar rutina"']) assert.ok(html.includes(t), t);
});

await test("Handlers y calculo intactos: los mismos callbacks se cablean y el check del dia sale de completedDayIndexes", () => {
  const src = read("components/students/StudentRoutinePreview.jsx");
  for (const cb of ["onSelectDay(di)", "onToggleWarmup", "onToggleMain", "onEditWarmupExercise", "onEditMainExercise", "onAddWarmupExercise", "onAddMainExercise", "onValidateSession={onValidateSession}", "onResetWeek={onResetWeek}", "onResetRoutine={onResetRoutine}", "onEditRoutine={onEditRoutine}", "onRemoveRoutine={onRemoveRoutine}"]) assert.ok(src.includes(cb), cb);
  assert.match(src, /var dayDone = progresoSemanal\.completedDayIndexes\.indexOf\(di\) !== -1;/);
  // Ajuste final aprobado: sin el icono circular con mancuerna; el titulo queda alineado al padding izquierdo de la tarjeta.
  assert.doesNotMatch(src, /name="dumbbell"/);
  assert.match(src, /gap:10,marginBottom:8\}\}>\s*<div style=\{\{flex:1,minWidth:0\}\}>/, "el bloque del titulo es el primer hijo del encabezado");
  const sec = read("components/students/StudentsSection.jsx");
  assert.match(sec, /if\(diasCompletados >= dias\.length\) \{ proxDia = 1; proxSemana = semanaCiclo < 4 \? semanaCiclo \+ 1 : 1; \}/, "regla de proxima sesion sin cambios");
});

await test("Movil: areas tactiles de 44 px con recuadros visibles mas chicos, filas de 44 y reglas estrechas solo en media queries", () => {
  const prev = read("components/students/StudentRoutinePreview.jsx");
  // Lapiz: el boton (area tactil) mide 44 x 44 y el recuadro visible 34 x 34; la fila mide 44, asi las areas no se superponen.
  assert.match(prev, /var editBtn = \{width:44,height:44,flexShrink:0,background:"transparent",border:"none",/);
  assert.match(prev, /var editBox = \{width:34,height:34,/);
  assert.match(prev, /<Ic name="edit-2" size=\{20\}/);
  assert.match(prev, /return <div key=\{item\.key\} style=\{\{display:"flex",gap:8,padding:0,minHeight:44,/);
  assert.match(prev, /var addBtn = \{width:"100%",minHeight:44,/);
  assert.match(prev, /var secBtn = \{width:"100%",minHeight:44,/);
  assert.match(prev, /flex:"1 0 auto",\s*minHeight:44,/, "los dias nunca se recortan: si no entran, el carrusel se desplaza");
  const card = read("components/students/StudentCard.jsx");
  assert.match(card, /var iconBtn = \{width:44,height:44,[^}]*background:"transparent",[^}]*border:"none"/);
  assert.match(card, /var iconBox = \{width:36,height:36,/);
  const actions = read("components/students/StudentRoutineActions.jsx");
  assert.match(actions, /aria-label=\{msg\("Opciones de rutina", "Routine options"\)\} style=\{\{width:44,height:44,[\s\S]*?<span aria-hidden="true" style=\{\{width:36,height:36,/);
  for (const src of [prev, card]) assert.doesNotMatch(src, /fontWeight:(800|900)/, "sin pesos extra-bold/black en la ficha");
  const css = read("components/layout/AppGlobalStyles.jsx");
  assert.match(css, /@media \(max-width:519px\)\{\.it-ficha-sum\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important\}\.it-ficha-sum-item:nth-child\(3\)\{grid-column:1\/-1;/, "resumen: semana y dias arriba y proxima sesion a todo el ancho por debajo de 520 px");
  assert.match(card, /className="it-ficha-sum" style=\{\{display:"grid",gridTemplateColumns:"repeat\(3,minmax\(0,1fr\)\)"/, "resumen en 3 columnas minmax(0,1fr) en pantallas anchas");
  assert.match(card, /className="it-ficha-sum-item" title=\{it\.value \+ " · " \+ it\.label\}/, "texto completo accesible por title");
  assert.doesNotMatch(card.slice(card.indexOf("it-ficha-sum")), /whiteSpace:"nowrap"/, "los textos del resumen no usan nowrap");
  assert.match(css, /\.it-ficha-sum-item \[data-qa-text\]\{overflow-wrap:anywhere\}/, "los valores largos saltan de linea dentro de su item");
  assert.match(css, /@media \(max-width:379px\)\{\.it-ficha-stats\{grid-template-columns:minmax\(0,1fr\)!important\}/);
});

console.log("\n" + count + " pruebas OK");
