# Auditoría R1: cambios sin guardar en la edición de rutinas

Fecha: 2026-11-09. Tipo: **solo auditoría**. No se modificó código de producción, Supabase, SQL, RLS, Auth ni datos reales. No se tocó el PR #160.

---

## 1. Estado de partida

| Ítem | Estado verificado en GitHub |
|---|---|
| HEAD de `main` | `7d46f5512db1d26da8c69f53333676e603f2200d`: «fix(alumnos): «Marcar pagado» con confirmación previa… (H6) (#163)» |
| PR #163 | **Mergeado** el 2026-11-09 21:38 UTC por el dueño. Head `17359ce`, base `1c638b9`. |
| PR #160 (D76-09) | **Abierto, draft**, sin cambios: «DEPENDE DE MIGRACIÓN · NO FUSIONAR». No se tocó. |

---

## 2. Archivos y componentes involucrados

| Archivo | Rol en R1 |
|---|---|
| `components/RutinaView.jsx` | Pantalla **Rutinas** del entrenador. Tiene el estado `hasUnsaved` (local, `useState`), `baselineRef` para «Descartar», `handleSaveAll` («Guardar cambios»), `handleModalSave` (editar series, reps, kg y pausa) y el efecto que fusiona `rutinasSBEntrenador`. |
| `components/routines/RoutineCard.jsx` | Tarjeta de cada rutina. `handleSave` (botón «Guardar» por tarjeta), `selectedAlumnoIds` (asignación pendiente, estado local), `savedContentSigRef` (estado *dirty* de la tarjeta), renombrar día o rutina, borrar día o ejercicio, agregar día, reordenar (con **autoguardado**). |
| `components/routines/UnsavedChangesBar.jsx` | Barra fija «Tenés cambios sin guardar · Descartar · Guardar cambios». |
| `components/routines/RoutineCardTitleMeta.jsx` | Renombrar rutina (`onBlur` → `guardarNombreRutina`). |
| `components/DaySection.jsx`, `components/ExerciseCard.jsx` | Edición por día y por ejercicio, y arrastrar para reordenar (`@dnd-kit`). |
| `components/EditExerciseModal.jsx` | Modal «Editar ejercicio» (series, reps, kg, pausa, progresión y semanas). |
| `components/routines/NewRoutineModal.jsx` | Rutina nueva. El fondo no cierra y Escape solo cierra si está vacío: **está bien protegido**. |
| `App.jsx` | Dueño del estado `routines`, que se persiste en `localStorage["it_rt"]` en cada cambio (líneas 1641-1647). También están acá: el `sb` (`createRutina` y `updateRutina`, líneas 381-393), agregar desde la biblioteca (líneas 4485-4515), duplicar día (`confirmDuplicateDay`, líneas 1093-1113), «Abrir en Rutinas» (`goRoutines`, líneas 2817-2830), el editor de ejercicio de la ficha del alumno (`editProps.onSave`, líneas 4287-4334) y el logout (líneas 3591 y 3623). |
| `components/coach/CoachSectionRenderer.jsx` | Renderiza las secciones con `tab === ...`. **Al cambiar de sección, `RutinaView` se desmonta.** |
| `components/students/StudentsSection.jsx` | Ficha del alumno. Desde ahí se abren `setEditEx`, `setAddExModal` y «Abrir en Rutinas». |
| `lib/rutinaOperationalState.js` (`updateRutinaPreservingOperational`) | Contrato de `sb.updateRutina`: devuelve un **array de filas, `[]` si no actualizó nada y `null` ante error. Nunca lanza.** |
| `lib/irontrackLocalStorage.js` | `it_rt` está en las claves que se borran al iniciar sesión con otra cuenta y en el logout. |

---

## 3. Modelo real de guardado (cómo funciona hoy)

1. Toda edición en Rutinas cambia `routines` en `App.jsx`, y esa lista se copia **de inmediato a `localStorage.it_rt`**. Esto **no** es un guardado: el servidor (lo que ve el alumno) solo cambia con «Guardar cambios», con «Guardar» de la tarjeta o con alguno de los autoguardados.
2. El aviso «cambios sin guardar» es un booleano `hasUnsaved` **local de `RutinaView`**: no se persiste, no se calcula a partir de los datos y se pierde cada vez que el componente se desmonta.
3. La tarjeta tiene su propio indicador (`savedContentSigRef`), que se **reinicializa con el contenido actual** cada vez que se monta.
4. Hay autoguardados parciales que no siguen una regla común:
   * reordenar ejercicios (`RoutineCard`);
   * editar un ejercicio desde la ficha del alumno (`App.jsx`);
   * agregar ejercicios desde la biblioteca, solo si la rutina está cargada en `rutinasSB`.

   Ninguno verifica el resultado.
5. No hay ningún `beforeunload` ni `pagehide`, ningún bloqueo de navegación interna y ninguna integración con `history`. Por eso el botón atrás del navegador sale de la app.

---

## 4. Método de prueba

* **Arnés aislado** (`docs/auditorias/r1-cambios-sin-guardar/arnes/`):
  * monta los componentes **reales** del repo (`RutinaView`, `RoutineCard`, `DaySection`, `ExerciseCard`, `EditExerciseModal`, `UnsavedChangesBar`, `DeleteConfirmModal`), transpilados sin cambios con el TypeScript del entorno;
  * usa las funciones **reales** de `lib/` para el guardado (`cleanRutinaWriteBody`, `updateRutinaPreservingOperational` y `withInitialSemanaActiva`);
  * solo el cliente Supabase es falso: modos `ok`, `error` (42501), `vacio` (`[]`), `red` (excepción) y latencia configurable;
  * un host imita el contrato de `App.jsx`: `routines` con `localStorage.it_rt`, y el desmontaje de la sección al cambiar de pestaña;
  * datos ficticios y sin red;
  * viewport de 390×844 táctil en **Chromium (Playwright)**.
* Comando: `node docs/auditorias/r1-cambios-sin-guardar/arnes/run.mjs`. Necesita TypeScript y Playwright del entorno, **no** del proyecto. No se instaló nada.
* No se usó `npm run qa:ui` ni el build de Vite: `node_modules` es de Windows y falta `@rollup/rollup-linux-x64-gnu`. Por el mismo motivo, en este contenedor `test:all` da 62 suites OK y 41 con error de entorno (esbuild nativo). **No es una regresión.**
* **Safari/iPhone real NO fue probado.** Todo lo de iOS de este informe es análisis.

Leyenda:

* 🟥 **Reproducido** en el arnés con componentes reales.
* 🟧 **Reproducido parcialmente**: la transformación de `App.jsx` se copió literal al arnés, porque `App.jsx` no se puede montar sin el build.
* 🟨 **Riesgo por análisis de código**: no se reprodujo.
* ⬜ **No comprobado.**

---

## 5. Hallazgos

### R1-A: Éxito falso al guardar: los cambios se pierden en silencio · **P0 / Crítica** 🟥

`handleSaveAll` (`RutinaView.jsx:187-188`) hace `await sb.updateRutina(...)` y **no mira el resultado**. Como `updateRutina` devuelve `null` o `[]` en vez de lanzar, cualquier fallo cuenta como éxito. Pasa lo mismo en `RoutineCard.handleSave` (`RoutineCard.jsx:360-361`).

| Escenario | Pasos exactos | Resultado observado |
|---|---|---|
| **E3** | 1) Rutinas → ⋮ de «Sentadilla» → Editar → Kg 100 → GUARDAR. 2) «Guardar cambios». El servidor responde 42501 (RLS o permiso). | Toast «Cambios guardados ✓», la barra desaparece y el servidor queda **sin escritura**. |
| **E4** | Igual que E3, con respuesta `[]` (0 filas). | Igual que E3. |
| **E5** | Igual que E3, con falla de red. | Igual que E3. |
| **E6** | Igual que E3, pero con el botón «Guardar» de la tarjeta. | Toast «Rutina guardada ✓», la tarjeta muestra «Guardado» y el servidor queda sin escritura. |

Consecuencia:

* El entrenador cree que guardó y el alumno sigue entrenando con la versión vieja.
* La edición solo queda en `localStorage` de ese dispositivo, que se borra al cerrar sesión o iniciar sesión otra vez (R1-D), o se pisa con «Abrir en Rutinas».
* Es el mismo patrón de éxito falso que se corrigió en H6 (#163) y en `finalizeWorkoutSession`.

### R1-B: El aviso de «sin guardar» se pierde al salir y volver; la tarjeta dice «Guardado» · **P1 / Alta** 🟥

| Escenario | Pasos exactos | Resultado observado |
|---|---|---|
| **E1** | 1) Editar Kg 100 de Sentadilla (la barra aparece). 2) Ir a Alumnos. 3) Volver a Rutinas. | La barra **ya no está**, la edición sigue en memoria (kg 100), hubo 0 escrituras y el botón de la tarjeta dice **«Guardado»**. |
| **E1b** | Después de E1: editar Press banca Kg 55 → Descartar → confirmar. | Solo se revierte el Press. **Sentadilla queda en 100**: el `baselineRef` se tomó del estado ya editado. |
| **E2** | 1) Editar Kg 100. 2) Recargar (equivale a que iOS expulse la PWA de memoria y se reabra). | No aparece ningún diálogo `beforeunload`, la barra está oculta, la tarjeta dice «Guardado», `localStorage` tiene kg 100 y el servidor no tiene nada. |

Causas:

* `hasUnsaved` es un `useState` de `RutinaView` y el componente se desmonta.
* `savedContentSigRef` se inicializa con el contenido local.
* El efecto que fusiona `rutinasSBEntrenador` **no reemplaza** una rutina local existente con la del servidor, así que la divergencia dura indefinidamente.

Las asignaciones de alumno pendientes (`selectedAlumnoIds`, estado local de `RoutineCard`) se **pierden** directamente al desmontarse. Esto es por análisis: es el mismo mecanismo.

### R1-C: Ediciones que nunca marcan «sin guardar» · **P1 / Alta** 🟧

| Escenario | Pasos | Resultado |
|---|---|---|
| **E12** | Agregar ejercicios desde la biblioteca (`App.jsx:4485-4515`) a una rutina que no está cargada en la ficha. | El cambio queda solo en local, **sin barra** y sin escritura. La única pista es que el botón de la tarjeta pasa a «Guardar». Después de navegar, vuelve a decir «Guardado». |
| **E13** | Copiar día → sobre Día 2 (`confirmDuplicateDay`). | Reemplaza el Día 2 localmente, sin barra y sin escritura. |

Causa: los dos flujos viven en `App.jsx` y no llaman a `setHasUnsaved`, que es local de `RutinaView`. Además, si no hay otra edición pendiente, «Guardar cambios» sale temprano (`if (!hasUnsaved) return`).

### R1-D: Sobrescritura y borrado de la copia local sin aviso · **P1 / Alta** 🟧 / 🟨

* **E14** 🟧. Pasos: editar Kg 100 → Alumnos → ficha → ⋮ → «Abrir en Rutinas» → Abrir. Resultado: `goRoutines` (`App.jsx:2818-2828`) reemplaza la rutina local con la copia del servidor. Kg vuelve a 60 sin preguntar.
* **Logout o nuevo inicio de sesión** 🟨: `clearAllIronTrackPrefixedKeys` y `clearIronTrackStorageForNewLogin` borran `it_rt`. Las ediciones no guardadas, incluidas las de R1-A, R1-B y R1-C, desaparecen sin advertencia.

### R1-E: Editar durante un guardado en curso · **P2 / Media** 🟥

* **E7**. Pasos: editar Kg 100 → «Guardar cambios» con latencia de 1,5 s → mientras guarda, editar Press banca Kg 77.
* Resultado:
  * se guarda solo la primera edición (Press en el servidor: 40);
  * al terminar, `setHasUnsaved(false)` **apaga el aviso** aunque Press 77 sigue sin guardar.
* Además, el botón no se deshabilita ni muestra «Guardando…».

### R1-F: «Guardar cambios» reescribe todas las rutinas con la copia local · **P1 / Alta (riesgo)** 🟥 / 🟨

* **E10** 🟥. Con dos rutinas, editar solo «Rutina Ana» → «Guardar cambios». Resultado: se escriben **las dos** (`rr-ana` y `rr-beto`).
* 🟨 **Riesgo**: si «Rutina Beto» se cambió en otro dispositivo o desde la ficha del alumno, la copia local vieja de este teléfono la pisa en silencio. Se preserva el estado operativo (`semana_activa` y ciclo), pero **no** el contenido de los días.

### R1-G: Cerrar «Editar ejercicio» con × descarta lo tipeado sin confirmar · **P3 / Baja** 🟥

* **E11**. Es una decisión explícita del código: el fondo y Escape no cierran, pero la × sí, sin preguntar.
* Riesgo bajo, porque la × es un gesto deliberado.

### Riesgos no reproducidos (🟨)

* **Autoguardado al reordenar** (`RoutineCard.jsx:958-998`), **E9: no reproducido**. El payload se envió con los 2 días correctos. Aun así:
  * `savedDays` se calcula **dentro** del updater de `setRoutines` y se lee después. Funciona porque React lo calcula de inmediato cuando la cola está vacía. Con otra actualización pendiente quedaría `undefined`, y `sanitizeRoutineDaysForWrite(undefined)` devuelve `undefined`. No se verificó qué guardaría el servidor en ese caso.
  * El payload no incluye `es_plantilla`. En una **plantilla**, `cleanRutinaWriteBody` lanza «sin alumno asignado»; el error se captura y solo va a la consola, sin aviso.
  * El resultado no se verifica, y además deja `hasUnsaved = true`: hay dos modelos de guardado mezclados.
* **Editor de ejercicio desde la ficha del alumno** (`App.jsx:4287-4334`): mismo éxito falso que R1-A. Ignora el resultado de `updateRutina` y muestra «Guardado ✓». También usa `routines` de la clausura del render.
* **Agregar desde la biblioteca con la rutina cargada en la ficha**: autoguardado sin verificar el resultado; el error solo va a la consola.
* **Multi-asignación** (`RoutineCard.jsx:394-424`): si falla alguna de las rutinas extra, se omite sin aviso y el toast dice «Rutina asignada a varios alumnos ✓».

### No comprobado (⬜)

* Safari en iPhone real: deslizar para volver en la PWA standalone, bfcache, expulsión de la PWA en segundo plano y teclado abierto al navegar.
* Botón atrás del navegador: por código, no hay `pushState`, así que «atrás» sale de la app. Equivale a E2.
* Conflicto real entre dos dispositivos (R1-F) contra un Supabase real.

---

## 6. Hallazgos adicionales (fuera del alcance de R1; documentados aparte)

| Id | Hallazgo | Severidad | Evidencia |
|---|---|---|---|
| X1 | **Doble toque en «Guardar cambios» con una rutina nueva crea filas duplicadas** en `rutinas` para el mismo alumno. No hay candado. | **P1**: integridad de datos; puede afectar qué rutina se considera vigente para el alumno. | 🟥 **E8**: 2 `insert`, 1 sola tarjeta local y 2 toasts de éxito. |
| X2 | El toast de `App.jsx:4332` tiene texto con doble codificación: `"Guardado âœ“"` (debería ser «Guardado ✓»). | P3, cosmético. | 🟨 Bytes verificados en el archivo. |

---

## 7. Severidad: resumen

| Id | Hallazgo | Severidad | Estado |
|---|---|---|---|
| R1-A | Éxito falso al guardar (Guardar cambios y Guardar de la tarjeta) | **P0** | 🟥 Reproducido (E3-E6) |
| R1-B | El aviso se pierde al navegar o recargar; la tarjeta dice «Guardado»; Descartar no revierte | **P1** | 🟥 Reproducido (E1, E1b, E2) |
| R1-C | Biblioteca y duplicar día no marcan «sin guardar» | **P1** | 🟧 Reproducido parcialmente (E12, E13) |
| R1-D | «Abrir en Rutinas» y logout pisan o borran sin aviso | **P1** | 🟧 E14 / 🟨 logout |
| R1-F | Guardar todo reescribe rutinas no editadas | **P1 (riesgo)** | 🟥 E10 / 🟨 conflicto |
| R1-E | Edición durante el guardado queda marcada como guardada | P2 | 🟥 Reproducido (E7) |
| R1-G | La × del modal descarta sin confirmar | P3 | 🟥 Reproducido (E11) |
| X1 | Doble toque → rutinas duplicadas | P1 | 🟥 Reproducido (E8) |

---

## 8. Propuesta de solución mínima (no implementada)

Se ordena por impacto y riesgo. Cada fase es independiente y se puede revisar por separado.

**Fase 1 (P0 + X1 + R1-E). Solo `RutinaView.jsx` y `RoutineCard.jsx`:**

1. **Éxito solo si el guardado se confirma**: array no vacío, el mismo contrato que H6 y `finalizeWorkoutSession`. Con `null`, `[]` o una excepción:
   * mantener `hasUnsaved`;
   * no actualizar `savedContentSigRef`;
   * mostrar un error persistente con «Reintentar».
2. **Candado síncrono** (`useRef`) en «Guardar cambios» y en «Guardar» de la tarjeta, con el botón deshabilitado y la etiqueta «Guardando…».
3. **Instantánea al iniciar el guardado**: al terminar, apagar el aviso solo si `routines` no cambió desde que empezó (comparar una firma o un contador de revisión).

**Fase 2 (R1-B, R1-C y R1-F). Estado *dirty* persistente y por rutina:**

4. Marcar `dirty: true` en la propia rutina dentro de `routines`, en el mismo updater de cada edición. Esto incluye biblioteca, duplicar día, renombrar y reordenar. Como `routines` ya se persiste en `it_rt`, el aviso **sobrevive** al desmontaje, a la recarga y a la expulsión de la PWA.
   * La barra se deriva de `routines.some(r => r.dirty)`.
   * La tarjeta y «Descartar» usan esa marca.
   * La marca se limpia solo con un guardado confirmado.
5. «Guardar cambios» escribe **solo las rutinas con `dirty`**: corrige R1-F y reduce la exposición.

**Fase 3 (R1-D y salidas):**

6. `goRoutines`: si la rutina local tiene `dirty`, preguntar antes de reemplazarla («Tenés cambios sin guardar en esta rutina»).
7. Logout o nueva sesión con rutinas `dirty`: confirmación previa.
8. Navegación interna con `dirty` al salir de Rutinas: diálogo «Guardar / Descartar / Seguir editando». Con la Fase 2, esto pasa a ser una comodidad y no algo imprescindible.
9. `beforeunload` y `pagehide` como refuerzo en escritorio. **En iOS Safari no es confiable**: la protección real en iPhone es la Fase 2.

Alcance:

* La Fase 1 entra en `components/**`.
* Las Fases 2 y 3 tocan `App.jsx`, que **está fuera del alcance del flujo autónomo de UI** (`check:scope` fallaría). Requieren autorización explícita del dueño.
* No hace falta tocar Supabase, SQL, RLS, Auth, dependencias ni el PR #160.

---

## 9. Pruebas automatizadas recomendadas

* **`scripts/test-r1GuardadoRutinas.mjs`** (contrato puro, Node): una función `isConfirmedSave(res)` (`null`, `[]` o una excepción no son éxito) y su uso en `handleSaveAll` y `handleSave`. También una prueba de estructura: candado `useRef` y ningún `setHasUnsaved(false)` sin confirmación.
* **Escenarios del arnés convertidos en QA de regresión** (`scripts/qa/r1-cambios-sin-guardar.mjs`, sobre la demo o el build con datos ficticios):
  * de E1 a E14, invirtiendo las aserciones: después de la corrección, **ninguno** debe reproducirse;
  * agregar: «error → Reintentar → éxito», 3 toques rápidos = 1 escritura, y recarga con *dirty* → barra visible.
* Ejecutar a 375, 390 y 430 px (la barra fija y los diálogos) junto con `qa:ui`.
* Validación manual en un iPhone real, con datos ficticios en Preview:
  * editar → cambiar de sección;
  * editar → bloquear el teléfono durante 10 minutos → volver;
  * editar → cerrar la PWA desde el selector de apps → reabrir;
  * guardar en modo avión.

---

## 10. Impacto en la experiencia del entrenador en iPhone

* En iPhone el flujo típico es editar un ejercicio, abrir el menú lateral, mirar la ficha del alumno y volver. **Cada cambio de sección borra el aviso** y la tarjeta pasa a decir «Guardado» (R1-B).
* iOS expulsa la PWA en segundo plano con frecuencia y Safari no muestra `beforeunload`. Al volver, la app se recarga en el escenario E2 sin ninguna señal.
* Con mala señal, pasa con frecuencia que «Guardar cambios» falle por red o se quede esperando. Hoy eso muestra **«Cambios guardados ✓»** (R1-A). El entrenador lo da por hecho y el alumno entrena con la versión vieja; la diferencia aparece días después.
* Con un doble toque en una pantalla táctil, sin el botón deshabilitado, se crean rutinas duplicadas (X1).
* Lo que mitiga hoy: las ediciones **no** se borran solas. Quedan en `localStorage` del dispositivo hasta que se cierra sesión, se vuelve a iniciar sesión o se usa «Abrir en Rutinas». Por eso, **con la conexión funcionando**, el riesgo de R1-B se reduce a «no sé que tengo cambios pendientes». Con la conexión fallando (R1-A), la pérdida es real y silenciosa.

---

## 11. Recomendación final

**CORREGIR R1. No cerrarlo.**

* Hay un **P0 reproducido** (R1-A: éxito falso con pérdida silenciosa) y tres P1 reproducidos (R1-B, R1-C y X1).
* Se recomienda empezar por la **Fase 1**: dos archivos en `components/`, fix mínimo y el mismo patrón ya validado en H6.
* Después, la **Fase 2**, que es la que protege de verdad en iPhone y requiere autorizar cambios en `App.jsx`.

**Auditoría finalizada. No se implementó ninguna corrección. Queda a la espera de autorización.**
