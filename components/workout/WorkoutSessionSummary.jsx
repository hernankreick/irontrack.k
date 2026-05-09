import React from 'react';
import BaseModal from '../modals/BaseModal.jsx';
import { Ic } from '../Ic.jsx';
import SessionSummaryStatsPanel from '../student-plan/SessionSummaryStatsPanel.jsx';

export default function WorkoutSessionSummary({
  resumenSesion,
  sessionPRList,
  msg,
  darkMode,
  bgCard,
  border,
  textMuted,
  textMain,
  onClose,
  onShareImage,
}) {
  if (!resumenSesion) return null;

  return (
    <BaseModal
      open={!!resumenSesion}
      onClose={onClose}
      maxWidth={420}
      closeOnOutside={false}
      zIndex={10000}
      overlayStyle={{background:"rgba(0,0,0,.92)",alignItems:"flex-start",paddingTop:"calc(env(safe-area-inset-top, 0px) + 12px)",paddingRight:16,paddingBottom:"calc(env(safe-area-inset-bottom, 0px) + 24px)",paddingLeft:16,boxSizing:"border-box",overflowY:"auto",WebkitOverflowScrolling:"touch"}}
      contentStyle={{background:bgCard,borderRadius:20,padding:"28px 20px",paddingBottom:"calc(28px + env(safe-area-inset-bottom, 0px))",width:"100%",maxWidth:420,maxHeight:"calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 36px)",overflowY:"auto",WebkitOverflowScrolling:"touch",border:"1px solid "+border,textAlign:"center",animation:"fadeIn 0.25s ease"}}
    >
      <SessionSummaryStatsPanel
        resumenSesion={resumenSesion}
        sessionPRList={sessionPRList}
        msg={msg}
        darkMode={darkMode}
        border={border}
        textMuted={textMuted}
        textMain={textMain}
      />

      <button className="hov" style={{width:"100%",padding:"12px",background:darkMode?"#162234":"#E2E8F0",border:"none",borderRadius:12,color:textMuted,fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}
        onClick={onClose}>
        {msg("Cerrar", "Close")}
      </button>
      <div style={{marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8,textAlign:"center"}}>{msg("COMPARTIR ENTRENAMIENTO", "SHARE WORKOUT")}</div>
        <button className="hov" style={{
          width:"100%",padding:"16px",borderRadius:12,border:"none",cursor:"pointer",
          fontFamily:"inherit",fontSize:15,fontWeight:900,letterSpacing:1,
          background:"linear-gradient(135deg,#FF3B30,#FF6B35)",color:"#fff",
          boxShadow:"0 4px 14px rgba(59,130,246,0.35)"
        }} onClick={onShareImage}>
          <Ic name="upload" size={16}/> {msg("COMPARTIR / GUARDAR IMAGEN", "SHARE / SAVE IMAGE")}
        </button>
      </div>
    </BaseModal>
  );
}
