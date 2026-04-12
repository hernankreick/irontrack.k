-- =============================================================================
-- Fase 3: eliminar columnas legacy (ejecutar SOLO cuando:
--   - Todos los clientes usan name, name_en, video_url, is_custom
--   - Verificaste con SELECT que no perdés datos
--   - Eliminaste el trigger de la fase 2 si ya no lo necesitás
-- =============================================================================

BEGIN;

-- Quitar trigger opcional de la fase 2
DROP TRIGGER IF EXISTS trg_ejercicios_custom_defaults ON public.ejercicios_custom;
DROP FUNCTION IF EXISTS public.ejercicios_custom_set_defaults();

-- Descomenta las que existan en tu tabla (no fallarán si usas IF EXISTS en PG 15+)

-- ALTER TABLE public.ejercicios_custom DROP COLUMN IF EXISTS nombre;
-- ALTER TABLE public.ejercicios_custom DROP COLUMN IF EXISTS youtube;
-- ALTER TABLE public.ejercicios_custom DROP COLUMN IF EXISTS "videoUrl";
-- ALTER TABLE public.ejercicios_custom DROP COLUMN IF EXISTS "nameEn";

-- Restricciones recomendadas tras limpieza (ajustar según reglas de negocio):
-- ALTER TABLE public.ejercicios_custom ALTER COLUMN name SET NOT NULL;
-- ALTER TABLE public.ejercicios_custom ALTER COLUMN is_custom SET NOT NULL;

COMMIT;
