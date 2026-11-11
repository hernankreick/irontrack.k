// Vista previa de video en «Agregar ejercicios»:  node scripts/test-addExercisePreviewVideo.mjs
// Renderiza el selector REAL (AddExerciseModal) y comprueba: boton solo con video valido, resolucion catalogo/personalizado/override,
// aislamiento del evento (no toca la seleccion) y modal de video por encima del selector. El flujo en navegador esta en scripts/qa/add-exercise-video.mjs.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-addexvideo-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import AddExerciseModal, { getAddExercisePreviewVideoId } from "./components/modals/AddExerciseModal.jsx";' +
      'import VideoModal from "./components/ui/VideoModal.jsx";' +
      'import { EX } from "./lib/exerciseStaticData.js";' +
      'import { normalizeLibraryExercise } from "./lib/exerciseResolve.js";' +
      "export { React, renderToStaticMarkup, AddExerciseModal, getAddExercisePreviewVideoId, VideoModal, EX, normalizeLibraryExercise };",
    resolveDir: ROOT, sourcefile: "addex-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  define: { "process.env.NODE_ENV": '"production"' },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, AddExerciseModal, getAddExercisePreviewVideoId, VideoModal, EX, normalizeLibraryExercise } = await import(pathToFileURL(outfile).href);
const h = React.createElement;
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const cat = EX.map((e) => normalizeLibraryExercise(e, { catalog: true }));
const custom = (o) => normalizeLibraryExercise({ id: "c1", name: "Mi ejercicio", nameEn: "Mine", pattern: "core", muscle: "Core", equip: "Libre", ...o }, { catalog: false });
const base = (allEx, extra = {}) => ({
  addExModal: true, addExSearch: "", setAddExSearch() {}, addExPat: null, setAddExPat() {}, addExMuscle: null, setAddExMuscle() {},
  addExSelectedIds: [], setAddExSelectedIds() {}, allEx, coachDesktopNavHidden: true, darkMode: true, es: true, lang: "es",
  msg: (a, b) => a, btn: () => ({}), inp: {}, bgCard: "#111", border: "#222", textMuted: "#999", onClose() {}, onConfirm() {},
  onPreviewVideo() {}, videoOverrides: {}, ...extra,
});
const render = (props) => renderToStaticMarkup(h(AddExerciseModal, props));
const count_ = (html) => (html.match(/data-add-ex-preview=/g) || []).length;

await test("ejercicio con video del catalogo: muestra boton accesible con el nombre", () => {
  const html = render(base([cat[0]]));
  assert.equal(count_(html), 1);
  assert.match(html, new RegExp('aria-label="Ver video de ' + cat[0].name.replace(/[()]/g, "\\$&")));
});

await test("ejercicio sin video, con video vacio o no reproducible: sin boton", () => {
  assert.equal(count_(render(base([custom({})]))), 0, "sin video");
  assert.equal(count_(render(base([custom({ video_url: "   " })]))), 0, "vacio");
  assert.equal(count_(render(base([custom({ video_url: "https://vimeo.com/123456" })]))), 0, "no YouTube (no hay reproductor)");
  assert.equal(count_(render(base([custom({ video_url: "https://www.youtube.com/watch?v=" })]))), 0, "id vacio");
  assert.ok(!/aria-disabled="true"|Video no disponible/.test(render(base([custom({})]))), "no se dibuja un boton de video deshabilitado");
});

await test("ejercicio personalizado con video propio y override del coach", () => {
  const c = custom({ video_url: "https://youtu.be/AbCdEfGhIjK" });
  assert.equal(getAddExercisePreviewVideoId(c, {}), "AbCdEfGhIjK");
  assert.equal(count_(render(base([c]))), 1);
  assert.equal(getAddExercisePreviewVideoId(cat[0], { [cat[0].id]: "https://www.youtube.com/watch?v=OVERRIDE123" }), "OVERRIDE123", "el override gana");
  assert.equal(getAddExercisePreviewVideoId(custom({}), { c1: "https://www.youtube.com/watch?v=OVERRIDE123" }), "OVERRIDE123", "override sobre ejercicio sin video");
  assert.equal(getAddExercisePreviewVideoId(cat[0], { [cat[0].id]: "https://example.com/x" }), null, "override invalido no se reproduce");
});

await test("todo el catalogo con video: un boton por ejercicio; sin onPreviewVideo no hay botones", () => {
  const withVid = cat.filter((e) => getAddExercisePreviewVideoId(e, {}));
  assert.equal(count_(render(base(cat))), withVid.length);
  assert.ok(withVid.length > 100);
  assert.equal(count_(render(base(cat, { onPreviewVideo: undefined }))), 0);
});

await test("el evento del boton no llega a la fila (seleccion intacta) y el mecanismo de seleccion no cambia", () => {
  const src = read("components/modals/AddExerciseModal.jsx");
  const span = src.slice(src.indexOf("data-add-ex-preview"), src.indexOf("<ExerciseVideoPlayButton"));
  for (const ev of ["onClick", "onKeyDown", "onMouseDown", "onTouchStart"]) assert.match(span, new RegExp(ev + "=\\{stopRow\\}"), ev + " detenido");
  assert.match(src, /const stopRow = \(e\) => e\.stopPropagation\(\)/);
  // La fila conserva su toggle original por click y por Enter/Espacio.
  assert.equal((src.match(/prev\.includes\(ex\.id\)\?prev\.filter/g) || []).length, 2);
  assert.match(src, /e\.key==="Enter"\|\|e\.key===" "/);
});

await test("el selector no se desmonta ni cambia: el modal de video es un portal aparte, por encima del selector", () => {
  const sel = read("components/modals/AddExerciseModal.jsx");
  assert.match(sel, /zIndex:1200/);
  assert.ok(!sel.includes("VideoModal"), "el selector no embebe el modal (no pierde estado al abrirlo)");
  const vm = read("components/ui/VideoModal.jsx");
  assert.match(vm, /zIndex: 10000/);
  assert.match(vm, /createPortal\(/);
  assert.match(vm, /key !== "Escape"[\s\S]*stopPropagation/, "Escape cierra solo el video");
});

await test("VideoModal: nombre, iframe con controles, cierre >=44px accesible y enlace de respaldo; sin overflow horizontal", () => {
  const html = renderToStaticMarkup(h(VideoModal, { videoModal: { videoId: "AbCdEfGhIjK", nombre: "Press banca", wide: true }, setVideoModal() {} }));
  // createPortal no renderiza en SSR: se valida el codigo fuente.
  assert.equal(html, "");
  const vm = read("components/ui/VideoModal.jsx");
  assert.match(vm, /aria-label="Cerrar"/);
  assert.match(vm, /Abrir en YouTube/);
  assert.match(vm, /minHeight: 44/);
  assert.match(vm, /boxSizing: "border-box"/);
  assert.match(vm, /100dvh/);
});

await test("cableado: App y la demo pasan overrides y abren el VideoModal existente", () => {
  const app = read("App.jsx");
  assert.match(app, /videoOverrides=\{videoOverrides\}\s*onPreviewVideo=\{setVideoModal\}/);
  assert.match(read("components/demo/FichaAlumnoDemo.jsx"), /onPreviewVideo=\{setVideoModal\}/);
  assert.match(read("components/demo/FichaAlumnoDemo.jsx"), /<VideoModal videoModal=\{videoModal\}/);
});

console.log("\n" + count + " pruebas OK");
