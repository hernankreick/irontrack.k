# D76-09 — Series pendientes después de borrar el historial

> **DEPENDIENTE DE MIGRACIÓN.** El frontend de este cambio necesita la migración `01_migracion_d76_09.sql` aplicada en Supabase
> **antes** de publicarse en Production. Sin ella, "Limpiar historial" queda deshabilitado ("migración pendiente") y el resto de la app
> funciona como hoy. No hacer merge hasta completar el procedimiento de despliegue y la prueba en iPhone (§6).

## 1. Problema y solución

**El problema:**
- El entrenador limpiaba el historial con dos DELETE directos (`progreso` y `sesiones`).
- Las series que el alumno tenía sin sincronizar en su teléfono, o con la respuesta perdida, se volvían a subir después y "resucitaban" historial borrado.
- El reintento idempotente no lo evitaba: después del DELETE el servidor ya no recordaba el id.

**La solución:** una **época persistente por alumno, controlada por el servidor**, con un **sello** (uuid aleatorio) que cambia en cada borrado.
- **El cliente sella cada serie y cada sesión al registrarla**, con el sello que conocía en ese momento. Nunca se re-sella después.
- **Un trigger `BEFORE INSERT`** en `progreso` y `sesiones` rechaza con `IT409` lo que llega sin el sello vigente cuando el alumno tuvo un borrado. Funciona igual con cualquier rol y con cualquier versión del cliente.
- **El borrado es una RPC atómica** (`it_limpiar_historial_alumno`): sube la época, cambia el sello y borra `progreso` y `sesiones` en una transacción.
  - Un advisory lock por alumno la serializa con los INSERT concurrentes.
  - Cualquier DELETE directo por la API queda bloqueado.
- **Lo rechazado no se pierde:** queda en **cuarentena** en el teléfono (`it_pqq:*` para series, `it_pqs:*` para sesiones), sin reintentos automáticos.
  - El alumno lo revisa y puede **«Subir igual»**: RPC `it_historial_reingresar`, con confirmación explícita y auditoría.
  - Si el entrenador vuelve a borrar entretanto, el servidor responde `conflicto_epoch` y no se sube nada.
- **Alumno sin `auth_uid`:** flujo seguro de vínculo.
  1. El alumno, con sesión iniciada, solicita el vínculo (`it_vinculo_solicitar`). El servidor exige que el email confirmado de su cuenta coincida con el del alumno.
  2. El entrenador lo aprueba (`it_vinculo_aprobar`).
  3. La cuenta Auth no se modifica.

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

## 2. Archivos

| Archivo | Rol |
|---|---|
| `docs/d76-09/01_migracion_d76_09.sql` | Migración. Tiene verificaciones previas y posteriores que **abortan todo** si algo no coincide. Modo inicial `off` |
| `docs/d76-09/02_rollback_d76_09.sql` | Nivel 1: `modo = 'off'`, instantáneo. Nivel 2: retirar triggers, RPC y `it_private`; **las columnas se conservan** |
| `docs/d76-09/pruebas-pg/` | Pruebas de GO-1 en PostgreSQL 17 local y desechable (24 pruebas, incluidas 7 de concurrencia) |
| `lib/historialSello.js`, `lib/historialCuarentena.js` | Sello, detección de IT409, cuarentena y «Subir igual» |
| `components/workout/HistorialCuarentenaModal.jsx` | Revisión del alumno: conservar, descartar y «Subir igual» |
| `components/demo/*HistorialCuarentena*`, `demo/historial-cuarentena.html` | Demo para iPhone, **solo en Preview**, datos ficticios y sin Supabase |

> El SQL está en `docs/d76-09/` y **no** en `sql/`. Las reglas del repositorio prohíben que el agente escriba en `sql/` y `supabase/`.
> Nada en `docs/` se ejecuta automáticamente. Moverlo a `sql/` queda a cargo del dueño, si lo prefiere.

## 3. Instalación y orden de despliegue

**Regla fija: la base va antes que el frontend.** Si el frontend llega primero, no sella nada (no detecta la capacidad) y el borrado queda bloqueado con "migración pendiente".

1. **Staging** (un proyecto Supabase separado, con datos ficticios):
   1. reemplazar el UID del entrenador en la sección 2 de `01` (el mismo valor que `COACH_UIDS`);
   2. aplicar `01`;
   3. Preview apuntando a staging;
   4. prueba en un iPhone real (§6).
2. **Backup / PITR** confirmado en Production.
3. **Production, base:** aplicar `01` en el SQL Editor. Corre en una transacción con `lock_timeout = 3s`: si no obtiene el lock, aborta sin efectos.
   - Queda en **modo `off`**: no cambia el comportamiento.
4. **Production, frontend:** merge de este PR, con autorización del dueño.
   - Verificar que el sello se obtiene para los alumnos vinculados.
   - El alumno sin `auth_uid` pide el vínculo al iniciar sesión.
5. **Modo `observar`** durante 7 días: `update it_private.config set modo = 'observar';`
   - Revisar `it_private.eventos`: debe tener **cero filas de alumnos que nunca tuvieron un borrado**.
6. **Modo `activo`:** `update it_private.config set modo = 'activo';`

**Ningún alumno sin borrados recibe nunca un rechazo**, en ningún modo. El registro normal de entrenamientos no se interrumpe.

## 4. Rollback

| Situación | Acción |
|---|---|
| Rechazos inesperados | `update it_private.config set modo = 'off';`: instantáneo y sin DDL. Los clientes nuevos devuelven la cuarentena a pendientes (movimiento, nunca borrado) |
| Error del frontend | **Primero** modo `off`, **después** revertir el PR. El frontend anterior no maneja IT409 |
| Retirar la funcionalidad | Modo `off`, frontend sin RPC y `02_rollback_d76_09.sql` nivel 2 |
| **Nunca** | Borrar las columnas `historial_token`, `historial_epoch` y `reingreso_*`: los POST de clientes que las envían fallarían (PGRST204) |

## 5. Criterios GO / NO-GO

| Paso | GO si… | NO-GO |
|---|---|---|
| GO-1 (SQL local) | 24/24 en PostgreSQL 17 desechable | Cualquier falla |
| GO-2 (integración) | PostgREST real: IT409 = HTTP 400 `code IT409`; anon 401/42501 en las 5 RPC; `it_private` no expuesto; E2E OK | Cualquier falla |
| Staging | Pruebas en staging + iPhone real (§6) | Cualquier diferencia con GO-2 |
| Production base | Las verificaciones de `01` pasan; backup confirmado | La migración aborta |
| `observar` → `activo` | 7 días sin eventos de alumnos sin borrado | Eventos inesperados → seguir en `observar` o volver a `off` |

**Resultados obtenidos (entorno aislado, datos ficticios):**

| Batería | Resultado |
|---|---|
| GO-1 SQL | 24/24 |
| Integración con PostgREST 12.2.12 | 15/15 |
| E2E del stack real | 375, 390 y 430 px |
| Unitarias nuevas | 25/25 |
| Demo | 4/4 + E2E del build de Preview |
| `test:all` | todas las suites |
| `qa:builds` | 4/4 |
| `qa:ui` | OK |

## 6. Prueba mínima en iPhone (staging o la demo de Preview)

**Demo (sin login ni Supabase):** abrir `/demo/historial-cuarentena.html` en el Preview de este PR y seguir estos pasos:

1. Tocar **Sin conexión** y registrar 2 series.
2. Como entrenador, tocar **Limpiar historial del alumno**.
3. Tocar **Con conexión**. Debe aparecer el aviso «Tu entrenador reinició tu historial. 2 registros… en revisión», y el servidor debe mostrar 0 series.
4. Tocar **Revisar** → **Subir igual**. La confirmación debe mostrar la fecha del borrado, y «Confirmar y subir» debe estar deshabilitado hasta marcar la casilla.
5. Marcar la casilla y confirmar. Las 2 series deben aparecer en el servidor como «subida igual».
6. Opcional: tocar **Ejecutar pruebas automáticas**. Deben dar 7/7 PASA.

**Staging (app real):**
1. Con el iPhone en modo avión, registrar series en un entrenamiento.
2. Limpiar el historial desde otro dispositivo, como entrenador.
3. Quitar el modo avión. Debe aparecer el aviso «en revisión» y no debe haber filas nuevas en `progreso`.
4. Hacer «Subir igual»: las filas deben aparecer con `reingreso_at`.

## 7. `npm run check:scope`

`check:scope` falla con este PR, y **es lo esperado**:
- Es el control del **flujo autónomo de UI** (CLAUDE.md) y rechaza cambios en `lib/`, `App.jsx` y `vite.config.js`.
- D76-09 es lógica de datos, autorizada por el dueño fuera de ese flujo.
- No forma parte del CI: no aparece en `.github/`.

**No se desactivó ni se modificó el control.**

**Corrección acotada propuesta,** sin implementar y pendiente de tu autorización: agregar a `scripts/check-ui-scope.mjs` una opción `--alcance-autorizado <archivo>`.
- El archivo es una lista de rutas revisada por el dueño.
- La opción solo acepta las rutas listadas y **sigue fallando** ante cualquier archivo fuera de la lista y ante `sql/`, `supabase/`, `.env*` y `.github/`.
- Sin la opción, el comportamiento actual no cambia.
