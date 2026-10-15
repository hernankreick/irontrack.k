// Verifica los controles anti-produccion (sin red).   node qa/test-guard.mjs
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isSafeLocalUrl, assertLocalSupabaseUrl, assertLocalDb, isAllowedBrowserHost, PROD_PROJECT_REF } from "./guard.mjs";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const here = new URL(".", import.meta.url).pathname;

t("loopback permitido; produccion y Supabase hospedado rechazados", () => {
  assert.ok(isSafeLocalUrl("http://127.0.0.1:54321") && isSafeLocalUrl("http://localhost:54321"));
  for (const u of [`https://${PROD_PROJECT_REF}.supabase.co`, "https://otro.supabase.co", "https://example.com", "http://10.0.0.5:54321", "not a url", "", undefined,
                   `http://127.0.0.1:54321/?x=${PROD_PROJECT_REF}`, "http://127.0.0.1.evil.com", "http://localhost.supabase.co"]) {
    assert.equal(isSafeLocalUrl(u), false, String(u));
    assert.throws(() => assertLocalSupabaseUrl(u), /QA GUARD/);
  }
});
t("solo se acepta la base local irontrack_qa en 54322", () => {
  assertLocalDb("127.0.0.1", 54322, "irontrack_qa");
  assertLocalDb("127.0.0.1", 54322, "postgres"); // base por defecto de `supabase start`
  for (const a of [["db.x.supabase.co", 5432, "postgres"], ["db.x.supabase.co", 54322, "postgres"], ["127.0.0.1", 5432, "postgres"], ["127.0.0.1", 54322, "produccion"], ["10.1.1.1", 54322, "irontrack_qa"]])
    assert.throws(() => assertLocalDb(...a), /QA GUARD/);
});
t("el navegador solo puede hablar con loopback", () => {
  assert.ok(isAllowedBrowserHost("127.0.0.1") && isAllowedBrowserHost("localhost"));
  assert.ok(!isAllowedBrowserHost("ilcdexckizxtcxopfxlq.supabase.co") && !isAllowedBrowserHost("fonts.googleapis.com"));
});
t("los e2e abortan ANTES de conectar si la URL apunta a produccion", () => {
  for (const script of ["e2e-api.mjs", "e2e-ui.mjs"]) {
    const r = spawnSync(process.execPath, [here + script], { env: { ...process.env, QA_SUPABASE_URL: `https://${PROD_PROJECT_REF}.supabase.co` }, encoding: "utf8", timeout: 20000 });
    assert.notEqual(r.status, 0, script);
    assert.match(r.stderr + r.stdout, /QA GUARD/, script);
  }
});
t("stack.sh aborta si el entorno apunta a produccion", () => {
  const r = spawnSync("bash", [here + "stack.sh", "status"], { env: { ...process.env, VITE_SUPABASE_URL: `https://${PROD_PROJECT_REF}.supabase.co` }, encoding: "utf8" });
  assert.equal(r.status, 2); assert.match(r.stderr, /QA GUARD/);
});
console.log(n + " tests ok");
