-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- D76-09 · PASO 2 — Migración (versión final de despliegue)
-- Época de historial por alumno, borrado atómico, sello de servidor, cuarentena/reingreso y vínculo seguro.
-- NO EJECUTAR sin la autorización explícita del dueño y sin el PASO 1 (diagnóstico) completamente en OK.
-- Destino: PostgreSQL 17 (Supabase), READ COMMITTED. Se aplica UNA vez (aborta si it_private ya existe).
-- Efecto inmediato: NINGUNO sobre el registro de series (modo 'off'). Solo agrega objetos y columnas nullable; no modifica filas.
-- Una sola transacción: si cualquier verificación falla, NO queda nada aplicado. No requiere editar nada antes de ejecutarla.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';          -- si hay inserts en curso y no obtiene el lock, aborta sin efectos (reintentar luego)
set local statement_timeout = '120s';

-- ─── 0. Verificaciones previas (solo lectura; cualquier diferencia aborta TODO) ──────────────────────────────────────
do $pre$
declare v_bad text;
begin
  if current_setting('server_version_num')::int < 130000 then raise exception 'D76-09: se requiere PostgreSQL >= 13'; end if;
  if to_regnamespace('it_private') is not null then raise exception 'D76-09: el esquema it_private ya existe'; end if;
  if not exists (select 1 from pg_attribute a where a.attrelid = to_regclass('auth.users') and a.attname = 'email_confirmed_at') then
    raise exception 'D76-09: falta auth.users.email_confirmed_at';
  end if;
  if to_regprocedure('auth.uid()') is null or to_regprocedure('auth.jwt()') is null then
    raise exception 'D76-09: faltan auth.uid() / auth.jwt()';
  end if;
  select string_agg(c.rel || '.' || c.col || '=' || coalesce(format_type(a.atttypid, a.atttypmod), 'NO EXISTE'), ', ')
    into v_bad
    from (values ('alumnos','id','uuid'), ('alumnos','auth_uid','uuid'), ('progreso','id','uuid'),
                 ('progreso','alumno_id','uuid'), ('sesiones','alumno_id','uuid'),
                 ('progreso','fecha','text'), ('sesiones','fecha','text')) as c(rel, col, tipo)
    left join pg_attribute a
      on a.attrelid = to_regclass('public.' || c.rel) and a.attname = c.col and not a.attisdropped
   where not (coalesce(format_type(a.atttypid, a.atttypmod), '') = c.tipo
              or (c.tipo = 'text' and coalesce(format_type(a.atttypid, a.atttypmod), '') like 'character varying%'));
  if v_bad is not null then raise exception 'D76-09: tipos inesperados: %', v_bad; end if;
  if not exists (select 1 from pg_attribute a where a.attrelid = 'public.sesiones'::regclass and a.attname = 'id' and not a.attisdropped) then
    raise exception 'D76-09: sesiones.id no existe';
  end if;
  if (select format_type(a.atttypid, a.atttypmod) from pg_attribute a
       where a.attrelid = 'public.progreso'::regclass and a.attname = 'kg' and not a.attisdropped)
     not similar to '(numeric|real|double precision)%' then
    raise exception 'D76-09: progreso.kg no es decimal (numeric/real/double): revisar el reingreso';
  end if;
  -- Columnas que usan el trigger y «Subir igual» (it_historial_reingresar inserta columnas explícitas).
  select string_agg(c.rel || '.' || c.col, ', ') into v_bad
    from (values ('progreso','ejercicio_id'), ('progreso','kg'), ('progreso','reps'), ('progreso','nota'), ('progreso','semana'),
                 ('progreso','ciclo'), ('sesiones','rutina_id'), ('sesiones','rutina_nombre'), ('sesiones','dia_label'),
                 ('sesiones','dia_idx'), ('sesiones','semana'), ('sesiones','ejercicios'), ('sesiones','hora'), ('sesiones','ciclo')) as c(rel, col)
   where not exists (select 1 from pg_attribute a where a.attrelid = to_regclass('public.' || c.rel) and a.attname = c.col and not a.attisdropped);
  if v_bad is not null then raise exception 'D76-09: faltan columnas: %', v_bad; end if;
  -- Ninguna otra columna NOT NULL sin default (el reingreso no la completaría).
  select string_agg(c.relname || '.' || a.attname, ', ') into v_bad
    from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.oid in ('public.progreso'::regclass, 'public.sesiones'::regclass) and a.attnum > 0 and not a.attisdropped
     and a.attnotnull and not a.atthasdef and a.attidentity = '' and a.attgenerated = ''
     and not (c.relname = 'progreso' and a.attname in ('id', 'alumno_id', 'ejercicio_id', 'kg', 'reps', 'nota', 'fecha', 'semana', 'ciclo'))
     and not (c.relname = 'sesiones' and a.attname in ('alumno_id', 'rutina_id', 'rutina_nombre', 'dia_label', 'dia_idx', 'semana', 'ejercicios', 'fecha', 'hora', 'ciclo'));
  if v_bad is not null then raise exception 'D76-09: columnas NOT NULL sin default no contempladas: %', v_bad; end if;
  if not exists (select 1 from pg_attribute a where a.attrelid = 'public.sesiones'::regclass and a.attname = 'id'
                  and (a.atthasdef or a.attidentity <> '')) then
    raise exception 'D76-09: sesiones.id no tiene valor por defecto (el reingreso de sesiones lo necesita)';
  end if;
  if not exists (select 1 from pg_constraint k where k.conname = 'progreso_pkey' and k.conrelid = 'public.progreso'::regclass and k.contype = 'p'
                  and k.conkey = array[(select a.attnum from pg_attribute a where a.attrelid = 'public.progreso'::regclass and a.attname = 'id')]) then
    raise exception 'D76-09: la clave primaria de progreso no es progreso_pkey(id) (la usa la deteccion del reintento idempotente)';
  end if;
  if exists (select 1 from pg_trigger t
              where t.tgrelid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass)
                and not t.tgisinternal) then
    raise exception 'D76-09: hay triggers previos en alumnos/progreso/sesiones: revisar antes de aplicar';
  end if;
  -- Las funciones SECURITY DEFINER quedan con dueño = current_user: debe ser dueño de las tablas o tener BYPASSRLS,
  -- así su lectura/borrado NO depende de las políticas acceso_total (ni de las futuras).
  if exists (select 1 from pg_class c join pg_roles r on r.rolname = current_user
              where c.oid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass)
                and c.relowner <> r.oid and not r.rolbypassrls) then
    raise exception 'D76-09: el rol que aplica la migración no es dueño de las tablas ni tiene BYPASSRLS';
  end if;
  if exists (select 1 from pg_class c
              where c.oid in ('public.alumnos'::regclass, 'public.progreso'::regclass, 'public.sesiones'::regclass)
                and c.relforcerowsecurity) then
    raise exception 'D76-09: FORCE ROW LEVEL SECURITY activo: revisar';
  end if;
end $pre$;

-- ─── 1. Esquema privado (NO expuesto por PostgREST; sin permisos para clientes) ──────────────────────────────────────
create schema it_private;
revoke all on schema it_private from public;
revoke all on schema it_private from anon, authenticated;

create table it_private.historial_estado (
  alumno_id uuid primary key references public.alumnos(id) on delete cascade,
  epoch     bigint      not null default 0 check (epoch >= 0),
  token     uuid        not null default pg_catalog.gen_random_uuid(),   -- "sello" vigente; cambia en cada borrado
  reset_at  timestamptz,                                                   -- null = nunca se borró su historial
  reset_by  uuid
);

create table it_private.config (
  id   boolean primary key default true check (id),
  modo text not null default 'off' check (modo in ('off', 'observar', 'activo'))
);
insert into it_private.config default values;

create table it_private.entrenadores_autorizados (
  uid uuid primary key references auth.users(id) on delete cascade
);

-- Solicitudes de vínculo alumno ↔ cuenta Auth (alumno sin auth_uid). Las crea el propio alumno con sesión iniciada; las aprueba su entrenador.
create table it_private.vinculos (
  alumno_id     uuid primary key references public.alumnos(id) on delete cascade,
  auth_uid      uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  solicitado_at timestamptz not null default now()
);

-- Marca de "vía interna" por transacción: la escriben SOLO las RPC (dueño). Ningún cliente puede escribirla, ni con SQL directo
-- (sin USAGE sobre it_private). Reemplaza a una variable de sesión, que cualquier rol con SQL directo podría fijar.
create table it_private.via_tx (
  txid bigint not null,
  via  text   not null check (via in ('limpiar', 'reingreso', 'vinculo')),
  primary key (txid, via)
);

create table it_private.eventos (
  id            bigserial primary key,
  at            timestamptz not null default now(),
  tabla         text not null,
  alumno_id     uuid,
  fila_id       text,
  motivo        text not null,
  modo          text not null,
  epoch_vigente bigint,
  rol           text
);

alter table it_private.historial_estado         enable row level security;
alter table it_private.config                   enable row level security;
alter table it_private.entrenadores_autorizados enable row level security;
alter table it_private.eventos                  enable row level security;
alter table it_private.vinculos                 enable row level security;
alter table it_private.via_tx                   enable row level security;

-- ─── 2. Entrenador autorizado (se resuelve solo; sin editar nada) ─────────────────────────────────────────────────────
-- Ancla: la cuenta de Supabase Auth con el email de entrenador que usa el login de la app (App.jsx). Se exige EXACTAMENTE una cuenta,
-- con el email confirmado y con su fila en public.entrenadores (la que crea el login del entrenador). Si no, aborta TODO.
-- (No se usan tablas que los clientes puedan escribir como única prueba: el email de Auth solo lo cambia el servidor.)
do $coach$
declare v_email text := 'entrenador@irontrack.app'; v_n int; v_uid uuid;
begin
  select count(*), min(u.id::text)::uuid into v_n, v_uid
    from auth.users u where pg_catalog.lower(u.email) = v_email and u.email_confirmed_at is not null;
  if v_n <> 1 then
    raise exception 'D76-09: se esperaba exactamente 1 cuenta Auth confirmada del entrenador (%), hay %', v_email, v_n;
  end if;
  if to_regclass('public.entrenadores') is not null
     and not exists (select 1 from public.entrenadores e where e.id::text = v_uid::text) then
    raise exception 'D76-09: la cuenta del entrenador no tiene fila en public.entrenadores';
  end if;
  insert into it_private.entrenadores_autorizados (uid) values (v_uid);
end $coach$;

-- ─── 3. Columnas nuevas (nullable, sin default: cambio de metadatos, sin reescritura) ─────────────────────────────────
--  historial_token : sello que envía el cliente; el trigger lo valida y lo BORRA (nunca queda guardado ni es legible).
--  historial_epoch : época con la que el SERVIDOR aceptó la fila (la escribe el trigger; lo que mande el cliente se ignora).
--  reingreso_*     : auditoría de «subir igual» (solo los escribe la RPC; lo que mande el cliente se ignora).
alter table public.progreso
  add column if not exists historial_token    uuid,
  add column if not exists historial_epoch    bigint,
  add column if not exists reingreso_de_epoch bigint,
  add column if not exists reingreso_at       timestamptz;
alter table public.sesiones
  add column if not exists historial_token    uuid,
  add column if not exists historial_epoch    bigint,
  add column if not exists reingreso_de_epoch bigint,
  add column if not exists reingreso_at       timestamptz;

-- ─── 4. Funciones auxiliares (SECURITY INVOKER; solo las usan las funciones DEFINER de abajo, que corren como dueño) ──
create function it_private.claim_role() returns text
language sql stable set search_path = '' as $$
  select coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '')
$$;

create function it_private.via_activa(p_via text) returns boolean
language sql volatile set search_path = '' as $$
  select exists (select 1 from it_private.via_tx v where v.txid = pg_catalog.txid_current() and v.via = p_via)
$$;
create function it_private.via_marcar(p_via text) returns void
language sql volatile set search_path = '' as $$
  insert into it_private.via_tx (txid, via) values (pg_catalog.txid_current(), p_via) on conflict do nothing
$$;
create function it_private.via_desmarcar(p_via text) returns void
language sql volatile set search_path = '' as $$
  delete from it_private.via_tx where txid = pg_catalog.txid_current() and via = p_via
$$;

create function it_private.es_entrenador_de(p_alumno_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null
     and exists (select 1 from it_private.entrenadores_autorizados e where e.uid = auth.uid())
     and exists (select 1 from public.alumnos a
                  where a.id = p_alumno_id
                    and a.entrenador_id in (auth.uid()::text, 'entrenador_principal'))
$$;

-- Vínculo alumno ↔ usuario: auth_uid (protegido por el trigger de la sección 6) o app_metadata.alumno_id (solo lo escribe el servidor).
create function it_private.es_alumno(p_alumno_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select auth.uid() is not null
     and (exists (select 1 from public.alumnos a where a.id = p_alumno_id and a.auth_uid = auth.uid())
          or coalesce(auth.jwt() -> 'app_metadata' ->> 'alumno_id', '') = p_alumno_id::text)
$$;

create function it_private.alumno_vinculado(p_alumno_id uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.alumnos a where a.id = p_alumno_id and a.auth_uid is not null)
      or exists (select 1 from auth.users u where u.raw_app_meta_data ->> 'alumno_id' = p_alumno_id::text)
$$;

create function it_private.fecha_norm(f text) returns text
language sql immutable set search_path = '' as $$
  select case when f ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$'
              then pg_catalog.lpad(pg_catalog.split_part(f, '/', 1), 2, '0') || '/' ||
                   pg_catalog.lpad(pg_catalog.split_part(f, '/', 2), 2, '0') || '/' || pg_catalog.split_part(f, '/', 3)
              else f end
$$;

create function it_private.entero_en(v jsonb, lo numeric, hi numeric) returns boolean
language sql immutable set search_path = '' as $$
  select case when coalesce(pg_catalog.jsonb_typeof(v), '') = 'number'          -- CASE: sin cortocircuito en AND/OR, el cast
              then (v #>> '{}')::numeric = pg_catalog.trunc((v #>> '{}')::numeric) --       solo se evalua si es un numero
                   and (v #>> '{}')::numeric between lo and hi
              else false end
$$;

-- Misma regla que lib/cargaSerie.js (KG_MAX_TECNICO = 10000, REPS_MAX_TECNICO = 99999). null = válida; si no, el motivo.
create function it_private.serie_invalida(r jsonb) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if coalesce(pg_catalog.jsonb_typeof(r), '') <> 'object' then return 'formato'; end if;
  if coalesce(r ->> 'id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return 'id'; end if;
  if coalesce(r ->> 'ejercicio_id', '') = '' or pg_catalog.length(r ->> 'ejercicio_id') > 200 then return 'ejercicio'; end if;
  if coalesce(pg_catalog.jsonb_typeof(r -> 'kg'), '') <> 'number' then return 'kg'; end if;
  if (r ->> 'kg')::numeric < 0 or (r ->> 'kg')::numeric > 10000 then return 'kg'; end if;
  if not it_private.entero_en(r -> 'reps', 1, 99999) then return 'reps'; end if;
  if coalesce(r ->> 'fecha', '') !~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' then return 'fecha'; end if;
  if not it_private.entero_en(r -> 'semana', 0, 520) then return 'semana'; end if;
  if coalesce(pg_catalog.jsonb_typeof(r -> 'ciclo'), 'null') <> 'null' and not it_private.entero_en(r -> 'ciclo', 1, 100000) then return 'ciclo'; end if;
  if coalesce(pg_catalog.jsonb_typeof(r -> 'nota'), 'null') not in ('string', 'null') then return 'nota'; end if;
  if coalesce(pg_catalog.jsonb_typeof(r -> 'epoch_original'), 'null') <> 'null'
     and not it_private.entero_en(r -> 'epoch_original', 0, 9223372036854775807) then return 'epoch_original'; end if;
  return null;
end $$;

create function it_private.sesion_invalida(r jsonb) returns text
language plpgsql immutable set search_path = '' as $$
begin
  if coalesce(pg_catalog.jsonb_typeof(r), '') <> 'object' then return 'formato'; end if;
  if coalesce(r ->> 'fecha', '') !~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' then return 'fecha'; end if;
  if not it_private.entero_en(r -> 'dia_idx', 0, 100) then return 'dia_idx'; end if;
  if not it_private.entero_en(r -> 'semana', 0, 520) then return 'semana'; end if;
  if coalesce(pg_catalog.jsonb_typeof(r -> 'ciclo'), 'null') <> 'null' and not it_private.entero_en(r -> 'ciclo', 1, 100000) then return 'ciclo'; end if;
  if coalesce(pg_catalog.jsonb_typeof(r -> 'rutina_id'), 'null') not in ('string', 'null') then return 'rutina_id'; end if;
  if coalesce(pg_catalog.jsonb_typeof(r -> 'epoch_original'), 'null') <> 'null'
     and not it_private.entero_en(r -> 'epoch_original', 0, 9223372036854775807) then return 'epoch_original'; end if;
  return null;
end $$;

-- ─── 5. Triggers de protección (SECURITY DEFINER: leen it_private, sin permisos para clientes. No invocables por RPC:
--        devuelven `trigger`; no reciben parámetros; search_path vacío y nombres calificados) ───────────────────────────
create function it_private.historial_guard_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_sello  uuid := new.historial_token;
  v_via    text := case when it_private.via_activa('reingreso') then 'reingreso' else '' end;
  v_modo   text;
  v_epoch  bigint;
  v_token  uuid;
  v_reset  timestamptz;
  v_motivo text;
begin
  new.historial_token := null;                      -- el sello nunca se guarda
  new.historial_epoch := null;                      -- solo lo fija el servidor
  if v_via <> 'reingreso' then                      -- la auditoría solo la escribe la RPC de reingreso
    new.reingreso_de_epoch := null;
    new.reingreso_at := null;
  end if;
  select c.modo into v_modo from it_private.config c where c.id;
  if coalesce(v_modo, 'off') = 'off' then return new; end if;

  -- Lock COMPARTIDO por alumno: espera a un borrado en curso (que lo toma EXCLUSIVO) y lo mantiene hasta el COMMIT.
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtext('it_hist'), pg_catalog.hashtext(new.alumno_id::text));
  -- Sentencia NUEVA tras el lock => instantánea nueva (READ COMMITTED): ve el borrado ya confirmado.
  select e.epoch, e.token, e.reset_at into v_epoch, v_token, v_reset
    from it_private.historial_estado e where e.alumno_id = new.alumno_id;

  if v_reset is null then                           -- nunca se borró su historial: no hay nada que proteger
    new.historial_epoch := coalesce(v_epoch, 0);
    return new;
  end if;
  if v_via = 'reingreso' or (v_sello is not null and v_sello = v_token) then
    new.historial_epoch := v_epoch;
    return new;
  end if;

  v_motivo := case when v_sello is null then 'sin_sello' else 'sello_anterior' end;
  if v_modo = 'observar' then
    insert into it_private.eventos (tabla, alumno_id, fila_id, motivo, modo, epoch_vigente, rol)
    values (tg_table_name, new.alumno_id, new.id::text, v_motivo, v_modo, v_epoch, it_private.claim_role());
    return new;
  end if;
  raise exception using errcode = 'IT409', message = 'it_historial_reiniciado',
                        detail = v_motivo, hint = 'epoch_vigente=' || v_epoch;
end $$;

-- Todo borrado de progreso/sesiones desde la API debe pasar por la RPC (que sube la época). Admin (SQL Editor) y service_role: permitido.
create function it_private.historial_guard_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_modo text;
begin
  select c.modo into v_modo from it_private.config c where c.id;
  if coalesce(v_modo, 'off') = 'off' then return null; end if;
  if it_private.via_activa('limpiar') then return null; end if;
  if it_private.claim_role() in ('anon', 'authenticated') then
    raise exception using errcode = '42501', message = 'it_borrado_solo_por_rpc', hint = 'usar it_limpiar_historial_alumno';
  end if;
  return null;
end $$;

create trigger it_historial_guard_insert before insert on public.progreso
  for each row execute function it_private.historial_guard_insert();
create trigger it_historial_guard_insert before insert on public.sesiones
  for each row execute function it_private.historial_guard_insert();
create trigger it_historial_guard_delete before delete on public.progreso
  for each statement execute function it_private.historial_guard_delete();
create trigger it_historial_guard_delete before delete on public.sesiones
  for each statement execute function it_private.historial_guard_delete();

-- ─── 6. Protección del vínculo alumno ↔ Auth (la autorización de las RPC depende de él; acceso_total lo deja editable) ──
create function it_private.alumnos_guard_auth_uid() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if it_private.claim_role() in ('anon', 'authenticated')
     and not it_private.via_activa('vinculo') then
    if tg_op = 'INSERT' and new.auth_uid is not null then
      raise exception using errcode = '42501', message = 'it_auth_uid_solo_servidor';
    end if;
    if tg_op = 'UPDATE' and new.auth_uid is distinct from old.auth_uid then
      raise exception using errcode = '42501', message = 'it_auth_uid_solo_servidor';
    end if;
  end if;
  return new;
end $$;
create trigger it_alumnos_guard_auth_uid before insert or update of auth_uid on public.alumnos
  for each row execute function it_private.alumnos_guard_auth_uid();

-- ─── 7. RPC (SECURITY DEFINER con autorización explícita; EXECUTE solo para authenticated) ─────────────────────────────

-- 7.1 Sello vigente. Lo pide el alumno (para sellar sus series) o su entrenador (para validar sesiones). Solo lectura.
create function public.it_historial_sello(p_alumno_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_epoch bigint; v_token uuid; v_reset timestamptz; v_modo text; v_sol jsonb := null;
begin
  if auth.uid() is null or not (it_private.es_alumno(p_alumno_id) or it_private.es_entrenador_de(p_alumno_id)) then
    raise exception using errcode = '42501', message = 'it_sin_permiso';
  end if;
  if it_private.es_entrenador_de(p_alumno_id) then
    select pg_catalog.jsonb_build_object('auth_uid', v.auth_uid, 'email', v.email, 'solicitado_at', v.solicitado_at)
      into v_sol from it_private.vinculos v where v.alumno_id = p_alumno_id;
  end if;
  select e.epoch, e.token, e.reset_at into v_epoch, v_token, v_reset
    from it_private.historial_estado e where e.alumno_id = p_alumno_id;
  select c.modo into v_modo from it_private.config c where c.id;
  return pg_catalog.jsonb_build_object(
    'epoch', coalesce(v_epoch, 0), 'sello', v_token, 'reset_at', v_reset, 'modo', coalesce(v_modo, 'off'),
    'vinculado', it_private.alumno_vinculado(p_alumno_id), 'solicitud_vinculo', v_sol);
end $$;

-- 7.2 Borrado atómico: sube la época, cambia el sello y borra progreso + sesiones en UNA transacción.
create function public.it_limpiar_historial_alumno(p_alumno_id uuid, p_epoch_esperado bigint,
                                                   p_confirmar_sin_vinculo boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_epoch bigint; v_prog bigint; v_ses bigint;
begin
  if auth.uid() is null or not it_private.es_entrenador_de(p_alumno_id) then
    raise exception using errcode = '42501', message = 'it_sin_permiso';
  end if;
  -- Un alumno sin vínculo verificable no podría obtener el sello nuevo: tras el borrado, TODO lo que registre iría a cuarentena.
  if not it_private.alumno_vinculado(p_alumno_id) and not coalesce(p_confirmar_sin_vinculo, false) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'alumno_sin_vinculo');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('it_hist'), pg_catalog.hashtext(p_alumno_id::text));
  insert into it_private.historial_estado (alumno_id) values (p_alumno_id) on conflict (alumno_id) do nothing;
  select e.epoch into v_epoch from it_private.historial_estado e where e.alumno_id = p_alumno_id for update;
  if p_epoch_esperado is distinct from v_epoch then             -- doble clic / otro dispositivo / pantalla desactualizada
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'conflicto_epoch', 'epoch', v_epoch);
  end if;
  update it_private.historial_estado
     set epoch = v_epoch + 1, token = pg_catalog.gen_random_uuid(), reset_at = pg_catalog.now(), reset_by = auth.uid()
   where alumno_id = p_alumno_id;
  perform it_private.via_marcar('limpiar');
  delete from public.progreso where alumno_id = p_alumno_id;
  get diagnostics v_prog = row_count;
  delete from public.sesiones where alumno_id = p_alumno_id;
  get diagnostics v_ses = row_count;
  perform it_private.via_desmarcar('limpiar');
  return pg_catalog.jsonb_build_object('ok', true, 'epoch', v_epoch + 1, 'progreso', v_prog, 'sesiones', v_ses);
end $$;

-- 7.3 «Subir igual»: SOLO el propio alumno, con la época que vio y confirmó. Si hubo otro borrado entretanto => conflicto_epoch.
--     Idempotente: series por id (ON CONFLICT), sesiones por (fecha, dia_idx, semana, ciclo). Lote máximo: 200.
create function public.it_historial_reingresar(p_alumno_id uuid, p_epoch_confirmado bigint,
                                               p_series jsonb, p_sesiones jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_epoch bigint; v_reset timestamptz; v_n bigint; v_mot text; v_res jsonb := '[]'::jsonb;
  r jsonb; v_p public.progreso%rowtype; v_s public.sesiones%rowtype;
  v_series jsonb := coalesce(p_series, '[]'::jsonb); v_sesiones jsonb := coalesce(p_sesiones, '[]'::jsonb);
begin
  if auth.uid() is null or not it_private.es_alumno(p_alumno_id) then
    raise exception using errcode = '42501', message = 'it_sin_permiso';
  end if;
  if pg_catalog.jsonb_typeof(v_series) <> 'array' or pg_catalog.jsonb_typeof(v_sesiones) <> 'array'
     or pg_catalog.jsonb_array_length(v_series) + pg_catalog.jsonb_array_length(v_sesiones) > 200 then
    raise exception using errcode = '22023', message = 'it_lote_invalido';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtext('it_hist'), pg_catalog.hashtext(p_alumno_id::text));
  select e.epoch, e.reset_at into v_epoch, v_reset from it_private.historial_estado e where e.alumno_id = p_alumno_id;
  if v_reset is null then return pg_catalog.jsonb_build_object('ok', false, 'reason', 'sin_borrado'); end if;
  if p_epoch_confirmado is distinct from v_epoch then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'conflicto_epoch', 'epoch', v_epoch);
  end if;
  perform it_private.via_marcar('reingreso');

  for r in select x from pg_catalog.jsonb_array_elements(v_series) as t(x) loop
    v_mot := it_private.serie_invalida(r);
    if v_mot is not null then
      v_res := v_res || pg_catalog.jsonb_build_object('tipo', 'serie', 'id', r ->> 'id', 'resultado', 'invalida', 'motivo', v_mot);
      continue;
    end if;
    v_p := pg_catalog.jsonb_populate_record(null::public.progreso, pg_catalog.jsonb_build_object(
             'id', r -> 'id', 'ejercicio_id', r -> 'ejercicio_id', 'kg', r -> 'kg', 'reps', r -> 'reps',
             'nota', coalesce(r -> 'nota', '""'::jsonb), 'fecha', r -> 'fecha', 'semana', r -> 'semana', 'ciclo', r -> 'ciclo'));
    insert into public.progreso (id, alumno_id, ejercicio_id, kg, reps, nota, fecha, semana, ciclo, reingreso_de_epoch, reingreso_at)
    values (v_p.id, p_alumno_id, v_p.ejercicio_id, v_p.kg, v_p.reps, coalesce(v_p.nota, ''), v_p.fecha, v_p.semana,
            coalesce(v_p.ciclo, 1), (r ->> 'epoch_original')::bigint, pg_catalog.now())
    on conflict (id) do nothing;
    get diagnostics v_n = row_count;
    v_res := v_res || pg_catalog.jsonb_build_object('tipo', 'serie', 'id', r ->> 'id', 'resultado',
      case when v_n = 1 then 'insertada'
           when exists (select 1 from public.progreso p where p.id = v_p.id and p.alumno_id = p_alumno_id
                          and p.ejercicio_id = v_p.ejercicio_id and p.kg = v_p.kg and p.reps = v_p.reps) then 'ya_existia'
           else 'conflicto_id' end);
  end loop;

  for r in select x from pg_catalog.jsonb_array_elements(v_sesiones) as t(x) loop
    v_mot := it_private.sesion_invalida(r);
    if v_mot is not null then
      v_res := v_res || pg_catalog.jsonb_build_object('tipo', 'sesion', 'clave', r ->> 'clave', 'resultado', 'invalida', 'motivo', v_mot);
      continue;
    end if;
    v_s := pg_catalog.jsonb_populate_record(null::public.sesiones, pg_catalog.jsonb_build_object(
             'rutina_id', r -> 'rutina_id', 'rutina_nombre', r -> 'rutina_nombre', 'dia_label', r -> 'dia_label',
             'dia_idx', r -> 'dia_idx', 'semana', r -> 'semana', 'ejercicios', r -> 'ejercicios', 'fecha', r -> 'fecha',
             'hora', r -> 'hora', 'ciclo', r -> 'ciclo'));
    if exists (select 1 from public.sesiones s
                where s.alumno_id = p_alumno_id and it_private.fecha_norm(s.fecha) = it_private.fecha_norm(v_s.fecha)
                  and s.dia_idx = v_s.dia_idx and s.semana = v_s.semana and coalesce(s.ciclo, 1) = coalesce(v_s.ciclo, 1)) then
      v_res := v_res || pg_catalog.jsonb_build_object('tipo', 'sesion', 'clave', r ->> 'clave', 'resultado', 'ya_existia');
      continue;
    end if;
    insert into public.sesiones (alumno_id, rutina_id, rutina_nombre, dia_label, dia_idx, semana, ejercicios, fecha, hora, ciclo,
                                 reingreso_de_epoch, reingreso_at)
    values (p_alumno_id, v_s.rutina_id, v_s.rutina_nombre, v_s.dia_label, v_s.dia_idx, v_s.semana, v_s.ejercicios, v_s.fecha,
            v_s.hora, coalesce(v_s.ciclo, 1), (r ->> 'epoch_original')::bigint, pg_catalog.now());
    v_res := v_res || pg_catalog.jsonb_build_object('tipo', 'sesion', 'clave', r ->> 'clave', 'resultado', 'insertada');
  end loop;

  perform it_private.via_desmarcar('reingreso');
  return pg_catalog.jsonb_build_object('ok', true, 'epoch', v_epoch, 'resultados', v_res);
end $$;

-- 7.4 Vínculo seguro de un alumno sin auth_uid (no modifica la cuenta Auth).
--     Paso 1: el ALUMNO, con sesión iniciada, solicita el vínculo de SU cuenta. Solo procede si el email CONFIRMADO de su cuenta Auth
--     coincide con alumnos.email, el alumno aún no tiene auth_uid y esa cuenta no está vinculada a otro alumno.
--     Respuestas genéricas ('no_corresponde') para no revelar qué alumnos existen.
create function public.it_vinculo_solicitar(p_alumno_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text; v_conf timestamptz; v_al_email text; v_al_uid uuid; v_existe boolean;
begin
  if auth.uid() is null then raise exception using errcode = '42501', message = 'it_sin_sesion'; end if;
  select pg_catalog.lower(u.email), u.email_confirmed_at into v_email, v_conf from auth.users u where u.id = auth.uid();
  select true, pg_catalog.lower(a.email), a.auth_uid into v_existe, v_al_email, v_al_uid from public.alumnos a where a.id = p_alumno_id;
  if coalesce(v_existe, false) and v_al_uid = auth.uid() then
    return pg_catalog.jsonb_build_object('ok', true, 'estado', 'vinculado');
  end if;
  if not coalesce(v_existe, false) or v_al_uid is not null or v_email is null or v_conf is null
     or v_al_email is distinct from v_email
     or exists (select 1 from public.alumnos o where o.auth_uid = auth.uid()) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'no_corresponde');
  end if;
  insert into it_private.vinculos (alumno_id, auth_uid, email, solicitado_at)
  values (p_alumno_id, auth.uid(), v_email, pg_catalog.now())
  on conflict (alumno_id) do update set auth_uid = excluded.auth_uid, email = excluded.email, solicitado_at = excluded.solicitado_at;
  return pg_catalog.jsonb_build_object('ok', true, 'estado', 'pendiente');
end $$;

--     Paso 2: el ENTRENADOR del alumno aprueba la solicitud que ve (auth_uid exacto). Se re-verifican todas las condiciones.
create function public.it_vinculo_aprobar(p_alumno_id uuid, p_auth_uid uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_email text; v_conf timestamptz; v_al_email text; v_al_uid uuid;
begin
  if auth.uid() is null or not it_private.es_entrenador_de(p_alumno_id) then
    raise exception using errcode = '42501', message = 'it_sin_permiso';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('it_hist'), pg_catalog.hashtext(p_alumno_id::text));
  if not exists (select 1 from it_private.vinculos v where v.alumno_id = p_alumno_id and v.auth_uid = p_auth_uid) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'sin_solicitud');
  end if;
  select pg_catalog.lower(a.email), a.auth_uid into v_al_email, v_al_uid from public.alumnos a where a.id = p_alumno_id for update;
  if v_al_uid is not null then return pg_catalog.jsonb_build_object('ok', false, 'reason', 'ya_vinculado'); end if;
  select pg_catalog.lower(u.email), u.email_confirmed_at into v_email, v_conf from auth.users u where u.id = p_auth_uid;
  if v_email is null or v_conf is null or v_al_email is distinct from v_email
     or exists (select 1 from public.alumnos o where o.auth_uid = p_auth_uid) then
    return pg_catalog.jsonb_build_object('ok', false, 'reason', 'no_corresponde');
  end if;
  perform it_private.via_marcar('vinculo');
  update public.alumnos set auth_uid = p_auth_uid where id = p_alumno_id;
  perform it_private.via_desmarcar('vinculo');
  delete from it_private.vinculos where alumno_id = p_alumno_id;
  return pg_catalog.jsonb_build_object('ok', true, 'estado', 'vinculado');
end $$;

-- ─── 8. Permisos (Supabase concede EXECUTE a PUBLIC/anon por defecto: se revoca explícitamente) ──────────────────────
revoke all on all tables    in schema it_private from public, anon, authenticated;
revoke all on all sequences in schema it_private from public, anon, authenticated;
revoke all on all functions in schema it_private from public, anon, authenticated;
revoke all on function public.it_historial_sello(uuid)                                from public, anon;
revoke all on function public.it_limpiar_historial_alumno(uuid, bigint, boolean)      from public, anon;
revoke all on function public.it_historial_reingresar(uuid, bigint, jsonb, jsonb)     from public, anon;
revoke all on function public.it_vinculo_solicitar(uuid)                              from public, anon;
revoke all on function public.it_vinculo_aprobar(uuid, uuid)                          from public, anon;
grant execute on function public.it_historial_sello(uuid)                             to authenticated;
grant execute on function public.it_limpiar_historial_alumno(uuid, bigint, boolean)   to authenticated;
grant execute on function public.it_historial_reingresar(uuid, bigint, jsonb, jsonb)  to authenticated;
grant execute on function public.it_vinculo_solicitar(uuid)                           to authenticated;
grant execute on function public.it_vinculo_aprobar(uuid, uuid)                       to authenticated;

-- ─── 9. Verificaciones posteriores (abortan TODO si algo quedó distinto de lo esperado) ──────────────────────────────
do $post$
declare v_bad text;
begin
  if has_function_privilege('anon', 'public.it_historial_sello(uuid)', 'execute')
     or has_function_privilege('anon', 'public.it_limpiar_historial_alumno(uuid,bigint,boolean)', 'execute')
     or has_function_privilege('anon', 'public.it_historial_reingresar(uuid,bigint,jsonb,jsonb)', 'execute')
     or has_function_privilege('anon', 'public.it_vinculo_solicitar(uuid)', 'execute')
     or has_function_privilege('anon', 'public.it_vinculo_aprobar(uuid,uuid)', 'execute')
     or has_schema_privilege('anon', 'it_private', 'usage')
     or has_schema_privilege('authenticated', 'it_private', 'usage') then
    raise exception 'D76-09: permisos inesperados para anon/authenticated';
  end if;
  if exists (select 1 from information_schema.role_table_grants
              where table_schema = 'it_private' and grantee in ('anon', 'authenticated', 'PUBLIC')) then
    raise exception 'D76-09: hay permisos de tabla en it_private';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_proc p
   where (p.pronamespace = 'it_private'::regnamespace
          or (p.pronamespace = 'public'::regnamespace
              and p.proname in ('it_historial_sello', 'it_limpiar_historial_alumno', 'it_historial_reingresar',
                                'it_vinculo_solicitar', 'it_vinculo_aprobar')))
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) c where c like 'search_path=%');
  if v_bad is not null then raise exception 'D76-09: funciones sin search_path fijo: %', v_bad; end if;
  if (select modo from it_private.config) <> 'off' then raise exception 'D76-09: el modo inicial debe ser off'; end if;
  if (select count(*) from it_private.entrenadores_autorizados) <> 1 then raise exception 'D76-09: debe haber exactamente 1 entrenador autorizado'; end if;
end $post$;

notify pgrst, 'reload schema';
commit;

-- ─── Operación (FUERA de esta migración; cada paso requiere su propia autorización) ──────────────────────────────────
-- update it_private.config set modo = 'observar';   -- registra en it_private.eventos lo que habría rechazado
-- update it_private.config set modo = 'activo';     -- rechaza (IT409) y exige el borrado por RPC
-- update it_private.config set modo = 'off';        -- rollback inmediato, sin DDL
