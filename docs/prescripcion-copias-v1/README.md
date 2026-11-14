# Copias de prescripción v1 (propuesta, NO aplicada)

Qué hay y qué falta para comparar **prescrito vs. ejecutado**:

| Pieza | Estado |
|---|---|
| Comparación por sesión (`lib/prescripcionComparacion.js`) y agregación por sesión/semana/ciclo (`lib/prescritoEjecutadoResumen.js`) | hechas, puras, probadas |
| Identidad de series y sesiones en el servidor (`sesion_uid`, `bloque`, `pos`, `identidad_v`) | migración `identidad-remota-v1` preparada, **no aplicada** |
| Copia histórica de la prescripción (`public.prescripcion_copias`) | `1_tabla.sql` con RLS y políticas reales; **no aplicada**; **exige antes `docs/rls-v1`** |
| Captura al iniciar + cola offline + envío idempotente (`lib/prescripcionCopiaSync.js`, cableado en `App.jsx`) | **implementada, desactivada** salvo `VITE_IRONTRACK_COPIAS_PRESCRIPCION=migracion-aplicada:prescripcion-copias-v1` (variable de build) |
| Lectura y comparación (`lib/prescritoEjecutadoCarga.js`) e interfaz responsive (`components/prescrito/*`) | **implementadas**; montadas en Progreso del alumno y en Progreso del entrenador (alumno elegido); sin la variable no se muestran ni leen nada |
| Políticas RLS de la tabla | incluidas en `1_tabla.sql` (alumno: inserta/lee las suyas de una rutina propia; entrenador: lee las de sus alumnos; nadie actualiza ni borra) |

Hasta que existan las columnas de identidad y las copias, cada sesión devuelve un estado explícito (`sin_copia`, `sin_finalizar`, `series_sin_vinculo`…): nunca se rellena ni se compara con la rutina actual, y no hay copias retroactivas.

## Orden de aplicación (humano; primero en un branch de Supabase de prueba)
Ver `docs/rls-v1/README.md` §4 (tabla completa con comprobación y rollback de cada etapa). En resumen: preflight de seguridad → migración RLS → verificación de permisos → identidad remota → **esta tabla** → verificación de persistencia → activar las variables solo en Preview → QA → producción solo con autorización.

Captura: al iniciar el entrenamiento (no al reanudar tras recargar) con `buildPrescripcionSnapshot` sobre `rutina.datos.days` **del servidor** (nunca `rutina.days` del estado local, que contiene el último kg registrado); se encola localmente y se envía con un `POST` idempotente (23505 sobre `prescripcion_copias_clave_hash_uq` = ya guardada). Si no se puede guardar, el entrenamiento sigue igual: esa sesión quedará `sin_copia`.

## Límites conocidos de la comparación
- Repeticiones de ejercicios por tiempo, distancias y porcentajes: `no_comparable` (progreso no guarda la unidad).
- "Omitido" solo si se demuestra registro completo (`contexto.registroSeriesCompleto`); si no, se informa `faltantes_sin_evidencia_de_registro_completo`.
- Una sesión es "finalizada" solo con evidencia positiva: fila con `sesion_uid` + `identidad_v = 1` (la escribe el cierre de sesión) o marca explícita. Las sesiones históricas no se marcan.
