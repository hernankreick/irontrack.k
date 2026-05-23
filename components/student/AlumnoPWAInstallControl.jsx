import React from 'react';
import { Download as DownloadNavIcon } from 'lucide-react';

export default function AlumnoPWAInstallControl({
  coachDesktop1024,
  pwaInstallTipOpen,
  setPwaInstallTipOpen,
  installPWA,
  msg,
}) {
  if (!coachDesktop1024) {
    return (
      <div style={{ position: "relative", flexShrink: 0, zIndex: pwaInstallTipOpen ? 660 : "auto" }}>
        {pwaInstallTipOpen && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 630, background: "transparent" }}
            onClick={() => setPwaInstallTipOpen(false)}
            aria-hidden
          />
        )}
        <button
          type="button"
          className="hov select-none"
          onClick={function () {
            setPwaInstallTipOpen(function (open) { return !open; });
          }}
          aria-label={msg("Instalar app", "Install app", "Instalar app")}
          aria-expanded={pwaInstallTipOpen}
          style={{
            position: "relative",
            zIndex: 650,
            width: 40,
            height: 40,
            minWidth: 40,
            minHeight: 40,
            padding: 0,
            borderRadius: "50%",
            background: "rgba(37, 99, 235, 0.10)",
            color: "#2563EB",
            border: "1px solid rgba(37, 99, 235, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxSizing: "border-box",
            boxShadow: "0 8px 24px rgba(2, 6, 23, 0.24)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          <DownloadNavIcon size={20} strokeWidth={2.35} color="#2563EB" aria-hidden />
        </button>
        {pwaInstallTipOpen && (
          <button
            type="button"
            onClick={function () {
              setPwaInstallTipOpen(false);
              void installPWA();
            }}
            style={{
              position: "absolute",
              zIndex: 660,
              top: "calc(100% + 10px)",
              right: 0,
              width: 220,
              padding: "12px 14px",
              borderRadius: 16,
              background: "rgba(10, 22, 40, 0.96)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              boxShadow: "0 18px 44px rgba(0, 0, 0, 0.46)",
              color: "#fff",
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "inherit",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>
              {msg("Instalar app", "Install app", "Instalar app")}
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.35, color: "#94a3b8", marginTop: 4 }}>
              {msg("Acceso rápido desde tu dispositivo", "Quick access from your device", "Acesso rápido pelo seu dispositivo")}
            </div>
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="hov select-none"
      onClick={function () {
        void installPWA();
      }}
      aria-label={msg("Instalar app", "Install app", "Instalar app")}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 42,
        minHeight: 42,
        padding: "0 16px",
        borderRadius: 9999,
        background: "#2563EB",
        color: "#fff",
        border: "none",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
        flexShrink: 0,
        boxSizing: "border-box",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.12), 0 2px 4px -2px rgba(0, 0, 0, 0.08)",
        transition: "background-color 0.15s ease, transform 0.15s ease",
        WebkitTapHighlightColor: "transparent",
      }}
      onMouseEnter={function (e) {
        e.currentTarget.style.background = "#2f6df6";
      }}
      onMouseLeave={function (e) {
        e.currentTarget.style.background = "#2563EB";
        e.currentTarget.style.transform = "";
      }}
      onTouchStart={function (e) {
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onTouchEnd={function (e) {
        e.currentTarget.style.transform = "";
      }}
      onTouchCancel={function (e) {
        e.currentTarget.style.transform = "";
      }}
    >
      <DownloadNavIcon size={20} strokeWidth={2.25} color="#ffffff" aria-hidden />
      {msg("Instalar app", "Install app", "Instalar app")}
    </button>
  );
}
