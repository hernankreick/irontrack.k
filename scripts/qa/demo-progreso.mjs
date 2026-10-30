// QA de la demostración de Progreso del entrenador (demo/progreso-coach.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/demo-progreso.mjs --out <carpeta> [--dist <dir>] [--widths 375,390,430]
//   Sin --dist compila Preview simulado (backend .invalid) y ADEMÁS Production, para verificar que la demo no se genera allí.
// Verifica: la demo existe en Preview y NO en Production; ningún pedido a otro host que el servidor local (se registran y se abortan;
// cualquier host de Supabase o *.invalid falla); sin escrituras en localStorage/sessionStorage; sin overflow horizontal ni controles
// < 44 px; y las interacciones reales: período, punto del gráfico de carga, barra compacta al desplazarse, hoja de alumnos, Equipo,
// buscador de ejercicios, historial (Escape cierra) y modo claro/oscuro. Escribe capturas y summary.json en --out.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/progreso-coach.html";

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
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 50);
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
    dist = path.join(os.tmpdir(), "irontrack-demo-progreso-prev-" + Date.now()); build(dist, "preview");
    const prod = path.join(os.tmpdir(), "irontrack-demo-progreso-prod-" + Date.now()); build(prod, "production");
    const prodHasDemo = fs.existsSync(path.join(prod, DEMO)) || fs.readdirSync(path.join(prod, "assets")).some((f) =>
      f.endsWith(".js") && /Progreso del entrenador · datos ficticios|abril@demo\.invalid|progresoCoachDemo/.test(fs.readFileSync(path.join(prod, "assets", f), "utf8")));
    if (prodHasDemo) failures.push("Production contiene la demo (HTML o codigo)");
    console.log("Production sin demo:", !prodHasDemo);
  }
  if (!fs.existsSync(path.join(dist, DEMO))) throw new Error("El build no contiene " + DEMO + " (debe ser un build de Preview)");
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const { server, port } = await serve(dist);
  const results = [];
  for (const width of o.widths) {
    const id = "demo-progreso@" + width;
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: "dark" });
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
    const shot = (n) => page.screenshot({ path: path.join(o.out, width + "_" + n + ".png") });
    const text = () => page.evaluate(() => document.body.innerText);
    const f = {};
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
    await page.waitForSelector('[data-qa="progreso-coach"]', { timeout: 15000 });
    await wait(600);
    const t0 = await text();
    f.bannerDemo = /DEMO/.test(t0) && /datos ficticios/.test(t0);
    f.alumnoInicial = /Seleccionado: Abril Méndez/.test(await page.locator('[data-qa="progreso-alumno-btn"]').getAttribute("aria-label"));
    const m0 = await page.evaluate(MEASURE);
    await shot("01_inicio");
    await page.screenshot({ path: path.join(o.out, width + "_00_completa.png"), fullPage: true });
    // período
    await page.getByRole("button", { name: "8 semanas", exact: true }).first().click(); await wait(300);
    f.periodo = (await page.getByRole("button", { name: "8 semanas", exact: true }).first().getAttribute("aria-pressed")) === "true" && /Período · 8 semanas/i.test(await text());
    await page.getByRole("button", { name: "4 semanas", exact: true }).first().click(); await wait(300);
    // gráfico de carga: tocar un punto con dato lo selecciona
    const pts = page.locator("[data-qa-load-point]");
    f.puntosGrafico = await pts.count();
    if (f.puntosGrafico < 3) failures.push(id + ": el gráfico de carga muestra menos de 3 semanas con dato (" + f.puntosGrafico + ")");
    if (f.puntosGrafico) { await pts.first().scrollIntoViewIfNeeded(); await pts.first().click(); await wait(200); f.puntoSeleccionado = (await pts.first().getAttribute("aria-pressed")) === "true"; }
    // barra compacta debajo del aviso DEMO al desplazarse
    await page.evaluate(() => document.querySelector('[data-qa="seccion-bloque"]').scrollIntoView({ block: "start" })); await wait(400);
    f.compacta = await page.evaluate(() => {
      const c = document.querySelector('[data-qa="progreso-header-compacto"]');
      const b = document.querySelector('[data-qa="demo-banner"]').getBoundingClientRect();
      return getComputedStyle(c.parentElement).visibility === "visible" && Math.abs(c.getBoundingClientRect().top - b.bottom) <= 1;
    });
    await shot("02_compacta");
    await page.evaluate(() => window.scrollTo(0, 0)); await wait(300);
    // hoja de alumnos -> Julián (estancado)
    await page.locator('[data-qa="progreso-alumno-btn"]').click(); await wait(300);
    f.hojaAlumnos = /estancados/i.test(await page.locator('[data-qa-sheet="alumnos"]').innerText());
    await shot("03_alumnos");
    await page.locator('[data-qa-sheet="alumnos"] button', { hasText: "Julián Paz" }).first().click(); await wait(400);
    f.cambioAlumno = /Seleccionado: Julián Paz/.test(await page.locator('[data-qa="progreso-alumno-btn"]').getAttribute("aria-label"));
    await page.locator('[data-qa="progreso-alumno-btn"]').click(); await wait(300);
    await page.locator('[data-qa-sheet="alumnos"] button', { hasText: "Abril Méndez" }).first().click(); await wait(400);
    // Equipo
    const eq = page.locator('[data-qa="equipo-toggle"]');
    await eq.scrollIntoViewIfNeeded();
    f.equipoColapsado = (await eq.getAttribute("aria-expanded")) === "false";
    await eq.click(); await wait(300);
    f.equipoAbierto = (await eq.getAttribute("aria-expanded")) === "true" && /Carla Sosa/.test(await page.locator('[data-section="equipo"]').innerText());
    await page.locator('[data-section="equipo"]').screenshot({ path: path.join(o.out, width + "_04_equipo.png") });
    // buscador de ejercicios -> personalizado -> historial
    await page.locator('[data-qa="ver-ejercicios"]').scrollIntoViewIfNeeded();
    await page.locator('[data-qa="ver-ejercicios"]').click(); await wait(300);
    await page.locator("#progreso-buscar-ejercicio").fill("remo"); await wait(200);
    const hoja = await page.locator('[data-qa-sheet="ejercicios"]').innerText();
    f.buscador = /personalizado/i.test(hoja) && /ya no están en la rutina/i.test(hoja);
    await shot("05_buscador");
    await page.locator("#progreso-buscar-ejercicio").fill("sentadilla"); await wait(200);
    await page.locator('[data-qa-sheet="ejercicios"] [data-qa^="grupo-"] button').first().click(); await wait(400);
    const mas = page.locator('[data-qa-sheet="historial"] button', { hasText: /sesiones más/ });
    if (await mas.count()) { await mas.first().click(); await wait(300); }
    const hist = await page.locator('[data-qa-sheet="historial"]').innerText();
    f.historial = /PR · \+/.test(hist) && /Primera marca/.test(hist) && /Inicio de ciclo/.test(hist);
    f.historialCabe = await page.evaluate(() => { const r = document.querySelector('[data-qa-sheet="historial"]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1; });
    await shot("06_historial");
    await page.keyboard.press("Escape"); await wait(300);
    f.escapeCierra = !(await page.locator('[data-qa-sheet="historial"]').count());
    // modo claro
    await page.locator('[data-qa="demo-tema"]').click(); await wait(400);
    f.modoClaro = await page.evaluate(() => getComputedStyle(document.querySelector('[data-qa="progreso-coach"]')).backgroundColor === "rgb(255, 255, 255)");
    const m1 = await page.evaluate(MEASURE);
    await page.evaluate(() => window.scrollTo(0, 0)); await wait(200);
    await shot("07_claro");
    await page.screenshot({ path: path.join(o.out, width + "_08_claro_completa.png"), fullPage: true });
    const writes = await page.evaluate(() => window.__storageWrites);
    const badHosts = external.filter((e) => /supabase|\.invalid/i.test(e));
    const r = { id, flujos: f, small: m0.small.concat(m1.small), overflow: m0.overflow || m1.overflow, externos: [...new Set(external)], escrituras: writes, errores: errors };
    results.push(r);
    for (const [k, v] of Object.entries(f)) if (v === false || v === 0) failures.push(id + ": flujo " + k);
    if (r.small.length) failures.push(id + ": controles < 44 px " + JSON.stringify(r.small));
    if (r.overflow) failures.push(id + ": overflow horizontal");
    if (badHosts.length) failures.push(id + ": pedidos a Supabase/backend " + badHosts.join(", "));
    if (writes.length) failures.push(id + ": escrituras en almacenamiento " + writes.join(", "));
    if (errors.length) failures.push(id + ": errores de página " + errors.join(" | "));
    await ctx.close();
  }
  server.close();
  await browser.close();
  fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ results, failures }, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log(failures.length ? "FALLAS:\n- " + failures.join("\n- ") : "DEMO PROGRESO OK");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
