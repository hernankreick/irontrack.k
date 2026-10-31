// QA visual de Progreso del entrenador (P1: paleta de «Mis alumnos») sobre demo/progreso-coach.html (datos ficticios, solo Preview).
// Uso:  node scripts/qa/progreso-visual.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 375,390,430,1280] [--out <carpeta>]
// En 375/390/430/1280, oscuro y claro, escenarios normal / ?incompleto=1 / ?vacio=1: sin overflow horizontal, controles >= 44 px,
// contraste de texto >= 4,5:1 contra el fondo efectivo, selector de alumno y de periodo cerrados y abiertos, Equipo contraido y expandido,
// fondo de la paleta de Mis alumnos (#0A0F1A / #F1F5F9) en la raiz, sin errores de pagina y sin red externa (todo pedido a otro host se aborta
// y se registra; las fuentes no cuentan). Capturas en --out.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/progreso-coach.html";
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
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-prog-"));
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

// Controles visibles < 44 px, overflow horizontal y contraste de texto (color vs fondo efectivo, componiendo alfas).
const MEASURE = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const skip = (e) => !!e.closest('[data-qa="demo-banner"]');
  const ctl = [...document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=radio]')].filter((e) => vis(e) && !skip(e));
  const small = ctl.map((e) => { const r = e.getBoundingClientRect(); return { k: lab(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }).filter((c) => c.w < 43.5 || c.h < 43.5);
  const parse = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const bgOf = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { chain.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base); return base; };
  const L = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const low = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || skip(el) || el.closest('svg')) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(' ');
    if (!own) continue;
    const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el); const f = over({ ...fg, a: fg.a * (+cs.opacity || 1) }, bg);
    const a = L(f), b = L(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (ratio < 4.5) low.push({ t: own.slice(0, 30), r: +ratio.toFixed(2) });
  }
  const root = document.querySelector('[data-qa="progreso-coach"]');
  return { small, low, overflow: document.documentElement.scrollWidth > innerWidth + 1, rootBg: root ? getComputedStyle(root).backgroundColor : null };
})()`;

const ESC = { oscuro: { shell: "rgb(10, 15, 26)", surface: "rgb(13, 20, 36)" }, claro: { shell: "rgb(241, 245, 249)", surface: "rgb(255, 255, 255)" } };
const click = (page, sel) => page.evaluate((sel) => { const e = [...document.querySelectorAll(sel)].find((x) => x.getBoundingClientRect().width > 0); if (!e) return false; e.click(); return true; }, sel);

for (const width of o.widths) {
  const mobile = width < 768;
  for (const escenario of ["normal", "incompleto", "vacio"]) {
    const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
    const external = new Set(), errors = [];
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
      external.add(u.hostname);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    const qs = escenario === "normal" ? "" : "?" + (escenario === "incompleto" ? "incompleto=1" : "vacio=1");
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO + qs, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    for (const modo of ["oscuro", "claro"]) {
      if (modo === "claro") { await click(page, '[data-qa="demo-tema"]'); await page.waitForTimeout(400); }
      const tag = "@" + width + " " + escenario + " " + modo;
      const snap = async (name, estado) => {
        const m = await page.evaluate(MEASURE);
        check(!m.overflow, tag + " " + estado + ": overflow horizontal");
        check(m.small.length === 0, tag + " " + estado + ": controles < 44 px " + JSON.stringify(m.small.slice(0, 4)));
        check(m.low.length === 0, tag + " " + estado + ": contraste < 4,5:1 " + JSON.stringify(m.low.slice(0, 4)));
        if (estado === "cerrado") check(m.rootBg === ESC[modo].shell, tag + ": fondo de la raiz " + m.rootBg + " (esperado " + ESC[modo].shell + ")");
        if (o.out) await page.screenshot({ path: path.join(o.out, "progreso_" + escenario + "_" + modo + "_" + width + "_" + name + ".png") });
      };
      check(await page.evaluate(() => !!document.querySelector('[data-qa="progreso-coach"]')), tag + ": se monta Progreso");
      await snap("base", "cerrado");

      // selector de alumno y de periodo (hojas)
      for (const [sel, nombre] of [['[data-qa="progreso-alumno-btn"]', "alumno"], ['[data-qa="periodo-btn"]', "periodo"]]) {
        const abre = await click(page, sel);
        check(abre, tag + ": boton " + nombre);
        await page.waitForTimeout(400);
        const abierta = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
        check(abierta, tag + ": hoja " + nombre + " abierta");
        if (abierta) {
          const sheetBg = await page.evaluate(() => getComputedStyle(document.querySelector('[role="dialog"]')).backgroundColor);
          check(sheetBg === ESC[modo].surface, tag + ": hoja " + nombre + " con tarjeta " + sheetBg);
          await snap("hoja-" + nombre, "hoja " + nombre + " abierta");
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          if (await page.evaluate(() => !!document.querySelector('[role="dialog"]'))) { await click(page, '[role="dialog"] button'); await page.waitForTimeout(300); }
        }
      }

      // Equipo contraido y expandido
      const hayEquipo = await page.evaluate(() => { const b = document.querySelector('[data-qa="equipo-toggle"]'); if (!b) return false; b.scrollIntoView({ block: "center" }); return true; });
      check(hayEquipo, tag + ": seccion Equipo");
      if (hayEquipo) {
        await page.waitForTimeout(300);
        await snap("equipo-contraido", "Equipo contraido");
        await click(page, '[data-qa="equipo-toggle"]');
        await page.waitForTimeout(400);
        check(await page.evaluate(() => document.querySelector('[data-qa="equipo-toggle"]').getAttribute("aria-expanded") === "true"), tag + ": Equipo expandido");
        await snap("equipo-expandido", "Equipo expandido");
        await click(page, '[data-qa="equipo-toggle"]');
        await page.waitForTimeout(200);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    check(errors.length === 0, "@" + width + " " + escenario + ": errores de pagina " + errors.join(" | "));
    const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
    check(ext.length === 0, "@" + width + " " + escenario + ": red externa " + ext.join(","));
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log("Verificaciones: " + checks + " | fallas: " + fails.length);
for (const f of fails) console.log("FALLA: " + f);
process.exit(fails.length ? 1 : 0);
