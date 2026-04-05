import { Ic } from './Ic.jsx';

export function ExerciseCard({
  ex,
  info,
  es,
  darkMode,
  border,
  textMain,
  textMuted,
  bgSub,
  fmtP,
  canUp,
  canDown,
  onMoveUp,
  onMoveDown,
  onEdit,
  onRemove,
}) {
  return (
    <div style={{background:darkMode?"#162234":"#E2E8F0",borderRadius:12,padding:"16px 18px",marginBottom:4,border:"1px solid "+border}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <div style={{display:"flex",flexDirection:"column",gap:1,flexShrink:0}}>
          <button className="hov" style={{background:canUp?"#2D4057":"#162234",border:"none",borderRadius:4,padding:"2px 5px",fontSize:11,color:canUp?"#8B9AB2":"#2D4057",cursor:canUp?"pointer":"default",lineHeight:1}} onClick={onMoveUp}>▲</button>
          <button className="hov" style={{background:canDown?"#2D4057":"#162234",border:"none",borderRadius:4,padding:"2px 5px",fontSize:11,color:canDown?"#8B9AB2":"#2D4057",cursor:canDown?"pointer":"default",lineHeight:1}} onClick={onMoveDown}>▼</button>
        </div>
        <div style={{width:3,alignSelf:"stretch",borderRadius:2,background:border,flexShrink:0,minHeight:32}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:22,fontWeight:900,color:textMain,lineHeight:1.2}}>{es?info?.name:info?.nameEn||info?.name}</div>
          {(ex.sets||ex.reps)&&(
            <div style={{display:"flex",gap:8,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
              {(ex.sets||ex.reps) ? (
                <span style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:800,letterSpacing:0.5}}>
                  {ex.sets||"—"}×{ex.reps||"—"}
                </span>
              ) : (
                <span style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700}}>
                  {es?"Sin series":"No sets"}
                </span>
              )}
              {ex.kg&&(
                <span style={{background:bgSub,color:textMuted,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700}}>
                  {ex.kg}kg
                </span>
              )}
              {ex.pause&&parseInt(ex.pause)>0&&(
                <span style={{background:bgSub,color:textMuted,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700,display:"inline-flex",alignItems:"center",gap:4}}>
                  <Ic name="clock" size={14} color={textMuted}/>{fmtP(ex.pause)}
                </span>
              )}
              {ex.progresion&&ex.progresion!=="manual"&&(
                <span style={{
                  background:ex.progresion==="carga"?"#1a3a5c":ex.progresion==="reps"?"#0c2a1a":ex.progresion==="series"?"#1e1040":"#2a1f0a",
                  color:ex.progresion==="carga"?"#60a5fa":ex.progresion==="reps"?"#4ade80":ex.progresion==="series"?"#a78bfa":"#fbbf24",
                  borderRadius:6,padding:"4px 8px",fontSize:11,fontWeight:700,border:"none"
                }}>
                  {ex.progresion==="carga"?"↑ CARGA":ex.progresion==="reps"?"↑ REPS":ex.progresion==="series"?"↑ SERIES":"↓ PAUSA"}
                </span>
              )}
            </div>
          )}
        </div>
        <button className="hov" style={{background:darkMode?"#162234":"#E2E8F0",border:"none",borderRadius:8,padding:"4px 8px",fontSize:13,color:textMuted,cursor:"pointer"}} onClick={onEdit}><Ic name="edit-2" size={15}/></button>
        <button className="hov" style={{background:"#2563EB22",border:"none",borderRadius:6,padding:"4px 9px",fontSize:13,color:"#2563EB",cursor:"pointer",fontWeight:700}} onClick={onRemove}><Ic name="trash-2" size={15}/></button>
      </div>
      {info?.youtube&&(
        <div style={{paddingLeft:40,marginTop:4}}>
          <a href={info.youtube} target="_blank" rel="noreferrer"
            style={{background:bgSub,color:textMuted,border:"1px solid "+border,borderRadius:6,padding:"4px 8px",fontSize:13,fontWeight:700,textDecoration:"none"}}>
            ▶ VIDEO
          </a>
        </div>
      )}
      {(ex.weeks||[]).length>0&&(
        <div style={{marginTop:8,paddingLeft:34}}>
          <div style={{display:"flex",gap:4,overflowX:"auto"}}>
            {ex.weeks.map((w,wi)=>{
              const prev = wi>0?ex.weeks[wi-1]:null;
              const m = ex.progresion||"manual";
              let delta = null;
              if(prev&&m==="carga"&&w.kg&&prev.kg) delta=(parseFloat(w.kg)-parseFloat(prev.kg)>0?"+":"")+Math.round((parseFloat(w.kg)-parseFloat(prev.kg))*10)/10+"kg";
              if(prev&&m==="reps"&&w.reps&&prev.reps) delta=(parseInt(w.reps)-parseInt(prev.reps)>0?"+":"")+(parseInt(w.reps)-parseInt(prev.reps))+"r";
              if(prev&&m==="series"&&w.sets&&prev.sets) delta=(parseInt(w.sets)-parseInt(prev.sets)>0?"+":"")+(parseInt(w.sets)-parseInt(prev.sets))+"s";
              if(prev&&m==="pausa"&&w.pausa&&prev.pausa) delta=(parseInt(w.pausa)-parseInt(prev.pausa)>0?"+":"")+(parseInt(w.pausa)-parseInt(prev.pausa))+"s";
              return(
                <div key={wi} style={{background:bgSub,borderRadius:8,padding:"8px 8px",fontSize:12,color:textMuted,flexShrink:0,minWidth:56,textAlign:"center",border:"1px solid "+border}}>
                  <div style={{fontWeight:700,color:textMain,marginBottom:2}}>S{wi+1}</div>
                  <div style={{fontSize:11}}>{w.sets||ex.sets||"—"}×{w.reps||ex.reps||"—"}</div>
                  {(w.kg||ex.kg)&&<div style={{fontSize:11,color:"#60a5fa"}}>{w.kg||ex.kg}kg</div>}
                  {w.pausa&&<div style={{fontSize:10,color:textMuted,display:"flex",alignItems:"center",gap:3,justifyContent:"center"}}><Ic name="clock" size={10} color={textMuted}/>{w.pausa}s</div>}
                  {delta&&<div style={{fontSize:10,color:"#4ade80",fontWeight:700,marginTop:2}}>{delta}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
