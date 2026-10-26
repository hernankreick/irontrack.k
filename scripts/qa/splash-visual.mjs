// QA visual del splash de React (IronTrackSplash) con host simulado: sin it_splash_shown_v1 en sessionStorage.
//   node scripts/qa/splash-visual.mjs --out <dir> [--tag before|after] [--dist <dir>]
// Comprueba: isotipo sin baldosa (alfa 0 en esquinas/bordes del <img> renderizado y pixeles identicos con/sin <img> en las esquinas),
// circulo centrado y dentro del viewport, sin overflow, role=dialog/aria intactos y transicion al onboarding / login sin overlay residual.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SIZES = [[375, 667, 0], [390, 844, 0], [393, 852, 59], [430, 932, 0], [1280, 800, 0]];

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

async function newPage(browser, port, { width, height, reduced, onboardDone, slow }) {
  const touch = width < 1024;
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 2, colorScheme: "dark", reducedMotion: reduced ? "reduce" : "no-preference" });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
    if (u.hostname === MOCK_HOST) return route.fulfill({ status: 401, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" });
    return route.abort();
  });
  await ctx.addInitScript((done) => { try { localStorage.setItem("it_lang", "es"); if (done) localStorage.setItem("it_onboard_done", "1"); } catch { /* storage */ } }, onboardDone);
  // slow: los temporizadores del splash (320/560/1240/1480 ms) se alargan x8 SOLO para poder medir con calma; la duracion real se prueba aparte.
  if (slow) await ctx.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (fn, ms, ...a) => st(fn, [320, 560, 1240, 1480].includes(ms) ? ms * 8 : ms, ...a); });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  return { ctx, page, errors };
}

async function main() {
  const o = parse(process.argv.slice(2));
  if (!o.out) throw new Error("Falta --out <dir>");
  fs.mkdirSync(o.out, { recursive: true });
  let dist = o.dist;
  if (!dist) {
    dist = path.join(os.tmpdir(), "irontrack-splash-dist-" + Date.now());
    const r = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" } });
    if (r.status !== 0) throw new Error("El build de QA fallo");
  }
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
  const { server, port } = await serve(dist);
  const fails = [], report = [];
  const expectIsotipo = o.tag === "after";

  for (const reduced of [false, true]) {
    for (const [width, height, safeTop] of SIZES) {
      if (reduced && width !== 390) continue; // movimiento reducido: un tamano representativo
      const tag = `${o.tag}_${reduced ? "reducido_" : ""}${width}x${height}${safeTop ? "_notch" : ""}`;
      const { ctx, page, errors } = await newPage(browser, port, { width, height, reduced, onboardDone: false, slow: true });
      if (safeTop) await page.addInitScript((t) => { document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ":root{--it-safe-top:" + t + "px}"; document.head.appendChild(s); }); }, safeTop);
      await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[role=dialog] img", { timeout: 8000 });
      await page.waitForTimeout(120);
      const issues = [];
      const m = await page.evaluate(async () => {
        const d = document.querySelector("[role=dialog]"), img = d.querySelector("img");
        await (img.decode ? img.decode().catch(() => {}) : null);
        const b = img.getBoundingClientRect();
        const cv = document.createElement("canvas"); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
        const n = cv.width, k = Math.round(n * 0.1), px = g.getImageData(0, 0, n, n).data;
        let corner = 0, edge = 0;
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
          const a = px[(y * n + x) * 4 + 3];
          if ((x < k || x >= n - k) && (y < k || y >= n - k)) corner = Math.max(corner, a);
          if (x === 0 || y === 0 || x === n - 1 || y === n - 1) edge = Math.max(edge, a);
        }
        return {
          vw: innerWidth, vh: innerHeight, docW: document.documentElement.scrollWidth,
          role: d.getAttribute("role"), modal: d.getAttribute("aria-modal"), lb: d.getAttribute("aria-labelledby"), db: d.getAttribute("aria-describedby"),
          title: document.getElementById("it-splash-title")?.innerText, sub: !!document.getElementById("it-splash-sub"),
          src: img.getAttribute("src"), alt: img.alt, rect: { l: b.left, t: b.top, w: b.width, h: b.height }, nat: n, corner, edge,
          bg: getComputedStyle(d).backgroundImage, opacity: getComputedStyle(d).opacity,
        };
      });
      const r = m.rect, cx = r.l + r.w / 2;
      const clipFor = (x, y) => ({ x: Math.max(0, x), y: Math.max(0, y), width: 8, height: 8 });
      const corners = [[r.l, r.t], [r.l + r.w - 8, r.t], [r.l, r.t + r.h - 8], [r.l + r.w - 8, r.t + r.h - 8]].map(([x, y]) => clipFor(x, y));
      const withImg = [];
      for (const c of corners) withImg.push(await page.screenshot({ clip: c }));
      await page.screenshot({ path: path.join(o.out, tag + ".png") });
      await page.evaluate(() => { document.querySelector("[role=dialog] img").style.visibility = "hidden"; });
      const diffCorners = [];
      for (let i = 0; i < corners.length; i++) diffCorners.push(!(await page.screenshot({ clip: corners[i] })).equals(withImg[i]));
      await page.evaluate(() => { document.querySelector("[role=dialog] img").style.visibility = "visible"; });

      if (m.role !== "dialog" || m.modal !== "true" || m.lb !== "it-splash-title" || m.db !== "it-splash-sub" || m.title !== "IronTrack" || !m.sub) issues.push("dialogo/aria alterado");
      if (m.alt !== "IronTrack") issues.push("alt distinto de IronTrack");
      if (m.docW > m.vw + 1) issues.push("overflow horizontal");
      if (Math.abs(cx - m.vw / 2) > 1) issues.push(`imagen no centrada (${cx.toFixed(1)} vs ${m.vw / 2})`);
      if (r.l < 0 || r.l + r.w > m.vw || r.t < 0 || r.t + r.h > m.vh) issues.push("imagen fuera del viewport");
      if (r.t < safeTop) issues.push("imagen bajo la zona segura");
      if (expectIsotipo) {
        if (!/isotipo-onboarding\.png$/.test(m.src)) issues.push("el splash no usa el isotipo: " + m.src);
        if (m.corner !== 0 || m.edge !== 0) issues.push(`alfa residual en el <img> renderizado (esquinas ${m.corner}, bordes ${m.edge})`);
        if (diffCorners.some(Boolean)) issues.push("pixeles de baldosa en las esquinas del <img> (difieren de visibility:hidden): " + JSON.stringify(diffCorners));
        if (Math.abs(r.w - 98) > 0.5) issues.push("tamano del isotipo distinto de 98 px: " + r.w);
      } else if (!/icon-1024\.png$/.test(m.src)) issues.push("(antes) src inesperado " + m.src);
      if (!/#0f172a|rgb\(15, 23, 42\)/.test(m.bg)) issues.push("gradiente de fondo alterado: " + m.bg);

      // Transicion: el splash desaparece (1480 ms normal / 560 ms reducido) y queda el onboarding sin overlay.
      await page.waitForTimeout((reduced ? 560 : 1480) * 8 + 700);
      const after = await page.evaluate(() => ({ dialog: !!document.getElementById("it-splash-title"), cta: /EMPEZAR GRATIS|GET STARTED FREE/i.test(document.body.innerText) }));
      if (after.dialog) issues.push("el splash no desaparecio");
      if (!after.cta) issues.push("no aparecio el onboarding tras el splash");
      if (errors.length) issues.push("errores de pagina: " + errors.join(" | "));
      report.push({ tag, size: `${m.rect.w}px`, centerX: +cx.toFixed(1), top: +r.t.toFixed(1), corner: m.corner, edge: m.edge, diffCorners, issues });
      for (const i of issues) fails.push(`${tag}: ${i}`);
      await ctx.close();
    }
  }
  // Duracion real (sin alargar temporizadores): presente a la mitad, ausente al terminar.
  for (const reduced of [false, true]) {
    const { ctx, page } = await newPage(browser, port, { width: 390, height: 844, reduced, onboardDone: false });
    await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#it-splash-title", { timeout: 8000 });
    const t0 = Date.now();
    await page.waitForTimeout(reduced ? 150 : 500);
    const mid = await page.evaluate(() => !!document.getElementById("it-splash-title"));
    await page.waitForFunction(() => !document.getElementById("it-splash-title"), null, { timeout: 4000 });
    const ms = Date.now() - t0;
    const lo = reduced ? 300 : 1000, hi = reduced ? 1100 : 2200;
    if (!mid) fails.push(`tiempo real${reduced ? " (reducido)" : ""}: el splash ya no estaba a mitad de la duracion`);
    if (ms < lo || ms > hi) fails.push(`tiempo real${reduced ? " (reducido)" : ""}: el splash duro ~${ms} ms (esperado ${lo}-${hi})`);
    const cta = await page.evaluate(() => /EMPEZAR GRATIS|GET STARTED FREE/i.test(document.body.innerText));
    if (!cta) fails.push("tiempo real: no aparecio el onboarding");
    report.push({ tag: "tiempo-real" + (reduced ? "-reducido" : ""), msDesdeMontaje: ms, onboarding: cta });
    await ctx.close();
  }
  // Sin onboarding pendiente (it_onboard_done): el splash tambien desaparece y no queda overlay.
  {
    const { ctx, page } = await newPage(browser, port, { width: 390, height: 844, reduced: false, onboardDone: true });
    await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[role=dialog] img", { timeout: 8000 });
    await page.screenshot({ path: path.join(o.out, `${o.tag}_390x844_sinonboarding.png`) });
    await page.waitForTimeout(2000);
    const a = await page.evaluate(() => ({ dialog: !!document.getElementById("it-splash-title"), text: document.body.innerText.length, fixedOverlay: [...document.querySelectorAll("div")].some((e) => getComputedStyle(e).zIndex === "2147483000") }));
    if (a.dialog || a.fixedOverlay) fails.push("sin onboarding: queda overlay del splash");
    if (!a.text) fails.push("sin onboarding: pantalla vacia tras el splash");
    report.push({ tag: "sin-onboarding", ...a });
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(o.out, o.tag + "_report.json"), JSON.stringify(report, null, 1));
  for (const r of report) console.log(r.tag + ": " + (r.issues ? `img=${r.size} centroX=${r.centerX} top=${r.top} alfaEsq=${r.corner} alfaBorde=${r.edge} ${r.issues.length ? "FALLA" : "ok"}` : JSON.stringify(r)));
  if (fails.length) { console.log("\nFALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
  console.log("PASS splash. Salida:", o.out);
}

main().catch((e) => { console.error(e.message); process.exit(2); });
