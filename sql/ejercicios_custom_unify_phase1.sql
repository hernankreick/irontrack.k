-- =============================================================================
-- ejercicios_custom — Fase 1: columnas canónicas + migración de datos
-- Ejecutar en Supabase SQL Editor (o: supabase db push / psql)
--
-- Modelo objetivo (campos de unificación solicitados):
--   name, name_en, video_url, is_custom
-- Se conservan el resto de columnas de negocio ya usadas por la app:
--   id, entrenador_id, pattern, muscle, equip, ...
-- =============================================================================

BEGIN;

-- 1) Columnas canónicas (idempotente)
ALTER TABLE public.ejercicios_custom
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS is_custom boolean;

-- Valor por defecto: en esta tabla todo es ejercicio custom
UPDATE public.ejercicios_custom
SET is_custom = true
WHERE is_custom IS NULL;

ALTER TABLE public.ejercicios_custom
  ALTER COLUMN is_custom SET DEFAULT true;

-- Opcional: NOT NULL tras rellenar (descomentar tras verificar que no hay NULLs)
-- ALTER TABLE public.ejercicios_custom ALTER COLUMN is_custom SET NOT NULL;

-- 2) Migración condicional desde columnas legacy (no rompe si no existen)
DO $$
BEGIN
  -- name <- nombre
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ejercicios_custom' AND column_name = 'nombre'
  ) THEN
    UPDATE public.ejercicios_custom AS t
    SET name = COALESCE(NULLIF(BTRIM(t.name), ''), BTRIM(t.nombre))
    WHERE (t.name IS NULL OR BTRIM(t.name) = '')
      AND t.nombre IS NOT NULL AND BTRIM(t.nombre) <> '';
  END IF;

  -- name <- name (si sigue vacío y hubiera otro alias — ajustar si tenías otra columna)
  -- (omitido; añadir aquí si tenías p.ej. titulo)

  -- name_en <- "nameEn" (camelCase) si existiera
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ejercicios_custom' AND column_name = 'nameEn'
  ) THEN
    UPDATE public.ejercicios_custom AS t
    SET name_en = COALESCE(NULLIF(BTRIM(t.name_en), ''), BTRIM(t."nameEn"))
    WHERE (t.name_en IS NULL OR BTRIM(t.name_en) = '')
      AND t."nameEn" IS NOT NULL AND BTRIM(t."nameEn") <> '';
  END IF;

  -- Si name_en sigue vacío, copiar name (misma convención que en la app)
  UPDATE public.ejercicios_custom AS t
  SET name_en = BTRIM(t.name)
  WHERE (t.name_en IS NULL OR BTRIM(t.name_en) = '')
    AND t.name IS NOT NULL AND BTRIM(t.name) <> '';

  -- video_url <- youtube
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ejercicios_custom' AND column_name = 'youtube'
  ) THEN
    UPDATE public.ejercicios_custom AS t
    SET video_url = COALESCE(NULLIF(BTRIM(t.video_url), ''), BTRIM(t.youtube))
    WHERE (t.video_url IS NULL OR BTRIM(t.video_url) = '')
      AND t.youtube IS NOT NULL AND BTRIM(t.youtube) <> '';
  END IF;

  -- video_url <- "videoUrl" (camelCase)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ejercicios_custom' AND column_name = 'videoUrl'
  ) THEN
    UPDATE public.ejercicios_custom AS t
    SET video_url = COALESCE(NULLIF(BTRIM(t.video_url), ''), BTRIM(t."videoUrl"))
    WHERE (t.video_url IS NULL OR BTRIM(t.video_url) = '')
      AND t."videoUrl" IS NOT NULL AND BTRIM(t."videoUrl") <> '';
  END IF;
END $$;

COMMIT;

-- 3) Comprobaciones (ejecutar a mano)
-- SELECT id, name, name_en, video_url, is_custom FROM public.ejercicios_custom LIMIT 20;
-- SELECT COUNT(*) FILTER (WHERE name IS NULL OR BTRIM(name) = '') AS sin_nombre FROM public.ejercicios_custom;
