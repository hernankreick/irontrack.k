// Verifica que un cambio "de UI/UX" no se salga de su alcance. Lo usan los agentes antes de commit/PR.
//   node scripts/check-ui-scope.mjs [--base origin/main]
// Exit 0: todo dentro del alcance. Exit 1: hay archivos o lineas fuera de alcance (detenerse y pedir autorizacion).
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Rutas permitidas para trabajo autonomo de UI/UX.
export const ALLOWED = [
  /^components\/.+\.(jsx?|css)$/,
  /^index\.css$/,
  /^public\/.+/,
  /^assets\/.+/,
  /^scripts\/test-[A-Za-z0-9_-]+\.mjs$/,
  /^scripts\/qa\/(?!baseline\.json$).+\.mjs$/,
  /^scripts\/qa\/baseline\.json$/,
];

// Rutas que NUNCA se tocan sin autorizacion explicita (se informan con el motivo).
export const FORBIDDEN = [
  [/^supabase\//, "Supabase"],
  [/^sql\//, "SQL / RLS"],
  [/^\.env($|\.)/, "secretos / entorno"],
  [/^lib\//, "logica de negocio y datos"],
  [/^(App|main)\.jsx$/, "logica central de la app"],
  [/^(hooks|contexts|config)\//, "logica / contexto"],
  [/^\.github\//, "CI"],
  [/^(vercel\.json|vite\.config\.js)$/, "build / despliegue"],
  [/^package(-lock)?\.json$/, "dependencias"],
];

// Lineas agregadas en componentes que sugieren cambios de datos, no de UI.
export const DATA_PATTERNS = [/\bsupabase\b/i, /\.rpc\(/, /\.from\(\s*["'`]/, /\.(insert|upsert)\(/, /\.auth\./, /localStorage\.setItem/, /\bfetch\(/];

export function classify(files) {
  const outside = [];
  const forbidden = [];
  for (const f of files) {
    const hit = FORBIDDEN.find(([re]) => re.test(f));
    if (hit) forbidden.push(f + " (" + hit[1] + ")");
    else if (!ALLOWED.some((re) => re.test(f))) outside.push(f);
  }
  return { outside, forbidden };
}

export function scanAdded(diffText) {
  const flagged = [];
  let file = "";
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ b/")) file = line.slice(6);
    else if (line.startsWith("+") && !line.startsWith("+++") && /^components\//.test(file)) {
      if (DATA_PATTERNS.some((re) => re.test(line))) flagged.push(file + ": " + line.slice(1).trim().slice(0, 100));
    }
  }
  return flagged;
}

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

function main() {
  const i = process.argv.indexOf("--base");
  const base = i > 0 ? process.argv[i + 1] : "origin/main";
  const changed = new Set(git(["diff", "--name-only", base]).split("\n").filter(Boolean));
  for (const f of git(["ls-files", "-o", "--exclude-standard"]).split("\n").filter(Boolean)) changed.add(f);
  const { outside, forbidden } = classify([...changed]);
  const flagged = scanAdded(git(["diff", "-U0", base]));
  console.log("Archivos cambiados:", changed.size);
  if (forbidden.length) console.error("PROHIBIDOS sin autorizacion:\n- " + forbidden.join("\n- "));
  if (outside.length) console.error("FUERA DE ALCANCE UI:\n- " + outside.join("\n- "));
  if (flagged.length) console.error("LINEAS QUE PARECEN LOGICA DE DATOS:\n- " + flagged.join("\n- "));
  if (forbidden.length || outside.length || flagged.length) { console.error("\ncheck:scope FALLA: detenerse e informar al dueno."); process.exit(1); }
  console.log("check:scope OK");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
