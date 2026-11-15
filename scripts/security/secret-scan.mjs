#!/usr/bin/env node
// IronTrack · S-1 · Escaner de secretos y archivos sensibles. Sin dependencias, sin red, sin servicios externos.
//
// REGLA DE ORO: nunca imprime valores. Solo ruta, linea, tipo, nivel y que hacer (y, para variables de entorno, el NOMBRE).
//
// Modos:
//   node scripts/security/secret-scan.mjs                 archivos versionados del arbol actual (git ls-files). Exit 1 si hay hallazgos.
//   node scripts/security/secret-scan.mjs --staged        solo lo preparado para commit (indice). Exit 1 si hay hallazgos.
//   node scripts/security/secret-scan.mjs --range A..B    blobs NUEVOS en ese rango de commits (CI de un PR: base..HEAD). Exit 1 si hay hallazgos:
//                                                          cubre secretos agregados y luego quitados dentro del mismo PR.
//   node scripts/security/secret-scan.mjs --history       auditoria: todos los blobs alcanzables desde cualquier ref local/remota.
//                                                          Informa en que commits aparece cada hallazgo. Exit 0 salvo --strict.
//   Opciones: --json (salida JSON) · --strict (con --history, exit 1 si hay hallazgos) · --profile-details (con --history:
//             cuenta filas de Cookies/Login Data y lista DOMINIOS, nunca valores, usuarios ni contrasenas).
//
// Que se considera hallazgo:
//   1. Archivos que nunca deben versionarse: .env y variantes (salvo plantillas *.example/*.sample/*.template), perfiles de
//      navegador (.chrome-*/, Cookies, Login Data, ...), llaves (*.pem, *.key, id_rsa, *.p12, ...), configuracion local de Vercel.
//   2. Contenido con forma de secreto: bloques de llave privada, JWT con rol service_role (Supabase), claves sb_secret_,
//      tokens de GitHub, Stripe live, AWS, Slack, Google OAuth, Anthropic/OpenAI, cadenas postgres con contrasena y
//      asignaciones sensibles (SECRET/PASSWORD/SERVICE_ROLE/TOKEN...) con un valor literal que no es un marcador.
// Que NO es hallazgo (claves publicas por diseno): JWT con rol "anon" de Supabase y claves sb_publishable_ en el codigo del
// frontend. Igual se reportan si estan dentro de un archivo .env versionado (por el archivo, no por la clave).
// Excepcion explicita y auditable: un comentario "secret-scan: allow" en la MISMA linea, SOLO en scripts/test-*.mjs o carpetas
// fixtures/ (datos ficticios) y NUNCA para hallazgos CRITICOS. Binarios y archivos grandes: se buscan tokens sobre una vista
// latin1/utf16le (sin reglas de asignacion). Si git falla o la salida se trunca, sale con codigo 2 (nunca "0 hallazgos" falso).
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const LEVELS = ["CRITICO", "ALTO", "MEDIO", "BAJO"];
const MAX_BYTES = 1024 * 1024;
// Contenido que no se escanea (terceros o generado). Las reglas de RUTA se aplican igual a cualquier archivo.
const SKIP_CONTENT = [/^node_modules\//, /(^|\/)node_modules\//, /(^|\/)package-lock\.json$/, /\.(png|jpe?g|gif|webp|ico|svg|pdf|woff2?|ttf|otf|mp4|mp3|zip|gz|wasm)$/i];
const ALLOW_MARK = "secret-scan: allow";
const ALLOW_PATHS = /(^|\/)(scripts\/test-[^/]+\.mjs|fixtures?\/.+)$/;
const MAX_BINARY_BYTES = 64 * 1024 * 1024;

/** Huella NO reversible de un valor (sha256 truncado a 16 hex). Permite reconocer un hallazgo conocido sin guardar el valor. */
export function fingerprint(v) { return createHash("sha256").update(String(v)).digest("hex").slice(0, 16); }

/** Nombre seguro para imprimir: si parece un secreto (en la posicion del nombre), se redacta. */
export function safeName(n) {
  const s = String(n || "");
  if (s.length > 40 || /^eyJ/.test(s) || TOKEN_RULES.some((r) => r.re.test(s))) return "[nombre redactado: tiene forma de secreto]";
  return s;
}

// ---------------------------------------------------------------- reglas de ruta
const ENV_TEMPLATE = /\.(example|sample|template)$/i;
const PROFILE_FILES = new Set(["Cookies", "Cookies-journal", "Login Data", "Login Data-journal", "Login Data For Account", "Web Data", "Local State", "Secure Preferences", "History", "Network Persistent State", "Device Bound Sessions"]);

/** @returns {{rule:string, level:string, type:string, fix:string}|null} */
export function classifyPath(p) {
  const rel = String(p).replace(/\\/g, "/");
  const base = rel.split("/").pop();
  const segs = rel.split("/");
  if ((/^\.env(\..+)?$/i.test(base) || /\.env$/i.test(base) || base === ".envrc" || base === ".dev.vars") && !ENV_TEMPLATE.test(base)) {
    return { rule: "env-file", level: "ALTO", type: "archivo de variables de entorno versionado", fix: "git rm --cached <archivo>; usar variables del panel de Vercel o .env.local (ignorado). Plantilla sin valores: .env.example" };
  }
  if (segs.some((s) => /^\.(chrome|chromium|playwright)[-_]/i.test(s)) || (PROFILE_FILES.has(base) && segs.some((s) => s === "Default" || /^Profile \d+$/.test(s)))) {
    return { rule: "browser-profile", level: "CRITICO", type: "perfil de navegador (cookies/sesiones/contrasenas guardadas)", fix: "git rm -r --cached <carpeta>; los perfiles headless van fuera del repo (.gitignore: .chrome-*/)" };
  }
  if (/\.dmp$/i.test(base) || segs.includes("Crashpad")) {
    return { rule: "memory-dump", level: "CRITICO", type: "volcado de memoria de un proceso (puede contener sesiones/tokens)", fix: "git rm --cached <archivo>; los volcados nunca se versionan (.gitignore: *.dmp, Crashpad/)" };
  }
  if (/\.(pem|key|p12|pfx|jks|keystore|ppk)$/i.test(base) || /^id_(rsa|dsa|ecdsa|ed25519)$/.test(base)) {
    return { rule: "key-file", level: "CRITICO", type: "archivo de llave/certificado privado", fix: "git rm --cached <archivo> y rotar la llave" };
  }
  if (segs[0] === ".vercel") {
    return { rule: "vercel-local", level: "BAJO", type: "configuracion local de Vercel (.vercel/)", fix: "git rm -r --cached .vercel (ya esta en .gitignore)" };
  }
  return null;
}

// ---------------------------------------------------------------- reglas de contenido
const PLACEHOLDER = /(<[^>]*>|\$\{|process\.env|import\.meta|secrets\.|\btu[-_ ]|\byour[-_ ]|example|ejemplo|changeme|change_me|dummy|fake|ficticio|placeholder|redacted|\*{3,}|x{4,}|\.\.\.|^(true|false|null|undefined|0|1)$)/i;
const b64urlJson = (s) => { try { return JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch { return null; } };

/** Rol declarado en un JWT (sin verificar firma: solo para clasificar). */
export function jwtRole(token) {
  const parts = String(token).split(".");
  if (parts.length !== 3) return null;
  const payload = b64urlJson(parts[1]);
  return payload && typeof payload === "object" ? { role: payload.role ?? null, iss: payload.iss ?? null, ref: payload.ref ?? null } : null;
}

// Construidas por partes para que este archivo no contenga literales con forma de secreto.
const PK_BLOCK = new RegExp("-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----");
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const TOKEN_RULES = [
  { rule: "supabase-secret-key", re: new RegExp("\\bsb_" + "secret_[A-Za-z0-9_-]{16,}"), level: "CRITICO", type: "clave secreta de Supabase (sb_secret_)", fix: "rotar en Supabase > Project Settings > API keys" },
  { rule: "supabase-access-token", re: new RegExp("\\bsbp_[a-f0-9]{40}\\b"), level: "CRITICO", type: "token personal de Supabase (sbp_, Management API de toda la cuenta)", fix: "revocar en Supabase > Account > Access Tokens" },
  { rule: "onesignal-rest-key", re: new RegExp("\\bos_v2_" + "app_[A-Za-z0-9]{40,}"), level: "CRITICO", type: "clave REST API de OneSignal (envia notificaciones a todos los suscriptores)", fix: "rotar en OneSignal > Settings > Keys & IDs y mover el envio a una funcion del servidor" },
  { rule: "github-token", re: new RegExp("\\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_" + "pat_[A-Za-z0-9_]{40,})\\b"), level: "CRITICO", type: "token de GitHub", fix: "revocar en GitHub > Settings > Developer settings" },
  { rule: "stripe-live", re: new RegExp("\\b[sr]k_" + "live_[0-9A-Za-z]{16,}\\b"), level: "CRITICO", type: "clave live de Stripe", fix: "rotar en Stripe" },
  { rule: "aws-access-key", re: new RegExp("\\b(?:AKIA|ASIA)[0-9A-Z]{16}\\b"), level: "ALTO", type: "access key de AWS", fix: "desactivar en AWS IAM" },
  { rule: "slack-token", re: new RegExp("\\bxox[baprs]-[0-9A-Za-z-]{10,}\\b"), level: "ALTO", type: "token de Slack", fix: "revocar en Slack" },
  { rule: "google-oauth-secret", re: new RegExp("\\bGOCSPX-[0-9A-Za-z_-]{20,}\\b"), level: "ALTO", type: "secreto OAuth de Google", fix: "rotar en Google Cloud" },
  { rule: "anthropic-key", re: new RegExp("\\bsk-" + "ant-[A-Za-z0-9_-]{20,}\\b"), level: "ALTO", type: "API key de Anthropic", fix: "revocar en la consola" },
  { rule: "openai-key", re: new RegExp("\\bsk-(?:proj-)?[A-Za-z0-9]{32,}\\b"), level: "ALTO", type: "API key estilo OpenAI", fix: "revocar en la consola" },
];
// Contrasena literal en codigo (password: "x", pass === "x", clave = "x"). No aplica a pruebas/QA con backend ficticio.
const CODE_PASSWORD = /\b(?:password|passwd|pwd|pass|loginPass|contrasena|clave)\b\s*(?:===|!==|==|:|=)\s*["'`]([^"'`\s]{6,})["'`]/i;
const CODE_FILE = /\.(m?jsx?|cjs|tsx?|vue|svelte|html)$/i;
const TEST_PATH = /(^|\/)(scripts\/test-[^/]+|qa\/.+|tests?\/.+|fixtures?\/.+|demo\/.+|components\/demo\/.+)$/;
const PG_URL = /\bpostgres(?:ql)?:\/\/[^:\s/@'"`]+:([^@\s'"`]+)@/g;
const SENSITIVE_NAME = /(SERVICE[_-]?ROLE|SECRET|PRIVATE[_-]?KEY|PASSWORD|PASSWD|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|REFRESH[_-]?TOKEN|API[_-]?KEY|DB[_-]?PASS|JWT[_-]?SECRET|VERCEL[_-]?TOKEN|GITHUB[_-]?TOKEN|SUPABASE[_-]?ACCESS)/i;
// NOMBRE = valor (env, yaml, shell, toml, json "NOMBRE": "valor")
const ASSIGN = /^\s*(?:export\s+)?["']?([A-Za-z_][A-Za-z0-9_.-]*)["']?\s*[:=]\s*["']?([^"'\s#,}]+)/;
const ENV_LIKE = /(^|\/)(\.env[^/]*|[^/]*\.env|[^/]*\.(ya?ml|toml|ini|properties|cfg|conf|sh|bash|zsh|ps1|json))$/i;

function isPlaceholder(v) {
  const s = String(v || "").trim();
  if (s.length < 8) return true;
  // Referencia a otra variable (shell "$VAR", "${VAR}", "$(cmd)"; Actions "${{ secrets.X }}"): no es un literal.
  if (/^\$[A-Za-z_{(]/.test(s)) return true;
  if (PLACEHOLDER.test(s)) return true;
  if (/^(.)\1+$/.test(s)) return true;
  return false;
}

/** Clasifica el valor de una variable de entorno SIN devolverlo. */
export function describeEnvValue(name, value) {
  const v = String(value || "").trim();
  if (!v) return { kind: "vacia", secret: false };
  const jwt = v.match(/^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/) ? jwtRole(v) : null;
  if (jwt && jwt.role === "service_role") return { kind: "JWT Supabase service_role (privilegiada)", secret: true, level: "CRITICO" };
  if (jwt && jwt.role === "anon") return { kind: "JWT Supabase anon (publica por diseno, va en el bundle)", secret: false };
  if (jwt) return { kind: "JWT rol=" + (jwt.role || "?"), secret: true, level: "ALTO" };
  if (/^sb_secret_/.test(v)) return { kind: "clave sb_secret_ (privilegiada)", secret: true, level: "CRITICO" };
  if (/^sb_publishable_/.test(v)) return { kind: "clave sb_publishable_ (publica)", secret: false };
  if (/^https?:\/\//i.test(v)) return { kind: /supabase\.(co|in)/i.test(v) ? "URL de proyecto Supabase (no secreta, identifica el proyecto)" : "URL", secret: false };
  if (SENSITIVE_NAME.test(name) && !isPlaceholder(v)) return { kind: "valor literal en variable sensible", secret: true, level: "ALTO" };
  if (isPlaceholder(v)) return { kind: "marcador/plantilla", secret: false };
  return { kind: "valor literal (" + v.length + " caracteres)", secret: false };
}

/** @returns {Array<{line:number, rule:string, level:string, type:string, fix:string, name?:string}>} */
export function scanText(relPath, text) {
  const out = [];
  const allowHere = ALLOW_PATHS.test(String(relPath));
  const lines = String(text).split(/\r?\n/);
  const envLike = ENV_LIKE.test(relPath);
  lines.forEach((ln, i) => {
    const n = i + 1;
    const start = out.length;
    if (PK_BLOCK.test(ln)) out.push({ line: n, rule: "private-key", level: "CRITICO", type: "bloque de llave privada", fix: "quitar el archivo y rotar la llave" });
    for (const m of ln.matchAll(JWT_RE)) {
      const info = jwtRole(m[0]);
      if (!info) continue;
      if (info.role === "service_role") out.push({ line: n, fp: fingerprint(m[0]), rule: "supabase-service-role", level: "CRITICO", type: "JWT de Supabase con rol service_role (salta RLS)", fix: "rotar la clave JWT/service_role en Supabase; nunca en el frontend ni en el repo" });
      else if (info.role !== "anon" && info.role !== "authenticated") out.push({ line: n, rule: "jwt", level: "ALTO", type: "JWT (rol " + (info.role || "desconocido") + ")", fix: "revisar origen y rotar si es real" });
      else if (info.role === "authenticated") out.push({ line: n, rule: "jwt-session", level: "ALTO", type: "JWT de sesion de usuario (authenticated)", fix: "quitar; cerrar la sesion si es real" });
    }
    for (const r of TOKEN_RULES) { const m = r.re.exec(ln); if (m) out.push({ line: n, rule: r.rule, level: r.level, type: r.type, fix: r.fix, fp: fingerprint(m[0]) }); }
    if (CODE_FILE.test(relPath) && !TEST_PATH.test(relPath)) {
      const cp = CODE_PASSWORD.exec(ln);
      if (cp && !isPlaceholder(cp[1]) && !/^(text|password|email|current-password|new-password|off|on)$/i.test(cp[1])) {
        out.push({ line: n, rule: "code-password", level: "ALTO", type: "contrasena literal en el codigo", fix: "quitarla del codigo; cambiar esa contrasena en el proveedor (Supabase Auth) si fue real" });
      }
    }
    for (const m of ln.matchAll(PG_URL)) {
      if (!isPlaceholder(m[1])) out.push({ line: n, rule: "postgres-password", level: "ALTO", type: "cadena de conexion Postgres con contrasena", fix: "quitar y rotar la contrasena de la base" });
    }
    if (envLike) {
      const a = ASSIGN.exec(ln);
      if (a && SENSITIVE_NAME.test(a[1]) && !isPlaceholder(a[2]) && !/^eyJ/.test(a[2])) {
        out.push({ line: n, rule: "sensitive-assignment", level: "ALTO", type: "valor literal en variable sensible", fix: "mover a variables del entorno/secretos del proveedor", name: safeName(a[1]) });
      }
    }
    // Marca de excepcion: solo en pruebas/fixtures y nunca para CRITICOS.
    if (allowHere && ln.includes(ALLOW_MARK)) {
      for (let k = out.length - 1; k >= start; k--) if (out[k].level !== "CRITICO") out.splice(k, 1);
    }
  });
  // Un mismo hallazgo por linea y regla.
  const seen = new Set();
  return out.filter((f) => { const k = f.line + "|" + f.rule; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Nombres de variables de un archivo .env y su clasificacion (nunca el valor). */
export function describeEnvFile(text) {
  const vars = [];
  String(text).split(/\r?\n/).forEach((ln, i) => {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(ln);
    if (!m) return;
    const raw = m[2].trim().replace(/^["']|["']$/g, "");
    vars.push({ line: i + 1, name: safeName(m[1]), ...describeEnvValue(m[1], raw) });
  });
  return vars;
}

export function isBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

/** Binarios y textos grandes: solo tokens con forma inequivoca (JWT privilegiados, TOKEN_RULES, llaves), sobre latin1 y utf16le. */
export function scanOpaque(buf) {
  const out = [];
  const seen = new Set();
  for (const enc of ["latin1", "utf16le"]) {
    const t = buf.toString(enc);
    const add = (f) => { if (!seen.has(f.rule)) { seen.add(f.rule); out.push({ line: 0, ...f, type: f.type + " (dentro de un archivo binario/grande)" }); } };
    if (PK_BLOCK.test(t)) add({ rule: "private-key", level: "CRITICO", type: "bloque de llave privada", fix: "quitar el archivo y rotar la llave" });
    for (const m of t.matchAll(JWT_RE)) {
      const info = jwtRole(m[0]);
      if (info && info.role === "service_role") add({ rule: "supabase-service-role", level: "CRITICO", type: "JWT de Supabase con rol service_role", fix: "rotar en Supabase; quitar el archivo" });
      else if (info && info.role === "authenticated") add({ rule: "jwt-session", level: "ALTO", type: "JWT de sesion de usuario", fix: "quitar; cerrar la sesion si es real" });
    }
    for (const r of TOKEN_RULES) if (r.re.test(t)) add({ rule: r.rule, level: r.level, type: r.type, fix: r.fix });
  }
  return out;
}

export function scanFile(relPath, buf) {
  const findings = [];
  const pc = classifyPath(relPath);
  if (pc) findings.push({ line: 0, ...pc });
  let envVars = null;
  if (!SKIP_CONTENT.some((re) => re.test(relPath)) && buf && buf.length) {
    if (buf.length <= MAX_BYTES && !isBinary(buf)) {
      const text = buf.toString("utf8");
      findings.push(...scanText(relPath, text));
      if (pc && pc.rule === "env-file") envVars = describeEnvFile(text);
    } else if (buf.length <= MAX_BINARY_BYTES) {
      findings.push(...scanOpaque(buf));
    } else {
      findings.push({ line: 0, rule: "too-large", level: "BAJO", type: "archivo de mas de 64 MB sin revisar", fix: "no versionar archivos tan grandes (o revisarlos a mano)" });
    }
  }
  return { findings, envVars };
}

// ---------------------------------------------------------------- git
const git = (args, opts = {}) => execFileSync("git", args, { maxBuffer: 1024 * 1024 * 512, ...opts });

export class ScanError extends Error {}
function checkSpawn(res, what) {
  if (res.error || res.status !== 0) throw new ScanError(what + " fallo" + (res.error ? " (" + (res.error.code || res.error.message) + ")" : " (exit " + res.status + ")"));
}

function readBlobs(shas) {
  // git cat-file --batch: "<sha> <type> <size>\n<contenido>\n"
  if (!shas.length) return new Map();
  const res = spawnSync("git", ["cat-file", "--batch"], { input: shas.join("\n") + "\n", maxBuffer: 1024 * 1024 * 1024 });
  checkSpawn(res, "git cat-file --batch");
  const buf = res.stdout;
  const out = new Map();
  let pos = 0;
  while (pos < buf.length) {
    const nl = buf.indexOf(10, pos);
    if (nl < 0) break;
    const header = buf.slice(pos, nl).toString();
    const [sha, type, size] = header.split(" ");
    if (type === "missing") { pos = nl + 1; continue; }
    const len = Number(size);
    out.set(sha, buf.slice(nl + 1, nl + 1 + len));
    pos = nl + 1 + len + 1;
  }
  return out;
}

function listTree(staged) {
  // ls-files -s: "<mode> <sha> <stage>\t<path>"
  const raw = git(["ls-files", "-s", "-z"]).toString();
  const entries = raw.split("\0").filter(Boolean).map((l) => { const [meta, p] = l.split("\t"); return { sha: meta.split(" ")[1], path: p }; });
  if (!staged) return entries;
  const changed = new Set(git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]).toString().split("\0").filter(Boolean));
  return entries.filter((e) => changed.has(e.path));
}

function listHistory(revArgs = ["--all"]) {
  // Objetos alcanzables (todas las refs, o los NUEVOS de un rango A..B), con la ruta en que aparece cada blob.
  const raw = git(["rev-list", ...revArgs, "--objects"]).toString().split("\n");
  const byBlob = new Map();
  for (const l of raw) {
    const sp = l.indexOf(" ");
    if (sp < 0) continue;
    const sha = l.slice(0, sp), p = l.slice(sp + 1);
    if (!byBlob.has(sha)) byBlob.set(sha, new Set());
    byBlob.get(sha).add(p);
  }
  const tc = spawnSync("git", ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"], { input: [...byBlob.keys()].join("\n") + "\n", maxBuffer: 1024 * 1024 * 256 });
  checkSpawn(tc, "git cat-file --batch-check");
  const types = tc.stdout.toString().split("\n");
  const entries = [];
  for (const t of types) {
    const [sha, type, size] = t.split(" ");
    if (type !== "blob") continue;
    for (const p of byBlob.get(sha)) entries.push({ sha, path: p, size: Number(size) });
  }
  return entries;
}

function commitsForBlob(sha) {
  const out = git(["log", "--all", "--format=%h %ad", "--date=short", "--find-object=" + sha]).toString().trim().split("\n").filter(Boolean);
  return out;
}

function refsContainingCommit(commit) {
  try { return git(["for-each-ref", "--contains", commit, "--format=%(refname:short)", "refs/heads", "refs/remotes", "refs/tags"]).toString().trim().split("\n").filter(Boolean); } catch { return []; }
}

function profileDetails(baseName, buf) {
  // Solo conteos y DOMINIOS: nunca valores de cookies, usuarios ni contrasenas.
  let sqlite;
  try { sqlite = process.getBuiltinModule ? process.getBuiltinModule("node:sqlite") : null; } catch { sqlite = null; }
  if (!sqlite || !buf || buf.length < 100 || buf.slice(0, 15).toString() !== "SQLite format 3") return null;
  const dir = mkdtempSync(path.join(os.tmpdir(), "it-scan-"));
  const f = path.join(dir, "db");
  try {
    writeFileSync(f, buf, { mode: 0o600 });
    const db = new sqlite.DatabaseSync(f, { readOnly: true });
    try {
      if (baseName.startsWith("Cookies")) {
        const rows = db.prepare("SELECT COUNT(*) AS n FROM cookies").get().n;
        const hosts = db.prepare("SELECT DISTINCT host_key AS h FROM cookies ORDER BY h").all().map((r) => r.h);
        return { tabla: "cookies", filas: rows, dominios: hosts };
      }
      if (baseName.startsWith("Login Data")) {
        const rows = db.prepare("SELECT COUNT(*) AS n FROM logins").get().n;
        const origins = db.prepare("SELECT DISTINCT signon_realm AS o FROM logins ORDER BY o").all().map((r) => r.o);
        return { tabla: "logins", filas: rows, dominios: origins };
      }
    } finally { db.close(); }
  } catch (e) { return { error: "no legible como SQLite" }; }
  finally { rmSync(dir, { recursive: true, force: true }); }
  return null;
}

// ---------------------------------------------------------------- hallazgos conocidos
// scripts/security/known-findings.json: secretos REALES ya expuestos cuya correccion depende del dueno (rotar + cambio funcional).
// Cada entrada reconoce UN hallazgo exacto (ruta + regla + huella del valor): se sigue informando en cada corrida, pero no hace
// fallar el CI. Cualquier otro secreto (o el mismo valor en otra ruta) falla. Nunca contiene valores.
// SECRET_SCAN_KNOWN solo para las pruebas (repos temporales); el CI no lo define.
const KNOWN_FILE = process.env.SECRET_SCAN_KNOWN || path.join(path.dirname(fileURLToPath(import.meta.url)), "known-findings.json");
export function loadKnown(file = KNOWN_FILE) {
  if (!existsSync(file)) return [];
  const j = JSON.parse(readFileSync(file, "utf8"));
  const list = Array.isArray(j.findings) ? j.findings : [];
  for (const x of list) if (!x.path || !x.rule || !/^[0-9a-f]{16}$/.test(String(x.fingerprint || ""))) throw new ScanError("known-findings.json: entrada invalida (path, rule y fingerprint de 16 hex)");
  return list;
}

// ---------------------------------------------------------------- CLI
export function run(argv) {
  const opt = new Set(argv);
  const ri = argv.indexOf("--range");
  const range = ri >= 0 ? argv[ri + 1] : null;
  if (ri >= 0 && (!range || !/^[^\s-][^\s]*\.\.[^\s]+$/.test(range))) throw new ScanError("--range necesita A..B");
  const mode = range ? "range" : opt.has("--history") ? "history" : opt.has("--staged") ? "staged" : "tree";
  const entries = mode === "history" ? listHistory() : mode === "range" ? listHistory([range]) : listTree(mode === "staged");
  const needContent = entries.filter((e) => !SKIP_CONTENT.some((re) => re.test(e.path)) || classifyPath(e.path));
  const blobs = readBlobs([...new Set(needContent.map((e) => e.sha))]);
  const known = mode === "history" ? [] : loadKnown();
  const results = [];
  const usedKnown = new Set();
  for (const e of entries) {
    const buf = blobs.get(e.sha);
    const { findings, envVars } = scanFile(e.path, buf || Buffer.alloc(0));
    if (!findings.length) continue;
    for (const f of findings) {
      const k = known.findIndex((x) => x.path === e.path && x.rule === f.rule && f.fp && x.fingerprint === f.fp);
      if (k >= 0) { f.known = known[k]; usedKnown.add(k); }
    }
    const r = { path: e.path, blob: e.sha.slice(0, 10), findings, envVars };
    if (mode === "history") {
      const commits = commitsForBlob(e.sha);
      r.commits = commits;
      const first = commits.length ? commits[commits.length - 1].split(" ")[0] : null;
      if (first) r.refsConteniendoPrimerCommit = refsContainingCommit(first).length;
      if (opt.has("--profile-details") && findings.some((f) => f.rule === "browser-profile")) r.perfil = profileDetails(path.basename(e.path), buf);
    }
    results.push(r);
  }
  const staleKnown = mode === "tree" ? known.filter((_, i) => !usedKnown.has(i)) : [];
  return { mode, scanned: entries.length, results, staleKnown };
}

function printHuman(rep) {
  const total = rep.results.reduce((a, r) => a + r.findings.filter((f) => !f.known).length, 0);
  const knownN = rep.results.reduce((a, r) => a + r.findings.filter((f) => f.known).length, 0);
  console.log(`[secret-scan] modo=${rep.mode} · archivos/blobs revisados=${rep.scanned} · archivos con hallazgos=${rep.results.length} · hallazgos=${total}${knownN ? " · conocidos pendientes=" + knownN : ""}`);
  for (const r of rep.results) {
    for (const f of r.findings) {
      if (f.known) { console.log(`  CONOCIDO ${r.path}${f.line ? ":" + f.line : ""} · ${f.type} · PENDIENTE: ${f.known.owner_action || "accion del dueno"} (${f.known.id || "sin id"})`); continue; }
      console.log(`  ${f.level.padEnd(7)} ${r.path}${f.line ? ":" + f.line : ""} · ${f.type}${f.name ? " (variable " + f.name + ")" : ""}`);
      console.log(`          que hacer: ${f.fix}`);
    }
    if (r.envVars) for (const v of r.envVars) console.log(`          variable ${v.name} (linea ${v.line}): ${v.kind}${v.secret ? " · SECRETA" : ""}`);
    if (r.commits) console.log(`          commits que lo agregan o quitan: ${r.commits.length} (primero ${r.commits[r.commits.length - 1] || "?"}) · refs que contienen el primero: ${r.refsConteniendoPrimerCommit ?? "?"}`);
    if (r.perfil) console.log(`          perfil: ${JSON.stringify(r.perfil)}`);
  }
  if (total && rep.mode !== "history") {
    console.log("\nNo se imprime ningun valor. Corregi lo indicado antes de hacer commit/push.");
    console.log("Si es un dato FICTICIO de prueba, agrega el comentario 'secret-scan: allow' en esa linea (queda auditado en el diff).");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const argv = process.argv.slice(2);
  let rep;
  try { rep = run(argv); }
  catch (e) {
    // Nunca "0 hallazgos" si no se pudo revisar todo. El mensaje no incluye contenido de archivos.
    console.error("[secret-scan] ERROR: no se pudo completar el escaneo: " + (e instanceof ScanError ? e.message : (e && e.code) || "error de git") + ". Sin resultado valido.");
    process.exit(2);
  }
  if (argv.includes("--json")) console.log(JSON.stringify(rep, null, 2));
  else printHuman(rep);
  const total = rep.results.reduce((a, r) => a + r.findings.filter((f) => !f.known).length, 0);
  for (const k of rep.staleKnown || []) console.log(`  [secret-scan] el hallazgo conocido ${k.id || k.path} ya no aparece: quitarlo de scripts/security/known-findings.json`);
  const fail = total > 0 && (rep.mode !== "history" || argv.includes("--strict"));
  process.exit(fail ? 1 : 0);
}
