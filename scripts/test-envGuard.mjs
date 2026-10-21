// Guard de entorno de build (lib/envTargetGuard.js, lib/envTargetGuardPlugin.js, lib/envBundleScan.js, scripts/check-env-target.mjs).
//
//   node scripts/test-envGuard.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sale con codigo != 0 en el primer fallo.
// Usa SOLO hosts sinteticos (*.invalid) en directorios temporales; nunca imprime hosts, URLs ni claves; sin red ni Supabase.
// Contra el repo real solo LEE el .env (en memoria) para comprobar que el guard lo bloquea; no se imprime ni se modifica.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const G = await import("../lib/envTargetGuard.js");
const { evaluateEnvTarget, sha256Host, hostOf, normalizeHost, detectTarget, parseHashList, loadHashConfig, runEnvTargetGuard } = G;
const { scanBundleDir } = await import("../lib/envBundleScan.js");
const { envTargetGuardPlugin } = await import("../lib/envTargetGuardPlugin.js");

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const PROD_HOST = "prod-sintetico.invalid", STG_HOST = "stg-sintetico.invalid", OTHER_HOST = "otro-sintetico.invalid";
const PROD = [sha256Host(PROD_HOST)], STG = [sha256Host(STG_HOST)];
const url = (h) => "https://" + h;
const ev = (o) => evaluateEnvTarget({ productionHashes: PROD, stagingHashes: [], ...o });

// ------------------------------------------------------------------ 1. logica pura
await test("detectTarget: VERCEL_ENV manda; VERCEL sin VERCEL_ENV = unknown; sin Vercel = local", () => {
  assert.equal(detectTarget({ VERCEL_ENV: "Preview" }), "preview");
  assert.equal(detectTarget({ VERCEL: "1" }), "unknown");
  assert.equal(detectTarget({}), "local");
});

await test("hash: sha256 del host en minusculas y sin espacios; hostOf rechaza basura", () => {
  assert.equal(sha256Host(" Prod-Sintetico.INVALID "), PROD[0]);
  assert.equal(hostOf("https://a.invalid/ruta?x=1"), "a.invalid");
  assert.equal(hostOf("sin-esquema"), null);
  assert.deepEqual(parseHashList(" A, b ,,"), ["a", "b"]);
});

await test("Preview: URL desde archivo => FALLA (R1) aunque no sea produccion", () => {
  for (const target of ["preview", "development", "unknown"]) {
    const r = ev({ target, url: url(OTHER_HOST), urlFromProcess: false });
    assert.equal(r.status, "fail", target);
    assert.ok(r.errors.some((e) => e.startsWith("R1")));
  }
});

await test("Preview: host de produccion en variables del entorno => FALLA (R2)", () => {
  const r = ev({ target: "preview", url: url(PROD_HOST), urlFromProcess: true });
  assert.equal(r.status, "fail");
  assert.ok(r.errors.some((e) => e.startsWith("R2")));
  assert.ok(!r.errors.join(" ").includes(PROD_HOST), "no imprime el host");
});

await test("Preview: staging o placeholder .invalid desde el entorno => OK", () => {
  assert.equal(ev({ target: "preview", url: url(STG_HOST), urlFromProcess: true }).status, "ok");
  assert.equal(ev({ target: "preview", url: "https://sin-backend.invalid", urlFromProcess: true }).status, "ok");
});

await test("Preview: con allowlist de staging, otro host => FALLA (R3); el de staging => OK", () => {
  assert.equal(ev({ target: "preview", url: url(OTHER_HOST), urlFromProcess: true, stagingHashes: STG }).status, "fail");
  assert.equal(ev({ target: "preview", url: url(STG_HOST), urlFromProcess: true, stagingHashes: STG }).status, "ok");
});

await test("Preview: URL invalida => FALLA (R4); sin URL => OK (cliente null)", () => {
  assert.ok(ev({ target: "preview", url: "desactivado", urlFromProcess: true }).errors.some((e) => e.startsWith("R4")));
  const r = ev({ target: "preview", url: undefined, urlFromProcess: false });
  assert.equal(r.status, "ok");
  assert.ok(r.info.length > 0);
});

await test("Preview sin hashes de produccion: advierte (no se puede comprobar) pero no bloquea por si solo", () => {
  const r = evaluateEnvTarget({ target: "preview", url: url(OTHER_HOST), urlFromProcess: true, productionHashes: [], stagingHashes: [] });
  assert.equal(r.status, "warn");
  assert.equal(r.errors.length, 0);
});

await test("Production y local NUNCA fallan (solo advierten): .env en archivo, host distinto, URL invalida, config rota", () => {
  for (const target of ["production", "local"]) {
    for (const o of [{ url: url(OTHER_HOST), urlFromProcess: false }, { url: url(PROD_HOST), urlFromProcess: false }, { url: "basura", urlFromProcess: true }, { url: undefined, urlFromProcess: false }]) {
      const r = ev({ target, ...o });
      assert.notEqual(r.status, "fail", target + " " + JSON.stringify(o));
      assert.equal(r.errors.length, 0);
    }
  }
  assert.equal(ev({ target: "production", url: url(PROD_HOST), urlFromProcess: true }).status, "ok");
  assert.equal(ev({ target: "production", url: url(OTHER_HOST), urlFromProcess: true }).status, "warn");
  assert.equal(ev({ target: "local", url: url(PROD_HOST), urlFromProcess: false }).status, "warn");
});

await test("normalizeHost: quita puntos finales (host. = host), conserva el puerto y es idempotente", () => {
  assert.equal(normalizeHost("HOST.invalid."), "host.invalid");
  assert.equal(normalizeHost(" host.invalid.. "), "host.invalid");
  assert.equal(normalizeHost("host.invalid.:8443"), "host.invalid:8443");
  assert.equal(normalizeHost(normalizeHost("host.invalid.")), "host.invalid");
  assert.equal(normalizeHost("[::1]:80"), "[::1]:80");
  assert.equal(sha256Host("prod-sintetico.invalid."), PROD[0], "el hash con punto final es el mismo");
  assert.equal(sha256Host("prod-sintetico.invalid.."), PROD[0]);
  assert.equal(hostOf("https://prod-sintetico.invalid./rest/v1"), PROD_HOST);
  assert.equal(hostOf("https://prod-sintetico.invalid.:443/x"), PROD_HOST);
});

await test("Preview: host de produccion con PUNTO FINAL (FQDN) => FALLA (R2), con ruta, puerto 443 o mayusculas", () => {
  for (const v of ["https://" + PROD_HOST + ".", "https://" + PROD_HOST + "./rest/v1", "https://" + PROD_HOST + ".:443", "HTTPS://" + PROD_HOST.toUpperCase() + ".", "https://" + PROD_HOST + ".."]) {
    const r = ev({ target: "preview", url: v, urlFromProcess: true });
    assert.equal(r.status, "fail", v);
    assert.ok(r.errors.some((e) => e.startsWith("R2")), v);
    assert.ok(!r.errors.join(" ").includes(PROD_HOST), "no imprime el host");
  }
  // Un host distinto con punto final sigue siendo valido (no se bloquea por error).
  assert.equal(ev({ target: "preview", url: "https://" + STG_HOST + ".", urlFromProcess: true }).status, "ok");
});

await test("Preview: URL vacia o solo espacios (variable definida pero vacia) => OK sin backend; Production igual (no falla)", () => {
  for (const target of ["preview", "development", "unknown", "production", "local"]) {
    for (const u of ["", "   ", "\n"]) {
      const r = ev({ target, url: u, urlFromProcess: true });
      assert.notEqual(r.status, "fail", target + JSON.stringify(u));
      assert.ok(r.info.length > 0, "informa que no hay backend");
    }
  }
});

// ------------------------------------------------------------------ 2. configuracion y runner
function tmpProject(files = {}, cfg) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "irontrack-envguard-"));
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content);
  if (cfg !== undefined) { mkdirSync(path.join(dir, "config")); writeFileSync(path.join(dir, "config", "env-targets.json"), typeof cfg === "string" ? cfg : JSON.stringify(cfg)); }
  return dir;
}
const KEY = "clave-sintetica-no-real";

await test("loadHashConfig: une el JSON con las variables PROD_/STAGING_SUPABASE_HOST_HASHES; JSON roto se marca", () => {
  const dir = tmpProject({}, { productionHostHashes: [PROD[0].toUpperCase()], stagingHostHashes: [] });
  const c = loadHashConfig(dir, { PROD_SUPABASE_HOST_HASHES: "abc", STAGING_SUPABASE_HOST_HASHES: STG[0] });
  assert.deepEqual(c.productionHashes, [PROD[0], "abc"]);
  assert.deepEqual(c.stagingHashes, STG);
  assert.equal(loadHashConfig(tmpProject({}, "{no json"), {}).invalidConfig, true);
  assert.deepEqual(loadHashConfig(tmpProject(), {}).productionHashes, []);
});

await test("runEnvTargetGuard: la linea de resumen no contiene host ni clave", () => {
  const dir = tmpProject({}, { productionHostHashes: PROD });
  const out = runEnvTargetGuard({ root: dir, env: { VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: url(PROD_HOST) }, effective: { VITE_SUPABASE_URL: url(PROD_HOST), VITE_SUPABASE_ANON_KEY: KEY } });
  assert.equal(out.result.status, "fail");
  const printed = out.line + out.result.errors.join(" ") + out.result.warnings.join(" ");
  assert.ok(!printed.includes(PROD_HOST) && !printed.includes(KEY));
});

// ------------------------------------------------------------------ 3. CLI contra proyectos temporales (precedencia real de Vite)
function runCli(dir, envExtra) {
  const env = { PATH: process.env.PATH, HOME: process.env.HOME || os.tmpdir(), ...envExtra };
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/check-env-target.mjs"), "--root", dir], { env, encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
const dotEnv = (h) => "VITE_SUPABASE_URL=" + url(h) + "\nVITE_SUPABASE_ANON_KEY=" + KEY + "\n";
const noLeak = (out) => { for (const s of [PROD_HOST, STG_HOST, OTHER_HOST, KEY]) assert.ok(!out.includes(s), "la salida no debe incluir valores"); };

await test("CLI Preview con .env versionado y sin variables del entorno => exit 1 (R1), sin filtrar valores", () => {
  const dir = tmpProject({ ".env": dotEnv(PROD_HOST) }, { productionHostHashes: PROD });
  const r = runCli(dir, { VERCEL: "1", VERCEL_ENV: "preview" });
  assert.equal(r.code, 1, r.out);
  assert.ok(r.out.includes("R1")); noLeak(r.out);
});

await test("CLI Preview con variables del entorno de staging (pisan al .env) => exit 0", () => {
  const dir = tmpProject({ ".env": dotEnv(PROD_HOST) }, { productionHostHashes: PROD });
  const r = runCli(dir, { VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: url(STG_HOST), VITE_SUPABASE_ANON_KEY: KEY });
  assert.equal(r.code, 0, r.out); noLeak(r.out);
});

await test("CLI Preview con el host de produccion en el entorno => exit 1 (R2)", () => {
  const dir = tmpProject({}, { productionHostHashes: PROD });
  const r = runCli(dir, { VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: url(PROD_HOST), VITE_SUPABASE_ANON_KEY: KEY });
  assert.equal(r.code, 1, r.out); assert.ok(r.out.includes("R2")); noLeak(r.out);
});

await test("CLI Preview con .env.preview/.env.local en archivo tambien se bloquea (cualquier archivo)", () => {
  const dir = tmpProject({ ".env.local": dotEnv(OTHER_HOST) }, { productionHostHashes: PROD });
  assert.equal(runCli(dir, { VERCEL: "1", VERCEL_ENV: "preview" }).code, 1);
});

await test("CLI Production con .env versionado => exit 0 (no rompe produccion), solo advierte", () => {
  const dir = tmpProject({ ".env": dotEnv(PROD_HOST) }, { productionHostHashes: PROD });
  const r = runCli(dir, { VERCEL: "1", VERCEL_ENV: "production" });
  assert.equal(r.code, 0, r.out); noLeak(r.out);
});

await test("CLI local (fuera de Vercel) con .env en archivo => exit 0; config rota en Preview => exit 1", () => {
  assert.equal(runCli(tmpProject({ ".env.local": dotEnv(OTHER_HOST) }, { productionHostHashes: PROD }), {}).code, 0);
  assert.equal(runCli(tmpProject({}, "{no json"), { VERCEL: "1", VERCEL_ENV: "preview" }).code, 1);
});

await test("CLI --hash imprime solo el sha256 del host", () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/check-env-target.mjs"), "--hash", PROD_HOST], { encoding: "utf8" });
  assert.equal(r.stdout.trim(), PROD[0]);
});

await test("CLI Preview con el host de produccion + PUNTO FINAL en el entorno => exit 1 (R2), sin filtrar valores", () => {
  const dir = tmpProject({}, { productionHostHashes: PROD });
  for (const v of [url(PROD_HOST) + ".", url(PROD_HOST) + "./rest/v1", url(PROD_HOST.toUpperCase()) + "."]) {
    const r = runCli(dir, { VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: v, VITE_SUPABASE_ANON_KEY: KEY });
    assert.equal(r.code, 1, r.out); assert.ok(r.out.includes("R2")); noLeak(r.out);
  }
});

await test("CLI Preview con URL VACIA en el entorno (pisa al .env de produccion) => exit 0, sin backend; Production tambien exit 0", () => {
  const dir = tmpProject({ ".env": dotEnv(PROD_HOST) }, { productionHostHashes: PROD });
  for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "production" }]) {
    const r = runCli(dir, { VERCEL: "1", ...env, VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: KEY });
    assert.equal(r.code, 0, r.out);
    assert.ok(r.out.includes("VITE_SUPABASE_URL=ausente"), r.out); noLeak(r.out);
  }
});

await test("CLI Preview con SOLO la clave en el entorno y el .env de produccion presente => exit 1 (la URL cae al archivo: R1+R2)", () => {
  const dir = tmpProject({ ".env": dotEnv(PROD_HOST) }, { productionHostHashes: PROD });
  const r = runCli(dir, { VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_ANON_KEY: KEY });
  assert.equal(r.code, 1, r.out);
  assert.ok(r.out.includes("R1") && r.out.includes("R2")); noLeak(r.out);
});

await test("CLI con SOLO la clave y sin URL en ningun lado => exit 0 en Preview y en Production (cliente null)", () => {
  const dir = tmpProject({}, { productionHostHashes: PROD });
  for (const env of [{ VERCEL_ENV: "preview" }, { VERCEL_ENV: "production" }]) {
    const r = runCli(dir, { VERCEL: "1", ...env, VITE_SUPABASE_ANON_KEY: KEY });
    assert.equal(r.code, 0, r.out);
    assert.ok(r.out.includes("VITE_SUPABASE_URL=ausente")); noLeak(r.out);
  }
});

await test("CLI Production con SOLO la clave y el .env presente => exit 0 (no rompe produccion)", () => {
  const dir = tmpProject({ ".env": dotEnv(PROD_HOST) }, { productionHostHashes: PROD });
  const r = runCli(dir, { VERCEL: "1", VERCEL_ENV: "production", VITE_SUPABASE_ANON_KEY: KEY });
  assert.equal(r.code, 0, r.out); noLeak(r.out);
});

// ------------------------------------------------------------------ 4. plugin de Vite (vite build directo, sin npm run build)
await test("plugin de Vite: bloquea Preview con URL de produccion y deja pasar Production", () => {
  const dir = tmpProject({}, { productionHostHashes: PROD });
  const hook = envTargetGuardPlugin().configResolved;
  const saved = { ...process.env }, log = console.log;
  const set = (o) => { for (const k of ["VERCEL", "VERCEL_ENV", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) delete process.env[k]; Object.assign(process.env, o); };
  try {
    console.log = () => {};
    const cfg = { root: dir, env: { VITE_SUPABASE_URL: url(PROD_HOST), VITE_SUPABASE_ANON_KEY: KEY } };
    set({ VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: url(PROD_HOST) });
    assert.throws(() => hook(cfg), /env-target: build bloqueado/);
    set({ VERCEL: "1", VERCEL_ENV: "production", VITE_SUPABASE_URL: url(PROD_HOST) });
    assert.doesNotThrow(() => hook(cfg));
    set({});
    assert.doesNotThrow(() => hook(cfg));
  } finally { console.log = log; for (const k of Object.keys(process.env)) delete process.env[k]; Object.assign(process.env, saved); }
});

await test("plugin de Vite: Preview con host de produccion + punto final => bloquea; Production => no", () => {
  const dir = tmpProject({}, { productionHostHashes: PROD });
  const hook = envTargetGuardPlugin().configResolved;
  const saved = { ...process.env }, log = console.log;
  const fq = url(PROD_HOST) + ".";
  try {
    console.log = () => {};
    const cfg = { root: dir, env: { VITE_SUPABASE_URL: fq, VITE_SUPABASE_ANON_KEY: KEY } };
    for (const k of ["VERCEL", "VERCEL_ENV", "VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"]) delete process.env[k];
    Object.assign(process.env, { VERCEL: "1", VERCEL_ENV: "preview", VITE_SUPABASE_URL: fq });
    assert.throws(() => hook(cfg), /env-target: build bloqueado/);
    process.env.VERCEL_ENV = "production";
    assert.doesNotThrow(() => hook(cfg));
  } finally { console.log = log; for (const k of Object.keys(process.env)) delete process.env[k]; Object.assign(process.env, saved); }
});

await test("plugin y vite.config.js: el plugin esta registrado y solo aplica a build", () => {
  assert.equal(envTargetGuardPlugin().apply, "build");
  const cfg = readFileSync(path.join(ROOT, "vite.config.js"), "utf8");
  assert.ok(/envTargetGuardPlugin\(\)/.test(cfg) && /envTargetGuardPlugin\.js/.test(cfg));
});

// ------------------------------------------------------------------ 5. escaner de bundle
function tmpBundle(js) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "irontrack-bundle-"));
  writeFileSync(path.join(dir, "index-abc.js"), js);
  return dir;
}
const SB = (ref) => "https://" + ref + ".supabase.co";

await test("escaner de bundle: limpio y placeholder .invalid => OK", () => {
  const r = scanBundleDir(tmpBundle('fetch("https://example.invalid/x");fetch("https://www.youtube.com/embed")'), { target: "preview", productionHashes: PROD });
  assert.equal(r.ok, true);
});

await test("escaner de bundle: host de produccion en Preview => FALLA; en Production => OK", () => {
  const prodSb = "abcdefghijklmnopqrst.supabase.co";
  const prodHash = [sha256Host(prodSb)];
  const dir = tmpBundle('const u="' + SB("abcdefghijklmnopqrst") + '";');
  assert.equal(scanBundleDir(dir, { target: "preview", productionHashes: prodHash }).productionHit, true);
  assert.equal(scanBundleDir(dir, { target: "production", productionHashes: prodHash }).ok, true);
});

await test("escaner de bundle: *.supabase.co fuera de la allowlist de staging => FALLA; dentro => OK", () => {
  const stgHash = [sha256Host("stagingstagingstaging.supabase.co")];
  assert.equal(scanBundleDir(tmpBundle('x="' + SB("otroproyectootroproy") + '"'), { target: "preview", productionHashes: PROD, stagingHashes: stgHash }).ok, false);
  assert.equal(scanBundleDir(tmpBundle('x="' + SB("stagingstagingstaging") + '"'), { target: "preview", productionHashes: PROD, stagingHashes: stgHash }).ok, true);
});

await test("escaner de bundle: host de produccion con PUNTO FINAL dentro del bundle => FALLA en Preview", () => {
  const prodHash = [sha256Host("abcdefghijklmnopqrst.supabase.co")];
  const dir = tmpBundle('const u="' + SB("abcdefghijklmnopqrst") + './rest/v1";');
  assert.equal(scanBundleDir(dir, { target: "preview", productionHashes: prodHash }).productionHit, true);
  assert.equal(scanBundleDir(dir, { target: "production", productionHashes: prodHash }).ok, true);
});

// ------------------------------------------------------------------ 6. repo real
await test("repo real: config/env-targets.json es JSON valido con hashes sha256 (64 hex) y sin hosts ni claves", () => {
  const raw = readFileSync(path.join(ROOT, "config/env-targets.json"), "utf8");
  const cfg = JSON.parse(raw);
  for (const h of [...cfg.productionHostHashes, ...cfg.stagingHostHashes]) assert.match(h, /^[0-9a-f]{64}$/);
  assert.ok(!/supabase\.co|eyJ|sb_publishable|sb_secret/i.test(raw));
});

await test("repo real: Preview con el .env versionado y sin variables del entorno queda BLOQUEADO; Production no", () => {
  const envFile = path.join(ROOT, ".env");
  const base = { PATH: process.env.PATH, HOME: process.env.HOME || os.tmpdir(), VERCEL: "1" };
  const run = (extra) => spawnSync(process.execPath, [path.join(ROOT, "scripts/check-env-target.mjs")], { env: { ...base, ...extra }, encoding: "utf8" });
  const prev = run({ VERCEL_ENV: "preview" });
  if (existsSync(envFile)) {
    assert.equal(prev.status, 1, "con .env versionado, la Preview debe bloquearse");
    // Con el valor del .env pasado como variable de entorno (caso peor): el hash de produccion tambien lo detecta (R2).
    const m = /^VITE_SUPABASE_URL\s*=\s*(.+)$/m.exec(readFileSync(envFile, "utf8"));
    if (m) {
      const val = m[1].trim().replace(/^["']|["']$/g, "");
      const r = run({ VERCEL_ENV: "preview", VITE_SUPABASE_URL: val, VITE_SUPABASE_ANON_KEY: "x" });
      assert.equal(r.status, 1);
      assert.ok(r.stdout.includes("R2"), "el hash de config/env-targets.json debe reconocer el host del .env");
      assert.ok(!(r.stdout + r.stderr).includes(val), "no se imprime el valor");
    }
  } else {
    assert.equal(prev.status, 0, "sin .env, la Preview sin variables queda sin backend y pasa");
  }
  assert.equal(run({ VERCEL_ENV: "production" }).status, 0, "Production nunca debe fallar por este guard");
});

console.log("\n" + count + " pruebas OK");
