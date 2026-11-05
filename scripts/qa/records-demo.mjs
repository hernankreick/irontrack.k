// QA de la demo de récords (D7.4): demo/progreso-coach.html?alumno=martina|bruno (datos ficticios, solo Preview, sin red).
// Uso:  node scripts/qa/records-demo.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 320,390,430] [--out <carpeta>]
// Verifica en Chromium, oscuro y claro: ?alumno=martina abre en Martina Récords; «PRs recientes» muestra 90 y 100 kg; el historial de
// Sentadilla lista 80 (Primera marca), 90 (PR), 90 (Iguala), 85 (por debajo) y 100 (PR); Bruno: press 60/62,5/62,5 sin mezclar; sin overflow
// horizontal, sin errores de página y sin red externa.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/progreso-coach.html";
const o = { widths: [320, 390, 430] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-records-"));
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
const flat = (s) => String(s).replace(/\s+/g, " ").trim();

for (const tema of ["oscuro", "claro"]) {
  for (const width of o.widths) {
    for (const [param, nombre, ejercicio, esperado] of [
      ["martina", "Martina Récords", "Sentadilla", [["80", "Primera marca"], ["90", "PR"], ["90", "Iguala"], ["85", "por debajo"], ["100", "PR"]]],
      ["bruno", "Bruno Récords", "Press banca", [["60", "Primera marca"], ["62,5", "PR"], ["62,5", "Iguala"]]],
    ]) {
      const tag = "@" + width + "/" + tema + "/" + param;
      const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const external = new Set(), errors = [];
      await ctx.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
        external.add(u.hostname);
        return route.abort();
      });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      await page.goto("http://127.0.0.1:" + port + "/" + DEMO + "?alumno=" + param, { waitUntil: "load" });
      await page.waitForSelector('[data-qa="progreso-alumno-btn"]', { timeout: 15000 });
      if (tema === "claro") { await page.click('[data-qa="demo-tema"]'); await page.waitForTimeout(300); }
      await page.waitForFunction((n) => (document.querySelector('[data-qa="progreso-alumno-btn"]').getAttribute("aria-label") || "").includes(n), nombre, { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      check((await page.locator('[data-qa="progreso-alumno-btn"]').first().getAttribute("aria-label")).includes("Seleccionado: " + nombre), tag + " abre en " + nombre);
      const prs = flat(await page.locator('[data-qa="prs-recientes"]').innerText());
      if (param === "martina") {
        check(/100/.test(prs) && /90/.test(prs) && /Sentadilla/.test(prs), tag + " PRs recientes con 90 y 100 de Sentadilla (" + prs.slice(0, 120) + ")");
        check(!/Press banca|62[,.]5/.test(prs), tag + " PRs de Martina sin datos de Bruno");
      } else {
        check(/Press banca/.test(prs) && /62[,.]5/.test(prs) && !/Sentadilla/.test(prs), tag + " PRs de Bruno: solo press 62,5 (" + prs.slice(0, 120) + ")");
      }
      await page.locator('[data-qa="historial-por-ejercicio"] button', { hasText: ejercicio }).first().click();
      await page.waitForSelector('[data-qa="historial-ejercicio"]', { timeout: 10000 });
      await page.waitForTimeout(400);
      let items = await page.locator('[data-qa="historial-ejercicio"] ol > li').allInnerTexts();
      const mas = page.locator('[data-qa="historial-ejercicio"] button[aria-expanded]');
      if (items.length < esperado.length && (await mas.count())) { await mas.first().click(); await page.waitForTimeout(200); items = await page.locator('[data-qa="historial-ejercicio"] ol > li').allInnerTexts(); }
      check(items.length === esperado.length, tag + " " + esperado.length + " sesiones en el historial (hay " + items.length + ")");
      // La lista va de la más reciente a la más antigua: se compara en orden cronológico.
      const cron = items.map(flat).reverse();
      esperado.forEach(([kg, marca], i) => {
        check(cron[i] && cron[i].includes(kg + " kg") || (cron[i] || "").includes(kg), tag + " sesión " + (i + 1) + " = " + kg + " (" + (cron[i] || "").slice(0, 60) + ")");
        check(cron[i] && cron[i].includes(marca), tag + " sesión " + (i + 1) + " marca «" + marca + "» (" + (cron[i] || "").slice(0, 120) + ")");
      });
      if (param === "martina") check(cron.filter((t) => /Supera el récord anterior/.test(t)).length === 2, tag + " exactamente 2 PR");
      const ov = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      check(!ov, tag + " sin overflow horizontal");
      check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
      const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
      check(ext.length === 0, tag + " sin red externa: " + ext.join(","));
      if (o.out) await page.screenshot({ path: path.join(o.out, "records_" + param + "_" + tema + "_" + width + ".png") });
      await ctx.close();
    }
  }
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("RECORDS-DEMO OK");
