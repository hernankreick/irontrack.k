// Identidad del entrenador (RLS P0): UUID de Auth, nunca el literal legacy.   node scripts/test-coachIdentity.mjs
import assert from "node:assert/strict";
import { resolveCoachId, resolveCoachScopeId, realCoachIdOrNull, LEGACY_COACH_ID, isUuid } from "../lib/coachIdentity.js";
import { cleanRutinaWriteBody } from "../lib/routineStore.js";

const C = "00000000-0000-0000-0000-0000000000c1";
const S = "00000000-0000-0000-0000-0000000000a1"; // uid del alumno
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("legacy y no-UUID se descartan", () => {
  assert.equal(realCoachIdOrNull(LEGACY_COACH_ID), null);
  for (const v of [null, undefined, "", "e", "entrenador_principal", 12, {}, "1234"]) assert.equal(realCoachIdOrNull(v), null);
  assert.equal(realCoachIdOrNull(C), C);
  assert.ok(isUuid(C) && !isUuid("x"));
});
t("entrenador: prefiere el usuario de Auth; la sesion guardada solo si es UUID real", () => {
  assert.equal(resolveCoachId({ role: "entrenador", authUid: C, sessionEntrenadorId: LEGACY_COACH_ID }), C);
  assert.equal(resolveCoachId({ role: "entrenador", authUid: null, sessionEntrenadorId: C }), C);
  assert.equal(resolveCoachId({ role: "entrenador", authUid: null, sessionEntrenadorId: LEGACY_COACH_ID }), null);
  assert.equal(resolveCoachId({ role: "entrenador" }), null);
});
t("un alumno nunca resuelve identidad de entrenador", () => {
  assert.equal(resolveCoachId({ role: "alumno", authUid: S, sessionEntrenadorId: C }), null);
  assert.equal(resolveCoachId({ role: undefined, authUid: C }), null);
});
t("scope de lectura: alumno usa el entrenador de su fila, jamas su propio uid", () => {
  assert.equal(resolveCoachScopeId({ role: "alumno", authUid: S, sessionEntrenadorId: C }), C);
  assert.equal(resolveCoachScopeId({ role: "alumno", authUid: S, sessionEntrenadorId: LEGACY_COACH_ID }), null);
  assert.equal(resolveCoachScopeId({ role: "alumno", authUid: S, sessionEntrenadorId: null }), null);
  assert.equal(resolveCoachScopeId({ role: "entrenador", authUid: C, sessionEntrenadorId: null }), C);
  assert.equal(resolveCoachScopeId({ role: null, authUid: C }), null);
});
t("cleanRutinaWriteBody nunca emite entrenador_id legacy ni null", () => {
  const base = { nombre: "R", alumno_id: "a", datos: { days: [] } };
  assert.ok(!("entrenador_id" in cleanRutinaWriteBody({ ...base, entrenador_id: LEGACY_COACH_ID })));
  assert.ok(!("entrenador_id" in cleanRutinaWriteBody({ ...base, entrenador_id: null })));
  assert.ok(!("entrenador_id" in cleanRutinaWriteBody(base)));
  assert.equal(cleanRutinaWriteBody({ ...base, entrenador_id: C }).entrenador_id, C);
  assert.ok(!("entrenador_id" in cleanRutinaWriteBody({ nombre: "P", alumno_id: null, es_plantilla: true, datos: {}, entrenador_id: LEGACY_COACH_ID })));
});
console.log(n + " tests ok");
