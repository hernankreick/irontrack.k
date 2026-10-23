// Biblioteca movil (< 768 px): los chips de filtro se reemplazan por UN <select> nativo; escritorio sin cambios.
//
//   node scripts/test-libraryFilterDropdown.mjs
//
// Renderiza LibraryManagementToolbar con react-dom/server (sin DOM, sin red, sin Supabase). El panel de filtros esta cerrado por
// defecto, asi que el test fuerza la PRIMERA useState del render (filterExpanded) a true sobre el React del bundle.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(ROOT, "components/library/LibraryManagementToolbar.jsx"), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-libfilt-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import Toolbar from "./components/library/LibraryManagementToolbar.jsx";' +
      "export { React, renderToStaticMarkup, Toolbar };",
    resolveDir: ROOT, sourcefile: "libfilt-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, Toolbar } = await import(pathToFileURL(outfile).href);

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
const h = React.createElement;
const noop = () => {};
const msg = (es) => es;

const patrones = ["todos", "empuje", "traccion", "rodilla", "bisagra", "core", "movilidad", "cardio", "oly"];
const musculos = ["todos", "Cuadriceps", "Gluteo", "Isquios", "Pecho", "Dorsal", "Hombro", "Biceps", "Triceps", "Core", "Pantorrilla"];
const patColors = Object.fromEntries(patrones.map((p) => [p, "#2563EB"]));

const props = (o) => ({
  busq: "", setBusq: noop, filtPat: "todos", setFiltPat: noop, filtMus: "todos", setFiltMus: noop, modoFiltro: "patron", setModoFiltro: noop,
  sortModo: 0, setSortModo: noop, patrones, musculos, patLabel: (p) => "P:" + p, musLabel: (m) => "M:" + m, patColors, chipBtnPad: {},
  inpS: { fontSize: 16 }, bgSub: "#162234", border: "#2D4057", _dm: true, libNarrow: true, exFiltrados: [1, 2], allEx: [1, 2, 3], msg, textMuted: "#8B9AB2", ...o,
});

// Panel abierto: la primera useState de cada render (filterExpanded) devuelve true.
function render(o) {
  const orig = React.useState;
  let first = true;
  React.useState = (init) => { if (first) { first = false; return [true, noop]; } return orig(init); };
  try { return renderToStaticMarkup(h(Toolbar, props(o))); } finally { React.useState = orig; }
}
const chips = (html) => (html.match(/class="coach-tap"[^>]*><?/g) || []).length;

await test("movil (compactFilters=true), modo patron: un <select> con aria-label y 9 opciones, 'todos' seleccionado, sin chips", () => {
  const html = render({ compactFilters: true });
  assert.equal((html.match(/<select /g) || []).length, 1);
  assert.match(html, /<select [^>]*aria-label="Categoría"/);
  assert.equal((html.match(/<option /g) || []).length, 9);
  assert.match(html, /<option value="todos" selected="">P:todos<\/option>/);
  assert.match(html, /<option value="oly">P:oly<\/option>/);
  assert.ok(!/M:Pecho/.test(html), "no mezcla musculos");
  assert.ok(/min-height:44px/.test(html.match(/<select [^>]*>/)[0]) && /font-size:16px/.test(html.match(/<select [^>]*>/)[0]) && /width:100%/.test(html.match(/<select [^>]*>/)[0]));
  assert.equal(chips(html), 3, "solo cierre + 2 botones de modo (coach-tap); ningun chip");
});

await test("movil, modo musculo: 11 opciones de musLabel, 'todos' seleccionado, sin chips", () => {
  const html = render({ compactFilters: true, modoFiltro: "musculo" });
  assert.equal((html.match(/<option /g) || []).length, 11);
  assert.match(html, /<option value="todos" selected="">M:todos<\/option>/);
  assert.match(html, /<option value="Pantorrilla">M:Pantorrilla<\/option>/);
  assert.ok(!/P:empuje/.test(html));
  assert.equal(chips(html), 3);
});

await test("el desplegable refleja la categoria activa (filtPat / filtMus)", () => {
  assert.match(render({ compactFilters: true, filtPat: "core" }), /<option value="core" selected="">P:core<\/option>/);
  assert.match(render({ compactFilters: true, modoFiltro: "musculo", filtMus: "Pecho" }), /<option value="Pecho" selected="">M:Pecho<\/option>/);
});

await test("escritorio (compactFilters=false): chips y sin <select>, igual que antes", () => {
  const p = render({ compactFilters: false });
  assert.ok(!/<select/.test(p));
  assert.equal(chips(p), 3 + 9, "cierre + modo + 9 chips de patron");
  assert.match(p, />P:empuje<\/button>/);
  const m = render({ compactFilters: false, modoFiltro: "musculo" });
  assert.ok(!/<select/.test(m));
  assert.equal(chips(m), 3 + 11);
});

await test("sin prop y sin window (SSR): estado inicial seguro = escritorio (chips, sin select)", () => {
  const html = render({});
  assert.ok(!/<select/.test(html));
  assert.equal(chips(html), 12);
});

await test("el contador de ejercicios no cambia con el modo compacto", () => {
  for (const c of [true, false]) assert.match(render({ compactFilters: c }), /Mostrando<!-- --> 2 <!-- -->ejercicios de<!-- --> 3|Mostrando 2 ejercicios de 3/);
});

await test("cableado: mismos setters que los chips, cambio de modo sigue reseteando a 'todos', media query < 768", () => {
  assert.match(src, /if \(modoFiltro==="patron"\) setFiltPat\(v\);/);
  assert.match(src, /else setFiltMus\(v==="todos"\?"todos":v\);/);
  assert.match(src, /onClick=\{\(\)=>\{setModoFiltro\(i===0\?"patron":"musculo"\);setFiltPat\("todos"\);setFiltMus\("todos"\);\}\}/);
  assert.match(src, /onClick=\{\(\)=>setFiltPat\(p\)\}/);
  assert.match(src, /onClick=\{\(\)=>setFiltMus\(m==="todos"\?"todos":m\)\}/);
  assert.match(src, /window\.matchMedia\('\(max-width: 767px\)'\)/);
  assert.match(src, /const \[v, setV\] = useState\(false\)/, "estado inicial SSR = false");
  assert.match(src, /compactFilters !== undefined && compactFilters !== null \? !!compactFilters : isUnder768/, "la prop tiene prioridad");
  assert.match(src, /value=\{modoFiltro==="patron" \? filtPat : filtMus\}/);
  assert.match(src, /appearance: "none"/);
});

console.log("\n" + count + " pruebas OK");
