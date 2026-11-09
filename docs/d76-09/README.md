# D76-09 — Series pendientes después de borrar el historial

> **DEPENDIENTE DE MIGRACIÓN.** El frontend necesita `2_migracion_d76_09.sql` aplicada en Supabase **antes** de publicarse en Production.
> Sin ella, "Limpiar historial" queda deshabilitado ("migración pendiente") y el resto de la app funciona como hoy.
> **No fusionar** hasta completar los pasos 0 a 5 de §4. La migración y el merge requieren autorizaciones explícitas y separadas.

## 1. Problema y solución

**El problema:**
- El entrenador limpiaba el historial con dos DELETE directos (`progreso` y `sesiones`).
- Las series que el alumno tenía sin sincronizar en el teléfono, o con la respuesta perdida, se volvían a subir después y "resucitaban" historial borrado.
- El reintento idempotente no lo evitaba: después del DELETE el servidor ya no recordaba el id.

**La solución:** una **época persistente por alumno, controlada por el servidor**, con un **sello** (uuid aleatorio) que cambia en cada borrado.
- **El cliente sella cada serie y cada sesión al registrarla**, con el sello que conocía en ese momento. Nunca se re-sella después.
- **Un trigger `BEFORE INSERT`** en `progreso` y `sesiones` rechaza con `IT409` lo que llega sin el sello vigente cuando el alumno tuvo un borrado. Funciona igual con cualquier rol y con cualquier versión del cliente.
- **El borrado es una RPC atómica** (`it_limpiar_historial_alumno`): sube la época, cambia el sello y borra `progreso` y `sesiones` en una transacción.
  - Un advisory lock por alumno la serializa con los INSERT concurrentes.
  - Cualquier DELETE directo por la API queda bloqueado.
- **Lo rechazado no se pierde:** queda en **cuarentena** en el teléfono (`it_pqq:*` para series, `it_pqs:*` para sesiones), sin reintentos automáticos.
  - El alumno lo revisa y puede **«Subir igual»** (`it_historial_reingresar`), con confirmación explícita y auditoría.
  - Si el entrenador vuelve a borrar entretanto, el servidor responde `conflicto_epoch` y no se sube nada.
- **Alumno sin `auth_uid`:** flujo seguro de vínculo.
  1. El alumno, con sesión iniciada, solicita el vínculo (`it_vinculo_solicitar`). El servidor exige que el email confirmado de su cuenta coincida con el del alumno.
  2. El entrenador lo aprueba (`it_vinculo_aprobar`).
  3. La cuenta Auth no se modifica.
- **Entrenador autorizado:** la migración lo resuelve sola. Toma la única cuenta de Supabase Auth **confirmada** con el email de entrenador que usa la app (`entrenador@irontrack.app`), y exige que tenga fila en `public.entrenadores`. Si hay 0 o más de 1, aborta.

### Garantías y límites

- **Garantizado,** incluso con las políticas `acceso_total` abiertas:
  - ninguna serie o sesión anterior a un borrado vuelve a insertarse, sea de un cliente atrasado, de un cliente viejo o de un tercero con la clave anon;
  - todo borrado de `progreso` y `sesiones` por la API pasa por la RPC;
  - `auth_uid` no se puede escribir por la API.
- **No garantizado** mientras `acceso_total` siga abierto:
  - UPDATE y lectura libres de filas existentes. Se resuelve con la corrección general de RLS, que está fuera de este alcance.
- **Riesgo aceptado:**
  - Una serie registrada justo después de un borrado, antes de que el teléfono conozca el sello nuevo, va a cuarentena. No se pierde y se recupera con «Subir igual».
  - El sello se refresca cada vez que la app vuelve al primer plano y como máximo cada 60 s durante el entrenamiento.

## 2. Archivos, en orden de ejecución

| Archivo | Tipo | Uso |
|---|---|---|
| `0_respaldo_esquema.sql` | lectura | Respaldo de la **estructura** de `public` (exportar el resultado a CSV) |
| `1_diagnostico_previo.sql` | lectura | 22 controles + VEREDICTO (GO / GO con avisos / NO-GO). Sin datos personales |
| `2_migracion_d76_09.sql` | escritura | Una transacción. Verificaciones previas y posteriores que **abortan todo** ante cualquier diferencia. Modo inicial `off`. **No se edita** |
| `3_verificacion_posterior.sql` | lectura | 13 controles + VEREDICTO (OK / FALLA) |
| `4_modos_y_seguimiento.sql` | 1 fila + lectura | `observar` / `activo` / `off` (rollback nivel 1) + consulta de seguimiento |
| `5_rollback_d76_09.sql` | escritura | Rollback nivel 2 (retira objetos, conserva columnas y datos) + su verificación |
| `pruebas-pg/` | local | Mock de Supabase (03), GO-1 (04, 24 pruebas), preparación aislada (05), ensayo del despliegue (06, 6 escenarios) |

> El SQL está en `docs/d76-09/` y **no** en `sql/`: las reglas del repositorio no permiten que el agente escriba en `sql/` y `supabase/`.
> Nada de `docs/` se ejecuta automáticamente.

## 3. Respaldo previo (manual y obligatorio)

**El plan Free de Supabase no incluye backups automáticos ni PITR.** No hay un backup completo y restaurable verificado. El respaldo se hace a mano **antes** de la migración, en dos partes:

1. **Datos:** Table Editor → cada tabla → **Export → CSV**: `alumnos`, `progreso`, `sesiones` y `rutinas`.
2. **Esquema:** SQL Editor → ejecutar `0_respaldo_esquema.sql` (solo lectura) → exportar el resultado a **CSV**.

Guardar los archivos **fuera del repositorio**: tienen datos personales y nunca se suben a git.

**Límites de este respaldo (no es un backup completo ni restaurable automáticamente):**
- **Los CSV solo cubren esas 4 tablas.** No incluyen `auth.users` (cuentas, contraseñas, metadata), ni otras tablas (`mensajes`, `fotos`, `notas`, `config`, `entrenadores`, `ejercicios_custom`…), ni Storage, ni Edge Functions ni sus secretos.
- **Un CSV puede no conservar los tipos con fidelidad:** distinción entre NULL y texto vacío, `jsonb` (por ejemplo `rutinas.datos`), zonas horarias de `timestamptz`, precisión de `numeric`. Restaurar implica reimportar a tablas ya existentes, con la misma estructura y en un orden compatible con las FK.
- **El respaldo de esquema sirve para revisar y reconstruir a mano.** No es un script que se pueda ejecutar.
- **Un respaldo completo y restaurable** requiere `pg_dump` / `supabase db dump` desde una computadora con acceso a la base, o un plan pago con backups. Es opcional y lo decide el dueño.

**Por qué alcanza para esta migración:** no modifica ni borra ninguna fila existente. Solo agrega objetos nuevos, 8 columnas vacías y nullable en `progreso` y `sesiones`, y 5 triggers. El rollback de nivel 2 lo revierte todo y conserva los datos (ensayado). El riesgo real para los datos aparece recién con el primer «Limpiar historial», que es un borrado intencional.

## 4. Procedimiento de despliegue

**Regla fija: la base va antes que el frontend.** Con la migración en modo `off`, el frontend actual (`main`) funciona exactamente igual:
- no hay rechazos;
- los DELETE directos se permiten;
- las columnas nuevas se ignoran.

El frontend nuevo nunca llega a Production antes de la migración, porque el merge va después.

| Paso | Acción | Quién / autorización | Resultado esperado |
|---|---|---|---|
| 0 | **Congelar «Limpiar historial»** hasta el paso 7 (un borrado con el frontend viejo no sube la época) | dueño | — |
| 1 | Respaldo (§3): 4 CSV de datos + CSV de `0_respaldo_esquema.sql` | dueño | Archivos guardados fuera del repo |
| 2 | Verificar la Data API (§5): `it_private` no expuesto | dueño | Solo `public` (y `graphql_public`) |
| 3 | Ejecutar `1_diagnostico_previo.sql` | dueño | VEREDICTO = GO (o GO con avisos, sin aviso en el 19) |
| 4 | Ejecutar `2_migracion_d76_09.sql` completo, sin editar | **autorización de migración** | "Success. No rows returned". Ante cualquier error no queda nada aplicado |
| 5 | Ejecutar `3_verificacion_posterior.sql` | dueño | VEREDICTO = OK y el mismo volumen que en el paso 3. Si da FALLA: `5_rollback…` y frenar |
| 6 | **Merge del PR** → Production | **autorización de merge** | La app sella y borra por RPC; sigue en modo `off` |
| 7 | Recargar la app en los dispositivos del entrenador; repetir §5; consulta de seguimiento de `4_…` | dueño | `modo = off`; si el alumno sin `auth_uid` inicia sesión: 1 solicitud de vínculo |
| 8 | `update it_private.config set modo = 'observar';`, durante 7 días | autorización | Seguimiento sin "eventos de alumnos SIN borrado" |
| 9 | `update it_private.config set modo = 'activo';` | autorización | — |

**Punto exacto de merge:** después de los pasos 0 a 5 en OK, con este PR actualizado y el CI verde. La prueba en iPhone ya está hecha (demo 7/7). Antes de eso, **no**.

## 5. Verificar desde el iPhone que `it_private` no esté expuesto (Data API)

Solo se mira; no hay que cambiar nada.

1. Abrir **supabase.com/dashboard** en Safari, iniciar sesión y entrar al proyecto de IronTrack.
2. Abrir el menú (☰, arriba a la izquierda) → **Project Settings** (ícono de engranaje) → **Data API**.
   - En algunas versiones del panel la ruta es **Integrations → Data API → Settings**, o **Settings → API**.
3. En **Exposed schemas**, la lista debe tener **solo `public`** (y, si aparece, `graphql_public`). **No debe figurar `it_private`.**
   - Antes de la migración ese esquema no existe, así que no puede aparecer.
   - **Repetir la comprobación después de la migración (paso 7).**
4. En **Extra search path** tampoco debe figurar `it_private`.
5. Si `it_private` apareciera: **NO-GO**. No migrar, o pasar a modo `off`, y avisar. Las tablas igual no tienen permisos para `anon` ni `authenticated`, pero no deben exponerse.

## 6. Rollback

| Situación | Acción |
|---|---|
| Rechazos inesperados o cualquier duda | `update it_private.config set modo = 'off';`: instantáneo y sin DDL. Los teléfonos devuelven su cuarentena a pendientes (movimiento, nunca borrado) |
| Problema del frontend | **Primero** modo `off`, **después** revertir el PR. El frontend anterior no maneja IT409 |
| Retirar la funcionalidad | Modo `off` + `5_rollback_d76_09.sql` (nivel 2). Quita triggers, RPC y `it_private`. Conserva columnas y datos. La migración se puede volver a aplicar (ensayado) |
| **Nunca** | Borrar las columnas `historial_*` / `reingreso_*`: los envíos de teléfonos con series selladas fallarían (PGRST204) |

## 7. Criterios GO / NO-GO

| Momento | GO | NO-GO |
|---|---|---|
| Migrar (paso 4) | Respaldo hecho + Data API sin `it_private` + diagnóstico sin FALLA | Cualquier FALLA; `it_private` expuesto; sin respaldo |
| Merge (paso 6) | Verificación posterior OK + PR actualizado + CI verde | Verificación con FALLA |
| `observar` → `activo` | 7 días sin eventos inesperados ("eventos de alumnos SIN borrado" = 0) y sin reportes de la app | Eventos inesperados o errores: seguir en `observar` o volver a `off` |

## 8. Validación realizada (entorno aislado, datos ficticios)

| Batería | Resultado |
|---|---|
| GO-1: PostgreSQL 17.6 local (funcionales, vínculo y concurrencia con locks reales) | 24/24 |
| GO-2: PostgREST 12.2.12 real (HTTP con JWT, IT409 = 400, anon 401/42501, `it_private` no expuesto) | 15/15 |
| Ensayo del despliegue (`pruebas-pg/06`) | 6/6 |
| E2E del stack real (375, 390 y 430 px) | OK |
| Demo de Preview | OK; probada en iPhone por el dueño (7/7) |
| `npm run test:all` | todas las suites |
| `npm run qa:builds` | 4/4 |
| `npm run qa:ui` | OK |
| Diagnóstico del Supabase real | **GO** (informado por el dueño) |

El ensayo `06` cubre: diagnóstico → migración → verificación → modos → rollback y nueva aplicación. También confirma que la migración aborta **sin dejar nada** si hay 2 cuentas de entrenador, si hay otra columna `NOT NULL` sin default o si el entrenador no tiene fila en `entrenadores`.

**Cómo reproducir GO-1 y el ensayo** (nunca en producción): ver el encabezado de `pruebas-pg/04_pruebas_pg.mjs`. Hace falta un PostgreSQL 17 local por socket Unix, sin TCP, y `RUNNER=<dir con pg>`. Después: `node 05_aplicar_local.mjs && node 04_pruebas_pg.mjs && node 06_validar_despliegue.mjs`.

## 9. `npm run check:scope`

`check:scope` falla con este PR, y **es lo esperado**:
- Es el control del **flujo autónomo de UI** (CLAUDE.md) y rechaza cambios en `lib/`, `App.jsx` y `vite.config.js`.
- D76-09 es lógica de datos autorizada por el dueño fuera de ese flujo.
- No forma parte del CI.

**El control no se desactivó ni se modificó.**

**Corrección acotada propuesta,** sin implementar y pendiente de autorización: una opción `--alcance-autorizado <archivo>` que acepte solo las rutas de una lista revisada por el dueño y **siga fallando** ante cualquier otra ruta y ante `sql/`, `supabase/`, `.env*` y `.github/`.
