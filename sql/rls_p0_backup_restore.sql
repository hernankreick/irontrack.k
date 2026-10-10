-- =============================================================================
-- RESTAURACIÓN POR ETAPA desde la copia interna backup_rls_p0 (SQL Editor). NO EJECUTAR sin revisión.
-- Cada bloque es independiente; ejecutar SOLO el que corresponde, uno por vez, y correr sql/rls_p0_backup_verify.sql después.
-- Ningún bloque borra datos ni pisa filas nuevas: R1/R4 solo tocan filas que existen en la copia, R4 solo inserta las que FALTAN.
-- Esto restaura DATOS y POLÍTICAS a lo copiado. NO restaura Auth (contraseñas), Storage ni el proyecto completo (ver docs/respaldo-rls-p0.md).
-- =============================================================================

-- ───────── R1 · Deshacer el backfill: devolver entrenador_id a su valor original ─────────
-- Cuándo: falló el despliegue DESPUÉS del backfill y ANTES de la migración 2 (o ya revertiste la migración 2 con el rollback).
-- Alternativa equivalente y más precisa: sql/rls_p0_backfill_revert.sql (usa rls_p0_backfill_log).
-- Solo actualiza la columna entrenador_id de filas presentes en la copia y distintas; no toca otras columnas ni filas nuevas.
DO $$
DECLARE t text; k text;
BEGIN
  IF to_regprocedure('public.it_guard_alumnos_update()') IS NOT NULL THEN
    RAISE EXCEPTION 'La migración RLS sigue aplicada: ejecutar primero supabase/rollback/20261010120000_rls_p0_rollback.sql';
  END IF;
  IF to_regnamespace('backup_rls_p0') IS NULL THEN RAISE EXCEPTION 'No existe backup_rls_p0'; END IF;
  FOREACH t IN ARRAY ARRAY['alumnos','rutinas','video_overrides','ejercicio_overrides','ejercicios_custom'] LOOP
    IF to_regclass('public.' || t) IS NULL OR to_regclass('backup_rls_p0.' || t) IS NULL THEN CONTINUE; END IF;
    -- clave = índice único/PK de UNA columna de la tabla viva (no se asume ningún nombre de clave)
    SELECT a.attname INTO k FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
     WHERE i.indrelid = ('public.' || t)::regclass AND i.indisunique AND i.indisvalid AND i.indnkeyatts = 1 AND i.indpred IS NULL
     ORDER BY i.indisprimary DESC LIMIT 1;
    IF k IS NULL THEN RAISE EXCEPTION 'R1: % no tiene clave única de una columna; usar sql/rls_p0_backfill_revert.sql', t; END IF;
    EXECUTE format('UPDATE public.%1$I a SET entrenador_id = b.entrenador_id FROM backup_rls_p0.%1$I b WHERE a.%2$I::text = b.%2$I::text AND a.entrenador_id IS DISTINCT FROM b.entrenador_id', t, k);
  END LOOP;
END $$;

-- ───────── R2 · Restaurar políticas, RLS y grants EXACTOS (después de revertir la migración 2) ─────────
-- Cuándo: la migración 2 dejó la app inutilizable y se necesita volver al estado previo exacto (incluye ejercicios_custom, ejercicios_custom_backup_pre_fase1 y entrenadores).
-- Los grants se restauran desde el ACL EFECTIVO del snapshot (incl. predeterminados). Comprobar después con el bloque D de verify (cambiaron = 0).
-- Borra las políticas actuales de las tablas gestionadas y recrea las del snapshot; restaura RLS/FORCE y los grants de PUBLIC/anon/authenticated.
-- Reabre la exposición anterior (acceso_total): usar solo como emergencia y corregir hacia adelante cuanto antes.
DO $$
DECLARE
  managed text[] := ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides','ejercicio_overrides',
                          'ejercicios_custom','ejercicios_custom_backup_pre_fase1','entrenadores','coach_calendar_assignments'];
  r record;
BEGIN
  IF to_regclass('backup_rls_p0.policies') IS NULL THEN RAISE EXCEPTION 'No existe el snapshot de políticas'; END IF;
  FOR r IN SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY(managed) LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
  FOR r IN SELECT * FROM backup_rls_p0.policies WHERE tablename = ANY(managed) AND to_regclass('public.' || tablename) IS NOT NULL LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s', r.policyname, r.tablename, r.permissive, r.cmd, array_to_string(r.roles, ', '),
                   CASE WHEN r.qual IS NOT NULL THEN ' USING (' || r.qual || ')' ELSE '' END,
                   CASE WHEN r.with_check IS NOT NULL THEN ' WITH CHECK (' || r.with_check || ')' ELSE '' END);
  END LOOP;
  FOR r IN SELECT * FROM backup_rls_p0.rls_flags WHERE tbl = ANY(managed) AND to_regclass('public.' || tbl) IS NOT NULL LOOP
    EXECUTE format('ALTER TABLE public.%I %s ROW LEVEL SECURITY', r.tbl, CASE WHEN r.relrowsecurity THEN 'ENABLE' ELSE 'DISABLE' END);
    EXECUTE format('ALTER TABLE public.%I %s ROW LEVEL SECURITY', r.tbl, CASE WHEN r.relforcerowsecurity THEN 'FORCE' ELSE 'NO FORCE' END);
  END LOOP;
  FOR r IN SELECT DISTINCT tbl FROM backup_rls_p0.rls_flags WHERE tbl = ANY(managed) AND to_regclass('public.' || tbl) IS NOT NULL LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r.tbl);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.tbl); END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', r.tbl); END IF;
  END LOOP;
  FOR r IN SELECT * FROM backup_rls_p0.grants WHERE tbl = ANY(managed) AND kind = 'r' AND grantee IN ('PUBLIC', 'anon', 'authenticated') AND to_regclass('public.' || tbl) IS NOT NULL LOOP
    EXECUTE format('GRANT %s ON TABLE public.%I TO %s%s', r.privilege_type, r.tbl, r.grantee, CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END);
  END LOOP;
END $$;

-- ───────── R3 · Quitar los objetos que crean las migraciones (funciones, triggers, tablas auxiliares) ─────────
-- No se hace desde la copia: usar supabase/rollback/20261010120000_rls_p0_rollback.sql (funciones it_* y triggers it_guard_*)
-- y, si corresponde, DROP TABLE public.coach_principal / public.rls_p0_backfill_log. Los triggers y funciones PREEXISTENTES
-- (p. ej. trg_ejercicio_overrides_updated_at) no los toca ninguna migración; sus definiciones están en backup_rls_p0.triggers / functions.

-- ───────── R4 · Recuperar filas que FALTAN (borradas por error) sin pisar datos nuevos ─────────
-- Editar la lista (vacía = no hace nada). Inserta solo filas de la copia cuya clave NO existe hoy. Filas existentes, modificadas o nuevas no se tocan.
-- Antes: correr el bloque B de sql/rls_p0_backup_verify.sql y confirmar que "faltantes" son filas que realmente querés recuperar
-- (un alumno o una rutina borrados A PROPÓSITO volverían a aparecer). Hacerlo tabla por tabla.
DO $$
DECLARE
  tablas text[] := ARRAY[]::text[];   -- ejemplo: ARRAY['progreso']  |  ARRAY['sesiones','fotos']
  t text; k text; n bigint;
BEGIN
  IF cardinality(tablas) = 0 THEN RAISE NOTICE 'R4: lista de tablas vacia, no se hace nada'; RETURN; END IF;
  FOREACH t IN ARRAY tablas LOOP
    IF to_regclass('backup_rls_p0.' || t) IS NULL OR to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'R4: % sin copia o sin tabla viva', t; END IF;
    -- clave = índice único/PK de UNA columna de la tabla viva; si no existe, NO se restaura (no se puede garantizar que no se dupliquen filas)
    SELECT a.attname INTO k FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
     WHERE i.indrelid = ('public.' || t)::regclass AND i.indisunique AND i.indisvalid AND i.indnkeyatts = 1 AND i.indpred IS NULL
     ORDER BY i.indisprimary DESC LIMIT 1;
    IF k IS NULL THEN RAISE EXCEPTION 'R4: % no tiene clave unica de una columna: recuperar a mano (ver bloque B del verify)', t; END IF;
    EXECUTE format('INSERT INTO public.%1$I SELECT b.* FROM backup_rls_p0.%1$I b WHERE NOT EXISTS (SELECT 1 FROM public.%1$I s WHERE s.%2$I::text = b.%2$I::text)', t, k);
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE 'R4: % filas recuperadas en % (clave %)', n, t, k;
    -- secuencia asociada (si la clave es serial): evitar colisiones futuras tras reinsertar ids explícitos
    IF pg_get_serial_sequence('public.' || t, k) IS NOT NULL THEN
      EXECUTE format('SELECT setval(%L, greatest((SELECT coalesce(max(%I), 1) FROM public.%I), (SELECT last_value FROM %s)))', pg_get_serial_sequence('public.' || t, k), k, t, pg_get_serial_sequence('public.' || t, k));
    END IF;
  END LOOP;
END $$;

-- ───────── R5 · Consulta de apoyo: definiciones guardadas (copiar y revisar a mano si hace falta recrear algo) ─────────
-- SELECT tbl, tgname, def FROM backup_rls_p0.triggers;
-- SELECT proname, args, def FROM backup_rls_p0.functions WHERE proname NOT LIKE 'it\_%';
-- SELECT tbl, conname, def FROM backup_rls_p0.constraints;
