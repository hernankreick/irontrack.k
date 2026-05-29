import React from 'react';
import { DeleteConfirmModal } from '../DeleteConfirmModal.jsx';

export default function WorkoutExitConfirmModal({
  open,
  es,
  onCancel,
  onConfirm,
}) {
  return (
    <DeleteConfirmModal
      zIndex={10000}
      open={open}
      tone="caution"
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={es ? 'Salir del entrenamiento' : 'Exit workout'}
      message={
        es
          ? 'Vas a salir sin finalizar. Los sets aún no guardados en almacenamiento local se pueden perder.'
          : "You'll leave without finishing. Sets not yet stored locally may be lost."
      }
      confirmLabel={es ? 'Salir' : 'Exit'}
      cancelLabel={es ? 'Cancelar' : 'Cancel'}
      variant="workoutExit"
      loading={false}
    />
  );
}
