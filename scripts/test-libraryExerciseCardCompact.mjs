// Tarjetas de Ejercicios (Biblioteca): compactas SOLO en < 768 px; en >= 768 el estilo es el de main.
//   node scripts/test-libraryExerciseCardCompact.mjs
// Regex sobre el fuente + SSR con esbuild + react-dom/server; node:assert, sin dependencias nuevas.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(path.join(ROOT, "components/layout/AppGlobalStyles.jsx"), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-libcompact-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";import { renderToStaticMarkup } from "react-dom/server";' +
      'import LibraryExerciseCard from "./components/library/LibraryExerciseCard.jsx";' +
      "export { React, renderToStaticMarkup, LibraryExerciseCard };",
    resolveDir: ROOT, sourcefile: "libcompact-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, LibraryExerciseCard } = await import(pathToFileURL(outfile).href);

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

const render = (over) => renderToStaticMarkup(React.createElement(LibraryExerciseCard, {
  e: { pattern: "rodilla" }, isCustom: false, nombre: "Sentadilla", muscleLine: "Cuadriceps", ytUrl: "https://youtu.be/abc",
  patLabel: (p) => String(p), bgCard: "#162234", cardBorder: "rgba(45, 64, 87, 0.9)", _dm: true, bgSub: "#111827", textMain: "#F1F5F9",
  textMuted: "#94A3B8", border: "#1E293B", libNarrow: false, Ic: () => React.createElement("i"), msg: (a) => a, lang: "es", onEdit() {}, onDelete() {}, ...over,
}));

// Todas las reglas it-bib-ex-* del CSS global.
const mediaBlock = css.match(/@media \(max-width:767px\)\{\.it-bib-ex-card[^"]*\}\}"/);

test("las reglas it-bib-ex-* viven en un unico bloque @media (max-width:767px)", () => {
  assert.ok(mediaBlock, "falta el bloque movil de Ejercicios");
  const rules = css.match(/\.it-bib-ex-(?:card|main|head|name|acts|tags)[^{]*\{/g) || [];
  assert.ok(rules.length >= 6);
  const outside = css.replace(mediaBlock[0], "");
  assert.equal(/\.it-bib-ex-(?:main|head|name|acts|tags)/.test(outside), false, "hay reglas it-bib-ex-* fuera del media <768");
  assert.equal(/\.it-bib-ex-card\s*\{[^}]*padding/.test(outside), false);
});

test("bloque movil: padding 8, titulo a todo el ancho, acciones 44 px en rejilla y etiquetas que comparten fila solo si caben", () => {
  const b = mediaBlock[0];
  assert.match(b, /\.it-bib-ex-card\{padding-top:8px!important;padding-bottom:8px!important\}/);
  assert.match(b, /\.it-bib-ex-main\{display:flex!important;flex-flow:row-reverse wrap;/);
  assert.match(b, /\.it-bib-ex-head\{display:contents!important\}/);
  assert.match(b, /\.it-bib-ex-name\{flex:0 0 100%!important;min-width:0/);
  assert.match(b, /\.it-bib-ex-acts\{display:grid!important;grid-template-columns:repeat\(2,44px\);gap:6px!important;flex:0 0 auto\}/);
  assert.match(b, /\.it-bib-ex-tags\{flex:1 1 max\(80px,calc\(var\(--it-tl,0\)\*3\.5px \+ 18px\)\);min-width:0;/);
  assert.match(b, /@media \(max-width:340px\)\{\.it-bib-ex-card:has\(\.it-bib-ex-acts>:nth-child\(3\)\)\{padding-left:8px!important;padding-right:8px!important\}/);
  assert.equal(/(?<![-\w])height:\d|overflow:hidden|text-overflow|ellipsis/.test(b), false, "sin alturas fijas, overflow:hidden ni ellipsis");
});

test("etiquetas largas: min-width:0 y overflow-wrap:anywhere en el bloque movil; se parten tras cada / sin cambiar el texto", () => {
  const b = mediaBlock[0];
  assert.match(b, /\.it-bib-ex-tags>span\{min-width:0;max-width:100%;overflow-wrap:anywhere;/);
  const plain = render({ muscleLine: "Cuadriceps/Gluteos/Abductores" });
  assert.equal(plain.includes("<wbr"), false, "sin matchMedia (escritorio/SSR) el texto es un unico nodo, como en main");
  assert.match(plain, />Cuadriceps\/Gluteos\/Abductores<\/span>/);
  globalThis.window = { matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) };
  const html = render({ muscleLine: "Cuadriceps/Gluteos/Abductores" });
  delete globalThis.window;
  assert.match(html, /Cuadriceps\/<wbr\/>Gluteos\/<wbr\/>Abductores/);
  assert.equal(html.replace(/<wbr\/>|<!-- -->/g, "").includes("Cuadriceps/Gluteos/Abductores"), true, "el texto visible no cambia");
  assert.equal(/ellipsis/.test(html), false);
});

test("ejercicio propio con video (3 acciones): fila de 3 botones de 44 px y etiquetas siempre en la fila de abajo", () => {
  const b = mediaBlock[0];
  assert.match(b, /:has\(\.it-bib-ex-acts>:nth-child\(3\)\) \.it-bib-ex-acts\{grid-template-columns:repeat\(3,44px\)\}/);
  assert.match(b, /:has\(\.it-bib-ex-acts>:nth-child\(3\)\) \.it-bib-ex-tags\{flex-basis:100%\}/);
  const html = render({ isCustom: true });
  const acts = html.match(/class="it-bib-ex-acts"[^>]*>([\s\S]*?)<\/div><\/div>/)[1];
  assert.equal((acts.match(/<button|<a /g) || []).length, 3);
});

test("ejercicio estandar: 2 acciones y cada una conserva coach-tap (44x44 en movil)", () => {
  const html = render({});
  const acts = html.match(/class="it-bib-ex-acts"[^>]*>([\s\S]*?)<\/div><\/div>/)[1];
  assert.equal((acts.match(/coach-tap/g) || []).length, 2);
  assert.match(css, /@media \(max-width:767px\)\{\.coach-tap,\.cd-btn\{min-height:44px;min-width:44px\}/);
});

test(">= 768: el markup conserva los estilos en linea de main (30x30, pila vertical, margen 7, miniatura 90x68)", () => {
  const html = render({ isCustom: true });
  assert.match(html, /class="it-bib-ex-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"/);
  assert.match(html, /class="it-bib-ex-acts" style="display:flex;flex-direction:column;gap:6px;align-items:center;flex-shrink:0"/);
  assert.match(html, /class="it-bib-ex-tags" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:7px;--it-tl:10"/);
  assert.match(html, /class="it-bib-ex-main" style="flex:1;min-width:0;padding-left:10px"/);
  assert.equal((html.match(/width:30px;height:30px/g) || []).length, 3);
  assert.match(html, /width:90px;height:68px/);
  assert.match(html, /padding:10px 12px/);
});

test("el diseno claro del PR #120 sigue en linea (fondo #F8FAFC, borde #CBD5E1, sombra)", () => {
  const html = render({ _dm: false, bgCard: "#FFFFFF", bgSub: "#EEF2F7", border: "#E2E8F0", textMain: "#0F1923", textMuted: "#64748B" });
  assert.match(html, /background:#F8FAFC/);
  assert.match(html, /border:1px solid #CBD5E1/);
  assert.match(html, /box-shadow:0 1px 3px rgba\(15, 23, 42, 0\.08\)/);
});

console.log(`\n${count} pruebas OK`);
