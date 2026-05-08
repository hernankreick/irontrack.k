import React from 'react';
import { Ic } from '../Ic.jsx';
import { getRutinaBadgeConfig } from '../../lib/routineStore.js';
import StudentActionsMenu from './StudentActionsMenu.jsx';

export default function StudentCard({
  alumno,
  rutinaAsignada,
  progresoSemanal,
  rutinasLoaded,
  isActive,
  isMenuOpen,
  darkMode,
  msg,
  textMain,
  textMuted,
  coachAluSurface,
  coachAluBorderSoft,
  coachAluTrack,
  coachAluSubtle,
  coachAluDropdown,
  coachAluDropdownShadow,
  onVer,
  onToggleMenu,
  onEdit,
  onChat,
  onClearProgress,
  onDelete,
  onAsignarRutina,
  children,
}) {
  var a = alumno || {};
  var progress = progresoSemanal || {};
  var totalDays = progress.totalDays || 0;
  var doneDays = progress.completedDays || 0;
  var pct = progress.pct || 0;
  var badgeCfg = getRutinaBadgeConfig({
    rutina: rutinaAsignada,
    rutinasLoaded: rutinasLoaded,
    darkMode: darkMode,
    msg: msg,
  });

  return (
    <div
      style={{
        position: "relative",
        background: coachAluSurface,
        borderRadius: 12,
        padding: "14px 14px 12px",
        marginBottom: 10,
        border: isActive ? "1px solid #2563eb" : "1px solid " + coachAluBorderSoft,
        boxShadow: darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.08)",
      }}
    >
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{width:48,height:48,borderRadius:"50%",background:"#2563eb",color:"#fff",fontSize:20,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontFamily:"inherit"}}>
          {(a.nombre||a.email||"?").trim().charAt(0).toUpperCase()}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
            <span style={{fontSize:17,fontWeight:800,color:textMain,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{a.nombre}</span>
            <span style={{fontSize:11,fontWeight:800,padding:"2px 8px",borderRadius:6,background:badgeCfg.bg,color:badgeCfg.color}}>{badgeCfg.t}</span>
          </div>
          <div style={{fontSize:13,color:textMuted,lineHeight:1.4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{a.email}</div>
          {totalDays ? (
            <div style={{marginTop:10}}>
              <div style={{fontSize:12,fontWeight:700,color:textMuted,marginBottom:4}}>{doneDays}/{totalDays} {msg("días esta semana", "days this week")}</div>
              <div style={{height:6,background:coachAluTrack,borderRadius:4,overflow:"hidden"}}>
                <div style={{width: pct + "%", height: "100%", background: "#22c55e", borderRadius: 4, transition: "width .2s ease"}}/>
              </div>
            </div>
          ) : null}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,marginLeft:"auto"}}>
          <button
            className="hov"
            style={{background:"#3b82f6",color:"#fff",border:"none",borderRadius:10,padding:"8px 18px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}
            onClick={onVer}
          >{isActive ? msg("CERRAR", "CLOSE", "FECHAR") : msg("VER", "VIEW", "VER")}</button>
          <div style={{position:"relative"}}>
            <button
              type="button"
              className="hov"
              aria-label={msg("Más opciones", "More options")}
              style={{width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",background:coachAluSubtle,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:10,cursor:"pointer"}}
              onClick={onToggleMenu}
            >
              <Ic name="more-vertical" size={18} color="currentColor"/>
            </button>
            {isMenuOpen && (
              <StudentActionsMenu
                alumno={a}
                msg={msg}
                textMain={textMain}
                textMuted={textMuted}
                coachAluDropdown={coachAluDropdown}
                coachAluBorderSoft={coachAluBorderSoft}
                coachAluDropdownShadow={coachAluDropdownShadow}
                onEdit={onEdit}
                onChat={onChat}
                onClearProgress={onClearProgress}
                onDelete={onDelete}
              />
            )}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
