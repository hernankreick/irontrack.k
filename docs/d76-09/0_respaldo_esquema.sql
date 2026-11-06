-- D76-09 · PASO 0 — Respaldo del ESQUEMA (SOLO LECTURA, una sola consulta). Supabase → SQL Editor → ejecutar → exportar el resultado a CSV.
-- Complementa los CSV de datos (alumnos, progreso, sesiones, rutinas), que NO incluyen la estructura. Guarda: columnas y tipos, defaults,
-- restricciones (PK/FK/unique/check), índices, RLS y políticas, funciones, triggers y permisos de tabla del esquema public.
-- No es un backup restaurable automáticamente: sirve para revisar y reconstruir a mano. No contiene filas de datos.
select 'tabla' as tipo, c.relname::text as objeto,
       string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' not null' else '' end
                  || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), ''), ', ' order by a.attnum) as definicion
  from pg_class c
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
 where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
 group by c.relname
union all
select 'restriccion', conrelid::regclass::text || '.' || conname, pg_get_constraintdef(oid)
  from pg_constraint where connamespace = 'public'::regnamespace
union all
select 'indice', indexname::text, indexdef from pg_indexes where schemaname = 'public'
union all
select 'rls', relname::text, 'rls=' || relrowsecurity || ' force=' || relforcerowsecurity
  from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
union all
select 'politica', tablename || '.' || policyname, 'cmd=' || cmd || ' roles=' || array_to_string(roles, ',')
       || ' using=' || coalesce(qual, '') || ' check=' || coalesce(with_check, '')
  from pg_policies where schemaname = 'public'
union all
select 'funcion', p.oid::regprocedure::text, pg_get_functiondef(p.oid)
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
union all
select 'trigger', tgrelid::regclass::text || '.' || tgname, pg_get_triggerdef(oid)
  from pg_trigger where not tgisinternal and tgrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
union all
select 'permiso', table_name || ':' || grantee, string_agg(privilege_type, ',' order by privilege_type)
  from information_schema.role_table_grants where table_schema = 'public' group by table_name, grantee
order by 1, 2;
