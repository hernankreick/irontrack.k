\set ON_ERROR_STOP on
\ir lib.sql
-- Escenario: el cliente antiguo creó filas en entrenadores para alumnos (upsert de sesión). Se simulan como superusuario.
INSERT INTO entrenadores(id,email) VALUES ('00000000-0000-0000-0000-0000000000a1','a@test.local');
\o /dev/null
-- ============ Escalada: fila de entrenadores de un alumno NO otorga privilegios ============
SELECT tests.t('A edita config', :UA,'authenticated',$$UPDATE config SET alias='robado'$$,'ok:0');
SELECT tests.t('A inserta ejercicio_override propio', :UA,'authenticated','INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('||:QUA||$$,'z','x')$$,'err:42501');
SELECT tests.t('A inserta video_override propio', :UA,'authenticated','INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('||:QUA||$$,'z','x')$$,'err:42501');
SELECT tests.t('A inserta ejercicio custom propio', :UA,'authenticated','INSERT INTO ejercicios_custom(entrenador_id,name) VALUES ('||:QUA||$$,'x')$$,'err:42501');
SELECT tests.t('A inserta plantilla propia', :UA,'authenticated','INSERT INTO rutinas(entrenador_id,nombre) VALUES ('||:QUA||$$,'x')$$,'err:42501');
SELECT tests.t('A inserta alumno propio', :UA,'authenticated','INSERT INTO alumnos(nombre,entrenador_id) VALUES (''x'','||:QUA||')','err:42501');
SELECT tests.t('A re-inserta su fila en entrenadores (upsert del cliente)', :UA,'authenticated','INSERT INTO entrenadores(id,email) VALUES ('||:QUA||$$,'a@test.local') ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email$$,'err:42501');
SELECT tests.t('B (sin fila) intenta crear fila de entrenador', :UB,'authenticated','INSERT INTO entrenadores(id,email) VALUES ('||:QUB||$$,'b@test.local')$$,'err:42501');
-- ============ coach_principal: inmutable desde la API ============
SELECT tests.t('anon lee coach_principal', NULL,'anon','SELECT * FROM coach_principal','err:42501');
SELECT tests.t('A lee coach_principal (no ve fila)', :UA,'authenticated','SELECT * FROM coach_principal','ok:0');
SELECT tests.t('D lee coach_principal (no ve fila)', :D1,'authenticated','SELECT * FROM coach_principal','ok:0');
SELECT tests.t('principal lee solo su fila', :C1,'authenticated','SELECT * FROM coach_principal','ok:1');
SELECT tests.t('A inserta coach_principal', :UA,'authenticated','INSERT INTO coach_principal(uid) VALUES ('||:QUA||')','err:42501');
SELECT tests.t('C2 inserta coach_principal', :C2,'authenticated','INSERT INTO coach_principal(uid) VALUES ('||:QC2||')','err:42501');
SELECT tests.t('C2 modifica coach_principal', :C2,'authenticated','UPDATE coach_principal SET uid='||:QC2,'err:42501');
SELECT tests.t('C2 borra coach_principal', :C2,'authenticated','DELETE FROM coach_principal','err:42501');
SELECT tests.t('el propio principal no puede modificarla', :C1,'authenticated','UPDATE coach_principal SET uid='||:QC2,'err:42501');
SELECT tests.t('el propio principal no puede borrarla', :C1,'authenticated','DELETE FROM coach_principal','err:42501');
SELECT tests.t('el propio principal no puede insertar otra', :C1,'authenticated','INSERT INTO coach_principal(uid) VALUES ('||:QC2||')','err:42501');
SELECT tests.state('estado: coach_principal intacta', $$SELECT uid::text FROM coach_principal$$, '00000000-0000-0000-0000-0000000000c1');
-- ============ config: solo el principal ============
SELECT tests.t('C2 (entrenador no principal) edita config', :C2,'authenticated',$$UPDATE config SET alias='c2'$$,'ok:0');
SELECT tests.t('D edita config', :D1,'authenticated',$$UPDATE config SET alias='d'$$,'ok:0');
SELECT tests.t('anon edita config', NULL,'anon',$$UPDATE config SET alias='x'$$,'err:42501');
SELECT tests.t('nadie inserta config (A)', :UA,'authenticated',$$INSERT INTO config VALUES ('otra','x')$$,'err:42501');
SELECT tests.t('nadie inserta config (principal: sin grant)', :C1,'authenticated',$$INSERT INTO config VALUES ('otra','x')$$,'err:42501');
SELECT tests.t('nadie borra config (principal: sin grant)', :C1,'authenticated','DELETE FROM config','err:42501');
SELECT tests.t('principal edita config', :C1,'authenticated',$$UPDATE config SET alias='principal'$$,'ok:1');
SELECT tests.t('C2 lee config (es entrenador)', :C2,'authenticated','SELECT * FROM config','ok:1');
SELECT tests.t('A lee config (alumno vinculado)', :UA,'authenticated','SELECT * FROM config','ok:1');
SELECT tests.t('D no lee config', :D1,'authenticated','SELECT * FROM config','ok:0');
SELECT tests.state('estado: config solo cambió el principal', $$SELECT alias FROM config$$, 'principal');
-- ============ rutinas.datos: solo semana_activa, sin retrocesos ============
SELECT tests.t('A avanza 1->2', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','2') WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('A repite 2->2 (idempotente)', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','2') WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('A avanza 2->4 (salto permitido)', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','4')$$,'ok:1');
SELECT tests.t('A retrocede 4->3', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','3')$$,'err:42501');
SELECT tests.t('A retrocede a 1', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','1')$$,'err:42501');
SELECT tests.t('A semana fuera de rango (5)', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','5')$$,'err:42501');
SELECT tests.t('A semana 0', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','0')$$,'err:42501');
SELECT tests.t('A semana como texto', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','"4"')$$,'err:42501');
SELECT tests.t('A semana decimal', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','4.5')$$,'err:42501');
SELECT tests.t('A semana null', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','null')$$,'err:42501');
SELECT tests.t('A borra semana_activa', :UA,'authenticated',$$UPDATE rutinas SET datos=datos - 'semana_activa'$$,'err:42501');
SELECT tests.t('A agrega otra clave a datos', :UA,'authenticated',$$UPDATE rutinas SET datos=datos || '{"days":[1]}'$$,'err:42501');
SELECT tests.t('A semana válida + otra clave', :UA,'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":4,"days":[{"x":1}]}'$$,'err:42501');
SELECT tests.t('A reemplaza datos completo', :UA,'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":4,"owned":true}'$$,'err:42501');
SELECT tests.t('A pone semana_reiniciada', :UA,'authenticated',$$UPDATE rutinas SET datos=datos || '{"semana_reiniciada":true}'$$,'err:42501');
SELECT tests.t('A datos = array', :UA,'authenticated',$$UPDATE rutinas SET datos='[4]'$$,'err:42501');
SELECT tests.t('A datos = null', :UA,'authenticated',$$UPDATE rutinas SET datos=NULL$$,'err:42501');
SELECT tests.t('A cambia nombre + semana', :UA,'authenticated',$$UPDATE rutinas SET nombre='x', datos=jsonb_set(datos,'{semana_activa}','4')$$,'err:42501');
SELECT tests.t('A cambia alumno_id', :UA,'authenticated',$$UPDATE rutinas SET alumno_id='22222222-2222-2222-2222-222222222222'$$,'err:42501');
SELECT tests.t('B modifica rutina de A', :UB,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','4') WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:0');
SELECT tests.t('B avanza su propia rutina 1->3', :UB,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','3') WHERE id='bbbbbbbb-0000-0000-0000-00000000000b'$$,'ok:1');
SELECT tests.t('A no toca la plantilla del coach', :UA,'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":2}' WHERE alumno_id IS NULL$$,'ok:0');
SELECT tests.state('estado: rutina A quedó en semana 4 sin otras claves', $$SELECT datos::text FROM rutinas WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$, '{"semana_activa": 4}');
SELECT tests.t('coach reinicia semana a 1 y edita días', :C1,'authenticated',$$UPDATE rutinas SET datos='{"semana_activa":1,"days":[{"n":1}],"semana_reiniciada":true}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.t('A avanza tras reinicio 1->2', :UA,'authenticated',$$UPDATE rutinas SET datos=jsonb_set(datos,'{semana_activa}','2') WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:1');
SELECT tests.state('estado: coach conserva days tras avance del alumno', $$SELECT (datos->'days')::text FROM rutinas WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$, '[{"n": 1}]');
SELECT tests.t('C2 no modifica rutina de A', :C2,'authenticated',$$UPDATE rutinas SET datos='{}' WHERE id='aaaaaaaa-0000-0000-0000-00000000000a'$$,'ok:0');
SELECT tests.t('service_role puede corregir datos', NULL,'service_role',$$UPDATE rutinas SET datos='{"semana_activa":1}' WHERE id='bbbbbbbb-0000-0000-0000-00000000000b'$$,'ok:1');
-- ============ Acceso cruzado adicional ============
SELECT tests.t('B no lee mensajes de A', :UB,'authenticated',$$SELECT * FROM mensajes WHERE alumno_id='11111111-1111-1111-1111-111111111111'$$,'ok:0');
SELECT tests.t('B no lee fotos de A', :UB,'authenticated',$$SELECT * FROM fotos WHERE alumno_id='11111111-1111-1111-1111-111111111111'$$,'ok:0');
SELECT tests.t('B no lee notas de A', :UB,'authenticated',$$SELECT * FROM notas WHERE alumno_id='11111111-1111-1111-1111-111111111111'$$,'ok:0');
SELECT tests.t('A (con fila en entrenadores) no lee alumnos de otros', :UA,'authenticated','SELECT * FROM alumnos','ok:1');
SELECT tests.t('A (con fila en entrenadores) no ve progreso ajeno', :UA,'authenticated',$$SELECT * FROM progreso WHERE alumno_id='22222222-2222-2222-2222-222222222222'$$,'ok:0');
SELECT tests.state('it_is_entrenador(A) = false', $$SELECT tests.x('00000000-0000-0000-0000-0000000000a1','authenticated','SELECT 1 WHERE public.it_is_entrenador()')$$, 'ok:0');
SELECT tests.state('it_is_entrenador(C2) = true', $$SELECT tests.x('00000000-0000-0000-0000-0000000000c2','authenticated','SELECT 1 WHERE public.it_is_entrenador()')$$, 'ok:1');
SELECT tests.state('it_is_principal(C2) = false', $$SELECT tests.x('00000000-0000-0000-0000-0000000000c2','authenticated','SELECT 1 WHERE public.it_is_principal()')$$, 'ok:0');
SELECT tests.state('it_is_principal(C1) = true', $$SELECT tests.x('00000000-0000-0000-0000-0000000000c1','authenticated','SELECT 1 WHERE public.it_is_principal()')$$, 'ok:1');
-- Un entrenador no puede degradar al principal vinculándolo como alumno
SELECT tests.t('C2 inserta alumno con auth_uid=principal', :C2,'authenticated','INSERT INTO alumnos(nombre,entrenador_id,auth_uid) VALUES (''v'','||:QC2||','||:QC1||')','ok:1');
SELECT tests.state('principal sigue siendo principal', $$SELECT tests.x('00000000-0000-0000-0000-0000000000c1','authenticated','SELECT 1 WHERE public.it_is_principal()')$$, 'ok:1');
SELECT tests.t('principal sigue pudiendo editar config', :C1,'authenticated',$$UPDATE config SET alias='p2'$$,'ok:1');
SELECT tests.t('service_role actualiza mensajes', NULL,'service_role',$$UPDATE mensajes SET leido=true$$,'ok:2');
SELECT tests.t('service_role actualiza alumnos (edge fn)', NULL,'service_role',$$UPDATE alumnos SET onesignal_id='srv'$$,'ok:3');
\o
\echo
SELECT 'FAIL' AS res, name, got, want FROM tests.results WHERE NOT ok;
SELECT count(*) FILTER (WHERE ok) AS pass, count(*) FILTER (WHERE NOT ok) AS fail, count(*) AS total FROM tests.results;
