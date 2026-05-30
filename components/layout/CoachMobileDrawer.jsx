import React from "react";
import { Ic } from "../Ic.jsx";

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
}) {
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
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 260,
          zIndex: 201,
          background: "#111827",
          borderRight: "1px solid #1A2535",
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .3s cubic-bezier(.32,.72,0,1)",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {/* Header del drawer */}
        <div style={{ padding: "20px 16px 14px", borderBottom: "1px solid #1A2535", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-.3px" }}>
              <span style={{ color: "#2563EB" }}>IRON</span>
              <span style={{ color: "#fff" }}>TRACK</span>
            </span>
            <span
              style={{
                background: "rgba(37,99,235,.15)",
                border: "1px solid rgba(59,130,246,.3)",
                color: "#3B82F6",
                fontSize: 8,
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
              <div style={{ color: "#fff", fontSize: 13, fontWeight: 700 }}>{sessionData?.name || "Entrenador"}</div>
              <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>Entrenador personal</div>
            </div>
          </div>
        </div>

        {/* Body scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {/* PRINCIPAL */}
          <div
            style={{
              color: "#374151",
              fontSize: 9,
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
          ].map((item) => (
            <div
              key={item.k}
              onClick={() => {
                onNavigate(item.k);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                cursor: "pointer",
                background: activeTab === item.k ? "rgba(37,99,235,.1)" : "transparent",
                borderLeft: activeTab === item.k ? "3px solid #2563EB" : "3px solid transparent",
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
                <Ic name={item.icon} size={14} color={activeTab === item.k ? "#3B82F6" : "#94a3b8"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: activeTab === item.k ? "#3B82F6" : "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                {item.sub && <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>{item.sub}</div>}
              </div>
            </div>
          ))}

          <div style={{ height: 1, background: "#1A2535", margin: "6px 16px" }} />

          {/* PERFIL */}
          <div
            style={{
              color: "#374151",
              fontSize: 9,
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
            <div
              key={item.k}
              onClick={() => {
                onNavigate(item.k);
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 16px",
                cursor: "pointer",
                background: activeTab === item.k ? "rgba(37,99,235,.1)" : "transparent",
                borderLeft: activeTab === item.k ? "3px solid #2563EB" : "3px solid transparent",
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
                <Ic name={item.icon} size={14} color="#3B82F6" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>{item.sub}</div>
              </div>
            </div>
          ))}

          <div style={{ height: 1, background: "#1A2535", margin: "6px 16px" }} />

          {/* PAGOS */}
          <div
            style={{
              color: "#374151",
              fontSize: 9,
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
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", opacity: 0.6 }}
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
                <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>{item.label}</div>
                <div style={{ color: "#64748b", fontSize: 10, marginTop: 1 }}>{item.sub}</div>
              </div>
              <span
                style={{
                  background: "#1A2535",
                  color: "#64748b",
                  fontSize: 8,
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
        <div style={{ borderTop: "1px solid #1A2535", flexShrink: 0 }}>
          <div
            onClick={onLogout}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer" }}
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
            <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 600 }}>{msg("Cerrar sesión", "Log out")}</div>
          </div>
        </div>
      </div>
    </>
  );
}
