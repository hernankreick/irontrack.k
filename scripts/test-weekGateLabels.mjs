// Etiquetas "Hoy toca / Hoy:" vs "Próximo" segun el gate de semana completada (solo presentacion).
// Renderiza los componentes reales (esbuild + react-dom/server, en memoria; sin red ni dependencias nuevas).
//
//   node scripts/test-weekGateLabels.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { build } = require("esbuild");

const entry = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Label from ${JSON.stringify(ROOT + "/components/student/AlumnoPlanHeaderDayLabel.jsx")};
import Card from ${JSON.stringify(ROOT + "/components/student-plan/StudentWeeklyProgressCard.jsx")};
export function header(msg, isNext) {
  return renderToStaticMarkup(React.createElement(Label, { alumnoPlanHeaderDayNum: 1, textMuted: '#999', msg, isNextWorkout: isNext }));
}
export function card(msg, isNext) {
  return renderToStaticMarkup(React.createElement(Card, { msg, bgCard: '#111', border: '#222', textMuted: '#999', darkMode: true,
    currentWeek: 1, daysCompletedThisWeek: 0, totalDays: 4, weeklyPct: 0, nextDayIdx: 0, isNextWorkout: isNext }));
}
`;
const out = await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "jsx" },
  bundle: true, write: false, format: "cjs", platform: "node",
  external: ["react", "react-dom", "react-dom/server"], loader: { ".jsx": "jsx" },
});
const mod = { exports: {} };
new Function("require", "module", "exports", out.outputFiles[0].text)(require, mod, mod.exports);
const { header, card } = mod.exports;

const es = (a) => a;
const en = (a, b) => b;
const pt = (a, b, c) => (c !== undefined ? c : a);
const text = (html) => html.replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok - " + name); }

test("header, gate ACTIVO: Próximo / Next (es, en, pt); el dia se mantiene", () => {
  assert.ok(text(header(es, true)).includes("Próximo|DÍA 1"));
  assert.ok(text(header(en, true)).includes("Next|DAY 1"));
  assert.ok(text(header(pt, true)).includes("Próximo|DIA 1"));
  assert.ok(!header(es, true).includes("Hoy toca"));
});
test("header, gate INACTIVO: sin cambios (Hoy toca / Today / Hoje)", () => {
  assert.ok(text(header(es, false)).includes("Hoy toca|DÍA 1"));
  assert.ok(text(header(en, false)).includes("Today|DAY 1"));
  assert.ok(text(header(pt, false)).includes("Hoje|DIA 1"));
  assert.equal(header(es, undefined), header(es, false), "sin prop = comportamiento anterior");
});
test("tarjeta, gate ACTIVO: • Próximo: Día 1 / • Next: Day 1", () => {
  assert.ok(text(card(es, true)).includes("• Próximo: |Día| 1") || text(card(es, true)).includes("Próximo:"));
  assert.ok(/Próximo:/.test(card(es, true)) && !/Hoy:/.test(card(es, true)));
  assert.ok(/Next:/.test(card(en, true)) && !/Today:/.test(card(en, true)));
  assert.ok(/Próximo:/.test(card(pt, true)));
  assert.ok(/Día[^<]*<!-- --> <!-- -->1|Día.*1/.test(card(es, true)), "mantiene Día 1");
});
test("tarjeta, gate INACTIVO: sin cambios (• Hoy: Día X / Today:)", () => {
  assert.ok(/Hoy:/.test(card(es, false)) && !/Próximo/.test(card(es, false)));
  assert.ok(/Today:/.test(card(en, false)));
  assert.equal(card(es, undefined), card(es, false), "sin prop = comportamiento anterior");
});
test("tarjeta: no repite 'Disponible el lunes' (lo comunica el banner)", () => {
  assert.ok(!/Disponible|Available/.test(card(es, true)) && !/Disponible|Available/.test(card(en, true)));
  assert.ok(!/Disponible|Available/.test(header(es, true)));
});
test("cableado: App pasa weekGate.active al header y a la tarjeta; AppTopBar lo reenvia", () => {
  const app = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  const top = readFileSync(path.join(ROOT, "components/layout/AppTopBar.jsx"), "utf8");
  assert.ok(app.includes("alumnoPlanHeaderIsNext={weekGate.active}"));
  assert.ok(app.includes("isNextWorkout={weekGate.active}"));
  assert.ok(top.includes("isNextWorkout={alumnoPlanHeaderIsNext}"));
  // sin estado persistente nuevo: el cambio depende solo del gate derivado
  assert.ok(!/localStorage\.(set|get)Item\(["']it_next/.test(app));
});

console.log("\n" + count + " tests OK");
