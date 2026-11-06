// D76-09 · GO-1: prepara la base LOCAL y DESECHABLE (03_mock + 01_migracion) con el cliente pg de Node (psql está prohibido por el hook).
// Rechaza cualquier destino que no sea: PostgreSQL 17 estable, socket Unix en /tmp/it_d7609_go1/sock, sin TCP (listen_addresses=''),
// data_directory /tmp/it_d7609_go1/data y base it_d7609_test. Datos 100% ficticios (los de 03). Nunca lee credenciales ni URLs.
//   RUNNER=<dir con node_modules/pg> node 05_aplicar_local.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SOCK = "/tmp/it_d7609_go1/sock";
export const DATA = "/tmp/it_d7609_go1/data";
export const PORT = 5499;
export const DB = "it_d7609_test";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const COACH_FICTICIO = "c0000000-0000-4000-8000-000000000001";

export function cargarPg() {
  if (!process.env.RUNNER) throw new Error("falta RUNNER (directorio con node_modules/pg)");
  return createRequire(path.join(process.env.RUNNER, "package.json"))("pg");
}

// Configuración fija: NO se acepta host, URL ni credenciales del entorno.
export function config(database) {
  return { host: SOCK, port: PORT, user: "postgres", database: database, connectionTimeoutMillis: 5000 };
}

/** Verifica el aislamiento sobre una conexión abierta. Lanza si algo no coincide. Devuelve la evidencia. */
export async function verificarAislamiento(client, dbEsperada) {
  const cfg = client.connectionParameters || {};
  if (cfg.host !== SOCK || !String(cfg.host).startsWith("/")) throw new Error("AISLAMIENTO: el host no es el socket Unix local: " + cfg.host);
  const r = (await client.query(`select version() as version, current_setting('server_version') as server_version,
      current_setting('server_version_num')::int as num, current_setting('listen_addresses') as listen,
      current_setting('unix_socket_directories') as sockdir, inet_server_addr()::text as server_addr,
      current_database() as db, current_setting('data_directory') as datadir`)).rows[0];
  const fallos = [];
  if (!/^PostgreSQL 17\.\d+ /.test(r.version) || /beta|rc\d|devel/i.test(r.server_version)) fallos.push("versión no estable 17.x: " + r.version);
  if (!(r.num >= 170000 && r.num < 180000)) fallos.push("server_version_num " + r.num);
  if (r.listen !== "") fallos.push("listen_addresses='" + r.listen + "' (debe ser vacío: sin TCP)");
  if (r.server_addr !== null) fallos.push("conexión por TCP (" + r.server_addr + ")");
  if (r.sockdir !== SOCK) fallos.push("unix_socket_directories=" + r.sockdir);
  if (r.datadir !== DATA) fallos.push("data_directory=" + r.datadir);
  if (r.db !== dbEsperada) fallos.push("base " + r.db + " (se esperaba " + dbEsperada + ")");
  if (fallos.length) throw new Error("AISLAMIENTO RECHAZADO: " + fallos.join("; "));
  return r;
}

async function main() {
  const pg = cargarPg();
  // 1) Cluster (base de mantenimiento) verificado antes de cualquier SQL de escritura.
  const adm = new pg.Client(config("postgres"));
  await adm.connect();
  const ev = await verificarAislamiento(adm, "postgres");
  console.log("[aislamiento] " + ev.version);
  console.log("[aislamiento] server_version=" + ev.server_version + " listen_addresses='" + ev.listen + "' inet_server_addr=" + ev.server_addr +
              " socket=" + ev.sockdir + " data_directory=" + ev.datadir);
  await adm.query("drop database if exists " + DB);
  await adm.query("create database " + DB);
  await adm.end();

  // 2) Base desechable recién creada: verificada y vacía.
  const c = new pg.Client(config(DB));
  await c.connect();
  await verificarAislamiento(c, DB);
  const previas = Number((await c.query("select count(*) n from pg_class c join pg_namespace n on n.oid = c.relnamespace where c.relkind = 'r' and n.nspname not in ('pg_catalog','information_schema')")).rows[0].n);
  if (previas !== 0) throw new Error("la base no está vacía");
  console.log("[aislamiento] base " + DB + " vacía antes de 03");

  // 3) Mock (datos ficticios) y migración, con el UID FICTICIO del entrenador reemplazado en memoria (el archivo no se toca).
  await c.query(readFileSync(path.join(HERE, "03_mock_supabase_local.sql"), "utf8"));
  console.log("[03] mock aplicado");
  const mig = readFileSync(path.join(HERE, "..", "01_migracion_d76_09.sql"), "utf8");   // docs/d76-09/01_migracion_d76_09.sql
  const marcador = "declare v_uid uuid := '00000000-0000-0000-0000-000000000000';";
  if (mig.split(marcador).length !== 2) throw new Error("no se encontró el marcador del UID en 01");
  await c.query(mig.replace(marcador, "declare v_uid uuid := '" + COACH_FICTICIO + "';"));
  const resumen = (await c.query(`select
      (select count(*) from pg_proc where pronamespace = 'it_private'::regnamespace) as fn_privadas,
      (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'it\\_%') as rpc_publicas,
      (select count(*) from pg_trigger where not tgisinternal) as triggers,
      (select modo from it_private.config) as modo,
      (select count(*) from public.alumnos) as alumnos_ficticios,
      (select string_agg(email, ',') from auth.users) as emails`)).rows[0];
  console.log("[01] migración aplicada:", JSON.stringify(resumen));
  if (!/^[^,]*@ficticio\.test(,[^,]*@ficticio\.test)*$/.test(resumen.emails)) throw new Error("datos no ficticios");
  await c.end();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error("ERROR:", e.message, e.code ? "(" + e.code + ")" : "", e.where || ""); process.exit(1); });
}
