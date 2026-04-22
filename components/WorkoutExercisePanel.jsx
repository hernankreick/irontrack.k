import React from 'react';
import { Ic } from './Ic.jsx';
import { ExerciseVideoPlayButton } from './ExerciseVideoPlayButton.jsx';
import { getYTVideoId } from '../lib/getYTVideoId.js';
import { resolveExerciseTitle, resolveVideoUrl } from '../lib/exerciseResolve.js';

export function WorkoutExercisePanel(props) {
  const {
    activeExIdx,
    setActiveExIdx,
    exercises,
    ex,
    info,
    pat,
    setsHoy,
    totalSets,
    setsRestantes,
    setActualNum,
    ultimoSet,
    pr,
    es,
    darkMode,
    bgCard,
    bgSub,
    border,
    textMain,
    textMuted,
    sessionPRList,
    videoOverrides,
    setVideoModal,
    logSet,
    startTimer,
    setPrCelebration,
    progress,
  } = props;

  const [kg, setKg] = React.useState("");
  const [reps, setReps] = React.useState("");
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [setFlash, setSetFlash] = React.useState(false);
  const [showCheckAnim, setShowCheckAnim] = React.useState(false);
  const [swipeDelta, setSwipeDelta] = React.useState(0);
  const [swiping, setSwiping] = React.useState(false);
  const swipeStartX = React.useRef(null);
  const holdTimer = React.useRef(null);
  const holdInterval = React.useRef(null);
  const suppressKgClick = React.useRef(false);
  const [note, setNote] = React.useState("");
  const [pause, setPause] = React.useState(90);
  const [rpe, setRpe] = React.useState(null);

  const kgNum = parseFloat(kg)||0;
  const isPR = kgNum > 0 && kgNum > pr && pr > 0;

  React.useEffect(()=>{
    if(ex) {
      const lastKg = setsHoy[0]?.kg || progress[ex.id]?.sets?.[0]?.kg || ex.kg || "";
      setKg(lastKg ? String(lastKg) : "");
      setReps(ex.reps ? String(ex.reps) : "");
      setPause(ex.pause||90);
      setNote("");
      setRpe(null);
    }
  }, [activeExIdx]);

  React.useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (holdInterval.current) clearInterval(holdInterval.current);
    };
  }, []);

  const adjustKg = (d) => setKg(v=>String(Math.max(0,(parseFloat(v)||0)+d)));

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
  const fmtTime = s => s>=60?Math.floor(s/60)+"m"+(s%60>0?s%60+"s":""):s+"s";

  const displayName = resolveExerciseTitle(info, ex, es);
  const videoUrlResolved = resolveVideoUrl(info, ex, videoOverrides);

  const handleLogSet = () => {
    if(!kg || !reps) return;
    // Haptic feedback — vibración corta al registrar set
    try { if(navigator.vibrate) navigator.vibrate([40]); } catch(e){}
    // Micro-feedback: flash + check animation
    setSetFlash(true);
    setShowCheckAnim(true);
    setTimeout(()=>setSetFlash(false), 600);
    setTimeout(()=>setShowCheckAnim(false), 800);
    // Detectar PR
    const newKgVal = parseFloat(kg)||0;
    if(newKgVal > pr && pr > 0) {
      // Haptic doble para PR
      try { if(navigator.vibrate) navigator.vibrate([60,40,120]); } catch(e){}
      setPrCelebration({ejercicio: displayName, kg: newKgVal});
      setTimeout(()=>setPrCelebration(null), 2500);
    }
    logSet(ex.id, parseFloat(kg), parseInt(reps), note, rpe);
    if(pause>0) startTimer(pause, pat.color);
    setNote("");
    setRpe(null);
    // Si completó todos los sets, avanzar al siguiente ejercicio
    if(setsHoy.length + 1 >= totalSets) {
      const nextIdx = activeExIdx + 1;
      if(nextIdx < exercises.length) {
        setTimeout(()=>setActiveExIdx(nextIdx), 300);
      }
    }
  };

  return (
    <>
      <div style={{marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:12,background:"#0D1520",borderRadius:10,border:"1px solid #1a2535"}}>
          <div style={{width:4,height:36,borderRadius:2,background:pat.color||"#2563EB",flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:800,color:"#fff",lineHeight:1.15,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
              {displayName}
              {sessionPRList&&sessionPRList.some(function(p){return p.exId===ex.id})&&(
                <span style={{background:"#fbbf2422",border:"1px solid #fbbf2444",borderRadius:6,padding:"2px 8px",fontSize:10,fontWeight:800,color:"#fbbf24",flexShrink:0}}>PR</span>
              )}
            </div>
            <div style={{fontSize:12,color:"#64748B",fontWeight:600,marginTop:4,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              <span style={{background:"#2563EB22",borderRadius:4,padding:"1px 6px",color:"#60A5FA",fontWeight:700}}>{ex.sets}×{ex.reps}</span>
              {ex.kg&&<span>{ex.kg}kg</span>}
              {ex.pause&&<span>⏱ {fmtTime(ex.pause)}</span>}
            </div>
          </div>
          <ExerciseVideoPlayButton
            hasVideo={!!videoUrlResolved}
            onClick={function(){var vUrl=videoUrlResolved;var vid=getYTVideoId(vUrl);if(vid&&setVideoModal){setVideoModal({videoId:vid,nombre:displayName})}else{window.open(vUrl,"_blank")}}}
            ariaLabel={es?"Ver video del ejercicio":"View exercise video"}
            ariaLabelDisabled={es?"Video no disponible":"No video available"}
          />
        </div>
        {(pr>0||ultimoSet)&&(
          <div style={{display:"flex",gap:8,marginTop:8}}>
            {pr>0&&<span style={{background:"#f59e0b15",border:"1px solid #f59e0b33",borderRadius:6,
              padding:"4px 8px",fontSize:13,fontWeight:700,color:"#60A5FA"}}>
              🏆 PR {pr}kg
            </span>}
            {ultimoSet&&<span style={{background:bgSub,borderRadius:6,padding:"4px 8px",
              fontSize:13,fontWeight:500,color:textMuted}}>
              {es?"Último":"Last"}: {ultimoSet.kg}kg×{ultimoSet.reps}
            </span>}
          </div>
        )}
      </div>
      {setsHoy.length>0&&(
        <div style={{background:bgCard,borderRadius:12,border:"1px solid "+border,marginBottom:12,overflow:"hidden"}}>
          <div style={{padding:"8px 14px",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),
            fontSize:11,fontWeight:800,color:textMuted,letterSpacing:0.3}}>
            {es?"SETS DE HOY":"TODAY'S SETS"}
          </div>
          <div>
          {setsHoy.slice().reverse().map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",
              borderBottom:i<setsHoy.length-1?"1px solid "+border:"none"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"#22C55E20",
                color:"#22C55E",display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:13,fontWeight:900,flexShrink:0}}>✓</div>
              <div style={{flex:1,fontSize:18,fontWeight:800,color:textMain}}>
                {s.kg}kg × {s.reps} reps
              </div>
              {s.rpe&&<span style={{fontSize:13,color:textMuted,fontWeight:500}}>RPE {s.rpe}</span>}
            </div>
          ))}
          </div>
        </div>
      )}
      {setsRestantes>0?(
        <div
          style={{background:bgCard,borderRadius:16,border:"1px solid #243040",
            marginBottom:12,overflow:"hidden",
            transform:swiping?`translateX(${Math.min(swipeDelta,0)}px)`:"translateX(0)",
            transition:swiping?"none":"transform .25s cubic-bezier(.34,1.56,.64,1)",
            position:"relative",userSelect:"none",
            boxShadow:swipeDelta>60?"0 0 0 2px #22C55E44":"none"
          }}
          onTouchStart={e=>{
            swipeStartX.current = e.touches[0].clientX;
            setSwiping(true);
            setSwipeDelta(0);
          }}
          onTouchMove={e=>{
            if(swipeStartX.current===null) return;
            const dx = e.touches[0].clientX - swipeStartX.current;
            if(dx > 0) { setSwipeDelta(0); return; } // solo swipe izquierda
            setSwipeDelta(dx);
          }}
          onTouchEnd={()=>{
            setSwiping(false);
            if(swipeDelta < -80 && kg && reps) {
              // Haptic fuerte al completar por swipe
              try { if(navigator.vibrate) navigator.vibrate([30,30,60]); } catch(e){}
              handleLogSet();
            }
            setSwipeDelta(0);
            swipeStartX.current = null;
          }}
        >
          {/* Fondo verde que aparece al swipear */}
          <div style={{
            position:"absolute",top:0,bottom:0,right:0,
            width:Math.max(0,-swipeDelta),
            background:"linear-gradient(90deg,transparent,#22C55E33)",
            display:"flex",alignItems:"center",justifyContent:"flex-end",
            paddingRight:16,pointerEvents:"none",zIndex:0
          }}>
            {-swipeDelta > 50 && <Ic name="check-sm" size={22} color="#22C55E"/>}
          </div>
          <div style={{position:"relative",zIndex:1}}>
          <div style={{padding:"8px 16px",background:"#2D4057",borderBottom:"1px solid #24304022",
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:13,fontWeight:800,color:"#2563EB",letterSpacing:0.3}}>
              {es?"SET":"SET"} {setActualNum} {es?"de":"of"} {totalSets}
            </div>
            {setActualNum===1&&!swipeDelta&&(
              <div style={{fontSize:10,color:"#4A5C72",display:"flex",alignItems:"center",gap:3}}>
                <Ic name="arrow-left" size={10} color="#4A5C72"/> deslizá
              </div>
            )}
            {isPR&&(
              <div style={{fontSize:13,fontWeight:900,color:"#60A5FA",
                background:"#f59e0b15",border:"1px solid #f59e0b44",
                borderRadius:20,padding:"2px 10px"}}>
                🏆 PR
              </div>
            )}
          </div>

          <div style={{padding:"14px"}}>
            {/* Header progreso */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:10,fontWeight:800,color:"#2563EB",letterSpacing:2}}>SET {setActualNum} {es?"DE":"OF"} {totalSets}</div>
              <div style={{fontSize:10,fontWeight:600,color:"#475569"}}>{es?"Ej":"Ex"} {activeExIdx+1}/{exercises.length}</div>
            </div>
            <div style={{height:2,borderRadius:1,background:"#1a2535",marginBottom:12}}>
              <div style={{height:"100%",borderRadius:1,background:"#2563EB",width:Math.round((setsHoy.length/totalSets)*100)+"%",transition:"width .3s"}}/>
            </div>

            {/* PESO - input editable + botón [+] */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:10,fontWeight:700,color:"#475569",letterSpacing:1}}>PESO</span>
                {parseFloat(kg)>0&&<span style={{fontSize:10,fontWeight:600,color:"#374151"}}>{es?"Último":"Last"}: {kg}kg</span>}
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
                  aria-label={es?"Menos 1 kg":"Decrease 1 kg"}
                >−</button>
                <div style={{flex:1,position:"relative"}}>
                  <input
                    type="number" value={kg} onChange={e=>setKg(e.target.value)}
                    placeholder="0"
                    style={{width:"100%",height:48,background:"#111827",border:"1px solid #1E3A5F",borderRadius:10,
                      textAlign:"left",fontSize:20,fontWeight:800,color:"#fff",padding:"0 40px 0 14px",
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
                  aria-label={es?"Más 1 kg":"Increase 1 kg"}
                >+</button>
              </div>
              <div style={{fontSize:9,color:"#374151",marginTop:3}}>{es?"Tocá ±1 kg · mantené ±5 kg":"Tap ±1 kg · hold ±5 kg"}</div>
            </div>

            {/* REPS - pills dinámicas extendidas */}
            <div style={{marginBottom:12}}>
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
                  <div
                    onTouchStart={function(e){this._swX=e.touches[0].clientX}}
                    onTouchEnd={function(e){
                      var dx=e.changedTouches[0].clientX-(this._swX||0);
                      var cur=parseInt(reps)||rMin;
                      if(dx<-30&&cur<hi){setReps(String(cur+1));try{navigator.vibrate&&navigator.vibrate(15)}catch(ex){}}
                      else if(dx>30&&cur>lo){setReps(String(cur-1));try{navigator.vibrate&&navigator.vibrate(15)}catch(ex){}}
                    }}
                    style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
                    {pills.map(function(pn){
                      var inR=pn>=rMin&&pn<=rMax;
                      var isT=parseInt(reps)===pn;
                      return(
                        <button key={pn} className="hov"
                          style={{minWidth:36,height:36,padding:"0 6px",border:"none",
                            borderRadius:8,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0,
                            transition:"transform .15s,background .15s",
                            background:isT?"#22C55E":inR?"#22C55E18":"#111827",
                            color:isT?"#fff":inR?"#22C55E":"#475569",
                            boxShadow:isT?"0 2px 8px rgba(34,197,94,0.3)":"none"}}
                          onClick={function(){setReps(String(pn));try{navigator.vibrate&&navigator.vibrate(15)}catch(ex){}}}>{pn}</button>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{fontSize:9,color:"#374151",textAlign:"center",marginTop:3}}>{es?"← deslizá para cambiar reps →":"← swipe to change reps →"}</div>
            </div>

            {/* BOTÓN REGISTRAR */}
            <button className={"hov"+(showCheckAnim?" check-pulse":"")} onClick={handleLogSet}
              disabled={!kg||!reps}
              style={{width:"100%",padding:"14px",
                background:(!kg||!reps)?"#1a2535":showCheckAnim?"#22C55E":"#2563EB",
                color:(!kg||!reps)?"#475569":"#fff",border:"none",borderRadius:10,
                fontSize:16,fontWeight:800,cursor:(!kg||!reps)?"default":"pointer",
                fontFamily:"inherit",letterSpacing:0.5,marginBottom:8,
                transition:"background .15s ease",
                display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {showCheckAnim
                ?(<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 9 17 20 7"/></svg>
                    {es?"LISTO":"DONE"}
                  </span>)
                :(<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    {es?"REGISTRAR SET "+setActualNum:"LOG SET "+setActualNum}
                  </span>)
              }
            </button>
            <button onClick={()=>setShowAdvanced(v=>!v)}
              style={{width:"100%",background:"transparent",border:"none",color:"#475569",
                fontSize:11,fontWeight:700,cursor:"pointer",padding:"2px",fontFamily:"inherit"}}>
              {showAdvanced?"▲":"▼"} {es?"Pausa · Nota · RPE":"Rest · Note · RPE"}
            </button>
            {showAdvanced&&(
              <div style={{marginTop:8}}>
                <div style={{fontSize:11,color:textMuted,fontWeight:500,letterSpacing:0.3,marginBottom:8}}>
                  {es?"PAUSA":"REST"}
                </div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  {[0,60,90,120,180].map(p=>(
                    <button key={p} className="hov" onClick={()=>setPause(p)}
                      style={{flex:1,padding:"8px 4px",border:"1px solid "+(pause===p?pat.color:border),
                        borderRadius:8,background:pause===p?pat.color+"22":"transparent",
                        color:pause===p?pat.color:textMuted,fontSize:13,fontWeight:700,
                        cursor:"pointer",fontFamily:"inherit"}}>
                      {p===0?"Off":fmtTime(p)}
                    </button>
                  ))}
                </div>
                <input style={{width:"100%",background:bgSub,border:"1px solid "+border,
                  borderRadius:8,color:textMain,padding:"8px 10px",fontSize:13,fontFamily:"inherit",marginBottom:8}}
                  value={note} onChange={e=>setNote(e.target.value)}
                  placeholder={es?"Nota del set...":"Set note..."}/>
                <div style={{display:"flex",gap:4}}>
                  {[6,7,8,9,10].map(v=>(
                    <button key={v} className="hov" onClick={()=>setRpe(rpe===v?null:v)}
                      style={{flex:1,padding:"8px 2px",border:"1px solid "+(rpe===v?"#2563EB":border),
                        borderRadius:8,background:rpe===v?"#2563EB22":"transparent",
                        color:rpe===v?"#2563EB":textMuted,fontSize:13,fontWeight:800,
                        cursor:"pointer",fontFamily:"inherit"}}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      ):(
        /* Ejercicio completado */
        <div style={{background:"#22c55e15",border:"1px solid #22c55e33",borderRadius:12,
          padding:"16px",marginBottom:12,textAlign:"center"}}>
          <div style={{fontSize:36,marginBottom:4}}><Ic name="check-circle" size={22} color="#22C55E"/></div>
          <div style={{fontSize:18,fontWeight:900,color:"#22C55E"}}>
            {es?"Ejercicio completado":"Exercise complete"}
          </div>
          <div style={{fontSize:13,color:textMuted,marginTop:4}}>
            {setsHoy.length} sets · {setsHoy.reduce((a,s)=>a+(s.kg||0)*(s.reps||0),0).toLocaleString()} kg
          </div>
          {activeExIdx<exercises.length-1&&(
            <button className="hov" onClick={()=>setActiveExIdx(activeExIdx+1)}
              style={{marginTop:12,padding:"8px 24px",background:"#22C55E",color:"#fff",
                border:"none",borderRadius:12,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
              {es?"Siguiente ejercicio →":"Next exercise →"}
            </button>
          )}
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        {activeExIdx>0&&(
          <button className="hov" onClick={()=>setActiveExIdx(activeExIdx-1)}
            style={{flex:1,padding:"10px",background:"#0D1520",border:"1px solid #1a2535",
              borderRadius:10,color:"#64748B",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            ← {es?"Anterior":"Prev"}
          </button>
        )}
        {activeExIdx<exercises.length-1&&(
          <button className="hov" onClick={()=>setActiveExIdx(activeExIdx+1)}
            style={{flex:2,padding:"10px",background:"#0D1520",border:"1px solid #1a2535",
              borderRadius:10,color:"#94A3B8",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
            {es?"Siguiente":"Next"} →
          </button>
        )}
      </div>
    </>
  );
}
