// «Volumen por patrón» por rutina, ciclo y semana (Progreso del entrenador). Datos FICTICIOS (components/demo/volumenPatronDemoData.js).
// Las cifras esperadas se calculan aca, a mano, desde la ESPECIFICACION de la demo (HP_SESIONES), sin usar el codigo bajo prueba.
//   node scripts/test-volumenPatronHistorial.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCoachProgresoModel } from "../components/coachProgresoMetrics.js";
import { atribuirSeriesARutinas, listarRutinasConHistorial, semanaIndiceDeSerie } from "../lib/metricas/volumenPatronHistorial.js";
import { patternPartialLines } from "../components/progreso/progressCopy.js";
import { buildVolumenPatronDemoData, HP_ANA, HP_BETO, HP_CATALOGO, HP_SESIONES, HP_HUERFANAS } from "../components/demo/volumenPatronDemoData.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

const PATRON = Object.fromEntries(HP_CATALOGO.map((e) => [e.id, e.pattern]));
const KEYS = ["empuje", "traccion", "rodilla", "bisagra", "core"];
// Series cuyo respaldo es ambiguo (dos rutinas listan el ejercicio el mismo dia): NO se asignan a ninguna.
const AMBIGUAS = [{ ej: "hp-ohp", n: 28 }];

/** Esperado independiente: kg × reps × cantidad por patron de las sesiones de (alumno, rutina, ciclo, semana 1-based). */
function esperado(alumno, rutina, ciclo, semana) {
  const out = { empuje: 0, traccion: 0, rodilla: 0, bisagra: 0, core: 0 };
  HP_SESIONES.filter((s) => s.alumno === alumno && s.rutina === rutina && s.ciclo === ciclo && s.semana === semana).forEach((s) => {
    s.series.forEach(([ej, kg, reps, cant]) => {
      if (AMBIGUAS.some((a) => a.ej === ej && a.n === s.n)) return;
      out[PATRON[ej]] += kg * reps * cant;
    });
  });
  return out;
}

const data = buildVolumenPatronDemoData();
function modelo(alumno, patronSel, over) {
  return buildCoachProgresoModel(Object.assign({
    alumnos: data.alumnos, sesionesGlobales: data.sesionesGlobales, progresoGlobal: data.progresoGlobal,
    rutinasSBEntrenador: data.rutinasSBEntrenador, allEx: data.allEx, periodId: "todo", alumnoSel: alumno, diaIdx: 0,
    ejercicioSelId: null, lang: "es", historiaCompleta: data.historiaCompleta, patronSel: patronSel || null,
  }, over || {}));
}
const vols = (m) => Object.fromEntries(m.patronPatterns.map((p) => [p.key, p.vol]));
const sel = (rutinaId, ciclo, semana) => ({ rutinaId, ciclo, semana });

test("hay al menos dos rutinas de cuatro semanas con volumenes distintos por patron", () => {
  const r1 = KEYS.map((k) => esperado(HP_ANA, "hp-r-fuerza", 1, 1)[k]).join();
  const r2 = KEYS.map((k) => esperado(HP_ANA, "hp-r-hiper", 1, 1)[k]).join();
  assert.notEqual(r1, r2);
  assert.deepEqual(esperado(HP_ANA, "hp-r-fuerza", 1, 1), { empuje: 1200, traccion: 1200, rodilla: 1200, bisagra: 1500, core: 0 });
  assert.deepEqual(esperado(HP_ANA, "hp-r-hiper", 1, 1), { empuje: 1600, traccion: 1800, rodilla: 2400, bisagra: 2400, core: 450 });
});

test("rutina anterior (Fuerza base, ciclo 1): cada semana muestra solo sus series", () => {
  for (const semana of [1, 2, 3, 4]) {
    const m = modelo(HP_ANA, sel("hp-r-fuerza", 1, semana - 1));
    assert.equal(m.patronHistorial.rutinaId, "hp-r-fuerza");
    assert.equal(m.patronHistorial.semana, semana - 1);
    assert.deepEqual(vols(m), esperado(HP_ANA, "hp-r-fuerza", 1, semana), "S" + semana);
  }
});

test("semana incompleta (S3: 1 sesion) y semana sin sesiones (S4: 0) se informan sin inventar datos", () => {
  const m = modelo(HP_ANA, sel("hp-r-fuerza", 1, 0));
  assert.deepEqual(m.patronHistorial.semanas.map((w) => w.sesiones), [2, 3, 1, 0]); // S2 incluye la sesión del caso ambiguo (día 28)
  const s4 = modelo(HP_ANA, sel("hp-r-fuerza", 1, 3));
  assert.equal(s4.patronTotalVol, 0);
  assert.equal(s4.patronHistorial.sesionesSemana, 0);
  assert.equal(s4.patronHistorial.seriesSemana, 0);
});

test("rutina reiniciada: el ciclo 2 no se mezcla con el ciclo 1 (misma semana 1)", () => {
  const c1 = modelo(HP_ANA, sel("hp-r-fuerza", 1, 0));
  const c2 = modelo(HP_ANA, sel("hp-r-fuerza", 2, 0));
  assert.deepEqual(vols(c1), esperado(HP_ANA, "hp-r-fuerza", 1, 1));
  assert.deepEqual(vols(c2), esperado(HP_ANA, "hp-r-fuerza", 2, 1));
  assert.notDeepEqual(vols(c1), vols(c2));
  assert.deepEqual(c1.patronHistorial.ciclos.map((c) => c.value), [1, 2]);
  assert.equal(c2.patronHistorial.ciclo, 2);
  // el ciclo 2 trae un ejercicio de core que el ciclo 1 no tiene
  assert.equal(c2.patronPatterns.find((p) => p.key === "core").vol, 360);
  assert.equal(c1.patronPatterns.find((p) => p.key === "core").vol, 0);
});

test("rutina vigente (Hipertrofia): por defecto es la semana actual y coincide con el calculo de siempre", () => {
  const m = modelo(HP_ANA, null);
  assert.equal(m.patronHistorial.rutinaId, "hp-r-hiper");
  assert.equal(m.patronHistorial.esActual, true);
  assert.equal(m.patronHistorial.bloqueActual, true);
  assert.equal(m.patronHistorial.semana, 2); // semana_activa 3
  assert.deepEqual(vols(m), esperado(HP_ANA, "hp-r-hiper", 1, 3));
  assert.deepEqual(vols(m), { empuje: 1800, traccion: 0, rodilla: 2700, bisagra: 0, core: 0 });
});

test("rutina vigente: S1, S2 y S4 con la misma cifra que la barra de «Volumen por semana»", () => {
  for (const semana of [1, 2, 3, 4]) {
    const m = modelo(HP_ANA, sel("hp-r-hiper", 0, semana - 1));
    const e = esperado(HP_ANA, "hp-r-hiper", 1, semana);
    assert.deepEqual(vols(m), e, "S" + semana);
    if (semana <= 3) assert.equal(m.volBars[semana - 1].v, KEYS.reduce((a, k) => a + e[k], 0) + (semana === 2 ? 200 : 0), "barra S" + semana); // la barra cuenta TODAS las series del bloque (incluida la ambigua de 200 kg)
  }
});

test("serie ambigua (dos rutinas listan el mismo ejercicio el mismo dia): no entra en ninguna rutina", () => {
  const hiper = modelo(HP_ANA, sel("hp-r-hiper", 0, 1));
  const fuerza = modelo(HP_ANA, sel("hp-r-fuerza", 1, 1));
  const emp = (m) => m.patronPatterns.find((p) => p.key === "empuje");
  assert.equal(emp(hiper).vol, 4 * 10 * 42.5); // sin los 200 kg de press militar
  assert.equal(emp(fuerza).vol, 3 * 8 * 52.5);
  assert.ok(!emp(hiper).exercises.some((x) => x.ejercicio_id === "hp-ohp"));
  assert.ok(!emp(fuerza).exercises.some((x) => x.ejercicio_id === "hp-ohp"));
  const at = atribuirSeriesARutinas(data.progresoGlobal[HP_ANA], data.sesionesGlobales, HP_ANA);
  assert.equal(at.ambiguas, 1);
});

test("serie sin sesion que la respalde: no se asigna a una rutina historica y se informa", () => {
  assert.equal(HP_HUERFANAS.length, 1);
  const at = atribuirSeriesARutinas(data.progresoGlobal[HP_ANA], data.sesionesGlobales, HP_ANA);
  assert.equal(at.sinSesion, 1);
  const m = modelo(HP_ANA, sel("hp-r-fuerza", 2, 0));
  assert.equal(m.patronPatterns.find((p) => p.key === "rodilla").vol, 3 * 5 * 85); // sin la serie huerfana de 500 kg
  // la semana afectada se marca como NO confirmada (el contador es de ESA semana, no del historial completo)
  assert.equal(m.patronHistorial.parcial.semana, 1);
  assert.equal(m.patronHistorial.parcial.total, true);
  assert.equal(m.patronHistorial.semanas[0].parcial, 1);
  assert.deepEqual(m.patronHistorial.semanas.map((w) => w.parcial), [1, 0, 0, 0]);
  // otra semana del mismo ciclo sin series sueltas: confirmada
  const c1 = modelo(HP_ANA, sel("hp-r-fuerza", 1, 2));
  assert.equal(c1.patronHistorial.parcial.semana, 0);
  assert.equal(c1.patronHistorial.parcial.total, false);
  // en el bloque actual la serie sin respaldo sigue sumando como siempre y no se avisa
  assert.equal(modelo(HP_ANA, null).patronHistorial.parcial.total, false);
});

test("serie ambigua: la semana afectada queda NO confirmada, tambien en el bloque actual", () => {
  const f = modelo(HP_ANA, sel("hp-r-fuerza", 1, 1));
  assert.equal(f.patronHistorial.parcial.semana, 1);
  assert.deepEqual(f.patronHistorial.semanas.map((w) => w.parcial), [0, 1, 0, 0]);
  const h = modelo(HP_ANA, sel("hp-r-hiper", 0, 1));
  assert.equal(h.patronHistorial.parcial.semana, 1);
  assert.equal(h.patronHistorial.parcial.total, true);
  assert.equal(modelo(HP_ANA, sel("hp-r-hiper", 0, 0)).patronHistorial.parcial.total, false);
});

test("historial incompleto: toda semana queda NO confirmada aunque no haya series sueltas", () => {
  for (const s of [null, sel("hp-r-fuerza", 1, 2), sel("hp-r-hiper", 0, 0)]) {
    const m = modelo(HP_ANA, s, { historiaCompleta: { sesiones: true, progreso: false } });
    assert.equal(m.patronHistorial.parcial.historialIncompleto, true);
    assert.equal(m.patronHistorial.parcial.total, true);
    const m2 = modelo(HP_ANA, s, { historiaCompleta: { sesiones: false, progreso: true } });
    assert.equal(m2.patronHistorial.parcial.total, true);
  }
  assert.equal(modelo(HP_ANA, null).patronHistorial.parcial.historialIncompleto, false);
});

test("los avisos son comprensibles: dicen cuantas series, por que y que pasa con ellas (es/en/pt)", () => {
  const es = patternPartialLines("es", { semana: 2, sinSemana: 1, historialIncompleto: true });
  assert.equal(es.length, 3);
  assert.match(es[0], /^2 series de esta semana no tienen una sesión guardada.*No se suman: el volumen real puede ser mayor\.$/);
  assert.match(patternPartialLines("es", { semana: 1 })[0], /^1 serie de esta semana no tiene .* es\. No se suma/);
  assert.match(es[1], /1 serie del alumno no tiene una semana válida/);
  assert.match(es[2], /no se cargó completo/);
  for (const l of ["en", "pt"]) assert.equal(patternPartialLines(l, { semana: 2, sinSemana: 1, historialIncompleto: true }).length, 3);
  assert.deepEqual(patternPartialLines("es", { semana: 0, sinSemana: 0, historialIncompleto: false }), []);
  assert.doesNotMatch(es.join(" "), /huérfan|orphan|NaN|undefined/i);
});

test("no se mezclan alumnos: Beto tiene mismas fechas, ejercicios, ciclo y semana y otras cifras", () => {
  const beto = modelo(HP_BETO, sel("hp-r-fuerza-beto", 1, 0));
  assert.deepEqual(vols(beto), esperado(HP_BETO, "hp-r-fuerza-beto", 1, 1));
  assert.equal(beto.patronPatterns.find((p) => p.key === "rodilla").vol, 3 * 5 * 120);
  assert.deepEqual(beto.patronHistorial.rutinas.map((r) => r.id).sort(), ["hp-r-fuerza-beto", "hp-r-hiper-beto"]);
  const ana = modelo(HP_ANA, null);
  assert.ok(!ana.patronHistorial.rutinas.some((r) => /beto/.test(r.id)));
  // aun con las filas de Beto dentro de la lista de Ana (dato corrupto), no se cuentan
  const mezclado = { [HP_ANA]: data.progresoGlobal[HP_ANA].concat(data.progresoGlobal[HP_BETO]) };
  const m = modelo(HP_ANA, sel("hp-r-fuerza", 1, 0), { progresoGlobal: mezclado });
  assert.deepEqual(vols(m), esperado(HP_ANA, "hp-r-fuerza", 1, 1));
  // y pedir la rutina de Beto estando en Ana cae a la rutina de Ana
  const ajena = modelo(HP_ANA, sel("hp-r-fuerza-beto", 1, 0));
  assert.equal(ajena.patronHistorial.rutinaId, "hp-r-hiper");
});

test("no se mezclan rutinas: Fuerza base y Hipertrofia comparten ejercicios y no se suman", () => {
  const f = modelo(HP_ANA, sel("hp-r-fuerza", 1, 0));
  const h = modelo(HP_ANA, sel("hp-r-hiper", 0, 0));
  assert.deepEqual(vols(f), esperado(HP_ANA, "hp-r-fuerza", 1, 1));
  assert.deepEqual(vols(h), esperado(HP_ANA, "hp-r-hiper", 1, 1));
  const total = (m) => KEYS.reduce((a, k) => a + vols(m)[k], 0);
  assert.equal(total(f), 5100);
  assert.equal(total(h), 8650);
});

test("sin sesiones no se atribuye nada a una rutina historica (no se reconstruye)", () => {
  const m = modelo(HP_ANA, sel("hp-r-fuerza", 1, 0), { sesionesGlobales: [] });
  assert.deepEqual(m.patronHistorial.rutinas.map((r) => r.id), ["hp-r-hiper"]); // solo la vigente
  assert.equal(m.patronHistorial.rutinaId, "hp-r-hiper");
  const at = atribuirSeriesARutinas(data.progresoGlobal[HP_ANA], [], HP_ANA);
  assert.equal(at.series.length, 0);
  assert.ok(at.sinSesion > 0);
});

test("una sesion de otro alumno o de otra semana/ciclo/ejercicio no respalda la serie", () => {
  const row = { id: "x", alumno_id: "a1", ejercicio_id: "e1", kg: "10", reps: "10", fecha: "5/3/2026", semana: 0, ciclo: 1 };
  const ses = (o) => Object.assign({ alumno_id: "a1", rutina_id: "r1", fecha: "5/3/2026", semana: 1, ciclo: 1, ejercicios: "e1,e2" }, o);
  assert.equal(atribuirSeriesARutinas([row], [ses({})], "a1").series.length, 1);
  assert.equal(atribuirSeriesARutinas([row], [ses({ alumno_id: "a2" })], "a1").series.length, 0);
  assert.equal(atribuirSeriesARutinas([row], [ses({ semana: 2 })], "a1").series.length, 0);
  assert.equal(atribuirSeriesARutinas([row], [ses({ ciclo: 2 })], "a1").series.length, 0);
  assert.equal(atribuirSeriesARutinas([row], [ses({ fecha: "6/3/2026" })], "a1").series.length, 0);
  assert.equal(atribuirSeriesARutinas([row], [ses({ ejercicios: "e2,e3" })], "a1").series.length, 0);
  assert.equal(atribuirSeriesARutinas([row], [ses({ rutina_id: null })], "a1").series.length, 0);
  assert.equal(atribuirSeriesARutinas([row], [ses({}), ses({ rutina_id: "r2" })], "a1").ambiguas, 1);
  // dos sesiones de la MISMA rutina no son ambiguas
  assert.equal(atribuirSeriesARutinas([row], [ses({}), ses({ dia_idx: 1 })], "a1").series.length, 1);
});

test("semana invalida o ausente: no se interpreta como semana 0 ni se reparte por fecha", () => {
  for (const semana of [null, undefined, "", -1, 4, 1.5, "abc", true]) {
    assert.equal(semanaIndiceDeSerie({ semana }), null, String(semana));
  }
  assert.equal(semanaIndiceDeSerie({ semana: 0 }), 0);
  assert.equal(semanaIndiceDeSerie({ semana: "3" }), 3);
  const row = { id: "x", alumno_id: "a1", ejercicio_id: "e1", kg: "10", reps: "10", fecha: "5/3/2026", ciclo: 1 };
  const r = atribuirSeriesARutinas([row], [{ alumno_id: "a1", rutina_id: "r1", fecha: "5/3/2026", semana: 1, ciclo: 1, ejercicios: "e1" }], "a1");
  assert.equal(r.series.length, 0);
  assert.equal(r.sinSemana, 1);
});

test("una serie con rutina_id propio usa ese id; la sesion no lo contradice", () => {
  const row = { id: "x", alumno_id: "a1", ejercicio_id: "e1", rutina_id: "rZ", kg: "10", reps: "10", fecha: "5/3/2026", semana: 0, ciclo: 1 };
  const r = atribuirSeriesARutinas([row], [], "a1");
  assert.equal(r.series.length, 1);
  assert.equal(r.series[0].rutinaId, "rZ");
});

test("rutina borrada con sesiones guardadas: se lista con el nombre de sus sesiones; sin actividad no se lista", () => {
  const lista = listarRutinasConHistorial({
    alumnoId: "a1", rutinaActualId: "r2",
    rutinas: [{ id: "r2", nombre: "Actual", created_at: "2026-01-01T00:00:00Z" }, { id: "r3", nombre: "Sin actividad", created_at: "2025-01-01T00:00:00Z" }],
    sesiones: [{ alumno_id: "a1", rutina_id: "r1", rutina_nombre: "Borrada", fecha: "5/3/2026", ciclo: 1, semana: 1 }, { alumno_id: "a2", rutina_id: "rX", rutina_nombre: "De otro", fecha: "5/3/2026" }],
    series: [],
  });
  assert.deepEqual(lista.map((r) => [r.id, r.nombre, r.esActual, r.existe]), [["r2", "Actual", true, true], ["r1", "Borrada", false, false]]);
});

test("respuestas inesperadas (null, [], objetos incompletos) no rompen el modelo ni el modulo de historial", () => {
  for (const over of [{ sesionesGlobales: null }, { sesionesGlobales: [] }, { sesionesGlobales: [{ alumno_id: HP_ANA }, { alumno_id: HP_ANA, rutina_id: "hp-r-fuerza" }] }, { progresoGlobal: { [HP_ANA]: [{}, { ejercicio_id: null }, { ejercicio_id: "hp-sq", fecha: "x", semana: 0 }] } }, { progresoGlobal: {} }, { progresoGlobal: null }, { rutinasSBEntrenador: [] }]) {
    const m = modelo(HP_ANA, sel("hp-r-fuerza", 1, 0), over);
    assert.ok(m.patronHistorial && Array.isArray(m.patronPatterns), JSON.stringify(Object.keys(over)));
    assert.ok(Number.isFinite(m.patronTotalVol));
  }
  // el modulo nuevo tolera elementos null / basura en sus entradas
  assert.deepEqual(atribuirSeriesARutinas(null, null, HP_ANA).series, []);
  const raro = atribuirSeriesARutinas([null, undefined, {}, { ejercicio_id: "hp-sq" }, { ejercicio_id: "hp-sq", fecha: "5/3/2026", semana: 0 }], [null, {}, "x", { alumno_id: HP_ANA }], HP_ANA);
  assert.equal(raro.series.length, 0);
  assert.deepEqual(listarRutinasConHistorial({ alumnoId: HP_ANA, rutinaActualId: null, rutinas: [null, {}], sesiones: [null], series: [] }), []);
  const vacio = modelo(null, null, { alumnos: [] });
  assert.equal(vacio.patronHistorial.rutinaId, null);
});

test("seleccion invalida (rutina inexistente, ciclo o semana fuera de rango) cae al predeterminado", () => {
  const m = modelo(HP_ANA, sel("no-existe", 99, 9));
  assert.equal(m.patronHistorial.rutinaId, "hp-r-hiper");
  const m2 = modelo(HP_ANA, sel("hp-r-fuerza", 7, 9));
  assert.equal(m2.patronHistorial.rutinaId, "hp-r-fuerza");
  assert.ok(m2.patronHistorial.ciclos.some((c) => c.value === m2.patronHistorial.ciclo));
  assert.ok(m2.patronHistorial.semana >= 0 && m2.patronHistorial.semana <= 3);
});

test("rutina historica abre en el ultimo ciclo y la ultima semana con datos", () => {
  const m = modelo(HP_ANA, sel("hp-r-fuerza", null, null));
  assert.equal(m.patronHistorial.ciclo, 2);
  assert.equal(m.patronHistorial.semana, 0);
  assert.equal(m.patronHistorial.bloqueActual, false);
});

test("misma clasificacion y formula: la tarjeta usa buildPatternBreakdown y volumenDeSerie, sin redefinirlas", () => {
  const metr = read("components/coachProgresoMetrics.js");
  assert.match(metr, /export function buildPatternBreakdown/);
  assert.match(metr, /patternToMovementKey\(ex \? ex\.pattern : ""\)/);
  assert.equal((metr.match(/patternToMovementKey\(ex \? ex\.pattern/g) || []).length, 1, "una sola clasificacion");
  const lib = read("lib/metricas/volumenPatronHistorial.js");
  assert.doesNotMatch(lib, /parseFloat|\* *reps|kg *\*/, "el modulo de historial no recalcula el volumen");
});

test("UI: selectores nativos de rutina, ciclo y semana (>= 44 px, 16 px para no hacer zoom en iPhone)", () => {
  const card = read("components/progreso/ProgressMovementPatternVolumeCard.jsx");
  for (const q of ["patron-rutina", "patron-ciclo", "patron-semana"]) assert.ok(card.includes(q), q);
  assert.match(card, /minHeight: 44, fontSize: 16/);
  assert.match(card, /<label htmlFor=/);
  const view = read("components/ProgresoView.jsx");
  assert.match(view, /patronSel: patronSel/);
  assert.match(view, /setPatronSel\(\{ rutinaId: null, ciclo: null, semana: null \}\)/, "al cambiar de alumno se reinicia la seleccion");
});

console.log("\n" + count + " pruebas OK");
