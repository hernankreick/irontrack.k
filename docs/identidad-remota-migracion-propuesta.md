# Migración propuesta: identidad remota v1 (NO EJECUTADA)

> Propuesta para revisión. Está en `docs/` (y no en `sql/`) porque los permisos del proyecto no permiten que los agentes editen `sql/`. Si se aprueba, el dueño la copia a `sql/identidad_remota_v1.sql` y la corre a mano, primero en un entorno de prueba. El frontend NO envía los campos nuevos hasta definir `VITE_IRONTRACK_IDENTIDAD_REMOTA` (ver `docs/identidad-remota.md`).

## Diseño seguro
- Solo `ADD COLUMN IF NOT EXISTS`, sin `DEFAULT` y sin `NOT NULL`: no reescribe tablas ni toca filas existentes.
- **Sin backfill**: las filas históricas quedan en NULL (no verificables). Nunca se infiere un vínculo por fecha/ejercicio/kg/reps.
- **Sin claves foráneas**: una serie se guarda antes de finalizar la sesión (la fila de `sesiones` aún no existe); una FK bloquearía el registro. El vínculo es lógico.
- Idempotente. No toca RLS, políticas, funciones/RPC, triggers ni datos. Un cliente antiguo que inserta sin las columnas sigue funcionando.

## SQL

```sql
BEGIN;

ALTER TABLE public.progreso ADD COLUMN IF NOT EXISTS sesion_uid  uuid;
ALTER TABLE public.progreso ADD COLUMN IF NOT EXISTS bloque      text;
ALTER TABLE public.progreso ADD COLUMN IF NOT EXISTS pos         smallint;
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS sesion_uid  uuid;
ALTER TABLE public.sesiones ADD COLUMN IF NOT EXISTS identidad_v smallint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'progreso_bloque_chk' AND conrelid = 'public.progreso'::regclass) THEN
    ALTER TABLE public.progreso ADD CONSTRAINT progreso_bloque_chk CHECK (bloque IS NULL OR bloque IN ('warmup', 'main'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'progreso_pos_chk' AND conrelid = 'public.progreso'::regclass) THEN
    ALTER TABLE public.progreso ADD CONSTRAINT progreso_pos_chk CHECK (pos IS NULL OR pos >= 0);
  END IF;
  -- bloque y pos van juntos (ambos o ninguno).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'progreso_bloque_pos_juntos_chk' AND conrelid = 'public.progreso'::regclass) THEN
    ALTER TABLE public.progreso ADD CONSTRAINT progreso_bloque_pos_juntos_chk CHECK ((bloque IS NULL) = (pos IS NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sesiones_identidad_v_chk' AND conrelid = 'public.sesiones'::regclass) THEN
    ALTER TABLE public.sesiones ADD CONSTRAINT sesiones_identidad_v_chk CHECK (identidad_v IS NULL OR identidad_v >= 1);
  END IF;
END $$;

-- Una sesion_uid identifica UN entrenamiento (unica; parcial: las filas sin uid no cuentan). Un reintento de finalizar no crea otra fila.
CREATE UNIQUE INDEX IF NOT EXISTS sesiones_sesion_uid_uidx ON public.sesiones (sesion_uid) WHERE sesion_uid IS NOT NULL;
-- Lectura de las series de una sesion (NO unico).
CREATE INDEX IF NOT EXISTS progreso_sesion_uid_idx ON public.progreso (sesion_uid) WHERE sesion_uid IS NOT NULL;

COMMIT;
-- En tablas muy grandes, correr los dos CREATE INDEX fuera de la transaccion con CREATE INDEX CONCURRENTLY.
```

## Verificación previa (solo lectura) — lo que el repo no puede confirmar porque el esquema real no está versionado
```sql
-- 1) Tipos/columnas actuales (las nuevas no deben existir ya)
select table_name, column_name, data_type, is_nullable from information_schema.columns
 where table_schema='public' and table_name in ('progreso','sesiones') order by table_name, ordinal_position;
-- 2) Son tablas (no vistas) y no hay triggers que reescriban filas
select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('progreso','sesiones');
select event_object_table, trigger_name, action_statement from information_schema.triggers
 where event_object_schema='public' and event_object_table in ('progreso','sesiones');
-- 3) RLS y permisos: la migracion NO los cambia; confirmar que no hay lista de columnas ni GRANT por columna que excluya las nuevas
select tablename, policyname, cmd, roles, qual, with_check from pg_policies
 where schemaname='public' and tablename in ('progreso','sesiones');
select grantee, table_name, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name in ('progreso','sesiones') and grantee in ('anon','authenticated');
-- 4) RPC/funciones que inserten en progreso o sesiones con lista fija de columnas
select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and pg_get_functiondef(p.oid) ~* '(insert into|update)\s+(public\.)?(progreso|sesiones)';
```

## Verificación posterior (solo lectura)
```sql
select table_name, column_name, data_type, is_nullable from information_schema.columns
 where table_schema='public' and column_name in ('sesion_uid','bloque','pos','identidad_v') order by 1,2;   -- 5 filas
select count(*) from public.progreso where sesion_uid is not null or bloque is not null or pos is not null; -- 0 (sin backfill)
select count(*) from public.sesiones where sesion_uid is not null or identidad_v is not null;               -- 0 (sin backfill)
```

## Rollback
Perdería la identidad ya guardada si el envío estuvo activo (exportar antes las filas con `sesion_uid` no nulo).
```sql
BEGIN;
  DROP INDEX IF EXISTS public.progreso_sesion_uid_idx;
  DROP INDEX IF EXISTS public.sesiones_sesion_uid_uidx;
  ALTER TABLE public.progreso DROP CONSTRAINT IF EXISTS progreso_bloque_pos_juntos_chk, DROP CONSTRAINT IF EXISTS progreso_pos_chk, DROP CONSTRAINT IF EXISTS progreso_bloque_chk;
  ALTER TABLE public.sesiones DROP CONSTRAINT IF EXISTS sesiones_identidad_v_chk;
  ALTER TABLE public.progreso DROP COLUMN IF EXISTS pos, DROP COLUMN IF EXISTS bloque, DROP COLUMN IF EXISTS sesion_uid;
  ALTER TABLE public.sesiones DROP COLUMN IF EXISTS identidad_v, DROP COLUMN IF EXISTS sesion_uid;
COMMIT;
```
Rollback del frontend sin tocar SQL: quitar `VITE_IRONTRACK_IDENTIDAD_REMOTA` y redeployar.
