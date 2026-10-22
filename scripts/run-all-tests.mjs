// Ejecuta todas las suites scripts/test-*.mjs igual que el paso "Run test suites" del CI.  Uso:  npm run test:all
import { readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(dir).filter((f) => /^test-.+\.mjs$/.test(f)).sort();
if (!suites.length) { console.error("no se encontro ninguna suite en scripts/test-*.mjs"); process.exit(1); }
const failed = [];
for (const s of suites) {
  const r = spawnSync("node", [path.join(dir, s)], { encoding: "utf8" });
  if (r.status === 0) console.log("OK   " + s);
  else { failed.push(s); console.log("FAIL " + s + "\n" + (r.stdout + r.stderr).split("\n").slice(-25).join("\n")); }
}
console.log("\nSuites ejecutadas: " + suites.length + " | fallidas: " + failed.length);
process.exit(failed.length ? 1 : 0);
