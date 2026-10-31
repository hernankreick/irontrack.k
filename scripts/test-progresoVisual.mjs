// P1 — unificación VISUAL de Progreso del entrenador con la paleta de «Mis alumnos» / Dashboard D5.
//
//   node scripts/test-progresoVisual.mjs
//
// SSR con esbuild + react-dom/server, datos FICTICIOS, sin red ni Supabase. Cubre: Progreso usa alumnosPaleta (sin #0a0a0f, #12121a ni bordes
// violetas en oscuro), fondo continuo, tokens de progresoTone legibles sobre la nueva tarjeta, coachThemePalette.js y coachProgresoMetrics.js
// intactos (las otras pantallas siguen con su paleta), y las cifras KPI renderizadas son las del modelo (buildCoachProgresoModel).
process.env.TZ = "America/New_York";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-pv-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import ProgresoView from "./components/ProgresoView.jsx";' +
      'import { buildCoachProgresoModel } from "./components/coachProgresoMetrics.js";' +
      'import { progresoTone } from "./components/progreso/progresoTone.js";' +
      'import { alumnosPaleta } from "./components/students/alumnosPaleta.js";' +
      'import { buildProgresoDemoData } from "./components/demo/progresoCoachDemoData.js";' +
      "export { React, renderToStaticMarkup, ProgresoView, buildCoachProgresoModel, progresoTone, alumnosPaleta, buildProgresoDemoData };",
    resolveDir: ROOT, sourcefile: "pv-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const X = await import(pathToFileURL(outfile).href);
const h = X.React.createElement;
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const lum = (hex) => {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const files = ["components/ProgresoView.jsx"].concat(readdirSync(path.join(ROOT, "components/progreso")).map((f) => "components/progreso/" + f));
const OSCUROS = /#0a0a0f|#12121a|#0d0d15|#1e1e2e|#2a2a3c|#15151f|#252536|#1f2433/i;
const VIOLETAS = /#a78bfa|#7c3aed|#8b5cf6|violet|purple|rgba\(\s*(139|124|167)\s*,\s*(92|58|139)\s*,/i;

const demo = X.buildProgresoDemoData({});
const props = (dark, over) => Object.assign({ alumnos: demo.alumnos, sesionesGlobales: demo.sesionesGlobales, progresoGlobal: demo.progresoGlobal, rutinasSBEntrenador: demo.rutinasSBEntrenador, allEx: demo.allEx, historiaCompleta: demo.historiaCompleta, darkMode: dark }, over || {});
const render = (dark, over) => X.renderToStaticMarkup(h(X.ProgresoView, props(dark, over)));

await test("el fuente de Progreso no codifica grises casi negros ni bordes violetas", () => {
  for (const f of files) {
    const src = read(f);
    assert.doesNotMatch(src, OSCUROS, f + ": sin fondos/bordes casi negros codificados");
    assert.doesNotMatch(src, VIOLETAS, f + ": sin bordes violetas codificados");
  }
});

await test("ProgresoView usa alumnosPaleta para las superficies", () => {
  const src = read("components/ProgresoView.jsx");
  assert.match(src, /import \{ alumnosPaleta \} from "\.\/students\/alumnosPaleta\.js"/);
  for (const t of ["coachAluShell", "coachAluSurface", "coachAluSubtle", "coachAluBorderSoft"]) assert.match(src, new RegExp(t), t);
});

await test("oscuro (SSR): fondo #0A0F1A continuo, tarjetas #0D1424 y bordes neutros; nada de #0a0a0f, #12121a ni violeta", () => {
  const html = render(true);
  const A = X.alumnosPaleta(true);
  assert.ok(html.includes("background:" + A.coachAluShell + ";color:#ffffff;min-height:100%"), "raíz con el fondo de la paleta");
  assert.ok(html.includes("background:" + A.coachAluSurface), "tarjetas con coachAluSurface");
  assert.ok(html.includes("border:1px solid " + A.coachAluBorderSoft), "bordes neutros");
  assert.doesNotMatch(html, OSCUROS);
  assert.doesNotMatch(html, /border[^;"]*(#a78bfa|#7c3aed|#8b5cf6)/i, "sin bordes violetas");
  const compact = html.match(/data-qa="progreso-header-compacto" style="[^"]*"/)[0];
  assert.ok(compact.includes("background:" + A.coachAluShell), "la barra compacta pinta el mismo fondo");
});

await test("claro (SSR): paleta clara de Mis alumnos, sin fondos oscuros", () => {
  const html = render(false);
  const A = X.alumnosPaleta(false);
  assert.ok(html.includes("background:" + A.coachAluShell + ";color:"), "fondo claro");
  assert.ok(html.includes("background:" + A.coachAluSurface));
  assert.doesNotMatch(html, OSCUROS);
});

await test("progresoTone: textos secundarios >= 4,5:1 sobre tarjeta Y sobre el fondo, en oscuro y claro", () => {
  for (const dark of [true, false]) {
    const A = X.alumnosPaleta(dark);
    const bgs = [A.coachAluSurface, A.coachAluShell, A.coachAluSubtle];
    const P = X.progresoTone({ blue: dark ? "#3b82f6" : "#2563eb", card: A.coachAluSurface }, dark);
    for (const k of ["muted", "text2", "good", "bad", "warn", "neutral", "accentText"]) {
      for (const bg of bgs) assert.ok(ratio(P[k], bg) >= 4.5, (dark ? "oscuro " : "claro ") + k + " " + P[k] + " sobre " + bg + " = " + ratio(P[k], bg).toFixed(2));
    }
    assert.doesNotMatch(P.line + P.track, /#2a2a3c|#1f2433/i);
  }
});

await test("coachThemePalette.js y coachProgresoMetrics.js no se tocaron (las otras pantallas conservan su paleta)", () => {
  const pal = read("components/coachThemePalette.js");
  assert.match(pal, /bg: "#0a0a0f"/);
  assert.match(pal, /card: "#12121a"/);
  assert.match(pal, /brd: "#1e1e2e"/);
  const met = read("components/coachProgresoMetrics.js");
  assert.match(met, /MOVEMENT_PATTERN_DEF/);
  assert.match(met, /export function buildCoachProgresoModel/);
});

await test("las cifras KPI renderizadas son las del modelo (buildCoachProgresoModel), en ambos modos", () => {
  const alumnoSel = demo.alumnos[0].id;
  const model = X.buildCoachProgresoModel({ alumnos: demo.alumnos, sesionesGlobales: demo.sesionesGlobales, progresoGlobal: demo.progresoGlobal, rutinasSBEntrenador: demo.rutinasSBEntrenador, allEx: demo.allEx, periodId: "semanas4", alumnoSel, ejercicioSelId: null, diaIdx: 0, lang: "es" });
  const by = {};
  model.alumnoChips.forEach((c) => { by[c.key] = c; });
  const ad = by.alumnoAdherence, pr = by.alumnoPrs, vol = by.alumnoVolume;
  assert.ok(ad && pr && vol, "el modelo trae los chips del alumno");
  for (const dark of [true, false]) {
    const html = render(dark);
    const sel = (qa) => { const m = html.match(new RegExp('data-qa="' + qa + '"[\\s\\S]*?</article>')); assert.ok(m, qa); return m[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); };
    if (ad.value != null) assert.ok(sel("resumen-adherencia").includes(ad.value + "%"), "adherencia " + ad.value);
    assert.ok(new RegExp("PRs\\s+" + (pr.value != null ? pr.value : 0) + "\\s").test(sel("resumen-prs")), "PRs " + pr.value);
    if (vol.val && vol.val !== "—") assert.ok(sel("resumen-volumen").replace(/[.,\s]/g, "").includes(String(Math.round(vol.value)).replace(/[.,]/g, "")), "volumen " + vol.value);
  }
});

await test("sin datos: alumnos con rutina y sin sesiones renderizan en ambos modos sin errores ni colores viejos", () => {
  for (const dark of [true, false]) {
    const html = render(dark, { sesionesGlobales: [], progresoGlobal: {} });
    assert.match(html, /data-qa="progreso-coach"/);
    assert.doesNotMatch(html, OSCUROS);
    assert.doesNotMatch(html, /NaN|undefined|\[object/);
  }
});

console.log("\n" + count + " pruebas OK");
