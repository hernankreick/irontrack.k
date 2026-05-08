import React from 'react';
import StudentRoutinePreview from './StudentRoutinePreview.jsx';
import StudentSuggestionsPanel from './StudentSuggestionsPanel.jsx';
import StudentNotesPanel from './StudentNotesPanel.jsx';
import StudentRoutineActions from './StudentRoutineActions.jsx';

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
        <StudentRoutineActions
          variant="assign"
          hasRoutine={false}
          msg={msg}
          textMuted={textMuted}
          coachAluBorderSoft={coachAluBorderSoft}
          coachAluGhostBtn={coachAluGhostBtn}
          onAssignRoutine={onAssignRoutine}
        />
        <StudentNotesPanel
          alumno={alumno}
          nota={notaDiaInput}
          msg={msg}
          textMain={textMain}
          textMuted={textMuted}
          bgSub={bgSub}
          border={border}
          onChange={onNotaChange}
          onSave={onEnviarNota}
        />
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
      <StudentRoutineActions
        variant="assign"
        hasRoutine={!!rutinaActiva}
        msg={msg}
        textMuted={textMuted}
        coachAluBorderSoft={coachAluBorderSoft}
        coachAluGhostBtn={coachAluGhostBtn}
        onAssignRoutine={onAssignRoutine}
      />
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
      <StudentNotesPanel
        alumno={alumno}
        nota={notaDiaInput}
        msg={msg}
        textMain={textMain}
        textMuted={textMuted}
        bgSub={bgSub}
        border={border}
        onChange={onNotaChange}
        onSave={onEnviarNota}
      />
    </div>
  );
}
