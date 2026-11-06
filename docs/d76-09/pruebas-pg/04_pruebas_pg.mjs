// D76-09 · Pruebas REALES en PostgreSQL (funcionales + concurrencia de locks). GO-1: 24/24 en PostgreSQL 17.6 (3 corridas completas).
// No forma parte de `npm run test:all` (necesita una base PostgreSQL); se corre a mano sobre una base LOCAL y DESECHABLE.
//
// Preparación (nunca producción ni Supabase):
//   1. Un PostgreSQL 17 local con socket Unix en /tmp/it_d7609_go1/sock, listen_addresses='' (sin TCP), data en /tmp/it_d7609_go1/data
//      y puerto 5499 (en GO-1 se usaron los binarios estables 17.6 de @embedded-postgres/linux-x64, fuera del repositorio).
//   2. `npm i pg` en un directorio aparte (no es dependencia del proyecto) y RUNNER=<ese directorio>.
//   3. RUNNER=... node 05_aplicar_local.mjs   -> verifica el aislamiento, crea it_d7609_test, aplica 03 y ../01 (UID ficticio)
//   4. RUNNER=... node 04_pruebas_pg.mjs      -> 24 pruebas (13 funcionales + 4 de vínculo + 7 de concurrencia)
//
// Cada sentencia "de cliente" se ejecuta como PostgREST: BEGIN; set_config('request.jwt.claims', ..., true); SET LOCAL ROLE ...; ...; COMMIT.
import assert from "node:assert/strict";
import { cargarPg, config, verificarAislamiento, DB } from "./05_aplicar_local.mjs";

// Destino FIJO (socket Unix local, base it_d7609_test): no se acepta URL, host ni credenciales del entorno.
const pg = cargarPg();
const pool = new pg.Pool(Object.assign(config(DB), { max: 40 }));
{ const c = await pool.connect(); try { const ev = await verificarAislamiento(c, DB); console.log("[aislamiento] " + ev.version + " | listen_addresses='" + ev.listen + "' | inet_server_addr=" + ev.server_addr + " | " + ev.db); } finally { c.release(); } }

const COACH = "c0000000-0000-4000-8000-000000000001", INTRUSO = "e0000000-0000-4000-8000-000000000009";
const U1 = "a0000000-0000-4000-8000-000000000001", U2 = "a0000000-0000-4000-8000-000000000002";
const U3 = "a0000000-0000-4000-8000-000000000003", U3_SIN_CONFIRMAR = "a0000000-0000-4000-8000-0000000000f3";
const A1 = "b0000000-0000-4000-8000-000000000001", A2 = "b0000000-0000-4000-8000-000000000002", A3 = "b0000000-0000-4000-8000-000000000003";
const who = {
  coach:   { role: "authenticated", claims: { sub: COACH, role: "authenticated" } },
  alumno1: { role: "authenticated", claims: { sub: U1, role: "authenticated" } },
  alumno2: { role: "authenticated", claims: { sub: U2, role: "authenticated", app_metadata: { alumno_id: A2 } } },
  intruso: { role: "authenticated", claims: { sub: INTRUSO, role: "authenticated" } },
  alumno3: { role: "authenticated", claims: { sub: U3, role: "authenticated" } },
  sinConfirmar: { role: "authenticated", claims: { sub: U3_SIN_CONFIRMAR, role: "authenticated" } },
  anon:    { role: "anon", claims: { role: "anon" } },
  service: { role: "service_role", claims: { role: "service_role" } },
  admin:   null,                                                   // SQL Editor (sin claims)
};
let seq = 0;
const uuid = () => "d0000000-0000-4000-8000-" + String(++seq).padStart(12, "0");

// Abre una transacción "de cliente" y la deja ABIERTA (para pruebas de concurrencia). close("commit"|"rollback").
// Transacciones abiertas por la prueba en curso: si la prueba falla o vence, se revierten (si no, bloquearían a las siguientes).
const abiertas = new Set();
async function open(w) {
  const c = await pool.connect();
  abiertas.add(c);
  await c.query("begin");
  if (w) {
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(w.claims)]);
    await c.query(`set local role ${w.role}`);
  }
  return {
    q: (sql, args) => c.query(sql, args),
    close: async (how) => {
      if (!abiertas.has(c)) return;
      abiertas.delete(c);
      try { await c.query(how === "rollback" ? "rollback" : "commit"); } finally { c.release(); }
    },
  };
}
async function as(w, sql, args) {
  const t = await open(w);
  try { const r = await t.q(sql, args); await t.close("commit"); return r; }
  catch (e) { await t.close("rollback").catch(() => {}); throw e; }
}
const expectCode = async (p, code) => {
  try { await p; } catch (e) { assert.equal(e.code, code, `se esperaba ${code}, llegó ${e.code} ${e.message}`); return e; }
  assert.fail(`se esperaba error ${code} y la operación tuvo éxito`);
};
const modo = (m) => as(null, "update it_private.config set modo = $1", [m]);
const reset = async () => {
  await as(null, "update it_private.config set modo = 'off'");
  await as(null, "delete from public.progreso; delete from public.sesiones; delete from it_private.historial_estado; delete from it_private.eventos; delete from it_private.vinculos");
  await as(null, "update public.alumnos set auth_uid = null where id = '" + "b0000000-0000-4000-8000-000000000003" + "'");
};
const INS = "insert into public.progreso (id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, ciclo, historial_token, historial_epoch, reingreso_de_epoch) " +
            "values ($1, $2, 'sentadilla', 100, 5, '', '02/11/2026', 1, 1, $3, $4, $5) returning historial_token, historial_epoch, reingreso_de_epoch";
const insSerie = (w, alumno, sello, extra) => as(w, INS, [ (extra && extra.id) || uuid(), alumno, sello || null, extra && extra.epoch != null ? extra.epoch : null, extra && extra.reing != null ? extra.reing : null ]);
const sello = async (w, alumno) => (await as(w, "select public.it_historial_sello($1) s", [alumno])).rows[0].s;
const limpiar = async (w, alumno, esperado, forzar) =>
  (await as(w, "select public.it_limpiar_historial_alumno($1, $2, $3) r", [alumno, esperado, !!forzar])).rows[0].r;
const filas = async (alumno) => Number((await as(null, "select count(*) n from public.progreso where alumno_id = $1", [alumno])).rows[0].n);
const esperando = async () => Number((await as(null, "select count(*) n from pg_locks where locktype = 'advisory' and not granted")).rows[0].n);
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const settled = (p) => { let s = false; p.then(() => { s = true; }, () => { s = true; }); return () => s; };

let ok = 0, fail = 0;
const LIMITE_MS = 30000;
process.on("unhandledRejection", () => {});   // promesas de una prueba ya fallida (sus esperas se cancelan al revertir)
pool.on("error", () => {});                    // conexiones terminadas a propósito por limpiarAbiertas
async function limpiarAbiertas() {
  const pend = [...abiertas]; abiertas.clear();
  if (!pend.length) return;
  for (const c of pend) { try { c.release(true); } catch (e) {} }
  // Un backend esperando un lock no detecta el cierre del socket: se terminan los de ESTA base (excepto el propio).
  const adm = new pg.Client(config(DB));
  await adm.connect();
  try { await adm.query("select pg_terminate_backend(pid) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()"); }
  finally { await adm.end(); }
}
async function t(name, fn) {
  let timer;
  try {
    await reset();
    await Promise.race([fn(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("tiempo agotado (" + LIMITE_MS + " ms)")), LIMITE_MS); })]);
    ok++; console.log("ok   -", name);
  } catch (e) { fail++; console.error("FAIL -", name, "\n     ", e && e.message); }
  finally { clearTimeout(timer); await limpiarAbiertas(); }
}

// ───────────── Funcionales ─────────────
await t("T01 modo off: todo se acepta y el sello nunca se guarda", async () => {
  const r = await insSerie(who.alumno1, A1, "11111111-1111-4111-8111-111111111111", { epoch: 99, reing: 7 });
  assert.equal(r.rows[0].historial_token, null); assert.equal(r.rows[0].reingreso_de_epoch, null);
});
await t("T02 alumno nunca borrado (activo): sin sello se acepta (clientes viejos y enlace compartido no se rompen)", async () => {
  await modo("activo");
  await insSerie(who.alumno1, A1, null); await insSerie(who.anon, A1, null);
  assert.equal(await filas(A1), 2);
});
await t("T03 tras el borrado: sin sello y sello anterior => IT409; sello vigente => aceptada con epoch del servidor", async () => {
  await modo("activo");
  const s0 = await sello(who.alumno1, A1);
  assert.equal((await limpiar(who.coach, A1, s0.epoch)).ok, true);
  await expectCode(insSerie(who.alumno1, A1, null), "IT409");
  await expectCode(insSerie(who.alumno1, A1, s0.sello), "IT409");
  const s1 = await sello(who.alumno1, A1);
  const r = await insSerie(who.alumno1, A1, s1.sello, { epoch: 0 });
  assert.equal(Number(r.rows[0].historial_epoch), 1); assert.equal(r.rows[0].historial_token, null);
});
await t("T04 una época nueva enviada por el cliente NO sirve para eludir (solo cuenta el sello)", async () => {
  await modo("activo");
  await limpiar(who.coach, A1, 0);
  await expectCode(insSerie(who.anon, A1, null, { epoch: 1 }), "IT409");
  await expectCode(insSerie(who.alumno1, A1, null, { epoch: 999 }), "IT409");
  await expectCode(insSerie(who.anon, A1, "22222222-2222-4222-8222-222222222222"), "IT409");
});
await t("T05 sello: alumno propio y entrenador sí; otro alumno, intruso y anon no; el sello nunca aparece en una fila", async () => {
  await sello(who.alumno1, A1); await sello(who.coach, A1); await sello(who.alumno2, A2);
  await expectCode(sello(who.alumno1, A2), "42501");
  await expectCode(sello(who.intruso, A1), "42501");
  await expectCode(sello(who.anon, A1), "42501");          // 42501 = permission denied (EXECUTE revocado)
});
await t("T06 observar: acepta, registra el evento, no guarda el sello", async () => {
  await modo("observar"); await limpiar(who.coach, A1, 0);
  await insSerie(who.alumno1, A1, null);
  const ev = (await as(null, "select motivo, rol from it_private.eventos")).rows;
  assert.deepEqual(ev, [{ motivo: "sin_sello", rol: "authenticated" }]);
});
await t("T07 reintento idempotente: fila existente + sello vigente => 23505 (no IT409); E2 tras borrado => IT409", async () => {
  await modo("activo");
  const id = uuid();
  await insSerie(who.alumno1, A1, null, { id });                       // aún sin borrado
  await expectCode(insSerie(who.alumno1, A1, null, { id }), "23505");  // respuesta perdida + reintento
  await limpiar(who.coach, A1, 0);
  await expectCode(insSerie(who.alumno1, A1, null, { id }), "IT409");  // E2: la fila ya no existe, el reintento se rechaza
});
await t("T08 borrado directo por API bloqueado (anon/authenticated); RPC y admin sí", async () => {
  await modo("activo"); await insSerie(who.alumno1, A1, null);
  await expectCode(as(who.coach, "delete from public.progreso where alumno_id = $1", [A1]), "42501");
  await expectCode(as(who.anon, "delete from public.sesiones"), "42501");
  assert.equal(await filas(A1), 1);
  await as(null, "delete from public.progreso where alumno_id = $1", [A1]);   // admin (SQL Editor)
  assert.equal(await filas(A1), 0);
});
await t("T09 RPC limpiar: autorización, conflicto de época, alumno sin vínculo, atomicidad y conteos", async () => {
  await expectCode(limpiar(who.alumno1, A1, 0), "42501");
  await expectCode(limpiar(who.intruso, A1, 0), "42501");
  await expectCode(limpiar(who.anon, A1, 0), "42501");
  assert.equal((await limpiar(who.coach, A1, 5)).reason, "conflicto_epoch");
  assert.equal((await limpiar(who.coach, A3, 0)).reason, "alumno_sin_vinculo");
  assert.equal((await limpiar(who.coach, A3, 0, true)).ok, true);
  await insSerie(who.alumno1, A1, null); await insSerie(who.alumno1, A1, null);
  const r = await limpiar(who.coach, A1, 0);
  assert.deepEqual([r.ok, Number(r.epoch), Number(r.progreso)], [true, 1, 2]);
  // Atomicidad: un fallo en el 2.º DELETE no deja nada borrado ni la época subida.
  await insSerie(who.alumno1, A1, (await sello(who.alumno1, A1)).sello);
  await as(null, "create or replace function public.t_boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$; " +
                 "create trigger t_boom before delete on public.sesiones for each statement execute function public.t_boom()");
  await assert.rejects(limpiar(who.coach, A1, 1));
  await as(null, "drop trigger t_boom on public.sesiones; drop function public.t_boom()");
  assert.equal(await filas(A1), 1);
  assert.equal(Number((await sello(who.coach, A1)).epoch), 1);
});
await t("T10 reingreso: solo el alumno, época confirmada, validación, idempotencia, auditoría", async () => {
  await modo("activo"); await limpiar(who.coach, A1, 0);
  const id = uuid();
  const serie = { id, ejercicio_id: "sentadilla", kg: 100, reps: 5, nota: "", fecha: "2/11/2026", semana: 1, ciclo: 1, epoch_original: 0 };
  const call = (w, ep, series, ses) => as(w, "select public.it_historial_reingresar($1, $2, $3::jsonb, $4::jsonb) r",
    [A1, ep, JSON.stringify(series), JSON.stringify(ses || [])]).then((x) => x.rows[0].r);
  await expectCode(call(who.coach, 1, [serie]), "42501");
  await expectCode(call(who.alumno2, 1, [serie]), "42501");
  assert.equal((await call(who.alumno1, 0, [serie])).reason, "conflicto_epoch");
  const r1 = await call(who.alumno1, 1, [serie, Object.assign({}, serie, { id: uuid(), kg: -1 }), Object.assign({}, serie, { id: uuid(), reps: "5" })],
    [{ clave: "s1", fecha: "2/11/2026", dia_idx: 0, semana: 1, ciclo: 1, rutina_nombre: "R", dia_label: "Día 1", ejercicios: "sentadilla", hora: "10:00", epoch_original: 0 }]);
  assert.deepEqual(r1.resultados.map((x) => x.resultado), ["insertada", "invalida", "invalida", "insertada"]);
  const r2 = await call(who.alumno1, 1, [serie], [{ clave: "s1", fecha: "02/11/2026", dia_idx: 0, semana: 1, ciclo: 1 }]);
  assert.deepEqual(r2.resultados.map((x) => x.resultado), ["ya_existia", "ya_existia"]);
  const row = (await as(null, "select historial_epoch, reingreso_de_epoch, reingreso_at is not null as aud from public.progreso where id = $1", [id])).rows[0];
  assert.deepEqual([Number(row.historial_epoch), Number(row.reingreso_de_epoch), row.aud], [1, 0, true]);
  await expectCode(call(who.alumno1, 1, Array.from({ length: 201 }, () => serie)), "22023");
});
await t("T11 auth_uid: ningún cliente lo cambia; service_role sí; editar otras columnas sigue funcionando", async () => {
  await expectCode(as(who.coach, "update public.alumnos set auth_uid = $1 where id = $2", [INTRUSO, A3]), "42501");
  await expectCode(as(who.anon, "insert into public.alumnos (nombre, auth_uid) values ('x', $1)", [INTRUSO]), "42501");
  await as(who.coach, "update public.alumnos set nombre = 'Alumno Tres B' where id = $1", [A3]);
  await as(who.alumno1, "update public.alumnos set onesignal_id = 'p1' where id = $1", [A1]);
  await as(who.service, "update public.alumnos set auth_uid = $1 where id = $2", [INTRUSO, A3]);
  await as(null, "update public.alumnos set auth_uid = null where id = $1", [A3]);
});
await t("T12 permisos: anon sin EXECUTE; it_private sin USAGE ni grants; search_path fijo en todas las funciones", async () => {
  const r = (await as(null, `select
    has_function_privilege('anon','public.it_historial_sello(uuid)','execute') a1,
    has_function_privilege('anon','public.it_limpiar_historial_alumno(uuid,bigint,boolean)','execute') a2,
    has_function_privilege('anon','public.it_historial_reingresar(uuid,bigint,jsonb,jsonb)','execute') a3,
    has_schema_privilege('authenticated','it_private','usage') a4,
    (select count(*) from pg_proc p where p.pronamespace='it_private'::regnamespace
       and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) c where c like 'search_path=%')) a5`)).rows[0];
  assert.deepEqual([r.a1, r.a2, r.a3, r.a4, Number(r.a5)], [false, false, false, false, 0]);
  await expectCode(as(who.alumno1, "select * from it_private.historial_estado"), "42501");
});
await t("T13 reinicio de ciclo no toca la época; series de ciclos anteriores con sello vigente se aceptan", async () => {
  await modo("activo"); await limpiar(who.coach, A1, 0);
  const s = await sello(who.alumno1, A1);
  await as(who.alumno1, "insert into public.progreso (alumno_id, ejercicio_id, kg, reps, fecha, semana, ciclo, historial_token) values ($1,'press',60,8,'03/11/2026',2,1,$2), ($1,'press',62,8,'04/11/2026',1,2,$2)", [A1, s.sello]);
  assert.equal(Number((await sello(who.alumno1, A1)).epoch), 1);
});

const rpc = async (w, fn, args) => (await as(w, "select public." + fn + " r", args)).rows[0].r;
await t("T14 alumno sin vínculo: sin sello (42501); solicita el vínculo de SU cuenta; terceros no pueden solicitarlo", async () => {
  await expectCode(sello(who.alumno3, A3), "42501");
  assert.equal((await rpc(who.intruso, "it_vinculo_solicitar($1)", [A3])).reason, "no_corresponde");       // email distinto
  assert.equal((await rpc(who.alumno1, "it_vinculo_solicitar($1)", [A3])).reason, "no_corresponde");       // ya vinculado a otro alumno
  assert.equal((await rpc(who.sinConfirmar, "it_vinculo_solicitar($1)", [A3])).reason, "no_corresponde");  // email sin confirmar
  assert.equal((await rpc(who.alumno3, "it_vinculo_solicitar($1)", ["b0000000-0000-4000-8000-0000000000ff"])).reason, "no_corresponde"); // alumno inexistente
  await expectCode(as(who.anon, "select public.it_vinculo_solicitar($1)", [A3]), "42501");
  assert.equal((await rpc(who.alumno3, "it_vinculo_solicitar($1)", [A3])).estado, "pendiente");
  const s = await sello(who.coach, A3);
  assert.equal(s.vinculado, false); assert.equal(s.solicitud_vinculo.email, "tres@ficticio.test"); assert.equal(s.solicitud_vinculo.auth_uid, U3);
  assert.equal(s.solicitud_vinculo !== undefined && (await sello(who.coach, A1)).solicitud_vinculo, null);
});
await t("T15 aprobación: solo el entrenador y solo la solicitud exacta; luego el alumno obtiene su sello y el borrado ya no exige confirmación", async () => {
  await rpc(who.alumno3, "it_vinculo_solicitar($1)", [A3]);
  await expectCode(as(who.alumno3, "select public.it_vinculo_aprobar($1, $2)", [A3, U3]), "42501");
  await expectCode(as(who.intruso, "select public.it_vinculo_aprobar($1, $2)", [A3, U3]), "42501");
  await expectCode(as(who.anon, "select public.it_vinculo_aprobar($1, $2)", [A3, U3]), "42501");
  assert.equal((await rpc(who.coach, "it_vinculo_aprobar($1, $2)", [A3, INTRUSO])).reason, "sin_solicitud");
  assert.equal((await rpc(who.coach, "it_vinculo_aprobar($1, $2)", [A3, U3])).estado, "vinculado");
  const fila = (await as(null, "select auth_uid from public.alumnos where id = $1", [A3])).rows[0];
  assert.equal(fila.auth_uid, U3);
  const cuenta = (await as(null, "select email, raw_app_meta_data from auth.users where id = $1", [U3])).rows[0];
  assert.deepEqual([cuenta.email, cuenta.raw_app_meta_data], ["tres@ficticio.test", {}]);              // la cuenta Auth NO se modifica
  assert.equal((await sello(who.alumno3, A3)).vinculado, true);
  assert.equal((await rpc(who.alumno3, "it_vinculo_solicitar($1)", [A3])).estado, "vinculado");
  assert.equal((await limpiar(who.coach, A3, 0)).ok, true);
});
await t("T16 la aprobación re-verifica: si el email del alumno cambió entretanto, no vincula", async () => {
  await rpc(who.alumno3, "it_vinculo_solicitar($1)", [A3]);
  await as(null, "update public.alumnos set email = 'otro@ficticio.test' where id = $1", [A3]);
  try { assert.equal((await rpc(who.coach, "it_vinculo_aprobar($1, $2)", [A3, U3])).reason, "no_corresponde"); }
  finally { await as(null, "update public.alumnos set email = 'tres@ficticio.test' where id = $1", [A3]); }
  assert.equal((await as(null, "select auth_uid from public.alumnos where id = $1", [A3])).rows[0].auth_uid, null);
});
await t("T17 ningún cliente abre las vías internas (auth_uid, borrado), ni con SQL directo", async () => {
  await rpc(who.alumno3, "it_vinculo_solicitar($1)", [A3]);
  await expectCode(as(who.coach, "update public.alumnos set auth_uid = $1 where id = $2", [U3, A3]), "42501");
  await expectCode(as(who.alumno3, "update public.alumnos set auth_uid = $1 where id = $2", [U3, A3]), "42501");
  // Con SQL directo (más de lo que permite PostgREST): ni una variable de sesión ni escribir la marca privada abren la vía interna.
  await expectCode(as(who.alumno3, "select set_config('it.historial_via', 'vinculo', true); update public.alumnos set auth_uid = '" + U3 + "' where id = '" + A3 + "'"), "42501");
  await expectCode(as(who.alumno3, "insert into it_private.via_tx values (txid_current(), 'vinculo')"), "42501");
  await expectCode(as(who.coach, "select it_private.via_marcar('limpiar')"), "42501");
  await expectCode(as(who.anon, "insert into it_private.via_tx values (txid_current(), 'limpiar'); delete from public.progreso"), "42501");
});

// ───────────── Concurrencia (locks reales) ─────────────
await t("C1 INSERT abierto (lock compartido) + borrado: el borrado ESPERA y luego borra la fila", async () => {
  await modo("activo");
  const a = await open(who.alumno1);
  await a.q(INS, [uuid(), A1, null, null, null]);                    // nunca borrado => aceptada, lock compartido retenido
  const b = limpiar(who.coach, A1, 0); const listo = settled(b);
  await pausa(400); assert.equal(listo(), false, "el borrado no esperó"); assert.ok(await esperando() >= 1);
  await a.close("commit");
  const r = await b; assert.equal(Number(r.progreso), 1); assert.equal(await filas(A1), 0);
});
await t("C2 borrado abierto (lock exclusivo) + INSERT con sello viejo: el INSERT ESPERA y luego IT409", async () => {
  await modo("activo");
  const viejo = (await sello(who.alumno1, A1)).sello;                 // null (nunca borrado)
  const a = await open(who.coach);
  await a.q("select public.it_limpiar_historial_alumno($1, 0, false)", [A1]);
  const b = insSerie(who.alumno1, A1, viejo); const listo = settled(b);
  await pausa(400); assert.equal(listo(), false, "el INSERT no esperó");
  await a.close("commit");
  await expectCode(b, "IT409"); assert.equal(await filas(A1), 0);
});
await t("C3 borrado abierto + INSERT con el sello que el borrado reemplaza: espera y IT409 (sin ventana intermedia)", async () => {
  await modo("activo"); await limpiar(who.coach, A1, 0);
  const s1 = (await sello(who.alumno1, A1)).sello;
  const a = await open(who.coach);
  await a.q("select public.it_limpiar_historial_alumno($1, 1, false)", [A1]);
  const b = insSerie(who.alumno1, A1, s1); const listo = settled(b);
  await pausa(400); assert.equal(listo(), false);
  await a.close("commit");
  await expectCode(b, "IT409");
});
await t("C4 estrés: 100 INSERT con sello viejo durante un borrado => sobreviven 0; luego 50 viejos + 50 vigentes => sobreviven 50", async () => {
  await modo("activo"); await limpiar(who.coach, A1, 0);
  const s1 = (await sello(who.alumno1, A1)).sello;
  const lote1 = Array.from({ length: 100 }, () => insSerie(who.alumno1, A1, s1).then(() => "ok", (e) => e.code));
  await pausa(5);
  const borrado = limpiar(who.coach, A1, 1);
  const res1 = await Promise.all(lote1); await borrado;
  assert.ok(res1.every((x) => x === "ok" || x === "IT409"), "códigos inesperados: " + [...new Set(res1)]);
  assert.equal(await filas(A1), 0, "sobrevivió una serie anterior al borrado");
  const s2 = (await sello(who.alumno1, A1)).sello;
  const res2 = await Promise.all(Array.from({ length: 100 }, (_, i) => insSerie(who.alumno1, A1, i % 2 ? s2 : s1).then(() => "ok", (e) => e.code)));
  assert.equal(res2.filter((x) => x === "ok").length, 50); assert.equal(await filas(A1), 50);
  const malas = (await as(null, "select count(*) n from public.progreso where alumno_id = $1 and historial_epoch <> 2", [A1])).rows[0].n;
  assert.equal(Number(malas), 0);
});
await t("C5 reingreso abierto + borrado: el borrado espera y se lleva lo reingresado; borrado abierto + reingreso => conflicto_epoch", async () => {
  await modo("activo"); await limpiar(who.coach, A1, 0);
  const serie = { id: uuid(), ejercicio_id: "sentadilla", kg: 100, reps: 5, fecha: "2/11/2026", semana: 1, ciclo: 1 };
  const a = await open(who.alumno1);
  await a.q("select public.it_historial_reingresar($1, 1, $2::jsonb, '[]'::jsonb)", [A1, JSON.stringify([serie])]);
  const b = limpiar(who.coach, A1, 1); const listo = settled(b);
  await pausa(400); assert.equal(listo(), false);
  await a.close("commit"); await b; assert.equal(await filas(A1), 0);
  const c = await open(who.coach);
  await c.q("select public.it_limpiar_historial_alumno($1, 2, false)", [A1]);
  const d = as(who.alumno1, "select public.it_historial_reingresar($1, 2, $2::jsonb, '[]'::jsonb) r", [A1, JSON.stringify([serie])]);
  const listo2 = settled(d); await pausa(400); assert.equal(listo2(), false);
  await c.close("commit");
  assert.equal((await d).rows[0].r.reason, "conflicto_epoch");
});
await t("C6 alumnos distintos no se bloquean entre sí", async () => {
  await modo("activo");
  const a = await open(who.coach);
  await a.q("select public.it_limpiar_historial_alumno($1, 0, false)", [A1]);
  await Promise.race([insSerie(who.alumno2, A2, null), pausa(1500).then(() => { throw new Error("A2 quedó bloqueado por A1"); })]);
  await a.close("commit");
});
await t("C7 doble clic del entrenador: dos borrados simultáneos con la misma época => uno ok, otro conflicto_epoch", async () => {
  const [x, y] = await Promise.all([limpiar(who.coach, A1, 0), limpiar(who.coach, A1, 0)]);
  assert.deepEqual([x.ok, y.ok].sort(), [false, true]);
  assert.equal([x, y].find((r) => !r.ok).reason, "conflicto_epoch");
});

await reset();
await pool.end();
console.log(`\n${ok} ok, ${fail} fallidas`);
process.exit(fail ? 1 : 0);
