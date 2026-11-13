-- RLS v1 — 0) PREFLIGHT (SOLO LECTURA). Correr en el SQL editor de Supabase (rol postgres, que puede leer auth.users). No modifica nada.
-- Cada bloque indica lo ESPERADO; cualquier desvio = NO-GO hasta entenderlo.

-- R1. Tablas del contrato y RLS. ESPERADO: 12 filas relkind r, relrowsecurity true.
select c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relname in ('alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom') order by 1;
-- R2. Columnas y tipos del contrato. ESPERADO: ninguna falta (la migracion aborta si falta alguna); mensajes.de_entrenador = boolean.
select table_name, column_name, data_type from information_schema.columns where table_schema = 'public'
   and ((table_name, column_name) in (('alumnos','id'),('alumnos','entrenador_id'),('entrenadores','id'),('rutinas','alumno_id'),('rutinas','entrenador_id'),('rutinas','datos'),('sesiones','alumno_id'),('progreso','alumno_id'),
        ('mensajes','alumno_id'),('mensajes','de_entrenador'),('mensajes','leido'),('notas','alumno_id'),('fotos','alumno_id'),('config','id'),('video_overrides','entrenador_id'),('ejercicio_overrides','entrenador_id'),('ejercicios_custom','entrenador_id')))
 order by 1, 2;
-- R3. TODAS las politicas actuales de esas tablas (se reemplazan por completo). ESPERADO: revisar; solo acceso_total conocida. Cualquier otra: entender antes.
select tablename, policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname = 'public'
   and tablename in ('alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom') order by 1, 2;
-- R4. Grants actuales de anon/authenticated sobre esas tablas (tabla y columna). ESPERADO: anon con privilegios hoy (se retiran); 0 grants por columna (P8).
select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) as privilegios from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated') and table_name in ('alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom') group by 1, 2 order by 2, 1;
-- R5. Funciones de public que pueden eludir las politicas: SECURITY DEFINER o que escriben en las tablas; quien puede ejecutarlas. ESPERADO: ninguna sin revisar.
with f as materialized (select p.oid, p.proname, p.prosecdef, p.proowner::regrole as dueno, p.proconfig, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind in ('f','p'))
select proname, prosecdef as security_definer, dueno, proconfig as config, proacl as permisos,
       has_function_privilege('anon', oid, 'execute') as anon_ejecuta, has_function_privilege('authenticated', oid, 'execute') as authenticated_ejecuta
  from f where prosecdef or pg_get_functiondef(oid) ~* '(insert\s+into|update|delete\s+from)\s+(public\.)?(alumnos|entrenadores|rutinas|sesiones|progreso|mensajes|notas|fotos|config|video_overrides|ejercicio_overrides|ejercicios_custom)\y' order by 1;
-- R6. Triggers existentes en esas tablas (la migracion agrega it_guard_*). ESPERADO: ninguno que reescriba columnas de forma incompatible.
select event_object_table, trigger_name, action_timing, event_manipulation, action_statement from information_schema.triggers
 where event_object_schema = 'public' and event_object_table in ('alumnos','mensajes','rutinas') order by 1, 2;
-- R7. Vinculo cuenta <-> alumno (CRITICO): cada alumno que inicia sesion necesita EXACTAMENTE una cuenta con app_metadata.alumno_id = alumnos.id.
--     ESPERADO: sin_cuenta_vinculada = 0 para todo alumno que use la app; los que den 0 perderan TODO acceso hasta vincularse (scripts/admin/link-alumno.mjs, de a uno, con verificacion humana).
select a.id, a.entrenador_id, (select count(*) from auth.users u where u.raw_app_meta_data ->> 'alumno_id' = a.id::text) as cuentas_vinculadas from public.alumnos a order by cuentas_vinculadas, a.id;
select u.raw_app_meta_data ->> 'alumno_id' as alumno_id, count(*) as cuentas from auth.users u where u.raw_app_meta_data ? 'alumno_id' group by 1 having count(*) > 1;   -- ESPERADO: 0 filas
select u.raw_app_meta_data ->> 'alumno_id' as alumno_id_huerfano from auth.users u where u.raw_app_meta_data ? 'alumno_id' and not exists (select 1 from public.alumnos a where a.id::text = u.raw_app_meta_data ->> 'alumno_id');  -- ESPERADO: 0 filas
-- R8. Entrenador(es): uids a cargar en it_authz.entrenadores_autorizados (los MISMOS que el secreto COACH_UIDS). ESPERADO: el uid del entrenador real.
select u.id, u.email, u.created_at, u.last_sign_in_at, u.raw_app_meta_data ->> 'alumno_id' as alumno_id_vinculado from auth.users u where u.email = 'entrenador@irontrack.app';
-- R9. A quien pertenece cada alumno. CRITICO: el entrenador solo gestiona alumnos cuyo entrenador_id sea su uid o 'entrenador_principal'; cualquier otro valor deja al alumno sin gestor.
select entrenador_id, count(*) as alumnos from public.alumnos group by 1 order by 2 desc;
-- R10. Datos huerfanos: filas con alumno_id sin alumno (quedarian invisibles para el entrenador). ESPERADO: 0 (o conocido).
select 'progreso' as tabla, count(*) as huerfanas from public.progreso p where not exists (select 1 from public.alumnos a where a.id::text = p.alumno_id::text)
union all select 'sesiones', count(*) from public.sesiones p where not exists (select 1 from public.alumnos a where a.id::text = p.alumno_id::text)
union all select 'rutinas', count(*) from public.rutinas p where p.alumno_id is not null and not exists (select 1 from public.alumnos a where a.id::text = p.alumno_id::text)
union all select 'mensajes', count(*) from public.mensajes p where not exists (select 1 from public.alumnos a where a.id::text = p.alumno_id::text);
-- R11. Transacciones largas / bloqueos antes de DDL. ESPERADO: ninguna.
select pid, state, now() - xact_start as dur, left(query, 120) as q from pg_stat_activity where state <> 'idle' and xact_start is not null and now() - xact_start > interval '30 seconds' order by dur desc;
