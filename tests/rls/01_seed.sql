-- Datos FICTICIOS. UIDs fijos.
--  c1 = entrenador (en coach_accounts), c2 = otro entrenador legítimo, a1/b1 = cuentas de alumnos A/B vinculadas por app_metadata,
--  d1 = usuario autenticado externo (sin vínculo), e1 = cuenta con fila en `entrenadores` pero NO en coach_accounts (impostor).
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-0000000000c1','coach@test.local','{}','{}'),
 ('00000000-0000-0000-0000-0000000000c2','coach2@test.local','{}','{}'),
 ('00000000-0000-0000-0000-0000000000a1','a@test.local','{"alumno_id":"11111111-1111-1111-1111-111111111111"}','{}'),
 ('00000000-0000-0000-0000-0000000000b1','b@test.local','{"alumno_id":"22222222-2222-2222-2222-222222222222"}','{}'),
 ('00000000-0000-0000-0000-0000000000d1','intruso@test.local','{}','{"role":"entrenador","alumno_id":"11111111-1111-1111-1111-111111111111"}'),
 ('00000000-0000-0000-0000-0000000000e1','impostor@test.local','{}','{}');
INSERT INTO entrenadores(id,email,nombre) VALUES
 ('00000000-0000-0000-0000-0000000000c1','coach@test.local','Coach'),
 ('00000000-0000-0000-0000-0000000000c2','coach2@test.local','Coach2'),
 ('00000000-0000-0000-0000-0000000000e1','impostor@test.local','Impostor');   -- fila escrita por el cliente: NO otorga nada
-- alumnos A y B: modelo legacy de main (entrenador_principal); C: de c2 por UID explícito. auth_uid != id y apunta a cuentas ajenas a propósito.
INSERT INTO alumnos(id,nombre,email,entrenador_id,auth_uid) VALUES
 ('11111111-1111-1111-1111-111111111111','A','a@test.local','entrenador_principal',NULL),
 ('22222222-2222-2222-2222-222222222222','B','b@test.local','entrenador_principal','00000000-0000-0000-0000-0000000000d1'),
 ('33333333-3333-3333-3333-333333333333','C','c@test.local','00000000-0000-0000-0000-0000000000c2',NULL);
INSERT INTO rutinas(id,alumno_id,entrenador_id,nombre,datos) VALUES
 ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','entrenador_principal','RutA','{"semana_activa":1,"days":[]}'),
 ('bbbbbbbb-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','entrenador_principal','RutB','{"semana_activa":1}'),
 ('dddddddd-0000-0000-0000-00000000000d','33333333-3333-3333-3333-333333333333','00000000-0000-0000-0000-0000000000c2','RutC','{"semana_activa":2}'),
 ('cccccccc-0000-0000-0000-00000000000c',NULL,'entrenador_principal','Plantilla','{}');
INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) VALUES
 ('11111111-1111-1111-1111-111111111111','sq',3,5,100,'2026-01-01',1),
 ('22222222-2222-2222-2222-222222222222','sq',3,5,120,'2026-01-01',1),
 ('33333333-3333-3333-3333-333333333333','sq',3,5,90,'2026-01-01',1);
INSERT INTO sesiones(alumno_id,rutina_id,semana,dia_idx,fecha) VALUES
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a',1,0,'2026-01-01'),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-00000000000b',1,0,'2026-01-01');
INSERT INTO fotos(alumno_id,url) VALUES ('11111111-1111-1111-1111-111111111111','a.jpg'),('22222222-2222-2222-2222-222222222222','b.jpg');
INSERT INTO mensajes(alumno_id,texto,de_entrenador,leido) VALUES
 ('11111111-1111-1111-1111-111111111111','hola A',true,false),
 ('22222222-2222-2222-2222-222222222222','hola B',true,false);
INSERT INTO notas(alumno_id,contenido) VALUES ('11111111-1111-1111-1111-111111111111','nota A'),('22222222-2222-2222-2222-222222222222','nota B');
INSERT INTO config VALUES ('pagos','alias.coach');
INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('entrenador_principal','sq','http://y/1'),('00000000-0000-0000-0000-0000000000c2','sq2','http://y/2');
INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('entrenador_principal','sq','Sentadilla'),('00000000-0000-0000-0000-0000000000c2','sq','Squat2');
INSERT INTO ejercicios_custom(entrenador_id,name) VALUES ('entrenador_principal','Custom1'),('00000000-0000-0000-0000-0000000000c2','Custom2');
INSERT INTO ejercicios_custom_backup_pre_fase1 SELECT * FROM ejercicios_custom;
INSERT INTO coach_calendar_assignments(entrenador_id,alumno_id,rutina_id,fecha) VALUES
 ('00000000-0000-0000-0000-0000000000c1','11111111-1111-1111-1111-111111111111','x','2026-01-01'),
 ('00000000-0000-0000-0000-0000000000c2','33333333-3333-3333-3333-333333333333','y','2026-01-01');
