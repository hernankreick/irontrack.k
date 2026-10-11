-- =============================================================================
-- ROTACIÓN DE LA COPIA INTERNA (SQL Editor de Supabase). NO modifica datos de la app: solo renombra/comenta esquemas de respaldo.
-- Regla de oro: verify y restore usan SIEMPRE el esquema llamado exactamente backup_rls_p0. Después de rotar:
--     backup_rls_p0       = copia FRESCA (la que se usa)        backup_rls_p0_prev = copia ANTERIOR (guardada, no se usa)
-- Cada sección es independiente: ejecutar SOLO la que indica la guía, una por vez. Nunca se hace DROP ni se sobrescribe nada.
-- =============================================================================

-- ROTAR-1 · ANTES de sql/rls_p0_backup_create.sql: la copia actual pasa a llamarse backup_rls_p0_prev
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NULL THEN RAISE EXCEPTION 'No existe backup_rls_p0: no hay nada que rotar'; END IF;
  IF to_regnamespace('backup_rls_p0_prev') IS NOT NULL THEN RAISE EXCEPTION 'backup_rls_p0_prev ya existe: no se sobrescribe (ejecutar IDENTIFICAR y decidir)'; END IF;
  EXECUTE format('COMMENT ON SCHEMA backup_rls_p0 IS %L', 'COPIA ANTERIOR (renombrada el ' || now()::date || '). verify/restore NO la usan mientras se llame _prev.');
  ALTER SCHEMA backup_rls_p0 RENAME TO backup_rls_p0_prev;
END $$;

-- ROTAR-2 · DESPUÉS de que sql/rls_p0_backup_create.sql terminó bien: etiqueta la copia fresca
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NULL THEN RAISE EXCEPTION 'No existe backup_rls_p0: el create no terminó'; END IF;
  EXECUTE format('COMMENT ON SCHEMA backup_rls_p0 IS %L', 'COPIA FRESCA previa al backfill (creada el ' || now()::date || '). La usan verify y restore.');
END $$;

-- DESHACER · si el create FALLÓ después de ROTAR-1 (el create es transaccional: no deja una copia a medias): devuelve el nombre original
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NOT NULL THEN RAISE EXCEPTION 'backup_rls_p0 existe: no se deshace nada (ejecutar IDENTIFICAR)'; END IF;
  IF to_regnamespace('backup_rls_p0_prev') IS NULL THEN RAISE EXCEPTION 'No existe backup_rls_p0_prev: nada que devolver'; END IF;
  ALTER SCHEMA backup_rls_p0_prev RENAME TO backup_rls_p0;
  EXECUTE format('COMMENT ON SCHEMA backup_rls_p0 IS %L', 'COPIA ORIGINAL (nombre devuelto el ' || now()::date || ').');
END $$;

-- IDENTIFICAR · SOLO LECTURA: ¿qué copias hay y cuál usan verify/restore?  (usada_por_verify_restore = true solo para backup_rls_p0)
SELECT n.nspname AS esquema,
       obj_description(n.oid, 'pg_namespace') AS nota,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.manifest', n.nspname), false, true, '')))[1]::text AS tablas_copiadas,
       (xpath('/row/c/text()', query_to_xml(format('SELECT coalesce(sum(row_count), 0) AS c FROM %I.manifest', n.nspname), false, true, '')))[1]::text AS filas_en_manifest,
       n.nspname = 'backup_rls_p0' AS usada_por_verify_restore,
       has_schema_privilege('anon', n.oid, 'USAGE') AS anon_usage,
       has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_usage,
       (SELECT count(*) FROM pg_class c CROSS JOIN pg_roles ro CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
         WHERE c.relnamespace = n.oid AND c.relkind = 'r' AND ro.rolname IN ('anon', 'authenticated') AND has_table_privilege(ro.rolname, c.oid, p.priv)) AS privilegios_tablas_anon_auth
  FROM pg_namespace n
 WHERE n.nspname IN ('backup_rls_p0', 'backup_rls_p0_prev', 'backup_rls_p0_fresca')
 ORDER BY n.nspname;

-- INTERCAMBIAR-A-ANTERIOR · EMERGENCIA: hacer que verify/restore usen la copia ANTERIOR (la fresca pasa a backup_rls_p0_fresca)
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NULL OR to_regnamespace('backup_rls_p0_prev') IS NULL THEN RAISE EXCEPTION 'Faltan backup_rls_p0 y/o backup_rls_p0_prev'; END IF;
  IF to_regnamespace('backup_rls_p0_fresca') IS NOT NULL THEN RAISE EXCEPTION 'backup_rls_p0_fresca ya existe: ejecutar IDENTIFICAR'; END IF;
  ALTER SCHEMA backup_rls_p0 RENAME TO backup_rls_p0_fresca;
  ALTER SCHEMA backup_rls_p0_prev RENAME TO backup_rls_p0;
END $$;

-- INTERCAMBIAR-A-FRESCA · deshace el anterior: vuelve a usar la copia fresca (la anterior vuelve a backup_rls_p0_prev)
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NULL OR to_regnamespace('backup_rls_p0_fresca') IS NULL THEN RAISE EXCEPTION 'Faltan backup_rls_p0 y/o backup_rls_p0_fresca'; END IF;
  IF to_regnamespace('backup_rls_p0_prev') IS NOT NULL THEN RAISE EXCEPTION 'backup_rls_p0_prev ya existe: ejecutar IDENTIFICAR'; END IF;
  ALTER SCHEMA backup_rls_p0 RENAME TO backup_rls_p0_prev;
  ALTER SCHEMA backup_rls_p0_fresca RENAME TO backup_rls_p0;
END $$;
