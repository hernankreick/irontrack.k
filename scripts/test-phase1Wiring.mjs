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
  // El token anonimo solo lo entrega el resolutor de lib/restAuth.js (decideRestAuth); la sesion Auth tambien pasa por el
  // (con un logout pendiente getActiveSession devuelve null aunque el SDK conserve el token residual)
  assert.ok(/const restAuthResolver = createRestAuthResolver\(\{/.test(app) && /anonKey: SB_KEY/.test(app));
  assert.ok(/const getActiveSupabaseSession = restAuthResolver\.getActiveSession;/.test(app));
  assert.ok(/const resolveRestToken = restAuthResolver\.resolve;/.test(app));
  assert.ok(!/supabase\.auth\.getSession\(\)/.test(app.slice(app.indexOf("const sbFetch"), app.indexOf("const sb = {"))), "sbFetch no lee la sesion por otra via");
  // sbFetch no envia y devuelve null (contrato previo: null en HTTP no-ok), deleteAlumno lanza AuthRequiredError
  assert.ok(/sin fallback anonimo/.test(app) && /throw new AuthRequiredError\(restAuth\.reason\)/.test(app));
  // No hay otras llamadas fetch directas a /rest/v1 con credenciales propias
  const directRest = (app.match(/fetch\(SB_URL\s*\+\s*"\/rest\/v1\//g) || []).length;
  assert.equal(directRest, 3, "sbFetch + deleteAlumno + marcarMensajesLeidos");
});

await test("cableado: con un logout pendiente el arranque no adopta, lee ni escribe con la sesion Auth residual", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(/if \(!session \|\| !session\.user \|\| isLogoutPending\(\)\) \{\s*setSupabaseSessionUserId\(null\);/.test(app), "getSession de montaje");
  assert.ok(/if \(session && session\.user && !isLogoutPending\(\)\) \{\s*setSupabaseSessionUserId/.test(app), "onAuthStateChange");
  assert.ok(/if \(isLogoutPending\(\)\) return;\s*var sessionRes = await supabase\.auth\.getSession\(\);/.test(app), "lectura de entrenadores");
  assert.ok(/shouldSkipEntrenadorUpsert\(localStorage, studentAuthFlowRef\.current\)/.test(app));
});


await test("cableado en App.jsx: el unico vaciado de la cola antigua es la barrera, y las series se estampan con el alumno al encolar", async () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  assert.ok(/flushLegacyPendingQueue\(\{ alumnoId: alumnoIdSync, send: function \(payload\) \{ return sb\.addProgreso\(payload\); \} \}\)/.test(app));
  assert.ok(!/Promise\.allSettled\(pending\.map/.test(app), "no queda el vaciado antiguo que usaba el alumno de la sesion para todo el array");
  assert.ok(/buildPendingProgressItem\(exId, kg, reps, note, d, weekForSet, alumnoIdSync\)/.test(app));
  assert.equal((app.match(/sb\.addProgreso\(/g) || []).length, 2, "logSet online y el vaciado: no hay otro emisor de series");
});


console.log("\n" + count + " tests ok");
