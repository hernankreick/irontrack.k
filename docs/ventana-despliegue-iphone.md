# Ventana de despliegue RLS P0 — guía paso a paso desde iPhone

> **Estado del documento:** borrador local, preparado sobre el commit `19dd5b54bd04a06097df1d5258ae584c74c7d6d4` (rama `claude/irontrack-rls-p0-fix-r02vvv`, PR en borrador #89).
> Ningún paso de esta guía fue ejecutado en producción. Las consultas nuevas de verificación (marcadas **[NUEVA]**) se probaron solo en un Postgres local con datos ficticios.
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

### A3. Exportación externa de datos (CSV) y copia interna fresca
1. **CSV desde el iPhone:** seguir `docs/respaldo-rls-p0.md`, sección 4 (una consulta `select * from public.<tabla>;` por tabla, o Table Editor → Export). Verificar que cada CSV tenga tantas filas como `count(*)`. **Estos archivos contienen datos personales: no los envíes ni subas a ningún lado.**
2. **Copia interna fresca justo antes del backfill** (la que existe hoy es de antes de que los alumnos siguieran usando la app; una nueva refleja el estado exacto previo a B2):
   1. Renombrar la anterior (no se sobrescribe nunca; el script aborta si ya existe):
```sql
ALTER SCHEMA backup_rls_p0 RENAME TO backup_rls_p0_prev;
```
   2. Ejecutar `sql/rls_p0_backup_create.sql` (148 líneas, Raw en la sección 5), pegado completo, un solo Run. Empieza con un bloque de comentarios (`-- COPIA INTERNA (NO es un backup completo) previa a RLS P0…`, 148 líneas en total) y termina con `SELECT m.tbl, m.row_count FROM backup_rls_p0.manifest m ORDER BY m.tbl;`.
   3. **Esperado:** tabla con las 14 tablas y sus conteos (≈ 1.225 filas en total; pueden ser algo más si hubo uso).
   4. Ejecutar **de a uno** los bloques **A**, **D** y **E** de `sql/rls_p0_backup_verify.sql` (Raw en la sección 5; cada bloque empieza con un comentario `-- A)`, `-- D)`, `-- E)`).
      - **A:** las 14 filas con `ok_copia = true` y `ok_origen = true` (si una `ok_origen` da `false` porque un alumno guardó una serie en ese instante, repetí A; `ok_copia` debe ser siempre `true`).
      - **D:** todas las filas con `cambiaron = 0` (efectivos anon/authenticated/…, acl directo tablas, acl columnas).
      - **E:** `usage_esquema = false` y `privilegios_tablas = 0` para `anon` y `authenticated`.
- **NO CONTINUAR** si el create falla, si alguna verificación no coincide o si falta alguna tabla. Si el create falló a mitad: `DROP SCHEMA IF EXISTS backup_rls_p0 CASCADE;` y devolver el nombre anterior con `ALTER SCHEMA backup_rls_p0_prev RENAME TO backup_rls_p0;` (el script es transaccional: si falla, no queda una copia a medias).
- Límite del espacio: el script aborta solo si base + copia supera 400 MB (hoy la base ≈ 14 MB).

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

### B4. Edge Function `update-alumno-password` — **BLOQUEADO DESDE iPhone (decisión pendiente)**
- El despliegue documentado es `supabase functions deploy update-alumno-password` (Supabase CLI con sesión del propietario), que **no se puede ejecutar desde un iPhone**. Los archivos son `supabase/functions/update-alumno-password/index.ts` y `core.js` (dos archivos).
- **Qué falla si no se despliega:** el frontend nuevo envía `alumnoId`; la función vieja espera otro formato. Solo falla el **cambio de contraseña de un alumno desde el panel del entrenador** (login, rutinas y series no dependen de ella). La función vieja sigue desplegada con su comportamiento previo.
- **Alternativas verificables (elegir una, ninguna está probada por mí en producción):**
  1. Si el panel de Supabase (**Edge Functions**) permite editar/crear funciones en el navegador, **comprobar si acepta más de un archivo** (la función importa `./core.js`). Si solo admite un archivo, no usar esta vía sin una versión de un solo archivo.
  2. Pedir que prepare una **versión de un solo archivo** de la función (cambio de código: requiere tu autorización expresa y nuevas pruebas) para pegarla en el editor del panel.
  3. Desplegar desde una computadora con el CLI (cuando la tengas disponible), o desde un entorno en la nube con un token de acceso: **no crear ni pegar tokens en chats**; esa vía expone credenciales y no la recomiendo para esta ventana.
- **Decisión recomendada:** B4 **no bloquea** B7 (la migración 2 no depende de la función), pero el cambio de contraseña de alumnos desde el panel queda sin funcionar hasta resolverlo. Anotalo como pendiente con fecha. Probá esa función (B5, ítem "cambio de contraseña") **solo si** B4 se completó.

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
> ⚠️ **PASO RIESGOSO.** Es transaccional: si una precondición falla, aborta sin cambiar nada. Tené a mano la sección 3 (fila B7) y el snapshot de A2.
- Archivo: `supabase/migrations/20261010120000_rls_p0_lockdown.sql` (315 líneas; Raw en la sección 5). Empieza con comentarios (`-- IronTrack — RLS P0: reemplaza las políticas acceso_total…`), luego `BEGIN;`, y termina con `COMMIT;`. Pegado completo, un solo Run.
- **Esperado:** "Success". Pueden aparecer avisos tipo "tabla … no existe, se omite" para tablas opcionales (p. ej. `coach_notification_reads`, que no existe): es normal.
- **Si falla con "RLS P0 abortada: …":** no se aplicó nada. Copiá el mensaje y **NO CONTINUAR**.
- **Inmediatamente después:** B8. Si la app queda inutilizable y no se corrige hacia adelante en minutos: sección 3, fila B7.

### B8. Pruebas posteriores al lockdown
1. Repetir el checklist de la sección 2 completo (entrenador y alumno de prueba).
2. **[NUEVA] Anónimo sin acceso** (SQL Editor; no guarda nada: termina con un error "RESULTADO…" que es lo esperado):
```sql
DO $$
DECLARE t text; n bigint; r text := '';
BEGIN
  FOREACH t IN ARRAY ARRAY['alumnos','progreso','rutinas','sesiones','mensajes','fotos','notas','config','entrenadores'] LOOP
    BEGIN
      SET LOCAL ROLE anon;
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      r := r || E'\n' || t || ': anon PUEDE leer (filas visibles = ' || n || ')';
    EXCEPTION WHEN insufficient_privilege THEN
      r := r || E'\n' || t || ': permiso denegado (OK)';
    END;
    RESET ROLE;
  END LOOP;
  RAISE EXCEPTION E'RESULTADO (este aviso es normal, nada se guardó):%', r;
END $$;
```
   Esperado: **todas** las líneas dicen `permiso denegado (OK)`. Cualquier "anon PUEDE leer" es un fallo: **ir a la sección 3, fila B7**.
3. **[NUEVA] Alumno de prueba sin datos ajenos** (ver sección 2, ítem 9, para obtener el UID).
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
9. [ ] **No ve datos ajenos [NUEVA, SQL Editor, no guarda nada].** Primero obtené el UID de Auth del alumno de prueba (solo lectura): `select id, auth_uid from public.alumnos where email = '<correo del alumno de prueba que creaste vos>';`. Copiá el UUID, pegalo en la línea `uid text := …` del script (reemplazando el texto entre comillas; una sola aparición) y ejecutá:
```sql
-- Reemplazá el texto entre comillas de la línea "uid text" por el UUID de Auth del alumno de prueba (una sola vez).
DO $$
DECLARE
  uid text := 'PEGAR_AQUI_UID_AUTH_DEL_ALUMNO_DE_PRUEBA';
  t text; n bigint; r text := '';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', uid, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  FOREACH t IN ARRAY ARRAY['alumnos','rutinas','progreso','sesiones','mensajes','fotos','notas','entrenadores','config'] LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      r := r || E'\n' || t || ': ' || n || ' fila(s) visible(s)';
    EXCEPTION WHEN insufficient_privilege THEN
      r := r || E'\n' || t || ': permiso denegado';
    END;
  END LOOP;
  -- datos de OTROS alumnos: deben ser 0
  EXECUTE 'SELECT count(*) FROM public.progreso WHERE alumno_id::text NOT IN (SELECT id::text FROM public.alumnos)' INTO n;
  r := r || E'\nprogreso ajeno: ' || n;
  EXECUTE 'SELECT count(*) FROM public.mensajes WHERE alumno_id::text NOT IN (SELECT id::text FROM public.alumnos)' INTO n;
  r := r || E'\nmensajes ajenos: ' || n;
  RESET ROLE;
  RAISE EXCEPTION E'RESULTADO (este aviso es normal, nada se guardó):%', r;
END $$;
```
   Esperado **después de B7**: `alumnos: 1`, `rutinas`: solo las suyas, `progreso ajeno: 0`, `mensajes ajenos: 0`, `entrenadores: 0`. (Antes de B7 este mismo test muestra todas las filas: es el contraste esperado con RLS abierta.)
10. [ ] Probar el alumno en la app: no hay forma de abrir el panel del entrenador ni de ver otros alumnos.

**Anónimo**
11. [ ] Después de B7, la consulta anónima de B8 (punto 2) debe dar `permiso denegado (OK)` en todas las tablas. Antes de B7 va a mostrar `anon PUEDE leer`: es la exposición que esta migración cierra.

---

## 3. Tabla de rollback por etapa
> Preferir **corregir hacia adelante** cuando sea posible. El orden de reversión total es: rollback B7 (+ R2) → revertir B2 → Instant Rollback del frontend → `DROP TABLE public.coach_principal`.

| Etapa | Qué se puede revertir | Archivo / acción | Qué NO se restaura automáticamente | Cuándo parar y pedir asistencia |
|---|---|---|---|---|
| B1 | La tabla `coach_principal` | `DROP TABLE public.coach_principal;` (solo si B2 no corrió) | — | Si el DROP falla por dependencias |
| B2 | `entrenador_id` de las filas registradas en `rls_p0_backfill_log`; quita la fila de `coach_principal` y vacía el registro | `sql/rls_p0_backfill_revert.sql` (contenido abajo). **Aborta si la migración 2 sigue aplicada**: revertir B7 primero | Filas **creadas después del backfill** (alumnos/rutinas nuevos con el UUID) no están en el registro y conservan el UUID; el frontend viejo no las vería. Cambios hechos por usuarios en otras columnas | Si el revert aborta, o si los conteos de B2 no vuelven a 9 legacy |
| B3 | El frontend en Production | Vercel → Deployments → despliegue de Production anterior (`5aeec6c…`) → **Instant Rollback / Promote to Production** (el nombre del botón y su disponibilidad dependen de tu plan: no puedo confirmarlo) | El merge en `main` queda en GitHub; para deshacerlo hace falta un PR de reversión | Si no encontrás el botón o el rollback no cambia la app |
| B4 | Función desplegada | Volver a desplegar la versión anterior (CLI/computadora o el editor del panel si lo permite). **Limitación:** no puedo confirmar que el panel guarde versiones anteriores | Secretos/configuración de la función | Siempre: desde iPhone solo hay vías no verificadas |
| B6 | **No se revierte** | Se conserva la contraseña nueva; si se pierde, recuperación por correo | La contraseña anterior | Si no podés iniciar sesión (no avanzar a B7) |
| B7 durante | Automático (transacción) | — | — | Cualquier error: no hay cambios; pedir asistencia |
| B7 aplicada, app inutilizable | Políticas, triggers y funciones `it_*` | `supabase/rollback/20261010120000_rls_p0_rollback.sql` (contenido abajo) y, para volver a las políticas **exactas** previas, bloque **R2** de `sql/rls_p0_backup_restore.sql` + snapshot de A2 | **Reabre la exposición anterior** (acceso total público): solo emergencia. R2 no toca grants de otros roles, herencia de roles, propietarios, default privileges ni permisos de funciones. Auth, Storage y secretos no forman parte de ningún respaldo | Siempre que uses el rollback: corregir hacia adelante cuanto antes y avisar |
| Filas borradas por error | Filas que existían en la copia | Bloque **R4** de `rls_p0_backup_restore.sql` (tabla por tabla) | Datos posteriores a la copia (nunca se pisan); tablas sin clave única (se niega a actuar) | Antes de tocar R4: pedir asistencia |
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
Los enlaces **Raw** están fijados al commit `19dd5b54bd04a06097df1d5258ae584c74c7d6d4` (el contenido no puede cambiar). Los hashes los calculé comparando cada archivo local con la versión guardada en ese commit de git (`git show 19dd5b5:<ruta>`). **Resultado: los 11 archivos son IDÉNTICOS al commit.** Este documento nuevo no modifica ninguno de ellos.

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
| `supabase/migrations/20261010120000_rls_p0_lockdown.sql` | 315 | `99b66b901adbc067` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/supabase/migrations/20261010120000_rls_p0_lockdown.sql |
| `supabase/rollback/20261010120000_rls_p0_rollback.sql` | 35 | `d0dcf2cbfe57b454` | IGUAL (byte a byte) | https://raw.githubusercontent.com/hernankreick/irontrack.k/19dd5b54bd04a06097df1d5258ae584c74c7d6d4/supabase/rollback/20261010120000_rls_p0_rollback.sql |

> Desde el iPhone no se puede calcular un SHA-256; la garantía es usar los enlaces Raw fijados al commit y, en cada archivo largo, comprobar el número de líneas y la primera/última línea indicadas en el paso. Si el commit de este documento se sube más adelante, los enlaces a `19dd5b5…` siguen apuntando al mismo contenido.

---

## 6. Limitaciones y pendientes (no maquillar)
- **Esquema de producción:** el preflight dio cero bloqueantes, pero las migraciones y el backfill se probaron localmente con un esquema reconstruido; la primera ejecución real es esta ventana.
- **B4 (Edge Function):** sin vía verificada desde iPhone (ver B4).
- **Edge runtime de Supabase, CORS desde el navegador real y Instant Rollback de tu plan:** no verificados.
- **Respaldo:** interno + CSV; sin `pg_dump`, sin Auth/Storage.
- **Previews antiguas** de Vercel con la URL de producción: eliminarlas cuando puedas.
- **Quien haga `git pull`** de la rama pierde su `.env` local (ya no se versiona); usar `.env.example`.
