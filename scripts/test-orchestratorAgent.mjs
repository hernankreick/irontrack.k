// Valida la definicion del agente irontrack-orchestrator (.claude/agents/irontrack-orchestrator.md): solo lectura de archivos, sin red.
// No prueba el comportamiento del modelo (eso se comprueba ejecutando el agente); prueba que sus limites tecnicos esten bien declarados.
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const AGENTS_DIR = ROOT + ".claude/agents/";
const TEAM = ["irontrack-auditor", "irontrack-data", "irontrack-security", "irontrack-fixer", "irontrack-qa"];

let n = 0, failed = 0;
const t = (name, fn) => { try { fn(); n++; console.log("ok -", name); } catch (e) { failed++; console.log("FAIL -", name); console.log("  " + String((e && e.message) || e).split("\n")[0]); } };

function parse(file) {
  const src = readFileSync(file, "utf8");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src);
  assert.ok(m, "sin frontmatter: " + file);
  const fm = {};
  for (const line of m[1].split("\n")) { const k = /^([A-Za-z]+):\s*(.*)$/.exec(line); if (k) fm[k[1]] = k[2]; }
  return { fm, raw: m[1], body: m[2] };
}
// .claude/ esta ignorado por git: en un checkout limpio (CI) no existe y esta prueba no aplica.
if (!existsSync(AGENTS_DIR + "irontrack-orchestrator.md")) { console.log("# omitido: .claude/agents/irontrack-orchestrator.md no existe en este checkout (.claude/ no se versiona)"); process.exit(0); }
const orch = parse(AGENTS_DIR + "irontrack-orchestrator.md");
const toolNames = (s) => s.split(/,(?![^()]*\))/).map((x) => x.trim()).filter(Boolean);

t("frontmatter: name coincide con el archivo y hay descripcion", () => {
  assert.equal(orch.fm.name, "irontrack-orchestrator");
  assert.ok((orch.fm.description || "").length > 40);
});
t("los cinco agentes existentes estan definidos con su nombre", () => {
  const files = readdirSync(AGENTS_DIR);
  for (const a of TEAM) { assert.ok(files.includes(a + ".md"), "falta " + a); assert.equal(parse(AGENTS_DIR + a + ".md").fm.name, a); }
});
t("la lista blanca Agent(...) contiene exactamente a los cinco agentes y a ninguno mas", () => {
  const tools = toolNames(orch.fm.tools);
  const ag = tools.find((x) => /^Agent\(/.test(x));
  assert.ok(ag, "falta Agent(...)");
  const listed = ag.replace(/^Agent\(|\)$/g, "").split(",").map((s) => s.trim()).sort();
  assert.deepEqual(listed, [...TEAM].sort());
  assert.ok(!tools.includes("Agent"), "Agent sin lista permitiria cualquier agente");
});
t("no tiene herramientas de edicion ni de red: solo Agent, Read, Grep, Glob y Bash", () => {
  const allowed = new Set(["Read", "Grep", "Glob", "Bash"]);
  for (const x of toolNames(orch.fm.tools)) assert.ok(/^Agent\(/.test(x) || allowed.has(x), "herramienta no prevista: " + x);
  for (const bad of ["Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch"]) assert.ok(!toolNames(orch.fm.tools).includes(bad), bad);
});
t("Bash esta restringido por el hook del guard en modo readonly, y el hook existe", () => {
  assert.match(orch.raw, /matcher:\s*"Bash"/);
  assert.match(orch.raw, /bash-guard\.mjs"\s+readonly/);
  assert.ok(existsSync(ROOT + ".claude/hooks/bash-guard.mjs"));
});
t("el orquestador no puede escribir ni siquiera por el fixer sin autorizacion: el fixer conserva su compuerta", () => {
  const fixer = parse(AGENTS_DIR + "irontrack-fixer.md");
  assert.match(fixer.raw, /fix-gate\.mjs/);
  assert.ok(existsSync(ROOT + ".claude/hooks/fix-gate.mjs"));
});
t("los agentes de solo lectura y QA siguen con sus hooks de guard", () => {
  for (const a of ["irontrack-auditor", "irontrack-data", "irontrack-security"]) assert.match(parse(AGENTS_DIR + a + ".md").raw, /bash-guard\.mjs"\s+readonly/, a);
  assert.match(parse(AGENTS_DIR + "irontrack-qa.md").raw, /bash-guard\.mjs"\s+qa/);
});
t("el prompt nombra a los cinco agentes", () => { for (const a of TEAM) assert.ok(orch.body.includes("`" + a + "`"), a); });
t("el prompt prohibe, sin autorizacion, desplegar, tocar Supabase/Auth/RLS/secretos, contrasenas, commit/push/merge y .claude", () => {
  for (const re of [/Desplegar/, /Supabase/, /Auth, RLS, secretos/, /contrase/i, /git commit/, /merge/, /CLAUDE\.md/, /fix\.json/, /link-alumno/]) assert.match(orch.body, re, String(re));
});
t("el prompt exige formato unico de autorizacion y que una autorizacion no se extienda", () => {
  assert.match(orch.body, /Una sola solicitud por vez/);
  for (const k of ["Acción", "Alcance", "Riesgos"]) assert.ok(orch.body.includes(k), k);
  assert.match(orch.body, /no se extiende a otra operación/);
});
t("el prompt prohibe simular delegaciones o inventar resultados y exige informar herramientas no disponibles", () => {
  assert.match(orch.body, /No simules delegaciones/);
  assert.match(orch.body, /No inventes resultados/);
  assert.match(orch.body, /no est[aá] disponible/);
});
t("el prompt prohibe sortear controles (guard, .claude, fix.json) al reintentar", () => {
  assert.match(orch.body, /Nunca reintentes saltándote un control/);
});
t("el prompt documenta las limitaciones conocidas del entorno y prohibe esquivar el guard", () => {
  assert.match(orch.body, /Limitaciones conocidas del entorno/);
  assert.match(orch.body, /nunca\*\* lo esquives/);
  assert.match(orch.body, /node_modules\/` está versionado/);
});
t("existe la documentacion de uso del orquestador", () => {
  const d = readFileSync(ROOT + ".claude/ORQUESTADOR.md", "utf8");
  assert.match(d, /claude --agent irontrack-orchestrator/);
  for (const a of TEAM) assert.ok(d.includes(a), a);
});
t("el orquestador no figura con permisos amplios (sin permissionMode bypass/acceptEdits)", () => {
  assert.ok(!/permissionMode:\s*(bypassPermissions|acceptEdits|auto)/.test(orch.raw));
});
t("settings.json no fue debilitado: mantiene deny de merge, CLI de produccion y .env", () => {
  const s = readFileSync(ROOT + ".claude/settings.json", "utf8");
  for (const k of ["mcp__github__merge_pull_request", "Bash(supabase *)", "Bash(vercel *)", "Read(.env)", "Bash(git push --force *)"]) assert.ok(s.includes('"' + k + '"'), k);
});

console.log(n + " tests ok" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
