// Pruebas de lib/restAuth.js y del cableado en App.jsx (S0.6 Fase 1): sin fallback anonimo para operaciones privadas.
//
//   node scripts/test-restAuth.mjs

import assert from "node:assert/strict";
import { decideRestAuth, isSharedLinkLocation, AuthRequiredError, ANON_BOOT_READ_TABLES } from "../lib/restAuth.js";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

const SESSION = { access_token: "user-token" };
const base = { session: null, method: "GET", path: "progreso?alumno_id=eq.1", sharedLink: false, logoutPending: false };

await test("con sesion Auth siempre se usa el token del usuario (lectura y escritura)", () => {
  for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
    assert.deepEqual(decideRestAuth({ ...base, session: SESSION, method }), { ok: true, kind: "user" });
  }
});

await test("SIN sesion: ninguna operacion privada de alumno cae a la anon key (lecturas ni escrituras)", () => {
  const privatePaths = [
    "progreso?alumno_id=eq.1&select=*", "progreso", "sesiones?alumno_id=eq.1", "mensajes?alumno_id=eq.1", "fotos?alumno_id=eq.1",
    "notas?alumno_id=eq.1", "alumnos?id=eq.1&select=ultimo_pago_confirmado", "alumnos?id=eq.1", "entrenadores?id=eq.x", "rutinas?alumno_id=eq.1",
  ];
  for (const path of privatePaths) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const d = decideRestAuth({ ...base, path, method });
      assert.equal(d.ok, false, method + " " + path);
      assert.equal(d.reason, "no_auth_session");
    }
  }
});

await test("accesos anonimos legitimos y justificados: lecturas de arranque (solo GET) y enlace compartido (solo lectura)", () => {
  assert.deepEqual(ANON_BOOT_READ_TABLES.slice().sort(), ["config", "ejercicio_overrides", "video_overrides"]);
  for (const path of ["config?id=eq.pagos&select=*", "video_overrides?entrenador_id=eq.entrenador_principal&select=ejercicio_id,youtube_url", "ejercicio_overrides?entrenador_id=eq.x&select=*"]) {
    assert.deepEqual(decideRestAuth({ ...base, path }), { ok: true, kind: "anon" }, path);
    // pero nunca escribir
    for (const method of ["POST", "PATCH", "DELETE"]) assert.equal(decideRestAuth({ ...base, path, method }).ok, false, method + " " + path);
  }
  // enlace compartido: lee lo que el enlace muestra, no escribe
  assert.deepEqual(decideRestAuth({ ...base, sharedLink: true, path: "sesiones?alumno_id=eq.1" }), { ok: true, kind: "anon" });
  assert.deepEqual(decideRestAuth({ ...base, sharedLink: true, method: "HEAD", path: "progreso" }), { ok: true, kind: "anon" });
  for (const method of ["POST", "PATCH", "DELETE", "PUT"]) assert.equal(decideRestAuth({ ...base, sharedLink: true, method }).ok, false);
});

await test("una tabla parecida no se cuela: el nombre debe coincidir exacto", () => {
  for (const path of ["config_secreta?x=1", "configx", "video_overrides_admin", "/progreso?x=config", "alumnos?select=config"]) {
    assert.equal(decideRestAuth({ ...base, path }).ok, false, path);
  }
  assert.equal(decideRestAuth({ ...base, path: "/config?id=eq.pagos" }).ok, true);
});

await test("logout pendiente: ni siquiera el token residual del SDK ni el acceso anonimo de arranque/compartido", () => {
  for (const extra of [{ session: SESSION }, { path: "config?id=eq.pagos" }, { sharedLink: true }]) {
    assert.deepEqual(decideRestAuth({ ...base, ...extra, logoutPending: true }), { ok: false, reason: "logout_pending" });
  }
});

await test("isSharedLinkLocation y AuthRequiredError", () => {
  assert.equal(isSharedLinkLocation("?r=abc"), true);
  assert.equal(isSharedLinkLocation("?foo=1"), false);
  assert.equal(isSharedLinkLocation(""), false);
  const e = new AuthRequiredError("no_auth_session");
  assert.equal(e.code, "auth_required");
  assert.ok(e instanceof Error);
});

console.log("\n" + count + " tests ok");
