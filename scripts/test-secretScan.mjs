// S-1 · Escaner de secretos (scripts/security/secret-scan.mjs): detecta casos FICTICIOS, no da falsos positivos con claves
// publicas legitimas, nunca imprime valores y el arbol versionado del repo esta limpio.
//   node scripts/test-secretScan.mjs
// Todos los "secretos" se generan aca en tiempo de ejecucion (por partes): el repo no contiene literales con forma de secreto.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCAN = path.join(ROOT, "scripts/security/secret-scan.mjs");
const S = await import(pathToFileURL(SCAN).href);
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- generadores de datos ficticios
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fakeJwt = (role) => [b64u({ alg: "HS256", typ: "JWT" }), b64u({ iss: "supabase", ref: "ficticioref000000000", role, iat: 1, exp: 2 }), "ZmFrZXNpZ25hdHVyZWZpY3RpY2lh"].join(".");
const rnd = (n, al = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") => Array.from({ length: n }, (_, i) => al[(i * 7 + 3) % al.length]).join("");
const FAKE = {
  serviceRole: fakeJwt("service_role"),
  anon: fakeJwt("anon"),
  sbSecret: "sb_" + "secret_" + rnd(32),
  sbPublishable: "sb_" + "publishable_" + rnd(32),
  ghToken: "gh" + "p_" + rnd(36),
  ghPat: "github_" + "pat_" + rnd(70, "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_"),
  stripe: "sk_" + "live_" + rnd(24),
  aws: "AK" + "IA" + rnd(16, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"),
  pkHeader: "-----BEGIN " + "RSA PRIVATE KEY-----",
  pgPass: "Fict" + "icia" + "Pass" + "9876",
  sbp: "sb" + "p_" + rnd(40, "0123456789abcdef"),
  oneSignal: "os_v2" + "_app_" + rnd(100, "abcdefghijklmnopqrstuvwxyz234567"),
  codePass: "Cl4ve" + "Fict" + "icia",
};
const rules = (p, t) => S.scanText(p, t).map((f) => f.rule);

await test("rutas: .env y variantes, perfiles de navegador, llaves y .vercel se detectan; plantillas no", () => {
  for (const p of [".env", ".env.local", ".env.production", "config/prod.env", "app/.env.staging"]) assert.equal(S.classifyPath(p)?.rule, "env-file", p);
  for (const p of [".env.example", ".env.sample", ".env.template", "x/.env.example"]) assert.equal(S.classifyPath(p), null, p);
  for (const p of [".chrome-headless/Default/Cookies", ".chrome-scroll-test/Variations", ".playwright-perfil/x", "perfil/Default/Login Data"]) assert.equal(S.classifyPath(p)?.rule, "browser-profile", p);
  for (const p of ["certs/server.pem", "deploy.key", "id_rsa", "a/b/cert.p12"]) assert.equal(S.classifyPath(p)?.rule, "key-file", p);
  for (const p of [".envrc", "worker/.dev.vars", ".env.dist"]) assert.equal(S.classifyPath(p)?.rule, "env-file", p);
  for (const p of ["qa/crash.dmp", "tmp/Crashpad/settings.dat"]) assert.equal(S.classifyPath(p)?.rule, "memory-dump", p);
  assert.equal(S.classifyPath(".vercel/project.json")?.rule, "vercel-local");
  for (const p of ["lib/appThemeTokens.js", "lib/onboardingTokens.js", "components/History.jsx", "docs/keyboard.md", "src/Cookies.jsx"]) assert.equal(S.classifyPath(p), null, p);
});

await test("contenido: service_role, sb_secret_, GitHub, Stripe, AWS, llave privada y postgres con contrasena se detectan", () => {
  assert.deepEqual(rules("a.js", "const k = '" + FAKE.serviceRole + "'"), ["supabase-service-role"]);
  assert.deepEqual(rules("a.js", "x=" + FAKE.sbSecret), ["supabase-secret-key"]);
  assert.deepEqual(rules("a.md", FAKE.ghToken), ["github-token"]);
  assert.deepEqual(rules("a.md", FAKE.ghPat), ["github-token"]);
  assert.deepEqual(rules("a.md", FAKE.stripe), ["stripe-live"]);
  assert.deepEqual(rules("a.md", FAKE.aws), ["aws-access-key"]);
  assert.deepEqual(rules("a.md", "token=" + FAKE.sbp), ["supabase-access-token"]);
  assert.deepEqual(rules("hooks/x.js", "const ONESIGNAL_KEY = '" + FAKE.oneSignal + "';"), ["onesignal-rest-key"]);
  assert.deepEqual(rules("k.txt", FAKE.pkHeader), ["private-key"]);
  assert.deepEqual(rules("a.sh", "DB=postgres://user:" + FAKE.pgPass + "@db.local:5432/x"), ["postgres-password"]);
  assert.ok(S.scanText("a.js", FAKE.serviceRole).every((f) => f.level === "CRITICO"));
});

await test("asignaciones sensibles en archivos de configuracion: literal = hallazgo; referencias y marcadores = no", () => {
  assert.deepEqual(rules("deploy.sh", "SUPABASE_SERVICE_ROLE_KEY=" + rnd(40)), ["sensitive-assignment"]);
  assert.deepEqual(rules("cfg.yml", "  jwt_secret: " + rnd(40)), ["sensitive-assignment"]);
  for (const v of ['"$JWT_SECRET"', "${JWT_SECRET}", "$(openssl rand -hex 32)", "${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}", "<tu-secreto>", "tu-service-role-de-ejemplo", "changeme", "xxxxxxxxxxxx", "ficticio-123456"]) {
    assert.deepEqual(rules("stack.sh", "GOTRUE_JWT_SECRET=" + v), [], v);
  }
  // En codigo JS no se evaluan asignaciones genericas (password: form.password, etc.).
  assert.deepEqual(rules("App.jsx", "const PASSWORD = 'abc' + algo; password: form.password"), []);
});

await test("contrasena literal en codigo de la app: se detecta; en pruebas/QA, campos de formulario y variables, no", () => {
  assert.deepEqual(rules("App.jsx", "if (loginPass === '" + FAKE.codePass + "') {"), ["code-password"]);
  assert.deepEqual(rules("lib/auth.js", "signInWithPassword({ email, password: \"" + FAKE.codePass + "\" })"), ["code-password"]);
  assert.deepEqual(rules("App.jsx", '<input type="password" autoComplete="current-password" />'), []);
  assert.deepEqual(rules("App.jsx", "signInWithPassword({ email, password: loginPass })"), []);
  assert.deepEqual(rules("App.jsx", "const label = 'Contrasena'; password: ''"), []);
  assert.deepEqual(rules("scripts/test-auth.mjs", "password: '" + FAKE.codePass + "'"), [], "backend ficticio de pruebas");
  assert.deepEqual(rules("qa/e2e-api.mjs", "password: '" + FAKE.codePass + "'"), []);
});

await test("SIN falsos positivos: clave anon (JWT rol anon) y sb_publishable_ en codigo del frontend son publicas", () => {
  assert.deepEqual(rules("lib/supabaseClient.js", "const anon = '" + FAKE.anon + "'"), []);
  assert.deepEqual(rules("lib/x.js", "const k = '" + FAKE.sbPublishable + "'"), []);
  assert.deepEqual(rules(".github/workflows/ci.yml", "      VITE_SUPABASE_ANON_KEY: ci-dummy-anon-key"), []);
  assert.deepEqual(rules("x.yml", "VITE_SUPABASE_ANON_KEY: " + FAKE.anon), []);
  const env = S.describeEnvFile("VITE_SUPABASE_URL=https://ficticioref000000000.supabase.co\nVITE_SUPABASE_ANON_KEY=" + FAKE.sbPublishable + "\nOTRA=" + FAKE.anon);
  assert.deepEqual(env.map((v) => [v.name, v.secret]), [["VITE_SUPABASE_URL", false], ["VITE_SUPABASE_ANON_KEY", false], ["OTRA", false]]);
  const env2 = S.describeEnvFile("SUPABASE_SERVICE_ROLE_KEY=" + FAKE.serviceRole + "\nSB=" + FAKE.sbSecret);
  assert.deepEqual(env2.map((v) => [v.name, v.secret, v.level]), [["SUPABASE_SERVICE_ROLE_KEY", true, "CRITICO"], ["SB", true, "CRITICO"]]);
});

await test("excepcion 'secret-scan: allow': solo en su linea, solo en pruebas/fixtures y NUNCA para CRITICOS", () => {
  const mark = " // secret-scan: allow (dato ficticio)";
  assert.deepEqual(rules("scripts/test-x.mjs", "const k = '" + FAKE.aws + "'" + mark), []);
  assert.deepEqual(rules("qa/fixtures/a.js", "const k = '" + FAKE.aws + "'" + mark), []);
  assert.deepEqual(rules("lib/x.js", "const k = '" + FAKE.aws + "'" + mark), ["aws-access-key"], "fuera de pruebas no vale");
  assert.deepEqual(rules("scripts/test-x.mjs", "const k = '" + FAKE.ghToken + "'" + mark), ["github-token"], "un CRITICO no se puede silenciar");
  assert.deepEqual(rules("scripts/test-x.mjs", "const k = '" + FAKE.serviceRole + "'" + mark), ["supabase-service-role"]);
  assert.deepEqual(rules("scripts/test-x.mjs", "// secret-scan: allow\nconst k = '" + FAKE.aws + "'"), ["aws-access-key"], "solo vale para su propia linea");
});

await test("nunca imprime un secreto aunque este en la posicion del NOMBRE de la variable", () => {
  const f = S.scanText("deploy.sh", FAKE.sbSecret + "_TOKEN=" + rnd(30));
  assert.ok(f.every((x) => !String(x.name || "").includes(FAKE.sbSecret)));
  const v = S.describeEnvFile(FAKE.ghToken + "=" + rnd(20) + "\nA" + rnd(50, "ABCDEFGHIJ") + "=x");
  assert.ok(v.every((x) => !x.name.includes(FAKE.ghToken) && x.name.length <= 45), JSON.stringify(v.map((x) => x.name.length)));
  assert.equal(S.safeName("VITE_SUPABASE_URL"), "VITE_SUPABASE_URL");
});

await test("binarios y archivos grandes: los tokens se detectan igual (latin1 y utf16le); un binario limpio no da hallazgos", () => {
  const bin = (txt, enc = "latin1") => Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from("padding " + txt + " fin", enc), Buffer.from([0, 0])]);
  assert.deepEqual(S.scanFile("perfil/Local Storage/000003.log", bin(FAKE.serviceRole)).findings.map((f) => f.rule), ["supabase-service-role"]);
  assert.deepEqual(S.scanFile("x.bin", bin(FAKE.ghToken, "utf16le")).findings.map((f) => f.rule), ["github-token"]);
  assert.deepEqual(S.scanFile("x.bin", bin(FAKE.anon)).findings, [], "la clave anon publica no es hallazgo");
  assert.deepEqual(S.scanFile("x.bin", bin("nada secreto")).findings, []);
  const big = Buffer.from("x".repeat(1024 * 1024 + 10) + "\n" + FAKE.sbSecret + "\n");
  assert.deepEqual(S.scanFile("dist/assets/app.js", big).findings.map((f) => f.rule), ["supabase-secret-key"], "texto > 1 MB y dist/ tambien se revisan");
});

await test("CLI en un repo temporal: detecta, sale con 1, NUNCA imprime valores y --staged solo mira el indice", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "it-secretscan-"));
  try {
    const g = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "pipe" });
    g("init", "-q"); g("config", "user.email", "qa@example.invalid"); g("config", "user.name", "QA ficticio");
    writeFileSync(path.join(dir, "ok.js"), "export const x = 1;\n");
    g("add", "."); g("commit", "-q", "-m", "inicial");
    mkdirSync(path.join(dir, "cfg"));
    writeFileSync(path.join(dir, "cfg", "deploy.sh"), "export SUPABASE_SERVICE_ROLE_KEY=" + FAKE.serviceRole + "\nTOKEN_GH=" + FAKE.ghToken + "\n");
    writeFileSync(path.join(dir, ".env"), "VITE_SUPABASE_URL=https://ficticioref000000000.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=" + FAKE.serviceRole + "\n");
    g("add", "-f", ".");
    const r = spawnSync(process.execPath, [SCAN, "--staged"], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    const out = r.stdout + r.stderr;
    for (const v of [FAKE.serviceRole, FAKE.ghToken, "ficticioref000000000", FAKE.serviceRole.split(".")[1]]) assert.ok(!out.includes(v), "la salida no debe contener valores");
    assert.match(out, /CRITICO\s+cfg\/deploy\.sh:1/);
    assert.match(out, /\.env · archivo de variables de entorno versionado/);
    assert.match(out, /variable SUPABASE_SERVICE_ROLE_KEY \(linea 2\): JWT Supabase service_role/);
    assert.match(out, /que hacer:/);
    const j = spawnSync(process.execPath, [SCAN, "--staged", "--json"], { cwd: dir, encoding: "utf8" });
    assert.ok(!j.stdout.includes(FAKE.serviceRole) && !j.stdout.includes(FAKE.ghToken), "el JSON tampoco contiene valores");
    // Historial: lo commiteado y luego borrado sigue apareciendo (no falla salvo --strict).
    g("commit", "-q", "-m", "con secretos ficticios"); g("rm", "-q", "--cached", ".env", "cfg/deploy.sh"); g("commit", "-q", "-m", "retirados");
    const tree = spawnSync(process.execPath, [SCAN], { cwd: dir, encoding: "utf8" });
    assert.equal(tree.status, 0, "el arbol actual quedo limpio: " + tree.stdout);
    const hist = spawnSync(process.execPath, [SCAN, "--history"], { cwd: dir, encoding: "utf8" });
    assert.equal(hist.status, 0);
    assert.match(hist.stdout, /commits que lo agregan o quitan: 2 \(primero [0-9a-f]{7}/);
    assert.ok(!hist.stdout.includes(FAKE.serviceRole));
    assert.equal(spawnSync(process.execPath, [SCAN, "--history", "--strict"], { cwd: dir, encoding: "utf8" }).status, 1);
    // --range (CI de un PR): un secreto agregado y quitado DENTRO del rango se detecta aunque el arbol final este limpio.
    const base = execFileSync("git", ["-C", dir, "rev-list", "--max-parents=0", "HEAD"], { encoding: "utf8" }).trim();
    const rr = spawnSync(process.execPath, [SCAN, "--range", base + "..HEAD"], { cwd: dir, encoding: "utf8" });
    assert.equal(rr.status, 1, rr.stdout);
    assert.match(rr.stdout, /modo=range/);
    assert.ok(!rr.stdout.includes(FAKE.serviceRole) && !rr.stdout.includes(FAKE.ghToken));
    assert.equal(spawnSync(process.execPath, [SCAN, "--range", "HEAD..HEAD"], { cwd: dir, encoding: "utf8" }).status, 0, "rango vacio = limpio");
    // Errores: si git falla, exit 2 (nunca un "0 hallazgos" falso).
    const bad = spawnSync(process.execPath, [SCAN, "--range", "noexiste..HEAD"], { cwd: dir, encoding: "utf8" });
    assert.equal(bad.status, 2, bad.stdout + bad.stderr);
    assert.match(bad.stderr, /ERROR: no se pudo completar/);
    const nogit = mkdtempSync(path.join(os.tmpdir(), "it-nogit-"));
    try { assert.equal(spawnSync(process.execPath, [SCAN], { cwd: nogit, encoding: "utf8" }).status, 2); } finally { rmSync(nogit, { recursive: true, force: true }); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

await test("hallazgos conocidos: solo el valor exacto en la ruta exacta deja de fallar; se sigue informando; nada mas se tolera", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "it-known-"));
  try {
    const g = (...a) => execFileSync("git", ["-C", dir, ...a], { stdio: "pipe" });
    g("init", "-q"); g("config", "user.email", "qa@example.invalid"); g("config", "user.name", "QA ficticio");
    mkdirSync(path.join(dir, "hooks"));
    writeFileSync(path.join(dir, "hooks", "push.js"), "const K = '" + FAKE.oneSignal + "';\n");
    g("add", "."); g("commit", "-q", "-m", "x");
    const known = path.join(dir, "known.json");
    const run = () => spawnSync(process.execPath, [SCAN], { cwd: dir, encoding: "utf8", env: { ...process.env, SECRET_SCAN_KNOWN: known } });
    writeFileSync(known, JSON.stringify({ findings: [{ id: "T1", path: "hooks/push.js", rule: "onesignal-rest-key", fingerprint: S.fingerprint(FAKE.oneSignal), owner_action: "rotar" }] }));
    let r = run();
    assert.equal(r.status, 0, r.stdout); assert.match(r.stdout, /CONOCIDO hooks\/push\.js:1 .* PENDIENTE: rotar \(T1\)/); assert.ok(!r.stdout.includes(FAKE.oneSignal));
    writeFileSync(path.join(dir, "hooks", "otro.js"), "const K = '" + FAKE.oneSignal + "';\n"); g("add", "."); g("commit", "-q", "-m", "copia");
    r = run(); assert.equal(r.status, 1, "el mismo valor en OTRA ruta falla");
    g("rm", "-q", "hooks/otro.js"); g("commit", "-q", "-m", "fuera");
    writeFileSync(known, JSON.stringify({ findings: [{ id: "T1", path: "hooks/push.js", rule: "onesignal-rest-key", fingerprint: "0000000000000000" }] }));
    r = run(); assert.equal(r.status, 1, "otra huella (otro valor) falla");
    assert.match(r.stdout, /T1 ya no aparece: quitarlo/);
    writeFileSync(known, JSON.stringify({ findings: [{ path: "hooks/push.js", rule: "onesignal-rest-key", fingerprint: "corta" }] }));
    r = run(); assert.equal(r.status, 2, "entrada invalida = error, no silencio");
    const real = S.loadKnown();
    for (const k of real) { assert.match(k.fingerprint, /^[0-9a-f]{16}$/); assert.ok(k.owner_action && k.id, "cada conocido real declara id y accion del dueno"); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

await test("el CI corre el escaneo (arbol y commits del PR con historial completo) y el hook pre-commit usa --staged", async () => {
  const fs = await import("node:fs");
  const ci = fs.readFileSync(path.join(ROOT, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /run: node scripts\/security\/secret-scan\.mjs\n/);
  assert.match(ci, /secret-scan\.mjs --range "\$\{\{ github\.event\.pull_request\.base\.sha \}\}\.\.\$\{\{ github\.event\.pull_request\.head\.sha \}\}"/);
  assert.match(ci, /fetch-depth: 0/);
  assert.doesNotMatch(ci, /SECRET_SCAN_KNOWN/, "el CI no redirige la lista de conocidos");
  const hook = path.join(ROOT, ".githooks/pre-commit");
  assert.match(fs.readFileSync(hook, "utf8"), /secret-scan\.mjs --staged/);
  assert.ok(fs.statSync(hook).mode & 0o111, "el hook es ejecutable");
});

await test("repo real: el arbol versionado no tiene archivos sensibles ni secretos (el mismo control que corre en CI)", () => {
  const r = spawnSync(process.execPath, [SCAN], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, "secret-scan encontro hallazgos:\n" + r.stdout);
});

console.log("\n" + count + " pruebas OK");
