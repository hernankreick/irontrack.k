// Identidad remota v1: permisos y RLS con roles/identidades FICTICIAS sobre un PostgreSQL LOCAL (no Supabase), despues de aplicar la migracion real.
//   node scripts/test-pgIdentidadRemotaRls.mjs
// Las politicas "solo_propio" de esta prueba son SOLO DE PRUEBA para demostrar que las columnas nuevas conviven con RLS por fila: NO son la
// correccion de RLS pendiente (otro carril) ni una propuesta. El estado real de produccion (acceso_total permisivo) se replica sin juzgarlo.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalPg, ESQUEMA_BASE, available } from "./lib/pgLocal.mjs";
import { makeRest } from "./lib/pgRest.mjs";
import { postProgressIdempotent, isIdConflict } from "../lib/progressInsert.js";
import { enviarConFallbackIdentidad, CAMPOS_REMOTOS_SERIE, CAMPOS_REMOTOS_SESION, esErrorEsquemaIdentidad } from "../lib/identidadRemota.js";

if (!available()) { console.log("# omitido: no hay PostgreSQL local (binarios initdb/postgres/psql). Esta suite NO se considera ejecutada."); process.exit(0); }
const D = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "identidad-remota-v1");
const MIG = readFileSync(path.join(D, "1_migracion.sql"), "utf8");
let n = 0; const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };
const U = (i) => "aaaaaaaa-aaaa-4aaa-8aaa-" + String(i).padStart(12, "0");
const OP = (i) => "bbbbbbbb-bbbb-4bbb-8bbb-" + String(i).padStart(12, "0");
const SOLO_PROPIO = (t) => "drop policy acceso_total on public." + t + "; create policy solo_propio on public." + t + " for all to authenticated using (alumno_id = auth.uid()) with check (alumno_id = auth.uid());";

const pg = new LocalPg().start();
const ROLES = ESQUEMA_BASE.split("\n").find((l) => l.startsWith("create role"));
function base(nombre, extra) { pg.createDb(nombre); const r = pg.sql(ESQUEMA_BASE.replace(ROLES, "") + "\n" + MIG + "\n" + (extra || ""), nombre); assert.ok(r.ok, r.stderr); return nombre; }
try {
  assert.ok(pg.sql(ROLES, "postgres").ok);

  await test("estado de produccion replicado (acceso_total permisivo): authenticated guarda identidad completa; leer las columnas nuevas funciona; la migracion no cambio politicas ni grants", async () => {
    const db = base("perm");
    const al = makeRest(pg, db, { sub: "al-a" });
    const r = await al.post("progreso", { id: OP(1), alumno_id: "al-a", ejercicio_id: "sq", kg: 60, reps: 8, sesion_uid: U(1), bloque: "main", pos: 0 }); assert.equal(r.status, 201, JSON.stringify(r.data));
    assert.deepEqual([r.data[0].sesion_uid, r.data[0].bloque, r.data[0].pos], [U(1), "main", 0]);
    const s = await al.post("sesiones", { alumno_id: "al-a", sesion_uid: U(1), identidad_v: 1, fecha: "5/11/2026", dia_idx: 0, semana: 0 }); assert.equal(s.status, 201);
    const g = await al.get("progreso?alumno_id=eq.al-a&select=id,sesion_uid,bloque,pos"); assert.equal(g.data.length, 1); assert.equal(g.data[0].pos, 0);
    assert.deepEqual(pg.rows("select tablename, policyname, roles::text from pg_policies where schemaname='public' order by 1", db).map((x) => x.policyname), ["acceso_total", "acceso_total"]);
    // Hecho conocido, NO corregido aqui (otro carril): con acceso_total un alumno puede escribir con el alumno_id de otro.
    const ajeno = await al.post("progreso", { id: OP(2), alumno_id: "al-b", ejercicio_id: "sq", kg: 1, reps: 1 }); assert.equal(ajeno.status, 201, "riesgo RLS preexistente, ajeno a esta migracion");
  });

  await test("con RLS por fila (politica de PRUEBA): serie propia con identidad => 201; alumno_id ajeno => 403/42501; lectura aislada; cliente antiguo (sin columnas nuevas) => 201", async () => {
    const db = base("rls", SOLO_PROPIO("progreso") + SOLO_PROPIO("sesiones"));
    const a = makeRest(pg, db, { sub: "al-a" }), b = makeRest(pg, db, { sub: "al-b" });
    const ok = await a.post("progreso", { id: OP(1), alumno_id: "al-a", ejercicio_id: "sq", kg: 60, reps: 8, sesion_uid: U(1), bloque: "warmup", pos: 0 }); assert.equal(ok.status, 201, JSON.stringify(ok.data));
    const ajeno = await a.post("progreso", { id: OP(2), alumno_id: "al-b", ejercicio_id: "sq", sesion_uid: U(1), bloque: "main", pos: 1 }); assert.equal(ajeno.status, 403); assert.equal(ajeno.data.code, "42501");
    assert.equal(pg.scalar("(select count(*) from public.progreso where alumno_id = 'al-b')", db), 0, "nada escrito para el otro alumno");
    assert.equal((await b.get("progreso?select=id")).data.length, 0, "b no ve las series de a"); assert.equal((await a.get("progreso?select=id,sesion_uid")).data.length, 1);
    assert.equal((await a.post("progreso", { id: OP(3), alumno_id: "al-a", ejercicio_id: "sq", kg: 1, reps: 1 })).status, 201, "payload antiguo");
    const sa = await a.post("sesiones", { alumno_id: "al-a", sesion_uid: U(1), identidad_v: 1 }); assert.equal(sa.status, 201);
    assert.equal((await b.get("sesiones?sesion_uid=eq." + U(1))).data.length, 0, "b no ve la sesion de a (ni su uid)");
    const sinSesion = await makeRest(pg, db, { role: "anon" }).post("progreso", { id: OP(4), alumno_id: "al-a", ejercicio_id: "sq" }); assert.ok(!sinSesion.ok); assert.equal(sinSesion.status, 401, "anon sin politica: rechazado");
  });

  await test("duplicados bajo RLS: reintento del mismo opId => 409 progreso_pkey (con o sin detalle) y el cliente lo confirma por id; sesion_uid repetido => 409 sesiones_sesion_uid_uidx sin crear fila", async () => {
    const db = base("dups", SOLO_PROPIO("progreso") + SOLO_PROPIO("sesiones"));
    const a = makeRest(pg, db, { sub: "al-a" });
    const io = { post: (p) => enviarConFallbackIdentidad((x) => a.post("progreso", x), p, CAMPOS_REMOTOS_SERIE), getById: (id) => a.get("progreso?id=eq." + id + "&select=id,alumno_id,ejercicio_id,kg,reps,semana,nota") };
    const payload = { id: OP(1), alumno_id: "al-a", ejercicio_id: "sq", kg: 60, reps: 8, nota: "", fecha: "5/11/2026", semana: 0, sesion_uid: U(1), bloque: "main", pos: 0 };
    assert.ok(await postProgressIdempotent(io, payload));
    const crudo = await a.post("progreso", payload); assert.equal(crudo.status, 409); assert.equal(crudo.data.code, "23505"); assert.match(crudo.data.message, /progreso_pkey/);
    assert.equal(isIdConflict(crudo, payload.id), true, "detalle de PostgreSQL bajo RLS: " + JSON.stringify(crudo.data.details));
    const rep = await postProgressIdempotent(io, payload); assert.ok(rep && rep.length === 1, "reintento confirmado por lectura de la fila");
    assert.equal(pg.scalar("(select count(*) from public.progreso)", db), 1, "sin duplicados");
    assert.equal((await a.post("sesiones", { alumno_id: "al-a", sesion_uid: U(1), identidad_v: 1 })).status, 201);
    const d = await a.post("sesiones", { alumno_id: "al-a", sesion_uid: U(1), identidad_v: 1 }); assert.equal(d.status, 409); assert.match(d.data.message, /sesiones_sesion_uid_uidx/);
    assert.equal(esErrorEsquemaIdentidad(d, CAMPOS_REMOTOS_SESION), false, "un 23505 nunca dispara el reenvio sin identidad"); assert.equal(pg.scalar("(select count(*) from public.sesiones)", db), 1);
  });

  await test("grants SOLO por columna (lo que vigila P8): tras migrar, con return=representation hasta el insert ANTIGUO falla (42501) si falta SELECT en las columnas nuevas; con SELECT funciona el antiguo; el insert con identidad exige tambien INSERT de columna", async () => {
    const db = base("grants", "revoke all on public.progreso from authenticated; grant select (id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, ciclo, created_at) on public.progreso to authenticated; grant insert (id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, ciclo) on public.progreso to authenticated;");
    const a = makeRest(pg, db, { sub: "al-a" });
    const viejo = await a.post("progreso", { id: OP(1), alumno_id: "al-a", ejercicio_id: "sq", kg: 1, reps: 1 }); assert.equal(viejo.data.code, "42501", "RETURNING * incluye las columnas nuevas sin SELECT");
    assert.equal(pg.scalar("(select count(*) from public.progreso)", db), 0);
    pg.sql("grant select (sesion_uid, bloque, pos) on public.progreso to authenticated;", db);
    assert.equal((await a.post("progreso", { id: OP(1), alumno_id: "al-a", ejercicio_id: "sq", kg: 1, reps: 1 })).status, 201, "con SELECT de columna vuelve el payload antiguo");
    const r = await a.post("progreso", { id: OP(2), alumno_id: "al-a", ejercicio_id: "sq", sesion_uid: U(1), bloque: "main", pos: 0 }); assert.equal(r.ok, false); assert.equal(r.data.code, "42501");
    assert.equal(pg.scalar("(select count(*) from public.progreso)", db), 1);
    pg.sql("grant insert (sesion_uid, bloque, pos) on public.progreso to authenticated;", db);
    assert.equal((await a.post("progreso", { id: OP(2), alumno_id: "al-a", ejercicio_id: "sq", sesion_uid: U(1), bloque: "main", pos: 0 })).status, 201);
  });

  await test("esquema ANTIGUO real (sin migrar) con bandera activa: PGRST204 emulado => fallback sin identidad; y cache de PostgREST vieja tras migrar => mismo fallback seguro", async () => {
    const db = "antiguo"; pg.createDb(db); assert.ok(pg.sql(ESQUEMA_BASE.replace(ROLES, ""), db).ok);
    const a = makeRest(pg, db, { sub: "al-a" });
    const r = await enviarConFallbackIdentidad((x) => a.post("progreso", x), { id: OP(1), alumno_id: "al-a", ejercicio_id: "sq", sesion_uid: U(1), bloque: "main", pos: 0 }, CAMPOS_REMOTOS_SERIE);
    assert.equal(r.status, 201); assert.equal(pg.scalar("(select count(*) from public.progreso where sesion_uid is null)".replace("sesion_uid is null", "true"), db), 1);
    pg.sql(MIG, db); // migrada en la base, pero la "cache de esquema" del emulador no se recargo
    const cacheVieja = await a.post("progreso", { id: OP(2), alumno_id: "al-a", ejercicio_id: "sq", sesion_uid: U(1) }); assert.equal(cacheVieja.data.code, "PGRST204", "sin recarga de esquema PostgREST responde PGRST204 aunque la columna exista");
    a.reload(); assert.equal((await a.post("progreso", { id: OP(2), alumno_id: "al-a", ejercicio_id: "sq", sesion_uid: U(1), bloque: "main", pos: 0 })).status, 201, "tras NOTIFY/recarga acepta la identidad");
  });
} finally { pg.stop(); }
console.log("\n" + n + " pruebas OK (PostgreSQL local, NO Supabase)");
