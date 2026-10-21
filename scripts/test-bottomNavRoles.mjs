// Barra inferior (GlobalBottomNav) por rol y ancho + toast accesible (ToastBanner) + contrastes de la pestaña activa.
//
//   node scripts/test-bottomNavRoles.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sale con codigo != 0 en el primer fallo.
// Renderiza los componentes reales con react-dom/server (sin DOM, sin red, sin Supabase, sin escribir datos).
// El bundle se genera en el directorio temporal del sistema, no dentro del repo.

import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = mkdtempSync(path.join(os.tmpdir(), "irontrack-nav-"));
const outfile = path.join(outDir, "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import GlobalBottomNav from "./components/layout/GlobalBottomNav.jsx";' +
      'import ToastBanner from "./components/ui/ToastBanner.jsx";' +
      "export { React, renderToStaticMarkup, GlobalBottomNav, ToastBanner };",
    resolveDir: root,
    sourcefile: "nav-entry.jsx",
    loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, GlobalBottomNav, ToastBanner } = await import(pathToFileURL(outfile).href);

let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log("ok -", name);
}

// ---- contraste WCAG
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const blend = (fg, a, bg) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");

// ---- barra inferior
const tabs2 = ["plan", "library", "progress"].map((k) => ({ k, lbl: k.toUpperCase(), icon: (c) => React.createElement("i", { style: { color: c } }) }));
function renderNav({ width, esAlumno, darkMode = false, tab = "plan" }) {
  globalThis.window = { innerWidth: width };
  try {
    return renderToStaticMarkup(React.createElement(GlobalBottomNav, { darkMode, esAlumno, tabs2, tab, setTab: () => {} }));
  } finally {
    delete globalThis.window;
  }
}
const isHidden = (html) => /display:none/.test(html);

await test("visibilidad por rol y ancho: oculta solo para entrenador <768px; alumno siempre visible", () => {
  for (const width of [320, 375, 393, 412, 767, 768, 1024, 1440]) {
    assert.equal(isHidden(renderNav({ width, esAlumno: true })), false, "alumno visible a " + width);
    assert.equal(isHidden(renderNav({ width, esAlumno: false })), width < 768, "entrenador a " + width);
  }
});

await test("visibilidad igual en modo oscuro", () => {
  for (const width of [375, 767, 768]) {
    assert.equal(isHidden(renderNav({ width, esAlumno: true, darkMode: true })), false);
    assert.equal(isHidden(renderNav({ width, esAlumno: false, darkMode: true })), width < 768);
  }
});

await test("alumno en movil ve sus 3 pestanas (PLAN, LIBRARY, PROGRESS) como botones", () => {
  const html = renderNav({ width: 375, esAlumno: true });
  assert.equal((html.match(/<button/g) || []).length, 3);
  ["PLAN", "LIBRARY", "PROGRESS"].forEach((l) => assert.ok(html.includes(">" + l + "<"), l));
});

await test("accesibilidad: nav con aria-label y aria-current solo en la pestana activa", () => {
  const html = renderNav({ width: 375, esAlumno: true, tab: "library" });
  assert.ok(html.includes('aria-label="Navegación del alumno"'));
  assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
  assert.ok(/aria-current="page"[^>]*>(?:(?!<\/button>)[\s\S])*LIBRARY/.test(html), "la activa es LIBRARY");
  assert.ok(renderNav({ width: 1024, esAlumno: false }).includes('aria-label="Navegación principal"'));
});

const activeColor = (html) => /font-weight:700;[^"]*?color:(#[0-9A-Fa-f]{6})/.exec(html)[1];
const inactiveColor = (html) => /font-weight:500;[^"]*?color:(#[0-9A-Fa-f]{6})/.exec(html)[1];
const NAV_LIGHT = blend("#FFFFFF", 0.96, "#F0F4F8");
const NAV_DARK = blend("#0F1923", 0.96, "#0F1923");

await test("contraste WCAG AA (>=4.5) de las etiquetas de la barra en modo claro: activa e inactiva, alumno y entrenador", () => {
  for (const esAlumno of [true, false]) {
    const html = renderNav({ width: 1024, esAlumno, darkMode: false });
    assert.ok(ratio(activeColor(html), NAV_LIGHT) >= 4.5, "activa claro esAlumno=" + esAlumno + " " + activeColor(html));
    assert.ok(ratio(inactiveColor(html), NAV_LIGHT) >= 4.5, "inactiva claro " + inactiveColor(html));
  }
});

await test("contraste WCAG AA de las etiquetas en modo oscuro: alumno y entrenador", () => {
  for (const esAlumno of [true, false]) {
    const html = renderNav({ width: 1024, esAlumno, darkMode: true });
    assert.ok(ratio(activeColor(html), NAV_DARK) >= 4.5, "activa oscuro esAlumno=" + esAlumno + " " + activeColor(html));
    assert.ok(ratio(inactiveColor(html), NAV_DARK) >= 4.5, "inactiva oscuro " + inactiveColor(html));
  }
});

// ---- toast
const renderToast = (toast, darkMode) => renderToStaticMarkup(React.createElement(ToastBanner, { toast, darkMode, border: "#2D4057", textMain: darkMode ? "#FFFFFF" : "#0F1923" }));

await test("toast: la region live existe siempre (aun sin mensaje) y sin texto cuando no hay aviso", () => {
  const html = renderToast("", false);
  assert.ok(/role="status"/.test(html) && /aria-live="polite"/.test(html) && /aria-atomic="true"/.test(html));
  assert.ok(!/<div[^>]*border:1px/.test(html), "sin burbuja");
  assert.ok(renderToast(null, true).includes('role="status"'));
});

await test("toast: el mensaje queda dentro de la region live y respeta safe-area inferior", () => {
  const html = renderToast("Serie guardada ✓", false);
  assert.ok(/role="status"[^>]*>[\s\S]*Serie guardada ✓/.test(html));
  assert.ok(html.includes("env(safe-area-inset-bottom"), "suma safe-area");
});

await test("toast: contraste >=4.5 de texto en error y exito, modo claro y oscuro", () => {
  for (const darkMode of [false, true]) {
    const page = darkMode ? "#0F1923" : "#F0F4F8";
    for (const [msg, tint] of [["Error al guardar", "#EF4444"], ["Serie guardada ✓", "#22C55E"]]) {
      const col = /color:(#[0-9A-Fa-f]{6})/.exec(renderToast(msg, darkMode))[1];
      assert.ok(ratio(col, blend(tint, 0x22 / 255, page)) >= 4.5, msg + " darkMode=" + darkMode + " " + col);
    }
  }
});

console.log("\n" + count + " pruebas OK");
