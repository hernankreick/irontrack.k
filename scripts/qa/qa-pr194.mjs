// QA de la demo del PR #194 (demo/qa-pr194.html, datos ficticios, solo Preview). Opcional: no es una suite test-*.mjs.
// Uso:  node scripts/qa/qa-pr194.mjs --out <carpeta> [--dist <dir>]
//   Sin --dist compila como Preview simulado (VERCEL_ENV=preview, backend .invalid) y también Production para comprobar que la demo NO se genera allí.
// Verifica (oscuro y claro, iPhone 390 px + overflow a 375/430): aislamiento (red bloqueada, almacenamiento en memoria: un canario en el
// localStorage REAL no se lee ni se pisa, 0 pedidos externos salvo fuentes), el bundle de la demo sin Supabase, y los flujos del PR con los
// componentes reales: 82,5 -> 82.5; scroll vertical/diagonal NO registra y el horizontal sí; Ajustes/Perfil/Historial abren y cierran (Escape y
// fondo); fallo de red / respuesta nula / vacía NO muestran éxito y no persisten; éxito persiste; doble toque en Guardar = 1 sola creación.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/qa-pr194.html";

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") o.out = path.resolve(argv[++i]);
    else if (argv[i] === "--dist") o.dist = path.resolve(argv[++i]);
    else throw new Error("Opcion desconocida: " + argv[i]);
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
/** Chunks JS alcanzables desde el HTML de la demo (import estático/dinámico). */
function chunksDeLaDemo(dist) {
  const html = fs.readFileSync(path.join(dist, DEMO), "utf8");
  const queue = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  const seen = new Set();
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    const f = path.join(dist, rel);
    if (!fs.existsSync(f)) continue;
    seen.add(rel);
    const code = fs.readFileSync(f, "utf8");
    for (const m of code.matchAll(/["']\.\/([\w.-]+\.js)["']/g)) queue.push("assets/" + m[1]);
  }
  return [...seen];
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  fs.mkdirSync(o.out, { recursive: true });
  const failures = [];
  const ok = (cond, msg) => { if (!cond) failures.push(msg); return !!cond; };
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-pr194-prev-" + Date.now()); build(dist, "preview");
    const prod = path.join(os.tmpdir(), "irontrack-pr194-prod-" + Date.now()); build(prod, "production");
    const prodHasDemo = fs.existsSync(path.join(prod, DEMO)) || fs.readdirSync(path.join(prod, "assets")).some((f) => f.endsWith(".js") && /qaPr194|Demo QA · PR #194/.test(fs.readFileSync(path.join(prod, "assets", f), "utf8")));
    ok(!prodHasDemo, "Production contiene la demo QA (HTML o codigo)");
    console.log("Production sin demo:", !prodHasDemo);
  }
  if (!fs.existsSync(path.join(dist, DEMO))) throw new Error("El build no contiene " + DEMO + " (debe ser Preview)");
  // El bundle de la demo no debe llevar Supabase ni el host del backend del build.
  const chunks = chunksDeLaDemo(dist);
  const sospechosos = chunks.filter((rel) => /supabase\.co|createClient|\/rest\/v1|sin-backend\.invalid|mock-anon-key/i.test(fs.readFileSync(path.join(dist, rel), "utf8")));
  ok(sospechosos.length === 0, "El bundle de la demo contiene Supabase/host de backend: " + sospechosos.join(", "));
  console.log("Chunks de la demo:", chunks.length, "· con Supabase:", sospechosos.length);

  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const { server, port } = await serve(dist);
  const resultados = [];

  for (const colorScheme of ["dark", "light"]) {
    for (const width of [375, 390, 430]) {
      const id = colorScheme + "@" + width;
      const full = width === 390;
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme });
      const externos = [];
      await ctx.route("**/*", (route) => {
        const u = new URL(route.request().url());
        if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
        externos.push(route.request().method() + " " + u.hostname);
        return route.abort();
      });
      // Canario en el localStorage REAL (corre antes que cualquier script de la página): la demo no debe leerlo ni pisarlo.
      await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("__init")) { localStorage.setItem("it_canario", "real"); sessionStorage.setItem("__init", "1"); } } catch (e) {} });
      const page = await ctx.newPage();
      const errores = [];
      page.on("pageerror", (e) => errores.push(String(e).slice(0, 200)));
      const wait = (ms) => page.waitForTimeout(ms);
      const shot = (n) => page.screenshot({ path: path.join(o.out, id + "_" + n + ".png"), fullPage: false });
      const click = (re) => page.evaluate((src) => { const r = new RegExp(src); const b = [...document.querySelectorAll("button")].find((e) => e.getBoundingClientRect().width > 0 && !e.disabled && r.test(((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")).trim())); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; }, re.source);
      const txt = () => page.evaluate(() => document.body.innerText.replace(/ /g, " "));
      // Solo el aviso (ToastBanner): el texto de las instrucciones de la demo también menciona estos mensajes.
      const toast = () => page.evaluate(() => [...document.querySelectorAll('[role="status"][aria-atomic="true"]')].map((e) => e.innerText).join(" ").trim());
      const num = (sel) => page.evaluate((s) => Number((document.querySelector(s) || {}).textContent), sel);
      const flow = {};
      await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
      await wait(800);

      // Aislamiento
      flow.storageEnMemoria = /en memoria/.test(await page.evaluate(() => (document.querySelector("[data-qa-storage]") || {}).textContent || ""));
      flow.redBloqueada = /bloqueada/.test(await page.evaluate(() => (document.querySelector("[data-qa-red]") || {}).textContent || ""));
      flow.noLeeElCanario = await page.evaluate(() => localStorage.getItem("it_canario") === null && localStorage.length === 0);
      await page.evaluate(() => { localStorage.setItem("it_escritura_demo", "x"); sessionStorage.setItem("it_escritura_demo", "x"); });

      const overflow0 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      await shot("01_inicio");
      if (full) {
        // ── 1 · Registro: 82,5 y gestos ──
        await page.evaluate(() => document.querySelector("#registro").scrollIntoView());
        const kg = page.locator('input[aria-label="Peso en kg"]');
        flow.kgDecimal = (await kg.getAttribute("inputmode")) === "decimal" && (await kg.getAttribute("type")) === "text";
        await kg.fill("82,5");
        const regOk = () => page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /REGISTRAR SET|LOG SET/.test(e.textContent || "")); return !!b && !b.disabled; });
        await click(/REGISTRAR SET|LOG SET/); await wait(500);
        flow.kg82_5 = (await page.evaluate(() => (document.querySelector("[data-qa-kg]") || {}).textContent)) === "82.5" && (await num("[data-qa-total-series]")) === 1;
        for (let i = 0; i < 40 && !(await regOk()); i++) await wait(150);
        await shot("02_registro");
        const cdp = await ctx.newCDPSession(page);
        const swipe = async (x0, y0, x1, y1) => {
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: y0 }] });
          for (let i = 1; i <= 8; i++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y: y0 + ((y1 - y0) * i) / 8 }] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        };
        const origen = async () => page.evaluate(() => { const s = [...document.querySelectorAll("span")].find((e) => e.textContent === "PESO"); s.scrollIntoView({ block: "center" }); const r = s.getBoundingClientRect(); return { x: Math.round(r.left + 40), y: Math.round(r.top + r.height / 2) }; });
        let p = await origen();
        const antes = await num("[data-qa-total-series]");
        await swipe(p.x + 60, p.y, p.x + 40, p.y + 140); await wait(300);            // vertical
        p = await origen();
        await swipe(p.x + 120, p.y, p.x + 20, p.y + 120); await wait(300);           // diagonal (dx -100, dy +120)
        flow.scrollVerticalNoRegistra = (await num("[data-qa-total-series]")) === antes;
        p = await origen();
        await swipe(p.x + 150, p.y, p.x - 40, p.y); await wait(500);                  // horizontal izquierda
        flow.swipeHorizontalRegistra = (await num("[data-qa-total-series]")) === antes + 1;

        // ── 2 · Modales ──
        for (const nombre of ["ajustes", "perfil", "historial"]) {
          await page.evaluate(() => document.querySelector("#modales").scrollIntoView());
          await page.locator('[data-qa-abrir="' + nombre + '"]').click(); await wait(250);
          const abre = await page.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-modal="true"]'); return !!d && d.getBoundingClientRect().width > 0; });
          const foco = await page.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-modal="true"]'); return !!d && d.contains(document.activeElement); });
          if (nombre === "ajustes") await shot("03_modal_ajustes");
          await page.keyboard.press("Escape"); await wait(250);
          const cierraEsc = !(await page.$('[role="dialog"][aria-modal="true"]'));
          await page.locator('[data-qa-abrir="' + nombre + '"]').click(); await wait(250);
          await page.touchscreen.tap(width / 2, 6); await wait(250);                       // toque sobre el fondo
          const cierraFondo = !(await page.$('[role="dialog"][aria-modal="true"]'));
          flow["modal_" + nombre] = abre && foco && cierraEsc && cierraFondo;
        }

        // ── 3 · Rutinas: fallo, éxito, doble toque ──
        await page.evaluate(() => document.querySelector("#rutinas").scrollIntoView());
        const modo = (m) => page.locator('[data-qa-modo="' + m + '"]').click();
        const contadores = async () => ({ filas: await num("[data-qa-filas]"), up: await num("[data-qa-updates]"), upOk: await num("[data-qa-updates-ok]"), cr: await num("[data-qa-creates]"), crOk: await num("[data-qa-creates-ok]") });
        const barra = () => page.evaluate(() => !!document.querySelector(".it-routines-unsaved.is-visible"));
        const guardar = () => click(/Guardar cambios|Save changes/);
        const editarPrimero = async (kgNuevo) => {
          await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="Más acciones del ejercicio"]')].find((e) => e.getBoundingClientRect().width > 0); b.scrollIntoView({ block: "center" }); b.click(); });
          await wait(200);
          await click(/^Editar$/); await wait(300);
          await page.locator('[role="dialog"] input[placeholder="—"]').first().fill(kgNuevo);
          await click(/^GUARDAR$/); await wait(300);
        };
        const resumen = () => page.evaluate(() => [...document.querySelectorAll("[data-qa-resumen-fila]")].map((e) => e.textContent).join(" || "));
        await editarPrimero("62.5");
        flow.barraAparece = await barra();
        await shot("04_rutinas_barra");
        const base = await contadores();
        const baseResumen = await resumen();
        for (const m of ["red", "nulo", "vacio"]) {
          await modo(m); await guardar(); await wait(700);
          const t = await toast(); const c = await contadores();
          const cond = { sinExito: !/Cambios guardados ✓/.test(t), avisoFallo: /No se pudo guardar ningún cambio|Error al guardar/.test(t), barraSigue: await barra(), filas: c.filas === base.filas, sinUpdates: c.upOk === 0, sinCreates: c.crOk === 0, sinCambio: (await resumen()) === baseResumen, noPersiste: !/62\.5/.test(await resumen()) };
          flow["fallo_" + m] = Object.values(cond).every(Boolean);
          if (!flow["fallo_" + m]) console.log("detalle fallo", m, JSON.stringify(cond), JSON.stringify(c), JSON.stringify(base));
        }
        await shot("05_fallo");
        await modo("ok"); await guardar(); await wait(900);
        let c = await contadores();
        const tOk = await toast(); const bOk = await barra(); const rOk = await resumen();
        flow.exitoGuarda = /Cambios guardados ✓/.test(tOk) && !bOk && c.filas === 1 && c.upOk === 1 && c.crOk === 0 && /62\.5/.test(rOk);
        if (!flow.exitoGuarda) console.log("detalle exito", JSON.stringify({ tOk, bOk, c, rOk }));
        flow.semanaActivaPreservada = /semana_activa 2/.test(await page.evaluate(() => document.querySelector("[data-qa-fila]").textContent));
        await page.locator("[data-qa-recargar]").click(); await wait(500);
        flow.persisteTrasRecargar = /62\.5/.test(await resumen()) && (await num("[data-qa-filas]")) === 1;
        await shot("06_exito");
        // Doble toque con latencia: un solo create por rutina nueva
        await page.locator("[data-qa-latencia]").click();
        for (const variante of ["sincronico", "tactil"]) {
          await page.locator("[data-qa-nueva]").click(); await wait(200);
          await editarPrimero(variante === "sincronico" ? "70" : "72.5");
          const b0 = await contadores();
          if (variante === "sincronico") {
            await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Guardar cambios/.test(e.textContent || "")); b.scrollIntoView({ block: "center" }); b.click(); b.click(); });
          } else {
            const pos = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Guardar cambios/.test(e.textContent || "")); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
            await page.touchscreen.tap(pos.x, pos.y); await wait(60); await page.touchscreen.tap(pos.x, pos.y);
          }
          for (let i = 0; i < 60 && (await barra()); i++) await wait(250);
          await wait(400);
          const c1 = await contadores();
          flow["dobleToque_" + variante] = c1.cr - b0.cr === 1 && c1.crOk - b0.crOk === 1 && c1.filas - b0.filas === 1;
        }
        await shot("07_doble_toque");
      }
      const finalTxt = await txt();
      void finalTxt;
      const overflow1 = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      const intentos = await page.evaluate(() => Number((document.querySelector("[data-qa-intentos]") || {}).textContent));
      // El almacenamiento REAL (iframe sin parchear, mismo origen) conserva el canario intacto y NO recibió nada de la demo.
      const real = await page.evaluate(() => new Promise((resolve) => {
        const f = document.createElement("iframe"); f.style.display = "none"; f.src = "/icons/favicon-32.png"; document.body.appendChild(f);
        f.onload = () => { try { const w = f.contentWindow; resolve({ canario: w.localStorage.getItem("it_canario"), n: w.localStorage.length, escrituraL: w.localStorage.getItem("it_escritura_demo"), escrituraS: w.sessionStorage.getItem("it_escritura_demo") }); } catch (e) { resolve({ error: String(e) }); } };
      }));
      flow.almacenamientoRealIntacto = real.canario === "real" && real.n === 1 && real.escrituraL === null && real.escrituraS === null;
      Object.entries(flow).forEach(([k, v]) => ok(v, id + ": flujo '" + k + "' no funciono"));
      ok(!overflow0 && !overflow1, id + ": overflow horizontal");
      ok(errores.length === 0, id + ": errores de pagina " + JSON.stringify(errores));
      ok(intentos === 0, id + ": la demo intento " + intentos + " pedido(s) de red");
      const noFuentes = externos.filter((x) => !/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(x));
      ok(noFuentes.length === 0, id + ": pedidos externos no permitidos: " + JSON.stringify(noFuentes));
      ok(!externos.some((x) => /supabase|\.invalid|example-host/i.test(x)), id + ": pedido a un backend");
      resultados.push({ id, flow, overflow: overflow0 || overflow1, externos: [...new Set(externos)], intentosDeRedDeLaDemo: intentos, almacenamientoReal: real, errores });
      await ctx.close();
    }
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ resultados, failures }, null, 2));
  for (const r of resultados) console.log(r.id, Object.entries(r.flow).map(([k, v]) => (v ? "ok " : "FALLA ") + k).join(" | "), "| externos(fuentes):", r.externos.length, "| red demo:", r.intentosDeRedDeLaDemo);
  if (failures.length) { console.error("\nQA PR194 FALLA:\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("\nQA PR194 OK · salida:", o.out);
}
main().catch((e) => { console.error(e); process.exit(1); });
