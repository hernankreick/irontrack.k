import { useEffect, useId, useState } from "react";
import AIAlerts, { aiAlertsColors as T } from "./AIAlerts.jsx";

const noiseBg =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='.025'/%3E%3C/svg%3E\")";

function GlobalCoachDashStyles() {
  return (
    <style>
      {`
        @keyframes coachDashFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}
    </style>
  );
}

function IconBarChartTiny() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconCalendarTiny() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconClockTiny() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconUsersTiny() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconMessageCenter() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconAwardTiny() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

function MetricCardIcon({ name }) {
  const s = { width: 11, height: 11, viewBox: "0 0 24 24", fill: "none", stroke: T.text3, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "dollar")
    return (
      <svg {...s}>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  if (name === "users")
    return (
      <svg {...s}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  if (name === "trend")
    return (
      <svg {...s}>
        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
        <polyline points="17 18 23 18 23 12" />
      </svg>
    );
  if (name === "heart")
    return (
      <svg {...s}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  return (
    <svg {...s}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function SessionTypeIcon({ name }) {
  const c = { width: 11, height: 11, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "online")
    return (
      <svg {...c}>
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    );
  return (
    <svg {...c}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

function StreakBolt() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={T.amber} stroke="none" aria-hidden>
      <polygon points="13,2 3,14 12,14 11,22 21,10 12,10" />
    </svg>
  );
}

const secTitleBase = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "1.8px",
  textTransform: "uppercase",
  color: T.text3,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

/**
 * Dashboard coach — layout y datos vía props (sin App.jsx).
 *
 * Pasá objetos vacíos o listas vacías para secciones sin datos todavía.
 */
export default function CoachDashboard({
  onViewBusinessDetail,
  onViewAllAlerts,
  onViewMessageHistory,
  onViewFullWeek,
  onViewAllStudents,
  greeting = {},
  businessMetrics = {},
  aiAlerts: aiAlertsProp = {},
  weeklyActivity = {},
  todayAgenda = {},
  students: studentsProp = {},
  messageCenter = {},
  coachGamification = {},
  bottomNav = {},
}) {
  const sparkGradId = useId().replace(/:/g, "");
  const [barsReady, setBarsReady] = useState(false);

  const {
    periodLabel = "",
    coachName = "",
    name: greetingName,
    streakDays = null,
    streakLabelSuffix = "días de racha",
  } = greeting;

  const rawGreetingName = greetingName ?? coachName ?? "";
  const displayGreetingName =
    !String(rawGreetingName).trim() || rawGreetingName === "Entrenador" ? "Coach" : rawGreetingName;

  const {
    title: metricsTitle = "Métricas del negocio",
    detailLabel = "Ver detalle",
    cards: metricCards = [],
    projection: projectionProp = null,
  } = businessMetrics;

  const {
    completionPercent = 0,
    completionLabel = "Cumplimiento semanal",
    sessionsSummary = "",
    days: weekDays = [],
  } = weeklyActivity;

  const {
    title: agendaTitle = "Agenda de hoy",
    weekLinkLabel = "Semana completa",
    sessions: agendaSessions = [],
  } = todayAgenda;

  const {
    title: studentsTitle = "Alumnos",
    viewAllLabel: studentsViewAll = "Ver todos",
    students: studentRows = [],
  } = studentsProp;

  const {
    title: msgTitle = "Centro de mensajes",
    historyLabel = "Historial",
    categories = [],
    selectedCategoryId = null,
    onSelectCategory,
    templates = [],
  } = messageCenter;

  const {
    streakValue = "",
    streakTitle = "Racha activa",
    streakSubtitle = "",
    recordLabel = "",
    weeklyGoalLabel = "Meta semanal de sesiones",
    weeklyGoalCurrent = 0,
    weeklyGoalTarget = 0,
    achievements = [],
  } = coachGamification;

  const {
    items: navItems = [],
    activeId = null,
    onNavSelect,
  } = bottomNav;

  const donutRadius = 30;
  const donutCirc = 2 * Math.PI * donutRadius;
  const dashOffset = donutCirc * (1 - Math.min(100, Math.max(0, completionPercent)) / 100);

  useEffect(() => {
    const tid = setTimeout(() => setBarsReady(true), 200);
    return () => clearTimeout(tid);
  }, [weekDays]);

  const goalPct =
    weeklyGoalTarget > 0 ? Math.min(100, Math.round((weeklyGoalCurrent / weeklyGoalTarget) * 100)) : 0;

  return (
    <>
      <GlobalCoachDashStyles />
      <div
        style={{
          background: T.bg,
          backgroundImage: noiseBg,
          color: T.text,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          fontSize: 15,
          lineHeight: 1.5,
          maxWidth: 430,
          margin: "0 auto",
          paddingBottom: 84,
          overflowX: "hidden",
          minHeight: "100vh",
          boxSizing: "border-box",
        }}
      >
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: T.text3 }}>{periodLabel}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: T.text, marginTop: 3, lineHeight: 1.15 }}>{displayGreetingName}</div>
          {streakDays != null ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 10,
                background: "rgba(245,158,11,.1)",
                border: "1px solid rgba(245,158,11,.22)",
                borderRadius: 20,
                padding: "5px 11px",
                fontSize: 12,
                fontWeight: 600,
                color: T.amber,
              }}
            >
              <StreakBolt />
              {streakDays} {streakLabelSuffix}
            </div>
          ) : null}
        </div>

        <div style={{ padding: "0 16px" }}>
          {/* Métricas */}
          <section style={{ marginTop: 24, animation: "coachDashFadeUp .4s ease both", animationDelay: "0.04s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secTitleBase}>
                <IconBarChartTiny />
                {metricsTitle}
              </div>
              {onViewBusinessDetail ? (
                <button
                  type="button"
                  onClick={() => onViewBusinessDetail()}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.blue2,
                    cursor: "pointer",
                    letterSpacing: "0.3px",
                    background: "none",
                    border: "none",
                    minHeight: 44,
                    padding: "6px 4px",
                  }}
                >
                  {detailLabel}
                </button>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: T.blue2, letterSpacing: "0.3px" }}>{detailLabel}</span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {metricCards.map((m, idx) => (
                <div
                  key={m.id ?? idx}
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: "14px 14px 12px",
                    position: "relative",
                    overflow: "hidden",
                    gridColumn: m.fullWidth ? "1 / -1" : undefined,
                    ...(m.fullWidth
                      ? {
                          background: "linear-gradient(135deg,rgba(37,99,235,.1),rgba(34,197,94,.07))",
                          borderColor: "rgba(37,99,235,.18)",
                        }
                      : {}),
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      borderRadius: "14px 0 0 14px",
                      background: m.accentColor || T.blue,
                    }}
                  />
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: T.text3, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                    <MetricCardIcon name={m.icon || "dollar"} />
                    {m.label}
                  </div>
                  <div style={{ fontSize: m.fullWidth ? 26 : 23, fontWeight: 700, lineHeight: 1, color: m.valueColor || T.text }}>{m.value}</div>
                  {m.subline ? (
                    <div style={{ fontSize: 11, color: T.text2, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                      {m.trend ? (
                        <span style={{ color: m.trend.good ? T.green : T.red, fontWeight: 600 }}>{m.trend.text}</span>
                      ) : null}{" "}
                      {m.subline}
                    </div>
                  ) : null}
                </div>
              ))}

              {projectionProp ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "linear-gradient(135deg,rgba(37,99,235,.1),rgba(34,197,94,.07))",
                    border: "1px solid rgba(37,99,235,.18)",
                    borderRadius: 14,
                    padding: "14px 14px 12px",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: T.text3, marginBottom: 7, display: "flex", alignItems: "center", gap: 5 }}>
                    <MetricCardIcon name="projection" />
                    {projectionProp.title}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, color: projectionProp.valueColor || T.green }}>{projectionProp.value}</div>
                    {projectionProp.trendText ? (
                      <span style={{ color: T.green, fontWeight: 600, fontSize: 15 }}>{projectionProp.trendText}</span>
                    ) : null}
                  </div>
                  {projectionProp.subline ? (
                    <div style={{ fontSize: 11, color: T.text2, marginTop: 5 }}>{projectionProp.subline}</div>
                  ) : null}
                  <svg className="spark" viewBox="0 0 260 36" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", marginTop: 10, width: "100%", height: 36 }}>
                    <defs>
                      <linearGradient id={sparkGradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0,32 C30,30 60,26 90,22 C120,18 150,13 180,10 C210,7 235,5 260,2" fill="none" stroke="rgba(34,197,94,0.6)" strokeWidth="1.8" strokeLinecap="round" />
                    <path d={`M0,32 C30,30 60,26 90,22 C120,18 150,13 180,10 C210,7 235,5 260,2 L260,36 L0,36Z`} fill={`url(#${sparkGradId})`} />
                    <circle cx="260" cy="2" r="3.5" fill={T.green} />
                  </svg>
                </div>
              ) : null}
            </div>
          </section>

          <AIAlerts {...aiAlertsProp} onViewAll={onViewAllAlerts ?? aiAlertsProp.onViewAll} />

          {/* Actividad semanal */}
          <section style={{ marginTop: 24, animation: "coachDashFadeUp .4s ease both", animationDelay: "0.12s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secTitleBase}>
                <IconCalendarTiny />
                Actividad semanal
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
                <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink: 0 }} aria-hidden>
                  <circle cx="38" cy="38" r="30" fill="none" stroke={T.bg3} strokeWidth="9" />
                  <circle
                    cx="38"
                    cy="38"
                    r="30"
                    fill="none"
                    stroke={T.green}
                    strokeWidth="9"
                    strokeDasharray={donutCirc}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 38 38)"
                    style={{ transition: "stroke-dashoffset .8s ease" }}
                  />
                  <text x="38" y="43" textAnchor="middle" fill={T.text} fontSize="14" fontWeight="700" fontFamily="DM Sans, system-ui, sans-serif">
                    {completionPercent}%
                  </text>
                </svg>
                <div>
                  <div style={{ fontSize: 30, fontWeight: 700, color: T.green, lineHeight: 1 }}>{completionPercent}%</div>
                  <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{completionLabel}</div>
                  <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{sessionsSummary}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
                {weekDays.map((d, i) => {
                  const isZero = (d.sessionsCount ?? 0) === 0;
                  const h = isZero ? 5 : d.barHeightPx ?? 0;
                  return (
                    <div key={d.id ?? i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: T.text3 }}>{d.label}</div>
                      <div style={{ height: 56, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", width: "100%" }}>
                        <div
                          style={{
                            width: 22,
                            borderRadius: "4px 4px 0 0",
                            transition: "height .5s cubic-bezier(.34,1.56,.64,1)",
                            height: barsReady ? h : 0,
                            background: isZero ? T.bg3 : d.isToday ? T.blue : "rgba(37,99,235,.35)",
                            border: isZero ? `1px solid ${T.border}` : d.isToday ? "none" : "1px solid rgba(59,130,246,.25)",
                            boxShadow: d.isToday && !isZero ? "0 0 10px rgba(37,99,235,.5)" : "none",
                          }}
                        />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: d.isToday ? T.blue2 : T.text2 }}>{isZero ? "—" : d.sessionsCount}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Agenda */}
          <section style={{ marginTop: 24, animation: "coachDashFadeUp .4s ease both", animationDelay: "0.16s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secTitleBase}>
                <IconClockTiny />
                {agendaTitle}
              </div>
              {onViewFullWeek ? (
                <button
                  type="button"
                  onClick={() => onViewFullWeek()}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.blue2,
                    cursor: "pointer",
                    letterSpacing: "0.3px",
                    background: "none",
                    border: "none",
                    minHeight: 44,
                    padding: "6px 4px",
                  }}
                >
                  {weekLinkLabel}
                </button>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: T.blue2 }}>{weekLinkLabel}</span>
              )}
            </div>
            {agendaSessions.map((s, idx) => {
              const timeTone = s.timeTone === "blue" ? "t-blue" : s.timeTone === "amber" ? "t-amber" : "t-muted";
              const toneStyle =
                timeTone === "t-blue"
                  ? { background: T.blueDim, border: "1px solid rgba(59,130,246,.2)" }
                  : timeTone === "t-amber"
                    ? { background: T.amberDim, border: "1px solid rgba(245,158,11,.2)" }
                    : { background: T.bg3, border: `1px solid ${T.border}` };
              const timeColor = timeTone === "t-blue" ? T.blue2 : timeTone === "t-amber" ? T.amber : T.text3;
              const statusStyle =
                s.statusVariant === "ok"
                  ? { background: T.greenDim, color: T.green, border: "1px solid rgba(34,197,94,.2)" }
                  : s.statusVariant === "pend"
                    ? { background: T.amberDim, color: T.amber, border: "1px solid rgba(245,158,11,.2)" }
                    : { background: T.bg3, color: T.text3, border: `1px solid ${T.border}` };
              return (
                <div
                  key={s.id ?? idx}
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    borderRadius: 14,
                    padding: "13px 14px",
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: s.onClick ? "pointer" : "default",
                    opacity: s.muted ? 0.55 : 1,
                  }}
                  onClick={s.onClick}
                  onKeyDown={s.onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); s.onClick(); } } : undefined}
                  role={s.onClick ? "button" : undefined}
                  tabIndex={s.onClick ? 0 : undefined}
                >
                  <div style={{ borderRadius: 9, padding: "7px 10px", textAlign: "center", flexShrink: 0, minWidth: 52, ...toneStyle }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 500, color: timeColor }}>{s.time}</div>
                    <div style={{ fontSize: 9, letterSpacing: "0.5px", textTransform: "uppercase", color: T.text3 }}>{s.ampm}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.studentName}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                      <SessionTypeIcon name={s.sessionTypeIcon || "presencial"} />
                      {s.detail}
                    </div>
                  </div>
                  <div style={{ borderRadius: 20, padding: "3px 9px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", flexShrink: 0, ...statusStyle }}>{s.statusLabel}</div>
                </div>
              );
            })}
          </section>

          {/* Alumnos */}
          <section style={{ marginTop: 24, animation: "coachDashFadeUp .4s ease both", animationDelay: "0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secTitleBase}>
                <IconUsersTiny />
                {studentsTitle}
              </div>
              {onViewAllStudents ? (
                <button
                  type="button"
                  onClick={() => onViewAllStudents()}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.blue2,
                    cursor: "pointer",
                    letterSpacing: "0.3px",
                    background: "none",
                    border: "none",
                    minHeight: 44,
                    padding: "6px 4px",
                  }}
                >
                  {studentsViewAll}
                </button>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: T.blue2 }}>{studentsViewAll}</span>
              )}
            </div>
            {studentRows.map((st, idx) => (
              <div
                key={st.id ?? idx}
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: "13px 14px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  cursor: st.onRowClick ? "pointer" : "default",
                }}
                onClick={st.onRowClick}
                role={st.onRowClick ? "button" : undefined}
                tabIndex={st.onRowClick ? 0 : undefined}
              >
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    fontWeight: 700,
                    position: "relative",
                    background: st.avatarBg,
                    color: st.avatarColor,
                  }}
                >
                  {st.initials}
                  <span
                    style={{
                      position: "absolute",
                      bottom: 1,
                      right: 1,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      border: `2px solid ${T.card}`,
                      background: st.dotColor,
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.name}</div>
                  <div style={{ fontSize: 11, color: st.sublineColor || T.text3, marginTop: 2 }}>{st.subline}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: st.rateColor || T.text2,
                    }}
                  >
                    {st.rateLabel}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        st.onChart?.();
                      }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: T.bg3,
                        border: `1px solid ${T.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: st.onChart ? "pointer" : "default",
                        padding: 0,
                      }}
                      aria-label="Ver progreso"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        st.onMessage?.();
                      }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: T.bg3,
                        border: `1px solid ${T.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: st.onMessage ? "pointer" : "default",
                        padding: 0,
                        position: "relative",
                      }}
                      aria-label="Mensaje"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.text2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      {st.messageBadge ? (
                        <span
                          style={{
                            position: "absolute",
                            top: -2,
                            right: -2,
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: T.red,
                            border: `1.5px solid ${T.card}`,
                          }}
                        />
                      ) : null}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          {/* Centro de mensajes */}
          <section style={{ marginTop: 24, animation: "coachDashFadeUp .4s ease both", animationDelay: "0.24s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secTitleBase}>
                <IconMessageCenter />
                {msgTitle}
              </div>
              {onViewMessageHistory ? (
                <button
                  type="button"
                  onClick={() => onViewMessageHistory()}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.blue2,
                    cursor: "pointer",
                    letterSpacing: "0.3px",
                    background: "none",
                    border: "none",
                    minHeight: 44,
                    padding: "6px 4px",
                  }}
                >
                  {historyLabel}
                </button>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 600, color: T.blue2 }}>{historyLabel}</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
              {categories.map((c) => {
                const on = c.id === selectedCategoryId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCategory?.(c.id)}
                    style={{
                      flexShrink: 0,
                      padding: "7px 14px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: onSelectCategory ? "pointer" : "default",
                      border: `1px solid ${T.border}`,
                      background: on ? T.blue : T.card,
                      color: on ? "#fff" : T.text2,
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      minHeight: 44,
                    }}
                  >
                    {c.icon}
                    {c.label}
                  </button>
                );
              })}
            </div>
            {templates.map((tpl, i) => (
              <div
                key={tpl.id ?? i}
                style={{
                  background: T.card,
                  border: tpl.borderColor ? `1px solid ${tpl.borderColor}` : `1px solid ${T.border}`,
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 9,
                  cursor: tpl.onClick ? "pointer" : "default",
                }}
                onClick={tpl.onClick}
                role={tpl.onClick ? "button" : undefined}
                tabIndex={tpl.onClick ? 0 : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{tpl.title}</div>
                  <div
                    style={{
                      background: tpl.aiPillBg || T.blueDim,
                      color: tpl.aiPillColor || T.blue2,
                      border: `1px solid ${tpl.aiPillBorder || "rgba(59,130,246,.2)"}`,
                      borderRadius: 20,
                      padding: "3px 8px",
                      fontSize: 10,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                    }}
                  >
                    {tpl.aiPillIcon}
                    IA
                  </div>
                </div>
                <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.65 }}>{tpl.body}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11 }}>
                  <div style={{ fontSize: 10, color: T.text3, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 4 }}>
                    {tpl.footerIcon}
                    {tpl.footerLabel}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      tpl.onSend?.();
                    }}
                    style={{
                      padding: "7px 13px",
                      borderRadius: 9,
                      background: tpl.sendBg || T.blue,
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.6px",
                      textTransform: "uppercase",
                      cursor: tpl.onSend ? "pointer" : "default",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      minHeight: 44,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {tpl.sendLabel || "Enviar"}
                  </button>
                </div>
              </div>
            ))}
          </section>

          {/* Gamificación coach */}
          <section style={{ marginTop: 24, marginBottom: 24, animation: "coachDashFadeUp .4s ease both", animationDelay: "0.28s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={secTitleBase}>
                <IconAwardTiny />
                Tu progreso como coach
              </div>
            </div>
            <div
              style={{
                background: "linear-gradient(135deg,rgba(37,99,235,.18),rgba(34,197,94,.09))",
                border: "1px solid rgba(37,99,235,.25)",
                borderRadius: 14,
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 9,
              }}
            >
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: T.amber, lineHeight: 1, letterSpacing: 1 }}>{streakValue}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{streakTitle}</div>
                <div style={{ fontSize: 11, color: T.text2, marginTop: 3 }}>{streakSubtitle}</div>
                {recordLabel ? (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.blue2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10" />
                    </svg>
                    <span style={{ fontSize: 11, color: T.blue2, fontWeight: 600 }}>{recordLabel}</span>
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "13px 14px", marginBottom: 9 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12, color: T.text2 }}>
                <span>{weeklyGoalLabel}</span>
                <span style={{ color: T.blue2, fontWeight: 700 }}>
                  {weeklyGoalCurrent} / {weeklyGoalTarget}
                </span>
              </div>
              <div style={{ background: T.bg3, borderRadius: 20, height: 6 }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 20,
                    transition: "width .6s ease",
                    width: `${goalPct}%`,
                    background: "linear-gradient(90deg, #2563EB, #3B82F6)",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
              {achievements.map((a, i) => (
                <div
                  key={a.id ?? i}
                  style={{
                    background: T.card,
                    border: `1px solid ${a.unlocked ? "rgba(34,197,94,.2)" : T.border}`,
                    borderRadius: 14,
                    padding: "14px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    gap: 7,
                    opacity: a.unlocked === false ? 0.38 : 1,
                    pointerEvents: a.unlocked === false ? "none" : "auto",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      background: a.iconBg,
                    }}
                  >
                    {a.icon}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>{a.title}</div>
                  {a.subline ? (
                    <div style={{ fontSize: 10, color: a.sublineColor || T.text3, fontWeight: a.sublineBold ? 600 : 500 }}>{a.subline}</div>
                  ) : null}
                  {a.progress != null ? (
                    <div style={{ width: "100%", background: T.bg3, borderRadius: 20, height: 4, marginTop: 2 }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 20,
                          transition: "width .6s ease",
                          width: `${a.progress}%`,
                          background: a.progressColor || T.amber,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>

        <nav
          style={{
            position: "fixed",
            bottom: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 430,
            background: "rgba(11,14,17,.94)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderTop: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            padding: "8px 0 calc(8px + env(safe-area-inset-bottom))",
            zIndex: 300,
          }}
        >
          {navItems.map((item) => {
            const active = item.id === activeId;
            const stroke = active ? T.blue2 : T.text3;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavSelect?.(item.id)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  cursor: onNavSelect ? "pointer" : "default",
                  padding: "8px 0",
                  minHeight: 44,
                  background: "none",
                  border: "none",
                }}
              >
                {item.iconRenderer ? item.iconRenderer({ stroke, active }) : null}
                <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: active ? T.blue2 : T.text3 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
