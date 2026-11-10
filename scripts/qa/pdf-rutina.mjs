// QA visual del PDF de rutina con datos ficticios: renderiza el documento REAL del exportador en Chromium (A4, impresion),
// lo convierte a PDF y verifica contenido, paginas y legibilidad.  Uso:  node scripts/qa/pdf-rutina.mjs [--out <dir>] [--shots]
// Requiere Playwright (del entorno, ver lib.mjs) y `pdftotext`/`pdfinfo`/`pdftoppm` (poppler). Si faltan, informa y sale con 0 sin comprobar.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const OUT = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-pdf-"));
fs.mkdirSync(OUT, { recursive: true });
const SHOTS = args.includes("--shots");

const has = (bin) => spawnSync("which", [bin]).status === 0;
if (!["pdftotext", "pdfinfo"].every(has)) { console.log("QA PDF omitido: falta poppler (pdftotext/pdfinfo)."); process.exit(0); }

const X = await import(pathToFileURL(path.join(ROOT, "lib/routinePdfExport.js")).href);
const D = await import(pathToFileURL(path.join(ROOT, "components/demo/pdfRutinaDemoData.js")).href);
const { chromium } = resolvePlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });

let fails = 0;
const ok = (c, m) => { console.log((c ? "OK   " : "FALLA ") + m); if (!c) fails++; };
const norm = (t) => t.replace(/\s+/g, " ").trim();
const run = (cmd, a) => spawnSync(cmd, a, { encoding: "utf8" });

for (const c of D.RUTINAS_DEMO) {
  const r = c.build();
  const rows = X.buildRoutinePdfRows(r, { allEx: [], es: true, progress: {}, currentWeek: 0 });
  const html = X.buildRoutinePdfDocumentHtml(r, rows, true, { currentWeek: 0 }, { autoPrint: false });
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.emulateMedia({ media: "print" });
  const pdf = path.join(OUT, c.id + ".pdf");
  await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });

  // Legibilidad y desbordes (medidos en el layout de impresion).
  const m = await page.evaluate(() => {
    const out = { overflow: [], minFont: 99, wide: 0 };
    const W = document.documentElement.clientWidth;
    document.querySelectorAll(".itpdf-card, .itpdf-tbl, .itpdf-hero, .itpdf-note-card").forEach((e) => {
      if (e.scrollWidth > e.clientWidth + 1) out.overflow.push(e.className + " " + e.scrollWidth + ">" + e.clientWidth);
      if (e.getBoundingClientRect().right > W + 1) out.wide++;
    });
    document.querySelectorAll(".itpdf-c, .itpdf-th, .itpdf-rl, .itpdf-note-t, .itpdf-ex-name").forEach((e) => {
      out.minFont = Math.min(out.minFont, parseFloat(getComputedStyle(e).fontSize));
    });
    return out;
  });
  await page.close();
  ok(m.overflow.length === 0 && m.wide === 0, `${c.id}: sin desbordes ni tablas fuera de la pagina ${m.overflow.slice(0, 2).join("; ")}`);
  ok(m.minFont >= 10.5, `${c.id}: letra minima ${m.minFont}px (>= 10.5)`);

  const pages = Number((run("pdfinfo", [pdf]).stdout.match(/Pages:\s+(\d+)/) || [])[1]);
  const perPage = Array.from({ length: pages }, (_, i) => norm(run("pdftotext", ["-f", String(i + 1), "-l", String(i + 1), pdf, "-"]).stdout));
  ok(perPage.every((t) => t.length > 80), `${c.id}: ${pages} paginas, ninguna vacia`);
  const text = norm(perPage.join(" "));

  // Contenido: nombre de cada ejercicio, cada semana configurada y cada nota completa.
  let missing = [];
  const exs = r.days.flatMap((d) => [].concat(d.warmup || [], d.exercises || []));
  exs.forEach((ex) => {
    const nombre = String(ex.name);
    if (!nombre.includes("<") && !text.includes(norm(nombre))) missing.push("ejercicio " + nombre);
    (ex.weeks || []).forEach((w, i) => { if (w && w.note && !text.includes(norm(String(w.note)))) missing.push("nota sem " + (i + 1) + " de " + nombre); });
    const n = (ex.weeks || []).length;
    if (n) for (const k of [1, n]) if (!new RegExp("SEM\\s*" + k + "\\b").test(text)) missing.push("SEM " + k);
  });
  ok(missing.length === 0, `${c.id}: contenido completo en el PDF ${missing.slice(0, 3).join(", ")}`);
  if (SHOTS) run("pdftoppm", ["-r", "80", "-png", pdf, path.join(OUT, c.id)]);
}
await browser.close();
console.log("Salida: " + OUT);
console.log(fails ? "QA PDF FALLA (" + fails + ")" : "QA PDF OK");
process.exit(fails ? 1 : 0);
