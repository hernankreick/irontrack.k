-- PRESCRIPCION-COPIAS v1 — 3) ROLLBACK (ESCRITURA; solo con autorizacion del dueño). Borra la tabla y TODAS las copias guardadas (no hay otra fuente de ellas):
-- respaldar antes:  select * from public.prescripcion_copias;
DROP TABLE IF EXISTS public.prescripcion_copias;
NOTIFY pgrst, 'reload schema';
