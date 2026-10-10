-- =============================================================================
-- VARIANTE PARA EL SQL EDITOR DE SUPABASE (sin metacomandos de psql). Equivale a
-- sql/rls_p0_backfill_entrenador_principal.sql con valores fijos. NO EJECUTAR sin revisión.
-- Orden: después de 20261010110000_rls_p0_coach_principal.sql y antes de 20261010120000_rls_p0_lockdown.sql.
-- Un solo bloque = una sola transacción: si alguna precondición falla, no se modifica nada.
-- =============================================================================
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

  INSERT INTO public.coach_principal(uid) VALUES (principal_uid::uuid) ON CONFLICT (singleton) DO NOTHING;
  UPDATE public.alumnos             SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.rutinas             SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.video_overrides     SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.ejercicio_overrides SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.ejercicios_custom   SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
END $$;
