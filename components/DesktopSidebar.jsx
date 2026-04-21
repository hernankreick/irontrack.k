import React from "react";
import { useIronTrackI18n } from "../contexts/IronTrackI18nContext.jsx";
import { irontrackMsg as M } from "../lib/irontrackMsg.js";
import {
  BarChart3,
  ClipboardList,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Users,
} from "lucide-react";
import { desktopSidebarTheme } from "./coachThemePalette.js";

const LS_KEY = "irontrack_desktop_sidebar_collapsed";

const EXPANDED_W = 240;
const COLLAPSED_W = 72;

/** Padding horizontal único: nav principal, acciones inferiores y tarjeta comparten la misma columna. */
const INNER_PAD_X = 12;

function getRowButtonStyle(opts) {
  var collapsed = !!opts.collapsed;
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: collapsed ? "12px 10px" : "10px 12px",
    /** Con padding horizontal INNER_PAD_X en <nav> / sección inferior, no duplicar margen izquierdo. */
    paddingLeft: 0,
    /** Siempre alinear contenido a la izquierda; el centrado hacía que ítems y logo parecieran “flotando”. */
    justifyContent: "flex-start",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };
}

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
function LogoCompact(props) {
  var DS = props.theme;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-start", gap: 3, height: 24 }}>
      <div style={{ width: 3, height: 18, background: DS.primaryLight, borderRadius: 2 }} />
      <div style={{ width: 3, height: 24, background: DS.primary, borderRadius: 2 }} />
      <div style={{ width: 3, height: 14, background: DS.logoBarMid, borderRadius: 2 }} />
    </div>
  );
}

function LogoFull(props) {
  var DS = props.theme;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <LogoCompact theme={DS} />
      <div>
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Barlow Condensed', sans-serif",
            fontSize: 22,
            letterSpacing: 2,
            color: DS.text,
            lineHeight: 0.95,
          }}
        >
          IRON
          <br />
          TRACK
        </div>
      </div>
    </div>
  );
}

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
  coachSubtitle: _coachSubtitle = "Preparador físico",
  darkMode = true,
}) {
  const DS = React.useMemo(
    function () {
      return desktopSidebarTheme(darkMode);
    },
    [darkMode]
  );

  const { lang } = useIronTrackI18n();
  const NAV_MAIN = React.useMemo(
    function () {
      return [
        { id: "plan", label: M(lang, "Dashboard", "Dashboard", "Painel"), icon: LayoutDashboard },
        { id: "alumnos", label: M(lang, "Alumnos", "Athletes", "Alunos"), icon: Users },
        { id: "routines", label: M(lang, "Rutinas", "Routines", "Rotinas"), icon: ClipboardList },
        { id: "biblioteca", label: M(lang, "Ejercicios", "Exercises", "Exercícios"), icon: Dumbbell },
        { id: "progress", label: M(lang, "Progreso", "Progress", "Progresso"), icon: BarChart3 },
      ];
    },
    [lang]
  );
  /** Pie de sidebar (config / perfil / salir): mismo criterio trilingüe que el nav. */
  const footerLabels = React.useMemo(
    function () {
      return {
        settings: M(lang, "Configuración", "Settings", "Configurações"),
        perfil: M(lang, "Perfil", "Profile", "Perfil"),
        salir: M(lang, "Salir", "Log out", "Sair"),
      };
    },
    [lang]
  );
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
      <div style={{ padding: "12px " + INNER_PAD_X + "px 10px", borderBottom: "1px solid " + DS.border, flexShrink: 0 }}>
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

      <div style={{ padding: "10px " + INNER_PAD_X + "px 16px", flexShrink: 0 }}>
        {collapsed ? <LogoCompact theme={DS} /> : <LogoFull theme={DS} />}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          paddingLeft: 0,
          paddingRight: 0,
          boxSizing: "border-box",
        }}
      >
      <nav
        style={{
          flexShrink: 0,
          width: "100%",
          alignSelf: "stretch",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: "2px " + INNER_PAD_X + "px 12px " + INNER_PAD_X + "px",
          justifyContent: "flex-start",
          alignItems: "stretch",
          boxSizing: "border-box",
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
              style={Object.assign(getRowButtonStyle({ collapsed: collapsed }), {
                fontWeight: active ? 600 : 500,
                color: active ? DS.activeLabel : DS.muted,
                background: active ? DS.activeBg : "transparent",
                boxShadow: active ? "inset 0 0 0 1px rgba(59,130,246,0.25)" : "none",
                transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
                position: "relative",
              })}
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
                    left: -12,
                    top: "50%",
                    width: 3,
                    height: 22,
                    marginTop: -11,
                    borderRadius: "0 4px 4px 0",
                    background: DS.primary,
                  }}
                />
              ) : null}
              <Icon size={20} color={active ? DS.primaryLight : DS.iconInactive} strokeWidth={2} style={{ flexShrink: 0 }} />
              {!collapsed ? <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span> : null}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, minHeight: 24 }} aria-hidden />

      <div
        style={{
          flexShrink: 0,
          width: "100%",
          alignSelf: "stretch",
          padding: "8px " + INNER_PAD_X + "px 16px " + INNER_PAD_X + "px",
          borderTop: "1px solid " + DS.border,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 4,
          boxSizing: "border-box",
        }}
      >
        <button
          type="button"
          title={collapsed ? footerLabels.settings : undefined}
          onClick={function () {
            if (typeof onSettings === "function") onSettings();
          }}
          style={Object.assign(getRowButtonStyle({ collapsed: collapsed }), {
            background: activeTab === "settings" ? DS.activeBg : "transparent",
            color: activeTab === "settings" ? DS.text : DS.muted,
            fontWeight: activeTab === "settings" ? 600 : 500,
            boxShadow: activeTab === "settings" ? "inset 0 0 0 1px rgba(59,130,246,0.25)" : "none",
            transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
            position: "relative",
          })}
          onMouseEnter={function (e) {
            if (activeTab !== "settings") {
              e.currentTarget.style.background = DS.hover;
              e.currentTarget.style.color = DS.text;
            }
          }}
          onMouseLeave={function (e) {
            if (activeTab !== "settings") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = DS.muted;
            } else {
              e.currentTarget.style.background = DS.activeBg;
              e.currentTarget.style.color = DS.text;
            }
          }}
        >
          {activeTab === "settings" ? (
            <span
              style={{
                position: "absolute",
                left: -12,
                top: "50%",
                width: 3,
                height: 22,
                marginTop: -11,
                borderRadius: "0 4px 4px 0",
                background: DS.primary,
              }}
            />
          ) : null}
          <Settings size={20} strokeWidth={2} style={{ flexShrink: 0 }} color={activeTab === "settings" ? DS.primaryLight : undefined} />
          {!collapsed ? <span>{footerLabels.settings}</span> : null}
        </button>
        <button
          type="button"
          title={collapsed ? footerLabels.perfil : undefined}
          onClick={function () {
            if (typeof onPerfil === "function") onPerfil();
          }}
          style={Object.assign(getRowButtonStyle({ collapsed: collapsed }), {
            background: activeTab === "perfil" ? DS.activeBg : "transparent",
            color: activeTab === "perfil" ? DS.text : DS.muted,
            fontWeight: activeTab === "perfil" ? 600 : 500,
            boxShadow: activeTab === "perfil" ? "inset 0 0 0 1px rgba(59,130,246,0.25)" : "none",
            transition: "background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease",
            position: "relative",
          })}
          onMouseEnter={function (e) {
            if (activeTab !== "perfil") {
              e.currentTarget.style.background = DS.hover;
              e.currentTarget.style.color = DS.text;
            }
          }}
          onMouseLeave={function (e) {
            if (activeTab !== "perfil") {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = DS.muted;
            } else {
              e.currentTarget.style.background = DS.activeBg;
              e.currentTarget.style.color = DS.text;
            }
          }}
        >
          {activeTab === "perfil" ? (
            <span
              style={{
                position: "absolute",
                left: -12,
                top: "50%",
                width: 3,
                height: 22,
                marginTop: -11,
                borderRadius: "0 4px 4px 0",
                background: DS.primary,
              }}
            />
          ) : null}
          {coachAvatarUrl ? (
            <img src={coachAvatarUrl} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#1e3a5f,#2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 10,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              {initials(coachName)}
            </div>
          )}
          {!collapsed ? <span>{footerLabels.perfil}</span> : null}
        </button>
        {typeof onLogout === "function" ? (
          <button
            type="button"
            title={collapsed ? footerLabels.salir : undefined}
            onClick={function () {
              onLogout();
            }}
            style={Object.assign(getRowButtonStyle({ collapsed: collapsed }), {
              background: "transparent",
              color: DS.danger,
              fontWeight: 600,
              transition: "background 0.18s ease, color 0.18s ease",
            })}
            onMouseEnter={function (e) {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
            }}
            onMouseLeave={function (e) {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <LogOut size={20} strokeWidth={2} style={{ flexShrink: 0 }} />
            {!collapsed ? <span>{footerLabels.salir}</span> : null}
          </button>
        ) : null}
      </div>
      </div>
    </aside>
  );
}

export { useDesktopMin1024, EXPANDED_W, COLLAPSED_W };
