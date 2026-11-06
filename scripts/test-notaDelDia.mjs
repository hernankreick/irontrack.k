// «Nota del día» (ficha del alumno, vista entrenador): integridad del borrador y del envío (H1, H2, H3).
//
//   node scripts/test-notaDelDia.mjs
//
// Datos ficticios y mocks: sin red ni Supabase. Cubre:
//   H1  el borrador de A nunca aparece en B; contraer/expandir A lo conserva; A -> B -> A lo descarta; un envío tardío de A no toca B.
//   H2  solo la fila insertada confirma el envío (contrato real de sb.setNota = sbFetch POST con return=representation): error HTTP (null),
//       falla de red (rechazo) y respuesta sin confirmar ([]) muestran error, conservan el texto y permiten reintentar.
//   H3  candado síncrono: dos toques en el mismo ciclo -> una sola solicitud; «Enviando…» y botón deshabilitado; se libera siempre.
// Las reglas son las de components/students/notaDelDia.js (las mismas que usa StudentsSection); el cableado se verifica en el fuente y
// el flujo en navegador real con scripts/qa/nota-dia.mjs.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resultadoEnvioNota, notaVisible, debeDescartarBorrador, crearEnviosNota, decidirResultadoNota } from "../components/students/notaDelDia.js";
import { createDemoMaSb } from "../components/demo/misAlumnosDemoData.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }
const msg = (es) => es;
const diferido = () => { let resolve, reject; const p = new Promise((a, b) => { resolve = a; reject = b; }); return { p, resolve, reject }; };
const tick = () => new Promise((r) => setImmediate(r));
const FILA = [{ id: "nota-1", alumno_id: "A", contenido: "x" }];

// ---------------------------------------------------------------------------------------------------------------------------------
// Simulación de la ficha con EXACTAMENTE las reglas de StudentsSection: borrador (texto + dueño), ficha abierta, envíos por alumno,
// error visible por alumno y avisos. Cada método replica un handler/efecto del componente.
function crearFicha(setNota) {
  const s = { texto: "", dueno: null, abierto: null, enviando: {}, error: null, avisos: [], solicitudes: [] };
  const envios = crearEnviosNota();
  const vista = () => ({ abierto: s.abierto, dueno: s.dueno });
  return {
    s,
    // efecto [alumnoActivo.id] + VER/Contraer
    abrir(id) {
      s.abierto = id;
      if (debeDescartarBorrador(s.dueno, id)) { s.dueno = null; s.texto = ""; }
      if (s.error && s.error.alumnoId !== id) s.error = null;
    },
    cerrar() { s.abierto = null; },
    // onNotaChange
    escribir(id, texto) { s.dueno = id; s.texto = texto; if (s.error && s.error.alumnoId === id) s.error = null; },
    // valor del textarea / props del panel
    visible(id) { return notaVisible(s.texto, s.dueno, id); },
    panel(id) { return { valor: notaVisible(s.texto, s.dueno, id), enviando: !!s.enviando[id], error: s.error && s.error.alumnoId === id ? s.error.texto : null }; },
    // onEnviarNota
    enviar(id, nombre) {
      return envios.enviar({
        alumnoId: id,
        texto: notaVisible(s.texto, s.dueno, id),
        ejecutar: (texto) => { s.solicitudes.push({ alumno_id: id, contenido: texto }); return setNota({ alumno_id: id, contenido: texto, texto }); },
        onInicio: () => { if (s.error && s.error.alumnoId === id) s.error = null; s.enviando[id] = true; },
        onResultado: (_id, r) => {
          delete s.enviando[id];
          const d = decidirResultadoNota({ alumnoId: id, resultado: r, vista: vista(), quien: nombre, msg });
          if (d.limpiarBorrador) { s.dueno = null; s.texto = ""; }
          if (d.error) s.error = d.error;
          s.avisos.push(d.aviso);
        },
      });
    },
  };
}

// ---------------------------------------------------------------- H2: contrato -------------------------------------------------------
await test("H2 contrato: fila insertada = éxito; null (error HTTP de sbFetch) = rechazada; [] u otra cosa = sin confirmar", () => {
  assert.deepEqual(resultadoEnvioNota(FILA), { ok: true });
  assert.deepEqual(resultadoEnvioNota(null), { ok: false, motivo: "rechazada" });
  assert.deepEqual(resultadoEnvioNota(undefined), { ok: false, motivo: "rechazada" });
  for (const r of [[], {}, "", "ok", 1, true, [null], [1], { id: 1 }]) assert.deepEqual(resultadoEnvioNota(r), { ok: false, motivo: "sin_confirmar" }, JSON.stringify(r));
});

await test("H2 contrato real en el fuente: setNota usa sbFetch POST con return=representation, y sbFetch devuelve null ante error HTTP sin lanzar", () => {
  const app = read("App.jsx");
  assert.match(app, /setNota: \(data\) => sbFetch\("notas", "POST", data\)/);
  const sbFetch = app.slice(app.indexOf("const sbFetch = async"), app.indexOf("const sbRequestStatus"));
  assert.match(sbFetch, /"Prefer": "return=representation"/);
  assert.match(sbFetch, /if\(!r\.ok\) \{[\s\S]*?return null;/);
  assert.match(sbFetch, /JSON\.parse\(text\)/, "JSON inválido rechaza la promesa");
});

// ---------------------------------------------------------------- H3: candado ---------------------------------------------------------
await test("H3 dos toques en el mismo ciclo -> UNA solicitud, un inicio, un resultado y un solo aviso", async () => {
  const d = diferido();
  let llamadas = 0;
  const f = crearFicha(() => { llamadas++; return d.p; });
  f.abrir("A"); f.escribir("A", "  Bajar carga  ");
  const p1 = f.enviar("A", "Ana"); const p2 = f.enviar("A", "Ana");
  assert.equal(llamadas, 1);
  assert.deepEqual(f.s.solicitudes, [{ alumno_id: "A", contenido: "Bajar carga" }], "se envía el texto recortado, mismo formato");
  assert.deepEqual(await p2, { ok: false, motivo: "en_curso", omitido: true });
  assert.equal(f.panel("A").enviando, true, "«Enviando…» y botón deshabilitado mientras está pendiente");
  d.resolve(FILA);
  assert.deepEqual(await p1, { ok: true });
  assert.equal(f.panel("A").enviando, false, "el botón se recupera tras el éxito");
  assert.deepEqual(f.s.avisos, ["Nota enviada ✓"]);
});

await test("H3 el candado se libera tras error HTTP, red y sin confirmar (y tras un throw síncrono)", async () => {
  for (const ejecutar of [async () => null, async () => { throw new TypeError("Failed to fetch"); }, async () => [], () => { throw new Error("sync"); }]) {
    const e = crearEnviosNota();
    const r = await e.enviar({ alumnoId: "A", texto: "x", ejecutar });
    assert.equal(r.ok, false);
    assert.equal(e.enCurso("A"), false);
    let n = 0;
    assert.deepEqual(await e.enviar({ alumnoId: "A", texto: "x", ejecutar: async () => { n++; return FILA; } }), { ok: true });
    assert.equal(n, 1, "se puede reintentar");
  }
});

await test("H3 texto vacío o solo espacios no genera solicitud; el candado es por alumno (B puede enviar mientras A espera)", async () => {
  const e = crearEnviosNota();
  let n = 0;
  assert.equal((await e.enviar({ alumnoId: "A", texto: "   ", ejecutar: async () => { n++; return FILA; } })).motivo, "vacia");
  assert.equal(n, 0);
  const d = diferido();
  const pa = e.enviar({ alumnoId: "A", texto: "a", ejecutar: () => d.p });
  assert.deepEqual(await e.enviar({ alumnoId: "B", texto: "b", ejecutar: async () => FILA }), { ok: true });
  d.resolve(FILA); await pa;
});

// ---------------------------------------------------------------- H2: flujos ----------------------------------------------------------
for (const [nombre, respuesta, esperado] of [
  ["error HTTP (null)", async () => null, "No se pudo enviar la nota. Revisá la conexión e intentá de nuevo."],
  ["fallo de red (rechazo)", async () => { throw new TypeError("Failed to fetch"); }, "No se pudo enviar la nota. Revisá la conexión e intentá de nuevo."],
  ["respuesta sin confirmar ([])", async () => [], "No se pudo confirmar el envío de la nota. Intentá de nuevo."],
]) {
  await test("H2 " + nombre + ": NO muestra éxito, conserva el texto, error visible en A y reintento exitoso", async () => {
    let modo = "falla";
    const f = crearFicha((p) => (modo === "falla" ? respuesta(p) : Promise.resolve(FILA)));
    f.abrir("A"); f.escribir("A", "Nota para A");
    const r = await f.enviar("A", "Ana");
    assert.equal(r.ok, false);
    assert.deepEqual(f.s.avisos, [esperado], "un único aviso, de error");
    assert.ok(!f.s.avisos.some((a) => a.includes("✓")));
    assert.deepEqual(f.panel("A"), { valor: "Nota para A", enviando: false, error: esperado });
    modo = "ok";
    assert.deepEqual(await f.enviar("A", "Ana"), { ok: true });
    assert.deepEqual(f.panel("A"), { valor: "", enviando: false, error: null }, "tras el reintento: borrador vacío y sin error");
    assert.deepEqual(f.s.avisos, [esperado, "Nota enviada ✓"]);
    assert.equal(f.s.solicitudes.length, 2);
  });
}

await test("H2 éxito confirmado: aviso de éxito y borrador vacío", async () => {
  const f = crearFicha(async () => FILA);
  f.abrir("A"); f.escribir("A", "ok");
  await f.enviar("A", "Ana");
  assert.deepEqual(f.s.avisos, ["Nota enviada ✓"]);
  assert.equal(f.visible("A"), "");
});

// ---------------------------------------------------------------- H1 ----------------------------------------------------------------
await test("H1 escribir en A, abrir B: el campo de B está vacío y enviar desde B no manda el texto de A", async () => {
  const f = crearFicha(async () => FILA);
  f.abrir("A"); f.escribir("A", "Privado de A");
  assert.equal(f.visible("A"), "Privado de A");
  f.cerrar(); f.abrir("B");
  assert.equal(f.visible("B"), "");
  assert.equal(f.s.texto, "", "el borrador de A se descartó");
  assert.equal((await f.enviar("B", "Beto")).motivo, "vacia");
  assert.equal(f.s.solicitudes.length, 0);
});

await test("H1 sin pasar por «cerrar»: abrir B directamente con A abierta también descarta el borrador (y la vista lo oculta antes del efecto)", () => {
  const f = crearFicha(async () => FILA);
  f.abrir("A"); f.escribir("A", "Privado de A");
  assert.equal(notaVisible(f.s.texto, f.s.dueno, "B"), "", "primer render de B, antes del efecto: oculto");
  f.abrir("B");
  assert.equal(f.visible("B"), "");
});

await test("H1 volver a A después de B: vacío (comportamiento definido: no hay borradores por alumno)", () => {
  const f = crearFicha(async () => FILA);
  f.abrir("A"); f.escribir("A", "Privado de A");
  f.abrir("B"); f.abrir("A");
  assert.equal(f.visible("A"), "");
});

await test("H1 contraer y expandir la MISMA ficha conserva el borrador", () => {
  const f = crearFicha(async () => FILA);
  f.abrir("A"); f.escribir("A", "Sigue acá");
  f.cerrar(); f.abrir("A");
  assert.equal(f.visible("A"), "Sigue acá");
  f.cerrar(); f.cerrar(); f.abrir("A");
  assert.equal(f.visible("A"), "Sigue acá");
});

await test("H1 estado inicial vacío y cambios rápidos A -> B -> A -> B sin texto filtrado", () => {
  const f = crearFicha(async () => FILA);
  for (const id of ["A", "B", "C"]) assert.equal(f.visible(id), "");
  f.abrir("A"); f.escribir("A", "a1"); f.abrir("B"); f.escribir("B", "b1"); f.abrir("A");
  assert.equal(f.visible("A"), ""); assert.equal(f.visible("B"), "");
  f.escribir("A", "a2"); f.abrir("B");
  assert.equal(f.visible("B"), "");
});

await test("H1 éxito TARDÍO de A con la ficha de B abierta: no toca el borrador ni el estado de B; aviso con el nombre de A", async () => {
  const d = diferido();
  const f = crearFicha(() => d.p);
  f.abrir("A"); f.escribir("A", "Para A");
  const p = f.enviar("A", "Ana");
  f.abrir("B"); f.escribir("B", "Borrador de B");
  d.resolve(FILA); await p;
  assert.deepEqual(f.panel("B"), { valor: "Borrador de B", enviando: false, error: null });
  assert.deepEqual(f.s.avisos, ["Nota enviada ✓ · Ana"]);
  assert.deepEqual(f.s.solicitudes, [{ alumno_id: "A", contenido: "Para A" }], "la solicitud llevó el alumno y el texto de A");
});

await test("H1 error TARDÍO de A con la ficha de B abierta: ni error ni texto en B; aviso con el nombre de A", async () => {
  const d = diferido();
  const f = crearFicha(() => d.p);
  f.abrir("A"); f.escribir("A", "Para A");
  const p = f.enviar("A", "Ana");
  f.abrir("B");
  d.resolve(null); await p;
  assert.deepEqual(f.panel("B"), { valor: "", enviando: false, error: null });
  assert.deepEqual(f.s.avisos, ["No se pudo enviar la nota. Revisá la conexión e intentá de nuevo. · Ana"]);
  f.abrir("A");
  assert.deepEqual(f.panel("A"), { valor: "", enviando: false, error: null }, "A no restaura un texto anterior");
});

await test("H1 A -> B -> A con el envío de A pendiente y nuevo texto en A: el éxito tardío limpia solo si el borrador sigue siendo de A", async () => {
  // el textarea está en solo lectura mientras A envía; si se volvió a A y el dueño es A, lo enviado era lo visible
  assert.equal(decidirResultadoNota({ alumnoId: "A", resultado: { ok: true }, vista: { abierto: "A", dueno: "A" }, msg }).limpiarBorrador, true);
  assert.equal(decidirResultadoNota({ alumnoId: "A", resultado: { ok: true }, vista: { abierto: "B", dueno: "B" }, msg }).limpiarBorrador, false);
  assert.equal(decidirResultadoNota({ alumnoId: "A", resultado: { ok: true }, vista: { abierto: "A", dueno: null }, msg }).limpiarBorrador, false);
  assert.equal(decidirResultadoNota({ alumnoId: "A", resultado: { ok: false, motivo: "red" }, vista: { abierto: "A", dueno: "A" }, msg }).limpiarBorrador, false);
  assert.equal(decidirResultadoNota({ alumnoId: "A", resultado: { ok: false, motivo: "red" }, vista: { abierto: "B", dueno: "B" }, msg }).error, null);
});

// ---------------------------------------------------------------- cableado en el componente --------------------------------------------
await test("StudentsSection usa las reglas compartidas, el contrato y el mismo payload de siempre", () => {
  const src = read("components/students/StudentsSection.jsx");
  assert.match(src, /import \{ crearEnviosNota, notaVisible, debeDescartarBorrador, decidirResultadoNota \} from '\.\/notaDelDia\.js';/);
  assert.match(src, /notaDiaInput=\{notaVisible\(notaDiaInput, notaDueno, a\.id\)\}/, "el textarea solo muestra el borrador del dueño");
  assert.match(src, /onNotaChange=\{function\(e\)\{ cambiarNota\(a, e\.target\.value\); \}\}/);
  assert.match(src, /onEnviarNota=\{function\(\)\{ enviarNota\(a\); \}\}/);
  assert.match(src, /notaEnviando=\{!!notaEnviando\[String\(a\.id\)\]\}/);
  assert.match(src, /notaError=\{notaError && notaError\.alumnoId === String\(a\.id\) \? notaError\.texto : null\}/);
  assert.match(src, /debeDescartarBorrador\(notaVistaRef\.current\.dueno, alumnoActivoIdStr\)/);
  assert.match(src, /\}, \[alumnoActivoIdStr\]\);/);
  assert.match(src, /texto: notaVisible\(notaDiaInput, notaDueno, id\)/, "se envía lo que se ve, nunca un borrador de otro alumno");
  const payload = src.slice(src.indexOf("return sb.setNota({"), src.indexOf("onInicio:"));
  for (const k of ["alumno_id: a.id", "entrenador_id: ENTRENADOR_ID", "contenido: texto", "texto: texto", 'fecha: new Date().toLocaleDateString("es-AR")']) assert.ok(payload.includes(k), k);
  assert.doesNotMatch(src, /toast2\("Error al enviar nota"\)/, "ya no hay aviso de error sin traducir ni éxito sin verificar");
  assert.doesNotMatch(src, /await sb\.setNota/, "el resultado pasa siempre por resultadoEnvioNota");
});

await test("StudentDetailPanel pasa saving/error/darkMode al panel de notas en ambas ramas (con y sin rutina)", () => {
  const src = read("components/students/StudentDetailPanel.jsx");
  assert.equal((src.match(/saving=\{notaEnviando\}/g) || []).length, 2);
  assert.equal((src.match(/error=\{notaError\}/g) || []).length, 2);
});

// ---------------------------------------------------------------- render del panel ------------------------------------------------------
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-nota-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents: 'import React from "react"; import { renderToStaticMarkup } from "react-dom/server";' +
      'import StudentNotesPanel from "./components/students/StudentNotesPanel.jsx";' +
      'import StudentDetailPanel from "./components/students/StudentDetailPanel.jsx";' +
      "export { React, renderToStaticMarkup, StudentNotesPanel, StudentDetailPanel };",
    resolveDir: ROOT, sourcefile: "nota-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, StudentNotesPanel, StudentDetailPanel } = await import(pathToFileURL(outfile).href);
const h = React.createElement;
const base = { alumno: { id: "A", nombre: "Ana" }, msg, textMain: "#fff", textMuted: "#999", bgSub: "#111", border: "#333", onChange() {}, onSave() {} };
const boton = (html) => html.match(/<button[^>]*data-qa="nota-dia-enviar"[^>]*>([^<]*)<\/button>/);
const area = (html) => html.match(/<textarea[^>]*>/)[0];

await test("H3 panel: sin envío -> «Enviar nota» habilitado y textarea editable", () => {
  const html = renderToStaticMarkup(h(StudentNotesPanel, Object.assign({}, base, { nota: "hola" })));
  const b = boton(html);
  assert.equal(b[1], "Enviar nota");
  assert.doesNotMatch(b[0], /disabled/);
  assert.doesNotMatch(area(html), /readonly/i);
  assert.doesNotMatch(html, /role="alert"/);
});

await test("H3 panel: enviando -> «Enviando…», botón deshabilitado con aria-busy y textarea de solo lectura", () => {
  const html = renderToStaticMarkup(h(StudentNotesPanel, Object.assign({}, base, { nota: "hola", saving: true })));
  const b = boton(html);
  assert.equal(b[1], "Enviando…");
  assert.match(b[0], /disabled=""/);
  assert.match(b[0], /aria-busy="true"/);
  assert.match(area(html), /readonly=""/i);
});

await test("H2 panel: error visible (role=alert) con contraste AA en ambos temas", () => {
  for (const [dark, color] of [[true, "#f87171"], [false, "#b91c1c"]]) {
    const html = renderToStaticMarkup(h(StudentNotesPanel, Object.assign({}, base, { nota: "hola", error: "No se pudo enviar la nota.", darkMode: dark })));
    assert.match(html, new RegExp('role="alert"[^>]*style="[^"]*color:' + color + '[^"]*"[^>]*>No se pudo enviar la nota\\.<'));
  }
});

await test("StudentDetailPanel (rama sin rutina) propaga «Enviando…» y el error al panel", () => {
  const html = renderToStaticMarkup(h(StudentDetailPanel, { alumno: { id: "A", nombre: "Ana" }, rutinaActiva: null, msg, notaDiaInput: "x", notaEnviando: true, notaError: "Falló", onAssignRoutine() {}, onNotaChange() {}, onEnviarNota() {} }));
  assert.equal(boton(html)[1], "Enviando…");
  assert.match(html, /role="alert"[^>]*>Falló</);
});

// ---------------------------------------------------------------- demo (Preview) ----------------------------------------------------------
await test("Demo «Mis alumnos»: setNota simulado respeta el contrato real en sus 4 modos y no usa red", async () => {
  let modo = "ok";
  const recibidas = [];
  const sb = createDemoMaSb(undefined, { notaModo: () => modo, notaDemoraMs: 0, onNota: (r) => recibidas.push(r) });
  const payload = { alumno_id: "demo-x", contenido: "n", texto: "n" };
  assert.deepEqual(resultadoEnvioNota(await sb.setNota(payload)), { ok: true });
  assert.equal(recibidas.length, 1);
  modo = "http"; assert.equal(await sb.setNota(payload), null);
  modo = "sin_confirmar"; assert.deepEqual(await sb.setNota(payload), []);
  modo = "red"; await assert.rejects(sb.setNota(payload), TypeError);
  assert.equal(recibidas.length, 1, "solo el envío OK llega al servidor simulado");
  const src = read("components/demo/misAlumnosDemoData.js");
  assert.doesNotMatch(src.slice(src.indexOf("setNota:")), /fetch\(|supabase/i);
});

console.log("\n" + count + " pruebas OK");
