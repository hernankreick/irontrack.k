// Subtitulo de «Semana N de 4» en la ficha del alumno (PR #196) + demostracion «Semana activa».
// Renderiza el componente REAL (SemanaActivaDemo -> CoachStudentsMain -> StudentsSection -> StudentProgressSummary) con esbuild +
// react-dom/server, en memoria: sin red, sin Supabase y sin dependencias nuevas.
//
//   node scripts/test-semanaSubtitulo.mjs

// La etiqueta usa la fecha local del dispositivo: se fija la zona del entrenador para que la prueba sea la misma en cualquier maquina.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(ROOT, "package.json"));
const { build } = require("esbuild");

const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const { semanaSubtitulo, semanaInicioMs } = await imp("components/students/semanaSubtitulo.js");
const { getActiveStudentRoutinePosition } = await imp("lib/studentWeeklyProgress.js");
const data = await imp("components/demo/semanaActivaDemoData.js");

// --- render real de la demo (en memoria) ------------------------------------------------------------------------------------------
const entry = `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Demo from ${JSON.stringify(ROOT + "/components/demo/SemanaActivaDemo.jsx")};
export function render(props) { return renderToStaticMarkup(React.createElement(Demo, props)); }
`;
const out = await build({
  stdin: { contents: entry, resolveDir: ROOT, loader: "jsx" },
  bundle: true, write: false, format: "cjs", platform: "node", metafile: true,
  external: ["react", "react-dom", "react-dom/server"], loader: { ".jsx": "jsx", ".css": "empty" },
});
const mod = { exports: {} };
new Function("require", "module", "exports", out.outputFiles[0].text)(require, mod, mod.exports);
const { render } = mod.exports;
const text = (html) => html.replace(/<[^>]+>/g, "|").replace(/ /g, " ").replace(/\|+/g, "|");

const msgEs = (es) => es;
const msgEn = (_es, en) => en;
const posicion = (clave) => {
  const alumno = data.DEMO_SA_ALUMNOS.find((a) => a.id === data.demoSaAlumnoId(clave));
  const rutina = data.demoSaRutinas().find((r) => r.alumno_id === alumno.id);
  return getActiveStudentRoutinePosition({ alumno, rutina, sesiones: data.demoSaSesiones(), progreso: {}, currentWeek: 0 }).weeklyProgress;
};
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok - " + name); }

// --- los tres estados del subtitulo ---------------------------------------------------------------------------------------------
test("Catalina: semana 3 de 4, 0/3 -> «Sin iniciar»", () => {
  const w = posicion("catalina");
  assert.equal(w.weekNumber, 3);
  assert.equal(w.completedDays, 0);
  assert.equal(w.totalDays, 3);
  assert.equal(w.sessionsUsed.length, 0);
  assert.equal(semanaInicioMs(w), null);
  assert.equal(semanaSubtitulo(w, msgEs), "Sin iniciar");
  assert.equal(semanaSubtitulo(w, msgEn), "Not started");
});

test("Alumno B: semana 2 de 4, 1/3 -> «Iniciada el D/M» (fecha de su unica sesion de la S2: 17/11)", () => {
  const w = posicion("alumno-b");
  assert.equal(w.weekNumber, 2);
  assert.equal(w.completedDays, 1);
  assert.equal(w.sessionsUsed.length, 1);
  assert.equal(semanaSubtitulo(w, msgEs), "Iniciada el 17/11");
  assert.equal(semanaSubtitulo(w, msgEn), "Started 17/11");
});

test("Alumno C: semana 4 de 4, 3/3 -> fecha real de inicio de la S4 (la primera de sus 3 sesiones, 26/10; no la ultima ni otra semana)", () => {
  const w = posicion("alumno-c");
  assert.equal(w.weekNumber, 4);
  assert.equal(w.completedDays, 3);
  assert.equal(w.sessionsUsed.length, 3);
  assert.equal(semanaSubtitulo(w, msgEs), "Iniciada el 26/10");
  // la S1 empezo el 5/10: si tomara sesiones de otra semana el resultado seria otro
  assert.notEqual(semanaSubtitulo(w, msgEs), "Iniciada el 5/10");
});

test("el texto esperado de la demo coincide con lo que calcula la funcion real (una sola fuente)", () => {
  for (const clave of data.DEMO_SA_CLAVES) assert.equal(semanaSubtitulo(posicion(clave), msgEs), data.DEMO_SA_ESPERADO[clave], clave);
});

test("casos borde: sin datos de semana -> vacio; dias hechos pero sin fecha legible -> vacio (no se inventa una fecha)", () => {
  assert.equal(semanaSubtitulo(null, msgEs), "");
  assert.equal(semanaSubtitulo(undefined, msgEs), "");
  assert.equal(semanaSubtitulo({ completedDays: 2, sessionsUsed: [] }, msgEs), "");
  assert.equal(semanaSubtitulo({ completedDays: 2, sessionsUsed: [{ created_at: "no es fecha", fecha: "" }] }, msgEs), "");
  assert.equal(semanaSubtitulo({ completedDays: 0, sessionsUsed: [] }, msgEs), "Sin iniciar");
});

test("la fecha sale de created_at o, si falta, de fecha (D/M/AAAA); con varias toma la mas antigua", () => {
  const w = { completedDays: 2, sessionsUsed: [{ created_at: "2026-11-12T15:00:00.000Z" }, { fecha: "9/11/2026" }, { created_at: "2026-11-14T15:00:00.000Z" }] };
  assert.equal(semanaSubtitulo(w, msgEs), "Iniciada el 9/11");
});

test("solo presentacion: no modifica el resultado de semanas/sesiones (entrada congelada) y no depende del dia de hoy", () => {
  for (const clave of data.DEMO_SA_CLAVES) {
    const w = deepFreeze(posicion(clave));
    assert.doesNotThrow(() => semanaSubtitulo(w, msgEs));
  }
  const RealDate = Date;
  try {
    // si dependiera del calendario de hoy (como el rango anterior), cambiaria al "mover" el reloj
    globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [RealDate.UTC(2027, 2, 3, 15)])); } static now() { return RealDate.UTC(2027, 2, 3, 15); } };
    assert.equal(semanaSubtitulo(posicion("catalina"), msgEs), "Sin iniciar");
    assert.equal(semanaSubtitulo(posicion("alumno-b"), msgEs), "Iniciada el 17/11");
    assert.equal(semanaSubtitulo(posicion("alumno-c"), msgEs), "Iniciada el 26/10");
  } finally { globalThis.Date = RealDate; }
});

// --- componente real renderizado (StudentsSection -> ficha) ----------------------------------------------------------------------
const RANGO_CALENDARIO = /\d{1,2}\/\d{1,2} — \d{1,2}\/\d{1,2}/;
const casos = [
  ["catalina", "Semana 3 de 4", "0 de 3 días", "Sin iniciar"],
  ["alumno-b", "Semana 2 de 4", "1 de 3 días", "Iniciada el 17/11"],
  ["alumno-c", "Semana 4 de 4", "3 de 3 días", "Iniciada el 26/10"],
];
for (const dark of [true, false]) {
  for (const [clave, semana, dias, subtitulo] of casos) {
    test("render real (" + (dark ? "oscuro" : "claro") + ") " + clave + ": «" + semana + "» + «" + subtitulo + "» y " + dias, () => {
      const t = text(render({ initialAlumno: clave, initialDark: dark }));
      // el subtitulo va justo debajo de «Semana N de 4», dentro de la ficha abierta
      assert.ok(t.includes(semana + "|" + subtitulo + "|"), "subtitulo bajo la semana: " + t.slice(Math.max(0, t.indexOf(semana) - 20), t.indexOf(semana) + 120));
      assert.ok(t.includes(dias), dias);
      // regresion del PR: el rango lunes-domingo del calendario ya no aparece
      assert.ok(!RANGO_CALENDARIO.test(t), "no debe quedar un rango de fechas de calendario");
    });
  }
}

test("cada ficha muestra SOLO su propio subtitulo (cambiar de alumno no deja el de otro)", () => {
  const t = (clave) => text(render({ initialAlumno: clave, initialDark: true }));
  const catalina = t("catalina");
  assert.ok(!catalina.includes("Iniciada el"), "Catalina no tiene fecha de inicio");
  assert.ok(t("alumno-b").includes("Iniciada el 17/11") && !t("alumno-b").includes("Sin iniciar|"));
  assert.ok(t("alumno-c").includes("Iniciada el 26/10") && !t("alumno-c").includes("Sin iniciar|"));
});

test("barra de la demo: tres alumnos, tema oscuro/claro, estado activo y texto esperado", () => {
  const h = render({ initialAlumno: "alumno-b", initialDark: false });
  for (const c of data.DEMO_SA_CLAVES) assert.ok(h.includes('data-demo-alumno="' + c + '"'), c);
  assert.ok(/data-demo-alumno="alumno-b"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-demo-alumno="alumno-b"/.test(h), "alumno B marcado");
  assert.ok(/data-demo-theme="light"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-demo-theme="light"/.test(h), "tema claro marcado");
  assert.ok(h.includes('data-demo-esperado="Iniciada el 17/11"'));
  assert.ok(text(h).includes("Debajo de «Semana N de 4» tiene que decir: «Iniciada el 17/11»"));
  assert.equal(count >= 1, true);
});

test("clave desconocida -> cae en Catalina (no rompe)", () => {
  assert.ok(text(render({ initialAlumno: "no-existe" })).includes("Semana 3 de 4|Sin iniciar|"));
});

// --- garantias: demo independiente, solo lectura, sin tocar semanas ni datos reales -------------------------------------------------
test("la demo no importa App.jsx, Supabase ni el cliente de datos (ni de forma transitiva)", () => {
  const inputs = Object.keys(out.metafile.inputs);
  const malos = inputs.filter((f) => /(^|\/)App\.jsx$|supabaseClient|\/supabase\/|@supabase/.test(f));
  assert.deepEqual(malos, [], "modulos de datos reales en la demo: " + malos.join(", "));
  const main = readFileSync(path.join(ROOT, "components/demo/semanaActivaDemoMain.jsx"), "utf8");
  assert.ok(!/App\.jsx|supabaseClient|@supabase/.test(main.replace(/^\/\/.*$/gm, "")), "el entry no importa App ni Supabase");
});

test("la capa sb de la demo solo lee: reconcileSemanaActivaAlumno es noop y escribir no esta soportado", async () => {
  const sb = data.createDemoSaSb();
  assert.deepEqual(await sb.reconcileSemanaActivaAlumno("demo-sa-catalina"), { status: "noop" });
  await assert.rejects(() => sb.addSesion({}));
  await assert.rejects(() => sb.setNota({}));
  assert.deepEqual(await sb.getProgreso(), []);
  // leer no cambia los datos: la semana activa de cada rutina sigue siendo la de origen
  await sb.getRutinas("demo-sa-catalina"); await sb.getSesiones("demo-sa-catalina");
  assert.deepEqual(data.demoSaRutinas().map((r) => r.datos.semana_activa), [3, 2, 4]);
});

test("los datos de la demo son ficticios y estan en el rango esperado (sin correos ni ids reales)", () => {
  assert.ok(data.DEMO_SA_ALUMNOS.every((a) => /^demo-sa-/.test(a.id) && /@ejemplo\.com$/.test(a.email)));
  assert.ok(data.demoSaSesiones().every((s) => /^demo-sa-/.test(String(s.alumno_id)) && Number(s.semana) >= 1 && Number(s.semana) <= 4));
});

console.log("\n" + count + " pruebas OK");
