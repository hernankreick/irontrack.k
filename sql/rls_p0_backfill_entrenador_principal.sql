-- =============================================================================
-- PASO MANUAL previo a 20261010120000_rls_p0_lockdown.sql (NO es migración automática).
-- Reemplaza el valor legacy 'entrenador_principal' por el UUID real del entrenador.
--
--   psql "$DB_URL" -v principal_uid='<uuid de entrenadores.id>' -f sql/rls_p0_backfill_entrenador_principal.sql
--
-- El UUID lo decide el dueño del negocio (debe existir en entrenadores). Aborta si no existe.
-- Solo toca filas con entrenador_id = 'entrenador_principal'.
-- Antes: SELECT entrenador_id, count(*) FROM alumnos GROUP BY 1;  (guardar el resultado para reversión)
-- =============================================================================
\set ON_ERROR_STOP on
SELECT EXISTS (SELECT 1 FROM public.entrenadores WHERE id::text = :'principal_uid') AS uid_ok \gset
\if :uid_ok
\else
  \echo 'ERROR: principal_uid no existe en entrenadores. No se modificó nada.'
  \quit 1
\endif
BEGIN;
UPDATE public.alumnos             SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.rutinas             SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.video_overrides     SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.ejercicio_overrides SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
UPDATE public.ejercicios_custom   SET entrenador_id = :'principal_uid' WHERE entrenador_id::text = 'entrenador_principal';
COMMIT;
