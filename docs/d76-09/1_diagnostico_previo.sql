-- D76-09 · PASO 1 — Diagnóstico previo. SOLO LECTURA (una sola consulta SELECT). Supabase → SQL Editor → pegar y ejecutar.
-- Devuelve: n | control | resultado (OK / FALLA / AVISO / INFO) | detalle. Sin datos personales: solo conteos, tipos y nombres de objetos.
-- La última fila es el VEREDICTO: GO solo si no hay ninguna FALLA.
with
cfg as (select 'entrenador@irontrack.app'::text as coach_email),
col as (
  select c.relname::text as t, a.attname::text as c, format_type(a.atttypid, a.atttypmod) as tipo,
         a.attnotnull as nn, a.atthasdef as def, a.attidentity::text as ident, a.attgenerated::text as gen
    from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('alumnos', 'progreso', 'sesiones') and a.attnum > 0 and not a.attisdropped
),
tipo as (select t || '.' || c as k, tipo from col),
req(k) as (values ('progreso.id'), ('progreso.alumno_id'), ('progreso.ejercicio_id'), ('progreso.kg'), ('progreso.reps'), ('progreso.nota'),
  ('progreso.fecha'), ('progreso.semana'), ('progreso.ciclo'), ('sesiones.id'), ('sesiones.alumno_id'), ('sesiones.rutina_id'),
  ('sesiones.rutina_nombre'), ('sesiones.dia_label'), ('sesiones.dia_idx'), ('sesiones.semana'), ('sesiones.ejercicios'), ('sesiones.fecha'),
  ('sesiones.hora'), ('sesiones.ciclo')),
coach as (select u.id, u.email_confirmed_at from auth.users u, cfg where lower(u.email) = cfg.coach_email),
sin_uid as (select a.id, lower(a.email) as email from public.alumnos a where a.auth_uid is null),
chk(n, control, sev, ok, detalle) as (values
  (1, 'PostgreSQL >= 13', 'bloq', current_setting('server_version_num')::int >= 130000, current_setting('server_version')::text),
  (2, 'El esquema it_private todavía no existe', 'bloq', to_regnamespace('it_private') is null, null::text),
  (3, 'Nombres de las 5 RPC libres', 'bloq', not exists (select 1 from pg_proc p where p.pronamespace = 'public'::regnamespace
      and p.proname in ('it_historial_sello', 'it_limpiar_historial_alumno', 'it_historial_reingresar', 'it_vinculo_solicitar', 'it_vinculo_aprobar')), null),
  (4, 'Columnas nuevas todavía no existen (si existen por un rollback previo, la migración las reutiliza)', 'aviso',
      not exists (select 1 from col where c in ('historial_token', 'historial_epoch', 'reingreso_de_epoch', 'reingreso_at')),
      (select 'ya existen: ' || string_agg(t || '.' || c, ', ') from col where c in ('historial_token', 'historial_epoch', 'reingreso_de_epoch', 'reingreso_at'))),
  (5, 'auth.uid(), auth.jwt() y auth.users.email_confirmed_at', 'bloq',
      to_regprocedure('auth.uid()') is not null and to_regprocedure('auth.jwt()') is not null
      and exists (select 1 from pg_attribute a where a.attrelid = to_regclass('auth.users') and a.attname = 'email_confirmed_at'), null),
  (6, 'Tipos: ids uuid, fecha texto, kg decimal', 'bloq',
      (select count(*) from (values ('alumnos.id', 'uuid'), ('alumnos.auth_uid', 'uuid'), ('progreso.id', 'uuid'), ('progreso.alumno_id', 'uuid'),
          ('sesiones.alumno_id', 'uuid')) v(k, t) join tipo on tipo.k = v.k and tipo.tipo = v.t) = 5
      and (select count(*) from tipo where k in ('progreso.fecha', 'sesiones.fecha') and (tipo = 'text' or tipo like 'character varying%')) = 2
      and coalesce((select tipo from tipo where k = 'progreso.kg'), '') similar to '(numeric|real|double precision)%',
      (select string_agg(k || '=' || tipo, ', ' order by k) from tipo
        where k in ('alumnos.id', 'alumnos.auth_uid', 'progreso.id', 'progreso.alumno_id', 'sesiones.alumno_id', 'progreso.fecha', 'sesiones.fecha', 'progreso.kg'))),
  (7, 'Columnas que usan el trigger y el reingreso', 'bloq', not exists (select 1 from req where req.k not in (select k from tipo)),
      (select 'faltan: ' || string_agg(req.k, ', ') from req where req.k not in (select k from tipo))),
  (8, 'Sin otras columnas NOT NULL sin default', 'bloq', not exists (select 1 from col
        where t in ('progreso', 'sesiones') and nn and not def and ident = '' and gen = '' and (t || '.' || c) not in (select k from req)),
      (select string_agg(t || '.' || c, ', ') from col
        where t in ('progreso', 'sesiones') and nn and not def and ident = '' and gen = '' and (t || '.' || c) not in (select k from req))),
  (9, 'sesiones.id con valor por defecto', 'bloq', exists (select 1 from col where t = 'sesiones' and c = 'id' and (def or ident <> '')), null),
  (10, 'Clave primaria progreso_pkey(id)', 'bloq', exists (select 1 from pg_constraint k where k.conname = 'progreso_pkey'
        and k.conrelid = 'public.progreso'::regclass and k.contype = 'p'
        and k.conkey = array[(select a.attnum from pg_attribute a where a.attrelid = 'public.progreso'::regclass and a.attname = 'id')]), null),
  (11, 'Sin triggers previos en alumnos/progreso/sesiones', 'bloq', not exists (select 1 from pg_trigger t
        where t.tgrelid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass) and not t.tgisinternal),
      (select string_agg(t.tgname::text, ', ') from pg_trigger t
        where t.tgrelid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass) and not t.tgisinternal)),
  (12, 'El rol del SQL Editor es dueño de las tablas o tiene BYPASSRLS; sin FORCE RLS', 'bloq',
      not exists (select 1 from pg_class c join pg_roles r on r.rolname = current_user
        where c.oid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass) and c.relowner <> r.oid and not r.rolbypassrls)
      and not exists (select 1 from pg_class c where c.oid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass) and c.relforcerowsecurity),
      'rol=' || current_user || ' bypassrls=' || (select rolbypassrls::text from pg_roles where rolname = current_user)
        || ' dueños=' || (select string_agg(distinct pg_get_userbyid(c.relowner)::text, ',') from pg_class c
            where c.oid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass))),
  (13, 'Exactamente 1 cuenta Auth del entrenador, con email confirmado', 'bloq',
      (select count(*) from coach) = 1 and (select count(*) from coach where email_confirmed_at is not null) = 1,
      'cuentas=' || (select count(*) from coach) || ' confirmadas=' || (select count(*) from coach where email_confirmed_at is not null)),
  (14, 'La cuenta del entrenador tiene fila en public.entrenadores', 'bloq',
      exists (select 1 from coach c join public.entrenadores e on e.id::text = c.id::text), null),
  (15, 'entrenador_id de los alumnos compatible (legacy o el UID del entrenador)', 'bloq',
      not exists (select 1 from public.alumnos a where coalesce(a.entrenador_id::text, '') not in ('entrenador_principal', coalesce((select id::text from coach limit 1), '-'))),
      'alumnos fuera: ' || (select count(*) from public.alumnos a where coalesce(a.entrenador_id::text, '') not in ('entrenador_principal', coalesce((select id::text from coach limit 1), '-')))),
  (16, 'Alumnos sin auth_uid con vínculo posible (cuenta Auth confirmada con su email, libre)', 'aviso',
      (select count(*) from sin_uid) = (select count(*) from sin_uid s where (select count(*) from auth.users u where lower(u.email) = s.email
          and u.email_confirmed_at is not null and not exists (select 1 from public.alumnos o where o.auth_uid = u.id)) = 1),
      'sin auth_uid=' || (select count(*) from sin_uid) || ' con vínculo posible=' || (select count(*) from sin_uid s where (select count(*) from auth.users u
          where lower(u.email) = s.email and u.email_confirmed_at is not null and not exists (select 1 from public.alumnos o where o.auth_uid = u.id)) = 1)),
  (17, 'Sin emails de alumnos duplicados', 'aviso',
      not exists (select lower(email) from public.alumnos where email is not null group by lower(email) having count(*) > 1),
      'duplicados=' || (select count(*) from (select lower(email) from public.alumnos where email is not null group by lower(email) having count(*) > 1) d)),
  (18, 'app_metadata.alumno_id coherente con auth_uid', 'aviso',
      not exists (select 1 from auth.users u join public.alumnos a on a.id::text = u.raw_app_meta_data ->> 'alumno_id'
                   where a.auth_uid is not null and a.auth_uid <> u.id),
      'incoherencias=' || (select count(*) from auth.users u join public.alumnos a on a.id::text = u.raw_app_meta_data ->> 'alumno_id'
                   where a.auth_uid is not null and a.auth_uid <> u.id)),
  (19, 'it_private no figura en los esquemas expuestos por PostgREST (rol authenticator)', 'aviso',
      coalesce((select array_to_string(rolconfig, ' ') from pg_roles where rolname = 'authenticator'), '') not like '%it_private%',
      coalesce((select array_to_string(rolconfig, ' | ') from pg_roles where rolname = 'authenticator'), 'sin rolconfig (se usa la configuración del panel)')),
  (20, 'Sin transacciones abiertas hace más de 1 minuto (lock_timeout de 3 s)', 'aviso',
      not exists (select 1 from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid()
                   and xact_start < now() - interval '1 minute'), null),
  (21, 'Volumen actual (filas)', 'info', null,
      'progreso=' || (select count(*) from public.progreso) || ' sesiones=' || (select count(*) from public.sesiones) || ' alumnos=' || (select count(*) from public.alumnos)),
  (22, 'Políticas abiertas acceso_total (RLS general, fuera de alcance)', 'info', null,
      (select coalesce(string_agg(tablename::text, ', '), 'ninguna') from pg_policies where schemaname = 'public' and policyname = 'acceso_total'))
),
res as (
  select n, control,
         case when sev = 'info' or ok is null then 'INFO' when ok then 'OK' when sev = 'aviso' then 'AVISO' else 'FALLA' end as resultado,
         detalle
    from chk
)
select n, control, resultado, detalle from res
union all
select 99, 'VEREDICTO',
       case when exists (select 1 from res where resultado = 'FALLA') then 'NO-GO'
            when exists (select 1 from res where resultado = 'AVISO') then 'GO con avisos'
            else 'GO' end,
       (select count(*) filter (where resultado = 'FALLA') || ' fallas, ' || count(*) filter (where resultado = 'AVISO') || ' avisos' from res)
order by n;
