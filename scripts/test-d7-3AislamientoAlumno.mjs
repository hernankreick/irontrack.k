// D7.3 (cierre): datos por alumno, cambio rapido de alumno, PR, fechas equivalentes y decimales.
//
//   node scripts/test-d7-3AislamientoAlumno.mjs
//
// Funciones reales, datos ficticios (sin red ni Supabase). Alumnos de prueba:
//   A: sentadilla 100 kg, ~5.000 kg en la semana, 4 de 5 sesiones del plan · B: sentadilla 60 kg, ~2.000 kg, menos sesiones · C: rutina sin registros.
process.env.TZ = "America/Argentina/Buenos_Aires";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildCoachProgresoModel } from "../components/coachProgresoMetrics.js";
import { loadAlumnoFicha, nuevaCargaFicha } from "../lib/studentFicha.js";
import { eventosPR, historialPorDia, mejoresMarcas } from "../lib/metricas/pr.js";
import { volumenEnRango, volumenDeSerie } from "../lib/metricas/volumen.js";
import { diaLocal } from "../lib/metricas/fechas.js";
import { dedupeMatchedSets, mergeProgressEntries, normalizeWorkoutKg, normalizeWorkoutSet } from "../lib/workoutSession.js";

const src = (rel) => readFileSync(new URL("../" + rel, import.meta.url), "utf8");
let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

// ---- fecha fija: lunes 2/11/2026 12:00 ----
const NOW_MS = new Date(2026, 10, 2, 12).getTime();
const RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW_MS); else super(...a); }
  static now() { return NOW_MS; }
}
globalThis.Date = FixedDate;
const HOY = diaLocal(new Date());
const fechaDe = (diasAtras) => { const d = new RealDate(NOW_MS); d.setDate(d.getDate() - diasAtras); return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear(); };
const isoDe = (diasAtras) => { const d = new RealDate(NOW_MS); d.setDate(d.getDate() - diasAtras); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "T10:00:00"; };

const A = "alu-a", B = "alu-b", C = "alu-c";
const alumnos = [{ id: A, nombre: "Alumno A" }, { id: B, nombre: "Alumno B" }, { id: C, nombre: "Alumno C" }];
const allEx = [{ id: "sq", name: "Sentadilla", pattern: "rodilla" }, { id: "bp", name: "Press banca", pattern: "empuje" }];
const rutina = (id, alumno) => ({ id, alumno_id: alumno, created_at: "2026-08-01T00:00:00", datos: { days: [{ exercises: [{ id: "sq" }, { id: "bp" }] }, { exercises: [{ id: "sq" }] }] } });
const rutinas = [rutina("r-a", A), rutina("r-b", B), rutina("r-c", C)];
const fila = (alumno, ex, diasAtras, kg, reps, semana) => ({ alumno_id: alumno, rutina_id: "r-" + alumno.slice(-1), ejercicio_id: ex, fecha: fechaDe(diasAtras), kg: String(kg), reps: String(reps), semana: semana || 0 }) // progreso.semana: 0..3;
const ses = (alumno, diasAtras) => ({ alumno_id: alumno, rutina_id: "r-" + alumno.slice(-1), created_at: isoDe(diasAtras), fecha: fechaDe(diasAtras), semana: 1 });

// A: semana actual (hoy lunes) = 5.000 kg (sq 100 x 5 x 10 series); historial con PR de 95 -> 100
const progA = [fila(A, "sq", 14, 95, 5)];
for (let i = 0; i < 10; i++) progA.push(fila(A, "sq", 0, 100, 5, 3));
// B: semana actual = 2.000 kg (sq 60 x 5 x 6 + bp 40 x 5 x 1 + ... ) -> 60*5*6 = 1800 + 40*5 = 200
const progB = [fila(B, "sq", 14, 60, 5)];
for (let i = 0; i < 6; i++) progB.push(fila(B, "sq", 0, 60, 5, 1));
progB.push(fila(B, "bp", 0, 40, 5, 1));
const progresoGlobal = { [A]: progA, [B]: progB, [C]: [] };
const sesionesGlobales = [0, 3, 7, 10, 14, 17, 21, 24].map((d) => ses(A, d)).concat([0, 7, 14, 21].map((d) => ses(B, d)));

const build = (alumnoSel, over) => buildCoachProgresoModel(Object.assign({
  alumnos, sesionesGlobales, progresoGlobal, rutinasSBEntrenador: rutinas, allEx,
  periodId: "semanas4", alumnoSel, ejercicioSelId: "sq", diaIdx: 0, lang: "es",
}, over || {}));
const chip = (m, key) => m.alumnoChips.find((c) => c.key === key);
const firma = (m) => JSON.stringify({ chips: m.alumnoChips, prs: m.prsRecientes, vol: m.volBars, ult: m.ultimaSesion, ej: m.ejerciciosRegistrados, serie: m.chartSeries, rut: m.rutinaNombre });
const sinNaN = (o) => assert.doesNotMatch(JSON.stringify(o), /NaN|Infinity|undefined/);

await test("1. tres alumnos: A, B y C muestran cifras propias y distintas (volumen, PR, adherencia, rutina)", () => {
  const mA = build(A), mB = build(B), mC = build(C);
  assert.equal(volumenEnRango(progA, { desde: HOY, hasta: HOY }).total, 5000);
  assert.equal(volumenEnRango(progB, { desde: HOY, hasta: HOY }).total, 2000);
  assert.equal(chip(mA, "alumnoPrs").value, 1);
  assert.equal(chip(mB, "alumnoPrs").value, 0); // iguala 60: no es PR
  assert.ok(chip(mA, "alumnoAdherence").value > chip(mB, "alumnoAdherence").value);
  assert.ok(chip(mA, "alumnoVolume").value > chip(mB, "alumnoVolume").value);
  assert.match(chip(mA, "alumnoAdherence").label, /Alumno A/);
  assert.match(chip(mB, "alumnoAdherence").label, /Alumno B/);
  assert.ok(mA.prsRecientes.every((p) => p.n === "Alumno A"));
  assert.ok(mB.prsRecientes.every((p) => p.n === "Alumno B"));
});

await test("2. alumno sin registros (C): estados vacios, sin cifras de otro alumno ni NaN", () => {
  const mC = build(C);
  sinNaN(mC.alumnoChips);
  assert.equal(chip(mC, "alumnoPrs").value, 0);
  assert.ok(!chip(mC, "alumnoVolume").value);
  assert.deepEqual(mC.prsRecientes, []);
  assert.equal(mC.hasChartData, false);
  assert.equal(mC.tieneRutina, true);
  assert.ok(mC.volBars.every((b) => !b.kg));
});

await test("3. cambiar A -> B -> C -> A (y rapido, 30 veces) devuelve siempre el mismo modelo de cada alumno", () => {
  const base = { [A]: firma(build(A)), [B]: firma(build(B)), [C]: firma(build(C)) };
  assert.notEqual(base[A], base[B]);
  assert.notEqual(base[B], base[C]);
  const orden = [A, B, C, A];
  for (let i = 0; i < 30; i++) orden.push([A, B, C][(i * 7) % 3]);
  orden.forEach((id) => assert.equal(firma(build(id)), base[id], "contaminacion al volver a " + id));
});

await test("4. cambio de periodo: cada periodo recalcula solo los datos del alumno seleccionado", () => {
  ["semanas4", "semanas8", "meses3", "todo"].forEach((p) => {
    const mA = build(A, { periodId: p }), mB = build(B, { periodId: p });
    assert.equal(mA.periodo.id, p);
    assert.ok(mA.prsRecientes.every((x) => x.n === "Alumno A"));
    assert.ok(mB.prsRecientes.every((x) => x.n === "Alumno B"));
    assert.notEqual(firma(mA), firma(mB));
    sinNaN(build(C, { periodId: p }).alumnoChips);
  });
});

// ---- carga de ficha real (StudentsSection.onVer -> loadAlumnoFicha) con respuestas fuera de orden ----
function sbDiferido() {
  const pendientes = [];
  const llamada = (tipo) => (id) => new Promise((resolve) => pendientes.push({ tipo, id, resolve }));
  return {
    sb: { getRutinas: llamada("rutinas"), getProgreso: llamada("progreso"), getSesiones: llamada("sesiones") },
    async resolver(id, tipo) {
      const i = pendientes.findIndex((p) => p.id === id && p.tipo === tipo);
      assert.ok(i >= 0, "no hay pendiente " + tipo + " de " + id);
      const p = pendientes.splice(i, 1)[0];
      p.resolve(tipo === "rutinas" ? [{ id: "r-" + id, alumno_id: id }] : [{ alumno_id: id, tipo }]);
      for (let k = 0; k < 5; k++) await Promise.resolve();
    },
    // vacia lo que quede pendiente (en el codigo anterior las cargas viejas seguian pidiendo progreso/sesiones y escribiendo)
    async resolverTodo() {
      while (pendientes.length) await this.resolver(pendientes[0].id, pendientes[0].tipo);
    },
  };
}
function estadoFicha() {
  const st = { rutinasSB: null, rutinasSBEntrenador: [], progreso: null, sesiones: null };
  return {
    st,
    setters: {
      setRutinasSB: (v) => { st.rutinasSB = typeof v === "function" ? v(st.rutinasSB) : v; },
      setRutinasSBEntrenador: (v) => { st.rutinasSBEntrenador = typeof v === "function" ? v(st.rutinasSBEntrenador) : v; },
      setAlumnoProgreso: (v) => { st.progreso = v; },
      setAlumnoSesiones: (v) => { st.sesiones = v; },
    },
  };
}
const dueno = (arr) => (arr && arr[0] ? arr[0].alumno_id : null);

await test("5. VER A y enseguida VER B: las respuestas tardias de A no pisan la ficha de B (en ningun orden)", async () => {
  // orden 1: B responde todo antes que A
  {
    const f = sbDiferido(), e = estadoFicha();
    const pA = loadAlumnoFicha(Object.assign({ alumno: { id: A }, sb: f.sb }, e.setters));
    const pB = loadAlumnoFicha(Object.assign({ alumno: { id: B }, sb: f.sb }, e.setters));
    await f.resolver(B, "rutinas"); await f.resolver(B, "progreso"); await f.resolver(B, "sesiones");
    await f.resolver(A, "rutinas");
    await f.resolverTodo();
    const rB = await pB, rA = await pA;
    assert.equal(rA.stale, true);
    assert.ok(!rB.stale);
    assert.equal(dueno(e.st.rutinasSB), B);
    assert.equal(dueno(e.st.progreso), B);
    assert.equal(dueno(e.st.sesiones), B);
  }
  // orden 2: A llega a mitad de la carga de B (rutinas de A antes que progreso de B, progreso de A al final)
  {
    const f = sbDiferido(), e = estadoFicha();
    const pA = loadAlumnoFicha(Object.assign({ alumno: { id: A }, sb: f.sb }, e.setters));
    const pB = loadAlumnoFicha(Object.assign({ alumno: { id: B }, sb: f.sb }, e.setters));
    await f.resolver(B, "rutinas");
    await f.resolver(A, "rutinas");
    await f.resolver(B, "progreso"); await f.resolver(B, "sesiones");
    await f.resolverTodo();
    await Promise.all([pA, pB]);
    assert.equal(dueno(e.st.rutinasSB), B);
    assert.equal(dueno(e.st.progreso), B);
    assert.equal(dueno(e.st.sesiones), B);
    assert.ok(e.st.rutinasSBEntrenador.every((r) => r.alumno_id === B), "la lista del entrenador recibio rutinas tardias de A");
  }
  // A -> B -> C -> A rapido: solo la ultima (A) escribe
  {
    const f = sbDiferido(), e = estadoFicha();
    const ps = [A, B, C, A].map((id) => loadAlumnoFicha(Object.assign({ alumno: { id }, sb: f.sb }, e.setters)));
    for (const id of [C, B]) await f.resolver(id, "rutinas");
    await f.resolver(A, "rutinas"); // la primera de A (vieja)
    await f.resolver(A, "rutinas"); // la vigente de A
    await f.resolverTodo();
    const r = await Promise.all(ps);
    assert.deepEqual(r.map((x) => !!x.stale), [true, true, true, false]);
    assert.equal(dueno(e.st.progreso), A);
  }
});

await test("6. nuevaCargaFicha: solo la ultima carga es vigente; App (Dashboard y busqueda global) y VER la usan", () => {
  const v1 = nuevaCargaFicha(), v2 = nuevaCargaFicha();
  assert.equal(v1(), false);
  assert.equal(v2(), true);
  const app = src("App.jsx");
  assert.equal((app.match(/nuevaCargaFicha\(\)/g) || []).length, 3, "cargarFicha + 2 rutas de la busqueda global");
  assert.match(app, /cargarFicha: async function[\s\S]{0,400}if \(!vigente\(\)\) return;/);
  const ver = src("components/students/StudentsSection.jsx");
  assert.match(ver, /if \(!\(carga && carga\.stale\)\) setLoadingSB\(false\)/);
});

// ---- PR ----
const r = (ex, fecha, kg, reps, extra) => Object.assign({ ejercicio_id: ex, fecha, kg, reps }, extra || {});
await test("7. PR: igualar no es PR, superar si, bajar no; orden cronologico aunque las filas lleguen desordenadas", () => {
  const filas = [
    r("sq", "20/10/2026", 100, 5), // iguala
    r("sq", "1/10/2026", 90, 5),   // primera marca
    r("sq", "8/10/2026", 100, 5),  // PR (supera 90)
    r("sq", "27/10/2026", 97.5, 5), // baja
    r("sq", "30/10/2026", 102.5, 3), // PR (supera 100)
  ];
  const ev = eventosPR(filas);
  assert.deepEqual(ev.map((e) => [e.dia, e.kg, e.kgAnterior]), [
    [diaDe("30/10/2026"), 102.5, 100],
    [diaDe("8/10/2026"), 100, 90],
  ]);
  assert.deepEqual(historialPorDia(filas, "sq").map((h) => h.clase), ["primera", "pr", "iguala", null, "pr"]);
  assert.deepEqual(eventosPR(filas.slice().reverse()), ev);
});

await test("8. PR: el historial se conserva entre ciclos y rutinas (un reinicio no resetea el record) y no se mezclan alumnos", () => {
  const ciclo1 = [r("sq", "1/9/2026", 100, 5, { ciclo: 1, rutina_id: "r1" })];
  const ciclo2 = [r("sq", "5/10/2026", 100, 5, { ciclo: 2, rutina_id: "r1" }), r("sq", "12/10/2026", 95, 5, { ciclo: 2, rutina_id: "r2" })];
  assert.deepEqual(eventosPR(ciclo1.concat(ciclo2)), []); // 100 tras el reinicio iguala, no es PR nuevo
  assert.equal(mejoresMarcas(ciclo1.concat(ciclo2)).sq.kg, 100);
  // modelo: los PR de B nunca incluyen a A (A tiene PR, B no)
  assert.equal(build(B).prsRecientes.length, 0);
  assert.equal(build(A).prsRecientes.length, 1);
  assert.equal(build(A).prsRecientes[0].kg, 100);
});

function diaDe(f) { return eventosPR([r("x", "1/1/2000", 1, 1), r("x", f, 2, 1)])[0].dia; }

// ---- fechas equivalentes y series identicas legitimas ----
await test("9. fechas equivalentes: la misma serie local '5/3/2026' e hidratada '05/03/2026' cuenta una vez", () => {
  const local = [normalizeWorkoutSet({ kg: 80, reps: 5, date: "5/3/2026", week: 1 })];
  const hidratada = [normalizeWorkoutSet({ kg: "80", reps: "5", date: "05/03/2026", week: 1, created_at: "2026-03-05T13:00:00Z" })];
  const out = dedupeMatchedSets(local, hidratada);
  assert.equal(out.length, 1);
  assert.equal(out[0].created_at, "2026-03-05T13:00:00Z"); // se prefiere la hidratada
  assert.equal(mergeProgressEntries({ sets: local }, { sets: hidratada }).sets.length, 1);
});

await test("10. series identicas legitimas NO se borran: 3 series reales iguales siguen siendo 3 (local, remoto o mezcla)", () => {
  const s = (date, extra) => normalizeWorkoutSet(Object.assign({ kg: 80, reps: 5, date, week: 1 }, extra || {}));
  assert.equal(dedupeMatchedSets([s("5/3/2026"), s("5/3/2026"), s("5/3/2026")], []).length, 3);
  assert.equal(dedupeMatchedSets([], [s("05/03/2026"), s("05/03/2026"), s("05/03/2026")]).length, 3);
  assert.equal(dedupeMatchedSets([s("5/3/2026"), s("5/3/2026"), s("5/3/2026")], [s("05/03/2026"), s("05/03/2026")]).length, 3); // 1 aun sin sincronizar
  assert.equal(dedupeMatchedSets([s("5/3/2026")], [s("05/03/2026", { note: "otra" })]).length, 2); // distinta nota = distinta serie
  assert.equal(dedupeMatchedSets([s("5/3/2026")], [s("5/4/2026")]).length, 2); // distinto dia
  // volumen del nucleo: una fila = una serie, nunca se deduplica
  const filas = [r("sq", "5/3/2026", 80, 5), r("sq", "5/3/2026", 80, 5), r("sq", "05/03/2026", 80, 5)];
  assert.equal(volumenEnRango(filas, {}).total, 1200);
});

// ---- decimales ----
await test("11. decimales: 82,5 = 82.5; 100, 0, vacio e invalidos", () => {
  assert.equal(normalizeWorkoutKg("82,5"), 82.5);
  assert.equal(normalizeWorkoutKg(" 82,5 "), 82.5);
  assert.equal(normalizeWorkoutKg("82.5"), 82.5);
  assert.equal(normalizeWorkoutKg(82.5), 82.5);
  assert.equal(normalizeWorkoutKg("100"), 100);
  assert.equal(normalizeWorkoutKg("0"), 0);
  assert.equal(normalizeWorkoutKg(""), 0);
  assert.equal(normalizeWorkoutKg(null), 0);
  assert.equal(normalizeWorkoutKg("abc"), 0);
  assert.equal(normalizeWorkoutSet({ kg: "82,5", reps: "5", date: "1/11/2026" }).kg, 82.5);
  assert.equal(volumenDeSerie(r("sq", "1/11/2026", normalizeWorkoutKg("82,5"), 5)), 412.5);
  assert.equal(volumenDeSerie(r("sq", "1/11/2026", "0", 5)), 0);
  assert.equal(volumenDeSerie(r("sq", "1/11/2026", "", 5)), 0);
  assert.equal(volumenDeSerie(r("sq", "1/11/2026", "abc", 5)), 0);
  // PR con decimales: 82.5 supera 80 y 82,5 normalizado iguala 82.5
  assert.deepEqual(eventosPR([r("sq", "1/10/2026", 80, 5), r("sq", "2/10/2026", 82.5, 5), r("sq", "3/10/2026", normalizeWorkoutKg("82,5"), 5)]).map((e) => e.kg), [82.5]);
});

await test("12. coherencia de volumen: la suma de los dias del alumno = total semanal y no incluye a otro alumno", () => {
  const vA = volumenEnRango(progA, { desde: HOY - 6, hasta: HOY });
  const vAB = volumenEnRango(progA.concat(progB), { desde: HOY - 6, hasta: HOY });
  assert.equal(Object.values(vA.porDia).reduce((s, x) => s + x, 0), vA.total);
  assert.equal(vAB.total, vA.total + 2000);
  // bloque de la rutina (por progreso.semana): A = 475 en la semana 1 y 5.000 en la 4; B = 300 y 2.000 en la 2; C = 0
  assert.deepEqual(build(A).volBars.map((b) => b.v), [475, 0, 0, 5000]);
  assert.deepEqual(build(B).volBars.map((b) => b.v), [300, 2000, 0, 0]);
  assert.deepEqual(build(C).volBars.map((b) => b.v), [0, 0, 0, 0]);
  sinNaN(build(A).volBars);
});

console.log("\n" + count + " tests OK");
