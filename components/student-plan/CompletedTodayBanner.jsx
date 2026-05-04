import React from 'react';

function CompletedTodayBanner({ msg, textMuted }) {
  return (
    <div style={{
      background:"rgba(34,197,94,.08)",borderRadius:14,padding:"14px 16px",
      marginBottom:8,display:"flex",alignItems:"center",gap:12,
      border:"1px solid rgba(34,197,94,.18)",
    }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="13" fill="rgba(34,197,94,.15)"/>
        <path d="M8 14l4.5 4.5L20 9" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <div>
        <div style={{fontSize:14,fontWeight:800,color:"#22C55E"}}>{msg("¡Entrenamiento completado!", "Workout done!")}</div>
        <div style={{fontSize:12,color:textMuted}}>{msg("Buen trabajo, descansá.", "Great work, rest up.")}</div>
      </div>
    </div>
  );
}

export default CompletedTodayBanner;
