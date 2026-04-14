import React, { useMemo } from "react";
import { Ic } from "./Ic.jsx";
import IronTrackLogo from "./IronTrackLogo.jsx";
import { useBreakpoint } from "./hooks/useBreakpoint";

const S = {
  root: {
    fontFamily: "'DM Sans', sans-serif",
    background: "#0B0E11",
    color: "#F1F5F9",
    paddingBottom: 0,
    minHeight: "100%",
    boxSizing: "border-box",
    width: "100%",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 8,
    paddingBottom: 16,
    minHeight: 44,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 800,
    letterSpacing: -0.5,
    marginBottom: 18,
    color: "#F1F5F9",
  },
  card: {
    background: "#111827",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  bottomNav: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    background: "#0B0E11",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    paddingTop: 8,
  },
  navBtn: {
    flex: 1,
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "6px 4px 10px",
    fontFamily: "'DM Sans', sans-serif",
  },
};

const MOCK_ALERTS = [
  { id: 1, name: "Agustín Torres", initials: "AT", badge: "1 de 3 sesiones", msg: "Podría no completar la semana.", color: "#EF4444" },
  { id: 2, name: "Sofía Gómez", initials: "SG", badge: "Sin actividad", msg: "Aún tiene tiempo para ponerse al día.", color: "#F59E0B" },
  { id: 3, name: "Lucas Méndez", initials: "LM", badge: "45% completado", msg: "Por debajo de su promedio semanal.", color: "#EAB308" },
];

const MOCK_TEAM = [
  { id: 1, name: "Julieta Laroze", initials: "JL", status: "Cumpliendo", color: "#22C55E", pct: 82 },
  { id: 2, name: "Agustín Torres", initials: "AT", status: "En progreso", color: "#F59E0B", pct: 45 },
  { id: 3, name: "Sofía Gómez", initials: "SG", status: "Sin actividad", color: "#EF4444", pct: 0 },
];

function IconInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconLightning() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
    </svg>
  );
}

function IconMessage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconTrophy() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

function IconCheckCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAlertCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#EAB308" stroke="#EAB308" strokeWidth="1" aria-hidden>
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function WeeklyRing({ gradId, pct, animId }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg width="140" height="140" viewBox="0 0 120 120" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#22C55E" />
        </linearGradient>
        <style>
          {`
            @keyframes ${animId} {
              from { stroke-dashoffset: ${c}; }
              to { stroke-dashoffset: ${offset}; }
            }
          `}
        </style>
      </defs>
      <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
      <circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c}
        transform="rotate(-90 60 60)"
        style={{
          animation: `${animId} 1.2s ease forwards`,
        }}
      />
      <text x="60" y="66" textAnchor="middle" fill="#F1F5F9" fontSize="22" fontWeight="800" fontFamily="'DM Sans', sans-serif">
        {pct}%
      </text>
    </svg>
  );
}

function CoachScoreRing({ pct }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#2563EB"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

function alumnoToTeamRow(a, idx) {
  const name = a.nombre || a.email || "Alumno";
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
  const pct = [82, 45, 0][idx % 3];
  let status = "En progreso";
  let color = "#F59E0B";
  if (pct >= 70) {
    status = "Cumpliendo";
    color = "#22C55E";
  } else if (pct < 30) {
    status = "Sin actividad";
    color = "#EF4444";
  }
  return { id: a.id, name, initials, status, color, pct };
}

export default function CoachDashboard({
  alumnos = [],
  activeNav = "dashboard",
  setActiveNav,
  onRevisar,
  onVerPerfil,
  onEnviarMensaje,
  onCrearRutina,
  onRevisarAlumnos,
  coachAvatarUrl,
  coachName,
}) {
  const gradId = useMemo(() => "wk-grad-" + Math.random().toString(36).slice(2, 9), []);
  const ringAnimId = useMemo(() => "coachWkRing_" + Math.random().toString(36).slice(2, 9), []);
  const { isMobile, isDesktop } = useBreakpoint();

  const teamRows = useMemo(() => {
    if (alumnos && alumnos.length > 0) {
      return alumnos.slice(0, 3).map(alumnoToTeamRow);
    }
    return MOCK_TEAM;
  }, [alumnos]);

  const alerts = MOCK_ALERTS;

  const navItems = [
    { key: "dashboard", label: "Dashboard", ic: "bar-chart-2" },
    { key: "routines", label: "Rutinas", ic: "file-text" },
    { key: "exercises", label: "Ejercicios", ic: "activity" },
    { key: "alumnos", label: "Alumnos", ic: "users" },
  ];

  const dayBars = [
    { h: 44, fill: "#2563EB" },
    { h: 56, fill: "#2563EB" },
    { h: 50, fill: "#2563EB" },
    { h: 62, fill: "#2563EB" },
    { h: 38, fill: "#2563EB", opacity: 0.45 },
    { h: 22, fill: "rgba(255,255,255,0.1)" },
    { h: 18, fill: "rgba(255,255,255,0.1)" },
  ];
  const dayLabels = ["L", "M", "X", "J", "V", "S", "D"];

  const equipoMetricasOuterStyle = isMobile
    ? { display: "flex", gap: 8, marginBottom: 14 }
    : {
        display: "grid",
        gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "repeat(2, 1fr)",
        gap: 12,
        marginBottom: 20,
      };

  const renderAlertasCards = () => (
    <div className="coach-dash-alerts">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="coach-dash-alert-card"
          style={{
            minWidth: 260,
            maxWidth: 280,
            flexShrink: 0,
            background: "#111827",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                color: "#F1F5F9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {a.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#F1F5F9" }}>{a.name}</div>
              <div
                style={{
                  display: "inline-block",
                  marginTop: 4,
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  color: a.color,
                  border: "1px solid " + a.color,
                  borderRadius: 8,
                  padding: "2px 8px",
                }}
              >
                {a.badge}
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#94A3B8", lineHeight: 1.45, margin: "0 0 14px" }}>{a.msg}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => onRevisar && onRevisar(a.id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 12,
                border: "none",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: 0.6,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                background: a.color,
                color: "#0B0E11",
              }}
            >
              REVISAR
            </button>
            <button
              type="button"
              onClick={() => onVerPerfil && onVerPerfil(a.id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.1)",
                fontWeight: 800,
                fontSize: 11,
                letterSpacing: 0.6,
                cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
                background: "rgba(255,255,255,0.04)",
                color: "#94A3B8",
              }}
            >
              VER PERFIL
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderAlertasInteligentes = () => (
    <>
      <div style={{ ...S.sectionLabel, marginTop: 4 }}>
        <IconStar />
        Alertas inteligentes
      </div>
      {renderAlertasCards()}
    </>
  );

  const renderEquipoMetricas = () => (
    <>
      <div style={{ ...S.sectionLabel, marginTop: 8 }}>
        <IconUsers />
        Equipo de un vistazo
      </div>
      <div style={equipoMetricasOuterStyle}>
        {[
          { label: "Cumpliendo", n: "5", sub: "≥70% sesiones", color: "#22C55E", Icon: IconCheckCircle },
          { label: "En progreso", n: "2", sub: "30–69%", color: "#F59E0B", Icon: IconClock },
          { label: "Sin actividad", n: "1", sub: "<30%", color: "#EF4444", Icon: IconAlertCircle },
        ].map((row) => {
          const StatusIco = row.Icon;
          return (
          <div
            key={row.label}
            style={{
              flex: 1,
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            <StatusIco />
            <div style={{ fontSize: 20, fontWeight: 900, color: row.color, marginTop: 6 }}>{row.n}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: "#F1F5F9", marginTop: 2 }}>{row.label}</div>
            <div style={{ fontSize: 9, color: "#64748B", marginTop: 2 }}>{row.sub}</div>
          </div>
        );
        })}
      </div>
    </>
  );

  const renderListaAlumnos = () => (
    <div style={S.card}>
      {teamRows.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 0",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(37,99,235,0.15)",
              color: "#F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {t.initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#F1F5F9" }}>{t.name}</div>
            <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.08)", marginTop: 8, overflow: "hidden" }}>
              <div style={{ width: t.pct + "%", height: "100%", background: t.color, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: t.color, minWidth: 40, textAlign: "right" }}>{t.pct}%</div>
          <span style={{ color: "#64748B", display: "flex" }}>
            <IconChevronRight />
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div style={{ flex: 1, minWidth: 0, background: "#0B0E11" }}>
    <div
      className=""
      style={{
        ...S.root,
        paddingBottom: isDesktop ? 40 : 100,
        padding: isDesktop ? "0 32px 40px 32px" : "0 16px 100px 16px",
        maxWidth: "none",
        width: "100%",
      }}
    >
      <style>
        {`
          .coach-dash-alerts {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            overflow-y: hidden;
            scroll-behavior: smooth;
            scroll-snap-type: x mandatory;
            margin-left: -16px;
            margin-right: -16px;
            padding-left: 16px;
            padding-right: 16px;
            padding-bottom: 6px;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          @media (min-width: 768px) {
            .coach-dash-alerts {
              margin-left: 0;
              margin-right: 0;
              padding-left: 0;
              padding-right: 0;
            }
          }
          .coach-dash-alerts::-webkit-scrollbar {
            display: none;
            height: 0;
          }
          .coach-dash-alert-card {
            scroll-snap-align: start;
          }
          @media (min-width: 768px) {
            .coach-dash-alerts {
              scrollbar-width: thin;
              scrollbar-color: rgba(148, 163, 184, 0.45) rgba(255, 255, 255, 0.06);
              padding-right: 36px;
              padding-bottom: 10px;
            }
            .coach-dash-alerts::-webkit-scrollbar {
              display: block;
              height: 8px;
            }
            .coach-dash-alerts::-webkit-scrollbar-track {
              background: rgba(255, 255, 255, 0.06);
              border-radius: 4px;
              margin: 0 4px;
            }
            .coach-dash-alerts::-webkit-scrollbar-thumb {
              background: rgba(148, 163, 184, 0.35);
              border-radius: 4px;
            }
            .coach-dash-alerts::-webkit-scrollbar-thumb:hover {
              background: rgba(148, 163, 184, 0.55);
            }
          }
          @media (min-width: 1024px) {
            .coach-dash-alerts {
              display: flex;
              flex-direction: column;
              overflow-x: unset;
              overflow-y: visible;
              gap: 12px;
              padding: 12px 14px;
              margin: 0;
              scroll-snap-type: none;
            }
            .coach-dash-alert-card {
              min-width: unset;
              max-width: unset;
              width: 100%;
            }
          }
        `}
      </style>

      {!isDesktop && (
        <header style={S.header}>
          <IronTrackLogo size={22} color="#2563EB" showBar={true} mode="Modo entrenador" modeColor="#2563EB" />
          {(coachAvatarUrl || coachName) ? (
            <div
              role="img"
              aria-label={coachName ? "Entrenador " + coachName : "Avatar"}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "linear-gradient(135deg,#1E3A5F,#2563EB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {coachAvatarUrl ? (
                <img src={coachAvatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                (coachName || "?").slice(0, 2).toUpperCase()
              )}
            </div>
          ) : null}
        </header>
      )}

      <div style={S.greeting}>Hola, Coach</div>

      <div style={{ ...S.card, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ ...S.cardTitleRow, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>Cumplimiento semanal</span>
              <button type="button" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" }} aria-label="Informacion">
                <IconInfo />
              </button>
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: -1, color: "#F1F5F9" }}>16 / 24</div>
            <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>sesiones completadas</div>
            <div
              style={{
                marginTop: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(34,197,94,0.15)",
                color: "#22C55E",
                borderRadius: 12,
                padding: "8px 12px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <IconClock />
              Quedan 2 días para completar
            </div>
          </div>
          <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0 }}>
            <WeeklyRing gradId={gradId} animId={ringAnimId} pct={68} />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "flex-end",
            justifyContent: "flex-start",
            maxWidth: isDesktop ? 480 : "100%",
            marginTop: 20,
            height: 72,
          }}
        >
          {dayBars.map((d, i) => (
            <div key={dayLabels[i]} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: "100%",
                  maxWidth: 36,
                  height: d.h,
                  borderRadius: 8,
                  background: d.fill,
                  opacity: d.opacity != null ? d.opacity : 1,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#64748B" }}>{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {isDesktop ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "flex-start" }}>
          <div>
            {renderEquipoMetricas()}
            {renderListaAlumnos()}
          </div>
          <div
            style={{
              background: "#111827",
              border: "1px solid #1a2535",
              borderRadius: 12,
              overflow: "hidden",
              position: "sticky",
              top: 20,
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #1a2535",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#64748B",
                display: "flex",
                alignItems: "center",
                gap: 7,
              }}
            >
              ★ ALERTAS INTELIGENTES
            </div>
            {renderAlertasCards()}
          </div>
        </div>
      ) : (
        <div>
          {renderEquipoMetricas()}
          {renderAlertasInteligentes()}
          {renderListaAlumnos()}
        </div>
      )}

      <div style={{ ...S.sectionLabel, marginTop: 4 }}>
        <IconLightning />
        Acciones rápidas
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button
          type="button"
          onClick={onEnviarMensaje}
          style={{
            flex: 1,
            border: "none",
            borderRadius: 12,
            padding: "14px 8px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            background: "linear-gradient(135deg, #1e40af 0%, #2563EB 100%)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconMessage />
          <span style={{ fontSize: 12, fontWeight: 800 }}>Enviar mensaje</span>
          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.9 }}>a tu equipo</span>
        </button>
        <button
          type="button"
          onClick={onCrearRutina}
          style={{
            flex: 1,
            border: "none",
            borderRadius: 12,
            padding: "14px 8px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            background: "linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconPlus />
          <span style={{ fontSize: 12, fontWeight: 800 }}>Crear rutina</span>
          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.9 }}>personalizada</span>
        </button>
        <button
          type="button"
          onClick={onRevisarAlumnos}
          style={{
            flex: 1,
            border: "none",
            borderRadius: 12,
            padding: "14px 8px",
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            background: "linear-gradient(135deg, #064e3b 0%, #059669 100%)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconEye />
          <span style={{ fontSize: 12, fontWeight: 800 }}>Revisar alumnos</span>
          <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.9 }}>que necesitan atención</span>
        </button>
      </div>

      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ color: "#2563EB" }}>
          <IconTrophy />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#94A3B8" }}>Tu rendimiento</span>
            <IconInfo />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#F1F5F9" }}>72 /100</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#22C55E", marginTop: 4 }}>↑ 8 pts vs semana pasada</div>
        </div>
        <CoachScoreRing pct={72} />
      </div>

      <nav style={S.bottomNav}>
        {navItems.map(({ key, label, ic }) => {
          const active = activeNav === key;
          return (
            <button
              key={key}
              type="button"
              style={{
                ...S.navBtn,
                color: active ? "#2563EB" : "#94A3B8",
                opacity: active ? 1 : 0.4,
              }}
              onClick={() => setActiveNav && setActiveNav(key)}
            >
              <Ic name={ic} size={20} color={active ? "#2563EB" : "#8B9AB2"} />
              <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{label}</span>
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#2563EB",
                  opacity: active ? 1 : 0,
                  marginTop: 2,
                }}
              />
            </button>
          );
        })}
      </nav>
    </div>
      </div>
    </>
  );
}
