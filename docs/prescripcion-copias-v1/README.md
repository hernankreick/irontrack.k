# Copias de prescripción v1 (propuesta, NO aplicada)

Qué falta para comparar **prescrito vs. ejecutado** con datos reales:

| Pieza | Estado |
|---|---|
| Comparación por sesión (`lib/prescripcionComparacion.js`) | hecha, pura |
| Agregación por sesión/semana/ciclo (`lib/prescritoEjecutadoResumen.js`) | hecha, pura, probada |
| Identidad de series y sesiones en el servidor (`sesion_uid`, `bloque`, `pos`, `identidad_v`) | migración v1 preparada, **no aplicada** |
| Copia histórica de la prescripción (`public.prescripcion_copias`) | **tabla propuesta aquí, no aplicada; sin escritura desde la app** |
| Escritura de la copia al iniciar el entrenamiento | **no implementada** (toca App/WorkoutScreen; ver abajo) |
| Políticas RLS de la tabla nueva | **pendientes (carril RLS)** |

Hasta que existan las dos columnas de identidad y las copias, toda sesión devuelve un estado explícito (`sin_copia`, `sin_finalizar`, `series_sin_vinculo`…): nunca se rellena ni se compara con la rutina actual, y no hay copias retroactivas.

## Orden de aplicación (humano, después de la migración de identidad y con el mismo procedimiento: probar primero en un branch de Supabase de prueba)
1. `1_tabla.sql` (crea la tabla vacía con RLS habilitada y sin políticas).
2. Definir políticas en el carril de RLS (alumno: insertar/leer las propias; entrenador: leer las de sus alumnos).
3. Implementar y revisar la escritura: al iniciar/reanudar un entrenamiento, `buildPrescripcionSnapshot({ rutina, alumnoId, diaIdx, semana, fecha, semanaMostrada, capturadaEn })` con `rutina.datos.days` **del servidor** (nunca `rutina.days` del estado local, que contiene el último kg registrado) y un `POST` idempotente (23505 sobre `prescripcion_copias_clave_hash_uq` = ya guardada, no es error). Si la copia no se puede guardar, el entrenamiento sigue igual: esa sesión quedará `sin_copia`.
4. Lectura: filas con `origen_lectura: "servidor"` hacia `compararSesionesDelAlumno({ sesiones, copias, series, contexto })`.

## Límites conocidos de la comparación
- Repeticiones de ejercicios por tiempo, distancias y porcentajes: `no_comparable` (progreso no guarda la unidad).
- "Omitido" solo si se demuestra registro completo (`contexto.registroSeriesCompleto`); si no, se informa `faltantes_sin_evidencia_de_registro_completo`.
- Una sesión es "finalizada" solo con evidencia positiva: fila con `sesion_uid` + `identidad_v = 1` (la escribe el cierre de sesión) o marca explícita. Las sesiones históricas no se marcan.
