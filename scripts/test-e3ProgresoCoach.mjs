// E3 — rediseño de Progreso del entrenador: lo que la vista muestra sale del núcleo (lib/metricas) y del modelo de E2.
//
//   node scripts/test-e3ProgresoCoach.mjs
//
// SSR con esbuild + react-dom/server (como test-coachDashStudents.mjs), datos FICTICIOS relativos a hoy, sin red ni Supabase.
// Cubre: clases del historial (primera marca / PR / iguala / por debajo), comparación entre sesiones, semanas completas / en curso /
// futuras, buscador de ejercicios (incluye los que ya no están en la rutina), Equipo colapsado, selector de alumnos, modo claro y
// oscuro (contraste) y controles táctiles >= 44 px. El desplazamiento, las hojas y los anchos 375/390/430/1280 los mide `npm run qa:ui`.
process.env.TZ = "America/New_York";

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(path.join(ROOT, f), "utf8");
const outfile = path.join(mkdtempSync(path.join(os.tmpdir(), "irontrack-e3-")), "bundle.mjs");
const { build } = await import("esbuild");
await build({
  stdin: {
    contents:
      'import React from "react";' +
      'import { renderToStaticMarkup } from "react-dom/server";' +
      'import ProgresoView from "./components/ProgresoView.jsx";' +
      'import { buildCoachProgresoModel } from "./components/coachProgresoMetrics.js";' +
      'import EjercicioHistorialCoach, { buildExerciseSessions } from "./components/coach/EjercicioHistorialCoach.jsx";' +
      'import ProgressExercisesCard, { ProgressExerciseList, filterExercises, exerciseLastLine } from "./components/progreso/ProgressExercisesCard.jsx";' +
      'import ProgressWeeklyVolumeCard, { volumeWeekStates } from "./components/progreso/ProgressWeeklyVolumeCard.jsx";' +
      'import ProgressTeamSection from "./components/progreso/ProgressTeamSection.jsx";' +
      'import ProgressAlumnoPicker from "./components/progreso/ProgressAlumnoPicker.jsx";' +
      'import ProgressHeader from "./components/progreso/ProgressHeader.jsx";' +
      'import ProgressSheet from "./components/progreso/ProgressSheet.jsx";' +
      'import { progresoTone } from "./components/progreso/progresoTone.js";' +
      'import { coachThemePalette } from "./components/coachThemePalette.js";' +
      'import * as Metricas from "./lib/metricas/index.js";' +
      "export { React, renderToStaticMarkup, ProgresoView, buildCoachProgresoModel, EjercicioHistorialCoach, buildExerciseSessions, ProgressExercisesCard, ProgressExerciseList, filterExercises, exerciseLastLine, ProgressWeeklyVolumeCard, volumeWeekStates, ProgressTeamSection, ProgressAlumnoPicker, ProgressHeader, ProgressSheet, progresoTone, coachThemePalette, Metricas };",
    resolveDir: ROOT, sourcefile: "e3-entry.jsx", loader: "jsx",
  },
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  loader: { ".js": "jsx" }, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
  banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
});
const X = await import(pathToFileURL(outfile).href);
const { React, renderToStaticMarkup, Metricas } = X;
const h = React.createElement;

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const hace = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const dmy = (n) => { const d = hace(n); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const iso = (n) => hace(n).toISOString();
const A = "ana", B = "beto";
const alumnos = [{ id: A, nombre: "Ana Díaz" }, { id: B, nombre: "Beto" }];
const allEx = [
  { id: "sq", name: "Sentadilla", pattern: "rodilla" },
  { id: "pm", name: "Press militar", pattern: "empuje" },
  { id: "plank", name: "Plancha", pattern: "core", duration: "45 seg" },
];
const rutinas = [
  { id: "r0", alumno_id: A, nombre: "Base", created_at: iso(120), datos: { days: [{ exercises: [{ id: "sq" }, { id: "pm" }] }] } },
  { id: "r1", alumno_id: A, nombre: "Fuerza", created_at: iso(40), datos: { ciclo_actual: 2, days: [{ exercises: [{ id: "sq" }, { id: "plank", reps: '45"' }] }] } },
];
const p = (ex, n, kg, reps, extra) => Object.assign({ alumno_id: A, ejercicio_id: ex, fecha: dmy(n), kg, reps, semana: 0 }, extra || {});
// created_at desc (como llega de Supabase): dentro de cada día la última serie primero
const rows = [
  p("sq", 2, 90, 5, { rutina_id: "r1", ciclo: 2 }), p("sq", 2, 87.5, 5, { rutina_id: "r1", ciclo: 2 }), p("sq", 2, 85, 5, { rutina_id: "r1", ciclo: 2 }),
  p("sq", 9, 85, 5, { rutina_id: "r1", ciclo: 2 }), p("sq", 9, 80, 5, { rutina_id: "r1", ciclo: 2 }),
  p("sq", 16, 80, 5, { rutina_id: "r1", ciclo: 2 }),
  p("sq", 23, 87.5, 3, { rutina_id: "r1", ciclo: 1 }),
  p("sq", 30, 87.5, 5, { rutina_id: "r1", ciclo: 1 }),
  p("sq", 60, 72.5, 5, { rutina_id: "r0" }),
  p("pm", 70, 40, 6, { rutina_id: "r0" }),
  p("plank", 3, 0, 45, { rutina_id: "r1" }), p("plank", 10, 10, 60, { rutina_id: "r1" }),
  p("sq", 5, 100, 5, { fecha: "basura" }),
];
const s = (aid, rid, n, dia, extra) => Object.assign({ alumno_id: aid, rutina_id: rid, fecha: dmy(n), created_at: iso(n), semana: 1, dia_idx: dia }, extra || {});
const sesiones = [s(A, "r1", 2, 0, { origen: "validada_coach" }), s(A, "r1", 2, 1), s(A, "r1", 9, 0), s(B, null, 1, 0)];
const params = (over) => Object.assign({ alumnos, sesionesGlobales: sesiones, progresoGlobal: { [A]: rows }, rutinasSBEntrenador: rutinas, allEx, periodId: "semanas4", alumnoSel: A, ejercicioSelId: "sq", diaIdx: 0, lang: "es" }, over || {});
const m = X.buildCoachProgresoModel(params());
const C = X.coachThemePalette(true), P = X.progresoTone(C, true);
const CL = X.coachThemePalette(false), PL = X.progresoTone(CL, false);

// ======================================================================= núcleo: historialPorDia
await test("historialPorDia: primera marca, PR, iguala y por debajo con la misma definición que eventosPR", () => {
  const indice = Metricas.indiceEjerciciosPorTiempo(allEx, rutinas);
  const hist = Metricas.historialPorDia(rows, "sq", { indiceTiempo: indice });
  assert.deepEqual(hist.map((x) => [x.kg, x.clase, x.recordPrevio]), [
    [72.5, "primera", null], [87.5, "pr", 72.5], [87.5, "iguala", 87.5], [80, null, 87.5], [85, null, 87.5], [90, "pr", 87.5],
  ]);
  const prDias = hist.filter((x) => x.clase === "pr").map((x) => x.dia).sort();
  assert.deepEqual(Metricas.eventosPR(rows, { indiceTiempo: indice }).filter((e) => e.ejercicio_id === "sq").map((e) => e.dia).sort(), prDias, "las mismas fechas que eventosPR");
  assert.deepEqual(Metricas.historialPorDia(rows, "plank", { indiceTiempo: indice }), [], "por tiempo: sin clases de carga");
});

// ======================================================================= historial por ejercicio
await test("sesiones del ejercicio: más reciente primero, series en orden de ejecución, mejor serie y comparación con la anterior", () => {
  const indice = m.indiceTiempo;
  const ses = X.buildExerciseSessions(rows, "sq", indice);
  assert.equal(ses.length, 6, "la fila con fecha inválida no aparece");
  assert.deepEqual(ses[0].sets.map((r) => r.kg), [85, 87.5, 90]);
  assert.deepEqual([ses[0].best.kg, ses[0].best.clase, ses[0].vsAnterior], [90, "pr", 5]);
  assert.deepEqual([ses[2].best.kg, ses[2].vsAnterior, ses[2].inicioCiclo], [80, -7.5, true], "ciclo 2 de la misma rutina tras el ciclo 1");
  assert.equal(ses[3].best.clase, "iguala");
  assert.equal(ses[5].best.clase, "primera");
  assert.equal(ses[5].vsAnterior, null);
  assert.equal(ses[0].vol, 85 * 5 + 87.5 * 5 + 90 * 5);
});

await test("historial (SSR): etiquetas PR / Iguala el récord / Primera marca / por debajo; récord del núcleo; ver más", () => {
  const html = renderToStaticMarkup(h(X.EjercicioHistorialCoach, { alumnoId: A, ejercicioId: "sq", progresoGlobal: { [A]: rows }, indiceTiempo: m.indiceTiempo, rutinasSBEntrenador: rutinas, currentRoutineId: "r1", lang: "es", C, P }));
  assert.match(html, /PR · \+2,5 kg/);
  assert.match(html, /Supera el récord anterior \(87,5 kg\) · \+5 kg vs sesión anterior/);
  assert.match(html, /Iguala el récord/);
  assert.match(html, /87,5 kg = récord: igualar no es PR · = vs sesión anterior/);
  assert.match(html, /7,5 kg por debajo del récord · −7,5 kg vs sesión anterior/);
  assert.match(html, /Inicio de ciclo/);
  assert.match(html, /Ver 1 sesiones más/);
  assert.match(html, />90 kg</, "récord = mejoresMarcas");
  assert.doesNotMatch(html, /100 × 5/, "la serie con fecha inválida no se muestra");
  const all = renderToStaticMarkup(h(X.EjercicioHistorialCoach, { alumnoId: A, ejercicioId: "pm", progresoGlobal: { [A]: rows }, indiceTiempo: m.indiceTiempo, rutinasSBEntrenador: rutinas, currentRoutineId: "r1", lang: "es", C, P }));
  assert.match(all, /Primera marca/);
  assert.match(all, /Rutina anterior \(Base\)/);
});

await test("historial de un ejercicio por tiempo: segundos, sin récord ni volumen de carga", () => {
  const html = renderToStaticMarkup(h(X.EjercicioHistorialCoach, { alumnoId: A, ejercicioId: "plank", progresoGlobal: { [A]: rows }, indiceTiempo: m.indiceTiempo, rutinasSBEntrenador: rutinas, currentRoutineId: "r1", lang: "es", C, P }));
  assert.match(html, /10 kg · 60 s/);
  assert.match(html, />45 s</);
  assert.match(html, /sin récord de carga/);
  assert.doesNotMatch(html, /PR ·|Primera marca|Iguala/);
  const vacio = renderToStaticMarkup(h(X.EjercicioHistorialCoach, { alumnoId: B, ejercicioId: "sq", progresoGlobal: {}, indiceTiempo: {}, lang: "es", C, P }));
  assert.match(vacio, /Sin registros de este ejercicio/);
});

// ======================================================================= ejercicios registrados y buscador
await test("ejercicios registrados: incluye los que ya no están en la rutina; última sesión y clase del núcleo", () => {
  const byId = Object.fromEntries(m.ejerciciosRegistrados.map((e) => [e.id, e]));
  assert.deepEqual(Object.keys(byId).sort(), ["plank", "pm", "sq"]);
  assert.deepEqual([byId.sq.enRutina, byId.sq.ultimaKg, byId.sq.ultimaReps, byId.sq.ultimaClase], [true, 90, 5, "pr"]);
  assert.equal(byId.pm.enRutina, false, "press militar ya no está en la rutina actual");
  assert.deepEqual([byId.plank.esTiempo, byId.plank.ultimaSegundos, byId.plank.ultimaKg], [true, 45, null]);
  assert.equal(m.ejerciciosRegistrados[0].id, "sq", "ordenados por última sesión");
  assert.match(X.exerciseLastLine(byId.plank, "es"), /^Última: 45 s · .* · por tiempo$/);
  assert.match(X.exerciseLastLine(byId.sq, "es"), /^Última: 90 kg × 5 · /);
});

await test("buscador: modo rutina/todos y búsqueda sin acentos ni mayúsculas; grupos en la hoja", () => {
  const list = m.ejerciciosRegistrados;
  assert.deepEqual(X.filterExercises(list, "rutina", "").map((e) => e.id), ["sq", "plank"]);
  assert.deepEqual(X.filterExercises(list, "todos", "MILITAR").map((e) => e.id), ["pm"]);
  assert.deepEqual(X.filterExercises(list, "todos", "plancha").map((e) => e.id), ["plank"]);
  assert.deepEqual(X.filterExercises([{ id: "x", name: "Remo inclinádo" }], "todos", "INCLINADO").map((e) => e.id), ["x"]);
  const html = renderToStaticMarkup(h(X.ProgressExerciseList, { ejercicios: list, initialMode: "todos", onOpenExercise() {}, lang: "es", C, P }));
  assert.match(html, /data-qa="grupo-rutina"[\s\S]*En la rutina actual · 2/);
  assert.match(html, /data-qa="grupo-fuera"[\s\S]*Ya no están en la rutina · 1[\s\S]*Press militar/);
  assert.match(html, /<label for="progreso-buscar-ejercicio"/);
  const card = renderToStaticMarkup(h(X.ProgressExercisesCard, { ejercicios: list, onOpenExercise() {}, onOpenList() {}, lang: "es", C, P }));
  assert.match(card, /aria-pressed="true"[^>]*>Rutina actual · 2/);
  assert.match(card, /Todos · 3/);
  assert.match(card, /Ver y buscar ejercicios \(3\)/);
});

// ======================================================================= tarjetas, volumen y equipo
await test("volumen por semana: completas, en curso (parcial) y futuras sin barra (nunca como dato)", () => {
  const bars = [{ v: 3900, s: "Semana 1" }, { v: 4300, s: "Semana 2" }, { v: 2100, s: "Semana 3" }, { v: 0, s: "Semana 4" }];
  assert.deepEqual(X.volumeWeekStates(bars, 2).map((w) => w.estado), ["completa", "completa", "en_curso", "futura"]);
  assert.deepEqual(X.volumeWeekStates(bars, null).map((w) => w.estado), ["completa", "completa", "completa", "completa"]);
  const html = renderToStaticMarkup(h(X.ProgressWeeklyVolumeCard, { volBars: bars, currentRoutineWeekIndex: 2, lang: "es", C, P }));
  assert.match(html, /data-estado="futura"[^>]*><span[^>]*>—</);
  assert.match(html, /Semana 3: 2\.100 kg \(en curso\); Semana 4: todavía no empezó/);
  assert.match(html, /En curso \(parcial\)/);
  assert.match(renderToStaticMarkup(h(X.ProgressWeeklyVolumeCard, { volBars: [{ v: 0, s: "Semana 1" }], currentRoutineWeekIndex: 0, lang: "es", C, P })), /Sin volumen registrado en este bloque/);
});

await test("tono de las comparaciones: sube = good, baja = bad, sin cambio = neutral (nunca verde un 0)", () => {
  const cero = X.buildCoachProgresoModel(params({ sesionesGlobales: [], progresoGlobal: {} }));
  const ad = cero.alumnoChips.find((c) => c.key === "alumnoAdherence");
  assert.equal(ad.tone, "neutral");
  const toneOf = (mm, k) => mm.alumnoChips.find((c) => c.key === k).tone;
  assert.deepEqual([m.prsPeriod, m.prsPrev, toneOf(m, "alumnoPrs")], [1, 1, "neutral"], "1 PR vs 1 antes: sin cambio");
  const mas = X.buildCoachProgresoModel(params({ progresoGlobal: { [A]: rows.concat([p("sq", 1, 95, 3, { rutina_id: "r1", ciclo: 2 })]) } }));
  assert.deepEqual([mas.prsPeriod, toneOf(mas, "alumnoPrs")], [2, "good"]);
});

await test("última sesión: la más reciente completada; el mismo día gana la realizada a la validada", () => {
  assert.deepEqual([m.ultimaSesion.diasAtras, m.ultimaSesion.diaIdx, m.ultimaSesion.validada], [2, 1, false]);
  const soloValidada = X.buildCoachProgresoModel(params({ sesionesGlobales: [s(A, "r1", 4, 2, { origen: "validada_coach" }), s(A, "r1", 6, 0, { estado: "pendiente" })] }));
  assert.deepEqual([soloValidada.ultimaSesion.diasAtras, soloValidada.ultimaSesion.validada], [4, true]);
  assert.equal(X.buildCoachProgresoModel(params({ sesionesGlobales: [] })).ultimaSesion, null);
});

await test("Equipo: colapsado por defecto (sin ranking renderizado), abierto con ranking y ver más", () => {
  const ranking = Array.from({ length: 7 }, (_, i) => ({ id: "a" + i, n: "Alumno " + i, p: 90 - i * 10, completed: 9 - i, planned: 12, validadas: 0 }));
  const chips = [{ key: "teamAdherence", val: "72%", value: 72, delta: "↓ 3% vs período anterior", tone: "bad" }, { key: "teamStalled", val: "2", value: 2, delta: "Sin mejora", tone: "warn" }];
  const line = (c, pl) => c + "/" + pl + " sesiones completadas";
  const cerrado = renderToStaticMarkup(h(X.ProgressTeamSection, { teamChips: chips, ranking, rankingSessionsLine: line, lang: "es", C, P }));
  assert.match(cerrado, /aria-expanded="false"/);
  assert.match(cerrado, /Adherencia 72% · 2 estancados · ranking/);
  assert.doesNotMatch(cerrado, /Alumno 0/);
  const abierto = renderToStaticMarkup(h(X.ProgressTeamSection, { teamChips: chips, ranking, rankingSessionsLine: line, defaultOpen: true, lang: "es", C, P }));
  assert.match(abierto, /aria-controls="progreso-equipo-panel"/);
  assert.equal((abierto.match(/<li /g) || []).length, 5);
  assert.match(abierto, /Ver ranking completo \(7\)/);
  assert.match(abierto, new RegExp("color:" + P.bad + ";line-height:1.35\">↓ 3%"), "delta del equipo con el tono legible");
});

await test("selector de alumnos: estancados primero, adherencia del período o «Sin rutina asignada», seleccionado marcado", () => {
  const html = renderToStaticMarkup(h(X.ProgressAlumnoPicker, { alumnos, selectedId: A, stalledIds: [B], adherenciaRows: [{ id: A, p: 67 }], routineNameFor: (id) => (id === A ? "Fuerza" : null), onSelect() {}, lang: "es", C, P }));
  assert.match(html, /Estancados · sin PR en 3 semanas[\s\S]*Beto[\s\S]*Todos · A–Z/);
  assert.match(html, /aria-current="true"[\s\S]*?Ana Díaz[\s\S]*?Fuerza/);
  assert.match(html, /Sin rutina asignada/);
  assert.match(html, /<label for="progreso-buscar-alumno"/);
});

await test("encabezado compacto: alumno y período (select de 3 opciones, 16 px para no hacer zoom en iOS)", () => {
  const opts = [{ id: "semanas4", label: "4 semanas", short: "4 sem" }, { id: "semanas8", label: "8 semanas", short: "8 sem" }, { id: "meses3", label: "3 meses", short: "3 meses" }];
  const html = renderToStaticMarkup(h(X.ProgressHeader, { compact: true, lang: "es", C, P, alumnoName: "Ana", alumnoInitials: "AD", alumnoSub: "Fuerza · Semana 2 de 4", periodOpts: opts, periodo: "semanas8", setPeriodo() {}, onOpenAlumnos() {}, isUnder768: true }));
  assert.match(html, /data-qa="progreso-header-compacto"/);
  assert.equal((html.match(/<option /g) || []).length, 3);
  assert.match(html, /<option value="semanas8" selected="">8 sem/);
  assert.match(html, /font-size:16px/);
  const full = renderToStaticMarkup(h(X.ProgressHeader, { compact: false, lang: "es", C, P, alumnoName: "Ana", alumnoInitials: "AD", alumnoSub: "x", periodOpts: opts, periodo: "semanas4", setPeriodo() {}, onOpenAlumnos() {}, isUnder768: true }));
  assert.match(full, /role="group" aria-label="Período"/);
  assert.equal((full.match(/aria-pressed="true"/g) || []).length, 1);
});

// ======================================================================= modo claro / oscuro y accesibilidad
function lum(hex) {
  const c = hex.replace("#", "").match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((u, v) => v - u); return (x + 0.05) / (y + 0.05); };

await test("contraste >= 4,5:1 del texto chico sobre las tarjetas, en modo oscuro y claro", () => {
  for (const [CC, PP, modo] of [[C, P, "oscuro"], [CL, PL, "claro"]]) {
    for (const k of ["muted", "text2", "good", "bad", "warn", "accentText"]) {
      for (const bg of [CC.card, CC.bg, CC.cardDark]) {
        assert.ok(ratio(PP[k], bg) >= 4.5, modo + " " + k + " " + PP[k] + " sobre " + bg + " = " + ratio(PP[k], bg).toFixed(2));
      }
    }
    assert.ok(ratio(PP.prText, PP.prBg) >= 4.5, modo + " PR");
    assert.ok(ratio(PP.accentSoftText, PP.accentSoft) >= 4.5, modo + " acento suave");
    assert.ok(ratio("#ffffff", CC.blue) >= 4.5 || modo === "oscuro", modo + " botón activo");
  }
});

await test("ProgresoView (SSR) en modo claro: usa la paleta clara existente y ningún gris ilegible", () => {
  const html = renderToStaticMarkup(h(X.ProgresoView, { alumnos, sesionesGlobales: sesiones, progresoGlobal: { [A]: rows }, rutinasSBEntrenador: rutinas, allEx, darkMode: false }));
  assert.match(html, /background:#ffffff/);
  assert.doesNotMatch(html, /#71717a/, "el gris de la paleta (3,9:1) no se usa para texto");
  assert.doesNotMatch(html, /#0a0a0f;color/, "sin fondo oscuro en modo claro");
  const dark = renderToStaticMarkup(h(X.ProgresoView, { alumnos, sesionesGlobales: sesiones, progresoGlobal: { [A]: rows }, rutinasSBEntrenador: rutinas, allEx, darkMode: true }));
  assert.doesNotMatch(dark, /color:#71717a/);
});

await test("controles táctiles: todos los botones y selects de Progreso, hojas y tarjetas miden >= 44 px", () => {
  const htmls = [
    renderToStaticMarkup(h(X.ProgresoView, { alumnos, sesionesGlobales: sesiones, progresoGlobal: { [A]: rows }, rutinasSBEntrenador: rutinas, allEx })),
    renderToStaticMarkup(h(X.ProgressTeamSection, { teamChips: m.teamChips, ranking: m.ranking.concat(m.ranking, m.ranking, m.ranking, m.ranking, m.ranking), rankingSessionsLine: () => "x", defaultOpen: true, lang: "es", C, P })),
    renderToStaticMarkup(h(X.ProgressExerciseList, { ejercicios: m.ejerciciosRegistrados, onOpenExercise() {}, lang: "es", C, P })),
    renderToStaticMarkup(h(X.ProgressAlumnoPicker, { alumnos, selectedId: A, stalledIds: [], adherenciaRows: [], routineNameFor: () => null, onSelect() {}, lang: "es", C, P })),
    renderToStaticMarkup(h(X.ProgressSheet, { title: "T", onClose() {}, closeLabel: "Cerrar", C, P, isUnder768: true }, h("p", null, "x"))),
    renderToStaticMarkup(h(X.EjercicioHistorialCoach, { alumnoId: A, ejercicioId: "sq", progresoGlobal: { [A]: rows }, indiceTiempo: m.indiceTiempo, lang: "es", C, P })),
  ];
  let n = 0;
  for (const html of htmls) {
    for (const tag of html.match(/<(button|select)\b[^>]*>/g) || []) {
      const st = (tag.match(/style="([^"]*)"/) || [])[1] || "";
      const mh = Number((st.match(/min-height:(\d+)px/) || [])[1] || 0);
      const hh = Number((st.match(/(?:^|;)height:(\d+)px/) || [])[1] || 0);
      // las filas de selección de puntos del gráfico de carga (ProgressLoadChart) usan un área de 44 px propia
      if (/data-qa-load/.test(tag)) continue;
      // .coach-tap: 44 x 44 en móvil por CSS global (AppGlobalStyles)
      if (/class="coach-tap"/.test(tag)) { assert.match(read("components/layout/AppGlobalStyles.jsx"), /\.coach-tap,\.cd-btn\{min-height:44px;min-width:44px\}/); n++; continue; }
      assert.ok(mh >= 44 || hh >= 44, "control < 44 px: " + tag.slice(0, 160));
      n++;
    }
  }
  assert.ok(n > 25, "se revisaron " + n + " controles");
});

await test("alcance: la vista no calcula métricas propias ni toca al alumno", () => {
  const v = read("components/ProgresoView.jsx");
  assert.doesNotMatch(v, /kg \* reps|parseFloat\(r\.kg\) \* |eventosPR\(|compararVolumen\(|adherencia\(/);
  for (const f of ["progreso/ProgressSummaryCards.jsx", "progreso/ProgressTeamSection.jsx", "progreso/ProgressExercisesCard.jsx", "progreso/ProgressWeeklyVolumeCard.jsx", "progreso/ProgressHeader.jsx"]) {
    assert.doesNotMatch(read("components/" + f), /eventosPR\(|compararVolumen\(|adherencia\(|volumenEnRango\(/, f);
  }
  assert.match(read("components/coach/EjercicioHistorialCoach.jsx"), /historialPorDia\(/);
  for (const f of ["App.jsx", "components/student-progress/progressMetrics.js"]) assert.doesNotMatch(read(f), /progreso\/Progress(Header|SummaryCards|Sheet)/, f);
});

console.log("\n" + count + " pruebas OK");
