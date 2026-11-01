// QA de la campana del entrenador (D6.2) en la demo del Dashboard (demo/dashboard-coach.html?alertas=muchas, datos ficticios, solo Preview).
// Uso:  node scripts/qa/campana-alertas.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 375,390,430,1280] [--out <carpeta>]
// Verifica en Chromium, en modo oscuro y claro, sin sesion de IronTrack y con TODA la red externa bloqueada:
//   - mas de 12 alertas: el panel muestra 12 y «Ver N más» (>= 44 px) muestra el resto; «Ver menos» vuelve a 12;
//   - orden: las que piden accion (mensaje / seguimiento / adherencia) antes que los logros; textos de baja actividad (regla de D3);
//   - el numero de la campana coincide con las no leidas del conjunto completo; «Marcar leídas» lo deja en 0 y marca tambien las ocultas;
//   - el panel entra en la pantalla (sin overflow horizontal) a 375/390/430; sin errores de pagina ni red.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/dashboard-coach.html";
const SIZES = { 375: 667, 390: 844, 430: 932, 1280: 800 };
const o = { widths: [375, 390, 430, 1280] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-campana-"));
  const env = { ...process.env, IRONTRACK_DEMO: "1", VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_ANON_KEY: "demo-dummy" };
  delete env.VERCEL; delete env.VERCEL_ENV;
  const r = spawnSync("npx", ["vite", "build", "--outDir", o.dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env });
  if (r.status !== 0) throw new Error("El build de la demo fallo");
}
if (!fs.existsSync(path.join(o.dist, DEMO))) throw new Error("El build no contiene " + DEMO);
if (o.out) fs.mkdirSync(o.out, { recursive: true });

const { chromium } = await resolvePlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });
const { server, port } = await serve(o.dist);
const fails = [];
let checks = 0;
const check = (c, m) => { checks++; if (!c) fails.push(m); };

const estado = (page) => page.evaluate(() => {
  const panel = document.querySelector('[role="dialog"][aria-label="Centro de notificaciones"]');
  const bell = document.querySelector("button.coach-bell");
  const badge = bell ? [...bell.querySelectorAll("span")].map((s) => (s.innerText || "").trim()).find((t) => /^\d+\+?$/.test(t)) || "" : null;
  if (!panel) return { panel: null, badge };
  const r = panel.getBoundingClientRect();
  const items = [...panel.querySelectorAll("[data-notif-cat]")].map((b) => ({ cat: b.getAttribute("data-notif-cat"), leida: b.getAttribute("data-notif-leida"), txt: (b.innerText || "").replace(/\s+/g, " ") }));
  const mas = panel.querySelector('[data-testid="coach-notif-ver-mas"]');
  const mr = mas ? mas.getBoundingClientRect() : null;
  return {
    panel: { left: r.left, right: r.right, top: r.top, bottom: r.bottom }, badge, items,
    mas: mas ? { txt: (mas.innerText || "").trim(), h: mr.height, w: mr.width } : null,
    vw: innerWidth, sw: document.documentElement.scrollWidth,
  };
});

// Lleva el scroll de la lista al final y mide que la ultima notificacion y el boton queden dentro del alto visible.
const alFinal = (page) => page.evaluate(async () => {
  const panel = document.querySelector('[role="dialog"][aria-label="Centro de notificaciones"]');
  const items = panel ? [...panel.querySelectorAll("[data-notif-cat]")] : [];
  const ultimo = items[items.length - 1];
  const sc = ultimo && ultimo.parentElement;
  if (!sc) return { ok: false };
  sc.scrollTop = sc.scrollHeight;
  await new Promise((r) => setTimeout(r, 150));
  const btn = panel.querySelector('[data-testid="coach-notif-ver-mas"]');
  const u = ultimo.getBoundingClientRect(), b = btn ? btn.getBoundingClientRect() : u, p = panel.getBoundingClientRect();
  return { ok: u.bottom <= innerHeight + 0.5 && b.bottom <= innerHeight + 0.5 && p.bottom <= innerHeight + 0.5, ultimo: Math.round(u.bottom), boton: Math.round(b.bottom), panel: Math.round(p.bottom), alto: innerHeight };
});

// D6.3: alto visible chico (como iOS Safari con la barra visible, donde 70vh superaba lo visible): el final sigue alcanzable.
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 360 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); return u.hostname === "127.0.0.1" && String(u.port) === String(port) ? route.continue() : route.abort(); });
  const page = await ctx.newPage();
  await page.goto("http://127.0.0.1:" + port + "/" + DEMO + "?alertas=muchas", { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.click("button.coach-bell");
  await page.waitForTimeout(400);
  await page.click('[data-testid="coach-notif-ver-mas"]');
  await page.waitForTimeout(300);
  const fin = await alFinal(page);
  check(fin.ok, "@375x360 alto visible chico: la ultima notificacion y «Ver menos» se alcanzan (" + JSON.stringify(fin) + ")");
  if (o.out) await page.screenshot({ path: path.join(o.out, "campana-alto-chico_375x360.png") });
  await ctx.close();
}

for (const tema of ["oscuro", "claro"]) {
  for (const width of o.widths) {
    const mobile = width < 768;
    const tag = "@" + width + "/" + tema;
    const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 2 });
    const external = new Set(), errors = [];
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
      external.add(u.hostname);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO + "?alertas=muchas" + (tema === "claro" ? "&tema=claro" : ""), { waitUntil: "load" });
    await page.waitForTimeout(1500);

    let st = await estado(page);
    check(/^(\d+|9\+)$/.test(st.badge || ""), tag + " la campana muestra el numero de no leidas (" + st.badge + ")");
    await page.click("button.coach-bell");
    await page.waitForTimeout(500);
    st = await estado(page);
    check(!!st.panel, tag + " abre el panel");
    if (!st.panel) { await ctx.close(); continue; }
    const total = st.mas ? 12 + Number((st.mas.txt.match(/^Ver (\d+) más$/) || [])[1] || 0) : st.items.length;
    check(st.items.length === 12, tag + " muestra 12 notificaciones (" + st.items.length + ")");
    check(!!st.mas && /^Ver \d+ más$/.test(st.mas.txt) && total > 12, tag + " «Ver N más» con mas de 12 (" + (st.mas && st.mas.txt) + ")");
    if (st.mas && mobile) check(st.mas.h >= 43.5, tag + " «Ver más» >= 44 px (" + (st.mas && st.mas.h) + ")");
    check(st.badge === (total > 9 ? "9+" : String(total)), tag + " numero de la campana = no leidas del conjunto completo (" + st.badge + " / " + total + ")");
    const primerLogro = st.items.findIndex((x) => x.cat === "logro");
    check(primerLogro === -1 || st.items.slice(primerLogro).every((x) => x.cat === "logro"), tag + " seguimiento antes que logros: " + st.items.map((x) => x.cat).join(","));
    const todoTxt = st.items.map((x) => x.txt).join(" | ");
    check(/Completó menos del 30 % de su plan/.test(todoTxt) && !/Poca actividad|Sin sesiones ni registros en la última semana/.test(todoTxt), tag + " texto de baja actividad (regla de D3)");
    if (mobile) {
      check(st.panel.left >= -0.5 && st.panel.right <= st.vw + 0.5, tag + " el panel entra en la pantalla (" + Math.round(st.panel.left) + ".." + Math.round(st.panel.right) + " / " + st.vw + ")");
      check(st.sw <= st.vw + 1, tag + " sin overflow horizontal (" + st.sw + " > " + st.vw + ")");
    }
    if (o.out) await page.screenshot({ path: path.join(o.out, "campana_" + tema + "_" + width + ".png") });

    await page.click('[data-testid="coach-notif-ver-mas"]');
    await page.waitForTimeout(300);
    st = await estado(page);
    check(st.items.length === total, tag + " «Ver más» muestra todas (" + st.items.length + "/" + total + ")");
    check(!!st.mas && st.mas.txt === "Ver menos", tag + " y ofrece «Ver menos»");
    check(new Set(st.items.map((x) => x.txt)).size === st.items.length, tag + " sin duplicados");
    // D6.3 (iPhone, PR #147): «Rutina terminada» de Pia aparece y no queda ultima, debajo de entrenamientos mas viejos
    const iPia = st.items.findIndex((x) => /Pía Terminó terminó su rutina\./.test(x.txt));
    check(iPia >= 0 && iPia < st.items.length - 1, tag + " «Rutina terminada» de Pía visible y no al final (" + iPia + "/" + st.items.length + ")");
    if (mobile) {
      const fin = await alFinal(page);
      check(fin.ok, tag + " el final de la lista se alcanza dentro de la pantalla (" + JSON.stringify(fin) + ")");
    }
    if (o.out) await page.screenshot({ path: path.join(o.out, "campana-todas_" + tema + "_" + width + ".png") });
    await page.click('[data-testid="coach-notif-ver-mas"]');
    await page.waitForTimeout(300);
    st = await estado(page);
    check(st.items.length === 12, tag + " «Ver menos» vuelve a 12");

    const marcar = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"][aria-label="Centro de notificaciones"]');
      const b = panel && [...panel.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "Marcar leídas");
      if (!b) return false; b.click(); return true;
    });
    check(marcar, tag + " boton «Marcar leídas»");
    await page.waitForTimeout(400);
    st = await estado(page);
    check(st.badge === "", tag + " tras «Marcar leídas» la campana queda sin numero (" + st.badge + ")");
    await page.click('[data-testid="coach-notif-ver-mas"]');
    await page.waitForTimeout(300);
    st = await estado(page);
    check(st.items.length === total && st.items.every((x) => x.leida === "si"), tag + " tambien quedan leidas las de «Ver más»");

    check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
    const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
    check(ext.length === 0, tag + " sin red externa: " + ext.join(","));
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("CAMPANA-ALERTAS OK");
