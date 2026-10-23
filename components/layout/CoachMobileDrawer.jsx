import React from "react";
import { Ic } from "../Ic.jsx";

// Fila de navegacion del drawer: boton real (teclado y lector de pantalla), area tactil >= 48 px.
function DrawerNavItem({ active, onClick, children, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minHeight: 48,
        padding: "8px 16px",
        cursor: "pointer",
        font: "inherit",
        textAlign: "left",
        color: color || "inherit",
        background: active ? "rgba(37,99,235,.1)" : "transparent",
        border: "none",
        borderLeft: active ? "3px solid #2563EB" : "3px solid transparent",
      }}
    >
      {children}
    </button>
  );
}

export default function CoachMobileDrawer({
  open,
  activeTab,
  sessionData,
  msg,
  mobileDrawerRef,
  onClose,
  onNavigate,
  onLogout,
  coachInitials,
  darkMode = true,
}) {
  const closeRef = React.useRef(null);
  const openerRef = React.useRef(null);
  const wasOpen = React.useRef(false);

  // Accesibilidad: al abrir el foco entra al drawer; Escape cierra; Tab no se escapa al fondo; al cerrar el foco vuelve a quien lo abrio.
  React.useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement;
      wasOpen.current = true;
      const t = setTimeout(() => { if (closeRef.current) closeRef.current.focus(); }, 0);
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
        if (e.key !== "Tab") return;
        const root = mobileDrawerRef && mobileDrawerRef.current;
        if (!root) return;
        const items = [...root.querySelectorAll("button:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])")].filter((n) => n.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1], a = document.activeElement;
        if (!root.contains(a)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      };
      document.addEventListener("keydown", onKey);
      return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); };
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      const el = openerRef.current;
      if (el && typeof el.focus === "function" && document.contains(el)) el.focus();
    }
    return undefined;
  }, [open, onClose, mobileDrawerRef]);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.65)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "all" : "none",
          transition: "opacity .28s ease",
        }}
      />

      {/* Drawer */}
      <div
        ref={mobileDrawerRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? "true" : undefined}
        aria-label={msg("Menú de navegación", "Navigation menu")}
        aria-hidden={open ? undefined : "true"}
        inert={open ? undefined : ""}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 260,
          zIndex: 201,
          background: darkMode ? "#111827" : "#FFFFFF",
          borderRight: "1px solid " + (darkMode ? "#1A2535" : "#E2E8F0"),
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .3s cubic-bezier(.32,.72,0,1)",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Header del drawer */}
        <div style={{ padding: "calc(20px + env(safe-area-inset-top, 0px)) 16px 14px", borderBottom: "1px solid " + (darkMode ? "#1A2535" : "#E2E8F0"), flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14, position: "relative" }}>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={msg("Cerrar menú", "Close menu")}
              style={{ position: "absolute", right: -8, top: -14, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: darkMode ? "#94a3b8" : "#475569", cursor: "pointer", fontSize: 22, lineHeight: 1 }}
            >
              <span aria-hidden="true">✕</span>
            </button>
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-.3px" }}>
              <span style={{ color: "#2563EB" }}>IRON</span>
              <span style={{ color: darkMode ? "#fff" : "#0F1923" }}>TRACK</span>
            </span>
            <span
              style={{
                background: "rgba(37,99,235,.15)",
                border: "1px solid rgba(59,130,246,.3)",
                color: darkMode ? "#93C5FD" : "#1D4ED8",
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 99,
                padding: "2px 7px",
                letterSpacing: ".5px",
              }}
            >
              PRO
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "linear-gradient(135deg,#1d4ed8,#2563EB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                border: "2px solid rgba(59,130,246,.4)",
                flexShrink: 0,
              }}
            >
              {coachInitials}
            </div>
            <div>
              <div style={{ color: darkMode ? "#fff" : "#0F1923", fontSize: 13, fontWeight: 700 }}>{sessionData?.name || "Entrenador"}</div>
              <div style={{ color: darkMode ? "#94a3b8" : "#475569", fontSize: 11, marginTop: 2 }}>Entrenador personal</div>
            </div>
          </div>
        </div>

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {/* PRINCIPAL */}
          <div
            style={{
              color: darkMode ? "#94a3b8" : "#475569",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              padding: "10px 16px 4px",
            }}
          >
            PRINCIPAL
          </div>

          {[
            { k: "plan", icon: "calendar", label: msg("Dashboard", "Dashboard"), sub: null },
            { k: "calendar", icon: "calendar", label: msg("Calendario", "Calendar"), sub: msg("Programar rutinas", "Schedule routines") },
            { k: "mensajes", icon: "message-circle", label: msg("Mensajes", "Messages"), sub: msg("Chats con alumnos", "Athlete chats") },
            { k: "alumnos", icon: "users", label: msg("Alumnos", "Athletes"), sub: msg("Gestionar equipo", "Manage team") },
            { k: "routines", icon: "file-text", label: msg("Rutinas", "Routines"), sub: null },
            { k: "biblioteca", icon: "activity", label: msg("Ejercicios", "Exercises"), sub: null },
            { k: "progress", icon: "trending-up", label: msg("Progreso", "Progress"), sub: msg("Estadísticas generales", "General stats") },
          ].map((item) => (
            <DrawerNavItem
              key={item.k}
              active={activeTab === item.k}
              onClick={() => {
                onNavigate(item.k);
                onClose();
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: activeTab === item.k ? "rgba(37,99,235,.15)" : "rgba(148,163,184,.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ic name={item.icon} size={14} color={activeTab === item.k ? (darkMode ? "#60A5FA" : "#1D4ED8") : "#94a3b8"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: activeTab === item.k ? (darkMode ? "#60A5FA" : "#1D4ED8") : (darkMode ? "#e2e8f0" : "#0F1923"), fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                {item.sub && <div style={{ color: darkMode ? "#94a3b8" : "#475569", fontSize: 11, marginTop: 1 }}>{item.sub}</div>}
              </div>
            </DrawerNavItem>
          ))}

          <div style={{ height: 1, background: darkMode ? "#1A2535" : "#E2E8F0", margin: "6px 16px" }} />

          {/* PERFIL */}
          <div
            style={{
              color: darkMode ? "#94a3b8" : "#475569",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              padding: "10px 16px 4px",
            }}
          >
            PERFIL
          </div>

          {[
            { k: "perfil", icon: "user", label: msg("Mi perfil", "My profile"), sub: msg("Foto, bio, datos", "Photo, bio, data") },
            { k: "settings", icon: "settings", label: msg("Configuración", "Settings"), sub: msg("Preferencias", "Preferences") },
          ].map((item) => (
            <DrawerNavItem
              key={item.k}
              active={activeTab === item.k}
              onClick={() => {
                onNavigate(item.k);
                onClose();
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(37,99,235,.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ic name={item.icon} size={14} color={darkMode ? "#60A5FA" : "#1D4ED8"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: darkMode ? "#e2e8f0" : "#0F1923", fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: darkMode ? "#94a3b8" : "#475569", fontSize: 11, marginTop: 1 }}>{item.sub}</div>
              </div>
            </DrawerNavItem>
          ))}

          <div style={{ height: 1, background: darkMode ? "#1A2535" : "#E2E8F0", margin: "6px 16px" }} />

          {/* PAGOS */}
          <div
            style={{
              color: darkMode ? "#94a3b8" : "#475569",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              padding: "10px 16px 4px",
            }}
          >
            PAGOS
          </div>

          {[
            { icon: "credit-card", label: msg("Facturación", "Billing"), sub: "Plan Pro · $29/mes" },
            { icon: "dollar-sign", label: msg("Cobros", "Payments"), sub: msg("Gestionar cobros", "Manage payments") },
          ].map((item, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "default" }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(34,197,94,.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Ic name={item.icon} size={14} color="#22c55e" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: darkMode ? "#cbd5e1" : "#334155", fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: darkMode ? "#94a3b8" : "#475569", fontSize: 11, marginTop: 1 }}>{item.sub}</div>
              </div>
              <span
                style={{
                  background: darkMode ? "#1A2535" : "#E2E8F0",
                  color: darkMode ? "#cbd5e1" : "#334155",
                  fontSize: 10,
                  borderRadius: 99,
                  padding: "2px 6px",
                  fontWeight: 700,
                }}
              >
                PRONTO
              </span>
            </div>
          ))}
        </div>

        {/* Footer: cerrar sesión */}
        <div style={{ borderTop: "1px solid " + (darkMode ? "#1A2535" : "#E2E8F0"), flexShrink: 0 }}>
          <button
            type="button"
            onClick={onLogout}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 52, padding: "8px 16px calc(8px + env(safe-area-inset-bottom, 0px))", cursor: "pointer", font: "inherit", textAlign: "left", background: "transparent", border: "none" }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(239,68,68,.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Ic name="log-out" size={14} color="#ef4444" />
            </div>
            <div style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{msg("Cerrar sesión", "Log out")}</div>
          </button>
        </div>
      </div>
    </>
  );
}
