import React from 'react';
import GestionBiblioteca from '../library/GestionBiblioteca.jsx';

export default function CoachExercisesMain({
  allEx,
  setPatternOverrides,
  darkMode,
  sb,
  entrenadorId,
  customEx,
  setCustomEx,
  toast2,
  videoOverrides,
  setVideoOverrides,
  openNewExerciseTick,
}) {
  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-y-auto">
      <GestionBiblioteca
        allEx={allEx}
        setPatternOverrides={setPatternOverrides}
        darkMode={darkMode}
        sb={sb}
        entrenadorId={entrenadorId}
        customEx={customEx}
        setCustomEx={setCustomEx}
        toast2={toast2}
        videoOverrides={videoOverrides}
        setVideoOverrides={setVideoOverrides}
        openNewExerciseTick={openNewExerciseTick}
      />
    </div>
  );
}
