// Regresion del selector de zona horaria (Configuracion > Preferencias): tras cambiar el tema varias veces
// debe seguir con UNA sola flecha (background-repeat no-repeat, 16px 16px, a la derecha).
//   node scripts/qa/settings-select-visual.mjs --out <dir> [--tag before|after] [--dist <dir>] [--widths 390,1280]
// Sale con 1 si alguna medicion no coincide. Datos ficticios, sin Supabase ni red real.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SIZES = { 375: 667, 390: 844, 430: 932, 768: 1024, 1280: 800 };
const SEQ = ["Día", "Noche", "Sistema", "Noche", "Día", "Sistema", "Noche", "Día"]; // >= 6 cambios alternando
const SYS_SCHEMES = { Sistema: ["light", "dark"] };

function parse(argv) {
  const o = { tag: "after", widths: [390, 1280] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--tag") o.tag = argv[++i];
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else throw new Error("Opcion desconocida: " + a);
  }
  return o;
}

const measure = (page) => page.evaluate(() => {
  const s = document.querySelector("select.it-set-select");
  if (!s) return null;
  const cs = getComputedStyle(s);
  const r = s.getBoundingClientRect();
  return { repeat: cs.backgroundRepeat, position: cs.backgroundPosition, size: cs.backgroundSize, hasImage: cs.backgroundImage.startsWith("url("), color: cs.backgroundColor, w: Math.round(r.width) };
});

async function openPrefs(page, width) {
  let opened = await gotoSection(page, "Configuración", width);
  if (!opened) {
    opened = await page.evaluate(async () => {
      const b = [...document.querySelectorAll("button,a")].find((e) => /configuraci|ajustes|settings/i.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")) && e.getBoundingClientRect().width > 0);
      if (!b) return false;
      b.click();
      await new Promise((r) => setTimeout(r, 1000));
      return true;
    });
  }
  if (!opened) return false;
  const ok = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].filter((x) => (x.innerText || "").trim() === "Preferencias" && x.getBoundingClientRect().width > 0).pop();
    if (b) b.click();
    return !!b;
  });
  await page.waitForTimeout(400);
  return ok;
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (!o.out) throw new Error("Falta --out <dir>");
  fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-selectqa-dist-" + Date.now());
    const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" } });
    if (r.status !== 0) throw new Error("El build de QA fallo");
  }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  const failures = [];
  const rows = [];
  for (const width of o.widths) {
    const { ctx, page } = await openPage(browser, { port, width, height: SIZES[width] || 900, touch: width < 1024 });
    if (!(await openPrefs(page, width))) { failures.push(`${width}: no se pudo abrir Preferencias`); await ctx.close(); continue; }
    const steps = [["inicial", null]].concat(SEQ.map((l) => [l, l]));
    let n = 0, scheme = 0;
    for (const [label, click] of steps) {
      if (click) {
        if (SYS_SCHEMES[click]) { scheme = (scheme + 1) % 2; await page.emulateMedia({ colorScheme: SYS_SCHEMES[click][scheme] }); }
        const ok = await page.evaluate((l) => {
          const b = [...document.querySelectorAll("button")].filter((x) => (x.innerText || "").trim().includes(l) && x.getBoundingClientRect().width > 0).pop();
          if (b) b.click();
          return !!b;
        }, click);
        if (!ok) { failures.push(`${width}: boton de tema "${click}" no encontrado`); break; }
        await page.waitForTimeout(250);
      }
      const m = await measure(page);
      if (!m) { failures.push(`${width}: select no encontrado tras "${label}"`); break; }
      const el = await page.$("select.it-set-select");
      await el.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(o.out, `${o.tag}_select_${width}_${String(n).padStart(2, "0")}_${label}.png`), clip: await el.boundingBox().then((b) => ({ x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: Math.min(b.width + 16, width), height: b.height + 16 })) });
      const bad = [];
      if (m.repeat !== "no-repeat") bad.push(`repeat=${m.repeat}`);
      if (m.size !== "16px 16px") bad.push(`size=${m.size}`);
      if (!/^right 12px (50%|center)$/.test(m.position)) bad.push(`position=${m.position}`);
      if (!m.hasImage) bad.push("sin chevron");
      rows.push({ width, step: n, label, ...m, bad });
      console.log(`${width} #${n} ${label}: repeat=${m.repeat} pos=${m.position} size=${m.size} ${bad.length ? "FALLA " + bad.join(",") : "ok"}`);
      if (bad.length) failures.push(`${width} #${n} ${label}: ${bad.join(", ")}`);
      n++;
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(o.out, `${o.tag}_select_report.json`), JSON.stringify({ rows, failures }, null, 1));
  if (failures.length) { console.error("FAIL:\n" + failures.join("\n")); process.exit(1); }
  console.log("PASS: una sola flecha tras", SEQ.length, "cambios de tema");
}

main().catch((e) => { console.error(e.message); process.exit(2); });
