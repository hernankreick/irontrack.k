create table if not exists public.coach_calendar_assignments (
  id uuid primary key default gen_random_uuid(),
  entrenador_id uuid not null references auth.users(id) on delete cascade,
  alumno_id text not null,
  alumno_nombre text,
  rutina_id text not null,
  rutina_nombre text,
  fecha date not null,
  created_at timestamptz default now()
);

create index if not exists idx_coach_calendar_assignments_entrenador
on public.coach_calendar_assignments(entrenador_id);

create index if not exists idx_coach_calendar_assignments_alumno
on public.coach_calendar_assignments(alumno_id);

create index if not exists idx_coach_calendar_assignments_fecha
on public.coach_calendar_assignments(fecha);

alter table public.coach_calendar_assignments enable row level security;

drop policy if exists "coach calendar select own" on public.coach_calendar_assignments;
create policy "coach calendar select own"
on public.coach_calendar_assignments
for select
using (auth.uid() = entrenador_id);

drop policy if exists "coach calendar insert own" on public.coach_calendar_assignments;
create policy "coach calendar insert own"
on public.coach_calendar_assignments
for insert
with check (auth.uid() = entrenador_id);

drop policy if exists "coach calendar delete own" on public.coach_calendar_assignments;
create policy "coach calendar delete own"
on public.coach_calendar_assignments
for delete
using (auth.uid() = entrenador_id);
