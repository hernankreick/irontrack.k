// Tarjeta «Cumplimiento del ciclo» de la ficha del alumno (PR #176): node scripts/test-cumplimientoCicloFicha.mjs
// Bandera de historial completo por alumno (rosterKey), modelo de la tarjeta, render SSR (esbuild) y cableado App -> ficha.
// Datos 100 % ficticios. Sin red, sin Supabase, sin almacenamiento.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { historialCompletoDeAlumno, modeloCumplimientoCiclo, ESTADO_TARJETA } from "../components/students/cumplimientoCiclo.js";
import { syncCoachHistory } from "../lib/coachHistoryLoader.js";
import { buildReinicioDatos } from "../lib/rutinaCiclo.js";
import { cumplimientoSesiones } from "../lib/cumplimiento/sesiones.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let n = 0;
async function test(name, fn) { await fn(); n++; console.log("ok -", name); }
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- fixtures ficticias
const A = "alu-a", B = "alu-b";
const KEY = [A, B].sort().join(",");
const COMPLETA = { sesiones: true, progreso: true, rosterKey: KEY };
function rutina(id, alumnoId, datos, extra) {
  return Object.assign({ id, nombre: "Fuerza ficticia", alumno_id: alumnoId, created_at: "2026-10-01T10:00:00Z",
    datos: Object.assign({ semana_activa: 2, days: [{}, {}, {}] }, datos || {}) }, extra || {});
}
let seq = 0;
const ses = (alumnoId, rutinaId, semana, dia, extra) => Object.assign({ id: "s" + (++seq), alumno_id: alumnoId, rutina_id: rutinaId, rutina_nombre: "Fuerza ficticia",
  semana, dia_idx: dia, fecha: "5/10/2026", created_at: "2026-10-05T12:00:00Z" }, extra || {});
const RA = rutina("rut-a", A), RB = rutina("rut-b", B, { semana_activa: 1 });
const ROSTER = [
  ses(A, "rut-a", 1, 0), ses(A, "rut-a", 1, 1), ses(A, "rut-a", 1, 2),
  ses(A, "rut-a", 2, 0), ses(A, "rut-a", 2, 1, { origen: "validada_coach" }), ses(A, "rut-a", 2, 0),
  ses(B, "rut-b", 1, 2),
];
const modelo = (alumnoId, rut, sesiones, hc) => modeloCumplimientoCiclo({ alumnoId, rutina: rut, sesiones, historiaCompleta: hc === undefined ? COMPLETA : hc });
const S = (m, w) => m.semanas.find((s) => s.semana === w);

// ---------------------------------------------------------------- bandera por alumno
await test("bandera: solo true con carga completa (sesiones === true) y el alumno en el rosterKey", () => {
  assert.equal(historialCompletoDeAlumno(COMPLETA, A), true);
  assert.equal(historialCompletoDeAlumno(COMPLETA, B), true);
  [null, undefined, false, {}, { sesiones: true }, { sesiones: true, rosterKey: "" }, { sesiones: true, rosterKey: null },
    { sesiones: false, rosterKey: KEY }, { sesiones: "true", rosterKey: KEY }, { sesiones: 1, rosterKey: KEY }, { progreso: true, rosterKey: KEY }]
    .forEach((hc) => assert.equal(historialCompletoDeAlumno(hc, A), false, JSON.stringify(hc)));
  assert.equal(historialCompletoDeAlumno(COMPLETA, "alu-c"), false, "alumno fuera de la carga");
  assert.equal(historialCompletoDeAlumno(COMPLETA, null), false);
  assert.equal(historialCompletoDeAlumno(COMPLETA, ""), false);
  // sin coincidencias parciales: "alu-a" no habilita a "alu-a1" ni a "alu"
  assert.equal(historialCompletoDeAlumno({ sesiones: true, rosterKey: "alu-a1,alu-b" }, A), false);
  assert.equal(historialCompletoDeAlumno({ sesiones: true, rosterKey: "alu-a" }, "alu"), false);
});

await test("carga vacia: un alumno con CERO sesiones tiene historial completo si la carga termino bien", () => {
  const m = modelo(B, RB, [], COMPLETA);
  assert.equal(m.historialConfiable, true);
  assert.deepEqual([S(m, 1).estado, S(m, 1).completados, S(m, 1).pctBarra], ["pendiente", 0, 0]);
  assert.deepEqual(m.acumulado, { completados: 0, programados: 3, pct: 0, semanas: 1 });
});

await test("la presencia de sesiones NO prueba el historial completo (bandera ausente => sin datos)", () => {
  const m = modelo(A, RA, ROSTER, null);
  assert.equal(m.historialConfiable, false);
  assert.equal(m.acumulado, null);
  assert.equal(m.motivoSinAcumulado, "historial_no_confiable");
  assert.equal(S(m, 2).estado, "sin_datos");
});

// Transiciones REALES de lib/coachHistoryLoader.js: el par (complete, rosterKey) que la app guarda siempre es de la misma carga.
function pagina(rows) { return function () { return async function (offset) { return offset === 0 ? rows : []; }; }; }
function falla() { return function () { return async function () { return null; }; }; }
function flagDeApp(sync) { return sync.state && sync.state.complete ? Object.assign({}, sync.state.complete, { rosterKey: typeof sync.state.rosterKey === "string" ? sync.state.rosterKey : null }) : null; }

await test("carga completa OK => bandera con el rosterKey de ESA carga (incluye alumnos con cero sesiones)", async () => {
  const sync = await syncCoachHistory({ pageSesiones: pagina([ROSTER[0]]), pageProgreso: pagina([]), prev: {}, rosterKey: KEY, forceFull: true, now: 1 });
  assert.equal(sync.ok, true);
  const hc = flagDeApp(sync);
  assert.deepEqual(hc, { sesiones: true, progreso: true, rosterKey: KEY });
  assert.equal(historialCompletoDeAlumno(hc, B), true);
});

await test("cambio de roster con carga FALLIDA: la bandera conserva el roster anterior => el alumno nuevo queda sin datos", async () => {
  const ok = await syncCoachHistory({ pageSesiones: pagina([]), pageProgreso: pagina([]), prev: {}, rosterKey: A, forceFull: true, now: 1 });
  const prev = { sesiones: ok.sesiones, progreso: ok.progreso, state: ok.state };
  const fail = await syncCoachHistory({ pageSesiones: falla(), pageProgreso: falla(), prev, rosterKey: KEY, forceFull: true, now: 2 });
  assert.equal(fail.ok, false);
  const hc = flagDeApp(fail);
  assert.equal(hc.rosterKey, A, "la bandera describe la carga anterior (solo A)");
  assert.equal(historialCompletoDeAlumno(hc, A), true, "A sigue con su historial anterior completo");
  assert.equal(historialCompletoDeAlumno(hc, B), false, "B (alta reciente) no estaba en esa carga");
});

await test("carga truncada o con pagina fallida tras el cambio de roster => sesiones false => sin datos", async () => {
  let llamadas = 0;
  const parcial = () => async (offset) => { llamadas++; return offset === 0 ? new Array(2).fill(0).map((_, i) => ses(A, "rut-a", 1, i)) : null; };
  const sync = await syncCoachHistory({ pageSesiones: parcial, pageProgreso: pagina([]), prev: {}, rosterKey: KEY, forceFull: true, now: 1, pageSize: 2 });
  const hc = flagDeApp(sync);
  assert.ok(llamadas >= 2);
  assert.equal(hc.sesiones, false);
  assert.equal(historialCompletoDeAlumno(hc, A), false);
  assert.equal(modelo(A, RA, ROSTER, hc).acumulado, null);
});

await test("primera carga fallida (sin estado previo) => no hay bandera (null) => sin datos", async () => {
  const sync = await syncCoachHistory({ pageSesiones: falla(), pageProgreso: falla(), prev: {}, rosterKey: KEY, forceFull: true, now: 1 });
  assert.equal(flagDeApp(sync), null);
  assert.equal(historialCompletoDeAlumno(flagDeApp(sync), A), false);
});

await test("respuesta asincrona tardia de un roster anterior: no habilita a un alumno que no estaba en esa carga", async () => {
  // El roster cambia de [A] a [A,B]; llega tarde el resultado de la carga de [A]. Aunque se aplicara, describe a [A] y no habilita a B.
  const tardia = await syncCoachHistory({ pageSesiones: pagina([]), pageProgreso: pagina([]), prev: {}, rosterKey: A, forceFull: true, now: 1 });
  const hc = flagDeApp(tardia);
  assert.equal(historialCompletoDeAlumno(hc, B), false);
  // Y en App.jsx el par se aplica SOLO si la respuesta no fue reemplazada (superseded), en el mismo bloque que las filas.
  const app = read("App.jsx");
  const bloque = app.slice(app.indexOf("var superseded = coachHistoryRef.current !== H"), app.indexOf("if(results[1] && Array.isArray(results[1]))"));
  assert.match(bloque, /if\(!superseded\) \{/);
  assert.match(bloque, /setCoachHistoriaCompleta\(Object\.assign\(\{\}, sync\.state\.complete, \{ rosterKey: typeof sync\.state\.rosterKey === 'string' \? sync\.state\.rosterKey : null \}\)\)/);
  assert.match(app, /setCoachHistoriaCompleta\(null\);/, "el cierre de sesion sigue vaciando la bandera");
});

// ---------------------------------------------------------------- modelo de la tarjeta (casos pedidos)
await test("1. ciclo vigente: la tarjeta muestra el ciclo actual de la rutina", () => {
  assert.equal(modelo(A, RA, ROSTER).ciclo, 1);
  const r2 = rutina("rut-a", A, { semana_activa: 1, ciclo_actual: 3, ciclo_base: 3 });
  assert.equal(modelo(A, r2, ROSTER).ciclo, 3);
});

await test("2-4. semana completa, semana actual parcial y semanas futuras (sin porcentaje)", () => {
  const m = modelo(A, RA, ROSTER);
  assert.deepEqual([S(m, 1).estado, S(m, 1).completados, S(m, 1).pctBarra], ["completa", 3, 100]);
  assert.deepEqual([S(m, 2).estado, S(m, 2).actual, S(m, 2).completados, S(m, 2).pctBarra], ["parcial", true, 2, 67]);
  [3, 4].forEach((w) => assert.deepEqual([S(m, w).estado, S(m, w).futura, S(m, w).pctBarra, S(m, w).mostrarConteo], ["pendiente", true, null, true]));
});

await test("5. historial incompleto: sin acumulado; lo no demostrado es «sin datos» y sin porcentaje", () => {
  const m = modelo(A, RA, ROSTER, { sesiones: false, progreso: true, rosterKey: KEY });
  assert.equal(m.acumulado, null);
  assert.equal(S(m, 1).estado, "completa", "lo demostrado sigue completo");
  assert.deepEqual([S(m, 2).estado, S(m, 2).pctBarra, S(m, 2).mostrarConteo], ["sin_datos", null, false]);
});

await test("6. validacion manual: cuenta como sesion y se informa aparte", () => {
  const m = modelo(A, RA, ROSTER);
  assert.equal(S(m, 2).validados, 1);
  assert.equal(S(m, 2).completados, 2);
});

await test("7. cambio de alumno: cada ficha usa SOLO las sesiones de su alumno (misma lista del roster)", () => {
  const ma = modelo(A, RA, ROSTER), mb = modelo(B, RB, ROSTER);
  assert.equal(S(mb, 1).completados, 1);
  assert.equal(S(ma, 1).completados, 3);
  // la rutina de A con el id de B => no se calcula (la ficha nunca cruza alumno y rutina)
  assert.equal(modelo(B, RA, ROSTER), null);
  // cambio rapido A -> B -> A con la misma bandera: resultados identicos (sin estado retenido)
  assert.deepEqual(modelo(A, RA, ROSTER), ma);
});

await test("8. cambio de rutina: las sesiones de la rutina anterior no cuentan en la nueva", () => {
  const nueva = rutina("rut-a-nueva", A, { semana_activa: 1 }, { created_at: "2026-10-20T10:00:00Z" });
  const m = modelo(A, nueva, ROSTER);
  assert.deepEqual(m.semanas.map((s) => s.completados), [0, 0, 0, 0]);
  assert.equal(S(m, 1).estado, "pendiente");
});

await test("9. reinicio de ciclo (rutina) y de semana: el bloque o intento anterior no se mezcla", () => {
  const rr = rutina("rut-a", A, buildReinicioDatos(RA.datos, { tipo: "rutina", nowIso: "2026-10-25T10:00:00Z" }));
  const m = modelo(A, rr, ROSTER.concat([ses(A, "rut-a", 1, 0, { ciclo: 2 })]));
  assert.equal(m.ciclo, 2);
  assert.deepEqual([S(m, 1).completados, S(m, 1).estado], [1, "parcial"]);
  const rw = rutina("rut-a", A, buildReinicioDatos(RA.datos, { tipo: "semana", semana: 2, nowIso: "2026-10-25T10:00:00Z" }));
  const mw = modelo(A, rw, ROSTER);
  assert.equal(mw.huboReinicioDeSemana, true);
  assert.deepEqual([S(mw, 1).estado, S(mw, 2).completados, S(mw, 2).estado], ["completa", 0, "pendiente"]);
});

await test("10. estados no verificables: sin conteo, sin porcentaje y fuera del acumulado", () => {
  const r3 = rutina("rut-a", A, { semana_activa: 3 });
  const m = modelo(A, r3, ROSTER.concat([ses(A, "rut-a", 3, null)]));
  // S2 pasada con 2/3 en el historial => no verificable; S3 actual con una sesion sin dia => no verificable
  [2, 3].forEach((w) => assert.deepEqual([S(m, w).estado, S(m, w).pctBarra, S(m, w).mostrarConteo], ["sin_datos", null, false]));
  assert.deepEqual(m.acumulado, { completados: 3, programados: 3, pct: 100, semanas: 1 });
});

await test("11. acumulado: solo semanas evaluables (pasadas o actual con porcentaje), nunca futuras ni sin datos", () => {
  const m = modelo(A, RA, ROSTER);
  assert.deepEqual(m.acumulado, { completados: 5, programados: 6, pct: 83, semanas: 2 });
  // semana activa desconocida: solo lo demostrado completo es evaluable (S1 3/3); el resto queda sin datos
  const sinPos = modelo(A, rutina("rut-a", A, { semana_activa: null }), ROSTER);
  assert.deepEqual(sinPos.acumulado, { completados: 3, programados: 3, pct: 100, semanas: 1 });
  assert.ok(sinPos.semanas.slice(1).every((s) => s.estado === "sin_datos" && s.pctBarra === null));
  // sin ninguna semana demostrada ni actual evaluable => sin acumulado
  const sinEvaluables = modelo(A, rutina("rut-a", A, { semana_activa: null }), ROSTER.filter((s) => s.semana === 2));
  assert.equal(sinEvaluables.acumulado, null);
  assert.equal(sinEvaluables.motivoSinAcumulado, "sin_semanas_evaluables");
});

await test("12. sin duplicacion: sesiones repetidas (mismo dia) y la union ficha + roster cuentan una vez", () => {
  const union = ROSTER.concat(clone(ROSTER)); // misma fila dos veces (ficha + roster) y duplicados reales
  assert.deepEqual(modelo(A, RA, union).semanas.map((s) => s.completados), modelo(A, RA, ROSTER).semanas.map((s) => s.completados));
  modelo(A, RA, union).semanas.forEach((s) => assert.ok(s.pctBarra == null || (s.pctBarra >= 0 && s.pctBarra <= 100)));
});

await test("el modelo usa el modulo de cumplimiento sin cambios y no muta las entradas", () => {
  const entrada = clone(ROSTER), rut = clone(RA);
  const m = modelo(A, rut, entrada);
  const ref = cumplimientoSesiones({ alumnoId: A, rutina: RA, sesiones: ROSTER, historialCompleto: true });
  assert.deepEqual(m.semanas.map((s) => s.completados), ref.semanas.map((s) => s.completados));
  assert.deepEqual(entrada, ROSTER);
  assert.deepEqual(rut, RA);
  assert.equal(modelo(A, null, ROSTER), null, "sin rutina no hay tarjeta");
  assert.equal(modelo(A, rutina("rut-a", A, { days: [] }), ROSTER), null, "rutina sin dias");
});

// ---------------------------------------------------------------- render (SSR con esbuild) y cableado
async function loadRender() {
  const outfile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "irontrack-cc-")), "bundle.mjs");
  const { build } = await import("esbuild");
  await build({
    stdin: {
      contents:
        'import React from "react";' +
        'import { renderToStaticMarkup } from "react-dom/server";' +
        'import CumplimientoCicloCard from "./components/students/CumplimientoCicloCard.jsx";' +
        'import CumplimientoCicloDemo from "./components/demo/CumplimientoCicloDemo.jsx";' +
        'import { resumenAdherenciaEquipo } from "./components/CoachDashboard.jsx";' +
        "export { React, renderToStaticMarkup, CumplimientoCicloCard, CumplimientoCicloDemo, resumenAdherenciaEquipo };",
      resolveDir: ROOT, sourcefile: "cc-entry.jsx", loader: "jsx",
    },
    bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent", jsx: "automatic", alias: { "@": ROOT },
    loader: { ".css": "empty", ".png": "empty", ".svg": "empty", ".json": "json" },
    define: { "process.env.NODE_ENV": '"production"' },
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  });
  return import(pathToFileURL(outfile).href);
}
const X = await loadRender();
const html = (m, dark) => X.renderToStaticMarkup(X.React.createElement(X.CumplimientoCicloCard, {
  modelo: m, darkMode: dark, msg: (a) => a, textMain: dark ? "#fff" : "#0f172a", textMuted: dark ? "#94a3b8" : "#475569",
  coachAluSurface: dark ? "#0D1424" : "#fff", coachAluBorderSoft: "#334155", coachAluSubtle: dark ? "#101A2D" : "#F8FAFC" }));
const sinTags = (h) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;| /g, " ").replace(/\s+/g, " ");

await test("render: titulo, ciclo, S1..S4, conteos, estados con texto e icono y acumulado", () => {
  [true, false].forEach((dark) => {
    const txt = sinTags(html(modelo(A, RA, ROSTER), dark));
    assert.match(txt, /Cumplimiento del ciclo/);
    assert.match(txt, /Ciclo 1/);
    assert.match(txt, /Cumplimiento de semanas evaluadas 5 de 6 sesiones · 83 %/);
    assert.doesNotMatch(txt, /Acumulado/);
    assert.match(txt, /2 semanas evaluadas/);
    ["S1", "S2", "S3", "S4"].forEach((s) => assert.match(txt, new RegExp(s)));
    assert.match(txt, /3\/3/);
    assert.match(txt, /2\/3/);
    assert.match(txt, / Completa/);
    assert.match(txt, / Parcial/);
    assert.match(txt, / Pendiente · próxima/);
    assert.match(txt, /1 validada/);
    assert.match(txt, /Se utiliza la planificación actual\. Los cambios de rutina pueden afectar la comparación con semanas anteriores\./);
    assert.doesNotMatch(txt, /Calculado con|Si la rutina se modificó/);
  });
});

await test("render: no verificable => «Sin datos suficientes», sin conteo ni porcentaje inventado", () => {
  const h = html(modelo(A, RA, ROSTER, null), true);
  const txt = sinTags(h);
  assert.match(txt, /Cumplimiento de semanas evaluadas Sin datos suficientes/);
  assert.match(txt, /Sin datos suficientes/);
  assert.match(h, /data-estado="sin_datos"[\s\S]*?<svg[^>]*aria-hidden="true"/, "icono SVG decorativo junto al texto");
  assert.doesNotMatch(txt, /%/, "sin historial confiable no se muestra ningun porcentaje");
  const fila = h.slice(h.indexOf('data-qa="cumplimiento-semana-2"'), h.indexOf('data-qa="cumplimiento-semana-3"'));
  assert.match(fila, /data-estado="sin_datos"/);
  assert.match(sinTags(fila), /—/);
  assert.doesNotMatch(sinTags(fila), /\d\/3/);
});

await test("render: accesibilidad (seccion titulada, etiqueta por semana) y sin controles nuevos", () => {
  const h = html(modelo(A, RA, ROSTER), true);
  assert.match(h, /<section aria-labelledby="cumplimiento-ciclo-alu-a"/);
  assert.match(h, /<h3 id="cumplimiento-ciclo-alu-a"/);
  assert.match(h, /aria-label="S2, semana actual: 2 de 3 sesiones, Parcial"/);
  assert.match(h, /aria-label="S3: 0 de 3 sesiones, Pendiente · próxima"/);
  assert.doesNotMatch(h, /<button|<a |<input/);
  assert.match(h, /max-width:100%/);
  assert.equal(X.renderToStaticMarkup(X.React.createElement(X.CumplimientoCicloCard, { modelo: null })), "");
});

await test("demo sin login: varios alumnos, cargas y temas; sin Supabase ni almacenamiento", () => {
  const h = X.renderToStaticMarkup(X.React.createElement(X.CumplimientoCicloDemo));
  assert.match(h, /Datos ficticios · sin login/);
  assert.match(h, /Ana \(ciclo en curso\)/);
  assert.match(h, /Bruno \(alta reciente\)/);
  assert.match(h, /Cumplimiento del ciclo/);
  assert.match(h, /role="radiogroup"/);
  const src = ["components/demo/CumplimientoCicloDemo.jsx", "components/demo/cumplimientoCicloDemoData.js", "components/students/CumplimientoCicloCard.jsx", "components/students/cumplimientoCiclo.js"]
    .map(read).join("\n").replace(/\/\/.*$/gm, "");
  ["supabase", "fetch(", "localStorage", "sessionStorage", "App.jsx"].forEach((t) => assert.equal(src.includes(t), false, t));
  assert.match(read("components/demo/fichaAlumnoDemoMain.jsx"), /vista === 'cumplimiento' \? <CumplimientoCicloDemo \/> : <FichaAlumnoDemo \/>/);
});

// ---------------------------------------------------------------- PR #177: claridad (los valores no cambian)
const acumTxt = (m) => sinTags(html(m, true)).match(/Cumplimiento de semanas evaluadas (.*?) (\d+ semanas? evaluadas?|El historial|Todavía)/);
await test("PR #177: 5/8 = 63 % y 1/3 = 33 % (mismos valores, nuevo encabezado), en claro y oscuro", () => {
  const r4 = rutina("rut-a", A, { semana_activa: 2, days: [{}, {}, {}, {}] });
  const filas8 = [ses(A, "rut-a", 1, 0), ses(A, "rut-a", 1, 1), ses(A, "rut-a", 1, 2), ses(A, "rut-a", 1, 3), ses(A, "rut-a", 2, 1)];
  const m8 = modelo(A, r4, filas8);
  assert.deepEqual(m8.acumulado, { completados: 5, programados: 8, pct: 63, semanas: 2 });
  const r3 = rutina("rut-b", B, { semana_activa: 1 });
  const m3 = modelo(B, r3, [ses(B, "rut-b", 1, 0)]);
  assert.deepEqual(m3.acumulado, { completados: 1, programados: 3, pct: 33, semanas: 1 });
  [true, false].forEach((dark) => {
    const t8 = sinTags(html(m8, dark)), t3 = sinTags(html(m3, dark));
    assert.match(t8, /Cumplimiento de semanas evaluadas 5 de 8 sesiones · 63 % 2 semanas evaluadas/);
    assert.match(t3, /Cumplimiento de semanas evaluadas 1 de 3 sesiones · 33 % 1 semana evaluada/);
  });
});

await test("PR #177: una semana futura no cambia el porcentaje (ni aunque se le agreguen semanas futuras pendientes)", () => {
  const base = modelo(B, rutina("rut-b", B, { semana_activa: 1 }), [ses(B, "rut-b", 1, 0)]);
  assert.equal(base.semanas.filter((s) => s.futura).length, 3);
  assert.ok(base.semanas.filter((s) => s.futura).every((s) => s.pctBarra === null));
  assert.equal(acumTxt(base)[1], "1 de 3 sesiones · 33 %");
});

await test("PR #177: no verificables sin porcentajes inventados (ni en semanas ni en el encabezado)", () => {
  const r3 = rutina("rut-a", A, { semana_activa: 3 });
  const m = modelo(A, r3, ROSTER.concat([ses(A, "rut-a", 3, null)]));
  const h = html(m, false);
  [2, 3].forEach((w) => {
    const ini = h.indexOf('data-qa="cumplimiento-semana-' + w + '"');
    const fila = sinTags(h.slice(ini, h.indexOf("</li>", ini)));
    assert.match(fila, /Sin datos suficientes/);
    assert.doesNotMatch(fila, /%|\d\/3/);
  });
  assert.equal(acumTxt(m)[1], "3 de 3 sesiones · 100 %", "el encabezado solo suma la semana demostrada");
  const sinHist = sinTags(html(modelo(A, RA, ROSTER, null), false));
  assert.doesNotMatch(sinHist, /%/);
});

await test("cableado: App -> CoachStudentsMain -> StudentsSection -> StudentDetailPanel (solo entrenador)", () => {
  const app = read("App.jsx");
  const studentsProps = app.slice(app.indexOf("studentsProps: {"), app.indexOf("studentsProps: {") + 6000);
  assert.match(studentsProps, /historiaCompleta: coachHistoriaCompleta,/);
  assert.match(read("components/coach/CoachStudentsMain.jsx"), /historiaCompleta=\{historiaCompleta\}/);
  const ss = read("components/students/StudentsSection.jsx");
  assert.match(ss, /historiaCompleta = null,/);
  assert.match(ss, /modeloCumplimientoCiclo\(\{ alumnoId: a\.id, rutina: rutinaActiva, sesiones: sesionesForAlumno\(a\), historiaCompleta: historiaCompleta \}\)/);
  assert.match(ss, /cumplimientoCiclo=\{cumplimientoCiclo\}/);
  assert.match(read("components/students/StudentDetailPanel.jsx"), /<CumplimientoCicloCard\s+modelo=\{cumplimientoCiclo\}/);
  // vistas del alumno: no usan la tarjeta
  const alumnoViews = fs.readdirSync(path.join(ROOT, "components/student-plan")).concat(fs.readdirSync(path.join(ROOT, "components/student-progress")));
  assert.ok(alumnoViews.length > 0);
  ["components/student-plan", "components/student-progress"].forEach((d) => fs.readdirSync(path.join(ROOT, d)).forEach((f) => {
    assert.equal(read(d + "/" + f).includes("CumplimientoCiclo"), false, d + "/" + f);
  }));
});

await test("regresion: Dashboard/Progreso leen solo .sesiones/.progreso; rosterKey no cambia la adherencia del equipo", () => {
  const filas = [{ planState: "ok", pct: 60, adh: { actual: { completadas: 3, planificadas: 5, validadas: 1 }, previaMismo: { pct: 40 } } }];
  [{ sesiones: true, progreso: true }, { sesiones: false, progreso: true }, null].forEach((hc) => {
    const con = hc ? Object.assign({}, hc, { rosterKey: KEY }) : hc;
    assert.deepEqual(X.resumenAdherenciaEquipo(filas, con), X.resumenAdherenciaEquipo(filas, hc));
  });
  const metricas = read("components/coachProgresoMetrics.js");
  assert.match(metricas, /var hc = params\.historiaCompleta \|\| null;/);
  assert.equal(/hc\.rosterKey|historiaCompleta\.rosterKey/.test(metricas + read("components/CoachDashboard.jsx") + read("components/ProgresoView.jsx")), false);
});

console.log(n + " tests ok");
