import { useState } from 'react';
import { coachType as T, coachSpace as S } from '../../../coachUiScale.js';

const C_TEXT = '#ffffff';
const C_SECONDARY = '#e2e8f0';

const CARD_BG = '#222834';
const CARD_RADIUS = 12;
const PLACEHOLDER_BG = '#374151';
const PLACEHOLDER_TEXT = '#e2e8f0';

const SIN_SESIONES_RX = /sin sesiones registradas/i;

function ProblemaVisual({ problema, color }) {
  if (!problema) return null;

  if (SIN_SESIONES_RX.test(problema)) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: S.gridTight, marginTop: 2 }}>
        <span style={badgeStyle} title={problema}>
          <span aria-hidden style={{ marginRight: 6, opacity: 0.9 }}>○</span>
          Sin registro
        </span>
        <span style={{ ...badgeStyle, opacity: 0.92 }}>Sin sesiones</span>
      </div>
    );
  }

  return (
    <span style={{ ...s.problema, color: color || C_SECONDARY }}> — {problema}</span>
  );
}

const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  background: PLACEHOLDER_BG,
  color: PLACEHOLDER_TEXT,
  ...T.tableHeader,
  letterSpacing: '0.02em',
  padding: '5px 10px',
  borderRadius: 6,
};

export default function ListaRevisar({ alumnos = [], onSeleccionar }) {
  if (alumnos.length === 0) return null;

  return (
    <div style={{ marginBottom: S.pageGap }}>
      <p style={s.label}>A REVISAR</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: S.gridTight }}>
        {alumnos.map((a, i) => (
          <FilaRevisar
            key={a.id ?? i}
            alumno={a}
            onSeleccionar={onSeleccionar}
          />
        ))}
      </div>
    </div>
  );
}

const CARD_SHADOW_REST = '0 1px 2px rgba(15, 23, 42, 0.4)';
const CARD_SHADOW_HOVER = '0 3px 10px rgba(15, 23, 42, 0.5), 0 2px 4px rgba(59, 130, 246, 0.2)';

function FilaRevisar({ alumno, onSeleccionar }) {
  const { nombre, problema, color = '#f59e0b' } = alumno;
  const nombreEsEmail = typeof nombre === 'string' && nombre.includes('@');
  const [hover, setHover] = useState(false);
  const active = hover;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSeleccionar?.(alumno)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSeleccionar?.(alumno);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        ...s.card,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        border: active ? '1px solid #3b82f6' : '1px solid #2d3748',
        boxShadow: active ? CARD_SHADOW_HOVER : CARD_SHADOW_REST,
        transform: active ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: S.gridGapTight }}>
        <span style={{ ...s.dot, background: color, marginTop: 6 }} />
        <div style={s.textoCol}>
          <span
            style={{
              ...s.nombre,
              ...(nombreEsEmail ? { wordBreak: 'break-all' } : {}),
            }}
          >
            {nombre}
          </span>
          <ProblemaVisual problema={problema} color={color} />
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
  card: {
    background: CARD_BG,
    borderRadius: CARD_RADIUS,
    padding: S.cardPadding,
    border: '1px solid #2d3748',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },
  textoCol: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  nombre: {
    ...T.bodySemibold,
    fontWeight: 700,
    lineHeight: 1.35,
    color: C_TEXT,
  },
  problema: {
    ...T.meta,
    fontWeight: 600,
  },
};
