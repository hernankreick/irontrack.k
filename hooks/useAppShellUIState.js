import { useCallback, useState } from 'react';

export function useAppShellUIState() {
  const [toast, setToast] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toast2 = useCallback(function (message, type) {
    setToast(message);
    setTimeout(function () {
      setToast(null);
    }, 2200);
  }, []);

  return {
    toast,
    setToast,
    toast2,
    settingsOpen,
    setSettingsOpen,
  };
}
