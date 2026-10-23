// Selector de zona horaria de Configuracion: el style inline no mezcla el shorthand `background` con longhands
// (background-image/repeat/position/size). Al cambiar el tema React reescribe solo el shorthand y resetea los longhands
// (flecha repetida). Regresion por fuente sobre components/settings/**.
//
//   node scripts/test-settingsSelectStyle.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "components", "settings");
let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

// Devuelve cada objeto `style={{ ... }}` (hasta el cierre `}}`) de un fuente.
function styleBlocks(src) {
  const out = [];
  let i = 0;
  while ((i = src.indexOf("style={{", i)) !== -1) {
    let depth = 0, j = i + "style={".length;
    const start = j;
    for (; j < src.length; j++) {
      if (src[j] === "{") depth++;
      else if (src[j] === "}" && --depth === 0) break;
    }
    out.push({ at: src.slice(0, i).split("\n").length, text: src.slice(start, j + 1) });
    i = j;
  }
  return out;
}

const files = readdirSync(dir).filter((f) => /\.jsx?$/.test(f));
const BG_LONG = /\bbackground(Image|Repeat|Position|Size|Attachment|Origin|Clip)\s*:/;
const BG_SHORT = /(^|[\s,{])background\s*:/;

test("ningun style inline de components/settings/** mezcla `background` con longhands de background", () => {
  for (const f of files) {
    for (const b of styleBlocks(readFileSync(path.join(dir, f), "utf8"))) {
      assert.ok(!(BG_SHORT.test(b.text) && BG_LONG.test(b.text)), `${f}:${b.at} mezcla background con longhands`);
    }
  }
});

test("el select de zona horaria usa backgroundColor + chevron/repeat/position/size como longhands", () => {
  const src = readFileSync(path.join(dir, "SettingsPage.jsx"), "utf8");
  const sel = styleBlocks(src).find((b) => b.text.includes("selectChevron"));
  assert.ok(sel, "no se encontro el style del select");
  assert.match(sel.text, /backgroundColor:\s*C\.control/);
  assert.doesNotMatch(sel.text, BG_SHORT);
  for (const k of ["backgroundImage: C.selectChevron", "backgroundRepeat: 'no-repeat'", "backgroundPosition: 'right 12px center'", "backgroundSize: '16px 16px'"]) assert.ok(sel.text.includes(k), k);
});

test("el select sigue ligado a tz/setTz (sin cambio de comportamiento)", () => {
  const src = readFileSync(path.join(dir, "SettingsPage.jsx"), "utf8");
  assert.match(src, /value=\{tz\} onChange=\{e => setTz\(e\.target\.value\)\}/);
});

console.log(`\n${count} pruebas OK`);
