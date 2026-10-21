# Despliegue protegido de la Edge Function `update-alumno-password`

Flujo: `.github/workflows/deploy-update-alumno-password.yml`. Es **manual**, corre solo desde `main` y **no se ejecuta sin la aprobación de una persona** en un entorno protegido de GitHub. Ningún agente tiene credenciales de producción: el token solo existe dentro de ese entorno y solo es legible por el job después de la aprobación.

> Estado: el flujo está **validado de forma estática** (`node scripts/test-deployWorkflow.mjs`: 13 comprobaciones y 13 mutaciones detectadas) pero **todavía no se ejecutó en GitHub**. La primera ejecución puede requerir ajustes (ver «Supuestos sin verificar»). Falla cerrado: ante cualquier duda no despliega.

## Configuración única (la hace el propietario en GitHub)
1. **Entorno protegido.** Settings → Environments → New environment → nombre exacto `production-functions`.
   - *Required reviewers*: el propietario. Si es la única persona con acceso, dejar **desactivado** «Prevent self-review» (si no, nadie podría aprobar).
   - *Deployment branches and tags*: **Selected branches** → solo `main`.
2. **Secreto del entorno** `SUPABASE_ACCESS_TOKEN`: un token personal de acceso creado en la cuenta del proveedor, con el alcance mínimo posible; rotarlo periódicamente y revocarlo si deja de usarse. Va solo en el entorno (nunca como secreto de repositorio ni en el código).
3. **Variable del entorno** `SUPABASE_PROJECT_REF`: la referencia del proyecto (20 caracteres; no es un secreto).
4. **Secreto de la función `COACH_UIDS`** (se carga en el panel del proyecto, no en GitHub): los UID de Auth de los entrenadores, separados por coma. Debe existir **antes** del primer despliegue.
5. **Verify JWT** activado en la función (valor por defecto; el flujo se niega a continuar si está desactivado en la versión actual, y despliega sin la opción que lo desactiva).
6. `main` ya está protegida (`protect-main`): los cambios al propio flujo pasan por PR.

## Cómo se ejecuta
Actions → «Deploy update-alumno-password» → Run workflow (rama `main`) con dos datos:
- `expected_sha`: SHA completo (40 caracteres) del commit de `main` que se quiere desplegar.
- `expected_coach_uids`: el/los UID del entrenador, **exactamente** como están en el secreto `COACH_UIDS` (son identificadores, no credenciales).
GitHub pide la aprobación del entorno; recién entonces el job puede leer el token.

## Qué hace y qué verifica
Antes: valida el formato de las entradas; hace checkout de `main` y comprueba que su HEAD sea `expected_sha`; comprueba que existan `index.ts` y `handler.js` con la validación de `COACH_UIDS` y de `app_metadata.alumno_id`; corre todas las suites y el build (con valores ficticios); comprueba que el secreto `COACH_UIDS` exista y que su huella coincida con los UID indicados (sin imprimirlos); exige Verify JWT activado en la versión actual.
Despliega **solo** esta función con la CLI (`index.ts` y `handler.js` juntos).
Después: la función queda `ACTIVE` con Verify JWT, la versión avanzó, el código desplegado es idéntico al de `main` (salvo el README) y una llamada sin autorización recibe `401`.

## Qué NO hace (a propósito)
No ejecuta migraciones ni SQL, no escribe ni cambia secretos, no toca otras funciones, el frontend ni el hosting, no cambia contraseñas ni crea cuentas y no vincula alumnos. Las pruebas de escritura (alta, cambio de contraseña, 403 y 409) se hacen aparte con **cuentas ficticias**.

## Supuestos sin verificar (revisar en la primera ejecución)
- Que el listado de secretos de la CLI muestre la huella SHA-256 del valor, para compararla con los UID indicados. Si el formato fuera otro, el paso falla (no despliega) y habrá que ajustarlo.
- Que la API de gestión devuelva los campos `verify_jwt`, `status` y `version` de la función. Si faltara alguno, falla cerrado.
- Que el comando de descarga de funciones de la CLI funcione con el token del entorno para comparar el código.

## Recuperación (nunca volver a la versión vulnerable `d53db36`)
- El entrenador recibe 403 en todo: corregir el secreto `COACH_UIDS` (no requiere nuevo despliegue).
- La versión nueva falla: volver a ejecutar este flujo con otro commit de `main`.
- Apagar temporalmente: dejar `COACH_UIDS` vacío (la función deniega todo) o eliminar la función.
- Salida inmediata: contraseña manual en Authentication → Users.
