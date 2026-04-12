-- =============================================================================
-- Fase 2 (OPCIONAL): trigger mínimo solo sobre columnas canónicas.
--
-- No referencia nombre / youtube / "videoUrl" para poder crear el trigger
-- aunque esas columnas ya se hayan eliminado.
--
-- Sincronizar legacy → canónico durante la transición: mejor en la app
-- (POST/PATCH con name + video_url) o ejecutar de nuevo migraciones UPDATE
-- antes del deploy que borra columnas viejas.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.ejercicios_custom_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_custom := COALESCE(NEW.is_custom, true);

  -- Misma convención que GestionBiblioteca: name_en vacío → copiar name
  IF (NEW.name_en IS NULL OR BTRIM(NEW.name_en) = '')
     AND NEW.name IS NOT NULL AND BTRIM(NEW.name) <> '' THEN
    NEW.name_en := BTRIM(NEW.name);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ejercicios_custom_defaults ON public.ejercicios_custom;
CREATE TRIGGER trg_ejercicios_custom_defaults
  BEFORE INSERT OR UPDATE ON public.ejercicios_custom
  FOR EACH ROW
  EXECUTE FUNCTION public.ejercicios_custom_set_defaults();

COMMIT;
