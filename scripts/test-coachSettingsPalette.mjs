// Paleta unica de Configuracion del entrenador: contrastes WCAG AA (oscuro y claro) y ausencia de hex sueltos en los componentes.
//
//   node scripts/test-coachSettingsPalette.mjs
//
// node:assert, sin dependencias nuevas.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "components", "settings");
const { default: palette, SETTINGS_RADIUS } = await import(pathToFileURL(path.join(dir, "coachSettingsPalette.js")).href);

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

for (const [mode, dm] of [["oscuro", true], ["claro", false]]) {
  const P = palette(dm);
  const text = (fg, bg, min = 4.5) => assert.ok(ratio(P[fg], P[bg]) >= min, `${mode}: ${fg} sobre ${bg} = ${ratio(P[fg], P[bg]).toFixed(2)} (< ${min})`);

  test(`${mode}: texto principal, secundario y terciario >= 4,5:1 sobre fondo, superficie y control`, () => {
    for (const fg of ["text", "sub", "muted"]) for (const bg of ["bg", "card", "control"]) text(fg, bg);
  });
  test(`${mode}: pestañas inactiva (sub) y activa (blueText) legibles sobre fondo y barra lateral activa`, () => {
    text("sub", "bg"); text("blueText", "bg"); text("blueText", "card"); text("blueText", "navActiveBg"); text("sub", "navActiveBg", 4.5);
    text("red", "bg"); text("red", "dangerBg"); text("red", "card");
  });
  test(`${mode}: texto de controles y texto sobre azul / rojo de marca`, () => {
    text("text", "control"); text("sub", "control"); text("onBlue", "blue"); text("onRed", "redBtn"); text("green", "card"); text("green", "bg");
    text("green", "proBadgeBg"); text("deleteBtnDisabledFg", "deleteDisabledBg"); text("deleteWarnText", "card");
  });
  test(`${mode}: borde de controles >= 3:1 contra superficie, fondo y control`, () => {
    for (const bg of ["card", "bg", "control"]) text("borderStrong", bg, 3);
    text("blue", "card", 3); text("blue", "bg", 3);
  });
  test(`${mode}: la superficie se distingue del fondo y el borde sutil existe`, () => {
    assert.notEqual(P.bg, P.card === P.bg ? "" : P.card);
    assert.notEqual(P.border, P.card);
    assert.equal(P.chrome, P.bg, "cabecera y pestañas comparten tono con el fondo (sin cajas anidadas)");
  });
}

test("radios y borde: 2 radios + pill", () => {
  assert.deepEqual(SETTINGS_RADIUS, { rCtrl: 8, rCard: 12, pill: 999 });
});

test("los componentes de Configuracion no llevan hex ni rgba sueltos (solo coachSettingsPalette.js)", () => {
  const files = readdirSync(dir).filter((f) => /\.(jsx|js)$/.test(f) && f !== "coachSettingsPalette.js");
  assert.ok(files.length >= 5);
  for (const f of files) {
    const src = readFileSync(path.join(dir, f), "utf8");
    const hex = src.match(/['"`]#[0-9a-fA-F]{3,8}['"`]|#[0-9a-fA-F]{6}\b|rgba?\(/g);
    assert.equal(hex, null, `${f} contiene colores sueltos: ${hex}`);
  }
});

test("el select de zona horaria tiene chevron propio, appearance none y texto con elipsis", () => {
  const src = readFileSync(path.join(dir, "SettingsPage.jsx"), "utf8");
  assert.match(src, /appearance: 'none'/);
  assert.match(src, /backgroundImage: C\.selectChevron/);
  assert.match(src, /textOverflow: 'ellipsis'/);
  assert.match(palette(true).selectChevron, /^url\("data:image\/svg\+xml/);
});

test("espaciado constante de titulos, placeholder y slider con tokens de la paleta; contenedor a sangre", () => {
  const sh = readFileSync(path.join(dir, "SettingsShell.jsx"), "utf8");
  assert.match(sh, /\.it-stg-root \.it-set-title\{margin-top:26px!important;margin-bottom:10px!important\}/);
  assert.match(sh, /\.it-set-input::placeholder\{color:' \+ pal\.muted/);
  assert.match(sh, /it-set-range::-webkit-slider-thumb/);
  assert.match(sh, /pal\.borderStrong/);
  assert.match(sh, /padding: embed \? '24px 20px 24px 20px'/, "padding lateral derecho simetrico al izquierdo en el area de contenido (>= 768 px)");
  assert.match(sh, /padding: '20px 16px 80px'/, "movil < 768 px sin cambios");
  assert.match(sh, /borderRadius: 0,/, "sin radio exterior en modo embebido");
  assert.doesNotMatch(sh, /boxShadow|88px/, "sin box-shadow de relleno: el fondo continuo lo da AppMainScroll");
  assert.match(readFileSync(path.join(dir, "SettingsFormControls.jsx"), "utf8"), /className="it-set-input"/);
  assert.match(readFileSync(path.join(dir, "SettingsSubscriptionTab.jsx"), "utf8"), /className="it-set-title"/);
});

// SSR de AppMainScroll: el fondo del scroller en Configuracion/Perfil del coach es el de la paleta; el resto, sin cambios.
{
  const { mkdtempSync } = await import("node:fs");
  const os = await import("node:os");
  const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-setbg-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents: 'import React from "react"; import { renderToStaticMarkup } from "react-dom/server"; import AppMainScroll from "./components/layout/AppMainScroll.jsx"; export { React, renderToStaticMarkup, AppMainScroll };',
      resolveDir: ROOT, sourcefile: "setbg-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", alias: { "@": ROOT },
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  const { React, renderToStaticMarkup, AppMainScroll } = await import(pathToFileURL(outfile).href);
  const bgOf = (o) => {
    const html = renderToStaticMarkup(React.createElement(AppMainScroll, {
      showCoachDesktopShell: true, esAlumno: false, tab: "plan", showAlumnoProgressStack: false, coachSuppressTopNav: true,
      coachDesktop1024: false, planScrollDiag: {}, alumnoTopBarFixed: false, alumnoFullScreenShell: false, session: null, activeDay: null,
      darkMode: true, ...o,
    }, "x"));
    return /background:([^;"]+)/.exec(html)[1].trim().toLowerCase();
  };
  test("AppMainScroll: coach + settings/perfil pinta pal.bg (oscuro y claro)", () => {
    for (const tab of ["settings", "perfil"]) for (const dm of [true, false]) {
      assert.equal(bgOf({ tab, darkMode: dm }), palette(dm).bg.toLowerCase(), `${tab} ${dm}`);
    }
  });
  test("AppMainScroll: coach en otras pestanas conserva #0B1120 / #ffffff", () => {
    for (const tab of ["plan", "dashboard", "alumnos", "routines", "biblioteca", "progress", "calendar", "mensajes"]) {
      assert.equal(bgOf({ tab, darkMode: true }), "#0b1120", tab);
      assert.equal(bgOf({ tab, darkMode: false }), "#ffffff", tab);
    }
  });
  test("AppMainScroll: coach sin shell de escritorio o alumno sin cambios", () => {
    assert.equal(bgOf({ showCoachDesktopShell: false, tab: "settings", darkMode: true }), "#0b1120");
    assert.equal(bgOf({ showCoachDesktopShell: false, tab: "settings", darkMode: false }), "#f1f5f9");
    for (const tab of ["settings", "perfil"]) {
      assert.equal(bgOf({ esAlumno: true, showCoachDesktopShell: false, tab, darkMode: true }), "#0b1120");
      assert.equal(bgOf({ esAlumno: true, showCoachDesktopShell: true, tab, darkMode: false }), "#f1f5f9");
    }
    assert.equal(bgOf({ esAlumno: true, showCoachDesktopShell: false, tab: "plan", darkMode: true }), "#0b1220");
    assert.equal(bgOf({ esAlumno: true, showCoachDesktopShell: false, tab: "library", darkMode: true }), "#0b1220");
    assert.equal(bgOf({ esAlumno: true, showCoachDesktopShell: false, tab: "progress", showAlumnoProgressStack: true, darkMode: true }), "#0b1220");
    assert.equal(bgOf({ esAlumno: true, showCoachDesktopShell: false, tab: "plan", darkMode: false }), "#f1f5f9");
  });
}

console.log(`\n${count} pruebas OK`);
