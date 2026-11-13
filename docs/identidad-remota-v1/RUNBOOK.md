# Identidad remota v1 — runbook de migración y activación

Estado: **preparado, NO ejecutado**. Nada de esto se corre sin autorización del dueño. El esquema real de Supabase **no pudo inspeccionarse** (sin acceso de solo lectura en la sesión de auditoría): todo lo marcado «ESPERADO» en `0_preflight.sql` es una hipótesis a confirmar, no un hecho.

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
