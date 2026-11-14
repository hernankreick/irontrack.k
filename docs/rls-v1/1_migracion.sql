-- RLS v1 — 1) MIGRACION (ESCRITURA; requiere aprobacion del dueño; NO ejecutada en Supabase). Probada solo en PostgreSQL local descartable.
-- Reemplaza la politica permisiva `acceso_total` por politicas por fila basadas en identidad CONFIABLE:
--   * alumno  : app_metadata.alumno_id del JWT (lo escribe solo el servidor: Edge Function update-alumno-password o scripts/admin/link-alumno.mjs).
--               NUNCA el email, user_metadata ni alumnos.auth_uid (el cliente puede escribirlos; ver supabase/functions/update-alumno-password/README.md).
--   * entrenador: uid presente en it_authz.entrenadores_autorizados (tabla que el cliente NO puede leer ni escribir; la carga el propietario con los
--               MISMOS UIDs del secreto COACH_UIDS). El rol "entrenador" no sale de nada que el cliente controle.
--   * anon    : sin acceso a ninguna tabla de datos.
-- ANTES de correr: (1) 0_preflight.sql sin desvios; (2) cargar it_authz.entrenadores_autorizados (ver PASO 0); (3) cuentas de alumnos VINCULADAS
-- (un alumno sin app_metadata.alumno_id pierde TODO acceso). Tras correr: 2_verificacion.sql. Rollback: 3_rollback.sql (restituye acceso_total: solo emergencia).
-- Orden respecto de las otras migraciones: ver docs/rls-v1/README.md (esta va PRIMERO; no depende de las columnas de identidad ni de las copias).

-- ───────── PASO 0 (manual, antes de BEGIN) ─────────
-- create schema if not exists it_authz;
-- create table if not exists it_authz.entrenadores_autorizados (uid uuid primary key, nota text, created_at timestamptz not null default now());
-- insert into it_authz.entrenadores_autorizados (uid, nota) values ('<UID del entrenador en Authentication → Users>', 'entrenador principal');
-- (la migracion crea la tabla si falta, pero NO inserta ningun uid: sin al menos un entrenador autorizado el entrenador queda sin acceso; V5 lo comprueba.)

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- ───────── 1. Contrato de esquema: si algo no coincide, ABORTA todo (nada queda a medias) ─────────
DO $$
DECLARE falta text;
BEGIN
  SELECT string_agg(x.t || '.' || x.c, ', ') INTO falta
    FROM (VALUES ('alumnos','id'),('alumnos','entrenador_id'),('entrenadores','id'),('rutinas','alumno_id'),('rutinas','entrenador_id'),('rutinas','datos'),
                 ('sesiones','alumno_id'),('progreso','alumno_id'),('mensajes','alumno_id'),('mensajes','de_entrenador'),('mensajes','leido'),('notas','alumno_id'),
                 ('fotos','alumno_id'),('config','id'),('video_overrides','entrenador_id'),('ejercicio_overrides','entrenador_id'),('ejercicios_custom','entrenador_id')) AS x(t, c)
   WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns i WHERE i.table_schema = 'public' AND i.table_name = x.t AND i.column_name = x.c);
  IF falta IS NOT NULL THEN RAISE EXCEPTION 'RLS v1: faltan columnas del contrato: %', falta; END IF;
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='mensajes' AND column_name='de_entrenador') <> 'boolean' THEN
    RAISE EXCEPTION 'RLS v1: mensajes.de_entrenador debe ser boolean';
  END IF;
  IF to_regprocedure('auth.uid()') IS NULL OR to_regprocedure('auth.jwt()') IS NULL THEN RAISE EXCEPTION 'RLS v1: faltan auth.uid()/auth.jwt()'; END IF;
END $$;

-- ───────── 2. Esquema privado (no expuesto por PostgREST) con el padron de entrenadores y las funciones de decision ─────────
CREATE SCHEMA IF NOT EXISTS it_authz;
REVOKE ALL ON SCHEMA it_authz FROM PUBLIC;
GRANT USAGE ON SCHEMA it_authz TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS it_authz.entrenadores_autorizados (uid uuid PRIMARY KEY, nota text, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE it_authz.entrenadores_autorizados ENABLE ROW LEVEL SECURITY;           -- sin politicas: ningun rol de la API lee ni escribe
REVOKE ALL ON TABLE it_authz.entrenadores_autorizados FROM PUBLIC, anon, authenticated;

-- Alumno vinculado de la sesion (app_metadata.alumno_id), o NULL.
CREATE OR REPLACE FUNCTION it_authz.alumno_id() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'alumno_id', '') $$;

-- ¿El usuario autenticado es entrenador autorizado? (SECURITY DEFINER: lee el padron que el cliente no puede leer)
CREATE OR REPLACE FUNCTION it_authz.es_entrenador() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT COALESCE((SELECT true FROM it_authz.entrenadores_autorizados e WHERE e.uid = auth.uid()), false) $$;

CREATE OR REPLACE FUNCTION it_authz.es_alumno(p_alumno_id text) RETURNS boolean LANGUAGE sql STABLE
AS $$ SELECT p_alumno_id IS NOT NULL AND p_alumno_id = it_authz.alumno_id() $$;

-- Entrenador autorizado Y dueño del registro (uid propio o el valor legado 'entrenador_principal', igual que la Edge Function).
CREATE OR REPLACE FUNCTION it_authz.es_dueno(p_entrenador_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT it_authz.es_entrenador() AND p_entrenador_id IS NOT NULL AND p_entrenador_id IN (auth.uid()::text, 'entrenador_principal') $$;

-- Entrenador autorizado que gestiona a ESE alumno (alumnos.entrenador_id = su uid o 'entrenador_principal'). Solo para filas que ya existen.
CREATE OR REPLACE FUNCTION it_authz.gestiona_alumno(p_alumno_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT it_authz.es_entrenador() AND p_alumno_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.alumnos a WHERE a.id::text = p_alumno_id AND a.entrenador_id::text IN (auth.uid()::text, 'entrenador_principal')) $$;

-- Entrenador (id de alumnos.entrenador_id) del alumno vinculado a la sesion, o NULL.
CREATE OR REPLACE FUNCTION it_authz.entrenador_de_mi_alumno() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT a.entrenador_id::text FROM public.alumnos a WHERE a.id::text = it_authz.alumno_id() $$;

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA it_authz FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA it_authz TO authenticated, service_role;

-- ───────── 3. Triggers de columnas (RLS no restringe columnas): el alumno solo puede tocar lo imprescindible ─────────
-- service_role / SQL editor (rol del JWT distinto de 'authenticated') y entrenadores autorizados no se restringen aqui (los gobiernan las politicas).
CREATE OR REPLACE FUNCTION it_authz.guard_columnas_alumno() RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'authenticated' OR it_authz.es_entrenador() THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - TG_ARGV) IS DISTINCT FROM (to_jsonb(OLD) - TG_ARGV) THEN
    RAISE EXCEPTION 'un alumno solo puede modificar: %', array_to_string(TG_ARGV, ', ') USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

-- Rutinas: el alumno solo puede AVANZAR rutinas.datos.semana_activa (nunca retroceder ni tocar otra clave ni otra columna).
CREATE OR REPLACE FUNCTION it_authz.guard_rutinas_alumno() RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE n jsonb := to_jsonb(NEW); o jsonb := to_jsonb(OLD);
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'authenticated' OR it_authz.es_entrenador() THEN RETURN NEW; END IF;
  IF (n - 'datos' - 'updated_at') IS DISTINCT FROM (o - 'datos' - 'updated_at')
     OR ((n -> 'datos') - 'semana_activa') IS DISTINCT FROM ((o -> 'datos') - 'semana_activa') THEN
    RAISE EXCEPTION 'un alumno solo puede avanzar datos.semana_activa de su rutina' USING ERRCODE = '42501';
  END IF;
  IF COALESCE((n -> 'datos' ->> 'semana_activa')::numeric, 0) < COALESCE((o -> 'datos' ->> 'semana_activa')::numeric, 0) THEN
    RAISE EXCEPTION 'semana_activa no puede retroceder' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS it_guard_alumnos ON public.alumnos;
CREATE TRIGGER it_guard_alumnos BEFORE UPDATE ON public.alumnos FOR EACH ROW EXECUTE FUNCTION it_authz.guard_columnas_alumno('onesignal_id', 'updated_at');
DROP TRIGGER IF EXISTS it_guard_mensajes ON public.mensajes;
CREATE TRIGGER it_guard_mensajes BEFORE UPDATE ON public.mensajes FOR EACH ROW EXECUTE FUNCTION it_authz.guard_columnas_alumno('leido');
DROP TRIGGER IF EXISTS it_guard_rutinas ON public.rutinas;
CREATE TRIGGER it_guard_rutinas BEFORE UPDATE ON public.rutinas FOR EACH ROW EXECUTE FUNCTION it_authz.guard_rutinas_alumno();

-- ───────── 4. Politicas: se retiran TODAS las existentes de estas tablas (cualquier politica permisiva anularia el resto) y se crean las nuevas ─────────
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename IN ('alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom')
  LOOP EXECUTE format('DROP POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename); END LOOP;
END $$;

-- Privilegios de tabla: anon nada; authenticated solo CRUD (sin TRUNCATE/REFERENCES/TRIGGER). La autorizacion real la dan las politicas.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','entrenadores','rutinas','sesiones','progreso','mensajes','notas','fotos','config','video_overrides','ejercicio_overrides','ejercicios_custom'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
  END LOOP;
END $$;

-- alumnos: el alumno ve y (limitadamente, ver trigger) actualiza SU fila; el entrenador gestiona los suyos (id propio o 'entrenador_principal').
CREATE POLICY it_rls_alumnos_select ON public.alumnos FOR SELECT TO authenticated USING (it_authz.es_alumno(id::text) OR it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_alumnos_insert ON public.alumnos FOR INSERT TO authenticated WITH CHECK (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_alumnos_update ON public.alumnos FOR UPDATE TO authenticated USING (it_authz.es_alumno(id::text) OR it_authz.es_dueno(entrenador_id::text)) WITH CHECK (it_authz.es_alumno(id::text) OR it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_alumnos_delete ON public.alumnos FOR DELETE TO authenticated USING (it_authz.es_dueno(entrenador_id::text));

-- entrenadores: cada entrenador autorizado su fila (o la legada); el alumno SOLO la de su entrenador (lectura).
CREATE POLICY it_rls_entrenadores_select ON public.entrenadores FOR SELECT TO authenticated USING (it_authz.es_dueno(id::text) OR (it_authz.alumno_id() IS NOT NULL AND id::text = it_authz.entrenador_de_mi_alumno()));
CREATE POLICY it_rls_entrenadores_insert ON public.entrenadores FOR INSERT TO authenticated WITH CHECK (it_authz.es_dueno(id::text));
CREATE POLICY it_rls_entrenadores_update ON public.entrenadores FOR UPDATE TO authenticated USING (it_authz.es_dueno(id::text)) WITH CHECK (it_authz.es_dueno(id::text));

-- rutinas: el alumno lee las suyas y solo avanza semana_activa (trigger); el entrenador gestiona las suyas, plantillas incluidas.
CREATE POLICY it_rls_rutinas_select ON public.rutinas FOR SELECT TO authenticated USING (
  it_authz.es_alumno(alumno_id::text) OR it_authz.es_dueno(entrenador_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_rutinas_insert ON public.rutinas FOR INSERT TO authenticated WITH CHECK (
  it_authz.es_dueno(entrenador_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_rutinas_update ON public.rutinas FOR UPDATE TO authenticated
  USING (it_authz.es_alumno(alumno_id::text) OR it_authz.es_dueno(entrenador_id::text) OR it_authz.gestiona_alumno(alumno_id::text))
  WITH CHECK (it_authz.es_alumno(alumno_id::text) OR it_authz.es_dueno(entrenador_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_rutinas_delete ON public.rutinas FOR DELETE TO authenticated USING (it_authz.es_dueno(entrenador_id::text) OR it_authz.gestiona_alumno(alumno_id::text));

-- progreso y sesiones: el alumno lee y agrega los suyos; el entrenador lee, agrega (validacion manual) y borra los de sus alumnos. Nadie actualiza.
CREATE POLICY it_rls_progreso_select ON public.progreso FOR SELECT TO authenticated USING (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_progreso_insert ON public.progreso FOR INSERT TO authenticated WITH CHECK (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_progreso_delete ON public.progreso FOR DELETE TO authenticated USING (it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_sesiones_select ON public.sesiones FOR SELECT TO authenticated USING (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_sesiones_insert ON public.sesiones FOR INSERT TO authenticated WITH CHECK (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_sesiones_delete ON public.sesiones FOR DELETE TO authenticated USING (it_authz.gestiona_alumno(alumno_id::text));

-- mensajes: cada parte solo escribe en su nombre (de_entrenador); la lectura marca "leido" lo que recibio (trigger: solo esa columna).
CREATE POLICY it_rls_mensajes_select ON public.mensajes FOR SELECT TO authenticated USING (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_mensajes_insert ON public.mensajes FOR INSERT TO authenticated WITH CHECK (
  (it_authz.es_alumno(alumno_id::text) AND de_entrenador IS NOT TRUE) OR (it_authz.gestiona_alumno(alumno_id::text) AND de_entrenador IS TRUE));
CREATE POLICY it_rls_mensajes_update ON public.mensajes FOR UPDATE TO authenticated
  USING ((it_authz.es_alumno(alumno_id::text) AND de_entrenador IS TRUE) OR (it_authz.gestiona_alumno(alumno_id::text) AND de_entrenador IS NOT TRUE))
  WITH CHECK ((it_authz.es_alumno(alumno_id::text) AND de_entrenador IS TRUE) OR (it_authz.gestiona_alumno(alumno_id::text) AND de_entrenador IS NOT TRUE));
CREATE POLICY it_rls_mensajes_delete ON public.mensajes FOR DELETE TO authenticated USING (it_authz.gestiona_alumno(alumno_id::text));

-- notas: las escribe el entrenador; el alumno las lee.
CREATE POLICY it_rls_notas_select ON public.notas FOR SELECT TO authenticated USING (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_notas_insert ON public.notas FOR INSERT TO authenticated WITH CHECK (it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_notas_update ON public.notas FOR UPDATE TO authenticated USING (it_authz.gestiona_alumno(alumno_id::text)) WITH CHECK (it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_notas_delete ON public.notas FOR DELETE TO authenticated USING (it_authz.gestiona_alumno(alumno_id::text));

-- fotos: alumno y entrenador (de ese alumno) leen, agregan y borran; nadie actualiza.
CREATE POLICY it_rls_fotos_select ON public.fotos FOR SELECT TO authenticated USING (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_fotos_insert ON public.fotos FOR INSERT TO authenticated WITH CHECK (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));
CREATE POLICY it_rls_fotos_delete ON public.fotos FOR DELETE TO authenticated USING (it_authz.es_alumno(alumno_id::text) OR it_authz.gestiona_alumno(alumno_id::text));

-- config (datos de pago compartidos): lectura para alumnos vinculados y entrenadores autorizados; escritura solo entrenadores.
CREATE POLICY it_rls_config_select ON public.config FOR SELECT TO authenticated USING (it_authz.es_entrenador() OR it_authz.alumno_id() IS NOT NULL);
CREATE POLICY it_rls_config_insert ON public.config FOR INSERT TO authenticated WITH CHECK (it_authz.es_entrenador());
CREATE POLICY it_rls_config_update ON public.config FOR UPDATE TO authenticated USING (it_authz.es_entrenador()) WITH CHECK (it_authz.es_entrenador());

-- Biblioteca del entrenador (videos, nombres, ejercicios propios): escribe su dueño; lee su dueño y los alumnos de ese entrenador ('entrenador_principal' compartido).
CREATE POLICY it_rls_video_overrides_select ON public.video_overrides FOR SELECT TO authenticated USING (
  it_authz.es_dueno(entrenador_id::text) OR (it_authz.alumno_id() IS NOT NULL AND entrenador_id::text IN (it_authz.entrenador_de_mi_alumno(), 'entrenador_principal')));
CREATE POLICY it_rls_video_overrides_insert ON public.video_overrides FOR INSERT TO authenticated WITH CHECK (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_video_overrides_update ON public.video_overrides FOR UPDATE TO authenticated USING (it_authz.es_dueno(entrenador_id::text)) WITH CHECK (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_video_overrides_delete ON public.video_overrides FOR DELETE TO authenticated USING (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_ejercicio_overrides_select ON public.ejercicio_overrides FOR SELECT TO authenticated USING (
  it_authz.es_dueno(entrenador_id::text) OR (it_authz.alumno_id() IS NOT NULL AND entrenador_id::text IN (it_authz.entrenador_de_mi_alumno(), 'entrenador_principal')));
CREATE POLICY it_rls_ejercicio_overrides_insert ON public.ejercicio_overrides FOR INSERT TO authenticated WITH CHECK (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_ejercicio_overrides_update ON public.ejercicio_overrides FOR UPDATE TO authenticated USING (it_authz.es_dueno(entrenador_id::text)) WITH CHECK (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_ejercicio_overrides_delete ON public.ejercicio_overrides FOR DELETE TO authenticated USING (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_ejercicios_custom_select ON public.ejercicios_custom FOR SELECT TO authenticated USING (
  it_authz.es_dueno(entrenador_id::text) OR (it_authz.alumno_id() IS NOT NULL AND entrenador_id::text IN (it_authz.entrenador_de_mi_alumno(), 'entrenador_principal')));
CREATE POLICY it_rls_ejercicios_custom_insert ON public.ejercicios_custom FOR INSERT TO authenticated WITH CHECK (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_ejercicios_custom_update ON public.ejercicios_custom FOR UPDATE TO authenticated USING (it_authz.es_dueno(entrenador_id::text)) WITH CHECK (it_authz.es_dueno(entrenador_id::text));
CREATE POLICY it_rls_ejercicios_custom_delete ON public.ejercicios_custom FOR DELETE TO authenticated USING (it_authz.es_dueno(entrenador_id::text));

-- Funciones/RPC de public: NO se tocan sus permisos aqui (revocar EXECUTE a PUBLIC puede romper defaults de extensiones). Se revisan con P5 (preflight) y V6 (verificacion):
-- cualquier SECURITY DEFINER ejecutable por anon/authenticated que escriba en estas tablas elude las politicas y debe corregirse antes del GO.
COMMIT;
NOTIFY pgrst, 'reload schema';
