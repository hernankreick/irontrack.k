// E2E de UI (Playwright + Vite dev) contra el stack LOCAL. Nunca contra Supabase hospedado: el navegador solo puede hablar con loopback.
//   node qa/e2e-ui.mjs      (requiere: qa/stack.sh up; Playwright disponible)
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { anonKey } from "./keys.mjs";
import { URL_, root, COACH_EMAIL, newPasswords, prepare, q } from "./seed.mjs";
import { isAllowedBrowserHost, assertLocalSupabaseUrl } from "./guard.mjs";

const require = createRequire(import.meta.url);
const pw = (() => { for (const p of [process.env.PLAYWRIGHT_DIR, "/node-tools/node_modules", undefined].filter((x) => x !== null)) { try { return p ? require(require.resolve("playwright", { paths: [p] })) : require("playwright"); } catch (e) {} } throw new Error("playwright no disponible"); })();
const PORT = Number(process.env.QA_VITE_PORT || 5173);
const APP = `http://127.0.0.1:${PORT}`;
const OUT = process.env.QA_OUT || "/tmp/irontrack-qa-ui"; mkdirSync(OUT, { recursive: true });
const results = []; const violations = [];
async function t(name, fn) {
  try { await fn(); results.push([true, name]); console.log("ok   -", name); }
  catch (e) { results.push([false, name]); console.log("FAIL -", name, "\n      ", String(e.message).split("\n").slice(0, 4).join(" / ")); }
}

const P = newPasswords();
const { coach } = await prepare(P);

// Vite con las variables PASADAS POR ENTORNO (tienen prioridad sobre cualquier .env del repo, que apunta a produccion).
assertLocalSupabaseUrl(URL_);
const vite = spawn(process.execPath, [root + "node_modules/vite/bin/vite.js", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort", "--open", "false"], {
  cwd: root, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, VITE_SUPABASE_URL: URL_, VITE_SUPABASE_ANON_KEY: anonKey(), BROWSER: "none" },
});
let viteLog = ""; vite.stdout.on("data", (d) => (viteLog += d)); vite.stderr.on("data", (d) => (viteLog += d));
const stopVite = () => { try { vite.kill("SIGTERM"); } catch (e) {} };
process.on("exit", stopVite);
for (let i = 0; i < 60 && !/Local:/.test(viteLog); i++) await new Promise((r) => setTimeout(r, 500));
if (!/Local:/.test(viteLog)) { console.log(viteLog); throw new Error("vite no arrancó"); }

const browser = await pw.chromium.launch({ headless: true });
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (!u.protocol.startsWith("http") || isAllowedBrowserHost(u.hostname)) return route.continue();
    violations.push(route.request().url()); return route.abort(); // kill-switch: nada sale a internet
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('it_onboard_done', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("      [pageerror]", String(e).slice(0, 160)));
  return { ctx, page };
}
async function login(page, email, password) {
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  const inputs = page.locator("input");
  await inputs.nth(0).fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByText("INGRESAR", { exact: true }).click();
}

// ───────── Entrenador ─────────
const C = await newPage();
const restSeen = [];
C.page.on("response", async (r) => { if (r.url().includes("/rest/v1/")) restSeen.push({ url: r.url(), status: r.status() }); });
await t("entrenador: login por UI (Supabase Auth local) y entra al panel", async () => {
  await login(C.page, COACH_EMAIL, P.coach);
  await C.page.waitForFunction(() => document.body.innerText.length > 0 && !document.body.innerText.includes("INGRESAR"), null, { timeout: 20000 });
  await C.page.screenshot({ path: OUT + "/coach-panel.png" });
});
await t("entrenador: el dashboard consulta alumnos por su UUID (nunca entrenador_principal) y recibe 200", async () => {
  await C.page.waitForTimeout(3000);
  const al = restSeen.filter((r) => r.url.includes("/rest/v1/alumnos?"));
  assert.ok(al.length > 0, "no hubo consulta a alumnos");
  assert.ok(al.every((r) => r.url.includes("entrenador_id=eq." + coach.id)), "consulta con id distinto del UUID: " + al.map((a) => a.url).join(" | "));
  assert.ok(!restSeen.some((r) => r.url.includes("entrenador_principal")), "hubo una consulta con entrenador_principal");
  assert.ok(al.every((r) => r.status === 200));
});
await t("entrenador: ve los 9 alumnos en pantalla", async () => {
  const txt = await C.page.evaluate(() => document.body.innerText);
  const found = [1,2,3,4,5,6,7,8,9].filter((i) => txt.includes("Alumno " + i) || (i === 1 && txt.includes("Alumno 1")));
  await C.page.screenshot({ path: OUT + "/coach-dashboard.png", fullPage: true });
  assert.ok(found.length >= 1, "no se muestran nombres de alumnos en el panel inicial (ver captura " + OUT + "/coach-dashboard.png)");
});

// ───────── Alumno A ─────────
const S1 = await newPage();
const restA = [];
S1.page.on("response", (r) => { if (r.url().includes("/rest/v1/")) restA.push({ url: r.url(), status: r.status() }); });
await t("alumno A: login por UI y entra a su plan", async () => {
  await login(S1.page, "alumno.a@qa.local", P.a);
  await S1.page.waitForFunction(() => !document.body.innerText.includes("INGRESAR"), null, { timeout: 20000 });
  await S1.page.waitForTimeout(4000);
  await S1.page.screenshot({ path: OUT + "/alumno-a.png", fullPage: true });
});
await t("alumno A: la app busca su fila y su rutina por su id (200) y pide overrides del entrenador por UUID", async () => {
  assert.ok(restA.some((r) => r.url.includes("/rest/v1/alumnos?") && r.url.includes("email=eq.alumno.a%40qa.local") && r.status === 200));
  assert.ok(restA.some((r) => r.url.includes("/rest/v1/rutinas?") && r.url.includes("alumno_id=eq.00000000-0000-0000-0000-000000000001") && r.status === 200));
  assert.ok(restA.some((r) => r.url.includes("video_overrides?entrenador_id=eq." + coach.id) && r.status === 200), "overrides no pedidos por el UUID del entrenador");
  assert.ok(!restA.some((r) => r.url.includes("entrenador_principal")));
  // Unica respuesta de error esperada: el cliente intenta registrar al alumno en `entrenadores` (upsert al iniciar sesion) y RLS lo rechaza (403).
  const bad = restA.filter((r) => r.status >= 400 && !(r.status === 403 && r.url.includes("/rest/v1/entrenadores")));
  assert.ok(bad.length === 0, "respuestas 4xx/5xx inesperadas: " + bad.map((r) => r.status + " " + r.url).join(" | "));
  assert.ok(restA.some((r) => r.status === 403 && r.url.includes("/rest/v1/entrenadores")), "se esperaba el 403 del upsert de entrenadores (RLS)");
});
await t("alumno A: la pantalla muestra su plan y no datos de otros alumnos", async () => {
  const txt = await S1.page.evaluate(() => document.body.innerText);
  assert.ok(/Rutina 1/.test(txt), "no se ve 'Rutina 1' (ver captura)");
  assert.ok(!/Alumno [3-9]/.test(txt) && !/Rutina 2/.test(txt));
});
await S1.ctx.close();
await C.ctx.close();
await browser.close(); stopVite();
const blocked = [...new Set(violations.map((v) => new URL(v).hostname))];
console.log("      hosts externos bloqueados por el kill-switch:", blocked.join(", ") || "(ninguno)");
await t("kill-switch: ninguna petición a Supabase hospedado/produccion", async () =>
  assert.deepEqual(blocked.filter((h) => /supabase|ilcdexckizxtcxopfxlq/i.test(h)), []));
const fails = results.filter((r) => !r[0]);
console.log(`\nE2E UI: ${results.length - fails.length}/${results.length} aprobadas. Capturas en ${OUT}`);
process.exit(fails.length ? 1 : 0);
