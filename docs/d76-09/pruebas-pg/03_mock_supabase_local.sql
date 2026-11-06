-- D76-09 · Base DESECHABLE para pruebas (PostgreSQL 17 local o proyecto de staging vacío). NUNCA en producción.
-- Imita lo mínimo de Supabase: roles anon/authenticated/service_role, auth.users, auth.uid(), auth.jwt() leyendo
-- request.jwt.claims (como PostgREST), y las tablas con las políticas ABIERTAS actuales (acceso_total) para probar que
-- D76-09 no depende de ellas. Datos 100% ficticios. Orden: 03_mock → 01_migracion (con el UID ficticio del entrenador) → 04.
do $$ begin
  if current_database() !~ '^it_d7609_test' then raise exception 'base no desechable: usar una base llamada it_d7609_test*'; end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon')          then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')  then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to current_user;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text unique, raw_app_meta_data jsonb not null default '{}',
  email_confirmed_at timestamptz default now());
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

create table public.alumnos (
  id uuid primary key default gen_random_uuid(), nombre text, email text,
  entrenador_id text, auth_uid uuid unique references auth.users(id), onesignal_id text);
create table public.progreso (
  id uuid primary key default gen_random_uuid(), alumno_id uuid references public.alumnos(id),
  ejercicio_id text, kg numeric, reps integer, nota text, fecha text, semana integer,
  ciclo integer not null default 1, created_at timestamptz default now());
create table public.sesiones (
  id uuid primary key default gen_random_uuid(), alumno_id uuid references public.alumnos(id),
  rutina_id uuid, rutina_nombre text, dia_label text, dia_idx integer, semana integer, ejercicios text,
  fecha text, hora text, ciclo integer not null default 1, created_at timestamptz default now());

create table public.entrenadores (id text primary key, email text, nombre text);

-- Igual que producción hoy: RLS activo + acceso_total abierto + permisos amplios.
alter table public.alumnos  enable row level security;
alter table public.progreso enable row level security;
alter table public.sesiones enable row level security;
alter table public.entrenadores enable row level security;
create policy acceso_total on public.entrenadores for all to public using (true) with check (true);
create policy acceso_total on public.alumnos  for all to public using (true) with check (true);
create policy acceso_total on public.progreso for all to public using (true) with check (true);
create policy acceso_total on public.sesiones for all to public using (true) with check (true);
grant all on public.alumnos, public.progreso, public.sesiones, public.entrenadores to anon, authenticated, service_role;

-- Datos ficticios (UID fijos, los usa 04_pruebas_pg.mjs).
insert into auth.users (id, email, raw_app_meta_data) values
  ('c0000000-0000-4000-8000-000000000001', 'coach@ficticio.test',  '{}'),
  ('a0000000-0000-4000-8000-000000000001', 'uno@ficticio.test',    '{}'),
  ('a0000000-0000-4000-8000-000000000002', 'dos@ficticio.test',    '{"alumno_id":"b0000000-0000-4000-8000-000000000002"}'),
  ('a0000000-0000-4000-8000-000000000003', 'tres@ficticio.test',   '{}'),
  ('e0000000-0000-4000-8000-000000000009', 'intruso@ficticio.test','{}');
-- Cuenta con el email del alumno Tres pero SIN confirmar (no debe poder vincularse).
insert into auth.users (id, email, raw_app_meta_data, email_confirmed_at) values
  ('a0000000-0000-4000-8000-0000000000f3', 'tres.sinconfirmar@ficticio.test', '{}', null);
insert into public.alumnos (id, nombre, email, entrenador_id, auth_uid) values
  ('b0000000-0000-4000-8000-000000000001', 'Alumno Uno',  'uno@ficticio.test',  'entrenador_principal', 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000002', 'Alumno Dos',  'dos@ficticio.test',  'entrenador_principal', null),  -- vínculo solo por app_metadata
  ('b0000000-0000-4000-8000-000000000003', 'Alumno Tres', 'tres@ficticio.test', 'entrenador_principal', null);  -- SIN vínculo (como el caso real)
insert into public.entrenadores (id, email, nombre) values ('c0000000-0000-4000-8000-000000000001', 'coach@ficticio.test', 'Entrenador ficticio');
