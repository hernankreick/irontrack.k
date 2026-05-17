import React from 'react';
import { DeleteConfirmModal } from '../DeleteConfirmModal.jsx';

export default function CoachConfirmDialog({
  dialog,
  config,
  loading,
  cancelLabel,
  onCancel,
  onConfirm,
}) {
  return (
    <DeleteConfirmModal
      key="it-coach-confirm"
      zIndex={10000}
      open={dialog.t !== 'none'}
      onCancel={onCancel}
      onConfirm={onConfirm}
      title={config.title}
      message={config.message}
      subjectName={config.subjectName}
      confirmLabel={config.confirmLabel}
      cancelLabel={cancelLabel}
      tone={config.tone}
      loading={loading}
      loadingLabel={config.loadingLabel}
      useLogoutIcon={!!config.useLogoutIcon}
      requireAcknowledge={!!config.requireAcknowledge}
      acknowledgeLabel={config.acknowledgeLabel}
    />
  );
}
