// QA visual del panel del entrenador con datos ficticios.  Uso:  npm run qa:ui -- [opciones]
//   --dist <dir>        usa un build existente (por defecto compila a una carpeta temporal con un host simulado)
//   --out <dir>         salida de capturas y resumen (por defecto <tmp>/irontrack-qa-<fecha>)
//   --widths 375,390    anchos a medir (por defecto 375,390,430,768,1280)
//   --sections a,b      secciones (por defecto las 8 del coach)
//   --no-shots          sin capturas
//   --update-baseline   guarda el conteo actual de controles <44 px como nuevo piso (scripts/qa/baseline.json)
// Falla (exit 1) si hay overflow horizontal, errores de pagina o MAS controles <44 px que el baseline.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { AUDIT, chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const BASELINE = path.join(HERE, "baseline.json");
const SIZES = { 375: 667, 390: 844, 430: 932, 768: 1024, 1280: 800 };
const SETTINGS_TABS = ["Perfil", "Negocio", "Suscripción", "Notificaciones", "Zona de riesgo"];
const ALL_SECTIONS = ["Dashboard", "Alumnos", "Rutinas", "Ejercicios", "Calendario", "Mensajes", "Progreso", "Configuración"];

export function parseArgs(argv) {
  const o = { widths: Object.keys(SIZES).map(Number), sections: ALL_SECTIONS, shots: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else if (a === "--sections") o.sections = argv[++i].split(",");
    else if (a === "--no-shots") o.shots = false;
    else if (a === "--update-baseline") o.updateBaseline = true;
    else throw new Error("Opcion desconocida: " + a);
  }
  return o;
}

function build(outDir) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: ROOT, stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" },
  });
  if (r.status !== 0) throw new Error("El build de QA fallo");
}

export function evaluate(results, baseline) {
  const failures = [];
  for (const r of results) {
    if (r.skipped) continue;
    const id = r.section + "@" + r.width;
    if (r.audit.overflow) failures.push(id + ": overflow horizontal (" + r.audit.docW + " > " + r.audit.vw + ")");
    if (r.pageErrors.length) failures.push(id + ": errores de pagina: " + r.pageErrors[0]);
    const base = baseline ? baseline[id] : undefined;
    if (base !== undefined && r.audit.small.length > base) failures.push(id + ": controles <44 px " + r.audit.small.length + " (baseline " + base + ")");
  }
  return failures;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = o.out || path.join(os.tmpdir(), "irontrack-qa-" + stamp);
  fs.mkdirSync(out, { recursive: true });
  let dist = o.dist;
  if (!dist) { dist = path.join(os.tmpdir(), "irontrack-qa-dist-" + stamp); build(dist); }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  const results = [];
  for (const width of o.widths) {
    const height = SIZES[width] || 900;
    const touch = width < 1024;
    const { ctx, page, state } = await openPage(browser, { port, width, height, touch });
    for (const section of o.sections) {
      const ok = await gotoSection(page, section, width);
      if (!ok) { results.push({ section, width, skipped: "sin acceso a la seccion con este ancho" }); continue; }
      const audit = await page.evaluate(AUDIT);
      const shot = o.shots ? path.join(out, section.replace(/\W+/g, "") + "_" + width + ".png") : null;
      if (shot) await page.screenshot({ path: shot });
      results.push({ section, width, audit, pageErrors: [...state.pageErrors], shot });
      // Configuracion en movil: ademas de la primera pestaña, captura y audita las demas (cada una como "Configuración-<pestaña>").
      if (section === "Configuración" && width < 768) {
        for (const tab of SETTINGS_TABS) {
          const clicked = await page.evaluate((label) => {
            const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === label);
            if (b) b.click();
            return !!b;
          }, tab);
          if (!clicked) { results.push({ section: section + "-" + tab, width, skipped: "pestaña no encontrada" }); continue; }
          await page.waitForTimeout(250);
          const tabAudit = await page.evaluate(AUDIT);
          const id = section + "-" + tab;
          const tabShot = o.shots ? path.join(out, id.replace(/\W+/g, "") + "_" + width + ".png") : null;
          if (tabShot) await page.screenshot({ path: tabShot });
          results.push({ section: id, width, audit: tabAudit, pageErrors: [...state.pageErrors], shot: tabShot });
        }
      }
    }
    results.external = [...(results.external || []), ...state.external];
    await ctx.close();
  }
  await browser.close();
  server.close();

  const current = Object.fromEntries(results.filter((r) => !r.skipped).map((r) => [r.section + "@" + r.width, r.audit.small.length]));
  if (o.updateBaseline) { fs.writeFileSync(BASELINE, JSON.stringify(current, null, 1) + "\n"); console.log("baseline actualizado:", BASELINE); }
  const baseline = !o.updateBaseline && fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, "utf8")) : null;
  const failures = evaluate(results, baseline);
  const summary = { out, dist, results: results.map(({ section, width, skipped, audit, pageErrors, shot }) => ({ section, width, skipped, shot, overflow: audit?.overflow, small: audit?.small.length, smallList: audit?.small.map((s) => s.k + " " + s.w + "x" + s.h), overlaps: audit?.overlaps, smallInputs: audit?.smallInputs, pageErrors })), external: [...new Set(results.external || [])], failures };
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
  const lines = ["seccion@ancho | overflow | <44px | solapes | inputs<16", ...summary.results.map((r) => r.skipped ? r.section + "@" + r.width + " | omitida" : [r.section + "@" + r.width, r.overflow ? "SI" : "no", r.small, r.overlaps.length, r.smallInputs.length].join(" | "))];
  fs.writeFileSync(path.join(out, "summary.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  console.log("\nSalida:", out);
  if (failures.length) { console.error("\nQA:UI FALLA\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("\nQA:UI OK");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(2); });
}
