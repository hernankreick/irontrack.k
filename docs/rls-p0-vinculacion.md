# RLS P0 — vinculación segura de cuentas de alumnos (procedimiento, sin ejecutar)

Objetivo: que cada alumno que hoy inicia sesión tenga `app_metadata.alumno_id` = su `alumnos.id` **antes** de aplicar la migración B; si no, pierde el acceso.
No se vincula nunca por coincidencia de email ni en lote. Este documento no modifica datos: lo ejecuta el propietario.

## 1. Detectar (solo lectura)
Ejecutar `docs/rls-p0-diagnostico-readonly.sql` y mirar la sección `08 vinculacion alumnos`:

| Estado | Significado | Acción |
|---|---|---|
| `OK` · «vinculada» | cuenta con `alumno_id` correcto y mismo email | nada |
| `OK` · «sin cuenta con ese email» | el alumno no puede ingresar hoy | nada: al asignarle contraseña, la función crea la cuenta ya vinculada |
| `REQUIERE_VINCULACION` | existe una cuenta con el email del alumno, sin vínculo | verificar titularidad y vincular (paso 2) |
| `ATENCION` | vinculada pero con email distinto en la ficha | corregir el email en Auth o en la ficha; la función responde 409 hasta entonces |
| `BLOQUEA` | varias cuentas vinculadas, email repetido en fichas, o un entrenador vinculado como alumno | resolver a mano antes de seguir |

Las señales de titularidad (confirmada, fecha de alta, último login, proveedores) ayudan pero **no reemplazan** la confirmación del alumno por otro canal.
Con el registro público de Auth habilitado, alguien pudo crear una cuenta con el email de un alumno antes que él: esa cuenta **no** debe vincularse.

## 2. Vincular, de a uno, por cada `REQUIERE_VINCULACION`
1. Confirmar con el alumno (presencial o teléfono ya conocido) que la cuenta es suya. Si hay dudas: no vincular; definir la contraseña a mano en Authentication → Users o eliminar la cuenta dudosa y dejar que la función cree una nueva (queda vinculada).
2. Con la herramienta existente `scripts/admin/link-alumno.mjs` (README de `supabase/functions/update-alumno-password`): primero **dry-run** (por defecto), revisar lo que imprime, y recién entonces `--apply --confirm <alumno-id>:<8 primeros caracteres del uid de la cuenta> --project-ref <ref>`.
   Requiere `SUPABASE_URL`, la clave de administración (cargada con `read -rs`, nunca en el repositorio ni en el historial) y `COACH_UIDS`. Escribe solo `app_metadata.alumno_id`.
3. Deshacer, de a una: el mismo comando con `--rollback`.
4. Repetir el diagnóstico: el alumno debe pasar a `OK`.

## 3. Antes de la migración B
- `REQUIERE_VINCULACION` = 0 y `BLOQUEA` = 0 en el diagnóstico (la migración B aborta si no).
- Cargar `coach_accounts` con los UIDs del secreto `COACH_UIDS` (sección 06 del diagnóstico lista las filas de `entrenadores` para compararlas; una fila allí **no** prueba nada).
- Los tokens de alumno ya emitidos no incluyen el vínculo hasta renovarse (≤ 1 h): pedir cerrar sesión y volver a entrar.
