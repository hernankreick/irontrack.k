// Pruebas de lib/studentIdentity.js (S0.6): identidad canonica del alumno
//   Supabase Auth user.id -> public.alumnos.auth_uid -> public.alumnos.id
//
//   node scripts/test-studentIdentity.mjs
//
// Sin red: el cliente supabase-js es un doble que simula auth + la tabla alumnos y registra cada consulta.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  loginStudent, restoreStudentSession, resolveAlumnoByAuthUid, buildStudentSession,
  shouldSkipEntrenadorUpsert, isValidAuthUid,
} from "../lib/studentIdentity.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const UID_A = "11111111-1111-4111-8111-111111111111";
const UID_B = "22222222-2222-4222-8222-222222222222";
const UID_COACH = "33333333-3333-4333-8333-333333333333";
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function dbRows() {
  return [
    // El email de public.alumnos esta en otro case que el de Auth: la identidad NO depende del email.
    { id: ID_A, nombre: "Alumno A", email: "Alumno.A@Mail.com", entrenador_id: "entrenador_principal", auth_uid: UID_A },
    { id: ID_B, nombre: "Alumno B", email: "alumno.b@mail.com", entrenador_id: "entrenador_principal", auth_uid: UID_B },
  ];
}

// Doble del cliente. opts: rows, signInUserId, signInError, sessionUserId (null = sin sesion), sessionError, forceResult
function makeClient(opts) {
  const o = opts || {};
  const rows = o.rows || dbRows();
  const log = { queries: [], signOuts: 0, signIns: [] };
  const client = {
    log,
    auth: {
      async signInWithPassword(creds) {
        log.signIns.push(creds.email);
        if (o.signInError) return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
        const uid = o.signInUserId === undefined ? UID_A : o.signInUserId;
        return { data: { user: uid == null ? null : { id: uid, email: "whatever@x.com" }, session: { access_token: "x" } }, error: null };
      },
      async getSession() {
        if (o.getSessionThrows) throw new Error("boom");
        if (o.sessionError) return { data: { session: null }, error: { message: "err" } };
        const uid = o.sessionUserId === undefined ? UID_A : o.sessionUserId;
        return { data: { session: uid == null ? null : { user: { id: uid } } }, error: null };
      },
      async signOut() { log.signOuts++; return { error: null }; },
    },
    from(table) {
      const q = { table, cols: null, filters: [] };
      log.queries.push(q);
      const builder = {
        select(cols) { q.cols = cols; return builder; },
        eq(col, val) { q.filters.push([col, val]); return builder; },
        then(resolve, reject) {
          let res;
          if (o.forceResult) res = o.forceResult;
          else {
            let list = rows.slice();
            q.filters.forEach(([c, v]) => { list = list.filter((r) => r[c] === v); });
            const cols = q.cols.split(",");
            res = { data: list.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))), error: null };
          }
          return Promise.resolve(res).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return client;
}

const silence = console.error;
console.error = function () {};

// ── LOGIN ────────────────────────────────────────────────────────────────────────────────────────────────

await test("A. Auth correcto + auth_uid correcto -> entra al alumno correcto (no al otro)", async () => {
  const c = makeClient({ signInUserId: UID_B });
  const r = await loginStudent(c, "cualquiera@mail.com", "pw");
  assert.equal(r.ok, true);
  assert.equal(r.alumno.id, ID_B);
  assert.equal(r.session.alumnoId, ID_B);
  assert.equal(c.log.signOuts, 0);
});

await test("B. Auth correcto + email de public.alumnos distinto en case -> entra igual (la identidad es auth_uid)", async () => {
  const c = makeClient({ signInUserId: UID_A });
  const r = await loginStudent(c, "alumno.a@mail.com", "pw"); // en alumnos esta "Alumno.A@Mail.com"
  assert.equal(r.ok, true);
  assert.equal(r.alumno.id, ID_A);
});

await test("C. Auth correcto + ningun alumno con ese auth_uid -> fail-closed + signOut, sin sesion", async () => {
  const c = makeClient({ signInUserId: UID_COACH });
  const r = await loginStudent(c, "alumno.a@mail.com", "pw");
  assert.equal(r.ok, false);
  assert.equal(r.session, undefined);
  assert.equal(r.reason, "no_alumno_for_auth_uid");
  assert.equal(c.log.signOuts, 1);
});

await test("C2. >1 filas / error / respuesta invalida / auth_uid distinto / signIn sin user.id -> fail-closed + signOut", async () => {
  const row = { id: ID_A, nombre: "A", entrenador_id: "e", auth_uid: UID_A };
  const cases = [
    ["multiple_alumnos_for_auth_uid", { forceResult: { data: [row, Object.assign({}, row, { id: ID_B })], error: null } }],
    ["query_error", { forceResult: { data: null, error: { message: "permission denied" } } }],
    ["invalid_response", { forceResult: { data: null, error: null } }],
    ["invalid_response", { forceResult: { data: { id: ID_A }, error: null } }],
    ["auth_uid_mismatch", { forceResult: { data: [Object.assign({}, row, { auth_uid: UID_B })], error: null } }],
    ["invalid_row", { forceResult: { data: [{ id: null, auth_uid: UID_A }], error: null } }],
    ["invalid_auth_user", { signInUserId: null }],
    ["invalid_auth_user", { signInUserId: "not-a-uuid" }],
  ];
  for (const [reason, opts] of cases) {
    const c = makeClient(opts);
    const r = await loginStudent(c, "a@b.com", "pw");
    assert.equal(r.ok, false, reason);
    assert.equal(r.reason, reason);
    assert.equal(r.session, undefined);
    assert.equal(c.log.signOuts, 1, reason);
  }
});

await test("C3. credenciales invalidas -> sin sesion y sin consultar alumnos", async () => {
  const c = makeClient({ signInError: true });
  const r = await loginStudent(c, "a@b.com", "mal");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "invalid_credentials");
  assert.equal(c.log.queries.length, 0);
});

await test("D. No hay fallback por email: solo se consulta por auth_uid, aunque exista un alumno con ese email", async () => {
  // El alumno con email "huerfano@mail.com" existe pero NO esta vinculado a ningun auth_uid de la sesion.
  const rows = dbRows().concat([{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", nombre: "Huerfano", email: "huerfano@mail.com", entrenador_id: "entrenador_principal", auth_uid: null }]);
  const c = makeClient({ rows, signInUserId: UID_COACH });
  const r = await loginStudent(c, "huerfano@mail.com", "pw");
  assert.equal(r.ok, false);
  c.log.queries.forEach((q) => {
    assert.equal(q.table, "alumnos");
    assert.deepEqual(q.filters, [["auth_uid", UID_COACH]]);
  });
  // Solo los campos necesarios.
  assert.equal(c.log.queries[0].cols, "id,nombre,entrenador_id,auth_uid");
  // Estatico: ni el helper ni el login de App.jsx resuelven alumnos por email.
  const lib = readFileSync(new URL("../lib/studentIdentity.js", import.meta.url), "utf8");
  assert.ok(!/\.eq\(\s*["']email["']/.test(lib));
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(!/alumnos\?email=eq\./.test(app), "App.jsx no debe volver a resolver alumnos por email");
  assert.ok(/loginStudent\(supabase,/.test(app));
});

await test("E. it_session del alumno incluye authUid (y el resto del contrato)", async () => {
  const r = await loginStudent(makeClient({ signInUserId: UID_A }), "a@b.com", "pw");
  assert.deepEqual(r.session, { role: "alumno", name: "Alumno A", alumnoId: ID_A, entrenadorId: "entrenador_principal", authUid: UID_A });
});

// ── RESTAURACION ─────────────────────────────────────────────────────────────────────────────────────────

await test("F. localStorage alumno valido + sesion Auth correspondiente -> restaura desde auth_uid", async () => {
  const stored = { role: "alumno", name: "Alumno A", alumnoId: ID_A, entrenadorId: "entrenador_principal", authUid: UID_A, avatarUrl: "av.png", phone: "123" };
  const r = await restoreStudentSession(makeClient({ sessionUserId: UID_A }), stored);
  assert.equal(r.ok, true);
  assert.equal(r.session.alumnoId, ID_A);
  assert.equal(r.session.authUid, UID_A);
  // Mismo alumno: se conservan los campos cosmeticos del perfil local.
  assert.equal(r.session.avatarUrl, "av.png");
  assert.equal(r.session.phone, "123");
});

await test("G. localStorage manipulado con alumnoId de OTRO alumno + Auth real de A -> restaura A, nunca el id falsificado", async () => {
  const forged = { role: "alumno", name: "Alumno B", alumnoId: ID_B, entrenadorId: "otro", authUid: UID_B, avatarUrl: "evil.png" };
  const c = makeClient({ sessionUserId: UID_A });
  const r = await restoreStudentSession(c, forged);
  assert.equal(r.ok, true);
  assert.equal(r.session.alumnoId, ID_A);
  assert.equal(r.session.authUid, UID_A);
  assert.equal(r.session.name, "Alumno A");
  assert.equal(r.session.entrenadorId, "entrenador_principal");
  assert.equal(r.session.avatarUrl, undefined, "no se heredan campos de otro alumno");
  c.log.queries.forEach((q) => assert.deepEqual(q.filters, [["auth_uid", UID_A]]));
});

await test("H. it_session alumno sin sesion de Supabase Auth -> no restaura", async () => {
  const stored = { role: "alumno", alumnoId: ID_A, authUid: UID_A };
  for (const opts of [{ sessionUserId: null }, { sessionError: true }, { getSessionThrows: true }, { sessionUserId: "no-uuid" }]) {
    const c = makeClient(opts);
    const r = await restoreStudentSession(c, stored);
    assert.equal(r.ok, false);
    assert.equal(r.session, undefined);
    assert.equal(c.log.queries.length, 0, "sin Auth no se consulta ni se confia en el alumnoId almacenado");
  }
});

await test("I. auth.uid sin fila en alumnos (o error/duplicado) -> no restaura", async () => {
  const stored = { role: "alumno", alumnoId: ID_A, authUid: UID_COACH };
  for (const opts of [
    { sessionUserId: UID_COACH },
    { sessionUserId: UID_A, forceResult: { data: null, error: { message: "x" } } },
    { sessionUserId: UID_A, forceResult: { data: [{ id: ID_A, auth_uid: UID_A }, { id: ID_B, auth_uid: UID_A }], error: null } },
  ]) {
    const r = await restoreStudentSession(makeClient(opts), stored);
    assert.equal(r.ok, false);
    assert.equal(r.session, undefined);
  }
});

await test("J. flujo entrenador intacto: no pasa por la restauracion de alumno y su upsert sigue activo", async () => {
  const c = makeClient({ sessionUserId: UID_COACH });
  const r = await restoreStudentSession(c, { role: "entrenador", entrenadorId: UID_COACH });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "not_student_session");
  assert.equal(c.log.queries.length, 0);

  // Almacenamiento que distingue claves (it_session / marcador de logout pendiente).
  const store = (session, extra) => ({ getItem: (k) => (k === "it_session" ? session : (extra && k in extra ? extra[k] : null)) });
  // S0.6 Fase 1: el upsert en entrenadores es POSITIVO: solo con una it_session de entrenador.
  assert.equal(shouldSkipEntrenadorUpsert(store(JSON.stringify({ role: "entrenador" })), false), false);
  // Sin it_session (o ilegible) un evento Auth ya NO crea una fila en entrenadores (puede ser el de un alumno).
  assert.equal(shouldSkipEntrenadorUpsert(store(null), false), true);
  assert.equal(shouldSkipEntrenadorUpsert(store("{no json"), false), true);
  // alumno (almacenado o login en curso) -> no se crea fila en entrenadores
  assert.equal(shouldSkipEntrenadorUpsert(store(JSON.stringify({ role: "alumno" })), false), true);
  assert.equal(shouldSkipEntrenadorUpsert(store(null), true), true);
  assert.equal(shouldSkipEntrenadorUpsert(store(JSON.stringify({ role: "entrenador" })), true), true);
  // Logout pendiente: nada se escribe aunque quede una it_session de entrenador.
  assert.equal(shouldSkipEntrenadorUpsert(store(JSON.stringify({ role: "entrenador" }), { irontrack_logout_pending: "{\"v\":1}" }), false), true);

  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  // La rama del entrenador del login y de la restauracion sigue en su sitio.
  assert.ok(/isEntrenador = loginEmailNorm==="entrenador@irontrack\.app"/.test(app));
  assert.ok(/parsed\.role === "entrenador"/.test(app));
  assert.ok(/shouldSkipEntrenadorUpsert\(localStorage, studentAuthFlowRef\.current\)/.test(app));
});

// ── Piezas auxiliares y revisiones estaticas del cableado ───────────────────────────────────────────────

await test("restoreStudentSession no restaura con un logout pendiente aunque haya sesion Auth valida", async () => {
  const c = makeClient({ sessionUserId: UID_A });
  const pending = { getItem: (k) => (k === "irontrack_logout_pending" ? "{\"v\":1}" : null) };
  const r = await restoreStudentSession(c, { role: "alumno", alumnoId: ID_A }, pending);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "logout_pending");
  assert.equal(c.log.queries.length, 0, "ni siquiera consulta alumnos");
  const free = { getItem: () => null };
  assert.equal((await restoreStudentSession(c, { role: "alumno", alumnoId: ID_A }, free)).ok, true);
});

await test("resolveAlumnoByAuthUid rechaza auth_uid que no sea UUID sin consultar", async () => {
  const c = makeClient();
  assert.equal((await resolveAlumnoByAuthUid(c, "alumno@mail.com")).ok, false);
  assert.equal((await resolveAlumnoByAuthUid(c, null)).ok, false);
  assert.equal(c.log.queries.length, 0);
  assert.equal(isValidAuthUid(UID_A), true);
});

await test("buildStudentSession: role/alumnoId/entrenadorId/authUid siempre canonicos", async () => {
  const s = buildStudentSession({ id: ID_A, nombre: "A", entrenador_id: "e1" }, UID_A, { role: "entrenador", alumnoId: ID_A, entrenadorId: "x", authUid: "y", name: "Mi nombre" });
  assert.equal(s.role, "alumno");
  assert.equal(s.entrenadorId, "e1");
  assert.equal(s.authUid, UID_A);
  assert.equal(s.name, "Mi nombre"); // mismo alumno: conserva el nombre editado localmente
});

await test("cableado en App.jsx: localStorage de alumno no es autoridad al arrancar; biometria no crea sesion de alumno sin Auth", async () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(/s0\.role==="alumno" \? null : s0/.test(app), "el estado inicial no confia en it_session de alumno");
  assert.ok(/restoreStudentSession\(supabase, parsed, localStorage\)/.test(app));
  assert.ok(/saved\.role==="alumno"/.test(app) && /restoreStudentSession\(supabase, saved, localStorage\)/.test(app));
  assert.ok(!/service_role/i.test(app));
});

console.error = silence;
console.log("\n" + count + " tests ok");
