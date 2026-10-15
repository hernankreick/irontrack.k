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

> Orden vigente y decisión operativa: **docs/despliegue-rls-p0.md** (incluye el preflight de solo lectura `sql/rls_p0_preflight_readonly.sql` como paso 0).

## Orden exacto (ventana de mantenimiento corta, un solo entrenador)
Regla: frontend y Edge Function nuevos dependen del backfill (consultan por UUID); la migración RLS depende de ambos.
La contraseña de Auth del entrenador se rota DESPUÉS de publicar el frontend nuevo (el login viejo exige `irontrack2024`) y ANTES de la migración RLS.
1. **Respaldo**: backup/PITR de Supabase; ejecutar `sql/rls_p0_snapshot_policies.sql` y guardar la salida (restauración exacta de políticas y grants);
   `select entrenador_id, count(*) from alumnos group by 1` (esperado: `entrenador_principal` = 9).
2. **Migración 1** `20261010110000_rls_p0_coach_principal.sql` (inocua, sin cambio de comportamiento).
3. **Backfill** con `sql/rls_p0_backfill_sql_editor.sql` (o la variante psql con `-v principal_uid=e2447231-c0ba-4f90-946f-63bf364570af -v expected_alumnos=9`).
   Aborta sin cambios si una precondición falla; guarda en `rls_p0_backfill_log` los ids afectados para poder revertir.
4. **Inmediatamente después**: desplegar la Edge Function `update-alumno-password` y promover el frontend a producción (entre 3 y 4 el dashboard
   viejo muestra 0 alumnos: es esperado y dura minutos). Edge Function y frontend van juntos: el frontend nuevo envía `alumnoId`, la función vieja pide `alumnoEmail`.
5. **Verificación con RLS todavía abierta** (si algo falla se revierte sin riesgo de seguridad nuevo): login del entrenador (contraseña actual), dashboard con 9 alumnos,
   alta de un alumno de prueba, asignar rutina, login de un alumno de prueba, registrar serie, avanzar semana, cambiar contraseña del alumno de prueba (debe vincular `auth_uid`).
6. **Rotar la contraseña de Auth de `entrenador@irontrack.app`** (dueño, en Supabase) y verificar el login con la nueva. Quien aún tenga sesión abierta sigue con su JWT hasta que expire.
7. **Migración 2** `20261010120000_rls_p0_lockdown.sql` (transaccional: o se aplica entera o no cambia nada; aborta si falta el backfill). Repetir la verificación del paso 5
   y las de "Verificaciones posteriores".
8. Después: borrar a mano las filas de `entrenadores` que pertenezcan a alumnos (warning de la migración) y quitar `.env` del repositorio.

## Verificaciones posteriores
- `select * from pg_policies where schemaname='public' and (qual='true' or with_check='true')` → 0 filas.
- Con anon key: `curl $URL/rest/v1/alumnos` → 401/403 (permission denied), sin datos.
- Login entrenador: dashboard lista alumnos; asignar rutina; ver progreso. Login alumno: ver rutina, registrar serie, finalizar sesión, chat, `onesignal_id`.
- Logs de PostgREST: buscar 401/403/42501 inesperados durante 24 h.

## Reversión por etapa (sin pérdida de datos)
| Falla en… | Acción |
|---|---|
| Migración 2 (durante) | Automática: la transacción no deja nada aplicado. |
| Tras migración 2 (app inutilizable) | Preferir corregir hacia adelante. Emergencia: `supabase/rollback/20261010120000_rls_p0_rollback.sql` (reabre acceso total) y luego restaurar políticas exactas desde el respaldo del paso 1 (en especial `ejercicios_custom` y `entrenadores`). |
| Tras backfill / frontend / función (antes de la migración 2) | `sql/rls_p0_backfill_revert.sql` (revierte SOLO las filas que eran legacy; aborta si la migración 2 sigue aplicada) + "Instant Rollback" de Vercel al despliegue anterior + redeploy de la versión previa de la función. |
| Tras migración 1 | `DROP TABLE public.coach_principal;` (nada depende de ella hasta la migración 2). |
| Contraseña rotada | No se revierte: se conserva la nueva. |
Orden de reversión total: migración 2 → backfill → frontend y función → migración 1.

## Riesgos residuales
- Sesiones/bundles antiguos: un frontend viejo en caché, tras el backfill, ve 0 alumnos y no puede crear (consulta el literal legacy); recargar. Los alumnos con sesión guardada anterior
  al backfill no ven overrides hasta volver a iniciar sesión. La función nueva rechaza a un frontend viejo con `alumnoId and newPassword required`.
- Hasta rotar la contraseña de Auth del entrenador, quien conozca `irontrack2024` (versión anterior del bundle) puede iniciar sesión como entrenador; la rotación es previa a la migración 2.
- `update-alumno-password` revela (409) si un email ya tiene cuenta de Auth, solo a entrenadores dueños del alumno.
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
