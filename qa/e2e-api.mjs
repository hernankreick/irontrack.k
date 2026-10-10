// E2E de API contra el stack LOCAL (Auth + PostgREST + funcion): recorre la secuencia de despliegue real con datos ficticios.
//   node qa/e2e-api.mjs        (requiere el stack arriba: qa/stack.sh up)
import assert from "node:assert/strict";
import { anonKey } from "./keys.mjs";
import { URL_, COACH_EMAIL, newPasswords, q, client, admin, prepare } from "./seed.mjs";

const P = newPasswords();
const results = [];
async function t(name, fn) {
  try { await fn(); results.push([true, name]); console.log("ok   -", name); }
  catch (e) { results.push([false, name, e.message]); console.log("FAIL -", name, "\n      ", String(e.message).split("\n").slice(0,5).join(" / ")); }
}
const anon = () => client(anonKey());
async function login(email, password) {
  const c = anon(); const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error("login " + email + ": " + error.message);
  return { c, user: data.user };
}

const { coach, ua, ub, ux } = await prepare(P, async () => {
  await t("ANTES: anon lee y borra con la anon key (vulnerabilidad reproducida)", async () => {
    const a = anon();
    const { data } = await a.from("alumnos").select("id");
    assert.equal(data.length, 9);
    const { error } = await a.from("progreso").delete().eq("ejercicio_id", "zz");
    assert.equal(error, null);
  });
});

// ───────── Entrenador ─────────
const co = await login(COACH_EMAIL, P.coach);
await t("entrenador: login y lista sus 9 alumnos por UUID", async () => {
  const { data, error } = await co.c.from("alumnos").select("*").eq("entrenador_id", co.user.id);
  assert.equal(error, null); assert.equal(data.length, 9);
});
await t("entrenador: consulta legacy entrenador_principal devuelve 0", async () => {
  const { data } = await co.c.from("alumnos").select("id").eq("entrenador_id", "entrenador_principal");
  assert.equal(data.length, 0);
});
let nuevoId;
await t("entrenador: crea alumno con su UUID", async () => {
  const { data, error } = await co.c.from("alumnos").insert([{ nombre: "Nuevo QA", email: "nuevo@qa.local", entrenador_id: co.user.id }]).select();
  assert.equal(error, null); nuevoId = data[0].id;
});
await t("entrenador: no puede crear alumno con entrenador_principal", async () => {
  const { error } = await co.c.from("alumnos").insert([{ nombre: "X", email: "x@qa.local", entrenador_id: "entrenador_principal" }]);
  assert.ok(error);
});
await t("entrenador: asigna rutina a un alumno y crea plantilla", async () => {
  let r = await co.c.from("rutinas").insert([{ alumno_id: nuevoId, entrenador_id: co.user.id, nombre: "Asignada", datos: { semana_activa: 1, days: [] } }]).select();
  assert.equal(r.error?.message, undefined);
  r = await co.c.from("rutinas").insert([{ alumno_id: null, entrenador_id: co.user.id, nombre: "Plantilla 2", datos: { days: [] }, es_plantilla: true }]).select();
  assert.equal(r.error?.message, undefined);
  const l = await co.c.from("rutinas").select("id").eq("entrenador_id", co.user.id);
  assert.ok(l.data.length >= 3);
});
await t("entrenador: lee progreso de sus alumnos y overrides propios", async () => {
  const p = await co.c.from("progreso").select("*"); assert.equal(p.data.length, 2);
  const v = await co.c.from("video_overrides").select("*").eq("entrenador_id", co.user.id); assert.equal(v.data.length, 1);
});
await t("entrenador: edita config; alumno no puede", async () => {
  const r = await co.c.from("config").update({ alias: "alias.nuevo" }).eq("id", "pagos").select(); assert.equal(r.data.length, 1);
});

// ───────── Alumno A / B ─────────
const A = await login("alumno.a@qa.local", P.a);
const B = await login("alumno.b@qa.local", P.b);
await t("alumno A: login, busca su fila por email (como la app) y ve su rutina", async () => {
  const r = await A.c.from("alumnos").select("id,nombre,entrenador_id").eq("email", "alumno.a@qa.local"); assert.equal(r.error?.message ?? r.data.length, 1);
  assert.equal(r.data[0].entrenador_id, co.user.id);
  const ru = await A.c.from("rutinas").select("*").eq("alumno_id", r.data[0].id); assert.equal(ru.error?.message ?? ru.data.length, 1);
});
await t("alumno A: registra series (varias), sesión y lee su historial", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  const ins = await A.c.from("progreso").insert([{ alumno_id: id, ejercicio_id: "bp", sets: 3, reps: 8, kg: 60, fecha: "2026-01-02", semana: 1 }, { alumno_id: id, ejercicio_id: "dl", sets: 1, reps: 5, kg: 140, fecha: "2026-01-02", semana: 1 }]).select();
  assert.equal(ins.error, null); assert.equal(ins.data.length, 2);
  const s = await A.c.from("sesiones").insert([{ alumno_id: id, rutina_id: "aaaaaaaa-0000-0000-0000-000000000001", semana: 1, dia_idx: 0, fecha: "2026-01-02" }]).select(); assert.equal(s.error, null);
  const h = await A.c.from("progreso").select("*").eq("alumno_id", id).order("created_at", { ascending: false }); assert.equal(h.data.length, 3);
});
await t("alumno A: avanza semana_activa (1->2) y no puede retroceder ni tocar otra clave", async () => {
  const id = "aaaaaaaa-0000-0000-0000-000000000001";
  let r = await A.c.from("rutinas").update({ datos: { semana_activa: 2, days: [] } }).eq("id", id).select(); assert.equal(r.error, null); assert.equal(r.data.length, 1);
  r = await A.c.from("rutinas").update({ datos: { semana_activa: 1, days: [] } }).eq("id", id).select(); assert.ok(r.error);
  r = await A.c.from("rutinas").update({ datos: { semana_activa: 3, days: [{ hack: 1 }] } }).eq("id", id).select(); assert.ok(r.error);
});
await t("alumno A: mensajes (enviar, marcar leídos) y onesignal_id", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  assert.equal((await A.c.from("mensajes").insert([{ alumno_id: id, texto: "hola", de_entrenador: false }])).error, null);
  assert.ok((await A.c.from("mensajes").insert([{ alumno_id: id, texto: "fake", de_entrenador: true }])).error);
  assert.equal((await A.c.from("alumnos").update({ onesignal_id: "p1" }).eq("id", id).select()).data.length, 1);
});
await t("alumno A NO accede a B ni a datos del entrenador; B tampoco a A", async () => {
  const idB = "00000000-0000-0000-0000-000000000002";
  assert.equal((await A.c.from("progreso").select("*").eq("alumno_id", idB)).data.length, 0);
  assert.equal((await A.c.from("alumnos").select("*").eq("id", idB)).data.length, 0);
  assert.equal((await A.c.from("progreso").update({ kg: 1 }).eq("alumno_id", idB).select()).data.length, 0);
  assert.ok((await A.c.from("progreso").insert([{ alumno_id: idB, ejercicio_id: "x", kg: 1 }])).error);
  assert.equal((await B.c.from("progreso").select("*").eq("alumno_id", "00000000-0000-0000-0000-000000000001")).data.length, 0);
  assert.equal((await A.c.from("config").update({ alias: "robado" }).eq("id", "pagos").select()).data.length, 0);
  assert.equal((await A.c.from("alumnos").select("id")).data.length, 1);
});
await t("alumno: escalada — no se hace entrenador, no cambia auth_uid/entrenador_id", async () => {
  const id = "00000000-0000-0000-0000-000000000001";
  assert.ok((await A.c.from("entrenadores").insert([{ id: A.user.id, email: "alumno.a@qa.local" }])).error);
  assert.ok((await A.c.from("alumnos").update({ entrenador_id: A.user.id }).eq("id", id)).error);
  assert.ok((await A.c.from("alumnos").update({ auth_uid: B.user.id }).eq("id", id)).error);
  assert.ok((await A.c.from("coach_principal").insert([{ uid: A.user.id }])).error);
  assert.equal((await A.c.from("coach_principal").select("*")).data.length, 0);
});
await t("alumno A lee overrides y config del entrenador (por el UUID de su fila)", async () => {
  const v = await A.c.from("video_overrides").select("*").eq("entrenador_id", co.user.id); assert.equal(v.data.length, 1);
  const c = await A.c.from("config").select("*"); assert.equal(c.data.length, 1);
});

// ───────── Anonimo y autenticado ajeno ─────────
const X = await login("ajeno@qa.local", P.x);
await t("anónimo: sin acceso (lectura, escritura, borrado)", async () => {
  const a = anon();
  for (const tb of ["alumnos", "progreso", "rutinas", "sesiones", "mensajes", "fotos", "config", "video_overrides", "ejercicio_overrides"]) {
    const r = await a.from(tb).select("*"); assert.ok(r.error || (r.data || []).length === 0, tb);
  }
  assert.ok((await a.from("progreso").delete().neq("id", 0)).error);
});
await t("autenticado ajeno: no ve nada ni escribe", async () => {
  assert.equal((await X.c.from("alumnos").select("id")).data.length, 0);
  assert.equal((await X.c.from("rutinas").select("id")).data.length, 0);
  assert.ok((await X.c.from("progreso").insert([{ alumno_id: "00000000-0000-0000-0000-000000000001", ejercicio_id: "x" }])).error);
});

// ───────── Cambio de contraseña (Edge Function) ─────────
const fn = (c, body) => c.functions.invoke("update-alumno-password", { body });
await t("función: sin sesión de entrenador -> rechazada (anon key / alumno / ajeno)", async () => {
  for (const c of [anon(), A.c, X.c]) {
    const { error } = await fn(c, { alumnoId: nuevoId, newPassword: P.n1 }); assert.ok(error);
  }
});
await t("función: el entrenador da contraseña a un alumno sin cuenta -> se crea y vincula auth_uid", async () => {
  const { data, error } = await fn(co.c, { alumnoId: nuevoId, newPassword: P.n1 });
  assert.equal(error, null); assert.equal(data.linked, true);
  assert.ok(q(`SELECT auth_uid FROM alumnos WHERE id='${nuevoId}'`).length > 10);
  const N = await login("nuevo@qa.local", P.n1);
  const own = await N.c.from("alumnos").select("id").eq("email", "nuevo@qa.local"); assert.equal(own.data.length, 1);
});
await t("función: segundo cambio de contraseña actualiza la misma cuenta; la vieja deja de servir", async () => {
  const { error } = await fn(co.c, { alumnoId: nuevoId, newPassword: P.n2 });
  assert.equal(error ? await (error.context?.json?.().catch(() => error.message)) : null, null);
  await login("nuevo@qa.local", P.n2);
  await assert.rejects(login("nuevo@qa.local", P.n1));
});
await t("función: email ya existente en Auth sin vínculo -> 409, la cuenta ajena no se toca", async () => {
  const ins = await co.c.from("alumnos").insert([{ nombre: "Colision", email: "ajeno@qa.local", entrenador_id: co.user.id }]).select();
  const { error } = await fn(co.c, { alumnoId: ins.data[0].id, newPassword: "Otra#Clave123" }); assert.ok(error);
  await login("ajeno@qa.local", P.x); // sigue con su contraseña
  assert.equal(q(`SELECT auth_uid IS NULL FROM alumnos WHERE id='${ins.data[0].id}'`), "t");
});
await t("función: no modifica la cuenta del entrenador principal aunque un vínculo erróneo lo intente", async () => {
  q(`UPDATE alumnos SET auth_uid='${coach.id}' WHERE id='00000000-0000-0000-0000-000000000003'`); // forzado como postgres (simula vínculo erróneo)
  const { error } = await fn(co.c, { alumnoId: "00000000-0000-0000-0000-000000000003", newPassword: "Hack#Clave123" }); assert.ok(error);
  await login(COACH_EMAIL, P.coach);
  q(`UPDATE alumnos SET auth_uid=NULL WHERE id='00000000-0000-0000-0000-000000000003'`);
});

const fails = results.filter((r) => !r[0]);
console.log(`\nE2E API: ${results.length - fails.length}/${results.length} aprobadas`);
process.exit(fails.length ? 1 : 0);
