// Preparacion del entorno LOCAL: esquema inseguro reconstruido + datos ficticios + secuencia M1 -> backfill -> M2.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { assertLocalSupabaseUrl, assertLocalDb } from "./guard.mjs";
import { serviceKey } from "./keys.mjs";

export const URL_ = assertLocalSupabaseUrl(process.env.QA_SUPABASE_URL || "http://127.0.0.1:54321");
export const DB_NAME = process.env.QA_DB_NAME || "irontrack_qa";
assertLocalDb("127.0.0.1", 54322, DB_NAME);
export const root = new URL("..", import.meta.url).pathname;
export const COACH_EMAIL = "entrenador@irontrack.app"; // email fijo en el login de la app; la cuenta es LOCAL y ficticia
const pw = () => "Qa-" + randomBytes(9).toString("base64url"); // contrasenas aleatorias, solo en memoria
export const newPasswords = () => ({ coach: pw(), a: pw(), b: pw(), x: pw(), n1: pw(), n2: pw() });

export const psql = (args, input) => {
  const bin = process.env.PSQL || "psql";
  const base = ["-X", "-q", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "54322", "-U", "postgres", "-d", DB_NAME];
  const r = spawnSync(bin, [...base, ...args], { input, encoding: "utf8" });
  if (r.status !== 0) throw new Error("psql: " + (r.stderr || r.stdout));
  return r.stdout.trim();
};
export const sqlFile = (rel) => psql(["-f", root + rel]);
export const q = (sql) => psql(["-At", "-c", sql]);
export const client = (key) => createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } });
export const admin = client(serviceKey());

async function mkUser(email, password) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error("createUser " + email + ": " + error.message);
  return data.user;
}

/** beforeMigrations(): se ejecuta con el estado INICIAL (inseguro y con entrenador_principal), antes de M1/backfill/M2. */
export async function prepare(P, beforeMigrations) {
psql(["-c", "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role; TRUNCATE auth.users CASCADE"]);
sqlFile("tests/rls/00b_public_schema.sql");
const coach = await mkUser(COACH_EMAIL, P.coach);
const ua = await mkUser("alumno.a@qa.local", P.a);
const ub = await mkUser("alumno.b@qa.local", P.b);
const ux = await mkUser("ajeno@qa.local", P.x);
q(`INSERT INTO entrenadores(id,email,nombre) VALUES ('${coach.id}','${COACH_EMAIL}','Coach QA')`);
for (let i = 1; i <= 9; i++) {
  const link = i === 1 ? `'${ua.id}'` : i === 2 ? `'${ub.id}'` : "NULL";
  q(`INSERT INTO alumnos(id,nombre,email,entrenador_id,auth_uid) VALUES ('00000000-0000-0000-0000-00000000000${i}','Alumno ${i}','${i === 1 ? "alumno.a" : i === 2 ? "alumno.b" : "alumno" + i}@qa.local','entrenador_principal',${link})`);
}
q(`INSERT INTO rutinas(id,alumno_id,entrenador_id,nombre,datos) VALUES
   ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','entrenador_principal','Rutina 1','{"semana_activa":1,"days":[]}'),
   ('aaaaaaaa-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','entrenador_principal','Rutina 2','{"semana_activa":1,"days":[]}'),
   ('aaaaaaaa-0000-0000-0000-0000000000ff',NULL,'entrenador_principal','Plantilla','{"days":[]}')`);
q(`INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) VALUES
   ('00000000-0000-0000-0000-000000000001','sq',3,5,100,'2026-01-01',1),('00000000-0000-0000-0000-000000000002','sq',3,5,120,'2026-01-01',1)`);
q(`INSERT INTO config VALUES ('pagos','alias.qa')`);
q(`INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('entrenador_principal','sq','https://y.example/1')`);
q(`NOTIFY pgrst, 'reload schema'`);
await new Promise((r) => setTimeout(r, 1500));

if (beforeMigrations) await beforeMigrations({ coach, ua, ub, ux });

// ───────── Secuencia de despliegue: M1 -> backfill (variante SQL Editor) -> M2 ─────────
sqlFile("supabase/migrations/20261010110000_rls_p0_coach_principal.sql");
const bf = readFileSync(root + "sql/rls_p0_backfill_sql_editor.sql", "utf8").replace("e2447231-c0ba-4f90-946f-63bf364570af", coach.id);
const bfPath = join(tmpdir(), "irontrack-qa-backfill.sql");
writeFileSync(bfPath, bf);
psql(["-f", bfPath]);
assert.equal(q(`SELECT count(*) FROM alumnos WHERE entrenador_id='${coach.id}'`), "9", "backfill: 9 alumnos al UUID del entrenador");
assert.equal(q(`SELECT count(*) FROM alumnos WHERE entrenador_id='entrenador_principal'`), "0", "backfill: no quedan alumnos legacy");
sqlFile("supabase/migrations/20261010120000_rls_p0_lockdown.sql");
q(`NOTIFY pgrst, 'reload schema'`);
await new Promise((r) => setTimeout(r, 1500));

  return { coach, ua, ub, ux };
}
