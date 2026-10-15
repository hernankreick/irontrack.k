-- =============================================================================
-- IronTrack — RLS P0, paso previo: identidad PROTEGIDA del entrenador principal.
-- Tabla de una sola fila (singleton). Los clientes (anon/authenticated) solo pueden LEER
-- su propia fila; nadie puede insertar, modificar ni borrar desde la API. La fila se carga
-- manualmente con sql/rls_p0_backfill_entrenador_principal.sql (rol postgres / SQL Editor).
-- No cambia el comportamiento de la app: es segura de aplicar sola.
-- =============================================================================
BEGIN;
CREATE TABLE IF NOT EXISTS public.coach_principal (
  singleton  boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  uid        uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_principal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.coach_principal FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.coach_principal TO authenticated;
-- service_role (Edge Functions) bypasea RLS pero necesita el privilegio de tabla; no depender de los default privileges del proyecto.
GRANT SELECT ON TABLE public.coach_principal TO service_role;
DROP POLICY IF EXISTS coach_principal_select_self ON public.coach_principal;
CREATE POLICY coach_principal_select_self ON public.coach_principal FOR SELECT TO authenticated
  USING (uid::text = auth.uid()::text);
COMMIT;
