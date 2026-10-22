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
  await browser.close();
  server.close();
  let total = 0;
  for (const [k, v] of Object.entries(report)) {
    total += v.small.length;
    console.log(k + " | overflow " + (v.overflow ? "SI" : "no") + " | <44: " + v.small.length + (v.small.length ? "\n    " + v.small.join("\n    ") : ""));
  }
  const out = arg("--out");
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1));
  if (total && !process.argv.includes("--report")) process.exit(1);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
