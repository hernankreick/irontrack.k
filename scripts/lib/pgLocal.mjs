// Arnes de PostgreSQL LOCAL DESCARTABLE para pruebas (NO es Supabase y NO toca ningun entorno real).
//
// Garantias de aislamiento (verificadas por scripts/test-pgLocalAislamiento.mjs):
//  - El cluster vive en un directorio temporal propio y se destruye al terminar (tambien ante excepciones/senales).
//  - listen_addresses = '' : el servidor NO abre TCP. Solo escucha en un socket Unix dentro de ese directorio.
//  - psql/initdb/pg_ctl se invocan solo desde aqui, siempre con -h <socket local absoluto>; no existe ningun parametro de host/puerto/URL.
//  - El entorno de los procesos hijos se construye desde cero (solo PATH/LANG): ninguna variable PG*, DATABASE_URL, SUPABASE_*, etc.
//    del proceso padre llega al cliente, asi que no se puede redirigir a un servidor remoto ni reutilizar credenciales.
//  - Sin binarios de PostgreSQL disponibles, available() devuelve false y las pruebas se OMITEN (nunca se simulan como si fueran reales).
// Los datos y roles (alumnos, anon/authenticated) son ficticios y se crean aqui.
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, readdirSync, chmodSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;
const OS_USER = "postgres"; // initdb/postgres se niegan a correr como root: se usa el usuario del sistema "postgres" (solo si somos root)

export function findBinDir() {
  const cands = [];
  if (process.env.IRONTRACK_PG_BIN) cands.push(process.env.IRONTRACK_PG_BIN);
  try {
    const root = "/usr/lib/postgresql";
    for (const v of readdirSync(root).sort((a, b) => Number(b) - Number(a))) cands.push(path.join(root, v, "bin"));
  } catch (e) { /* sin PostgreSQL de Debian/Ubuntu */ }
  for (const c of cands) if (existsSync(path.join(c, "initdb")) && existsSync(path.join(c, "postgres")) && existsSync(path.join(c, "psql"))) return c;
  return null;
}
export function available() { return findBinDir() !== null && (!IS_ROOT || osUserExists()); }
function osUserExists() { try { execFileSync("id", [OS_USER], { stdio: "ignore" }); return true; } catch (e) { return false; } }

const cleanEnv = () => ({ PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", LANG: "C", LC_ALL: "C", HOME: os.tmpdir() });
const wrap = (cmd, args) => (IS_ROOT ? ["runuser", ["-u", OS_USER, "--", cmd, ...args]] : [cmd, args]);

function run(cmd, args, o) {
  const [c, a] = wrap(cmd, args);
  const r = spawnSync(c, a, { input: o && o.input, encoding: "utf8", env: cleanEnv(), timeout: (o && o.timeout) || 120000, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

/** Interpreta stderr verboso de psql: { code (SQLSTATE), message, detail }. */
export function parseError(stderr) {
  const m = /ERROR:\s+([0-9A-Z]{5}):\s+(.*)/.exec(stderr || "");
  if (!m) return null;
  const d = /DETAIL:\s+(.*)/.exec(stderr);
  return { code: m[1], message: m[2].trim(), detail: d ? d[1].trim() : null, raw: stderr };
}

export class LocalPg {
  constructor() { this.dir = null; this.sock = null; this.port = String(40000 + Math.floor(Math.random() * 20000)); this.bin = findBinDir(); this.started = false; }

  start() {
    if (!this.bin) throw new Error("PostgreSQL local no disponible");
    this.dir = mkdtempSync(path.join(os.tmpdir(), "irontrack-pg-"));
    chmodSync(this.dir, 0o755);
    if (IS_ROOT) execFileSync("chown", [OS_USER + ":" + OS_USER, this.dir]);
    this.sock = path.join(this.dir, "s"); const data = path.join(this.dir, "data");
    run("mkdir", [this.sock]);
    const init = run(path.join(this.bin, "initdb"), ["-D", data, "-U", "postgres", "-A", "trust", "--no-sync", "-E", "UTF8", "--locale=C"]);
    if (init.status !== 0) { this.stop(); throw new Error("initdb fallo: " + init.stderr); }
    const opts = ["-c", "listen_addresses=", "-c", "unix_socket_directories=" + this.sock, "-p", this.port, "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off", "-c", "max_connections=30"];
    const st = run(path.join(this.bin, "pg_ctl"), ["-D", data, "-w", "-t", "60", "-l", path.join(this.dir, "pg.log"), "-o", opts.join(" "), "start"]);
    if (st.status !== 0) { const log = run("cat", [path.join(this.dir, "pg.log")]).stdout; this.stop(); throw new Error("pg_ctl start fallo: " + st.stderr + log); }
    this.started = true;
    const hook = () => { try { this.stop(); } catch (e) { /* ya detenido */ } };
    process.once("exit", hook);
    for (const sig of ["SIGINT", "SIGTERM"]) process.once(sig, () => { hook(); process.exit(130); });
    return this;
  }

  stop() {
    if (this.started) { run(path.join(this.bin, "pg_ctl"), ["-D", path.join(this.dir, "data"), "-m", "immediate", "-w", "stop"]); this.started = false; }
    if (this.dir) { try { rmSync(this.dir, { recursive: true, force: true }); } catch (e) { /* mejor esfuerzo */ } this.dir = null; }
  }

  psqlArgs(db) { return ["-X", "-q", "-A", "-t", "-h", this.sock, "-p", this.port, "-U", "postgres", "-d", db || "postgres", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose"]; }

  /** Ejecuta SQL (varias sentencias, cada una en su propio autocommit salvo BEGIN/COMMIT explicitos). Devuelve { ok, out, error }. */
  sql(text, db, o) {
    const pre = o && o.role ? "set role " + o.role + ";\n" + (o.claims ? "select set_config('request.jwt.claims', $c$" + JSON.stringify(o.claims) + "$c$, false);\n" : "") : "";
    const r = run(path.join(this.bin, "psql"), [...this.psqlArgs(db), "-f", "-"], { input: pre + text, timeout: (o && o.timeout) || 120000 });
    const error = r.status === 0 ? null : (parseError(r.stderr) || { code: "XXXXX", message: r.stderr.trim(), detail: null, raw: r.stderr });
    return { ok: r.status === 0, out: r.stdout.trim(), error, stderr: r.stderr };
  }

  /** Ejecuta un archivo .sql tal cual (p.ej. docs/identidad-remota-v1/1_migracion.sql). */
  file(file, db, o) { return this.sql(require_read(file), db, o); }

  /** SELECT/INSERT..RETURNING -> filas JSON. Lanza si falla (usar tryRows para esperar errores). */
  rows(query, db, o) {
    const r = this.tryRows(query, db, o);
    if (!r.ok) throw new Error("SQL fallo: " + r.error.code + " " + r.error.message + "\n" + query);
    return r.rows;
  }
  tryRows(query, db, o) {
    const q = query.trim().replace(/;$/, "");
    const wrapped = "with __q as (" + q + ") select coalesce(jsonb_agg(__q), '[]'::jsonb) from __q;";
    const r = this.sql(wrapped, db, o);
    if (!r.ok) return { ok: false, error: r.error, rows: [] };
    let rows = []; try { rows = JSON.parse(r.out.split("\n").filter(Boolean).pop() || "[]"); } catch (e) { return { ok: false, error: { code: "JSON", message: r.out }, rows: [] }; }
    return { ok: true, rows, error: null };
  }
  scalar(query, db, o) { const r = this.rows("select (" + query.replace(/;$/, "") + ") as v", db, o); return r[0].v; }

  createDb(name, template) { const r = this.sql('create database "' + name + '"' + (template ? ' template "' + template + '"' : "") + ";", "postgres"); if (!r.ok) throw new Error(r.stderr); }
  dropDb(name) { this.sql('drop database if exists "' + name + '" with (force);', "postgres"); }

  /** Sesion psql en segundo plano (para retener bloqueos / escuchar NOTIFY). Devuelve { done: Promise<{out,err,status}>, write, end }. */
  background(text, db) {
    const [c, a] = wrap(path.join(this.bin, "psql"), [...this.psqlArgs(db), "-f", "-"]);
    const p = spawn(c, a, { env: cleanEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    const done = new Promise((res) => p.on("close", (status) => res({ out, err, status })));
    p.stdin.end(text.endsWith("\n") ? text : text + "\n");
    return { done, write: (s) => p.stdin.write(s), end: () => p.stdin.end(), kill: () => p.kill("SIGTERM"), get out() { return out; } };
  }
}

import { readFileSync } from "node:fs";
function require_read(file) { return readFileSync(file, "utf8"); }

/** Esquema base RECONSTRUIDO desde el codigo del cliente (el DDL real de Supabase no esta versionado): sin las 5 columnas de identidad. */
export const ESQUEMA_BASE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema if not exists auth;
-- Equivalentes minimos de los helpers de Supabase (sub del JWT en request.jwt.claims).
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns text language sql stable as $$ select auth.jwt() ->> 'sub' $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create table public.progreso (
  id uuid primary key default gen_random_uuid(),
  alumno_id text not null, ejercicio_id text not null, kg numeric, reps integer, nota text default '', fecha text, semana integer,
  ciclo integer not null default 1, created_at timestamptz not null default now());
create table public.sesiones (
  id uuid primary key default gen_random_uuid(),
  alumno_id text not null, rutina_id text, rutina_nombre text, dia_label text, dia_idx integer, semana integer, ejercicios text,
  fecha text, hora text, ciclo integer not null default 1, created_at timestamptz not null default now());
create index progreso_alumno_ciclo_idx on public.progreso (alumno_id, ciclo);
create index sesiones_alumno_rutina_ciclo_idx on public.sesiones (alumno_id, rutina_id, ciclo);
alter table public.progreso enable row level security; alter table public.sesiones enable row level security;
-- Estado conocido de produccion: politica permisiva acceso_total (la correccion de RLS es de otro carril; aqui solo se replica).
create policy acceso_total on public.progreso for all using (true) with check (true);
create policy acceso_total on public.sesiones for all using (true) with check (true);
grant all on public.progreso, public.sesiones to anon, authenticated, service_role;
`;
