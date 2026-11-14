// RLS v1 (docs/rls-v1/*.sql): permisos reales contra un PostgreSQL LOCAL descartable (NO Supabase Auth: el JWT se simula con request.jwt.claims; el SQL,
// las politicas, los triggers y los privilegios SI son de PostgreSQL real). Identidades ficticias: entrenador, alumnos A y B, usuario sin autorizacion,
// cuenta de alumno sin vinculo, otro entrenador y anon. Se ejecuta con ids text y uuid.
//   node scripts/test-pgRlsV1.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalPg, ESQUEMA_BASE, available } from "./lib/pgLocal.mjs";
import { esquemaApp } from "./lib/pgEsquemaApp.mjs";
import { makeRest } from "./lib/pgRest.mjs";

if (!available()) { console.log("# omitido: no hay PostgreSQL local (binarios initdb/postgres/psql). Esta suite NO se considera ejecutada."); process.exit(0); }
const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "rls-v1");
const PRE = readFileSync(path.join(D, "0_preflight.sql"), "utf8"), MIG = readFileSync(path.join(D, "1_migracion.sql"), "utf8"), VER = readFileSync(path.join(D, "2_verificacion.sql"), "utf8"), RB = readFileSync(path.join(D, "3_rollback.sql"), "utf8");
let n = 0; const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

const U = (c, i) => c.repeat(8) + "-" + c.repeat(4) + "-4" + c.repeat(3) + "-8" + c.repeat(3) + "-" + String(i).padStart(12, "0");
const C1 = U("c", 1), C2 = U("c", 2), UA = U("a", 1), UB = U("b", 1), UZ = U("f", 1), UD = U("d", 1), UC = U("e", 1);        // cuentas de Auth
const IA = U("1", 1), IB = U("2", 1), IC = U("3", 1), ID = U("4", 1);                                                         // ids de alumno
const RA = U("5", 1), RB_ = U("6", 1), RC = U("7", 1), RP = U("8", 1);                                                         // rutinas
const claims = { coach: (u) => ({ sub: u, role: "authenticated" }), alumno: (u, id) => ({ sub: u, role: "authenticated", app_metadata: { alumno_id: id } }), plano: (u) => ({ sub: u, role: "authenticated" }) };
const pg = new LocalPg().start();
const ROLES = ESQUEMA_BASE.split("\n").find((l) => l.startsWith("create role"));
const TABLAS = ["alumnos", "entrenadores", "rutinas", "sesiones", "progreso", "mensajes", "notas", "fotos", "config", "video_overrides", "ejercicio_overrides", "ejercicios_custom"];
const SEED = `
insert into auth.users (id, email, raw_app_meta_data) values ('${C1}','entrenador@irontrack.app','{}'),('${C2}','otro@coach.test','{}'),('${UA}','a@t.test','{"alumno_id":"${IA}"}'),('${UB}','b@t.test','{"alumno_id":"${IB}"}'),
  ('${UC}','c@t.test','{"alumno_id":"${IC}"}'),('${UD}','d@t.test','{}'),('${UZ}','z@t.test','{}');
insert into public.alumnos (id, nombre, email, entrenador_id) values ('${IA}','A','a@t.test','${C1}'),('${IB}','B','b@t.test','entrenador_principal'),('${IC}','C','c@t.test','${C2}'),('${ID}','D','d@t.test','${C1}');
insert into public.entrenadores (id, email, nombre) values ('${C1}','entrenador@irontrack.app','Coach 1'),('${C2}','otro@coach.test','Coach 2'),('entrenador_principal',null,'Principal');
insert into public.rutinas (id, alumno_id, entrenador_id, nombre, es_plantilla, datos) values ('${RA}','${IA}','${C1}','RA',false,'{"semana_activa":1,"days":[{"label":"x"}],"ciclo_actual":1}'),
  ('${RB_}','${IB}','${C1}','RB',false,'{"semana_activa":1}'),('${RC}','${IC}','${C2}','RC',false,'{"semana_activa":1}'),('${RP}',null,'${C1}','Plantilla',true,'{}');
insert into public.progreso (id, alumno_id, ejercicio_id, kg, reps) values ('a0000000-0000-4000-8000-000000000001','${IA}','sq',50,8),('a0000000-0000-4000-8000-000000000002','${IB}','sq',60,5),('a0000000-0000-4000-8000-000000000003','${IC}','sq',70,3);
insert into public.sesiones (id, alumno_id, rutina_id, dia_idx, semana, fecha) values ('b0000000-0000-4000-8000-000000000001','${IA}','${RA}',0,1,'5/11/2026'),('b0000000-0000-4000-8000-000000000002','${IB}','${RB_}',0,1,'5/11/2026'),('b0000000-0000-4000-8000-000000000003','${IC}','${RC}',0,1,'5/11/2026');
insert into public.mensajes (id, alumno_id, de_entrenador, leido, texto) values ('c0000000-0000-4000-8000-000000000001','${IA}',true,false,'hola A'),('c0000000-0000-4000-8000-000000000002','${IA}',false,false,'resp A'),('c0000000-0000-4000-8000-000000000003','${IB}',true,false,'hola B');
insert into public.notas (id, alumno_id, texto) values ('d0000000-0000-4000-8000-000000000001','${IA}','nota A'),('d0000000-0000-4000-8000-000000000002','${IB}','nota B');
insert into public.fotos (id, alumno_id, url) values ('e0000000-0000-4000-8000-000000000001','${IA}','fa'),('e0000000-0000-4000-8000-000000000002','${IB}','fb');
insert into public.config (id, alias) values ('pagos','alias.coach');
insert into public.video_overrides (id, entrenador_id, ejercicio_id, youtube_url) values ('f0000000-0000-4000-8000-000000000001','${C1}','sq','u1'),('f0000000-0000-4000-8000-000000000002','${C2}','sq','u2'),('f0000000-0000-4000-8000-000000000003','entrenador_principal','bp','up');
insert into public.ejercicio_overrides (entrenador_id, ejercicio_id, name) values ('${C1}','sq','Sent C1'),('${C2}','sq','Sent C2');
insert into public.ejercicios_custom (id, entrenador_id, nombre) values ('90000000-0000-4000-8000-000000000001','${C1}','custom 1'),('90000000-0000-4000-8000-000000000002','${C2}','custom 2');
`;
const ids = (r) => { assert.ok(r.ok, JSON.stringify(r.data)); return r.data.map((x) => x.id).sort(); };
const last = (s) => s.slice(-2);
const solo = (r, esperado, msg) => assert.deepEqual(ids(r), esperado.slice().sort(), msg);
const denegado = (r, msg) => { assert.equal(r.ok, false, msg + " => " + JSON.stringify(r.data)); assert.ok(["42501"].includes(r.data.code), msg + " " + r.data.code + " " + r.data.message); };
const sin_filas = (r, msg) => { assert.ok(r.ok, msg + " " + JSON.stringify(r.data)); assert.equal(r.data.length, 0, msg + ": " + JSON.stringify(r.data)); };

pg.sql(ROLES, "postgres");
for (const idType of ["text", "uuid"]) {
  const tpl = "tpl_" + idType;
  pg.createDb(tpl); assert.ok(pg.sql(ESQUEMA_BASE.replace(ROLES, "") + esquemaApp(idType), tpl).ok, "esquema " + idType);
  let k = 0; const nueva = (migrar, padron = [C1, C2], migSql = MIG) => {
    const db = idType + "_" + (++k); pg.createDb(db, tpl); const r0 = pg.sql(SEED, db); assert.ok(r0.ok, r0.stderr);
    if (migrar) { pg.sql("create schema if not exists it_authz; create table if not exists it_authz.entrenadores_autorizados (uid uuid primary key, nota text, created_at timestamptz not null default now());" + padron.map((u) => "insert into it_authz.entrenadores_autorizados (uid) values ('" + u + "');").join(""), db); const m = pg.sql(migSql, db); assert.ok(m.ok, m.error && m.error.message + m.stderr); }
    return db;
  };
  const como = (db, who) => makeRest(pg, db, who === "anon" ? { role: "anon" } : { claims: who });

  await test("[" + idType + "] ANTES (estado actual acceso_total): cualquier usuario autenticado y hasta anon lee y escribe datos de otro alumno = la brecha que se corrige", async () => {
    const db = nueva(false);
    solo(await como(db, claims.alumno(UA, IA)).get("progreso?select=id"), ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002", "a0000000-0000-4000-8000-000000000003"], "A ve todo");
    assert.ok((await como(db, claims.plano(UZ)).get("alumnos?select=id")).data.length === 4, "un usuario cualquiera ve todos los alumnos");
    assert.equal((await como(db, "anon").get("alumnos?select=id")).data.length, 4, "anon tambien");
    assert.equal((await como(db, claims.alumno(UA, IA)).post("progreso", { alumno_id: IB, ejercicio_id: "x", kg: 1, reps: 1 })).status, 201);
  });

  await test("[" + idType + "] preflight sobre el estado actual: corre completo y detecta lo critico (cuentas sin vinculo, alumnos sin gestor)", async () => {
    const db = nueva(false); const r = pg.sql(PRE, db); assert.ok(r.ok, r.error && r.error.message);
    const q = (txt) => pg.rows(txt, db);
    const r7 = q("select a.id, (select count(*) from auth.users u where u.raw_app_meta_data ->> 'alumno_id' = a.id::text) as cuentas_vinculadas from public.alumnos a order by 2, 1");
    assert.deepEqual(r7.filter((x) => x.cuentas_vinculadas === 0).map((x) => x.id), [ID], "D no tiene cuenta vinculada: perderia el acceso");
    assert.equal(q("select * from public.alumnos where entrenador_id not in ('" + C1 + "','" + C2 + "','entrenador_principal')").length, 0);
  });

  await test("[" + idType + "] migracion: aplica completa, es reejecutable y verificable (V1-V8) sin politicas permisivas ni privilegios de anon", async () => {
    const db = nueva(true);
    assert.ok(pg.sql(MIG, db).ok, "reejecucion");
    const v = pg.sql(VER, db); assert.ok(v.ok, v.error && v.error.message);
    const vrows = (re) => { const i = VER.search(re); const blk = VER.slice(i).split("\n").filter((l) => !l.startsWith("--")).join("\n").split(/;\s*\n/)[0]; return pg.rows(blk, db); };
    assert.ok(vrows(/^select c\.relname, c\.relrowsecurity/m).every((x) => x.relrowsecurity === true));
    assert.equal(vrows(/^select tablename, policyname, qual/m).length, 0, "V2: solo it_rls_* y ninguna incondicional");
    assert.equal(vrows(/^select grantee, table_name, privilege_type/m).length, 0, "V3");
    const v4 = vrows(/^select p\.proname, p\.prosecdef/m); assert.ok(v4.every((x) => x.anon_ejecuta === false), "V4 anon no ejecuta"); assert.ok(v4.filter((x) => x.definer).every((x) => /search_path/.test(JSON.stringify(x.proconfig))));
    assert.equal(vrows(/^select count\(\*\) as entrenadores_autorizados/m)[0].entrenadores_autorizados, 2);
    assert.deepEqual(Object.values(vrows(/^select has_table_privilege\('anon'/m)[0]), [false, false, false]);
    assert.deepEqual(vrows(/^select event_object_table, trigger_name/m).map((x) => x.trigger_name), ["it_guard_alumnos", "it_guard_mensajes", "it_guard_rutinas"]);
    assert.equal(pg.scalar("(select count(*) from pg_policies where policyname = 'acceso_total' and schemaname = 'public' and tablename = any (array['" + TABLAS.join("','") + "']))", db), 0);
    assert.equal(pg.scalar("(select count(*) from pg_policies where tablename like 'coach_%' and schemaname = 'public')", db), 6, "las politicas por dueño de coach_* no se tocan");
  });

  await test("[" + idType + "] contrato de esquema: si falta una columna o el tipo no coincide, la migracion ABORTA sin cambios", async () => {
    const db = nueva(false); pg.sql("alter table public.mensajes drop column leido;", db);
    const r = pg.sql(MIG, db); assert.equal(r.ok, false); assert.match(r.error.message, /faltan columnas del contrato: mensajes\.leido/);
    assert.equal(pg.scalar("(select count(*) from pg_policies where policyname = 'acceso_total')", db) > 0, true, "acceso_total intacta: la transaccion se revirtio");
    assert.equal(pg.scalar("(select count(*) from pg_namespace where nspname = 'it_authz')", db), 0);
  });

  await test("[" + idType + "] alumno A: ve y modifica solo lo suyo; no puede leer ni escribir datos de B ni de C", async () => {
    const db = nueva(true); const a = como(db, claims.alumno(UA, IA));
    solo(await a.get("alumnos?select=id"), [IA]); solo(await a.get("rutinas?select=id"), [RA]);
    solo(await a.get("progreso?select=id"), ["a0000000-0000-4000-8000-000000000001"]); solo(await a.get("sesiones?select=id"), ["b0000000-0000-4000-8000-000000000001"]);
    solo(await a.get("mensajes?select=id"), ["c0000000-0000-4000-8000-000000000001", "c0000000-0000-4000-8000-000000000002"]); solo(await a.get("notas?select=id"), ["d0000000-0000-4000-8000-000000000001"]);
    solo(await a.get("fotos?select=id"), ["e0000000-0000-4000-8000-000000000001"]);
    assert.equal((await a.get("config?select=id")).data.length, 1, "config de pagos legible");
    solo(await a.get("entrenadores?select=id"), [C1], "solo el entrenador de A"); solo(await a.get("video_overrides?select=id"), ["f0000000-0000-4000-8000-000000000001", "f0000000-0000-4000-8000-000000000003"]);
    assert.equal((await a.get("ejercicio_overrides?select=id")).data.length, 1); assert.equal((await a.get("ejercicios_custom?select=id")).data.length, 1);
    assert.equal((await a.get("alumnos?id=eq." + IB + "&select=id")).data.length, 0); assert.equal((await a.get("progreso?alumno_id=eq." + IB + "&select=id")).data.length, 0);
    // escrituras propias
    assert.equal((await a.post("progreso", { alumno_id: IA, ejercicio_id: "bp", kg: 1, reps: 1 })).status, 201);
    assert.equal((await a.post("sesiones", { alumno_id: IA, rutina_id: RA, dia_idx: 0, semana: 1, fecha: "6/11/2026" })).status, 201);
    assert.equal((await a.post("fotos", { alumno_id: IA, url: "x" })).status, 201);
    assert.equal((await a.post("mensajes", { alumno_id: IA, de_entrenador: false, texto: "hola" })).status, 201);
    // escrituras ajenas
    denegado(await a.post("progreso", { alumno_id: IB, ejercicio_id: "bp", kg: 1, reps: 1 }), "insert progreso de B");
    denegado(await a.post("sesiones", { alumno_id: IB, rutina_id: RB_, dia_idx: 0, semana: 1, fecha: "7/11/2026" }), "insert sesion de B");
    denegado(await a.post("fotos", { alumno_id: IB, url: "x" }), "insert foto de B"); denegado(await a.post("mensajes", { alumno_id: IB, de_entrenador: false, texto: "x" }), "mensaje a nombre de B");
    denegado(await a.post("mensajes", { alumno_id: IA, de_entrenador: true, texto: "me hago pasar por el entrenador" }), "mensaje como entrenador");
    denegado(await a.post("notas", { alumno_id: IA, texto: "x" }), "nota propia (las escribe el entrenador)");
    sin_filas(await a.patch("progreso?id=eq.a0000000-0000-4000-8000-000000000001", { kg: 999 }), "update progreso (sin politica)"); sin_filas(await a.delete("progreso?id=eq.a0000000-0000-4000-8000-000000000001"), "delete progreso");
    sin_filas(await a.delete("sesiones?id=eq.b0000000-0000-4000-8000-000000000001"), "delete sesion"); sin_filas(await a.delete("fotos?id=eq.e0000000-0000-4000-8000-000000000002"), "delete foto de B");
    assert.equal((await a.delete("fotos?id=eq.e0000000-0000-4000-8000-000000000001")).data.length, 1, "borra su propia foto");
    sin_filas(await a.patch("alumnos?id=eq." + IB, { onesignal_id: "x" }), "update alumno B"); sin_filas(await a.patch("rutinas?id=eq." + RB_, { datos: { semana_activa: 2 } }), "update rutina B");
    sin_filas(await a.delete("alumnos?id=eq." + IA), "un alumno no se borra");
    assert.equal(pg.scalar("(select kg from public.progreso where id = 'a0000000-0000-4000-8000-000000000001')", db), 50);
  });

  await test("[" + idType + "] alumno: columnas protegidas por trigger (entrenador_id, nombre, email, rutinas.datos salvo semana_activa hacia adelante, mensajes salvo leido)", async () => {
    const db = nueva(true); const a = como(db, claims.alumno(UA, IA));
    assert.equal((await a.patch("alumnos?id=eq." + IA, { onesignal_id: "pid-1" })).data[0].onesignal_id, "pid-1");
    for (const body of [{ entrenador_id: UA }, { nombre: "Otro" }, { email: "nuevo@x.test" }, { auth_uid: UA }, { ultimo_pago_confirmado: "2026-01-01T00:00:00Z" }, { id: IB }]) denegado(await a.patch("alumnos?id=eq." + IA, body), "alumnos " + Object.keys(body));
    assert.equal(pg.scalar("(select entrenador_id from public.alumnos where id::text = '" + IA + "')", db), C1);
    assert.equal((await a.patch("rutinas?id=eq." + RA, { datos: { semana_activa: 2, days: [{ label: "x" }], ciclo_actual: 1 } })).data.length, 1, "avanza la semana");
    assert.equal((await a.patch("rutinas?id=eq." + RA, { datos: { semana_activa: 2, days: [{ label: "x" }], ciclo_actual: 1 } })).data.length, 1, "idempotente");
    denegado(await a.patch("rutinas?id=eq." + RA, { datos: { semana_activa: 1, days: [{ label: "x" }], ciclo_actual: 1 } }), "retroceder la semana");
    denegado(await a.patch("rutinas?id=eq." + RA, { datos: { semana_activa: 3, days: [{ label: "otra prescripcion" }], ciclo_actual: 1 } }), "alterar la prescripcion");
    denegado(await a.patch("rutinas?id=eq." + RA, { datos: { semana_activa: 3, days: [{ label: "x" }], ciclo_actual: 2, extra: 1 } }), "agregar claves");
    denegado(await a.patch("rutinas?id=eq." + RA, { nombre: "mia" }), "renombrar"); denegado(await a.patch("rutinas?id=eq." + RA, { alumno_id: IB }), "mover la rutina a B"); denegado(await a.patch("rutinas?id=eq." + RA, { entrenador_id: UA }), "cambiar el dueño");
    assert.equal(pg.scalar("(select (datos->>'semana_activa')::int from public.rutinas where id::text = '" + RA + "')", db), 2);
    assert.equal((await a.patch("mensajes?id=eq.c0000000-0000-4000-8000-000000000001", { leido: true })).data.length, 1, "marca leido lo que recibio");
    denegado(await a.patch("mensajes?id=eq.c0000000-0000-4000-8000-000000000001", { texto: "editado" }), "editar el texto del entrenador");
    sin_filas(await a.patch("mensajes?id=eq.c0000000-0000-4000-8000-000000000002", { leido: true }), "no actualiza sus propios mensajes (los marca el entrenador)");
    sin_filas(await a.patch("mensajes?id=eq.c0000000-0000-4000-8000-000000000003", { leido: true }), "ni los de B");
  });

  await test("[" + idType + "] alumno B es simetrico: no accede a A", async () => {
    const db = nueva(true); const b = como(db, claims.alumno(UB, IB));
    solo(await b.get("alumnos?select=id"), [IB]); solo(await b.get("progreso?select=id"), ["a0000000-0000-4000-8000-000000000002"]); solo(await b.get("rutinas?select=id"), [RB_]);
    assert.equal((await b.get("entrenadores?select=id")).data.map((x) => x.id).join(), "entrenador_principal", "su gestor es entrenador_principal");
    denegado(await b.post("progreso", { alumno_id: IA, ejercicio_id: "x", kg: 1, reps: 1 }), "B escribe en A"); assert.equal((await b.get("mensajes?alumno_id=eq." + IA + "&select=id")).data.length, 0);
    solo(await b.get("video_overrides?select=id"), ["f0000000-0000-4000-8000-000000000003"], "no ve los del entrenador de A, solo el compartido");
  });

  await test("[" + idType + "] sin autorizacion: usuario sin vinculo/padron, cuenta de alumno SIN vinculo y anon no leen ni escriben datos privados", async () => {
    const db = nueva(true);
    for (const [nombre, who] of [["usuario sin vinculo", claims.plano(UZ)], ["cuenta de alumno sin app_metadata", claims.plano(UD)], ["anon", "anon"]]) {
      const x = como(db, who);
      for (const t of TABLAS) { const r = await x.get(t + "?select=*"); if (who === "anon") denegado(r, nombre + " lee " + t); else sin_filas(r, nombre + " lee " + t); }
      denegado(await x.post("progreso", { alumno_id: IA, ejercicio_id: "x", kg: 1, reps: 1 }), nombre + " escribe progreso");
      if (who !== "anon") { denegado(await x.post("entrenadores", { id: UZ, email: "z@t.test" }), nombre + " se registra como entrenador"); denegado(await x.post("config", { id: "otra", alias: "x" }), nombre + " config"); }
      sin_filas(await x.patch("alumnos?id=eq." + IA, { onesignal_id: "x" }).then((r) => (r.ok ? r : { ok: true, data: [] })), nombre + " update alumnos");
      if (who !== "anon") sin_filas(await x.delete("progreso?alumno_id=eq." + IA), nombre + " delete progreso");
    }
  });

  await test("[" + idType + "] entrenador 1: conserva sus operaciones legitimas y NO accede a alumnos de otro entrenador", async () => {
    const db = nueva(true); const c = como(db, claims.coach(C1));
    solo(await c.get("alumnos?select=id"), [IA, IB, ID], "sus alumnos (incluye entrenador_principal)"); solo(await c.get("rutinas?select=id"), [RA, RB_, RP], "incluye la plantilla, no la de C");
    solo(await c.get("progreso?select=id"), ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002"]); solo(await c.get("sesiones?select=id"), ["b0000000-0000-4000-8000-000000000001", "b0000000-0000-4000-8000-000000000002"]);
    assert.equal((await c.get("mensajes?select=id")).data.length, 3); assert.equal((await c.get("alumnos?id=eq." + IC + "&select=id")).data.length, 0);
    assert.equal((await c.post("alumnos", { id: U("9", 1), nombre: "Nuevo", entrenador_id: C1 })).status, 201, "alta de alumno (con RETURNING)");
    assert.equal((await c.post("rutinas", { alumno_id: IA, entrenador_id: C1, nombre: "R2", datos: { semana_activa: 1 } })).status, 201); assert.equal((await c.post("rutinas", { entrenador_id: C1, nombre: "Plantilla 2", es_plantilla: true, datos: {} })).status, 201);
    assert.equal((await c.patch("rutinas?id=eq." + RA, { datos: { semana_activa: 1, days: [{ label: "editada" }] }, nombre: "RA2" })).data.length, 1, "edita prescripcion y retrocede semana (reinicio)");
    assert.equal((await c.patch("alumnos?id=eq." + IA, { nombre: "A editado", entrenador_id: C1 })).data.length, 1); assert.equal((await c.post("notas", { alumno_id: IA, texto: "nota del dia" })).status, 201);
    assert.equal((await c.post("mensajes", { alumno_id: IA, de_entrenador: true, texto: "hola" })).status, 201); assert.equal((await c.patch("mensajes?id=eq.c0000000-0000-4000-8000-000000000002", { leido: true })).data.length, 1, "marca leido lo que envio el alumno");
    assert.equal((await c.post("sesiones", { alumno_id: IA, rutina_id: RA, dia_idx: 1, semana: 1, fecha: "8/11/2026" })).status, 201, "validacion manual");
    assert.equal((await c.patch("config?id=eq.pagos", { alias: "nuevo.alias" })).data.length, 1); assert.equal((await c.patch("entrenadores?id=eq." + C1, { nombre: "Yo" })).data.length, 1);
    assert.equal((await c.post("video_overrides", { entrenador_id: "entrenador_principal", ejercicio_id: "dl", youtube_url: "u" })).status, 201); assert.equal((await c.post("ejercicios_custom", { entrenador_id: C1, nombre: "mio" })).status, 201);
    assert.equal((await c.delete("progreso?alumno_id=eq." + IA)).data.length, 1); assert.equal((await c.delete("sesiones?alumno_id=eq." + IA)).data.length >= 1, true); assert.equal((await c.delete("rutinas?id=eq." + RB_)).data.length, 1);
    // limites
    denegado(await c.post("alumnos", { id: U("9", 2), nombre: "Robado", entrenador_id: C2 }), "alta a nombre de otro entrenador"); sin_filas(await c.patch("alumnos?id=eq." + IC, { nombre: "x" }), "update alumno de otro");
    denegado(await c.patch("alumnos?id=eq." + IA, { entrenador_id: C2 }), "entregar el alumno a otro entrenador (WITH CHECK)"); denegado(await c.post("rutinas", { alumno_id: IC, entrenador_id: C2, nombre: "x", datos: {} }), "rutina para alumno ajeno");
    denegado(await c.post("notas", { alumno_id: IC, texto: "x" }), "nota a alumno ajeno"); denegado(await c.post("mensajes", { alumno_id: IC, de_entrenador: true, texto: "x" }), "mensaje a alumno ajeno");
    sin_filas(await c.delete("progreso?alumno_id=eq." + IC), "borrar progreso ajeno"); denegado(await c.post("video_overrides", { entrenador_id: C2, ejercicio_id: "x", youtube_url: "u" }), "override a nombre de otro");
    denegado(await c.post("mensajes", { alumno_id: IA, de_entrenador: false, texto: "como alumno" }), "el entrenador no escribe como alumno"); sin_filas(await c.patch("entrenadores?id=eq." + C2, { nombre: "x" }), "perfil de otro entrenador");
  });

  await test("[" + idType + "] entrenador 2 solo ve a su alumno; un entrenador NO autorizado en el padron (aunque se llame entrenador) no tiene acceso", async () => {
    const db = nueva(true, [C1]); const c2 = como(db, claims.coach(C2));
    for (const t of ["alumnos", "rutinas", "progreso", "sesiones", "mensajes", "video_overrides"]) sin_filas(await c2.get(t + "?select=id"), "C2 fuera del padron lee " + t);
    denegado(await c2.post("entrenadores", { id: C2, email: "otro@coach.test" }), "autoregistro como entrenador");
    pg.sql("insert into it_authz.entrenadores_autorizados (uid) values ('" + C2 + "')", db); solo(await c2.get("alumnos?select=id"), [IB, IC], "tras autorizarlo ve el suyo y los legados entrenador_principal (igual que la Edge Function)");
    pg.sql("delete from it_authz.entrenadores_autorizados where uid = '" + C2 + "'", db); sin_filas(await c2.get("alumnos?select=id"), "al retirarlo pierde el acceso de inmediato");
  });

  await test("[" + idType + "] escalada de privilegios: el padron y las funciones internas no son accesibles por la API; las funciones publicas no permiten eludir RLS", async () => {
    const db = nueva(true);
    for (const rol of ["authenticated", "anon"]) {
      const o = { role: rol, claims: rol === "anon" ? undefined : claims.alumno(UA, IA) };
      for (const q of ["select * from it_authz.entrenadores_autorizados", "insert into it_authz.entrenadores_autorizados (uid) values ('" + UA + "')", "update it_authz.entrenadores_autorizados set uid = '" + UA + "'", "delete from it_authz.entrenadores_autorizados"]) {
        const r = pg.sql(q + ";", db, o); assert.equal(r.ok, false, rol + ": " + q); assert.equal(r.error.code, "42501", rol + " " + q + " " + r.error.message);
      }
    }
    assert.equal(pg.tryRows("select it_authz.es_entrenador() as v", db, { role: "authenticated", claims: claims.alumno(UA, IA) }).rows[0].v, false);
    assert.equal(pg.tryRows("select it_authz.es_entrenador() as v", db, { role: "anon" }).error.code, "42501");
    assert.equal(pg.tryRows("select it_authz.gestiona_alumno('" + IB + "') as v", db, { role: "authenticated", claims: claims.alumno(UA, IA) }).rows[0].v, false);
    // un alumno no puede crearse funciones/tablas ni cambiar su rol
    assert.equal(pg.tryRows("select 1 from (select set_config('request.jwt.claims', '" + JSON.stringify(claims.coach(C1)) + "', false)) x", db, { role: "authenticated", claims: claims.alumno(UA, IA) }).ok, true, "set_config solo cambia la simulacion de JWT en ESTE arnes (en Supabase el JWT lo firma el servidor)");
    assert.equal(pg.tryRows("create function public.evil() returns int language sql as 'select 1'", db, { role: "authenticated" }).ok, false);
    // V8 detecta una RPC SECURITY DEFINER que elude RLS
    assert.ok(pg.sql("create function public.it_mala_rpc(p text) returns void language sql security definer as $$ insert into public.progreso (alumno_id, ejercicio_id) values (p::" + idType + ", 'x') $$; grant execute on function public.it_mala_rpc(text) to authenticated;", db).ok);
    const v8 = pg.rows("with f as materialized (select p.oid, p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind in ('f','p')) select proname from f where prosecdef and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'))", db);
    assert.deepEqual(v8.map((x) => x.proname), ["it_mala_rpc"], "la verificacion V8 la senala para revision");
    assert.ok(pg.tryRows("select public.it_mala_rpc('" + IB + "')", db, { role: "authenticated", claims: claims.alumno(UA, IA) }).ok, "(demuestra por que V8 es obligatoria: una RPC DEFINER sin validacion SI elude RLS)");
  });

  await test("[" + idType + "] upsert como lo hace PostgREST (INSERT ... ON CONFLICT DO UPDATE): el entrenador actualiza lo suyo; un alumno u otro entrenador no pisan filas ajenas ni se registran", async () => {
    const db = nueva(true); const coach = { role: "authenticated", claims: claims.coach(C1) }, alumno = { role: "authenticated", claims: claims.alumno(UA, IA) }, otro = { role: "authenticated", claims: claims.coach(C2) };
    const upsertOv = (nombre, o, ent) => pg.tryRows("insert into public.ejercicio_overrides (entrenador_id, ejercicio_id, name) values ('" + ent + "','sq','" + nombre + "') on conflict (entrenador_id, ejercicio_id) do update set name = excluded.name returning name", db, o);
    assert.equal(upsertOv("Nuevo", coach, C1).rows[0].name, "Nuevo", "el entrenador actualiza su override");
    assert.equal(upsertOv("Pisado", alumno, C1).error.code, "42501", "un alumno no pisa el override del entrenador"); assert.equal(upsertOv("Pisado", otro, C1).error.code, "42501", "otro entrenador tampoco");
    assert.equal(pg.scalar("(select name from public.ejercicio_overrides where entrenador_id = '" + C1 + "' and ejercicio_id = 'sq')", db), "Nuevo");
    const upsertEnt = (id, o, nombre) => pg.tryRows("insert into public.entrenadores (id, email) values ('" + id + "','x@t.test') on conflict (id) do update set email = excluded.email returning id", db, o);
    assert.ok(upsertEnt(C1, coach).ok, "el entrenador registra/actualiza su fila"); assert.equal(upsertEnt(UA, alumno).error.code, "42501", "un alumno no se registra como entrenador"); assert.equal(upsertEnt(C1, alumno).error.code, "42501", "ni pisa la fila del entrenador");
    assert.equal(upsertEnt(C1, otro).error.code, "42501", "otro entrenador no pisa la fila ajena");
  });

  await test("[" + idType + "] las pruebas DETECTAN una politica debil: 4 mutaciones de la migracion (select abierto, mensaje como entrenador, trigger ausente, es_dueno sin padron) son senaladas y la migracion real no", async () => {
    const mut = (de, a) => { assert.ok(MIG.includes(de), "la mutacion no aplica: " + de.slice(0, 50)); return MIG.replace(de, () => a); };
    const fugas = {
      progreso_abierto: async (db) => (await como(db, claims.alumno(UA, IA)).get("progreso?select=id")).data.length > 1,
      mensaje_como_entrenador: async (db) => (await como(db, claims.alumno(UA, IA)).post("mensajes", { alumno_id: IA, de_entrenador: true, texto: "x" })).status === 201,
      alumno_cambia_entrenador: async (db) => { const r = await como(db, claims.alumno(UA, IA)).patch("alumnos?id=eq." + IA, { entrenador_id: UA }); return r.ok && r.data.length === 1; },
      cualquiera_ve_legados: async (db) => (await como(db, claims.plano(UZ)).get("alumnos?select=id")).data.length > 0,
    };
    const mutadas = {
      progreso_abierto: mut("CREATE POLICY it_rls_progreso_select ON public.progreso FOR SELECT TO authenticated USING (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));", "CREATE POLICY it_rls_progreso_select ON public.progreso FOR SELECT TO authenticated USING (true);"),
      mensaje_como_entrenador: mut("(it_authz.es_alumno(alumno_id::text) AND de_entrenador IS NOT TRUE) OR (it_authz.gestiona_alumno(alumno_id::text) AND de_entrenador IS TRUE));", "it_authz.es_alumno(alumno_id::text) OR (it_authz.gestiona_alumno(alumno_id::text) AND de_entrenador IS TRUE));"),
      alumno_cambia_entrenador: mut("CREATE TRIGGER it_guard_alumnos BEFORE UPDATE ON public.alumnos FOR EACH ROW EXECUTE FUNCTION it_authz.guard_columnas_alumno('onesignal_id', 'updated_at');", "-- trigger removido"),
      cualquiera_ve_legados: mut("AS $$ SELECT it_authz.es_entrenador() AND p_entrenador_id IS NOT NULL AND p_entrenador_id IN (auth.uid()::text, 'entrenador_principal') $$;", "AS $$ SELECT p_entrenador_id IS NOT NULL AND p_entrenador_id IN (auth.uid()::text, 'entrenador_principal') $$;"),
    };
    const real = nueva(true);
    for (const [nombre, sqlMut] of Object.entries(mutadas)) {
      const dbMut = nueva(true, [C1, C2], sqlMut);
      assert.equal(await fugas[nombre](dbMut), true, "la prueba NO detecta la mutacion " + nombre);
      assert.equal(await fugas[nombre](real), false, "falso positivo en la migracion real: " + nombre);
    }
  });

  await test("[" + idType + "] identidad remota + RLS: el alumno guarda series/sesion con identidad bajo las politicas nuevas; B no las ve; la migracion de identidad es compatible en ambos ordenes", async () => {
    const IDMIG = readFileSync(path.join(D, "..", "identidad-remota-v1", "1_migracion.sql"), "utf8");
    const estado = (db) => JSON.stringify({ cols: pg.rows("select table_name, column_name, data_type from information_schema.columns where table_schema = 'public' order by 1, 2", db), pol: pg.rows("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2", db),
      idx: pg.rows("select indexname, indexdef from pg_indexes where schemaname = 'public' order by 1", db), con: pg.rows("select conname, convalidated from pg_constraint where connamespace = 'public'::regnamespace order by 1", db) });
    const A = nueva(true); assert.ok(pg.sql(IDMIG, A).ok);                                  // RLS -> identidad
    const B = nueva(false); assert.ok(pg.sql(IDMIG, B).ok);                                 // identidad -> RLS
    pg.sql("create schema if not exists it_authz; create table if not exists it_authz.entrenadores_autorizados (uid uuid primary key, nota text, created_at timestamptz not null default now()); insert into it_authz.entrenadores_autorizados (uid) values ('" + C1 + "');", B); assert.ok(pg.sql(MIG, B).ok);
    pg.sql("delete from it_authz.entrenadores_autorizados where uid = '" + C2 + "'", A);
    assert.equal(estado(A), estado(B), "el estado final no depende del orden");
    const a = como(A, claims.alumno(UA, IA)), b = como(A, claims.alumno(UB, IB)); const uid = "11111111-1111-4111-8111-111111111111";
    assert.equal((await a.post("progreso", { alumno_id: IA, ejercicio_id: "sq", kg: 50, reps: 8, sesion_uid: uid, bloque: "main", pos: 0 })).status, 201);
    assert.equal((await a.post("sesiones", { alumno_id: IA, rutina_id: RA, dia_idx: 0, semana: 1, fecha: "9/11/2026", sesion_uid: uid, identidad_v: 1 })).status, 201);
    assert.equal((await a.post("sesiones", { alumno_id: IA, rutina_id: RA, dia_idx: 0, semana: 1, fecha: "9/11/2026", sesion_uid: uid, identidad_v: 1 })).data.code, "23505");
    assert.equal((await b.get("progreso?sesion_uid=eq." + uid + "&select=id")).data.length, 0); assert.equal((await b.get("sesiones?sesion_uid=eq." + uid + "&select=id")).data.length, 0);
    denegado(await b.post("sesiones", { alumno_id: IA, sesion_uid: "22222222-2222-4222-8222-222222222222", identidad_v: 1 }), "B no inserta sesiones de A");
  });

  await test("[" + idType + "] rollback: restituye acceso_total (estado anterior), es reejecutable, conserva el padron; volver a migrar deja el mismo estado seguro", async () => {
    const db = nueva(true); const antes = JSON.stringify(pg.rows("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2", db));
    assert.ok(pg.sql(RB, db).ok); assert.ok(pg.sql(RB, db).ok, "reejecutable");
    assert.equal((await como(db, claims.plano(UZ)).get("alumnos?select=id")).data.length, 4, "vuelve el estado permisivo (advertido en el archivo)");
    assert.equal(pg.scalar("(select count(*) from it_authz.entrenadores_autorizados)", db), 2, "el padron se conserva");
    assert.equal(pg.scalar("(select count(*) from information_schema.triggers where trigger_name like 'it_guard%')", db), 0);
    assert.ok(pg.sql(MIG, db).ok); assert.equal(JSON.stringify(pg.rows("select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2", db)), antes);
    sin_filas(await como(db, claims.plano(UZ)).get("alumnos?select=id"), "otra vez cerrado");
  });
}
pg.stop();
console.log("\n" + n + " pruebas OK (PostgreSQL local, NO Supabase Auth)");
