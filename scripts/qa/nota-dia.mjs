// QA en navegador de «Nota del día» (H1/H2/H3) sobre la demo REAL de «Mis alumnos» (demo/mis-alumnos.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/nota-dia.mjs [--dist <dir compilado como Preview>] [--out <carpeta de capturas>] [--widths 375,390,430]
// Red externa bloqueada (se abortan todos los pedidos fuera del servidor local; cualquiera a Supabase o *.invalid falla el QA, como
// en demo-ficha.mjs: las fuentes web de AppGlobalStyles solo se registran). Por ancho y tema (oscuro/claro) verifica:
//   H1  nota escrita para Lucía no aparece en Mateo; volver a Lucía -> vacío; contraer/expandir Lucía conserva el borrador;
//       envío de Lucía pendiente + abrir Mateo -> el resultado tardío no toca la ficha de Mateo (aviso con el nombre de Lucía).
//   H3  dos clics en el mismo ciclo -> «Enviando…», botón deshabilitado y UNA sola nota recibida por el servidor simulado.
//   H2  Error HTTP / Sin red / Sin confirmar -> sin «Nota enviada ✓», error visible, texto conservado; reintento OK -> 1 nota.
//   Sin overflow horizontal; controles de la nota >= 44 px; sin errores de página.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/mis-alumnos.html";
const SIZES = { 375: 667, 390: 844, 430: 932 };

function parseArgs(argv) {
  const o = { widths: [375, 390, 430] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else throw new Error("Opcion desconocida: " + a);
  }
  return o;
}

function build(outDir) {
  const env = { ...process.env, VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: "https://sin-backend.invalid", VITE_SUPABASE_ANON_KEY: "mock-anon-key-preview-qa" };
  const r = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--outDir", outDir, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error("build preview fallo:\n" + (r.stdout + r.stderr).slice(-2000));
}

function serve(dist) {
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const f = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
      if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("no existe"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.out) fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) { dist = path.join(os.tmpdir(), "irontrack-nota-dia-" + Date.now()); build(dist); }
  if (!fs.existsSync(path.join(dist, DEMO))) throw new Error("el build no contiene " + DEMO + " (compilar como Preview)");
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const { server, port } = await serve(dist);
  const failures = [];
  const results = [];
  const check = (cond, label) => { if (!cond) failures.push(label); return !!cond; };

  for (const width of o.widths) {
    for (const tema of ["dark", "light"]) {
      const tag = width + "/" + tema;
      const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const pageErrors = [], external = [];
      page.on("pageerror", (e) => pageErrors.push(String(e)));
      await page.route("**/*", (route) => {
        const u = route.request().url();
        if (u.startsWith("http://127.0.0.1:" + port + "/")) return route.continue();
        external.push(u); return route.abort();
      });
      await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
      await page.click('[data-demo-theme="' + tema + '"]');
      const area = page.locator('[data-qa="nota-dia-texto"]');
      const btn = page.locator('[data-qa="nota-dia-enviar"]');
      const recibidas = async () => Number(await page.getAttribute("[data-demo-notas-recibidas]", "data-demo-notas-recibidas"));
      const toast = async () => (await page.locator('[role="status"]').allInnerTexts()).join(" | ");
      const modo = (k) => page.click('[data-demo-nota-modo="' + k + '"]');
      const ver = async (nombre) => { await page.click('button[aria-label^="Ver ficha de ' + nombre + '"]'); await area.waitFor({ state: "visible" }); };
      const contraer = (nombre) => page.click('button[aria-label^="Contraer ficha de ' + nombre + '"]');
      const shot = async (n) => { if (o.out) { await area.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(o.out, "nota_" + n + "_" + width + "_" + tema + ".png") }); } };

      // ---- H1 ----
      await ver("Lucía");
      await area.fill("Nota privada para Lucía");
      await contraer("Lucía"); await ver("Lucía");
      check(await area.inputValue() === "Nota privada para Lucía", tag + " H1 contraer/expandir Lucía conserva el borrador");
      await contraer("Lucía"); await ver("Mateo");
      check(await area.inputValue() === "", tag + " H1 la nota de Lucía NO aparece en Mateo");
      await shot("h1_mateo");
      await contraer("Mateo"); await ver("Lucía");
      check(await area.inputValue() === "", tag + " H1 volver a Lucía después de Mateo: vacío");

      // ---- H3 ----
      await area.fill("Doble toque");
      await btn.evaluate((b) => { b.click(); b.click(); });
      await page.waitForTimeout(150);
      check((await btn.innerText()).trim() === "Enviando…", tag + " H3 «Enviando…» durante el envío");
      check(await btn.isDisabled(), tag + " H3 botón deshabilitado durante el envío");
      check(!!(await area.getAttribute("readonly") !== null), tag + " H3 texto de solo lectura durante el envío");
      await shot("h3_enviando");
      await page.waitForFunction(() => document.querySelector('[data-qa="nota-dia-enviar"]').innerText.trim() === "Enviar nota", null, { timeout: 5000 });
      check(await recibidas() === 1, tag + " H3 una sola nota recibida (" + (await recibidas()) + ")");
      check(!(await btn.isDisabled()), tag + " H3 botón recuperado tras el éxito");
      check(await area.inputValue() === "", tag + " éxito: borrador vacío");
      check((await toast()).includes("Nota enviada ✓"), tag + " éxito: aviso «Nota enviada ✓»");

      // ---- H2 ----
      for (const [k, esperado] of [["http", "No se pudo enviar la nota"], ["red", "No se pudo enviar la nota"], ["sin_confirmar", "No se pudo confirmar el envío"]]) {
        await modo(k);
        await area.fill("Reintento " + k);
        await btn.click();
        await page.waitForSelector('[data-qa="nota-dia-error"]', { timeout: 5000 });
        const err = await page.locator('[data-qa="nota-dia-error"]').innerText();
        check(err.includes(esperado), tag + " H2 " + k + ": error visible (" + err + ")");
        check(await area.inputValue() === "Reintento " + k, tag + " H2 " + k + ": texto conservado");
        check(!(await toast()).includes("Nota enviada ✓"), tag + " H2 " + k + ": sin aviso de éxito");
        check(!(await btn.isDisabled()), tag + " H2 " + k + ": botón recuperado tras el error");
        if (k === "http") await shot("h2_error");
        await modo("ok");
        await btn.click();
        await page.waitForFunction(() => !document.querySelector('[data-qa="nota-dia-error"]') && document.querySelector('[data-qa="nota-dia-enviar"]').innerText.trim() === "Enviar nota", null, { timeout: 5000 });
        check(await area.inputValue() === "", tag + " H2 " + k + ": reintento OK vacía el borrador");
      }
      check(await recibidas() === 4, tag + " H2 solo los envíos OK llegaron (" + (await recibidas()) + ")");

      // ---- H1 tardío: envío de Lucía pendiente y se abre Mateo ----
      await area.fill("Para Lucía (tardía)");
      await btn.click();
      await contraer("Lucía"); await ver("Mateo");
      check(await area.inputValue() === "", tag + " H1 tardío: Mateo vacío mientras Lucía envía");
      check((await btn.innerText()).trim() === "Enviar nota" && !(await btn.isDisabled()), tag + " H1 tardío: Mateo no hereda «Enviando…»");
      await area.fill("Borrador de Mateo");
      await page.waitForFunction((n) => Number(document.querySelector("[data-demo-notas-recibidas]").getAttribute("data-demo-notas-recibidas")) === n, 5, { timeout: 5000 });
      await page.waitForTimeout(100);
      check(await area.inputValue() === "Borrador de Mateo", tag + " H1 tardío: el éxito de Lucía no borra el borrador de Mateo");
      check((await toast()).includes("Nota enviada ✓ · Lucía"), tag + " H1 tardío: aviso con el nombre de Lucía");
      const ultima = await page.locator("[data-demo-notas-recibidas]").innerText();
      check(ultima.includes("Lucía") && ultima.includes("Para Lucía (tardía)"), tag + " H1 tardío: la nota llegó a Lucía (" + ultima + ")");

      // ---- medidas ----
      const m = await page.evaluate(() => {
        const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { w: b.width, h: b.height }; };
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1, btn: r('[data-qa="nota-dia-enviar"]'), area: r('[data-qa="nota-dia-texto"]'), fs: getComputedStyle(document.querySelector('[data-qa="nota-dia-texto"]')).fontSize };
      });
      check(!m.overflow, tag + " sin overflow horizontal");
      check(m.btn.h >= 43.5, tag + " botón «Enviar nota» >= 44 px (" + m.btn.h + ")");
      check(parseFloat(m.fs) >= 16, tag + " textarea >= 16 px (sin zoom de iOS) (" + m.fs + ")");
      check(!pageErrors.length, tag + " sin errores de página: " + pageErrors[0]);
      const backend = external.filter((u) => /supabase|\.invalid/i.test(u));
      check(!backend.length, tag + " sin pedidos a Supabase/backend: " + backend[0]);
      results.push({ tag, m, pageErrors: pageErrors.length, hosts: [...new Set(external.map((u) => new URL(u).hostname))] });
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  if (o.out) fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ results, failures }, null, 1));
  for (const r of results) console.log(r.tag + " | overflow " + (r.m.overflow ? "SI" : "no") + " | boton " + r.m.btn.h + " px | textarea " + r.m.fs + " | externos bloqueados: " + (r.hosts.join(", ") || "ninguno"));
  if (failures.length) { console.error("\nFALLAS:\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("\nQA nota-dia OK (" + results.length + " combinaciones ancho/tema)");
}

main().catch((e) => { console.error(e); process.exit(1); });
