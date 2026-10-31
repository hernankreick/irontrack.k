// QA de navegacion del Dashboard del entrenador (D4) sobre la app REAL compilada, con datos FICTICIOS (host simulado, sin Supabase ni red).
// Uso:  node scripts/qa/dashboard-nav.mjs [--dist <dir>] [--widths 375,390,430,1280] [--out <carpeta>]
// Escenario QA_DASH_NAV (fixtures.mjs): Ana inactiva, Beto con baja actividad (entreno hace 15 dias), Cami sin rutina.
// Por cada ancho verifica: cada CTA lleva a Alumnos con SU filtro (sin filtros ni busquedas heredados), «Ver todos» limpia el filtro,
// Perfil abre la ficha del alumno correcto (visible en pantalla), «Asignar rutina» abre el dialogo existente de asignacion de ESE alumno
// (escritorio), «Mensaje» abre el chat del alumno correcto (escritorio), ida y vuelta Dashboard <-> Alumnos y CTAs de 44 px en movil.
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

  // ---- CTAs de Atencion hoy -> Alumnos con su filtro ----
  for (const [cta, chip, esperado] of [
    ["Ver alumnos inactivos", "Inactivos", "Ana Prueba"],
    ["Ver alumnos sin rutina", "Sin rutina", "Cami Prueba"],
    ["Ver alumnos con baja actividad", "Baja actividad", "Beto Prueba"],
  ]) {
    await toDashboard();
    const r = await clickText(page, cta, ".cd-card");
    check(!!r, tag + " existe el CTA '" + cta + "'");
    if (r && mobile) check(r.h >= 43.5, tag + " CTA '" + cta + "' >= 44 px (" + r.h + ")");
    await page.waitForTimeout(900);
    const st = await alumnosState(page);
    check(chipOn(st).startsWith(chip), tag + " '" + cta + "' -> filtro '" + chip + "' (activo: '" + chipOn(st) + "')");
    check(st.cards.length === 1 && names(st) === esperado, tag + " '" + cta + "' muestra solo " + esperado + " (muestra: " + names(st) + ")");
  }

  // ---- «Ver todos» limpia filtro y busqueda heredados ----
  const hayBusqueda = await page.$('input[aria-label="Buscar alumno"]');
  check(!!hayBusqueda, tag + " buscador de Alumnos visible");
  if (hayBusqueda) await page.fill('input[aria-label="Buscar alumno"]', "zzz");
  await page.waitForTimeout(300);
  await toDashboard();
  check(!!(await clickText(page, "Ver todos →")), tag + " existe 'Ver todos →'");
  await page.waitForTimeout(900);
  let st = await alumnosState(page);
  check(chipOn(st).startsWith("Todos") && st.search === "" && st.cards.length === 3, tag + " 'Ver todos' -> Todos, sin busqueda, 3 alumnos (" + chipOn(st) + " / '" + st.search + "' / " + st.cards.length + ")");

  // ---- Perfil abre la ficha del alumno correcto, aunque hubiera un filtro que lo excluya ----
  await clickText(page, "Sin rutina (1)");
  await page.waitForTimeout(300);
  await toDashboard();
  if (mobile) {
    const ok = await page.evaluate(() => {
      const row = [...document.querySelectorAll("[role=button]")].find((e) => (e.innerText || "").startsWith("BP\n") || (e.innerText || "").includes("Beto Prueba"));
      if (!row) return false; row.click(); return true;
    });
    check(ok, tag + " fila de Beto en 'Mis alumnos'");
  } else {
    const ok = await page.evaluate(() => {
      const row = [...document.querySelectorAll("[role=button]")].find((e) => (e.innerText || "").includes("Beto Prueba") && (e.innerText || "").includes("Perfil"));
      const b = row && [...row.querySelectorAll("button")].find((x) => x.innerText.trim() === "Perfil");
      if (!b) return false; b.click(); return true;
    });
    check(ok, tag + " boton Perfil de Beto");
  }
  await page.waitForTimeout(1600);
  st = await alumnosState(page);
  const beto = st.cards.find((c) => c.text === "Beto Prueba");
  check(chipOn(st).startsWith("Todos"), tag + " Perfil -> filtro Todos (no hereda 'Sin rutina')");
  check(!!(beto && beto.open), tag + " Perfil abre la ficha de Beto");
  check(!!(beto && beto.top >= -2 && beto.top < st.vh), tag + " la ficha de Beto queda a la vista (top " + (beto && Math.round(beto.top)) + ")");

  // ---- ida y vuelta: volver al Dashboard y otra vez a Alumnos conserva el flujo ----
  await toDashboard();
  const back = await page.evaluate(() => document.body.innerText.includes("Mis alumnos"));
  check(back, tag + " volver al Dashboard muestra 'Mis alumnos'");

  if (!mobile) {
    // ---- «Asignar rutina» solo en alumnos sin rutina y abre el dialogo existente de ESE alumno ----
    const acciones = await page.evaluate(() => [...document.querySelectorAll("[role=button]")].filter((e) => /Prueba/.test(e.innerText || "") && /Perfil/.test(e.innerText || "")).map((e) => ({ n: (e.innerText || "").includes("Cami") ? "Cami" : (e.innerText || "").includes("Beto") ? "Beto" : "Ana", asignar: [...e.querySelectorAll("button")].some((b) => b.innerText.trim() === "Asignar rutina") })));
    check(acciones.length === 3, tag + " 3 filas con acciones");
    check(acciones.every((a) => a.asignar === (a.n === "Cami")), tag + " 'Asignar rutina' solo en Cami (sin rutina): " + JSON.stringify(acciones));
    await page.evaluate(() => {
      const row = [...document.querySelectorAll("[role=button]")].find((e) => (e.innerText || "").includes("Cami Prueba") && /Perfil/.test(e.innerText || ""));
      [...row.querySelectorAll("button")].find((b) => b.innerText.trim() === "Asignar rutina").click();
    });
    await page.waitForTimeout(1600);
    st = await alumnosState(page);
    check(!!st.cards.find((c) => c.text === "Cami Prueba" && c.open), tag + " 'Asignar rutina' abre la ficha de Cami");
    const dlg = await page.evaluate(() => document.body.innerText.includes("Asignar rutina: Rutina local QA a Cami Prueba"));
    check(dlg, tag + " 'Asignar rutina' abre el dialogo existente de asignacion para Cami");
    if (o.out) await page.screenshot({ path: path.join(o.out, "asignar_" + width + ".png") });
    await page.keyboard.press("Escape");
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /^Cancelar$/i.test(x.innerText.trim())); if (b) b.click(); });
    await page.waitForTimeout(400);

    // ---- «Mensaje» abre el chat del alumno correcto ----
    await toDashboard();
    await page.evaluate(() => {
      const row = [...document.querySelectorAll("[role=button]")].find((e) => (e.innerText || "").includes("Ana Prueba") && /Perfil/.test(e.innerText || ""));
      [...row.querySelectorAll("button")].find((b) => b.innerText.trim() === "Mensaje").click();
    });
    await page.waitForTimeout(900);
    const chat = await page.evaluate(() => [...document.querySelectorAll("[role=dialog], .fixed")].some((d) => (d.innerText || "").includes("Ana Prueba")));
    check(chat, tag + " 'Mensaje' abre el chat de Ana");
  }
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
