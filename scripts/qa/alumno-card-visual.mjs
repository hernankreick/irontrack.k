// QA visual de Alumnos -> ficha expandida (tarjeta del alumno + tarjeta de rutina) con datos FICTICIOS (sin Supabase ni red).
// Uso:  node scripts/qa/alumno-card-visual.mjs --out <carpeta> [--dist <dir>] [--widths 320,375,390,430] [--scenarios base,largo] [--theme dark|light] [--no-checks]
// Escenarios (QA_ALUMNO_CARD, ver fixtures.mjs): base = 3 dias, Semana 2 con 2 realizados; largo = 5 dias, nombre/correo/titulo extensos.
// Por cada ancho x escenario: abre Alumnos, expande el primer alumno, captura; abre el menu de la rutina, captura y verifica que
// "Validar sesion manualmente" este dentro del viewport; abre ese modal y captura. Con checks (por defecto) falla si hay overflow
// horizontal, errores de pagina, controles <44 px o areas tactiles superpuestas dentro de la ficha, o elementos de la ficha fuera de su tarjeta.
// --no-checks: solo capturas (sirve para la captura "antes" sobre main).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, gotoSection, openPage, resolvePlaywright, serve } from "./lib.mjs";
import { MOCK_HOST } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const SIZES = { 320: 640, 375: 667, 390: 844, 430: 932 };

function parseArgs(argv) {
  const o = { widths: [320, 375, 390, 430], scenarios: ["base", "largo"], checks: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") o.out = path.resolve(argv[++i]);
    else if (a === "--dist") o.dist = path.resolve(argv[++i]);
    else if (a === "--widths") o.widths = argv[++i].split(",").map(Number);
    else if (a === "--scenarios") o.scenarios = argv[++i].split(",");
    else if (a === "--no-checks") o.checks = false;
    else if (a === "--theme") process.env.QA_THEME = argv[++i];
    else throw new Error("Opcion desconocida: " + a);
  }
  if (!o.out) throw new Error("Falta --out <carpeta>");
  return o;
}

function build(outDir) {
  const r = spawnSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: ROOT, stdio: "inherit",
    env: { ...process.env, VITE_SUPABASE_URL: "https://" + MOCK_HOST, VITE_SUPABASE_ANON_KEY: "mock-anon-key" },
  });
  if (r.status !== 0) throw new Error("El build de QA fallo");
}

// Dentro de la pagina: controles chicos y elementos fuera de la ficha expandida.
const MEASURE = `(() => {
  const card = document.querySelector('[data-qa-alumno-card="open"]');
  if (!card) return { found: false };
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const lab = (e) => (e.getAttribute('aria-label') || e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40);
  const cr = card.getBoundingClientRect();
  const small = [...card.querySelectorAll('button,a[href],input,select,textarea,[role=button]')].filter(vis)
    .map((e) => { const r = e.getBoundingClientRect(); return { k: lab(e), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })
    .filter((c) => c.w < 43.5 || c.h < 43.5);
  const outside = [];
  for (const e of card.querySelectorAll('*')) {
    if (!vis(e) || e.closest('[data-qa-scroll-x]')) continue;
    const r = e.getBoundingClientRect();
    if (r.left < cr.left - 1 || r.right > cr.right + 1) outside.push(e.tagName.toLowerCase() + '|' + lab(e));
  }
  const overflowText = [...card.querySelectorAll('[data-qa-text]')].filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow !== 'ellipsis').map(lab);
  const clippedBtn = [...card.querySelectorAll('button')].filter(vis).filter((e) => e.scrollWidth > e.clientWidth + 1).map(lab);
  // Areas tactiles que se superponen (pares no anidados con interseccion > 1 x 1 px).
  const ctl = [...card.querySelectorAll('button,a[href],input,select,textarea,[role=button]')].filter(vis);
  const overlaps = [];
  for (let i = 0; i < ctl.length; i++) for (let j = i + 1; j < ctl.length; j++) {
    const A = ctl[i], B = ctl[j]; if (A.contains(B) || B.contains(A)) continue;
    const ra = A.getBoundingClientRect(), rb = B.getBoundingClientRect();
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w > 1 && h > 1) overlaps.push(lab(A) + ' ~ ' + lab(B));
  }
  return { found: true, small, overlaps, outside: outside.slice(0, 10), overflowText, clippedBtn, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
})()`;

async function clickByText(page, re) {
  return page.evaluate((src) => {
    const re = new RegExp(src, "i");
    const b = [...document.querySelectorAll("button")].find((e) => e.getBoundingClientRect().width > 0 && re.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")));
    if (!b) return false;
    b.scrollIntoView({ block: "center" });
    b.click();
    return true;
  }, re.source);
}

const sleep = (page, ms) => page.waitForTimeout(ms);
const pressedDay = (page) => page.evaluate(() => { const b = document.querySelector('[data-qa-alumno-card="open"] .it-ficha-day[aria-pressed="true"]'); return b ? b.getAttribute("aria-label") : null; });

// Interacciones de la ficha (con el menu de rutina y el modal ya cerrados): cada clave = true si el flujo funciono.
async function checkFlow(page) {
  const f = {};
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /^(Cerrar|Close)$/.test((e.innerText || "").trim()) && e.getBoundingClientRect().width > 0); if (b) b.click(); });
  await sleep(page, 400);
  await page.evaluate(() => { const b = document.querySelectorAll('[data-qa-alumno-card="open"] .it-ficha-day'); if (b[1]) b[1].click(); });
  await sleep(page, 300);
  f.seleccionarDia = /^D(í|a)a?y? 2/.test((await pressedDay(page)) || "");
  await clickByText(page, /^Próxima sesión: /);
  await sleep(page, 300);
  f.proximaSesion = /^D(í|a)a?y? 3/.test((await pressedDay(page)) || "");
  await page.evaluate(() => { const b = [...document.querySelectorAll('[data-qa-alumno-card="open"] button[aria-expanded="false"]')].find((e) => /ENTRADA EN CALOR|WARM-UP/.test(e.innerText || "")); if (b) b.click(); });
  await sleep(page, 300);
  f.editarEjercicio = await clickByText(page, /^Editar ejercicio: /);
  await sleep(page, 600);
  f.editarEjercicio = f.editarEjercicio && await page.evaluate(() => !!document.querySelector("[role=dialog]"));
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => { const b = [...document.querySelectorAll("[role=dialog] button")].find((e) => /Cancelar|Cancel|Cerrar|Close/.test((e.getAttribute("aria-label") || "") + (e.innerText || ""))); if (b) b.click(); });
  await sleep(page, 500);
  f.menuAlumno = await clickByText(page, /^Más opciones\s*$/);
  await sleep(page, 300);
  f.menuAlumno = f.menuAlumno && await page.evaluate(() => /Marcar pagado|Mark as paid/.test([...document.querySelectorAll('[data-qa-alumno-card="open"] button')].map((b) => b.innerText).join(" ")));
  await clickByText(page, /^Más opciones\s*$/);
  await sleep(page, 300);
  f.chat = await clickByText(page, /^Mensaje a /);
  await sleep(page, 600);
  f.chat = f.chat && await page.evaluate(() => !!document.querySelector("[role=dialog]") || /Escribí un mensaje|mensaje/i.test(document.body.innerText));
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((e) => /Cerrar chat|Cerrar|Close/.test(e.getAttribute("aria-label") || "") && e.getBoundingClientRect().width > 0); if (b) b.click(); });
  await sleep(page, 500);
  await page.evaluate(() => { const t = document.querySelector("[data-qa-alumno-toggle][aria-expanded=true]"); if (t) t.click(); });
  await sleep(page, 500);
  f.contraer = await page.evaluate(() => !document.querySelector('[data-qa-alumno-card="open"]') && !!document.querySelector("[data-qa-alumno-toggle][aria-expanded=false]"));
  return f;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  fs.mkdirSync(o.out, { recursive: true });
  const pw = resolvePlaywright();
  const failures = [];
  const results = [];
  // El escenario solo cambia las respuestas simuladas (fixtures.mjs), no el bundle: un solo build.
  let dist = o.dist;
  if (!dist) { dist = path.join(os.tmpdir(), "irontrack-qa-card-" + Date.now()); build(dist); }
  for (const scenario of o.scenarios) {
    process.env.QA_ALUMNO_CARD = scenario;
    const browser = await pw.chromium.launch({ executablePath: chromiumPath(), args: ["--no-first-run"] });
    const { server, port } = await serve(dist);
    for (const width of o.widths) {
      const id = scenario + "@" + width;
      const { ctx, page, state } = await openPage(browser, { port, width, height: SIZES[width] || 900, touch: true });
      const r = { id };
      if (!(await gotoSection(page, "Alumnos", width))) { failures.push(id + ": no se pudo abrir Alumnos"); await ctx.close(); continue; }
      // Expandir el primer alumno: control nuevo (data-qa-alumno-toggle) o el boton VER anterior.
      const opened = await page.evaluate(() => {
        const t = document.querySelector("[data-qa-alumno-toggle]") || [...document.querySelectorAll("button")].find((b) => /^\s*VER\s*$/.test(b.innerText || ""));
        if (!t) return false;
        t.click();
        return true;
      });
      if (!opened) { failures.push(id + ": no se encontro el control para expandir"); await ctx.close(); continue; }
      await page.waitForTimeout(1800);
      await page.screenshot({ path: path.join(o.out, scenario + "_" + width + "_ficha.png"), fullPage: true });
      // Recorte de la ficha (sin la barra superior), para comparar con el mockup.
      const cardEl = await page.$('[data-qa-alumno-card="open"]');
      if (cardEl) await cardEl.screenshot({ path: path.join(o.out, scenario + "_" + width + "_card.png") });
      r.measure = await page.evaluate(MEASURE);
      // Menu de la rutina -> Validar sesion manualmente.
      if (await clickByText(page, /Opciones de rutina/)) {
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(o.out, scenario + "_" + width + "_menu.png") });
        r.menu = await page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((e) => /Validar sesión manualmente/.test(e.innerText || ""));
          if (!b) return { found: false };
          const rr = b.getBoundingClientRect();
          return { found: true, inViewport: rr.left >= 0 && rr.right <= innerWidth && rr.top >= 0 && rr.bottom <= innerHeight, h: rr.height };
        });
        if (r.menu.found && await clickByText(page, /Validar sesión manualmente/)) {
          await page.waitForTimeout(900);
          await page.screenshot({ path: path.join(o.out, scenario + "_" + width + "_validar.png") });
          r.modal = await page.evaluate(() => /Pendiente/.test(document.body.innerText) && /Completado/.test(document.body.innerText));
        }
      } else r.menu = { found: false };
      if (o.checks) r.flow = await checkFlow(page);
      r.pageErrors = state.pageErrors;
      results.push(r);
      if (o.checks) {
        const m = r.measure || {};
        if (!m.found) failures.push(id + ": no se encontro la ficha expandida [data-qa-alumno-card=open]");
        if (m.overflow) failures.push(id + ": overflow horizontal");
        if (m.small && m.small.length) failures.push(id + ": controles <44 px: " + JSON.stringify(m.small));
        if (m.outside && m.outside.length) failures.push(id + ": elementos fuera de la ficha: " + JSON.stringify(m.outside));
        if (m.overlaps && m.overlaps.length) failures.push(id + ": areas tactiles superpuestas: " + JSON.stringify(m.overlaps.slice(0, 5)));
        if (m.clippedBtn && m.clippedBtn.length) failures.push(id + ": botones con contenido recortado: " + JSON.stringify(m.clippedBtn));
        if (m.overflowText && m.overflowText.length) failures.push(id + ": texto desbordado: " + JSON.stringify(m.overflowText));
        if (!r.menu.found) failures.push(id + ": falta 'Validar sesión manualmente' en el menu de la rutina");
        else if (!r.menu.inViewport) failures.push(id + ": 'Validar sesión manualmente' fuera del viewport");
        if (r.menu.found && !r.modal) failures.push(id + ": el modal de validacion no muestra dias completados/pendientes");
        Object.entries(r.flow || {}).forEach(([k, ok]) => { if (!ok) failures.push(id + ": flujo '" + k + "' no funciono"); });
        if (state.pageErrors.length) failures.push(id + ": errores de pagina: " + state.pageErrors[0]);
      }
      await ctx.close();
    }
    server.close();
    await browser.close();
  }
  fs.writeFileSync(path.join(o.out, "summary.json"), JSON.stringify({ results, failures }, null, 1));
  console.log(failures.length ? "FALLAS:\n- " + failures.join("\n- ") : "alumno-card-visual OK (" + results.length + " vistas)");
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
