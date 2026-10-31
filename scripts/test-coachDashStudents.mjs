// Panel del entrenador, Dashboard y Alumnos (UI): "Atencion hoy" al dia sin CTA, textos de botones = accion real,
// signo del delta, 44 px en movil, tarjeta de alumno y fondo del modal de edicion con cambios sin guardar.
//
//   node scripts/test-coachDashStudents.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, SSR con esbuild + react-dom/server (datos sinteticos).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-dashstu-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachDashboardAttentionCard from "./components/coach/CoachDashboardAttentionCard.jsx";' +
      'import CoachMobileKpiCard from "./components/coach/CoachMobileKpiCard.jsx";' +
      'import CoachEditStudentModal from "./components/coach/CoachEditStudentModal.jsx";' +
      'import AppGlobalStyles from "./components/layout/AppGlobalStyles.jsx";' +
      'import { coachThemePalette } from "./components/coachThemePalette.js";' +
      'import { coachType } from "./components/coachUiScale.js";' +
      "export { React, renderToStaticMarkup, CoachDashboardAttentionCard, CoachMobileKpiCard, CoachEditStudentModal, AppGlobalStyles, coachThemePalette, coachType };",
    resolveDir: ROOT, sourcefile: "dashstu-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, CoachDashboardAttentionCard, CoachMobileKpiCard, CoachEditStudentModal, AppGlobalStyles, coachThemePalette, coachType } = await import(pathToFileURL(outfile).href);
const h = React.createElement;
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
const C = { ...coachThemePalette(true), darkMode: true };
const Icon = () => h("i");
const item = (key, count, cta) => ({ key, Icon, count, color: "#f00", cta, onClick() {}, title: "alumnos", sub: "subtitulo " + key });
const attention = (items) => renderToStaticMarkup(h(CoachDashboardAttentionCard, { title: "ATENCION", items, isMobile: true, dashCard: "#000", dashBorder: "#111", dashCardSoft: "#222", dashMuted: "#94A3B8", colors: C, type: coachType, okLabel: "Al dia" }));

await test("Atencion hoy: cuenta 0 = 'Al dia' atenuado y SIN boton; cuenta > 0 conserva su CTA", () => {
  const html = attention([item("a", 0, "CTA-A"), item("b", 3, "CTA-B")]);
  assert.doesNotMatch(html, /CTA-A/, "sin boton cuando la cuenta es 0");
  assert.doesNotMatch(html, /subtitulo a/, "el subtitulo de accion se reemplaza por el estado al dia");
  assert.match(html, /Al dia/);
  assert.match(html, /data-state="clear"/);
  assert.match(html, /CTA-B/); assert.match(html, /subtitulo b/); assert.match(html, /data-state="pending"/);
  assert.equal((html.match(/<button/g) || []).length, 1);
});

await test("Atencion hoy: el subtitulo usa el gris legible (dashMuted), no t2 (#71717a < 4.5:1 sobre la tarjeta)", () => {
  const html = attention([item("b", 2, "X")]);
  assert.match(html, /color:#94A3B8[^"]*"[^>]*>subtitulo b/);
});

await test("Textos de botones describen la accion real (Dashboard)", () => {
  const src = read("components/CoachDashboard.jsx");
  assert.doesNotMatch(src, /cta: M\(lang, "Enviar mensaje"/, "'Enviar mensaje' navega a Alumnos con filtro");
  assert.doesNotMatch(src, /cta: M\(lang, "Asignar ahora"/, "'Asignar ahora' solo navega a Rutinas");
  assert.match(src, /cta: M\(lang, "Ver alumnos inactivos"/);
  assert.match(src, /cta: M\(lang, "Ir a Rutinas"/);
  assert.match(src, /ctaLabel: accionCtaLabel/);
  assert.doesNotMatch(src, /ctaLabel: accionRecomendada/, "titulo y boton de la recomendacion no comparten cadena");
});

await test("Delta movil: signo correcto (sin '+' cuando es negativo) y flecha/color acordes", () => {
  const src = read("components/CoachDashboard.jsx");
  // D2: el puntaje sintetico "Rendimiento /100" y su delta se eliminaron (no hay delta inventado que mostrar).
  assert.doesNotMatch(src, /rendimientoDeltaPts|rendimientoScore/);
  const kpi = (d) => renderToStaticMarkup(h(CoachMobileKpiCard, { label: "R", value: 50, suffix: "/100", deltaText: d, progress: 50, accent: "#22C55E", colors: C, type: coachType, blockGap: 8 }));
  assert.match(kpi("-3 pts"), /color:#ef4444/); assert.match(kpi("-3 pts"), /lucide-arrow-down/);
  assert.match(kpi("+3 pts"), /color:#22C55E/); assert.match(kpi("+3 pts"), /lucide-arrow-up/);
});

await test("Boton de la recomendacion a 44 px (minHeight inline gana a la regla movil)", () => {
  assert.match(read("components/coach/CoachRecommendationCard.jsx"), /minHeight: 44,/);
});

await test("Movil: campos con .coach-field-tap (44 px) solo < 768; buscador de Alumnos, menu y chips cumplen", () => {
  const css = renderToStaticMarkup(h(AppGlobalStyles, { darkMode: true, bgSub: "#162234", textMain: "#fff", border: "#2D4057" }));
  const media = css.match(/@media \(max-width:767px\)\{[^]*?\}\}/)[0];
  assert.match(media, /\.coach-field-tap\{min-height:44px;box-sizing:border-box\}/);
  const sec = read("components/students/StudentsSection.jsx");
  assert.match(sec, /className="coach-field-tap coach-stu-search" style=\{\{display:"flex",alignItems:"center",gap:10/, "contenedor del buscador");
  assert.match(sec, /type="search"\s+className="coach-stu-search-input"\s+aria-label=/, "input del buscador");
  assert.match(sec, /className="hov coach-tap"\s+aria-pressed=\{sel\}/, "chips de filtro");
  const menu = read("components/students/StudentActionsMenu.jsx");
  assert.equal((menu.match(/className="hov coach-tap"/g) || []).length, 5, "5 items del menu");
  assert.doesNotMatch(menu, /className="hov"/);
});

await test("Tarjeta de alumno: nombre en hasta 2 lineas (no aplastado), expandir/contraer compacto y botones tactiles", () => {
  const card = read("components/students/StudentCard.jsx");
  const css = read("components/layout/AppGlobalStyles.jsx");
  assert.match(css, /\.coach-stu-name\{display:-webkit-box!important;-webkit-line-clamp:2;/); assert.match(css, /overflow-wrap:anywhere/);
  assert.match(card, /className="coach-stu-name"/);
  // VER/CERRAR se reemplazo por el bloque de identidad como control de expandir/contraer (mismo handler onVer).
  assert.doesNotMatch(card, /coach-stu-ver|"CERRAR"/);
  assert.match(card, /data-qa-alumno-toggle[\s\S]*?aria-expanded=\{!!isActive\}[\s\S]*?onClick=\{onVer\}[\s\S]*?minHeight:44/);
  assert.match(card, /aria-label=\{msg\("Más opciones"/);
  assert.match(card, /aria-label=\{msg\("Mensaje a "[\s\S]*?onClick=\{onChat\}/);
  assert.match(card, /var iconBtn = \{width:44,height:44,/);
});

await test("Editar alumno: el fondo NO cierra con cambios sin guardar; con el formulario intacto si", () => {
  const src = read("components/coach/CoachEditStudentModal.jsx");
  assert.match(src, /onClick=\{pristine \? onClose : undefined\}/);
  assert.doesNotMatch(src, /padding:16\}\} onClick=\{onClose\}/);
  const html = renderToStaticMarkup(h(CoachEditStudentModal, { editAlumnoModal: { nombre: "Ana", email: "a@b.c" }, editAlumnoEmail: "otro@b.c", setEditAlumnoEmail() {}, editAlumnoPass: "", setEditAlumnoPass() {}, darkMode: true, bgCard: "#111", border: "#333", textMuted: "#999", inp: {}, onClose() {}, onSave() {} }));
  assert.match(html, /role="dialog"/);
});

await test("Arnes: la fixture usa weeks como array (formato real) para 'Editar ejercicio'", () => {
  const fx = read("scripts/qa/fixtures.mjs");
  assert.doesNotMatch(fx, /weeks: \{\}/);
  assert.match(fx, /weeks: \[0, 1, 2, 3\]\.map/);
});

await test("Alumnos: en escritorio los estilos inline coinciden con main; lo movil vive en media <768", () => {
  const card = read("components/students/StudentCard.jsx");
  // Peso 700 (no extra-bold) desde el ajuste de densidad del PR #130.
  assert.match(card, /className="coach-stu-name" style=\{\{fontSize:17,fontWeight:700,color:textMain,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"\}\}/);
  assert.doesNotMatch(card, /WebkitLineClamp|overflowWrap/);
  const sec = read("components/students/StudentsSection.jsx");
  assert.match(sec, /borderRadius:12,padding:"10px 12px",boxShadow/);
  assert.match(sec, /fontFamily:"inherit",minWidth:0\}\}/);
  assert.doesNotMatch(sec, /padding:"11px 0"/);
  const css = read("components/layout/AppGlobalStyles.jsx");
  const media = css.slice(css.indexOf("@media (max-width:767px)"));
  const end = media.indexOf('" +');
  const block = media.slice(0, end);
  for (const r of [".coach-stu-name{", ".coach-stu-search{padding:0 12px!important}", ".coach-stu-search-input{padding:11px 0!important"]) assert.ok(block.includes(r), r);
  assert.equal(css.replace(block, "").includes(".coach-stu-"), false, "reglas coach-stu-* fuera del media");
});

await test("Alta de alumno: setCreatingAlumno(false) en finally", () => {
  const sec = read("components/students/StudentsSection.jsx");
  assert.match(sec, /try\{\s*setLoadingSB\(true\);[\s\S]*?\}finally\{setCreatingAlumno\(false\);\}/);
});

console.log("\n" + count + " pruebas OK");
