// Anclas de entrenamiento independientes por alumno + migracion desde la clave global it_active_workout.
//   node scripts/test-anclasPorAlumno.mjs   (datos ficticios, sin red, almacenamiento en memoria)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTIVE_WORKOUT_KEY, ACTIVE_WORKOUT_MAX_MS, claveAnclaAlumno, leerSesionActiva, migrarAnclaGlobal, prepararInicioEntrenamiento, cerrarSesionActiva } from "../lib/workoutSessionDate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok -", name); };

const A = "alumno-demo-a", B = "alumno-demo-b", R = "rutina-demo-1";
const T2355 = new Date(2026, 10, 5, 23, 55).getTime();
const T0005 = new Date(2026, 10, 6, 0, 5).getTime();
const F5 = "5/11/2026", F6 = "6/11/2026";
const UUID_A = "123e4567-e89b-42d3-a456-426614174000";
const KA = ACTIVE_WORKOUT_KEY + ":" + A, KB = ACTIVE_WORKOUT_KEY + ":" + B;

// Almacenamiento en memoria con fallas configurables.
function mem(init, opts) {
  const m = new Map(init || []); const o = opts || {};
  return {
    m,
    getItem: (k) => { if (o.sinAcceso) throw new Error("SecurityError"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => {
      if (o.sinAcceso) throw new Error("SecurityError");
      if (o.cuota && o.cuota(k)) { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; }
      m.set(k, o.truncar && o.truncar(k) ? String(v).slice(0, 10) : String(v));
    },
    removeItem: (k) => { if (o.sinAcceso || (o.falloRemove && o.falloRemove(k))) throw new Error("remove"); m.delete(k); },
  };
}
const v1 = (o) => Object.assign({ v: 1, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T2355, fecha: F5 }, o || {});
const v2 = (o) => Object.assign({ v: 2, sessionId: UUID_A, alumnoId: A, rId: R, dIdx: 0, ciclo: 1, semana: 2, startTime: T2355, fecha: F5 }, o || {});
const J = (o) => JSON.stringify(o);
const ini = (st, o) => prepararInicioEntrenamiento(Object.assign({ storage: st, alumnoId: A, session: { rId: R, dIdx: 0, exIdx: 0, startTime: T2355 }, ciclo: 1, semana: 2, now: T2355 }, o || {}));
const iniEn = (st, alumnoId, now, o) => ini(st, Object.assign({ alumnoId, now, session: { rId: R, dIdx: 0, exIdx: 0, startTime: now } }, o || {}));

// ───────────── claves
test("clave individual: it_active_workout:<alumnoId>; id invalido -> null; numero y texto equivalentes", () => {
  assert.equal(claveAnclaAlumno(A), "it_active_workout:" + A);
  assert.equal(claveAnclaAlumno(7), claveAnclaAlumno("7"));
  for (const x of [null, undefined, "", NaN, {}, []]) assert.equal(claveAnclaAlumno(x), null);
});
test("inicio de un alumno escribe SOLO su clave; nunca la global", () => {
  const st = mem(); ini(st);
  assert.deepEqual([...st.m.keys()], [KA]);
});

// ───────────── migracion
test("migracion v1 global -> individual: copia exacta, sin sessionId inventado, global borrada tras verificar", () => {
  const raw = J(v1()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]]);
  assert.equal(migrarAnclaGlobal(st, T2355 + 1000).estado, "migrada");
  assert.equal(st.m.get(KA), raw); assert.equal(st.m.has(ACTIVE_WORKOUT_KEY), false);
  const l = leerSesionActiva(st, A); assert.equal(l.v, 1); assert.equal("sessionId" in l, false);
});
test("migracion v2 global -> individual con el MISMO UUID", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]]);
  assert.equal(migrarAnclaGlobal(st, T2355 + 1000).estado, "migrada");
  assert.equal(st.m.get(KA), raw); assert.equal(leerSesionActiva(st, A).sessionId, UUID_A); assert.equal(st.m.has(ACTIVE_WORKOUT_KEY), false);
});
test("migracion repetida: idempotente", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]]);
  migrarAnclaGlobal(st, T2355 + 1000);
  const antes = [...st.m.entries()];
  for (let i = 0; i < 3; i++) assert.equal(migrarAnclaGlobal(st, T2355 + 2000).estado, "sin_global");
  assert.deepEqual([...st.m.entries()], antes);
});
test("migracion conserva campos desconocidos (copia byte a byte)", () => {
  const raw = J(Object.assign(v2(), { extra: "x" })); const st = mem([[ACTIVE_WORKOUT_KEY, raw]]);
  assert.equal(migrarAnclaGlobal(st, T2355 + 1).estado, "migrada");
  assert.equal(st.m.get(KA), raw); assert.ok(st.m.get(KA).includes('"extra":"x"'));
});
test("migra el ancla de A aunque quien inicia sea B (A no se pierde)", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]]);
  const b = iniEn(st, B, T2355 + 1000);
  assert.equal(st.m.get(KA), raw); assert.equal(st.m.has(ACTIVE_WORKOUT_KEY), false); assert.ok(st.m.get(KB));
  assert.equal(b.session.identity.alumnoId, B); assert.notEqual(b.session.identity.sessionId, UUID_A);
  const a = iniEn(st, A, T2355 + 2000); // A recupera su identidad original
  assert.equal(a.recuperada, true); assert.equal(a.session.identity.sessionId, UUID_A);
});

// ───────────── ancla individual existente
test("individual VALIDA distinta: no se sobrescribe y la global se conserva", () => {
  const ind = J(v2({ sessionId: "9b2e6a40-1c3d-4e5f-8a7b-0c1d2e3f4a5b", startTime: T2355 + 500 }));
  const glob = J(v1());
  const st = mem([[KA, ind], [ACTIVE_WORKOUT_KEY, glob]]);
  assert.equal(migrarAnclaGlobal(st, T2355 + 1000).estado, "conflicto");
  assert.equal(st.m.get(KA), ind); assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), glob);
  assert.equal(leerSesionActiva(st, A).sessionId, "9b2e6a40-1c3d-4e5f-8a7b-0c1d2e3f4a5b", "la individual manda");
});
test("individual identica a la global (migracion interrumpida tras copiar): termina el borrado", () => {
  const raw = J(v2()); const st = mem([[KA, raw], [ACTIVE_WORKOUT_KEY, raw]]);
  assert.equal(migrarAnclaGlobal(st, T2355 + 1000).estado, "ya_migrada");
  assert.equal(st.m.get(KA), raw); assert.equal(st.m.has(ACTIVE_WORKOUT_KEY), false);
});
test("individual corrupta: no es utilizable, se reemplaza por la copia valida de la global", () => {
  const raw = J(v2()); const st = mem([[KA, "{roto"], [ACTIVE_WORKOUT_KEY, raw]]);
  assert.equal(migrarAnclaGlobal(st, T2355 + 1000).estado, "migrada"); assert.equal(st.m.get(KA), raw);
});
test("clave individual con el ancla de OTRO alumno adentro: no se usa para A", () => {
  const st = mem([[KA, J(v2({ alumnoId: B }))]]);
  assert.equal(leerSesionActiva(st, A), null);
  const r = iniEn(st, A, T2355 + 1000); assert.equal(r.recuperada, false); assert.equal(r.motivo, "invalida");
});

// ───────────── migracion interrumpida / fallas de almacenamiento
test("interrumpida: falla el borrado de la global tras copiar -> copia verificada, global intacta; el siguiente intento termina", () => {
  const raw = J(v2()); let falla = true;
  const st = mem([[ACTIVE_WORKOUT_KEY, raw]], { falloRemove: () => falla });
  assert.equal(migrarAnclaGlobal(st, T2355 + 1).estado, "migrada_sin_borrar");
  assert.equal(st.m.get(KA), raw); assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), raw);
  falla = false;
  assert.equal(migrarAnclaGlobal(st, T2355 + 2).estado, "ya_migrada"); assert.equal(st.m.has(ACTIVE_WORKOUT_KEY), false);
});
test("interrumpida: la escritura de la copia se trunca -> no verificada, la global NO se borra", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]], { truncar: (k) => k === KA });
  assert.equal(migrarAnclaGlobal(st, T2355 + 1).estado, "no_verificada");
  assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), raw);
  assert.equal(leerSesionActiva(st, A).sessionId, UUID_A, "A todavia recupera desde la global");
});
test("cuota agotada: nada cambia, la global se conserva y A sigue recuperando su sesion", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]], { cuota: () => true });
  assert.equal(migrarAnclaGlobal(st, T2355 + 1).estado, "error_almacenamiento");
  assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), raw); assert.equal(st.m.has(KA), false);
  const a = iniEn(st, A, T2355 + 2000);
  assert.equal(a.recuperada, true); assert.equal(a.session.identity.sessionId, UUID_A); assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), raw);
});
test("cuota agotada al iniciar un alumno nuevo: sesion en memoria con identidad, sin romper nada", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]], { cuota: () => true });
  const b = iniEn(st, B, T2355 + 1000);
  assert.ok(b.session.identity); assert.equal(st.m.has(KB), false); assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), raw);
});
test("localStorage inaccesible o ausente: no lanza y no hay perdida", () => {
  for (const st of [mem([[ACTIVE_WORKOUT_KEY, J(v2())]], { sinAcceso: true }), null, undefined, {}]) {
    assert.doesNotThrow(() => migrarAnclaGlobal(st, T2355));
    assert.doesNotThrow(() => ini(st));
    assert.doesNotThrow(() => cerrarSesionActiva(st, { alumnoId: A, session: { rId: R, dIdx: 0, startTime: T2355 } }));
    assert.equal(leerSesionActiva(st, A), null);
  }
});

// ───────────── global vencida / corrupta
test("global vencida, futura o corrupta: no se migra, no se reutiliza y no se borra", () => {
  const casos = [["vencida", J(v2()), T2355 + ACTIVE_WORKOUT_MAX_MS + 1], ["invalida", J(v2()), T2355 - 1000], ["invalida", "{roto", T2355],
    ["invalida", J(v2({ sessionId: "xyz" })), T2355], ["invalida", J(v1({ semana: -1 })), T2355], ["invalida", J(Object.assign(v1(), { sessionId: UUID_A })), T2355]];
  for (const [estado, raw, now] of casos) {
    const st = mem([[ACTIVE_WORKOUT_KEY, raw]]);
    assert.equal(migrarAnclaGlobal(st, now).estado, estado, raw);
    assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), raw); assert.equal(st.m.has(KA), false);
    const r = iniEn(st, A, now); assert.equal(r.recuperada, false);
    if (raw !== "{roto") assert.notEqual(r.session.identity && r.session.identity.sessionId, UUID_A);
  }
});

// ───────────── recuperacion independiente
test("A -> B -> A: ambos conservan su ancla; cada uno recupera su identidad", () => {
  const st = mem(); const a1 = iniEn(st, A, T2355); const b1 = iniEn(st, B, T2355 + 60000);
  assert.ok(st.m.has(KA) && st.m.has(KB));
  const a2 = iniEn(st, A, T2355 + 120000); const b2 = iniEn(st, B, T2355 + 180000);
  assert.deepEqual(a2.session.identity, a1.session.identity); assert.deepEqual(b2.session.identity, b1.session.identity);
  assert.notEqual(a1.session.identity.sessionId, b1.session.identity.sessionId);
});
test("A -> B -> recarga (medianoche): ambos recuperan identidad, fecha e inicio originales", () => {
  const st = mem(); const a1 = iniEn(st, A, T2355); const b1 = iniEn(st, B, T2355 + 120000);
  const a2 = iniEn(st, A, T0005); const b2 = iniEn(st, B, T0005 + 1000);
  for (const [x, y, t0] of [[a1, a2, T2355], [b1, b2, T2355 + 120000]]) {
    assert.equal(y.recuperada, true); assert.deepEqual(y.session.identity, x.session.identity);
    assert.equal(y.session.fecha, F5); assert.equal(y.session.startTime, t0);
  }
  assert.notEqual(F5, F6);
});
test("cierre independiente: cerrar A no borra B y cerrar B no borra A; la global tampoco se toca", () => {
  const st = mem(); const a = iniEn(st, A, T2355); const b = iniEn(st, B, T2355 + 1000);
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: a.session, now: T2355 + 2000 }), true);
  assert.equal(st.m.has(KA), false); assert.equal(st.m.has(KB), true);
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: b.session }), false, "A no puede cerrar la sesion de B");
  assert.equal(cerrarSesionActiva(st, { alumnoId: B, session: b.session, now: T2355 + 3000 }), true);
  assert.equal(st.m.size, 0);
});
test("cierre con la global SIN migrar (cuota): borra la global solo si es del mismo entrenamiento", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]], { cuota: () => true });
  const s = { rId: R, dIdx: 0, startTime: T2355, identity: { sessionId: UUID_A } };
  assert.equal(cerrarSesionActiva(st, { alumnoId: B, session: s, now: T2355 + 1 }), false); assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), raw);
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: Object.assign({}, s, { identity: { sessionId: "9b2e6a40-1c3d-4e5f-8a7b-0c1d2e3f4a5b" } }), now: T2355 + 1 }), false);
  assert.equal(cerrarSesionActiva(st, { alumnoId: A, session: s, now: T2355 + 1 }), true); assert.equal(st.m.has(ACTIVE_WORKOUT_KEY), false);
});
test("cierre: tras cerrar, un nuevo inicio no recupera la sesion terminada", () => {
  const st = mem(); const a = iniEn(st, A, T2355); cerrarSesionActiva(st, { alumnoId: A, session: a.session });
  const r = iniEn(st, A, T2355 + 60000); assert.equal(r.recuperada, false); assert.notEqual(r.session.identity.sessionId, a.session.identity.sessionId);
});
test("vencida (>6 h) y corrupta por alumno: no se reutilizan, y no afectan a otros", () => {
  const st = mem(); const a = iniEn(st, A, T2355); const b = iniEn(st, B, T2355 + 7 * 3600 * 1000);
  const rA = iniEn(st, A, T2355 + 7 * 3600 * 1000 + 5); assert.equal(rA.recuperada, false); assert.notEqual(rA.session.identity.sessionId, a.session.identity.sessionId);
  assert.equal(leerSesionActiva(st, B).sessionId, b.session.identity.sessionId);
  const st2 = mem([[KA, "{roto"]]); const r = iniEn(st2, A, T2355); assert.equal(r.recuperada, false); assert.equal(r.motivo, "invalida");
});
test("cambio de ciclo / dia / rutina: identidad nueva solo para ese alumno", () => {
  const st = mem(); iniEn(st, A, T2355); const b = iniEn(st, B, T2355 + 1000); const rawB = st.m.get(KB);
  const a2 = iniEn(st, A, T2355 + 2000, { ciclo: 2 });
  assert.equal(a2.recuperada, false); assert.equal(a2.motivo, "otro_ciclo"); assert.equal(leerSesionActiva(st, A).ciclo, 2);
  assert.equal(st.m.get(KB), rawB); assert.equal(leerSesionActiva(st, B).sessionId, b.session.identity.sessionId);
});
test("medianoche + reinicio de ciclo a la vez: sesion nueva con fecha del 6/11 para ese alumno", () => {
  const st = mem(); iniEn(st, A, T2355);
  const r = iniEn(st, A, T0005, { ciclo: 2 }); assert.equal(r.recuperada, false); assert.equal(r.session.fecha, F6);
});

// ───────────── compatibilidad con versiones anteriores
// Simula la app ANTERIOR: solo conoce la clave global (leer / escribir / borrar si coincide).
const viejaEscribe = (st, ancla) => st.setItem(ACTIVE_WORKOUT_KEY, J(ancla));
const viejaCierra = (st, ancla) => { try { const g = JSON.parse(st.getItem(ACTIVE_WORKOUT_KEY)); if (g && g.alumnoId === ancla.alumnoId && g.startTime === ancla.startTime) st.removeItem(ACTIVE_WORKOUT_KEY); } catch (e) {} };
test("version anterior: sus escrituras y cierres sobre la global no destruyen las anclas individuales nuevas", () => {
  const st = mem(); const a = iniEn(st, A, T2355); const rawA = st.m.get(KA);
  viejaEscribe(st, v1({ alumnoId: B, startTime: T2355 + 5000 }));            // la app vieja escribe la global
  viejaCierra(st, v1({ alumnoId: B, startTime: T2355 + 5000 }));             // ...y la cierra
  viejaEscribe(st, v1({ alumnoId: A, startTime: T2355 + 9000 }));
  viejaCierra(st, v1({ alumnoId: A, startTime: T2355 + 9000 }));
  assert.equal(st.m.get(KA), rawA);
  const r = iniEn(st, A, T2355 + 10000); assert.equal(r.recuperada, true); assert.equal(r.session.identity.sessionId, a.session.identity.sessionId);
});
test("version anterior deja una global de A mientras A ya tiene individual: la individual manda, la global ajena a la migracion se conserva", () => {
  const st = mem(); const a = iniEn(st, A, T2355); const globalVieja = J(v1({ startTime: T2355 + 5000 }));
  st.setItem(ACTIVE_WORKOUT_KEY, globalVieja);
  const r = iniEn(st, A, T2355 + 6000);
  assert.equal(r.recuperada, true); assert.equal(r.session.identity.sessionId, a.session.identity.sessionId);
  assert.equal(st.m.get(ACTIVE_WORKOUT_KEY), globalVieja);
});
test("version anterior que escribe la global de B: se migra a la clave de B sin tocar la de A", () => {
  const st = mem(); iniEn(st, A, T2355); const rawA = st.m.get(KA);
  const g = J(v1({ alumnoId: B, startTime: T2355 + 1000 })); st.setItem(ACTIVE_WORKOUT_KEY, g);
  const rB = iniEn(st, B, T2355 + 2000);
  assert.equal(rB.recuperada, true); assert.equal(rB.legado, true); assert.equal("identity" in rB.session, false);
  assert.equal(st.m.get(KB), g); assert.equal(st.m.get(KA), rawA);
});

// ───────────── alcance
test("sin alumno (entrenador/compartido): no migra, no lee ni escribe claves individuales", () => {
  const raw = J(v2()); const st = mem([[ACTIVE_WORKOUT_KEY, raw]]);
  const r = ini(st, { alumnoId: null, now: T0005 }); assert.equal(r.motivo, "sin_alumno");
  assert.deepEqual([...st.m.entries()], [[ACTIVE_WORKOUT_KEY, raw]]);
});
test("el modulo sigue puro y no toca Supabase ni envia el sessionId; App/WorkoutScreen sin cambios de contrato", () => {
  const src = readFileSync(path.join(ROOT, "lib/workoutSessionDate.js"), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const re of [/supabase/i, /fetch\(/, /localStorage/, /sessionStorage/, /window\./, /Math\.random/]) assert.ok(!re.test(src), String(re));
  for (const f of ["App.jsx", "components/WorkoutScreen.jsx", "lib/rpcClient.js", "lib/finalizeWorkoutSession.js", "lib/progressInsert.js"]) {
    assert.ok(!/sessionId|sesion_uid|session\.identity/.test(readFileSync(path.join(ROOT, f), "utf8")), f);
  }
});
console.log("\n" + n + " pruebas OK");
