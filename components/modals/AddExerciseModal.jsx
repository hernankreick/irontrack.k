import React from 'react';
import { Ic } from '../Ic.jsx';
import { PATS } from '../../lib/exerciseStaticData.js';
import { bibMuscleFilterHaystack, formatBibMuscleDisplay } from '../../lib/appHelpers.js';

export default function AddExerciseModal({
  addExModal,
  addExSearch,
  setAddExSearch,
  addExPat,
  setAddExPat,
  addExMuscle,
  setAddExMuscle,
  addExSelectedIds,
  setAddExSelectedIds,
  allEx,
  coachDesktopNavHidden,
  darkMode,
  es,
  lang,
  msg,
  btn,
  inp,
  bgCard,
  border,
  textMuted,
  onClose,
  onConfirm,
}) {
  if (!addExModal) return null;

  return (
    <>
      <div
        role="presentation"
        style={{
          position:"fixed",top:0,right:0,bottom:0,left:260,zIndex:1200,
          display:"flex",flexDirection:"column",
          height:"100dvh",maxHeight:"100dvh",minHeight:0,
          boxSizing:"border-box",
          background:"rgba(0,0,0,.92)",
          ...(coachDesktopNavHidden
            ? {
                alignItems:"center",
                justifyContent:"center",
                padding:"max(12px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))",
                overflowY:"auto",
                overflowX:"hidden",
              }
            : {
                overflow:"hidden",
              }),
        }}
        onClick={onClose}
      >
        {!coachDesktopNavHidden ? (
        <div style={{flex:"1 1 0%",minHeight:0,minWidth:0}} aria-hidden />
        ) : null}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-ex-modal-title"
          style={{
            flex:"0 1 auto",
            width: coachDesktopNavHidden ? "min(100%, 1120px)" : "100%",
            maxWidth: coachDesktopNavHidden ? 1120 : undefined,
            minWidth: coachDesktopNavHidden ? 0 : undefined,
            maxHeight: coachDesktopNavHidden
              ? "min(90dvh, calc(100dvh - 40px))"
              : "80dvh",
            minHeight:0,
            display:"flex",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",
            background:bgCard,
            borderRadius: coachDesktopNavHidden ? 16 : "16px 16px 0 0",
            flexShrink: coachDesktopNavHidden ? 0 : undefined,
          }}
          onClick={e=>e.stopPropagation()}
        >
          <div style={{flex:"none",padding: coachDesktopNavHidden ? "18px 24px 0 24px" : "16px 16px 0 16px",background:bgCard}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
              <div style={{minWidth:0,paddingRight:8,flex:1}}>
                <div id="add-ex-modal-title" style={{fontSize:22,fontWeight:800,letterSpacing:1}}>{msg("Agregar ejercicios", "Add exercises")}</div>
                <div style={{fontSize:13,color:textMuted,marginTop:6,maxWidth: coachDesktopNavHidden ? "none" : 320,lineHeight:1.45,wordBreak:"break-word"}}>
                  {(addExModal.bloque||"exercises")==="warmup"
                    ? (msg("Tocá para marcar varios en entrada en calor; confirmá abajo.", "Tap to select warm-up exercises, then confirm."))
                    : (msg("Tocá para marcar varios en bloque principal; confirmá abajo.", "Tap to select main exercises, then confirm."))}
                </div>
              </div>
              <button type="button" className="hov" style={{...btn(),padding:"6px",flexShrink:0}} onClick={onClose} aria-label={msg("Cerrar", "Close")}><Ic name="x" size={20}/></button>
            </div>
            <input style={{...inp,marginBottom:12,width:"100%",boxSizing:"border-box"}} placeholder={msg("Buscar...", "Search...")} value={addExSearch} onChange={e=>setAddExSearch(e.target.value)}/>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,fontWeight:700,color:textMuted,letterSpacing:"0.06em",marginBottom:10,textTransform:"uppercase"}}>
                {msg("Patrones", "Patterns")}
              </div>
              <div style={{position:"relative",overflow:"hidden"}}>
                <div
                  className="add-ex-hscroll"
                  style={{
                    display:"flex",
                    flexDirection:"row",
                    flexWrap:"nowrap",
                    alignItems:"center",
                    gap:9,
                    overflowX:"auto",
                    overflowY:"hidden",
                    WebkitOverflowScrolling:"touch",
                    marginLeft:-6,
                    marginRight:-6,
                    paddingLeft:6,
                    paddingRight:6,
                    paddingBottom:2,
                    minHeight:46,
                  }}
                >
                  {Object.entries(PATS).map(([k,p])=>(
                    <button key={k} type="button" className="hov" style={{flex:"0 0 auto",background:addExPat===k?"#2563EB":"transparent",color:addExPat===k?"#ffffff":"#94a3b8",border:addExPat===k?"1px solid #2563EB":"1px solid #334155",boxShadow:"none",borderRadius:10,padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",textTransform:"uppercase",letterSpacing:".5px"}} onClick={()=>setAddExPat(addExPat===k?null:k)}>
                      {es?p.label:p.labelEn}
                    </button>
                  ))}
                </div>
                <div aria-hidden style={{position:"absolute",right:0,top:0,bottom:0,width:32,pointerEvents:"none",zIndex:2,background:"linear-gradient(to left, "+bgCard+" 0%, "+bgCard+"cc 35%, transparent 100%)"}} />
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:600,color:"#64748b",letterSpacing:"0.06em",marginBottom:8,textTransform:"uppercase",opacity:0.92}}>
                {msg("Músculos", "Muscles")}
              </div>
              <div style={{position:"relative",overflow:"hidden"}}>
                <div
                  className="add-ex-hscroll"
                  style={{
                    display:"flex",
                    flexDirection:"row",
                    flexWrap:"nowrap",
                    alignItems:"center",
                    gap:9,
                    overflowX:"auto",
                    overflowY:"hidden",
                    WebkitOverflowScrolling:"touch",
                    marginLeft:-6,
                    marginRight:-6,
                    paddingLeft:6,
                    paddingRight:6,
                    paddingBottom:2,
                    minHeight:40,
                  }}
                >
                  {["Cuádriceps","Glúteo","Isquiotibial","Pectoral","Espalda",
                    "Hombro","Core","Aductor","Abductor","Bíceps","Tríceps"]
                    .map(m=>(
                      <button key={m} type="button" className="hov" style={{
                        flex:"0 0 auto",
                        background: addExMuscle===m ? "#2563EB" : "transparent",
                        color: addExMuscle===m ? "#ffffff" : "#94a3b8",
                        border: addExMuscle===m ? "1px solid #2563EB" : "1px solid #334155",
                        boxShadow: "none",
                        borderRadius:8, padding:"8px 12px", fontSize:12, fontWeight:700,
                        cursor:"pointer", whiteSpace:"nowrap",
                        textTransform:"uppercase", letterSpacing:".5px"
                      }} onClick={()=>setAddExMuscle(addExMuscle===m?null:m)}>
                        {m}
                      </button>
                    ))
                  }
                </div>
                <div aria-hidden style={{position:"absolute",right:0,top:0,bottom:0,width:28,pointerEvents:"none",zIndex:2,background:"linear-gradient(to left, "+bgCard+" 0%, "+bgCard+"cc 40%, transparent 100%)"}} />
              </div>
            </div>
          </div>
          <div
            className={coachDesktopNavHidden ? "add-ex-list-scroll--desktop" : undefined}
            style={{
            flex:1,
            minHeight:0,
            minWidth:0,
            overflowY:"auto",
            overflowX:"hidden",
            WebkitOverflowScrolling:"touch",
            overscrollBehavior:"contain",
            padding: coachDesktopNavHidden
              ? "14px 32px 20px 32px"
              : "10px 20px 16px 20px",
            boxSizing:"border-box",
            touchAction:"pan-y",
          }}
          >
            {allEx.filter(e=>{
              const q=addExSearch.toLowerCase();
              if(addExPat&&e.pattern!==addExPat) return false;
              if(addExMuscle && !(formatBibMuscleDisplay(e.muscle, lang)||"").toLowerCase()
                .includes(addExMuscle.toLowerCase())) return false;
              if(!q) return true;
              return (e.name||"").toLowerCase().includes(q)||(e.nameEn||"").toLowerCase().includes(q)||bibMuscleFilterHaystack(e.muscle).includes(q);
            }).map(ex=>{
              const pat=PATS[ex.pattern]||{icon:"E",color:textMuted,label:"Otro",labelEn:"Other"};
              const sel=addExSelectedIds.includes(ex.id);
              return(
                <div
                  key={ex.id}
                  className={"add-ex-card add-ex-card--"+(darkMode?"dark":"light")}
                  role="button"
                  tabIndex={0}
                  style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 14px",marginBottom:8,marginLeft:1,marginRight:1,border:"none",boxSizing:"border-box",outline:"none",boxShadow:sel?"inset 0 0 0 2px "+(pat.color||"#2563EB"):"none",WebkitTapHighlightColor:"transparent",borderRadius:12}}
                  onMouseDown={e=>e.preventDefault()}
                  onClick={()=>setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];})}
                  onKeyDown={e=>{
                    if(e.key==="Enter"||e.key===" "){
                      e.preventDefault();
                      setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];});
                    }
                  }}
                >
                  <div style={{width:52,height:52,borderRadius:12,background:pat.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:pat.color,flexShrink:0,marginTop:2}}>{pat.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:18,fontWeight:700,lineHeight:1.25,wordBreak:"break-word"}}>{es?ex.name:ex.nameEn}</div>
                    <div style={{fontSize:12,fontWeight:700,color:pat.color,textTransform:"uppercase",letterSpacing:.4,marginTop:4,lineHeight:1.3}}>{es?pat.label:pat.labelEn}</div>
                    {(formatBibMuscleDisplay(ex.muscle, lang)||ex.equip)&&<div style={{fontSize:14,color:textMuted,marginTop:2,lineHeight:1.35,wordBreak:"break-word"}}>{[formatBibMuscleDisplay(ex.muscle, lang),ex.equip].filter(Boolean).join(" · ")}</div>}
                  </div>
                  <div style={{width:28,height:28,borderRadius:"50%",border:"none",boxShadow:sel?"inset 0 0 0 2px "+pat.color:"inset 0 0 0 2px "+border,background:sel?pat.color+"33":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:4}}>
                    {sel ? <Ic name="check-sm" size={16} color={pat.color}/> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              flexShrink:0,
              display:"flex",
              gap:8,
              background:darkMode?"#111":"#FFFFFF",
              padding: coachDesktopNavHidden
                ? "14px 20px calc(14px + env(safe-area-inset-bottom, 0px)) 20px"
                : "12px 16px calc(12px + env(safe-area-inset-bottom, 0px)) 16px",
              borderTop:"1px solid "+border,
              boxSizing:"border-box",
              boxShadow: coachDesktopNavHidden ? "0 -8px 24px rgba(0,0,0,0.12)" : "0 -10px 15px -3px rgba(0,0,0,0.5), 0 -4px 6px -2px rgba(0,0,0,0.3)",
            }}
            onClick={e=>e.stopPropagation()}
          >
            <button type="button" className="hov" style={{...btn(),flex:1,padding:"12px",fontWeight:700,textTransform:"uppercase",letterSpacing:".5px",fontSize:13}} onClick={onClose}>{msg("CANCELAR", "CANCEL")}</button>
            <button type="button" className="hov" style={{...btn("#2563EB"),flex:2,padding:"12px",fontWeight:800,opacity:addExSelectedIds.length?1:0.5,textTransform:"uppercase",letterSpacing:".5px",fontSize:13}} disabled={!addExSelectedIds.length} onClick={onConfirm}>{msg("AÑADIR SELECCIONADOS", "ADD SELECTED")}{addExSelectedIds.length?" ("+addExSelectedIds.length+")":""}</button>
          </div>
        </div>
      </div>
    </>
  );
}
