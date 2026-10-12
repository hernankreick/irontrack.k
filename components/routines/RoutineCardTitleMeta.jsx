import React from 'react';
import { pluralize } from '../../lib/textFormat.js';

const CHIP_STYLES = {
  assigned: { color: 'var(--success)', background: 'var(--success-bg)' },
  dirty: { color: 'var(--warning)', background: 'var(--warning-bg)' },
  none: { color: 'var(--text-muted)', background: 'var(--neutral-bg)' },
};

export default function RoutineCardTitleMeta({
  r,
  nombreLocal,
  editandoNombre,
  setNombreLocal,
  guardarNombreRutina,
  setEditandoNombre,
  status,
  totalEx,
  expanded,
  onOpen,
  lang,
  M,
  Ic,
}) {
  const chipLabel =
    status === 'dirty'
      ? M(lang, 'Cambios sin guardar', 'Unsaved changes', 'Alterações não salvas')
      : status === 'assigned'
        ? M(lang, 'Asignada', 'Assigned', 'Atribuída')
        : M(lang, 'Sin alumno', 'No athlete', 'Sem aluno');
  const chip = CHIP_STYLES[status] || CHIP_STYLES.none;

  const metaRow = (
    <span
      style={{
        display: 'flex',
        gap: 8,
        marginTop: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <span
        style={{
          ...chip,
          borderRadius: 999,
          padding: '3px 10px',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.3,
          flexShrink: 0,
        }}
      >
        {chipLabel}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.35 }}>
        {pluralize(r.days.length, M(lang, 'día', 'day', 'dia'), M(lang, 'días', 'days', 'dias'))}
        {' · '}
        {pluralize(totalEx, M(lang, 'ejercicio', 'exercise', 'exercício'), M(lang, 'ejercicios', 'exercises', 'exercícios'))}
      </span>
      {r.scanned && (
        <span
          style={{
            background: 'var(--neutral-bg)',
            color: 'var(--block-main)',
            borderRadius: 999,
            padding: '3px 10px',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <Ic name="image" size={12} color="currentColor" />
          {M(lang, 'Escaneada', 'Scanned', 'Digitalizada')}
        </span>
      )}
    </span>
  );

  if (editandoNombre) {
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          autoFocus
          aria-label={M(lang, 'Nombre de la rutina', 'Routine name', 'Nome da rotina')}
          value={nombreLocal}
          onChange={(e) => setNombreLocal(e.target.value)}
          onBlur={guardarNombreRutina}
          onKeyDown={(e) => e.key === 'Enter' && guardarNombreRutina()}
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text)',
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid var(--accent)',
            outline: 'none',
            padding: '2px 0',
            fontFamily: 'inherit',
            width: '100%',
            minHeight: 44,
            boxSizing: 'border-box',
          }}
        />
        {metaRow}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-expanded={expanded}
      className="it-routine-header-btn"
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 44,
        textAlign: 'left',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        color: 'var(--text)',
        display: 'block',
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: 18,
          fontWeight: 800,
          lineHeight: 1.25,
          color: 'var(--text)',
          overflowWrap: 'anywhere',
        }}
      >
        {nombreLocal}
      </span>
      {metaRow}
    </button>
  );
}
