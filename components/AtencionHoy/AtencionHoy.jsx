import { priorizarAlumnos } from "./priorizarAlumnos";

// ─── Punto de color ───────────────────────────────────────────────────────────

function Dot({ color }) {
  return (
    <span style={{
      display: "inline-block",
      width: 6, height: 6,
      borderRadius: "50%",
      background: color,
      flexShrink: 0,
      marginTop: 1,
    }} />
  );
}

// ─── Card principal — único alumno de máxima prioridad ───────────────────────

function CardPrincipal({ alumno, onVerProgreso, onAccion }) {
  const { nombre, descripcion, prioridad } = alumno;

  const accionLabel = {
    "Inactivo":   "Enviar mensaje",
    "Pago":       "Recordar pago",
    "Sin rutina": "Asignar rutina",
    "Revisión":   "Editar rutina",
  }[prioridad.etiqueta] ?? "Acción";

  // El botón de acción nunca es rojo — rojo solo para indicadores pasivos
  const accionColor = prioridad.color === "#ef4444" ? "#2563eb" : prioridad.color;

  return (
    <div style={{
      background: "#181c22",
      border: "0.5px solid #2a2d32",
      borderLeft: `2px solid ${prioridad.color}`,
      borderRadius: 10,
      padding: "12px 14px",
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Dot color={prioridad.color} />
        <span style={{
          fontSize: 10, fontWeight: 500,
          color: prioridad.color,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          {prioridad.etiqueta}
        </span>
      </div>

      <p style={{ fontSize: 14, fontWeight: 500, color: "#f1f1f1", margin: "0 0 2px" }}>
        {nombre}
      </p>
      {descripcion && (
        <p style={{ fontSize: 11, color: "#636870", margin: "0 0 10px" }}>
          {descripcion}
        </p>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => onVerProgreso(alumno)} style={styles.btnSecondary}>
          VER
        </button>
        <button
          onClick={() => onAccion(alumno)}
          style={{ ...styles.btnPrimary, background: accionColor }}
        >
          {accionLabel.toUpperCase()}
        </button>
      </div>
    </div>
  );
}

// ─── Fila compacta — alumnos secundarios ─────────────────────────────────────

function FilaCompacta({ alumno, onClick }) {
  const { nombre, descripcion, prioridad } = alumno;

  return (
    <div
      onClick={() => onClick(alumno)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 4px",
        borderBottom: "0.5px solid #1e2228",
        cursor: "pointer",
      }}
    >
      <Dot color={prioridad.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12, color: "#c8cdd6", fontWeight: 500 }}>
          {nombre}
        </span>
        {descripcion && (
          <span style={{ fontSize: 11, color: "#636870", marginLeft: 6 }}>
            · {descripcion}
          </span>
        )}
      </div>
      <span style={{ fontSize: 10, color: prioridad.color, fontWeight: 500, flexShrink: 0 }}>
        {prioridad.etiqueta}
      </span>
    </div>
  );
}

// ─── Header de sección ────────────────────────────────────────────────────────

function SectionHeader({ count }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{
        fontSize: 11, fontWeight: 500,
        letterSpacing: "0.08em",
        color: "#636870",
        textTransform: "uppercase",
      }}>
        Atención hoy
      </span>
      {count > 0 && (
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 17, height: 17,
          borderRadius: "50%",
          background: "#ef4444",
          color: "#fff",
          fontSize: 9, fontWeight: 600,
        }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * Props — idénticas a v1, sin breaking changes:
 *   alumnos        — array de alumnos mapeados (ver priorizarAlumnos.js)
 *   limite         — máximo total a mostrar (default 5)
 *   onVerProgreso  — fn(alumno) → botón VER y click en filas compactas
 *   onAccion       — fn(alumno) → botón de acción del card principal
 */
export default function AtencionHoy({
  alumnos = [],
  limite = 5,
  onVerProgreso = () => {},
  onAccion = () => {},
}) {
  const priorizados = priorizarAlumnos(alumnos, limite);

  if (priorizados.length === 0) {
    return (
      <div style={{ padding: "16px 0 8px" }}>
        <SectionHeader count={0} />
        <p style={{ fontSize: 12, color: "#636870", margin: 0, paddingTop: 8 }}>
          Todos los alumnos están al día.
        </p>
      </div>
    );
  }

  const [principal, ...resto] = priorizados;

  return (
    <div style={{ padding: "16px 0 8px" }}>
      <SectionHeader count={priorizados.length} />

      {/* Card destacada — prioridad máxima */}
      <CardPrincipal
        alumno={principal}
        onVerProgreso={onVerProgreso}
        onAccion={onAccion}
      />

      {/* Lista compacta — el resto sin botones */}
      {resto.length > 0 && (
        <div style={{ paddingLeft: 2 }}>
          {resto.map(a => (
            <FilaCompacta
              key={a.id}
              alumno={a}
              onClick={onVerProgreso}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const styles = {
  btnSecondary: {
    background: "transparent",
    color: "#8a8f98",
    border: "0.5px solid #2a2d32",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 10, fontWeight: 500,
    letterSpacing: "0.04em",
    cursor: "pointer",
    textTransform: "uppercase",
  },
  btnPrimary: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "4px 12px",
    fontSize: 10, fontWeight: 500,
    letterSpacing: "0.04em",
    cursor: "pointer",
    textTransform: "uppercase",
  },
};
