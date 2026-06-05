create table if not exists public.coach_notification_reads (
  id uuid primary key default gen_random_uuid(),
  entrenador_id uuid not null references auth.users(id) on delete cascade,
  notification_id text not null,
  read_at timestamptz default now(),
  unique (entrenador_id, notification_id)
);

create index if not exists idx_coach_notification_reads_entrenador
on public.coach_notification_reads(entrenador_id);

alter table public.coach_notification_reads enable row level security;

drop policy if exists "coach notification reads select own" on public.coach_notification_reads;
create policy "coach notification reads select own"
on public.coach_notification_reads
for select
using (auth.uid() = entrenador_id);

drop policy if exists "coach notification reads insert own" on public.coach_notification_reads;
create policy "coach notification reads insert own"
on public.coach_notification_reads
for insert
with check (auth.uid() = entrenador_id);

drop policy if exists "coach notification reads update own" on public.coach_notification_reads;
create policy "coach notification reads update own"
on public.coach_notification_reads
for update
using (auth.uid() = entrenador_id)
with check (auth.uid() = entrenador_id);
