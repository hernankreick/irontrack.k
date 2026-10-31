// QA de la demostracion de diseno D5 (demo/dashboard-d5.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/demo-d5.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 375,390,430,1280] [--out <carpeta>]
// Por cada ancho y tema (oscuro / claro), con TODA la red externa bloqueada y sin sesion de IronTrack:
//   sin scroll horizontal, sin errores de pagina, controles de la propuesta >= 44 x 44 px, contraste del texto principal >= 4.5:1,
//   los 6 escenarios se renderizan, la navegacion de D4 funciona (grupos -> Alumnos con su filtro, actividad reciente -> ficha,
//   «Ver alumnos» -> Todos, «Progreso» -> pantalla real, «← Dashboard» vuelve) y captura propuesta vs Dashboard actual (antes/despues).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEMO = "demo/dashboard-d5.html";
const SIZES = { 375: 667, 390: 844, 430: 932, 1280: 860 };
const o = { widths: [375, 390, 430, 1280] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-d5-qa-"));
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
const shot = async (page, name, full) => { if (o.out) await page.screenshot({ path: path.join(o.out, name + ".png"), fullPage: !!full }); };

// Dentro de la pagina: medidas de la propuesta.
const MEDIR = `(() => {
  const root = document.querySelector('[data-qa="d5-propuesta"]');
  if (!root) return { found: false };
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const small = [...root.querySelectorAll('button,a[href],select,input')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { k: (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44);
  const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const bgOf = (e) => { while (e) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(b) && !/rgba\\([^)]*, 0\\.[0-3]\\d*\\)/.test(b)) return b; e = e.parentElement; } return 'rgb(255,255,255)'; };
  const low = [];
  for (const e of root.querySelectorAll('h1,h2,p,span')) {
    if (!vis(e) || !e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const a = lum(getComputedStyle(e).color), b = lum(bgOf(e));
    const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) low.push(e.innerText.trim().slice(0, 30) + ' ' + ratio.toFixed(2));
  }
  return { found: true, overflow: document.documentElement.scrollWidth > innerWidth + 1, small, low };
})()`;

async function abrirOpciones(page) { if (!(await page.$('[data-qa="d5-panel-opciones"]'))) { await page.click('[data-qa="d5-opciones"]'); await page.waitForTimeout(150); } }
async function cerrarOpciones(page) { if (await page.$('[data-qa="d5-panel-opciones"]')) { await page.click('[data-qa="d5-opciones"]'); await page.waitForTimeout(150); } }
async function escenario(page, id) { await abrirOpciones(page); await page.selectOption('[data-qa="d5-escenario"]', id); await page.waitForTimeout(400); await cerrarOpciones(page); }
async function alumnosState(page) {
  return page.evaluate(() => {
    const chip = [...document.querySelectorAll("button[aria-pressed=true]")].map((b) => (b.innerText || "").trim()).find((t) => /\(\d+\)$/.test(t)) || "";
    const cards = [...document.querySelectorAll("[data-alumno-id]")].map((c) => ({ t: (c.innerText || "").replace(/\s+/g, " "), open: c.getAttribute("data-qa-alumno-card") === "open" }));
    return { chip, cards };
  });
}

for (const width of o.widths) {
  for (const tema of ["oscuro", "claro"]) {
    const tag = "@" + width + "/" + tema;
    const mobile = width < 768;
    const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
    const external = new Set(), errors = [];
    await ctx.route("**/*", (r) => { const u = new URL(r.request().url()); if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return r.continue(); external.add(u.hostname); return r.abort(); });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    if (tema === "claro") { await abrirOpciones(page); await page.click('[data-qa="d5-tema-claro"]'); await cerrarOpciones(page); await page.waitForTimeout(300); }

    for (const id of ["atencion", "normal", "sinAlumnos", "sinRutinas", "cargando", "incompleto"]) {
      await escenario(page, id);
      const m = await page.evaluate(MEDIR);
      check(m.found, tag + " " + id + ": propuesta visible");
      if (!m.found) continue;
      check(!m.overflow, tag + " " + id + ": sin scroll horizontal");
      check(m.small.length === 0, tag + " " + id + ": controles >= 44 px " + JSON.stringify(m.small));
      check(m.low.length === 0, tag + " " + id + ": contraste >= 4.5 " + JSON.stringify(m.low.slice(0, 4)));
      if (id === "atencion" || (width === 390 && tema === "oscuro")) await shot(page, "propuesta_" + id + "_" + width + "_" + tema, true);
    }

    // navegacion (escenario con atencion)
    await escenario(page, "atencion");
    for (const [qa, chip, quien] of [["d5-grupo-sin_rutina", "Sin rutina", "Cami"], ["d5-grupo-inactivos", "Inactivos", "Ana"], ["d5-grupo-baja", "Baja actividad", "Beto"]]) {
      await page.click('[data-qa="' + qa + '"]');
      await page.waitForTimeout(500);
      const st = await alumnosState(page);
      check(st.chip.startsWith(chip) && st.cards.length === 1 && st.cards[0].t.includes(quien), tag + " " + qa + " -> " + chip + " (" + st.chip + ", " + st.cards.length + ")");
      await page.click('[data-qa="d5-volver"]');
      await page.waitForTimeout(300);
    }
    await page.click('[data-qa="d5-reciente"]');
    await page.waitForTimeout(900);
    let st = await alumnosState(page);
    check(st.chip.startsWith("Todos") && st.cards.some((c) => c.open), tag + " actividad reciente -> ficha abierta");
    await page.click('[data-qa="d5-volver"]');
    await page.waitForTimeout(300);
    await page.click('[data-qa="d5-ver-alumnos"]');
    await page.waitForTimeout(500);
    st = await alumnosState(page);
    check(st.chip.startsWith("Todos") && st.cards.length === 7, tag + " Ver alumnos -> Todos (7)");
    await page.click('[data-qa="d5-volver"]');
    await page.waitForTimeout(300);
    await page.click('[data-qa="d5-accion-progreso"]');
    await page.waitForTimeout(700);
    check(await page.evaluate(() => !!document.querySelector('[data-qa="resumen-adherencia"]')), tag + " Progreso -> pantalla real de Progreso");
    await page.click('[data-qa="d5-volver"]');
    await page.waitForTimeout(300);
    check(!!(await page.$('[data-qa="d5-propuesta"]')), tag + " «← Dashboard» vuelve a la propuesta");

    // antes / despues: Dashboard actual real con los mismos datos
    if (tema === "oscuro" || width === 390) {
      await abrirOpciones(page); await page.click('[data-qa="d5-vista-actual"]'); await cerrarOpciones(page); await page.waitForTimeout(700);
      check(await page.evaluate(() => document.body.innerText.includes("Mis alumnos")), tag + " vista 'Dashboard actual' (real)");
      await shot(page, "actual_atencion_" + width + "_" + tema, true);
      await abrirOpciones(page); await page.click('[data-qa="d5-vista-propuesta"]'); await cerrarOpciones(page);
    }
    check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
    const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
    check(ext.length === 0, tag + " sin red externa: " + ext.join(","));
    const storage = await page.evaluate(() => Object.keys(localStorage));
    check(!storage.includes("it_session"), tag + " sin sesion de IronTrack");
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("DEMO-D5 OK");
