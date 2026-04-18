import React from "react";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  User,
  Users,
} from "lucide-react";

const LS_KEY = "irontrack_desktop_sidebar_collapsed";

const DS = {
  bg: "#0B0E11",
  border: "#1a2535",
  primary: "#2563EB",
  primaryLight: "#3B82F6",
  text: "#F3F4F6",
  muted: "#9CA3AF",
  hover: "rgba(59, 130, 246, 0.1)",
  activeBg: "rgba(37, 99, 235, 0.18)",
};

const EXPANDED_W = 220;
const COLLAPSED_W = 72;

function useDesktopSidebarFonts() {
  React.useEffect(function () {
    var id = "irontrack-desktop-sidebar-fonts";
    if (typeof document === "undefined" || document.getElementById(id)) return;
    var link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,500;0,9..40,600;1,9..40,400&display=swap";
    document.head.appendChild(link);
  }, []);
}

function readCollapsed() {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch (e) {
    return false;
  }
}

function writeCollapsed(v) {
  try {
    localStorage.setItem(LS_KEY, v ? "1" : "0");
  } catch (e) {}
}

function useDesktopMin1024() {
  const [ok, setOk] = React.useState(function () {
    return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
  });
  React.useEffect(function () {
    var mq = window.matchMedia("(min-width: 1024px)");
    function onChange() {
      setOk(mq.matches);
    }
    mq.addEventListener("change", onChange);
    return function () {
      mq.removeEventListener("change", onChange);
    };
  }, []);
  return ok;
}

/** Logo compacto: solo barras (estado colapsado) */
function LogoCompact() {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, height: 24 }}>
      <div style={{ width: 3, height: 18, background: DS.primaryLight, borderRadius: 2 }} />
      <div style={{ width: 3, height: 24, background: DS.primary, borderRadius: 2 }} />
      <div style={{ width: 3, height: 14, background: "#1D4ED8", borderRadius: 2 }} />
    </div>
  );
}

function LogoFull() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <LogoCompact />
      <div
        style={{
          fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
          fontSize: 22,
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

const NAV_MAIN = [
  { id: "plan", label: "Dashboard", icon: LayoutDashboard },
  { id: "alumnos", label: "Alumnos", icon: Users },
  { id: "routines", label: "Rutinas", icon: ClipboardList },
  { id: "biblioteca", label: "Ejercicios", icon: Dumbbell },
  { id: "progress", label: "Progreso", icon: BarChart3 },
];

/**
 * Sidebar fijo izquierdo (coach, viewport ≥1024px).
 * Colapsado/expandido persistido en localStorage.
 */
export default function DesktopSidebar({
  activeTab,
  onNavigate,
  onSettings,
  onPerfil,
  onLogout,
  coachAvatarUrl,
  coachName,
  coachSubtitle = "Preparador físico",
}) {
  useDesktopSidebarFonts();
  const [collapsed, setCollapsed] = React.useState(readCollapsed);

  React.useEffect(function () {
    writeCollapsed(collapsed);
  }, [collapsed]);

  const w = collapsed ? COLLAPSED_W : EXPANDED_W;

  function go(tabKey) {
    if (typeof onNavigate === "function") onNavigate(tabKey);
  }

  function initials(n) {
    return String(n || "C")
      .trim()
      .split(/\s+/)
      .map(function (p) {
        return p.charAt(0);
      })
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <aside
      className="hidden box-border lg:flex lg:flex-shrink-0 lg:flex-col"
      style={{
        width: w,
        minWidth: w,
        borderRight: "1px solid " + DS.border,
        background: DS.bg,
        minHeight: "100vh",
        position: "sticky",
        top: 0,
        alignSelf: "stretch",
        transition: "width 0.22s ease, min-width 0.22s ease",
        overflow: "hidden",
        zIndex: 30,
      }}
    >
      <div style={{ padding: "12px 8px 10px 6px", borderBottom: "1px solid " + DS.border, flexShrink: 0 }}>
        <button
          type="button"
          onClick={function () {
            setCollapsed(function (c) {
              return !c;
            });
          }}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
          title={collapsed ? "Expandir" : "Colapsar"}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-end",
            padding: "8px",
            border: "none",
            borderRadius: 10,
            background: "transparent",
            color: DS.muted,
            cursor: "pointer",
            transition: "background 0.15s ease, color 0.15s ease",
          }}
          onMouseEnter={function (e) {
            e.currentTarget.style.background = DS.hover;
            e.currentTarget.style.color = DS.text;
          }}
          onMouseLeave={function (e) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = DS.muted;
          }}
        >
          {collapsed ? <PanelLeftOpen size={20} strokeWidth={2} /> : <PanelLeftClose size={20} strokeWidth={2} />}
        </button>
      </div>

      <div style={{ padding: "10px 8px 16px 6px", flexShrink: 0 }}>{collapsed ? <LogoCompact /> : <LogoFull />}</div>

      <nav
        style={{
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "2px 6px 12px 4px",
          justifyContent: "flex-start",
          alignItems: "stretch",
        }}
        aria-label="Navegación principal"
      >
        {NAV_MAIN.map(function (item) {
          var Icon = item.icon;
          var active = activeTab === item.id;
          var label = item.label;
          return (
            <button
              key={item.id}
              type="button"
              title={collapsed ? label : undefined}
              onClick={function () {
                go(item.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: collapsed ? "12px 10px" : "10px 10px 10px 6px",
                justifyContent: collapsed ? "center" : "flex-start",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                color: active ? "#fff" : DS.muted,
                background: active ? DS.activeBg : "transparent",
                boxShadow: active ? "inset 0 0 0 1px rgba(59,130,246,0.25)" : "none",
                transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
                position: "relative",
                width: "100%",
                boxSizing: "border-box",
              }}
              onMouseEnter={function (e) {
                if (!active) e.currentTarget.style.background = DS.hover;
              }}
              onMouseLeave={function (e) {
                if (!active) e.currentTarget.style.background = "transparent";
                else e.currentTarget.style.background = DS.activeBg;
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
              <Icon size={20} color={active ? DS.primaryLight : "#6B7280"} strokeWidth={2} style={{ flexShrink: 0 }} />
              {!collapsed ? <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span> : null}
            </button>
          );
        })}
      </nav>

      {/* Mismo padding horizontal que <nav> para alinear iconos y textos con Dashboard, Alumnos, etc. */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 6px 8px 4px",
          borderTop: "1px solid " + DS.border,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          title={collapsed ? "Settings" : undefined}
          onClick={function () {
            if (typeof onSettings === "function") onSettings();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: collapsed ? "12px 10px" : "10px 10px 10px 6px",
            justifyContent: collapsed ? "center" : "flex-start",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            background: "transparent",
            color: DS.muted,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 500,
            width: "100%",
            transition: "background 0.18s ease, color 0.18s ease",
          }}
          onMouseEnter={function (e) {
            e.currentTarget.style.background = DS.hover;
            e.currentTarget.style.color = DS.text;
          }}
          onMouseLeave={function (e) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = DS.muted;
          }}
        >
          <Settings size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
          {!collapsed ? <span>Settings</span> : null}
        </button>
        <button
          type="button"
          title={collapsed ? "Perfil" : undefined}
          onClick={function () {
            if (typeof onPerfil === "function") onPerfil();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: collapsed ? "10px 10px" : "10px 10px 10px 6px",
            justifyContent: collapsed ? "center" : "flex-start",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            background: "transparent",
            color: DS.muted,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 14,
            fontWeight: 500,
            width: "100%",
            transition: "background 0.18s ease, color 0.18s ease",
          }}
          onMouseEnter={function (e) {
            e.currentTarget.style.background = DS.hover;
            e.currentTarget.style.color = DS.text;
          }}
          onMouseLeave={function (e) {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = DS.muted;
          }}
        >
          {coachAvatarUrl ? (
            <img src={coachAvatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#1e3a5f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 9,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {initials(coachName)}
            </div>
          )}
          {!collapsed ? (
            <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Perfil</span>
          ) : null}
          {!collapsed ? <User size={16} color="#6B7280" style={{ flexShrink: 0 }} /> : null}
        </button>
        {typeof onLogout === "function" ? (
          <button
            type="button"
            title={collapsed ? "Salir" : undefined}
            onClick={function () {
              onLogout();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: collapsed ? "12px 10px" : "10px 10px 10px 6px",
              justifyContent: collapsed ? "center" : "flex-start",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
              background: "transparent",
              color: "#f87171",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              width: "100%",
              transition: "background 0.18s ease, color 0.18s ease",
            }}
            onMouseEnter={function (e) {
              e.currentTarget.style.background = "rgba(248, 113, 113, 0.12)";
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!collapsed ? <span>Salir</span> : null}
          </button>
        ) : null}
      </div>

      <div style={{ flex: 1, minHeight: 24 }} aria-hidden />

      {/* Tarjeta de usuario al pie (mock) */}
      <div style={{ flexShrink: 0, padding: "0 6px 16px 4px" }}>
        <button
          type="button"
          title={collapsed ? coachName || "Perfil" : undefined}
          onClick={function () {
            if (typeof onPerfil === "function") onPerfil();
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: collapsed ? "12px 8px" : "14px 12px 14px 8px",
            justifyContent: collapsed ? "center" : "flex-start",
            borderRadius: 12,
            border: "1px solid " + DS.border,
            background: "rgba(15, 22, 36, 0.85)",
            cursor: "pointer",
            boxSizing: "border-box",
            transition: "border-color 0.18s ease, background 0.18s ease",
          }}
          onMouseEnter={function (e) {
            e.currentTarget.style.borderColor = "rgba(59,130,246,0.35)";
            e.currentTarget.style.background = "rgba(37, 99, 235, 0.08)";
          }}
          onMouseLeave={function (e) {
            e.currentTarget.style.borderColor = DS.border;
            e.currentTarget.style.background = "rgba(15, 22, 36, 0.85)";
          }}
        >
          {coachAvatarUrl ? (
            <img src={coachAvatarUrl} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 13,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {initials(coachName)}
            </div>
          )}
          {!collapsed ? (
            <>
              <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                <div
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontSize: 14,
                    fontWeight: 700,
                    color: DS.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {coachName || "Coach"}
                </div>
                {coachSubtitle ? (
                  <div style={{ fontSize: 12, color: DS.muted, marginTop: 2, fontWeight: 500 }}>{coachSubtitle}</div>
                ) : null}
              </div>
              <ChevronRight size={18} color="#6B7280" style={{ flexShrink: 0 }} aria-hidden />
            </>
          ) : null}
        </button>
      </div>
    </aside>
  );
}

export { useDesktopMin1024, EXPANDED_W, COLLAPSED_W };
