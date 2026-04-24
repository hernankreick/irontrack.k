import React from 'react';
import { irontrackMsg as M } from '../../lib/irontrackMsg.js';
import './routines-ui.css';

/** Chips de categoría (el orden «Recientes» va en el desplegable aparte). */
export const ROUTINE_FILTER_CHIPS = ['todas', 'asignadas', 'sin_asignar', 'plantillas'];

export function RoutineFilters({ filtro, setFiltro, lang, darkMode, border, textMuted }) {
  const label = (id) => {
    switch (id) {
      case 'todas':
        return M(lang, 'Todas', 'All', 'Todas');
      case 'asignadas':
        return M(lang, 'Asignadas', 'Assigned', 'Atribuídas');
      case 'sin_asignar':
        return M(lang, 'Sin asignar', 'Unassigned', 'Não atribuídas');
      case 'plantillas':
        return M(lang, 'Plantillas', 'Templates', 'Modelos');
      default:
        return id;
    }
  };

  const chipBg = darkMode ? 'rgba(21, 25, 33, 0.95)' : '#f1f5f9';
  const chipColor = darkMode ? '#f8fafc' : '#0f172a';

  return (
    <div
      className="it-routine-filters-scroll"
      role="tablist"
      aria-label={M(lang, 'Filtrar rutinas', 'Filter routines', 'Filtrar rotinas')}
    >
      {ROUTINE_FILTER_CHIPS.map((id) => {
        const active = filtro === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={'it-routine-filter-chip hov ' + (active ? 'is-active' : '')}
            onClick={() => setFiltro(id)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: active ? '1px solid #2563eb' : `1px solid ${border}`,
              background: active ? '#2563eb' : chipBg,
              color: active ? '#ffffff' : chipColor,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: '0.01em',
            }}
          >
            {label(id)}
          </button>
        );
      })}
    </div>
  );
}

export function filterRoutinesByChip(routines, filtro) {
  const list = routines || [];
  const f =
    filtro === 'recientes'
      ? 'todas'
      : ROUTINE_FILTER_CHIPS.includes(filtro)
        ? filtro
        : 'todas';
  if (f === 'asignadas') return list.filter((r) => !!r.alumno_id);
  if (f === 'sin_asignar') return list.filter((r) => !r.alumno_id);
  if (f === 'plantillas') {
    return list.filter(
      (r) => (r.templateId && r.templateId !== 'blank') || !!r.scanned
    );
  }
  return [...list];
}
