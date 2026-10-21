// Guard de entorno de build (CLI). Misma logica que el plugin de Vite (lib/envTargetGuardPlugin.js).
//
//   node scripts/check-env-target.mjs                 evalua el entorno actual (mode production por defecto)
//   node scripts/check-env-target.mjs --root <dir>    raiz del proyecto (por defecto: la del repo)
//   node scripts/check-env-target.mjs --mode <mode>   modo de Vite (por defecto production)
//   node scripts/check-env-target.mjs --hash <host>   imprime el sha256 del host (para config/env-targets.json)
//
// Nunca imprime hosts, URLs ni claves. Sale con codigo 1 solo si el build es Preview/Development y viola alguna regla.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runEnvTargetGuard, printGuardResult, sha256Host, URL_VAR, KEY_VAR } from "../lib/envTargetGuard.js";

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (args.includes("--hash")) {
  const host = opt("--hash", "");
  if (!host) { console.error("uso: --hash <host>"); process.exit(2); }
  console.log(sha256Host(host));
  process.exit(0);
}

const root = path.resolve(opt("--root", repoRoot));
const mode = opt("--mode", "production");
const { loadEnv } = await import("vite");
const effective = loadEnv(mode, root, "VITE_");
const out = runEnvTargetGuard({ root, env: process.env, effective: { [URL_VAR]: effective[URL_VAR], [KEY_VAR]: effective[KEY_VAR] } });
printGuardResult(out);
process.exit(out.result.status === "fail" ? 1 : 0);
