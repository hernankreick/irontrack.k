-- D76-09 · PASO 3 — Verificación posterior a la migración. SOLO LECTURA (una sola consulta). Supabase → SQL Editor.
-- Devuelve: n | control | resultado (OK / FALLA / INFO) | detalle. Última fila: VEREDICTO (OK solo si no hay FALLA).
with
fn(nombre, firma) as (values
  ('it_historial_sello', 'public.it_historial_sello(uuid)'),
  ('it_limpiar_historial_alumno', 'public.it_limpiar_historial_alumno(uuid,bigint,boolean)'),
  ('it_historial_reingresar', 'public.it_historial_reingresar(uuid,bigint,jsonb,jsonb)'),
  ('it_vinculo_solicitar', 'public.it_vinculo_solicitar(uuid)'),
  ('it_vinculo_aprobar', 'public.it_vinculo_aprobar(uuid,uuid)')),
chk(n, control, ok, detalle) as (values
  (1, 'Esquema it_private y sus 6 tablas', to_regnamespace('it_private') is not null
      and (select count(*) from pg_class c where c.relnamespace = to_regnamespace('it_private') and c.relkind = 'r') = 6,
      (select string_agg(relname::text, ', ' order by relname) from pg_class where relnamespace = to_regnamespace('it_private') and relkind = 'r')),
  (2, 'Modo inicial = off (sin efecto sobre el registro de series)', (select modo from it_private.config) = 'off', (select modo from it_private.config)),
  (3, 'Exactamente 1 entrenador autorizado', (select count(*) from it_private.entrenadores_autorizados) = 1, null::text),
  (4, 'Las 5 RPC existen, SECURITY DEFINER y con search_path fijo', (select count(*) from fn join pg_proc p on p.oid = to_regprocedure(fn.firma)
        where p.prosecdef and exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) x where x like 'search_path=%')) = 5, null),
  (5, 'anon SIN permiso de ejecutar las 5 RPC', (select count(*) from fn where has_function_privilege('anon', fn.firma, 'execute')) = 0, null),
  (6, 'authenticated CON permiso de ejecutar las 5 RPC', (select count(*) from fn where has_function_privilege('authenticated', fn.firma, 'execute')) = 5, null),
  (7, 'it_private sin USAGE ni permisos de tabla para anon/authenticated', not has_schema_privilege('anon', 'it_private', 'usage')
      and not has_schema_privilege('authenticated', 'it_private', 'usage')
      and not exists (select 1 from information_schema.role_table_grants where table_schema = 'it_private' and grantee in ('anon', 'authenticated', 'PUBLIC')), null),
  (8, 'Funciones internas de it_private con search_path fijo', not exists (select 1 from pg_proc p where p.pronamespace = to_regnamespace('it_private')
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) x where x like 'search_path=%')),
      (select count(*)::text || ' funciones' from pg_proc where pronamespace = to_regnamespace('it_private'))),
  (9, '5 triggers instalados (insert x2, delete x2, auth_uid)', (select count(*) from pg_trigger t where not t.tgisinternal
        and t.tgname in ('it_historial_guard_insert', 'it_historial_guard_delete', 'it_alumnos_guard_auth_uid')
        and t.tgrelid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass)) = 5, null),
  (10, '8 columnas nuevas (nullable) en progreso y sesiones', (select count(*) from information_schema.columns where table_schema = 'public'
        and table_name in ('progreso', 'sesiones') and column_name in ('historial_token', 'historial_epoch', 'reingreso_de_epoch', 'reingreso_at')
        and is_nullable = 'YES') = 8, null),
  (11, 'Datos existentes intactos (ninguna fila con columnas nuevas completadas)', not exists (select 1 from public.progreso
        where historial_token is not null or historial_epoch is not null or reingreso_at is not null)
      and not exists (select 1 from public.sesiones where historial_token is not null or historial_epoch is not null or reingreso_at is not null), null),
  (12, 'Sin estado ni eventos todavía (nadie borró historial con la RPC)', null::boolean,
      'historial_estado=' || (select count(*) from it_private.historial_estado) || ' eventos=' || (select count(*) from it_private.eventos)
        || ' solicitudes de vínculo=' || (select count(*) from it_private.vinculos)),
  (13, 'Volumen (debe coincidir con el diagnóstico previo)', null::boolean,
      'progreso=' || (select count(*) from public.progreso) || ' sesiones=' || (select count(*) from public.sesiones) || ' alumnos=' || (select count(*) from public.alumnos))
),
res as (select n, control, case when ok is null then 'INFO' when ok then 'OK' else 'FALLA' end as resultado, detalle from chk)
select n, control, resultado, detalle from res
union all
select 99, 'VEREDICTO', case when exists (select 1 from res where resultado = 'FALLA') then 'FALLA: ejecutar rollback nivel 2' else 'OK' end,
       (select count(*) filter (where resultado = 'FALLA') || ' fallas' from res)
order by n;
