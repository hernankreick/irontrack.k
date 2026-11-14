// Integridad visible del registro y de la sesión (D-04, D-05, D-06, D-07, D-10).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculateNewWeightPR, historialPermiteCelebrarPR } from "../lib/workoutSession.js";
import { textoConflictoSemana, MOTIVO_CONFLICTO } from "../lib/semanaEntrenamiento.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// D-04: solo un historial COMPLETO habilita la celebración de PR
ok(historialPermiteCelebrarPR({ rows: [], complete: true }) === true, "completo");
ok(historialPermiteCelebrarPR({ rows: [{}], complete: false }) === false, "parcial");
ok(historialPermiteCelebrarPR({ rows: null, complete: false }) === false, "ilegible");
ok(historialPermiteCelebrarPR(null) === false && historialPermiteCelebrarPR(undefined) === false, "sin resultado");
// Reproducción del fallo: con historial parcial (max subestimado 80, real 100) 85 kg parecía PR
ok(calculateNewWeightPR({ max: 80 }, 85) !== null, "el cálculo puro sigue igual (no se toca)");
const app = read("App.jsx");
ok(/newPR && historialAlumnoCompletoRef\.current !== false/.test(app), "App no celebra con historial incompleto");
ok(/historialAlumnoCompletoRef\.current = historialPermiteCelebrarPR\(h\)/.test(app), "el flag se fija al cargar");
ok(/historialAlumnoCompletoRef\.current = false;\s*\n\s*\/\/ FIX A/.test(app), "el flag arranca en false hasta confirmar historial completo");

// D-05: series pendientes al finalizar -> aviso en resumen + reintento
const ws = read("components/WorkoutScreen.jsx");
ok(/pendientesSync/.test(ws) && /onPendingSyncRetry\(\)/.test(ws), "WorkoutScreen avisa y reintenta");
ok(/resumenSesion\.pendientesSync > 0/.test(read("components/workout/WorkoutSessionSummary.jsx")), "el resumen muestra el aviso");

// D-06: aviso de entrenamiento retomado
ok(/inicioPrep\.recuperada && nextSession/.test(app) && /Retomamos tu entrenamiento/.test(app), "toast de retomado");

// D-07: el texto de reinicio aclara que lo registrado se conserva y mantiene las palabras que ya valida test-semanaEntrenamiento
const es = textoConflictoSemana(MOTIVO_CONFLICTO.CICLO, true), en = textoConflictoSemana(MOTIVO_CONFLICTO.CICLO, false);
ok(/reinici/i.test(es) && /ya registraste quedó guardado/.test(es), "texto ES de ciclo");
ok(/restarted/i.test(en) && /already logged is saved/.test(en), "texto EN de ciclo");

// D-10: lookup_failed y unconfirmed ya no comparten el mismo texto
ok(/LOOKUP_FAILED/.test(ws) && /no se va a duplicar/.test(ws) && /no pudimos comprobar|No pudimos comprobar/.test(ws), "mensajes distintos por motivo");

console.log("OK test-datosSesionUx (" + n + " aserciones)");
