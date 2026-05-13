import React from "react";
import { createPortal } from "react-dom";
import { Ic } from "../Ic.jsx";

export default function AlumnoSettingsModal({
  open,
  darkMode,
  lang,
  msg,
  es,
  toast2,
  onClose,
  onToggleDarkMode,
  onChangeLang,
  onLogoutSettings,
  RecordatoriosPanel,
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        background: "rgba(10,22,40,.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingBottom: "env(safe-area-inset-bottom,0px)",
      }}
      onClick={function () { onClose(); }}
    >
      <div
        style={{
          background: "#0a1628",
          borderRadius: "16px 16px 0 0",
          width: "100%",
          maxWidth: 480,
          border: "1px solid rgba(59,130,246,.2)",
          animation: "slideUpFade 0.3s ease",
          maxHeight: "min(90dvh, 100svh - env(safe-area-inset-top, 0px) - 12px)",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div style={{ flexShrink: 0, padding: "20px 16px 12px" }}>
          <div style={{ width: 40, height: 4, background: "#3b82f6", borderRadius: 2, margin: "0 auto 16px" }} />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "#fff" }}><Ic name="settings" size={18} color="#3b82f6" /> {msg("CONFIGURACIÓN", "SETTINGS")}</div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowX: "hidden", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", padding: "0 16px 8px" }}>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 10 }}>{msg("APARIENCIA", "APPEARANCE")}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,.04)", border: "1px solid rgba(148,163,184,.2)", borderRadius: 14, padding: "14px 16px" }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{msg("Modo oscuro", "Dark mode")}</span>
              <button type="button" className="hov" onClick={onToggleDarkMode}
                style={{ width: 52, height: 28, borderRadius: 14, border: "none", background: darkMode ? "#22c55e" : "#475569", position: "relative", cursor: "pointer", transition: "background .25s" }}>
                <span style={{ position: "absolute", top: 3, left: darkMode ? 26 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .25s ease", boxShadow: "0 1px 4px rgba(0,0,0,.3)" }} />
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 10 }}>{msg("IDIOMA", "LANGUAGE")}</div>
            {[{ code: "es", label: msg("Español", "Spanish") }, { code: "en", label: "English" }].map(function (opt) {
              return (
                <button key={opt.code} type="button" className="hov" onClick={function () { onChangeLang(opt.code); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", marginBottom: 8, background: lang === opt.code ? "rgba(59,130,246,.12)" : "rgba(255,255,255,.03)", border: "1px solid " + (lang === opt.code ? "rgba(59,130,246,.4)" : "rgba(148,163,184,.15)"), borderRadius: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{opt.label}</span>
                  {lang === opt.code ? <span style={{ color: "#22c55e", fontSize: 18, fontWeight: 900 }}>✓</span> : <span style={{ width: 18 }} />}
                </button>
              );
            })}
          </div>
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1.2, marginBottom: 10 }}>{msg("AYUDA", "HELP")}</div>
            <a href="https://wa.me/541164461075" target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none", marginBottom: 10 }}>
              <div style={{ padding: "14px 16px", background: "rgba(59,130,246,.1)", border: "1px solid rgba(59,130,246,.25)", borderRadius: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#3b82f6" }}>{msg("Soporte", "Support")}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{msg("Contactá con nosotros", "Contact us")}</div>
              </div>
            </a>
            <a href="mailto:soporte@irontrack.app?subject=Feedback" style={{ display: "block", textDecoration: "none" }}>
              <div style={{ padding: "14px 16px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(148,163,184,.15)", borderRadius: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>{msg("Enviar comentarios", "Send feedback")}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{msg("Ayudanos a mejorar", "Help us improve")}</div>
              </div>
            </a>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#64748b" }}>Iron Track v1.0.0</div>
          </div>
          <RecordatoriosPanel es={es} darkMode={darkMode} toast2={toast2} msg={msg} />
          <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(239,68,68,.25)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", letterSpacing: 1.2, marginBottom: 10 }}>{msg("ZONA DE PELIGRO", "DANGER ZONE")}</div>
            <button type="button" className="hov" style={{ width: "100%", padding: "14px", background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 12, color: "#f87171", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onClick={onLogoutSettings}>
              <Ic name="log-out" size={18} color="#f87171" /> {msg("Cerrar sesión", "Log out")}
            </button>
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: "10px 16px calc(12px + env(safe-area-inset-bottom, 0px))", borderTop: "1px solid rgba(148,163,184,.2)", background: "#0a1628" }}>
          <button className="hov"
            style={{ width: "100%", padding: "12px", background: "rgba(148,163,184,.12)", border: "1px solid rgba(148,163,184,.2)", borderRadius: 12, color: "#cbd5e1", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
            onClick={onClose}>
            {msg("CERRAR", "CLOSE")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
