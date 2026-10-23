// IronTrack — guardia de comandos Bash (hook PreToolUse).
// Uso: node bash-guard.mjs <modo>   modos: global | readonly | qa | fixer
// Lee el JSON del hook por stdin. Exit 2 = bloquear. JSON permissionDecision "ask" = pedir confirmación al usuario.
// LIMITE CONOCIDO: es una inspección de texto, no un sandbox. No detecta comandos construidos con variables
// (G=git; $G push), scripts que ejecutan otros programas, ni binarios que escriban por su cuenta.
// Por eso se combina con permissions.deny/ask de settings.json y, recomendado, con el sandbox del SO.
import fs from "node:fs";

const mode = process.argv[2] || "global";
let input = {};
try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch (e) { /* sin JSON: no decidir */ }
const cmd = String((input.tool_input && input.tool_input.command) || "");
if (!cmd.trim()) process.exit(0);

const flat = cmd.replace(/["'`\\]/g, " ").replace(/\s+/g, " ");
const GIT = "\\bgit(?:\\s+(?:-[Cc]\\s+\\S+|--(?:git-dir|work-tree|namespace|exec-path)(?:=\\S+|\\s+\\S+)|--[A-Za-z-]+(?:=\\S+)?|-[A-Za-z]))*\\s+";
const git = (sub, rest = "") => new RegExp(GIT + "(?:" + sub + ")\\b" + rest, "i");

const DENY = [
  [git("push", "[^;&|\\n]*(?:--force\\b|--force-with-lease|--mirror|--delete|\\s-f\\b|\\s\\+\\S)"), "push forzado/destructivo: reescritura de historial remoto"],
  [git("reset", "[^;&|\\n]*--hard"), "git reset --hard descarta trabajo"],
  [git("clean", "[^;&|\\n]*(?:\\s-\\S*f|--force)"), "git clean -f borra archivos sin seguimiento"],
  [git("filter-branch|filter-repo|replace|update-ref|replay"), "reescritura de historial"],
  [git("rebase|commit\\s+[^;&|\\n]*--amend"), "reescritura de historial (rebase/amend)"],
  [git("reflog\\s+(?:expire|delete)|gc\\s+[^;&|\\n]*--prune|prune"), "elimina objetos recuperables"],
  [git("branch\\s+[^;&|\\n]*(?:-D\\b|--delete\\s+--force)|checkout\\s+[^;&|\\n]*--\\s|restore\\s+[^;&|\\n]*(?:--worktree|\\.)"), "descarta cambios locales"],
  [/\bgit-?filter-repo\b|\bbfg\b/i, "herramienta de purga de historial"],
  // Las cuatro reglas marcadas RELAX buscan una MENCION de texto; se relajan solo cuando esa mencion es un dato (ver relaxedView).
  // "!", "{" y "=" tambien abren una posicion de comando (alias de git "!cmd", grupos { cmd; }, opciones como --exec=cmd).
  [/(?:^|[\s;&|(\/!{=])(?:supabase|psql|pg_dump|pg_restore|pgcli|vercel|vc)(?:\s|$)/i, "CLI de Supabase/Postgres/Vercel (produccion): prohibido", "RELAX"],
  [/\bnpx\s+(?:-y\s+)?(?:supabase|vercel)\b|\bpnpm\s+dlx\s+(?:supabase|vercel)\b/i, "CLI de Supabase/Vercel via npx", "RELAX"],
  [/(?:curl|wget|http|https|fetch|nc|ncat|ssh|scp|rsync)\b[^;&|\n]*(?:supabase\.(?:co|com|in)|vercel\.(?:app|com)|api\.vercel)/i, "red hacia Supabase/Vercel reales", "RELAX"],
  [/\b(?:drop|truncate)\s+(?:table|schema|database)\b|\bdelete\s+from\b|\balter\s+table\b|\bcreate\s+policy\b|\balter\s+policy\b|\bdisable\s+row\s+level\b/i, "SQL destructivo o de RLS", "RELAX"],
  [/\brm\s+(?:-[A-Za-z]*[rRfF][A-Za-z]*\s+)+(?:\/|~|\$HOME|\.\s|\.\.|\*|\.git\b)/, "rm recursivo/forzado sobre ruta peligrosa"],
  [/(?:^|[^A-Za-z0-9_])\.env(?!\.example)(?:\.[A-Za-z]+)?(?:\s|$|["';|&)])|\.env\.(?:local|production|development|test)/, "acceso a archivos .env (credenciales)"],
  [/\b(?:printenv|set\s*\|)|(?:^|[;&|(]\s*)env(?:\s*$|\s*[|;&>])/, "volcado de variables de entorno"],
  [/SUPABASE_SERVICE_ROLE|service_role|SERVICE_ROLE_KEY/i, "referencia a la service_role key", "RELAX"],
  [/\.chrome-(?:headless|scroll-test)\b[^;&|\n]*(?:Login Data|Cookies|Web Data|History|Local Storage|Session)/i, "perfil de Chrome con posibles datos de sesion/PII"],
  [/(?:curl|wget)\b[^;&|\n]*\|\s*(?:sudo\s+)?(?:ba|z)?sh\b/i, "ejecucion remota (curl | sh)"],
];

const ASK = [
  [git("commit|push|merge|tag|pull|cherry-pick|am|stash\\s+(?:drop|clear)|rm|mv|worktree\\s+remove|remote\\s+(?:add|set-url|remove)"), "operacion git de escritura: requiere tu autorizacion explicita"],
  [/\b(?:npm|pnpm|yarn)\s+(?:install|i|add|ci|update|publish)\b/, "instalacion/publicacion de dependencias"],
  [/(?:^|[\s;&|(])(?:curl|wget)\s/, "acceso de red"],
  [/(?:^|[\s;&|(])rm\s/, "borrado de archivos"],
];

const out = (reason, code) => { process.stderr.write("[irontrack-guard] BLOQUEADO: " + reason + "\n"); process.exit(code); };
// ---- Falsos positivos por MENCION de texto (propuesta, ver docs/guards.md) ----
// Las reglas "RELAX" se evaluan sobre una vista donde los datos que solo se imprimen o se buscan (argumentos entre comillas SIN
// expansion de echo/printf/grep/rg y de git commit|log|show|diff|grep|tag, y el cuerpo de un heredoc de git commit/cat) quedan vacios.
// Nunca se relaja: lo que se ejecuta (curl, node, bash -c, xargs, psql, la CLI en posicion de comando), una comilla con $ o `...`,
// rg --pre, git -c/--exec-path, ni las reglas de .env, volcado de entorno, git destructivo o rm. Es inspeccion de texto, no un sandbox.
function stripQuoted(s) {
  let out = "", i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "'") { const j = s.indexOf("'", i + 1); if (j < 0) { out += s.slice(i); break; } out += "''"; i = j + 1; continue; }
    if (c === '"') {
      let j = i + 1;
      while (j < s.length && !(s[j] === '"' && s[j - 1] !== "\\")) j++;
      if (j >= s.length) { out += s.slice(i); break; }
      out += /[$`]/.test(s.slice(i + 1, j)) ? s.slice(i, j + 1) : '""';
      i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}
const TEXT_EXEC = new Set(["echo", "printf", "grep", "egrep", "fgrep", "rg"]);
const TEXT_GIT = new Set(["commit", "log", "show", "diff", "grep", "tag", "blame", "shortlog"]);
function words(seg) { const w = seg.trim().split(/\s+/); while (w.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(w[0])) w.shift(); return w; }
function isTextOnly(seg) {
  const w = words(seg); if (!w.length) return false;
  const first = w[0].replace(/^.*\//, "");
  if (TEXT_EXEC.has(first)) return !/(?:^|\s)--pre(?:=|\s|$)/.test(seg);
  if (first === "git") return TEXT_GIT.has(w[1] || "") && !/\s--exec-path|\s-c\s/.test(seg);
  return false;
}
function stripSafeHeredocs(c) {
  return c.replace(/^([^\n]*?)<<-?\s*(['"]?)(\w+)\2([^\n]*)\n[\s\S]*?\n[ \t]*\3[ \t]*(?=\n|$)/gm, (all, head, _q, _id, tail) => {
    const line = head + tail;
    const w = words(head);
    const first = w[0] ? w[0].replace(/^.*\//, "") : "";
    const okExec = first === "cat" || (first === "git" && w[1] === "commit");
    return okExec && !/[|;]|&&/.test(line) ? head + "<<HEREDOC" + tail : all;
  });
}
function relaxedView(c) {
  return stripSafeHeredocs(c).split(/&&|\|\||;|\||\n|&(?!>)/).map((seg) => (isTextOnly(seg) ? stripQuoted(seg) : seg)).join(" ; ");
}
const relaxed = relaxedView(cmd);
const relaxedFlat = relaxed.replace(/["'`\\]/g, " ").replace(/\s+/g, " ");
for (const [re, why, kind] of DENY) {
  if (kind === "RELAX" ? (re.test(relaxedFlat) || re.test(relaxed)) : (re.test(flat) || re.test(cmd))) out(why, 2);
}

if (mode === "readonly" || mode === "qa" || mode === "fixer") {
  if (/\$\(|`|<\(|>\(|(?<![0-9&])>|<(?!\()/.test(cmd.replace(/2>\s*\/dev\/null|2>&1|>\s*\/dev\/null/g, ""))) out("redirecciones, sustitucion de comandos o heredocs no permitidos en este agente", 2);
  const READ = new Set(["ls","cat","head","tail","wc","grep","rg","pwd","echo","stat","file","strings","sort","uniq","cut","tr","diff","basename","dirname","realpath","date","true","tree","nl","column","comm","jq"]);
  const GITREAD = /^(?:status|log|diff|show|ls-files|ls-tree|rev-parse|rev-list|blame|cat-file|shortlog|describe|remote\s+-v|branch(?:\s+(?:-a|-r|-v|-vv|--list|--show-current|--contains\s+\S+))?|config\s+--get\S*|grep|diff-tree|for-each-ref|name-rev|merge-base|count-objects)\b/;
  const segs = cmd.split(/&&|\|\||;|\||\n|&(?!>)/).map(s => s.trim()).filter(Boolean);
  for (const seg of segs) {
    const s = seg.replace(/2>\s*\/dev\/null|2>&1/g, "").trim();
    const w = s.split(/\s+/);
    const first = w[0].replace(/^.*\//, "");
    if (READ.has(first)) {
      if (first === "sed") continue;
      continue;
    }
    if (first === "sed" && /^sed\s+-n\b/.test(s) && !/\s-i|\s--in-place|\bw\s|\be\b/.test(s)) continue;
    if (first === "find" && !/-(?:exec|execdir|delete|ok|fprint|fls)\b/.test(s)) continue;
    if (first === "awk" && !/system\s*\(|getline|>\s*"|\|\s*"/.test(s)) continue;
    if (first === "git") {
      const sub = s.replace(new RegExp("^" + GIT.replace(/^\\bgit/, "git")), "").replace(/^git\s+/, "");
      if (GITREAD.test(sub)) continue;
      if ((mode === "fixer") && /^(?:checkout\s+-b|switch\s+-c|add)\b/.test(sub)) continue;
    }
    if ((mode === "qa" || mode === "fixer") && (/^node\s+scripts\/test-[A-Za-z0-9_.-]+\.mjs$/.test(s) || /^npm\s+(?:run\s+build|test)$/.test(s))) continue;
    out("comando no incluido en la lista de lectura permitida para este agente: " + w[0], 2);
  }
}

if (mode === "global" || mode === "fixer" || mode === "qa" || mode === "readonly") {
  for (const [re, why] of ASK) {
    if (re.test(flat)) {
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: "[irontrack-guard] " + why } }));
      process.exit(0);
    }
  }
}
process.exit(0);
