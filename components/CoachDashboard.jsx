import React from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUp,
  Bell,
  CheckCircle,
  Clock,
  Eye,
  FilePlus,
  Info,
  MessageSquare,
  Plus,
  Search,
  Star,
} from "lucide-react";

const C = {
  card: "#12121a",
  cardDark: "#0d0d15",
  brd: "#1e1e2e",
  t: "#ffffff",
  t2: "#71717a",
  blue: "#3b82f6",
  green: "#22c55e",
  greenDim: "#052e16",
  yel: "#eab308",
  yelDim: "#422006",
  red: "#ef4444",
  redDim: "#450a0a",
};

const WEEK_BARS = [
  { d: "L", p: 100 },
  { d: "M", p: 100 },
  { d: "X", p: 75 },
  { d: "J", p: 100 },
  { d: "V", p: 50 },
  { d: "S", p: 0 },
  { d: "D", p: 0 },
];

const TEAM_MINI = [
  { num: "5", color: C.green, Icon: CheckCircle, label: "Cumpliendo", sub: ">70% sesiones" },
  { num: "2", color: C.yel, Icon: Clock, label: "En progreso", sub: "30% – 69%" },
  { num: "1", color: C.red, Icon: AlertTriangle, label: "Sin actividad", sub: "<30%" },
];

const ALERTAS = [
  {
    i: "AT",
    n: "Agustín Torres",
    b: "1 de 3 sesiones",
    bc: C.yel,
    bd: C.yelDim,
    d: "Bajo cumplimiento esta semana",
  },
  {
    i: "SG",
    n: "Sofía Gómez",
    b: "Sin actividad",
    bc: C.red,
    bd: C.redDim,
    d: "No tiene tiempo para completar el día",
  },
  {
    i: "LD",
    n: "Lucas Díaz",
    b: "Necesita atención",
    bc: C.yel,
    bd: C.yelDim,
    d: "Necesita seguimiento de la semana",
  },
];

const QUICK = [
  {
    bg: "#1e3a8a",
    border: "#2563eb33",
    Icon: MessageSquare,
    iconColor: C.blue,
    title: "Enviar mensaje",
    sub: "a tu equipo",
  },
  {
    bg: "#2e1065",
    border: "#7c3aed33",
    Icon: FilePlus,
    iconColor: "#a78bfa",
    title: "Crear rutina",
    sub: "personalizada",
  },
  {
    bg: "#042f2e",
    border: "#0d947533",
    Icon: Eye,
    iconColor: "#34d399",
    title: "Revisar alumnos",
    sub: "que necesitan atención",
  },
];

const TABLA = [
  { i: "JL", n: "Julieta Laroze", p: 82, s: "Hoy" },
  { i: "AG", n: "Agustín", p: 45, s: "Hace 2 días" },
  { i: "HK", n: "Hernán", p: 0, s: "Sin actividad" },
  { i: "MC", n: "María Clara", p: 61, s: "Ayer" },
  { i: "PG", n: "Pablo García", p: 88, s: "Hace 1 día" },
];

function pctColor(p) {
  if (p >= 70) return C.green;
  if (p >= 30) return C.yel;
  return C.red;
}

function sesionColor(s) {
  if (s === "Hoy") return C.green;
  if (s === "Sin actividad") return C.red;
  return C.t2;
}

/**
 * Contenido del dashboard del coach (sin sidebar ni app shell).
 * El layout global y DesktopSidebar los provee App.jsx.
 */
export default function CoachDashboard() {
  return (
    <>
      <style>{`
        .cd-qcard { transition: transform 0.12s; }
        .cd-qcard:hover { transform: scale(1.03); }
      `}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          width: "100%",
          boxSizing: "border-box",
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <header
          style={{
            padding: "14px 18px",
            borderBottom: `1px solid ${C.brd}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 20, lineHeight: 1.25, fontWeight: 700, color: C.t, margin: 0 }}>
              Buenas noches, Entrenador
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.45, color: C.t2, margin: "4px 0 0 0" }}>
              Acá tenés el resumen de tu equipo
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.brd}`,
                borderRadius: 8,
                height: 36,
                width: 188,
                maxWidth: "100%",
                padding: "0 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxSizing: "border-box",
              }}
            >
              <Search size={15} color={C.t2} strokeWidth={2} />
              <input
                placeholder="Buscar alumnos, rutina..."
                style={{
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  color: C.t,
                  fontSize: 15,
                  flex: 1,
                  minWidth: 0,
                }}
              />
              <kbd
                style={{
                  background: "#1e1e2e",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 13,
                  color: C.t2,
                  fontFamily: "inherit",
                }}
              >
                ⌘K
              </kbd>
            </div>
            <button
              type="button"
              style={{
                width: 36,
                height: 36,
                background: C.card,
                border: `1px solid ${C.brd}`,
                borderRadius: 7,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                position: "relative",
              }}
            >
              <Bell size={17} color="#94a3b8" strokeWidth={2} />
              <span
                style={{
                  position: "absolute",
                  top: 5,
                  right: 6,
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.red,
                  border: "1px solid #0d0d15",
                  boxSizing: "border-box",
                }}
              />
            </button>
            <button
              type="button"
              style={{
                background: C.blue,
                color: "#fff",
                borderRadius: 7,
                height: 36,
                padding: "0 14px",
                fontSize: 15,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                border: "none",
                cursor: "pointer",
              }}
            >
              <Plus size={15} strokeWidth={2.5} />+ CREAR
            </button>
          </div>
        </header>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 13,
            padding: 15,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 260px)", gap: 13, alignItems: "start" }}>
            <div
              style={{
                background: C.card,
                border: `1px solid ${C.brd}`,
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Info size={16} color={C.t2} strokeWidth={2} />
                <span style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 600, color: C.t }}>
                  Cumplimiento semanal
                </span>
              </div>
              <div style={{ fontSize: 52, lineHeight: 1.15, fontWeight: 800, letterSpacing: -1, color: C.t }}>
                16 / 24
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.45, color: C.t2, marginTop: 4 }}>
                sesiones completadas
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "inline-block",
                  background: C.greenDim,
                  color: C.green,
                  borderRadius: 99,
                  padding: "4px 10px",
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Quedan 2 días para completar
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "flex-start",
                  marginTop: 10,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {WEEK_BARS.map((row) => (
                    <div
                      key={row.d}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          color: C.t2,
                          width: 15,
                          fontFamily: "ui-monospace, monospace",
                        }}
                      >
                        {row.d}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: 7,
                          background: C.brd,
                          borderRadius: 3,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: row.p + "%",
                            height: "100%",
                            background: row.p > 0 ? C.blue : C.brd,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          color: C.t2,
                          width: 34,
                          textAlign: "right",
                        }}
                      >
                        {row.p}%
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                  <svg width={88} height={88} viewBox="0 0 80 80" style={{ display: "block" }}>
                    <circle r={30} cx={40} cy={40} stroke={C.brd} strokeWidth={8} fill="none" />
                    <circle
                      r={30}
                      cx={40}
                      cy={40}
                      stroke={C.blue}
                      strokeWidth={8}
                      fill="none"
                      strokeDasharray="188.5"
                      strokeDashoffset={60.32}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                    />
                  </svg>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      lineHeight: 1.2,
                      fontWeight: 800,
                      color: C.t,
                      pointerEvents: "none",
                    }}
                  >
                    67%
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 13, minWidth: 0 }}>
              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.brd}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 600, color: C.t }}>
                    Equipo de un vistazo
                  </span>
                  <button
                    type="button"
                    style={{
                      background: "none",
                      border: "none",
                      color: C.blue,
                      fontSize: 14,
                      lineHeight: 1.35,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Ver todo →
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  {TEAM_MINI.map(({ num, color, Icon: Mi, label, sub }) => (
                    <div
                      key={label}
                      style={{
                        background: C.cardDark,
                        border: `1px solid ${C.brd}`,
                        borderRadius: 8,
                        padding: "10px 8px",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 23, fontWeight: 800, color: C.t }}>{num}</div>
                      <Mi
                        size={16}
                        color={color}
                        strokeWidth={2}
                        style={{ display: "block", margin: "6px auto 0 auto" }}
                      />
                      <div style={{ fontSize: 15, lineHeight: 1.35, color: C.t2, marginTop: 6 }}>
                        {label}
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.45, color: "#2a2a3a", marginTop: 4 }}>
                        {sub}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  background: C.card,
                  border: `1px solid ${C.brd}`,
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Info size={16} color={C.t2} strokeWidth={2} />
                  <span style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 600, color: C.t }}>
                    Tu rendimiento
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                      <Star size={18} color="#eab308" fill="#eab308" strokeWidth={1.5} />
                      <span style={{ fontSize: 40, lineHeight: 1.15, fontWeight: 800, color: C.t }}>
                        72
                      </span>
                      <span style={{ fontSize: 17, lineHeight: 1.25, color: C.t2 }}>/100</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 8,
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: C.green,
                      }}
                    >
                      <ArrowUp size={14} strokeWidth={2.5} />
                      +8 pts vs semana pasada
                    </div>
                  </div>
                  <div style={{ position: "relative", width: 68, height: 68, flexShrink: 0 }}>
                    <svg width={68} height={68} viewBox="0 0 60 60" style={{ display: "block" }}>
                      <circle r={23} cx={30} cy={30} stroke={C.brd} strokeWidth={7} fill="none" />
                      <circle
                        r={23}
                        cx={30}
                        cy={30}
                        stroke={C.blue}
                        strokeWidth={7}
                        fill="none"
                        strokeDasharray="144.51"
                        strokeDashoffset={40.46}
                        strokeLinecap="round"
                        transform="rotate(-90 30 30)"
                      />
                    </svg>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        lineHeight: 1.2,
                        fontWeight: 800,
                        color: C.t,
                        pointerEvents: "none",
                      }}
                    >
                      72%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: C.card,
              border: `1px solid ${C.brd}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={17} color={C.yel} strokeWidth={2} />
                <span style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 600, color: C.t }}>
                  Alertas inteligentes
                </span>
              </div>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: C.blue,
                  fontSize: 15,
                  lineHeight: 1.35,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Ver todas →
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 11 }}>
              {ALERTAS.map((a) => (
                <div
                  key={a.i}
                  style={{
                    background: C.cardDark,
                    border: `1px solid ${C.brd}`,
                    borderRadius: 9,
                    padding: 13,
                  }}
                >
                  <div style={{ display: "flex", gap: 9, marginBottom: 6, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        background: a.bd,
                        color: a.bc,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {a.i}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 600, color: "#fff" }}>
                        {a.n}
                      </div>
                      <div
                        style={{
                          display: "inline-block",
                          marginTop: 6,
                          background: a.bd,
                          color: a.bc,
                          fontSize: 13,
                          padding: "3px 9px",
                          borderRadius: 99,
                        }}
                      >
                        {a.b}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 14, lineHeight: 1.45, color: C.t2, margin: "4px 0 0 0" }}>
                    {a.d}
                  </p>
                  <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                    <button
                      type="button"
                      style={{
                        background: a.bc,
                        color: "#000",
                        borderRadius: 5,
                        padding: "6px 11px",
                        fontSize: 13,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      REVISAR
                    </button>
                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        border: `1px solid ${C.brd}`,
                        color: C.t2,
                        borderRadius: 5,
                        padding: "6px 11px",
                        fontSize: 13,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      VER PERFIL
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                textTransform: "uppercase",
                fontSize: 14,
                lineHeight: 1.45,
                color: C.t2,
                fontWeight: 600,
                letterSpacing: 0.6,
                marginBottom: 9,
              }}
            >
              ACCIONES RÁPIDAS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 11 }}>
              {QUICK.map(({ bg, border, Icon: Qi, iconColor, title, sub }) => (
                <div
                  key={title}
                  role="button"
                  tabIndex={0}
                  className="cd-qcard"
                  style={{
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 10,
                    padding: 15,
                    cursor: "pointer",
                  }}
                >
                  <Qi size={22} color={iconColor} strokeWidth={2} />
                  <p style={{ fontSize: 16, lineHeight: 1.3, fontWeight: 600, color: "#fff", margin: "8px 0 0 0" }}>
                    {title}
                  </p>
                  <small
                    style={{
                      fontSize: 14,
                      lineHeight: 1.45,
                      color: "#94a3b8",
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    {sub}
                  </small>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: C.card,
              border: `1px solid ${C.brd}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1.25, fontWeight: 600, color: C.t }}>
                Alumnos activos
              </span>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: C.blue,
                  fontSize: 15,
                  lineHeight: 1.35,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Ver todos →
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 165px 132px",
                gap: 10,
                paddingBottom: 8,
                borderBottom: `1px solid #1e1e2e33`,
              }}
            >
              {["ALUMNO", "CUMPLIMIENTO", "ÚLTIMA SESIÓN"].map((h) => (
                <div
                  key={h}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.35,
                    color: C.t2,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            {TABLA.map((row, idx) => {
              const col = pctColor(row.p);
              return (
                <div
                  key={row.i + row.n}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 165px 132px",
                    gap: 10,
                    alignItems: "center",
                    padding: "9px 0",
                    borderBottom: idx < TABLA.length - 1 ? "1px solid #1e1e2e33" : "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: col + "22",
                        color: col,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {row.i}
                    </div>
                    <span
                      style={{
                        fontSize: 16,
                        lineHeight: 1.35,
                        color: C.t,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.n}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: 14, lineHeight: 1.35, color: col, fontWeight: 700 }}>
                      {row.p}%
                    </div>
                    <div
                      style={{
                        height: 7,
                        background: C.brd,
                        borderRadius: 3,
                        marginTop: 5,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: row.p + "%",
                          height: "100%",
                          background: col,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.35, color: sesionColor(row.s) }}>
                    {row.s}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
