// Identidad remota v1: la MIGRACION REAL (docs/identidad-remota-v1/*.sql, sin modificar) ejecutada contra un PostgreSQL LOCAL descartable.
//   node scripts/test-pgIdentidadRemotaMigracion.mjs
// Esto NO es Supabase: es PostgreSQL de verdad en un socket Unix temporal (scripts/lib/pgLocal.mjs), con un esquema RECONSTRUIDO desde el
// codigo del cliente y roles/alumnos ficticios. Prueba SQL, tipos, CHECK, indices, rollback y reejecucion; NO prueba PostgREST ni el JWT de
// Supabase (eso es el paso V8 manual del runbook) ni la politica RLS real de produccion (la correccion de RLS es de otro carril).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalPg, ESQUEMA_BASE, available } from "./lib/pgLocal.mjs";

if (!available()) { console.log("# omitido: no hay PostgreSQL local (binarios initdb/postgres/psql). Esta suite NO se considera ejecutada."); process.exit(0); }

const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "identidad-remota-v1");
const rd = (f) => readFileSync(path.join(D, f), "utf8");
const PRE = rd("0_preflight.sql"), MIG = rd("1_migracion.sql"), VER = rd("2_verificacion.sql"), RB = rd("3_rollback.sql");
// Extrae el bloque "-- P7." / "-- V3." de un archivo (hasta el siguiente encabezado de bloque).
const bloque = (txt, id) => {
  const L = txt.split("\n"); const i = L.findIndex((l) => new RegExp("^-- " + id + "[. (]").test(l)); assert.ok(i >= 0, "bloque " + id);
  let j = L.findIndex((l, k) => k > i && /^-- [PV]\d+[. (]/.test(l)); if (j < 0) j = L.length;
  return L.slice(i, j).join("\n");
};
// Sentencias "select" de un bloque, una por una (cada ';' final) para poder leer su resultado.
const selects = (txt, id) => bloque(txt, id).split("\n").filter((l) => !l.startsWith("--")).join("\n").split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);

let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const pg = new LocalPg().start();
const U1 = "11111111-1111-4111-8111-111111111111", U2 = "22222222-2222-4222-8222-222222222222", U3 = "33333333-3333-4333-8333-333333333333";
const hist = (db) => pg.scalar("(select md5(string_agg(t::text, '|' order by id)) from (select id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, ciclo, created_at from public.progreso) t) || (select md5(string_agg(t::text, '|' order by id)) from (select id, alumno_id, rutina_id, rutina_nombre, dia_label, dia_idx, semana, ejercicios, fecha, hora, ciclo, created_at from public.sesiones) t)", db);
const SEED = `
insert into public.progreso (id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, ciclo, created_at) values
 ('00000000-0000-4000-8000-000000000001','al-a','sq',60,8,'','5/11/2026',0,1,'2026-11-05T10:00:01Z'),
 ('00000000-0000-4000-8000-000000000002','al-a','sq',62.5,8,'','5/11/2026',0,1,'2026-11-05T10:00:02Z'),
 ('00000000-0000-4000-8000-000000000003','al-a','bp',40,10,'x','6/11/2026',1,2,'2026-11-06T10:00:03Z'),
 ('00000000-0000-4000-8000-000000000004','al-b','sq',80,5,'','5/11/2026',0,1,'2026-11-05T11:00:04Z');
insert into public.sesiones (id, alumno_id, rutina_id, rutina_nombre, dia_label, dia_idx, semana, ejercicios, fecha, hora, ciclo, created_at) values
 ('10000000-0000-4000-8000-000000000001','al-a','r1','R','Dia 1',0,0,'sq,bp','5/11/2026','10:30',1,'2026-11-05T10:40:00Z'),
 ('10000000-0000-4000-8000-000000000002','al-a','r1','R','Dia 1',0,0,'sq,bp','5/11/2026','10:35',1,'2026-11-05T10:45:00Z'),
 ('10000000-0000-4000-8000-000000000003','al-b','r1','R','Dia 1',0,0,'sq','5/11/2026','11:30',1,'2026-11-05T11:40:00Z');
`;

// Roles a nivel de cluster una sola vez; el esquema se aplica por base (plantilla "base").
const ROLES = ESQUEMA_BASE.split("\n").find((l) => l.startsWith("create role"));
const ESQ = ESQUEMA_BASE.replace(ROLES, "");

function nuevaBase(nombre, conSeed) {
  pg.createDb(nombre); const r = pg.sql(ESQ + (conSeed ? SEED : ""), nombre); assert.ok(r.ok, r.stderr); return nombre;
}
const colsNuevas = (db) => pg.rows("select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and ((table_name='progreso' and column_name in ('sesion_uid','bloque','pos')) or (table_name='sesiones' and column_name in ('sesion_uid','identidad_v'))) order by 1,2", db);
const ins = (db, tabla, obj, o) => { const cols = Object.keys(obj); const vals = cols.map((c) => (obj[c] === null ? "null" : typeof obj[c] === "number" ? String(obj[c]) : "'" + obj[c] + "'")); return pg.tryRows("insert into public." + tabla + " (" + cols.join(",") + ") values (" + vals.join(",") + ") returning *", db, o); };
const IDS = (i) => "00000000-0000-4000-8000-0000000001" + String(i).padStart(2, "0");

const DB = "mig";
try {
  const ROLES_OK = pg.sql(ROLES, "postgres"); assert.ok(ROLES_OK.ok, ROLES_OK.stderr);
  nuevaBase(DB, true);

  await test("PREFLIGHT sobre el esquema base: los 12 bloques corren sin error y dan lo ESPERADO (tablas reales, columnas nuevas ausentes, sin triggers/vistas/RPC/publicaciones)", async () => {
    const r = pg.sql(PRE, DB); assert.ok(r.ok, "preflight completo: " + (r.error && r.error.message));
    const cnt = (id) => selects(PRE, id).map((s) => pg.rows(s, DB));
    const [p1] = cnt("P1"); assert.deepEqual(p1.map((x) => x.relkind), ["r", "r"]); assert.deepEqual(p1.map((x) => x.relname).sort(), ["progreso", "sesiones"]);
    assert.equal(cnt("P2")[0].length, 0, "columnas nuevas ausentes");
    assert.equal(cnt("P5")[0].length, 0, "sin triggers"); assert.equal(cnt("P6")[0].length, 0, "sin vistas");
    const p7 = cnt("P7"); assert.deepEqual(p7[0].map((x) => x.relrowsecurity), [true, true]); assert.deepEqual(p7[1].map((x) => x.policyname), ["acceso_total", "acceso_total"]);
    assert.equal(cnt("P9")[0].length, 0, "sin RPC que escriban"); assert.equal(cnt("P10")[0].length, 0, "sin publicaciones");
    assert.equal(cnt("P8")[1][0].grants_por_columna, 0);
    const p11 = cnt("P11")[0]; assert.equal(p11.length, 1); assert.equal(p11[0].n, 2, "duplicado historico detectado (informativo)");
    assert.ok(cnt("P4")[0].some((c) => c.conname === "progreso_pkey" && /PRIMARY KEY \(id\)/.test(c.def)));
    assert.equal(cnt("P3")[0].find((c) => c.table_name === "progreso" && c.column_name === "id").data_type, "uuid");
  });

  const antes = hist(DB);
  const polAntes = pg.rows("select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' order by 1,2", DB);

  await test("MIGRACION (pasos A, B, C) del archivo tal cual: sin errores; 5 columnas con tipo exacto, nullable y sin DEFAULT (V1)", async () => {
    const r = pg.sql(MIG, DB); assert.ok(r.ok, r.error && r.error.message + "\n" + r.stderr);
    const c = colsNuevas(DB).map((x) => x.table_name + "." + x.column_name + ":" + x.data_type + ":" + x.is_nullable + ":" + x.column_default);
    assert.deepEqual(c, ["progreso.bloque:text:YES:null", "progreso.pos:smallint:YES:null", "progreso.sesion_uid:uuid:YES:null", "sesiones.identidad_v:smallint:YES:null", "sesiones.sesion_uid:uuid:YES:null"]);
  });
  await test("sin backfill: V2 da 0 y 0, las filas historicas quedan byte a byte iguales, y V3-V7 dan lo ESPERADO", async () => {
    assert.equal(pg.rows(selects(VER, "V2")[0], DB)[0].progreso_con_identidad, 0); assert.equal(pg.rows(selects(VER, "V2")[1], DB)[0].sesiones_con_identidad, 0);
    assert.equal(hist(DB), antes, "datos historicos intactos");
    assert.equal(pg.scalar("(select count(*) from public.progreso)", DB), 4); assert.equal(pg.scalar("(select count(*) from public.sesiones)", DB), 3);
    const v3 = pg.rows(selects(VER, "V3")[0], DB); assert.equal(v3.length, 4); assert.ok(v3.every((x) => x.convalidated === true));
    assert.equal(pg.rows(selects(VER, "V4")[0], DB).length, 0, "sin FK");
    const v5 = pg.rows(selects(VER, "V5")[0], DB); assert.equal(v5.length, 2);
    assert.match(v5.find((x) => x.indexname === "sesiones_sesion_uid_uidx").indexdef, /CREATE UNIQUE INDEX .* WHERE \(sesion_uid IS NOT NULL\)/);
    assert.doesNotMatch(v5.find((x) => x.indexname === "progreso_sesion_uid_idx").indexdef, /UNIQUE/);
    assert.equal(pg.rows(selects(VER, "V6")[0], DB).length, 0, "indices validos");
    const v7 = pg.rows(selects(VER, "V7")[0], DB); assert.deepEqual(v7.map((x) => x.relrowsecurity), [true, true]);
    const polDespues = pg.rows("select tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' order by 1,2", DB);
    assert.deepEqual(polDespues, polAntes, "las politicas RLS no cambian con la migracion");
    assert.ok(pg.sql(VER, DB).ok, "2_verificacion.sql completo corre sin error");
  });
  await test("CHECK: bloque solo warmup|main, pos >= 0, bloque y pos juntos, identidad_v >= 1; valores validos aceptados; pos fuera de smallint rechazado", async () => {
    const ok = (t, o) => { const r = ins(DB, t, o); assert.ok(r.ok, JSON.stringify(o) + " => " + (r.error && r.error.message)); return r.rows[0]; };
    const mal = (t, o, nombre, code = "23514") => { const r = ins(DB, t, o); assert.equal(r.ok, false, JSON.stringify(o)); assert.equal(r.error.code, code, JSON.stringify(o) + " " + r.error.message); if (nombre) assert.match(r.error.message, new RegExp(nombre)); };
    const base = { alumno_id: "al-a", ejercicio_id: "sq", kg: 50, reps: 8 };
    ok("progreso", Object.assign({ id: IDS(1), sesion_uid: U1, bloque: "main", pos: 0 }, base)); ok("progreso", Object.assign({ id: IDS(2), sesion_uid: U1, bloque: "warmup", pos: 32767 }, base));
    ok("progreso", Object.assign({ id: IDS(3) }, base)); ok("progreso", Object.assign({ id: IDS(4), sesion_uid: U1 }, base));
    mal("progreso", Object.assign({ id: IDS(5), bloque: "x", pos: 0 }, base), "progreso_bloque_chk");
    mal("progreso", Object.assign({ id: IDS(6), bloque: "MAIN", pos: 0 }, base), "progreso_bloque_chk");
    mal("progreso", Object.assign({ id: IDS(7), bloque: "main", pos: -1 }, base), "progreso_pos_chk");
    mal("progreso", Object.assign({ id: IDS(8), pos: 3 }, base), "progreso_bloque_pos_juntos_chk");
    mal("progreso", Object.assign({ id: IDS(9), bloque: "main" }, base), "progreso_bloque_pos_juntos_chk");
    mal("progreso", Object.assign({ id: IDS(10), bloque: "main", pos: 32768 }, base), null, "22003");
    mal("progreso", Object.assign({ id: IDS(11), sesion_uid: "no-es-uuid" }, base), null, "22P02");
    ok("sesiones", { alumno_id: "al-a", sesion_uid: U1, identidad_v: 1, fecha: "5/11/2026", dia_idx: 0, semana: 0 }); ok("sesiones", { alumno_id: "al-a", fecha: "5/11/2026", dia_idx: 0, semana: 0 });
    mal("sesiones", { alumno_id: "al-a", sesion_uid: U2, identidad_v: 0 }, "sesiones_identidad_v_chk");
    ok("sesiones", { alumno_id: "al-a", sesion_uid: U3 }); // identidad_v puede quedar NULL: lo exige el cliente, no la base (decision del diseno)
  });
  await test("unicidad de sesion_uid: repetir uid => 23505 sesiones_sesion_uid_uidx (0 filas nuevas); NULL repetido, mismo dia/dia_idx con uids distintos y N series por sesion_uid permitidos", async () => {
    const antesN = pg.scalar("(select count(*) from public.sesiones)", DB);
    const r = ins(DB, "sesiones", { alumno_id: "al-a", sesion_uid: U1, identidad_v: 1, fecha: "5/11/2026" }); assert.equal(r.ok, false); assert.equal(r.error.code, "23505"); assert.match(r.error.message, /sesiones_sesion_uid_uidx/);
    assert.equal(pg.scalar("(select count(*) from public.sesiones)", DB), antesN);
    // mismo uid para OTRO alumno tambien choca (el uid es global: un UUID v4 de otro alumno no deberia repetirse)
    assert.equal(ins(DB, "sesiones", { alumno_id: "al-b", sesion_uid: U1, identidad_v: 1 }).error.code, "23505");
    assert.equal(ins(DB, "sesiones", { alumno_id: "al-a", fecha: "5/11/2026", dia_idx: 0, semana: 0 }).ok, true, "otra fila sin uid (historica) permitida");
    assert.equal(ins(DB, "sesiones", { alumno_id: "al-a", sesion_uid: "44444444-4444-4444-8444-444444444444", identidad_v: 1, fecha: "5/11/2026", dia_idx: 0, semana: 0 }).ok, true, "dos sesiones el mismo dia/dia_idx con uids distintos");
    assert.equal(pg.scalar("(select count(*) from public.progreso where sesion_uid = '" + U1 + "')", DB), 3, "series de una misma sesion comparten sesion_uid (indice NO unico)");
    // 23505 de progreso_pkey (reintento del mismo opId) sigue siendo distinguible del de sesion_uid
    const dup = ins(DB, "progreso", { id: IDS(1), alumno_id: "al-a", ejercicio_id: "sq" }); assert.equal(dup.error.code, "23505"); assert.match(dup.error.message, /progreso_pkey/);
  });
  await test("historicos: las filas previas siguen legibles, sin identidad (NULL) y con ciclo/created_at originales; un cliente antiguo (sin columnas nuevas) inserta igual", async () => {
    const h = pg.rows("select id, sesion_uid, bloque, pos, ciclo from public.progreso where id::text like '00000000-0000-4000-8000-00000000000%' order by id", DB);
    assert.equal(h.length, 4); assert.ok(h.every((x) => x.sesion_uid === null && x.bloque === null && x.pos === null)); assert.equal(h[2].ciclo, 2);
    const r = ins(DB, "progreso", { id: IDS(50), alumno_id: "al-a", ejercicio_id: "sq", kg: 70, reps: 3, fecha: "7/11/2026", semana: 0 }); assert.ok(r.ok); assert.equal(r.rows[0].sesion_uid, null);
  });

  await test("REEJECUCION: correr 1_migracion.sql otra vez no falla, no duplica objetos ni toca datos", async () => {
    const h0 = pg.scalar("(select count(*) from public.progreso)", DB);
    const snapIdx = pg.rows("select indexname, indexdef from pg_indexes where schemaname='public' order by 1", DB); const snapCons = pg.rows("select conname, convalidated, pg_get_constraintdef(oid) d from pg_constraint where conrelid in ('public.progreso'::regclass,'public.sesiones'::regclass) order by 1", DB);
    const r = pg.sql(MIG, DB); assert.ok(r.ok, r.error && r.error.message);
    assert.deepEqual(pg.rows("select indexname, indexdef from pg_indexes where schemaname='public' order by 1", DB), snapIdx);
    assert.deepEqual(pg.rows("select conname, convalidated, pg_get_constraintdef(oid) d from pg_constraint where conrelid in ('public.progreso'::regclass,'public.sesiones'::regclass) order by 1", DB), snapCons);
    assert.equal(colsNuevas(DB).length, 5); assert.equal(pg.scalar("(select count(*) from public.progreso)", DB), h0);
    assert.equal(pg.rows(selects(VER, "V6")[0], DB).length, 0);
  });

  await test("ROLLBACK (3_rollback.sql): quita columnas, CHECK e indices; los datos antiguos quedan intactos; reejecutar el rollback es seguro; un cliente con la bandera activa recibe 42703 (columna inexistente)", async () => {
    const r = pg.sql(RB, DB); assert.ok(r.ok, r.error && r.error.message);
    assert.equal(colsNuevas(DB).length, 0);
    assert.equal(pg.rows("select conname from pg_constraint where conname in ('progreso_bloque_chk','progreso_pos_chk','progreso_bloque_pos_juntos_chk','sesiones_identidad_v_chk')", DB).length, 0);
    assert.equal(pg.rows("select indexname from pg_indexes where indexname in ('sesiones_sesion_uid_uidx','progreso_sesion_uid_idx')", DB).length, 0, "los indices caen con las columnas");
    assert.equal(pg.scalar("(select md5(string_agg(t::text,'|' order by id)) from (select id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, ciclo, created_at from public.progreso where id::text like '00000000-0000-4000-8000-00000000000%') t)", DB).length, 32);
    assert.ok(pg.sql(RB, DB).ok, "rollback reejecutable");
    assert.equal(pg.scalar("(select count(*) from public.progreso where id::text like '00000000-0000-4000-8000-00000000000%')", DB), 4, "series historicas intactas");
    assert.equal(ins(DB, "progreso", { id: IDS(60), alumno_id: "al-a", ejercicio_id: "sq", sesion_uid: U1 }).error.code, "42703");
    assert.ok(ins(DB, "progreso", { id: IDS(61), alumno_id: "al-a", ejercicio_id: "sq", kg: 1, reps: 1 }).ok, "payload antiguo sigue funcionando tras el rollback");
  });
  await test("SEGUNDA MIGRACION tras el rollback: vuelve a quedar identica y verificada (V1-V6); la identidad respaldada se pierde con el rollback (documentado)", async () => {
    assert.ok(pg.sql(MIG, DB).ok); assert.equal(colsNuevas(DB).length, 5);
    assert.equal(pg.rows(selects(VER, "V6")[0], DB).length, 0); assert.equal(pg.rows(selects(VER, "V3")[0], DB).length, 4);
    assert.equal(pg.rows(selects(VER, "V2")[0], DB)[0].progreso_con_identidad, 0);
    assert.ok(ins(DB, "sesiones", { alumno_id: "al-a", sesion_uid: U1, identidad_v: 1 }).ok, "el uid ya no esta: se puede reusar tras el rollback");
  });
  await test("rollback PARCIAL (solo la unicidad): DROP INDEX CONCURRENTLY deja las columnas y permite sesion_uid repetido", async () => {
    assert.ok(pg.sql("drop index concurrently if exists public.sesiones_sesion_uid_uidx;", DB).ok);
    assert.ok(ins(DB, "sesiones", { alumno_id: "al-a", sesion_uid: U1, identidad_v: 1 }).ok); assert.equal(colsNuevas(DB).length, 5);
    pg.sql("delete from public.sesiones where sesion_uid = '" + U1 + "';", DB);
    assert.ok(pg.sql(MIG, DB).ok, "la migracion restituye el indice");
  });

  await test("CONCURRENTLY fallido (uid duplicado preexistente): deja un indice INVALIDO que V6 detecta; DROP INDEX CONCURRENTLY + reintento lo resuelve", async () => {
    const db = nuevaBase("idxfail", true);
    pg.sql("alter table public.sesiones add column sesion_uid uuid; update public.sesiones set sesion_uid = '" + U1 + "' where id in ('10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002');", db);
    const r = pg.sql("create unique index concurrently if not exists sesiones_sesion_uid_uidx on public.sesiones (sesion_uid) where sesion_uid is not null;", db);
    assert.equal(r.ok, false); assert.equal(r.error.code, "23505");
    const inval = pg.rows(selects(VER, "V6")[0], db); assert.equal(inval.length, 1); assert.equal(inval[0].indisvalid, false);
    const again = pg.sql("create unique index concurrently if not exists sesiones_sesion_uid_uidx on public.sesiones (sesion_uid) where sesion_uid is not null;", db);
    assert.ok(again.ok, "IF NOT EXISTS saltea el indice invalido: por eso el runbook exige borrarlo antes de reintentar"); assert.equal(pg.rows(selects(VER, "V6")[0], db).length, 1, "sigue invalido");
    assert.ok(pg.sql("drop index concurrently public.sesiones_sesion_uid_uidx; update public.sesiones set sesion_uid = null;", db).ok);
    assert.ok(pg.sql(MIG, db).ok); assert.equal(pg.rows(selects(VER, "V6")[0], db).length, 0);
  });

  await test("lock_timeout: con una transaccion larga sobre la tabla la migracion FALLA RAPIDO (55P03), sin cambios parciales; al liberarse, el reintento funciona", async () => {
    const db = nuevaBase("locked", true);
    const bg = pg.background("begin; lock table public.progreso in share mode; select pg_sleep(12); rollback;", db);
    await new Promise((r) => setTimeout(r, 1200));
    const t0 = Date.now(); const r = pg.sql(MIG, db); const dt = Date.now() - t0;
    assert.equal(r.ok, false); assert.equal(r.error.code, "55P03"); assert.ok(dt < 6000, "fallo en " + dt + " ms (lock_timeout 3 s)");
    assert.equal(colsNuevas(db).length, 0, "la transaccion del paso A no dejo nada a medias");
    assert.equal(pg.rows("select conname from pg_constraint where conname like '%_chk'", db).length, 0);
    pg.sql("select pg_terminate_backend(pid) from pg_stat_activity where query like '%pg_sleep(12)%' and pid <> pg_backend_pid();", db); await bg.done;
    assert.ok(pg.sql(MIG, db).ok); assert.equal(colsNuevas(db).length, 5);
  });
  await test("NOTIFY pgrst: la migracion emite 'reload schema' (se verifica el aviso, NO la recarga de un PostgREST real)", async () => {
    const db = nuevaBase("notif", true);
    const bg = pg.background("listen pgrst;\n" + "select pg_sleep(1);\n".repeat(10), db);
    await new Promise((r) => setTimeout(r, 1000));
    assert.ok(pg.sql(MIG, db).ok);
    const res = await bg.done; assert.match(res.out + res.err, /pgrst.*reload schema/s, res.out + res.err);
  });
  await test("PREFLIGHT P9 con un agregado en public (p.ej. una extension): no debe romper la consulta", async () => {
    const db = nuevaBase("p9", true);
    pg.sql("create function public.sfunc(a int, b int) returns int language sql immutable as $$ select a+b $$; create aggregate public.suma_x(int) (sfunc = int4pl, stype = int);", db);
    const r = pg.sql(bloque(PRE, "P9"), db); assert.ok(r.ok, "P9 fallo: " + (r.error && r.error.message));
  });
} finally { pg.stop(); }
console.log("\n" + n + " pruebas OK (PostgreSQL local, NO Supabase)");
