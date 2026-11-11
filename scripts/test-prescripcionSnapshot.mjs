// Copia historica de la prescripcion por sesion (PR-A, modulo puro): node scripts/test-prescripcionSnapshot.mjs
// Datos 100 % ficticios. Sin red, sin Supabase, sin almacenamiento.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRESCRIPCION_SNAPSHOT_VERSION,
  buildPrescripcionSnapshot,
  clavePrescripcion,
  claveDeSesion,
  claveDeCopia,
  mismaClave,
  fechaSesionADia,
  prescripcionEfectivaEjercicio,
  huellaPrescripcion,
  jsonCanonico,
  sha256Hex,
  estadoCopiaDeSesion,
} from "../lib/prescripcionSnapshot.js";
import {
  resolveExerciseForWeek,
  updateExerciseKgInRoutines,
  sessionAlreadyExists,
  buildSessionPayload,
  removeUndefinedPayloadFields,
} from "../lib/workoutSession.js";
import { buildReinicioDatos, readCicloActual } from "../lib/rutinaCiclo.js";
import { fechaDeSesion } from "../lib/workoutSessionDate.js";

let n = 0;
function test(name, fn) { fn(); n++; console.log("ok -", name); }
const clone = (o) => JSON.parse(JSON.stringify(o));
function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); }
  return o;
}

// ---------------------------------------------------------------- fixtures ficticias
function sentadilla() {
  return {
    id: "ex-sentadilla", name: "Sentadilla ficticia", sets: "3", reps: "8-10", kg: "50", pause: 90, note: "base", progresion: "carga",
    weeks: [
      { sets: "4", reps: "6-8", kg: "60", pausa: "120", note: "RIR 2" },
      { sets: "", reps: "", kg: "65", pausa: "", note: "" },
      { sets: "5", reps: "5", kg: "", pausa: "150", note: "descarga" },
      { sets: "", reps: "", kg: "", pausa: "", note: "" },
    ],
  };
}
function rutinaFicticia(extraDatos) {
  return {
    id: "rut-ficticia-1",
    nombre: "Rutina ficticia",
    alumno_id: "alu-ficticio-1",
    created_at: "2026-10-01T10:00:00Z",
    datos: Object.assign({
      semana_activa: 2,
      days: [
        {
          label: "Día A",
          warmup: [{ id: "ex-movilidad", name: "Movilidad ficticia", sets: "2", reps: "45s", kg: "", pause: 30, duration: "45" }],
          exercises: [
            sentadilla(),
            { id: "ex-press", name: "Press ficticio", sets: "3", reps: "10", kg: "30", pause: 60, weeks: [] },
            { id: "ex-sentadilla", name: "Sentadilla ficticia", sets: "2", reps: "12", kg: "40", pause: 60 }, // repetido en el mismo dia
            { id: "ex-trote", name: "Trote ficticio", sets: "1", reps: "400 m", kg: "", pause: 0 },
          ],
        },
        { label: "Día B", warmup: [], exercises: [{ id: "ex-remo", name: "Remo ficticio", sets: "3", reps: "8-12", kg: "40", pause: 90 }] },
      ],
    }, extraDatos || {}),
  };
}
const BASE = { alumnoId: "alu-ficticio-1", diaIdx: 0, semana: 1, fecha: "10/11/2026", capturadaEn: "2026-11-10T21:00:00.000Z" };
function build(over, rutina) {
  return buildPrescripcionSnapshot(Object.assign({ rutina: rutina || rutinaFicticia() }, BASE, over || {}));
}
const ej = (r, bloque, pos) => r.snapshot.ejercicios.find((e) => e.bloque === bloque && e.pos === pos);

// ---------------------------------------------------------------- estructura y valores semanales
test("estructura v1: rutina, ciclo, semana, dia, ejercicios con orden/bloque/pos", () => {
  const r = build();
  assert.equal(r.ok, true);
  const s = r.snapshot;
  assert.equal(s.v, PRESCRIPCION_SNAPSHOT_VERSION);
  assert.equal(s.v, 1);
  assert.deepEqual(s.rutina, { id: "rut-ficticia-1", nombre: "Rutina ficticia", ciclo: 1, ciclo_base: 1, semanas_definidas: 4 });
  assert.equal(s.semana, 1);
  assert.equal(s.semana_mostrada, null);
  assert.deepEqual(s.dia, { idx: 0, label: "Día A", total_dias: 2 });
  assert.deepEqual(s.captura, { momento: "inicio", fuente: "datos_servidor" });
  assert.equal(s.capturada_en, "2026-11-10T21:00:00.000Z");
  assert.deepEqual(s.ejercicios.map((e) => [e.orden, e.bloque, e.pos, e.id]), [
    [0, "warmup", 0, "ex-movilidad"],
    [1, "main", 0, "ex-sentadilla"],
    [2, "main", 1, "ex-press"],
    [3, "main", 2, "ex-sentadilla"],
    [4, "main", 3, "ex-trote"],
  ]);
});

test("semana 1: valores semanales sobre los base, con origen 'semana'", () => {
  const e = ej(build({ semana: 1 }), "main", 0);
  assert.deepEqual([e.sets, e.reps, e.kg, e.pausa], ["4", "6-8", "60", "120"]);
  assert.deepEqual(e.origen, { sets: "semana", reps: "semana", kg: "semana", pausa: "semana" });
  assert.equal(e.nota_semana, "RIR 2");
  assert.equal(e.nota_base, "base");
  assert.equal(e.progresion, "carga");
});

test("semana con campos vacios: solo esos campos caen al base (origen 'base')", () => {
  const e2 = ej(build({ semana: 2 }), "main", 0);
  assert.deepEqual([e2.sets, e2.reps, e2.kg, e2.pausa], ["3", "8-10", "65", "90"]);
  assert.deepEqual(e2.origen, { sets: "base", reps: "base", kg: "semana", pausa: "base" });
  const e3 = ej(build({ semana: 3 }), "main", 0);
  assert.deepEqual([e3.sets, e3.reps, e3.kg, e3.pausa], ["5", "5", "50", "150"]);
  assert.equal(e3.origen.kg, "base");
  assert.equal(e3.nota_semana, "descarga");
  const e4 = ej(build({ semana: 4 }), "main", 0);
  assert.deepEqual(e4.origen, { sets: "base", reps: "base", kg: "base", pausa: "base" });
});

test("sin weeks o con weeks vacio: valores base; sin valor => origen 'vacio'", () => {
  const r = build({ semana: 3 });
  const press = ej(r, "main", 1);
  assert.deepEqual([press.sets, press.reps, press.kg, press.pausa], ["3", "10", "30", "60"]);
  assert.deepEqual(press.origen, { sets: "base", reps: "base", kg: "base", pausa: "base" });
  const mov = ej(r, "warmup", 0);
  assert.equal(mov.kg, "");
  assert.equal(mov.origen.kg, "vacio");
});

test("paridad exacta con resolveExerciseForWeek (sets/reps/kg/pausa) en todas las semanas y ejercicios", () => {
  const days = rutinaFicticia().datos.days;
  for (let semana = 1; semana <= 4; semana++) {
    days.forEach((day, diaIdx) => {
      const r = build({ semana, diaIdx });
      const fuente = [...day.warmup, ...day.exercises];
      assert.equal(r.snapshot.ejercicios.length, fuente.length);
      fuente.forEach((ex, i) => {
        const ref = resolveExerciseForWeek(ex, semana - 1);
        const got = r.snapshot.ejercicios[i];
        const t = (v) => (v == null ? "" : String(v));
        assert.deepEqual([got.sets, got.reps, got.kg, got.pausa], [t(ref.sets), t(ref.reps), t(ref.kg), t(ref.pause)], `semana ${semana} dia ${diaIdx} ej ${i}`);
      });
    });
  }
});

test("prescripcionEfectivaEjercicio: misma verdad que `w.campo || ex.campo` (0 numerico de la semana no gana)", () => {
  const ex = { sets: "3", reps: "10", kg: "20", pause: 60, weeks: [{ sets: 0, reps: "12", kg: "", pausa: "" }] };
  const p = prescripcionEfectivaEjercicio(ex, 0);
  assert.deepEqual([p.sets, p.reps, p.kg, p.pausa], ["3", "12", "20", "60"]);
  assert.deepEqual(p.origen, { sets: "base", reps: "semana", kg: "base", pausa: "base" });
  assert.equal(p.sets, String(resolveExerciseForWeek(ex, 0).sets));
});

// ---------------------------------------------------------------- calentamiento, repetidos, tiempo / distancia
test("ejercicio repetido en el dia: entradas distintas por bloque/pos/orden", () => {
  const r = build({ semana: 1 });
  const rep = r.snapshot.ejercicios.filter((e) => e.id === "ex-sentadilla");
  assert.equal(rep.length, 2);
  assert.deepEqual(rep.map((e) => [e.orden, e.pos, e.sets, e.kg]), [[1, 0, "4", "60"], [3, 2, "2", "40"]]);
});

test("calentamiento: va primero, con bloque 'warmup' y su prescripcion propia", () => {
  const r = build();
  assert.equal(r.snapshot.ejercicios[0].bloque, "warmup");
  assert.equal(r.snapshot.ejercicios[0].reps, "45s");
});

test("tiempo y distancia: texto sin interpretar; campos de tiempo copiados tal cual", () => {
  const r = build();
  assert.deepEqual(ej(r, "warmup", 0).tiempo_objetivo, { duration: "45" });
  const trote = ej(r, "main", 3);
  assert.equal(trote.reps, "400 m");
  assert.equal(trote.tiempo_objetivo, undefined);
  assert.equal(trote.pausa, "0");
});

test("entrada rota en un bloque: se omite sin correr la posicion real de las demas", () => {
  const rut = rutinaFicticia();
  rut.datos.days[1].exercises = [null, { id: "ex-remo", sets: "3", reps: "8", kg: "40" }];
  const r = build({ diaIdx: 1 }, rut);
  assert.deepEqual(r.snapshot.ejercicios.map((e) => [e.orden, e.pos, e.id]), [[0, 1, "ex-remo"]]);
});

// ---------------------------------------------------------------- fuente: datos.days, nunca days (kg de logSet)
test("fuente datos.days: el kg que logSet escribe en memoria (updateExerciseKgInRoutines) NO entra en la copia", () => {
  const rSB = rutinaFicticia();
  // Igual que App.jsx: la rutina local comparte datos.days y days al cargarse desde Supabase.
  const local = { id: rSB.id, nombre: rSB.nombre, alumno_id: rSB.alumno_id, days: rSB.datos.days, datos: rSB.datos };
  const [mutada] = updateExerciseKgInRoutines([local], "ex-press", 97.5);
  assert.equal(mutada.days[0].exercises[1].kg, "97.5", "precondicion: logSet cambio el kg en days");
  assert.equal(mutada.datos.days[0].exercises[1].kg, "30", "precondicion: datos.days intacto");
  const r = build({ semana: 3 }, mutada);
  assert.equal(ej(r, "main", 1).kg, "30");
});

test("sin datos.days (cache vieja o enlace compartido sin datos): no hay copia, aunque exista days", () => {
  const rut = rutinaFicticia();
  const soloDays = { id: rut.id, nombre: rut.nombre, alumno_id: rut.alumno_id, days: rut.datos.days };
  assert.deepEqual(build({}, soloDays), { ok: false, motivo: "sin_datos_servidor" });
  assert.deepEqual(build({}, Object.assign({}, soloDays, { datos: { semana_activa: 1 } })), { ok: false, motivo: "sin_datos_servidor" });
});

// ---------------------------------------------------------------- inmutabilidad
test("inmutabilidad: editar la rutina DESPUES de capturar no altera la copia ni su huella", () => {
  const rut = rutinaFicticia();
  const r = build({ semana: 1 }, rut);
  const antes = clone(r.snapshot);
  const hashAntes = r.hash;
  // el entrenador edita: kg semanal, borra un ejercicio, reordena y cambia la etiqueta
  rut.datos.days[0].exercises[0].weeks[0].kg = "999";
  rut.datos.days[0].exercises.splice(1, 1);
  rut.datos.days[0].exercises.reverse();
  rut.datos.days[0].label = "Otro";
  rut.datos.ciclo_actual = 7;
  assert.deepEqual(r.snapshot, antes);
  assert.equal(huellaPrescripcion(r.snapshot), hashAntes);
  // y una copia nueva sobre la rutina editada SI refleja el cambio (otra huella)
  const r2 = build({ semana: 1, fecha: "12/11/2026" }, rut);
  assert.notEqual(r2.hash, hashAntes);
});

test("inmutabilidad: no muta la entrada (rutina congelada) y modificar la copia no toca la rutina", () => {
  const rut = deepFreeze(rutinaFicticia());
  const foto = clone(rut);
  const r = build({ semana: 2 }, rut);
  assert.equal(r.ok, true);
  assert.deepEqual(rut, foto);
  r.snapshot.ejercicios[1].kg = "1";
  r.snapshot.ejercicios[1].origen.kg = "x";
  assert.equal(rut.datos.days[0].exercises[0].weeks[1].kg, "65");
});

test("la copia es JSON puro (lo mismo que se guardaria como jsonb)", () => {
  const r = build({ semana: 1 });
  assert.deepEqual(JSON.parse(JSON.stringify(r.snapshot)), r.snapshot);
});

// ---------------------------------------------------------------- semanas 1..4 (sin ampliar a 8)
test("solo semanas 1..4: 0, 5 y 8 no generan copia aunque el ejercicio tenga 8 semanas definidas", () => {
  const rut = rutinaFicticia();
  const ex = rut.datos.days[0].exercises[0];
  while (ex.weeks.length < 8) ex.weeks.push({ sets: "9", reps: "9", kg: "99", pausa: "9", note: "" });
  [0, 5, 8, -1, 2.5, "2", null, undefined].forEach((semana) => {
    assert.deepEqual(build({ semana }, rut), { ok: false, motivo: "semana_invalida" }, String(semana));
  });
  const r4 = build({ semana: 4 }, rut);
  assert.equal(ej(r4, "main", 0).kg, "50", "semana 4 usa weeks[3] (vacia) => base; nunca weeks[4..7]");
  assert.equal(r4.snapshot.rutina.semanas_definidas, 8, "se registra lo definido, sin usarlo");
});

// ---------------------------------------------------------------- validaciones y aislamiento
test("validaciones: rutina, alumno, dia y fecha", () => {
  assert.equal(buildPrescripcionSnapshot(null).motivo, "rutina_invalida");
  assert.equal(build({}, { datos: rutinaFicticia().datos }).motivo, "rutina_invalida");
  assert.equal(build({ alumnoId: "" }).motivo, "alumno_invalido");
  assert.equal(build({ alumnoId: "alu-OTRO" }).motivo, "alumno_no_coincide");
  [-1, 2, 0.5, "0", null].forEach((diaIdx) => assert.equal(build({ diaIdx }).motivo, "dia_invalido", String(diaIdx)));
  ["", "2026-11-10", "31/11/2026", "29/2/2026", "10/13/2026", "x"].forEach((fecha) => assert.equal(build({ fecha }).motivo, "fecha_invalida", fecha));
  assert.equal(build({ fecha: "29/2/2028" }).ok, true);
});

test("aislamiento: la clave incluye al alumno; dos alumnos nunca comparten clave", () => {
  const a = clavePrescripcion({ alumnoId: "alu-A", rutinaId: "R", ciclo: 1, semana: 1, diaIdx: 0, fecha: "1/1/2026" });
  const b = clavePrescripcion({ alumnoId: "alu-B", rutinaId: "R", ciclo: 1, semana: 1, diaIdx: 0, fecha: "1/1/2026" });
  assert.equal(mismaClave(a, b), false);
  // una rutina sin alumno_id (p. ej. local) no bloquea: se usa el alumno pedido
  const rut = rutinaFicticia(); delete rut.alumno_id;
  assert.equal(build({}, rut).clave.alumno_id, "alu-ficticio-1");
});

// ---------------------------------------------------------------- clave y fechas
test("fechaSesionADia: con o sin ceros => misma fecha ISO; formatos ajenos => null", () => {
  assert.equal(fechaSesionADia("5/3/2026"), "2026-03-05");
  assert.equal(fechaSesionADia("05/03/2026"), "2026-03-05");
  assert.equal(fechaSesionADia(" 5/03/2026 "), "2026-03-05");
  assert.equal(fechaSesionADia("2026-03-05"), null);
  assert.equal(fechaSesionADia("5-3-2026"), null);
  assert.equal(fechaSesionADia(null), null);
});

test("clave: ciclo ausente/invalido => 1 (como rowCiclo); ids numericos y texto equivalen", () => {
  const k1 = clavePrescripcion({ alumnoId: 7, rutinaId: 9, semana: 2, diaIdx: 1, fecha: "1/2/2026" });
  const k2 = clavePrescripcion({ alumnoId: "7", rutinaId: "9", ciclo: "x", semana: 2, diaIdx: 1, fecha: "01/02/2026" });
  assert.equal(k1.ciclo, 1);
  assert.equal(mismaClave(k1, k2), true);
  assert.equal(clavePrescripcion({ alumnoId: "a", rutinaId: "r", semana: 5, diaIdx: 0, fecha: "1/1/2026" }), null);
  assert.equal(clavePrescripcion({ alumnoId: "a", rutinaId: "", semana: 1, diaIdx: 0, fecha: "1/1/2026" }), null);
});

test("claveDeSesion: fila de sesiones con la misma clave que la copia; sin rutina_id => null", () => {
  const r = build({ semana: 2 });
  const payload = removeUndefinedPayloadFields(buildSessionPayload({
    alumnoId: "alu-ficticio-1", session: { dIdx: 0 }, activeDay: rutinaFicticia().datos.days[0],
    activeRoutine: { id: "rut-ficticia-1", name: "Rutina ficticia" }, exercises: [], weekToSave: 2,
    date: "10/11/2026", time: "21:30", includeRoutineId: true, ciclo: 1,
  }));
  assert.equal(mismaClave(claveDeSesion(payload), r.clave), true);
  // modo compartido: la sesion se guarda sin rutina_id => nunca se une a una copia
  const compartida = removeUndefinedPayloadFields(Object.assign({}, payload, { rutina_id: undefined }));
  assert.equal(claveDeSesion(compartida), null);
});

test("claveDeCopia: filas de la tabla propuesta (fecha_dia ISO)", () => {
  const r = build({ semana: 2 });
  const fila = Object.assign({}, r.clave, { prescripcion_hash: r.hash });
  delete fila.texto;
  assert.equal(mismaClave(claveDeCopia(fila), r.clave), true);
  assert.equal(claveDeCopia(Object.assign({}, fila, { fecha_dia: "10/11/2026" })), null);
});

// ---------------------------------------------------------------- compatibilidad con la deduplicacion existente
test("deduplicacion: para el mismo alumno y rutina, la clave coincide EXACTAMENTE con sessionAlreadyExists", () => {
  const fechas = ["5/3/2026", "05/03/2026", "5/03/2026", "6/3/2026"];
  let casos = 0;
  for (const fa of fechas) for (const fb of fechas) for (const da of [0, 1]) for (const db of [0, 1])
    for (const sa of [1, 2]) for (const sb of [1, 2]) for (const ca of [1, 2]) for (const cb of [undefined, 1, 2]) {
      const row = { alumno_id: "A", rutina_id: "R", fecha: fb, dia_idx: db, semana: sb };
      if (cb !== undefined) row.ciclo = cb;
      const existente = sessionAlreadyExists([row], fa, da, sa, ca);
      const ka = clavePrescripcion({ alumnoId: "A", rutinaId: "R", ciclo: ca, semana: sa, diaIdx: da, fecha: fa });
      assert.equal(mismaClave(ka, claveDeSesion(row)), existente, JSON.stringify({ fa, da, sa, ca, row }));
      casos++;
    }
  assert.ok(casos > 1000);
});

test("deduplicacion: diferencias DOCUMENTADAS con sessionAlreadyExists", () => {
  // 1) otra rutina, mismo dia/semana/ciclo/fecha: sessionAlreadyExists la toma como existente; la copia es por rutina (mas estricta).
  const row = { alumno_id: "A", rutina_id: "R-vieja", fecha: "5/3/2026", dia_idx: 0, semana: 1 };
  assert.equal(sessionAlreadyExists([row], "5/3/2026", 0, 1, 1), true);
  assert.equal(mismaClave(clavePrescripcion({ alumnoId: "A", rutinaId: "R-nueva", semana: 1, diaIdx: 0, fecha: "5/3/2026" }), claveDeSesion(row)), false);
  // 2) dia_idx/semana como texto: sessionAlreadyExists compara con === (no coincide); la clave normaliza (coincide).
  const rowTexto = { alumno_id: "A", rutina_id: "R", fecha: "5/3/2026", dia_idx: "0", semana: "1" };
  assert.equal(sessionAlreadyExists([rowTexto], "5/3/2026", 0, 1, 1), false);
  assert.equal(mismaClave(clavePrescripcion({ alumnoId: "A", rutinaId: "R", semana: 1, diaIdx: 0, fecha: "5/3/2026" }), claveDeSesion(rowTexto)), true);
});

// ---------------------------------------------------------------- reinicios de semana y de rutina
test("reinicio de SEMANA (mecanismo vigente): abre ciclo n+1 => el nuevo intento el MISMO dia tiene otra clave", () => {
  const rut = rutinaFicticia({ semana_activa: 2 });
  const intento1 = build({ semana: 2, diaIdx: 0, fecha: "10/11/2026" }, rut);
  const reiniciada = Object.assign({}, rut, { datos: buildReinicioDatos(rut.datos, { tipo: "semana", semana: 2, nowIso: "2026-11-10T22:00:00Z" }) });
  assert.equal(readCicloActual(reiniciada.datos), 2);
  assert.equal(reiniciada.datos.semana_activa, 2);
  const intento2 = build({ semana: 2, diaIdx: 0, fecha: "10/11/2026" }, reiniciada);
  assert.equal(mismaClave(intento1.clave, intento2.clave), false);
  assert.equal(intento1.clave.ciclo, 1);
  assert.equal(intento2.clave.ciclo, 2);
  // y la sesion del primer intento NO bloquea la del segundo en la deduplicacion existente (mismo criterio)
  const ses1 = { alumno_id: "alu-ficticio-1", rutina_id: rut.id, fecha: "10/11/2026", dia_idx: 0, semana: 2 };
  assert.equal(sessionAlreadyExists([ses1], "10/11/2026", 0, 2, 2), false);
  assert.equal(mismaClave(claveDeSesion(ses1), intento1.clave), true);
});

test("reinicio de RUTINA: ciclo n+1 y Semana 1 => claves distintas del bloque anterior", () => {
  const rut = rutinaFicticia({ semana_activa: 4 });
  const viejo = build({ semana: 1, fecha: "1/10/2026" }, rut);
  const nueva = Object.assign({}, rut, { datos: buildReinicioDatos(rut.datos, { tipo: "rutina", nowIso: "2026-11-01T10:00:00Z" }) });
  const nuevo = build({ semana: 1, fecha: "1/10/2026" }, nueva);
  assert.equal(mismaClave(viejo.clave, nuevo.clave), false);
  assert.equal(nuevo.snapshot.rutina.ciclo_base, 2);
});

test("reinicio de semana LEGADO (semana_reiniciada, mismo ciclo): mismo dia => misma clave, IGUAL que la deduplicacion de sesiones", () => {
  // No hay escritor actual de semana_reiniciada (solo lectores), pero puede existir en datos historicos.
  const rut = rutinaFicticia({ semana_activa: 2, semana_reiniciada: 2, semana_reiniciada_at: "2026-11-10T22:00:00Z" });
  const a = build({ semana: 2, fecha: "10/11/2026" }, rut);
  const b = build({ semana: 2, fecha: "10/11/2026" }, rut);
  assert.equal(mismaClave(a.clave, b.clave), true);
  const ses = { alumno_id: "alu-ficticio-1", rutina_id: rut.id, fecha: "10/11/2026", dia_idx: 0, semana: 2 };
  assert.equal(sessionAlreadyExists([ses], "10/11/2026", 0, 2, 1), true, "la sesion tampoco se duplica: la colision ya existe hoy");
  // en otra fecha el nuevo intento es distinguible
  assert.equal(mismaClave(a.clave, build({ semana: 2, fecha: "11/11/2026" }, rut).clave), false);
});

test("dos inicios con la MISMA clave: reintentos (misma huella) => unica; edicion entre inicios => ambigua (no se elige)", () => {
  const rut = rutinaFicticia();
  const a = build({ semana: 1 }, rut);
  const reintento = build({ semana: 1, capturadaEn: "2026-11-10T21:30:00.000Z", momento: "reanudacion" }, rut);
  assert.equal(reintento.hash, a.hash, "la huella no depende de la captura");
  const fila = (r) => Object.assign({}, r.clave, { prescripcion_hash: r.hash, prescripcion: r.snapshot });
  assert.equal(estadoCopiaDeSesion([fila(a), fila(reintento)], a.clave).estado, "unica");
  rut.datos.days[0].exercises[0].weeks[0].kg = "62.5"; // el entrenador edita el mismo dia
  const editado = build({ semana: 1 }, rut);
  assert.equal(mismaClave(editado.clave, a.clave), true);
  assert.notEqual(editado.hash, a.hash);
  assert.deepEqual(estadoCopiaDeSesion([fila(a), fila(editado)], a.clave), { estado: "ambigua", copia: null });
  assert.equal(estadoCopiaDeSesion([fila(a)], build({ semana: 1, fecha: "11/11/2026" }, rut).clave).estado, "sin_copia");
  assert.equal(estadoCopiaDeSesion([fila(a)], null).estado, "sin_copia");
  assert.equal(estadoCopiaDeSesion([Object.assign(fila(a), { prescripcion_hash: "" })], a.clave).estado, "ambigua");
});

// ---------------------------------------------------------------- medianoche
test("medianoche: con la fecha fijada al iniciar (fechaDeSesion), la clave es la del dia de inicio", () => {
  const inicio = new Date(2026, 10, 10, 23, 55).getTime();
  const despues = new Date(2026, 10, 11, 0, 10).getTime();
  const session = { rId: "rut-ficticia-1", dIdx: 0, startTime: inicio, fecha: "10/11/2026" };
  const fechaInicio = fechaDeSesion(session, inicio);
  const fechaFin = fechaDeSesion(session, despues);
  assert.equal(fechaInicio, fechaFin);
  const k = build({ fecha: fechaFin }).clave;
  assert.equal(k.fecha_dia, "2026-11-10");
  // una sesion sin fecha fijada usa la fecha local de su inicio, no la del reloj
  assert.equal(fechaDeSesion({ startTime: inicio }, despues), new Date(inicio).toLocaleDateString("es-AR"));
});

// ---------------------------------------------------------------- huella
test("SHA-256: vectores conocidos y UTF-8", () => {
  assert.equal(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  assert.equal(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"), "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  assert.equal(sha256Hex("a".repeat(1000)), "41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3");
  // contra node:crypto: acentos, emoji (pares sustitutos), bordes de bloque (55/56/63/64/65 bytes) y una copia real
  const muestras = ["ñ", "Día A · Sentadilla ficticia", "💪 RIR 2", "x".repeat(55), "x".repeat(56), "x".repeat(63), "x".repeat(64), "x".repeat(65),
    jsonCanonico(build({ semana: 1 }).snapshot)];
  muestras.forEach((s) => assert.equal(sha256Hex(s), createHash("sha256").update(s, "utf8").digest("hex"), s.slice(0, 20)));
  assert.notEqual(sha256Hex("Día"), sha256Hex("Dia"));
});

test("JSON canonico: independiente del orden de claves; la huella cambia con el contenido", () => {
  assert.equal(jsonCanonico({ b: 1, a: [2, { d: 1, c: 2 }] }), jsonCanonico({ a: [2, { c: 2, d: 1 }], b: 1 }));
  assert.equal(jsonCanonico({ a: undefined, b: null }), '{"b":null}');
  const r = build({ semana: 1 });
  const invertir = (o) => Array.isArray(o) ? o.map(invertir) : (o && typeof o === "object" ? Object.fromEntries(Object.keys(o).reverse().map((k) => [k, invertir(o[k])])) : o);
  const reordenada = invertir(r.snapshot);
  assert.notEqual(JSON.stringify(reordenada), JSON.stringify(r.snapshot), "precondicion: otro orden de claves");
  assert.equal(huellaPrescripcion(reordenada), r.hash);
  assert.match(r.hash, /^sha256:[0-9a-f]{64}$/);
  assert.notEqual(build({ semana: 2 }).hash, r.hash, "otra semana con otros valores => otra huella");
  assert.equal(build({ semana: 1, capturadaEn: "otra", semanaMostrada: 3 }).hash, r.hash, "datos de captura fuera de la huella");
});

// ---------------------------------------------------------------- captura
test("captura: momento y semana mostrada; el modulo no lee el reloj", () => {
  const r = build({ momento: "reanudacion", semanaMostrada: 3, capturadaEn: undefined });
  assert.equal(r.snapshot.captura.momento, "reanudacion");
  assert.equal(r.snapshot.semana_mostrada, 3);
  assert.equal(r.snapshot.capturada_en, null);
  assert.equal(build({ momento: "otro", semanaMostrada: 7 }).snapshot.captura.momento, "inicio");
  assert.equal(build({ semanaMostrada: 7 }).snapshot.semana_mostrada, null);
});

test("modulo puro: sin reloj, red, almacenamiento, React ni Supabase", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(path.join(dir, "..", "lib", "prescripcionSnapshot.js"), "utf8").replace(/\/\/.*$/gm, "");
  ["Date.now", "new Date()", "localStorage", "sessionStorage", "fetch(", "supabase", "react", "Math.random", "console."].forEach((t) => {
    assert.equal(src.includes(t), false, "no debe usar " + t);
  });
});

console.log(n + " tests ok");
