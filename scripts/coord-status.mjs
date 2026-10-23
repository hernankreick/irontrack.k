// Preflight de coordinacion entre sesiones/carriles (solo LECTURA). Uso:
//   node scripts/coord-status.mjs [--fetch] [--files a,b,c] [--strict] [--title "titulo del PR a crear"] [--head rama]
// Solo lectura sobre el arbol de trabajo y sobre GitHub; con --fetch se actualizan las referencias remotas locales (git fetch origin --prune).
// Informa: PR abiertos (carril, estado frente a main), ramas ajenas con trabajo reciente, archivos en comun con el trabajo
// propio (--files, o el diff contra origin/main) y posibles PR duplicados. No escribe nada, no usa tokens ni variables de
// entorno: consulta solo la API publica de GitHub del repositorio. --fetch hace "git fetch origin --prune".
// Exit 0: informe emitido. Exit 3 con --strict si hay solape de archivos o posible duplicado. Exit 2: no se pudo consultar GitHub
// (nunca se asume que "no hay PR").
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classify } from "./check-ui-scope.mjs";

export const REPO = "hernankreick/irontrack.k";
const API = "https://api.github.com/repos/" + REPO;
const RECENT_HOURS = 72;

/** Carril de un conjunto de archivos: "ui" solo si TODOS estan dentro del alcance UI y ninguno es prohibido; si no, "general". */
export function laneOf(files) {
  if (!files || !files.length) return "desconocido";
  const { outside, forbidden } = classify(files);
  return outside.length || forbidden.length ? "general" : "ui";
}

/** Archivos que aparecen en ambas listas. */
export function overlaps(a, b) {
  const s = new Set(b);
  return [...new Set(a)].filter((f) => s.has(f)).sort();
}

const STOP = new Set(["de", "la", "el", "en", "y", "a", "los", "las", "un", "una", "con", "para", "por", "del", "al", "the", "of", "and", "to", "for", "fix", "feat", "chore", "ui"]);
const tokens = (t) => new Set(String(t || "").toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, " ").split(" ").filter((w) => w.length > 2 && !STOP.has(w)));

/** Una rama ya esta integrada (tipicamente por squash) si, para cada archivo que cambio, main tiene exactamente el mismo contenido. */
export function isIntegrated(files, blobAtMain, blobAtRef) {
  return files.length > 0 && files.every((f) => blobAtMain(f) === blobAtRef(f));
}

/** Posibles duplicados de {head,title} entre los PR abiertos: misma rama, o titulos con >= 60% de palabras en comun. */
export function duplicates(prs, { head, title } = {}) {
  const out = [];
  const mine = tokens(title);
  for (const p of prs) {
    if (head && p.head === head) { out.push({ number: p.number, motivo: "misma rama" }); continue; }
    const theirs = tokens(p.title);
    if (!mine.size || !theirs.size) continue;
    const common = [...mine].filter((w) => theirs.has(w)).length;
    if (common / Math.min(mine.size, theirs.size) >= 0.6) out.push({ number: p.number, motivo: "titulo muy parecido" });
  }
  return out;
}

/** Los nombres de rama y de archivo vienen de terceros: se imprimen saneados y acotados (un agente los lee). */
export const safe = (t) => String(t == null ? "" : t).replace(/[^A-Za-z0-9\/_.@+-]/g, "?").slice(0, 80);

/** Texto del informe a partir de datos ya recolectados (funcion pura, probada sin red). */
export function render({ branch, behind, ahead, myFiles, prs, branches, dup, strict }) {
  const L = [];
  const myLane = laneOf(myFiles);
  L.push("== Preflight de coordinacion ==");
  L.push("Rama actual: " + (branch || "(desconocida)") + " | frente a origin/main: " + (behind ?? "?") + " detras, " + (ahead ?? "?") + " adelante");
  L.push("Mi trabajo: " + myFiles.length + " archivo(s), carril " + myLane);
  L.push("");
  L.push("PR abiertos (" + prs.length + "):");
  let conflicts = 0;
  for (const p of prs) {
    const ov = overlaps(myFiles, p.files);
    conflicts += ov.length ? 1 : 0;
    L.push("  #" + p.number + " [" + p.lane + "] " + safe(p.head) + (p.draft ? " (draft)" : "") + " estado=" + (p.state || "?") + (p.state === "behind" ? " -> desactualizado frente a main" : "") + (ov.length ? "\n      SOLAPE de archivos: " + ov.map(safe).join(", ") : ""));
  }
  L.push("");
  L.push("Ramas remotas con trabajo reciente (<" + RECENT_HOURS + " h) sin fusionar (" + branches.length + "):");
  for (const b of branches) {
    const ov = overlaps(myFiles, b.files);
    conflicts += ov.length ? 1 : 0;
    L.push("  " + safe(b.ref) + " [" + b.lane + "] " + b.hours + " h" + (ov.length ? "\n      SOLAPE de archivos: " + ov.map(safe).join(", ") : ""));
  }
  L.push("");
  if (dup.length) L.push("POSIBLE PR DUPLICADO: " + dup.map((d) => "#" + d.number + " (" + d.motivo + ")").join(", ") + " -> actualizar ese PR en vez de crear otro.");
  else L.push("Sin PR duplicado aparente.");
  L.push(conflicts ? "ATENCION: hay trabajo de otra sesion sobre los mismos archivos. Avisar al dueno y esperar; no editar esos archivos." : "Sin solape de archivos con PR ni ramas ajenas.");
  return { text: L.join("\n"), conflicts, duplicates: dup.length, strictFail: !!strict && (conflicts > 0 || dup.length > 0) };
}

// "rev-parse" solo se usa para comparar el contenido de un archivo en dos ramas.
const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).trim();
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

async function gh(p) {
  const r = await fetch(API + p, { headers: { Accept: "application/vnd.github+json", "User-Agent": "irontrack-coord-status" } });
  if (!r.ok) throw new Error("GitHub respondio " + r.status + " en " + p);
  return r.json();
}

async function main() {
  const argv = process.argv.slice(2);
  const val = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  if (argv.includes("--fetch")) git(["fetch", "origin", "--prune"]);
  const branch = git(["branch", "--show-current"]);
  let behind, ahead;
  try { [behind, ahead] = git(["rev-list", "--left-right", "--count", "origin/main...HEAD"]).split(/\s+/).map(Number); } catch { /* sin origin/main local */ }
  let myFiles = val("--files") ? val("--files").split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!myFiles.length) {
    try { myFiles = lines(git(["diff", "--name-only", "origin/main...HEAD"])); } catch { /* sin diff */ }
    try { myFiles = [...new Set([...myFiles, ...lines(git(["diff", "--name-only"])), ...lines(git(["ls-files", "-o", "--exclude-standard"]))])]; } catch { /* sin cambios */ }
  }
  let prs;
  try {
    const open = await gh("/pulls?state=open&per_page=30");
    prs = [];
    for (const p of open.slice(0, 15)) {
      const [det, files] = await Promise.all([gh("/pulls/" + p.number), gh("/pulls/" + p.number + "/files?per_page=100")]);
      const names = files.map((f) => f.filename);
      prs.push({ number: p.number, head: p.head.ref, title: p.title, draft: p.draft, state: det.mergeable_state, files: names, lane: laneOf(names) });
    }
    if (open.length > 15) console.error("(se consultaron los primeros 15 de " + open.length + " PR abiertos)");
  } catch (e) {
    console.error("No se pudo consultar GitHub (" + e.message + "). NO se asume que no hay PR abiertos: reintentar antes de crear uno. En entornos con proxy de salida ejecutar con NODE_USE_ENV_PROXY=1.");
    process.exit(2);
  }
  const cutoff = Date.now() - RECENT_HOURS * 3600 * 1000;
  const branches = [];
  for (const row of lines(git(["for-each-ref", "--format=%(refname:short)|%(committerdate:unix)", "refs/remotes/origin"]))) {
    const [ref, ts] = row.split("|");
    if (!ref || /\/(HEAD|main)$/.test(ref) || ref === "origin" || Number(ts) * 1000 < cutoff || ref === "origin/" + branch) continue;
    let files = [];
    try { if (Number(git(["rev-list", "--count", "origin/main.." + ref])) === 0) continue; files = lines(git(["diff", "--name-only", "origin/main..." + ref])); } catch { continue; }
    const blob = (r) => (f) => { try { return git(["rev-parse", r + ":" + f]); } catch { return "(ausente)"; } };
    if (isIntegrated(files, blob("origin/main"), blob(ref))) continue; // ya integrada (p. ej. por squash): no es trabajo en curso
    branches.push({ ref, hours: Math.round((Date.now() - Number(ts) * 1000) / 3600000), files, lane: laneOf(files) });
  }
  const dup = duplicates(prs, { head: val("--head") || branch, title: val("--title") });
  const r = render({ branch, behind, ahead, myFiles, prs, branches, dup, strict: argv.includes("--strict") });
  console.log(r.text);
  process.exit(r.strictFail ? 3 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
