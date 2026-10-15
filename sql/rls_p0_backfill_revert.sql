-- =============================================================================
-- REVERSIÓN DEL BACKFILL (SQL Editor / postgres). NO ejecutar sin revisión.
-- Requisito: la migración 20261010120000_rls_p0_lockdown.sql NO debe estar aplicada (revertirla antes con
-- supabase/rollback/20261010120000_rls_p0_rollback.sql). Aborta si lo está.
-- Devuelve a 'entrenador_principal' SOLO las filas registradas en rls_p0_backfill_log (las que eran legacy),
-- no las que ya tenían el UUID antes del backfill. Quita la fila de coach_principal y vacía el registro.
-- =============================================================================
DO $$
DECLARE
  principal_uid text;
BEGIN
  IF to_regprocedure('public.it_guard_alumnos_update()') IS NOT NULL THEN
    RAISE EXCEPTION 'la migracion RLS esta aplicada: revertirla primero (supabase/rollback/...)';
  END IF;
  SELECT uid::text INTO principal_uid FROM public.coach_principal;
  IF principal_uid IS NULL THEN RAISE EXCEPTION 'coach_principal vacio: no hay backfill que revertir'; END IF;

  UPDATE public.alumnos a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'alumnos' AND l.row_key = a.id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.rutinas a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'rutinas' AND l.row_key = a.id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.video_overrides a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'video_overrides' AND l.row_key = a.ejercicio_id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.ejercicio_overrides a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'ejercicio_overrides' AND l.row_key = a.ejercicio_id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.ejercicios_custom a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'ejercicios_custom' AND l.row_key = a.id::text AND a.entrenador_id::text = principal_uid;

  DELETE FROM public.coach_principal;
  DELETE FROM public.rls_p0_backfill_log;
END $$;
