// Comprueba un bundle ya construido: una Preview no puede contener el host de produccion ni hosts *.supabase.* fuera de la allowlist de staging.
//
//   node scripts/check-bundle-target.mjs <carpeta-assets> [--target preview|production]
//
// Compara por hash (config/env-targets.json + PROD_SUPABASE_HOST_HASHES / STAGING_SUPABASE_HOST_HASHES). Nunca imprime hosts.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadHashConfig } from "../lib/envTargetGuard.js";
import { scanBundleDir } from "../lib/envBundleScan.js";

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const ti = args.indexOf("--target");
const target = ti >= 0 ? args[ti + 1] : "preview";
if (!dir) { console.error("uso: check-bundle-target.mjs <carpeta-assets> [--target preview|production]"); process.exit(2); }
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadHashConfig(root);
const r = scanBundleDir(path.resolve(dir), { target, productionHashes: cfg.productionHashes, stagingHashes: cfg.stagingHashes });
console.log("[check-bundle-target] target=" + target + " hosts=" + r.hosts + " supabase=" + r.supabaseHosts + " produccion=" + (r.productionHit ? "SI" : "no") + " fuera_de_allowlist=" + r.notAllowed + " => " + (r.ok ? "OK" : "FALLA"));
process.exit(r.ok ? 0 : 1);
