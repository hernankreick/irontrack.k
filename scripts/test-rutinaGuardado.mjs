// Guardado confiable de rutinas y pagos: null/[] de updateRutina/saveConfig NO es éxito (R-01, R-02, R-04, R-07, D-02).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rutinaGuardada } from "../lib/routineStore.js";
import { pagoGuardado } from "../components/students/pagoAlumno.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// Contrato del helper
ok(rutinaGuardada([{ id: 1 }]) === true, "array con fila = guardado");
for (const bad of [null, undefined, [], {}, "", 0, false]) ok(rutinaGuardada(bad) === false, "no guardado: " + JSON.stringify(bad));
ok(pagoGuardado(null) === false && pagoGuardado([]) === false && pagoGuardado([{ id: "pagos" }]) === true, "pagoGuardado");

const rv = read("components/RutinaView.jsx");
const rc = read("components/routines/RoutineCard.jsx");
const app = read("App.jsx");
const bar = read("components/routines/UnsavedChangesBar.jsx");
const day = read("components/DaySection.jsx");

// R-01: ninguna llamada a updateRutina ignora el retorno
ok(/rutinaGuardada\(upd\)/.test(rv) && !/^\s*await sb\.updateRutina\(/m.test(rv), "RutinaView valida updateRutina");
ok(/rutinaGuardada\(upd\)/.test(rc) && !/^\s*await sb\.updateRutina\(/m.test(rc), "RoutineCard valida updateRutina");
ok(!/^\s*await sb\.updateRutina\(/m.test(app), "App.jsx no ignora el retorno de updateRutina");
ok((app.match(/rutinaGuardada\(/g) || []).length >= 3, "App.jsx valida editEx (x2) y agregar ejercicios");
ok(!/âœ/.test(app), "sin mojibake en App.jsx");

// D-02: datos de pago
ok(/saveConfig\(aliasForm\)\.then\(\(res\)=>\{\s*if\(!pagoGuardado\(res\)\)/.test(app), "saveConfig valida la respuesta antes del ✓");

// R-02: candado síncrono + botón deshabilitado
ok(/savingRef\.current\) return/.test(rv) && /finally\s*\{\s*savingRef\.current = false/.test(rv), "candado en handleSaveAll");
ok(/disabled=\{saving\}/.test(bar) && /saving=\{saving\}/.test(rv), "la barra deshabilita Guardar mientras guarda");

// R-04: reordenar no escribe ni calcula days dentro del updater de setState
ok(!/let savedDays/.test(rc), "sin savedDays asignado dentro de setRoutines");
const reorder = rc.slice(rc.indexOf("onReorderWarmup"), rc.indexOf("onReorderExercises") + 900);
ok(!/sb\.updateRutina/.test(reorder), "reordenar no escribe al servidor");

// R-07: eliminar solo del bloque indicado
ok(/onDelete=\{\(exId\) => onDeleteExercise\(exId, blockKey\)\}/.test(day), "DaySection envía el bloque");
ok(/delWarmup/.test(rc) && /delMain/.test(rc), "RoutineCard filtra solo el bloque");

// Lógica de borrado por bloque (misma regla que RoutineCard)
const del = (d, id, blk) => ({
  ...d,
  warmup: blk !== "exercises" ? d.warmup.filter((e) => e.id !== id) : d.warmup,
  exercises: blk !== "warmup" ? d.exercises.filter((e) => e.id !== id) : d.exercises,
});
const dia = { warmup: [{ id: "x" }], exercises: [{ id: "x" }, { id: "y" }] };
const r1 = del(dia, "x", "exercises");
ok(r1.warmup.length === 1 && r1.exercises.length === 1, "borrar del principal conserva el calentamiento");
const r2 = del(dia, "x", "warmup");
ok(r2.warmup.length === 0 && r2.exercises.length === 2, "borrar del calentamiento conserva el principal");

console.log("OK test-rutinaGuardado (" + n + " aserciones)");
