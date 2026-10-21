// Pruebas del CLI scripts/admin/link-alumno.mjs: solo las validaciones que abortan ANTES de cualquier acceso a la red.
// Ningun caso llega a crear el cliente ni a conectarse. Datos ficticios.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const CLI = new URL("./admin/link-alumno.mjs", import.meta.url).pathname;
const REF = "abcdefghij0123456789"; // 20 caracteres, ficticio
const GOOD_URL = "https://" + REF + ".supabase.co";
const A = ["--alumno-id", "a1", "--auth-id", "1a000000-0000-4000-8000-000000000001"];

let n = 0, failed = 0;
const t = (name, fn) => { try { fn(); n++; console.log("ok -", name); } catch (e) { failed++; console.log("FAIL -", name); console.log("  " + String((e && e.message) || e).split("\n")[0]); } };
const cli = (args, env = {}) => spawnSync(process.execPath, [CLI, ...args], {
  env: { PATH: process.env.PATH, ...env }, encoding: "utf8", timeout: 15000,
});
const ENV_OK = { SUPABASE_URL: GOOD_URL, SUPABASE_SERVICE_ROLE_KEY: "dummy-key-not-real", COACH_UIDS: "00000000-0000-4000-8000-0000000000c1" };
const aborts = (r, re) => { assert.equal(r.status, 1, "status=" + r.status + " " + r.stderr); assert.match(r.stderr, re); };
const noLeak = (r) => { const all = r.stdout + r.stderr; assert.ok(!all.includes("dummy-key-not-real"), "no debe imprimir la clave"); };

t("opcion desconocida (--all / --batch): aborta, sin modo masivo", () => {
  for (const f of ["--all", "--batch", "--todos"]) { const r = cli([...A, "--project-ref", REF, f], ENV_OK); aborts(r, /desconocida|masivo/); noLeak(r); }
});
t("argumento posicional sobrante: aborta", () => aborts(cli([...A, "extra"], ENV_OK), /sobrante/));
t("valor faltante o que empieza con --: aborta", () => {
  aborts(cli(["--alumno-id", "--apply", "--auth-id", "x"], ENV_OK), /falta el valor/);
  aborts(cli(["--alumno-id"], ENV_OK), /falta el valor/);
  aborts(cli([...A, "--confirm"], ENV_OK), /falta el valor/);
});
t("opcion repetida: aborta", () => {
  aborts(cli([...A, "--alumno-id", "a2"], ENV_OK), /repetida/);
  aborts(cli([...A, "--apply", "--apply"], ENV_OK), /repetida/);
});
t("sin variables de entorno: aborta", () => { const r = cli([...A], {}); aborts(r, /faltan/); noLeak(r); });
t("host que no es <ref>.supabase.co: aborta antes de usar la clave", () => {
  for (const u of ["https://evil.example.com", "http://" + REF + ".supabase.co", "https://" + REF + ".supabase.co.evil.com", "https://user:pw@" + REF + ".supabase.co", "https://" + REF + ".supabase.co:8443", "https://short.supabase.co", "no-es-url"]) {
    const r = cli([...A, "--project-ref", REF], { ...ENV_OK, SUPABASE_URL: u }); aborts(r, /SUPABASE_URL debe ser/); noLeak(r);
  }
});
t("sin --project-ref o con uno distinto: aborta y muestra el proyecto destino", () => {
  let r = cli([...A], ENV_OK); aborts(r, /project-ref/); assert.match(r.stdout, new RegExp(REF)); noLeak(r);
  r = cli([...A, "--project-ref", "zzzzzzzzzzzzzzzzzzzz"], ENV_OK); aborts(r, /project-ref/); noLeak(r);
});
t("el codigo del CLI no imprime la clave ni la URL completa", () => {
  const src = readFileSync(CLI, "utf8");
  assert.ok(!/console\.(log|error)\([^)]*\bkey\b/.test(src));
  assert.ok(!/console\.(log|error)\([^)]*\burl\b/.test(src));
});

console.log(n + " tests ok" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
