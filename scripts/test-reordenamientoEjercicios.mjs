// Reordenamiento de ejercicios (RutinaView > RoutineCard > DaySection > ExerciseCard). Regresión del PR #194:
//  - el overlay del arrastre quedaba desplazado (la tarjeta conservaba un `transform` permanente y el overlay es position:fixed);
//  - el asa bloqueaba el scroll (touch-action: none) y activaba el arrastre con 5 px: deslizar el dedo por el asa movía ejercicios;
//  - sin teclado ni alternativa sin gesto.
// Las pruebas de comportamiento con toques reales están en scripts/qa/qa-pr194.mjs (Playwright, demo ficticia, corre en el CI).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arrayMove } from "@dnd-kit/sortable";
import { crearServidorRutinasDemo, diasDemo } from "../components/demo/qaPr194DemoData.js";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

// ── arrayMove: permutación sin pérdidas ni duplicados, el elemento llega a su lugar y el resto conserva su orden relativo ──
for (let len = 2; len <= 7; len++) {
  const base = Array.from({ length: len }, (_, k) => "e" + k);
  for (let i = 0; i < len; i++) for (let j = 0; j < len; j++) {
    const r = arrayMove(base, i, j);
    if (r.length !== len || new Set(r).size !== len || r[j] !== base[i]) assert.fail("arrayMove " + len + " " + i + "->" + j);
    const resto = base.filter((_, k) => k !== i), restoR = r.filter((_, k) => k !== j);
    if (JSON.stringify(resto) !== JSON.stringify(restoR)) assert.fail("orden relativo " + len + " " + i + "->" + j);
  }
}
n++;

// ── Código: sensores, overlay, scroll y menú ──
const day = read("components/DaySection.jsx");
ok(!/PointerSensor/.test(day), "sin PointerSensor (arrastre inmediato con 5 px también al tocar)");
ok(/useSensor\(MouseSensor, \{ activationConstraint: \{ distance: 5 \} \}\)/.test(day), "mouse: arrastre tras 5 px");
ok(/useSensor\(TouchSensor, \{ activationConstraint: \{ delay: 250, tolerance: 8 \} \}\)/.test(day), "táctil: pulsación sostenida (delay 250 ms, tolerancia 8 px)");
ok(/useSensor\(KeyboardSensor, \{ coordinateGetter: sortableKeyboardCoordinates \}\)/.test(day), "teclado: Espacio + flechas");
ok(/args\.pointerCoordinates \? pointerWithin\(args\) : closestCenter\(args\)/.test(day), "colisión: pointerWithin con puntero y closestCenter con teclado");
ok(/createPortal\(overlay, overlayHost\)/.test(day) && /closest\('\.it-routines-root'\)/.test(day), "el DragOverlay (position:fixed) se monta fuera de la tarjeta, dentro de .it-routines-root");
ok(/onDragCancel=\{\(\) => setActiveId\(null\)\}/.test(day), "cancelar el arrastre limpia el estado");
ok(/autoScroll=\{\{ threshold: \{ x: 0, y: 0\.12 \}/.test(day), "auto-scroll acotado");
ok(/onMove=\{moveBy\}/.test(day) && /arrayMove\(exercises, i, j\)/.test(day), "Subir/Bajar reutilizan onReorderBlock");
ok(/onDelete=\{\(exId\) => onDeleteExercise\(exId, blockKey\)\}/.test(day), "eliminar sigue siendo por bloque (no mezcla calentamiento y principal)");
ok((day.match(/<DndContext/g) || []).length === 1, "un DndContext por bloque: no se puede arrastrar de calentamiento a principal");

const card = read("components/ExerciseCard.jsx");
ok(/touchAction: 'manipulation'/.test(card) && !/touchAction: 'none'/.test(card), "el asa NO bloquea el scroll (touch-action: manipulation)");
ok(/WebkitTouchCallout: 'none'/.test(card) && /WebkitUserSelect: 'none'/.test(card), "sin callout ni selección al mantener pulsado en iOS");
ok(/onMove\(exercise\.id, -1\)/.test(card) && /onMove\(exercise\.id, 1\)/.test(card), "menú ⋮ con Subir y Bajar");
ok(/canMoveUp/.test(card) && /canMoveDown/.test(card), "Subir/Bajar solo si hay lugar");

const css = read("components/routines/routines-ui.css");
ok(/animation: it-routine-card-enter var\(--it-r-enter-dur\) var\(--it-r-ease\) backwards;/.test(css), "la tarjeta no conserva transform tras la entrada (fill-mode backwards)");
ok(!/it-routine-card-enter var\(--it-r-enter-dur\) var\(--it-r-ease\) both/.test(css), "sin fill-mode both");

// El reordenamiento sigue siendo estado local + cambios pendientes: sin escritura oculta (R-04)
const rc = read("components/routines/RoutineCard.jsx");
const reorden = rc.slice(rc.indexOf("onReorderWarmup"), rc.indexOf("onReorderExercises") + 900);
ok(!/sb\.updateRutina/.test(reorden) && /setHasUnsaved\(true\)/.test(reorden), "reordenar no escribe al servidor y marca cambios pendientes");

// ── Persistencia del orden con el servidor ficticio (contrato real de updateRutina): lo guardado conserva el orden y las identidades ──
const s = crearServidorRutinasDemo({});
const dias = diasDemo("");
const principal = dias[0].exercises.map((e) => e.id);
dias[0].exercises = [dias[0].exercises[2], dias[0].exercises[0], dias[0].exercises[1]];
const r = await s.sb.updateRutina("demo-r1", { nombre: "Rutina A", alumno_id: "demo-a1", entrenador_id: "entrenador_principal", es_plantilla: false, datos: { days: dias, alumno: "x", note: "" } });
ok(Array.isArray(r) && r.length === 1, "update confirmado");
const guardado = s.filas()[0].datos.days[0].exercises.map((e) => e.id);
ok(JSON.stringify(guardado) === JSON.stringify([principal[2], principal[0], principal[1]]), "el orden guardado es el reordenado");
ok(new Set(guardado).size === 3 && s.filas()[0].datos.days[0].warmup.length === 2, "sin duplicados ni pérdidas; el calentamiento no se mezcla");
ok(s.filas()[0].datos.semana_activa === 2, "semana_activa se conserva");
s.setModo("red");
let lanzo = false; try { await s.sb.updateRutina("demo-r1", { nombre: "Rutina A", alumno_id: "demo-a1", entrenador_id: "entrenador_principal", es_plantilla: false, datos: { days: diasDemo(""), alumno: "x", note: "" } }); } catch (e) { lanzo = true; }
ok(lanzo && JSON.stringify(s.filas()[0].datos.days[0].exercises.map((e) => e.id)) === JSON.stringify(guardado), "un fallo de red no cambia el orden guardado");

console.log("OK test-reordenamientoEjercicios (" + n + " aserciones)");
