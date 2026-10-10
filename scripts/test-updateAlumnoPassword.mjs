// update-alumno-password: propiedad por UID y vinculo seguro de alumnos.auth_uid.   node scripts/test-updateAlumnoPassword.mjs
import assert from "node:assert/strict";
import { handleUpdateAlumnoPassword } from "../supabase/functions/update-alumno-password/core.js";

const COACH = "00000000-0000-0000-0000-0000000000c1", OTHER = "00000000-0000-0000-0000-0000000000c2", STUD = "00000000-0000-0000-0000-0000000000a1";
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

function fake({ alumnos = [], authUsers = [], tokens = {}, failLink = false } = {}) {
  const log = { listUsers: 0, created: [], updated: [], deleted: [], linkUpdates: [] };
  const db = alumnos.map((a) => ({ ...a }));
  const admin = {
    auth: {
      getUser: async (tok) => (tokens[tok] ? { data: { user: { id: tokens[tok] } }, error: null } : { data: { user: null }, error: { message: "bad" } }),
      admin: {
        listUsers: async () => { log.listUsers++; return { data: { users: authUsers }, error: null }; },
        createUser: async (u) => { const user = { id: "new-" + (log.created.length + 1), email: u.email }; log.created.push(u); authUsers.push(user); return { data: { user }, error: null }; },
        updateUserById: async (id, attrs) => { log.updated.push({ id, attrs }); return { error: null }; },
        deleteUser: async (id) => { log.deleted.push(id); return { error: null }; },
      },
    },
    from: (table) => {
      assert.equal(table, "alumnos");
      const q = { filters: {}, _update: null, _isNull: null };
      const api = {
        select: () => api, eq: (c, v) => { q.filters[c] = v; return api; }, is: (c, v) => { q._isNull = c; return api; },
        update: (attrs) => { q._update = attrs; return api; },
        maybeSingle: async () => ({ data: db.find((a) => String(a.id) === String(q.filters.id)) || null, error: null }),
        then: (res) => {
          if (q._update) {
            if (failLink) return res({ data: [], error: null });
            const row = db.find((a) => a.id === q.filters.id && (q._isNull ? a[q._isNull] == null : true));
            if (row) { Object.assign(row, q._update); log.linkUpdates.push({ id: row.id, ...q._update }); }
            return res({ data: row ? [{ id: row.id }] : [], error: null });
          }
          return res({ data: [], error: null });
        },
      };
      return api;
    },
  };
  return { admin, log, db };
}
const call = (f, over = {}) => handleUpdateAlumnoPassword({ callerToken: "tc", body: { alumnoId: "al1", newPassword: "Nueva#1234" }, admin: f.admin, ...over });
const base = (extra = {}) => ({ alumnos: [{ id: "al1", email: "A@Test.local", entrenador_id: COACH, auth_uid: null, ...extra }], tokens: { tc: COACH, to: OTHER, ts: STUD } });

await t("sin token / sin sesion valida / faltan campos", async () => {
  assert.equal((await call(fake(base()), { callerToken: "" })).status, 401);
  assert.equal((await call(fake(base()), { callerToken: "malo" })).status, 401);
  assert.equal((await call(fake(base()), { body: { alumnoId: "al1" } })).status, 400);
  assert.equal((await call(fake(base()), { body: { newPassword: "x" } })).status, 400);
});
await t("otro entrenador y un alumno reciben 403 y no se toca nada", async () => {
  for (const tok of ["to", "ts"]) {
    const f = fake(base()); const r = await call(f, { callerToken: tok });
    assert.equal(r.status, 403); assert.deepEqual([f.log.created.length, f.log.updated.length, f.log.linkUpdates.length], [0, 0, 0]);
  }
  const f = fake(base()); assert.equal((await call(f, { body: { alumnoId: "no-existe", newPassword: "x" } })).status, 403);
});
await t("el valor legacy entrenador_principal ya NO concede propiedad", async () => {
  const f = fake(base({ entrenador_id: "entrenador_principal" }));
  assert.equal((await call(f)).status, 403); assert.equal(f.log.created.length, 0);
});
await t("alumno sin cuenta: crea la cuenta con el email del alumno (DB) y vincula auth_uid", async () => {
  const f = fake(base());
  const r = await call(f, { body: { alumnoId: "al1", newPassword: "Nueva#1234", alumnoEmail: "otro@evil.com" } });
  assert.deepEqual(r, { status: 200, body: { ok: true, linked: true } });
  assert.equal(f.log.created[0].email, "a@test.local"); // no confia en el email del cliente
  assert.equal(f.db[0].auth_uid, "new-1");
});
await t("email ya existente en Auth sin vinculo: 409, no se cambia contraseña ni se vincula (sin vinculo por email)", async () => {
  const f = fake({ ...base(), authUsers: [{ id: "victima", email: "a@test.local" }] });
  const r = await call(f);
  assert.equal(r.status, 409);
  assert.deepEqual([f.log.created.length, f.log.updated.length, f.log.linkUpdates.length], [0, 0, 0]);
  assert.equal(f.db[0].auth_uid, null);
});
await t("alumno ya vinculado: actualiza por auth_uid sin buscar por email", async () => {
  const f = fake(base({ auth_uid: "uid-al1" }));
  const r = await call(f);
  assert.equal(r.status, 200); assert.equal(f.log.listUsers, 0);
  assert.equal(f.log.updated[0].id, "uid-al1"); assert.equal(f.log.updated[0].attrs.email, "a@test.local");
  assert.equal(f.log.created.length, 0);
});
await t("si falla el vinculo se revierte la cuenta creada", async () => {
  const f = fake({ ...base(), failLink: true });
  const r = await call(f);
  assert.equal(r.status, 500); assert.deepEqual(f.log.deleted, ["new-1"]);
});
await t("carrera: si otro proceso vinculo antes, no se pisa auth_uid y se revierte", async () => {
  const f = fake(base());
  const origFrom = f.admin.from;
  f.admin.from = (tb) => { const api = origFrom(tb); const sel = api.maybeSingle; api.maybeSingle = async () => { const r = await sel(); f.db[0].auth_uid = "otro"; return { data: { ...r.data, auth_uid: null }, error: null }; }; return api; };
  const r = await call(f);
  assert.equal(r.status, 500); assert.equal(f.db[0].auth_uid, "otro"); assert.deepEqual(f.log.deleted, ["new-1"]);
});
console.log(n + " tests ok");
