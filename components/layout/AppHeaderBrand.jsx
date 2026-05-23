import React from 'react';
import IronTrackLogo from '../IronTrackLogo.jsx';

export default function AppHeaderBrand({
  showCoachDesktopShell,
  coachDesktop1024,
  darkMode,
  esAlumno,
  readOnly,
  sessionData,
  msg,
  onOpenMobileDrawer,
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
      {showCoachDesktopShell && !coachDesktop1024 && (
        <button
          onClick={onOpenMobileDrawer}
          style={{
            width: 34,
            height: 34,
            background: darkMode ? "#111827" : "#ffffff",
            border: darkMode ? "1px solid #1A2535" : "1px solid #e2e8f0",
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
            position: "relative",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={darkMode ? "#94a3b8" : "#64748b"} strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="7" x2="21" y2="7" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="17" x2="21" y2="17" />
          </svg>
          <span
            style={{
              position: "absolute",
              top: 5,
              right: 5,
              width: 7,
              height: 7,
              background: "#ef4444",
              borderRadius: "50%",
              border: darkMode ? "1.5px solid #0B0E11" : "1.5px solid #ffffff",
            }}
          />
        </button>
      )}
      <IronTrackLogo
        size={esAlumno ? 24 : 22}
        color="#2563EB"
        {...(darkMode && (readOnly || esAlumno)
          ? { ironColor: "#ffffff", trackColor: "#2563EB", barColor: "#2563EB" }
          : darkMode && !esAlumno && sessionData
            ? { ironColor: "#ffffff", trackColor: "#2563EB", barColor: "#2563EB" }
            : {})}
        showBar={true}
        modeFontSize={esAlumno ? 12 : 11}
        mode={
          (readOnly || esAlumno) && sessionData
            ? msg("Modo alumno", "Athlete mode") +
              ": " +
              (String(sessionData.name || "").trim() || msg("Atleta", "Athlete"))
            : !esAlumno && sessionData
              ? msg("Modo entrenador", "Coach mode") +
                (String(sessionData.name || "").trim() ? ": " + String(sessionData.name || "").trim() : "")
              : null
        }
        modeColor={darkMode ? "#94a3b8" : "#64748B"}
      />
    </div>
  );
}
