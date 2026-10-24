// Progreso -> Evolucion de carga: GRAFICO LINEAL interactivo (escala visual, segmentos, seleccion, aria, i18n, tokens).
//   node scripts/test-progressLoadLine.mjs
// SSR con esbuild + react-dom/server (renderToStaticMarkup no ejecuta eventos: la seleccion se prueba con funciones puras
// y con regex sobre el fuente); node:assert, sin dependencias nuevas. La escala es SOLO presentacion: no cambia chartComputed.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-loadline-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";import { renderToStaticMarkup } from "react-dom/server";' +
      'import ProgressLoadChart, { buildLoadWeekModel, buildYScale, yPos, buildLineSegments, defaultSelectedWeek, nextSelectedWeek } from "./components/progreso/ProgressLoadChart.jsx";' +
      'import { coachType as T } from "./components/coachUiScale.js";' +
      'import { coachThemePalette } from "./components/coachThemePalette.js";' +
      'import { irontrackMsg as M } from "./lib/irontrackMsg.js";' +
      "export { React, renderToStaticMarkup, ProgressLoadChart, buildLoadWeekModel, buildYScale, yPos, buildLineSegments, defaultSelectedWeek, nextSelectedWeek, T, coachThemePalette, M };",
    resolveDir: ROOT, sourcefile: "loadline-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, ProgressLoadChart, buildLoadWeekModel, buildYScale, yPos, buildLineSegments, defaultSelectedWeek, nextSelectedWeek, T, coachThemePalette, M } = await import(pathToFileURL(outfile).href);

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

// Misma forma que chartComputed de ProgresoView (se arma como lo hace el componente; no se modifica).
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
const model = (series, cur = 3) => buildLoadWeekModel(computed(series), cur);
const count_ = (html, re) => (html.match(re) || []).length;

test("vacio: sin datos no hay grafico (ProgresoView mantiene emptyBox) y la escala vacia no revienta", () => {
  assert.equal(computed([null, null, null, null]).empty, true);
  const v = read("components/ProgresoView.jsx");
  assert.match(v, /!model\.hasChartData \|\| chartComputed\.empty \?\s*\(\s*emptyBox\(/);
  assert.deepEqual(buildYScale([]).ticks, []);
  assert.equal(defaultSelectedWeek(model([null, null, null, null])), null);
});

test("un solo registro: punto destacado, sin linea, un boton, seleccionado por defecto", () => {
  const html = render([null, 45, null, null], 1);
  assert.equal(count_(html, /<polyline/g), 0);
  assert.equal(count_(html, /data-qa-load-point=/g), 1);
  assert.match(html, /aria-label="Semana 2: 45 kg" aria-pressed="true"/);
  assert.match(html, /<circle r="5\.5"[^>]*cx="131\.5"/, "punto seleccionado mas grande");
  assert.deepEqual(buildLineSegments(model([null, 45, null, null], 1)), []);
});

test("varios consecutivos: una linea entre cada par con dato en ambas semanas", () => {
  const w = model([40, 42.5, 41, 43]);
  assert.deepEqual(buildLineSegments(w), [[0, 1], [1, 2], [2, 3]]);
  assert.equal(count_(render([40, 42.5, 41, 43], 3), /<polyline/g), 3);
  assert.equal(count_(render([40, 42.5, null, null], 1), /<polyline/g), 1);
});

test("hueco intermedio: ningun segmento atraviesa el hueco y nunca se dibuja un 0", () => {
  assert.deepEqual(buildLineSegments(model([40, null, 45, null], 3)), []);
  assert.deepEqual(buildLineSegments(model([40, 41, null, 45], 3)), [[0, 1]]);
  const html = render([40, null, 45, 50], 3);
  assert.equal(count_(html, /<polyline/g), 1, "solo 45-50");
  assert.doesNotMatch(html, />0</);
  assert.doesNotMatch(html, /aria-label="Semana 2: [^"]*kg"/, "la semana vacia no es un punto");
  assert.equal(count_(html, /data-qa-load-point=/g), 3);
  assert.match(html, /Sin registro/);
});

test("semanas futuras: marcador punteado en el eje, 'Proxima', sin punto ni linea", () => {
  const html = render([40, 42, null, null], 1);
  assert.match(html, /Próxima/);
  assert.match(html, /stroke-dasharray="2\.5 2\.5"/);
  assert.equal(count_(html, /data-qa-load-point=/g), 2);
  assert.deepEqual(model([40, 42, null, null], 1).map((x) => x.status), ["data", "data", "future", "future"]);
});

test("escala: margen, sin base 0, orden y sin division por cero", () => {
  const s = buildYScale([40, 50]);
  assert.ok(s.d0 < 40 && s.d1 > 50, "margen visual");
  assert.ok(s.d0 > 0, "no se asume base 0");
  const top = yPos(50, s, 24, 94), bot = yPos(40, s, 24, 94);
  assert.ok(top < bot, "mayor valor = mas arriba");
  assert.ok(top > 24 && bot < 94, "los puntos quedan dentro del area con margen");
  for (const vals of [[45], [45, 45, 45], [0], [-3]]) {
    const e = buildYScale(vals);
    assert.ok(e.d1 > e.d0, "rango artificial");
    const y = yPos(vals[0], e, 24, 94);
    assert.ok(Math.abs(y - 59) < 0.01, "valor unico/igual centrado: " + y);
    assert.ok(Number.isFinite(y));
  }
});

test("ticks: 2 a 4 marcas redondas dentro del dominio (decimales, grandes, pequenos)", () => {
  for (const vals of [[40, 50], [40, 42.5], [42.5], [100, 1500], [1000, 1250], [0.5, 0.75], [62.5, 142.5], [20, 21]]) {
    const s = buildYScale(vals);
    assert.ok(s.ticks.length >= 1 && s.ticks.length <= 4, JSON.stringify(vals) + " -> " + s.ticks);
    for (const t of s.ticks) assert.ok(t >= s.d0 - 1e-9 && t <= s.d1 + 1e-9, "tick dentro del dominio");
    for (let i = 1; i < s.ticks.length; i++) assert.ok(s.ticks[i] > s.ticks[i - 1]);
    for (const t of s.ticks) assert.equal(String(t), String(Math.round(t * 10000) / 10000), "sin ruido de coma flotante");
  }
  assert.ok(buildYScale([40, 50]).ticks.length >= 2);
  const html = render([40, 42.5, 41, 43], 3);
  assert.equal(count_(html, /data-qa-load-tick=/g) >= 2 && count_(html, /data-qa-load-tick=/g) <= 4, true);
});

test("valores iguales y decimales: se muestran tal cual", () => {
  const eq = render([40, 40, 40, null], 2);
  assert.equal(count_(eq, /<polyline/g), 2);
  assert.doesNotMatch(eq, />Máx\.</, "sin maximo si son iguales");
  const dec = render([42.5, 41.25, null, null], 1);
  assert.match(dec, />42\.5</);
  assert.match(dec, />41\.25</);
  assert.match(dec, /aria-label="Semana 2: 41\.25 kg"/);
});

test("valores grandes: puntos dentro del lienzo y etiquetas completas", () => {
  const html = render([1000, 1500, 1250, 1750], 3);
  assert.match(html, />1750</);
  for (const m of html.matchAll(/<circle r="[\d.]+" cx="([\d.]+)" cy="([\d.-]+)"/g)) {
    assert.ok(+m[2] >= 0 && +m[2] <= 132, "cy dentro del viewBox: " + m[2]);
    assert.ok(+m[1] >= 0 && +m[1] <= 300);
  }
});

test("seleccion: por defecto la ultima semana con dato; tocar selecciona/cierra; vacias no seleccionables", () => {
  const w = model([40, 42.5, null, 45], 3);
  assert.equal(defaultSelectedWeek(w), 3);
  assert.equal(defaultSelectedWeek(model([40, null, null, null], 0)), 0);
  assert.equal(nextSelectedWeek(3, 1, w), 1, "cambia");
  assert.equal(nextSelectedWeek(1, 1, w), null, "mismo punto cierra");
  assert.equal(nextSelectedWeek(1, 2, w), 1, "semana sin registro no cambia la seleccion");
  assert.equal(nextSelectedWeek(null, 0, w), 0);
});

test("texto de la semana seleccionada en la region aria-live (valor, variacion, maximo)", () => {
  const html = render([40, 42.5, 41, null], 2);
  const m = html.match(/<div data-qa-load-detail="1" role="status" aria-live="polite" aria-atomic="true"[^>]*>(.*?)<div style="position:relative;width:100%"><svg/);
  assert.ok(m, "region aria-live");
  const txt = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  assert.match(txt, /Semana 3 41 kg/);
  assert.match(txt, /−1\.5 kg vs Semana 2/);
  const only = render([40, null, null, null], 1);
  assert.match(only, /role="status" aria-live="polite"[^>]*>.*Semana 1.*40 kg/);
  assert.doesNotMatch(only, / vs /, "sin variacion contra una semana vacia");
});

test("maximo y variacion de #124 se conservan; la formula de buildLoadWeekModel no cambio", () => {
  assert.deepEqual(model([40, 47.5, 45, null]).map((x) => x.isMax), [false, true, false, false]);
  assert.deepEqual(model([40, 42.5, 41, null]).map((x) => x.delta), [null, 2.5, -1.5, null]);
  assert.deepEqual(model([40, null, 45, null]).map((x) => x.delta), [null, null, null, null]);
  assert.equal(count_(render([40, 47.5, 45, null], 3), />Máx\.</g), 1);
  assert.match(render([40, 47.5, 45, null], 3), /r="10"/);
});

test("puntos: botones de 44 px con aria-label, foco por teclado nativo y sin animaciones", () => {
  const src = read("components/progreso/ProgressLoadChart.jsx");
  assert.match(src, /var HIT = 44;/);
  assert.match(src, /width: HIT,\s+height: HIT,/);
  const html = render([40, 42.5, 41, 43], 3);
  assert.equal(count_(html, /<button type="button"/g), 4);
  for (const i of [1, 2, 3, 4]) assert.match(html, new RegExp('aria-label="Semana ' + i + ': [\\d.]+ kg"'));
  assert.match(html, /width:44px;height:44px/);
  assert.match(html, /background:transparent/);
  assert.doesNotMatch(src, /transition|animation|@keyframes/);
  assert.match(src, /e\.key === "Escape"/);
  assert.match(src, /addEventListener\("pointerdown"/);
});

test("accesibilidad: grupo con resumen de las 4 semanas, svg decorativo, region aria-live, leyenda", () => {
  const html = render([40, null, 45, null], 2);
  assert.match(html, /role="group" aria-label="Evolución de carga por semana\. Semana 1: 40 kg, Semana 2: Sin registro, Semana 3: 45 kg, Semana 4: Próxima"/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<ul aria-label="Leyenda"/);
});

test("sin hex fijo y modo dia/noche por tokens C", () => {
  assert.doesNotMatch(read("components/progreso/ProgressLoadChart.jsx"), /#[0-9a-fA-F]{3,6}\b/);
  const L = coachThemePalette(false);
  const light = render([40, 45, null, null], 1, "es", L);
  assert.match(light, new RegExp(L.t2));
  assert.notEqual(light, render([40, 45, null, null], 1));
});

test("textos es/en/pt (detalle, pistas, leyenda, resumen)", () => {
  const en = render([40, 45, null, null], 1, "en");
  assert.match(en, /Weekly load progression/);
  assert.match(en, /No record|Upcoming/);
  assert.match(en, /vs Semana 1/);
  const pt = render([40, null, null, null], 1, "pt");
  assert.match(pt, /Evolução de carga por semana/);
  assert.match(pt, /Sem registro/);
  assert.match(pt, /Com registro/);
  const src = read("components/progreso/ProgressLoadChart.jsx");
  assert.match(src, /Tap a point to see the details/);
  assert.match(src, /Toque em um ponto para ver o detalhe/);
});

test("detalle: arriba del grafico (visible sin scroll), altura fija entre selecciones y etiquetas de semana sin salto de linea", () => {
  const html = render([40, 42.5, 41, 43], 3);
  assert.ok(html.indexOf("data-qa-load-detail") < html.indexOf("<svg data-qa-load-svg"), "detalle antes del svg");
  assert.match(html, /white-space:nowrap[^"]*">Semana 1</);
  assert.match(render([40, null, null, null], 1), /min-height:58px/);
});

test("responsivo: viewBox proporcional, ancho fluido con tope y sin alturas fijas", () => {
  const html = render([40, 42.5, 41, 43], 3);
  assert.match(html, /viewBox="0 0 300 132"/);
  assert.match(html, /max-width:480px/);
  assert.match(html, /height:auto/);
  assert.match(html, /grid-template-columns:repeat\(4, ?minmax\(0, ?1fr\)\)/);
  assert.match(html, /min-height:58px/);
});

test("alcance: chartComputed/chartSeries y las formulas siguen intactos", () => {
  const v = read("components/ProgresoView.jsx");
  assert.match(v, /var min = Math\.min\.apply\(null, vals\) - 5;/);
  assert.match(v, /var y = 100 - \(\(series\[i\] - min\) \/ range\) \* 100;/);
  assert.match(v, /var x = n <= 1 \? 150 : \(i \/ \(n - 1\)\) \* 300;/);
});

console.log("\n" + count + " pruebas OK");
