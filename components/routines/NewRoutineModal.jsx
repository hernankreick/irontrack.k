import React from 'react';
import { ROUTINE_TEMPLATES, instantiateTemplate, emptyDays, getTemplateById } from '../../lib/routineTemplates.js';

export default function NewRoutineModal({newR, setNewR, es, msg, lbl, inp, btn, textMuted, bgCard, bgSub, border, setRoutines, setAssignRoutineId, uid, toast2}) {
  if (!newR) return null;
  return (
        <div
          style={{
            position:"fixed",
            inset:0,
            background:"rgba(0,0,0,.9)",
            zIndex:120,
            overflowY:"auto",
            display:"flex",
            alignItems:"safe center",
            justifyContent:"center",
            boxSizing:"border-box",
            padding:"max(12px, env(safe-area-inset-top, 0px)) 16px max(12px, env(safe-area-inset-bottom, 0px))",
          }}
          onClick={()=>setNewR(null)}
        >
          <div style={{background:bgCard,margin:0,width:"100%",maxWidth:520,borderRadius:16,padding:"20px 16px",maxHeight:"min(85dvh, calc(100dvh - 32px))",overflowY:"auto",flexShrink:0}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:22,fontWeight:800,letterSpacing:1,marginBottom:4}}>{msg("Nueva rutina", "New routine")}</div>
            <div style={{fontSize:13,color:textMuted,marginBottom:14}}>{msg("Elegí una plantilla o en blanco. Podés afinar después.", "Pick a template or start blank. Refine anytime.")}</div>
            <span style={lbl}>{msg("INICIO RÁPIDO", "QUICK START")}</span>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:14,marginTop:6}}>
              <button type="button" className="hov" style={{...btn(newR.templateId==="blank"?"#2563EB":undefined),padding:"10px 14px",fontSize:14,fontWeight:700,borderRadius:12}} onClick={()=>setNewR(p=>({...p,templateId:"blank",numDays:p.numDays||3,days:emptyDays(p.numDays||3,es)}))}>
                {msg("En blanco", "Blank")}
              </button>
              {ROUTINE_TEMPLATES.map(function(T){
                var active=newR.templateId===T.id;
                return(
                  <button key={T.id} type="button" className="hov" style={{...btn(active?"#22C55E":undefined),padding:"10px 14px",fontSize:14,fontWeight:700,borderRadius:12,maxWidth:"100%",textAlign:"left"}} onClick={function(){
                    var tpl=getTemplateById(T.id);
                    if(!tpl) return;
                    setNewR(function(p){
                      return{...p,templateId:T.id,name:es?tpl.nameEs:tpl.nameEn,numDays:tpl.days.length,days:instantiateTemplate(tpl,es)};
                    });
                  }}>
                    {es?T.nameEs:T.nameEn}
                  </button>
                );
              })}
            </div>
            <div style={{marginBottom:10}}><span style={lbl}>{msg("NOMBRE", "NAME")}</span><input style={inp} value={newR.name} onChange={e=>setNewR(p=>({...p,name:e.target.value}))} placeholder={msg("Ej: PPL Juan", "E.g: John PPL")}/></div>
            {newR.templateId==="blank"&&(
              <div style={{marginBottom:10}}>
                <span style={lbl}>{msg("DÍAS", "DAYS")}</span>
                <div style={{display:"flex",gap:8}}>
                  {[1,2,3,4,5,6,7].map(n=>(
                    <button key={n} type="button" className="hov" style={{...btn(newR.numDays===n?"#2563EB":undefined),padding:"8px 0",flex:1,fontSize:18}} onClick={()=>setNewR(p=>({...p,numDays:n,days:emptyDays(n,es)}))}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {newR.templateId&&newR.templateId!=="blank"&&(
              <div style={{fontSize:13,color:textMuted,marginBottom:12,padding:"8px 10px",background:bgSub,borderRadius:10,border:"1px solid "+border}}>
                {(function(){
                  var T=getTemplateById(newR.templateId);
                  if(!T) return null;
                  var n=(newR.days||[]).length;
                  var ex=(newR.days||[]).reduce(function(a,d){return a+(d.exercises||[]).length;},0);
                  return(es?T.hintEs:T.hintEn)+" · "+n+(msg(" días · ", " days · "))+ex+(msg(" ejercicios", " exercises"));
                })()}
              </div>
            )}
            <button type="button" className="hov" style={{width:"100%",padding:"10px",marginBottom:12,background:"transparent",border:"1px dashed "+border,borderRadius:12,color:textMuted,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setNewR(p=>({...p,showAdvanced:!p.showAdvanced}))}>
              {newR.showAdvanced?(msg("▲ Menos opciones", "▲ Fewer options")):(msg("▼ Nota, alumno, nombres de día", "▼ Note, client, day names"))}
            </button>
            {newR.showAdvanced&&(
              <div style={{marginBottom:12}}>
                <div style={{marginBottom:8}}>
                  <span style={lbl}>{msg("NOTA (opcional)", "NOTE (optional)")}</span>
                  <input style={inp} value={newR.note||""} onChange={e=>setNewR(p=>({...p,note:e.target.value}))} placeholder={msg("Ej: Lun, Mie, Vie", "E.g. Mon, Wed, Fri")}/>
                </div>
                <div style={{marginBottom:8}}>
                  <span style={lbl}>{msg("ALUMNO (opcional)", "CLIENT (optional)")}</span>
                  <input style={inp} value={newR.alumno||""} onChange={e=>setNewR(p=>({...p,alumno:e.target.value}))} placeholder={msg("Asigná también desde la tarjeta del alumno", "Or assign from client card")}/>
                </div>
                <span style={lbl}>{msg("NOMBRE DE CADA DÍA", "NAME EACH DAY")}</span>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                  {(newR.days||[]).map(function(d,di){return(
                    <div key={"new-routine-day-"+di} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:13,fontWeight:700,color:textMuted,width:52,flexShrink:0}}>{msg("Día", "Day")} {di+1}</span>
                      <input style={{...inp,marginBottom:0,flex:1}} value={d.label||""} onChange={function(e){
                        var val=e.target.value;
                        setNewR(function(p){return{...p,days:p.days.map(function(dd,ddi){return ddi===di?{...dd,label:val}:dd})}});
                      }} placeholder={msg("Ej: Empuje, Pierna…", "E.g. Push, Legs…")}/>
                    </div>
                  )})}
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button type="button" className="hov" style={{...btn(),flex:1,padding:"10px"}} onClick={()=>setNewR(null)}>{msg("CANCELAR", "CANCEL")}</button>
              <button type="button" className="hov" style={{...btn("#2563EB"),flex:2,padding:"10px",fontSize:17,fontWeight:800}} onClick={()=>{
                if(!newR.name.trim()){toast2(msg("Pon un nombre", "Add a name"));return;}
                var payload={name:newR.name,numDays:newR.numDays,days:newR.days,note:newR.note||"",alumno:newR.alumno||"",collapsed:false};
                var newId=uid();
                setRoutines(p=>[...p,{...payload,id:newId,created:new Date().toLocaleDateString("es-AR")}]);
                setAssignRoutineId(newId);
                setNewR(null);
                toast2(msg("Rutina creada ✓", "Routine created ✓"));
              }}>{msg("CREAR", "CREATE")}</button>
            </div>
          </div>
        </div>
  );
}
