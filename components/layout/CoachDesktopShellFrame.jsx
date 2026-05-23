import React from 'react';
import DesktopSidebar from '../DesktopSidebar.jsx';

export default function CoachDesktopShellFrame({
  showCoachDesktopShell,
  tab,
  onNavigate,
  onSettings,
  onPerfil,
  onLogout,
  coachAvatarUrl,
  coachName,
  darkMode,
  children,
}) {
  return (
    <div
      className={showCoachDesktopShell ? "flex w-full min-h-0 flex-1 flex-col self-stretch items-stretch lg:flex-row" : undefined}
      style={showCoachDesktopShell ? undefined : { display: "contents" }}
    >
      {showCoachDesktopShell ? (
        <div style={{ display: (tab === "settings" || tab === "perfil") ? "none" : "flex" }}>
          <DesktopSidebar
            activeTab={tab}
            onNavigate={onNavigate}
            onSettings={onSettings}
            onPerfil={onPerfil}
            onLogout={onLogout}
            coachAvatarUrl={coachAvatarUrl}
            coachName={coachName}
            darkMode={darkMode}
          />
        </div>
      ) : null}
      <div
        className={showCoachDesktopShell ? "flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden" : undefined}
        style={showCoachDesktopShell ? undefined : { display: "contents" }}
      >
        {children}
      </div>
    </div>
  );
}
