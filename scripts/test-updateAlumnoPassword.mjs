// update-alumno-password: propiedad por UID y vinculo seguro de alumnos.auth_uid.   node scripts/test-updateAlumnoPassword.mjs
import assert from "node:assert/strict";
import { handleUpdateAlumnoPassword } from "../supabase/functions/update-alumno-password/core.js";

const AL1 = "11111111-1111-1111-1111-111111111111";
const COACH = "00000000-0000-0000-0000-0000000000c1", OTHER = "00000000-0000-0000-0000-0000000000c2", STUD = "00000000-0000-0000-0000-0000000000a1";
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log("ok -", name); };

function fake({ alumnos = [], authUsers = [], tokens = {}, failLink = false, failDelete = false, principals = [], principalError = false } = {}) {
  const log = { listUsers: 0, created: [], updated: [], deleted: [], linkUpdates: [] };
  const db = alumnos.map((a) => ({ ...a }));
  const admin = {
    auth: {
      getUser: async (tok) => (tokens[tok] ? { data: { user: { id: tokens[tok] } }, error: null } : { data: { user: null }, error: { message: "bad" } }),
      admin: {
        listUsers: async () => { log.listUsers++; return { data: { users: authUsers }, error: null }; },
        createUser: async (u) => { const user = { id: "new-" + (log.created.length + 1), email: u.email }; log.created.push(u); authUsers.push(user); return { data: { user }, error: null }; },
        updateUserById: async (id, attrs) => { log.updated.push({ id, attrs }); return { error: null }; },
        deleteUser: async (id) => { log.deleted.push(id); return failDelete ? { error: { message: 'x' } } : { error: null }; },
      },
    },
    from: (table) => {
      if (table === "coach_principal") {
        const q2 = { uid: null };
        const a2 = { select: () => a2, eq: (c, v) => { q2.uid = v; return a2; },
          maybeSingle: async () => principalError ? { data: null, error: { message: "tabla ausente" } } : { data: principals.includes(q2.uid) ? { uid: q2.uid } : null, error: null } };
        return a2;
      }
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
const call = (f, over = {}) => handleUpdateAlumnoPassword({ callerToken: "tc", body: { alumnoId: AL1, newPassword: "Nueva#1234" }, admin: f.admin, ...over });
const base = (extra = {}) => ({ alumnos: [{ id: AL1, email: "A@Test.local", entrenador_id: COACH, auth_uid: null, ...extra }], tokens: { tc: COACH, to: OTHER, ts: STUD } });

await t("sin token / sin sesion valida / faltan campos", async () => {
  assert.equal((await call(fake(base()), { callerToken: "" })).status, 401);
  assert.equal((await call(fake(base()), { callerToken: "malo" })).status, 401);
  assert.equal((await call(fake(base()), { body: { alumnoId: AL1 } })).status, 400);
  assert.equal((await call(fake(base()), { body: { newPassword: "x" } })).status, 400);
});
await t("otro entrenador y un alumno reciben 403 y no se toca nada", async () => {
  for (const tok of ["to", "ts"]) {
    const f = fake(base()); const r = await call(f, { callerToken: tok });
    assert.equal(r.status, 403); assert.deepEqual([f.log.created.length, f.log.updated.length, f.log.linkUpdates.length], [0, 0, 0]);
  }
  const f = fake(base()); assert.equal((await call(f, { body: { alumnoId: "99999999-9999-9999-9999-999999999999", newPassword: "x" } })).status, 403);
});
await t("el valor legacy entrenador_principal ya NO concede propiedad", async () => {
  const f = fake(base({ entrenador_id: "entrenador_principal" }));
  assert.equal((await call(f)).status, 403); assert.equal(f.log.created.length, 0);
});
await t("alumno sin cuenta: crea la cuenta con el email del alumno (DB) y vincula auth_uid", async () => {
  const f = fake(base());
  const r = await call(f, { body: { alumnoId: AL1, newPassword: "Nueva#1234", alumnoEmail: "otro@evil.com" } });
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
await t("alumnoId que no es UUID: 400 sin tocar nada", async () => {
  const f = fake(base()); const r = await call(f, { body: { alumnoId: "x' or 1=1", newPassword: "Nueva#1234" } });
  assert.equal(r.status, 400); assert.equal(f.log.created.length + f.log.updated.length, 0);
});
await t("cuenta vinculada = el propio solicitante o el entrenador principal: 403, sin cambios", async () => {
  const f1 = fake(base({ auth_uid: COACH })); assert.equal((await call(f1)).status, 403); assert.equal(f1.log.updated.length, 0);
  const f2 = fake({ ...base({ auth_uid: "uid-principal" }), principals: ["uid-principal"] });
  assert.equal((await call(f2)).status, 403); assert.equal(f2.log.updated.length, 0);
});
await t("si no se puede verificar el entrenador principal falla cerrado (500, sin cambios)", async () => {
  const f = fake({ ...base({ auth_uid: "uid-al1" }), principalError: true });
  assert.equal((await call(f)).status, 500); assert.equal(f.log.updated.length, 0);
});
await t("si falla el vinculo Y la reversion, no afirma haber revertido e informa el id huerfano", async () => {
  const f = fake({ ...base(), failLink: true, failDelete: true });
  const r = await call(f);
  assert.equal(r.status, 500); assert.match(r.body.error, /eliminar manualmente la cuenta de Auth new-1/);
  assert.ok(!/se revirtio la creacion/.test(r.body.error));
});
console.log(n + " tests ok");
