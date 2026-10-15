-- =============================================================================
-- EXPORTACIÓN EXTERNA EN JSON (SQL Editor de Supabase, desde el iPhone). SOLO LECTURA. No requiere editar nada.
-- Devuelve 14 filas: tabla, filas, huella (md5) y datos (todo el contenido de la tabla como JSON). Copiá cada celda "datos" a una nota
-- o archivo de texto en Archivos → En mi iPhone. CONTIENE DATOS PERSONALES DE ALUMNOS: no la envíes por correo ni mensajería ni la subas a un
-- servicio compartido; guardala solo en el dispositivo (o en un almacenamiento tuyo y cifrado).
-- Verificación: la "huella" y "filas" se pueden volver a calcular con la misma consulta tras restaurar y deben coincidir.
-- Si una celda es demasiado grande para copiarla desde el iPhone: usar Table Editor → Export (CSV) para esa tabla (docs/respaldo-rls-p0.md, sección 4).
-- Restaurar (emergencia, con asistencia, y solo en una tabla VACÍA; reemplazar <tabla> y pegar el JSON entre los delimitadores):
--   INSERT INTO public.<tabla> SELECT * FROM jsonb_populate_recordset(null::public.<tabla>, $irontrack_json$ ...JSON... $irontrack_json$::jsonb);
-- =============================================================================
SELECT 'alumnos' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.alumnos t
UNION ALL
SELECT 'progreso' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.progreso t
UNION ALL
SELECT 'rutinas' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.rutinas t
UNION ALL
SELECT 'sesiones' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.sesiones t
UNION ALL
SELECT 'fotos' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.fotos t
UNION ALL
SELECT 'mensajes' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.mensajes t
UNION ALL
SELECT 'config' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.config t
UNION ALL
SELECT 'notas' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.notas t
UNION ALL
SELECT 'video_overrides' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.video_overrides t
UNION ALL
SELECT 'ejercicio_overrides' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.ejercicio_overrides t
UNION ALL
SELECT 'ejercicios_custom' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.ejercicios_custom t
UNION ALL
SELECT 'entrenadores' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.entrenadores t
UNION ALL
SELECT 'coach_calendar_assignments' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.coach_calendar_assignments t
UNION ALL
SELECT 'ejercicios_custom_backup_pre_fase1' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.ejercicios_custom_backup_pre_fase1 t
ORDER BY 1;
