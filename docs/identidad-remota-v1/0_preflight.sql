-- IDENTIDAD REMOTA v1 — 0) PREFLIGHT (SOLO LECTURA). Correr en el SQL editor con un rol de lectura. No modifica nada.
-- Criterio: cada bloque indica el resultado esperado. Cualquier desvio = NO-GO hasta entenderlo.

-- P1. Son tablas reales (relkind 'r'; 'p' = particionada, requiere revision) y existen. ESPERADO: 2 filas, relkind r.
select c.relname, c.relkind, c.reltuples::bigint as filas_aprox, pg_size_pretty(pg_total_relation_size(c.oid)) as tam
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('progreso','sesiones');

-- P2. Las columnas nuevas NO existen todavia (o existen con el tipo exacto). ESPERADO: 0 filas (primera vez).
select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and (
       (table_name = 'progreso' and column_name in ('sesion_uid','bloque','pos'))
    or (table_name = 'sesiones' and column_name in ('sesion_uid','identidad_v')));

-- P3. Tipos actuales de las columnas que usa el contrato (id/opId, alumno_id, fecha, semana, ciclo...). ESPERADO: revisar a mano; progreso.id debe aceptar el opId (uuid o text).
select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns
 where table_schema = 'public' and table_name in ('progreso','sesiones') order by table_name, ordinal_position;

-- P4. Claves, restricciones e indices existentes (nombres a evitar: progreso_*_chk, sesiones_identidad_v_chk, *_sesion_uid_*). ESPERADO: progreso_pkey sobre id; ningun UNIQUE que choque.
select conrelid::regclass as tabla, conname, contype, pg_get_constraintdef(oid) as def from pg_constraint
 where conrelid in ('public.progreso'::regclass, 'public.sesiones'::regclass) order by 1, 2;
select tablename, indexname, indexdef from pg_indexes where schemaname = 'public' and tablename in ('progreso','sesiones') order by 1, 2;

-- P5. Triggers (ESPERADO: ninguno que reescriba filas/columnas por lista fija; revisar action_statement).
select event_object_table, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers
 where event_object_schema = 'public' and event_object_table in ('progreso','sesiones');

-- P6. Vistas / vistas materializadas dependientes (una vista con SELECT * no ve columnas nuevas hasta recrearla; no rompe).
select distinct v.oid::regclass as vista, v.relkind
  from pg_depend d join pg_rewrite r on r.oid = d.objid join pg_class v on v.oid = r.ev_class
 where d.refobjid in ('public.progreso'::regclass, 'public.sesiones'::regclass) and v.oid not in ('public.progreso'::regclass, 'public.sesiones'::regclass);

-- P7. RLS activa y politicas. ESPERADO: politicas por fila (alumno_id / entrenador), SIN lista de columnas; la migracion no las cambia.
select relname, relrowsecurity, relforcerowsecurity from pg_class where oid in ('public.progreso'::regclass, 'public.sesiones'::regclass);
select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename in ('progreso','sesiones') order by 1, 2;

-- P8. GRANT de tabla (ESPERADO: authenticated con SELECT/INSERT) y conteo de grants definidos SOLO por columna.
select grantee, table_name, privilege_type from information_schema.role_table_grants
 where table_schema = 'public' and table_name in ('progreso','sesiones') and grantee in ('anon','authenticated','service_role') order by 2, 1, 3;
select count(*) as grants_por_columna from information_schema.column_privileges cp
 where cp.table_schema = 'public' and cp.table_name in ('progreso','sesiones') and cp.grantee in ('anon','authenticated')
   and not exists (select 1 from information_schema.role_table_grants g where g.table_schema = cp.table_schema and g.table_name = cp.table_name and g.grantee = cp.grantee and g.privilege_type = cp.privilege_type);
-- ESPERADO (grants_por_columna): 0 (si > 0 hay grants solo por columna: agregar las nuevas columnas antes de activar la bandera).

-- P9. Funciones/RPC que escriben en progreso o sesiones (revisar si usan lista fija de columnas o SELECT *).
select p.proname, p.prosecdef as security_definer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and pg_get_functiondef(p.oid) ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?(progreso|sesiones)\y';

-- P10. Publicaciones (Realtime) que incluyen las tablas (si se usan listas de columnas, agregar las nuevas).
select pubname, schemaname, tablename, attnames from pg_publication_tables where schemaname = 'public' and tablename in ('progreso','sesiones');

-- P11. Sesiones duplicadas historicas (informativo: la unicidad es solo sobre sesion_uid NO nulo, asi que NO bloquea). ESPERADO: cualquier cantidad.
select alumno_id, fecha, dia_idx, semana, count(*) as n from public.sesiones group by 1,2,3,4 having count(*) > 1 order by n desc limit 20;

-- P12. Transacciones largas / bloqueos activos antes de ejecutar DDL. ESPERADO: ninguna transaccion de mas de unos minutos sobre estas tablas.
select pid, state, now() - xact_start as dur, left(query, 120) as q from pg_stat_activity
 where state <> 'idle' and xact_start is not null and now() - xact_start > interval '30 seconds' order by dur desc;
