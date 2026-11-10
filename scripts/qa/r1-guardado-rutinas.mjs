// QA de regresion R1 fase 1 (integridad del guardado de rutinas) sobre la demo demo/guardado-rutinas.html: pantalla REAL de Rutinas contra un
// servidor FALSO en memoria, datos ficticios, sin Supabase ni red. Opcional (no es una suite test-*.mjs; necesita Playwright del entorno).
//
//   node scripts/qa/r1-guardado-rutinas.mjs [--dist <dir>] [--width 390]
//   Sin --dist compila como Preview simulado (VERCEL_ENV=preview, backend .invalid).
//
// Escenarios (cada uno con asercion explicita; falla con exit 1):
//   1 guardado correcto de rutina existente      2 creacion correcta de rutina nueva    3 error de permisos       4 error de red
//   5 cero filas actualizadas                    6 error parcial en guardado multiple   7 reintento tras error   8 doble toque
//   9 tres toques rapidos                        10 edicion durante guardado            11 respuesta tardia       12 sin exito falso
//   13 cambios pendientes conservados            14 sin duplicados con operaciones concurrentes
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromiumPath, resolvePlaywright, serve } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEMO = "demo/guardado-rutinas.html";
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const WIDTH = Number(arg("--width", 390));

function build(outDir) {
  const env = { ...process.env, VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: "https://sin-backend.invalid", VITE_SUPABASE_ANON_KEY: "mock-anon-key-preview-qa" };
  const r = spawnSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--outDir", outDir, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8" });
  if (r.status !== 0) throw new Error("build fallo:\n" + (r.stdout + r.stderr).slice(-2000));
}

const failures = [];
let passed = 0;
function check(id, name, cond, extra) {
  if (cond) { passed++; console.log("ok   -", id, name); }
  else { failures.push(id + " " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); console.log("FAIL -", id, name, extra !== undefined ? JSON.stringify(extra) : ""); }
}

async function main() {
  let dist = arg("--dist");
  if (!dist) { dist = path.join(os.tmpdir(), "irontrack-r1-prev-" + Date.now()); build(dist); }
  if (!fs.existsSync(path.join(dist, DEMO))) throw new Error("El build no contiene " + DEMO + " (debe ser un build de Preview)");
  const pw = resolvePlaywright();
  const browser = await pw.chromium.launch({ executablePath: chromiumPath() });
  const { server, port } = await serve(dist);

  async function nueva() {
    const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, isMobile: true, hasTouch: true });
    const external = [];
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === "127.0.0.1" && String(u.port) === String(port)) return route.continue();
      external.push(u.hostname);
      return route.abort();
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    await page.goto("http://127.0.0.1:" + port + "/" + DEMO, { waitUntil: "load" });
    await page.waitForSelector("text=Rutina Ana", { timeout: 15000 });
    const T = {
      page, errors, external, ctx,
      modo: async (label) => { await page.getByRole("button", { name: label, exact: true }).click(); },
      lento: async (on) => { const b = page.getByRole("button", { name: /^Servidor lento/ }); const pressed = (await b.getAttribute("aria-pressed")) === "true"; if (pressed !== on) await b.click(); },
      estado: () => page.evaluate(() => {
        const d = window.__r1demo; const bar = document.querySelector(".it-routines-unsaved");
        const ex = (r) => r && r.days[0].exercises.map((e) => e.name + ":" + e.kg).join(",");
        return {
          inserts: d.servidor.inserts, updates: d.servidor.updates, log: d.servidor.log.map((l) => l.op + ":" + l.res),
          filas: Object.values(d.servidor.filas).map((f) => ({ id: f.id, alumno: f.alumno_id, nombre: f.nombre, ex: ex({ days: f.datos.days }) })),
          local: d.routines.map((r) => ({ id: r.id, name: r.name, saved: r.saved, ex: ex(r) })),
          barra: !!bar && bar.classList.contains("is-visible"),
          barraTexto: bar ? bar.innerText.replace(/\s+/g, " ") : "",
          toast: (document.querySelector("[data-qa=toast]") || {}).innerText || "",
        };
      }),
      // editar kg de un ejercicio con el modal real (⋮ → Editar → kg → GUARDAR del modal)
      editar: async (nombre, kg) => {
        const card = page.locator("div", { has: page.getByText(nombre, { exact: true }) }).filter({ has: page.getByRole("button", { name: "Más acciones del ejercicio" }) }).last();
        await card.getByRole("button", { name: "Más acciones del ejercicio" }).click();
        await page.locator(".it-routine-menu-item", { hasText: "Editar" }).click();
        const dlg = page.getByRole("dialog", { name: "Editar ejercicio: " + nombre });
        await dlg.locator("input").nth(2).fill(String(kg));
        await dlg.getByRole("button", { name: /^guardar$/i }).click();
        await page.waitForTimeout(150);
      },
      // clics SINCRONOS (mismo tick): un doble toque real llega antes de que React repinte
      clics: (selector, texto, n) => page.evaluate(([sel, txt, n]) => {
        const b = [...document.querySelectorAll(sel)].find((e) => new RegExp(txt).test(e.innerText));
        if (!b) return false; for (let i = 0; i < n; i++) b.click(); return true;
      }, [selector, texto, n]),
      guardarTodo: (n = 1) => T.clics(".it-routines-unsaved button", "^\\s*(Guardar cambios|Reintentar)", n),
      esperar: (ms) => page.waitForTimeout(ms),
      // espera a que termine el guardado en curso (con servidor lento son 3 escrituras seguidas de 3 s)
      reposo: async () => { await page.waitForTimeout(300); await page.waitForFunction(() => !/Guardando/.test((document.querySelector(".it-routines-unsaved") || { innerText: "" }).innerText), null, { timeout: 30000 }); await page.waitForTimeout(150); },
    };
    return T;
  }

  // ── 1 guardado correcto de rutina existente (tarjeta) ───────────────────
  {
    const t = await nueva();
    await t.editar("Sentadilla", 100);
    let s = await t.estado();
    check(1, "tras editar aparece la barra de cambios sin guardar", s.barra, s.barraTexto);
    await t.guardarTodo(); await t.esperar(400);
    s = await t.estado();
    check(1, "update confirmado: el servidor tiene Sentadilla 100", s.filas.some((f) => f.id === "rr-ana" && /Sentadilla:100/.test(f.ex)), s.filas);
    check(1, "éxito mostrado SOLO tras confirmar (toast ✓ y barra oculta)", /Cambios guardados ✓/.test(s.toast) && !s.barra, { toast: s.toast, barra: s.barra });
    // 2 creación correcta de rutina nueva (misma operación "Guardar cambios": Caro era nueva)
    check(2, "rutina nueva creada una sola vez y con id del servidor", s.inserts === 1 && s.local.some((r) => r.name === "Rutina nueva Caro" && r.saved && /^srv-/.test(r.id)), s);
    check(2, "sin pérdida: tres filas en el servidor", s.filas.length === 3, s.filas);
    check(1, "sin errores de página ni red externa", t.errors.length === 0 && t.external.every((h) => !/supabase|\.invalid/.test(h)), { e: t.errors, x: t.external });
    await t.ctx.close();
  }

  // ── 3, 4, 5 errores de permisos / red / cero filas + 12 + 13 ─────────────
  const falsosExitos = [];
  for (const [id, modo, re] of [[3, "Error de permisos", /No se pudo guardar ningún cambio/], [4, "Error de red", /No se pudo guardar ningún cambio/], [5, "Cero filas actualizadas", /No se pudo guardar ningún cambio/]]) {
    const t = await nueva();
    await t.modo(modo);
    await t.editar("Sentadilla", 100);
    await t.guardarTodo(); await t.esperar(500);
    const s = await t.estado();
    falsosExitos.push(/guardad[oa]s? ✓|saved ✓/i.test(s.toast) || /Guardado ✓/.test(s.barraTexto));
    check(id, modo + ": el servidor NO tiene la escritura (Sentadilla 60)", s.filas.some((f) => f.id === "rr-ana" && /Sentadilla:60/.test(f.ex)), s.filas);
    check(id, modo + ": error visible, sin «guardado ✓»", re.test(s.toast) && !falsosExitos[falsosExitos.length - 1], s.toast);
    check(13, modo + ": el aviso de cambios pendientes sigue visible con «Reintentar»", s.barra && /Reintentar/.test(s.barraTexto) && /No se pudo guardar/.test(s.barraTexto), s.barraTexto);
    check(13, modo + ": la edición local se conserva (Sentadilla 100) y Caro sigue sin guardar", s.local.some((r) => r.id === "rr-ana" && /Sentadilla:100/.test(r.ex)) && s.local.some((r) => r.id === "tmp-caro" && !r.saved), s.local);
    if (id === 5) check(5, "cero filas se informa como «no confirmó»", /no confirmó/i.test(s.barraTexto), s.barraTexto);
    await t.ctx.close();
  }
  check(12, "ninguna de las 3 fallas mostró éxito falso", falsosExitos.every((x) => !x), falsosExitos);

  // ── 6 error parcial en guardado múltiple + 7 reintento ───────────────────
  {
    const t = await nueva();
    await t.modo("Falla solo Rutina Beto");
    await t.editar("Sentadilla", 100);
    await t.guardarTodo(); await t.esperar(500);
    let s = await t.estado();
    check(6, "parcial: Ana y Caro se guardan, Beto falla", s.filas.some((f) => f.id === "rr-ana" && /Sentadilla:100/.test(f.ex)) && s.inserts === 1, s);
    check(6, "parcial NO es éxito: mensaje «Guardado parcial», barra visible, sin ✓", /Guardado parcial/.test(s.toast) && s.barra && !/guardados ✓/i.test(s.toast), { toast: s.toast, barra: s.barra });
    await t.modo("Guardado correcto");
    await t.guardarTodo(); await t.esperar(500);
    s = await t.estado();
    check(7, "reintento tras error: éxito y barra oculta", /Cambios guardados ✓/.test(s.toast) && !s.barra, { toast: s.toast, barra: s.barra });
    check(7, "reintento NO duplica: Caro ya estaba creada (1 insert en total, 3 filas)", s.inserts === 1 && s.filas.length === 3, { inserts: s.inserts, filas: s.filas.length });
    await t.ctx.close();
  }

  // ── 7b reintento tras error cuando lo que falló fue la CREACIÓN ──────────
  {
    const t = await nueva();
    await t.modo("Error de red");
    await t.editar("Sentadilla", 100);
    await t.guardarTodo(); await t.esperar(400);
    await t.guardarTodo(); await t.esperar(400);
    let s = await t.estado();
    check(7, "dos intentos fallidos no crean nada en el servidor", s.filas.length === 2 && s.local.some((r) => r.id === "tmp-caro" && !r.saved), s);
    await t.modo("Guardado correcto");
    await t.guardarTodo(); await t.esperar(400);
    s = await t.estado();
    check(7, "tras recuperar la conexión se crea UNA sola fila", s.filas.length === 3 && s.filas.filter((f) => f.nombre === "Rutina nueva Caro").length === 1, s.filas);
    await t.ctx.close();
  }

  // ── 8 doble toque, 9 tres toques ─────────────────────────────────────────
  for (const [id, n] of [[8, 2], [9, 3]]) {
    const t = await nueva();
    await t.lento(true);
    await t.editar("Sentadilla", 100);
    await t.guardarTodo(n); await t.reposo();
    const s = await t.estado();
    check(id, n + " toques seguidos = 1 sola ronda de escrituras (1 creación, 2 actualizaciones)", s.inserts === 1 && s.updates === 2, { inserts: s.inserts, updates: s.updates });
    check(id, "sin filas duplicadas en el servidor", s.filas.length === 3 && s.filas.filter((f) => f.nombre === "Rutina nueva Caro").length === 1, s.filas);
    await t.ctx.close();
  }

  // ── 8b doble toque en «Guardar» de la tarjeta de la rutina NUEVA ─────────
  {
    const t = await nueva();
    await t.lento(true);
    const ok = await t.clics("button", "^\\s*Guardar\\s*$", 3);
    check(8, "la tarjeta de la rutina nueva tiene botón «Guardar»", ok);
    await t.esperar(3800);
    const s = await t.estado();
    check(8, "3 toques en «Guardar» de la tarjeta = 1 creación", s.inserts === 1 && s.filas.filter((f) => f.nombre === "Rutina nueva Caro").length === 1, { inserts: s.inserts, filas: s.filas });
    await t.ctx.close();
  }

  // ── 10 edición durante guardado, 11 respuesta tardía ─────────────────────
  {
    const t = await nueva();
    await t.lento(true);
    await t.editar("Sentadilla", 100);
    await t.guardarTodo();
    await t.esperar(200);
    let s = await t.estado();
    check(10, "mientras guarda el botón dice «Guardando…» y está deshabilitado", /Guardando/.test(s.barraTexto), s.barraTexto);
    await t.editar("Press banca", 77); // edición NUEVA durante el guardado
    await t.reposo();                  // llega la respuesta de la versión anterior
    s = await t.estado();
    check(11, "respuesta tardía de la versión anterior: se guardó Sentadilla 100 y Press 40 en el servidor", s.filas.some((f) => f.id === "rr-ana" && /Sentadilla:100,Press banca:40/.test(f.ex)), s.filas);
    check(10, "la edición nueva NO se perdió (Press 77 local)", s.local.some((r) => r.id === "rr-ana" && /Press banca:77/.test(r.ex)), s.local);
    check(10, "la edición nueva NO se marcó como guardada: la barra sigue visible", s.barra, s.barraTexto);
    check(10, "se avisa que quedan cambios nuevos", /cambios nuevos sin guardar/.test(s.toast), s.toast);
    await t.lento(false);
    await t.guardarTodo(); await t.esperar(400);
    s = await t.estado();
    check(10, "después se puede guardar la versión más reciente (Press 77) y la barra se oculta", s.filas.some((f) => f.id === "rr-ana" && /Press banca:77/.test(f.ex)) && !s.barra, { f: s.filas, b: s.barra });
    check(10, "sin duplicados tras la segunda ronda", s.filas.length === 3, s.filas);
    await t.ctx.close();
  }
  {
    // 11b: la pantalla se reinicia (desmonte) mientras la respuesta está en vuelo: no debe romper nada
    const t = await nueva();
    await t.lento(true);
    await t.editar("Sentadilla", 100);
    await t.guardarTodo(); await t.esperar(200);
    await t.page.getByRole("button", { name: "Restablecer demo" }).click();
    await t.esperar(10000);
    const s = await t.estado();
    check(11, "respuesta tardía tras desmontar la pantalla: sin errores de página", t.errors.length === 0, t.errors);
    check(11, "la demo restablecida no queda con barra ni estado inconsistente", !s.barra, s.barraTexto);
    await t.ctx.close();
  }

  // ── 14 concurrencia: «Guardar» de la tarjeta nueva + «Guardar cambios» a la vez ──
  {
    const t = await nueva();
    await t.lento(true);
    await t.editar("Sentadilla", 100);
    await t.page.evaluate(() => {
      const card = [...document.querySelectorAll("button")].find((e) => /^\s*Guardar\s*$/.test(e.innerText));
      const bar = [...document.querySelectorAll(".it-routines-unsaved button")].find((e) => /Guardar cambios/.test(e.innerText));
      card.click(); bar.click(); card.click(); bar.click();
    });
    await t.esperar(4500); // la tarjeta guarda 1 rutina (3 s); la barra no puede arrancar mientras tanto
    const s = await t.estado();
    check(14, "operaciones concurrentes: exactamente 1 creación de la rutina nueva", s.inserts === 1 && s.filas.filter((f) => f.nombre === "Rutina nueva Caro").length === 1, { inserts: s.inserts, filas: s.filas });
    await t.ctx.close();
  }

  // ── 15 guardado múltiple parcial en una rutina NUEVA (la tarjeta se remonta al cambiar el id) + reintento ──
  {
    const t = await nueva();
    await t.modo("Falla asignar a Beto");
    await t.page.evaluate(() => {
      const card = [...document.querySelectorAll("div")].filter((d) => d.innerText && d.innerText.includes("Rutina nueva Caro") && d.querySelector("[aria-haspopup=listbox]")).pop();
      card.querySelector("[aria-haspopup=listbox]").click();
    });
    await t.esperar(200);
    await t.page.getByRole("checkbox", { name: /Beto/ }).check();
    await t.esperar(100);
    await t.clics("button", "^\\s*Guardar\\s*$", 1); await t.esperar(500);
    let s = await t.estado();
    check(15, "parcial: se crea la rutina de Caro y falla la de Beto (sin éxito falso)", s.inserts === 2 && /Guardado parcial/.test(s.toast) && !/guardada ✓|asignada/i.test(s.toast), { inserts: s.inserts, toast: s.toast });
    const seleccion = await t.page.evaluate(() => [...document.querySelectorAll("input[type=checkbox]")].length);
    check(15, "tras el remount la tarjeta nueva sigue mostrando el error y permite reintentar", /Guardado parcial|Error al guardar/.test(await t.page.evaluate(() => document.body.innerText)), seleccion);
    await t.modo("Guardado correcto");
    await t.clics("button", "^\\s*Guardar\\s*$", 1); await t.esperar(500);
    s = await t.estado();
    check(15, "el reintento crea SOLO la rutina que faltaba (Beto): 3 creaciones en total, Caro sin duplicar", s.inserts === 3 && s.filas.filter((f) => f.alumno === "al-3").length === 1 && s.filas.filter((f) => f.alumno === "al-2" && /nueva Caro/.test(f.nombre)).length === 1, { inserts: s.inserts, filas: s.filas });
    await t.ctx.close();
  }

  // ── 16 Descartar tras un guardado parcial no reintroduce duplicados ──────
  {
    const t = await nueva();
    await t.modo("Falla solo Rutina Beto");
    await t.editar("Sentadilla", 100);
    await t.guardarTodo(); await t.esperar(500);
    await t.clics(".it-routines-unsaved button", "^\\s*Descartar", 1); await t.esperar(200);
    await t.page.evaluate(() => { const b = [...document.querySelectorAll("[role=dialog] button, button")].filter((e) => /^\s*Descartar\s*$/.test(e.innerText)).pop(); b.click(); });
    await t.esperar(300);
    await t.modo("Guardado correcto");
    await t.editar("Press banca", 50);
    await t.guardarTodo(); await t.esperar(500);
    const s = await t.estado();
    check(16, "Descartar tras un parcial + guardar de nuevo: Caro se creó UNA sola vez", s.inserts === 1 && s.filas.length === 3, { inserts: s.inserts, filas: s.filas });
    await t.ctx.close();
  }

  await browser.close();
  server.close();
  console.log("\nVerificaciones OK: " + passed + " | fallidas: " + failures.length);
  if (failures.length) { failures.forEach((f) => console.log("  - " + f)); process.exit(1); }
}
main().catch((e) => { console.error(e); process.exit(1); });
