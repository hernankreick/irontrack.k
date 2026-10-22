#!/usr/bin/env node
// Hook PreToolUse del flujo autonomo de IronTrack. Es la barrera real (no una instruccion):
// bloquea con exit 2 cualquier operacion fuera de lo autorizado y explica el motivo por stderr.
// Entrada: JSON del hook por stdin ({ tool_name, tool_input, cwd }). Salida: exit 0 (sin objecion) o exit 2 (bloqueado).
// Prohibido sin autorizacion explicita del dueno: merge, push a main/master, deploy a Production,
// cambios en Supabase/Auth/RLS, secretos y datos reales.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const PROTECTED = ["main", "master"];

export function tokenize(cmd) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(cmd))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

// Divide una linea de shell en comandos simples (; && || | saltos de linea) y extrae subshells $( ) y backticks.
export function splitCommands(cmd) {
  const parts = [];
  const nested = [...cmd.matchAll(/\$\(([^)]*)\)|`([^`]*)`/g)].map((m) => m[1] ?? m[2]);
  for (const n of nested) parts.push(...splitCommands(n));
  for (const seg of cmd.split(/&&|\|\||[;|\n]/)) if (seg.trim()) parts.push(seg.trim());
  return parts;
}

function refTarget(ref) {
  const r = ref.replace(/^\+/, "");
  const dst = r.includes(":") ? r.split(":").pop() : r;
  return dst.replace(/^refs\/heads\//, "");
}

export function checkBash(command, { branch } = {}) {
  for (const sub of splitCommands(command)) {
    const t = tokenize(sub);
    // Ignora variables de entorno iniciales (A=b cmd) y wrappers inocuos.
    while (t.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]) || ["env", "command", "sudo", "nohup", "time", "timeout", "nice"].includes(t[0]))) t.shift();
    const bin = (t[0] || "").split("/").pop();
    const gi = bin === "git" ? t.findIndex((x, i) => i > 0 && !x.startsWith("-") && !(t[i - 1] === "-C" || t[i - 1] === "-c")) : -1;
    const sc = gi > 0 ? t[gi] : null;
    const args = gi > 0 ? t.slice(gi + 1) : [];

    if (sc === "push") {
      const flags = args.filter((a) => a.startsWith("-"));
      const pos = args.filter((a) => !a.startsWith("-"));
      if (flags.some((f) => /^(-f|--force|--force-with-lease.*|--force-if-includes|--mirror|--all|--delete|-d|--prune)$/.test(f)) || args.some((a) => /^\+/.test(a))) return "git push con force/delete/mirror/all esta prohibido";
      const refs = pos.slice(1);
      if (refs.some((r) => PROTECTED.includes(refTarget(r)))) return "push a main/master prohibido sin autorizacion explicita del dueno";
      if (refs.length === 0 && PROTECTED.includes(branch)) return "push sin rama explicita estando en main/master prohibido";
      if (refs.some((r) => r === "HEAD" || r === "@") && PROTECTED.includes(branch)) return "push de HEAD estando en main/master prohibido";
    }
    if (sc && ["commit", "merge", "rebase", "cherry-pick", "revert", "reset", "am"].includes(sc) && PROTECTED.includes(branch)) {
      return "git " + sc + " sobre main/master prohibido: trabaja en una rama feat/*, fix/* o chore/*";
    }
    if (sc === "update-ref" || (sc === "branch" && args.some((a) => /^(-D|-d|-f|-M|-m)$/.test(a)) && args.some((a) => PROTECTED.includes(a)))) return "modificar refs de main/master prohibido";
    if (sc === "remote" && ["add", "set-url", "remove", "rename"].includes(args[0])) return "cambiar remotos prohibido";

    if (bin === "gh") {
      if (t[1] === "pr" && ["merge", "ready"].includes(t[2]) && t[2] === "merge") return "gh pr merge prohibido: el merge lo autoriza el dueno";
      if (t[1] === "api" && /merge|auto_merge|deployments|workflows\/.*dispatches/i.test(sub)) return "gh api de merge/deploy prohibido";
      if (t[1] === "release" || t[1] === "secret" || t[1] === "variable") return "gh " + t[1] + " prohibido";
    }
    if (bin === "curl" || bin === "wget") {
      if (/api\.github\.com[^ ]*\/(merge|pulls\/\d+\/merge)|vercel\.com\/v\d+\/(deployments|projects|env)|supabase\.(co|com)/i.test(sub)) return "llamada de red a merge/Vercel/Supabase prohibida";
    }
    if (bin === "vercel" || /\bvercel\b/.test(bin)) {
      if (t.some((a) => /^(--prod|--production|--target=production|promote|rollback|env|link|remove|rm|alias|domains|secrets)$/.test(a))) return "vercel: despliegue a Production / variables / alias prohibido";
      if (t[1] === "deploy" || t[1] === undefined) return "deploy manual con vercel prohibido (los Preview salen del push del PR)";
    }
    if (["supabase", "psql", "pg_dump", "pg_restore"].includes(bin)) return bin + " prohibido: sin cambios en Supabase/Auth/RLS ni acceso a datos reales";
    if (["cat", "less", "more", "head", "tail", "grep", "rg", "sed", "awk", "cp", "mv", "rm", "source", "xxd", "base64", "strings", "bat", "open", "code", "nano", "vi", "vim", "tee", "dd", "echo", "printf"].includes(bin) || t.includes("<")) {
      if (t.some((a) => /(^|\/)\.env(\.[A-Za-z0-9_.-]+)?$/.test(a) && !/\.env\.example$/.test(a))) return "acceso a archivos .env prohibido (secretos)";
    }
    if (/^(printenv|env)$/.test(bin) && t.length === 1) return "volcar variables de entorno prohibido (secretos)";
    if (/(^|\s)(rm\s+-[a-zA-Z]*r[a-zA-Z]*f?\s+(\/|~|\.\.?)(\s|$))/.test(sub)) return "rm -rf sobre raiz/home/directorio actual prohibido";
  }
  return null;
}

const MERGE_TOOLS = /^mcp__github__(merge_pull_request|enable_pr_auto_merge|create_repository|fork_repository|run_secret_scanning)$/;
const WRITE_TOOLS = /^mcp__github__(push_files|create_or_update_file|delete_file)$/;

export function checkTool(name, input = {}, { branch } = {}) {
  if (name === "Bash") return checkBash(String(input.command || ""), { branch });
  if (MERGE_TOOLS.test(name)) return "herramienta de merge/auto-merge/repositorios prohibida: el merge lo autoriza el dueno";
  if (WRITE_TOOLS.test(name)) {
    const b = String(input.branch || "").replace(/^refs\/heads\//, "");
    if (!b || PROTECTED.includes(b)) return "escritura directa en main/master via API prohibida";
  }
  if (name === "mcp__github__actions_run_trigger") return "disparar workflows a mano prohibido";
  if (name === "mcp__github__pull_request_review_write" && /approve/i.test(String(input.event || ""))) return "aprobar PRs esta prohibido";
  if (/^mcp__claude-code-remote__(archive_session|create_trigger|fire_trigger|update_trigger|delete_trigger)$/.test(name)) return "gestion de sesiones/tareas programadas prohibida";
  return null;
}

function currentBranch(cwd) {
  if (process.env.GUARD_BRANCH !== undefined) return process.env.GUARD_BRANCH;
  try { return execFileSync("git", ["branch", "--show-current"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; }
}

if (import.meta.url === new URL(process.argv[1], "file:").href || process.argv[1]?.endsWith("guard.mjs")) {
  let raw = "";
  try { raw = fs.readFileSync(0, "utf8"); } catch { /* sin stdin */ }
  let ev = {};
  try { ev = JSON.parse(raw || "{}"); } catch { process.stderr.write("guard: entrada ilegible, bloqueo por seguridad\n"); process.exit(2); }
  const reason = checkTool(ev.tool_name || "", ev.tool_input || {}, { branch: currentBranch(ev.cwd || process.cwd()) });
  if (reason) { process.stderr.write("BLOQUEADO por .claude/hooks/guard.mjs: " + reason + ". Requiere autorizacion explicita del dueno; detente e informa.\n"); process.exit(2); }
  process.exit(0);
}
