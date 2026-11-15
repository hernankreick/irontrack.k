// La política permanente de QA autónomo no puede perderse ni debilitarse: está en CLAUDE.md, la referencian los agentes y el CI corre el QA de flujos críticos.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const claude = read("CLAUDE.md");
const i = claude.indexOf("## 🧪 Política permanente de QA autónomo");
ok(i > 0, "CLAUDE.md tiene la sección de la política");
const sec = claude.slice(i);
for (const frase of [
  "no es el tester habitual", "Reproduce el problema antes de tocarlo", "regresión", "fallar sin la corrección",
  "375/390/430/768", "fallos de red, latencia", "`null`, `[]`", "un único PR",
  "Regla de entrega", "Nunca** se modifica una prueba, un umbral", "aprobadas", "no ejecutadas", "limitaciones del entorno",
  "requieren dispositivo físico", "no se presenta como prueba en Safari real", "Safari físico", "no tiene gestos táctiles multitouch ni CDP",
  "scripts/qa/qa-pr194.mjs", "job `qa-demo`", "no relaja** los criterios de parada",
]) ok(sec.includes(frase), "la política menciona: " + frase);

// Cada agente del flujo la referencia, sin copiar permisos ni cambiar su definición
for (const a of ["ui-coordinator", "ui-implementer", "ui-qa", "irontrack-auditor", "irontrack-orchestrator", "pr-publisher"]) {
  const t = read(".claude/agents/" + a + ".md");
  ok(/^---\nname: /.test(t), a + ": frontmatter intacto");
  ok(t.includes("## Política permanente de QA autónomo (CLAUDE.md)"), a + ": referencia la política");
  ok(!/permissionMode|bypassPermissions/.test(t), a + ": sin permisos propios");
}
ok(/Edit|Write/.test(read(".claude/agents/ui-implementer.md").split("---")[1]), "solo el implementador sigue pudiendo editar");
ok(!/\bEdit\b|\bWrite\b/.test(read(".claude/agents/ui-qa.md").split("---")[1]), "ui-qa sigue sin poder editar");
ok(!/\bEdit\b|\bWrite\b/.test(read(".claude/agents/irontrack-auditor.md").split("---")[1]), "el auditor sigue sin poder editar");

// No se debilitaron los bloqueos del flujo (settings.json de main)
const st = JSON.parse(read(".claude/settings.json"));
for (const d of ["mcp__github__merge_pull_request", "Bash(gh pr merge*)", "Bash(git push --force*)", "Bash(supabase *)", "Bash(vercel *)", "Read(./.env)"]) ok(st.permissions.deny.includes(d), "sigue denegado: " + d);

// El CI existente corre el QA de flujos críticos (Chromium y WebKit) sin secretos
const ci = read(".github/workflows/ci.yml");
ok(/qa-demo:/.test(ci) && /scripts\/qa\/qa-pr194\.mjs/.test(ci), "el CI corre scripts/qa/qa-pr194.mjs");
ok(/matrix:\s*\n\s*browser: \[chromium, webkit\]/.test(ci), "el CI cubre Chromium y WebKit");
ok(!/secrets\.|environment:/.test(ci), "el CI sigue sin secretos ni entornos");
ok(/test-and-build:/.test(ci) && /for f in scripts\/test-\*\.mjs/.test(ci), "el job test-and-build no se tocó");
ok(read("docs/agentes-y-guards.md").includes("Política permanente de QA autónomo"), "documentada en docs/agentes-y-guards.md");

console.log("OK test-politicaQaAutonomo (" + n + " aserciones)");
