// Escaner de bundles: busca hosts de Supabase en archivos construidos y los compara por HASH (nunca imprime hosts).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { sha256Host } from "./envTargetGuard.js";

/** Devuelve { hosts, supabaseHosts, productionHit, notAllowed } para una carpeta de assets. */
export function scanBundleDir(dir, { target = "preview", productionHashes = [], stagingHashes = [] } = {}) {
  const hosts = new Set();
  for (const f of readdirSync(dir).filter((n) => /\.(js|html|css)$/i.test(n))) {
    const s = readFileSync(path.join(dir, f), "utf8");
    for (const m of s.matchAll(/https?:\/\/([a-z0-9][a-z0-9.-]{3,})/gi)) hosts.add(m[1].toLowerCase());
    for (const m of s.matchAll(/\b([a-z0-9-]{8,}\.supabase\.(?:co|in))\b/gi)) hosts.add(m[1].toLowerCase());
  }
  let supabaseHosts = 0, productionHit = false, notAllowed = 0;
  for (const host of hosts) {
    const h = sha256Host(host);
    const isSb = /\.supabase\.(co|in)$/i.test(host);
    if (isSb) supabaseHosts++;
    if (productionHashes.includes(h)) {
      if (target !== "production") productionHit = true;
    } else if (isSb && target !== "production" && !stagingHashes.includes(h)) {
      notAllowed++;
    }
  }
  return { hosts: hosts.size, supabaseHosts, productionHit, notAllowed, ok: !productionHit && notAllowed === 0 };
}
