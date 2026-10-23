// Utilidades del QA visual: servidor estatico, red simulada, navegacion y auditoria en el navegador.
// Playwright NO es dependencia del proyecto: se resuelve desde el entorno (ver resolvePlaywright).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MOCK_HOST, respond, sessionSeed } from "./fixtures.mjs";

const require = createRequire(import.meta.url);

export function resolvePlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node-tools/node_modules/playwright"].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch { /* siguiente */ }
  }
  throw new Error("No se encontro Playwright. Instalalo fuera del proyecto o define PLAYWRIGHT_MODULE=<ruta al modulo>.");
}

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !fs.existsSync(root)) return undefined;
  const dir = fs.readdirSync(root).filter((d) => d.startsWith("chromium-")).sort().pop();
  const exe = dir && path.join(root, dir, "chrome-linux", "chrome");
  return exe && fs.existsSync(exe) ? exe : undefined;
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon" };

export function serve(dist, port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let f = path.join(dist, decodeURIComponent(req.url.split("?")[0]));
      if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dist, "index.html");
      res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" });
      fs.createReadStream(f).pipe(res);
    }).listen(port, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

// Toda peticion que no sea el servidor local ni el host simulado se aborta (y se registra en `external`).
async function installNetwork(ctx, port, state) {
  await ctx.route("**/*", async (route) => {
    const rq = route.request();
    const u = new URL(rq.url());
    if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
    if (u.hostname === MOCK_HOST) {
      const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,HEAD,OPTIONS", "access-control-expose-headers": "content-range" };
      if (rq.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (u.pathname.startsWith("/auth/")) return route.fulfill({ status: 401, headers: { ...cors, "content-type": "application/json" }, body: '{"message":"no auth"}' });
      const table = u.pathname.replace("/rest/v1/", "");
      const r = respond({ method: rq.method(), table, search: u.searchParams });
      return route.fulfill({ status: r.status, headers: { ...cors, "content-type": "application/json", ...(r.headers || {}) }, body: typeof r.body === "string" ? r.body : JSON.stringify(r.body) });
    }
    state.external.add(rq.method() + " " + u.hostname);
    return route.abort();
  });
}

export async function openPage(browser, { port, width, height, role = "entrenador", touch }) {
  const ctx = await browser.newContext({ viewport: { width, height }, isMobile: touch, hasTouch: touch, deviceScaleFactor: 2, colorScheme: "dark" });
  const state = { external: new Set(), pageErrors: [] };
  await installNetwork(ctx, port, state);
  const seed = sessionSeed(role);
  await ctx.addInitScript(([ls]) => {
    try {
      if (!sessionStorage.getItem("__qa")) {
        Object.entries(ls).forEach(([k, v]) => localStorage.setItem(k, v));
        sessionStorage.setItem("__qa", "1");
        sessionStorage.setItem("it_splash_shown_v1", "1");
      }
    } catch { /* storage bloqueado */ }
  }, [seed]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => state.pageErrors.push(String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:" + port + "/", { waitUntil: "load" });
  await page.waitForTimeout(2000);
  return { ctx, page, state };
}

// Navega a una seccion del coach: sidebar (>=1024) o drawer movil (<1024 con barra superior; en 768 no hay menu y se omite).
export async function gotoSection(page, name, width) {
  const ok = await page.evaluate(async ({ name, width }) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const match = (e) => (e.innerText || "").trim().toLowerCase().startsWith(name.toLowerCase());
    if (width >= 1024) {
      const it = [...document.querySelectorAll("nav button, nav a")].find(match);
      if (!it) return false;
      it.click();
      return true;
    }
    const open = [...document.querySelectorAll('button[aria-label="Abrir menú"]')].find((b) => b.getBoundingClientRect().width > 0);
    if (!open) return false;
    open.click();
    await wait(500);
    const d = document.querySelector("[role=dialog]");
    const it = d && [...d.querySelectorAll("button")].filter(match).pop();
    if (!it) return false;
    it.click();
    return true;
  }, { name, width });
  if (ok) await page.waitForTimeout(1100);
  return ok;
}

// Se ejecuta dentro de la pagina. Devuelve metricas por vista.
export const AUDIT = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[inert],[aria-hidden=true]'); };
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.value || '').replace(/\\s+/g, ' ').trim().slice(0, 30);
  const els = [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea,[role=tab],[role=button]')].filter(vis);
  const all = els.map((e) => { const r = e.getBoundingClientRect(); return { k: e.tagName.toLowerCase() + '|' + lab(e), x: +r.left.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; });
  const small = all.filter((x) => x.w < 43.5 || x.h < 43.5);
  const overlaps = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (w > 2 && h > 2) overlaps.push(all[i].k + ' ~ ' + all[j].k + ' [' + Math.round(w) + 'x' + Math.round(h) + ']');
  }
  const clipped = all.filter((x) => x.x < -1 || x.x + x.w > innerWidth + 1).map((x) => x.k);
  const smallInputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea')].filter(vis).filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16).map(lab);
  return { overflow: document.documentElement.scrollWidth > innerWidth + 1, docW: document.documentElement.scrollWidth, vw: innerWidth, controls: all.length, small, overlaps, clipped, smallInputs };
})()`;
