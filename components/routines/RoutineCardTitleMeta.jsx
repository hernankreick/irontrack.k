import React from 'react';

export default function RoutineCardTitleMeta({
  r,
  nombreLocal,
  editandoNombre,
  setNombreLocal,
  guardarNombreRutina,
  setEditandoNombre,
  selectedAlumnoIds,
  totalEx,
  textMain,
  textMuted,
  border,
  lang,
  T,
  M,
  Ic,
  Pencil,
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {editandoNombre ? (
        <input
          autoFocus
          value={nombreLocal}
          onChange={(e) => setNombreLocal(e.target.value)}
          onBlur={guardarNombreRutina}
          onKeyDown={(e) => e.key === 'Enter' && guardarNombreRutina()}
          style={{
            ...T.numberStat,
            color: textMain,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid #3b82f6',
            outline: 'none',
            padding: '2px 0',
            fontFamily: 'inherit',
            width: '100%',
          }}
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ ...T.numberStat, color: textMain, lineHeight: 1.1, wordBreak: 'break-word' }}>
            {nombreLocal}
          </div>
          <button
            type="button"
            onClick={() => setEditandoNombre(true)}
            className="it-routine-btn"
            style={{
              width: 44,
              height: 44,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              flexShrink: 0,
            }}
          >
            <Pencil size={15} />
          </button>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 6,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {selectedAlumnoIds.length > 0 ? (
          <span
            className="it-routine-badge--assigned"
            style={{
              background: '#22C55E18',
              color: '#4ade80',
              border: '1px solid rgba(74, 222, 128, 0.35)',
              borderRadius: 6,
              padding: '3px 8px',
              ...T.tableHeader,
              fontSize: 10,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {M(lang, 'Asignada', 'Assigned', 'Atribuída')}
          </span>
        ) : (
          <span
            className="it-routine-badge--unassigned"
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              color: '#94a3b8',
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: '3px 8px',
              ...T.tableHeader,
              fontSize: 10,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {M(lang, 'Sin asignar', 'Unassigned', 'Não atribuída')}
          </span>
        )}
        <span style={{ ...T.meta, color: textMuted, fontWeight: 600 }}>
          {r.days.length} {M(lang, 'días', 'days', 'dias')} · {totalEx}{' '}
          {M(lang, 'ejercicios', 'exercises', 'exercícios')}
        </span>
        {r.scanned && (
          <span
            style={{
              background: '#2563EB22',
              color: '#2563EB',
              border: '1px solid #60a5fa33',
              borderRadius: 6,
              padding: '2px 8px',
              ...T.tableHeader,
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Ic name="image" size={11} color="#2563EB" />
            {M(lang, 'Escaneada', 'Scanned', 'Digitalizada')}
          </span>
        )}
      </div>
    </div>
  );
}
