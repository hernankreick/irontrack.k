import React, { forwardRef } from 'react';
import AppHeaderBrand from './AppHeaderBrand.jsx';
import AppHeaderActions from './AppHeaderActions.jsx';
import AlumnoPlanHeaderDayLabel from '../student/AlumnoPlanHeaderDayLabel.jsx';

const AppTopBar = forwardRef(function AppTopBar({
  alumnoTopBarFixed,
  alumnoTopBarHeight,
  darkMode,
  showCoachDesktopShell,
  esAlumno,
  coachDesktop1024,
  readOnly,
  sessionData,
  msg,
  onOpenMobileDrawer,
  showPlanHeaderLabel,
  alumnoPlanHeaderDayNum,
  textMuted,
  session,
  sessionActiveStyle,
  showPWAInstall,
  pwaInstallTipOpen,
  setPwaInstallTipOpen,
  installPWA,
  settingsButtonStyle,
  onSettings,
  avatarLabel,
  userMenuOpen,
  onToggleUserMenu,
  coachLogoutButtonStyle,
  onCoachLogout,
  loginButtonStyle,
  onLogin,
}, ref) {
  return (
    <div
      ref={ref}
      className={
        (alumnoTopBarFixed ? "relative flex w-full min-w-0 items-center justify-between gap-1 pb-3 pt-3 " : "relative z-50 flex w-full min-w-0 items-center justify-between gap-1 pb-3 pt-4 ") +
        (alumnoTopBarFixed
          ? ""
          : darkMode
            ? "border-b border-[#2D4057] bg-[#0F1923]"
            : showCoachDesktopShell && !esAlumno
              ? "border-b border-slate-200 bg-white"
              : "border-b border-[#2D4057] bg-[#F0F4F8]")
      }
      style={{
        position: alumnoTopBarFixed ? "fixed" : "relative",
        top: alumnoTopBarFixed ? 0 : undefined,
        left: alumnoTopBarFixed ? 0 : undefined,
        right: alumnoTopBarFixed ? 0 : undefined,
        zIndex: alumnoTopBarFixed ? 95 : undefined,
        paddingLeft: esAlumno ? 20 : 16,
        paddingRight: esAlumno ? 20 : 16,
        paddingTop: alumnoTopBarFixed ? "env(safe-area-inset-top, 0px)" : undefined,
        height: undefined,
        minHeight: alumnoTopBarFixed ? alumnoTopBarHeight : undefined,
        boxSizing: "border-box",
        background: alumnoTopBarFixed ? "#0A0F1A" : undefined,
        borderBottom: alumnoTopBarFixed ? "1px solid #2d4057" : undefined,
        backdropFilter: alumnoTopBarFixed ? "none" : undefined,
        WebkitBackdropFilter: alumnoTopBarFixed ? "none" : undefined,
        boxShadow: alumnoTopBarFixed ? "0 8px 24px rgba(0,0,0,.18)" : undefined,
      }}
    >
      <AppHeaderBrand
        showCoachDesktopShell={showCoachDesktopShell}
        coachDesktop1024={coachDesktop1024}
        darkMode={darkMode}
        esAlumno={esAlumno}
        readOnly={readOnly}
        sessionData={sessionData}
        msg={msg}
        onOpenMobileDrawer={onOpenMobileDrawer}
      />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          paddingLeft: 4,
          paddingRight: 4,
        }}
      >
        {showPlanHeaderLabel && (
          <AlumnoPlanHeaderDayLabel
            alumnoPlanHeaderDayNum={alumnoPlanHeaderDayNum}
            textMuted={textMuted}
            msg={msg}
          />
        )}
      </div>
      <AppHeaderActions
        session={session}
        sessionActiveStyle={sessionActiveStyle}
        showPWAInstall={showPWAInstall}
        coachDesktop1024={coachDesktop1024}
        pwaInstallTipOpen={pwaInstallTipOpen}
        setPwaInstallTipOpen={setPwaInstallTipOpen}
        installPWA={installPWA}
        msg={msg}
        settingsButtonStyle={settingsButtonStyle}
        textMuted={textMuted}
        onSettings={onSettings}
        sessionData={sessionData}
        esAlumno={esAlumno}
        avatarLabel={avatarLabel}
        userMenuOpen={userMenuOpen}
        onToggleUserMenu={onToggleUserMenu}
        coachLogoutButtonStyle={coachLogoutButtonStyle}
        onCoachLogout={onCoachLogout}
        loginButtonStyle={loginButtonStyle}
        onLogin={onLogin}
      />
    </div>
  );
});

export default AppTopBar;
