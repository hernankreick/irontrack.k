import React from 'react';
import { Ic } from '../Ic.jsx';
import AlumnoPWAInstallControl from '../student/AlumnoPWAInstallControl.jsx';

export default function AppHeaderActions({
  session,
  sessionActiveStyle,
  showPWAInstall,
  coachDesktop1024,
  pwaInstallTipOpen,
  setPwaInstallTipOpen,
  installPWA,
  msg,
  settingsButtonStyle,
  textMuted,
  onSettings,
  sessionData,
  esAlumno,
  avatarLabel,
  userMenuOpen,
  onToggleUserMenu,
  coachLogoutButtonStyle,
  onCoachLogout,
  loginButtonStyle,
  onLogin,
}) {
  return (
    <div className="relative flex flex-shrink-0 items-center gap-3">
      {session&&<span style={sessionActiveStyle}>✓ Sesion activa</span>}
      {showPWAInstall && (
        <AlumnoPWAInstallControl
          coachDesktop1024={coachDesktop1024}
          pwaInstallTipOpen={pwaInstallTipOpen}
          setPwaInstallTipOpen={setPwaInstallTipOpen}
          installPWA={installPWA}
          msg={msg}
        />
      )}
      <button className="hov" style={settingsButtonStyle} onClick={onSettings}><Ic name="settings" size={18} color={textMuted}/></button>
      {sessionData&&esAlumno
        ? <button className="hov" style={{width:36,height:36,background:"linear-gradient(135deg,#1E3A5F,#2563EB)",border:"none",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,fontWeight:800,color:"#fff"}} onClick={function () { onToggleUserMenu(!userMenuOpen); }}>
            {avatarLabel}
          </button>
        : sessionData
          ? <button className="hov" style={coachLogoutButtonStyle} onClick={onCoachLogout}>SALIR</button>
          : <button className="hov" style={loginButtonStyle} onClick={onLogin}><Ic name="user" size={18}/></button>
      }
    </div>
  );
}
