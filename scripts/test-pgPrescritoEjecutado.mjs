// Prescrito vs. ejecutado con datos REALES de un PostgreSQL LOCAL (no Supabase): se aplican las migraciones REALES en el orden de despliegue
// (RLS v1 -> identidad remota -> copias) y el cliente real escribe copia, series y sesion con identidades de alumno VINCULADAS (app_metadata.alumno_id);
// luego se lee y se agrega con lib/prescritoEjecutadoResumen.js. El JWT se simula (request.jwt.claims): no es Supabase Auth.
//   node scripts/test-pgPrescritoEjecutado.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalPg, ESQUEMA_BASE, available } from "./lib/pgLocal.mjs";
import { esquemaApp } from "./lib/pgEsquemaApp.mjs";
import { makeRest } from "./lib/pgRest.mjs";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { ubicarEjercicioEnDia, construirIdentidadSerie } from "../lib/serieIdentidad.js";
import { buildSessionPayload, removeUndefinedPayloadFields, buildPendingProgressItem, buildProgressPayloadFromPending } from "../lib/workoutSession.js";
import { proyectarPayloadSesion } from "../lib/identidadRemota.js";
import { buildPrescripcionSnapshot } from "../lib/prescripcionSnapshot.js";
import { capturarCopiaAlIniciar, construirFilaCopia, enviarCopiasPendientes, __resetCopiasParaPruebas } from "../lib/prescripcionCopiaSync.js";
import { cargarPrescritoEjecutado } from "../lib/prescritoEjecutadoCarga.js";
import { ESTADO_COMPARACION as E } from "../lib/prescripcionComparacion.js";

if (!available()) { console.log("# omitido: no hay PostgreSQL local (binarios initdb/postgres/psql). Esta suite NO se considera ejecutada."); process.exit(0); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (...p) => readFileSync(path.join(ROOT, "docs", ...p), "utf8");
const RLS = rd("rls-v1", "1_migracion.sql"), IDENT = rd("identidad-remota-v1", "1_migracion.sql"), TABLA = rd("prescripcion-copias-v1", "1_tabla.sql"), ROLLBACK_TABLA = rd("prescripcion-copias-v1", "3_rollback.sql");
let n = 0; const test = async (name, fn) => { __resetCopiasParaPruebas(); await fn(); n++; console.log("ok -", name); };
const U = (c, i) => c.repeat(8) + "-" + c.repeat(4) + "-4" + c.repeat(3) + "-8" + c.repeat(3) + "-" + String(i).padStart(12, "0");
const A = U("1", 1), B = U("2", 1), UA = U("a", 1), UB = U("b", 1), UC = U("c", 1), UZ = U("f", 1), RA = U("5", 1), RB_ = U("6", 1);
const claims = { coach: (u) => ({ sub: u, role: "authenticated" }), alumno: (u, id) => ({ sub: u, role: "authenticated", app_metadata: { alumno_id: id } }) };
const T0 = new Date(2026, 10, 5, 10, 0).getTime(), MIN = 60000;
const rutina = (alumno) => ({ id: alumno === B ? RB_ : RA, nombre: "R", alumno_id: alumno, datos: { semana_activa: 1, days: [
  { label: "A", warmup: [{ id: "mov", name: "Mov", sets: "2", reps: "12", kg: "20" }], exercises: [{ id: "sq", name: "Sentadilla", sets: "3", reps: "8-10", kg: "50" }, { id: "bp", name: "Press", sets: "3", reps: "10", kg: "30" }] },
  { label: "B", warmup: [], exercises: [{ id: "row", name: "Remo", sets: "3", reps: "10", kg: "40" }] },
] } });
const DIAS = rutina(A).datos.days;
const memStorage = () => { const m = new Map(); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
let seq = 0; const opId = () => "00000000-0000-4000-8000-" + String(++seq).padStart(12, "0");

const pg = new LocalPg().start();
const ROLES = ESQUEMA_BASE.split("\n").find((l) => l.startsWith("create role"));
const SEED = `insert into auth.users (id, email, raw_app_meta_data) values ('${UA}','a@t.test','{"alumno_id":"${A}"}'),('${UB}','b@t.test','{"alumno_id":"${B}"}'),('${UC}','entrenador@irontrack.app','{}'),('${UZ}','z@t.test','{}');
insert into public.alumnos (id, nombre, email, entrenador_id) values ('${A}','A','a@t.test','${UC}'),('${B}','B','b@t.test','${UC}');
insert into public.rutinas (id, alumno_id, entrenador_id, nombre, datos) values ('${RA}','${A}','${UC}','R','${JSON.stringify(rutina(A).datos)}'),('${RB_}','${B}','${UC}','R','${JSON.stringify(rutina(B).datos)}');
create schema if not exists it_authz; create table if not exists it_authz.entrenadores_autorizados (uid uuid primary key, nota text, created_at timestamptz not null default now()); insert into it_authz.entrenadores_autorizados (uid) values ('${UC}');`;
let dbN = 0;
function nuevaBase(conTabla = true) { const db = "p" + (++dbN); pg.createDb(db, "tpl"); const r = pg.sql(SEED, db); assert.ok(r.ok, r.stderr); assert.ok(pg.sql(RLS, db).ok); assert.ok(pg.sql(IDENT, db).ok); if (conTabla) { const t = pg.sql(TABLA, db); assert.ok(t.ok, t.error && t.error.message); } return db; }
const como = (db, c) => makeRest(pg, db, { claims: c });
const del = (alumno) => (alumno === B ? claims.alumno(UB, B) : claims.alumno(UA, A));

// Entrena (cliente real) y escribe en PostgreSQL como ese alumno: copia (cola offline + envio idempotente), series con identidad y sesion al finalizar.
async function entrenar(db, alumno, { dia = 0, idxs, kgPor = {}, repsPor = {}, now = T0, identidad = true, copia = true, st = memStorage(), semana = 1, cola = memStorage() }) {
  const rest = como(db, del(alumno)); const R = rutina(alumno).id;
  const ini = prepararInicioEntrenamiento({ storage: st, alumnoId: alumno, session: { rId: R, dIdx: dia, exIdx: 0, startTime: now }, ciclo: 1, semana: semana - 1, now });
  const session = ini.session; const day = DIAS[dia];
  if (copia) {
    const cap = capturarCopiaAlIniciar({ activa: true, recuperada: ini.recuperada, storage: cola, rutina: rutina(alumno), alumnoId: alumno, session, capturadaEn: new Date(now).toISOString(), ahora: now }); assert.equal(cap.ok, true, JSON.stringify(cap));
    const env = await enviarCopiasPendientes({ storage: cola, alumnoId: alumno, post: (row) => rest.post("prescripcion_copias", row) }); assert.equal(env.enviadas + env.ya_guardadas, 1, JSON.stringify(env));
  }
  for (const idx of idxs) {
    const ubic = ubicarEjercicioEnDia(day, idx); const e = (ubic.bloque === "warmup" ? day.warmup : day.exercises)[ubic.pos]; const exId = e.id;
    const idSerie = construirIdentidadSerie({ session, alumnoId: alumno, ubicacion: ubic });
    const kg = kgPor[exId] != null ? kgPor[exId] : Number(e.kg); const reps = repsPor[exId] != null ? repsPor[exId] : 10;
    const item = buildPendingProgressItem(exId, kg, reps, "", session.fecha, semana - 1, 1, alumno, opId(), idSerie);
    const res = await rest.post("progreso", buildProgressPayloadFromPending(item, alumno, identidad)); assert.equal(res.status, 201, JSON.stringify(res.data));
  }
  const payload = removeUndefinedPayloadFields(proyectarPayloadSesion(buildSessionPayload({ alumnoId: alumno, session, activeDay: day, activeRoutine: { id: R, name: "R" }, exercises: day.exercises, weekToSave: semana, date: session.fecha, time: "11:00", includeRoutineId: true, ciclo: 1 }), session, alumno, identidad));
  const s = await rest.post("sesiones", payload); assert.equal(s.status, 201, JSON.stringify(s.data));
  return { session, uid: session.identity.sessionId };
}
// Lectura como la haria la app: con las politicas reales, via el cargador.
const cargar = (db, quien, alumno, o) => { const rest = como(db, quien); const rs = async (p) => rest.get(p); const fp = async (p) => { const r = await rest.get(p); return r.ok ? r.data : null; };
  return cargarPrescritoEjecutado(Object.assign({ alumnoId: alumno, requestStatus: rs, fetchPath: fp, registroCompletoPosible: quien.sub !== UC, pendientesLocales: () => 0 }, o || {})); };

try {
  assert.ok(pg.sql(ROLES, "postgres").ok);
  pg.createDb("tpl"); assert.ok(pg.sql(ESQUEMA_BASE.replace(ROLES, "") + esquemaApp("text"), "tpl").ok);

  await test("tabla de copias: exige la migracion RLS; crea con RLS y politicas reales; restricciones, idempotencia por clave+huella, inmutabilidad y rollback", async () => {
    const sinRls = "x0"; pg.createDb(sinRls, "tpl"); const r0 = pg.sql(TABLA, sinRls); assert.equal(r0.ok, false); assert.match(r0.error.message, /falta la migracion RLS/); assert.equal(pg.scalar("(select count(*) from pg_class where relname = 'prescripcion_copias')", sinRls), 0);
    const db = nuevaBase();
    assert.equal(pg.scalar("(select relrowsecurity from pg_class where oid = 'public.prescripcion_copias'::regclass)", db), true);
    assert.deepEqual(pg.rows("select policyname, cmd from pg_policies where tablename = 'prescripcion_copias' order by 1", db).map((p) => p.cmd), ["INSERT", "SELECT"], "solo select e insert: nada se actualiza ni se borra");
    assert.equal(pg.scalar("(select count(*) from pg_constraint where conrelid = 'public.prescripcion_copias'::regclass and contype = 'f')", db), 0, "sin FK");
    assert.ok(pg.sql(TABLA, db).ok, "reejecucion segura");
    const sup = (o) => pg.tryRows("insert into public.prescripcion_copias (alumno_id, rutina_id, ciclo, semana, dia_idx, fecha_dia, prescripcion_hash, snapshot) values ('" + A + "','r'," + (o.ciclo == null ? 1 : o.ciclo) + "," + (o.semana == null ? 1 : o.semana) + "," + (o.dia == null ? 0 : o.dia) + ",'2026-11-05','" + (o.hash || "sha256:" + "b".repeat(64)) + "','" + (o.snap || "{}") + "') returning id", db);
    assert.ok(sup({}).ok); assert.equal(sup({}).error.code, "23505"); assert.ok(sup({ hash: "sha256:" + "c".repeat(64) }).ok, "huella distinta, misma clave: permitida (la lectura la marca ambigua)");
    for (const [o, code] of [[{ semana: 5 }, "23514"], [{ semana: 0 }, "23514"], [{ dia: -1 }, "23514"], [{ ciclo: 0 }, "23514"], [{ hash: "md5:x" }, "23514"], [{ snap: "[]" }, "23514"]]) assert.equal(sup(o).error.code, code, JSON.stringify(o));
    assert.ok(pg.sql(ROLLBACK_TABLA, db).ok); assert.equal(pg.scalar("(select count(*) from pg_class where relname = 'prescripcion_copias')", db), 0); assert.ok(pg.sql(ROLLBACK_TABLA, db).ok);
  });

  await test("permisos de las copias: el alumno solo inserta/lee las suyas de SU rutina; el entrenador lee las de sus alumnos; nadie actualiza ni borra; anon y sin vinculo, nada", async () => {
    const db = nuevaBase(); const a = como(db, claims.alumno(UA, A)), b = como(db, claims.alumno(UB, B)), c = como(db, claims.coach(UC));
    const fila = (alumno, rutinaId, extra) => Object.assign({ alumno_id: alumno, rutina_id: rutinaId, ciclo: 1, semana: 1, dia_idx: 0, fecha_dia: "2026-11-05", prescripcion_hash: "sha256:" + "a".repeat(64), snapshot: { v: 1 } }, extra || {});
    assert.equal((await a.post("prescripcion_copias", fila(A, RA))).status, 201);
    assert.equal((await a.post("prescripcion_copias", fila(A, RA))).data.code, "23505", "reintento idempotente");
    assert.equal((await a.post("prescripcion_copias", fila(B, RB_))).data.code, "42501", "A no escribe copias de B");
    assert.equal((await a.post("prescripcion_copias", fila(A, RB_, { prescripcion_hash: "sha256:" + "d".repeat(64) }))).data.code, "42501", "ni de una rutina que no es suya");
    assert.equal((await b.post("prescripcion_copias", fila(B, RB_))).status, 201);
    assert.equal((await a.get("prescripcion_copias?select=alumno_id")).data.map((x) => x.alumno_id).join(), A); assert.equal((await b.get("prescripcion_copias?select=alumno_id")).data.map((x) => x.alumno_id).join(), B);
    assert.equal((await c.get("prescripcion_copias?select=alumno_id")).data.length, 2, "el entrenador ve las de sus alumnos");
    const sinEfecto = (r, m) => assert.ok(r.ok ? r.data.length === 0 : r.data.code === "42501", m + " " + JSON.stringify(r.data)); // sin privilegio (42501) o sin filas: en ambos casos no cambia nada
    sinEfecto(await a.patch("prescripcion_copias?alumno_id=eq." + A, { snapshot: { v: 2 } }), "inmutable: no se actualiza"); sinEfecto(await a.delete("prescripcion_copias?alumno_id=eq." + A), "no se borra"); sinEfecto(await c.delete("prescripcion_copias?alumno_id=eq." + A), "ni el entrenador"); sinEfecto(await c.patch("prescripcion_copias?alumno_id=eq." + A, { snapshot: { v: 3 } }), "ni el entrenador actualiza");
    assert.equal(pg.scalar("(select jsonb_typeof(snapshot) from public.prescripcion_copias where alumno_id = '" + A + "')", db), "object");
    assert.equal((await como(db, claims.coach(UZ)).get("prescripcion_copias?select=id")).data.length, 0); assert.equal((await como(db, { sub: UZ, role: "authenticated", app_metadata: { alumno_id: A.replace(/^1/, "9") } }).get("prescripcion_copias?select=id")).data.length, 0);
    assert.equal((await makeRest(pg, db, { role: "anon" }).get("prescripcion_copias?select=id")).data.code, "42501");
  });

  await test("flujo real bajo RLS: copia al iniciar (cola offline -> envio), series con identidad y sesion; el alumno y el entrenador leen la misma comparacion verificable con semana completa", async () => {
    const db = nuevaBase(); const cola = memStorage();
    const a1 = await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], repsPor: { sq: 9, mov: 12 }, cola });
    assert.equal(cola.length, 0, "la cola local quedo vacia tras el envio");
    const propio = await cargar(db, claims.alumno(UA, A), A, {}); assert.equal(propio.estado, "ok", JSON.stringify(propio));
    const c = propio.resultado.sesiones[0].comparacion; assert.equal(c.estado, E.VERIFICABLE, JSON.stringify(c.motivos)); assert.equal(c.series.vinculadas, 8);
    assert.deepEqual(propio.resultado.semanas.map((w) => [w.ciclo, w.semana, w.estado]), [[1, 1, "completo"]]);
    assert.deepEqual([propio.resultado.global.porcentajes.series.valor, propio.resultado.global.porcentajes.reps.valor, propio.resultado.global.porcentajes.kg.valor], [100, 100, 100]);
    const coach = await cargar(db, claims.coach(UC), A, {}); assert.equal(coach.estado, "ok"); assert.equal(coach.resultado.sesiones[0].comparacion.estado, E.VERIFICABLE); assert.equal(coach.cobertura.registro_completo, false, "el entrenador no puede afirmar registro completo");
    assert.equal(propio.resultado.sesiones[0].sesion_uid, a1.uid);
    const ajeno = await cargar(db, claims.alumno(UB, B), A, {}); assert.equal(ajeno.estado, "ok"); assert.equal(ajeno.resultado.global.sesiones_total, 0, "B no ve nada de A: 0 sesiones, no un error ni datos de A");
  });

  await test("offline real: la copia queda en la cola, el entrenamiento se completa, y al volver la red se envia una sola vez (reintento = ya guardada); recargar no genera otra copia", async () => {
    const db = nuevaBase(); const cola = memStorage(), st = memStorage(); const rest = como(db, claims.alumno(UA, A));
    const ini = prepararInicioEntrenamiento({ storage: st, alumnoId: A, session: { rId: RA, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 });
    assert.equal(capturarCopiaAlIniciar({ activa: true, recuperada: ini.recuperada, storage: cola, rutina: rutina(A), alumnoId: A, session: ini.session, ahora: T0 }).ok, true);
    const off = await enviarCopiasPendientes({ storage: cola, alumnoId: A, post: async () => { throw new Error("network"); } }); assert.equal(off.pendientes, 1); assert.equal(cola.length, 1);
    const rec = prepararInicioEntrenamiento({ storage: st, alumnoId: A, session: { rId: RA, dIdx: 0, exIdx: 0, startTime: T0 + 5 * MIN }, ciclo: 1, semana: 0, now: T0 + 5 * MIN }); assert.equal(rec.recuperada, true);
    assert.equal(capturarCopiaAlIniciar({ activa: true, recuperada: rec.recuperada, storage: cola, rutina: rutina(A), alumnoId: A, session: rec.session }).motivo, "reanudacion"); assert.equal(cola.length, 1);
    const on = await enviarCopiasPendientes({ storage: cola, alumnoId: A, post: (row) => rest.post("prescripcion_copias", row) }); assert.equal(on.enviadas, 1); assert.equal(cola.length, 0);
    capturarCopiaAlIniciar({ activa: true, storage: cola, rutina: rutina(A), alumnoId: A, session: ini.session });                                 // respuesta perdida: reencolada
    const dup = await enviarCopiasPendientes({ storage: cola, alumnoId: A, post: (row) => rest.post("prescripcion_copias", row) }); assert.deepEqual([dup.ya_guardadas, dup.pendientes], [1, 0]);
    assert.equal(pg.scalar("(select count(*) from public.prescripcion_copias)", db), 1);
  });

  await test("tabla ausente (migracion de copias sin aplicar): el cargador informa 'sin_tabla' y el envio corta sin perder la cola; el entrenamiento no se afecta", async () => {
    const db = nuevaBase(false); const rest = como(db, claims.alumno(UA, A)); const cola = memStorage(); const ini = prepararInicioEntrenamiento({ storage: memStorage(), alumnoId: A, session: { rId: RA, dIdx: 0, exIdx: 0, startTime: T0 }, ciclo: 1, semana: 0, now: T0 });
    capturarCopiaAlIniciar({ activa: true, storage: cola, rutina: rutina(A), alumnoId: A, session: ini.session });
    const env = await enviarCopiasPendientes({ storage: cola, alumnoId: A, post: async (row) => { const r = await rest.post("prescripcion_copias", row); return r.ok ? r : { ok: false, status: 404, data: { code: "PGRST205", message: "table not in schema cache" } }; } });
    assert.equal(env.rechazada, true); assert.equal(cola.length, 1);
    const carga = await cargar(db, claims.alumno(UA, A), A, { requestStatus: async (p) => (p.startsWith("prescripcion_copias") ? { ok: false, status: 404, data: { code: "PGRST205" } } : rest.get(p)) }); assert.equal(carga.estado, "sin_tabla");
  });

  await test("omision y parcial reales (con registro completo del propio alumno); el entrenador y un historial incompleto no afirman omision", async () => {
    const db = nuevaBase(); await entrenar(db, A, { idxs: [0, 0, 1, 1] });
    const w = (await cargar(db, claims.alumno(UA, A), A, {})).resultado.semanas[0]; assert.deepEqual([w.ejercicios.completos, w.ejercicios.parciales, w.ejercicios.omitidos], [1, 1, 1]);
    const c = (await cargar(db, claims.coach(UC), A, {})).resultado.semanas[0]; assert.equal(c.ejercicios.omitidos, 0); assert.equal(c.ejercicios.sin_evidencia_de_omision, 2);
    const pend = (await cargar(db, claims.alumno(UA, A), A, { pendientesLocales: () => 1 })).resultado.semanas[0]; assert.equal(pend.ejercicios.omitidos, 0, "con series sin sincronizar no se afirma omision");
  });

  await test("dos alumnos el mismo dia, dos sesiones el mismo dia y semana sin copia: cada una con su copia; sin copia propia nunca se usa otra ni la rutina actual", async () => {
    const db = nuevaBase(); const stA = memStorage();
    await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], st: stA }); await entrenar(db, B, { idxs: [0, 1, 2], now: T0 + MIN });
    await entrenar(db, A, { dia: 1, idxs: [0, 0, 0], now: T0 + 30 * MIN, st: stA });
    await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], now: T0 + 7 * 24 * 60 * MIN, semana: 2, copia: false, st: memStorage() });
    const r = (await cargar(db, claims.alumno(UA, A), A, {})).resultado;
    assert.deepEqual(r.semanas.map((w) => [w.semana, w.sesiones_total, w.sesiones_verificables]), [[1, 2, 2], [2, 1, 0]]);
    assert.equal(r.sesiones.find((x) => x.semana === 2).comparacion.estado, E.SIN_COPIA); assert.equal(r.global.estado, "parcial");
    const rb = (await cargar(db, claims.alumno(UB, B), B, {})).resultado; assert.equal(rb.sesiones[0].comparacion.estado, E.VERIFICABLE); assert.equal(rb.global.series.ejecutadas, 3);
  });

  await test("el entrenador edita la rutina DESPUES: la copia guardada y la comparacion de la sesion pasada no cambian; una sesion posterior captura la prescripcion nueva con otra huella", async () => {
    const db = nuevaBase(); await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], repsPor: { sq: 9, mov: 12 } });
    const antes = await cargar(db, claims.alumno(UA, A), A, {}); const hash0 = pg.scalar("(select prescripcion_hash from public.prescripcion_copias)", db); const snap0 = pg.scalar("(select snapshot::text from public.prescripcion_copias)", db);
    assert.equal(antes.resultado.sesiones[0].comparacion.estado, E.VERIFICABLE);
    const nuevaRutina = rutina(A); nuevaRutina.datos.days[0].exercises[0].kg = "120"; nuevaRutina.datos.days[0].exercises[0].sets = "5"; nuevaRutina.datos.days[0].exercises[0].reps = "3";
    const ed = await como(db, claims.coach(UC)).patch("rutinas?id=eq." + RA, { datos: nuevaRutina.datos }); assert.equal(ed.data.length, 1, "el entrenador edita la rutina");
    const despues = await cargar(db, claims.alumno(UA, A), A, {}); const coachVe = await cargar(db, claims.coach(UC), A, {});
    assert.deepEqual(despues.resultado, antes.resultado, "la comparacion de la sesion pasada no cambia con la edicion");
    assert.equal(pg.scalar("(select prescripcion_hash from public.prescripcion_copias)", db), hash0); assert.equal(pg.scalar("(select snapshot::text from public.prescripcion_copias)", db), snap0, "la copia es byte a byte la original");
    assert.equal(coachVe.resultado.sesiones[0].comparacion.ejercicios.find((e) => e.ejercicio_id === "sq").variables.kg.prescrito.texto, "50", "el entrenador ve lo que se prescribio ese dia (50), no la rutina nueva (120)");
    const nueva = construirFilaCopia({ rutina: Object.assign({}, nuevaRutina, { id: RA }), alumnoId: A, session: prepararInicioEntrenamiento({ storage: memStorage(), alumnoId: A, session: { rId: RA, dIdx: 0, exIdx: 0, startTime: T0 + 24 * 60 * MIN }, ciclo: 1, semana: 0, now: T0 + 24 * 60 * MIN }).session });
    assert.equal(nueva.ok, true); assert.notEqual(nueva.row.prescripcion_hash, hash0); assert.equal(nueva.row.snapshot.ejercicios.find((e) => e.id === "sq").kg, "120", "una sesion posterior captura lo nuevo");
    assert.equal(como(db, claims.alumno(UA, A)) && (await como(db, claims.alumno(UA, A)).patch("prescripcion_copias?alumno_id=eq." + A, { prescripcion_hash: "sha256:" + "e".repeat(64) })).ok, false, "y la copia vieja no se puede reescribir");
  });

  await test("copia ambigua (dos huellas): ninguna se elige; la edicion posterior de la rutina no reescribe el pasado; sesiones historicas sin identidad: estados explicitos sin porcentajes", async () => {
    const db = nuevaBase(); const a = await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2] });
    const editada = rutina(A); editada.datos.days[0].exercises[0].kg = "80";
    const r2 = buildPrescripcionSnapshot({ rutina: editada, alumnoId: A, diaIdx: 0, semana: 1, fecha: a.session.fecha, semanaMostrada: 1, capturadaEn: "2026-11-06T00:00:00.000Z" });
    pg.sql("insert into public.prescripcion_copias (alumno_id, rutina_id, ciclo, semana, dia_idx, fecha_dia, prescripcion_hash, snapshot) values ('" + A + "','" + RA + "',1,1,0,'" + r2.clave.fecha_dia + "','" + r2.hash + "','" + JSON.stringify(r2.snapshot) + "')", db);
    assert.equal((await cargar(db, claims.alumno(UA, A), A, {})).resultado.sesiones[0].comparacion.estado, E.AMBIGUA);
    const db2 = nuevaBase(); pg.sql("insert into public.sesiones (alumno_id, rutina_id, rutina_nombre, dia_idx, semana, fecha, hora) values ('" + A + "','" + RA + "','R',0,1,'1/11/2026','10:00'); insert into public.progreso (alumno_id, ejercicio_id, kg, reps, fecha, semana) values ('" + A + "','sq',50,8,'1/11/2026',0);", db2);
    await entrenar(db2, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], identidad: false, now: T0 + 5 * 24 * 60 * MIN });
    const r = (await cargar(db2, claims.alumno(UA, A), A, {})).resultado; assert.ok(r.sesiones.every((x) => !x.comparacion.verificable)); assert.ok(r.sesiones.every((x) => x.evidencia_finalizacion === "ninguna"));
    assert.equal(r.global.estado, "sin_datos_para_comparar"); assert.equal(r.global.porcentajes.series.valor, null); assert.equal(r.global.porcentajes.cobertura_sesiones.valor, 0);
  });
} finally { pg.stop(); }
console.log("\n" + n + " pruebas OK (PostgreSQL local, NO Supabase)");
