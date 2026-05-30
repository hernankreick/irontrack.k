import React from 'react';
import ExerciseHistoryModal from './routines/ExerciseHistoryModal.jsx';
import EditExerciseModalHost from './routines/EditExerciseModalHost.jsx';

export default function AppExerciseModals({
  detailEx,
  detailProps,
  editProps,
}) {
  return (
    <>
      {detailEx && (
        <ExerciseHistoryModal {...detailProps} />
      )}
      <EditExerciseModalHost {...editProps} />
    </>
  );
}
