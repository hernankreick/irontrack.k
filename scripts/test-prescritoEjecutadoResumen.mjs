// Prescrito vs. ejecutado: orquestacion y resumen por sesion/semana/ciclo (lib/prescritoEjecutadoResumen.js, modulo puro).
//   node scripts/test-prescritoEjecutadoResumen.mjs   (datos ficticios, sin red)
import assert from "node:assert/strict";
import { compararSesionesDelAlumno, sesionConEvidenciaDeFinalizacion, EVIDENCIA_FINALIZACION as EV } from "../lib/prescritoEjecutadoResumen.js";
import { buildPrescripcionSnapshot } from "../lib/prescripcionSnapshot.js";
import { ESTADO_COMPARACION as E } from "../lib/prescripcionComparacion.js";

let n = 0; const test = (name, fn) => { fn(); n++; console.log("ok -", name); };
const clone = (o) => JSON.parse(JSON.stringify(o));
const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

const ALU = "alu-1", RUT = "rut-1", F1 = "10/11/2026", F2 = "11/11/2026", F8 = "17/11/2026";
const U = (i) => "aaaaaaaa-aaaa-4aaa-8aaa-" + String(i).padStart(12, "0");
const rutina = (kgSq) => ({ id: RUT, nombre: "R", alumno_id: ALU, datos: { semana_activa: 1, days: [
  { label: "A", warmup: [{ id: "mov", name: "Mov", sets: "2", reps: "12", kg: "20" }], exercises: [{ id: "sq", name: "Sentadilla", sets: "3", reps: "8-10", kg: kgSq || "50" }, { id: "bp", name: "Press", sets: "3", reps: "10", kg: "30" }] },
  { label: "B", warmup: [], exercises: [{ id: "row", name: "Remo", sets: "3", reps: "10", kg: "40" }] },
] } });
const copia = (dia, semana, fecha, rut, over) => {
  const r = buildPrescripcionSnapshot({ rutina: rut || rutina(), alumnoId: ALU, diaIdx: dia, semana, fecha, semanaMostrada: semana, capturadaEn: "2026-11-10T21:00:00.000Z" }); assert.ok(r.ok);
  return Object.assign({ alumno_id: ALU, rutina_id: RUT, ciclo: r.clave.ciclo, semana, dia_idx: dia, fecha_dia: r.clave.fecha_dia, prescripcion_hash: r.hash, snapshot: r.snapshot, origen_lectura: "servidor" }, over || {});
};
const ses = (i, dia, semana, fecha, over) => Object.assign({ id: "s" + i, alumno_id: ALU, rutina_id: RUT, ciclo: 1, semana, dia_idx: dia, fecha, sesion_uid: U(i), identidad_v: 1 }, over || {});
let seq = 0;
const ser = (i, bloque, pos, ej, kg, reps, semana, fecha, over) => Object.assign({ id: "p" + (++seq), sesion_uid: U(i), alumno_id: ALU, ejercicio_id: ej, bloque, pos, kg, reps, semana: semana - 1, fecha }, over || {});
const completaDiaA = (i, semana, fecha) => [ser(i, "warmup", 0, "mov", 20, 12, semana, fecha), ser(i, "warmup", 0, "mov", 20, 12, semana, fecha),
  ...[8, 9, 10].map((r) => ser(i, "main", 0, "sq", 50, r, semana, fecha)), ...[10, 10, 10].map((r) => ser(i, "main", 1, "bp", 30, r, semana, fecha))];
const completaDiaB = (i, semana, fecha) => [10, 10, 10].map((r) => ser(i, "main", 0, "row", 40, r, semana, fecha));
const hashPorSesion = (copias) => (s) => { const c = copias.find((x) => x.dia_idx === s.dia_idx && x.semana === Number(s.semana)); return c ? c.prescripcion_hash : ""; };
const correr = (o) => { const copias = o.copias; return compararSesionesDelAlumno({ sesiones: o.sesiones, copias, series: o.series, contexto: Object.assign({ registroSeriesCompleto: true, planificacionMostradaHash: hashPorSesion(copias) }, o.contexto || {}) }); };
const det = (r, id) => r.sesiones.find((x) => x.sesion_id === id).comparacion;

test("semana completa: dos sesiones verificables con identidad real => resumen por semana con porcentajes calculados", () => {
  const copias = [copia(0, 1, F1), copia(1, 1, F2)];
  const r = correr({ sesiones: [ses(1, 0, 1, F1), ses(2, 1, 1, F2)], copias, series: [...completaDiaA(1, 1, F1), ...completaDiaB(2, 1, F2)] });
  assert.equal(det(r, "s1").estado, E.VERIFICABLE); assert.equal(det(r, "s2").estado, E.VERIFICABLE);
  const w = r.semanas[0]; assert.deepEqual([w.ciclo, w.semana, w.estado, w.sesiones_total, w.sesiones_verificables, w.sesiones_sin_datos], [1, 1, "completo", 2, 2, 0]);
  assert.deepEqual(w.ejercicios, { prescritos: 4, verificables: 4, no_comparables: 0, completos: 4, parciales: 0, omitidos: 0, sin_evidencia_de_omision: 0 });
  assert.deepEqual([w.series.prescritas_minimo, w.series.ejecutadas], [11, 11]);
  assert.deepEqual([w.porcentajes.series.valor, w.porcentajes.reps.valor, w.porcentajes.kg.valor, w.porcentajes.cobertura_sesiones.valor], [100, 100, 100, 100]);
  assert.deepEqual(r.vinculo, { uid_ambiguos: [], series_recibidas: 11, series_vinculadas: 11, series_sin_sesion: 0 });
  assert.equal(r.global.estado, "completo"); assert.equal(r.sesiones[0].evidencia_finalizacion, EV.IDENTIDAD_V1);
});
test("ejercicio omitido (0 series con registro completo) vs parcial vs sin evidencia de omision (registro no confirmado)", () => {
  const copias = [copia(0, 1, F1)];
  const base = completaDiaA(1, 1, F1).filter((s) => !(s.bloque === "main" && s.pos === 1));       // press omitido
  const parcial = base.filter((s, i, a) => !(s.bloque === "main" && s.pos === 0 && s.reps === 10));  // sentadilla con 2 de 3
  const r = correr({ sesiones: [ses(1, 0, 1, F1)], copias, series: parcial });
  const w = r.semanas[0]; assert.deepEqual([w.ejercicios.omitidos, w.ejercicios.parciales, w.ejercicios.completos], [1, 1, 1]);
  assert.equal(w.porcentajes.series.valor, 33, "solo el calentamiento alcanzo las series prescritas");
  const sinEvidencia = correr({ sesiones: [ses(1, 0, 1, F1)], copias, series: parcial, contexto: { registroSeriesCompleto: false } }).semanas[0];
  assert.equal(sinEvidencia.ejercicios.omitidos, 0, "sin evidencia de registro completo NO se afirma omision"); assert.equal(sinEvidencia.ejercicios.sin_evidencia_de_omision, 2);
  assert.equal(sinEvidencia.porcentajes.series.valor, null); assert.equal(sinEvidencia.porcentajes.series.motivo, "variable_no_comparable_en_algun_ejercicio");
});
test("repeticiones y cargas prescritas vs ejecutadas: por debajo / por encima / mixto quedan contados por separado", () => {
  const copias = [copia(0, 1, F1)];
  const series = [...[20, 20].map((k) => ser(1, "warmup", 0, "mov", k, 12, 1, F1)), ...[8, 8, 8].map((r) => ser(1, "main", 0, "sq", 55, r, 1, F1)), ...[6, 10, 12].map((r) => ser(1, "main", 1, "bp", 30, r, 1, F1))];
  const v = correr({ sesiones: [ses(1, 0, 1, F1)], copias, series }).semanas[0].variables;
  assert.deepEqual([v.kg.por_encima, v.kg.cumplen], [1, 2]); assert.equal(v.reps.mixtos, 1); assert.equal(v.reps.cumplen, 2);
});
test("sesion sin copia: estado explicito sin_copia, nunca se compara con la rutina actual; sesion historica sin identidad: sin_finalizar y series sin vinculo", () => {
  const rutinaEditada = rutina("80"); // la rutina ACTUAL cambio, pero no se pasa ni se usa
  const r = correr({ sesiones: [ses(1, 0, 1, F1), ses(2, 1, 1, F2, { sesion_uid: null, identidad_v: null })], copias: [copia(1, 1, F2)], series: [...completaDiaA(1, 1, F1), ...completaDiaB(2, 1, F2).map((s) => Object.assign({}, s, { sesion_uid: null }))] });
  assert.equal(det(r, "s1").estado, E.SIN_COPIA); assert.equal(det(r, "s1").ejercicios, null);
  assert.equal(det(r, "s2").estado, E.SIN_FINALIZAR); assert.equal(r.sesiones[1].evidencia_finalizacion, EV.NINGUNA);
  assert.ok(det(r, "s2").motivos.some((m) => m.estado === E.SERIES_SIN_VINCULO || m.estado === E.SIN_FINALIZAR));
  const w = r.semanas[0]; assert.deepEqual([w.estado, w.sesiones_verificables, w.sesiones_sin_datos], ["sin_datos_para_comparar", 0, 2]);
  assert.equal(w.por_estado.sin_copia, 1); assert.equal(w.por_estado.sin_finalizar, 1); assert.equal(w.porcentajes.series.motivo, "sin_sesiones_verificables"); assert.equal(w.porcentajes.cobertura_sesiones.valor, 0);
  assert.ok(rutinaEditada);
});
test("prescripcion de la copia, no la actual: una edicion POSTERIOR de la rutina no cambia el resultado de una sesion pasada", () => {
  const copias = [copia(0, 1, F1)];                                 // capturada con sentadilla a 50 kg
  const series = completaDiaA(1, 1, F1);
  const r1 = correr({ sesiones: [ses(1, 0, 1, F1)], copias, series });
  const copiaPosterior = copia(0, 1, F1, rutina("80"));              // el entrenador subio a 80 kg DESPUES: otra huella para la misma clave
  const r2 = correr({ sesiones: [ses(1, 0, 1, F1)], copias: [copias[0], copiaPosterior], series });
  assert.equal(r1.semanas[0].porcentajes.kg.valor, 100);
  assert.equal(det(r2, "s1").estado, E.AMBIGUA, "dos huellas para la misma sesion: no se elige ninguna ni se usa la mas nueva");
  assert.equal(r2.semanas[0].sesiones_verificables, 0);
});
test("dos semanas y dos ciclos se agregan por separado; semana inconsistente de las series queda explicita", () => {
  const copias = [copia(0, 1, F1), copia(0, 2, F8)];
  const r = correr({ sesiones: [ses(1, 0, 1, F1), ses(2, 0, 2, F8), ses(3, 0, 1, F1, { ciclo: 2, rutina_id: RUT })], copias, series: [...completaDiaA(1, 1, F1), ...completaDiaA(2, 2, F8), ...completaDiaA(3, 1, F1)] });
  assert.deepEqual(r.semanas.map((w) => [w.ciclo, w.semana, w.sesiones_total]), [[1, 1, 1], [1, 2, 1], [2, 1, 1]]);
  assert.equal(det(r, "s3").estado, E.SIN_COPIA, "la copia del ciclo 1 no sirve para el ciclo 2");
  assert.equal(r.global.sesiones_total, 3); assert.equal(r.global.estado, "parcial"); assert.equal(r.global.porcentajes.cobertura_sesiones.valor, 67);
  const mal = correr({ sesiones: [ses(1, 0, 1, F1)], copias: [copias[0]], series: completaDiaA(1, 1, F1).map((s) => Object.assign({}, s, { semana: 3 })) });
  assert.equal(det(mal, "s1").estado, E.SEMANA_INCONSISTENTE);
});
test("vinculo solo por sesion_uid unico: uid duplicado en sesiones o series de otra sesion/alumno no se atribuyen", () => {
  const copias = [copia(0, 1, F1)];
  const dup = correr({ sesiones: [ses(1, 0, 1, F1), ses(9, 0, 1, F1, { sesion_uid: U(1) })], copias, series: completaDiaA(1, 1, F1) });
  assert.deepEqual(dup.vinculo.uid_ambiguos, [U(1)]); assert.equal(dup.vinculo.series_vinculadas, 0); assert.notEqual(det(dup, "s1").estado, E.VERIFICABLE);
  assert.equal(det(dup, "s1").estado, E.SERIES_SIN_VINCULO, "series sin vinculo: NO se informa como sesion sin series ejecutadas (todo omitido)"); assert.equal(dup.semanas[0].ejercicios.omitidos, 0);
  const otro = correr({ sesiones: [ses(1, 0, 1, F1)], copias, series: [...completaDiaA(1, 1, F1), ...completaDiaA(5, 1, F1)] });
  assert.equal(otro.vinculo.series_sin_sesion, 8); assert.equal(det(otro, "s1").estado, E.SERIES_SIN_VINCULO, "series del mismo dia sin sesion registrada: ambiguas, no se descartan en silencio");
  const otroDia = correr({ sesiones: [ses(1, 0, 1, F1)], copias, series: [...completaDiaA(1, 1, F1), ...completaDiaA(5, 1, F2)] });
  assert.equal(det(otroDia, "s1").estado, E.VERIFICABLE, "series sin sesion de OTRA fecha se excluyen con evidencia");
  const deOtraSesion = correr({ sesiones: [ses(1, 0, 1, F1), ses(5, 1, 1, F1)], copias: [copias[0], copia(1, 1, F1)], series: [...completaDiaA(1, 1, F1), ...completaDiaB(5, 1, F1)] });
  assert.equal(det(deOtraSesion, "s1").estado, E.VERIFICABLE, "series vinculadas a otra sesion del mismo dia no contaminan");
  const ajena = correr({ sesiones: [ses(1, 0, 1, F1)], copias, series: completaDiaA(1, 1, F1).map((s) => Object.assign({}, s, { alumno_id: "otro" })) });
  assert.notEqual(det(ajena, "s1").estado, E.VERIFICABLE, "series de otro alumno => vinculo incoherente");
});
test("evidencia de finalizacion: solo identidad_v 1 + uid v4 (no validada por coach); explicita se respeta; historica no se marca", () => {
  assert.equal(sesionConEvidenciaDeFinalizacion(ses(1, 0, 1, F1)).sesion.completada, true);
  assert.equal(sesionConEvidenciaDeFinalizacion(ses(1, 0, 1, F1, { origen: "validada_coach" })).evidencia, EV.NINGUNA);
  assert.equal(sesionConEvidenciaDeFinalizacion(ses(1, 0, 1, F1, { identidad_v: 2 })).evidencia, EV.NINGUNA);
  assert.equal(sesionConEvidenciaDeFinalizacion(ses(1, 0, 1, F1, { sesion_uid: "x" })).evidencia, EV.NINGUNA);
  assert.equal(sesionConEvidenciaDeFinalizacion(ses(1, 0, 1, F1, { completada: false })).sesion.completada, false);
  assert.equal(sesionConEvidenciaDeFinalizacion({ id: 1, alumno_id: ALU }).evidencia, EV.NINGUNA);
  const v = correr({ sesiones: [ses(1, 0, 1, F1, { origen: "validada_coach", sesion_uid: null, identidad_v: null })], copias: [], series: [] });
  assert.equal(det(v, "s1").estado, E.VALIDACION_MANUAL_SIN_SERIES);
});
test("entradas vacias o invalidas no lanzan; no muta las entradas; resultado serializable", () => {
  for (const x of [undefined, null, {}, { sesiones: "x", copias: 3, series: {} }]) { const r = compararSesionesDelAlumno(x); assert.equal(r.global.estado, "sin_sesiones"); assert.equal(r.global.porcentajes.cobertura_sesiones.valor, null); }
  const copias = [copia(0, 1, F1)]; const input = deepFreeze({ sesiones: [ses(1, 0, 1, F1)], copias, series: completaDiaA(1, 1, F1), contexto: { registroSeriesCompleto: true, planificacionMostradaHash: copias[0].prescripcion_hash } });
  const r = compararSesionesDelAlumno(input); assert.deepEqual(JSON.parse(JSON.stringify(r)), r); assert.equal(r.semanas[0].estado, "completo");
  assert.deepEqual(compararSesionesDelAlumno(clone(input)), r, "determinista");
});
console.log("\n" + n + " pruebas OK");
