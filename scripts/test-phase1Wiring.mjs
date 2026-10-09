// Revision estatica del cableado de la Fase 1 en App.jsx y SettingsPage.jsx (S0.6): logout central, logout pendiente, REST sin
// fallback anonimo.
//
//   node scripts/test-phase1Wiring.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok - " + name); }

await test("cableado: todos los puntos de logout usan el logout central; Settings no borra it_* a mano ni llama a signOut directo", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../components/settings/SettingsPage.jsx", import.meta.url), "utf8");
  // App.jsx: ningun logout invoca clearAll...() fuera del helper central (que lo pasa como clearLocal) y del handler SIGNED_OUT
  const calls = app.split("\n").filter((l) => /clearAllIronTrackPrefixedKeys\(\)/.test(l));
  assert.equal(calls.length, 1, "solo el handler de SIGNED_OUT (invalidacion forzada) llama a clearAll directamente: " + calls.join("|"));
  assert.ok(/clearLocal: clearAllIronTrackPrefixedKeys/.test(app));
  assert.equal((app.match(/performAppLogout\(\)/g) || []).length >= 4, true, "confirmCoachDialog, handleCoachLogout, onLogout, onCoachLogout");
  assert.ok(/confirmCoachDialog|c\.t === 'logout' \|\| c\.t === 'logoutSettings'/.test(app));
  assert.ok(/performLogout\(/.test(settings));
  assert.ok(!/localStorage\.removeItem\(k\)/.test(settings) && !/supabase\.auth\.signOut\(/.test(settings));
  // Arranque: se aplica el logout pendiente antes de cualquier estado inicial; la restauracion y la biometria lo respetan
  assert.ok(/enforceLogoutPending\(localStorage\)/.test(app));
  assert.ok(/isLogoutPending\(localStorage\)/.test(app));
  // Login nuevo: completa el logout pendiente primero y reemplaza el marcador al entrar
  assert.equal((app.match(/clearLogoutPending\(localStorage\)/g) || []).length, 2, "login de entrenador y de alumno");
  // Eventos: SIGNED_OUT de un alumno, storage entre pestanas, online/focus/visibilitychange
  assert.ok(/event === 'SIGNED_OUT'/.test(app) && /storedAtSignOut\.role === 'alumno'/.test(app) && /memAtSignOut\.role === 'alumno'/.test(app));
  assert.ok(/addEventListener\('storage', onStorage\)/.test(app));
  assert.ok(/if \(e\.key !== 'it_session'\) return;/.test(app) && /if \(!next\) return;/.test(app), "quitar it_session en otra pestana no cierra esta");
  assert.ok(/addEventListener\('online', tryCompleteLogout\)/.test(app) && /addEventListener\('visibilitychange', onVisible\)/.test(app));
});

await test("cableado en App.jsx: ninguna llamada REST propia cae a SB_KEY como Bearer sin pasar por resolveRestToken", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  // El unico lugar que puede producir el token anonimo es resolveRestToken (decideRestAuth)
  const bearerFallbacks = app.split("\n").filter((l) => /access_token\s*\?[^:]*:\s*SB_KEY/.test(l));
  assert.deepEqual(bearerFallbacks, [], "queda un fallback silencioso a SB_KEY: " + bearerFallbacks.join(" | "));
  assert.equal((app.match(/await resolveRestToken\(/g) || []).length, 3, "sbFetch, deleteAlumno, marcarMensajesLeidos");
  assert.ok(/token: decision\.kind === "user" \? activeSession\.access_token : SB_KEY/.test(app));
  // getActiveSupabaseSession no entrega la sesion residual con un logout pendiente
  assert.ok(/if \(isLogoutPending\(\)\) return null;/.test(app));
  // sbFetch no envia y devuelve null (contrato previo: null en HTTP no-ok), deleteAlumno lanza AuthRequiredError
  assert.ok(/sin fallback anonimo/.test(app) && /throw new AuthRequiredError\(restAuth\.reason\)/.test(app));
  // No hay otras llamadas fetch directas a /rest/v1 con credenciales propias
  const directRest = (app.match(/fetch\(SB_URL\s*\+\s*"\/rest\/v1\//g) || []).length;
  assert.equal(directRest, 3, "sbFetch + deleteAlumno + marcarMensajesLeidos");
});

console.log("\n" + count + " tests ok");
