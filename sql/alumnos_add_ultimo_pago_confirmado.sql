alter table public.alumnos
add column if not exists ultimo_pago_confirmado timestamptz null;
