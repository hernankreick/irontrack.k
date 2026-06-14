import React, { useState } from 'react';
import { Ic } from '../Ic.jsx';
import { PATS } from '../../lib/exerciseStaticData.js';
import { bibMuscleFilterHaystack, BIB_MUSCLE_OPTIONS } from '../../lib/appHelpers.js';

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
  const normalizar = str => (str||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");

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
            width:"calc(100% - 40px)",
            maxWidth:900,
            minWidth: coachDesktopNavHidden ? 0 : undefined,
            maxHeight: "90vh",
            height: "90vh",
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
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:".5px",textTransform:"uppercase",display:"block",marginBottom:6}}>PATRÓN</label>
              <select
                value={addExPat||""}
                onChange={e=>setAddExPat(e.target.value||null)}
                style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #1e1e2e",background:"#111827",color:"#E5E7EB",fontSize:14,fontFamily:"DM Sans, sans-serif"}}
              >
                <option value="">{msg("Todos los patrones","All patterns")}</option>
                {Object.entries(PATS).map(([k,p])=>(
                  <option key={k} value={k}>{es?p.label:p.labelEn}</option>
                ))}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,fontWeight:700,color:"#6B7280",letterSpacing:".5px",textTransform:"uppercase",display:"block",marginBottom:6}}>MÚSCULO</label>
              <div style={{position:"relative"}}>
                <div
                  onClick={()=>setMusculoOpen(o=>!o)}
                  style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #1e1e2e",background:"#111827",color:"#E5E7EB",fontSize:14,fontFamily:"DM Sans, sans-serif",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxSizing:"border-box"}}
                >
                  <span>{addExMuscle||msg("Todos los músculos","All muscles")}</span>
                  <span style={{fontSize:10}}>▼</span>
                </div>
                {musculoOpen&&(
                  <div style={{position:"absolute",top:"110%",left:0,right:0,background:"#111827",border:"1px solid #1e1e2e",borderRadius:8,zIndex:9999,maxHeight:200,overflowY:"auto"}}>
                    {[null,...MUSCULO_OPTIONS].map(opt=>(
                      <div
                        key={opt?opt.key:"__all"}
                        onClick={()=>{setAddExMuscle(opt?opt.label:null);setMusculoOpen(false);}}
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
            flex:1,
            minHeight:0,
            maxHeight:"calc(90vh - 280px)",
            minWidth:0,
            overflowY:"scroll",
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
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:6,border:"1px solid #1e1e2e",background:"#0D1424",borderRadius:8,boxSizing:"border-box",outline:"none",WebkitTapHighlightColor:"transparent",cursor:"pointer"}}
                  onMouseDown={e=>e.preventDefault()}
                  onClick={()=>setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];})}
                  onKeyDown={e=>{
                    if(e.key==="Enter"||e.key===" "){
                      e.preventDefault();
                      setAddExSelectedIds(function(prev){return prev.includes(ex.id)?prev.filter(function(x){return x!==ex.id;}):[...prev,ex.id];});
                    }
                  }}
                >
                  <div style={{width:28,height:28,borderRadius:6,background:"#1e3a5f",color:"#2563EB",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    {(es?ex.name:ex.nameEn||"").charAt(0).toUpperCase()}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,fontWeight:700,color:"#F59E0B",letterSpacing:".3px",textTransform:"uppercase"}}>{es?pat.label:pat.labelEn}</div>
                    <div style={{fontSize:13,fontWeight:600,color:"#F9FAFB",lineHeight:1.3,wordBreak:"break-word"}}>{es?ex.name:ex.nameEn}</div>
                    {(formatBibMuscleDisplay(ex.muscle, lang)||ex.equip)&&<div style={{fontSize:11,color:"#6B7280",lineHeight:1.3,wordBreak:"break-word"}}>{[formatBibMuscleDisplay(ex.muscle, lang),ex.equip].filter(Boolean).join(" · ")}</div>}
                  </div>
                  <div style={{width:18,height:18,borderRadius:"50%",border:sel?"2px solid #2563EB":"2px solid #374151",background:sel?"#2563EB":"transparent",flexShrink:0}}/>
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
