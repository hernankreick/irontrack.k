import React, { useRef, useState } from 'react';
import BaseModal from '../modals/BaseModal.jsx';
import { resolveExerciseTitle } from '../../lib/exerciseResolve.js';
import ProgressionWeeksEditor from './ProgressionWeeksEditor.jsx';
import { initWeeksFull, detectWeekCount, ensureWeeks, weeksForSave } from './progressionEditorLogic.js';

function EditExModal({editEx, btn, inp, es, onSave, onClose, PATS, darkMode, allEx, msg}) {
  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#162234":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";

  const inf = (allEx||[]).find(e=>e.id===editEx.ex.id);
  const nombre = resolveExerciseTitle(inf || null, editEx.ex, es);
  const safePATS = PATS||{};
  const pat = safePATS[inf?.pattern] || safePATS["core"] || Object.values(safePATS)[0] || {color:"#2563EB",icon:"E",label:"Ejercicio"};
  const METODOS = [
    {id:"carga",  label:"+ Carga",   desc:"Subir kg c/semana",  color:"#2563EB"},
    {id:"reps",   label:"+ Reps",    desc:"Más reps, mismo peso",color:"#22C55E"},
    {id:"series", label:"+ Series",  desc:"Más series c/semana", color:"#8B5CF6"},
    {id:"pausa",  label:"− Pausa",   desc:"Reducir descanso",    color:"#F59E0B"},
    {id:"manual", label:"Manual",    desc:"Definís vos c/semana",color:"#8B9AB2"},
  ];
  const [sets, setSets] = useState(editEx.ex.sets||"3");
  const [reps, setReps] = useState(editEx.ex.reps||"8-10");
  const [kg, setKg] = useState(editEx.ex.kg||"");
  const [pause, setPause] = useState(editEx.ex.pause||90);
  // Todas las semanas guardadas (aunque superen el selector) viven en `weeks`; `weekCount` es lo que se muestra y se guarda.
  const [weeks, setWeeks] = useState(()=>initWeeksFull(editEx.ex.weeks));
  const initialWeekCount = useRef(detectWeekCount(editEx.ex.weeks)).current;
  const [weekCount, setWeekCount] = useState(initialWeekCount);
  const [progresion, setProgresion] = useState(editEx.ex.progresion||"manual");

  const color = pat?.color||"#2563EB";

  return (
    <BaseModal
      open={!!editEx}
      onClose={onClose}
      maxWidth={1080}
      closeOnOutside={false}
      closeOnEscape={false}
      ariaLabel={msg("Editar ejercicio", "Edit exercise") + ": " + nombre}
      zIndex={210}
      overlayStyle={{
        background:"rgba(0,0,0,.92)",
        overflowY:"auto",
        WebkitOverflowScrolling:"touch",
        padding:"max(12px, env(safe-area-inset-top, 0px)) 16px max(12px, env(safe-area-inset-bottom, 0px))",
      }}
      contentStyle={{
        background:bgCard,
        color:textMain,
        width:"100%",
        borderRadius:16,
        padding:"20px 16px",
        maxHeight:"calc(100dvh - 32px)",
        overflowY:"auto",
        border:"1px solid "+border,
        boxSizing:"border-box",
      }}
    >
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:36,height:36,borderRadius:8,background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:color,flexShrink:0}}>{pat?.icon||"·"}</div>
          <div style={{fontSize:22,fontWeight:800,flex:1,color:textMain}}>{nombre}</div>
          <button type="button" className="hov" aria-label={msg("Cerrar", "Close")} style={{...btn(),fontSize:22,padding:"4px 8px"}} onClick={onClose}>x</button>
        </div>

        <div style={{fontSize:13,fontWeight:700,letterSpacing:0.3,color:textMuted,marginBottom:8}}>CONFIGURACION BASE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>SERIES</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={sets} onChange={e=>setSets(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>REPS</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={reps} onChange={e=>setReps(e.target.value)}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>KG</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={kg} onChange={e=>setKg(e.target.value)} placeholder="-"/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,marginBottom:4}}>PAUSA</div>
            <input style={{...inp,padding:"8px 6px",fontSize:15,textAlign:"center"}} value={pause} onChange={e=>setPause(e.target.value)} placeholder="seg"/>
          </div>
        </div>

                <div style={{fontSize:12,fontWeight:700,letterSpacing:0.5,color:textMuted,marginBottom:8}}>{msg("MÉTODO DE PROGRESIÓN", "PROGRESSION METHOD")}</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>
          {METODOS.map(m=>(
            <button key={m.id} className="hov" onClick={()=>setProgresion(m.id)}
              style={{padding:"8px 12px",borderRadius:8,border:"1px solid "+(progresion===m.id?m.color:"#2D4057"),
                background:progresion===m.id?m.color+"22":"transparent",
                color:progresion===m.id?m.color:textMuted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
              {m.label}
            </button>
          ))}
        </div>
        {progresion!=="manual"&&(
          <div style={{background:_dm?"#162234":"#EEF2F7",borderRadius:8,padding:"8px 12px",marginBottom:12,fontSize:12,color:textMuted}}>
            {METODOS.find(m=>m.id===progresion)?.desc} — completá los valores de cada semana abajo
          </div>
        )}
        <ProgressionWeeksEditor
          weeks={weeks} count={weekCount} initialCount={initialWeekCount}
          onWeeksChange={setWeeks}
          onCountChange={(n)=>{ setWeeks(prev=>ensureWeeks(prev,n)); setWeekCount(n); }}
          base={{sets,reps,kg,pause}} method={progresion}
          theme={{bg, input:bg, card:bgCard, border, text:textMain, muted:textMuted, accent:"#2563EB"}}
        />
<div style={{display:"flex",gap:8,marginTop:8}}>
          <button className="hov" style={{...btn(),flex:1,padding:"8px"}} onClick={onClose}>CANCELAR</button>
          <button className="hov" style={{...btn("#2563EB"),flex:2,padding:"8px",fontSize:18}} onClick={()=>onSave({...editEx.ex,sets,reps,kg,pause,weeks:weeksForSave(weeks,weekCount,pause),progresion})}>
            GUARDAR
          </button>
        </div>
    </BaseModal>
  );
}

export default EditExModal;
