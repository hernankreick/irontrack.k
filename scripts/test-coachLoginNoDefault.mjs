// Regresion IT-001: el login del entrenador no tiene contrasena por defecto, no compara
// credenciales en el cliente y no crea cuentas (signUp) cuando el login falla.
// La unica credencial valida es la de Auth (signInWithPassword).
//
//   node scripts/test-coachLoginNoDefault.mjs [directorio-raiz-alternativo]
//
// Lee el codigo fuente; no usa red ni servicios reales. No contiene la contrasena en claro:
// la detecta con un patron. Con un argumento, revisa ese arbol (util para comparar contra
// otra rama exportada). Sale con codigo 1 si algo falla.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = process.argv[2]
  ? resolve(process.argv[2])
  : new URL("..", import.meta.url).pathname;
// Solo codigo que se empaqueta o se despliega.
const SCAN = ["App.jsx", "main.jsx", "components", "contexts", "hooks", "lib", "supabase/functions"];
const EXT = /\.(jsx?|mjs|ts)$/;
const files = [];
SCAN.forEach((r) => (function walk(p) {
  let st; try { st = statSync(p); } catch (e) { return; }
  if (st.isDirectory()) { for (const name of readdirSync(p)) walk(join(p, name)); }
  else if (EXT.test(p)) files.push(p);
})(join(root, r)));
assert.ok(files.length > 0, "no se encontro codigo fuente en " + root);
const read = (rel) => readFileSync(join(root, rel), "utf8");
const app = read("App.jsx");

// Entre dos marcas del manejador de login (la rama del entrenador).
function between(src, startMark, endMark) {
  const a = src.indexOf(startMark);
  assert.ok(a >= 0, "no se encontro la marca: " + startMark);
  const b = src.indexOf(endMark, a + startMark.length);
  assert.ok(b > a, "no se encontro la marca final: " + endMark);
  return src.slice(a, b);
}
// Rama del entrenador: desde la deteccion del email hasta que se limpia el almacenamiento para la sesion nueva.
const coachBranch = between(app, 'const isEntrenador = loginEmailNorm===', "clearIronTrackStorageForNewLogin();");
// Rama del alumno.
const studentBranch = between(app, "const authLoginAlumno = await supabase.auth.signInWithPassword", "syncStateWithLocalStorage();");

let n = 0;
let failed = 0;
const t = (name, fn) => {
  try {
    fn();
    n++;
    console.log("ok -", name);
  } catch (err) {
    failed++;
    console.log("FAIL -", name);
    console.log("  " + String(err && err.message).split("\n")[0]);
  }
};

t("ningun archivo de la aplicacion contiene la contrasena por defecto del entrenador (patron)", () => {
  const offenders = files.filter((f) => /irontrack\d{4}/i.test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
  assert.deepEqual(offenders, [], "contrasena por defecto en: " + offenders.join(", "));
});

t("it_tpass ya no existe (ni como lectura ni como escritura)", () => {
  const offenders = files.filter((f) => /it_tpass/.test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
  assert.deepEqual(offenders, [], "it_tpass en: " + offenders.join(", "));
});

t("la pantalla de login no muestra una contrasena por defecto", () => {
  const offenders = files.filter((f) => /Contrase(?:ñ|n)a por defecto/i.test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
  assert.deepEqual(offenders, [], "texto de contrasena por defecto en: " + offenders.join(", "));
});

t("el cliente no crea cuentas: no hay auth.signUp en ningun archivo", () => {
  const offenders = files.filter((f) => /\.signUp\s*\(/.test(readFileSync(f, "utf8"))).map((f) => relative(root, f));
  assert.deepEqual(offenders, [], "signUp en: " + offenders.join(", "));
});

t("la rama del entrenador no compara la contrasena tipeada con ningun valor local", () => {
  assert.ok(!/loginPass\s*[!=]==?/.test(coachBranch), "comparacion local de loginPass en la rama del entrenador");
  assert.ok(!/localStorage\.getItem\(\s*["']it_t/.test(coachBranch), "lectura local de credenciales en la rama del entrenador");
  assert.ok(/if\s*\(\s*loginPass\s*\)/.test(coachBranch), "la rama debe exigir solo que haya una contrasena escrita");
});

t("el entrenador se autentica con Auth (signInWithPassword) con el email y la contrasena tipeados", () => {
  assert.equal((coachBranch.match(/supabase\.auth\.signInWithPassword\s*\(/g) || []).length, 1);
  assert.ok(/email:\s*loginEmailNorm/.test(coachBranch));
  assert.ok(/password:\s*loginPass/.test(coachBranch));
});

t("si Auth rechaza al entrenador: error generico y return, sin crear cuenta ni continuar", () => {
  const failBlock = between(coachBranch, "if (authLogin.error", "No hay sesión activa");
  assert.ok(/setLoginError\(\s*["']Email o contraseña incorrectos["']\s*\)/.test(failBlock), "falta el mensaje de error generico");
  assert.ok(/return\s*;/.test(failBlock), "falta el return tras el fallo de Auth");
  assert.ok(!/signUp/.test(failBlock), "no debe haber alta de cuenta tras el fallo");
});

t("sin sesion valida de Auth no se guarda it_session del entrenador", () => {
  const afterCoachGate = between(app, "var authLogin = await supabase.auth.signInWithPassword", 'localStorage.setItem("it_session"');
  assert.ok(/!authLogin\.data\.session\.access_token/.test(afterCoachGate), "debe verificarse el access_token de la sesion");
  assert.ok(/setLoginError\(/.test(afterCoachGate) && /return\s*;/.test(afterCoachGate));
});

t("el login del alumno sigue validando la contrasena con Auth (sin cambios)", () => {
  assert.ok(/email:\s*loginEmailNorm/.test(studentBranch) || /signInWithPassword\(\{\s*email:\s*loginEmailNorm/.test(app));
  const studentGate = between(app, "const authLoginAlumno = await supabase.auth.signInWithPassword", "const res=await sbFetch");
  assert.ok(/authLoginAlumno\.error/.test(studentGate) && /setLoginError\(/.test(studentGate) && /return\s*;/.test(studentGate));
});

console.log(n + " tests ok" + (failed ? ", " + failed + " FAILED" : ""));
if (failed) process.exit(1);
