import React from 'react';
import { Ic } from '../Ic.jsx';

export default function AlumnoUserMenu({
  sessionData,
  alumnoTopBarFixed,
  msg,
  onClose,
  onProfile,
  onSettings,
  onLogout,
}) {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 600 }} onClick={onClose} />
      <div
        style={{
          position: "fixed",
          zIndex: 610,
          top: alumnoTopBarFixed ? "calc(env(safe-area-inset-top, 0px) + 104px)" : "calc(env(safe-area-inset-top, 0px) + 56px)",
          right: 16,
          background: "#0a1628",
          border: "1px solid rgba(59,130,246,.25)",
          borderRadius: 14,
          width: 240,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,.55)",
          animation: "fadeIn .2s ease",
        }}
      >
        <div style={{ padding: "14px 16px", background: "linear-gradient(180deg,#0f1f3a 0%,#0a1628 100%)", borderBottom: "1px solid rgba(59,130,246,.15)" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>{sessionData.name}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sessionData.email || ""}</div>
        </div>
        <div style={{ padding: "6px 0" }}>
          <div
            className="hov"
            style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}
            onClick={onProfile}
          >
            <Ic name="user" size={17} color="#3b82f6" /> {msg("Mi perfil", "My profile")}
          </div>
          <div
            className="hov"
            style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}
            onClick={onSettings}
          >
            <Ic name="settings" size={17} color="#94a3b8" /> {msg("Configuración", "Settings")}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(239,68,68,.2)", padding: "4px 0" }}>
          <div
            className="hov"
            style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#f87171" }}
            onClick={onLogout}
          >
            <Ic name="log-out" size={17} color="#f87171" /> {msg("Cerrar sesión", "Log out")}
          </div>
        </div>
      </div>
    </>
  );
}
