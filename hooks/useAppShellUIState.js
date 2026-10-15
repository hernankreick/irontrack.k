import { useCallback, useEffect, useRef, useState } from 'react';

// Duracion estandar de los avisos (ms).
export const TOAST_DURATION_MS = 3000;

export function useAppShellUIState() {
  const [toast, setToast] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toastTimerRef = useRef(null);

  // Un aviso nuevo cancela el temporizador del anterior: asi dura el tiempo completo y el anterior no lo borra antes de tiempo.
  const toast2 = useCallback(function (message, type) {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(function () {
      toastTimerRef.current = null;
      setToast(null);
    }, TOAST_DURATION_MS);
  }, []);

  // Al desmontar se cancela el temporizador pendiente (evita setState sobre un componente desmontado).
  useEffect(function () {
    return function () {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return {
    toast,
    setToast,
    toast2,
    settingsOpen,
    setSettingsOpen,
  };
}
