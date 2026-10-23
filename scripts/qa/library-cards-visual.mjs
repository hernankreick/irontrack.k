// Capturas y medicion de las tarjetas de Ejercicios (Biblioteca), oscuro y claro, con datos ficticios.
//   node scripts/qa/library-cards-visual.mjs --out <dir> [--tag before|after] [--dist <dir>] [--widths 375,390,430,768,1280] [--themes dark,light]
// Nombres: <tag>_<dark|light>_<ancho>.png. Mide la primera tarjeta: fondo vs fondo efectivo del padre, borde y sombra.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SIZES = { 375: 667, 390: 844, 430: 932, 768: 1024, 1280: 800 };

function parse(argv) {
  const o = { tag: "after", widths: Object.keys(SIZES).map(Number), themes: ["dark", "light"] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--tag") o.tag = argv[++i];
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else if (a === "--themes") o.themes = argv[++i].split(",");
    else throw new Error("Opcion desconocida: " + a);
  }
  return o;
}

async function openLibrary(page, width) {
  if (await gotoSection(page, "Ejercicios", width)) return true;
  // A 768 px no hay menu del coach: clic por DOM sobre cualquier control que diga Ejercicios / Biblioteca.
  return page.evaluate(async () => {
    const b = [...document.querySelectorAll("button,a")].find((e) => /ejercicios|biblioteca|exercises/i.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")) && e.getBoundingClientRect().width > 0);
    if (!b) return false;
    b.click();
    await new Promise((r) => setTimeout(r, 1000));
    return true;
  });
}

// Dentro de la pagina: mide la primera tarjeta.
const MEASURE = () => {
  const card = document.querySelector(".it-bib-ex-card");
  if (!card) return null;
  const parse = (c) => { const m = c.match(/[\d.]+/g) || []; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] }; };
  const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  let parentBg = { r: 255, g: 255, b: 255, a: 1 };
  const chain = [];
  for (let p = card.parentElement; p; p = p.parentElement) chain.push(parse(getComputedStyle(p).backgroundColor));
  for (const c of chain.reverse()) if (c.a > 0) parentBg = over(c, parentBg);
  const cs = getComputedStyle(card);
  const cardBg = over(parse(cs.backgroundColor), parentBg);
  const l1 = lum(cardBg), l2 = lum(parentBg);
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  const bw = parseFloat(cs.borderTopWidth) || 0;
  const bcol = parse(cs.borderTopColor);
  const bcolOver = over(bcol, parentBg);
  const l3 = lum(bcolOver);
  const borderRatio = (Math.max(l3, l2) + 0.05) / (Math.min(l3, l2) + 0.05);
  const r = card.getBoundingClientRect();
  return {
    cardBg: cs.backgroundColor, parentBg: `rgb(${Math.round(parentBg.r)}, ${Math.round(parentBg.g)}, ${Math.round(parentBg.b)})`,
    bgContrast: +ratio.toFixed(3), border: cs.borderTopWidth + " " + cs.borderTopStyle + " " + cs.borderTopColor, borderVisible: bw > 0 && cs.borderTopStyle !== "none" && bcol.a > 0,
    borderVsParent: +borderRatio.toFixed(3), shadow: cs.boxShadow, radius: cs.borderTopLeftRadius, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
};

async function main() {
  const o = parse(process.argv.slice(2));
  if (!o.out) throw new Error("Falta --out <dir>");
  fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-cards-dist-" + Date.now());
    const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" } });
    if (r.status !== 0) throw new Error("El build de QA fallo");
  }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  const report = [];
  for (const theme of o.themes) {
    for (const width of o.widths) {
      const { ctx, page, state } = await openPage(browser, { port, width, height: SIZES[width] || 900, touch: width < 1024 });
      if (theme === "light") {
        await page.evaluate(() => localStorage.setItem("it_dark", "false"));
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(1500);
      }
      if (!(await openLibrary(page, width))) { report.push({ theme, width, skipped: "no se pudo abrir Ejercicios" }); await ctx.close(); continue; }
      await page.waitForTimeout(500);
      const m = await page.evaluate(MEASURE);
      if (!m) { report.push({ theme, width, skipped: "sin tarjetas" }); await ctx.close(); continue; }
      const file = path.join(o.out, `${o.tag}_${theme}_${width}.png`);
      await page.screenshot({ path: file });
      report.push({ theme, width, file, ...m, pageErrors: state.pageErrors.length });
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(o.out, `${o.tag}_report.json`), JSON.stringify(report, null, 1));
  for (const r of report) {
    if (r.skipped) console.log(`${r.theme}@${r.width}: OMITIDA (${r.skipped})`);
    else console.log(`${r.theme}@${r.width}: bg ${r.cardBg} vs ${r.parentBg} ratio=${r.bgContrast} | borde ${r.border} visible=${r.borderVisible} vsPadre=${r.borderVsParent} | sombra=${r.shadow} | radio=${r.radius} overflow=${r.overflow} errores=${r.pageErrors}`);
  }
  console.log("Salida:", o.out);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
