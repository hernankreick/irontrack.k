// QA de «Volumen por patrón» por rutina, ciclo y semana: demo/progreso-coach.html?patron=historial (datos ficticios, solo Preview).
// Uso:  node scripts/qa/volumen-patron-historial.mjs [--dist <dir compilado con IRONTRACK_DEMO=1>] [--widths 375,390,430,768] [--out <carpeta>]
// En Chromium, tema oscuro y claro, con TODA la red externa bloqueada: usa los selectores reales (toques), comprueba que el grafico cambia
// con la rutina/ciclo/semana, que no se mezclan rutinas ni alumnos, que no hay overflow horizontal, errores de pagina ni controles < 44 px.
// Las cifras esperadas se calculan desde la especificacion HP_SESIONES (components/demo/volumenPatronDemoData.js), no desde el codigo probado.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";
import { HP_ANA, HP_BETO, HP_CATALOGO, HP_SESIONES } from "../../components/demo/volumenPatronDemoData.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const DEMO = "demo/progreso-coach.html";
const SIZES = { 320: 640, 375: 667, 390: 844, 430: 932, 768: 1024 };
const o = { widths: [375, 390, 430, 768] };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--dist") o.dist = path.resolve(process.argv[++i]);
  else if (a === "--widths") o.widths = process.argv[++i].split(",").map(Number);
  else if (a === "--out") o.out = path.resolve(process.argv[++i]);
  else throw new Error("Opcion desconocida: " + a);
}
if (!o.dist) {
  o.dist = fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-patron-"));
  const env = { ...process.env, IRONTRACK_DEMO: "1", VITE_SUPABASE_URL: "https://example.invalid", VITE_SUPABASE_ANON_KEY: "demo-dummy" };
  delete env.VERCEL; delete env.VERCEL_ENV;
  const r = spawnSync("npx", ["vite", "build", "--outDir", o.dist, "--emptyOutDir"], { cwd: ROOT, stdio: "inherit", env });
  if (r.status !== 0) throw new Error("El build de la demo fallo");
}
if (!fs.existsSync(path.join(o.dist, DEMO))) throw new Error("El build no contiene " + DEMO);
if (o.out) fs.mkdirSync(o.out, { recursive: true });

const PATRON = Object.fromEntries(HP_CATALOGO.map((e) => [e.id, e.pattern]));
const KEYS = ["empuje", "traccion", "rodilla", "bisagra", "core"];
const AMBIGUAS = [{ ej: "hp-ohp", n: 28 }];
function esperado(alumno, rutina, ciclo, semana) {
  const out = { empuje: 0, traccion: 0, rodilla: 0, bisagra: 0, core: 0 };
  HP_SESIONES.filter((s) => s.alumno === alumno && s.rutina === rutina && s.ciclo === ciclo && s.semana === semana).forEach((s) => {
    s.series.forEach(([ej, kg, reps, cant]) => { if (!AMBIGUAS.some((a) => a.ej === ej && a.n === s.n)) out[PATRON[ej]] += kg * reps * cant; });
  });
  return out;
}

const { chromium } = await resolvePlaywright();
const browser = await chromium.launch({ executablePath: chromiumPath() });
const { server, port } = await serve(o.dist);
const fails = [];
let checks = 0;
const check = (c, m) => { checks++; if (!c) fails.push(m); };

const LEER = `(() => {
  const card = document.querySelector('[data-qa="patron-card"]');
  if (!card) return null;
  const vol = {};
  card.querySelectorAll('[data-qa^="patron-"][data-vol]').forEach((e) => { vol[e.getAttribute('data-qa').slice(7)] = Number(e.getAttribute('data-vol')); });
  const sel = (q) => { const e = card.querySelector('[data-qa="' + q + '"]'); return e ? { value: e.value, texto: e.options[e.selectedIndex].text, opciones: [...e.options].map((x) => x.text), alto: e.getBoundingClientRect().height, fuente: parseFloat(getComputedStyle(e).fontSize) } : null; };
  const r = card.getBoundingClientRect();
  const chicos = [...card.querySelectorAll('button,select,a[href]')].filter((e) => e.getBoundingClientRect().height < 43.5).length;
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = (c) => { const f = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2]; };
  const bgDe = (e) => { for (let n = e; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.99)) return c; } return [255, 255, 255]; };
  let peor = 21, peorTxt = '';
  const w = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
  for (let t; (t = w.nextNode());) { if (!t.textContent.trim()) continue; const e = t.parentElement, a = lum(rgb(getComputedStyle(e).color)), b = lum(bgDe(e)), cr = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (cr < peor) { peor = cr; peorTxt = t.textContent.trim().slice(0, 40); } }
  return { vol, rutina: sel('patron-rutina'), ciclo: sel('patron-ciclo'), semana: sel('patron-semana'), left: r.left, right: r.right, vw: innerWidth, sw: document.documentElement.scrollWidth,
    chicos, contraste: peor, peorTxt, texto: card.innerText.replace(/\\s+/g, ' '), sinAsignar: !!card.querySelector('[data-qa="patron-sin-asignar"]') };
})()`;

const igual = (v, e) => KEYS.every((k) => Math.abs((v[k] || 0) - e[k]) < 0.01);
const fmt = (v) => KEYS.map((k) => k[0] + ":" + (v[k] || 0)).join(" ");

for (const tema of ["oscuro", "claro"]) {
  for (const width of o.widths) {
    const tag = "@" + width + "/" + tema;
    const ctx = await browser.newContext({ viewport: { width, height: SIZES[width] || 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const external = new Set(), errors = [];
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
      external.add(u.hostname);
      return route.abort();
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO + "?patron=historial", { waitUntil: "load" });
    await page.waitForSelector('[data-qa="patron-card"]', { timeout: 15000 });
    if (tema === "claro") await page.click('[data-qa="demo-tema"]');
    await page.waitForTimeout(500);
    const elegir = async (q, v) => { await page.selectOption('[data-qa="' + q + '"]', String(v)); await page.waitForTimeout(250); };
    const leer = () => page.evaluate(LEER);

    // 1) Estado inicial: rutina vigente (Hipertrofia), semana actual (S3), valores = especificacion
    let m = await leer();
    check(!!m, tag + " existe la tarjeta");
    check(/Hipertrofia · actual/.test(m.rutina.texto), tag + " rutina inicial = vigente (" + m.rutina.texto + ")");
    check(/Semana 3/.test(m.semana.texto), tag + " semana inicial = S3 (" + m.semana.texto + ")");
    check(igual(m.vol, esperado(HP_ANA, "hp-r-hiper", 1, 3)), tag + " inicial = esperado (" + fmt(m.vol) + ")");
    check(m.ciclo === null, tag + " sin selector de ciclo con una sola opcion de bloque");
    check(m.rutina.opciones.length === 2, tag + " solo las 2 rutinas de Ana (" + m.rutina.opciones.join(" | ") + ")");
    check(m.semana.opciones.length === 4 && /sin sesiones/.test(m.semana.opciones[3]), tag + " S4 marcada sin sesiones (" + m.semana.opciones.join(" | ") + ")");
    check(m.semana.alto >= 43.5 && m.rutina.alto >= 43.5 && m.semana.fuente >= 16, tag + " selectores >= 44 px y 16 px (" + Math.round(m.semana.alto) + "px/" + m.semana.fuente + "px)");

    // 2) Cambiar de semana en la rutina vigente: cada semana actualiza el grafico
    const previos = new Set();
    for (const s of [1, 2, 3, 4]) {
      await elegir("patron-semana", s - 1);
      m = await leer();
      const e = esperado(HP_ANA, "hp-r-hiper", 1, s);
      check(igual(m.vol, e), tag + " Hipertrofia S" + s + " = " + fmt(e) + " (obtuvo " + fmt(m.vol) + ")");
      previos.add(fmt(m.vol));
    }
    check(previos.size === 4, tag + " las 4 semanas muestran graficos distintos");

    // 3) Cambiar de rutina (historica): vuelve a una semana con datos y muestra Fuerza base
    await elegir("patron-rutina", "hp-r-fuerza");
    m = await leer();
    check(/Fuerza base/.test(m.rutina.texto) && !/actual/.test(m.rutina.texto), tag + " rutina historica elegida");
    check(m.ciclo !== null && m.ciclo.opciones.length === 2, tag + " aparece el selector de ciclo (rutina reiniciada)");
    check(m.ciclo && /Ciclo 2/.test(m.ciclo.texto) && /Semana 1/.test(m.semana.texto), tag + " abre en el ultimo ciclo con datos (" + (m.ciclo && m.ciclo.texto) + ", " + m.semana.texto + ")");
    check(igual(m.vol, esperado(HP_ANA, "hp-r-fuerza", 2, 1)), tag + " Fuerza base ciclo 2 S1 (" + fmt(m.vol) + ")");
    check(m.sinAsignar, tag + " aviso de serie sin sesion en la vista historica");

    // 4) Ciclo 1: 4 semanas (S2 sin la serie ambigua, S3 incompleta, S4 sin sesiones)
    await elegir("patron-ciclo", 1);
    for (const s of [1, 2, 3, 4]) {
      await elegir("patron-semana", s - 1);
      m = await leer();
      const e = esperado(HP_ANA, "hp-r-fuerza", 1, s);
      check(igual(m.vol, e), tag + " Fuerza base c1 S" + s + " = " + fmt(e) + " (obtuvo " + fmt(m.vol) + ")");
    }
    check(/Sin sesiones registradas/.test(m.texto), tag + " S4 dice que no hay sesiones (sin inventar volumen)");
    check(KEYS.every((k) => m.vol[k] === 0), tag + " S4 en cero");

    // 5) No se mezclan rutinas: volver a Hipertrofia reinicia ciclo/semana al predeterminado
    await elegir("patron-rutina", "hp-r-hiper");
    m = await leer();
    check(igual(m.vol, esperado(HP_ANA, "hp-r-hiper", 1, 3)) && m.ciclo === null, tag + " al volver a la vigente, vuelve a su semana actual");

    // 6) Layout
    check(m.left >= -0.5 && m.right <= m.vw + 0.5, tag + " la tarjeta entra en pantalla (" + Math.round(m.left) + ".." + Math.round(m.right) + "/" + m.vw + ")");
    check(m.sw <= m.vw + 1, tag + " sin overflow horizontal (" + m.sw + " > " + m.vw + ")");
    check(m.chicos === 0, tag + " controles de la tarjeta >= 44 px");
    check(m.contraste >= 4.5, tag + " contraste >= 4.5 (" + m.contraste.toFixed(2) + " en «" + m.peorTxt + "»)");
    if (o.out) { await page.locator('[data-qa="patron-card"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(o.out, "patron_" + tema + "_" + width + ".png") }); }

    // 7) Otro alumno: Beto ve solo lo suyo y el estado de Ana no se arrastra
    await elegir("patron-rutina", "hp-r-fuerza");
    await page.click('[data-qa="progreso-alumno-btn"]'); await page.waitForTimeout(300);
    await page.locator('[data-qa-sheet="alumnos"] button', { hasText: "Beto Otro" }).first().click(); await page.waitForTimeout(500);
    m = await leer();
    check(m.rutina.opciones.length === 2, tag + " Beto: sus 2 rutinas (" + m.rutina.opciones.join(" | ") + ")");
    check(/Hipertrofia · actual/.test(m.rutina.texto), tag + " Beto abre en su rutina vigente, no en la elegida para Ana (" + m.rutina.texto + ")");
    check(igual(m.vol, esperado(HP_BETO, "hp-r-hiper-beto", 1, 1)), tag + " Beto vigente S1 = esperado, sin cifras de Ana (" + fmt(m.vol) + ")");
    await elegir("patron-rutina", "hp-r-fuerza-beto");
    await elegir("patron-semana", 0);
    m = await leer();
    check(igual(m.vol, esperado(HP_BETO, "hp-r-fuerza-beto", 1, 1)), tag + " Beto Fuerza base S1 = " + fmt(esperado(HP_BETO, "hp-r-fuerza-beto", 1, 1)) + " (obtuvo " + fmt(m.vol) + ")");

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
console.log("VOLUMEN-PATRON-HISTORIAL OK");
