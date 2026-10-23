// Desborde de etiquetas en las tarjetas de Ejercicios (Biblioteca), con datos ficticios, oscuro y claro.
//   node scripts/qa/library-cards-overflow.mjs [--tag before|after] [--out <dir>] [--dist <dir>] [--custom] [--widths 320,375,...] [--themes dark,light]
// Recorre TODAS las tarjetas y falla (exit 1) si una etiqueta no cabe en su fondo, sale de la tarjeta, toca los botones
// de accion, un boton mide < 44 px en < 768 o hay overflow horizontal (tarjeta o documento).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SIZES = { 320: 640, 360: 740, 375: 667, 390: 844, 414: 896, 430: 932, 768: 1024, 1280: 800 };

function parse(argv) {
  const o = { tag: "after", widths: Object.keys(SIZES).map(Number), themes: ["dark", "light"], custom: process.env.QA_CUSTOM_EX === "1" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--tag") o.tag = argv[++i];
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--custom") o.custom = true;
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else if (a === "--themes") o.themes = argv[++i].split(",");
    else throw new Error("Opcion desconocida: " + a);
  }
  return o;
}
const o = parse(process.argv.slice(2));
if (o.custom) { process.env.QA_CUSTOM_EX = "1"; process.env.QA_CUSTOM_LONG = "1"; }

async function openLibrary(page, width) {
  if (await gotoSection(page, "Ejercicios", width)) return true;
  return page.evaluate(async () => {
    const b = [...document.querySelectorAll("button,a")].find((e) => /ejercicios|biblioteca|exercises/i.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")) && e.getBoundingClientRect().width > 0);
    if (!b) return false;
    b.click();
    await new Promise((r) => setTimeout(r, 1000));
    return true;
  });
}

const CHECK = () => {
  const cards = [...document.querySelectorAll(".it-bib-ex-card")];
  const mobile = innerWidth < 768;
  const out = [];
  const heights = [];
  for (const [idx, c] of cards.entries()) {
    c.setAttribute("data-qa-idx", String(idx));
    const cr = c.getBoundingClientRect();
    const title = (c.querySelector(".it-bib-ex-name") || {}).textContent || "";
    const tags = [...c.querySelectorAll(".it-bib-ex-tags > span")];
    const btns = [...c.querySelectorAll(".it-bib-ex-acts > *")].map((b) => b.getBoundingClientRect());
    const acts = c.querySelector(".it-bib-ex-acts");
    const ar = acts ? acts.getBoundingClientRect() : null;
    let maxLines = 0;
    for (const t of tags) maxLines = Math.max(maxLines, Math.round((t.getBoundingClientRect().height - 4) / 12.5));
    const below = !!(ar && tags.length && tags[0].getBoundingClientRect().top >= ar.bottom - 1);
    heights.push({ title: title.slice(0, 30), h: +cr.height.toFixed(1), tags: tags.length, btns: btns.length, maxLines, below });
    const fails = [];
    const th = c.firstElementChild && c.firstElementChild.firstElementChild ? c.firstElementChild.firstElementChild.getBoundingClientRect() : null;
    if (th) for (const [i, b] of btns.entries()) {
      const vOv = Math.min(th.bottom, b.bottom) - Math.max(th.top, b.top);
      if (vOv > 0 && b.left < th.right + (mobile ? 4 : 0) - 0.01 && b.right > th.left) fails.push(`boton ${i + 1} a ${(b.left - th.right).toFixed(1)} px de la miniatura (< ${mobile ? 4 : 0})`);
    }
    if (c.scrollWidth > c.clientWidth + 1) fails.push("overflow horizontal de la tarjeta");
    for (const t of tags) {
      const r = t.getBoundingClientRect(), txt = t.textContent;
      if (t.scrollWidth > t.clientWidth + 1) fails.push(`texto desborda el fondo en X (${t.scrollWidth}>${t.clientWidth}) «${txt}»`);
      if (t.scrollHeight > t.clientHeight + 1) fails.push(`texto desborda el fondo en Y «${txt}»`);
      // Texto real (rango) dentro del rect del fondo.
      const rg = document.createRange(); rg.selectNodeContents(t);
      for (const q of rg.getClientRects()) if (q.left < r.left - 0.5 || q.right > r.right + 0.5) { fails.push(`texto fuera del fondo «${txt}»`); break; }
      if (r.left < cr.left - 0.5 || r.right > cr.right + 0.5 || r.top < cr.top - 0.5 || r.bottom > cr.bottom + 0.5) fails.push(`etiqueta fuera de la tarjeta «${txt}»`);
      for (const [i, b] of btns.entries()) {
        const w = Math.min(r.right, b.right) - Math.max(r.left, b.left), h = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        if (w > 0.5 && h > 0.5) fails.push(`etiqueta «${txt}» intersecta boton ${i + 1}`);
      }
    }
    if (mobile) for (const [i, b] of btns.entries()) if (b.width < 43.5 || b.height < 43.5) fails.push(`boton ${i + 1} ${b.width.toFixed(1)}x${b.height.toFixed(1)} < 44`);
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], b = btns[j];
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) fails.push(`botones ${i + 1} y ${j + 1} se superponen`);
    }
    if (fails.length) out.push({ idx, title: title.slice(0, 50), tags: tags.map((t) => t.textContent), fails });
  }
  return { count: cards.length, failing: out, heights, docOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
};

async function main() {
  const shots = o.out || path.join(os.tmpdir(), "irontrack-overflow-" + Date.now());
  fs.mkdirSync(shots, { recursive: true });
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-overflow-dist-" + Date.now());
    const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" } });
    if (r.status !== 0) throw new Error("El build de QA fallo");
  }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  let total = 0, failCards = 0;
  const summary = [];
  for (const theme of o.themes) for (const width of o.widths) {
    const { ctx, page } = await openPage(browser, { port, width, height: SIZES[width] || 900, touch: width < 1024 });
    if (theme === "light") { await page.evaluate(() => localStorage.setItem("it_dark", "false")); await page.reload({ waitUntil: "load" }); await page.waitForTimeout(1500); }
    if (!(await openLibrary(page, width))) { console.log(`${theme}@${width}: OMITIDA (no se pudo abrir Ejercicios)`); await ctx.close(); continue; }
    await page.waitForTimeout(1500);
    const m = await page.evaluate(CHECK);
    total += m.count;
    const std = m.heights.filter((x) => x.btns === 2 && x.tags === 2).map((x) => x.h);
    const sumH = +m.heights.reduce((a, x) => a + x.h, 0).toFixed(1), lines3 = m.heights.filter((x) => x.maxLines >= 3).length, below = m.heights.filter((x) => x.below && x.btns === 2).length;
    summary.push({ theme, width, count: m.count, failing: m.failing.length, docOverflow: m.docOverflow, stdMin: Math.min(...std), stdMax: Math.max(...std), sumH, lines3, below, cards: m.heights.map((x) => [x.title, x.h]) });
    console.log(`${theme}@${width}: tarjetas=${m.count} fallos=${m.failing.length} docOverflow=${m.docOverflow} alto estandar min/max=${Math.min(...std)}/${Math.max(...std)} sumaAltos=${sumH} etiquetas3+lineas=${lines3} etiquetasDebajoDeAcciones(2 acc.)=${below}`);
    for (const f of m.failing) {
      failCards++;
      console.log(`  FALLO #${f.idx} «${f.title}» etiquetas=${JSON.stringify(f.tags)} ancho=${width}: ${f.fails.join("; ")}`);
    }
    if (m.docOverflow) failCards++;
    for (const f of m.failing.slice(0, 6)) { try { await page.locator(`[data-qa-idx="${f.idx}"]`).screenshot({ path: path.join(shots, `${o.tag}_fail_${theme}_${width}_${f.idx}.png`) }); } catch { /* fuera de vista */ } }
    for (const k of ["Prensa piernas", "Peso muerto sumo", "Hombro/Pecho", "Cuadriceps/Gluteos/Abductores", "Curl femoral propio", "titulo larguisimo"]) {
      try { const l = page.locator(".it-bib-ex-card", { hasText: k }).first(); if (await l.count()) await l.screenshot({ path: path.join(shots, `${o.tag}_${k.replace(/\W+/g, "_")}_${theme}_${width}.png`) }); } catch { /* ausente */ }
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(shots, `${o.tag}_overflow_summary.json`), JSON.stringify(summary, null, 1));
  console.log(`Total tarjetas medidas=${total}; fallos=${failCards}; capturas: ${shots}`);
  if (failCards) process.exitCode = 1;
}
main().catch((e) => { console.error(e.message); process.exit(2); });
