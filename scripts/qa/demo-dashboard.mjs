// QA de la demostracion del Dashboard del entrenador (demo/dashboard-coach.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/demo-dashboard.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 375,390,430,1280] [--out <carpeta>]
// Verifica en Chromium, sin sesion de IronTrack y con TODA la red externa bloqueada (se registra y se aborta):
//   Dashboard D5: las filas de «Requieren seguimiento» -> Alumnos con el filtro correcto (inactivos / sin rutina / baja actividad),
//   «Ver alumnos» limpia filtro y busqueda, tocar un alumno en «Actividad reciente» (Dora) abre su ficha, Seguimiento «Sin rutina» -> ficha
//   de Cami -> «Asignar rutina» de la ficha abre el dialogo existente, sin errores de pagina, sin red y sin escribir la sesion de
//   IronTrack en el almacenamiento.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/dashboard-coach.html";
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
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-dash-"));
  const env = { ...process.env, IRONTRACK_DEMO: "1", VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_ANON_KEY: "demo-dummy" };
  delete env.VERCEL; delete env.VERCEL_ENV;
  const r = spawnSync("npx", ["vite", "build", "--outDir", o.dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env });
  if (r.status !== 0) throw new Error("El build de la demo fallo");
}
if (!fs.existsSync(path.join(o.dist, DEMO))) throw new Error("El build no contiene " + DEMO);
if (o.out) fs.mkdirSync(o.out, { recursive: true });

const { chromium } = await resolvePlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });
const { server, port } = await serve(o.dist);
const fails = [];
let checks = 0;
const check = (c, m) => { checks++; if (!c) fails.push(m); };

const NOMBRES = ["Ana Inactiva", "Beto Baja", "Cami Nueva", "Dora Constante", "Eli Regular"];
const clickText = (page, text, scope) => page.evaluate(({ text, scope }) => {
  const root = (scope && document.querySelector(scope)) || document;
  const el = [...root.querySelectorAll("button,[role=button]")].find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (e.innerText || "").replace(/\s+/g, " ").trim() === text; });
  if (!el) return null;
  const r = el.getBoundingClientRect(); el.click(); return { h: r.height };
}, { text, scope });
const alumnos = (page) => page.evaluate((NOMBRES) => {
  const chip = [...document.querySelectorAll("button[aria-pressed=true]")].map((b) => (b.innerText || "").trim()).find((t) => /\(\d+\)$/.test(t)) || "";
  const cards = [...document.querySelectorAll("[data-alumno-id]")].map((c) => ({ n: NOMBRES.find((n) => (c.innerText || "").includes(n)) || "?", open: c.getAttribute("data-qa-alumno-card") === "open", top: c.getBoundingClientRect().top }));
  const s = document.querySelector('input[aria-label="Buscar alumno"]');
  return { chip, cards, search: s ? s.value : null, vh: innerHeight };
}, NOMBRES);
const irDashboard = async (page) => { await page.click('[data-demo-tab="plan"]'); await page.waitForTimeout(500); };

for (const width of o.widths) {
  const mobile = width < 768;
  const tag = "@" + width;
  const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
  const external = new Set(), errors = [];
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
    external.add(u.hostname);
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
  await page.waitForTimeout(1500);

  const inicio = await page.evaluate(() => document.body.innerText);
  check(/DEMO/.test(inicio) && /Requieren seguimiento/.test(inicio) && /Actividad reciente/.test(inicio), tag + " abre el Dashboard demo sin login");
  for (const t of ["Sin rutina", "Inactivos", "Baja actividad"]) check(inicio.includes(t), tag + " Requieren seguimiento: " + t);
  if (o.out) await page.screenshot({ path: path.join(o.out, "dashboard_" + width + ".png"), fullPage: false });

  for (const [cta, chip, esperado] of [["Inactivos", "Inactivos", "Ana Inactiva"], ["Sin rutina", "Sin rutina", "Cami Nueva"], ["Baja actividad", "Baja actividad", "Beto Baja"]]) {
    await irDashboard(page);
    const r = await page.evaluate((cta) => {
      const el = [...document.querySelectorAll('[data-qa="d5-seguimiento"] button')].find((b) => (b.innerText || "").trim().startsWith(cta));
      if (!el) return null;
      const q = el.getBoundingClientRect(); el.click(); return { h: q.height };
    }, cta);
    check(!!r, tag + " fila " + cta);
    if (r && mobile) check(r.h >= 43.5, tag + " fila " + cta + " >= 44 px");
    await page.waitForTimeout(700);
    const st = await alumnos(page);
    check(st.chip.startsWith(chip), tag + " " + cta + " -> filtro " + chip + " (" + st.chip + ")");
    check(st.cards.map((c) => c.n).join() === esperado, tag + " " + cta + " -> solo " + esperado + " (" + st.cards.map((c) => c.n).join() + ")");
  }
  if (o.out) await page.screenshot({ path: path.join(o.out, "alumnos-baja_" + width + ".png") });

  await page.fill('input[aria-label="Buscar alumno"]', "zzz");
  await irDashboard(page);
  check(await page.evaluate(() => { const b = document.querySelector('[data-qa="d5-ver-alumnos"]'); if (!b) return false; b.click(); return true; }), tag + " Ver alumnos");
  await page.waitForTimeout(700);
  let st = await alumnos(page);
  check(st.chip.startsWith("Todos") && st.search === "" && st.cards.length === 5, tag + " Ver alumnos -> Todos, sin busqueda, 5 alumnos (" + st.chip + "/'" + st.search + "'/" + st.cards.length + ")");

  await irDashboard(page);
  const tocado = await page.evaluate(() => {
    const row = [...document.querySelectorAll('[data-qa="d5-reciente"]')].find((e) => (e.innerText || "").includes("Dora Constante"));
    if (!row) return false; row.click(); return true;
  });
  check(tocado, tag + " fila de Dora en Actividad reciente");
  await page.waitForTimeout(1200);
  st = await alumnos(page);
  const dora = st.cards.find((c) => c.n === "Dora Constante");
  check(!!(dora && dora.open), tag + " abre la ficha de Dora");
  check(!!(dora && dora.top >= -2 && dora.top < st.vh), tag + " ficha de Dora a la vista");
  if (o.out) await page.screenshot({ path: path.join(o.out, "ficha_" + width + ".png") });

  // Asignacion: Seguimiento «Sin rutina» -> Alumnos filtrado -> ficha de Cami -> «Asignar rutina» de la ficha (ya no hay boton por fila en el Dashboard)
  await irDashboard(page);
  await page.evaluate(() => { const el = [...document.querySelectorAll('[data-qa="d5-seguimiento"] button')].find((b) => (b.innerText || "").trim().startsWith("Sin rutina")); if (el) el.click(); });
  await page.waitForTimeout(900);
  st = await alumnos(page);
  if (!st.cards.find((c) => c.n === "Cami Nueva" && c.open)) {
    await page.evaluate(() => { const t = document.querySelector("[data-alumno-id] [data-qa-alumno-toggle]"); if (t) t.click(); });
    await page.waitForTimeout(900);
  }
  check(!!(await clickText(page, "Asignar rutina")), tag + " la ficha de Cami tiene 'Asignar rutina'");
  await page.waitForTimeout(1200);
  const dlg = await page.evaluate(() => document.body.innerText.includes("Asignar rutina: Rutina inicial (demo) a Cami Nueva"));
  check(dlg, tag + " Asignar rutina de la ficha abre el dialogo existente para Cami");
  await clickText(page, "Cancelar");

  const storage = await page.evaluate(() => Object.keys(localStorage));
  check(!storage.includes("it_session") && !storage.some((k) => /^sb-.*-auth-token$/.test(k)), tag + " sin sesion de IronTrack en el almacenamiento: " + storage.join(","));
  check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
  const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
  check(ext.length === 0, tag + " sin red externa: " + ext.join(","));
  await ctx.close();
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("DEMO-DASHBOARD OK");
