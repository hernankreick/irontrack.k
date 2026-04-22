import { useState, useLayoutEffect, useCallback } from "react";

/**
 * Instalación PWA (beforeinstallprompt + display-mode standalone / iOS standalone).
 * @returns {{ isInstalled: boolean, deferredPrompt: Event | null, install: () => Promise<void>, canInstall: boolean }}
 */
export function usePWAInstall() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useLayoutEffect(function () {
    if (typeof window === "undefined") return undefined;

    function computeInstalled() {
      try {
        if (window.matchMedia("(display-mode: standalone)").matches) return true;
        if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
        if (window.matchMedia("(display-mode: minimal-ui)").matches) return true;
      } catch (e) {}
      try {
        if (window.navigator.standalone === true) return true;
      } catch (e2) {}
      return false;
    }

    function refreshInstalled() {
      setIsInstalled(computeInstalled());
    }

    refreshInstalled();

    var mq = window.matchMedia("(display-mode: standalone)");
    var onDisplayModeChange = function () {
      refreshInstalled();
    };
    if (mq.addEventListener) mq.addEventListener("change", onDisplayModeChange);
    else mq.addListener(onDisplayModeChange);

    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredPrompt(e);
    }

    function onAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return function () {
      if (mq.removeEventListener) mq.removeEventListener("change", onDisplayModeChange);
      else mq.removeListener(onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const install = useCallback(async function () {
    if (!deferredPrompt || typeof deferredPrompt.prompt !== "function") return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (e) {}
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  var canInstall = !isInstalled && !!deferredPrompt;

  return { isInstalled, deferredPrompt, install, canInstall };
}
