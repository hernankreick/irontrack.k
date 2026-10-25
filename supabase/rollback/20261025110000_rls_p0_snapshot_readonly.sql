-- SOLO LECTURA. Ejecutar ANTES de aplicar 20261025110000_rls_p0_lockdown.sql y guardar la salida fuera del repositorio (contiene
-- nombres de políticas, no datos). Genera el SQL exacto para restaurar políticas, RLS y grants de las tablas de public.
SELECT '-- politicas' AS restore_sql
UNION ALL
SELECT format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;', policyname, schemaname, tablename, permissive, cmd,
       array_to_string(roles, ', '),
       CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END,
       CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END)
  FROM pg_policies WHERE schemaname = 'public'
UNION ALL SELECT '-- RLS activo/inactivo'
UNION ALL
SELECT format('ALTER TABLE public.%I %s ROW LEVEL SECURITY;', c.relname, CASE WHEN c.relrowsecurity THEN 'ENABLE' ELSE 'DISABLE' END)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p')
UNION ALL SELECT '-- grants'
UNION ALL
SELECT format('GRANT %s ON TABLE public.%I TO %I;', string_agg(privilege_type, ', ' ORDER BY privilege_type), table_name, grantee)
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated') GROUP BY table_name, grantee;
