// E1 — nucleo unico de metricas del entrenador (lib/metricas/): volumen, PR, adherencia, racha.
//
//   node scripts/test-metricasNucleo.mjs
//
// Igual que los otros scripts/test-*.mjs: sin dependencias nuevas, node:assert, sin red ni Supabase, datos ficticios.
// Corre con zona horaria con horario de verano: todo debe depender del calendario local, no de milisegundos.
process.env.TZ = "America/New_York";

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const M = await import("../lib/metricas/index.js");
const { dayNum } = await import("../lib/progressDate.js");

let count = 0;
async function test(name, fn) { await fn(); count++; console.log("ok -", name); }

const D = (d, m, y) => dayNum(y || 2026, m, d);
const f = (d, m, y) => d + "/" + m + "/" + (y || 2026);
const serie = (ex, kg, reps, fecha, extra) => Object.assign({ alumno_id: "A", ejercicio_id: ex, kg, reps, fecha }, extra || {});

// ---------------------------------------------------------------- fechas
await test("fechas: d/m/yyyy estricto, semanas lunes-domingo, created_at de Supabase, cruce de DST", () => {
  assert.equal(M.parseFechaDMY("5/10/2026"), D(5, 10)); // nunca el 10 de mayo
  assert.equal(M.parseFechaDMY("31/2/2026"), null);
  assert.equal(M.lunesDe(D(1, 11)), D(26, 10), "domingo 1/11 => lunes 26/10");
  assert.equal(M.lunesDe(D(26, 10)), D(26, 10));
  assert.equal(M.lunesDe(D(2, 11)), D(2, 11), "semana que cruza el cambio de horario (EEUU, 1/11)");
  assert.equal(M.diaDeCreatedAt("2026-10-05 15:00:00.123456"), D(5, 10));
  assert.equal(M.diaDeSesion({ fecha: "basura", created_at: "2026-10-05T15:00:00Z" }), D(5, 10), "sin fecha valida: created_at");
});

// ---------------------------------------------------------------- tipo de carga
const rutinaPlancha = { datos: { days: [{ exercises: [{ id: "plank", reps: '45"' }, { id: "sq", reps: "8-10" }] }] } };
const indice = M.indiceEjerciciosPorTiempo([{ id: "wallsit", duration: "60 seg" }, { id: "kuohp", muscle: "Hombro/Core", equip: "Mancuerna" }], [rutinaPlancha]);
await test("tipo de carga: por tiempo segun catalogo o rutina; nada por texto del musculo (kuohp 'Hombro/Core' es carga)", () => {
  assert.deepEqual(Object.keys(indice).sort(), ["plank", "wallsit"]);
  assert.equal(M.tipoDeCarga("plank", indice), "tiempo");
  assert.equal(M.tipoDeCarga("kuohp", indice), "carga");
  assert.equal(M.tipoDeCarga("custom_123", indice), "carga", "ejercicios personalizados incluidos");
});

// ---------------------------------------------------------------- volumen
await test("volumen: kg x reps; excluye por tiempo, kg 0, reps 0 y fechas invalidas; incluye custom y kuohp", () => {
  const rows = [
    serie("sq", 100, 5, f(5, 10)),                // 500
    serie("custom_123", 20, 10, f(5, 10)),        // 200 (custom)
    serie("kuohp", 12, 8, f(6, 10)),              // 96 (antes: falso peso corporal)
    serie("plank", 20, 45, f(6, 10)),             // por tiempo: reps = segundos => 0
    serie("pu", 0, 10, f(6, 10)),                 // sin carga => 0
    serie("sq", 100, 0, f(6, 10)),                // reps 0 => 0
    serie("sq", 100, 5, "10/5/2026 extra"),       // fecha invalida => 0
    serie("sq", 100, 5, f(5, 10)),                // serie repetida real: SI cuenta
  ];
  const v = M.volumenEnRango(rows, { indiceTiempo: indice });
  assert.equal(v.total, 1296);
  assert.equal(v.series, 4);
  assert.deepEqual(v.porEjercicio, { sq: 1000, custom_123: 200, kuohp: 96 });
  assert.deepEqual(v.dias, [D(5, 10), D(6, 10)]);
  assert.equal(M.volumenEnRango(rows, { desde: D(6, 10), hasta: D(6, 10), indiceTiempo: indice }).total, 96);
});
await test("volumen por semana de calendario: semanas sin datos en 0, limites inclusivos", () => {
  const rows = [serie("sq", 100, 5, f(5, 10)), serie("sq", 100, 5, f(11, 10)), serie("sq", 50, 10, f(19, 10))];
  // 11/10 es domingo: misma semana que el lunes 5/10
  const sem = M.volumenPorSemana(rows, { desde: D(5, 10), hasta: D(1, 11) });
  assert.deepEqual(sem.map((w) => w.kg), [1000, 0, 500, 0]);
  assert.deepEqual(sem.map((w) => w.lunes), [D(5, 10), D(12, 10), D(19, 10), D(26, 10)]);
});
await test("comparacion de volumen entre ciclos: el periodo previo cuenta el historial completo (antes: 0 tras reiniciar => aumento falso)", () => {
  const rows = [];
  // periodo previo (ciclo 1): sentadilla y press 3 dias
  [1, 3, 5].forEach((d) => { rows.push(serie("sq", 100, 5, f(d, 9), { ciclo: 1 })); rows.push(serie("bp", 60, 8, f(d, 9), { ciclo: 1 })); });
  // periodo actual (ciclo 2 tras reiniciar la rutina): los mismos ejercicios + uno nuevo
  [1, 3].forEach((d) => { rows.push(serie("sq", 110, 5, f(d, 10), { ciclo: 2 })); rows.push(serie("bp", 60, 8, f(d, 10), { ciclo: 2 })); rows.push(serie("dl", 140, 3, f(d, 10), { ciclo: 2 })); });
  const c = M.compararVolumen(rows, { desde: D(1, 10), hasta: D(28, 10) }, { desde: D(1, 9), hasta: D(28, 9) });
  assert.deepEqual(c.ejerciciosComunes, ["bp", "sq"]);
  assert.equal(c.previoComparable, 3 * 500 + 3 * 480);
  assert.equal(c.actualComparable, 2 * 550 + 2 * 480);
  assert.equal(c.actualTotal, c.actualComparable + 2 * 420, "el total incluye el ejercicio nuevo; el % no");
  assert.equal(Math.round(c.pct), Math.round(((2060 - 2940) / 2940) * 100));
  assert.equal(c.motivo, null);
});
await test("comparacion sin base suficiente: pct null con motivo (nunca un porcentaje sobre 0)", () => {
  const solo = [serie("sq", 100, 5, f(1, 10)), serie("sq", 100, 5, f(2, 10))];
  assert.equal(M.compararVolumen(solo, { desde: D(1, 10), hasta: D(28, 10) }, { desde: D(1, 9), hasta: D(28, 9) }).motivo, "sin_ejercicios_comunes");
  const unDia = solo.concat([serie("sq", 100, 5, f(1, 9))]);
  const c = M.compararVolumen(unDia, { desde: D(1, 10), hasta: D(28, 10) }, { desde: D(1, 9), hasta: D(28, 9) });
  assert.deepEqual([c.pct, c.motivo], [null, "previo_con_pocos_dias"]);
});

// ---------------------------------------------------------------- PR
await test("PR: el primer registro NO es PR; superar el record si; igualarlo no", () => {
  const ev = M.eventosPR([serie("sq", 80, 5, f(1, 10)), serie("sq", 80, 8, f(3, 10)), serie("sq", 85, 5, f(5, 10))]);
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].kg, ev[0].kgAnterior, ev[0].diferencia, ev[0].dia], [85, 80, 5, D(5, 10)]);
});
await test("PR: varias series ascendentes el mismo dia => UN solo PR con la mejor (antes: 3)", () => {
  const ev = M.eventosPR([serie("sq", 80, 5, f(1, 10)), serie("sq", 82.5, 5, f(8, 10)), serie("sq", 85, 3, f(8, 10)), serie("sq", 87.5, 1, f(8, 10))]);
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].kg, ev[0].kgAnterior], [87.5, 80]);
});
await test("PR: historial completo, sin ventana de 20 series (el record de hace meses no se pierde)", () => {
  const rows = [serie("sq", 100, 5, f(1, 3))];
  for (let i = 0; i < 25; i++) rows.push(serie("sq", 70 + i, 5, f(1 + (i % 25), 10)));
  assert.equal(M.eventosPR(rows).length, 0, "ninguna serie de octubre supera los 100 kg de marzo");
  assert.equal(M.mejoresMarcas(rows).sq.kg, 100);
});
await test("PR: reps no cuentan, ejercicios por tiempo y series invalidas no generan PR; un alumno no ve los de otro", () => {
  assert.equal(M.eventosPR([serie("sq", 100, 1, f(1, 10)), serie("sq", 90, 10, f(8, 10))]).length, 0);
  assert.equal(M.eventosPR([serie("plank", 10, 30, f(1, 10)), serie("plank", 20, 30, f(8, 10))], { indiceTiempo: indice }).length, 0);
  assert.equal(M.eventosPR([serie("sq", 80, 5, f(1, 10)), serie("sq", 200, 0, f(8, 10)), serie("sq", 200, 5, "x")]).length, 0);
});
await test("PR: varios ejercicios, orden del mas reciente, conteo por periodo y mejores marcas", () => {
  const rows = [
    serie("sq", 80, 5, f(1, 9)), serie("sq", 90, 5, f(15, 9)), serie("sq", 95, 5, f(5, 10)),
    serie("bp", 60, 5, f(1, 9)), serie("bp", 65, 5, f(6, 10)), serie("bp", 65, 8, f(7, 10)),
  ];
  const ev = M.eventosPR(rows);
  assert.deepEqual(ev.map((e) => e.ejercicio_id + "@" + e.kg), ["bp@65", "sq@95", "sq@90"]);
  assert.equal(M.contarPRs(ev, D(1, 10), D(31, 10)), 2);
  assert.equal(M.contarPRs(ev, D(1, 9), D(30, 9)), 1);
  assert.deepEqual(M.mejoresMarcas(rows).bp, { kg: 65, reps: 8, dia: D(7, 10) });
});

// ---------------------------------------------------------------- adherencia
const rutina = { id: "r1", nombre: "Fuerza", created_at: "2026-09-01T12:00:00Z", datos: { days: [{}, {}, {}] } };
const ses = (dia, extra) => Object.assign({ alumno_id: "A", rutina_id: "r1", rutina_nombre: "Fuerza", semana: 1, dia_idx: dia, fecha: f(1, 10) }, extra || {});
await test("adherencia (caso de la auditoria): otra rutina no cuenta; validadas cuentan aparte (antes 12/12 = 100%)", () => {
  const sesiones = [];
  for (let i = 0; i < 6; i++) sesiones.push(ses(i % 3, { fecha: f(1 + i * 4, 10) }));
  for (let i = 0; i < 4; i++) sesiones.push(ses(i % 3, { rutina_id: "rOld", fecha: f(2 + i * 4, 10) }));
  for (let i = 0; i < 2; i++) sesiones.push(ses(i, { origen: "validada_coach", ejercicios: "", fecha: f(3 + i * 4, 10) }));
  const a = M.adherencia({ rutina, sesiones, alumnoId: "A", desde: D(1, 10), hasta: D(28, 10) });
  assert.deepEqual([a.planificadas, a.completadas, a.realizadas, a.validadas, a.pct], [12, 8, 6, 2, 67]);
});
await test("adherencia: el mismo dia y dia de rutina se cuenta una vez; realizada gana a validada", () => {
  const sesiones = [ses(0), ses(0), ses(0, { origen: "validada_coach" }), ses(1, { origen: "validada_coach" })];
  const a = M.adherencia({ rutina, sesiones, alumnoId: "A", desde: D(1, 10), hasta: D(7, 10) });
  assert.deepEqual([a.planificadas, a.completadas, a.realizadas, a.validadas], [3, 2, 1, 1]);
});
await test("adherencia: no se penaliza lo anterior a la asignacion; ciclos anteriores de la rutina cuentan; tope 100", () => {
  const nueva = Object.assign({}, rutina, { created_at: "2026-10-15T12:00:00Z" });
  const a = M.adherencia({ rutina: nueva, sesiones: [ses(0, { fecha: f(16, 10) })], alumnoId: "A", desde: D(1, 10), hasta: D(28, 10) });
  assert.deepEqual([a.desdeEfectivo, a.semanas, a.planificadas, a.completadas], [D(15, 10), 2, 6, 1]);
  const ciclos = [ses(0, { ciclo: 1 }), ses(1, { ciclo: 2, fecha: f(2, 10) }), ses(2, { ciclo: 3, fecha: f(3, 10) })];
  assert.equal(M.adherencia({ rutina, sesiones: ciclos, alumnoId: "A", desde: D(1, 10), hasta: D(7, 10) }).completadas, 3);
  const muchas = [0, 1, 2, 3, 4, 5].map((d) => ses(d % 3, { fecha: f(1 + d, 10) }));
  assert.equal(M.adherencia({ rutina, sesiones: muchas, alumnoId: "A", desde: D(1, 10), hasta: D(7, 10) }).pct, 100);
});
await test("adherencia: pendientes, otro alumno y legado sin rutina_id; sin rutina o sin dias => pct null", () => {
  const s = [ses(0, { estado: "pendiente" }), ses(1, { alumno_id: "B" }), ses(2, { rutina_id: null, rutina_nombre: "Fuerza" }), ses(0, { rutina_id: null, rutina_nombre: "Otra", fecha: f(2, 10) })];
  assert.equal(M.adherencia({ rutina, sesiones: s, alumnoId: "A", desde: D(1, 10), hasta: D(7, 10) }).completadas, 1);
  assert.deepEqual([M.adherencia({ rutina: null, sesiones: s }).pct, M.adherencia({ rutina: null }).motivo], [null, "sin_rutina"]);
  assert.equal(M.adherencia({ rutina: { id: "x", datos: { days: [] } }, desde: 1, hasta: 2 }).motivo, "rutina_sin_dias");
  assert.equal(M.adherencia({ rutina: Object.assign({}, rutina, { created_at: "2027-01-01T00:00:00Z" }), desde: D(1, 10), hasta: D(7, 10) }).motivo, "periodo_vacio");
});

// ---------------------------------------------------------------- racha
const sesR = (fecha, extra) => Object.assign({ alumno_id: "A", fecha }, extra || {});
await test("racha: semanas consecutivas con sesiones; la semana actual sin sesiones no la rompe", () => {
  const hoy = D(28, 10); // miercoles
  const s = [sesR(f(5, 10)), sesR(f(14, 10)), sesR(f(19, 10)), sesR(f(20, 10))];
  assert.deepEqual(M.rachaSemanal(s, { hoy, alumnoId: "A" }), { semanas: 3, incluyeSemanaActual: false, ultimaSemana: D(19, 10) });
  assert.equal(M.rachaSemanal(s.concat([sesR(f(26, 10))]), { hoy }).semanas, 4);
});
await test("racha: un hueco la corta; sin sesiones recientes es 0 (nunca una racha vieja); validadas cuentan; pendientes y otros alumnos no", () => {
  const hoy = D(28, 10);
  assert.equal(M.rachaSemanal([sesR(f(26, 10)), sesR(f(12, 10))], { hoy }).semanas, 1);
  assert.equal(M.rachaSemanal([sesR(f(1, 6)), sesR(f(8, 6)), sesR(f(15, 6))], { hoy }).semanas, 0);
  assert.equal(M.rachaSemanal([sesR(f(26, 10), { origen: "validada_coach" })], { hoy }).semanas, 1);
  assert.equal(M.rachaSemanal([sesR(f(26, 10), { estado: "pendiente" }), sesR(f(26, 10), { alumno_id: "B" })], { hoy, alumnoId: "A" }).semanas, 0);
  assert.equal(M.rachaSemanal([sesR(f(30, 10))], { hoy }).semanas, 0, "sesiones futuras no cuentan");
});

// ---------------------------------------------------------------- propiedades
await test("pureza: las funciones no mutan sus entradas", () => {
  const rows = Object.freeze([Object.freeze(serie("sq", 80, 5, f(1, 10))), Object.freeze(serie("sq", 90, 5, f(8, 10)))]);
  const sesiones = Object.freeze([Object.freeze(ses(0))]);
  M.volumenEnRango(rows); M.compararVolumen(rows, { desde: 1, hasta: 2 }, { desde: 0, hasta: 0 });
  M.eventosPR(rows); M.mejoresMarcas(rows);
  M.adherencia({ rutina: Object.freeze(rutina), sesiones, desde: D(1, 10), hasta: D(7, 10) });
  M.rachaSemanal(sesiones, { hoy: D(28, 10) });
});
await test("alcance: el nucleo no usa red, Supabase, React ni localStorage; App.jsx (alumno) no lo importa", () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(root, "lib/metricas");
  for (const file of readdirSync(dir)) {
    const src = readFileSync(path.join(dir, file), "utf8").replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""); // solo codigo
    assert.ok(!/fetch\(|supabase|sbFetch|from ["']react["']|localStorage|it_cd/.test(src), file);
  }
  const app = readFileSync(path.join(root, "App.jsx"), "utf8");
  assert.ok(!/lib\/metricas/.test(app));
  // las pantallas del entrenador que lo consumen (E2) se verifican en scripts/test-e2EstadisticasCoach.mjs
});

console.log("\n" + count + " pruebas OK");
