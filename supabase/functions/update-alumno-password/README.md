# update-alumno-password

Permite que un entrenador autorizado asigne o cambie la contraseña de un alumno (y crea la cuenta de Auth si el alumno no la tiene).

## Reglas de autorización (IT-002a)
1. **Quién llama.** El UID de Auth del solicitante debe estar en el secreto **`COACH_UIDS`** (lista separada por comas). Es una fuente que el cliente no controla. No alcanza con que `alumnos.entrenador_id` coincida ni con que exista una fila en `entrenadores` (el cliente escribe ambas). Sin secreto válido, **se deniega todo** (403).
2. **Sobre qué alumno.** Además, `alumnos.entrenador_id` debe ser el UID del solicitante o el valor legacy `entrenador_principal`.
3. **Sobre qué cuenta de Auth.** Una cuenta existente solo se modifica si está **vinculada** al alumno por **`app_metadata.alumno_id`** (= id del alumno). Ese dato solo lo escribe el servidor: la función al crear la cuenta, o el propietario (con la clave de administración) tras verificar la titularidad. Un usuario no puede escribir su propio `app_metadata`.
   - **No son vínculos confiables** y la función los ignora: la coincidencia de email, cualquier columna de la ficha del alumno (incluida `alumnos.auth_uid`, que el cliente puede escribir) y `user_metadata` (editable por el propio usuario).
   - Si existe una cuenta con ese email **sin vínculo**: **409** y no se toca nada.
4. Nunca se modifica la cuenta del solicitante ni la de otro entrenador autorizado.
5. **Sobre una cuenta vinculada solo se cambia la contraseña.** El email de login y su confirmación no se tocan nunca. Si el email de la cuenta difiere del de la ficha: **409**, sin modificar nada. Corregir el email en Authentication → Users y reintentar.

## Cuentas existentes: verificación individual antes de vincular
Las cuentas creadas con versiones anteriores no tienen vínculo, por lo que cambiar su contraseña da **409**. **No se vinculan automáticamente por email ni en lote**: con el registro público habilitado, cualquiera pudo haber creado una cuenta con el email de un alumno antes que él, y vincularla le entregaría esa ficha.

Para cada alumno, de a uno:
1. Verificar que la cuenta le pertenece realmente a esa persona (quién la creó, fecha de alta, confirmación directa con el alumno). `user_metadata` no sirve como prueba.
2. Recién entonces, el propietario escribe `app_metadata.alumno_id` desde el servidor, fuera del navegador y de esta función (que no ofrece esa operación a propósito), con la herramienta `scripts/admin/link-alumno.mjs` (ver «Herramienta de vinculación»).
3. Si hay dudas: no vincular. Definir la contraseña a mano en Authentication → Users, o eliminar la cuenta dudosa y dejar que la función cree una nueva (queda vinculada).

Las cuentas que cree esta función ya quedan vinculadas.

## Herramienta de vinculación (`scripts/admin/link-alumno.mjs`)
La **verificación humana de titularidad es obligatoria** y la herramienta no la sustituye: el `--confirm` es solo un control contra errores de copiado. Sin confirmación del alumno por otro canal (presencial o teléfono ya conocido), no se vincula.

- Vincula **una cuenta por ejecución** (no existe modo masivo) y escribe solo `app_metadata.alumno_id`; no cambia email, confirmación, contraseña ni `user_metadata`, y conserva el resto de `app_metadata`.
- **Dry-run por defecto.** Escribir exige `--apply` y `--confirm <alumno-id>:<8 primeros caracteres del uid de la cuenta>`.
- Requiere `npm ci` y variables de entorno (nunca en el repositorio ni en el historial de la shell): `SUPABASE_URL` (`https://<ref>.supabase.co`), la clave de administración (`read -rs` para cargarla), y `COACH_UIDS` (los mismos UIDs que el secreto de la función; todos deben ser UUID y existir en Auth). Se debe indicar `--project-ref <ref>` para confirmar a qué proyecto se apunta.
- Rechaza: ficha inexistente o duplicada, email repetido en fichas o cuentas, cuenta inexistente, de entrenador, suspendida, con proveedor distinto de email (salvo `--allow-non-email-provider`), con email distinto del de la ficha, ya vinculada a otro alumno, o si otra cuenta ya está vinculada a ese alumno.
- Antes de escribir vuelve a leer y compara; después de escribir vuelve a leer y verifica. Códigos de salida: `0` correcto, `1` abortó sin escribir, `2` estado incierto (revisar la cuenta en Authentication → Users).
- **Deshacer, de a una:** el mismo comando con `--rollback` (y `--apply --confirm …` para aplicar).
- El dry-run imprime señales de titularidad (email confirmado, fecha de creación, último login, proveedores) sin emails ni nombres. Se usan con la verificación del alumno, no en su lugar.
- Es una herramienta administrativa local: no forma parte de la aplicación ni de su bundle, y no se ejecuta desde el navegador ni desde agentes.
- Pruebas: `node scripts/test-linkAlumno.mjs` y `node scripts/test-linkAlumnoCli.mjs` (cliente simulado, sin red).

## Despliegue (lo hace el propietario; el orden importa)
0. **Antes de todo, vincular** las cuentas existentes de a una (ver arriba; herramienta `scripts/admin/link-alumno.mjs`, dry-run por defecto). Vincular solo escribe `app_metadata` y no afecta a la versión que esté desplegada.
1. Cargar el secreto **`COACH_UIDS`** con el UID del entrenador (Authentication → Users → UID). Es un identificador, no una credencial. **Antes de desplegar**: con el orden inverso el entrenador recibe 403 hasta cargarlo.
2. Desplegar la función. `index.ts` importa `./handler.js`, por lo que hay que subir **ambos archivos** (con la CLI se incluyen solos).
3. Probar con un **alumno de prueba**: crear alumno → «Editar alumno» → asignar contraseña (200) → iniciar sesión como ese alumno. Prueba negativa con la sesión de un alumno de prueba (no de uno real): cambiar la contraseña de otro alumno de prueba debe responder 403.
4. Revisar los registros de la función durante 24 h (403/409/500 inesperados).

## Recuperación
- **El entrenador recibe 403 en todos los alumnos:** el secreto falta o el UID está mal. Corregir `COACH_UIDS`; los registros de la función lo avisan.
- **409 en un alumno:** cuenta sin vincular (ver arriba), email de la cuenta distinto del de la ficha, o cuenta de otra persona. No se modificó nada.
- **Salida inmediata, independiente de la función:** Authentication → Users → definir o restablecer la contraseña del alumno a mano.
- **Rollback:** NUNCA volver a desplegar la versión anterior (`d53db36`): no autoriza al solicitante y permite tomar cuentas de alumnos. Si la versión nueva falla, volver a desplegar `main` desde un checkout limpio. Para desactivar la función temporalmente, dejar `COACH_UIDS` vacío o inválido (deniega todo) o eliminar la función; la salida manual es Authentication → Users.

## Pruebas
`node scripts/test-updateAlumnoPasswordAuthz.mjs` (cliente simulado, sin red). Con un argumento corre los mismos escenarios contra otra versión de `index.ts`, para comprobar que fallan con la anterior.

## Relación con el PR #89
El PR #89 reemplaza esta función por una versión basada en `alumnoId`, `coach_principal` y backfill. Cuando se integre, su `index.ts` y `core.js` sustituyen a estos archivos y el secreto `COACH_UIDS` deja de usarse.
