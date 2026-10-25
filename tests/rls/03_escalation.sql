\set ON_ERROR_STOP on
\ir lib.sql
\o /dev/null
\set IDA '11111111-1111-1111-1111-111111111111'
\set IDB '22222222-2222-2222-2222-222222222222'
\set UD1 '00000000-0000-0000-0000-0000000000d1'
\set UE1 '00000000-0000-0000-0000-0000000000e1'
-- ============ D: usuario externo autenticado (sin vínculo del servidor). user_metadata afirma ser entrenador y alumno A: NO cuenta ============
SELECT tests.t('D no ve '||t, tests.jd1(),'authenticated','SELECT * FROM public.'||t,'ok:0')
  FROM unnest(ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides','ejercicio_overrides',
                    'ejercicios_custom','entrenadores','coach_calendar_assignments','coach_accounts']) t;
SELECT tests.t('D no ve datos de A aunque user_metadata.alumno_id = A', tests.jd1(),'authenticated',$$SELECT * FROM progreso WHERE alumno_id='$$||:'IDA'||$$'$$,'ok:0');
SELECT tests.t('D no ve la ficha de B aunque alumnos.auth_uid = D', tests.jd1(),'authenticated',$$SELECT * FROM alumnos WHERE id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('D no modifica la ficha de B aunque auth_uid = D', tests.jd1(),'authenticated',$$UPDATE alumnos SET onesignal_id='x' WHERE id='$$||:'IDB'||$$'$$,'ok:0');
SELECT tests.t('D no se registra en entrenadores', tests.jd1(),'authenticated','INSERT INTO entrenadores(id,email) VALUES ('''||:'UD1'||''',''d@x'')','err:42501');
SELECT tests.t('D no se registra en coach_accounts', tests.jd1(),'authenticated','INSERT INTO coach_accounts(uid) VALUES ('''||:'UD1'||''')','err:42501');
SELECT tests.t('D no inserta alumno (entrenador_principal)', tests.jd1(),'authenticated',$$INSERT INTO alumnos(nombre,entrenador_id) VALUES ('x','entrenador_principal')$$,'err:42501');
SELECT tests.t('D no inserta alumno con su UID', tests.jd1(),'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''x'','''||:'UD1'||''')','err:42501');
SELECT tests.t('D no inserta rutina/plantilla', tests.jd1(),'authenticated',$$INSERT INTO rutinas(entrenador_id,nombre) VALUES ('entrenador_principal','x')$$,'err:42501');
SELECT tests.t('D no inserta progreso para A', tests.jd1(),'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id,kg) VALUES ('$$||:'IDA'||$$','sq',1)$$,'err:42501');
SELECT tests.t('D no inserta mensaje para A', tests.jd1(),'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDA'||$$','x',false)$$,'err:42501');
SELECT tests.t('D no escribe overrides', tests.jd1(),'authenticated',$$INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('entrenador_principal','zz','x')$$,'err:42501');
SELECT tests.t('D no edita config', tests.jd1(),'authenticated',$$UPDATE config SET alias='robado'$$,'ok:0');
SELECT tests.t('D no inserta en calendario', tests.jd1(),'authenticated','INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES ('''||:'UD1'||$$','x','y',now())$$,'err:42501');
SELECT tests.t('D: it_is_coach() = false', tests.jd1(),'authenticated','SELECT 1 WHERE public.it_is_coach()','ok:0');
SELECT tests.t('D: it_alumno_id() es NULL (user_metadata ignorado)', tests.jd1(),'authenticated','SELECT 1 WHERE public.it_alumno_id() IS NOT NULL','ok:0');
-- ============ E: tiene fila en `entrenadores` escrita por el cliente (el vector P0 original) pero no está en coach_accounts ============
SELECT tests.t('E no ve alumnos', tests.je1(),'authenticated','SELECT * FROM alumnos','ok:0');
SELECT tests.t('E no ve ni su propia fila de entrenadores', tests.je1(),'authenticated','SELECT * FROM entrenadores','ok:0');
SELECT tests.t('E no actualiza su fila de entrenadores', tests.je1(),'authenticated',$$UPDATE entrenadores SET nombre='x'$$,'ok:0');
SELECT tests.t('E no reinserta/upsert su fila', tests.je1(),'authenticated','INSERT INTO entrenadores(id,email) VALUES ('''||:'UE1'||''',''x'') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email','err:42501');
SELECT tests.t('E no inserta alumno', tests.je1(),'authenticated',$$INSERT INTO alumnos(nombre,entrenador_id) VALUES ('x','entrenador_principal')$$,'err:42501');
SELECT tests.t('E no inserta alumno con su UID', tests.je1(),'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''x'','''||:'UE1'||''')','err:42501');
SELECT tests.t('E no ve rutinas', tests.je1(),'authenticated','SELECT * FROM rutinas','ok:0');
SELECT tests.t('E no actualiza rutinas', tests.je1(),'authenticated',$$UPDATE rutinas SET nombre='x'$$,'ok:0');
SELECT tests.t('E no borra progreso', tests.je1(),'authenticated','DELETE FROM progreso','ok:0');
SELECT tests.t('E no escribe overrides propios', tests.je1(),'authenticated','INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('''||:'UE1'||$$','zz','x')$$,'err:42501');
SELECT tests.t('E no edita config', tests.je1(),'authenticated',$$UPDATE config SET alias='robado'$$,'ok:0');
SELECT tests.t('E no inserta en calendario', tests.je1(),'authenticated','INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES ('''||:'UE1'||$$','x','y',now())$$,'err:42501');
SELECT tests.t('E no lee config', tests.je1(),'authenticated','SELECT * FROM config','ok:0');
-- ============ Token de alumno sin vínculo vigente (p. ej. vínculo retirado y token renovado) ============
SELECT tests.t('A sin app_metadata (renovado tras desvincular) no ve nada', tests.jwt('00000000-0000-0000-0000-0000000000a1'),'authenticated','SELECT * FROM alumnos','ok:0');
SELECT tests.t('app_metadata.alumno_id vacío no otorga acceso', tests.jwt('00000000-0000-0000-0000-0000000000d1','{"alumno_id":""}'),'authenticated','SELECT * FROM progreso','ok:0');
-- el servidor (service_role) conserva todo: la Edge Function lee alumnos y administra cuentas con este rol
SELECT tests.t('service_role lee alumnos', NULL,'service_role','SELECT * FROM alumnos','ok:3');
\o
SELECT name, got, want FROM tests.results WHERE NOT ok;
SELECT 'RESULT 03 escalación: ' || count(*) FILTER (WHERE ok) || ' pass / ' || count(*) FILTER (WHERE NOT ok) || ' fail' FROM tests.results;
