// IT-002a: autorizacion de update-alumno-password.
//   node scripts/test-updateAlumnoPasswordAuthz.mjs                 -> prueba handler.js (implementacion actual)
//   node scripts/test-updateAlumnoPasswordAuthz.mjs <index.ts viejo> -> corre los MISMOS escenarios contra otro index.ts
//                                                                       (para comprobar que fallan con la version anterior)
//
// Sin red ni servicios reales: el cliente de administracion es un simulado. Contrasenas y UIDs ficticios.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleUpdateAlumnoPassword, parseCoachUids } from "../supabase/functions/update-alumno-password/handler.js";

const FN_DIR = new URL("../supabase/functions/update-alumno-password/", import.meta.url).pathname;

const COACH = "00000000-0000-4000-8000-0000000000c1";   // entrenador autorizado (en COACH_UIDS)
const COACH2 = "00000000-0000-4000-8000-0000000000c2";  // otro entrenador autorizado
const STUD = "00000000-0000-4000-8000-0000000000a1";    // un alumno con sesion valida
const STRANGER = "00000000-0000-4000-8000-0000000000e1"; // usuario con sesion valida, sin rol
const AL1 = "11111111-1111-4111-8111-111111111111";
const AL2 = "22222222-2222-4222-8222-222222222222";
const LEGACY = "entrenador_principal";
const TOKENS = { tc: COACH, tc2: COACH2, ts: STUD, tx: STRANGER };

let n = 0;
let failed = 0;
const t = async (name, fn) => {
  try {
    await fn();
    n++;
    console.log("ok -", name);
  } catch (err) {
    failed++;
    console.log("FAIL -", name);
    console.log("  " + String((err && err.message) || err).split("\n")[0]);
  }
};

// ---- cliente de administracion simulado ----
function likeRe(p) {
  const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = "^";
  for (let i = 0; i < p.length; i++) {
    const c = p[i];
    if (c === "\\" && i + 1 < p.length) out += esc(p[++i]);
    else if (c === "%") out += ".*";
    else if (c === "_") out += ".";
    else out += esc(c);
  }
  return new RegExp(out + "$", "i");
}
function fake({ alumnos = [], authUsers = [], createFails = false, updateFails = false } = {}) {
  const log = { created: [], updated: [], otherTables: [], getUser: 0, queries: 0 };
  const db = alumnos.map((a) => ({ ...a }));
  const users = authUsers.map((u) => ({ ...u }));
  const admin = {
    auth: {
      getUser: async (tok) => {
        log.getUser++;
        if (tok === "texp") return { data: { user: null }, error: { message: "JWT expired" } };
        return TOKENS[tok] ? { data: { user: { id: TOKENS[tok] } }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } };
      },
      admin: {
        listUsers: async ({ page = 1, perPage = 50 } = {}) => ({ data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null }),
        createUser: async (u) => {
          log.created.push(u);
          if (createFails) return { data: { user: null }, error: { message: "Database error creating new user" } };
          const user = { id: "new-" + log.created.length, email: u.email, app_metadata: u.app_metadata || {} };
          users.push(user);
          return { data: { user }, error: null };
        },
        updateUserById: async (id, attrs) => {
          log.updated.push({ id, attrs });
          return updateFails ? { error: { message: "update failed" } } : { error: null };
        },
      },
    },
    from: (table) => {
      if (table !== "alumnos") { log.otherTables.push(table); throw new Error("tabla no permitida: " + table); }
      log.queries++;
      let rows = db.slice();
      let lim = null;
      const api = {
        select: () => api,
        ilike: (col, pat) => { const re = likeRe(String(pat)); rows = rows.filter((r) => re.test(String(r[col] == null ? "" : r[col]))); return api; },
        eq: (col, v) => { rows = rows.filter((r) => String(r[col]) === String(v)); return api; },
        limit: (k) => { lim = k; return api; },
        maybeSingle: async () => (rows.length > 1 ? { data: null, error: { message: "multiple rows" } } : { data: rows[0] || null, error: null }),
        then: (res) => res({ data: lim ? rows.slice(0, lim) : rows, error: null }),
      };
      return api;
    },
  };
  return { admin, log, db, users };
}

// ---- implementacion bajo prueba ----
async function loadLegacy(file) {
  const src = readFileSync(file, "utf8").replace(/^import .*$/m, "");
  let serve; let current;
  new Function("Deno", "createClient", src)({ serve: (fn) => { serve = fn; }, env: { get: () => "" } }, () => current);
  return async ({ callerToken, body, admin }) => {
    current = admin;
    const res = await serve(new Request("http://local/fn", { method: "POST", headers: { Authorization: "Bearer " + callerToken }, body: JSON.stringify(body || {}) }));
    return { status: res.status, body: await res.json() };
  };
}
const legacyFile = process.argv[2];
const impl = legacyFile ? await loadLegacy(legacyFile) : handleUpdateAlumnoPassword;
if (legacyFile) console.log("# modo comparacion: se prueba " + legacyFile);

const BODY = { alumnoEmail: "a@test.local", newPassword: "Nueva#1234" };
const call = (f, over = {}) => impl({ callerToken: "tc", body: BODY, admin: f.admin, allowedCoachUids: [COACH], ...over });
const al = (extra = {}) => ({ id: AL1, email: "A@Test.local", entrenador_id: COACH, ...extra });
const acct = (extra = {}) => ({ id: "u-al1", email: "a@test.local", app_metadata: { alumno_id: AL1 }, ...extra });
const nothingChanged = (f) => assert.deepEqual([f.log.created.length, f.log.updated.length], [0, 0], "se modifico o creo una cuenta");

// ---- identidad de la sesion ----
await t("JWT ausente, invalido o vencido: 401 y no se lee ni se escribe nada", async () => {
  for (const tok of ["", "malo", "texp"]) {
    const f = fake({ alumnos: [al()], authUsers: [acct()] });
    const r = await call(f, { callerToken: tok });
    assert.equal(r.status, 401, "token=" + JSON.stringify(tok));
    nothingChanged(f);
    assert.equal(f.log.queries, 0);
  }
});
await t("faltan alumnoEmail o newPassword: 400", async () => {
  const f = fake({ alumnos: [al()] });
  assert.equal((await call(f, { body: { newPassword: "x" } })).status, 400);
  assert.equal((await call(f, { body: { alumnoEmail: "a@test.local" } })).status, 400);
  assert.equal((await call(f, { body: null })).status, 400);
});

// ---- casos positivos ----
await t("entrenador autorizado cambia la contrasena de un alumno propio con cuenta vinculada (app_metadata): 200, actualiza por id", async () => {
  const f = fake({ alumnos: [al()], authUsers: [acct()] });
  const r = await call(f);
  assert.equal(r.status, 200);
  assert.equal(f.log.updated.length, 1);
  assert.equal(f.log.updated[0].id, "u-al1");
  assert.equal(f.log.updated[0].attrs.password, "Nueva#1234");
  assert.equal(f.log.created.length, 0);
});
await t("entrenador autorizado sobre un alumno con valor legacy (entrenador_principal): 200", async () => {
  const f = fake({ alumnos: [al({ entrenador_id: LEGACY })], authUsers: [acct()] });
  assert.equal((await call(f)).status, 200);
  assert.equal(f.log.updated[0].id, "u-al1");
});
await t("alumno sin cuenta: se crea con el email de la base y queda vinculado (app_metadata.alumno_id)", async () => {
  const f = fake({ alumnos: [al()], authUsers: [] });
  const r = await call(f, { body: { alumnoEmail: "A@TEST.local", newPassword: "Nueva#1234" } });
  assert.equal(r.status, 200);
  assert.equal(f.log.created.length, 1);
  assert.equal(f.log.created[0].email, "a@test.local");
  assert.equal(f.log.created[0].app_metadata && f.log.created[0].app_metadata.alumno_id, AL1);
  assert.equal(f.log.created[0].user_metadata && f.log.created[0].user_metadata.role, "alumno");
  assert.equal(f.log.updated.length, 0);
});

// ---- RIESGO 1: quien llama debe ser un entrenador legitimo por una fuente confiable ----
await t("R1: fila manipulada (alumnos.entrenador_id = UID del solicitante) pero el solicitante NO esta autorizado: 403", async () => {
  const f = fake({ alumnos: [al({ entrenador_id: STRANGER })], authUsers: [acct()] });
  const r = await call(f, { callerToken: "tx" });
  assert.equal(r.status, 403);
  nothingChanged(f);
});
await t("R1: un alumno con sesion valida no puede cambiar contrasenas (fila legacy ni fila propia)", async () => {
  for (const row of [al({ entrenador_id: LEGACY }), al({ entrenador_id: STUD })]) {
    const f = fake({ alumnos: [row], authUsers: [acct()] });
    const r = await call(f, { callerToken: "ts" });
    assert.equal(r.status, 403, "entrenador_id=" + row.entrenador_id);
    nothingChanged(f);
  }
});
await t("R1: usuario autenticado sin rol sobre una fila legacy: 403 sin cambios", async () => {
  const f = fake({ alumnos: [al({ entrenador_id: LEGACY })], authUsers: [] });
  const r = await call(f, { callerToken: "tx" });
  assert.equal(r.status, 403);
  nothingChanged(f);
});
await t("R1: la autorizacion no depende de la tabla entrenadores (no se consulta)", async () => {
  const f = fake({ alumnos: [al()], authUsers: [acct()] });
  await call(f);
  await call(f, { callerToken: "tx" });
  assert.deepEqual(f.log.otherTables, []);
});
await t("R1: entrenador ajeno (autorizado, pero el alumno es de otro entrenador): 403", async () => {
  const f = fake({ alumnos: [al({ entrenador_id: COACH })], authUsers: [acct()] });
  const r = await call(f, { callerToken: "tc2", allowedCoachUids: [COACH, COACH2] });
  assert.equal(r.status, 403);
  nothingChanged(f);
});
await t("R1: sin lista de entrenadores autorizados (ausente, vacia o sin UUID validos) se deniega todo", async () => {
  for (const list of [undefined, null, [], parseCoachUids(""), parseCoachUids("no-es-uuid, otro")]) {
    const f = fake({ alumnos: [al()], authUsers: [acct()] });
    const r = await call(f, { allowedCoachUids: list });
    assert.equal(r.status, 403);
    nothingChanged(f);
  }
});
await t("parseCoachUids: separa por coma, ignora espacios, pasa a minusculas y descarta lo que no es UUID", async () => {
  assert.deepEqual(parseCoachUids(" " + COACH.toUpperCase() + " , basura,, " + COACH2), [COACH, COACH2]);
  assert.deepEqual(parseCoachUids(undefined), []);
  assert.deepEqual(parseCoachUids(""), []);
});

// ---- RIESGO 2: una coincidencia de email no basta para modificar una cuenta de Auth ----
await t("R2: existe una cuenta con el mismo email SIN vinculo: 409 y no se modifica ni se crea nada", async () => {
  const f = fake({ alumnos: [al()], authUsers: [{ id: "otra", email: "a@test.local" }] });
  const r = await call(f);
  assert.equal(r.status, 409);
  nothingChanged(f);
});
await t("R2: lo mismo con distinta capitalizacion del email", async () => {
  const f = fake({ alumnos: [al()], authUsers: [{ id: "otra", email: "A@TEST.LOCAL", app_metadata: {} }] });
  assert.equal((await call(f)).status, 409);
  nothingChanged(f);
});
await t("R2: vinculo por alumnos.auth_uid valido: 200 y se actualiza esa cuenta por id", async () => {
  const f = fake({ alumnos: [al({ auth_uid: "u-al1" })], authUsers: [{ id: "u-al1", email: "a@test.local" }] });
  const r = await call(f);
  assert.equal(r.status, 200);
  assert.equal(f.log.updated[0].id, "u-al1");
});
await t("R2: auth_uid que no corresponde a ninguna cuenta: 409 sin cambios", async () => {
  const f = fake({ alumnos: [al({ auth_uid: "u-fantasma" })], authUsers: [{ id: "otra", email: "a@test.local" }] });
  assert.equal((await call(f)).status, 409);
  nothingChanged(f);
});
await t("R2: cuenta vinculada a OTRO alumno: 409 sin cambios", async () => {
  const f = fake({ alumnos: [al({ auth_uid: "u-x" })], authUsers: [{ id: "u-x", email: "x@test.local", app_metadata: { alumno_id: AL2 } }] });
  assert.equal((await call(f)).status, 409);
  nothingChanged(f);
});
await t("R2: cuenta protegida (la del solicitante o de un entrenador autorizado): 403 sin cambios", async () => {
  for (const uid of [COACH, COACH2]) {
    const f = fake({ alumnos: [al({ auth_uid: uid })], authUsers: [{ id: uid, email: "coach@test.local" }] });
    const r = await call(f, { allowedCoachUids: [COACH, COACH2] });
    assert.equal(r.status, 403, "uid=" + uid);
    nothingChanged(f);
  }
});
await t("R2: cuenta vinculada pero el email de la fila ya es de OTRA cuenta: 409 sin cambios", async () => {
  const f = fake({ alumnos: [al()], authUsers: [acct({ email: "viejo@test.local" }), { id: "otra", email: "a@test.local" }] });
  assert.equal((await call(f)).status, 409);
  nothingChanged(f);
});
await t("cuenta vinculada con email viejo: se actualiza la contrasena y se alinea el email de login con el de la fila", async () => {
  const f = fake({ alumnos: [al()], authUsers: [acct({ email: "viejo@test.local" })] });
  assert.equal((await call(f)).status, 200);
  assert.equal(f.log.updated[0].id, "u-al1");
  assert.equal(f.log.updated[0].attrs.email, "a@test.local");
});
await t("R2: si crear la cuenta falla, no hay reintento que modifique una cuenta por email", async () => {
  const f = fake({ alumnos: [al()], authUsers: [], createFails: true });
  const r = await call(f);
  assert.equal(r.status, 400);
  assert.equal(f.log.updated.length, 0);
});
await t("R2: listado de cuentas truncado y sin vinculo: falla cerrada (500), no crea nada", async () => {
  const many = Array.from({ length: 4000 }, (_, i) => ({ id: "u" + i, email: "u" + i + "@x.local" }));
  const f = fake({ alumnos: [al()], authUsers: many });
  const r = await call(f);
  assert.equal(r.status, 500);
  nothingChanged(f);
});

// ---- busqueda del alumno ----
await t("comodines en el email (% y _) no seleccionan otras filas: 403 sin cambios", async () => {
  const rows = [al({ email: "a1@test.local" }), al({ id: AL2, email: "a2@test.local" })];
  for (const email of ["a_@test.local", "%", "a%@test.local"]) {
    const f = fake({ alumnos: rows, authUsers: [] });
    const r = await call(f, { body: { alumnoEmail: email, newPassword: "Nueva#1234" } });
    assert.equal(r.status, 403, "email=" + email);
    nothingChanged(f);
  }
});
await t("dos filas con el mismo email: falla cerrada (409), sin cambios", async () => {
  const f = fake({ alumnos: [al(), al({ id: AL2 })], authUsers: [acct()] });
  const r = await call(f);
  assert.ok(r.status === 409 || r.status === 500, "status=" + r.status);
  nothingChanged(f);
});

// ---- estructura (solo con la implementacion actual) ----
if (!legacyFile) {
  await t("index.ts toma los entrenadores autorizados del secreto COACH_UIDS y delega en handler.js", async () => {
    const idx = readFileSync(FN_DIR + "index.ts", "utf8");
    assert.ok(/Deno\.env\.get\(\s*['"]COACH_UIDS['"]\s*\)/.test(idx));
    assert.ok(/parseCoachUids/.test(idx) && /handleUpdateAlumnoPassword/.test(idx));
    assert.ok(!/\.ilike\(/.test(idx), "index.ts no debe consultar alumnos por su cuenta");
  });
  await t("handler.js no usa la tabla entrenadores ni modifica cuentas por email", async () => {
    const h = readFileSync(FN_DIR + "handler.js", "utf8");
    assert.ok(!/from\(\s*['"]entrenadores['"]/.test(h));
    assert.ok(!/ilike\(\s*['"]email['"]\s*,\s*alumnoEmail/.test(h), "el email del cliente debe escaparse antes de buscar");
  });
}

console.log(n + " tests ok" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
