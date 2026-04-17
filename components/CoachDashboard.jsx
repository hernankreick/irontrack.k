import React from "react";
import GlobalCreateMenu from "./GlobalCreateMenu.jsx";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Dumbbell,
  Eye,
  Info,
  LayoutDashboard,
  MessageSquare,
  Plus,
  Search,
  Send,
  Settings,
  Trophy,
  User,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DS = {
  bg: "#0B0E11",
  card: "#111827",
  border: "#1a2535",
  primary: "#2563EB",
  primaryLight: "#3B82F6",
  green: "#22c55e",
  yellow: "#f59e0b",
  red: "#ef4444",
  textMuted: "#9CA3AF",
  text: "#F3F4F6",
};

const FONTS = {
  title: "'Bebas Neue', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'DM Mono', monospace",
};

function useIronTrackDashboardFonts() {
  React.useEffect(function () {
    const id = "irontrack-coach-dashboard-fonts";
    if (typeof document === "undefined" || document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap";
    document.head.appendChild(link);
  }, []);
}

function initialsFromName(name) {
  return String(name || "Coach")
    .trim()
    .split(/\s+/)
    .map(function (p) {
      return p.charAt(0);
    })
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function sparklineData(seed) {
  return seed.map(function (value, index) {
    return { i: index, v: value };
  });
}

function greetingLabel() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
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
  { day: "L", value: 4, fill: "#3B82F6" },
  { day: "M", value: 5, fill: "#3B82F6" },
  { day: "X", value: 4, fill: "#3B82F6" },
  { day: "J", value: 5, fill: "#3B82F6" },
  { day: "V", value: 3, fill: "#3B82F6" },
  { day: "S", value: 1, fill: "#25314A" },
  { day: "D", value: 0, fill: "#1F2739" },
];

const monthlyAreaData = [
  { m: "E", sessions: 42 },
  { m: "F", sessions: 48 },
  { m: "M", sessions: 51 },
  { m: "A", sessions: 46 },
  { m: "M", sessions: 55 },
  { m: "J", sessions: 58 },
];

const performanceRing = [{ name: "score", value: 72, fill: "#2563EB" }];

const quickActionPages = [
  [
    {
      id: "msg",
      title: "Enviar mensaje a tu equipo",
      icon: MessageSquare,
      bg: "rgba(37, 99, 235, 0.18)",
      border: "rgba(59, 130, 246, 0.35)",
      iconColor: "#3B82F6",
    },
    {
      id: "routine",
      title: "Crear rutina personalizada",
      icon: Plus,
      bg: "rgba(139, 92, 246, 0.18)",
      border: "rgba(167, 139, 250, 0.35)",
      iconColor: "#A78BFA",
    },
    {
      id: "review",
      title: "Revisar alumnos que necesitan atención",
      icon: Eye,
      bg: "rgba(34, 197, 94, 0.16)",
      border: "rgba(34, 197, 94, 0.35)",
      iconColor: "#22C55E",
    },
  ],
  [
    {
      id: "msg2",
      title: "Recordatorio de hidratación",
      icon: MessageSquare,
      bg: "rgba(37, 99, 235, 0.18)",
      border: "rgba(59, 130, 246, 0.35)",
      iconColor: "#3B82F6",
    },
    {
      id: "routine2",
      title: "Duplicar semana anterior",
      icon: Plus,
      bg: "rgba(139, 92, 246, 0.18)",
      border: "rgba(167, 139, 250, 0.35)",
      iconColor: "#A78BFA",
    },
    {
      id: "review2",
      title: "Ver informe semanal",
      icon: Eye,
      bg: "rgba(34, 197, 94, 0.16)",
      border: "rgba(34, 197, 94, 0.35)",
      iconColor: "#22C55E",
    },
  ],
];

const aiAlerts = [
  {
    id: "a1",
    title: "Agustín bajó el volumen un 18%",
    detail: "Sugerencia: revisar fatiga o deload.",
  },
  {
    id: "a2",
    title: "3 alumnos sin registrar sesión en 5 días",
    detail: "Enviar mensaje de seguimiento.",
  },
];

const routinesMock = [
  { id: "r1", name: "Fuerza — Tren superior", week: "Semana 3 de 4", status: "activa" },
  { id: "r2", name: "Hipertrofia — Full body", week: "Semana 1 de 6", status: "activa" },
  { id: "r3", name: "Deload — Movilidad", week: "Semana 4 de 4", status: "cierre" },
];

const muscleGroups = ["Todos", "Pecho", "Espalda", "Piernas", "Hombros", "Brazos", "Core"];

const exercisesMock = [
  { id: "e1", name: "Press banca", group: "Pecho" },
  { id: "e2", name: "Remo con barra", group: "Espalda" },
  { id: "e3", name: "Sentadilla", group: "Piernas" },
  { id: "e4", name: "Press militar", group: "Hombros" },
  { id: "e5", name: "Curl martillo", group: "Brazos" },
  { id: "e6", name: "Plancha", group: "Core" },
];

const teamProgressArea = [
  { w: "S1", load: 62 },
  { w: "S2", load: 68 },
  { w: "S3", load: 71 },
  { w: "S4", load: 74 },
  { w: "S5", load: 77 },
  { w: "S6", load: 80 },
];

const exerciseVolumeBars = [
  { name: "Sentadilla", vol: 92 },
  { name: "Press banca", vol: 86 },
  { name: "Peso muerto", vol: 81 },
  { name: "Remo", vol: 74 },
];

const complianceByStudent = [
  { name: "Julieta L.", pct: 88 },
  { name: "Agustín T.", pct: 41 },
  { name: "Hernán K.", pct: 12 },
  { name: "Martín S.", pct: 72 },
];

const conversationsMock = [
  { id: "c1", peer: "Julieta Laroze", initials: "JL", last: "¿Cambio el peso en remo?", time: "10:24", unread: 2 },
  { id: "c2", peer: "Agustín Torres", initials: "AT", last: "Listo el día de piernas.", time: "Ayer", unread: 0 },
  { id: "c3", peer: "Hernán Kreick", initials: "HK", last: "No pude entrenar el lunes.", time: "Lun", unread: 1 },
];

function buildStudents(alumnos) {
  const fallback = [
    { id: "1", nombre: "Julieta Laroze", progreso: 82 },
    { id: "2", nombre: "Agustín Torres", progreso: 45 },
    { id: "3", nombre: "Hernán Kreick", progreso: 0 },
    { id: "4", nombre: "Martín Sosa", progreso: 67 },
  ];
  const base = Array.isArray(alumnos) && alumnos.length ? alumnos : fallback;
  const seeds = [
    [58, 65, 71, 76, 80, 82],
    [72, 64, 58, 54, 50, 45],
    [28, 18, 10, 5, 2, 0],
    [51, 54, 61, 63, 65, 67],
  ];
  return base.slice(0, 8).map(function (alumno, index) {
    const pct = typeof alumno.progreso === "number" ? alumno.progreso : [82, 45, 0, 67][index % 4];
    return {
      id: alumno.id || String(index + 1),
      name: alumno.nombre || alumno.email || "Alumno",
      initials: initialsFromName(alumno.nombre || alumno.email || "Alumno"),
      pct: pct,
      color: pctColor(pct),
      trend: sparklineData(seeds[index % seeds.length]),
    };
  });
}

function actionButtonStyle(overrides) {
  return Object.assign(
    {
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      fontWeight: 700,
      fontFamily: FONTS.body,
      border: "none",
      cursor: "pointer",
      borderRadius: 8,
    },
    overrides || {}
  );
}

function Card(props) {
  return (
    <section
      style={Object.assign(
        {
          borderRadius: 16,
          border: "1px solid " + DS.border,
          background: DS.card,
          boxSizing: "border-box",
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
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 28 }}>
        <div style={{ width: 4, height: 22, background: DS.primaryLight, borderRadius: 2 }} />
        <div style={{ width: 4, height: 28, background: DS.primary, borderRadius: 2 }} />
        <div style={{ width: 4, height: 16, background: "#1D4ED8", borderRadius: 2 }} />
      </div>
      <div
        style={{
          fontFamily: FONTS.title,
          fontSize: 26,
          letterSpacing: 2,
          color: "#fff",
          lineHeight: 0.95,
        }}
      >
        IRON
        <br />
        TRACK
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
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        background: active ? "rgba(37, 99, 235, 0.12)" : "transparent",
        color: active ? "#fff" : DS.textMuted,
        fontFamily: FONTS.body,
        fontSize: 14,
        fontWeight: active ? 600 : 500,
        textAlign: "left",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {active ? (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            width: 3,
            height: 22,
            marginTop: -11,
            borderRadius: "0 4px 4px 0",
            background: DS.primary,
          }}
        />
      ) : null}
      <Icon size={18} color={active ? DS.primaryLight : "#6B7280"} strokeWidth={2} />
      <span>{item.label}</span>
    </button>
  );
}

function StudentRow({ student, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "52px 1fr 140px 20px",
        alignItems: "center",
        gap: 16,
        width: "100%",
        padding: "16px 18px",
        borderRadius: 12,
        border: "1px solid " + DS.border,
        background: "#0f1624",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: FONTS.body,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#1e3a5f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 13,
          color: "#E5E7EB",
        }}
      >
        {student.initials}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "#fff", marginBottom: 8, fontSize: 15 }}>{student.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: "#1F2937" }}>
            <div
              style={{
                height: "100%",
                width: student.pct + "%",
                borderRadius: 999,
                background: student.color,
              }}
            />
          </div>
          <span
            style={{
              width: 40,
              textAlign: "right",
              fontFamily: FONTS.mono,
              fontSize: 14,
              fontWeight: 600,
              color: student.color,
            }}
          >
            {student.pct}%
          </span>
        </div>
      </div>
      <div style={{ height: 36, width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={student.trend}>
            <Line type="monotone" dataKey="v" stroke={DS.primaryLight} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChevronRight size={18} color="#6B7280" />
    </button>
  );
}

export default function CoachDashboard({
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
  useIronTrackDashboardFonts();

  const isControlled = typeof setActiveNav === "function";
  const [uncontrolledNav, setUncontrolledNav] = React.useState(activeNavProp);
  const activeNav = isControlled ? activeNavProp : uncontrolledNav;

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

  const [query, setQuery] = React.useState("");
  const [quickPage, setQuickPage] = React.useState(0);
  const [muscleFilter, setMuscleFilter] = React.useState("Todos");
  const [expandedAlumnoId, setExpandedAlumnoId] = React.useState(null);
  const [selectedConvId, setSelectedConvId] = React.useState(conversationsMock[0].id);
  const [replyText, setReplyText] = React.useState("");

  const students = React.useMemo(function () {
    return buildStudents(alumnos);
  }, [alumnos]);

  const filteredStudents = React.useMemo(
    function () {
      if (!query.trim()) return students;
      return students.filter(function (s) {
        return s.name.toLowerCase().includes(query.trim().toLowerCase());
      });
    },
    [students, query]
  );

  const riskStudent =
    filteredStudents.find(function (s) {
      return s.pct < 50;
    }) ||
    filteredStudents[1] ||
    students[1] || { id: "risk", name: "Agustín Torres", initials: "AT", pct: 45, color: DS.yellow };

  const selectedConv = conversationsMock.find(function (c) {
    return c.id === selectedConvId;
  });

  function handleQuickTile(id) {
    if (id === "msg" || id === "msg2") onEnviarMensaje && onEnviarMensaje();
    else if (id === "routine" || id === "routine2") onCrearRutina && onCrearRutina();
    else if (id === "review" || id === "review2") onRevisarAlumnos && onRevisarAlumnos();
  }

  const filteredExercises =
    muscleFilter === "Todos"
      ? exercisesMock
      : exercisesMock.filter(function (e) {
          return e.group === muscleFilter;
        });

  const shellStyle = {
    minHeight: "100vh",
    background: DS.bg,
    color: DS.text,
    fontFamily: FONTS.body,
    boxSizing: "border-box",
  };

  const layoutGrid = {
    display: "grid",
    gridTemplateColumns: "220px minmax(0, 1fr)",
    width: "100%",
    minHeight: "100vh",
  };

  const mainScroll = {
    background: DS.bg,
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    minWidth: 0,
  };

  const headerSticky = {
    position: "sticky",
    top: 0,
    zIndex: 20,
    background: DS.bg,
    borderBottom: "1px solid " + DS.border,
    padding: "20px 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  };

  const dashboardGrid = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
    gap: 24,
    alignItems: "start",
    padding: "24px 28px 40px",
  };

  const viewBody = { padding: "24px 28px 40px", flex: 1 };

  function renderDashboard() {
    return (
      <div style={dashboardGrid}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONTS.title, fontSize: 28, letterSpacing: 1, color: "#fff" }}>Cumplimiento semanal</span>
                <Info size={18} color="#6B7280" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "stretch" }}>
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontFamily: FONTS.mono, fontSize: 52, fontWeight: 700, color: "#fff", lineHeight: 1 }}>16 / 24</div>
                <div style={{ color: DS.textMuted, fontSize: 15, marginTop: 6, marginBottom: 16 }}>sesiones completadas</div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(34, 197, 94, 0.2)",
                    color: DS.green,
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 20,
                  }}
                >
                  <Clock size={16} />
                  Quedan 2 días para completar
                </div>
                <div style={{ height: 160, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekBarData} barCategoryGap={14} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fill: "#6B7280", fontSize: 12, fontFamily: FONTS.body }} axisLine={false} tickLine={false} />
                      <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                        {weekBarData.map(function (e) {
                          return <Cell key={e.day} fill={e.fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div
                style={{
                  position: "relative",
                  width: 220,
                  height: 220,
                  flexShrink: 0,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    innerRadius="78%"
                    outerRadius="100%"
                    data={[{ name: "pct", value: 68, fill: "url(#gaugeGrad)" }]}
                    startAngle={90}
                    endAngle={-270}
                    barSize={12}
                  >
                    <defs>
                      <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#22C55E" />
                      </linearGradient>
                    </defs>
                    <RadialBar dataKey="value" background={{ fill: "#1F2937" }} cornerRadius={6} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: "none",
                    fontFamily: FONTS.mono,
                    fontSize: 36,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  68%
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: FONTS.title, fontSize: 24, letterSpacing: 1, color: "#fff" }}>Tendencia mensual</span>
            </div>
            <div style={{ height: 200, width: "100%" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyAreaData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1F2937" vertical={false} />
                  <XAxis dataKey="m" tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid " + DS.border, borderRadius: 8, fontFamily: FONTS.body }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Area type="monotone" dataKey="sessions" stroke="#3B82F6" fill="url(#areaFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: FONTS.title, fontSize: 26, letterSpacing: 1, color: "#fff" }}>Alumnos activos</span>
            <button
              type="button"
              style={{ background: "none", border: "none", color: DS.textMuted, cursor: "pointer", fontFamily: FONTS.body, fontSize: 14 }}
            >
              Ver todos &gt;
            </button>
          </div>

          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredStudents.slice(0, 3).map(function (student) {
                return (
                  <StudentRow
                    key={student.id}
                    student={student}
                    onClick={function () {
                      onVerPerfil && onVerPerfil(student.id);
                    }}
                  />
                );
              })}
            </div>
          </Card>

          <Card style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Bot size={20} color={DS.primaryLight} />
              <span style={{ fontFamily: FONTS.title, fontSize: 24, letterSpacing: 1, color: "#fff" }}>Alertas IA</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {aiAlerts.map(function (a) {
                return (
                  <div
                    key={a.id}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      border: "1px solid " + DS.border,
                      background: "#0c1220",
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "#fff", marginBottom: 6, fontSize: 14 }}>{a.title}</div>
                    <div style={{ color: DS.textMuted, fontSize: 13, lineHeight: 1.45 }}>{a.detail}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, position: "sticky", top: 96, alignSelf: "start" }}>
          <Card>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid " + DS.border, fontWeight: 600, color: "#E5E7EB", fontSize: 16 }}>
              Equipo de un vistazo
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ borderRadius: 12, border: "1px solid " + DS.border, background: "#0c1220", padding: 16 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "#1e3a5f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    {riskStudent.initials || "AT"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: 15 }}>{riskStudent.name || "Agustín Torres"}</div>
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "rgba(239, 68, 68, 0.15)",
                        color: DS.red,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      1 de 3 sesiones
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: DS.textMuted, fontSize: 14, marginBottom: 16 }}>
                  <AlertCircle size={16} color={DS.yellow} />
                  Podría no completar la semana
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={function () {
                      onRevisar && onRevisar(riskStudent.id);
                    }}
                    style={actionButtonStyle({
                      background: DS.red,
                      color: "#fff",
                      padding: "12px 10px",
                      fontSize: 12,
                    })}
                  >
                    Revisar
                  </button>
                  <button
                    type="button"
                    onClick={function () {
                      onVerPerfil && onVerPerfil(riskStudent.id);
                    }}
                    style={actionButtonStyle({
                      background: "#1F2937",
                      color: "#F9FAFB",
                      padding: "12px 10px",
                      fontSize: 12,
                    })}
                  >
                    Ver perfil
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontWeight: 600, color: "#E5E7EB", fontSize: 16 }}>Acciones rápidas</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={function () {
                    setQuickPage(function (p) {
                      return Math.max(0, p - 1);
                    });
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid " + DS.border,
                    background: "#0f1624",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={function () {
                    setQuickPage(function (p) {
                      return Math.min(quickActionPages.length - 1, p + 1);
                    });
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid " + DS.border,
                    background: "#0f1624",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {quickActionPages[quickPage].map(function (tile) {
                const Icon = tile.icon;
                return (
                  <button
                    key={tile.id}
                    type="button"
                    onClick={function () {
                      handleQuickTile(tile.id);
                    }}
                    style={{
                      borderRadius: 12,
                      border: "1px solid " + tile.border,
                      background: tile.bg,
                      padding: "14px 10px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                      color: "#fff",
                      minHeight: 110,
                    }}
                  >
                    <Icon size={22} color={tile.iconColor} />
                    <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center", lineHeight: 1.35, fontFamily: FONTS.body }}>{tile.title}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontWeight: 600, color: "#E5E7EB", fontSize: 16 }}>Tu rendimiento</span>
              <Info size={16} color="#6B7280" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: "#0c1a2e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: DS.primaryLight,
                  }}
                >
                  <Trophy size={28} />
                </div>
                <div>
                  <div style={{ fontFamily: FONTS.mono, fontSize: 40, fontWeight: 700, color: "#fff", lineHeight: 1 }}>72 / 100</div>
                  <div style={{ color: DS.green, fontSize: 14, fontWeight: 600, marginTop: 6 }}>+ 8 pts vs semana pasada</div>
                </div>
              </div>
              <div style={{ width: 100, height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart data={performanceRing} innerRadius="78%" outerRadius="100%" startAngle={90} endAngle={-270} barSize={10}>
                    <RadialBar dataKey="value" background={{ fill: "#1F2937" }} cornerRadius={6} fill="#2563EB" />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderAlumnos() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: FONTS.title, fontSize: 32, letterSpacing: 1, color: "#fff" }}>Alumnos</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredStudents.map(function (s) {
            const open = expandedAlumnoId === s.id;
            return (
              <Card key={s.id} style={{ overflow: "hidden" }}>
                <button
                  type="button"
                  onClick={function () {
                    setExpandedAlumnoId(open ? null : s.id);
                  }}
                  style={{
                    width: "100%",
                    padding: 18,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: "50%",
                          background: "#1e3a5f",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                        }}
                      >
                        {s.initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
                        <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: s.color, marginTop: 4 }}>Cumplimiento {s.pct}%</div>
                      </div>
                    </div>
                    <ChevronRight
                      size={20}
                      color="#9CA3AF"
                      style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}
                    />
                  </div>
                  <div style={{ marginTop: 14, height: 8, borderRadius: 999, background: "#1F2937" }}>
                    <div style={{ width: s.pct + "%", height: "100%", borderRadius: 999, background: s.color }} />
                  </div>
                </button>
                {open ? (
                  <div style={{ padding: "0 18px 18px", borderTop: "1px solid " + DS.border, background: "#0c1220" }}>
                    <div style={{ paddingTop: 14, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <div>
                        <div style={{ color: DS.textMuted, fontSize: 12, marginBottom: 4 }}>Sesiones semana</div>
                        <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700 }}>3 / 4</div>
                      </div>
                      <div>
                        <div style={{ color: DS.textMuted, fontSize: 12, marginBottom: 4 }}>Racha</div>
                        <div style={{ fontFamily: FONTS.mono, fontSize: 18, fontWeight: 700 }}>12 días</div>
                      </div>
                      <div>
                        <div style={{ color: DS.textMuted, fontSize: 12, marginBottom: 4 }}>Estado</div>
                        <div style={{ fontWeight: 700, color: s.color, fontSize: 14 }}>
                          {s.pct >= 70 ? "En objetivo" : s.pct >= 30 ? "En riesgo" : "Inactivo"}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                      <button
                        type="button"
                        onClick={function (e) {
                          e.stopPropagation();
                          onVerPerfil && onVerPerfil(s.id);
                        }}
                        style={actionButtonStyle({ background: DS.primary, color: "#fff", padding: "10px 14px", fontSize: 12 })}
                      >
                        Ver perfil
                      </button>
                      <button
                        type="button"
                        onClick={function (e) {
                          e.stopPropagation();
                          onRevisar && onRevisar(s.id);
                        }}
                        style={actionButtonStyle({ background: "#1F2937", color: "#fff", padding: "10px 14px", fontSize: 12 })}
                      >
                        Revisar plan
                      </button>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  function renderRoutines() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: FONTS.title, fontSize: 32, letterSpacing: 1, color: "#fff" }}>Rutinas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {routinesMock.map(function (r) {
            return (
              <Card key={r.id} style={{ padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 6 }}>{r.name}</div>
                  <div style={{ color: DS.textMuted, fontSize: 14 }}>{r.week}</div>
                </div>
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: FONTS.body,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    background: r.status === "activa" ? "rgba(34, 197, 94, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: r.status === "activa" ? DS.green : DS.yellow,
                    border: "1px solid " + (r.status === "activa" ? "rgba(34,197,94,0.35)" : "rgba(245,158,11,0.35)"),
                  }}
                >
                  {r.status}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  function renderExercises() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: FONTS.title, fontSize: 32, letterSpacing: 1, color: "#fff" }}>Ejercicios</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {muscleGroups.map(function (g) {
            const active = muscleFilter === g;
            return (
              <button
                key={g}
                type="button"
                onClick={function () {
                  setMuscleFilter(g);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: "1px solid " + (active ? DS.primary : DS.border),
                  background: active ? "rgba(37, 99, 235, 0.2)" : "#0f1624",
                  color: active ? "#fff" : DS.textMuted,
                  cursor: "pointer",
                  fontFamily: FONTS.body,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {g}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filteredExercises.map(function (ex) {
            return (
              <Card key={ex.id} style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, color: "#fff" }}>{ex.name}</span>
                <span style={{ color: DS.textMuted, fontSize: 13 }}>{ex.group}</span>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  function renderProgress() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontFamily: FONTS.title, fontSize: 32, letterSpacing: 1, color: "#fff" }}>Progreso del equipo</div>
        <Card style={{ padding: 20 }}>
          <div style={{ marginBottom: 12, fontWeight: 600, color: "#E5E7EB" }}>Volumen relativo (área)</div>
          <div style={{ height: 240, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={teamProgressArea} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="teamArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1F2937" vertical={false} />
                <XAxis dataKey="w" tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Area type="monotone" dataKey="load" stroke="#2563EB" fill="url(#teamArea)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card style={{ padding: 20 }}>
          <div style={{ marginBottom: 12, fontWeight: 600, color: "#E5E7EB" }}>Ejercicios con mayor volumen</div>
          <div style={{ height: 220, width: "100%" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exerciseVolumeBars} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fill: "#E5E7EB", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Bar dataKey="vol" radius={[0, 4, 4, 0]}>
                  {exerciseVolumeBars.map(function (_, i) {
                    return <Cell key={i} fill={DS.primaryLight} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card style={{ padding: 20 }}>
          <div style={{ marginBottom: 14, fontWeight: 600, color: "#E5E7EB" }}>Cumplimiento por alumno</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {complianceByStudent.map(function (row) {
              const c = pctColor(row.pct);
              return (
                <div key={row.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{row.name}</span>
                    <span style={{ fontFamily: FONTS.mono, fontSize: 14, fontWeight: 700, color: c }}>{row.pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: "#1F2937" }}>
                    <div style={{ width: row.pct + "%", height: "100%", borderRadius: 999, background: c }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  function renderMessages() {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 340px) minmax(0, 1fr)", gap: 20, alignItems: "stretch", minHeight: 480 }}>
        <Card style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid " + DS.border, fontWeight: 700, fontSize: 16 }}>Conversaciones</div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {conversationsMock.map(function (c) {
              const active = c.id === selectedConvId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={function () {
                    setSelectedConvId(c.id);
                  }}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                    borderBottom: "1px solid " + DS.border,
                    background: active ? "rgba(37, 99, 235, 0.12)" : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      background: "#1e3a5f",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 12,
                      color: "#fff",
                    }}
                  >
                    {c.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 600, color: "#fff", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.peer}
                      </span>
                      <span style={{ fontSize: 12, color: DS.textMuted, flexShrink: 0 }}>{c.time}</span>
                    </div>
                    <div style={{ fontSize: 13, color: DS.textMuted, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.last}
                    </div>
                  </div>
                  {c.unread > 0 ? (
                    <span
                      style={{
                        minWidth: 22,
                        height: 22,
                        borderRadius: 999,
                        background: DS.primary,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {c.unread}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </Card>
        <Card style={{ padding: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid " + DS.border, fontWeight: 700 }}>{selectedConv ? selectedConv.peer : "Mensajes"}</div>
          <div style={{ flex: 1, padding: 20, overflowY: "auto", color: DS.textMuted, fontSize: 14, lineHeight: 1.6 }}>
            {selectedConv ? (
              <div>
                <div style={{ marginBottom: 12, color: "#E5E7EB" }}>{selectedConv.last}</div>
                <div style={{ fontSize: 13 }}>Escribí una respuesta abajo para continuar la conversación.</div>
              </div>
            ) : (
              <div>Seleccioná una conversación.</div>
            )}
          </div>
          <div style={{ padding: 16, borderTop: "1px solid " + DS.border, display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={replyText}
              onChange={function (e) {
                setReplyText(e.target.value);
              }}
              placeholder="Escribí un mensaje..."
              rows={3}
              style={{
                flex: 1,
                resize: "none",
                borderRadius: 10,
                border: "1px solid " + DS.border,
                background: "#0f1624",
                color: "#fff",
                padding: "12px 14px",
                fontFamily: FONTS.body,
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="button"
              style={actionButtonStyle({
                background: DS.primary,
                color: "#fff",
                padding: "12px 16px",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 44,
              })}
            >
              <Send size={16} />
              Enviar
            </button>
          </div>
        </Card>
      </div>
    );
  }

  function renderMain() {
    if (activeNav === "dashboard") return renderDashboard();
    if (activeNav === "alumnos") return renderAlumnos();
    if (activeNav === "routines") return renderRoutines();
    if (activeNav === "exercises") return renderExercises();
    if (activeNav === "progress") return renderProgress();
    if (activeNav === "messages") return renderMessages();
    return (
      <div style={{ color: DS.textMuted, fontFamily: FONTS.body }}>
        Vista en construcción. Usá la navegación lateral.
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div style={layoutGrid}>
        <aside
          style={{
            width: 220,
            boxSizing: "border-box",
            borderRight: "1px solid " + DS.border,
            background: DS.bg,
            padding: "24px 16px",
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            position: "sticky",
            top: 0,
            alignSelf: "start",
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <BrandMark />
          </div>
          <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
          </nav>
          <div style={{ marginTop: "auto", paddingTop: 20, borderTop: "1px solid " + DS.border, display: "flex", flexDirection: "column", gap: 4 }}>
            <SidebarItem
              item={{ id: "settings", label: "Settings", icon: Settings }}
              active={false}
              onClick={function () {}}
            />
            <button
              type="button"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: DS.textMuted,
                fontFamily: FONTS.body,
                fontSize: 14,
                width: "100%",
                textAlign: "left",
              }}
            >
              {coachAvatarUrl ? (
                <img src={coachAvatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#1e3a5f",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#fff",
                  }}
                >
                  {initialsFromName(coachName || "Coach")}
                </div>
              )}
              <span style={{ flex: 1, fontWeight: 500 }}>Perfil</span>
              <User size={16} color="#6B7280" />
            </button>
          </div>
        </aside>

        <main style={mainScroll}>
          <header style={headerSticky}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, fontFamily: FONTS.body, fontSize: 22, fontWeight: 700, color: "#fff" }}>
                {greetingLabel()}, {coachName || "Coach"}
              </h1>
              <p style={{ margin: "6px 0 0", color: DS.textMuted, fontSize: 14 }}>
                {activeNav === "dashboard" ? "Resumen general del equipo, alertas y rendimiento semanal." : "Gestioná tu equipo desde un solo lugar."}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 14px",
                  height: 44,
                  borderRadius: 10,
                  border: "1px solid " + DS.border,
                  background: DS.card,
                  minWidth: 220,
                }}
              >
                <Search size={18} color="#6B7280" />
                <input
                  value={query}
                  onChange={function (e) {
                    setQuery(e.target.value);
                  }}
                  placeholder="Buscar..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    fontFamily: FONTS.body,
                    fontSize: 14,
                  }}
                />
              </div>
              <button
                type="button"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "1px solid " + DS.border,
                  background: DS.card,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Bell size={18} color="#9CA3AF" />
              </button>
              <GlobalCreateMenu
                onNuevoAlumno={onNuevoAlumno}
                onNuevaRutina={onCrearRutina}
                onNuevoEjercicio={onNuevoEjercicio}
              />
            </div>
          </header>

          <div style={activeNav === "dashboard" ? { flex: 1, minHeight: 0 } : viewBody}>{renderMain()}</div>
        </main>
      </div>
    </div>
  );
}
