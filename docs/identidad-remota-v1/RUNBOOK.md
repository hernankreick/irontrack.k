# Identidad remota v1 — runbook de migración y activación

Estado: **preparado, NO ejecutado en Supabase**. Nada de esto se corre sin autorización del dueño. Los archivos SQL se ejecutaron completos contra un **PostgreSQL local descartable** (ver «Validación en PostgreSQL local» al final); eso NO equivale a Supabase. El esquema real ya fue inspeccionado en solo lectura por el dueño (tablas normales, PK uuid, sin triggers ni publicaciones, RLS con la política permisiva `acceso_total`, cuya corrección es de otro carril).

Archivos (en `docs/` porque `sql/` está bloqueado para agentes; el dueño los copia a `sql/` si decide aplicarlos):
`0_preflight.sql` (lectura) · `1_migracion.sql` (escritura) · `2_verificacion.sql` (lectura + guía de prueba RLS) · `3_rollback.sql` (escritura).

## Cambios respecto de la propuesta inicial (auditoría estática)
| Punto | Antes | Ahora |
|---|---|---|
| CHECK | `ADD CONSTRAINT` validando toda la tabla bajo `ACCESS EXCLUSIVE` | `NOT VALID` + `VALIDATE CONSTRAINT` (no bloquea lecturas/escrituras) |
| Índices | `CREATE UNIQUE INDEX` dentro de la transacción (bloquea escrituras de `sesiones`/`progreso`) | `CREATE INDEX CONCURRENTLY` fuera de transacción |
| Bloqueos | sin límites | `lock_timeout 3s`, `statement_timeout 60s` (falla rápido, se reintenta) |
| PostgREST | no contemplado | `NOTIFY pgrst, 'reload schema'` (sin recarga responde `PGRST204`) |
| Preflight | 4 consultas | 12 (vistas, publicaciones/Realtime, grants por columna, duplicados, transacciones largas, nombres en uso) |
| Verificación | 3 consultas | 8 (restricciones validadas, índices válidos, sin FK, RLS idéntica) + guía de prueba real de RLS |
| Código | un 23505 sobre `sesiones_sesion_uid_uidx` con clave fecha/semana distinta dejaba la finalización sin confirmar en cada reintento | `persistSessionConfirmed` confirma también por `sesion_uid` idéntico (solo actúa con identidad en el payload, es decir, con bandera activa) |

## Qué se pudo y qué no verificar
Verificado en el repo (pruebas con servidor simulado): payloads idénticos con bandera apagada; degradación a esquema antiguo; idempotencia por opId; duplicados de sesión; hidratación; estadísticas sin cambios; coherencia del contrato SQL con el código (`scripts/test-identidadRemotaSql.mjs`).
**No verificable sin el esquema real** (las simulaciones NO equivalen a una prueba real de RLS): tipos reales, RLS/políticas y grants por columna, triggers, vistas, RPC con lista fija de columnas, publicaciones Realtime, tamaño de tablas, sesiones duplicadas históricas. Se cubren con `0_preflight.sql` y `2_verificacion.sql` (V8).

## Procedimiento (humano, en este orden)
1. **Entorno de prueba** (copia/branch de Supabase): `0_preflight.sql` → comparar con GO/NO-GO → `1_migracion.sql` (pasos A, B, C) → `2_verificacion.sql` → prueba manual V8 con un alumno de prueba.
2. **Producción**: repetir 0 → 1 → 2 fuera de horario de entrenamiento. Guardar las salidas del preflight.
3. **Activación**: en Vercel (solo Preview primero) definir `VITE_IRONTRACK_IDENTIDAD_REMOTA=migracion-aplicada:identidad-remota-v1` y redeployar. Es variable de **build**: aplica al siguiente deploy; clientes con el bundle anterior siguen sin enviar campos hasta recargar.
4. **Observación (24 h)**: crear una sesión de prueba y comprobar en la base que `progreso` y `sesiones` guardan `sesion_uid`/`bloque`/`pos`/`identidad_v`; vigilar errores 4xx de `progreso`/`sesiones` en los logs de Supabase (PGRST204, 23514, 23505 sobre `sesiones_sesion_uid_uidx`).

## Desactivación rápida
1. Quitar (o cambiar) `VITE_IRONTRACK_IDENTIDAD_REMOTA` en Vercel y redeployar (o *Instant Rollback* al deploy anterior). Desde ese momento los payloads vuelven a ser los antiguos; los datos ya guardados siguen siendo válidos y la lectura es pasiva.
2. Solo si hay un problema en la base: `3_rollback.sql` (respaldar antes las filas con identidad). Un cliente con la bandera aún activa recibe `PGRST204` y reenvía sin campos nuevos.
3. Si el problema es solo la unicidad: `DROP INDEX CONCURRENTLY` de `sesiones_sesion_uid_uidx` (rollback parcial).

## Criterios GO / NO-GO (migración)
GO solo si **todas** se cumplen en preflight:
- P1 tablas reales (`relkind = r`); P2 columnas nuevas ausentes (o ya con el tipo exacto).
- P3 `progreso.id` acepta el opId (uuid/text) y los tipos coinciden con el contrato.
- P4 sin objetos con los nombres previstos y `progreso_pkey` sobre `id`.
- P5 sin triggers que reescriban filas/columnas por lista fija; P6 vistas dependientes revisadas.
- P7 RLS activa con políticas por fila sin lista de columnas; P8 sin grants solo-por-columna (o con plan para agregar las nuevas).
- P9 ningún RPC que inserte en `progreso`/`sesiones` con lista fija usado por IronTrack (o confirmado que no afecta); P10 Realtime sin lista de columnas (o ajustada).
- P12 sin transacciones largas.
NO-GO ante cualquier desvío no explicado. Post-migración GO a activar solo si V1–V7 dan lo ESPERADO y V8 (a–f) pasa con un alumno real de prueba.

## Validación en PostgreSQL local (no es Supabase)
`npm run test:all` ejecuta, si hay binarios de PostgreSQL (`initdb`, `postgres` y el cliente de línea de comandos; en Debian/Ubuntu `/usr/lib/postgresql/*/bin`, o la variable `IRONTRACK_PG_BIN`), un clúster **descartable**: socket Unix en un directorio temporal, sin TCP, entorno limpio de variables `PG*`/`SUPABASE_*` (ver `scripts/lib/pgLocal.mjs`). Sin binarios, las suites se **omiten** y lo dicen: no cuentan como ejecutadas.
- `scripts/test-pgIdentidadRemotaMigracion.mjs`: preflight, migración (A/B/C), verificación V1-V7, CHECK, índices parciales, 23505, históricos sin backfill, reejecución, rollback, segunda migración, rollback parcial, índice inválido tras un `CONCURRENTLY` fallido, `lock_timeout` con una transacción larga y emisión de `NOTIFY pgrst`.
- `scripts/test-pgIdentidadRemotaRls.mjs`: roles ficticios con la política permisiva actual, con una política por fila **solo de prueba** (no es la corrección de RLS), con grants solo por columna, y esquema antiguo / caché de esquema vieja.
- `scripts/test-pgIdentidadRemotaFlujo.mjs`: flujo completo del cliente real (offline, recarga, reintentos, finalización, hidratación, vínculo serie-sesión, estadísticas, dos alumnos, dos sesiones el mismo día, semana congelada, ciclo, históricos, bandera, esquema antiguo) contra esa base.
- `scripts/test-pgLocalAislamiento.mjs`: demuestra que el arnés no abre TCP, no se puede redirigir por variables de entorno y que el hook y `settings.json` siguen bloqueando el cliente SQL y la CLI de Supabase directos.

**Sigue sin probarse (requiere un branch/proyecto de Supabase de prueba):** PostgREST real (recarga del esquema, `PGRST204`, `return=representation`), JWT/`auth.uid()` reales, la política RLS real y los grants reales de producción. Se cubren con `0_preflight.sql`, `2_verificacion.sql` y el paso V8.

### Hallazgos de la validación local
1. **`0_preflight.sql` P9 abortaba** con `"array_agg" is an aggregate function` (PostgreSQL evaluaba `pg_get_functiondef` sobre agregados de `pg_catalog` antes de filtrar el esquema). Corregido con un CTE `MATERIALIZED` y `prokind in ('f','p')`.
2. **Grants solo por columna (P8 > 0) rompen también los inserts ANTIGUOS tras migrar**, no solo la bandera: con `Prefer: return=representation` PostgREST hace `RETURNING *` e incluye las columnas nuevas, y sin `SELECT` sobre ellas el insert falla con `42501`. Si P8 da más de 0: agregar `SELECT` (e `INSERT`) de las 5 columnas nuevas **antes** de correr `1_migracion.sql`, no solo antes de activar la bandera.
3. Un `CREATE INDEX CONCURRENTLY` que falla por duplicados deja un índice inválido y `IF NOT EXISTS` lo saltea al reintentar: hay que borrarlo con `DROP INDEX CONCURRENTLY` (V6 lo detecta). Cubierto por prueba.
4. `CREATE INDEX CONCURRENTLY` espera a las transacciones previas: con una sesión larga abierta el paso B queda esperando (no falla). Revisar P12 antes de correrlo.

## Estado del preflight REAL (Supabase de producción) — actualizado tras el PR #191
| Control | Estado |
|---|---|
| P1–P12 contra Supabase | **No ejecutado por el agente**: la sesión no tiene credenciales ni herramienta de solo lectura hacia Supabase (el hook y `settings.json` bloquean `psql`/`supabase`/`curl` a `supabase.co` y los `.env`). Lo único comprobado fuera de este repo es lo que informó el dueño (tablas normales, PK uuid, sin triggers ni publicaciones Realtime, sin conflictos de nombres, RLS habilitada con `acceso_total`, columnas nuevas ausentes). |
| P8 (grants por columna), P9 (RPC), P6 (vistas), P12 (transacciones largas) | **Sin resultado real todavía.** El dueño debe correr `0_preflight.sql` (solo lectura, rol de lectura) y guardar la salida; P9 ya no aborta. |

### GO / NO-GO actual
Resultados reales de solo lectura informados por el dueño: **P6** sin vistas dependientes, **P8** 0 permisos solo por columna, **P9** sin funciones públicas que escriban en `progreso`/`sesiones`, **P12** 0 transacciones largas en ese instante. No sustituyen el preflight completo (P1–P5, P7, P10, P11 y el preflight de seguridad `docs/rls-v1/0_preflight.sql`).

**NO-GO para migrar y para activar las banderas en producción** mientras no se cumpla TODO esto (ninguna migración ni variable se tocó):
1. Preflight completo, incluido `docs/rls-v1/0_preflight.sql` (R5 RPC, R7 cuentas vinculadas, R9 gestores).
2. **RLS v1 aplicada y verificada** (`docs/rls-v1`, ahora preparada y probada en local): hasta entonces V8(b) («escribir con otro `alumno_id` es rechazado») no puede pasar.
3. Prueba en un branch de Supabase de prueba con Supabase Auth real (PostgREST, JWT, V8 y V9).

Orden de despliegue y rollback de cada etapa: `docs/rls-v1/README.md` §4.

## Dependencia de «Prescrito vs. ejecutado»
La comparación necesita (a) la identidad de esta migración y (b) la tabla de copias de `docs/prescripcion-copias-v1/` (no aplicada; la app ya la escribe y la lee, pero solo con `VITE_IRONTRACK_COPIAS_PRESCRIPCION`). Hasta entonces cada sesión devuelve un estado explícito (`sin_copia`, `sin_finalizar`, `series_sin_vinculo`); ver `lib/prescritoEjecutadoResumen.js`. No hay copias retroactivas: las sesiones anteriores quedan sin comparar.
