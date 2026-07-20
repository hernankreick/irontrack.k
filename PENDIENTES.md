# Pendientes

## "Guardar todo" no aísla fallos por rutina (Flujo C)

`RutinaView.jsx` `handleSaveAll`, ~líneas 168-204 (Flujo C) no aísla fallos por rutina — itera todas las rutinas pendientes en un único try/catch, secuencialmente con await. Si la rutina N tira un error (ej: falta alumno_id en una rutina que no es plantilla), el loop se detiene ahí: las rutinas ya guardadas antes de N quedan persistidas pero la UI las sigue mostrando como no guardadas (setHasUnsaved(false) nunca corre), y las rutinas después de N nunca se intentan. El coach ve un solo toast genérico "Error al guardar" que no refleja el éxito parcial — engañoso. Necesita manejo de error por rutina: seguir intentando el resto aunque una falle, y reportar específicamente cuáles fallaron y por qué, en vez de un error único para todo el lote. Descubierto 2026-07-16 mientras se probaba el PR #59 (soporte de plantillas) — no lo causó ese PR, es preexistente en el Flujo C.
