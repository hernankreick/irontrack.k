// Onboarding pasos 2-5 (perfil, nombre, alumnos, final): shell compartido, zona segura, scroll interno, botones fuera del scroll,
// teclado (visualViewport) y flujos intactos. Aserciones sobre el fuente + render real con react-dom/server.
//   node scripts/test-onboardingResponsive.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const prim = read("components/onboarding/OnboardingPrimitives.jsx");
const screen = read("components/onboarding/OnboardingScreen.jsx");
const css = read("index.css");
const steps = {
  perfil: read("components/onboarding/OnboardingStep1.jsx"),
  nombre: read("components/onboarding/OnboardingStep2Name.jsx"),
  alumnos: read("components/onboarding/OnboardingStep3Alumnos.jsx"),
  final: read("components/onboarding/OnboardingStepFinal.jsx"),
};
const step0 = read("components/onboarding/OnboardingStep0.jsx");

// ---- Shell compartido (fuente) ----
const shell = prim.slice(prim.indexOf("export const OnboardingShell"), prim.indexOf("export const LandingStepDots4"));
assert.match(shell, /position: "fixed",\s*left: 0,\s*right: 0,\s*top: "var\(--onb-vt, 0px\)",\s*height: "var\(--onb-vh, 100%\)"/, "raiz fixed sobre el area visible (100% por defecto)");
assert.match(shell, /data-onb-root=""/);
assert.match(shell, /overflow: "hidden"/);
assert.match(shell, /const SAFE_TOP = "var\(--it-safe-top, env\(safe-area-inset-top, 0px\)\)"|data-onb-top/);
assert.match(prim, /const SAFE_TOP = "var\(--it-safe-top, env\(safe-area-inset-top, 0px\)\)"/, "zona segura superior");
assert.match(shell, /data-onb-top="" style=\{\{ flexShrink: 0, height: SAFE_TOP/, "espaciador de zona segura fuera del scroll");
const iScroll = shell.indexOf("data-onb-scroll"), iBottom = shell.indexOf("data-onb-bottom");
assert.ok(iScroll > 0 && iBottom > iScroll, "bloque inferior hermano posterior al scroll");
const scrollSrc = shell.slice(iScroll, iBottom);
assert.match(scrollSrc, /flex: 1,\s*minHeight: 0,\s*overflowY: "auto"/, "scroll interno");
assert.match(scrollSrc, /overscrollBehavior: "contain"/);
assert.match(scrollSrc, /WebkitOverflowScrolling: "touch"/);
assert.match(scrollSrc, /16px"/, "padding-bottom del contenido 16 px (holgura >= 8 px)");
assert.match(shell.slice(iBottom), /flexShrink: 0/);
assert.match(shell.slice(iBottom), /padding: "8px 0 max\(12px, env\(safe-area-inset-bottom, 0px\)\)"/, "safe-area inferior");
assert.ok(!/minHeight: "100(s|d)?vh"/.test(shell), "el shell no usa min-height 100vh/svh/dvh");
// Teclado.
assert.match(prim, /window\.visualViewport/);
assert.match(prim, /vv\.addEventListener\("resize"/);
assert.match(prim, /vv\.addEventListener\("scroll"/);
assert.match(prim, /--onb-vh/);
assert.match(prim, /--onb-vt/);
assert.match(prim, /scrollIntoView\(\{ block: "center" \}\)/, "el input enfocado se lleva al centro");
assert.match(prim, /removeProperty\("--onb-vh"\)/, "sin teclado vuelve al layout normal");
assert.match(css, /\[data-onb-kb\] \[data-onb-kb-hide\]\s*\{\s*display: none !important/, "con teclado se oculta el progreso");

// ---- Cada paso 2-5 usa el shell y no depende de 100svh ----
for (const [name, src] of Object.entries(steps)) {
  assert.match(src, /<OnboardingShell/, `${name}: usa OnboardingShell`);
  assert.ok(!/100svh|100dvh|minHeight: "100vh"/.test(src), `${name}: sin 100svh/100dvh/100vh`);
  assert.ok(!/overflow: "hidden"/.test(src.replace(/overflow: "hidden", textOverflow/g, "")), `${name}: sin raiz propia con overflow hidden`);
  assert.match(src, /bottom=\{/, `${name}: bloque inferior por el prop bottom (fuera del scroll)`);
}
assert.ok(!/svh/.test(Object.values(steps).join("")), "sin unidades svh en pasos 2-5");
// El botón principal/navegación está en `bottom`, no en el contenido con scroll.
assert.ok(steps.nombre.indexOf("Crear mi perfil") < steps.nombre.indexOf("TU IDENTIDAD PROFESIONAL"), "nombre: boton en el prop bottom");
assert.ok(steps.alumnos.indexOf("Seleccioná una opción") < steps.alumnos.indexOf("Tu situación actual"), "alumnos: boton en el prop bottom");
assert.ok(steps.final.indexOf("Ir a mi panel") < steps.final.indexOf("Todo listo,"), "final: CTA en el prop bottom");
assert.ok(steps.perfil.indexOf("Continuar como entrenador") < steps.perfil.indexOf("TU PERFIL"), "perfil: boton en el prop bottom");
// IR A MI PANEL: fila flex con el alto uniforme del resto de CTAs y atras con objetivo tactil >= 44 px.
assert.match(steps.final, /display:"flex",flexDirection:"row",width:"100%",height:BTN_H\}\}>\s*<BtnPrimary/, "CTA final en fila flex a ancho completo con BTN_H");
assert.match(steps.final, /height:44\}\}>\s*Atrás/, "Atras del final >= 44 px");
// Perfil compacto por vh, sin padding desproporcionado.
assert.match(steps.perfil, /cardPad = "clamp\(12px, 2vh, 18px\)/);
assert.match(steps.perfil, /role="button"/);
assert.match(steps.alumnos, /role="button"/);
assert.match(css, /\.onb-hide-short/);
// Paso del nombre: foco y Enter intactos.
assert.match(steps.nombre, /inputRef\.current\?\.focus\(\)/);
assert.match(steps.nombre, /e\.key==="Enter"&&nm&&onNext\(\)/);
assert.match(steps.nombre, /minHeight: 52/, "input >= 52 px");

// ---- Flujos intactos (OnboardingScreen) ----
assert.match(screen, /if \(step === 2 && !isCoach\) setStep\(4\)/, "atleta salta alumnos");
assert.match(screen, /if \(step === 4 && !isCoach\) setStep\(2\)/, "atras del atleta vuelve al nombre");
assert.match(screen, /4: <StepFinal\s+onDone=\{onDone\}\s+onBack=\{back\}/);
assert.match(screen, /minHeight: "100dvh"/, "OnboardingScreen sin cambios de layout");

// ---- Paso 1 (landing) intacto ----
assert.match(step0, /position: "fixed",\s*inset: 0,\s*height: "100%"/);
assert.match(step0, /data-onb-scroll/);
assert.match(step0, /data-onb-bottom/);

// ---- Render real (SSR) ----
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-onbresp-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import Step1 from "./components/onboarding/OnboardingStep1.jsx";' +
      'import Step2Name from "./components/onboarding/OnboardingStep2Name.jsx";' +
      'import Step3Alumnos from "./components/onboarding/OnboardingStep3Alumnos.jsx";' +
      'import StepFinal from "./components/onboarding/OnboardingStepFinal.jsx";' +
      "export { React, renderToStaticMarkup, Step1, Step2Name, Step3Alumnos, StepFinal };",
    resolveDir: ROOT, sourcefile: "onbresp-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, Step1, Step2Name, Step3Alumnos, StepFinal } = await import(pathToFileURL(outfile).href);
const noop = () => {};
const html = {
  perfil: renderToStaticMarkup(React.createElement(Step1, { onNext: noop, onBack: noop, role: "entrenador", setRole: noop })),
  nombre: renderToStaticMarkup(React.createElement(Step2Name, { onNext: noop, onBack: noop, role: "entrenador", name: "Hernán", setName: noop })),
  alumnos: renderToStaticMarkup(React.createElement(Step3Alumnos, { onNext: noop, onBack: noop, alumnosRange: "5-10", setAlumnosRange: noop })),
  final: renderToStaticMarkup(React.createElement(StepFinal, { onDone: noop, onBack: noop, role: "entrenador", name: "Hernán", alumnosRange: "5-10" })),
};
const must = {
  perfil: ["Continuar como entrenador", "TU PERFIL", "Entrenador", "Atleta", "Paso 2 de 3", "Atrás"],
  nombre: ["Crear mi perfil", "TU IDENTIDAD PROFESIONAL", "Paso 3 de 3", "Atrás", "HERNÁN"],
  alumnos: ["Continuar", "TU SITUACIÓN ACTUAL".toLowerCase(), "1 — 5 alumnos", "Más de 10 alumnos", "Atrás"],
  final: ["Ir a mi panel", "Todo listo,", "Tu panel en IronTrack", "5 a 10 alumnos", "Atrás"],
};
for (const [name, h] of Object.entries(html)) {
  const r = h.indexOf("data-onb-root"), s = h.indexOf("data-onb-scroll"), b = h.indexOf("data-onb-bottom");
  assert.ok(r >= 0 && s > r && b > s, `${name}: raiz > scroll > bloque inferior`);
  assert.equal((h.match(/data-onb-root/g) || []).length, 1, `${name}: una sola raiz`);
  assert.match(h, /position:fixed;left:0;right:0;top:var\(--onb-vt, 0px\);height:var\(--onb-vh, 100%\)/, `${name}: raiz fixed`);
  assert.match(h, /height:var\(--it-safe-top, env\(safe-area-inset-top, 0px\)\)/, `${name}: zona segura superior`);
  const scrollHtml = h.slice(s, b), bottomHtml = h.slice(b);
  assert.match(scrollHtml.slice(0, 400), /overflow-y:auto/, `${name}: scroll interno`);
  assert.match(bottomHtml.slice(0, 400), /max\(12px, env\(safe-area-inset-bottom, 0px\)\)/, `${name}: safe-area inferior`);
  assert.ok(!/100svh|100dvh|min-height:100vh/.test(h), `${name}: sin 100svh/dvh`);
  for (const t of must[name]) assert.ok(h.toLowerCase().includes(t.toLowerCase()), `${name}: texto "${t}"`);
}
// Boton principal / navegacion dentro del bloque inferior, nunca dentro del scroll.
assert.ok(html.final.slice(html.final.indexOf("data-onb-bottom")).includes("Ir a mi panel"), "final: CTA en el bloque inferior");
assert.ok(!html.final.slice(html.final.indexOf("data-onb-scroll"), html.final.indexOf("data-onb-bottom")).includes("Ir a mi panel"), "final: CTA fuera del scroll");
assert.ok(html.nombre.slice(html.nombre.indexOf("data-onb-bottom")).includes("Crear mi perfil"), "nombre: boton en el bloque inferior");
assert.ok(html.alumnos.slice(html.alumnos.indexOf("data-onb-bottom")).includes("Continuar"), "alumnos: boton en el bloque inferior");
assert.ok(html.perfil.slice(html.perfil.indexOf("data-onb-bottom")).includes("Continuar como entrenador"), "perfil: boton en el bloque inferior");
// Cada tarjeta es un role=button alcanzable por teclado.
assert.equal((html.perfil.match(/role="button"/g) || []).length, 2, "perfil: 2 tarjetas role=button");
assert.equal((html.alumnos.match(/role="button"/g) || []).length, 3, "alumnos: 3 tarjetas role=button");
// CTA del final: fila flex de ancho completo, alto BTN_H (58).
assert.match(html.final, /display:flex;flex-direction:row;width:100%;height:58px"><button/, "final: CTA en fila flex 100% x 58 px");

// Zonas seguras laterales (horizontal con notch) y foco visible por teclado en las tarjetas.
assert.match(html.perfil, /padding-left:env\(safe-area-inset-left, ?0px\);padding-right:env\(safe-area-inset-right, ?0px\)/, "shell: safe-area lateral");
assert.match(readFileSync(new URL("../index.css", import.meta.url), "utf8"), /\[data-onb-root\] \[role="button"\]:focus-visible/, "index.css: foco visible en tarjetas");

console.log("test-onboardingResponsive: OK");
