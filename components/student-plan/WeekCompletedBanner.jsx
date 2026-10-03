import React from 'react';
import { getWeekGateTexts } from './weekGateTexts.js';

// Aviso del plan mientras la semana siguiente del programa todavia no esta disponible (gate "semana completada").
// Reemplaza al "¡Entrenamiento completado!" en ese estado para no mostrar dos avisos contradictorios.
function WeekCompletedBanner({ msg, textMuted, gate }) {
  const t = getWeekGateTexts(gate, msg);
  return (
    <div style={{
      background:"rgba(34,197,94,.08)",borderRadius:14,padding:"14px 16px",
      marginBottom:8,display:"flex",alignItems:"flex-start",gap:12,
      border:"1px solid rgba(34,197,94,.18)",
    }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{flexShrink:0}}>
        <circle cx="14" cy="14" r="13" fill="rgba(34,197,94,.15)"/>
        <path d="M8 14l4.5 4.5L20 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div>
        <div style={{fontSize:14,fontWeight:800,color:"#22C55E"}}>{t.badge}</div>
        <div style={{fontSize:12,color:textMuted}}>{t.body}</div>
        <div style={{fontSize:12,color:textMuted,marginTop:4,fontWeight:700}}>{t.nextLine} · {t.available}</div>
      </div>
    </div>
  );
}

export default WeekCompletedBanner;
