// QA en navegador de la vista previa de video del selector «Agregar ejercicios» (demo/ficha-alumno.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/add-exercise-video.mjs --out <carpeta> [--dist <dir>]
// Escritorio (1280x800) y movil tactil (390x844 y 320x700). El unico host externo permitido es youtube.com/embed (se responde con una pagina
// de prueba, sin red real); todo lo demas se aborta. Verifica: boton >=44 px a la derecha del nombre y separado del control de seleccion; pulsarlo
// abre el modal con el nombre y el iframe sin cambiar seleccion, busqueda, filtros ni scroll; Enter/Espacio sobre el boton no seleccionan;
// cerrar con X y con Escape deja el selector intacto; abrir varios videos seguidos; sin overflow horizontal; sin errores de pagina.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEMO = "demo/ficha-alumno.html";
const o = { out: null, dist: null };
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--out") o.out = path.resolve(process.argv[++i]);
  else if (process.argv[i] === "--dist") o.dist = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + process.argv[i]);
}
if (!o.out) throw new Error("Falta --out <carpeta>");
fs.mkdirSync(o.out, { recursive: true });

if (!o.dist) {
  o.dist = path.join(os.tmpdir(), "irontrack-addexvideo-" + Date.now());
  const env = { ...process.env, VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: "https://sin-backend.invalid", VITE_SUPABASE_ANON_KEY: "mock-anon-key-preview-qa" };
  const r = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--outDir", o.dist, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error("build fallo:\n" + (r.stdout + r.stderr).slice(-2000));
}
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const f = path.join(o.dist, decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(o.dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("no existe"); return; }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const pw = resolvePlaywright();
const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
const failures = [];
const summary = [];

const STATE = `(() => {
  const list = document.querySelector('[aria-labelledby="add-ex-modal-title"]');
  if (!list) return { open: false };
  const rows = [...list.querySelectorAll('.add-ex-card')];
  const sc = rows[0] && rows[0].parentElement;
  return {
    open: true,
    selected: rows.filter((r) => /inset/.test(r.style.boxShadow)).map((r) => r.children[1].firstElementChild.innerText.trim()),
    search: list.querySelector('input').value,
    scroll: sc ? Math.round(sc.scrollTop) : -1,
    rows: rows.length,
    previews: list.querySelectorAll('[data-add-ex-preview]').length,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  };
})()`;
const VIDEO = `(() => {
  const d = [...document.querySelectorAll('[role=dialog]')].find((x) => x.getAttribute('aria-labelledby') !== 'add-ex-modal-title');
  if (!d) return { open: false };
  const f = d.querySelector('iframe'), r = d.firstElementChild.getBoundingClientRect(), c = d.querySelector('[aria-label=Cerrar]').getBoundingClientRect();
  const fr = f ? f.getBoundingClientRect() : null;
  return { open: true, label: d.getAttribute('aria-label'), src: f ? f.src : null, iw: fr ? Math.round(fr.width) : 0, ih: fr ? Math.round(fr.height) : 0,
    inside: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.top >= -0.5 && r.bottom <= innerHeight + 0.5, close: [Math.round(c.width), Math.round(c.height)],
    overflow: document.documentElement.scrollWidth > innerWidth + 1, active: document.activeElement && document.activeElement.getAttribute('aria-label') };
})()`;

const runs = [
  { id: "desktop-1280", viewport: { width: 1280, height: 800 }, mobile: false },
  { id: "movil-390", viewport: { width: 390, height: 844 }, mobile: true },
  { id: "movil-320", viewport: { width: 320, height: 700 }, mobile: true },
  { id: "movil-horizontal-844", viewport: { width: 844, height: 390 }, mobile: true },
];
for (const run of runs) {
  const ctx = await browser.newContext({ viewport: run.viewport, isMobile: run.mobile, hasTouch: run.mobile, deviceScaleFactor: 2, colorScheme: "dark" });
  const external = [];
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
    if (/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) return route.abort();
    external.push(u.hostname + u.pathname.slice(0, 20));
    if (u.hostname === "www.youtube.com" && u.pathname.startsWith("/embed/")) return route.fulfill({ status: 200, contentType: "text/html", body: "<body style='margin:0;background:#123;color:#fff;font:16px sans-serif;display:grid;place-items:center;height:100vh'>Reproductor de prueba</body>" });
    return route.abort();
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const wait = (ms) => page.waitForTimeout(ms);
  const shot = (n) => page.screenshot({ path: path.join(o.out, run.id + "_" + n + ".png") });
  const fail = (m) => failures.push(run.id + ": " + m);
  const state = () => page.evaluate(STATE);
  const video = () => page.evaluate(VIDEO);
  const rec = { id: run.id };

  await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
  await wait(1000);
  await page.evaluate(() => document.querySelector("[data-qa-alumno-toggle]").click()); await wait(800);
  const opened = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Añadir ejercicio/.test(e.innerText || "") && e.getBoundingClientRect().width > 0); if (!b) return false; b.scrollIntoView({ block: "center" }); b.click(); return true; });
  await wait(600);
  let s0 = await state();
  if (!opened || !s0.open) { fail("no se pudo abrir el selector"); await ctx.close(); continue; }

  // Busqueda + dos ejercicios seleccionados + scroll.
  const search = page.locator('[aria-labelledby="add-ex-modal-title"] input');
  await search.fill("sentadilla"); await wait(300);
  let s1 = await state();
  const rows = page.locator(".add-ex-card");
  await rows.nth(0).click(); await rows.nth(1).click(); await wait(200);
  await search.fill(""); await wait(200);
  await rows.nth(0).click(); await wait(100); await rows.nth(0).click(); // ida y vuelta: queda la misma seleccion
  await page.evaluate(() => { const sc = document.querySelector(".add-ex-card").parentElement; sc.scrollTop = 900; }); await wait(300);
  await search.fill("sentadilla"); await wait(300);
  await page.evaluate(() => { const sc = document.querySelector(".add-ex-card").parentElement; sc.scrollTop = 80; }); await wait(200);
  const before = await state();
  rec.before = before;
  await shot("01_selector_con_botones");

  // Geometria: boton >=44, a la derecha del nombre, separado del control de seleccion.
  const geo = await page.evaluate(() => {
    const row = document.querySelector(".add-ex-card"), b = row.querySelector("[data-add-ex-preview] button"), name = row.children[1], r = b.getBoundingClientRect(), n = name.getBoundingClientRect(), rr = row.getBoundingClientRect();
    const check = [...row.children].pop().getBoundingClientRect();
    return { w: r.width, h: r.height, rightOfName: r.left >= n.right - 0.5, apartCheck: check.left - r.right, inRow: r.right <= rr.right + 0.5 && r.left >= rr.left - 0.5 };
  });
  rec.geo = geo;
  if (geo.w < 43.5 || geo.h < 43.5) fail("boton ▶ menor a 44 px: " + geo.w + "x" + geo.h);
  if (!geo.rightOfName) fail("▶ no esta a la derecha del nombre");
  if (geo.apartCheck < 4) fail("▶ demasiado pegado al control de seleccion");
  if (!geo.inRow) fail("▶ se sale de la fila");
  if (before.overflow) fail("overflow horizontal con el selector abierto");

  const play = (i) => page.locator(".add-ex-card [data-add-ex-preview] button").nth(i);
  const same = (a, b, tag) => {
    if (JSON.stringify(a.selected) !== JSON.stringify(b.selected)) fail(tag + ": cambio la seleccion " + JSON.stringify(a.selected) + " -> " + JSON.stringify(b.selected));
    if (a.search !== b.search) fail(tag + ": cambio la busqueda");
    if (Math.abs(a.scroll - b.scroll) > 1) fail(tag + ": cambio el scroll " + a.scroll + " -> " + b.scroll);
    if (a.rows !== b.rows) fail(tag + ": cambio la lista");
  };

  // Abrir con click/tap sobre un ejercicio NO seleccionado y sobre uno seleccionado.
  const names = await page.evaluate(() => [...document.querySelectorAll(".add-ex-card")].map((r) => r.children[1].firstElementChild.innerText.trim()));
  let base2 = before;
  for (const idx of [1, 3]) {
    await play(idx).scrollIntoViewIfNeeded(); await wait(150);
    base2 = await state();
    if (run.mobile) await play(idx).tap(); else await play(idx).click();
    await wait(500);
    const v = await video(), s = await state();
    rec["abrir" + idx] = v;
    if (!v.open) fail("no abrio el video #" + idx);
    else {
      if (v.label !== names[idx]) fail("el modal no muestra el nombre: " + v.label + " vs " + names[idx]);
      if (!/^https:\/\/www\.youtube\.com\/embed\/[\w-]+\?.*autoplay=1/.test(v.src || "")) fail("iframe inesperado: " + v.src);
      if (!v.inside) fail("el modal se sale de la pantalla");
      if (v.overflow) fail("overflow horizontal con el video abierto");
      if (v.close[0] < 43.5 || v.close[1] < 43.5) fail("cierre <44 px: " + v.close);
      if (v.active !== "Cerrar") fail("el foco no esta en Cerrar");
    }
    if (!s.open) fail("el selector desaparecio al abrir el video");
    same(base2, s, "abrir #" + idx);
    if (idx === 1) await shot("02_video_abierto");
    await page.locator("[aria-label=Cerrar]").last().click(); await wait(300);
    if ((await video()).open) fail("no cerro con la X");
    same(base2, await state(), "cerrar #" + idx);
  }

  // Teclado: Enter y Espacio sobre ▶ abren el video y NO seleccionan; Escape cierra solo el video.
  for (const key of ["Enter", " "]) {
    await play(2).focus(); await wait(150); base2 = await state(); await page.keyboard.press(key); await wait(500);
    if (!(await video()).open) fail("teclado '" + key + "' no abrio el video");
    same(base2, await state(), "teclado '" + key + "'");
    await page.keyboard.press("Escape"); await wait(300);
    if ((await video()).open) fail("Escape no cerro el video");
    const s = await state();
    if (!s.open) fail("Escape cerro tambien el selector");
    same(base2, s, "Escape");
  }

  // Varios videos seguidos.
  await play(0).scrollIntoViewIfNeeded(); await wait(150); base2 = await state();
  for (let i = 0; i < 4; i++) { await play(0).click(); await wait(200); await page.keyboard.press("Escape"); await wait(150); }
  same(base2, await state(), "abrir y cerrar varios");

  // Ejercicio con video no disponible (el embed falla): el modal sigue cerrable y ofrece el enlace de respaldo.
  await play(0).click(); await wait(400);
  const backup = await page.evaluate(() => { const a = [...document.querySelectorAll("a")].find((x) => /Abrir en YouTube/.test(x.innerText)); return a ? { href: a.href, h: Math.round(a.getBoundingClientRect().height) } : null; });
  rec.backup = backup;
  if (!backup || !/^https:\/\/www\.youtube\.com\/watch\?v=/.test(backup.href)) fail("falta el enlace de respaldo");
  await shot("03_video_con_respaldo");
  await page.keyboard.press("Escape"); await wait(300);

  // El control de seleccion sigue funcionando y no se rompio el agregado.
  await rows.nth(2).scrollIntoViewIfNeeded(); await wait(150); const base3 = await state();
  await rows.nth(2).click(); await wait(150);
  const afterSel = await state();
  if (afterSel.selected.length !== base3.selected.length + 1) fail("la seleccion por fila dejo de funcionar");
  await rows.nth(2).click(); await wait(150);
  same(base3, await state(), "toggle final");
  await shot("04_selector_final");

  if (errors.length) fail("errores de pagina: " + errors[0]);
  const bad = external.filter((x) => !/^www\.youtube\.com\/embed/.test(x));
  if (bad.length) fail("pedidos externos inesperados: " + [...new Set(bad)].join(", "));
  rec.external = [...new Set(external)];
  summary.push(rec);
  await ctx.close();
}
server.close(); await browser.close();
fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ summary, failures }, null, 1));
for (const r of summary) console.log(r.id, "boton", Math.round(r.geo.w) + "x" + Math.round(r.geo.h), "| externos:", r.external.join(",") || "ninguno");
console.log(failures.length ? "FALLAS:\n- " + failures.join("\n- ") : "add-exercise-video OK (" + summary.length + " viewports)");
process.exit(failures.length ? 1 : 0);
