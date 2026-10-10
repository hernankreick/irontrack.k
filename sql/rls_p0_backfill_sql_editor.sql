-- =============================================================================
-- VARIANTE PARA EL SQL EDITOR DE SUPABASE (sin metacomandos de psql). Equivale a
-- sql/rls_p0_backfill_entrenador_principal.sql con valores fijos. NO EJECUTAR sin revisión.
-- Orden: después de 20261010110000_rls_p0_coach_principal.sql y antes de 20261010120000_rls_p0_lockdown.sql.
-- Un solo bloque = una sola transacción: si alguna precondición falla, no se modifica nada.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rls_p0_backfill_log (
  tbl text NOT NULL, row_key text NOT NULL, logged_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tbl, row_key)
);
ALTER TABLE public.rls_p0_backfill_log ENABLE ROW LEVEL SECURITY;  -- sin políticas ni grants: solo postgres/service_role
REVOKE ALL ON TABLE public.rls_p0_backfill_log FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  principal_uid  text := 'e2447231-c0ba-4f90-946f-63bf364570af';
  expected_legacy int := 9;
  n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text = principal_uid)
     OR NOT EXISTS (SELECT 1 FROM public.entrenadores WHERE id::text = principal_uid) THEN
    RAISE EXCEPTION 'principal_uid no existe en auth.users/entrenadores';
  END IF;
  IF EXISTS (SELECT 1 FROM public.alumnos WHERE auth_uid::text = principal_uid) THEN
    RAISE EXCEPTION 'el entrenador principal figura como alumnos.auth_uid';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coach_principal WHERE uid::text <> principal_uid) THEN
    RAISE EXCEPTION 'coach_principal ya contiene otro uid';
  END IF;
  SELECT count(*) INTO n FROM public.alumnos WHERE entrenador_id::text = 'entrenador_principal';
  IF n <> expected_legacy THEN
    RAISE EXCEPTION 'alumnos legacy = % (esperado %)', n, expected_legacy;
  END IF;

  -- Registro de las filas legacy (solo ids) para revertir con sql/rls_p0_backfill_revert.sql
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'alumnos', id::text FROM public.alumnos WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'rutinas', id::text FROM public.rutinas WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'video_overrides', ejercicio_id::text FROM public.video_overrides WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'ejercicio_overrides', ejercicio_id::text FROM public.ejercicio_overrides WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'ejercicios_custom', id::text FROM public.ejercicios_custom WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.coach_principal(uid) VALUES (principal_uid::uuid) ON CONFLICT (singleton) DO NOTHING;
  UPDATE public.alumnos             SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.rutinas             SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.video_overrides     SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.ejercicio_overrides SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.ejercicios_custom   SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
END $$;
