// QA de la demo del PR #194 (demo/qa-pr194.html, datos ficticios, solo Preview). Opcional: no es una suite test-*.mjs.
// Uso:  node scripts/qa/qa-pr194.mjs --out <carpeta> [--dist <dir>] [--browser chromium|webkit] [--widths 375,390,430,768]
//   Chromium: gestos tactiles reales por CDP (mantener + arrastrar, deslizar para hacer scroll). WebKit (motor de Safari): sin CDP, asi que los
//   gestos tactiles NO se automatizan; se ejecuta con mouse/teclado y se informan como "no ejecutadas" las pruebas tactiles. Ninguna prueba
//   de WebKit equivale a Safari en un iPhone real.
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
  const o = { browser: "chromium", widths: [375, 390, 430, 768] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") o.out = path.resolve(argv[++i]);
    else if (argv[i] === "--dist") o.dist = path.resolve(argv[++i]);
    else if (argv[i] === "--browser") o.browser = argv[++i];
    else if (argv[i] === "--widths") o.widths = argv[++i].split(",").map(Number);
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
  const esChromium = o.browser === "chromium";
  if (!pw[o.browser]) throw new Error("Navegador desconocido: " + o.browser);
  const browser = await pw[o.browser].launch(esChromium ? { executablePath: chromiumPath() } : {});
  const omitidas = [];                       // pruebas NO ejecutadas (con motivo): nunca se cuentan como aprobadas
  const { server, port } = await serve(dist);
  const resultados = [];

  for (const colorScheme of ["dark", "light"]) {
    for (const width of o.widths) {
      const id = o.browser + ":" + colorScheme + "@" + width;
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
      const shot = (n) => page.screenshot({ path: path.join(o.out, id.replace(/[:@]/g, "_") + "_" + n + ".png"), fullPage: false });
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
      // ── 0 · Reordenamiento de ejercicios (componentes REALES: DaySection / ExerciseCard / RutinaView) ──
      {
        const cdp0 = esChromium ? await ctx.newCDPSession(page) : null;
        const handles = () => page.evaluate(() => [...document.querySelectorAll('button[aria-label="Reordenar ejercicio"]')].map((b) => { const r = b.getBoundingClientRect(); return { n: b.parentElement.innerText.split("\n")[0].replace(/ \(demo\)/, "").trim(), x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
        const orden = async () => (await handles()).map((h) => h.n);
        const CLAVE = { Plancha: "cal:plank", "Movilidad de cadera": "cal:mob", Sentadilla: "sq", "Press de banca": "bp", "Peso muerto": "dl", "Remo con barra": "row", "Curl de bíceps": "curl" };
        const ordenServidor = () => page.evaluate(() => (document.querySelector("[data-qa-resumen-fila]") || {}).textContent || "").then((t) => [...t.matchAll(/(?:cal:)?[a-z]+(?= \d+x)/g)].map((m) => m[0]));
        const esperadoServidor = (nombres) => nombres.map((x) => CLAVE[x]);
        // Determinismo: las tarjetas animan su entrada (translateY + opacidad con retardo escalonado) y las fuentes cargan tarde en un navegador
        // en frío: arrastrar con coordenadas leidas durante esa animación falla en WebKit (primera carga). Se espera a que terminen.
        const quieto = async () => {
          await page.evaluate(() => Promise.all([(document.fonts && document.fonts.ready) || null, ...document.getAnimations().map((a) => a.finished.catch(() => null))]));
          // layout estable: las posiciones de las asas no cambian entre dos lecturas separadas (fuentes que cargan tarde, imagenes, scroll anclado)
          let previo = "";
          for (let k = 0; k < 25; k++) {
            const ahora = JSON.stringify(await page.evaluate(() => [window.scrollY, document.documentElement.scrollHeight, ...[...document.querySelectorAll('button[aria-label="Reordenar ejercicio"]')].map((b) => Math.round(b.getBoundingClientRect().top * 10) / 10)]));
            if (ahora === previo) return;
            previo = ahora; await wait(120);
          }
        };
        const traer = async (i, yDeseada = 520) => { await quieto(); await page.evaluate(([k, yy]) => { const b = document.querySelectorAll('button[aria-label="Reordenar ejercicio"]')[k]; const r = b.getBoundingClientRect(); window.scrollBy(0, r.top - yy); }, [i, yDeseada]); await wait(200); return (await handles())[i]; };
        const overlay = () => page.evaluate(() => { const els = [...document.querySelectorAll("div")].filter((d) => getComputedStyle(d).position === "fixed" && d.querySelector('button[aria-label="Reordenar ejercicio"]')); if (!els.length) return null; const r = els[els.length - 1].getBoundingClientRect(); return { cy: r.top + r.height / 2, top: r.top, left: r.left, h: r.height, dentroDeLaTarjeta: !!els[els.length - 1].closest(".it-routine-card-wrap") }; });
        const rondas = { overlayOk: [], scrollDelta: [] };
        // Arrastre: Chromium = toque real (mantener ~0,3 s y mover); WebKit = mouse (sin CDP no hay gestos tactiles automatizables)
        const arrastrar = async (i, j, { medir, yDeseada } = {}) => {
          const a = await traer(i, yDeseada); const b = (await handles())[j]; const y1 = b.y + (j > i ? 14 : -14);
          const scrollIni = await page.evaluate(() => window.scrollY);
          const izqTarjeta = await page.evaluate((k) => document.querySelectorAll('button[aria-label="Reordenar ejercicio"]')[k].parentElement.getBoundingClientRect().left, i);
          if (esChromium) {
            await cdp0.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
            await wait(330);                                          // pulsación sostenida: activa el arrastre sin interferir con el scroll
            const pasos = 14;
            for (let k = 1; k <= pasos; k++) {
              const y = a.y + ((y1 - a.y) * k) / pasos;
              await cdp0.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y }] }); await wait(20);
              if (medir && k === Math.floor(pasos / 2)) { const ov = await overlay(); const ok1 = !!ov && !ov.dentroDeLaTarjeta && Math.abs(ov.cy - y) <= 14 && Math.abs(ov.left - izqTarjeta) <= 8 && ov.top >= -5 && ov.top < 844; rondas.overlayOk.push(ok1); if (!ok1) console.log("detalle overlay:", JSON.stringify({ ov, dedoY: Math.round(y), izqTarjeta: Math.round(izqTarjeta) })); }
            }
            await cdp0.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          } else {
            await page.mouse.move(a.x, a.y); await page.mouse.down();
            for (let k = 1; k <= 14; k++) {
              const y = a.y + ((y1 - a.y) * k) / 14;
              await page.mouse.move(a.x, y); await wait(20);
              if (medir && k === 7) { const ov = await overlay(); const ok1 = !!ov && !ov.dentroDeLaTarjeta && Math.abs(ov.cy - y) <= 14 && Math.abs(ov.left - izqTarjeta) <= 8 && ov.top >= -5 && ov.top < 844; rondas.overlayMouseOk = (rondas.overlayMouseOk || []).concat([ok1]); if (!ok1) console.log("detalle overlay (mouse):", JSON.stringify({ ov, y: Math.round(y), izqTarjeta: Math.round(izqTarjeta) })); }
            }
            await page.mouse.up();
          }
          rondas.scrollDelta.push(Math.abs((await page.evaluate(() => window.scrollY)) - scrollIni));
          await wait(450);
        };
        const igual = (x, y) => JSON.stringify(x) === JSON.stringify(y);
        const sinRepetidos = (arr) => new Set(arr).size === arr.length;
        const barra0 = () => page.evaluate(() => !!document.querySelector(".it-routines-unsaved.is-visible"));
        const guardar0 = () => click(/Guardar cambios|Save changes/);
        const modo0 = (m) => page.locator('[data-qa-modo="' + m + '"]').click();
        await page.evaluate(() => document.querySelector("#rutinas").scrollIntoView());
        const inicial = ["Plancha", "Movilidad de cadera", "Sentadilla", "Press de banca", "Peso muerto", "Remo con barra"];
        flow.reordenInicial = igual(await orden(), inicial);

        // R1 · mismo bloque: Sentadilla pasa detrás de Peso muerto. Sin escritura oculta; el overlay del arrastre sigue al dedo.
        const upd0 = await num("[data-qa-updates]");
        await arrastrar(2, 4, { medir: true, yDeseada: 400 });
        const tras1 = await orden();
        if (!igual(tras1, ["Plancha", "Movilidad de cadera", "Press de banca", "Peso muerto", "Sentadilla", "Remo con barra"])) console.log("detalle R1 (" + id + ") orden obtenido:", JSON.stringify(tras1), "scrollY:", await page.evaluate(() => window.scrollY));
        flow.reordenMismoBloque = igual(tras1, ["Plancha", "Movilidad de cadera", "Press de banca", "Peso muerto", "Sentadilla", "Remo con barra"]);
        flow.reordenSinEscrituraOculta = (await num("[data-qa-updates]")) === upd0 && (await num("[data-qa-creates]")) === 0;
        flow.reordenMarcaCambiosPendientes = await barra0();
        if (esChromium) flow.reordenOverlaySigueAlDedo = rondas.overlayOk.length > 0 && rondas.overlayOk.every(Boolean);
        else {
          flow.reordenOverlaySigueAlPunteroMouse = (rondas.overlayMouseOk || []).length > 0 && rondas.overlayMouseOk.every(Boolean);
          omitidas.push(id + ": posición del overlay bajo el DEDO (requiere gesto tactil; WebKit sin CDP). Con mouse sí se midió (reordenOverlaySigueAlPunteroMouse)");
        }
        // :hover aplica translateY(-2px) a proposito (y en iOS queda "pegado" tras un toque): por eso el overlay va en un portal. Aqui se comprueba
        // el estado en reposo, sin puntero sobre la tarjeta.
        await page.mouse.move(1, 1); await wait(350);
        flow.reordenTarjetaSinTransformPermanente = await page.evaluate(() => [...document.querySelectorAll(".it-routine-card-wrap")].every((c) => getComputedStyle(c).transform === "none"));
        await shot("reorden_1");

        // R2 · scroll vertical normal desde el asa: NO reordena y la página se desplaza (solo toque real: Chromium)
        if (esChromium) {
          const ordenAntes = await orden();
          const a = await traer(3);
          const sy0 = await page.evaluate(() => window.scrollY);
          await cdp0.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y }] });
          for (let k = 1; k <= 10; k++) { await cdp0.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x, y: a.y - 18 * k }] }); await wait(12); }
          await cdp0.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await wait(500);
          flow.scrollDesdeElAsaNoReordena = igual(await orden(), ordenAntes);
          flow.scrollDesdeElAsaDesplazaLaPagina = Math.abs((await page.evaluate(() => window.scrollY)) - sy0) > 30;
        } else omitidas.push(id + ": scroll tactil desde el asa (WebKit sin CDP: no hay gesto tactil automatizable)");

        // R3 · guardar y recargar: el orden persiste y no hay duplicados ni pérdidas
        const base0 = await num("[data-qa-updates-ok]");
        await guardar0(); await wait(900);
        flow.reordenGuardaYPersiste = igual(await ordenServidor(), esperadoServidor(tras1)) && (await num("[data-qa-updates-ok]")) === base0 + 1 && !(await barra0());
        await page.locator("[data-qa-recargar]").click(); await wait(500);
        flow.reordenPersisteTrasRecargar = igual(await orden(), tras1);
        flow.reordenSinDuplicados = sinRepetidos(await orden()) && (await orden()).length === 6 && (await num("[data-qa-filas]")) === 1;

        // R4 · fallo de red: el orden NO se guarda, no hay mensaje de éxito y el cambio sigue pendiente; luego se guarda bien
        await arrastrar(2, 4);                                           // Press de banca al final del bloque
        const tras4 = await orden();
        if (!igual(tras4, ["Plancha", "Movilidad de cadera", "Peso muerto", "Sentadilla", "Press de banca", "Remo con barra"])) console.log("detalle R4 orden obtenido:", JSON.stringify(tras4));
        flow.reordenNoDesplazaLaPaginaAlArrastrar = rondas.scrollDelta.length >= 2 && rondas.scrollDelta.every((d) => d <= 10);
        if (!flow.reordenNoDesplazaLaPaginaAlArrastrar) console.log("detalle scroll durante el arrastre:", JSON.stringify(rondas.scrollDelta));
        flow.reordenSegundoMovimiento = igual(tras4, ["Plancha", "Movilidad de cadera", "Peso muerto", "Sentadilla", "Press de banca", "Remo con barra"]);
        const srvAntes = await ordenServidor();
        await modo0("red"); await guardar0(); await wait(800);
        flow.reordenFalloDeRedNoGuarda = igual(await ordenServidor(), srvAntes) && !/Cambios guardados ✓/.test(await toast()) && (await barra0()) && igual(await orden(), tras4);
        await modo0("nulo"); await guardar0(); await wait(800);
        flow.reordenRespuestaNulaNoGuarda = igual(await ordenServidor(), srvAntes) && !/Cambios guardados ✓/.test(await toast()) && (await barra0());
        await modo0("vacio"); await guardar0(); await wait(800);
        flow.reordenRespuestaVaciaNoGuarda = igual(await ordenServidor(), srvAntes) && !/Cambios guardados ✓/.test(await toast()) && (await barra0());
        await modo0("ok"); await guardar0(); await wait(900);
        flow.reordenGuardaTrasElFallo = igual(await ordenServidor(), esperadoServidor(tras4)) && /Cambios guardados ✓/.test(await toast()) && !(await barra0()) && sinRepetidos(await orden());

        // R5 · latencia: "Guardando…" visible, un solo UPDATE confirmado, orden persistido
        await page.locator("[data-qa-latencia]").click();
        await arrastrar(2, 3);
        const tras5 = await orden();
        const okAntes5 = await num("[data-qa-updates-ok]");
        await guardar0(); await wait(300);
        flow.reordenLatenciaMuestraGuardando = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Guardando/.test(b.textContent || "") && b.disabled));
        for (let k = 0; k < 40 && (await barra0()); k++) await wait(250);
        await wait(300);
        flow.reordenLatenciaPersiste = igual(await ordenServidor(), esperadoServidor(tras5)) && (await num("[data-qa-updates-ok]")) === okAntes5 + 1 && sinRepetidos(await orden());
        await page.locator("[data-qa-latencia]").click();

        // R6 · calentamiento y bloque principal son independientes: soltar sobre el otro bloque no mueve ni duplica nada
        const ordenAntes6 = await orden();
        await arrastrar(0, 2);                                           // Plancha (calentamiento) sobre un ejercicio del bloque principal
        flow.reordenNoMezclaBloques = igual(await orden(), ordenAntes6) && sinRepetidos(await orden());

        try {
        // R7 · agregar y eliminar DESPUÉS de reordenar, y guardar: lo que se ve es lo que persiste
        await arrastrar(2, 4);
        await page.evaluate(() => { const b = [...document.querySelectorAll("button")].filter((e) => /^\s*Agregar ejercicios\s*$/i.test(e.textContent || "") && e.getBoundingClientRect().width > 0)[1]; b.scrollIntoView({ block: "center" }); b.click(); });
        await wait(300);
        await page.evaluate(() => { const c = [...document.querySelectorAll('[role="dialog"] [role="button"]')].find((e) => /Curl de bíceps/.test(e.textContent || "")); c.click(); });
        await wait(150);
        await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((e) => /^\s*(A[ÑN]ADIR|AGREGAR|ADD)\b/i.test((e.textContent || "").trim()) && !/Cerrar|Close/.test(e.getAttribute("aria-label") || "")); b.click(); });
        await wait(400);
        const tras7a = await orden();
        flow.reordenAgregaEjercicio = tras7a.length === 7 && tras7a.includes("Curl de bíceps") && sinRepetidos(tras7a);
        await page.evaluate(() => { const b = document.querySelectorAll('button[aria-label="Más acciones del ejercicio"]')[0]; b.scrollIntoView({ block: "center" }); b.click(); });
        await wait(250); await click(/^Eliminar$/); await wait(300);
        await page.evaluate(() => { const b = [...document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')].find((e) => /^\s*Eliminar\s*$/i.test(e.textContent || "")); if (b) b.click(); });
        await wait(400);
        const tras7 = await orden();
        if (!(tras7.length === 6 && !tras7.includes("Plancha"))) console.log("detalle R7 eliminar:", JSON.stringify({ tras7a, tras7 }));
        flow.reordenEliminaEjercicio = tras7.length === 6 && !tras7.includes("Plancha") && sinRepetidos(tras7);
        flow.reordenCambiosPendientesTrasAgregarYEliminar = await barra0();
        await guardar0(); await wait(900);
        flow.reordenAgregarEliminarPersisten = igual(await ordenServidor(), esperadoServidor(tras7)) && !(await barra0());

        // R8 · teclado (accesibilidad): Espacio, flecha, Espacio mueve un lugar dentro del bloque
        const antes8 = await orden();
        const idx8 = antes8.indexOf("Sentadilla");
        const nombreMovido = antes8[idx8];
        await page.evaluate((k) => document.querySelectorAll('button[aria-label="Reordenar ejercicio"]')[k].focus(), idx8);
        await page.keyboard.press("Space"); await wait(150); await page.keyboard.press("ArrowDown"); await wait(150); await page.keyboard.press("Space"); await wait(400);
        const despues8 = await orden();
        flow.reordenPorTeclado = despues8.indexOf(nombreMovido) === idx8 + 1 && sinRepetidos(despues8) && despues8.length === antes8.length;
        await shot("reorden_2");

        // R9 · "Subir / Bajar" en el menú ⋮ (sin gesto): mueve un lugar, marca pendiente y se guarda
        const antes9 = await orden();
        const ENTRADA = ["Plancha", "Movilidad de cadera"];
        // un ejercicio que NO sea el primero de su bloque (el menú solo ofrece "Subir" si hay uno arriba)
        const nombre9 = antes9.find((n, k) => k > 0 && !ENTRADA.includes(n) && !ENTRADA.includes(antes9[k - 1]) && n !== "Remo con barra");
        const idx9 = antes9.indexOf(nombre9);
        await page.evaluate((k) => { const b = document.querySelectorAll('button[aria-label="Más acciones del ejercicio"]')[k]; b.scrollIntoView({ block: "center" }); b.click(); }, idx9);
        await wait(250); await click(/^Subir$/); await wait(400);
        const despues9 = await orden();
        if (despues9.indexOf(nombre9) !== idx9 - 1) console.log("detalle R9:", JSON.stringify({ antes9, despues9, nombre9 }));
        flow.reordenSubirDesdeElMenu = despues9.indexOf(nombre9) === idx9 - 1 && sinRepetidos(despues9) && despues9.length === antes9.length && (await barra0());
        await guardar0(); await wait(900);
        flow.reordenSubirBajarPersiste = igual(await ordenServidor(), esperadoServidor(despues9));

        // R10 · arrastre con el asa en la zona baja de la pantalla (cerca de la barra fija y del borde): el resultado es el esperado
        const antes10 = await orden();
        const principal10 = antes10.filter((n) => !ENTRADA.includes(n) && n !== "Remo con barra");
        const i10 = antes10.indexOf(principal10[0]), j10 = i10 + 1;      // un lugar hacia abajo, con el asa a ~2/3 de la pantalla
        const nombre10 = antes10[i10];
        await arrastrar(i10, j10, { yDeseada: 560 });
        const despues10 = await orden();
        flow.reordenZonaBaja = igual(despues10, antes10) === false && sinRepetidos(despues10) && despues10.length === antes10.length && despues10.indexOf(nombre10) === j10;
        if (!flow.reordenZonaBaja) console.log("detalle R10:", JSON.stringify({ antes10, despues10, i10, j10 }));

        } catch (e) { flow.reordenExcepcionEnPasoFinal = false; console.log("excepcion en R7/R8:", String(e).split("\n")[0]); }

        await page.reload({ waitUntil: "load" }); await wait(800);          // estado limpio para los flujos siguientes
        await page.evaluate(() => { try { localStorage.setItem("it_escritura_demo", "x"); sessionStorage.setItem("it_escritura_demo", "x"); } catch (e) {} });
      }

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
        if (esChromium) {
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
        } else omitidas.push(id + ": gestos tactiles del panel de registro (scroll vertical / swipe horizontal): WebKit sin CDP");

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
  fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ navegador: o.browser, resultados, failures, omitidas }, null, 2));
  for (const r of resultados) console.log(r.id, Object.entries(r.flow).map(([k, v]) => (v ? "ok " : "FALLA ") + k).join(" | "), "| externos(fuentes):", r.externos.length, "| red demo:", r.intentosDeRedDeLaDemo);
  if (omitidas.length) console.log("\nNO EJECUTADAS (limitaciones del entorno, no cuentan como aprobadas):\n- " + [...new Set(omitidas)].join("\n- "));
  if (failures.length) { console.error("\nQA PR194 FALLA:\n- " + failures.join("\n- ")); process.exit(1); }
  console.log("\nQA PR194 OK · salida:", o.out);
}
main().catch((e) => { console.error(e); process.exit(1); });
