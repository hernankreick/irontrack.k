// QA de la demostracion de la ficha del alumno (demo/ficha-alumno.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/demo-ficha.mjs --out <carpeta> [--dist <dir>] [--widths 320,375,390,430]
//   Sin --dist compila como Preview simulado (VERCEL_ENV=preview, backend .invalid) y ADEMAS compila Production para verificar que la
//   demo no se genera alli.
// Verifica: la demo existe en Preview y NO en Production; cero pedidos a hosts que no sean el servidor local (se registran y se abortan;
// cualquier host de Supabase o *.invalid falla); localStorage/sessionStorage sin escrituras; sin overflow horizontal, controles <44 px ni
// areas tactiles superpuestas en la ficha; y los flujos: expandir/contraer, menus, dias, proxima sesion, validar (hasta confirmar, con
// aviso DEMO), editar y agregar ejercicio (sin guardar). Escribe capturas y summary.json en --out.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/ficha-alumno.html";

function parseArgs(argv) {
  const o = { widths: [320, 375, 390, 430] };
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
  const card = document.querySelector('[data-qa-alumno-card="open"]');
  if (!card) return { found: false };
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const ctl = [...card.querySelectorAll('button,a[href],input,select,textarea,[role=button]')].filter(vis);
  const small = ctl.map((e) => { const r = e.getBoundingClientRect(); return { k: lab(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; }).filter((c) => c.w < 43.5 || c.h < 43.5);
  const overlaps = [];
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const A = ctl[i], B = ctl[j]; if (A.contains(B) || B.contains(A)) continue;
    const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
    if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) overlaps.push(lab(A) + ' ~ ' + lab(B));
  }
  const clipped = ctl.filter((e) => e.scrollWidth > e.clientWidth + 1).map(lab);
  return { found: true, small, overlaps, clipped, overflow: document.documentElement.scrollWidth > innerWidth + 1, alto: Math.round(card.getBoundingClientRect().height) };
})()`;

async function main() {
  const o = parseArgs(process.argv.slice(2));
  fs.mkdirSync(o.out, { recursive: true });
  const failures = [];
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-demo-prev-" + Date.now()); build(dist, "preview");
    const prod = path.join(os.tmpdir(), "irontrack-demo-prod-" + Date.now()); build(prod, "production");
    const prodHasDemo = fs.existsSync(path.join(prod, DEMO)) || fs.readdirSync(path.join(prod, "assets")).some((f) => /demo/i.test(f) ||
      (f.endsWith(".js") && /Alumno Demo|demo@ejemplo\.com|fichaAlumnoDemo/.test(fs.readFileSync(path.join(prod, "assets", f), "utf8"))));
    if (prodHasDemo) failures.push("Production contiene la demo (HTML o codigo)");
    console.log("Production sin demo:", !prodHasDemo);
  }
  if (!fs.existsSync(path.join(dist, DEMO))) throw new Error("El build no contiene " + DEMO + " (debe ser un build de Preview)");
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const { server, port } = await serve(dist);
  const results = [];
  for (const width of o.widths) {
    const id = "demo@" + width;
    const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: "dark" });
    const external = [];
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
      external.push(route.request().method() + " " + u.hostname);
      return route.abort();
    });
    // Registro de escrituras en el almacenamiento del navegador (antes de que cargue la pagina).
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
    const click = (re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button")].find((e) => e.getBoundingClientRect().width > 0 && !e.disabled && r.test(((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")).trim())); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; }, re.source);
    const text = () => page.evaluate(() => document.body.innerText);
    const flow = {};
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
    await wait(1200);
    flow.banner = /DEMO/.test(await text()) && /Alumno Demo/.test(await text());
    await shot("01_lista");
    flow.expandir = await page.evaluate(() => { const t = document.querySelector("[data-qa-alumno-toggle]"); if (!t) return false; t.click(); return true; });
    await wait(1000);
    const t1 = await text();
    flow.datos = /Semana 2 de 4/.test(t1.replace(/ /g, " ")) && /2 de 3 días/.test(t1.replace(/ /g, " ")) && /Día 3/.test(t1) && /Full Body/.test(t1) && /demo@ejemplo\.com/.test(t1);
    const m = await page.evaluate(MEASURE);
    await shot("02_expandida");
    const card = await page.$('[data-qa-alumno-card="open"]');
    if (card) await card.screenshot({ path: path.join(o.out, width + "_03_ficha_completa.png") });
    await page.evaluate(() => { const b = document.querySelectorAll('[data-qa-alumno-card="open"] .it-ficha-day'); if (b[1]) b[1].click(); }); await wait(300);
    flow.seleccionarDia = await page.evaluate(() => /Día 2/.test((document.querySelector('.it-ficha-day[aria-pressed="true"]') || {}).getAttribute?.("aria-label") || ""));
    await click(/^Próxima sesión: /); await wait(300);
    flow.proximaSesion = await page.evaluate(() => /Día 3/.test((document.querySelector('.it-ficha-day[aria-pressed="true"]') || {}).getAttribute?.("aria-label") || ""));
    await shot("04_dia3");
    flow.menuAlumno = await click(/^Más opciones\s*$/); await wait(300);
    flow.menuAlumno = flow.menuAlumno && /Marcar pagado/.test(await text());
    await shot("05_menu_alumno");
    await click(/^Más opciones\s*$/); await wait(200);
    flow.menuRutina = await click(/^Opciones de rutina/); await wait(300);
    flow.menuRutina = flow.menuRutina && /Validar sesión manualmente/.test(await text());
    await shot("06_menu_rutina");
    await click(/Validar sesión manualmente/); await wait(700);
    flow.modalDias = /Pendiente/.test(await text()) && /Completado/.test(await text());
    await shot("07_modal_dias");
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /— pendiente$/.test(e.getAttribute("aria-label") || "") && !e.disabled); if (b) b.click(); }); await wait(400);
    flow.modalConfirmacion = /¿Confirmás que el alumno realizó este entrenamiento\?/.test(await text());
    await shot("08_modal_confirmacion");
    await click(/^Confirmar$/); await wait(900);
    // Tras confirmar: aviso DEMO (simulado) y, como el Dia 3 cierra la semana, la misma regla de la app la avanza a la Semana 3 (solo en memoria).
    const tc = (await text()).replace(/\u00a0/g, " ");
    flow.confirmarDemo = /DEMO · (Sesión validada|Semana completa)[^\n]*\(simulado\)/.test(tc) && /Semana 3 de 4/.test(tc);
    await shot("09_validada_demo");
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-qa-alumno-card="open"] button[aria-expanded="false"]')].find((e) => /ENTRADA EN CALOR/.test(e.innerText || "")); if (b) b.click(); }); await wait(200);
    flow.editarEjercicio = await click(/^Editar ejercicio: /); await wait(600);
    flow.editarEjercicio = flow.editarEjercicio && await page.evaluate(() => !!document.querySelector("[role=dialog]"));
    await shot("10_editar_ejercicio");
    await page.keyboard.press("Escape"); await wait(400);
    await page.evaluate(() => { const b = [...document.querySelectorAll("[role=dialog] button")].find((e) => /Cancelar|Cerrar/.test((e.getAttribute("aria-label") || "") + (e.innerText || ""))); if (b) b.click(); }); await wait(300);
    flow.agregarEjercicio = await click(/Añadir ejercicio/); await wait(600);
    flow.agregarEjercicio = flow.agregarEjercicio && /Buscar|ejercicio/i.test(await text());
    await shot("11_agregar_ejercicio");
    await page.keyboard.press("Escape"); await wait(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /^(Cancelar|Cerrar|×|✕)$/.test((e.innerText || "").trim()) || /Cerrar/.test(e.getAttribute("aria-label") || "")); if (b) b.click(); }); await wait(300);
    await page.evaluate(() => { const t = document.querySelector("[data-qa-alumno-toggle][aria-expanded=true]"); if (t) t.click(); }); await wait(400);
    flow.contraer = await page.evaluate(() => !document.querySelector('[data-qa-alumno-card="open"]'));
    const storageWrites = await page.evaluate(() => window.__storageWrites);
    const r = { id, measure: m, flow, external, storageWrites, errors };
    results.push(r);
    if (!m.found) failures.push(id + ": no se encontro la ficha expandida");
    if (m.overflow) failures.push(id + ": overflow horizontal");
    if (m.small && m.small.length) failures.push(id + ": controles <44 px: " + JSON.stringify(m.small));
    if (m.overlaps && m.overlaps.length) failures.push(id + ": areas tactiles superpuestas: " + JSON.stringify(m.overlaps.slice(0, 5)));
    if (m.clipped && m.clipped.length) failures.push(id + ": botones recortados: " + JSON.stringify(m.clipped));
    Object.entries(flow).forEach(([k, ok]) => { if (!ok) failures.push(id + ": flujo '" + k + "' no funciono"); });
    const backend = external.filter((x) => /supabase|\.invalid|example-host/i.test(x));
    if (backend.length) failures.push(id + ": pedidos a un backend: " + JSON.stringify(backend));
    if (storageWrites.length) failures.push(id + ": escrituras en localStorage/sessionStorage: " + JSON.stringify(storageWrites));
    if (errors.length) failures.push(id + ": errores de pagina: " + errors[0]);
    await ctx.close();
  }
  server.close();
  await browser.close();
  fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ results, failures }, null, 1));
  for (const r of results) console.log(r.id, "alto ficha", r.measure.alto, "| pedidos externos:", [...new Set(r.external)].join(", ") || "ninguno", "| escrituras storage:", r.storageWrites.length);
  console.log(failures.length ? "FALLAS:\n- " + failures.join("\n- ") : "demo-ficha OK (" + results.length + " anchos)");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
