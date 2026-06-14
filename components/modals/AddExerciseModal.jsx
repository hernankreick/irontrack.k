import React, { useState } from 'react';
import { Ic } from '../Ic.jsx';
import { PATS } from '../../lib/exerciseStaticData.js';
import { bibMuscleFilterHaystack, formatBibMuscleDisplay, BIB_MUSCLE_OPTIONS } from '../../lib/appHelpers.js';

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
  const [musculoOpen, setMusculoOpen] = useState(false);
  if (!addExModal) return null;

  const MUSCULO_OPTIONS = BIB_MUSCLE_OPTIONS.map(o => ({ key: o.k, label: msg(o.selEs, o.selEn) }));
  const normalizar = str => String(str||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");

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
            width:"calc(100% - 16px)",
            maxWidth:900,
            minWidth: coachDesktopNavHidden ? 0 : undefined,
            height:"95vh",
            maxHeight: "95vh",
            minHeight:0,
            display:"flex",flexDirection:"column",overflow:"hidden",boxSizing:"border-box",
            background:bgCard,
            borderRadius: coachDesktopNavHidden ? 16 : "16px 16px 0 0",
            flexShrink: coachDesktopNavHidden ? 0 : undefined,
          }}
          onClick={e=>{e.stopPropagation();setMusculoOpen(false);}}
        >
          <div style={{flex:"none",padding: coachDesktopNavHidden ? "12px 24px 0 24px" : "12px 16px 0 16px",background:bgCard}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
              <div style={{minWidth:0,paddingRight:8,flex:1}}>
                <div id="add-ex-modal-title" style={{fontSize:18,fontWeight:800,letterSpacing:1}}>{msg("Agregar ejercicios", "Add exercises")}</div>
              </div>
              <button type="button" className="hov" style={{...btn(),padding:"6px",flexShrink:0}} onClick={onClose} aria-label={msg("Cerrar", "Close")}><Ic name="x" size={20}/></button>
            </div>
            <input style={{...inp,marginBottom:8,width:"100%",boxSizing:"border-box"}} placeholder={msg("Buscar...", "Search...")} value={addExSearch} onChange={e=>setAddExSearch(e.target.value)}/>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:10,fontWeight:700,color:"#6B7280",letterSpacing:".5px",textTransform:"uppercase",display:"block",marginBottom:4}}>PATRÓN</label>
              <select
                value={addExPat||""}
                onChange={e=>setAddExPat(e.target.value||null)}
                style={{width:"100%",padding:"7px 12px",borderRadius:8,border:"1px solid #1e1e2e",background:"#111827",color:"#E5E7EB",fontSize:13,fontFamily:"DM Sans, sans-serif"}}
              >
                <option value="">{msg("Todos los patrones","All patterns")}</option>
                {Object.entries(PATS).map(([k,p])=>(
                  <option key={k} value={k}>{es?p.label:p.labelEn}</option>
                ))}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <label style={{fontSize:10,fontWeight:700,color:"#6B7280",letterSpacing:".5px",textTransform:"uppercase",display:"block",marginBottom:4}}>MÚSCULO</label>
              <div style={{position:"relative"}}>
                <div
                  onClick={e=>{e.stopPropagation();setMusculoOpen(o=>!o);}}
                  style={{width:"100%",padding:"7px 12px",borderRadius:8,border:"1px solid #1e1e2e",background:"#111827",color:"#E5E7EB",fontSize:13,fontFamily:"DM Sans, sans-serif",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxSizing:"border-box"}}
                >
                  <span>{addExMuscle||msg("Todos los músculos","All muscles")}</span>
                  <span style={{fontSize:10}}>▼</span>
                </div>
                {musculoOpen&&(
                  <div style={{position:"absolute",top:"110%",left:0,right:0,background:"#111827",border:"1px solid #1e1e2e",borderRadius:8,zIndex:9999,maxHeight:200,overflowY:"auto"}}>
                    {[null,...MUSCULO_OPTIONS].map(opt=>(
                      <div
                        key={opt?opt.key:"__all"}
                        onClick={e=>{e.stopPropagation();setAddExMuscle(opt?opt.label:null);setMusculoOpen(false);}}
                        style={{padding:"10px 12px",cursor:"pointer",color:"#E5E7EB",fontSize:14,background:addExMuscle===(opt?opt.label:null)?"#1e3a5f":"transparent"}}
                      >
                        {opt?opt.label:msg("Todos los músculos","All muscles")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div
            className={coachDesktopNavHidden ? "add-ex-list-scroll--desktop" : undefined}
            style={{
            flexGrow:1,
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
              if(addExMuscle && !normalizar(e.muscle).includes(normalizar(addExMuscle))) return false;
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
                  style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",marginBottom:4,marginLeft:1,marginRight:1,border:"none",boxSizing:"border-box",outline:"none",boxShadow:sel?"inset 0 0 0 2px "+(pat.color||"#2563EB"):"none",WebkitTapHighlightColor:"transparent",borderRadius:10}}
                  onMouseDown={e=>e.preventDefault()}
                  onClick={()=>setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];})}
                  onKeyDown={e=>{
                    if(e.key==="Enter"||e.key===" "){
                      e.preventDefault();
                      setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];});
                    }
                  }}
                >
                  <div style={{width:44,height:44,borderRadius:11,background:pat.color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,fontWeight:800,color:pat.color,flexShrink:0}}>{pat.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:700,lineHeight:1.2,wordBreak:"break-word"}}>{es?ex.name:ex.nameEn}</div>
                    <div style={{fontSize:11,fontWeight:700,color:pat.color,textTransform:"uppercase",letterSpacing:.3,lineHeight:1.2}}>{es?pat.label:pat.labelEn}</div>
                    {(formatBibMuscleDisplay(ex.muscle, lang)||ex.equip)&&<div style={{fontSize:11,color:textMuted,lineHeight:1.2,wordBreak:"break-word"}}>{[formatBibMuscleDisplay(ex.muscle, lang),ex.equip].filter(Boolean).join(" · ")}</div>}
                  </div>
                  <div style={{width:22,height:22,borderRadius:"50%",border:"none",boxShadow:sel?"inset 0 0 0 2px "+pat.color:"inset 0 0 0 2px "+border,background:sel?pat.color+"33":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {sel ? <Ic name="check-sm" size={14} color={pat.color}/> : null}
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
