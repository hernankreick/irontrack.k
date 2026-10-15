-- =============================================================================
-- RESPALDO EXACTO de políticas y grants ANTES de aplicar la migración RLS (SQL Editor, solo lectura).
-- Guardar el resultado: es la fuente de verdad para restaurar el estado previo si el rollback genérico no alcanza
-- (en particular ejercicios_custom, cuya política original no está versionada).
-- =============================================================================
SELECT '-- POLITICAS' AS ddl
UNION ALL
SELECT format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
         policyname, schemaname, tablename, permissive, cmd,
         array_to_string(roles, ', '),
         CASE WHEN qual IS NOT NULL THEN ' USING (' || regexp_replace(qual, E'\\s+', ' ', 'g') || ')' ELSE '' END,
         CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || regexp_replace(with_check, E'\\s+', ' ', 'g') || ')' ELSE '' END)
  FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT '-- RLS: ' || format('ALTER TABLE %I.%I %s ROW LEVEL SECURITY;', n.nspname, c.relname,
         CASE WHEN c.relrowsecurity THEN 'ENABLE' ELSE 'DISABLE' END)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'
UNION ALL
SELECT '-- GRANTS: ' || format('GRANT %s ON %I.%I TO %s;', string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type), n.nspname, c.relname, a.grantee::regrole::text)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
 GROUP BY n.nspname, c.relname, a.grantee;
