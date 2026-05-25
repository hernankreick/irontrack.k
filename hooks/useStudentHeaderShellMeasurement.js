import { useLayoutEffect } from "react";

export function useStudentHeaderShellMeasurement({
  headerResizeObserver,
  esAlumno,
  tab,
  routinesLength,
  studentHeaderShellLockedHeightPxRef,
  shellMinHeightPxRef,
  shellMeasureRafRef,
  studentHeaderExpandRef,
  studentHeaderShellRef,
  studentHeaderExpandHeightRef,
  headerCollapsedRef,
  alumnoHeaderMiniPx,
  applyAlumnoHeaderLayerStyles,
}) {
  useLayoutEffect(function () {
    if (!headerResizeObserver) return undefined;
    if (typeof ResizeObserver === "undefined") return undefined;
    if (!esAlumno || tab !== "plan") return undefined;
    studentHeaderShellLockedHeightPxRef.current = 0;
    shellMinHeightPxRef.current = -1;
    var cancelled = false;
    var ro = null;
    var waitId = null;
    var attempts = 0;
    function flushShellMeasure() {
      shellMeasureRafRef.current = null;
      if (cancelled) return;
      var expand = studentHeaderExpandRef.current;
      var shell = studentHeaderShellRef.current;
      if (!expand || !shell) return;
      var contentH = Math.max(expand.offsetHeight, expand.scrollHeight);
      var measuredPx = Math.ceil(contentH + alumnoHeaderMiniPx);
      var lockedPx = Math.max(studentHeaderShellLockedHeightPxRef.current, measuredPx);
      if (lockedPx < 1) return;
      studentHeaderShellLockedHeightPxRef.current = lockedPx;
      if (lockedPx === shellMinHeightPxRef.current) {
        if (expand.offsetHeight > 0) studentHeaderExpandHeightRef.current = expand.offsetHeight;
        applyAlumnoHeaderLayerStyles(headerCollapsedRef.current);
        return;
      }
      shellMinHeightPxRef.current = lockedPx;
      shell.style.minHeight = lockedPx + "px";
      shell.style.height = lockedPx + "px";
      shell.style.boxSizing = "border-box";
      if (expand.offsetHeight > 0) studentHeaderExpandHeightRef.current = expand.offsetHeight;
      applyAlumnoHeaderLayerStyles(headerCollapsedRef.current);
    }
    function scheduleShellMeasure() {
      if (shellMeasureRafRef.current != null) return;
      shellMeasureRafRef.current = requestAnimationFrame(flushShellMeasure);
    }
    function onResizeObserver() {
      scheduleShellMeasure();
    }
    function tryConnect() {
      if (cancelled) return;
      attempts++;
      var expand = studentHeaderExpandRef.current;
      var shell = studentHeaderShellRef.current;
      if (expand && shell) {
        shellMinHeightPxRef.current = -1;
        scheduleShellMeasure();
        ro = new ResizeObserver(onResizeObserver);
        ro.observe(expand);
        return;
      }
      if (attempts < 120) waitId = requestAnimationFrame(tryConnect);
    }
    waitId = requestAnimationFrame(tryConnect);
    return function () {
      cancelled = true;
      if (waitId != null) cancelAnimationFrame(waitId);
      if (shellMeasureRafRef.current != null) {
        cancelAnimationFrame(shellMeasureRafRef.current);
        shellMeasureRafRef.current = null;
      }
      if (ro) ro.disconnect();
      shellMinHeightPxRef.current = -1;
      studentHeaderShellLockedHeightPxRef.current = 0;
    };
  }, [tab, esAlumno, routinesLength, headerResizeObserver]);
}
