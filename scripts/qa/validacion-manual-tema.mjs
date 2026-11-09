// QA del modal «Validar sesión manualmente» ABIERTO en tema claro y oscuro (PR #162, regresion detectada en Safari/iPhone real).
// Causa raiz: BaseModal decidia su fondo con localStorage/prefers-color-scheme y NO con el tema de la app; si el sistema estaba en
// oscuro y la app en claro, el fondo quedaba oscuro con textos oscuros. Por eso la matriz cruza el tema de la app con el esquema del
// sistema (incluidas las combinaciones que NO coinciden) y mide TODO el texto visible del dialogo, no botones aislados.
// Uso:  node scripts/qa/validacion-manual-tema.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--out <carpeta de capturas>]
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
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-valtema-"));
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
const DLG = '[role="dialog"]';

// Mide cada texto visible del dialogo contra su fondo EFECTIVO (compone fondos con alfa y la opacidad acumulada del elemento).
const medir = (page) => page.evaluate((sel) => {
  const dlg = document.querySelector(sel);
  const parse = (s) => { const m = (s || "").match(/[\d.]+/g) || []; return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const k = [c.r, c.g, c.b].map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondo = (el) => { // de la raiz al elemento, componiendo
    const cadena = []; for (let n = el; n; n = n.parentElement) cadena.unshift(n);
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const n of cadena) { const c = parse(getComputedStyle(n).backgroundColor); if (c.a > 0) bg = over(c, bg); }
    return bg;
  };
  const opac = (el) => { let v = 1; for (let n = el; n && n !== document.body; n = n.parentElement) v *= parseFloat(getComputedStyle(n).opacity); return v; };
  const out = [];
  for (const el of dlg.querySelectorAll("*")) {
    const propio = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (!propio) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const bg = fondo(el);
    let fg = parse(cs.color); fg = { ...fg, a: fg.a * opac(el) }; fg = over(fg, bg);
    const control = el.closest("button, input, select");
    out.push({ txt: propio.slice(0, 40), ratio: ratio(fg, bg), disabled: !!(control && control.disabled), size: parseFloat(cs.fontSize), color: cs.color });
  }
  const modal = parse(getComputedStyle(dlg).backgroundColor);
  const b = dlg.getBoundingClientRect();
  return {
    textos: out, modalLum: lum(modal), modalBg: getComputedStyle(dlg).backgroundColor,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    dentro: b.left >= -0.5 && b.right <= window.innerWidth + 0.5, dlgScroll: dlg.scrollWidth > dlg.clientWidth + 1,
  };
}, DLG);

const setFecha = async (page, v) => { await page.evaluate(([s, val]) => { const i = document.querySelector(s + ' input[type="date"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, val); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); }, [DLG, v]); await page.waitForTimeout(200); };
const click = (page, re, sel) => page.evaluate(([s, src, ar]) => { const rx = new RegExp(src); const b = [...document.querySelectorAll(s + " button")].find((x) => rx.test((x.getAttribute("aria-label") || "") + "|" + (x.innerText || "").trim()) && (!ar || new RegExp(ar, "i").test(x.getAttribute("aria-label") || ""))); if (b) b.click(); return !!b; }, [DLG, re.source, sel || ""]);

// tema de la app x esquema del sistema (las dos filas «cruzadas» son las que fallaban en el iPhone) x viewport
const MATRIZ = [];
for (const width of [375, 390, 430]) for (const [app, sistema] of [["claro", "dark"], ["claro", "light"], ["oscuro", "light"], ["oscuro", "dark"]]) MATRIZ.push({ width, app, sistema });
const EXTRA = [{ width: 390, app: "claro", sistema: "dark", itDark: "true" }, { width: 390, app: "oscuro", sistema: "light", itDark: "false" }]; // localStorage.it_dark en contra del tema de la app

for (const cfg of MATRIZ.concat(EXTRA)) {
  const tag = "@" + cfg.width + " app " + cfg.app + " / sistema " + cfg.sistema + (cfg.itDark ? " / it_dark=" + cfg.itDark : "");
  const slug = cfg.width + "_app-" + cfg.app + "_sis-" + cfg.sistema + (cfg.itDark ? "_itdark-" + cfg.itDark : "");
  const ctx = await browser.newContext({ viewport: { width: cfg.width, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: cfg.sistema });
  if (cfg.itDark) await ctx.addInitScript((v) => { try { localStorage.setItem("it_dark", v); } catch (e) { /* sin storage */ } }, cfg.itDark);
  const errors = [];
  await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue(); return route.abort(); });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:" + port + "/" + DEMO + (cfg.app === "claro" ? "?tema=claro" : ""), { waitUntil: "load" });
  await page.waitForTimeout(1200);
  await page.click('[data-demo-tab="alumnos"]');
  await page.waitForTimeout(600);
  await page.evaluate(() => { const c = [...document.querySelectorAll("[data-alumno-id]")].find((x) => /Eli Regular/.test(x.innerText)); c.querySelector("[data-qa-alumno-toggle]").click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("aria-label") || "") === "Opciones de rutina"); if (b) b.click(); });
  await page.waitForTimeout(400);
  check(await page.evaluate(() => { const it = [...document.querySelectorAll("button,[role=menuitem]")].find((b) => /Validar sesión manualmente/.test(b.innerText)); if (!it) return false; it.click(); return true; }), tag + " abre el modal");
  await page.waitForTimeout(900);

  const verificar = async (paso) => {
    const m = await medir(page);
    const claro = cfg.app === "claro";
    // el FONDO del modal sigue al tema de la app, no al sistema ni a localStorage
    check(claro ? m.modalLum > 0.5 : m.modalLum < 0.1, tag + " [" + paso + "] fondo del modal acorde al tema de la app (" + m.modalBg + ")");
    const malos = m.textos.filter((t) => !t.disabled && t.ratio < 4.5);
    check(malos.length === 0, tag + " [" + paso + "] todo el texto >= 4,5:1; fallan: " + malos.map((t) => "«" + t.txt + "» " + t.ratio.toFixed(2)).join(", "));
    check(m.textos.length >= 5, tag + " [" + paso + "] se midieron textos (" + m.textos.length + ")");
    check(!m.overflow && m.dentro && !m.dlgScroll, tag + " [" + paso + "] sin desbordamiento horizontal");
    if (o.out) await page.screenshot({ path: path.join(o.out, "modal_" + paso.replace(/\W+/g, "-") + "_" + slug + ".png") });
    return m;
  };

  // Paso 1: seleccion del dia (con dias completados y pendientes)
  const p1 = await verificar("paso1-dia");
  check(p1.textos.some((t) => /Pendiente/.test(t.txt)) && p1.textos.some((t) => /Completado/.test(t.txt)), tag + " [paso1] hay filas Pendiente y Completado");
  const botonesSec = await page.evaluate((s) => { const b = [...document.querySelectorAll(s + " button")].find((x) => (x.innerText || "").trim() === "Cerrar"); if (!b) return null; const cs = getComputedStyle(b); return { h: b.getBoundingClientRect().height, borde: cs.borderTopColor }; }, DLG);
  check(!!botonesSec && botonesSec.h >= 43.5, tag + " [paso1] «Cerrar» visible y >= 44 px");

  // Paso 2: confirmacion (fecha valida, fecha anterior y posterior)
  check(await click(page, /Día 3/, "pendiente"), tag + " elige Día 3");
  await page.waitForTimeout(400);
  await verificar("paso2-fecha-valida");
  await setFecha(page, "2000-01-01");
  const e1 = await verificar("paso2-fecha-anterior");
  check(e1.textos.some((t) => /anterior al mínimo/.test(t.txt)), tag + " [paso2] mensaje de fecha anterior visible");
  await setFecha(page, "2099-01-01");
  await verificar("paso2-fecha-posterior");
  const vol = await page.evaluate((s) => { const b = [...document.querySelectorAll(s + " button")].find((x) => (x.innerText || "").trim() === "Volver"); return b ? b.getBoundingClientRect().height : 0; }, DLG);
  check(vol >= 43.5, tag + " [paso2] «Volver» >= 44 px");

  // regresion funcional: con fecha valida se confirma y el modal se cierra
  const lim = await page.evaluate((s) => document.querySelector(s + ' input[type="date"]').max, DLG);
  await setFecha(page, lim);
  await click(page, /\|Confirmar$/);
  await page.waitForTimeout(1500);
  check(!(await page.$(DLG)), tag + " con fecha valida se confirma y el modal se cierra");
  check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
  await ctx.close();
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("VALIDACION-MANUAL-TEMA OK");
