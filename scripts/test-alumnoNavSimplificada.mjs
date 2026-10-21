// Navegacion simplificada del alumno: solo "Plan" visible, sin barra inferior de una pestana, acceso al historial y a los
// ejercicios desde el Plan, chat que no tapa controles, y coach sin cambios.
//
//   node scripts/test-alumnoNavSimplificada.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sale con codigo != 0 en el primer fallo.
// Renderiza los componentes reales con react-dom/server (sin DOM, sin red, sin Supabase, datos sinteticos). El bundle se genera
// en el directorio temporal del sistema, no dentro del repo.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-alnav-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import { selectAppShellLayoutState } from "./lib/appShellLayoutSelectors.js";' +
      'import GlobalBottomNav from "./components/layout/GlobalBottomNav.jsx";' +
      'import AppMainScroll from "./components/layout/AppMainScroll.jsx";' +
      'import StudentHistoryAccess from "./components/student/StudentHistoryAccess.jsx";' +
      'import { ChatFlotante } from "./components/ChatFlotante.jsx";' +
      "export { React, renderToStaticMarkup, selectAppShellLayoutState, GlobalBottomNav, AppMainScroll, StudentHistoryAccess, ChatFlotante };",
    resolveDir: ROOT, sourcefile: "alnav-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, selectAppShellLayoutState, GlobalBottomNav, AppMainScroll, StudentHistoryAccess, ChatFlotante } = await import(pathToFileURL(outfile).href);

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const msg = (es) => es;
const shell = (o) => selectAppShellLayoutState({
  esAlumno: false, readOnly: false, sharedParam: null, alumnoId: null, sessionRole: "entrenador", tab: "plan", coach: false,
  coachDesktop1024: false, session: null, routineDaysLength: 3, darkMode: true, msg,
  planScrollDiag: { headerCollapseOnScroll: false }, ...o,
});
const studentShell = () => shell({ esAlumno: true, sessionRole: "alumno", alumnoId: "alumno-prueba" });
const coachShell = () => shell({ esAlumno: false, sessionRole: "entrenador" });

// ---------------------------------------------------------------- 1. navegacion visible por rol
await test("alumno: la navegacion visible es SOLO 'plan' (sin Ejercicios ni Progreso)", () => {
  const keys = studentShell().tabs2.map((t) => t.k);
  assert.deepEqual(keys, ["plan"]);
  assert.ok(!keys.includes("library") && !keys.includes("progress"));
});

await test("coach: la navegacion NO cambia (7 secciones, incluidas biblioteca y progreso)", () => {
  assert.deepEqual(coachShell().tabs2.map((t) => t.k), ["plan", "calendar", "mensajes", "routines", "biblioteca", "alumnos", "progress"]);
});

// ---------------------------------------------------------------- 2. barra inferior
function renderNav({ width, esAlumno, tabs2, darkMode = true, tab = "plan" }) {
  globalThis.window = { innerWidth: width };
  try { return renderToStaticMarkup(React.createElement(GlobalBottomNav, { darkMode, esAlumno, tabs2, tab, setTab: () => {} })); }
  finally { delete globalThis.window; }
}

await test("alumno: NO se renderiza barra inferior (ni con una sola pestana) en 375, 390, 393, 412, 430 y escritorio", () => {
  const tabs2 = studentShell().tabs2;
  for (const width of [375, 390, 393, 412, 430, 768, 1024, 1440]) {
    assert.equal(renderNav({ width, esAlumno: true, tabs2 }), "", "sin barra a " + width);
  }
});

await test("regresion: con 2 o mas pestanas la barra SI se renderiza (el alumno que tuviera mas de una no pierde la barra); coach sin cambios", () => {
  const two = [{ k: "plan", lbl: "PLAN", icon: () => null }, { k: "x", lbl: "X", icon: () => null }];
  assert.ok(renderNav({ width: 375, esAlumno: true, tabs2: two }).includes("<nav"));
  const coach = coachShell().tabs2;
  assert.ok(!/display:none/.test(renderNav({ width: 768, esAlumno: false, tabs2: coach })), "coach visible a 768");
  assert.ok(/display:none/.test(renderNav({ width: 375, esAlumno: false, tabs2: coach })), "coach oculto <768 (usa el drawer)");
});

// ---------------------------------------------------------------- 3. espacio inferior y chat
const scrollPad = (props) => {
  const html = renderToStaticMarkup(React.createElement(AppMainScroll, {
    showCoachDesktopShell: false, esAlumno: true, tab: "plan", showAlumnoProgressStack: true, coachSuppressTopNav: false, coachDesktop1024: false,
    planScrollDiag: {}, alumnoTopBarFixed: true, alumnoFullScreenShell: true, session: null, activeDay: null, darkMode: true, onScrollNode: () => {}, ...props,
  }, React.createElement("span", null, "x")));
  return /padding-bottom:([^;"]+)/.exec(html)[1];
};

await test("AppMainScroll: sin barra inferior el alumno reserva 112px + area segura (antes 180px por la barra); con barra se mantiene", () => {
  assert.match(scrollPad({ hasBottomNav: false }), /112px.*env\(safe-area-inset-bottom/);
  assert.match(scrollPad({}), /180px.*env\(safe-area-inset-bottom/, "por defecto sigue reservando la barra");
  assert.match(scrollPad({ tab: "library" }), /150px/);
});

const chat = (props) => renderToStaticMarkup(React.createElement(ChatFlotante, {
  alumnoId: "alumno-prueba", alumnoNombre: "Alumno Prueba", sb: {}, esEntrenador: false, darkMode: true, es: true, ...props,
}));

await test("chat: sin barra queda cerca del borde respetando el area segura; con barra sigue sobre ella; oculto durante un entrenamiento", () => {
  const sinBarra = chat({ hasBottomNav: false });
  assert.match(sinBarra, /bottom:calc\(env\(safe-area-inset-bottom, ?0px\) \+ 20px\)/);
  assert.ok(!sinBarra.includes("112px"));
  assert.match(chat({}), /\+ 112px/, "por defecto (con barra) no cambia");
  assert.equal(chat({ hidden: true, hasBottomNav: false }), "", "oculto durante el entrenamiento");
});

// ---------------------------------------------------------------- 4. acceso a historial y ejercicios desde el plan
const baseProps = {
  es: true, darkMode: true, textMain: "#FFFFFF", textMuted: "#8B9AB2", bgCard: "#1E2D40", border: "#2D4057",
  progressProps: { progress: {}, EX: [], allEx: [], sesiones: [], sessionData: { alumnoId: "alumno-prueba" }, sb: {}, sharedParam: Buffer.from(JSON.stringify({ alumnoId: "alumno-prueba" })).toString("base64"), es: true, expectedDaysPerWeek: 3 },
  libraryProps: { allEx: [], darkMode: true, es: true, routines: [], videoOverrides: {}, setVideoModal: () => {}, msg },
};
const access = (extra) => renderToStaticMarkup(React.createElement(StudentHistoryAccess, { ...baseProps, ...extra }));

await test("plan: acceso cerrado = 2 botones ('Historial de entrenamientos' y 'Ejercicios y videos') de >=44px, sin pantalla superpuesta", () => {
  const html = access({});
  assert.equal((html.match(/<button/g) || []).length, 2);
  assert.ok(html.includes("Historial de entrenamientos") && html.includes("Ejercicios y videos"));
  assert.ok(!html.includes('role="dialog"'));
  for (const h of html.matchAll(/min-height:(\d+)px/g)) assert.ok(Number(h[1]) >= 44, "boton de al menos 44px");
});

await test("historial abierto: dialogo accesible (role, aria-modal, nombre), boton Cerrar de 44px, area segura arriba y abajo", () => {
  const html = access({ initialView: "history" });
  assert.match(html, /role="dialog"[^>]*aria-modal="true"[^>]*aria-label="Historial de entrenamientos"/);
  assert.match(html, /aria-label="Cerrar"/);
  assert.match(html, /width:44px;height:44px/);
  assert.ok(html.includes("padding-top:env(safe-area-inset-top, 0px)") || html.includes("padding-top:env(safe-area-inset-top,0px)"));
  assert.ok(/padding:0 0 env\(safe-area-inset-bottom/.test(html), "area segura inferior (el historial trae su propio margen lateral)");
  assert.ok(html.includes("← Volver"), "abre directo en la subvista de sesiones (con boton Volver al resumen)");
  assert.ok(/class="sk /.test(html) || html.includes("Sin sesiones aún"), "muestra la lista de sesiones (esqueleto de carga con datos sinteticos)");
});

await test("ejercicios abierto: dialogo con nombre 'Ejercicios y videos'; el historial no se monta a la vez", () => {
  const html = access({ initialView: "library" });
  assert.match(html, /role="dialog"[^>]*aria-label="Ejercicios y videos"/);
  assert.ok(/padding:16px 20px calc\(24px \+ env\(safe-area-inset-bottom/.test(html), "20px laterales y area segura inferior");
  assert.ok(!html.includes("← Volver") && !/class="sk /.test(html), "el historial no se monta a la vez");
});

await test("el acceso solo LEE: el componente no escribe en localStorage ni llama a Supabase", () => {
  const src = readFileSync(path.join(ROOT, "components/student/StudentHistoryAccess.jsx"), "utf8");
  assert.ok(!/localStorage|sessionStorage|fetch\(|\.from\(|sbFetch|\.insert|\.update|\.delete/.test(src));
});

// ---------------------------------------------------------------- 5. historial: legibilidad
await test("tarjetas del historial: textos secundarios con contraste >= 4.5:1 sobre la tarjeta y mas espacio interno", () => {
  const src = readFileSync(path.join(ROOT, "components/student-progress/ProgressSessionsPanel.jsx"), "utf8");
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const mix = (fg, a, bg) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(fg.slice(i, i + 2), 16) * a + parseInt(bg.slice(i, i + 2), 16) * (1 - a)).toString(16).padStart(2, "0")).join("");
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const alphas = [...src.matchAll(/rgba\(243, ?244, ?246, ?([0-9.]+)\)/g)].map((m) => Number(m[1]));
  assert.ok(alphas.length >= 4);
  for (const a of alphas) {
    assert.ok(ratio(mix("#f3f4f6", a, "#1E2D40"), "#1E2D40") >= 4.5, "alpha " + a + " sobre la tarjeta");
    assert.ok(ratio(mix("#f3f4f6", a, "#162234"), "#162234") >= 4.5, "alpha " + a + " sobre el chip");
  }
  assert.ok(/rounded-\[12px\] border p-4/.test(src) && /border-t px-3 py-4/.test(src), "tarjetas con mas padding");
});

// ---------------------------------------------------------------- 6. cableado en App.jsx
await test("App.jsx: el acceso esta en el plan, el chat recibe la barra/oculto, y una guarda devuelve al alumno al Plan si cae en una pestana oculta", () => {
  const src = readFileSync(path.join(ROOT, "App.jsx"), "utf8");
  assert.match(src, /<StudentHistoryAccess/);
  assert.match(src, /hasBottomNav=\{tabs2\.length > 1\}/);
  assert.match(src, /hasBottomNav=\{tabs2\.length>1\} hidden=\{!!\(session&&activeDay\)\}/);
  assert.match(src, /if \(esAlumno && \(tab === "library" \|\| tab === "progress"\)\) setTab\("plan"\)/);
});

console.log("\n" + count + " pruebas OK");
