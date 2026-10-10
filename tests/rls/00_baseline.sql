-- Esquema BASE RECONSTRUIDO (no es un dump de producción): emula Supabase (roles, auth.uid())
-- y el estado inseguro confirmado (acceso_total, grants amplios). Tipos mixtos a propósito (uuid/text).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$ SELECT nullif(coalesce(current_setting('request.jwt.claim.sub', true), ''), '')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;

CREATE TABLE public.entrenadores (id uuid PRIMARY KEY REFERENCES auth.users(id), email text, nombre text, telefono text);
CREATE TABLE public.alumnos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nombre text, email text, entrenador_id text,
  auth_uid uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL, onesignal_id text, ultimo_pago_confirmado timestamptz);
CREATE TABLE public.rutinas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), alumno_id text, entrenador_id text, nombre text, datos jsonb);
CREATE TABLE public.progreso (id bigserial PRIMARY KEY, alumno_id text, ejercicio_id text, sets int, reps int, kg numeric, fecha date, semana int, created_at timestamptz DEFAULT now());
CREATE TABLE public.sesiones (id bigserial PRIMARY KEY, alumno_id text, rutina_id text, semana int, dia_idx int, fecha date, created_at timestamptz DEFAULT now());
CREATE TABLE public.fotos (id bigserial PRIMARY KEY, alumno_id text, url text, created_at timestamptz DEFAULT now());
CREATE TABLE public.mensajes (id bigserial PRIMARY KEY, alumno_id text, texto text, de_entrenador boolean, leido boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.notas (id bigserial PRIMARY KEY, alumno_id text, contenido text, created_at timestamptz DEFAULT now());
CREATE TABLE public.config (id text PRIMARY KEY, alias text);
CREATE TABLE public.video_overrides (id bigserial PRIMARY KEY, entrenador_id text, ejercicio_id text, youtube_url text);
CREATE TABLE public.ejercicio_overrides (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entrenador_id text NOT NULL, ejercicio_id text NOT NULL, name text NOT NULL, name_en text, UNIQUE (entrenador_id, ejercicio_id));
CREATE TABLE public.ejercicios_custom (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entrenador_id text, name text);
CREATE TABLE public.coach_calendar_assignments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entrenador_id uuid NOT NULL REFERENCES auth.users(id), alumno_id text NOT NULL, rutina_id text NOT NULL, fecha date NOT NULL);
CREATE TABLE public.coach_notification_reads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entrenador_id uuid NOT NULL REFERENCES auth.users(id), notification_id text NOT NULL, UNIQUE (entrenador_id, notification_id));

-- Estado inseguro confirmado
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','video_overrides'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('CREATE POLICY acceso_total ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', t);
 END LOOP;
 ALTER TABLE public.entrenadores ENABLE ROW LEVEL SECURITY;
 CREATE POLICY ent_self ON public.entrenadores FOR ALL TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
 -- política por email (ruta alternativa a eliminar)
 ALTER TABLE public.ejercicios_custom ENABLE ROW LEVEL SECURITY;
 CREATE POLICY por_email ON public.ejercicios_custom FOR ALL TO public USING (true);
 ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
 CREATE POLICY por_email ON public.notas FOR SELECT TO public USING (alumno_id IN (SELECT id::text FROM alumnos WHERE email = current_setting('request.jwt.claim.email', true)));
END $$;
-- ejercicio_overrides: RLS desactivado (como en prod). coach_*: RLS+política propia de sql/*.sql
ALTER TABLE public.coach_calendar_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach calendar select own" ON public.coach_calendar_assignments FOR SELECT USING (auth.uid() = entrenador_id);
ALTER TABLE public.coach_notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach reads select own" ON public.coach_notification_reads FOR SELECT USING (auth.uid() = entrenador_id);
