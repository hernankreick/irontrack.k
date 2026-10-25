-- =============================================================================
-- IronTrack — RLS P0, unidad A: identidades de autorización (ADITIVA, no cambia el comportamiento de la app).
--
-- Modelo único, coherente con la Edge Function update-alumno-password de main:
--   ENTRENADOR = su UID de Auth figura en public.coach_accounts. Es el espejo en la base del secreto COACH_UIDS de la función:
--                solo la escribe el propietario (rol postgres / SQL Editor / service_role); anon y authenticated no pueden insertar,
--                modificar ni borrar. Una fila en `entrenadores`, `alumnos.entrenador_id` o `alumnos.auth_uid` NO otorga nada.
--   ALUMNO     = app_metadata.alumno_id del JWT (= alumnos.id). Solo el servidor escribe app_metadata (la función al crear la cuenta,
--                o scripts/admin/link-alumno.mjs). NO se usa user_metadata, ni el email, ni alumnos.auth_uid (el cliente puede escribirlos).
--   ALCANCE    = un entrenador gestiona los alumnos cuyo entrenador_id es su UID o el valor legacy 'entrenador_principal' (main lo sigue
--                usando en todo el cliente; NO se reescribe ni se hace backfill). Igual que la regla (2) de la función.
-- Todas las funciones son SECURITY INVOKER (sin SECURITY DEFINER): respetan RLS y no elevan privilegios. Idempotente.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.coach_accounts (
  uid        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.coach_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.coach_accounts TO authenticated;  -- solo su propia fila (política); sin escritura desde la API
GRANT ALL    ON TABLE public.coach_accounts TO service_role;
DROP POLICY IF EXISTS coach_accounts_select_self ON public.coach_accounts;
CREATE POLICY coach_accounts_select_self ON public.coach_accounts FOR SELECT TO authenticated
  USING (uid = auth.uid());

-- ¿El solicitante es un entrenador autorizado?
CREATE OR REPLACE FUNCTION public.it_is_coach() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.coach_accounts c WHERE c.uid = auth.uid())
$$;

-- ¿Este entrenador_id (de una fila) está en el alcance del entrenador solicitante?
CREATE OR REPLACE FUNCTION public.it_coach_scope(p_entrenador_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.it_is_coach() AND p_entrenador_id IN (auth.uid()::text, 'entrenador_principal')
$$;

-- ¿Es un entrenador autorizado Y el alumno está en su alcance?
CREATE OR REPLACE FUNCTION public.it_is_coach_of(p_alumno_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.it_is_coach() AND EXISTS (
    SELECT 1 FROM public.alumnos a
     WHERE a.id::text = p_alumno_id AND a.entrenador_id::text IN (auth.uid()::text, 'entrenador_principal'))
$$;

-- Alumno vinculado por el servidor (app_metadata del JWT: el usuario no puede escribirlo).
CREATE OR REPLACE FUNCTION public.it_alumno_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt() -> 'app_metadata' ->> 'alumno_id', '')
$$;

CREATE OR REPLACE FUNCTION public.it_is_alumno(p_alumno_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_alumno_id IS NOT NULL AND p_alumno_id = public.it_alumno_id()
$$;

-- ¿Este entrenador_id (overrides / ejercicios custom) es el entrenador de la ficha del alumno vinculado?
CREATE OR REPLACE FUNCTION public.it_is_my_coach(p_entrenador_id text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_entrenador_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.alumnos a
     WHERE a.id::text = public.it_alumno_id() AND a.entrenador_id::text = p_entrenador_id)
$$;

REVOKE ALL ON FUNCTION public.it_is_coach(), public.it_coach_scope(text), public.it_is_coach_of(text),
  public.it_alumno_id(), public.it_is_alumno(text), public.it_is_my_coach(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.it_is_coach(), public.it_coach_scope(text), public.it_is_coach_of(text),
  public.it_alumno_id(), public.it_is_alumno(text), public.it_is_my_coach(text) TO authenticated, service_role;

COMMIT;
