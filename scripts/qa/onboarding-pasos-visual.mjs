// QA visual de las pantallas 2-5 del onboarding (perfil, nombre, cantidad de alumnos, final) con host simulado,
// sin it_onboard_done. Recorre Paso 1 -> perfil -> (entrenador) nombre -> alumnos -> final y el camino Atleta (nombre -> final).
//   node scripts/qa/onboarding-pasos-visual.mjs --out <dir> [--tag before|after] [--dist <dir>] [--report-only]
// Por pantalla y por tamano (scroll al inicio y al final del contenedor interno): raiz fixed cubre el viewport, el documento no
// hace scroll, el contenido no queda bajo la barra de estado (--it-safe-top), sin overflow horizontal, controles >=44x44,
// botones inferiores dentro del viewport y sin tapar, ultima tarjeta/opcion con holgura >=8 px sobre el bloque inferior, y
// en el paso del nombre un teclado simulado (visualViewport reducido, estilo iOS) deja input y boton visibles.
// --report-only: imprime las fallas pero sale con 0 (para medir el estado ANTES del arreglo).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// [ancho, alto, safe-top simulado en px]
const SIZES = [[320, 568, 0], [375, 667, 0], [390, 844, 0], [393, 852, 59], [430, 932, 0], [844, 390, 0], [667, 375, 0], [320, 480, 0], [390, 620, 0]];
const KB_STEPS = ["nombre-entrenador"];

function parse(argv) {
  const o = { tag: "after", reportOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--tag") o.tag = argv[++i];
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--report-only") o.reportOnly = true;
    else throw new Error("Opcion desconocida: " + a);
  }
  return o;
}

// Medicion generica (sirve para el ANTES sin atributos data-onb-*): usa data-onb-* si existen y heuristicas si no.
async function measure(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const r = (b) => ({ top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height });
    const rect = (e) => r(e.getBoundingClientRect());
    const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
    const label = (e) => ((e.innerText || e.getAttribute("aria-label") || e.placeholder || e.tagName) + "").trim().replace(/\s+/g, " ").slice(0, 40);
    const rootEl = document.querySelector("[data-onb-root]");
    const scEl = document.querySelector("[data-onb-scroll]");
    const botEl = document.querySelector("[data-onb-bottom]");
    // Contenedores con scroll propio (cualquier overflow-y auto/scroll con contenido que desborda).
    const scrollers = [...document.querySelectorAll("*")].filter((e) => { const o = getComputedStyle(e).overflowY; return (o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 1; });
    const scroller = scEl || scrollers.sort((a, b) => b.clientHeight - a.clientHeight)[0] || null;
    const scope = rootEl || document.body;
    const controls = [...scope.querySelectorAll("button, [role=button], a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(vis).map((e) => ({ label: label(e), tag: e.tagName, ...rect(e), inBottom: !!(botEl && botEl.contains(e)), inScroll: !!(scroller && scroller.contains(e)), el: e }));
    const hits = controls.map((c) => {
      const cx = (c.left + c.right) / 2, cy = (c.top + c.bottom) / 2;
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) return null;
      const t = document.elementFromPoint(cx, cy);
      return !!(t && (t === c.el || c.el.contains(t) || t.contains(c.el)));
    });
    // Primer texto visible (hoja con texto propio) = lo mas alto del contenido.
    const leaves = [...scope.querySelectorAll("*")].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((e) => ({ label: label(e), ...rect(e), fs: parseFloat(getComputedStyle(e).fontSize) }));
    const topLeaf = leaves.sort((a, b) => a.top - b.top)[0] || null;
    const titleLeaf = leaves.filter((l) => l.fs >= 24).sort((a, b) => a.top - b.top)[0] || null;
    const horiz = leaves.filter((l) => l.left < -0.5 || l.right > vw + 0.5).map((l) => l.label);
    const inSc = (e) => (scroller ? scroller.contains(e) : true);
    // Fondo del contenido = ultimo bloque del contenido con scroll (sin contar su padding inferior); en el ANTES, la hoja mas baja.
    let contentBottom = 0;
    const lastBlock = scEl && scEl.firstElementChild && scEl.firstElementChild.lastElementChild;
    if (lastBlock) contentBottom = lastBlock.getBoundingClientRect().bottom;
    else for (const e of (scroller || document.body).querySelectorAll("*")) { if (!vis(e) || !inSc(e) || e.children.length) continue; contentBottom = Math.max(contentBottom, e.getBoundingClientRect().bottom); }
    const lastCard = controls.filter((c) => c.inScroll && c.tag !== "INPUT").sort((a, b) => b.bottom - a.bottom)[0] || null;
    const input = document.querySelector("input");
    const vv = window.visualViewport;
    const cleanControls = controls.map(({ el, ...c }) => c);
    return {
      vw, vh, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, scrollY: window.scrollY,
      vvH: vv ? vv.height : vh, vvTop: vv ? vv.offsetTop : 0,
      root: rootEl ? { ...rect(rootEl), pos: getComputedStyle(rootEl).position, kb: rootEl.getAttribute("data-onb-kb") } : null,
      sc: scroller ? { ...rect(scroller), scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight, dataAttr: !!scEl } : null,
      bot: botEl ? rect(botEl) : null,
      controls: cleanControls, hits, topLeaf, titleLeaf, horiz, contentBottom,
      lastCard: lastCard ? { label: lastCard.label, top: lastCard.top, bottom: lastCard.bottom, h: lastCard.h } : null,
      input: input ? rect(input) : null,
    };
  });
}

const setScroll = (page, where) => page.evaluate((w) => {
  window.scrollTo(0, w === "end" ? 99999 : 0);
  for (const e of document.querySelectorAll("*")) { const o = getComputedStyle(e).overflowY; if ((o === "auto" || o === "scroll") && e.scrollHeight > e.clientHeight + 1) e.scrollTop = w === "end" ? e.scrollHeight : 0; }
}, where);

function checkState(name, size, m0, m1, extra, issues) {
  const { width, height, safeTop } = size;
  const f = (msg) => issues.push(`${name}: ${msg}`);
  const isFinal = /^final/.test(name);
  const tops = [["inicio", m0], ["final", m1]];
  if (!m0.root) f("falta la raiz [data-onb-root]");
  else for (const [st, m] of tops) {
    if (m.root.pos !== "fixed" || Math.abs(m.root.top - m.vvTop) > 0.5 && !extra.kb || Math.abs(m.root.w - m.vw) > 0.5 || (!extra.kb && Math.abs(m.root.bottom - m.vh) > 0.5)) f(`la raiz no cubre el viewport en scroll ${st}: ${JSON.stringify({ pos: m.root.pos, top: m.root.top, bottom: m.root.bottom, w: m.root.w, vh: m.vh })}`);
  }
  if (!m0.sc || !m0.sc.dataAttr) f("falta el area con scroll interno [data-onb-scroll]");
  if (!m0.bot) f("falta el bloque inferior [data-onb-bottom]");
  for (const [st, m] of tops) {
    if (m.scrollY !== 0 || m.docH > m.vh + 1) f(`el documento hace scroll (scrollY ${m.scrollY}, docH ${m.docH} > vh ${m.vh}) en ${st}`);
    if (m.docW > m.vw + 1) f(`overflow horizontal (${m.docW} > ${m.vw}) en ${st}`);
    if (m.horiz.length) f(`texto fuera horizontalmente en ${st}: ${m.horiz.join(" | ")}`);
  }
  // Encabezado: lo mas alto (scroll 0) no puede quedar bajo la barra de estado.
  if (m0.topLeaf && m0.topLeaf.top < safeTop - 0.5) f(`encabezado superpuesto con la barra de estado (top ${m0.topLeaf.top.toFixed(1)} < safe-top ${safeTop}): "${m0.topLeaf.label}"`);
  if (m0.sc && m0.sc.top < safeTop - 0.5 && safeTop) f(`el area con scroll empieza bajo la barra de estado (top ${m0.sc.top.toFixed(1)} < ${safeTop})`);
  // Controles >=44 x 44.
  for (const c of m0.controls) if (c.h < 43.5 || c.w < 43.5) f(`control < 44 px: "${c.label}" ${c.w.toFixed(0)}x${c.h.toFixed(0)}`);
  // Botones del bloque inferior: dentro del viewport, sin moverse entre scroll 0 y final, sin tapar.
  const b0 = m0.controls.filter((c) => c.inBottom), b1 = m1.controls.filter((c) => c.inBottom);
  if (!b0.length) f("no hay controles en el bloque inferior");
  for (const [st, list, m] of [["inicio", b0, m0], ["final", b1, m1]]) for (const c of list) {
    const lo = extra.kb ? m.vvTop : 0, hi = extra.kb ? m.vvTop + m.vvH : m.vh;
    if (c.top < lo - 0.5 || c.bottom > hi + 0.5 || c.left < -0.5 || c.right > m.vw + 0.5) f(`boton inferior fuera del viewport visible en ${st}: "${c.label}" (top ${c.top.toFixed(1)}, bottom ${c.bottom.toFixed(1)}, visible ${lo}-${hi})`);
  }
  b0.forEach((c, i) => { const d = b1[i]; if (d && Math.abs(c.top - d.top) > 0.5) f(`el boton "${c.label}" se movio entre scroll inicial y final`); });
  m0.controls.forEach((c, i) => { if (c.inBottom && m0.hits[i] === false) f(`boton inferior tapado por otro elemento: "${c.label}"`); });
  // Ultima tarjeta/opcion: completa y con holgura >= 8 px sobre el bloque inferior, tras el scroll final.
  if (m1.bot) {
    const gap = m1.bot.top - m1.contentBottom;
    extra.gap = +gap.toFixed(1);
    if (gap < 8 - 0.5) f(`el contenido llega a ${gap.toFixed(1)} px del bloque inferior (< 8 px) al final del scroll`);
    if (m1.lastCard && m1.lastCard.bottom > m1.bot.top - 8 + 0.5) f(`ultima tarjeta/opcion tapada: bottom ${m1.lastCard.bottom.toFixed(1)} > ${(m1.bot.top - 8).toFixed(1)}`);
    if (m0.sc && m1.lastCard && m1.sc && m1.lastCard.top < m1.sc.top - 0.5) f("ultima tarjeta cortada por arriba al final del scroll");
  }
  // Cada control con scroll cabe en el area visible (alcanzable).
  if (m0.sc) for (const c of m0.controls) if (c.inScroll && c.h > m0.sc.clientHeight + 0.5) f(`el control "${c.label}" es mas alto que el area de scroll`);
  // Titulo no cortado arriba al inicio.
  if (m0.titleLeaf && m0.titleLeaf.top < 0) f("titulo recortado arriba");
  // Pantalla final: el CTA principal debe quedar centrado y con el ancho del contenedor (ONBOARD_CONTENT_WRAP - 2*24).
  if (isFinal) {
    const cta = b0.find((c) => /ir a mi panel|redirigiendo/i.test(c.label));
    if (!cta) f("no se encontro el boton IR A MI PANEL");
    else {
      const expW = Math.min(m0.vw, 430) - 48;
      if (Math.abs((cta.left + cta.right) / 2 - m0.vw / 2) > 1) f(`IR A MI PANEL no esta centrado (centro ${((cta.left + cta.right) / 2).toFixed(1)} vs ${m0.vw / 2})`);
      if (Math.abs(cta.w - expW) > 1.5) f(`IR A MI PANEL con ancho ${cta.w.toFixed(1)} != ancho del contenedor ${expW}`);
      if (cta.h < 52) f(`IR A MI PANEL de ${cta.h.toFixed(1)} px de alto (< 52)`);
      extra.cta = { w: +cta.w.toFixed(1), h: +cta.h.toFixed(1), left: +cta.left.toFixed(1) };
    }
  }
}

async function clickText(page, re, { tags = "button,[role=button],div,span", timeout = 8000 } = {}) {
  const src = re.source, fl = re.flags;
  const h = await page.waitForFunction(({ src, fl, tags }) => {
    const rx = new RegExp(src, fl);
    const els = [...document.querySelectorAll(tags)].filter((e) => rx.test((e.innerText || "").trim()) && e.getBoundingClientRect().width > 0);
    // el mas profundo con ese texto, luego su ancestro clicable
    els.sort((a, b) => (a.querySelectorAll("*").length - b.querySelectorAll("*").length));
    const e = els[0];
    if (!e) return false;
    window.__clickTarget = e.closest("button,[role=button]") || e.parentElement?.closest("[style*='cursor: pointer']") || e;
    return true;
  }, { src, fl, tags }, { timeout });
  await h.dispose();
  await page.evaluate(() => { window.__clickTarget.click(); });
}
const waitText = (page, re, timeout = 8000) => page.waitForFunction(({ src, fl }) => new RegExp(src, fl).test(document.body.innerText), { src: re.source, fl: re.flags }, { timeout });

async function runFlow(browser, port, size, o, fails, report) {
  const { width, height, safeTop } = size;
  const touch = width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 2, colorScheme: "dark" });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
    if (u.hostname === MOCK_HOST) return route.fulfill({ status: 401, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" });
    return route.abort();
  });
  await ctx.addInitScript(() => { try { localStorage.setItem("it_lang", "es"); localStorage.setItem("it_dark", "true"); sessionStorage.setItem("it_splash_shown_v1", "1"); } catch { /* storage */ } });
  const suffix = `${width}x${height}${safeTop ? "_notch" : ""}`;
  const shot = (page, name, where) => page.screenshot({ path: path.join(o.out, `${o.tag}_${suffix}_${name}${where === "end" ? "_fin" : ""}.png`) });
  const issuesAll = [];

  async function newPage() {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    if (safeTop) await page.addInitScript((t) => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ":root{--it-safe-top:" + t + "px}"; document.head.appendChild(s); }); }, safeTop);
    await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "load" });
    await waitText(page, /EMPEZAR GRATIS|GET STARTED FREE/i, 15000);
    await page.waitForTimeout(900);
    await clickText(page, /EMPEZAR GRATIS|GET STARTED FREE/i, { tags: "button" });
    await waitText(page, /TU PERFIL/);
    await page.waitForTimeout(400);
    return { page, errors };
  }

  async function capture(page, name) {
    await page.waitForTimeout(900); // animaciones de entrada (.5 s + delays) y autofoco del nombre
    await setScroll(page, "start");
    await page.waitForTimeout(150);
    await shot(page, name, "start");
    const m0 = await measure(page);
    await setScroll(page, "end");
    await page.waitForTimeout(250);
    await shot(page, name, "end");
    const m1 = await measure(page);
    const issues = [], extra = {};
    checkState(name, size, m0, m1, extra, issues);
    report.push({ tag: `${suffix}_${name}`, width, height, safeTop, scrollOverflow: m0.sc ? m0.sc.scrollHeight - m0.sc.clientHeight : null, gapBloque: extra.gap, titleTop: m0.titleLeaf && +m0.titleLeaf.top.toFixed(1), topText: m0.topLeaf && +m0.topLeaf.top.toFixed(1), cards: m0.controls.filter((c) => c.tag === "DIV" && c.h > 60).map((c) => +c.h.toFixed(1)), cta: extra.cta, issues });
    for (const i of issues) fails.push(`${suffix}: ${i}`);
    return { m0, m1 };
  }

  // Teclado estilo iOS: el layout viewport NO cambia, visualViewport.height se reduce (y puede desplazarse offsetTop).
  async function keyboard(page, name, pan) {
    const kb = width > height ? Math.round(height * 0.5) : Math.min(336, Math.round(height * 0.46));
    await page.evaluate(([kbH, top]) => {
      const vv = window.visualViewport, full = innerHeight;
      let h = full, t = 0;
      if (!window.__vvStub) {
        Object.defineProperty(vv, "height", { get: () => h, configurable: true });
        Object.defineProperty(vv, "offsetTop", { get: () => t, configurable: true });
        window.__vvStub = (nh, nt) => { h = nh; t = nt; vv.dispatchEvent(new Event("resize")); vv.dispatchEvent(new Event("scroll")); };
      }
      document.querySelector("input")?.focus();
      window.__vvStub(full - kbH, top);
    }, [kb, pan]);
    await page.waitForTimeout(900);
    const m = await measure(page);
    const nm = `${name}${pan ? "-pan" : ""}-teclado`;
    await shot(page, nm, "start");
    const issues = [];
    const f = (msg) => issues.push(`${nm}: ${msg}`);
    const lo = m.vvTop, hi = m.vvTop + m.vvH;
    if (!m.root) f("falta la raiz");
    else {
      if (m.root.top < lo - 1 || m.root.bottom > hi + 1) f(`la raiz sobresale del viewport visible (${m.root.top.toFixed(1)}-${m.root.bottom.toFixed(1)} vs ${lo}-${hi})`);
    }
    if (!m.input) f("no hay input");
    else {
      const sc = m.sc, bot = m.bot;
      if (m.input.top < Math.max(lo, sc ? sc.top : lo) - 0.5 || m.input.bottom > Math.min(hi, bot ? bot.top : hi) + 0.5) f(`el input no queda visible sobre el bloque inferior (input ${m.input.top.toFixed(1)}-${m.input.bottom.toFixed(1)}, visible ${Math.max(lo, sc ? sc.top : lo).toFixed(1)}-${Math.min(hi, bot ? bot.top : hi).toFixed(1)})`);
    }
    const btns = m.controls.filter((c) => c.tag === "BUTTON");
    const crear = btns.find((c) => /crear mi perfil/i.test(c.label));
    if (!crear) f("no se encontro 'Crear mi perfil'");
    else {
      if (crear.bottom > hi + 0.5 || crear.top < lo - 0.5) f(`'Crear mi perfil' fuera del viewport visible con teclado (${crear.top.toFixed(1)}-${crear.bottom.toFixed(1)} vs ${lo}-${hi})`);
      const idx = m.controls.indexOf(m.controls.find((c) => c === crear));
      if (m.hits[idx] === false) f("'Crear mi perfil' tapado con teclado");
    }
    if (m.docW > m.vw + 1) f("overflow horizontal con teclado");
    report.push({ tag: `${suffix}_${nm}`, width, height, safeTop, kbPx: kb, rootTop: m.root && +m.root.top.toFixed(1), rootBottom: m.root && +m.root.bottom.toFixed(1), visible: [lo, hi], input: m.input && [+m.input.top.toFixed(1), +m.input.bottom.toFixed(1)], crear: crear && [+crear.top.toFixed(1), +crear.bottom.toFixed(1)], issues });
    for (const i of issues) fails.push(`${suffix}: ${i}`);
    await page.evaluate(() => { document.activeElement?.blur(); window.__vvStub(innerHeight, 0); });
    await page.waitForTimeout(300);
  }

  // ---- Camino Entrenador ----
  {
    const { page, errors } = await newPage();
    await capture(page, "perfil-sin-seleccion");
    await clickText(page, /^Entrenador$/);
    await page.waitForTimeout(250);
    await capture(page, "perfil-entrenador");
    await clickText(page, /Continuar como entrenador/, { tags: "button" });
    await waitText(page, /TU IDENTIDAD PROFESIONAL/);
    await page.waitForTimeout(500);
    await page.fill("input", "Hernán");
    await capture(page, "nombre-entrenador");
    if (touch) { await keyboard(page, "nombre-entrenador", 0); await keyboard(page, "nombre-entrenador", 40); }
    await clickText(page, /Crear mi perfil/, { tags: "button" });
    await waitText(page, /TU SITUACIÓN ACTUAL|Tu situación actual/i);
    await page.waitForTimeout(500);
    await capture(page, "alumnos-sin-seleccion");
    await clickText(page, /5 — 10 alumnos/, { tags: "span" });
    await page.waitForTimeout(300);
    await capture(page, "alumnos-seleccion");
    await clickText(page, /^Continuar$/i, { tags: "button" });
    await waitText(page, /Todo listo/);
    await page.waitForTimeout(500);
    await capture(page, "final-entrenador");
    // Atras desde el final vuelve a "alumnos" (entrenador); Continuar -> final otra vez.
    await clickText(page, /atr[aá]s/i, { tags: "button" });
    await waitText(page, /¿CUÁNTOS ALUMNOS/);
    await clickText(page, /^Atrás$|Atrás/, { tags: "button" });
    await waitText(page, /TU IDENTIDAD PROFESIONAL/);
    await clickText(page, /atr[aá]s/i, { tags: "button" });
    await waitText(page, /¿CÓMO USÁS/);
    if (errors.length) { fails.push(`${suffix}: errores de pagina: ${errors.join(" | ")}`); issuesAll.push(...errors); }
    await page.close();
  }
  // ---- Camino Atleta (salta alumnos) ----
  {
    const { page, errors } = await newPage();
    await clickText(page, /^Atleta$/);
    await page.waitForTimeout(250);
    await capture(page, "perfil-atleta");
    await clickText(page, /Continuar como atleta/, { tags: "button" });
    await waitText(page, /SOBRE VOS/);
    await page.waitForTimeout(500);
    await page.fill("input", "Hernán");
    await capture(page, "nombre-atleta");
    await clickText(page, /Crear mi perfil/, { tags: "button" });
    await waitText(page, /Todo listo/);
    if (await page.evaluate(() => /CUÁNTOS ALUMNOS/.test(document.body.innerText))) fails.push(`${suffix}: el camino Atleta no salto la pantalla de alumnos`);
    await page.waitForTimeout(500);
    await capture(page, "final-atleta");
    await clickText(page, /atr[aá]s/i, { tags: "button" });
    await waitText(page, /SOBRE VOS/); // Atras desde el final del atleta vuelve al nombre
    await clickText(page, /Crear mi perfil/, { tags: "button" });
    await waitText(page, /Todo listo/);
    await clickText(page, /Ir a mi panel/i, { tags: "button" });
    await waitText(page, /Redirigiendo/i, 4000).catch(() => fails.push(`${suffix}: 'IR A MI PANEL' no muestra 'Redirigiendo...'`));
    if (errors.length) fails.push(`${suffix}: errores de pagina: ${errors.join(" | ")}`);
    await page.close();
  }
  await ctx.close();
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (!o.out) throw new Error("Falta --out <dir>");
  fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-onb2-dist-" + Date.now());
    const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" } });
    if (r.status !== 0) throw new Error("El build de QA fallo");
  }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  const fails = [], report = [];
  for (const [width, height, safeTop] of SIZES) {
    try { await runFlow(browser, port, { width, height, safeTop }, o, fails, report); }
    catch (e) { fails.push(`${width}x${height}${safeTop ? "_notch" : ""}: el flujo se interrumpio: ${String(e.message).split("\n")[0]}`); }
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(o.out, o.tag + "_report.json"), JSON.stringify(report, null, 1));
  for (const r of report) console.log(`${r.tag}: ${r.kbPx ? `teclado ${r.kbPx}px raiz ${r.rootTop}-${r.rootBottom} input ${JSON.stringify(r.input)} crear ${JSON.stringify(r.crear)}` : `desborde=${r.scrollOverflow}px holgura=${r.gapBloque}px titulo=${r.titleTop} tarjetas=${JSON.stringify(r.cards)}${r.cta ? " cta=" + JSON.stringify(r.cta) : ""}`} ${r.issues.length ? "FALLA" : "ok"}`);
  if (fails.length) {
    console.log(`\nFALLAS (${fails.length}):\n- ` + fails.join("\n- "));
    if (!o.reportOnly) process.exit(1);
    return;
  }
  console.log("PASS pasos 2-5 del onboarding. Salida:", o.out);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
