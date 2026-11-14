// Demo QA del PR #194 (demo/qa-pr194.html): el servidor ficticio respeta los contratos reales, la demo está aislada y reutiliza los
// componentes reales. Todo con datos ficticios y sin red.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODOS, crearServidorRutinasDemo, rutinaLocalNueva, filaARutinaLocal, diasDemo } from "../components/demo/qaPr194DemoData.js";
import { instalarAislamiento } from "../components/demo/qaPr194Aislamiento.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const rechaza = async (fn, re, m) => { let err = null; try { await fn(); } catch (e) { err = e; } ok(err && re.test(String(err.message || err)), m); };
const payload = (extra) => Object.assign({ nombre: "R", alumno_id: "demo-a1", entrenador_id: "entrenador_principal", es_plantilla: false, datos: { days: diasDemo(""), alumno: "x", note: "" } }, extra || {});

// ── Contratos del servidor ficticio (iguales a producción) ──
{
  const s = crearServidorRutinasDemo({});
  const r = await s.sb.updateRutina("demo-r1", payload({ nombre: "Rutina A editada" }));
  ok(Array.isArray(r) && r.length === 1 && r[0].nombre === "Rutina A editada", "update ok -> array con la fila");
  ok(r[0].datos.semana_activa === 2, "update preserva semana_activa (estado operativo, función real)");
  ok(s.resumen().updatesConfirmados === 1, "contador de confirmados");
  const c = await s.sb.createRutina(payload({ nombre: "Nueva" }));
  ok(Array.isArray(c) && c.length === 1 && c[0].datos.semana_activa === 1, "create ok -> [fila] y semana_activa inicial = 1 (withInitialSemanaActiva real)");
  ok(s.filas().length === 2, "dos filas");
  await rechaza(() => s.sb.createRutina(payload({ alumno_id: null })), /sin un alumno asignado/, "create sin alumno y sin plantilla lanza (cleanRutinaWriteBody real)");
  ok((await s.sb.createRutina(payload({ alumno_id: null, es_plantilla: true })))[0].es_plantilla === true, "plantilla sin alumno ok");
}
{
  const s = crearServidorRutinasDemo({ modo: MODOS.RED });
  await rechaza(() => s.sb.updateRutina("demo-r1", payload()), /Failed to fetch/, "modo red: update LANZA");
  await rechaza(() => s.sb.createRutina(payload()), /Failed to fetch/, "modo red: create LANZA");
  ok(s.resumen().filas === 1 && s.resumen().updatesConfirmados === 0 && s.resumen().createsConfirmados === 0, "modo red: no persiste nada");
  s.setModo(MODOS.NULO);
  ok((await s.sb.updateRutina("demo-r1", payload())) === null && (await s.sb.createRutina(payload())) === null, "modo nulo: null");
  s.setModo(MODOS.VACIO);
  const v1 = await s.sb.updateRutina("demo-r1", payload()), v2 = await s.sb.createRutina(payload());
  ok(Array.isArray(v1) && v1.length === 0 && Array.isArray(v2) && v2.length === 0, "modo vacío: []");
  ok(s.resumen().filas === 1 && s.resumen().updatesConfirmados === 0, "ningún modo de falla modifica el servidor");
  ok(s.resumen().updates === 3 && s.resumen().creates === 3, "las llamadas se cuentan (intentos)");
  s.setModo(MODOS.OK);
  ok((await s.sb.updateRutina("no-existe", payload())).length === 0, "update de una fila inexistente -> [] (0 filas)");
}
{
  // Latencia: dos create concurrentes SIN guardia producirían dos filas (lo que evita el candado de RutinaView)
  const s = crearServidorRutinasDemo({ latenciaMs: 20 });
  await Promise.all([s.sb.createRutina(payload()), s.sb.createRutina(payload())]);
  ok(s.resumen().filas === 3, "el servidor no deduplica: la guardia está en la UI (RutinaView)");
  const n1 = rutinaLocalNueva(2);
  ok(n1.saved === false && n1.id === "local-2" && n1.days.length === 2, "rutina local nueva sin guardar");
  ok(filaARutinaLocal(s.filas()[0]).saved === true, "fila -> rutina local guardada");
}

// ── Aislamiento (con un window falso: en node no hay navegador) ──
{
  class FakeStorage {}
  class FakeXHR { open() { return "real"; } }
  const win = { Storage: FakeStorage, XMLHttpRequest: FakeXHR, navigator: {}, fetch: () => "real" };
  win.localStorage = new FakeStorage();
  const e = instalarAislamiento(win);
  ok(e.storageEnMemoria && e.indexedDBBloqueado && e.redBloqueada, "aislamiento instalado");
  const antes = e.intentosRed.length;
  await rechaza(() => win.fetch("https://algun-backend.example/rest/v1/rutinas"), /sin red/, "fetch bloqueado");
  ok(e.intentosRed.length === antes + 1, "el intento de red queda registrado");
  ok(e.intentosRed.every((x) => x.destino.length <= 80), "destinos acotados");
  win.localStorage.setItem("k", "v");
  ok(win.localStorage.getItem("k") === "v" && win.localStorage.getItem("otra") === null, "almacenamiento en memoria funciona");
  const otra = new FakeStorage();
  ok(otra.getItem("k") === null, "memoria por instancia (local y session no se mezclan)");
  try { new win.XMLHttpRequest().open("GET", "/x"); ok(false, "xhr debe lanzar"); } catch (er) { ok(/sin red/.test(er.message), "XHR bloqueado"); }
  try { new win.WebSocket("wss://x"); ok(false, "ws debe lanzar"); } catch (er) { ok(/sin red/.test(er.message), "WebSocket bloqueado"); }
}

// ── Cableado: componentes reales, sin Supabase, solo Preview ──
const main = read("components/demo/qaPr194DemoMain.jsx");
ok(main.indexOf("./qaPr194Aislamiento.js") !== -1 && main.indexOf("./qaPr194Aislamiento.js") < main.indexOf("react-dom/client"), "el aislamiento se importa primero");
const codigo = [main, read("components/demo/QaPr194Demo.jsx"), read("components/demo/qaPr194DemoData.js"), read("components/demo/qaPr194Aislamiento.js")].map((t) => t.replace(/^\s*\/\/.*$/gm, "")).join("\n");
ok(!/App\.jsx|supabaseClient|createClient|@supabase|\.env|VITE_/.test(codigo), "la demo no importa App.jsx, el cliente de datos ni variables de entorno");
const demo = read("components/demo/QaPr194Demo.jsx");
for (const c of ["WorkoutExercisePanel", "RutinaView", "AlumnoSettingsModal", "AlumnoProfileModal", "ExerciseHistoryModal"]) ok(new RegExp("import \\{? ?" + c + " ?\\}? from").test(demo), "usa el componente real " + c);
const html = read("demo/qa-pr194.html");
ok(/Content-Security-Policy[^>]*connect-src 'self'/.test(html) && /noindex/.test(html), "CSP connect-src 'self' y noindex");
ok(/demoQaPr194: path\.resolve\(__dirname, 'demo\/qa-pr194\.html'\)/.test(read("vite.config.js")), "ruta registrada en vite.config.js (solo Preview)");
ok(!/qa-pr194/.test(read("vercel.json")), "sin cambios de despliegue en vercel.json");

console.log("OK test-demoQaPr194 (" + n + " aserciones)");
