# update-alumno-password

Permite que un entrenador autorizado asigne o cambie la contraseña de un alumno (y crea la cuenta de Auth si el alumno no la tiene).

## Reglas de autorización (IT-002a)
1. **Quién llama.** El UID de Auth del solicitante debe estar en el secreto **`COACH_UIDS`** (lista separada por comas). Es una fuente que el cliente no controla. No alcanza con que `alumnos.entrenador_id` coincida ni con que exista una fila en `entrenadores` (el cliente escribe ambas). Sin secreto válido, **se deniega todo** (403).
2. **Sobre qué alumno.** Además, `alumnos.entrenador_id` debe ser el UID del solicitante o el valor legacy `entrenador_principal`.
3. **Sobre qué cuenta de Auth.** Una cuenta existente solo se modifica si está **vinculada** al alumno:
   - `app_metadata.alumno_id` = id del alumno (solo lo escribe el servidor; la función lo pone al crear la cuenta), o
   - `alumnos.auth_uid` = id de la cuenta.
   Una coincidencia de email, por sí sola, **no basta**: si existe una cuenta con ese email sin vínculo, responde **409** y no toca nada.
4. Nunca se modifica la cuenta del solicitante ni la de otro entrenador autorizado.

## Despliegue (lo hace el propietario; el orden importa)
1. **Antes**, solo lectura (compartir únicamente conteos):
   ```sql
   -- ¿existe la columna auth_uid?
   select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'alumnos' and column_name = 'auth_uid';
   -- alumnos legacy vs UUID, y cuántos tienen vínculo (requiere la columna)
   select (entrenador_id = 'entrenador_principal') as legacy, count(*) as total, count(auth_uid) as con_vinculo
     from public.alumnos group by 1;
   ```
2. Si hay alumnos que **ya tienen cuenta de Auth pero no tienen vínculo** (la mayoría, si se crearon con la versión anterior), ver "Vincular cuentas existentes".
3. Cargar el secreto **`COACH_UIDS`** con el UID del entrenador (Authentication → Users → UID). Es un identificador, no una credencial. **Hacerlo antes de desplegar la función**: con el orden inverso el entrenador recibe 403 hasta cargarlo.
4. Desplegar la función. `index.ts` importa `./handler.js`, por lo que hay que subir **ambos archivos** (con la CLI se incluyen solos).
5. Probar con un **alumno de prueba**: crear alumno → «Editar alumno» → asignar contraseña (200) → iniciar sesión como ese alumno. Prueba negativa con la sesión de un alumno de prueba (no de uno real): cambiar la contraseña de otro alumno de prueba debe responder 403.

## Vincular cuentas existentes
Las cuentas creadas por versiones anteriores no tienen vínculo, así que cambiar su contraseña da **409** hasta vincularlas. Para cada alumno, **verificando que la cuenta le pertenece** (por ejemplo, que la creó el entrenador para ese alumno):
```sql
update public.alumnos set auth_uid = '<UID de la cuenta de Auth>' where id = '<id del alumno>';
```
(Alternativa inmediata sin vincular: definir la contraseña a mano en Authentication → Users.) Las cuentas que cree esta función ya quedan vinculadas.

## Recuperación
- **El entrenador recibe 403 en todos los alumnos:** el secreto falta o el UID está mal. Corregir `COACH_UIDS`; los registros de la función lo avisan.
- **409 en un alumno:** falta el vínculo (ver arriba) o la cuenta pertenece a otra persona. No se modificó nada.
- **Salida inmediata, independiente de la función:** Authentication → Users → definir o restablecer la contraseña del alumno a mano.
- **Rollback:** volver a desplegar la versión anterior de `index.ts` (queda en el historial de git).

## Pruebas
`node scripts/test-updateAlumnoPasswordAuthz.mjs` (cliente simulado, sin red). Con un argumento corre los mismos escenarios contra otra versión de `index.ts`, para comprobar que fallan con la anterior.

## Relación con el PR #89
El PR #89 reemplaza esta función por una versión basada en `alumnoId`, `coach_principal` y backfill. Cuando se integre, su `index.ts` y `core.js` sustituyen a estos archivos y el secreto `COACH_UIDS` deja de usarse.
