// QA de «Validar sesión manualmente» (D7.2) en la demo del Dashboard (demo/dashboard-coach.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/validacion-manual.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--out <carpeta>]
// Interactua con el modal REAL, con la red externa bloqueada: Alumnos -> Eli Regular -> Opciones de rutina -> Validar sesión manualmente ->
// Día 3 -> fecha del entrenamiento -> Confirmar. Verifica: aviso de exito (y ningun error), modal cerrado, la ficha pasa de 2 a 3 dias,
// el día queda «completado» al reabrir, una fecha fuera de rango deshabilita «Confirmar», sin errores de pagina ni red. 320/390 px, oscuro y claro.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/dashboard-coach.html";
const o = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-valman-"));
  const env = { ...process.env, IRONTRACK_DEMO: "1", VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_ANON_KEY: "demo-dummy" };
  delete env.VERCEL; delete env.VERCEL_ENV;
  const r = spawnSync("npx", ["vite", "build", "--outDir", o.dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env });
  if (r.status !== 0) throw new Error("El build de la demo fallo");
}
if (o.out) fs.mkdirSync(o.out, { recursive: true });

const { chromium } = await resolvePlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });
const { server, port } = await serve(o.dist);
const fails = [];
let checks = 0;
const check = (c, m) => { checks++; if (!c) fails.push(m); };
const DLG = '[role="dialog"]';

const diasEli = (page) => page.evaluate(() => {
  const c = [...document.querySelectorAll("[data-alumno-id]")].find((x) => /Eli Regular/.test(x.innerText));
  const m = c && (c.innerText || "").match(/(\d+)\s+de\s+(\d+)\s+días/);
  return m ? Number(m[1]) : null;
});
const abrirModal = async (page) => {
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "") === "Opciones de rutina"); if (b) b.click(); });
  await page.waitForTimeout(400);
  return page.evaluate(() => { const it = [...document.querySelectorAll("button,[role=menuitem]")].find((b) => /Validar sesión manualmente/.test(b.innerText)); if (!it) return false; it.click(); return true; });
};

for (const [width, tema] of [[320, "oscuro"], [390, "claro"]]) {
  const tag = "@" + width + "/" + tema;
  const ctx = await browser.newContext({ viewport: { width, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: tema === "claro" ? "light" : "dark" });
  const external = new Set(), errors = [];
  await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue(); external.add(u.hostname); return route.abort(); });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:" + port + "/" + DEMO + (tema === "claro" ? "?tema=claro" : ""), { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.click('[data-demo-tab="alumnos"]');
  await page.waitForTimeout(600);
  await page.evaluate(() => { const c = [...document.querySelectorAll("[data-alumno-id]")].find((x) => /Eli Regular/.test(x.innerText)); c.querySelector("[data-qa-alumno-toggle]").click(); });
  await page.waitForTimeout(1500);
  const antes = await diasEli(page);
  check(antes === 2, tag + " Eli arranca con 2 de 3 días (" + antes + ")");

  check(await abrirModal(page), tag + " abre «Validar sesión manualmente»");
  await page.waitForTimeout(900);
  const dia3 = await page.evaluate((sel) => { const d = [...document.querySelectorAll(sel + " button")].find((b) => /Día 3/.test(b.innerText) && /pendiente/i.test(b.getAttribute("aria-label") || "")); if (!d) return false; d.click(); return true; }, DLG);
  check(dia3, tag + " elige Día 3 (pendiente)");
  await page.waitForTimeout(400);
  const lim = await page.evaluate((sel) => { const i = document.querySelector(sel + ' input[type="date"]'); return i ? { min: i.min, max: i.max, v: i.value, h: i.getBoundingClientRect().height } : null; }, DLG);
  check(!!lim && lim.h >= 43.5, tag + " campo de fecha de 44 px (" + JSON.stringify(lim) + ")");
  // fecha fuera de rango: «Confirmar» deshabilitado
  const dis = await page.evaluate((sel) => {
    const i = document.querySelector(sel + ' input[type="date"]');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(i, "2000-01-01"); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true }));
    return null;
  }, DLG);
  await page.waitForTimeout(300);
  const confirmarDeshab = await page.evaluate((sel) => { const b = [...document.querySelectorAll(sel + " button")].find((x) => (x.innerText || "").trim() === "Confirmar"); return b ? b.disabled : null; }, DLG);
  check(confirmarDeshab === true, tag + " fecha fuera de rango deshabilita «Confirmar» (" + confirmarDeshab + ")");
  void dis;
  // fecha valida (hoy, maximo permitido)
  await page.fill(DLG + ' input[type="date"]', lim.max);
  await page.waitForTimeout(300);
  await page.evaluate((sel) => { const b = [...document.querySelectorAll(sel + " button")].find((x) => (x.innerText || "").trim() === "Confirmar"); if (b) b.click(); }, DLG);
  await page.waitForTimeout(1500);
  const txt = await page.evaluate(() => document.body.innerText);
  check(/Sesión validada/.test(txt), tag + " aviso de exito «Sesión validada»");
  check(!/No se pudo validar la sesión/.test(txt), tag + " sin el error «No se pudo validar la sesión»");
  check(!(await page.$(DLG + ' input[type="date"]')), tag + " el modal se cierra");
  const despues = await diasEli(page);
  check(despues === 3, tag + " la ficha refleja la sesion validada: 3 de 3 días (" + despues + ")");
  if (o.out) await page.screenshot({ path: path.join(o.out, "validacion_" + tema + "_" + width + ".png") });
  // al reabrir, el Día 3 ya figura completado
  await abrirModal(page);
  await page.waitForTimeout(900);
  const completado = await page.evaluate((sel) => { const d = [...document.querySelectorAll(sel + " button, " + sel + " [aria-label]")].find((b) => /Día 3/.test(b.innerText || "") || /Día 3/.test(b.getAttribute("aria-label") || "")); return d ? (d.getAttribute("aria-label") || d.innerText) : (document.querySelector(sel) || {}).innerText; }, DLG);
  check(/completado|ya están completados/i.test(String(completado)), tag + " al reabrir, Día 3 completado (" + String(completado).slice(0, 80) + ")");

  check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
  const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
  check(ext.length === 0, tag + " sin red externa: " + ext.join(","));
  await ctx.close();
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("VALIDACION-MANUAL OK");
