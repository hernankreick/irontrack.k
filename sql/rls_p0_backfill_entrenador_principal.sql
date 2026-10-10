-- =============================================================================
-- PASO MANUAL (rol postgres / SQL Editor) — NO es migración automática. NO ejecutar sin revisión.
-- Va DESPUÉS de 20261010110000_rls_p0_coach_principal.sql y ANTES de 20261010120000_rls_p0_lockdown.sql.
--
-- UID verificado por el propietario (SQL de solo lectura en producción):
--   entrenador@irontrack.app  ->  e2447231-c0ba-4f90-946f-63bf364570af   (auth.users.id = entrenadores.id)
--
--   psql "$DB_URL" \
--     -v principal_uid='e2447231-c0ba-4f90-946f-63bf364570af' \
--     -v expected_alumnos=9 \
--     -f sql/rls_p0_backfill_entrenador_principal.sql
--
-- Qué hace (una sola transacción):
--   1. registra al entrenador principal en public.coach_principal (singleton);
--   2. reemplaza el valor legacy 'entrenador_principal' por el UUID en alumnos, rutinas, video_overrides,
--      ejercicio_overrides y ejercicios_custom.
-- Aborta SIN modificar nada si: el UID no existe en auth.users/entrenadores, figura como alumnos.auth_uid,
-- coach_principal ya tiene OTRO uid, o la cantidad de alumnos legacy != expected_alumnos.
-- Antes: SELECT entrenador_id, count(*) FROM alumnos GROUP BY 1;  (guardar para reversión)
-- Reversión: UPDATE ... SET entrenador_id='entrenador_principal' WHERE entrenador_id='<uuid>' (solo las filas legacy
--   que se hayan respaldado); DELETE FROM coach_principal.
-- =============================================================================
\set ON_ERROR_STOP on
SELECT
  EXISTS (SELECT 1 FROM auth.users u WHERE u.id::text = :'principal_uid')
  AND EXISTS (SELECT 1 FROM public.entrenadores e WHERE e.id::text = :'principal_uid')
  AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.auth_uid::text = :'principal_uid')
  AND NOT EXISTS (SELECT 1 FROM public.coach_principal cp WHERE cp.uid::text <> :'principal_uid')
  AND (SELECT count(*) FROM public.alumnos WHERE entrenador_id::text = 'entrenador_principal') = :expected_alumnos
  AS checks_ok \gset
\if :checks_ok
\else
  \echo 'ERROR: precondiciones no cumplidas (uid inexistente/alumno, otro principal ya cargado o cantidad de alumnos legacy distinta). No se modifico nada.'
  \quit 1
\endif
BEGIN;
INSERT INTO public.coach_principal(uid) VALUES (:'principal_uid'::uuid) ON CONFLICT (singleton) DO NOTHING;
UPDATE public.alumnos             SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.rutinas             SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.video_overrides     SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.ejercicio_overrides SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.ejercicios_custom   SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
COMMIT;
