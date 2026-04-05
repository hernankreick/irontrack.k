import React from 'react';
import { WorkoutExercisePanel } from './WorkoutExercisePanel.jsx';
import { normalizeFecha } from '../lib/normalizeFecha.js';

export function WorkoutScreen(props) {
  const {session, activeDay, activeR, allEx, progress, logSet, startTimer, timer, setSession, setCompletedDays, completedDays, currentWeek, setCurrentWeek, preSessionPRs, setResumenSesion, readOnly, sharedParam, sb, es, darkMode, prCelebration, setPrCelebration, activeExIdx, setActiveExIdx, sessionData, onSesionGuardada, sessionPRList, videoOverrides, setVideoModal} = props;

  const _dm = typeof darkMode !== "undefined" ? darkMode : true;
  const bg = _dm?"#0F1923":"#F0F4F8";
  const bgCard = _dm?"#1E2D40":"#FFFFFF";
  const bgSub = _dm?"#162234":"#EEF2F7";
  const border = _dm?"#2D4057":"#E2E8F0";
  const textMain = _dm?"#FFFFFF":"#0F1923";
  const textMuted = _dm?"#8B9AB2":"#64748B";
  const green = _dm?"#22C55E":"#16A34A";
  const greenSoft = _dm?"rgba(34,197,94,0.12)":"rgba(22,163,74,0.1)";
  const greenBorder = _dm?"rgba(50,215,75,0.25)":"rgba(26,158,53,0.25)";

  const hoy = new Date().toLocaleDateString("es-AR");
  const exercises = activeDay?.exercises||[];
  const ex = exercises[activeExIdx];
  const info = ex ? allEx.find(e=>e.id===ex.id) : null;
  const pat = info ? ({"empuje":{icon:"E",color:"#2563EB"},"traccion":{icon:"🔄",color:"#2563EB"},
    "rodilla":{icon:"R",color:"#22C55E"},"bisagra":{icon:"B",color:"#8B9AB2"},
    "core":{icon:"M",color:"#8B9AB2"},"movilidad":{icon:"M",color:"#2563EB"}}[info?.pattern]||{icon:"E",color:"#8B9AB2"}) : {icon:"E",color:"#8B9AB2"};

  // Sets registrados hoy para el ejercicio activo
  const setsHoy = ex ? (progress[ex.id]?.sets||[]).filter(s=>s.date===hoy&&(s.week===undefined||s.week===currentWeek)) : [];
  const totalSets = parseInt(ex?.sets)||3;
  const setsRestantes = Math.max(0, totalSets - setsHoy.length);
  const setActualNum = setsHoy.length + 1;
  const ultimoSet = setsHoy[0];
  const pr = ex ? (progress[ex.id]?.max||0) : 0;

  // Calcular progreso total
  const totalExDone = exercises.filter(e=>(progress[e.id]?.sets||[]).some(s=>s.date===hoy)).length;
  const pct = exercises.length>0 ? (totalExDone/exercises.length)*100 : 0;

  // Funcion finalizar (igual que antes)
  const finalizarSesion = async () => {
    const r = activeR;
    const dayKey = session.rId+"-"+session.dIdx+"-w"+currentWeek;
    const newCompleted = completedDays.includes(dayKey)?completedDays:[...completedDays,dayKey];
    const totalDays = r?r.days.length:1;
    const daysThisWeek = newCompleted.filter(k=>k.startsWith(session.rId+"-")&&k.endsWith("-w"+currentWeek)).length;
    setCompletedDays(newCompleted);
    const semanaParaGuardar = currentWeek + 1;
    const durMin = Math.round((Date.now()-(session.startTime||Date.now()))/60000)||1;
    const exsCompleted = [...(activeDay?.warmup||[]), ...(exercises||[])];
    const hoyFin = new Date().toLocaleDateString("es-AR");
    const volTotal = exsCompleted.reduce((acc,ex2)=>{
      const s=(progress[ex2.id]?.sets||[]).filter(s=>s.date===hoyFin);
      return acc+s.reduce((a,s2)=>a+(s2.kg||0)*(s2.reps||0),0);
    },0);
    const prsNuevos = exsCompleted.filter(ex2=>{
      const pg=progress[ex2.id];
      if(!pg) return false;
      const sHoy=(pg.sets||[]).filter(s=>s.date===hoyFin);
      if(!sHoy.length) return false;
      const maxHoy=Math.max(...sHoy.map(s2=>s2.kg||0));
      if(maxHoy<=0) return false;
      return maxHoy > (preSessionPRs[ex2.id]||0);
    }).length;
    setResumenSesion({durMin,ejercicios:exsCompleted.length,
      totalSets:exsCompleted.reduce((a,e)=>a+(parseInt(e.sets)||3),0),
      volTotal:Math.round(volTotal),prsNuevos,
      diaLabel:activeDay.label||("Dia "+(session.dIdx+1)),
      rutinaName:r?.name||"Entrenamiento",fecha:hoyFin});
    setSession(null);
    // Guardar sesión — alumno con link
    if(readOnly&&sharedParam){try{
      const rutData=JSON.parse(atob(sharedParam));
      if(rutData.alumnoId){
        const existentes=await sb.getSesiones(rutData.alumnoId);
        const yaExiste=(existentes||[]).some(function(s){return normalizeFecha(s.fecha)===normalizeFecha(hoyFin)&&s.dia_idx===session.dIdx&&s.semana===semanaParaGuardar});
        if(!yaExiste){
          sb.addSesion({alumno_id:rutData.alumnoId,rutina_nombre:r?.name||"",
            dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,
            semana:semanaParaGuardar,ejercicios:exercises.map(function(e){return e.id}).join(","),
            fecha:hoyFin,hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})});
        }
      }
    }catch(e){}}
    // Guardar sesión — alumno logueado
    if(!readOnly && sessionData?.role==="alumno" && sessionData?.alumnoId) {
      try {
        const existentes=await sb.getSesiones(sessionData.alumnoId);
        const yaExiste=(existentes||[]).some(function(s){return normalizeFecha(s.fecha)===normalizeFecha(hoyFin)&&s.dia_idx===session.dIdx&&s.semana===semanaParaGuardar});
        if(!yaExiste){
          var resSesion=await sb.addSesion({
            alumno_id:sessionData.alumnoId,rutina_id:r?.id||null,rutina_nombre:r?.name||"",
            dia_label:activeDay.label||("Dia "+(session.dIdx+1)),dia_idx:session.dIdx,
            semana:semanaParaGuardar,ejercicios:exercises.map(function(e){return e.id}).join(","),
            fecha:hoyFin,hora:new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})
          });
          if(resSesion&&resSesion[0])console.log('[addSesion] OK:',resSesion[0].id);
          if(typeof onSesionGuardada==='function')onSesionGuardada();
        }
      } catch(e){console.error('[addSesion]',e);}
    }
    // Avanzar semana solo si completó TODOS los días Y no es el mismo día real
    var lastAdvance=localStorage.getItem('it_last_week_advance_date');
    var todayStr=new Date().toDateString();
    if(daysThisWeek >= totalDays && currentWeek < 3 && lastAdvance !== todayStr){
      setCompletedDays(prev=>prev.filter(k=>!k.endsWith("-w"+currentWeek)));
      setCurrentWeek(currentWeek + 1);
      localStorage.setItem('it_last_week_advance_date',todayStr);
    }
  };

  const nextEx = exercises[activeExIdx+1];
  const nextInfo = nextEx ? allEx.find(e=>e.id===nextEx.id) : null;

  return (
    <div style={{position:"fixed",inset:0,background:bg,zIndex:80,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:bgCard,borderBottom:"2px solid #3B82F6",padding:"8px 16px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <button className="hov" onClick={()=>{
            if(window.confirm(es?"¿Salir del entrenamiento? Perderás los sets no guardados.":"Exit workout? Unsaved sets will be lost.")){
              setSession(null);
            }
          }}
            style={{background:"transparent",border:"none",color:textMuted,fontSize:22,padding:"0 4px",cursor:"pointer"}}>←</button>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:700,color:"#2563EB",letterSpacing:2}}>{es?"ENTRENANDO":"TRAINING"}</div>
            <div style={{fontSize:15,fontWeight:900,color:textMain}}>{activeR?.name} — {activeDay.label||("Día "+(session.dIdx+1))}</div>
          </div>
          <div style={{fontSize:13,fontWeight:900,color:"#2563EB",background:"#2D4057",borderRadius:20,padding:"4px 12px",border:"1px solid #243040"}}>
            {totalExDone}/{exercises.length}
          </div>
        </div>
        <div style={{height:4,background:_dm?"#2D4057":"#E2E8F0",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:pct+"%",background:"#2563EB",borderRadius:2,transition:"width .5s ease"}}/>
        </div>
      </div>
      {timer&&(
        <div style={{background:"#22C55E18",borderBottom:"1px solid #22c55e33",padding:"8px 16px",
          display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:"50%",border:"3px solid #22c55e",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#22C55E",
            background:timer.remaining<10?"#2D4057":"transparent",borderColor:timer.remaining<10?"#2563EB":"#22C55E",
            color:timer.remaining<10?"#2563EB":"#22C55E"}}>
            {timer.remaining}
          </div>
          <div style={{flex:1,fontSize:15,fontWeight:700,color:textMuted}}>{es?"Descansando...":"Resting..."}</div>
          <button className="hov" onClick={()=>startTimer(0)}
            style={{background:"transparent",border:"1px solid "+border,borderRadius:8,padding:"4px 12px",
              color:textMuted,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {es?"Saltar":"Skip"}
          </button>
        </div>
      )}
      <div style={{display:"flex",gap:4,padding:"8px 16px 0",flexShrink:0,overflowX:"auto"}}>
        {exercises.map((e,i)=>{
          const done=(progress[e.id]?.sets||[]).filter(s=>s.date===hoy).length>=(parseInt(e.sets)||3);
          const active=i===activeExIdx;
          return(
            <button key={i} onClick={()=>setActiveExIdx(i)}
              style={{flexShrink:0,width:active?32:10,height:10,borderRadius:6,border:"none",cursor:"pointer",
                background:done?"#22C55E":active?"#2563EB":(darkMode?"#2D4057":"#2D4057"),
                transition:"all .25s ease"}}>
            </button>
          );
        })}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px 0",WebkitOverflowScrolling:"touch"}}>

        {ex&&(
          <WorkoutExercisePanel
            activeExIdx={activeExIdx}
            setActiveExIdx={setActiveExIdx}
            exercises={exercises}
            ex={ex}
            info={info}
            pat={pat}
            setsHoy={setsHoy}
            totalSets={totalSets}
            setsRestantes={setsRestantes}
            setActualNum={setActualNum}
            ultimoSet={ultimoSet}
            pr={pr}
            es={es}
            darkMode={darkMode}
            bgCard={bgCard}
            bgSub={bgSub}
            border={border}
            textMain={textMain}
            textMuted={textMuted}
            sessionPRList={sessionPRList}
            videoOverrides={videoOverrides}
            setVideoModal={setVideoModal}
            logSet={logSet}
            startTimer={startTimer}
            setPrCelebration={setPrCelebration}
            progress={progress}
          />
        )}
        {nextEx&&nextInfo&&(
          <div style={{background:"#0D1520",borderRadius:10,padding:"10px 14px",marginBottom:12,
            border:"1px solid #1a2535",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:3,height:28,borderRadius:2,background:"#1E3A5F",flexShrink:0}}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,fontWeight:700,color:"#475569",letterSpacing:1,marginBottom:2}}>{es?"SIGUIENTE":"NEXT UP"}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#94A3B8"}}>{es?nextInfo.name:nextInfo.nameEn||nextInfo.name}</div>
              <div style={{fontSize:11,color:"#475569",marginTop:1}}>{nextInfo.muscle||""} · {nextEx.sets}×{nextEx.reps}{nextEx.kg?" · "+nextEx.kg+"kg":""}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        )}
      </div>
      <div style={{padding:"8px 16px 20px",flexShrink:0,background:bgCard,
        borderTop:"1px solid "+border}}>
        <button className="hov" onClick={finalizarSesion}
          style={{width:"100%",padding:"16px",background:"#2563EB",color:"#fff",border:"none",
            borderRadius:12,fontSize:18,fontWeight:900,cursor:"pointer",fontFamily:"inherit",letterSpacing:1}}>
          ✅ {es?"FINALIZAR ENTRENAMIENTO":"FINISH WORKOUT"}
        </button>
      </div>
    </div>
  );
}
