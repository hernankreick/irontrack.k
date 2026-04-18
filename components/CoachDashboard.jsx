import React from "react";
import GlobalCreateMenu from "./GlobalCreateMenu.jsx";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  Dumbbell,
  Eye,
  Info,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Bar, BarChart, Cell, RadialBar, RadialBarChart, ResponsiveContainer, XAxis } from "recharts";

const DS = {
  bg: "#08101d",
  panel: "#0f172a",
  panelSoft: "#111c31",
  border: "rgba(62, 84, 120, 0.35)",
  line: "rgba(255,255,255,0.06)",
  text: "#f8fafc",
  muted: "#93a4c2",
  primary: "#2f6cf6",
  primarySoft: "#3b82f6",
  green: "#22c55e",
  yellow: "#fbbf24",
  red: "#ff4d4f",
};

const FONTS = {
  title: "'Bebas Neue', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'DM Mono', monospace",
};

function useDashboardFonts() {
  React.useEffect(function () {
    const id = "irontrack-coach-dashboard-fonts";
    if (typeof document === "undefined" || document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500;700&display=swap";
    document.head.appendChild(link);
  }, []);
}

function initialsFromName(name) {
  return String(name || "Coach")
    .trim()
    .split(/\s+/)
    .map(function (part) {
      return part.charAt(0);
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function greetingLabel() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos dias";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function pctColor(pct) {
  if (pct >= 70) return DS.green;
  if (pct >= 30) return DS.yellow;
  return DS.red;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "alumnos", label: "Alumnos", icon: Users },
  { id: "routines", label: "Rutinas", icon: ClipboardList },
  { id: "exercises", label: "Ejercicios", icon: Dumbbell },
  { id: "progress", label: "Progreso", icon: BarChart3 },
  { id: "messages", label: "Mensajes", icon: MessageSquare },
];

const weekBarData = [
  { day: "L", value: 4, fill: "#3168f5" },
  { day: "M", value: 5, fill: "#3b78ff" },
  { day: "X", value: 4.2, fill: "#3772fb" },
  { day: "J", value: 5.5, fill: "#4b81ff" },
  { day: "V", value: 2.8, fill: "#213b89" },
  { day: "S", value: 1.2, fill: "#1a243d" },
  { day: "D", value: 1.1, fill: "#1a243d" },
];

const teamStats = [
  { id: "ok", value: 5, label: "Cumpliendo", detail: ">= 70% sesiones", color: DS.green, Icon: CheckCircle2 },
  { id: "mid", value: 2, label: "En progreso", detail: "30% - 69%", color: DS.yellow, Icon: Clock3 },
  { id: "low", value: 1, label: "Sin actividad", detail: "< 30%", color: DS.red, Icon: CircleAlert },
];

const alertCards = [
  { id: "1", alumnoId: "1", name: "Agustin Torres", initials: "AT", badge: "1 de 3 sesiones", badgeColor: DS.red, copy: "Podria no completar la semana.", buttonColor: DS.red },
  { id: "2", alumnoId: "2", name: "Sofia Gomez", initials: "SG", badge: "Sin actividad", badgeColor: DS.yellow, copy: "Aun tiene tiempo para ponerse al dia.", buttonColor: DS.yellow },
  { id: "3", alumnoId: "3", name: "Lucas Diaz", initials: "LD", badge: "2 de 4 sesiones", badgeColor: DS.red, copy: "Necesita seguimiento de esta semana.", buttonColor: DS.red },
];

const quickActions = [
  { id: "message", title: "Enviar mensaje", subtitle: "a tu equipo", icon: MessageSquare, bg: "linear-gradient(180deg,#2f6cf6 0%,#295ad0 100%)" },
  { id: "routine", title: "Crear rutina", subtitle: "personalizada", icon: ClipboardList, bg: "linear-gradient(180deg,#6d28d9 0%,#7c3aed 100%)" },
  { id: "review", title: "Revisar alumnos", subtitle: "que necesitan atencion", icon: Eye, bg: "linear-gradient(180deg,#0f8a5d 0%,#129b67 100%)" },
];

const performanceRing = [{ name: "score", value: 72, fill: DS.primary }];

function buildStudents(alumnos) {
  const fallback = [
    { id: "1", nombre: "Julieta Laroze", progreso: 82, last: "Hoy" },
    { id: "2", nombre: "Agustin", progreso: 45, last: "Hace 2 dias" },
    { id: "3", nombre: "Hernan", progreso: 0, last: "Sin actividad" },
  ];
  const base = Array.isArray(alumnos) && alumnos.length ? alumnos : fallback;
  return base.slice(0, 6).map(function (alumno, index) {
    const pct = typeof alumno.progreso === "number" ? alumno.progreso : [82, 45, 0][index % 3];
    return {
      id: alumno.id || String(index + 1),
      name: alumno.nombre || alumno.email || "Alumno",
      initials: initialsFromName(alumno.nombre || alumno.email || "Alumno"),
      pct: pct,
      color: pctColor(pct),
      last: alumno.last || ["Hoy", "Hace 2 dias", "Sin actividad"][index % 3],
    };
  });
}

function Card(props) {
  return (
    <section
      style={Object.assign(
        {
          background: DS.panel,
          border: "1px solid " + DS.border,
          borderRadius: 18,
          boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
        },
        props.style || {}
      )}
    >
      {props.children}
    </section>
  );
}

function BrandMark() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, paddingTop: 2 }}>
          <div style={{ width: 4, height: 34, borderRadius: 999, background: DS.primarySoft }} />
          <div style={{ width: 4, height: 28, borderRadius: 999, background: "#6aa1ff" }} />
        </div>
        <div>
          <div style={{ fontFamily: FONTS.title, fontSize: 28, lineHeight: 0.92, letterSpacing: 1.2, color: "#2d6fff" }}>
            IRON
            <br />
            TRACK
          </div>
          <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#4f86ff" }}>MODO ENTRENADOR</div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ item, active, onClick }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        border: "none",
        background: active ? "rgba(47,108,246,0.14)" : "transparent",
        color: active ? "#fff" : DS.muted,
        padding: "14px 16px",
        borderRadius: 14,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: FONTS.body,
        fontSize: 15,
        fontWeight: active ? 700 : 500,
      }}
    >
      {active ? <span style={{ position: "absolute", left: -16, top: "50%", transform: "translateY(-50%)", width: 4, height: 40, borderRadius: 999, background: DS.primarySoft }} /> : null}
      <Icon size={20} color={active ? DS.primarySoft : "#7c8fb0"} />
      <span>{item.label}</span>
    </button>
  );
}

function OverviewStat({ stat }) {
  const Icon = stat.Icon;
  return (
    <div style={{ borderRadius: 16, border: "1px solid " + DS.border, background: DS.panelSoft, padding: 18, minHeight: 156 }}>
      <Icon size={20} color={stat.color} />
      <div style={{ marginTop: 18, fontFamily: FONTS.mono, fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
      <div style={{ marginTop: 10, fontSize: 15, fontWeight: 700, color: "#fff" }}>{stat.label}</div>
      <div style={{ marginTop: 8, fontSize: 13, color: DS.muted }}>{stat.detail}</div>
    </div>
  );
}

function AlertCard({ alert, onRevisar, onVerPerfil }) {
  return (
    <div className="flex-shrink-0" style={{ minWidth: 274, borderRadius: 18, border: "1px solid " + DS.border, background: DS.panelSoft, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#172443", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18, color: "#d7e3ff" }}>
          {alert.initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{alert.name}</div>
          <div style={{ display: "inline-flex", alignItems: "center", padding: "5px 10px", borderRadius: 999, border: "1px solid " + alert.badgeColor, color: alert.badgeColor, fontSize: 12, fontWeight: 700 }}>
            {alert.badge}
          </div>
        </div>
      </div>
      <div style={{ minHeight: 54, color: DS.muted, fontSize: 15, lineHeight: 1.45 }}>{alert.copy}</div>
      <div className="mt-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={function () {
            onRevisar && onRevisar(alert.alumnoId);
          }}
          style={{ border: "none", borderRadius: 14, background: alert.buttonColor, color: alert.buttonColor === DS.yellow ? "#101522" : "#fff", fontFamily: FONTS.body, fontSize: 14, fontWeight: 800, letterSpacing: 0.5, padding: "14px 12px", cursor: "pointer" }}
        >
          REVISAR
        </button>
        <button
          type="button"
          onClick={function () {
            onVerPerfil && onVerPerfil(alert.alumnoId);
          }}
          style={{ border: "1px solid " + DS.border, borderRadius: 14, background: "#18243d", color: "#90a1bf", fontFamily: FONTS.body, fontSize: 14, fontWeight: 700, padding: "14px 12px", cursor: "pointer" }}
        >
          VER PERFIL
        </button>
      </div>
    </div>
  );
}

function QuickActionCard({ action, onClick }) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ border: "none", borderRadius: 18, background: action.bg, color: "#fff", minHeight: 170, padding: "24px 20px", cursor: "pointer", textAlign: "left", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
    >
      <div style={{ width: 50, height: 50, borderRadius: 16, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
        <Icon size={22} color="#fff" />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{action.title}</div>
      <div style={{ fontSize: 14, color: "rgba(255,255,255,0.82)", lineHeight: 1.45 }}>{action.subtitle}</div>
    </button>
  );
}

function StudentTableRow({ student, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-full min-w-[640px] cursor-pointer grid-cols-[56px_minmax(0,1.4fr)_minmax(240px,1fr)_150px_24px] items-center gap-3.5 border-none border-t bg-transparent py-5 pl-0.5 pr-0.5 text-left lg:min-w-0"
      style={{ borderTop: "1px solid " + DS.line }}
    >
      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#14234a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#d6e2ff" }}>{student.initials}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{student.name}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 999, background: "#1a2340" }}>
          <div style={{ height: "100%", width: student.pct + "%", borderRadius: 999, background: student.color }} />
        </div>
        <div style={{ minWidth: 46, textAlign: "right", fontFamily: FONTS.mono, fontSize: 16, fontWeight: 700, color: student.color }}>{student.pct}%</div>
      </div>
      <div style={{ fontSize: 15, color: student.pct === 0 ? DS.muted : "#e7eefc" }}>{student.last}</div>
      <ChevronRight size={20} color="#7b8dac" />
    </button>
  );
}

function PlaceholderView({ title }) {
  return (
    <Card style={{ margin: 24, padding: 24 }}>
      <div style={{ fontFamily: FONTS.title, fontSize: 34, letterSpacing: 1.2, color: "#fff", marginBottom: 12 }}>{title}</div>
      <div style={{ color: DS.muted, fontSize: 15 }}>Esta vista queda disponible desde la navegacion principal de la app.</div>
    </Card>
  );
}

export default function CoachDashboard({
  embedded = false,
  alumnos = [],
  activeNav: activeNavProp = "dashboard",
  setActiveNav,
  onRevisar,
  onVerPerfil,
  onEnviarMensaje,
  onCrearRutina,
  onNuevoAlumno,
  onNuevoEjercicio,
  onRevisarAlumnos,
  coachAvatarUrl,
  coachName,
}) {
  useDashboardFonts();

  const isControlled = typeof setActiveNav === "function";
  const [uncontrolledNav, setUncontrolledNav] = React.useState(activeNavProp);
  const activeNav = isControlled ? activeNavProp : uncontrolledNav;
  const [query, setQuery] = React.useState("");

  React.useEffect(
    function () {
      if (!isControlled) setUncontrolledNav(activeNavProp);
    },
    [activeNavProp, isControlled]
  );

  function navigate(id) {
    if (isControlled) setActiveNav(id);
    else setUncontrolledNav(id);
  }

  const students = React.useMemo(function () {
    return buildStudents(alumnos);
  }, [alumnos]);

  const filteredStudents = React.useMemo(
    function () {
      if (!query.trim()) return students;
      return students.filter(function (student) {
        return student.name.toLowerCase().includes(query.trim().toLowerCase());
      });
    },
    [students, query]
  );

  function handleQuickAction(id) {
    if (id === "message") onEnviarMensaje && onEnviarMensaje();
    if (id === "routine") onCrearRutina && onCrearRutina();
    if (id === "review") onRevisarAlumnos && onRevisarAlumnos();
  }

  function renderDashboard() {
    return (
      <div className="box-border max-w-full min-w-0 px-4 pb-7 pt-[18px] sm:px-5 md:px-[22px]">
        <div className="mb-[18px] grid grid-cols-1 gap-[18px] lg:grid-cols-2">
          <Card style={{ padding: 24 }}>
            <div className="mb-[18px] flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0 text-[20px] font-bold leading-tight text-white sm:text-[24px]">Cumplimiento semanal</div>
              <Info size={19} color="#8ba0c4" />
            </div>
            <div className="grid grid-cols-1 items-center gap-[18px] md:grid-cols-[1fr_210px]">
              <div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 62, fontWeight: 700, lineHeight: 1, color: "#fff" }}>16 / 24</div>
                <div style={{ marginTop: 10, marginBottom: 22, color: DS.muted, fontSize: 17 }}>sesiones completadas</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 16, background: "rgba(16, 105, 63, 0.32)", color: "#3ee082", fontSize: 16, fontWeight: 700, marginBottom: 24 }}>
                  <Clock3 size={17} />
                  Quedan 2 dias para completar
                </div>
                <div style={{ height: 132, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekBarData} barCategoryGap={14} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8ba0c4", fontSize: 13, fontFamily: FONTS.body }} />
                      <Bar dataKey="value" radius={[12, 12, 12, 12]}>
                        {weekBarData.map(function (entry) {
                          return <Cell key={entry.day} fill={entry.fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ position: "relative", width: 196, height: 196, margin: "0 auto" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="78%" outerRadius="100%" data={[{ name: "pct", value: 68, fill: "url(#coachGauge)" }]} startAngle={90} endAngle={-270} barSize={14}>
                    <defs>
                      <linearGradient id="coachGauge" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#39e079" />
                        <stop offset="100%" stopColor="#2f6cf6" />
                      </linearGradient>
                    </defs>
                    <RadialBar dataKey="value" background={{ fill: "#1a2340" }} cornerRadius={999} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontSize: 32, fontWeight: 700, color: "#fff" }}>68%</div>
              </div>
            </div>
          </Card>

          <Card style={{ overflow: "hidden" }}>
            <div style={{ padding: "22px 22px 18px", borderBottom: "1px solid " + DS.line }}>
              <div className="mb-[18px] min-w-0 text-[20px] font-bold leading-tight text-white sm:text-[24px]">Equipo de un vistazo</div>
              <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-3">
                {teamStats.map(function (stat) {
                  return <OverviewStat key={stat.id} stat={stat} />;
                })}
              </div>
            </div>
            <div style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertCircle size={18} color={DS.yellow} />
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Alertas inteligentes</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <button type="button" style={{ border: "none", background: "none", color: DS.primarySoft, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>Ver todas</button>
                  <div style={{ display: "flex", gap: 10, color: "#8ba0c4" }}>
                    <ChevronRight size={18} style={{ transform: "rotate(180deg)" }} />
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>
              <div className="-mx-2 flex gap-[14px] overflow-x-auto px-2 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible">
                {alertCards.map(function (alert) {
                  return <AlertCard key={alert.id} alert={alert} onRevisar={onRevisar} onVerPerfil={onVerPerfil} />;
                })}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-[minmax(0,1fr)_330px]">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Acciones rapidas</div>
            <div className="mb-[18px] grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {quickActions.map(function (action) {
                return (
                  <QuickActionCard
                    key={action.id}
                    action={action}
                    onClick={function () {
                      handleQuickAction(action.id);
                    }}
                  />
                );
              })}
            </div>

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px", borderBottom: "1px solid " + DS.line }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Alumnos activos</div>
                <button type="button" style={{ border: "none", background: "none", color: DS.primarySoft, cursor: "pointer", fontSize: 15, fontWeight: 700 }}>Ver todos</button>
              </div>
              <div style={{ padding: "16px 24px 10px" }}>
                <div
                  className="hidden gap-[14px] px-0.5 pb-3.5 text-[12px] font-bold uppercase tracking-wide text-[#7f93b5] lg:grid lg:grid-cols-[56px_minmax(0,1.4fr)_minmax(240px,1fr)_150px_24px]"
                >
                  <div />
                  <div>Alumno</div>
                  <div>Cumplimiento</div>
                  <div>Ultima sesion</div>
                  <div />
                </div>
                <div className="-mx-2 overflow-x-auto px-2 lg:mx-0">
                {filteredStudents.slice(0, 3).map(function (student) {
                  return (
                    <StudentTableRow
                      key={student.id}
                      student={student}
                      onClick={function () {
                        onVerPerfil && onVerPerfil(student.id);
                      }}
                    />
                  );
                })}
                </div>
              </div>
            </Card>
          </div>

          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Tu rendimiento</div>
              <Info size={16} color="#8ba0c4" />
            </div>
            <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_140px]">
              <div>
                <div style={{ width: 68, height: 68, borderRadius: 18, background: "#0f2142", display: "flex", alignItems: "center", justifyContent: "center", color: DS.primarySoft, marginBottom: 22 }}>
                  <Trophy size={36} />
                </div>
                <div style={{ fontFamily: FONTS.mono, fontSize: 54, fontWeight: 700, lineHeight: 1, color: "#fff", marginBottom: 14 }}>72 / 100</div>
                <div style={{ color: "#2be27e", fontSize: 18, fontWeight: 700, lineHeight: 1.45 }}>+ 8 pts vs semana pasada</div>
              </div>
              <div style={{ width: 140, height: 140, marginLeft: "auto" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart data={performanceRing} innerRadius="80%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={12}>
                    <RadialBar dataKey="value" background={{ fill: "#1a2340" }} cornerRadius={999} fill={DS.primary} />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderMain() {
    if (activeNav === "dashboard") return renderDashboard();
    if (activeNav === "alumnos") return <PlaceholderView title="Alumnos" />;
    if (activeNav === "routines") return <PlaceholderView title="Rutinas" />;
    if (activeNav === "exercises") return <PlaceholderView title="Ejercicios" />;
    if (activeNav === "progress") return <PlaceholderView title="Progreso" />;
    if (activeNav === "messages") return <PlaceholderView title="Mensajes" />;
    return <PlaceholderView title="Dashboard" />;
  }

  const shellStyle = {
    minHeight: embedded ? 0 : "100vh",
    flex: embedded ? 1 : undefined,
    width: "100%",
    minWidth: 0,
    background: DS.bg,
    color: DS.text,
    fontFamily: FONTS.body,
    boxSizing: "border-box",
  };

  const layoutGridStyle = embedded
    ? { minHeight: 0 }
    : { minHeight: "100vh" };

  return (
    <div style={shellStyle}>
      <div
        className={
          embedded
            ? "flex min-h-0 w-full min-w-0 flex-1 flex-col"
            : "grid w-full grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)]"
        }
        style={layoutGridStyle}
      >
        {!embedded ? (
          <aside
            className="hidden min-h-screen flex-col lg:flex"
            style={{
              borderRight: "1px solid " + DS.line,
              background: DS.bg,
              padding: "26px 18px 22px",
              position: "sticky",
              top: 0,
              alignSelf: "start",
            }}
          >
            <BrandMark />
            <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 8 }}>
              {navItems.map(function (item) {
                return (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    active={activeNav === item.id}
                    onClick={function () {
                      navigate(item.id);
                    }}
                  />
                );
              })}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 24, borderTop: "1px solid " + DS.line, display: "flex", flexDirection: "column", gap: 8 }}>
              <SidebarItem item={{ id: "settings", label: "Settings", icon: Settings }} active={false} onClick={function () {}} />
              <button type="button" style={{ display: "flex", alignItems: "center", gap: 12, border: "none", background: "transparent", padding: "14px 16px", borderRadius: 14, cursor: "pointer", color: "#fff", textAlign: "left" }}>
                {coachAvatarUrl ? (
                  <img src={coachAvatarUrl} alt="" style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#17306a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 18 }}>
                    {initialsFromName(coachName || "Coach")}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{coachName || "Hernan Coach"}</div>
                  <div style={{ marginTop: 4, fontSize: 14, color: DS.muted }}>Preparador fisico</div>
                </div>
                <ChevronRight size={18} color="#8aa0c4" />
              </button>
            </div>
          </aside>
        ) : null}

        <main className="min-w-0 max-w-full overflow-x-hidden bg-[#08101d]" style={{ minHeight: embedded ? 0 : "100vh" }}>
          <header
            className="sticky top-0 z-10 flex flex-col gap-3 border-b px-4 py-4 lg:hidden"
            style={{ background: DS.bg, borderColor: DS.line }}
          >
            <div className="min-w-0">
              <h1 className="m-0 line-clamp-2 text-[20px] font-bold leading-tight text-white">{greetingLabel()}, {coachName || "Coach"}</h1>
              <p className="mt-2 text-[14px] leading-snug" style={{ color: DS.muted }}>
                Aca tenes el resumen de tu equipo
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="flex h-[46px] min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3"
                style={{ borderColor: DS.border, background: DS.panelSoft, color: DS.muted }}
              >
                <SearchIcon value={query} onChange={setQuery} />
              </div>
              <button
                type="button"
                className="relative flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[14px] border"
                style={{ borderColor: DS.border, background: DS.panelSoft, cursor: "pointer" }}
              >
                <Bell size={19} color="#d3def5" />
                <span
                  className="absolute h-2 w-2 rounded-full"
                  style={{ top: 11, right: 12, background: DS.red }}
                />
              </button>
              <GlobalCreateMenu onNuevoAlumno={onNuevoAlumno} onNuevaRutina={onCrearRutina} onNuevoEjercicio={onNuevoEjercicio} />
            </div>
          </header>
          <header
            className="sticky top-0 z-10 hidden min-w-0 gap-x-4 gap-y-3 border-b px-4 py-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-x-5"
            style={{ background: DS.bg, borderColor: DS.line }}
          >
            <div className="min-w-0 pr-1">
              <h1 className="m-0 truncate text-[20px] font-bold text-white sm:text-[22px]">{greetingLabel()}, {coachName || "Coach"}</h1>
              <p className="mt-2 line-clamp-2 text-[14px] sm:text-[15px]" style={{ color: DS.muted }}>
                Aca tenes el resumen de tu equipo
              </p>
            </div>

            <div className="flex min-w-0 max-w-full items-center justify-end gap-2 sm:gap-3 lg:gap-4">
              <div
                className="flex h-[50px] w-full min-w-[160px] max-w-[440px] items-center gap-2 rounded-2xl border px-3 sm:min-w-[200px] sm:gap-3 sm:px-4"
                style={{ borderColor: DS.border, background: DS.panelSoft, color: DS.muted }}
              >
                <MessageSquare size={0} style={{ display: "none" }} />
                <Info size={0} style={{ display: "none" }} />
                <Bell size={0} style={{ display: "none" }} />
                <User size={0} style={{ display: "none" }} />
                <SearchIcon value={query} onChange={setQuery} />
              </div>
              <button
                type="button"
                className="relative flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-[14px] border"
                style={{ borderColor: DS.border, background: DS.panelSoft, cursor: "pointer" }}
              >
                <Bell size={19} color="#d3def5" />
                <span
                  className="absolute h-2 w-2 rounded-full"
                  style={{ top: 11, right: 12, background: DS.red }}
                />
              </button>
              <GlobalCreateMenu onNuevoAlumno={onNuevoAlumno} onNuevaRutina={onCrearRutina} onNuevoEjercicio={onNuevoEjercicio} />
            </div>
          </header>
          {renderMain()}
        </main>
      </div>
    </div>
  );
}

function SearchIcon({ value, onChange }) {
  return (
    <>
      <BarChart3 size={0} style={{ display: "none" }} />
      <ClipboardList size={0} style={{ display: "none" }} />
      <Users size={0} style={{ display: "none" }} />
      <Dumbbell size={0} style={{ display: "none" }} />
      <Eye size={0} style={{ display: "none" }} />
      <Clock3 size={0} style={{ display: "none" }} />
      <CircleAlert size={0} style={{ display: "none" }} />
      <CheckCircle2 size={0} style={{ display: "none" }} />
      <Info size={0} style={{ display: "none" }} />
      <SearchInner value={value} onChange={onChange} />
    </>
  );
}

function SearchInner({ value, onChange }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
      <MessageSquare size={20} color="transparent" style={{ display: "none" }} />
      <span className="flex flex-shrink-0 items-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M21 21L15.8 15.8M17 10.5C17 14.0899 14.0899 17 10.5 17C6.91015 17 4 14.0899 4 10.5C4 6.91015 6.91015 4 10.5 4C14.0899 4 17 6.91015 17 10.5Z" stroke="#8aa0c4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>
      <input
        value={value}
        onChange={function (e) {
          onChange(e.target.value);
        }}
        placeholder="Buscar alumnos, rutinas o ejercicios..."
        className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-white outline-none sm:text-[15px]"
        style={{ fontFamily: FONTS.body }}
      />
      <div className="hidden flex-shrink-0 items-center gap-1.5 rounded-[10px] border border-white/[0.08] px-2.5 py-1.5 text-[12px] font-bold text-[#94a3c3] sm:flex">
        Cmd<span>K</span>
      </div>
    </div>
  );
}
