-- =============================================================================
-- ejercicio_overrides — nombre personalizado por entrenador para ejercicios
-- del catálogo estático (EX, en lib/exerciseStaticData.js).
--
-- El catálogo estático es código, no datos — no se puede editar por fila.
-- Esta tabla permite que cada entrenador le ponga su propio nombre a un
-- ejercicio del catálogo sin tocar el catálogo global ni afectar a otros
-- entrenadores. Mismo criterio que video_overrides, pero versionada acá
-- (video_overrides se creó a mano en el dashboard de Supabase).
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.ejercicio_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrenador_id text NOT NULL,
  ejercicio_id  text NOT NULL,
  name          text NOT NULL,
  name_en       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entrenador_id, ejercicio_id)
);

CREATE INDEX IF NOT EXISTS idx_ejercicio_overrides_entrenador
  ON public.ejercicio_overrides (entrenador_id);

-- updated_at automático en cada UPDATE (incluido el UPSERT del cliente)
CREATE OR REPLACE FUNCTION public.ejercicio_overrides_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ejercicio_overrides_updated_at ON public.ejercicio_overrides;
CREATE TRIGGER trg_ejercicio_overrides_updated_at
  BEFORE UPDATE ON public.ejercicio_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.ejercicio_overrides_set_updated_at();

COMMIT;

-- Comprobación (ejecutar a mano):
-- SELECT * FROM public.ejercicio_overrides ORDER BY updated_at DESC LIMIT 20;
