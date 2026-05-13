import React from 'react';
import { formatWorkoutSetLabel } from '../../lib/workoutSession.js';

export default function ExerciseHistoryModal({
  exercise,
  history = [],
  pattern,
  imageSrc,
  videoSrc,
  canAddToRoutine,
  darkMode,
  es,
  msg,
  btn,
  lbl,
  tag,
  bgCard,
  textMain,
  textMuted,
  onClose,
  onLogSet,
  onAddToRoutine,
}) {
  if (!exercise) return null;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:100,display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:bgCard,borderRadius:"16px 16px 0 0",padding:"20px 16px",width:"100%",maxHeight:"80dvh",overflowY:"auto"}} onClick={function(e){ e.stopPropagation(); }}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <span style={{fontSize:36}}>{pattern?.icon}</span>
          <div>
            <div style={{fontSize:28,fontWeight:800,letterSpacing:1}}>{es?exercise.name:exercise.nameEn}</div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <span style={tag(pattern?.color||"#2563EB")}>{es?pattern?.label:pattern?.labelEn}</span>
              <span style={{fontSize:13,color:textMuted}}>{exercise.muscle} · {exercise.equip}</span>
            </div>
          </div>
          <button className="hov" style={{...btn(),marginLeft:"auto",fontSize:22,padding:"4px 8px"}} onClick={onClose}>x</button>
        </div>
        <div style={{marginBottom:12}}>
          {imageSrc&&(
            <div style={{borderRadius:12,overflow:"hidden",background:darkMode?"#162234":"#E2E8F0",marginBottom:8,position:"relative"}}>
              <img src={imageSrc} alt={exercise.name}
                style={{width:"100%",maxHeight:200,objectFit:"cover",display:"block"}}
                onError={function(e){ e.target.style.display="none"; }}
              />
            </div>
          )}
          {videoSrc&&(
            <a href={videoSrc} target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:8,background:"#162234",border:"1px solid #2D4057",borderRadius:12,padding:"8px 16px",textDecoration:"none"}}>
              <span style={{fontSize:28}}>▶️</span>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:textMain}}>{msg("Ver video en YouTube", "Watch on YouTube")}</div>
                <div style={{fontSize:11,color:textMuted}}>{msg("Tutorial de técnica", "Technique tutorial")}</div>
              </div>
            </a>
          )}
        </div>
        <span style={lbl}>{msg("HISTORIAL", "HISTORY")}</span>
        {history.length===0&&<div style={{color:textMuted,fontSize:15,margin:"8px 0 10px"}}>{msg("Sin registros", "No records")}</div>}
        {history.slice(0,10).map(function(s2,i){
          return (
            <div key={exercise.id+"-hist-"+(s2.date||"")+"-"+(s2.kg??"")+"-"+(s2.reps??"")+"-"+(s2.week ?? "nw")+"-"+i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+(darkMode?"#2D4057":"#2D4057"),fontSize:15}}>
              <span>{formatWorkoutSetLabel(exercise, s2)}</span>
              <span style={{color:textMuted}}>{s2.date}</span>
            </div>
          );
        })}
        <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",marginTop:12,padding:"8px"}} onClick={onLogSet}>
          + LOG SET
        </button>
        {canAddToRoutine&&(
          <button className="hov" style={{...btn("#2563EB22"),color:"#2563EB",width:"100%",marginTop:8,padding:"8px"}} onClick={onAddToRoutine}>+ AGREGAR A RUTINA</button>
        )}
      </div>
    </div>
  );
}
