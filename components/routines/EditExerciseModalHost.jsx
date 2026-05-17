import React from 'react';
import EditExModal from './EditExModal.jsx';

export default function EditExerciseModalHost({
  editEx,
  darkMode,
  btn,
  inp,
  allEx,
  es,
  PATS,
  msg,
  onSave,
  onClose,
}) {
  if (!editEx) return null;

  return (
    <EditExModal
      darkMode={darkMode}
      key={editEx.rId + "-" + editEx.dIdx + "-" + editEx.eIdx}
      editEx={editEx}
      btn={btn}
      inp={inp}
      allEx={allEx}
      es={es}
      PATS={PATS}
      msg={msg}
      onSave={onSave}
      onClose={onClose}
    />
  );
}
