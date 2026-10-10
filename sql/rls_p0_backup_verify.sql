-- =============================================================================
-- VERIFICACIÓN de la copia interna backup_rls_p0 — SOLO LECTURA (SQL Editor). Devuelve conteos y ids faltantes, nunca contenido.
-- Se ejecuta DOS veces: (1) justo después de crear la copia  →  todo debe dar OK en el bloque A.
--                       (2) después de backfill/migración 2/uso real  →  el bloque B debe mostrar faltantes = 0.
-- Si ejecutás cada SELECT por separado en el SQL Editor, usá un resultado por vez.
-- =============================================================================

-- A) Integridad de la copia: cuenta y huella (md5) idénticas al manifiesto y, si nada cambió desde la copia, a las tablas vivas.
--    OK_COPIA   = la copia coincide con el manifiesto (la copia no se corrompió).
--    OK_ORIGEN  = la tabla viva sigue idéntica a la copia (esperable solo inmediatamente después de copiar).
SELECT m.tbl,
       m.row_count AS filas_manifiesto,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM backup_rls_p0.%I', m.tbl), false, true, '')))[1]::text::bigint AS filas_copia,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%I', m.tbl), false, true, '')))[1]::text::bigint AS filas_vivas,
       ((xpath('/row/h/text()', query_to_xml(format($f$SELECT md5(coalesce(string_agg(x::text, E'\n' ORDER BY x::text), '')) AS h FROM backup_rls_p0.%I x$f$, m.tbl), false, true, '')))[1]::text = m.md5) AS ok_copia,
       ((xpath('/row/h/text()', query_to_xml(format($f$SELECT md5(coalesce(string_agg(x::text, E'\n' ORDER BY x::text), '')) AS h FROM public.%I x$f$, m.tbl), false, true, '')))[1]::text = m.md5) AS ok_origen
  FROM backup_rls_p0.manifest m
 ORDER BY m.tbl;

-- B) Cambios desde la copia (solo conteos, sin contenido). La clave de cada tabla se detecta en el catálogo (índice único/PK de UNA columna
--    de la tabla viva); si no hay ninguna NO se asume ninguna: se compara por huella de fila completa.
--    faltantes = filas de la copia que ya no existen vivas (borradas o cambiaron de clave)  → debe ser 0 salvo borrados intencionales.
--    nuevas    = filas vivas que no estaban en la copia (datos nuevos)                        → informativo; NUNCA se pisan al restaurar.
--    solo_entrenador_id = filas distintas ÚNICAMENTE en la columna entrenador_id (efecto esperado del backfill).
--    Sin clave: "faltantes" cuenta filas de la copia sin igual exacto vivo (incluye modificadas) y "nuevas" las vivas sin igual exacto en la copia.
WITH keys AS (
  SELECT m.tbl,
         (SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
           WHERE i.indrelid = to_regclass('public.' || m.tbl) AND i.indisunique AND i.indisvalid AND i.indnkeyatts = 1 AND i.indpred IS NULL
           ORDER BY i.indisprimary DESC LIMIT 1) AS k,
         to_regclass('public.' || m.tbl) IS NOT NULL AS viva,
         EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = m.tbl AND c.column_name = 'entrenador_id') AS tiene_ent
    FROM backup_rls_p0.manifest m)
SELECT k.tbl, coalesce(k.k, '(sin clave unica)') AS clave,
       CASE WHEN NOT k.viva THEN NULL WHEN k.k IS NOT NULL
         THEN (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM backup_rls_p0.%1$I b WHERE NOT EXISTS (SELECT 1 FROM public.%1$I s WHERE s.%2$I::text = b.%2$I::text)', k.tbl, k.k), false, true, '')))[1]::text::bigint
         ELSE (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM (SELECT md5(to_jsonb(b)::text) FROM backup_rls_p0.%1$I b EXCEPT ALL SELECT md5(to_jsonb(s)::text) FROM public.%1$I s) d', k.tbl), false, true, '')))[1]::text::bigint END AS faltantes,
       CASE WHEN NOT k.viva THEN NULL WHEN k.k IS NOT NULL
         THEN (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%1$I s WHERE NOT EXISTS (SELECT 1 FROM backup_rls_p0.%1$I b WHERE s.%2$I::text = b.%2$I::text)', k.tbl, k.k), false, true, '')))[1]::text::bigint
         ELSE (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM (SELECT md5(to_jsonb(s)::text) FROM public.%1$I s EXCEPT ALL SELECT md5(to_jsonb(b)::text) FROM backup_rls_p0.%1$I b) d', k.tbl), false, true, '')))[1]::text::bigint END AS nuevas,
       CASE WHEN k.viva AND k.k IS NOT NULL AND k.tiene_ent
         THEN (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM public.%1$I s JOIN backup_rls_p0.%1$I b ON s.%2$I::text = b.%2$I::text WHERE to_jsonb(s) <> to_jsonb(b) AND (to_jsonb(s) - ''entrenador_id'') = (to_jsonb(b) - ''entrenador_id'')', k.tbl, k.k), false, true, '')))[1]::text::bigint END AS solo_entrenador_id,
       CASE WHEN NOT k.viva THEN 'la tabla viva ya no existe' WHEN k.k IS NULL THEN 'sin clave unica de una columna: comparacion por huella de fila' ELSE '' END AS nota
  FROM keys k
 ORDER BY k.tbl;

-- C) Objetos: ¿el snapshot tiene lo esperado? (conteos del snapshot vs estado actual; difieren tras las migraciones, es normal)
SELECT 'politicas' AS objeto, (SELECT count(*) FROM backup_rls_p0.policies) AS en_copia, (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS actuales
UNION ALL SELECT 'triggers', (SELECT count(*) FROM backup_rls_p0.triggers), (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal)
UNION ALL SELECT 'funciones', (SELECT count(*) FROM backup_rls_p0.functions), (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f')
UNION ALL SELECT 'constraints', (SELECT count(*) FROM backup_rls_p0.constraints), (SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace)
UNION ALL SELECT 'auth.users', (SELECT count(*) FROM backup_rls_p0.auth_users_min), (SELECT count(*) FROM auth.users);

-- D) Privilegios hoy vs snapshot (3 niveles). Antes de migrar: cambiaron = 0 en todas las filas. Tras la migración 2 cambian (esperado).
--    Tras restaurar con R2: TODAS las filas deben volver a 0.
--      efectivos *            = has_table_privilege por rol (incluye herencia por pertenencia a roles, PUBLIC y predeterminados)
--      acl directo tablas     = ACL propio de PUBLIC/anon/authenticated sobre las tablas del snapshot (lo que R2 restaura)
--      acl columnas           = privilegios por columna de PUBLIC/anon/authenticated (lo que R2 restaura)
--    Un privilegio heredado puede ocultar un ACL directo distinto en "efectivos"; por eso se comparan también los dos ACL.
SELECT 'efectivos ' || e.role AS verificacion,
       count(*) FILTER (WHERE e.granted IS DISTINCT FROM has_table_privilege(e.role, to_regclass('public.' || e.tbl), e.priv)) AS cambiaron,
       count(*) AS comparados
  FROM backup_rls_p0.effective_privs e
 WHERE to_regclass('public.' || e.tbl) IS NOT NULL
 GROUP BY e.role
UNION ALL
SELECT 'acl directo tablas', count(*), NULL FROM (
  (SELECT tbl, grantee, privilege_type, is_grantable FROM backup_rls_p0.grants WHERE kind = 'r' AND grantee IN ('PUBLIC','anon','authenticated') AND to_regclass('public.' || tbl) IS NOT NULL
   EXCEPT
   SELECT c.relname, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END, a.privilege_type, a.is_grantable
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(coalesce(c.relacl, acldefault('r'::"char", c.relowner))) a
    WHERE n.nspname = 'public' AND c.relkind = 'r')
  UNION ALL
  (SELECT c.relname, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE a.grantee::regrole::text END, a.privilege_type, a.is_grantable
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(coalesce(c.relacl, acldefault('r'::"char", c.relowner))) a
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname IN (SELECT tbl FROM backup_rls_p0.rls_flags)
      AND (a.grantee = 0 OR a.grantee IN ('anon'::regrole, 'authenticated'::regrole))
   EXCEPT
   SELECT tbl, grantee, privilege_type, is_grantable FROM backup_rls_p0.grants WHERE kind = 'r' AND grantee IN ('PUBLIC','anon','authenticated'))) d
UNION ALL
SELECT 'acl columnas', count(*), NULL FROM (
  (SELECT tbl, col, grantee, privilege_type, is_grantable FROM backup_rls_p0.column_grants WHERE grantee IN ('PUBLIC','anon','authenticated')
   EXCEPT
   SELECT c.relname, a.attname, CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END, x.privilege_type, x.is_grantable
     FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(a.attacl) x
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attacl IS NOT NULL AND NOT a.attisdropped)
  UNION ALL
  (SELECT c.relname, a.attname, CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END, x.privilege_type, x.is_grantable
     FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(a.attacl) x
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attacl IS NOT NULL AND NOT a.attisdropped AND c.relname IN (SELECT tbl FROM backup_rls_p0.rls_flags)
      AND (x.grantee = 0 OR x.grantee IN ('anon'::regrole, 'authenticated'::regrole))
   EXCEPT
   SELECT tbl, col, grantee, privilege_type, is_grantable FROM backup_rls_p0.column_grants WHERE grantee IN ('PUBLIC','anon','authenticated'))) d
ORDER BY 1;

-- E) El esquema de respaldo NO es accesible por API: usage_esquema debe ser false y privilegios_tablas = 0 para anon y authenticated.
SELECT ro.rolname AS rol, has_schema_privilege(ro.rolname, 'backup_rls_p0', 'USAGE') AS usage_esquema,
       (SELECT count(*) FROM pg_class c CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
         WHERE c.relnamespace = 'backup_rls_p0'::regnamespace AND c.relkind = 'r' AND has_table_privilege(ro.rolname, c.oid, p.priv)) AS privilegios_tablas
  FROM pg_roles ro WHERE ro.rolname IN ('anon', 'authenticated') ORDER BY 1;
