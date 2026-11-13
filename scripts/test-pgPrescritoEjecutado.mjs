// Prescrito vs. ejecutado con datos REALES de un PostgreSQL LOCAL (no Supabase): identidad de sesion/series escrita por el cliente real, copia historica
// en la tabla propuesta (docs/prescripcion-copias-v1/1_tabla.sql) y lectura + agregacion con lib/prescritoEjecutadoResumen.js.
//   node scripts/test-pgPrescritoEjecutado.mjs
// La politica de la tabla de copias en esta prueba es SOLO DE PRUEBA (la tabla real se crea sin politicas; las define el carril de RLS).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LocalPg, ESQUEMA_BASE, available } from "./lib/pgLocal.mjs";
import { makeRest } from "./lib/pgRest.mjs";
import { prepararInicioEntrenamiento } from "../lib/workoutSessionDate.js";
import { ubicarEjercicioEnDia, construirIdentidadSerie } from "../lib/serieIdentidad.js";
import { buildSessionPayload, removeUndefinedPayloadFields, buildPendingProgressItem, buildProgressPayloadFromPending, buildExerciseSetRecord } from "../lib/workoutSession.js";
import { proyectarPayloadSesion } from "../lib/identidadRemota.js";
import { buildPrescripcionSnapshot } from "../lib/prescripcionSnapshot.js";
import { compararSesionesDelAlumno } from "../lib/prescritoEjecutadoResumen.js";
import { ESTADO_COMPARACION as E } from "../lib/prescripcionComparacion.js";

if (!available()) { console.log("# omitido: no hay PostgreSQL local (binarios initdb/postgres/psql). Esta suite NO se considera ejecutada."); process.exit(0); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "docs");
const MIG = readFileSync(path.join(DOCS, "identidad-remota-v1", "1_migracion.sql"), "utf8");
const TABLA = readFileSync(path.join(DOCS, "prescripcion-copias-v1", "1_tabla.sql"), "utf8");
const ROLLBACK_TABLA = readFileSync(path.join(DOCS, "prescripcion-copias-v1", "3_rollback.sql"), "utf8");
let n = 0; const test = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

const A = "alumno-a", B = "alumno-b", R = "rutina-1";
const T0 = new Date(2026, 10, 5, 10, 0).getTime(), MIN = 60000;
const rutina = (alumno) => ({ id: R, nombre: "R", alumno_id: alumno, datos: { semana_activa: 1, days: [
  { label: "A", warmup: [{ id: "mov", name: "Mov", sets: "2", reps: "12", kg: "20" }], exercises: [{ id: "sq", name: "Sentadilla", sets: "3", reps: "8-10", kg: "50" }, { id: "bp", name: "Press", sets: "3", reps: "10", kg: "30" }] },
  { label: "B", warmup: [], exercises: [{ id: "row", name: "Remo", sets: "3", reps: "10", kg: "40" }] },
] } });
const DIAS = rutina(A).datos.days;
const memStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
let seq = 0; const opId = () => "00000000-0000-4000-8000-" + String(++seq).padStart(12, "0");

const pg = new LocalPg().start();
const ROLES = ESQUEMA_BASE.split("\n").find((l) => l.startsWith("create role"));
let dbN = 0;
const TEST_POLICY = "grant select, insert on public.prescripcion_copias to authenticated; create policy solo_prueba on public.prescripcion_copias for all to authenticated using (alumno_id = (auth.jwt() ->> 'sub')) with check (alumno_id = (auth.jwt() ->> 'sub'));";
function nuevaBase(conTabla) { const db = "p" + (++dbN); pg.createDb(db, "tpl"); if (conTabla) assert.ok(pg.sql(TABLA + (conTabla === "politica" ? TEST_POLICY : ""), db).ok); return db; }

// Entrena (cliente real) y escribe en PostgreSQL: copia al iniciar, series con identidad, sesion al finalizar.
async function entrenar(db, alumno, { dia = 0, idxs, kgPor = {}, repsPor = {}, now = T0, identidad = true, copia = true, st = memStorage(), semana = 1 }) {
  const rest = makeRest(pg, db, { sub: alumno });
  const ini = prepararInicioEntrenamiento({ storage: st, alumnoId: alumno, session: { rId: R, dIdx: dia, exIdx: 0, startTime: now }, ciclo: 1, semana: semana - 1, now });
  const session = ini.session; const day = DIAS[dia];
  let copiaRow = null;
  if (copia) {
    const r = buildPrescripcionSnapshot({ rutina: rutina(alumno), alumnoId: alumno, diaIdx: dia, semana, fecha: session.fecha, semanaMostrada: semana, capturadaEn: new Date(now).toISOString() }); assert.ok(r.ok);
    copiaRow = { alumno_id: alumno, rutina_id: R, ciclo: r.clave.ciclo, semana, dia_idx: dia, fecha_dia: r.clave.fecha_dia, prescripcion_hash: r.hash, snapshot: r.snapshot };
    const w = await rest.post("prescripcion_copias", copiaRow); assert.equal(w.status, 201, JSON.stringify(w.data));
  }
  const ops = [];
  for (const idx of idxs) {
    const ubic = ubicarEjercicioEnDia(day, idx); const exId = ubic.ejercicioId || (ubic.bloque === "warmup" ? day.warmup[ubic.pos].id : day.exercises[ubic.pos].id);
    const idSerie = construirIdentidadSerie({ session, alumnoId: alumno, ubicacion: ubic });
    const kg = kgPor[exId] != null ? kgPor[exId] : Number((day.warmup.concat(day.exercises).find((e) => e.id === exId) || {}).kg); const reps = repsPor[exId] != null ? repsPor[exId] : 10;
    const id = opId(); const item = buildPendingProgressItem(exId, kg, reps, "", session.fecha, semana - 1, 1, alumno, id, idSerie);
    const res = await rest.post("progreso", buildProgressPayloadFromPending(item, alumno, identidad)); assert.equal(res.status, 201, JSON.stringify(res.data)); ops.push(id);
  }
  const payload = removeUndefinedPayloadFields(proyectarPayloadSesion(buildSessionPayload({ alumnoId: alumno, session, activeDay: day, activeRoutine: { id: R, name: "R" }, exercises: day.exercises, weekToSave: semana, date: session.fecha, time: "11:00", includeRoutineId: true, ciclo: 1 }), session, alumno, identidad));
  const s = await rest.post("sesiones", payload); assert.equal(s.status, 201, JSON.stringify(s.data));
  return { session, copiaRow, ops, uid: session.identity.sessionId };
}
const leer = (db, alumno) => {
  const rest = makeRest(pg, db, { role: null });
  return {
    sesiones: pg.rows("select * from public.sesiones where alumno_id = '" + alumno + "' order by created_at, id", db),
    series: pg.rows("select * from public.progreso where alumno_id = '" + alumno + "' order by created_at, id", db),
    copias: pg.rows("select * from public.prescripcion_copias where alumno_id = '" + alumno + "' order by created_at, id", db).map((c) => Object.assign({ origen_lectura: "servidor" }, c)), rest,
  };
};
const comparar = (d, ctxExtra, copiasOverride) => compararSesionesDelAlumno({ sesiones: d.sesiones, copias: copiasOverride || d.copias, series: d.series,
  contexto: Object.assign({ registroSeriesCompleto: true, planificacionMostradaHash: (s) => { const c = d.copias.find((x) => x.dia_idx === s.dia_idx && x.semana === Number(s.semana)); return c ? c.prescripcion_hash : ""; } }, ctxExtra || {}) });

try {
  assert.ok(pg.sql(ROLES, "postgres").ok);
  pg.createDb("tpl"); assert.ok(pg.sql(ESQUEMA_BASE.replace(ROLES, ""), "tpl").ok); assert.ok(pg.sql(MIG, "tpl").ok);

  await test("tabla de copias: crea, con RLS sin politicas (nadie escribe), restricciones, idempotencia por clave+huella y rollback", async () => {
    const db = nuevaBase(true);
    assert.equal(pg.scalar("(select relrowsecurity from pg_class where oid = 'public.prescripcion_copias'::regclass)", db), true);
    assert.equal(pg.scalar("(select count(*) from pg_policies where tablename = 'prescripcion_copias')", db), 0, "sin politicas: se definen en el carril RLS");
    assert.equal(pg.scalar("(select count(*) from pg_constraint where conrelid = 'public.prescripcion_copias'::regclass and contype = 'f')", db), 0, "sin FK");
    assert.ok(pg.sql(TABLA, db).ok, "reejecucion segura");
    const sinPolitica = await makeRest(pg, db, { sub: A }).post("prescripcion_copias", { alumno_id: A, rutina_id: R, ciclo: 1, semana: 1, dia_idx: 0, fecha_dia: "2026-11-05", prescripcion_hash: "sha256:" + "a".repeat(64), snapshot: {} });
    assert.equal(sinPolitica.data.code, "42501", "authenticated sin grant ni politica: rechazado (no se amplian permisos)");
    const sup = (o) => pg.tryRows("insert into public.prescripcion_copias (alumno_id, rutina_id, ciclo, semana, dia_idx, fecha_dia, prescripcion_hash, snapshot) values ('" + (o.alumno || A) + "','r'," + (o.ciclo == null ? 1 : o.ciclo) + "," + (o.semana == null ? 1 : o.semana) + "," + (o.dia == null ? 0 : o.dia) + ",'2026-11-05','" + (o.hash || "sha256:" + "b".repeat(64)) + "','" + (o.snap || "{}") + "') returning id", db);
    assert.ok(sup({}).ok); assert.equal(sup({}).error.code, "23505"); assert.ok(sup({ hash: "sha256:" + "c".repeat(64) }).ok, "huella distinta, misma clave: permitida (la lectura la marca ambigua)");
    for (const [o, code] of [[{ semana: 5 }, "23514"], [{ semana: 0 }, "23514"], [{ dia: -1 }, "23514"], [{ ciclo: 0 }, "23514"], [{ hash: "md5:x" }, "23514"], [{ snap: "[]" }, "23514"]]) assert.equal(sup(o).error.code, code, JSON.stringify(o));
    assert.ok(pg.sql(ROLLBACK_TABLA, db).ok); assert.equal(pg.scalar("(select count(*) from pg_class where relname = 'prescripcion_copias')", db), 0); assert.ok(pg.sql(ROLLBACK_TABLA, db).ok);
  });

  await test("flujo real: copia al iniciar + series con identidad + sesion finalizada => comparacion verificable leida de PostgreSQL; semana completa con porcentajes", async () => {
    const db = nuevaBase("politica");
    const a1 = await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], repsPor: { sq: 9, mov: 12 } });   // calentamiento x2, sentadilla x3, press x3
    const d = leer(db, A); assert.equal(d.sesiones.length, 1); assert.equal(d.series.length, 8); assert.equal(d.copias.length, 1);
    assert.ok(d.series.every((s) => s.sesion_uid === a1.uid && ["warmup", "main"].includes(s.bloque))); assert.equal(d.sesiones[0].identidad_v, 1);
    const r = comparar(d); const c = r.sesiones[0].comparacion;
    assert.equal(c.estado, E.VERIFICABLE, JSON.stringify(c.motivos)); assert.equal(c.series.vinculadas, 8);
    assert.deepEqual(r.semanas.map((w) => [w.ciclo, w.semana, w.estado]), [[1, 1, "completo"]]);
    assert.deepEqual([r.global.porcentajes.series.valor, r.global.porcentajes.reps.valor, r.global.porcentajes.kg.valor], [100, 100, 100]);
  });

  await test("omision y parcial reales: press sin registrar y sentadilla con 2 de 3 series => omitido/parcial con registro completo; sin esa evidencia no se afirma omision", async () => {
    const db = nuevaBase("politica");
    await entrenar(db, A, { idxs: [0, 0, 1, 1] });
    const d = leer(db, A); const w = comparar(d).semanas[0];
    assert.deepEqual([w.ejercicios.completos, w.ejercicios.parciales, w.ejercicios.omitidos], [1, 1, 1]);
    const sin = comparar(d, { registroSeriesCompleto: false }).semanas[0]; assert.equal(sin.ejercicios.omitidos, 0); assert.equal(sin.ejercicios.sin_evidencia_de_omision, 2);
  });

  await test("dos alumnos el mismo dia: filas mezcladas en la entrada no contaminan; cada alumno solo ve su prescripcion y sus series", async () => {
    const db = nuevaBase("politica");
    await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2] }); await entrenar(db, B, { idxs: [0, 1, 2], now: T0 + MIN });
    const da = leer(db, A), dbb = leer(db, B);
    const mezcla = { sesiones: da.sesiones, copias: da.copias.concat(dbb.copias), series: da.series.concat(dbb.series) };
    const r = comparar(mezcla); assert.equal(r.sesiones.length, 1); assert.equal(r.sesiones[0].comparacion.estado, E.VERIFICABLE, JSON.stringify(r.sesiones[0].comparacion.motivos));
    const rb = comparar(dbb); assert.equal(rb.sesiones[0].comparacion.estado, E.VERIFICABLE); assert.equal(rb.global.series.ejecutadas, 3);
    assert.notEqual(rb.sesiones[0].sesion_uid, r.sesiones[0].sesion_uid);
  });

  await test("dos sesiones el mismo dia (dias A y B) y semanas distintas: cada una con su copia; la semana 2 no usa la copia de la semana 1", async () => {
    const db = nuevaBase("politica"); const st = memStorage();
    await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], st }); await entrenar(db, A, { dia: 1, idxs: [0, 0, 0], now: T0 + 30 * MIN, st });
    await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], now: T0 + 7 * 24 * 60 * MIN, semana: 2, copia: false, st: memStorage() });
    const r = comparar(leer(db, A));
    assert.deepEqual(r.semanas.map((w) => [w.semana, w.sesiones_total, w.sesiones_verificables]), [[1, 2, 2], [2, 1, 0]]);
    const s2 = r.sesiones.find((x) => x.semana === 2).comparacion; assert.equal(s2.estado, E.SIN_COPIA, "sin copia propia: nunca se usa la de otra semana ni la rutina actual");
    assert.equal(r.global.estado, "parcial");
  });

  await test("copia ambigua (dos huellas para la misma clave): ninguna se elige; la edicion posterior de la rutina no reescribe el pasado", async () => {
    const db = nuevaBase("politica"); const a = await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2] });
    const editada = rutina(A); editada.datos.days[0].exercises[0].kg = "80";
    const r2 = buildPrescripcionSnapshot({ rutina: editada, alumnoId: A, diaIdx: 0, semana: 1, fecha: a.session.fecha, semanaMostrada: 1, capturadaEn: "2026-11-06T00:00:00.000Z" });
    const w = await makeRest(pg, db, { sub: A }).post("prescripcion_copias", { alumno_id: A, rutina_id: R, ciclo: 1, semana: 1, dia_idx: 0, fecha_dia: r2.clave.fecha_dia, prescripcion_hash: r2.hash, snapshot: r2.snapshot }); assert.equal(w.status, 201);
    const rep = await makeRest(pg, db, { sub: A }).post("prescripcion_copias", a.copiaRow); assert.equal(rep.status, 409); assert.match(rep.data.message, /prescripcion_copias_clave_hash_uq/);
    const r = comparar(leer(db, A)); assert.equal(r.sesiones[0].comparacion.estado, E.AMBIGUA);
  });

  await test("sesiones historicas (sin identidad, sin copia) y bandera apagada: estados explicitos, nada inventado, sin porcentajes", async () => {
    const db = nuevaBase("politica");
    pg.sql("insert into public.sesiones (alumno_id, rutina_id, rutina_nombre, dia_idx, semana, fecha, hora) values ('" + A + "','" + R + "','R',0,1,'1/11/2026','10:00'); insert into public.progreso (alumno_id, ejercicio_id, kg, reps, fecha, semana) values ('" + A + "','sq',50,8,'1/11/2026',0),('" + A + "','sq',50,8,'1/11/2026',0);", db);
    await entrenar(db, A, { idxs: [0, 0, 1, 1, 1, 2, 2, 2], identidad: false, now: T0 + 5 * 24 * 60 * MIN }); // esquema migrado pero bandera apagada: filas sin identidad
    const d = leer(db, A); assert.ok(d.series.every((s) => s.sesion_uid === null)); assert.ok(d.sesiones.every((s) => s.sesion_uid === null));
    const r = comparar(d); assert.ok(r.sesiones.every((x) => !x.comparacion.verificable)); assert.ok(r.sesiones.every((x) => x.evidencia_finalizacion === "ninguna"));
    assert.equal(r.global.estado, "sin_datos_para_comparar"); assert.equal(r.global.porcentajes.series.valor, null); assert.equal(r.global.porcentajes.cobertura_sesiones.valor, 0);
    assert.ok(Object.keys(r.global.motivos_sin_datos).length > 0, "cada motivo queda a la vista");
  });
} finally { pg.stop(); }
console.log("\n" + n + " pruebas OK (PostgreSQL local, NO Supabase)");
