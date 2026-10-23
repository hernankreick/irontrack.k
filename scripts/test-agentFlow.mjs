// Flujo autonomo de agentes: definiciones de agentes, permisos de Claude Code, hook de guardia, comprobador de alcance y arnes de QA.
//
//   node scripts/test-agentFlow.mjs
//
// Sin dependencias nuevas ni red; no necesita Playwright (el QA visual se ejecuta aparte con `npm run qa:ui`).
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) {
  await fn();
  count++;
  console.log("ok - " + name);
}

function frontmatter(file) {
  const m = read(file).match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, file + ": falta el frontmatter");
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2];
  }
  return { fm, body: m[2] };
}
const toolsOf = (fm) => (fm.tools || "").split(/,(?![^(]*\))/).map((s) => s.trim()).filter(Boolean);

await test("los 4 agentes existen, tienen nombre = archivo, descripcion y un prompt con alcance", () => {
  const dir = path.join(ROOT, ".claude/agents");
  const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  // Conjunto CERRADO: los 4 agentes del flujo de UI y los 6 del sistema irontrack-* (revisados por separado en test-orchestratorAgent.mjs).
  // Cualquier otro nombre, o un irontrack-* nuevo, hace fallar esta prueba hasta que alguien lo agregue a proposito.
  const UI = ["pr-publisher.md", "ui-coordinator.md", "ui-implementer.md", "ui-qa.md"];
  const IRONTRACK = ["irontrack-auditor.md", "irontrack-data.md", "irontrack-fixer.md", "irontrack-orchestrator.md", "irontrack-qa.md", "irontrack-security.md"];
  assert.deepEqual(files, [...UI, ...IRONTRACK].sort());
  for (const f of UI) {
    const { fm, body } = frontmatter(".claude/agents/" + f);
    assert.equal(fm.name, f.replace(/\.md$/, ""));
    assert.ok(fm.description && fm.description.length > 40, f + ": descripcion");
    assert.ok(body.length > 400, f + ": prompt");
    assert.match(body, /Prohibido|NO editas|No implementas|NO implementas/i, f + ": declara limites");
  }
});

await test("el coordinador solo puede invocar a los 3 agentes del flujo y no edita archivos", () => {
  const { fm } = frontmatter(".claude/agents/ui-coordinator.md");
  const tools = toolsOf(fm);
  assert.ok(tools.includes("Agent(ui-implementer, ui-qa, pr-publisher)"), "lista de agentes invocables");
  assert.ok(!tools.some((t) => /^(Edit|Write|NotebookEdit)$/.test(t)), "sin Edit/Write");
  assert.equal(fm.memory, "local", "memoria persistente local (no se versiona)");
});

await test("separacion de funciones: QA no edita, el implementador no publica y el publicador no hace merge", () => {
  const qa = toolsOf(frontmatter(".claude/agents/ui-qa.md").fm);
  assert.ok(!qa.some((t) => /^(Edit|Write)$/.test(t)), "ui-qa sin Edit/Write");
  const impl = toolsOf(frontmatter(".claude/agents/ui-implementer.md").fm);
  assert.ok(!impl.some((t) => /^mcp__github/.test(t)), "ui-implementer sin GitHub");
  const pub = toolsOf(frontmatter(".claude/agents/pr-publisher.md").fm);
  assert.ok(pub.includes("mcp__github__create_pull_request"));
  assert.ok(!pub.some((t) => /merge|enable_pr_auto_merge|delete_file|push_files|create_or_update_file/.test(t)), "publisher sin merge ni escritura por API");
  assert.ok(!pub.some((t) => /^(Edit|Write)$/.test(t)), "publisher sin Edit/Write");
});

const settings = JSON.parse(read(".claude/settings.json"));

await test("permisos reales: deny de merge, push a main, force, Production, Supabase y .env; allow de rama/commit/push/PR", () => {
  const { allow, deny, ask } = settings.permissions;
  for (const d of ["mcp__github__merge_pull_request", "mcp__github__enable_pr_auto_merge", "Bash(gh pr merge*)", "Bash(git push * main*)", "Bash(git push --force*)", "Bash(vercel *)", "Bash(supabase *)", "Read(./.env)", "Edit(./.env)", "Edit(supabase/**)", "Edit(sql/**)"]) {
    assert.ok(deny.includes(d), "falta deny: " + d);
  }
  for (const a of ["Bash(git commit *)", "Bash(git push -u origin *)", "Bash(npm run *)", "mcp__github__create_pull_request"]) assert.ok(allow.includes(a), "falta allow: " + a);
  assert.ok(!allow.some((a) => /merge_pull_request|\.env|Bash\(\*\)|^Bash$/.test(a)), "el allow no abre merge, .env ni Bash completo");
  assert.ok(ask.includes("Edit(.claude/settings.json)") && ask.includes("Edit(.claude/hooks/**)"), "los agentes no cambian sus propios permisos sin preguntar");
});

await test("el hook de guardia esta conectado a Bash y a las herramientas MCP de GitHub y bloquea si falla", () => {
  const h = settings.hooks.PreToolUse[0];
  assert.match(h.matcher, /Bash/);
  assert.match(h.matcher, /mcp__github__/);
  assert.equal(h.hooks[0].type, "command");
  assert.equal(h.hooks[0].onFailure, "block");
  assert.match(h.hooks[0].command, /\.claude\/hooks\/guard\.mjs/);
  assert.ok(existsSync(path.join(ROOT, ".claude/hooks/guard.mjs")));
});

const { checkBash, checkTool } = await import(pathToFileURL(path.join(ROOT, ".claude/hooks/guard.mjs")).href);

await test("guard: bloquea push a main (todas las formas), force, merge, deploy a Production, Supabase y .env", () => {
  const blocked = [
    ["git push origin main", "feat/x"], ["git push origin HEAD:main", "feat/x"], ["git push origin HEAD:refs/heads/main", "feat/x"],
    ["git push -u origin master", "feat/x"], ["git push --force origin feat/x", "feat/x"], ["git push -f", "feat/x"], ["git push origin +feat/x", "feat/x"],
    ["git push --delete origin feat/x", "feat/x"], ["git push --all", "feat/x"], ["git push", "main"], ["git -C . push origin main", "feat/x"],
    ["npm run build && git push origin main", "feat/x"], ["echo $(git push origin main)", "feat/x"],
    ["git commit -m x", "main"], ["git merge origin/feat/y", "main"], ["git rebase origin/main", "master"],
    ["gh pr merge 5 --squash", "feat/x"], ["vercel --prod", "feat/x"], ["vercel deploy", "feat/x"], ["vercel env pull", "feat/x"], ["vercel promote abc", "feat/x"],
    ["supabase db push", "feat/x"], ["psql postgres://x", "feat/x"], ["cat .env", "feat/x"], ["grep KEY .env.production", "feat/x"], ["printenv", "feat/x"],
    ["curl -X PUT https://api.github.com/repos/o/r/pulls/5/merge", "feat/x"],
  ];
  for (const [cmd, branch] of blocked) assert.ok(checkBash(cmd, { branch }), "debia bloquear: " + cmd + " [" + branch + "]");
});

await test("guard: permite el trabajo normal (rama, commit, push de rama, build, tests, update con main, .env.example)", () => {
  const ok = [
    ["git switch -c feat/x origin/main", "main"], ["git status", "main"], ["git fetch origin main", "main"], ["git add components/a.jsx", "feat/x"],
    ["git commit -m 'feat: x'", "feat/x"], ["git push -u origin feat/x", "feat/x"], ["git push", "feat/x"], ["git merge origin/main", "feat/x"],
    ["npm run build", "feat/x"], ["node scripts/test-agentFlow.mjs", "feat/x"], ["npm run qa:ui", "feat/x"], ["cat .env.example", "feat/x"],
    ["VITE_SUPABASE_URL=https://mock-sb.invalid npx vite build", "feat/x"], ["git push origin feat/main-menu", "feat/x"],
  ];
  for (const [cmd, branch] of ok) assert.equal(checkBash(cmd, { branch }), null, "no debia bloquear: " + cmd);
});

await test("guard: herramientas MCP - bloquea merge/auto-merge y escritura directa en main; permite crear PR y leer", () => {
  assert.ok(checkTool("mcp__github__merge_pull_request", {}));
  assert.ok(checkTool("mcp__github__enable_pr_auto_merge", {}));
  assert.ok(checkTool("mcp__github__create_or_update_file", { branch: "main" }));
  assert.ok(checkTool("mcp__github__push_files", {}));
  assert.ok(checkTool("mcp__github__actions_run_trigger", {}));
  assert.ok(checkTool("mcp__github__pull_request_review_write", { event: "APPROVE" }));
  assert.equal(checkTool("mcp__github__create_or_update_file", { branch: "feat/x" }), null);
  assert.equal(checkTool("mcp__github__create_pull_request", {}), null);
  assert.equal(checkTool("mcp__github__pull_request_read", {}), null);
});

await test("guard como proceso: exit 2 con motivo en stderr al bloquear, exit 0 al permitir y bloqueo ante entrada ilegible", () => {
  const run = (input, branch = "feat/x") => spawnSync("node", [path.join(ROOT, ".claude/hooks/guard.mjs")], { input, encoding: "utf8", env: { ...process.env, GUARD_BRANCH: branch } });
  const bad = run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push origin main" } }));
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /BLOQUEADO/);
  assert.equal(run(JSON.stringify({ tool_name: "Bash", tool_input: { command: "git push -u origin feat/x" } })).status, 0);
  assert.equal(run("{no es json").status, 2);
});

const { classify, scanAdded } = await import(pathToFileURL(path.join(ROOT, "scripts/check-ui-scope.mjs")).href);

await test("check:scope - acepta UI y tests, rechaza logica, datos, secretos, CI y dependencias", () => {
  assert.deepEqual(classify(["components/CoachDashboard.jsx", "components/layout/AppGlobalStyles.jsx", "scripts/test-coachMobileNav.mjs", "index.css"]), { outside: [], forbidden: [] });
  const r = classify(["lib/progressInsert.js", "App.jsx", "supabase/config.toml", "sql/x.sql", ".env", ".github/workflows/ci.yml", "package.json", "docs/otro.md"]);
  assert.equal(r.forbidden.length, 7);
  assert.deepEqual(r.outside, ["docs/otro.md"]);
  assert.equal(scanAdded("+++ b/components/A.jsx\n+  const x = supabase.from('rutinas').insert(y)\n+  <div className='a'/>").length, 1);
  assert.deepEqual(scanAdded("+++ b/components/A.jsx\n+  <div style={{minHeight:44}}/>"), []);
});

await test("arnes de QA: solo datos ficticios (.invalid), host simulado y gates (overflow, errores, baseline) correctos", async () => {
  const fx = await import(pathToFileURL(path.join(ROOT, "scripts/qa/fixtures.mjs")).href);
  assert.match(fx.MOCK_HOST, /\.invalid$/);
  for (const a of fx.ALUMNOS) assert.match(a.email, /@example\.invalid$/);
  assert.equal(fx.respond({ method: "GET", table: "alumnos", search: new URLSearchParams() }).body.length, 3);
  assert.deepEqual(fx.respond({ method: "POST", table: "mensajes", search: new URLSearchParams() }).body, []);
  const { evaluate, parseArgs } = await import(pathToFileURL(path.join(ROOT, "scripts/qa/run.mjs")).href);
  const good = { section: "Dashboard", width: 375, audit: { overflow: false, small: [1], docW: 375, vw: 375 }, pageErrors: [] };
  assert.deepEqual(evaluate([good], { "Dashboard@375": 1 }), []);
  assert.equal(evaluate([{ ...good, audit: { ...good.audit, small: [1, 2] } }], { "Dashboard@375": 1 }).length, 1, "mas controles <44 que el baseline");
  assert.equal(evaluate([{ ...good, audit: { ...good.audit, overflow: true, docW: 400 } }], null).length, 1, "overflow");
  assert.equal(evaluate([{ ...good, pageErrors: ["boom"] }], null).length, 1, "errores de pagina");
  assert.deepEqual(parseArgs(["--widths", "375,390", "--no-shots"]).widths, [375, 390]);
  assert.ok(JSON.parse(read("scripts/qa/baseline.json"))["Dashboard@375"] !== undefined, "baseline versionado");
  const scripts = JSON.parse(read("package.json")).scripts;
  assert.match(scripts["qa:ui"], /scripts\/qa\/run\.mjs/);
  assert.match(scripts["qa:builds"], /scripts\/qa\/builds\.mjs/);
  assert.match(scripts["test:all"], /scripts\/run-all-tests\.mjs/);
  assert.match(scripts["check:scope"], /check-ui-scope\.mjs/);
});

await test("CLAUDE.md documenta el flujo, los criterios de parada y los comandos", () => {
  const md = read("CLAUDE.md");
  for (const k of ["Flujo autónomo", "ui-coordinator", "ui-implementer", "ui-qa", "pr-publisher", "Criterios de parada", "qa:ui", "check:scope", "claude --agent ui-coordinator"]) assert.ok(md.includes(k), "CLAUDE.md sin: " + k);
});

console.log("\n" + count + " pruebas OK");
