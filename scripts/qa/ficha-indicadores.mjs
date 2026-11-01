// QA de los 3 indicadores de la ficha expandida (.it-ficha-sum: semana, dias, proxima sesion) en la demo del Dashboard (datos ficticios, solo Preview).
// Uso:  node scripts/qa/ficha-indicadores.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 320,375,...] [--out <carpeta>]
// En Chromium, modo oscuro y claro, textos normales y `?textos=largos`, con TODA la red externa bloqueada, abre Alumnos y expande la ficha de
// Ana Inactiva y la de Eli Regular. Verifica: cada [data-qa-text] dentro de su item, items sin superponerse, bloque dentro de la card,
// sin overflow horizontal de la pagina y sin errores de pagina.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/dashboard-coach.html";
const SIZES = { 320: 640, 375: 667, 390: 844, 430: 932, 768: 1024, 1280: 800 };
const o = { widths: [320, 375, 390, 430, 768, 1280] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-ficha-ind-"));
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

const medir = (page, nombre) => page.evaluate((nombre) => {
  const card = [...document.querySelectorAll("[data-alumno-id]")].find((c) => (c.innerText || "").includes(nombre));
  if (!card) return { error: "sin card" };
  const sum = card.querySelector(".it-ficha-sum");
  if (!sum) return { error: "sin .it-ficha-sum (ficha no expandida)" };
  const R = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom }; };
  const items = [...sum.querySelectorAll(".it-ficha-sum-item")];
  const rects = items.map(R);
  const fuera = [];
  items.forEach((it, i) => {
    const ir = rects[i];
    it.querySelectorAll("[data-qa-text]").forEach((t) => {
      const tr = R(t);
      const dentroRect = tr.l >= ir.l - 1 && tr.r <= ir.r + 1 && tr.b <= ir.b + 1;
      const dentroScroll = t.scrollWidth <= t.clientWidth + 1;
      if (!(dentroRect && dentroScroll)) fuera.push(i + ":" + (t.innerText || "").slice(0, 40) + " (sw " + t.scrollWidth + "/cw " + t.clientWidth + ", " + Math.round(tr.l) + ".." + Math.round(tr.r) + " vs " + Math.round(ir.l) + ".." + Math.round(ir.r) + ")");
    });
  });
  const solapan = [];
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) solapan.push(i + "x" + j);
  }
  const s = R(sum), c = R(card);
  card.scrollIntoView({ block: "center" });
  return {
    n: items.length, fuera, solapan,
    enCard: s.l >= c.l - 1 && s.r <= c.r + 1 && s.b <= c.b + 1,
    vw: innerWidth, sw: document.documentElement.scrollWidth,
    vals: items.map((it) => (it.innerText || "").replace(/\s+/g, " ")),
  };
}, nombre);

for (const tema of ["oscuro", "claro"]) {
  for (const textos of ["normales", "largos"]) {
    for (const width of o.widths) {
      const mobile = width < 768;
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
      const q = [tema === "claro" ? "tema=claro" : "", textos === "largos" ? "textos=largos" : ""].filter(Boolean).join("&");
      await page.goto("http://127.0.0.1:" + port + "/" + DEMO + (q ? "?" + q : ""), { waitUntil: "load" });
      await page.waitForTimeout(1200);
      await page.click('[data-demo-tab="alumnos"]');
      await page.waitForTimeout(700);
      for (const nombre of ["Ana Inactiva", "Eli Regular"]) {
        const tag = "@" + width + "/" + tema + "/" + textos + "/" + nombre.split(" ")[0];
        // expande solo esa ficha (si otra quedo abierta, la contrae al abrir la siguiente o se deja: se mide por card)
        await page.evaluate((nombre) => {
          const card = [...document.querySelectorAll("[data-alumno-id]")].find((c) => (c.innerText || "").includes(nombre));
          if (card && card.getAttribute("data-qa-alumno-card") !== "open") { const t = card.querySelector("[data-qa-alumno-toggle]"); if (t) t.click(); }
        }, nombre);
        await page.waitForTimeout(600);
        const m = await medir(page, nombre);
        if (m.error) { check(false, tag + " " + m.error); continue; }
        check(m.n === 3, tag + " 3 indicadores (" + m.n + ")");
        check(m.fuera.length === 0, tag + " cada texto dentro de su item: " + m.fuera.join(" | "));
        check(m.solapan.length === 0, tag + " items sin superponerse: " + m.solapan.join(","));
        check(m.enCard, tag + " el bloque queda dentro de la card");
        check(m.sw <= m.vw + 1, tag + " sin overflow horizontal (" + m.sw + " > " + m.vw + ")");
        if (o.out) await page.screenshot({ path: path.join(o.out, "ficha_" + tema + "_" + textos + "_" + width + "_" + nombre.split(" ")[0].toLowerCase() + ".png") });
      }
      check(errors.length === 0, "@" + width + "/" + tema + "/" + textos + " sin errores de pagina: " + errors.join(" | "));
      const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
      check(ext.length === 0, "@" + width + "/" + tema + "/" + textos + " sin red externa: " + ext.join(","));
      await ctx.close();
    }
  }
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("FICHA-INDICADORES OK");
