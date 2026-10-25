-- =============================================================================
-- IronTrack — RLS P0: DIAGNÓSTICO PREDESPLIEGUE (SOLO LECTURA). Un único SELECT.
--
-- Cómo usarlo: Supabase → SQL Editor → pegar TODO este archivo y ejecutar (un solo SELECT; no hay INSERT/UPDATE/DELETE/DDL).
-- Solo consulta catálogos, auth.users (metadatos de titularidad) y conteos; no crea, modifica ni borra nada.
-- Validado en un PostgreSQL local con datos ficticios, dentro de una transacción READ ONLY.
-- Salida: una tabla (orden, seccion, objeto, detalle, estado). Estados: OK · INFO · ATENCION · REQUIERE_VINCULACION · BLOQUEA.
-- Privacidad: los emails salen enmascarados (ab***@dominio) y no se lee ningún contenido de las tablas (solo conteos y claves).
-- OPCIONAL pero recomendado: pegar abajo (CTE coach_uids) los UIDs del secreto COACH_UIDS. Son identificadores, no credenciales; no los subas al repositorio.
--   Con ellos el script separa la autorización real de entrenador de las filas de la tabla `entrenadores` (que el cliente escribe y NO prueban nada),
--   comprueba que ninguna cuenta de entrenador esté vinculada como alumno y que los datos con dueño por UID pertenezcan a un entrenador autorizado.
-- Guardá la salida (exportar CSV) FUERA del repositorio y enviámela/compartila para decidir GO/NO-GO.
-- Si falla con «relation ... does not exist», anotá cuál: es un hallazgo (tabla ausente), no un daño.
-- =============================================================================
WITH
gestionadas(t) AS (VALUES ('alumnos'),('progreso'),('rutinas'),('sesiones'),('fotos'),('mensajes'),('config'),('notas'),('video_overrides'),
  ('ejercicio_overrides'),('ejercicios_custom'),('entrenadores'),('coach_calendar_assignments'),('coach_notification_reads'),
  ('ejercicios_custom_backup_pre_fase1'),('coach_accounts')),
tablas AS (
  SELECT c.oid, c.relname, c.relkind, c.relrowsecurity AS rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','f')),
priv AS (
  SELECT t.*,
    concat_ws(',', CASE WHEN has_table_privilege('anon', t.oid, 'SELECT') THEN 'S' END, CASE WHEN has_table_privilege('anon', t.oid, 'INSERT') THEN 'I' END,
                   CASE WHEN has_table_privilege('anon', t.oid, 'UPDATE') THEN 'U' END, CASE WHEN has_table_privilege('anon', t.oid, 'DELETE') THEN 'D' END) AS anon_p,
    concat_ws(',', CASE WHEN has_table_privilege('authenticated', t.oid, 'SELECT') THEN 'S' END, CASE WHEN has_table_privilege('authenticated', t.oid, 'INSERT') THEN 'I' END,
                   CASE WHEN has_table_privilege('authenticated', t.oid, 'UPDATE') THEN 'U' END, CASE WHEN has_table_privilege('authenticated', t.oid, 'DELETE') THEN 'D' END) AS auth_p,
    (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = t.relname) AS n_pol,
    EXISTS (SELECT 1 FROM gestionadas g WHERE g.t = t.relname) AS gestionada
    FROM tablas t),
cols(tabla, columna, requerido, obligatoria) AS (VALUES
  ('alumnos','id',NULL,true),('alumnos','entrenador_id',NULL,true),('alumnos','email',NULL,true),('alumnos','onesignal_id',NULL,true),
  ('alumnos','ultimo_pago_confirmado',NULL,false),('alumnos','auth_uid',NULL,false),
  ('rutinas','id',NULL,true),('rutinas','alumno_id',NULL,true),('rutinas','entrenador_id',NULL,true),('rutinas','datos',NULL,true),
  ('rutinas','es_plantilla',NULL,true),('rutinas','nombre',NULL,true),
  ('progreso','id',NULL,true),('progreso','alumno_id',NULL,true),('progreso','ejercicio_id',NULL,true),('progreso','semana',NULL,true),('progreso','ciclo',NULL,false),
  ('sesiones','id',NULL,true),('sesiones','alumno_id',NULL,true),('sesiones','rutina_id',NULL,true),('sesiones','semana',NULL,true),('sesiones','ciclo',NULL,false),
  ('mensajes','alumno_id',NULL,true),('mensajes','de_entrenador','boolean',true),('mensajes','leido',NULL,true),
  ('fotos','alumno_id',NULL,true),('notas','alumno_id',NULL,false),('config','id',NULL,true),('config','alias',NULL,false),
  ('video_overrides','entrenador_id',NULL,true),('video_overrides','ejercicio_id',NULL,true),
  ('ejercicio_overrides','entrenador_id',NULL,true),('ejercicio_overrides','ejercicio_id',NULL,true),
  ('ejercicios_custom','entrenador_id',NULL,true),('entrenadores','id',NULL,true),
  ('coach_calendar_assignments','entrenador_id','uuid',false),('coach_notification_reads','entrenador_id','uuid',false)),
au AS (  -- cuentas de Auth (solo metadatos de titularidad; sin contraseñas ni tokens)
  SELECT u.id::text AS uid, lower(u.email) AS em, u.raw_app_meta_data ->> 'alumno_id' AS link, u.email_confirmed_at, u.created_at,
         u.last_sign_in_at, u.raw_app_meta_data -> 'providers' AS prov, u.banned_until
    FROM auth.users u),
al AS (
  SELECT a.id::text AS aid, lower(a.email) AS em, a.entrenador_id::text AS ent,
    (SELECT count(*) FROM au WHERE au.link = a.id::text) AS n_link,
    (SELECT count(*) FROM au WHERE a.email IS NOT NULL AND a.email <> '' AND au.em = lower(a.email)) AS n_email,
    (SELECT count(*) FROM public.alumnos a2 WHERE a.email IS NOT NULL AND a.email <> '' AND lower(a2.email) = lower(a.email) AND a2.id::text <> a.id::text) AS n_dup
    FROM public.alumnos a),
coach_uids(uid) AS (
  SELECT lower(trim(x)) FROM unnest(ARRAY[
    -- PEGAR AQUÍ los UIDs de COACH_UIDS entre comillas simples y separados por coma. Ejemplo: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  ]::text[]) x),
ent_vals AS (
  SELECT 'alumnos' AS t, entrenador_id::text AS v FROM public.alumnos
  UNION ALL SELECT 'rutinas', entrenador_id::text FROM public.rutinas
  UNION ALL SELECT 'video_overrides', entrenador_id::text FROM public.video_overrides
  UNION ALL SELECT 'ejercicio_overrides', entrenador_id::text FROM public.ejercicio_overrides
  UNION ALL SELECT 'ejercicios_custom', entrenador_id::text FROM public.ejercicios_custom),
todo AS (
  -- 01 entorno -------------------------------------------------------------
  SELECT 1 AS orden, '01 entorno' AS seccion, 'servidor' AS objeto, version() AS detalle, 'INFO' AS estado
  UNION ALL SELECT 1, '01 entorno', 'usuario/rol actual', current_user || ' / transaccion read_only=' || current_setting('transaction_read_only'), 'INFO'
  -- 02 tablas, RLS y grants --------------------------------------------------
  UNION ALL SELECT 2, '02 tablas y grants', relname,
    'tipo=' || relkind::text || ' rls=' || rls || ' politicas=' || n_pol || ' anon=[' || anon_p || '] authenticated=[' || auth_p || '] gestionada=' || gestionada,
    CASE WHEN relkind IN ('v','m','f') AND (anon_p <> '' OR auth_p <> '') THEN 'ATENCION'   -- las vistas ignoran RLS
         WHEN NOT gestionada AND (anon_p <> '' OR auth_p <> '') THEN 'ATENCION'
         WHEN gestionada AND (anon_p <> '' OR NOT rls) THEN 'INFO' ELSE 'OK' END
    FROM priv
  UNION ALL SELECT 2, '02 tablas y grants', t, 'tabla gestionada por la migracion B que NO existe en este proyecto (se omite)', 'INFO'
    FROM gestionadas g WHERE to_regclass('public.' || g.t) IS NULL AND g.t <> 'coach_accounts'
  -- 03 politicas vigentes ----------------------------------------------------
  UNION ALL SELECT 3, '03 politicas vigentes', schemaname || '.' || tablename || ' :: ' || policyname,
    cmd || ' roles=' || array_to_string(roles, ',') || ' using=' || coalesce(qual, '-') || ' check=' || coalesce(with_check, '-'),
    CASE WHEN qual = 'true' OR with_check = 'true' THEN 'ATENCION' ELSE 'INFO' END
    FROM pg_policies WHERE schemaname IN ('public', 'storage')
  -- 04 columnas que usan las politicas/triggers -------------------------------
  UNION ALL SELECT 4, '04 columnas requeridas', c.tabla || '.' || c.columna,
    coalesce(ic.data_type, CASE WHEN to_regclass('public.' || c.tabla) IS NULL THEN 'TABLA AUSENTE' ELSE 'COLUMNA AUSENTE' END),
    CASE WHEN ic.data_type IS NULL AND c.obligatoria THEN 'BLOQUEA'
         WHEN ic.data_type IS NULL THEN 'INFO'
         WHEN c.requerido IS NOT NULL AND ic.data_type <> c.requerido THEN 'BLOQUEA' ELSE 'OK' END
    FROM cols c LEFT JOIN information_schema.columns ic ON ic.table_schema = 'public' AND ic.table_name = c.tabla AND ic.column_name = c.columna
  UNION ALL SELECT 4, '04 columnas requeridas', 'ejercicio_overrides UNIQUE(entrenador_id,ejercicio_id)',
    'el cliente hace upsert con onConflict sobre ese par',
    CASE WHEN EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = to_regclass('public.ejercicio_overrides') AND i.indisunique
           AND (SELECT array_agg(a.attname::text ORDER BY a.attname::text) FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)) = ARRAY['ejercicio_id','entrenador_id'])
         THEN 'OK' ELSE 'ATENCION' END
  -- 05 triggers y funciones --------------------------------------------------
  UNION ALL SELECT 5, '05 triggers', c.relname || ' :: ' || t.tgname, 'habilitado=' || t.tgenabled::text,
    CASE WHEN t.tgname LIKE 'it_guard%' THEN 'ATENCION' ELSE 'INFO' END
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal
  UNION ALL SELECT 5, '05 funciones en public', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
    'security_definer=' || p.prosecdef,
    CASE WHEN p.prosecdef THEN 'ATENCION' WHEN p.proname LIKE 'it\_%' THEN 'ATENCION' ELSE 'INFO' END
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
  UNION ALL SELECT 5, '05 privilegios por defecto', coalesce(d.defaclrole::regrole::text, '?') || ' / ' || coalesce(ns.nspname, '(global)'),
    d.defaclacl::text, 'INFO'
    FROM pg_default_acl d LEFT JOIN pg_namespace ns ON ns.oid = d.defaclnamespace
  -- 06 entrenadores: ¿cuales son legitimos? (comparar con el secreto COACH_UIDS) -------
  UNION ALL SELECT 6, '06 entrenadores (fila en tabla)', e.id::text,
    'en_auth=' || (u.uid IS NOT NULL) || ' email=' || coalesce(left(u.em, 2) || '***@' || split_part(u.em, '@', 2), '-')
      || ' en_COACH_UIDS=' || (cu.uid IS NOT NULL) || ' cuenta_de_alumno=' || (ac.aid IS NOT NULL) || ' vinculada_como_alumno=' || coalesce(u.link IS NOT NULL, false)
      || ' alumnos_que_la_usan_como_entrenador_id=' || (SELECT count(*) FROM al WHERE al.ent = e.id::text),
    CASE WHEN cu.uid IS NOT NULL AND u.link IS NOT NULL THEN 'BLOQUEA'        -- entrenador autorizado vinculado como alumno
         WHEN cu.uid IS NOT NULL THEN 'OK'                                     -- entrenador autorizado por COACH_UIDS
         WHEN ac.aid IS NOT NULL THEN 'INFO'                                   -- cuenta de alumno: fila creada por el cliente, inerte (no otorga permisos)
         ELSE 'ATENCION' END                                                   -- ni autorizada ni de alumno: confirmar a quien pertenece
    FROM public.entrenadores e LEFT JOIN au u ON u.uid = e.id::text LEFT JOIN coach_uids cu ON cu.uid = lower(e.id::text)
    LEFT JOIN LATERAL (SELECT a.aid FROM al a WHERE a.aid = u.link OR (u.em IS NOT NULL AND a.em = u.em) LIMIT 1) ac ON true
  UNION ALL SELECT 6, '06 entrenadores (fila en tabla)', 'total filas', (SELECT count(*) FROM public.entrenadores)::text
      || ' (de alumnos, inertes: ' || (SELECT count(*) FROM public.entrenadores e JOIN au u ON u.uid = e.id::text WHERE EXISTS (SELECT 1 FROM al a WHERE a.aid = u.link OR (u.em IS NOT NULL AND a.em = u.em))) || ')', 'INFO'
  UNION ALL SELECT 6, '06 COACH_UIDS (referencia pegada arriba)', 'uids pegados', (SELECT count(*) FROM coach_uids)::text,
    CASE WHEN (SELECT count(*) FROM coach_uids) = 0 THEN 'ATENCION' ELSE 'OK' END
  UNION ALL SELECT 6, '06 COACH_UIDS (referencia pegada arriba)', 'uid ' || left(c.uid, 8), 'existe_en_auth=' || (u.uid IS NOT NULL) || ' fila_en_entrenadores=' || EXISTS (SELECT 1 FROM public.entrenadores e WHERE e.id::text = c.uid)
      || ' vinculada_como_alumno=' || coalesce(u.link IS NOT NULL, false),
    CASE WHEN u.uid IS NULL OR u.link IS NOT NULL THEN 'BLOQUEA' ELSE 'OK' END
    FROM coach_uids c LEFT JOIN au u ON u.uid = c.uid
  -- 07 a quien pertenecen los datos (entrenador_id) -----------------------------
  UNION ALL SELECT 7, '07 entrenador_id por tabla', t || ' :: ' ||
      CASE WHEN v = 'entrenador_principal' THEN 'entrenador_principal (legacy)'
           WHEN EXISTS (SELECT 1 FROM coach_uids c WHERE c.uid = lower(v)) THEN 'UID ' || v || ' (entrenador de COACH_UIDS: cargarlo en coach_accounts)'
           WHEN EXISTS (SELECT 1 FROM public.entrenadores e WHERE e.id::text = v) THEN 'UID ' || v || ' (fila en entrenadores, pero NO en COACH_UIDS)'
           ELSE 'OTRO valor: ' || coalesce(left(v, 12), 'NULL') END,
    count(*)::text || ' filas',
    CASE WHEN v = 'entrenador_principal' THEN 'OK'
         WHEN EXISTS (SELECT 1 FROM coach_uids c WHERE c.uid = lower(v)) THEN 'OK'
         WHEN (SELECT count(*) FROM coach_uids) = 0 THEN 'ATENCION'          -- sin COACH_UIDS pegados no se puede decidir
         ELSE 'BLOQUEA' END                                                  -- dueño fuera de COACH_UIDS: quedaria invisible tras el bloqueo
    FROM ent_vals GROUP BY t, v
  -- 08 vinculacion de alumnos (¿que cuentas hay que vincular?) --------------------
  UNION ALL SELECT 8, '08 vinculacion alumnos', 'alumno ' || al.aid,
    'entrenador=' || coalesce(left(al.ent, 12), 'NULL') || ' email=' || coalesce(left(al.em, 2) || '***@' || split_part(al.em, '@', 2), '-')
      || coalesce(' | cuenta uid=' || left(cu.uid, 8) || ' confirmada=' || (cu.email_confirmed_at IS NOT NULL) || ' alta=' || cu.created_at::date
        || ' ultimo_login=' || coalesce(cu.last_sign_in_at::date::text, 'nunca') || ' proveedores=' || coalesce(cu.prov::text, '-')
        || CASE WHEN cu.banned_until IS NOT NULL AND cu.banned_until > now() THEN ' SUSPENDIDA' ELSE '' END, ' | sin cuenta con ese email')
      || CASE WHEN al.n_dup > 0 THEN ' | EMAIL REPETIDO EN OTRA FICHA' ELSE '' END,
    CASE WHEN al.n_link > 1 THEN 'BLOQUEA'
         WHEN EXISTS (SELECT 1 FROM coach_uids c WHERE c.uid = cu.uid) THEN 'BLOQUEA'   -- cuenta de entrenador autorizado: nunca se vincula como alumno
         WHEN al.n_dup > 0 AND al.n_email > 0 THEN 'BLOQUEA'
         WHEN al.n_link = 1 AND EXISTS (SELECT 1 FROM au x WHERE x.link = al.aid AND x.em = al.em) THEN 'OK'
         WHEN al.n_link = 1 THEN 'ATENCION'
         WHEN al.n_email = 0 THEN 'OK'
         WHEN al.n_email > 1 THEN 'BLOQUEA'
         ELSE 'REQUIERE_VINCULACION' END
    FROM al LEFT JOIN LATERAL (SELECT * FROM au WHERE (au.link = al.aid) OR (al.n_link = 0 AND au.em = al.em) ORDER BY (au.link = al.aid) DESC LIMIT 1) cu ON true
  UNION ALL SELECT 8, '08 vinculacion alumnos', 'cuenta ' || left(u.uid, 8) || ' vinculada a alumno inexistente ' || u.link, 'el alumno ya no existe', 'ATENCION'
    FROM au u WHERE u.link IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = u.link)
  UNION ALL SELECT 8, '08 vinculacion alumnos', 'cuenta ' || left(u.uid, 8) || ' es entrenador Y esta vinculada como alumno', 'riesgo de escalada/confusion', 'BLOQUEA'
    FROM au u WHERE u.link IS NOT NULL AND EXISTS (SELECT 1 FROM coach_uids c WHERE c.uid = u.uid)
  UNION ALL SELECT 8, '08 vinculacion alumnos', 'resumen',
    'alumnos=' || (SELECT count(*) FROM al) || ' vinculados=' || (SELECT count(*) FROM al WHERE n_link = 1)
      || ' con_cuenta_sin_vincular=' || (SELECT count(*) FROM al WHERE n_link = 0 AND n_email > 0) || ' sin_cuenta=' || (SELECT count(*) FROM al WHERE n_link = 0 AND n_email = 0)
      || ' cuentas_auth=' || (SELECT count(*) FROM au) || ' cuentas_con_alumno_id=' || (SELECT count(*) FROM au WHERE link IS NOT NULL), 'INFO'
  -- 09 consistencia de datos que las politicas dan por buena -----------------------
  UNION ALL SELECT 9, '09 datos huerfanos / formato', x.n, x.c::text || ' filas', CASE WHEN x.c > 0 THEN 'ATENCION' ELSE 'OK' END
    FROM (
      SELECT 'rutinas con alumno_id inexistente (el entrenador dejaria de verlas)' AS n, count(*) AS c FROM public.rutinas r WHERE r.alumno_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = r.alumno_id::text)
      UNION ALL SELECT 'progreso con alumno_id inexistente', count(*) FROM public.progreso r WHERE NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = r.alumno_id::text)
      UNION ALL SELECT 'sesiones con alumno_id inexistente', count(*) FROM public.sesiones r WHERE NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = r.alumno_id::text)
      UNION ALL SELECT 'mensajes con alumno_id inexistente', count(*) FROM public.mensajes r WHERE NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = r.alumno_id::text)
      UNION ALL SELECT 'fotos con alumno_id inexistente', count(*) FROM public.fotos r WHERE NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = r.alumno_id::text)
      UNION ALL SELECT 'rutinas.datos que no es un objeto JSON (el alumno no podria avanzar la semana)', count(*) FROM public.rutinas WHERE jsonb_typeof(datos::jsonb) IS DISTINCT FROM 'object'
      UNION ALL SELECT 'rutinas de alumno con semana_activa fuera de 1..4 o ausente', count(*) FROM public.rutinas WHERE alumno_id IS NOT NULL AND coalesce(es_plantilla, false) = false AND coalesce(datos::jsonb ->> 'semana_activa', '') !~ '^[1-4]$'
      UNION ALL SELECT 'alumnos con entrenador_id NULL', count(*) FROM public.alumnos WHERE entrenador_id IS NULL
    ) x
  UNION ALL SELECT 9, '09 datos huerfanos / formato', 'mensajes con de_entrenador NULL (la politica los trata como del alumno)', count(*)::text || ' filas', 'INFO'
    FROM public.mensajes WHERE de_entrenador IS NULL
  UNION ALL SELECT 9, '09 datos huerfanos / formato', 'notas con alumno_id inexistente',
    coalesce((xpath('/row/c/text()', query_to_xml('SELECT count(*) AS c FROM public.notas n WHERE NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.id::text = n.alumno_id::text)', false, true, '')))[1]::text, 'tabla ausente') || ' filas', 'INFO'
    WHERE to_regclass('public.notas') IS NOT NULL
  -- 10 storage y realtime ----------------------------------------------------
  UNION ALL SELECT 10, '10 storage / realtime', 'bucket ' || b.name, 'public=' || b.public, CASE WHEN b.public THEN 'ATENCION' ELSE 'INFO' END
    FROM storage.buckets b
  UNION ALL SELECT 10, '10 storage / realtime', 'realtime publica ' || tablename, 'Realtime respeta RLS', 'INFO'
    FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  -- 12 plan de vinculacion: correspondencia inequivoca cuenta <-> alumno y comando exacto (de a uno) ---------------------------
  UNION ALL SELECT 12, '12 plan de vinculacion', 'alumno ' || p.aid,
    CASE WHEN p.ok THEN 'node scripts/admin/link-alumno.mjs --project-ref <REF> --alumno-id ' || p.aid || ' --auth-id ' || p.uid
           || '   (aplicar: agregar --apply --confirm ' || p.aid || ':' || left(p.uid, 8) || ')'
         ELSE 'NO vincular todavia: ' || p.motivos END,
    CASE WHEN p.ok THEN 'REQUIERE_VINCULACION' ELSE 'BLOQUEA' END
    FROM (
      SELECT al.aid, cu.uid,
        (al.n_email = 1 AND al.n_dup = 0 AND al.n_link = 0 AND cu.uid IS NOT NULL
          AND cu.email_confirmed_at IS NOT NULL AND (cu.banned_until IS NULL OR cu.banned_until <= now())
          AND coalesce(cu.prov, '["email"]'::jsonb) = '["email"]'::jsonb
          AND NOT EXISTS (SELECT 1 FROM coach_uids c WHERE c.uid = cu.uid)
          AND NOT EXISTS (SELECT 1 FROM public.entrenadores e WHERE e.id::text = cu.uid AND EXISTS (SELECT 1 FROM coach_uids c2 WHERE c2.uid = lower(e.id::text)))) AS ok,
        concat_ws('; ', CASE WHEN al.n_email <> 1 THEN 'cuentas con ese email: ' || al.n_email END, CASE WHEN al.n_dup > 0 THEN 'email repetido en otra ficha' END,
          CASE WHEN cu.email_confirmed_at IS NULL THEN 'email de la cuenta sin confirmar' END,
          CASE WHEN cu.banned_until IS NOT NULL AND cu.banned_until > now() THEN 'cuenta suspendida' END,
          CASE WHEN coalesce(cu.prov, '["email"]'::jsonb) <> '["email"]'::jsonb THEN 'proveedor distinto de email' END,
          CASE WHEN EXISTS (SELECT 1 FROM coach_uids c WHERE c.uid = cu.uid) THEN 'es cuenta de entrenador (COACH_UIDS)' END) AS motivos
        FROM al LEFT JOIN LATERAL (SELECT * FROM au WHERE au.em = al.em LIMIT 1) cu ON true
       WHERE al.n_link = 0 AND al.n_email > 0) p
  UNION ALL SELECT 12, '12 plan de vinculacion', 'resumen',
    'pendientes=' || (SELECT count(*) FROM al WHERE n_link = 0 AND n_email > 0) || ' ya_vinculados=' || (SELECT count(*) FROM al WHERE n_link = 1)
      || '. Condicion para aplicar la migracion B: pendientes=0 y ningun BLOQUEA. Vincular de a una y repetir este diagnostico.', 'INFO'
  -- 11 lo que este SQL NO puede ver (verificar a mano) --------------------------------
  UNION ALL SELECT 11, '11 verificar a mano', 'Auth → Sign In / Providers', '¿«Allow new users to sign up» habilitado? (con la migracion B un usuario externo no ve nada, pero conviene saberlo)', 'INFO'
  UNION ALL SELECT 11, '11 verificar a mano', 'Edge Function update-alumno-password', 'secreto COACH_UIDS cargado y con los mismos UIDs que se pasaran a coach_accounts (no se puede leer desde SQL)', 'INFO'
)
SELECT orden, seccion, objeto, detalle, estado FROM (
  SELECT 0 AS orden, '00 RESUMEN' AS seccion, estado AS objeto, count(*)::text AS detalle, estado FROM todo WHERE estado IN ('BLOQUEA','REQUIERE_VINCULACION','ATENCION') AND orden <> 12 GROUP BY estado  -- el plan (12) repite filas de 08
  UNION ALL SELECT * FROM todo
) r ORDER BY orden, seccion, estado DESC, objeto;
