// QA visual de Progreso -> Evolucion de carga con datos FICTICIOS (sin Supabase ni red).
// Uso:  node scripts/qa/progreso-carga-visual.mjs --out <carpeta> [--dist <dir>] [--widths 320,375,390,430,768,1280]
//         [--themes dark,light] [--scenarios vacio,una,varias,hueco] [--lang es|en|pt]
//   (con el arnes del repo:  scratchpad/sync_and_run.sh node scripts/qa/progreso-carga-visual.mjs --out <carpeta>)
// Por cada ancho x tema x escenario abre Progreso; en <768 abre la hoja inferior "Evolucion de carga" desde la mini-card,
// en >=1024 usa la tarjeta en linea (a 768 el coach no tiene menu: se omite, igual que qa:ui).
// Verifica: sin overflow horizontal; controles interactivos >=44 px en <768 (dentro de la hoja); texto dentro de su contenedor
// (etiquetas del grafico y de la hoja); la hoja cabe en el viewport. Escribe capturas, summary.json y summary.md en --out.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SIZES = { 320: 640, 375: 667, 390: 844, 430: 932, 768: 1024, 1280: 800 };

export function parseArgs(argv) {
  const o = { widths: [320, 375, 390, 430, 768, 1280], themes: ["dark", "light"], scenarios: ["vacio", "una", "varias", "hueco"], lang: "es" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else if (a === "--themes") o.themes = argv[++i].split(",");
    else if (a === "--scenarios") o.scenarios = argv[++i].split(",");
    else if (a === "--lang") o.lang = argv[++i];
    else throw new Error("Opcion desconocida: " + a);
  }
  if (!o.out) throw new Error("Falta --out <carpeta>");
  return o;
}

function build(outDir) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: ROOT, stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" },
  });
  if (r.status !== 0) throw new Error("El build de QA fallo");
}

// Dentro de la pagina: mide la hoja (o la tarjeta en linea) y el grafico.
const MEASURE = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const root = document.querySelector('[data-qa-load-root]');
  if (!root) return { found: false };
  const rr = root.getBoundingClientRect();
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || e.value || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
  const controls = [...root.querySelectorAll('button,a[href],input,select,textarea,[role=button]')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { k: e.tagName.toLowerCase() + '|' + lab(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; });
  const small = controls.filter((c) => c.w < 43.5 || c.h < 43.5);
  const outside = [];
  for (const e of root.querySelectorAll('*')) {
    if (!vis(e) || e.closest('option')) continue;
    const r = e.getBoundingClientRect();
    if (e.tagName.toLowerCase() === 'svg' || e.closest('svg')) {
      if (e.tagName.toLowerCase() === 'text') {
        const svg = e.ownerSVGElement.getBoundingClientRect();
        if (r.left < svg.left - 0.5 || r.right > svg.right + 0.5 || r.top < svg.top - 0.5 || r.bottom > svg.bottom + 0.5) outside.push('svg-text|' + (e.textContent || '').slice(0, 20));
      }
      continue;
    }
    if (r.left < rr.left - 1 || r.right > rr.right + 1) outside.push(e.tagName.toLowerCase() + '|' + lab(e));
    if (e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible' && getComputedStyle(e).display !== 'inline') outside.push('texto-recortable|' + lab(e));
  }
  const svg = root.querySelector('svg[data-qa-load-svg], svg[viewBox="0 0 300 100"]');
  const sr = svg ? svg.getBoundingClientRect() : null;
  const chart = root.querySelector('[data-qa-load-chart]');
  return {
    found: true,
    dialog: root.getAttribute('role') === 'dialog' ? { modal: root.getAttribute('aria-modal'), label: root.getAttribute('aria-label') } : null,
    rect: { top: +rr.top.toFixed(1), bottom: +rr.bottom.toFixed(1), left: +rr.left.toFixed(1), right: +rr.right.toFixed(1), h: +rr.height.toFixed(1) },
    fitsViewport: rr.top >= -0.5 && rr.bottom <= innerHeight + 0.5 && rr.left >= -0.5 && rr.right <= innerWidth + 0.5,
    scrolls: (() => { const b = root.querySelector('[data-sheet-body]') || root; return b.scrollHeight > b.clientHeight + 1; })(),
    controls: controls.length, small, outside,
    svgH: sr ? +sr.height.toFixed(1) : null, svgW: sr ? +sr.width.toFixed(1) : null,
    chartPresent: !!chart,
    overflow: document.documentElement.scrollWidth > innerWidth + 1, docW: document.documentElement.scrollWidth, vw: innerWidth,
  };
})()`;

async function openLoad(page, width) {
  if (width < 768) {
    const ok = await page.evaluate(() => {
      const title = [...document.querySelectorAll("span")].find((s) => /^(Evolución de carga|Load progression)$/.test((s.textContent || "").trim()));
      const card = title && title.parentElement && title.parentElement.parentElement;
      if (!card) return false;
      card.click();
      return true;
    });
    if (!ok) return false;
    await page.waitForTimeout(500);
    return page.evaluate(() => {
      const ov = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).position === "fixed" && d.style.zIndex === "1000");
      const sheet = ov && ov.firstElementChild;
      if (!sheet) return false;
      sheet.setAttribute("data-qa-load-root", "1");
      return true;
    });
  }
  return page.evaluate(() => {
    const t = [...document.querySelectorAll("span")].find((s) => /^(Evolución de carga|Load progression)$/.test((s.textContent || "").trim()));
    let el = t;
    while (el && !(getComputedStyle(el).borderTopWidth !== "0px" && el.style.borderRadius)) el = el.parentElement;
    if (!el) return false;
    el.setAttribute("data-qa-load-root", "1");
    return true;
  });
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) { dist = path.join(os.tmpdir(), "irontrack-qa-carga-" + Date.now()); build(dist); }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  const rows = [];
  const failures = [];
  for (const scenario of o.scenarios) {
    process.env.QA_PROGRESO_SCENARIO = scenario;
    for (const theme of o.themes) {
      for (const width of o.widths) {
        const id = `${scenario}_${theme}_${width}`;
        const height = SIZES[width] || 900;
        const { ctx, page, state } = await openPage(browser, { port, width, height, touch: width < 1024 });
        await page.evaluate(([dark, lang]) => { localStorage.setItem("it_dark", dark); localStorage.setItem("it_lang", lang); }, [theme === "dark" ? "true" : "false", o.lang]);
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(1800);
        const nav = await gotoSection(page, "Progreso", width);
        if (!nav) { rows.push({ id, scenario, theme, width, skipped: "sin acceso a Progreso con este ancho" }); await ctx.close(); continue; }
        const opened = await openLoad(page, width);
        if (!opened) { rows.push({ id, scenario, theme, width, skipped: "no se encontro Evolucion de carga" }); failures.push(id + ": no se pudo abrir Evolucion de carga"); await ctx.close(); continue; }
        await page.waitForTimeout(300);
        const m = await page.evaluate(MEASURE);
        const shot = path.join(o.out, id + ".png");
        if (width >= 1024) await page.locator("[data-qa-load-root]").screenshot({ path: shot });
        else await page.screenshot({ path: shot });
        let shot2 = null;
        if (m.scrolls) {
          await page.evaluate(() => { const r = document.querySelector("[data-qa-load-root]"); const b = r.querySelector("[data-sheet-body]") || r; b.scrollTop = b.scrollHeight; });
          await page.waitForTimeout(150);
          shot2 = path.join(o.out, id + "_scroll.png");
          await page.screenshot({ path: shot2 });
        }
        rows.push({ id, scenario, theme, width, shot, shot2, ...m, pageErrors: [...state.pageErrors] });
        if (m.overflow) failures.push(id + ": overflow horizontal (" + m.docW + " > " + m.vw + ")");
        if (state.pageErrors.length) failures.push(id + ": errores de pagina: " + state.pageErrors[0]);
        if (width < 768) {
          if (m.small.length) failures.push(id + ": controles <44 px: " + m.small.map((s) => s.k + " " + s.w + "x" + s.h).join("; "));
          if (!m.fitsViewport) failures.push(id + ": la hoja no cabe en el viewport " + JSON.stringify(m.rect));
        }
        if (m.outside.length) failures.push(id + ": texto fuera de su contenedor: " + m.outside.slice(0, 4).join("; "));
        await ctx.close();
      }
    }
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ rows, failures }, null, 1));
  const lines = ["id | overflow | <44px | fuera | cabe | scroll | svgH | hoja h", ...rows.map((r) => r.skipped ? r.id + " | omitida (" + r.skipped + ")" : [r.id, r.overflow ? "SI" : "no", r.small.length, r.outside.length, r.fitsViewport ? "si" : "NO", r.scrolls ? "si" : "no", r.svgH ?? "-", r.rect.h].join(" | "))];
  fs.writeFileSync(path.join(o.out, "summary.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  console.log("\nSalida:", o.out);
  if (failures.length) { console.error("\nPROGRESO-CARGA FALLA\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("\nPROGRESO-CARGA OK");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(2); });
}
