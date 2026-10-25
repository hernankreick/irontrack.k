// Simulación del estado de PRODUCCIÓN confirmado por el diagnóstico (datos 100% ficticios) en un PostgreSQL embebido (pglite). Sin red ni Supabase.
//
//   PGLITE_MODULE=<ruta al paquete @electric-sql/pglite> node tests/rls/prod-sim.mjs
//   M2_FILE=<migración B alternativa>  (opcional: probar un parche de la migración B)
//
// pglite NO es dependencia del repositorio (igual que Playwright en qa:ui): se resuelve del entorno. Sin PGLITE_MODULE la prueba queda BLOQUEADA.
// Estado reproducido: 9 alumnos (entrenador_principal) con cuenta de Auth SIN vincular; 1 cuenta de entrenador; 7 filas en `entrenadores`
// (la del entrenador + 6 de alumnos, creadas por el upsert del cliente); acceso_total; ejercicio_overrides SIN RLS; coach_notification_reads
// inexistente; 75 ejercicios personalizados y 1 override a nombre del UID del entrenador; video_overrides con entrenador_principal.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rd = (f) => readFileSync(path.isAbsolute(f) ? f : path.join(ROOT, f), "utf8");
if (!process.env.PGLITE_MODULE) { console.log("BLOQUEADA: definir PGLITE_MODULE (ruta al paquete @electric-sql/pglite); no es dependencia del repositorio"); process.exit(0); }
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE_MODULE, "dist/index.js")).href);

const M1 = rd("supabase/migrations/20261025100000_rls_p0_identity.sql");
const M2 = rd(process.env.M2_FILE || "supabase/migrations/20261025110000_rls_p0_lockdown.sql");
const COACH = "00000000-0000-0000-0000-0000000000c0";
const OTHER_COACH = "00000000-0000-0000-0000-0000000000c9";
const aid = (n) => "a000000" + n + "-0000-0000-0000-000000000000".slice(0, 28).replace(/^/, "");
const ALU = Array.from({ length: 9 }, (_, i) => ({ id: "1000000" + (i + 1) + "-1111-1111-1111-111111111111", uid: "0000000" + (i + 1) + "-0000-0000-0000-0000000000a1", email: "alumno" + (i + 1) + "@test.local" }));
const VISITOR = "00000000-0000-0000-0000-0000000000f1";

let pass = 0, fail = 0;
const ok = (c, m, extra = "") => { if (c) { pass++; console.log("PASS ", m); } else { fail++; console.log("FAIL ", m, extra); } };

async function fresh() {
  const db = new PGlite();
  let base = rd("tests/rls/00_baseline.sql").replace(/\\ir 00b_public_schema.sql/, () => rd("tests/rls/00b_public_schema.sql"));
  base = base.replace("raw_user_meta_data jsonb NOT NULL DEFAULT '{}');", "raw_user_meta_data jsonb NOT NULL DEFAULT '{}', email_confirmed_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, banned_until timestamptz);");
  await db.exec(base);
  await db.exec("CREATE SCHEMA storage; CREATE TABLE storage.buckets(name text, public boolean); DELETE FROM public.ejercicios_custom_backup_pre_fase1");
  const q = (s) => db.exec(s);
  await q(`INSERT INTO auth.users(id,email) VALUES ('${COACH}','coach0@test.local'),('${VISITOR}','visitante@test.local')`);
  for (const a of ALU) await q(`INSERT INTO auth.users(id,email) VALUES ('${a.uid}','${a.email}')`);
  for (const [i, a] of ALU.entries()) {
    await q(`INSERT INTO alumnos(id,nombre,email,entrenador_id) VALUES ('${a.id}','Alumno${i + 1}','${a.email}','entrenador_principal')`);
    await q(`INSERT INTO rutinas(alumno_id,entrenador_id,nombre,datos) VALUES ('${a.id}','entrenador_principal','R${i + 1}','{"semana_activa":1,"days":[]}')`);
    await q(`INSERT INTO progreso(alumno_id,ejercicio_id,kg,semana) VALUES ('${a.id}','sq',${100 + i},1)`);
  }
  // 7 filas en entrenadores: la del entrenador + 6 de alumnos (upsert del cliente en cada login)
  await q(`INSERT INTO entrenadores(id,email) VALUES ('${COACH}','coach0@test.local')`);
  for (const a of ALU.slice(0, 6)) await q(`INSERT INTO entrenadores(id,email) VALUES ('${a.uid}','${a.email}')`);
  await q("INSERT INTO config VALUES ('pagos','alias.test')");
  await q(`INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('entrenador_principal','e1','y1'),('entrenador_principal','e2','y2'),('entrenador_principal','e3','y3')`);
  await q(`INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('${COACH}','sq','Sentadilla')`);
  await q(`INSERT INTO ejercicios_custom(entrenador_id,name) SELECT '${COACH}', 'Custom' || g FROM generate_series(1,75) g`);
  return db;
}
const asRole = async (db, claims, role, sql) => {
  try {
    const r = await db.exec(`BEGIN; SELECT set_config('request.jwt.claims', '${JSON.stringify(claims).replace(/'/g, "''")}', true); SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`);
    const last = r[r.length - 2] || r[r.length - 1];
    return { n: last.rows.length, affected: last.affectedRows, rows: last.rows };
  } catch (e) { try { await db.exec("ROLLBACK"); } catch (_e) {} return { err: e.code || e.message }; }
};
const jwt = (uid, app = {}, usr = {}) => ({ sub: uid, role: "authenticated", app_metadata: app, user_metadata: usr });
const tryApply = async (db, sql) => { try { await db.exec(sql); return { ok: true }; } catch (e) { try { await db.exec("ROLLBACK"); } catch (_e) {} return { ok: false, msg: String(e.message) }; } };

// ---------------- Escenario 1: orden de despliegue sobre el estado real ----------------
{
  const db = await fresh();
  console.log("\n### 1. Pre-vuelos sobre el estado de producción simulado");
  ok((await tryApply(db, M1)).ok, "migración A aplica sobre el esquema de producción simulado (coach_notification_reads inexistente)");
  let r = await tryApply(db, M2);
  ok(!r.ok && /coach_accounts está vacía/.test(r.msg), "B aborta con coach_accounts vacía", r.msg);
  await db.exec(`INSERT INTO coach_accounts(uid) VALUES ('${COACH}')`);
  r = await tryApply(db, M2);
  ok(!r.ok && /9 alumnos con cuenta de Auth sin vincular/.test(r.msg), "B aborta: 9 alumnos con cuenta sin vincular (nada se modificó)", r.msg);
  ok((await db.query("SELECT count(*)::int c FROM pg_policies WHERE policyname='acceso_total'")).rows[0].c > 0, "tras el aborto las políticas previas siguen intactas (transaccional)");
  // Vinculación simulada (en producción: scripts/admin/link-alumno.mjs, una por una)
  for (const a of ALU) await db.exec(`UPDATE auth.users SET raw_app_meta_data = jsonb_build_object('alumno_id','${a.id}') WHERE id='${a.uid}'`);
  r = await tryApply(db, M2);
  ok(r.ok, "B aplica con las 9 cuentas vinculadas", r.msg);
  r = await tryApply(db, M2);
  ok(r.ok, "B es idempotente sobre el estado ya bloqueado", r.msg);

  console.log("\n### 2. Comportamiento tras el lockdown (estado de producción simulado)");
  const coach = jwt(COACH);
  const a1 = jwt(ALU[0].uid, { alumno_id: ALU[0].id });
  const a7 = jwt(ALU[6].uid, { alumno_id: ALU[6].id });
  const q = (c, role, s) => asRole(db, c, role, s);
  ok((await q(coach, "authenticated", "SELECT * FROM alumnos")).n === 9, "entrenador ve sus 9 alumnos (entrenador_principal)");
  ok((await q(coach, "authenticated", "SELECT * FROM rutinas")).n === 9, "entrenador ve las 9 rutinas");
  ok((await q(coach, "authenticated", "SELECT * FROM progreso")).n === 9, "entrenador ve el progreso de los 9");
  ok((await q(coach, "authenticated", "SELECT * FROM ejercicios_custom")).n === 75, "entrenador conserva sus 75 ejercicios personalizados (dueño = su UID)");
  ok((await q(coach, "authenticated", "SELECT * FROM ejercicio_overrides")).n === 1, "entrenador conserva su override (ahora con RLS)");
  ok((await q(coach, "authenticated", "SELECT * FROM video_overrides")).n === 3, "entrenador ve los video_overrides legacy");
  ok((await q(coach, "authenticated", "SELECT * FROM entrenadores")).n === 1, "entrenador ve solo su fila de entrenadores");
  ok((await q(coach, "authenticated", "UPDATE config SET alias='nuevo' WHERE id='pagos'")).affected === 1, "entrenador edita la config de pagos");
  ok((await q(coach, "authenticated", `INSERT INTO entrenadores(id,email) VALUES ('${COACH}','coach0@test.local') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email`)).affected === 1, "el upsert de login del entrenador funciona");
  ok((await q(coach, "authenticated", `INSERT INTO alumnos(id,nombre,email,entrenador_id) VALUES (gen_random_uuid(),'Nuevo','nuevo@test.local','entrenador_principal')`)).affected === 1, "entrenador crea alumnos");

  ok((await q(a1, "authenticated", "SELECT * FROM alumnos")).n === 1, "alumno 1 ve solo su ficha");
  ok((await q(a1, "authenticated", "SELECT * FROM rutinas")).n === 1, "alumno 1 ve solo su rutina");
  ok((await q(a1, "authenticated", "SELECT * FROM progreso")).n === 1, "alumno 1 ve solo su progreso");
  ok((await q(a1, "authenticated", "SELECT * FROM config")).n === 1, "alumno 1 lee la config de pagos");
  ok((await q(a1, "authenticated", "SELECT * FROM video_overrides")).n === 3, "alumno 1 lee los video_overrides de su entrenador (legacy)");
  ok((await q(a1, "authenticated", "SELECT * FROM ejercicios_custom")).n === 0, "alumno 1 no lee ejercicios personalizados del UID (igual que hoy: el cliente consulta entrenador_principal)");
  ok((await q(a1, "authenticated", `UPDATE rutinas SET datos = datos || '{"semana_activa":2}'`)).affected === 1, "alumno 1 avanza su semana");
  ok((await q(a1, "authenticated", `INSERT INTO progreso(alumno_id,ejercicio_id,kg,semana) VALUES ('${ALU[0].id}','bp',60,2)`)).affected === 1, "alumno 1 registra progreso propio");
  ok((await q(a1, "authenticated", `INSERT INTO progreso(alumno_id,ejercicio_id,kg,semana) VALUES ('${ALU[1].id}','bp',60,2)`)).err === "42501", "alumno 1 NO registra progreso de otro");
  ok((await q(a1, "authenticated", "SELECT * FROM entrenadores")).n === 0, "alumno 1 no lee `entrenadores` aunque tenga una fila allí");
  ok((await q(a1, "authenticated", `INSERT INTO entrenadores(id,email) VALUES ('${ALU[0].uid}','a@x') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email`)).err === "42501", "el upsert de `entrenadores` del cliente falla en silencio para alumnos (solo console.error)");
  ok((await q(a7, "authenticated", `INSERT INTO entrenadores(id,email) VALUES ('${ALU[6].uid}','a@x')`)).err === "42501", "alumno SIN fila previa tampoco puede crearse una");
  ok((await q(a1, "authenticated", `SELECT 1 WHERE public.it_is_coach()`)).n === 0, "una cuenta de alumno con fila en `entrenadores` NO es entrenador");
  ok((await q(jwt(VISITOR), "authenticated", "SELECT * FROM alumnos")).n === 0, "usuario autenticado externo no ve alumnos");
  ok((await q(jwt(VISITOR), "authenticated", "SELECT * FROM ejercicios_custom")).n === 0, "usuario autenticado externo no ve ejercicios");
  ok((await q({}, "anon", "SELECT * FROM alumnos")).err === "42501", "anon no accede a alumnos");
  ok((await q({}, "anon", "SELECT * FROM config")).err === "42501", "anon no accede a config");
  ok((await q({}, "anon", "SELECT * FROM ejercicio_overrides")).err === "42501", "anon no accede a ejercicio_overrides (antes sin RLS)");
}

// ---------------- Escenario 2: el UID dueño de los ejercicios NO está en coach_accounts ----------------
{
  const db = await fresh();
  console.log("\n### 3. Dueño de ejercicios/overrides fuera de coach_accounts (se cargó otro UID)");
  await db.exec(M1);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${OTHER_COACH}','otro@test.local'); INSERT INTO coach_accounts(uid) VALUES ('${OTHER_COACH}')`);
  for (const a of ALU) await db.exec(`UPDATE auth.users SET raw_app_meta_data = jsonb_build_object('alumno_id','${a.id}') WHERE id='${a.uid}'`);
  const r = await tryApply(db, M2);
  if (r.ok) {
    const seen = (await asRole(db, jwt(OTHER_COACH), "authenticated", "SELECT * FROM ejercicios_custom")).n;
    ok(false, "DEFECTO: B aplicó sin avisar y los 75 ejercicios personalizados (y el override) quedaron invisibles para todo entrenador (ve " + seen + ")");
  } else {
    ok(/ejercicios_custom|ejercicio_overrides/.test(r.msg) && /coach_accounts/.test(r.msg), "B aborta antes de ocultar 75 ejercicios personalizados cuyo dueño no está en coach_accounts", r.msg);
    const left = (await db.query("SELECT count(*)::int c FROM pg_policies WHERE policyname='acceso_total'")).rows[0].c;
    ok(left > 0, "el aborto no dejó cambios (transaccional)");
  }
}

// ---------------- Escenario 3: el diagnóstico (solo lectura) antes y después de vincular ----------------
{
  console.log("\n### 4. Diagnóstico de solo lectura: separación entrenador/alumno y plan de vinculación");
  const diagSql = rd("docs/rls-p0-diagnostico-readonly.sql");
  const runDiag = async (db, uids) => (await db.query(diagSql.replace(/ARRAY\[\s*--[^\n]*\n\s*\]::text\[\]/, "ARRAY[" + uids.map((u) => "'" + u + "'").join(",") + "]::text[]"))).rows;
  const by = (rows, sec, est) => rows.filter((r) => r.seccion.startsWith(sec) && (!est || r.estado === est));
  const db = await fresh();
  const before = await runDiag(db, [COACH]);
  ok(by(before, "12 plan", "REQUIERE_VINCULACION").filter((r) => r.objeto.startsWith("alumno")).length === 9, "plan: 9 alumnos listos para vincular, con correspondencia inequívoca");
  ok(by(before, "12 plan").some((r) => /--auth-id 0000000[1-9]-/.test(r.detalle) && /--confirm 1000000\d-[0-9a-f-]+:0000000\d/.test(r.detalle)), "plan: comando de a una cuenta con el token --confirm correcto");
  ok(by(before, "06 entrenadores (fila").filter((r) => r.estado === "INFO" && r.objeto !== "total filas").length === 6, "las 6 filas de `entrenadores` que son cuentas de alumnos se informan como inertes (no BLOQUEA)");
  ok(by(before, "06 entrenadores (fila").filter((r) => r.objeto === COACH)[0].estado === "OK", "la fila del entrenador de COACH_UIDS figura OK");
  ok(by(before, "00 RESUMEN", "BLOQUEA").length === 0 || by(before, "07").every((r) => r.estado !== "BLOQUEA"), "con el UID correcto los datos con dueño por UID figuran OK");
  ok(by(before, "07").filter((r) => /ejercicios_custom|ejercicio_overrides/.test(r.objeto)).every((r) => r.estado === "OK"), "ejercicios_custom y ejercicio_overrides (dueño = UID del entrenador) quedan OK");
  for (const a of ALU) await db.exec(`UPDATE auth.users SET raw_app_meta_data = jsonb_build_object('alumno_id','${a.id}') WHERE id='${a.uid}'`);
  const after = await runDiag(db, [COACH]);
  ok(by(after, "08", "OK").filter((r) => r.objeto.startsWith("alumno")).length === 9, "tras vincular: 9 alumnos OK");
  ok(by(after, "12 plan", "REQUIERE_VINCULACION").length === 0 && by(after, "00 RESUMEN", "BLOQUEA").length === 0 && by(after, "00 RESUMEN", "REQUIERE_VINCULACION").length === 0, "tras vincular: sin pendientes ni BLOQUEA (las filas inertes de `entrenadores` ya no dan falso BLOQUEA)");
  const wrong = await runDiag(db, [OTHER_COACH]);
  ok(by(wrong, "07", "BLOQUEA").length > 0, "con otro UID en COACH_UIDS, los ejercicios con dueño distinto figuran BLOQUEA");
  const coachAsAlumno = await runDiag(db, [ALU[0].uid]);
  ok(by(coachAsAlumno, "06 COACH_UIDS", "BLOQUEA").length > 0 || by(coachAsAlumno, "08", "BLOQUEA").length > 0, "una cuenta de alumno vinculada y listada como entrenador figura BLOQUEA");
  const db2 = await fresh();
  await db2.exec(`INSERT INTO alumnos(id,nombre,email,entrenador_id) VALUES ('${"1000000a-1111-1111-1111-111111111111"}','Dup','${ALU[0].email}','entrenador_principal')`);
  const dup = await runDiag(db2, [COACH]);
  ok(by(dup, "12 plan", "BLOQUEA").length >= 1 && by(dup, "12 plan", "REQUIERE_VINCULACION").filter((r) => r.objeto.startsWith("alumno")).length === 8, "email repetido en dos fichas: no se vincula (BLOQUEA)");
  const db3 = await fresh();
  const asCoach = await runDiag(db3, [COACH, ALU[2].uid]);
  ok(by(asCoach, "12 plan", "BLOQUEA").some((r) => /entrenador/.test(r.detalle)), "una cuenta de COACH_UIDS nunca entra al plan de vinculación");
}

console.log("\nRESULT prod-sim: " + pass + " pass / " + fail + " fail");
process.exit(fail ? 1 : 0);
