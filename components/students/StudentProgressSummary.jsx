import React from 'react';

export default function StudentProgressSummary({
  alumno,
  rutinaAsignada,
  progresoSemanal,
  dias = [],
  diasCompletados,
  pctBar,
  proxTxt,
  darkMode,
  msg,
  textMain,
  textMuted,
  coachAluTrack,
}) {
  return (
    <>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <span style={{fontSize:14,fontWeight:700,color:textMain}}>{diasCompletados} {msg("de", "of")} {dias.length} {msg("días completados", "days completed")}</span>
          <span style={{fontSize:15,fontWeight:800,color:"#22c55e"}}>{pctBar}%</span>
        </div>
        <div style={{height:12,background:coachAluTrack,borderRadius:8,overflow:"hidden"}}>
          <div style={{width:pctBar+"%",height:"100%",background:"linear-gradient(90deg,#22c55e,#16a34a)",borderRadius:8,transition:"width .25s ease"}}/>
        </div>
      </div>
      <div style={{marginBottom:14,padding:"10px 12px",background:darkMode?"rgba(59,130,246,0.06)":"rgba(37,99,235,0.06)",border:"1px solid "+(darkMode?"rgba(59,130,246,0.2)":"rgba(37,99,235,0.2)"),borderRadius:10}}>
        <span style={{fontSize:13,color:textMuted,fontWeight:600}}>{msg("Próxima sesión:", "Next session:")} </span>
        <span style={{fontSize:13,color:textMain,fontWeight:700}}>{proxTxt}</span>
      </div>
    </>
  );
}
