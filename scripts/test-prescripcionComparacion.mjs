// Comparacion prescrito vs ejecutado (PR-B, modulo puro): node scripts/test-prescripcionComparacion.mjs
// Datos 100 % ficticios. Sin red, sin Supabase, sin almacenamiento.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compararPrescripcionEjecucion, interpretarPrescripcion, ESTADO_COMPARACION as E, RESULTADO as R } from "../lib/prescripcionComparacion.js";
import { buildPrescripcionSnapshot } from "../lib/prescripcionSnapshot.js";

let n = 0;
function test(name, fn) { fn(); n++; console.log("ok -", name); }
const clone = (o) => JSON.parse(JSON.stringify(o));
function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
}

// ---------------------------------------------------------------- fixtures ficticias
const ALU = "alu-ficticio-1";
const RUT = "rut-ficticia-1";
const FECHA = "10/11/2026";
function rutina() {
  return {
    id: RUT, nombre: "Rutina ficticia", alumno_id: ALU,
    datos: {
      semana_activa: 1,
      days: [
        {
          label: "Día A",
          warmup: [{ id: "ex-sq", name: "Sentadilla liviana", sets: "2", reps: "12", kg: "20" }],
          exercises: [
            { id: "ex-sq", name: "Sentadilla", sets: "3", reps: "8-10", kg: "50" },
            { id: "ex-press", name: "Press", sets: "3", reps: "10", kg: "30-35" },
            { id: "ex-sq", name: "Sentadilla repetida", sets: "2", reps: "12", kg: "40" },
            { id: "ex-plancha", name: "Plancha", sets: "2", reps: "45s", kg: "PC" },
            { id: "ex-trote", name: "Trote", sets: "1", reps: "400 m", kg: "" },
            { id: "ex-amrap", name: "Final", sets: "AMRAP", reps: "max", kg: "70%" },
          ],
        },
        { label: "Día B", warmup: [], exercises: [{ id: "ex-remo", name: "Remo", sets: "3", reps: "10", kg: "40" }] },
      ],
    },
  };
}
// Copia guardada tal como la devolveria la tabla propuesta (fila + snapshot + huella).
function copiaRow(over, buildOver, rut) {
  const r = buildPrescripcionSnapshot(Object.assign({ rutina: rut || rutina(), alumnoId: ALU, diaIdx: 0, semana: 1, fecha: FECHA, semanaMostrada: 1, capturadaEn: "2026-11-10T21:00:00.000Z" }, buildOver || {}));
  assert.equal(r.ok, true);
  return Object.assign({
    alumno_id: r.clave.alumno_id, rutina_id: r.clave.rutina_id, ciclo: r.clave.ciclo, semana: r.clave.semana, dia_idx: r.clave.dia_idx,
    fecha_dia: r.clave.fecha_dia, prescripcion_hash: r.hash, snapshot: r.snapshot, origen_lectura: "servidor",
  }, over || {});
}
function sesion(over) {
  return Object.assign({ id: "ses-1", alumno_id: ALU, rutina_id: RUT, ciclo: 1, semana: 1, dia_idx: 0, fecha: FECHA, completada: true }, over || {});
}
let seq = 0;
function serie(bloque, pos, ejId, kg, reps, over) {
  return Object.assign({ id: "s-" + (++seq), sesion_id: "ses-1", alumno_id: ALU, rutina_id: RUT, ciclo: 1, semana: 0, fecha: FECHA, dia_idx: 0, bloque, pos, ejercicio_id: ejId, kg, reps }, over || {});
}
function seriesCompletas() {
  return [
    serie("warmup", 0, "ex-sq", 20, 12), serie("warmup", 0, "ex-sq", 20, 12),
    serie("main", 0, "ex-sq", 50, 8), serie("main", 0, "ex-sq", 50, 9), serie("main", 0, "ex-sq", 50, 10),
    serie("main", 1, "ex-press", 32, 10), serie("main", 1, "ex-press", 36, 10), serie("main", 1, "ex-press", 30, 10),
    serie("main", 2, "ex-sq", 40, 12),
    serie("main", 3, "ex-plancha", 0, 40), serie("main", 3, "ex-plancha", 0, 50),
  ];
}
function entrada(over) {
  const copia = copiaRow();
  return Object.assign({
    sesion: sesion(), copias: [copia], series: seriesCompletas(),
    contexto: { registroSeriesCompleto: true, planificacionMostradaHash: copia.prescripcion_hash },
  }, over || {});
}
const comparar = (over) => compararPrescripcionEjecucion(entrada(over));
const motivos = (r) => r.motivos.map((m) => m.estado + ":" + m.motivo);
const ej = (r, bloque, pos) => r.ejercicios.find((e) => e.bloque === bloque && e.pos === pos);

// ---------------------------------------------------------------- caso verificable completo
test("verificable: copia unica, sesion finalizada, series vinculadas por (sesion, bloque, pos)", () => {
  const r = comparar();
  assert.equal(r.estado, E.VERIFICABLE);
  assert.equal(r.verificable, true);
  assert.deepEqual(r.motivos, []);
  assert.equal(r.copia.estado, "unica");
  assert.equal(r.series.vinculadas, 11);
  assert.equal(r.series.sin_vinculo, 0);
  assert.equal(r.ejercicios.length, 7);
  const w = ej(r, "warmup", 0);
  assert.equal(w.variables.series.resultado, R.CUMPLE);
  assert.equal(w.variables.reps.resultado, R.CUMPLE);
  assert.equal(w.variables.kg.resultado, R.CUMPLE);
});

test("ejercicios repetidos con el mismo id: cada posicion usa SOLO sus series", () => {
  const r = comparar();
  const a = ej(r, "main", 0), b = ej(r, "main", 2);
  assert.equal(a.ejercicio_id, "ex-sq");
  assert.equal(b.ejercicio_id, "ex-sq");
  assert.equal(a.series_registradas, 3);
  assert.equal(b.series_registradas, 1);
  assert.deepEqual(a.variables.kg.ejecutado.valores, [50, 50, 50]);
  assert.deepEqual(b.variables.kg.ejecutado.valores, [40]);
  assert.equal(a.variables.reps.resultado, R.CUMPLE); // 8,9,10 dentro de 8-10
  assert.equal(b.variables.reps.resultado, R.CUMPLE);
});

test("ejercicio en calentamiento y bloque principal (mismo id y misma pos): el bloque los separa", () => {
  const r = comparar();
  assert.equal(ej(r, "warmup", 0).series_registradas, 2);
  assert.equal(ej(r, "main", 0).series_registradas, 3);
  // Una serie con bloque equivocado cae en la otra entrada: aqui el pos 5 de warmup no existe => vinculo incoherente.
  const mala = comparar({ series: seriesCompletas().concat([serie("warmup", 5, "ex-sq", 20, 12)]) });
  assert.equal(mala.estado, E.SERIES_SIN_VINCULO);
  assert.ok(motivos(mala).includes("series_sin_vinculo:vinculo_de_series_incoherente"));
});

test("asociar solo por ejercicio_id NO alcanza: sin sesion_id/bloque/pos => series_sin_vinculo", () => {
  const sinVinculo = seriesCompletas().map((s) => { const c = clone(s); delete c.sesion_id; delete c.bloque; delete c.pos; return c; });
  const r = comparar({ series: sinVinculo });
  assert.equal(r.estado, E.SERIES_SIN_VINCULO);
  assert.equal(r.series.sin_vinculo, 11);
  assert.equal(r.ejercicios, null);
  assert.equal(r.resumen, null);
});

test("vinculo incoherente: pos que apunta a un ejercicio con otro id => series_sin_vinculo (no se reasigna)", () => {
  const r = comparar({ series: seriesCompletas().concat([serie("main", 1, "ex-sq", 50, 8)]) }); // pos 1 es ex-press
  assert.equal(r.estado, E.SERIES_SIN_VINCULO);
  assert.equal(r.series.incoherentes, 1);
});

// ---------------------------------------------------------------- series ajenas
test("series de otra sesion, dia, semana, rutina, ciclo o alumno se excluyen y se informan; la comparacion sigue verificable", () => {
  const ajenas = [
    serie("main", 0, "ex-sq", 99, 1, { sesion_id: "ses-OTRA" }),
    serie("main", 0, "ex-sq", 99, 1, { sesion_id: undefined, dia_idx: 1 }),
    serie("main", 0, "ex-sq", 99, 1, { sesion_id: undefined, semana: 2 }),
    serie("main", 0, "ex-sq", 99, 1, { sesion_id: undefined, rutina_id: "rut-otra" }),
    serie("main", 0, "ex-sq", 99, 1, { sesion_id: undefined, ciclo: 2 }),
    serie("main", 0, "ex-sq", 99, 1, { sesion_id: undefined, alumno_id: "alu-otro" }),
    serie("main", 0, "ex-sq", 99, 1, { sesion_id: undefined, fecha: "11/11/2026" }),
  ];
  const r = comparar({ series: seriesCompletas().concat(ajenas) });
  assert.equal(r.estado, E.VERIFICABLE, JSON.stringify(r.motivos));
  assert.deepEqual(r.series.excluidas, {
    otra_sesion: 1, otro_alumno: 1, otra_rutina: 1, otro_ciclo: 1, otra_semana: 1, otra_fecha: 1, otro_dia: 1, fila_invalida: 0, duplicada: 0,
  });
  assert.equal(ej(r, "main", 0).series_registradas, 3);
});

test("series que dicen ser de la sesion pero son de otro alumno, rutina, ciclo, dia o fecha => vinculo incoherente (no se descartan en silencio)", () => {
  ["alumno_id:alu-otro", "rutina_id:rut-otra", "ciclo:2", "dia_idx:1", "fecha:11/11/2026"].forEach((par) => {
    const [k, v] = par.split(":");
    const r = comparar({ series: seriesCompletas().concat([serie("main", 0, "ex-sq", 50, 8, { [k]: k === "ciclo" || k === "dia_idx" ? Number(v) : v })]) });
    assert.equal(r.estado, E.SERIES_SIN_VINCULO, par);
    assert.equal(r.series.incoherentes, 1, par);
  });
});

test("serie duplicada (mismo id) se cuenta una sola vez", () => {
  const base = seriesCompletas();
  const r = comparar({ series: base.concat([clone(base[2])]) });
  assert.equal(r.estado, E.VERIFICABLE);
  assert.equal(r.series.excluidas.duplicada, 1);
  assert.equal(ej(r, "main", 0).series_registradas, 3);
});

// ---------------------------------------------------------------- semana base 0 / base 1
test("progreso semana base 0 vs sesiones base 1: la serie semana 0 corresponde a la semana 1", () => {
  assert.equal(comparar().estado, E.VERIFICABLE);
});

test("serie vinculada con semana en base 1 (confusion de base) => semana_inconsistente, no se compara", () => {
  const r = comparar({ series: seriesCompletas().concat([serie("main", 0, "ex-sq", 50, 8, { semana: 1 })]) });
  assert.equal(r.estado, E.SEMANA_INCONSISTENTE);
  assert.ok(motivos(r).includes("semana_inconsistente:semana_de_las_series_distinta"));
  assert.equal(r.ejercicios, null);
});

test("contexto.semanaBaseSeries = 1 permite series con semana base 1 (base explicita, nunca adivinada)", () => {
  const base1 = seriesCompletas().map((s) => Object.assign({}, s, { semana: 1 }));
  const r = comparar({ series: base1, contexto: Object.assign({}, entrada().contexto, { semanaBaseSeries: 1 }) });
  assert.equal(r.estado, E.VERIFICABLE);
  // y con la base por defecto (0) esas mismas series son inconsistentes
  assert.equal(comparar({ series: base1 }).estado, E.SEMANA_INCONSISTENTE);
});

test("semana de la copia distinta de la sesion => semana_inconsistente", () => {
  const c = copiaRow();
  c.snapshot.semana = 2; c.prescripcion_hash = copiaRow().prescripcion_hash; // columnas = sesion; contenido dice semana 2
  // la huella no incluye la semana: sigue integra, pero el contenido contradice la clave
  const r = comparar({ copias: [c], contexto: { registroSeriesCompleto: true, planificacionMostradaHash: c.prescripcion_hash } });
  assert.equal(r.estado, E.SEMANA_INCONSISTENTE);
  assert.ok(motivos(r).includes("semana_inconsistente:semana_de_la_copia_distinta"));
});

test("semana mostrada distinta de la de la sesion => semana_inconsistente; sin semana mostrada => copia_cache", () => {
  const c = copiaRow({}, { semanaMostrada: 2 });
  const r = comparar({ copias: [c], contexto: { registroSeriesCompleto: true, planificacionMostradaHash: c.prescripcion_hash } });
  assert.equal(r.estado, E.SEMANA_INCONSISTENTE);
  const c2 = copiaRow({}, { semanaMostrada: undefined });
  const r2 = comparar({ copias: [c2], contexto: { registroSeriesCompleto: true, planificacionMostradaHash: c2.prescripcion_hash } });
  assert.equal(r2.estado, E.COPIA_CACHE);
  assert.ok(motivos(r2).includes("copia_cache:semana_mostrada_no_confirmada"));
});

// ---------------------------------------------------------------- copias
test("copia duplicada IDENTICA (reintento) sigue siendo unica y verificable", () => {
  const c = copiaRow();
  const r = comparar({ copias: [c, clone(c)] });
  assert.equal(r.estado, E.VERIFICABLE);
  assert.equal(r.copia.estado, "unica");
});

test("copias ambiguas (misma clave, huellas distintas) => ambigua; no se elige ninguna", () => {
  const r2 = rutina(); r2.datos.days[0].exercises[0].kg = "60"; // el entrenador edito entre dos inicios del mismo dia
  const c1 = copiaRow(), c2 = copiaRow({}, {}, r2);
  assert.notEqual(c1.prescripcion_hash, c2.prescripcion_hash);
  const r = comparar({ copias: [c1, c2] });
  assert.equal(r.estado, E.AMBIGUA);
  assert.equal(r.ejercicios, null);
  assert.equal(r.copia.hash, null);
});

test("sin copia (sesion historica anterior a las copias) => sin_copia; la rutina actual NO se usa para reconstruir", () => {
  const actual = rutina();
  const r = compararPrescripcionEjecucion(Object.assign(entrada({ copias: [] }), { rutina: actual, rutinaActual: actual }));
  assert.equal(r.estado, E.SIN_COPIA);
  assert.equal(r.ejercicios, null);
  assert.equal(r.resumen, null);
  // y con copia valida, un argumento `rutina` distinto no cambia nada
  const rutinaCambiada = rutina(); rutinaCambiada.datos.days[0].exercises[0].kg = "999";
  const conRutina = compararPrescripcionEjecucion(Object.assign(entrada(), { rutina: rutinaCambiada }));
  assert.deepEqual(conRutina, comparar());
  assert.equal(ej(conRutina, "main", 0).variables.kg.prescrito.valor, 50);
});

test("copia de otra clave (otro dia/fecha/semana/ciclo/rutina/alumno) no cuenta => sin_copia", () => {
  [{ dia_idx: 1 }, { fecha_dia: "2026-11-09" }, { semana: 2 }, { ciclo: 2 }, { rutina_id: "rut-otra" }, { alumno_id: "alu-otro" }].forEach((over) => {
    const r = comparar({ copias: [copiaRow(over)] });
    assert.equal(r.estado, E.SIN_COPIA, JSON.stringify(over));
  });
});

test("copia con sesion_id de OTRA sesion se descarta; sin sesion_id o con el propio se acepta", () => {
  assert.equal(comparar({ copias: [copiaRow({ sesion_id: "ses-OTRA" })] }).estado, E.SIN_COPIA);
  assert.equal(comparar({ copias: [copiaRow({ sesion_id: "ses-1" })] }).estado, E.VERIFICABLE);
});

test("copia no integra (huella o contenido alterados, version desconocida) => sin_copia", () => {
  const manipulada = copiaRow(); manipulada.snapshot.ejercicios[1].kg = "999";
  assert.equal(comparar({ copias: [manipulada] }).estado, E.SIN_COPIA);
  assert.ok(motivos(comparar({ copias: [manipulada] })).includes("sin_copia:copia_no_integra"));
  const huella = copiaRow({ prescripcion_hash: "sha256:00" });
  assert.equal(comparar({ copias: [huella] }).estado, E.SIN_COPIA);
  const v2 = copiaRow(); v2.snapshot.v = 2;
  assert.equal(comparar({ copias: [v2] }).estado, E.SIN_COPIA);
});

test("contenido de la copia que contradice la clave (dia/rutina/ciclo) => sin_copia (no corresponde a la sesion)", () => {
  // integra (huella recalculada), pero el contenido es del dia 1 mientras las columnas y la sesion son del dia 0
  const r0 = buildPrescripcionSnapshot({ rutina: rutina(), alumnoId: ALU, diaIdx: 1, semana: 1, fecha: FECHA, semanaMostrada: 1 });
  const c2 = copiaRow({ snapshot: Object.assign({}, r0.snapshot), prescripcion_hash: r0.hash }); // columnas del dia 0, contenido del dia 1
  const r = comparar({ copias: [c2] });
  assert.equal(r.estado, E.SIN_COPIA);
  assert.ok(motivos(r).includes("sin_copia:copia_no_corresponde_a_la_sesion"));
});

test("sesion sin clave valida (sin rutina_id, semana fuera de 1..4, fecha invalida) => sin_copia", () => {
  [{ rutina_id: undefined }, { semana: 0 }, { semana: 5 }, { fecha: "2026-11-10" }, { dia_idx: -1 }].forEach((over) => {
    const r = comparar({ sesion: sesion(over) });
    assert.equal(r.estado, E.SIN_COPIA, JSON.stringify(over));
  });
  assert.equal(compararPrescripcionEjecucion({}).estado, E.SIN_COPIA);
  assert.equal(compararPrescripcionEjecucion(null).verificable, false);
});

// ---------------------------------------------------------------- cache y planificacion mostrada
test("copia leida de cache => copia_cache", () => {
  const r = comparar({ copias: [copiaRow({ origen_lectura: "cache" })] });
  assert.equal(r.estado, E.COPIA_CACHE);
  assert.ok(motivos(r).includes("copia_cache:copia_leida_de_cache"));
  assert.equal(r.ejercicios, null);
});

test("origen de lectura ausente o fuente de captura distinta de datos_servidor => copia_cache", () => {
  const sinOrigen = copiaRow(); delete sinOrigen.origen_lectura;
  assert.equal(comparar({ copias: [sinOrigen] }).estado, E.COPIA_CACHE);
  const local = copiaRow(); local.snapshot.captura.fuente = "local_storage";
  local.prescripcion_hash = copiaRow().prescripcion_hash; // la huella no incluye la captura
  const r = comparar({ copias: [local] });
  assert.equal(r.estado, E.COPIA_CACHE);
  assert.ok(motivos(r).includes("copia_cache:fuente_de_captura_no_confirmada"));
});

test("planificacion del servidor diferente de la mostrada => ambigua; sin huella de lo mostrado => copia_cache", () => {
  const mostradaDistinta = rutina(); mostradaDistinta.datos.days[0].exercises[0].reps = "5";
  const hMostrada = buildPrescripcionSnapshot({ rutina: mostradaDistinta, alumnoId: ALU, diaIdx: 0, semana: 1, fecha: FECHA }).hash;
  const r = comparar({ contexto: { registroSeriesCompleto: true, planificacionMostradaHash: hMostrada } });
  assert.equal(r.estado, E.AMBIGUA);
  assert.ok(motivos(r).includes("ambigua:planificacion_mostrada_distinta_de_la_del_servidor"));
  const sin = comparar({ contexto: { registroSeriesCompleto: true } });
  assert.equal(sin.estado, E.COPIA_CACHE);
  assert.ok(motivos(sin).includes("copia_cache:planificacion_mostrada_no_confirmada"));
});

// ---------------------------------------------------------------- finalizacion
test("sesion sin finalizar (pendiente, completada=false, sin marca) => sin_finalizar; la ausencia de marca NO se acepta como completa", () => {
  [{ estado: "pendiente", completada: undefined }, { completada: false }, { completada: undefined }, { completada: null }, { completada: "true" }, { estado: "" , completada: undefined }].forEach((over) => {
    const r = comparar({ sesion: sesion(over) });
    assert.equal(r.estado, E.SIN_FINALIZAR, JSON.stringify(over));
    assert.equal(r.ejercicios, null);
  });
  assert.equal(comparar({ sesion: sesion({ completada: undefined, estado: "finalizada" }) }).estado, E.VERIFICABLE);
});

test("sesion sin id => series_sin_vinculo (sin id no hay vinculo posible)", () => {
  const r = comparar({ sesion: sesion({ id: undefined }) });
  assert.equal(r.estado, E.SERIES_SIN_VINCULO);
  assert.ok(motivos(r).includes("series_sin_vinculo:sesion_sin_id"));
});

test("varios problemas: estado = el de mayor prioridad, motivos = todos", () => {
  const r = comparar({ copias: [copiaRow({ origen_lectura: "cache" })], sesion: sesion({ completada: false }) });
  assert.equal(r.estado, E.COPIA_CACHE);
  assert.deepEqual(motivos(r), ["copia_cache:copia_leida_de_cache", "sin_finalizar:sesion_pendiente"]);
});

// ---------------------------------------------------------------- interpretacion de valores
test("interpretarPrescripcion: numero, rango, tiempo, distancia, peso corporal, texto y vacio", () => {
  const t = (v) => interpretarPrescripcion(v);
  assert.deepEqual([t("8").tipo, t("8").valor], ["numero", 8]);
  assert.deepEqual([t("82,5").tipo, t("82,5").valor], ["numero", 82.5]);
  assert.deepEqual([t("8-10").tipo, t("8-10").min, t("8-10").max], ["rango", 8, 10]);
  assert.deepEqual([t("8 – 10").min, t("8 – 10").max], [8, 10]);
  assert.equal(t("10-8").tipo, "texto"); // rango invertido: no se adivina
  assert.deepEqual([t("45s").tipo, t("45s").min, t("45s").max], ["tiempo", 45, 45]);
  assert.deepEqual([t("30-45 s").min, t("30-45 s").max], [30, 45]);
  assert.equal(t("2 min").min, 120);
  assert.equal(t("1:30").min, 90);
  assert.deepEqual([t("400 m").tipo, t("400 m").valor], ["distancia", 400]);
  assert.equal(t("1,5 km").valor, 1500);
  assert.equal(t("PC").tipo, "peso_corporal");
  assert.equal(t("peso corporal").tipo, "peso_corporal");
  assert.equal(t("").tipo, "vacio");
  assert.equal(t("   ").tipo, "vacio");
  assert.equal(t(null).tipo, "vacio");
  ["AMRAP", "70%", "+10kg", "10 c/lado", "RIR 2"].forEach((x) => assert.equal(t(x).tipo, "texto", x));
});

// ---------------------------------------------------------------- variables
test("repeticiones por rango: dentro, por debajo, por encima y mixto", () => {
  const mk = (reps) => comparar({ series: [serie("main", 0, "ex-sq", 50, reps[0]), serie("main", 0, "ex-sq", 50, reps[1]), serie("main", 0, "ex-sq", 50, reps[2])] });
  assert.equal(ej(mk([8, 9, 10]), "main", 0).variables.reps.resultado, R.CUMPLE);
  assert.equal(ej(mk([6, 7, 7]), "main", 0).variables.reps.resultado, R.POR_DEBAJO);
  assert.equal(ej(mk([11, 12, 12]), "main", 0).variables.reps.resultado, R.POR_ENCIMA);
  const mixto = ej(mk([6, 9, 12]), "main", 0).variables.reps;
  assert.equal(mixto.resultado, R.MIXTO);
  assert.deepEqual(mixto.por_serie, ["por_debajo", "cumple", "por_encima"]);
  assert.deepEqual(mixto.prescrito, { tipo: "rango", texto: "8-10", min: 8, max: 10 });
});

test("cargas: numerica y rango; vacio, texto/% y valor ejecutado cero o invalido no son comparables", () => {
  const r = comparar();
  const press = ej(r, "main", 1).variables.kg;
  assert.equal(press.resultado, R.MIXTO); // 32 dentro, 36 por encima, 30 dentro de 30-35
  assert.deepEqual(press.por_serie, ["cumple", "por_encima", "cumple"]);
  assert.equal(ej(r, "main", 0).variables.kg.resultado, R.CUMPLE);
  // kg prescrito vacio / texto
  const trote = ej(r, "main", 4).variables.kg;
  assert.deepEqual([trote.estado, trote.motivo, trote.resultado], ["no_comparable", "prescripcion_vacia", "no_comparable"]);
  const rr = comparar({ series: seriesCompletas().concat([serie("main", 5, "ex-amrap", 70, 10)]) });
  assert.equal(ej(rr, "main", 5).variables.kg.motivo, "prescripcion_texto");
  // ejecutado 0 contra carga prescrita
  const cero = comparar({ series: [serie("main", 0, "ex-sq", 0, 8)] });
  assert.equal(ej(cero, "main", 0).variables.kg.motivo, "kg_ejecutado_vacio_o_cero");
  // ejecutado invalido / ausente
  const inval = comparar({ series: [serie("main", 0, "ex-sq", "80abc", 8), serie("main", 0, "ex-sq", 50, 8)] });
  assert.equal(ej(inval, "main", 0).variables.kg.motivo, "valor_ejecutado_invalido");
  const nulo = comparar({ series: [serie("main", 0, "ex-sq", null, 8)] });
  assert.equal(ej(nulo, "main", 0).variables.kg.motivo, "valor_ejecutado_invalido");
  // la repeticion de esa misma serie sigue siendo comparable
  assert.equal(ej(nulo, "main", 0).variables.reps.estado, "comparable");
});

test("peso corporal: kg 0 cumple; con carga ejecutada no es comparable", () => {
  const r = comparar();
  const plancha = ej(r, "main", 3);
  assert.equal(plancha.variables.kg.resultado, R.CUMPLE);
  assert.equal(plancha.variables.reps.prescrito.tipo, "tiempo");
  assert.equal(plancha.variables.reps.estado, "no_comparable"); // ver prueba "tiempo: unidad no garantizada"
  const lastre = comparar({ series: [serie("main", 3, "ex-plancha", 10, 45)] });
  assert.equal(ej(lastre, "main", 3).variables.kg.motivo, "peso_corporal_con_carga_ejecutada");
});

test("distancia y texto en reps no son comparables (sin unidad ejecutada registrada)", () => {
  const r = comparar({ series: seriesCompletas().concat([serie("main", 4, "ex-trote", 0, 400), serie("main", 5, "ex-amrap", 70, 12)]) });
  assert.equal(ej(r, "main", 4).variables.reps.motivo, "distancia_sin_unidad_registrada");
  assert.equal(ej(r, "main", 5).variables.reps.motivo, "prescripcion_texto");
  assert.equal(ej(r, "main", 5).variables.series.motivo, "prescripcion_no_numerica");
  assert.equal(ej(r, "main", 5).estado, E.NO_COMPARABLE);
});

test("serie faltante vs omitida: solo es 'por_debajo' (omitida) con registro completo; si no, no_comparable", () => {
  const una = [serie("main", 2, "ex-sq", 40, 12)]; // main pos 2 pide 2 series
  const completo = comparar({ series: una });
  const v = ej(completo, "main", 2).variables.series;
  assert.deepEqual([v.estado, v.resultado, v.omitidas], ["comparable", "por_debajo", 1]);
  const incompleto = comparar({ series: una, contexto: { registroSeriesCompleto: false, planificacionMostradaHash: copiaRow().prescripcion_hash } });
  const w = ej(incompleto, "main", 2).variables.series;
  assert.deepEqual([w.estado, w.motivo, w.resultado], ["no_comparable", "faltantes_sin_evidencia_de_registro_completo", "no_comparable"]);
  assert.equal(w.ejecutado.minimo_registrado, 1);
  assert.equal(w.omitidas, undefined);
  // la evidencia de registro completo debe ser exactamente `true`
  const truthy = comparar({ series: una, contexto: { registroSeriesCompleto: "si", planificacionMostradaHash: copiaRow().prescripcion_hash } });
  assert.equal(ej(truthy, "main", 2).variables.series.resultado, R.NO_COMPARABLE);
  // series de mas se informan aunque el registro este incompleto (el minimo ya supera lo pedido)
  const mas = comparar({ series: [1, 2, 3].map(() => serie("main", 2, "ex-sq", 40, 12)), contexto: { planificacionMostradaHash: copiaRow().prescripcion_hash } });
  assert.equal(ej(mas, "main", 2).variables.series.resultado, R.POR_ENCIMA);
});

test("ejercicio prescrito sin ninguna serie y registro completo => series por_debajo; reps y kg sin series ejecutadas", () => {
  const r = comparar({ series: [] });
  const sq = ej(r, "main", 0);
  assert.equal(sq.variables.series.resultado, R.POR_DEBAJO);
  assert.equal(sq.variables.series.omitidas, 3);
  assert.equal(sq.variables.reps.motivo, "sin_series_ejecutadas");
  assert.equal(sq.estado, E.VERIFICABLE);
});

// ---------------------------------------------------------------- revision final (PR #178)
test("tiempo: unidad no garantizada => reps no_comparable para cualquier prescripcion por tiempo y cualquier valor ejecutado", () => {
  ["45s", "30-45 s", "2 min", "1:30", '60"'].forEach((t) => {
    const rt = rutina(); rt.datos.days[0].exercises[3].reps = t;
    const c = copiaRow({}, {}, rt);
    [45, 2, 120, 1].forEach((valor) => {
      const r = compararPrescripcionEjecucion({
        sesion: sesion(), copias: [c], series: [serie("main", 3, "ex-plancha", 0, valor)],
        contexto: { registroSeriesCompleto: true, planificacionMostradaHash: c.prescripcion_hash },
      });
      assert.equal(r.estado, E.VERIFICABLE, t);
      const v = ej(r, "main", 3).variables.reps;
      assert.deepEqual([v.estado, v.motivo, v.resultado], ["no_comparable", "unidad_de_series_no_garantizada", "no_comparable"], t + "/" + valor);
      assert.equal(v.ejecutado, null);
    });
  });
  // las series (cantidad) y el kg de ese mismo ejercicio siguen siendo comparables
  const r = comparar();
  assert.equal(ej(r, "main", 3).variables.series.estado, "comparable");
  assert.equal(ej(r, "main", 3).variables.kg.estado, "comparable");
  // la prescripcion por tiempo sigue interpretandose (para la UI), solo que no se compara
  assert.equal(interpretarPrescripcion("45s").tipo, "tiempo");
});

test("validacion manual del entrenador => validacion_manual_sin_series (no sin_finalizar, ni sin_copia aunque no haya copia)", () => {
  [{ origen: "validada_coach" }, { origen: "validada_coach", completada: false }, { origen: "validada_coach", completada: undefined }].forEach((over) => {
    [[], [copiaRow()]].forEach((copias) => {
      const r = comparar({ sesion: sesion(over), copias });
      assert.equal(r.estado, E.VALIDACION_MANUAL_SIN_SERIES, JSON.stringify(over));
      assert.equal(r.verificable, false);
      assert.equal(r.ejercicios, null);
      assert.equal(r.resumen, null);
      assert.ok(motivos(r).includes("validacion_manual_sin_series:validada_por_el_entrenador"));
      assert.equal(motivos(r).some((m) => m.startsWith("sin_finalizar:")), false);
    });
  });
  // una sesion NO validada manualmente sigue siendo sin_finalizar
  assert.equal(comparar({ sesion: sesion({ completada: false }) }).estado, E.SIN_FINALIZAR);
});

test("lista de series vacia NO implica ejercicios omitidos sin evidencia explicita de registro completo", () => {
  const h = copiaRow().prescripcion_hash;
  const sin = (registroSeriesCompleto, series) => compararPrescripcionEjecucion({
    sesion: sesion(), copias: [copiaRow()], series, contexto: { registroSeriesCompleto, planificacionMostradaHash: h },
  });
  [[false, []], [undefined, []], ["true", []], [1, []], [true, undefined], [true, null]].forEach(([flag, series]) => {
    const r = sin(flag, series);
    assert.equal(r.estado, E.VERIFICABLE);
    r.ejercicios.forEach((e) => {
      const v = e.variables.series;
      assert.equal(v.estado, "no_comparable", JSON.stringify([flag, series]));
      assert.notEqual(v.resultado, R.POR_DEBAJO);
      assert.equal(v.omitidas, undefined);
    });
    assert.equal(JSON.stringify(r).includes('"omitidas"'), false);
  });
  // con evidencia explicita (true + lista provista) si se informa como omitida
  const ok = sin(true, []);
  assert.equal(ej(ok, "main", 0).variables.series.omitidas, 3);
  // aun con la marca explicita, las omitidas nunca cuentan como cumplidas
  assert.equal(ok.resumen.variables.series.cumplen, 0);
});

test("copia corrupta, planificacion distinta y series sin vinculo: sin comparacion, sin ejercicios, sin porcentajes", () => {
  const corrupta = copiaRow(); corrupta.snapshot.ejercicios[1].kg = "999";
  const mostradaOtra = rutina(); mostradaOtra.datos.days[0].exercises[0].reps = "5";
  const hOtra = buildPrescripcionSnapshot({ rutina: mostradaOtra, alumnoId: ALU, diaIdx: 0, semana: 1, fecha: FECHA }).hash;
  const casos = [
    [comparar({ copias: [corrupta] }), E.SIN_COPIA],
    [comparar({ contexto: { registroSeriesCompleto: true, planificacionMostradaHash: hOtra } }), E.AMBIGUA],
    [comparar({ series: seriesCompletas().map((s) => { const c = clone(s); delete c.bloque; delete c.pos; return c; }).map((s) => { delete s.sesion_id; return s; }) }), E.SERIES_SIN_VINCULO],
    [comparar({ series: seriesCompletas().concat([serie("main", 1, "ex-sq", 50, 8)]) }), E.SERIES_SIN_VINCULO], // vinculo incoherente
  ];
  casos.forEach(([r, esperado]) => {
    assert.equal(r.estado, esperado);
    assert.equal(r.verificable, false);
    assert.equal(r.ejercicios, null);
    assert.equal(r.resumen, null);
    const json = JSON.stringify(r);
    ["porcentajes", "variables", "resultado", "por_debajo", "cumple"].forEach((t) => assert.equal(json.includes(t), false, esperado + " no debe contener " + t));
  });
});

// ---------------------------------------------------------------- porcentajes
test("porcentajes: null con motivo si algun denominador es invalido; calculados solo con todo comparable", () => {
  const r = comparar();
  assert.equal(r.resumen.ejercicios_total, 7);
  assert.equal(r.resumen.porcentajes.series.valor, null); // "AMRAP" no es comparable
  assert.equal(r.resumen.porcentajes.series.motivo, "denominador_invalido");
  assert.ok(r.resumen.porcentajes.series.no_comparables >= 1);
  assert.equal(r.resumen.porcentajes.kg.valor, null);
  assert.equal(r.resumen.variables.series.total, 7);

  // rutina simple, todo comparable
  const simple = rutina(); simple.datos.days[0] = { label: "Día A", warmup: [], exercises: [
    { id: "a", name: "A", sets: "2", reps: "10", kg: "20" }, { id: "b", name: "B", sets: "2", reps: "10", kg: "20" },
  ] };
  const c = copiaRow({}, {}, simple);
  const ser = [
    serie("main", 0, "a", 20, 10), serie("main", 0, "a", 20, 10),
    serie("main", 1, "b", 20, 10), // b: falta una serie (registro completo)
  ];
  const s = compararPrescripcionEjecucion({ sesion: sesion(), copias: [c], series: ser, contexto: { registroSeriesCompleto: true, planificacionMostradaHash: c.prescripcion_hash } });
  assert.equal(s.estado, E.VERIFICABLE);
  assert.equal(s.resumen.porcentajes.series.valor, 50);
  assert.equal(s.resumen.porcentajes.reps.valor, 100);
  assert.equal(s.resumen.porcentajes.kg.valor, 100);
  assert.equal(s.resumen.variables.series.por_debajo, 1);
});

test("no verificable => sin ejercicios ni porcentajes (nunca una comparacion parcial)", () => {
  [{ copias: [] }, { sesion: sesion({ completada: false }) }, { copias: [copiaRow({ origen_lectura: "cache" })] }].forEach((over) => {
    const r = comparar(over);
    assert.equal(r.verificable, false);
    assert.equal(r.ejercicios, null);
    assert.equal(r.resumen, null);
  });
});

// ---------------------------------------------------------------- dos entrenamientos el mismo dia
test("dos entrenamientos el mismo dia (dia A y dia B): cada sesion usa su copia y sus series", () => {
  const cA = copiaRow(), cB = copiaRow({}, { diaIdx: 1 });
  const serB = [1, 2, 3].map(() => serie("main", 0, "ex-remo", 40, 10, { sesion_id: "ses-2", dia_idx: 1 }));
  const todas = seriesCompletas().concat(serB);
  const ctx = (c) => ({ registroSeriesCompleto: true, planificacionMostradaHash: c.prescripcion_hash });
  const a = compararPrescripcionEjecucion({ sesion: sesion(), copias: [cA, cB], series: todas, contexto: ctx(cA) });
  const b = compararPrescripcionEjecucion({ sesion: sesion({ id: "ses-2", dia_idx: 1 }), copias: [cA, cB], series: todas, contexto: ctx(cB) });
  assert.equal(a.estado, E.VERIFICABLE);
  assert.equal(b.estado, E.VERIFICABLE);
  assert.equal(a.series.vinculadas, 11);
  assert.equal(b.series.vinculadas, 3);
  assert.equal(a.series.excluidas.otra_sesion, 3);
  assert.equal(b.ejercicios[0].variables.series.resultado, R.CUMPLE);
});

test("dos entrenamientos el mismo dia y el MISMO dia de rutina con prescripciones distintas => ambigua; series sin vinculo => series_sin_vinculo", () => {
  const r2 = rutina(); r2.datos.days[0].exercises[0].kg = "60";
  const dos = comparar({ copias: [copiaRow(), copiaRow({}, {}, r2)] });
  assert.equal(dos.estado, E.AMBIGUA);
  // series de ese mismo dia/dia_idx sin sesion_id: no se sabe de cual de los dos entrenamientos son
  const sinId = seriesCompletas().map((s) => { const c = clone(s); delete c.sesion_id; return c; });
  const r = comparar({ series: sinId });
  assert.equal(r.estado, E.SERIES_SIN_VINCULO);
  assert.equal(r.series.sin_vinculo, 11);
});

// ---------------------------------------------------------------- inmutabilidad y pureza
test("no muta sus argumentos (entradas congeladas profundamente) y la salida no comparte referencias", () => {
  const input = deepFreeze(clone(entrada()));
  const antes = JSON.stringify(input);
  const r = compararPrescripcionEjecucion(input);
  assert.equal(r.estado, E.VERIFICABLE);
  assert.equal(JSON.stringify(input), antes);
  // casos no verificables tambien sobre entradas congeladas
  const malo = deepFreeze(clone(entrada({ copias: [copiaRow({ origen_lectura: "cache" })] })));
  assert.equal(compararPrescripcionEjecucion(malo).estado, E.COPIA_CACHE);
  // mutar la salida no toca la entrada
  const libre = clone(entrada());
  const out = compararPrescripcionEjecucion(libre);
  out.ejercicios[0].variables.kg.prescrito.valor = 1;
  out.motivos.push("x");
  assert.equal(compararPrescripcionEjecucion(libre).ejercicios[0].variables.kg.prescrito.valor, 20);
});

test("determinista y sin efectos secundarios: misma entrada => misma salida; red y almacenamiento no se tocan", () => {
  const tocado = [];
  const orig = { fetch: globalThis.fetch, xhr: globalThis.XMLHttpRequest, ls: globalThis.localStorage, now: Date.now };
  globalThis.fetch = () => { tocado.push("fetch"); throw new Error("red"); };
  globalThis.XMLHttpRequest = function () { tocado.push("xhr"); throw new Error("red"); };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { tocado.push("localStorage"); throw new Error("almacenamiento"); } });
  Date.now = () => { tocado.push("Date.now"); throw new Error("reloj"); };
  try {
    const a = comparar(), b = comparar();
    assert.deepEqual(a, b);
    comparar({ copias: [] });
  } finally {
    globalThis.fetch = orig.fetch; globalThis.XMLHttpRequest = orig.xhr; Date.now = orig.now;
    if (orig.ls === undefined) delete globalThis.localStorage; else Object.defineProperty(globalThis, "localStorage", { configurable: true, value: orig.ls });
  }
  assert.deepEqual(tocado, []);
});

test("modulo puro: sin reloj, red, almacenamiento, React, Supabase ni aleatoriedad; solo importa modulos puros de lib/", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(path.join(dir, "..", "lib", "prescripcionComparacion.js"), "utf8");
  const src = raw.replace(/\/\/.*$/gm, "");
  ["Date.now", "new Date", "localStorage", "sessionStorage", "fetch(", "XMLHttpRequest", "supabase", "react", "Math.random", "console.", "process.", "window", "document"].forEach((t) => {
    assert.equal(src.includes(t), false, "no debe usar " + t);
  });
  const imports = [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./cargaSerie.js", "./prescripcionSnapshot.js", "./rutinaCiclo.js"]);
});

console.log(n + " tests ok");
