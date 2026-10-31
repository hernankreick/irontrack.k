// «Mis alumnos» (Alumnos del entrenador) — mejora VISUAL: titulo, paleta neutra, bloque de rutina compacto, busqueda/chips y logica intacta.
//   node scripts/test-misAlumnosVisual.mjs
// SSR con esbuild + react-dom/server del CoachStudentsMain real; la interaccion en navegador la cubre scripts/qa/mis-alumnos-visual.mjs.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-mavis-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import CoachStudentsMain from "./components/coach/CoachStudentsMain.jsx";' +
      'import { alumnosPaleta } from "./components/students/alumnosPaleta.js";' +
      "export { React, renderToStaticMarkup, CoachStudentsMain, alumnosPaleta };",
    resolveDir: ROOT, sourcefile: "mavis-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const { React, renderToStaticMarkup, CoachStudentsMain, alumnosPaleta } = await import(pathToFileURL(outfile).href);
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const alumnos = [{ id: "a1", nombre: "Lucía Fernández", email: "lucia@ejemplo.com" }, { id: "a2", nombre: "Renata Domínguez", email: "renata@ejemplo.com" }];
const nop = () => {};
function render({ darkMode = true, routines, tokens = {} } = {}) {
  const props = {
    alumnos, coachAlumnosListaFiltrada: alumnos, coachAlumnosCounts: { todos: 2, activos: 1, inactivos: 0, sin_rutina: 1, baja: 0 },
    coachAlumnosFilter: "todos", coachAlumnosSearch: "", darkMode, es: true, msg: (e) => e, rutinasLoaded: true,
    routines: routines || [{ id: "r1", name: "Rutina inicial", days: [{}, {}] }, { id: "r2", name: "Fuerza 3 días", days: [{}, {}, {}] }],
    routineForAssign: { id: "r1", name: "Rutina inicial", days: [{}, {}] },
    bgCard: "#111", bgSub: "#222", border: "#333", textMain: "#fff", textMuted: "#94a3b8",
    getRutinaAsignadaAlumno: () => null, sesionesGlobales: [], progresoGlobal: {},
    ...tokens,
    setCoachAlumnosFilter: nop, setCoachAlumnosSearch: nop, setAssignRoutineId: nop, setAliasModal: nop, setNewAlumnoForm: nop,
    setNewAlumnoData: nop, setNewAlumnoErrors: nop, setCoachDialog: nop, toast2: nop, setChatModal: nop, setCoachCardMenuId: nop,
  };
  return renderToStaticMarkup(h(CoachStudentsMain, props));
}
const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

await test("titulo «Mis alumnos» (no mayusculas), 22 px, peso 750, sin letterSpacing", () => {
  const html = render();
  assert.match(strip(html), /Mis alumnos/);
  assert.ok(!/MIS ALUMNOS/.test(html));
  const h1 = html.match(/<h1[^>]*style="([^"]*)"/)[1];
  assert.match(h1, /font-size:22px/);
  assert.match(h1, /font-weight:750/);
  assert.ok(!/letter-spacing:[1-9]/.test(h1), h1);
  assert.match(strip(render()), /Mis alumnos/);
  const src = read("components/students/StudentsSection.jsx");
  assert.match(src, /msg\("Mis alumnos", "My athletes"\)/);
  assert.ok(!/MIS ALUMNOS/.test(src));
});

await test("paleta: mismos nombres de token, base D5 y bordes neutros (sin azul) en oscuro", () => {
  const d = alumnosPaleta(true), l = alumnosPaleta(false);
  const nombres = ["coachAluShell", "coachAluSurface", "coachAluSubtle", "coachAluBorderSoft", "coachAluTrack", "coachAluDropdown", "coachAluDropdownShadow", "coachAluGhostBtn"];
  assert.deepEqual(Object.keys(d).sort(), nombres.slice().sort());
  assert.deepEqual(Object.keys(l).sort(), nombres.slice().sort());
  assert.deepEqual([d.coachAluShell, d.coachAluSurface, d.coachAluSubtle, d.coachAluDropdown, d.coachAluGhostBtn], ["#0A0F1A", "#0D1424", "#101A2D", "#0D1424", "#101A2D"]);
  assert.equal(d.coachAluBorderSoft, "rgba(148,163,184,0.18)");
  assert.equal(d.coachAluTrack, "rgba(148,163,184,0.16)");
  assert.deepEqual([l.coachAluShell, l.coachAluSurface, l.coachAluSubtle, l.coachAluBorderSoft, l.coachAluTrack], ["#F1F5F9", "#FFFFFF", "#F8FAFC", "#E2E8F0", "#E2E8F0"]);
  for (const k of ["coachAluBorderSoft", "coachAluTrack", "coachAluShell", "coachAluSurface", "coachAluSubtle"]) assert.ok(!/59,\s*130,\s*246|37,\s*99,\s*235/.test(d[k]), k);
  const pal = read("components/students/studentCardPalette.js");
  const oscuro = pal.slice(pal.indexOf("if (darkMode)"), pal.indexOf("return {", pal.indexOf("if (darkMode)") + 20) + 400);
  assert.ok(!/border:\s*"rgba\(59,130,246/.test(oscuro), "el borde de la tarjeta en oscuro es neutro");
});

await test("CoachStudentsMain sobrescribe los tokens coachAlu* con alumnosPaleta(darkMode)", () => {
  const src = read("components/coach/CoachStudentsMain.jsx");
  assert.match(src, /import \{ alumnosPaleta \} from '\.\.\/students\/alumnosPaleta\.js'/);
  assert.match(src, /const pal = alumnosPaleta\(darkMode\)/);
  for (const k of ["BorderSoft", "Dropdown", "DropdownShadow", "GhostBtn", "Shell", "Subtle", "Surface", "Track"]) {
    assert.ok(src.includes("coachAlu" + k + "={pal.coachAlu" + k + "}"), k);
  }
  // Aunque App mande otros colores, el HTML usa los de la paleta (fondo del encabezado = coachAluShell).
  const html = render({ darkMode: true, tokens: { coachAluShell: "#ff00ff", coachAluSurface: "#00ff00", coachAluBorderSoft: "rgba(59,130,246,0.22)" } });
  assert.ok(!/#ff00ff|#00ff00|59,130,246,0\.22/i.test(html));
  assert.match(html, /#0A0F1A/i);
  const claro = render({ darkMode: false });
  assert.match(claro, /#F1F5F9/i);
});

await test("fondo de la pagina (CoachSectionRenderer) y sin margen negativo en StudentsSection", () => {
  const r = read("components/coach/CoachSectionRenderer.jsx");
  assert.match(r, /tab === "alumnos"[\s\S]{0,800}minHeight: "100dvh"[\s\S]{0,200}#0A0F1A[\s\S]{0,40}#F1F5F9/);
  const s = read("components/students/StudentsSection.jsx");
  assert.ok(!/marginLeft:showCoachDesktopShell\?0:-4/.test(s) && !/marginRight:showCoachDesktopShell\?0:-4/.test(s));
  assert.match(read("index.css"), /\.alu-pad\{padding:0 20px[^}]*\}\s*@media \(min-width:768px\)\{\.alu-pad\{padding:24px 24px/);
});

await test("bloque de rutina compacto: una fila con etiqueta corta, el select y el estado intactos", () => {
  const html = render();
  assert.ok(!/RUTINA QUE SE ASIGNA/.test(html));
  assert.match(strip(html), /Rutina a asignar/);
  assert.match(html, /<select[^>]*aria-labelledby="alu-rutina-label"/);
  assert.match(html, /<option[^>]*value="r1"[^>]*selected|<option[^>]*selected[^>]*value="r1"|value="r1"/);
  assert.match(strip(html), /Rutina inicial · 2 días/);
  assert.match(strip(html), /Fuerza 3 días · 3 días/);
  // sin color azul en la etiqueta y con el texto de ayuda disponible (title / aria-describedby)
  const etiqueta = html.match(/<span id="alu-rutina-label" style="([^"]*)"/)[1];
  assert.ok(!/#2563EB|color:#3B82F6/i.test(etiqueta), etiqueta);
  assert.match(html, /title="Creá o editá rutinas en RUTINAS/);
  assert.match(html, /id="alu-rutina-ayuda"/);
  const una = render({ routines: [{ id: "r1", name: "Unica", days: [] }] });
  assert.ok(!/<select/.test(una));
  assert.match(strip(una), /Rutina a asignar Unica/);
  const src = read("components/students/StudentsSection.jsx");
  assert.match(src, /value=\{routineForAssign\?\.id\|\|""\}/);
  assert.match(src, /setAssignRoutineId\(e\.target\.value\)/);
});

await test("busqueda primero y los chips de filtro (Todos, Activos, Inactivos, Sin rutina) con 44 px", () => {
  const html = render();
  assert.ok(html.indexOf('type="search"') > -1 && html.indexOf('type="search"') < html.indexOf('aria-pressed'));
  for (const t of ["Todos (2)", "Activos (1)", "Inactivos (0)", "Sin rutina (1)"]) assert.ok(strip(html).includes(t), t);
  const chips = [...html.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*style="([^"]*)"/g)];
  assert.ok(chips.length >= 4);
  for (const c of chips) assert.match(c[2], /min-height:44px/);
  const sel = chips.find((c) => c[1] === "true");
  assert.match(sel[2], /rgba\(59,130,246,0\.2\)/);
  assert.match(sel[2], /color:#93C5FD/);
  const sin = chips.find((c) => c[1] === "false");
  assert.ok(!/rgba\(59,130,246/.test(sin[2]));
  assert.match(read("components/students/StudentsSection.jsx"), /gap: ?8|display:"flex",gap:8,flexWrap:"wrap",marginTop:12/);
});

await test("tarjeta: misma informacion, nombre 17 px 700, correo 13 px, separacion 12 px, borde neutro", () => {
  const html = render();
  const s = strip(html);
  assert.ok(s.includes("Lucía Fernández") && s.includes("lucia@ejemplo.com") && s.includes("Renata Domínguez"));
  assert.match(html, /class="coach-stu-name" style="[^"]*font-size:17px;font-weight:700/);
  assert.match(html, /font-size:13px;color:#94a3b8;line-height:1\.3/);
  assert.match(html, /margin-bottom:12px/);
  assert.match(html, /1px solid rgba\(148,163,184,0\.18\)/);
});

await test("la logica no cambio: onVer, onChat, onAssignRoutine y setCoachAlumnosFilter siguen cableados igual", () => {
  const s = read("components/students/StudentsSection.jsx");
  assert.match(s, /setCoachAlumnosFilter\(chip\.k\)/);
  assert.match(s, /onAssignRoutine=\{function \(\) \{ abrirAsignacionRutina\(a\); \}\}/);
  assert.match(s, /onVer=\{/);
  assert.match(s, /onChat=\{/);
  assert.match(s, /setCoachAlumnosSearch\(e\.target\.value\)/);
  assert.match(s, /onClick=\{cargarAlumnos\}/);
  assert.match(s, /onClick=\{\(\)=>setAliasModal\(true\)\}/);
  assert.match(s, /onClick=\{\(\)=>setNewAlumnoForm\(true\)\}/);
  const c = read("components/students/StudentCard.jsx");
  assert.match(c, /onClick=\{onVer\}/);
  assert.match(c, /onClick=\{onChat\}/);
  assert.match(c, /onClick=\{onToggleMenu\}/);
  const m = read("components/coach/CoachStudentsMain.jsx");
  for (const k of ["setCoachAlumnosFilter", "setAssignRoutineId", "routineForAssign", "setChatModal", "setCoachDialog", "coachAlumnosListaFiltrada"]) assert.ok(m.includes(k + "={" + k + "}"), k);
});

console.log("\n" + count + " pruebas OK");
