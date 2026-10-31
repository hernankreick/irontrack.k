// Lote 3 UX del coach (movil < 768 px): Calendario, Progreso, Configuracion, Rutinas, drawer y buscador.
//
//   node scripts/test-coachLote3.mjs
//
// node:assert, sin dependencias nuevas. Mezcla SSR (react-dom/server, datos sinteticos) y regex sobre el fuente.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-lote3-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import { Row, Toggle, BtnGroup, SectionTitle } from "./components/settings/SettingsFormControls.jsx";' +
      'import AppGlobalStyles from "./components/layout/AppGlobalStyles.jsx";' +
      'import CoachMobileDrawer from "./components/layout/CoachMobileDrawer.jsx";' +
      'import { buildQuickActions } from "./components/coach/coachDashboardQuickActionsConfig.js";' +
      "export { React, renderToStaticMarkup, Row, Toggle, BtnGroup, SectionTitle, AppGlobalStyles, CoachMobileDrawer, buildQuickActions };",
    resolveDir: ROOT, sourcefile: "lote3-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  alias: { "@": ROOT },
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, Row, Toggle, BtnGroup, SectionTitle, AppGlobalStyles, CoachMobileDrawer, buildQuickActions } = await import(pathToFileURL(outfile).href);

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
const h = React.createElement;
const css = renderToStaticMarkup(h(AppGlobalStyles, { darkMode: true, bgSub: "#111", textMain: "#fff", border: "#222" }));
const media = css.slice(css.indexOf("@media (max-width:767px)"), css.indexOf("@media(min-width:768px)"));

await test("Configuracion: las reglas moviles viven solo dentro del media < 768 px", () => {
  for (const sel of [".it-set-row{flex-direction:column", ".it-set-btn{min-height:44px", ".it-set-select{width:100%;min-height:44px", ".it-set-range{min-height:44px", ".it-set-toggle{width:44px!important;height:44px!important}", ".it-set-title{margin-top:22px", ".it-cal-wrap{padding-right:16px", ".it-cal-grid{gap:2px"]) {
    assert.ok(media.includes(sel), "falta en el media movil: " + sel);
  }
  const fuera = css.replace(media, "");
  assert.ok(!/\.it-set-|\.it-cal-/.test(fuera), "ninguna regla it-set/it-cal fuera del media movil (escritorio y tablet intactos)");
});

await test("Configuracion: Row apila por defecto, `inline` (interruptores) no; Toggle con area 44 y rol switch", () => {
  const stacked = renderToStaticMarkup(h(Row, { label: "Idioma", desc: "d" }, h("span", null, "x")));
  assert.match(stacked, /class="it-set-row"/);
  const inline = renderToStaticMarkup(h(Row, { inline: true, label: "A" }, h(Toggle, { checked: true, onChange() {} })));
  assert.doesNotMatch(inline, /it-set-row/);
  assert.match(inline, /class="it-set-toggle" role="switch" aria-checked="true"/);
  assert.match(inline, /width:40px;height:22px/, "la pista visual sigue en 40 x 22");
  assert.match(inline, /left:21px/, "el pulgar sigue en la misma posicion (activado)");
});

await test("Configuracion: grupos de botones y titulos de seccion llevan clase movil", () => {
  const g = renderToStaticMarkup(h(BtnGroup, { options: [{ id: "a", label: "A" }], value: "a", onChange() {} }));
  assert.match(g, /class="it-set-btngroup"/); assert.match(g, /class="it-set-btn"/);
  assert.match(renderToStaticMarkup(h(SectionTitle, null, "T")), /class="it-set-title"/);
  const page = read("components/settings/SettingsPage.jsx");
  assert.match(page, /className="it-set-select"/, "zona horaria a ancho completo");
  assert.match(page, /className="it-set-range"/);
  assert.match(page, /className="it-set-btn it-set-chip"/, "monedas");
  assert.equal((page.match(/<Row inline /g) || []).length, 2, "los dos Row de interruptores van inline");
});

await test("Configuracion: pestañas moviles con degradado cuando hay pestañas ocultas a la derecha", () => {
  const sh = read("components/settings/SettingsShell.jsx");
  assert.match(sh, /scrollWidth - el\.clientWidth - el\.scrollLeft > 4/);
  assert.match(sh, /onScroll=\{measureTabs\}/);
  assert.match(sh, /data-testid="settings-tabs-fade"/);
  assert.match(sh, /pointerEvents: 'none'/);
  assert.match(sh, /data-tab-active=\{isActive \? '1' : undefined\}/);
  assert.match(sh, /\[isUnder768, active\]/, "la pestaña activa se desplaza a la vista al cambiar");
});

await test("Calendario: 16 px a cada lado en movil, rejilla compacta (dias >= 44 px a 375) y 100dvh en el modal", () => {
  const c = read("components/CoachCalendar.jsx");
  assert.match(c, /className="it-cal-wrap"/); assert.match(c, /className="it-cal-grid"/); assert.match(c, /className="it-cal-body"/);
  assert.ok(media.includes(".it-cal-body{padding:0 8px 14px!important}"));
  // 375 - 2*16 (margen) - 2 (borde tarjeta) - 2*8 (relleno) = 325 px; 7 columnas con gap 2 => (325 - 12) / 7 >= 44
  assert.ok((375 - 32 - 2 - 16 - 6 * 2) / 7 >= 44);
  assert.doesNotMatch(c, /100vh/); assert.match(c, /calc\(100dvh - 32px\)/);
  assert.match(c, /className="hov coach-tap" aria-label=\{M\(lang, "Cerrar"/);
});

await test("Progreso: margen movil 16 px, tarjetas apiladas (sin carrusel cortado), pestañas de periodo >= 44 px", () => {
  const p = read("components/ProgresoView.jsx");
  assert.match(p, /coachSpace as S0/);
  assert.match(p, /pagePadding: 16, headerPadding: "16px 16px"/);
  assert.doesNotMatch(p, /overflowX: "auto"/, "ya no hay carrusel horizontal");
  assert.doesNotMatch(p, /scrollSnapType/);
  assert.match(read("components/progreso/ProgressSummaryCards.jsx"), /isUnder768 \? "repeat\(2, minmax\(0, 1fr\)\)"/, "KPIs en 2 columnas en movil");
  assert.match(p, /padding: isUnder768 \? "20px 16px 32px"/, "16 px laterales en movil");
  assert.match(read("components/progreso/ProgressPeriodPicker.jsx"), /minHeight: compact \? 44 : 56,\s+minWidth: 44,/, "periodo >= 44 px (completo y compacto)");
  const r = read("components/coach/CoachSectionRenderer.jsx");
  assert.match(r, /\(tab === "progress" \|\| tab === "plan"\) && showMobileBar \? \{ paddingTop: 0 \}/, "sin franja bajo la barra superior (Progreso y, desde D5, el Dashboard)");
});

await test("Rutinas: margen lateral unico de 16 px en movil (sin sumar el del contenedor ni los 4 px de la cabecera)", () => {
  const r = read("components/coach/CoachSectionRenderer.jsx");
  assert.match(r, /<div style=\{isUnder768 \? \{ \.\.\.mobilePad, paddingLeft: 0, paddingRight: 0 \} : mobilePad\}>\s*<CoachRoutinesMain/);
  const css2 = read("components/routines/routines-ui.css");
  assert.match(css2, /@media \(max-width: 767px\) \{\s*\.it-routines-top-wrap \{\s*padding-left: 0;\s*padding-right: 0;/);
  assert.match(css2, /\.it-routines-top-wrap \{\s*padding-left: 4px;/, "escritorio y tablet conservan los 4 px");
});

await test("Drawer: el item activo usa un azul con contraste >= 4,5:1 sobre el fondo del drawer", () => {
  const lum = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  assert.ok(ratio("#60A5FA", "#111827") >= 4.5 + 1, "modo oscuro");
  assert.ok(ratio("#1D4ED8", "#FFFFFF") >= 4.5, "modo claro");
  const html = renderToStaticMarkup(h(CoachMobileDrawer, { open: true, activeTab: "plan", sessionData: { name: "C" }, msg: (es) => es, mobileDrawerRef: { current: null }, onClose() {}, onNavigate() {}, onLogout() {}, coachInitials: "C", darkMode: true }));
  assert.match(html, /color:#60A5FA/); assert.doesNotMatch(html, /color:#3B82F6/);
});

await test("Dashboard: la accion rapida 'message' dice lo que hace (abre Alumnos) y el buscador acorta el placeholder en movil", () => {
  const q = buildQuickActions("es", true).find((a) => a.action === "message");
  assert.equal(q.title, "Contactar alumnos"); assert.doesNotMatch(q.title + q.sub, /Enviar mensaje|equipo/);
  // D5: el buscador vive en el encabezado del Dashboard nuevo; en movil (< 1024) el placeholder sigue acortado.
  assert.match(read("components/coach/CoachDashboardD5.jsx"), /placeholder=\{desk \? "Buscar alumno, rutina, ejercicio\.\.\." : "Buscar…"\}/);
});

console.log(count + " pruebas ok");
