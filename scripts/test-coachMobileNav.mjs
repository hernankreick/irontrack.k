// UI/UX movil del entrenador: boton de menu SIEMPRE visible < 768 px, drawer accesible, zoom/foco en iOS y areas tactiles.
//
//   node scripts/test-coachMobileNav.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert. Renderiza componentes reales con react-dom/server
// (sin DOM, sin red, sin Supabase, datos sinteticos); el bundle se genera en el directorio temporal del sistema.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-coachmob-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachMobileTopBar from "./components/layout/CoachMobileTopBar.jsx";' +
      'import CoachMobileDrawer from "./components/layout/CoachMobileDrawer.jsx";' +
      'import AppHeaderBrand from "./components/layout/AppHeaderBrand.jsx";' +
      'import AppGlobalStyles from "./components/layout/AppGlobalStyles.jsx";' +
      "export { React, renderToStaticMarkup, CoachMobileTopBar, CoachMobileDrawer, AppHeaderBrand, AppGlobalStyles };",
    resolveDir: ROOT, sourcefile: "coachmob-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, CoachMobileTopBar, CoachMobileDrawer, AppHeaderBrand, AppGlobalStyles } = await import(pathToFileURL(outfile).href);

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
const msg = (es) => es;
const h = React.createElement;
const noop = () => {};

await test("barra movil del entrenador: boton de menu visible de 44x44 con nombre accesible, estado y titulo de la seccion", () => {
  const html = renderToStaticMarkup(h(CoachMobileTopBar, { tab: "alumnos", darkMode: true, msg, menuOpen: false, onOpenMenu: noop }));
  assert.match(html, /^<header /);
  assert.match(html, /aria-label="Abrir menú"/); assert.match(html, /aria-haspopup="dialog"/); assert.match(html, /aria-expanded="false"/);
  assert.match(html, /width:44px;height:44px/);
  assert.match(html, />Alumnos</, "muestra la seccion actual");
  assert.match(html, /position:sticky;top:0/); assert.match(html, /env\(safe-area-inset-top, 0px\)/);
  const open = renderToStaticMarkup(h(CoachMobileTopBar, { tab: "plan", darkMode: false, msg, menuOpen: true, onOpenMenu: noop }));
  assert.match(open, /aria-expanded="true"/); assert.match(open, />Dashboard</);
});

await test("barra movil: titulo para las 9 secciones del coach y en ingles", () => {
  const es = { plan: "Dashboard", progress: "Progreso", calendar: "Calendario", mensajes: "Mensajes", routines: "Rutinas", biblioteca: "Ejercicios", alumnos: "Alumnos", settings: "Configuración", perfil: "Mi perfil" };
  for (const [tab, label] of Object.entries(es)) {
    assert.match(renderToStaticMarkup(h(CoachMobileTopBar, { tab, darkMode: true, msg, menuOpen: false, onOpenMenu: noop })), new RegExp(">" + label + "<"), tab);
  }
  const en = renderToStaticMarkup(h(CoachMobileTopBar, { tab: "alumnos", darkMode: true, msg: (a, b) => b, menuOpen: false, onOpenMenu: noop }));
  assert.match(en, /aria-label="Open menu"/); assert.match(en, />Athletes</);
});

const drawer = (o) => renderToStaticMarkup(h(CoachMobileDrawer, { open: false, activeTab: "alumnos", sessionData: { name: "Coach Demo" }, msg, mobileDrawerRef: { current: null }, onClose: noop, onNavigate: noop, onLogout: noop, coachInitials: "CD", darkMode: true, ...o }));

await test("drawer cerrado: fuera del foco y de los lectores de pantalla (inert + aria-hidden), sin role=dialog", () => {
  const html = drawer({ open: false });
  assert.match(html, /aria-hidden="true"/); assert.match(html, /inert=""/);
  assert.ok(!/role="dialog"/.test(html));
});

await test("drawer abierto: role=dialog, aria-modal, nombre, boton Cerrar de 44x44, sin inert", () => {
  const html = drawer({ open: true });
  assert.match(html, /role="dialog"/); assert.match(html, /aria-modal="true"/); assert.match(html, /aria-label="Menú de navegación"/);
  assert.ok(!/inert=""/.test(html) && !/aria-hidden="true"/.test(html.split("<button")[0]));
  assert.match(html, /aria-label="Cerrar menú"/); assert.match(html, /width:44px;height:44px/);
});

await test("drawer: cada seccion es un <button> de >= 48 px con aria-current en la activa (antes eran <div onClick>)", () => {
  const html = drawer({ open: true, activeTab: "routines" });
  const items = html.match(/<button type="button" aria-current="page"[^>]*>/g) || [];
  assert.equal(items.length, 1, "solo la seccion activa lleva aria-current");
  assert.match(items[0], /min-height:48px/);
  for (const label of ["Dashboard", "Calendario", "Mensajes", "Alumnos", "Rutinas", "Ejercicios", "Progreso", "Mi perfil", "Configuración", "Cerrar sesión"]) {
    assert.ok(html.includes(">" + label + "<"), label);
  }
  const btns = html.match(/<button [^>]*>/g) || [];
  assert.ok(btns.length >= 11, "cierre + 7 secciones + 2 de perfil + cerrar sesion");
  const src = read("components/layout/CoachMobileDrawer.jsx");
  assert.ok(!/<div\s+key=\{item\.k\}\s+onClick/.test(src), "no quedan filas navegables como <div onClick>");
});

await test("drawer: etiquetas de seccion legibles (>= 11 px, sin el gris #374151 sobre #111827)", () => {
  const html = drawer({ open: true });
  assert.ok(!html.includes("#374151"));
  assert.ok(!/font-size:9px/.test(html));
  assert.match(html, />PRINCIPAL</);
});

await test("drawer: foco al abrir, Escape, trampa de Tab y foco devuelto (cableado)", () => {
  const src = read("components/layout/CoachMobileDrawer.jsx");
  assert.match(src, /closeRef\.current\.focus\(\)/); assert.match(src, /e\.key === "Escape"/); assert.match(src, /e\.key !== "Tab"/);
  assert.match(src, /last\.focus\(\)/); assert.match(src, /first\.focus\(\)/); assert.match(src, /el\.focus\(\)/);
  assert.match(src, /openerRef\.current = document\.activeElement/);
});

await test("hamburguesa 768-1023 px: 44x44 con nombre accesible", () => {
  const html = renderToStaticMarkup(h(AppHeaderBrand, { showCoachDesktopShell: true, coachDesktop1024: false, darkMode: true, esAlumno: false, readOnly: false, sessionData: { name: "Coach Demo" }, msg, onOpenMobileDrawer: noop }));
  assert.match(html, /aria-label="Abrir menú"/); assert.match(html, /width:44px;height:44px/);
  assert.match(html, /type="button"/);
});

await test("cableado: la barra movil solo aparece para el entrenador < 768 y el menu se abre desde App.jsx; el espaciado no duplica el area segura", () => {
  const r = read("components/coach/CoachSectionRenderer.jsx");
  assert.match(r, /const showMobileBar = isCoach && isUnder768 && showCoachDesktopShell && !coachDesktop1024/);
  assert.match(r, /\{showMobileBar && \(\s*<CoachMobileTopBar/);
  assert.match(r, /paddingTop: showMobileBar \? 16 :/);
  assert.match(r, /"--coach-safe-top": showMobileBar \? "0px" : undefined/);
  assert.match(read("components/coach/CoachMessagesMain.jsx"), /var\(--coach-safe-top, env\(safe-area-inset-top, 0px\)\)/);
  assert.match(read("App.jsx"), /onOpen: function \(\) \{ setMobileDrawerOpen\(true\); \}/);
});

await test("el alumno y el resto no cambian: GlobalBottomNav sigue ocultando la barra del coach < 768 y el gesto de borde se conserva", () => {
  const nav = read("components/layout/GlobalBottomNav.jsx");
  assert.match(nav, /\(isUnder768 && !esAlumno\) \? "none" : "flex"/);
  const app = read("App.jsx");
  assert.match(app, /fromLeft > 40/);
});

await test("iOS: el viewport permite zoom (sin maximum-scale ni user-scalable=no) y los campos tienen 16 px en movil", () => {
  const html = read("index.html");
  const vp = html.match(/<meta name="viewport"[^>]*>/)[0];
  assert.ok(!/maximum-scale/.test(vp) && !/user-scalable/.test(vp), vp);
  assert.match(vp, /viewport-fit=cover/); assert.match(vp, /initial-scale=1\.0/);
  const css = renderToStaticMarkup(h(AppGlobalStyles, { darkMode: true, bgSub: "#162234", textMain: "#fff", border: "#2D4057" }));
  assert.match(css, /@media \(max-width:767px\)\{\.coach-tap,\.cd-btn\{min-height:44px;min-width:44px\}/);
  assert.match(css, /select,textarea\{font-size:16px!important\}/);
  assert.match(css, /:not\(\[type=checkbox\]\):not\(\[type=radio\]\)/, "no toca checkbox/radio/range/file");
});

await test("areas tactiles del panel del coach (< 768 px): VER, menu de opciones, filtros, CREAR y 'Ver todos' llevan coach-tap", () => {
  assert.equal((read("components/students/StudentCard.jsx").match(/hov coach-tap/g) || []).length, 2);
  assert.match(read("components/students/StudentsSection.jsx"), /className="hov coach-tap"\s+aria-pressed=\{sel\}/);
  assert.match(read("components/GlobalCreateMenu.jsx"), /className="coach-tap"/);
  assert.match(read("components/coach/CoachActiveStudentsCard.jsx"), /className="coach-tap"/);
});

console.log("\n" + count + " pruebas OK");
