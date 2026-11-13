// Aislamiento del arnes de PostgreSQL local (scripts/lib/pgLocal.mjs) y vigencia de las barreras del repositorio.
//   node scripts/test-pgLocalAislamiento.mjs
// Demuestra: el servidor NO abre TCP, el cliente solo usa el socket Unix del directorio temporal, las variables PG*/DATABASE_URL/SUPABASE_*
// del entorno NO pueden redirigirlo ni aportar credenciales, el directorio se destruye al terminar, y el hook .claude/hooks/guard.mjs y los
// permisos de .claude/settings.json siguen bloqueando psql/supabase directos (el arnes NO amplia permisos en el uso normal del repo).
import assert from "node:assert/strict";
import net from "node:net";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { LocalPg, available } from "./lib/pgLocal.mjs";
import { checkBash, checkTool } from "../.claude/hooks/guard.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0; const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const SRC = readFileSync(path.join(ROOT, "scripts", "lib", "pgLocal.mjs"), "utf8");
const tcp = (port) => new Promise((res) => { const s = net.connect({ host: "127.0.0.1", port: Number(port) }); s.on("connect", () => { s.destroy(); res(true); }); s.on("error", () => res(false)); });

await test("codigo del arnes: sin parametro de host/puerto/URL externo; psql siempre con -h <socket local>; sin cadenas de conexion ni credenciales", () => {
  assert.ok(!/postgres(ql)?:\/\//i.test(SRC), "sin URLs de conexion"); assert.ok(!/process\.env\.(PG|DATABASE|SUPABASE)/.test(SRC), "no lee variables PG*/DATABASE_URL/SUPABASE_*");
  assert.ok(!/\.supabase\./i.test(SRC)); assert.ok(/"-h", this\.sock/.test(SRC)); assert.ok(/listen_addresses=/.test(SRC));
  assert.equal((SRC.match(/"-h"/g) || []).length, 1, "un unico punto donde se arma la conexion");
  assert.ok(/const cleanEnv = \(\) => \(\{ PATH:/.test(SRC), "entorno de los hijos construido desde cero");
});

await test("el hook guard.mjs sigue bloqueando psql/supabase/pg_dump directos (incluido contra un socket local o con variables de entorno) y el resto de sus reglas", () => {
  for (const c of ["psql -c 'select 1'", "psql -h /tmp/irontrack-pg-x/s -p 5432 -U postgres -c 'select 1'", "PGHOST=db.abc.supabase.co psql", "env PGHOST=evil.example psql -f x.sql", "psql postgresql://u:p@db.example.com/postgres", "pg_dump x", "supabase db push", "echo ok; psql -c 'x'", "echo $(psql -c 'x')"])
    assert.ok(checkBash(c, { branch: "feat/x" }), "debia bloquear: " + c);
  for (const c of ["git push origin main", "git push --force origin feat/x", "vercel --prod", "cat .env", "gh pr merge 1"]) assert.ok(checkBash(c, { branch: "feat/x" }), "debia seguir bloqueando: " + c);
  for (const c of ["node scripts/test-pgIdentidadRemotaMigracion.mjs", "npm run test:all", "git status"]) assert.equal(checkBash(c, { branch: "feat/x" }), null, "no debe bloquear: " + c);
  assert.ok(checkTool("mcp__github__merge_pull_request", {}, { branch: "feat/x" }));
  const r = spawnSync(process.execPath, [path.join(ROOT, ".claude", "hooks", "guard.mjs")], { input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "psql -h /tmp/s -c 'select 1'" }, cwd: ROOT }), encoding: "utf8" });
  assert.equal(r.status, 2); assert.match(r.stderr, /psql prohibido/);
});
await test("settings.json conserva la denegacion Bash(psql *) y Bash(supabase *): el arnes no concede permisos nuevos", () => {
  const s = JSON.parse(readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
  for (const d of ["Bash(psql *)", "Bash(supabase *)", "Bash(vercel *)", "Bash(git push --force*)"]) assert.ok(s.permissions.deny.includes(d), d);
  assert.ok(!s.permissions.allow.some((a) => /psql|pg_ctl|initdb|postgres/.test(a)), "ningun allow de psql/postgres");
});

if (!available()) { console.log("# omitido (parte con PostgreSQL): no hay binarios locales. Esta parte NO se considera ejecutada."); console.log("\n" + n + " pruebas OK"); process.exit(0); }

const sane = { PGHOST: "db.abcdefghij.supabase.co", PGPORT: "5432", PGUSER: "postgres", PGPASSWORD: "no-es-una-credencial", PGDATABASE: "produccion", PGSERVICEFILE: "/dev/null", DATABASE_URL: "postgresql://u:p@db.example.com:5432/postgres", SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "no-es-una-clave", PGSSLMODE: "require", PGOPTIONS: "-c search_path=evil" };
const previo = {}; for (const k of Object.keys(sane)) { previo[k] = process.env[k]; process.env[k] = sane[k]; }
const pg = new LocalPg(); let dir;
try {
  pg.start(); dir = pg.dir;
  await test("sin TCP: listen_addresses vacio, ningun puerto TCP responde y el unico acceso es el socket Unix del directorio temporal", async () => {
    assert.equal(pg.scalar("current_setting('listen_addresses')"), ""); assert.equal(await tcp(pg.port), false, "TCP local rechazado"); assert.equal(await tcp(5432), false);
    assert.ok(existsSync(path.join(pg.sock, ".s.PGSQL." + pg.port))); assert.ok(pg.sock.startsWith(dir) && dir.includes("irontrack-pg-"));
    assert.equal(pg.scalar("inet_server_addr()"), null, "conexion por socket Unix (sin direccion IP)"); assert.equal(pg.scalar("inet_client_addr()"), null);
    assert.equal(pg.scalar("current_setting('unix_socket_directories')"), pg.sock);
  });
  await test("variables de entorno hostiles (PGHOST, PGPORT, PGPASSWORD, DATABASE_URL, SUPABASE_*, PGOPTIONS...) no redirigen ni aportan credenciales: se sigue en la base local y sin esas opciones", async () => {
    assert.equal(pg.scalar("current_database()"), "postgres"); assert.equal(pg.scalar("current_user"), "postgres");
    assert.notEqual(pg.scalar("current_setting('search_path')"), "evil"); assert.match(String(pg.scalar("current_setting('data_directory')")), /irontrack-pg-/);
    assert.equal(pg.scalar("current_setting('ssl')"), "off");
    // si el entorno se reenviara, psql intentaria resolver db.abcdefghij.supabase.co / usar la contrasena: aqui conecta igual por el socket
    assert.ok(pg.sql("select 1;").ok);
  });
  await test("un VALOR con ; o \\! (texto de datos) no ejecuta nada: el SQL va por stdin a psql sin shell intermedia; y los errores SQL se devuelven sin colgar el arnes", async () => {
    pg.sql("create table t(a text); insert into t values ($$'; \\! touch /tmp/irontrack-inyeccion2 ; --$$);");
    assert.equal(existsSync("/tmp/irontrack-inyeccion2"), false); assert.equal(pg.sql("select * from tabla_inexistente;").error.code, "42P01");
  });
} finally { pg.stop(); for (const k of Object.keys(sane)) { if (previo[k] === undefined) delete process.env[k]; else process.env[k] = previo[k]; } }
await test("destruccion: al terminar no queda directorio temporal ni proceso escuchando", async () => {
  assert.equal(existsSync(dir), false); assert.equal(await tcp(pg.port), false);
});
console.log("\n" + n + " pruebas OK");
