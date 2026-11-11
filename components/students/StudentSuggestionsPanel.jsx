import React from 'react';
import { Ic } from '../Ic.jsx';

// P0-3: sugerencias de carga ORIENTATIVAS, solo en la interfaz del entrenador. «Revisar ejercicio» abre el editor con los valores
// actuales: nada se cambia ni se guarda sin que el entrenador lo haga. Las de «datos insuficientes» se agrupan al final.
export default function StudentSuggestionsPanel({
  alumno,
  rutinaAsignada,
  sugerencias = [],
  isOpen,
  msg,
  textMain,
  textMuted,
  bgSub,
  border,
  onToggle,
  onApplySuggestion,
  onIgnoreSuggestion,
}) {
  if(!rutinaAsignada || sugerencias.length === 0) return null;
  const accionables = sugerencias.filter(function(s){ return s.tipo !== "insuficiente"; });
  const insuficientes = sugerencias.filter(function(s){ return s.tipo === "insuficiente"; });
  // sin ningún registro todavía (rutina recién asignada): como antes, no se muestra el panel
  if(accionables.length === 0 && insuficientes.every(function(s){ return s.motivo === "sin_historial"; })) return null;

  const colores = {
    subir: {icon:(<Ic name="trending-up" size={16} color="#22C55E"/>),bg:"#22C55E12",border:"#22C55E33",color:"#22C55E",btnBg:"#22C55E"},
    evaluar_reduccion: {icon:(<Ic name="trending-up" size={16} color="#F59E0B" style={{transform:"rotate(180deg)"}}/>),bg:"#F59E0B12",border:"#F59E0B33",color:"#F59E0B",btnBg:"#B45309"},
    mantener: {icon:(<Ic name="chevron-right" size={16} color={textMuted}/>),bg:bgSub,border:border,color:textMuted,btnBg:"#2563EB"}
  };

  return (
    <div style={{marginTop:12,marginBottom:8}}>
      <button
        type="button"
        className="hov"
        onClick={onToggle}
        style={{
          width:"100%",
          background:bgSub,
          border:"1px solid "+border,
          borderRadius:12,
          padding:"10px 12px",
          cursor:"pointer",
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          gap:10
        }}
      >
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <Ic name="info" size={16} color="#F59E0B"/>
          <div style={{fontSize:11,fontWeight:800,color:"#F59E0B",letterSpacing:2,textTransform:"uppercase"}}>{msg("SUGERENCIAS", "SUGGESTIONS")}</div>
          <span style={{fontSize:12,fontWeight:800,color:textMuted,background:"#F59E0B12",border:"1px solid #F59E0B33",borderRadius:999,padding:"2px 8px"}}>{accionables.length}</span>
        </div>
        <Ic
          name="chevron-right"
          size={18}
          color={textMuted}
          style={{transition:"transform .18s ease", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"}}
        />
      </button>
      {isOpen && (
        <div style={{marginTop:10,maxHeight:320,overflowY:"auto",paddingRight:4}}>
          <div style={{fontSize:12,color:textMuted,margin:"0 2px 8px",lineHeight:1.4}}>{msg("Orientativas, según las sesiones registradas. No cambian la rutina.", "For guidance, based on logged sessions. They don't change the routine.")}</div>
          {accionables.map(function(sug,si){
            var c = colores[sug.tipo] || colores.mantener;
            var sugKey = alumno.id+"-sug-"+(sug.exId||"ex")+"-"+sug.dIdx+"-"+sug.eIdx+"-"+sug.tipo;
            return (
              <div key={sugKey} id={sugKey} style={{background:c.bg,border:"1px solid "+c.border,borderRadius:12,padding:"12px",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <div style={{flexShrink:0,marginTop:1}}>{c.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:c.color,marginBottom:2}}>{sug.nombre}</div>
                    <div style={{fontSize:14,fontWeight:700,color:textMain}}>{sug.accion}</div>
                    <div style={{fontSize:12,color:textMuted,marginTop:2,display:"flex",alignItems:"center",gap:4}}>
                      <Ic name="chevron-right" size={12} color={textMuted}/>
                      {sug.ajuste}
                    </div>
                    {sug.evidencia ? <div style={{fontSize:11.5,color:textMuted,marginTop:4}}>{msg("Sesiones: ", "Sessions: ") + sug.evidencia}</div> : null}
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                      <button className="hov" onClick={function(){onApplySuggestion(sug);}} style={{minHeight:44,padding:"5px 14px",background:c.btnBg,color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>{msg("REVISAR EJERCICIO", "REVIEW EXERCISE")}</button>
                      <button className="hov" onClick={function(){onIgnoreSuggestion(sugKey);}} style={{minHeight:44,padding:"5px 14px",background:"transparent",color:textMuted,border:"1px solid "+border,borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{msg("IGNORAR", "IGNORE")}</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {insuficientes.length ? (
            <details style={{margin:"4px 2px 0"}}>
              <summary style={{cursor:"pointer",minHeight:44,display:"flex",alignItems:"center",fontSize:12,fontWeight:700,color:textMuted}}>{msg("Datos insuficientes", "Not enough data") + " (" + insuficientes.length + ")"}</summary>
              <ul style={{margin:"4px 0 0",padding:"0 0 0 16px",fontSize:12,color:textMuted,lineHeight:1.5}}>
                {insuficientes.map(function(sug){
                  return <li key={alumno.id+"-insuf-"+(sug.exId||"ex")+"-"+sug.dIdx+"-"+sug.eIdx+"-"+sug.bloque}><b style={{color:textMain}}>{sug.nombre}</b>{": " + sug.ajuste}</li>;
                })}
              </ul>
            </details>
          ) : null}
        </div>
      )}
    </div>
  );
}
