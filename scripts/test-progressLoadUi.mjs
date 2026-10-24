// Progreso -> Evolucion de carga (UI): estados de semana, maximo, variacion, controles y hoja inferior.
//   node scripts/test-progressLoadUi.mjs
// SSR con esbuild + react-dom/server y regex sobre el fuente; node:assert, sin dependencias nuevas.
// La variacion es SOLO presentacion: resta de dos valores ya mostrados (semana i menos semana i-1) cuando ambas tienen dato.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-loadui-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";import { renderToStaticMarkup } from "react-dom/server";' +
      'import ProgressLoadChart, { buildLoadWeekModel } from "./components/progreso/ProgressLoadChart.jsx";' +
      'import ProgressLoadControls from "./components/progreso/ProgressLoadControls.jsx";' +
      'import { coachType as T, coachSpace as S } from "./components/coachUiScale.js";' +
      'import { coachThemePalette } from "./components/coachThemePalette.js";' +
      'import { irontrackMsg as M } from "./lib/irontrackMsg.js";' +
      "export { React, renderToStaticMarkup, ProgressLoadChart, buildLoadWeekModel, ProgressLoadControls, T, S, coachThemePalette, M };",
    resolveDir: ROOT, sourcefile: "loadui-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, ProgressLoadChart, buildLoadWeekModel, ProgressLoadControls, T, S, coachThemePalette, M } = await import(pathToFileURL(outfile).href);

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

// Misma forma que chartComputed de ProgresoView (no se recalculan valores aqui: se arma como lo hace el componente).
function computed(series) {
  const vals = series.filter((v) => v != null);
  if (!vals.length) return { chartPoints: [], polySegments: [], empty: true };
  const min = Math.min(...vals) - 5, max = Math.max(...vals) + 5, range = max - min || 1;
  const chartPoints = series.map((v, i) => (v == null ? { x: i, y: null, v: null, hasData: false } : { x: i, y: 100 - ((v - min) / range) * 100, v, hasData: true }));
  return { chartPoints, polySegments: [], empty: false };
}
const LABELS = ["Semana 1", "Semana 2", "Semana 3", "Semana 4"];
const C = coachThemePalette(true);
const render = (series, cur, lang = "es", palette = C) =>
  renderToStaticMarkup(React.createElement(ProgressLoadChart, { chartComputed: computed(series), weekLabels: LABELS, alumnoColor: "#22c55e", C: palette, T, lang, M, currentRoutineWeekIndex: cur }));

test("semana con dato / sin dato pasada / futura", () => {
  const w = buildLoadWeekModel(computed([40, null, 45, null]), 2);
  assert.deepEqual(w.map((x) => x.status), ["data", "missing", "data", "future"]);
  const html = render([40, null, 45, null], 2);
  assert.match(html, /Sin registro/);
  assert.match(html, /Próxima/);
  assert.equal((html.match(/<circle/g) || []).length >= 4, true);
  assert.match(html, /stroke-dasharray="2\.5 2\.5"/, "la futura lleva marcador punteado");
});

test("currentRoutineWeekIndex ausente: nada se marca como futuro", () => {
  for (const cur of [undefined, null, NaN]) {
    const w = buildLoadWeekModel(computed([40, null, null, null]), cur);
    assert.deepEqual(w.map((x) => x.status), ["data", "missing", "missing", "missing"]);
  }
  assert.doesNotMatch(render([40, null, null, null], undefined), /Próxima/);
});

test("sin dato nunca es 0 ni cruza la linea", () => {
  const html = render([40, null, 45, null], 3);
  assert.doesNotMatch(html, />0</);
  assert.equal((html.match(/<polyline/g) || []).length, 0, "con hueco no hay segmento entre 40 y 45");
  const adj = render([40, 42.5, null, null], 1);
  assert.equal((adj.match(/<polyline/g) || []).length, 1);
});

test("maximo destacado (anillo + badge) solo con >= 2 semanas con dato y valores distintos", () => {
  const w = buildLoadWeekModel(computed([40, 47.5, 45, null]), 3);
  assert.deepEqual(w.map((x) => x.isMax), [false, true, false, false]);
  const html = render([40, 47.5, 45, null], 3);
  assert.equal((html.match(/>Máx\.</g) || []).length, 1);
  assert.match(html, /r="10"/);
  assert.equal(buildLoadWeekModel(computed([40, null, null, null]), 0).some((x) => x.isMax), false);
  assert.equal(buildLoadWeekModel(computed([40, 40, null, null]), 1).some((x) => x.isMax), false);
});

test("variacion solo entre semanas consecutivas con dato; nunca contra una sin dato", () => {
  const up = buildLoadWeekModel(computed([40, 42.5, 41, null]), 3);
  assert.deepEqual(up.map((x) => x.delta), [null, 2.5, -1.5, null]);
  const gap = buildLoadWeekModel(computed([40, null, 45, null]), 3);
  assert.deepEqual(gap.map((x) => x.delta), [null, null, null, null]);
  // En el grafico lineal la variacion se muestra en el detalle de la semana seleccionada (por defecto, la ultima con dato).
  const html = render([40, 42.5, 41, null], 3);
  assert.match(html, /−1\.5 kg vs Semana 2/);
  assert.match(html, /↓/);
  const html2 = render([40, 42.5, null, null], 1);
  assert.match(html2, /\+2\.5 kg vs Semana 1/);
  assert.match(html2, /↑/);
  const same = render([40, 40, null, null], 1);
  assert.match(same, / Igual vs Semana 1</);
  assert.equal(buildLoadWeekModel(computed([40, 40, null, null]), 1)[1].delta, 0);
});

test("una sola semana registrada: sin variacion, sin maximo, punto centrado en su columna", () => {
  const html = render([null, null, 45, null], 2);
  assert.doesNotMatch(html, /↑|↓|\+\d|−\d/);
  assert.doesNotMatch(html, />Máx\.</);
  assert.match(html, /cx="196\.5"/, "columna 3 de 4 sobre el area de trazado (34..294 de un lienzo de 300)");
  assert.equal((html.match(/Sin registro/g) || []).length >= 2, true);
});

test("ninguna semana: el grafico no se usa (ProgresoView mantiene emptyBox)", () => {
  assert.equal(computed([null, null, null, null]).empty, true);
  const v = read("components/ProgresoView.jsx");
  assert.match(v, /!model\.hasChartData \|\| chartComputed\.empty \?\s*\(\s*emptyBox\(/);
});

test("las posiciones usan todas las columnas y las etiquetas van alineadas (grid de n columnas)", () => {
  const html = render([40, 42.5, 41, 43], 3);
  for (const cx of ["66.5", "131.5", "196.5", "261.5"]) assert.match(html, new RegExp('cx="' + cx + '"'));
  assert.match(html, /grid-template-columns:repeat\(4, ?minmax\(0, ?1fr\)\)/);
  assert.doesNotMatch(html, /height="124"/);
});

test("textos es/en/pt", () => {
  assert.match(render([40, null, null, null], 1, "en"), /No record/);
  assert.match(render([40, null, null, null], 1, "en"), /Upcoming/);
  assert.match(render([40, null, null, null], 1, "pt"), /Sem registro/);
  assert.match(render([40, 45, null, null], 1, "en"), />Max</);
});

test("modo dia y noche usan tokens C (sin hex fijo en el grafico)", () => {
  assert.doesNotMatch(read("components/progreso/ProgressLoadChart.jsx"), /#[0-9a-fA-F]{3,6}\b/);
  const light = render([40, 45, null, null], 1, "es", coachThemePalette(false));
  assert.match(light, new RegExp(coachThemePalette(false).t2.replace("#", "#")));
  assert.notEqual(light, render([40, 45, null, null], 1));
});

test("accesibilidad del grafico: grupo con resumen, svg oculto, leyenda con nombre", () => {
  const html = render([40, null, null, null], 1);
  assert.match(html, /role="group" aria-label="Evolución de carga por semana\. Semana 1: 40 kg, Semana 2: Sin registro/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
  assert.match(html, /<ul aria-label="Leyenda"/);
});

const options = [
  { id: "w1", name: "Sentadilla de copa con un nombre larguisimo para probar el recorte", section: "warmup" },
  { id: "m1", name: "Press de banca", section: "main" },
];
const controls = (over) => renderToStaticMarkup(React.createElement(ProgressLoadControls, {
  diasRutina: [{ label: "Dia 1" }, { label: "Dia 2" }], diaIdx: 0, setDiaIdx() {}, ejercicioSelId: "w1", setEjercicioSelId() {},
  exerciseOptions: options, rutinaActiva: {}, selectBaseStyle: { padding: "10px 12px" }, C, T, S, lang: "es", M, emptyBox: (l, t) => t, ...over,
}));

test("selectores: label htmlFor + id por control, 44 px y 16 px en compacto, calentamiento y principal en una fila", () => {
  const html = controls({ compact: true });
  const fors = [...html.matchAll(/<label for="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(fors.length, 3);
  for (const id of fors) assert.match(html, new RegExp('<select id="' + id.replace(/[:]/g, "\\:") + '"'));
  assert.equal(new Set(fors).size, 3);
  assert.equal((html.match(/min-height:44px/g) || []).length, 3);
  assert.equal((html.match(/font-size:16px/g) || []).length, 3);
  assert.match(html, /grid-template-columns:repeat\(2, ?minmax\(0, ?1fr\)\)/);
  assert.match(html, /text-overflow:ellipsis/);
});

test("selectores en escritorio: sin grilla ni alturas extra", () => {
  const html = controls({ compact: false });
  assert.doesNotMatch(html, /grid-template-columns/);
  assert.doesNotMatch(html, /min-height:44px/);
  assert.equal((html.match(/<label for=/g) || []).length, 3);
});

test("selectores: con un solo grupo de ejercicios no hay grilla", () => {
  const html = controls({ compact: true, exerciseOptions: [options[1]], ejercicioSelId: "m1" });
  assert.doesNotMatch(html, /grid-template-columns/);
  assert.equal((html.match(/<label for=/g) || []).length, 2);
});

test("selectores: sin rutina o sin dias se mantiene el emptyBox", () => {
  assert.match(controls({ diasRutina: [] }), /no tiene una rutina con días cargados/);
});

test("hoja inferior: dialog modal con nombre, cierre 44x44, safe-area, dvh y scroll interno", () => {
  const v = read("components/ProgresoView.jsx");
  assert.match(v, /role="dialog"\s+aria-modal="true"\s+aria-label=\{sheetAriaLabel\}/);
  assert.match(v, /aria-label=\{M\(lang, "Cerrar", "Close", "Fechar"\)\}/);
  assert.match(v, /width: 44,\s+height: 44,/);
  assert.match(v, /env\(safe-area-inset-bottom, 0px\)/);
  assert.match(v, /className="coach-sheet"/);
  assert.match(v, /data-sheet-body="1"/);
  assert.match(v, /overscrollBehavior: "contain"/);
  assert.doesNotMatch(v, /maxHeight: "80vh"/);
  const css = read("components/layout/AppGlobalStyles.jsx");
  assert.match(css, /\.coach-sheet\{max-height:85vh;max-height:85dvh/);
});

test("hoja inferior: misma apertura/cierre, y el resto de hojas siguen en el mismo contenedor", () => {
  const v = read("components/ProgresoView.jsx");
  for (const id of ["prs", "vol", "carga", "adherencia", "ranking"]) assert.match(v, new RegExp('activeSheet === "' + id + '"'));
  assert.match(v, /onClick=\{function \(\) \{ setActiveSheet\(null\); \}\}\s+style=\{\{\s+position: "fixed"/);
  assert.match(v, /currentRoutineWeekIndex=\{model\.currentRoutineWeekIndex\}/);
  assert.match(v, /compact=\{isUnder768\}/);
});

test("alcance: los calculos de chartComputed/chartSeries no se tocaron", () => {
  const v = read("components/ProgresoView.jsx");
  assert.match(v, /var min = Math\.min\.apply\(null, vals\) - 5;/);
  assert.match(v, /var y = 100 - \(\(series\[i\] - min\) \/ range\) \* 100;/);
  assert.match(v, /var x = n <= 1 \? 150 : \(i \/ \(n - 1\)\) \* 300;/);
});

console.log("\n" + count + " pruebas OK");
