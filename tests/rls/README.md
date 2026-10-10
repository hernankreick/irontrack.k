# RLS P0 — despliegue, verificación y reversión

Prueba local (Postgres efímero, datos ficticios, nunca producción): `tests/rls/run.sh`
(el esquema base `00_baseline.sql` está RECONSTRUIDO desde el código y los hallazgos; no es un dump de producción).

## Dependencias previas (bloqueantes)
1. **Backfill de `entrenador_principal`**: `server/edge update-alumno-password` y "Nuevo alumno" usan el string legacy
   `entrenador_principal`. La migración **aborta** si algún `alumnos.entrenador_id` no es un `entrenadores.id` real.
   El dueño debe indicar el UUID del entrenador (`entrenadores.id`): `psql "$DB" -v principal_uid=<uuid> -f sql/rls_p0_backfill_entrenador_principal.sql`.
2. **Cada entrenador debe tener fila en `entrenadores`** (la app la crea en login; sin ella no puede insertar alumnos/overrides).
3. **Alumnos con `auth_uid` NULL** no podrán entrar como alumno (la migración avisa con WARNING). Verificar: `select count(*) from alumnos where auth_uid is null` (prod informó 0).
4. Frontend de este commit (`getVideoOverrides` con el id real del entrenador) desplegado **antes o junto** con la migración.
5. Guardar antes: `pg_dump --schema-only`, `select * from pg_policies where schemaname='public'` y `\dp public.*` (para reversión exacta).
6. Verificar tipos reales de columnas (las políticas castean a `::text`, por lo que son tolerantes a uuid/text).

## Orden
1. Backup + respaldo de políticas/grants. 2. Backfill (paso 1 arriba). 3. Deploy frontend. 4. Aplicar
   `supabase/migrations/20261010120000_rls_p0_lockdown.sql` (transaccional; todo o nada).

## Verificaciones posteriores
- `select * from pg_policies where schemaname='public' and (qual='true' or with_check='true')` → 0 filas.
- Con anon key: `curl $URL/rest/v1/alumnos` → 401/403 (permission denied), sin datos.
- Login entrenador: dashboard lista alumnos; asignar rutina; ver progreso. Login alumno: ver rutina, registrar serie, finalizar sesión, chat, `onesignal_id`.
- Logs de PostgREST: buscar 401/403/42501 inesperados durante 24 h.

## Reversión
`supabase/rollback/20261010120000_rls_p0_rollback.sql` restaura el estado INSEGURO previo (acceso_total). Solo emergencia; el backfill no se revierte.
Reversión exacta de políticas de `ejercicios_custom`/`entrenadores`: reaplicar desde el respaldo del paso 5.

## Riesgos residuales
- `config` es una fila global (`id='pagos'`): cualquier entrenador registrado puede editarla y todo usuario vinculado la lee. Requiere `entrenador_id` en `config` (fuera de alcance).
- Registro de entrenador abierto: cualquier usuario Auth que no sea alumno puede crear su fila en `entrenadores` (flujo actual de alta); solo accede a sus propios datos.
- El alumno puede reescribir `rutinas.datos` de su rutina (necesario para avanzar `semana_activa`); no puede cambiar nada más.
- El entrenador puede editar `alumnos.auth_uid` de sus alumnos (lo necesita la gestión de cuentas); no otorga acceso a datos de terceros.
- No validado contra el esquema real de producción ni contra la rama de sync V2 desplegada (solo contra sus llamadas: `sesiones` INSERT y `rutinas.datos` UPDATE del alumno).
- Storage (bucket de fotos), Edge Functions con service_role y Realtime no fueron revisados.
