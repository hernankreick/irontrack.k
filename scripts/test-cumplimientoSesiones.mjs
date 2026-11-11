// Cumplimiento de sesiones por semana de rutina y ciclo: node scripts/test-cumplimientoSesiones.mjs
// Datos 100 % ficticios. Sin red, sin Supabase, sin almacenamiento.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cumplimientoSesiones, filasDeRutina } from "../lib/cumplimiento/sesiones.js";
import { buildReinicioDatos } from "../lib/rutinaCiclo.js";
import { adherencia } from "../lib/metricas/adherencia.js";
import { completedDayIndexesFromRows } from "../lib/manualSessionValidation.js";

let n = 0;
function test(name, fn) { fn(); n++; console.log("ok -", name); }
const clone = (o) => JSON.parse(JSON.stringify(o));
function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
}

// ---------------------------------------------------------------- fixtures ficticias
const A = "alu-ficticio-1";
function rutina(datosExtra, extra) {
  return Object.assign({
    id: "rut-ficticia-1",
    nombre: "Fuerza ficticia",
    alumno_id: A,
    created_at: "2026-10-01T10:00:00Z",
    datos: Object.assign({ semana_activa: 2, days: [{ label: "Día A" }, { label: "Día B" }, { label: "Día C" }] }, datosExtra || {}),
  }, extra || {});
}
let seq = 0;
function ses(dia, semana, extra) {
  seq++;
  return Object.assign({
    id: "ses-" + seq, alumno_id: A, rutina_id: "rut-ficticia-1", rutina_nombre: "Fuerza ficticia",
    dia_idx: dia, semana: semana, fecha: (1 + seq % 27) + "/10/2026", created_at: "2026-10-" + String(2 + (seq % 27)).padStart(2, "0") + "T12:00:00Z",
  }, extra || {});
}
function calc(sesiones, rut, extra) {
  return cumplimientoSesiones(Object.assign({ alumnoId: A, rutina: rut || rutina(), sesiones: sesiones, historialCompleto: true }, extra || {}));
}
const S = (r, w) => r.semanas.find((x) => x.semana === w);

// ---------------------------------------------------------------- 1..4: completa, parcial, sin sesiones, futura
test("1. semana completa: 3/3 dias, 100 %, 'completa'", () => {
  const r = calc([ses(0, 1), ses(1, 1), ses(2, 1)]);
  assert.equal(r.ok, true);
  const s1 = S(r, 1);
  assert.deepEqual([s1.programados, s1.completados, s1.pendientes, s1.pct, s1.estado, s1.momento, s1.registro], [3, 3, 0, 100, "completa", "pasada", "con_sesiones"]);
  assert.deepEqual(s1.diasCompletados, [0, 1, 2]);
});

test("2. semana parcial (semana actual): 2/3, 67 %, 'parcial'", () => {
  const r = calc([ses(0, 1), ses(1, 1), ses(2, 1), ses(0, 2), ses(2, 2)]);
  const s2 = S(r, 2);
  assert.deepEqual([s2.completados, s2.pendientes, s2.pct, s2.estado, s2.momento], [2, 1, 67, "parcial", "actual"]);
});

test("3. semana actual sin sesiones: 'pendiente', 0 %, 'sin_sesiones_registradas'", () => {
  const r = calc([ses(0, 1), ses(1, 1), ses(2, 1)]);
  const s2 = S(r, 2);
  assert.deepEqual([s2.completados, s2.pct, s2.estado, s2.registro], [0, 0, "pendiente", "sin_sesiones_registradas"]);
});

test("4. semanas futuras: 'pendiente', pct null (nunca incumplidas)", () => {
  const r = calc([ses(0, 1), ses(1, 1), ses(2, 1)]);
  [3, 4].forEach((w) => {
    const s = S(r, w);
    assert.deepEqual([s.momento, s.estado, s.pct, s.completados, s.pendientes], ["futura", "pendiente", null, 0, 3]);
  });
  // una fila en una semana futura del ciclo vigente es una inconsistencia: no se toma como avance
  const raro = calc([ses(0, 1), ses(1, 1), ses(2, 1), ses(0, 4)]);
  assert.deepEqual([S(raro, 4).estado, S(raro, 4).motivo, S(raro, 4).pct], ["no_verificable", "sesiones_en_semana_futura", null]);
});

// ---------------------------------------------------------------- 5..7: duplicados y validaciones manuales
test("5. sesiones duplicadas (mismo dia y semana, otro id/fecha): cuentan una vez", () => {
  const r = calc([ses(0, 1), ses(1, 1), ses(2, 1), ses(0, 2), ses(0, 2), ses(0, 2, { fecha: "30/10/2026" })]);
  assert.deepEqual([S(r, 2).completados, S(r, 2).pct], [1, 33]);
});

test("6. validacion manual: cuenta como completada y se informa aparte", () => {
  const r = calc([ses(0, 1), ses(1, 1, { origen: "validada_coach", ejercicios: "" }), ses(2, 1)]);
  const s1 = S(r, 1);
  assert.deepEqual([s1.completados, s1.realizados, s1.validados, s1.estado], [3, 2, 1, "completa"]);
});

test("7. realizada + validada del mismo dia: un solo dia, cuenta como realizada", () => {
  const r = calc([ses(0, 2, { origen: "validada_coach" }), ses(0, 2)]);
  const s2 = S(r, 2);
  assert.deepEqual([s2.completados, s2.realizados, s2.validados], [1, 1, 0]);
  const soloValidada = calc([ses(0, 2, { origen: "validada_coach" })]);
  assert.deepEqual([S(soloValidada, 2).realizados, S(soloValidada, 2).validados], [0, 1]);
});

// ---------------------------------------------------------------- 8..9: reinicios
test("8. reinicio de SEMANA 2: S1 sigue en ciclo 1, S2 en ciclo 2; el intento anterior queda aparte", () => {
  const base = rutina({ semana_activa: 2 });
  const datos = buildReinicioDatos(base.datos, { tipo: "semana", semana: 2, nowIso: "2026-10-20T10:00:00Z" });
  const rut = Object.assign({}, base, { datos });
  const r = calc([
    ses(0, 1), ses(1, 1), ses(2, 1),                 // S1 ciclo 1 (vigente: anterior al reinicio)
    ses(0, 2), ses(1, 2),                            // S2 ciclo 1 (intento anterior)
    ses(0, 2, { ciclo: 2 }),                         // S2 ciclo 2 (intento vigente)
  ], rut);
  assert.equal(r.cicloActual, 2);
  assert.deepEqual([S(r, 1).ciclo, S(r, 1).estado], [1, "completa"]);
  assert.deepEqual([S(r, 2).ciclo, S(r, 2).completados, S(r, 2).estado, S(r, 2).momento], [2, 1, "parcial", "actual"]);
  assert.equal(r.intentosAnteriores.length, 1);
  const prev = r.intentosAnteriores[0];
  assert.deepEqual([prev.ciclo, prev.semana, prev.completados, prev.vigente, prev.bloqueVigente, prev.momento, prev.estado], [1, 2, 2, false, true, "cerrada", "parcial"]);
});

test("9. reinicio de RUTINA (ciclo nuevo): el bloque anterior no completa el nuevo", () => {
  const base = rutina({ semana_activa: 4 });
  const datos = buildReinicioDatos(base.datos, { tipo: "rutina", nowIso: "2026-10-25T10:00:00Z" });
  const rut = Object.assign({}, base, { datos });
  const viejas = [];
  for (let w = 1; w <= 4; w++) for (let d = 0; d < 3; d++) viejas.push(ses(d, w));
  const r = calc(viejas.concat([ses(0, 1, { ciclo: 2 })]), rut);
  assert.deepEqual([r.cicloActual, r.cicloBase, r.semanaActiva], [2, 2, 1]);
  assert.deepEqual([S(r, 1).ciclo, S(r, 1).completados, S(r, 1).estado], [2, 1, "parcial"]);
  assert.deepEqual([S(r, 2).estado, S(r, 2).pct], ["pendiente", null]);
  assert.equal(r.intentosAnteriores.length, 4);
  assert.ok(r.intentosAnteriores.every((it) => it.ciclo === 1 && it.bloqueVigente === false && it.estado === "completa" && it.pct === 100 && it.completados === 3));
  // una fila con ciclo POSTERIOR al vigente se excluye (inconsistente)
  assert.equal(calc([ses(0, 1, { ciclo: 3 })], rut).excluidas.cicloPosterior, 1);
});

// ---------------------------------------------------------------- 10..12, 15: rutina, alumno, asignacion, sin rutina_id
test("10. sesiones de otra rutina: excluidas", () => {
  const r = calc([ses(0, 1), ses(1, 1), ses(2, 1, { rutina_id: "rut-OTRA" }), ses(0, 2, { rutina_id: "rut-OTRA" })]);
  assert.equal(S(r, 1).completados, 2);
  assert.equal(S(r, 2).completados, 0);
  assert.equal(r.excluidas.otraRutina, 2);
});

test("11. sesiones de otro alumno (roster mezclado): excluidas; rutina de otro alumno => error", () => {
  const r = calc([ses(0, 2), ses(1, 2, { alumno_id: "alu-OTRO" }), ses(2, 2, { alumno_id: null })]);
  assert.equal(S(r, 2).completados, 1);
  assert.equal(r.excluidas.otroAlumno, 2);
  assert.equal(cumplimientoSesiones({ alumnoId: "alu-OTRO", rutina: rutina(), sesiones: [], historialCompleto: true }).motivo, "alumno_no_coincide");
});

test("12. sesiones anteriores a la asignacion (sin rutina_id, mismo nombre): excluidas como ambiguas", () => {
  const vieja = ses(0, 2, { rutina_id: null, created_at: "2026-09-20T12:00:00Z" });
  const nueva = ses(1, 2, { rutina_id: null, created_at: "2026-10-05T12:00:00Z" });
  const r = calc([vieja, nueva]);
  assert.deepEqual(S(r, 2).diasCompletados, [1]);
  assert.equal(r.excluidas.sinRutinaAmbigua, 1);
  // la de otra rutina reasignada (con rutina_id distinto) nunca entra, sea cual sea su fecha
  assert.equal(calc([ses(0, 2, { rutina_id: "rut-anterior", created_at: "2026-10-10T12:00:00Z" })]).excluidas.otraRutina, 1);
});

test("15. sin rutina_id: solo con mismo nombre y timestamps validos posteriores a la asignacion", () => {
  const sinTs = ses(0, 2, { rutina_id: "", created_at: null });
  const otroNombre = ses(1, 2, { rutina_id: undefined, rutina_nombre: "Otra" });
  const rutSinTs = rutina({}, { created_at: null });
  assert.equal(calc([sinTs]).excluidas.sinRutinaAmbigua, 1);
  assert.equal(calc([otroNombre]).excluidas.otraRutina, 1);
  assert.equal(calc([ses(2, 2, { rutina_id: null })], rutSinTs).excluidas.sinRutinaAmbigua, 1, "rutina sin created_at: no se puede probar");
  assert.equal(S(calc([ses(2, 2, { rutina_id: null })]), 2).completados, 1);
});

// ---------------------------------------------------------------- 13..14: dia y semana invalidos
test("13. dia_idx nulo o invalido: no completa dias; la semana no completa queda 'no_verificable'", () => {
  ["", null, undefined, -1, 3, 1.5, "x", true].forEach((dia) => {
    const r = calc([ses(0, 2), ses(dia, 2)]);
    const s2 = S(r, 2);
    assert.deepEqual([s2.completados, s2.sesionesSinDia, s2.estado, s2.motivo, s2.pct], [1, 1, "no_verificable", "sesiones_sin_dia", null], String(dia));
    assert.equal(s2.registro, "con_sesiones");
  });
  // dia_idx como texto numerico valido ("2") se acepta (misma regla que completedDayIndexesFromRows)
  assert.equal(S(calc([ses("2", 2)]), 2).completados, 1);
  // si la semana igual esta completa, una fila sin dia no la invalida
  assert.equal(S(calc([ses(0, 1), ses(1, 1), ses(2, 1), ses(null, 1)]), 1).estado, "completa");
});

test("14. semana fuera de 1..4: excluida (sin ampliar a 8 semanas)", () => {
  const r = calc([ses(0, 0), ses(0, 5), ses(0, 8), ses(0, null), ses(0, "x"), ses(0, 2)]);
  assert.equal(r.excluidas.semanaInvalida, 5);
  assert.equal(r.semanas.length, 4);
  assert.deepEqual(r.semanas.map((s) => s.semana), [1, 2, 3, 4]);
  assert.equal(S(r, 2).completados, 1);
});

// ---------------------------------------------------------------- 16..17: historial incompleto y vacios
test("16. historial incompleto: lo no demostrado es 'no_verificable' / 'sin_informacion'", () => {
  const r = calc([ses(0, 1), ses(1, 1), ses(2, 1), ses(0, 2)], null, { historialCompleto: false });
  assert.equal(S(r, 1).estado, "completa", "lo demostrado sigue siendo completo");
  assert.deepEqual([S(r, 2).estado, S(r, 2).motivo, S(r, 2).pct], ["no_verificable", "historial_incompleto", null]);
  const vacio = calc([], null, { historialCompleto: false });
  assert.deepEqual([S(vacio, 2).estado, S(vacio, 2).registro], ["no_verificable", "sin_informacion"]);
  assert.deepEqual([S(vacio, 3).estado, S(vacio, 3).registro], ["pendiente", "sin_informacion"], "futura: pendiente, sin informacion");
  // sin la bandera explicita, se trata como incompleto (nunca se asume completo)
  assert.equal(cumplimientoSesiones({ alumnoId: A, rutina: rutina(), sesiones: [] }).historialCompleto, false);
  // semana pasada sin evidencia con historial completo: avanzada sin evidencia (no "incumplida")
  const sinEvidencia = calc([ses(0, 1)]);
  assert.deepEqual([S(sinEvidencia, 1).estado, S(sinEvidencia, 1).motivo], ["no_verificable", "semana_avanzada_sin_evidencia"]);
});

test("17. datos vacios o invalidos: errores explicitos, sin excepciones", () => {
  assert.equal(cumplimientoSesiones(undefined).motivo, "alumno_invalido");
  assert.equal(cumplimientoSesiones({ alumnoId: A }).motivo, "sin_rutina");
  assert.equal(calc([], rutina({ days: [] })).motivo, "rutina_sin_dias");
  assert.equal(calc([], Object.assign(rutina(), { datos: null })).motivo, "rutina_sin_dias");
  const r = calc(null);
  assert.equal(r.ok, true);
  assert.deepEqual(r.semanas.map((s) => [s.estado, s.registro]), [
    ["no_verificable", "sin_sesiones_registradas"], ["pendiente", "sin_sesiones_registradas"],
    ["pendiente", "sin_sesiones_registradas"], ["pendiente", "sin_sesiones_registradas"]]);
  assert.equal(calc([null, 7, "x"]).excluidas.filaInvalida, 3);
  // sin semana_activa valida: posicion desconocida => nada incompleto se califica
  const sinPos = calc([ses(0, 1)], rutina({ semana_activa: null }));
  assert.equal(sinPos.semanaActiva, null);
  assert.ok(sinPos.semanas.every((s) => s.momento === "desconocido" && s.estado === "no_verificable"));
  // fila no completada (estado pendiente / completada false) no cuenta
  assert.equal(calc([ses(0, 2, { estado: "pendiente" }), ses(1, 2, { completada: false })]).excluidas.noCompletada, 2);
});

// ---------------------------------------------------------------- 18: inmutabilidad
test("18. inmutabilidad: entradas congeladas y sin cambios", () => {
  const rut = deepFreeze(rutina());
  const sesiones = deepFreeze([ses(0, 1), ses(1, 1), ses(2, 1), ses(0, 2, { origen: "validada_coach" }), ses(null, 2)]);
  const fotoR = clone(rut), fotoS = clone(sesiones);
  const r = cumplimientoSesiones({ alumnoId: A, rutina: rut, sesiones, historialCompleto: true });
  assert.equal(r.ok, true);
  assert.deepEqual(rut, fotoR);
  assert.deepEqual(sesiones, fotoS);
  // modificar la salida no toca las entradas
  r.semanas[0].diasCompletados.push(99);
  assert.deepEqual(sesiones, fotoS);
});

// ---------------------------------------------------------------- tope, determinismo y coherencia con funciones existentes
test("pct nunca supera 100 ni sale de 0..100 (sesiones de mas, dias repetidos)", () => {
  const muchas = [];
  for (let i = 0; i < 10; i++) for (let d = 0; d < 3; d++) muchas.push(ses(d, 1), ses(d, 2, { origen: i % 2 ? "validada_coach" : undefined }));
  const r = calc(muchas);
  r.semanas.concat(r.intentosAnteriores).forEach((s) => { if (s.pct != null) assert.ok(s.pct >= 0 && s.pct <= 100); });
  assert.deepEqual([S(r, 2).completados, S(r, 2).pct], [3, 100]);
});

test("independiente del orden de las filas", () => {
  const filas = [ses(0, 1), ses(1, 1), ses(2, 1), ses(0, 2, { origen: "validada_coach" }), ses(0, 2), ses(2, 2), ses(null, 3)];
  const a = calc(filas), b = calc(filas.slice().reverse());
  assert.deepEqual(a, b);
});

test("coherencia: en el ciclo vigente coincide con completedDayIndexesFromRows (sin modificarla)", () => {
  const filas = [ses(0, 2), ses(2, 2), ses(2, 2), ses(0, 1), ses(1, 1), ses(2, 1)];
  const rut = rutina();
  [1, 2].forEach((w) => assert.deepEqual(S(calc(filas, rut), w).diasCompletados, completedDayIndexesFromRows(filas, rut, w)));
});

test("regresion: adherencia y filtros existentes devuelven lo mismo antes y despues de calcular", () => {
  const rut = rutina();
  const filas = [ses(0, 1), ses(1, 1), ses(2, 1), ses(0, 2, { origen: "validada_coach" })];
  const params = { rutina: rut, sesiones: filas, alumnoId: A, desde: 20000, hasta: 21000 };
  const antes = adherencia(params);
  calc(filas, rut);
  assert.deepEqual(adherencia(params), antes);
  assert.equal(filasDeRutina(filas, rut, A).filas.length, 4);
});

test("modulo puro: sin reloj, red, almacenamiento, React ni Supabase", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(dir, "..", "lib", "cumplimiento", "sesiones.js"), "utf8").replace(/\/\/.*$/gm, "");
  ["Date.now", "new Date", "localStorage", "sessionStorage", "fetch(", "supabase", "react", "Math.random", "console."].forEach((t) => {
    assert.equal(src.includes(t), false, "no debe usar " + t);
  });
});

console.log(n + " tests ok");
