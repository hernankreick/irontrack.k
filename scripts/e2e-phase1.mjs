// Pruebas de navegador (Chromium real) de S0.6 Fase 1 + Etapa 1A integradas: logout, logout offline con token residual, cambio de
// alumno, dos pestanas, enlace compartido y cola antigua (barrera + preservacion de 1A). El backend de Supabase esta SIMULADO con page.route sobre un host inexistente: no se
// toca ningun proyecto real ni produccion.
//
// Requisitos (fuera del repo, en un directorio temporal):
//   1) copia limpia:      git archive HEAD | tar -x -C $TMP/clean && cd $TMP/clean && npm ci
//   2) build con env falso: VITE_SUPABASE_URL=https://example.invalid VITE_SUPABASE_ANON_KEY=anon-test npx vite build
//   3) servir:            npx vite preview --port 4173 --strictPort
//   4) correr:            PLAYWRIGHT_PKG=<ruta>/playwright/package.json CHROMIUM_PATH=<chrome> node scripts/e2e-phase1.mjs
// Variables: E2E_BASE (por defecto http://localhost:4173), PLAYWRIGHT_PKG, CHROMIUM_PATH.
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(process.env.PLAYWRIGHT_PKG || "/node-tools/node_modules/playwright/package.json");
const { chromium } = require("playwright");
const BASE = process.env.E2E_BASE || "http://localhost:4173";
const SB = "https://example.invalid";
const UID_A = "11111111-1111-4111-8111-111111111111";
const UID_B = "22222222-2222-4222-8222-222222222222";
const UID_C = "33333333-3333-4333-8333-333333333333";
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (uid, exp) => b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: uid, aud: "authenticated", exp, role: "authenticated" }) + ".sig";
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };

// Backend simulado. state: { logout: 'ok'|'abort'|'500'|'slow' (cierre de Auth: ok, sin red, error 5xx o lento), users: {email:{uid,alumnoId,nombre}}, log: [], restCalls: [] }
function makeBackend() {
  const st = { logout: "ok", logoutDelayMs: 5000, log: [], tokens: {}, progreso: [] };
  const users = {
    "a@test.com": { uid: UID_A, alumnoId: ID_A, nombre: "Alumno A" },
    "b@test.com": { uid: UID_B, alumnoId: ID_B, nombre: "Alumno B" },
    "entrenador@irontrack.app": { uid: UID_C, alumnoId: null, nombre: "Entrenador", password: "irontrack2024" },
  };
  st.install = async (context) => {
    await context.route(SB + "/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const method = req.method();
      const auth = req.headers()["authorization"] || "";
      if (method === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const entry = { method, path: url.pathname, search: url.search, auth, t: Date.now() };
      st.log.push(entry);
      const json = (status, body) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
      if (url.pathname === "/auth/v1/token") {
        let body = {}; try { body = JSON.parse(req.postData() || "{}"); } catch (e) {}
        const u = users[String(body.email || "").toLowerCase()];
        if (!u || body.password !== (u.password || "pw")) return json(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const at = jwt(u.uid, exp);
        st.tokens[at] = u.uid;
        return json(200, { access_token: at, refresh_token: "rt-" + u.uid.slice(0, 4), token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: u.uid, aud: "authenticated", email: body.email, app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });
      }
      if (url.pathname === "/auth/v1/logout") {
        entry.scope = url.searchParams.get("scope");
        if (st.logout === "abort") return route.abort("failed");
        if (st.logout === "500") return json(500, { msg: "internal" });
        if (st.logout === "slow") { await new Promise((r) => setTimeout(r, st.logoutDelayMs)); entry.doneAt = Date.now(); }
        return route.fulfill({ status: 204, headers: CORS });
      }
      if (url.pathname === "/auth/v1/user") return json(200, { id: UID_A, aud: "authenticated" });
      if (url.pathname === "/rest/v1/alumnos" && method === "GET") {
        const m = /auth_uid=eq\.([0-9a-f-]+)/.exec(url.search);
        const u = Object.values(users).find((x) => m && x.uid === m[1]);
        if (u) return json(200, [{ id: u.alumnoId, nombre: u.nombre, entrenador_id: "entrenador_principal", auth_uid: u.uid }]);
        return json(200, []);
      }
      if (url.pathname === "/rest/v1/progreso" && method === "POST") { st.progreso.push({ auth, body: req.postData() }); return json(201, [{ id: 1 }]); }
      if (url.pathname.startsWith("/rest/v1/")) return json(200, method === "GET" ? [] : [{}]);
      return json(200, {});
    });
  };
  return st;
}

async function newContext(browser, backend, opts) {
  const context = await browser.newContext({ viewport: { width: 420, height: 900 }, ...(opts || {}) });
  await context.addInitScript(() => { try { if (!localStorage.getItem("it_onboard_done")) localStorage.setItem("it_onboard_done", "1"); } catch (e) {} });
  await backend.install(context);
  return context;
}

async function login(page, email) {
  await page.goto(BASE + "/");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', "pw");
  await page.click("text=INGRESAR");
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("it_session") || "null")?.role === "alumno"; } catch (e) { return false; } }, null, { timeout: 15000 });
}
const ls = (page, k) => page.evaluate((key) => localStorage.getItem(key), k);
const authKey = (page) => page.evaluate(() => Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k)) || null);
const authToken = (page) => page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^sb-.*-auth-token$/.test(x)); return k ? localStorage.getItem(k) : null; });


const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
let count = 0;
async function test(name, fn) {
  const be = makeBackend();
  const ctx = await newContext(browser, be);
  try { await fn(ctx, be); count++; console.log("ok - " + name); }
  catch (e) { console.log("FAIL - " + name + "\n  " + String(e.stack || e).split("\n").slice(0, 6).join("\n  ")); process.exitCode = 1; }
  finally { await ctx.close(); }
}
async function uiLogout(page) {
  // clicks por DOM: el avatar y los items tienen animaciones que Playwright considera inestables
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => x.innerText.trim() === "AL"); b.click(); });
  await page.waitForTimeout(400);
  const item = await page.evaluate(() => { const e = Array.from(document.querySelectorAll("div.hov")).find((x) => x.innerText.trim() === "Cerrar sesión"); if (!e) return false; e.click(); return true; });
  assert.ok(item, "item Cerrar sesion del menu");
  await page.waitForTimeout(600);
  // dialogo de confirmacion: ultimo elemento clickeable con ese texto exacto
  const conf = await page.evaluate(() => { const els = Array.from(document.querySelectorAll("button,div")).filter((x) => x.innerText && x.innerText.trim() === "Cerrar sesión" && x.children.length <= 1); const el = els[els.length - 1]; if (!el) return false; el.click(); return true; });
  assert.ok(conf, "confirmacion");
}
// tras el logout se borra it_onboard_done: la app muestra la bienvenida o el login (ambos = sin sesion)
const loginVisible = (page) => page.waitForFunction(() => !localStorage.getItem('it_session') && (!!document.querySelector('input[type="email"]') || document.body.innerText.includes('EMPEZAR GRATIS')), null, { timeout: 8000 });
const pendingMarker = (page) => ls(page, "irontrack_logout_pending");
const seedQueue = (page, items) => page.evaluate((v) => localStorage.setItem("it_pending_sync", v), JSON.stringify(items));
const queue = async (page) => JSON.parse((await ls(page, "it_pending_sync")) || "null");
// 1A traslada el array antiguo: series con dueño -> it_pending_sync:item:*, sin dueño -> it_pending_sync_legacy:* (cuarentena)
const preserved = (page) => page.evaluate(() => {
  const keys = Object.keys(localStorage);
  return { array: localStorage.getItem("it_pending_sync"), items: keys.filter((k) => k.startsWith("it_pending_sync:item:")).length, quarantine: keys.filter((k) => k.startsWith("it_pending_sync_legacy:")).length };
});

await test("E1 logout ONLINE: login visible, it_session fuera, Auth cerrado (scope=local), sin marcador, series conservadas por 1A", async (ctx, be) => {
  const page = await ctx.newPage();
  await login(page, "a@test.com");
  await page.waitForTimeout(1500);
  const q = [{ exId: "e1", kg: 50, reps: 5, date: "1/10/2026", semana: 0, alumno_id: ID_A }, { exId: "e0", kg: 5, reps: 5, date: "1/10/2026", semana: 0 }];
  await seedQueue(page, q);
  assert.ok(await authKey(page), "hay sesion Auth");
  await uiLogout(page);
  await loginVisible(page);
  await page.waitForFunction(() => !localStorage.getItem("irontrack_logout_pending") && !Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)), null, { timeout: 8000 });
  assert.equal(await ls(page, "it_session"), null);
  assert.equal(be.log.filter((r) => r.path === "/auth/v1/logout").map((r) => r.scope).join(), "local");
  assert.deepEqual(await preserved(page), { array: null, items: 1, quarantine: 1 }, "1A conserva las series: con dueño en la cola nueva, sin dueño en cuarentena");
});

await test("E2 logout OFFLINE: acceso invalidado al instante, marcador, token residual sin uso; recarga; reconexion completa el cierre", async (ctx, be) => {
  const page = await ctx.newPage();
  await login(page, "a@test.com");
  await page.waitForTimeout(1500);
  const residualBefore = await authToken(page);
  assert.ok(residualBefore);
  be.logout = "abort"; // el servidor de Auth no responde
  await ctx.setOffline(true);
  const mark = be.log.length;
  await uiLogout(page);
  await loginVisible(page);
  assert.equal(await ls(page, "it_session"), null, "acceso local invalidado sin red");
  assert.ok(await pendingMarker(page), "marcador de logout pendiente");
  assert.equal(await authToken(page), residualBefore, "el token residual NO se borro a mano (sigue en el dispositivo)");
  // Recarga con la red de vuelta pero el cierre de Auth aun fallando: no se restaura nada y no se usa el token residual
  await ctx.setOffline(false);
  await page.reload();
  await loginVisible(page);
  await page.waitForTimeout(1500);
  assert.equal(await ls(page, "it_session"), null);
  assert.ok(await pendingMarker(page), "sigue pendiente mientras Auth no cierre");
  const resid = Object.values(be.tokens || {}).length ? Object.keys(be.tokens)[0] : null;
  const after = be.log.slice(mark).filter((r) => r.path.startsWith("/rest/v1/"));
  assert.ok(!after.some((r) => resid && r.auth.includes(resid)), "ninguna llamada REST uso el token residual: " + JSON.stringify(after.filter((r) => resid && r.auth.includes(resid))));
  assert.ok(!after.some((r) => r.path === "/rest/v1/alumnos" && r.method === "GET" && /auth_uid/.test(r.search)), "no se intento restaurar la identidad");
  // Reconexion: el cierre de Auth vuelve a funcionar
  be.logout = "ok";
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => !localStorage.getItem("irontrack_logout_pending") && !Object.keys(localStorage).some((k) => /^sb-.*-auth-token$/.test(k)), null, { timeout: 10000 });
  await loginVisible(page);
});

await test("E3 cambio de alumno: A cierra sesion con series, entra B; lo de A queda conservado y no sale bajo B", async (ctx, be) => {
  const page = await ctx.newPage();
  await login(page, "a@test.com");
  await page.waitForTimeout(1200);
  const q = [{ exId: "e1", kg: 50, reps: 5, date: "1/10/2026", semana: 0, alumno_id: ID_A }, { exId: "e0", kg: 5, reps: 5, date: "1/10/2026", semana: 0 }];
  await seedQueue(page, q);
  await uiLogout(page);
  await loginVisible(page);
  await login(page, "b@test.com");
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.dispatchEvent(new Event("online"))); // dispara el vaciado
  await page.waitForTimeout(1500);
  assert.deepEqual(be.progreso, [], "nada se envio a progreso bajo B");
  assert.deepEqual(await preserved(page), { array: null, items: 1, quarantine: 1 }, "series de A conservadas, B no hereda nada");
  assert.equal(JSON.parse(await ls(page, "it_session")).alumnoId, ID_B);
});

await test("E4 barrera de la cola antigua en sesion: solo sale lo propio con SU alumno_id; lo ajeno y lo desconocido se retienen intactos", async (ctx, be) => {
  const page = await ctx.newPage();
  await login(page, "a@test.com");
  await page.waitForTimeout(1500);
  // series encoladas offline durante la sesion de A (logSet las estampa con alumno_id); una ajena y una desconocida
  await seedQueue(page, [
    { exId: "e1", kg: 50, reps: 5, date: "1/10/2026", semana: 0, alumno_id: ID_A },
    { exId: "e0", kg: 5, reps: 5, date: "1/10/2026", semana: 0 },
    { exId: "e9", kg: 9, reps: 9, date: "1/10/2026", semana: 0, alumno_id: ID_B },
  ]);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForFunction(() => (JSON.parse(localStorage.getItem("it_pending_sync") || "[]")).length === 2, null, { timeout: 8000 });
  assert.equal(be.progreso.length, 1);
  const sent = JSON.parse(be.progreso[0].body);
  assert.equal(sent.alumno_id, ID_A);
  assert.equal(sent.ejercicio_id, "e1");
  assert.deepEqual((await queue(page)).map((i) => i.exId).sort(), ["e0", "e9"]);
});

await test("E4b series preexistentes (antes de iniciar sesion) se conservan por 1A y no se envian solas", async (ctx, be) => {
  const page = await ctx.newPage();
  await page.addInitScript((q) => { if (!localStorage.getItem("it_pending_sync") && !localStorage.getItem("it_session")) localStorage.setItem("it_pending_sync", q); }, JSON.stringify([
    { exId: "e1", kg: 50, reps: 5, date: "1/10/2026", semana: 0, alumno_id: ID_A },
    { exId: "e0", kg: 5, reps: 5, date: "1/10/2026", semana: 0 },
  ]));
  await login(page, "a@test.com");
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(1000);
  assert.deepEqual(be.progreso, [], "ninguna serie antigua salio");
  assert.deepEqual(await preserved(page), { array: null, items: 1, quarantine: 1 });
});

await test("E5 dos pestanas: el logout en una lleva a la otra al login; solo una cierra Auth", async (ctx, be) => {
  const p1 = await ctx.newPage();
  await login(p1, "a@test.com");
  await p1.waitForTimeout(1200);
  const p2 = await ctx.newPage();
  await p2.goto(BASE + "/");
  await p2.waitForFunction(() => document.body.innerText.includes("Modo alumno"), null, { timeout: 15000 });
  await uiLogout(p1);
  await loginVisible(p1);
  await loginVisible(p2); // la otra pestana pasa al login por el evento de storage
  await p1.waitForTimeout(1500);
  assert.equal(be.log.filter((r) => r.path === "/auth/v1/logout").length >= 1, true);
  assert.equal(await ls(p2, "it_session"), null);
});

await test("E7 enlace compartido con logout offline pendiente: solo lecturas anonimas (nunca el token residual) y ninguna escritura", async (ctx, be) => {
  const page = await ctx.newPage();
  await login(page, "a@test.com");
  await page.waitForTimeout(1500);
  const residual = Object.keys(be.tokens)[0];
  assert.ok(residual);
  be.logout = "abort"; // el cierre de Auth no responde: queda el token residual y el marcador
  await uiLogout(page);
  await loginVisible(page);
  assert.ok(await pendingMarker(page));
  assert.ok(await authToken(page), "token residual en el dispositivo");
  const mark = be.log.length;
  const link = Buffer.from(JSON.stringify({ alumnoId: ID_A })).toString("base64");
  await page.goto(BASE + "/?r=" + encodeURIComponent(link));
  await page.waitForTimeout(3500);
  const rest = be.log.slice(mark).filter((r) => r.path.startsWith("/rest/v1/"));
  assert.ok(rest.length > 0, "el enlace compartido hizo lecturas");
  assert.ok(rest.every((r) => r.method === "GET"), "ninguna escritura: " + JSON.stringify(rest.filter((r) => r.method !== "GET")));
  assert.ok(rest.every((r) => !r.auth.includes(residual)), "ninguna lectura uso el token residual");
  assert.ok(rest.every((r) => r.auth === "Bearer anon-test"), "todas salieron como anon: " + JSON.stringify([...new Set(rest.map((r) => r.auth))]));
  assert.ok(await pendingMarker(page), "el visitante del enlace no cierra ni reabre la sesion");
});

// ── Correccion P0-1 / P1-1: login con un logout pendiente que no logra completarse ────────────────────────────

// Cierra sesion de A SIN red (/logout cae): queda el marcador y el token residual. Deja la app en la pantalla de bienvenida/login.
async function logoutAOffline(page, be) {
  await login(page, "a@test.com");
  await page.waitForTimeout(1500);
  be.logout = "abort";
  await uiLogout(page);
  await loginVisible(page);
  assert.ok(await pendingMarker(page), "marcador de A pendiente");
  assert.ok(await authToken(page), "token residual de A en el dispositivo");
}
const tokenOf = (be, uid) => Object.keys(be.tokens).filter((t) => be.tokens[t] === uid);
async function submitLogin(page, email, pass) {
  await page.goto(BASE + "/");
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pass);
  await page.click("text=INGRESAR");
}

await test("E8 logout offline de A + /logout en 5xx: el login valido de B ENTRA, B conserva la sesion tras recargar y nunca se revoca; series de A y B intactas", async (ctx, be) => {
  const page = await ctx.newPage();
  await login(page, "a@test.com");
  await page.waitForTimeout(1200);
  await seedQueue(page, [
    { exId: "a1", kg: 50, reps: 5, date: "1/10/2026", semana: 0, alumno_id: ID_A },
    { exId: "u1", kg: 5, reps: 5, date: "1/10/2026", semana: 0 },
  ]);
  be.logout = "abort";
  await uiLogout(page);
  await loginVisible(page);
  assert.ok(await pendingMarker(page));
  const aTokens = tokenOf(be, UID_A);
  be.logout = "500"; // /auth/v1/logout responde 5xx; /token y /rest funcionan
  const mark = be.log.length;
  await submitLogin(page, "b@test.com", "pw");
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("it_session") || "null")?.role === "alumno"; } catch (e) { return false; } }, null, { timeout: 20000 });
  assert.equal(JSON.parse(await ls(page, "it_session")).alumnoId, ID_B, "entro B");
  assert.equal(await pendingMarker(page), null, "el marcador de A se borro al autenticar B");
  await page.waitForTimeout(2500);
  const after = be.log.slice(mark);
  const rest = after.filter((r) => r.path.startsWith("/rest/v1/"));
  assert.ok(!rest.some((r) => aTokens.some((t) => r.auth.includes(t))), "el token residual de A no llego a REST");
  assert.ok(rest.every((r) => r.method === "GET" ? true : !r.auth.includes("anon-test")), "ninguna escritura anonima");
  const bTokens = tokenOf(be, UID_B);
  assert.ok(!after.some((r) => r.path === "/auth/v1/logout" && bTokens.some((t) => r.auth.includes(t))), "ningun /logout con el token de B (B no se revoca)");
  // recarga tras el nuevo login: se restaura B
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes("Modo alumno"), null, { timeout: 15000 });
  assert.equal(JSON.parse(await ls(page, "it_session")).alumnoId, ID_B);
  assert.equal(await pendingMarker(page), null);
  // series de A conservadas por 1A (cola nueva + cuarentena), sin enviar nada
  assert.deepEqual(await preserved(page), { array: null, items: 1, quarantine: 1 });
  assert.deepEqual(be.progreso, []);
});

await test("E9 login FALLIDO de B con el logout de A pendiente: el marcador y la proteccion siguen; despues un login valido entra", async (ctx, be) => {
  const page = await ctx.newPage();
  await logoutAOffline(page, be);
  const aTokens = tokenOf(be, UID_A);
  be.logout = "500";
  const mark = be.log.length;
  await submitLogin(page, "b@test.com", "mala");
  await page.waitForFunction(() => document.body.innerText.includes("Email o contraseña incorrectos"), null, { timeout: 15000 });
  assert.ok(await pendingMarker(page), "el marcador de A sigue");
  assert.equal(await ls(page, "it_session"), null);
  await page.waitForTimeout(1500);
  const rest = be.log.slice(mark).filter((r) => r.path.startsWith("/rest/v1/"));
  assert.ok(!rest.some((r) => aTokens.some((t) => r.auth.includes(t))), "el token residual de A sigue sin usarse");
  // login valido a continuacion
  await page.fill('input[type="password"]', "pw");
  await page.click("text=INGRESAR");
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("it_session") || "null")?.role === "alumno"; } catch (e) { return false; } }, null, { timeout: 20000 });
  assert.equal(await pendingMarker(page), null);
});

await test("E10 login de ENTRENADOR con marcador pendiente: entra, el marcador se borra y sus consultas a entrenadores usan SU token", async (ctx, be) => {
  const page = await ctx.newPage();
  await logoutAOffline(page, be);
  be.logout = "500";
  const mark = be.log.length;
  await submitLogin(page, "entrenador@irontrack.app", "irontrack2024");
  await page.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("it_session") || "null")?.role === "entrenador"; } catch (e) { return false; } }, null, { timeout: 20000 });
  assert.equal(await pendingMarker(page), null);
  await page.waitForTimeout(2000);
  const coachTokens = tokenOf(be, UID_C), aTokens = tokenOf(be, UID_A);
  const ent = be.log.slice(mark).filter((r) => r.path === "/rest/v1/entrenadores");
  assert.ok(ent.length >= 1, "hubo consultas a entrenadores");
  assert.ok(ent.every((r) => coachTokens.some((t) => r.auth.includes(t))), "todas con el token del entrenador: " + JSON.stringify(ent.map((r) => r.method + " " + r.auth.slice(7, 20))));
  assert.ok(!be.log.slice(mark).some((r) => r.path.startsWith("/rest/v1/") && aTokens.some((t) => r.auth.includes(t))), "nunca con el residual de A");
});

await test("E11 dos pestanas: una completa el logout antiguo (servidor LENTO) mientras la otra inicia sesion: A se revoca con su token y B queda con sesion", async (ctx, be) => {
  const p1 = await ctx.newPage();
  await logoutAOffline(p1, be);
  const aTokens = tokenOf(be, UID_A);
  be.logout = "slow"; be.logoutDelayMs = 5000;
  const nLogouts = be.log.filter((r) => r.path === "/auth/v1/logout").length;
  await p1.evaluate(() => window.dispatchEvent(new Event("online"))); // la pestana 1 empieza a cerrar Auth (tarda 5 s)
  await p1.waitForFunction(() => true);
  await new Promise((r) => setTimeout(r, 400));
  const p2 = await ctx.newPage();
  await submitLogin(p2, "b@test.com", "pw"); // la pestana 2 inicia sesion mientras el cierre antiguo sigue en curso
  await p2.waitForFunction(() => { try { return JSON.parse(localStorage.getItem("it_session") || "null")?.alumnoId; } catch (e) { return false; } }, null, { timeout: 30000 });
  assert.equal(JSON.parse(await ls(p2, "it_session")).alumnoId, ID_B);
  await p2.waitForTimeout(6500); // deja terminar cualquier cierre tardio
  const bTokens = tokenOf(be, UID_B);
  const logouts = be.log.filter((r) => r.path === "/auth/v1/logout").slice(nLogouts);
  assert.ok(logouts.length >= 1, "el cierre antiguo se envio");
  assert.ok(logouts.every((r) => aTokens.some((t) => r.auth.includes(t))), "todo /logout llevo el token de A: " + JSON.stringify(logouts.map((r) => r.auth.slice(7, 40))));
  // el login de B ESPERO el lock: su solicitud de token salio despues de terminar el cierre lento de A (exclusion entre pestanas)
  const slowLogout = logouts.find((r) => r.doneAt);
  const bToken = be.log.filter((r) => r.path === "/auth/v1/token" && r.t > slowLogout.t).pop();
  assert.ok(slowLogout && bToken && bToken.t >= slowLogout.doneAt - 100, "el login de B esperaba al cierre antiguo: token a " + (bToken && bToken.t - slowLogout.t) + " ms, cierre termino a " + (slowLogout && slowLogout.doneAt - slowLogout.t) + " ms");
  assert.ok(!logouts.some((r) => bTokens.some((t) => r.auth.includes(t))), "B no fue revocado");
  assert.equal(JSON.parse(await ls(p2, "it_session")).alumnoId, ID_B, "B conserva la sesion de la app");
  assert.ok(await authKey(p2), "y la sesion de Auth");
  assert.equal(await pendingMarker(p2), null);
});

await test("E6 recarga normal con sesion valida sigue restaurando al alumno (sin regresion online)", async (ctx, be) => {
  const page = await ctx.newPage();
  await login(page, "a@test.com");
  await page.waitForTimeout(1200);
  await page.reload();
  await page.waitForFunction(() => document.body.innerText.includes("Modo alumno"), null, { timeout: 15000 });
  assert.equal(JSON.parse(await ls(page, "it_session")).alumnoId, ID_A);
});

await browser.close();
console.log("\n" + count + " tests ok");

process.exit(process.exitCode || 0);
