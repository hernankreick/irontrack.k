// Capturas de Configuracion del entrenador (todas las pestañas, oscuro y claro) con datos ficticios.
//   node scripts/qa/settings-visual.mjs --out <dir> [--tag before|after] [--dist <dir>] [--widths 375,390,430,768,1280] [--themes dark,light]
// Nombres: <tag>_<dark|light>_<pestaña>_<ancho>.png. Sin Supabase ni red real (host simulado de lib.mjs).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { AUDIT, chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SIZES = { 375: 667, 390: 844, 430: 932, 768: 1024, 1280: 800 };
const TABS = [["Perfil", "perfil"], ["Preferencias", "preferencias"], ["Negocio", "negocio"], ["Suscripción", "suscripcion"], ["Notificaciones", "notificaciones"], ["Zona de riesgo", "riesgo"]];

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

// A 768 px no hay menu del coach en el arnés: se intenta un clic por DOM sobre cualquier control que diga Configuración / ajustes.
async function openSettings(page, width) {
  if (await gotoSection(page, "Configuración", width)) return true;
  return page.evaluate(async () => {
    const b = [...document.querySelectorAll("button,a")].find((e) => /configuraci|ajustes|settings/i.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")) && e.getBoundingClientRect().width > 0);
    if (!b) return false;
    b.click();
    await new Promise((r) => setTimeout(r, 1000));
    return true;
  });
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (!o.out) throw new Error("Falta --out <dir>");
  fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-settings-dist-" + Date.now());
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
        // openPage siembra it_dark=true solo una vez por sesion: se pisa y se recarga.
        await page.evaluate(() => localStorage.setItem("it_dark", "false"));
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(1500);
      }
      if (!(await openSettings(page, width))) { report.push({ theme, width, skipped: "no se pudo abrir Configuración" }); await ctx.close(); continue; }
      for (const [label, id] of TABS) {
        const clicked = await page.evaluate((l) => {
          const b = [...document.querySelectorAll("button")].filter((x) => (x.innerText || "").trim() === l && x.getBoundingClientRect().width > 0).pop();
          if (b) b.click();
          return !!b;
        }, label);
        if (!clicked) { report.push({ theme, width, tab: id, skipped: "pestaña no encontrada" }); continue; }
        await page.waitForTimeout(300);
        const file = path.join(o.out, `${o.tag}_${theme}_${id}_${width}.png`);
        await page.screenshot({ path: file });
        const a = await page.evaluate(AUDIT);
        report.push({ theme, width, tab: id, file, overflow: a.overflow, small: a.small.length, pageErrors: state.pageErrors.length });
      }
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(o.out, `${o.tag}_report.json`), JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.skipped ? `${r.theme}@${r.width} ${r.tab || ""}: OMITIDA (${r.skipped})` : `${r.theme}@${r.width} ${r.tab}: overflow=${r.overflow} <44px=${r.small} errores=${r.pageErrors}`);
  console.log("Salida:", o.out);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
