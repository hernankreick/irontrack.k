# RLS P0 — despliegue, verificación y reversión

Prueba local (Postgres efímero, datos ficticios, nunca producción): `tests/rls/run.sh`
(el esquema base `00_baseline.sql` está RECONSTRUIDO desde el código y los hallazgos; no es un dump de producción).

## Dependencias previas (bloqueantes)
1. **Entrenador principal verificado por el propietario** (SQL de solo lectura en producción): `entrenador@irontrack.app`
   = `e2447231-c0ba-4f90-946f-63bf364570af` (auth.users.id = entrenadores.id); los 9 alumnos son suyos.
2. **Contraseña de Auth del entrenador**: el frontend ya no contiene ni muestra `irontrack2024`, pero si la contraseña real
   de Auth sigue siendo esa, el valor queda en el historial de git y en bundles ya servidos. **Rotarla en Supabase Auth
   antes de aplicar la migración** (acción del propietario; no se hizo aquí).
3. Alumnos con `auth_uid` NULL no podrán entrar como alumno (WARNING; producción informó 0).
4. Frontend de este commit desplegado **antes o junto** con la migración (login sin contraseña por defecto y sin signUp
   de migración, `getVideoOverrides` con el id real).
5. Guardar antes: `pg_dump --schema-only`, `select * from pg_policies where schemaname='public'`, `\dp public.*` y
   `select entrenador_id, count(*) from alumnos group by 1`.
6. Validar con un dump real (QA): los tipos de columnas se castean a `::text`, pero el esquema de pruebas es reconstruido.

## Orden exacto
1. Backup (punto 5). 2. Rotar contraseña (punto 2). 3. Migración `20261010110000_rls_p0_coach_principal.sql` (inocua).
4. Backfill/seed manual (rol postgres), **solo tras revisión**:
   `psql "$DB" -v principal_uid=e2447231-c0ba-4f90-946f-63bf364570af -v expected_alumnos=9 -f sql/rls_p0_backfill_entrenador_principal.sql`
   (aborta sin modificar nada si el UID no existe, figura como alumno, hay otro principal, o los alumnos legacy != 9).
4b. Si se usa el SQL Editor de Supabase (sin psql), usar `sql/rls_p0_backfill_sql_editor.sql` (mismos controles, valores fijos).
5. Deploy del frontend. 6. Migración `20261010120000_rls_p0_lockdown.sql` (aborta sin coach_principal o con legacy restante).

## Verificaciones posteriores
- `select * from pg_policies where schemaname='public' and (qual='true' or with_check='true')` → 0 filas.
- Con anon key: `curl $URL/rest/v1/alumnos` → 401/403 (permission denied), sin datos.
- Login entrenador: dashboard lista alumnos; asignar rutina; ver progreso. Login alumno: ver rutina, registrar serie, finalizar sesión, chat, `onesignal_id`.
- Logs de PostgREST: buscar 401/403/42501 inesperados durante 24 h.

## Reversión
`supabase/rollback/20261010120000_rls_p0_rollback.sql` restaura el estado INSEGURO previo (acceso_total). Solo emergencia; el backfill no se revierte.
Reversión exacta de políticas de `ejercicios_custom`/`entrenadores`: reaplicar desde el respaldo del paso 5.

## Riesgos residuales
- `coach_principal` (singleton) no es escribible desde la API; solo el rol postgres/SQL Editor. `config` solo la edita el principal.
- Privilegio de entrenador = fila en `entrenadores` y no estar vinculado como alumno. Las filas que el upsert del cliente creó para
  alumnos no otorgan nada (la migración avisa cuántas hay; conviene borrarlas a mano). El alta de entrenadores sigue abierta a
  usuarios Auth que no sean alumnos: solo acceden a sus propios datos (multi-tenant aislado).
- El alumno solo puede cambiar `rutinas.datos.semana_activa` (entero 1..4, sin retroceder), `alumnos.onesignal_id` y `mensajes.leido`.
- `alumnos.auth_uid` solo lo asigna `service_role` (trigger `it_guard_alumnos_*`): la Edge Function `update-alumno-password` crea la cuenta de
  Auth y la vincula en la misma llamada; si el email ya existe en Auth sin vínculo responde 409 (no se vincula por email). Los 9 alumnos actuales
  ya tienen `auth_uid`. Queda pendiente (acción manual) vincular cualquier alumno nuevo cuyo email ya tenga cuenta de Auth.
- Login: la identidad del entrenador la decide Supabase Auth; el email `entrenador@irontrack.app` en App.jsx solo elige la rama de UI.
  No hay contraseñas fijas ni creación de cuentas desde el cliente. Las cuentas de alumno siguen dependiendo de la contraseña que asigna el coach.
- Storage (bucket de fotos), Edge Functions con service_role y Realtime no fueron revisados. `service_role` conserva acceso total (EXECUTE
  concedido a las funciones auxiliares).
- No validado contra el esquema real de producción ni contra sync V2/OneSignal (fuera de alcance).

## Frontend ↔ backfill
Tras el backfill el entrenador lista sus alumnos con `alumnos?entrenador_id=eq.<UUID de Auth>` y crea alumnos/rutinas/custom con ese UUID.
Sesiones de alumno guardadas antes del backfill (localStorage con `entrenadorId` legacy) no cargan overrides/config hasta un nuevo login.
