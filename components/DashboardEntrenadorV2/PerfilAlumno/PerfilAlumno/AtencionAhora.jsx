import { coachType as T, coachSpace as S } from '../../../coachUiScale.js';

const C_TEXT = '#ffffff';
const C_SECONDARY = '#e2e8f0';

const CARD_BG = '#1f293a';
const CARD_RADIUS = 12;
const CARD_BORDER = '1px solid #334155';

function isRedAlert(color) {
  return String(color).toLowerCase() === '#ef4444';
}

export default function AtencionAhora({ alumno, onVer, onMensaje }) {
  if (!alumno) return null;

  const { nombre, problema, color = '#ef4444' } = alumno;
  const nombreEsEmail = typeof nombre === 'string' && nombre.includes('@');
  const heavy = isRedAlert(color);

  return (
    <div style={{ marginBottom: S.pageGap }}>
      <p style={s.label}>ATENCIÓN AHORA</p>

      <div
        style={{
          background: CARD_BG,
          borderRadius: CARD_RADIUS,
          padding: S.cardPadding,
          border: heavy ? '1px solid #7f1d1d' : CARD_BORDER,
          boxShadow: heavy ? '0 4px 24px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.2)',
        }}
      >
        <p
          style={{
            ...s.nombre,
            ...(heavy ? s.nombreHeavy : s.nombreNormal),
            margin: '0 0 10px',
            ...(nombreEsEmail ? { wordBreak: 'break-all' } : {}),
          }}
        >
          {nombre}
        </p>

        {heavy ? (
          <div
            style={{
              background: '#4c1d1d',
              borderRadius: 8,
              padding: `${S.blockGap}px 14px`,
              marginBottom: S.blockGapLoose,
              border: '1px solid #7f1d1d',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: S.gridGapTight }}>
              <span
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  background: '#ef4444',
                  flexShrink: 0,
                  boxShadow: '0 0 0 3px rgba(239,68,68,0.25)',
                }}
              />
              {problema && (
                <p style={{ ...s.problemaHeavy, color: '#fecaca' }}>{problema}</p>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: S.gridTight, marginBottom: S.gridTight }}>
              <span style={{ ...s.dot, background: color }} />
              {problema && (
                <p style={{ ...s.problema, color, margin: 0 }}>{problema}</p>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: S.gridGapTight, marginTop: heavy ? 0 : 4 }}>
          <button type="button" onClick={() => onVer?.(alumno)} style={s.btnVer}>
            VER
          </button>
          <button type="button" onClick={() => onMensaje?.(alumno)} style={s.btnMensaje}>
            MENSAJE
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  label: {
    ...T.tableHeader,
    color: C_SECONDARY,
    margin: `0 0 ${S.blockGap}px`,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },
  nombre: {
    fontWeight: 700,
    color: C_TEXT,
    minWidth: 0,
    lineHeight: 1.25,
  },
  nombreNormal: {
    ...T.numberStatSm,
  },
  nombreHeavy: {
    ...T.cardTitle,
    fontSize: 18,
  },
  problema: {
    ...T.meta,
    fontWeight: 600,
    flex: 1,
    minWidth: 0,
  },
  problemaHeavy: {
    ...T.labelMd,
    fontWeight: 700,
    margin: 0,
    lineHeight: 1.35,
    flex: 1,
    minWidth: 0,
  },
  btnVer: {
    ...T.control,
    background: '#1d4ed8',
    color: C_TEXT,
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontFamily: 'inherit',
    boxShadow: '0 2px 8px rgba(29,78,216,0.45)',
  },
  btnMensaje: {
    ...T.control,
    background: 'transparent',
    color: '#93c5fd',
    border: '2px solid #3b82f6',
    borderRadius: 8,
    padding: '6px 16px',
    letterSpacing: '0.06em',
    cursor: 'pointer',
    textTransform: 'uppercase',
    fontFamily: 'inherit',
  },
};
