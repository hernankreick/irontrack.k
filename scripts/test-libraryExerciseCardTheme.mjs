// Tarjetas de Ejercicios (Biblioteca): en modo claro deben distinguirse del fondo blanco; el modo oscuro queda igual que en main.
//   node scripts/test-libraryExerciseCardTheme.mjs
// SSR con esbuild + react-dom/server, sin DOM ni red; node:assert, sin dependencias nuevas.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-libcard-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import LibraryExerciseCard from "./components/library/LibraryExerciseCard.jsx";' +
      "export { React, renderToStaticMarkup, LibraryExerciseCard };",
    resolveDir: ROOT, sourcefile: "libcard-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, LibraryExerciseCard } = await import(pathToFileURL(outfile).href);

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

// Valores de GestionBiblioteca.jsx.
const LIGHT = { bgCard: "#FFFFFF", bgSub: "#EEF2F7", border: "#E2E8F0", textMain: "#0F1923", textMuted: "#64748B" };
const DARK = { bgCard: "#162234", bgSub: "#111827", border: "#1E293B", textMain: "#F1F5F9", textMuted: "#94A3B8" };

function cardStyle(dm, libNarrow) {
  const t = dm ? DARK : LIGHT;
  const html = renderToStaticMarkup(React.createElement(LibraryExerciseCard, {
    e: { pattern: "rodilla" }, isCustom: true, nombre: "Sentadilla", muscleLine: "Cuadriceps", ytUrl: "https://youtu.be/abc",
    patLabel: (p) => String(p), bgCard: t.bgCard, cardBorder: dm ? "rgba(45, 64, 87, 0.9)" : t.border, _dm: dm, bgSub: t.bgSub,
    textMain: t.textMain, textMuted: t.textMuted, border: t.border, libNarrow, Ic: () => null, msg: (a) => a, lang: "es", onEdit() {}, onDelete() {},
  }));
  const m = html.match(/^<div class="([^"]*)" style="([^"]*)"/);
  assert.ok(m, "no se pudo leer la tarjeta");
  const style = Object.fromEntries(m[2].split(";").filter(Boolean).map((s) => { const i = s.indexOf(":"); return [s.slice(0, i).trim(), s.slice(i + 1).trim()]; }));
  return { cls: m[1], style };
}

for (const narrow of [true, false]) {
  test(`claro (libNarrow=${narrow}): borde visible, sombra y fondo distinto de blanco`, () => {
    const { cls, style } = cardStyle(false, narrow);
    assert.match(cls, /it-bib-ex-card-l/);
    assert.notEqual(style.background.toLowerCase(), "#ffffff");
    assert.equal(style.background, "#F8FAFC");
    assert.equal(style.border, "1px solid #CBD5E1");
    assert.notEqual(style.border.toLowerCase(), "1px solid #ffffff");
    assert.equal(style["box-shadow"], "0 1px 3px rgba(15, 23, 42, 0.08)");
    assert.equal(style["border-radius"], "17px");
    assert.equal(style.padding, "10px 12px");
  });
  test(`oscuro (libNarrow=${narrow}): estilo identico a main`, () => {
    const { cls, style } = cardStyle(true, narrow);
    assert.match(cls, /it-bib-ex-card-d/);
    assert.equal(style.background, "#162234");
    assert.equal(style.border, narrow ? "none" : "1px solid rgba(45, 64, 87, 0.9)");
    assert.equal(style["border-radius"], "17px");
    assert.equal(style.padding, "10px 12px");
    assert.equal(style["box-shadow"], undefined);
  });
}

console.log(`\n${count} pruebas OK`);
