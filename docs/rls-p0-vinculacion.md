# RLS P0 — vinculación segura de las cuentas de alumnos (procedimiento; no se ejecutó nada)

**Estado de producción confirmado por el diagnóstico:** 9 alumnos, 9 cuentas de Auth que les corresponden, **0 vinculadas** por `app_metadata.alumno_id`, 10 cuentas en total
(la décima es la del entrenador), 7 filas en `entrenadores` (varias son de cuentas de alumnos).

**Qué ya resolvió el PR #100 / #105 (no se reimplementa):** la Edge Function `update-alumno-password` autoriza al entrenador por `COACH_UIDS`, vincula **solo** por
`app_metadata.alumno_id`, nunca por email, y no toca cuentas ajenas ni de entrenadores; `scripts/admin/link-alumno.mjs` vincula de a una cuenta, con dry-run por defecto,
confirmación exacta, releer-antes/después y `--rollback`. **Qué falta:** ejecutarlo para las 9 cuentas antes de la migración B, y verificar antes/después.

## Principios
- **Autorización de entrenador = `COACH_UIDS`** (y su espejo `coach_accounts`). Que una cuenta tenga fila en `entrenadores` **no** le da ningún permiso: esa tabla la escribe el
  propio cliente en cada login (por eso hay filas de alumnos). Las 6 filas de cuentas de alumnos son inertes; con la migración B ni siquiera pueden leerlas.
- **Un alumno nunca adquiere permisos de entrenador:** `app_metadata.alumno_id` solo concede acceso a la ficha con ese id; ninguna política mira `entrenadores`, `auth_uid`,
  `user_metadata` ni el email. La herramienta rechaza cuentas de `COACH_UIDS`, y el diagnóstico marca `BLOQUEA` si alguna estuviera vinculada como alumno.
- Nunca por coincidencia de email ni en lote: el email solo sirve para **proponer** el par; la titularidad la confirma el propietario con el alumno por otro canal.

## 1. Antes: verificar la correspondencia (solo lectura)
1. En `docs/rls-p0-diagnostico-readonly.sql`, pegar en `coach_uids` los UIDs de `COACH_UIDS` (identificadores, no credenciales; no subirlos al repositorio) y ejecutarlo.
2. La sección `12 plan de vinculacion` lista, por alumno, o bien el comando exacto, o bien `NO vincular todavia: <motivo>`. Un par es «apto» solo si:
   exactamente **una** cuenta tiene el email de la ficha · el email no se repite en otra ficha · la cuenta no está vinculada · email confirmado · no suspendida ·
   proveedor únicamente `email` · **no** es una cuenta de `COACH_UIDS`.
3. Esperado hoy: 9 filas `REQUIERE_VINCULACION` y 0 `BLOQUEA`. Cualquier `BLOQUEA` (duplicado, cuenta suspendida o de otro proveedor, cuenta de entrenador) se resuelve a mano antes de seguir.
4. Guardar la salida fuera del repositorio.

## 2. Vincular, de a una (lo hace el propietario, en su máquina)
Para **cada** una de las 9 filas, en este orden:
1. Confirmar con el alumno, por otro canal (presencial o teléfono ya conocido), que la cuenta es suya. Las señales del diagnóstico (alta, último login) ayudan pero no reemplazan esto.
   Si hay dudas: no vincular; definir la contraseña a mano en Authentication → Users o eliminar la cuenta dudosa y dejar que la función cree una nueva (ya queda vinculada).
2. Cargar el entorno sin dejar rastro en el historial: `read -rs SUPABASE_SERVICE_ROLE_KEY; export SUPABASE_SERVICE_ROLE_KEY`, `export SUPABASE_URL=https://<ref>.supabase.co`,
   `export COACH_UIDS=<los mismos UIDs que el secreto de la función>`.
3. **Dry-run** (por defecto): el comando de la sección 12. Revisar: precondiciones OK, señales de titularidad, `entrenadores protegidos: N`.
4. **Aplicar**: el mismo comando con `--apply --confirm <alumno-id>:<8 primeros del uid>`. Salida `0` = vinculada; `1` = abortó sin escribir; `2` = estado incierto (mirar la cuenta a mano).
5. Verificar esa cuenta (diagnóstico, sección 08: el alumno pasa a `OK`) antes de pasar a la siguiente.

## 3. Después: verificación
Repetir el diagnóstico (con `coach_uids` pegado). Condiciones para continuar: `REQUIERE_VINCULACION = 0`, `BLOQUEA = 0`, 9 alumnos `OK` en la sección 08,
sección 06 sin entrenadores autorizados vinculados como alumno, sección 07 sin `BLOQUEA` (todo dato con dueño por UID pertenece a un UID de `COACH_UIDS`).
Los tokens ya emitidos no incluyen el vínculo hasta renovarse (≤ 1 h): pedir cerrar sesión y volver a entrar, o esperar.

## 4. Recuperación
- **Una cuenta mal vinculada:** el mismo comando con `--rollback` (y `--apply --confirm …`). Solo quita `app_metadata.alumno_id`; no cambia email, contraseña ni `user_metadata`.
- **Las 9:** nueve `--rollback`, de a una. Mientras la migración B no se aplique, vincular **no cambia nada** para la app desplegada.
- **Después de B, un alumno no puede ingresar o ve la app vacía:** (1) diagnóstico → ¿está `OK` su fila de la sección 08?; (2) que cierre sesión y vuelva a entrar (renueva el token);
  (3) si persiste y es urgente: rollback de la migración B (`supabase/rollback/…_rollback.sql`) o restaurar el snapshot; luego corregir hacia adelante.
- **Salida manual de contraseña, independiente de la función:** Authentication → Users.

## 5. Limpieza opcional (no necesaria)
Las 6 filas de `entrenadores` de cuentas de alumnos son inertes y, con la migración B, el upsert del cliente para alumnos falla en silencio (solo `console.error`) y no las recrea.
Borrarlas es un cambio de datos de producción: decisión del propietario, fuera de este alcance.
