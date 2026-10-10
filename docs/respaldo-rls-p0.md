# Respaldo previo a RLS P0 — copia interna + exportación externa (plan Free, desde iPhone)

> **Esto NO es un backup completo.** La copia interna vive dentro del mismo proyecto Supabase: protege contra **errores de nuestra propia
> migración** (backfill, políticas), no contra la pérdida del proyecto, de Auth o de Storage. Para una garantía real hace falta además un
> `pg_dump` completo (computadora o servicio con conexión directa) — ver "Qué falta".

## Archivos (todos en `sql/`, solo texto, sin datos)
| Archivo | Qué hace | Escribe en producción |
|---|---|---|
| `rls_p0_backup_create.sql` | Crea el esquema `backup_rls_p0` con copia de las **14 tablas reales** (incl. `ejercicios_custom_backup_pre_fase1`; no asume `coach_notification_reads`, que no existe) + snapshot de políticas, RLS, grants **efectivos** (ACL implícito vía `acldefault`, matriz `has_table_privilege` por rol, default privileges, columnas, funciones), triggers, funciones, constraints, índices, secuencias y `auth.users` mínimo (sin contraseñas ni tokens). Una transacción; no sobrescribe; aborta si no hay espacio; REVOKE explícito a anon/authenticated y comprobación de que no queda ningún privilegio. | Sí (crea el esquema de copia) |
| `rls_p0_backup_verify.sql` | Consultas de solo lectura: A) integridad (conteo + huella md5), B) cambios desde la copia (la clave se detecta en el catálogo —PK o índice único de una columna—; sin clave compara por huella de fila, **no se asume ninguna**), C) objetos, D) privilegios efectivos hoy vs snapshot, E) anon/authenticated sin acceso al respaldo. | No |
| `rls_p0_backup_restore.sql` | Restauración por etapa (R1–R5), cada bloque independiente; R1/R4 detectan la clave en el catálogo y se niegan a actuar sin clave única. | Solo si lo ejecutás |
| `rls_p0_snapshot_policies.sql` | (ya existente) Genera el DDL exacto de políticas/RLS/grants para guardarlo **fuera** de Supabase. | No |

Probado en un Postgres local con datos ficticios (`tests/rls/run-backup.sh`, 35 comprobaciones, con las 14 tablas reales, default privileges globales tipo Supabase, ACL implícito y una tabla sin clave única). **No se ejecutó nunca contra Supabase real.**

## 1. Antes de copiar (SQL Editor, solo lectura)
```sql
select pg_size_pretty(pg_database_size(current_database())) as base,
       pg_size_pretty(sum(pg_total_relation_size(c.oid))) as tablas_a_copiar
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and c.relname in ('alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides','ejercicio_overrides','ejercicios_custom','entrenadores','coach_calendar_assignments','ejercicios_custom_backup_pre_fase1');
```
El plan Free permite **500 MB** de base; al superarlos el proyecto pasa a **solo lectura** (la app dejaría de guardar series). El script aborta si `base + tablas > 400 MB`.
Datos reales confirmados: base ≈ 14 MB y tablas públicas ≈ 1,3 MB, así que la copia ocupa ≈ 1–2 MB (no duplica índices): el espacio no es un riesgo; la guarda queda como protección.

## 2. Orden de uso
1. Correr `rls_p0_preflight_readonly.sql` (gate) y **luego** `rls_p0_backup_create.sql` (pegar todo el archivo y ejecutar). Resultado esperado: tabla con los conteos del manifiesto.
   - Si el editor rechaza `BEGIN … COMMIT` o cortó a mitad, borrar lo creado con `drop schema backup_rls_p0 cascade;` y repetir (no hay forma de quedar con una copia a medias sin que lo notes: el script verifica conteos).
2. Correr los bloques de `rls_p0_backup_verify.sql`: **A** (todas las filas `ok_copia = true` y `ok_origen = true`), **D** (`cambiaron = 0` para los tres roles) y **E** (`usage_esquema = false` y `privilegios_tablas = 0` para anon y authenticated). Si algo no coincide, **no avanzar**.
3. Exportar fuera de Supabase (sección 4) **antes del backfill**.
4. Hacer el backfill y las migraciones según `docs/despliegue-rls-p0.md`. Después de cada etapa, bloque **B** (faltantes = 0 en todas las tablas; alumnos y rutinas pueden mostrar cambios "solo entrenador_id" tras el backfill).
5. Antes de la migración 2 conviene una segunda copia (renombrar la primera: `alter schema backup_rls_p0 rename to backup_rls_p0_pre_backfill;` y repetir el create), porque la primera ya no representa el estado posterior al backfill.

## 3. Restauración por etapa (`rls_p0_backup_restore.sql`)
| Situación | Bloque | Qué hace / qué NO hace |
|---|---|---|
| Falló algo **después del backfill** y antes de la migración 2 | **R1** (o `rls_p0_backfill_revert.sql`) | Devuelve `entrenador_id` al valor copiado solo en filas que existen en la copia y cambiaron. No toca otras columnas ni filas nuevas. Se niega a correr si la migración 2 sigue aplicada. |
| La migración 2 dejó la app inutilizable | Primero `supabase/rollback/…_rollback.sql`, luego **R2** | R2 borra las políticas actuales de las tablas gestionadas y recrea las **exactas** del snapshot; restaura RLS/FORCE y grants de PUBLIC/anon/authenticated desde el ACL efectivo (incluye los implícitos). Después, bloque **D** de verify: `cambiaron = 0`. Reabre la exposición anterior: solo emergencia. |
| Quedaron funciones/triggers nuevos | **R3** (indicaciones) | Usar el rollback; los objetos preexistentes no los toca ninguna migración. |
| Se borraron filas por error | **R4** (editar la lista de tablas) | Inserta solo filas de la copia cuya clave **no existe hoy**; no pisa filas existentes, modificadas ni nuevas. Un alumno o rutina borrados a propósito reaparecerían: revisar antes con el bloque B. Ajusta la secuencia. |
Orden de reversión total: R2 (tras el rollback de la migración 2) → R1 → frontend/función → `drop table public.coach_principal`.

## 4. Exportar lo esencial fuera de Supabase, desde el iPhone (gratis)
1. Safari → supabase.com/dashboard → proyecto IronTrack. Si la interfaz móvil no muestra todo: botón **aA → Solicitar sitio web de escritorio**.
2. **SQL Editor** → pegar, **Run** y exportar el resultado a CSV con el botón de descarga del panel de resultados (la interfaz cambia; alternativa: **Table Editor → tabla → Export/Download CSV**).
   Una consulta por tabla: `select * from public.alumnos;` … `rutinas`, `progreso`, `sesiones`, `mensajes`, `fotos`, `notas`, `config`, `entrenadores`, `video_overrides`, `ejercicio_overrides`, `ejercicios_custom`, `coach_calendar_assignments`.
   - **Límite**: el SQL Editor muestra como máximo ~1000 filas por resultado. Si una tabla tiene más (probable en `progreso` y `sesiones`), paginar: `select * from public.progreso order by id limit 1000 offset 0;`, luego `offset 1000`, etc., o usar Table Editor (exporta la tabla completa). Verificá el conteo con `select count(*) from public.progreso;`.
   - **Auth (sin contraseñas)**: `select id, email, created_at, last_sign_in_at, email_confirmed_at from auth.users;`
   - **Políticas/grants**: el resultado de `rls_p0_snapshot_policies.sql` (copiar como texto).
3. Guardar en **Archivos → En mi iPhone** (o iCloud Drive) con nombres `irontrack_AAAAMMDD_<tabla>.csv`. **No** enviarlos por correo, WhatsApp ni almacenamiento compartido: contienen datos personales de alumnos. Opcional: seleccionar todos → **Comprimir**.
4. Comprobar que cada CSV tenga tantas filas como `count(*)` de esa tabla.
Limitación: restaurar desde CSV es manual (importar con Table Editor o `COPY`) y pierde defaults/constraints (que sí están en el snapshot). Sirve como copia de **datos** fuera del proyecto, no como backup restaurable de punta a punta.

## 5. Qué NO protege la copia interna
- **Pérdida o pausa del proyecto / corrupción de la base / borrado accidental del esquema**: la copia está en el mismo disco y proyecto.
- **Auth completo**: solo se guardan id, email y fechas. **No** hay contraseñas (hashes), identidades, MFA, sesiones ni configuración de proveedores. Si Auth se pierde, los alumnos deben restablecer su contraseña.
- **Storage**: los archivos (fotos) no están en la base; la tabla `fotos` guarda solo referencias.
- **Funciones, triggers, secuencias**: solo definiciones/valores en texto (para recrear a mano); no son objetos restaurables automáticamente.
- **Datos posteriores a la copia**: series y mensajes nuevos no están en ella (por eso R4 nunca los pisa y conviene una segunda copia antes de la migración 2).
- **Configuración del proyecto**: claves API, JWT secret, Edge Functions y sus secretos, SMTP, URL de sitio, dominios, Vercel.
- **Roles y extensiones** de la base.

## 6. Riesgos de copiar dentro del mismo Supabase Free
- **Espacio**: copiar duplica los datos de esas tablas; al llegar a 500 MB el proyecto pasa a solo lectura. Mitigado con la guarda de 400 MB; verificá el tamaño antes (sección 1).
- **Datos personales duplicados** en el mismo proyecto: visibles para cualquiera con acceso al dashboard. No quedan expuestos por API (esquema distinto de `public`, RLS activo sin políticas, sin permisos para anon/authenticated); si en *Settings → API → Exposed schemas* agregaste otros esquemas, no incluyas `backup_rls_p0`.
- **Falsa sensación de seguridad**: es una instantánea puntual; borrarla o dejarla vieja la vuelve inútil. Después del despliegue, eliminarla cuando ya no haga falta (`drop schema backup_rls_p0 cascade;`) o conservarla en un esquema renombrado por fecha.
- **Proyectos Free** se pausan tras una semana sin actividad; la copia se pausa con el proyecto.

## 7. Qué falta para una garantía real (no bloquea la ventana, sí cierra el riesgo)
- `pg_dump` completo (esquemas `public` y `auth`, con datos) guardado cifrado fuera de Supabase, desde una computadora o un servicio con conexión directa a PostgreSQL (desde el entorno de Claude no hay conexión directa posible hoy).
- Respaldo de los archivos de Storage, si hay fotos que importen.
- Anotar fuera del proyecto: configuración de Auth, URLs, secretos de la Edge Function y variables de Vercel.

## Conclusión
La estrategia permite **continuar con RLS P0 de forma razonablemente segura**, porque el único paso que modifica datos es el backfill (`entrenador_id`) y las políticas se reconstruyen exactamente desde el snapshot; ambos tienen reversión probada localmente.
Lo que **no** cubre es la pérdida total del proyecto, Auth y Storage. Si aceptás ese riesgo para mañana, hacelo con: copia interna **verificada (bloque A)** + exportación CSV + salida de `snapshot_policies` guardadas en el iPhone.
