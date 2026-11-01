// QA D6.4 de la campana del entrenador en la demo (demo/dashboard-coach.html?alertas=muchas, datos ficticios, sin red).
// Uso:  node scripts/qa/campana-d64.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 375,390,430] [--out <carpeta>]
// En oscuro y claro verifica: contraste >= 4.5 de todo texto del panel (fondos semitransparentes compuestos con los ancestros),
// botones >= 44 px (salvo las filas de notificacion), etiquetas de categoria, «Importantes», «No leídas» y la persistencia tras recargar.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/dashboard-coach.html";
const SIZES = { 375: 667, 390: 844, 430: 932 };
const o = { widths: [375, 390, 430] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-campana-d64-"));
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
const PANEL = '[role="dialog"][aria-label="Centro de notificaciones"]';

const estado = (page) => page.evaluate((sel) => {
  const panel = document.querySelector(sel);
  const bell = document.querySelector("button.coach-bell");
  const badge = bell ? [...bell.querySelectorAll("span")].map((s) => (s.innerText || "").trim()).find((t) => /^\d+\+?$/.test(t)) || "" : null;
  if (!panel) return { panel: false, badge };
  const items = [...panel.querySelectorAll("[data-notif-cat]")].map((b) => ({ cat: b.getAttribute("data-notif-cat"), leida: b.getAttribute("data-notif-leida"), txt: (b.innerText || "").replace(/\s+/g, " ").trim() }));
  const mas = panel.querySelector('[data-testid="coach-notif-ver-mas"]');
  return { panel: true, badge, items, mas: mas ? (mas.innerText || "").trim() : null, vw: innerWidth, sw: document.documentElement.scrollWidth };
}, PANEL);

const abrir = async (page) => { if (!(await estado(page)).panel) { await page.click("button.coach-bell"); await page.waitForTimeout(400); } };
const verTodas = async (page) => {
  const st = await estado(page);
  if (st.mas && /^Ver \d+ más$/.test(st.mas)) { await page.click('[data-testid="coach-notif-ver-mas"]'); await page.waitForTimeout(250); }
};
const filtro = async (page, nombre) => {
  await page.evaluate(([sel, n]) => { [...document.querySelector(sel).querySelectorAll("button")].find((b) => (b.innerText || "").trim() === n).click(); }, [PANEL, nombre]);
  await page.waitForTimeout(250);
};
const total = async (page) => { await filtro(page, "Todas"); await verTodas(page); return (await estado(page)).items.length; };

// Contraste de cada texto visible del panel y alto de cada boton que no es una fila de notificacion.
const medir = (page) => page.evaluate((sel) => {
  const panel = document.querySelector(sel);
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return [0, 0, 0, 0]; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (f, b) => { const a = f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1]; };
  const lum = (c) => { const [r, g, b] = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const fondo = (el) => {
    const cadena = [];
    for (let e = el; e; e = e.parentElement) cadena.push(parse(getComputedStyle(e).backgroundColor));
    let base = [255, 255, 255, 1];
    for (let i = cadena.length - 1; i >= 0; i--) base = over(cadena[i], base);
    return base;
  };
  const textos = [];
  const w = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const t = n.textContent.trim();
    if (!t) continue;
    const el = n.parentElement, cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) continue;
    let fg = parse(cs.color);
    const bg = fondo(el);
    fg = over(fg, bg);
    const L1 = lum(fg), L2 = lum(bg);
    textos.push({ t: t.slice(0, 40), ratio: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05) });
  }
  const botones = [...panel.querySelectorAll("button")].filter((b) => !b.hasAttribute("data-notif-cat")).map((b) => ({ t: (b.innerText || "").trim(), h: b.getBoundingClientRect().height, w: b.getBoundingClientRect().width }));
  return { textos, botones };
}, PANEL);

const abrirPagina = async (ctx, tema) => {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto("http://127.0.0.1:" + port + "/" + DEMO + "?alertas=muchas" + (tema === "claro" ? "&tema=claro" : ""), { waitUntil: "load" });
  await page.waitForTimeout(1500);
  return { page, errors };
};

for (const tema of ["oscuro", "claro"]) {
  for (const width of o.widths) {
    const tag = "@" + width + "/" + tema;
    const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 900 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); return u.hostname === "127.0.0.1" && String(u.port) === String(port) ? route.continue() : route.abort(); });
    let { page, errors } = await abrirPagina(ctx, tema);

    await abrir(page);
    const n0 = await total(page);
    const badge0 = (await estado(page)).badge;

    // a. contraste (Todas con todo desplegado) y de cada filtro activo
    for (const f of ["Todas", "Importantes", "No leídas"]) {
      await filtro(page, f);
      await verTodas(page);
      const m = await medir(page);
      const malos = m.textos.filter((x) => x.ratio < 4.5).map((x) => x.t + "=" + x.ratio.toFixed(2));
      check(m.textos.length > 5 && malos.length === 0, tag + " [" + f + "] contraste >= 4.5: " + (malos.join(", ") || m.textos.length + " textos, minimo " + Math.min(...m.textos.map((x) => x.ratio)).toFixed(2)));
      // b. botones
      const chicos = m.botones.filter((b) => b.h < 43.5).map((b) => b.t + "=" + Math.round(b.h));
      check(m.botones.length >= 3 && chicos.length === 0, tag + " [" + f + "] botones >= 44 px: " + (chicos.join(", ") || m.botones.map((b) => b.t + ":" + Math.round(b.h)).join(" ")));
    }
    await filtro(page, "Todas");
    await verTodas(page);
    let st = await estado(page);
    const sw = st.sw <= st.vw + 1;
    check(sw, tag + " sin overflow horizontal (" + st.sw + " / " + st.vw + ")");
    if (o.out) await page.screenshot({ path: path.join(o.out, "campana-d64_" + tema + "_" + width + ".png") });

    // c. etiquetas
    const etiqueta = (re) => { const it = st.items.find((x) => re.test(x.txt)); return it ? it.txt.split(" ")[0] : null; };
    const esperadas = [[/Cami/, "Seguimiento", "Cami sin rutina"], [/Juan/, "Seguimiento", "Juan sin rutina"], [/Ana/, "Adherencia", "Ana inactiva"], [/Beto/, "Adherencia", "Beto baja"], [/Mara/, "Adherencia", "Mara baja"], [/Quique/, "Seguimiento", "Quique le queda 1 sesión"]];
    for (const [re, esp, nom] of esperadas) {
      const it = st.items.find((x) => re.test(x.txt) && (nom.includes("Quique") ? /le queda 1 sesión/i.test(x.txt) : true));
      check(!!it && it.txt.startsWith(esp), tag + " etiqueta " + nom + " = " + esp + " (" + (it ? it.txt.slice(0, 60) : "no esta") + ")");
    }

    // d. Importantes
    await filtro(page, "Importantes");
    await verTodas(page);
    st = await estado(page);
    check(st.items.length > 0 && st.items.every((x) => x.cat !== "logro") && !st.items.some((x) => /completó el entrenamiento/i.test(x.txt)), tag + " «Importantes» solo no-logros (" + st.items.length + ")");

    // e. No leídas: tocar una y reabrir
    await filtro(page, "No leídas");
    await verTodas(page);
    st = await estado(page);
    const unread0 = st.items.length;
    check(unread0 === n0, tag + " al inicio todas son no leidas (" + unread0 + "/" + n0 + ")");
    // una que NO navega (Rutina terminada de Pia abre el chat simulado de la demo); la que navega se prueba al final
    const tocada = (st.items.find((x) => /Pía Terminó terminó su rutina/.test(x.txt)) || st.items[0]).txt;
    await page.evaluate(([sel, t]) => [...document.querySelector(sel).querySelectorAll("[data-notif-cat]")].find((b) => (b.innerText || "").replace(/\s+/g, " ").trim() === t).click(), [PANEL, tocada]);
    await page.waitForTimeout(400);
    await abrir(page);
    await filtro(page, "No leídas");
    await verTodas(page);
    st = await estado(page);
    check(st.items.length === unread0 - 1 && !st.items.some((x) => x.txt === tocada), tag + " tocada ya no esta en «No leídas» (" + st.items.length + "/" + (unread0 - 1) + ")");
    const esperado1 = unread0 - 1;
    check(st.badge === (esperado1 > 9 ? "9+" : String(esperado1)), tag + " el numero baja 1 (" + st.badge + ", esperado " + (esperado1 > 9 ? "9+" : esperado1) + ")");
    // el numero exacto por debajo de 9 no se ve: se comprueba con las no leidas listadas
    await page.evaluate((sel) => { [...document.querySelector(sel).querySelectorAll("button")].find((b) => (b.innerText || "").trim() === "Marcar leídas").click(); }, PANEL);
    await page.waitForTimeout(400);
    st = await estado(page);
    check(st.items.length === 0 && st.badge === "", tag + " tras «Marcar leídas», «No leídas» vacia y sin numero (" + st.items.length + ", '" + st.badge + "')");
    check(!(await page.evaluate((sel) => [...document.querySelector(sel).querySelectorAll("button")].some((b) => (b.innerText || "").trim() === "Marcar leídas"), PANEL)), tag + " «Marcar leídas» desaparece sin pendientes");

    // f. recargar
    await page.close();
    ({ page, errors } = await (async () => { const r = await abrirPagina(ctx, tema); return r; })());
    st = await estado(page);
    check(st.badge === "", tag + " tras recargar el numero sigue sin aparecer ('" + st.badge + "')");
    await abrir(page);
    const n1 = await total(page);
    st = await estado(page);
    check(n1 === n0, tag + " tras recargar el total es el mismo (" + n1 + "/" + n0 + ")");
    check(new Set(st.items.map((x) => x.txt)).size === st.items.length, tag + " sin duplicados tras recargar");
    check(st.items.every((x) => x.leida === "si"), tag + " las lecturas persisten tras recargar");
    await filtro(page, "No leídas");
    st = await estado(page);
    check(st.items.length === 0, tag + " «No leídas» sigue vacia tras recargar (" + st.items.length + ")");
    check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
    void badge0;
    await ctx.close();
  }
}
// D6.4 regresion: tocar una notificacion que NAVEGA (inactivo -> «Mis alumnos») desmonta la campana. La lectura debe quedar guardada:
// antes se guardaba dentro del updater de setReadIds, React lo descartaba al desmontar y la alerta volvia como nueva.
for (const tema of ["oscuro", "claro"]) {
  const tag = "@390/" + tema + " navegar";
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route("**/*", (route) => { const u = new URL(route.request().url()); return u.hostname === "127.0.0.1" && String(u.port) === String(port) ? route.continue() : route.abort(); });
  const { page, errors } = await abrirPagina(ctx, tema);
  await abrir(page);
  await verTodas(page);
  const tocada = await page.evaluate((sel) => {
    const b = [...document.querySelector(sel).querySelectorAll("[data-notif-cat]")].find((x) => /Ana Inactiva/.test(x.innerText || "") && /Sin sesiones/.test(x.innerText || ""));
    if (!b) return false; b.click(); return true;
  }, PANEL);
  check(tocada, tag + " notificacion de Ana (inactiva)");
  await page.waitForTimeout(800);
  const enAlumnos = await page.evaluate(() => { const t = document.querySelector('[data-demo-tab="alumnos"]'); return !!t && t.getAttribute("aria-pressed") === "true"; });
  check(enAlumnos, tag + " la notificacion navego a «Alumnos» (la campana se desmonto)");
  const guardada = await page.evaluate(() => Object.keys(localStorage).some((k) => /irontrack_coach_notif_read_v2/.test(k) && /real-in-demo-ana-/.test(localStorage.getItem(k) || "")));
  check(guardada, tag + " la lectura quedo guardada en localStorage");
  await page.click('[data-demo-tab="plan"]');
  await page.waitForTimeout(800);
  await abrir(page);
  await filtro(page, "No leídas");
  await verTodas(page);
  const st = await estado(page);
  check(!st.items.some((x) => /Ana Inactiva/.test(x.txt) && /Sin sesiones/.test(x.txt)), tag + " al volver al Dashboard la de Ana sigue leida (no reaparece como nueva)");
  check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
  await ctx.close();
}

await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("CAMPANA-D64 OK");
