// QA de «Marcar pagado» con confirmacion (H6) en la demo del Dashboard (demo/dashboard-coach.html, datos ficticios, solo Preview, sin red).
// Uso:  node scripts/qa/pago-alumno.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--out <carpeta de capturas>]
// Interactua con el dialogo REAL, abierto, en tema claro y oscuro a 375/390/430 px. Escenarios (`?pago=`): ok, error, red, vacio.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/dashboard-coach.html";
const o = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-pago-"));
  const env = { ...process.env, IRONTRACK_DEMO: "1", VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_ANON_KEY: "demo-dummy" };
  delete env.VERCEL; delete env.VERCEL_ENV;
  const r = spawnSync("npx", ["vite", "build", "--outDir", o.dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env });
  if (r.status !== 0) throw new Error("El build de la demo fallo");
}
if (o.out) fs.mkdirSync(o.out, { recursive: true });

const { chromium } = await resolvePlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });
const { server, port } = await serve(o.dist);
const fails = [];
let checks = 0;
const check = (c, m) => { checks++; if (!c) fails.push(m); };
const DLG = '[role="alertdialog"]';

const pagos = (page) => page.evaluate(() => { const e = document.querySelector("[data-demo-pagos]"); return { n: Number(e.getAttribute("data-demo-pagos")), txt: e.innerText }; });
const dialogo = (page) => page.evaluate((sel) => {
  const d = document.querySelector(sel); if (!d) return null;
  const btn = (re) => { const b = [...d.querySelectorAll("button")].find((x) => re.test((x.innerText || "").trim())); return b ? { dis: b.disabled, h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width, txt: b.innerText.trim() } : null; };
  const t = d.getAttribute("aria-labelledby"), ds = d.getAttribute("aria-describedby");
  return {
    texto: d.innerText, role: d.getAttribute("role"), modal: d.getAttribute("aria-modal"),
    titulo: t && document.getElementById(t) ? document.getElementById(t).innerText : null,
    desc: ds && document.getElementById(ds) ? document.getElementById(ds).innerText : null,
    alerta: (d.querySelector('[role="alert"]') || {}).innerText || null,
    cancelar: btn(/^Cancelar$/), confirmar: btn(/^(Confirmar pago|Reintentar pago|Registrando…)$/),
    foco: document.activeElement ? (document.activeElement.innerText || "").trim() : "",
    scrollH: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    dentro: (() => { const r = d.getBoundingClientRect(); return r.left >= -0.5 && r.right <= window.innerWidth + 0.5; })(),
  };
}, DLG);

// Mide TODO el texto del dialogo contra su fondo efectivo (compone fondos con alfa y la opacidad acumulada; omite controles deshabilitados).
const medir = (page) => page.evaluate((sel) => {
  const dlg = document.querySelector(sel);
  const parse = (s) => { const m = (s || "").match(/[\d.]+/g) || []; return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const k = [c.r, c.g, c.b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondo = (el) => { const ch = []; for (let n = el; n; n = n.parentElement) ch.unshift(n); let bg = { r: 255, g: 255, b: 255, a: 1 }; for (const n of ch) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) bg = over(c, bg); } return bg; };
  const opac = (el) => { let v = 1; for (let n = el; n && n !== document.body; n = n.parentElement) v *= parseFloat(getComputedStyle(n).opacity); return v; };
  const out = [];
  for (const el of dlg.querySelectorAll("*")) {
    const propio = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (!propio) continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el); const bg = fondo(el);
    let fg = parse(cs.color); fg = over({ ...fg, a: fg.a * opac(el) }, bg);
    const control = el.closest("button"); const dis = !!(control && control.disabled);
    out.push({ txt: propio.slice(0, 40), ratio: ratio(fg, bg), dis });
  }
  return out;
}, DLG);

async function abrirPagina(ctx, query) {
  const page = await ctx.newPage();
  page.__errors = [];
  page.on("pageerror", (e) => page.__errors.push(String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:" + port + "/" + DEMO + query, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  await page.click('[data-demo-tab="alumnos"]');
  await page.waitForTimeout(600);
  return page;
}
const abrirMenuPago = async (page, nombre) => {
  await page.evaluate((n) => { const c = [...document.querySelectorAll("[data-alumno-id]")].find((x) => x.innerText.includes(n)); c.querySelector('button[aria-label="Más opciones"]').click(); }, nombre);
  await page.waitForTimeout(250);
  return page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Marcar pagado/.test(x.innerText)); if (!b) return false; b.click(); return true; });
};
const clic = (page, re) => page.evaluate(([sel, src]) => { const d = document.querySelector(sel); const rx = new RegExp(src); const b = d && [...d.querySelectorAll("button")].find((x) => rx.test((x.innerText || "").trim())); if (b) b.click(); return !!b; }, [DLG, re.source]);

const MATRIZ = [];
for (const width of [375, 390, 430]) for (const tema of ["claro", "oscuro"]) MATRIZ.push({ width, tema });

for (const cfg of MATRIZ) {
  const base = "@" + cfg.width + "/" + cfg.tema;
  const q = (pago) => "?" + (cfg.tema === "claro" ? "tema=claro&" : "") + "pago=" + pago;
  const slug = cfg.width + "_" + cfg.tema;
  const ctx = await browser.newContext({ viewport: { width: cfg.width, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: cfg.tema === "claro" ? "dark" : "light" });
  await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue(); return route.abort(); });

  // ── escenario ok: abrir sin escribir, cancelar, Escape, doble toque, exito ──
  {
    const tag = base + " [ok]";
    const page = await abrirPagina(ctx, q("ok"));
    check(await abrirMenuPago(page, "Eli Regular"), tag + " abre el menu y toca «Marcar pagado»");
    await page.waitForTimeout(500);
    let d = await dialogo(page);
    check(!!d, tag + " se abre el dialogo de confirmacion");
    if (d) {
      check((await pagos(page)).n === 0, tag + " abrir la confirmacion NO registra ningun pago");
      check(d.role === "alertdialog" && d.modal === "true" && /Confirmar pago/.test(d.titulo || ""), tag + " alertdialog con titulo «Confirmar pago» (" + d.titulo + ")");
      check(/Eli Regular/.test(d.desc || "") && /actualizar/.test(d.desc || ""), tag + " descripcion con el nombre y la accion (" + (d.desc || "").replace(/\n/g, " ") + ")");
      check(d.cancelar && d.confirmar && d.confirmar.txt === "Confirmar pago", tag + " botones «Cancelar» y «Confirmar pago»");
      check(d.cancelar.h >= 43.5 && d.confirmar.h >= 43.5 && d.cancelar.w >= 43.5 && d.confirmar.w >= 43.5, tag + " botones >= 44 px (" + d.cancelar.h + "/" + d.confirmar.h + ")");
      check(d.foco === "Cancelar", tag + " foco inicial en «Cancelar» (" + d.foco + ")");
      check(!d.scrollH && d.dentro, tag + " sin desbordamiento horizontal");
      const m = await medir(page);
      const malos = m.filter((t) => !t.dis && t.ratio < 4.5);
      check(m.length >= 4 && malos.length === 0, tag + " todo el texto del dialogo >= 4,5:1; fallan: " + malos.map((t) => "«" + t.txt + "» " + t.ratio.toFixed(2)).join(", "));
      if (o.out) await page.screenshot({ path: path.join(o.out, "pago_confirmacion_" + slug + ".png") });
    }
    // cancelar
    await clic(page, /^Cancelar$/);
    await page.waitForTimeout(500);
    check(!(await dialogo(page)) && (await pagos(page)).n === 0, tag + " cancelar cierra el dialogo y no escribe");
    // Escape
    await abrirMenuPago(page, "Eli Regular"); await page.waitForTimeout(400);
    await page.keyboard.press("Escape"); await page.waitForTimeout(500);
    check(!(await dialogo(page)) && (await pagos(page)).n === 0, tag + " Escape cierra sin escribir");
    // doble toque rapido sobre «Confirmar pago»
    await abrirMenuPago(page, "Eli Regular"); await page.waitForTimeout(400);
    await page.evaluate((sel) => { const d = document.querySelector(sel); const b = d && [...d.querySelectorAll("button")].find((x) => /Confirmar pago/.test(x.innerText)); if (b) { b.click(); b.click(); b.click(); } }, DLG);
    await page.waitForTimeout(150);
    d = await dialogo(page);
    check(!!d && d.confirmar && /Registrando/.test(d.confirmar.txt) && d.confirmar.dis && d.cancelar.dis, tag + " mientras guarda: «Registrando…» y controles deshabilitados");
    if (o.out && d) await page.screenshot({ path: path.join(o.out, "pago_procesando_" + slug + ".png") });
    await page.keyboard.press("Escape"); await page.waitForTimeout(100);
    check(!!(await dialogo(page)), tag + " Escape no cierra mientras guarda");
    await page.waitForTimeout(1100);
    const p = await pagos(page);
    check(p.n === 1 && /Eli Regular/.test(p.txt), tag + " tres toques rapidos = exactamente un pago de Eli (" + p.txt + ")");
    check(!(await dialogo(page)), tag + " exito: el dialogo se cierra");
    const txt = await page.evaluate(() => document.body.innerText);
    check(/Pago registrado ✓ · Eli Regular/.test(txt), tag + " aviso de exito con el nombre del alumno");
    check(page.__errors.length === 0, tag + " sin errores de pagina: " + page.__errors.join("|"));
    await page.close();
  }

  // ── escenarios con falla en el primer intento: error visible, sin exito falso, reintento ──
  for (const esc of ["error", "red", "vacio"]) {
    const tag = base + " [" + esc + "]";
    const page = await abrirPagina(ctx, q(esc));
    await abrirMenuPago(page, "Beto Baja"); await page.waitForTimeout(400);
    await clic(page, /^Confirmar pago$/);
    await page.waitForTimeout(1100);
    let d = await dialogo(page);
    const txt = await page.evaluate(() => document.body.innerText);
    check(!!d && !!d.alerta && /No se pudo registrar el pago/.test(d.alerta), tag + " el error se muestra dentro del dialogo (" + (d && d.alerta) + ")");
    if (esc === "red") check(/conexión/.test((d && d.alerta) || ""), tag + " el mensaje de red habla de la conexion");
    check(!/Pago registrado/.test(txt) && (await pagos(page)).n === 0, tag + " NO hay exito falso ni pago registrado");
    check(!!d && d.confirmar && d.confirmar.txt === "Reintentar pago" && !d.confirmar.dis && !d.cancelar.dis, tag + " permite reintentar");
    if (d) {
      const m = await medir(page); const malos = m.filter((t) => !t.dis && t.ratio < 4.5);
      check(malos.length === 0, tag + " texto (incluido el error) >= 4,5:1; fallan: " + malos.map((t) => "«" + t.txt + "» " + t.ratio.toFixed(2)).join(", "));
      check(!d.scrollH && d.dentro, tag + " sin desbordamiento horizontal con el error");
    }
    if (o.out && esc === "error") await page.screenshot({ path: path.join(o.out, "pago_error_" + slug + ".png") });
    await clic(page, /^Reintentar pago$/);
    await page.waitForTimeout(1100);
    const p = await pagos(page);
    check(p.n === 1 && /Beto Baja/.test(p.txt) && !(await dialogo(page)), tag + " el reintento registra exactamente un pago y cierra");
    check(/Pago registrado ✓ · Beto Baja/.test(await page.evaluate(() => document.body.innerText)), tag + " exito tras el reintento");
    check(page.__errors.length === 0, tag + " sin errores de pagina: " + page.__errors.join("|"));
    await page.close();
  }

  // ── identidad: cambiar de ficha mientras guarda no cambia el destinatario ──
  {
    const tag = base + " [identidad]";
    const page = await abrirPagina(ctx, q("ok"));
    await abrirMenuPago(page, "Eli Regular"); await page.waitForTimeout(400);
    await clic(page, /^Confirmar pago$/);
    await page.waitForTimeout(150);
    // con el pago pendiente, se abre la ficha de OTRO alumno (clic directo en el DOM, como si el entrenador cambiara de ficha)
    await page.evaluate(() => { const c = [...document.querySelectorAll("[data-alumno-id]")].find((x) => x.innerText.includes("Beto Baja")); c.querySelector("[data-qa-alumno-toggle]").click(); });
    await page.waitForTimeout(100);
    const d = await dialogo(page);
    check(!!d && /Eli Regular/.test(d.desc || "") && !/Beto/.test(d.desc || ""), tag + " el dialogo sigue siendo de Eli (" + (d && (d.desc || "").replace(/\n/g, " ")) + ")");
    await page.waitForTimeout(1100);
    const p = await pagos(page);
    check(p.n === 1 && /Eli Regular/.test(p.txt) && !/Beto/.test(p.txt), tag + " el pago se atribuye a Eli, no a la ficha abierta (" + p.txt + ")");
    const txt = await page.evaluate(() => document.body.innerText);
    check(/Pago registrado ✓ · Eli Regular/.test(txt) && !/Pago registrado ✓ · Beto/.test(txt), tag + " el aviso nombra a Eli");
    await page.close();
  }

  // ── otras acciones del menu: sin regresiones ──
  if (cfg.width === 390) {
    const tag = base + " [otras acciones]";
    const page = await abrirPagina(ctx, q("ok"));
    const abrirItem = async (re) => {
      await page.evaluate((n) => { const c = [...document.querySelectorAll("[data-alumno-id]")].find((x) => x.innerText.includes(n)); c.querySelector('button[aria-label="Más opciones"]').click(); }, "Eli Regular");
      await page.waitForTimeout(250);
      return page.evaluate((src) => { const b = [...document.querySelectorAll("button")].find((x) => new RegExp(src).test((x.innerText || "").trim())); if (b) b.click(); return !!b; }, re.source);
    };
    check(await abrirItem(/Eliminar/), tag + " «Eliminar» existe");
    await page.waitForTimeout(500);
    const del = await page.evaluate(() => { const d = document.querySelector('[role="alertdialog"]'); return d ? d.innerText : null; });
    check(!!del && /Eliminar alumno/.test(del) && !/Confirmar pago/.test(del), tag + " «Eliminar» abre su propia confirmacion");
    await clic(page, /^Cancelar$/); await page.waitForTimeout(500);
    check(await abrirItem(/Limpiar historial/), tag + " «Limpiar historial» existe");
    await page.waitForTimeout(500);
    const lim = await page.evaluate(() => { const d = document.querySelector('[role="alertdialog"]'); return d ? d.innerText : null; });
    check(!!lim && /Limpiar historial de progreso/.test(lim) && !/Confirmar pago/.test(lim), tag + " «Limpiar historial» abre su propia confirmacion");
    await clic(page, /^Cancelar$/); await page.waitForTimeout(500);
    check((await pagos(page)).n === 0, tag + " ninguna otra accion registra pagos");
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("PAGO-ALUMNO OK");
