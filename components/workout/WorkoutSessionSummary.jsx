import React, { useRef } from 'react';
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
  allEx,
  videoOverrides,
  onClose,
  onShareImage,
}) {
  const cardRef = useRef(null);

  if (!resumenSesion) return null;

  return (
    <BaseModal
      open={!!resumenSesion}
      onClose={onClose}
      maxWidth={420}
      closeOnOutside={false}
      zIndex={10000}
      overlayStyle={{background:"#0A0F1A",alignItems:"flex-start",paddingTop:"calc(env(safe-area-inset-top, 0px) + 10px)",paddingRight:16,paddingBottom:"calc(env(safe-area-inset-bottom, 0px) + 20px)",paddingLeft:16,boxSizing:"border-box",overflowY:"auto",WebkitOverflowScrolling:"touch"}}
      contentStyle={{background:"transparent",borderRadius:0,padding:"18px 0 0",paddingBottom:"calc(20px + env(safe-area-inset-bottom, 0px))",width:"100%",maxWidth:440,maxHeight:"none",overflowY:"visible",WebkitOverflowScrolling:"touch",border:"none",textAlign:"left",animation:"fadeIn 0.25s ease",boxShadow:"none"}}
    >
      <SessionSummaryStatsPanel
        ref={cardRef}
        resumenSesion={resumenSesion}
        sessionPRList={sessionPRList}
        msg={msg}
        darkMode={darkMode}
        border={border}
        textMuted={textMuted}
        textMain={textMain}
        allEx={allEx}
        videoOverrides={videoOverrides}
      />

      <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:18}}>
        <button className="hov" style={{
          width:"100%",minHeight:50,padding:"13px 16px",borderRadius:16,border:"1px solid rgba(37,99,235,0.35)",cursor:"pointer",
          fontFamily:"inherit",fontSize:13,fontWeight:850,letterSpacing:0.6,
          background:"#2563EB",color:"#fff",
          boxShadow:"0 16px 34px rgba(37,99,235,0.24)",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8
        }} onClick={() => onShareImage({ node: cardRef.current, resumenSesion })}>
          <Ic name="upload" size={16}/> {msg("COMPARTIR / GUARDAR IMAGEN", "SHARE / SAVE IMAGE")}
        </button>
        <button className="hov" style={{width:"100%",minHeight:44,padding:"11px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:16,color:"#94A3B8",fontSize:14,fontWeight:750,cursor:"pointer",fontFamily:"inherit"}}
          onClick={onClose}>
          {msg("Cerrar", "Close")}
        </button>
      </div>
    </BaseModal>
  );
}
