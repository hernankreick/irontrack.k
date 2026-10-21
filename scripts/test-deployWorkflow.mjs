// Valida de forma estatica .github/workflows/deploy-update-alumno-password.yml (sin red y sin parser YAML: comprobaciones de texto).
// Garantiza que el despliegue siga siendo manual, protegido por un entorno, limitado a UNA funcion y sin secretos en el repositorio.
// Usa listas PERMITIDAS (lo unico que el flujo puede hacer) en lugar de listas de cosas prohibidas.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = new URL("../", import.meta.url).pathname;
const WF_DIR = ROOT + ".github/workflows/";
const y = readFileSync(WF_DIR + "deploy-update-alumno-password.yml", "utf8");
const code = y.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n"); // sin comentarios

let n = 0, failed = 0;
const t = (name, fn) => { try { fn(); n++; console.log("ok -", name); } catch (e) { failed++; console.log("FAIL -", name); console.log("  " + String((e && e.message) || e).split("\n")[0]); } };
const uniq = (a) => [...new Set(a)].sort();

t("solo se dispara a mano (workflow_dispatch): ni push, ni pull_request, ni schedule, ni otros disparadores", () => {
  const m = /^on:\n((?:[ \t]+.*\n|\n)+)/m.exec(code + "\n");
  assert.ok(m, "bloque on:");
  const keys = uniq((m[1].match(/^ {2}([a-z_]+):/gm) || []).map((s) => s.trim().replace(":", "")));
  assert.deepEqual(keys, ["workflow_dispatch"]);
});
t("el job exige un entorno protegido y corre solo desde main", () => {
  assert.match(code, /^\s+environment:\s*production-functions\s*$/m);
  assert.match(code, /if:\s*github\.ref == 'refs\/heads\/main'/);
});
t("permisos minimos: contents: read y ningun permiso de escritura", () => {
  assert.match(code, /^permissions:\n\s+contents:\s*read\s*$/m);
  assert.ok(!/:\s*write\b/.test(code));
});
t("los unicos secretos y variables usados son el token de acceso y la referencia del proyecto, tomados del entorno de GitHub", () => {
  assert.deepEqual(uniq((code.match(/secrets\.([A-Z_]+)/g) || []).map((s) => s.slice(8))), ["SUPABASE_ACCESS_TOKEN"]);
  assert.deepEqual(uniq((code.match(/vars\.([A-Z_]+)/g) || []).map((s) => s.slice(5))), ["SUPABASE_PROJECT_REF"]);
  assert.ok(!/sbp_[A-Za-z0-9]|eyJ[A-Za-z0-9_-]{20,}|sb_secret/.test(code), "parece un token escrito en el archivo");
  assert.ok(!/SUPABASE_ACCESS_TOKEN:\s*(?!\$\{\{)\S/.test(code), "el token no puede tener un valor literal");
});
t("los unicos hosts a los que se conecta son los ficticios del build, la API de gestion y el proyecto indicado por variable", () => {
  const hosts = uniq((code.match(/https:\/\/([^\/"\s]+)/g) || []).map((s) => s.slice(8)));
  for (const h of hosts) assert.ok(h === "example.invalid" || /^api\./.test(h) || h.includes("$PROJECT_REF"), "host inesperado: " + h);
  assert.ok(!/\b[a-z0-9]{20}\.[a-z]+\.(?:co|com)\b/.test(code), "no debe llevar el host de un proyecto real");
});
t("los inputs no se interpolan en el shell: pasan por variables de entorno y se validan por formato", () => {
  const body = code.replace(/^\s+(EXPECTED_SHA|EXPECTED_COACH_UIDS):.*$/gm, "");
  assert.ok(!/\$\{\{\s*inputs\./.test(body), "inputs interpolados fuera de env:");
  assert.match(code, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(code, /\[0-9a-f\]\{8\}\(-\[0-9a-f\]\{4\}\)\{3\}-\[0-9a-f\]\{12\}/);
});
t("despliega exactamente UNA funcion, solo esa, con Verify JWT activado", () => {
  const deploys = code.match(/functions deploy[^\n]*/g) || [];
  assert.equal(deploys.length, 1);
  assert.match(deploys[0], /functions deploy "\$FN" --project-ref "\$PROJECT_REF"$/);
  assert.match(code, /^\s+FN:\s*update-alumno-password\s*$/m);
  assert.ok(!/no-verify-jwt/.test(code));
  assert.ok(!/--all\b/.test(code));
});
t("la CLI de despliegue se usa SOLO para: secrets list, functions deploy y functions download", () => {
  const used = uniq([...code.matchAll(/\bsupabase\b[ \t]+([a-z-]+)[ \t]+([a-z-]+)/g)].filter((m) => !/^(?:run|uses|setup)/.test(m[1])).map((m) => m[1] + " " + m[2]));
  assert.deepEqual(used, ["functions deploy", "functions download", "secrets list"]);
});
t("no incluye migraciones, SQL, escritura de secretos ni borrado de funciones, ni usa la herramienta de vinculacion", () => {
  for (const bad of ["db push", "db reset", "migration", "secrets set", "secrets unset", "functions delete", "link-alumno", "sudo", "npx "]) assert.ok(!code.includes(bad), bad);
});
t("verifica el commit exacto de main y ambos archivos, y corre suites, build y verificaciones previas ANTES de desplegar", () => {
  const i = (s) => code.indexOf(s);
  for (const s of ["EXPECTED_SHA", "handler.js", "scripts/test-*.mjs", "npm run build", "secrets list", "verify_jwt", "functions deploy"]) assert.ok(i(s) > 0, s);
  const d = i("functions deploy");
  assert.ok(i("scripts/test-*.mjs") < d && i("npm run build") < d && i("secrets list") < d && i("verify_jwt") < d);
  assert.match(code, /ref:\s*main/);
});
t("verificacion posterior: version activa con Verify JWT, codigo identico a main y 401 sin autorizacion, sin tocar contrasenas", () => {
  const post = code.slice(code.indexOf("Verificacion posterior"));
  assert.match(post, /status == "ACTIVE" and \.verify_jwt == true/);
  assert.match(post, /diff -r --exclude=README\.md/);
  assert.match(post, /"401"/);
  assert.ok(!/(newPassword|alumnoEmail)/.test(post));
});
t("el CI existente no despliega ni usa secretos ni entornos", () => {
  const ci = readFileSync(WF_DIR + "ci.yml", "utf8");
  assert.ok(!/functions deploy|SUPABASE_ACCESS_TOKEN|environment:|secrets\./.test(ci));
});
t("es el unico workflow con acceso a un entorno protegido", () => {
  const withEnv = readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f) && /^\s+environment:/m.test(readFileSync(WF_DIR + f, "utf8")));
  assert.deepEqual(withEnv, ["deploy-update-alumno-password.yml"]);
});

console.log(n + " tests ok" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
