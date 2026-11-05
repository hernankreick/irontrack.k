// QA de la demostracion D76-08 (demo/sync-pendientes.html, datos ficticios, solo Preview). Opcional: no es una suite test-*.mjs.
// Uso:  node scripts/qa/sync-pendientes-demo.mjs --out <carpeta> [--dist <dir>] [--widths 375,390,430]
//   Sin --dist compila como Preview simulado (VERCEL_ENV=preview, backend .invalid) y ADEMAS compila Production para verificar que la
//   demo no se genera alli.
// Verifica, en modo oscuro y claro: la demo existe en Preview y NO en Production; pedidos externos abortados y registrados (falla si
// alguno va a un backend); localStorage/sessionStorage sin escrituras; sin overflow horizontal, sin controles <44 px ni errores de pagina; el flujo
// "Registrar serie sin conexion" -> indicador visible -> "Recuperar conexion" -> sin pendientes; y "Ejecutar pruebas automaticas" con
// todos los escenarios en PASS. Escribe capturas y summary.json en --out.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/sync-pendientes.html";

function parseArgs(argv) {
  const o = { widths: [375, 390, 430] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else throw new Error("Opcion desconocida: " + a);
  }
  if (!o.out) throw new Error("Falta --out <carpeta>");
  return o;
}

function build(outDir, target) {
  const env = { ...process.env, VERCEL: "1", VERCEL_ENV: target };
  if (target === "preview") Object.assign(env, { VITE_SUPABASE_URL: "https://sin-backend.invalid", VITE_SUPABASE_ANON_KEY: "mock-anon-key-preview-qa" });
  else Object.assign(env, { VITE_SUPABASE_URL: "https://qa-produccion.example-host.com", VITE_SUPABASE_ANON_KEY: "mock-anon-key-production-qa" });
  const r = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--outDir", outDir, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error("build " + target + " fallo:\n" + (r.stdout + r.stderr).slice(-2000));
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

const MEASURE = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const ctl = [...document.querySelectorAll('button,a[href],input,select,textarea,[role=button]')].filter(vis);
  const small = ctl.map((e) => { const r = e.getBoundingClientRect(); return { k: lab(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }).filter((c) => c.w < 43.5 || c.h < 43.5);
  return { small, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
})()`;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  fs.mkdirSync(o.out, { recursive: true });
  const failures = [];
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-sync-prev-" + Date.now()); build(dist, "preview");
    const prod = path.join(os.tmpdir(), "irontrack-sync-prod-" + Date.now()); build(prod, "production");
    const prodHasDemo = fs.existsSync(path.join(prod, DEMO)) || fs.readdirSync(path.join(prod, "assets")).some((f) => /demo/i.test(f) ||
      (f.endsWith(".js") && /syncPendientesDemo|demo-alumno-a|Demo D76-08/.test(fs.readFileSync(path.join(prod, "assets", f), "utf8"))));
    if (prodHasDemo) failures.push("Production contiene la demo (HTML o codigo)");
    console.log("Production sin demo:", !prodHasDemo);
  }
  if (!fs.existsSync(path.join(dist, DEMO))) throw new Error("El build no contiene " + DEMO + " (debe ser un build de Preview)");
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const { server, port } = await serve(dist);
  const results = [];
  for (const colorScheme of ["dark", "light"]) {
    for (const width of o.widths) {
      const id = colorScheme + "@" + width;
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme });
      const external = [];
      await ctx.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
        external.push(route.request().method() + " " + u.hostname);
        return route.abort();
      });
      await ctx.addInitScript(() => {
        window.__storageWrites = [];
        for (const s of [window.localStorage, window.sessionStorage]) {
          for (const m of ["setItem", "removeItem", "clear"]) {
            const orig = s[m].bind(s);
            s[m] = function () { window.__storageWrites.push(m + " " + (arguments[0] || "")); return orig.apply(null, arguments); };
          }
        }
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      const wait = (ms) => page.waitForTimeout(ms);
      const shot = (n) => page.screenshot({ path: path.join(o.out, colorScheme + "_" + width + "_" + n + ".png"), fullPage: true });
      const click = (re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button")].find((e) => e.getBoundingClientRect().width > 0 && !e.disabled && r.test(((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")).trim())); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; }, re.source);
      const text = () => page.evaluate(() => document.body.innerText.replace(/ /g, " "));
      const flow = {};
      await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
      await wait(800);
      flow.inicioSinIndicador = !(await page.$("[data-qa-pending-sync]"));
      await shot("01_inicio");
      await click(/^Registrar 3 series sin conexión$/); await wait(300);
      flow.offline = /Sin conexión · 3 series guardadas en este dispositivo, todavía sin sincronizar/.test(await text());
      const m1 = await page.evaluate(MEASURE);
      await shot("02_offline");
      await click(/^Simular error HTTP/); await wait(100);
      await click(/^Recuperar conexión$/); await wait(800);
      flow.error = /3 series pendientes · No se pudieron sincronizar/.test(await text());
      const m2 = await page.evaluate(MEASURE);
      await shot("03_error");
      await click(/^Simular error HTTP/); await wait(100);
      flow.reintentoIndicador = await click(/^Reintentar$/); await wait(800);
      flow.sincronizado = !(await page.$("[data-qa-pending-sync]")) && !/Sincronizado/.test(await text());
      await shot("04_sincronizado");
      await click(/^Ejecutar pruebas automáticas$/);
      await page.waitForSelector("[data-qa-resumen]", { timeout: 60000 }).catch(() => {});
      flow.pruebas = await page.evaluate(() => (document.querySelector("[data-qa-resumen]") || {}).getAttribute?.("data-qa-resumen") === "pass");
      const resumen = await page.evaluate(() => (document.querySelector("[data-qa-resumen]") || {}).innerText || "");
      const m3 = await page.evaluate(MEASURE);
      await shot("05_pruebas");
      const storageWrites = await page.evaluate(() => window.__storageWrites);
      const r = { id, resumen, measures: [m1, m2, m3], flow, external, storageWrites, errors };
      results.push(r);
      [m1, m2, m3].forEach((m, i) => {
        if (m.overflow) failures.push(id + ": overflow horizontal (paso " + (i + 1) + ")");
        if (m.small.length) failures.push(id + ": controles <44 px (paso " + (i + 1) + "): " + JSON.stringify(m.small));
      });
      Object.entries(flow).forEach(([k, ok]) => { if (!ok) failures.push(id + ": flujo '" + k + "' no funciono"); });
      // Igual que demo-ficha.mjs: todo pedido externo se aborta y se informa; falla si apunta a un backend (index.css pide fuentes de Google).
      const backend = external.filter((x) => /supabase|\.invalid|example-host/i.test(x));
      if (backend.length) failures.push(id + ": pedidos a un backend: " + JSON.stringify(backend));
      if (storageWrites.length) failures.push(id + ": escrituras en localStorage/sessionStorage: " + JSON.stringify(storageWrites));
      if (errors.length) failures.push(id + ": errores de pagina: " + errors[0]);
      await ctx.close();
    }
  }
  server.close();
  await browser.close();
  fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ results, failures }, null, 1));
  for (const r of results) console.log(r.id, "|", r.resumen, "| pedidos externos:", [...new Set(r.external)].join(", ") || "ninguno", "| escrituras storage:", r.storageWrites.length);
  console.log(failures.length ? "FALLAS:\n- " + failures.join("\n- ") : "sync-pendientes-demo OK (" + results.length + " combinaciones)");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
