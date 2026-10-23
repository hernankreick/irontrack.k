// Pruebas de los guards de Bash (.claude/hooks/bash-guard.mjs y la propuesta bash-guard.next.mjs) y de la compuerta fix-gate.mjs.
// Solo inspecciona TEXTO: ejecuta los hooks con un JSON de ejemplo en stdin; NO ejecuta ninguno de los comandos de ejemplo.
//   - bash-guard.mjs (el ACTIVO): las protecciones sobre produccion y credenciales deben seguir bloqueando.
//   - bash-guard.next.mjs (PROPUESTA de falsos positivos): mismas protecciones + las menciones de texto inofensivas ya no se bloquean.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const CURRENT = ROOT + ".claude/hooks/bash-guard.mjs";
const NEXT = ROOT + ".claude/hooks/bash-guard.next.mjs";
if (!existsSync(CURRENT)) { console.log("# omitido: .claude/hooks no existe en este checkout"); process.exit(0); }

let n = 0, failed = 0;
const t = (name, fn) => { try { fn(); n++; console.log("ok -", name); } catch (e) { failed++; console.log("FAIL -", name); console.log("  " + String((e && e.message) || e).split("\n")[0]); } };

const run = (guard, mode, command) => {
  const r = spawnSync(process.execPath, [guard, mode], { input: JSON.stringify({ tool_input: { command } }), encoding: "utf8", timeout: 10000 });
  if (r.status === 2) return "block";
  return r.stdout && r.stdout.includes('"ask"') ? "ask" : "allow";
};
const HOST = "abcdefghij0123456789.supabase.co"; // ficticio

// Lo que SIEMPRE debe bloquearse, en los dos guards y en los modos global y readonly.
const PROTECT = [
  ["CLI de produccion", "supabase functions deploy x"],
  ["CLI tras &&", "echo ok && supabase db push"],
  ["CLI tras ;", "echo ok; vercel --prod"],
  ["CLI via bash -c", 'bash -c "supabase db push"'],
  ["CLI via xargs", "echo x | xargs supabase"],
  ["CLI via xargs tras grep", 'grep -rn "x" . | xargs psql'],
  ["CLI via npx", "npx supabase db push"],
  ["CLI dentro de $()", 'echo "$(supabase db push)"'],
  ["CLI dentro de $() sin comillas", "echo $(supabase db push)"],
  ["CLI dentro de backticks", "echo `supabase db push`"],
  ["CLI como argumento de rg --pre", "rg --pre 'supabase db push' x ."],
  ["heredoc ejecutado por bash", "bash <<'E'\nsupabase db push\nE"],
  ["heredoc enviado a bash por tuberia", "cat <<'E' | bash\nsupabase db push\nE"],
  ["git push con --receive-pack que ejecuta la CLI", "git push --receive-pack=\"vercel --prod\" origin rama"],
  ["comilla simple sin cerrar que oculta la CLI", "echo 'x; supabase db push"],
  ["comilla simple sin cerrar, sin separador, que oculta la CLI", "echo 'x supabase db push"],
  ["comilla simple sin cerrar tras grep", "grep 'x; vercel --prod"],
  ["texto sin cerrar (comilla abierta)", 'echo "supabase db push'],
  ["CLI no entrecomillada junto a un echo", 'echo "a" supabase db push "b"'],
  ["curl al host real", `curl https://${HOST}/rest/v1/alumnos`],
  ["curl con host entre comillas", `curl "https://${HOST}/rest/v1/alumnos"`],
  ["node con fetch al host", `node -e "fetch('https://${HOST}')"`],
  ["SQL destructivo con psql", 'psql -c "drop table alumnos"'],
  ["SQL destructivo con node", "node -e \"q('delete from alumnos')\""],
  ["SQL de RLS con node", "node -e \"q('create policy x on y')\""],
  ["leer credenciales con cat", "cat .env"],
  ["leer credenciales con grep y comillas", 'grep x ".env"'],
  ["leer credenciales con grep sin comillas", "grep -rn token .env.local"],
  ["volcado de entorno", "printenv"],
  ["eco de la clave de administracion", 'echo "$SUPABASE_SERVICE_ROLE_KEY"'],
  ["eco de la clave sin comillas", "echo $SUPABASE_SERVICE_ROLE_KEY"],
  ["clave dentro de comillas con expansion", 'grep "$SERVICE_ROLE_KEY" x'],
  ["push forzado", "git push --force origin main"],
  ["reset duro", "git reset --hard HEAD~1"],
  ["rebase", "git rebase main"],
  ["borrado recursivo peligroso", "rm -rf /"],
];
// Huecos del guard ACTIVO (descubiertos al probar): la propuesta los cierra. El guard activo no se modifica en este PR.
const GAPS = [
  ["CLI via alias de git -c (!cmd)", "git -c alias.x='!supabase db push' x"],
  ["CLI dentro de un grupo { cmd; }", "{ supabase db push; }"],
  ["CLI pegada a un = (git push --exec=CLI)", "git push --exec=supabase origin rama"],
];
// Menciones de TEXTO inofensivas: el guard actual las bloquea (falso positivo); la propuesta debe permitirlas.
const FALSE_POSITIVES = [
  ["mensaje de commit que nombra la herramienta", 'git commit -m "docs: nota sobre Supabase CLI en el README"', "ask"],
  ["URL del proyecto impresa con echo", `echo "https://${HOST}/functions/v1/x"`, "allow"],
  ["buscar service_role en el codigo (auditoria)", 'grep -rn "service_role" supabase/', "allow"],
  ["buscar SQL de RLS en sql/", 'grep -rn "alter table" sql/', "allow"],
  ["buscar texto SQL en el historial", 'git log --grep="delete from" --oneline', "allow"],
  ["buscar con rg una politica", "rg 'create policy' sql/", "allow"],
  ["heredoc de commit con texto sobre la herramienta", "git commit -F - <<'E'\nfix: nota sobre Supabase CLI y delete from en la guia\nE", "ask"],
  ["heredoc con cat que solo imprime", "cat <<'E'\nsupabase db push es la CLI\nE", "allow"],
];
// Siempre permitido (no debe volverse restrictivo).
const BENIGN = [["estado de git", "git status"], ["listar la carpeta de funciones", "ls supabase/functions"], ["ruta bajo supabase/ en git show", "git show origin/main:supabase/functions/update-alumno-password/index.ts"], ["prueba local", "node scripts/test-prRecords.mjs"]];

for (const [name, guard] of [["activo", CURRENT], ["propuesta", NEXT]]) {
  if (!existsSync(guard)) continue;
  for (const mode of ["global", "readonly"]) {
    t(`[${name}/${mode}] todas las protecciones siguen bloqueando (${PROTECT.length} casos)`, () => {
      const leaks = PROTECT.filter(([, cmd]) => run(guard, mode, cmd) !== "block").map(([l]) => l);
      assert.deepEqual(leaks, [], "no bloquea: " + leaks.join("; "));
    });
  }
  t(`[${name}] lo benigno sigue permitido en modo global`, () => {
    const bad = BENIGN.filter(([, cmd]) => run(guard, "global", cmd) === "block").map(([l]) => l);
    assert.deepEqual(bad, []);
  });
}
if (existsSync(NEXT)) {
  t("[propuesta] cierra los huecos detectados en el guard activo (alias de git con !, grupos { })", () => {
    const leaks = GAPS.filter(([, c]) => run(NEXT, "global", c) !== "block").map(([l]) => l);
    assert.deepEqual(leaks, []);
  });
  t("[propuesta] los falsos positivos por mencion de texto ya no se bloquean (modo global)", () => {
    const bad = FALSE_POSITIVES.filter(([, cmd, want]) => run(NEXT, "global", cmd) !== want).map(([l, cmd]) => l + " => " + run(NEXT, "global", cmd));
    assert.deepEqual(bad, []);
  });
  t("[propuesta] en modo readonly los patrones de busqueda (grep/rg/git log) tampoco se bloquean", () => {
    for (const [, cmd] of FALSE_POSITIVES.filter(([, c]) => /^(grep|rg|git log)/.test(c))) assert.notEqual(run(NEXT, "readonly", cmd), "block", cmd);
  });
  t("[propuesta] los comandos de escritura siguen sin pasar en readonly aunque el texto sea inofensivo", () => {
    assert.equal(run(NEXT, "readonly", 'git commit -m "x"'), "block");
    assert.equal(run(NEXT, "readonly", 'echo "x" > archivo.txt'), "block");
  });
  t("[propuesta] las reglas de .env, entorno, git destructivo y rm no se relajaron (mismo veredicto que el guard activo)", () => {
    for (const cmd of ['git commit -m "ver .env"', "cat .env", "printenv", "git push --force x", "git reset --hard", 'echo "$(printenv)"'])
      assert.equal(run(NEXT, "global", cmd), run(CURRENT, "global", cmd), cmd);
  });
  t("[propuesta] la lista ASK, el modo de solo lectura y los avisos son identicos a los del guard activo", () => {
    const a = readFileSync(CURRENT, "utf8"), b = readFileSync(NEXT, "utf8");
    const between = (src, from, to) => { const i = src.indexOf(from), j = src.indexOf(to, i); assert.ok(i >= 0 && j > i, from); return src.slice(i, j); };
    assert.equal(between(a, "const ASK = [", "const out ="), between(b, "const ASK = [", "const out ="));
    assert.equal(a.slice(a.indexOf('if (mode === "readonly"')), b.slice(b.indexOf('if (mode === "readonly"')));
  });
}

// ---- compuerta del fixer: sin autorizacion aplicable no se edita ----
const FIXGATE = ROOT + ".claude/hooks/fix-gate.mjs";
const gate = (file) => spawnSync(process.execPath, [FIXGATE], { input: JSON.stringify({ tool_input: { file_path: file } }), encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT } }).status;
t("fix-gate: rutas protegidas bloqueadas siempre (.claude, .git, node_modules, .env, fuera del proyecto)", () => {
  for (const p of [".claude/settings.json", ".claude/hooks/fix-gate.mjs", ".git/config", "node_modules/x/index.js", ".env", ".env.production", "../fuera.txt"]) assert.equal(gate(p), 2, p);
});
t("fix-gate: sin una autorizacion aprobada y vigente para la rama actual, no se edita nada", () => {
  // En un checkout limpio (CI) no hay .claude/authorization/fix.json (esta ignorado): debe bloquear.
  // En una maquina con autorizacion, esta comprobacion solo verifica rutas fuera de su alcance.
  const auth = ROOT + ".claude/authorization/fix.json";
  if (!existsSync(auth)) assert.equal(gate("lib/workoutSession.js"), 2);
  else assert.equal(gate("ruta/que/no/esta/en/ninguna/autorizacion.js"), 2);
});

console.log(n + " tests ok" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
