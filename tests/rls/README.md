# Pruebas RLS (PostgreSQL local, datos ficticios)

`bash tests/rls/run.sh` levanta un PostgreSQL **efímero** (socket unix en `/tmp/rls.*`, sin TCP), carga un esquema reconstruido que emula Supabase
(`00_baseline.sql`, `00b_public_schema.sql`, `auth.uid()`/`auth.jwt()` desde `request.jwt.claims`) y el estado inseguro auditado, y ejecuta:

1. Estado inicial vulnerable reproducido (anon lee y borra).
2. Pre-vuelos de la migración B (deben abortar) y alumnos sin cuenta (no bloquean).
3. Migraciones A y B, idempotencia, y verificaciones estructurales (sin `acceso_total`, sin `true`, anon sin grants, RLS en todo, sin SECURITY DEFINER, `coach_accounts` sin escritura).
4. `02_tests.sql` aislamiento (anon, alumno A/B, entrenadores c1/c2), `03_escalation.sql` (externo con `user_metadata` falso, fila propia en `entrenadores`, token sin vínculo, service_role),
   `04_regression.sql` (operaciones legítimas de entrenador y alumno: rutinas, semanas, progreso, sesiones, chat, calendario, config, overrides).
5. Rollback de emergencia y reaplicación.

Requiere binarios de PostgreSQL 14+ (`/usr/lib/postgresql/*/bin`). Nunca se conecta a Supabase ni a producción. `M1_OVERRIDE` permite probar una variante de la migración A
(mutaciones: confirmar que la batería detecta un modelo débil). Pruebas de la Edge Function: `node scripts/test-updateAlumnoPasswordAuthz.mjs`.
No cubre: JWT firmado real, PostgREST, Realtime, Storage ni el esquema real de producción (**BLOQUEADO** sin acceso a Supabase).
