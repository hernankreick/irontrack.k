// Pruebas de getWeekCompletionGate (components/student-plan/studentWorkoutState.js): gate "SEMANA COMPLETADA".
// La semana siguiente del programa (semana_activa) no esta disponible hasta la proxima semana calendario
// (lunes a domingo, hora local). Estado derivado de `sesiones` + fecha; no usa it_cd ni escribe en la DB.
//
//   node scripts/test-weekCompletionGate.mjs

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getWeekCompletionGate } from "../components/student-plan/studentWorkoutState.js";
import { getWeekGateTexts } from "../components/student-plan/weekGateTexts.js";

let count = 0;
function test(name, fn) { fn(); count++; console.log("ok - " + name); }

const ALU = "alu-1";
const rutina = (n, extra) => Object.assign({ id: "r1", name: "Cata full body", days: Array.from({ length: n }, (_, i) => ({ id: "d" + i })) }, extra || {});
const ses = (dias, fecha, over) => dias.map((d, i) => Object.assign({
  alumno_id: ALU, rutina_id: "r1", dia_idx: d, semana: 1, fecha: Array.isArray(fecha) ? fecha[i] : fecha,
}, over || {}));
// Oct 2026: lun 28/9, mar 29, mie 30, jue 1/10, vie 2, SAB 3, DOM 4, LUN 5/10.
const at = (d, m, h) => new Date(2026, m - 1, d, h == null ? 12 : h);
const gate = (r, s, now, w) => getWeekCompletionGate({ rutina: r, sesiones: s, alumnoId: ALU, weekNumber: w == null ? 2 : w, now });

test("1 sabado despues de completar la semana 1: activo (con datos de Catalina)", () => {
  const g = gate(rutina(4), ses([0, 1, 2, 3], ["29/9/2026", "30/9/2026", "1/10/2026", "3/10/2026"]), at(3, 10));
  assert.equal(g.active, true);
  assert.equal(g.completedWeekNumber, 1);
  assert.equal(g.nextWeekNumber, 2);
  assert.equal(g.totalDays, 4);
  assert.equal(new Date(g.availableFromMs).getDay(), 1, "disponible un lunes");
  assert.equal(new Date(g.availableFromMs).getDate(), 5);
});
test("2 domingo: activo", () => {
  assert.equal(gate(rutina(4), ses([0, 1, 2, 3], "3/10/2026"), at(4, 10, 23)).active, true);
});
test("3 lunes siguiente: inactivo (a las 00:00 en punto tambien)", () => {
  const s = ses([0, 1, 2, 3], "3/10/2026");
  assert.equal(gate(rutina(4), s, at(5, 10, 0)).active, false);
  assert.equal(gate(rutina(4), s, at(5, 10, 9)).active, false);
});
test("4 completa el domingo -> el lunes inactivo", () => {
  const s = ses([0, 1, 2, 3], ["1/10/2026", "2/10/2026", "3/10/2026", "4/10/2026"]);
  assert.equal(gate(rutina(4), s, at(4, 10)).active, true);
  assert.equal(gate(rutina(4), s, at(5, 10, 0)).active, false);
});
test("5 completa el lunes -> activo toda la semana hasta el lunes siguiente", () => {
  const s = ses([0, 1, 2, 3], "28/9/2026");
  for (const d of [28, 29, 30]) assert.equal(gate(rutina(4), s, at(d, 9)).active, true, "dia " + d);
  for (const d of [1, 2, 3, 4]) assert.equal(gate(rutina(4), s, at(d, 10)).active, true, "dia " + d + "/10");
  assert.equal(gate(rutina(4), s, at(5, 10)).active, false);
});
test("6 semana incompleta: inactivo", () => {
  assert.equal(gate(rutina(4), ses([0, 1, 2], "3/10/2026"), at(3, 10)).active, false);
});
test("7 existe sesion finalizada de la semana W: inactivo", () => {
  const s = ses([0, 1, 2, 3], "3/10/2026").concat(ses([0], "3/10/2026", { semana: 2 }));
  assert.equal(gate(rutina(4), s, at(3, 10)).active, false);
  assert.equal(gate(rutina(4), ses([0, 1, 2, 3], "3/10/2026").concat(ses([0], "3/10/2026", { semana: 3 })), at(3, 10)).active, false);
});
test("8 rutina de 1 dia", () => {
  assert.equal(gate(rutina(1), ses([0], "3/10/2026"), at(4, 10)).active, true);
  assert.equal(gate(rutina(1), ses([0], "3/10/2026"), at(5, 10)).active, false);
});
test("9 rutina de 2 dias", () => {
  assert.equal(gate(rutina(2), ses([0, 1], "2/10/2026"), at(3, 10)).active, true);
  assert.equal(gate(rutina(2), ses([0], "2/10/2026"), at(3, 10)).active, false);
});
test("10 rutina de 5 dias", () => {
  assert.equal(gate(rutina(5), ses([0, 1, 2, 3, 4], "3/10/2026"), at(3, 10)).active, true);
  assert.equal(gate(rutina(5), ses([0, 1, 2, 3], "3/10/2026"), at(3, 10)).active, false);
});
test("11 dia_idx duplicados no completan la semana", () => {
  assert.equal(gate(rutina(4), ses([0, 0, 1, 1, 2], "3/10/2026"), at(3, 10)).active, false);
  assert.equal(gate(rutina(4), ses([0, 0, 1, 2, 3, 3], "3/10/2026"), at(3, 10)).active, true);
});
test("12 dia_idx invalidos (null, fuera de rango, texto, negativo) no cuentan", () => {
  const bad = [null, 7, "x", -1, 4, 1.5].map((d) => ({ alumno_id: ALU, rutina_id: "r1", dia_idx: d, semana: 1, fecha: "3/10/2026" }));
  assert.equal(gate(rutina(4), ses([0, 1, 2], "3/10/2026").concat(bad), at(3, 10)).active, false);
  assert.equal(gate(rutina(4), ses([0, 1, 2, 3], "3/10/2026").concat(bad), at(3, 10)).active, true);
});
test("13 sesiones de otra rutina o de otro alumno no cuentan", () => {
  const other = ses([0, 1, 2, 3], "3/10/2026", { rutina_id: "r2" });
  assert.equal(gate(rutina(4), other, at(3, 10)).active, false);
  const otherAlu = ses([0, 1, 2, 3], "3/10/2026", { alumno_id: "alu-9" });
  assert.equal(gate(rutina(4), otherAlu, at(3, 10)).active, false);
  assert.equal(gate(rutina(4), ses([0, 1], "3/10/2026").concat(ses([2, 3], "3/10/2026", { rutina_id: "r2" })), at(3, 10)).active, false);
});
test("14 fechas 3/10/2026 y 03/10/2026", () => {
  assert.equal(gate(rutina(4), ses([0, 1, 2, 3], "3/10/2026"), at(3, 10)).active, true);
  assert.equal(gate(rutina(4), ses([0, 1, 2, 3], "03/10/2026"), at(3, 10)).active, true);
  assert.equal(gate(rutina(4), ses([0, 1, 2, 3], "03/10/2026"), at(5, 10)).active, false);
});
test("15 fecha invalida/vacia: inactivo (falla hacia abierto) y la valida compensa", () => {
  for (const f of [null, "", "no-es-fecha", undefined]) {
    assert.equal(gate(rutina(4), ses([0, 1, 2, 3], f), at(3, 10)).active, false, String(f));
  }
  const mixed = ses([0, 1, 2], "3/10/2026").concat(ses([3], "basura"));
  assert.equal(gate(rutina(4), mixed, at(3, 10)).active, false, "el dia 3 sin fecha valida no cuenta");
});
test("16 semana que cruza dos semanas calendario: manda la fecha de la ULTIMA sesion", () => {
  // empezo el jueves 24/9 (semana anterior) y termino el martes 29/9
  const s = ses([0, 1, 2, 3], ["24/9/2026", "26/9/2026", "28/9/2026", "29/9/2026"]);
  assert.equal(gate(rutina(4), s, at(29, 9)).active, true);
  assert.equal(gate(rutina(4), s, at(4, 10)).active, true);
  assert.equal(gate(rutina(4), s, at(5, 10)).active, false, "disponible el lunes posterior al martes");
  const g = gate(rutina(4), s, at(1, 10));
  assert.equal(new Date(g.completedDateMs).getDate(), 29);
});
test("17 semana 4 y programa: no hay espera hacia una 'semana 5'", () => {
  const w123 = [1, 2, 3].flatMap((w) => ses([0, 1, 2, 3], "3/10/2026", { semana: w }));
  assert.equal(gate(rutina(4), w123, at(3, 10), 4).active, true, "semana 3 completa -> espera hacia la semana 4 (valida)");
  const w4 = w123.concat(ses([0, 1, 2, 3], "3/10/2026", { semana: 4 }));
  assert.equal(gate(rutina(4), w4, at(3, 10), 4).active, false, "semana 4 ya iniciada/completa: no espera");
  assert.equal(gate(rutina(4), w4, at(3, 10), 5).active, false, "no existe semana 5");
  assert.equal(gate(rutina(4), w4, at(3, 10), 99).active, false);
});
test("17b weekNumber invalido o semana 1: inactivo", () => {
  const s = ses([0, 1, 2, 3], "3/10/2026");
  for (const w of [undefined, null, 0, 1, -2, 1.5, "x"]) assert.equal(getWeekCompletionGate({ rutina: rutina(4), sesiones: s, alumnoId: ALU, weekNumber: w, now: at(3, 10) }).active, false, String(w));
});
test("18 no depende de it_cd: solo sesiones + fecha (logout/login)", () => {
  const src = readFileSync(new URL("../components/student-plan/studentWorkoutState.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export function getWeekCompletionGate"));
  assert.ok(!/it_cd|completedDays|localStorage/.test(fn));
  // firma: solo rutina/sesiones/alumnoId/weekNumber/now
  assert.equal(gate(rutina(4), ses([0, 1, 2, 3], "3/10/2026"), at(3, 10)).active, true);
});
test("semana_reiniciada: un reinicio del entrenador posterior habilita la semana; uno viejo no", () => {
  const s = ses([0, 1, 2, 3], "3/10/2026");
  const after = rutina(4, { datos: { days: [1, 2, 3, 4], semana_reiniciada: 2, semana_reiniciada_at: new Date(2026, 9, 4, 10).toISOString() } });
  assert.equal(gate(after, s, at(4, 10)).active, false);
  const before = rutina(4, { datos: { days: [1, 2, 3, 4], semana_reiniciada: 2, semana_reiniciada_at: new Date(2026, 8, 20).toISOString() } });
  assert.equal(gate(before, s, at(4, 10)).active, true);
  const otherWeek = rutina(4, { datos: { days: [1, 2, 3, 4], semana_reiniciada: 3, semana_reiniciada_at: new Date(2026, 9, 4, 10).toISOString() } });
  assert.equal(gate(otherWeek, s, at(4, 10)).active, true);
});
test("rutina sin id / sin dias / sin sesiones: inactivo", () => {
  assert.equal(gate({ name: "x", days: [1, 2] }, ses([0, 1], "3/10/2026"), at(3, 10)).active, false);
  assert.equal(gate(rutina(0), [], at(3, 10)).active, false);
  assert.equal(gate(rutina(4), [], at(3, 10)).active, false);
  assert.equal(gate(rutina(4), null, at(3, 10)).active, false);
  assert.equal(getWeekCompletionGate({}).active, false);
});
test("textos es/en/pt del gate", () => {
  const g = gate(rutina(4), ses([0, 1, 2, 3], "3/10/2026"), at(3, 10));
  const es = getWeekGateTexts(g, (a) => a);
  assert.equal(es.badge, "SEMANA COMPLETADA ✓");
  assert.equal(es.daysLine, "4 DE 4 DÍAS");
  assert.equal(es.nextLine, "Próximo: Semana 2 · Día 1");
  assert.equal(es.available, "Disponible el lunes");
  assert.equal(es.viewRoutine, "VER RUTINA");
  const en = getWeekGateTexts(g, (a, b) => b);
  assert.equal(en.daysLine, "4 OF 4 DAYS");
  assert.equal(en.available, "Available on Monday");
});

// 19. Cableado
test("19 cableado: hero, mini header, lista, WelcomeModal y defensa central", () => {
  const app = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
  const modal = readFileSync(new URL("../components/WelcomeModal.jsx", import.meta.url), "utf8");
  const host = readFileSync(new URL("../components/student/StudentWelcomeModalHost.jsx", import.meta.url), "utf8");
  const coachHost = readFileSync(new URL("../components/CoachWelcomeModalHost.jsx", import.meta.url), "utf8");
  // defensa central: todo inicio pasa por startStudentWorkout y este NO ejecuta setSession con el gate activo
  assert.ok(!/setSession\(\s*\{/.test(app), "no quedan setSession({...}) directos en App.jsx");
  const defStart = app.indexOf("const startStudentWorkout = function");
  const defBody = app.slice(defStart, app.indexOf("};", defStart));
  assert.ok(defBody.indexOf("if (weekGate.active) return false;") > 0 && defBody.indexOf("if (weekGate.active) return false;") < defBody.indexOf("setSession(nextSession)"));
  assert.equal((app.match(/startStudentWorkout\(\{/g) || []).length, 4, "los 4 caminos de inicio usan la defensa central");
  // hero
  assert.ok(/planScrollDiag\.hoyCard&&todayDay&&!workoutCompletedToday&&!weekGate\.active&&/.test(app));
  // mini header
  assert.ok(app.includes("showTrainButton={todayDay&&!workoutCompletedToday&&!weekGate.active&&!session}"));
  assert.ok(app.includes("showCompletedToday={workoutCompletedToday||weekGate.active}"));
  // banner de plan: el aviso nuevo y el viejo no conviven
  assert.ok(app.includes("<WeekCompletedBanner"));
  assert.ok(app.includes("workoutCompletedToday&&!weekGate.active&&!session"));
  // lista de dias
  assert.ok(app.includes("const weekGateBlocksDay=weekGate.active"));
  assert.ok(app.includes("isNextDay&&!isDayDone&&!weekGateBlocksDay"));
  assert.ok(app.includes("getWeekGateTexts(weekGate,msg).available"));
  // WelcomeModal / onStudentStartWorkout
  assert.ok(/!routine \|\| !day \|\| weekGate\.active/.test(app));
  assert.ok(app.includes("progress, sesiones, weekGate,"));
  assert.ok(coachHost.includes("weekGate={weekGate}") && host.includes("weekGate={weekGate}"));
  assert.ok(modal.includes("weekGate && weekGate.active"));
  assert.ok(modal.includes("getWeekGateTexts(weekGate, msg)"));
  assert.ok(modal.includes("if (weekGate && weekGate.active) { onOpenChange?.(false); return; }"), "handleStart no inicia con el gate");
  // en modo gate no se muestra el CTA de inicio: el unico boton es VER RUTINA (t.viewRoutine)
  const gateBranch = modal.slice(modal.indexOf("weekGate && weekGate.active ? ("), modal.indexOf(") : (\n              <>"));
  assert.ok(gateBranch.includes("t.viewRoutine") && !gateBranch.includes("startLabel") && !gateBranch.includes("onStartWorkout") && !gateBranch.includes("handleStart"));
  // el gate se calcula sin it_cd
  const gateDef = app.slice(app.indexOf("const weekGate = "), app.indexOf("const startStudentWorkout"));
  assert.ok(!gateDef.includes("completedDays"));
});

console.log("\n" + count + " tests OK");
