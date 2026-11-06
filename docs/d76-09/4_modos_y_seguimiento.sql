-- D76-09 · PASO 4 — Cambio de modo y seguimiento. Cada UPDATE es una escritura de UNA fila de configuración (sin DDL, instantánea):
-- ejecutar SOLO el que corresponda, y solo con autorización. La consulta de seguimiento (al final) es de solo lectura.

-- 4a. Observar (después de publicar el frontend): acepta todo y registra en it_private.eventos lo que habría rechazado; bloquea los
--     DELETE directos por la API (el frontend nuevo borra con la RPC).
--   update it_private.config set modo = 'observar';

-- 4b. Activo (tras el período de observación): rechaza (IT409) lo anterior a un borrado.
--   update it_private.config set modo = 'activo';

-- 4c. ROLLBACK NIVEL 1 (instantáneo): sin rechazos ni guarda de borrado. Los teléfonos con el frontend nuevo devuelven su cuarentena
--     a pendientes (movimiento, nunca borrado).
--   update it_private.config set modo = 'off';

-- Seguimiento (SOLO LECTURA): modo vigente, borrados hechos con la RPC y lo que el modo observar habría rechazado. Sin datos personales.
select 'modo' as dato, (select modo from it_private.config) as valor
union all select 'alumnos con historial borrado por la RPC', (select count(*)::text from it_private.historial_estado where reset_at is not null)
union all select 'último borrado', (select coalesce(max(reset_at)::text, '—') from it_private.historial_estado)
union all select 'eventos (habría rechazado) — total', (select count(*)::text from it_private.eventos)
union all select 'eventos por motivo / rol', (select coalesce(string_agg(x, ', '), '—') from (select motivo || ' / ' || coalesce(rol, '?') || ': ' || count(*) as x
                   from it_private.eventos group by motivo, rol order by 1) e)
union all select 'eventos de alumnos SIN borrado (debe ser 0)', (select count(*)::text from it_private.eventos ev
                   where not exists (select 1 from it_private.historial_estado h where h.alumno_id = ev.alumno_id and h.reset_at is not null))
union all select 'solicitudes de vínculo pendientes', (select count(*)::text from it_private.vinculos)
union all select 'filas subidas con «Subir igual»', (select (select count(*) from public.progreso where reingreso_at is not null)
                   + (select count(*) from public.sesiones where reingreso_at is not null))::text;
