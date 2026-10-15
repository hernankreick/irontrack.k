# Ventana de despliegue RLS P0 — guía paso a paso desde iPhone

> **Estado del documento (revisión 2):** borrador local, rama `claude/irontrack-rls-p0-fix-r02vvv`, PR en borrador #89. De los 11 scripts SQL/migraciones de producción, **10 son idénticos** al commit `19dd5b54bd04a06097df1d5258ae584c74c7d6d4` y **uno fue corregido por seguridad**: la migración 2 (`..._rls_p0_lockdown.sql`) ahora impide que un usuario autenticado sin rol se cree su propia fila de `entrenadores` (commit `7432101bf7ec9025dc6a893d78dc9e4680292a3e`; ver B7 y la sección 3). Los archivos nuevos de esta revisión (verificaciones, exportación JSON, rotación de la copia, función de un solo archivo) son **solo lectura o de respaldo**.
> Ningún paso de esta guía fue ejecutado en producción. Todo lo marcado **[NUEVA]** se probó solo en un Postgres local con datos ficticios (y la función en Deno real).
> Complementa `docs/despliegue-rls-p0.md` (decisión y orden general) y `docs/respaldo-rls-p0.md` (qué cubre y qué NO cubre la copia interna).

## 0. Reglas que valen para toda la ventana
1. **Una operación por vez.** Después de cada paso, mirá el resultado y compará con "Esperado". Si no coincide, **NO CONTINUAR**: andá a "Si algo sale distinto".
2. **No pegues claves, contraseñas ni valores de variables** en chats, capturas ni este documento. Las capturas del SQL Editor pueden tener datos de alumnos: no las compartas.
3. **No hay interrupción cero.** Entre el backfill (B2) y que el frontend nuevo esté en Production (B3) el dashboard del entrenador viejo muestra 0 alumnos (unos minutos). Los alumnos que ya tengan la app abierta siguen entrenando, pero los que tengan la sesión guardada antes del backfill no cargan videos/nombres personalizados hasta volver a ingresar.
4. **El respaldo actual es interno** (esquema `backup_rls_p0` dentro del mismo proyecto). **No reemplaza un `pg_dump`**: no cubre pérdida del proyecto, Auth (contraseñas), Storage ni la configuración. Solo protege contra errores de nuestros propios cambios.
5. **Horario sugerido:** poco uso (temprano o de noche), ≈ 60–90 min con calma. Avisá a los alumnos antes (A4).
6. **Dónde pegar SQL:** Supabase → tu proyecto → **SQL Editor** → New query. En Safari del iPhone, si el panel no muestra todo: botón **aA → Solicitar sitio web de escritorio**. Pegá el texto completo, tocá **Run** y leé el resultado. Si el editor avisa de una "operación potencialmente destructiva" (puede pasar con `DROP`/`UPDATE`/`DELETE`), solo confirmá en los pasos que esta guía marca como esperables.
7. **El SQL Editor puede mostrar únicamente el resultado de la última sentencia.** Ejecutá los bloques de verificación de a uno.
8. **Cómo copiar un archivo largo desde GitHub en el iPhone:** abrí el enlace "Raw" de la tabla de la sección 5 (es texto plano, fijado al commit), mantené presionado el texto → **Seleccionar todo** → **Copiar**; volvé al SQL Editor y **Pegar**. Comprobá que la primera y la última línea coincidan con lo que indica el paso.

---

## 1. Verificación inicial de Vercel (antes de cualquier SQL)
**Objetivo:** asegurar que las Previews no tienen credenciales de Supabase Production y que `main` es la rama de Production.

1. Safari → vercel.com → proyecto **irontrack-k** → **Settings → Environment Variables**.
2. Buscá las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (y cualquier otra `VITE_SUPABASE_*`).
3. En cada fila, mirá **a qué entornos aplica** (la lista muestra etiquetas del tipo Production / Preview / Development; el nombre exacto puede variar según la versión del panel).
   - **No toques el ícono de "mostrar valor"** ni copies valores: para esta verificación no hacen falta.
   - Esperado: cada `VITE_SUPABASE_*` aplica **solo a Production**. Ninguna aplica a Preview.
4. **Settings → Git**: **Production Branch** = `main`.
5. **Deployments**: confirmá cuál es el despliegue de Production actual (commit `5aeec6c…`). Anotá su nombre/hora: es el destino de un eventual Instant Rollback.
6. Abrí el PR #89 en GitHub (`github.com/hernankreick/irontrack.k/pull/89`): debe seguir en **Draft**, con `main` en `5aeec6ce407835f35923ca4c7f7acf40acd51319`.

**NO CONTINUAR si:** alguna `VITE_SUPABASE_*` aparece en Preview, o no podés ver los entornos de cada variable, o Production Branch no es `main`. En ese caso la separación **no está confirmada** y no se avanza (una Preview con credenciales de producción podría escribir en datos reales).

---

## A. Antes de la ventana (solo lectura / respaldo)

### A1. Preflight de solo lectura (repetirlo: el estado puede haber cambiado)
- Archivo: `sql/rls_p0_preflight_readonly.sql` (110 líneas, ver enlace Raw en la sección 5).
- iPhone: copiar completo → SQL Editor → Run.
- **Esperado:** ninguna fila con `resultado = FALLA` y `gate = BLOQUEANTE`. Datos que debe confirmar: 9 alumnos con `entrenador_principal`, 0 sin `auth_uid`, el entrenador principal presente en `auth.users` y `entrenadores`, columnas y tipos usados.
- **NO CONTINUAR** si hay un `FALLA` con `BLOQUEANTE`: copiá solo esas filas (no contienen datos personales) y pedí corrección antes de seguir.

### A2. Snapshot exacto de políticas y grants (para guardar FUERA de Supabase)
- Archivo: `sql/rls_p0_snapshot_policies.sql` (solo lectura). Contenido completo:
```sql
-- =============================================================================
-- RESPALDO EXACTO de políticas y grants ANTES de aplicar la migración RLS (SQL Editor, solo lectura).
-- Guardar el resultado: es la fuente de verdad para restaurar el estado previo si el rollback genérico no alcanza
-- (en particular ejercicios_custom, cuya política original no está versionada).
-- =============================================================================
SELECT '-- POLITICAS' AS ddl
UNION ALL
SELECT format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',
         policyname, schemaname, tablename, permissive, cmd,
         array_to_string(roles, ', '),
         CASE WHEN qual IS NOT NULL THEN ' USING (' || regexp_replace(qual, E'\\s+', ' ', 'g') || ')' ELSE '' END,
         CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || regexp_replace(with_check, E'\\s+', ' ', 'g') || ')' ELSE '' END)
  FROM pg_policies WHERE schemaname = 'public'
UNION ALL
SELECT '-- RLS: ' || format('ALTER TABLE %I.%I %s ROW LEVEL SECURITY;', n.nspname, c.relname,
         CASE WHEN c.relrowsecurity THEN 'ENABLE' ELSE 'DISABLE' END)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'
UNION ALL
SELECT '-- GRANTS: ' || format('GRANT %s ON %I.%I TO %s;', string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type), n.nspname, c.relname, a.grantee::regrole::text)
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole)
 GROUP BY n.nspname, c.relname, a.grantee;
```
- **Esperado:** una lista de sentencias `CREATE POLICY`, `ALTER TABLE … ROW LEVEL SECURITY` y `GRANT`. Copiá el resultado como texto y guardalo en **Archivos → En mi iPhone** (nota de texto; no por correo/WhatsApp).
- Si el panel no deja copiar toda la columna: exportá el resultado a CSV con el botón de descarga del panel de resultados (si existe en tu versión) o repetí el paso en dos partes.

### A3. Respaldo: exportación externa + copia interna fresca
> El respaldo interno **no es un backup completo** (ver sección 0, regla 4). Hacé primero 1 (externo) y después 2 (interno).

**1) Exportación externa desde el iPhone (la única copia que sobrevive a la pérdida del proyecto).** Dos vías, sin credenciales ni herramientas externas:
- **JSON por consulta (recomendada, probada ida y vuelta en local):** `sql/rls_p0_export_json.sql` (solo lectura, no pide editar nada). Devuelve **una fila por tabla** (14) con `filas`, `huella` (md5) y `datos` (todo el contenido en JSON). Copiá la celda `datos` de cada fila a una nota o archivo de texto en **Archivos → En mi iPhone**, con el nombre `irontrack_AAAAMMDD_<tabla>.json`, y anotá `filas` y `huella`. Con la misma consulta después de una restauración, `filas` y `huella` deben coincidir. Restaurar (emergencia, con asistencia y solo en una tabla vacía) usa `jsonb_populate_recordset`; el procedimiento está en el encabezado del archivo.
```sql
-- =============================================================================
-- EXPORTACIÓN EXTERNA EN JSON (SQL Editor de Supabase, desde el iPhone). SOLO LECTURA. No requiere editar nada.
-- Devuelve 14 filas: tabla, filas, huella (md5) y datos (todo el contenido de la tabla como JSON). Copiá cada celda "datos" a una nota
-- o archivo de texto en Archivos → En mi iPhone. CONTIENE DATOS PERSONALES DE ALUMNOS: no la envíes por correo ni mensajería ni la subas a un
-- servicio compartido; guardala solo en el dispositivo (o en un almacenamiento tuyo y cifrado).
-- Verificación: la "huella" y "filas" se pueden volver a calcular con la misma consulta tras restaurar y deben coincidir.
-- Si una celda es demasiado grande para copiarla desde el iPhone: usar Table Editor → Export (CSV) para esa tabla (docs/respaldo-rls-p0.md, sección 4).
-- Restaurar (emergencia, con asistencia, y solo en una tabla VACÍA; reemplazar <tabla> y pegar el JSON entre los delimitadores):
--   INSERT INTO public.<tabla> SELECT * FROM jsonb_populate_recordset(null::public.<tabla>, $irontrack_json$ ...JSON... $irontrack_json$::jsonb);
-- =============================================================================
SELECT 'alumnos' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.alumnos t
UNION ALL
SELECT 'progreso' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.progreso t
UNION ALL
SELECT 'rutinas' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.rutinas t
UNION ALL
SELECT 'sesiones' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.sesiones t
UNION ALL
SELECT 'fotos' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.fotos t
UNION ALL
SELECT 'mensajes' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.mensajes t
UNION ALL
SELECT 'config' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.config t
UNION ALL
SELECT 'notas' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.notas t
UNION ALL
SELECT 'video_overrides' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.video_overrides t
UNION ALL
SELECT 'ejercicio_overrides' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.ejercicio_overrides t
UNION ALL
SELECT 'ejercicios_custom' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.ejercicios_custom t
UNION ALL
SELECT 'entrenadores' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.entrenadores t
UNION ALL
SELECT 'coach_calendar_assignments' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.coach_calendar_assignments t
UNION ALL
SELECT 'ejercicios_custom_backup_pre_fase1' AS tabla, count(*) AS filas, md5(coalesce(string_agg(to_jsonb(t)::text, E'\n' ORDER BY to_jsonb(t)::text), '')) AS huella, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS datos FROM public.ejercicios_custom_backup_pre_fase1 t
ORDER BY 1;
```
  - **Límite que no pude verificar:** si el panel o iOS no permiten copiar una celda muy grande (la tabla `progreso` o `sesiones` pueden ser las más pesadas; la base entera ocupa ≈ 14 MB), usá la vía CSV para esa tabla.
- **CSV:** `docs/respaldo-rls-p0.md`, sección 4 (Table Editor → Export, o el botón de descarga del resultado del SQL Editor). Verificar que cada CSV tenga tantas filas como `count(*)`.
- **Privacidad:** estos archivos contienen datos personales de alumnos. **No** los envíes por correo, WhatsApp ni los subas a un servicio compartido. Guardalos solo en el dispositivo (o en un almacenamiento propio cifrado). No contienen claves ni contraseñas (Auth no se exporta).
- **Qué NO cubre ninguna de las dos:** Auth (contraseñas), Storage ni la configuración del proyecto. Para eso hace falta un `pg_dump` completo desde una computadora, o un plan de Supabase con backups automáticos (decisión tuya; no verifiqué condiciones ni precios).

**2) Copia interna fresca justo antes del backfill** (la que existe hoy es de antes del uso reciente; una nueva refleja el estado exacto previo a B2). Procedimiento de rotación **sin DROP y sin sobrescribir nada** (archivo `sql/rls_p0_backup_rotar.sql`, cada sección se ejecuta por separado):

| Esquema | Qué es | Quién lo usa |
|---|---|---|
| `backup_rls_p0` | La copia **vigente** | `verify` y `restore` usan **siempre** este nombre exacto |
| `backup_rls_p0_prev` | La copia **anterior** (guardada) | Nadie, mientras se llame `_prev` |

   1. Primero ejecutar **ROTAR-1** (renombra la actual a `backup_rls_p0_prev` y la etiqueta; se niega si `_prev` ya existe):
```sql
-- ROTAR-1 · ANTES de sql/rls_p0_backup_create.sql: la copia actual pasa a llamarse backup_rls_p0_prev
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NULL THEN RAISE EXCEPTION 'No existe backup_rls_p0: no hay nada que rotar'; END IF;
  IF to_regnamespace('backup_rls_p0_prev') IS NOT NULL THEN RAISE EXCEPTION 'backup_rls_p0_prev ya existe: no se sobrescribe (ejecutar IDENTIFICAR y decidir)'; END IF;
  EXECUTE format('COMMENT ON SCHEMA backup_rls_p0 IS %L', 'COPIA ANTERIOR (renombrada el ' || now()::date || '). verify/restore NO la usan mientras se llame _prev.');
  ALTER SCHEMA backup_rls_p0 RENAME TO backup_rls_p0_prev;
END $$;
```
   2. Ejecutar `sql/rls_p0_backup_create.sql` (148 líneas, Raw en la sección 3), pegado completo, un solo Run. Empieza con un bloque de comentarios (`-- COPIA INTERNA (NO es un backup completo) previa a RLS P0…`) y termina con `SELECT m.tbl, m.row_count FROM backup_rls_p0.manifest m ORDER BY m.tbl;`. **Esperado:** las 14 tablas con sus conteos.
   3. Ejecutar **ROTAR-2** (etiqueta la fresca):
```sql
-- ROTAR-2 · DESPUÉS de que sql/rls_p0_backup_create.sql terminó bien: etiqueta la copia fresca
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NULL THEN RAISE EXCEPTION 'No existe backup_rls_p0: el create no terminó'; END IF;
  EXECUTE format('COMMENT ON SCHEMA backup_rls_p0 IS %L', 'COPIA FRESCA previa al backfill (creada el ' || now()::date || '). La usan verify y restore.');
END $$;
```
   4. Ejecutar **IDENTIFICAR** (solo lectura). **Esperado:** 2 filas: `backup_rls_p0` con nota "COPIA FRESCA…", `usada_por_verify_restore = true`; y `backup_rls_p0_prev` con nota "COPIA ANTERIOR…", `usada_por_verify_restore = false`. En ambas: `tablas_copiadas = 14`, `anon_usage = false`, `authenticated_usage = false`, `privilegios_tablas_anon_auth = 0`.
```sql
-- IDENTIFICAR · SOLO LECTURA: ¿qué copias hay y cuál usan verify/restore?  (usada_por_verify_restore = true solo para backup_rls_p0)
SELECT n.nspname AS esquema,
       obj_description(n.oid, 'pg_namespace') AS nota,
       (xpath('/row/c/text()', query_to_xml(format('SELECT count(*) AS c FROM %I.manifest', n.nspname), false, true, '')))[1]::text AS tablas_copiadas,
       (xpath('/row/c/text()', query_to_xml(format('SELECT coalesce(sum(row_count), 0) AS c FROM %I.manifest', n.nspname), false, true, '')))[1]::text AS filas_en_manifest,
       n.nspname = 'backup_rls_p0' AS usada_por_verify_restore,
       has_schema_privilege('anon', n.oid, 'USAGE') AS anon_usage,
       has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_usage,
       (SELECT count(*) FROM pg_class c CROSS JOIN pg_roles ro CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER')) p(priv)
         WHERE c.relnamespace = n.oid AND c.relkind = 'r' AND ro.rolname IN ('anon', 'authenticated') AND has_table_privilege(ro.rolname, c.oid, p.priv)) AS privilegios_tablas_anon_auth
  FROM pg_namespace n
 WHERE n.nspname IN ('backup_rls_p0', 'backup_rls_p0_prev', 'backup_rls_p0_fresca')
 ORDER BY n.nspname;
```
   5. Ejecutar **de a uno** los bloques **A**, **D** y **E** de `sql/rls_p0_backup_verify.sql` (Raw en la sección 3; cada bloque empieza con un comentario `-- A)`, `-- D)`, `-- E)` y llega hasta antes del siguiente comentario con letra). Siempre operan sobre `backup_rls_p0` (la fresca).
      - **A:** las 14 filas con `ok_copia = true` y `ok_origen = true` (si una `ok_origen` da `false` porque un alumno guardó una serie en ese instante, repetí A; `ok_copia` debe ser siempre `true`).
      - **D:** todas las filas con `cambiaron = 0`.
      - **E:** `usage_esquema = false` y `privilegios_tablas = 0` para `anon` y `authenticated`.
   - **Si el create falla** (es transaccional: no deja una copia a medias; nunca uses `DROP … CASCADE` para "limpiar"): ejecutar **DESHACER**, que devuelve a `_prev` su nombre original:
```sql
-- DESHACER · si el create FALLÓ después de ROTAR-1 (el create es transaccional: no deja una copia a medias): devuelve el nombre original
DO $$
BEGIN
  IF to_regnamespace('backup_rls_p0') IS NOT NULL THEN RAISE EXCEPTION 'backup_rls_p0 existe: no se deshace nada (ejecutar IDENTIFICAR)'; END IF;
  IF to_regnamespace('backup_rls_p0_prev') IS NULL THEN RAISE EXCEPTION 'No existe backup_rls_p0_prev: nada que devolver'; END IF;
  ALTER SCHEMA backup_rls_p0_prev RENAME TO backup_rls_p0;
  EXECUTE format('COMMENT ON SCHEMA backup_rls_p0 IS %L', 'COPIA ORIGINAL (nombre devuelto el ' || now()::date || ').');
END $$;
```
   - **Cómo se restaura desde cada copia sin confusión:** `restore` (R1–R5) trabaja con lo que se llame `backup_rls_p0`. Para usar la **anterior** en una emergencia, ejecutar **INTERCAMBIAR-A-ANTERIOR** (la fresca pasa a `backup_rls_p0_fresca`), correr el bloque de restauración que corresponda, y luego **INTERCAMBIAR-A-FRESCA** para dejar los nombres como estaban. Los dos intercambios se niegan si el estado no es el esperado. Ambos están en `sql/rls_p0_backup_rotar.sql` (probados en local con el ciclo completo, incluido R4 desde la anterior sin pisar datos nuevos).
- **NO CONTINUAR** si el create falla, si alguna verificación no coincide, si falta alguna tabla o si IDENTIFICAR no muestra lo esperado.
- Límite del espacio: el script aborta solo si base + copia supera 400 MB (hoy la base ≈ 14 MB; dos copias ≈ 3 MB).

### A4. Aviso a los alumnos
Mensaje corto: "Hoy [hora] hacemos una mejora de seguridad. Si la app te pide volver a ingresar, usá tu mismo usuario y contraseña." No prometas "sin cortes".

---

## B. Ventana

### B1. Migración 1 — tabla `coach_principal` (inocua)
- Archivo: `supabase/migrations/20261010110000_rls_p0_coach_principal.sql`. Contenido completo:
```sql
-- =============================================================================
-- IronTrack — RLS P0, paso previo: identidad PROTEGIDA del entrenador principal.
-- Tabla de una sola fila (singleton). Los clientes (anon/authenticated) solo pueden LEER
-- su propia fila; nadie puede insertar, modificar ni borrar desde la API. La fila se carga
-- manualmente con sql/rls_p0_backfill_entrenador_principal.sql (rol postgres / SQL Editor).
-- No cambia el comportamiento de la app: es segura de aplicar sola.
-- =============================================================================
BEGIN;
CREATE TABLE IF NOT EXISTS public.coach_principal (
  singleton  boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  uid        uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_principal ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.coach_principal FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.coach_principal TO authenticated;
-- service_role (Edge Functions) bypasea RLS pero necesita el privilegio de tabla; no depender de los default privileges del proyecto.
GRANT SELECT ON TABLE public.coach_principal TO service_role;
DROP POLICY IF EXISTS coach_principal_select_self ON public.coach_principal;
CREATE POLICY coach_principal_select_self ON public.coach_principal FOR SELECT TO authenticated
  USING (uid::text = auth.uid()::text);
COMMIT;
```
- **Esperado:** "Success. No rows returned". Verificación **[NUEVA]** (solo lectura):
```sql
SELECT count(*) AS filas_coach_principal, to_regclass('public.coach_principal') IS NOT NULL AS tabla_existe FROM public.coach_principal;
```
  Resultado esperado: `0` y `true` (la fila se carga en B2).
- Si el editor rechaza `BEGIN … COMMIT`: pegá el contenido sin esas dos líneas y avisame antes de seguir (no modifico el archivo sin tu autorización).
- **Rollback:** `DROP TABLE public.coach_principal;` (solo si B2 aún no se ejecutó).

### B2. Backfill — reemplazar `entrenador_principal` por el UID real
> ⚠️ **PASO RIESGOSO.** Desde que termina, el frontend viejo muestra 0 alumnos. Tené abierto B3 y avanzá enseguida. Antes de correrlo, confirmá que A3 (copia fresca) quedó verificada.
- Archivo: `sql/rls_p0_backfill_sql_editor.sql` (un bloque = una transacción; si una precondición falla no modifica nada; registra solo ids en `rls_p0_backfill_log`). El UID del entrenador principal ya está en el script (confirmado por vos antes). Contenido completo:
```sql
-- =============================================================================
-- VARIANTE PARA EL SQL EDITOR DE SUPABASE (sin metacomandos de psql). Equivale a
-- sql/rls_p0_backfill_entrenador_principal.sql con valores fijos. NO EJECUTAR sin revisión.
-- Orden: después de 20261010110000_rls_p0_coach_principal.sql y antes de 20261010120000_rls_p0_lockdown.sql.
-- Un solo bloque = una sola transacción: si alguna precondición falla, no se modifica nada.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.rls_p0_backfill_log (
  tbl text NOT NULL, row_key text NOT NULL, logged_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tbl, row_key)
);
ALTER TABLE public.rls_p0_backfill_log ENABLE ROW LEVEL SECURITY;  -- sin políticas ni grants: solo postgres/service_role
REVOKE ALL ON TABLE public.rls_p0_backfill_log FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  principal_uid  text := 'e2447231-c0ba-4f90-946f-63bf364570af';
  expected_legacy int := 9;
  n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text = principal_uid)
     OR NOT EXISTS (SELECT 1 FROM public.entrenadores WHERE id::text = principal_uid) THEN
    RAISE EXCEPTION 'principal_uid no existe en auth.users/entrenadores';
  END IF;
  IF EXISTS (SELECT 1 FROM public.alumnos WHERE auth_uid::text = principal_uid) THEN
    RAISE EXCEPTION 'el entrenador principal figura como alumnos.auth_uid';
  END IF;
  IF EXISTS (SELECT 1 FROM public.coach_principal WHERE uid::text <> principal_uid) THEN
    RAISE EXCEPTION 'coach_principal ya contiene otro uid';
  END IF;
  SELECT count(*) INTO n FROM public.alumnos WHERE entrenador_id::text = 'entrenador_principal';
  IF n <> expected_legacy THEN
    RAISE EXCEPTION 'alumnos legacy = % (esperado %)', n, expected_legacy;
  END IF;

  -- Registro de las filas legacy (solo ids) para revertir con sql/rls_p0_backfill_revert.sql
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'alumnos', id::text FROM public.alumnos WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'rutinas', id::text FROM public.rutinas WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'video_overrides', ejercicio_id::text FROM public.video_overrides WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'ejercicio_overrides', ejercicio_id::text FROM public.ejercicio_overrides WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.rls_p0_backfill_log(tbl,row_key) SELECT 'ejercicios_custom', id::text FROM public.ejercicios_custom WHERE entrenador_id::text = 'entrenador_principal' ON CONFLICT DO NOTHING;
  INSERT INTO public.coach_principal(uid) VALUES (principal_uid::uuid) ON CONFLICT (singleton) DO NOTHING;
  UPDATE public.alumnos             SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.rutinas             SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.video_overrides     SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.ejercicio_overrides SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
  UPDATE public.ejercicios_custom   SET entrenador_id = principal_uid WHERE entrenador_id::text = 'entrenador_principal';
END $$;
```
- **Esperado:** "Success. No rows returned". Pueden aparecer avisos de "UPDATE sin WHERE" del editor: el script usa `WHERE` y es esperable.
- **Verificación [NUEVA]** (solo lectura):
```sql
-- =============================================================================
-- VERIFICACIÓN B2 (post-backfill) — SOLO LECTURA (SQL Editor de Supabase). No requiere editar nada. Devuelve una fila con conteos.
-- Esperado tras el backfill: alumnos_legacy=0, alumnos_con_uid=9, rutinas_legacy=0, video_legacy=0, ejoverr_legacy=0, custom_legacy=0,
-- principal=1, filas_en_registro>=9.
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.alumnos             WHERE entrenador_id::text = 'entrenador_principal') AS alumnos_legacy,
  (SELECT count(*) FROM public.alumnos             WHERE entrenador_id::text = 'e2447231-c0ba-4f90-946f-63bf364570af') AS alumnos_con_uid,
  (SELECT count(*) FROM public.rutinas             WHERE entrenador_id::text = 'entrenador_principal') AS rutinas_legacy,
  (SELECT count(*) FROM public.video_overrides     WHERE entrenador_id::text = 'entrenador_principal') AS video_legacy,
  (SELECT count(*) FROM public.ejercicio_overrides WHERE entrenador_id::text = 'entrenador_principal') AS ejoverr_legacy,
  (SELECT count(*) FROM public.ejercicios_custom   WHERE entrenador_id::text = 'entrenador_principal') AS custom_legacy,
  (SELECT count(*) FROM public.coach_principal) AS principal,
  (SELECT count(*) FROM public.rls_p0_backfill_log) AS filas_en_registro;
```
  Esperado: `alumnos_legacy = 0`, `alumnos_con_uid = 9`, `rutinas_legacy = 0`, `video_legacy = 0`, `ejoverr_legacy = 0`, `custom_legacy = 0`, `principal = 1`, `filas_en_registro ≥ 9`.
- **Si da error** (por ejemplo `alumnos legacy = N (esperado 9)`): no se aplicó nada; **NO CONTINUAR**, anotá el mensaje exacto y pedí asistencia.
- **Si se aplicó pero algo no coincide:** **NO CONTINUAR** a B3 y revertí con la sección 3 (fila B2).
- **NO CONTINUAR a B3 ni a B7** hasta ver la verificación correcta.

### B3. Frontend nuevo a Production (PR #89 → merge)
> ⚠️ **PASO RIESGOSO (publica código).** Solo si B2 verificó bien y tenés autorizado el merge por escrito.
1. GitHub (Safari) → PR #89 → **Ready for review** → confirmar que sigue sin conflictos → **Merge pull request** (merge commit estándar) → **Confirm merge**.
2. Vercel → **Deployments**: aparece un despliegue de Production nuevo; esperá **Ready**. Tarda unos minutos.
3. Abrí la app de producción en una pestaña nueva: debe cargar el login. (El build de Production exige las variables `VITE_SUPABASE_*`; ya están en Production según la verificación inicial.)
- **Esperado:** despliegue `Ready`, login visible.
- **Si el build falla (Error):** **NO CONTINUAR**. Production sigue sirviendo el despliegue anterior (Vercel no promueve un build fallido), pero el frontend viejo no ve alumnos desde B2 → revertí B2 (sección 3) y pedí asistencia.
- **Si queda Ready pero la app no carga:** Instant Rollback del despliegue anterior (sección 3) **y** revertir B2.

### B4. Edge Function `update-alumno-password` — desde el editor web de Supabase (versión de un solo archivo)
- **Por qué hace falta una versión especial:** la función de producción está en dos archivos (`index.ts` + `core.js`); el editor del panel no es un CLI y no puedo afirmar que acepte varios archivos. Por eso se generó `supabase/functions/update-alumno-password/index.single.ts`: **la misma función en un solo archivo**, producida por `node scripts/build-edge-single.mjs` a partir de `core.js` + `index.ts` (no se edita a mano; un test falla si dejan de coincidir). No contiene secretos: usa las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` que Supabase inyecta en las Edge Functions.
- **Probado en local:** el archivo `index.single.ts` se sirvió con **Deno 2.9 real** y pasó la secuencia end-to-end completa (22/22: sin sesión rechazada, alumno de otro entrenador rechazado, creación y vínculo de `auth_uid`, segundo cambio de contraseña, 409 por email ya existente en Auth, cuenta del entrenador principal protegida). **No probado:** el runtime Edge de Supabase en sí ni el comportamiento del editor web.
- **Antes de tocar nada:** abrí la función en **Edge Functions** del panel y **copiá el código actual** a una nota en Archivos (`irontrack_update-alumno-password_ANTERIOR.ts`): es tu rollback.
- **Pasos (los nombres exactos de los botones dependen de tu versión del panel; no los doy por seguros):**
  1. Supabase → **Edge Functions** → `update-alumno-password` → abrir el editor de código.
  2. Si el panel no permite editarla (p. ej. por haberse desplegado con CLI) o exige varios archivos: **NO CONTINUAR con esta vía**; ver "Plan B" abajo.
  3. Reemplazar **todo** el contenido por el de `index.single.ts` (115 líneas; contenido abajo o Raw en la sección 3). Primera línea: `// GENERADO por scripts/build-edge-single.mjs…`; última: el cierre `})` de `Deno.serve`.
  4. Guardar/desplegar con el botón que ofrezca el panel (por ejemplo "Deploy updates"). No toques secretos ni la opción de verificación de JWT: la función ya valida la sesión del solicitante.
- **Verificación:** desde la app, con el entrenador, cambiar la contraseña del **alumno de prueba** (checklist, ítem 6): debe decir éxito y el alumno debe poder entrar con la nueva. También: el mismo cambio sobre un alumno que no es tuyo no es probable de hacer desde la app; esa regla está cubierta en la prueba local.
- **Qué falla si no se despliega:** solo el cambio de contraseña de alumnos desde el panel del entrenador. No bloquea B7. La función vieja sigue activa con su comportamiento anterior.
- **Plan B si el editor no sirve:** el despliegue con CLI desde una computadora (`supabase functions deploy update-alumno-password`) cuando la tengas; mientras tanto, B7 puede seguir y queda anotado como pendiente. **No** crees tokens de acceso ni pegues claves en un entorno de terceros para forzar esto desde el iPhone.
- **Rollback:** pegar de nuevo el código guardado en la nota "ANTERIOR" y desplegar.

Contenido completo de `index.single.ts`:
```ts
// GENERADO por scripts/build-edge-single.mjs a partir de core.js + index.ts. NO EDITAR A MANO.
// Version de UN solo archivo de la Edge Function `update-alumno-password`, para el editor web de Supabase.
// @ts-nocheck  (core.js es JavaScript sin anotaciones de tipos; se prueba en scripts/test-updateAlumnoPassword.mjs)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ───────── core.js (logica pura) ─────────
// Logica pura (sin Deno ni red) de update-alumno-password, con el cliente admin inyectado para poder probarla.
//
// Reglas (RLS P0):
//  - El alumno se identifica por alumnoId (no por email) y debe pertenecer al entrenador autenticado: alumnos.entrenador_id = caller.id.
//    El identificador legacy de entrenador unico YA NO otorga propiedad (el backfill lo reemplaza por el UUID real).
//  - alumnos.auth_uid se asigna SOLO aqui y SOLO cuando esta misma llamada crea la cuenta de Auth. Nunca por coincidencia de email:
//    si ya existe una cuenta de Auth con ese email que no esta vinculada al alumno, se rechaza (409) sin tocarla.
//  - Si el alumno ya esta vinculado, se actualiza la cuenta por auth_uid (no se busca por email).

const json = (status, body) => ({ status, body });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleUpdateAlumnoPassword({ callerToken, body, admin }) {
  if (!callerToken) return json(401, { error: 'missing authorization' });
  const alumnoId = body && body.alumnoId != null ? String(body.alumnoId) : '';
  const newPassword = body && body.newPassword ? String(body.newPassword) : '';
  if (!alumnoId || !newPassword) return json(400, { error: 'alumnoId and newPassword required' });
  if (!UUID_RE.test(alumnoId)) return json(400, { error: 'alumnoId invalido' });

  const { data: callerData, error: callerError } = await admin.auth.getUser(callerToken);
  const caller = callerData && callerData.user;
  if (callerError || !caller) return json(401, { error: 'invalid session' });

  const { data: alumno, error: alumnoError } = await admin
    .from('alumnos').select('id, email, entrenador_id, auth_uid').eq('id', alumnoId).maybeSingle();
  if (alumnoError) return json(500, { error: alumnoError.message });
  if (!alumno || String(alumno.entrenador_id) !== String(caller.id)) {
    return json(403, { error: 'not authorized for this student' }); // misma respuesta si no existe o no es suyo
  }
  const email = String(alumno.email || '').trim().toLowerCase();
  if (!email) return json(400, { error: 'alumno sin email' });

  // Ya vinculado: actualizar por auth_uid (y alinear el email de la cuenta con el del alumno).
  if (alumno.auth_uid) {
    // Nunca se modifica la cuenta del propio solicitante ni la del entrenador principal (un vinculo erroneo no debe permitirlo).
    if (String(alumno.auth_uid) === String(caller.id)) return json(403, { error: 'cuenta protegida' });
    const { data: principal, error: principalError } = await admin
      .from('coach_principal').select('uid').eq('uid', String(alumno.auth_uid)).maybeSingle();
    if (principalError) return json(500, { error: 'no se pudo verificar la cuenta' }); // falla cerrado
    if (principal) return json(403, { error: 'cuenta protegida' });
    const { error } = await admin.auth.admin.updateUserById(String(alumno.auth_uid), { password: newPassword, email, email_confirm: true });
    if (error) return json(400, { error: error.message });
    return json(200, { ok: true });
  }

  // Sin vinculo: si el email ya existe en Auth NO se adopta esa cuenta (seria vincular por coincidencia de email).
  const existing = await findAuthUserByEmail(admin, email);
  if (existing) {
    return json(409, { error: 'ya existe una cuenta de Auth con ese email que no esta vinculada a este alumno; vincularla manualmente tras verificar su titularidad' });
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password: newPassword, email_confirm: true, user_metadata: { role: 'alumno' },
  });
  const newUser = created && created.user;
  if (createError || !newUser) return json(400, { error: (createError && createError.message) || 'no se pudo crear la cuenta' });

  // Vinculo atomico: solo si sigue sin vincular. Si falla, se revierte la cuenta recien creada.
  const { data: linked, error: linkError } = await admin
    .from('alumnos').update({ auth_uid: newUser.id }).eq('id', alumno.id).is('auth_uid', null).select('id');
  if (linkError || !linked || linked.length !== 1) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(newUser.id);
    if (deleteError) {
      // Reversion fallida: no se afirma que se revirtio; se informa el id para limpiarlo manualmente.
      return json(500, { error: 'no se pudo vincular la cuenta y tampoco revertir su creacion; eliminar manualmente la cuenta de Auth ' + newUser.id });
    }
    return json(500, { error: 'no se pudo vincular la cuenta al alumno; se revirtio la creacion' });
  }
  return json(200, { ok: true, linked: true });
}

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = (data && data.users) || [];
    const match = users.find((u) => String(u.email || '').toLowerCase() === email);
    if (match) return match;
    if (users.length < 200) break;
  }
  return null;
}

// ───────── index.ts (servidor) ─────────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    let body = null
    try { body = await req.json() } catch (_e) { body = null }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { status, body: out } = await handleUpdateAlumnoPassword({ callerToken, body, admin })
    return new Response(JSON.stringify(out), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

### B5. Pruebas con RLS todavía abierta (rollback sin riesgo de seguridad)
Ejecutar el checklist de la sección 2 completo. Es el último punto seguro para volver atrás sin reabrir la exposición.
- **NO CONTINUAR a B6/B7** si falla login del entrenador, aparece una cantidad distinta de 9 alumnos, no se ve una rutina, o una serie no persiste.

### B6. Rotar la contraseña de Auth del entrenador
> ⚠️ **PASO NO REVERTIBLE.** Solo después de B3 (el login del frontend viejo usaba una contraseña por defecto; el nuevo usa la que escribas) y antes de B7.
- Supabase → **Authentication → Users** → la cuenta del entrenador. Usá la acción que tu versión del panel ofrezca para restablecer o enviar un enlace de recuperación (los nombres exactos de los botones pueden variar; **no los doy por supuestos**). Si la recuperación es por correo, **verificá antes que tenés acceso a ese correo**.
- Elegí una contraseña nueva larga y única, **sin escribirla en chats ni notas compartidas**; guardala en el llavero de iPhone.
- **Verificación:** cerrar sesión en la app, iniciar con la contraseña nueva (debe entrar), y comprobar que la contraseña anterior ya no entra.
- **NO CONTINUAR a B7** si no podés iniciar sesión con la nueva: sin acceso del entrenador, el lockdown dejaría el panel inaccesible.

### B7. Migración 2 — lockdown RLS
> ⚠️ **PASO RIESGOSO.** Es transaccional: si una precondición falla, aborta sin cambiar nada. Tené a mano la sección 2 (fila B7) y el snapshot de A2.
- **Verificación previa [NUEVA, solo lectura]:** la política anterior dejaba que *cualquier* cuenta autenticada se creara una fila en `entrenadores` (eso da privilegios de entrenador). La migración 2 cierra el alta pero **no borra filas ya creadas**. Ejecutá esta consulta (solo conteos):
```sql
-- =============================================================================
-- VERIFICACIÓN PREVIA A LA MIGRACIÓN 2 — filas de `entrenadores` que otorgan privilegios. SOLO LECTURA, no requiere editar nada, solo conteos.
-- Con la política anterior (abierta) cualquier cuenta autenticada pudo crearse una fila en `entrenadores`; esa fila da privilegios de entrenador
-- (salvo que la cuenta sea alumno). La migración 2 cierra el alta, pero NO borra filas ya creadas.
-- Ejecutar después del backfill (B2) y ANTES de la migración 2 (B7):
--   principal = 1, otras_con_privilegios = 0 (o exactamente los entrenadores legítimos que conozcas).
--   vinculadas_a_alumnos son filas de alumnos creadas por el cliente antiguo: no otorgan privilegios (se pueden borrar a mano después).
-- Si otras_con_privilegios > 0 y no las reconocés: NO CONTINUAR a B7 (pedir asistencia para revisarlas).
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.entrenadores) AS filas_entrenadores,
  (SELECT count(*) FROM public.entrenadores e WHERE EXISTS (SELECT 1 FROM public.coach_principal cp WHERE cp.uid::text = e.id::text)) AS principal,
  (SELECT count(*) FROM public.entrenadores e WHERE EXISTS (SELECT 1 FROM public.alumnos a WHERE a.auth_uid::text = e.id::text)) AS vinculadas_a_alumnos,
  (SELECT count(*) FROM public.entrenadores e
    WHERE NOT EXISTS (SELECT 1 FROM public.coach_principal cp WHERE cp.uid::text = e.id::text)
      AND NOT EXISTS (SELECT 1 FROM public.alumnos a WHERE a.auth_uid::text = e.id::text)) AS otras_con_privilegios;
```
  Esperado: `principal = 1` y `otras_con_privilegios = 0` (o exactamente los entrenadores legítimos que conozcas). **NO CONTINUAR a B7** si `otras_con_privilegios` es mayor y no las reconocés: pedí asistencia para revisarlas. `vinculadas_a_alumnos` son filas viejas de alumnos: no dan privilegios.
- Archivo: `supabase/migrations/20261010120000_rls_p0_lockdown.sql` (**329 líneas**; versión corregida, Raw en la sección 3: usar ese enlace, **no** el del commit `19dd5b5`). Empieza con comentarios (`-- IronTrack — RLS P0: reemplaza las políticas acceso_total…`), luego `BEGIN;`, y termina con `COMMIT;`. Pegado completo, un solo Run.
- **Qué cambia respecto de la versión anterior de la migración:** la política de alta de `entrenadores` pasó de `entrenadores_insert_self` a `entrenadores_insert_restringido`: solo el entrenador principal (`it_is_principal()`) puede dar de alta a otro entrenador; una cuenta que ya es entrenador sigue pudiendo re-enviar su propia fila (el upsert del login); un usuario externo sin fila y un alumno son rechazados. **Consecuencia operativa:** una cuenta de entrenador nueva ya no se crea sola al iniciar sesión; la da de alta el entrenador principal o se inserta desde el SQL Editor.
- **Esperado:** "Success". Pueden aparecer avisos tipo "tabla … no existe, se omite" (p. ej. `coach_notification_reads`, que no existe) y, si corresponde, un aviso sobre filas de entrenadores sin vínculo con alumnos: es normal.
- **Si falla con "RLS P0 abortada: …":** no se aplicó nada. Copiá el mensaje y **NO CONTINUAR**.
- **Inmediatamente después:** B8. Si la app queda inutilizable y no se corrige hacia adelante en minutos: sección 2, fila B7.

### B8. Pruebas posteriores al lockdown
1. Repetir el checklist de la sección 2 completo (entrenador y alumno de prueba).
2. **[NUEVA] Anónimo sin acceso** — `sql/rls_p0_verify_anon.sql`. **No hay que editar nada.** Simula una petición sin sesión (rol `anon`) y cuenta qué filas puede leer, tabla por tabla. Solo SELECT; no muestra contenido. **Termina siempre con un error a propósito** (`ERROR: VEREDICTO: …`): eso revierte la transacción y es lo esperado. El veredicto está en la primera línea.
```sql
-- =============================================================================
-- VERIFICACIÓN B8 — acceso ANÓNIMO (SQL Editor de Supabase). No requiere editar nada. No guarda nada: termina SIEMPRE con un error
-- "RESULTADO" a propósito (eso revierte la transacción); el error es lo ESPERADO, el veredicto está en su primera línea.
-- Simula una petición sin sesión (rol anon) y cuenta qué filas puede leer. Solo SELECT; no muestra contenido, solo conteos.
-- Antes de la migración 2 debe dar FALLA (es la exposición que esa migración cierra); después, OK.
-- =============================================================================
DO $$
DECLARE
  t text; n bigint; r text := ''; fallas int := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','mensajes','fotos','notas','config','entrenadores',
                           'video_overrides','ejercicio_overrides','ejercicios_custom','coach_calendar_assignments','coach_principal'] LOOP
    BEGIN
      SET LOCAL ROLE anon;
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      RESET ROLE;
      IF n > 0 THEN fallas := fallas + 1; r := r || E'\n  ' || t || ': anon LEE ' || n || ' fila(s)  <-- FALLA';
      ELSE r := r || E'\n  ' || t || ': 0 filas visibles (OK)'; END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN RESET ROLE; r := r || E'\n  ' || t || ': permiso denegado (OK)';
      WHEN undefined_table THEN RESET ROLE; r := r || E'\n  ' || t || ': no existe (omitida)';
    END;
  END LOOP;
  RAISE EXCEPTION E'VEREDICTO: % (error esperado; no se guardó nada)%',
    CASE WHEN fallas = 0 THEN 'OK - el anónimo no lee ninguna tabla' ELSE 'FALLA - ' || fallas || ' tabla(s) legibles sin sesión' END, r;
END $$;
```
   Esperado: `VEREDICTO: OK - el anónimo no lee ninguna tabla` y cada tabla con `permiso denegado (OK)` (o `0 filas visibles (OK)`). Cualquier `anon LEE …` es un fallo: **ir a la sección 2, fila B7**.
3. **[NUEVA] Aislamiento entre usuarios** — `sql/rls_p0_verify_aislamiento.sql`. **No hay que editar nada ni conocer ningún UID**: toma por sí mismo a **todos** los alumnos con cuenta vinculada y al entrenador principal. Para cada alumno simula su sesión y exige que vea solo lo suyo (1 alumno, 0 filas ajenas en rutinas, progreso, sesiones, fotos, mensajes y notas, 0 en entrenadores); el entrenador principal debe ver todos los alumnos; un usuario sin datos no debe ver nada. No muestra nombres, correos ni ids (solo conteos y "alumno #N"). También termina con un error a propósito.
```sql
-- =============================================================================
-- VERIFICACIÓN B8 — AISLAMIENTO entre usuarios (SQL Editor de Supabase). No requiere editar nada: toma por sí misma TODOS los alumnos
-- con cuenta vinculada (alumnos.auth_uid) y al entrenador principal. No guarda nada: termina SIEMPRE con un error "VEREDICTO" a propósito
-- (eso revierte la transacción). Solo SELECT; no muestra nombres, correos ni ids: solo conteos y números de orden.
-- Para cada alumno vinculado simula su sesión (rol authenticated + JWT con su auth_uid) y exige:
--   · ve exactamente 1 alumno (él) y ningún alumno ajeno;
--   · 0 filas ajenas en rutinas, progreso, sesiones, fotos, mensajes y notas;  · 0 filas en entrenadores.
-- Entrenador principal: ve todos los alumnos.   Usuario sin datos (UUID aleatorio): no ve nada y no puede crearse una fila de entrenador.
-- Antes de la migración 2 debe dar FALLA (RLS abierta); después, OK.
-- =============================================================================
DO $$
DECLARE
  filas text[]; a text; sid text; suid text; t text; n bigint; total bigint; i int := 0;
  coach text; stranger text := gen_random_uuid()::text;
  ext text[] := ARRAY['rutinas','progreso','sesiones','fotos','mensajes','notas'];
  fallas int := 0; r text := '';
BEGIN
  SELECT count(*) INTO total FROM public.alumnos;
  SELECT array_agg(id::text || '|' || auth_uid::text ORDER BY id::text) INTO filas FROM public.alumnos WHERE auth_uid IS NOT NULL;
  IF to_regclass('public.coach_principal') IS NOT NULL THEN EXECUTE 'SELECT uid::text FROM public.coach_principal' INTO coach; END IF;

  -- 1) cada alumno vinculado
  FOREACH a IN ARRAY coalesce(filas, ARRAY[]::text[]) LOOP
    i := i + 1; sid := split_part(a, '|', 1); suid := split_part(a, '|', 2);
    PERFORM set_config('request.jwt.claim.sub', suid, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', suid, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      SELECT count(*) INTO n FROM public.alumnos;
      IF n <> 1 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' alumnos (esperado 1)'; END IF;
      SELECT count(*) INTO n FROM public.alumnos WHERE id::text <> sid;
      IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' alumno(s) ajeno(s)'; END IF;
      FOREACH t IN ARRAY ext LOOP
        BEGIN
          EXECUTE format('SELECT count(*) FROM public.%I WHERE alumno_id::text IS DISTINCT FROM %L', t, sid) INTO n;
          IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' fila(s) ajena(s) en ' || t; END IF;
        EXCEPTION
          WHEN insufficient_privilege THEN NULL;   -- sin permiso = no ve nada ajeno
          WHEN undefined_table THEN NULL;
        END;
      END LOOP;
      SELECT count(*) INTO n FROM public.entrenadores;
      IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': ve ' || n || ' fila(s) de entrenadores'; END IF;
    EXCEPTION WHEN OTHERS THEN
      fallas := fallas + 1; r := r || E'\n  alumno #' || i || ': error inesperado SQLSTATE ' || SQLSTATE;
    END;
    RESET ROLE;
  END LOOP;

  -- 2) entrenador principal: ve todos los alumnos
  IF coach IS NULL THEN
    fallas := fallas + 1; r := r || E'\n  entrenador principal: coach_principal vacío';
  ELSE
    PERFORM set_config('request.jwt.claim.sub', coach, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', coach, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    BEGIN
      SELECT count(*) INTO n FROM public.alumnos;
      IF n <> total THEN fallas := fallas + 1; r := r || E'\n  entrenador principal: ve ' || n || ' de ' || total || ' alumnos'; END IF;
    EXCEPTION WHEN OTHERS THEN
      fallas := fallas + 1; r := r || E'\n  entrenador principal: error inesperado SQLSTATE ' || SQLSTATE;
    END;
    RESET ROLE;
  END IF;

  -- 3) usuario autenticado sin ningún dato propio (UUID aleatorio): no debe ver nada
  PERFORM set_config('request.jwt.claim.sub', stranger, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', stranger, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOREACH t IN ARRAY ARRAY['alumnos','rutinas','progreso','sesiones','fotos','mensajes','notas','entrenadores'] LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n <> 0 THEN fallas := fallas + 1; r := r || E'\n  usuario sin datos: ve ' || n || ' fila(s) en ' || t; END IF;
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
      WHEN undefined_table THEN NULL;
    END;
  END LOOP;
  -- el usuario sin datos tampoco puede crearse una fila de entrenador (eso le daría privilegios de entrenador)
  BEGIN
    INSERT INTO public.entrenadores(id, email) VALUES (stranger::uuid, 'sin-datos@invalid.local');
    fallas := fallas + 1; r := r || E'\n  usuario sin datos: PUDO crearse una fila de entrenador';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;   -- esperado: rechazado por la política RLS
    WHEN OTHERS THEN fallas := fallas + 1; r := r || E'\n  usuario sin datos: el alta de entrenador no fue rechazada por RLS (SQLSTATE ' || SQLSTATE || ')';
  END;
  RESET ROLE;

  IF r = '' THEN r := E'\n  (ninguno)'; END IF;
  RAISE EXCEPTION E'VEREDICTO: % (error esperado; no se guardó nada)\n  alumnos con cuenta vinculada probados: %  |  alumnos en total: %\n  detalle de problemas:%',
    CASE WHEN i = 0 THEN 'SIN PRUEBA - no hay alumnos con auth_uid'
         WHEN fallas = 0 THEN 'OK - cada alumno ve solo lo suyo; el entrenador ve todos; un usuario sin datos no ve nada'
         ELSE 'FALLA - ' || fallas || ' problema(s)' END, i, total, r;
END $$;
```
   Esperado: `VEREDICTO: OK - cada alumno ve solo lo suyo…` y `alumnos con cuenta vinculada probados: 9` (o los que tengan cuenta). `VEREDICTO: SIN PRUEBA` significa que **no** había alumnos con `auth_uid`: no cuenta como aprobado. `VEREDICTO: FALLA` lista los problemas: **ir a la sección 2, fila B7**.
   - Antes de B7, estos mismos scripts dan `FALLA` (RLS abierta): es el contraste esperado y sirve de prueba de que detectan el problema (en local los dos detectaron cada fuga introducida a propósito).
   - **Si el SQL Editor dice que no puede cambiar de rol** (`permission denied to set role …`): la verificación por SQL no es posible en tu panel; usá solo las pruebas con la app (checklist, ítems 7–10). No lo doy por hecho: en local el rol `postgres` sí puede cambiar a `anon`/`authenticated`, y en Supabase se documenta como posible, pero **no lo pude comprobar en tu proyecto**.
4. Verificar de nuevo el respaldo con el bloque **D** de `rls_p0_backup_verify.sql`: ahora **sí** debe haber diferencias (la migración cambió grants); es esperable. Solo sirve para la restauración R2.
- **NO CONTINUAR a "dar por terminado"** hasta que 1–3 estén completos.

### B9. Monitoreo 24 h
- Supabase → **Logs** (API / Postgres): buscar respuestas 401/403/permission denied inesperadas.
- Preguntá a 2–3 alumnos si pudieron entrenar. Mantené el respaldo y las exportaciones al menos una semana.
- No borres `backup_rls_p0` ni `backup_rls_p0_prev` todavía.

---

## 2. Checklist de pruebas reales
Marcá cada ítem. Usá el **alumno de prueba propio**; no uses la cuenta de un alumno real sin su autorización.

**Entrenador**
1. [ ] Login con las credenciales del entrenador (tras B6, con la nueva).
2. [ ] El panel muestra **los 9 alumnos** (ni más ni menos).
3. [ ] Abrir la rutina de un alumno: se ve la semana actual y sus días/ejercicios.
4. [ ] Crear/asignar una rutina de prueba al alumno de prueba y volver a abrirla (se guarda y se lee).
5. [ ] Ver progreso y PRs de un alumno (valores coherentes con lo anterior).
6. [ ] Cambio de contraseña del alumno de prueba desde el panel (**solo si B4 se completó**): debe mostrar éxito y el alumno poder entrar con la nueva.

**Alumno de prueba**
7. [ ] Login del alumno de prueba; ve **su** rutina y la semana actual.
8. [ ] Registrar una serie (kg/reps), cerrar la app, volver a abrir: la serie sigue ahí; aparece en el historial de entrenamiento; el progreso suma a la semana correcta.
9. [ ] **No ve datos ajenos:** ejecutar `sql/rls_p0_verify_aislamiento.sql` (B8, punto 3; no requiere editar nada). Esperado después de B7: `VEREDICTO: OK`. Antes de B7 da `FALLA`: es el contraste esperado.
10. [ ] Probar el alumno en la app: no hay forma de abrir el panel del entrenador ni de ver otros alumnos.

**Anónimo**
11. [ ] Después de B7, `sql/rls_p0_verify_anon.sql` (B8, punto 2) debe dar `VEREDICTO: OK`. Antes de B7 da `FALLA` (`anon LEE …`): es la exposición que esta migración cierra.

---

## 3. Tabla de rollback por etapa
> Preferir **corregir hacia adelante** cuando sea posible. El orden de reversión total es: rollback B7 (+ R2) → revertir B2 → Instant Rollback del frontend → `DROP TABLE public.coach_principal`.

| Etapa | Qué se puede revertir | Archivo / acción | Qué NO se restaura automáticamente | Cuándo parar y pedir asistencia |
|---|---|---|---|---|
| B1 | La tabla `coach_principal` | `DROP TABLE public.coach_principal;` (solo si B2 no corrió) | — | Si el DROP falla por dependencias |
| B2 | `entrenador_id` de las filas registradas en `rls_p0_backfill_log`; quita la fila de `coach_principal` y vacía el registro | `sql/rls_p0_backfill_revert.sql` (contenido abajo). **Aborta si la migración 2 sigue aplicada**: revertir B7 primero | Filas **creadas después del backfill** (alumnos/rutinas nuevos con el UUID) no están en el registro y conservan el UUID; el frontend viejo no las vería. Cambios hechos por usuarios en otras columnas | Si el revert aborta, o si los conteos de B2 no vuelven a 9 legacy |
| B3 | El frontend en Production | Vercel → Deployments → despliegue de Production anterior (`5aeec6c…`) → **Instant Rollback / Promote to Production** (el nombre del botón y su disponibilidad dependen de tu plan: no puedo confirmarlo) | El merge en `main` queda en GitHub; para deshacerlo hace falta un PR de reversión | Si no encontrás el botón o el rollback no cambia la app |
| B4 | Función desplegada | Pegar de nuevo el código guardado en la nota "ANTERIOR" (paso previo de B4) y desplegar, o volver a desplegar con CLI desde una computadora. **Limitación:** no puedo confirmar que el panel guarde versiones anteriores: por eso se copia el código antes | Secretos/configuración de la función | Si el panel no deja editar la función, o si falla el cambio de contraseña de alumnos |
| B6 | **No se revierte** | Se conserva la contraseña nueva; si se pierde, recuperación por correo | La contraseña anterior | Si no podés iniciar sesión (no avanzar a B7) |
| B7 durante | Automático (transacción) | — | — | Cualquier error: no hay cambios; pedir asistencia |
| B7 aplicada, app inutilizable | Políticas, triggers y funciones `it_*` | `supabase/rollback/20261010120000_rls_p0_rollback.sql` (contenido abajo) y, para volver a las políticas **exactas** previas, bloque **R2** de `sql/rls_p0_backup_restore.sql` + snapshot de A2 | **Reabre la exposición anterior** (acceso total público): solo emergencia. R2 no toca grants de otros roles, herencia de roles, propietarios, default privileges ni permisos de funciones. Auth, Storage y secretos no forman parte de ningún respaldo | Siempre que uses el rollback: corregir hacia adelante cuanto antes y avisar |
| Filas borradas por error | Filas que existían en la copia | Bloque **R4** de `rls_p0_backup_restore.sql` (tabla por tabla) | Datos posteriores a la copia (nunca se pisan); tablas sin clave única (se niega a actuar) | Antes de tocar R4: pedir asistencia |
| Copia fresca incorrecta o create fallido | Los nombres de los esquemas de respaldo | `DESHACER` / `INTERCAMBIAR-A-ANTERIOR` / `INTERCAMBIAR-A-FRESCA` de `sql/rls_p0_backup_rotar.sql` (no hay DROP ni se pisa nada) | Los datos vivos no cambian con estas operaciones | Si IDENTIFICAR muestra algo distinto de las 2 filas esperadas |
| Pérdida del proyecto / Auth / Storage | **No hay respaldo externo completo** | — (falta `pg_dump`, respaldo de Auth y Storage) | Todo | Inmediatamente |

**Contenido de `sql/rls_p0_backfill_revert.sql`:**
```sql
-- =============================================================================
-- REVERSIÓN DEL BACKFILL (SQL Editor / postgres). NO ejecutar sin revisión.
-- Requisito: la migración 20261010120000_rls_p0_lockdown.sql NO debe estar aplicada (revertirla antes con
-- supabase/rollback/20261010120000_rls_p0_rollback.sql). Aborta si lo está.
-- Devuelve a 'entrenador_principal' SOLO las filas registradas en rls_p0_backfill_log (las que eran legacy),
-- no las que ya tenían el UUID antes del backfill. Quita la fila de coach_principal y vacía el registro.
-- =============================================================================
DO $$
DECLARE
  principal_uid text;
BEGIN
  IF to_regprocedure('public.it_guard_alumnos_update()') IS NOT NULL THEN
    RAISE EXCEPTION 'la migracion RLS esta aplicada: revertirla primero (supabase/rollback/...)';
  END IF;
  SELECT uid::text INTO principal_uid FROM public.coach_principal;
  IF principal_uid IS NULL THEN RAISE EXCEPTION 'coach_principal vacio: no hay backfill que revertir'; END IF;

  UPDATE public.alumnos a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'alumnos' AND l.row_key = a.id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.rutinas a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'rutinas' AND l.row_key = a.id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.video_overrides a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'video_overrides' AND l.row_key = a.ejercicio_id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.ejercicio_overrides a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'ejercicio_overrides' AND l.row_key = a.ejercicio_id::text AND a.entrenador_id::text = principal_uid;
  UPDATE public.ejercicios_custom a SET entrenador_id = 'entrenador_principal' FROM public.rls_p0_backfill_log l
   WHERE l.tbl = 'ejercicios_custom' AND l.row_key = a.id::text AND a.entrenador_id::text = principal_uid;

  DELETE FROM public.coach_principal;
  DELETE FROM public.rls_p0_backfill_log;
END $$;
```

**Contenido de `supabase/rollback/20261010120000_rls_p0_rollback.sql`:**
```sql
-- ROLLBACK DE EMERGENCIA de 20261010120000_rls_p0_lockdown.sql.
-- Restaura el estado INSEGURO previo (acceso_total public). Usar solo si la app queda inutilizable
-- y no hay forma de corregir hacia adelante. No revierte el backfill de entrenador_id (no hace falta).
BEGIN;
DROP TRIGGER IF EXISTS it_guard_alumnos_insert ON public.alumnos;
DROP TRIGGER IF EXISTS it_guard_alumnos_update ON public.alumnos;
DROP TRIGGER IF EXISTS it_guard_rutinas_update ON public.rutinas;
DROP TRIGGER IF EXISTS it_guard_mensajes_update ON public.mensajes;
DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','fotos','mensajes','config','notas','video_overrides'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN CONTINUE; END IF;
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated', t);
    EXECUTE format('CREATE POLICY acceso_total ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)', t);
  END LOOP;
  -- Resto de tablas: se deja RLS activo con políticas de dueño y grants restaurados a authenticated/anon.
  EXECUTE 'GRANT ALL ON public.ejercicio_overrides, public.ejercicios_custom, public.entrenadores TO anon, authenticated';
  EXECUTE 'ALTER TABLE public.ejercicio_overrides DISABLE ROW LEVEL SECURITY'; -- estado original
  FOR p IN SELECT tablename, policyname FROM pg_policies WHERE schemaname='public'
            AND tablename IN ('ejercicio_overrides','ejercicios_custom','entrenadores') LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
  EXECUTE 'CREATE POLICY entrenadores_self ON public.entrenadores FOR ALL TO public USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
END $$;
DROP FUNCTION IF EXISTS public.it_guard_alumnos_insert(), public.it_guard_alumnos_update(), public.it_guard_rutinas_update(), public.it_guard_mensajes_update(),
  public.it_is_coach_of(text), public.it_is_alumno(text), public.it_is_my_coach(text),
  public.it_is_entrenador(), public.it_is_principal();
COMMIT;
-- coach_principal (migracion 20261010110000) se conserva: es inocua y no se usa tras el rollback.
-- Nota: ejercicios_custom queda con RLS activo y SIN políticas tras el rollback si no existía política previa;
-- restaurar su política original desde el respaldo (pg_policies guardado antes del despliegue).
```

---

## 4. "Si algo sale distinto" — qué hacer
1. Detenete (no repitas el paso).
2. Anotá el mensaje de error **exacto** (sin datos personales) y el paso.
3. Si el paso ya cambió datos o grants, usá la fila correspondiente de la sección 3; si no, no hagas nada más.
4. Pedí asistencia con: paso, mensaje, y la salida de la verificación.

---

## 5. Verificación de los archivos contra el commit
Los enlaces **Raw** están fijados al commit `19dd5b54bd04a06097df1d5258ae584c74c7d6d4` (el contenido no puede cambiar). Los hashes los calculé comparando cada archivo local con la versión guardada en ese commit de git (`git show 19dd5b5:<ruta>`). **Resultado: 10 de los 11 archivos son IDÉNTICOS al commit; la migración 2 (`..._rls_p0_lockdown.sql`) está MODIFICADA** (corrección de seguridad del alta de entrenadores, commit `7432101bf7ec9025dc6a893d78dc9e4680292a3e`) y su enlace Raw apunta a ese commit. Esta guía no modifica ninguno de ellos.

| Archivo | Líneas | SHA-256 (16 primeros) | Local vs commit | Raw (fijado al commit) |
|---|---|---|---|---|
| `sql/rls_p0_preflight_readonly.sql` | 110 | `9eeb5b4518ce4b36` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_preflight_readonly.sql |
| `sql/rls_p0_snapshot_policies.sql` | 22 | `bfff1192e3b0d6d8` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_snapshot_policies.sql |
| `sql/rls_p0_backup_create.sql` | 148 | `7900c6b702f8baf3` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_backup_create.sql |
| `sql/rls_p0_backup_verify.sql` | 104 | `597df5c8eb347a18` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_backup_verify.sql |
| `sql/rls_p0_backup_restore.sql` | 107 | `ed85b8c9bcf4e799` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_backup_restore.sql |
| `sql/rls_p0_backfill_entrenador_principal.sql` | 53 | `e26a40056e1a977c` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_backfill_entrenador_principal.sql |
| `sql/rls_p0_backfill_sql_editor.sql` | 46 | `5c849d0830ebd8f1` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_backfill_sql_editor.sql |
| `sql/rls_p0_backfill_revert.sql` | 31 | `ae32f6c75e3be2b9` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/sql/rls_p0_backfill_revert.sql |
| `supabase/migrations/20261010110000_rls_p0_coach_principal.sql` | 22 | `d615665b45a172a9` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/supabase/migrations/20261010110000_rls_p0_coach_principal.sql |
| `supabase/migrations/20261010120000_rls_p0_lockdown.sql` | 329 | `5c4648caafab5e69` | **MODIFICADO** (corrección de seguridad, commit `7432101`) | https://raw.githubusercontent.com/hernankreick/irontrack.k/7432101bf7ec9025dc6a893d78dc9e4680292a3e/supabase/migrations/20261010120000_rls_p0_lockdown.sql |
| `supabase/rollback/20261010120000_rls_p0_rollback.sql` | 35 | `d0dcf2cbfe57b454` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/supabase/rollback/20261010120000_rls_p0_rollback.sql |

**Archivos nuevos de esta revisión** (no existen en `19dd5b5`; se publican con el commit que suba esta guía, cuyo SHA te informo al subirlo). Su contenido está **embebido en esta guía** (secciones A3, B2, B4 y B8) y el contenido embebido se verificó byte a byte contra el archivo:

| Archivo | Líneas | SHA-256 (16 primeros) |
|---|---|---|
| `sql/rls_p0_verify_entrenadores.sql` | 16 | `d45522755bbd4b5a` |
| `sql/rls_p0_verify_anon.sql` | 26 | `8c61ce0a872c9db9` |
| `sql/rls_p0_verify_aislamiento.sql` | 94 | `fa8e065e44ece780` |
| `sql/rls_p0_verify_backfill.sql` | 14 | `6767abac93644dc8` |
| `sql/rls_p0_backup_rotar.sql` | 63 | `fa606366a4a7840f` |
| `sql/rls_p0_export_json.sql` | 38 | `0a59bf0c559abe14` |
| `supabase/functions/update-alumno-password/index.single.ts` | 115 | `c7098ce3a56322c5` |

> Desde el iPhone no se puede calcular un SHA-256; la garantía es usar los enlaces Raw fijados al commit y, en cada archivo largo, comprobar el número de líneas y la primera/última línea indicadas en el paso. Si el commit de este documento se sube más adelante, los enlaces a `19dd5b5…` siguen apuntando al mismo contenido.

---

## 6. Limitaciones y pendientes (no maquillar)
- **Esquema de producción:** el preflight dio cero bloqueantes, pero las migraciones y el backfill se probaron localmente con un esquema reconstruido; la primera ejecución real es esta ventana.
- **B4 (Edge Function):** resuelto en el código (versión de un solo archivo, probada en Deno real), pero **no verifiqué que el editor web de Supabase permita editar una función creada con CLI**; si no, queda el CLI desde una computadora (ver B4, Plan B).
- **Verificaciones SQL de B8:** probadas en local con `SET LOCAL ROLE` + contexto JWT (las dos formas de `auth.uid()`); **no comprobé** que tu SQL Editor permita cambiar de rol (si no, usar solo las pruebas con la app).
- **Rotación de la copia interna:** probada en local (rotar, restaurar desde la anterior con R4 y volver, create fallido + DESHACER). La copia sigue siendo interna.
- **Exportación JSON:** probada ida y vuelta en local; **no verifiqué** el límite de tamaño al copiar una celda desde el iPhone.
- **Edge runtime de Supabase, CORS desde el navegador real y Instant Rollback de tu plan:** no verificados.
- **Respaldo:** interno + CSV; sin `pg_dump`, sin Auth/Storage.
- **Previews antiguas** de Vercel con la URL de producción: eliminarlas cuando puedas.
- **Quien haga `git pull`** de la rama pierde su `.env` local (ya no se versiona); usar `.env.example`.
