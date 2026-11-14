// Esquema de la APLICACION reconstruido desde el codigo del cliente (el DDL real de Supabase no esta versionado) para probar RLS en PostgreSQL local.
// Estado replicado de produccion: RLS habilitada y politica permisiva `acceso_total` en todas las tablas de datos. NO es un export de Supabase:
// los tipos de id se parametrizan (text | uuid) porque la migracion RLS debe funcionar con ambos.
// Roles/funciones auth.* : ver ESQUEMA_BASE (scripts/lib/pgLocal.mjs). Aqui solo las tablas.
export function esquemaApp(idType) {
  const T = idType === "uuid" ? "uuid" : "text";
  return `
create table auth.users (id uuid primary key, email text, raw_app_meta_data jsonb not null default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz);
create table public.alumnos (id ${T} primary key default ${T === "uuid" ? "gen_random_uuid()" : "gen_random_uuid()::text"}, nombre text, email text, entrenador_id text, onesignal_id text,
  ultimo_pago_confirmado timestamptz, auth_uid text, created_at timestamptz default now());
create table public.entrenadores (id text primary key, email text, nombre text, nombre_gimnasio text, telefono_comercial text, capacidad_max integer, created_at timestamptz default now());
create table public.rutinas (id ${T} primary key default ${T === "uuid" ? "gen_random_uuid()" : "gen_random_uuid()::text"}, alumno_id ${T}, entrenador_id text, nombre text, es_plantilla boolean default false, datos jsonb not null default '{}'::jsonb, created_at timestamptz default now());
create table public.mensajes (id uuid primary key default gen_random_uuid(), alumno_id ${T} not null, de_entrenador boolean, leido boolean default false, texto text, created_at timestamptz default now());
create table public.notas (id uuid primary key default gen_random_uuid(), alumno_id ${T} not null, texto text, created_at timestamptz default now());
create table public.fotos (id uuid primary key default gen_random_uuid(), alumno_id ${T} not null, url text, created_at timestamptz default now());
create table public.config (id text primary key, alias text, titular text, banco text);
create table public.video_overrides (id uuid primary key default gen_random_uuid(), entrenador_id text not null, ejercicio_id text not null, youtube_url text);
create table public.ejercicio_overrides (id uuid primary key default gen_random_uuid(), entrenador_id text not null, ejercicio_id text not null, name text not null, name_en text, unique (entrenador_id, ejercicio_id));
create table public.ejercicios_custom (id uuid primary key default gen_random_uuid(), entrenador_id text not null, nombre text);
create table public.coach_calendar_assignments (id uuid primary key default gen_random_uuid(), entrenador_id uuid not null, alumno_id text not null, rutina_id text not null, fecha date not null);
create table public.coach_notification_reads (id uuid primary key default gen_random_uuid(), entrenador_id uuid not null, clave text not null);
alter table public.progreso alter column alumno_id type ${T} using alumno_id::${T};
alter table public.sesiones alter column alumno_id type ${T} using alumno_id::${T};
do $$ declare t text; begin
  foreach t in array array['alumnos','entrenadores','rutinas','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy acceso_total on public.%I for all using (true) with check (true)', t);
    execute format('grant all on public.%I to anon, authenticated, service_role', t);
  end loop;
end $$;
alter table public.coach_calendar_assignments enable row level security; alter table public.coach_notification_reads enable row level security;
create policy "coach calendar select own" on public.coach_calendar_assignments for select using (auth.uid() = entrenador_id);
create policy "coach calendar insert own" on public.coach_calendar_assignments for insert with check (auth.uid() = entrenador_id);
create policy "coach calendar delete own" on public.coach_calendar_assignments for delete using (auth.uid() = entrenador_id);
create policy "coach notification reads select own" on public.coach_notification_reads for select using (auth.uid() = entrenador_id);
create policy "coach notification reads insert own" on public.coach_notification_reads for insert with check (auth.uid() = entrenador_id);
create policy "coach notification reads update own" on public.coach_notification_reads for update using (auth.uid() = entrenador_id) with check (auth.uid() = entrenador_id);
grant all on public.coach_calendar_assignments, public.coach_notification_reads to anon, authenticated, service_role;
`;
}
