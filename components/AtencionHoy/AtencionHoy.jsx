import { priorizarAlumnos } from "./priorizarAlumnos";

// ─── Subcomponente: badge de prioridad ───────────────────────────────────────

function PrioridadBadge({ prioridad }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 8px",
        borderRadius: 4,
        color: prioridad.color,
        background: prioridad.fondo,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {prioridad.etiqueta}
    </span>
  );
}

// ─── Subcomponente: card individual de alumno ─────────────────────────────────

function AlumnoCard({ alumno, onVerProgreso, onAccion }) {
  const { nombre, descripcion, prioridad } = alumno;

  // Texto y color del botón de acción según prioridad
  const accionConfig = {
    Inactivo:    { label: "ENVIAR MSG",    bg: "#2563eb" },
    Pago:        { label: "RECORDAR",      bg: "#d97706" },
    "Sin rutina":{ label: "ASIGNAR RUTINA",bg: "#7c3aed" },
    Revisión:    { label: "EDITAR RUTINA", bg: "#2563eb" },
  };
  const accion = accionConfig[prioridad.etiqueta] ?? { label: "ACCIÓN", bg: "#2563eb" };

  return (
    <div style={styles.card(prioridad.fondo)}>
      {/* Encabezado */}
      <div style={styles.cardHeader}>
        <div style={styles.dot(prioridad.color)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={styles.nombre}>{nombre}</p>
          {descripcion && <p style={styles.descripcion}>{descripcion}</p>}
        </div>
        <PrioridadBadge prioridad={prioridad} />
      </div>

      {/* Acciones */}
      <div style={styles.actionRow}>
        <button
          style={styles.btnGhost}
          onClick={() => onVerProgreso(alumno)}
        >
          VER PROGRESO
        </button>
        <button
          style={{ ...styles.btnPrimary, background: accion.bg }}
          onClick={() => onAccion(alumno)}
        >
          {accion.label}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

/**
 * Props:
 *   alumnos        — array con todos los alumnos (ver estructura en priorizarAlumnos.js)
 *   limite         — máximo de alumnos a mostrar (default 5)
 *   onVerProgreso  — fn(alumno) al presionar "VER PROGRESO"
 *   onAccion       — fn(alumno) al presionar el botón de acción principal
 */
export default function AtencionHoy({
  alumnos = [],
  limite = 5,
  onVerProgreso = () => {},
  onAccion = () => {},
}) {
  const priorizados = priorizarAlumnos(alumnos, limite);

  return (
    <div style={styles.container}>
      {/* Header de sección */}
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>ATENCIÓN HOY</span>
        {priorizados.length > 0 && (
          <span style={styles.badge}>{priorizados.length}</span>
        )}
      </div>

      {/* Lista o estado vacío */}
      {priorizados.length === 0 ? (
        <div style={styles.empty}>
          <p style={styles.emptyText}>Todos los alumnos están al día.</p>
        </div>
      ) : (
        <div style={styles.list}>
          {priorizados.map((alumno) => (
            <AlumnoCard
              key={alumno.id}
              alumno={alumno}
              onVerProgreso={onVerProgreso}
              onAccion={onAccion}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
// Inline styles para mantener el componente completamente aislado
// (sin riesgo de colisión con clases CSS del proyecto actual).

const styles = {
  container: {
    padding: "12px 0",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    color: "#636870",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 18,
    height: 18,
    borderRadius: "50%",
    background: "#ef4444",
    color: "#fff",
    fontSize: 10,
    fontWeight: 500,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  card: (fondoColor) => ({
    background: fondoColor,
    border: "0.5px solid #2a2d32",
    borderRadius: 10,
    padding: "10px 12px",
  }),
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  dot: (color) => ({
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: color,
    flexShrink: 0,
    marginTop: 4,
  }),
  nombre: {
    fontSize: 12,
    fontWeight: 500,
    color: "#f1f1f1",
    margin: 0,
  },
  descripcion: {
    fontSize: 10,
    color: "#636870",
    margin: "2px 0 0",
  },
  actionRow: {
    display: "flex",
    gap: 6,
  },
  btnGhost: {
    flex: 1,
    background: "#1e2228",
    color: "#8a8f98",
    border: "0.5px solid #2a2d32",
    borderRadius: 7,
    padding: "6px 4px",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.03em",
    cursor: "pointer",
    textTransform: "uppercase",
  },
  btnPrimary: {
    flex: 1,
    color: "#fff",
    border: "none",
    borderRadius: 7,
    padding: "6px 4px",
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: "0.03em",
    cursor: "pointer",
    textTransform: "uppercase",
  },
  empty: {
    padding: "20px 0",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 12,
    color: "#636870",
    margin: 0,
  },
};
