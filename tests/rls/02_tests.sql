\set ON_ERROR_STOP on
\ir lib.sql
\o /dev/null
\set IDA '11111111-1111-1111-1111-111111111111'
\set IDB '22222222-2222-2222-2222-222222222222'
\set IDC '33333333-3333-3333-3333-333333333333'
\set UC1 '00000000-0000-0000-0000-0000000000c1'
\set UC2 '00000000-0000-0000-0000-0000000000c2'
\set UE1 '00000000-0000-0000-0000-0000000000e1'
-- ============ ANÓNIMO: nada privado ============
SELECT tests.t('anon SELECT '||t, NULL, 'anon', 'SELECT * FROM public.'||t, 'err:42501')
  FROM unnest(ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides','ejercicio_overrides',
    'ejercicios_custom','entrenadores','coach_calendar_assignments','ejercicios_custom_backup_pre_fase1','coach_accounts']) t;
SELECT tests.t('anon INSERT progreso', NULL,'anon',$$INSERT INTO progreso(alumno_id,ejercicio_id) VALUES ('$$||:'IDA'||$$','x')$$,'err:42501');
SELECT tests.t('anon UPDATE alumnos', NULL,'anon',$$UPDATE alumnos SET nombre='hack'$$,'err:42501');
SELECT tests.t('anon DELETE rutinas', NULL,'anon','DELETE FROM rutinas','err:42501');
SELECT tests.t('anon UPDATE ejercicio_overrides', NULL,'anon',$$UPDATE ejercicio_overrides SET name='x'$$,'err:42501');
SELECT tests.t('anon DELETE video_overrides', NULL,'anon','DELETE FROM video_overrides','err:42501');
SELECT tests.t('anon INSERT entrenadores', NULL,'anon',$$INSERT INTO entrenadores(id) VALUES (gen_random_uuid())$$,'err:42501');
SELECT tests.t('anon INSERT coach_accounts', NULL,'anon',$$INSERT INTO coach_accounts(uid) VALUES (gen_random_uuid())$$,'err:42501');
SELECT tests.t('anon no ejecuta it_is_coach()', NULL,'anon','SELECT public.it_is_coach()','err:42501');
SELECT tests.t('anon con JWT falso (app_metadata) sigue sin acceso', tests.ja(),'anon','SELECT * FROM alumnos','err:42501');

-- ============ ALUMNO A: solo lo suyo ============
SELECT tests.t('A ve solo su alumno', tests.ja(),'authenticated','SELECT * FROM alumnos','ok:1');
SELECT tests.t('A no ve alumno B', tests.ja(),'authenticated',$$SELECT * FROM alumnos WHERE id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A lee su progreso (1 fila)', tests.ja(),'authenticated','SELECT * FROM progreso','ok:1');
SELECT tests.t('A no lee progreso de B', tests.ja(),'authenticated',$$SELECT * FROM progreso WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A lee sus sesiones', tests.ja(),'authenticated','SELECT * FROM sesiones','ok:1');
SELECT tests.t('A lee su rutina (solo 1)', tests.ja(),'authenticated','SELECT * FROM rutinas','ok:1');
SELECT tests.t('A no ve plantilla del entrenador', tests.ja(),'authenticated','SELECT * FROM rutinas WHERE alumno_id IS NULL','ok:0');
SELECT tests.t('A lee fotos propias', tests.ja(),'authenticated','SELECT * FROM fotos','ok:1');
SELECT tests.t('A lee mensajes propios', tests.ja(),'authenticated','SELECT * FROM mensajes','ok:1');
SELECT tests.t('A lee nota propia', tests.ja(),'authenticated','SELECT * FROM notas','ok:1');
SELECT tests.t('A lee config', tests.ja(),'authenticated','SELECT * FROM config','ok:1');
SELECT tests.t('A lee overrides de SU entrenador (video)', tests.ja(),'authenticated','SELECT * FROM video_overrides','ok:1');
SELECT tests.t('A lee overrides de SU entrenador (nombres)', tests.ja(),'authenticated','SELECT * FROM ejercicio_overrides','ok:1');
SELECT tests.t('A lee ejercicios_custom de su entrenador', tests.ja(),'authenticated','SELECT * FROM ejercicios_custom','ok:1');
SELECT tests.t('A no lee entrenadores', tests.ja(),'authenticated','SELECT * FROM entrenadores','ok:0');
SELECT tests.t('A no lee coach_accounts', tests.ja(),'authenticated','SELECT * FROM coach_accounts','ok:0');
SELECT tests.t('A no lee calendario del entrenador', tests.ja(),'authenticated','SELECT * FROM coach_calendar_assignments','ok:0');
SELECT tests.t('A no lee el respaldo ejercicios_custom_backup', tests.ja(),'authenticated','SELECT * FROM ejercicios_custom_backup_pre_fase1','err:42501');
-- escrituras sobre B
SELECT tests.t('A no inserta progreso para B', tests.ja(),'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id,kg) VALUES ('$$||:'IDB'||$$','sq',999)$$,'err:42501');
SELECT tests.t('A no inserta sesion para B', tests.ja(),'authenticated',$$INSERT INTO sesiones(alumno_id,semana) VALUES ('$$||:'IDB'||$$',9)$$,'err:42501');
SELECT tests.t('A no actualiza progreso de B', tests.ja(),'authenticated',$$UPDATE progreso SET kg=1 WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no borra progreso de B', tests.ja(),'authenticated',$$DELETE FROM progreso WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no actualiza rutina de B', tests.ja(),'authenticated',$$UPDATE rutinas SET datos='{"x":1}' WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no actualiza alumno B', tests.ja(),'authenticated',$$UPDATE alumnos SET onesignal_id='x' WHERE id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no borra alumno B', tests.ja(),'authenticated',$$DELETE FROM alumnos WHERE id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no borra fotos de B', tests.ja(),'authenticated',$$DELETE FROM fotos WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no inserta foto para B', tests.ja(),'authenticated',$$INSERT INTO fotos(alumno_id,url) VALUES ('$$||:'IDB'||$$','x')$$,'err:42501');
SELECT tests.t('A no marca leidos de B', tests.ja(),'authenticated',$$UPDATE mensajes SET leido=true WHERE alumno_id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('A no inserta mensaje a nombre de B', tests.ja(),'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDB'||$$','x',false)$$,'err:42501');
-- PRs / historial protegidos
SELECT tests.t('A no modifica su propio progreso (PR)', tests.ja(),'authenticated','UPDATE progreso SET kg=1','ok:0');
SELECT tests.t('A no borra su propio progreso (PR)', tests.ja(),'authenticated','DELETE FROM progreso','ok:0');
SELECT tests.t('A no borra sus sesiones', tests.ja(),'authenticated','DELETE FROM sesiones','ok:0');
SELECT tests.t('A no modifica sus sesiones', tests.ja(),'authenticated','UPDATE sesiones SET semana=9','ok:0');
-- datos protegidos de la ficha / rutina
SELECT tests.t('A no cambia entrenador_id de su ficha', tests.ja(),'authenticated',$$UPDATE alumnos SET entrenador_id='entrenador_principal2'$$,'err:42501');
SELECT tests.t('A no se hace propio entrenador (UID)', tests.ja(),'authenticated','UPDATE alumnos SET entrenador_id='''||'00000000-0000-0000-0000-0000000000a1'||'''','err:42501');
SELECT tests.t('A no cambia auth_uid', tests.ja(),'authenticated','UPDATE alumnos SET auth_uid='''||'00000000-0000-0000-0000-0000000000b1'||'''','err:42501');
SELECT tests.t('A no cambia email', tests.ja(),'authenticated',$$UPDATE alumnos SET email='x@x'$$,'err:42501');
SELECT tests.t('A no cambia su nombre', tests.ja(),'authenticated',$$UPDATE alumnos SET nombre='x'$$,'err:42501');
SELECT tests.t('A no reasigna rutina a B', tests.ja(),'authenticated',$$UPDATE rutinas SET alumno_id='$$||:'IDB'||$$'$$,'err:42501');
SELECT tests.t('A no cambia entrenador_id de rutina', tests.ja(),'authenticated',$$UPDATE rutinas SET entrenador_id='x'$$,'err:42501');
SELECT tests.t('A no renombra rutina', tests.ja(),'authenticated',$$UPDATE rutinas SET nombre='x'$$,'err:42501');
SELECT tests.t('A no edita ejercicios de la rutina (days)', tests.ja(),'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":1,"days":[1]}'$$,'err:42501');
SELECT tests.t('A no borra su rutina', tests.ja(),'authenticated','DELETE FROM rutinas','ok:0');
SELECT tests.t('A no crea rutina propia', tests.ja(),'authenticated',$$INSERT INTO rutinas(alumno_id,entrenador_id,nombre) VALUES ('$$||:'IDA'||$$','entrenador_principal','x')$$,'err:42501');
SELECT tests.t('A no edita config', tests.ja(),'authenticated',$$UPDATE config SET alias='robado'$$,'ok:0');
SELECT tests.t('A no inserta override de video', tests.ja(),'authenticated',$$INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('entrenador_principal','zz','x')$$,'err:42501');
SELECT tests.t('A no pisa override del entrenador', tests.ja(),'authenticated',$$UPDATE video_overrides SET youtube_url='x'$$,'ok:0');
SELECT tests.t('A no borra overrides del entrenador', tests.ja(),'authenticated','DELETE FROM ejercicio_overrides','ok:0');
SELECT tests.t('A no inserta ejercicio custom', tests.ja(),'authenticated',$$INSERT INTO ejercicios_custom(entrenador_id,name) VALUES ('entrenador_principal','x')$$,'err:42501');
SELECT tests.t('A no hace mensaje como entrenador', tests.ja(),'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDA'||$$','fake',true)$$,'err:42501');
SELECT tests.t('A no edita texto de mensaje', tests.ja(),'authenticated',$$UPDATE mensajes SET texto='x'$$,'err:42501');
SELECT tests.t('A no borra mensajes', tests.ja(),'authenticated','DELETE FROM mensajes','ok:0');
SELECT tests.t('A no inserta en calendario', tests.ja(),'authenticated','INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES ('''||:'UC1'||$$','x','y',now())$$,'err:42501');
-- ============ ALUMNO B no puede tocar A ============
SELECT tests.t('B no lee progreso de A', tests.jb(),'authenticated',$$SELECT * FROM progreso WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:0');
SELECT tests.t('B no modifica rutina de A', tests.jb(),'authenticated',$$UPDATE rutinas SET datos='{}' WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:0');
SELECT tests.t('B no inserta sesion de A', tests.jb(),'authenticated',$$INSERT INTO sesiones(alumno_id,semana) VALUES ('$$||:'IDA'||$$',9)$$,'err:42501');
SELECT tests.t('B no actualiza alumno A', tests.jb(),'authenticated',$$UPDATE alumnos SET onesignal_id='x' WHERE id='$$||:'IDA'||$$'$$,'ok:0');
-- B tiene alumnos.auth_uid = d1 en la ficha: eso NO le da acceso a d1 (ver D), y a B solo su ficha.
SELECT tests.t('B ve solo su ficha', tests.jb(),'authenticated','SELECT * FROM alumnos','ok:1');
-- ============ ENTRENADOR c1: sus alumnos, no los de c2 ============
SELECT tests.t('c1 ve alumnos A y B (legacy)', tests.jc1(),'authenticated','SELECT * FROM alumnos','ok:2');
SELECT tests.t('c1 no ve alumno C (de c2 por UID)', tests.jc1(),'authenticated',$$SELECT * FROM alumnos WHERE id='$$||:'IDC'||$$'$$,'ok:0');
SELECT tests.t('c1 lee progreso de A y B', tests.jc1(),'authenticated','SELECT * FROM progreso','ok:2');
SELECT tests.t('c1 lee rutinas A, B y plantilla (no C)', tests.jc1(),'authenticated','SELECT * FROM rutinas','ok:3');
SELECT tests.t('c1 lee sesiones, fotos, mensajes, notas', tests.jc1(),'authenticated','SELECT 1 FROM sesiones UNION ALL SELECT 1 FROM fotos UNION ALL SELECT 1 FROM mensajes UNION ALL SELECT 1 FROM notas','ok:8');
SELECT tests.t('c1 lee su fila de entrenadores', tests.jc1(),'authenticated','SELECT * FROM entrenadores','ok:1');
SELECT tests.t('c1 lee su calendario (no el de c2)', tests.jc1(),'authenticated','SELECT * FROM coach_calendar_assignments','ok:1');
SELECT tests.t('c1 lee overrides/custom de su alcance', tests.jc1(),'authenticated','SELECT 1 FROM video_overrides UNION ALL SELECT 1 FROM ejercicio_overrides UNION ALL SELECT 1 FROM ejercicios_custom','ok:3');
SELECT tests.t('c1 lee config', tests.jc1(),'authenticated','SELECT * FROM config','ok:1');
SELECT tests.t('c1 no lee progreso de C', tests.jc1(),'authenticated',$$SELECT * FROM progreso WHERE alumno_id='$$||:'IDC'||$$'$$,'ok:0');
SELECT tests.t('c1 no lee rutina de C', tests.jc1(),'authenticated',$$SELECT * FROM rutinas WHERE alumno_id='$$||:'IDC'||$$'$$,'ok:0');
SELECT tests.t('c1 no inserta progreso para C', tests.jc1(),'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id,kg) VALUES ('$$||:'IDC'||$$','sq',1)$$,'err:42501');
SELECT tests.t('c1 no inserta rutina para C', tests.jc1(),'authenticated',$$INSERT INTO rutinas(alumno_id,entrenador_id,nombre) VALUES ('$$||:'IDC'||$$','entrenador_principal','x')$$,'err:42501');
SELECT tests.t('c1 no actualiza alumno C', tests.jc1(),'authenticated',$$UPDATE alumnos SET nombre='x' WHERE id='$$||:'IDC'||$$'$$,'ok:0');
SELECT tests.t('c1 no borra rutina de C', tests.jc1(),'authenticated',$$DELETE FROM rutinas WHERE alumno_id='$$||:'IDC'||$$'$$,'ok:0');
SELECT tests.t('c1 no crea alumno de c2', tests.jc1(),'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''x'','''||:'UC2'||''')','err:42501');
SELECT tests.t('c1 no roba alumno de c2 (UPDATE entrenador_id)', tests.jc1(),'authenticated','UPDATE alumnos SET entrenador_id='''||:'UC1'||''' WHERE id='''||:'IDC'||'''','ok:0');
SELECT tests.t('c1 no inserta en calendario de c2', tests.jc1(),'authenticated','INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES ('''||:'UC2'||$$','x','y',now())$$,'err:42501');
SELECT tests.t('c1 no borra override de c2', tests.jc1(),'authenticated',$$DELETE FROM video_overrides WHERE ejercicio_id='sq2'$$,'ok:0');
-- c2: ve su alumno C y el pool legacy (comportamiento documentado: 'entrenador_principal' es compartido entre entrenadores autorizados)
SELECT tests.t('c2 ve C y el pool legacy (A y B)', tests.jc2(),'authenticated','SELECT * FROM alumnos','ok:3');
SELECT tests.t('c2 no ve el calendario de c1', tests.jc2(),'authenticated',$$SELECT * FROM coach_calendar_assignments WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:0');
-- Nadie (ni entrenadores) puede escribir coach_accounts desde la API
SELECT tests.t('c1 no inserta en coach_accounts', tests.jc1(),'authenticated','INSERT INTO coach_accounts(uid) VALUES ('''||:'UE1'||''')','err:42501');
SELECT tests.t('c1 no borra coach_accounts', tests.jc1(),'authenticated','DELETE FROM coach_accounts','err:42501');
SELECT tests.t('c1 no actualiza coach_accounts', tests.jc1(),'authenticated','UPDATE coach_accounts SET created_at=now()','err:42501');
SELECT tests.t('c1 solo ve su propia fila de coach_accounts', tests.jc1(),'authenticated','SELECT * FROM coach_accounts','ok:1');
SELECT tests.t('c1 no da de alta a otro en entrenadores', tests.jc1(),'authenticated','INSERT INTO entrenadores(id,email) VALUES ('''||:'UE1'||''',''x@x'')','err:42501');
SELECT tests.t('c1 no lee la fila de entrenadores de c2', tests.jc1(),'authenticated','SELECT * FROM entrenadores WHERE id='''||:'UC2'||'''','ok:0');
SELECT tests.t('c1 no lee el respaldo (sin grants)', tests.jc1(),'authenticated','SELECT * FROM ejercicios_custom_backup_pre_fase1','err:42501');
\o
SELECT name, got, want FROM tests.results WHERE NOT ok;
SELECT 'RESULT 02 aislamiento: ' || count(*) FILTER (WHERE ok) || ' pass / ' || count(*) FILTER (WHERE NOT ok) || ' fail' FROM tests.results;
