// IronTrack — candado de edicion para irontrack-fixer (hook PreToolUse sobre Edit|Write|NotebookEdit).
// Solo permite editar si existe .claude/authorization/fix.json creado por la persona responsable, con:
//   { "approved_by_user": true, "id": "FIX-001", "branch": "fix/xxx", "files": ["lib/foo.js", "components/"], "allow_sql_files": false }
// y ademas: la rama actual coincide con "branch" y no es main/master, y el archivo esta en "files" (ruta exacta o carpeta terminada en "/").
// Nunca permite editar .claude/, .env*, node_modules/, .git/; sql/ y supabase/ solo con allow_sql_files:true.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const deny = (m) => { process.stderr.write("[irontrack-fix-gate] BLOQUEADO: " + m + "\n"); process.exit(2); };
let input = {};
try { input = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch (e) { deny("entrada del hook ilegible"); }
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const ti = input.tool_input || {};
const target = ti.file_path || ti.notebook_path || "";
if (!target) deny("sin ruta de archivo");
const rel = path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
if (rel.startsWith("..")) deny("ruta fuera del proyecto: " + rel);
if (/^(?:\.claude\/|\.git\/|node_modules\/|\.chrome-)/.test(rel) || /(?:^|\/)\.env(?!\.example)/.test(rel)) deny("ruta protegida: " + rel);

let auth;
try { auth = JSON.parse(fs.readFileSync(path.join(root, ".claude/authorization/fix.json"), "utf8")); }
catch (e) { deny("no hay autorizacion de correccion (.claude/authorization/fix.json). Pedila al usuario antes de editar."); }
if (auth.approved_by_user !== true || !auth.id || !auth.branch || !Array.isArray(auth.files) || !auth.files.length) deny("autorizacion incompleta o no aprobada");

let branch = "";
try { branch = execFileSync("git", ["-C", root, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim(); } catch (e) { deny("no se pudo determinar la rama"); }
if (/^(?:main|master|HEAD)$/.test(branch)) deny("no se edita en la rama " + branch + ": crear una rama aislada");
if (branch !== auth.branch) deny("rama actual '" + branch + "' distinta de la autorizada '" + auth.branch + "'");
if (/^(?:sql|supabase)\//.test(rel) && auth.allow_sql_files !== true) deny("sql/ y supabase/ requieren allow_sql_files:true explicito (y jamas se ejecutan)");
const ok = auth.files.some((f) => f.endsWith("/") ? rel.startsWith(f) : rel === f);
if (!ok) deny(rel + " no esta en la lista de archivos autorizada (" + auth.id + ")");
process.exit(0);
