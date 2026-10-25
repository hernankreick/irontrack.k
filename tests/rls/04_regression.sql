\set ON_ERROR_STOP on
\ir lib.sql
\o /dev/null
\set IDA '11111111-1111-1111-1111-111111111111'
\set IDB '22222222-2222-2222-2222-222222222222'
\set RUTA 'aaaaaaaa-0000-0000-0000-00000000000a'
\set UC1 '00000000-0000-0000-0000-0000000000c1'
-- Operaciones LEGÍTIMAS que usa la app de main: no deben romperse. Las escrituras persisten (se comprueban al final con postgres).

-- ===== Entrenador (c1): login, alumnos, rutinas, semanas =====
SELECT tests.t('c1 login: upsert de su fila en entrenadores', tests.jc1(),'authenticated','INSERT INTO entrenadores(id,email) VALUES ('''||:'UC1'||''',''coach@test.local'') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email','ok:1');
SELECT tests.t('c1 actualiza perfil (nombre_gimnasio via PATCH)', tests.jc1(),'authenticated','UPDATE entrenadores SET nombre=''Coach X'' WHERE id='''||:'UC1'||'''','ok:1');
SELECT tests.t('c1 crea alumno (entrenador_principal)', tests.jc1(),'authenticated',$$INSERT INTO alumnos(id,nombre,email,entrenador_id) VALUES ('44444444-4444-4444-4444-444444444444','D','d2@test.local','entrenador_principal') RETURNING *$$,'ok:1');
SELECT tests.t('c1 crea alumno con su UID', tests.jc1(),'authenticated','INSERT INTO alumnos(id,nombre,email,entrenador_id) VALUES (''55555555-5555-5555-5555-555555555555'',''E'',''e2@test.local'','''||:'UC1'||''')','ok:1');
SELECT tests.t('c1 asigna rutina a alumno nuevo', tests.jc1(),'authenticated',$$INSERT INTO rutinas(id,alumno_id,entrenador_id,nombre,datos) VALUES ('eeeeeeee-0000-0000-0000-00000000000e','44444444-4444-4444-4444-444444444444','entrenador_principal','RutD','{"semana_activa":1}')$$,'ok:1');
SELECT tests.t('c1 crea plantilla', tests.jc1(),'authenticated',$$INSERT INTO rutinas(entrenador_id,nombre,es_plantilla) VALUES ('entrenador_principal','Plantilla2',true)$$,'ok:1');
SELECT tests.t('c1 edita rutina de A (days)', tests.jc1(),'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":1,"days":[{"n":1}]}' WHERE id='$$||:'RUTA'||$$'$$,'ok:1');
SELECT tests.t('c1 reinicia semana (semana_activa libre, incl. retroceder)', tests.jc1(),'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":1,"semana_reiniciada":true,"days":[{"n":1}]}' WHERE id='$$||:'RUTA'||$$'$$,'ok:1');
SELECT tests.t('c1 confirma pago de A', tests.jc1(),'authenticated',$$UPDATE alumnos SET ultimo_pago_confirmado=now() WHERE id='$$||:'IDA'||$$'$$,'ok:1');
SELECT tests.t('c1 edita ficha de A (email/nombre)', tests.jc1(),'authenticated',$$UPDATE alumnos SET nombre='A2', email='a@test.local' WHERE id='$$||:'IDA'||$$'$$,'ok:1');
SELECT tests.t('c1 carga progreso de A (PATCH/POST coach)', tests.jc1(),'authenticated',$$INSERT INTO progreso(alumno_id,ejercicio_id,kg,semana) VALUES ('$$||:'IDA'||$$','tmpx',50,1)$$,'ok:1');
SELECT tests.t('c1 borra progreso por ejercicio (reinicio)', tests.jc1(),'authenticated',$$DELETE FROM progreso WHERE alumno_id='$$||:'IDA'||$$' AND ejercicio_id='tmpx'$$,'ok:1');
SELECT tests.t('c1 borra sesiones de una semana (reinicio)', tests.jc1(),'authenticated',$$DELETE FROM sesiones WHERE alumno_id='$$||:'IDB'||$$' AND semana=1$$,'ok:1');
SELECT tests.t('c1 borra alumno nuevo', tests.jc1(),'authenticated',$$DELETE FROM alumnos WHERE id='55555555-5555-5555-5555-555555555555'$$,'ok:1');
SELECT tests.t('c1 escribe nota de A', tests.jc1(),'authenticated',$$INSERT INTO notas(alumno_id,contenido) VALUES ('$$||:'IDA'||$$','n2')$$,'ok:1');
SELECT tests.t('c1 guarda alias de pagos (config PATCH)', tests.jc1(),'authenticated',$$UPDATE config SET alias='alias.nuevo' WHERE id='pagos'$$,'ok:1');
SELECT tests.t('c1 video override: delete + insert', tests.jc1(),'authenticated',$$DELETE FROM video_overrides WHERE ejercicio_id='sq'$$,'ok:1');
SELECT tests.t('c1 video override insert', tests.jc1(),'authenticated',$$INSERT INTO video_overrides(ejercicio_id,youtube_url,entrenador_id) VALUES ('sq','http://y/3','entrenador_principal')$$,'ok:1');
SELECT tests.t('c1 nombre override upsert', tests.jc1(),'authenticated',$$INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name,name_en) VALUES ('entrenador_principal','sq','Sentadilla2','Squat') ON CONFLICT (entrenador_id,ejercicio_id) DO UPDATE SET name=EXCLUDED.name RETURNING *$$,'ok:1');
SELECT tests.t('c1 ejercicio custom insert', tests.jc1(),'authenticated',$$INSERT INTO ejercicios_custom(entrenador_id,name) VALUES ('entrenador_principal','Custom9')$$,'ok:1');
SELECT tests.t('c1 ejercicio custom update', tests.jc1(),'authenticated',$$UPDATE ejercicios_custom SET name='Custom9b' WHERE name='Custom9' AND entrenador_id='entrenador_principal'$$,'ok:1');
SELECT tests.t('c1 ejercicio custom delete', tests.jc1(),'authenticated',$$DELETE FROM ejercicios_custom WHERE name='Custom9b'$$,'ok:1');
-- calendario
SELECT tests.t('c1 calendario: asigna', tests.jc1(),'authenticated','INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES ('''||:'UC1'||$$','44444444-4444-4444-4444-444444444444','z','2026-02-01')$$,'ok:1');
SELECT tests.t('c1 calendario: lista', tests.jc1(),'authenticated','SELECT * FROM coach_calendar_assignments','ok:2');
SELECT tests.t('c1 calendario: quita', tests.jc1(),'authenticated',$$DELETE FROM coach_calendar_assignments WHERE rutina_id='z'$$,'ok:1');
-- chat (lado entrenador)
SELECT tests.t('c1 envía mensaje a A', tests.jc1(),'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDA'||$$','hola',true)$$,'ok:1');
SELECT tests.t('c1 marca leídos los del alumno', tests.jc1(),'authenticated',$$UPDATE mensajes SET leido=true WHERE alumno_id='$$||:'IDA'||$$' AND de_entrenador=false$$,'ok:0');

-- ===== Alumno A: sesión de entrenamiento, progreso, avance de semana, chat =====
SELECT tests.t('A inserta progreso (serie)', tests.ja(),'authenticated',$$INSERT INTO progreso(id,alumno_id,ejercicio_id,sets,reps,kg,fecha,semana,ciclo) VALUES (9001,'$$||:'IDA'||$$','sq',3,5,105,'2026-01-08',2,1) RETURNING id$$,'ok:1');
SELECT tests.t('A reintento idempotente (mismo id) no duplica', tests.ja(),'authenticated',$$INSERT INTO progreso(id,alumno_id,ejercicio_id,kg) VALUES (9001,'$$||:'IDA'||$$','sq',105) ON CONFLICT (id) DO NOTHING$$,'ok:0');
SELECT tests.t('A relee la serie por id', tests.ja(),'authenticated','SELECT id,alumno_id,ejercicio_id,kg,reps,semana,nota FROM progreso WHERE id=9001','ok:1');
SELECT tests.t('A guarda sesión', tests.ja(),'authenticated',$$INSERT INTO sesiones(alumno_id,rutina_id,rutina_nombre,semana,dia_idx,fecha,ciclo) VALUES ('$$||:'IDA'||$$','aaaaaaaa-0000-0000-0000-00000000000a','RutA',1,0,'2026-01-08',1) RETURNING *$$,'ok:1');
SELECT tests.t('A lee sesiones por rutina+semana (reconciliación)', tests.ja(),'authenticated',$$SELECT id,alumno_id,rutina_id,semana,dia_idx,fecha,ciclo,created_at FROM sesiones WHERE rutina_id='aaaaaaaa-0000-0000-0000-00000000000a' ORDER BY created_at,id$$,'ok:2');
SELECT tests.t('A avanza semana_activa 1→2', tests.ja(),'authenticated',$$UPDATE rutinas SET datos = datos || '{"semana_activa":2}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('A repite semana_activa 2→2 (idempotente)', tests.ja(),'authenticated',$$UPDATE rutinas SET datos = datos || '{"semana_activa":2}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('A NO retrocede semana_activa 2→1', tests.ja(),'authenticated',$$UPDATE rutinas SET datos = datos || '{"semana_activa":1}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'err:42501');
SELECT tests.t('A NO salta fuera de 1..4', tests.ja(),'authenticated',$$UPDATE rutinas SET datos = datos || '{"semana_activa":5}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'err:42501');
SELECT tests.t('A NO agrega claves operativas (ciclo_actual)', tests.ja(),'authenticated',$$UPDATE rutinas SET datos = datos || '{"semana_activa":3,"ciclo_actual":9}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'err:42501');
SELECT tests.t('A NO borra datos.days (clave de la rutina)', tests.ja(),'authenticated',$$UPDATE rutinas SET datos = datos - 'days' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'err:42501');
SELECT tests.t('A avanza 2→3', tests.ja(),'authenticated',$$UPDATE rutinas SET datos = datos || '{"semana_activa":3}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('A lee nota del día', tests.ja(),'authenticated','SELECT contenido FROM notas WHERE alumno_id='''||:'IDA'||''' ORDER BY created_at DESC LIMIT 1','ok:1');
SELECT tests.t('A lee ultimo_pago_confirmado', tests.ja(),'authenticated','SELECT ultimo_pago_confirmado FROM alumnos WHERE id='''||:'IDA'||'''','ok:1');
SELECT tests.t('A registra OneSignal id', tests.ja(),'authenticated','UPDATE alumnos SET onesignal_id=''pid-1'' WHERE id='''||:'IDA'||'''','ok:1');
SELECT tests.t('A login: busca su ficha por email', tests.ja(),'authenticated',$$SELECT id,nombre,entrenador_id FROM alumnos WHERE email='a@test.local'$$,'ok:1');
SELECT tests.t('A login: email ajeno devuelve 0 filas', tests.ja(),'authenticated',$$SELECT id FROM alumnos WHERE email='b@test.local'$$,'ok:0');
SELECT tests.t('A sube foto de progreso', tests.ja(),'authenticated','INSERT INTO fotos(alumno_id,url) VALUES ('''||:'IDA'||''',''nueva.jpg'')','ok:1');
SELECT tests.t('A borra su foto', tests.ja(),'authenticated','DELETE FROM fotos WHERE alumno_id='''||:'IDA'||''' AND url=''nueva.jpg''','ok:1');
-- chat (lado alumno)
SELECT tests.t('A envía mensaje', tests.ja(),'authenticated',$$INSERT INTO mensajes(alumno_id,texto,de_entrenador) VALUES ('$$||:'IDA'||$$','consulta',false)$$,'ok:1');
SELECT tests.t('A envía mensaje con de_entrenador NULL', tests.ja(),'authenticated',$$INSERT INTO mensajes(alumno_id,texto) VALUES ('$$||:'IDA'||$$','consulta2')$$,'ok:1');
SELECT tests.t('A cuenta no leídos del entrenador', tests.ja(),'authenticated','SELECT count(*) FROM mensajes WHERE alumno_id='''||:'IDA'||''' AND de_entrenador=true AND leido=false','ok:1');
SELECT tests.t('A marca leídos los del entrenador', tests.ja(),'authenticated','UPDATE mensajes SET leido=true WHERE alumno_id='''||:'IDA'||''' AND de_entrenador=true AND leido=false','ok:2');
SELECT tests.t('c1 marca leídos los del alumno', tests.jc1(),'authenticated',$$UPDATE mensajes SET leido=true WHERE alumno_id='$$||:'IDA'||$$' AND de_entrenador=false AND (leido IS NULL OR leido=false)$$,'ok:1');
SELECT tests.t('c1 lee conversaciones de todos sus alumnos', tests.jc1(),'authenticated',$$SELECT * FROM mensajes WHERE alumno_id IN ('$$||:'IDA'||$$','$$||:'IDB'||$$')$$,'ok:5');
\o
-- Estado final (como postgres): las escrituras legítimas persistieron y las ilegítimas no.
SELECT tests.state('rutina A: semana_activa = 3', $$SELECT (datos->>'semana_activa') FROM rutinas WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$, '3');
SELECT tests.state('rutina A conserva days (alumno no los pisó)', $$SELECT (datos->'days' IS NOT NULL)::text FROM rutinas WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$, 'true');
SELECT tests.state('PR de A intacto: kg max = 105 (propio) y 100 original sigue', $$SELECT string_agg(kg::text, ',' ORDER BY kg) FROM progreso WHERE alumno_id='11111111-1111-1111-1111-111111111111'$$, '100,105');
SELECT tests.state('progreso de B intacto', $$SELECT string_agg(kg::text, ',') FROM progreso WHERE alumno_id='22222222-2222-2222-2222-222222222222'$$, '120');
SELECT tests.state('ficha B intacta (onesignal_id sin tocar)', $$SELECT coalesce(onesignal_id,'null') FROM alumnos WHERE id='22222222-2222-2222-2222-222222222222'$$, 'null');
SELECT tests.state('config.alias = alias.nuevo (solo el entrenador)', $$SELECT alias FROM config WHERE id='pagos'$$, 'alias.nuevo');
SELECT tests.state('alumno de c2 (C) intacto', $$SELECT nombre FROM alumnos WHERE id='33333333-3333-3333-3333-333333333333'$$, 'C');
SELECT tests.state('coach_accounts sigue con 2 filas', $$SELECT count(*)::text FROM coach_accounts$$, '2');
SELECT tests.state('entrenadores: no hay filas nuevas de impostores', $$SELECT count(*)::text FROM entrenadores$$, '3');
SELECT name, got, want FROM tests.results WHERE NOT ok;
SELECT 'RESULT 04 regresión: ' || count(*) FILTER (WHERE ok) || ' pass / ' || count(*) FILTER (WHERE NOT ok) || ' fail' FROM tests.results;
