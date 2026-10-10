\set ON_ERROR_STOP on
CREATE SCHEMA IF NOT EXISTS tests;
DROP TABLE IF EXISTS tests.results; CREATE TABLE tests.results(name text, ok boolean, got text, want text);
CREATE OR REPLACE FUNCTION tests.x(uid text, rl text, q text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', coalesce(uid,''), true);
  EXECUTE 'SET LOCAL ROLE '||rl;
  BEGIN
    EXECUTE q; GET DIAGNOSTICS n = ROW_COUNT; RESET ROLE; RETURN 'ok:'||n;
  EXCEPTION WHEN OTHERS THEN RESET ROLE; RETURN 'err:'||SQLSTATE;
  END;
END $$;
CREATE OR REPLACE FUNCTION tests.t(name text, uid text, rl text, q text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g text := tests.x(uid, rl, q);
BEGIN INSERT INTO tests.results VALUES (name, g = want, g, want); END $$;
CREATE OR REPLACE FUNCTION tests.state(name text, q text, want text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g text;
BEGIN EXECUTE q INTO g; INSERT INTO tests.results VALUES (name, g = want, g, want); END $$;

\set C1 '''00000000-0000-0000-0000-0000000000c1'''
\set C2 '''00000000-0000-0000-0000-0000000000c2'''
\set UA '''00000000-0000-0000-0000-0000000000a1'''
\set UB '''00000000-0000-0000-0000-0000000000b1'''
\set D1 '''00000000-0000-0000-0000-0000000000d1'''
\set QC1 ''''''''00000000-0000-0000-0000-0000000000c1''''''''
\set QC2 ''''''''00000000-0000-0000-0000-0000000000c2''''''''
\set QUA ''''''''00000000-0000-0000-0000-0000000000a1''''''''
\set QUB ''''''''00000000-0000-0000-0000-0000000000b1''''''''
\set QD1 ''''''''00000000-0000-0000-0000-0000000000d1''''''''
\set IDA '11111111-1111-1111-1111-111111111111'
\set IDB '22222222-2222-2222-2222-222222222222'

\o /dev/null
-- ============ ANÓNIMO ============
SELECT tests.t('anon SELECT '||t, NULL, 'anon', 'SELECT * FROM public.'||t, 'err:42501')
  FROM unnest(ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides','ejercicio_overrides','ejercicios_custom','entrenadores','coach_calendar_assignments','coach_notification_reads']) t;
SELECT tests.t('anon INSERT progreso', NULL,'anon',$$INSERT INTO progreso(alumno_id,ejercicio_id) VALUES ('$$||:'IDA'||$$','x')$$,'err:42501');
SELECT tests.t('anon UPDATE alumnos', NULL,'anon',$$UPDATE alumnos SET nombre='hack'$$,'err:42501');
SELECT tests.t('anon DELETE rutinas', NULL,'anon','DELETE FROM rutinas','err:42501');
SELECT tests.t('anon UPDATE ejercicio_overrides', NULL,'anon',$$UPDATE ejercicio_overrides SET name='x'$$,'err:42501');
SELECT tests.t('anon DELETE video_overrides', NULL,'anon','DELETE FROM video_overrides','err:42501');

-- ============ ALUMNO A ============
SELECT tests.t('A ve solo su alumno', :UA,'authenticated','SELECT * FROM alumnos','ok:1');
SELECT tests.t('A no ve alumno B', :UA,'authenticated',$$SELECT * FROM alumnos WHERE id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A lee su progreso (1 fila)', :UA,'authenticated','SELECT * FROM progreso','ok:1');
SELECT tests.t('A no lee progreso de B', :UA,'authenticated',$$SELECT * FROM progreso WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A lee sus sesiones', :UA,'authenticated','SELECT * FROM sesiones','ok:1');
SELECT tests.t('A lee su rutina', :UA,'authenticated','SELECT * FROM rutinas','ok:1');
SELECT tests.t('A no ve plantilla del coach', :UA,'authenticated',$$SELECT * FROM rutinas WHERE alumno_id IS NULL$$,'ok:0');
SELECT tests.t('A lee fotos propias', :UA,'authenticated','SELECT * FROM fotos','ok:1');
SELECT tests.t('A lee mensajes propios', :UA,'authenticated','SELECT * FROM mensajes','ok:1');
SELECT tests.t('A lee nota propia', :UA,'authenticated','SELECT * FROM notas','ok:1');
SELECT tests.t('A lee config', :UA,'authenticated','SELECT * FROM config','ok:1');
SELECT tests.t('A lee overrides de SU coach (video)', :UA,'authenticated','SELECT * FROM video_overrides','ok:1');
SELECT tests.t('A lee overrides de SU coach (nombres)', :UA,'authenticated','SELECT * FROM ejercicio_overrides','ok:1');
SELECT tests.t('A lee ejercicios_custom de su coach', :UA,'authenticated','SELECT * FROM ejercicios_custom','ok:1');
SELECT tests.t('A no lee entrenadores', :UA,'authenticated','SELECT * FROM entrenadores','ok:0');
SELECT tests.t('A no lee calendario del coach', :UA,'authenticated','SELECT * FROM coach_calendar_assignments','ok:0');
-- escrituras sobre B
SELECT tests.t('A no inserta progreso para B', :UA,'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id,kg) VALUES ('$$||:'IDB'||$$','sq',999)$$,'err:42501');
SELECT tests.t('A no inserta sesion para B', :UA,'authenticated',$$INSERT INTO sesiones(alumno_id,semana) VALUES ('$$||:'IDB'||$$',9)$$,'err:42501');
SELECT tests.t('A no actualiza progreso de B', :UA,'authenticated',$$UPDATE progreso SET kg=1 WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no borra progreso de B', :UA,'authenticated',$$DELETE FROM progreso WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no actualiza rutina de B', :UA,'authenticated',$$UPDATE rutinas SET datos='{"x":1}' WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no actualiza alumno B', :UA,'authenticated',$$UPDATE alumnos SET onesignal_id='x' WHERE id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no borra fotos de B', :UA,'authenticated',$$DELETE FROM fotos WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no inserta foto para B', :UA,'authenticated',$$INSERT INTO fotos(alumno_id,url) VALUES ('$$||:'IDB'||$$','x')$$,'err:42501');
SELECT tests.t('A no marca leidos de B', :UA,'authenticated',$$UPDATE mensajes SET leido=true WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
-- PRs protegidos
SELECT tests.t('A no modifica su propio progreso (PR)', :UA,'authenticated','UPDATE progreso SET kg=1','ok:0');
SELECT tests.t('A no borra su propio progreso (PR)', :UA,'authenticated','DELETE FROM progreso','ok:0');
SELECT tests.t('A no borra sus sesiones', :UA,'authenticated','DELETE FROM sesiones','ok:0');
-- suplantar entrenador / reasignar
SELECT tests.t('A no cambia entrenador_id de su fila', :UA,'authenticated','UPDATE alumnos SET entrenador_id='||:QUA,'err:42501');
SELECT tests.t('A no cambia auth_uid', :UA,'authenticated','UPDATE alumnos SET auth_uid='||:QUB,'err:42501');
SELECT tests.t('A no cambia email', :UA,'authenticated',$$UPDATE alumnos SET email='x@x'$$,'err:42501');
SELECT tests.t('A no reasigna rutina a B', :UA,'authenticated',$$UPDATE rutinas SET alumno_id='$$||:'IDB'||$$'$$,'err:42501');
SELECT tests.t('A no cambia entrenador_id de rutina', :UA,'authenticated','UPDATE rutinas SET entrenador_id='||:QUA,'err:42501');
SELECT tests.t('A no renombra rutina', :UA,'authenticated',$$UPDATE rutinas SET nombre='x'$$,'err:42501');
SELECT tests.t('A no se registra como entrenador', :UA,'authenticated','INSERT INTO entrenadores(id,email) VALUES ('||:QUA||$$,'a@test.local')$$,'err:42501');
SELECT tests.t('A no inserta alumno falso', :UA,'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''fake'','||:QUA||')','err:42501');
SELECT tests.t('A no crea rutina propia con entrenador_id=A', :UA,'authenticated','INSERT INTO rutinas(entrenador_id,nombre) VALUES ('||:QUA||$$,'x')$$,'err:42501');
SELECT tests.t('A no edita config', :UA,'authenticated',$$UPDATE config SET alias='robado'$$,'ok:0');
SELECT tests.t('A no inserta override de video', :UA,'authenticated','INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('||:QUA||$$,'sq','x')$$,'err:42501');
SELECT tests.t('A no pisa override del coach', :UA,'authenticated',$$UPDATE video_overrides SET youtube_url='x'$$,'ok:0');
SELECT tests.t('A no borra overrides del coach', :UA,'authenticated','DELETE FROM ejercicio_overrides','ok:0');
SELECT tests.t('A no inserta override nombre en coach', :UA,'authenticated','INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('||:QC1||$$,'zz','x')$$,'err:42501');
SELECT tests.t('A no hace mensaje como entrenador', :UA,'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDA'||$$','fake',true)$$,'err:42501');
SELECT tests.t('A no edita texto de mensaje', :UA,'authenticated',$$UPDATE mensajes SET texto='x'$$,'err:42501');
SELECT tests.t('A no inserta mensaje a nombre de B', :UA,'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDB'||$$','x',false)$$,'err:42501');
SELECT tests.t('A no borra mensajes', :UA,'authenticated','DELETE FROM mensajes','ok:0');
SELECT tests.t('A no inserta en calendario de C1', :UA,'authenticated','INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES ('||:QC1||$$,'x','y',now())$$,'err:42501');
-- ============ ALUMNO B no puede tocar A ============
SELECT tests.t('B no lee progreso de A', :UB,'authenticated',$$SELECT * FROM progreso WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:0');
SELECT tests.t('B no modifica rutina de A', :UB,'authenticated',$$UPDATE rutinas SET datos='{}' WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:0');
SELECT tests.t('B no inserta sesion de A', :UB,'authenticated',$$INSERT INTO sesiones(alumno_id,semana) VALUES ('$$||:'IDA'||$$',9)$$,'err:42501');
SELECT tests.t('B no actualiza alumno A', :UB,'authenticated',$$UPDATE alumnos SET onesignal_id='x' WHERE id='$$||:'IDA'||$$'$$,'ok:0');
-- ============ AUTENTICADO AJENO (sin rol) ============
SELECT tests.t('D no ve alumnos '||t, :D1,'authenticated','SELECT * FROM public.'||t,'ok:0')
  FROM unnest(ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides','ejercicio_overrides','ejercicios_custom','entrenadores']) t;
SELECT tests.t('D no inserta progreso de A', :D1,'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id) VALUES ('$$||:'IDA'||$$','x')$$,'err:42501');
SELECT tests.t('D no actualiza alumnos', :D1,'authenticated',$$UPDATE alumnos SET nombre='x'$$,'ok:0');
SELECT tests.t('D no borra rutinas', :D1,'authenticated','DELETE FROM rutinas','ok:0');
SELECT tests.t('D no edita config', :D1,'authenticated',$$UPDATE config SET alias='x'$$,'ok:0');
SELECT tests.t('D no inserta alumno a coach C1', :D1,'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''x'','||:QC1||')','err:42501');
SELECT tests.t('D no inserta alumno propio sin ser entrenador', :D1,'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''x'','||:QD1||')','err:42501');
SELECT tests.t('D no se adjudica alumno (UPDATE auth_uid)', :D1,'authenticated','UPDATE alumnos SET auth_uid='||:QD1,'ok:0');
SELECT tests.t('D no crea override en C1', :D1,'authenticated','INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('||:QC1||$$,'q','x')$$,'err:42501');
-- ============ ENTRENADOR AJENO C2 (legítimo, otros alumnos) ============
SELECT tests.t('C2 no ve alumnos de C1', :C2,'authenticated','SELECT * FROM alumnos','ok:0');
SELECT tests.t('C2 no ve rutinas/plantillas de C1', :C2,'authenticated','SELECT * FROM rutinas','ok:0');
SELECT tests.t('C2 no ve progreso de C1', :C2,'authenticated','SELECT * FROM progreso','ok:0');
SELECT tests.t('C2 no ve mensajes/fotos/notas de C1', :C2,'authenticated','SELECT * FROM mensajes UNION ALL SELECT id,alumno_id,url,false,false,created_at FROM fotos','ok:0');
SELECT tests.t('C2 no inserta rutina para alumno de C1', :C2,'authenticated',$$INSERT INTO rutinas(alumno_id,entrenador_id,nombre) VALUES ('$$||:'IDA'||$$',$$||:QC2||$$,'x')$$,'err:42501');
SELECT tests.t('C2 no inserta rutina para A declarando entrenador C1', :C2,'authenticated',$$INSERT INTO rutinas(alumno_id,entrenador_id,nombre) VALUES ('$$||:'IDA'||$$',$$||:QC1||$$,'x')$$,'err:42501');
SELECT tests.t('C2 no borra alumnos de C1', :C2,'authenticated','DELETE FROM alumnos','ok:0');
SELECT tests.t('C2 no se apropia alumno (UPDATE entrenador_id)', :C2,'authenticated','UPDATE alumnos SET entrenador_id='||:QC2,'ok:0');
SELECT tests.t('C2 no inserta alumno a nombre de C1', :C2,'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''x'','||:QC1||')','err:42501');
SELECT tests.t('C2 ve solo sus overrides (video)', :C2,'authenticated','SELECT * FROM video_overrides','ok:1');
SELECT tests.t('C2 ve solo sus overrides (nombres)', :C2,'authenticated','SELECT * FROM ejercicio_overrides','ok:1');
SELECT tests.t('C2 no borra overrides de C1', :C2,'authenticated','DELETE FROM video_overrides WHERE entrenador_id='||:QC1,'ok:0');
SELECT tests.t('C2 ve solo su fila en entrenadores', :C2,'authenticated','SELECT * FROM entrenadores','ok:1');
SELECT tests.t('C2 no modifica entrenador C1', :C2,'authenticated',$$UPDATE entrenadores SET nombre='x' WHERE id=$$||:QC1,'ok:0');

-- Estado intacto tras ataques
SELECT tests.state('estado: progreso intacto', $$SELECT string_agg(kg::text,',' ORDER BY kg) FROM progreso$$, '100,120');
SELECT tests.state('estado: alumnos intactos', $$SELECT string_agg(coalesce(onesignal_id,'-')||entrenador_id,',' ORDER BY nombre) FROM alumnos$$, '-00000000-0000-0000-0000-0000000000c1,-00000000-0000-0000-0000-0000000000c1');
SELECT tests.state('estado: rutinas intactas', $$SELECT string_agg(nombre||alumno_id,',' ORDER BY nombre) FROM rutinas WHERE alumno_id IS NOT NULL$$, 'RutA11111111-1111-1111-1111-111111111111,RutB22222222-2222-2222-2222-222222222222');
SELECT tests.state('estado: config intacta', $$SELECT alias FROM config$$, 'alias.coach');
SELECT tests.state('estado: sin mensajes falsos', $$SELECT count(*)::text FROM mensajes$$, '2');

-- ============ OPERACIONES LEGÍTIMAS (alumno) — incluye flujo de sincronización V2 ============
SELECT tests.t('A registra serie (progreso INSERT)', :UA,'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) VALUES ('$$||:'IDA'||$$','bp',3,8,60,'2026-01-02',1)$$,'ok:1');
SELECT tests.t('A cola offline: lote de 3 series', :UA,'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) SELECT '$$||:'IDA'||$$','dl',1,5,100+g,'2026-01-03',2 FROM generate_series(1,3) g$$,'ok:3');
SELECT tests.t('A finaliza sesion (sesiones INSERT)', :UA,'authenticated',$$INSERT INTO sesiones(alumno_id,rutina_id,semana,dia_idx,fecha) VALUES ('$$||:'IDA'||$$','aaaaaaaa-0000-0000-0000-00000000000a',1,1,'2026-01-02')$$,'ok:1');
SELECT tests.t('A avanza semana (rutinas.datos UPDATE)', :UA,'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":2}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('A guarda onesignal_id', :UA,'authenticated',$$UPDATE alumnos SET onesignal_id='pid' WHERE id='$$||:'IDA'||$$'$$,'ok:1');
SELECT tests.t('A busca su fila por email (login)', :UA,'authenticated',$$SELECT id,nombre,entrenador_id FROM alumnos WHERE email='a@test.local'$$,'ok:1');
SELECT tests.t('A envia mensaje', :UA,'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDA'||$$','dudas',false)$$,'ok:1');
SELECT tests.t('A marca leidos mensajes del coach', :UA,'authenticated',$$UPDATE mensajes SET leido=true WHERE alumno_id='$$||:'IDA'||$$' AND de_entrenador=true AND leido=false$$,'ok:1');
SELECT tests.t('A sube y borra su foto', :UA,'authenticated',$$INSERT INTO fotos(alumno_id,url) VALUES ('$$||:'IDA'||$$','n.jpg')$$,'ok:1');
SELECT tests.t('A borra su foto', :UA,'authenticated',$$DELETE FROM fotos WHERE url='n.jpg'$$,'ok:1');
SELECT tests.t('A lee progreso actualizado (5 filas)', :UA,'authenticated','SELECT * FROM progreso','ok:5');
SELECT tests.state('estado: PR de B intacto', $$SELECT kg::text FROM progreso WHERE alumno_id='22222222-2222-2222-2222-222222222222'$$, '120');

-- ============ OPERACIONES LEGÍTIMAS (entrenador C1) ============
SELECT tests.t('C1 ve sus 2 alumnos', :C1,'authenticated','SELECT * FROM alumnos','ok:2');
SELECT tests.t('C1 crea alumno', :C1,'authenticated','INSERT INTO alumnos(nombre,email,entrenador_id) VALUES (''C'',''c@test.local'','||:QC1||')','ok:1');
SELECT tests.t('C1 edita alumno (todas las columnas)', :C1,'authenticated',$$UPDATE alumnos SET nombre='A2', email='a2@test.local' WHERE id='$$||:'IDA'||$$'$$,'ok:1');
SELECT tests.t('C1 no regala alumno a C2', :C1,'authenticated',$$UPDATE alumnos SET entrenador_id=$$||:QC2||$$ WHERE id='$$||:'IDA'||$$'$$,'err:42501');
SELECT tests.t('C1 asigna rutina a A', :C1,'authenticated',$$INSERT INTO rutinas(alumno_id,entrenador_id,nombre,datos) VALUES ('$$||:'IDA'||$$',$$||:QC1||$$,'Nueva','{"semana_activa":1}')$$,'ok:1');
SELECT tests.t('C1 crea plantilla', :C1,'authenticated','INSERT INTO rutinas(entrenador_id,nombre) VALUES ('||:QC1||$$,'Plant2')$$,'ok:1');
SELECT tests.t('C1 lista rutinas (por entrenador_id)', :C1,'authenticated','SELECT * FROM rutinas WHERE entrenador_id='||:QC1,'ok:5');
SELECT tests.t('C1 edita rutina', :C1,'authenticated',$$UPDATE rutinas SET nombre='RutA2', datos='{"semana_activa":3}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('C1 lee progreso de sus alumnos', :C1,'authenticated','SELECT * FROM progreso','ok:6');
SELECT tests.t('C1 lee sesiones', :C1,'authenticated','SELECT * FROM sesiones','ok:3');
SELECT tests.t('C1 lee mensajes (in.(ids))', :C1,'authenticated','SELECT * FROM mensajes','ok:3');
SELECT tests.t('C1 responde mensaje', :C1,'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDA'||$$','ok',true)$$,'ok:1');
SELECT tests.t('C1 marca leidos', :C1,'authenticated',$$UPDATE mensajes SET leido=true WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:1');
SELECT tests.t('C1 publica nota', :C1,'authenticated',$$INSERT INTO notas(alumno_id,contenido) VALUES ('$$||:'IDA'||$$','n')$$,'ok:1');
SELECT tests.t('C1 edita config', :C1,'authenticated',$$UPDATE config SET alias='nuevo' WHERE id='pagos'$$,'ok:1');
SELECT tests.t('C1 upsert ejercicio_overrides propio', :C1,'authenticated','INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('||:QC1||$$,'sq','Sent2') ON CONFLICT (entrenador_id,ejercicio_id) DO UPDATE SET name=EXCLUDED.name$$,'ok:1');
SELECT tests.t('C1 crea ejercicio custom', :C1,'authenticated','INSERT INTO ejercicios_custom(entrenador_id,name) VALUES ('||:QC1||$$,'X')$$,'ok:1');
SELECT tests.t('C1 solo lee sus customs', :C1,'authenticated','SELECT * FROM ejercicios_custom','ok:2');
SELECT tests.t('C1 upsert entrenadores propio', :C1,'authenticated','INSERT INTO entrenadores(id,email) VALUES ('||:QC1||$$,'coach@test.local') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email$$,'ok:1');
SELECT tests.t('C1 calendario insert/select', :C1,'authenticated','INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES ('||:QC1||$$,'x','y',now())$$,'ok:1');
SELECT tests.t('C1 notificaciones leidas', :C1,'authenticated','INSERT INTO coach_notification_reads(entrenador_id,notification_id) VALUES ('||:QC1||$$,'n1')$$,'ok:1');
SELECT tests.t('C2 no ve calendario de C1', :C2,'authenticated','SELECT * FROM coach_calendar_assignments','ok:0');
SELECT tests.t('C1 reinicia progreso de A', :C1,'authenticated',$$DELETE FROM progreso WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:5');
SELECT tests.t('C1 borra sesiones de A', :C1,'authenticated',$$DELETE FROM sesiones WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:2');
SELECT tests.t('C1 elimina alumno', :C1,'authenticated','DELETE FROM alumnos WHERE nombre=''C''','ok:1');
-- service_role (edge functions) conserva acceso total
SELECT tests.t('service_role lee alumnos', NULL,'service_role','SELECT * FROM alumnos','ok:2');
SELECT tests.t('service_role actualiza auth_uid', NULL,'service_role',$$UPDATE alumnos SET auth_uid=auth_uid$$,'ok:2');

-- ============ Verificaciones estructurales ============
SELECT tests.state('ninguna politica USING(true)/CHECK(true)',
  $$SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND (qual IN ('true','(true)') OR with_check IN ('true','(true)'))$$,'0');
SELECT tests.state('ninguna politica para rol public/anon',
  $$SELECT count(*)::text FROM pg_policies WHERE schemaname='public' AND (roles::text ~ 'public|anon')$$,'0');
SELECT tests.state('anon sin privilegios de tabla en public',
  $$SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace, aclexplode(c.relacl) a WHERE n.nspname='public' AND c.relkind='r' AND (a.grantee=0 OR a.grantee='anon'::regrole)$$,'0');
SELECT tests.state('RLS activo en las 14 tablas',
  $$SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity$$,'14');
SELECT tests.state('sin SECURITY DEFINER en public',
  $$SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef$$,'0');
SELECT tests.state('anon sin EXECUTE sobre funciones it_*',
  $$SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'it_%' AND has_function_privilege('anon', p.oid, 'EXECUTE')$$,'0');

\o
\echo
SELECT CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END AS res, name, got, want FROM tests.results WHERE NOT ok;
SELECT count(*) FILTER (WHERE ok) AS pass, count(*) FILTER (WHERE NOT ok) AS fail, count(*) AS total FROM tests.results;
