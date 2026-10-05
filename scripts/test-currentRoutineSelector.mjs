// Selector canonico de "rutina vigente" (lib/routineStore.js selectCurrentRoutine) + coherencia entrenador/alumno.
// Prueba el codigo productivo real; la regla vieja R1 (.find sobre un array sin orden) se reproduce inline solo como contraste.
//
//   node scripts/test-currentRoutineSelector.mjs

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  selectCurrentRoutine,
  createdAtSortKey,
  findRutinaForAlumno,
  getRutinaAsignadaAlumno,
  hasAlumnoRutina,
  getAlumnoRutinaNombre,
} from "../lib/routineStore.js";
import { getStudentRoutine } from "../lib/studentWeeklyProgress.js";
import { getRoutineForAlumno } from "../components/coachProgresoMetrics.js";

// R1 historico (lo que hacia findRutinaForAlumno antes del fix): primera coincidencia del array.
const legacyR1 = (arr, aid) => arr.find(r => r && String(r.alumno_id) === String(aid)) || null;

let passed = 0;
function t(name, fn) { fn(); passed++; console.log("ok -", name); }
function permutations(arr) {
  if (arr.length <= 1) return [arr.slice()];
  const out = [];
  arr.forEach((x, i) => permutations(arr.slice(0, i).concat(arr.slice(i + 1))).forEach(p => out.push([x].concat(p))));
  return out;
}
const R = (id, alumno, nombre, created_at, extra) => Object.assign({ id, alumno_id: alumno, entrenador_id: "entrenador_principal", nombre, created_at, es_plantilla: false, datos: { days: [] } }, extra || {});

const EVI = "evi-uuid", HER = "her-uuid", OTRO = "otro-uuid";
const full = R("f1", EVI, "Full body (Evi)", "2026-06-11 10:00:00.123456");
const evi2 = R("e2", EVI, "Evi 2", "2026-07-11 10:00:00.123456");
const evi3 = R("e3", EVI, "Evi 3", "2026-09-01 13:32:24.502021");

t("A. una sola rutina", () => assert.equal(selectCurrentRoutine([evi2], EVI), evi2));
t("B. varias, orden viejo->nuevo", () => assert.equal(selectCurrentRoutine([full, evi2, evi3], EVI), evi3));
t("C. varias, orden nuevo->viejo", () => assert.equal(selectCurrentRoutine([evi3, evi2, full], EVI), evi3));
t("D. todas las permutaciones dan lo mismo", () => {
  permutations([full, evi2, evi3, R("x1", EVI, "sin fecha", null)]).forEach(p => assert.equal(selectCurrentRoutine(p, EVI), evi3));
});
t("E. rutinas de otro alumno mezcladas no cuentan (aunque sean mas nuevas)", () => {
  const otra = R("o1", OTRO, "Otra", "2026-12-01T10:00:00");
  assert.equal(selectCurrentRoutine([otra, evi2, full], EVI), evi2);
  assert.equal(selectCurrentRoutine([otra, evi2], OTRO), otra);
});
t("F. plantilla mas nueva no desplaza a la asignada", () => {
  const plantilla = R("p1", EVI, "Plantilla", "2026-12-01T10:00:00", { es_plantilla: true });
  const plantillaSinAlumno = R("p2", null, "Plantilla 2", "2026-12-02T10:00:00", { es_plantilla: true });
  assert.equal(selectCurrentRoutine([plantilla, plantillaSinAlumno, evi2, full], EVI), evi2);
  assert.equal(selectCurrentRoutine([plantilla], EVI), null);
});
t("G. created_at null/ausente pierde contra una fecha valida; solo-null => desempate por id", () => {
  const sinFecha = R("z9", EVI, "Sin fecha", null);
  const sinCampo = R("z8", EVI, "Sin campo", undefined); delete sinCampo.created_at;
  assert.equal(selectCurrentRoutine([sinFecha, full], EVI), full);
  assert.equal(selectCurrentRoutine([sinCampo, sinFecha], EVI), sinFecha); // z9 > z8
  assert.equal(selectCurrentRoutine([sinFecha, sinCampo], EVI), sinFecha);
});
t("H. created_at invalido no rompe y pierde contra fecha valida", () => {
  const malo = R("z7", EVI, "Fecha mala", "no-es-fecha");
  assert.equal(selectCurrentRoutine([malo, full], EVI), full);
  assert.equal(selectCurrentRoutine([full, malo], EVI), full);
  assert.equal(selectCurrentRoutine([malo], EVI), malo);
});
t("I. empate exacto de created_at => mayor id (String), independiente del orden", () => {
  const a = R("aaa", EVI, "A", "2026-09-01 13:32:24.502021");
  const b = R("bbb", EVI, "B", "2026-09-01 13:32:24.502021");
  permutations([a, b]).forEach(p => assert.equal(selectCurrentRoutine(p, EVI), b));
  // ids numericos se comparan como String: "9" > "10" (documentado; los ids reales son uuid)
  const n9 = R(9, EVI, "n9", "2026-09-01 13:32:24.502021"), n10 = R(10, EVI, "n10", "2026-09-01 13:32:24.502021");
  assert.equal(selectCurrentRoutine([n10, n9], EVI), n9);
  // formatos distintos del mismo instante empatan por valor, no por texto
  const iso = R("a1", EVI, "iso", "2026-09-01T10:00:00.000"), iso2 = R("a2", EVI, "iso2", "2026-09-01 13:32:24.502021");
  assert.equal(selectCurrentRoutine([iso, iso2], EVI), iso2);
});
t("J. sin rutina para el alumno => null (consistente con findRutinaForAlumno)", () => {
  assert.equal(selectCurrentRoutine([], EVI), null);
  assert.equal(selectCurrentRoutine(null, EVI), null);
  assert.equal(selectCurrentRoutine(undefined, EVI), null);
  assert.equal(selectCurrentRoutine([evi2], "nadie"), null);
  assert.equal(selectCurrentRoutine([evi2], null), null);
  assert.equal(findRutinaForAlumno([], EVI), null);
});
t("no muta el array ni los objetos", () => {
  const arr = [evi2, evi3, full];
  const snap = JSON.stringify(arr);
  selectCurrentRoutine(arr, EVI);
  assert.equal(JSON.stringify(arr), snap);
  assert.deepEqual(arr.map(r => r.id), ["e2", "e3", "f1"]);
});
t("acepta alumno_id como string/uuid con distinto tipo (String())", () => {
  assert.equal(selectCurrentRoutine([R("n1", 7, "n", "2026-01-01T00:00:00")], "7").id, "n1");
});

// ---- Casos reales sinteticos ----------------------------------------------------------------
t("Evi (Full body 06-11 / Evi 2 07-11 / Evi 3 09-01): SIEMPRE Evi 3 en las 6 permutaciones", () => {
  permutations([full, evi2, evi3]).forEach(p => assert.equal(selectCurrentRoutine(p, EVI).nombre, "Evi 3"));
});
t("Hernan (Full body 04-30 / Empuje-Traccion 08-28): SIEMPRE Empuje-Traccion", () => {
  const fb = R("h1", HER, "Full body", "2026-04-30T10:00:00"), et = R("h2", HER, "Empuje-Traccion", "2026-08-28T10:00:00");
  permutations([fb, et]).forEach(p => assert.equal(selectCurrentRoutine(p, HER).nombre, "Empuje-Traccion"));
});
t("Andrea/Guadalupe (dos filas con el mismo nombre): gana la mas nueva, determinista", () => {
  const a1 = R("d1", "andrea", "dos musc por dia", "2026-05-01T10:00:00"), a2 = R("d2", "andrea", "dos musc por dia", "2026-06-01T10:00:00");
  permutations([a1, a2]).forEach(p => assert.equal(selectCurrentRoutine(p, "andrea").id, "d2"));
});

// ---- Contraste con la regla vieja R1 (inline) ------------------------------------------------
t("R1 historico devolvia Evi 2 con [Evi 2, Evi 3, Full body]; ahora findRutinaForAlumno devuelve Evi 3", () => {
  const arr = [evi2, evi3, full];
  assert.equal(legacyR1(arr, EVI).nombre, "Evi 2");
  assert.equal(findRutinaForAlumno(arr, EVI).nombre, "Evi 3");
  assert.equal(getRutinaAsignadaAlumno(arr, { id: EVI }).nombre, "Evi 3");
});
t("R1 historico dependia del orden (3 resultados); el real no (1 resultado)", () => {
  const perms = permutations([full, evi2, evi3]);
  assert.equal(new Set(perms.map(p => legacyR1(p, EVI).id)).size, 3);
  assert.equal(new Set(perms.map(p => findRutinaForAlumno(p, EVI).id)).size, 1);
});

// ---- Delegacion: todos los helpers del entrenador usan el selector canonico -----------------------
t("findRutinaForAlumno / getRutinaAsignadaAlumno / selectCurrentRoutine devuelven el mismo objeto (alumno como id u objeto)", () => {
  permutations([full, evi2, evi3]).forEach(p => {
    const exp = selectCurrentRoutine(p, EVI);
    assert.equal(findRutinaForAlumno(p, EVI), exp);
    assert.equal(findRutinaForAlumno(p, { id: EVI }), exp);
    assert.equal(getRutinaAsignadaAlumno(p, EVI), exp);
    assert.equal(getRutinaAsignadaAlumno(p, { id: EVI, nombre: "Evi" }), exp);
  });
});
t("hasAlumnoRutina / getAlumnoRutinaNombre usan la vigente", () => {
  assert.equal(hasAlumnoRutina({ id: EVI }, [full, evi2, evi3]), true);
  assert.equal(hasAlumnoRutina({ id: "nadie" }, [full, evi2, evi3]), false);
  assert.equal(hasAlumnoRutina({ id: EVI }, [R("p", EVI, "P", "2026-01-01", { es_plantilla: true })]), false);
  assert.equal(getAlumnoRutinaNombre({ id: EVI }, [evi2, evi3, full]), "Evi 3");
  assert.equal(getAlumnoRutinaNombre({ id: "nadie" }, [evi2]), "");
});

// ---- Coherencia entrenador == alumno ----------------------------------------------------------
t("COHERENCIA: lista/tarjeta, dashboard, Progreso y la carga del alumno resuelven el MISMO rutina_id, sin depender del orden", () => {
  const sets = [
    { aid: EVI, rows: [full, evi2, evi3, R("o1", OTRO, "Otra", "2026-12-01 00:00:00")] },
    { aid: HER, rows: [R("h1", HER, "Full body", "2026-04-30 10:00:00"), R("h2", HER, "Empuje-Traccion", "2026-08-28 10:00:00")] },
    { aid: "andrea", rows: [R("d1", "andrea", "dos musc por dia", "2026-05-01 10:00:00"), R("d2", "andrea", "dos musc por dia", "2026-06-01 10:00:00")] },
    { aid: "tie", rows: [R("t1", "tie", "A", "2026-09-01 10:00:00"), R("t2", "tie", "B", "2026-09-01 10:00:00")] },
  ];
  sets.forEach(({ aid, rows }) => permutations(rows).forEach(p => {
    const alumnoApp = selectCurrentRoutine(p.filter(r => String(r.alumno_id) === aid), aid); // el alumno carga sb.getRutinas(alumnoId) y usa el selector
    const ids = [
      getRutinaAsignadaAlumno(p, { id: aid }).id,   // StudentsSection / busqueda global / App wrapper
      findRutinaForAlumno(p, aid).id,
      getStudentRoutine(p, { id: aid }).id,         // CoachDashboard
      getRoutineForAlumno(p, aid).id,               // ProgresoView / metricas
      alumnoApp.id,                                 // app del alumno (login / carga / link compartido)
    ];
    assert.equal(new Set(ids).size, 1, "ids divergentes: " + ids.join(","));
  }));
});
t("COHERENCIA: sin rutina => todos null", () => {
  assert.equal(getStudentRoutine([evi2], { id: "nadie" }), null);
  assert.equal(getRoutineForAlumno([evi2], "nadie"), null);
  assert.equal(getRutinaAsignadaAlumno([evi2], "nadie"), null);
  assert.equal(getRoutineForAlumno([], EVI), null);
  assert.equal(getStudentRoutine(null, EVI), null);
});
t("getRoutineForAlumno / getStudentRoutine ahora ignoran plantillas y desempatan por id", () => {
  const plantilla = R("p1", EVI, "Plantilla", "2026-12-01 00:00:00", { es_plantilla: true });
  assert.equal(getRoutineForAlumno([plantilla, evi3], EVI), evi3);
  assert.equal(getStudentRoutine([plantilla, evi3], EVI), evi3);
});
t("una sola rutina: mismo resultado que antes (caso comun intacto)", () => {
  assert.equal(findRutinaForAlumno([evi3], EVI), evi3);
  assert.equal(legacyR1([evi3], EVI), evi3);
});

// ---- created_at: formato real de Supabase, determinista (sin Date.parse) ---------------------------
t("createdAtSortKey: orden correcto con microsegundos, 'T', zona y fecha sola", () => {
  const k = createdAtSortKey;
  assert.ok(k("2026-09-01 13:32:24.502021") > k("2026-09-01 13:32:24.502020"));   // 1 microsegundo
  assert.ok(k("2026-09-01 13:32:24.502021") > k("2026-09-01 13:32:24.5"));
  assert.ok(k("2026-09-01 13:32:24") === k("2026-09-01T13:32:24.000000"));         // espacio == T
  assert.ok(k("2026-09-01 13:32:24") === k("2026-09-01T13:32:24+00:00"));           // sin zona = UTC
  assert.ok(k("2026-09-01T13:32:24Z") === k("2026-09-01T10:32:24-03:00"));          // offset aplicado
  assert.ok(k("2026-09-01") === k("2026-09-01 00:00:00"));
  assert.ok(k("2026-09-02") > k("2026-09-01 23:59:59.999999"));
});
t("createdAtSortKey: null / vacio / invalido / fechas imposibles => -Infinity (no crashea)", () => {
  [null, undefined, "", "no-es-fecha", "2026-13-01 00:00:00", "2026-02-30x", {}, NaN, new Date("x")].forEach(v => assert.equal(createdAtSortKey(v), -Infinity));
  assert.ok(createdAtSortKey(new Date("2026-09-01T00:00:00Z")) > -Infinity);
});
t("created_at en el formato real de Supabase: gana la mas nueva aunque difieran solo por microsegundos", () => {
  const a = R("u1", EVI, "A", "2026-09-01 13:32:24.502020"), b = R("u2", EVI, "B", "2026-09-01 13:32:24.502021");
  permutations([a, b]).forEach(p => assert.equal(selectCurrentRoutine(p, EVI), b));
});
t("independiente de la zona horaria del proceso: mismas claves bajo TZ distintas", () => {
  const code = 'import("./lib/routineStore.js").then(m=>console.log(JSON.stringify(["2026-09-01 13:32:24.502021","2026-09-01T13:32:24.502021+00:00","2026-03-08 02:30:00","2026-10-25 01:30:00"].map(m.createdAtSortKey))))';
  const outs = ["UTC", "America/Argentina/Buenos_Aires", "America/New_York", "Asia/Tokyo"].map(tz =>
    execFileSync(process.execPath, ["-e", code], { cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), env: Object.assign({}, process.env, { TZ: tz }) }).toString().trim());
  assert.equal(new Set(outs).size, 1, outs.join(" | "));
});

console.log("\n" + passed + " tests OK");
