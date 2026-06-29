import React from 'react';

function useIsUnder768() {
  const [v, setV] = React.useState(typeof window !== 'undefined' && window.innerWidth < 768);
  React.useEffect(function () {
    var mq = window.matchMedia('(max-width: 767px)');
    function onChange() { setV(mq.matches); }
    mq.addEventListener('change', onChange);
    return function () { mq.removeEventListener('change', onChange); };
  }, []);
  return v;
}

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
  const isUnder768 = useIsUnder768();
  return (
    <div style={{ flex: 1, minWidth: 0, ...(isUnder768 ? { position: 'relative' } : {}) }}>
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
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, ...(isUnder768 ? { flexDirection: 'row', justifyContent: 'space-between', width: '100%' } : {}) }}>
          <div style={{ ...T.numberStat, fontSize: isUnder768 ? 15 : 16, fontWeight: 700, color: textMain, lineHeight: 1.2, whiteSpace: isUnder768 ? 'normal' : 'nowrap', ...(!isUnder768 ? { overflow: 'hidden', textOverflow: 'ellipsis' } : {}), flex: 1, minWidth: 0, ...(isUnder768 ? { paddingRight: '32px' } : {}) }}>
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
              ...(isUnder768 ? { position: 'absolute', top: '0', right: '0' } : {}),
            }}
          >
            <Pencil size={15} />
          </button>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: isUnder768 ? 4 : 6,
          marginTop: 6,
          ...(isUnder768 ? { marginBottom: 10 } : {}),
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {selectedAlumnoIds.length > 0 ? (
          <span
            className="it-routine-badge--assigned"
            style={{
              background: '#22C55E18',
              color: isUnder768 ? '#64748b' : '#4ade80',
              border: isUnder768 ? 'none' : '1px solid rgba(74, 222, 128, 0.35)',
              borderRadius: 6,
              padding: isUnder768 ? '0' : '3px 8px',
              ...T.tableHeader,
              fontSize: isUnder768 ? 11 : 10,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            {M(lang, 'Asignada', 'Assigned', 'Atribuída')}
            {isUnder768 && ' ·'}
          </span>
        ) : (
          <span
            className="it-routine-badge--unassigned"
            style={{
              background: isUnder768 ? 'transparent' : 'rgba(15, 23, 42, 0.65)',
              color: '#64748b',
              border: isUnder768 ? 'none' : `1px solid ${border}`,
              borderRadius: 6,
              padding: isUnder768 ? '0' : '3px 8px',
              ...T.tableHeader,
              fontSize: isUnder768 ? 11 : 10,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            {M(lang, 'Sin asignar', 'Unassigned', 'Não atribuída')}
            {isUnder768 && ' ·'}
          </span>
        )}
        <span style={{ ...T.meta, color: '#64748b', fontWeight: 600, fontSize: isUnder768 ? 11 : undefined, whiteSpace: 'normal' }}>
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
              flexShrink: 0,
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
