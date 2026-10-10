-- =============================================================================
-- COPIA INTERNA (NO es un backup completo) previa a RLS P0 — SQL Editor de Supabase. NO EJECUTAR sin revisión.
-- Crea el esquema backup_rls_p0 con: copia de las tablas afectadas + snapshot exacto de políticas, RLS, grants, triggers,
-- funciones, constraints, índices, columnas, secuencias y usuarios de Auth (SIN contraseñas ni tokens).
-- Una sola transacción con instantánea consistente (REPEATABLE READ): o queda todo o no queda nada.
-- Nunca sobrescribe: si el esquema ya existe, aborta. Aborta si el espacio estimado supera el margen del plan Free (500 MB).
-- Ver docs/respaldo-rls-p0.md (qué protege y qué NO).
-- =============================================================================
BEGIN ISOLATION LEVEL REPEATABLE READ;

DO $$
DECLARE
  t text; v_tables bigint := 0; v_db bigint := pg_database_size(current_database());
  v_limit bigint := 400::bigint * 1024 * 1024;  -- margen de seguridad sobre los 500 MB del plan Free (al llegar a 500 MB el proyecto pasa a solo lectura)
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NOT NULL THEN
    RAISE EXCEPTION 'backup_rls_p0 ya existe: no se sobrescribe. Conservarlo, o renombrarlo (ALTER SCHEMA backup_rls_p0 RENAME TO backup_rls_p0_AAAAMMDD) antes de repetir.';
  END IF;
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides',
                           'ejercicio_overrides','ejercicios_custom','entrenadores','coach_calendar_assignments','coach_notification_reads'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN v_tables := v_tables + pg_total_relation_size(('public.' || t)::regclass); END IF;
  END LOOP;
  IF v_db + v_tables > v_limit THEN
    RAISE EXCEPTION 'Espacio insuficiente: base % MB + copia estimada % MB supera % MB. No se copia nada (evita que el proyecto Free pase a solo lectura).',
      v_db / 1048576, v_tables / 1048576, v_limit / 1048576;
  END IF;
END $$;

CREATE SCHEMA backup_rls_p0;
REVOKE ALL ON SCHEMA backup_rls_p0 FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN EXECUTE 'REVOKE ALL ON SCHEMA backup_rls_p0 FROM anon'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN EXECUTE 'REVOKE ALL ON SCHEMA backup_rls_p0 FROM authenticated'; END IF;
END $$;

-- Metadatos y tablas de datos -------------------------------------------------
CREATE TABLE backup_rls_p0.meta AS
  SELECT now() AS created_at, version() AS pg_version, current_user AS created_by, pg_database_size(current_database()) AS db_size_bytes;
CREATE TABLE backup_rls_p0.manifest (tbl text PRIMARY KEY, row_count bigint NOT NULL, md5 text NOT NULL);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides',
                           'ejercicio_overrides','ejercicios_custom','entrenadores','coach_calendar_assignments','coach_notification_reads'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('CREATE TABLE backup_rls_p0.%I AS TABLE public.%I', t, t);
    EXECUTE format('ALTER TABLE backup_rls_p0.%I ENABLE ROW LEVEL SECURITY', t);  -- sin políticas: nadie por API
    EXECUTE format($f$INSERT INTO backup_rls_p0.manifest(tbl,row_count,md5)
                       SELECT %L, count(*), md5(coalesce(string_agg(x::text, E'\n' ORDER BY x::text), '')) FROM public.%I x$f$, t, t);
  END LOOP;
END $$;

-- Comprobación inmediata: cada copia tiene exactamente las filas de la instantánea (si no, se aborta y no queda nada)
DO $$
DECLARE r record; n bigint;
BEGIN
  FOR r IN SELECT tbl, row_count FROM backup_rls_p0.manifest LOOP
    EXECUTE format('SELECT count(*) FROM backup_rls_p0.%I', r.tbl) INTO n;
    IF n <> r.row_count THEN RAISE EXCEPTION 'copia incompleta de % (% de %)', r.tbl, n, r.row_count; END IF;
  END LOOP;
END $$;

-- Snapshot de objetos (lo que las migraciones modifican o pueden afectar) -----
CREATE TABLE backup_rls_p0.policies AS
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';
CREATE TABLE backup_rls_p0.rls_flags AS
  SELECT c.relname AS tbl, c.relrowsecurity, c.relforcerowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r';
CREATE TABLE backup_rls_p0.grants AS
  SELECT c.relname AS tbl, c.relkind::text AS kind, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END AS grantee,
         a.privilege_type, a.is_grantable
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
   WHERE n.nspname = 'public' AND c.relkind IN ('r','S','v');
CREATE TABLE backup_rls_p0.triggers AS
  SELECT c.relname AS tbl, t.tgname, pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal;
CREATE TABLE backup_rls_p0.functions AS
  SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, pg_get_functiondef(p.oid) AS def, p.prosecdef AS security_definer
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f';
CREATE TABLE backup_rls_p0.constraints AS
  SELECT conrelid::regclass::text AS tbl, conname, contype::text AS contype, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE connamespace = 'public'::regnamespace;
CREATE TABLE backup_rls_p0.indexes AS
  SELECT tablename AS tbl, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';
CREATE TABLE backup_rls_p0.columns AS
  SELECT table_name AS tbl, column_name, ordinal_position, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema = 'public';
CREATE TABLE backup_rls_p0.sequences AS
  SELECT sequencename, last_value, increment_by FROM pg_sequences WHERE schemaname = 'public';

-- Auth: solo identificación (SIN encrypted_password, tokens ni metadatos de sesión). NO permite restaurar contraseñas.
DO $$ BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    EXECUTE $q$CREATE TABLE backup_rls_p0.auth_users_min AS
      SELECT u.id, u.email, to_jsonb(u)->>'created_at' AS created_at, to_jsonb(u)->>'last_sign_in_at' AS last_sign_in_at,
             to_jsonb(u)->>'email_confirmed_at' AS email_confirmed_at FROM auth.users u$q$;
  END IF;
END $$;

-- Cierre: sin acceso por API a nada del esquema de respaldo
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'backup_rls_p0' AND c.relkind = 'r' LOOP
    EXECUTE format('ALTER TABLE backup_rls_p0.%I ENABLE ROW LEVEL SECURITY', r.relname);
  END LOOP;
END $$;

COMMIT;

-- Resumen (solo conteos): copiar el resultado
SELECT m.tbl, m.row_count FROM backup_rls_p0.manifest m ORDER BY m.tbl;
