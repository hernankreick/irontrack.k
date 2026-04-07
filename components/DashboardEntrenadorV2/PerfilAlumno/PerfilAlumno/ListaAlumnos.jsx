const C_TEXT = '#ffffff';
const C_SECONDARY = '#e2e8f0';

export default function ListaAlumnos({ alumnos = [], onSeleccionar }) {
  if (alumnos.length === 0) return null;

  return (
    <div>
      <p style={s.label}>ALUMNOS ({alumnos.length})</p>

      <div>
        {alumnos.map((a, i) => (
          <FilaAlumno
            key={a.id ?? i}
            alumno={a}
            ultimo={i === alumnos.length - 1}
            onSeleccionar={onSeleccionar}
          />
        ))}
      </div>
    </div>
  );
}

function FilaAlumno({ alumno, ultimo, onSeleccionar }) {
  const { nombre, estado, estadoColor } = alumno;
  const nombreEsEmail = typeof nombre === 'string' && nombre.includes('@');

  return (
    <div
      onClick={() => onSeleccionar?.(alumno)}
      style={{
        ...s.fila,
        borderBottom: ultimo ? 'none' : '0.5px solid #1a1e24',
      }}
    >
      <div style={s.avatar}>
        {(nombre || '?').slice(0, 2).toUpperCase()}
      </div>
      <span style={{ ...s.nombre, ...(nombreEsEmail ? { wordBreak: 'break-all' } : {}) }}>{nombre}</span>
      {estado && (
        <span style={{ ...s.estado, color: estadoColor || C_SECONDARY }}>
          {estado}
        </span>
      )}
    </div>
  );
}

const s = {
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: C_SECONDARY,
    textTransform: 'uppercase',
    margin: '0 0 10px',
  },
  fila: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 0',
    cursor: 'pointer',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: '#1e2228',
    color: C_SECONDARY,
    fontSize: 10,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    letterSpacing: '0.02em',
  },
  nombre: {
    fontSize: 13,
    color: C_TEXT,
    fontWeight: 700,
    flex: 1,
    minWidth: 0,
  },
  estado: {
    fontSize: 11,
    fontWeight: 600,
    flexShrink: 0,
  },
}
