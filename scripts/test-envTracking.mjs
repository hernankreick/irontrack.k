// Seguridad de variables de entorno en Git: .gitignore, archivos .env* versionados, plantilla sin valores y patrones de secretos.
//
//   node scripts/test-envTracking.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sale con codigo != 0 en el primer fallo.
// Solo lee rutas (git ls-files) y archivos de texto; detecta valores sin imprimirlos jamas.
// Deuda conocida y declarada: `.env` sigue versionado hasta que el dueño confirme las variables de Production en Vercel
// (ver KNOWN_DEBT). Cualquier OTRO archivo .env* versionado hace fallar la prueba.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

let files = null;
try {
  files = execFileSync("git", ["-C", ROOT, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
} catch { /* sin repositorio Git (p. ej. tarball) */ }
if (!files) {
  console.log("sin repositorio Git: pruebas de seguimiento omitidas (0 pruebas)");
  process.exit(0);
}
const app = files.filter((f) => !f.startsWith("node_modules/") && !f.startsWith(".chrome-headless/"));

const ENV_FILE = /(^|\/)\.env(\..+)?$/;
const TEMPLATE = /(^|\/)\.env\.(example|sample|template)$/;
const KNOWN_DEBT = new Set([".env"]); // se retira en un PR aparte, tras confirmar las variables de Production en Vercel

await test("solo la deuda conocida (.env) y la plantilla estan versionados entre los .env*", () => {
  const unexpected = files.filter((f) => ENV_FILE.test(f) && !TEMPLATE.test(f) && !KNOWN_DEBT.has(f));
  assert.deepEqual(unexpected, [], "archivos .env* versionados no permitidos: " + unexpected.join(", "));
  const debt = files.filter((f) => KNOWN_DEBT.has(f));
  if (debt.length) console.log("   ! deuda conocida: versionado " + debt.join(", ") + " (retirar en PR aparte)");
});

await test(".gitignore ignora .env, .env.* y variantes locales, pero NO la plantilla .env.example", () => {
  const ignored = (p) => { try { execFileSync("git", ["-C", ROOT, "check-ignore", "-q", "--no-index", p]); return true; } catch { return false; } };
  for (const p of [".env", ".env.local", ".env.production", ".env.preview", ".env.development", ".env.production.local", ".env.development.local"]) {
    assert.ok(ignored(p), p + " debe estar ignorado");
  }
  assert.equal(ignored(".env.example"), false, ".env.example debe poder versionarse");
});

await test("la plantilla .env.example existe, declara las variables y no contiene valores reales", () => {
  const p = path.join(ROOT, ".env.example");
  assert.ok(existsSync(p), "falta .env.example");
  assert.ok(!files.includes("env.example"), "env.example (sin punto) debe haberse reemplazado por .env.example");
  const s = readFileSync(p, "utf8");
  assert.ok(/^VITE_SUPABASE_URL=/m.test(s) && /^VITE_SUPABASE_ANON_KEY=/m.test(s));
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(s), "parece un JWT");
  assert.ok(!/sb_(publishable|secret)_[A-Za-z0-9_-]{8,}/.test(s), "parece una clave de Supabase");
  assert.ok(!/https?:\/\/[a-z0-9]{20}\.supabase\.(co|in)/i.test(s), "parece un proyecto real de Supabase");
});

await test("ningun archivo versionado tiene nombre de secreto o llave privada", () => {
  const bad = app.filter((f) => /(^|\/)(id_rsa|id_ed25519)$|\.(pem|p12|pfx|keystore|jks)$|service[_-]?role.*\.(json|txt|key)$/i.test(f));
  assert.deepEqual(bad, [], bad.join(", "));
});

await test("ningun archivo de texto versionado contiene valores de service_role / secret keys (no se imprimen)", () => {
  const SKIP = /\.(png|jpe?g|webp|ico|gif|svg|woff2?|ttf|mp4|mp3|pdf|lottie|zip|gz|dmp)$/i;
  const bad = [];
  for (const f of app) {
    if (SKIP.test(f) || ENV_FILE.test(f) || /^scripts\/test-env/.test(f)) continue;
    let s; try { s = readFileSync(path.join(ROOT, f), "utf8"); } catch { continue; }
    if (s.length > 3_000_000) continue;
    if (/service_role['"]?\s*[:=]\s*['"]eyJ/.test(s) || /SERVICE_ROLE_KEY\s*=\s*['"]?[A-Za-z0-9._-]{30,}/.test(s) || /sb_secret_[A-Za-z0-9_-]{20,}/.test(s) || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(s)) bad.push(f);
  }
  assert.deepEqual(bad, [], "patron de secreto en: " + bad.join(", "));
});

await test("ningun archivo de codigo versionado tiene un host *.supabase.co literal (la URL viene de variables)", () => {
  const bad = [];
  for (const f of app) {
    if (!/\.(js|jsx|mjs|cjs|ts|tsx|json|html)$/i.test(f) || ENV_FILE.test(f) || /^scripts\/test-/.test(f)) continue;
    let s; try { s = readFileSync(path.join(ROOT, f), "utf8"); } catch { continue; }
    if (/https?:\/\/[a-z0-9-]{15,}\.supabase\.(co|in)/i.test(s)) bad.push(f);
  }
  assert.deepEqual(bad, [], "host Supabase literal en: " + bad.join(", "));
});

await test("el guard de entorno esta conectado: plugin en vite.config.js y modulos presentes", () => {
  for (const f of ["lib/envTargetGuard.js", "lib/envTargetGuardPlugin.js", "lib/envBundleScan.js", "scripts/check-env-target.mjs", "scripts/check-bundle-target.mjs", "config/env-targets.json"]) {
    assert.ok(existsSync(path.join(ROOT, f)), "falta " + f);
  }
  assert.match(readFileSync(path.join(ROOT, "vite.config.js"), "utf8"), /envTargetGuardPlugin\(\)/);
});

await test("el workflow de CI ejecuta el guard sobre un build de Preview simulado y el escaner de bundle", () => {
  const ci = readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /VERCEL_ENV: preview/);
  assert.match(ci, /VERCEL_ENV: production/);
  assert.match(ci, /check-bundle-target\.mjs/);
});

// Informativo (no falla): otras deudas de seguimiento detectadas, para que no se pierdan de vista.
const nm = files.filter((f) => f.startsWith("node_modules/")).length;
const ch = files.filter((f) => f.startsWith(".chrome-headless/")).length;
if (nm) console.log("   ! deuda conocida: " + nm + " archivos de node_modules versionados");
if (ch) console.log("   ! deuda conocida: " + ch + " archivos de .chrome-headless versionados (perfil de navegador; revisar y retirar en PR aparte)");

console.log("\n" + count + " pruebas OK");
