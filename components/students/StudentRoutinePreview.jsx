import React from 'react';
import { Ic } from '../Ic.jsx';
import StudentProgressSummary from './StudentProgressSummary.jsx';
import StudentRoutineActions from './StudentRoutineActions.jsx';
import { studentCardPalette } from './studentCardPalette.js';

const ORANGE = "#f59e0b";

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
  proxDiaIdx,
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
  onValidateSession,
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
  var P = studentCardPalette({ darkMode: darkMode, coachAluSurface: coachAluSurface, coachAluBorderSoft: coachAluBorderSoft, coachAluSubtle: coachAluSubtle });
  var editBtn = {width:44,height:44,flexShrink:0,background:"transparent",border:"1px solid "+P.border,borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0};
  var secBtn = {width:"100%",minHeight:44,display:"flex",alignItems:"center",justifyContent:"space-between",background:"transparent",border:"none",padding:"0",cursor:"pointer",fontFamily:"inherit"};
  var addBtn = {width:"100%",minHeight:44,marginTop:8,padding:"8px",background:"transparent",border:"1px dashed rgba(245,158,11,0.6)",borderRadius:10,fontSize:14,fontWeight:700,color:ORANGE,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8};
  function exerciseRow(item, onEdit) {
    var ex = item.ex;
    return <div key={item.key} style={{display:"flex",gap:10,padding:"6px 0",alignItems:"center",borderBottom:!item.isLast?"1px solid "+P.border:"none"}}>
      <div style={{flex:1,minWidth:0,fontSize:14,fontWeight:700,color:textMain,lineHeight:1.3,overflowWrap:"break-word"}}>{item.nombre}</div>
      <div style={{fontSize:13,color:textMuted,whiteSpace:"nowrap",flexShrink:0}}>{ex.sets}×{ex.reps}{ex.kg?" · "+ex.kg+"kg":""}</div>
      <button type="button" className="hov" aria-label={msg("Editar ejercicio", "Edit exercise") + ": " + item.nombre} onClick={function(){onEdit(item);}} style={editBtn}><Ic name="edit-2" size={16} color={textMuted}/></button>
    </div>;
  }
  var proxDayIdx = Number.isInteger(proxDiaIdx) && proxDiaIdx >= 0 && proxDiaIdx < dias.length ? proxDiaIdx : null;

  return (
    <div style={{marginBottom:8,marginTop:12}}>
      <div style={{background:P.surface,border:"1px solid "+P.borderStrong,borderRadius:16,padding:"16px 12px",position:"relative",boxShadow:darkMode ? "none" : "0 1px 3px rgba(15,23,42,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,marginBottom:14}}>
          <span aria-hidden="true" style={{width:46,height:46,borderRadius:"50%",background:"#22c55e",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Ic name="dumbbell" size={24} color="#fff"/>
          </span>
          <div style={{flex:1,minWidth:0}}>
            <div data-qa-text style={{fontSize:19,fontWeight:900,color:textMain,lineHeight:1.2,overflowWrap:"anywhere"}}>{rutinaAsignada.nombre}</div>
            <div style={{fontSize:13,color:textMuted,fontWeight:600,marginTop:3,lineHeight:1.3}}>
              {dias.length} {msg(dias.length === 1 ? "día por semana" : "días por semana", dias.length === 1 ? "day per week" : "days per week")} · 4 {msg("semanas", "weeks")}
            </div>
          </div>
          <StudentRoutineActions
            variant="menu"
            isMenuOpen={coachRutinaMenuOpen}
            msg={msg}
            textMuted={textMuted}
            coachAluBorderSoft={P.border}
            coachAluSubtle={P.inner}
            coachAluDropdown={coachAluDropdown}
            coachAluDropdownShadow={coachAluDropdownShadow}
            onToggleMenu={onToggleRoutineMenu}
            onResetWeek={onResetWeek}
            onResetRoutine={onResetRoutine}
            onValidateSession={onValidateSession}
          />
        </div>
        <StudentProgressSummary
          alumno={alumno}
          rutinaAsignada={rutinaAsignada}
          progresoSemanal={progresoSemanal}
          dias={dias}
          diasCompletados={diasCompletados}
          pctBar={pctBar}
          semanaCiclo={semanaCiclo}
          semCalLabel={semCalLabel}
          palette={P}
          darkMode={darkMode}
          msg={msg}
          textMain={textMain}
          textMuted={textMuted}
          coachAluTrack={coachAluTrack}
        />
        {dias.length > 0 && (
          <div data-qa-scroll-x style={{display:"flex",gap:8,overflowX:"auto",marginBottom:12,paddingBottom:2,WebkitOverflowScrolling:"touch"}}>
            {dias.map(function(d, di){
              // Check de dia completado = sesion finalizada persistida (la posicion ya sale de `sesiones`); it_cd/progreso no cuentan.
              var dayDone = progresoSemanal.completedDayIndexes.indexOf(di) !== -1;
              var active = di === diSel;
              return (
                <button
                  key={(rutinaAsignada?.id||"rut")+"-tab-"+di}
                  type="button"
                  className="hov it-ficha-day"
                  aria-pressed={active}
                  aria-label={msg("Día ", "Day ") + (di+1) + " — " + (dayDone ? msg("Realizado", "Done") : msg("Pendiente", "Pending"))}
                  onClick={function(){ onSelectDay(di); }}
                  style={{
                    flex:"1 0 auto",
                    minHeight:52,
                    padding:"8px",
                    borderRadius:12,
                    border:active?"2px solid #3b82f6":"1px solid "+P.border,
                    background:active?P.blueSoft:P.inner,
                    cursor:"pointer",
                    fontFamily:"inherit",
                    display:"flex",
                    alignItems:"center",
                    gap:7,
                    textAlign:"left",
                    boxSizing:"border-box",
                  }}
                >
                  <span aria-hidden="true" style={{width:24,height:24,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:dayDone?"#22c55e":"#2563eb"}}>
                    <Ic name={dayDone ? "check-sm" : "clock"} size={dayDone ? 14 : 13} color="#fff"/>
                  </span>
                  <span style={{minWidth:0}}>
                    <span style={{display:"block",fontSize:14,fontWeight:800,color:textMain,lineHeight:1.2,whiteSpace:"nowrap"}}>{msg("Día ", "Day ")}{di+1}</span>
                    <span style={{display:"block",fontSize:11.5,fontWeight:600,color:textMuted,lineHeight:1.3,whiteSpace:"nowrap"}}>{dayDone ? msg("Realizado", "Done") : msg("Pendiente", "Pending")}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {proxTxt ? (
          <button
            type="button"
            className="hov"
            disabled={proxDayIdx == null}
            onClick={function(){ if (proxDayIdx != null) onSelectDay(proxDayIdx); }}
            aria-label={msg("Próxima sesión: ", "Next session: ") + proxTxt}
            style={{width:"100%",minHeight:48,display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 12px",background:P.blueSoft,border:"1px solid "+P.border,borderRadius:12,cursor:proxDayIdx == null ? "default" : "pointer",fontFamily:"inherit",textAlign:"left",boxSizing:"border-box"}}
          >
            <Ic name="calendar" size={18} color="#3b82f6" style={{flexShrink:0}}/>
            <span data-qa-text style={{flex:1,minWidth:0,fontSize:14,lineHeight:1.35}}>
              <span style={{color:textMuted,fontWeight:600}}>{msg("Próxima sesión:", "Next session:")} </span>
              <span style={{color:textMain,fontWeight:800}}>{proxTxt}</span>
            </span>
            {proxDayIdx != null ? <Ic name="chevron-right" size={18} color={textMuted} style={{flexShrink:0}}/> : null}
          </button>
        ) : null}
        {dias.length > 0 && (
          <div style={{background:P.inner,borderRadius:14,border:"1px solid "+P.border,padding:"12px 14px"}}>
            <div style={{fontSize:14,fontWeight:800,color:textMain,marginBottom:4}}>{dSel.label || ((msg("Día ", "Day "))+(diSel+1))} <span style={{color:textMuted,fontWeight:600}}>· {((dSel.warmup||[]).length+(dSel.exercises||[]).length)} {msg("ej.", "ex.")}</span></div>
            <div style={{marginBottom:6}}>
                <button type="button" className="hov" aria-expanded={!!coachDiaSecsOpen.warmup} onClick={onToggleWarmup} style={secBtn}>
                  <span style={{fontSize:13,fontWeight:800,color:ORANGE,letterSpacing:0.6}}>{msg("ENTRADA EN CALOR", "WARM-UP")}</span>
                  <Ic name="chevron-right" size={18} color={ORANGE} style={{transform:coachDiaSecsOpen.warmup?"rotate(90deg)":"none",transition:"transform .2s"}}/>
                </button>
                {coachDiaSecsOpen.warmup && (
                  <div style={{borderTop:"1px solid "+P.border}}>
                    {warmupItems.map(function(item){ return exerciseRow(item, onEditWarmupExercise); })}
                    <button className="hov" onClick={onAddWarmupExercise} style={addBtn}><Ic name="plus" size={16} color={ORANGE}/>{msg("Añadir ejercicio", "Add exercise")}</button>
                  </div>
                )}
            </div>
            <button type="button" className="hov" aria-expanded={!!coachDiaSecsOpen.main} onClick={onToggleMain} style={secBtn}>
              <span style={{fontSize:13,fontWeight:800,color:ORANGE,letterSpacing:0.6}}>{msg("BLOQUE PRINCIPAL", "MAIN BLOCK")}</span>
              <Ic name="chevron-right" size={18} color={ORANGE} style={{transform:coachDiaSecsOpen.main?"rotate(90deg)":"none",transition:"transform .2s"}}/>
            </button>
            {coachDiaSecsOpen.main && (
              <div style={{borderTop:"1px solid "+P.border}}>
                {exerciseItems.map(function(item){ return exerciseRow(item, onEditMainExercise); })}
                <button className="hov" onClick={onAddMainExercise} style={addBtn}><Ic name="plus" size={16} color={ORANGE}/>{msg("Añadir ejercicio", "Add exercise")}</button>
              </div>
            )}
          </div>
        )}
        <StudentRoutineActions
          variant="editRemove"
          msg={msg}
          textMain={textMain}
          textMuted={textMuted}
          coachAluBorderSoft={P.border}
          coachAluSubtle={P.inner}
          onEditRoutine={onEditRoutine}
          onRemoveRoutine={onRemoveRoutine}
        />
      </div>
    </div>
  );
}
