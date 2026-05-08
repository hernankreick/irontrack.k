import React from 'react';
import { Ic } from '../Ic.jsx';
import StudentRoutinePreview from './StudentRoutinePreview.jsx';
import StudentSuggestionsPanel from './StudentSuggestionsPanel.jsx';

export default function StudentDetailPanel({
  alumno,
  rutinaActiva,
  routineForAssign,
  dias = [],
  rId,
  weeklyProgress,
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
  sugs = [],
  rutSB,
  suggestionsOpen,
  completedDays = [],
  coachRutinaMenuOpen,
  coachDiaSecsOpen = {},
  notaDiaInput,
  darkMode,
  es,
  msg,
  textMain,
  textMuted,
  bgSub,
  border,
  coachAluSurface,
  coachAluBorderSoft,
  coachAluTrack,
  coachAluSubtle,
  coachAluDropdown,
  coachAluDropdownShadow,
  coachAluGhostBtn,
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
  onAssignRoutine,
  onToggleSuggestions,
  onApplySuggestion,
  onIgnoreSuggestion,
  onNotaChange,
  onEnviarNota,
}) {
  if(!rutinaActiva) {
    return (
      <div>
        <div style={{background:coachAluSurface,borderRadius:12,padding:"16px",marginBottom:8,textAlign:"center",border:"1px solid "+coachAluBorderSoft}}>
          <div style={{fontSize:13,color:textMuted}}>{msg("Sin rutina asignada", "No routine assigned")}</div>
        </div>
        <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={onAssignRoutine}><Ic name="plus" size={16}/>{msg("Asignar rutina", "Assign routine")}</button>
        <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
          <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
            textTransform:"uppercase",marginBottom:8}}>
            <Ic name="bookmark" size={14} color={textMuted}/> {msg("Nota del día", "Daily note")}
          </div>
          <textarea
            style={{width:"100%",background:bgSub,color:textMain,border:"1px solid "+border,
              borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",
              resize:"none",lineHeight:1.5,outline:"none",minHeight:80}}
            placeholder={msg("Escribí una nota, recordatorio o indicación para el alumno...", "Write a note, reminder or instruction for this athlete...")}
            value={notaDiaInput}
            onChange={onNotaChange}
          />
          <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
            background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
            fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
            onClick={onEnviarNota}>
            {msg("Enviar nota", "Send note")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StudentRoutinePreview
        alumno={alumno}
        rutinaAsignada={rutinaActiva}
        dias={dias}
        rId={rId}
        progresoSemanal={weeklyProgress}
        semanaCiclo={semanaCiclo}
        semanaIdx={semanaIdx}
        diasCompletados={diasCompletados}
        semCalLabel={semCalLabel}
        pctBar={pctBar}
        diSel={diSel}
        dSel={dSel}
        proxTxt={proxTxt}
        warmupItems={warmupItems}
        exerciseItems={exerciseItems}
        completedDays={completedDays}
        coachRutinaMenuOpen={coachRutinaMenuOpen}
        coachDiaSecsOpen={coachDiaSecsOpen}
        darkMode={darkMode}
        msg={msg}
        textMain={textMain}
        textMuted={textMuted}
        coachAluSurface={coachAluSurface}
        coachAluBorderSoft={coachAluBorderSoft}
        coachAluTrack={coachAluTrack}
        coachAluSubtle={coachAluSubtle}
        coachAluDropdown={coachAluDropdown}
        coachAluDropdownShadow={coachAluDropdownShadow}
        onToggleRoutineMenu={onToggleRoutineMenu}
        onResetWeek={onResetWeek}
        onResetRoutine={onResetRoutine}
        onSelectDay={onSelectDay}
        onToggleWarmup={onToggleWarmup}
        onToggleMain={onToggleMain}
        onEditWarmupExercise={onEditWarmupExercise}
        onAddWarmupExercise={onAddWarmupExercise}
        onEditMainExercise={onEditMainExercise}
        onAddMainExercise={onAddMainExercise}
        onEditRoutine={onEditRoutine}
        onRemoveRoutine={onRemoveRoutine}
      />
      <button className="hov" style={{background:coachAluGhostBtn,color:textMuted,border:"1px solid "+coachAluBorderSoft,borderRadius:12,padding:"8px",width:"100%",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"center",gap:8}} onClick={onAssignRoutine}>{rutinaActiva?(<><Ic name="refresh-cw" size={16}/>{msg("Cambiar rutina", "Change routine")}</>):(<><Ic name="plus" size={16}/>{msg("Asignar rutina", "Assign routine")}</>)}</button>
      <StudentSuggestionsPanel
        alumno={alumno}
        rutinaAsignada={rutSB}
        sugerencias={sugs}
        isOpen={suggestionsOpen}
        msg={msg}
        textMain={textMain}
        textMuted={textMuted}
        bgSub={bgSub}
        border={border}
        onToggle={onToggleSuggestions}
        onApplySuggestion={onApplySuggestion}
        onIgnoreSuggestion={onIgnoreSuggestion}
      />
      <div style={{marginTop:12,borderTop:"1px solid "+border,paddingTop:12}}>
        <div style={{fontSize:11,fontWeight:600,color:textMuted,letterSpacing:1,
          textTransform:"uppercase",marginBottom:8}}>
          <Ic name="bookmark" size={14} color={textMuted}/> {msg("Nota del día", "Daily note")}
        </div>
        <textarea
          style={{width:"100%",background:bgSub,color:textMain,border:"1px solid "+border,
            borderRadius:12,padding:"8px 12px",fontSize:15,fontFamily:"Inter,sans-serif",
            resize:"none",lineHeight:1.5,outline:"none",minHeight:80}}
          placeholder={msg("Escribí una nota, recordatorio o indicación para el alumno...", "Write a note, reminder or instruction for this athlete...")}
          value={notaDiaInput}
          onChange={onNotaChange}
        />
        <button className="hov" style={{width:"100%",marginTop:8,padding:"8px",
          background:"#2563EB",color:"#fff",border:"none",borderRadius:12,
          fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
          onClick={onEnviarNota}>
          {msg("Enviar nota", "Send note")}
        </button>
      </div>
    </div>
  );
}
