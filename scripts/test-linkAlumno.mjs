// Pruebas de scripts/admin/link-alumno-core.mjs con un cliente Auth/DB simulado. Datos ficticios; sin red.
import assert from "node:assert/strict";
import { runLink, expectedConfirm, exitCodeFor } from "./admin/link-alumno-core.mjs";

const COACH = "00000000-0000-4000-8000-0000000000c1";
const U1 = "1a000000-0000-4000-8000-000000000001";
const U2 = "2b000000-0000-4000-8000-000000000002";
const U3 = "3c000000-0000-4000-8000-000000000003";
const AL1 = "a1111111-1111-4111-8111-111111111111";
const AL2 = "a2222222-2222-4222-8222-222222222222";

let n = 0, failed = 0;
const t = async (name, fn) => {
  try { await fn(); n++; console.log("ok -", name); }
  catch (e) { failed++; console.log("FAIL -", name); console.log("  " + String((e && e.message) || e).split("\n")[0]); }
};

// ---- simulado ----
function world({ alumnos, users, hooks = {} }) {
  const state = {
    alumnos: JSON.parse(JSON.stringify(alumnos)),
    users: JSON.parse(JSON.stringify(users)),
    writes: [], listCalls: 0, getCalls: 0,
  };
  const find = (id) => state.users.find((u) => u.id === id);
  const admin = {
    from: (table) => {
      if (table !== "alumnos") throw new Error("tabla no permitida: " + table);
      let rows = state.alumnos.slice(); let lim = null;
      const api = {
        select: () => api,
        eq: (c, v) => { rows = rows.filter((r) => String(r[c]) === String(v)); return api; },
        ilike: (c, p) => { const re = new RegExp("^" + String(p).replace(/\\(.)/g, (_, x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).replace(/%/g, ".*") + "$", "i"); rows = rows.filter((r) => re.test(String(r[c] == null ? "" : r[c]))); return api; },
        limit: (k) => { lim = k; return api; },
        then: (res) => res({ data: lim ? rows.slice(0, lim) : rows, error: null }),
      };
      return api;
    },
    auth: { admin: {
      listUsers: async ({ page = 1, perPage = 200 } = {}) => {
        state.listCalls++;
        if (hooks.onList) hooks.onList(state, state.listCalls);
        if (hooks.listFails) return { data: null, error: { message: "network" } };
        return { data: { users: JSON.parse(JSON.stringify(state.users.slice((page - 1) * perPage, page * perPage))) }, error: null };
      },
      getUserById: async (id) => {
        state.getCalls++;
        if (hooks.rereadFails) return { data: null, error: { message: "network" } };
        const u = find(id);
        return u ? { data: { user: JSON.parse(JSON.stringify(u)) }, error: null } : { data: null, error: { message: "not found" } };
      },
      updateUserById: async (id, attrs) => {
        state.writes.push({ id, attrs: JSON.parse(JSON.stringify(attrs)) });
        if (hooks.failBeforeWrite) throw new Error("network before write");
        const u = find(id);
        if (attrs.app_metadata) {
          const merged = hooks.replaceMeta ? {} : { ...(u.app_metadata || {}) };
          for (const [k, v] of Object.entries(attrs.app_metadata)) { if (v === null) delete merged[k]; else merged[k] = v; }
          u.app_metadata = merged;
        }
        if (attrs.email) u.email = attrs.email;
        if (attrs.password) u.password_set = true;
        if (hooks.failAfterWrite) throw new Error("network after write");
        if (hooks.corruptAfterWrite) u.email_confirmed_at = "2099-01-01T00:00:00Z";
        if (hooks.afterWrite) hooks.afterWrite(u);
        return { error: null };
      },
    } },
  };
  return { admin, state };
}
const ficha = (id, email, extra = {}) => ({ id, email, ...extra });
const user = (id, email, extra = {}) => ({ id, email, email_confirmed_at: "2026-01-01T00:00:00Z", phone: null, user_metadata: { role: "alumno" }, app_metadata: { provider: "email" }, updated_at: "2026-01-02T00:00:00Z", ...extra });
const base = (o = {}) => world({
  alumnos: [ficha(AL1, "uno@test.local"), ficha(AL2, "dos@test.local")],
  users: [user(U1, "uno@test.local"), user(U2, "dos@test.local"), user(COACH, "coach@test.local")],
  ...o,
});
const run = (w, over = {}) => runLink({ admin: w.admin, alumnoId: AL1, authId: U1, coachUids: [COACH], ...over });
const OK = (AL = AL1, U = U1) => ({ apply: true, confirm: expectedConfirm(AL, U) });
const noWrites = (w) => assert.equal(w.state.writes.length, 0, "no debe escribir");
const noPII = (r) => assert.ok(!/@|test\.local/i.test(JSON.stringify(r)), "la salida no debe incluir emails");

// ---- dry-run y confirmacion ----
await t("dry-run (por defecto): valida y NO escribe", async () => {
  const w = base(); const r = await run(w);
  assert.equal(r.ok, true); assert.equal(r.code, "DRY_RUN"); assert.equal(r.changed, false); noWrites(w); noPII(r);
});
await t("ejecucion accidental: apply sin confirm o con confirm incorrecto => no escribe", async () => {
  for (const confirm of [undefined, "", AL1, AL1 + ":zzzzzzzz", expectedConfirm(AL2, U1), expectedConfirm(AL1, U2)]) {
    const w = base(); const r = await run(w, { apply: true, confirm });
    assert.equal(r.ok, false); assert.equal(r.code, "SIN_CONFIRMACION"); noWrites(w);
  }
});
await t("confirm sin apply no escribe (sigue siendo dry-run)", async () => {
  const w = base(); const r = await run(w, { confirm: expectedConfirm(AL1, U1) });
  assert.equal(r.code, "DRY_RUN"); noWrites(w);
});

// ---- vinculacion valida ----
await t("vinculacion valida: escribe solo app_metadata.alumno_id; email/confirmacion/user_metadata/password intactos", async () => {
  const w = base(); const before = JSON.stringify({ ...w.state.users[0], app_metadata: undefined });
  const r = await run(w, OK());
  assert.equal(r.ok, true); assert.equal(r.code, "VINCULADA"); assert.equal(r.changed, true); noPII(r);
  assert.equal(w.state.writes.length, 1);
  assert.deepEqual(Object.keys(w.state.writes[0].attrs), ["app_metadata"]);
  const u = w.state.users.find((x) => x.id === U1);
  assert.equal(u.app_metadata.alumno_id, AL1);
  assert.equal(JSON.stringify({ ...u, app_metadata: undefined }), before);
  assert.equal(u.password_set, undefined);
  assert.equal(w.state.users.find((x) => x.id === U2).app_metadata.alumno_id, undefined, "otra cuenta intacta");
});
await t("conserva los demas campos de app_metadata (providers, claves propias)", async () => {
  const w = base({ users: [user(U1, "uno@test.local", { app_metadata: { provider: "email", providers: ["email"], otra: { x: 1 } } }), user(COACH, "coach@test.local")] });
  const r = await run(w, OK()); assert.equal(r.ok, true);
  const m = w.state.users[0].app_metadata;
  assert.deepEqual(m, { provider: "email", providers: ["email"], otra: { x: 1 }, alumno_id: AL1 });
});
await t("repetir sobre una cuenta ya vinculada a ESTE alumno es idempotente: no escribe", async () => {
  const w = base({ users: [user(U1, "uno@test.local", { app_metadata: { alumno_id: AL1 } }), user(COACH, "coach@test.local")] });
  const r = await run(w, OK()); assert.equal(r.ok, true); assert.equal(r.code, "YA_VINCULADA"); noWrites(w);
});

// ---- rechazos ----
const rejects = (name, code, mk, over) => t(name, async () => {
  const w = mk(); const r = await run(w, { ...OK(), ...(over || {}) });
  assert.equal(r.ok, false, "debia abortar"); assert.equal(r.code, code); noWrites(w); noPII(r);
});
await rejects("cuenta equivocada (el email no coincide con la ficha)", "EMAIL_DISTINTO", () => base(), { authId: U2, ...OK(AL1, U2) });
await rejects("email de la cuenta distinto del de la ficha tras un cambio de email", "EMAIL_DISTINTO", () => base({ users: [user(U1, "viejo@test.local"), user(COACH, "coach@test.local")] }));
await rejects("email duplicado en Auth (dos cuentas con el mismo email)", "EMAIL_DUPLICADO_AUTH", () => base({ users: [user(U1, "uno@test.local"), user(U3, "UNO@test.local"), user(COACH, "coach@test.local")] }));
await rejects("email duplicado en fichas (dos alumnos con el mismo email)", "FICHA_EMAIL_DUPLICADO", () => base({ alumnos: [ficha(AL1, "uno@test.local"), ficha(AL2, "UNO@test.local")] }));
await rejects("alumno inexistente", "FICHA_INEXISTENTE", () => base(), { alumnoId: "no-existe", ...OK("no-existe", U1) });
await rejects("ficha con id repetido", "FICHA_DUPLICADA", () => base({ alumnos: [ficha(AL1, "uno@test.local"), ficha(AL1, "otro@test.local")] }));
await rejects("cuenta inexistente", "CUENTA_INEXISTENTE", () => base(), { authId: U3, ...OK(AL1, U3) });
await rejects("cuenta ya vinculada a OTRO alumno", "CUENTA_DE_OTRO_ALUMNO", () => base({ users: [user(U1, "uno@test.local", { app_metadata: { alumno_id: AL2 } }), user(COACH, "coach@test.local")] }));
await rejects("otra cuenta ya vinculada a este alumno", "OTRA_CUENTA_VINCULADA", () => base({ users: [user(U1, "uno@test.local"), user(U3, "otro@test.local", { app_metadata: { alumno_id: AL1 } }), user(COACH, "coach@test.local")] }));
await rejects("cuenta de entrenador", "CUENTA_ENTRENADOR", () => base({ alumnos: [ficha(AL1, "coach@test.local")] }), { authId: COACH, ...OK(AL1, COACH) });
await rejects("sin UIDs de entrenador (no se puede proteger su cuenta)", "SIN_ENTRENADORES", () => base(), { coachUids: [] });
await rejects("UID de entrenador invalido: se rechaza, no se descarta en silencio", "COACH_UID_INVALIDO", () => base(), { coachUids: ["no-uuid", ""] });
await rejects("lista con un UID valido y otro con typo: aborta (no sigue con solo uno)", "COACH_UID_INVALIDO", () => base(), { coachUids: [COACH, COACH.slice(0, -1)] });
await rejects("UID de entrenador valido pero inexistente en Auth (typo): aborta", "ENTRENADOR_NO_ENCONTRADO", () => base(), { coachUids: [COACH, "00000000-0000-4000-8000-0000000000ff"] });
await rejects("cuenta suspendida (banned_until futuro)", "CUENTA_BANEADA", () => base({ users: [user(U1, "uno@test.local", { banned_until: "2999-01-01T00:00:00Z" }), user(COACH, "coach@test.local")] }));
await rejects("proveedor distinto de email en identities", "PROVEEDOR_INESPERADO", () => base({ users: [user(U1, "uno@test.local", { identities: [{ id: "i1", provider: "google" }] }), user(COACH, "coach@test.local")] }));
await rejects("proveedor distinto de email en app_metadata.providers", "PROVEEDOR_INESPERADO", () => base({ users: [user(U1, "uno@test.local", { app_metadata: { provider: "email", providers: ["email", "github"] } }), user(COACH, "coach@test.local")] }));
await rejects("ficha duplicada con espacios alrededor del email (no pasa inadvertida)", "FICHA_EMAIL_DUPLICADO", () => base({ alumnos: [ficha(AL1, "uno@test.local"), ficha(AL2, "  uno@test.local ")] }));
await t("proveedor distinto de email se acepta solo con allowProviders explicito", async () => {
  const w = base({ users: [user(U1, "uno@test.local", { identities: [{ id: "i1", provider: "google" }] }), user(COACH, "coach@test.local")] });
  const r = await run(w, { ...OK(), allowProviders: true }); assert.equal(r.ok, true);
});
await t("el dry-run muestra senales de titularidad y entrenadores protegidos, sin emails", async () => {
  const w = base({ users: [user(U1, "uno@test.local", { last_sign_in_at: "2026-03-03T00:00:00Z", created_at: "2026-01-01T00:00:00Z", identities: [{ id: "i1", provider: "email" }] }), user(COACH, "coach@test.local")] });
  const r = await run(w); const txt = r.log.join("\n");
  assert.match(txt, /entrenadores protegidos: 1/); assert.match(txt, /email confirmado=si/); assert.match(txt, /ultimo login=2026-03-03/); assert.match(txt, /proveedores=\[email\]/);
  noPII(r);
});
await t("cambio de identities o banned_until entre lectura y escritura: aborta", async () => {
  const w = base({ hooks: { onList: (s, call) => { if (call === 2) s.users[0].banned_until = "2999-01-01T00:00:00Z"; } } });
  const r = await run(w, OK()); assert.equal(r.ok, false); noWrites(w);
});
await t("excepcion inesperada: mensaje generico, sin stack ni datos, y estado 'desconocido'", async () => {
  const w = base(); w.admin.from = () => { throw new Error("boom uno@test.local https://x"); };
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "ERROR_INESPERADO"); assert.equal(r.changed, null);
  assert.ok(!/uno@|https/.test(JSON.stringify(r)));
});
await t("50 o mas fichas contienen el texto del email: aborta (no se puede descartar un duplicado)", async () => {
  const many = Array.from({ length: 55 }, (_, i) => ficha("f" + i, "x" + i + "uno@test.local"));
  const w = base({ alumnos: [ficha(AL1, "uno@test.local"), ...many] });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "FICHA_EMAIL_AMBIGUO"); noWrites(w);
});
await t("mensajes de error del servicio: se enmascaran emails y UUID", async () => {
  const w = base(); w.admin.auth.admin.listUsers = async () => ({ data: null, error: { message: "fallo para uno@test.local id " + U1 } });
  const r = await run(w, OK()); assert.equal(r.code, "LISTADO_ERROR");
  assert.ok(!r.message.includes("uno@test.local") && !r.message.includes(U1), r.message);
});
await t("rollback no exige las condiciones propias de vincular (cuenta suspendida, email cambiado, proveedor, dos cuentas vinculadas)", async () => {
  for (const u of [
    user(U1, "uno@test.local", { banned_until: "2999-01-01T00:00:00Z", app_metadata: { alumno_id: AL1 } }),
    user(U1, "cambiado@test.local", { app_metadata: { alumno_id: AL1 } }),
    user(U1, "uno@test.local", { identities: [{ id: "i", provider: "google" }], app_metadata: { alumno_id: AL1 } }),
  ]) {
    const w = base({ users: [u, user(COACH, "coach@test.local")] });
    const r = await run(w, { mode: "rollback", ...OK() });
    assert.equal(r.ok, true, JSON.stringify(r.code)); assert.equal(w.state.writes.length, 1);
    assert.equal(w.state.users[0].app_metadata.alumno_id, undefined);
  }
  const w2 = base({ users: [user(U1, "uno@test.local", { app_metadata: { alumno_id: AL1 } }), user(U3, "otro@test.local", { app_metadata: { alumno_id: AL1 } }), user(COACH, "coach@test.local")] });
  const r2 = await run(w2, { mode: "rollback", ...OK() }); assert.equal(r2.ok, true);
});
await t("rollback sigue rechazando cuentas de entrenador y fichas inexistentes", async () => {
  const w = base({ alumnos: [ficha(AL1, "coach@test.local")], users: [user(COACH, "coach@test.local", { app_metadata: { alumno_id: AL1 } })] });
  const r = await run(w, { mode: "rollback", authId: COACH, ...OK(AL1, COACH) }); assert.equal(r.code, "CUENTA_ENTRENADOR"); noWrites(w);
  const w2 = base(); const r2 = await run(w2, { mode: "rollback", alumnoId: "no-existe", ...OK("no-existe", U1) }); assert.equal(r2.code, "FICHA_INEXISTENTE");
});
await t("suspension VENCIDA (banned_until en el pasado) no bloquea: vincula", async () => {
  const w = base({ users: [user(U1, "uno@test.local", { banned_until: "2000-01-01T00:00:00Z" }), user(COACH, "coach@test.local")] });
  assert.equal((await run(w)).code, "DRY_RUN");
  assert.equal((await run(w, OK())).code, "VINCULADA");
});
await t("ficha ajena cuyo email CONTIENE el de esta (no es duplicado): vincula bien", async () => {
  const w = base({ alumnos: [ficha(AL1, "uno@test.local"), ficha(AL2, "xuno@test.local.ar")] });
  const r = await run(w, OK()); assert.equal(r.code, "VINCULADA");
});
const FIELDS = {
  identities: [{ id: "i9", provider: "email" }],
  banned_until: "2000-02-02T00:00:00Z",
  new_email: "nuevo@test.local",
  role: "otro-rol",
  aud: "otra-aud",
  confirmed_at: "2020-05-05T00:00:00Z",
  phone: "+5400000000",
  phone_confirmed_at: "2020-05-05T00:00:00Z",
  user_metadata: { role: "admin" },
};
for (const [f, v] of Object.entries(FIELDS)) {
  await t("campo protegido '" + f + "' cambia entre lectura y escritura: CAMBIO_CONCURRENTE y no escribe", async () => {
    const w = base({ hooks: { onList: (s, call) => { if (call === 2) s.users[0][f] = v; } } });
    const r = await run(w, OK()); assert.equal(r.code, "CAMBIO_CONCURRENTE"); noWrites(w);
  });
  await t("campo protegido '" + f + "' cambia al escribir: VERIFICACION_FALLIDA y changed=true", async () => {
    const w = base({ hooks: { afterWrite: (u) => { u[f] = v; } } });
    const r = await run(w, OK()); assert.equal(r.code, "VERIFICACION_FALLIDA"); assert.equal(r.changed, true);
  });
}
await t("el email cambia al escribir: VERIFICACION_FALLIDA", async () => {
  const w = base({ hooks: { afterWrite: (u) => { u.email = "otro@test.local"; } } });
  const r = await run(w, OK()); assert.equal(r.code, "VERIFICACION_FALLIDA");
});
await t("codigos de salida del CLI: 0 ok, 1 aborto por validacion, 2 estado incierto", async () => {
  assert.equal(exitCodeFor({ ok: true, code: "VINCULADA" }), 0);
  assert.equal(exitCodeFor({ ok: true, code: "DRY_RUN" }), 0);
  for (const c of ["EMAIL_DISTINTO", "SIN_CONFIRMACION", "CUENTA_ENTRENADOR", "COACH_UID_INVALIDO"]) assert.equal(exitCodeFor({ ok: false, code: c }), 1, c);
  for (const c of ["VERIFICACION_FALLIDA", "VERIFICACION_IMPOSIBLE", "ESCRITURA_FALLIDA", "ERROR_INESPERADO"]) assert.equal(exitCodeFor({ ok: false, code: c }), 2, c);
  assert.equal(exitCodeFor(undefined), 1);
});
await t("la confirmacion incorrecta no revela el valor esperado", async () => {
  const w = base(); const r = await run(w, { apply: true, confirm: "x" });
  assert.ok(!r.message.includes(expectedConfirm(AL1, U1)));
});
await rejects("auth-id que no es UUID", "AUTH_ID_INVALIDO", () => base(), { authId: "uno@test.local" });
await rejects("alumno-id vacio", "ALUMNO_ID_INVALIDO", () => base(), { alumnoId: "  " });
await rejects("modo invalido", "MODO_INVALIDO", () => base(), { mode: "borrar" });
await rejects("listado de cuentas falla (red): aborta sin escribir", "LISTADO_ERROR", () => base({ hooks: { listFails: true } }));
await t("listado incompleto (mas de 50 paginas): aborta", async () => {
  const many = Array.from({ length: 50 * 200 + 1 }, (_, i) => user("20000000-0000-4000-8000-" + String(i).padStart(12, "0"), "m" + i + "@x.local"));
  const w = base({ users: [user(U1, "uno@test.local"), user(COACH, "coach@test.local"), ...many] });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "LISTADO_ERROR"); noWrites(w);
});

// ---- concurrencia ----
await t("cambio concurrente de email de la cuenta entre lectura y escritura: aborta sin escribir", async () => {
  const w = base({ hooks: { onList: (s, call) => { if (call === 2) s.users[0].email = "nuevo@test.local"; } } });
  const r = await run(w, OK()); assert.equal(r.ok, false); noWrites(w);
});
await t("cambio concurrente de la cuenta (updated_at / metadata) entre lectura y escritura: aborta", async () => {
  const w = base({ hooks: { onList: (s, call) => { if (call === 2) { s.users[0].updated_at = "2026-02-02T00:00:00Z"; s.users[0].app_metadata = { provider: "email", nuevo: 1 }; } } } });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "CAMBIO_CONCURRENTE"); noWrites(w);
});
await t("otra cuenta se vincula al alumno entre lectura y escritura: aborta", async () => {
  const w = base({ users: [user(U1, "uno@test.local"), user(U3, "otro@test.local"), user(COACH, "coach@test.local")], hooks: { onList: (s, call) => { if (call === 2) s.users[1].app_metadata = { alumno_id: AL1 }; } } });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "OTRA_CUENTA_VINCULADA"); noWrites(w);
});

// ---- fallos de red alrededor de la escritura ----
await t("fallo de red ANTES de escribir: informa que no quedo vinculada; la cuenta no cambia", async () => {
  const w = base({ hooks: { failBeforeWrite: true } });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "ESCRITURA_FALLIDA");
  assert.match(r.message, /no quedo vinculada/); assert.equal(r.changed, false);
  assert.equal(w.state.users[0].app_metadata.alumno_id, undefined);
});
await t("fallo de red DESPUES de escribir: lo detecta releyendo y avisa que quedo vinculada (no asume)", async () => {
  const w = base({ hooks: { failAfterWrite: true } });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "ESCRITURA_FALLIDA");
  assert.match(r.message, /quedo vinculada/); assert.equal(r.changed, true);
  assert.equal(w.state.users[0].app_metadata.alumno_id, AL1);
});
await t("no se puede releer tras escribir: estado desconocido, nunca reporta exito", async () => {
  const w = base({ hooks: { rereadFails: true } });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "VERIFICACION_IMPOSIBLE"); assert.equal(r.changed, null);
});
await t("si tras escribir cambia un campo protegido, la verificacion falla", async () => {
  const w = base({ hooks: { corruptAfterWrite: true } });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "VERIFICACION_FALLIDA");
});

// ---- rollback ----
const linked = (extra = {}) => user(U1, "uno@test.local", { app_metadata: { provider: "email", providers: ["email"], alumno_id: AL1, ...extra } });
await t("rollback valido: quita SOLO alumno_id y conserva el resto; no toca email/confirmacion/user_metadata", async () => {
  const w = base({ users: [linked(), user(COACH, "coach@test.local")] });
  const r = await run(w, { mode: "rollback", ...OK() });
  assert.equal(r.ok, true); assert.equal(r.code, "DESHECHA"); assert.equal(w.state.writes.length, 1);
  assert.deepEqual(w.state.users[0].app_metadata, { provider: "email", providers: ["email"] });
  assert.equal(w.state.users[0].email, "uno@test.local");
});
await t("rollback en dry-run no escribe", async () => {
  const w = base({ users: [linked(), user(COACH, "coach@test.local")] });
  const r = await run(w, { mode: "rollback" }); assert.equal(r.code, "DRY_RUN"); noWrites(w);
});
await t("rollback exige confirmacion", async () => {
  const w = base({ users: [linked(), user(COACH, "coach@test.local")] });
  const r = await run(w, { mode: "rollback", apply: true, confirm: "x" }); assert.equal(r.code, "SIN_CONFIRMACION"); noWrites(w);
});
await t("rollback verifica el estado previo: cuenta sin vinculo => nada que deshacer", async () => {
  const w = base(); const r = await run(w, { mode: "rollback", ...OK() }); assert.equal(r.code, "NO_VINCULADA"); noWrites(w);
});
await t("rollback no deshace el vinculo de OTRO alumno", async () => {
  const w = base({ users: [user(U1, "uno@test.local", { app_metadata: { alumno_id: AL2 } }), user(COACH, "coach@test.local")] });
  const r = await run(w, { mode: "rollback", ...OK() }); assert.equal(r.code, "NO_VINCULADA"); noWrites(w);
});

// ---- el CLI no permite modos masivos ni se ejecuta contra produccion en pruebas ----
await t("el nucleo no expone operaciones masivas: una cuenta por llamada (un solo updateUserById)", async () => {
  const w = base(); await run(w, OK()); assert.equal(w.state.writes.length, 1);
});


// ---- escenarios adicionales (QA2) ----
await t("[N1] email con mayusculas/espacios en ficha y cuenta: vincula", async () => {
  const w = base({ alumnos: [ficha(AL1, "  Uno@Test.Local ")], users: [user(U1, "UNO@test.local"), user(COACH, "coach@test.local")] });
  const r = await run(w, OK()); assert.equal(r.code, "VINCULADA"); assert.equal(w.state.users[0].app_metadata.alumno_id, AL1);
});
await t("[N2] ficha sin email (null / vacio / espacios): rechaza sin escribir", async () => {
  for (const e of [null, undefined, "", "   "]) {
    const w = base({ alumnos: [ficha(AL1, e)] }); const r = await run(w, OK());
    assert.equal(r.code, "FICHA_SIN_EMAIL"); noWrites(w);
  }
});
await t("[N3] cuenta con app_metadata null o ausente: vincula y crea app_metadata", async () => {
  for (const am of [null, undefined]) {
    const u = user(U1, "uno@test.local"); if (am === undefined) delete u.app_metadata; else u.app_metadata = null;
    const w = base({ users: [u, user(COACH, "coach@test.local")] });
    const r = await run(w, OK()); assert.equal(r.code, "VINCULADA", String(am)); assert.deepEqual(w.state.users[0].app_metadata, { alumno_id: AL1 });
  }
});
await t("[N4] alumno_id numerico en la cuenta vs id string de la ficha: se trata como el mismo alumno", async () => {
  const w = base({ alumnos: [ficha("5", "uno@test.local")], users: [user(U1, "uno@test.local", { app_metadata: { alumno_id: 5 } }), user(COACH, "coach@test.local")] });
  const r = await run(w, { alumnoId: "5", ...OK("5", U1) }); assert.equal(r.code, "YA_VINCULADA"); noWrites(w);
  const w2 = base({ alumnos: [ficha("5", "uno@test.local")], users: [user(U1, "uno@test.local"), user(U3, "otro@test.local", { app_metadata: { alumno_id: 5 } }), user(COACH, "coach@test.local")] });
  const r2 = await run(w2, { alumnoId: "5", ...OK("5", U1) }); assert.equal(r2.code, "OTRA_CUENTA_VINCULADA"); noWrites(w2);
  const w3 = base({ alumnos: [ficha("5", "uno@test.local")], users: [user(U1, "uno@test.local", { app_metadata: { alumno_id: 6 } }), user(COACH, "coach@test.local")] });
  const r3 = await run(w3, { alumnoId: "5", ...OK("5", U1) }); assert.equal(r3.code, "CUENTA_DE_OTRO_ALUMNO"); noWrites(w3);
});
await t("[N5] id de ficha no-UUID (legacy) vinculado correctamente y rollback", async () => {
  const w = base({ alumnos: [ficha("legacy-42", "uno@test.local")] });
  const r = await run(w, { alumnoId: "legacy-42", ...OK("legacy-42", U1) });
  assert.equal(r.code, "VINCULADA"); assert.equal(w.state.users[0].app_metadata.alumno_id, "legacy-42");
  const r2 = await run(w, { alumnoId: "legacy-42", mode: "rollback", ...OK("legacy-42", U1) });
  assert.equal(r2.code, "DESHECHA"); assert.equal(w.state.users[0].app_metadata.alumno_id, undefined);
});
await t("[N6] listado paginado (>200 cuentas): cuenta objetivo en la 2a pagina => vincula", async () => {
  const many = Array.from({ length: 250 }, (_, i) => user("20000000-0000-4000-8000-" + String(i).padStart(12, "0"), "m" + i + "@x.local"));
  const w = base({ users: [...many, user(U1, "uno@test.local"), user(COACH, "coach@test.local")] });
  const r = await run(w, OK()); assert.equal(r.code, "VINCULADA"); assert.ok(w.state.listCalls >= 2);
});
await t("[N7] paginado: otra cuenta vinculada y email duplicado en pagina distinta se detectan", async () => {
  const many = Array.from({ length: 200 }, (_, i) => user("20000000-0000-4000-8000-" + String(i).padStart(12, "0"), "m" + i + "@x.local"));
  const w = base({ users: [user(U1, "uno@test.local"), ...many, user(U3, "otro@test.local", { app_metadata: { alumno_id: AL1 } }), user(COACH, "coach@test.local")] });
  const r = await run(w, OK()); assert.equal(r.code, "OTRA_CUENTA_VINCULADA"); noWrites(w);
  const w2 = base({ users: [user(U1, "uno@test.local"), ...many, user(U3, "UNO@test.local"), user(COACH, "coach@test.local")] });
  const r2 = await run(w2, OK()); assert.equal(r2.code, "EMAIL_DUPLICADO_AUTH"); noWrites(w2);
});
await t("[N8] error de la API en getUserById tras escritura fallida: estado desconocido, no exito", async () => {
  const w = base({ hooks: { rereadFails: true, failBeforeWrite: true } });
  const r = await run(w, OK()); assert.equal(r.ok, false); assert.equal(r.code, "VERIFICACION_IMPOSIBLE"); assert.equal(r.changed, null); assert.match(r.message, /escritura fallo/);
});
await t("[N9] si la API reemplaza app_metadata (no fusiona), la verificacion lo detecta (no reporta exito)", async () => {
  const w = base({ users: [user(U1, "uno@test.local", { app_metadata: { provider: "email", otra: 1 } }), user(COACH, "coach@test.local")], hooks: { replaceMeta: true } });
  const r = await run(w, OK());
  // el payload enviado ya conserva todas las claves, asi que debe quedar bien incluso con semantica de reemplazo
  assert.equal(r.code, "VINCULADA"); assert.deepEqual(w.state.users[0].app_metadata, { provider: "email", otra: 1, alumno_id: AL1 });
  assert.deepEqual(w.state.writes[0].attrs.app_metadata, { provider: "email", otra: 1, alumno_id: AL1 });
});
await t("[N10] cambio concurrente SOLO en updated_at: aborta", async () => {
  const w = base({ hooks: { onList: (s, call) => { if (call === 2) s.users[0].updated_at = "2026-03-03T00:00:00Z"; } } });
  const r = await run(w, OK()); assert.equal(r.code, "CAMBIO_CONCURRENTE"); noWrites(w);
});
await t("[N11] rollback: el payload envia alumno_id:null y conserva el resto de claves", async () => {
  const w = base({ users: [linked({ otra: 2 }), user(COACH, "coach@test.local")] });
  const r = await run(w, { mode: "rollback", ...OK() }); assert.equal(r.code, "DESHECHA");
  assert.deepEqual(w.state.writes[0].attrs.app_metadata, { provider: "email", providers: ["email"], otra: 2, alumno_id: null });
});
await t("[N12] ningun resultado/log contiene emails en rutas de error y exito", async () => {
  for (const [w, o] of [[base(), OK()], [base({ hooks: { failAfterWrite: true } }), OK()], [base(), { authId: U2, ...OK(AL1, U2) }]]) noPII(await run(w, o));
});

console.log(n + " tests ok" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
