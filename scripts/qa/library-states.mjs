// QA de Biblioteca (Ejercicios) en estados con controles extra: filtros/chips expandidos, video abierto y modal de edicion.
// Datos ficticios (host simulado), sin red ni Supabase.  Uso:  node scripts/qa/library-states.mjs [--dist <dir>] [--widths 375,390,430] [--out <archivo.json>]
// Imprime por estado los controles < 44 px que NO estan en la vista base. Sale con 1 si queda alguno (salvo --report).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { AUDIT, chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SIZES = { 375: 667, 390: 844, 430: 932 };

const STATES = {
  base: async () => {},
  filtros: async (page) => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => /todos los ejercicios/i.test(x.innerText || ""));
      b && b.click();
    });
  },
  video: async (page) => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button[aria-label="Ver video"]')].find((x) => x.getBoundingClientRect().width > 0);
      b && b.click();
    });
  },
  edicion: async (page) => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "⋮");
      b && b.click();
    });
  },
};

// Filtros de Biblioteca: movil (< 768) = UN <select>; >= 768 = chips. Devuelve la lista de fallos.
// Nota: a 768 el arnes no puede navegar a Ejercicios (no hay menu del coach), por eso el lado "escritorio" se mide en 1280.
async function checkFilters(page, width) {
  const fails = [];
  const mobile = width < 768;
  await STATES.filtros(page);
  await page.waitForTimeout(400);
  const counter = async () => page.evaluate(() => { const e = [...document.querySelectorAll("div")].find((x) => /^(Mostrando|Showing)\s/.test((x.innerText || "").trim()) && x.children.length === 0); return e ? e.innerText.replace(/\s+/g, " ").trim() : null; });
  const chipCount = () => page.evaluate(() => [...document.querySelectorAll("button.coach-tap")].filter((b) => /^(empuje|tracci|rodilla|bisagra|movilidad|cardio|oly)/i.test((b.innerText || "").trim()) || /^(cu[aá]driceps|gl[uú]teo|isquio|pecho|dorsal)/i.test((b.innerText || "").trim())).length);
  const modeBtn = (re) => page.evaluate((src) => { const b = [...document.querySelectorAll("button")].find((x) => new RegExp(src, "i").test((x.innerText || "").trim())); b && b.click(); }, re.source);
  const sel = page.locator("select#bib-filt-categoria");
  const before = await counter();
  if (!before) fails.push("no se encontro el contador de ejercicios");
  if (!mobile) {
    if ((await sel.count()) !== 0) fails.push("hay <select> de categoria en >= 768");
    if ((await chipCount()) < 5) fails.push("faltan los chips en >= 768");
    return fails;
  }
  if ((await sel.count()) !== 1) return fails.concat("no existe el desplegable de categoria");
  if ((await chipCount()) !== 0) fails.push("siguen visibles los chips");
  const box = await sel.boundingBox();
  if (!box || box.height < 43.5) fails.push("desplegable < 44 px de alto: " + (box && box.height));
  if (box && (box.x < -1 || box.x + box.width > width + 1)) fails.push("desplegable fuera del ancho");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) fails.push("overflow horizontal con el panel abierto");
  if ((await sel.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) < 16) fails.push("fuente < 16 px (zoom iOS)");
  if ((await sel.inputValue()) !== "todos") fails.push("valor inicial distinto de todos");
  if ((await sel.locator("option").count()) !== 9) fails.push("modo patron: se esperaban 9 opciones");
  await sel.selectOption("core");
  if ((await sel.inputValue()) !== "core") fails.push("selectOption(core) no se aplico");
  await modeBtn(/^(Por m[uú]sculo|By muscle)/);
  await page.waitForTimeout(300);
  if ((await sel.inputValue()) !== "todos") fails.push("al cambiar de modo no vuelve a todos");
  if ((await sel.locator("option").count()) !== 11) fails.push("modo musculo: se esperaban 11 opciones");
  await sel.selectOption({ index: 4 });
  if ((await sel.inputValue()) === "todos") fails.push("selectOption en modo musculo no se aplico");
  await sel.selectOption("todos");
  await modeBtn(/^(Por patr[oó]n|By pattern)/);
  await page.waitForTimeout(300);
  // Teclado: foco (focus() equivale al destino de Tab) y cambio de opcion con flechas.
  await sel.focus();
  if (!(await sel.evaluate((e) => document.activeElement === e))) fails.push("el desplegable no recibe foco");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  if ((await sel.inputValue()) === "todos") fails.push("el teclado (ArrowDown) no cambia la categoria");
  await sel.selectOption("todos");
  await page.waitForTimeout(300);
  const after = await counter();
  if (before && after !== before) fails.push("el contador cambio con 'todos': '" + before + "' vs '" + after + "'");
  return fails;
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}

async function main() {
  const widths = arg("--widths", "375,390,430").split(",").map(Number);
  let dist = arg("--dist");
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-qa-lib-dist-" + Date.now());
    const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
      cwd: ROOT, stdio: "ignore",
      env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" },
    });
    if (r.status !== 0) throw new Error("El build de QA fallo");
  }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(path.resolve(dist));
  const report = {};
  for (const width of widths) {
    let baseKeys = new Set();
    for (const [state, act] of Object.entries(STATES)) {
      const { ctx, page } = await openPage(browser, { port, width, height: SIZES[width] || 900, touch: true });
      if (!(await gotoSection(page, "Ejercicios", width))) throw new Error("Sin acceso a Ejercicios en " + width);
      await act(page);
      await page.waitForTimeout(600);
      const a = await page.evaluate(AUDIT);
      const list = a.small.map((s) => s.k + " " + s.w + "x" + s.h);
      if (state === "base") baseKeys = new Set(list);
      report[state + "@" + width] = { overflow: a.overflow, small: state === "base" ? list : list.filter((s) => !baseKeys.has(s)), smallInputs: a.smallInputs };
      await ctx.close();
    }
  }
  const filterFails = {};
  for (const width of [...widths, 1280]) {
    const { ctx, page } = await openPage(browser, { port, width, height: SIZES[width] || 900, touch: width < 768 });
    if (!(await gotoSection(page, "Ejercicios", width))) throw new Error("Sin acceso a Ejercicios en " + width);
    filterFails["filtros-dropdown@" + width] = await checkFilters(page, width);
    await ctx.close();
  }
  await browser.close();
  server.close();
  let total = 0;
  for (const [k, f] of Object.entries(filterFails)) {
    total += f.length;
    console.log(k + " | " + (f.length ? "FAIL\n    " + f.join("\n    ") : "ok"));
  }
  for (const [k, v] of Object.entries(report)) {
    total += v.small.length;
    console.log(k + " | overflow " + (v.overflow ? "SI" : "no") + " | <44: " + v.small.length + (v.small.length ? "\n    " + v.small.join("\n    ") : ""));
  }
  const out = arg("--out");
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
  if (total && !process.argv.includes("--report")) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
