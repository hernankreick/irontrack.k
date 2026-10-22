// Verifica un bundle compilado (carpeta de salida de `vite build`) contra el modo demo.
//
//   node scripts/check-demo-bundle.mjs <dir> --expect=demo      el bundle ES demo: tiene el marcador y NO tiene URL/clave de Supabase
//   node scripts/check-demo-bundle.mjs <dir> --expect=no-demo   el bundle NO es demo: ni marcador ni datos ficticios ni arranque de demo
//
// Nunca imprime valores: solo veredictos y nombres de archivo.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const expect = (process.argv.find((a) => a.startsWith("--expect=")) || "").slice(9);
if (!dir || !["demo", "no-demo"].includes(expect)) { console.error("uso: check-demo-bundle.mjs <dir> --expect=demo|no-demo"); process.exit(2); }

const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = path.join(d, n); statSync(p).isDirectory() ? walk(p) : /\.(js|html|css|map)$/.test(n) && files.push(p); } })(dir);
const text = files.map((f) => readFileSync(f, "utf8")).join("\n");

const DEMO_MARKERS = ["IRONTRACK_DEMO_BUILD_MARKER", "__IRONTRACK_DEMO_API__", "DEMO · datos ficticios", "Plan Demo - Fuerza base", "demo-alumno-0001"];
const found = DEMO_MARKERS.filter((m) => text.includes(m));
const supabaseHost = /https?:\/\/[a-z0-9-]{8,}\.supabase\.(co|in)/i.test(text);
const jwt = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(text);
const errors = [];
if (expect === "demo") {
  if (found.length < DEMO_MARKERS.length) errors.push("al bundle de demo le faltan marcadores (" + found.length + "/" + DEMO_MARKERS.length + ")");
  if (supabaseHost) errors.push("el bundle de demo contiene un host de Supabase");
  if (jwt) errors.push("el bundle de demo contiene una clave tipo JWT");
} else if (found.length) {
  errors.push("el bundle NO-demo contiene codigo o datos de demo (" + found.length + " marcadores)");
}
console.log("[demo-bundle] expect=" + expect + " archivos=" + files.length + " marcadores=" + found.length + " => " + (errors.length ? "FALLA" : "OK"));
errors.forEach((e) => console.log("  - " + e));
process.exit(errors.length ? 1 : 0);
