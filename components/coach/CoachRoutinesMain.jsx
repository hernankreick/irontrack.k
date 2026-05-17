import React from 'react';
import { RutinaView } from '../RutinaView.jsx';

export default function CoachRoutinesMain({
  setTab,
  border,
  textMuted,
  bgCard,
  textMain,
  darkMode,
  bgSub,
  lang,
  es,
  filtroRut,
  setFiltroRut,
  card,
  setNewR,
  routines,
  setRoutines,
  allEx,
  toast2,
  setAddExModal,
  setAddExSearch,
  setAddExPat,
  setAddExMuscle,
  setAddExSelectedIds,
  setDupDayModal,
  alumnos,
  sb,
  setAssignRoutineId,
  desktopCoachStableLayout,
  rutinasSBEntrenador,
  setRutinasSBEntrenador,
}) {
  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col">
      <RutinaView
        setTab={setTab}
        border={border}
        textMuted={textMuted}
        bgCard={bgCard}
        textMain={textMain}
        darkMode={darkMode}
        bgSub={bgSub}
        lang={lang}
        es={es}
        filtroRut={filtroRut}
        setFiltroRut={setFiltroRut}
        card={card}
        setNewR={setNewR}
        routines={routines}
        setRoutines={setRoutines}
        allEx={allEx}
        toast2={toast2}
        setAddExModal={setAddExModal}
        setAddExSearch={setAddExSearch}
        setAddExPat={setAddExPat}
        setAddExMuscle={setAddExMuscle}
        setAddExSelectedIds={setAddExSelectedIds}
        setDupDayModal={setDupDayModal}
        alumnos={alumnos}
        sb={sb}
        setAssignRoutineId={setAssignRoutineId}
        desktopCoachStableLayout={desktopCoachStableLayout}
        rutinasSBEntrenador={rutinasSBEntrenador}
        setRutinasSBEntrenador={setRutinasSBEntrenador}
      />
    </div>
  );
}
