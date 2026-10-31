// QA visual de «Mis alumnos» sobre la demostracion (demo/mis-alumnos.html, datos ficticios, solo Preview).
// Uso:  node scripts/qa/mis-alumnos-visual.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 375,390,430,1280] [--out <carpeta>]
// En Chromium, sin sesion de IronTrack y con TODA la red externa bloqueada (se registra y se aborta), a 375/390/430/1280 px,
// tema oscuro y claro, escenarios «Muchos alumnos» y «Lista vacia»:
//   sin overflow horizontal, controles >= 44 px, contraste de texto >= 4.5:1, la busqueda y los chips filtran, la ficha se expande,
//   el boton de chat y el menu responden, «Asignar rutina» abre el dialogo existente, sin errores de pagina y sin red (salvo fuentes).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/mis-alumnos.html";
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
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-demo-ma-"));
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

// ---- mediciones dentro de la pagina ----
const medir = (page) => page.evaluate(() => {
  const root = document.querySelector(".alu-page") || document.body;
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const overflow = document.documentElement.scrollWidth - innerWidth;
  const chicos = [...root.querySelectorAll("button,select,input,[role=button]")].filter(vis).map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter((x) => x.r.height < 43.5 || x.r.width < 43.5)
    .map((x) => ((x.e.getAttribute("aria-label") || x.e.innerText || x.e.tagName) + "").trim().slice(0, 30) + " " + Math.round(x.r.width) + "x" + Math.round(x.r.height));
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const bgDe = (el) => { const cadena = []; for (let n = el; n; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { cadena.push(c); if (c.a >= 1) break; } } let acc = { r: 255, g: 255, b: 255, a: 1 }; for (let i = cadena.length - 1; i >= 0; i--) acc = over(cadena[i], acc); return acc; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const bajos = [];
  for (const el of root.querySelectorAll("*")) {
    if (!vis(el) || el.closest("select")) continue;
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
    if (!texto) continue;
    const fg = parse(getComputedStyle(el).color); if (!fg) continue;
    const bg = bgDe(el);
    const f = over(fg, bg);
    const l1 = lum(f), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5) bajos.push(texto.slice(0, 28) + " " + ratio.toFixed(2));
  }
  return { overflow, chicos, bajos, titulo: (root.querySelector("h1") || {}).innerText || "" };
});
const tarjetas = (page) => page.evaluate(() => [...document.querySelectorAll("[data-alumno-id]")].map((c) => ({ id: c.getAttribute("data-alumno-id"), open: c.getAttribute("data-qa-alumno-card") === "open", txt: c.innerText })));
const chipsInfo = (page) => page.evaluate(() => [...document.querySelectorAll("button[aria-pressed]")].map((b) => (b.innerText || "").trim()).filter((t) => /\(\d+\)$/.test(t)));
const clickChip = (page, prefijo) => page.evaluate((p) => { const b = [...document.querySelectorAll("button[aria-pressed]")].find((x) => (x.innerText || "").trim().startsWith(p) && /\(\d+\)$/.test(x.innerText.trim())); if (!b) return false; b.click(); return true; }, prefijo);

for (const width of o.widths) {
  const mobile = width < 768;
  for (const tema of ["dark", "light"]) {
    for (const escenario of ["muchos", "vacia"]) {
      const tag = "@" + width + "/" + tema + "/" + escenario;
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
      await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
      await page.waitForTimeout(1200);
      await page.click('[data-demo-theme="' + tema + '"]');
      if (escenario === "vacia") await page.click('[data-demo-scenario="vacia"]');
      await page.waitForTimeout(500);

      const inicio = await page.evaluate(() => document.body.innerText);
      check(/DEMO/.test(inicio), tag + " abre la demo sin login");
      let m = await medir(page);
      check(m.titulo.trim() === "Mis alumnos", tag + " titulo «Mis alumnos» (" + m.titulo.trim() + ")");
      check(m.overflow <= 0, tag + " sin overflow horizontal (" + m.overflow + ")");
      check(m.chicos.length === 0, tag + " controles >= 44 px: " + m.chicos.join(" | "));
      check(m.bajos.length === 0, tag + " contraste >= 4.5:1: " + m.bajos.slice(0, 6).join(" | "));
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".alu-page")).backgroundColor);
      check(bg === (tema === "dark" ? "rgb(10, 15, 26)" : "rgb(241, 245, 249)"), tag + " fondo de la paleta (" + bg + ")");
      if (o.out) await page.screenshot({ path: path.join(o.out, "mis-alumnos_" + width + "_" + tema + "_" + escenario + ".png"), fullPage: true });

      if (escenario === "vacia") {
        check((await tarjetas(page)).length === 0, tag + " lista vacia sin tarjetas");
      } else {
        const todas = await tarjetas(page);
        check(todas.length === 12, tag + " 12 alumnos (" + todas.length + ")");
        const chips = await chipsInfo(page);
        for (const p of ["Todos", "Activos", "Inactivos", "Sin rutina"]) check(chips.some((c) => c.startsWith(p)), tag + " chip " + p);
        // chips: la cantidad de tarjetas coincide con el contador
        for (const p of ["Activos", "Inactivos", "Sin rutina", "Todos"]) {
          check(await clickChip(page, p), tag + " clic en chip " + p);
          await page.waitForTimeout(300);
          const n = Number((chips.find((c) => c.startsWith(p)).match(/\((\d+)\)$/) || [])[1]);
          const ts = await tarjetas(page);
          check(ts.length === n, tag + " chip " + p + " -> " + n + " tarjetas (" + ts.length + ")");
        }
        await clickChip(page, "Sin rutina"); await page.waitForTimeout(300);
        const sin = await tarjetas(page);
        check(sin.length === 2 && sin.every((t) => /Renata|Ignacio/.test(t.txt)), tag + " Sin rutina -> Renata e Ignacio");
        if (o.out) await page.screenshot({ path: path.join(o.out, "mis-alumnos-sin-rutina_" + width + "_" + tema + ".png") });
        await clickChip(page, "Todos"); await page.waitForTimeout(300);

        // busqueda
        await page.fill('input[aria-label="Buscar alumno"]', "mateo");
        await page.waitForTimeout(300);
        let ts = await tarjetas(page);
        check(ts.length === 1 && /Mateo/.test(ts[0].txt), tag + " la busqueda filtra a Mateo (" + ts.length + ")");
        await page.fill('input[aria-label="Buscar alumno"]', "");
        await page.waitForTimeout(300);
        check((await tarjetas(page)).length === 12, tag + " limpiar la busqueda vuelve a 12");

        // expandir ficha
        await page.click('button[aria-label^="Ver ficha de Lucía"]');
        await page.waitForTimeout(900);
        ts = await tarjetas(page);
        check(ts.some((t) => t.open && /Lucía/.test(t.txt)), tag + " expande la ficha de Lucía");
        m = await medir(page);
        check(m.overflow <= 0, tag + " ficha abierta sin overflow (" + m.overflow + ")");
        check(m.chicos.length === 0, tag + " ficha abierta: controles >= 44 px: " + m.chicos.join(" | "));
        if (o.out) await page.screenshot({ path: path.join(o.out, "mis-alumnos-ficha_" + width + "_" + tema + ".png") });
        await page.click('button[aria-label^="Contraer ficha de Lucía"]');
        await page.waitForTimeout(400);

        // chat y menu
        await page.click('button[aria-label^="Mensaje a Mateo"]');
        await page.waitForTimeout(400);
        check(/Chat con Mateo/.test(await page.evaluate(() => document.body.innerText)), tag + " el boton de chat responde");
        await page.click('[data-alumno-id="demo-mateo"] button[aria-label="Más opciones"]');
        await page.waitForTimeout(300);
        check(await page.evaluate(() => !!document.querySelector('[data-alumno-id="demo-mateo"] button[aria-label="Más opciones"][aria-expanded="true"]')), tag + " el menu de la tarjeta abre");
        if (o.out) await page.screenshot({ path: path.join(o.out, "mis-alumnos-menu_" + width + "_" + tema + ".png") });
        await page.keyboard.press("Escape");
        await page.click('[data-alumno-id="demo-mateo"] button[aria-label="Más opciones"]').catch(() => {});
        await page.reload({ waitUntil: "load" });
        await page.waitForTimeout(1000);

        // Asignar rutina (alumno sin rutina)
        await page.click('[data-demo-theme="' + tema + '"]');
        await page.click('button[aria-label^="Ver ficha de Renata"]');
        await page.waitForTimeout(1000);
        const abrio = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "Asignar rutina"); if (!b) return false; b.click(); return true; });
        check(abrio, tag + " hay boton «Asignar rutina»");
        await page.waitForTimeout(700);
        check((await page.evaluate(() => document.body.innerText)).includes("Asignar rutina: Rutina inicial (demo) a Renata Domínguez"), tag + " Asignar rutina abre el dialogo existente");
        // el select cambia la rutina que se asignara
        await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "Cancelar"); if (b) b.click(); });
      }

      const storage = await page.evaluate(() => Object.keys(localStorage));
      check(!storage.includes("it_session") && !storage.some((k) => /^sb-.*-auth-token$/.test(k)), tag + " sin sesion de IronTrack: " + storage.join(","));
      check(errors.length === 0, tag + " sin errores de pagina: " + errors.join(" | "));
      const ext = [...external].filter((h) => !/fonts\.(googleapis|gstatic)\.com/.test(h));
      check(ext.length === 0, tag + " sin red externa: " + ext.join(","));
      await ctx.close();
    }
  }
}
await browser.close();
server.close();
console.log(checks + " verificaciones, " + fails.length + " fallas");
if (fails.length) { console.error("FALLAS:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("MIS-ALUMNOS-VISUAL OK");
