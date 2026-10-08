// Pruebas de supabase/functions/update-alumno-password/provisioning.js (S0.6.1).
//
//   node scripts/test-provisionStudentAuth.mjs
//
// Sin red ni produccion: el cliente admin (service role) es un doble en memoria que simula auth.users,
// auth.admin.* y la tabla public.alumnos (incluido UNIQUE(auth_uid)).

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  provisionStudentAuth, parseCoachConfig, isCoachUser, canManageAlumno, extractBearer, escapeLike, LEGACY_COACH_ID,
} from "../supabase/functions/update-alumno-password/provisioning.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const COACH = "c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0";
const U_A = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";
const U_B = "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2";
const U_FREE = "f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3"; // Auth user sin alumno
const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_N = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"; // alumno nuevo
const PASSWORD = "S3cr3t-Pa55w0rd!";
const SERVICE_KEY = "service-role-key-DO-NOT-LOG";
const TOK_COACH = "jwt-coach-token-xyz";
const TOK_ALUMNO_A = "jwt-alumno-a-token-xyz";

const COACH_USER = { id: COACH, email: "entrenador@irontrack.app", email_confirmed_at: "2026-01-01" };

function baseUsers() {
  return [
    COACH_USER,
    { id: U_A, email: "alumno.a@mail.com", email_confirmed_at: "x" },
    { id: U_B, email: "alumno.b@mail.com", email_confirmed_at: "x" },
    { id: U_FREE, email: "nuevo@mail.com", email_confirmed_at: "x" },
  ];
}
function baseAlumnos() {
  return [
    { id: ID_A, nombre: "A", email: "Alumno.A@Mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: U_A },
    { id: ID_B, nombre: "B", email: "alumno.b@mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: U_B },
    { id: ID_N, nombre: "N", email: "Nuevo@Mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: null },
  ];
}

function likeToRegex(pat) {
  let re = "";
  for (let i = 0; i < pat.length; i++) {
    const c = pat[i];
    if (c === "\\" && i + 1 < pat.length) { re += pat[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); continue; }
    if (c === "%") { re += ".*"; continue; }
    if (c === "_") { re += "."; continue; }
    re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$", "i");
}

function makeAdmin(opts) {
  const o = opts || {};
  const users = o.users || baseUsers();
  const alumnos = o.alumnos || baseAlumnos();
  const tokens = o.tokens || { [TOK_COACH]: COACH, [TOK_ALUMNO_A]: U_A };
  const log = { passwordUpdates: [], created: [], deleted: [], alumnoWrites: [] };
  let nextId = 0;

  const admin = {
    log, users, alumnos,
    auth: {
      async getUser(token) {
        const uid = tokens[token];
        const user = users.find((u) => u.id === uid);
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "invalid jwt" } };
      },
      admin: {
        async getUserById(id) {
          const user = users.find((u) => u.id === id);
          return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "not found" } };
        },
        async listUsers({ page, perPage }) {
          return { data: { users: users.slice((page - 1) * perPage, page * perPage) }, error: null };
        },
        async createUser({ email, password }) {
          if (o.createFails) return { data: { user: null }, error: { message: "Database error creating new user" } };
          if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return { data: { user: null }, error: { message: "email_exists" } };
          const user = { id: "9" + String(++nextId).padStart(7, "0") + "-0000-4000-8000-000000000000", email, email_confirmed_at: "now" };
          users.push(user);
          log.created.push({ id: user.id, email, hasPassword: typeof password === "string" });
          return { data: { user }, error: null };
        },
        async updateUserById(id, attrs) {
          if (!users.some((u) => u.id === id)) return { data: { user: null }, error: { message: "not found" } };
          log.passwordUpdates.push({ id, password: attrs.password });
          return { data: { user: users.find((u) => u.id === id) }, error: null };
        },
        async deleteUser(id) {
          log.deleted.push(id);
          const i = users.findIndex((u) => u.id === id);
          if (i >= 0) users.splice(i, 1);
          return { data: {}, error: null };
        },
      },
    },
    from(table) {
      assert.equal(table, "alumnos");
      const q = { op: "select", filters: [], patch: null, returning: false };
      const builder = {
        select(cols) { if (q.op === "update") q.returning = true; q.cols = cols; return builder; },
        update(patch) { q.op = "update"; q.patch = patch; return builder; },
        eq(col, val) { q.filters.push((r) => String(r[col]) === String(val)); return builder; },
        ilike(col, pat) { const re = likeToRegex(pat); q.filters.push((r) => r[col] != null && re.test(r[col])); return builder; },
        is(col, val) { q.filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return builder; },
        maybeSingle() { q.single = true; return builder; },
        then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
      };
      function run() {
        if (o.failAlumnosQuery) return { data: null, error: { message: "boom", code: "XX000" } };
        const rows = alumnos.filter((r) => q.filters.every((f) => f(r)));
        if (q.op === "update") {
          if (o.failLink) return { data: [], error: null };
          for (const r of rows) {
            if (q.patch.auth_uid && alumnos.some((x) => x !== r && x.auth_uid === q.patch.auth_uid)) return { data: null, error: { code: "23505", message: "duplicate key" } };
          }
          rows.forEach((r) => { Object.assign(r, q.patch); log.alumnoWrites.push({ id: r.id, keys: Object.keys(q.patch) }); });
          return { data: rows.map((r) => ({ id: r.id, auth_uid: r.auth_uid })), error: null };
        }
        const cols = q.cols.split(",");
        const data = rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
        if (q.single) {
          if (data.length > 1) return { data: null, error: { code: "PGRST116", message: "multiple rows" } };
          return { data: data[0] || null, error: null };
        }
        return { data, error: null };
      }
      return builder;
    },
  };
  return admin;
}

// Captura TODO lo que se loguea (consola + logger inyectado) para verificar que no hay secretos.
const captured = [];
const origConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };
function startCapture() { ["warn", "error", "info"].forEach((k) => { console[k] = (...a) => captured.push(a.map((x) => JSON.stringify(x)).join(" ")); }); }
function stopCapture() { Object.assign(console, origConsole); }

const COACH_CFG = parseCoachConfig({});
function call(admin, alumnoId, over) {
  const o = over || {};
  return provisionStudentAuth(
    { admin, coach: o.coach || COACH_CFG, log: console },
    { authorization: "authorization" in o ? o.authorization : "Bearer " + TOK_COACH, alumnoId, newPassword: "newPassword" in o ? o.newPassword : PASSWORD },
  );
}

startCapture();

// ── A..C: caller autorizado ───────────────────────────────────────────────────────────────────────────────

await test("A. coach autorizado + alumno con auth_uid -> opera sobre ESE Auth user y conserva el vinculo (sin buscar por email)", async () => {
  // El Auth user con el email del alumno (U_FREE) es otro: igual no se usa porque ya hay vinculo canonico.
  const admin = makeAdmin({ alumnos: [{ id: ID_A, nombre: "A", email: "nuevo@mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: U_A }] });
  const r = await call(admin, ID_A);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, authUid: U_A, linked: false, created: false });
  assert.deepEqual(admin.log.passwordUpdates, [{ id: U_A, password: PASSWORD }]);
  assert.equal(admin.alumnos[0].auth_uid, U_A);
  assert.equal(admin.log.alumnoWrites.length, 0, "no reescribe el vinculo existente");
  assert.equal(admin.log.created.length, 0);
});

await test("B. coach + alumno nuevo (auth_uid NULL) + Auth user existente inequivoco -> vincula y cambia la password", async () => {
  const admin = makeAdmin();
  const r = await call(admin, ID_N);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true, authUid: U_FREE, linked: true, created: false });
  assert.equal(admin.alumnos.find((a) => a.id === ID_N).auth_uid, U_FREE);
  assert.deepEqual(admin.log.passwordUpdates, [{ id: U_FREE, password: PASSWORD }]);
  assert.deepEqual(admin.log.alumnoWrites, [{ id: ID_N, keys: ["auth_uid"] }], "solo se escribe auth_uid");
  assert.equal(admin.log.created.length, 0, "no crea duplicados");
});

await test("C. coach + alumno nuevo + Auth user inexistente -> crea el Auth user, vincula y responde ok", async () => {
  const users = baseUsers().filter((u) => u.id !== U_FREE);
  const admin = makeAdmin({ users });
  const r = await call(admin, ID_N);
  assert.equal(r.status, 200);
  assert.equal(r.body.created, true);
  assert.equal(r.body.linked, true);
  assert.equal(admin.log.created.length, 1);
  assert.equal(admin.log.created[0].email, "nuevo@mail.com", "email normalizado, tomado de la fila de alumnos");
  assert.equal(admin.alumnos.find((a) => a.id === ID_N).auth_uid, r.body.authUid);
  assert.equal(admin.log.passwordUpdates.length, 0, "createUser ya fija la password");
});

// ── D..F: rechazos de autorizacion ─────────────────────────────────────────────────────────────────────────

await test("D. un alumno autenticado intenta administrar otro alumno (incluso el legacy) -> 403 y nada cambia", async () => {
  const admin = makeAdmin();
  const r = await call(admin, ID_B, { authorization: "Bearer " + TOK_ALUMNO_A });
  assert.equal(r.status, 403);
  assert.equal(admin.log.passwordUpdates.length, 0);
  assert.equal(admin.log.created.length, 0);
  assert.equal(admin.log.alumnoWrites.length, 0);
  // tampoco puede tocar su propia password por esta via
  const r2 = await call(admin, ID_A, { authorization: "Bearer " + TOK_ALUMNO_A });
  assert.equal(r2.status, 403);
});

await test("E. caller autenticado pero no demostrablemente coach -> 403 (email distinto, sin confirmar, uid fuera de la lista, o es alumno con email de coach)", async () => {
  // usuario cualquiera
  let admin = makeAdmin();
  assert.equal((await call(admin, ID_N, { authorization: "Bearer " + TOK_ALUMNO_A })).status, 403);
  // email de coach pero NO confirmado
  const users = baseUsers(); users[0] = { id: COACH, email: "entrenador@irontrack.app", email_confirmed_at: null };
  admin = makeAdmin({ users });
  assert.equal((await call(admin, ID_N)).status, 403);
  // COACH_AUTH_UIDS configurado: solo esos uid; el email ya no alcanza
  admin = makeAdmin();
  assert.equal((await call(admin, ID_N, { coach: parseCoachConfig({ COACH_AUTH_UIDS: U_B }) })).status, 403);
  // con el uid correcto configurado, el coach pasa
  admin = makeAdmin();
  assert.equal((await call(admin, ID_N, { coach: parseCoachConfig({ COACH_AUTH_UIDS: COACH }) })).status, 200);
  // cuenta con email de coach pero vinculada a un alumno -> rechazada
  const alumnos = baseAlumnos(); alumnos[0].auth_uid = COACH;
  admin = makeAdmin({ alumnos });
  assert.equal((await call(admin, ID_N)).status, 403);
  // user_metadata.role="entrenador" y otros datos no son evidencia
  const users2 = baseUsers(); users2[1] = Object.assign({}, users2[1], { user_metadata: { role: "entrenador" } });
  admin = makeAdmin({ users: users2 });
  assert.equal((await call(admin, ID_N, { authorization: "Bearer " + TOK_ALUMNO_A })).status, 403);
  assert.equal(admin.log.passwordUpdates.length, 0);
});

await test("F. sin JWT / JWT invalido / header malformado -> 401", async () => {
  const admin = makeAdmin();
  assert.equal((await call(admin, ID_N, { authorization: "" })).status, 401);
  assert.equal((await call(admin, ID_N, { authorization: undefined })).status, 401);
  assert.equal((await call(admin, ID_N, { authorization: "Bearer " })).status, 401);
  assert.equal((await call(admin, ID_N, { authorization: "Basic abc" })).status, 401);
  assert.equal((await call(admin, ID_N, { authorization: "Bearer jwt-que-no-existe" })).status, 401);
  assert.equal(admin.log.passwordUpdates.length, 0);
  assert.equal(extractBearer("bearer  abc "), "abc");
});

// ── G..J: identidad y conflictos ───────────────────────────────────────────────────────────────────────────

await test("G. auth_uid existente distinto del Auth user que matchea por email -> NO se sobrescribe; se usa el vinculo canonico", async () => {
  // La fila apunta a U_B pero su email coincide con el Auth user U_A.
  const alumnos = [{ id: ID_A, nombre: "A", email: "alumno.a@mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: U_B }];
  const admin = makeAdmin({ alumnos });
  const r = await call(admin, ID_A);
  assert.equal(r.status, 200);
  assert.equal(r.body.authUid, U_B);
  assert.equal(admin.alumnos[0].auth_uid, U_B, "el vinculo no cambia");
  assert.deepEqual(admin.log.passwordUpdates.map((p) => p.id), [U_B]);
  assert.equal(admin.log.alumnoWrites.length, 0);
});

await test("G2. vinculo canonico a un Auth user inexistente -> 409; a la cuenta del coach -> 403; sin cambios", async () => {
  let admin = makeAdmin({ alumnos: [{ id: ID_A, nombre: "A", email: "x@mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4" }] });
  assert.equal((await call(admin, ID_A)).status, 409);
  // vinculo al coach: la cuenta del coach figura como alumno -> el caller queda rechazado antes de operar (403)
  admin = makeAdmin({ alumnos: [{ id: ID_A, nombre: "A", email: "x@mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: COACH }] });
  assert.equal((await call(admin, ID_A)).status, 403);
  assert.equal(admin.log.passwordUpdates.length, 0);
});

await test("H. Auth user ya vinculado a otro alumno -> 409, sin vincular ni cambiar password (ni crear)", async () => {
  // El alumno nuevo comparte email con el Auth user U_B, que ya es de B.
  const alumnos = baseAlumnos(); alumnos[2].email = "alumno.b@mail.com";
  // (el email tambien lo tiene B -> ambiguo; probamos el caso puro: B con otro email en la tabla)
  alumnos[1].email = "otro@mail.com";
  const admin = makeAdmin({ alumnos });
  const r = await call(admin, ID_N);
  assert.equal(r.status, 409);
  assert.equal(admin.alumnos.find((a) => a.id === ID_N).auth_uid, null);
  assert.equal(admin.log.passwordUpdates.length, 0);
  assert.equal(admin.log.created.length, 0);
  assert.equal(admin.alumnos.find((a) => a.id === ID_B).auth_uid, U_B, "B no se toca");
});

await test("H2. el vinculo falla (carrera / UNIQUE) -> 409; si el Auth user se acababa de crear se revierte", async () => {
  const users = baseUsers().filter((u) => u.id !== U_FREE);
  const admin = makeAdmin({ users, failLink: true });
  const r = await call(admin, ID_N);
  assert.equal(r.status, 409);
  assert.equal(admin.log.created.length, 1);
  assert.deepEqual(admin.log.deleted, [admin.log.created[0].id], "el Auth user creado se elimina (sin huerfanos)");
  assert.equal(admin.alumnos.find((a) => a.id === ID_N).auth_uid, null);
  // usuario preexistente + fallo de vinculo: no se borra ni se toca su password
  const admin2 = makeAdmin({ failLink: true });
  assert.equal((await call(admin2, ID_N)).status, 409);
  assert.equal(admin2.log.deleted.length, 0);
  assert.equal(admin2.log.passwordUpdates.length, 0);
});

await test("I. alumnoId inexistente / invalido / ausente -> 404 / 400", async () => {
  const admin = makeAdmin();
  assert.equal((await call(admin, "dddddddd-dddd-4ddd-8ddd-dddddddddddd")).status, 404);
  assert.equal((await call(admin, "")).status, 400);
  assert.equal((await call(admin, undefined)).status, 400);
  assert.equal((await call(admin, { $ne: 1 })).status, 400);
  assert.equal((await call(admin, ID_N, { newPassword: "" })).status, 400);
  assert.equal((await call(admin, ID_N, { newPassword: undefined })).status, 400);
  assert.equal(admin.log.passwordUpdates.length, 0);
});

await test("J. auth_uid NULL + email invalido/vacio/duplicado/ambiguo -> rechazado sin crear ni vincular", async () => {
  for (const email of [null, "", "   ", "no-es-email", "a b@mail.com"]) {
    const alumnos = baseAlumnos(); alumnos[2].email = email;
    const admin = makeAdmin({ alumnos });
    const r = await call(admin, ID_N);
    assert.equal(r.status, 400, String(email));
    assert.equal(admin.log.created.length, 0);
    assert.equal(admin.alumnos[2].auth_uid, null);
  }
  // otro alumno con el mismo email (case distinto) -> identidad ambigua
  let alumnos = baseAlumnos(); alumnos.push({ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", nombre: "Dup", email: "NUEVO@mail.com", entrenador_id: LEGACY_COACH_ID, auth_uid: null });
  let admin = makeAdmin({ alumnos });
  assert.equal((await call(admin, ID_N)).status, 409);
  assert.equal(admin.log.created.length, 0);
  // dos Auth users con el mismo email (normalizado) -> ambiguo
  const users = baseUsers(); users.push({ id: "11111111-2222-4333-8444-555555555555", email: "NUEVO@MAIL.COM", email_confirmed_at: "x" });
  admin = makeAdmin({ users });
  assert.equal((await call(admin, ID_N)).status, 409);
  assert.equal(admin.alumnos.find((a) => a.id === ID_N).auth_uid, null);
  assert.equal(admin.log.passwordUpdates.length, 0);
  // el email coincide con la cuenta del coach -> no se vincula
  alumnos = baseAlumnos(); alumnos[2].email = "entrenador@irontrack.app";
  admin = makeAdmin({ alumnos });
  assert.equal((await call(admin, ID_N)).status, 409);
  assert.equal(admin.alumnos[2].auth_uid, null);
  // los comodines de LIKE no matchean a otros alumnos
  assert.equal(escapeLike("a_b%c\\d"), "a\\_b\\%c\\\\d");
});

await test("pertenencia: alumno de OTRO coach (uuid distinto) -> 403; alumno del uuid del coach -> ok", async () => {
  let alumnos = baseAlumnos(); alumnos[2].entrenador_id = "99999999-9999-4999-8999-999999999999";
  let admin = makeAdmin({ alumnos });
  assert.equal((await call(admin, ID_N)).status, 403);
  assert.equal(canManageAlumno({ id: COACH }, { entrenador_id: COACH }), true);
  assert.equal(canManageAlumno({ id: COACH }, { entrenador_id: null }), false);
  alumnos = baseAlumnos(); alumnos[2].entrenador_id = COACH;
  admin = makeAdmin({ alumnos });
  assert.equal((await call(admin, ID_N)).status, 200);
});

await test("errores internos de DB -> 500 sin cambios", async () => {
  const admin = makeAdmin({ failAlumnosQuery: true });
  const r = await call(admin, ID_N);
  assert.equal(r.status, 500);
  assert.equal(admin.log.passwordUpdates.length, 0);
});

await test("config: isCoachUser / parseCoachConfig", async () => {
  assert.equal(isCoachUser(COACH_USER, parseCoachConfig({})), true);
  assert.equal(isCoachUser({ id: U_A, email: "alumno.a@mail.com", email_confirmed_at: "x" }, parseCoachConfig({})), false);
  assert.equal(isCoachUser(null, parseCoachConfig({})), false);
  assert.equal(isCoachUser({ id: "no-uuid", email: "entrenador@irontrack.app", email_confirmed_at: "x" }, parseCoachConfig({})), false);
  assert.equal(parseCoachConfig({ COACH_AUTH_UIDS: "basura, " + COACH.toUpperCase() }).uids.has(COACH), true);
});

// ── K: logs ───────────────────────────────────────────────────────────────────────────────────────────────

stopCapture();

await test("K. ni password, ni JWT, ni service role aparecen en logs ni en respuestas de error", async () => {
  assert.ok(captured.length > 0, "el escenario debio generar logs de rechazo");
  const all = captured.join("\n");
  [PASSWORD, TOK_COACH, TOK_ALUMNO_A, SERVICE_KEY, "Bearer"].forEach((secret) => {
    assert.ok(!all.includes(secret), "no debe loguearse: " + secret);
  });
  // y las respuestas de error tampoco los incluyen
  const admin = makeAdmin();
  const bodies = [
    await call(admin, ID_B, { authorization: "Bearer " + TOK_ALUMNO_A }),
    await call(admin, "x".repeat(200)),
    await call(admin, ID_N, { authorization: "Bearer nope" }),
  ].map((r) => JSON.stringify(r.body)).join(" ");
  [PASSWORD, TOK_ALUMNO_A].forEach((secret) => assert.ok(!bodies.includes(secret)));
  // estatico: el codigo de la funcion no loguea password/JWT/service role
  const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "supabase", "functions", "update-alumno-password");
  for (const f of ["provisioning.js", "index.ts"]) {
    const src = readFileSync(join(root, f), "utf8");
    const logLines = src.split("\n").filter((l) => /console\.|log\.(warn|error|info)/.test(l));
    logLines.forEach((l) => assert.ok(!/(newPassword|password|authorization|token|SERVICE_ROLE|jwt)/i.test(l.replace(/"[^"]*"|'[^']*'/g, '""').replace(/\/\/.*$/, "")), f + ": " + l.trim()));
  }
});

await test("L. el cliente NO escribe auth_uid: ninguna escritura/PATCH/insert con auth_uid fuera de la Edge Function", async () => {
  const repo = join(fileURLToPath(new URL(".", import.meta.url)), "..");
  const skip = new Set(["node_modules", "dist", ".git", "supabase", "scripts", ".chrome-headless", ".chrome-scroll-test", "sql"]);
  const files = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (/\.(jsx?|mjs|cjs|ts|tsx)$/.test(name)) files.push(p);
    }
  })(repo);
  const offenders = [];
  files.forEach((f) => {
    readFileSync(f, "utf8").split("\n").forEach((rawLine, i) => {
      const line = rawLine.replace(/^\s*(\/\/|\*|\/\*).*$/, "").replace(/\s\/\/.*$/, ""); // ignora comentarios
      if (!/auth_uid/.test(line)) return;
      // escrituras: clave de objeto (auth_uid: x), asignacion (auth_uid = x), o querystring/patch con auth_uid
      if (/auth_uid\s*:\s*\S/.test(line) || /auth_uid\s*=(?!=)\s*\S/.test(line) || /PATCH|\.update\(|\.insert\(|\.upsert\(/.test(line)) offenders.push(relative(repo, f) + ":" + (i + 1) + " " + line.trim());
    });
  });
  assert.deepEqual(offenders, [], "escritura de auth_uid en el cliente:\n" + offenders.join("\n"));
  // y la llamada a la Edge Function envia alumnoId, no el email ni auth_uid
  const app = readFileSync(join(repo, "App.jsx"), "utf8");
  const m = /functions\.invoke\("update-alumno-password",\{\s*body:\{([^}]*)\}/.exec(app);
  assert.ok(m, "no se encontro la invocacion");
  assert.ok(/alumnoId:editAlumnoModal\.id/.test(m[1]) && !/alumnoEmail|auth_uid/.test(m[1]), m[1]);
});

console.log("\n" + count + " tests ok");
