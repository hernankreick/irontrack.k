import React from 'react';

function SessionSummaryStatsPanel({
  resumenSesion,
  sessionPRList,
  msg,
  darkMode,
  border,
  textMuted,
  textMain,
}) {
  return (
    <>
      <div style={{fontSize:48,marginBottom:4}}>💪</div>
      <div style={{fontSize:28,fontWeight:900,letterSpacing:1,marginBottom:4}}>ENTRENAMIENTO</div>
      <div style={{fontSize:28,fontWeight:900,letterSpacing:1,color:"#2563EB",marginBottom:4}}>COMPLETADO</div>
      <div style={{fontSize:13,color:textMuted,marginBottom:24}}>{resumenSesion.diaLabel} · {resumenSesion.rutinaName} · {resumenSesion.fecha}</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        {[
          ["⏱",msg("DURACIÓN", "DURATION"),resumenSesion.durMin+" min","#2563EB"],
          ["🏋️",msg("EJERCICIOS", "EXERCISES"),resumenSesion.ejercicios,"#2563EB"],
          ["⚖️",msg("KG LEVANTADOS", "KG LIFTED"),resumenSesion.volTotal.toLocaleString()+" kg","#60A5FA"],
          [resumenSesion.prsNuevos>0?"🏆":"✓",msg("RÉCORD PERSONAL", "PERSONAL RECORD"),resumenSesion.prsNuevos>0?(resumenSesion.prsNuevos+" PR!"):(msg("Sin PR", "No PR")),resumenSesion.prsNuevos>0?"#60A5FA":"#8B9AB2"],
        ].map(([icon,label,val,color])=>(
          <div key={label} style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:12,padding:"8px 12px 10px",border:"1px solid "+border}}>
            <div style={{fontSize:18}}>{icon}</div>
            <div style={{fontSize:18,fontWeight:700,color,marginTop:4}}>{val}</div>
            <div style={{fontSize:11,fontWeight:400,color:textMuted,letterSpacing:0.3,marginTop:4}}>{label}</div>
          </div>
        ))}
      </div>

      {resumenSesion.prsNuevos>0&&(
        <div style={{background:"#fbbf2412",border:"1px solid #fbbf2444",borderRadius:12,padding:"12px",marginBottom:16}}>
          <div style={{fontSize:28,marginBottom:4}}>🏆</div>
          <div style={{fontSize:18,fontWeight:800,color:"#fbbf24",marginBottom:8}}>
            {resumenSesion.prsNuevos} nuevo{resumenSesion.prsNuevos>1?"s":""} PR!
          </div>
          {sessionPRList.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {sessionPRList.map(function(pr,pi){return(
                <div key={pi} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"6px 10px"}}>
                  <span style={{fontSize:13,fontWeight:700,color:textMain}}>{pr.ejercicio}</span>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:15,fontWeight:900,color:"#fbbf24"}}>{pr.kg}kg</span>
                    <span style={{fontSize:11,fontWeight:700,color:"#22C55E"}}>+{pr.diff}kg</span>
                  </div>
                </div>
              )})}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default SessionSummaryStatsPanel;
