import React, { useState, useRef, useEffect } from 'react';
import { Ic } from './Ic.jsx';
import { useIronTrackI18n } from '../contexts/IronTrackI18nContext.jsx';
import { irontrackMsg as M, pickExerciseName, pickPatLabel } from '../lib/irontrackMsg.js';

export function LogForm({ex, btn, inp, lbl, tag, fmtP, progress, onLog, onClose, darkMode, PATS}) {
  const { lang } = useIronTrackI18n();
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

  const lastKg = progress[ex.id]?.sets?.[0]?.kg;
  const [kg,setKg]=useState(lastKg?String(lastKg):"");
  const [reps,setReps]=useState(ex.reps||"");
  const [note,setNote]=useState("");
  const [pause,setPause]=useState(ex.pause||90);
  const [rpe,setRpe]=useState(null);
  const [showAdvanced,setShowAdvanced]=useState(false);
  const pat=PATS[ex.pattern]||{icon:"E",color:"#8B9AB2",label:"Otro",labelEn:"Other"};
  const lastSet=progress[ex.id]?.sets?.[0];
  const isPR = parseFloat(kg)>0 && parseFloat(kg)>(progress[ex.id]?.max||0);
  const rpeColors={6:"#22C55E",7:"#22C55E",8:"#60A5FA",9:"#8B9AB2",10:"#2563EB"};
  const rpeLabels={6:M(lang,"Muy facil","Easy","Muito fácil"),7:M(lang,"Controlado","Moderate","Controlado"),8:M(lang,"Exigente","Hard","Exigente"),9:M(lang,"Muy duro","Very Hard","Muito pesado"),10:M(lang,"Al limite","Max","No limite")};
  const kgNum = parseFloat(kg)||0;
  const adjustKg = (delta) => setKg(v=>String(Math.max(0,(parseFloat(v)||0)+delta)));
  const holdTimer = useRef(null);
  const holdInterval = useRef(null);
  const suppressKgClick = useRef(false);

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (holdInterval.current) clearInterval(holdInterval.current);
    };
  }, []);

  const stopKgHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      holdInterval.current = null;
    }
  };

  const startKgHold = (sign) => {
    stopKgHold();
    suppressKgClick.current = false;
    holdTimer.current = setTimeout(() => {
      suppressKgClick.current = true;
      adjustKg(5 * sign);
      holdInterval.current = setInterval(() => adjustKg(5 * sign), 150);
    }, 500);
  };

  const onKgStepClick = (sign) => {
    if (suppressKgClick.current) {
      suppressKgClick.current = false;
      return;
    }
    adjustKg(sign);
  };

  return(
    <div style={{background:bgCard,borderRadius:"20px 20px 0 0",padding:"20px 16px 28px",width:"100%"}} onClick={e=>e.stopPropagation()}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <div style={{width:44,height:44,borderRadius:12,background:pat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>
          {pat.icon}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:22,fontWeight:900,color:textMain,lineHeight:1.1}}>{pickExerciseName(ex, lang)}</div>
          <div style={{fontSize:13,color:pat.color,fontWeight:700,marginTop:4}}>{pickPatLabel(pat, lang)} · {ex.sets}×{ex.reps}</div>
        </div>
        <button className="hov" style={{background:"transparent",border:"none",color:textMuted,fontSize:22,padding:"4px 8px",cursor:"pointer"}} onClick={onClose}><Ic name="x" size={16}/></button>
      </div>
      {lastSet&&(
        <div style={{background:bgSub,borderRadius:12,padding:"8px 12px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:13,color:textMuted}}>{M(lang,"Última vez","Last time","Última vez")}</span>
          <span style={{fontSize:15,fontWeight:800,color:textMain}}>{lastSet.kg}kg × {lastSet.reps} reps</span>
        </div>
      )}
      {isPR&&(
        <div style={{background:"#60A5FA22",border:"1px solid #f59e0b55",borderRadius:12,padding:"8px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:28}}><Ic name="award" size={28} color="#fbbf24"/></span>
          <div>
            <div style={{fontSize:15,fontWeight:900,color:"#60A5FA"}}>{M(lang,"¡NUEVO RÉCORD PERSONAL!","NEW PERSONAL RECORD!","NOVO RECORDE PESSOAL!")}</div>
            <div style={{fontSize:13,color:"#f59e0b88"}}>{kgNum}kg {M(lang,"supera tu máximo anterior","beats your previous max","supera seu máximo anterior")}</div>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:12}}>
        {/* PESO */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:10,fontWeight:700,color:"#475569",letterSpacing:1}}>PESO {isPR?"🏆":""}</span>
            {lastSet&&<span style={{fontSize:10,fontWeight:600,color:"#374151"}}>{M(lang,"Último","Last","Último")}: {lastSet.kg}kg</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button type="button" className="hov"
              style={{width:48,height:48,background:"#2563EB",border:"none",borderRadius:10,
                fontSize:22,fontWeight:900,color:"#fff",cursor:"pointer",flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}
              onClick={()=>onKgStepClick(-1)}
              onPointerDown={()=>startKgHold(-1)}
              onPointerUp={stopKgHold}
              onPointerLeave={stopKgHold}
              onPointerCancel={stopKgHold}
              aria-label={M(lang,"Menos 1 kg","Decrease 1 kg","Menos 1 kg")}
            >−</button>
            <div style={{flex:1,position:"relative"}}>
              <input
                type="number" value={kg} onChange={e=>setKg(e.target.value)}
                placeholder={lastSet?.kg?String(lastSet.kg):"0"}
                style={{width:"100%",height:48,background:"#111827",border:"1px solid "+(isPR?"#60A5FA":"#1E3A5F"),borderRadius:10,
                  textAlign:"left",fontSize:20,fontWeight:800,color:isPR?"#60A5FA":"#fff",padding:"0 40px 0 14px",
                  fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
              <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",fontSize:14,fontWeight:600,color:"#475569",pointerEvents:"none"}}>kg</span>
            </div>
            <button type="button" className="hov"
              style={{width:48,height:48,background:"#2563EB",border:"none",borderRadius:10,
                fontSize:22,fontWeight:900,color:"#fff",cursor:"pointer",flexShrink:0,
                display:"flex",alignItems:"center",justifyContent:"center",touchAction:"manipulation"}}
              onClick={()=>onKgStepClick(1)}
              onPointerDown={()=>startKgHold(1)}
              onPointerUp={stopKgHold}
              onPointerLeave={stopKgHold}
              onPointerCancel={stopKgHold}
              aria-label={M(lang,"Más 1 kg","Increase 1 kg","Mais 1 kg")}
            >+</button>
          </div>
          <div style={{fontSize:9,color:"#374151",marginTop:3}}>{M(lang,"Tocá ±1 kg · mantené ±5 kg","Tap ±1 kg · hold ±5 kg","Toque ±1 kg · segure ±5 kg")}</div>
        </div>
        {/* REPS pills */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:10,fontWeight:700,color:"#475569",letterSpacing:1}}>REPS</span>
            <span style={{fontSize:10,fontWeight:600,color:"#374151"}}>{reps} reps</span>
          </div>
          {(()=>{
            var repsStr=(ex?.reps||"8").toString();
            var prts=repsStr.split(/[-–x]/);
            var rMin=parseInt(prts[0])||8;
            var rMax=prts[1]?parseInt(prts[1])||rMin:rMin;
            if(rMax<rMin)rMax=rMin;
            var lo=Math.max(1,rMin-3),hi=rMax+10;
            var pills=[];for(var n=lo;n<=hi;n++)pills.push(n);
            return(
              <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
                {pills.map(function(pn){
                  var inR=pn>=rMin&&pn<=rMax;
                  var isT=parseInt(reps)===pn;
                  return(
                    <button key={pn} className="hov"
                      style={{minWidth:36,height:36,padding:"0 6px",border:"none",
                        borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,
                        background:isT?"#22C55E":inR?"#22C55E18":"#111827",
                        color:isT?"#fff":inR?"#22C55E":"#475569",
                        boxShadow:isT?"0 2px 8px rgba(34,197,94,0.3)":"none"}}
                      onClick={function(){setReps(String(pn));try{navigator.vibrate&&navigator.vibrate(15)}catch(ex){}}}>{pn}</button>
                  );
                })}
              </div>
            );
          })()}
          <div style={{fontSize:9,color:"#374151",textAlign:"center",marginTop:3}}>{M(lang,"← deslizá para cambiar reps →","← swipe to change reps →","← deslize para mudar as reps →")}</div>
        </div>
      </div>
      <button className="hov"
        style={{width:"100%",padding:"14px",background:isPR?"#60A5FA":"#2563EB",
          color:"#fff",border:"none",borderRadius:10,fontSize:16,fontWeight:800,
          cursor:"pointer",fontFamily:"inherit",letterSpacing:0.5,marginBottom:8,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6}}
        onClick={()=>{
          if(!kg||!reps) return;
          try{navigator.vibrate&&navigator.vibrate(50)}catch(e){}
          onLog(parseFloat(kg),parseInt(reps),note,pause,rpe);
        }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        {M(lang,"REGISTRAR SET","LOG SET","REGISTRAR SÉRIE")}
      </button>
      <button onClick={()=>setShowAdvanced(v=>!v)}
        style={{width:"100%",background:"transparent",border:"none",color:textMuted,fontSize:13,fontWeight:700,cursor:"pointer",padding:"4px",fontFamily:"inherit",marginBottom:showAdvanced?10:0}}>
        {showAdvanced?"▲ ":M(lang,"▼ Pausa · Nota · RPE","▼ Rest · Note · RPE","▼ Pausa · Nota · RPE")}
      </button>

      {showAdvanced&&(
        <div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>
              {M(lang,"PAUSA","REST","PAUSA")}: {fmtP(pause)}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {[0,60,90,120,180,240].map(p=>(
                <button key={p} className="hov"
                  style={{padding:"8px 12px",border:"1px solid "+(pause===p?pat?.color:border),borderRadius:8,
                    background:pause===p?pat?.color+"22":"transparent",color:pause===p?pat?.color:textMuted,
                    fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                  onClick={()=>setPause(p)}>
                  {p===0?M(lang,"No","Off","Não"):fmtP(p)}
                </button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>{M(lang,"NOTA","NOTE","NOTA")}</div>
            <input style={{...inp,width:"100%"}} value={note} onChange={e=>setNote(e.target.value)} placeholder={M(lang,"Sensaciones, técnica...","How did it feel?","Sensações, técnica...")}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:500,color:textMuted,letterSpacing:0.3,marginBottom:8}}>
              RPE {rpe?<span style={{color:rpeColors[rpe]}}>— {rpeLabels[rpe]}</span>:null}
            </div>
            <div style={{display:"flex",gap:4}}>
              {[6,7,8,9,10].map(v=>(
                <button key={v} className="hov"
                  style={{flex:1,padding:"8px 2px",border:"1px solid "+(rpe===v?rpeColors[v]:border),
                    borderRadius:8,background:rpe===v?rpeColors[v]+"33":"transparent",
                    color:rpe===v?rpeColors[v]:textMuted,fontSize:15,fontWeight:800,
                    cursor:"pointer",fontFamily:"inherit"}}
                  onClick={()=>setRpe(v===rpe?null:v)}>{v}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
