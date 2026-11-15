// S-1 · OneSignal desactivado: sin clave REST ni envio desde el frontend, sin SDK ni registro al iniciar sesion; notifyAlumno queda
// como funcion estable sin efecto; el chat interno no depende de OneSignal.
//   node scripts/test-onesignalDesactivado.mjs
// Falla sobre el codigo anterior (clave en hooks/useAlumnos.js, fetch a la API de OneSignal, OneSignalDeferred en App.jsx).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const APP_CODE = /^(App\.jsx|main\.jsx|index\.html|hooks\/.+|components\/.+|lib\/.+|contexts\/.+|config\/.+|public\/.+)$/;
const files = execFileSync("git", ["-C", ROOT, "ls-files"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\n").filter((f) => APP_CODE.test(f) && !/\.(png|jpe?g|webp|ico|gif|woff2?|ttf|mp4|pdf)$/i.test(f));

await test("ningun archivo de la app contiene la clave REST, la API de envio ni el SDK de OneSignal", () => {
  const bad = [];
  const forma = new RegExp("os_v2" + "_app_[A-Za-z0-9]{20,}");
  for (const f of files) {
    const s = read(f);
    if (forma.test(s)) bad.push(f + " (clave REST)");
    if (/onesignal\.com\/api/i.test(s)) bad.push(f + " (API de envio)");
    if (/OneSignalDeferred|OneSignalSDK|cdn\.onesignal\.com/.test(s)) bad.push(f + " (SDK)");
  }
  assert.deepEqual(bad, [], bad.join(", "));
});

await test("el login del alumno ya no escribe onesignal_id (sin PATCH oculto a alumnos)", () => {
  assert.doesNotMatch(read("App.jsx"), /onesignal_id/);
});

await test("notifyAlumno sigue existiendo (App.jsx la desestructura), no hace red y devuelve false", async () => {
  const React = (await import("react")).default;
  const { renderToString } = await import("react-dom/server");
  const { useAlumnos } = await import(pathToFileURL(path.join(ROOT, "hooks/useAlumnos.js")).href);
  let api = null;
  function Probe() { api = useAlumnos({ sb: {} }); return null; }
  renderToString(React.createElement(Probe));
  assert.equal(typeof api.notifyAlumno, "function");
  const llamadas = [];
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = (...a) => { llamadas.push(a); throw new Error("no deberia hacer red"); };
  try {
    assert.equal(await api.notifyAlumno("alumno-ficticio", "hola"), false);
    assert.equal(await api.notifyAlumno(undefined, undefined), false);
  } finally { globalThis.fetch = fetchOriginal; }
  assert.equal(llamadas.length, 0, "notifyAlumno no debe llamar a fetch");
  assert.match(read("App.jsx"), /notifyAlumno,/, "App.jsx sigue pudiendo desestructurarla sin romperse");
});

await test("el chat interno no depende de OneSignal ni de notifyAlumno", () => {
  for (const f of ["components/Chat.jsx", "components/ChatFlotante.jsx", "lib/chatMessages.js"]) {
    const s = read(f);
    assert.doesNotMatch(s, /onesignal|notifyAlumno/i, f);
  }
});

console.log("\n" + count + " pruebas OK");
