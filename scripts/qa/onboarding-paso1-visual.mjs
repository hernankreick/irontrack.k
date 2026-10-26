// QA visual del Paso 1 del onboarding (OnboardingStep0) con host simulado, sin it_onboard_done.
//   node scripts/qa/onboarding-paso1-visual.mjs --out <dir> [--tag before|after] [--dist <dir>]
// Comprueba por tamaño: sin overflow horizontal, logo completo bajo la zona segura, CTA >=44 px y alcanzable,
// "Paso 1 de 4" alcanzable, orden vertical y recurso del isotipo sin baldosa (alfa 0 en esquinas/bordes).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
// [ancho, alto, safe-top simulado en px (0 = sin notch)]
const SIZES = [[320, 480, 0], [375, 560, 0], [390, 620, 0], [844, 390, 0], [320, 568, 0], [375, 667, 0], [390, 844, 0], [393, 852, 59], [430, 932, 0], [768, 1024, 0], [1280, 800, 0]];

function parse(argv) {
  const o = { tag: "after" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--tag") o.tag = argv[++i];
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else throw new Error("Opcion desconocida: " + a);
  }
  return o;
}

// Decodificador PNG minimo (8 bits RGBA, sin entrelazado o paleta indexada con tRNS) para medir alfa sin dependencias.
function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 0, bd = 0, plte = null, trns = null; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    else if (type === "PLTE") plte = d;
    else if (type === "tRNS") trns = d;
    else if (type === "IDAT") idat.push(d);
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 6 && ct !== 3)) throw new Error("PNG no soportado (ct=" + ct + " bd=" + bd + ")");
  const bpp = ct === 6 ? 4 : 1, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = row[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  const alpha = (x, y) => (ct === 6 ? out[y * stride + x * 4 + 3] : trns && out[y * stride + x] < trns.length ? trns[out[y * stride + x]] : 255);
  return { w, h, alpha, plte };
}

function checkAsset(file) {
  const im = decodePng(fs.readFileSync(file));
  const n = im.w, m = Math.round(n * 0.1);
  let corner = 0, edge = 0, outside = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = im.alpha(x, y);
    if (x < m && y < m || x >= n - m && y < m || x < m && y >= n - m || x >= n - m && y >= n - m) corner = Math.max(corner, a);
    if (x === 0 || y === 0 || x === n - 1 || y === n - 1) edge = Math.max(edge, a);
    if (Math.hypot(x - (n - 1) / 2, y - (n - 1) / 2) > n / 2) outside = Math.max(outside, a);
  }
  return { size: n + "x" + im.h, bytes: fs.statSync(file).size, cornerMaxAlpha: corner, edgeMaxAlpha: edge, outsideCircleMaxAlpha: outside };
}

// Medicion en la pagina. Estado = scroll del contenedor interior [data-onb-scroll] (el documento NO debe hacer scroll).
async function measure(page) {
  return page.evaluate(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height }; };
    const byText = (tag, re) => [...document.querySelectorAll(tag)].find((e) => re.test((e.innerText || "").trim()) && e.children.length <= 2);
    const sc = document.querySelector("[data-onb-scroll]"), bot = document.querySelector("[data-onb-bottom]");
    const img = document.querySelector("img[alt='IronTrack']");
    const cta = [...document.querySelectorAll("button")].find((b) => /EMPEZAR GRATIS|GET STARTED FREE/i.test(b.innerText));
    const paso = byText("div", /^(Paso 1 de 4|Step 1 of 4)$/);
    const titulo = byText("div", /^(Convertí datos en resultados reales|Turn data into real results)$/);
    const desc = byText("div", /^(Rutinas, alumnos y progresión|Routines, athletes)/);
    const track = byText("div", /^TRACK$/);
    const cards = ["Rutinas personalizadas|Personalized routines", "Seguimiento de alumnos|Athlete tracking", "Progresión inteligente|Smart progression"].map((t) => byText("span", new RegExp("^(" + t + ")$")));
    const root = sc && sc.parentElement && sc.parentElement.parentElement;
    return {
      vw: innerWidth, vh: innerHeight, docW: document.documentElement.scrollWidth, docH: document.documentElement.scrollHeight, scrollY: scrollY,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      rootRect: root && r(root), rootPos: root && getComputedStyle(root).position,
      sc: sc && { ...r(sc), scrollTop: sc.scrollTop, scrollHeight: sc.scrollHeight, clientHeight: sc.clientHeight },
      bot: bot && r(bot),
      img: img && { ...r(img), complete: img.complete, nat: img.naturalWidth, src: img.getAttribute("src") },
      cta: cta && r(cta), paso: paso && r(paso), titulo: titulo && r(titulo), desc: desc && r(desc), track: track && r(track),
      cards: cards.map((c) => c && r(c.closest("div[style*='border-radius: 16px']") || c)),
    };
  });
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (!o.out) throw new Error("Falta --out <dir>");
  fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-onb-dist-" + Date.now());
    const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" } });
    if (r.status !== 0) throw new Error("El build de QA fallo");
  }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  const fails = [], report = [];
  for (const [width, height, safeTop] of SIZES) {
    const touch = width < 1024;
    const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 2, colorScheme: "dark" });
    // Solo el servidor local y el host simulado; el resto (p. ej. foto de fondo) se aborta. Auth del host simulado: 401.
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
      if (u.hostname === MOCK_HOST) return route.fulfill({ status: 401, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" });
      return route.abort();
    });
    await ctx.addInitScript(() => {
      try { localStorage.setItem("it_lang", "es"); localStorage.setItem("it_dark", "true"); sessionStorage.setItem("it_splash_shown_v1", "1"); } catch { /* storage bloqueado */ }
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    if (safeTop) await page.addInitScript((t) => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ":root{--it-safe-top:" + t + "px}"; document.head.appendChild(s); }); }, safeTop);
    await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "load" });
    await page.waitForFunction(() => /EMPEZAR GRATIS|GET STARTED FREE/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const tag = `${o.tag}_${width}x${height}${safeTop ? "_notch" : ""}`;
    const scrollTo = (where) => page.evaluate((w) => { const sc = document.querySelector("[data-onb-scroll]"); if (sc) sc.scrollTop = w === "end" ? sc.scrollHeight : 0; }, where);
    await scrollTo("start");
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(o.out, tag + ".png") });
    const m0 = await measure(page);
    await scrollTo("end");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(o.out, tag + "_scrolled.png") });
    const m1 = await measure(page);
    const issues = [];
    if (!m0.cta || !m0.paso || !m0.titulo || !m0.desc || !m0.img || !m0.track || !m0.sc || !m0.bot || m0.cards.some((c) => !c)) issues.push("faltan elementos del Paso 1");
    else {
      if (m0.overflowX) issues.push(`overflow horizontal (${m0.docW} > ${m0.vw})`);
      if (m0.rootPos !== "fixed" || Math.abs(m0.rootRect.top) > 0.5 || Math.abs(m0.rootRect.bottom - m0.vh) > 0.5 || Math.abs(m0.rootRect.w - m0.vw) > 0.5) issues.push("la raiz del Paso 1 no cubre exactamente el viewport visible: " + JSON.stringify(m0.rootRect));
      if (m1.scrollY !== 0 || m0.scrollY !== 0) issues.push("el documento hizo scroll (debe hacerlo solo el contenedor)");
      if (m0.img.top < safeTop - 0.5) issues.push(`logo bajo la zona segura (top ${m0.img.top.toFixed(1)} < ${safeTop})`);
      if (m0.img.top < 0 || m0.img.left < 0 || m0.img.right > m0.vw + 0.5) issues.push("logo recortado");
      if (m0.titulo.top < 0) issues.push("titulo recortado arriba");
      if (!m0.img.complete || m0.img.nat === 0) issues.push("imagen del logo no cargo");
      if (!/isotipo-onboarding/.test(m0.img.src)) issues.push("el logo no usa el isotipo recortado: " + m0.img.src);
      if (m0.cta.h < 44 || m0.cta.w < 44) issues.push(`CTA < 44 px (${m0.cta.w}x${m0.cta.h})`);
      if (m0.cta.left < 0 || m0.cta.right > m0.vw + 0.5) issues.push("CTA fuera horizontalmente");
      // (a) CTA y Paso 1 de 4 dentro del viewport en scroll 0 y en scroll final, en la MISMA posicion (fijos).
      for (const [k, e0, e1] of [["CTA", m0.cta, m1.cta], ["Paso 1 de 4", m0.paso, m1.paso]]) {
        for (const [st, e] of [["inicio", e0], ["final", e1]]) if (e.top < 0 || e.bottom > m0.vh + 0.5) issues.push(`${k} fuera del viewport en scroll ${st} (top ${e.top.toFixed(1)}, bottom ${e.bottom.toFixed(1)} > ${m0.vh})`);
        if (Math.abs(e0.top - e1.top) > 0.5) issues.push(`${k} se movio entre scroll inicial y final`);
      }
      if (!(m0.paso.top >= m0.cta.bottom - 0.5)) issues.push("'Paso 1 de 4' no esta debajo del CTA");
      // (b) tras scroll al final del contenedor, la ultima tarjeta queda completa y >= 8 px sobre el bloque inferior.
      const last = m1.cards[2];
      if (last.bottom > m1.bot.top - 8 + 0.5) issues.push(`3.a tarjeta tapada: bottom ${last.bottom.toFixed(1)} > top bloque inferior - 8 (${(m1.bot.top - 8).toFixed(1)})`);
      if (last.top < m1.sc.top - 0.5) issues.push("3.a tarjeta cortada por arriba al final del scroll");
      // (c) las 3 tarjetas alcanzables: cada una cabe en el alto del contenedor, y la 1.a es visible al inicio.
      m0.cards.forEach((c, i) => { if (c.h > m0.sc.clientHeight) issues.push(`tarjeta ${i + 1} mas alta que el area de scroll`); });
      if (m0.cards[0].top < m0.sc.top - 0.5) issues.push("1.a tarjeta cortada por arriba");
      // Orden vertical (en scroll 0).
      const orden = [m0.img, m0.track, m0.titulo, m0.desc, m0.cards[0], m0.cards[1], m0.cards[2]];
      for (let i = 1; i < orden.length; i++) if (!(orden[i].top >= orden[i - 1].bottom - 0.5)) issues.push("orden vertical roto en el elemento #" + i);
      // Alturas >= 800 sin notch: todo entra sin scroll (con notch simulado de 59 px el contenedor puede desbordar unos px y se recorre con scroll: la 3.a tarjeta se verifica arriba).
      const overflow = m0.sc.scrollHeight - m0.sc.clientHeight;
      if (height >= 800 && !safeTop && overflow > 1) issues.push(`el contenido desborda ${overflow}px a ${width}x${height} (debe entrar sin scroll)`);
      m0.overflow = overflow; m0.lastGap = +(m1.bot.top - last.bottom).toFixed(1);
    }
    if (errors.length) issues.push("errores de pagina: " + errors.join(" | "));
    report.push({ tag, width, height, safeTop, logoTop: m0.img && +m0.img.top.toFixed(1), logoSize: m0.img && +m0.img.w.toFixed(1), ctaH: m0.cta && +m0.cta.h.toFixed(1), scrollOverflow: m0.overflow, terceraTarjetaHolgura: m0.lastGap, issues });
    for (const i of issues) fails.push(`${tag}: ${i}`);
    await ctx.close();
  }
  await browser.close();
  server.close();
  let asset = null;
  const assetFile = path.join(dist, "isotipo-onboarding.png");
  if (fs.existsSync(assetFile)) {
    asset = checkAsset(assetFile);
    if (asset.cornerMaxAlpha !== 0 || asset.edgeMaxAlpha !== 0 || asset.outsideCircleMaxAlpha !== 0) fails.push("el recurso del isotipo tiene alfa fuera del circulo (baldosa): " + JSON.stringify(asset));
    if (asset.bytes > 150 * 1024) fails.push("el recurso pesa > 150 KB: " + asset.bytes);
  } else if (o.tag === "after") fails.push("no existe isotipo-onboarding.png en el build");
  fs.writeFileSync(path.join(o.out, o.tag + "_report.json"), JSON.stringify({ report, asset }, null, 1));
  for (const r of report) console.log(`${r.tag}: logoTop=${r.logoTop} logo=${r.logoSize}px CTA=${r.ctaH}px desborde=${r.scrollOverflow}px 3a-tarjeta holgura sobre bloque=${r.terceraTarjetaHolgura}px ${r.issues.length ? "FALLA" : "ok"}`);
  if (asset) console.log("Recurso:", JSON.stringify(asset));
  if (fails.length) { console.log("\nFALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
  console.log("PASS Paso 1 onboarding. Salida:", o.out);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
