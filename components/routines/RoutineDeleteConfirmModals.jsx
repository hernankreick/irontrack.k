import React from 'react';
import { DeleteConfirmModal } from '../DeleteConfirmModal.jsx';

export default function RoutineDeleteConfirmModals({
  deleteRoutineTarget,
  deleteRoutineSubmitting,
  pendingDeleteDay,
  confirmDeleteRoutine,
  setDeleteRoutineTarget,
  runDeleteDay,
  setPendingDeleteDay,
  M,
  lang,
}) {
  return (
    <>
      <DeleteConfirmModal
        open={!!deleteRoutineTarget}
        zIndex={10000}
        tone="danger"
        onCancel={function () {
          if (deleteRoutineSubmitting) return;
          setDeleteRoutineTarget(null);
        }}
        onConfirm={function () {
          void confirmDeleteRoutine();
        }}
        title={M(lang, 'Eliminar rutina', 'Delete routine', 'Excluir rotina')}
        message={M(
          lang,
          'Esta acción no se puede deshacer. La rutina se eliminará definitivamente.',
          'This action cannot be undone. The routine will be permanently deleted.',
          'Esta ação não pode ser desfeita. A rotina será excluída permanentemente.'
        )}
        subjectName={deleteRoutineTarget && deleteRoutineTarget.name}
        confirmLabel={M(lang, 'Eliminar', 'Delete', 'Excluir')}
        cancelLabel={M(lang, 'Cancelar', 'Cancel', 'Cancelar')}
        loading={deleteRoutineSubmitting}
        loadingLabel={M(lang, 'Eliminando…', 'Deleting…', 'Excluindo…')}
      />

      <DeleteConfirmModal
        open={!!pendingDeleteDay}
        zIndex={10000}
        tone="danger"
        onCancel={function () {
          setPendingDeleteDay(null);
        }}
        onConfirm={runDeleteDay}
        title={M(lang, 'Eliminar día', 'Delete day', 'Excluir dia')}
        message={M(
          lang,
          'Esta acción no se puede deshacer. El día se quitará de la rutina.',
          'This action cannot be undone. The day will be removed from the routine.',
          'Esta ação não pode ser desfeita. O dia será removido da rotina.'
        )}
        subjectName={pendingDeleteDay ? pendingDeleteDay.dayLabel : ''}
        confirmLabel={M(lang, 'Eliminar', 'Delete', 'Excluir')}
        cancelLabel={M(lang, 'Cancelar', 'Cancel', 'Cancelar')}
      />
    </>
  );
}
