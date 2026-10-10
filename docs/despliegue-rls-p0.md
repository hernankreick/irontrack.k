# Despliegue RLS P0 — decisión operativa y orden exacto

**Decisión: APTO CONDICIONADO.** El código, las migraciones, el backfill, la función y el frontend pasaron todas las pruebas locales (ver "Evidencia").
Producción **no** se puede declarar apta hasta pasar el *gate* de esquema real (preflight de solo lectura, 5 min) y tener un respaldo restaurable. Todo lo demás está listo.

## Evidencia (local, datos ficticios; no es validación sobre producción)
- RLS (Postgres): 154/154 generales + 94/94 escalada/regresión; pre-vuelos, backfill (psql y SQL Editor), reversión del backfill, respaldo de políticas, idempotencia, rollback.
- Stack QA aislado (Supabase Auth real + PostgREST + frontend real): API 22/22, UI 7/7 (Chromium), guards 5/5, preflight 4/4.
- Edge Function: `index.ts` real en **Deno 2.9** (import de esm.sh resuelto como `npm:`) → 22/22 con la función servida por Deno. Sin validar: runtime Edge de Supabase (verify_jwt de plataforma), CORS desde el navegador real.
- Proyecto: 18 tests + builds de escenario Production/Preview.

## Bloqueos críticos para mañana
| # | Bloqueo | Quién | Tiempo |
|---|---|---|---|
| 1 | **Gate de esquema real**: correr `sql/rls_p0_preflight_readonly.sql` en el SQL Editor (solo lectura, sin datos personales) y pasar la tabla. Si hay `FALLA` + `BLOQUEANTE`, no se despliega hasta corregir. Desde este sandbox no se puede leer producción (la política de red deniega `ilcdexckizxtcxopfxlq.supabase.co`). | Propietario | 5 min |
| 2 | **Respaldo restaurable** (ver paso A3). Sin respaldo no se ejecuta el backfill. | Propietario | 10 min |
| 3 | **Autorización de PR + merge a main**: el frontend nuevo debe estar en Production antes de la migración 2. | Propietario | — |
| 4 | **Desplegar la Edge Function** (`supabase functions deploy update-alumno-password`): requiere CLI con sesión del propietario. | Propietario | 3 min |
| 5 | **Rotar la contraseña de Auth del entrenador** (paso B6). | Propietario | 5 min |

No son bloqueantes del funcionamiento de mañana: Previews antiguos con la URL de producción (eliminarlos), `.env` local tras `git pull`, limpieza de filas de `entrenadores` de alumnos.

## Orden exacto (ventana recomendada: esta noche o primera hora, con poco uso; ≈ 75–90 min)
**Fase A — antes de la ventana (solo lectura / respaldo)**
- A1. SQL Editor: `sql/rls_p0_preflight_readonly.sql`. Esperado: 0 filas `FALLA` con `BLOQUEANTE` (incluye: 9 alumnos `entrenador_principal`, 0 sin `auth_uid`, principal en `auth.users` y `entrenadores`, columnas/tipos usados, conflictos de unicidad del backfill).
- A2. SQL Editor: `sql/rls_p0_snapshot_policies.sql` → guardar la salida (restauración exacta de políticas, RLS y grants; imprescindible para `ejercicios_custom` y `entrenadores`).
- A3. Respaldo de datos: en *Database → Backups* confirmar que existe uno restaurable reciente (el plan puede no incluir PITR). Si no: `pg_dump "<cadena de conexión>" --schema=public --no-owner -f irontrack_backup_YYYYMMDD.sql` en tu máquina (contiene datos de alumnos: guardarlo privado, fuera del repo).
- A4. Avisar a los alumnos de una ventana breve y que abran la app de nuevo después (los que tengan la sesión guardada antes del backfill no verán videos/nombres personalizados hasta volver a ingresar).

**Fase B — ventana**
- B1. Migración 1: `supabase/migrations/20261010110000_rls_p0_coach_principal.sql` (inocua).
- B2. Backfill: `sql/rls_p0_backfill_sql_editor.sql` (un bloque, una transacción; aborta sin cambios si una precondición falla; registra ids en `rls_p0_backfill_log`).
  **Desde aquí el dashboard del frontend viejo muestra 0 alumnos: pasar inmediatamente a B3.**
- B3. PR → merge a `main` (autorizado por vos) → esperar Production **READY** (el guard exige las variables de Production: ya están). Si el build falla, no avanzar: ejecutar el rollback de B2 (abajo).
- B4. `supabase functions deploy update-alumno-password` (junto con B3: frontend nuevo envía `alumnoId`; la función vieja pedía `alumnoEmail`).
- B5. Verificación con RLS aún abierta (rollback sin riesgo de seguridad): login del entrenador, dashboard con 9 alumnos, alumno de prueba propio (alta → asignar rutina → login del alumno → serie → historial), cambio de contraseña del alumno de prueba (debe vincular `auth_uid`).
- B6. Rotar la contraseña de Auth de `entrenador@irontrack.app` (Authentication → Users → ⋯ → Send/Reset o definir contraseña) y verificar el login con la nueva. **Después** de B3 (el login viejo exigía `irontrack2024`) y **antes** de B7.
- B7. Migración 2: `supabase/migrations/20261010120000_rls_p0_lockdown.sql` (transaccional: aborta sin cambios si falta algo).
- B8. Repetir B5 + comprobar con la anon key que `alumnos`/`progreso` ya no se leen sin sesión (401/403). Cuenta real de un alumno: solo si ese alumno lo autoriza; si no, usar el alumno de prueba.
- B9. 24 h: logs de PostgREST/API por 401/403 inesperados.

## Rollback por etapa
| Falla en | Acción |
|---|---|
| B7 (durante) | Automático: nada queda aplicado. |
| Tras B7, app inutilizable | Preferir corregir hacia adelante. Emergencia: `supabase/rollback/20261010120000_rls_p0_rollback.sql` + restaurar políticas exactas con la salida de A2. |
| B2–B6 (antes de B7) | `sql/rls_p0_backfill_revert.sql` + Instant Rollback del despliegue de Production anterior (`5aeec6c`) + redeploy de la función previa. |
| B1 | `DROP TABLE public.coach_principal;` |
| B6 | La contraseña nueva no se revierte; se conserva. |

## Plan B si no hay tiempo o el preflight falla
No desplegar nada: el sistema actual sigue funcionando como hoy (con la vulnerabilidad abierta). No existe una versión parcial segura sin la migración 2,
y B2–B6 sin B7 no cierran la exposición. Si el preflight muestra fallas, pasame la tabla y se corrige localmente (≈ 30–60 min) antes de reintentar.

## Qué ven los alumnos
- Sin interrupción de acceso si se sigue el orden: la migración 2 conserva lectura de su rutina, registro de series, historial, mensajes y fotos propios, y avance de `semana_activa`.
- Sesiones/bundles antiguos: siguen funcionando para lo esencial; no cargan overrides de videos/nombres hasta recargar y volver a ingresar.
