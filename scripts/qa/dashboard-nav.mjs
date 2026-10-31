// QA de navegacion del Dashboard del entrenador (D4) sobre la app REAL compilada, con datos FICTICIOS (host simulado, sin Supabase ni red).
// Uso:  node scripts/qa/dashboard-nav.mjs [--dist <dir>] [--widths 375,390,430,1280] [--out <carpeta>]
// Escenario QA_DASH_NAV (fixtures.mjs): Ana inactiva, Beto con baja actividad (entreno hace 15 dias), Cami sin rutina (con una sesion de HOY
// sin rutina, para que aparezca en «Actividad reciente»: Beto, hace 15 dias, queda fuera de la ventana de 14 dias).
// Dashboard D5. Por cada ancho verifica: cada fila de «Requieren seguimiento» (Sin rutina / Inactivos / Baja actividad) lleva a Alumnos con
// SU filtro y solo el alumno esperado (sin filtros ni busquedas heredados); «Ver alumnos» (Actividad reciente y Acciones rapidas) limpia
// filtro y busqueda; una fila de «Actividad reciente» (Cami) abre su ficha, visible en pantalla y con filtro Todos; ida y vuelta
// Dashboard <-> Alumnos; filas/botones de 44 px en movil; la busqueda real (icono en movil); y Seguimiento «Sin rutina» -> ficha de Cami ->
// «Asignar rutina» de la ficha abre el dialogo existente de asignacion. (Los botones «Asignar rutina» / «Mensaje» por fila de la tabla
// «Mis alumnos» ya no existen: la asignacion sigue en la ficha; el chat, en la campana y en Mensajes.)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

process.env.QA_DASH_NAV = "1";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SIZES = { 375: 667, 390: 844, 430: 932, 1280: 800 };

const o = { widths: [375, 390, 430, 1280] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}

if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-dashnav-"));
  const r = spawnSync("npx", ["vite", "build", "--outDir", o.dist, "--emptyOutDir"], {
    cwd: ROOT, stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" },
  });
  if (r.status !== 0) throw new Error("El build de QA fallo");
}
if (o.out) fs.mkdirSync(o.out, { recursive: true });

const { chromium } = await resolvePlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });
const { server, port } = await serve(o.dist);
const fails = [];
let checks = 0;
function check(cond, msg) { checks++; if (!cond) fails.push(msg); }

// ---- helpers dentro de la pagina ----
const clickText = (page, text, scope) => page.evaluate(({ text, scope }) => {
  const root = scope ? document.querySelector(scope) : document;
  const els = [...(root || document).querySelectorAll("button,[role=button]")].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && (e.innerText || "").replace(/\s+/g, " ").trim() === text;
  });
  if (!els.length) return null;
  const r = els[0].getBoundingClientRect();
  els[0].click();
  return { w: r.width, h: r.height };
}, { text, scope });
const alumnosState = (page) => page.evaluate(() => {
  const chips = [...document.querySelectorAll("button[aria-pressed]")].map((b) => ({ t: (b.innerText || "").trim(), on: b.getAttribute("aria-pressed") === "true" }));
  const cards = [...document.querySelectorAll("[data-alumno-id]")].map((c) => ({ id: c.getAttribute("data-alumno-id"), open: c.getAttribute("data-qa-alumno-card") === "open", text: ["Ana Prueba", "Beto Prueba", "Cami Prueba"].find((n) => (c.innerText || "").includes(n)) || "", top: c.getBoundingClientRect().top }));
  const search = document.querySelector('input[aria-label="Buscar alumno"]');
  return { chips, cards, search: search ? search.value : null, vh: innerHeight, title: !!document.querySelector("body") && document.body.innerText.includes("MIS ALUMNOS") };
});
const chipOn = (st) => (st.chips.find((c) => c.on) || {}).t || "";
const names = (st) => st.cards.map((c) => c.text).join(", ");

for (const width of o.widths) {
  const mobile = width < 768;
  const { ctx, page, state } = await openPage(browser, { port, width, height: SIZES[width] || 900, touch: mobile });
  const tag = "@" + width;
  async function toDashboard() { check(await gotoSection(page, "Dashboard", width), tag + " navegar a Dashboard"); await page.waitForTimeout(600); }
  await page.waitForTimeout(1500);

  // ---- filas de «Requieren seguimiento» -> Alumnos con su filtro ----
  for (const [cta, chip, esperado] of [
    ["Inactivos", "Inactivos", "Ana Prueba"],
    ["Sin rutina", "Sin rutina", "Cami Prueba"],
    ["Baja actividad", "Baja actividad", "Beto Prueba"],
  ]) {
    await toDashboard();
    const r = await page.evaluate((cta) => {
      const el = [...document.querySelectorAll('[data-qa="d5-seguimiento"] button')].find((b) => (b.innerText || "").trim().startsWith(cta));
      if (!el) return null;
      const q = el.getBoundingClientRect(); el.click(); return { w: q.width, h: q.height };
    }, cta);
    check(!!r, tag + " existe la fila '" + cta + "' en Requieren seguimiento");
    if (r && mobile) check(r.h >= 43.5, tag + " fila '" + cta + "' >= 44 px (" + r.h + ")");
    await page.waitForTimeout(900);
    const st = await alumnosState(page);
    check(chipOn(st).startsWith(chip), tag + " '" + cta + "' -> filtro '" + chip + "' (activo: '" + chipOn(st) + "')");
    check(st.cards.length === 1 && names(st) === esperado, tag + " '" + cta + "' muestra solo " + esperado + " (muestra: " + names(st) + ")");
  }

  // ---- «Ver alumnos» limpia filtro y busqueda heredados (Actividad reciente y Acciones rapidas) ----
  for (const donde of ["d5-ver-alumnos", "d5-accion-alumnos"]) {
    const hayBusqueda = await page.$('input[aria-label="Buscar alumno"]');
    check(!!hayBusqueda, tag + " buscador de Alumnos visible");
    if (hayBusqueda) await page.fill('input[aria-label="Buscar alumno"]', "zzz");
    await page.waitForTimeout(300);
    await toDashboard();
    const ok = await page.evaluate((qa) => { const b = document.querySelector('[data-qa="' + qa + '"]'); if (!b) return false; b.click(); return true; }, donde);
    check(ok, tag + " existe " + donde);
    await page.waitForTimeout(900);
    const st = await alumnosState(page);
    check(chipOn(st).startsWith("Todos") && st.search === "" && st.cards.length === 3, tag + " " + donde + " -> Todos, sin busqueda, 3 alumnos (" + chipOn(st) + " / '" + st.search + "' / " + st.cards.length + ")");
    await clickText(page, "Sin rutina (1)"); // deja un filtro heredado para la siguiente verificacion
    await page.waitForTimeout(300);
  }

  // ---- Perfil: una fila de «Actividad reciente» abre la ficha del alumno correcto, aunque hubiera un filtro que lo excluya ----
  await toDashboard();
  const abre = await page.evaluate(() => {
    const row = document.querySelector('[data-qa="d5-reciente"][data-alumno-id]');
    if (!row) return null;
    const q = row.getBoundingClientRect(); row.click(); return { id: row.getAttribute("data-alumno-id"), h: q.height, txt: row.innerText };
  });
  check(!!abre && /Cami Prueba/.test(abre.txt), tag + " 'Actividad reciente' lista a Cami (sesion de hoy)");
  if (abre && mobile) check(abre.h >= 43.5, tag + " fila de actividad reciente >= 44 px (" + abre.h + ")");
  await page.waitForTimeout(1600);
  let st = await alumnosState(page);
  const cami = st.cards.find((c) => c.text === "Cami Prueba");
  check(chipOn(st).startsWith("Todos"), tag + " Perfil -> filtro Todos (no hereda 'Sin rutina')");
  check(!!(cami && cami.open), tag + " Perfil abre la ficha de Cami");
  check(!!(cami && cami.top >= -2 && cami.top < st.vh), tag + " la ficha de Cami queda a la vista (top " + (cami && Math.round(cami.top)) + ")");

  // ---- ida y vuelta: volver al Dashboard y otra vez a Alumnos conserva el flujo ----
  await toDashboard();
  const back = await page.evaluate(() => document.body.innerText.includes("Requieren seguimiento") && document.body.innerText.includes("Actividad reciente"));
  check(back, tag + " volver al Dashboard muestra Requieren seguimiento y Actividad reciente");

  // ---- busqueda real: icono de 44x44 en movil (despliega el buscador); inline en escritorio ----
  if (mobile) {
    const bb = await page.evaluate(() => { const b = document.querySelector('button[aria-label="Buscar"]'); if (!b) return null; const q = b.getBoundingClientRect(); b.click(); return { w: q.width, h: q.height }; });
    check(!!bb && bb.w >= 43.5 && bb.h >= 43.5, tag + " boton Buscar de 44x44 (" + (bb && bb.w + "x" + bb.h) + ")");
    await page.waitForTimeout(300);
    check(!!(await page.$('[data-qa="d5-buscar-panel"] input')), tag + " Buscar despliega el buscador real");
  } else {
    check(!!(await page.$('[data-qa="d5-buscar-inline"] input')), tag + " buscador real inline en escritorio");
  }

  // ---- asignacion: Seguimiento «Sin rutina» -> Alumnos filtrado -> ficha de Cami -> «Asignar rutina» de la ficha abre el dialogo existente ----
  // (el boton «Asignar rutina» por fila de la tabla «Mis alumnos» ya no existe; la asignacion sigue en la ficha)
  await toDashboard();
  await page.evaluate(() => { const el = [...document.querySelectorAll('[data-qa="d5-seguimiento"] button')].find((b) => (b.innerText || "").trim().startsWith("Sin rutina")); if (el) el.click(); });
  await page.waitForTimeout(900);
  await page.evaluate(() => { const c = document.querySelector('[data-alumno-id] [data-qa-alumno-toggle]') || document.querySelector('[data-alumno-id]'); if (c && c.getAttribute && c.closest('[data-qa-alumno-card]') && c.closest('[data-qa-alumno-card]').getAttribute('data-qa-alumno-card') !== 'open') c.click(); });
  await page.waitForTimeout(900);
  const asignar = await clickText(page, "Asignar rutina");
  check(!!asignar, tag + " la ficha de Cami tiene el boton 'Asignar rutina'");
  await page.waitForTimeout(1200);
  st = await alumnosState(page);
  check(!!st.cards.find((c) => c.text === "Cami Prueba" && c.open), tag + " la ficha de Cami esta abierta");
  const dlg = await page.evaluate(() => document.body.innerText.includes("Asignar rutina: Rutina local QA a Cami Prueba"));
  check(dlg, tag + " 'Asignar rutina' de la ficha abre el dialogo existente de asignacion para Cami");
  if (o.out) await page.screenshot({ path: path.join(o.out, "asignar_" + width + ".png") });
  await page.keyboard.press("Escape");
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^Cancelar$/i.test(x.innerText.trim())); if (b) b.click(); });
  await page.waitForTimeout(400);
  if (o.out) await page.screenshot({ path: path.join(o.out, "final_" + width + ".png") });
  check(state.pageErrors.length === 0, tag + " sin errores de pagina: " + state.pageErrors.join(" | "));
  const externa = [...state.external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h)); // fuentes: la app las pide siempre (lib.mjs las aborta)
  check(externa.length === 0, tag + " sin red externa: " + externa.join(", "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("DASHBOARD-NAV OK");
