import React from 'react';
import { Ic } from '../Ic.jsx';
import StudentProgressSummary from './StudentProgressSummary.jsx';
import StudentRoutineActions from './StudentRoutineActions.jsx';

export default function StudentRoutinePreview({
  alumno,
  rutinaAsignada,
  dias = [],
  rId,
  progresoSemanal,
  semanaCiclo,
  semanaIdx,
  diasCompletados,
  semCalLabel,
  pctBar,
  diSel,
  dSel,
  proxTxt,
  warmupItems = [],
  exerciseItems = [],
  completedDays = [],
  coachRutinaMenuOpen,
  coachDiaSecsOpen = {},
  darkMode,
  msg,
  textMain,
  textMuted,
  coachAluSurface,
  coachAluBorderSoft,
  coachAluTrack,
  coachAluSubtle,
  coachAluDropdown,
  coachAluDropdownShadow,
  onToggleRoutineMenu,
  onResetWeek,
  onResetRoutine,
  onSelectDay,
  onToggleWarmup,
  onToggleMain,
  onEditWarmupExercise,
  onAddWarmupExercise,
  onEditMainExercise,
  onAddMainExercise,
  onEditRoutine,
  onRemoveRoutine,
}) {
  return (
    <div style={{marginBottom:8}}>
      <div style={{background:coachAluSurface,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"16px",position:"relative",boxShadow:darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:24,fontWeight:900,color:textMain,lineHeight:1.15}}>{rutinaAsignada.nombre}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:10,alignItems:"center"}}>
              <span style={{fontSize:14,color:textMuted,fontWeight:600}}>{dias.length} {msg("días", "days")}</span>
              <span style={{padding:"4px 10px",borderRadius:8,background:darkMode?"rgba(59,130,246,0.15)":"rgba(37,99,235,0.1)",border:"1px solid "+(darkMode?"rgba(59,130,246,0.35)":"rgba(37,99,235,0.35)"),color:"#2563eb",fontSize:12,fontWeight:800}}>{msg("Semana", "Week")} {semanaCiclo} {msg("de", "of")} 4</span>
              <span style={{fontSize:13,color:textMuted,fontWeight:600}}>{semCalLabel}</span>
            </div>
          </div>
          <StudentRoutineActions
            variant="menu"
            isMenuOpen={coachRutinaMenuOpen}
            msg={msg}
            textMuted={textMuted}
            coachAluBorderSoft={coachAluBorderSoft}
            coachAluSubtle={coachAluSubtle}
            coachAluDropdown={coachAluDropdown}
            coachAluDropdownShadow={coachAluDropdownShadow}
            onToggleMenu={onToggleRoutineMenu}
            onResetWeek={onResetWeek}
            onResetRoutine={onResetRoutine}
          />
        </div>
        <StudentProgressSummary
          alumno={alumno}
          rutinaAsignada={rutinaAsignada}
          progresoSemanal={progresoSemanal}
          dias={dias}
          diasCompletados={diasCompletados}
          pctBar={pctBar}
          proxTxt={proxTxt}
          darkMode={darkMode}
          msg={msg}
          textMain={textMain}
          textMuted={textMuted}
          coachAluTrack={coachAluTrack}
        />
        {dias.length > 0 && (
          <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:14,paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
            {dias.map(function(d, di){
              var dayDone = progresoSemanal.completedDayIndexes.indexOf(di) !== -1 || (!progresoSemanal.sesiones.length && completedDays.includes(rId+"-"+di+"-w"+semanaIdx));
              var active = di === diSel;
              return (
                <button
                  key={(rutinaAsignada?.id||"rut")+"-tab-"+di}
                  type="button"
                  className="hov"
                  onClick={function(){ onSelectDay(di); }}
                  style={{
                    flexShrink:0,
                    padding:"10px 14px",
                    borderRadius:10,
                    border:active?"2px solid #2563eb":"1px solid "+coachAluBorderSoft,
                    background:active?(darkMode?"rgba(59,130,246,0.18)":"rgba(37,99,235,0.12)"):coachAluSubtle,
                    color:active?textMain:textMuted,
                    fontSize:13,
                    fontWeight:800,
                    cursor:"pointer",
                    fontFamily:"inherit",
                    display:"flex",
                    alignItems:"center",
                    gap:6,
                  }}
                >
                  {msg("Día ", "Day ")}{di+1}
                  {dayDone ? <Ic name="check-sm" size={14} color="#22c55e"/> : null}
                </button>
              );
            })}
          </div>
        )}
        {dias.length > 0 && (
          <div style={{background:coachAluSubtle,borderRadius:12,border:"1px solid "+coachAluBorderSoft,padding:"12px"}}>
            <div style={{fontSize:12,fontWeight:800,color:textMuted,marginBottom:10}}>{dSel.label || ((msg("Día ", "Day "))+(diSel+1))} · {((dSel.warmup||[]).length+(dSel.exercises||[]).length)} {msg("ej.", "ex.")}</div>
            <div style={{marginBottom:12}}>
                <button type="button" className="hov" onClick={onToggleWarmup} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
                  <span style={{fontSize:12,fontWeight:800,color:"#f59e0b",letterSpacing:0.5}}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
                  <Ic name="chevron-right" size={16} color="#f59e0b" style={{transform:coachDiaSecsOpen.warmup?"rotate(90deg)":"none",transition:"transform .2s"}}/>
                </button>
                {coachDiaSecsOpen.warmup && (
                  <div>
                    {warmupItems.map(function(item){
                      var ex = item.ex;
                      return <div key={item.key} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:!item.isLast?"1px solid "+coachAluBorderSoft:"none"}}>
                        <div style={{flex:1,fontSize:14,fontWeight:600,color:textMain}}>{item.nombre}</div>
                        <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                        <button className="hov" onClick={function(){onEditWarmupExercise(item);}} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                      </div>;
                    })}
                    <button className="hov" onClick={onAddWarmupExercise} style={{width:"100%",marginTop:6,padding:"8px",background:"transparent",border:"1px dashed rgba(245,158,11,0.45)",borderRadius:8,fontSize:12,fontWeight:700,color:"#f59e0b",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={14} color="#f59e0b"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
                  </div>
                )}
            </div>
            <button type="button" className="hov" onClick={onToggleMain} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"6px 0",cursor:"pointer",marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:800,color:"#3b82f6",letterSpacing:0.5}}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
              <Ic name="chevron-right" size={16} color="#3b82f6" style={{transform:coachDiaSecsOpen.main?"rotate(90deg)":"none",transition:"transform .2s"}}/>
            </button>
            {coachDiaSecsOpen.main && (
              <div>
                {exerciseItems.map(function(item){
                  var ex = item.ex;
                  return <div key={item.key} style={{display:"flex",gap:8,padding:"8px 0",alignItems:"center",borderBottom:!item.isLast?"1px solid "+coachAluBorderSoft:"none"}}>
                    <div style={{flex:1,fontSize:15,fontWeight:700,color:textMain}}>{item.nombre}</div>
                    <div style={{fontSize:12,color:textMuted,marginRight:4}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
                    <button className="hov" onClick={function(){onEditMainExercise(item);}} style={{background:"transparent",border:"1px solid rgba(59,130,246,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic name="edit-2" size={14} color="#94a3b8"/></button>
                  </div>;
                })}
                <button className="hov" onClick={onAddMainExercise} style={{width:"100%",marginTop:8,padding:"8px",background:"transparent",border:"1px dashed rgba(59,130,246,0.4)",borderRadius:8,fontSize:13,fontWeight:700,color:"#3b82f6",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Ic name="plus" size={15} color="#3b82f6"/>{msg("+ Añadir ejercicio", "+ Add exercise")}</button>
              </div>
            )}
          </div>
        )}
        <StudentRoutineActions
          variant="editRemove"
          msg={msg}
          textMain={textMain}
          textMuted={textMuted}
          coachAluBorderSoft={coachAluBorderSoft}
          coachAluSubtle={coachAluSubtle}
          onEditRoutine={onEditRoutine}
          onRemoveRoutine={onRemoveRoutine}
        />
      </div>
    </div>
  );
}
