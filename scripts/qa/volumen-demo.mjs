// QA de la demo de comparacion de volumen (D7.3): demo/progreso-coach.html?volumen=comparar (datos ficticios, solo Preview).
// Uso:  node scripts/qa/volumen-demo.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 320,390,430] [--out <carpeta>]
// Verifica en Chromium, oscuro y claro, con TODA la red externa bloqueada: la tarjeta «DEMO · Comparación de volumen» muestra
// «Ahora: 1840 kg» y las 4 cifras anteriores (1840 / 1000 / 2290 / 2290), una linea por ejercicio (plancha excluida por tiempo),
// sin overflow horizontal, sin errores de pagina, contraste >= 4.5 y controles de la tarjeta >= 44 px.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/progreso-coach.html";
const SIZES = { 320: 640, 375: 667, 390: 844, 430: 932 };
const o = { widths: [320, 390, 430] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-volumen-"));
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

const MEDIR = `(() => {
  const card = document.querySelector('[data-qa="volumen-comparar"]');
  if (!card) return null;
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = (c) => { const f = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const bgDe = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.99)) return c; } return [255, 255, 255]; };
  let peor = 21, peorTxt = '';
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  for (let t; (t = walker.nextNode());) {
    if (!t.textContent.trim()) continue;
    const e = t.parentElement, fg = rgb(getComputedStyle(e).color), bg = bgDe(e);
    const a = lum(fg), b = lum(bg), cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    if (cr < peor) { peor = cr; peorTxt = t.textContent.trim().slice(0, 40); }
  }
  const r = card.getBoundingClientRect();
  const ctl = [...card.querySelectorAll('button,a[href],input,select,[role=button]')].map((e) => e.getBoundingClientRect()).filter((x) => x.width < 43.5 || x.height < 43.5).length;
  const q = (s) => { const e = card.querySelector('[data-qa="' + s + '"]'); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : ''; };
  return {
    left: r.left, right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth, contraste: peor, peorTxt, chicos: ctl,
    ahora: q('volumen-ahora'), A: q('volumen-antes-A'), B: q('volumen-antes-B'), C: q('volumen-antes-C'), D: q('volumen-antes-D'),
    ejercicios: q('volumen-ejercicios'), titulo: card.innerText, previa: q('volumen-previa'),
  };
})()`;

for (const tema of ["oscuro", "claro"]) {
  for (const width of o.widths) {
    const tag = "@" + width + "/" + tema;
    const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const external = new Set(), errors = [];
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
      external.add(u.hostname);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO + "?volumen=comparar", { waitUntil: "load" });
    await page.waitForSelector('[data-qa="volumen-comparar"]', { timeout: 15000 });
    if (tema === "claro") { await page.click('[data-qa="demo-tema"]'); await page.waitForTimeout(300); }
    await page.waitForTimeout(800);
    const m = await page.evaluate(MEDIR);
    check(!!m, tag + " existe la tarjeta de comparacion");
    if (m) {
      check(/DEMO · Comparación de volumen/.test(m.titulo), tag + " titulo");
      check(/Ahora: 1840 kg en todas las pantallas/.test(m.ahora), tag + " «Ahora» = 1840 (" + m.ahora + ")");
      check(/1840 kg/.test(m.A), tag + " A = 1840 (" + m.A + ")");
      check(/1000 kg/.test(m.B), tag + " B = 1000 (" + m.B + ")");
      check(/2290 kg/.test(m.C), tag + " C = 2290 (" + m.C + ")");
      check(/2290 kg/.test(m.D), tag + " D = 2290 (" + m.D + ")");
      check(/Plancha con peso\s*Excluido · por tiempo/.test(m.ejercicios), tag + " plancha excluida por tiempo");
      check((m.ejercicios.match(/Incluido/g) || []).length === 5, tag + " 5 ejercicios incluidos");
      check(m.left >= -0.5 && m.right <= m.vw + 0.5, tag + " la tarjeta entra en la pantalla (" + Math.round(m.left) + ".." + Math.round(m.right) + " / " + m.vw + ")");
      check(m.sw <= m.vw + 1, tag + " sin overflow horizontal (" + m.sw + " > " + m.vw + ")");
      check(m.contraste >= 4.5, tag + " contraste >= 4.5 (" + m.contraste.toFixed(2) + " en «" + m.peorTxt + "»)");
      check(m.chicos === 0, tag + " controles de la tarjeta >= 44 px");
    }
    check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
    const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
    check(ext.length === 0, tag + " sin red externa: " + ext.join(","));
    if (o.out) await page.screenshot({ path: path.join(o.out, "volumen_" + tema + "_" + width + ".png") });
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("VOLUMEN-DEMO OK");
