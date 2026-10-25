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
const SIZES = [[320, 568, 0], [375, 667, 0], [390, 844, 0], [393, 852, 59], [430, 932, 0], [768, 1024, 0], [1280, 800, 0]];

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

async function measure(page, safeTop) {
  return page.evaluate((safeTop) => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { top: b.top + scrollY, bottom: b.bottom + scrollY, left: b.left, right: b.right, w: b.width, h: b.height }; };
    const q = (re) => [...document.querySelectorAll("button,div,span")].filter((e) => e.children.length === 0 || e.tagName === "BUTTON").find((e) => re.test((e.innerText || "").trim()));
    const img = document.querySelector("img[alt='IronTrack']");
    const cta = [...document.querySelectorAll("button")].find((b) => /EMPEZAR GRATIS|GET STARTED FREE/i.test(b.innerText));
    const paso = q(/^(Paso 1 de 4|Step 1 of 4)$/);
    const titulo = q(/^(Convertí datos en resultados reales|Turn data into real results)$/);
    const desc = q(/^(Rutinas, alumnos y progresión|Routines, athletes)/);
    const card = q(/^(Rutinas personalizadas|Personalized routines)$/);
    const track = q(/^TRACK$/);
    // El scroll vive en un contenedor interior (el CTA es sticky abajo): se detecta el que desborda.
    const sc = [...document.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1);
    const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const last = q(/^(Progresión inteligente|Smart progression)$/);
    return {
      vw: innerWidth, vh: innerHeight, docW: document.documentElement.scrollWidth, docH,
      overflowX: document.documentElement.scrollWidth > innerWidth + 1,
      img: img && { ...r(img), complete: img.complete, nat: img.naturalWidth, src: img.getAttribute("src") },
      scrollOverflow: sc ? sc.scrollHeight - sc.clientHeight : 0, last: last && r(last),
      cta: cta && r(cta), paso: paso && r(paso), titulo: titulo && r(titulo), desc: desc && r(desc), card: card && r(card), track: track && r(track),
      safeTop,
    };
  }, safeTop);
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
    await page.screenshot({ path: path.join(o.out, tag + ".png") });
    const m = await measure(page, safeTop);
    const scrollEnd = () => page.evaluate(() => {
      const sc = [...document.querySelectorAll("div")].find((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1);
      if (sc) sc.scrollTop = sc.scrollHeight;
      const l = [...document.querySelectorAll("span")].find((e) => /^(Progresión inteligente|Smart progression)$/.test((e.innerText || "").trim()));
      const c = [...document.querySelectorAll("button")].find((b) => /EMPEZAR GRATIS|GET STARTED FREE/i.test(b.innerText));
      return { lastBottom: l.getBoundingClientRect().bottom, ctaTop: c.getBoundingClientRect().top, ctaBottom: c.getBoundingClientRect().bottom, vh: innerHeight };
    });
    await page.waitForTimeout(100);
    const end = await scrollEnd();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(o.out, tag + "_scrolled.png") });
    const issues = [];
    if (!m.cta || !m.paso || !m.titulo || !m.desc || !m.card || !m.img || !m.track) issues.push("faltan elementos del Paso 1: " + JSON.stringify(Object.fromEntries(Object.entries(m).filter(([, v]) => v === null || v === undefined).map(([k]) => [k, 0]))));
    else {
      if (m.overflowX) issues.push(`overflow horizontal (${m.docW} > ${m.vw})`);
      if (m.img.top < safeTop - 0.5) issues.push(`logo bajo la zona segura (top ${m.img.top.toFixed(1)} < ${safeTop})`);
      if (m.img.top < 0 || m.img.left < 0 || m.img.right > m.vw + 0.5) issues.push("logo recortado");
      if (!m.img.complete || m.img.nat === 0) issues.push("imagen del logo no cargo");
      if (!/isotipo-onboarding/.test(m.img.src)) issues.push("el logo no usa el isotipo recortado: " + m.img.src);
      if (m.cta.h < 44 || m.cta.w < 44) issues.push(`CTA < 44 px (${m.cta.w}x${m.cta.h})`);
      if (m.cta.left < 0 || m.cta.right > m.vw + 0.5) issues.push("CTA fuera horizontalmente");
      // Visibles SIN scroll (scroll en 0): CTA y "Paso 1 de 4" dentro del viewport en todos los tamaños.
      for (const [k, e] of [["CTA", m.cta], ["Paso 1 de 4", m.paso]]) {
        if (e.top < 0 || e.bottom > m.vh + 0.5) issues.push(`${k} fuera del viewport sin scroll (top ${e.top.toFixed(1)}, bottom ${e.bottom.toFixed(1)} > ${m.vh})`);
      }
      // Alturas >= 800: todo el contenido entra sin scroll.
      if (height >= 800 && m.scrollOverflow > 1) issues.push(`el contenido desborda ${m.scrollOverflow}px a ${width}x${height} (debe entrar sin scroll)`);
      // Con scroll al final, la ultima tarjeta queda por encima del CTA (nada tapado).
      if (end.lastBottom > end.ctaTop + 0.5) issues.push(`la ultima tarjeta queda tapada por el CTA (${end.lastBottom.toFixed(1)} > ${end.ctaTop.toFixed(1)})`);
      const orden = [m.img, m.track, m.titulo, m.desc, m.card];
      for (let i = 1; i < orden.length; i++) if (!(orden[i].top >= orden[i - 1].bottom - 0.5)) issues.push("orden vertical roto en el elemento #" + i);
      if (!(m.paso.top >= m.cta.bottom - 0.5)) issues.push("'Paso 1 de 4' no esta debajo del CTA");
      if (m.scrollOverflow === 0 && !(m.cta.top >= m.last.bottom - 0.5)) issues.push("el CTA no esta debajo de las tarjetas");
    }
    if (errors.length) issues.push("errores de pagina: " + errors.join(" | "));
    const visibleSinScroll = !!(m.cta && m.paso && m.cta.bottom <= m.vh && m.paso.bottom <= m.vh);
    report.push({ tag, width, height, safeTop, logoTop: m.img && +m.img.top.toFixed(1), logoSize: m.img && +m.img.w.toFixed(1), ctaH: m.cta && m.cta.h, docH: m.docH, scrollOverflow: m.scrollOverflow, ctaYPasoSinScroll: visibleSinScroll, issues });
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
  for (const r of report) console.log(`${r.tag}: logoTop=${r.logoTop} logo=${r.logoSize}px CTA=${r.ctaH}px desborde=${r.scrollOverflow}px CTA+paso visibles=${r.ctaYPasoSinScroll} ${r.issues.length ? "FALLA" : "ok"}`);
  if (asset) console.log("Recurso:", JSON.stringify(asset));
  if (fails.length) { console.log("\nFALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
  console.log("PASS Paso 1 onboarding. Salida:", o.out);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
