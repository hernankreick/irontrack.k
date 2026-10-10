-- Datos FICTICIOS. UIDs fijos.
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-0000000000c1','coach@test.local'),
 ('00000000-0000-0000-0000-0000000000c2','coach2@test.local'),   -- entrenador ajeno legítimo (otro gimnasio)
 ('00000000-0000-0000-0000-0000000000a1','a@test.local'),
 ('00000000-0000-0000-0000-0000000000b1','b@test.local'),
 ('00000000-0000-0000-0000-0000000000d1','intruso@test.local');   -- autenticado sin rol (ni entrenador ni alumno)
INSERT INTO entrenadores(id,email,nombre) VALUES
 ('00000000-0000-0000-0000-0000000000c1','coach@test.local','Coach'),
 ('00000000-0000-0000-0000-0000000000c2','coach2@test.local','Coach2');
-- auth_uid != id a propósito
INSERT INTO alumnos(id,nombre,email,entrenador_id,auth_uid) VALUES
 ('11111111-1111-1111-1111-111111111111','A','a@test.local','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1'),
 ('22222222-2222-2222-2222-222222222222','B','b@test.local','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000b1');
INSERT INTO rutinas(id,alumno_id,entrenador_id,nombre,datos) VALUES
 ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-0000000000c1','RutA','{"semana_activa":1}'),
 ('bbbbbbbb-0000-0000-0000-00000000000b','22222222-2222-2222-2222-222222222222','00000000-0000-0000-0000-0000000000c1','RutB','{"semana_activa":1}'),
 ('cccccccc-0000-0000-0000-00000000000c',NULL,'00000000-0000-0000-0000-0000000000c1','Plantilla','{}');
INSERT INTO progreso(alumno_id,ejercicio_id,sets,reps,kg,fecha,semana) VALUES
 ('11111111-1111-1111-1111-111111111111','sq',3,5,100,'2026-01-01',1),
 ('22222222-2222-2222-2222-222222222222','sq',3,5,120,'2026-01-01',1);
INSERT INTO sesiones(alumno_id,rutina_id,semana,dia_idx,fecha) VALUES
 ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-00000000000a',1,0,'2026-01-01'),
 ('22222222-2222-2222-2222-222222222222','bbbbbbbb-0000-0000-0000-00000000000b',1,0,'2026-01-01');
INSERT INTO fotos(alumno_id,url) VALUES ('11111111-1111-1111-1111-111111111111','a.jpg'),('22222222-2222-2222-2222-222222222222','b.jpg');
INSERT INTO mensajes(alumno_id,texto,de_entrenador,leido) VALUES
 ('11111111-1111-1111-1111-111111111111','hola A',true,false),
 ('22222222-2222-2222-2222-222222222222','hola B',true,false);
INSERT INTO notas(alumno_id,contenido) VALUES ('11111111-1111-1111-1111-111111111111','nota A'),('22222222-2222-2222-2222-222222222222','nota B');
INSERT INTO config VALUES ('pagos','alias.coach');
INSERT INTO video_overrides(entrenador_id,ejercicio_id,youtube_url) VALUES ('00000000-0000-0000-0000-0000000000c1','sq','http://y/1'),('00000000-0000-0000-0000-0000000000c2','sq2','http://y/2');
INSERT INTO ejercicio_overrides(entrenador_id,ejercicio_id,name) VALUES ('00000000-0000-0000-0000-0000000000c1','sq','Sentadilla'),('00000000-0000-0000-0000-0000000000c2','sq','Squat2');
INSERT INTO ejercicios_custom(entrenador_id,name) VALUES ('00000000-0000-0000-0000-0000000000c1','Custom1'),('00000000-0000-0000-0000-0000000000c2','Custom2');
INSERT INTO ejercicios_custom_backup_pre_fase1 SELECT * FROM ejercicios_custom;
