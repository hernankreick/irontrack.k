-- =============================================================================
-- VERIFICACIÓN B2 (post-backfill) — SOLO LECTURA (SQL Editor de Supabase). No requiere editar nada. Devuelve una fila con conteos.
-- Esperado tras el backfill: alumnos_legacy=0, alumnos_con_uid=9, rutinas_legacy=0, video_legacy=0, ejoverr_legacy=0, custom_legacy=0,
-- principal=1, filas_en_registro>=9.
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.alumnos             WHERE entrenador_id::text = 'entrenador_principal') AS alumnos_legacy,
  (SELECT count(*) FROM public.alumnos             WHERE entrenador_id::text = 'e2447231-c0ba-4f90-946f-63bf364570af') AS alumnos_con_uid,
  (SELECT count(*) FROM public.rutinas             WHERE entrenador_id::text = 'entrenador_principal') AS rutinas_legacy,
  (SELECT count(*) FROM public.video_overrides     WHERE entrenador_id::text = 'entrenador_principal') AS video_legacy,
  (SELECT count(*) FROM public.ejercicio_overrides WHERE entrenador_id::text = 'entrenador_principal') AS ejoverr_legacy,
  (SELECT count(*) FROM public.ejercicios_custom   WHERE entrenador_id::text = 'entrenador_principal') AS custom_legacy,
  (SELECT count(*) FROM public.coach_principal) AS principal,
  (SELECT count(*) FROM public.rls_p0_backfill_log) AS filas_en_registro;
