// UI móvil y accesibilidad confirmadas (A-2, A-4, A-7, A-8, V-1, V-2, V-4, V-7, C-01, C-06).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { esSwipeHorizontal } from "../lib/repsSwipe.js";
import { estadoPagoAlumno, pagoGuardado } from "../components/students/pagoAlumno.js";
import { normalizeWorkoutKg } from "../lib/workoutSession.js";
import { validarKgEntrada } from "../lib/cargaSerie.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// A-8: un gesto vertical/diagonal es scroll y no registra la serie
ok(esSwipeHorizontal(-150, 5) === true, "horizontal limpio");
ok(esSwipeHorizontal(-100, 8) === true, "poco movimiento vertical se tolera");
ok(esSwipeHorizontal(-100, 120) === false, "diagonal/vertical = scroll (caso reproducido en la auditoría)");
ok(esSwipeHorizontal(-90, 60) === false, "dx < 2*dy");
const panel = read("components/WorkoutExercisePanel.jsx");
ok(/esSwipeHorizontal\(dx, dy\)/.test(panel) && /onTouchCancel=/.test(panel), "el panel usa el criterio y cancela en touchcancel");

// A-2: teclado decimal; la coma se interpreta (type=number la convertía en 825)
ok(/inputMode="decimal"/.test(panel) && /enterKeyHint="done"/.test(panel), "kg con inputMode decimal");
ok(!/type="number" value=\{kg\}/.test(panel), "kg ya no es type=number");
ok(normalizeWorkoutKg("82,5") === 82.5 && validarKgEntrada("82,5").ok === true, "coma decimal válida con type=text");
ok(validarKgEntrada("abc").ok === false, "texto inválido se rechaza");

// A-7: "Último" no repite el valor editable
ok(!/\{kg\}kg<\/span>/.test(panel), "sin etiqueta 'Último' atada al input");

// A-4
ok(/minHeight:44/.test(read("components/workout/RestTimer.jsx")), "Saltar descanso >= 44 px");

// V-2 / V-4 / V-7
const gs = read("components/layout/AppGlobalStyles.jsx");
ok(/darkMode\?"#60A5FA":"#1D4ED8"/.test(gs), "foco visible con contraste en tema claro");
ok(/prefers-reduced-motion:reduce/.test(gs), "movimiento reducido global");
ok(/95dvh/.test(read("components/modals/AddExerciseModal.jsx")) && !/95vh/.test(read("components/modals/AddExerciseModal.jsx")), "AddExerciseModal usa dvh");

// V-1: diálogos con semántica y Escape
for (const f of ["components/student/AlumnoSettingsModal.jsx", "components/student/AlumnoProfileModal.jsx", "components/routines/ExerciseHistoryModal.jsx"]) {
  const s = read(f);
  ok(/import useDialogA11y from /.test(s) && !/import \{ useDialogA11y \}/.test(s), f + ": import por defecto (el módulo no tiene export nombrado)");
  ok(/useDialogA11y\(/.test(s) && /role="dialog"/.test(s) && /aria-modal="true"/.test(s), f + " con role/aria-modal/useDialogA11y");
}
// los hooks van antes de cualquier return condicional
for (const f of ["components/student/AlumnoSettingsModal.jsx", "components/student/AlumnoProfileModal.jsx", "components/routines/ExerciseHistoryModal.jsx"]) {
  const s = read(f);
  ok(s.indexOf("useDialogA11y(") < s.indexOf("return null"), f + ": hook antes del return condicional");
}

// C-01 / C-06
ok(estadoPagoAlumno(null, true).texto === "Sin pago registrado" && estadoPagoAlumno("", true).registrado === false, "sin pago");
const e = estadoPagoAlumno("2026-11-12T15:00:00Z", true);
ok(/^Pagó el \d\d\/\d\d$/.test(e.texto) && e.registrado, "con pago: " + e.texto);
ok(estadoPagoAlumno("2026-11-12T15:00:00Z", false).texto.startsWith("Paid on "), "EN");
ok(/estadoPagoAlumno\(a\.ultimo_pago_confirmado/.test(read("components/students/StudentCard.jsx")), "la tarjeta muestra el estado de pago");
ok(!/onAsignarRutina/.test(read("components/students/StudentsSection.jsx")) && !/onAsignarRutina/.test(read("components/students/StudentCard.jsx")), "prop muerta onAsignarRutina retirada");
ok(pagoGuardado([{ id: 1 }]) === true, "contrato de pago intacto");

// aria-labels de la biblioteca
const lib = read("components/library/LibraryExerciseCard.jsx");
ok((lib.match(/aria-label=/g) || []).length >= 5, "botones de la biblioteca con nombre accesible");

console.log("OK test-uiMovilA11y (" + n + " aserciones)");
