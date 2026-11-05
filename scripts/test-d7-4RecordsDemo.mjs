// D7.4 demo (demo/progreso-coach.html): alumnos «Martina Récords» y «Bruno Récords» para validar la regla única de PR (lib/metricas/pr.js).
//   node scripts/test-d7-4RecordsDemo.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildProgresoDemoData } from "../components/demo/progresoCoachDemoData.js";
import { buildCoachProgresoModel } from "../components/coachProgresoMetrics.js";
import { historialPorDia, eventosPR } from "../lib/metricas/pr.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let count = 0;
function test(name, fn) { fn(); count++; console.log("ok -", name); }

const data = buildProgresoDemoData();
const M = "demo-martina-records", B = "demo-bruno-records", C = "demo-alumno-c";
const modelo = (id) => buildCoachProgresoModel({ ...data, periodId: "semanas4", alumnoSel: id, diaIdx: 0, lang: "es" });
const filas = (id) => data.progresoGlobal[id] || [];
const hist = (id, ej) => historialPorDia(filas(id), ej);

test("alumnos nuevos al final del arreglo, con rutina y datos ficticios", () => {
  assert.equal(data.alumnos[0].id, "demo-abril");
  assert.deepEqual(data.alumnos.slice(-2).map((a) => a.nombre), ["Martina Récords", "Bruno Récords"]);
  for (const id of [M, B]) {
    const a = data.alumnos.find((x) => x.id === id);
    assert.match(a.email, /@demo\.invalid$/);
    assert.ok(data.rutinasSBEntrenador.some((r) => r.alumno_id === id && /^demo-r-/.test(r.id)));
  }
});

test("Martina: sentadilla primera, pr, iguala, sin marca, pr (80, 90, 90, 85, 100)", () => {
  const h = hist(M, "demo-sq");
  assert.deepEqual(h.map((x) => x.clase), ["primera", "pr", "iguala", null, "pr"]);
  assert.deepEqual(h.map((x) => x.kg), [80, 90, 90, 85, 100]);
  assert.equal(filas(M).length, 15, "3 series por día, 5 días");
  assert.ok(filas(M).every((r) => r.reps === "5" && r.semana != null && r.ciclo != null), "reps 5 y con semana");
});

test("Martina: el récord se conserva tras el reinicio de rutina (ciclo 1 -> ciclo 2)", () => {
  const ciclos = [...new Set(filas(M).map((r) => r.ciclo))].sort();
  assert.deepEqual(ciclos, [1, 2]);
  assert.equal(new Set(filas(M).filter((r) => r.ciclo === 1).map((r) => r.fecha)).size, 1, "el 80 es el único día del ciclo 1");
  assert.equal(hist(M, "demo-sq")[1].recordPrevio, 80, "el 90 del ciclo 2 compara contra el 80 del ciclo 1");
});

test("Martina (modelo): 2 PRs en 4 semanas (90 y 100; el 80 es marca inicial), récord 100, fila Sentadilla con chip PR", () => {
  const m = modelo(M);
  assert.equal(m.prsPeriod, 2);
  assert.equal(m.prsRecientes.length, 2);
  assert.ok(m.prsRecientes.every((p) => p.ejercicioId === "demo-sq" || p.id === "demo-sq" || JSON.stringify(p).includes("demo-sq")));
  assert.ok(JSON.stringify(m.prsRecientes).includes("100"), "100 kg en PRs recientes");
  const sq = m.ejerciciosRegistrados.find((e) => e.id === "demo-sq");
  assert.equal(sq.ultimaClase, "pr");
  assert.equal(m.ejerciciosRegistrados.length, 1, "solo sentadilla");
  assert.equal(Math.max(...filas(M).map((r) => parseFloat(r.kg))), 100);
});

test("Bruno: press 60 -> 62,5 -> 62,5 (un PR y una iguala) y sentadilla 120 -> 117,5 sin PR", () => {
  assert.deepEqual(hist(B, "demo-bp").map((x) => x.clase), ["primera", "pr", "iguala"]);
  assert.deepEqual(hist(B, "demo-bp").map((x) => x.kg), [60, 62.5, 62.5]);
  assert.deepEqual(hist(B, "demo-sq").map((x) => x.clase), ["primera", null]);
  assert.deepEqual(hist(B, "demo-sq").map((x) => x.kg), [120, 117.5]);
  const ev = eventosPR(filas(B));
  assert.deepEqual(ev.map((e) => [e.ejercicio_id, e.kg]), [["demo-bp", 62.5]]);
  const m = modelo(B);
  assert.equal(m.prsPeriod, 1);
  const por = Object.fromEntries(m.ejerciciosRegistrados.map((e) => [e.id, e]));
  assert.equal(por["demo-bp"].ultimaClase, "iguala");
  assert.equal(por["demo-sq"].ultimaClase, null);
});

test("sin mezcla entre alumnos ni ejercicios", () => {
  assert.ok(filas(M).every((r) => r.alumno_id === M && r.ejercicio_id === "demo-sq"));
  assert.ok(filas(B).every((r) => r.alumno_id === B));
  const pm = JSON.stringify(modelo(M).prsRecientes), pb = JSON.stringify(modelo(B).prsRecientes);
  assert.ok(!pm.includes("62.5") && !pm.includes("demo-bp"), "Martina no ve el press de Bruno");
  assert.ok(!pb.includes("100") && !pb.includes("\"kg\":90"), "Bruno no ve la sentadilla de Martina");
  assert.ok(!pb.includes("demo-sq"), "la sentadilla de Bruno (117,5) no es PR");
});

test("Alumno C Demo sigue sin registros", () => {
  assert.ok(data.alumnos.some((a) => a.id === C));
  assert.ok(data.rutinasSBEntrenador.some((r) => r.alumno_id === C));
  assert.equal((data.progresoGlobal[C] || []).length, 0);
  assert.equal(data.sesionesGlobales.filter((s) => s.alumno_id === C).length, 0);
  const m = modelo(C);
  assert.equal(m.prsPeriod, 0);
  assert.equal(m.ejerciciosRegistrados.length, 0);
});

test("la demo acepta ?alumno=martina|bruno sin cambiar el comportamiento por defecto", () => {
  const src = fs.readFileSync(path.join(ROOT, "components/demo/ProgresoCoachDemo.jsx"), "utf8");
  assert.match(src, /get\('alumno'\)/);
  assert.match(src, /'Martina Récords'/);
  assert.match(src, /if \(!alumnoParam\) return undefined;/);
});

console.log("\n" + count + " pruebas OK");
