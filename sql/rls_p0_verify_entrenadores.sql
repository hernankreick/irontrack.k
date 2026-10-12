-- =============================================================================
-- VERIFICACIÓN PREVIA A LA MIGRACIÓN 2 — filas de `entrenadores` que otorgan privilegios. SOLO LECTURA, no requiere editar nada, solo conteos.
-- Con la política anterior (abierta) cualquier cuenta autenticada pudo crearse una fila en `entrenadores`; esa fila da privilegios de entrenador
-- (salvo que la cuenta sea alumno). La migración 2 cierra el alta, pero NO borra filas ya creadas.
-- Ejecutar después del backfill (B2) y ANTES de la migración 2 (B7):
--   principal = 1, otras_con_privilegios = 0 (o exactamente los entrenadores legítimos que conozcas).
--   vinculadas_a_alumnos son filas de alumnos creadas por el cliente antiguo: no otorgan privilegios (se pueden borrar a mano después).
-- Si otras_con_privilegios > 0 y no las reconocés: NO CONTINUAR a B7 (pedir asistencia para revisarlas).
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.entrenadores) AS filas_entrenadores,
  (SELECT count(*) FROM public.entrenadores e WHERE EXISTS (SELECT 1 FROM public.coach_principal cp WHERE cp.uid::text = e.id::text)) AS principal,
  (SELECT count(*) FROM public.entrenadores e WHERE EXISTS (SELECT 1 FROM public.alumnos a WHERE a.auth_uid::text = e.id::text)) AS vinculadas_a_alumnos,
  (SELECT count(*) FROM public.entrenadores e
    WHERE NOT EXISTS (SELECT 1 FROM public.coach_principal cp WHERE cp.uid::text = e.id::text)
      AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.auth_uid::text = e.id::text)) AS otras_con_privilegios;
